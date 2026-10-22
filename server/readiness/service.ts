import {randomUUID} from 'node:crypto';
import type {ProjectStore} from '../projectStore';
import type {ReviewerIdentity} from '../proposals/identity';
import type {TechChoice} from '../../src/types';
import type {ProjectReadinessRequest, ReadinessProject, ReleaseScopeInput} from '../../src/releaseScopeTypes';
import {isReleaseScopeContext, readinessCommit, readinessText} from '../../src/data/releaseHealthProjection';
import {normalizeTechChoice, normalizeTechnicalBaseline} from '../../src/data/projectInitialization';
import {SELF_BOOTSTRAP_DEFAULT_PROJECT_ID} from '../../src/data/selfBootstrapContract';

export class ReadinessError extends Error {constructor(readonly status: number, message: string) {super(message);}}
const fail = (status: number, message: string): never => {throw new ReadinessError(status, message);};
function shape(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail(422, 'Invalid readiness payload or unsupported fields');
}
export function readinessProject(store: ProjectStore, id: string): ReadinessProject {
  if (id === SELF_BOOTSTRAP_DEFAULT_PROJECT_ID) fail(403, 'Canonical self-project readiness is managed by its separate controlled workflow');
  const projects = store.projects.filter(project => project.id === id);
  if (projects.length !== 1) fail(projects.length ? 409 : 404, 'Project data is missing or ambiguous');
  return projects[0] as ReadinessProject;
}
export function updateReadiness(store: ProjectStore, id: string, input: unknown, identity: ReviewerIdentity): ReadinessProject {
  const project = readinessProject(store, id);
  shape(input, ['expectedStateVersion', 'maturity', 'sourceControl', 'scope']);
  if (!Number.isSafeInteger(input.expectedStateVersion) || Number(input.expectedStateVersion) < 0) fail(422, 'expectedStateVersion is required');
  if (!Number.isSafeInteger(project.stateVersion) || project.stateVersion < 0 || project.stateVersion >= Number.MAX_SAFE_INTEGER || project.stateVersion !== input.expectedStateVersion) fail(409, 'PROJECT_STATE_STALE: reload readiness and review the current project');
  if (typeof input.maturity !== 'string' || !['GREENFIELD', 'EXISTING_PROJECT', 'MIGRATION', 'EXTENSION'].includes(input.maturity)) fail(422, 'Select a valid project maturity');
  if (!readinessText(input.sourceControl)) fail(422, 'Source-control selection is required');
  let sourceControl: TechChoice;
  try {sourceControl = normalizeTechChoice({type: 'USER_SPECIFIED', userValue: input.sourceControl as string});}
  catch {fail(422, 'Source-control selection contains unresolved or invalid text');}
  let scope: ReleaseScopeInput | undefined;
  if (Object.hasOwn(input, 'scope')) {
    shape(input.scope, ['targetRelease', 'workItemIds', 'commitSha', 'buildRevision', 'environment']);
    const value = input.scope;
    if (!readinessText(value.targetRelease) || value.targetRelease !== project.targetRelease) fail(422, 'Scope must bind the current project target release');
    if (!Array.isArray(value.workItemIds) || value.workItemIds.length === 0 || value.workItemIds.length > 1000 ||
      value.workItemIds.some(item => !readinessText(item, 128)) || new Set(value.workItemIds).size !== value.workItemIds.length) fail(422, 'Select unique nonempty current-release work item IDs');
    const items = store.workItems[id];
    if (!Array.isArray(items)) fail(409, 'Project work data is unavailable');
    const workItemIds = value.workItemIds as string[];
    for (const workId of workItemIds) if (items.filter(item => item.id === workId).length !== 1) fail(422, 'Scope contains unknown or ambiguous work item IDs in this project');
    if (!readinessCommit(value.commitSha) || !readinessText(value.buildRevision) || !readinessText(value.environment)) fail(422, 'An exact full lowercase commit SHA, build revision and environment are required');
    scope = {targetRelease: value.targetRelease as string, workItemIds: [...workItemIds], commitSha: value.commitSha as string, buildRevision: value.buildRevision as string, environment: value.environment as string};
  }
  if (project.readinessContext !== undefined && (!isReleaseScopeContext(project.readinessContext) || project.readinessContext.revision >= Number.MAX_SAFE_INTEGER)) fail(409, 'Stored readiness context requires separate recovery');
  const timestamp = new Date().toISOString();
  project.maturity = input.maturity as ProjectReadinessRequest['maturity'];
  project.technicalBaseline = {...(project.technicalBaseline || normalizeTechnicalBaseline()), sourceControl};
  if (scope) project.readinessContext = {...scope, version: 'LOCAL_RELEASE_SCOPE/1', id: project.readinessContext?.id || `RSC-${randomUUID()}`,
    revision: (project.readinessContext?.revision || 0) + 1, updatedAt: timestamp,
    updatedBy: {identityId: identity.id, name: identity.name, roleSource: 'LOCAL_SERVER_ROSTER'}};
  project.stateVersion++;
  project.updatedAt = timestamp;
  store.addAuditEvent(id, identity.name, 'PROJECT_READINESS_CONTEXT_UPDATED', project.readinessContext?.id || id,
    'Local planning context only; no approval or release authority is granted',
    {authenticatedIdentity: identity.id, roleSource: identity.roleSource, scopeRevision: project.readinessContext?.revision ?? null, scopeChanged: !!scope});
  return project;
}
