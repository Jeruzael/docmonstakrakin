import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import {
  verifyDmk197Closure,
  validateDmk197ClosureReceipt,
  EXPECTED_WORK_ITEM_ID,
  EXPECTED_WBS_PATH,
  EXPECTED_DECISION,
  EXPECTED_FROM_STATUS,
  EXPECTED_TO_STATUS,
  EXPECTED_APPROVED_CANDIDATE_DIGEST,
  EXPECTED_IMPLEMENTATION_HEAD_SHA,
  EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256,
  EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256,
  RECEIPT_FILE_PATH,
} from './verifyDmk197Closure.ts';
import { verifyDmk197ClosureCandidate } from './verifyDmk197ClosureCandidate.ts';
import { verifyDmk196Closure } from './verifyDmk196Closure.ts';
import { verifyDmk196PostMergeCandidate } from './verifyDmk196PostMergeCandidate.ts';
import { verifyDmk208StatusAudit } from './verifyDmk208StatusAudit.ts';

const root = process.cwd();
const liveReceiptPath = path.join(root, RECEIPT_FILE_PATH);
const rawReceipt = JSON.parse(fs.readFileSync(liveReceiptPath, 'utf8'));

console.log('================================================================');
console.log('   DMK-197 CLOSURE TRANSITION VERIFIER REGRESSION SUITE');
console.log('   Evaluates Invariant: Fail-closed enforcement on closure receipt & WBS');
console.log('   Coverage: Scenarios 1 through 26 (Negative & positive boundary checks)');
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

function getPostApplyWbsYaml(): string {
  const current = fs.readFileSync(path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml'), 'utf8');
  const target = `    status: "IN_PROGRESS"
    dependencies: ["DMK-196"]
    requirements: ["REQ-GOV-QUORUM-001"]
    architecture_links: ["CMP-01", "CMP-04"]
    security_controls: ["SEC-CTRL-020"]
    acceptance_criteria:
      - "Distinct Security Officer and Lead Architect human identities required for quorum"
    verification_method: "Quorum verification test"
    evidence: []`;
  const rep = `    status: "VERIFICATION_PENDING"
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
  return current.includes(target) ? current.replace(target, rep) : current;
}
const postApplyWbsYaml = getPostApplyWbsYaml();

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

// Helper for generating custom WBS YAML
function createCustomWbs(modifier: (doc: any) => void): string {
  const doc = YAML.parse(postApplyWbsYaml);
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

// 1. Correct post-application WBS and receipt passes cleanly
try {
  const res = verifyDmk197Closure({ customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, true, `Scenario 1 expected valid=true, got errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  pass('1: Correct receipt and post-application WBS state passes');
} catch (err) {
  fail('1: Correct receipt and post-application WBS state passes', err);
}

// 2. Missing receipt fails closed
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-noreceipt-'));
  try {
    const res = verifyDmk197Closure({ workspaceRoot: tempDir });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Closure receipt does not exist')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('2: Missing receipt fails closed');
} catch (err) {
  fail('2: Missing receipt fails closed', err);
}

// 3. Malformed receipt JSON fails closed
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-badjson-'));
  try {
    const vDir = path.join(tempDir, 'docs', '07_verification');
    fs.mkdirSync(vDir, { recursive: true });
    fs.writeFileSync(path.join(vDir, 'dmk-197-closure-transition-receipt.json'), '{ not valid json');
    const res = verifyDmk197Closure({ workspaceRoot: tempDir });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Failed to parse closure receipt JSON')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('3: Malformed receipt JSON fails closed');
} catch (err) {
  fail('3: Malformed receipt JSON fails closed', err);
}

// 4. Wrong WorkItem ID fails closed
try {
  const bad = clone(rawReceipt);
  bad.workItemId = 'DMK-999';
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.workItemId must be "DMK-197"')));
  pass('4: Wrong WorkItem ID fails closed');
} catch (err) {
  fail('4: Wrong WorkItem ID fails closed', err);
}

// 5. Wrong source or target status fails closed
try {
  const bad1 = clone(rawReceipt);
  bad1.fromStatus = 'BACKLOG';
  const res1 = verifyDmk197Closure({ customReceipt: bad1, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.includes('receipt.fromStatus must be "IN_PROGRESS"')));

  const bad2 = clone(rawReceipt);
  bad2.toStatus = 'VERIFIED';
  const res2 = verifyDmk197Closure({ customReceipt: bad2, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some((e) => e.includes('receipt.toStatus must be "VERIFICATION_PENDING"')));

  pass('5: Wrong source or target status fails closed');
} catch (err) {
  fail('5: Wrong source or target status fails closed', err);
}

// 6. Wrong candidate digest fails closed
try {
  const bad = clone(rawReceipt);
  bad.approvedCandidateDigest = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('approvedCandidateDigest must match immutable candidate digest')));
  pass('6: Wrong candidate digest fails closed');
} catch (err) {
  fail('6: Wrong candidate digest fails closed', err);
}

