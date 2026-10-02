import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

import {
  readCanonicalWbs,
  parseCanonicalWbsBytes,
  getScopedCanonicalWbsItems,
  computeMasterWbsSha256,
  buildCanonicalWbsTree,
  resolveMasterWbsPath,
} from '../server/workTracking/canonicalWbs.ts';

import {
  mapCanonicalStatus,
  mapCanonicalType,
  mapCanonicalPriority,
  mapCanonicalRisk,
} from '../server/workTracking/wbsMapping.ts';

import {
  generateReconciliationPlan,
  applyReconciliationPlan,
  computePlanDigest,
  hasValidVerificationProvenance,
  validateActor,
  validateTimestamp,
  PLAN_FORMAT_VERSION,
  projectSelfWorkItemReconciliation,
  serializeSnapshot,
  digestCanonical,
  type ReconciliationPlan,
} from '../server/workTracking/selfWorkItemReconciliation.ts';

import { verifyReconciliationOutcome } from './verifySelfWorkItemReconciliation.ts';
import { ProjectStore } from '../server/projectStore.ts';
import {
  snapshotProjectStore,
  writeProjectSnapshotAtomic,
  readProjectSnapshot,
  projectSnapshotDigest,
} from '../server/projectPersistence.ts';

let passedCount = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passedCount++;
    console.log(`PASS Scenario ${passedCount}: ${name}`);
  } catch (err) {
    console.error(`FAIL Scenario: ${name}`);
    throw err;
  }
}

