import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import {
  verifyDmk197ClosureCandidate,
  computeDmk197ClosureCandidateDigest,
  EXPECTED_FROZEN_IMPLEMENTATION_HEAD_SHA,
  EXPECTED_BASE_MASTER_SHA,
  EXPECTED_VERIFICATION_EVIDENCE_PATH,
  EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256,
  EXPECTED_CANDIDATE_DIGEST,
  CANDIDATE_FILE_PATH,
} from './verifyDmk197ClosureCandidate.ts';

const root = process.cwd();
const liveCandidatePath = path.join(root, CANDIDATE_FILE_PATH);
const rawCandidate = JSON.parse(fs.readFileSync(liveCandidatePath, 'utf8'));

function getPreApplyWbsYaml(): string {
  const current = fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8');
  const target = `    status: "VERIFICATION_PENDING"
    dependencies: ["DMK-196"]
    requirements: ["REQ-GOV-QUORUM-001"]
    architecture_links: ["CMP-01", "CMP-04"]
    security_controls: ["SEC-CTRL-020"]
    acceptance_criteria:
      - "Distinct Security Officer and Lead Architect human identities required for quorum"
    verification_method: "Quorum verification test"
    evidence:
      - "docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md"
      - "docs/07_verification/dmk-197-closure-transition-candidate.json"`;
  const pre = `    status: "IN_PROGRESS"
    dependencies: ["DMK-196"]
    requirements: ["REQ-GOV-QUORUM-001"]
    architecture_links: ["CMP-01", "CMP-04"]
    security_controls: ["SEC-CTRL-020"]
    acceptance_criteria:
      - "Distinct Security Officer and Lead Architect human identities required for quorum"
    verification_method: "Quorum verification test"
    evidence: []`;
  return current.includes(target) ? current.replace(target, pre) : current;
}
const preApplyWbsYaml = getPreApplyWbsYaml();

console.log('================================================================');
console.log('   DMK-197 CLOSURE TRANSITION CANDIDATE REGRESSION TEST SUITE');
console.log('   Evaluates Invariant: Fail-closed verification & tamper-proofing');
console.log('   Coverage: Scenarios 1 through 20 (Positive & Negative checks)');
console.log('================================================================\n');

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

let passedCount = 0;
let failedCount = 0;

function pass(name: string) {
  passedCount++;
  console.log(`✓ [PASS] Scenario ${name}`);
}

function fail(name: string, error: unknown) {
  failedCount++;
  console.error(`✗ [FAIL] Scenario ${name}:`, error);
}

