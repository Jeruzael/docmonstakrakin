// Documentation reproducer: run from this candidate's repository root.
// node docs/07_verification/accel-authority-prep-20261024/validate.cjs <existing-node_modules>
// Reads exact tracked source and candidate documents. Does not apply any WBS/runtime state.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const dependencies = path.resolve(process.argv[2]);
process.env.NODE_PATH = dependencies;
require('node:module').Module._initPaths();
require(path.join(dependencies, 'tsx/dist/cjs/index.cjs'));
const YAML = require('yaml');
const { validateWbsRegistration } = require(path.resolve('scripts/verifyWbsRegistration.ts'));
const { previewWbsRegistrationTransaction } = require(path.resolve('scripts/planWbsRegistrationTransaction.ts'));
const dir = 'docs/06_planning/accel-authority-prep-20261024';
const inventory = JSON.parse(fs.readFileSync(dir + '/criteria-preservation.json'));
const manifest = JSON.parse(fs.readFileSync(dir + '/registration-preview-manifest.json'));
const before = fs.readFileSync('docs/00_control/MASTER_WBS.yaml');
const after = fs.readFileSync(dir + '/proposed-MASTER_WBS.yaml.txt');
const originalPlanning = cp.execFileSync('git', ['show', inventory.sourceCommit + ':' + inventory.sourcePath]);
const sourceInventory = YAML.parse(originalPlanning.toString());
const old = YAML.parse(before.toString());
const next = YAML.parse(after.toString());
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, result: 'PASS' }); };
const input = { beforeBytes: before, afterBytes: after, manifest, decision: 'PREVIEW' };
let preview, denied;
check('Existing structural validator accepts exact six-item successor preview', () => {
  preview = validateWbsRegistration(input);
  assert.equal(preview.valid, true, preview.errors.join('; '));
  assert.equal(preview.beforeCount, 69); assert.equal(preview.afterCount, 75);
});
check('Every original item and root field remains semantically unchanged', () => {
  const { items: oldItems, ...oldRoot } = old;
  const { items: nextItems, ...nextRoot } = next;
  assert.deepEqual(oldRoot, nextRoot);
  for (const item of oldItems) assert.deepEqual(nextItems.find(x => x.id === item.id), item);
});
check('All candidate IDs and WBS paths are collision-free; statuses remain PROPOSED', () => {
  assert.equal(new Set(next.items.map(x => x.id)).size, next.items.length);
  assert.equal(new Set(next.items.map(x => x.wbs_path)).size, next.items.length);
  for (const item of manifest.approvedItems) {
    assert.equal(item.status, 'PROPOSED');
    assert.equal(old.items.some(x => x.id === item.id || x.wbs_path === item.wbs_path), false);
  }
});
check('Six additions retain the historical dependencies and criteria before EAF extensions', () => {
  const historical = JSON.parse(fs.readFileSync('docs/06_planning/s2a-readiness-20261019/governance/registration-proposal.json'));
  const visited = new Set(old.items.map(x => x.id));
  for (const item of manifest.approvedItems) {
    const prior = historical.proposedItems.find(x => x.id === item.id);
    assert.deepEqual(item.dependencies, prior.dependencies);
    assert.deepEqual(item.acceptance_criteria.slice(0, prior.acceptance_criteria.length), prior.acceptance_criteria);
    assert.equal(item.dependencies.every(x => visited.has(x)), true); visited.add(item.id);
  }
});
check('All 34 owners and 138 exact positive/negative criteria are retained once', () => {
  assert.equal(hash(originalPlanning), inventory.sourceSha256);
  assert.equal(inventory.entries.length, 34);
  const ids = new Set(); let count = 0;
  for (const entry of inventory.entries) {
    const source = sourceInventory.entries.find(x => x.key === entry.key);
    assert.equal(entry.lead_owner, source.lead_owner);
    for (const field of ['acceptance_criteria', 'negative_acceptance_criteria']) {
      assert.deepEqual(entry[field], source[field]);
      for (const criterion of entry[field]) {
        const parts = criterion.split(' | '); assert.equal(parts[1], 'lead_owner=' + entry.lead_owner);
        assert.equal(ids.has(parts[0]), false); ids.add(parts[0]); count++;
      }
    }
    assert.ok(entry.campaign_packages.length > 0);
    for (const location of entry.implementation_locations) assert.equal(fs.existsSync(location), true, location);
  }
  assert.equal(count, 138); assert.equal(inventory.criterionCount, count);
});
check('Only the six unregistered owners contribute their 25 EAF criteria to successor', () => {
  let addedCriteria = 0;
  for (const item of manifest.approvedItems) {
    const entry = inventory.entries.find(x => x.lead_owner === item.id);
    const expected = [...entry.acceptance_criteria, ...entry.negative_acceptance_criteria];
    assert.deepEqual(item.acceptance_criteria.slice(-expected.length), expected); addedCriteria += expected.length;
  }
  assert.equal(addedCriteria, 25);
});
check('Original planning false flags and unapplied statuses are preserved', () => {
  for (const object of [sourceInventory.application, ...sourceInventory.entries.map(x => x.application), inventory]) {
    assert.equal(object.canonicalApply, false); assert.equal(object.runtimeApply, false); assert.equal(object.mayApply, false);
  }
  assert.equal(sourceInventory.application.canonical_registration, 'NOT_APPLIED');
  assert.equal(sourceInventory.application.runtime_board, 'NOT_APPLIED');
});
check('APPROVED without a trusted policy/signatures rejects', () => {
  denied = validateWbsRegistration({ ...input, decision: 'APPROVED' });
  assert.equal(denied.valid, false); assert.ok(denied.errors.some(x => x.includes('Trusted independent policy')));
});
check('Existing-owner amendment rejects even with updated raw candidate digest', () => {
  const changed = structuredClone(next); changed.items[0].description = 'Unauthorized rewrite';
  const raw = Buffer.from(YAML.stringify(changed));
  const result = validateWbsRegistration({ ...input, afterBytes: raw, manifest: { ...manifest, postWbsSha256: hash(raw) } });
  assert.equal(result.valid, false); assert.ok(result.errors.some(x => x.includes('Existing WBS item modified')));
});
check('Duplicate candidate ID rejects', () => {
  const changed = structuredClone(next); changed.items.push(structuredClone(manifest.approvedItems[0]));
  const raw = Buffer.from(YAML.stringify(changed));
  assert.equal(validateWbsRegistration({ ...input, afterBytes: raw, manifest: { ...manifest, postWbsSha256: hash(raw) } }).valid, false);
});
check('Removed negative criterion cannot match the exact manifest', () => {
  const changed = structuredClone(next); changed.items.find(x => x.id === 'DMK-209').acceptance_criteria.pop();
  const raw = Buffer.from(YAML.stringify(changed));
  const result = validateWbsRegistration({ ...input, afterBytes: raw, manifest: { ...manifest, postWbsSha256: hash(raw) } });
  assert.equal(result.valid, false); assert.ok(result.errors.some(x => x.includes('altered newly registered item')));
});
check('Exact before/after digest mismatch rejects', () => {
  assert.equal(validateWbsRegistration({ ...input, afterBytes: Buffer.concat([after, Buffer.from('\n')]) }).valid, false);
});
check('V2 transaction preview rejects absent signed receipt, ledger and trusted context', () => {
  const result = previewWbsRegistrationTransaction({ beforeBytes: before, afterBytes: after });
  assert.equal(result.valid, false); assert.equal(result.mayApply, false); assert.equal(result.mode, 'REJECTED');
});
check('Canonical WBS still equals baseline Git bytes and original planning source is unchanged', () => {
  assert.deepEqual(fs.readFileSync('docs/00_control/MASTER_WBS.yaml'), before);
  assert.deepEqual(cp.execFileSync('git', ['show', inventory.runtimeBase + ':docs/00_control/MASTER_WBS.yaml']), before);
  assert.deepEqual(cp.execFileSync('git', ['show', inventory.sourceCommit + ':' + inventory.sourcePath]), originalPlanning);
});
console.log(JSON.stringify({recordType:'AGENT_EXECUTED_STRUCTURAL_REGISTRATION_PREVIEW',observedAt:new Date().toISOString(),runtimeBase:inventory.runtimeBase,planningSource:inventory.sourceCommit,node:process.version,platform:process.platform,dependencySource:'Read-only existing installed yaml/tsx; no dependency installation or native qualification in this lane',passed:checks.length,failed:0,checks,preview,missingAuthorityDenial:denied,canonicalApply:false,runtimeApply:false,mayApply:false,application:'BLOCKED_AUTHORITY',humanAcceptance:'NOT_RUN',nativeQualification:'NOT_RUN'}, null, 2));