// Helper to create a synthetic workspace with MASTER_WBS.yaml and .local/project-state.json
function createSyntheticWorkspace(options?: {
  wbsYamlContent?: string;
  initialStore?: ProjectStore;
}): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-wbs-sync-test-'));

  const docsControlDir = path.join(dir, 'docs', '00_control');
  fs.mkdirSync(docsControlDir, { recursive: true });

  const defaultWbsYaml = `
version: "1.0"
project: "PRJ-DOCMONSTAKRAKIN"
baseline: "v0.1.0-rc1"
items:
  - id: "EPIC-13"
    wbs_path: "13"
    parent_id: ""
    epic: "EPIC-13"
    phase: "PHASE-12"
    title: "Self-Project Governance"
    description: "EPIC 13"
    type: "GOVERNANCE"
    priority: "P0"
    risk: "HIGH"
    status: "READY"
    requirements: ["REQ-DATA-001"]
    dependencies: []
    acceptance_criteria: ["Criteria 1"]
    evidence: []
  - id: "DMK-203"
    wbs_path: "13.06.16"
    parent_id: "EPIC-13"
    epic: "EPIC-13"
    phase: "PHASE-12"
    title: "GitHub Actions CI Baseline"
    description: "CI baseline implementation"
    type: "INFRASTRUCTURE"
    priority: "P0"
    risk: "HIGH"
    status: "VERIFIED"
    requirements: ["REQ-DATA-001"]
    dependencies: []
    acceptance_criteria: ["All CI jobs pass"]
    verified_by: "Test Reviewer"
    verification_status: "VERIFIED"
    human_approved_by: "Gio (Lead Architect)"
    evidence: ["Evidence 1"]
  - id: "DMK-204"
    wbs_path: "13.06.17"
    parent_id: "EPIC-13"
    epic: "EPIC-13"
    phase: "PHASE-12"
    title: "Branch Protection Enforcement"
    description: "Branch protection setup"
    type: "GOVERNANCE"
    priority: "P1"
    risk: "MEDIUM"
    status: "BACKLOG"
    requirements: []
    dependencies: ["DMK-203"]
    acceptance_criteria: ["Branch protection active"]
    evidence: []
  - id: "DMK-205"
    wbs_path: "13.06.18"
    parent_id: "EPIC-13"
    epic: "EPIC-13"
    phase: "PHASE-12"
    title: "WBS Runtime Synchronization"
    description: "Reconcile WBS with runtime store"
    type: "FEATURE"
    priority: "P0"
    risk: "HIGH"
    status: "READY"
    requirements: ["REQ-DATA-001", "REQ-DATA-002"]
    dependencies: []
    acceptance_criteria: ["One-way sync", "Dynamic WBS view"]
    evidence: []
  - id: "DMK-050"
    wbs_path: "05.01"
    parent_id: "EPIC-05"
    epic: "EPIC-05"
    phase: "PHASE-05"
    title: "Non-EPIC-13 Item"
    description: "Historical bootstrap item"
    type: "FEATURE"
    priority: "P2"
    risk: "LOW"
    status: "VERIFIED"
    requirements: []
    dependencies: []
    acceptance_criteria: []
    evidence: []
`;

  fs.writeFileSync(
    path.join(docsControlDir, 'MASTER_WBS.yaml'),
    options?.wbsYamlContent ?? defaultWbsYaml,
    'utf8'
  );

  const store = options?.initialStore ?? new ProjectStore();
  if (!options?.initialStore) {
    // Add PRJ-DOCMONSTAKRAKIN
    store.projects.push({
      id: 'PRJ-DOCMONSTAKRAKIN',
      name: 'DOCMONSTAKRAKIN',
      description: 'Self-tracking repository',
      stateVersion: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      activeSprint: 1,
      gates: [],
    } as any);

    // Add unrelated project to verify non-mutation
    store.projects.push({
      id: 'PRJ-OTHER',
      name: 'Other Project',
      description: 'Preserved untouched',
      stateVersion: 5,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      activeSprint: 2,
      gates: [],
    } as any);

    store.workItems['PRJ-DOCMONSTAKRAKIN'] = [
      {
        id: 'DMK-203',
        parentEpicId: 'EPIC-13',
        type: 'TASK',
        title: 'Old Title For DMK-203',
        description: 'Old description',
        status: 'VERIFICATION', // Drift from canonical VERIFIED
        priority: 'P1', // Drift from canonical P0
        risk: 'LOW',
        sprint: 4, // Operational runtime field to preserve
        owner: 'Lead Dev', // Operational runtime field to preserve
        requirements: [],
        dependencies: [],
        acceptanceCriteria: ['Old criteria'],
        checklist: [{ text: 'Operational checklist item', done: true }], // Preserve
        tests: [],
        evidence: ['Old Evidence'],
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'DMK-RUNTIME-ONLY',
        parentEpicId: 'EPIC-13',
        type: 'TASK',
        title: 'Ad-hoc Runtime Task',
        description: 'Not in WBS',
        status: 'IN_PROGRESS',
        priority: 'P2',
        risk: 'LOW',
        sprint: 4,
        requirements: [],
        dependencies: [],
        acceptanceCriteria: [],
        checklist: [],
        tests: [],
        evidence: [],
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    store.workItems['PRJ-OTHER'] = [
      {
        id: 'OTHER-1',
        parentEpicId: 'EPIC-99',
        type: 'TASK',
        title: 'Other Task',
        description: 'Should not change',
        status: 'READY',
        priority: 'P1',
        risk: 'LOW',
        sprint: 1,
        requirements: [],
        dependencies: [],
        acceptanceCriteria: [],
        checklist: [],
        tests: [],
        evidence: [],
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    // Seed initial audit log for PRJ-DOCMONSTAKRAKIN
    store.addAuditEvent(
      'PRJ-DOCMONSTAKRAKIN',
      'Initial Setup',
      'INITIALIZED',
      'PRJ-DOCMONSTAKRAKIN',
      'Initial project creation'
    );
  }

  writeProjectSnapshotAtomic(snapshotProjectStore(store), dir);

  return {
    dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    },
  };
}

console.log('--- Starting DMK-205 Canonical WBS -> Runtime Sync Test Suite ---');

// ==========================================
// GROUP 1: Canonical WBS Parser & Integrity
// ==========================================

test('Parser reads MASTER_WBS.yaml and extracts items and raw SHA-256', () => {
  const ws = createSyntheticWorkspace();
  try {
    const doc = readCanonicalWbs(ws.dir);
    assert.equal(doc.project, 'PRJ-DOCMONSTAKRAKIN');
    assert.equal(doc.items.length, 5);
    assert.ok(typeof doc.rawSha256 === 'string' && doc.rawSha256.length === 64);
    assert.equal(computeMasterWbsSha256(ws.dir), doc.rawSha256);
  } finally {
    ws.cleanup();
  }
});

test('Parser throws when MASTER_WBS.yaml is missing', () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-empty-'));
  try {
    assert.throws(() => readCanonicalWbs(emptyDir), /MASTER_WBS\.yaml not found/);
    assert.throws(() => computeMasterWbsSha256(emptyDir), /MASTER_WBS\.yaml not found/);
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

test('Parser throws on malformed YAML syntax', () => {
  const ws = createSyntheticWorkspace({
    wbsYamlContent: `
project: PRJ-DOCMONSTAKRAKIN
items:
  - id: DMK-1
    invalid: [unclosed array
`,
  });
  try {
    assert.throws(() => readCanonicalWbs(ws.dir), /Failed to parse MASTER_WBS\.yaml/);
  } finally {
    ws.cleanup();
  }
});

test('Parser throws when root is not an object or items is not an array', () => {
  const ws1 = createSyntheticWorkspace({ wbsYamlContent: 'Just a string' });
  try {
    assert.throws(() => readCanonicalWbs(ws1.dir), /root must be an object/);
  } finally {
    ws1.cleanup();
  }

  const ws2 = createSyntheticWorkspace({ wbsYamlContent: 'project: TEST\nitems: "not an array"' });
  try {
    assert.throws(() => readCanonicalWbs(ws2.dir), /items must be an array/);
  } finally {
    ws2.cleanup();
  }
});

test('Parser rejects duplicate WBS item ID', () => {
  const ws = createSyntheticWorkspace({
    wbsYamlContent: `
project: PRJ-DOCMONSTAKRAKIN
items:
  - id: DMK-DUP
    wbs_path: "13.01"
    title: First
  - id: DMK-DUP
    wbs_path: "13.02"
    title: Second
`,
  });
  try {
    assert.throws(() => readCanonicalWbs(ws.dir), /Duplicate WBS item ID detected: "DMK-DUP"/);
  } finally {
    ws.cleanup();
  }
});

test('Parser rejects duplicate WBS path', () => {
  const ws = createSyntheticWorkspace({
    wbsYamlContent: `
project: PRJ-DOCMONSTAKRAKIN
items:
  - id: DMK-1
    wbs_path: "13.01"
    title: First
  - id: DMK-2
    wbs_path: "13.01"
    title: Second
`,
  });
  try {
    assert.throws(() => readCanonicalWbs(ws.dir), /Duplicate WBS path detected: "13\.01"/);
  } finally {
    ws.cleanup();
  }
});

test('Scoped extractor isolates EPIC-13 items while ignoring non-EPIC-13 items', () => {
  const ws = createSyntheticWorkspace();
  try {
    const { scopedItems, allItems } = getScopedCanonicalWbsItems(ws.dir, 'EPIC-13');
    assert.equal(allItems.length, 5);
    assert.equal(scopedItems.length, 4); // EPIC-13, DMK-203, DMK-204, DMK-205 (DMK-050 is EPIC-05)
    assert.ok(scopedItems.some((i) => i.id === 'DMK-203'));
    assert.ok(scopedItems.some((i) => i.id === 'DMK-204'));
    assert.ok(scopedItems.some((i) => i.id === 'DMK-205'));
    assert.ok(!scopedItems.some((i) => i.id === 'DMK-050'));
  } finally {
    ws.cleanup();
  }
});

test('Hierarchy tree builder correctly nests parent and children WBS items', () => {
  const ws = createSyntheticWorkspace();
  try {
    const doc = readCanonicalWbs(ws.dir);
    const tree = buildCanonicalWbsTree(doc.items);
    assert.ok(Array.isArray(tree));
    const epic13 = tree.find((t) => t.id === 'EPIC-13');
    assert.ok(epic13);
    assert.ok(Array.isArray(epic13.children));
    assert.equal(epic13.children.length, 3); // DMK-203, DMK-204, DMK-205
    assert.ok(epic13.children.some((c) => c.id === 'DMK-205'));
  } finally {
    ws.cleanup();
  }
});

// ==========================================
// GROUP 2: Status & Type Mapping Matrices
// ==========================================

test('Status mapping: PROPOSED maps to PROPOSED', () => {
  assert.equal(mapCanonicalStatus('PROPOSED'), 'PROPOSED');
  assert.equal(mapCanonicalStatus('proposed'), 'PROPOSED');
});

test('Status mapping: BACKLOG maps to BACKLOG', () => {
  assert.equal(mapCanonicalStatus('BACKLOG'), 'BACKLOG');
  assert.equal(mapCanonicalStatus('backlog'), 'BACKLOG');
});

test('Status mapping: READY maps to READY', () => {
  assert.equal(mapCanonicalStatus('READY'), 'READY');
  assert.equal(mapCanonicalStatus('ready'), 'READY');
});

test('Status mapping: IMPLEMENTED maps to VERIFICATION', () => {
  assert.equal(mapCanonicalStatus('IMPLEMENTED'), 'VERIFICATION');
  assert.equal(mapCanonicalStatus('implemented'), 'VERIFICATION');
});

test('Status mapping: VERIFICATION_PENDING maps to VERIFICATION', () => {
  assert.equal(mapCanonicalStatus('VERIFICATION_PENDING'), 'VERIFICATION');
  assert.equal(mapCanonicalStatus('verification_pending'), 'VERIFICATION');
});

test('Status mapping: VERIFIED maps to VERIFIED', () => {
  assert.equal(mapCanonicalStatus('VERIFIED'), 'VERIFIED');
  assert.equal(mapCanonicalStatus('verified'), 'VERIFIED');
});

test('Status mapping: Unrecognized status throws UNSUPPORTED_WBS_STATUS', () => {
  assert.throws(() => mapCanonicalStatus('UNKNOWN_STATUS'), /UNSUPPORTED_WBS_STATUS/);
  assert.throws(() => mapCanonicalStatus(''), /UNSUPPORTED_WBS_STATUS/);
  assert.throws(() => mapCanonicalStatus('IN_PROGRESS'), /UNSUPPORTED_WBS_STATUS/);
});

test('Type mapping: FEATURE maps to FEATURE', () => {
  assert.equal(mapCanonicalType('FEATURE'), 'FEATURE');
  assert.equal(mapCanonicalType('feature'), 'FEATURE');
});

test('Type mapping: BUG, INFRASTRUCTURE, and GOVERNANCE map to TASK', () => {
  assert.equal(mapCanonicalType('BUG'), 'TASK');
  assert.equal(mapCanonicalType('INFRASTRUCTURE'), 'TASK');
  assert.equal(mapCanonicalType('GOVERNANCE'), 'TASK');
});

test('Type mapping: QUALITY maps to VERIFICATION', () => {
  assert.equal(mapCanonicalType('QUALITY'), 'VERIFICATION');
  assert.equal(mapCanonicalType('quality'), 'VERIFICATION');
});

test('Type mapping: SECURITY maps to SECURITY, and RELEASE maps to RELEASE', () => {
  assert.equal(mapCanonicalType('SECURITY'), 'SECURITY');
  assert.equal(mapCanonicalType('RELEASE'), 'RELEASE');
});

test('Type mapping: Unrecognized type throws UNSUPPORTED_WBS_TYPE', () => {
  assert.throws(() => mapCanonicalType('UNKNOWN_TYPE'), /UNSUPPORTED_WBS_TYPE/);
  assert.throws(() => mapCanonicalType(''), /UNSUPPORTED_WBS_TYPE/);
  assert.throws(() => mapCanonicalType('STORY'), /UNSUPPORTED_WBS_TYPE/);
});

test('Priority and risk mapping correctly handle standard and fold values, and fail closed', () => {
  assert.equal(mapCanonicalPriority('P0'), 'P0');
  assert.equal(mapCanonicalPriority('P1'), 'P1');
  assert.equal(mapCanonicalPriority('P2'), 'P2');
  assert.equal(mapCanonicalPriority('P3'), 'P2'); // Folds to P2
  assert.throws(() => mapCanonicalPriority('INVALID'), /UNSUPPORTED_WBS_PRIORITY/);
  assert.throws(() => mapCanonicalPriority(''), /UNSUPPORTED_WBS_PRIORITY/);

  assert.equal(mapCanonicalRisk('CRITICAL'), 'CRITICAL');
  assert.equal(mapCanonicalRisk('HIGH'), 'HIGH');
  assert.equal(mapCanonicalRisk('MEDIUM'), 'MEDIUM');
  assert.equal(mapCanonicalRisk('LOW'), 'LOW');
  assert.throws(() => mapCanonicalRisk('UNKNOWN'), /UNSUPPORTED_WBS_RISK/);
  assert.throws(() => mapCanonicalRisk(''), /UNSUPPORTED_WBS_RISK/);
});

// ==========================================
// GROUP 3: Reconciliation Planning & Drift
// ==========================================

test('Identifies MISSING_RUNTIME for item in WBS but absent in ProjectStore', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    const missing = plan.rows.filter((r) => r.category === 'MISSING_RUNTIME');
    const missingIds = missing.map((r) => r.id);
    // EPIC-13, DMK-204, DMK-205 are not in initial runtime store
    assert.ok(missingIds.includes('DMK-204'));
    assert.ok(missingIds.includes('DMK-205'));
    assert.ok(missingIds.includes('EPIC-13'));
    assert.equal(plan.summary.missingRuntime, 3);
  } finally {
    ws.cleanup();
  }
});

test('Identifies STATUS_DRIFT when runtime status differs from canonical mapped status', () => {
  const ws = createSyntheticWorkspace();
  try {
    // Keep metadata aligned, drift only status
    const snap = readProjectSnapshot(ws.dir)!;
    const item = snap.state.workItems['PRJ-DOCMONSTAKRAKIN'].find((w: any) => w.id === 'DMK-203')!;
    item.title = 'GitHub Actions CI Baseline';
    item.description = 'CI baseline implementation';
    item.priority = 'P0';
    item.risk = 'HIGH';
    item.requirements = ['REQ-DATA-001'];
    item.dependencies = [];
    item.acceptanceCriteria = ['All CI jobs pass'];
    item.canonicalWbsType = 'INFRASTRUCTURE';
    item.canonicalWbsStatus = 'VERIFIED';
    item.canonicalManaged = true;
    item.type = 'TASK';
    writeProjectSnapshotAtomic(snap, ws.dir);

    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    const drift = plan.rows.find((r) => r.id === 'DMK-203');
    assert.ok(drift);
    assert.equal(drift.category, 'STATUS_DRIFT');
    assert.deepEqual(drift.differences, ['STATUS_DRIFT']);
    assert.equal(drift.canonicalStatus, 'VERIFIED');
    assert.equal(drift.runtimeStatus, 'VERIFICATION');
    assert.equal(drift.action, 'UPDATE_STATUS');
  } finally {
    ws.cleanup();
  }
});

test('Identifies STATUS_AND_METADATA_DRIFT when both status and metadata differ', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    const drift = plan.rows.find((r) => r.id === 'DMK-203');
    assert.ok(drift);
    assert.equal(drift.category, 'STATUS_AND_METADATA_DRIFT');
    assert.ok(drift.differences?.includes('STATUS_DRIFT'));
    assert.ok(drift.differences?.includes('METADATA_DRIFT'));
    assert.equal(drift.action, 'UPDATE_STATUS_AND_METADATA');
    assert.ok(plan.summary.statusDrift > 0);
    assert.ok(plan.summary.metadataDrift > 0);
  } finally {
    ws.cleanup();
  }
});

