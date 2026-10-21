import assert from 'node:assert/strict';
import { syntheticCeremony } from './fixtures/syntheticWbsCeremony.ts';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { canonicalGovernanceJson } from './verifyWbsGovernanceEnvelope.ts';
import { randomBytes } from 'node:crypto';

// Acceptance tests are introduced before the new implementation. Synthetic
// fixtures never appoint people, install roots or apply the repository WBS.
const api = await import(new URL('./lib/syntheticWbsRegistration.ts', import.meta.url).href).catch(() => undefined);
let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); }
}
check('C01 trusted synthetic registration entrypoint rejects missing authority and never grants apply', () => {
  assert.ok(api, 'Trusted synthetic registration entrypoint is not implemented');
  const result = api.verifySyntheticRegistration(undefined, undefined, undefined);
  assert.equal(result.valid, false); assert.equal(result.mayApply, false); assert.equal(result.operationalAuthority, false);
});
if (api) {
  for (const profile of ['ORDINARY', 'ELEVATED']) check('C02 ' + profile + ' composes envelope, exact receipt, protected CAS and preview', () => {
    const f = syntheticCeremony(profile); const r = api.verifySyntheticRegistration(f.request, f.source, f.state);
    assert.equal(r.valid, true, r.errors.join('; ')); assert.equal(r.mayApply, false); assert.equal(r.operationalAuthority, false);
    assert.deepEqual(r.proposedLedgerBytes, f.proposedLedgerBytes);
  });
  for (const [name, change] of [
    ['missing pin', (f: any) => { f.source.pinnedAnchorSha256 = ''; }],
    ['production root source', (f: any) => { f.source.kind = 'PRODUCTION'; }],
    ['shared physical person', (f: any) => { f.context.registrationPeople[1].personId = f.context.registrationPeople[0].personId; f.bind(); }],
    ['AGENT signature', (f: any) => { f.receipt.signatures[0].kind = 'AGENT'; f.request.receiptBytes = Buffer.from(canonicalGovernanceJson(f.receipt)); }],
    ['revoked signer', (f: any) => { f.policy.humanKeys[0].revoked = true; f.bind(); }],
    ['elevated downgrade', (f: any) => { f.document.payload.profileId = 'ELEVATED'; f.bind(); }],
    ['unknown schema', (f: any) => { f.request.schemaVersion = 'SYNTHETIC_REGISTRATION/2'; }],
    ['changed existing WBS bytes', (f: any) => { f.request.afterBytes = Buffer.concat([f.afterBytes, Buffer.from('# unsigned change')]); }],
    ['stale authority epoch', (f: any) => { f.state.authorityEpoch = 2; }],
    ['missing durable predecessor', (f: any) => { f.state.authorityEpoch = 1; }],
    ['revocation rollback', (f: any) => { f.state.revocationSequence = 2; }],
    ['checkpoint rollback', (f: any) => { f.state.checkpointSequence = 2; }],
    ['clock rollback', (f: any) => { f.state.clockSequence = 2; }],
    ['monotonic time rollback', (f: any) => { f.state.lastNowIso = '2026-10-21T12:00:01.000Z'; }],
    ['unconsumed context over consumed state', (f: any) => { f.state.consumedEnvelopeIds.push('already-consumed'); }],
    ['replayed nonce', (f: any) => { f.context.consumedNonces = f.state.consumedNonces = [f.context.sessionNonce]; f.bind(); }],
    ['stale revision', (f: any) => { f.request.expectedRevision = 1; }],
    ['oversized receipt', (f: any) => { f.request.receiptBytes = Buffer.alloc(2 * 1024 * 1024 + 1); }],
    ['receipt duplicate raw keys', (f: any) => { f.request.receiptBytes = Buffer.from(f.request.receiptBytes.toString().replace('"intent":', '"intent":{},"intent":')); }],
  ] as [string, (f: any) => void][]) check('C03 rejects ' + name, () => {
    const f = syntheticCeremony(); change(f); const r = api.verifySyntheticRegistration(f.request, f.source, f.state);
    assert.equal(r.valid, false); assert.equal(r.mayApply, false); assert.equal(r.operationalAuthority, false); assert.ok(r.errors.length);
  });
  for (const [name, change] of [
    ['missing acquisition witness', (a: any) => { a.signatureBase64 = ''; }],
    ['wrong Git base', (a: any) => { a.provenance.protected.commitSha = '0'.repeat(40); }],
    ['signed intent without applied ledger', (a: any) => { a.provenance.applied.ledgerSha256 = a.provenance.protected.ledgerSha256; }],
    ['wrong acquisition request', (a: any) => { a.provenance.requestSha256 = '0'.repeat(64); }],
    ['expired acquisition', (a: any) => { a.provenance.validUntilIso = '2026-10-21T11:59:59.000Z'; }],
    ['acquisition expiry inside clock uncertainty', (a: any) => { a.provenance.validUntilIso = '2026-10-21T12:00:00.001Z'; }],
    ['root substitution', (a: any) => { a.context.root.rootId = 'ROGUE'; }],
  ] as [string, (a: any) => void][]) check('C04 rejects ' + name, () => {
    const f = syntheticCeremony(); const original = f.source.acquire; f.source.acquire = (digest: string) => {
      const a = original(digest); change(a);
      if (name !== 'missing acquisition witness') a.signatureBase64 = f.sign(6, api.acquisitionSigningBytes(a.provenance));
      return a;
    };
    assert.equal(api.verifySyntheticRegistration(f.request, f.source, f.state).valid, false);
  });
  check('C04 noncanonical Base64 for valid acquisition signature rejects', () => {
    const f = syntheticCeremony(); const original = f.source.acquire;
    f.source.acquire = (digest: string) => {
      const a = original(digest), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      a.signatureBase64 = a.signatureBase64.slice(0, 85) + alphabet[alphabet.indexOf(a.signatureBase64[85]) + 1] + '=='; return a;
    };
    assert.equal(api.verifySyntheticRegistration(f.request, f.source, f.state).valid, false);
  });
  check('C04 acquisition-container getters reject without executing', () => {
    const f = syntheticCeremony(); const original = f.source.acquire; let called = false;
    f.source.acquire = (digest: string) => {
      const a = original(digest), policy = a.policy;
      Object.defineProperty(a, 'policy', { enumerable: true, get() { called = true; return policy; } }); return a;
    };
    assert.equal(api.verifySyntheticRegistration(f.request, f.source, f.state).valid, false); assert.equal(called, false);
  });
}
const transactions = await import(new URL('./lib/syntheticWbsTransaction.ts', import.meta.url).href).catch(() => undefined);
async function checkAsync(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); }
}
await checkAsync('C05 durable synthetic transaction entrypoint exists', async () => {
  assert.ok(transactions, 'Durable synthetic transaction entrypoint is not implemented');
});
if (transactions) {
  await checkAsync('C06 atomic WBS+ledger+raw receipts, exact idempotency, restart and replay rejection', async () => {
    const f = syntheticCeremony('ELEVATED'); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      const provenance = store.provenance(); assert.equal(provenance.packageVersion, '13.0.3'); assert.equal(provenance.sqliteVersion, '3.53.4');
      assert.match(provenance.nativeSha256, /^[0-9a-f]{64}$/);
      assert.equal(provenance.journalMode, 'wal'); assert.equal(provenance.synchronous, 2); assert.equal(provenance.busyTimeoutMs, 100);
      assert.equal(provenance.maxPageCount, 16384); assert.equal(provenance.pageSize, 4096);
      const first = store.commit(f.request, f.source); assert.equal(first.status, 'SYNTHETIC_COMMITTED'); assert.equal(first.mayApply, false);
      assert.equal(store.snapshot().revision, 1); assert.deepEqual(store.snapshot().wbsBytes, f.afterBytes);
      assert.deepEqual(store.snapshot().ledgerBytes, f.proposedLedgerBytes); assert.equal(store.evidence().length, 1);
      assert.deepEqual(store.evidence()[0].receiptBytes, f.request.receiptBytes);
      assert.deepEqual(store.evidence()[0].beforeBytes, f.beforeBytes); assert.deepEqual(store.evidence()[0].afterBytes, f.afterBytes);
      assert.equal(store.commit(f.request, f.source).status, 'IDEMPOTENT_RECORDED'); assert.equal(store.snapshot().revision, 1);
      store.restart(); assert.equal(store.snapshot().revision, 1); assert.equal(store.evidence().length, 1);
      assert.throws(() => store.commit({ ...f.request, operationId: 'TESTONLY-DUPLICATE-0002' }, f.source), /CAS|revision|replay|consumed/i);
      assert.throws(() => store.commit({ ...f.request, receiptBytes: Buffer.from('{}') }, f.source), /idempotency/i);
    } finally { store.destroy(); }
  });
  await checkAsync('C07 atomic rollback on injected precommit failure', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      assert.throws(() => store.commit(f.request, f.source, point => { if (point === 'BEFORE_COMMIT') throw Error('injected-stop'); }), /injected-stop/);
      store.restart(); assert.equal(store.snapshot().revision, 0); assert.equal(store.evidence().length, 0);
      assert.equal(store.commit(f.request, f.source).status, 'SYNTHETIC_COMMITTED');
    } finally { store.destroy(); }
  });
  await checkAsync('C07 complete successive policy epochs preserve prior raw evidence and exact multi-entry ledger', async () => {
    const f = syntheticCeremony('ELEVATED'); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      store.commit(f.request, f.source); const retained = store.evidence()[0].receiptBytes;
      f.advance(store.snapshot()); assert.equal(api.verifySyntheticRegistration(f.request, f.source, f.state).valid, true);
      store.commit(f.request, f.source); store.restart();
      assert.equal(store.snapshot().revision, 2); assert.equal(store.evidence().length, 2);
      assert.deepEqual(store.evidence()[0].receiptBytes, retained); assert.deepEqual(store.snapshot().ledgerBytes, f.proposedLedgerBytes);
    } finally { store.destroy(); }
  });
  await checkAsync('C08 stale coordinator cannot win protected CAS after independent commit', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    const second = transactions.SyntheticWbsStore.open(store.fixtureHandle);
    try {
      store.commit(f.request, f.source);
      assert.throws(() => second.commit({ ...f.request, operationId: 'TESTONLY-OTHER-OPERATION' }, f.source), /revision|CAS/i);
      assert.equal(second.snapshot().revision, 1);
    } finally { second.close(); store.destroy(); }
  });
  await checkAsync('C08 two actual coordinator processes race: one commits, other bounded rejection', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      const handle = store.fixtureHandle; store.close();
      const requests = [f.request, { ...f.request, operationId: 'TESTONLY-CONCURRENT-OPERATION' }];
      const children = requests.map(request => new Promise<{ status: number | null; output: string }>((resolve, reject) => {
        const a = f.source.acquire(api.syntheticRequestDigest(request));
        const child = spawn(process.execPath, ['--import', './node_modules/tsx/dist/loader.mjs', 'scripts/fixtures/syntheticWbsCrashWorker.ts'], { windowsHide: true });
        let output = ''; const timer = setTimeout(() => { child.kill(); reject(Error('Synthetic race timeout')); }, 20_000);
        child.stdout.on('data', value => { output += value.toString(); }); child.stderr.on('data', value => { output += value.toString(); });
        child.on('error', reject); child.on('exit', status => { clearTimeout(timer); resolve({ status, output }); });
        child.stdin.end(JSON.stringify({ handle, point: 'NO_FAULT', pin: f.pinSha256,
          request: { ...request, beforeBytes: request.beforeBytes.toString('base64'), afterBytes: request.afterBytes.toString('base64'), receiptBytes: request.receiptBytes.toString('base64') },
          acquisition: { ...a, envelopeBytes: a.envelopeBytes.toString('base64') } }));
      }));
      const outcomes = await Promise.all(children); assert.equal(outcomes.filter(r => r.status === 0).length, 1, JSON.stringify(outcomes));
      const denied = outcomes.find(r => r.status !== 0)!; assert.equal(denied.status, 2); assert.match(denied.output, /revision|CAS|locked|busy/i);
      store.restart(); assert.equal(store.snapshot().revision, 1); assert.equal(store.evidence().length, 1);
    } finally { store.destroy(); }
  });
  await checkAsync('C08 final acquisition recheck rejects revocation drift before commit', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      assert.throws(() => store.commit(f.request, f.source, point => {
        if (point === 'BEFORE_COMMIT') { f.policy.humanKeys[0].revoked = true; f.bind(); }
      }), /revoked|rejected|changed/i);
      assert.equal(store.snapshot().revision, 0); assert.equal(store.evidence().length, 0);
    } finally { store.destroy(); }
  });
  await checkAsync('C08 caller Buffer mutation during acquisition cannot change committed input', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    const acquisition = f.source.acquire(api.syntheticRequestDigest(f.request));
    f.source.acquire = () => { f.request.afterBytes.fill(0); return acquisition; };
    try {
      store.commit(f.request, f.source);
      assert.equal(store.snapshot().wbsBytes.toString().includes('DMK-9999'), true);
      assert.equal(store.snapshot().wbsBytes.includes(0), false);
    } finally { store.destroy(); }
  });
  for (const point of ['AFTER_BEGIN', 'AFTER_STATE', 'AFTER_RECEIPT', 'BEFORE_COMMIT', 'AFTER_COMMIT']) await checkAsync('C09 actual process exit ' + point + ' recovers all or nothing', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      const sourceData = f.source.acquire(api.syntheticRequestDigest(f.request)); const handle = store.fixtureHandle; store.close();
      const payload = { handle, point, pin: f.pinSha256, request: { ...f.request, beforeBytes: f.beforeBytes.toString('base64'), afterBytes: f.afterBytes.toString('base64'), receiptBytes: f.request.receiptBytes.toString('base64') },
        acquisition: { ...sourceData, envelopeBytes: sourceData.envelopeBytes.toString('base64') } };
      const child = spawnSync(process.execPath, ['--import', './node_modules/tsx/dist/loader.mjs', 'scripts/fixtures/syntheticWbsCrashWorker.ts'],
        { input: JSON.stringify(payload), encoding: 'utf8', timeout: 20_000, windowsHide: true });
      assert.equal(child.status, 86, child.stdout + child.stderr); store.restart();
      const expected = point === 'AFTER_COMMIT' ? 1 : 0;
      assert.equal(store.snapshot().revision, expected); assert.equal(store.evidence().length, expected);
      assert.equal(store.commit(f.request, f.source).status, expected ? 'IDEMPOTENT_RECORDED' : 'SYNTHETIC_COMMITTED');
    } finally { store.destroy(); }
  });
  await checkAsync('C10 integrity check rejects altered raw evidence without rewriting history', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      store.commit(f.request, f.source); const handle = store.fixtureHandle; store.close();
      const Sqlite = createRequire(import.meta.url)('better-sqlite3'); const db = new Sqlite(path.join(handle.root, 'synthetic-registration.sqlite'));
      db.prepare('UPDATE operations SET receipt=?').run(Buffer.from('{}')); db.close();
      assert.throws(() => store.restart(), /audit|evidence|integrity/i);
    } finally { store.destroy(); }
  });
  await checkAsync('C11 root ownership and arbitrary operator-path rejection', async () => {
    const f = syntheticCeremony(); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    try {
      assert.equal(typeof store.fixtureHandle.dev, 'string'); assert.equal(typeof store.fixtureHandle.ino, 'string');
      assert.match(store.fixtureHandle.ino, /^\d+$/);
      assert.throws(() => transactions.SyntheticWbsStore.open({ ...store.fixtureHandle, root: process.cwd() }), /boundary|root/i);
      assert.throws(() => transactions.SyntheticWbsStore.open({ ...store.fixtureHandle, owner: '0'.repeat(64) }), /ownership/i);
      assert.throws(() => transactions.SyntheticWbsStore.open({ ...store.fixtureHandle, ino: (BigInt(store.fixtureHandle.ino) + 1n).toString() }), /replaced/i);
    } finally { store.destroy(); }
  });
  await checkAsync('C11 actual root substitution after pinning rejects without adopting or deleting replacement', async () => {
    const f = syntheticCeremony(); let original = '', retained = '', replacementIdentity: bigint | undefined;
    let unexpected: any;
    try {
      await assert.rejects(async () => {
        unexpected = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256, (root: string) => {
          original = root; retained = root + '-retained'; fs.renameSync(root, retained); fs.mkdirSync(root);
          fs.writeFileSync(path.join(root, 'attacker-marker'), 'replacement must survive'); replacementIdentity = fs.lstatSync(root, { bigint: true }).ino;
        });
      }, /replaced|identity|boundary/i);
      assert.equal(fs.lstatSync(original, { bigint: true }).ino, replacementIdentity);
      assert.equal(fs.readFileSync(path.join(original, 'attacker-marker'), 'utf8'), 'replacement must survive');
    } finally {
      unexpected?.destroy();
      for (const root of [original, retained]) if (root && fs.existsSync(root)) {
        assert.equal(path.dirname(root), fs.realpathSync.native(os.tmpdir())); assert.equal(fs.realpathSync.native(root), root);
        assert.equal(fs.lstatSync(root).isSymbolicLink(), false); assert.match(path.basename(root), /^dmk-wbs-synthetic-[A-Za-z0-9]+(?:-retained)?$/);
        fs.rmSync(root, { recursive: true });
      }
    }
  });
  await checkAsync('C11 dangling native database symlink rejects before any file is created outside fixture', async () => {
    const f = syntheticCeremony(); const parent = fs.realpathSync.native(os.tmpdir());
    const target = path.join(parent, 'dmk-wbs-escape-' + randomBytes(8).toString('hex') + '.sqlite');
    let linked = false;
    try {
      await assert.rejects(() => transactions.SyntheticWbsStore.create(f.state, f.pinSha256, (root: string) => {
        fs.symlinkSync(target, path.join(root, 'synthetic-registration.sqlite'), 'file'); linked = true;
      }), /replaced|linked|untrusted/i);
      assert.equal(linked, true); assert.equal(fs.existsSync(target), false);
    } finally {
      for (const file of [target, target + '-wal', target + '-shm']) if (fs.existsSync(file)) {
        assert.equal(path.dirname(file), parent); assert.match(path.basename(file), /^dmk-wbs-escape-[0-9a-f]+\.sqlite(?:-wal|-shm)?$/); fs.unlinkSync(file);
      }
    }
  });
  await checkAsync('C11 fixed eight-epoch synthetic transaction measurement preserves all receipts', async () => {
    const f = syntheticCeremony('ELEVATED'); const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
    const samples: number[] = [], cpu = process.cpuUsage(), startMemory = process.memoryUsage();
    try {
      for (let i = 0; i < 8; i++) {
        const start = performance.now(); store.commit(f.request, f.source); samples.push(performance.now() - start);
        if (i < 7) f.advance(store.snapshot());
      }
      const sorted = [...samples].sort((a, b) => a - b), endMemory = process.memoryUsage();
      assert.equal(store.evidence().length, 8); assert.equal(store.snapshot().revision, 8);
      console.log('METRIC ' + JSON.stringify({ profile: 'SYNTHETIC_ELEVATED_8_EPOCHS', platform: process.platform, node: process.versions.node,
        baselineWbsBytes: f.beforeBytes.length, finalWbsBytes: f.afterBytes.length, finalLedgerBytes: f.proposedLedgerBytes.length,
        samplesMs: samples, p50Ms: sorted[3], p95Ms: sorted[7], startMemory, endMemory, cpuMicros: process.cpuUsage(cpu),
        nodeResourceUsage: process.resourceUsage(), productionCapacityClaim: false }));
    } finally { store.destroy(); }
  });
}
const gitApi = await import(new URL('./lib/syntheticWbsGit.ts', import.meta.url).href).catch(() => undefined);
check('C12 authenticated synthetic Git descendant boundary exists', () => assert.ok(gitApi, 'Synthetic Git descendant boundary not implemented'));
if (gitApi) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'dmk-wbs-git-'));
  const git = (...args: string[]) => {
    const r = spawnSync('git', ['-c', 'user.name=TESTONLY', '-c', 'user.email=testonly@invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=', '-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args],
      { cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  try {
    fs.writeFileSync(path.join(root, '.testonly-wbs-git'), 'SYNTHETIC_ONLY\n'); git('init', '--quiet');
    fs.writeFileSync(path.join(root, 'wbs.yaml'), 'synthetic-wbs\n'); fs.writeFileSync(path.join(root, 'ledger.json'), '{"testonly":true}\n');
    git('add', '.'); git('commit', '--quiet', '-m', 'TESTONLY applied state');
    const appliedSha = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(root, 'unrelated.txt'), 'ordinary descendant\n'); git('add', '.'); git('commit', '--quiet', '-m', 'TESTONLY unchanged governance descendant');
    const currentSha = git('rev-parse', 'HEAD');
    const acquisition = gitApi.acquireTestOnlyGitDescendants(root, appliedSha, currentSha);
    const applied = acquisition.nodes[0];
    check('C13 real Git objects permit unchanged applied-to-current first-parent descendant', () => {
      const r = gitApi.verifySyntheticDescendants(applied, acquisition); assert.equal(r.valid, true, r.errors.join('; '));
      assert.equal(r.mayApply, false); assert.equal(r.operationalAuthority, false); assert.equal(r.currentCommitSha, currentSha);
    });
    check('C14 malformed, reordered, incomplete or altered ancestry rejects', () => {
      for (const change of [(a: any) => a.nodes.reverse(), (a: any) => a.nodes.pop(),
        (a: any) => { a.nodes[1].parentShas = []; }, (a: any) => { a.nodes[1].wbsSha256 = '0'.repeat(64); },
        (a: any) => { a.nodes.push(a.nodes[1]); }, (a: any) => { a.kind = 'PRODUCTION'; }]) {
        const a = structuredClone(acquisition); change(a); assert.equal(gitApi.verifySyntheticDescendants(applied, a).valid, false);
      }
    });
    check('C14 Git proof accessor metadata rejects without executing acquisition hooks', () => {
      const a = structuredClone(acquisition); let called = false;
      Object.defineProperty(a.nodes[0], 'commitBase64', { enumerable: true, get() { called = true; return acquisition.nodes[0].commitBase64; } });
      assert.equal(gitApi.verifySyntheticDescendants(applied, a).valid, false); assert.equal(called, false);
    });
    fs.writeFileSync(path.join(root, 'wbs.yaml'), 'unauthorized-change\n'); git('add', '.'); git('commit', '--quiet', '-m', 'TESTONLY unauthorized WBS change');
    check('C15 real descendant changing WBS rejects and immutable applied bytes remain verified', () => {
      const a = gitApi.acquireTestOnlyGitDescendants(root, appliedSha, git('rev-parse', 'HEAD'));
      assert.equal(gitApi.verifySyntheticDescendants(applied, a).valid, false);
      assert.equal(gitApi.verifySyntheticDescendants(applied, acquisition).valid, true);
    });
    check('C16 unrelated current history rejects instead of accepting claimed SHA labels', () => {
      assert.throws(() => gitApi.acquireTestOnlyGitDescendants(root, '0'.repeat(40), currentSha), /ancestor|Git|missing/i);
      assert.throws(() => gitApi.acquireTestOnlyGitDescendants(process.cwd(), appliedSha, currentSha), /fixture|synthetic|boundary/i);
      const marker = path.join(root, '.testonly-wbs-git'), saved = fs.readFileSync(marker), outside = root + '-marker';
      fs.writeFileSync(outside, saved); fs.unlinkSync(marker); fs.symlinkSync(outside, marker, 'file');
      try { assert.throws(() => gitApi.acquireTestOnlyGitDescendants(root, appliedSha, currentSha), /marker|fixture|boundary/i); }
      finally { fs.unlinkSync(marker); fs.writeFileSync(marker, saved); fs.unlinkSync(outside); }
    });
    await checkAsync('C17 actual offline Git ceremony binds reviewed receipt, atomic fixture consumption and later descendants', async () => {
      const f = syntheticCeremony('ELEVATED');
      fs.writeFileSync(path.join(root, 'wbs.yaml'), f.beforeBytes); fs.writeFileSync(path.join(root, 'ledger.json'), f.state.ledgerBytes);
      git('add', '.'); git('commit', '--quiet', '-m', 'TESTONLY historical ceremony baseline');
      const baseline = git('rev-parse', 'HEAD'), baselineTree = git('rev-parse', 'HEAD^{tree}');
      f.state.commitSha = f.git.baseCommitSha = baseline; f.state.treeSha = baselineTree;
      fs.writeFileSync(path.join(root, 'wbs.yaml'), f.afterBytes); git('add', '.'); git('commit', '--quiet', '-m', 'TESTONLY reviewed proposed additions');
      const reviewed = git('rev-parse', 'HEAD'); f.git.reviewedHeadCommitSha = reviewed; f.git.reviewedHeadTreeSha = git('rev-parse', 'HEAD^{tree}'); f.bind();
      fs.writeFileSync(path.join(root, 'ledger.json'), f.proposedLedgerBytes); git('add', '.'); const tree = git('write-tree');
      const appliedCommit = git('commit-tree', tree, '-p', baseline, '-p', reviewed, '-m', 'TESTONLY precreated application object');
      git('reset', '--hard', appliedCommit);
      const original = f.source.acquire;
      f.source.acquire = (digest: string) => {
        const a = original(digest); a.provenance.applied = { ...a.provenance.applied, commitSha: appliedCommit, treeSha: tree, parentShas: [baseline, reviewed] };
        a.signatureBase64 = f.sign(6, api.acquisitionSigningBytes(a.provenance)); return a;
      };
      const store = await transactions.SyntheticWbsStore.create(f.state, f.pinSha256);
      try {
        store.commit(f.request, f.source); assert.equal(store.snapshot().commitSha, appliedCommit);
        fs.writeFileSync(path.join(root, 'after-application.txt'), 'unrelated follow-up\n'); git('add', '.'); git('commit', '--quiet', '-m', 'TESTONLY descendant after governed application');
        const current = git('rev-parse', 'HEAD');
        const source = { kind: 'TESTONLY_GIT_SOURCE/1', acquire: () => gitApi.acquireTestOnlyGitDescendants(root, appliedCommit, current) };
        const verified = gitApi.verifySyntheticCurrentState(store.snapshot(), source); assert.equal(verified.valid, true, verified.errors.join('; '));
        assert.equal(verified.currentCommitSha, current); assert.equal(store.evidence().length, 1);
        assert.equal(gitApi.verifySyntheticCurrentState(store.snapshot(), undefined).valid, false);
      } finally { store.destroy(); }
    });
  } finally {
    assert.equal(path.dirname(root), fs.realpathSync.native(os.tmpdir()));
    assert.equal(fs.realpathSync.native(root), root); assert.match(path.basename(root), /^dmk-wbs-git-/);
    fs.rmSync(root, { recursive: true });
  }
}
console.log(JSON.stringify({ passed, failed }));
process.exitCode = failed ? 1 : 0;
