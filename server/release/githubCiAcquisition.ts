import type {ReleaseEvaluationScope} from './releaseEvidenceTypes.ts';
import {readinessCommit, readinessText} from '../../src/data/releaseHealthProjection.ts';

export const GITHUB_CI_POLICY = Object.freeze({
  projectId: 'PRJ-DOCMONSTAKRAKIN', owner: 'Jeruzael', repository: 'docmonstakrakin', workflowId: 372946294,
  workflowPath: '.github/workflows/ci.yml', workflowName: 'CI',
  requiredJobNames: Object.freeze(['Windows Native Qualification', 'Quality & Build', 'Controlled Docs', 'Complete Regression']),
  maxBodyBytes: 262144, maxJobs: 100, timeoutMs: 8000, maxAgeMs: 7 * 24 * 60 * 60 * 1000, observationMaxAgeMs: 300000,
});
export type GitHubCiAcquisitionRequest = {scope: ReleaseEvaluationScope; runId: number};
export type GitHubCiObservation = {
  version: 'GITHUB_CI_OBSERVATION/1';
  status: 'OBSERVED_SUCCESS' | 'FAILED' | 'UNAVAILABLE' | 'REJECTED';
  provider: 'GITHUB_PUBLIC_ACTIONS_API';
  trustedProductionEvidence: false;
  humanAuthorization: false;
  scope: ReleaseEvaluationScope;
  runId: number;
  observedAt: string;
  reason: string;
  run?: {workflowId: number; attempt: number; headSha: string; updatedAt: string;
    jobs: {id: number; name: string; conclusion: 'success'}[]};
};
const acquiredObservations = new WeakSet<object>();
export function isAcquiredGitHubCiObservation(value: unknown): value is GitHubCiObservation {
  return !!value && typeof value === 'object' && acquiredObservations.has(value);
}
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
function validScope(value: unknown): value is ReleaseEvaluationScope {
  if (!record(value)) return false;
  return value.projectId === GITHUB_CI_POLICY.projectId && readinessText(value.targetRelease) &&
    readinessText(value.scopeId) && value.scopeId.startsWith('RSC-') && positiveId(value.scopeRevision) &&
    readinessCommit(value.commitSha) && readinessText(value.buildRevision) && readinessText(value.environment) &&
    Array.isArray(value.workItemIds) && value.workItemIds.length > 0 && value.workItemIds.length <= 1000 &&
    value.workItemIds.every(id => readinessText(id, 128)) && new Set(value.workItemIds).size === value.workItemIds.length;
}
function immutableObservation(value: GitHubCiObservation): GitHubCiObservation {
  Object.freeze(value.scope.workItemIds); Object.freeze(value.scope);
  if (value.run) {value.run.jobs.forEach(Object.freeze); Object.freeze(value.run.jobs); Object.freeze(value.run);}
  Object.freeze(value); acquiredObservations.add(value); return value;
}
async function boundedJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {method: 'GET', redirect: 'error', signal, credentials: 'omit',
    headers: {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'docmonstakrakin-readonly-ci-observer'}});
  if (response.status !== 200 || response.redirected || (response.url && response.url !== url) ||
    !/^application\/(?:vnd\.github\+)?json(?:;|$)/i.test(response.headers.get('content-type') || '') ||
    /rel\s*=\s*"?next\b/i.test(response.headers.get('link') || '')) throw new Error('Unavailable HTTP response');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > GITHUB_CI_POLICY.maxBodyBytes)) throw new Error('Body limit');
  if (!response.body) throw new Error('Missing response body');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > GITHUB_CI_POLICY.maxBodyBytes) throw new Error('Body limit');
      chunks.push(chunk.value);
    }
  } catch (error) {await reader.cancel().catch(() => {}); throw error;}
  finally {reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Acquires two bounded public API responses. Returned metadata is a current
 * GitHub/HTTPS observation, never production evidence or reviewer authority. */
export async function acquireGitHubCiObservation(request: GitHubCiAcquisitionRequest): Promise<GitHubCiObservation> {
  const now = Date.now();
  // Copy before asynchronous IO; subsequent caller edits cannot rebind a result.
  const scope = structuredClone(request?.scope);
  const runId = request?.runId;
  const result = (status: GitHubCiObservation['status'], reason: string, run?: GitHubCiObservation['run']) => immutableObservation({
    version: 'GITHUB_CI_OBSERVATION/1', status, provider: 'GITHUB_PUBLIC_ACTIONS_API', trustedProductionEvidence: false,
    humanAuthorization: false, scope, runId, observedAt: new Date(now).toISOString(), reason, ...(run ? {run} : {}),
  });
  if (!validScope(scope) || !positiveId(runId)) {
    // Invalid scopes are intentionally not branded. They may be malformed at an
    // untyped boundary, so do not attempt to freeze/dereference their members.
    return {version: 'GITHUB_CI_OBSERVATION/1', status: 'REJECTED', provider: 'GITHUB_PUBLIC_ACTIONS_API',
      trustedProductionEvidence: false, humanAuthorization: false, scope, runId,
      observedAt: new Date(now).toISOString(), reason: 'Only the server-pinned self project and a complete exact scope with a positive integer run ID are accepted.'};
  }
  const base = `https://api.github.com/repos/${GITHUB_CI_POLICY.owner}/${GITHUB_CI_POLICY.repository}/actions/runs/${runId}`;
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {timer = setTimeout(() => {controller.abort(); reject(new Error('Acquisition deadline'));}, GITHUB_CI_POLICY.timeoutMs);});
  const acquire = async () => {
    const run = await boundedJson(base, controller.signal);
    if (!record(run) || run.id !== runId || run.workflow_id !== GITHUB_CI_POLICY.workflowId || run.name !== GITHUB_CI_POLICY.workflowName ||
      run.path !== GITHUB_CI_POLICY.workflowPath || run.head_sha !== scope.commitSha || !positiveId(run.run_attempt) ||
      run.repository?.full_name !== `${GITHUB_CI_POLICY.owner}/${GITHUB_CI_POLICY.repository}` ||
      run.head_repository?.full_name !== `${GITHUB_CI_POLICY.owner}/${GITHUB_CI_POLICY.repository}` ||
      typeof run.updated_at !== 'string' || !Number.isFinite(Date.parse(run.updated_at)) ||
      Date.parse(run.updated_at) > now + 60000 || now - Date.parse(run.updated_at) > GITHUB_CI_POLICY.maxAgeMs)
      return result('REJECTED', 'Run identity, workflow, repository, exact commit, attempt or timestamp does not satisfy the pinned CI policy.');
    if (run.status !== 'completed') return result('UNAVAILABLE', 'The exact CI run is not completed.');
    if (run.conclusion !== 'success') return result('FAILED', 'The exact completed CI run does not have a success conclusion.');
    const jobs = await boundedJson(`${base}/attempts/${run.run_attempt}/jobs?per_page=100`, controller.signal);
    if (!record(jobs) || !Array.isArray(jobs.jobs) || jobs.total_count !== jobs.jobs.length ||
      jobs.jobs.length !== GITHUB_CI_POLICY.requiredJobNames.length || jobs.jobs.length > GITHUB_CI_POLICY.maxJobs)
      return result('REJECTED', 'The complete pinned job set was not returned; partial or expanded sets cannot establish this observation.');
    const ids = new Set<number>(), names = new Set<string>();
    for (const job of jobs.jobs) {
      if (!record(job) || !positiveId(job.id) || ids.has(job.id) || typeof job.name !== 'string' || names.has(job.name) ||
        !GITHUB_CI_POLICY.requiredJobNames.includes(job.name) || job.run_id !== runId || job.run_attempt !== run.run_attempt ||
        job.head_sha !== scope.commitSha || job.run_url !== base || job.workflow_name !== GITHUB_CI_POLICY.workflowName ||
        typeof job.started_at !== 'string' || typeof job.completed_at !== 'string' ||
        !Number.isFinite(Date.parse(job.started_at)) || !Number.isFinite(Date.parse(job.completed_at)) ||
        Date.parse(job.started_at) > Date.parse(job.completed_at) || Date.parse(job.completed_at) > now + 60000 ||
        Date.parse(job.completed_at) > Date.parse(run.updated_at) + 60000 || now - Date.parse(job.completed_at) > GITHUB_CI_POLICY.maxAgeMs)
        return result('REJECTED', 'A job has missing, duplicate, mismatched or invalid exact-run metadata.');
      if (job.status !== 'completed' || job.conclusion !== 'success') return result('FAILED', 'Every pinned CI job must be completed with a success conclusion.');
      ids.add(job.id); names.add(job.name);
    }
    return result('OBSERVED_SUCCESS', 'The public GitHub API reported this exact commit and attempt with all four pinned jobs successful. This is technical CI observation only; build/environment/task scope are local bindings, not GitHub attestations.',
      {workflowId: run.workflow_id, attempt: run.run_attempt, headSha: run.head_sha, updatedAt: run.updated_at,
        jobs: jobs.jobs.map(job => ({id: job.id, name: job.name, conclusion: 'success'}))});
  };
  try {return await Promise.race([acquire(), timeout]);}
  catch {return result('UNAVAILABLE', 'Public GitHub CI acquisition failed an HTTP, redirect, JSON, resource or time bound; no successful observation was established.');}
  finally {clearTimeout(timer!); controller.abort();}
}