test('Identifies METADATA_DRIFT when title/description/priority/risk differ but status matches', () => {
  const ws = createSyntheticWorkspace();
  try {
    // Set DMK-203 runtime status to VERIFIED (matching canonical) but leave title and priority drifting
    const snap = readProjectSnapshot(ws.dir)!;
    const item = snap.state.workItems['PRJ-DOCMONSTAKRAKIN'].find((w: any) => w.id === 'DMK-203')!;
    item.status = 'VERIFIED';
    writeProjectSnapshotAtomic(snap, ws.dir);

    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    const drift = plan.rows.find((r) => r.id === 'DMK-203');
    assert.ok(drift);
    assert.equal(drift.category, 'METADATA_DRIFT');
    assert.deepEqual(drift.differences, ['METADATA_DRIFT']);
    assert.equal(drift.action, 'UPDATE_METADATA');
  } finally {
    ws.cleanup();
  }
});

test('Identifies SYNCED when item is in full alignment with canonical metadata', () => {
  const ws = createSyntheticWorkspace();
  try {
    const snap = readProjectSnapshot(ws.dir)!;
    const item = snap.state.workItems['PRJ-DOCMONSTAKRAKIN'].find((w: any) => w.id === 'DMK-203')!;
    item.status = 'VERIFIED';
    item.title = 'GitHub Actions CI Baseline';
    item.description = 'CI baseline implementation';
    item.priority = 'P0';
    item.risk = 'HIGH';
    item.requirements = ['REQ-DATA-001'];
    item.dependencies = [];
    item.acceptanceCriteria = ['All CI jobs pass'];
    item.canonicalManaged = true;
    item.canonicalWbsStatus = 'VERIFIED';
    item.canonicalWbsType = 'INFRASTRUCTURE';
    writeProjectSnapshotAtomic(snap, ws.dir);

    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    const synced = plan.rows.find((r) => r.id === 'DMK-203');
    assert.ok(synced);
    assert.equal(synced.category, 'SYNCED');
    assert.equal(synced.action, 'NOOP');
  } finally {
    ws.cleanup();
  }
});

