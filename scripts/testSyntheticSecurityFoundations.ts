import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

// The suite deliberately fails an assertion, rather than a loader error, before
// the new entry point exists. It runs only against disposable synthetic stores.
let foundations: typeof import('../server/security/syntheticFoundations/index.ts') | undefined;
try { foundations = await import('../server/security/syntheticFoundations/index.ts'); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
assert.ok(foundations, 'Synthetic foundations entry point must exist');
let passed = 0;
async function check(name: string, body: () => void | Promise<void>) {
  await body(); passed++; console.log('PASS ' + name);
}
const {createSyntheticFoundations, DEVELOPMENT_CUTOFF_MS} = foundations;
async function lifecycleChild() {
  const candidate = await createSyntheticFoundations({enabled: true});
  if (!candidate.enabled) throw Error('synthetic child disabled');
  process.send?.({rootDirectory: candidate.rootDirectory});
  let failed = false;
  try {
    const before = await candidate.store.execute({command: 'snapshot'});
    await candidate.store.terminate();
    const results = await Promise.allSettled([candidate.store.restart(), candidate.store.restart()]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'only one overlapping restart may own a worker');
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    assert.equal(rejected.reason.code, 'STORE_LIFECYCLE_BUSY');
    assert.equal((await candidate.store.execute({command: 'snapshot'})).generation, before.generation + 1);
    const terminated = await Promise.allSettled([candidate.store.terminate(), candidate.store.restart(), candidate.store.terminate()]);
    assert.equal(terminated[0].status, 'fulfilled');
    for (const result of terminated.slice(1)) { assert.equal(result.status, 'rejected'); assert.equal((result as PromiseRejectedResult).reason.code, 'STORE_LIFECYCLE_BUSY'); }
    await candidate.store.restart();
    assert.equal((await candidate.store.execute({command: 'info'})).schemaVersion, 1, 'old exit callbacks cannot poison the replacement worker');
    await candidate.store.terminate();
    const closed = await Promise.allSettled([candidate.store.restart(), candidate.close()]);
    assert.equal(closed[1].status, 'fulfilled', 'close waits for the in-flight lifecycle transition and cleans its root');
    await assert.rejects(() => fs.stat(candidate.rootDirectory), {code: 'ENOENT'});
    await assert.rejects(() => candidate.store.execute({command: 'info'}));
    process.send?.({done: true});
  } catch (error) { failed = true; throw error; }
  finally { try { await candidate.close(); } catch (error) { if (!failed) throw error; } }
}
async function boundedLifecycleProbe() {
  const child = spawn(process.execPath, ['--import', pathToFileURL(path.join(process.cwd(), 'node_modules/tsx/dist/loader.mjs')).href, fileURLToPath(import.meta.url), '--lifecycle-child'], {cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  let root: string | undefined, done = false, output = '';
  child.stdout.on('data', bytes => { output = (output + bytes.toString()).slice(-8192); });
  child.stderr.on('data', bytes => { output = (output + bytes.toString()).slice(-8192); });
  child.on('message', (message: any) => { if (typeof message?.rootDirectory === 'string') root = message.rootDirectory; if (message?.done === true) done = true; });
  const exited = new Promise<number | null>(resolve => child.once('exit', resolve));
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(Error('Synthetic lifecycle child exceeded 12 seconds: ' + output)); }, 12_000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      void exited.then(code => { clearTimeout(timer); if (code === 0 && done) resolve(); else reject(Error('Synthetic lifecycle child failed: ' + output)); });
    });
    assert.ok(root, 'child reported its generated disposable root');
    await assert.rejects(() => fs.stat(root!), {code: 'ENOENT'});
  } finally {
    if (child.exitCode === null) child.kill();
    await exited;
    // A failed child may leave its own fixture. Validate its exact generated
    // absolute root before recursive cleanup; no operator directory is accepted.
    if (root && path.dirname(root) === await fs.realpath(os.tmpdir()) && /^dmk-s2a-synthetic-[A-Za-z0-9]+$/.test(path.basename(root))) {
      try {
        // The trusted child can partially remove its marker before a failing
        // close. Its reported, resolved fresh root remains the cleanup bound.
        if (!(await fs.lstat(root)).isSymbolicLink() && await fs.realpath(root) === root) await fs.rm(root, {recursive: true});
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
}
if (process.argv.includes('--lifecycle-child')) {
  try { await lifecycleChild(); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally { process.disconnect?.(); }
} else if (process.argv.includes('--lifecycle-probe-only')) {
  await boundedLifecycleProbe(); console.log('PASS serialized lifecycle and bounded child exit');
} else {
const before = (await fs.readdir(os.tmpdir())).filter(n => n.startsWith('dmk-s2a-synthetic-')).sort();
const initialRequire = createRequire(import.meta.url);
const nativeBefore = Object.keys(initialRequire.cache).filter(filename => /[\\/](?:argon2|better-sqlite3)[\\/]/.test(filename));
await check('default factory remains inert and denies even with ambient opt-in text', async () => {
  const previous = process.env.DMK_S2A_ENABLED;
  process.env.DMK_S2A_ENABLED = 'true';
  try {
    const disabled = await createSyntheticFoundations();
    assert.equal(disabled.enabled, false);
    assert.equal((await disabled.authorize({})).allowed, false);
    assert.deepEqual((await fs.readdir(os.tmpdir())).filter(n => n.startsWith('dmk-s2a-synthetic-')).sort(), before);
    assert.deepEqual(Object.keys(initialRequire.cache).filter(filename => /[\\/](?:argon2|better-sqlite3)[\\/]/.test(filename)), nativeBefore);
  } finally {
    if (previous === undefined) delete process.env.DMK_S2A_ENABLED; else process.env.DMK_S2A_ENABLED = previous;
  }
});
await check('development deadline metadata is exact and unknown activation options reject', async () => {
  assert.equal(DEVELOPMENT_CUTOFF_MS, Date.parse('2026-11-04T00:00:00.000Z'));
  await assert.rejects(() => createSyntheticFoundations({enabled: true, rootDirectory: process.cwd()} as any));
  await assert.rejects(() => createSyntheticFoundations({enabled: 'true'} as any));
});

const {BoundedVerifier, KDF_PROFILE} = await import('../server/security/syntheticFoundations/boundedVerifier.ts');
const {canonicalAuditPayload, auditHash, verifyAuditChain} = await import('../server/security/syntheticFoundations/audit.ts');
const {evaluateSyntheticPolicy} = await import('../server/security/syntheticFoundations/policy.ts');
await check('pure policy fails closed for malformed authority snapshots and effects', () => {
  for (const input of [null, undefined, {}, {authorityCurrent: 'true'}, {authorityCurrent: true, principal: {kind: 'HUMAN'}, action: 'synthetic:read', resourceExists: true, effects: null}, {authorityCurrent: true, principal: {kind: 'HUMAN'}, action: 'synthetic:read', resourceExists: 'true', effects: ['ALLOW']}, {authorityCurrent: true, principal: {kind: 'HUMAN'}, action: 'synthetic:read', resourceExists: true, effects: ['ALLOW']}]) {
    assert.equal(evaluateSyntheticPolicy(input as any).allowed, false);
  }
});
await check('audit canonicalization is recursive and rejects ambiguous data', () => {
  assert.equal(canonicalAuditPayload({z: {b: 2, a: 1}, a: ['x']}), '{"a":["x"],"z":{"a":1,"b":2}}');
  assert.equal(auditHash({a: 1, b: 2}), auditHash({b: 2, a: 1}));
  for (const invalid of [NaN, Infinity, undefined, {a: undefined}, new Date(), {token: 'secret'}]) {
    assert.throws(() => canonicalAuditPayload(invalid));
  }
});
let releaseNative: Array<() => void> = [];
let nativeStarted = 0;
const fakeNative = {
  hash: async () => { throw new Error('not used'); },
  verify: async () => { nativeStarted++; await new Promise<void>(resolve => releaseNative.push(resolve)); return true; },
};
const canonicalPhc = '$argon2id$v=19$m=32768,p=1,t=3$' + Buffer.alloc(16, 1).toString('base64').replace(/=/g, '') + '$' + Buffer.alloc(32, 2).toString('base64').replace(/=/g, '');
await check('hostile verifiers reject before allocating native work', async () => {
  const verifier = new BoundedVerifier(fakeNative);
  for (const input of ['', 'x'.repeat(10000), canonicalPhc.replace('32768', '2147483647'), canonicalPhc.replace('v=19', 'v=16'), canonicalPhc.replace('argon2id', 'argon2i'), canonicalPhc + '=', canonicalPhc.replace('m=32768,p=1,t=3', 'm=32768,t=3,p=1'), canonicalPhc.replace('p=1', 'p=1,p=1')]) {
    assert.equal(await verifier.verify(input, 'synthetic-password'), false);
  }
  assert.equal(await verifier.verify(canonicalPhc, 'x'.repeat(1025)), false);
  assert.equal(nativeStarted, 0);
  assert.deepEqual(KDF_PROFILE, {type: 2, version: 0x13, memoryCost: 32768, timeCost: 3, parallelism: 1, hashLength: 32});
});
await check('two active and four queued admit six of ten without a hidden queue', async () => {
  const verifier = new BoundedVerifier(fakeNative);
  const results = Array.from({length: 10}, () => verifier.verify(canonicalPhc, 'synthetic-password').then(value => value ? 'ok' : 'wrong', error => error.code));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nativeStarted, 2);
  assert.deepEqual(verifier.stats(), {active: 2, queued: 4});
  while (verifier.stats().active || verifier.stats().queued) {
    releaseNative.splice(0).forEach(resolve => resolve());
    await new Promise(resolve => setImmediate(resolve));
  }
  const values = await Promise.all(results);
  assert.equal(values.filter(v => v === 'ok').length, 6);
  assert.equal(values.filter(v => v === 'KDF_OVERLOADED').length, 4);
});
await check('active abort retains admission until native completion and queued abort removes work', async () => {
  releaseNative = []; nativeStarted = 0;
  const verifier = new BoundedVerifier(fakeNative);
  const activeAbort = new AbortController(), queuedAbort = new AbortController();
  const first = verifier.verify(canonicalPhc, 'pw', {signal: activeAbort.signal}).catch(e => e.code);
  const second = verifier.verify(canonicalPhc, 'pw');
  const queued = verifier.verify(canonicalPhc, 'pw', {signal: queuedAbort.signal}).catch(e => e.code);
  activeAbort.abort(); queuedAbort.abort();
  assert.equal(await first, 'KDF_ABORTED'); assert.equal(await queued, 'KDF_ABORTED');
  assert.deepEqual(verifier.stats(), {active: 2, queued: 0});
  releaseNative.splice(0).forEach(resolve => resolve()); await second;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(verifier.stats(), {active: 0, queued: 0});
});
await check('queued timeout and native failure release only their own budgets', async () => {
  releaseNative = []; nativeStarted = 0;
  const verifier = new BoundedVerifier(fakeNative, {queuedWaitMs: 20});
  const one = verifier.verify(canonicalPhc, 'pw'), two = verifier.verify(canonicalPhc, 'pw');
  assert.equal(await verifier.verify(canonicalPhc, 'pw').catch(e => e.code), 'KDF_QUEUE_TIMEOUT');
  assert.deepEqual(verifier.stats(), {active: 2, queued: 0});
  releaseNative.splice(0).forEach(resolve => resolve()); await Promise.all([one, two]);
  const failing = new BoundedVerifier({...fakeNative, verify: async () => { throw Error('synthetic native failure'); }});
  await assert.rejects(() => failing.verify(canonicalPhc, 'pw'), {code: 'KDF_UNAVAILABLE'});
  assert.deepEqual(failing.stats(), {active: 0, queued: 0});
});

let now = 1_000_000;
const fixture = await createSyntheticFoundations({enabled: true, clock: () => now});
assert.equal(fixture.enabled, true);
if (!fixture.enabled) throw Error('fixture did not enable');
const rootDirectory = fixture.rootDirectory;
const password = 'synthetic-only-do-not-enroll-anyone';
const secrets: string[] = [password];
try {
  await check('worker records actual native compatibility and owns a fresh private temporary store', async () => {
    assert.equal(path.dirname(rootDirectory), await fs.realpath(os.tmpdir()));
    assert.match(path.basename(rootDirectory), /^dmk-s2a-synthetic-/);
    const info = await fixture.store.execute({command: 'info'});
    assert.equal(info.schemaVersion, 1); assert.equal(info.journalMode, 'wal');
    assert.equal(info.synchronous, 2); assert.equal(info.foreignKeys, 1);
    assert.equal(info.packages.sqlite, '13.0.3');
    assert.equal(info.sqliteVersion, '3.53.4');
    assert.match(info.nativeSha256, /^[a-f0-9]{64}$/);
    if (process.platform !== 'win32') assert.equal((await fs.stat(rootDirectory)).mode & 0o777, 0o700);
    console.log('SYNTHETIC_COMPATIBILITY ' + JSON.stringify(info));
    const require = createRequire(import.meta.url);
    assert.equal(require('argon2/package.json').version, '0.45.1');
    const nativePaths = Object.keys(require.cache).filter(filename => filename.includes(path.sep + 'argon2' + path.sep) && filename.endsWith('.node'));
    assert.equal(nativePaths.length, 1);
    console.log('SYNTHETIC_ARGON2_NATIVE ' + JSON.stringify({version: '0.45.1', nativePath: nativePaths[0], nativeSha256: createHash('sha256').update(await fs.readFile(nativePaths[0])).digest('hex')}));
  });
  let humanToken = '';
  await check('real Argon2id hashing and password verification use exact approved synthetic profile', async () => {
    const start = performance.now();
    const verifier = await fixture.verifier.hash(password);
    assert.match(verifier, /^\$argon2id\$v=19\$m=32768,p=1,t=3\$/);
    assert.equal(await fixture.verifier.verify(verifier, password), true);
    assert.equal(await fixture.verifier.verify(verifier, 'synthetic-wrong'), false);
    console.log('SYNTHETIC_KDF_SAMPLE_MS ' + (performance.now() - start).toFixed(3));
    await fixture.store.execute({command: 'createPrincipal', id: 'human-a', kind: 'HUMAN', verifier});
    await fixture.store.execute({command: 'createPrincipal', id: 'human-b', kind: 'HUMAN', verifier});
    await fixture.store.execute({command: 'createPrincipal', id: 'agent-a', kind: 'AGENT'});
    assert.equal(await fixture.authenticate('human-a', 'wrong'), null);
    assert.equal(await fixture.authenticate('missing-human', password), null);
    assert.equal(await fixture.authenticate('agent-a', password), null);
    humanToken = (await fixture.authenticate('human-a', password))!;
    assert.match(humanToken, /^[A-Za-z0-9_-]{43}$/); secrets.push(humanToken);
    assert.equal((await fixture.sessions.accept(humanToken))?.principalId, 'human-a');
  });
  await check('malformed noncanonical session tokens deny without authority state changes', async () => {
    const before = await fixture.store.execute({command: 'snapshot'});
    for (const token of [null, {}, '', 'x'.repeat(10000), humanToken + '=', humanToken.slice(0, -1) + 'B']) assert.equal(await fixture.sessions.accept(token), null);
    assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), before);
  });
  await check('unknown or excessive worker commands and malformed inputs deny without mutation', async () => {
    const before = await fixture.store.execute({command: 'snapshot'});
    for (const command of [null, {command: 'exec', sql: 'DROP TABLE principals'}, {command: 'createPrincipal', id: 'forged', kind: 'ADMIN'}, {command: 'createPrincipal', id: 'x'.repeat(10000), kind: 'HUMAN'}, {command: 'info', extra: 'unreviewed'}, {command: 'createPrincipal', id: 'agent-b', kind: 'AGENT', verifier: canonicalPhc}]) {
      await assert.rejects(() => fixture.store.execute(command as any));
    }
    assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), before);
  });
  await check('policy requires a registered current principal action resource and explicit matching allow', async () => {
    await fixture.store.execute({command: 'registerResource', id: 'resource-a'});
    await fixture.store.execute({command: 'registerResource', id: 'resource-b'});
    for (const request of [{token: '', action: 'synthetic:read', resourceId: 'resource-a'}, {token: humanToken, action: 'unknown', resourceId: 'resource-a'}, {token: humanToken, action: 'synthetic:read', resourceId: 'missing'}, {token: humanToken, action: 'synthetic:read', resourceId: 'resource-a'}]) {
      assert.equal((await fixture.authorize(request)).allowed, false);
    }
    await fixture.store.execute({command: 'setRule', principalId: 'human-a', action: 'synthetic:read', resourceId: 'resource-a', effect: 'ALLOW'});
    assert.equal((await fixture.authorize({token: humanToken, action: 'synthetic:read', resourceId: 'resource-a'})).allowed, false, 'policy revision revokes older sessions');
    humanToken = (await fixture.authenticate('human-a', password))!; secrets.push(humanToken);
    assert.equal((await fixture.authorize({token: humanToken, action: 'synthetic:read', resourceId: 'resource-a'})).allowed, true);
    assert.equal((await fixture.authorize({token: humanToken, action: 'synthetic:read', resourceId: 'resource-b'})).allowed, false);
    const other = (await fixture.authenticate('human-b', password))!; secrets.push(other);
    assert.equal((await fixture.authorize({token: other, action: 'synthetic:read', resourceId: 'resource-a'})).allowed, false);
  });
  await check('explicit deny and nonhuman exclusion take precedence over allow rules', async () => {
    await fixture.store.execute({command: 'setRule', principalId: 'human-a', action: 'synthetic:read', resourceId: 'resource-a', effect: 'DENY'});
    humanToken = (await fixture.authenticate('human-a', password))!; secrets.push(humanToken);
    assert.equal((await fixture.authorize({token: humanToken, action: 'synthetic:read', resourceId: 'resource-a'})).reason, 'EXPLICIT_DENY');
    await fixture.store.execute({command: 'setRule', principalId: 'agent-a', action: 'synthetic:human-approve', resourceId: 'resource-a', effect: 'ALLOW'});
    const agent = await fixture.sessions.issue('agent-a'); secrets.push(agent);
    assert.equal((await fixture.authorize({token: agent, action: 'synthetic:human-approve', resourceId: 'resource-a'})).reason, 'HUMAN_REQUIRED');
  });
  await check('rotation atomically invalidates replay and preserves the absolute expiry', async () => {
    const original = await fixture.sessions.issue('human-a'); secrets.push(original);
    now += 1;
    const outcomes = await Promise.all([fixture.sessions.rotate(original), fixture.sessions.rotate(original)]);
    assert.equal(outcomes.filter(Boolean).length, 1);
    const rotated = outcomes.find(Boolean)!; secrets.push(rotated);
    assert.equal(await fixture.sessions.accept(original), null);
    assert.equal((await fixture.sessions.accept(rotated))?.issuedAt, now - 1);
    await fixture.sessions.revoke(rotated);
    assert.equal(await fixture.sessions.accept(rotated), null);
  });
  await check('idle expiry uses the exact boundary and rejected tokens never extend a session', async () => {
    const token = await fixture.sessions.issue('human-a'); secrets.push(token);
    now += 600_000;
    assert.equal(await fixture.sessions.accept(token), null);
    now += 1; assert.equal(await fixture.sessions.accept(token), null);
  });
  await check('observed idle expiry cannot be reversed by clock rollback', async () => {
    const token = await fixture.sessions.issue('human-a'); secrets.push(token);
    now += 600_000; assert.equal(await fixture.sessions.accept(token), null);
    const observed = now;
    now -= 1; assert.equal(await fixture.sessions.accept(token), null);
    now = observed;
  });
  await check('absolute expiry survives activity and rotation and clock rollback denies', async () => {
    const start = now; let token = await fixture.sessions.issue('human-a'); secrets.push(token);
    for (let i = 1; i <= 3; i++) { now = start + i * 500_000; assert.ok(await fixture.sessions.accept(token)); }
    token = (await fixture.sessions.rotate(token))!; secrets.push(token);
    now = start + 1_800_000; assert.equal(await fixture.sessions.accept(token), null);
    const next = await fixture.sessions.issue('human-a'); secrets.push(next);
    now -= 1; assert.equal(await fixture.sessions.accept(next), null); now += 1;
  });
  await check('observed absolute expiry cannot be reversed by clock rollback', async () => {
    const start = now, token = await fixture.sessions.issue('human-a'); secrets.push(token);
    for (let step = 1; step <= 3; step++) { now = start + step * 500_000; assert.ok(await fixture.sessions.accept(token)); }
    now = start + 1_800_000; assert.equal(await fixture.sessions.accept(token), null);
    now -= 1; assert.equal(await fixture.sessions.accept(token), null);
    now += 1;
  });
  await check('denied authorization records only sanitized monotonic time and cannot reverse it', async () => {
    const token = await fixture.sessions.issue('human-a'); secrets.push(token);
    const before = await fixture.store.execute({command: 'snapshot'});
    now += 500_000;
    assert.equal((await fixture.authorize({token, action: 'synthetic:read', resourceId: 'resource-b'})).allowed, false);
    const after = await fixture.store.execute({command: 'snapshot'});
    assert.equal(after.clockHighWater, now);
    assert.deepEqual({...after.counts, audit: before.counts.audit}, before.counts);
    assert.equal(after.domainStateHash, before.domainStateHash, 'denial changes only observed-time metadata and its sanitized audit, never session activity or rights');
    assert.equal(after.generation, before.generation); assert.equal(after.policyRevision, before.policyRevision);
    now -= 1; assert.equal(await fixture.sessions.accept(token), null); now += 1;
  });
  await check('credential reset disable and restart revoke existing session generations', async () => {
    let token = await fixture.sessions.issue('human-a'); secrets.push(token);
    await fixture.store.execute({command: 'resetCredential', principalId: 'human-a', verifier: await fixture.verifier.hash(password)});
    assert.equal(await fixture.sessions.accept(token), null);
    token = await fixture.sessions.issue('human-a'); secrets.push(token);
    await fixture.store.execute({command: 'disablePrincipal', principalId: 'human-a'});
    assert.equal(await fixture.sessions.accept(token), null);
    await assert.rejects(() => fixture.sessions.issue('human-a'));
    token = await fixture.sessions.issue('human-b'); secrets.push(token);
    await fixture.store.restart();
    assert.equal(await fixture.sessions.accept(token), null);
  });
  await check('stale credential work cannot publish a session and rejected transactions roll back', async () => {
    const principal = await fixture.store.execute({command: 'getCredential', principalId: 'human-b'});
    await fixture.store.execute({command: 'resetCredential', principalId: 'human-b', verifier: await fixture.verifier.hash(password)});
    const before = await fixture.store.execute({command: 'snapshot'});
    await assert.rejects(() => fixture.store.execute({command: 'issueSession', principalId: 'human-b', digest: 'a'.repeat(64), now, expectedCredentialRevision: principal.credentialRevision, expectedGeneration: principal.generation}));
    await assert.rejects(() => fixture.store.execute({command: 'createPrincipal', id: 'human-b', kind: 'HUMAN', verifier: canonicalPhc}));
    assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), before);
  });
  await check('audit persistence failure rolls back its paired authority mutation', async () => {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const connection = new Database(path.join(rootDirectory, 'authority.sqlite'));
    try {
      const before = await fixture.store.execute({command: 'snapshot'});
      // Fault injection is confined to this test's own generated fixture DB.
      connection.exec("CREATE TRIGGER synthetic_audit_fault BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'synthetic fault'); END");
      await assert.rejects(() => fixture.store.execute({command: 'createPrincipal', id: 'must-rollback', kind: 'AGENT'}));
      assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), before);
      assert.equal(await fixture.store.execute({command: 'getCredential', principalId: 'must-rollback'}), null);
      connection.exec('DROP TRIGGER synthetic_audit_fault');
    } finally { connection.close(); }
  });
  await check('expiry observed during an audit failure cannot reverse after SQLite rollback', async () => {
    const require = createRequire(import.meta.url), Database = require('better-sqlite3');
    const token = await fixture.sessions.issue('human-b'); secrets.push(token);
    const connection = new Database(path.join(rootDirectory, 'authority.sqlite'));
    try {
      const before = await fixture.store.execute({command: 'snapshot'});
      connection.exec("CREATE TRIGGER synthetic_audit_fault BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'synthetic fault'); END");
      now += 600_000;
      const denied = await fixture.authorize({token, action: 'synthetic:read', resourceId: 'resource-b'});
      assert.equal(denied.allowed, false); assert.equal(denied.reason, 'AUTHORITY_UNAVAILABLE');
      assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), before, 'persisted clock/domain/audit changes still roll back atomically');
      connection.exec('DROP TRIGGER synthetic_audit_fault');
      now -= 1; assert.equal(await fixture.sessions.accept(token), null);
      now += 1;
    } finally { connection.exec('DROP TRIGGER IF EXISTS synthetic_audit_fault'); connection.close(); }
  });
  await check('busy writer rejects without a partial domain or audit commit', async () => {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const connection = new Database(path.join(rootDirectory, 'authority.sqlite'), {timeout: 100});
    const before = await fixture.store.execute({command: 'snapshot'});
    try {
      connection.exec('BEGIN IMMEDIATE');
      await assert.rejects(() => fixture.store.execute({command: 'createPrincipal', id: 'busy-must-not-exist', kind: 'AGENT'}), {code: 'SQLITE_BUSY'});
    } finally { connection.exec('ROLLBACK'); connection.close(); }
    assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), before);
  });
  await check('worker RPC admission rejects excess work without an unbounded message queue', async () => {
    const results = await Promise.all(Array.from({length: 32}, () => fixture.store.execute({command: 'snapshot'}).then(() => 'ok', error => error.code)));
    assert.equal(results.filter(value => value === 'ok').length, 16);
    assert.equal(results.filter(value => value === 'STORE_OVERLOADED').length, 16);
  });
  await check('synthetic principal and resource cardinality bounds reject without writes', async () => {
    let snapshot = await fixture.store.execute({command: 'snapshot'});
    for (let i = snapshot.counts.principals; i < 128; i++) await fixture.store.execute({command: 'createPrincipal', id: 'bounded-agent-' + i, kind: 'AGENT'});
    snapshot = await fixture.store.execute({command: 'snapshot'});
    await assert.rejects(() => fixture.store.execute({command: 'createPrincipal', id: 'over-principal-budget', kind: 'AGENT'}), {code: 'STORE_CAPACITY'});
    assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), snapshot);
    for (let i = snapshot.counts.resources; i < 128; i++) await fixture.store.execute({command: 'registerResource', id: 'bounded-resource-' + i});
    snapshot = await fixture.store.execute({command: 'snapshot'});
    await assert.rejects(() => fixture.store.execute({command: 'registerResource', id: 'over-resource-budget'}), {code: 'STORE_CAPACITY'});
    assert.deepEqual(await fixture.store.execute({command: 'snapshot'}), snapshot);
  });
  await check('audit chain is deterministic tamper evident and omits credential and token material', async () => {
    const entries = await fixture.store.execute({command: 'audit'});
    assert.ok(entries.length > 0); assert.equal(verifyAuditChain(entries), true);
    assert.equal(verifyAuditChain(entries.slice(1)), false);
    assert.equal(verifyAuditChain([...entries].reverse()), false);
    const changed = structuredClone(entries); changed[0].action = 'forged';
    assert.equal(verifyAuditChain(changed), false);
    assert.equal(verifyAuditChain(entries.slice(0, -1), entries.at(-1)!.hash), false, 'tail truncation requires the retained head anchor');
    const text = JSON.stringify(entries);
    for (const secret of secrets) assert.equal(text.includes(secret), false);
    assert.equal(text.includes('$argon2'), false);
    await fixture.store.execute({command: 'checkpoint'});
    for (const filename of await fs.readdir(rootDirectory)) {
      const bytes = await fs.readFile(path.join(rootDirectory, filename));
      for (const secret of secrets) assert.equal(bytes.includes(Buffer.from(secret)), false, 'secret persisted in ' + filename);
    }
  });
  await check('terminated authority denies future policy and session work without fallback', async () => {
    const token = await fixture.sessions.issue('human-b'); secrets.push(token);
    await fixture.store.terminate();
    assert.equal((await fixture.authorize({token, action: 'synthetic:read', resourceId: 'resource-a'})).allowed, false);
    assert.equal(await fixture.sessions.accept(token), null);
    await assert.rejects(() => fixture.sessions.issue('human-b'));
  });
  await check('unsupported existing schema rejects reopen without creating a fallback store', async () => {
    const require = createRequire(import.meta.url), Database = require('better-sqlite3');
    const connection = new Database(path.join(rootDirectory, 'authority.sqlite'));
    connection.pragma('user_version=99'); connection.close();
    await assert.rejects(() => fixture.store.restart(), {code: 'STORE_SCHEMA_UNSUPPORTED'});
    assert.equal((await fixture.authorize({token: humanToken, action: 'synthetic:read', resourceId: 'resource-a'})).allowed, false);
  });
  await check('missing authority during restart denies instead of silently creating an empty store', async () => {
    await fs.unlink(path.join(rootDirectory, 'authority.sqlite'));
    await assert.rejects(() => fixture.store.restart());
    await assert.rejects(() => fs.stat(path.join(rootDirectory, 'authority.sqlite')), {code: 'ENOENT'});
  });
  await check('corrupt authority rejects reopen and never falls back to memory or another path', async () => {
    await fs.writeFile(path.join(rootDirectory, 'authority.sqlite'), 'synthetic corrupt database', {mode: 0o600});
    await assert.rejects(() => fixture.store.restart());
    await assert.rejects(() => fixture.sessions.issue('human-b'));
    assert.deepEqual((await fs.readdir(rootDirectory)).filter(name => name.endsWith('.sqlite')), ['authority.sqlite']);
  });
} finally { await fixture.close(); }
await check('fixture close removes only its own disposable private root', async () => {
  await assert.rejects(() => fs.stat(rootDirectory), {code: 'ENOENT'});
});
await check('raw worker rejects an arbitrary repository root before importing SQLite', async () => {
  const worker = new Worker(new URL('../server/security/syntheticFoundations/privateStoreWorker.mjs', import.meta.url), {workerData: {rootDirectory: process.cwd(), owner: 'a'.repeat(64), fresh: false}, execArgv: []});
  try {
    const result: any = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    assert.equal(result.ready, false); assert.equal(result.error, 'STORE_PATH_INVALID');
  } finally { await worker.terminate(); }
});
await check('overlapping restart and close keep one worker and child exits within its bound', boundedLifecycleProbe);
console.log('Synthetic security foundations: ' + passed + ' named checks passed; synthetic feasibility only.');
}
