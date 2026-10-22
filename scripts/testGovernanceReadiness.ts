import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { syntheticCeremony } from './fixtures/syntheticWbsCeremony.ts';

// Ephemeral fixtures exercise report boundaries; no operational ceremony occurs.
const api = await import(new URL('./governanceReadiness.ts', import.meta.url).href).catch(() => undefined);
let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); }
}
check('G01 read-only governance readiness API exists', () => {
  assert.equal(typeof api?.assessGovernanceReadiness, 'function', 'Governance readiness report is not implemented');
});
if (api) {
  const blocked = (r: any) => {
    assert.equal(r.mode, 'BLOCKED'); assert.equal(r.operationalReady, false);
    assert.equal(r.operationalAuthority, false); assert.equal(r.mayApply, false);
    assert.ok(r.blockedReasons.length > 0);
    assert.ok(r.prerequisites.every((p: any) => p.status === 'BLOCKED'));
  };
  check('G02 absent input rejects without granting authority', () => {
    const r = api.assessGovernanceReadiness(undefined); blocked(r); assert.ok(r.inputErrors.length);
  });
  check('G03 verified local historical bytes remain blocked for production', () => {
    const r = api.assessGovernanceReadiness({ workspaceRoot: process.cwd() }); blocked(r);
    assert.equal(r.localContinuity.status, 'VERIFIED_LOCAL_BYTES');
    assert.equal(r.testOnlyRegistration.status, 'NOT_PROVIDED');
  });
  for (const profile of ['ORDINARY', 'ELEVATED']) check('G04 ' + profile + ' full synthetic success remains nonoperational', () => {
    const f = syntheticCeremony(profile);
    const r = api.assessGovernanceReadiness({ workspaceRoot: process.cwd(), testOnlyCandidate: { request: f.request, source: f.source, state: f.state } });
    blocked(r); assert.equal(r.testOnlyRegistration.status, 'VERIFIED_TEST_ONLY', r.testOnlyRegistration.errors.join('; '));
    assert.equal(r.candidateByteBinding.status, 'MATCHED_LOCAL_WBS_BYTES');
  });
  check('G05 caller verdicts and ratification flags are rejected without acquisition', () => {
    let acquired = false; const f = syntheticCeremony();
    f.source.acquire = () => { acquired = true; throw new Error('must not acquire'); };
    for (const claim of ['operationalReady', 'ratified', 'authorityDecisions', 'verifierResults', 'productionAdapter']) {
      const r = api.assessGovernanceReadiness({ workspaceRoot: process.cwd(), testOnlyCandidate: { request: f.request, source: f.source, state: f.state }, [claim]: true });
      blocked(r); assert.ok(r.inputErrors.length); assert.equal(acquired, false);
    }
  });
  const evaluate = (f: any) => api.assessGovernanceReadiness({ workspaceRoot: process.cwd(), testOnlyCandidate: { request: f.request, source: f.source, state: f.state } });
  for (const [name, mutate] of [
    ['unsigned WBS byte append', (f: any) => { f.request.afterBytes = Buffer.concat([f.request.afterBytes, Buffer.from('# unapproved\n')]); }],
    ['raw receipt duplicate key', (f: any) => { f.request.receiptBytes = Buffer.from(f.request.receiptBytes.toString().replace('"intent":', '"intent":{},"intent":')); }],
    ['raw receipt trailing newline', (f: any) => { f.request.receiptBytes = Buffer.concat([f.request.receiptBytes, Buffer.from('\n')]); }],
    ['two keys for one physical person', (f: any) => { f.context.registrationPeople[1].personId = f.context.registrationPeople[0].personId; f.bind(); }],
    ['revoked signer', (f: any) => { f.policy.humanKeys[0].revoked = true; f.bind(); }],
    ['elevated profile downgrade', (f: any) => { f.document.payload.profileId = 'ELEVATED'; f.bind(); }],
    ['authority epoch rollback', (f: any) => { f.state.authorityEpoch = 2; }],
    ['revocation sequence rollback', (f: any) => { f.state.revocationSequence = 2; }],
    ['clock sequence rollback', (f: any) => { f.state.clockSequence = 2; }],
    ['stale receipt replay state', (f: any) => { f.state.consumedNonces = [f.context.sessionNonce]; f.context.consumedNonces = f.state.consumedNonces; f.bind(); }],
    ['old wall-clock observation', (f: any) => { f.state.lastNowIso = '2026-10-21T12:00:01.000Z'; }],
    ['oversized raw receipt', (f: any) => { f.request.receiptBytes = Buffer.alloc(2 * 1024 * 1024 + 1); }],
  ] as [string, (f: any) => void][]) check('G06 rejects ' + name + ' through existing verifiers', () => {
    const f = syntheticCeremony(); mutate(f); const r = evaluate(f); blocked(r);
    assert.equal(r.testOnlyRegistration.status, 'REJECTED'); assert.equal(r.candidateByteBinding.status, 'REJECTED');
  });
  check('G07 authenticated synthetic provenance is still required; signed intent alone rejects', () => {
    const f = syntheticCeremony(), acquire = f.source.acquire;
    f.source.acquire = (digest: string) => { const a = acquire(digest); a.provenance.applied.ledgerSha256 = a.provenance.protected.ledgerSha256; return a; };
    const r = evaluate(f); blocked(r); assert.equal(r.testOnlyRegistration.status, 'REJECTED');
  });
  check('G08 production source labels cannot promote a fixture or execute acquisition', () => {
    let acquired = false; const f = syntheticCeremony(); f.source.kind = 'PRODUCTION';
    f.source.acquire = () => { acquired = true; throw new Error('must not acquire'); };
    const r = evaluate(f); blocked(r); assert.ok(r.inputErrors.length); assert.equal(acquired, false);
  });
  check('G09 getters and hidden/symbol claims reject without executing accessors', () => {
    let executed = false;
    const accessor = Object.defineProperty({}, 'workspaceRoot', { enumerable: true, get() { executed = true; return process.cwd(); } });
    const hidden = Object.defineProperty({ workspaceRoot: process.cwd() }, 'ratified', { value: true });
    const symbol = { workspaceRoot: process.cwd(), [Symbol('approved')]: true };
    for (const input of [accessor, hidden, symbol]) { const r = api.assessGovernanceReadiness(input); blocked(r); assert.ok(r.inputErrors.length); }
    assert.equal(executed, false);
    const f = syntheticCeremony();
    f.state.lastEnvelope = Object.defineProperty({}, 'authorityEpoch', { enumerable: true, get() { executed = true; return 1; } });
    const r = evaluate(f); blocked(r); assert.ok(r.inputErrors.length); assert.equal(executed, false);
  });
  check('G10 missing or altered local continuity never falls back to fixture success', () => {
    const parent = fs.realpathSync.native(os.tmpdir()), temp = fs.mkdtempSync(path.join(parent, 'dmk-governance-report-'));
    try {
      const f = syntheticCeremony();
      const input = { workspaceRoot: temp, testOnlyCandidate: { request: f.request, source: f.source, state: f.state } };
      let r = api.assessGovernanceReadiness(input); blocked(r);
      assert.equal(r.localContinuity.status, 'REJECTED'); assert.equal(r.candidateByteBinding.status, 'REJECTED');
      fs.mkdirSync(path.join(temp, 'docs/07_verification/historical-wbs'), { recursive: true });
      fs.mkdirSync(path.join(temp, 'docs/00_control'), { recursive: true });
      fs.writeFileSync(path.join(temp, 'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml'), f.beforeBytes);
      fs.writeFileSync(path.join(temp, 'docs/00_control/MASTER_WBS.yaml'), f.afterBytes);
      r = api.assessGovernanceReadiness(input); blocked(r);
      assert.equal(r.testOnlyRegistration.status, 'VERIFIED_TEST_ONLY'); assert.equal(r.localContinuity.status, 'REJECTED');
      assert.equal(r.candidateByteBinding.status, 'REJECTED');
    } finally {
      assert.equal(path.dirname(path.resolve(temp)), parent); fs.rmSync(temp, { recursive: true });
    }
  });
  check('G11 repeat reports preserve exact canonical/historical bytes and consumption state', () => {
    const files = ['docs/00_control/MASTER_WBS.yaml', 'docs/00_control/MASTER_WBS.md',
      'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml'];
    const before = files.map(file => fs.readFileSync(file)), f = syntheticCeremony();
    const state = JSON.stringify(f.state), receipt = Buffer.from(f.request.receiptBytes);
    const first = evaluate(f), second = evaluate(f); blocked(first); blocked(second); assert.deepEqual(first, second);
    files.forEach((file, i) => assert.deepEqual(fs.readFileSync(file), before[i]));
    assert.equal(JSON.stringify(f.state), state); assert.deepEqual(f.request.receiptBytes, receipt);
    assert.deepEqual(f.state.consumedEnvelopeIds, []); assert.deepEqual(f.state.consumedNonces, []);
  });
  check('G12 blocked prerequisites cannot be cleared by mutating an earlier report', () => {
    const first = api.assessGovernanceReadiness({ workspaceRoot: process.cwd() }); first.prerequisites.splice(0); first.blockedReasons.splice(0);
    const second = api.assessGovernanceReadiness({ workspaceRoot: process.cwd() }); blocked(second); assert.equal(second.prerequisites.length, 10);
  });
  check('G13 CLI reports actual local bytes, exits blocked and accepts no approval override', () => {
    const file = path.join(process.cwd(), 'scripts/governanceReadiness.ts');
    const loader = pathToFileURL(path.join(process.cwd(), 'node_modules/tsx/dist/loader.mjs')).href;
    for (const args of [[], ['--ratified=true']]) {
      const run = spawnSync(process.execPath, ['--import', loader, file, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15_000 });
      assert.equal(run.status, 2, run.stderr); const r = JSON.parse(run.stdout); blocked(r);
      assert.equal(r.inputErrors.length > 0, args.length > 0);
    }
  });
}
console.log(`Governance readiness: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
