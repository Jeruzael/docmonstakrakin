/** Release evaluation separates stored observations from authenticated authority. */
import {GENESIS_AUDIT_HASH, verifyAuditLedgerChain} from '../security/auditImmutability.ts';
import {isReleaseScopeContext, READINESS_WORK_STATUSES} from '../../src/data/releaseHealthProjection.ts';
import type {Project, Question, Requirement, WorkItem, AuditEvent, ApprovalItem} from '../../src/types.ts';
import {productionEvidenceUnavailable, type ProductionEvidenceUnavailable, type ReleaseEvaluationScope, type ReleaseScopeEvaluation} from './releaseEvidenceTypes.ts';
import {GITHUB_CI_POLICY, isAcquiredGitHubCiObservation, type GitHubCiObservation} from './githubCiAcquisition.ts';
export type {ReleaseEvaluationScope, ReleaseScopeEvaluation} from './releaseEvidenceTypes.ts';

export interface LocalGateCheck {
  status: 'SATISFIED' | 'FAILED' | 'PENDING' | 'NOT_APPLICABLE';
  subjectIds: string[];
  details: string;
}
export interface ReleaseGateResult {
  gateId: number; code: string; name: string;
  status: 'PASSED' | 'FAILED' | 'PENDING' | 'HUMAN_APPROVAL_REQUIRED';
  details: string; blocking: boolean; evidenceLinks: string[];
  localCheck: LocalGateCheck;
}
export interface CapabilityAssessment {
  capabilityId: number; title: string; referenceDmk: string;
  status: 'VERIFIED' | 'IMPLEMENTED' | 'PENDING'; evidence: string;
  applicability: 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'UNAVAILABLE';
  sourceWorkItemId: string | null; rationale: string;
}
export interface ReleaseAuditReport {
  version: 'OPERATIONAL_RELEASE_EVALUATION/1';
  projectId: string; projectName: string; timestamp: string; targetMilestone: string;
  projectStateVersion: number | null;
  evaluationScope: ReleaseScopeEvaluation;
  productionEvidence: ProductionEvidenceUnavailable;
  ciObservation?: GitHubCiObservation;
  ciObservationRejection?: string;
  allGatesPassed: boolean; gates: ReleaseGateResult[];
  capabilitiesSummary: {total: number; verified: number; percentage: number};
  capabilities: CapabilityAssessment[];
  auditChainIntegrity: {valid: boolean; breaksCount: number; eventsChecked: number;
    available: boolean; trust: 'LOCAL_STORED_BYTES_ONLY'};
  releaseReady: boolean; signedOff: boolean;
  localSignoffObservations: {auditEventIds: string[]; approvalIds: string[]; humanAuthorization: false};
  signoffDetails?: {actor: string; timestamp: string; auditEventId: string};
}
export interface ProjectDataAccessor {
  projects: Project[]; questions: Record<string, Question[]>;
  requirements: Record<string, Requirement[]>; workItems: Record<string, WorkItem[]>;
  auditLogs: Record<string, AuditEvent[]>; approvals: Record<string, ApprovalItem[]>;
  addAuditEvent?: (projectId: string, actor: string, action: string, target: string, reason?: string, details?: any) => AuditEvent;
}
const evidenceReferences = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((reference): reference is string => typeof reference === 'string' && reference.trim().length > 0) : [];

/** Bind only an unambiguous current project declaration and exact task rows. */
export function evaluateReleaseScope(store: ProjectDataAccessor, projectId: string): ReleaseScopeEvaluation {
  const projects = store.projects.filter(project => project.id === projectId);
  if (projects.length !== 1) return {status: 'INVALID', scope: null, reason: 'Project is missing or ambiguous.'};
  const project = projects[0], scope = project.readinessContext;
  if (!scope) return {status: 'UNAVAILABLE', scope: null, reason: 'No current release scope is configured.'};
  if (!isReleaseScopeContext(scope) || scope.targetRelease !== project.targetRelease)
    return {status: 'INVALID', scope: null, reason: 'Release scope is malformed or differs from the project target release.'};
  const rows = store.workItems[projectId];
  if (!Array.isArray(rows)) return {status: 'INVALID', scope: null, reason: 'Current scoped work data is unavailable.'};
  for (const id of scope.workItemIds) {
    const matches = rows.filter(row => row?.id === id);
    if (matches.length !== 1 || !READINESS_WORK_STATUSES.includes(matches[0].status))
      return {status: 'INVALID', scope: null, reason: `Scoped task ${id} is missing, ambiguous or has an unknown lifecycle state.`};
  }
  return {status: 'BOUND', scope: {projectId, targetRelease: scope.targetRelease, workItemIds: [...scope.workItemIds],
    commitSha: scope.commitSha, buildRevision: scope.buildRevision, environment: scope.environment, scopeId: scope.id, scopeRevision: scope.revision},
    reason: 'Exact project, release, commit, build, environment and task declaration bound. The declaration itself does not authenticate evidence.'};
}
function sameScope(left: ReleaseEvaluationScope, right: ReleaseEvaluationScope): boolean {
  return left.projectId === right.projectId && left.targetRelease === right.targetRelease && left.commitSha === right.commitSha &&
    left.buildRevision === right.buildRevision && left.environment === right.environment && left.scopeId === right.scopeId &&
    left.scopeRevision === right.scopeRevision && JSON.stringify(left.workItemIds) === JSON.stringify(right.workItemIds);
}

