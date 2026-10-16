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
const RECEIPT_ID = /^[A-Za-z0-9._:-]{12,128}$/;
const CANONICAL_ED25519_B64 = /^[A-Za-z0-9+/]{86}==$/;

export const CANONICAL_SIGNED_RECEIPT_DOMAIN_V2 = 'DOCMONSTAKRAKIN/WBS_SIGNED_RECEIPT/2.0';

const LEDGER_TOP_LEVEL_KEYS = [
  'schemaVersion',
  'projectId',
  'genesisWbsSha256',
  'entries',
] as const;

const LEDGER_ENTRY_KEYS = [
  'receiptId',
  'preWbsSha256',
  'postWbsSha256',
  'policySha256',
  'signedIntentSha256',
  'signedReceiptSha256',
  'reviewedHeadCommitSha',
  'reviewedHeadTreeSha',
  'pullRequestNumber',
] as const;

const RECEIPT_V2_KEYS = ['intent', 'signatures'] as const;

const INTENT_V2_KEYS = [
  'approvedItems',
  'git',
  'notAfter',
  'notBefore',
  'operation',
  'policyId',
  'policySha256',
  'policyVersion',
  'postWbsSha256',
  'preWbsSha256',
  'projectId',
  'receiptId',
  'schemaVersion',
] as const;

const GIT_CONTEXT_V2_KEYS = [
  'baseCommitSha',
  'pullRequestNumber',
  'repository',
  'reviewedHeadCommitSha',
  'reviewedHeadTreeSha',
] as const;

const SIGNATURE_V2_KEYS = [
  'keyId',
  'kind',
  'principalId',
  'role',
  'signatureBase64',
] as const;

const DISALLOWED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor', 'toJSON']);

function sha(raw: Buffer | string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasExactKeys(obj: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  if (Object.getOwnPropertySymbols(obj).length !== 0) return false;
  const keys = Object.keys(obj);
  if (keys.length !== allowedKeys.length) return false;
  const allowedSet = new Set(allowedKeys);
  for (const key of keys) {
    if (DISALLOWED_OBJECT_KEYS.has(key) || !allowedSet.has(key)) return false;
  }
  return true;
}

function hasExactOrderedKeys(obj: Record<string, unknown>, orderedKeys: readonly string[]): boolean {
  if (Object.getOwnPropertySymbols(obj).length !== 0) return false;
  const keys = Object.keys(obj);
  if (keys.length !== orderedKeys.length) return false;
  for (let i = 0; i < orderedKeys.length; i++) {
    if (keys[i] !== orderedKeys[i]) return false;
  }
  return true;
}

function normalizeJsonValue(value: unknown, activeAncestors: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Nonfinite number in signed receipt');
    return value;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype ||
        Object.getOwnPropertySymbols(value).length !== 0 ||
        Object.keys(value).length !== value.length) {
      throw new Error('Malformed array in signed receipt');
    }
    if (activeAncestors.has(value)) throw new Error('Cyclic structure in signed receipt');
    activeAncestors.add(value);
    const normalized = value.map(item => normalizeJsonValue(item, activeAncestors));
    activeAncestors.delete(value);
    return normalized;
  }
  if (isPlainObject(value)) {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new Error('Symbol property in signed receipt');
    }
    if (activeAncestors.has(value)) throw new Error('Cyclic structure in signed receipt');
    activeAncestors.add(value);
    const sortedKeys = Object.keys(value).sort(compareStrings);
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      if (DISALLOWED_OBJECT_KEYS.has(key)) {
        throw new Error('Unsafe object key in signed receipt');
      }
      out[key] = normalizeJsonValue(value[key], activeAncestors);
    }
    activeAncestors.delete(value);
    return out;
  }
  throw new Error('Non-JSON runtime value in signed receipt');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Nonfinite number in canonical JSON');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort(compareStrings);
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  throw new Error('Non-JSON value in canonical JSON');
}