// 1. Live candidate and canonical WBS pass completely
try {
  const receiptPath = path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-receipt.json');
  const hasReceipt = fs.existsSync(receiptPath);
  const wbsRaw = fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8');
  const dmk197Block = wbsRaw.slice(wbsRaw.indexOf('id: "DMK-197"'), wbsRaw.indexOf('id: "DMK-198"'));
  const isPostApply = hasReceipt && dmk197Block.includes('status: "VERIFICATION_PENDING"');
  const mode = isPostApply ? 'POST_APPLY' : 'PRE_APPLY';
  const res = verifyDmk197ClosureCandidate({ mode, ...(mode === 'PRE_APPLY' ? { allowExistingReceipt: true } : {}) });
  assert.equal(res.valid, true, `Expected valid=true, got errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  pass(`1: Live candidate and canonical WBS pass completely (mode: ${mode})`);
} catch (err) {
  fail('1: Live candidate and canonical WBS pass completely', err);
}

// 2. Wrong WorkItem ID fails closed
try {
  const bad = clone(rawCandidate);
  bad.workItemId = 'DMK-999';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.workItemId must be "DMK-197"')));
  pass('2: Wrong WorkItem ID fails closed');
} catch (err) {
  fail('2: Wrong WorkItem ID fails closed', err);
}

// 3. Wrong WBS path fails closed
try {
  const bad = clone(rawCandidate);
  bad.wbsPath = '13.06.99';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.wbsPath must be "13.06.11"')));
  pass('3: Wrong WBS path fails closed');
} catch (err) {
  fail('3: Wrong WBS path fails closed', err);
}

// 4. Wrong source status fails closed
try {
  const bad = clone(rawCandidate);
  bad.fromStatus = 'BACKLOG';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.fromStatus must be "IN_PROGRESS"')));
  pass('4: Wrong source status fails closed');
} catch (err) {
  fail('4: Wrong source status fails closed', err);
}

// 5. Wrong candidate target status fails closed (e.g. premature VERIFIED)
try {
  const bad = clone(rawCandidate);
  bad.candidateStatus = 'VERIFIED';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.candidateStatus must be "VERIFICATION_PENDING"')));
  pass('5: Premature target status VERIFIED fails closed');
} catch (err) {
  fail('5: Premature target status VERIFIED fails closed', err);
}

// 6. Modified acceptance criterion fails closed
try {
  const bad = clone(rawCandidate);
  bad.acceptanceCriterion = 'Single admin identity allowed for quorum';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.acceptanceCriterion must be')));
  pass('6: Modified acceptance criterion fails closed');
} catch (err) {
  fail('6: Modified acceptance criterion fails closed', err);
}

// 7. Wrong implementation HEAD SHA fails closed
try {
  const bad = clone(rawCandidate);
  bad.implementationHeadSha = '0000000000000000000000000000000000000000';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('implementationHeadSha must match')));
  pass('7: Wrong implementation HEAD SHA fails closed');
} catch (err) {
  fail('7: Wrong implementation HEAD SHA fails closed', err);
}

// 8. Wrong base master SHA fails closed
try {
  const bad = clone(rawCandidate);
  bad.baseMasterSha = '0000000000000000000000000000000000000000';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('baseMasterSha must match')));
  pass('8: Wrong base master SHA fails closed');
} catch (err) {
  fail('8: Wrong base master SHA fails closed', err);
}

// 9. Failed CI conclusion fails closed
try {
  const bad = clone(rawCandidate);
  bad.completeRegressionConclusion = 'failure';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('completeRegressionConclusion must be "success"')));
  pass('9: Failed CI conclusion fails closed');
} catch (err) {
  fail('9: Failed CI conclusion fails closed', err);
}

// 10. Missing verification evidence file fails closed
try {
  const res = verifyDmk197ClosureCandidate({
    customWbsYamlContent: preApplyWbsYaml,
    mode: 'PRE_APPLY',
    workspaceRoot: os.tmpdir(), // Points to empty workspace where evidence path is missing
    allowMissingEvidenceFile: false,
    customCandidate: rawCandidate,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('Verification evidence file missing')));
  pass('10: Missing verification evidence file fails closed');
} catch (err) {
  fail('10: Missing verification evidence file fails closed', err);
}

// 11. Recomputed tampered candidate digest rejected against immutable digest
try {
  const bad = clone(rawCandidate);
  bad.implementationCiRunId = 99999999999;
  const recomputed = computeDmk197ClosureCandidateDigest(bad);
  assert.notEqual(recomputed, EXPECTED_CANDIDATE_DIGEST);
  pass('11: Recomputed tampered candidate digest rejected against immutable digest');
} catch (err) {
  fail('11: Recomputed tampered candidate digest rejected against immutable digest', err);
}

// 12. Tampered candidate digest fails closed
try {
  const bad = clone(rawCandidate);
  bad.candidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.candidateDigest mismatch')));
  pass('12: Tampered candidate digest fails closed');
} catch (err) {
  fail('12: Tampered candidate digest fails closed', err);
}

// 13. Stale pre-closure WBS digest fails closed
try {
  const bad = clone(rawCandidate);
  bad.preClosureCanonicalWbsSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('preClosureCanonicalWbsSha256 must match')));
  pass('13: Stale pre-closure WBS digest fails closed');
} catch (err) {
  fail('13: Stale pre-closure WBS digest fails closed', err);
}

// 14. Premature approval and applied fields fail closed
try {
  const bad1 = clone(rawCandidate);
  bad1.decision = 'APPROVE';
  const res1 = verifyDmk197ClosureCandidate({ customCandidate: bad1, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.includes('Candidate must not contain premature approval decision')));

  const bad2 = clone(rawCandidate);
  bad2.human_approved_by = 'REV-SEC-01';
  const res2 = verifyDmk197ClosureCandidate({ customCandidate: bad2, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some((e) => e.includes('Candidate must not contain human_approved_by')));

  const bad3 = clone(rawCandidate);
  bad3.applied = true;
  const res3 = verifyDmk197ClosureCandidate({ customCandidate: bad3, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res3.valid, false);
  assert.ok(res3.errors.some((e) => e.includes('Candidate must not contain applied')));

  pass('14: Premature approval and applied fields fail closed');
} catch (err) {
  fail('14: Premature approval and applied fields fail closed', err);
}

// 15. Premature WBS status advancement fails closed
try {
  const doc = YAML.parse(preApplyWbsYaml);
  function mutateDmk197(items: any[], newStatus: string) {
    for (const it of items || []) {
      if (it.id === 'DMK-197') { it.status = newStatus; return; }
      if (it.children) mutateDmk197(it.children, newStatus);
    }
  }
  mutateDmk197(doc.items, 'VERIFICATION_PENDING');
  const mutatedYaml = YAML.stringify(doc);
  const res = verifyDmk197ClosureCandidate({ customWbsYamlContent: mutatedYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-197 status must remain "IN_PROGRESS" during candidate preparation')));
  pass('15: Premature WBS status advancement fails closed');
} catch (err) {
  fail('15: Premature WBS status advancement fails closed', err);
}

// 16. Modified adjacent WorkItem statuses fail closed
try {
  const doc = YAML.parse(preApplyWbsYaml);
  function mutateStatus(items: any[], id: string, newStatus: string) {
    for (const it of items || []) {
      if (it.id === id) { it.status = newStatus; return; }
      if (it.children) mutateStatus(it.children, id, newStatus);
    }
  }
  mutateStatus(doc.items, 'DMK-196', 'IN_PROGRESS'); // Should be VERIFIED
  const mutatedYaml = YAML.stringify(doc);
  const res = verifyDmk197ClosureCandidate({ customWbsYamlContent: mutatedYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-196 status must remain "VERIFIED"')));
  pass('16: Modified adjacent WorkItem status fails closed');
} catch (err) {
  fail('16: Modified adjacent WorkItem status fails closed', err);
}

// 17. Runtime mutation or reconciliation claims fail closed
try {
  const bad = clone(rawCandidate);
  bad.liveReconciliationExecuted = true;
  bad.runtimeWorkItemMutationCount = 1;
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('liveReconciliationExecuted must be false')));
  assert.ok(res.errors.some((e) => e.includes('runtimeWorkItemMutationCount must be 0')));
  pass('17: Runtime mutation and reconciliation claims fail closed');
} catch (err) {
  fail('17: Runtime mutation and reconciliation claims fail closed', err);
}

// 18. Gate 7 or release mutation claims fail closed
try {
  const bad = clone(rawCandidate);
  bad.gate7Changed = true;
  bad.releaseChanged = true;
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('gate7Changed must be false')));
  assert.ok(res.errors.some((e) => e.includes('releaseChanged must be false')));
  pass('18: Gate 7 and release mutation claims fail closed');
} catch (err) {
  fail('18: Gate 7 and release mutation claims fail closed', err);
}

// 19. Premature receipt file presence in isolated workspace fails closed
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-receipt-test-'));
  try {
    // Replicate candidate file, evidence file, and MASTER_WBS.yaml into temp workspace
    const tempVerifDir = path.join(tempDir, 'docs', '07_verification');
    const tempControlDir = path.join(tempDir, 'docs', '00_control');
    fs.mkdirSync(tempVerifDir, { recursive: true });
    fs.mkdirSync(tempControlDir, { recursive: true });

    fs.writeFileSync(
      path.join(tempVerifDir, 'dmk-197-closure-transition-candidate.json'),
      fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-candidate.json'))
    );
    fs.writeFileSync(
      path.join(tempVerifDir, 'DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md'),
      fs.readFileSync(path.join(root, 'docs', '07_verification', 'DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md'))
    );
    fs.writeFileSync(
      path.join(tempControlDir, 'MASTER_WBS.yaml'),
      preApplyWbsYaml
    );

    // Inject synthetic premature receipt into temporary workspace
    const syntheticReceipt = {
      receiptType: 'DMK-197_CLOSURE_RECEIPT',
      timestamp: new Date().toISOString(),
      appliedStatus: 'VERIFICATION_PENDING',
      applied: true,
    };
    fs.writeFileSync(
      path.join(tempVerifDir, 'dmk-197-closure-transition-receipt.json'),
      JSON.stringify(syntheticReceipt, null, 2)
    );

    // Run verification on isolated workspace in PRE_APPLY mode
    const res = verifyDmk197ClosureCandidate({ workspaceRoot: tempDir, mode: 'PRE_APPLY' });
    assert.equal(res.valid, false, 'Candidate verification must fail when closure receipt exists');
    assert.ok(
      res.errors.some((e) => e.includes('Closure receipt already exists') && e.includes('premature receipt creation is forbidden')),
      `Expected premature receipt error, got: ${JSON.stringify(res.errors)}`
    );
  } finally {
    // Clean up temporary workspace
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // Assert isolated clean pre-application workspace passes completely
  const cleanTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-clean-preapply-'));
  try {
    const cleanVerifDir = path.join(cleanTempDir, 'docs', '07_verification');
    const cleanCtrlDir = path.join(cleanTempDir, 'docs', '00_control');
    fs.mkdirSync(cleanVerifDir, { recursive: true });
    fs.mkdirSync(cleanCtrlDir, { recursive: true });
    fs.writeFileSync(
      path.join(cleanCtrlDir, 'MASTER_WBS.yaml'),
      preApplyWbsYaml
    );
    fs.writeFileSync(
      path.join(cleanVerifDir, 'dmk-197-closure-transition-candidate.json'),
      fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-candidate.json'))
    );
    fs.writeFileSync(
      path.join(cleanVerifDir, 'DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md'),
      fs.readFileSync(path.join(root, 'docs', '07_verification', 'DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md'))
    );
    const cleanRes = verifyDmk197ClosureCandidate({ workspaceRoot: cleanTempDir, mode: 'PRE_APPLY' });
    assert.equal(cleanRes.valid, true, `Clean pre-apply fixture must pass, got errors: ${cleanRes.errors.join('; ')}`);
  } finally {
    fs.rmSync(cleanTempDir, { recursive: true, force: true });
  }

  pass('19: Premature closure receipt presence fails closed in isolated workspace');
} catch (err) {
  fail('19: Premature closure receipt presence fails closed in isolated workspace', err);
}

// 20. Tampered or missing supersededCandidateDigest fails closed
try {
  const bad = clone(rawCandidate);
  bad.supersededCandidateDigest = 'bad0000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, customWbsYamlContent: preApplyWbsYaml, mode: 'PRE_APPLY', skipDigestCheck: true, allowExistingReceipt: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('supersededCandidateDigest must match')));
  pass('20: Tampered or missing supersededCandidateDigest fails closed');
} catch (err) {
  fail('20: Tampered or missing supersededCandidateDigest fails closed', err);
}

console.log('\n================================================================');
console.log(`TOTAL CANDIDATE TESTS: 20 | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
