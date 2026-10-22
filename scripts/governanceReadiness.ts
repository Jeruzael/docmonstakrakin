/**
 * Read-only operational gap report. Local bytes and TESTONLY proofs are useful
 * evidence, but neither acquires independent production authority. There is no
 * production adapter, activation switch, enrollment or application entrypoint.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyWorkspaceWbsContinuity } from './wbsEvidenceContinuity.ts';
import { canonicalGovernanceJson } from './verifyWbsGovernanceEnvelope.ts';
import { snapshotSyntheticRequest, verifySyntheticRegistration, SYNTHETIC_WBS_LIMITS,
  type SyntheticRegistrationRequest, type SyntheticRegistrationState, type TestOnlyAuthoritySource } from './lib/syntheticWbsRegistration.ts';

export interface GovernanceReadinessInput {
  /** A local observation only; this path is never authenticated protected Git. */
  workspaceRoot: string;
  testOnlyCandidate?: {
    request: SyntheticRegistrationRequest;
    source: TestOnlyAuthoritySource;
    state: SyntheticRegistrationState;
  };
}
interface EvidenceSummary {
  status: 'NOT_EVALUATED' | 'NOT_PROVIDED' | 'REJECTED' | 'VERIFIED_LOCAL_BYTES' | 'VERIFIED_TEST_ONLY';
  scope: 'LOCAL_BYTES_ONLY' | 'TEST_ONLY';
  errors: string[];
  currentWbsSha256?: string;
  historicalWbsSha256?: string;
  requestSha256?: string;
  proposedLedgerSha256?: string;
}
export interface GovernanceReadinessReport {
  schemaVersion: 'GOVERNANCE_READINESS/1';
  mode: 'BLOCKED'; operationalReady: false; operationalAuthority: false; mayApply: false;
  inputErrors: string[];
  localContinuity: EvidenceSummary;
  testOnlyRegistration: EvidenceSummary;
  candidateByteBinding: {
    status: 'NOT_PROVIDED' | 'REJECTED' | 'MATCHED_LOCAL_WBS_BYTES'; errors: string[];
    beforeWbsSha256?: string; proposedWbsSha256?: string; rawReceiptSha256?: string;
  };
  prerequisites: { id: string; status: 'BLOCKED'; missing: string }[];
  blockedReasons: string[];
}

// These are absent acquisition/enforcement boundaries, not a checklist that a
// caller can mark complete. A future adapter needs separately implemented and
// reviewed authentication; adding a boolean or a signed digest is insufficient.
const missingProductionBoundaries = [
  ['HUMAN_AUTHORITY', 'Independently authenticated charter ratifier, actual appointments and acceptances, distinct eligible SO/LA/IHA humans, custody and conflict adjudication are not acquired.'],
  ['ROOT_POLICY_CLASSIFICATION', 'Operational root custody, independently ratified policy/person/classifier records and protected external pins are not acquired; R14 design approval and fixture digests do not ratify them.'],
  ['GIT_APPLICATION_PROVENANCE', 'Authenticated repository/owner identity, protected target/head/tree and actual applied-versus-reviewed ancestry are not acquired. Local bytes and signed intent cannot establish application.'],
  ['EPOCH_REPLAY_FENCING', 'Independent durable authority epochs, predecessor/checkpoint/nonce high-water marks and anti-rollback storage are not acquired or consumed.'],
  ['REVOCATION_ADJUDICATION', 'Current authenticated revocation state and per-historical-application compromise adjudication are not acquired; unresolved cases must deny.'],
  ['TRUSTED_TIME', 'Operational trusted-clock custody, uncertainty, freshness and consumer-time revocation fencing are not acquired. Fixed signed fixture times are TEST_ONLY.'],
  ['RESOURCE_ACCEPTANCE', 'Candidate proof/clock/queue bounds and measured fixture performance have no independently authenticated operational resource acceptance.'],
  ['PROTECTED_ATOMIC_APPLY', 'Remote protected-ref CAS joining exact WBS YAML, rendered Markdown, ledger, raw receipt and replay consumption is not implemented or enabled. TEST_ONLY SQLite transactions are a separate boundary.'],
  ['PROFILE_DESCENDANT_COMPATIBILITY', 'Production elevated registration compatibility and authenticated descendant support are absent. Existing continuity requires SO/LA and exact terminal application identity; recovery/root rotation is unsupported.'],
  ['SEPARATE_ACTIVATION', 'An authenticated exact-operation activation decision, production trust adapter and independent post-application audit are absent. Runtime reconciliation, privileged routes, Gate 7 and release have separate gates.'],
] as const;

function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const sha = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
function record(value: unknown, required: string[], optional: string[] = []): Record<string, any> {
  requireThat(value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'Exact inert report input required');
  requireThat(Object.getOwnPropertySymbols(value).length === 0, 'Symbol report field rejected');
  const names = Object.getOwnPropertyNames(value), allowed = [...required, ...optional];
  requireThat(required.every(k => names.includes(k)) && names.every(k => allowed.includes(k)), 'Unknown or missing report field; caller authority/verifier claims are not accepted');
  const snapshot: Record<string, any> = Object.create(null);
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)!;
    requireThat(descriptor.enumerable && 'value' in descriptor, 'Accessor or hidden report field rejected');
    snapshot[name] = descriptor.value;
  }
  return snapshot;
}
function copyBytes(value: unknown): Buffer {
  requireThat(Buffer.isBuffer(value) && value.length <= SYNTHETIC_WBS_LIMITS.bytes, 'Report evidence missing or exceeds existing 2 MiB candidate bound');
  return Buffer.from(value);
}
function snapshotCandidate(value: unknown) {
  const candidate = record(value, ['request', 'source', 'state']);
  const source = record(candidate.source, ['kind', 'pinnedAnchorSha256', 'acquire']);
  requireThat(source.kind === 'TESTONLY_PUBLIC_ROOTS' && typeof source.acquire === 'function', 'Only the existing TESTONLY authority source contract is supported');
  const rawState = record(candidate.state, ['revision', 'wbsBytes', 'ledgerBytes', 'commitSha', 'treeSha',
    'authorityEpoch', 'revocationSequence', 'checkpointSequence', 'clockSequence', 'consumedEnvelopeIds', 'consumedNonces'], ['lastNowIso', 'lastEnvelope']);
  const { wbsBytes, ledgerBytes, ...jsonState } = rawState;
  const state = { ...JSON.parse(canonicalGovernanceJson(jsonState)), wbsBytes: copyBytes(wbsBytes), ledgerBytes: copyBytes(ledgerBytes) } as SyntheticRegistrationState;
  return { request: snapshotSyntheticRequest(candidate.request), source: source as TestOnlyAuthoritySource, state };
}

