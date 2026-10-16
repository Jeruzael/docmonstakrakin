/**
 * Stage B2b preflight ONLY. Produces no canonical, Git, ledger or runtime writes.
 *
 * DO NOT interpret a preview as approval or authority to apply. The trusted
 * inputs to v2 must be resolved through independent, authenticated channels.
 * The final atomic/CAS commit and human enrollment ceremony are NOT here.
 */
import crypto from 'node:crypto';
import { HISTORICAL_WBS_SHA256 } from './verifyForwardWbsEvidence.ts';
import {
  registrationSigningPayloadV2,
  verifyTrustedWbsRegistrationV2,
  type SignedReceiptV2,
  type TrustedPolicyV2,
  type TrustedVerificationContextV2,
} from './verifyTrustedWbsRegistrationV2.ts';

export interface WbsReceiptLedgerEntryV1 {
  receiptId: string;
  preWbsSha256: string;
  postWbsSha256: string;
  policySha256: string;
  signedIntentSha256: string;
  signedReceiptSha256: string;
  reviewedHeadCommitSha: string;
  reviewedHeadTreeSha: string;
  pullRequestNumber: number;
}
export interface WbsReceiptLedgerV1 {
  schemaVersion: '1.0';
  projectId: 'PRJ-DOCMONSTAKRAKIN';
  genesisWbsSha256: string;
  entries: WbsReceiptLedgerEntryV1[];
}
export interface WbsRegistrationPreflightResult {
  valid: boolean;
  mode: 'PREVIEW_VALID' | 'REJECTED';
  /** Previewing evidence never approves a registration or writes any bytes. */
  mayApply: false;
  errors: string[];
  currentWbsSha256: string;
  currentLedgerSha256: string;
  proposedWbsSha256?: string;
  proposedLedgerSha256?: string;
  proposedLedgerBytes?: Buffer;
}
export interface WbsRegistrationPreflightInput {
  beforeBytes: Buffer;
  afterBytes: Buffer;
  /** Current integrity-protected ledger bytes, not taken from untrusted PR. */
  ledgerBytes: Buffer;
  /** Must be independently read from the protected canonical branch. */
  expectedCurrentWbsSha256: string;
  /** Must be independently read from the protected canonical branch. */
  expectedCurrentLedgerSha256: string;
  receipt: SignedReceiptV2;
  policy: TrustedPolicyV2;
  /** This context needs independent trust provenance. Never mint it in an untrusted PR. */
  trustedContext: TrustedVerificationContextV2;
}