export function validateAndNormalizeSignedReceiptV2(receipt: unknown): SignedReceiptV2 {
  const activeAncestors = new Set<object>();
  if (!isPlainObject(receipt) || !hasExactKeys(receipt, RECEIPT_V2_KEYS)) {
    throw new Error('Signed receipt must be a plain object with exact keys [intent, signatures]');
  }
  activeAncestors.add(receipt);

  const rawIntent = receipt.intent;
  if (!isPlainObject(rawIntent) || !hasExactKeys(rawIntent, INTENT_V2_KEYS)) {
    throw new Error('Signed receipt intent contains missing or unexpected properties');
  }
  if (activeAncestors.has(rawIntent)) throw new Error('Cyclic structure in signed receipt intent');
  activeAncestors.add(rawIntent);

  const rawGit = rawIntent.git;
  if (!isPlainObject(rawGit) || !hasExactKeys(rawGit, GIT_CONTEXT_V2_KEYS)) {
    throw new Error('Signed receipt git context contains missing or unexpected properties');
  }
  if (activeAncestors.has(rawGit)) throw new Error('Cyclic structure in signed receipt git context');

  if (rawIntent.schemaVersion !== '2.0' ||
      rawIntent.projectId !== 'PRJ-DOCMONSTAKRAKIN' ||
      rawIntent.operation !== 'ADD_WBS_ITEMS' ||
      typeof rawIntent.receiptId !== 'string' || !RECEIPT_ID.test(rawIntent.receiptId) ||
      typeof rawIntent.preWbsSha256 !== 'string' || !SHA256.test(rawIntent.preWbsSha256) ||
      typeof rawIntent.postWbsSha256 !== 'string' || !SHA256.test(rawIntent.postWbsSha256) ||
      typeof rawIntent.policyId !== 'string' || !rawIntent.policyId ||
      typeof rawIntent.policyVersion !== 'string' || !rawIntent.policyVersion ||
      typeof rawIntent.policySha256 !== 'string' || !SHA256.test(rawIntent.policySha256) ||
      typeof rawIntent.notBefore !== 'string' || !rawIntent.notBefore ||
      typeof rawIntent.notAfter !== 'string' || !rawIntent.notAfter) {
    throw new Error('Signed receipt intent has invalid field values');
  }

  if (typeof rawGit.repository !== 'string' ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(rawGit.repository) ||
      typeof rawGit.pullRequestNumber !== 'number' ||
      !Number.isSafeInteger(rawGit.pullRequestNumber) || rawGit.pullRequestNumber <= 0 ||
      typeof rawGit.baseCommitSha !== 'string' || !GIT_SHA.test(rawGit.baseCommitSha) ||
      typeof rawGit.reviewedHeadCommitSha !== 'string' || !GIT_SHA.test(rawGit.reviewedHeadCommitSha) ||
      typeof rawGit.reviewedHeadTreeSha !== 'string' || !GIT_SHA.test(rawGit.reviewedHeadTreeSha)) {
    throw new Error('Signed receipt git context has invalid field values');
  }

  const rawItems = rawIntent.approvedItems;
  if (!Array.isArray(rawItems) || rawItems.length === 0 ||
      Object.getPrototypeOf(rawItems) !== Array.prototype ||
      Object.getOwnPropertySymbols(rawItems).length !== 0 ||
      Object.keys(rawItems).length !== rawItems.length) {
    throw new Error('Signed receipt approvedItems must be a non-empty array');
  }
  if (activeAncestors.has(rawItems)) throw new Error('Cyclic structure in approvedItems');
  activeAncestors.add(rawItems);
  const normalizedItems: Record<string, unknown>[] = rawItems.map(item => {
    if (!isPlainObject(item)) {
      throw new Error('Each approved WBS item must be a plain JSON object');
    }
    return normalizeJsonValue(item, activeAncestors) as Record<string, unknown>;
  });
  activeAncestors.delete(rawItems);

  const rawSignatures = receipt.signatures;
  if (!Array.isArray(rawSignatures) || rawSignatures.length === 0 ||
      Object.getPrototypeOf(rawSignatures) !== Array.prototype ||
      Object.getOwnPropertySymbols(rawSignatures).length !== 0 ||
      Object.keys(rawSignatures).length !== rawSignatures.length) {
    throw new Error('Signed receipt signatures must be a non-empty array');
  }
  if (activeAncestors.has(rawSignatures)) throw new Error('Cyclic structure in signatures');
  activeAncestors.add(rawSignatures);

  const normalizedSignatures = rawSignatures.map(sig => {
    if (!isPlainObject(sig) || !hasExactKeys(sig, SIGNATURE_V2_KEYS)) {
      throw new Error('Signature entry contains missing or unexpected properties');
    }
    if (sig.kind !== 'HUMAN' ||
        typeof sig.principalId !== 'string' || !sig.principalId ||
        typeof sig.role !== 'string' || !sig.role ||
        typeof sig.keyId !== 'string' || !sig.keyId ||
        typeof sig.signatureBase64 !== 'string' ||
        !CANONICAL_ED25519_B64.test(sig.signatureBase64)) {
      throw new Error('Signature entry has invalid or non-canonical field values');
    }
    const decoded = Buffer.from(sig.signatureBase64, 'base64');
    if (decoded.length !== 64 || decoded.toString('base64') !== sig.signatureBase64) {
      throw new Error('Signature base64 is not canonical 64-byte encoding');
    }
    return {
      keyId: sig.keyId,
      kind: 'HUMAN' as const,
      principalId: sig.principalId,
      role: sig.role,
      signatureBase64: sig.signatureBase64,
    };
  });
  activeAncestors.delete(rawSignatures);
  activeAncestors.delete(rawIntent);
  activeAncestors.delete(receipt);

  normalizedSignatures.sort((a, b) =>
    compareStrings(a.role, b.role) ||
    compareStrings(a.principalId, b.principalId) ||
    compareStrings(a.keyId, b.keyId) ||
    compareStrings(a.signatureBase64, b.signatureBase64)
  );

  return {
    intent: {
      approvedItems: normalizedItems,
      git: {
        baseCommitSha: rawGit.baseCommitSha,
        pullRequestNumber: rawGit.pullRequestNumber,
        repository: rawGit.repository,
        reviewedHeadCommitSha: rawGit.reviewedHeadCommitSha,
        reviewedHeadTreeSha: rawGit.reviewedHeadTreeSha,
      },
      notAfter: rawIntent.notAfter,
      notBefore: rawIntent.notBefore,
      operation: 'ADD_WBS_ITEMS',
      policyId: rawIntent.policyId,
      policySha256: rawIntent.policySha256,
      policyVersion: rawIntent.policyVersion,
      postWbsSha256: rawIntent.postWbsSha256,
      preWbsSha256: rawIntent.preWbsSha256,
      projectId: 'PRJ-DOCMONSTAKRAKIN',
      receiptId: rawIntent.receiptId,
      schemaVersion: '2.0',
    },
    signatures: normalizedSignatures,
  };
}

