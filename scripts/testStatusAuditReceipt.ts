import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  verifyDmk208StatusAudit,
  computeCandidateDigest,
  type Dmk208StatusAuditCandidate,
  type Dmk208StatusAuditReceipt,
  type Dmk208ClosureReceipt,
} from './verifyDmk208StatusAudit.ts';

const workspaceRoot = process.cwd();
const liveCandidatePath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-candidate.json');
const liveAppReceiptPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-approval-receipt.json');
const liveClosureReceiptPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-closure-transition-receipt.json');

const rawCandidate: Dmk208StatusAuditCandidate = JSON.parse(fs.readFileSync(liveCandidatePath, 'utf8'));
const rawAppReceipt: Dmk208StatusAuditReceipt = JSON.parse(fs.readFileSync(liveAppReceiptPath, 'utf8'));
const rawClosureReceipt: Dmk208ClosureReceipt = JSON.parse(fs.readFileSync(liveClosureReceiptPath, 'utf8'));

console.log('--- Running Status Audit & Closure Receipt Test Suite (Scenarios A - X) ---');

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ==========================================
// Part 1: Application Receipt Scenarios A - L
// ==========================================

// Scenario A: POST_APPLY_APPROVED contract verification (with DMK-208 simulated in_progress)
{
  const res = verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
    forceMode: 'POST_APPLY_APPROVED',
    simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-199': 'IN_PROGRESS', 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-191': 'IN_PROGRESS', 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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
        simulateStatusOverrides: { 'DMK-208': 'IN_PROGRESS' },
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

// Scenario M: Exact closure receipt passes (live state default)
{
  const res = verifyDmk208StatusAudit(workspaceRoot);
  assert.equal(res.valid, true, 'Scenario M failed: valid must be true');
  assert.equal(res.mode, 'POST_CLOSURE_APPROVED', 'Scenario M failed: mode must be POST_CLOSURE_APPROVED');
  assert.equal(res.summary.keep, 24, 'Scenario M failed: keep count must be 24');
  assert.equal(res.summary.transition, 3, 'Scenario M failed: transition count must be 3');
  console.log('✓ [Scenario M] Exact closure receipt passes in live POST_CLOSURE_APPROVED mode.');
}

// Scenario N: Wrong DMK-208 source status fails
{
  const badClosure = clone(rawClosureReceipt);
  badClosure.fromStatus = 'BACKLOG';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
        simulateStatusOverrides: { 'DMK-196': 'BACKLOG' },
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customClosureReceipt: badClosure });
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
      // In POST_APPLY_APPROVED mode without closure receipt, DMK-208 in WBS is VERIFICATION_PENDING while candidate currentStatus is IN_PROGRESS
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { forceMode: 'POST_APPLY_APPROVED' });
    },
    /postApplyCanonicalWbsSha256 mismatch|KEEP item drift: Item DMK-208 status mismatch/i,
    'Scenario X failed'
  );
  console.log('✓ [Scenario X] Missing closure receipt fails when in closure state.');
}

console.log('--- All 24 Status Audit & Closure Scenarios (A - X) Passed! ---');