export const V01_CAPABILITIES: { id: number; title: string; dmk: string }[] = [
  { id: 1, title: 'Create project with multiple profiles', dmk: 'DMK-017' },
  { id: 2, title: 'Run adaptive questionnaire with conditional branching', dmk: 'DMK-027' },
  { id: 3, title: 'Mark questions as blocking vs required', dmk: 'DMK-020' },
  { id: 4, title: 'Calculate requirements readiness score', dmk: 'DMK-024' },
  { id: 5, title: 'Generate requirements from approved answers', dmk: 'DMK-028' },
  { id: 6, title: 'Review and approve requirements baseline', dmk: 'DMK-031' },
  { id: 7, title: 'Compute inherent risk score (Likelihood x Impact)', dmk: 'DMK-036' },
  { id: 8, title: 'Enforce mandatory risk floor for dangerous capabilities', dmk: 'DMK-038' },
  { id: 9, title: 'Create and manage ADRs with status lifecycle', dmk: 'DMK-048' },
  { id: 10, title: 'Move project through 15-phase A-SSDLC state machine', dmk: 'DMK-033' },
  { id: 11, title: 'Enforce phase exit criteria using deterministic checks', dmk: 'DMK-035' },
  { id: 12, title: 'Record and enforce time-limited gate overrides', dmk: 'DMK-041' },
  { id: 13, title: 'View unified WorkItem model in Kanban, WBS, Backlog', dmk: 'DMK-085' },
  { id: 14, title: 'Compile scoped prompt with permissions & schema', dmk: 'DMK-067' },
  { id: 15, title: 'Send prompt to Gemini & validate structured JSON', dmk: 'DMK-079' },
  { id: 16, title: 'Run independent second-agent review on proposals', dmk: 'DMK-081' },
  { id: 17, title: 'Copy/paste manual offline prompt workflow', dmk: 'DMK-078' },
  { id: 18, title: 'Validate file access against path allow/deny masks', dmk: 'DMK-098' },
  { id: 19, title: 'Inspect local git status, log, and diff', dmk: 'DMK-105' },
  { id: 20, title: 'Confirm structured terminal command before execution', dmk: 'DMK-110' },
  { id: 21, title: 'Attach SHA-256 evidence before marking verified', dmk: 'DMK-114' },
  { id: 22, title: 'Append-only SHA-256 hash-chained audit ledger', dmk: 'DMK-120' },
  { id: 23, title: 'Browse pinned NIST SSDF and OWASP standards', dmk: 'DMK-055' },
  { id: 24, title: 'Check for standards updates & preview semantic diff', dmk: 'DMK-126' },
  { id: 25, title: 'Display deterministic recommended next action', dmk: 'DMK-139' },
];

const CAPABILITY_PRIMARY_ITEM_MAP: Record<string, string> = {
    'DMK-017': 'DMK-017',
    'DMK-027': 'DMK-020',
    'DMK-020': 'DMK-020',
    'DMK-024': 'DMK-020',
    'DMK-028': 'DMK-025',
    'DMK-031': 'DMK-025',
    'DMK-036': 'DMK-030',
    'DMK-038': 'DMK-030',
    'DMK-048': 'DMK-070',
    'DMK-033': 'DMK-035',
    'DMK-035': 'DMK-035',
    'DMK-041': 'DMK-035',
    'DMK-085': 'DMK-085',
    'DMK-067': 'DMK-065',
    'DMK-079': 'DMK-065',
    'DMK-081': 'DMK-081',
    'DMK-078': 'DMK-065',
    'DMK-098': 'DMK-159',
    'DMK-105': 'DMK-080',
    'DMK-110': 'DMK-159',
    'DMK-114': 'DMK-156',
    'DMK-120': 'DMK-159',
    'DMK-055': 'DMK-050',
    'DMK-126': 'DMK-050',
    'DMK-139': 'DMK-042',
  };

