import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {PrivateSyntheticStore} from '../server/security/syntheticFoundations/privateStore.ts';
import {SyntheticSessions, sessionDigest} from '../server/security/syntheticFoundations/sessions.ts';
import {BoundedVerifier} from '../server/security/syntheticFoundations/boundedVerifier.ts';
import {verifyAuditChain} from '../server/security/syntheticFoundations/audit.ts';
import {createTestRecoveryRoot, type TestRoot} from '../server/security/authPilot/fixtureRecovery.ts';

// Every capacity/failure check uses the actual worker and an exclusively owned
// disposable SQLite store. One real KDF output is reused; no login stress loop.
const require = createRequire(import.meta.url);
const argon = require('argon2');
const Database = require('better-sqlite3');
const verifier = await new BoundedVerifier(argon).hash('synthetic-capacity-password');
const started = performance.now();
let passed = 0, failed = 0;
type Fixture = {
  store: PrivateSyntheticStore;
  sessions: SyntheticSessions;
  now: number;
  connection: any;
  recoveryRoot?: TestRoot;
  retired: PrivateSyntheticStore[];
};
async function fixture(body: (f: Fixture) => Promise<void>, recovery = false) {
  const recoveryRoot = recovery ? createTestRecoveryRoot() : undefined;
  const store = recoveryRoot ? await PrivateSyntheticStore.createRecoveryFixture(recoveryRoot) : await PrivateSyntheticStore.create();
  const f = {store, now: 2_000_000, connection: undefined, recoveryRoot, retired: []} as Fixture;
  f.sessions = new SyntheticSessions(store, () => f.now);
  try {
    await store.execute({command: 'createPrincipal', id: 'capacity-human', kind: 'HUMAN', verifier});
    await store.execute({command: 'createPrincipal', id: 'other-human', kind: 'HUMAN', verifier});
    f.connection = new Database(path.join(store.rootDirectory, 'authority.sqlite'));
    await body(f);
  } finally {
    f.connection?.close();
    for (const retired of f.retired) await retired.close();
    await f.store.close();
    await assert.rejects(() => fs.stat(store.rootDirectory), {code: 'ENOENT'});
  }
}
async function check(name: string, body: (f: Fixture) => Promise<void>, recovery = false) {
  try { await fixture(body, recovery); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name); console.error(error); }
}
const snapshot = (f: Fixture) => f.store.execute({command: 'snapshot'});
const audit = (f: Fixture) => f.store.execute({command: 'audit'}) as Promise<any[]>;
const rows = (f: Fixture) => f.connection.prepare('SELECT * FROM sessions ORDER BY digest').all();
const row = (f: Fixture, token: string) => f.connection.prepare('SELECT * FROM sessions WHERE digest=?').get(sessionDigest(token));
const custody = (f: Fixture) => ({
  lease: f.connection.prepare('SELECT * FROM test_authority ORDER BY id').all(),
  receipts: f.connection.prepare('SELECT * FROM test_transfers ORDER BY sequence').all(),
});
async function handoff(f: Fixture) {
  assert(f.recoveryRoot);
  const previous = f.store;
  const proof = await previous.prepareTestTransfer(f.recoveryRoot, f.now);
  const successor = await PrivateSyntheticStore.acceptTestTransfer(proof, f.recoveryRoot.publicDer, f.now);
  f.retired.push(previous);
  f.store = successor;
  f.sessions = new SyntheticSessions(successor, () => f.now);
  return previous;
}
async function fill(f: Fixture, count = 256, revoke = false, principalId = 'capacity-human') {
  const tokens: string[] = [];
  for (let index = 0; index < count; index++) {
    const token = await f.sessions.issue(principalId); tokens.push(token);
    if (revoke) assert.equal(await f.sessions.revoke(token), true);
  }
  return tokens;
}
async function replayDenied(f: Fixture, tokens: string[]) {
  for (const token of tokens) assert.equal(await f.sessions.accept(token), null);
  assert.equal(await f.sessions.rotate(tokens[0]), null);
}
async function reclaimedAudit(f: Fixture, before: any[]) {
  const after = await audit(f);
  assert.deepEqual(after.slice(0, before.length), before, 'retained audit prefix changed');
  assert.deepEqual(after.slice(before.length).map(event => event.action), ['SESSIONS_RECLAIMED', 'SESSION_ISSUED']);
  assert.equal(after[before.length].target, 'fixture');
  assert.equal(after[before.length].reason, 'INACTIVE_SESSION_CAPACITY');
  assert.equal(verifyAuditChain(after), true);
}

