/** Read-only historical/current boundary. No apply engine or production trust adapter. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCanonicalWbsBytes, isCanonicalRuntimeScoped } from '../server/workTracking/canonicalWbs.ts';
import { HISTORICAL_WBS_SHA256 } from './verifyForwardWbsEvidence.ts';
import {
  parseWbsReceiptLedgerV1, serializeWbsReceiptLedger, signedReceiptDigestV2,
  validateAndNormalizeSignedReceiptV2,
} from './planWbsRegistrationTransaction.ts';
import {
  registrationSigningPayloadV2, verifyTrustedWbsRegistrationV2,
  type SignedReceiptV2, type TrustedPolicyV2, type ReviewedGitContextV2,
} from './verifyTrustedWbsRegistrationV2.ts';

export interface ForwardWbsEvidence {
  ledgerBytes: Buffer;
  links: {
    beforeBytes: Buffer; afterBytes: Buffer; receipt: SignedReceiptV2;
    rawReceiptBytes: Buffer; policy: TrustedPolicyV2;
  }[];
}
/**
 * Independently authenticated acquisition contract, NEVER PR JSON or receipt claims.
 * The host must authenticate protected Git objects/ancestry and their exact WBS,
 * ledger and retained receipt bytes, application provenance, ratified policy epochs,
 * current revocation adjudication, freshness floors and clock before supplying this.
 * A signed approval/preview is insufficient evidence to populate applications.
 */
export interface WbsContinuityAuthority {
  nowIso: string; validUntilIso: string;
  authorityEpoch: number; minimumAuthorityEpoch: number;
  revocationSequence: number; minimumRevocationSequence: number;
  protected: { wbsSha256: string; ledgerSha256: string; masterCommitSha: string; masterTreeSha: string };
  applications: {
    receiptId: string; preWbsSha256: string; postWbsSha256: string;
    ledgerBeforeSha256: string; ledgerAfterSha256: string; rawReceiptSha256: string;
    policySha256: string; policyEpoch: number; revocationSequence: number;
    appliedAt: string; appliedCommitSha: string; appliedTreeSha: string;
    expectedGit: ReviewedGitContextV2;
  }[];
}
export interface WbsContinuityResult {
  valid: boolean; historicalValid: boolean; currentForwardChainValid: boolean;
  mode: 'HISTORICAL' | 'FORWARD_EVIDENCE_VERIFIED' | 'REJECTED';
  mayApply: false; errors: string[];
  historicalScopeCount?: number; currentScopeCount?: number;
  historicalWbsSha256?: string; currentWbsSha256?: string; ledgerSha256?: string;
}
export type TrustedForwardEvidenceProvider = () => { forward: ForwardWbsEvidence; context: WbsContinuityAuthority };
const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const SHA = /^[0-9a-f]{64}$/;
const GIT = /^[0-9a-f]{40}$/;
const positive = (n: number) => Number.isSafeInteger(n) && n > 0;
function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function instant(value: string): number {
  requireThat(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value), 'Invalid precise UTC time');
  const n = Date.parse(value);
  requireThat(Number.isFinite(n) && new Date(n).toISOString() === value, 'Invalid UTC instant');
  return n;
}
function scope(bytes: Buffer) { return parseCanonicalWbsBytes(bytes).items.filter(i => isCanonicalRuntimeScoped(i)).length; }

