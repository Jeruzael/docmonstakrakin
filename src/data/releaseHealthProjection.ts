import type {WorkItem, WorkItemStatus} from '../types';
import type {BoundReleaseEvidence, LocalReleaseEvidenceObservation, ReadinessProject, ReleaseHealthSummary, ReleaseScopeContext} from '../releaseScopeTypes';

export const READINESS_WORK_STATUSES: readonly WorkItemStatus[] = ['PROPOSED', 'BACKLOG', 'READY', 'IN_PROGRESS', 'VERIFICATION', 'VERIFIED', 'APPROVED', 'RELEASED', 'DEFERRED'];
export const readinessText = (value: unknown, max = 160): value is string => typeof value === 'string' && !!value.trim() && value === value.trim() && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
export const readinessCommit = (value: unknown): value is string => typeof value === 'string' && /^([a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
export function isReleaseScopeContext(value: unknown): value is ReleaseScopeContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const scope = value as ReleaseScopeContext;
  return scope.version === 'LOCAL_RELEASE_SCOPE/1' && readinessText(scope.id) && scope.id.startsWith('RSC-') &&
    Number.isSafeInteger(scope.revision) && scope.revision >= 1 && readinessText(scope.targetRelease) &&
    Array.isArray(scope.workItemIds) && scope.workItemIds.length > 0 && scope.workItemIds.length <= 1000 &&
    scope.workItemIds.every(id => readinessText(id, 128)) && new Set(scope.workItemIds).size === scope.workItemIds.length &&
    readinessCommit(scope.commitSha) && readinessText(scope.buildRevision) && readinessText(scope.environment) &&
    readinessText(scope.updatedAt) && Number.isFinite(Date.parse(scope.updatedAt)) &&
    !!scope.updatedBy && readinessText(scope.updatedBy.identityId) && readinessText(scope.updatedBy.name) && scope.updatedBy.roleSource === 'LOCAL_SERVER_ROSTER';
}

function validObservation(value: LocalReleaseEvidenceObservation): boolean {
  if (!value || value.trust !== 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION' || value.trustedProductionEvidence !== false ||
    !Array.isArray(value.reviews) || !Array.isArray(value.eligibleSessionIds) ||
    value.eligibleSessionIds.some(id => !readinessText(id)) || new Set(value.eligibleSessionIds).size !== value.eligibleSessionIds.length) return false;
  const ids = new Set<string>();
  for (const review of value.reviews) {
    if (!review || !readinessText(review.sessionId) || ids.has(review.sessionId) || typeof review.eligible !== 'boolean' ||
      !Array.isArray(review.pendingRoles) || review.pendingRoles.some(role => typeof role !== 'string') ||
      review.trust !== value.trust || review.trustedProductionEvidence !== false ||
      review.eligible !== value.eligibleSessionIds.includes(review.sessionId) || (review.eligible && review.pendingRoles.length !== 0)) return false;
    ids.add(review.sessionId);
  }
  return value.eligibleSessionIds.every(id => ids.has(id));
}

/** No stored planning percentages or unscoped future tasks contribute to this view. */
export function releaseHealthProjection(project: ReadinessProject, workItems?: readonly WorkItem[], evidence?: readonly BoundReleaseEvidence[]): ReleaseHealthSummary {
  const counts = Object.fromEntries(READINESS_WORK_STATUSES.map(status => [status, 0])) as Record<WorkItemStatus, number>;
  const result: ReleaseHealthSummary = {
    version: 'LOCAL_RELEASE_HEALTH/1', status: 'Unavailable', reason: 'No valid current-release scope is configured.', scope: null,
    lifecycle: {status: 'Unavailable', counts, source: 'Current scoped WorkItem lifecycle records; lifecycle labels alone are not verification evidence.'},
    localEvidence: {status: 'Unavailable', reviewedWorkItemIds: [], reviewedCount: 0, total: null, percentage: null,
      formula: 'round(100 × locally reviewed scoped work items / scoped work items)', trust: 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION', reason: 'Current evidence observations have not been loaded.'},
    securityAssurance: {status: 'Unavailable', reason: 'Local review and task lifecycle do not establish verified production security controls.'},
    productionRelease: {status: 'Unavailable', reason: 'Requires separately authenticated production evidence and an independent human release decision.'},
  };
  const scope = project.readinessContext;
  if (!isReleaseScopeContext(scope) || scope.targetRelease !== project.targetRelease) return result;
  result.scope = {...scope, workItemIds: [...scope.workItemIds], count: scope.workItemIds.length};
  result.localEvidence.total = scope.workItemIds.length;
  if (!Array.isArray(workItems)) {result.reason = 'Scoped work data is unavailable.'; return result;}
  const scoped: WorkItem[] = [];
  for (const id of scope.workItemIds) {
    const matches = workItems.filter(item => item?.id === id);
    if (matches.length !== 1 || !READINESS_WORK_STATUSES.includes(matches[0].status)) {result.reason = 'Scope contains missing, ambiguous or unknown work data.'; return result;}
    scoped.push(matches[0]);
  }
  for (const item of scoped) counts[item.status]++;
  result.lifecycle.status = 'Available';
  if (!Array.isArray(evidence)) {result.reason = 'Evidence evaluation is unavailable.'; return result;}
  const reviewed: string[] = [];
  for (const item of scoped) {
    const rows = evidence.filter(row => row?.workItemId === item.id);
    if (rows.length !== 1 || rows[0].projectId !== project.id || rows[0].commitSha !== scope.commitSha ||
      rows[0].buildRevision !== scope.buildRevision || rows[0].environment !== scope.environment || !validObservation(rows[0].observation)) {
      result.reason = 'Current scope-bound evidence evaluation is unavailable or inconsistent.'; return result;
    }
    if (rows[0].observation.eligibleSessionIds.length) reviewed.push(item.id);
  }
  result.localEvidence = {...result.localEvidence, status: 'Available', reviewedWorkItemIds: reviewed, reviewedCount: reviewed.length,
    percentage: Math.round(100 * reviewed.length / scoped.length), reason: 'Server-revalidated local human attestations only; no production trust is inferred.'};
  result.status = reviewed.length === scoped.length ? 'Local evidence reviewed' : 'Local evidence pending';
  result.reason = result.localEvidence.reason;
  return result;
}
