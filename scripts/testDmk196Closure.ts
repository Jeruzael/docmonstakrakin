import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  verifyDmk196Closure,
  EXPECTED_BASE_MASTER_SHA,
  EXPECTED_PRE_CLOSURE_BRANCH_SHA,
  EXPECTED_EVIDENCE_DOC,
} from './verifyDmk196Closure.ts';

const root = process.cwd();
const liveReceiptPath = path.join(root, 'docs', '07_verification', 'dmk-196-closure-transition-receipt.json');
const rawReceipt = JSON.parse(fs.readFileSync(liveReceiptPath, 'utf8'));

console.log('================================================================');
console.log('   DMK-196 CLOSURE TRANSITION VERIFIER REGRESSION SUITE');
console.log('   Evaluates Invariant: Fail-closed enforcement on closure receipt & WBS');
console.log('   Coverage: Scenarios A through O (Negative & positive boundary checks)');
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

// Scenario A: Correct live receipt passes
try {
  const res = verifyDmk196Closure();
  assert.equal(res.valid, true, `Scenario A expected valid=true, got errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  pass('A: Correct receipt and WBS state passes');
} catch (err) {
  fail('A: Correct receipt and WBS state passes', err);
}

// Scenario B: Wrong WorkItem fails
try {
  const bad = clone(rawReceipt);
  bad.workItemId = 'DMK-999';
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.workItemId must be "DMK-196"')));
  pass('B: Wrong WorkItem ID fails closed');
} catch (err) {
  fail('B: Wrong WorkItem ID fails closed', err);
}

// Scenario C: Wrong source status fails
try {
  const bad = clone(rawReceipt);
  bad.fromStatus = 'BACKLOG';
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.fromStatus must be "IN_PROGRESS"')));
  pass('C: Wrong source status fails closed');
} catch (err) {
  fail('C: Wrong source status fails closed', err);
}

// Scenario D: Wrong target status fails
try {
  const bad = clone(rawReceipt);
  bad.toStatus = 'VERIFIED';
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.toStatus must be "VERIFICATION_PENDING"')));
  pass('D: Wrong target status fails closed');
} catch (err) {
  fail('D: Wrong target status fails closed', err);
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

// Scenario E: DMK-197 drift fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-197');
    if (it) it.status = 'VERIFIED';
  });
  const res = verifyDmk196Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-197 status must remain "IN_PROGRESS"')));
  pass('E: DMK-197 status drift fails closed');
} catch (err) {
  fail('E: DMK-197 status drift fails closed', err);
}

// Scenario F: DMK-198 drift fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-198');
    if (it) it.status = 'BACKLOG';
  });
  const res = verifyDmk196Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-198 status must remain "IN_PROGRESS"')));
  pass('F: DMK-198 status drift fails closed');
} catch (err) {
  fail('F: DMK-198 status drift fails closed', err);
}

// Scenario G: DMK-206 drift fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-206');
    if (it) it.status = 'IN_PROGRESS';
  });
  const res = verifyDmk196Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-206 status must remain "BACKLOG"')));
  pass('G: DMK-206 status drift fails closed');
} catch (err) {
  fail('G: DMK-206 status drift fails closed', err);
}

// Scenario H: Missing evidence fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-196');
    if (it) it.evidence = [];
  });
  const res = verifyDmk196Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-196 evidence must contain')));
  pass('H: Missing evidence in DMK-196 fails closed');
} catch (err) {
  fail('H: Missing evidence in DMK-196 fails closed', err);
}

// Scenario I: Wrong post-WBS digest fails
try {
  const bad = clone(rawReceipt);
  bad.postClosureCanonicalWbsSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('WBS digest mismatch')));
  pass('I: Wrong post-WBS digest fails closed');
} catch (err) {
  fail('I: Wrong post-WBS digest fails closed', err);
}

// Scenario J: liveReconciliationExecuted=true fails
try {
  const bad = clone(rawReceipt);
  bad.liveReconciliationExecuted = true;
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.liveReconciliationExecuted must be false')));
  pass('J: liveReconciliationExecuted=true fails closed');
} catch (err) {
  fail('J: liveReconciliationExecuted=true fails closed', err);
}

// Scenario K: Wrong preClosureCanonicalWbsSha256 fails
try {
  const bad = clone(rawReceipt);
  bad.preClosureCanonicalWbsSha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.preClosureCanonicalWbsSha256 must match')));
  pass('K: Wrong preClosureCanonicalWbsSha256 fails closed');
} catch (err) {
  fail('K: Wrong preClosureCanonicalWbsSha256 fails closed', err);
}

// Scenario L: applied=false fails
try {
  const bad = clone(rawReceipt);
  bad.applied = false;
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.applied must be true')));
  pass('L: applied=false fails closed');
} catch (err) {
  fail('L: applied=false fails closed', err);
}

// Scenario M: Wrong verificationEvidence path fails
try {
  const bad = clone(rawReceipt);
  bad.verificationEvidence = 'docs/07_verification/wrong-evidence.md';
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.verificationEvidence must be')));
  pass('M: Wrong verificationEvidence path fails closed');
} catch (err) {
  fail('M: Wrong verificationEvidence path fails closed', err);
}

// Scenario N: DMK-207 status drift fails
try {
  const customWbs = createCustomWbs((doc) => {
    const it = findWbsItem(doc.items, 'DMK-207');
    if (it) it.status = 'IN_PROGRESS';
  });
  const res = verifyDmk196Closure({ customWbsYamlContent: customWbs });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('DMK-207 status must remain "BACKLOG"')));
  pass('N: DMK-207 status drift fails closed');
} catch (err) {
  fail('N: DMK-207 status drift fails closed', err);
}

// Scenario O: implementationChangedDuringClosure=true fails
try {
  const bad = clone(rawReceipt);
  bad.implementationChangedDuringClosure = true;
  const res = verifyDmk196Closure({ customReceipt: bad });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes('receipt.implementationChangedDuringClosure must be false')));
  pass('O: implementationChangedDuringClosure=true fails closed');
} catch (err) {
  fail('O: implementationChangedDuringClosure=true fails closed', err);
}

console.log('\n================================================================');
console.log(`TOTAL SCENARIOS: 15 | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
