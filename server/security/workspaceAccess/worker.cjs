'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const boundary = require('./privateBoundary.cjs');
const { PROJECT_ACTIONS, HUMAN_ROLES, SELF_PROJECT_ID, evaluateProjectAction, allowedProjectActions } = require('./projectPolicy.cjs');
const MAX = { principals: 128, memberships: 512, sessions: 256, audit: 4096, throttle: 128, snapshot: 64 * 1024 * 1024 };
const ACTIONS = [...PROJECT_ACTIONS, 'project:create'];
const ROLES = HUMAN_ROLES;
const COLLECTIONS = ['managedDocuments', 'verificationSessions', 'verificationArchives', 'importSessions', 'questions', 'requirements', 'adrs', 'components', 'risks', 'threats', 'standards', 'workItems', 'evidence', 'auditLogs', 'overrides', 'approvals', 'agentRoles', 'agentRuns', 'features', 'derivations', 'documents'];
const SELF = SELF_PROJECT_ID;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SCHEMA = {
  metadata: 'CREATE TABLE metadata(id INTEGER PRIMARY KEY CHECK(id=1),initialized INTEGER NOT NULL,generation INTEGER NOT NULL,policyRevision INTEGER NOT NULL,snapshotRevision INTEGER NOT NULL,clockHighWater INTEGER NOT NULL,stateJson TEXT,provenance TEXT NOT NULL)',
  principals: 'CREATE TABLE principals(id TEXT PRIMARY KEY,name TEXT UNIQUE COLLATE NOCASE NOT NULL,personId TEXT NOT NULL,roles TEXT NOT NULL,canCreateProjects INTEGER NOT NULL,disabled INTEGER NOT NULL,credentialRevision INTEGER NOT NULL,verifier TEXT NOT NULL)',
  memberships: 'CREATE TABLE memberships(projectId TEXT NOT NULL,principalId TEXT NOT NULL REFERENCES principals(id),role TEXT NOT NULL,deniedActions TEXT NOT NULL,PRIMARY KEY(projectId,principalId))',
  sessions: 'CREATE TABLE sessions(digest TEXT PRIMARY KEY,principalId TEXT NOT NULL REFERENCES principals(id),generation INTEGER NOT NULL,credentialRevision INTEGER NOT NULL,issuedAt INTEGER NOT NULL,lastSeenAt INTEGER NOT NULL,revoked INTEGER NOT NULL)',
  used_digests: 'CREATE TABLE used_digests(digest TEXT PRIMARY KEY)', operations: 'CREATE TABLE operations(operationId TEXT PRIMARY KEY,snapshotRevision INTEGER NOT NULL)',
  throttle: 'CREATE TABLE throttle(key TEXT PRIMARY KEY,windowStart INTEGER NOT NULL,attempts INTEGER NOT NULL)',
  audit: 'CREATE TABLE audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT,raw TEXT NOT NULL,previousHash TEXT NOT NULL,hash TEXT UNIQUE NOT NULL)',
};
let db;
function fail(code) { const e = Error(code); e.code = code; throw e; }
function exact(v, required, optional = []) {
  if (!v || Object.getPrototypeOf(v) !== Object.prototype || required.some(k => !Object.hasOwn(v, k)) || Object.keys(v).some(k => !required.includes(k) && !optional.includes(k))) fail('WORKSPACE_INPUT_INVALID');
}
function id(v) { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)) fail('WORKSPACE_INPUT_INVALID'); }
function name(v) { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,63}$/.test(v)) fail('WORKSPACE_INPUT_INVALID'); }
function digest(v) { if (typeof v !== 'string' || !/^[0-9a-f]{64}$/.test(v)) fail('WORKSPACE_INPUT_INVALID'); }
function integer(v, minimum = 0) { if (!Number.isSafeInteger(v) || v < minimum) fail('WORKSPACE_INPUT_INVALID'); }
function now(v) { integer(v); if (v > Number.MAX_SAFE_INTEGER - 1_800_000) fail('WORKSPACE_INPUT_INVALID'); }
function verifier(v) {
  const m = typeof v === 'string' && v.length <= 128 && /^\$argon2id\$v=19\$m=32768,p=1,t=3\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(v);
  if (!m || ![16, 32].every((n, i) => { const b = Buffer.from(m[i + 1], 'base64'); return b.length === n && b.toString('base64').replace(/=/g, '') === m[i + 1]; })) fail('WORKSPACE_INPUT_INVALID');
}
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const count = table => db.prepare('SELECT count(*) AS n FROM ' + table).get().n;
function capacity(table, max) { if (count(table) >= max) fail('WORKSPACE_CAPACITY_EXCEEDED'); }
const meta = () => db.prepare('SELECT * FROM metadata WHERE id=1').get();
function principal(principalId) {
  const p = db.prepare('SELECT id,name,personId,roles,canCreateProjects,disabled,credentialRevision FROM principals WHERE id=?').get(principalId);
  return p ? { ...p, kind: 'HUMAN', roles: JSON.parse(p.roles), canCreateProjects: !!p.canCreateProjects, disabled: !!p.disabled } : null;
}
function validatePrincipal(p) {
  exact(p, ['id', 'name', 'personId', 'kind', 'roles', 'canCreateProjects', 'disabled', 'credentialRevision']); id(p.id); name(p.name); id(p.personId);
  if (p.kind !== 'HUMAN' || !Array.isArray(p.roles) || p.roles.some(r => !ROLES.includes(r)) || new Set(p.roles).size !== p.roles.length ||
    typeof p.canCreateProjects !== 'boolean' || p.disabled !== false || p.credentialRevision !== 1) fail('WORKSPACE_INPUT_INVALID');
}
function insertPrincipal(p, v) {
  capacity('principals', MAX.principals);
  db.prepare('INSERT INTO principals(id,name,personId,roles,canCreateProjects,disabled,credentialRevision,verifier) VALUES(?,?,?,?,?,0,1,?)').run(p.id, p.name, p.personId, JSON.stringify(p.roles), +p.canCreateProjects, v);
}
function event(type, target = '', at = meta().clockHighWater) {
  capacity('audit', MAX.audit); const previous = db.prepare('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').get()?.hash || '0'.repeat(64);
  const m = meta(), raw = JSON.stringify({ type, targetHash: target ? hash(target) : null, at, generation: m.generation, policyRevision: m.policyRevision, snapshotRevision: m.snapshotRevision });
  db.prepare('INSERT INTO audit(raw,previousHash,hash) VALUES(?,?,?)').run(raw, previous, hash(previous + '\n' + raw));
}
function transaction(fn, checkCapacity = true) {
  db.exec('BEGIN IMMEDIATE');
  try { if (checkCapacity) capacity('audit', MAX.audit); const value = fn(); boundary.assertRoot(workerData); boundary.assertLock(workerData); db.exec('COMMIT'); return value; }
  catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}
