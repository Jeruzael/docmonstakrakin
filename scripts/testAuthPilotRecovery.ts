/** Actual process ownership fixtures. No product server, keychain or live identity imports. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {fork, type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {createRecoveryAuthPilot, type AuthPilot, type ResourceHandle} from '../server/security/authPilot/index.ts';
import {PrivateSyntheticStore} from '../server/security/syntheticFoundations/privateStore.ts';
import {BoundedVerifier} from '../server/security/syntheticFoundations/boundedVerifier.ts';
import {verifyAuditChain} from '../server/security/syntheticFoundations/audit.ts';
import {canonicalDirectory, directoryIdentity, assertOwnedDirectory, assertOwnerMarker} from '../server/security/syntheticFoundations/ownedDirectory.mjs';
import {createTestRecoveryRoot, verifyTestTransfer, testRootFingerprint, testTransferPayload, TEST_RECOVERY_LIMITS, type TestRoot} from '../server/security/authPilot/fixtureRecovery.ts';
const require = createRequire(import.meta.url), Database = require('better-sqlite3');
type Capsule = {rootDirectory: string; parentDirectory: string; rootIdentity: string; parentIdentity: string; owner: string};
if (process.argv.includes('--recovery-child')) {
  let store: PrivateSyntheticStore | undefined, root: TestRoot | undefined, pilot: AuthPilot | undefined;
  const resources = new Map<string, ResourceHandle>();
  let signId = 0;
  const signs = new Map<number, {resolve: (raw: Buffer) => void; reject: (error: Error) => void}>();
  function proxyRoot(publicKey: string): TestRoot {
    const publicDer = Buffer.from(publicKey, 'base64');
    return {publicDer, fingerprint: testRootFingerprint(publicDer), seal(payload) {
      return new Promise((resolve, reject) => {
        const signRequestId = ++signId, timer = setTimeout(() => { signs.delete(signRequestId); reject(Error('FIXTURE_SIGN_TIMEOUT')); }, 2000);
        signs.set(signRequestId, {resolve: raw => { clearTimeout(timer); resolve(raw); }, reject: error => { clearTimeout(timer); reject(error); }});
        process.send?.({signRequestId, payload});
      });
    }};
  }
  process.on('message', async (message: any) => {
    if (Number.isSafeInteger(message?.signReplyId)) { const sign = signs.get(message.signReplyId); signs.delete(message.signReplyId); message.error ? sign?.reject(Error('FIXTURE_SIGN_UNAVAILABLE')) : sign?.resolve(Buffer.from(message.proof, 'base64')); return; }
    const requestId = message?.requestId;
    try {
      if (!message || !Number.isSafeInteger(requestId) || Buffer.byteLength(JSON.stringify(message)) > 32_768) throw Error('FIXTURE_INPUT_INVALID');
      let result: any;
      if (message.op === 'pilotCreate' || message.op === 'pilotClaim') {
        if (store || pilot) throw Error('FIXTURE_ALREADY_CREATED');
        root = proxyRoot(message.publicDer);
        pilot = await createRecoveryAuthPilot({enabled: true, mode: 'DISCONNECTED_SYNTHETIC', testRoot: root, clock: () => message.now,
          ...(message.op === 'pilotClaim' ? {transfer: Buffer.from(message.proof, 'base64')} : {})}) as AuthPilot;
        const rootDirectory = pilot.fixtures.rootDirectory, parentDirectory = canonicalDirectory(os.tmpdir());
        const owner = fs.readFileSync(path.join(rootDirectory, '.synthetic-owner'), 'utf8'); assertOwnerMarker(rootDirectory, owner);
        result = {capsule: {rootDirectory, parentDirectory, rootIdentity: directoryIdentity(rootDirectory), parentIdentity: directoryIdentity(parentDirectory), owner}, snapshot: await pilot.fixtures.snapshot()};
      } else if (message.op === 'pilotProvision') { await pilot!.fixtures.createHuman('fixture-recovered-human', message.password); await pilot!.fixtures.createAgent('fixture-recovered-agent'); result = true; }
      else if (message.op === 'pilotResource') { const handle = await pilot!.fixtures.resource('fixture-recovered-resource'); resources.set('resource', handle); if (message.grant) await pilot!.fixtures.rule('fixture-recovered-human', 'READ', handle, 'ALLOW'); result = true; }
      else if (message.op === 'pilotLogin') result = await pilot!.login({principalId: message.id ?? 'fixture-recovered-human', password: message.password});
      else if (message.op === 'pilotSession') result = await pilot!.session(message.token);
      else if (message.op === 'pilotRotate') result = await pilot!.rotate(message.token, message.csrf);
      else if (message.op === 'pilotPassword') result = await pilot!.changePassword(message.token, message.csrf, message.current, message.replacement);
      else if (message.op === 'pilotLogout') result = await pilot!.logout(message.token, message.csrf);
      else if (message.op === 'pilotAuthorize') result = await pilot!.authorize(message.token, message.capability, resources.get('resource')!);
      else if (message.op === 'pilotPrepare') result = (await pilot!.fixtures.prepareTestTransfer!()).toString('base64');
      else if (message.op === 'create') {
        if (store) throw Error('FIXTURE_ALREADY_CREATED');
        if (message.schema1) store = await PrivateSyntheticStore.create();
        else { root = proxyRoot(message.publicDer); store = await PrivateSyntheticStore.createRecoveryFixture(root); }
        const s = store as any;
        result = {capsule: {rootDirectory: s.rootDirectory, parentDirectory: s.parentDirectory, rootIdentity: s.rootIdentity, parentIdentity: s.parentIdentity, owner: s.owner}, publicDer: root?.publicDer.toString('base64'), snapshot: await store.execute({command: 'snapshot'})};
      } else if (message.op === 'claim') {
        if (store) throw Error('FIXTURE_ALREADY_CREATED');
        store = await PrivateSyntheticStore.acceptTestTransfer(Buffer.from(message.proof, 'base64'), Buffer.from(message.publicDer, 'base64'), message.now);
        root = proxyRoot(message.publicDer);
        result = await store.execute({command: 'snapshot'});
      } else if (message.op === 'exec') result = await store!.execute(message.command);
      else if (message.op === 'restart') { await store!.restart(); result = true; }
      else if (message.op === 'prepare') result = (await store!.prepareTestTransfer(root!, message.now)).toString('base64');
      else if (message.op === 'lostReply') {
        // Drop the actual committed worker reply; keep the original 3s timeout.
        (store as any).worker.removeAllListeners('message');
        result = (await store!.prepareTestTransfer(root!, message.now)).toString('base64');
      } else if (message.op === 'sealFailure') result = await store!.prepareTestTransfer({...root!, seal() { throw Error('FIXTURE_SEAL_UNAVAILABLE'); }}, message.now);
      else if (message.op === 'sealHang') result = await store!.prepareTestTransfer({...root!, seal() { return new Promise<Buffer>(() => {}); }}, message.now);
      else if (message.op === 'sealIntent') {
        const s = store as any;
        result = (await root!.seal(testTransferPayload({rootDirectory: s.rootDirectory, parentDirectory: s.parentDirectory,
          rootIdentity: s.rootIdentity, parentIdentity: s.parentIdentity, owner: s.owner, rootKeySha256: root!.fingerprint,
          nonce: randomBytes(32).toString('hex'), fromGeneration: String(message.generation ?? 1), issuedAt: String(message.now), expiresAt: String(message.now + TEST_RECOVERY_LIMITS.lifetimeMs), ...message.overrides}))).toString('base64');
      } else if (message.op === 'close') { await store?.close(); await pilot?.close(); store = undefined; pilot = undefined; result = true; }
      else throw Error('FIXTURE_COMMAND_UNKNOWN');
      process.send?.({requestId, result});
    } catch (error: any) {
      const code = error?.code ?? error?.message;
      process.send?.({requestId, error: typeof code === 'string' && /^[A-Z_]{1,80}$/.test(code) ? code : 'FIXTURE_FAILURE'});
    }
  });
  process.on('disconnect', () => { const stopping = store ? store.terminate() : pilot?.fixtures.terminate(); if (stopping) void stopping.finally(() => process.exit(0)); else process.exit(0); });
} else {
  let passed = 0, requestCounter = 0;
  const latencies: number[] = [], claimProfiles: any[] = [], children: ChildProcess[] = [], capsules: Capsule[] = [];
  const signers = new Map<ChildProcess, TestRoot>();
  const clock = Date.now(), password = 'fixture-process-restart-2026', tokenDigest = randomBytes(32).toString('hex');
  async function check(name: string, fn: () => unknown | Promise<unknown>) { await fn(); passed++; console.log('PASS ' + name); }
  function launch() {
    const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]!]));
    const child = fork(fileURLToPath(import.meta.url), ['--recovery-child'], {execPath: process.execPath,
      execArgv: ['--import', pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href], env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
    // Do not print arbitrary native diagnostics or secret-bearing IPC.
    child.stdout!.resume(); child.stderr!.resume();
    child.on('message', async (message: any) => {
      if (!Number.isSafeInteger(message?.signRequestId)) return;
      try { const proof = await signers.get(child)!.seal(message.payload); child.send({signReplyId: message.signRequestId, proof: proof.toString('base64')}); }
      catch { child.send({signReplyId: message.signRequestId, error: true}); }
    });
    children.push(child); return child;
  }
  function rpc(child: ChildProcess, body: any): Promise<any> {
    const requestId = ++requestCounter;
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, value?: any) => { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); error ? reject(error) : resolve(value); };
      const onMessage = (message: any) => { if (message?.requestId === requestId) finish(message.error ? Object.assign(Error(message.error), {code: message.error}) : undefined, message.result); };
      const onExit = () => finish(Error('FIXTURE_CHILD_EXIT'));
      const timer = setTimeout(() => { child.kill(); finish(Error('FIXTURE_CHILD_TIMEOUT')); }, 20_000);
      child.on('message', onMessage); child.once('exit', onExit); child.send({requestId, ...body}, error => { if (error) finish(Error('FIXTURE_IPC_UNAVAILABLE')); });
    });
  }
  const execute = (child: ChildProcess, command: any) => rpc(child, {op: 'exec', command});
  const snapshot = (child: ChildProcess) => execute(child, {command: 'snapshot'});
  function open(c: Capsule) { assertOwnedDirectory(c.rootDirectory, c.parentDirectory, c.rootIdentity, c.parentIdentity); assertOwnerMarker(c.rootDirectory, c.owner); return new Database(path.join(c.rootDirectory, 'authority.sqlite'), {fileMustExist: true, timeout: 200}); }
  async function create(schema1 = false) { const child = launch(), signer = createTestRecoveryRoot(); signers.set(child, signer); const data = await rpc(child, {op: 'create', schema1, publicDer: signer.publicDer.toString('base64')}); capsules.push(data.capsule); return {child, signer, ...data}; }
  const prepare = (fixture: any, now = clock) => rpc(fixture.child, {op: 'prepare', now});
  const claim = (child: ChildProcess, fixture: any, proof: string, now = clock) => { signers.set(child, fixture.signer); return rpc(child, {op: 'claim', proof, publicDer: fixture.publicDer, now}); };
  async function reject(promise: Promise<any>, codes?: string[]) { try { await promise; assert.fail('unexpected authority acceptance'); } catch (e: any) { if (e?.code === 'ERR_ASSERTION') throw e; if (codes) assert.ok(codes.includes(e.code ?? e.message), 'expected sanitized denial category'); } }
  async function stop(child: ChildProcess, close = true) {
    if (child.exitCode !== null || child.signalCode) return;
    if (close) try { await rpc(child, {op: 'close'}); } catch { /* retained roots are supervisor-cleaned below */ }
    const exited = new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode) resolve(); else child.once('exit', () => resolve()); });
    child.disconnect(); const timer = setTimeout(() => child.kill(), 5000); await exited; clearTimeout(timer);
  }
  let verifier: BoundedVerifier | undefined;
  try {
    verifier = new BoundedVerifier(require('argon2')); const phc = await verifier.hash(password);
    await check('recovery service factory is inactive by default and rejects path or store injection', async () => {
      assert.deepEqual(await createRecoveryAuthPilot(), {enabled: false});
      await assert.rejects(createRecoveryAuthPilot({enabled: true, mode: 'DISCONNECTED_SYNTHETIC', testRoot: createTestRecoveryRoot(), rootDirectory: os.tmpdir()} as any));
      await assert.rejects(createRecoveryAuthPilot({enabled: false, transfer: Buffer.alloc(0)} as any));
    });
    await check('default schema1 remains unchanged and cannot acquire transfer authority', async () => {
      const a = await create(true), before = await snapshot(a.child); assert.equal((await execute(a.child, {command: 'info'})).schemaVersion, 1);
      await reject(execute(a.child, {command: 'prepareTestTransfer', transferDigest: 'a'.repeat(64), now: clock}), ['STORE_RECOVERY_UNAVAILABLE']);
      assert.equal((await snapshot(a.child)).stateHash, before.stateHash); await stop(a.child);
    });
    const a = await create();
    await check('explicit schema2 owns pinned storage and real Argon2 credential', async () => {
      assert.equal((await execute(a.child, {command: 'info'})).schemaVersion, 2);
      await execute(a.child, {command: 'createPrincipal', id: 'fixture-process', kind: 'HUMAN', verifier: phc});
      await execute(a.child, {command: 'issueSession', principalId: 'fixture-process', digest: tokenDigest, now: clock});
      assert.ok(await execute(a.child, {command: 'acceptSession', digest: tokenDigest, now: clock}));
      assert.equal(await verifier!.verify((await execute(a.child, {command: 'getCredential', principalId: 'fixture-process'})).verifier, password), true);
    });
    await check('raw transfer command cannot bypass manager reservation and nondeleting custody', async () => {
      const before = await snapshot(a.child);
      await reject(execute(a.child, {command: 'prepareTestTransfer', transferDigest: 'a'.repeat(64), now: clock}), ['STORE_RECOVERY_UNAVAILABLE']);
      assert.equal((await snapshot(a.child)).stateHash, before.stateHash);
    });
    await check('signed but unapplied intent cannot acquire an ACTIVE store', async () => {
      const proof = await rpc(a.child, {op: 'sealIntent', now: clock}), before = await snapshot(a.child), b = launch();
      await reject(claim(b, a, proof), ['STORE_RECOVERY_CLAIM_INVALID']); assert.equal((await snapshot(a.child)).stateHash, before.stateHash); await stop(b);
    });
    const proof = await prepare(a), bytes = Buffer.from(proof, 'base64'), publicDer = Buffer.from(a.publicDer, 'base64'), payload = verifyTestTransfer(bytes, publicDer, clock);
    await check('canonical signature binds exact bytes root identity nonce generation and time', () => {
      assert.equal(testRootFingerprint(publicDer), payload.rootKeySha256); assert.equal(payload.profile, 'DISCONNECTED_TEST_STORE_TRANSFER_V1');
      const value = JSON.parse(bytes.toString());
      const malformed = [Buffer.from(' ' + bytes), Buffer.from(bytes.toString().replace('"profile":', '"profile":"duplicate","profile":')),
        Buffer.from(bytes.toString().replace('"owner"', '"ow\\u006eer"')), Buffer.concat([bytes, Buffer.from([255])]), Buffer.alloc(TEST_RECOVERY_LIMITS.proofBytes + 1),
        ...[{nonce: 'f'.repeat(64)}, {fromGeneration: '2'}, {rootDirectory: value.rootDirectory + '-other'}, {signature: value.signature.slice(0, -1)}].map(change => Buffer.from(JSON.stringify({...value, ...change})))];
      for (const input of malformed) assert.throws(() => verifyTestTransfer(input, publicDer, clock), /TEST_RECOVERY_PROOF_INVALID/);
      assert.throws(() => verifyTestTransfer(bytes, createTestRecoveryRoot().publicDer, clock)); assert.throws(() => verifyTestTransfer(bytes, publicDer, clock - 1)); assert.throws(() => verifyTestTransfer(bytes, publicDer, clock + TEST_RECOVERY_LIMITS.lifetimeMs));
    });
    await check('quiescence fences every old-worker read mutation acquisition and admin command', async () => {
      for (const command of [{command: 'info'}, {command: 'snapshot'}, {command: 'audit'}, {command: 'getCredential', principalId: 'fixture-process'},
        {command: 'createPrincipal', id: 'fixture-intruder', kind: 'AGENT'}, {command: 'registerResource', id: 'fixture-intruder'}, {command: 'issueSession', principalId: 'fixture-process', digest: 'b'.repeat(64), now: clock},
        {command: 'checkpoint'}]) await reject(execute(a.child, command), ['STORE_AUTHORITY_STALE']);
      await reject(execute(a.child, {command: 'prepareTestTransfer', transferDigest: 'b'.repeat(64), now: clock}), ['STORE_RECOVERY_UNAVAILABLE']);
      await reject(rpc(a.child, {op: 'restart'}), ['STORE_UNAVAILABLE']);
    });
    await check('correctly signed wrong nonce generation owner and root cannot replace persisted admission', async () => {
      const db = open(a.capsule), before = db.prepare('SELECT * FROM test_authority').get(); db.close();
      for (const overrides of [{nonce: '0'.repeat(64)}, {fromGeneration: '2'}, {owner: '0'.repeat(64)}]) { const forged = await rpc(a.child, {op: 'sealIntent', now: clock, overrides}), b = launch(); await reject(claim(b, a, forged)); await stop(b); }
      const other = createTestRecoveryRoot(), selfSigned = await other.seal({...payload, rootKeySha256: other.fingerprint}), b = launch();
      await reject(rpc(b, {op: 'claim', proof: selfSigned.toString('base64'), publicDer: other.publicDer.toString('base64'), now: clock}), ['STORE_RECOVERY_ROOT_UNTRUSTED']); await stop(b);
      const after = open(a.capsule); assert.deepEqual(after.prepare('SELECT * FROM test_authority').get(), before); after.close();
    });
    await check('signing the same nonce with a shifted window cannot extend or replace prepared time', async () => {
      const forged = await rpc(a.child, {op: 'sealIntent', now: clock + 1, overrides: {nonce: payload.nonce}}), b = launch();
      await reject(claim(b, a, forged, clock + 1), ['STORE_RECOVERY_CLAIM_INVALID']); await stop(b);
    });
    await check('signed path outside original temp-parent domain never opens or deletes it', async () => {
      const parent = canonicalDirectory(await fsp.mkdtemp(path.join(os.tmpdir(), 'dmk-outside-recovery-'))), outside = await fsp.mkdtemp(path.join(parent, 'dmk-s2a-synthetic-'));
      try {
        await fsp.writeFile(path.join(outside, 'sentinel'), 'synthetic-only');
        const forged = await rpc(a.child, {op: 'sealIntent', now: clock, overrides: {rootDirectory: canonicalDirectory(outside), parentDirectory: parent, rootIdentity: directoryIdentity(outside), parentIdentity: directoryIdentity(parent)}}), b = launch();
        await reject(claim(b, a, forged), ['STORE_PATH_INVALID']); await stop(b); assert.equal(await fsp.readFile(path.join(outside, 'sentinel'), 'utf8'), 'synthetic-only');
      } finally { assert.equal(path.dirname(outside), parent); assert.equal(path.dirname(parent), canonicalDirectory(os.tmpdir())); await fsp.rm(parent, {recursive: true}); }
    });
    await check('real process exit and successor claim preserve credentials and fence old sessions', async () => {
      const pid = a.child.pid; await stop(a.child); assert.ok(fs.existsSync(a.capsule.rootDirectory)); const b = launch(); assert.notEqual(b.pid, pid);
      const start = performance.now(), state = await claim(b, a, proof); latencies.push(performance.now() - start);
      assert.equal(state.generation, 2); assert.equal(state.counts.test_transfers, 1); assert.equal(await execute(b, {command: 'acceptSession', digest: tokenDigest, now: clock}), null);
      assert.equal(await verifier!.verify((await execute(b, {command: 'getCredential', principalId: 'fixture-process'})).verifier, password), true);
      await execute(b, {command: 'issueSession', principalId: 'fixture-process', digest: 'c'.repeat(64), now: clock}); assert.ok(await execute(b, {command: 'acceptSession', digest: 'c'.repeat(64), now: clock}));
      const audit = await execute(b, {command: 'audit'}); assert.ok(verifyAuditChain(audit));
      assert.equal(audit.filter((e: any) => e.action === 'TEST_TRANSFER_PREPARED').length, 1); assert.equal(audit.filter((e: any) => e.action === 'TEST_TRANSFER_CLAIMED').length, 1);
      assert.equal(audit.find((e: any) => e.action === 'TEST_TRANSFER_PREPARED').target, audit.find((e: any) => e.action === 'TEST_TRANSFER_CLAIMED').target);
      const before = await snapshot(b), replay = launch(); await reject(claim(replay, a, proof), ['STORE_RECOVERY_CLAIM_INVALID']); assert.equal((await snapshot(b)).stateHash, before.stateHash); await stop(replay);
      await reject(execute(b, {command: 'checkpoint'}), ['STORE_RECOVERY_COMMAND_UNSUPPORTED']); assert.equal((await snapshot(b)).stateHash, before.stateHash);
      await stop(b); assert.equal(fs.existsSync(a.capsule.rootDirectory), false);
    });
    await check('two processes racing one transfer acquire exactly one owner and consumption', async () => {
      const a = await create(), proof = await prepare(a), b = launch(), c = launch();
      const results = await Promise.allSettled([claim(b, a, proof), claim(c, a, proof)]); assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
      const winner = results[0].status === 'fulfilled' ? b : c, loser = winner === b ? c : b, state = await snapshot(winner); assert.equal(state.generation, 2); assert.equal(state.counts.test_transfers, 1);
      await reject(execute(a.child, {command: 'snapshot'}), ['STORE_AUTHORITY_STALE']); await stop(a.child); assert.equal((await snapshot(winner)).stateHash, state.stateHash);
      await stop(loser); assert.equal((await snapshot(winner)).stateHash, state.stateHash); await stop(winner);
    });
    await check('sequential transfers permit adjacent generations and subsequent owner restart', async () => {
      const a = await create(), first = await prepare(a), b = launch(); await claim(b, a, first); await stop(a.child);
      const next = {...a, child: b}, second = await prepare(next), c = launch(); await claim(c, next, second); await stop(b);
      assert.equal((await snapshot(c)).generation, 3); assert.equal((await snapshot(c)).counts.test_transfers, 2);
      await rpc(c, {op: 'restart'}); assert.equal((await snapshot(c)).generation, 4); assert.equal((await snapshot(c)).counts.test_transfers, 2);
      const third = await prepare({...a, child: c}), d = launch(); await claim(d, a, third); await stop(c);
      assert.equal((await snapshot(d)).generation, 5); assert.equal((await snapshot(d)).counts.test_transfers, 3); await stop(d);
    });
    await check('claim audit failure rolls back ledger lease generation and audit atomically', async () => {
      const a = await create(), proof = await prepare(a), db = open(a.capsule);
      const before = {lease: db.prepare('SELECT * FROM test_authority').get(), meta: db.prepare('SELECT * FROM metadata').get(), audit: db.prepare('SELECT count(*) AS n FROM audit').get()};
      db.exec("CREATE TRIGGER fixture_reject_transfer BEFORE INSERT ON audit WHEN json_extract(NEW.payload,'$.action')='TEST_TRANSFER_CLAIMED' BEGIN SELECT RAISE(ABORT,'injected'); END");
      const failed = launch(); await reject(claim(failed, a, proof)); await stop(failed);
      assert.deepEqual(db.prepare('SELECT * FROM test_authority').get(), before.lease); assert.deepEqual(db.prepare('SELECT * FROM metadata').get(), before.meta); assert.deepEqual(db.prepare('SELECT count(*) AS n FROM audit').get(), before.audit); assert.equal(db.prepare('SELECT count(*) AS n FROM test_transfers').get().n, 0);
      db.exec('DROP TRIGGER fixture_reject_transfer'); db.close(); const b = launch(); await claim(b, a, proof); await stop(a.child); await stop(b);
    });
    await check('expired proof leaves quiesced authority denied without automatic restoration', async () => {
      const a = await create(), proof = await prepare(a), b = launch(); await reject(claim(b, a, proof, clock + TEST_RECOVERY_LIMITS.lifetimeMs), ['TEST_RECOVERY_PROOF_INVALID']);
      const db = open(a.capsule); assert.equal(db.prepare('SELECT phase FROM test_authority').get().phase, 'QUIESCED'); assert.equal(db.prepare('SELECT count(*) AS n FROM test_transfers').get().n, 0); db.close();
      await reject(execute(a.child, {command: 'audit'}), ['STORE_AUTHORITY_STALE']); await stop(a.child); await stop(b); assert.ok(fs.existsSync(a.capsule.rootDirectory));
    });
    await check('real COMMIT before dropped worker reply retains root and fences uncertain old owner', async () => {
      const a = await create(); await reject(rpc(a.child, {op: 'lostReply', now: clock}), ['STORE_REQUEST_TIMEOUT']); const db = open(a.capsule);
      assert.equal(db.prepare('SELECT phase FROM test_authority').get().phase, 'QUIESCED'); assert.equal(db.prepare("SELECT count(*) AS n FROM audit WHERE json_extract(payload,'$.action')='TEST_TRANSFER_PREPARED'").get().n, 1); db.close();
      await reject(rpc(a.child, {op: 'restart'}), ['STORE_UNAVAILABLE']); await stop(a.child); assert.ok(fs.existsSync(a.capsule.rootDirectory));
    });
    await check('seal failure after quiescence retains data and never revives prior manager', async () => {
      const a = await create(); await reject(rpc(a.child, {op: 'sealFailure', now: clock}), ['FIXTURE_SEAL_UNAVAILABLE']); await reject(execute(a.child, {command: 'info'}), ['STORE_AUTHORITY_STALE']); await reject(rpc(a.child, {op: 'restart'}), ['STORE_UNAVAILABLE']);
      await stop(a.child); const db = open(a.capsule); assert.equal(db.prepare('SELECT phase FROM test_authority').get().phase, 'QUIESCED'); db.close();
    });
    await check('unresponsive fixture signer has a finite deadline without reactivating authority', async () => {
      const a = await create(); await reject(rpc(a.child, {op: 'sealHang', now: clock}), ['STORE_RECOVERY_SEAL_TIMEOUT']);
      await reject(execute(a.child, {command: 'snapshot'}), ['STORE_AUTHORITY_STALE']); await stop(a.child); assert.ok(fs.existsSync(a.capsule.rootDirectory));
    });
    await check('bounded marker rejects oversized wrong truncated and hard-linked files', async () => {
      const a = await create(), proof = await prepare(a), marker = path.join(a.capsule.rootDirectory, '.synthetic-owner'), saved = fs.readFileSync(marker);
      try {
        for (const content of [Buffer.alloc(128 * 1024), Buffer.alloc(64, 'f'), Buffer.alloc(63), saved.map(byte => byte | 0x80)]) { fs.writeFileSync(marker, content); const b = launch(); await reject(claim(b, a, proof), ['STORE_PATH_INVALID']); await stop(b); }
        fs.writeFileSync(marker, saved); const alias = path.join(a.capsule.rootDirectory, 'marker-link'); fs.linkSync(marker, alias);
        const b = launch(); await reject(claim(b, a, proof), ['STORE_PATH_INVALID']); await stop(b); fs.unlinkSync(alias);
      } finally { fs.writeFileSync(marker, saved); }
      const b = launch(); await claim(b, a, proof); await stop(a.child); await stop(b);
    });
    await check('unknown schema and malformed consumed ledger fail without downgrade or claim', async () => {
      const a = await create(), proof = await prepare(a), db = open(a.capsule); db.pragma('user_version=99');
      let b = launch(); await reject(claim(b, a, proof), ['STORE_SCHEMA_UNSUPPORTED']); await stop(b); assert.equal(db.pragma('user_version', {simple: true}), 99); db.pragma('user_version=2');
      db.prepare('INSERT INTO test_transfers VALUES(?,?,?,?,?)').run(2, 'e'.repeat(64), 1, 2, clock); b = launch(); await reject(claim(b, a, proof), ['STORE_RECOVERY_INTEGRITY']); await stop(b);
      db.prepare('DELETE FROM test_transfers').run(); db.prepare('INSERT INTO test_transfers VALUES(?,?,?,?,?)').run(1, 'e'.repeat(64), 0, 1, clock);
      b = launch(); await reject(claim(b, a, proof), ['STORE_RECOVERY_INTEGRITY']); await stop(b);
      assert.equal(db.prepare('SELECT generation FROM metadata').get().generation, 1); db.close(); await stop(a.child);
    });
    await check('consumed ledger deletion and digest alteration cannot retain valid claim audit', async () => {
      const a = await create(), first = await prepare(a), b = launch(); await claim(b, a, first); await stop(a.child);
      const second = await prepare({...a, child: b}), db = open(a.capsule), retained = db.prepare('SELECT * FROM test_transfers').get();
      db.prepare('UPDATE test_transfers SET transferDigest=?').run('e'.repeat(64));
      let c = launch(); await reject(claim(c, a, second), ['STORE_RECOVERY_INTEGRITY']); await stop(c);
      db.prepare('DELETE FROM test_transfers').run(); c = launch(); await reject(claim(c, a, second), ['STORE_RECOVERY_INTEGRITY']); await stop(c);
      db.prepare('INSERT INTO test_transfers VALUES(?,?,?,?,?)').run(retained.sequence, retained.transferDigest, retained.fromGeneration, retained.toGeneration, retained.consumedAt); db.close();
      c = launch(); await claim(c, a, second); await stop(b); await stop(c);
    });
    await check('receipt capacity rejects before quiescence without eviction or authority mutation', async () => {
      const a = await create(), db = open(a.capsule), insert = db.prepare('INSERT INTO test_transfers VALUES(?,?,?,?,?)');
      db.transaction(() => { for (let i = 0; i < TEST_RECOVERY_LIMITS.consumedReceipts; i++) insert.run(i + 1, i.toString(16).padStart(64, '0'), i * 2 + 1, i * 2 + 2, clock); })();
      const before = await snapshot(a.child); await reject(prepare(a), ['STORE_CAPACITY']); assert.equal((await snapshot(a.child)).stateHash, before.stateHash);
      assert.equal(db.prepare('SELECT phase FROM test_authority').get().phase, 'ACTIVE'); assert.equal(db.prepare('SELECT count(*) AS n FROM test_transfers').get().n, TEST_RECOVERY_LIMITS.consumedReceipts); db.close(); await stop(a.child); assert.ok(fs.existsSync(a.capsule.rootDirectory));
    });
    await check('actual AuthPilot recovers across process exit with login policy credential CSRF and logout controls', async () => {
      const a = launch(), signer = createTestRecoveryRoot(), publicDer = signer.publicDer.toString('base64'); signers.set(a, signer);
      const initial = await rpc(a, {op: 'pilotCreate', publicDer, now: clock}); capsules.push(initial.capsule);
      await rpc(a, {op: 'pilotProvision', password}); await rpc(a, {op: 'pilotResource', grant: true});
      const old = await rpc(a, {op: 'pilotLogin', password}); assert.equal(old.authenticated, true); assert.equal((await rpc(a, {op: 'pilotAuthorize', token: old.token, capability: 'READ'})).allowed, true);
      assert.equal((await rpc(a, {op: 'pilotLogin', id: 'fixture-recovered-agent', password})).authenticated, false);
      const proof = await rpc(a, {op: 'pilotPrepare'}); assert.equal((await rpc(a, {op: 'pilotLogin', password})).authenticated, false); assert.equal(await rpc(a, {op: 'pilotSession', token: old.token}), null);
      await stop(a); assert.ok(fs.existsSync(initial.capsule.rootDirectory));
      const b = launch(); signers.set(b, signer); const recovered = await rpc(b, {op: 'pilotClaim', proof, publicDer, now: clock}); assert.equal(recovered.snapshot.generation, 2);
      assert.equal(await rpc(b, {op: 'pilotSession', token: old.token}), null); await rpc(b, {op: 'pilotResource'});
      const fresh = await rpc(b, {op: 'pilotLogin', password}); assert.equal(fresh.authenticated, true); assert.equal((await rpc(b, {op: 'pilotAuthorize', token: fresh.token, capability: 'READ'})).allowed, true); assert.equal((await rpc(b, {op: 'pilotAuthorize', token: fresh.token, capability: 'WRITE'})).allowed, false);
      assert.equal(await rpc(b, {op: 'pilotRotate', token: fresh.token, csrf: old.csrf}), null);
      const replacement = 'fixture-new-process-password-2026'; assert.equal(await rpc(b, {op: 'pilotPassword', token: fresh.token, csrf: fresh.csrf, current: password, replacement}), true); assert.equal(await rpc(b, {op: 'pilotSession', token: fresh.token}), null);
      assert.equal((await rpc(b, {op: 'pilotLogin', password})).authenticated, false); const final = await rpc(b, {op: 'pilotLogin', password: replacement}); assert.equal(final.authenticated, true);
      assert.equal(await rpc(b, {op: 'pilotLogout', token: final.token, csrf: final.csrf}), true); assert.equal(await rpc(b, {op: 'pilotSession', token: final.token}), null);
      await stop(b); assert.equal(fs.existsSync(initial.capsule.rootDirectory), false);
    });
    await check('five fixed-profile process transfers retain bounded receipts and audited generations', async () => {
      const a = await create(); let active = a.child;
      for (let i = 0; i < 5; i++) {
        const proof = await prepare({...a, child: active}, clock + i), next = launch();
        const start = performance.now(), state = await claim(next, a, proof, clock + i), elapsed = performance.now() - start;
        latencies.push(elapsed); claimProfiles.push({fromGeneration: i + 1, proofBytes: Buffer.from(proof, 'base64').length, latencyMs: Math.round(elapsed * 100) / 100});
        assert.equal(state.generation, i + 2); assert.equal(state.counts.test_transfers, i + 1); await stop(active); active = next;
      }
      await stop(active);
    });
    const sorted = claimProfiles.map(p => p.latencyMs).sort((a, b) => a - b), percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1];
    console.log('RECOVERY_QUALIFICATION ' + JSON.stringify({node: process.version, platform: process.platform, arch: process.arch, actualChildProcesses: children.length, completedClaimLatencyMs: latencies.map(n => Math.round(n * 100) / 100), fixedFiveTransferProfile: claimProfiles, p50Ms: percentile(.5), p95Ms: percentile(.95), parentPeakRssBytes: process.resourceUsage().maxRSS * 1024, parentCpuMicroseconds: {user: process.resourceUsage().userCPUTime, system: process.resourceUsage().systemCPUTime}, measurements: 'synthetic process-start claims; parent metrics exclude child-tree peaks and CPU; capacity performance unmeasured', profile: 'DISCONNECTED_TEST_ONLY'}));
    console.log(`Auth pilot process recovery: ${passed}/${passed} checks passed`);
  } finally {
    for (const child of children) await stop(child);
    for (const c of capsules) if (fs.existsSync(c.rootDirectory)) {
      assert.equal(c.parentDirectory, canonicalDirectory(os.tmpdir())); assertOwnedDirectory(c.rootDirectory, c.parentDirectory, c.rootIdentity, c.parentIdentity); assertOwnerMarker(c.rootDirectory, c.owner); await fsp.rm(c.rootDirectory, {recursive: true});
    }
  }
}
