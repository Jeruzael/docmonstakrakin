import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const api = await import(new URL('../server/security/workspaceAccess/store.ts', import.meta.url).href).catch(() => undefined);
let passed = 0, failed = 0;
function check(name: string, fn: () => void) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + String(e)); } }
check('WS01 independent workspace authority store exists', () => assert.equal(typeof api?.WorkspaceStore?.open, 'function', 'WorkspaceStore not implemented'));
async function test(name: string, fn: () => Promise<void>) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + String(e)); } }
const verifier = '$argon2id$v=19$m=32768,p=1,t=3$' + Buffer.alloc(16).toString('base64').replace(/=/g, '') + '$' + Buffer.alloc(32).toString('base64').replace(/=/g, '');
const principal = (id = 'synthetic-owner', roles: string[] = [], canCreateProjects = true) => ({ id, name: id, personId: 'SYNTHETIC-PERSON-' + id, kind: 'HUMAN', roles, canCreateProjects, disabled: false, credentialRevision: 1 });
const state = () => ({ schemaVersion: 1, state: { projects: [{ id: 'PRJ-A', title: 'A' }, { id: 'PRJ-B', title: 'B' }, { id: 'PRJ-DOCMONSTAKRAKIN', title: 'Canonical' }], questions: { 'PRJ-A': [], 'PRJ-B': [] }, requirements: { 'PRJ-A': [], 'PRJ-B': [] } } });
const token = () => crypto.randomBytes(32).toString('hex');
const at = 1_700_000_000_000;
const reject = (promise: Promise<any>, code: string) => assert.rejects(promise, (e: any) => e.code === code, code);
async function fixture(fn: (f: any) => Promise<void>) {
  const parent = fs.realpathSync.native(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'dmk-workspace-store-'));
  let store: any;
  try { store = await api.WorkspaceStore.open(root, { initialize: true }); await fn({ root, store, setStore: (s: any) => { store = s; } }); }
  finally { if (store) await store.close(); assert.equal(path.dirname(path.resolve(root)), parent); assert.match(path.basename(root), /^dmk-workspace-store-/); fs.rmSync(root, { recursive: true }); }
}
async function bootstrap(store: any, p = principal()) {
  await store.execute({ command: 'bootstrap', principal: p, verifier, stateJson: JSON.stringify(state()) });
  const info = await store.execute({ command: 'info' }), digest = token();
  await store.execute({ command: 'issue', principalId: p.id, expectedCredentialRevision: 1, expectedGeneration: info.generation, digest, now: at }); return digest;
}
async function commit(store: any, digest: string, changed: any, extra: any = {}) {
  const i = await store.execute({ command: 'info' });
  return store.execute({ command: 'commit', operationId: crypto.randomUUID(), digest, action: 'project:write', projectId: 'PRJ-A', expectedRevision: i.snapshotRevision, expectedPolicyRevision: i.policyRevision, stateJson: JSON.stringify(changed), now: at, ...extra });
}
if (api) {
  await test('WS02 missing authority is setup-required and never creates a default root', async () => {
    const parent = fs.realpathSync.native(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'dmk-workspace-store-'));
    try { await reject(api.WorkspaceStore.open(root), 'WORKSPACE_NOT_INITIALIZED'); assert.equal(fs.existsSync(path.join(root, '.security')), false); }
    finally { assert.equal(path.dirname(root), parent); fs.rmSync(root, { recursive: true }); }
  });
  await test('WS03 actual SQLite initialization, one-time bootstrap, no implicit grants, private credential shape', () => fixture(async ({ store, root }) => {
    const original = JSON.stringify(state()), digest = await bootstrap(store);
    await reject(store.execute({ command: 'bootstrap', principal: principal(), verifier }), 'WORKSPACE_ALREADY_INITIALIZED');
    const info = await store.execute({ command: 'info' }); assert.equal(info.initialized, true); assert.equal(info.schemaVersion, 1);
    assert.equal(info.counts.memberships, 0); assert.equal(info.provenance.sqlite, '3.53.4');
    const credential = await store.execute({ command: 'credential', name: 'synthetic-owner' });
    assert.equal(credential.principal.kind, 'HUMAN'); assert.deepEqual(credential.principal.roles, []); assert.equal(credential.verifier, verifier);
    assert.equal((await store.execute({ command: 'snapshot' })).stateJson, original);
    assert.equal((await store.execute({ command: 'authorize', digest, action: 'project:read', projectId: 'PRJ-A', now: at })).allowed, false);
    await reject(api.WorkspaceStore.open(root), 'WORKSPACE_BUSY'); assert.equal(fs.existsSync(path.join(root, '.local/project-state.json')), false);
  }));
  await test('WS04 member authors write; review needs separate SO/LA and explicit DENY wins', () => fixture(async ({ store }) => {
    const digest = await bootstrap(store);
    await store.execute({ command: 'membership', projectId: 'PRJ-A', principalId: 'synthetic-owner', role: 'EDITOR' });
    const auth = (action: string) => store.execute({ command: 'authorize', digest, action, projectId: 'PRJ-A', now: at });
    assert.equal((await auth('project:write')).allowed, true); assert.equal((await auth('project:review')).allowed, false);
    assert.equal((await auth('project:import')).allowed, false); assert.equal((await auth('privileged:write')).allowed, false);
    await store.execute({ command: 'membership', projectId: 'PRJ-A', principalId: 'synthetic-owner', role: 'OWNER', deniedActions: ['project:write'] });
    assert.equal((await auth('project:write')).reason, 'EXPLICIT_DENY');
    await store.execute({ command: 'provision', principal: principal('synthetic-reviewer', ['Security Officer'], false), verifier });
    await store.execute({ command: 'membership', projectId: 'PRJ-A', principalId: 'synthetic-reviewer', role: 'EDITOR' });
    const i = await store.execute({ command: 'info' }), second = token();
    await store.execute({ command: 'issue', principalId: 'synthetic-reviewer', expectedCredentialRevision: 1, expectedGeneration: i.generation, digest: second, now: at });
    assert.equal((await store.execute({ command: 'authorize', digest: second, action: 'project:review', projectId: 'PRJ-A', now: at })).allowed, true);
    await reject(store.execute({ command: 'membership', projectId: 'PRJ-DOCMONSTAKRAKIN', principalId: 'synthetic-owner', role: 'OWNER' }), 'WORKSPACE_CANONICAL_READ_ONLY');
  }));
  await test('WS05 snapshot/CAS/current policy rollback excludes collateral and revoked authority', () => fixture(async ({ store }) => {
    const digest = await bootstrap(store);
    await store.execute({ command: 'membership', projectId: 'PRJ-A', principalId: 'synthetic-owner', role: 'OWNER' });
    const good = state(); good.state.projects[0].title = 'updated';
    const success = await commit(store, digest, good); assert.equal(success.snapshotRevision, 2);
    const before = await store.execute({ command: 'snapshot' }), info = await store.execute({ command: 'info' });
    const collateral = structuredClone(good); collateral.state.projects[1].title = 'stolen';
    await reject(commit(store, digest, collateral), 'WORKSPACE_SCOPE_INVALID');
    const keyed = structuredClone(good); (keyed.state.questions['PRJ-B'] as any[]).push({ id: 'foreign' });
    await reject(commit(store, digest, keyed), 'WORKSPACE_SCOPE_INVALID');
    assert.deepEqual(await store.execute({ command: 'snapshot' }), before); assert.equal((await store.execute({ command: 'info' })).counts.audit, info.counts.audit);
    await store.execute({ command: 'membership', projectId: 'PRJ-A', principalId: 'synthetic-owner', role: 'DENY' });
    const postPolicy = await store.execute({ command: 'info' });
    await reject(commit(store, digest, good, { expectedPolicyRevision: info.policyRevision }), 'WORKSPACE_STALE_REVISION');
    await reject(commit(store, digest, good), 'WORKSPACE_ACCESS_DENIED');
    assert.deepEqual(await store.execute({ command: 'snapshot' }), before); assert.equal((await store.execute({ command: 'info' })).counts.audit, postPolicy.counts.audit);
  }));
  await test('WS06 creation ownership, import replacement, replay tombstone and existing-object isolation are atomic', () => fixture(async ({ store }) => {
    const digest = await bootstrap(store), created = state(); created.state.projects.push({ id: 'PRJ-C', title: 'Created' });
    const operationId = crypto.randomUUID(); await commit(store, digest, created, { action: 'project:create', projectId: undefined, operationId });
    assert.equal((await store.execute({ command: 'authorize', digest, action: 'project:import', projectId: 'PRJ-C', now: at })).allowed, true);
    const before = await store.execute({ command: 'snapshot' }), info = await store.execute({ command: 'info' });
    await reject(commit(store, digest, created, { action: 'project:create', projectId: undefined, operationId }), 'WORKSPACE_OPERATION_REPLAY');
    assert.deepEqual(await store.execute({ command: 'snapshot' }), before); assert.equal((await store.execute({ command: 'info' })).counts.audit, info.counts.audit);
    const attack = structuredClone(created); attack.state.projects.push({ id: 'PRJ-D', title: 'D' }); attack.state.projects[1].title = 'collateral';
    await reject(commit(store, digest, attack, { action: 'project:create', projectId: undefined }), 'WORKSPACE_SCOPE_INVALID');
    const replacement = structuredClone(created); replacement.state.projects.find(p => p.id === 'PRJ-C')!.title = 'import replacement';
    await commit(store, digest, replacement, { action: 'project:import', projectId: 'PRJ-C' });
  }));
  await test('WS07 session rotation/credential CAS/revocation and monotonic time never restore authority', () => fixture(async ({ store }) => {
    const digest = await bootstrap(store), replacement = token();
    assert.equal(await store.execute({ command: 'rotate', digest, replacementDigest: replacement, now: at }), true);
    assert.equal(await store.execute({ command: 'session', digest, now: at }), null);
    assert.equal(await store.execute({ command: 'rotate', digest, replacementDigest: token(), now: at }), false);
    assert.equal((await store.execute({ command: 'session', digest: replacement, now: at })).principal.kind, 'HUMAN');
    await reject(store.execute({ command: 'changeCredential', digest: replacement, expectedCredentialRevision: 2, verifier, now: at }), 'WORKSPACE_STALE_CREDENTIAL');
    await store.execute({ command: 'changeCredential', digest: replacement, expectedCredentialRevision: 1, verifier, now: at });
    assert.equal(await store.execute({ command: 'session', digest: replacement, now: at }), null);
    await reject(store.execute({ command: 'issue', principalId: 'synthetic-owner', expectedCredentialRevision: 1, expectedGeneration: 1, digest: token(), now: at }), 'WORKSPACE_STALE_CREDENTIAL');
    await reject(store.execute({ command: 'admitLogin', key: 'owner', now: at - 1 }), 'WORKSPACE_CLOCK_ROLLBACK');
  }));
  await test('WS08 persisted throttle and restart generation fence old sessions without JSON writes', () => fixture(async ({ store, root, setStore }) => {
    const digest = await bootstrap(store);
    for (let i = 0; i < 5; i++) assert.equal(await store.execute({ command: 'admitLogin', key: 'owner', now: at }), true);
    assert.equal(await store.execute({ command: 'admitLogin', key: 'owner', now: at }), false);
    const first = await store.execute({ command: 'info' }), snapshot = await store.execute({ command: 'snapshot' });
    await store.close(); const reopened = await api.WorkspaceStore.open(root); setStore(reopened);
    assert.equal((await reopened.execute({ command: 'info' })).generation, first.generation + 1);
    assert.equal(await reopened.execute({ command: 'session', digest, now: at }), null);
    assert.equal(await reopened.execute({ command: 'admitLogin', key: 'owner', now: at }), false);
    assert.deepEqual(await reopened.execute({ command: 'snapshot' }), snapshot); assert.equal(fs.existsSync(path.join(root, '.local')), false);
  }));
  await test('WS09 unknown commands, AGENT provisioning and executable/oversized input fail closed', () => fixture(async ({ store }) => {
    await bootstrap(store);
    await reject(store.execute({ command: 'rootBypass' }), 'WORKSPACE_COMMAND_UNSUPPORTED');
    await reject(store.execute({ command: 'provision', principal: { ...principal('rogue'), kind: 'AGENT' }, verifier }), 'WORKSPACE_INPUT_INVALID');
    await reject(store.execute({ command: 'provision', principal: { ...principal('sparse'), roles: new Array(1_000_000) }, verifier }), 'WORKSPACE_INPUT_INVALID');
    let executed = false; const command = Object.defineProperty({}, 'command', { enumerable: true, get() { executed = true; return 'info'; } });
    await reject(store.execute(command), 'WORKSPACE_INPUT_INVALID'); assert.equal(executed, false);
    await reject(store.execute({ command: 'commit', stateJson: ' '.repeat(64 * 1024 * 1024 + 16_385) }), 'WORKSPACE_INPUT_INVALID');
    const audit = JSON.stringify(await store.execute({ command: 'audit' })); assert.equal(audit.includes(verifier), false); assert.equal(audit.includes('synthetic-owner'), false);
  }));
  await test('WS10 self-project export appends only one export event and cannot mutate content', () => fixture(async ({ store }) => {
    const digest = await bootstrap(store);
    await store.execute({ command: 'membership', principalId: 'synthetic-owner', projectId: 'PRJ-DOCMONSTAKRAKIN', role: 'READER' });
    assert.equal((await store.execute({ command: 'authorize', digest, action: 'project:export', projectId: 'PRJ-DOCMONSTAKRAKIN', now: at })).allowed, true);
    const exported: any = state(); exported.state.auditLogs = { 'PRJ-DOCMONSTAKRAKIN': [{ id: 'EXPORT-SYNTHETIC-1', action: 'PACKAGE_EXPORTED' }] };
    await commit(store, digest, exported, { action: 'project:export', projectId: 'PRJ-DOCMONSTAKRAKIN' });
    const before = await store.execute({ command: 'snapshot' });
    const attack = structuredClone(exported); attack.state.projects[2].title = 'unauthorized'; attack.state.auditLogs['PRJ-DOCMONSTAKRAKIN'].unshift({ id: 'EXPORT-SYNTHETIC-2', action: 'PACKAGE_EXPORTED' });
    await reject(commit(store, digest, attack, { action: 'project:export', projectId: 'PRJ-DOCMONSTAKRAKIN' }), 'WORKSPACE_SCOPE_INVALID');
    const forged = structuredClone(exported); forged.state.auditLogs['PRJ-DOCMONSTAKRAKIN'].unshift({ id: 'FORGED', action: 'RELEASE_APPROVED' });
    await reject(commit(store, digest, forged, { action: 'project:export', projectId: 'PRJ-DOCMONSTAKRAKIN' }), 'WORKSPACE_SCOPE_INVALID');
    assert.deepEqual(await store.execute({ command: 'snapshot' }), before);
  }));
  await test('WS11 exact idle/absolute lifetimes and disabled principal deny current actions', () => fixture(async ({ store }) => {
    const digest = await bootstrap(store), info = await store.execute({ command: 'info' }), second = token();
    await store.execute({ command: 'issue', principalId: 'synthetic-owner', expectedCredentialRevision: 1, expectedGeneration: info.generation, digest: second, now: at });
    assert.equal(await store.execute({ command: 'session', digest, now: at + 600_000 }), null);
    // The second session is also expired; a newly issued session exercises the
    // independent absolute fence while activity keeps its idle fence current.
    const active = token(); await store.execute({ command: 'issue', principalId: 'synthetic-owner', expectedCredentialRevision: 1, expectedGeneration: info.generation, digest: active, now: at + 600_000 });
    for (const offset of [1_199_999, 1_799_998, 2_399_997]) assert.ok(await store.execute({ command: 'session', digest: active, now: at + offset }));
    assert.equal(await store.execute({ command: 'session', digest: active, now: at + 2_400_000 }), null);
    await store.execute({ command: 'disable', principalId: 'synthetic-owner' });
    assert.equal(await store.execute({ command: 'credential', name: 'synthetic-owner' }), null);
    await reject(store.execute({ command: 'issue', principalId: 'synthetic-owner', expectedCredentialRevision: 1, expectedGeneration: info.generation, digest: token(), now: at + 2_400_000 }), 'WORKSPACE_STALE_CREDENTIAL');
  }));
  await test('WS12 full retained audit capacity rolls back snapshot/ownership/clock and retains diagnostic reads', () => fixture(async ({ store, root, setStore }) => {
    await bootstrap(store); await store.close();
    const Sqlite = createRequire(import.meta.url)('better-sqlite3'), raw = new Sqlite(path.join(root, '.security/authority.sqlite'));
    try {
      let previous = raw.prepare('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').get().hash;
      const existing = raw.prepare('SELECT count(*) AS n FROM audit').get().n;
      raw.exec('BEGIN IMMEDIATE');
      for (let n = existing; n < 4094; n++) {
        const data = JSON.stringify({ type: 'SYNTHETIC_CAPACITY_FIXTURE', targetHash: null, at, generation: 1, policyRevision: 1, snapshotRevision: 1 });
        const hash = crypto.createHash('sha256').update(previous + '\n' + data).digest('hex'); raw.prepare('INSERT INTO audit(raw,previousHash,hash) VALUES(?,?,?)').run(data, previous, hash); previous = hash;
      }
      raw.exec('COMMIT');
    } finally { raw.close(); }
    const reopened = await api.WorkspaceStore.open(root); setStore(reopened);
    const info = await reopened.execute({ command: 'info' }), digest = token();
    await reopened.execute({ command: 'issue', principalId: 'synthetic-owner', expectedCredentialRevision: 1, expectedGeneration: info.generation, digest, now: at });
    assert.equal((await reopened.execute({ command: 'info' })).counts.audit, 4096);
    const before = await reopened.execute({ command: 'snapshot' }), created = state(); created.state.projects.push({ id: 'PRJ-OVER-CAPACITY', title: 'must rollback' });
    await reject(commit(reopened, digest, created, { action: 'project:create', projectId: undefined, now: at + 1 }), 'WORKSPACE_CAPACITY_EXCEEDED');
    assert.deepEqual(await reopened.execute({ command: 'snapshot' }), before); assert.equal((await reopened.execute({ command: 'info' })).counts.memberships, 0);
    assert.equal((await reopened.execute({ command: 'audit' })).length, 4096);
    const inspection = new Sqlite(path.join(root, '.security/authority.sqlite'), { readonly: true, fileMustExist: true });
    try { assert.equal(inspection.prepare('SELECT clockHighWater FROM metadata WHERE id=1').get().clockHighWater, at); assert.equal(inspection.prepare('SELECT count(*) AS n FROM operations').get().n, 0); }
    finally { inspection.close(); }
  }));
  await test('WS13 linked authority files and corruption refuse reopen without deleting evidence', () => fixture(async ({ store, root }) => {
    await bootstrap(store); await store.close(); const db = path.join(root, '.security/authority.sqlite'), retained = fs.readFileSync(db), extra = path.join(root, 'authority-hardlink.sqlite');
    fs.linkSync(db, extra); await reject(api.WorkspaceStore.open(root), 'WORKSPACE_PATH_INVALID'); fs.unlinkSync(extra);
    const Sqlite = createRequire(import.meta.url)('better-sqlite3'), raw = new Sqlite(db); raw.pragma('user_version=2'); raw.close();
    await reject(api.WorkspaceStore.open(root), 'WORKSPACE_SCHEMA_UNSUPPORTED'); assert.ok(fs.readFileSync(db).length >= retained.length);
    fs.writeFileSync(db, Buffer.from('intentionally corrupt SYNTHETIC fixture'));
    await reject(api.WorkspaceStore.open(root), 'WORKSPACE_CORRUPT'); assert.equal(fs.readFileSync(db).toString(), 'intentionally corrupt SYNTHETIC fixture');
  }));
  await test('WS14 abrupt committed child exit retains lock; explicit stopped-owner recovery preserves replay refusal', () => fixture(async ({ store, root, setStore }) => {
    await bootstrap(store); await store.close();
    const operationId = crypto.randomUUID(), changed = state(); changed.state.projects.push({ id: 'PRJ-CRASH', title: 'Committed before lost reply' });
    const storeUrl = new URL('../server/security/workspaceAccess/store.ts', import.meta.url).href;
    const source = `import fs from 'node:fs';import {WorkspaceStore} from ${JSON.stringify(storeUrl)};const s=await WorkspaceStore.open(${JSON.stringify(root)});const i=await s.execute({command:'info'});await s.execute({command:'issue',principalId:'synthetic-owner',expectedCredentialRevision:1,expectedGeneration:i.generation,digest:'${'a'.repeat(64)}',now:${at}});await s.execute({command:'commit',operationId:'${operationId}',digest:'${'a'.repeat(64)}',action:'project:create',expectedRevision:i.snapshotRevision,expectedPolicyRevision:i.policyRevision,stateJson:${JSON.stringify(JSON.stringify(changed))},now:${at}});fs.writeSync(1,'COMMITTED\\n');process.kill(process.pid,'SIGKILL');`;
    const loader = pathToFileURL(path.join(process.cwd(), 'node_modules/tsx/dist/loader.mjs')).href;
    const child = spawn(process.execPath, ['--import', loader, '--input-type=module', '-e', source], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { errors += b; });
    await new Promise<void>((resolve, reject) => { let timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 20_000); child.on('error', e => { clearTimeout(timer); reject(e); }); child.on('close', () => { clearTimeout(timer); timedOut ? reject(Error('Child commit timeout')) : resolve(); }); });
    assert.match(output, /COMMITTED/, errors); await reject(api.WorkspaceStore.open(root), 'WORKSPACE_BUSY');
    const recovery = await import('../server/security/workspaceAccess/privateDirectory.ts'); assert.equal(recovery.recoverWorkspaceLock(root), true);
    const reopened = await api.WorkspaceStore.open(root); setStore(reopened);
    assert.equal(JSON.parse((await reopened.execute({ command: 'snapshot' })).stateJson).state.projects.some((p: any) => p.id === 'PRJ-CRASH'), true);
    const i = await reopened.execute({ command: 'info' }), digest = token();
    await reopened.execute({ command: 'issue', principalId: 'synthetic-owner', expectedCredentialRevision: 1, expectedGeneration: i.generation, digest, now: at });
    const before = await reopened.execute({ command: 'snapshot' });
    await reject(commit(reopened, digest, changed, { operationId, action: 'project:create', projectId: undefined }), 'WORKSPACE_OPERATION_REPLAY');
    assert.deepEqual(await reopened.execute({ command: 'snapshot' }), before);
  }));
  await test('WS15 snapshot duplicate/unknown/foreign project bindings and nonfinite numbers reject without mutation', () => fixture(async ({ store }) => {
    const digest = await bootstrap(store); await store.execute({ command: 'membership', projectId: 'PRJ-A', principalId: 'synthetic-owner', role: 'OWNER' });
    const before = await store.execute({ command: 'snapshot' });
    const foreign = state(); (foreign.state.questions['PRJ-A'] as any[]).push({ id: 'foreign', projectId: 'PRJ-B' });
    await reject(commit(store, digest, foreign), 'WORKSPACE_SNAPSHOT_INVALID');
    await reject(commit(store, digest, { ...state(), state: { ...state().state, principals: { admin: true } } }), 'WORKSPACE_INPUT_INVALID');
    const raw = JSON.stringify(state());
    await reject(commit(store, digest, state(), { stateJson: raw.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1') }), 'WORKSPACE_SNAPSHOT_INVALID');
    await reject(commit(store, digest, state(), { stateJson: raw.replace('"title":"A"', '"title":1e999') }), 'WORKSPACE_SNAPSHOT_INVALID');
    assert.deepEqual(await store.execute({ command: 'snapshot' }), before);
  }));
  await test('WS16 altered owned schema refuses reopen before granting authority', () => fixture(async ({ store, root }) => {
    await bootstrap(store); await store.close(); const Sqlite = createRequire(import.meta.url)('better-sqlite3'), raw = new Sqlite(path.join(root, '.security/authority.sqlite'));
    raw.exec('CREATE TABLE unrecognized_authority(id TEXT)'); raw.close(); await reject(api.WorkspaceStore.open(root), 'WORKSPACE_SCHEMA_UNSUPPORTED');
  }));
}
console.log(`Workspace store: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
