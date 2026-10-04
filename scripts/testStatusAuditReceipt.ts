import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  verifyDmk208StatusAudit,
  computeCandidateDigest,
  type Dmk208StatusAuditCandidate,
  type Dmk208StatusAuditReceipt,
} from './verifyDmk208StatusAudit.ts';

const workspaceRoot = process.cwd();
const liveCandidatePath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-candidate.json');
const liveReceiptPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-approval-receipt.json');

const rawCandidate: Dmk208StatusAuditCandidate = JSON.parse(fs.readFileSync(liveCandidatePath, 'utf8'));
const rawReceipt: Dmk208StatusAuditReceipt = JSON.parse(fs.readFileSync(liveReceiptPath, 'utf8'));

console.log('--- Running Status Audit Receipt Test Suite (Scenarios A - L) ---');

// Helper to deep clone
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Scenario A: Exact approved candidate receipt passes
{
  const res = verifyDmk208StatusAudit(workspaceRoot);
  assert.equal(res.valid, true, 'Scenario A failed: valid must be true');
  assert.equal(res.mode, 'POST_APPLY_APPROVED', 'Scenario A failed: mode must be POST_APPLY_APPROVED');
  assert.equal(res.summary.keep, 24, 'Scenario A failed: keep count must be 24');
  assert.equal(res.summary.transition, 3, 'Scenario A failed: transition count must be 3');
  console.log('✓ [Scenario A] Exact approved candidate receipt passes.');
}

// Scenario B: Wrong candidate digest fails
{
  const badReceipt = clone(rawReceipt);
  badReceipt.candidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customReceipt: badReceipt });
    },
    /candidateDigest mismatch/i,
    'Scenario B failed: should throw on mismatched candidateDigest in receipt'
  );
  console.log('✓ [Scenario B] Wrong candidate digest fails.');
}

// Scenario C: Missing transition fails
{
  const badReceipt = clone(rawReceipt);
  badReceipt.approvedTransitions = badReceipt.approvedTransitions.slice(0, 2); // only 2 of 3
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customReceipt: badReceipt });
    },
    /transition count mismatch|missing approved transition/i,
    'Scenario C failed: should throw on missing approved transition'
  );
  console.log('✓ [Scenario C] Missing transition fails.');
}

// Scenario D: Extra transition fails
{
  const badReceipt = clone(rawReceipt);
  badReceipt.approvedTransitions.push({
    id: 'DMK-199',
    from: 'BACKLOG',
    to: 'IN_PROGRESS',
  });
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customReceipt: badReceipt });
    },
    /transition count mismatch|extra approved transition/i,
    'Scenario D failed: should throw on extra approved transition'
  );
  console.log('✓ [Scenario D] Extra transition fails.');
}

// Scenario E: Wrong source status fails
{
  const badReceipt = clone(rawReceipt);
  badReceipt.approvedTransitions[0] = {
    id: 'DMK-196',
    from: 'READY', // wrong source status, actual is BACKLOG
    to: 'IN_PROGRESS',
  };
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customReceipt: badReceipt });
    },
    /source status mismatch/i,
    'Scenario E failed: should throw on wrong source status'
  );
  console.log('✓ [Scenario E] Wrong source status fails.');
}

// Scenario F: Wrong target status fails
{
  const badReceipt = clone(rawReceipt);
  badReceipt.approvedTransitions[0] = {
    id: 'DMK-196',
    from: 'BACKLOG',
    to: 'VERIFIED', // wrong target status, approved is IN_PROGRESS
  };
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customReceipt: badReceipt });
    },
    /target status mismatch/i,
    'Scenario F failed: should throw on wrong target status'
  );
  console.log('✓ [Scenario F] Wrong target status fails.');
}

// Scenario G: Wrong pre-apply WBS digest fails
{
  const badReceipt = clone(rawReceipt);
  badReceipt.preApplyCanonicalWbsSha256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customReceipt: badReceipt });
    },
    /pre-apply WBS digest mismatch/i,
    'Scenario G failed: should throw on wrong pre-apply WBS digest'
  );
  console.log('✓ [Scenario G] Wrong pre-apply WBS digest fails.');
}

// Scenario H: Unapproved fourth status mutation fails
{
  // Simulate canonical WBS where a 4th item (e.g. DMK-199) also changed to IN_PROGRESS
  const modifiedItems = rawCandidate.items.map((it) => {
    return { ...it };
  });
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-199': 'IN_PROGRESS' },
      });
    },
    /unapproved status mutation|status mismatch/i,
    'Scenario H failed: should throw when an unapproved 4th status mutation is detected in canonical WBS'
  );
  console.log('✓ [Scenario H] Unapproved fourth status mutation fails.');
}

// Scenario I: Candidate JSON mutation invalidates digest
{
  const badCandidate = clone(rawCandidate);
  badCandidate.items[0].rationale += ' (tampered)';
  // declared digest remains old, so computeCandidateDigest(badCandidate.items) != badCandidate.candidateDigest
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customCandidate: badCandidate });
    },
    /candidateDigest mismatch/i,
    'Scenario I failed: should throw when candidate items are mutated'
  );
  console.log('✓ [Scenario I] Candidate JSON mutation invalidates digest.');
}

// Scenario J: KEEP item drift fails
{
  // A KEEP item (e.g. DMK-191) drifting in canonical WBS away from currentStatus
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, {
        simulateStatusOverrides: { 'DMK-191': 'IN_PROGRESS' },
      });
    },
    /KEEP item drift|status mismatch/i,
    'Scenario J failed: should throw when a KEEP item drifts in canonical WBS'
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
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customCandidate: badCandidate });
    },
    /Invalid scopeCount/i,
    'Scenario K failed: should throw when scopeCount is not 27'
  );
  console.log('✓ [Scenario K] Candidate scope other than 27 fails.');
}

// Scenario L: Decision other than APPROVE cannot authorize application
{
  const badReceipt = clone(rawReceipt);
  badReceipt.decision = 'REJECT';
  assert.throws(
    () => {
      verifyDmk208StatusAudit(workspaceRoot, undefined, undefined, { customReceipt: badReceipt });
    },
    /decision other than APPROVE cannot authorize application/i,
    'Scenario L failed: should throw when decision is not APPROVE'
  );
  console.log('✓ [Scenario L] Decision other than APPROVE cannot authorize application.');
}

console.log('--- All 12 Status Audit Receipt Scenarios (A - L) Passed! ---');