const SHA256 = /^[0-9a-f]{64}$/;
const GIT_SHA = /^[0-9a-f]{40}$/;
function sha(raw: Buffer | string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
export function serializeWbsReceiptLedger(ledger: WbsReceiptLedgerV1): Buffer {
  return Buffer.from(JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}
/** Genesis is historical *only*, never an actual ledger write. */
export function makeHistoricalWbsReceiptLedger(): WbsReceiptLedgerV1 {
  return {
    schemaVersion: '1.0',
    projectId: 'PRJ-DOCMONSTAKRAKIN',
    genesisWbsSha256: HISTORICAL_WBS_SHA256,
    entries: [],
  };
}
function parseLedger(bytes: Buffer): WbsReceiptLedgerV1 {
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Receipt ledger exceeds supported preflight limit');
  const data: unknown = JSON.parse(bytes.toString('utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Receipt ledger is not a JSON object');
  }
  const ledger = data as WbsReceiptLedgerV1;
  if (ledger.schemaVersion !== '1.0' ||
      ledger.projectId !== 'PRJ-DOCMONSTAKRAKIN' ||
      ledger.genesisWbsSha256 !== HISTORICAL_WBS_SHA256 ||
      !Array.isArray(ledger.entries)) {
    throw new Error('Receipt ledger header or historical genesis digest is invalid');
  }
  if (ledger.entries.length > 5000) throw new Error('Receipt ledger entry count exceeds supported limit');
  const seen = new Set<string>();
  let cursor = HISTORICAL_WBS_SHA256;
  for (const entry of ledger.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        typeof entry.receiptId !== 'string' || !/^[A-Za-z0-9._:-]{12,128}$/.test(entry.receiptId) ||
        seen.has(entry.receiptId) || entry.preWbsSha256 !== cursor ||
        !SHA256.test(entry.postWbsSha256) || entry.postWbsSha256 === cursor ||
        !SHA256.test(entry.policySha256) ||
        !SHA256.test(entry.signedIntentSha256) ||
        !SHA256.test(entry.signedReceiptSha256) ||
        !GIT_SHA.test(entry.reviewedHeadCommitSha) ||
        !GIT_SHA.test(entry.reviewedHeadTreeSha) ||
        !Number.isSafeInteger(entry.pullRequestNumber) || entry.pullRequestNumber <= 0) {
      throw new Error('Receipt ledger chain contains invalid, duplicate or disconnected entry');
    }
    seen.add(entry.receiptId);
    cursor = entry.postWbsSha256;
  }
  // Exact serialization guards against duplicate JSON keys, noncanonical bytes
  // and parser ambiguity. A ledger is versioned, never "best effort" parsed.
  if (!serializeWbsReceiptLedger(ledger).equals(bytes)) {
    throw new Error('Receipt ledger must match exact canonical serialization');
  }
  return ledger;
}
export function previewWbsRegistrationTransaction(
  input: WbsRegistrationPreflightInput
): WbsRegistrationPreflightResult {
  const errors: string[] = [];
  const currentWbsSha256 = Buffer.isBuffer(input?.beforeBytes) ? sha(input.beforeBytes) : '';
  const currentLedgerSha256 = Buffer.isBuffer(input?.ledgerBytes) ? sha(input.ledgerBytes) : '';
  const fail = (message: string) => errors.push(message);
  const denied = (): WbsRegistrationPreflightResult => ({
    valid: false, mode: 'REJECTED', mayApply: false, errors,
    currentWbsSha256, currentLedgerSha256,
  });
  if (!input || !Buffer.isBuffer(input.beforeBytes) || !Buffer.isBuffer(input.afterBytes) ||
      !Buffer.isBuffer(input.ledgerBytes) || !input.receipt || !input.policy ||
      !input.trustedContext) {
    fail('Required WBS, ledger, receipt, policy or separately trusted context missing');
    return denied();
  }
  if (!SHA256.test(input.expectedCurrentWbsSha256 || '') ||
      currentWbsSha256 !== input.expectedCurrentWbsSha256) {
    fail('Current WBS differs from independently verified protected-branch snapshot');
  }
  if (!SHA256.test(input.expectedCurrentLedgerSha256 || '') ||
      currentLedgerSha256 !== input.expectedCurrentLedgerSha256) {
    fail('Receipt ledger differs from independently verified protected-branch snapshot');
  }
  let ledger: WbsReceiptLedgerV1;
  try { ledger = parseLedger(input.ledgerBytes); }
  catch (err) {
    fail('Receipt ledger invalid: ' + (err instanceof Error ? err.message : String(err)));
    return denied();
  }
  const lastSha = ledger.entries.length ?
    ledger.entries[ledger.entries.length - 1].postWbsSha256 : ledger.genesisWbsSha256;
  if (currentWbsSha256 !== lastSha) {
    fail('Current WBS does not match last independently chained receipt state');
  }
  const claimedConsumedIds = input.trustedContext.consumedReceiptIds;
  const recordedIds = ledger.entries.map(x => x.receiptId);
  if (!Array.isArray(claimedConsumedIds) ||
      claimedConsumedIds.length !== recordedIds.length ||
      new Set(claimedConsumedIds).size !== recordedIds.length ||
      recordedIds.some(id => !claimedConsumedIds.includes(id))) {
    fail('Trusted receipt-consumption snapshot conflicts with canonical ledger');
  }
  if (ledger.entries.some(x => x.receiptId === input.receipt.intent?.receiptId)) {
    fail('Registration receipt was already consumed');
  }
  let verdict: ReturnType<typeof verifyTrustedWbsRegistrationV2>;
  try {
    verdict = verifyTrustedWbsRegistrationV2({
      beforeBytes: input.beforeBytes,
      afterBytes: input.afterBytes,
      receipt: input.receipt,
      policy: input.policy,
      context: input.trustedContext,
    });
  } catch (err) {
    fail('V2 evidence verifier threw on malformed input: ' +
      (err instanceof Error ? err.message : String(err)));
    return denied();
  }
  if (!verdict.valid || verdict.mode !== 'EVIDENCE_VERIFIED' || verdict.mayApply !== false) {
    fail('V2 registration evidence rejected: ' + verdict.errors.join('; '));
  }
  if (errors.length) return denied();
  const intent = input.receipt.intent;
  const receiptBytes = Buffer.from(JSON.stringify(input.receipt), 'utf8');
  const nextEntry: WbsReceiptLedgerEntryV1 = {
    receiptId: intent.receiptId,
    preWbsSha256: currentWbsSha256,
    postWbsSha256: sha(input.afterBytes),
    policySha256: verdict.policySha256,
    signedIntentSha256: sha(registrationSigningPayloadV2(intent)),
    signedReceiptSha256: sha(receiptBytes),
    reviewedHeadCommitSha: intent.git.reviewedHeadCommitSha,
    reviewedHeadTreeSha: intent.git.reviewedHeadTreeSha,
    pullRequestNumber: intent.git.pullRequestNumber,
  };
  const proposedLedgerBytes = serializeWbsReceiptLedger({
    ...ledger, entries: [...ledger.entries, nextEntry],
  });
  if (proposedLedgerBytes.length > 2 * 1024 * 1024) {
    fail('Proposed receipt ledger exceeds supported size limit');
    return denied();
  }
  return {
    valid: true, mode: 'PREVIEW_VALID', mayApply: false, errors,
    currentWbsSha256, currentLedgerSha256,
    proposedWbsSha256: sha(input.afterBytes),
    proposedLedgerSha256: sha(proposedLedgerBytes),
    proposedLedgerBytes,
  };
}