await check('retained logout rows at 256-row capacity permit fresh issuance while preserving an active session and audit history', async f => {
  const active = await f.sessions.issue('other-human');
  const activeRow = row(f, active);
  const revoked = await fill(f, 255, true);
  assert.equal((await snapshot(f)).counts.sessions, 256);
  const before = await audit(f);
  const fresh = await f.sessions.issue('capacity-human');
  assert.equal((await snapshot(f)).counts.sessions, 2);
  assert.deepEqual(row(f, active), activeRow);
  await reclaimedAudit(f, before);
  await replayDenied(f, revoked);
  assert.equal(await f.sessions.revoke(revoked[0]), false, 'reclaimed tokens have no retained session row');
  assert.ok(await f.sessions.accept(active)); assert.ok(await f.sessions.accept(fresh));
});

await check('idle expiry reclaims at its inclusive boundary without touching a still-active row', async f => {
  const tokens = await fill(f);
  f.now += 1; assert.ok(await f.sessions.accept(tokens[255]));
  const active = row(f, tokens[255]);
  f.now += 599_998;
  const beforeBoundary = await snapshot(f);
  await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'STORE_CAPACITY'});
  assert.deepEqual(await snapshot(f), beforeBoundary);
  f.now += 1;
  const before = await audit(f);
  const fresh = await f.sessions.issue('capacity-human');
  assert.equal((await snapshot(f)).counts.sessions, 2);
  assert.deepEqual(row(f, tokens[255]), active);
  await reclaimedAudit(f, before); await replayDenied(f, tokens.slice(0, 255));
  assert.ok(await f.sessions.accept(fresh));
});

await check('absolute expiry remains fixed despite activity and reclaims only at the inclusive boundary', async f => {
  const tokens = await fill(f);
  for (let step = 0; step < 3; step++) {
    f.now += 599_999;
    for (const token of tokens) assert.ok(await f.sessions.accept(token));
  }
  f.now += 2;
  const beforeBoundary = await snapshot(f);
  await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'STORE_CAPACITY'});
  assert.deepEqual(await snapshot(f), beforeBoundary);
  f.now += 1;
  const fresh = await f.sessions.issue('capacity-human');
  assert.equal((await snapshot(f)).counts.sessions, 1);
  await replayDenied(f, tokens); assert.ok(await f.sessions.accept(fresh));
});

await check('256 usable sessions still deny issuance with every row and audit byte unchanged', async f => {
  const tokens = await fill(f), before = await snapshot(f), beforeRows = rows(f);
  await assert.rejects(() => f.sessions.issue('other-human'), {code: 'STORE_CAPACITY'});
  assert.deepEqual(await snapshot(f), before); assert.deepEqual(rows(f), beforeRows);
  assert.ok(await f.sessions.accept(tokens[0])); assert.ok(await f.sessions.accept(tokens[255]));
});

for (const invalidation of ['reset', 'disable'] as const) {
  await check(invalidation + ' reclaims unusable sessions while preserving another principal session bytes', async f => {
    const old = await fill(f, 128);
    const active = await fill(f, 128, false, 'other-human');
    const activeRows = active.map(token => row(f, token));
    if (invalidation === 'reset') await f.store.execute({command: 'resetCredential', principalId: 'capacity-human', verifier});
    else await f.store.execute({command: 'disablePrincipal', principalId: 'capacity-human'});
    const before = await audit(f);
    const fresh = await f.sessions.issue('other-human');
    assert.equal((await snapshot(f)).counts.sessions, 129);
    assert.deepEqual(active.map(token => row(f, token)), activeRows);
    await reclaimedAudit(f, before); await replayDenied(f, old); assert.ok(await f.sessions.accept(fresh));
  });
}

await check('older policy revisions are reclaimed without making their tokens current again', async f => {
  const old = await fill(f);
  await f.store.execute({command: 'registerResource', id: 'capacity-resource'});
  await f.store.execute({command: 'setRule', principalId: 'capacity-human', action: 'synthetic:read', resourceId: 'capacity-resource', effect: 'ALLOW'});
  const fresh = await f.sessions.issue('capacity-human');
  assert.equal((await snapshot(f)).counts.sessions, 1);
  await replayDenied(f, old);
  const allowed = await f.store.execute({command: 'authorize', digest: sessionDigest(fresh)!, action: 'synthetic:read', resourceId: 'capacity-resource', now: f.now});
  assert.equal(allowed.allowed, true);
});

