import {parentPort, workerData} from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {auditHash, verifyAuditChain} from './audit.mjs';
import {evaluateSyntheticPolicy, SYNTHETIC_ACTIONS} from './policy.mjs';
import {assertOwnedDirectory, assertOwnerMarker} from './ownedDirectory.mjs';

const require = createRequire(import.meta.url);
const MAX_PRINCIPALS = 128, MAX_RESOURCES = 128, MAX_RULES = 512, MAX_SESSIONS = 256, MAX_AUDIT = 4096;
let db;
let observedClockHighWater = 0;
function fail(code) { const error = Error(code); error.code = code; throw error; }
function exactKeys(value, required, optional = []) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || required.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => !required.includes(k) && !optional.includes(k))) fail('STORE_INPUT_INVALID');
}
function id(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) fail('STORE_INPUT_INVALID'); }
function digest(value) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('STORE_INPUT_INVALID'); }
function time(value) { if (!Number.isSafeInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER - 1_800_000) fail('STORE_INPUT_INVALID'); }
function revision(value) { if (!Number.isSafeInteger(value) || value < 1) fail('STORE_INPUT_INVALID'); }
function verifier(value) {
  if (typeof value !== 'string' || value.length > 128) fail('STORE_INPUT_INVALID');
  const match = /^\$argon2id\$v=19\$m=32768,p=1,t=3\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(value);
  if (!match || ![16, 32].every((length, index) => {
    const decoded = Buffer.from(match[index + 1], 'base64');
    return decoded.length === length && decoded.toString('base64').replace(/=/g, '') === match[index + 1];
  })) fail('STORE_INPUT_INVALID');
}
function validateRoot() {
  try { exactKeys(workerData, ['rootDirectory', 'owner', 'fresh', 'parentDirectory', 'rootIdentity', 'parentIdentity']); }
  catch { fail('STORE_PATH_INVALID'); }
  if (typeof workerData.rootDirectory !== 'string' || typeof workerData.owner !== 'string' || !/^[a-f0-9]{64}$/.test(workerData.owner) || typeof workerData.fresh !== 'boolean') fail('STORE_PATH_INVALID');
  const root = workerData.rootDirectory;
  try { assertOwnedDirectory(root, workerData.parentDirectory, workerData.rootIdentity, workerData.parentIdentity); }
  catch { fail('STORE_PATH_INVALID'); }
  for (const name of fs.readdirSync(root)) {
    const stat = fs.lstatSync(path.join(root, name));
    if (!['.synthetic-owner', 'authority.sqlite', 'authority.sqlite-wal', 'authority.sqlite-shm'].includes(name) || !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('STORE_PATH_INVALID');
  }
  try { assertOwnerMarker(root, workerData.owner); } catch { fail('STORE_PATH_INVALID'); }
  return path.join(root, 'authority.sqlite');
}
function meta() { return db.prepare('SELECT generation,policyRevision,clockHighWater FROM metadata WHERE id=1').get(); }
// A denial may advance sanitized time metadata, never session activity/rights.
// The worker also retains its greatest observation outside SQLite rollback:
// failed audit/storage cannot rewind time and revive an expired session. The
// persisted checkpoint still rolls back atomically with authority/audit state;
// replacing this worker invalidates every earlier session generation. Neither
// observation is acquisition of operationally trusted time.
function observeFixtureTime(now) {
  const current = meta();
  if (now < Math.max(current.clockHighWater, observedClockHighWater)) return false;
  observedClockHighWater = now;
  if (now > current.clockHighWater) db.prepare('UPDATE metadata SET clockHighWater=? WHERE id=1').run(now);
  return true;
}
function capacity(table, limit) { if (db.prepare('SELECT count(*) AS n FROM ' + table).get().n >= limit) fail('STORE_CAPACITY'); }
function appendAudit(action, target, reason = 'SYNTHETIC_ONLY', now = Date.now()) {
  capacity('audit', MAX_AUDIT);
  const previous = db.prepare('SELECT sequence,hash FROM audit ORDER BY sequence DESC LIMIT 1').get();
  const event = {sequence: previous ? previous.sequence + 1 : 1, timestamp: now, actor: 'SYNTHETIC_FOUNDATIONS', action, target, reason, previousHash: previous?.hash ?? '0'.repeat(64)};
  const hash = auditHash(event);
  db.prepare('INSERT INTO audit(sequence,payload,hash) VALUES(?,?,?)').run(event.sequence, JSON.stringify(event), hash);
}
function principal(principalId) { return db.prepare('SELECT * FROM principals WHERE id=?').get(principalId); }
function currentSession(key, now) {
  const session = db.prepare('SELECT * FROM sessions WHERE digest=?').get(key);
  if (!session) return null;
  const p = principal(session.principalId), current = meta();
  if (!p || p.disabled || session.revoked || session.generation !== current.generation || session.policyRevision !== current.policyRevision || session.credentialRevision !== p.credentialRevision || now < session.issuedAt || now < session.lastSeenAt || now - session.lastSeenAt >= 600_000 || now - session.issuedAt >= 1_800_000) return null;
  return {principalId: p.id, kind: p.kind, issuedAt: session.issuedAt, lastSeenAt: session.lastSeenAt, credentialRevision: session.credentialRevision, policyRevision: session.policyRevision, generation: session.generation};
}
function touch(key, now) { db.prepare('UPDATE sessions SET lastSeenAt=? WHERE digest=?').run(now, key); }
function mutate(callback) { return db.transaction(callback).immediate(); }
function handle(message) {
  if (!message || Object.getPrototypeOf(message) !== Object.prototype || Object.keys(message).length > 8 || Object.values(message).some(value => typeof value !== 'string' && typeof value !== 'number' || typeof value === 'string' && value.length > 1024) || typeof message.command !== 'string' || Buffer.byteLength(JSON.stringify(message), 'utf8') > 8192) fail('STORE_INPUT_INVALID');
  const c = message;
  switch (c.command) {
    case 'info': {
      exactKeys(c, ['command']);
      const packageRoot = path.dirname(require.resolve('better-sqlite3/package.json'));
      const nativePaths = Object.keys(require.cache).filter(filename => filename.startsWith(packageRoot + path.sep) && filename.endsWith('.node'));
      if (nativePaths.length !== 1) fail('STORE_NATIVE_PROVENANCE_UNAVAILABLE');
      const nativePath = nativePaths[0];
      return {schemaVersion: db.pragma('user_version', {simple: true}), journalMode: db.pragma('journal_mode', {simple: true}), synchronous: db.pragma('synchronous', {simple: true}), foreignKeys: db.pragma('foreign_keys', {simple: true}), busyTimeoutMs: db.pragma('busy_timeout', {simple: true}), sqliteVersion: db.prepare('SELECT sqlite_version() AS version').get().version, node: process.version, arch: process.arch, platform: process.platform, packages: {sqlite: require('better-sqlite3/package.json').version}, nativePath, nativeSha256: createHash('sha256').update(fs.readFileSync(nativePath)).digest('hex')};
    }
    case 'snapshot': {
      exactKeys(c, ['command']);
      const state = Object.fromEntries(['metadata', 'principals', 'sessions', 'resources', 'rules', 'audit'].map(table => [table, db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()]));
      const domainState = Object.fromEntries(['principals', 'sessions', 'resources', 'rules'].map(table => [table, state[table]]));
      return {...meta(), counts: Object.fromEntries(Object.entries(state).map(([key, rows]) => [key, rows.length])), stateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex'), domainStateHash: createHash('sha256').update(JSON.stringify(domainState)).digest('hex')};
    }
    case 'audit': exactKeys(c, ['command']); return db.prepare('SELECT payload,hash FROM audit ORDER BY sequence').all().map(row => ({...JSON.parse(row.payload), hash: row.hash}));
    case 'checkpoint': exactKeys(c, ['command']); db.pragma('wal_checkpoint(TRUNCATE)'); return true;
    case 'createPrincipal':
      exactKeys(c, ['command', 'id', 'kind'], ['verifier']); id(c.id);
      if (!['HUMAN', 'AGENT'].includes(c.kind) || (c.kind === 'AGENT' && c.verifier !== undefined)) fail('STORE_INPUT_INVALID');
      if (c.kind === 'HUMAN') verifier(c.verifier);
      return mutate(() => { capacity('principals', MAX_PRINCIPALS); db.prepare('INSERT INTO principals(id,kind,verifier,credentialRevision,disabled) VALUES(?,?,?,1,0)').run(c.id, c.kind, c.verifier ?? null); appendAudit('PRINCIPAL_CREATED', c.id); return true; });
    case 'getCredential': {
      exactKeys(c, ['command', 'principalId']); id(c.principalId);
      const p = principal(c.principalId);
      return p ? {...p, generation: meta().generation} : null;
    }
    case 'resetCredential':
      exactKeys(c, ['command', 'principalId', 'verifier']); id(c.principalId); verifier(c.verifier);
      return mutate(() => {
        const p = principal(c.principalId); if (!p || p.kind !== 'HUMAN' || p.disabled) fail('PRINCIPAL_UNAVAILABLE');
        if (p.credentialRevision >= Number.MAX_SAFE_INTEGER) fail('STORE_REVISION_INVALID');
        db.prepare('UPDATE principals SET verifier=?,credentialRevision=credentialRevision+1 WHERE id=?').run(c.verifier, c.principalId);
        appendAudit('CREDENTIAL_RESET', c.principalId); return true;
      });
    case 'disablePrincipal':
      exactKeys(c, ['command', 'principalId']); id(c.principalId);
      return mutate(() => { if (!principal(c.principalId)) fail('PRINCIPAL_UNAVAILABLE'); db.prepare('UPDATE principals SET disabled=1 WHERE id=?').run(c.principalId); appendAudit('PRINCIPAL_DISABLED', c.principalId); return true; });
    case 'registerResource':
      exactKeys(c, ['command', 'id']); id(c.id);
      return mutate(() => { capacity('resources', MAX_RESOURCES); db.prepare('INSERT INTO resources(id) VALUES(?)').run(c.id); appendAudit('RESOURCE_REGISTERED', c.id); return true; });
    case 'setRule':
      exactKeys(c, ['command', 'principalId', 'action', 'resourceId', 'effect']); id(c.principalId); id(c.resourceId);
      if (!SYNTHETIC_ACTIONS.includes(c.action) || !['ALLOW', 'DENY'].includes(c.effect)) fail('STORE_INPUT_INVALID');
      return mutate(() => {
        if (!principal(c.principalId) || !db.prepare('SELECT id FROM resources WHERE id=?').get(c.resourceId)) fail('STORE_INPUT_INVALID');
        if (meta().policyRevision >= Number.MAX_SAFE_INTEGER) fail('STORE_REVISION_INVALID');
        capacity('rules', MAX_RULES);
        db.prepare('INSERT OR IGNORE INTO rules(principalId,action,resourceId,effect) VALUES(?,?,?,?)').run(c.principalId, c.action, c.resourceId, c.effect);
        db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run(); appendAudit('POLICY_CHANGED', c.resourceId); return true;
      });
    case 'issueSession':
      exactKeys(c, ['command', 'principalId', 'digest', 'now'], ['expectedCredentialRevision', 'expectedGeneration']); id(c.principalId); digest(c.digest); time(c.now);
      if (c.expectedCredentialRevision !== undefined) revision(c.expectedCredentialRevision);
      if (c.expectedGeneration !== undefined) revision(c.expectedGeneration);
      return mutate(() => {
        if (!observeFixtureTime(c.now)) fail('STORE_CLOCK_ROLLBACK');
        const p = principal(c.principalId), current = meta();
        if (!p || p.disabled) fail('PRINCIPAL_UNAVAILABLE');
        if (c.expectedCredentialRevision !== undefined && c.expectedCredentialRevision !== p.credentialRevision || c.expectedGeneration !== undefined && c.expectedGeneration !== current.generation) fail('STALE_CREDENTIAL');
        capacity('sessions', MAX_SESSIONS);
        db.prepare('INSERT INTO sessions(digest,principalId,issuedAt,lastSeenAt,credentialRevision,policyRevision,generation,revoked) VALUES(?,?,?,?,?,?,?,0)').run(c.digest, p.id, c.now, c.now, p.credentialRevision, current.policyRevision, current.generation);
        appendAudit('SESSION_ISSUED', p.id, 'SYNTHETIC_ONLY', c.now); return true;
      });
    case 'acceptSession':
      exactKeys(c, ['command', 'digest', 'now']); digest(c.digest); time(c.now);
      return mutate(() => { if (!observeFixtureTime(c.now)) return null; const session = currentSession(c.digest, c.now); if (!session) return null; touch(c.digest, c.now); return {...session, lastSeenAt: c.now}; });
    case 'revokeSession':
      exactKeys(c, ['command', 'digest', 'now']); digest(c.digest); time(c.now);
      return mutate(() => { if (!observeFixtureTime(c.now)) return false; const row = db.prepare('SELECT principalId FROM sessions WHERE digest=?').get(c.digest); if (!row) return false; db.prepare('UPDATE sessions SET revoked=1 WHERE digest=?').run(c.digest); appendAudit('SESSION_REVOKED', row.principalId, 'SYNTHETIC_ONLY', c.now); return true; });
    case 'rotateSession':
      exactKeys(c, ['command', 'digest', 'replacementDigest', 'now']); digest(c.digest); digest(c.replacementDigest); time(c.now);
      if (c.digest === c.replacementDigest) fail('STORE_INPUT_INVALID');
      return mutate(() => {
        if (!observeFixtureTime(c.now)) return false;
        const session = currentSession(c.digest, c.now); if (!session) return false;
        db.prepare('DELETE FROM sessions WHERE digest=?').run(c.digest);
        db.prepare('INSERT INTO sessions(digest,principalId,issuedAt,lastSeenAt,credentialRevision,policyRevision,generation,revoked) VALUES(?,?,?,?,?,?,?,0)').run(c.replacementDigest, session.principalId, session.issuedAt, c.now, session.credentialRevision, session.policyRevision, session.generation);
        appendAudit('SESSION_ROTATED', session.principalId, 'SYNTHETIC_ONLY', c.now); return true;
      });
    case 'authorize':
      exactKeys(c, ['command', 'digest', 'action', 'resourceId', 'now']); digest(c.digest); time(c.now); id(c.resourceId);
      if (typeof c.action !== 'string' || c.action.length > 64) fail('STORE_INPUT_INVALID');
      return mutate(() => {
        if (!observeFixtureTime(c.now)) { const decision = {allowed: false, reason: 'CLOCK_ROLLBACK'}; appendAudit('POLICY_DECISION', c.resourceId, decision.reason, c.now); return decision; }
        const session = currentSession(c.digest, c.now);
        const decision = evaluateSyntheticPolicy({principal: session, action: c.action, resourceExists: !!db.prepare('SELECT id FROM resources WHERE id=?').get(c.resourceId), effects: session ? db.prepare('SELECT effect FROM rules WHERE principalId=? AND action=? AND resourceId=?').all(session.principalId, c.action, c.resourceId).map(row => row.effect) : [], authorityCurrent: true});
        if (decision.allowed) touch(c.digest, c.now);
        appendAudit('POLICY_DECISION', c.resourceId, decision.reason, c.now); return decision;
      });
    default: fail('STORE_COMMAND_UNKNOWN');
  }
}

try {
  if (!parentPort || !['win32', 'linux'].includes(process.platform) || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 22) fail('STORE_PLATFORM_UNSUPPORTED');
  const filename = validateRoot();
  const existed = fs.existsSync(filename);
  if (workerData.fresh ? existed : !existed) fail('STORE_PATH_INVALID');
  const Database = require('better-sqlite3');
  if (require('better-sqlite3/package.json').version !== '13.0.3') fail('STORE_DEPENDENCY_MISMATCH');
  db = new Database(filename, {timeout: 100, fileMustExist: existed});
  if (process.platform !== 'win32') {
    if (!existed) fs.chmodSync(filename, 0o600);
    else { const stat = fs.statSync(filename); if ((stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid()) fail('STORE_PATH_INVALID'); }
  }
  if (db.prepare('SELECT sqlite_version() AS version').get().version !== '3.53.4') fail('STORE_DEPENDENCY_MISMATCH');
  if (db.pragma('quick_check', {simple: true}) !== 'ok') fail('STORE_INTEGRITY');
  const version = db.pragma('user_version', {simple: true});
  if (existed && version !== 1 || !existed && version !== 0) fail('STORE_SCHEMA_UNSUPPORTED');
  if (db.pragma('journal_mode=WAL', {simple: true}) !== 'wal') fail('STORE_CONFIGURATION');
  db.pragma('synchronous=FULL'); db.pragma('foreign_keys=ON'); db.pragma('trusted_schema=OFF');
  if (!existed) db.transaction(() => {
    db.exec(`CREATE TABLE metadata(id INTEGER PRIMARY KEY CHECK(id=1),generation INTEGER NOT NULL,policyRevision INTEGER NOT NULL,clockHighWater INTEGER NOT NULL);
      INSERT INTO metadata VALUES(1,0,1,0);
      CREATE TABLE principals(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('HUMAN','AGENT')),verifier TEXT,credentialRevision INTEGER NOT NULL,disabled INTEGER NOT NULL CHECK(disabled IN (0,1)));
      CREATE TABLE resources(id TEXT PRIMARY KEY);
      CREATE TABLE rules(principalId TEXT NOT NULL REFERENCES principals(id),action TEXT NOT NULL,resourceId TEXT NOT NULL REFERENCES resources(id),effect TEXT NOT NULL CHECK(effect IN ('ALLOW','DENY')),PRIMARY KEY(principalId,action,resourceId,effect));
      CREATE TABLE sessions(digest TEXT PRIMARY KEY,principalId TEXT NOT NULL REFERENCES principals(id),issuedAt INTEGER NOT NULL,lastSeenAt INTEGER NOT NULL,credentialRevision INTEGER NOT NULL,policyRevision INTEGER NOT NULL,generation INTEGER NOT NULL,revoked INTEGER NOT NULL CHECK(revoked IN (0,1)));
      CREATE TABLE audit(sequence INTEGER PRIMARY KEY,payload TEXT NOT NULL,hash TEXT NOT NULL);
      PRAGMA user_version=1;`);
  }).immediate();
  const ledger = handle({command: 'audit'});
  if (!verifyAuditChain(ledger)) fail('STORE_INTEGRITY');
  mutate(() => { const current = meta(); if (!current || !Number.isSafeInteger(current.generation) || current.generation < 0 || current.generation >= Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(current.policyRevision) || current.policyRevision < 1 || !Number.isSafeInteger(current.clockHighWater) || current.clockHighWater < 0 || current.clockHighWater > Number.MAX_SAFE_INTEGER - 1_800_000) fail('STORE_REVISION_INVALID'); db.prepare('UPDATE metadata SET generation=generation+1 WHERE id=1').run(); appendAudit('GENERATION_STARTED', 'fixture'); });
  parentPort.postMessage({ready: true});
  parentPort.on('message', envelope => {
    let requestId;
    try {
      exactKeys(envelope, ['requestId', 'request']);
      requestId = envelope.requestId;
      if (!Number.isSafeInteger(requestId) || requestId < 1) fail('STORE_INPUT_INVALID');
      validateRoot();
      if (envelope.request?.command === 'close') {
        exactKeys(envelope.request, ['command']); db.close(); parentPort.postMessage({requestId, value: true}); parentPort.close(); return;
      }
      parentPort.postMessage({requestId, value: handle(envelope.request)});
    } catch (error) {
      // Codes only: SQLite/native diagnostics may include sensitive input text.
      const code = typeof error?.code === 'string' && /^(STORE_[A-Z_]+|SQLITE_[A-Z_]+|PRINCIPAL_UNAVAILABLE|STALE_CREDENTIAL)$/.test(error.code) ? error.code : 'STORE_UNAVAILABLE';
      parentPort.postMessage({requestId, error: code});
    }
  });
} catch (error) {
  try { db?.close(); } catch {}
  parentPort?.postMessage({ready: false, error: typeof error?.code === 'string' && /^STORE_[A-Z_]+$/.test(error.code) ? error.code : 'STORE_UNAVAILABLE'});
  parentPort?.close();
}