test('Identifies RUNTIME_ONLY items, generating warning without proposing deletion', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    assert.equal(plan.summary.runtimeOnly, 1);
    const runtimeOnly = plan.rows.find((r) => r.id === 'DMK-RUNTIME-ONLY');
    assert.ok(runtimeOnly);
    assert.equal(runtimeOnly.category, 'RUNTIME_ONLY');
    assert.equal(runtimeOnly.action, 'WARN_RUNTIME_ONLY');
    assert.ok(plan.runtimeOnlyWarnings.some((w) => w.includes('DMK-RUNTIME-ONLY')));
    // Must not propose deleting it
    assert.ok(!plan.proposedUpdates.some((u) => u.id === 'DMK-RUNTIME-ONLY'));
  } finally {
    ws.cleanup();
  }
});

test('Blocks VERIFIED item if canonical verification provenance is incomplete', () => {
  const customWbs = `
version: "1.0"
project: "PRJ-DOCMONSTAKRAKIN"
baseline: "v0.1.0-rc1"
items:
  - id: "DMK-INVALID-VERIFIED"
    wbs_path: "13.99"
    parent_id: "EPIC-13"
    epic: "EPIC-13"
    phase: "PHASE-12"
    title: "Unproven Verified Item"
    description: "Claims verified without evidence"
    type: "FEATURE"
    priority: "P1"
    risk: "MEDIUM"
    status: "VERIFIED"
    requirements: []
    dependencies: []
    acceptance_criteria: ["Criteria"]
    evidence: []
`;
  const ws = createSyntheticWorkspace({ wbsYamlContent: customWbs });
  try {
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    assert.equal(plan.summary.blocked, 1);
    const blockedRow = plan.rows.find((r) => r.id === 'DMK-INVALID-VERIFIED');
    assert.ok(blockedRow);
    assert.equal(blockedRow.category, 'BLOCKED');
    assert.equal(blockedRow.action, 'BLOCKED');
    assert.ok(plan.blockedReasons['DMK-INVALID-VERIFIED']);
    // Candidate creations must NOT include blocked item
    assert.ok(!plan.proposedCreations.some((c) => c.id === 'DMK-INVALID-VERIFIED'));
  } finally {
    ws.cleanup();
  }
});

test('Dry-run planning executes with ZERO file system or snapshot mutations', () => {
  const ws = createSyntheticWorkspace();
  try {
    const snapPath = path.join(ws.dir, '.local', 'project-state.json');
    const beforeBytes = fs.readFileSync(snapPath);
    const beforeDigest = projectSnapshotDigest(ws.dir);

    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    assert.ok(plan.planDigest);

    const afterBytes = fs.readFileSync(snapPath);
    const afterDigest = projectSnapshotDigest(ws.dir);

    assert.deepEqual(beforeBytes, afterBytes);
    assert.equal(beforeDigest, afterDigest);
  } finally {
    ws.cleanup();
  }
});

test('Deterministic planDigest changes if any plan content changes', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan1 = generateReconciliationPlan({
      workspaceRoot: ws.dir,
      actor: 'Gio',
      timestamp: '2026-10-02T00:00:00.000Z',
    });

    const plan2 = generateReconciliationPlan({
      workspaceRoot: ws.dir,
      actor: 'Different Actor',
      timestamp: '2026-10-02T00:00:00.000Z',
    });

    assert.notEqual(plan1.planDigest, plan2.planDigest);
  } finally {
    ws.cleanup();
  }
});

// ==========================================
// GROUP 4: Authorization, Anti-TOCTOU & Apply
// ==========================================

test('Apply rejects when DMK_WBS_SYNC_EXECUTE env var is missing or invalid', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    delete process.env.DMK_WBS_SYNC_EXECUTE;

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /UNAUTHORIZED_SYNC_EXECUTION/
    );

    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-WRONG';
    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /UNAUTHORIZED_SYNC_EXECUTION/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Apply rejects if confirmed project ID does not match PRJ-DOCMONSTAKRAKIN', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-WRONG',
          confirmPlanDigest: plan.planDigest,
        }),
      /INVALID_PROJECT_CONFIRMATION/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Apply rejects if confirmed plan digest does not match reviewed plan digest', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: '0000000000000000000000000000000000000000000000000000000000000000',
        }),
      /PLAN_DIGEST_MISMATCH/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Anti-TOCTOU: Apply rejects if MASTER_WBS.yaml was modified after plan generation', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    // Mutate MASTER_WBS.yaml
    const wbsPath = resolveMasterWbsPath(ws.dir);
    fs.appendFileSync(wbsPath, '\n# Mutated comment to change hash\n');

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /WBS_TOCTOU_MISMATCH/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Anti-TOCTOU: Apply rejects if snapshot was modified after plan generation', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    // Mutate snapshot
    const snap = readProjectSnapshot(ws.dir)!;
    snap.state.projects[0].description = 'Mutated description';
    writeProjectSnapshotAtomic(snap, ws.dir);

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /STALE_SNAPSHOT/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Atomic apply: updates stateVersion by 1, creates audit event, preserves runtime fields and collections', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const beforeSnap = readProjectSnapshot(ws.dir)!;
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio (Lead Architect)' });

    const beforeStateVersion = beforeSnap.state.projects.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN').stateVersion;
    const beforeAudits = beforeSnap.state.auditLogs['PRJ-DOCMONSTAKRAKIN'] || [];

    const result = applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio (Lead Architect)',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });

    assert.equal(result.status, 'APPLIED');
    assert.equal(result.mutationCount, 1);
    assert.equal(result.newStateVersion, beforeStateVersion + 1);
    assert.ok(result.auditEventId);

    const afterSnap = readProjectSnapshot(ws.dir)!;
    const afterDmk = afterSnap.state.projects.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN');
    assert.equal(afterDmk.stateVersion, beforeStateVersion + 1);

    // Audit logs validation
    const afterAudits = afterSnap.state.auditLogs['PRJ-DOCMONSTAKRAKIN'];
    assert.equal(afterAudits.length, beforeAudits.length + 1);
    assert.equal(afterAudits[0].action, 'WORK_ITEMS_WBS_SYNCHRONIZED');
    assert.equal(afterAudits[0].id, result.auditEventId);

    // Work items checks
    const afterWorkItems = afterSnap.state.workItems['PRJ-DOCMONSTAKRAKIN'];
    const dmk203 = afterWorkItems.find((w: any) => w.id === 'DMK-203');
    assert.ok(dmk203);
    assert.equal(dmk203.status, 'VERIFIED'); // Updated to canonical mapped status
    assert.equal(dmk203.priority, 'P0'); // Updated
    assert.equal(dmk203.sprint, 4); // Preserved runtime field!
    assert.equal(dmk203.owner, 'Lead Dev'); // Preserved runtime field!
    assert.equal(dmk203.checklist[0].text, 'Operational checklist item'); // Preserved checklist!
    assert.equal(dmk203.checklist[0].done, true); // Preserved checklist state!
    assert.equal(dmk203.canonicalManaged, true);
    assert.equal(dmk203.canonicalWbsPath, '13.06.16');

    // Missing items created
    const dmk205 = afterWorkItems.find((w: any) => w.id === 'DMK-205');
    assert.ok(dmk205);
    assert.equal(dmk205.status, 'READY');
    assert.equal(dmk205.type, 'FEATURE');
    assert.equal(dmk205.canonicalManaged, true);

    // Runtime only item preserved untouched
    const runtimeOnly = afterWorkItems.find((w: any) => w.id === 'DMK-RUNTIME-ONLY');
    assert.ok(runtimeOnly);
    assert.equal(runtimeOnly.status, 'IN_PROGRESS');

    // Unrelated project preserved untouched
    const otherProj = afterSnap.state.projects.find((p: any) => p.id === 'PRJ-OTHER');
    assert.deepEqual(otherProj, beforeSnap.state.projects.find((p: any) => p.id === 'PRJ-OTHER'));
    assert.deepEqual(afterSnap.state.workItems['PRJ-OTHER'], beforeSnap.state.workItems['PRJ-OTHER']);
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Independent verifier validates post-apply snapshot and confirms audit chain integrity', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const beforeSnap = readProjectSnapshot(ws.dir)!;
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio (Lead Architect)' });

    applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio (Lead Architect)',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });

    const afterSnap = readProjectSnapshot(ws.dir)!;
    const verification = verifyReconciliationOutcome({
      beforeSnapshot: beforeSnap,
      afterSnapshot: afterSnap,
      plan,
      workspaceRoot: ws.dir,
    });

    assert.equal(verification.valid, true, `Verification errors: ${verification.errors.join('; ')}`);
    assert.equal(verification.errors.length, 0);
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

