import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {
  readCanonicalWbs,
  getScopedCanonicalWbsItems,
  computeMasterWbsSha256,
} from '../server/workTracking/canonicalWbs.ts';
import {
  CANONICAL_LIFECYCLE_STATUSES,
  isCanonicalLifecycleStatus,
  type CanonicalLifecycleStatus,
} from '../server/workTracking/canonicalLifecycle.ts';

export interface AuditCandidateItem {
  id: string;
  wbsPath: string;
  title: string;
  currentStatus: CanonicalLifecycleStatus;
  candidateStatus: CanonicalLifecycleStatus;
  action: 'KEEP' | 'TRANSITION';
  evidenceRefs: string[];
  rationale: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  humanDecisionRequired: string;
}

export interface Dmk208StatusAuditCandidate {
  schemaVersion: string;
  projectId: string;
  workItemId: string;
  baseMasterSha: string;
  canonicalWbsSha256: string;
  candidateDigest: string;
  generatedAt: string;
  generatedBy: string;
  scopeEpic: string;
  scopeCount: number;
  items: AuditCandidateItem[];
}

export interface ApprovedTransitionItem {
  id: string;
  from: string;
  to: string;
}

export interface Dmk208StatusAuditReceipt {
  schemaVersion: string;
  workItemId: string;
  candidateDigest: string;
  decision: string;
  decisionAuthority: string;
  decisionSource: string;
  preApplyMasterSha: string;
  preApplyBranchSha: string;
  preApplyCanonicalWbsSha256: string;
  scopeEpic: string;
  scopeCount: number;
  approvedTransitions: ApprovedTransitionItem[];
  applied: boolean;
  appliedAt: string;
  postApplyCanonicalWbsSha256: string;
  preApplyRuntimeWorkItemsSha256: string;
  postApplyRuntimeWorkItemsSha256: string;
  runtimeWorkItemMutationCount: number;
  liveReconciliationExecuted: boolean;
  gate7Changed: boolean;
  releaseChanged: boolean;
}

export interface Dmk208ClosureReceipt {
  schemaVersion: string;
  workItemId: string;
  decision: string;
  decisionAuthority: string;
  decisionSource: string;
  fromStatus: string;
  toStatus: string;
  approvedCandidateDigest: string;
  statusAuditApplicationReceipt: string;
  preClosureBranchSha: string;
  preClosureMasterSha: string;
  preClosureCanonicalWbsSha256: string;
  applied: boolean;
  appliedAt: string;
  postClosureCanonicalWbsSha256: string;
  preClosureRuntimeWorkItemsSha256: string;
  postClosureRuntimeWorkItemsSha256: string;
  runtimeWorkItemMutationCount: number;
  liveReconciliationExecuted: boolean;
  gate7Changed: boolean;
  releaseChanged: boolean;
}

export const EXPECTED_BASE_MASTER_SHA = '2a473df75d45aab2df3f55f37fec2d24ed403811';
export const EXPECTED_PRE_CLOSURE_BRANCH_SHA = '68bd19f85f1b6da7a081fce28e778813669a2ca8';
export const EXPECTED_SCOPE_EPIC = 'EPIC-13';
export const EXPECTED_SCOPE_COUNT = 27;
export const EXPECTED_PROJECT_ID = 'PRJ-DOCMONSTAKRAKIN';
export const EXPECTED_WORK_ITEM_ID = 'DMK-208';
export const EXPECTED_SCHEMA_VERSION = '1.0';

