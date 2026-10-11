import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
console.log('   Coverage: Scenarios 1 through 40 (Negative & positive boundary checks)');
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

// Scenario 21: Tampered or missing projectId in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.projectId = 'PRJ-OTHER';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /projectId/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered projectId in attestation fails closed');
}

// Scenario 22: Tampered masterCiAttempt in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.masterCiAttempt = 2;
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /masterCiAttempt/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered masterCiAttempt in attestation fails closed');
}

// Scenario 23: Tampered masterCiJobs (non-success job conclusion) fails closed
{
  const bad = clone(rawAttestation);
  bad.masterCiJobs = {
    ...rawAttestation.masterCiJobs,
    'Complete Regression': 'failure',
  };
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /masterCiJobs.*Complete Regression/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered masterCiJobs (non-success job) fails closed');
}

// Scenario 24: Missing required job in masterCiJobs fails closed
{
  const bad = clone(rawAttestation);
  bad.masterCiJobs = {
    'Controlled Docs': 'success',
    'Quality & Build': 'success',
  };
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /masterCiJobs.*Complete Regression/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Missing required job in masterCiJobs fails closed');
}

// Scenario 25: Unexpected extra job in masterCiJobs fails closed
{
  const bad = clone(rawAttestation);
  bad.masterCiJobs = {
    ...rawAttestation.masterCiJobs,
    'Unexpected Job': 'success',
  };
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /masterCiJobs.*unexpected/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Unexpected extra job in masterCiJobs fails closed');
}

// Scenario 26: Non-object masterCiJobs fails closed
{
  const bad = clone(rawAttestation);
  bad.masterCiJobs = 'all-green';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /masterCiJobs/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Non-object masterCiJobs fails closed');
}

// Scenario 27: Explicit null customReceipt in verifyDmk197Closure fails closed
{
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customReceipt: null,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /closure receipt.*missing/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Explicit null customReceipt in verifyDmk197Closure fails closed');
}

// Scenario 28: Missing receipt on disk fails closed in isolated workspace
{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-test-missing-receipt-'));
  try {
    const res = verifyDmk197Closure({
      workspaceRoot: tempDir,
      customAttestation: rawAttestation,
      customReceipt: {
        schemaVersion: '1.0',
        workItemId: 'DMK-197',
        wbsPath: '13.06.11',
        decision: 'APPROVE',
        decisionAuthority: 'Human operator',
        decisionSource: 'Explicit human operator approval of DMK-197 closure transition candidate in governed review session',
        fromStatus: 'IN_PROGRESS',
        toStatus: 'VERIFICATION_PENDING',
        approvedCandidateDigest: '0b51dce158c989a437e3ad1776ec3388ada8a556558e3a668393452f5c98cbf7',
        candidateFile: 'docs/07_verification/dmk-197-closure-transition-candidate.json',
        implementationHeadSha: 'dab159041b9b2616c42d2654598d0949e5778d85',
        implementationCiRunId: 38150032624,
        implementationCiAttempt: 1,
        implementationCiConclusion: 'success',
        preClosureBranchSha: '153c4c5c97df44d367725c4aa94aef4bde81717e',
        baseMasterSha: '7e45da9b0d4d8553745e5b7c25597eb48c94d6af',
        acceptanceCriterion: 'Distinct Security Officer and Lead Architect human identities required for quorum',
        verificationEvidence: [
          'docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md',
          'docs/07_verification/DMK_197_CLOSURE_TRANSITION_REVIEW.md',
        ],
        implementationChangedDuringClosure: false,
        preClosureCanonicalWbsSha256: 'c4bf5011d5d234b1e16b2ab4f0a3d07b1ab0a34a77b7e97b6463adbcea290087',
        postClosureCanonicalWbsSha256: '53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d',
        liveReconciliationExecuted: false,
        runtimeWorkItemMutationCount: 0,
        gate7Changed: false,
        releaseChanged: false,
        applied: true,
        appliedAt: '2026-10-12T01:40:03Z',
      },
      allowMissingEvidenceFile: true,
      customWbsYamlContent: fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8'),
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e: string) => /receipt.*missing/i.test(e)), `Unexpected errors: ${res.errors}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('Missing receipt on disk fails closed in isolated workspace');
}

// Scenario 29: Corrupt/unparseable JSON receipt on disk fails closed
{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-test-corrupt-receipt-'));
  try {
    const rDir = path.join(tempDir, 'docs', '07_verification');
    fs.mkdirSync(rDir, { recursive: true });
    fs.writeFileSync(path.join(rDir, 'dmk-197-closure-transition-receipt.json'), '{ not valid json');
    const res = verifyDmk197Closure({
      workspaceRoot: tempDir,
      customAttestation: rawAttestation,
      allowMissingEvidenceFile: true,
      customWbsYamlContent: fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8'),
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e: string) => /parse.*receipt|receipt.*missing/i.test(e)), `Unexpected errors: ${res.errors}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('Corrupt JSON receipt on disk fails closed');
}

// Scenario 30: Empty receipt file on disk fails closed
{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-test-empty-receipt-'));
  try {
    const rDir = path.join(tempDir, 'docs', '07_verification');
    fs.mkdirSync(rDir, { recursive: true });
    fs.writeFileSync(path.join(rDir, 'dmk-197-closure-transition-receipt.json'), '   \n');
    const res = verifyDmk197Closure({
      workspaceRoot: tempDir,
      customAttestation: rawAttestation,
      allowMissingEvidenceFile: true,
      customWbsYamlContent: fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8'),
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e: string) => /empty|parse|receipt.*missing/i.test(e)), `Unexpected errors: ${res.errors}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('Empty receipt file on disk fails closed');
}

// Scenario 31: Altered disk receipt bytes fail closed against attestation.originalReceiptSha256
{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-test-altered-receipt-'));
  try {
    const rDir = path.join(tempDir, 'docs', '07_verification');
    fs.mkdirSync(rDir, { recursive: true });
    const liveReceipt = JSON.parse(fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-receipt.json'), 'utf8'));
    liveReceipt.comment = 'tampered extra field';
    fs.writeFileSync(path.join(rDir, 'dmk-197-closure-transition-receipt.json'), JSON.stringify(liveReceipt, null, 2));
    const res = verifyDmk197Closure({
      workspaceRoot: tempDir,
      customAttestation: rawAttestation,
      allowMissingEvidenceFile: true,
      customWbsYamlContent: fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8'),
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e: string) => /originalReceiptSha256 mismatch/i.test(e)), `Unexpected errors: ${res.errors}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('Altered disk receipt bytes fail closed against attestation.originalReceiptSha256');
}

// Scenario 32: Tampered originalReceiptPath in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.originalReceiptPath = 'docs/07_verification/other-receipt.json';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /originalReceiptPath/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered originalReceiptPath in attestation fails closed');
}

// Scenario 33: Tampered originalReceiptAppliedAt in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.originalReceiptAppliedAt = '2026-10-12T00:00:00Z';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /originalReceiptAppliedAt/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered originalReceiptAppliedAt in attestation fails closed');
}

