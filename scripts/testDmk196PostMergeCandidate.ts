import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import {
  verifyDmk196PostMergeCandidate,
  EXPECTED_WORK_ITEM_ID,
  EXPECTED_FROM_STATUS,
  EXPECTED_CANDIDATE_STATUS,
  EXPECTED_MERGED_PR,
  EXPECTED_PR_HEAD_SHA,
  EXPECTED_MERGE_COMMIT_SHA,
  EXPECTED_MASTER_CI_RUN_ID,
  EXPECTED_PRE_VERIFICATION_WBS_SHA256,
} from './verifyDmk196PostMergeCandidate.ts';

const root = process.cwd();
const liveCandidatePath = path.join(root, 'docs', '07_verification', 'dmk-196-post-merge-verification-candidate.json');
const livePostMergeReceiptPath = path.join(root, 'docs', '07_verification', 'dmk-196-post-merge-verification-receipt.json');
const rawCandidate = JSON.parse(fs.readFileSync(liveCandidatePath, 'utf8'));
const rawPostMergeReceipt = JSON.parse(fs.readFileSync(livePostMergeReceiptPath, 'utf8'));

console.log('================================================================');
console.log('   DMK-196 POST-MERGE TECHNICAL VERIFICATION CANDIDATE SUITE');
console.log('   Evaluates Invariant: Fail-closed enforcement on candidate & WBS');
console.log('   Coverage: Scenarios A through AL (Negative & positive boundary checks)');
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

// Helper for generating custom WBS YAML
function createCustomWbs(modifier: (doc: any) => void): string {
  const wbsPath = path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml');
  const doc = YAML.parse(fs.readFileSync(wbsPath, 'utf8'));
  modifier(doc);
  return YAML.stringify(doc);
}