export function computeCandidateDigest(items: AuditCandidateItem[]): string {
  const canonicalItems = items.map((i) => ({
    id: i.id,
    wbsPath: i.wbsPath,
    currentStatus: i.currentStatus,
    candidateStatus: i.candidateStatus,
    action: i.action,
    evidenceRefs: [...i.evidenceRefs].sort(),
    rationale: i.rationale.trim(),
    confidence: i.confidence,
    humanDecisionRequired: i.humanDecisionRequired.trim(),
  }));
  // Sort deterministically by WBS path
  canonicalItems.sort((a, b) => a.wbsPath.localeCompare(b.wbsPath, undefined, { numeric: true }));
  const jsonStr = JSON.stringify(canonicalItems);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

export interface VerifyOptions {
  customCandidate?: Dmk208StatusAuditCandidate;
  customReceipt?: Dmk208StatusAuditReceipt;
  customClosureReceipt?: Dmk208ClosureReceipt;
  forceMode?: 'PRE_APPLY' | 'POST_APPLY_APPROVED' | 'POST_CLOSURE_APPROVED';
  simulateStatusOverrides?: Record<string, string>;
}

export function verifyDmk208StatusAudit(
  workspaceRoot: string,
  candidatePath?: string,
  receiptPath?: string,
  options?: VerifyOptions
): {
  valid: boolean;
  mode: 'PRE_APPLY' | 'POST_APPLY_APPROVED' | 'POST_CLOSURE_APPROVED';
  summary: { total: number; keep: number; transition: number; candidateDigest: string };
} {
  const cPath = candidatePath ?? path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-candidate.json');
  let data: Dmk208StatusAuditCandidate;
  if (options?.customCandidate) {
    data = options.customCandidate;
  } else {
    if (!fs.existsSync(cPath)) {
      throw new Error(`Audit candidate file not found: ${cPath}`);
    }
    const raw = fs.readFileSync(cPath, 'utf8');
    try {
      data = JSON.parse(raw);
    } catch (err: any) {
      throw new Error(`Failed to parse audit candidate JSON: ${err.message}`);
    }
  }

  assert.equal(data.schemaVersion, EXPECTED_SCHEMA_VERSION, `Invalid schemaVersion: expected ${EXPECTED_SCHEMA_VERSION}`);
  assert.equal(data.projectId, EXPECTED_PROJECT_ID, `Invalid projectId: expected ${EXPECTED_PROJECT_ID}`);
  assert.equal(data.workItemId, EXPECTED_WORK_ITEM_ID, `Invalid workItemId: expected ${EXPECTED_WORK_ITEM_ID}`);
  assert.equal(data.baseMasterSha, EXPECTED_BASE_MASTER_SHA, `Invalid baseMasterSha: expected ${EXPECTED_BASE_MASTER_SHA}`);
  assert.equal(data.scopeEpic, EXPECTED_SCOPE_EPIC, `Invalid scopeEpic: expected ${EXPECTED_SCOPE_EPIC}`);
  assert.equal(data.scopeCount, EXPECTED_SCOPE_COUNT, `Invalid scopeCount: expected ${EXPECTED_SCOPE_COUNT}`);

  const { scopedItems } = getScopedCanonicalWbsItems(workspaceRoot, EXPECTED_SCOPE_EPIC);
  assert.equal(
    scopedItems.length,
    EXPECTED_SCOPE_COUNT,
    `Scoped item count in MASTER_WBS.yaml (${scopedItems.length}) != expected (${EXPECTED_SCOPE_COUNT})`
  );

  assert.ok(Array.isArray(data.items), 'items must be an array');
  assert.equal(data.items.length, EXPECTED_SCOPE_COUNT, `Candidate items count (${data.items.length}) != ${EXPECTED_SCOPE_COUNT}`);

  const expectedDigest = computeCandidateDigest(data.items);
  assert.equal(
    data.candidateDigest,
    expectedDigest,
    `candidateDigest mismatch: declared=${data.candidateDigest}, computed=${expectedDigest}`
  );

  // Check audit application receipt
  const rPath = receiptPath ?? path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-status-audit-approval-receipt.json');
  let appReceipt: Dmk208StatusAuditReceipt | null = null;
  if (options?.customReceipt) {
    appReceipt = options.customReceipt;
  } else if (fs.existsSync(rPath)) {
    try {
      appReceipt = JSON.parse(fs.readFileSync(rPath, 'utf8'));
    } catch (err: any) {
      throw new Error(`Failed to parse audit receipt JSON: ${err.message}`);
    }
  }

  // Check closure receipt
  const clPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-closure-transition-receipt.json');
  let closureReceipt: Dmk208ClosureReceipt | null = null;
  if (options?.customClosureReceipt) {
    closureReceipt = options.customClosureReceipt;
  } else if (fs.existsSync(clPath)) {
    try {
      closureReceipt = JSON.parse(fs.readFileSync(clPath, 'utf8'));
    } catch (err: any) {
      throw new Error(`Failed to parse closure receipt JSON: ${err.message}`);
    }
  }

  let mode: 'PRE_APPLY' | 'POST_APPLY_APPROVED' | 'POST_CLOSURE_APPROVED';
  if (options?.forceMode) {
    mode = options.forceMode;
  } else if (closureReceipt !== null && closureReceipt.applied === true) {
    mode = 'POST_CLOSURE_APPROVED';
  } else if (appReceipt !== null && appReceipt.applied === true) {
    mode = 'POST_APPLY_APPROVED';
  } else {
    mode = 'PRE_APPLY';
  }

  const actualWbsSha = computeMasterWbsSha256(workspaceRoot);

  if (mode === 'POST_CLOSURE_APPROVED') {
    assert.ok(closureReceipt, 'Closure receipt must exist in POST_CLOSURE_APPROVED mode');
    assert.ok(appReceipt, 'Audit application receipt must exist in POST_CLOSURE_APPROVED mode');

    // 1. Verify audit application receipt
    assert.equal(appReceipt.decision, 'APPROVE', 'Audit application receipt decision must be APPROVE');
    assert.equal(appReceipt.candidateDigest, data.candidateDigest, 'Application receipt candidateDigest mismatch');
    assert.equal(appReceipt.preApplyCanonicalWbsSha256, data.canonicalWbsSha256, 'Application receipt preApplyCanonicalWbsSha256 mismatch');

    // 2. Verify closure receipt
    assert.equal(closureReceipt.schemaVersion, EXPECTED_SCHEMA_VERSION, 'Closure receipt schemaVersion mismatch');
    if (closureReceipt.workItemId !== EXPECTED_WORK_ITEM_ID) {
      throw new Error(`closure receipt workItemId mismatch: expected ${EXPECTED_WORK_ITEM_ID}, got ${closureReceipt.workItemId}`);
    }
    if (closureReceipt.decision !== 'APPROVE') {
      throw new Error(`decision other than APPROVE cannot authorize closure: ${closureReceipt.decision}`);
    }
    if (closureReceipt.fromStatus !== 'IN_PROGRESS') {
      throw new Error(`closure receipt source status mismatch: expected IN_PROGRESS, got ${closureReceipt.fromStatus}`);
    }
    if (closureReceipt.toStatus !== 'VERIFICATION_PENDING') {
      throw new Error(`closure receipt target status mismatch: expected VERIFICATION_PENDING, got ${closureReceipt.toStatus}`);
    }
    if (closureReceipt.approvedCandidateDigest !== data.candidateDigest) {
      throw new Error(`closure receipt candidateDigest mismatch: expected ${data.candidateDigest}, got ${closureReceipt.approvedCandidateDigest}`);
    }
    if (closureReceipt.preClosureCanonicalWbsSha256 !== appReceipt.postApplyCanonicalWbsSha256) {
      throw new Error(`closure receipt preClosureCanonicalWbsSha256 mismatch: expected ${appReceipt.postApplyCanonicalWbsSha256}, got ${closureReceipt.preClosureCanonicalWbsSha256}`);
    }
    if (closureReceipt.statusAuditApplicationReceipt !== 'docs/07_verification/dmk-208-status-audit-approval-receipt.json') {
      throw new Error(`closure receipt statusAuditApplicationReceipt linkage mismatch`);
    }
    assert.equal(closureReceipt.preClosureBranchSha, EXPECTED_PRE_CLOSURE_BRANCH_SHA, 'Closure receipt preClosureBranchSha mismatch');
    assert.equal(closureReceipt.preClosureMasterSha, EXPECTED_BASE_MASTER_SHA, 'Closure receipt preClosureMasterSha mismatch');

    if (!options?.simulateStatusOverrides) {
      if (actualWbsSha !== closureReceipt.postClosureCanonicalWbsSha256) {
        throw new Error(`postClosureCanonicalWbsSha256 mismatch: actual=${actualWbsSha}, receipt=${closureReceipt.postClosureCanonicalWbsSha256}`);
      }
    }
  } else if (mode === 'POST_APPLY_APPROVED') {
    assert.ok(appReceipt, 'Receipt must exist in POST_APPLY_APPROVED mode');
    if (appReceipt.decision !== 'APPROVE') {
      throw new Error(`decision other than APPROVE cannot authorize application: ${appReceipt.decision}`);
    }
    assert.equal(
      appReceipt.candidateDigest,
      data.candidateDigest,
      `candidateDigest mismatch in receipt: receipt=${appReceipt.candidateDigest}, candidate=${data.candidateDigest}`
    );
    assert.equal(
      appReceipt.preApplyCanonicalWbsSha256,
      data.canonicalWbsSha256,
      `pre-apply WBS digest mismatch: receipt=${appReceipt.preApplyCanonicalWbsSha256}, candidate=${data.canonicalWbsSha256}`
    );
    assert.equal(appReceipt.preApplyMasterSha, EXPECTED_BASE_MASTER_SHA, 'Receipt preApplyMasterSha mismatch');
    assert.equal(appReceipt.scopeEpic, EXPECTED_SCOPE_EPIC, 'Receipt scopeEpic mismatch');
    assert.equal(appReceipt.scopeCount, EXPECTED_SCOPE_COUNT, 'Receipt scopeCount mismatch');

    if (!options?.simulateStatusOverrides && !options?.customReceipt) {
      assert.equal(
        actualWbsSha,
        appReceipt.postApplyCanonicalWbsSha256,
        `postApplyCanonicalWbsSha256 mismatch: actual=${actualWbsSha}, receipt=${appReceipt.postApplyCanonicalWbsSha256}`
      );
    }

    const candidateTransitionItems = data.items.filter((i) => i.action === 'TRANSITION');
    assert.equal(
      appReceipt.approvedTransitions.length,
      candidateTransitionItems.length,
      `transition count mismatch: receipt=${appReceipt.approvedTransitions.length}, candidate=${candidateTransitionItems.length}`
    );

    const approvedMap = new Map(appReceipt.approvedTransitions.map((t) => [t.id, t]));
    for (const cTrans of candidateTransitionItems) {
      const app = approvedMap.get(cTrans.id);
      assert.ok(app, `missing approved transition in receipt for ${cTrans.id}`);
      assert.equal(
        app.from,
        cTrans.currentStatus,
        `source status mismatch for ${cTrans.id}: receipt=${app.from}, candidate=${cTrans.currentStatus}`
      );
      assert.equal(
        app.to,
        cTrans.candidateStatus,
        `target status mismatch for ${cTrans.id}: receipt=${app.to}, candidate=${cTrans.candidateStatus}`
      );
    }
  } else {
    // PRE_APPLY mode requires candidate canonicalWbsSha256 to equal current WBS SHA
    assert.equal(
      data.canonicalWbsSha256,
      actualWbsSha,
      `canonicalWbsSha256 mismatch: candidate=${data.canonicalWbsSha256}, actual=${actualWbsSha}`
    );
  }

  // Build canonical map, respecting any simulated test overrides
  const canonicalMap = new Map(
    scopedItems.map((i) => {
      const overrideStatus = options?.simulateStatusOverrides?.[i.id];
      if (overrideStatus) {
        return [i.id, { ...i, status: overrideStatus }];
      }
      return [i.id, i];
    })
  );

  const seenIds = new Set<string>();
  let keepCount = 0;
  let transitionCount = 0;

  for (const item of data.items) {
    assert.ok(item.id, 'Item must have an id');
    assert.ok(!seenIds.has(item.id), `Duplicate candidate item id: ${item.id}`);
    seenIds.add(item.id);

    const canonicalItem = canonicalMap.get(item.id);
    assert.ok(canonicalItem, `Unknown candidate item id not in canonical WBS: ${item.id}`);

    assert.ok(
      isCanonicalLifecycleStatus(item.candidateStatus),
      `Item ${item.id} candidateStatus "${item.candidateStatus}" is not a valid canonical v1 lifecycle status`
    );

    const forbidden = ['BLOCKED', 'DEFERRED', 'CANCELLED', 'ACCEPTED', 'SUPERSEDED'];
    assert.ok(
      !forbidden.includes(item.candidateStatus),
      `Item ${item.id} proposes forbidden non-v1 status: ${item.candidateStatus}`
    );

    if (mode === 'POST_CLOSURE_APPROVED') {
      if (item.id === 'DMK-208') {
        assert.equal(
          canonicalItem.status,
          'VERIFICATION_PENDING',
          `DMK-208 status mismatch in POST_CLOSURE_APPROVED mode: expected VERIFICATION_PENDING, got ${canonicalItem.status}`
        );
        keepCount++;
      } else if (item.action === 'KEEP') {
        assert.equal(
          canonicalItem.status,
          item.currentStatus,
          `KEEP item drift: Item ${item.id} status mismatch: expected ${item.currentStatus}, got ${canonicalItem.status}`
        );
        keepCount++;
      } else if (item.action === 'TRANSITION') {
        assert.equal(
          canonicalItem.status,
          item.candidateStatus,
          `TRANSITION item ${item.id} status mismatch: expected ${item.candidateStatus}, got ${canonicalItem.status}`
        );
        transitionCount++;
      }
    } else if (mode === 'POST_APPLY_APPROVED') {
      if (item.action === 'KEEP') {
        assert.equal(
          canonicalItem.status,
          item.currentStatus,
          `KEEP item drift: Item ${item.id} status mismatch: expected ${item.currentStatus}, got ${canonicalItem.status}`
        );
        keepCount++;
      } else if (item.action === 'TRANSITION') {
        assert.equal(
          canonicalItem.status,
          item.candidateStatus,
          `TRANSITION item ${item.id} status mismatch: expected ${item.candidateStatus}, got ${canonicalItem.status}`
        );
        transitionCount++;
      }
    } else {
      // PRE_APPLY
      assert.equal(
        item.currentStatus,
        canonicalItem.status,
        `Item ${item.id} currentStatus (${item.currentStatus}) does not match canonical WBS (${canonicalItem.status})`
      );
      if (item.action === 'KEEP') {
        assert.equal(item.candidateStatus, item.currentStatus);
        keepCount++;
      } else if (item.action === 'TRANSITION') {
        assert.notEqual(item.candidateStatus, item.currentStatus);
        transitionCount++;
      }
    }

    if (item.action === 'TRANSITION') {
      assert.ok(
        Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0,
        `Item ${item.id} marked TRANSITION must have at least one evidenceRef`
      );
      for (const ref of item.evidenceRefs) {
        if (
          ref.startsWith('src/') ||
          ref.startsWith('server/') ||
          ref.startsWith('scripts/') ||
          ref.startsWith('docs/') ||
          ref === 'server.ts'
        ) {
          const resolvedPath = path.resolve(workspaceRoot, ref);
          assert.ok(
            fs.existsSync(resolvedPath),
            `Item ${item.id} TRANSITION evidenceRef file does not exist on disk: ${ref}`
          );
        }
      }
      assert.ok(
        item.rationale && item.rationale.trim().length > 10,
        `Item ${item.id} marked TRANSITION must have a detailed rationale`
      );
    }

    assert.ok(
      ['HIGH', 'MEDIUM', 'LOW'].includes(item.confidence),
      `Item ${item.id} has invalid confidence: ${item.confidence}`
    );
    assert.ok(
      item.humanDecisionRequired && item.humanDecisionRequired.trim().length > 0,
      `Item ${item.id} must describe required human decision`
    );
  }

  // Ensure all canonical items are present
  for (const cItem of scopedItems) {
    assert.ok(seenIds.has(cItem.id), `Canonical item ${cItem.id} missing from audit candidate`);
  }

  return {
    valid: true,
    mode,
    summary: {
      total: data.items.length,
      keep: keepCount,
      transition: transitionCount,
      candidateDigest: data.candidateDigest,
    },
  };
}

// CLI runner
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  try {
    const res = verifyDmk208StatusAudit(process.cwd());
    console.log(`✓ [PASS] DMK-208 Status Audit Candidate is 100% valid (Mode: ${res.mode}).`);
    console.log(`  Scope count: ${res.summary.total} (KEEP: ${res.summary.keep}, TRANSITION: ${res.summary.transition})`);
    console.log(`  Candidate Digest: ${res.summary.candidateDigest}`);
    process.exit(0);
  } catch (err: any) {
    console.error('✗ [FAIL] DMK-208 Status Audit Candidate Verification Failed:');
    console.error(' ', err.message);
    process.exit(1);
  }
}
