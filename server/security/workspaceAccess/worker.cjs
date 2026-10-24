'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const boundary = require('./privateBoundary.cjs');
const { PROJECT_ACTIONS, HUMAN_ROLES, SELF_PROJECT_ID, evaluateProjectAction, allowedProjectActions } = require('./projectPolicy.cjs');
const managementContract = require('./agentManagementContract.cjs');
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
const RECEIPT_SCHEMA = { ...SCHEMA, operations: 'CREATE TABLE operations(operationId TEXT PRIMARY KEY,snapshotRevision INTEGER NOT NULL,receiptJson TEXT CHECK(receiptJson IS NULL OR length(CAST(receiptJson AS BLOB))<=4096))' };
const AGENT_SCHEMA = { ...RECEIPT_SCHEMA,
  agent_principals: 'CREATE TABLE agent_principals(id TEXT PRIMARY KEY,name TEXT NOT NULL,sponsorPrincipalId TEXT NOT NULL REFERENCES principals(id),enrollmentProjectId TEXT NOT NULL,disabled INTEGER NOT NULL,createdAt INTEGER NOT NULL)',
  agent_clients: 'CREATE TABLE agent_clients(id TEXT PRIMARY KEY,agentId TEXT NOT NULL REFERENCES agent_principals(id),name TEXT NOT NULL,revoked INTEGER NOT NULL,createdAt INTEGER NOT NULL)',
  agent_grants: 'CREATE TABLE agent_grants(id TEXT PRIMARY KEY,agentId TEXT NOT NULL REFERENCES agent_principals(id),clientId TEXT NOT NULL REFERENCES agent_clients(id),projectId TEXT NOT NULL,scopeJson TEXT NOT NULL,actionsJson TEXT NOT NULL,sponsorCredentialRevision INTEGER NOT NULL,revision INTEGER NOT NULL,issuedAt INTEGER NOT NULL,expiresAt INTEGER NOT NULL,revoked INTEGER NOT NULL)',
  agent_sessions: 'CREATE TABLE agent_sessions(id TEXT PRIMARY KEY,digest TEXT UNIQUE NOT NULL,grantId TEXT NOT NULL REFERENCES agent_grants(id),grantRevision INTEGER NOT NULL,generation INTEGER NOT NULL,issuedAt INTEGER NOT NULL,lastSeenAt INTEGER NOT NULL,expiresAt INTEGER NOT NULL,revoked INTEGER NOT NULL)',
  agent_management_ops: 'CREATE TABLE agent_management_ops(operationId TEXT PRIMARY KEY,principalId TEXT NOT NULL REFERENCES principals(id),projectId TEXT NOT NULL,action TEXT NOT NULL,requestHash TEXT NOT NULL,expectedPolicyRevision INTEGER NOT NULL,receiptJson TEXT NOT NULL CHECK(length(CAST(receiptJson AS BLOB))<=4096))',
};
const RECEIPT_ACTIONS = ['project:write', 'project:review', 'project:create', 'project:import', 'project:export'];
let db, schemaVersion = 1;
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
function capacityOperations() { if(count('operations')+(schemaVersion===3?count('agent_management_ops'):0)>=MAX.audit)fail('WORKSPACE_CAPACITY_EXCEEDED'); }
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
  if (count('principals') + (schemaVersion === 3 ? count('agent_principals') : 0) >= MAX.principals) fail('WORKSPACE_CAPACITY_EXCEEDED');
  if (schemaVersion === 3 && db.prepare('SELECT 1 FROM agent_principals WHERE id=?').get(p.id)) fail('WORKSPACE_CONFLICT');
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
function receiptBytes(receipt) {
  return JSON.stringify({ version: receipt.version, operationId: receipt.operationId, principalId: receipt.principalId, action: receipt.action,
    requestedProjectId: receipt.requestedProjectId, projectId: receipt.projectId, requestHash: receipt.requestHash, effectHash: receipt.effectHash,
    snapshotRevision: receipt.snapshotRevision, policyRevision: receipt.policyRevision });
}
function parseReceipt(raw, operation) {
  try {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 4096) fail('WORKSPACE_CORRUPT');
    const r = JSON.parse(raw);
    exact(r, ['version', 'operationId', 'principalId', 'action', 'requestedProjectId', 'projectId', 'requestHash', 'effectHash', 'snapshotRevision', 'policyRevision']);
    if (r.version !== 1 || !UUID.test(r.operationId) || r.operationId !== operation.operationId || !RECEIPT_ACTIONS.includes(r.action)) fail('WORKSPACE_CORRUPT');
    id(r.principalId); id(r.projectId); if (r.requestedProjectId !== null) id(r.requestedProjectId);
    digest(r.requestHash); digest(r.effectHash); integer(r.snapshotRevision, 1); integer(r.policyRevision, 1);
    if (r.snapshotRevision !== operation.snapshotRevision || raw !== receiptBytes(r)) fail('WORKSPACE_CORRUPT');
    const creation = r.action === 'project:create' || r.action === 'project:import' && r.requestedProjectId === null;
    if (!creation && r.requestedProjectId !== r.projectId || creation && r.requestedProjectId !== null && r.requestedProjectId !== r.projectId) fail('WORKSPACE_CORRUPT');
    return r;
  } catch { fail('WORKSPACE_CORRUPT'); }
}
/** Reauthorization is current; the returned revisions remain historical. */
function readReceipt(c, requestedProjectId, effectHash) {
  const s = session(c.digest, c.now);
  if (!s) fail('WORKSPACE_ACCESS_DENIED');
  const operation = db.prepare('SELECT * FROM operations WHERE operationId=?').get(c.operationId);
  if (schemaVersion===3 && db.prepare('SELECT 1 FROM agent_management_ops WHERE operationId=?').get(c.operationId)) fail('WORKSPACE_OPERATION_REPLAY');
  if (!operation) {
    if (!decision(c.digest, c.action, requestedProjectId ?? undefined, c.now).allowed) fail('WORKSPACE_ACCESS_DENIED');
    return null;
  }
  if (operation.receiptJson === null) fail('WORKSPACE_OPERATION_REPLAY');
  const receipt = parseReceipt(operation.receiptJson, operation);
  if (receipt.principalId !== s.principal.id) fail('WORKSPACE_ACCESS_DENIED');
  if (receipt.action !== c.action || receipt.requestedProjectId !== requestedProjectId || receipt.requestHash !== c.requestHash ||
      effectHash !== undefined && (receipt.effectHash !== effectHash || c.projectId !== undefined && receipt.projectId !== c.projectId)) fail('WORKSPACE_OPERATION_REPLAY');
  const creation = receipt.action === 'project:create' || receipt.action === 'project:import' && receipt.requestedProjectId === null;
  if (!decision(c.digest, receipt.action, creation ? undefined : receipt.projectId, c.now).allowed ||
      !decision(c.digest, 'project:read', receipt.projectId, c.now).allowed) fail('WORKSPACE_ACCESS_DENIED');
  return receipt;
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
    // A fresh null snapshot has only projects:[]. Its first real serializer
    // output adds empty optional maps; with no existing project, those maps
    // contain no foreign state. Preserve conservative presence checks later.
    if (Object.hasOwn(before.state, collection) !== Object.hasOwn(after.state, collection) && Object.keys(a).length === 0 && Object.keys(b).length === 0 && !(creation && old.size === 0 && !Object.hasOwn(before.state, collection) && Object.hasOwn(after.state, collection))) fail('WORKSPACE_SCOPE_INVALID');
  }
  return creation ? target : null;
}
function reclaimSessions(at) {
  if (count('sessions') + (schemaVersion === 3 ? count('agent_sessions') : 0) < MAX.sessions) return;
  const m = meta(); let removed = db.prepare('DELETE FROM sessions WHERE revoked=1 OR generation<>? OR lastSeenAt<=? OR issuedAt<=?').run(m.generation, at - 600_000, at - 1_800_000).changes;
  if (schemaVersion === 3) removed += db.prepare('DELETE FROM agent_sessions WHERE revoked=1 OR generation<>? OR lastSeenAt<=? OR issuedAt<=? OR expiresAt<=?').run(m.generation, at - 600_000, at - 1_800_000, at).changes;
  if (removed) event('EXPIRED_SESSIONS_RECLAIMED', '', at);
}
function insertSession(p, tokenDigest, at) {
  reclaimSessions(at); if (count('sessions') + (schemaVersion === 3 ? count('agent_sessions') : 0) >= MAX.sessions) fail('WORKSPACE_CAPACITY_EXCEEDED'); capacity('used_digests', MAX.audit);
  if (db.prepare('SELECT 1 FROM used_digests WHERE digest=?').get(tokenDigest)) fail('WORKSPACE_SESSION_REPLAY');
  db.prepare('INSERT INTO used_digests(digest) VALUES(?)').run(tokenDigest);
  db.prepare('INSERT INTO sessions(digest,principalId,generation,credentialRevision,issuedAt,lastSeenAt,revoked) VALUES(?,?,?,?,?,?,0)').run(tokenDigest, p.id, meta().generation, p.credentialRevision, at, at);
}
function initialized() { if (!meta().initialized) fail('WORKSPACE_NOT_INITIALIZED'); }
const agentPrincipal = value => db.prepare('SELECT * FROM agent_principals WHERE id=?').get(value);
const agentClient = value => db.prepare('SELECT * FROM agent_clients WHERE id=?').get(value);
const agentGrant = value => db.prepare('SELECT * FROM agent_grants WHERE id=?').get(value);
function uuid(value) { if (typeof value !== 'string' || !UUID.test(value)) fail('WORKSPACE_INPUT_INVALID'); }
function agentScope(value) {
  exact(value, ['kind'], value?.kind === 'TASKS' ? ['taskIds'] : []);
  if (value.kind === 'PROJECT_TASKS') return { kind: 'PROJECT_TASKS' };
  if (value.kind !== 'TASKS' || !Array.isArray(value.taskIds) || !value.taskIds.length || value.taskIds.length > 64) fail('WORKSPACE_INPUT_INVALID');
  value.taskIds.forEach(id);
  if (value.taskIds.some((item, i) => i > 0 && value.taskIds[i - 1] >= item)) fail('WORKSPACE_INPUT_INVALID');
  return { kind: 'TASKS', taskIds: [...value.taskIds] };
}
function taskProjection(projectId, taskId, snapshot = snapshotValue()) {
  const tasks = snapshot.state.workItems?.[projectId]; if (!Array.isArray(tasks)) return null;
  const matches = tasks.filter(item => item && item.id === taskId); if (matches.length !== 1) return null;
  const t = matches[0], result = {};
  for (const [key, bound] of [['id', 128], ['title', 1024], ['description', 65536], ['status', 32], ['priority', 2], ['updatedAt', 128]]) {
    if (typeof t[key] !== 'string' || Buffer.byteLength(t[key]) > bound) return null; result[key] = t[key];
  }
  if (!['PROPOSED','BACKLOG','READY','IN_PROGRESS','VERIFICATION','VERIFIED','APPROVED','RELEASED','DEFERRED'].includes(t.status) || !['P0','P1','P2'].includes(t.priority)) return null;
  return result;
}
function sponsorOwner(p, projectId) {
  if (!p || p.disabled || projectId === SELF || !snapshotValue().state.projects.some(item => item.id === projectId)) return false;
  const row = db.prepare('SELECT role,deniedActions FROM memberships WHERE projectId=? AND principalId=?').get(projectId, p.id);
  return !!row && row.role === 'OWNER' && evaluateProjectAction(p, { role: row.role, deniedActions: JSON.parse(row.deniedActions) }, 'project:read', projectId).allowed;
}
function agentRecordBytes(type, row) {
  const keys = type === 'AGENT_ENROLLED' ? ['id','name','sponsorPrincipalId','enrollmentProjectId','createdAt'] :
    type === 'AGENT_CLIENT_REGISTERED' ? ['id','agentId','name','createdAt'] :
    type === 'AGENT_GRANT_ISSUED' ? ['id','agentId','clientId','projectId','scopeJson','actionsJson','sponsorCredentialRevision','issuedAt','expiresAt'] :
    ['id','digest','grantId','grantRevision','generation','issuedAt','expiresAt'];
  return JSON.stringify(Object.fromEntries(keys.map(key => [key,row[key]])));
}
function currentAgent(tokenDigest, at, touch = true) {
  const s = db.prepare('SELECT * FROM agent_sessions WHERE digest=?').get(tokenDigest), m = meta(); if (!s || s.revoked) return null;
  const g = agentGrant(s.grantId), a = g && agentPrincipal(g.agentId), c = g && agentClient(g.clientId), p = a && principal(a.sponsorPrincipalId);
  if (!g || !a || !c || !p || g.revoked || a.disabled || c.revoked || c.agentId !== a.id || s.grantRevision !== g.revision ||
      p.credentialRevision !== g.sponsorCredentialRevision || !sponsorOwner(p, g.projectId) || s.generation !== m.generation ||
      at < s.issuedAt || at < s.lastSeenAt || at >= s.expiresAt || at >= g.expiresAt || at - s.issuedAt >= 1_800_000 || at - s.lastSeenAt >= 600_000) return null;
  if (touch) db.prepare('UPDATE agent_sessions SET lastSeenAt=? WHERE digest=?').run(at, tokenDigest);
  return { kind: 'AGENT', principalId: a.id, clientId: c.id, sessionId: s.id, sponsorPrincipalId: p.id, grantId: g.id, grantRevision: g.revision,
    projectId: g.projectId, scope: JSON.parse(g.scopeJson), actions: JSON.parse(g.actionsJson), expiresAt: s.expiresAt, policyRevision: m.policyRevision, snapshotRevision: m.snapshotRevision };
}
// Internal fixed selector only; neither SQL nor effective sponsor comes from RPC.
function revokeGrants(selector, value, projectId) {
  if (schemaVersion !== 3) return;
  const condition = selector === 'sponsor' ? 'agentId IN (SELECT id FROM agent_principals WHERE sponsorPrincipalId=?)' : selector === 'agent' ? 'agentId=?' : selector === 'client' ? 'clientId=?' : 'id=?';
  const where = condition + (projectId === undefined ? '' : ' AND projectId=?'), args = projectId === undefined ? [value] : [value, projectId];
  db.prepare('UPDATE agent_sessions SET revoked=1 WHERE grantId IN (SELECT id FROM agent_grants WHERE ' + where + ')').run(...args);
  db.prepare('UPDATE agent_grants SET revoked=1,revision=2 WHERE ' + where).run(...args);
}
const MANAGEMENT_RECEIPT_KEYS=['version','operationId','principalId','projectId','action','requestHash','expectedPolicyRevision','policyRevision','agentId','clientId','grantId','sessionId','grantRevision','revoked'];
const managementReceiptBytes=r=>JSON.stringify(Object.fromEntries(MANAGEMENT_RECEIPT_KEYS.map(key=>[key,r[key]])));
function parseManagementReceipt(row) {
  try {
    if(typeof row.receiptJson!=='string'||Buffer.byteLength(row.receiptJson)>4096)fail('WORKSPACE_CORRUPT');
    const r=JSON.parse(row.receiptJson);exact(r,MANAGEMENT_RECEIPT_KEYS);uuid(r.operationId);id(r.principalId);id(r.projectId);digest(r.requestHash);integer(r.expectedPolicyRevision);integer(r.policyRevision);uuid(r.agentId);
    for(const key of ['clientId','grantId','sessionId'])if(r[key]!==null)uuid(r[key]);
    if(r.version!==1||!Object.hasOwn(managementContract.INPUT_FIELDS,r.action)||r.operationId!==row.operationId||r.principalId!==row.principalId||r.projectId!==row.projectId||r.action!==row.action||r.requestHash!==row.requestHash||r.expectedPolicyRevision!==row.expectedPolicyRevision||row.receiptJson!==managementReceiptBytes(r)||r.policyRevision<r.expectedPolicyRevision||r.policyRevision>r.expectedPolicyRevision+1)fail('WORKSPACE_CORRUPT');
    const needsClient=!['enrollAgent','revokeAgent'].includes(r.action),needsGrant=['grantAgent','issueAgent','revokeAgentGrant'].includes(r.action),revocation=r.action.startsWith('revoke');
    if(needsClient!==(r.clientId!==null)||needsGrant!==(r.grantId!==null)||(r.action==='issueAgent')!==(r.sessionId!==null)||needsGrant&&(r.grantRevision!== (r.action==='revokeAgentGrant'?2:1))||!needsGrant&&r.grantRevision!==null||(revocation?typeof r.revoked!=='boolean':r.revoked!==null))fail('WORKSPACE_CORRUPT');
    if(r.policyRevision!==r.expectedPolicyRevision+((r.action==='issueAgent'||revocation&&!r.revoked)?0:1))fail('WORKSPACE_CORRUPT');
    return r;
  } catch { fail('WORKSPACE_CORRUPT'); }
}
function replayManagement(c,human,row) {
  const r=parseManagementReceipt(row);if(r.principalId!==human.id)fail('WORKSPACE_ACCESS_DENIED');
  if(r.action!==c.command||r.requestHash!==c.requestHash||r.expectedPolicyRevision!==c.expectedPolicyRevision)fail('WORKSPACE_OPERATION_REPLAY');
  const a=agentPrincipal(r.agentId),client=r.clientId&&agentClient(r.clientId),g=r.grantId&&agentGrant(r.grantId);
  if(!a)fail('WORKSPACE_ACCESS_DENIED');
  if(r.action.startsWith('revoke')) {
    if(a.sponsorPrincipalId!==human.id&&!(r.action==='revokeAgentGrant'&&sponsorOwner(human,r.projectId)))fail('WORKSPACE_ACCESS_DENIED');
  } else {
    if(a.disabled||a.sponsorPrincipalId!==human.id||!sponsorOwner(human,r.projectId)||r.clientId&&(!client||client.revoked||client.agentId!==a.id)||r.grantId&&(!g||g.revoked||g.clientId!==client.id||g.sponsorCredentialRevision!==human.credentialRevision||c.now>=g.expiresAt))fail('WORKSPACE_ACCESS_DENIED');
    if(r.action==='issueAgent') {const s=db.prepare('SELECT * FROM agent_sessions WHERE id=?').get(r.sessionId);if(!s||!currentAgent(s.digest,c.now,false))fail('WORKSPACE_ACCESS_DENIED');}
  }
  return{acknowledgment:r,replayed:true};
}
function agentCommand(c) {
  if (schemaVersion !== 3) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
  const simple = ['agentSession', 'readAgentTask', 'revokeAgentSession'].includes(c.command);
  if (simple) {
    exact(c, ['command','digest','now', ...(c.command === 'readAgentTask' ? ['projectId','taskId'] : [])]); digest(c.digest); now(c.now);
    if (c.command === 'readAgentTask') { id(c.projectId); id(c.taskId); }
    return transaction(() => {
      initialized(); clock(c.now); const actor = currentAgent(c.digest, c.now);
      if (c.command === 'agentSession') return actor;
      if (c.command === 'revokeAgentSession') { if (!actor) return false; db.prepare('UPDATE agent_sessions SET revoked=1 WHERE digest=?').run(c.digest); event('AGENT_SESSION_REVOKED', actor.sessionId, c.now); return true; }
      if (!actor) return { allowed: false, reason: 'SESSION_INVALID' };
      if (c.projectId !== actor.projectId || actor.scope.kind === 'TASKS' && !actor.scope.taskIds.includes(c.taskId)) return { allowed: false, reason: 'TASK_ACCESS_DENIED' };
      const task = taskProjection(c.projectId, c.taskId); if (!task) return { allowed: false, reason: 'TASK_ACCESS_DENIED' };
      return { allowed: true, reason: 'ALLOWED', actor, task, policyRevision: actor.policyRevision, snapshotRevision: actor.snapshotRevision };
    });
  }
  const fields = {
    enrollAgent: ['projectId','agentId','name'], registerAgentClient: ['projectId','agentId','clientId','name'],
    grantAgent: ['agentId','clientId','grantId','projectId','scope','actions','expiresAt'], issueAgent: ['grantId','expectedGrantRevision','sessionId','digest'],
    revokeAgent: ['agentId'], revokeAgentClient: ['clientId'], revokeAgentGrant: ['grantId'],
  }[c.command];
  if (!fields) fail('WORKSPACE_COMMAND_UNSUPPORTED');
  exact(c, ['command','sponsorDigest','operationId','requestHash','expectedPolicyRevision','now', ...fields]); digest(c.sponsorDigest); uuid(c.operationId);digest(c.requestHash);integer(c.expectedPolicyRevision); now(c.now);
  try {const publicInput=Object.fromEntries(managementContract.INPUT_FIELDS[c.command].map(key=>[key,c[key]]));if(c.requestHash!==managementContract.requestHash(c.command,publicInput))fail('WORKSPACE_INPUT_INVALID');}catch{fail('WORKSPACE_INPUT_INVALID');}
  for (const key of ['agentId','clientId','grantId','sessionId']) if (Object.hasOwn(c,key)) uuid(c[key]);
  if (c.projectId !== undefined) id(c.projectId); if (c.name !== undefined) name(c.name);
  if (c.command === 'grantAgent') { agentScope(c.scope); if (!isDeepStrictEqual(c.actions, ['task:read'])) fail('WORKSPACE_INPUT_INVALID'); now(c.expiresAt); if (c.expiresAt <= c.now || c.expiresAt - c.now > 1_800_000) fail('WORKSPACE_INPUT_INVALID'); }
  if (c.command === 'issueAgent') { digest(c.digest); integer(c.expectedGrantRevision, 1); }
  return transaction(() => {
    initialized(); clock(c.now); const human = session(c.sponsorDigest,c.now)?.principal; if (!human) fail('WORKSPACE_ACCESS_DENIED');
    const previous=db.prepare('SELECT * FROM agent_management_ops WHERE operationId=?').get(c.operationId);if(previous)return replayManagement(c,human,previous);
    if(db.prepare('SELECT 1 FROM operations WHERE operationId=?').get(c.operationId))fail('WORKSPACE_OPERATION_REPLAY');
    capacity('audit',MAX.audit);capacityOperations();
    if (meta().policyRevision !== c.expectedPolicyRevision) fail('WORKSPACE_STALE_REVISION');
    let value, auditType, target,binding;
    if (c.command === 'enrollAgent') {
      if (!sponsorOwner(human,c.projectId)) fail('WORKSPACE_ACCESS_DENIED');
      if (count('principals') + count('agent_principals') >= MAX.principals) fail('WORKSPACE_CAPACITY_EXCEEDED');
      if (principal(c.agentId)) fail('WORKSPACE_CONFLICT');
      db.prepare('INSERT INTO agent_principals VALUES(?,?,?,?,0,?)').run(c.agentId,c.name,human.id,c.projectId,c.now);
      value = { agent: { ...agentPrincipal(c.agentId), kind: 'AGENT', disabled: false } }; auditType = 'AGENT_ENROLLED'; target = agentRecordBytes(auditType,agentPrincipal(c.agentId));
      binding={projectId:c.projectId,agentId:c.agentId,clientId:null,grantId:null,sessionId:null,grantRevision:null,revoked:null};
    } else if (c.command === 'registerAgentClient' || c.command === 'grantAgent') {
      const a = agentPrincipal(c.agentId); if (!a || a.disabled || a.sponsorPrincipalId !== human.id || !sponsorOwner(human,c.projectId)) fail('WORKSPACE_ACCESS_DENIED');
      if (c.command === 'registerAgentClient') {
        capacity('agent_clients',256); db.prepare('INSERT INTO agent_clients VALUES(?,?,?,0,?)').run(c.clientId,a.id,c.name,c.now);
        value = { client: { ...agentClient(c.clientId), revoked: false } }; auditType = 'AGENT_CLIENT_REGISTERED'; target = agentRecordBytes(auditType,agentClient(c.clientId));
        binding={projectId:c.projectId,agentId:a.id,clientId:c.clientId,grantId:null,sessionId:null,grantRevision:null,revoked:null};
      } else {
        const client = agentClient(c.clientId), scope = agentScope(c.scope), snapshot = snapshotValue();
        if (!client || client.revoked || client.agentId !== a.id || scope.kind === 'TASKS' && scope.taskIds.some(taskId => !taskProjection(c.projectId,taskId,snapshot))) fail('WORKSPACE_ACCESS_DENIED');
        capacity('agent_grants',512); db.prepare('INSERT INTO agent_grants VALUES(?,?,?,?,?,?,?,1,?,?,0)').run(c.grantId,a.id,client.id,c.projectId,JSON.stringify(scope),'["task:read"]',human.credentialRevision,c.now,c.expiresAt);
        value = { grant: { id:c.grantId,agentId:a.id,clientId:client.id,projectId:c.projectId,scope,actions:['task:read'],sponsorCredentialRevision:human.credentialRevision,revision:1,issuedAt:c.now,expiresAt:c.expiresAt,revoked:false } }; auditType = 'AGENT_GRANT_ISSUED'; target = agentRecordBytes(auditType,agentGrant(c.grantId));
        binding={projectId:c.projectId,agentId:a.id,clientId:client.id,grantId:c.grantId,sessionId:null,grantRevision:1,revoked:null};
      }
    } else if (c.command === 'issueAgent') {
      const g = agentGrant(c.grantId), a = g && agentPrincipal(g.agentId), client = g && agentClient(g.clientId);
      if (!g || !a || !client || a.sponsorPrincipalId !== human.id || a.disabled || client.revoked || g.revoked || client.agentId !== a.id || g.sponsorCredentialRevision !== human.credentialRevision || g.revision !== c.expectedGrantRevision || c.now >= g.expiresAt || !sponsorOwner(human,g.projectId)) fail('WORKSPACE_ACCESS_DENIED');
      reclaimSessions(c.now); if (count('sessions') + count('agent_sessions') >= MAX.sessions || count('used_digests') + 2 > MAX.audit) fail('WORKSPACE_CAPACITY_EXCEEDED');
      const sessionKey = hash('dmk-agent-session-id-v1\0' + c.sessionId);
      if (db.prepare('SELECT 1 FROM used_digests WHERE digest IN (?,?)').get(c.digest,sessionKey)) fail('WORKSPACE_SESSION_REPLAY');
      db.prepare('INSERT INTO used_digests VALUES(?)').run(c.digest); db.prepare('INSERT INTO used_digests VALUES(?)').run(sessionKey);
      db.prepare('INSERT INTO agent_sessions VALUES(?,?,?,?,?,?,?,?,0)').run(c.sessionId,c.digest,g.id,g.revision,meta().generation,c.now,c.now,Math.min(g.expiresAt,c.now+1_800_000));
      auditType='AGENT_SESSION_ISSUED';target=agentRecordBytes(auditType,db.prepare('SELECT * FROM agent_sessions WHERE id=?').get(c.sessionId));
      binding={projectId:g.projectId,agentId:a.id,clientId:client.id,grantId:g.id,sessionId:c.sessionId,grantRevision:g.revision,revoked:null};
    } else {
      const object = c.command === 'revokeAgent' ? agentPrincipal(c.agentId) : c.command === 'revokeAgentClient' ? agentClient(c.clientId) : agentGrant(c.grantId);
      const a = object && (c.command === 'revokeAgent' ? object : agentPrincipal(object.agentId));
      if (!object || !a || a.sponsorPrincipalId !== human.id && !(c.command === 'revokeAgentGrant' && sponsorOwner(human,object.projectId))) fail('WORKSPACE_ACCESS_DENIED');
      const changed=!(c.command === 'revokeAgent' ? object.disabled : object.revoked);
      if(changed){
        if (c.command === 'revokeAgent') { db.prepare('UPDATE agent_principals SET disabled=1 WHERE id=?').run(a.id); db.prepare('UPDATE agent_clients SET revoked=1 WHERE agentId=?').run(a.id); revokeGrants('agent',a.id); }
        else if (c.command === 'revokeAgentClient') { db.prepare('UPDATE agent_clients SET revoked=1 WHERE id=?').run(object.id); revokeGrants('client',object.id); }
        else revokeGrants('grant',object.id);
        auditType = c.command === 'revokeAgent' ? 'AGENT_REVOKED' : c.command === 'revokeAgentClient' ? 'AGENT_CLIENT_REVOKED' : 'AGENT_GRANT_REVOKED'; target = object.id;
      }
      binding={projectId:c.command==='revokeAgentGrant'?object.projectId:a.enrollmentProjectId,agentId:a.id,clientId:c.command==='revokeAgent'?null:c.command==='revokeAgentClient'?object.id:object.clientId,grantId:c.command==='revokeAgentGrant'?object.id:null,sessionId:null,grantRevision:c.command==='revokeAgentGrant'?2:null,revoked:changed};
    }
    if(auditType){if(c.command!=='issueAgent')db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run();event(auditType,target,c.now);}
    const acknowledgment={version:1,operationId:c.operationId,principalId:human.id,projectId:binding.projectId,action:c.command,requestHash:c.requestHash,expectedPolicyRevision:c.expectedPolicyRevision,policyRevision:meta().policyRevision,...binding};
    const raw=managementReceiptBytes(acknowledgment),row={operationId:c.operationId,principalId:human.id,projectId:binding.projectId,action:c.command,requestHash:c.requestHash,expectedPolicyRevision:c.expectedPolicyRevision,receiptJson:raw};parseManagementReceipt(row);
    db.prepare('INSERT INTO agent_management_ops VALUES(?,?,?,?,?,?,?)').run(row.operationId,row.principalId,row.projectId,row.action,row.requestHash,row.expectedPolicyRevision,raw);
    event('AGENT_MANAGEMENT_COMMITTED',raw,c.now);return{acknowledgment,replayed:false};
  },false);
}
function command(c) {
  if (!c || typeof c.command !== 'string') fail('WORKSPACE_INPUT_INVALID');
  if (['enrollAgent','registerAgentClient','grantAgent','issueAgent','agentSession','readAgentTask','revokeAgent','revokeAgentClient','revokeAgentGrant','revokeAgentSession'].includes(c.command)) return agentCommand(c);
  switch (c.command) {
    case 'info': {
      exact(c, ['command']); const m = meta();
      return { initialized: !!m.initialized, schemaVersion, generation: m.generation, policyRevision: m.policyRevision, snapshotRevision: m.snapshotRevision,
        provenance: JSON.parse(m.provenance), ...(schemaVersion === 3 ? {agentDelegation:true,agentDevelopmentOnly:true} : {}), counts: { principals: count('principals'), memberships: count('memberships'), sessions: count('sessions'), audit: count('audit'), throttleKeys: count('throttle'), ...(schemaVersion === 3 ? {agentPrincipals:count('agent_principals'),agentClients:count('agent_clients'),agentGrants:count('agent_grants'),agentSessions:count('agent_sessions')} : {}) },
        roleCoverage: Object.fromEntries(ROLES.map(role => [role, new Set(db.prepare('SELECT personId,roles FROM principals WHERE disabled=0').all().filter(p => JSON.parse(p.roles).includes(role)).map(p => p.personId)).size])) };
    }
    case 'snapshot': { exact(c, ['command']); const m = meta(); return { stateJson: m.stateJson, snapshotRevision: m.snapshotRevision, ...(schemaVersion >= 2 ? { actionReceipts: true } : {}), ...(schemaVersion === 3 ? {agentDelegation:true,agentDevelopmentOnly:true} : {}) }; }
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
        if (c.role !== 'OWNER' || c.deniedActions?.includes('project:read')) revokeGrants('sponsor',c.principalId,c.projectId);
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
          revokeGrants('sponsor',s.principal.id);
        } else { db.prepare('UPDATE sessions SET revoked=1 WHERE digest=?').run(c.digest); if (c.command === 'rotate') insertSession(s.principal, c.replacementDigest, c.now); }
        event(c.command === 'rotate' ? 'SESSION_ROTATED' : c.command === 'logout' ? 'SESSION_REVOKED' : 'CREDENTIAL_CHANGED', s.principal.id, c.now); return true;
      });
    }
    case 'resetCredential': case 'disable': {
      exact(c, ['command', 'principalId', ...(c.command === 'resetCredential' ? ['verifier'] : [])]); id(c.principalId); if (c.command === 'resetCredential') verifier(c.verifier);
      return transaction(() => { initialized(); if (!principal(c.principalId)) fail('WORKSPACE_RESOURCE_UNAVAILABLE');
        if (c.command === 'disable') db.prepare('UPDATE principals SET disabled=1 WHERE id=?').run(c.principalId);
        else db.prepare('UPDATE principals SET verifier=?,credentialRevision=credentialRevision+1 WHERE id=?').run(c.verifier, c.principalId);
        db.prepare('UPDATE sessions SET revoked=1 WHERE principalId=?').run(c.principalId); revokeGrants('sponsor',c.principalId); db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run(); event(c.command === 'disable' ? 'PRINCIPAL_DISABLED' : 'CREDENTIAL_RESET', c.principalId); return true;
      });
    }
    case 'lookupReceipt': {
      if (schemaVersion < 2) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
      exact(c, ['command', 'operationId', 'digest', 'action', 'requestHash', 'now'], ['projectId']);
      digest(c.digest); digest(c.requestHash); now(c.now); if (c.projectId !== undefined) id(c.projectId);
      if (typeof c.operationId !== 'string' || !UUID.test(c.operationId) || !RECEIPT_ACTIONS.includes(c.action)) fail('WORKSPACE_INPUT_INVALID');
      return transaction(() => { initialized(); clock(c.now); return readReceipt(c, c.projectId ?? null); });
    }
    case 'commit': case 'commitReceipt': {
      const withReceipt = c.command === 'commitReceipt';
      if (withReceipt && schemaVersion < 2) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
      exact(c, ['command', 'operationId', 'digest', 'action', 'expectedRevision', 'expectedPolicyRevision', 'stateJson', 'now', ...(withReceipt ? ['requestHash'] : [])], ['projectId', ...(withReceipt ? ['requestedProjectId'] : [])]); digest(c.digest); now(c.now); integer(c.expectedRevision); integer(c.expectedPolicyRevision); if (c.projectId !== undefined) id(c.projectId);
      if (withReceipt) { digest(c.requestHash); if (c.requestedProjectId !== undefined) id(c.requestedProjectId); if (!RECEIPT_ACTIONS.includes(c.action)) fail('WORKSPACE_INPUT_INVALID'); }
      if (typeof c.operationId !== 'string' || !UUID.test(c.operationId)) fail('WORKSPACE_INPUT_INVALID');
      const after = parseSnapshot(c.stateJson);
      return transaction(() => {
        if (!withReceipt && db.prepare('SELECT 1 FROM operations WHERE operationId=?').get(c.operationId)) fail('WORKSPACE_OPERATION_REPLAY');
        if (schemaVersion === 3 && db.prepare('SELECT 1 FROM agent_management_ops WHERE operationId=?').get(c.operationId)) fail('WORKSPACE_OPERATION_REPLAY');
        capacity('audit', MAX.audit);
        initialized(); clock(c.now);
        if (withReceipt) {
          const previous = readReceipt(c, c.requestedProjectId ?? null, hash(c.stateJson));
          if (previous) return { snapshotRevision: previous.snapshotRevision, policyRevision: previous.policyRevision, receipt: previous };
        }
        const m = meta(); if (c.expectedRevision !== m.snapshotRevision || c.expectedPolicyRevision !== m.policyRevision) fail('WORKSPACE_STALE_REVISION');
        const authorization = decision(c.digest, c.action, c.projectId, c.now); if (!authorization.allowed) fail('WORKSPACE_ACCESS_DENIED');
        const createdId = validateScope(snapshotValue(), after, c.action, c.projectId);
        const targetId = createdId || c.projectId;
        if (withReceipt && (createdId ? c.requestedProjectId !== undefined && c.requestedProjectId !== targetId : c.requestedProjectId !== targetId)) fail('WORKSPACE_SCOPE_INVALID');
        if (createdId) { capacity('memberships', MAX.memberships); db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(createdId, authorization.principal.id, 'OWNER', '[]'); db.prepare('UPDATE metadata SET policyRevision=policyRevision+1 WHERE id=1').run(); }
        capacityOperations(); db.prepare('INSERT INTO operations(operationId,snapshotRevision) VALUES(?,?)').run(c.operationId, m.snapshotRevision + 1);
        db.prepare('UPDATE metadata SET stateJson=?,snapshotRevision=snapshotRevision+1 WHERE id=1').run(c.stateJson); event('PROJECT_SNAPSHOT_COMMITTED', createdId || c.projectId, c.now);
        const next = meta();
        if (!withReceipt) return { snapshotRevision: next.snapshotRevision, policyRevision: next.policyRevision };
        const receipt = { version: 1, operationId: c.operationId, principalId: authorization.principal.id, action: c.action,
          requestedProjectId: c.requestedProjectId ?? null, projectId: targetId, requestHash: c.requestHash, effectHash: hash(c.stateJson),
          snapshotRevision: next.snapshotRevision, policyRevision: next.policyRevision };
        const raw = receiptBytes(receipt); parseReceipt(raw, { operationId: c.operationId, snapshotRevision: next.snapshotRevision });
        db.prepare('UPDATE operations SET receiptJson=? WHERE operationId=?').run(raw, c.operationId);
        // Keep the six-field audit format. This additional event commits the
        // exact bounded receipt; insufficient headroom rolls back every write.
        event('ACTION_RECEIPT_COMMITTED', raw, c.now);
        return { snapshotRevision: next.snapshotRevision, policyRevision: next.policyRevision, receipt };
      }, false);
    }
    case 'close': exact(c, ['command']); db.close(); db = undefined; return true;
    default: fail('WORKSPACE_COMMAND_UNSUPPORTED');
  }
}
function validateStoredAgents() {
  try {
    const m = meta(), projects = new Set(snapshotValue().state.projects.map(p => p.id));
    const agents = new Map(db.prepare('SELECT * FROM agent_principals').all().map(row => [row.id,row]));
    const clients = new Map(db.prepare('SELECT * FROM agent_clients').all().map(row => [row.id,row]));
    const grants = new Map(db.prepare('SELECT * FROM agent_grants').all().map(row => [row.id,row]));
    const sessions = db.prepare('SELECT * FROM agent_sessions').all(), used = new Set(db.prepare('SELECT digest FROM used_digests').all().map(row => row.digest));
    if (agents.size + count('principals') > MAX.principals || clients.size > 256 || grants.size > 512 || sessions.length + count('sessions') > MAX.sessions || count('operations')+count('agent_management_ops')>MAX.audit) fail('WORKSPACE_CORRUPT');
    const auditRows=db.prepare('SELECT raw FROM audit').all().map(row=>JSON.parse(row.raw));
    const commitments = new Set(auditRows.map(e=>e.type+'\0'+e.targetHash+'\0'+e.at));
    const committed = (type,row,at) => {if(!commitments.has(type+'\0'+hash(agentRecordBytes(type,row))+'\0'+at))fail('WORKSPACE_CORRUPT');};
    for(const [type,size] of [['AGENT_ENROLLED',agents.size],['AGENT_CLIENT_REGISTERED',clients.size],['AGENT_GRANT_ISSUED',grants.size]])if(auditRows.filter(e=>e.type===type).length!==size)fail('WORKSPACE_CORRUPT');
    for (const a of agents.values()) {
      uuid(a.id); name(a.name); id(a.enrollmentProjectId); now(a.createdAt);
      if (!principal(a.sponsorPrincipalId) || principal(a.id) || !projects.has(a.enrollmentProjectId) || a.enrollmentProjectId === SELF || ![0,1].includes(a.disabled) || a.createdAt > m.clockHighWater) fail('WORKSPACE_CORRUPT');
      committed('AGENT_ENROLLED',a,a.createdAt);
    }
    for (const c of clients.values()) {
      uuid(c.id); name(c.name); now(c.createdAt); const a=agents.get(c.agentId);
      if (!a || ![0,1].includes(c.revoked) || c.createdAt < a.createdAt || c.createdAt > m.clockHighWater || a.disabled && !c.revoked) fail('WORKSPACE_CORRUPT');
      committed('AGENT_CLIENT_REGISTERED',c,c.createdAt);
    }
    for (const g of grants.values()) {
      uuid(g.id); id(g.projectId); const a=agents.get(g.agentId), c=clients.get(g.clientId), p=a&&principal(a.sponsorPrincipalId);
      const scope=agentScope(JSON.parse(g.scopeJson)); now(g.issuedAt); now(g.expiresAt); integer(g.sponsorCredentialRevision,1);
      if (!a || !c || !p || c.agentId!==a.id || !projects.has(g.projectId) || g.projectId===SELF || g.scopeJson!==JSON.stringify(scope) || g.actionsJson!=='["task:read"]' ||
          ![0,1].includes(g.revoked) || g.revision!==(g.revoked?2:1) || g.sponsorCredentialRevision>p.credentialRevision || g.issuedAt<c.createdAt || g.issuedAt>m.clockHighWater ||
          g.expiresAt<=g.issuedAt || g.expiresAt-g.issuedAt>1_800_000 || (a.disabled||c.revoked||p.disabled||g.sponsorCredentialRevision!==p.credentialRevision)&&!g.revoked) fail('WORKSPACE_CORRUPT');
      committed('AGENT_GRANT_ISSUED',g,g.issuedAt);
    }
    for (const s of sessions) {
      uuid(s.id); digest(s.digest); integer(s.generation,1); now(s.issuedAt); now(s.lastSeenAt); now(s.expiresAt); const g=grants.get(s.grantId);
      if (!g || s.grantRevision!==1 || s.generation>m.generation || s.issuedAt<g.issuedAt || s.lastSeenAt<s.issuedAt || s.lastSeenAt>m.clockHighWater || s.expiresAt<=s.issuedAt ||
          s.expiresAt>g.expiresAt || s.expiresAt-s.issuedAt>1_800_000 || ![0,1].includes(s.revoked) || g.revoked&&!s.revoked ||
          !used.has(s.digest) || !used.has(hash('dmk-agent-session-id-v1\0'+s.id))) fail('WORKSPACE_CORRUPT');
      committed('AGENT_SESSION_ISSUED',s,s.issuedAt);
    }
    const receiptEvents=auditRows.filter(e=>e.type==='AGENT_MANAGEMENT_COMMITTED'),operations=db.prepare('SELECT * FROM agent_management_ops').all();
    if(receiptEvents.length!==operations.length)fail('WORKSPACE_CORRUPT');
    const receiptCommitments=new Map(receiptEvents.map(e=>[e.targetHash,e]));if(receiptCommitments.size!==receiptEvents.length)fail('WORKSPACE_CORRUPT');
    for(const row of operations){
      const r=parseManagementReceipt(row),a=agents.get(r.agentId),c=r.clientId&&clients.get(r.clientId),g=r.grantId&&grants.get(r.grantId),e=receiptCommitments.get(hash(row.receiptJson));
      if(!principal(r.principalId)||!projects.has(r.projectId)||r.projectId===SELF||!a||r.policyRevision>m.policyRevision||!e||e.policyRevision!==r.policyRevision||
        r.clientId&&(!c||c.agentId!==a.id)||r.grantId&&(!g||g.agentId!==a.id||g.clientId!==c.id||g.projectId!==r.projectId)||
        r.action!=='revokeAgentGrant'&&a.sponsorPrincipalId!==r.principalId||db.prepare('SELECT 1 FROM operations WHERE operationId=?').get(r.operationId))fail('WORKSPACE_CORRUPT');
      if(r.action==='issueAgent'&&!used.has(hash('dmk-agent-session-id-v1\0'+r.sessionId)))fail('WORKSPACE_CORRUPT');
    }
  } catch { fail('WORKSPACE_CORRUPT'); }
}
function validateStoredAuthority() {
  schemaVersion = db.pragma('user_version', { simple: true });
  if (![1, 2, 3].includes(schemaVersion)) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
  const schema = schemaVersion === 3 ? AGENT_SCHEMA : schemaVersion === 2 ? RECEIPT_SCHEMA : SCHEMA;
  for (const [table, sql] of Object.entries(schema)) if (db.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=?').get(table)?.sql !== sql) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
  if (db.prepare("SELECT name,type FROM sqlite_master WHERE sql IS NOT NULL").all().some(row => row.name !== 'sqlite_sequence' && (!Object.hasOwn(schema, row.name) || row.type !== 'table'))) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
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
  const receipts = [];
  for (const row of db.prepare('SELECT * FROM operations').all()) {
    integer(row.snapshotRevision, 1); if (!UUID.test(row.operationId) || row.snapshotRevision > m.snapshotRevision) fail('WORKSPACE_CORRUPT');
    if (schemaVersion >= 2 && row.receiptJson !== null) {
      const receipt = parseReceipt(row.receiptJson, row);
      if (!principal(receipt.principalId) || !projectIds.has(receipt.projectId) || receipt.policyRevision > m.policyRevision ||
          receipt.snapshotRevision === m.snapshotRevision && receipt.effectHash !== hash(m.stateJson)) fail('WORKSPACE_CORRUPT');
      receipts.push({ receipt, hash: hash(row.receiptJson) });
    }
  }
  let previous = '0'.repeat(64), sequence = 0;
  const snapshotEvents = new Map(), receiptEvents = new Map();
  for (const row of db.prepare('SELECT * FROM audit ORDER BY sequence').all()) {
    if (row.sequence !== ++sequence || row.previousHash !== previous || row.hash !== hash(previous + '\n' + row.raw)) fail('WORKSPACE_AUDIT_INVALID');
    const data = JSON.parse(row.raw); exact(data, ['type', 'targetHash', 'at', 'generation', 'policyRevision', 'snapshotRevision']);
    if (typeof data.type !== 'string' || !/^[A-Z_]{1,64}$/.test(data.type)) fail('WORKSPACE_AUDIT_INVALID'); if (data.targetHash !== null) digest(data.targetHash);
    for (const key of ['at', 'generation', 'policyRevision', 'snapshotRevision']) integer(data[key]); previous = row.hash;
    if (schemaVersion >= 2 && ['PROJECT_SNAPSHOT_COMMITTED', 'ACTION_RECEIPT_COMMITTED'].includes(data.type)) {
      const events = data.type === 'PROJECT_SNAPSHOT_COMMITTED' ? snapshotEvents : receiptEvents;
      if (events.has(data.snapshotRevision)) fail('WORKSPACE_CORRUPT'); events.set(data.snapshotRevision, data);
    }
  }
  if (schemaVersion >= 2) {
    if (provenance.schema !== 'WORKSPACE_AUTHORITY/' + schemaVersion || receipts.length !== receiptEvents.size) fail('WORKSPACE_CORRUPT');
    for (const { receipt, hash: receiptHash } of receipts) {
      const original = snapshotEvents.get(receipt.snapshotRevision), commitment = receiptEvents.get(receipt.snapshotRevision);
      if (!original || !commitment || original.targetHash !== hash(receipt.projectId) || commitment.targetHash !== receiptHash ||
          original.policyRevision !== receipt.policyRevision || commitment.policyRevision !== receipt.policyRevision ||
          original.at !== commitment.at || original.generation !== commitment.generation) fail('WORKSPACE_CORRUPT');
    }
  }
  if (schemaVersion === 3) validateStoredAgents();
  capacity('audit', MAX.audit); // Startup must have room before any write admission.
}
function startup() {
  if (workerData?.actionReceipts !== undefined && typeof workerData.actionReceipts !== 'boolean' || workerData?.actionReceipts === true && workerData.initialize !== true) fail('WORKSPACE_INPUT_INVALID');
  if (workerData?.agentDelegation !== undefined && typeof workerData.agentDelegation !== 'boolean' || workerData?.agentDelegation === true && (workerData.initialize !== true || workerData.actionReceipts !== true)) fail('WORKSPACE_INPUT_INVALID');
  const version = process.versions.node.split('.').map(Number);
  if (!['win32', 'linux'].includes(process.platform) || process.arch !== 'x64' || version[0] !== 22 || version[1] < 23 || version[1] === 23 && version[2] < 3) fail('WORKSPACE_PLATFORM_UNSUPPORTED');
  boundary.assertFiles(workerData); boundary.assertLock(workerData);
  const file = path.join(workerData.root, 'authority.sqlite'), exists = fs.existsSync(file);
  if (!exists && !workerData.initialize) fail('WORKSPACE_NOT_INITIALIZED');
  if (exists && workerData.actionReceipts === true) fail('WORKSPACE_SCHEMA_UNSUPPORTED');
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
    schemaVersion = workerData.agentDelegation === true ? 3 : workerData.actionReceipts === true ? 2 : 1;
    db.exec('BEGIN IMMEDIATE;' + Object.values(schemaVersion === 3 ? AGENT_SCHEMA : schemaVersion === 2 ? RECEIPT_SCHEMA : SCHEMA).join(';') + ';PRAGMA user_version=' + schemaVersion + ';');
    db.prepare('INSERT INTO metadata VALUES(1,0,0,0,0,0,NULL,?)').run(JSON.stringify({ schema: 'WORKSPACE_AUTHORITY/' + schemaVersion, node: process.versions.node, platform: process.platform, arch: process.arch,
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
