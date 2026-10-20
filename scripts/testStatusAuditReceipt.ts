import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {
  verifyDmk208StatusAudit,
  computeCandidateDigest,
  type Dmk208StatusAuditCandidate,
  type Dmk208StatusAuditReceipt,
  type Dmk208ClosureReceipt,
  type Dmk208PostMergeVerificationReceipt,
} from './verifyDmk208StatusAudit.ts';

const workspaceRoot = process.cwd();
const liveCandidatePath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-candidate.json');
const liveAppReceiptPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-approval-receipt.json');
const liveClosureReceiptPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-closure-transition-receipt.json');
const livePostMergeReceiptPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-post-merge-verification-receipt.json');
const liveDmk196PostMergeReceiptPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-196-post-merge-verification-receipt.json');

const rawCandidate: Dmk208StatusAuditCandidate = JSON.parse(fs.readFileSync(liveCandidatePath, 'utf8'));
const rawAppReceipt: Dmk208StatusAuditReceipt = JSON.parse(fs.readFileSync(liveAppReceiptPath, 'utf8'));
const rawClosureReceipt: Dmk208ClosureReceipt = JSON.parse(fs.readFileSync(liveClosureReceiptPath, 'utf8'));
const rawPostMergeReceipt: Dmk208PostMergeVerificationReceipt = JSON.parse(fs.readFileSync(livePostMergeReceiptPath, 'utf8'));
const rawDmk196PostMergeReceipt = JSON.parse(fs.readFileSync(liveDmk196PostMergeReceiptPath, 'utf8'));

console.log('--- Running Status Audit & Closure Receipt Test Suite (Scenarios A - BD) ---');

for (const mode of ['PRE_APPLY', 'POST_APPLY_APPROVED', 'POST_CLOSURE_APPROVED'] as const) {
  const result = verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { forceMode: mode });
  assert.equal(result.valid, true);
  assert.equal(result.historicalValid, true);
  assert.equal(result.currentForwardChainValid, true);
  assert.equal(result.summary.total, 27);
  assert.equal(result.mayApply, false);
  console.log('PASS exact pinned earlier DMK-208 view: ' + mode);
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const historicalPostApplyOverrides = { 'DMK-196': 'IN_PROGRESS', 'DMK-197': 'IN_PROGRESS', 'DMK-208': 'IN_PROGRESS' };
const historicalPostClosureOverrides = { 'DMK-196': 'IN_PROGRESS', 'DMK-197': 'IN_PROGRESS', 'DMK-208': 'VERIFICATION_PENDING' };

// ==========================================
// Part 1: Application Receipt Scenarios A - L
// ==========================================

// Scenario A: POST_APPLY_APPROVED contract verification (with DMK-208 simulated in_progress)
{
  const res = verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
    forceMode: 'POST_APPLY_APPROVED',
    simulateStatusOverrides: historicalPostApplyOverrides,
  });
  assert.equal(res.valid, true, 'Scenario A failed: valid must be true');
  assert.equal(res.mode, 'POST_APPLY_APPROVED', 'Scenario A failed: mode must be POST_APPLY_APPROVED');
  assert.equal(res.summary.keep, 24, 'Scenario A failed: keep count must be 24');
  assert.equal(res.summary.transition, 3, 'Scenario A failed: transition count must be 3');
  console.log('✓ [Scenario A] Exact approved candidate receipt passes in POST_APPLY_APPROVED mode.');
}

// Scenario B: Wrong candidate digest in application receipt fails
{
  const badReceipt = clone(rawAppReceipt);
  badReceipt.candidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customReceipt: badReceipt,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /candidateDigest mismatch/i,
    'Scenario B failed'
  );
  console.log('✓ [Scenario B] Wrong candidate digest fails.');
}

// Scenario C: Missing transition fails
{
  const badReceipt = clone(rawAppReceipt);
  badReceipt.approvedTransitions = badReceipt.approvedTransitions.slice(0, 2);
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customReceipt: badReceipt,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /transition count mismatch|missing approved transition/i,
    'Scenario C failed'
  );
  console.log('✓ [Scenario C] Missing transition fails.');
}

// Scenario D: Extra transition fails
{
  const badReceipt = clone(rawAppReceipt);
  badReceipt.approvedTransitions.push({
    id: 'DMK-199',
    from: 'BACKLOG',
    to: 'IN_PROGRESS',
  });
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customReceipt: badReceipt,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /transition count mismatch|extra approved transition/i,
    'Scenario D failed'
  );
  console.log('✓ [Scenario D] Extra transition fails.');
}

