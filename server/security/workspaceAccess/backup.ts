import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { WorkspaceSecurityError, WORKSPACE_LIMITS } from './contracts.ts';
import { acquirePrivateWorkspace, releasePrivateWorkspace, assertPrivateDirectory, assertPrivateFile, type PrivateWorkspaceHandle } from './privateDirectory.ts';

const require = createRequire(import.meta.url);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SCHEMA_SHA256 = '11db824c5cd6308dfca1fbd9e815a09cdb79c530ed889651edcbf3cecef2c909';
const MAX_DATABASE_BYTES = 256 * 1024 * 1024, MAX_WAL_BYTES = 512 * 1024 * 1024, MAX_MANIFEST_BYTES = 8192;
const TABLES = ['principals', 'memberships', 'sessions', 'used_digests', 'operations', 'throttle', 'audit'] as const;
type Observation = { bytes: number; sha256: string; schemaSha256: string; provenanceSha256: string; snapshotSha256: string | null;
  auditHead: string; generation: number; policyRevision: number; snapshotRevision: number; clockHighWater: number; counts: Record<string, number> };
type Manifest = { schema: 'WORKSPACE_BACKUP/1'; backupId: string; createdAt: string;
  source: { workspaceIdentity: string; privateIdentity: string }; database: Observation & { file: 'authority.sqlite' } };