/**
 * Versioned deterministic serialization contract for SignedReceiptV2:
 * Domain header `DOCMONSTAKRAKIN/WBS_SIGNED_RECEIPT/2.0\n` followed by
 * canonical JSON of the schema-validated, signature-sorted receipt.
 */
export function canonicalSignedReceiptPayloadV2(receipt: SignedReceiptV2): Buffer {
  const normalized = validateAndNormalizeSignedReceiptV2(receipt);
  return Buffer.from(
    CANONICAL_SIGNED_RECEIPT_DOMAIN_V2 + '\n' + canonicalJson(normalized),
    'utf8'
  );
}

export function signedReceiptDigestV2(receipt: SignedReceiptV2): string {
  return sha(canonicalSignedReceiptPayloadV2(receipt));
}

export function serializeWbsReceiptLedger(ledger: WbsReceiptLedgerV1): Buffer {
  const canonicalLedger: WbsReceiptLedgerV1 = {
    schemaVersion: ledger.schemaVersion,
    projectId: ledger.projectId,
    genesisWbsSha256: ledger.genesisWbsSha256,
    entries: ledger.entries.map(entry => ({
      receiptId: entry.receiptId,
      preWbsSha256: entry.preWbsSha256,
      postWbsSha256: entry.postWbsSha256,
      policySha256: entry.policySha256,
      signedIntentSha256: entry.signedIntentSha256,
      signedReceiptSha256: entry.signedReceiptSha256,
      reviewedHeadCommitSha: entry.reviewedHeadCommitSha,
      reviewedHeadTreeSha: entry.reviewedHeadTreeSha,
      pullRequestNumber: entry.pullRequestNumber,
    })),
  };
  return Buffer.from(JSON.stringify(canonicalLedger, null, 2) + '\n', 'utf8');
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
  if (!isPlainObject(data)) {
    throw new Error('Receipt ledger is not a JSON object');
  }
  if (!hasExactKeys(data, LEDGER_TOP_LEVEL_KEYS)) {
    throw new Error('Receipt ledger header contains unexpected or missing properties');
  }
  if (!hasExactOrderedKeys(data, LEDGER_TOP_LEVEL_KEYS)) {
    throw new Error('Receipt ledger header fields are not in canonical order');
  }
  if (data.schemaVersion !== '1.0' ||
      data.projectId !== 'PRJ-DOCMONSTAKRAKIN' ||
      data.genesisWbsSha256 !== HISTORICAL_WBS_SHA256 ||
      !Array.isArray(data.entries)) {
    throw new Error('Receipt ledger header or historical genesis digest is invalid');
  }
  if (data.entries.length > 5000) throw new Error('Receipt ledger entry count exceeds supported limit');
  const seen = new Set<string>();
  let cursor = HISTORICAL_WBS_SHA256;
  const normalizedEntries: WbsReceiptLedgerEntryV1[] = [];
  for (const entry of data.entries) {
    if (!isPlainObject(entry)) {
      throw new Error('Receipt ledger entry is not a JSON object');
    }
    if (!hasExactKeys(entry, LEDGER_ENTRY_KEYS)) {
      throw new Error('Receipt ledger entry contains unexpected or missing properties');
    }
    if (!hasExactOrderedKeys(entry, LEDGER_ENTRY_KEYS)) {
      throw new Error('Receipt ledger entry fields are not in canonical order');
    }
    if (typeof entry.receiptId !== 'string' || !RECEIPT_ID.test(entry.receiptId) ||
        seen.has(entry.receiptId) || entry.preWbsSha256 !== cursor ||
        typeof entry.postWbsSha256 !== 'string' || !SHA256.test(entry.postWbsSha256) ||
        entry.postWbsSha256 === cursor ||
        typeof entry.policySha256 !== 'string' || !SHA256.test(entry.policySha256) ||
        typeof entry.signedIntentSha256 !== 'string' || !SHA256.test(entry.signedIntentSha256) ||
        typeof entry.signedReceiptSha256 !== 'string' || !SHA256.test(entry.signedReceiptSha256) ||
        typeof entry.reviewedHeadCommitSha !== 'string' || !GIT_SHA.test(entry.reviewedHeadCommitSha) ||
        typeof entry.reviewedHeadTreeSha !== 'string' || !GIT_SHA.test(entry.reviewedHeadTreeSha) ||
        typeof entry.pullRequestNumber !== 'number' ||
        !Number.isSafeInteger(entry.pullRequestNumber) || entry.pullRequestNumber <= 0) {
      throw new Error('Receipt ledger chain contains invalid, duplicate or disconnected entry');
    }
    seen.add(entry.receiptId);
    cursor = entry.postWbsSha256;
    normalizedEntries.push({
      receiptId: entry.receiptId,
      preWbsSha256: entry.preWbsSha256,
      postWbsSha256: entry.postWbsSha256,
      policySha256: entry.policySha256,
      signedIntentSha256: entry.signedIntentSha256,
      signedReceiptSha256: entry.signedReceiptSha256,
      reviewedHeadCommitSha: entry.reviewedHeadCommitSha,
      reviewedHeadTreeSha: entry.reviewedHeadTreeSha,
      pullRequestNumber: entry.pullRequestNumber,
    });
  }
  const normalizedLedger: WbsReceiptLedgerV1 = {
    schemaVersion: '1.0',
    projectId: 'PRJ-DOCMONSTAKRAKIN',
    genesisWbsSha256: HISTORICAL_WBS_SHA256,
    entries: normalizedEntries,
  };
  // Exact serialization guards against duplicate JSON keys, noncanonical bytes
  // and parser ambiguity. A ledger is versioned, never "best effort" parsed.
  if (!serializeWbsReceiptLedger(normalizedLedger).equals(bytes)) {
    throw new Error('Receipt ledger must match exact canonical serialization');
  }
  return normalizedLedger;
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
  try {
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
    if (!isPlainObject(input.trustedContext.expectedGit) ||
        !hasExactKeys(input.trustedContext.expectedGit, GIT_CONTEXT_V2_KEYS)) {
      fail('Trusted expectedGit context is missing or contains unexpected properties');
    }
    let normalizedReceipt: SignedReceiptV2;
    let receiptDigest: string;
    try {
      normalizedReceipt = validateAndNormalizeSignedReceiptV2(input.receipt);
      receiptDigest = signedReceiptDigestV2(normalizedReceipt);
    } catch (err) {
      fail('Signed receipt schema or canonical serialization invalid: ' +
        (err instanceof Error ? err.message : String(err)));
      return denied();
    }
    if (ledger.entries.some(x => x.receiptId === normalizedReceipt.intent.receiptId)) {
      fail('Registration receipt was already consumed');
    }
    let verdict: ReturnType<typeof verifyTrustedWbsRegistrationV2>;
    try {
      verdict = verifyTrustedWbsRegistrationV2({
        beforeBytes: input.beforeBytes,
        afterBytes: input.afterBytes,
        receipt: normalizedReceipt,
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
    const intent = normalizedReceipt.intent;
    const nextEntry: WbsReceiptLedgerEntryV1 = {
      receiptId: intent.receiptId,
      preWbsSha256: currentWbsSha256,
      postWbsSha256: sha(input.afterBytes),
      policySha256: verdict.policySha256,
      signedIntentSha256: sha(registrationSigningPayloadV2(intent)),
      signedReceiptSha256: receiptDigest,
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
  } catch (err) {
    fail('Unhandled preflight validation error: ' + (err instanceof Error ? err.message : String(err)));
    return denied();
  }
}
