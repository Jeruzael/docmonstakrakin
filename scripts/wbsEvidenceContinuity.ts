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
  parseWbsReceiptLedgerWithPrefixes, signedReceiptDigestV2,
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

/** Candidate admission budgets, requiring explicit human compatibility acceptance. */
export const WBS_PROOF_LIMITS = Object.freeze({ links: 256, snapshotBytes: 2 * 1024 * 1024, aggregateBytes: 64 * 1024 * 1024, jsonDepth: 64 });
const RETAINED_BYTES = 2 * 1024 * 1024; // Existing receipt/ledger limits, unchanged.

// Scan raw UTF-8 JSON before parsing. Escaped braces/quotes do not add depth;
// JSON.parse and the existing duplicate-key/schema checks still decide validity.
function admitRawJson(bytes: Buffer) {
  let depth = 0, quoted = false, escaped = false;
  for (const c of bytes) {
    if (quoted) { if (escaped) escaped = false; else if (c === 92) escaped = true; else if (c === 34) quoted = false; }
    else if (c === 34) quoted = true;
    else if (c === 123 || c === 91) requireThat(++depth <= WBS_PROOF_LIMITS.jsonDepth, 'JSON depth exceeds candidate limit');
    else if (c === 125 || c === 93) requireThat(--depth >= 0, 'Malformed JSON nesting');
  }
  requireThat(!quoted && depth === 0, 'Incomplete JSON framing');
}

/** Admission only, never evidence validation or authority. Repeated aliases count. */
export function admitWbsContinuityProof(
  input: { historicalBytes: Buffer; currentBytes: Buffer; forward?: ForwardWbsEvidence },
  context?: WbsContinuityAuthority,
): { logicalBytes: number } {
  let logicalBytes = 0;
  const add = (n: number) => {
    logicalBytes += n;
    requireThat(logicalBytes <= WBS_PROOF_LIMITS.aggregateBytes, 'Aggregate proof exceeds candidate limit');
  };
  const bytes = (b: Buffer, max: number, label: string) => {
    requireThat(Buffer.isBuffer(b), 'Missing ' + label + ' bytes');
    requireThat(b.length <= max, label + ' exceeds supported candidate limit'); add(b.length);
  };
  // Exact JSON byte count without building a potentially huge escaped string.
  const string = (s: string) => {
    add(2);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 34 || c === 92 || c === 8 || c === 9 || c === 10 || c === 12 || c === 13) add(2);
      else if (c < 32) add(6);
      else if (c >= 0xd800 && c <= 0xdbff && i+1 < s.length && s.charCodeAt(i+1) >= 0xdc00 && s.charCodeAt(i+1) <= 0xdfff) { add(4); i++; }
      else if (c >= 0xd800 && c <= 0xdfff) add(6);
      else add(c < 128 ? 1 : c < 2048 ? 2 : 3);
    }
  };
  const active = new Set<object>();
  const json = (value: unknown, depth = 0): void => {
    if (value === null) { add(4); return; }
    if (typeof value === 'string') { string(value); return; }
    if (typeof value === 'boolean') { add(value ? 4 : 5); return; }
    if (typeof value === 'number' && Number.isFinite(value)) { add(JSON.stringify(value).length); return; }
    requireThat(typeof value === 'object' && value !== null, 'Non-JSON proof property');
    requireThat(depth < WBS_PROOF_LIMITS.jsonDepth, 'JSON depth exceeds candidate limit');
    requireThat(!active.has(value), 'Cyclic proof property');
    const array = Array.isArray(value);
    requireThat(array || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'Non-plain proof property');
    requireThat(Object.getOwnPropertySymbols(value).length === 0, 'Symbol proof property');
    active.add(value); add(2);
    let count = 0;
    for (const key of Object.getOwnPropertyNames(value)) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      requireThat('value' in descriptor && descriptor.enumerable, 'Executable or hidden proof property');
      if (count) add(1);
      if (array) requireThat(key === String(count), 'Non-JSON/sparse array property');
      else { string(key); add(1); }
      json(descriptor.value, depth+1); count++;
    }
    if (array) requireThat(count === value.length, 'Sparse proof array');
    active.delete(value);
  };
  bytes(input.historicalBytes, WBS_PROOF_LIMITS.snapshotBytes, 'Historical WBS snapshot');
  bytes(input.currentBytes, WBS_PROOF_LIMITS.snapshotBytes, 'Current WBS snapshot');
  if (input.forward !== undefined) {
    const f = input.forward;
    requireThat(f && Array.isArray(f.links), 'Missing successor links');
    requireThat(f.links.length <= WBS_PROOF_LIMITS.links, 'Successor link count exceeds candidate limit');
    bytes(f.ledgerBytes, RETAINED_BYTES, 'Receipt ledger'); admitRawJson(f.ledgerBytes);
    for (const link of f.links) {
      requireThat(link, 'Missing successor');
      bytes(link.beforeBytes, WBS_PROOF_LIMITS.snapshotBytes, 'Before WBS snapshot');
      bytes(link.afterBytes, WBS_PROOF_LIMITS.snapshotBytes, 'After WBS snapshot');
      bytes(link.rawReceiptBytes, RETAINED_BYTES, 'Retained receipt'); admitRawJson(link.rawReceiptBytes);
      json(link.receipt); json(link.policy);
    }
  }
  if (context !== undefined) {
    requireThat(context && Array.isArray(context.applications) && context.applications.length <= WBS_PROOF_LIMITS.links, 'Application count exceeds candidate limit or is missing');
    json(context);
  }
  return { logicalBytes };
}