/** No mode parameter; historical success never substitutes for current-state proof. */
export function verifyWbsEvidenceContinuity(
  input: { historicalBytes: Buffer; currentBytes: Buffer; forward?: ForwardWbsEvidence },
  acquireAuthority?: () => WbsContinuityAuthority,
): WbsContinuityResult {
  const r: WbsContinuityResult = { valid: false, historicalValid: false, currentForwardChainValid: false, mode: 'REJECTED', mayApply: false, errors: [] };
  try {
    requireThat(input && Buffer.isBuffer(input.historicalBytes) && Buffer.isBuffer(input.currentBytes), 'Required historical/current raw bytes missing');
    r.historicalWbsSha256 = sha(input.historicalBytes); r.currentWbsSha256 = sha(input.currentBytes);
    requireThat(sha(input.historicalBytes) === HISTORICAL_WBS_SHA256, 'Pinned historical snapshot digest mismatch');
    r.historicalScopeCount = scope(input.historicalBytes);
    requireThat(r.historicalScopeCount === 27, 'Historical DMK-208 scope must remain 27');
    r.historicalValid = true;
    r.currentScopeCount = scope(input.currentBytes);
    if (input.currentBytes.equals(input.historicalBytes)) {
      // Extraneous forward evidence is not silently accepted on a reverted baseline.
      requireThat(input.forward === undefined, 'Forward evidence supplied for unchanged historical state');
      r.valid = r.currentForwardChainValid = true; r.mode = 'HISTORICAL'; return r;
    }
    const forward = input.forward;
    requireThat(forward && Buffer.isBuffer(forward.ledgerBytes) && Array.isArray(forward.links), 'Current WBS changed: complete applied forward evidence required');
    r.ledgerSha256 = sha(forward.ledgerBytes);
    requireThat(typeof acquireAuthority === 'function', 'Independent authenticated application authority required');
    const context = acquireAuthority();
    requireThat(context && context.protected && Array.isArray(context.applications), 'Application authority missing');
    const now = instant(context.nowIso), until = instant(context.validUntilIso);
    requireThat(until > now && until - now <= 60_000, 'Authority freshness interval invalid or expired (maximum 60 seconds)');
    requireThat(positive(context.authorityEpoch) && positive(context.minimumAuthorityEpoch) && context.authorityEpoch >= context.minimumAuthorityEpoch, 'Stale authority epoch');
    requireThat(positive(context.revocationSequence) && positive(context.minimumRevocationSequence) && context.revocationSequence >= context.minimumRevocationSequence, 'Stale revocation checkpoint');
    const protectedState = context.protected;
    requireThat(SHA.test(protectedState.wbsSha256) && SHA.test(protectedState.ledgerSha256) && GIT.test(protectedState.masterCommitSha) && GIT.test(protectedState.masterTreeSha), 'Malformed protected Git/state identities');
    requireThat(protectedState.wbsSha256 === sha(input.currentBytes) && protectedState.ledgerSha256 === sha(forward.ledgerBytes), 'Terminal WBS/ledger differs from protected state');
    const ledger = parseWbsReceiptLedgerV1(forward.ledgerBytes);
    requireThat(ledger.entries.length > 0 && ledger.entries.length === forward.links.length && ledger.entries.length === context.applications.length, 'Incomplete applied successor chain');
    let before = input.historicalBytes, lastTime = -Infinity, lastEpoch = 0, lastRevocation = 0;
    const policyByEpoch = new Map<number, { digest: string; version: string }>();
    const seenPolicies = new Set<string>(), seenVersions = new Set<string>(), seenCommits = new Set<string>();
    for (let i = 0; i < ledger.entries.length; i++) {
      const entry = ledger.entries[i], link = forward.links[i], applied = context.applications[i];
      requireThat(link && applied && Buffer.isBuffer(link.beforeBytes) && Buffer.isBuffer(link.afterBytes) && Buffer.isBuffer(link.rawReceiptBytes), 'Missing successor bytes/application');
      requireThat(link.beforeBytes.equals(before) && sha(link.afterBytes) === entry.postWbsSha256 && sha(before) === entry.preWbsSha256, 'Disconnected or altered exact WBS bytes');
      scope(link.afterBytes); // Validate lifecycle and unique ID/path invariants at every step.
      const receipt = validateAndNormalizeSignedReceiptV2(link.receipt);
      requireThat(link.rawReceiptBytes.length <= 2 * 1024 * 1024, 'Retained receipt exceeds supported limit');
      const rawText = link.rawReceiptBytes.toString('utf8');
      requireThat(Buffer.from(rawText).equals(link.rawReceiptBytes), 'Retained receipt is not UTF-8');
      const parsedRaw = JSON.parse(rawText);
      const rawDocument = YAML.parseDocument(rawText, { uniqueKeys: true });
      requireThat(rawDocument.errors.length === 0, 'Duplicate/invalid retained receipt JSON keys');
      requireThat(signedReceiptDigestV2(parsedRaw) === signedReceiptDigestV2(receipt), 'Retained receipt differs from parsed signed evidence');
      const intent = receipt.intent;
      requireThat(entry.receiptId === intent.receiptId && entry.policySha256 === intent.policySha256 && entry.signedIntentSha256 === sha(registrationSigningPayloadV2(intent)) && entry.signedReceiptSha256 === signedReceiptDigestV2(receipt), 'Receipt/intent differs from consumed ledger entry');
      requireThat(entry.reviewedHeadCommitSha === intent.git.reviewedHeadCommitSha && entry.reviewedHeadTreeSha === intent.git.reviewedHeadTreeSha && entry.pullRequestNumber === intent.git.pullRequestNumber, 'Consumed ledger Git identities mismatch');
      requireThat(intent.git.repository === 'Jeruzael/docmonstakrakin', 'Wrong repository');
      const prefixDigest = (count: number) => sha(serializeWbsReceiptLedger({ ...ledger, entries: ledger.entries.slice(0, count) }));
      requireThat(applied.receiptId === entry.receiptId && applied.preWbsSha256 === entry.preWbsSha256 && applied.postWbsSha256 === entry.postWbsSha256 && applied.policySha256 === entry.policySha256 && applied.rawReceiptSha256 === sha(link.rawReceiptBytes), 'Authenticated application does not bind exact receipt/state/policy');
      requireThat(applied.ledgerBeforeSha256 === prefixDigest(i) && applied.ledgerAfterSha256 === prefixDigest(i + 1), 'Authenticated consumed-ledger prefix mismatch');
      requireThat(GIT.test(applied.appliedCommitSha) && GIT.test(applied.appliedTreeSha) && !seenCommits.has(applied.appliedCommitSha), 'Missing or replayed applied Git identity');
      seenCommits.add(applied.appliedCommitSha);
      const appliedTime = instant(applied.appliedAt);
      requireThat(appliedTime >= lastTime && appliedTime <= now, 'Reordered or future application time');
      lastTime = appliedTime;
      requireThat(positive(applied.policyEpoch) && applied.policyEpoch >= lastEpoch && applied.policyEpoch <= context.authorityEpoch, 'Invalid or reordered policy epoch');
      requireThat(positive(applied.revocationSequence) && applied.revocationSequence >= lastRevocation && applied.revocationSequence === context.revocationSequence, 'Missing/stale current revocation adjudication of application');
      const epochPolicy = policyByEpoch.get(applied.policyEpoch);
      if (epochPolicy) {
        requireThat(epochPolicy.digest === applied.policySha256 && epochPolicy.version === link.policy.policyVersion, 'Policy changed within an epoch');
      } else {
        requireThat(!seenPolicies.has(applied.policySha256) && !seenVersions.has(link.policy.policyVersion), 'Advanced epoch reuses old signed policy/version');
        policyByEpoch.set(applied.policyEpoch, { digest: applied.policySha256, version: link.policy.policyVersion });
        seenPolicies.add(applied.policySha256); seenVersions.add(link.policy.policyVersion);
      }
      lastEpoch = applied.policyEpoch; lastRevocation = applied.revocationSequence;
      requireThat(Array.isArray(link.policy.requiredRoles) && link.policy.requiredRoles.length === 2 && ['Security Officer', 'Lead Architect'].every(role => link.policy.requiredRoles.includes(role)), 'Existing two-human quorum must be preserved');
      // Historical audit verifies each issuance against its authenticated PRE-consumption
      // prefix and application-time trust/revocation adjudication, not the full ledger.
      // New issuance preflight continues to reject every already consumed receipt ID.
      const verified = verifyTrustedWbsRegistrationV2({ beforeBytes: link.beforeBytes, afterBytes: link.afterBytes, receipt, policy: link.policy,
        context: { pinnedPolicySha256: applied.policySha256, expectedGit: applied.expectedGit, nowIso: applied.appliedAt, consumedReceiptIds: ledger.entries.slice(0, i).map(e => e.receiptId) } });
      requireThat(verified.valid, 'Invalid applied successor: ' + verified.errors.join('; '));
      before = link.afterBytes;
    }
    const last = context.applications.at(-1)!;
    requireThat(before.equals(input.currentBytes) && last.appliedCommitSha === protectedState.masterCommitSha && last.appliedTreeSha === protectedState.masterTreeSha, 'Terminal applied Git/WBS identity mismatch');
    r.valid = r.currentForwardChainValid = true; r.mode = 'FORWARD_EVIDENCE_VERIFIED';
  } catch (error) { r.errors.push(error instanceof Error ? error.message : String(error)); }
  return r;
}