// ==========================================
// GROUP 5: Protocol Hardening (V2, Digest, Tampering, Idempotency)
// ==========================================

test('Deterministic plan generation: identical inputs + actor + timestamp produce byte-for-byte identical plan', () => {
  const ws = createSyntheticWorkspace();
  try {
    const fixedTimestamp = '2026-10-02T12:00:00.000Z';
    const plan1 = generateReconciliationPlan({
      workspaceRoot: ws.dir,
      actor: 'Gio (Lead Architect)',
      timestamp: fixedTimestamp,
    });
    const plan2 = generateReconciliationPlan({
      workspaceRoot: ws.dir,
      actor: 'Gio (Lead Architect)',
      timestamp: fixedTimestamp,
    });

    assert.equal(plan1.formatVersion, PLAN_FORMAT_VERSION);
    assert.equal(plan1.operationId, plan2.operationId);
    assert.equal(plan1.planId, plan2.planId);
    assert.equal(plan1.planDigest, plan2.planDigest);
    assert.equal(plan1.candidateSnapshotDigest, plan2.candidateSnapshotDigest);
    assert.deepEqual(plan1, plan2);
  } finally {
    ws.cleanup();
  }
});

test('Deterministic operationId and planId format', () => {
  const ws = createSyntheticWorkspace();
  try {
    const fixedTimestamp = '2026-10-02T12:00:00.000Z';
    const plan = generateReconciliationPlan({
      workspaceRoot: ws.dir,
      actor: 'Gio (Lead Architect)',
      timestamp: fixedTimestamp,
    });

    assert.equal(plan.formatVersion, 'DMK_SELF_WBS_SYNC_V2');
    assert.match(plan.operationId, /^[0-9a-f]{64}$/);
    assert.equal(plan.planId, `PLAN-WBS-SYNC-${plan.operationId.slice(0, 16).toUpperCase()}`);
    assert.ok(plan.auditEvent);
    assert.equal(plan.auditEvent.id, `AUD-WBS-${plan.operationId.slice(0, 16).toUpperCase()}`);
    assert.equal(plan.auditEvent.action, 'WORK_ITEMS_WBS_SYNCHRONIZED');
    assert.equal(plan.auditEvent.timestamp, fixedTimestamp);
  } finally {
    ws.cleanup();
  }
});

test('Candidate snapshot digest is reproducible and matches pure projection output', () => {
  const ws = createSyntheticWorkspace();
  try {
    const fixedTimestamp = '2026-10-02T12:00:00.000Z';
    const { plan, candidate } = projectSelfWorkItemReconciliation({
      workspaceRoot: ws.dir,
      actor: 'Gio (Lead Architect)',
      timestamp: fixedTimestamp,
    });

    const computedDigest = crypto
      .createHash('sha256')
      .update(serializeSnapshot(candidate))
      .digest('hex');
    assert.equal(plan.candidateSnapshotDigest, computedDigest);
    assert.ok(plan.candidateSnapshotDigest);
  } finally {
    ws.cleanup();
  }
});