export interface WorkspaceBackupReceipt {
  backupId: string; databaseSha256: string; manifestSha256: string; bytes: number;
  activated: false; freshnessEstablished: false;
}
function fail(code = 'WORKSPACE_BACKUP_INVALID'): never { throw new WorkspaceSecurityError(code); }
function safeError(error: unknown): WorkspaceSecurityError {
  return error instanceof WorkspaceSecurityError ? error : new WorkspaceSecurityError('WORKSPACE_BACKUP_INVALID');
}
const sha = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value: unknown) => JSON.stringify(value) + '\n';
function identity(file: string): string {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.resolve(file) !== file || fs.realpathSync.native(file) !== file) fail('WORKSPACE_PATH_INVALID');
  const stat = fs.lstatSync(file, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.ino === 0n) fail('WORKSPACE_PATH_INVALID');
  return `${stat.dev}:${stat.ino}`;
}
function absent(file: string): boolean {
  try { fs.lstatSync(file); return false; } catch (e) { if ((e as any)?.code === 'ENOENT') return true; throw e; }
}
let ownerSid: string | undefined;
/** Only a newly created directory is hardened. Existing directories must already pass admission. */
function makePrivateDirectory(file: string): void {
  fs.mkdirSync(file, { mode: 0o700 });
  if (process.platform === 'win32') {
    ownerSid ??= /S-1-\d+(?:-\d+)+/.exec(execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 2000 }))?.[0];
    if (!ownerSid) fail('WORKSPACE_PRIVATE_DIRECTORY_UNAVAILABLE');
    execFileSync('icacls.exe', [file, '/inheritance:r', '/grant:r', `*${ownerSid}:(OI)(CI)F`], { windowsHide: true, timeout: 3000, stdio: 'pipe' });
  }
  assertPrivateDirectory(file);
}
function writeExclusive(file: string, bytes: string | Buffer): void {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  assertPrivateFile(file);
}
function fileDigest(file: string, limit = MAX_DATABASE_BYTES): { bytes: number; sha256: string; identity: string } {
  const pin = assertPrivateFile(file), fd = fs.openSync(file, 'r');
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    if (`${before.dev}:${before.ino}` !== pin || before.nlink !== 1n || before.size < 1n || before.size > BigInt(limit)) fail();
    const digest = crypto.createHash('sha256'), chunk = Buffer.alloc(64 * 1024); let offset = 0;
    while (offset < Number(before.size)) {
      const count = fs.readSync(fd, chunk, 0, Math.min(chunk.length, Number(before.size) - offset), offset);
      if (!count) fail(); digest.update(chunk.subarray(0, count)); offset += count;
    }
    const after = fs.fstatSync(fd, { bigint: true });
    if (after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs || assertPrivateFile(file) !== pin) fail('WORKSPACE_PATH_INVALID');
    return { bytes: offset, sha256: digest.digest('hex'), identity: pin };
  } finally { fs.closeSync(fd); }
}
function bytesBounded(file: string, max: number): Buffer {
  const before = fileDigest(file, max), bytes = fs.readFileSync(file);
  if (bytes.length !== before.bytes || sha(bytes) !== before.sha256 || assertPrivateFile(file) !== before.identity) fail();
  return bytes;
}
function sourcePin(handle: PrivateWorkspaceHandle): string {
  if (identity(handle.workspaceRoot) !== handle.workspaceIdentity || assertPrivateDirectory(handle.root) !== handle.rootIdentity) fail('WORKSPACE_PATH_INVALID');
  const lock = path.join(handle.root, 'owner.lock');
  if (assertPrivateFile(lock) !== handle.lockIdentity || bytesBounded(lock, 1024).toString('utf8') !== handle.lockRaw) fail('WORKSPACE_LOCK_CHANGED');
  const entries: Record<string, unknown> = { database: fileDigest(path.join(handle.root, 'authority.sqlite')), wal: null };
  const wal = path.join(handle.root, 'authority.sqlite-wal'), shm = path.join(handle.root, 'authority.sqlite-shm');
  if (!absent(wal)) {
    // Readonly WAL access can create an empty coordination file. It contains no
    // committed pages; every pre-existing nonempty WAL must retain exact bytes.
    assertPrivateFile(wal);
    if (fs.statSync(wal).size) entries.wal = fileDigest(wal, MAX_WAL_BYTES);
  }
  if (!absent(shm)) assertPrivateFile(shm); // SQLite may update shared-memory reader slots.
  return canonical(entries);
}
function sqlite(file: string, readonly = true): any {
  if (require('better-sqlite3/package.json').version !== '13.0.3') fail('WORKSPACE_SCHEMA_UNSUPPORTED');
  const Sqlite = require('better-sqlite3');
  const db = new Sqlite(file, { readonly, fileMustExist: true, timeout: 100 });
  try {
    db.pragma('trusted_schema=OFF'); if (readonly) db.pragma('query_only=ON');
    if (db.prepare('SELECT sqlite_version() AS version').get().version !== '3.53.4') fail('WORKSPACE_SCHEMA_UNSUPPORTED');
    return db;
  } catch (e) { db.close(); throw e; }
}
function observe(db: any): { database: Omit<Observation, 'bytes' | 'sha256'>; source: Manifest['source']; provenance: string } {
  const schema = db.prepare('SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name').all();
  if (sha(JSON.stringify(schema)) !== SCHEMA_SHA256 || db.pragma('user_version', { simple: true }) !== 1 || db.pragma('page_size', { simple: true }) !== 4096 || db.pragma('page_count', { simple: true }) > 65536) fail();
  const integrity = db.pragma('integrity_check');
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || db.pragma('foreign_key_check').length) fail();
  const metadata = db.prepare('SELECT * FROM metadata').all(); if (metadata.length !== 1) fail();
  const m = metadata[0];
  if (m.id !== 1 || m.initialized !== 1 || (m.stateJson !== null && (typeof m.stateJson !== 'string' || Buffer.byteLength(m.stateJson) > WORKSPACE_LIMITS.snapshotBytes)) || typeof m.provenance !== 'string' || Buffer.byteLength(m.provenance) > 4096) fail();
  for (const key of ['generation', 'policyRevision', 'snapshotRevision', 'clockHighWater']) if (!Number.isSafeInteger(m[key]) || m[key] < (key === 'clockHighWater' || key === 'snapshotRevision' ? 0 : 1)) fail();
  if ((m.stateJson === null) !== (m.snapshotRevision === 0)) fail();
  if (m.stateJson !== null) { const state = JSON.parse(m.stateJson); if (state?.schemaVersion !== 1 || !Array.isArray(state?.state?.projects)) fail(); }
  const provenance = JSON.parse(m.provenance);
  if (provenance?.schema !== 'WORKSPACE_AUTHORITY/1' || provenance.sqlite !== '3.53.4' || provenance.betterSqlite3 !== '13.0.3' || !/^\d+:\d+$/.test(provenance.workspaceIdentity) || !/^\d+:\d+$/.test(provenance.privateIdentity)) fail();
  const counts: Record<string, number> = {};
  for (const table of TABLES) counts[table] = db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
  if (counts.principals < 1 || counts.principals > WORKSPACE_LIMITS.principals || counts.memberships > WORKSPACE_LIMITS.memberships || counts.sessions > WORKSPACE_LIMITS.sessions || counts.throttle > WORKSPACE_LIMITS.throttleKeys || counts.audit > WORKSPACE_LIMITS.audit || counts.operations > WORKSPACE_LIMITS.audit || counts.used_digests > WORKSPACE_LIMITS.audit) fail();
  let head = '0'.repeat(64), sequence = 0;
  for (const event of db.prepare('SELECT sequence,raw,previousHash,hash FROM audit ORDER BY sequence').iterate()) {
    if (event.sequence !== ++sequence || typeof event.raw !== 'string' || Buffer.byteLength(event.raw) > 4096 || event.previousHash !== head || event.hash !== sha(head + '\n' + event.raw)) fail();
    const raw = JSON.parse(event.raw); if (typeof raw.type !== 'string' || !Number.isSafeInteger(raw.at)) fail(); head = event.hash;
  }
  return { database: { schemaSha256: SCHEMA_SHA256, provenanceSha256: sha(m.provenance), snapshotSha256: m.stateJson === null ? null : sha(m.stateJson), auditHead: head,
    generation: m.generation, policyRevision: m.policyRevision, snapshotRevision: m.snapshotRevision, clockHighWater: m.clockHighWater, counts },
    source: { workspaceIdentity: provenance.workspaceIdentity, privateIdentity: provenance.privateIdentity }, provenance: m.provenance };
}
function inspect(file: string): { database: Observation; source: Manifest['source']; provenance: string } {
  const before = fileDigest(file), db = sqlite(file); let observed: ReturnType<typeof observe>;
  try { observed = observe(db); } finally { db.close(); }
  const after = fileDigest(file); if (canonical(before) !== canonical(after)) fail('WORKSPACE_PATH_INVALID');
  return { ...observed, database: { bytes: before.bytes, sha256: before.sha256, ...observed.database } };
}
function backupBase(workspaceRoot: string, create: boolean): { base: string; workspaceIdentity: string; baseIdentity: string } {
  const workspaceIdentity = identity(workspaceRoot), base = path.join(workspaceRoot, '.security-backups');
  if (absent(base)) { if (!create) fail(); makePrivateDirectory(base); }
  return { base, workspaceIdentity, baseIdentity: assertPrivateDirectory(base) };
}
function manifestFor(backupId: string, createdAt: string, observed: ReturnType<typeof inspect>): Manifest {
  return { schema: 'WORKSPACE_BACKUP/1', backupId, createdAt, source: observed.source, database: { file: 'authority.sqlite', ...observed.database } };
}
function receipt(manifest: Manifest, manifestBytes: Buffer | string): WorkspaceBackupReceipt {
  return { backupId: manifest.backupId, databaseSha256: manifest.database.sha256, manifestSha256: sha(manifestBytes), bytes: manifest.database.bytes, activated: false, freshnessEstablished: false };
}
function checkEntries(directory: string, expected: string[]): void {
  if (canonical(fs.readdirSync(directory).sort()) !== canonical([...expected].sort())) fail();
}
function verifyDirectory(directory: string, backupId: string, expectedManifestSha256?: string): { receipt: WorkspaceBackupReceipt; db: string; database: Observation } {
  const pin = assertPrivateDirectory(directory); checkEntries(directory, ['authority.sqlite', 'manifest.json']);
  const manifestBytes = bytesBounded(path.join(directory, 'manifest.json'), MAX_MANIFEST_BYTES);
  if (expectedManifestSha256 !== undefined && (!SHA256.test(expectedManifestSha256) || sha(manifestBytes) !== expectedManifestSha256)) fail();
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as Manifest;
  if (typeof manifest?.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt)) || new Date(manifest.createdAt).toISOString() !== manifest.createdAt) fail();
  const db = path.join(directory, 'authority.sqlite'), observed = inspect(db), expected = manifestFor(backupId, manifest.createdAt, observed);
  if (canonical(expected) !== manifestBytes.toString('utf8') || assertPrivateDirectory(directory) !== pin) fail();
  checkEntries(directory, ['authority.sqlite', 'manifest.json']);
  return { receipt: receipt(expected, manifestBytes), db, database: observed.database };
}
function verify(workspaceRoot: string, backupId: string, expectedManifestSha256?: string) {
  if (typeof backupId !== 'string' || !UUID.test(backupId)) fail();
  const base = backupBase(workspaceRoot, false), result = verifyDirectory(path.join(base.base, backupId), backupId, expectedManifestSha256);
  if (identity(workspaceRoot) !== base.workspaceIdentity || assertPrivateDirectory(base.base) !== base.baseIdentity) fail('WORKSPACE_PATH_INVALID');
  return result;
}