/** All seven gates and all catalog capabilities remain visible, including
 * unbound/out-of-scope entries. No unavailable proof is silently waived. */
export function evaluateReleaseGates(store: ProjectDataAccessor, projectId: string,
  options: {ciObservation?: unknown} = {}): ReleaseAuditReport {
  const project = store.projects.find(project => project.id === projectId);
  const evaluationScope = evaluateReleaseScope(store, projectId), scope = evaluationScope.scope;
  const questions = store.questions[projectId] || [], requirements = store.requirements[projectId] || [];
  const allWorkItems = store.workItems[projectId] || [], auditLogs = store.auditLogs[projectId] || [], approvals = store.approvals[projectId] || [];
  const workItems = scope ? allWorkItems.filter(item => scope.workItemIds.includes(item.id)) : [];
  const productionEvidence = productionEvidenceUnavailable();
  let ciObservation: GitHubCiObservation | undefined, ciObservationRejection: string | undefined;
  if (options.ciObservation !== undefined) {
    const candidate = options.ciObservation;
    if (scope && isAcquiredGitHubCiObservation(candidate) && sameScope(candidate.scope, scope) &&
      Date.now() - Date.parse(candidate.observedAt) >= -60000 && Date.now() - Date.parse(candidate.observedAt) <= GITHUB_CI_POLICY.observationMaxAgeMs)
      ciObservation = candidate;
    else ciObservationRejection = 'CI observation is not a fresh same-process acquisition for this exact current release scope. Imported/client claims cannot establish CI observations.';
  }
  const gates: ReleaseGateResult[] = [];
  function gate(gateId: number, code: string, name: string, localCheck: LocalGateCheck, references: string[] = []) {
    gates.push({gateId, code, name, status: localCheck.status === 'FAILED' ? 'FAILED' : 'PENDING', localCheck,
      details: `${localCheck.details} ${scope ? '' : `${evaluationScope.reason} `}${productionEvidence.reason}`,
      blocking: true, evidenceLinks: references});
  }
  const blockers = questions.filter(q => q.importance === 'BLOCKING' || q.blocking === true || (q as any).urgency === 'CRITICAL' || (q as any).isBlocking === true);
  const unresolved = blockers.filter(q => q.state === 'UNRESOLVED');
  const unknown = blockers.filter(q => !['UNRESOLVED', 'ANSWERED', 'DEFERRED', 'NOT_APPLICABLE'].includes(q.state));
  const blockerSummary = blockers.map(q => `${q.id}=${q.state ?? 'MISSING'}`).join(', ') || 'none';
  gate(1, 'GATE-01-BLOCKERS', 'Zero Unresolved Blocker Questions', {
    status: unresolved.length || unknown.length ? 'FAILED' : !Array.isArray(store.questions[projectId]) || !scope ? 'PENDING' : 'SATISFIED',
    subjectIds: blockers.map(q => q.id),
    details: `Stored project blocker observations: ${blockerSummary}. ${unresolved.length} unresolved; ${unknown.length} unknown or missing states. Answered labels, applicability decisions and deferrals do not authenticate answers or formal risk acceptance.`,
  });
  const core = requirements.filter(r => (r.priority === 'CRITICAL' || r.priority === 'HIGH') && (!scope ||
    r.workItems?.some(id => scope.workItemIds.includes(id)) || workItems.some(item => item.requirements?.includes(r.id))));
  const unapproved = core.filter(r => r.status !== 'APPROVED' && r.status !== 'VERIFIED');
  const missingRefs = core.filter(r => !evidenceReferences(r.evidence).length);
  const unlinkedCore = scope ? requirements.filter(r => (r.priority === 'CRITICAL' || r.priority === 'HIGH') && !core.includes(r)) : [];
  gate(2, 'GATE-02-REQUIREMENTS', '100% Core Requirements Verification', {
    status: unapproved.length || missingRefs.length ? 'FAILED' : !scope || !core.length || unlinkedCore.length ? 'PENDING' : 'SATISFIED',
    subjectIds: core.map(r => r.id),
    details: `Stored core requirement observations: ${core.map(r => `${r.id}=${r.status}`).join(', ') || 'none'}. Not APPROVED/VERIFIED: ${unapproved.map(r => r.id).join(', ') || 'none'}; missing evidence references: ${missingRefs.map(r => r.id).join(', ') || 'none'}. Unlinked project core requirements: ${unlinkedCore.map(r => r.id).join(', ') || 'none'}; these are not silently waived. References and lifecycle labels do not authenticate passing tests, requirement authorization or release coverage.`,
  }, core.flatMap(r => evidenceReferences(r.evidence)));
  function taskCheck(ids: string[], allowed: string[]): LocalGateCheck {
    const rows = ids.map(id => workItems.find(item => item.id === id));
    const selected = scope ? ids.filter(id => scope.workItemIds.includes(id)) : [];
    const failed = rows.some(row => row && !allowed.includes(row.status));
    return {status: failed ? 'FAILED' : !scope ? 'PENDING' : !selected.length ? 'NOT_APPLICABLE' : rows.some(row => !row) ? 'PENDING' : 'SATISFIED',
      subjectIds: selected, details: `Stored scoped work-item observations: ${ids.map((id, index) => `${id}=${rows[index]?.status ?? 'OUT_OF_SCOPE_OR_UNAVAILABLE'}`).join('; ')}. Local satisfactory labels: ${allowed.join('/')}. Omitted gate subjects have no accepted applicability waiver. Lifecycle labels and references alone do not establish execution or authenticated evidence.`};
  }
  const secrets = taskCheck(['DMK-157', 'DMK-158'], ['VERIFIED', 'APPROVED']);
  gate(3, 'GATE-03-SECRETS', 'Secret Store Integration Complete (DMK-157 & DMK-158)',
    {...secrets, details: `${secrets.details} This evaluator does not inspect credential storage, run rotation or perform a secret sweep.`},
    workItems.filter(item => ['DMK-157', 'DMK-158'].includes(item.id)).flatMap(item => evidenceReferences(item.evidence)));
  const security = taskCheck(['DMK-159'], ['VERIFIED']);
  if (scope?.workItemIds.includes('DMK-159') && ciObservation) {
    security.status = ciObservation.status === 'FAILED' ? 'FAILED' : ciObservation.status === 'OBSERVED_SUCCESS' ? 'SATISFIED' : 'PENDING';
    security.details += ` Read-only GitHub CI observation: ${ciObservation.status}, run ${ciObservation.runId}. ${ciObservation.reason} This does not authenticate test assertions, requirement review or production security controls.`;
  }
  gate(4, 'GATE-04-SECURITY-REGRESSION', 'Security Regression Passing (DMK-159)',
    {...security, details: `${security.details} This evaluator does not execute test suites or infer their counts from stored status.`},
    workItems.filter(item => item.id === 'DMK-159').flatMap(item => evidenceReferences(item.evidence)));
  const golden = taskCheck(['DMK-156'], ['VERIFIED']);
  gate(5, 'GATE-05-GOLDEN-REFERENCE', 'Golden Reference Project Execution & Package Sealing',
    {...golden, details: `${golden.details} Project IDs and entity counts do not prove a reference journey or package roundtrip. No such execution is performed here.`},
    workItems.filter(item => item.id === 'DMK-156').flatMap(item => evidenceReferences(item.evidence)));
  // The general ledger reader tolerates legacy short hashes. Release observations
  // require complete SHA-256 records and a local genesis before checking bytes.
  const malformedHashes = auditLogs.some(event => !event || !/^[a-f0-9]{64}$/.test(event.stateHash) || !/^[a-f0-9]{64}$/.test(event.previousHash || ''));
  const unknownAnchor = auditLogs.length > 0 && auditLogs[auditLogs.length - 1].previousHash !== GENESIS_AUDIT_HASH;
  const auditVerification = malformedHashes || unknownAnchor ? {valid: false, error: 'Missing/malformed SHA-256 hashes or unbound local ledger genesis.'}
    : verifyAuditLedgerChain(auditLogs, 'REVERSE_CHRONOLOGICAL');
  gate(6, 'GATE-06-AUDIT-INTEGRITY', 'Cryptographic Audit Ledger Integrity', {
    status: !auditVerification.valid ? 'FAILED' : !auditLogs.length ? 'PENDING' : 'SATISFIED',
    subjectIds: auditLogs.map(event => event.id),
    details: !auditVerification.valid ? `Local stored audit-byte verification failed: ${auditVerification.error}`
      : auditLogs.length ? `${auditLogs.length} local stored audit records have consistent SHA-256 links. This does not authenticate their origin, completeness, human actors or release/build/task binding.`
      : 'No audit ledger records are available. An empty sequence does not establish release integrity.',
  });
  const localSignoffObservations = {auditEventIds: auditLogs.filter(event => ['RELEASE_GATE_APPROVED', 'RELEASE_SIGNOFF_RECORDED'].includes(event.action)).map(event => event.id),
    approvalIds: approvals.filter(approval => approval.type === 'RELEASE_SIGNOFF' && approval.status === 'APPROVED').map(approval => approval.id), humanAuthorization: false as const};
  gates.push({gateId: 7, code: 'GATE-07-RELEASE-SIGNOFF', name: 'Security Lead DoD Sign-off (DMK-165)', status: 'HUMAN_APPROVAL_REQUIRED', blocking: true,
    localCheck: {status: 'PENDING', subjectIds: ['DMK-165'], details: 'Independent human release authorization is unavailable.'},
    details: `${localSignoffObservations.auditEventIds.length} local signoff audit records and ${localSignoffObservations.approvalIds.length} approved local records observed. These records, including imported archive records, do not authenticate an independent human decision for this exact release. Gate 7 requires separately authenticated human sign-off; no ceremony is executed by this evaluation.`, evidenceLinks: []});
  const capabilities: CapabilityAssessment[] = V01_CAPABILITIES.map(cap => {
    const primaryId = CAPABILITY_PRIMARY_ITEM_MAP[cap.dmk] || cap.dmk;
    const applicable = scope && (scope.workItemIds.includes(cap.dmk) || scope.workItemIds.includes(primaryId));
    const row = applicable ? workItems.find(item => item.id === cap.dmk) || workItems.find(item => item.id === primaryId) : undefined;
    return {capabilityId: cap.id, title: cap.title, referenceDmk: cap.dmk,
      status: row && ['VERIFIED', 'VERIFICATION'].includes(row.status) ? 'IMPLEMENTED' : 'PENDING',
      evidence: evidenceReferences(row?.evidence).join(', '), applicability: !scope ? 'UNAVAILABLE' : applicable ? 'IN_SCOPE' : 'OUT_OF_SCOPE',
      sourceWorkItemId: row?.id || null,
      rationale: row ? `Scoped local lifecycle ${row.id}=${row.status}; references are untrusted observations. No authenticated capability verification was acquired.`
        : !scope ? evaluationScope.reason : 'Capability task and its catalog alias are outside the declared scope. It remains visible and is not silently waived.'};
  });
  return {version: 'OPERATIONAL_RELEASE_EVALUATION/1', projectId, projectName: project?.name || 'Unknown Project',
    timestamp: new Date().toISOString(), targetMilestone: project?.targetRelease || 'UNAVAILABLE', projectStateVersion: project?.stateVersion ?? null,
    evaluationScope, productionEvidence, ...(ciObservation ? {ciObservation} : {}), ...(ciObservationRejection ? {ciObservationRejection} : {}),
    allGatesPassed: false, gates, capabilitiesSummary: {total: capabilities.length, verified: 0, percentage: 0}, capabilities,
    auditChainIntegrity: {valid: auditVerification.valid, breaksCount: auditVerification.valid ? 0 : 1, eventsChecked: auditLogs.length,
      available: auditLogs.length > 0, trust: 'LOCAL_STORED_BYTES_ONLY'},
    releaseReady: false, signedOff: false, localSignoffObservations};
}

/** The legacy ceremony cannot grant operational human authority. Never write
 * evidence IDs, lifecycle labels, approvals, planning scores or audit events. */
export function executeReleaseSignoff(store: ProjectDataAccessor, projectId: string, _actor: string, _notes?: string):
  {success: boolean; report: ReleaseAuditReport; auditEvent?: AuditEvent; error?: string} {
  const report = evaluateReleaseGates(store, projectId);
  const unsatisfied = report.gates.filter(gate => gate.gateId <= 6 && gate.status !== 'PASSED');
  return {success: false, report, error: `Cannot sign off release: ${unsatisfied.length} prerequisite gates are not satisfied (${unsatisfied.map(gate => gate.code).join(', ')}). Authenticated production evidence and independent human release authorization are unavailable.`};
}