test('Apply rejects V1 plan format with UNSUPPORTED_RECONCILIATION_PLAN_VERSION', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    (plan as any).formatVersion = 'DMK_SELF_WBS_SYNC_V1';

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /UNSUPPORTED_RECONCILIATION_PLAN_VERSION/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Apply rejects when actor does not match plan actor with APPLY_ACTOR_MISMATCH', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio (Lead Architect)' });

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Different Operator',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /APPLY_ACTOR_MISMATCH/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan: mutating proposedCreations fails plan digest check', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    plan.proposedCreations[0].title = 'Tampered Creation Title';

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan: mutating proposedUpdates fails plan digest check', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    assert.ok(plan.proposedUpdates.length > 0);
    plan.proposedUpdates[0].after.description = 'Tampered description';

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan: mutating rows fails plan digest check', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    plan.rows[0].category = 'SYNCED';

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan: mutating summary fails plan digest check', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    plan.summary.missingRuntime = 999;

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan: mutating auditEvent fails plan digest check', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    if (plan.auditEvent) {
      plan.auditEvent.actor = 'Attacker';
    }

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan: mutating runtimeOnlyWarnings fails plan digest check', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    plan.runtimeOnlyWarnings.push('Forged warning');

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan: mutating blockedReasons fails plan digest check', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    plan.blockedReasons['FAKE'] = 'Fake blocked reason';

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Tampered plan with recomputed digest: mutated candidate status to RELEASED is rejected as TAMPERED_PLAN', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    // Mutate proposed update status to RELEASED and recompute planDigest to simulate sophisticated bypass
    if (plan.proposedUpdates.length > 0) {
      plan.proposedUpdates[0].after.status = 'RELEASED' as any;
    }
    plan.planDigest = computePlanDigest(plan);

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /TAMPERED_PLAN/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Apply fails closed when plan contains blocked items with RECONCILIATION_BLOCKED_ITEMS_PRESENT', () => {
  const customWbs = `
version: "1.0"
project: "PRJ-DOCMONSTAKRAKIN"
baseline: "v0.1.0-rc1"
items:
  - id: "DMK-UNPROVEN"
    wbs_path: "13.99.01"
    parent_id: "EPIC-13"
    epic: "EPIC-13"
    phase: "PHASE-12"
    title: "Unproven Item"
    description: "No evidence"
    type: "FEATURE"
    priority: "P1"
    risk: "MEDIUM"
    status: "VERIFIED"
    requirements: []
    dependencies: []
    acceptance_criteria: []
    evidence: []
`;
  const ws = createSyntheticWorkspace({ wbsYamlContent: customWbs });
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    assert.ok(plan.summary.blocked > 0);

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
        }),
      /RECONCILIATION_BLOCKED_ITEMS_PRESENT/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Idempotency: Re-applying already applied plan returns ALREADY_APPLIED with 0 mutations and 0 added audits', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio (Lead Architect)' });

    // 1st Apply
    const res1 = applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio (Lead Architect)',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });
    assert.equal(res1.status, 'APPLIED');
    assert.equal(res1.mutationCount, 1);

    const snapAfterFirst = readProjectSnapshot(ws.dir)!;
    const auditCountAfterFirst = snapAfterFirst.state.auditLogs['PRJ-DOCMONSTAKRAKIN'].length;

    // 2nd Apply with identical plan
    const res2 = applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio (Lead Architect)',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });
    assert.equal(res2.status, 'ALREADY_APPLIED');
    assert.equal(res2.mutationCount, 0);

    const snapAfterSecond = readProjectSnapshot(ws.dir)!;
    const auditCountAfterSecond = snapAfterSecond.state.auditLogs['PRJ-DOCMONSTAKRAKIN'].length;

    // Verify 0 writes, 0 added audit events
    assert.equal(auditCountAfterSecond, auditCountAfterFirst);
    assert.deepEqual(snapAfterFirst, snapAfterSecond);
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('No-change plan returns ALREADY_SYNCHRONIZED with 0 mutations and 0 disk writes', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    // First synchronize
    const plan1 = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio (Lead Architect)' });
    applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan: plan1,
      actor: 'Gio (Lead Architect)',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan1.planDigest,
    });

    // Now generate a new plan from the fully synchronized state
    const plan2 = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio (Lead Architect)' });
    assert.equal(plan2.proposedCreations.length, 0);
    assert.equal(plan2.proposedUpdates.length, 0);
    assert.equal(plan2.summary.missingRuntime, 0);
    assert.equal(plan2.summary.statusDrift, 0);
    assert.equal(plan2.summary.metadataDrift, 0);

    const snapBefore = readProjectSnapshot(ws.dir)!;
    const res = applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan: plan2,
      actor: 'Gio (Lead Architect)',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan2.planDigest,
    });

    assert.equal(res.status, 'ALREADY_SYNCHRONIZED');
    assert.equal(res.mutationCount, 0);
    const snapAfter = readProjectSnapshot(ws.dir)!;
    assert.deepEqual(snapBefore, snapAfter);
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Actor validation rejects invalid actors', () => {
  assert.throws(() => validateActor(''), /INVALID_REVIEW_ACTOR/);
  assert.throws(() => validateActor(' '), /INVALID_REVIEW_ACTOR/);
  assert.throws(() => validateActor('A'), /INVALID_REVIEW_ACTOR/);
  assert.throws(() => validateActor('a'.repeat(101)), /INVALID_REVIEW_ACTOR/);
  assert.throws(() => validateActor('Actor<script>'), /INVALID_REVIEW_ACTOR/);
  assert.doesNotThrow(() => validateActor('Gio (Lead Architect)'));
  assert.doesNotThrow(() => validateActor('codex_bot-01'));
});

test('Timestamp validation rejects invalid timestamps', () => {
  assert.throws(() => validateTimestamp(''), /INVALID_REVIEW_TIMESTAMP/);
  assert.throws(() => validateTimestamp('invalid-date'), /INVALID_REVIEW_TIMESTAMP/);
  assert.throws(() => validateTimestamp('2026-13-45T99:99:99Z'), /INVALID_REVIEW_TIMESTAMP/);
  assert.doesNotThrow(() => validateTimestamp(new Date().toISOString()));
  assert.doesNotThrow(() => validateTimestamp('2026-10-02T12:00:00.000Z'));
});

test('Independent verifier rejects plan with invalid formatVersion', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    (plan as any).formatVersion = 'DMK_SELF_WBS_SYNC_V1';

    const verification = verifyReconciliationOutcome({
      plan,
      workspaceRoot: ws.dir,
    });
    assert.equal(verification.valid, false);
    assert.ok(verification.errors.some((e) => e.includes('Invalid plan formatVersion')));
  } finally {
    ws.cleanup();
  }
});

test('Independent verifier rejects plan with tampered planDigest', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });
    plan.planDigest = '0000000000000000000000000000000000000000000000000000000000000000';

    const verification = verifyReconciliationOutcome({
      plan,
      workspaceRoot: ws.dir,
    });
    assert.equal(verification.valid, false);
    assert.ok(verification.errors.some((e) => e.includes('Plan digest invalid')));
  } finally {
    ws.cleanup();
  }
});

test('Independent verifier rejects outcome when candidateSnapshotDigest does not match after snapshot', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const beforeSnap = readProjectSnapshot(ws.dir)!;
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });

    const afterSnap = readProjectSnapshot(ws.dir)!;
    // Mutate afterSnap
    afterSnap.state.projects[0].description = 'Tampered after apply';

    const verification = verifyReconciliationOutcome({
      beforeSnapshot: beforeSnap,
      afterSnapshot: afterSnap,
      plan,
      workspaceRoot: ws.dir,
    });
    assert.equal(verification.valid, false);
    assert.ok(
      verification.errors.some(
        (e) => e.includes('After snapshot digest mismatch') || e.includes('candidate snapshot differs')
      )
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Independent verifier rejects outcome when audit event ID or action is invalid', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const beforeSnap = readProjectSnapshot(ws.dir)!;
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });

    const afterSnap = readProjectSnapshot(ws.dir)!;
    afterSnap.state.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].action = 'FORGED_ACTION';

    const verification = verifyReconciliationOutcome({
      beforeSnapshot: beforeSnap,
      afterSnapshot: afterSnap,
      plan,
      workspaceRoot: ws.dir,
    });
    assert.equal(verification.valid, false);
    assert.ok(
      verification.errors.some(
        (e) => e.includes('does not match plan.auditEvent') || e.includes('Audit chain invalid')
      )
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Independent verifier rejects outcome if audit ledger chain fails', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const beforeSnap = readProjectSnapshot(ws.dir)!;
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });

    const afterSnap = readProjectSnapshot(ws.dir)!;
    afterSnap.state.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].hash = '0000000000000000000000000000000000000000000000000000000000000000';

    const verification = verifyReconciliationOutcome({
      beforeSnapshot: beforeSnap,
      afterSnapshot: afterSnap,
      plan,
      workspaceRoot: ws.dir,
    });
    assert.equal(verification.valid, false);
    assert.ok(
      verification.errors.some(
        (e) => e.includes('Audit chain invalid') || e.includes('does not match plan.auditEvent')
      )
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Independent verifier rejects outcome if unrelated project was altered', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const beforeSnap = readProjectSnapshot(ws.dir)!;
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });

    const afterSnap = readProjectSnapshot(ws.dir)!;
    afterSnap.state.projects.find((p: any) => p.id === 'PRJ-OTHER').description = 'Drifted unrelated project';

    const verification = verifyReconciliationOutcome({
      beforeSnapshot: beforeSnap,
      afterSnapshot: afterSnap,
      plan,
      workspaceRoot: ws.dir,
    });
    assert.equal(verification.valid, false);
    assert.ok(verification.errors.some((e) => e.includes('Unrelated project') || e.includes('Candidate snapshot digest mismatch')));
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Independent verifier rejects outcome if WBS hash changed between plan and verification', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const beforeSnap = readProjectSnapshot(ws.dir)!;
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    applyReconciliationPlan({
      workspaceRoot: ws.dir,
      plan,
      actor: 'Gio',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      confirmPlanDigest: plan.planDigest,
    });

    const afterSnap = readProjectSnapshot(ws.dir)!;

    // Mutate WBS after apply
    const wbsPath = resolveMasterWbsPath(ws.dir);
    fs.appendFileSync(wbsPath, '\n# Post-apply WBS mutation\n');

    const verification = verifyReconciliationOutcome({
      beforeSnapshot: beforeSnap,
      afterSnapshot: afterSnap,
      plan,
      workspaceRoot: ws.dir,
    });
    assert.equal(verification.valid, false);
    assert.ok(verification.errors.some((e) => e.includes('WBS digest mismatch')));
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

