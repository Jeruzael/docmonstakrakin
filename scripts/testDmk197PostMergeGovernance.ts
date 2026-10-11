import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { verifyDmk197Closure } from './verifyDmk197Closure.ts';
import { verifyDmk196Closure } from './verifyDmk196Closure.ts';
import { verifyDmk196PostMergeCandidate } from './verifyDmk196PostMergeCandidate.ts';
import { verifyDmk208StatusAudit } from './verifyDmk208StatusAudit.ts';

const root = process.cwd();
const liveAttestationPath = path.join(root, 'docs', '07_verification', 'dmk-197-post-merge-governance-attestation.json');
const rawAttestation = JSON.parse(fs.readFileSync(liveAttestationPath, 'utf8'));

console.log('================================================================');
console.log('   DMK-197 POST-MERGE GOVERNANCE ATTESTATION REGRESSION SUITE   ');
console.log('   Evaluates Invariant: Fail-closed verification on attestation & receipt');
console.log('   Coverage: Scenarios 1 through 20 (Negative & positive boundary checks)');
console.log('================================================================\n');

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

let passedCount = 0;
function pass(name: string) {
  passedCount++;
  console.log(`✓ [PASS] Scenario ${passedCount}: ${name}`);
}

// Scenario 1: Valid live attestation and receipt pass in verifyDmk197Closure
{
  const res = verifyDmk197Closure({ workspaceRoot: root });
  assert.equal(res.valid, true, `Expected valid=true, got errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  pass('Live receipt and post-merge attestation pass verifyDmk197Closure completely');
}

// Scenario 2: Missing attestation fails closed in verifyDmk197Closure
{
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: null,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /attestation.*missing|not found/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Missing attestation fails closed in verifyDmk197Closure');
}

// Scenario 3: Tampered approvedCandidateDigest in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.approvedCandidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /approvedCandidateDigest/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered approvedCandidateDigest in attestation fails closed');
}

// Scenario 4: Tampered originalReceiptSha256 in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.originalReceiptSha256 = '1111111111111111111111111111111111111111111111111111111111111111';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /originalReceiptSha256/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered originalReceiptSha256 in attestation fails closed');
}

// Scenario 5: Tampered closureCommitSha fails closed
{
  const bad = clone(rawAttestation);
  bad.closureCommitSha = '2222222222222222222222222222222222222222';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /closureCommitSha/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered closureCommitSha in attestation fails closed');
}

// Scenario 6: Tampered mergeCommitSha fails closed
{
  const bad = clone(rawAttestation);
  bad.mergeCommitSha = '3333333333333333333333333333333333333333';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /mergeCommitSha/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered mergeCommitSha in attestation fails closed');
}

// Scenario 7: Tampered approvalCommentId fails closed
{
  const bad = clone(rawAttestation);
  bad.approvalCommentId = 9999999999;
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /approvalCommentId/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered approvalCommentId in attestation fails closed');
}

// Scenario 8: Tampered approvalAuthor or approvalAuthorId fails closed
{
  const bad = clone(rawAttestation);
  bad.approvalAuthor = 'UnauthorizedUser';
  bad.approvalAuthorId = 12345;
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /approvalAuthor/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered approvalAuthor/approvalAuthorId in attestation fails closed');
}

// Scenario 9: False claim of pre-merge approval (priorApprovalObtained: true) fails closed
{
  const bad = clone(rawAttestation);
  bad.priorApprovalObtained = true;
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /priorApprovalObtained/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('False claim of pre-merge approval (priorApprovalObtained: true) fails closed');
}

// Scenario 10: Tampered retrospectiveGovernanceStatus fails closed
{
  const bad = clone(rawAttestation);
  bad.retrospectiveGovernanceStatus = 'AUTOMATICALLY_CURED';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /retrospectiveGovernanceStatus/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered retrospectiveGovernanceStatus fails closed');
}

// Scenario 11: Tampered timestampInterpretation fails closed
{
  const bad = clone(rawAttestation);
  bad.timestampInterpretation = 'CONFIRMED_EXACT_UTC';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /timestampInterpretation/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered timestampInterpretation fails closed');
}

// Scenario 12: Tampered masterCiRunId or conclusion fails closed
{
  const bad = clone(rawAttestation);
  bad.masterCiRunId = 11111111;
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /masterCiRunId/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered masterCiRunId in attestation fails closed');
}

// Scenario 13: Missing attestation fails closed in verifyDmk196Closure
{
  const res = verifyDmk196Closure({
    workspaceRoot: root,
    customDmk197Attestation: null,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /DMK-197.*attestation.*missing|not found/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Missing attestation fails closed in verifyDmk196Closure');
}

// Scenario 14: Tampered attestation fails closed in verifyDmk196Closure
{
  const bad = clone(rawAttestation);
  bad.approvedCandidateDigest = 'bad-digest';
  const res = verifyDmk196Closure({
    workspaceRoot: root,
    customDmk197Attestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /DMK-197.*attestation.*digest|invalid/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered attestation fails closed in verifyDmk196Closure');
}

// Scenario 15: Missing attestation fails closed in verifyDmk196PostMergeCandidate
{
  const res = verifyDmk196PostMergeCandidate({
    workspaceRoot: root,
    customDmk197Attestation: null,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /DMK-197.*attestation.*missing|not found/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Missing attestation fails closed in verifyDmk196PostMergeCandidate');
}

// Scenario 16: Tampered attestation fails closed in verifyDmk196PostMergeCandidate
{
  const bad = clone(rawAttestation);
  bad.approvedCandidateDigest = 'bad-digest';
  const res = verifyDmk196PostMergeCandidate({
    workspaceRoot: root,
    customDmk197Attestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /DMK-197.*attestation.*digest|invalid/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered attestation fails closed in verifyDmk196PostMergeCandidate');
}

// Scenario 17: Missing attestation fails closed in verifyDmk208StatusAudit
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(root, undefined, undefined, {
        customDmk197Attestation: null,
      });
    },
    /DMK-197.*attestation.*missing|not found/i,
    'Scenario 17 failed: should throw on missing attestation'
  );
  pass('Missing attestation fails closed in verifyDmk208StatusAudit');
}

// Scenario 18: Tampered attestation fails closed in verifyDmk208StatusAudit
{
  const bad = clone(rawAttestation);
  bad.approvedCandidateDigest = 'bad-digest';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(root, undefined, undefined, {
        customDmk197Attestation: bad,
      });
    },
    /DMK-197.*attestation.*digest|invalid/i,
    'Scenario 18 failed: should throw on tampered attestation'
  );
  pass('Tampered attestation fails closed in verifyDmk208StatusAudit');
}

// Scenario 19: Premature DMK-197 VERIFIED in WBS fails closed across verifiers
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(root, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-197': 'VERIFIED' },
      });
    },
    /TRANSITION item DMK-197 status mismatch/i
  );
  pass('Premature DMK-197 VERIFIED status fails closed in verifyDmk208StatusAudit');
}

// Scenario 20: Attestation confirms non-mutation of Gate 7, release, and live reconciliation
{
  assert.equal(rawAttestation.verifiedPromoted, false);
  assert.equal(rawAttestation.liveReconciliationExecuted, false);
  assert.equal(rawAttestation.gate7Changed, false);
  assert.equal(rawAttestation.releaseChanged, false);
  assert.equal(rawAttestation.canonicalStatus, 'VERIFICATION_PENDING');
  pass('Attestation asserts non-promotion and preservation of Gate 7, release, and reconciliation');
}

console.log('\n================================================================');
console.log(`TOTAL ATTESTATION TESTS: ${passedCount} | PASSED: ${passedCount} | FAILED: 0`);
console.log('================================================================\n');