// Scenario E: Wrong source status fails
{
  const badReceipt = clone(rawAppReceipt);
  badReceipt.approvedTransitions[0] = {
    id: 'DMK-196',
    from: 'READY',
    to: 'IN_PROGRESS',
  };
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customReceipt: badReceipt,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /source status mismatch/i,
    'Scenario E failed'
  );
  console.log('✓ [Scenario E] Wrong source status fails.');
}

// Scenario F: Wrong target status fails
{
  const badReceipt = clone(rawAppReceipt);
  badReceipt.approvedTransitions[0] = {
    id: 'DMK-196',
    from: 'BACKLOG',
    to: 'VERIFIED',
  };
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customReceipt: badReceipt,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /target status mismatch/i,
    'Scenario F failed'
  );
  console.log('✓ [Scenario F] Wrong target status fails.');
}

// Scenario G: Wrong pre-apply WBS digest fails
{
  const badReceipt = clone(rawAppReceipt);
  badReceipt.preApplyCanonicalWbsSha256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customReceipt: badReceipt,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /pre-apply WBS digest mismatch/i,
    'Scenario G failed'
  );
  console.log('✓ [Scenario G] Wrong pre-apply WBS digest fails.');
}

// Scenario H: Unapproved fourth status mutation fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        simulateStatusOverrides: { ...historicalPostApplyOverrides, 'DMK-199': 'IN_PROGRESS' },
      });
    },
    /KEEP item drift|status mismatch/i,
    'Scenario H failed'
  );
  console.log('✓ [Scenario H] Unapproved fourth status mutation fails.');
}

// Scenario I: Candidate JSON mutation invalidates digest
{
  const badCandidate = clone(rawCandidate);
  badCandidate.items[0].rationale += ' (tampered)';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customCandidate: badCandidate,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /candidateDigest mismatch/i,
    'Scenario I failed'
  );
  console.log('✓ [Scenario I] Candidate JSON mutation invalidates digest.');
}

// Scenario J: KEEP item drift fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        simulateStatusOverrides: { ...historicalPostApplyOverrides, 'DMK-191': 'IN_PROGRESS' },
      });
    },
    /KEEP item drift|status mismatch/i,
    'Scenario J failed'
  );
  console.log('✓ [Scenario J] KEEP item drift fails.');
}

// Scenario K: Candidate scope other than 27 fails
{
  const badCandidate = clone(rawCandidate);
  badCandidate.items = badCandidate.items.slice(0, 26);
  badCandidate.scopeCount = 26;
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customCandidate: badCandidate,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /Invalid scopeCount/i,
    'Scenario K failed'
  );
  console.log('✓ [Scenario K] Candidate scope other than 27 fails.');
}

// Scenario L: Decision other than APPROVE cannot authorize application
{
  const badReceipt = clone(rawAppReceipt);
  badReceipt.decision = 'REJECT';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        customReceipt: badReceipt,
        simulateStatusOverrides: historicalPostApplyOverrides,
      });
    },
    /decision other than APPROVE cannot authorize application/i,
    'Scenario L failed'
  );
  console.log('✓ [Scenario L] Decision other than APPROVE cannot authorize application.');
}

// ==========================================
// Part 2: Closure Receipt Scenarios M - X
// ==========================================

// Scenario M: Exact closure receipt passes in POST_CLOSURE_APPROVED mode
{
  const res = verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
    forceMode: 'POST_CLOSURE_APPROVED',
    simulateStatusOverrides: historicalPostClosureOverrides,
  });
  assert.equal(res.valid, true, 'Scenario M failed: valid must be true');
  assert.equal(res.mode, 'POST_CLOSURE_APPROVED', 'Scenario M failed: mode must be POST_CLOSURE_APPROVED');
  assert.equal(res.summary.keep, 24, 'Scenario M failed: keep count must be 24');
  assert.equal(res.summary.transition, 3, 'Scenario M failed: transition count must be 3');
  console.log('✓ [Scenario M] Exact closure receipt passes in POST_CLOSURE_APPROVED mode.');
}