// Original receipt states, resolved only by immutable Git object AND raw digest.
// These are historical views; selecting one cannot alter the current-state gate.
const EARLIER_DMK208_VIEWS = {
  PRE_APPLY: ['c662202de6551eb90871212f16ae8b7c1b58f4d7', 'ccb743020873462180bc6f05f7241e1096c3e4ce8e331e8dca8229a31da2b425'],
  POST_APPLY_APPROVED: ['4207e1a14dc9d073f2fad3a37b832f225417c967', 'd1b7787116b6483ef5e61d74beed9a8e1e7165f826f36eee192beac565aeb72c'],
  POST_CLOSURE_APPROVED: ['bfb5dd386eda0ac6d48adf4bfcfdec8042f9868f', 'dfedba8e16bf7e41ae3a4df9d9ba81920821a6e850a053cb1386f369a51c8fbe'],
} as const;
export function resolveEarlierDmk208View(mode: keyof typeof EARLIER_DMK208_VIEWS): Buffer {
  const pin = EARLIER_DMK208_VIEWS[mode];
  requireThat(pin, 'Unsupported historical DMK-208 view');
  const result = spawnSync('git', ['show', pin[0] + ':docs/00_control/MASTER_WBS.yaml'], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), encoding: 'buffer', windowsHide: true, timeout: 10_000, maxBuffer: 8 * 1024 * 1024,
  });
  requireThat(result.status === 0 && Buffer.isBuffer(result.stdout), 'Pinned earlier historical Git bytes unavailable');
  requireThat(sha(result.stdout) === pin[1], 'Earlier historical Git snapshot digest mismatch');
  requireThat(scope(result.stdout) === 27, 'Earlier historical DMK-208 scope mismatch');
  return result.stdout;
}