await check('worker restart generation remains a replay fence after reclaiming all old rows', async f => {
  const old = await fill(f), before = await snapshot(f);
  await f.store.restart();
  const fresh = await f.sessions.issue('capacity-human');
  const after = await snapshot(f);
  assert.equal(after.generation, before.generation + 1); assert.equal(after.counts.sessions, 1);
  await replayDenied(f, old); assert.ok(await f.sessions.accept(fresh));
});

await check('future-dated malformed and ahead-of-authority rows are retained instead of treated as garbage', async f => {
  const tokens = await fill(f);
  const mutations = [
    ['issuedAt=?,lastSeenAt=?', [f.now + 1_800_001, f.now + 1_800_001]],
    ['lastSeenAt=?', [f.now + 1_800_001]],
    ['issuedAt=?', [-1]],
    ['lastSeenAt=?', [f.now - 1]],
    ['issuedAt=?', [f.now + 0.5]],
    ['issuedAt=?', ['invalid']],
    ['generation=?', [0]],
    ['generation=?', [2]],
    ['policyRevision=?', [2]],
    ['credentialRevision=?', [2]],
  ] as const;
  mutations.forEach(([sql, values], index) => f.connection.prepare('UPDATE sessions SET ' + sql + ' WHERE digest=?').run(...values, sessionDigest(tokens[index])));
  const retained = tokens.slice(0, mutations.length).map(token => row(f, token));
  f.now += 1_800_000;
  const fresh = await f.sessions.issue('other-human');
  assert.equal((await snapshot(f)).counts.sessions, mutations.length + 1);
  assert.deepEqual(tokens.slice(0, mutations.length).map(token => row(f, token)), retained);
  await replayDenied(f, tokens.slice(mutations.length)); assert.ok(await f.sessions.accept(fresh));
});

await check('invalid principal and stale issuance fences deny before any capacity cleanup can commit', async f => {
  await fill(f, 256, true);
  const before = await snapshot(f), current = await f.store.execute({command: 'getCredential', principalId: 'capacity-human'});
  for (const request of [
    {command: 'issueSession' as const, principalId: 'absent-human', digest: 'a'.repeat(64), now: f.now},
    {command: 'issueSession' as const, principalId: 'capacity-human', digest: 'b'.repeat(64), now: f.now, expectedCredentialRevision: current.credentialRevision + 1},
    {command: 'issueSession' as const, principalId: 'capacity-human', digest: 'c'.repeat(64), now: f.now, expectedGeneration: current.generation + 1},
  ]) {
    await assert.rejects(() => f.store.execute(request));
    assert.deepEqual(await snapshot(f), before);
  }
  assert.ok(await f.sessions.accept(await f.sessions.issue('capacity-human')));
});

await check('faults before and after deletion insertion and each audit event roll back the whole issuance', async f => {
  await fill(f, 256, true);
  const before = await snapshot(f), beforeRows = rows(f);
  const faults = [
    "BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
    "AFTER DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
    "BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
    "BEFORE INSERT ON audit WHEN instr(NEW.payload, 'SESSIONS_RECLAIMED') > 0 BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
    "BEFORE INSERT ON audit WHEN instr(NEW.payload, 'SESSION_ISSUED') > 0 BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
  ];
  for (const fault of faults) {
    f.connection.exec('CREATE TRIGGER capacity_fault ' + fault);
    try {
      await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'SQLITE_CONSTRAINT_TRIGGER'});
      assert.deepEqual(await snapshot(f), before); assert.deepEqual(rows(f), beforeRows);
    } finally { f.connection.exec('DROP TRIGGER capacity_fault'); }
  }
  assert.ok(await f.sessions.accept(await f.sessions.issue('capacity-human')));
});