/** No caller-provided verifier results, operational authority source or overrides. */
export function assessGovernanceReadiness(input: unknown): GovernanceReadinessReport {
  const prerequisites = missingProductionBoundaries.map(([id, missing]) => ({ id, status: 'BLOCKED' as const, missing }));
  const r: GovernanceReadinessReport = {
    schemaVersion: 'GOVERNANCE_READINESS/1', mode: 'BLOCKED', operationalReady: false, operationalAuthority: false, mayApply: false,
    inputErrors: [], localContinuity: { status: 'NOT_EVALUATED', scope: 'LOCAL_BYTES_ONLY', errors: [] },
    testOnlyRegistration: { status: 'NOT_PROVIDED', scope: 'TEST_ONLY', errors: [] },
    candidateByteBinding: { status: 'NOT_PROVIDED', errors: [] }, prerequisites,
    blockedReasons: prerequisites.map(p => p.id + ': ' + p.missing),
  };
  try {
    const data = record(input, ['workspaceRoot'], ['testOnlyCandidate']);
    requireThat(typeof data.workspaceRoot === 'string' && data.workspaceRoot.length <= 32_768 && path.isAbsolute(data.workspaceRoot), 'Absolute local workspace root required');
    // No production authority callback is accepted. Changed current WBS without
    // independently acquired applied evidence retains the existing denial.
    const { continuity } = verifyWorkspaceWbsContinuity(data.workspaceRoot);
    r.localContinuity = { status: continuity.valid ? 'VERIFIED_LOCAL_BYTES' : 'REJECTED', scope: 'LOCAL_BYTES_ONLY',
      errors: [...continuity.errors], currentWbsSha256: continuity.currentWbsSha256, historicalWbsSha256: continuity.historicalWbsSha256 };
    if (data.testOnlyCandidate !== undefined) {
      r.testOnlyRegistration.status = 'REJECTED'; r.candidateByteBinding.status = 'REJECTED';
      const candidate = snapshotCandidate(data.testOnlyCandidate);
      // Real composition verifies raw canonical receipt bytes, exact WBS/ledger
      // preview, v2 signatures, envelope, provenance and freshness/epoch floors.
      // A passing composition still explicitly has no operational authority.
      const evidence = verifySyntheticRegistration(candidate.request, candidate.source, candidate.state);
      requireThat(evidence.mayApply === false && evidence.operationalAuthority === false, 'TEST_ONLY verifier authority contract changed');
      r.testOnlyRegistration = { status: evidence.valid ? 'VERIFIED_TEST_ONLY' : 'REJECTED', scope: 'TEST_ONLY', errors: [...evidence.errors],
        requestSha256: evidence.requestSha256, proposedLedgerSha256: evidence.proposedLedgerBytes && sha(evidence.proposedLedgerBytes) };
      const beforeWbsSha256 = sha(candidate.request.beforeBytes);
      const matches = continuity.valid && beforeWbsSha256 === continuity.currentWbsSha256;
      r.candidateByteBinding = { status: matches && evidence.valid ? 'MATCHED_LOCAL_WBS_BYTES' : 'REJECTED',
        errors: [...(!matches ? ['Candidate before bytes differ from verified local current WBS, or local continuity failed'] : []),
          ...(!evidence.valid ? ['Exact candidate TEST_ONLY verification failed'] : [])],
        beforeWbsSha256, proposedWbsSha256: sha(candidate.request.afterBytes), rawReceiptSha256: sha(candidate.request.receiptBytes) };
    }
  } catch (error) { r.inputErrors.push(error instanceof Error ? error.message : 'Report input rejected'); }
  if (r.localContinuity.status === 'REJECTED') r.blockedReasons.push('LOCAL_CONTINUITY_REJECTED: ' + r.localContinuity.errors.join('; '));
  if (r.testOnlyRegistration.status === 'REJECTED') r.blockedReasons.push('TEST_ONLY_EVIDENCE_REJECTED: ' + [...r.testOnlyRegistration.errors, ...r.inputErrors].join('; '));
  if (r.candidateByteBinding.status === 'REJECTED') r.blockedReasons.push('CANDIDATE_BYTE_BINDING_REJECTED: ' + r.candidateByteBinding.errors.join('; '));
  if (r.inputErrors.length) r.blockedReasons.push('INPUT_REJECTED: ' + r.inputErrors.join('; '));
  return r;
}

// Importing this module does not run a report. CLI arguments cannot supply pins,
// assertions or a positive mode. Exit 2 means the reported operation is blocked.
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const report = assessGovernanceReadiness(process.argv.length === 2 ? { workspaceRoot: process.cwd() } : undefined);
  console.log(JSON.stringify(report, null, 2)); process.exitCode = 2;
}
