import type {Project, WorkItemStatus} from './types';

export type ReleaseScopeInput = {
  targetRelease: string;
  workItemIds: string[];
  commitSha: string;
  buildRevision: string;
  environment: string;
};
export type ReleaseScopeContext = ReleaseScopeInput & {
  version: 'LOCAL_RELEASE_SCOPE/1';
  id: string;
  revision: number;
  updatedAt: string;
  updatedBy: {identityId: string; name: string; roleSource: 'LOCAL_SERVER_ROSTER'};
};
export type ReadinessProject = Project & {readinessContext?: ReleaseScopeContext};
export type ProjectReadinessRequest = {
  expectedStateVersion: number;
  maturity: NonNullable<Project['maturity']>;
  sourceControl: string;
  /** Omitted scope preserves the existing scope and permits setup before work exists. */
  scope?: ReleaseScopeInput;
};

/** Structural adapter for the server's independently revalidated evidence helper. */
export type LocalReleaseEvidenceObservation = {
  reviews: {sessionId: string; eligible: boolean; reason: string; pendingRoles: string[];
    trust: 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION'; trustedProductionEvidence: false}[];
  eligibleSessionIds: string[];
  trust: 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION';
  trustedProductionEvidence: false;
};
export type BoundReleaseEvidence = Omit<ReleaseScopeInput, 'targetRelease' | 'workItemIds'> & {
  projectId: string;
  workItemId: string;
  observation: LocalReleaseEvidenceObservation;
};
export type ReleaseHealthSummary = {
  version: 'LOCAL_RELEASE_HEALTH/1';
  status: 'Unavailable' | 'Local evidence pending' | 'Local evidence reviewed';
  reason: string;
  scope: (ReleaseScopeContext & {count: number}) | null;
  lifecycle: {status: 'Available' | 'Unavailable'; counts: Record<WorkItemStatus, number>; source: string};
  localEvidence: {status: 'Available' | 'Unavailable'; reviewedWorkItemIds: string[]; reviewedCount: number;
    total: number | null; percentage: number | null; formula: string;
    trust: 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION'; reason: string};
  securityAssurance: {status: 'Unavailable'; reason: string};
  productionRelease: {status: 'Unavailable'; reason: string};
};
export type ProjectReadinessResponse = {
  projectId: string;
  stateVersion: number;
  maturity: Project['maturity'] | null;
  sourceControl: string | null;
  targetRelease: string;
  readinessContext: ReleaseScopeContext | null;
  workItems: {id: string; title: string; status: WorkItemStatus}[];
  summary: ReleaseHealthSummary;
};
