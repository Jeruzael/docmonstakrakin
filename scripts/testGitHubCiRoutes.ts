import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {registerGitHubCiRoutes} from '../server/release/githubCiRoutes.ts';
import {isAcquiredGitHubCiObservation} from '../server/release/githubCiAcquisition.ts';
import {INITIAL_PROJECTS, INITIAL_WORK_ITEMS} from '../src/data/initialData.ts';
import type {ProjectDataAccessor} from '../server/release/releaseGateEvaluator.ts';
import type {ReviewerIdentity} from '../server/proposals/identity.ts';

// Real router and adapter, inert HTTP/identity/provider fixtures. No authority
// store, real credentials, GitHub network, audit write or human approval exists.
const projectId = 'PRJ-DOCMONSTAKRAKIN', commitSha = '7c20c82856bd7a3be2d97d8f1bb6c59fe3459732';
const originalFetch = globalThis.fetch, originalNow = Date.now;
let now = originalNow(), sequence = 0, passed = 0, failed = 0;
Date.now = () => now;
const headers = {'x-fixture-human': 'human', 'x-fixture-project-read': 'allowed'};
function store(): ProjectDataAccessor {
  const scopeId = `RSC-CI-HTTP-${++sequence}`;
  return {projects: [{...structuredClone(INITIAL_PROJECTS[0]), id: projectId, targetRelease: 'inert-fixture',
    readinessContext: {version: 'LOCAL_RELEASE_SCOPE/1', id: scopeId, revision: 1, targetRelease: 'inert-fixture',
      workItemIds: ['DMK-159'], commitSha, buildRevision: 'fixture-build', environment: 'DISCONNECTED_TEST',
      updatedAt: '2026-10-22T00:00:00Z', updatedBy: {identityId: 'INERT', name: 'Inert fixture', roleSource: 'LOCAL_SERVER_ROSTER'}}}],
    questions: {[projectId]: []}, requirements: {[projectId]: []}, auditLogs: {[projectId]: []}, approvals: {[projectId]: []},
    workItems: {[projectId]: [{...structuredClone(INITIAL_WORK_ITEMS[0]), id: 'DMK-159', status: 'VERIFIED'}]}};
}
async function server(input = store()) {
  const app = express(); app.use(express.json({limit: '1kb'}));
  // Parent-owned project READ policy remains separate from the route's required
  // human-session check. This fixture proves the composition's order only.
  app.use('/api/projects/:id', (req, res, next) => {
    if (req.get('x-fixture-project-read') !== 'allowed') {res.status(403).json({error: 'FIXTURE_PROJECT_READ_DENIED'}); return;} next();
  });
  const ci = registerGitHubCiRoutes(app, input, (req, res) => {
    const kind = req.get('x-fixture-human');
    if (!kind) {res.status(401).json({error: 'FIXTURE_SESSION_REQUIRED'}); return;}
    return {id: 'INERT-IDENTITY', name: 'Inert identity fixture', kind: kind === 'agent' ? 'AGENT' : 'HUMAN',
      roleSource: 'LOCAL_SERVER_ROSTER', roles: ['Reader']} as ReviewerIdentity;
  });
  const listener = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => listener.once('listening', resolve));
  const request = (query: string, options: {headers?: Record<string, string>; body?: unknown; id?: string} = {}) => new Promise<{status: number; body: any; headers: http.IncomingHttpHeaders}>((resolve, reject) => {
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = http.request({hostname: '127.0.0.1', port: (listener.address() as any).port, method: 'GET', agent: false,
      path: `/api/projects/${options.id || projectId}/release/ci${query}`,
      headers: {...(options.headers ?? headers), ...(body ? {'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body))} : {})}}, response => {
      const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => {
        try {resolve({status: response.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()), headers: response.headers});} catch (error) {reject(error);}
      });
    }); req.on('error', reject); req.setTimeout(3000, () => req.destroy(new Error('HTTP fixture deadline'))); if (body) req.write(body); req.end();
  });
  return {input, ci, request, close: async () => {listener.closeAllConnections(); await new Promise<void>(resolve => listener.close(() => resolve()));}};
}
function response(url: string, conclusion = 'success') {
  const match = /\/actions\/runs\/(\d+)(\/attempts\/1\/jobs\?per_page=100)?$/.exec(url); assert(match, `Unexpected provider path ${url}`);
  const runId = Number(match[1]), runUrl = `https://api.github.com/repos/Jeruzael/docmonstakrakin/actions/runs/${runId}`;
  return new Response(JSON.stringify(match[2] ? {total_count: 4,
    jobs: ['Windows Native Qualification', 'Quality & Build', 'Controlled Docs', 'Complete Regression'].map((name, index) => ({
      id: runId * 10 + index, run_id: runId, run_attempt: 1, head_sha: commitSha, name, workflow_name: 'CI', status: 'completed', conclusion,
      run_url: runUrl, started_at: new Date(now - 120000).toISOString(), completed_at: new Date(now - 90000).toISOString()}))}
    : {id: runId, workflow_id: 372946294, name: 'CI', path: '.github/workflows/ci.yml', head_sha: commitSha, run_attempt: 1,
      repository: {full_name: 'Jeruzael/docmonstakrakin'}, head_repository: {full_name: 'Jeruzael/docmonstakrakin'},
      status: 'completed', conclusion, updated_at: new Date(now - 60000).toISOString()}), {headers: {'content-type': 'application/json'}});
}
function provider(conclusion = 'success') {
  const urls: string[] = [];
  globalThis.fetch = (async (url, init) => {urls.push(String(url)); assert(!new Headers(init?.headers).has('authorization')); return response(String(url), conclusion);}) as typeof fetch;
  return urls;
}
async function test(name: string, run: () => Promise<void>) {
  now += 10001;
  try {await run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);}
  finally {globalThis.fetch = originalFetch;}
}
function deadline<T>(pending: Promise<T>): Promise<T> {return Promise.race([pending, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Provider barrier was not reached')), 1000))]);}
try {
  await test('CR1 authenticated scoped CI acquisition returns technical observations and preserves every stored byte', async () => {
    const s = await server(), before = structuredClone(s.input), urls = provider();
    try {
      const result = await s.request('?runId=101'); assert.equal(result.status, 200); assert.equal(result.body.observation.status, 'OBSERVED_SUCCESS');
      assert.equal(result.body.report.releaseReady, false); assert.equal(result.body.report.signedOff, false);
      assert.equal(result.body.observation.humanAuthorization, false); assert.equal(result.body.observation.trustedProductionEvidence, false);
      assert.equal(result.body.cache.hit, false); assert.equal(result.headers['cache-control'], 'no-store');
      assert(isAcquiredGitHubCiObservation(s.ci.cachedObservation(projectId))); assert(!isAcquiredGitHubCiObservation(result.body.observation));
      assert.equal(urls.length, 2); assert.deepEqual(s.input, before);
    } finally {await s.close();}
  });
  await test('CR2 anonymous agents and project-denied sessions cannot acquire or read cached observations', async () => {
    const s = await server(), urls = provider();
    try {
      assert.equal((await s.request('?runId=102')).status, 200); const count = urls.length;
      assert.equal((await s.request('?runId=102', {headers: {'x-fixture-project-read': 'allowed'}})).status, 401);
      assert.equal((await s.request('?runId=102', {headers: {...headers, 'x-fixture-human': 'agent'}})).status, 403);
      assert.equal((await s.request('?runId=102', {headers: {...headers, 'x-fixture-project-read': 'denied'}})).status, 403);
      assert.equal(urls.length, count);
    } finally {await s.close();}
  });
  await test('CR3 invalid run IDs extra query claims and GET bodies are rejected before provider IO', async () => {
    const s = await server(), urls = provider();
    try {
      for (const query of ['', '?runId=0', '?runId=-1', '?runId=01', '?runId=1.5', '?runId=1e3', '?runId=9007199254740992',
        '?runId=101&runId=102', '?runId=https://evil.invalid', '?runId=101&url=https://evil.invalid', '?runId=101&token=INERT', '?runId=101&commit=other'])
        assert.equal((await s.request(query)).status, 400, query);
      assert.equal((await s.request('?runId=103', {body: {commitSha, url: 'https://evil.invalid', token: 'INERT'}})).status, 400);
      assert.equal(urls.length, 0);
    } finally {await s.close();}
  });
  await test('CR4 ordinary projects and missing malformed or ambiguous current scope cannot borrow self-project CI', async () => {
    const s = await server(), urls = provider();
    try {
      assert.equal((await s.request('?runId=104', {id: 'PRJ-ATLAS-01'})).status, 403);
      const original = structuredClone(s.input.projects[0]);
      delete s.input.projects[0].readinessContext; assert.equal((await s.request('?runId=104')).status, 412);
      s.input.projects = [structuredClone(original)]; s.input.projects[0].readinessContext!.commitSha = 'short';
      assert.equal((await s.request('?runId=104')).status, 412);
      s.input.projects = [structuredClone(original), structuredClone(original)]; assert.equal((await s.request('?runId=104')).status, 412);
      assert.equal(urls.length, 0); assert.equal(s.ci.cachedObservation(projectId), undefined);
    } finally {await s.close();}
  });
  await test('CR5 only one acquisition can be in flight across separate router registrations', async () => {
    const one = await server(), two = await server(); let release!: () => void, reached!: () => void;
    const started = new Promise<void>(resolve => {reached = resolve;}); let count = 0;
    globalThis.fetch = (async url => {
      count++; if (count === 1) {reached(); await new Promise<void>(resolve => {release = resolve;});} return response(String(url));
    }) as typeof fetch;
    let pending: ReturnType<typeof one.request> | undefined;
    try {
      pending = one.request('?runId=105'); await deadline(started);
      const blocked = await two.request('?runId=106'); assert.equal(blocked.status, 429); assert.equal(count, 1);
      release(); assert.equal((await pending).status, 200);
    } finally {release?.(); if (pending) await pending.catch(() => {}); await one.close(); await two.close();}
  });
  await test('CR6 acquisition gap is enforced while same-scope cache hits require no new provider call', async () => {
    const s = await server(), urls = provider();
    try {
      assert.equal((await s.request('?runId=107')).status, 200);
      const cached = await s.request('?runId=107'); assert.equal(cached.status, 200); assert.equal(cached.body.cache.hit, true); assert.equal(urls.length, 2);
      const limited = await s.request('?runId=108'); assert.equal(limited.status, 429); assert(Number(limited.headers['retry-after']) > 0);
      now += 10001; assert.equal((await s.request('?runId=108')).status, 200); assert.equal(urls.length, 4);
    } finally {await s.close();}
  });
  await test('CR7 scope changes during acquisition return conflict and cannot populate the report cache', async () => {
    const s = await server(); let release!: () => void, reached!: () => void; let count = 0;
    const started = new Promise<void>(resolve => {reached = resolve;});
    globalThis.fetch = (async url => {count++; if (count === 1) {reached(); await new Promise<void>(resolve => {release = resolve;});} return response(String(url));}) as typeof fetch;
    let pending: ReturnType<typeof s.request> | undefined;
    try {
      pending = s.request('?runId=109'); await deadline(started); s.input.projects[0].readinessContext!.buildRevision = 'changed-during-await';
      release(); const result = await pending; assert.equal(result.status, 409); assert.equal(result.body.observation, undefined);
      assert.equal(s.ci.cachedObservation(projectId), undefined);
    } finally {release?.(); if (pending) await pending.catch(() => {}); await s.close();}
  });
  await test('CR8 cached observations expire and are fenced immediately by current scope changes', async () => {
    const s = await server(); provider();
    try {
      assert.equal((await s.request('?runId=110')).status, 200); assert(s.ci.cachedObservation(projectId));
      s.input.projects[0].readinessContext!.revision++;
      assert.equal(s.ci.cachedObservation(projectId), undefined);
      s.input.projects[0].readinessContext!.revision--; now += 300001;
      assert.equal(s.ci.cachedObservation(projectId), undefined);
      const refreshed = await s.request('?runId=110'); assert.equal(refreshed.status, 200); assert.equal(refreshed.body.cache.hit, false);
    } finally {await s.close();}
  });
  await test('CR9 failed unavailable and rejected acquisition results remain honest technical states', async () => {
    const s = await server();
    try {
      provider('failure'); let result = await s.request('?runId=111'); assert.equal(result.status, 200); assert.equal(result.body.observation.status, 'FAILED');
      assert.equal(result.body.report.gates[3].status, 'FAILED'); assert.equal(result.body.report.signedOff, false);
      now += 10001; globalThis.fetch = (async () => new Response('{}', {status: 503})) as typeof fetch;
      result = await s.request('?runId=112'); assert.equal(result.status, 503); assert.equal(result.body.observation.status, 'UNAVAILABLE');
      now += 10001; globalThis.fetch = (async () => new Response(JSON.stringify({id: 999}), {headers: {'content-type': 'application/json'}})) as typeof fetch;
      result = await s.request('?runId=113'); assert.equal(result.status, 422); assert.equal(result.body.observation.status, 'REJECTED');
      assert.equal(result.body.report.releaseReady, false); assert.equal(result.body.report.productionEvidence.trustedProductionEvidence, false);
    } finally {await s.close();}
  });
} finally {globalThis.fetch = originalFetch; Date.now = originalNow;}
console.log(`GitHub CI routes: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