// Scenario N: Wrong DMK-208 source status fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.fromStatus = 'BACKLOG';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /closure receipt source status mismatch/i,
    'Scenario N failed'
  );
  console.log('✓ [Scenario N] Wrong DMK-208 source status fails.');
}

// Scenario O: Wrong DMK-208 target status fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.toStatus = 'IMPLEMENTED';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /closure receipt target status mismatch/i,
    'Scenario O failed'
  );
  console.log('✓ [Scenario O] Wrong DMK-208 target status fails.');
}

// Scenario P: Wrong candidate digest fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.approvedCandidateDigest = '1111111111111111111111111111111111111111111111111111111111111111';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /closure receipt candidateDigest mismatch/i,
    'Scenario P failed'
  );
  console.log('✓ [Scenario P] Wrong candidate digest fails.');
}

// Scenario Q: Wrong audit-application receipt linkage fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.statusAuditApplicationReceipt = 'docs/07_verification/wrong-receipt.json';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /closure receipt statusAuditApplicationReceipt linkage mismatch/i,
    'Scenario Q failed'
  );
  console.log('✓ [Scenario Q] Wrong audit-application receipt linkage fails.');
}

// Scenario R: Wrong pre-closure WBS digest fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.preClosureCanonicalWbsSha256 = '2222222222222222222222222222222222222222222222222222222222222222';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /closure receipt preClosureCanonicalWbsSha256 mismatch/i,
    'Scenario R failed'
  );
  console.log('✓ [Scenario R] Wrong pre-closure WBS digest fails.');
}

// Scenario S: Wrong post-closure WBS digest fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.postClosureCanonicalWbsSha256 = '3333333333333333333333333333333333333333333333333333333333333333';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /postClosureCanonicalWbsSha256 mismatch/i,
    'Scenario S failed'
  );
  console.log('✓ [Scenario S] Wrong post-closure WBS digest fails.');
}

// Scenario T: Another WorkItem included in closure receipt fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.workItemId = 'DMK-206';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /closure receipt workItemId mismatch/i,
    'Scenario T failed'
  );
  console.log('✓ [Scenario T] Another WorkItem included in closure receipt fails.');
}

// Scenario U: DMK-196/197/198 post-application drift fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        simulateStatusOverrides: { 'DMK-208': 'VERIFICATION_PENDING', 'DMK-196': 'BACKLOG' },
      });
    },
    /TRANSITION item DMK-196 status mismatch/i,
    'Scenario U failed'
  );
  console.log('✓ [Scenario U] DMK-196/197/198 post-application drift fails.');
}

// Scenario V: Closure decision other than APPROVE fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.decision = 'REJECT';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /decision other than APPROVE cannot authorize closure/i,
    'Scenario V failed'
  );
  console.log('✓ [Scenario V] Closure decision other than APPROVE fails.');
}

// Scenario W: DMK-208 VERIFIED target fails because only VERIFICATION_PENDING is authorized
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.toStatus = 'VERIFIED';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_CLOSURE_APPROVED',
        customClosureReceipt: badClosure,
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /closure receipt target status mismatch/i,
    'Scenario W failed'
  );
  console.log('✓ [Scenario W] DMK-208 VERIFIED target fails.');
}

// Scenario X: Missing closure receipt fails when in closure state
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        forceMode: 'POST_APPLY_APPROVED',
        simulateStatusOverrides: historicalPostClosureOverrides,
      });
    },
    /postApplyCanonicalWbsSha256 mismatch|KEEP item drift: Item DMK-208 status mismatch/i,
    'Scenario X failed'
  );
  console.log('✓ [Scenario X] Missing closure receipt fails when in closure state.');
}

// ==========================================
// Part 3: Post-Merge Verification Scenarios Y - AO
// ==========================================

// Scenario Y: Exact post-merge verification receipt passes (live state default)
{
  const res = verifyDmk208StatusAudit(workspaceRoot);
  assert.equal(res.valid, true, 'Scenario Y failed: valid must be true');
  assert.equal(res.mode, 'POST_MERGE_VERIFIED', 'Scenario Y failed: mode must be POST_MERGE_VERIFIED');
  assert.equal(res.summary.keep, 24, 'Scenario Y failed: keep count must be 24');
  assert.equal(res.summary.transition, 3, 'Scenario Y failed: transition count must be 3');
  console.log('✓ [Scenario Y] Exact post-merge verification receipt passes in live POST_MERGE_VERIFIED mode.');
}

