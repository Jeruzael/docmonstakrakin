import type {Express, Request, Response} from 'express';
import type {ProjectStore} from '../projectStore';
import type {ReviewerIdentity} from '../proposals/identity';
import {isWorkspaceIdentity} from '../security/workspaceAccess/identity.ts';
import type {WorkItem} from '../../src/types';
import type {BoundReleaseEvidence, LocalReleaseEvidenceObservation, ProjectReadinessResponse, ReadinessProject} from '../../src/releaseScopeTypes';
import {releaseHealthProjection, isReleaseScopeContext, readinessText} from '../../src/data/releaseHealthProjection';
import {normalizeTechChoice} from '../../src/data/projectInitialization';
import {ReadinessError, readinessProject, updateReadiness} from './service';

export type ReadinessEvidenceResolver = (projectId: string, current: {workItemId: string; commitSha: string; buildRevision: string; environment: string}) => LocalReleaseEvidenceObservation | Promise<LocalReleaseEvidenceObservation>;

/** Register after route policy and installProjectPersistence; no direct disk/provider authority. */
export function registerProjectReadinessRoutes(app: Express, store: ProjectStore, requireHuman: (req: Request, res: Response) => ReviewerIdentity | undefined, evidenceResolver?: ReadinessEvidenceResolver) {
  const authorize = (req: Request, res: Response) => {
    const identity = requireHuman(req, res);
    if (!identity) return;
    if (identity.kind !== 'HUMAN' || identity.roleSource !== 'LOCAL_SERVER_ROSTER' || !readinessText(identity.id) || !readinessText(identity.name) ||
      !Array.isArray(identity.roles) || (!isWorkspaceIdentity(identity)&&!identity.roles.some(role => ['Security Officer', 'Lead Architect'].includes(role)))) {
      res.status(403).json({error: 'Configured human governance authority is required'}); return;
    }
    return identity;
  };
  function response(project: ReadinessProject, items: WorkItem[] | undefined, evidence?: BoundReleaseEvidence[]): ProjectReadinessResponse {
    const scope = project.readinessContext;
    let sourceControl: string | null = null;
    try {sourceControl = normalizeTechChoice(project.technicalBaseline?.sourceControl).finalSelection || null;} catch { /* malformed setup is an unknown observation */ }
    return {projectId: project.id, stateVersion: project.stateVersion, maturity: project.maturity || null, sourceControl, targetRelease: project.targetRelease,
      readinessContext: isReleaseScopeContext(scope) ? structuredClone(scope) : null,
      workItems: Array.isArray(items) ? items.map(({id, title, status}) => ({id, title, status})) : [],
      summary: releaseHealthProjection(project, items, evidence)};
  }
  const error = (res: Response, cause: unknown) => res.status(cause instanceof ReadinessError ? cause.status : 500).json({error: cause instanceof ReadinessError ? cause.message : 'Readiness operation could not be completed'});
  app.get('/api/projects/:id/readiness', async (req, res) => {
    if (!authorize(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const id = String(req.params.id);
      const snapshot = structuredClone({project: readinessProject(store, id), items: store.workItems[id]});
      let evidence: BoundReleaseEvidence[] | undefined;
      const scope = snapshot.project.readinessContext;
      if (evidenceResolver && isReleaseScopeContext(scope) && scope.targetRelease === snapshot.project.targetRelease) {
        try {
          evidence = await Promise.all(scope.workItemIds.map(async workItemId => ({projectId: id, workItemId, commitSha: scope.commitSha,
            buildRevision: scope.buildRevision, environment: scope.environment,
            observation: await evidenceResolver(id, {workItemId, commitSha: scope.commitSha, buildRevision: scope.buildRevision, environment: scope.environment})})));
        } catch {evidence = undefined;}
      }
      if (JSON.stringify(snapshot) !== JSON.stringify({project: readinessProject(store, id), items: store.workItems[id]})) throw new ReadinessError(409, 'PROJECT_STATE_STALE: reload readiness after the current change');
      res.json(response(snapshot.project, snapshot.items, evidence));
    } catch (cause) {error(res, cause);}
  });
  app.post('/api/projects/:id/readiness', (req, res) => {
    const identity = authorize(req, res); if (!identity) return;
    if (res.locals.projectPersistenceMode !== 'MUTATING') return res.status(503).json({error: 'Transactional project persistence is required for readiness updates'});
    // Keep mutation + audit + persistence response in one synchronous turn.
    // Evidence is evaluated on a separate GET after the committed acknowledgement.
    try {const project = updateReadiness(store, String(req.params.id), req.body, identity); res.json(response(project, store.workItems[project.id]));} catch (cause) {error(res, cause);}
  });
}