test('Pre-rename WBS anti-TOCTOU: Modifying MASTER_WBS.yaml in beforeRename hook rejects with WBS_TOCTOU_MISMATCH', () => {
  const ws = createSyntheticWorkspace();
  try {
    process.env.DMK_WBS_SYNC_EXECUTE = 'PRJ-DOCMONSTAKRAKIN';
    const plan = generateReconciliationPlan({ workspaceRoot: ws.dir, actor: 'Gio' });

    assert.throws(
      () =>
        applyReconciliationPlan({
          workspaceRoot: ws.dir,
          plan,
          actor: 'Gio',
          confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
          confirmPlanDigest: plan.planDigest,
          hooks: {
            beforeRename: () => {
              const wbsPath = resolveMasterWbsPath(ws.dir);
              fs.appendFileSync(wbsPath, '\n# Race condition modification during write\n');
            },
          },
        }),
      /WBS_TOCTOU_MISMATCH/
    );
  } finally {
    delete process.env.DMK_WBS_SYNC_EXECUTE;
    ws.cleanup();
  }
});

// ----------------------------------------------------
// Provenance & Pending Human Approval Invariant Tests
// ----------------------------------------------------

test('Provenance: VERIFIED + uppercase PENDING human approval is BLOCKED', () => {
  const item: any = {
    id: 'DMK-TEST',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'PENDING - Gio manual retest',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item), false);
});

test('Provenance: Lowercase "pending" human approval is BLOCKED', () => {
  const item1: any = {
    id: 'DMK-TEST-1',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'pending human review',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item1), false);

  const item2: any = {
    id: 'DMK-TEST-2',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'PENDING - no release authority granted',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item2), false);

  const item3: any = {
    id: 'DMK-TEST-3',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'pending',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item3), false);
});

test('Provenance: Missing human approval is BLOCKED', () => {
  const item: any = {
    id: 'DMK-TEST',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item), false);

  const itemEmpty: any = { ...item, humanApprovedBy: '   ' };
  assert.equal(hasValidVerificationProvenance(itemEmpty), false);
});

test('Provenance: Non-VERIFIED verification_status is BLOCKED', () => {
  const item1: any = {
    id: 'DMK-TEST-1',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFICATION_PENDING',
    humanApprovedBy: 'Gio / authorized human operator',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item1), false);

  const item2: any = {
    id: 'DMK-TEST-2',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    humanApprovedBy: 'Gio / authorized human operator',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item2), false);
});

test('Provenance: Missing verified_by is BLOCKED', () => {
  const item: any = {
    id: 'DMK-TEST',
    status: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'Gio / authorized human operator',
    evidence: ['docs/test.md'],
  };
  assert.equal(hasValidVerificationProvenance(item), false);

  const itemEmpty: any = { ...item, verifiedBy: '   ' };
  assert.equal(hasValidVerificationProvenance(itemEmpty), false);
});

test('Provenance: Missing or empty evidence is BLOCKED', () => {
  const item1: any = {
    id: 'DMK-TEST-1',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'Gio / authorized human operator',
    evidence: [],
  };
  assert.equal(hasValidVerificationProvenance(item1), false);

  const item2: any = {
    id: 'DMK-TEST-2',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'Gio / authorized human operator',
  };
  assert.equal(hasValidVerificationProvenance(item2), false);
});

test('Provenance: Fully completed verification provenance is eligible for VERIFIED projection', () => {
  const item: any = {
    id: 'DMK-TEST',
    status: 'VERIFIED',
    verifiedBy: 'Gio / Lead Architect',
    verificationStatus: 'VERIFIED',
    humanApprovedBy: 'Gio / authorized human operator',
    evidence: ['docs/07_verification/report.json'],
  };
  assert.equal(hasValidVerificationProvenance(item), true);
});

test('Provenance: DMK-192 in real MASTER_WBS.yaml satisfies strict provenance rule', () => {
  const doc = readCanonicalWbs();
  const dmk192 = doc.items.find((i) => i.id === 'DMK-192');
  assert.ok(dmk192, 'DMK-192 must exist in MASTER_WBS.yaml');
  assert.equal(dmk192.status, 'VERIFIED');
  assert.equal(hasValidVerificationProvenance(dmk192), true);
});

test('Provenance: DMK-193 in real MASTER_WBS.yaml satisfies strict provenance rule', () => {
  const doc = readCanonicalWbs();
  const dmk193 = doc.items.find((i) => i.id === 'DMK-193');
  assert.ok(dmk193, 'DMK-193 must exist in MASTER_WBS.yaml');
  assert.equal(dmk193.status, 'VERIFIED');
  assert.equal(hasValidVerificationProvenance(dmk193), true);
});

test('Provenance: All 9 historical items in real MASTER_WBS.yaml remain strictly BLOCKED', () => {
  const doc = readCanonicalWbs();
  const blockedIds = [
    'DMK-187', 'DMK-188', 'DMK-189', 'DMK-190',
    'DMK-156', 'DMK-157', 'DMK-158', 'DMK-159', 'DMK-165',
  ];
  for (const id of blockedIds) {
    const item = doc.items.find((i) => i.id === id);
    assert.ok(item, `Item ${id} must exist in MASTER_WBS.yaml`);
    assert.equal(
      hasValidVerificationProvenance(item),
      false,
      `Item ${id} must be BLOCKED by strict provenance rule`
    );
  }
});

// ----------------------------------------------------
// Reviewer Actor Binding & CLI Validation Tests
// ----------------------------------------------------

test('Actor: generateReconciliationPlan without actor rejects with INVALID_REVIEW_ACTOR', () => {
  assert.throws(
    () => generateReconciliationPlan({ actor: undefined as any }),
    /INVALID_REVIEW_ACTOR/
  );
  assert.throws(
    () => generateReconciliationPlan({ actor: '' }),
    /INVALID_REVIEW_ACTOR/
  );
  assert.throws(
    () => generateReconciliationPlan({ actor: '   ' }),
    /INVALID_REVIEW_ACTOR/
  );
});