/** Offline snapshot only. Never initializes authority, steals a lock, checkpoints the source, or establishes freshness. */
export async function createWorkspaceBackup(workspaceRoot: string): Promise<WorkspaceBackupReceipt> {
  let handle: PrivateWorkspaceHandle | undefined;
  try {
    handle = acquirePrivateWorkspace(workspaceRoot, false);
    const original = sourcePin(handle), sourceFile = path.join(handle.root, 'authority.sqlite'), base = backupBase(workspaceRoot, true);
    const backupId = crypto.randomUUID(), staged = path.join(base.base, '.pending-' + backupId), published = path.join(base.base, backupId);
    makePrivateDirectory(staged); const stagedIdentity = assertPrivateDirectory(staged), destination = path.join(staged, 'authority.sqlite');
    writeExclusive(destination, Buffer.alloc(0)); const destinationIdentity = assertPrivateFile(destination), source = sqlite(sourceFile);
    let observed: ReturnType<typeof observe>;
    try {
      observed = observe(source);
      if (observed.source.workspaceIdentity !== handle.workspaceIdentity || observed.source.privateIdentity !== handle.rootIdentity) fail('WORKSPACE_PATH_INVALID');
      await source.backup(destination);
    } finally { source.close(); }
    if (assertPrivateFile(destination) !== destinationIdentity || assertPrivateDirectory(staged) !== stagedIdentity || sourcePin(handle) !== original) fail('WORKSPACE_PATH_INVALID');
    // A self-contained output uses SQLite's supported journal transition. Only
    // the new private copy is writable; source provenance/state remain literal.
    const output = sqlite(destination, false);
    try {
      const outputObservation = observe(output);
      if (canonical(outputObservation) !== canonical(observed) || output.pragma('journal_mode=DELETE', { simple: true }) !== 'delete') fail();
    } finally { output.close(); }
    const outputFd = fs.openSync(destination, 'r+'); try { fs.fsyncSync(outputFd); } finally { fs.closeSync(outputFd); }
    const copied = inspect(destination);
    if (copied.provenance !== observed.provenance || canonical(copied.source) !== canonical(observed.source) || canonical({ ...copied.database, bytes: undefined, sha256: undefined }) !== canonical(observed.database)) fail();
    const manifest = manifestFor(backupId, new Date().toISOString(), copied), manifestBytes = canonical(manifest);
    writeExclusive(path.join(staged, 'manifest.json'), manifestBytes); const verified = verifyDirectory(staged, backupId);
    if (identity(workspaceRoot) !== base.workspaceIdentity || assertPrivateDirectory(base.base) !== base.baseIdentity || sourcePin(handle) !== original || !absent(published)) fail('WORKSPACE_PATH_INVALID');
    fs.renameSync(staged, published);
    if (assertPrivateDirectory(published) !== stagedIdentity) fail('WORKSPACE_PATH_INVALID');
    return verified.receipt;
  } catch (e) { throw safeError(e); }
  finally { if (handle) releasePrivateWorkspace(handle); }
}

