import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { WorkspaceStore } from '../server/security/workspaceAccess/store.ts';
import { assertPrivateDirectory, assertPrivateFile, recoverWorkspaceLock } from '../server/security/workspaceAccess/privateDirectory.ts';

const api = await import(new URL('../server/security/workspaceAccess/backup.ts', import.meta.url).href).catch(() => undefined);
let passed = 0, failed = 0;
async function test(name: string, fn: () => unknown | Promise<unknown>) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + String(e)); }
}
const hash = (bytes: Buffer | string) => crypto.createHash('sha256').update(bytes).digest('hex');
const rejects = (promise: Promise<any>, code: string) => assert.rejects(promise, (e: any) => e.code === code, code);
const Sqlite = createRequire(import.meta.url)('better-sqlite3');
const verifier = '$argon2id$v=19$m=32768,p=1,t=3$' + Buffer.alloc(16).toString('base64').replace(/=/g, '') + '$' + Buffer.alloc(32).toString('base64').replace(/=/g, '');
const principal = { id: 'synthetic-backup-owner', name: 'synthetic-backup-owner', personId: 'SYNTHETIC-BACKUP-PERSON', kind: 'HUMAN' as const, roles: [], canCreateProjects: true, disabled: false, credentialRevision: 1 };
const snapshot = JSON.stringify({ schemaVersion: 1, state: { projects: [{ id: 'PRJ-BACKUP', title: 'Synthetic recovery fixture' }] } });
const at = 1_700_000_000_000;
const parent = fs.realpathSync.native(os.tmpdir());
const root = fs.mkdtempSync(path.join(parent, 'dmk-workspace-backup-'));
const source = path.join(root, 'source'); fs.mkdirSync(source);
let store: WorkspaceStore | undefined, receipt: any, oldDigest: string, originalRows: any;
const dbPath = (workspace = source) => path.join(workspace, '.security', 'authority.sqlite');
const artifact = () => path.join(source, '.security-backups', receipt.backupId);
const backupDb = () => path.join(artifact(), 'authority.sqlite');
const manifestPath = () => path.join(artifact(), 'manifest.json');
const rows = (file: string) => {
  const db = new Sqlite(file, { readonly: true, fileMustExist: true });
  try { return { metadata: db.prepare('SELECT * FROM metadata').all(), principals: db.prepare('SELECT * FROM principals').all(), memberships: db.prepare('SELECT * FROM memberships').all(), sessions: db.prepare('SELECT * FROM sessions').all(), audit: db.prepare('SELECT * FROM audit ORDER BY sequence').all() }; }
  finally { db.close(); }
};
function reseal() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath(), 'utf8')), bytes = fs.readFileSync(backupDb());
  manifest.database.bytes = bytes.length; manifest.database.sha256 = hash(bytes);
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest) + '\n');
}