// Scenario Z: Wrong PR number fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.mergedPullRequest = 22;
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt mergedPullRequest mismatch/i,
    'Scenario Z failed'
  );
  console.log('✓ [Scenario Z] Wrong PR number fails.');
}

// Scenario AA: Wrong PR head SHA fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.prHeadSha = '0000000000000000000000000000000000000000';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt prHeadSha mismatch/i,
    'Scenario AA failed'
  );
  console.log('✓ [Scenario AA] Wrong PR head SHA fails.');
}

// Scenario AB: Wrong merge commit fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.mergeCommitSha = '1111111111111111111111111111111111111111';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt mergeCommitSha mismatch/i,
    'Scenario AB failed'
  );
  console.log('✓ [Scenario AB] Wrong merge commit fails.');
}

// Scenario AC: Wrong master SHA fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.masterShaAtVerification = '2222222222222222222222222222222222222222';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt masterShaAtVerification mismatch/i,
    'Scenario AC failed'
  );
  console.log('✓ [Scenario AC] Wrong master SHA fails.');
}

// Scenario AD: Wrong master CI run fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.masterCiRunId = 123456789;
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt masterCiRunId mismatch/i,
    'Scenario AD failed'
  );
  console.log('✓ [Scenario AD] Wrong master CI run fails.');
}

// Scenario AE: Non-success master CI conclusion fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.masterCiConclusion = 'failure';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt masterCiConclusion mismatch/i,
    'Scenario AE failed'
  );
  console.log('✓ [Scenario AE] Non-success master CI conclusion fails.');
}

// Scenario AF: Wrong source status fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.fromStatus = 'IN_PROGRESS';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt source status mismatch/i,
    'Scenario AF failed'
  );
  console.log('✓ [Scenario AF] Wrong source status fails.');
}

// Scenario AG: Wrong target status fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.toStatus = 'VERIFICATION_PENDING';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt target status mismatch/i,
    'Scenario AG failed'
  );
  console.log('✓ [Scenario AG] Wrong target status fails.');
}

// Scenario AH: Missing verification_status in WBS fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateCanonicalItemOverrides: { 'DMK-208': { verificationStatus: undefined } },
      });
    },
    /DMK-208 verificationStatus mismatch/i,
    'Scenario AH failed'
  );
  console.log('✓ [Scenario AH] Missing verification_status in WBS fails.');
}

// Scenario AI: Missing verified_by in WBS fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateCanonicalItemOverrides: { 'DMK-208': { verifiedBy: '' } },
      });
    },
    /DMK-208 verifiedBy must be non-empty/i,
    'Scenario AI failed'
  );
  console.log('✓ [Scenario AI] Missing verified_by in WBS fails.');
}

// Scenario AJ: Missing post-merge evidence in WBS fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateCanonicalItemOverrides: { 'DMK-208': { evidence: [] } },
      });
    },
    /DMK-208 evidence must contain post-merge receipt/i,
    'Scenario AJ failed'
  );
  console.log('✓ [Scenario AJ] Missing post-merge evidence in WBS fails.');
}

// Scenario AK: Unexpected completed human_approved_by fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateCanonicalItemOverrides: { 'DMK-208': { humanApprovedBy: 'Gio - Approved' } },
      });
    },
    /DMK-208 humanApprovedBy must be absent or pending/i,
    'Scenario AK failed'
  );
  console.log('✓ [Scenario AK] Unexpected completed human_approved_by fails.');
}

// Scenario AL: DMK-196 backward drift to BACKLOG fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-196': 'BACKLOG' },
      });
    },
    /TRANSITION item DMK-196 status mismatch/i,
    'Scenario AL failed'
  );
  console.log('✓ [Scenario AL] DMK-196 backward drift to BACKLOG fails.');
}

// Scenario AM: Wrong pre-verification WBS digest fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.preVerificationCanonicalWbsSha256 = '4444444444444444444444444444444444444444444444444444444444444444';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /preVerificationCanonicalWbsSha256 mismatch/i,
    'Scenario AM failed'
  );
  console.log('✓ [Scenario AM] Wrong pre-verification WBS digest fails.');
}

// Scenario AN: Wrong post-verification WBS digest fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.postVerificationCanonicalWbsSha256 = '5555555555555555555555555555555555555555555555555555555555555555';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /postVerificationCanonicalWbsSha256 mismatch/i,
    'Scenario AN failed'
  );
  console.log('✓ [Scenario AN] Wrong post-verification WBS digest fails.');
}