function findWbsItem(items: any[], id: string): any {
  for (const item of items || []) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findWbsItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Scenario A: Exact live candidate passes
try {
  const res = verifyDmk196PostMergeCandidate();
  assert.equal(res.valid, true, `Scenario A expected valid=true, got errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  pass('A: Exact candidate passes');
} catch (err) {
  fail('A: Exact candidate passes', err);
}

// Scenario B: Wrong WorkItem fails
try {
  const bad = clone(rawCandidate);
  bad.workItemId = 'DMK-999';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes(`candidate.workItemId must be "${EXPECTED_WORK_ITEM_ID}"`)));
  pass('B: Wrong WorkItem fails');
} catch (err) {
  fail('B: Wrong WorkItem fails', err);
}

// Scenario C: Wrong source status fails
try {
  const bad = clone(rawCandidate);
  bad.fromStatus = 'IN_PROGRESS';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes(`candidate.fromStatus must be "${EXPECTED_FROM_STATUS}"`)));
  pass('C: Wrong source status fails');
} catch (err) {
  fail('C: Wrong source status fails', err);
}

// Scenario D: Wrong candidate status fails
try {
  const bad = clone(rawCandidate);
  bad.candidateStatus = 'IN_PROGRESS';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes(`candidate.candidateStatus must be "${EXPECTED_CANDIDATE_STATUS}"`)));
  pass('D: Wrong candidate status fails');
} catch (err) {
  fail('D: Wrong candidate status fails', err);
}

// Scenario E: Wrong PR number fails
try {
  const bad = clone(rawCandidate);
  bad.mergedPullRequest = 23;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes(`candidate.mergedPullRequest must be ${EXPECTED_MERGED_PR}`)));
  pass('E: Wrong PR number fails');
} catch (err) {
  fail('E: Wrong PR number fails', err);
}

// Scenario F: Wrong PR head fails
try {
  const bad = clone(rawCandidate);
  bad.prHeadSha = '0000000000000000000000000000000000000000';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes(`candidate.prHeadSha must match ${EXPECTED_PR_HEAD_SHA}`)));
  pass('F: Wrong PR head fails');
} catch (err) {
  fail('F: Wrong PR head fails', err);
}

// Scenario G: Wrong merge/master SHA fails
try {
  const bad = clone(rawCandidate);
  bad.mergeCommitSha = '0000000000000000000000000000000000000000';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes(`candidate.mergeCommitSha must match ${EXPECTED_MERGE_COMMIT_SHA}`)));
  pass('G: Wrong merge/master SHA fails');
} catch (err) {
  fail('G: Wrong merge/master SHA fails', err);
}

// Scenario H: Wrong CI run fails
try {
  const bad = clone(rawCandidate);
  bad.masterCiRunId = 12345;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes(`candidate.masterCiRunId must be ${EXPECTED_MASTER_CI_RUN_ID}`)));
  pass('H: Wrong CI run fails');
} catch (err) {
  fail('H: Wrong CI run fails', err);
}

// Scenario I: CI conclusion failure fails
try {
  const bad = clone(rawCandidate);
  bad.masterCiConclusion = 'failure';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.masterCiConclusion must be "success"')));
  pass('I: CI conclusion failure fails');
} catch (err) {
  fail('I: CI conclusion failure fails', err);
}

// Scenario J: Invalid closure receipt fails
try {
  const res = verifyDmk196PostMergeCandidate({ customClosureReceipt: { invalidReceipt: true } });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('closure receipt invalid')));
  pass('J: Invalid closure receipt fails');
} catch (err) {
  fail('J: Invalid closure receipt fails', err);
}

// Scenario K: WBS digest mismatch fails
try {
  const bad = clone(rawCandidate);
  bad.preVerificationCanonicalWbsSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('preVerificationCanonicalWbsSha256 must match') || e.includes('WBS digest mismatch')));
  pass('K: WBS digest mismatch fails');
} catch (err) {
  fail('K: WBS digest mismatch fails', err);
}

// Scenario L: DMK-197 drift fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-197');
    if (it) it.status = 'VERIFIED';
  });
  const res = verifyDmk196PostMergeCandidate({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-197 status must remain "IN_PROGRESS"')));
  pass('L: DMK-197 drift fails');
} catch (err) {
  fail('L: DMK-197 drift fails', err);
}

// Scenario M: DMK-198 drift fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-198');
    if (it) it.status = 'BACKLOG';
  });
  const res = verifyDmk196PostMergeCandidate({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-198 status must remain "IN_PROGRESS"')));
  pass('M: DMK-198 drift fails');
} catch (err) {
  fail('M: DMK-198 drift fails', err);
}

// Scenario N: humanGovernanceStatus != PENDING_SIGNOFF fails
try {
  const bad = clone(rawCandidate);
  bad.humanGovernanceStatus = 'APPROVED';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.humanGovernanceStatus must be "PENDING_SIGNOFF"')));
  pass('N: humanGovernanceStatus != PENDING_SIGNOFF fails');
} catch (err) {
  fail('N: humanGovernanceStatus != PENDING_SIGNOFF fails', err);
}

// Scenario O: humanApprovedByPresent = true fails
try {
  const bad = clone(rawCandidate);
  bad.humanApprovedByPresent = true;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.humanApprovedByPresent must be false')));
  pass('O: humanApprovedByPresent = true fails');
} catch (err) {
  fail('O: humanApprovedByPresent = true fails', err);
}

// Scenario P: expected blocker count != 11 fails
try {
  const bad = clone(rawCandidate);
  bad.expectedReconciliationBlockerCountIfApplied = 10;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.expectedReconciliationBlockerCountIfApplied must be 11')));
  pass('P: expected blocker count != 11 fails');
} catch (err) {
  fail('P: expected blocker count != 11 fails', err);
}

// Scenario Q: live reconciliation true fails
try {
  const bad = clone(rawCandidate);
  bad.liveReconciliationExecuted = true;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.liveReconciliationExecuted must be false')));
  pass('Q: live reconciliation true fails');
} catch (err) {
  fail('Q: live reconciliation true fails', err);
}

// Scenario R: runtime mutation count > 0 fails
try {
  const bad = clone(rawCandidate);
  bad.runtimeWorkItemMutationCount = 1;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.runtimeWorkItemMutationCount must be 0')));
  pass('R: runtime mutation count > 0 fails');
} catch (err) {
  fail('R: runtime mutation count > 0 fails', err);
}

// Scenario S: Gate 7 changed fails
try {
  const bad = clone(rawCandidate);
  bad.gate7Changed = true;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.gate7Changed must be false')));
  pass('S: Gate 7 changed fails');
} catch (err) {
  fail('S: Gate 7 changed fails', err);
}

// Scenario T: release changed fails
try {
  const bad = clone(rawCandidate);
  bad.releaseChanged = true;
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: true });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.releaseChanged must be false')));
  pass('T: release changed fails');
} catch (err) {
  fail('T: release changed fails', err);
}

// Scenario U: candidate digest tampering fails
try {
  const bad = clone(rawCandidate);
  bad.candidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk196PostMergeCandidate({ customCandidate: bad, skipDigestCheck: false });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.candidateDigest mismatch')));
  pass('U: candidate digest tampering fails');
} catch (err) {
  fail('U: candidate digest tampering fails', err);
}

// Scenario V: Live post-apply state passes in POST_APPLY_VERIFIED mode
try {
  const res = verifyDmk196PostMergeCandidate({ mode: 'POST_APPLY_VERIFIED' });
  assert.equal(res.valid, true, `Scenario V expected valid=true, got errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  assert.equal(res.mode, 'POST_APPLY_VERIFIED');
  pass('V: Live post-apply state passes in POST_APPLY_VERIFIED mode');
} catch (err) {
  fail('V: Live post-apply state passes in POST_APPLY_VERIFIED mode', err);
}

// Scenario W: Missing post-merge application receipt fails
try {
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: { invalidReceipt: true },
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('post-merge verification receipt invalid')));
  pass('W: Missing/invalid post-merge application receipt fails');
} catch (err) {
  fail('W: Missing/invalid post-merge application receipt fails', err);
}

