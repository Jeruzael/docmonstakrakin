/** Genuine SQLite worker; every identity and record lives in disposable state. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';

const Sqlite = createRequire(import.meta.url)('better-sqlite3');
const verifier = '$argon2id$v=19$m=32768,p=1,t=3$' + Buffer.alloc(16).toString('base64').replace(/=/g, '') + '$' + Buffer.alloc(32).toString('base64').replace(/=/g, '');
const principal = {id: 'synthetic-admission', name: 'synthetic-admission', personId: 'SYNTHETIC-ADMISSION-PERSON', kind: 'HUMAN' as const,
  roles: [], canCreateProjects: false, disabled: false, credentialRevision: 1};
const state = JSON.stringify({schemaVersion: 1, state: {projects: [{id: 'PRJ-SYNTHETIC-ADMISSION', title: 'Synthetic admission'}]}});
const at = 1_700_000_000_000;
const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
let passed = 0, failed = 0;
async function test(name: string, run: () => Promise<void>) {try {await run(); passed++; console.log('PASS ' + name);} catch (error) {failed++; console.error('FAIL ' + name + ': ' + String(error));}}
function chain(records: any[]) {
  let head = '0'.repeat(64), sequence = 0;
  for (const {sequence: next, previousHash, hash, ...raw} of records) {
    assert.equal(next, ++sequence); assert.equal(previousHash, head); assert.equal(hash, sha(head + '\n' + JSON.stringify(raw))); head = hash;
  }
  return head;
}
async function fixture(run: (value: {root: string; store: WorkspaceStore; reopen: () => Promise<WorkspaceStore>}) => Promise<void>) {
  const parent = fs.realpathSync.native(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'dmk-login-admission-'));
  const identity = fs.lstatSync(root, {bigint: true}); let store: WorkspaceStore | undefined;
  try {
    store = await WorkspaceStore.open(root, {initialize: true});
    await store.execute({command: 'bootstrap', principal, verifier, stateJson: state});
    await run({root, store, reopen: async () => {await store!.close(); store = await WorkspaceStore.open(root); return store;}});
  } finally {
    await store?.close(); const final = fs.lstatSync(root, {bigint: true});
    assert.equal(path.dirname(fs.realpathSync.native(root)), parent); assert.match(path.basename(root), /^dmk-login-admission-/);
    assert.equal(final.dev, identity.dev); assert.equal(final.ino, identity.ino); fs.rmSync(root, {recursive: true});
  }
}
await test('LA01 repeated and global-denied public attempts retain no critical audit and cannot allocate new keys', () => fixture(async ({store}) => {
  const before = await store.execute({command: 'audit'}), snapshot = await store.execute({command: 'snapshot'}); chain(before);
  for (let i = 0; i < 12; i++) assert.equal(await store.execute({command: 'admitLogin', key: 'synthetic-one-account', now: at}), i < 5);
  for (let i = 0; i < 18; i++) assert.equal(await store.execute({command: 'admitLogin', key: crypto.randomUUID(), now: at}), true);
  const namesAtGlobalLimit = (await store.execute({command: 'info'})).counts.throttleKeys;
  assert.equal(namesAtGlobalLimit, 20, 'one global row, one repeated name and eighteen new names');
  for (let i = 0; i < 12; i++) assert.equal(await store.execute({command: 'admitLogin', key: crypto.randomUUID(), now: at}), false);
  assert.equal((await store.execute({command: 'info'})).counts.throttleKeys, namesAtGlobalLimit, 'global denial must precede new name allocation');
  assert.deepEqual(await store.execute({command: 'audit'}), before, 'public retries must not consume retained authority history');
  assert.equal(await store.execute({command: 'admitLogin', key: crypto.randomUUID(), now: at + 60_000}), true);
  const after = await store.execute({command: 'info'}); assert.equal(after.counts.throttleKeys, 2); assert.equal(after.counts.sessions, 0);
  assert.deepEqual(await store.execute({command: 'audit'}), before, 'rate-window reclamation must not append authority history');
  assert.deepEqual(await store.execute({command: 'snapshot'}), snapshot);
}));
await test('LA02 counters survive restart while session, membership and project commits retain their audit', () => fixture(async ({store, reopen}) => {
  const original = await store.execute({command: 'audit'}); chain(original);
  for (let i = 0; i < 6; i++) assert.equal(await store.execute({command: 'admitLogin', key: 'synthetic-restart-account', now: at}), i < 5);
  assert.deepEqual(await store.execute({command: 'audit'}), original);
  const current = await reopen(), restarted = await current.execute({command: 'audit'});
  assert.deepEqual(restarted.slice(0, original.length), original); assert.equal(restarted.length, original.length + 1);
  assert.equal(restarted.at(-1).type, 'AUTHORITY_OPENED'); chain(restarted);
  assert.equal(await current.execute({command: 'admitLogin', key: 'synthetic-restart-account', now: at + 1}), false);
  assert.deepEqual(await current.execute({command: 'audit'}), restarted);
  assert.equal((await current.execute({command: 'info'})).counts.throttleKeys, 2);
  await current.execute({command: 'membership', principalId: principal.id, projectId: 'PRJ-SYNTHETIC-ADMISSION', role: 'OWNER', deniedActions: []});
  const info = await current.execute({command: 'info'}), digest = 'a'.repeat(64);
  await current.execute({command: 'issue', principalId: principal.id, expectedCredentialRevision: 1, expectedGeneration: info.generation, digest, now: at + 1});
  const changed = JSON.parse(state); changed.state.projects[0].title = 'Synthetic committed change';
  await current.execute({command: 'commit', operationId: crypto.randomUUID(), digest, action: 'project:write', projectId: 'PRJ-SYNTHETIC-ADMISSION',
    expectedRevision: info.snapshotRevision, expectedPolicyRevision: info.policyRevision, stateJson: JSON.stringify(changed), now: at + 1});
  assert.equal(await current.execute({command: 'logout', digest, now: at + 1}), true);
  const audited = await current.execute({command: 'audit'}); assert.deepEqual(audited.slice(0, restarted.length), restarted); chain(audited);
  assert.deepEqual(audited.slice(restarted.length).map((e: any) => e.type), ['MEMBERSHIP_CHANGED', 'SESSION_ISSUED', 'PROJECT_SNAPSHOT_COMMITTED', 'SESSION_REVOKED']);
}));
await test('LA03 full critical audit refuses public admission without changing counters, clock, snapshot or chain', () => fixture(async ({root, store, reopen}) => {
  await store.close(); const file = path.join(root, '.security/authority.sqlite'), raw = new Sqlite(file);
  try {
    const metadata = raw.prepare('SELECT * FROM metadata WHERE id=1').get();
    let previous = raw.prepare('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').get().hash;
    const existing = raw.prepare('SELECT count(*) AS n FROM audit').get().n; raw.exec('BEGIN IMMEDIATE');
    for (let i = existing; i < 4095; i++) {
      const data = JSON.stringify({type: 'SYNTHETIC_CAPACITY_FIXTURE', targetHash: null, at: metadata.clockHighWater, generation: metadata.generation,
        policyRevision: metadata.policyRevision, snapshotRevision: metadata.snapshotRevision});
      const hash = sha(previous + '\n' + data); raw.prepare('INSERT INTO audit(raw,previousHash,hash) VALUES(?,?,?)').run(data, previous, hash); previous = hash;
    }
    raw.exec('COMMIT');
  } finally {raw.close();}
  const current = await reopen(), before = await current.execute({command: 'audit'}), snapshot = await current.execute({command: 'snapshot'});
  assert.equal(before.length, 4096); const head = chain(before);
  await assert.rejects(current.execute({command: 'admitLogin', key: crypto.randomUUID(), now: at}), (error: any) => error.code === 'WORKSPACE_CAPACITY_EXCEEDED');
  assert.deepEqual(await current.execute({command: 'audit'}), before); assert.equal(chain(await current.execute({command: 'audit'})), head);
  assert.deepEqual(await current.execute({command: 'snapshot'}), snapshot);
  const inspection = new Sqlite(file, {readonly: true, fileMustExist: true});
  try {assert.equal(inspection.prepare('SELECT count(*) AS n FROM throttle').get().n, 0); assert.equal(inspection.prepare('SELECT clockHighWater FROM metadata WHERE id=1').get().clockHighWater, 0);}
  finally {inspection.close();}
}));
console.log(`Workspace login admission: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
