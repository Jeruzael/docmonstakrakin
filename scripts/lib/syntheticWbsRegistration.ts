/**
 * Unwired TESTONLY registration engineering. A passing result grants no apply
 * authority. Acquisition callbacks/pins are trusted host inputs, never PR JSON.
 * No production adapter, roots, environment fallback or enrollment is provided.
 */
import crypto from 'node:crypto';
import { canonicalGovernanceJson, verifyOfflineWbsGovernanceEnvelope } from '../verifyWbsGovernanceEnvelope.ts';
import { previewWbsRegistrationTransaction, parseWbsReceiptLedgerV1, validateAndNormalizeSignedReceiptV2 } from '../planWbsRegistrationTransaction.ts';
import type { TrustedPolicyV2, ReviewedGitContextV2 } from '../verifyTrustedWbsRegistrationV2.ts';

export const SYNTHETIC_WBS_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, applications: 256, acquisitionWindowMs: 60_000 });
export const syntheticHash = (raw: Buffer | string) => crypto.createHash('sha256').update(raw).digest('hex');
export const acquisitionSigningBytes = (value: unknown) => Buffer.from('DOCMONSTAKRAKIN/TESTONLY_WBS_ACQUISITION/1\n' + canonicalGovernanceJson(value));
export interface SyntheticGitState { commitSha: string; treeSha: string; wbsSha256: string; ledgerSha256: string }
export interface SyntheticRegistrationState {
  revision: number; wbsBytes: Buffer; ledgerBytes: Buffer; commitSha: string; treeSha: string;
  authorityEpoch: number; revocationSequence: number; checkpointSequence: number; clockSequence: number;
  consumedEnvelopeIds: string[]; consumedNonces: string[]; lastNowIso?: string;
  lastEnvelope?: { envelopeSha256: string; authorityEpoch: number; policySha256: string; policyVersion: string;
    revocationSequence: number; rootId: string; rootVersion: number };
}
export interface SyntheticRegistrationRequest {
  schemaVersion: 'SYNTHETIC_REGISTRATION/1'; operationId: string; expectedRevision: number;
  beforeBytes: Buffer; afterBytes: Buffer; receiptBytes: Buffer;
}
export interface TestOnlyAuthoritySource {
  kind: 'TESTONLY_PUBLIC_ROOTS'; pinnedAnchorSha256: string;
  acquire(requestSha256: string): { envelopeBytes: Buffer; policy: TrustedPolicyV2; context: any;
    provenance: { schemaVersion: 'TESTONLY_ACQUISITION/1'; requestSha256: string; envelopeSha256: string; expectedGit: ReviewedGitContextV2;
      protected: SyntheticGitState; applied: SyntheticGitState & { parentShas: string[] };
      nowIso: string; validUntilIso: string; authorityEpoch: number; revocationSequence: number; checkpointSequence: number; clockSequence: number };
    signatureBase64: string };
}
export interface SyntheticRegistrationResult {
  valid: boolean; mayApply: false; operationalAuthority: false; errors: string[]; requestSha256?: string;
  proposedLedgerBytes?: Buffer; acquisition?: ReturnType<TestOnlyAuthoritySource['acquire']>;
}
const SHA = /^[0-9a-f]{64}$/, GIT = /^[0-9a-f]{40}$/, ID = /^TESTONLY-[A-Za-z0-9._:-]{1,110}$/;
function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function exact(v: any, keys: string[], label: string) {
  requireThat(v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v)) &&
    Object.getOwnPropertySymbols(v).length === 0 && Object.getOwnPropertyNames(v).length === keys.length && keys.every(k => {
      const d = Object.getOwnPropertyDescriptor(v, k); return d && d.enumerable && 'value' in d;
    }), label + ' exact inert schema required');
}
function bytes(v: unknown, label: string): asserts v is Buffer {
  requireThat(Buffer.isBuffer(v) && v.length <= SYNTHETIC_WBS_LIMITS.bytes, label + ' missing or exceeds 2 MiB candidate bound');
}
function precise(value: unknown) {
  requireThat(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value), 'Invalid precise clock');
  const n = Date.parse(value); requireThat(Number.isFinite(n) && new Date(n).toISOString() === value, 'Invalid clock instant'); return n;
}
function gitState(value: any) {
  requireThat(value && GIT.test(value.commitSha) && GIT.test(value.treeSha) && SHA.test(value.wbsSha256) && SHA.test(value.ledgerSha256), 'Malformed acquired Git identities');
}
function clone<T>(v: T): T { return JSON.parse(canonicalGovernanceJson(v)); }
export function syntheticRequestDigest(request: SyntheticRegistrationRequest): string {
  exact(request, ['schemaVersion', 'operationId', 'expectedRevision', 'beforeBytes', 'afterBytes', 'receiptBytes'], 'Request');
  requireThat(request.schemaVersion === 'SYNTHETIC_REGISTRATION/1' && ID.test(request.operationId) && Number.isSafeInteger(request.expectedRevision) && request.expectedRevision >= 0, 'Synthetic request version/identity/revision invalid');
  bytes(request.beforeBytes, 'Before WBS'); bytes(request.afterBytes, 'After WBS'); bytes(request.receiptBytes, 'Receipt');
  return syntheticHash(canonicalGovernanceJson({ schemaVersion: request.schemaVersion, operationId: request.operationId, expectedRevision: request.expectedRevision,
    beforeSha256: syntheticHash(request.beforeBytes), afterSha256: syntheticHash(request.afterBytes), receiptSha256: syntheticHash(request.receiptBytes) }));
}
export function snapshotSyntheticRequest(request: SyntheticRegistrationRequest): SyntheticRegistrationRequest {
  syntheticRequestDigest(request);
  return { schemaVersion: request.schemaVersion, operationId: request.operationId, expectedRevision: request.expectedRevision,
    beforeBytes: Buffer.from(request.beforeBytes), afterBytes: Buffer.from(request.afterBytes), receiptBytes: Buffer.from(request.receiptBytes) };
}
/** Versioned compatibility composes unchanged v2/legacy validators; no caller mode. */
export function verifySyntheticRegistration(request: SyntheticRegistrationRequest, source: TestOnlyAuthoritySource, state: SyntheticRegistrationState): SyntheticRegistrationResult {
  const r: SyntheticRegistrationResult = { valid: false, mayApply: false, operationalAuthority: false, errors: [] };
  try {
    requireThat(source?.kind === 'TESTONLY_PUBLIC_ROOTS' && SHA.test(source.pinnedAnchorSha256) && typeof source.acquire === 'function', 'Independent test-only authority required');
    const pin = source.pinnedAnchorSha256;
    request = snapshotSyntheticRequest(request);
    const requestSha256 = syntheticRequestDigest(request);
    requireThat(state && Number.isSafeInteger(state.revision) && state.revision === request.expectedRevision, 'Protected revision CAS mismatch');
    bytes(state.wbsBytes, 'Protected WBS'); bytes(state.ledgerBytes, 'Protected ledger');
    requireThat(state.wbsBytes.equals(request.beforeBytes), 'Protected before bytes mismatch');
    for (const key of ['authorityEpoch', 'revocationSequence', 'checkpointSequence', 'clockSequence'])
      requireThat(Number.isSafeInteger(state[key]) && state[key] >= 0, 'Invalid durable authority floor');
    for (const list of [state.consumedEnvelopeIds, state.consumedNonces])
      requireThat(Array.isArray(list) && list.length <= SYNTHETIC_WBS_LIMITS.applications && new Set(list).size === list.length, 'Invalid durable replay state');
    const raw = source.acquire(requestSha256); requireThat(raw, 'Authority acquisition unavailable');
    exact(raw, ['envelopeBytes', 'policy', 'context', 'provenance', 'signatureBase64'], 'Authority acquisition'); bytes(raw.envelopeBytes, 'Governance envelope');
    // Snapshot inert acquisition data; no accessors or executable metadata accepted.
    const acquired = { envelopeBytes: Buffer.from(raw.envelopeBytes), policy: clone(raw.policy), context: clone(raw.context),
      provenance: clone(raw.provenance), signatureBase64: raw.signatureBase64 };
    const { context, provenance: p } = acquired;
    requireThat(syntheticHash(canonicalGovernanceJson({ root: context.root, witness: context.witness, clock: context.clock })) === pin, 'Independent public-root pin mismatch');
    requireThat(canonicalGovernanceJson(context.consumedEnvelopeIds) === canonicalGovernanceJson(state.consumedEnvelopeIds) &&
      canonicalGovernanceJson(context.consumedNonces) === canonicalGovernanceJson(state.consumedNonces), 'Acquired replay state differs from durable state');
    requireThat(state.authorityEpoch === 0 ? context.previous === null && !state.lastEnvelope :
      state.lastEnvelope && state.lastEnvelope.authorityEpoch === state.authorityEpoch &&
      canonicalGovernanceJson(context.previous) === canonicalGovernanceJson(state.lastEnvelope), 'Missing/disconnected durable envelope predecessor');
    const envelope = verifyOfflineWbsGovernanceEnvelope(acquired.envelopeBytes, acquired.policy, context);
    requireThat(envelope.valid && !envelope.mayApply && !envelope.operationalAuthority, 'Offline envelope rejected: ' + envelope.errors.join('; '));
    exact(p, ['schemaVersion', 'requestSha256', 'envelopeSha256', 'expectedGit', 'protected', 'applied', 'nowIso', 'validUntilIso', 'authorityEpoch', 'revocationSequence', 'checkpointSequence', 'clockSequence'], 'Acquisition');
    requireThat(p.schemaVersion === 'TESTONLY_ACQUISITION/1' && p.requestSha256 === requestSha256 && p.envelopeSha256 === envelope.envelopeSha256, 'Acquisition/request binding mismatch');
    const signature = acquired.signatureBase64;
    requireThat(typeof signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(signature) &&
      Buffer.from(signature, 'base64').toString('base64') === signature &&
      crypto.verify(null, acquisitionSigningBytes(p), context.witness.publicKeyPem, Buffer.from(signature, 'base64')), 'Acquisition witness signature invalid');
    const now = precise(p.nowIso), until = precise(p.validUntilIso);
    requireThat(now === precise(context.fixedNowIso) && until > now && until >= now + context.clockObservation.payload.uncertaintyMs && until - now <= SYNTHETIC_WBS_LIMITS.acquisitionWindowMs &&
      until <= precise(context.clockObservation.payload.validUntilIso) && until <= precise(context.checkpoint.payload.validUntilIso), 'Acquisition freshness mismatch');
    if (state.lastNowIso) requireThat(now >= precise(state.lastNowIso), 'Durable clock rollback');
    for (const [key, floorKey] of [['authorityEpoch', 'minimumAuthorityEpoch'], ['revocationSequence', 'minimumRevocationSequence'],
      ['checkpointSequence', 'minimumCheckpointSequence'], ['clockSequence', 'minimumClockSequence']]) {
      requireThat(Number.isSafeInteger(p[key]) && p[key] > 0 && p[key] >= state[key] && context[floorKey] >= state[key], 'Durable authority rollback');
    }
    const payload = JSON.parse(acquired.envelopeBytes.toString('utf8')).payload;
    requireThat(p.authorityEpoch === payload.authorityEpoch && p.revocationSequence === payload.revocationSequence &&
      p.checkpointSequence === context.checkpoint.payload.sequence && p.clockSequence === context.clockObservation.payload.sequence, 'Acquisition epoch/checkpoint inconsistency');
    exact(p.protected, ['commitSha', 'treeSha', 'wbsSha256', 'ledgerSha256'], 'Protected provenance');
    exact(p.applied, ['commitSha', 'treeSha', 'wbsSha256', 'ledgerSha256', 'parentShas'], 'Applied provenance');
    gitState(p.protected); gitState(p.applied);
    requireThat(p.protected.commitSha === state.commitSha && p.protected.treeSha === state.treeSha && p.protected.wbsSha256 === syntheticHash(state.wbsBytes) &&
      p.protected.ledgerSha256 === syntheticHash(state.ledgerBytes), 'Protected Git/state CAS mismatch');
    requireThat(p.expectedGit.baseCommitSha === state.commitSha && Array.isArray(p.applied.parentShas) && p.applied.parentShas[0] === state.commitSha &&
      p.applied.parentShas.length <= 2 && p.applied.parentShas.every(v => GIT.test(v)) && p.applied.commitSha !== state.commitSha, 'Applied Git parent/base mismatch');
    const text = request.receiptBytes.toString('utf8');
    requireThat(Buffer.from(text).equals(request.receiptBytes), 'Receipt UTF-8 mismatch');
    const parsed = JSON.parse(text);
    requireThat(canonicalGovernanceJson(parsed) === text, 'Receipt must be exact canonical JSON without duplicate keys');
    const receipt = validateAndNormalizeSignedReceiptV2(parsed);
    const ledger = parseWbsReceiptLedgerV1(state.ledgerBytes);
    requireThat(ledger.entries.length < SYNTHETIC_WBS_LIMITS.applications, 'Synthetic application capacity reached');
    const preview = previewWbsRegistrationTransaction({ beforeBytes: request.beforeBytes, afterBytes: request.afterBytes, ledgerBytes: state.ledgerBytes,
      expectedCurrentWbsSha256: p.protected.wbsSha256, expectedCurrentLedgerSha256: p.protected.ledgerSha256, receipt, policy: acquired.policy,
      trustedContext: { pinnedPolicySha256: context.expected.policySha256, expectedGit: p.expectedGit, nowIso: p.nowIso, consumedReceiptIds: ledger.entries.map(e => e.receiptId) } });
    requireThat(preview.valid && preview.mayApply === false, 'Registration preview rejected: ' + preview.errors.join('; '));
    requireThat(p.applied.wbsSha256 === preview.proposedWbsSha256 && p.applied.ledgerSha256 === preview.proposedLedgerSha256, 'Signed intent is not authenticated applied provenance');
    r.valid = true; r.requestSha256 = requestSha256; r.proposedLedgerBytes = preview.proposedLedgerBytes; r.acquisition = acquired;
  } catch (error) { r.errors.push(error instanceof Error ? error.message : 'Synthetic registration rejected'); }
  return r;
}