// Scenario X: Wrong candidateDigest in receipt fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.candidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.candidateDigest must match') || e.includes('candidateDigest mismatch')));
  pass('X: Wrong candidateDigest in receipt fails');
} catch (err) {
  fail('X: Wrong candidateDigest in receipt fails', err);
}

// Scenario Y: Receipt fromStatus/toStatus mismatch fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.toStatus = 'VERIFICATION_PENDING';
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.toStatus must be "VERIFIED"')));
  pass('Y: Source/target status mismatch fails');
} catch (err) {
  fail('Y: Source/target status mismatch fails', err);
}

// Scenario Z: Receipt applied=false fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.applied = false;
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.applied must be true')));
  pass('Z: Receipt applied=false fails');
} catch (err) {
  fail('Z: Receipt applied=false fails', err);
}

// Scenario AA: Missing or wrong verification_status in WBS fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-196');
    if (it) it.verification_status = 'PENDING';
  });
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customWbsYamlContent: customWbs,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-196 verification_status must be "VERIFIED"')));
  pass('AA: Missing or wrong verification_status in WBS fails');
} catch (err) {
  fail('AA: Missing or wrong verification_status in WBS fails', err);
}

// Scenario AB: Missing or mismatched verified_by in WBS fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-196');
    if (it) it.verified_by = 'Wrong verifier string';
  });
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customWbsYamlContent: customWbs,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-196 verified_by mismatch')));
  pass('AB: Missing or mismatched verified_by in WBS fails');
} catch (err) {
  fail('AB: Missing or mismatched verified_by in WBS fails', err);
}

// Scenario AC: Missing evidence files in WBS fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-196');
    if (it) it.evidence = ['docs/07_verification/DMK_196_FORMAL_REQUIREMENT_SIGNOFF_VERIFICATION.md'];
  });
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customWbsYamlContent: customWbs,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-196 evidence must contain')));
  pass('AC: Missing evidence files in WBS fails');
} catch (err) {
  fail('AC: Missing evidence files in WBS fails', err);
}

// Scenario AD: Completed human_approved_by present in WBS fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-196');
    if (it) it.human_approved_by = 'Gio / Authorized Human Operator';
  });
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customWbsYamlContent: customWbs,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-196 human_approved_by must remain absent or pending')));
  pass('AD: Completed human_approved_by present in WBS fails');
} catch (err) {
  fail('AD: Completed human_approved_by present in WBS fails', err);
}

// Scenario AE: humanGovernanceStatus != PENDING_SIGNOFF in receipt fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.humanGovernanceStatus = 'APPROVED';
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.humanGovernanceStatus must be "PENDING_SIGNOFF"')));
  pass('AE: Receipt humanGovernanceStatus != PENDING_SIGNOFF fails');
} catch (err) {
  fail('AE: Receipt humanGovernanceStatus != PENDING_SIGNOFF fails', err);
}

