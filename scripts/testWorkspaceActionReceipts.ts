import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';
import {recoverWorkspaceLock} from '../server/security/workspaceAccess/privateDirectory.ts';

let passed = 0, failed = 0;
const diagnostic = process.argv.find(value => value.startsWith('--diagnostic='))?.slice('--diagnostic='.length);
if (diagnostic && !['restart', 'worker-options'].includes(diagnostic)) throw Error('Unknown receipt diagnostic selection');
let currentTest = '';
async function stage<T>(name: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {const result = await run(); if (diagnostic) console.log('DIAGNOSTIC ' + JSON.stringify({test: currentTest, stage: name, ms: Math.round(performance.now() - start), outcome: 'RETURNED'})); return result;}
  catch (error) {if (diagnostic) console.log('DIAGNOSTIC ' + JSON.stringify({test: currentTest, stage: name, ms: Math.round(performance.now() - start), outcome: 'THREW', code: (error as any)?.code ?? String(error)})); throw error;}
}
async function test(name: string, run: () => Promise<void>) {
  if (diagnostic === 'restart' && !/^AR0[46] /.test(name) || diagnostic === 'worker-options' && !/^AR11 /.test(name)) return;
  currentTest = name;
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); }
}
const verifier = '$argon2id$v=19$m=32768,p=1,t=3$' + Buffer.alloc(16).toString('base64').replace(/=/g, '') + '$' + Buffer.alloc(32).toString('base64').replace(/=/g, '');
const at = 1_700_000_000_000;
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const principal = (id = 'synthetic-owner') => ({id, name: id, personId: 'SYNTHETIC-' + id, kind: 'HUMAN', roles: [], canCreateProjects: true, disabled: false, credentialRevision: 1});
const state = () => ({schemaVersion: 1, state: {projects: [{id: 'PRJ-A', title: 'A'}, {id: 'PRJ-B', title: 'B'}]}});
const reject = (promise: Promise<any>, code: string) => assert.rejects(promise, (e: any) => e.code === code, code);
async function fixture(run: (f: any) => Promise<void>, receipts = true) {
  const parent = fs.realpathSync.native(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'dmk-action-receipt-'));
  let store: WorkspaceStore | undefined;
  try {
    store = await stage('fixture-open-schema' + (receipts ? '2' : '1'), () => WorkspaceStore.open(root, {initialize: true, ...(receipts ? {actionReceipts: true} : {})} as any));
    await run({root, store, setStore: (value: WorkspaceStore) => {store = value;}});
  } finally {
    await store?.close(); assert.equal(path.dirname(path.resolve(root)), parent); assert.match(path.basename(root), /^dmk-action-receipt-/);
    fs.rmSync(root, {recursive: true});
  }
}
async function issue(store: WorkspaceStore, id = 'synthetic-owner') {
  const info = await stage('issue-info', () => store.execute({command: 'info'})), digest = crypto.randomBytes(32).toString('hex');
  await stage('issue-session', () => store.execute({command: 'issue', principalId: id, expectedCredentialRevision: 1, expectedGeneration: info.generation, digest, now: at}));
  return digest;
}
async function bootstrap(store: WorkspaceStore) {
  await stage('bootstrap', () => store.execute({command: 'bootstrap', principal: principal() as any, verifier, stateJson: JSON.stringify(state())}));
  await stage('membership', () => store.execute({command: 'membership', principalId: 'synthetic-owner', projectId: 'PRJ-A', role: 'OWNER'}));
  return issue(store);
}
async function command(store: WorkspaceStore, digest: string, extra: any = {}) {
  const info = await store.execute({command: 'info'}), changed = state(); changed.state.projects[0].title = 'Committed';
  return {command: 'commitReceipt', operationId: crypto.randomUUID(), digest, action: 'project:write', projectId: 'PRJ-A', requestedProjectId: 'PRJ-A', requestHash: hash('PATCH /PRJ-A Committed expected=1'), expectedRevision: info.snapshotRevision, expectedPolicyRevision: info.policyRevision, stateJson: JSON.stringify(changed), now: at, ...extra};
}
const lookup = (c: any, extra: any = {}) => ({command: 'lookupReceipt', operationId: c.operationId, digest: c.digest, action: c.action, ...(c.requestedProjectId === undefined ? {} : {projectId: c.requestedProjectId}), requestHash: c.requestHash, now: at, ...extra});
await test('AR01 explicit fresh receipt authority is schema2 while snapshot advertises capability', async () => {
  const parent = fs.realpathSync.native(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'dmk-action-receipt-'));
  let store: WorkspaceStore | undefined;
  try {
    store = await WorkspaceStore.open(root, {initialize: true, actionReceipts: true} as any);
    assert.equal((await store.execute({command: 'info'})).schemaVersion, 2);
    assert.deepEqual(await store.execute({command: 'snapshot'}), {stateJson: null, snapshotRevision: 0, actionReceipts: true});
  } finally {
    await store?.close(); assert.equal(path.dirname(path.resolve(root)), parent); assert.match(path.basename(root), /^dmk-action-receipt-/);
    fs.rmSync(root, {recursive: true});
  }
});
await test('AR02 receipt lookup/retry preserves one effect and binds actor, body, scope and exact effect', () => fixture(async ({store}) => {
  const digest = await bootstrap(store), c = await command(store, digest);
  assert.equal(await store.execute(lookup(c) as any), null);
  const beforeAudit = await store.execute({command: 'audit'});
  const first = await store.execute(c), snapshot = await store.execute({command: 'snapshot'}), audit = await store.execute({command: 'audit'});
  assert.equal(audit.length, beforeAudit.length + 2);
  assert.equal(audit.at(-2).type, 'PROJECT_SNAPSHOT_COMMITTED'); assert.equal(audit.at(-1).type, 'ACTION_RECEIPT_COMMITTED');
  assert.equal(audit.at(-1).targetHash, hash(JSON.stringify(first.receipt)));
  assert.equal(first.receipt.version, 1); assert.equal(first.receipt.principalId, 'synthetic-owner');
  assert.equal(first.receipt.projectId, 'PRJ-A'); assert.equal(first.receipt.requestedProjectId, 'PRJ-A');
  assert.equal(first.receipt.effectHash, hash(c.stateJson)); assert.equal(first.receipt.snapshotRevision, 2);
  assert.deepEqual(await store.execute(lookup(c)), first.receipt);
  assert.deepEqual(await store.execute(c), first);
  assert.deepEqual(await store.execute({command: 'snapshot'}), snapshot); assert.deepEqual(await store.execute({command: 'audit'}), audit);
  for (const change of [{requestHash: hash('changed body')}, {projectId: 'PRJ-B'}, {action: 'project:import'}]) await reject(store.execute(lookup(c, change)), 'WORKSPACE_OPERATION_REPLAY');
  await reject(store.execute({...c, stateJson: JSON.stringify(state())}), 'WORKSPACE_OPERATION_REPLAY');
  await reject(store.execute({...c, requestedProjectId: 'PRJ-B'}), 'WORKSPACE_OPERATION_REPLAY');
  await store.execute({command: 'provision', principal: principal('synthetic-other'), verifier});
  await store.execute({command: 'membership', principalId: 'synthetic-other', projectId: 'PRJ-A', role: 'OWNER'});
  const other = await issue(store, 'synthetic-other');
  await reject(store.execute(lookup(c, {digest: other})), 'WORKSPACE_ACCESS_DENIED');
  await reject(store.execute({...c, digest: other}), 'WORKSPACE_ACCESS_DENIED');
  const later = await command(store, digest, {operationId: crypto.randomUUID(), requestHash: hash('later')});
  await store.execute(later);
  assert.equal((await store.execute(lookup(c))).snapshotRevision, 2);
  await store.execute({command: 'membership', principalId: 'synthetic-owner', projectId: 'PRJ-A', role: 'DENY'});
  await reject(store.execute(lookup(c)), 'WORKSPACE_ACCESS_DENIED');
  await reject(store.execute(c), 'WORKSPACE_ACCESS_DENIED');
}));
await test('AR03 create receipt requires current access to the actual created target', () => fixture(async ({store}) => {
  const digest = await bootstrap(store), changed = state(); changed.state.projects.push({id: 'PRJ-C', title: 'Created'});
  const c = await command(store, digest, {action: 'project:create', projectId: 'PRJ-C', requestedProjectId: undefined, stateJson: JSON.stringify(changed)});
  delete c.requestedProjectId;
  const result = await store.execute(c); assert.equal(result.receipt.requestedProjectId, null); assert.equal(result.receipt.projectId, 'PRJ-C');
  assert.deepEqual(await store.execute(lookup(c)), result.receipt);
  await store.execute({command: 'membership', principalId: 'synthetic-owner', projectId: 'PRJ-C', role: 'DENY'});
  assert.equal((await store.execute({command: 'authorize', digest, action: 'project:create', now: at})).allowed, true);
  await reject(store.execute(lookup(c)), 'WORKSPACE_ACCESS_DENIED');
}));
await test('AR04 restart fences old sessions but a new same-actor session retrieves the durable historical receipt', () => fixture(async ({store, root, setStore}) => {
  const digest = await bootstrap(store), c = await stage('prepare-command', () => command(store, digest)), first = await stage<any>('commitReceipt', () => store.execute(c));
  await stage('close', () => store.close()); const reopened = await stage('reopen', () => WorkspaceStore.open(root)); setStore(reopened);
  await reject(stage('lookup-old-session', () => reopened.execute(lookup(c) as any)), 'WORKSPACE_ACCESS_DENIED');
  const nextDigest = await issue(reopened);
  assert.deepEqual(await stage('lookup-new-session', () => reopened.execute(lookup(c, {digest: nextDigest}) as any)), first.receipt);
  await stage('logout', () => reopened.execute({command: 'logout', digest: nextDigest, now: at}));
  await reject(stage('lookup-logged-out', () => reopened.execute(lookup(c, {digest: nextDigest}) as any)), 'WORKSPACE_ACCESS_DENIED');
}));
for (const receipts of [false, true]) await test('AR05 legacy commit replay remains refused on schema' + (receipts ? '2' : '1'), () => fixture(async ({store}) => {
  const digest = await bootstrap(store), c = await command(store, digest);
  delete c.requestHash; delete c.requestedProjectId; c.command = 'commit';
  await store.execute(c); await reject(store.execute(c), 'WORKSPACE_OPERATION_REPLAY');
  const l = {command: 'lookupReceipt', operationId: c.operationId, digest, action: c.action, projectId: c.projectId, requestHash: hash('unknown legacy'), now: at};
  await reject(store.execute(l), receipts ? 'WORKSPACE_OPERATION_REPLAY' : 'WORKSPACE_SCHEMA_UNSUPPORTED');
  if (!receipts) assert.equal(Object.hasOwn(await store.execute({command: 'snapshot'}), 'actionReceipts'), false);
}, receipts));
for (const receipts of [false, true]) await test('AR06 existing schema' + (receipts ? '2' : '1') + ' opt-in rejects without changing database bytes', () => fixture(async ({store, root}) => {
  await bootstrap(store); await stage('close', () => store.close()); const file = path.join(root, '.security', 'authority.sqlite'), before = fs.readFileSync(file);
  await reject(stage('reject-existing-opt-in', () => WorkspaceStore.open(root, {initialize: true, actionReceipts: true} as any)), 'WORKSPACE_SCHEMA_UNSUPPORTED');
  assert.deepEqual(fs.readFileSync(file), before);
}, receipts));
await test('AR07 altered receipt metadata fails reopening against the committed audit binding', () => fixture(async ({store, root}) => {
  const digest = await bootstrap(store), c = await command(store, digest); await store.execute(c); await store.close();
  const Sqlite = createRequire(import.meta.url)('better-sqlite3'), db = new Sqlite(path.join(root, '.security', 'authority.sqlite'));
  try { const row = db.prepare('SELECT receiptJson FROM operations WHERE operationId=?').get(c.operationId); const receipt = JSON.parse(row.receiptJson); receipt.requestHash = hash('tampered'); db.prepare('UPDATE operations SET receiptJson=? WHERE operationId=?').run(JSON.stringify(receipt), c.operationId); }
  finally {db.close();}
  await reject(WorkspaceStore.open(root), 'WORKSPACE_CORRUPT');
  const removed = new Sqlite(path.join(root, '.security', 'authority.sqlite'));
  try {removed.prepare('UPDATE operations SET receiptJson=NULL WHERE operationId=?').run(c.operationId);}
  finally {removed.close();}
  await reject(WorkspaceStore.open(root), 'WORKSPACE_CORRUPT');
}));
await test('AR08 stale revision rejects a new operation and leaves no receipt or snapshot effect', () => fixture(async ({store}) => {
  const digest = await bootstrap(store), c = await command(store, digest, {expectedRevision: 0}), before = await store.execute({command: 'snapshot'}), audit = await store.execute({command: 'audit'});
  await reject(store.execute(c), 'WORKSPACE_STALE_REVISION'); assert.equal(await store.execute(lookup(c)), null);
  assert.deepEqual(await store.execute({command: 'snapshot'}), before); assert.deepEqual(await store.execute({command: 'audit'}), audit);
}));
for (const count of [4095, 4096]) await test('AR09 audit count ' + count + ' rolls back receipt, snapshot, ownership and clock together', () => fixture(async ({store, root, setStore}) => {
  await bootstrap(store); await store.close();
  const Sqlite = createRequire(import.meta.url)('better-sqlite3'), file = path.join(root, '.security', 'authority.sqlite'), raw = new Sqlite(file);
  try {
    let previous = raw.prepare('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').get().hash;
    const existing = raw.prepare('SELECT count(*) AS n FROM audit').get().n;
    raw.exec('BEGIN IMMEDIATE');
    for (let n = existing; n < count - 2; n++) {
      const event = JSON.stringify({type: 'SYNTHETIC_CAPACITY_FIXTURE', targetHash: null, at, generation: 1, policyRevision: 2, snapshotRevision: 1});
      const next = hash(previous + '\n' + event); raw.prepare('INSERT INTO audit(raw,previousHash,hash) VALUES(?,?,?)').run(event, previous, next); previous = next;
    }
    raw.exec('COMMIT');
  } finally {raw.close();}
  const reopened = await WorkspaceStore.open(root); setStore(reopened); const digest = await issue(reopened);
  const before = await reopened.execute({command: 'snapshot'}), info = await reopened.execute({command: 'info'});
  assert.equal(info.counts.audit, count);
  const changed = state(); changed.state.projects.push({id: 'PRJ-NO-CAPACITY', title: 'Must rollback'});
  const c = await command(reopened, digest, {action: 'project:create', projectId: 'PRJ-NO-CAPACITY', requestedProjectId: undefined, stateJson: JSON.stringify(changed), now: at + 1});
  delete c.requestedProjectId;
  await reject(reopened.execute(c as any), 'WORKSPACE_CAPACITY_EXCEEDED');
  assert.deepEqual(await reopened.execute({command: 'snapshot'}), before);
  assert.deepEqual((await reopened.execute({command: 'info'})).counts, info.counts);
  assert.equal((await reopened.execute({command: 'info'})).policyRevision, info.policyRevision);
  const inspect = new Sqlite(file, {readonly: true, fileMustExist: true});
  try {assert.equal(inspect.prepare('SELECT count(*) AS n FROM operations').get().n, 0); assert.equal(inspect.prepare('SELECT clockHighWater FROM metadata').get().clockHighWater, at);}
  finally {inspect.close();}
  if (count === 4095) assert.equal(await reopened.execute(lookup(c) as any), null);
  else await reject(reopened.execute(lookup(c) as any), 'WORKSPACE_CAPACITY_EXCEEDED');
}));
await test('AR10 abrupt committed child exit preserves the receipt with explicit stopped-owner recovery', () => fixture(async ({store, root, setStore}) => {
  await bootstrap(store); await store.close();
  const operationId = crypto.randomUUID(), requestHash = hash('crash request'), changed = state(); changed.state.projects[0].title = 'Committed before process exit';
  const storeUrl = new URL('../server/security/workspaceAccess/store.ts', import.meta.url).href;
  const source = `import fs from 'node:fs';import {WorkspaceStore} from ${JSON.stringify(storeUrl)};const s=await WorkspaceStore.open(${JSON.stringify(root)});const i=await s.execute({command:'info'});await s.execute({command:'issue',principalId:'synthetic-owner',expectedCredentialRevision:1,expectedGeneration:i.generation,digest:'${'c'.repeat(64)}',now:${at}});await s.execute({command:'commitReceipt',operationId:'${operationId}',digest:'${'c'.repeat(64)}',action:'project:write',projectId:'PRJ-A',requestedProjectId:'PRJ-A',requestHash:'${requestHash}',expectedRevision:i.snapshotRevision,expectedPolicyRevision:i.policyRevision,stateJson:${JSON.stringify(JSON.stringify(changed))},now:${at}});fs.writeSync(1,'COMMITTED\\n');process.kill(process.pid,'SIGKILL');`;
  const child = spawn(process.execPath, [...process.execArgv, '--input-type=module', '-e', source], {cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '', errors = '';
  child.stdout.on('data', chunk => {output += chunk;}); child.stderr.on('data', chunk => {errors += chunk;});
  await new Promise<void>((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {timedOut = true; child.kill('SIGKILL');}, 20_000);
    child.once('error', error => {clearTimeout(timer); reject(error);});
    child.once('close', () => {clearTimeout(timer); timedOut ? reject(Error('Receipt child exceeded its bounded qualification window')) : resolve();});
  });
  assert.match(output, /COMMITTED/); assert.equal(errors, '');
  await reject(WorkspaceStore.open(root), 'WORKSPACE_BUSY'); assert.equal(recoverWorkspaceLock(root), true);
  const reopened = await WorkspaceStore.open(root); setStore(reopened); const digest = await issue(reopened);
  const receipt = await reopened.execute({command: 'lookupReceipt', operationId, digest, action: 'project:write', projectId: 'PRJ-A', requestHash, now: at});
  assert.equal(receipt.effectHash, hash(JSON.stringify(changed))); assert.equal(receipt.snapshotRevision, 2);
  assert.equal(JSON.parse((await reopened.execute({command: 'snapshot'})).stateJson).state.projects[0].title, 'Committed before process exit');
  const events = await reopened.execute({command: 'audit'});
  assert.equal(events.filter((event: any) => event.type === 'PROJECT_SNAPSHOT_COMMITTED').length, 1);
  assert.equal(events.filter((event: any) => event.type === 'ACTION_RECEIPT_COMMITTED').length, 1);
}));
await test('AR11 raw worker rejects a nonboolean receipt option before creating a database', async () => {
  const parent = fs.realpathSync.native(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'dmk-action-receipt-'));
  let worker: Worker | undefined;
  try {
    // This admission failure must precede private-path and native acquisition;
    // no owner handle is needed or manufactured for a rejected option.
    worker = new Worker(new URL('../server/security/workspaceAccess/worker.cjs', import.meta.url), {workerData: {workspaceRoot: root, root: path.join(root, '.security'), initialize: true, actionReceipts: 'true'}, execArgv: []});
    const ready = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {reject(Error('Raw worker did not respond within existing startup budget'));}, 10_000);
      worker!.once('message', value => {clearTimeout(timer); resolve(value);}); worker!.once('error', error => {clearTimeout(timer); reject(error);});
    });
    assert.deepEqual(ready, {ready: false, error: 'WORKSPACE_INPUT_INVALID'});
    assert.equal(fs.existsSync(path.join(root, '.security')), false);
  } finally {
    await worker?.terminate();
    assert.equal(path.dirname(path.resolve(root)), parent); assert.match(path.basename(root), /^dmk-action-receipt-/); fs.rmSync(root, {recursive: true});
  }
});
console.log(JSON.stringify({suite: 'workspace-action-receipts', mode: diagnostic ? diagnostic + '-diagnostic-only' : 'complete', node: process.version, passed, failed}));
if (failed) process.exitCode = 1;
