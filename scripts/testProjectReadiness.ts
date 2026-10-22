import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {Server} from 'node:http';
import express from 'express';
import {ProjectStore} from '../server/projectStore';
import {installProjectPersistence, readProjectSnapshot} from '../server/projectPersistence';
import {registerProjectReadinessRoutes, type ReadinessEvidenceResolver} from '../server/readiness/routes';
import {releaseHealthProjection} from '../src/data/releaseHealthProjection';
import type {BoundReleaseEvidence, ReadinessProject, ReleaseScopeContext} from '../src/releaseScopeTypes';
import {INITIAL_PROJECTS, INITIAL_WORK_ITEMS} from '../src/data/initialData';

const projectId = 'PRJ-SYNTHETIC-READINESS';
const commitSha = 'a'.repeat(40);
const project = (): ReadinessProject => ({...structuredClone(INITIAL_PROJECTS[0]), id: projectId, stateVersion: 1, maturity: undefined, targetRelease: 'Synthetic release'});
const item = (id: string, status = 'READY') => ({...structuredClone(INITIAL_WORK_ITEMS[0]), id, status}) as typeof INITIAL_WORK_ITEMS[number];
const scopeInput = () => ({targetRelease: 'Synthetic release', workItemIds: ['WORK-A', 'WORK-B'], commitSha, buildRevision: 'build-1', environment: 'local-loopback'});
const request = () => ({expectedStateVersion: 1, maturity: 'GREENFIELD', sourceControl: 'Git', scope: scopeInput()});
const context = (): ReleaseScopeContext => ({version: 'LOCAL_RELEASE_SCOPE/1', id: 'RSC-synthetic', revision: 1, ...scopeInput(), updatedAt: '2026-10-22T01:00:00.000Z', updatedBy: {identityId: 'synthetic-human', name: 'Synthetic Reviewer', roleSource: 'LOCAL_SERVER_ROSTER'}});
const observation = (workItemId: string, eligible = true): BoundReleaseEvidence => ({projectId, workItemId, commitSha, buildRevision: 'build-1', environment: 'local-loopback', observation: {reviews: [{sessionId: `SESSION-${workItemId}`, eligible, reason: eligible ? 'Current local review' : 'STALE_EVIDENCE_OR_CHANGED_BYTES', pendingRoles: [], trust: 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION', trustedProductionEvidence: false}], eligibleSessionIds: eligible ? [`SESSION-${workItemId}`] : [], trust: 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION', trustedProductionEvidence: false}});
let passed = 0;
const check = (name: string, run: () => void) => {run(); passed++; console.log(`PASS ${name}`);};
check('missing scope and missing source data stay unavailable', () => {
  assert.equal(releaseHealthProjection(project(), []).status, 'Unavailable');
  const p = {...project(), readinessContext: context()};
  assert.equal(releaseHealthProjection(p).lifecycle.status, 'Unavailable');
  assert.equal(releaseHealthProjection(p, [item('WORK-A'), item('WORK-B')]).localEvidence.percentage, null);
});
check('scope denominator excludes unrelated future tasks and separates lifecycle from local review', () => {
  const result = releaseHealthProjection({...project(), readinessContext: context()}, [item('WORK-A', 'VERIFIED'), item('WORK-B'), item('FUTURE', 'RELEASED')], [observation('WORK-A'), observation('WORK-B', false), observation('FUTURE')]);
  assert.deepEqual(result.scope?.workItemIds, ['WORK-A', 'WORK-B']);
  assert.equal(result.scope?.count, 2);
  assert.equal(result.lifecycle.counts.VERIFIED, 1);
  assert.equal(result.lifecycle.counts.RELEASED, 0);
  assert.equal(result.localEvidence.reviewedCount, 1);
  assert.equal(result.localEvidence.percentage, 50);
  assert.match(result.localEvidence.formula, /reviewed scoped work.*scoped work items/);
  assert.equal(result.securityAssurance.status, 'Unavailable');
  assert.equal(result.productionRelease.status, 'Unavailable');
});
check('mismatched release, task, build and unknown lifecycle cannot count as reviewed', () => {
  const p = {...project(), readinessContext: context()};
  for (const field of ['projectId', 'commitSha', 'buildRevision', 'environment']) {
    const evidence = observation('WORK-A'); (evidence as any)[field] = 'mismatch';
    assert.equal(releaseHealthProjection(p, [item('WORK-A'), item('WORK-B')], [evidence, observation('WORK-B')]).localEvidence.status, 'Unavailable');
  }
  assert.equal(releaseHealthProjection({...p, targetRelease: 'Changed release'}, [item('WORK-A'), item('WORK-B')]).status, 'Unavailable');
  assert.equal(releaseHealthProjection(p, [item('WORK-A')]).status, 'Unavailable');
  assert.equal(releaseHealthProjection(p, [item('WORK-A', 'UNKNOWN'), item('WORK-B')]).lifecycle.status, 'Unavailable');
  const corrupt = observation('WORK-A'); corrupt.observation.reviews[0].eligible = false;
  assert.equal(releaseHealthProjection(p, [item('WORK-A'), item('WORK-B')], [corrupt, observation('WORK-B')]).localEvidence.status, 'Unavailable');
  const forgedProduction = observation('WORK-A'); (forgedProduction.observation as any).trustedProductionEvidence = true;
  const rejected = releaseHealthProjection(p, [item('WORK-A'), item('WORK-B')], [forgedProduction, observation('WORK-B')]);
  assert.equal(rejected.localEvidence.status, 'Unavailable'); assert.equal(rejected.productionRelease.status, 'Unavailable');
});

type Options = {authorization?: 'missing' | 'agent'; identityId?: string; persistence?: boolean; lockFailure?: boolean; resolver?: boolean | ReadinessEvidenceResolver};
async function fixture(run: (base: string, store: ProjectStore, root: string, calls: unknown[]) => Promise<void>, options: Options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-readiness-'));
  const store = new ProjectStore(); store.projects = [project()]; store.workItems = {[projectId]: [item('WORK-A'), item('WORK-B'), item('FUTURE')]}; store.auditLogs = {[projectId]: []};
  const app = express(); app.use(express.json());
  if (options.persistence !== false) installProjectPersistence(app, store, root);
  if (options.lockFailure) app.use('/api/projects', (_req, _res, next) => {fs.mkdirSync(path.join(root, '.local'), {recursive: true}); fs.writeFileSync(path.join(root, '.local/project-state.write.lock'), 'synthetic lock'); next();});
  const calls: unknown[] = [];
  registerProjectReadinessRoutes(app, store, (_req, res) => {
    if (options.authorization === 'missing') {res.status(401).json({error: 'Sign in'}); return;}
    return {id: options.identityId ?? 'synthetic-human', name: 'Synthetic Reviewer', roles: ['Security Officer'], kind: options.authorization === 'agent' ? 'AGENT' : 'HUMAN', roleSource: 'LOCAL_SERVER_ROSTER'};
  }, typeof options.resolver === 'function' ? options.resolver : options.resolver ? (_id, current) => {calls.push({projectId: _id, ...current}); return observation(current.workItemId).observation;} : undefined);
  const server = await new Promise<Server>(resolve => {const instance = app.listen(0, '127.0.0.1', () => resolve(instance));});
  try {const address = server.address(); assert.ok(address && typeof address !== 'string'); await run(`http://127.0.0.1:${address.port}`, store, root, calls);}
  finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const target = path.resolve(root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('dmk-readiness-'));
    fs.rmSync(target, {recursive: true, force: true});
  }
}
const post = (base: string, body: unknown, id = projectId) => fetch(`${base}/api/projects/${id}/readiness`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
await fixture(async (base, store, root, calls) => {
  const before = JSON.stringify(store);
  const initial = await fetch(`${base}/api/projects/${projectId}/readiness`);
  assert.equal(initial.status, 200); assert.equal((await initial.json()).summary.status, 'Unavailable'); assert.equal(JSON.stringify(store), before); assert.equal(readProjectSnapshot(root), null);
  const saved = await post(base, request()); assert.equal(saved.status, 200);
  const body = await saved.json(); assert.equal(body.projectId, projectId); assert.equal(body.stateVersion, 2); assert.equal(body.sourceControl, 'Git'); assert.equal(body.maturity, 'GREENFIELD');
  assert.equal(body.readinessContext.revision, 1); assert.match(body.readinessContext.id, /^RSC-/); assert.equal(body.readinessContext.updatedBy.identityId, 'synthetic-human');
  assert.equal(body.summary.localEvidence.status, 'Unavailable', 'Mutation acknowledgement does not await evidence before committing'); assert.equal(body.summary.productionRelease.status, 'Unavailable');
  assert.deepEqual(calls, []);
  const reviewed = await fetch(`${base}/api/projects/${projectId}/readiness`); assert.equal((await reviewed.json()).summary.localEvidence.percentage, 100);
  assert.deepEqual(calls, scopeInput().workItemIds.map(workItemId => ({projectId, workItemId, commitSha, buildRevision: 'build-1', environment: 'local-loopback'})));
  assert.equal((readProjectSnapshot(root)!.state.projects[0] as ReadinessProject).readinessContext!.revision, 1);
  assert.equal(store.auditLogs[projectId].length, 1); assert.equal(store.auditLogs[projectId][0].action, 'PROJECT_READINESS_CONTEXT_UPDATED');
  assert.equal((await post(base, request())).status, 409); assert.equal(store.projects[0].stateVersion, 2);
  const setupOnly = await post(base, {expectedStateVersion: 2, maturity: 'EXTENSION', sourceControl: 'Git'}); assert.equal(setupOnly.status, 200);
  assert.equal((store.projects[0] as ReadinessProject).readinessContext!.revision, 1, 'Setup-only save preserves scope');
  const next = await post(base, {...request(), expectedStateVersion: 3}); assert.equal(next.status, 200); assert.equal((await next.json()).readinessContext.revision, 2);
  passed++;
}, {resolver: true});
for (const invalid of [
  {...request(), expectedStateVersion: undefined}, {...request(), expectedStateVersion: -1}, {...request(), actor: 'forged'}, {...request(), trustedProductionEvidence: true},
  {...request(), maturity: 'UNDECIDED'}, {...request(), maturity: ['GREENFIELD']}, {...request(), maturity: {toString: null}}, {...request(), sourceControl: ' '}, {...request(), sourceControl: '{{UNRESOLVED_SCM}}'}, {...request(), scope: {...scopeInput(), targetRelease: 'Other release'}},
  {...request(), scope: {...scopeInput(), workItemIds: []}}, {...request(), scope: {...scopeInput(), workItemIds: ['WORK-A', 'WORK-A']}},
  {...request(), scope: {...scopeInput(), workItemIds: ['OTHER-PROJECT-WORK']}}, {...request(), scope: {...scopeInput(), commitSha: 'HEAD'}},
  {...request(), scope: {...scopeInput(), environment: ''}}, {...request(), scope: {...scopeInput(), buildRevision: ' build-1'}},
  {...request(), scope: {...scopeInput(), revision: 99}},
]) await fixture(async (base, store, root) => {const before = JSON.stringify(store); assert.equal((await post(base, invalid)).status, 422); assert.equal(JSON.stringify(store), before); assert.equal(readProjectSnapshot(root), null); passed++;});
for (const authorization of ['missing', 'agent'] as const) await fixture(async (base, store) => {const before = JSON.stringify(store); const expected = authorization === 'missing' ? 401 : 403; assert.equal((await fetch(`${base}/api/projects/${projectId}/readiness`)).status, expected); assert.equal((await post(base, request())).status, expected); assert.equal(JSON.stringify(store), before); passed++;}, {authorization});
for (const identityId of ['', 'x'.repeat(161)]) await fixture(async (base, store) => {const before = JSON.stringify(store); assert.equal((await fetch(`${base}/api/projects/${projectId}/readiness`)).status, 403); assert.equal((await post(base, request())).status, 403); assert.equal(JSON.stringify(store), before); passed++;}, {identityId});
await fixture(async (base, store) => {store.projects[0].id = 'PRJ-DOCMONSTAKRAKIN'; assert.equal((await post(base, request(), 'PRJ-DOCMONSTAKRAKIN')).status, 403); assert.equal((await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/readiness`)).status, 403); passed++;});
await fixture(async (base, store) => {assert.equal((await post(base, request())).status, 503); assert.equal(store.projects[0].stateVersion, 1); passed++;}, {persistence: false});
await fixture(async (base, store, root) => {const before = JSON.stringify(store); assert.equal((await post(base, request())).status, 500); assert.equal(JSON.stringify(store), before); assert.equal(readProjectSnapshot(root), null); passed++;}, {lockFailure: true});
await fixture(async (base) => {const saved = await post(base, request()); assert.equal(saved.status, 200); assert.equal((await saved.json()).summary.localEvidence.status, 'Unavailable'); passed++;});
{
  let hold = false, entered!: () => void;
  const reached = new Promise<void>(resolve => {entered = resolve;});
  const waiting: (() => void)[] = [];
  await fixture(async (base) => {
    assert.equal((await post(base, request())).status, 200);
    hold = true;
    const read = fetch(`${base}/api/projects/${projectId}/readiness`);
    await reached;
    const saved = await post(base, {...request(), expectedStateVersion: 2, scope: {...scopeInput(), buildRevision: 'build-2'}});
    assert.equal(saved.status, 200, 'Save must not await external evidence work');
    for (const resume of waiting) resume();
    assert.equal((await read).status, 409, 'A concurrent change cannot return mixed context with a new CAS version');
    passed++;
  }, {resolver: async (_id, current) => {if (hold) {entered(); await new Promise<void>(resolve => waiting.push(resolve));} return observation(current.workItemId).observation;}});
}
console.log(`Project readiness: ${passed} passed`);