/** Hashes and local metadata establish consistency, not custody, latest revocation or antirollback authority. */
export async function verifyWorkspaceBackup(workspaceRoot: string, backupId: string, expectedManifestSha256?: string): Promise<WorkspaceBackupReceipt> {
  try { return verify(workspaceRoot, backupId, expectedManifestSha256).receipt; } catch (e) { throw safeError(e); }
}

/** Prepare byte-identical state in a NEW workspace. The genuine store deliberately rejects its original provenance there. */
export async function prepareWorkspaceRestore(workspaceRoot: string, backupId: string, newWorkspaceRoot: string, expectedManifestSha256?: string): Promise<WorkspaceBackupReceipt> {
  try {
    const verified = verify(workspaceRoot, backupId, expectedManifestSha256);
    if (typeof newWorkspaceRoot !== 'string' || !path.isAbsolute(newWorkspaceRoot) || path.resolve(newWorkspaceRoot) !== newWorkspaceRoot) fail('WORKSPACE_PATH_INVALID');
    if (!absent(newWorkspaceRoot)) fail('WORKSPACE_RESTORE_DESTINATION_EXISTS');
    for (const reserved of ['.security', '.security-backups']) {
      const relative = path.relative(path.join(workspaceRoot, reserved), newWorkspaceRoot);
      if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) fail('WORKSPACE_PATH_INVALID');
    }
    const parent = path.dirname(newWorkspaceRoot), parentIdentity = identity(parent);
    makePrivateDirectory(newWorkspaceRoot); const workspaceIdentity = assertPrivateDirectory(newWorkspaceRoot);
    const privateRoot = path.join(newWorkspaceRoot, '.security'); makePrivateDirectory(privateRoot);
    const privateIdentity = assertPrivateDirectory(privateRoot), destination = path.join(privateRoot, 'authority.sqlite');
    // COPYFILE_EXCL refuses an existing file. The admitted backup is never opened for writing.
    const original = fileDigest(verified.db); fs.copyFileSync(verified.db, destination, fs.constants.COPYFILE_EXCL); fs.chmodSync(destination, 0o600);
    const fd = fs.openSync(destination, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const copied = fileDigest(destination);
    if (original.sha256 !== copied.sha256 || original.bytes !== copied.bytes || canonical(original) !== canonical(fileDigest(verified.db)) || identity(parent) !== parentIdentity || assertPrivateDirectory(newWorkspaceRoot) !== workspaceIdentity || assertPrivateDirectory(privateRoot) !== privateIdentity) fail('WORKSPACE_PATH_INVALID');
    if (canonical(inspect(destination).database) !== canonical(verified.database)) fail();
    const receipts = path.join(newWorkspaceRoot, '.security-backups'); makePrivateDirectory(receipts);
    writeExclusive(path.join(receipts, 'restore-preparation.json'), canonical({ schema: 'WORKSPACE_RESTORE_PREPARATION/1', ...verified.receipt,
      preparedAt: new Date().toISOString(), provenanceRebound: false, activationRequired: 'SEPARATELY_REVIEWED_REBIND_AND_FRESH_REVOCATION_ACCEPTANCE' }));
    return verified.receipt;
  } catch (e) { throw safeError(e); }
}
