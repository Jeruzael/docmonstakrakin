import type {Express, Request, Response} from 'express';
import type {ReviewerIdentity} from '../proposals/identity.ts';
import {evaluateReleaseGates, evaluateReleaseScope, type ProjectDataAccessor, type ReleaseEvaluationScope} from './releaseGateEvaluator.ts';
import {acquireGitHubCiObservation, GITHUB_CI_POLICY, isAcquiredGitHubCiObservation, type GitHubCiObservation} from './githubCiAcquisition.ts';

export const GITHUB_CI_ROUTE_LIMITS = Object.freeze({inFlight: 1, acquisitionGapMs: 10000, cacheEntries: 128, cacheTtlMs: 300000});
// Process-wide acquisition budget, including separate router registrations.
let inFlight = false;
let lastAcquisitionStart: number | undefined;
const cache = new Map<string, GitHubCiObservation>();
const scopeKey = (scope: ReleaseEvaluationScope) => JSON.stringify(scope);
const observationKey = (scope: ReleaseEvaluationScope, runId: number) => `${runId}:${scopeKey(scope)}`;
function fresh(observation: unknown, now: number): observation is GitHubCiObservation {
  if (!isAcquiredGitHubCiObservation(observation)) return false;
  const age = now - Date.parse(observation.observedAt);
  return Number.isFinite(age) && age >= 0 && age <= GITHUB_CI_ROUTE_LIMITS.cacheTtlMs;
}
function purge(now: number) {for (const [key, observation] of cache) if (!fresh(observation, now)) cache.delete(key);}
const responseStatus = (observation: GitHubCiObservation) => observation.status === 'UNAVAILABLE' ? 503 : observation.status === 'REJECTED' ? 422 : 200;

/** Register after the parent's authenticated project READ policy. This route
 * also requires its trusted human-session resolver; it grants no release power. */
export function registerGitHubCiRoutes(app: Express, store: ProjectDataAccessor,
  requireHuman: (req: Request, res: Response) => ReviewerIdentity | undefined): {cachedObservation(projectId: string): GitHubCiObservation | undefined} {
  if (typeof requireHuman !== 'function') throw new Error('HUMAN_SESSION_RESOLVER_REQUIRED');
  function cachedObservation(projectId: string): GitHubCiObservation | undefined {
    const now = Date.now(); purge(now);
    if (projectId !== GITHUB_CI_POLICY.projectId) return;
    const current = evaluateReleaseScope(store, projectId); if (current.status !== 'BOUND' || !current.scope) return;
    for (const observation of [...cache.values()].reverse())
      if (fresh(observation, now) && scopeKey(observation.scope) === scopeKey(current.scope)) return observation;
  }
  app.get('/api/projects/:id/release/ci', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const identity = requireHuman(req, res);
      if (!identity) {if (!res.headersSent) res.status(403).json({error: 'HUMAN_SESSION_REQUIRED'}); return;}
      if (identity.kind !== 'HUMAN' || identity.roleSource !== 'LOCAL_SERVER_ROSTER') {res.status(403).json({error: 'HUMAN_SESSION_REQUIRED'}); return;}
      const rawRunId = req.query.runId;
      if (Object.keys(req.query).length !== 1 || typeof rawRunId !== 'string' || !/^[1-9]\d{0,15}$/.test(rawRunId) ||
        !Number.isSafeInteger(Number(rawRunId)) || Number(req.headers['content-length'] || 0) !== 0 || req.headers['transfer-encoding'] !== undefined ||
        req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length !== 0)) {
        res.status(400).json({error: 'CI_RUN_ID_REQUIRED', message: 'Supply only one positive integer runId query. URLs, credentials, commits and request bodies cannot select provider authority.'}); return;
      }
      const projectId = String(req.params.id), runId = Number(rawRunId);
      if (projectId !== GITHUB_CI_POLICY.projectId) {res.status(403).json({error: 'CI_PROJECT_UNSUPPORTED'}); return;}
      const before = evaluateReleaseScope(store, projectId);
      if (before.status !== 'BOUND' || !before.scope) {res.status(412).json({error: 'CI_SCOPE_UNAVAILABLE', scope: before}); return;}
      const scope = before.scope, key = observationKey(scope, runId), now = Date.now(); purge(now);
      const cached = cache.get(key);
      if (fresh(cached, now)) {
        res.status(responseStatus(cached)).json({observation: cached, report: evaluateReleaseGates(store, projectId, {ciObservation: cached}), cache: {hit: true}}); return;
      }
      if (inFlight) {res.setHeader('Retry-After', '1'); res.status(429).json({error: 'CI_ACQUISITION_BUSY'}); return;}
      if (lastAcquisitionStart !== undefined && now - lastAcquisitionStart < GITHUB_CI_ROUTE_LIMITS.acquisitionGapMs) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((GITHUB_CI_ROUTE_LIMITS.acquisitionGapMs - (now - lastAcquisitionStart)) / 1000))));
        res.status(429).json({error: 'CI_ACQUISITION_RATE_LIMITED'}); return;
      }
      inFlight = true; lastAcquisitionStart = now;
      try {
        const observation = await acquireGitHubCiObservation({scope, runId});
        const after = evaluateReleaseScope(store, projectId);
        if (after.status !== 'BOUND' || !after.scope || scopeKey(after.scope) !== scopeKey(scope)) {
          res.status(409).json({error: 'CI_SCOPE_CHANGED', message: 'Reload the current release scope before acquiring CI observations.'}); return;
        }
        if (!fresh(observation, Date.now()) || observation.runId !== runId || scopeKey(observation.scope) !== scopeKey(scope)) {
          res.status(503).json({error: 'CI_ACQUISITION_UNAVAILABLE'}); return;
        }
        purge(Date.now()); cache.set(key, observation);
        while (cache.size > GITHUB_CI_ROUTE_LIMITS.cacheEntries) cache.delete(cache.keys().next().value!);
        res.status(responseStatus(observation)).json({observation, report: evaluateReleaseGates(store, projectId, {ciObservation: observation}), cache: {hit: false}});
      } finally {inFlight = false;}
    } catch {
      if (!res.headersSent) res.status(503).json({error: 'CI_ACQUISITION_UNAVAILABLE'});
    }
  });
  return {cachedObservation};
}