function clock(at) { const m = meta(); if (at < m.clockHighWater) fail('WORKSPACE_CLOCK_ROLLBACK'); db.prepare('UPDATE metadata SET clockHighWater=? WHERE id=1').run(at); }

// Scan duplicate decoded keys and unsafe properties before JSON.parse can erase
// them. Work is bounded by serialized bytes and depth, independently of objects.
function parseSnapshot(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX.snapshot) fail('WORKSPACE_SNAPSHOT_INVALID');
  let i = 0;
  const white = () => { while (i < raw.length && /[\x20\x09\x0a\x0d]/.test(raw[i])) i++; };
  function quoted() {
    const start = i; if (raw[i++] !== '"') fail('WORKSPACE_SNAPSHOT_INVALID');
    while (i < raw.length) { if (raw[i] === '"') { i++; return JSON.parse(raw.slice(start, i)); } if (raw.charCodeAt(i) < 32) fail('WORKSPACE_SNAPSHOT_INVALID'); i += raw[i] === '\\' ? 2 : 1; }
    fail('WORKSPACE_SNAPSHOT_INVALID');
  }
  const primitive = /(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  function walk(depth) {
    if (depth > 64) fail('WORKSPACE_SNAPSHOT_INVALID'); white(); const c = raw[i];
    if (c === '{' || c === '[') {
      const object = c === '{', close = object ? '}' : ']', keys = new Set(); i++; white(); if (raw[i] === close) { i++; return; }
      for (;;) { if (object) { white(); const key = quoted(); if (keys.has(key) || ['__proto__', 'prototype', 'constructor', 'toJSON'].includes(key)) fail('WORKSPACE_SNAPSHOT_INVALID'); keys.add(key); white(); if (raw[i++] !== ':') fail('WORKSPACE_SNAPSHOT_INVALID'); }
        walk(depth + 1); white(); if (raw[i] === close) { i++; return; } if (raw[i++] !== ',') fail('WORKSPACE_SNAPSHOT_INVALID'); }
    }
    if (c === '"') { quoted(); return; }
    primitive.lastIndex = i; const m = primitive.exec(raw); if (!m || /^-?\d/.test(m[0]) && !Number.isFinite(Number(m[0]))) fail('WORKSPACE_SNAPSHOT_INVALID'); i = primitive.lastIndex;
  }
  walk(0); white(); if (i !== raw.length) fail('WORKSPACE_SNAPSHOT_INVALID');
  const value = JSON.parse(raw); exact(value, ['schemaVersion', 'state']);
  if (value.schemaVersion !== 1) fail('WORKSPACE_SNAPSHOT_INVALID');
  exact(value.state, ['projects'], COLLECTIONS);
  const projects = value.state.projects;
  if (!Array.isArray(projects)) fail('WORKSPACE_SNAPSHOT_INVALID');
  const ids = new Set();
  for (const p of projects) { if (!p || typeof p !== 'object' || Array.isArray(p)) fail('WORKSPACE_SNAPSHOT_INVALID'); id(p.id); if (ids.has(p.id)) fail('WORKSPACE_SNAPSHOT_INVALID'); ids.add(p.id); }
  for (const key of COLLECTIONS) if (Object.hasOwn(value.state, key)) {
    const collection = value.state[key]; if (!collection || Object.getPrototypeOf(collection) !== Object.prototype) fail('WORKSPACE_SNAPSHOT_INVALID');
    const bind = (node, projectId) => { if (node && typeof node === 'object') { if (Object.hasOwn(node, 'projectId') && node.projectId !== projectId) fail('WORKSPACE_SNAPSHOT_INVALID'); for (const child of Object.values(node)) bind(child, projectId); } };
    for (const projectId of Object.keys(collection)) { if (!ids.has(projectId) || !collection[projectId] || typeof collection[projectId] !== 'object') fail('WORKSPACE_SNAPSHOT_INVALID'); bind(collection[projectId], projectId); }
  }
  return value;
}
function snapshotValue() { const m = meta(); return m.stateJson === null ? { schemaVersion: 1, state: { projects: [] } } : parseSnapshot(m.stateJson); }
function session(tokenDigest, at, touch = true) {
  const s = db.prepare('SELECT * FROM sessions WHERE digest=?').get(tokenDigest), m = meta();
  if (!s || s.revoked) return null;
  const p = principal(s.principalId);
  if (!p || p.disabled || s.generation !== m.generation || s.credentialRevision !== p.credentialRevision || at < s.issuedAt || at < s.lastSeenAt || at - s.lastSeenAt >= 600_000 || at - s.issuedAt >= 1_800_000) return null;
  if (touch) db.prepare('UPDATE sessions SET lastSeenAt=? WHERE digest=?').run(at, tokenDigest);
  return { principal: p, generation: m.generation, credentialRevision: p.credentialRevision, policyRevision: m.policyRevision, issuedAt: s.issuedAt, lastSeenAt: touch ? at : s.lastSeenAt };
}
function decision(tokenDigest, action, projectId, at) {
  const m = meta(), s = session(tokenDigest, at), result = { allowed: false, reason: 'SESSION_INVALID', allowedActions: [], policyRevision: m.policyRevision, snapshotRevision: m.snapshotRevision };
  if (!s) return result; result.principal = s.principal;
  if (!ACTIONS.includes(action)) { result.reason = 'UNSUPPORTED_ACTION'; return result; }
  if (action === 'project:create' || action === 'project:import' && projectId === undefined) { result.allowed = s.principal.canCreateProjects; result.reason = result.allowed ? 'ALLOWED' : 'CREATE_DENIED'; return result; }
  if (!projectId || !snapshotValue().state.projects.some(p => p.id === projectId)) { result.reason = 'RESOURCE_UNAVAILABLE'; return result; }
  const member = db.prepare('SELECT role,deniedActions FROM memberships WHERE projectId=? AND principalId=?').get(projectId, s.principal.id);
  const currentMembership = member && { ...member, deniedActions: JSON.parse(member.deniedActions) };
  const policy = evaluateProjectAction(s.principal, currentMembership, action, projectId);
  result.allowed = policy.allowed; result.reason = policy.reason;
  if (policy.allowed) result.allowedActions = allowedProjectActions(s.principal, currentMembership, projectId);
  return result;
}
function validateScope(before, after, action, projectId) {
  if (!['project:write', 'project:review', 'project:create', 'project:import', 'project:export'].includes(action)) fail('WORKSPACE_SCOPE_INVALID');
  const old = new Map(before.state.projects.map(p => [p.id, p])), next = new Map(after.state.projects.map(p => [p.id, p]));
  const added = [...next.keys()].filter(k => !old.has(k)), removed = [...old.keys()].filter(k => !next.has(k));
  const creation = action === 'project:create' || action === 'project:import' && projectId === undefined;
  if (removed.length || (creation ? added.length !== 1 || added[0] === SELF || projectId !== undefined && projectId !== added[0] : added.length !== 0 || !old.has(projectId))) fail('WORKSPACE_SCOPE_INVALID');
  const target = creation ? added[0] : projectId;
  if (action === 'project:export') {
    if (added.length || removed.length || !isDeepStrictEqual(before.state.projects, after.state.projects)) fail('WORKSPACE_SCOPE_INVALID');
    for (const key of COLLECTIONS) {
      const a = before.state[key] || {}, b = after.state[key] || {};
      if (key !== 'auditLogs' && !isDeepStrictEqual(before.state[key], after.state[key])) fail('WORKSPACE_SCOPE_INVALID');
      for (const project of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (key === 'auditLogs' && project === projectId) continue;
        if (!isDeepStrictEqual(a[project], b[project])) fail('WORKSPACE_SCOPE_INVALID');
      }
    }
    const previousEvents = before.state.auditLogs?.[projectId] || [], events = after.state.auditLogs?.[projectId];
    if (!Array.isArray(previousEvents) || !Array.isArray(events) || events.length !== previousEvents.length + 1 ||
      !isDeepStrictEqual(events.slice(1), previousEvents) || events[0]?.action !== 'PACKAGE_EXPORTED') fail('WORKSPACE_SCOPE_INVALID');
    return null;
  }
  if (target === SELF) fail('WORKSPACE_SCOPE_INVALID');
  for (const [key, value] of old) if ((creation || key !== target) && !isDeepStrictEqual(value, next.get(key))) fail('WORKSPACE_SCOPE_INVALID');
  for (const collection of COLLECTIONS) {
    const a = before.state[collection] || {}, b = after.state[collection] || {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (key !== target && !isDeepStrictEqual(a[key], b[key])) fail('WORKSPACE_SCOPE_INVALID');
    if (Object.hasOwn(before.state, collection) !== Object.hasOwn(after.state, collection) && Object.keys(a).length === 0 && Object.keys(b).length === 0) fail('WORKSPACE_SCOPE_INVALID');
  }
  return creation ? target : null;
}
function reclaimSessions(at) {
  if (count('sessions') < MAX.sessions) return;
  const m = meta(), removed = db.prepare('DELETE FROM sessions WHERE revoked=1 OR generation<>? OR lastSeenAt<=? OR issuedAt<=?').run(m.generation, at - 600_000, at - 1_800_000).changes;
  if (removed) event('EXPIRED_SESSIONS_RECLAIMED', '', at);
}
function insertSession(p, tokenDigest, at) {
  reclaimSessions(at); capacity('sessions', MAX.sessions); capacity('used_digests', MAX.audit);
  if (db.prepare('SELECT 1 FROM used_digests WHERE digest=?').get(tokenDigest)) fail('WORKSPACE_SESSION_REPLAY');
  db.prepare('INSERT INTO used_digests(digest) VALUES(?)').run(tokenDigest);
  db.prepare('INSERT INTO sessions(digest,principalId,generation,credentialRevision,issuedAt,lastSeenAt,revoked) VALUES(?,?,?,?,?,?,0)').run(tokenDigest, p.id, meta().generation, p.credentialRevision, at, at);
}
function initialized() { if (!meta().initialized) fail('WORKSPACE_NOT_INITIALIZED'); }
function command(c) {
  if (!c || typeof c.command !== 'string') fail('WORKSPACE_INPUT_INVALID');
  switch (c.command) {
    case 'info': {
      exact(c, ['command']); const m = meta();
      return { initialized: !!m.initialized, schemaVersion: 1, generation: m.generation, policyRevision: m.policyRevision, snapshotRevision: m.snapshotRevision,
        provenance: JSON.parse(m.provenance), counts: { principals: count('principals'), memberships: count('memberships'), sessions: count('sessions'), audit: count('audit'), throttleKeys: count('throttle') },
        roleCoverage: Object.fromEntries(ROLES.map(role => [role, new Set(db.prepare('SELECT personId,roles FROM principals WHERE disabled=0').all().filter(p => JSON.parse(p.roles).includes(role)).map(p => p.personId)).size])) };
    }
    case 'snapshot': { exact(c, ['command']); const m = meta(); return { stateJson: m.stateJson, snapshotRevision: m.snapshotRevision }; }
    case 'audit': exact(c, ['command']); return db.prepare('SELECT sequence,raw,previousHash,hash FROM audit ORDER BY sequence').all().map(row => ({ sequence: row.sequence, ...JSON.parse(row.raw), previousHash: row.previousHash, hash: row.hash }));
    case 'bootstrap': case 'provision': {
      exact(c, ['command', 'principal', 'verifier'], c.command === 'bootstrap' ? ['stateJson'] : []); validatePrincipal(c.principal); verifier(c.verifier);
      if (c.stateJson !== undefined) parseSnapshot(c.stateJson);
      return transaction(() => {
        if (c.command === 'bootstrap') { if (meta().initialized || count('principals')) fail('WORKSPACE_ALREADY_INITIALIZED'); }
        else initialized();
        insertPrincipal(c.principal, c.verifier);
        if (c.command === 'bootstrap') {
          const m = meta(), provenance = { ...JSON.parse(m.provenance), initialStateSha256: c.stateJson === undefined ? null : hash(Buffer.from(c.stateJson, 'utf8')) };
          db.prepare('UPDATE metadata SET initialized=1,stateJson=?,snapshotRevision=?,provenance=? WHERE id=1').run(c.stateJson ?? null, c.stateJson === undefined ? 0 : 1, JSON.stringify(provenance));
        }
        db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run(); event(c.command === 'bootstrap' ? 'WORKSPACE_BOOTSTRAPPED' : 'PRINCIPAL_PROVISIONED', c.principal.id); return true;
      });
    }
    case 'credential': {
      exact(c, ['command', 'name']); name(c.name); initialized(); const row = db.prepare('SELECT id,verifier FROM principals WHERE name=? COLLATE NOCASE').get(c.name);
      if (!row) return null; const p = principal(row.id); return p.disabled ? null : { principal: p, verifier: row.verifier, generation: meta().generation };
    }
    case 'membership': {
      exact(c, ['command', 'projectId', 'principalId', 'role'], ['deniedActions']); id(c.projectId); id(c.principalId);
      if (!['OWNER', 'EDITOR', 'READER', 'DENY'].includes(c.role) || c.deniedActions !== undefined && (!Array.isArray(c.deniedActions) || c.deniedActions.some(a => !ACTIONS.includes(a)) || new Set(c.deniedActions).size !== c.deniedActions.length)) fail('WORKSPACE_INPUT_INVALID');
      return transaction(() => {
        initialized(); if (!principal(c.principalId) || !snapshotValue().state.projects.some(p => p.id === c.projectId)) fail('WORKSPACE_RESOURCE_UNAVAILABLE');
        if (c.projectId === SELF && ['OWNER', 'EDITOR'].includes(c.role)) fail('WORKSPACE_CANONICAL_READ_ONLY');
        if (!db.prepare('SELECT 1 FROM memberships WHERE projectId=? AND principalId=?').get(c.projectId, c.principalId)) capacity('memberships', MAX.memberships);
        db.prepare('INSERT INTO memberships(projectId,principalId,role,deniedActions) VALUES(?,?,?,?) ON CONFLICT(projectId,principalId) DO UPDATE SET role=excluded.role,deniedActions=excluded.deniedActions').run(c.projectId, c.principalId, c.role, JSON.stringify(c.deniedActions || []));
        db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run(); event('MEMBERSHIP_CHANGED', c.projectId); return true;
      });
    }
    case 'admitLogin': {
      exact(c, ['command', 'key', 'now']); if (typeof c.key !== 'string' || !c.key || Buffer.byteLength(c.key) > 256) fail('WORKSPACE_INPUT_INVALID'); now(c.now);
      return transaction(() => {
        // Public rate counters are bounded mutable state, not retained authority
        // history. Unauthenticated retries cannot append critical audit records.
        // transaction() still refuses admission when that audit is already full.
        initialized(); clock(c.now); db.prepare('DELETE FROM throttle WHERE windowStart<=?').run(c.now - 60_000);
        let global = db.prepare('SELECT attempts FROM throttle WHERE key=?').get('global');
        if (!global) { capacity('throttle', MAX.throttle); db.prepare('INSERT INTO throttle VALUES(?,?,0)').run('global', c.now); global = { attempts: 0 }; }
        if (global.attempts >= 30) {
          db.prepare('UPDATE throttle SET attempts=min(attempts+1,31) WHERE key=?').run('global'); return false;
        }
        // Check the global cap before allocating a previously unseen account.
        const key = hash(c.key.toLowerCase()); let row = db.prepare('SELECT attempts FROM throttle WHERE key=?').get(key);
        if (!row) { capacity('throttle', MAX.throttle); db.prepare('INSERT INTO throttle VALUES(?,?,0)').run(key, c.now); row = { attempts: 0 }; }
        db.prepare('UPDATE throttle SET attempts=min(attempts+1,31) WHERE key=? OR key=?').run(key, 'global');
        return row.attempts < 5;
      });
    }
    case 'issue': {
      exact(c, ['command', 'principalId', 'expectedCredentialRevision', 'expectedGeneration', 'digest', 'now']); id(c.principalId); integer(c.expectedCredentialRevision, 1); integer(c.expectedGeneration, 1); digest(c.digest); now(c.now);
      return transaction(() => { initialized(); clock(c.now); const p = principal(c.principalId), m = meta(); if (!p || p.disabled || p.credentialRevision !== c.expectedCredentialRevision || m.generation !== c.expectedGeneration) fail('WORKSPACE_STALE_CREDENTIAL'); insertSession(p, c.digest, c.now); event('SESSION_ISSUED', p.id, c.now); return true; });
    }
    case 'listProjects': {
      exact(c, ['command', 'digest', 'now']); digest(c.digest); now(c.now);
      return transaction(() => {
        initialized(); clock(c.now); const m = meta(), s = session(c.digest, c.now);
        const result = { allowed: false, reason: 'SESSION_INVALID', projectIds: [], policyRevision: m.policyRevision, snapshotRevision: m.snapshotRevision };
        if (!s) return result;
        // One snapshot parse and one membership read, in the same transaction
        // as the current session check. Never accept a caller-selected ID list.
        const members = new Map(db.prepare('SELECT projectId,role,deniedActions FROM memberships WHERE principalId=?').all(s.principal.id)
          .map(row => [row.projectId, { role: row.role, deniedActions: JSON.parse(row.deniedActions) }]));
        result.projectIds = snapshotValue().state.projects.filter(project => evaluateProjectAction(s.principal, members.get(project.id), 'project:read', project.id).allowed).map(project => project.id);
        return { ...result, allowed: true, reason: 'ALLOWED', principal: s.principal };
      });
    }
    case 'session': case 'authorize': {
      exact(c, ['command', 'digest', 'now', ...(c.command === 'authorize' ? ['action'] : [])], c.command === 'authorize' ? ['projectId'] : []); digest(c.digest); now(c.now); if (c.projectId !== undefined) id(c.projectId);
      return transaction(() => { initialized(); clock(c.now); return c.command === 'session' ? session(c.digest, c.now) : decision(c.digest, c.action, c.projectId, c.now); });
    }
    case 'rotate': case 'logout': case 'changeCredential': {
      exact(c, ['command', 'digest', 'now', ...(c.command === 'rotate' ? ['replacementDigest'] : c.command === 'changeCredential' ? ['expectedCredentialRevision', 'verifier'] : [])]); digest(c.digest); now(c.now);
      if (c.command === 'rotate') digest(c.replacementDigest); if (c.command === 'changeCredential') { integer(c.expectedCredentialRevision, 1); verifier(c.verifier); }
      return transaction(() => {
        initialized(); clock(c.now); const s = session(c.digest, c.now); if (!s) return false;
        if (c.command === 'changeCredential') {
          if (s.principal.credentialRevision !== c.expectedCredentialRevision) fail('WORKSPACE_STALE_CREDENTIAL');
          db.prepare('UPDATE principals SET verifier=?,credentialRevision=credentialRevision+1 WHERE id=?').run(c.verifier, s.principal.id);
          db.prepare('UPDATE sessions SET revoked=1 WHERE principalId=?').run(s.principal.id); db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run();
        } else { db.prepare('UPDATE sessions SET revoked=1 WHERE digest=?').run(c.digest); if (c.command === 'rotate') insertSession(s.principal, c.replacementDigest, c.now); }
        event(c.command === 'rotate' ? 'SESSION_ROTATED' : c.command === 'logout' ? 'SESSION_REVOKED' : 'CREDENTIAL_CHANGED', s.principal.id, c.now); return true;
      });
    }
    case 'resetCredential': case 'disable': {
      exact(c, ['command', 'principalId', ...(c.command === 'resetCredential' ? ['verifier'] : [])]); id(c.principalId); if (c.command === 'resetCredential') verifier(c.verifier);
      return transaction(() => { initialized(); if (!principal(c.principalId)) fail('WORKSPACE_RESOURCE_UNAVAILABLE');
        if (c.command === 'disable') db.prepare('UPDATE principals SET disabled=1 WHERE id=?').run(c.principalId);
        else db.prepare('UPDATE principals SET verifier=?,credentialRevision=credentialRevision+1 WHERE id=?').run(c.verifier, c.principalId);
        db.prepare('UPDATE sessions SET revoked=1 WHERE principalId=?').run(c.principalId); db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run(); event(c.command === 'disable' ? 'PRINCIPAL_DISABLED' : 'CREDENTIAL_RESET', c.principalId); return true;
      });
    }
    case 'commit': {
      exact(c, ['command', 'operationId', 'digest', 'action', 'expectedRevision', 'expectedPolicyRevision', 'stateJson', 'now'], ['projectId']); digest(c.digest); now(c.now); integer(c.expectedRevision); integer(c.expectedPolicyRevision); if (c.projectId !== undefined) id(c.projectId);
      if (typeof c.operationId !== 'string' || !UUID.test(c.operationId)) fail('WORKSPACE_INPUT_INVALID');
      const after = parseSnapshot(c.stateJson);
      return transaction(() => {
        if (db.prepare('SELECT 1 FROM operations WHERE operationId=?').get(c.operationId)) fail('WORKSPACE_OPERATION_REPLAY');
        capacity('audit', MAX.audit);
        initialized(); clock(c.now); const m = meta(); if (c.expectedRevision !== m.snapshotRevision || c.expectedPolicyRevision !== m.policyRevision) fail('WORKSPACE_STALE_REVISION');
        const authorization = decision(c.digest, c.action, c.projectId, c.now); if (!authorization.allowed) fail('WORKSPACE_ACCESS_DENIED');
        const createdId = validateScope(snapshotValue(), after, c.action, c.projectId);
        if (createdId) { capacity('memberships', MAX.memberships); db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(createdId, authorization.principal.id, 'OWNER', '[]'); db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run(); }
        capacity('operations', MAX.audit); db.prepare('INSERT INTO operations VALUES(?,?)').run(c.operationId, m.snapshotRevision + 1);
        db.prepare('UPDATE metadata SET stateJson=?,snapshotRevision=snapshotRevision+1 WHERE id=1').run(c.stateJson); event('PROJECT_SNAPSHOT_COMMITTED', createdId || c.projectId, c.now);
        const next = meta(); return { snapshotRevision: next.snapshotRevision, policyRevision: next.policyRevision };
      }, false);
    }
    case 'close': exact(c, ['command']); db.close(); db = undefined; return true;
    default: fail('WORKSPACE_COMMAND_UNSUPPORTED');
  }
}
function validateStoredAuthority() {
  if (db.pragma('user_version', { simple: true }) !== 1) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
  for (const [table, sql] of Object.entries(SCHEMA)) if (db.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=?').get(table)?.sql !== sql) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
  if (db.prepare("SELECT name,type FROM sqlite_master WHERE sql IS NOT NULL").all().some(row => row.name !== 'sqlite_sequence' && (!Object.hasOwn(SCHEMA, row.name) || row.type !== 'table'))) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
  if (db.pragma('quick_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) fail('WORKSPACE_CORRUPT');
  const m = meta(), provenance = JSON.parse(m.provenance);
  if (count('metadata') !== 1 || provenance.workspaceIdentity !== workerData.workspaceIdentity || provenance.privateIdentity !== workerData.rootIdentity) fail('WORKSPACE_PATH_INVALID');
  for (const key of ['generation', 'policyRevision', 'snapshotRevision', 'clockHighWater']) integer(m[key]);
  if (m.generation === Number.MAX_SAFE_INTEGER) fail('WORKSPACE_CORRUPT');
  if (![0, 1].includes(m.initialized) || (m.initialized === 0) !== (count('principals') === 0)) fail('WORKSPACE_CORRUPT');
  if (m.stateJson !== null) parseSnapshot(m.stateJson);
  for (const [table, maximum] of [['principals', 128], ['memberships', 512], ['sessions', 256], ['used_digests', 4096], ['operations', 4096], ['throttle', 128], ['audit', 4096]]) if (count(table) > maximum) fail('WORKSPACE_CORRUPT');
  for (const row of db.prepare('SELECT * FROM principals').all()) { const p = principal(row.id); validatePrincipal({ ...p, disabled: false, credentialRevision: 1 }); integer(p.credentialRevision, 1); if (![0, 1].includes(row.disabled) || ![0, 1].includes(row.canCreateProjects)) fail('WORKSPACE_CORRUPT'); verifier(row.verifier); }
  const projectIds = new Set(snapshotValue().state.projects.map(p => p.id));
  for (const row of db.prepare('SELECT * FROM memberships').all()) {
    const denied = JSON.parse(row.deniedActions);
    if (!projectIds.has(row.projectId) || !principal(row.principalId) || !['OWNER', 'EDITOR', 'READER', 'DENY'].includes(row.role) ||
      row.projectId === SELF && ['OWNER', 'EDITOR'].includes(row.role) || !Array.isArray(denied) || denied.some(a => !ACTIONS.includes(a)) || new Set(denied).size !== denied.length) fail('WORKSPACE_CORRUPT');
  }
  for (const row of db.prepare('SELECT * FROM used_digests').all()) digest(row.digest);
  for (const row of db.prepare('SELECT * FROM sessions').all()) {
    digest(row.digest); integer(row.generation, 1); integer(row.credentialRevision, 1); now(row.issuedAt); now(row.lastSeenAt);
    if (row.generation > m.generation || row.credentialRevision > principal(row.principalId).credentialRevision || row.lastSeenAt < row.issuedAt || row.lastSeenAt > m.clockHighWater ||
      ![0, 1].includes(row.revoked) || !db.prepare('SELECT 1 FROM used_digests WHERE digest=?').get(row.digest)) fail('WORKSPACE_CORRUPT');
  }
  for (const row of db.prepare('SELECT * FROM throttle').all()) { now(row.windowStart); integer(row.attempts); if (row.key !== 'global') digest(row.key); if (row.attempts > 31 || row.windowStart > m.clockHighWater) fail('WORKSPACE_CORRUPT'); }
  for (const row of db.prepare('SELECT * FROM operations').all()) { integer(row.snapshotRevision, 1); if (!UUID.test(row.operationId) || row.snapshotRevision > m.snapshotRevision) fail('WORKSPACE_CORRUPT'); }
  let previous = '0'.repeat(64), sequence = 0;
  for (const row of db.prepare('SELECT * FROM audit ORDER BY sequence').all()) {
    if (row.sequence !== ++sequence || row.previousHash !== previous || row.hash !== hash(previous + '\n' + row.raw)) fail('WORKSPACE_AUDIT_INVALID');
    const data = JSON.parse(row.raw); exact(data, ['type', 'targetHash', 'at', 'generation', 'policyRevision', 'snapshotRevision']);
    if (typeof data.type !== 'string' || !/^[A-Z_]{1,64}$/.test(data.type)) fail('WORKSPACE_AUDIT_INVALID'); if (data.targetHash !== null) digest(data.targetHash);
    for (const key of ['at', 'generation', 'policyRevision', 'snapshotRevision']) integer(data[key]); previous = row.hash;
  }
  capacity('audit', MAX.audit); // Startup must have room before any write admission.
}
function startup() {
  const version = process.versions.node.split('.').map(Number);
  if (!['win32', 'linux'].includes(process.platform) || process.arch !== 'x64' || version[0] !== 22 || version[1] < 23 || version[1] === 23 && version[2] < 3) fail('WORKSPACE_PLATFORM_UNSUPPORTED');
  boundary.assertFiles(workerData); boundary.assertLock(workerData);
  const file = path.join(workerData.root, 'authority.sqlite'), exists = fs.existsSync(file);
  if (!exists && !workerData.initialize) fail('WORKSPACE_NOT_INITIALIZED');
  const Sqlite = require('better-sqlite3');
  const connect = readonly => {
    db = new Sqlite(file, { timeout: 100, fileMustExist: exists, readonly });
    if (require('better-sqlite3/package.json').version !== '13.0.3' || db.prepare('SELECT sqlite_version() AS version').get().version !== '3.53.4') fail('WORKSPACE_NATIVE_PROVENANCE_INVALID');
    db.pragma('trusted_schema = OFF'); db.pragma('foreign_keys = ON'); db.pragma('synchronous = FULL'); db.pragma('busy_timeout = 100');
  };
  if (exists) {
    // A rejected prepared/foreign/corrupt database must not be switched to WAL
    // or acquire a generation. Readonly admission also rejects hot journals
    // which cannot be examined without recovery; it never performs that repair.
    const before = fs.lstatSync(file, { bigint: true }); connect(true);
    validateStoredAuthority(); db.close(); db = undefined;
    boundary.assertFiles(workerData); boundary.assertLock(workerData);
    const after = fs.lstatSync(file, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs) fail('WORKSPACE_PATH_INVALID');
    connect(false);
  } else {
    connect(false); if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
    db.exec('BEGIN IMMEDIATE;' + Object.values(SCHEMA).join(';') + ';PRAGMA user_version=1;');
    db.prepare('INSERT INTO metadata VALUES(1,0,0,0,0,0,NULL,?)').run(JSON.stringify({ schema: 'WORKSPACE_AUTHORITY/1', node: process.versions.node, platform: process.platform, arch: process.arch,
      sqlite: '3.53.4', betterSqlite3: '13.0.3', workspaceIdentity: workerData.workspaceIdentity, privateIdentity: workerData.rootIdentity, initialStateSha256: null }));
    db.exec('COMMIT'); validateStoredAuthority();
  }
  // These writes occur only after complete authority admission. A later I/O or
  // process failure is still an uncertain writer outcome, never an auto-retry.
  if (db.pragma('journal_mode = WAL', { simple: true }) !== 'wal') fail('WORKSPACE_STORAGE_UNAVAILABLE');
  db.pragma('max_page_count = 65536');
  if (db.pragma('synchronous', { simple: true }) !== 2 || db.pragma('foreign_keys', { simple: true }) !== 1 || db.pragma('trusted_schema', { simple: true }) !== 0) fail('WORKSPACE_STORAGE_UNAVAILABLE');
  boundary.assertFiles(workerData);
  transaction(() => { db.prepare('UPDATE metadata SET generation=generation+1 WHERE id=1').run(); event('AUTHORITY_OPENED'); });
}
try {
  startup(); parentPort.postMessage({ ready: true });
  parentPort.on('message', message => {
    try {
      if (!Number.isSafeInteger(message?.requestId)) fail('WORKSPACE_INPUT_INVALID'); boundary.assertFiles(workerData); boundary.assertLock(workerData);
      const value = command(message.request); parentPort.postMessage({ requestId: message.requestId, value });
      if (message.request.command === 'close') parentPort.close();
    } catch (error) {
      const code = typeof error?.code === 'string' && /^WORKSPACE_[A-Z_]+$/.test(error.code) ? error.code : error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ? 'WORKSPACE_CONFLICT' : error?.code === 'SQLITE_FULL' ? 'WORKSPACE_CAPACITY_EXCEEDED' : 'WORKSPACE_UNAVAILABLE';
      parentPort.postMessage({ requestId: message?.requestId, error: code });
      if (['WORKSPACE_PATH_INVALID', 'WORKSPACE_PERMISSIONS_INVALID', 'WORKSPACE_LOCK_CHANGED'].includes(code)) { try { db?.close(); } catch {} db = undefined; parentPort.close(); }
    }
  });
} catch (error) {
  try { db?.close(); } catch {}
  parentPort.postMessage({ ready: false, error: typeof error?.code === 'string' && /^WORKSPACE_[A-Z_]+$/.test(error.code) ? error.code : 'WORKSPACE_CORRUPT' }); parentPort.close();
}