// Scenario AO: Target other than VERIFIED fails
{
  const badPm = clone(rawPostMergeReceipt);
  badPm.toStatus = 'IMPLEMENTED';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customPostMergeReceipt: badPm });
    },
    /post-merge receipt target status mismatch/i,
    'Scenario AO failed'
  );
  console.log('✓ [Scenario AO] Target other than VERIFIED fails.');
}


// Scenario AP: DMK-196 VERIFICATION_PENDING + valid DMK-196 closure receipt passes
{
  const res = verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
    simulateStatusOverrides: { 'DMK-196': 'VERIFICATION_PENDING' },
  });
  assert.equal(res.valid, true, 'Scenario AP failed: valid must be true');
  assert.equal(res.mode, 'POST_MERGE_VERIFIED', 'Scenario AP failed: mode must be POST_MERGE_VERIFIED');
  console.log('✓ [Scenario AP] DMK-196 VERIFICATION_PENDING with valid closure receipt passes.');
}

// Scenario AQ: DMK-196 VERIFICATION_PENDING with missing closure receipt fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-196': 'VERIFICATION_PENDING' },
        customDmk196ClosureReceipt: null,
      });
    },
    /closure receipt is missing/i,
    'Scenario AQ failed'
  );
  console.log('✓ [Scenario AQ] DMK-196 VERIFICATION_PENDING with missing closure receipt fails.');
}

// Scenario AR: DMK-196 VERIFICATION_PENDING with invalid closure receipt fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-196': 'VERIFICATION_PENDING' },
        customDmk196ClosureReceipt: {
          schemaVersion: '1.0',
          workItemId: 'DMK-196',
          decision: 'REJECT',
        },
      });
    },
    /DMK-196 closure receipt validation failed/i,
    'Scenario AR failed'
  );
  console.log('✓ [Scenario AR] DMK-196 VERIFICATION_PENDING with invalid closure receipt fails.');
}

// Scenario AS: DMK-196 VERIFIED without receipt fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-196': 'VERIFIED' },
        customDmk196PostMergeReceipt: null,
      });
    },
    /DMK-196 is in VERIFIED but post-merge verification receipt is missing/i,
    'Scenario AS failed'
  );
  console.log('✓ [Scenario AS] DMK-196 VERIFIED without post-merge receipt fails.');
}

// Scenario AT: DMK-197 VERIFICATION_PENDING with missing closure receipt fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-197': 'VERIFICATION_PENDING' },
        customDmk197ClosureReceipt: null,
      });
    },
    /closure receipt is missing/i,
    'Scenario AT failed'
  );
  console.log('✓ [Scenario AT] DMK-197 VERIFICATION_PENDING with missing closure receipt fails.');
}

// Scenario AU: DMK-197 VERIFIED fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-197': 'VERIFIED' },
      });
    },
    /TRANSITION item DMK-197 status mismatch/i,
    'Scenario AU failed'
  );
  console.log('✓ [Scenario AU] DMK-197 VERIFIED fails.');
}

// Scenario AV: DMK-198 VERIFICATION_PENDING fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-198': 'VERIFICATION_PENDING' },
      });
    },
    /TRANSITION item DMK-198 status mismatch/i,
    'Scenario AV failed'
  );
  console.log('✓ [Scenario AV] DMK-198 VERIFICATION_PENDING fails.');
}

// Scenario AW: DMK-198 VERIFIED fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-198': 'VERIFIED' },
      });
    },
    /TRANSITION item DMK-198 status mismatch/i,
    'Scenario AW failed'
  );
  console.log('✓ [Scenario AW] DMK-198 VERIFIED fails.');
}

// ==========================================
// Part 6: DMK-196 Post-Merge Scenarios AX - BD
// ==========================================

// Scenario AX: DMK-196 VERIFIED with valid post-merge verification receipt passes
{
  const res = verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
    forceMode: 'POST_MERGE_VERIFIED',
  });
  assert.equal(res.valid, true, 'Scenario AX failed: valid must be true');
  assert.equal(res.mode, 'POST_MERGE_VERIFIED', 'Scenario AX failed: mode must be POST_MERGE_VERIFIED');
  console.log('✓ [Scenario AX] DMK-196 VERIFIED with valid post-merge verification receipt passes.');
}