// Scenario 34: Tampered mergedPullRequest in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.mergedPullRequest = 999;
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /mergedPullRequest/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered mergedPullRequest in attestation fails closed');
}

// Scenario 35: Tampered mergeTimestamp in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.mergeTimestamp = '2026-10-11T12:00:00Z';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /mergeTimestamp/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered mergeTimestamp in attestation fails closed');
}

// Scenario 36: Tampered approvalTimestamp in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.approvalTimestamp = '2026-10-11T12:00:00Z';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /approvalTimestamp/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered approvalTimestamp in attestation fails closed');
}

// Scenario 37: Tampered approvalDecision in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.approvalDecision = 'REJECT';
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /approvalDecision/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered approvalDecision in attestation fails closed');
}

// Scenario 38: Tampered retrospectiveIntervalSeconds in attestation fails closed
{
  const bad = clone(rawAttestation);
  bad.retrospectiveIntervalSeconds = 0;
  const res = verifyDmk197Closure({
    workspaceRoot: root,
    customAttestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /retrospectiveIntervalSeconds/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Tampered retrospectiveIntervalSeconds in attestation fails closed');
}

// Scenario 39: Missing projectId fails closed in verifyDmk196Closure
{
  const bad = clone(rawAttestation);
  delete bad.projectId;
  const res = verifyDmk196Closure({
    workspaceRoot: root,
    customDmk197Attestation: bad,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: string) => /projectId/i.test(e)), `Unexpected errors: ${res.errors}`);
  pass('Missing projectId fails closed in verifyDmk196Closure');
}

// Scenario 40: Missing projectId fails closed in verifyDmk208StatusAudit
{
  const bad = clone(rawAttestation);
  delete bad.projectId;
  assert.throws(
    () => {
      verifyDmk208StatusAudit(root, undefined, undefined, {
        customDmk197Attestation: bad,
      });
    },
    /projectId/i,
    'Scenario 40 failed: should throw on missing projectId'
  );
  pass('Missing projectId fails closed in verifyDmk208StatusAudit');
}

console.log('\n================================================================');
console.log(`TOTAL ATTESTATION TESTS: ${passedCount} | PASSED: ${passedCount} | FAILED: 0`);
console.log('================================================================\n');