// 7. Altered candidate contents fails closed
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-tampercand-'));
  try {
    const vDir = path.join(tempDir, 'docs', '07_verification');
    const cDir = path.join(tempDir, 'docs', '00_control');
    fs.mkdirSync(vDir, { recursive: true });
    fs.mkdirSync(cDir, { recursive: true });

    const tamperedCand = JSON.parse(fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-candidate.json'), 'utf8'));
    tamperedCand.acceptanceCriterion = 'Tampered acceptance criterion';
    fs.writeFileSync(path.join(vDir, 'dmk-197-closure-transition-candidate.json'), JSON.stringify(tamperedCand, null, 2));
    fs.writeFileSync(path.join(vDir, 'dmk-197-closure-transition-receipt.json'), JSON.stringify(rawReceipt, null, 2));
    fs.writeFileSync(path.join(cDir, 'MASTER_WBS.yaml'), postApplyWbsYaml);
    fs.writeFileSync(path.join(vDir, 'DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md'), 'ev');
    fs.writeFileSync(path.join(vDir, 'DMK_197_CLOSURE_TRANSITION_REVIEW.md'), 'ev');

    const res = verifyDmk197Closure({ workspaceRoot: tempDir });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Candidate digest mismatch')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('7: Altered candidate contents fails closed');
} catch (err) {
  fail('7: Altered candidate contents fails closed', err);
}

// 8. Incorrect implementation HEAD fails closed
try {
  const bad = clone(rawReceipt);
  bad.implementationHeadSha = '0000000000000000000000000000000000000000';
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('implementationHeadSha must match')));
  pass('8: Incorrect implementation HEAD fails closed');
} catch (err) {
  fail('8: Incorrect implementation HEAD fails closed', err);
}

// 9. Missing or unverifiable human decision evidence fails closed
try {
  const bad1 = clone(rawReceipt);
  bad1.decisionAuthority = 'Automated Agent';
  const res1 = verifyDmk197Closure({ customReceipt: bad1, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.includes('decisionAuthority must be "Human operator"')));

  const bad2 = clone(rawReceipt);
  bad2.decisionSource = 'Unverified source';
  const res2 = verifyDmk197Closure({ customReceipt: bad2, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some((e) => e.includes('decisionSource must match authorized closure decision source')));

  pass('9: Missing or unverifiable human decision evidence fails closed');
} catch (err) {
  fail('9: Missing or unverifiable human decision evidence fails closed', err);
}

// 10. Non-APPROVE decision fails closed
try {
  const bad = clone(rawReceipt);
  bad.decision = 'REJECT';
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.decision must be "APPROVE"')));
  pass('10: Non-APPROVE decision fails closed');
} catch (err) {
  fail('10: Non-APPROVE decision fails closed', err);
}

// 11. Incorrect pre-closure WBS digest fails closed
try {
  const bad = clone(rawReceipt);
  bad.preClosureCanonicalWbsSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.preClosureCanonicalWbsSha256 must match')));
  pass('11: Incorrect pre-closure WBS digest fails closed');
} catch (err) {
  fail('11: Incorrect pre-closure WBS digest fails closed', err);
}

// 12. Incorrect post-closure WBS digest fails closed
try {
  const bad = clone(rawReceipt);
  bad.postClosureCanonicalWbsSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('WBS digest mismatch')));
  pass('12: Incorrect post-closure WBS digest fails closed');
} catch (err) {
  fail('12: Incorrect post-closure WBS digest fails closed', err);
}

// 13. Unauthorized adjacent WorkItem mutation fails closed
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-198');
    if (it) it.status = 'BACKLOG';
  });
  const res = verifyDmk197Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-198 status must remain "IN_PROGRESS"')));
  pass('13: Unauthorized adjacent WorkItem mutation fails closed');
} catch (err) {
  fail('13: Unauthorized adjacent WorkItem mutation fails closed', err);
}

// 14. Premature VERIFIED status in WBS fails closed
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-197');
    if (it) it.status = 'VERIFIED';
  });
  const res = verifyDmk197Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-197 status must be "VERIFICATION_PENDING"')));
  pass('14: Premature VERIFIED status in WBS fails closed');
} catch (err) {
  fail('14: Premature VERIFIED status in WBS fails closed', err);
}

// 15. Missing required evidence fails closed
try {
  const res = verifyDmk197Closure({
    workspaceRoot: os.tmpdir(),
    customWbsYamlContent: postApplyWbsYaml,
    allowMissingEvidenceFile: false,
    customReceipt: rawReceipt,
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('Verification evidence file missing')));
  pass('15: Missing required evidence fails closed');
} catch (err) {
  fail('15: Missing required evidence fails closed', err);
}

