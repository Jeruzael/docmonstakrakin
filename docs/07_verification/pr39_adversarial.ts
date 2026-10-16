/**
 * PR #39 independent adversarial harness (disposable, reproducible evidence).
 * Run from repository root:
 *   npx tsx docs/07_verification/pr39_adversarial.ts
 *
 * Uses disposable in-memory synthetic Ed25519 keys and repository-relative imports.
 * Writes nothing to disk; asserts observed behavior of the reviewed implementation.
 *
 * Output tags:
 *   [DEFENSE PASS]          expected fail-closed / correct behavior observed
 *   [LIMITATION CONFIRMED]  known Stage B2b limitation reproduced (expected, not a defect of PR #39)
 *   [FINDING]               observed implementation nuance (behavior documented in report)
 *   [UNEXPECTED]            expectation violated -> exits with code 1
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const ROOT = process.cwd();
  const mod = await import('file:///' + path.join(ROOT, 'scripts/planWbsRegistrationTransaction.ts').replace(/\\/g, '/'));
  const v2 = await import('file:///' + path.join(ROOT, 'scripts/verifyTrustedWbsRegistrationV2.ts').replace(/\\/g, '/'));
  const fwd = await import('file:///' + path.join(ROOT, 'scripts/verifyForwardWbsEvidence.ts').replace(/\\/g, '/'));
  const {
    previewWbsRegistrationTransaction, serializeWbsReceiptLedger, makeHistoricalWbsReceiptLedger,
    validateAndNormalizeSignedReceiptV2, canonicalSignedReceiptPayloadV2, signedReceiptDigestV2,
  } = mod;
  const { policyDigestV2, registrationSigningPayloadV2 } = v2;
  const { HISTORICAL_WBS_SHA256 } = fwd;

  // ---------- Protected files snapshot (D04) ----------
  function hashTree(dir: string, out: Record<string, string>) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.name.startsWith('pr39_adversarial')) continue; // Ignore own script and log
      if (e.isDirectory()) hashTree(p, out);
      else out[path.relative(ROOT, p).replace(/\\/g, '/')] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  }
  const protectedBefore: Record<string, string> = {};
  for (const d of ['docs/00_control', 'docs/07_verification', 'bootstrap']) hashTree(path.join(ROOT, d), protectedBefore);
  const localStatePath = path.join(ROOT, '.local/project-state.json');
  const localStateBefore = fs.existsSync(localStatePath) ? crypto.createHash('sha256').update(fs.readFileSync(localStatePath)).digest('hex') : 'ABSENT';

  // ---------- Fixtures ----------
  const digest = (x: Buffer) => crypto.createHash('sha256').update(x).digest('hex');
  const historic = fs.readFileSync(path.join(ROOT, 'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml'));
  const addItem = (base: Buffer, id: string, p: string) =>
    Buffer.concat([base, Buffer.from(`\n  - id: "${id}"\n    wbs_path: "${p}"\n    status: "PROPOSED"\n`)]);
  const W1 = addItem(historic, 'DMK-209', '13.06.22');
  const W2 = addItem(W1, 'DMK-210', '13.06.23');
  const W2b = addItem(W1, 'DMK-211', '13.06.24');

  const kA = crypto.generateKeyPairSync('ed25519'), kB = crypto.generateKeyPairSync('ed25519');
  const keyRec = (pair: typeof kA, id: string, role: string, keyId: string) => ({
    principalId: id, role, keyId, kind: 'HUMAN' as const, revoked: false,
    publicKeyPem: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    validNotBefore: '2026-01-01T00:00:00.000Z', validNotAfter: '2027-01-01T00:00:00.000Z',
  });
  const policy = {
    schemaVersion: '2.0' as const, policyId: 'SYNTHETIC-PR39-REVIEW', policyVersion: '2.0',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    humanKeys: [keyRec(kA, 'A', 'Security Officer', 'K-A'), keyRec(kB, 'B', 'Lead Architect', 'K-B')],
  };
  const pin = policyDigestV2(policy);
  const gitFor = (pr: number, c: string) => ({
    repository: 'Jeruzael/docmonstakrakin', pullRequestNumber: pr,
    baseCommitSha: 'a'.repeat(40), reviewedHeadCommitSha: c.repeat(40), reviewedHeadTreeSha: 'c'.repeat(40),
  });
  function makeIntent(receiptId: string, pre: Buffer, post: Buffer, items: any[], git: any) {
    return {
      schemaVersion: '2.0' as const, projectId: 'PRJ-DOCMONSTAKRAKIN' as const, operation: 'ADD_WBS_ITEMS' as const,
      receiptId, preWbsSha256: digest(pre), postWbsSha256: digest(post), approvedItems: items,
      policyId: policy.policyId, policyVersion: policy.policyVersion, policySha256: pin,
      notBefore: '2026-10-01T00:00:00.000Z', notAfter: '2026-11-01T00:00:00.000Z', git,
    };
  }
  function signAll(intent: any, pairs: Array<[typeof kA, string, string, string]> = [[kA, 'A', 'Security Officer', 'K-A'], [kB, 'B', 'Lead Architect', 'K-B']]) {
    return {
      intent,
      signatures: pairs.map(([pair, principalId, role, keyId]) => ({
        principalId, role, keyId, kind: 'HUMAN' as const,
        signatureBase64: crypto.sign(null, registrationSigningPayloadV2(intent), pair.privateKey).toString('base64'),
      })),
    };
  }
  const git1 = gitFor(34, 'b'), git2 = gitFor(39, 'd');
  const I1 = makeIntent('WBS-PR39-REVIEW-0001', historic, W1, [{ id: 'DMK-209', wbs_path: '13.06.22', status: 'PROPOSED' }], git1);
  const R1 = signAll(I1);
  const I2 = makeIntent('WBS-PR39-REVIEW-0002', W1, W2, [{ id: 'DMK-210', wbs_path: '13.06.23', status: 'PROPOSED' }], git2);
  const R2 = signAll(I2);
  const L0 = serializeWbsReceiptLedger(makeHistoricalWbsReceiptLedger());
  const ctx = (git: any, consumed: string[], now = '2026-10-16T00:00:00.000Z') =>
    ({ pinnedPolicySha256: pin, expectedGit: git, nowIso: now, consumedReceiptIds: consumed });

  const allResults: any[] = [];
  function run(input: any) {
    let r: any;
    try { r = previewWbsRegistrationTransaction(input); }
    catch (e) { throw new Error('UNHANDLED EXCEPTION ESCAPED PREFLIGHT: ' + (e as Error).message); }
    allResults.push(r);
    return r;
  }
  const base1 = () => ({
    beforeBytes: historic, afterBytes: W1, ledgerBytes: L0,
    expectedCurrentWbsSha256: digest(historic), expectedCurrentLedgerSha256: digest(L0),
    receipt: R1, policy, trustedContext: ctx(git1, []),
  });

  let failures = 0; const tally: Record<string, number> = {};
  function rec(tag: string, id: string, msg: string, evidence?: unknown) {
    tally[tag] = (tally[tag] || 0) + 1;
    console.log(`[${tag}] ${id}: ${msg}` + (evidence !== undefined ? `\n      evidence: ${typeof evidence === 'string' ? evidence : JSON.stringify(evidence)}` : ''));
  }
  function scenario(id: string, tag: 'DEFENSE PASS' | 'LIMITATION CONFIRMED' | 'FINDING', msg: string, fn: () => unknown) {
    try { const ev = fn(); rec(tag, id, msg, ev); }
    catch (e) { failures++; rec('UNEXPECTED', id, msg + ' -> ' + (e as Error).message); }
  }
  const rejectedWith = (r: any, needle: string) => {
    assert.equal(r.valid, false); assert.equal(r.mode, 'REJECTED'); assert.equal(r.mayApply, false);
    assert.ok(r.errors.some((e: string) => e.includes(needle)), 'missing reason "' + needle + '" in ' + JSON.stringify(r.errors));
    return r.errors;
  };

  console.log('=== PR #39 INDEPENDENT ADVERSARIAL HARNESS ===');
  console.log('execution root: .');

  // ===================== A. Canonical receipt hashing =====================
  scenario('A01', 'DEFENSE PASS', 'Baseline synthetic receipt previews valid with mayApply:false', () => {
    const r = run(base1()); assert.equal(r.valid, true); assert.equal(r.mayApply, false); return r.proposedLedgerSha256;
  });
  scenario('A02', 'DEFENSE PASS', 'TOCTOU getter: receiptId valid on early reads, flips to number later -> REJECTED by re-validation', () => {
    let n = 0; const intent: any = { ...I1 };
    Object.defineProperty(intent, 'receiptId', { enumerable: true, get() { n++; return n <= 2 ? I1.receiptId : 12345; } });
    const r = run({ ...base1(), receipt: { intent, signatures: R1.signatures } });
    return { reads: n, errors: rejectedWith(r, 'Signed receipt schema or canonical serialization invalid') };
  });
  scenario('A03', 'DEFENSE PASS', 'TOCTOU getter on signatureBase64 (valid -> different valid-format bytes) -> REJECTED', () => {
    let n = 0; const s0: any = { ...R1.signatures[0] }; const other = Buffer.alloc(64, 7).toString('base64');
    Object.defineProperty(s0, 'signatureBase64', { enumerable: true, get() { n++; return n <= 3 ? R1.signatures[0].signatureBase64 : other; } });
    const r = run({ ...base1(), receipt: { intent: I1, signatures: [s0, R1.signatures[1]] } });
    return { reads: n, errors: rejectedWith(r, 'Signature base64 is not canonical 64-byte encoding') };
  });
  scenario('A04', 'FINDING', 'Array hole + extra named property passes FIRST-PASS length guard in validateAndNormalizeSignedReceiptV2 (caught only by second validation)', () => {
    const sigs: any = [R1.signatures[0], , R1.signatures[1]];
    sigs.extra = 'x';
    assert.equal(Object.keys(sigs).length, sigs.length);
    let firstPassThrew = false, firstPassMsg = '';
    let normalized: any;
    try { normalized = validateAndNormalizeSignedReceiptV2({ intent: I1, signatures: sigs }); } catch (e) { firstPassThrew = true; firstPassMsg = (e as Error).message; }
    const r = run({ ...base1(), receipt: { intent: I1, signatures: sigs } });
    const errs = rejectedWith(r, 'Signed receipt schema or canonical serialization invalid');
    return { firstPassThrew, firstPassMsg, normalizedSignatureLength: normalized?.signatures?.length, normalizedHasHole: normalized ? !(1 in normalized.signatures) || normalized.signatures.includes(undefined) : null, previewErrors: errs };
  });
  scenario('A05', 'FINDING', 'Same hole + extra-property bypass for approvedItems first-pass guard (caught downstream)', () => {
    const items: any = [{ id: 'DMK-209', wbs_path: '13.06.22', status: 'PROPOSED' }, , ];
    items.length = 2; items.extra = 1;
    assert.equal(Object.keys(items).length, items.length);
    let firstPassThrew = false, msg = '';
    try { validateAndNormalizeSignedReceiptV2({ intent: { ...I1, approvedItems: items }, signatures: R1.signatures }); } catch (e) { firstPassThrew = true; msg = (e as Error).message; }
    const r = run({ ...base1(), receipt: { intent: { ...I1, approvedItems: items }, signatures: R1.signatures } });
    return { firstPassThrew, msg, errors: rejectedWith(r, 'Signed receipt schema or canonical serialization invalid') };
  });
  scenario('A06', 'DEFENSE PASS', 'Proxy with throwing ownKeys trap -> REJECTED, no exception escapes', () => {
    const p = new Proxy({ ...R1 }, { ownKeys() { throw new Error('hostile ownKeys'); } });
    return rejectedWith(run({ ...base1(), receipt: p }), 'hostile ownKeys');
  });
  scenario('A07', 'DEFENSE PASS', 'Deeply nested (20,000) value inside approvedItems -> REJECTED (stack overflow contained)', () => {
    let deep: any = 'x'; for (let i = 0; i < 20000; i++) deep = { d: deep };
    const r = run({ ...base1(), receipt: { intent: { ...I1, approvedItems: [{ id: 'DMK-209', wbs_path: '13.06.22', status: 'PROPOSED', deep }] }, signatures: R1.signatures } });
    assert.equal(r.valid, false); assert.equal(r.mayApply, false); return r.errors.map((e: string) => e.slice(0, 120));
  });
  scenario('A08', 'DEFENSE PASS', 'Symbol-keyed property on intent -> REJECTED', () => {
    const intent: any = { ...I1, [Symbol('x')]: 1 };
    return rejectedWith(run({ ...base1(), receipt: { intent, signatures: R1.signatures } }), 'unexpected properties');
  });
  scenario('A09', 'DEFENSE PASS', 'Null-prototype but data-equivalent receipt hashes identically to plain receipt', () => {
    const np: any = Object.assign(Object.create(null), { intent: Object.assign(Object.create(null), I1, { git: Object.assign(Object.create(null), git1) }), signatures: R1.signatures });
    assert.equal(signedReceiptDigestV2(np), signedReceiptDigestV2(R1)); return signedReceiptDigestV2(R1);
  });
  scenario('A10', 'FINDING', 'Non-enumerable extra property on intent is silently ignored (not rejected, not hashed)', () => {
    const intent: any = { ...I1 }; Object.defineProperty(intent, 'hidden', { value: 'bypass', enumerable: false });
    const r = run({ ...base1(), receipt: { intent, signatures: R1.signatures } });
    assert.equal(r.valid, true);
    assert.equal(signedReceiptDigestV2({ intent, signatures: R1.signatures }), signedReceiptDigestV2(R1));
    return 'accepted; digest identical (property invisible to Object.keys)';
  });
  scenario('A11', 'FINDING', 'Numeric -0 and 0 canonicalize identically; NFC vs NFD strings hash differently (informational)', () => {
    const a = canonicalSignedReceiptPayloadV2({ intent: { ...I1, approvedItems: [{ id: 'DMK-209', n: -0 }] }, signatures: R1.signatures });
    const b = canonicalSignedReceiptPayloadV2({ intent: { ...I1, approvedItems: [{ id: 'DMK-209', n: 0 }] }, signatures: R1.signatures });
    const c = canonicalSignedReceiptPayloadV2({ intent: { ...I1, approvedItems: [{ id: 'DMK-209', s: 'caf\u00e9' }] }, signatures: R1.signatures });
    const d = canonicalSignedReceiptPayloadV2({ intent: { ...I1, approvedItems: [{ id: 'DMK-209', s: 'cafe\u0301' }] }, signatures: R1.signatures });
    assert.ok(a.equals(b)); assert.ok(!c.equals(d));
    return { negZeroEqualsZero: true, nfcEqualsNfd: false };
  });
  scenario('A12', 'DEFENSE PASS', 'Duplicate signature entry (same signer twice) -> REJECTED', () =>
    rejectedWith(run({ ...base1(), receipt: { intent: I1, signatures: [R1.signatures[0], R1.signatures[0]] } }), 'V2 registration evidence rejected'));
  scenario('A13', 'LIMITATION CONFIRMED', 'Duplicate keys in receipt JSON TEXT are invisible: preflight only sees the parsed object (last-wins)', () => {
    const text = JSON.stringify(R1).replace('"receiptId":"WBS-PR39-REVIEW-0001"', '"receiptId":"SHADOW-VALUE-0000001","receiptId":"WBS-PR39-REVIEW-0001"');
    assert.ok(text.includes('SHADOW-VALUE-0000001'));
    const parsed = JSON.parse(text);
    const r = run({ ...base1(), receipt: parsed });
    assert.equal(r.valid, true);
    return 'ambiguous receipt bytes accepted after JSON.parse; first-wins parsers would read SHADOW-VALUE-0000001';
  });
  scenario('A14', 'DEFENSE PASS', 'BigInt inside caller policy -> REJECTED without exception', () => {
    const r = run({ ...base1(), policy: { ...policy, extra: 1n } });
    assert.equal(r.valid, false); assert.equal(r.mayApply, false); return r.errors;
  });
  scenario('A15', 'DEFENSE PASS', 'Unsupported prototype (class instance) receipt -> REJECTED', () => {
    class R { intent = I1; signatures = R1.signatures; }
    return rejectedWith(run({ ...base1(), receipt: new R() }), 'plain object');
  });
  scenario('A16', 'DEFENSE PASS', 'Array subclass for signatures -> REJECTED', () => {
    class A2 extends Array {}
    const s = A2.from(R1.signatures);
    return rejectedWith(run({ ...base1(), receipt: { intent: I1, signatures: s } }), 'non-empty array');
  });

  // ===================== B. Ledger integrity =====================
  scenario('B01', 'DEFENSE PASS', 'Pretty-printed (2-space) ledger with duplicate key -> REJECTED by byte-exact reserialization', () => {
    const t = L0.toString('utf8').replace('"schemaVersion": "1.0",', '"schemaVersion": "1.0",\n  "schemaVersion": "1.0",');
    const b = Buffer.from(t); return rejectedWith(run({ ...base1(), ledgerBytes: b, expectedCurrentLedgerSha256: digest(b) }), 'exact canonical serialization');
  });
  scenario('B02', 'DEFENSE PASS', 'UTF-8 BOM / CRLF variants of a valid ledger -> REJECTED', () => {
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), L0]);
    const crlf = Buffer.from(L0.toString('utf8').replace(/\n/g, '\r\n'));
    return [rejectedWith(run({ ...base1(), ledgerBytes: bom, expectedCurrentLedgerSha256: digest(bom) }), 'Receipt ledger invalid'),
            rejectedWith(run({ ...base1(), ledgerBytes: crlf, expectedCurrentLedgerSha256: digest(crlf) }), 'Receipt ledger invalid')];
  });
  scenario('B03', 'DEFENSE PASS', '__proto__ key in ledger JSON -> REJECTED and no prototype pollution', () => {
    const t = L0.toString('utf8').replace('{\n', '{\n  "__proto__": {"polluted": true},\n');
    const b = Buffer.from(t); const e = rejectedWith(run({ ...base1(), ledgerBytes: b, expectedCurrentLedgerSha256: digest(b) }), 'Receipt ledger invalid');
    assert.equal(({} as any).polluted, undefined); return e;
  });
  scenario('B04', 'DEFENSE PASS', 'Non-historical genesis digest -> REJECTED', () => {
    const b = serializeWbsReceiptLedger({ ...makeHistoricalWbsReceiptLedger(), genesisWbsSha256: 'f'.repeat(64) });
    return rejectedWith(run({ ...base1(), ledgerBytes: b, expectedCurrentLedgerSha256: digest(b) }), 'historical genesis digest is invalid');
  });
  scenario('B05', 'DEFENSE PASS', 'Ledger entry type confusion (fractional PR number / uppercase hex) -> REJECTED', () => {
    const step1 = run(base1()); const L1 = JSON.parse(step1.proposedLedgerBytes.toString('utf8'));
    const bad1 = Buffer.from(JSON.stringify({ ...L1, entries: [{ ...L1.entries[0], pullRequestNumber: 34.5 }] }, null, 2) + '\n');
    const bad2 = Buffer.from(JSON.stringify({ ...L1, entries: [{ ...L1.entries[0], policySha256: L1.entries[0].policySha256.toUpperCase() }] }, null, 2) + '\n');
    return [bad1, bad2].map(b => rejectedWith(run({ ...base1(), beforeBytes: W1, expectedCurrentWbsSha256: digest(W1), ledgerBytes: b, expectedCurrentLedgerSha256: digest(b), receipt: R2, afterBytes: W2, trustedContext: ctx(git2, ['WBS-PR39-REVIEW-0001']) }), 'invalid, duplicate or disconnected'));
  });
  scenario('B06', 'DEFENSE PASS', 'Oversized ledger (>2 MiB) -> REJECTED before parse', () => {
    const b = Buffer.alloc(2 * 1024 * 1024 + 1, 0x20);
    return rejectedWith(run({ ...base1(), ledgerBytes: b, expectedCurrentLedgerSha256: digest(b) }), 'exceeds supported preflight limit');
  });
  const Wforged = addItem(historic, 'DMK-999', '99.99.99');
  const forgedEntry = {
    receiptId: 'FORGED-HISTORY-0001', preWbsSha256: HISTORICAL_WBS_SHA256, postWbsSha256: digest(Wforged),
    policySha256: crypto.randomBytes(32).toString('hex'), signedIntentSha256: crypto.randomBytes(32).toString('hex'),
    signedReceiptSha256: crypto.randomBytes(32).toString('hex'), reviewedHeadCommitSha: 'e'.repeat(40),
    reviewedHeadTreeSha: 'e'.repeat(40), pullRequestNumber: 999,
  };
  scenario('B07', 'LIMITATION CONFIRMED', 'Forged historical entry (random digests, no signatures, unsigned DMK-999) accepted structurally; next signed registration previews VALID on top of it', () => {
    const Lf = serializeWbsReceiptLedger({ ...makeHistoricalWbsReceiptLedger(), entries: [forgedEntry] });
    const Wnext = addItem(Wforged, 'DMK-209', '13.06.22');
    const I = makeIntent('WBS-PR39-REVIEW-ON-FORGED', Wforged, Wnext, [{ id: 'DMK-209', wbs_path: '13.06.22', status: 'PROPOSED' }], git1);
    const r = run({ beforeBytes: Wforged, afterBytes: Wnext, ledgerBytes: Lf, expectedCurrentWbsSha256: digest(Wforged), expectedCurrentLedgerSha256: digest(Lf), receipt: signAll(I), policy, trustedContext: ctx(git1, ['FORGED-HISTORY-0001']) });
    assert.equal(r.valid, true); assert.equal(r.mayApply, false);
    return 'PREVIEW_VALID; forged entry never cryptographically verified';
  });
  scenario('B08', 'FINDING', 'Ledger permits a cycle back to a prior WBS state (A->B->A), contradicting additive-only registration', () => {
    const back = { ...forgedEntry, receiptId: 'FORGED-HISTORY-0002', preWbsSha256: digest(Wforged), postWbsSha256: HISTORICAL_WBS_SHA256 };
    const Lc = serializeWbsReceiptLedger({ ...makeHistoricalWbsReceiptLedger(), entries: [forgedEntry, back] });
    const r = run({ ...base1(), ledgerBytes: Lc, expectedCurrentLedgerSha256: digest(Lc), trustedContext: ctx(git1, ['FORGED-HISTORY-0001', 'FORGED-HISTORY-0002']) });
    assert.equal(r.valid, true);
    return 'cyclic chain G->X->G accepted and new registration from G previews VALID';
  });
  scenario('B09', 'LIMITATION CONFIRMED', 'Stale-snapshot replay: consumed receipt R1 previews VALID again when caller supplies stale WBS + genesis ledger + matching expected hashes', () => {
    const s1 = run(base1()); assert.equal(s1.valid, true);
    const replay = run(base1());
    assert.equal(replay.valid, true);
    return 'R1 replays; freshness depends solely on independently sourced expectedCurrent* + consumedReceiptIds';
  });

  // ===================== C. Multi-registration / replay =====================
  scenario('C01', 'DEFENSE PASS', 'Two sequential synthetic registrations G->W1->W2 succeed with exact chained ledger', () => {
    const s1 = run(base1());
    const s2 = run({ beforeBytes: W1, afterBytes: W2, ledgerBytes: s1.proposedLedgerBytes, expectedCurrentWbsSha256: s1.proposedWbsSha256, expectedCurrentLedgerSha256: s1.proposedLedgerSha256, receipt: R2, policy, trustedContext: ctx(git2, ['WBS-PR39-REVIEW-0001'], '2026-10-16T01:00:00.000Z') });
    assert.equal(s2.valid, true);
    const L2 = JSON.parse(s2.proposedLedgerBytes.toString('utf8'));
    assert.deepEqual(L2.entries.map((e: any) => [e.receiptId, e.preWbsSha256, e.postWbsSha256]),
      [['WBS-PR39-REVIEW-0001', digest(historic), digest(W1)], ['WBS-PR39-REVIEW-0002', digest(W1), digest(W2)]]);
    assert.equal(L2.entries[1].signedReceiptSha256, signedReceiptDigestV2(R2));
    return { proposedLedgerSha256: s2.proposedLedgerSha256 };
  });
  const s1 = previewWbsRegistrationTransaction(base1()); allResults.push(s1);
  const step2 = (over: any = {}) => ({ beforeBytes: W1, afterBytes: W2, ledgerBytes: s1.proposedLedgerBytes, expectedCurrentWbsSha256: s1.proposedWbsSha256, expectedCurrentLedgerSha256: s1.proposedLedgerSha256, receipt: R2, policy, trustedContext: ctx(git2, ['WBS-PR39-REVIEW-0001']), ...over });
  scenario('C02', 'DEFENSE PASS', 'Reordered application (R2 on genesis) -> REJECTED with byte-mismatch reason', () =>
    rejectedWith(run({ ...base1(), receipt: R2, afterBytes: W2, trustedContext: ctx(git2, []) }), 'Before or after WBS bytes differ from signed intent'));
  scenario('C03', 'DEFENSE PASS', 'Reversed ledger entry order -> REJECTED disconnected', () => {
    const s2 = run(step2()); const L2 = JSON.parse(s2.proposedLedgerBytes.toString('utf8'));
    const rev = Buffer.from(JSON.stringify({ ...L2, entries: [...L2.entries].reverse() }, null, 2) + '\n');
    return rejectedWith(run({ ...step2(), beforeBytes: W2, expectedCurrentWbsSha256: digest(W2), ledgerBytes: rev, expectedCurrentLedgerSha256: digest(rev), trustedContext: ctx(git2, ['WBS-PR39-REVIEW-0001', 'WBS-PR39-REVIEW-0002']) }), 'invalid, duplicate or disconnected');
  });
  scenario('C04', 'DEFENSE PASS', 'Consumed snapshot with extra unknown ID -> REJECTED', () =>
    rejectedWith(run(step2({ trustedContext: ctx(git2, ['WBS-PR39-REVIEW-0001', 'EXTRA-UNKNOWN-0001']) })), 'Trusted receipt-consumption snapshot conflicts with canonical ledger'));
  scenario('C05', 'DEFENSE PASS', 'Altered step-2 afterBytes -> REJECTED', () =>
    rejectedWith(run(step2({ afterBytes: Buffer.concat([W2, Buffer.from('# x\n')]) })), 'Before or after WBS bytes differ from signed intent'));
  scenario('C06', 'DEFENSE PASS', 'Re-presenting R1 at step-2 state -> REJECTED as consumed AND byte mismatch', () => {
    const e = rejectedWith(run(step2({ receipt: R1, afterBytes: W1, trustedContext: ctx(git1, ['WBS-PR39-REVIEW-0001']) })), 'Registration receipt was already consumed');
    assert.ok(e.some((x: string) => x.includes('Before or after WBS bytes differ'))); return e;
  });
  scenario('C07', 'LIMITATION CONFIRMED', 'Two different valid receipts against the same state BOTH preview VALID with conflicting proposed ledgers (no atomic CAS)', () => {
    const I2b = makeIntent('WBS-PR39-REVIEW-0002B', W1, W2b, [{ id: 'DMK-211', wbs_path: '13.06.24', status: 'PROPOSED' }], git2);
    const a = run(step2()), b = run(step2({ receipt: signAll(I2b), afterBytes: W2b }));
    assert.equal(a.valid, true); assert.equal(b.valid, true); assert.notEqual(a.proposedLedgerSha256, b.proposedLedgerSha256);
    return { a: a.proposedLedgerSha256, b: b.proposedLedgerSha256 };
  });
  scenario('C08', 'DEFENSE PASS', 'Preflight is deterministic and does not mutate caller inputs', () => {
    const inp = base1(); const snap = JSON.stringify(inp.receipt) + JSON.stringify(inp.policy) + JSON.stringify(inp.trustedContext);
    const x = run(inp), y = run(inp);
    assert.ok(x.proposedLedgerBytes.equals(y.proposedLedgerBytes));
    assert.equal(JSON.stringify(inp.receipt) + JSON.stringify(inp.policy) + JSON.stringify(inp.trustedContext), snap);
    return 'stable';
  });

  // ===================== D. Authorization boundaries =====================
  scenario('D01', 'LIMITATION CONFIRMED', 'Self-attested trustedContext: attacker-generated keys + self-pinned policy digest -> PREVIEW_VALID (context is not proof of authority)', () => {
    const x = crypto.generateKeyPairSync('ed25519'), y = crypto.generateKeyPairSync('ed25519');
    const evil = { ...policy, policyId: 'ATTACKER', humanKeys: [keyRec(x, 'X', 'Security Officer', 'K-X'), keyRec(y, 'Y', 'Lead Architect', 'K-Y')] };
    const evilPin = policyDigestV2(evil);
    const I = { ...I1, policyId: 'ATTACKER', policySha256: evilPin, receiptId: 'WBS-ATTACKER-000001' };
    const R = signAll(I, [[x, 'X', 'Security Officer', 'K-X'], [y, 'Y', 'Lead Architect', 'K-Y']]);
    const r = run({ ...base1(), receipt: R, policy: evil, trustedContext: { ...ctx(git1, []), pinnedPolicySha256: evilPin } });
    assert.equal(r.valid, true); assert.equal(r.mayApply, false);
    return 'PREVIEW_VALID with attacker policy; mayApply false';
  });
  scenario('D02', 'DEFENSE PASS', 'Static: preflight module imports no fs/child_process/network and contains no write APIs', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/planWbsRegistrationTransaction.ts'), 'utf8');
    const imports = [...src.matchAll(/^import .* from '([^']+)';?$/gm)].map(m => m[1]);
    for (const bad of ["'node:fs'", "'fs'", 'child_process', 'writeFile', 'appendFile', 'execSync', 'spawn', "'node:http", 'fetch(']) assert.ok(!src.includes(bad), 'found ' + bad);
    assert.ok(!/mayApply:\s*true/.test(src));
    return { imports, mayApplyTrueLiterals: 0 };
  });
  scenario('D03', 'DEFENSE PASS', 'Every preflight result produced in this harness has mayApply === false', () => {
    assert.ok(allResults.length > 30); for (const r of allResults) assert.equal(r.mayApply, false);
    return { results: allResults.length, valid: allResults.filter(r => r.valid).length };
  });
  scenario('D04', 'DEFENSE PASS', 'Protected files (docs/00_control, docs/07_verification, bootstrap, .local/project-state.json) unchanged by harness', () => {
    const after: Record<string, string> = {};
    for (const d of ['docs/00_control', 'docs/07_verification', 'bootstrap']) hashTree(path.join(ROOT, d), after);
    assert.deepEqual(after, protectedBefore);
    const ls = fs.existsSync(localStatePath) ? crypto.createHash('sha256').update(fs.readFileSync(localStatePath)).digest('hex') : 'ABSENT';
    assert.equal(ls, localStateBefore);
    return { filesHashed: Object.keys(after).length, localState: ls };
  });

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ ...tally, unexpected: failures }));
  process.exit(failures ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