// Scenario AY: DMK-196 VERIFIED with invalid post-merge receipt fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        customDmk196PostMergeReceipt: { invalidReceipt: true },
      });
    },
    /DMK-196 post-merge verification receipt validation failed/i,
    'Scenario AY failed'
  );
  console.log('✓ [Scenario AY] DMK-196 VERIFIED with invalid post-merge receipt fails.');
}

// Scenario AZ: DMK-196 VERIFIED with tampered candidateDigest in post-merge receipt fails
{
  const badReceipt = clone(rawDmk196PostMergeReceipt);
  badReceipt.candidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        customDmk196PostMergeReceipt: badReceipt,
      });
    },
    /DMK-196 post-merge verification receipt validation failed/i,
    'Scenario AZ failed'
  );
  console.log('✓ [Scenario AZ] DMK-196 VERIFIED with tampered candidateDigest in post-merge receipt fails.');
}

// Scenario BA: DMK-196 VERIFIED with unauthorized completed human approval fails
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateCanonicalItemOverrides: {
          'DMK-196': { humanApprovedBy: 'Gio / Lead Architect - Approved' },
        },
      });
    },
    /DMK-196 has completed human approval without authorization/i,
    'Scenario BA failed'
  );
  console.log('✓ [Scenario BA] DMK-196 VERIFIED with unauthorized completed human approval fails.');
}

// Scenario BB: DMK-196 VERIFIED with wrong reconciliation blocker count in receipt fails
{
  const badReceipt = clone(rawDmk196PostMergeReceipt);
  badReceipt.reconciliationBlockerCountAfter = 10;
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        customDmk196PostMergeReceipt: badReceipt,
      });
    },
    /DMK-196 post-merge verification receipt validation failed/i,
    'Scenario BB failed'
  );
  console.log('✓ [Scenario BB] DMK-196 VERIFIED with wrong reconciliation blocker count in receipt fails.');
}

// Scenario BC: DMK-196 VERIFIED with runtime mutation count > 0 in receipt fails
{
  const badReceipt = clone(rawDmk196PostMergeReceipt);
  badReceipt.runtimeWorkItemMutationCount = 1;
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        customDmk196PostMergeReceipt: badReceipt,
      });
    },
    /DMK-196 post-merge verification receipt validation failed/i,
    'Scenario BC failed'
  );
  console.log('✓ [Scenario BC] DMK-196 VERIFIED with runtime mutation count > 0 in receipt fails.');
}

// Scenario BD: DMK-197 / DMK-198 drift still fail closed when DMK-196 is VERIFIED
{
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-197': 'VERIFIED' },
      });
    },
    /TRANSITION item DMK-197 status mismatch/i,
    'Scenario BD failed'
  );
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-198': 'VERIFIED' },
      });
    },
    /TRANSITION item DMK-198 status mismatch/i,
    'Scenario BD failed'
  );
  console.log('✓ [Scenario BD] DMK-197 / DMK-198 drift still fail closed when DMK-196 is VERIFIED.');
}

{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wbs-audit-boundary-'));
  try {
    for (const name of ['docs', 'src', 'server', 'scripts', 'server.ts']) fs.cpSync(path.join(workspaceRoot, name), path.join(temp, name), { recursive: true });
    const baseline = verifyDmk208StatusAudit(temp);
    assert.equal((baseline as any).historicalValid, true);
    assert.equal((baseline as any).mayApply, false);
    assert.equal(baseline.summary.total, 27);
    fs.appendFileSync(path.join(temp, 'docs/00_control/MASTER_WBS.yaml'), '\n# ungoverned successor\n');
    assert.throws(() => verifyDmk208StatusAudit(temp, undefined, undefined, {
      forceMode: 'POST_APPLY_APPROVED', simulateStatusOverrides: historicalPostApplyOverrides,
    }), (error: any) => {
      assert.equal(error.verification.historicalValid, true);
      assert.equal(error.verification.currentForwardChainValid, false);
      assert.equal(error.verification.mayApply, false);
      assert.equal(error.verification.summary.total, 27);
      return true;
    });
    console.log('PASS DMK-208 historical 27-item scope cannot bypass current-state evidence');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
console.log('--- All Status Audit & Post-Merge Closure Scenarios Passed! ---');