// 16. Receipt present with WBS still IN_PROGRESS fails closed
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-197');
    if (it) it.status = 'IN_PROGRESS';
  });
  const res = verifyDmk197Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-197 status must be "VERIFICATION_PENDING"')));
  pass('16: Receipt present with WBS still IN_PROGRESS fails closed');
} catch (err) {
  fail('16: Receipt present with WBS still IN_PROGRESS fails closed', err);
}

// 17. WBS advanced without a valid receipt fails closed
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-noreceipt-adv-'));
  try {
    const res = verifyDmk197Closure({
      workspaceRoot: tempDir,
      customWbsYamlContent: postApplyWbsYaml,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Closure receipt does not exist')));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('17: WBS advanced without a valid receipt fails closed');
} catch (err) {
  fail('17: WBS advanced without a valid receipt fails closed', err);
}

// 18. Historical verifier receipt missing or tampered fails closed
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-badhist-'));
  try {
    const vDir = path.join(tempDir, 'docs', '07_verification');
    const cDir = path.join(tempDir, 'docs', '00_control');
    fs.mkdirSync(vDir, { recursive: true });
    fs.mkdirSync(cDir, { recursive: true });
    fs.writeFileSync(path.join(cDir, 'MASTER_WBS.yaml'), postApplyWbsYaml);
    fs.writeFileSync(path.join(vDir, 'dmk-197-closure-transition-receipt.json'), JSON.stringify(rawReceipt, null, 2));
    // Verify DMK-196 closure verifier rejects when DMK-196 post-merge receipt is missing or tampered
    const res196 = verifyDmk196Closure({ workspaceRoot: tempDir });
    assert.equal(res196.valid, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('18: Historical verifier receipt missing or tampered fails closed');
} catch (err) {
  fail('18: Historical verifier receipt missing or tampered fails closed', err);
}

// 19. False live reconciliation or runtime mutation claims fail closed
try {
  const bad1 = clone(rawReceipt);
  bad1.liveReconciliationExecuted = true;
  const res1 = verifyDmk197Closure({ customReceipt: bad1, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.includes('liveReconciliationExecuted must be false')));

  const bad2 = clone(rawReceipt);
  bad2.runtimeWorkItemMutationCount = 1;
  const res2 = verifyDmk197Closure({ customReceipt: bad2, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some((e) => e.includes('runtimeWorkItemMutationCount must be 0')));

  pass('19: False live reconciliation or runtime mutation claims fail closed');
} catch (err) {
  fail('19: False live reconciliation or runtime mutation claims fail closed', err);
}

// 20. Gate 7 or release state mutation claims fail closed
try {
  const bad1 = clone(rawReceipt);
  bad1.gate7Changed = true;
  const res1 = verifyDmk197Closure({ customReceipt: bad1, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some((e) => e.includes('gate7Changed must be false')));

  const bad2 = clone(rawReceipt);
  bad2.releaseChanged = true;
  const res2 = verifyDmk197Closure({ customReceipt: bad2, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some((e) => e.includes('releaseChanged must be false')));

  pass('20: Gate 7 or release state mutation claims fail closed');
} catch (err) {
  fail('20: Gate 7 or release state mutation claims fail closed', err);
}

// 21. Repeated application or conflicting receipt attempt fails closed
try {
  const bad = clone(rawReceipt);
  bad.applied = false;
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.applied must be true')));
  pass('21: Conflicting or unapplied receipt attempt fails closed');
} catch (err) {
  fail('21: Conflicting or unapplied receipt attempt fails closed', err);
}

// 22. Valid pre-application fixture passes pre-apply candidate verification
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-preapply-fixture-'));
  try {
    const vDir = path.join(tempDir, 'docs', '07_verification');
    const cDir = path.join(tempDir, 'docs', '00_control');
    fs.mkdirSync(vDir, { recursive: true });
    fs.mkdirSync(cDir, { recursive: true });
    // Write pre-closure WBS
    fs.writeFileSync(path.join(cDir, 'MASTER_WBS.yaml'), preApplyWbsYaml);
    fs.writeFileSync(path.join(vDir, 'dmk-197-closure-transition-candidate.json'), fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-candidate.json')));
    fs.writeFileSync(path.join(vDir, 'DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md'), 'ev');

    const res = verifyDmk197ClosureCandidate({ workspaceRoot: tempDir, mode: 'PRE_APPLY' });
    assert.equal(res.valid, true, `Expected pre-apply fixture to pass, got: ${res.errors.join('; ')}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('22: Valid pre-application fixture passes pre-apply candidate verification');
} catch (err) {
  fail('22: Valid pre-application fixture passes pre-apply candidate verification', err);
}

// 23. Valid post-application fixture passes receipt-bound verification
try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-postapply-fixture-'));
  try {
    const vDir = path.join(tempDir, 'docs', '07_verification');
    const cDir = path.join(tempDir, 'docs', '00_control');
    fs.mkdirSync(vDir, { recursive: true });
    fs.mkdirSync(cDir, { recursive: true });
    // The complete boundary also requires the independently pinned historical view.
    fs.cpSync(path.join(root, 'docs/07_verification/historical-wbs'), path.join(vDir, 'historical-wbs'), { recursive: true });
    fs.writeFileSync(path.join(cDir, 'MASTER_WBS.yaml'), postApplyWbsYaml);
    fs.writeFileSync(path.join(vDir, 'dmk-197-closure-transition-candidate.json'), fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-candidate.json')));
    fs.writeFileSync(path.join(vDir, 'dmk-197-closure-transition-receipt.json'), fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-receipt.json')));
    fs.writeFileSync(path.join(vDir, 'dmk-197-post-merge-governance-attestation.json'), fs.readFileSync(path.join(root, 'docs', '07_verification', 'dmk-197-post-merge-governance-attestation.json')));
    fs.writeFileSync(path.join(vDir, 'DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md'), 'ev');
    fs.writeFileSync(path.join(vDir, 'DMK_197_CLOSURE_TRANSITION_REVIEW.md'), 'ev');
    fs.writeFileSync(path.join(vDir, 'DMK_197_POST_MERGE_GOVERNANCE_RECONCILIATION.md'), 'ev');

    const res = verifyDmk197Closure({ workspaceRoot: tempDir });
    assert.equal(res.valid, true, `Expected post-apply fixture to pass, got: ${res.errors.join('; ')}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  pass('23: Valid post-application fixture passes receipt-bound verification');
} catch (err) {
  fail('23: Valid post-application fixture passes receipt-bound verification', err);
}

// 24. Single changed receipt field fails verification
try {
  const bad = clone(rawReceipt);
  bad.appliedAt = '2026-10-12T99:99:99Z';
  const res = verifyDmk197Closure({ customReceipt: bad, customWbsYamlContent: postApplyWbsYaml });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.appliedAt must match')));
  pass('24: Single changed receipt field fails verification');
} catch (err) {
  fail('24: Single changed receipt field fails verification', err);
}

// 25. New receipt cannot authorize unrelated status changes
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-206');
    if (it) it.status = 'VERIFICATION_PENDING';
  });
  const res = verifyDmk197Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-206 status must remain "BACKLOG"')));
  pass('25: New receipt cannot authorize unrelated status changes');
} catch (err) {
  fail('25: New receipt cannot authorize unrelated status changes', err);
}

// 26. Historical verification results remain valid with correctly chained evidence
try {
  const res196 = verifyDmk196Closure();
  assert.equal(res196.valid, true, `verifyDmk196Closure expected true, got: ${res196.errors.join('; ')}`);
  const resPm196 = verifyDmk196PostMergeCandidate();
  assert.equal(resPm196.valid, true, `verifyDmk196PostMergeCandidate expected true, got: ${resPm196.errors.join('; ')}`);
  const res208 = verifyDmk208StatusAudit();
  assert.equal(res208.valid, true);
  pass('26: Historical verification results remain valid with correctly chained evidence');
} catch (err) {
  fail('26: Historical verification results remain valid with correctly chained evidence', err);
}

// Current-state evidence cannot be replaced by a historical test override.
{
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wbs-boundary-'));
  try {
    fs.cpSync(path.join(root, 'docs'), path.join(temp, 'docs'), { recursive: true });
    for (const name of ['src', 'server', 'scripts', 'server.ts']) fs.cpSync(path.join(root, name), path.join(temp, name), { recursive: true });
    const wbsPath = path.join(temp, 'docs/00_control/MASTER_WBS.yaml');
    const original = fs.readFileSync(wbsPath, 'utf8');
    const baseline = verifyDmk197Closure({ workspaceRoot: temp });
    assert.equal(baseline.valid, true, baseline.errors.join('; '));
    assert.equal((baseline as any).historicalValid, true);
    assert.equal((baseline as any).mayApply, false);
    fs.appendFileSync(wbsPath, '\n# ungoverned successor\n');
    const result = verifyDmk197Closure({ workspaceRoot: temp, customWbsYamlContent: original });
    assert.equal(result.valid, false);
    assert.equal((result as any).historicalValid, true);
    assert.equal((result as any).currentForwardChainValid, false);
    fs.appendFileSync(path.join(temp, 'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml'), ' ');
    assert.equal((verifyDmk197Closure({ workspaceRoot: temp, customWbsYamlContent: original }) as any).historicalValid, false);
    pass('Historical/current separation rejects ungoverned bytes and snapshot tampering');
  } catch (err) { fail('Historical/current separation', err); }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
console.log('\n================================================================');
console.log(`TOTAL CLOSURE TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