await check('failed reclamation cannot rewind observed expiry and restart still fences old tokens', async f => {
  const old = await fill(f), before = await snapshot(f);
  f.now += 600_000;
  f.connection.exec("CREATE TRIGGER capacity_fault BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
  try { await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'SQLITE_CONSTRAINT_TRIGGER'}); }
  finally { f.connection.exec('DROP TRIGGER capacity_fault'); }
  assert.deepEqual(await snapshot(f), before);
  f.now -= 1;
  await assert.rejects(() => f.sessions.issue('other-human'), {code: 'STORE_CLOCK_ROLLBACK'});
  await replayDenied(f, old); assert.deepEqual(await snapshot(f), before);
  await f.store.restart();
  await replayDenied(f, old);
  f.now += 1;
  assert.ok(await f.sessions.accept(await f.sessions.issue('other-human')));
  assert.equal((await snapshot(f)).counts.sessions, 1);
});

for (const order of ['rotate-first', 'issue-first'] as const) {
  await check(order + ' concurrent rotations and capacity reclamation preserve one rotation successor', async f => {
    const active = await f.sessions.issue('other-human');
    const originalIssuedAt = row(f, active).issuedAt;
    const old = await fill(f, 255, true);
    let issuance: Promise<string>;
    let rotations: [Promise<string | null>, Promise<string | null>];
    if (order === 'issue-first') {
      issuance = f.sessions.issue('capacity-human'); rotations = [f.sessions.rotate(active), f.sessions.rotate(active)];
    } else {
      rotations = [f.sessions.rotate(active), f.sessions.rotate(active)]; issuance = f.sessions.issue('capacity-human');
    }
    const [fresh, first, second] = await Promise.all([issuance, ...rotations]);
    const successors = [first, second].filter((value): value is string => value !== null);
    assert.equal(successors.length, 1); assert.equal((await snapshot(f)).counts.sessions, 2);
    assert.equal(row(f, successors[0]).issuedAt, originalIssuedAt);
    await replayDenied(f, [...old, active]);
    assert.ok(await f.sessions.accept(fresh)); assert.ok(await f.sessions.accept(successors[0]));
  });
}

await check('one remaining audit slot and the full 4096-entry ceiling both roll back reclamation', async f => {
  await fill(f, 256, true);
  // Bounded actual worker writes, never direct fabricated ledger rows.
  let count = (await snapshot(f)).counts.audit;
  while (count < 4095) {
    const denied = await f.store.execute({command: 'authorize', digest: 'f'.repeat(64), action: 'synthetic:read', resourceId: 'absent-resource', now: f.now});
    assert.equal(denied.allowed, false); count++;
  }
  for (const expectedAuditCount of [4095, 4096]) {
    const before = await snapshot(f), beforeAudit = await audit(f), beforeRows = rows(f);
    assert.equal(before.counts.audit, expectedAuditCount);
    await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'STORE_CAPACITY'});
    assert.deepEqual(await snapshot(f), before); assert.deepEqual(rows(f), beforeRows);
    assert.deepEqual(await audit(f), beforeAudit); assert.equal(verifyAuditChain(beforeAudit), true);
    if (expectedAuditCount === 4095) await f.store.execute({command: 'authorize', digest: 'f'.repeat(64), action: 'synthetic:read', resourceId: 'absent-resource', now: f.now});
  }
});

await check('schema2 handoff fences the old owner and reclaims only obsolete generation rows with receipt history intact', async f => {
  assert.equal((await f.store.execute({command: 'info'})).schemaVersion, 2);
  const oldTokens = await fill(f), before = await snapshot(f), beforeAudit = await audit(f);
  const previous = await handoff(f);
  const claimed = await snapshot(f), claimedAudit = await audit(f), claimedCustody = custody(f);
  assert.equal(claimed.generation, before.generation + 1);
  assert.deepEqual(claimedAudit.slice(0, beforeAudit.length), beforeAudit);
  assert.deepEqual(claimedAudit.slice(beforeAudit.length).map(event => event.action), ['TEST_TRANSFER_PREPARED', 'TEST_TRANSFER_CLAIMED', 'GENERATION_STARTED']);
  assert.equal(claimedCustody.receipts.length, 1);
  await assert.rejects(() => previous.execute({command: 'issueSession', principalId: 'capacity-human', digest: 'e'.repeat(64), now: f.now}), {code: 'STORE_AUTHORITY_STALE'});
  assert.deepEqual(await snapshot(f), claimed);
  await previous.close();
  assert.equal((await fs.stat(f.store.rootDirectory)).isDirectory(), true, 'Detached old owner cannot delete successor root');
  const fresh = await f.sessions.issue('capacity-human');
  assert.equal((await snapshot(f)).counts.sessions, 1);
  assert.deepEqual(custody(f), claimedCustody);
  await reclaimedAudit(f, claimedAudit);
  await replayDenied(f, oldTokens);
  assert.ok(await f.sessions.accept(fresh));
  // A subsequent actual claim validates recovery receipts against an audit
  // ledger that now contains the new, unrelated reclamation event.
  const afterCleanup = await audit(f);
  await handoff(f);
  assert.equal((await snapshot(f)).generation, claimed.generation + 1);
  assert.equal(custody(f).receipts.length, 2);
  assert.deepEqual((await audit(f)).slice(0, afterCleanup.length), afterCleanup);
  assert.equal(verifyAuditChain(await audit(f)), true);
  assert.equal(await f.sessions.accept(fresh), null, 'Another handoff still invalidates the earlier generation');
}, true);