/** No mode parameter; historical success never substitutes for current-state proof. */
export function verifyWbsEvidenceContinuity(
  input: { historicalBytes: Buffer; currentBytes: Buffer; forward?: ForwardWbsEvidence },
  acquireAuthority?: () => WbsContinuityAuthority,
): WbsContinuityResult {
  const r: WbsContinuityResult = { valid: false, historicalValid: false, currentForwardChainValid: false, mode: 'REJECTED', mayApply: false, errors: [] };
  try {
    requireThat(input && Buffer.isBuffer(input.historicalBytes) && Buffer.isBuffer(input.currentBytes), 'Required historical/current raw bytes missing');
    requireThat(input.historicalBytes.length <= WBS_PROOF_LIMITS.snapshotBytes, 'Historical WBS snapshot exceeds candidate limit');
    r.historicalWbsSha256 = sha(input.historicalBytes);
    requireThat(sha(input.historicalBytes) === HISTORICAL_WBS_SHA256, 'Pinned historical snapshot digest mismatch');
    r.historicalScopeCount = scope(input.historicalBytes);
    requireThat(r.historicalScopeCount === 27, 'Historical DMK-208 scope must remain 27');
    r.historicalValid = true;
    admitWbsContinuityProof(input);
    r.currentWbsSha256 = sha(input.currentBytes);
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
    admitWbsContinuityProof(input, context);
    requireThat(context && context.protected && Array.isArray(context.applications), 'Application authority missing');
    const now = instant(context.nowIso), until = instant(context.validUntilIso);
    requireThat(until > now && until - now <= 60_000, 'Authority freshness interval invalid or expired (maximum 60 seconds)');
    requireThat(positive(context.authorityEpoch) && positive(context.minimumAuthorityEpoch) && context.authorityEpoch >= context.minimumAuthorityEpoch, 'Stale authority epoch');
    requireThat(positive(context.revocationSequence) && positive(context.minimumRevocationSequence) && context.revocationSequence >= context.minimumRevocationSequence, 'Stale revocation checkpoint');
    const protectedState = context.protected;
    requireThat(SHA.test(protectedState.wbsSha256) && SHA.test(protectedState.ledgerSha256) && GIT.test(protectedState.masterCommitSha) && GIT.test(protectedState.masterTreeSha), 'Malformed protected Git/state identities');
    requireThat(protectedState.wbsSha256 === sha(input.currentBytes) && protectedState.ledgerSha256 === sha(forward.ledgerBytes), 'Terminal WBS/ledger differs from protected state');
    const { ledger, digests: prefixDigests } = parseWbsReceiptLedgerWithPrefixes(forward.ledgerBytes);
    requireThat(ledger.entries.length > 0 && ledger.entries.length === forward.links.length && ledger.entries.length === context.applications.length, 'Incomplete applied successor chain');
    let before = input.historicalBytes, lastTime = -Infinity, lastEpoch = 0, lastRevocation = 0;
    const policyByEpoch = new Map<number, { digest: string; version: string }>();
    const seenPolicies = new Set<string>(), seenVersions = new Set<string>(), seenCommits = new Set<string>();
    const consumedReceiptIds: string[] = [];
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
      requireThat(applied.receiptId === entry.receiptId && applied.preWbsSha256 === entry.preWbsSha256 && applied.postWbsSha256 === entry.postWbsSha256 && applied.policySha256 === entry.policySha256 && applied.rawReceiptSha256 === sha(link.rawReceiptBytes), 'Authenticated application does not bind exact receipt/state/policy');
      requireThat(applied.ledgerBeforeSha256 === prefixDigests[i] && applied.ledgerAfterSha256 === prefixDigests[i + 1], 'Authenticated consumed-ledger prefix mismatch');
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
        context: { pinnedPolicySha256: applied.policySha256, expectedGit: applied.expectedGit, nowIso: applied.appliedAt, consumedReceiptIds } });
      requireThat(verified.valid, 'Invalid applied successor: ' + verified.errors.join('; '));
      consumedReceiptIds.push(entry.receiptId); // Synchronous v2 audit finished; preserve PRE-consumption semantics.
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
      // Error reporting must not bypass admission by hashing an oversized buffer.
      currentWbsSha256: currentBytes && currentBytes.length <= WBS_PROOF_LIMITS.snapshotBytes ? sha(currentBytes) : undefined,
      errors: ['WBS evidence acquisition failed: ' + String(error)] } };
  }
}

export function combineWbsVerification<T extends { valid: boolean; errors: string[] }>(historical: T, continuity: WbsContinuityResult) {
  return { ...historical, valid: historical.valid && continuity.valid,
    errors: [...historical.errors, ...continuity.errors.map(e => 'Current/historical WBS boundary: ' + e)],
    historicalValid: historical.valid && continuity.historicalValid,
    currentForwardChainValid: continuity.currentForwardChainValid, mayApply: false as const, continuity };
}