test('Actor: generateReconciliationPlan with explicit valid actor succeeds', () => {
  const ws = createSyntheticWorkspace();
  try {
    const plan = generateReconciliationPlan({
      workspaceRoot: ws.dir,
      actor: 'Gio (Lead Architect)',
    });
    assert.equal(plan.actor, 'Gio (Lead Architect)');
  } finally {
    ws.cleanup();
  }
});

test('Actor: CLI dry-run without --actor rejects with exit code and error message', () => {
  try {
    execSync('npx tsx scripts/reconcileSelfWorkItems.ts --dry-run', {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    assert.fail('Expected CLI dry-run without --actor to exit with non-zero code');
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    assert.ok(
      stderr.includes('INVALID_REVIEW_ACTOR'),
      `Expected stderr to contain INVALID_REVIEW_ACTOR, got: ${stderr}`
    );
  }
});

// ----------------------------------------------------
// Pure Canonical WBS Parser & Exact Bytes Tests
// ----------------------------------------------------

test('Parser: parseCanonicalWbsBytes parses valid WBS bytes and computes exact SHA-256', () => {
  const ws = createSyntheticWorkspace();
  try {
    const wbsPath = resolveMasterWbsPath(ws.dir);
    const rawBytes = fs.readFileSync(wbsPath);
    const expectedSha = crypto.createHash('sha256').update(rawBytes).digest('hex');

    const doc = parseCanonicalWbsBytes(rawBytes);
    assert.equal(doc.rawSha256, expectedSha);
    assert.equal(doc.project, 'PRJ-DOCMONSTAKRAKIN');
    assert.ok(doc.items.length > 0);
  } finally {
    ws.cleanup();
  }
});

test('Parser: parseCanonicalWbsBytes fails closed on duplicate item ID', () => {
  const yamlContent = `
version: "1.0"
project: PRJ-TEST
baseline: v0.1
items:
  - id: DMK-DUP
    wbs_path: "01.01"
    epic: "EPIC-01"
    title: "First"
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
    status: "READY"
  - id: DMK-DUP
    wbs_path: "01.02"
    epic: "EPIC-01"
    title: "Second"
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
    status: "READY"
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(yamlContent, 'utf8')),
    /Duplicate WBS item ID detected: "DMK-DUP"/
  );
});

test('Parser: parseCanonicalWbsBytes fails closed on duplicate WBS path', () => {
  const yamlContent = `
version: "1.0"
project: PRJ-TEST
baseline: v0.1
items:
  - id: DMK-A
    wbs_path: "01.01"
    epic: "EPIC-01"
    title: "Item A"
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
    status: "READY"
  - id: DMK-B
    wbs_path: "01.01"
    epic: "EPIC-01"
    title: "Item B"
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
    status: "READY"
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(yamlContent, 'utf8')),
    /Duplicate WBS path detected: "01.01"/
  );
});

test('Parser: parseCanonicalWbsBytes fails closed on invalid YAML syntax', () => {
  const invalidYaml = `
items:
  - id: DMK-1
    title: [broken unclosed array
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(invalidYaml, 'utf8')),
    /Failed to parse MASTER_WBS.yaml/
  );
});

test('Parser: parseCanonicalWbsBytes fails closed on missing items array', () => {
  const noItemsYaml = `
version: "1.0"
project: PRJ-TEST
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(noItemsYaml, 'utf8')),
    /Invalid MASTER_WBS.yaml: items must be an array/
  );
});

test('Parser: parseCanonicalWbsBytes fails closed on empty item ID or WBS path', () => {
  const emptyIdYaml = `
items:
  - id: ""
    wbs_path: "01.01"
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(emptyIdYaml, 'utf8')),
    /missing id/
  );

  const emptyPathYaml = `
items:
  - id: "DMK-VALID"
    wbs_path: ""
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(emptyPathYaml, 'utf8')),
    /missing wbs_path/
  );
});

test('Parser determinism: same exact bytes produce identical digest and normalized items', () => {
  const ws = createSyntheticWorkspace();
  try {
    const rawBytes = fs.readFileSync(resolveMasterWbsPath(ws.dir));
    const doc1 = parseCanonicalWbsBytes(rawBytes);
    const doc2 = parseCanonicalWbsBytes(rawBytes);

    assert.equal(doc1.rawSha256, doc2.rawSha256);
    assert.deepEqual(doc1.items, doc2.items);
  } finally {
    ws.cleanup();
  }
});

test('WBS Consistency: supplied wbsBytes controls BOTH digest and projection (does not read disk)', () => {
  const ws = createSyntheticWorkspace();
  try {
    // Disk WBS has default synthetic content.
    // Construct distinct version B bytes:
    const versionBYaml = `
version: "2.0-custom"
project: PRJ-DOCMONSTAKRAKIN
baseline: v0.1
items:
  - id: DMK-CUSTOM-999
    wbs_path: "13.99.99"
    epic: "EPIC-13"
    phase: "PHASE-CUSTOM"
    title: "Distinct Version B Task"
    description: "Injected purely via wbsBytes memory buffer"
    type: "FEATURE"
    priority: "P1"
    risk: "MEDIUM"
    status: "READY"
    requirements: []
    dependencies: []
    acceptanceCriteria: []
    evidence: []
`;
    const versionBBytes = Buffer.from(versionBYaml, 'utf8');
    const versionBSha = crypto.createHash('sha256').update(versionBBytes).digest('hex');

    const snapBytes = Buffer.from(serializeSnapshot(readProjectSnapshot(ws.dir)!), 'utf8');
    const projection = projectSelfWorkItemReconciliation({
      workspaceRoot: ws.dir,
      wbsBytes: versionBBytes,
      snapshotBytes: snapBytes,
      actor: 'Gio (Lead Architect)',
      timestamp: '2026-10-02T12:00:00.000Z',
    });

    // 1. WBS SHA-256 must match version B
    assert.equal(projection.plan.wbsSha256, versionBSha);

    // 2. Proposed creations must reflect version B item DMK-CUSTOM-999, NOT disk items
    const creationIds = projection.plan.proposedCreations.map((c) => c.id);
    assert.ok(
      creationIds.includes('DMK-CUSTOM-999'),
      'Plan must project creation of DMK-CUSTOM-999 from supplied wbsBytes'
    );
    assert.equal(
      creationIds.length,
      1,
      'Plan must contain only items from supplied wbsBytes, ignoring disk items'
    );

    // 3. Row title must match version B
    const customRow = projection.plan.rows.find((r) => r.id === 'DMK-CUSTOM-999');
    assert.ok(customRow, 'Row for DMK-CUSTOM-999 must exist in projection');
    assert.equal(customRow.title, 'Distinct Version B Task');
  } finally {
    ws.cleanup();
  }
});

console.log(`\n======================================================`);
console.log(`All ${passedCount} DMK-205 self-tracking test scenarios PASSED cleanly.`);
console.log(`======================================================`);