await check('schema2 reclamation failures roll back nested transactions and cannot rewind the observed clock', async f => {
  await handoff(f);
  const active = await f.sessions.issue('other-human'), activeRow = row(f, active);
  const revoked = await fill(f, 255, true);
  const before = await snapshot(f), beforeRows = rows(f), beforeAudit = await audit(f), beforeCustody = custody(f);
  f.now += 1;
  for (const action of ['SESSIONS_RECLAIMED', 'SESSION_ISSUED']) {
    f.connection.exec(`CREATE TRIGGER capacity_recovery_fault BEFORE INSERT ON audit WHEN instr(NEW.payload, '${action}') > 0 BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`);
    try {await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'SQLITE_CONSTRAINT_TRIGGER'});}
    finally {f.connection.exec('DROP TRIGGER capacity_recovery_fault');}
    assert.deepEqual(await snapshot(f), before);
    assert.deepEqual(rows(f), beforeRows);
    assert.deepEqual(await audit(f), beforeAudit);
    assert.deepEqual(custody(f), beforeCustody);
    f.now -= 1;
    await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'STORE_CLOCK_ROLLBACK'});
    assert.deepEqual(await snapshot(f), before);
    f.now += 1;
  }
  const fresh = await f.sessions.issue('capacity-human');
  assert.equal((await snapshot(f)).counts.sessions, 2);
  assert.deepEqual(row(f, active), activeRow);
  assert.deepEqual(custody(f), beforeCustody);
  await reclaimedAudit(f, beforeAudit);
  await replayDenied(f, revoked);
  assert.ok(await f.sessions.accept(active));
  assert.ok(await f.sessions.accept(fresh));
}, true);

await check('schema2 claim leaves a one-slot audit boundary where reclamation fails closed without altering custody', async f => {
  await fill(f, 256, true);
  // Prepare consumes one audit entry; claim consumes two. Use real worker
  // authorization denials to reach 4092, never fabricated ledger entries.
  let count = (await snapshot(f)).counts.audit;
  while (count < 4092) {
    const denied = await f.store.execute({command: 'authorize', digest: 'f'.repeat(64), action: 'synthetic:read', resourceId: 'absent-resource', now: f.now});
    assert.equal(denied.allowed, false); count++;
  }
  await handoff(f);
  assert.equal((await snapshot(f)).counts.audit, 4095);
  for (const expectedAuditCount of [4095, 4096]) {
    const before = await snapshot(f), beforeAudit = await audit(f), beforeRows = rows(f), beforeCustody = custody(f);
    assert.equal(before.counts.audit, expectedAuditCount);
    await assert.rejects(() => f.sessions.issue('capacity-human'), {code: 'STORE_CAPACITY'});
    assert.deepEqual(await snapshot(f), before);
    assert.deepEqual(rows(f), beforeRows);
    assert.deepEqual(await audit(f), beforeAudit);
    assert.deepEqual(custody(f), beforeCustody);
    assert.equal(verifyAuditChain(beforeAudit), true);
    if (expectedAuditCount === 4095) await f.store.execute({command: 'authorize', digest: 'f'.repeat(64), action: 'synthetic:read', resourceId: 'absent-resource', now: f.now});
  }
}, true);

console.log(JSON.stringify({suite: 'synthetic-session-capacity', passed, failed, elapsedMs: Math.round(performance.now() - started), profile: 'owned SQLite fixtures; one KDF hash; bounded worker writes; no operational budget'}));
process.exitCode = failed ? 1 : 0;