// Scenario AF: expected blocker count != 11 in receipt fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.reconciliationBlockerCountAfter = 10;
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.reconciliationBlockerCountAfter must be 11')));
  pass('AF: Receipt reconciliationBlockerCountAfter != 11 fails');
} catch (err) {
  fail('AF: Receipt reconciliationBlockerCountAfter != 11 fails', err);
}

// Scenario AG: runtime mutation count > 0 in receipt fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.runtimeWorkItemMutationCount = 1;
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.runtimeWorkItemMutationCount must be 0')));
  pass('AG: Receipt runtime mutation count > 0 fails');
} catch (err) {
  fail('AG: Receipt runtime mutation count > 0 fails', err);
}

// Scenario AH: live reconciliation true in receipt fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.liveReconciliationExecuted = true;
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.liveReconciliationExecuted must be false')));
  pass('AH: Receipt live reconciliation true fails');
} catch (err) {
  fail('AH: Receipt live reconciliation true fails', err);
}

// Scenario AI: Gate 7 changed in receipt fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.gate7Changed = true;
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.gate7Changed must be false')));
  pass('AI: Receipt Gate 7 changed fails');
} catch (err) {
  fail('AI: Receipt Gate 7 changed fails', err);
}

// Scenario AJ: release changed in receipt fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.releaseChanged = true;
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.releaseChanged must be false')));
  pass('AJ: Receipt release changed fails');
} catch (err) {
  fail('AJ: Receipt release changed fails', err);
}

// Scenario AK: WBS digest mismatch against receipt postApplyCanonicalWbsSha256 fails
try {
  const badReceipt = clone(rawPostMergeReceipt);
  badReceipt.postApplyCanonicalWbsSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customPostMergeReceipt: badReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('postApplyCanonicalWbsSha256') || e.includes('WBS digest mismatch')));
  pass('AK: WBS digest mismatch against receipt postApplyCanonicalWbsSha256 fails');
} catch (err) {
  fail('AK: WBS digest mismatch against receipt postApplyCanonicalWbsSha256 fails', err);
}

// Scenario AL: Candidate digest tampering fails in POST_APPLY_VERIFIED mode
try {
  const badCandidate = clone(rawCandidate);
  badCandidate.candidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk196PostMergeCandidate({
    mode: 'POST_APPLY_VERIFIED',
    customCandidate: badCandidate,
    skipDigestCheck: false,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('candidate.candidateDigest mismatch')));
  pass('AL: Candidate digest tampering fails in POST_APPLY_VERIFIED mode');
} catch (err) {
  fail('AL: Candidate digest tampering fails in POST_APPLY_VERIFIED mode', err);
}

// Current-state evidence cannot be replaced by a historical test override.
{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wbs-boundary-'));
  try {
    fs.cpSync(path.join(root, 'docs'), path.join(temp, 'docs'), { recursive: true });
    for (const name of ['src', 'server', 'scripts', 'server.ts']) fs.cpSync(path.join(root, name), path.join(temp, name), { recursive: true });
    const wbsPath = path.join(temp, 'docs/00_control/MASTER_WBS.yaml');
    const original = fs.readFileSync(wbsPath, 'utf8');
    const baseline = verifyDmk196PostMergeCandidate({ workspaceRoot: temp });
    assert.equal(baseline.valid, true, baseline.errors.join('; '));
    assert.equal((baseline as any).historicalValid, true);
    assert.equal((baseline as any).mayApply, false);
    fs.appendFileSync(wbsPath, '\n# ungoverned successor\n');
    const result = verifyDmk196PostMergeCandidate({ workspaceRoot: temp, customWbsYamlContent: original, skipDigestCheck: true, mode: 'POST_APPLY_VERIFIED' });
    assert.equal(result.valid, false);
    assert.equal((result as any).historicalValid, true);
    assert.equal((result as any).currentForwardChainValid, false);
    fs.appendFileSync(path.join(temp, 'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml'), ' ');
    assert.equal((verifyDmk196PostMergeCandidate({ workspaceRoot: temp, customWbsYamlContent: original }) as any).historicalValid, false);
    pass('Historical/current separation rejects ungoverned bytes and snapshot tampering');
  } catch (err) { fail('Historical/current separation', err); }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
console.log('\n================================================================');
console.log(`TOTAL SCENARIOS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
