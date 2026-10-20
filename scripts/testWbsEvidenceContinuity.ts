import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { verifyDmk196Closure } from './verifyDmk196Closure.ts';
import { verifyDmk196PostMergeCandidate } from './verifyDmk196PostMergeCandidate.ts';
import { verifyDmk197Closure } from './verifyDmk197Closure.ts';
import { verifyDmk208StatusAudit } from './verifyDmk208StatusAudit.ts';
import { makeHistoricalWbsReceiptLedger, previewWbsRegistrationTransaction, serializeWbsReceiptLedger, signedReceiptDigestV2 } from './planWbsRegistrationTransaction.ts';
import { policyDigestV2, registrationSigningPayloadV2 } from './verifyTrustedWbsRegistrationV2.ts';

// A missing feature is an assertion failure in the initial RED run.
const modulePath = './wbsEvidenceContinuity.ts';
const api: any = await import(modulePath).catch((error) => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
assert.equal(typeof api.verifyWbsEvidenceContinuity, 'function', 'historical/current verification boundary is not implemented');
const verify = api.verifyWbsEvidenceContinuity;
const historic = fs.readFileSync('docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml');
const digest = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const clone = <T>(x: T): T => structuredClone(x);
let passed = 0;
function check(name: string, action: () => void) { action(); passed++; console.log('PASS ' + name); }

function fixture(count = 1) {
  const keys = [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const roles = ['Security Officer', 'Lead Architect'];
  const policy: any = { schemaVersion: '2.0', policyId: 'SYNTHETIC-CONTINUITY', policyVersion: '1', requiredRoles: roles,
    humanKeys: keys.map((key, i) => ({ principalId: 'PERSON-' + i, role: roles[i], keyId: 'KEY-' + i, kind: 'HUMAN', revoked: false,
      publicKeyPem: key.publicKey.export({ type: 'spki', format: 'pem' }).toString(), validNotBefore: '2026-01-01T00:00:00.000Z', validNotAfter: '2027-01-01T00:00:00.000Z' })) };
  let before = historic;
  let ledgerBytes = serializeWbsReceiptLedger(makeHistoricalWbsReceiptLedger());
  const links: any[] = [], applications: any[] = [];
  for (let i = 0; i < count; i++) {
    const item = { id: 'DMK-' + (209 + i), wbs_path: '13.06.' + (22 + i), status: 'PROPOSED', epic: 'EPIC-13' };
    const after = Buffer.concat([before, Buffer.from('\n  - id: "' + item.id + '"\n    wbs_path: "' + item.wbs_path + '"\n    status: "PROPOSED"\n    epic: "EPIC-13"\n')]);
    const git = { repository: 'Jeruzael/docmonstakrakin', pullRequestNumber: 100 + i, baseCommitSha: 'a'.repeat(40), reviewedHeadCommitSha: String(i + 1).repeat(40), reviewedHeadTreeSha: 'b'.repeat(40) };
    const intent: any = { schemaVersion: '2.0', projectId: 'PRJ-DOCMONSTAKRAKIN', operation: 'ADD_WBS_ITEMS', receiptId: 'SYNTHETIC-CONTINUITY-000' + i,
      preWbsSha256: digest(before), postWbsSha256: digest(after), approvedItems: [item], policyId: policy.policyId, policyVersion: policy.policyVersion,
      policySha256: policyDigestV2(policy), notBefore: '2026-10-01T00:00:00.000Z', notAfter: '2026-11-01T00:00:00.000Z', git };
    const receipt = { intent, signatures: keys.map((key, n) => ({ principalId: 'PERSON-' + n, role: roles[n], keyId: 'KEY-' + n, kind: 'HUMAN' as const,
      signatureBase64: crypto.sign(null, registrationSigningPayloadV2(intent), key.privateKey).toString('base64') })) };
    const rawReceiptBytes = Buffer.from(JSON.stringify(receipt));
    const prefix = ledgerBytes;
    const consumed = JSON.parse(prefix.toString()).entries.map((e: any) => e.receiptId);
    const preview = previewWbsRegistrationTransaction({ beforeBytes: before, afterBytes: after, ledgerBytes: prefix, receipt, policy,
      expectedCurrentWbsSha256: digest(before), expectedCurrentLedgerSha256: digest(prefix),
      trustedContext: { pinnedPolicySha256: policyDigestV2(policy), expectedGit: git, nowIso: '2026-10-20T00:00:00.000Z', consumedReceiptIds: consumed } });
    assert.equal(preview.valid, true, preview.errors.join('; '));
    ledgerBytes = preview.proposedLedgerBytes!;
    links.push({ beforeBytes: before, afterBytes: after, receipt, rawReceiptBytes, policy });
    applications.push({ receiptId: intent.receiptId, preWbsSha256: digest(before), postWbsSha256: digest(after),
      ledgerBeforeSha256: digest(prefix), ledgerAfterSha256: digest(ledgerBytes), rawReceiptSha256: digest(rawReceiptBytes),
      policySha256: policyDigestV2(policy), policyEpoch: 1, revocationSequence: 1,
      appliedAt: '2026-10-20T00:00:00.000Z', appliedCommitSha: String(i + 3).repeat(40), appliedTreeSha: String(i + 5).repeat(40), expectedGit: git });
    before = after;
  }
  const last = applications.at(-1);
  const context: any = { nowIso: '2026-12-01T00:00:00.000Z', validUntilIso: '2026-12-01T00:01:00.000Z', authorityEpoch: 1, minimumAuthorityEpoch: 1,
    revocationSequence: 1, minimumRevocationSequence: 1,
    protected: { wbsSha256: digest(before), ledgerSha256: digest(ledgerBytes), masterCommitSha: last.appliedCommitSha, masterTreeSha: last.appliedTreeSha }, applications };
  const input = { historicalBytes: historic, currentBytes: before, forward: { ledgerBytes, links } };
  return { input, context, authority: () => context, keys };
}

check('unchanged pinned baseline is non-applying and both gates pass', () => {
  const r = verify({ historicalBytes: historic, currentBytes: historic });
  assert.equal(r.valid, true); assert.equal(r.historicalValid, true); assert.equal(r.currentForwardChainValid, true); assert.equal(r.mayApply, false);
  assert.equal(r.mode, 'HISTORICAL'); assert.equal(r.historicalScopeCount, 27); assert.equal(r.currentScopeCount, 27);
  assert.equal(r.historicalWbsSha256, digest(historic)); assert.equal(r.currentWbsSha256, digest(historic));
});
check('historical byte tamper fails even when current bytes match', () => assert.equal(verify({ historicalBytes: Buffer.concat([historic, Buffer.from(' ')]), currentBytes: historic }).valid, false));
check('an unsigned successor cannot borrow historical validity', () => {
  const f = fixture(); const r = verify(f.input);
  assert.equal(r.historicalValid, true); assert.equal(r.currentForwardChainValid, false); assert.equal(r.valid, false);
});
check('a permissive mode or JSON authority flag cannot grant trust', () => {
  const f = fixture(); assert.equal(verify({ ...f.input, mode: 'HISTORICAL', approved: true }, { approved: true }).valid, false);
});
check('signed preview and proposed ledger without actual application evidence reject', () => {
  const f = fixture(); f.context.applications = []; assert.equal(verify(f.input, f.authority).valid, false);
});
check('one applied synthetic chain verifies without mutation authority', () => {
  const f = fixture(); const r = verify(f.input, f.authority);
  assert.equal(r.valid, true, r.errors.join('; ')); assert.equal(r.mode, 'FORWARD_EVIDENCE_VERIFIED'); assert.equal(r.historicalScopeCount, 27); assert.equal(r.currentScopeCount, 28); assert.equal(r.mayApply, false);
  assert.equal(r.ledgerSha256, digest(f.input.forward.ledgerBytes));
});
check('multiple applied links preserve historical scope and add exact current items', () => {
  const f = fixture(2); const r = verify(f.input, f.authority); assert.equal(r.valid, true, r.errors.join('; ')); assert.equal(r.currentScopeCount, 29); assert.equal(r.historicalScopeCount, 27);
});
const attacks: [string, (f: ReturnType<typeof fixture>) => void][] = [
  ['missing link', f => { f.input.forward.links = []; }],
  ['reordered links', f => { f.input.forward.links.reverse(); }],
  ['duplicate link', f => { f.input.forward.links[1] = f.input.forward.links[0]; }],
  ['unsigned receipt', f => { f.input.forward.links[0].receipt.signatures = []; }],
  ['altered approved item set', f => { f.input.forward.links[0].receipt.intent.approvedItems = []; }],
  ['altered post bytes', f => { f.input.forward.links[0].afterBytes = Buffer.concat([f.input.forward.links[0].afterBytes, Buffer.from(' ')]); }],
  ['wrong reviewed HEAD', f => { f.context.applications[0].expectedGit = { ...f.context.applications[0].expectedGit, reviewedHeadCommitSha: 'f'.repeat(40) }; }],
  ['wrong reviewed tree', f => { f.context.applications[0].expectedGit = { ...f.context.applications[0].expectedGit, reviewedHeadTreeSha: 'f'.repeat(40) }; }],
  ['wrong repository', f => { f.context.applications[0].expectedGit = { ...f.context.applications[0].expectedGit, repository: 'other/repo' }; }],
  ['untrusted policy pin', f => { f.context.applications[0].policySha256 = 'f'.repeat(64); }],
  ['revoked signer', f => { f.input.forward.links[0].policy = clone(f.input.forward.links[0].policy); f.input.forward.links[0].policy.humanKeys[0].revoked = true; }],
  ['invalid signature', f => { f.input.forward.links[0].receipt.signatures[0].signatureBase64 = Buffer.alloc(64).toString('base64'); }],
  ['same human reused', f => { f.input.forward.links[0].receipt.signatures[1].principalId = 'PERSON-0'; }],
  ['agent signer', f => { f.input.forward.links[0].receipt.signatures[0].kind = 'AGENT'; }],
  ['stale authority epoch', f => { f.context.minimumAuthorityEpoch = 2; }],
  ['stale revocation checkpoint', f => { f.context.minimumRevocationSequence = 2; }],
  ['application lacks current revocation adjudication', f => { f.context.revocationSequence = 2; }],
  ['expired context', f => { f.context.validUntilIso = '2026-11-01T00:00:00.000Z'; }],
  ['unadjudicated revocation', f => { delete f.context.applications[0].revocationSequence; }],
  ['application outside signed window', f => { f.context.applications[0].appliedAt = '2026-12-01T00:00:00.000Z'; }],
  ['forged raw retained receipt', f => { f.input.forward.links[0].rawReceiptBytes = Buffer.from('{}'); }],
  ['wrong applied ledger prefix', f => { f.context.applications[0].ledgerBeforeSha256 = 'f'.repeat(64); }],
  ['wrong resulting master', f => { f.context.protected.masterCommitSha = 'f'.repeat(40); }],
  ['wrong terminal ledger digest', f => { f.context.protected.ledgerSha256 = 'f'.repeat(64); }],
  ['future policy epoch', f => { f.context.applications[0].policyEpoch = 2; }],
  ['epoch advanced without changed signed policy', f => { f.context.authorityEpoch = 2; f.context.applications[1].policyEpoch = 2; }],
  ['noncanonical ledger', f => { f.input.forward.ledgerBytes = Buffer.concat([f.input.forward.ledgerBytes, Buffer.from(' ')]); }],
];
for (const [name, attack] of attacks) check(name + ' rejects current state while retaining historical validity', () => {
  const f = fixture(2); attack(f); const r = verify(f.input, f.authority);
  assert.equal(r.historicalValid, true); assert.equal(r.currentForwardChainValid, false, name); assert.equal(r.valid, false); assert.equal(r.mayApply, false);
});
check('repeated audit is idempotent and cannot consume or rewrite evidence', () => {
  const f = fixture(); const before = Buffer.from(f.input.forward.ledgerBytes); const current = Buffer.from(f.input.currentBytes);
  assert.equal(verify(f.input, f.authority).valid, true); assert.equal(verify(f.input, f.authority).valid, true);
  assert.deepEqual(f.input.forward.ledgerBytes, before); assert.deepEqual(f.input.currentBytes, current);
});
check('authority acquisition failure rejects without fallback', () => { const f = fixture(); assert.equal(verify(f.input, () => { throw Error('offline'); }).valid, false); });
check('malformed input rejects rather than throwing or applying', () => { for (const input of [null, {}, { historicalBytes: historic, currentBytes: null }]) assert.equal(verify(input).valid, false); });
// Bind forbidden semantics with valid synthetic signatures and authenticated pins.
function rebind(f: ReturnType<typeof fixture>) {
  const link = f.input.forward.links[0], app = f.context.applications[0];
  const intent = link.receipt.intent;
  intent.postWbsSha256 = digest(link.afterBytes);
  link.receipt.signatures.forEach((s: any, i: number) => { s.signatureBase64 = crypto.sign(null, registrationSigningPayloadV2(intent), f.keys[i].privateKey).toString('base64'); });
  link.rawReceiptBytes = Buffer.from(JSON.stringify(link.receipt));
  const entry = JSON.parse(f.input.forward.ledgerBytes.toString()).entries[0];
  entry.postWbsSha256 = intent.postWbsSha256;
  entry.signedIntentSha256 = digest(registrationSigningPayloadV2(intent));
  entry.signedReceiptSha256 = signedReceiptDigestV2(link.receipt);
  f.input.forward.ledgerBytes = serializeWbsReceiptLedger({ ...makeHistoricalWbsReceiptLedger(), entries: [entry] });
  Object.assign(app, { postWbsSha256: intent.postWbsSha256, ledgerAfterSha256: digest(f.input.forward.ledgerBytes), rawReceiptSha256: digest(link.rawReceiptBytes) });
  f.input.currentBytes = link.afterBytes;
  Object.assign(f.context.protected, { wbsSha256: digest(link.afterBytes), ledgerSha256: digest(f.input.forward.ledgerBytes) });
}
for (const [name, change] of [
  ['existing status', (s: string) => s.replace('status: "VERIFIED"', 'status: "BACKLOG"')],
  ['existing dependencies', (s: string) => s.replace('dependencies: []', 'dependencies: ["DMK-209"]')],
  ['existing metadata', (s: string) => s.replace('title:', 'unauthorized_field: true\n    title:')],
  ['root metadata', (s: string) => s.replace('version:', 'injected_root: true\nversion:')],
] as const) check('authentically signed ' + name + ' mutation still rejects', () => {
  const f = fixture(); const old = f.input.forward.links[0].afterBytes.toString();
  const changed = change(old); assert.notEqual(changed, old);
  f.input.forward.links[0].afterBytes = Buffer.from(changed); rebind(f);
  assert.equal(verify(f.input, f.authority).valid, false);
});
check('signed approved dependency set must exactly match added definitions', () => {
  const f = fixture(); f.input.forward.links[0].receipt.intent.approvedItems[0].dependencies = ['DMK-210']; rebind(f);
  assert.equal(verify(f.input, f.authority).valid, false);
});
check('duplicate retained JSON keys reject even with authenticated raw digest', () => {
  const f = fixture(); const link = f.input.forward.links[0];
  link.rawReceiptBytes = Buffer.from(link.rawReceiptBytes.toString().replace('"intent":', '"intent":{},"intent":'));
  f.context.applications[0].rawReceiptSha256 = digest(link.rawReceiptBytes);
  assert.equal(verify(f.input, f.authority).valid, false);
});
check('duplicate consumed receipt rejects even when terminal ledger is pinned', () => {
  const f = fixture(2); const ledger = JSON.parse(f.input.forward.ledgerBytes.toString());
  ledger.entries[1].receiptId = ledger.entries[0].receiptId;
  f.input.forward.ledgerBytes = serializeWbsReceiptLedger(ledger); f.context.protected.ledgerSha256 = digest(f.input.forward.ledgerBytes);
  assert.equal(verify(f.input, f.authority).valid, false);
});
check('all legacy adapters accept an applied synthetic successor while retaining historical checks', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wbs-applied-adapters-'));
  try {
    for (const name of ['docs', 'src', 'server', 'scripts', 'server.ts']) fs.cpSync(name, path.join(temp, name), { recursive: true });
    const f = fixture(2); fs.writeFileSync(path.join(temp, 'docs/00_control/MASTER_WBS.yaml'), f.input.currentBytes);
    const acquire = () => ({ forward: f.input.forward, context: f.context });
    const audit = verifyDmk208StatusAudit(temp, undefined, undefined, undefined, acquire);
    const results = [verifyDmk196Closure({workspaceRoot: temp}, acquire), verifyDmk196PostMergeCandidate({workspaceRoot: temp}, acquire), verifyDmk197Closure({workspaceRoot: temp}, acquire), audit];
    for (const r of results) { assert.equal(r.valid, true, JSON.stringify(r)); assert.equal(r.historicalValid, true); assert.equal(r.currentForwardChainValid, true); assert.equal(r.mayApply, false); }
    assert.equal(audit.summary.total, 27); assert.equal(audit.continuity.currentScopeCount, 29);
    const failedAcquisition = verifyDmk196Closure({workspaceRoot: temp}, () => { throw Error('offline'); });
    assert.equal(failedAcquisition.valid, false); assert.equal(failedAcquisition.historicalValid, true); assert.equal(failedAcquisition.currentForwardChainValid, false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
check('missing immutable historical Git objects reject without fallback', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'wbs-empty-objects-'));
  const saved = { directory: process.env.GIT_OBJECT_DIRECTORY, alternates: process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES };
  try {
    process.env.GIT_OBJECT_DIRECTORY = empty; delete process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
    assert.throws(() => api.resolveEarlierDmk208View('PRE_APPLY'), /Pinned earlier historical Git bytes unavailable/);
  } finally {
    if (saved.directory === undefined) delete process.env.GIT_OBJECT_DIRECTORY; else process.env.GIT_OBJECT_DIRECTORY = saved.directory;
    if (saved.alternates === undefined) delete process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES; else process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES = saved.alternates;
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
console.log(`TOTAL ${passed}/${passed} continuity checks passed`);
