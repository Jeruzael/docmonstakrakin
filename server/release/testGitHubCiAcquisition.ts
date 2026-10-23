import assert from 'node:assert/strict';
import {acquireGitHubCiObservation, isAcquiredGitHubCiObservation, GITHUB_CI_POLICY} from './githubCiAcquisition.ts';
import type {ReleaseEvaluationScope} from './releaseEvidenceTypes.ts';
import {evaluateReleaseGates, type ProjectDataAccessor} from './releaseGateEvaluator.ts';
import {INITIAL_PROJECTS, INITIAL_WORK_ITEMS} from '../../src/data/initialData.ts';

const runId = 39721949800;
const scope: ReleaseEvaluationScope = {projectId: 'PRJ-DOCMONSTAKRAKIN', targetRelease: 'fixture-release',
  scopeId: 'RSC-FIXTURE', scopeRevision: 1, workItemIds: ['DMK-159'], environment: 'CI', buildRevision: 'fixture-build',
  commitSha: '7c20c82856bd7a3be2d97d8f1bb6c59fe3459732'};
const runUrl = `https://api.github.com/repos/Jeruzael/docmonstakrakin/actions/runs/${runId}`;
function payloads() {
  return [{id: runId, workflow_id: 372946294, name: 'CI', path: '.github/workflows/ci.yml', head_sha: scope.commitSha,
    run_attempt: 1, status: 'completed', conclusion: 'success', updated_at: new Date(Date.now() - 60000).toISOString(),
    repository: {full_name: 'Jeruzael/docmonstakrakin'}, head_repository: {full_name: 'Jeruzael/docmonstakrakin'}},
  {total_count: 4, jobs: ['Windows Native Qualification', 'Quality & Build', 'Controlled Docs', 'Complete Regression'].map((name, index) => ({
    id: index + 1, run_id: runId, run_attempt: 1, head_sha: scope.commitSha, name, workflow_name: 'CI',
    status: 'completed', conclusion: 'success', run_url: runUrl,
    started_at: new Date(Date.now() - 120000).toISOString(), completed_at: new Date(Date.now() - 90000).toISOString(),
  }))}];
}
const originalFetch = globalThis.fetch;
let passed = 0, failed = 0;
async function test(name: string, run: () => Promise<void>) {
  try {await run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);}
  finally {globalThis.fetch = originalFetch;}
}
async function acquire(bodies = payloads(), response?: (index: number) => Response) {
  const requests: {url: string; init?: RequestInit}[] = [];
  globalThis.fetch = (async (url, init) => {
    requests.push({url: String(url), init});
    return response ? response(requests.length - 1) : new Response(JSON.stringify(bodies[requests.length - 1]), {headers: {'content-type': 'application/json'}});
  }) as typeof fetch;
  const observation = await acquireGitHubCiObservation({scope, runId});
  return {observation, requests};
}
function releaseStore(bound: ReleaseEvaluationScope = scope): ProjectDataAccessor {
  return {projects: [{...structuredClone(INITIAL_PROJECTS[0]), id: bound.projectId, targetRelease: bound.targetRelease,
    readinessContext: {version: 'LOCAL_RELEASE_SCOPE/1', id: bound.scopeId, revision: bound.scopeRevision,
      targetRelease: bound.targetRelease, commitSha: bound.commitSha, buildRevision: bound.buildRevision,
      environment: bound.environment, workItemIds: [...bound.workItemIds], updatedAt: '2026-10-22T00:00:00Z',
      updatedBy: {identityId: 'INERT', name: 'Inert fixture', roleSource: 'LOCAL_SERVER_ROSTER'}}}],
    questions: {[bound.projectId]: []}, requirements: {[bound.projectId]: []}, approvals: {[bound.projectId]: []}, auditLogs: {[bound.projectId]: []},
    workItems: {[bound.projectId]: bound.workItemIds.map(id => ({...structuredClone(INITIAL_WORK_ITEMS[0]), id, status: 'VERIFIED'}))}};
}
await test('CI1 fixed GitHub run and exact-attempt jobs establish only branded technical success', async () => {
  const {observation, requests} = await acquire();
  assert.equal(observation.status, 'OBSERVED_SUCCESS'); assert.equal(observation.trustedProductionEvidence, false);
  assert.equal(observation.humanAuthorization, false); assert.equal(observation.run?.jobs.length, 4);
  assert(isAcquiredGitHubCiObservation(observation)); assert(!isAcquiredGitHubCiObservation(structuredClone(observation)));
  assert.deepEqual(requests.map(request => request.url), [runUrl, `${runUrl}/attempts/1/jobs?per_page=100`]);
  for (const request of requests) {assert.equal(request.init?.redirect, 'error'); assert.equal(request.init?.method, 'GET');
    assert(!new Headers(request.init?.headers).has('authorization')); assert(request.init?.signal);}
  assert.deepEqual(observation.scope, scope);
});
await test('CI2 ordinary projects malformed run IDs and missing exact scope are rejected before network', async () => {
  let requests = 0; globalThis.fetch = (async () => {requests++; throw new Error('Must not request');}) as typeof fetch;
  for (const candidate of [{...scope, projectId: 'PRJ-ATLAS-01'}, {...scope, commitSha: 'short'}, {...scope, workItemIds: []},
    {...scope, workItemIds: ['DMK-159', 'DMK-159']}, {...scope, scopeRevision: 0}]) {
    assert.equal((await acquireGitHubCiObservation({scope: candidate, runId})).status, 'REJECTED');
  }
  for (const id of [-1, 0, 1.5, NaN, 'https://evil.invalid' as any])
    assert.equal((await acquireGitHubCiObservation({scope, runId: id})).status, 'REJECTED');
  assert.equal(requests, 0);
});
await test('CI3 mismatched repository head workflow run and non-success conclusions cannot borrow success', async () => {
  const mutations: Record<string, unknown>[] = [{id: runId + 1}, {workflow_id: 1}, {name: 'Other'}, {path: '.github/workflows/evil.yml'},
    {head_sha: 'a'.repeat(40)}, {repository: {full_name: 'Other/repo'}}, {head_repository: {full_name: 'Other/fork'}},
    {run_attempt: 0}, {updated_at: 'bad'}, {updated_at: new Date(Date.now() - 8 * 86400000).toISOString()},
    {updated_at: new Date(Date.now() + 86400000).toISOString()}];
  for (const mutation of mutations) {const bodies = payloads(); Object.assign(bodies[0], mutation);
    assert.equal((await acquire(bodies)).observation.status, 'REJECTED', JSON.stringify(mutation));}
  for (const conclusion of ['failure', 'cancelled', 'neutral', 'skipped', 'timed_out', null]) {
    const bodies = payloads(); Object.assign(bodies[0], {conclusion});
    assert.notEqual((await acquire(bodies)).observation.status, 'OBSERVED_SUCCESS');
  }
});
await test('CI4 every required job must occur exactly once in a complete exact-attempt all-success set', async () => {
  const mutations: Array<(body: any) => void> = [body => body.jobs.pop(), body => {body.total_count = 5;},
    body => {body.jobs[1].name = body.jobs[0].name;}, body => {body.jobs[1].id = body.jobs[0].id;},
    body => {body.jobs[0].head_sha = 'b'.repeat(40);}, body => {body.jobs[0].run_id++;},
    body => {body.jobs[0].run_attempt = 2;}, body => {body.jobs[0].run_url = 'https://evil.invalid';},
    body => {body.jobs[0].status = 'in_progress';}, body => {body.jobs[0].conclusion = 'skipped';},
    body => {body.jobs[0].workflow_name = 'Other';}, body => {body.jobs[0].completed_at = 'bad';}];
  for (const mutate of mutations) {const bodies = payloads(); mutate(bodies[1]);
    assert.notEqual((await acquire(bodies)).observation.status, 'OBSERVED_SUCCESS');}
  const extra = payloads(); (extra[1] as any).jobs.push({...structuredClone((extra[1] as any).jobs[0]), id: 99, name: 'Extra failing job', conclusion: 'failure'});
  (extra[1] as any).total_count = 5; assert.notEqual((await acquire(extra)).observation.status, 'OBSERVED_SUCCESS');
});
await test('CI5 HTTP errors redirects nonJSON pagination excessive bodies and network errors stay unavailable', async () => {
  const responses = [() => new Response('{}', {status: 429}), () => new Response('{}', {status: 302}),
    () => new Response('{}', {headers: {'content-type': 'text/html'}}),
    () => new Response('{}', {headers: {'content-type': 'application/json', link: '<https://evil.invalid>; rel="next"'}}),
    () => new Response('x'.repeat(GITHUB_CI_POLICY.maxBodyBytes + 1), {headers: {'content-type': 'application/json'}}),
    () => new Response('{invalid', {headers: {'content-type': 'application/json'}})];
  for (const response of responses) assert.equal((await acquire(payloads(), response)).observation.status, 'UNAVAILABLE');
  globalThis.fetch = (async () => {throw new Error('network fixture');}) as typeof fetch;
  assert.equal((await acquireGitHubCiObservation({scope, runId})).status, 'UNAVAILABLE');
});
await test('CI6 successful CI remains technical and imported or scope-rebound observations cannot establish it', async () => {
  const {observation} = await acquire(); const input = releaseStore();
  const value = evaluateReleaseGates(input, scope.projectId, {ciObservation: observation});
  assert.equal(value.ciObservation?.status, 'OBSERVED_SUCCESS'); assert.equal(value.gates[3].localCheck.status, 'SATISFIED');
  assert.equal(value.gates[3].status, 'PENDING'); assert.equal(value.productionEvidence.status, 'UNAVAILABLE');
  assert.equal(value.signedOff, false); assert.equal(value.releaseReady, false); assert.equal(value.capabilitiesSummary.verified, 0);
  const imported = evaluateReleaseGates(input, scope.projectId, {ciObservation: structuredClone(observation)});
  assert.equal(imported.ciObservation, undefined); assert(imported.ciObservationRejection);
  const changes = [{targetRelease: 'other'}, {commitSha: 'b'.repeat(40)}, {buildRevision: 'other'}, {environment: 'other'},
    {scopeId: 'RSC-OTHER'}, {scopeRevision: 2}, {workItemIds: ['DMK-159', 'DMK-017']}, {projectId: 'PRJ-OTHER'}];
  for (const change of changes) {const bound = {...scope, ...change};
    const rebound = evaluateReleaseGates(releaseStore(bound), bound.projectId, {ciObservation: observation});
    assert.equal(rebound.ciObservation, undefined); assert(rebound.ciObservationRejection); assert(!rebound.releaseReady);}
});
await test('CI7 acquired failing CI stays failed despite stored VERIFIED labels', async () => {
  const bodies = payloads(); (bodies[1] as any).jobs[0].conclusion = 'failure';
  const {observation} = await acquire(bodies);
  assert.equal(observation.status, 'FAILED');
  const value = evaluateReleaseGates(releaseStore(), scope.projectId, {ciObservation: observation});
  assert.equal(value.gates[3].status, 'FAILED'); assert.equal(value.gates[3].localCheck.status, 'FAILED');
  assert.equal(value.signedOff, false); assert.equal(value.releaseReady, false);
});
await test('CI8 observations are immutable and stale same-process observations cannot be reused', async () => {
  const {observation} = await acquire();
  assert(Object.isFrozen(observation)); assert(Object.isFrozen(observation.scope.workItemIds)); assert(Object.isFrozen(observation.run!.jobs));
  const originalNow = Date.now;
  try {Date.now = () => Date.parse(observation.observedAt) + 300001;
    const expired = evaluateReleaseGates(releaseStore(), scope.projectId, {ciObservation: observation});
    assert.equal(expired.ciObservation, undefined); assert(expired.ciObservationRejection);
  } finally {Date.now = originalNow;}
});
await test('CI9 acquisition copies scope before IO and ignores caller URL token and provider claims', async () => {
  const copiedScope = structuredClone(scope); const bodies = payloads(); const urls: string[] = [];
  let complete!: (response: Response) => void;
  globalThis.fetch = (async (url, init) => {
    urls.push(String(url)); assert(!new Headers(init?.headers).has('authorization'));
    if (urls.length === 1) return await new Promise<Response>(resolve => {complete = resolve;});
    return new Response(JSON.stringify(bodies[1]), {headers: {'content-type': 'application/json'}});
  }) as typeof fetch;
  const pending = acquireGitHubCiObservation({scope: copiedScope, runId, url: 'https://evil.invalid', token: 'INERT', provider: 'TRUSTED'} as any);
  copiedScope.commitSha = 'b'.repeat(40); copiedScope.projectId = 'PRJ-OTHER';
  complete(new Response(JSON.stringify(bodies[0]), {headers: {'content-type': 'application/json'}}));
  const observation = await pending;
  assert.equal(observation.status, 'OBSERVED_SUCCESS'); assert.deepEqual(observation.scope, scope);
  assert.deepEqual(urls, [runUrl, `${runUrl}/attempts/1/jobs?per_page=100`]);
});
await test('CI10 the total acquisition deadline aborts a stalled public request', async () => {
  let aborted = false;
  globalThis.fetch = (async (_url, init) => await new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {aborted = true; reject(new Error('Aborted fixture'));}, {once: true});
  })) as typeof fetch;
  const started = Date.now(), observation = await acquireGitHubCiObservation({scope, runId});
  assert.equal(observation.status, 'UNAVAILABLE'); assert.equal(aborted, true);
  assert(Date.now() - started < GITHUB_CI_POLICY.timeoutMs + 1500);
});
await test('CI11 fresh run metadata cannot refresh stale job execution timestamps', async () => {
  const bodies = payloads(), old = new Date(Date.now() - 8 * 86400000).toISOString();
  Object.assign((bodies[1] as any).jobs[0], {started_at: old, completed_at: old});
  assert.equal((await acquire(bodies)).observation.status, 'REJECTED');
});
console.log(`GitHub CI acquisition: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