/** Filesystem adapters cannot accept a caller-selected historical-only mode. */
export function verifyWorkspaceWbsContinuity(root: string, acquireForward?: TrustedForwardEvidenceProvider): { historicalBytes?: Buffer; continuity: WbsContinuityResult } {
  let historicalBytes: Buffer | undefined;
  let currentBytes: Buffer | undefined;
  try {
    historicalBytes = fs.readFileSync(path.join(root, 'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml'));
    currentBytes = fs.readFileSync(path.join(root, 'docs/00_control/MASTER_WBS.yaml'));
    const acquired = acquireForward?.();
    return { historicalBytes, continuity: verifyWbsEvidenceContinuity({ historicalBytes, currentBytes, forward: acquired?.forward }, acquired ? () => acquired.context : undefined) };
  } catch (error) {
    // An offline forward authority must not erase independently valid history,
    // nor allow fallback to success when it was explicitly required.
    const historical = historicalBytes && verifyWbsEvidenceContinuity({ historicalBytes, currentBytes: historicalBytes });
    return { historicalBytes, continuity: { valid: false, historicalValid: historical?.historicalValid ?? false, currentForwardChainValid: false, mode: 'REJECTED', mayApply: false,
      historicalScopeCount: historical?.historicalScopeCount, historicalWbsSha256: historical?.historicalWbsSha256,
      currentWbsSha256: currentBytes && sha(currentBytes), errors: ['WBS evidence acquisition failed: ' + String(error)] } };
  }
}

export function combineWbsVerification<T extends { valid: boolean; errors: string[] }>(historical: T, continuity: WbsContinuityResult) {
  return { ...historical, valid: historical.valid && continuity.valid,
    errors: [...historical.errors, ...continuity.errors.map(e => 'Current/historical WBS boundary: ' + e)],
    historicalValid: historical.valid && continuity.historicalValid,
    currentForwardChainValid: continuity.currentForwardChainValid, mayApply: false as const, continuity };
}