try {
  await test('BK01 backup mechanism exists', () => {
    assert.equal(typeof api?.createWorkspaceBackup, 'function', 'createWorkspaceBackup not implemented');
    assert.equal(typeof api?.verifyWorkspaceBackup, 'function'); assert.equal(typeof api?.prepareWorkspaceRestore, 'function');
  });
  if (api) {
    await test('BK02 missing authority is never initialized by backup', async () => {
      await rejects(api.createWorkspaceBackup(source), 'WORKSPACE_NOT_INITIALIZED');
      assert.deepEqual(fs.readdirSync(source), []);
    });
    store = await WorkspaceStore.open(source, { initialize: true });
    await store.execute({ command: 'bootstrap', principal, verifier, stateJson: snapshot });
    await store.execute({ command: 'membership', projectId: 'PRJ-BACKUP', principalId: principal.id, role: 'OWNER' });
    const info: any = await store.execute({ command: 'info' }); oldDigest = 'a'.repeat(64);
    await store.execute({ command: 'issue', principalId: principal.id, expectedCredentialRevision: 1, expectedGeneration: info.generation, digest: oldDigest, now: at });
    await test('BK03 live source refuses before creating any backup directory', async () => {
      await rejects(api.createWorkspaceBackup(source), 'WORKSPACE_BUSY'); assert.equal(fs.existsSync(path.join(source, '.security-backups')), false);
    });
    originalRows = rows(dbPath()); await store.close(); store = undefined;
    await test('BK04 stale source lock is retained without implicit recovery', async () => {
      const child = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { windowsHide: true }); assert.equal(child.status, 0);
      const identity = (file: string) => { const s = fs.statSync(file, { bigint: true }); return `${s.dev}:${s.ino}`; };
      const lock = path.join(source, '.security/owner.lock');
      const bytes = JSON.stringify({ pid: child.pid, token: 'b'.repeat(64), workspaceIdentity: identity(source), rootIdentity: identity(path.dirname(lock)) });
      fs.writeFileSync(lock, bytes, { flag: 'wx', mode: 0o600 }); const before = assertPrivateFile(lock);
      try { await rejects(api.createWorkspaceBackup(source), 'WORKSPACE_BUSY'); assert.equal(fs.readFileSync(lock, 'utf8'), bytes); assert.equal(assertPrivateFile(lock), before); }
      finally { assert.equal(fs.readFileSync(lock, 'utf8'), bytes); fs.unlinkSync(lock); }
    });
    await test('BK05 native SQLite backup retains exact authority, audit and snapshot without source writes', async () => {
      const before = fs.readFileSync(dbPath());
      receipt = await api.createWorkspaceBackup(source);
      assert.equal(receipt.activated, false); assert.equal(receipt.freshnessEstablished, false);
      assert.equal(receipt.databaseSha256, hash(fs.readFileSync(backupDb())));
      assert.equal(receipt.manifestSha256, hash(fs.readFileSync(manifestPath())));
      assert.deepEqual(rows(backupDb()), originalRows); assert.deepEqual(fs.readFileSync(dbPath()), before);
      assert.equal(fs.existsSync(path.join(source, '.security/owner.lock')), false);
      assert.equal(assertPrivateDirectory(path.join(source, '.security-backups')).length > 0, true);
      assert.ok(assertPrivateDirectory(artifact())); assert.ok(assertPrivateFile(backupDb())); assert.ok(assertPrivateFile(manifestPath()));
      assert.deepEqual(await api.verifyWorkspaceBackup(source, receipt.backupId, receipt.manifestSha256), receipt);
      await rejects(api.verifyWorkspaceBackup(source, receipt.backupId, '0'.repeat(64)), 'WORKSPACE_BACKUP_INVALID');
    });
    await test('BK06 canonical manifest and corrupt bytes reject before destination creation', async () => {
      const originalDb = fs.readFileSync(backupDb()), originalManifest = fs.readFileSync(manifestPath()), destination = path.join(root, 'corrupt-destination');
      try {
        fs.appendFileSync(manifestPath(), ' '); await rejects(api.verifyWorkspaceBackup(source, receipt.backupId), 'WORKSPACE_BACKUP_INVALID');
        fs.writeFileSync(manifestPath(), originalManifest); fs.writeFileSync(backupDb(), Buffer.from('SYNTHETIC corrupt database'));
        await rejects(api.prepareWorkspaceRestore(source, receipt.backupId, destination), 'WORKSPACE_BACKUP_INVALID'); assert.equal(fs.existsSync(destination), false);
        reseal(); await rejects(api.verifyWorkspaceBackup(source, receipt.backupId), 'WORKSPACE_BACKUP_INVALID');
      } finally { fs.writeFileSync(backupDb(), originalDb); fs.writeFileSync(manifestPath(), originalManifest); }
    });
    await test('BK07 resealed unsupported schema is rejected independently of byte hashes', async () => {
      const originalDb = fs.readFileSync(backupDb()), originalManifest = fs.readFileSync(manifestPath());
      try {
        let db = new Sqlite(backupDb()); db.pragma('user_version=2'); db.close(); reseal();
        await rejects(api.verifyWorkspaceBackup(source, receipt.backupId), 'WORKSPACE_BACKUP_INVALID');
        fs.writeFileSync(backupDb(), originalDb); db = new Sqlite(backupDb()); db.exec('CREATE TABLE unexpected_authority(id TEXT)'); db.close(); reseal();
        await rejects(api.verifyWorkspaceBackup(source, receipt.backupId), 'WORKSPACE_BACKUP_INVALID');
      } finally { fs.writeFileSync(backupDb(), originalDb); fs.writeFileSync(manifestPath(), originalManifest); }
    });
    await test('BK08 hard-linked database and junction artifact are rejected without following targets', async () => {
      const link = path.join(root, 'retained-hardlink.sqlite'); fs.linkSync(backupDb(), link);
      try { await rejects(api.verifyWorkspaceBackup(source, receipt.backupId), 'WORKSPACE_PATH_INVALID'); }
      finally { fs.unlinkSync(link); }
      const held = artifact() + '-held'; fs.renameSync(artifact(), held); fs.symlinkSync(held, artifact(), process.platform === 'win32' ? 'junction' : 'dir');
      try { await rejects(api.verifyWorkspaceBackup(source, receipt.backupId), 'WORKSPACE_PATH_INVALID'); assert.ok(fs.existsSync(path.join(held, 'authority.sqlite'))); }
      finally { fs.unlinkSync(artifact()); fs.renameSync(held, artifact()); }
    });
    await test('BK09 restore preparation preserves bytes/provenance and cannot activate in a new workspace', async () => {
      const destination = path.join(root, 'prepared-workspace'), original = fs.readFileSync(backupDb());
      const prepared = await api.prepareWorkspaceRestore(source, receipt.backupId, destination);
      assert.equal(prepared.activated, false); assert.equal(prepared.freshnessEstablished, false); assert.equal(prepared.databaseSha256, hash(original));
      assert.deepEqual(fs.readFileSync(dbPath(destination)), original); assert.deepEqual(rows(dbPath(destination)), rows(backupDb()));
      assert.ok(assertPrivateDirectory(destination)); assert.ok(assertPrivateDirectory(path.join(destination, '.security'))); assert.ok(assertPrivateFile(dbPath(destination)));
      assert.ok(assertPrivateFile(path.join(destination, '.security-backups/restore-preparation.json')));
      await rejects(WorkspaceStore.open(destination), 'WORKSPACE_PATH_INVALID');
      assert.deepEqual(fs.readFileSync(dbPath(destination)), original); assert.equal(fs.existsSync(path.join(destination, '.security/owner.lock')), false);
    });
    await test('BK10 any existing destination or aliased parent is rejected without overwriting', async () => {
      const destination = path.join(root, 'existing'); fs.mkdirSync(destination); const marker = path.join(destination, 'sentinel'); fs.writeFileSync(marker, 'RETAIN SYNTHETIC');
      await rejects(api.prepareWorkspaceRestore(source, receipt.backupId, destination), 'WORKSPACE_RESTORE_DESTINATION_EXISTS'); assert.equal(fs.readFileSync(marker, 'utf8'), 'RETAIN SYNTHETIC');
      const empty = path.join(root, 'existing-empty'); fs.mkdirSync(empty);
      await rejects(api.prepareWorkspaceRestore(source, receipt.backupId, empty), 'WORKSPACE_RESTORE_DESTINATION_EXISTS'); assert.deepEqual(fs.readdirSync(empty), []);
      const alias = path.join(root, 'parent-alias'); fs.symlinkSync(destination, alias, process.platform === 'win32' ? 'junction' : 'dir');
      try { await rejects(api.prepareWorkspaceRestore(source, receipt.backupId, path.join(alias, 'new')), 'WORKSPACE_PATH_INVALID'); assert.equal(fs.existsSync(path.join(destination, 'new')), false); }
      finally { fs.unlinkSync(alias); }
    });
    await test('BK11 source restart fences preserved session digests while backup remains immutable', async () => {
      const before = fs.readFileSync(backupDb()); store = await WorkspaceStore.open(source);
      assert.equal(await store.execute({ command: 'session', digest: oldDigest, now: at }), null);
      await store.close(); store = undefined; assert.deepEqual(fs.readFileSync(backupDb()), before);
    });
    await test('BK12 committed crash WAL is included only after explicit stopped-owner recovery', async () => {
      const storeUrl = new URL('../server/security/workspaceAccess/store.ts', import.meta.url).href;
      const changed = JSON.stringify({ schemaVersion: 1, state: { projects: [{ id: 'PRJ-BACKUP', title: 'Committed in crash WAL' }] } });
      const sourceCode = `import fs from 'node:fs';import {WorkspaceStore} from ${JSON.stringify(storeUrl)};const s=await WorkspaceStore.open(${JSON.stringify(source)});const i=await s.execute({command:'info'});await s.execute({command:'issue',principalId:'${principal.id}',expectedCredentialRevision:1,expectedGeneration:i.generation,digest:'${'c'.repeat(64)}',now:${at}});await s.execute({command:'commit',operationId:'${crypto.randomUUID()}',digest:'${'c'.repeat(64)}',action:'project:write',projectId:'PRJ-BACKUP',expectedRevision:i.snapshotRevision,expectedPolicyRevision:i.policyRevision,stateJson:${JSON.stringify(changed)},now:${at}});fs.writeSync(1,'COMMITTED\\n');process.kill(process.pid,'SIGKILL');`;
      const loader = pathToFileURL(path.join(process.cwd(), 'node_modules/tsx/dist/loader.mjs')).href;
      const child = spawn(process.execPath, ['--import', loader, '--input-type=module', '-e', sourceCode], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', errors = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { errors += b; });
      await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Synthetic crash child timeout')); }, 30_000); child.on('error', e => { clearTimeout(timer); reject(e); }); child.on('close', () => { clearTimeout(timer); resolve(); }); });
      assert.match(output, /COMMITTED/, errors); assert.ok(fs.statSync(dbPath() + '-wal').size > 0);
      await rejects(api.createWorkspaceBackup(source), 'WORKSPACE_BUSY'); assert.equal(recoverWorkspaceLock(source), true);
      const before = fs.readFileSync(dbPath()), wal = fs.readFileSync(dbPath() + '-wal');
      const crash = await api.createWorkspaceBackup(source), crashDb = path.join(source, '.security-backups', crash.backupId, 'authority.sqlite');
      assert.equal(rows(crashDb).metadata[0].stateJson, changed); assert.deepEqual(fs.readFileSync(dbPath()), before); assert.deepEqual(fs.readFileSync(dbPath() + '-wal'), wal);
    });
    await test('BK13 CLI rejects secret-like arguments without echoing values or opening authority', () => {
      const cli = pathToFileURL(path.join(process.cwd(), 'node_modules/tsx/dist/loader.mjs')).href;
      const executable = new URL('./workspaceBackup.ts', import.meta.url);
      const sentinel = 'SYNTHETIC-DO-NOT-ECHO-SECRET';
      const result = spawnSync(process.execPath, ['--import', cli, fileURLToPath(executable), 'create', '--password', sentinel], { cwd: root, windowsHide: true, encoding: 'utf8' });
      assert.equal(result.status, 1); assert.equal((result.stdout + result.stderr).includes(sentinel), false); assert.match(result.stderr, /WORKSPACE_BACKUP_USAGE/);
      assert.equal(fs.existsSync(path.join(root, '.security')), false);
    });
    await test('BK14 preparation cannot insert a workspace into source authority or backup directories', async () => {
      for (const reserved of ['.security', '.security-backups']) {
        const destination = path.join(source, reserved, 'new-workspace');
        try { await rejects(api.prepareWorkspaceRestore(source, receipt.backupId, destination), 'WORKSPACE_PATH_INVALID'); assert.equal(fs.existsSync(destination), false); }
        finally {
          if (fs.existsSync(destination)) {
            assert.equal(path.dirname(destination), path.join(source, reserved)); assert.equal(fs.lstatSync(destination).isSymbolicLink(), false);
            fs.rmSync(destination, { recursive: true });
          }
        }
      }
    });
    await test('BK15 loosened backup ACL is refused without automatic repair', async () => {
      const base = path.join(source, '.security-backups');
      if (process.platform === 'win32') execFileSync('icacls.exe', [base, '/grant', '*S-1-5-32-545:(OI)(CI)R'], { windowsHide: true, stdio: 'pipe' });
      else fs.chmodSync(base, 0o750);
      try { await rejects(api.verifyWorkspaceBackup(source, receipt.backupId), 'WORKSPACE_PERMISSIONS_INVALID'); }
      finally {
        if (process.platform === 'win32') execFileSync('icacls.exe', [base, '/remove:g', '*S-1-5-32-545'], { windowsHide: true, stdio: 'pipe' });
        else fs.chmodSync(base, 0o700);
      }
    });
    await test('BK16 linked source and source corruption never publish a backup or erase evidence', async () => {
      const base = path.join(source, '.security-backups'), published = () => fs.readdirSync(base).filter(name => /^[a-f0-9-]{36}$/.test(name)).sort();
      const before = published(), link = path.join(root, 'source-hardlink.sqlite'); fs.linkSync(dbPath(), link);
      try { await rejects(api.createWorkspaceBackup(source), 'WORKSPACE_PATH_INVALID'); assert.deepEqual(published(), before); }
      finally { fs.unlinkSync(link); }
      const corrupt = Buffer.from('SYNTHETIC retained source corruption'); fs.writeFileSync(dbPath(), corrupt);
      await rejects(api.createWorkspaceBackup(source), 'WORKSPACE_BACKUP_INVALID'); assert.deepEqual(fs.readFileSync(dbPath()), corrupt); assert.deepEqual(published(), before);
    });
    await test('BK17 a bootstrapped authority without an initial project snapshot is preserved', async () => {
      const workspace = path.join(root, 'principal-only'); fs.mkdirSync(workspace);
      const authority = await WorkspaceStore.open(workspace, { initialize: true });
      try { await authority.execute({ command: 'bootstrap', principal, verifier }); } finally { await authority.close(); }
      const backup = await api.createWorkspaceBackup(workspace), db = path.join(workspace, '.security-backups', backup.backupId, 'authority.sqlite');
      assert.equal(rows(db).metadata[0].stateJson, null); assert.equal(rows(db).metadata[0].snapshotRevision, 0);
      assert.deepEqual(await api.verifyWorkspaceBackup(workspace, backup.backupId, backup.manifestSha256), backup);
    });
  }
} finally {
  if (store) await store.close();
  assert.equal(path.dirname(path.resolve(root)), parent); assert.match(path.basename(root), /^dmk-workspace-backup-/); assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
  fs.rmSync(root, { recursive: true });
}
console.log(`Workspace backup: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
