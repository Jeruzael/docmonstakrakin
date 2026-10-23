/** AZ-08: actual server registrations; disposable snapshots and synthetic identities only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ProjectStore } from '../server/projectStore.ts';

const root = process.cwd();
const statuses = ['PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DEFERRED', 'VERIFIED'] as const;
const ordinaryDestinations = ['UNDER_REVIEW', 'REJECTED', 'DEFERRED', 'VERIFIED'];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-requirement-lifecycle-'));
const snapshotPath = path.join(dir, '.local/project-state.json');
const store = new ProjectStore();
const projectId = store.projects[0].id;
const project = store.projects[0];
project.stateVersion = 50;
const template = structuredClone(store.requirements[projectId][0]);
store.requirements[projectId] = [];
const seed = (id: string, status: any) => store.requirements[projectId].push({ ...structuredClone(template), id, status });
seed('REQ-INVALID', 'PROPOSED');
seed('REQ-VERSION', 'PROPOSED');
seed('REQ-UNKNOWN-SOURCE', 'SYNTHETIC_INVALID_STATUS');
seed('REQ-NONSTRING-SOURCE', ['PROPOSED']);
seed('REQ-DUPLICATE', 'PROPOSED');
seed('REQ-DUPLICATE', 'DEFERRED');
for (const source of statuses) for (const destination of statuses) seed(`REQ-${source}-${destination}`, source);
for (const id of ['REQ-ALIAS', 'REQ-RESTART']) seed(id, 'PROPOSED');
for (const [index, version] of [-1, 1.5, '50', null, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1].entries()) {
  const id = `PRJ-BAD-VERSION-${index}`;
  store.projects.push({ ...structuredClone(project), id, stateVersion: version as number });
  store.requirements[id] = [{ ...structuredClone(template), id: 'REQ-VERSION', status: 'PROPOSED' }];
}
fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
fs.writeFileSync(snapshotPath, JSON.stringify({ schemaVersion: 1, state: store }, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'sentinel.txt'), 'synthetic unchanged sentinel');
const listener = net.createServer();
await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = (listener.address() as net.AddressInfo).port;
await new Promise<void>(resolve => listener.close(() => resolve()));
const preload = path.join(dir, 'preload.mjs');
fs.writeFileSync(preload, `import {getSecretStore} from ${JSON.stringify(pathToFileURL(path.join(root, 'server/secrets/secretStoreFactory.ts')).href)};\ngetSecretStore({forceFallback:true,masterPassphrase:'disposable-lifecycle-only'});\n`);
let child: ReturnType<typeof spawn>;
let output = '';
let passed = 0;
const route = (id = 'REQ-INVALID') => `/api/projects/${projectId}/requirements/${id}/status`;
function request(url: string, method = 'GET', value?: unknown, raw?: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = raw ?? (value === undefined ? undefined : JSON.stringify(value));
    const req = http.request({ host: '127.0.0.1', port, path: url, method, headers: {
      Host: `127.0.0.1:${port}`, ...(data === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }), ...headers,
    } }, res => {
      let text = '';
      res.on('data', chunk => text += chunk);
      res.on('end', () => { let body; try { body = JSON.parse(text); } catch { body = text; } resolve({ status: res.statusCode!, body }); });
    });
    req.on('error', reject);
    req.end(data);
  });
}
async function start() {
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', DMK_WORKSPACE_ACCESS:'LOCAL_DEVELOPMENT', HOST: '127.0.0.1', PORT: String(port), GEMINI_API_KEY: '', DMK_HUMAN_REVIEWERS: '{}', DOCMONSTAKRAKIN_MASTER_KEY: 'disposable-lifecycle-only' };
  for (const name of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[name]) env[name] = process.env[name];
  child = spawn(process.execPath, ['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, '--import', pathToFileURL(preload).href, path.join(root, 'server.ts')], { cwd: dir, windowsHide: true, env, stdio: 'pipe' });
  child.stdout?.on('data', chunk => output += chunk);
  child.stderr?.on('data', chunk => output += chunk);
  child.on('error', error => output += error.message);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && child.exitCode === null) {
    try { if ((await request('/api/health')).status === 200) return; } catch { /* wait for actual listener */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Actual server did not start: ${output}`);
}
async function stop() {
  if (child?.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
}
async function observed() {
  return {
    project: (await request(`/api/projects/${projectId}`)).body,
    projects: (await request('/api/projects')).body,
    requirements: (await request(`/api/projects/${projectId}/requirements`)).body,
    audit: (await request(`/api/projects/${projectId}/audit`)).body,
    disk: fs.existsSync(snapshotPath) ? fs.readFileSync(snapshotPath) : null,
    files: fs.readdirSync(path.dirname(snapshotPath)).sort(),
  };
}
function pass(name: string) { passed++; console.log('PASS ' + name); }
async function rejected(name: string, url: string, method: string, value: unknown, expected: number, raw?: string, headers?: Record<string, string>) {
  const before = await observed();
  const result = await request(url, method, value, raw, headers);
  assert.equal(result.status, expected, `${name}: ${JSON.stringify(result.body)}`);
  assert.deepEqual(await observed(), before, `${name}: rejected request changed project, version, audit, memory, snapshot bytes or transaction files`);
  pass(name);
}

try {
  await start();
  // First assertion deliberately fails against the vulnerable baseline (200 instead of422).
  await rejected('unknown status is rejected without mutation', route(), 'POST', { status: 'SYNTHETIC_INVALID_STATUS' }, 422);
  for (const value of ['', 'approved', 'under_review', ' VERIFIED', 'DEFERRED ', 'APPROVED\n', 'RELEASED', '__proto__', 'toString', '\u0000', 'ＶＥＲＩＦＩＥＤ', null, true, 1, [], {}, ['APPROVED']]) {
    await rejected(`malformed status ${JSON.stringify(value)}`, route(), 'POST', { status: value }, 422);
  }
  for (const body of [{}, [], { justification: 'missing status' }]) await rejected(`invalid body ${JSON.stringify(body)}`, route(), 'POST', body, 422);
  for (const body of [null, true, 1, 'UNDER_REVIEW']) await rejected(`non-container JSON body ${JSON.stringify(body)}`, route(), 'POST', body, 400);
  await rejected('missing body', route(), 'POST', undefined, 422);
  await rejected('malformed JSON', route(), 'POST', undefined, 400, '{"status":');
  for (const value of [null, 1, [], {}]) await rejected('invalid justification ' + JSON.stringify(value), route(), 'POST', { status: 'UNDER_REVIEW', justification: value }, 422);
  for (const value of [null, '50', -1, 1.5, true, {}, [], Number.MAX_SAFE_INTEGER + 1]) await rejected('invalid expected version ' + JSON.stringify(value), route(), 'POST', { status: 'UNDER_REVIEW', expectedStateVersion: value }, 422);
  await rejected('stale expected aggregate version', route(), 'POST', { status: 'UNDER_REVIEW', expectedStateVersion: 49 }, 409);
  await rejected('unknown persisted lifecycle source', route('REQ-UNKNOWN-SOURCE'), 'POST', { status: 'UNDER_REVIEW' }, 409);
  await rejected('non-string persisted lifecycle source', route('REQ-NONSTRING-SOURCE'), 'POST', { status: 'UNDER_REVIEW' }, 409);
  for (let index = 0; index < 6; index++) await rejected('invalid persisted aggregate version ' + index, `/api/projects/PRJ-BAD-VERSION-${index}/requirements/REQ-VERSION/status`, 'POST', { status: 'UNDER_REVIEW' }, 409);
  await rejected('ambiguous requirement', route('REQ-DUPLICATE'), 'POST', { status: 'UNDER_REVIEW' }, 409);
  await rejected('missing requirement', route('REQ-MISSING'), 'POST', { status: 'UNDER_REVIEW' }, 404);
  await rejected('missing project', '/api/projects/PRJ-MISSING/requirements/REQ-MISSING/status', 'POST', { status: 'UNDER_REVIEW' }, 404);
  for (const source of statuses) for (const destination of statuses) {
    const id = `REQ-${source}-${destination}`;
    const permitted = ordinaryDestinations.includes(destination) && source !== destination;
    const name = `${source} -> ${destination}`;
    if (!permitted) {
      await rejected(name, route(id), 'POST', { status: destination }, destination === 'APPROVED' ? 403 : 409);
      continue;
    }
    const before = await observed();
    const result = await request(route(id), 'POST', { status: destination, justification: 'synthetic legitimate transition', expectedStateVersion: before.project.stateVersion });
    assert.equal(result.status, 200, name);
    assert.equal(result.body.requirement.status, destination);
    const after = await observed();
    assert.equal(after.project.stateVersion, before.project.stateVersion + 1, name);
    assert.equal(after.audit.length, before.audit.length + 1, name);
    assert.deepEqual(after.audit.slice(1), before.audit, `${name}: historical audit changed`);
    assert.equal(after.audit[0].action, 'REQUIREMENT_STATUS_CHANGED');
    assert.equal(after.audit[0].details.previousStatus, source);
    assert.equal(after.audit[0].details.newStatus, destination);
    const saved = JSON.parse(after.disk!.toString());
    assert.equal(saved.state.projects.find((p: any) => p.id === projectId).stateVersion, after.project.stateVersion);
    assert.deepEqual(saved.state.requirements[projectId], after.requirements);
    pass('permitted ' + name);
  }
  for (const alias of [route('REQ-ALIAS') + '/', route('REQ-ALIAS').replace('/api/projects/', '/API/PROJECTS/').replace('/requirements/', '/REQUIREMENTS/').replace('/status', '/STATUS')]) {
    await rejected('alias invalid string ' + alias, alias, 'POST', { status: 'approved' }, 422);
    await rejected('alias direct approval ' + alias, alias, 'POST', { status: 'APPROVED' }, 403);
  }
  for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']) await rejected('unregistered method ' + method, route(), method, { status: 'UNDER_REVIEW' }, 404);
  await rejected('encoded path separator', route().replace('/requirements/', '/requirements%2F'), 'POST', { status: 'UNDER_REVIEW' }, 400);
  await rejected('foreign origin', route(), 'POST', { status: 'UNDER_REVIEW' }, 403, undefined, { Origin: 'https://attacker.example' });
  // Legacy clients omit expectedStateVersion; ordinary accepted calls remain unscoped.
  assert.equal((await request(route('REQ-ALIAS') + '/', 'POST', { status: 'UNDER_REVIEW' })).status, 200);
  pass('trailing slash legitimate transition with legacy version omission');
  const upperAlias = route('REQ-ALIAS').replace('/api/projects/', '/API/PROJECTS/').replace('/requirements/', '/REQUIREMENTS/').replace('/status', '/STATUS');
  assert.equal((await request(upperAlias, 'POST', { status: 'DEFERRED' })).status, 200);
  pass('case alias legitimate transition');
  await rejected('JSON escaped protected status', route(), 'POST', undefined, 403, '{"status":"\\u0041PPROVED"}');
  await rejected('duplicate status keys resolve to protected value', route(), 'POST', undefined, 403, '{"status":"UNDER_REVIEW","status":"APPROVED"}');
  const stale = (await observed()).project.stateVersion;
  assert.equal((await request(route('REQ-VERSION'), 'POST', { status: 'UNDER_REVIEW', expectedStateVersion: stale })).status, 200);
  await rejected('replayed stale aggregate version', route('REQ-RESTART'), 'POST', { status: 'UNDER_REVIEW', expectedStateVersion: stale }, 409);
  const beforeRestart = await observed();
  await stop();
  await start();
  assert.deepEqual(await observed(), beforeRestart);
  pass('accepted transitions and audit survive restart without extra mutation');
  await stop();
  fs.unlinkSync(snapshotPath);
  await start();
  await rejected('invalid status does not create absent snapshot', route(), 'POST', { status: 'SYNTHETIC_INVALID_STATUS' }, 422);
  assert(!fs.existsSync(snapshotPath));
  assert.equal(fs.readFileSync(path.join(dir, 'sentinel.txt'), 'utf8'), 'synthetic unchanged sentinel');
  console.log(`Requirement lifecycle: ${passed} passed, 0 failed, 0 skipped`);
} finally {
  await stop();
  assert.equal(path.dirname(dir), os.tmpdir());
  assert(path.basename(dir).startsWith('dmk-requirement-lifecycle-'));
  fs.rmSync(dir, { recursive: true, force: true });
}
