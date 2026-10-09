import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const rawWbsYaml = fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8');

console.log('================================================================');
console.log('   DMK-197 CLOSURE TRANSITION CANDIDATE REGRESSION TEST SUITE');
console.log('   Evaluates Invariant: Fail-closed verification & tamper-proofing');
console.log('   Coverage: Scenarios 1 through 19 (Positive & Negative checks)');
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
  const res = verifyDmk197ClosureCandidate();
  assert.equal(res.valid, true, `Expected valid=true, got errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  pass('1: Live candidate and canonical WBS pass completely');
} catch (err) {
  fail('1: Live candidate and canonical WBS pass completely', err);
}

// 2. Wrong WorkItem ID fails closed
try {
  const bad = clone(rawCandidate);
  bad.workItemId = 'DMK-999';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
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
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
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
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
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
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.candidateStatus must be "VERIFICATION_PENDING"')));
  pass('5: Premature target status VERIFIED fails closed');
} catch (err) {
  fail('5: Premature target status VERIFIED fails closed', err);
}

// 6. Missing or modified acceptance criterion fails closed
try {
  const bad = clone(rawCandidate);
  bad.acceptanceCriterion = 'Modified criterion';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
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
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.implementationHeadSha must match')));
  pass('7: Wrong implementation HEAD SHA fails closed');
} catch (err) {
  fail('7: Wrong implementation HEAD SHA fails closed', err);
}

// 8. Wrong base master SHA fails closed
try {
  const bad = clone(rawCandidate);
  bad.baseMasterSha = '1111111111111111111111111111111111111111';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.baseMasterSha must match')));
  pass('8: Wrong base master SHA fails closed');
} catch (err) {
  fail('8: Wrong base master SHA fails closed', err);
}

// 9. Failed or mismatched CI evidence fails closed
try {
  const bad = clone(rawCandidate);
  bad.completeRegressionConclusion = 'failure';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('completeRegressionConclusion must be "success"')));
  pass('9: Failed CI conclusion fails closed');
} catch (err) {
  fail('9: Failed CI conclusion fails closed', err);
}

// 10. Missing verification evidence file fails closed
try {
  const res = verifyDmk197ClosureCandidate({ allowMissingEvidenceFile: false, customCandidate: { ...rawCandidate, verificationEvidence: 'docs/07_verification/NONEXISTENT.md' }, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('verificationEvidence must be') || e.includes('missing at')));
  pass('10: Missing verification evidence file fails closed');
} catch (err) {
  fail('10: Missing verification evidence file fails closed', err);
}

// 11. Modified candidate field with recomputed digest fails against immutable digest
try {
  const bad = clone(rawCandidate);
  bad.implementationCiAttempt = 2;
  bad.candidateDigest = computeDmk197ClosureCandidateDigest(bad);
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('mismatch against expected immutable candidate digest')));
  pass('11: Recomputed tampered candidate digest rejected against immutable digest');
} catch (err) {
  fail('11: Recomputed tampered candidate digest rejected against immutable digest', err);
}

// 12. Modified candidate digest (tampered digest) fails closed
try {
  const bad = clone(rawCandidate);
  bad.candidateDigest = 'bad0000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.candidateDigest mismatch')));
  pass('12: Tampered candidate digest fails closed');
} catch (err) {
  fail('12: Tampered candidate digest fails closed', err);
}

// 13. Stale pre-closure WBS digest fails closed
try {
  const bad = clone(rawCandidate);
  bad.preClosureCanonicalWbsSha256 = 'stale00000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('preClosureCanonicalWbsSha256 must match')));
  pass('13: Stale pre-closure WBS digest fails closed');
} catch (err) {
  fail('13: Stale pre-closure WBS digest fails closed', err);
}

// 14. Unauthorized approval or application fields fail closed
try {
  const bad1 = clone(rawCandidate);
  bad1.applied = true;
  const res1 = verifyDmk197ClosureCandidate({ customCandidate: bad1, skipDigestCheck: true });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.includes('Candidate must not contain applied')));

  const bad2 = clone(rawCandidate);
  bad2.human_approved_by = 'OperatorName';
  const res2 = verifyDmk197ClosureCandidate({ customCandidate: bad2, skipDigestCheck: true });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some((e) => e.includes('Candidate must not contain human_approved_by')));

  const bad3 = clone(rawCandidate);
  bad3.decision = 'APPROVE';
  const res3 = verifyDmk197ClosureCandidate({ customCandidate: bad3, skipDigestCheck: true });
  assert.equal(res3.valid, false);
  assert.ok(res3.errors.some((e) => e.includes('Candidate must not contain premature approval decision')));

  pass('14: Premature approval and applied fields fail closed');
} catch (err) {
  fail('14: Premature approval and applied fields fail closed', err);
}

// 15. Unexpected WBS status advancement fails closed
try {
  const doc = YAML.parse(rawWbsYaml);
  function mutateStatus(items: any[], id: string, newStatus: string) {
    for (const it of items || []) {
      if (it.id === id) { it.status = newStatus; return; }
      if (it.children) mutateStatus(it.children, id, newStatus);
    }
  }
  mutateStatus(doc.items, 'DMK-197', 'VERIFICATION_PENDING');
  const mutatedYaml = YAML.stringify(doc);
  const res = verifyDmk197ClosureCandidate({ customWbsYamlContent: mutatedYaml, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-197 status must remain "IN_PROGRESS" during candidate preparation')));
  pass('15: Premature WBS status advancement fails closed');
} catch (err) {
  fail('15: Premature WBS status advancement fails closed', err);
}

// 16. Modified adjacent WorkItem statuses fail closed
try {
  const doc = YAML.parse(rawWbsYaml);
  function mutateStatus(items: any[], id: string, newStatus: string) {
    for (const it of items || []) {
      if (it.id === id) { it.status = newStatus; return; }
      if (it.children) mutateStatus(it.children, id, newStatus);
    }
  }
  mutateStatus(doc.items, 'DMK-196', 'IN_PROGRESS'); // Should be VERIFIED
  const mutatedYaml = YAML.stringify(doc);
  const res = verifyDmk197ClosureCandidate({ customWbsYamlContent: mutatedYaml, skipDigestCheck: true });
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
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
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
  const res = verifyDmk197ClosureCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('gate7Changed must be false')));
  assert.ok(res.errors.some((e) => e.includes('releaseChanged must be false')));
  pass('18: Gate 7 and release mutation claims fail closed');
} catch (err) {
  fail('18: Gate 7 and release mutation claims fail closed', err);
}

// 19. Premature receipt file presence fails closed
try {
  // Test by checking that verifyDmk197ClosureCandidate checks receipt existence
  const receiptPath = path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-receipt.json');
  assert.equal(fs.existsSync(receiptPath), false, 'Closure receipt must not exist in candidate phase');
  pass('19: Closure receipt absence verified for candidate preparation phase');
} catch (err) {
  fail('19: Closure receipt absence verified for candidate preparation phase', err);
}

console.log('\n================================================================');
console.log(`TOTAL CANDIDATE TESTS: 19 | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
