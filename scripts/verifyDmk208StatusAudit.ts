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

export interface Dmk208PostMergeVerificationReceipt {
  schemaVersion: string;
  workItemId: string;
  decision: string;
  decisionAuthority: string;
  decisionSource: string;
  fromStatus: string;
  toStatus: string;
  mergedPullRequest: number;
  prHeadSha: string;
  mergeCommitSha: string;
  masterShaAtVerification: string;
  masterCiRunId: number;
  masterCiAttempt: number;
  masterCiConclusion: string;
  masterCiJobs: Record<string, string>;
  approvedCandidateDigest: string;
  statusAuditApplicationReceipt: string;
  closureTransitionReceipt: string;
  preVerificationCanonicalWbsSha256: string;
  postVerificationCanonicalWbsSha256: string;
  preVerificationRuntimeWorkItemsSha256: string;
  postVerificationRuntimeWorkItemsSha256: string;
  runtimeWorkItemMutationCount: number;
  technicalVerificationStatus: string;
  humanGovernanceStatus: string;
  liveReconciliationExecuted: boolean;
  gate7Changed: boolean;
  releaseChanged: boolean;
  verifiedAt: string;
}

export const EXPECTED_BASE_MASTER_SHA = '2a473df75d45aab2df3f55f37fec2d24ed403811';
export const EXPECTED_PRE_CLOSURE_BRANCH_SHA = '68bd19f85f1b6da7a081fce28e778813669a2ca8';
export const EXPECTED_SCOPE_EPIC = 'EPIC-13';
export const EXPECTED_SCOPE_COUNT = 27;
export const EXPECTED_PROJECT_ID = 'PRJ-DOCMONSTAKRAKIN';
export const EXPECTED_WORK_ITEM_ID = 'DMK-208';
export const EXPECTED_SCHEMA_VERSION = '1.0';

export const EXPECTED_MERGED_PR = 23;
export const EXPECTED_PR_HEAD_SHA = 'c1ce96fe5a42926647468c1dff41515efea98658';
export const EXPECTED_MERGE_COMMIT_SHA = '9c29280ea6888f9282b1f0a98c01a3c617f32eaf';
export const EXPECTED_MASTER_SHA_AT_VERIFICATION = '9c29280ea6888f9282b1f0a98c01a3c617f32eaf';
export const EXPECTED_MASTER_CI_RUN_ID = 37207533296;
export const EXPECTED_MASTER_CI_CONCLUSION = 'success';
export const EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256 = 'dfedba8e16bf7e41ae3a4df9d9ba81920821a6e850a053cb1386f369a51c8fbe';
export const EXPECTED_POST_VERIFICATION_CANONICAL_WBS_SHA256 = '974a5d8773902a24655efc3f341a70c38ad840e3738f0be3699c18c6bf690c82';

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
  customPostMergeReceipt?: Dmk208PostMergeVerificationReceipt;
  forceMode?: 'PRE_APPLY' | 'POST_APPLY_APPROVED' | 'POST_CLOSURE_APPROVED' | 'POST_MERGE_VERIFIED';
  simulateStatusOverrides?: Record<string, string>;
  simulateCanonicalItemOverrides?: Record<string, any>;
}

export function verifyDmk208StatusAudit(
  workspaceRoot: string,
  candidatePath?: string,
  receiptPath?: string,
  options?: VerifyOptions
): {
  valid: boolean;
  mode: 'PRE_APPLY' | 'POST_APPLY_APPROVED' | 'POST_CLOSURE_APPROVED' | 'POST_MERGE_VERIFIED';
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

  // Check post-merge verification receipt
  const pmPath = path.join(workspaceRoot, 'docs', '07_verification', 'dmk-208-post-merge-verification-receipt.json');
  let postMergeReceipt: Dmk208PostMergeVerificationReceipt | null = null;
  if (options?.customPostMergeReceipt) {
    postMergeReceipt = options.customPostMergeReceipt;
  } else if (fs.existsSync(pmPath)) {
    try {
      postMergeReceipt = JSON.parse(fs.readFileSync(pmPath, 'utf8'));
    } catch (err: any) {
      throw new Error(`Failed to parse post-merge verification receipt JSON: ${err.message}`);
    }
  }

  let mode: 'PRE_APPLY' | 'POST_APPLY_APPROVED' | 'POST_CLOSURE_APPROVED' | 'POST_MERGE_VERIFIED';
  if (options?.forceMode) {
    mode = options.forceMode;
  } else if (postMergeReceipt !== null && postMergeReceipt.decision === 'APPROVE') {
    mode = 'POST_MERGE_VERIFIED';
  } else if (closureReceipt !== null && closureReceipt.applied === true) {
    mode = 'POST_CLOSURE_APPROVED';
  } else if (appReceipt !== null && appReceipt.applied === true) {
    mode = 'POST_APPLY_APPROVED';
  } else {
    mode = 'PRE_APPLY';
  }

  const actualWbsSha = computeMasterWbsSha256(workspaceRoot);

  if (mode === 'POST_MERGE_VERIFIED') {
    assert.ok(postMergeReceipt, 'Post-merge verification receipt must exist in POST_MERGE_VERIFIED mode');
    assert.ok(closureReceipt, 'Closure receipt must exist in POST_MERGE_VERIFIED mode');
    assert.ok(appReceipt, 'Audit application receipt must exist in POST_MERGE_VERIFIED mode');

    // 1. Verify audit application receipt
    assert.equal(appReceipt.decision, 'APPROVE', 'Audit application receipt decision must be APPROVE');
    assert.equal(appReceipt.candidateDigest, data.candidateDigest, 'Application receipt candidateDigest mismatch');
    assert.equal(appReceipt.preApplyCanonicalWbsSha256, data.canonicalWbsSha256, 'Application receipt preApplyCanonicalWbsSha256 mismatch');

    // 2. Verify closure receipt
    assert.equal(closureReceipt.decision, 'APPROVE', 'Closure receipt decision must be APPROVE');
    assert.equal(closureReceipt.workItemId, EXPECTED_WORK_ITEM_ID, 'Closure receipt workItemId mismatch');
    assert.equal(closureReceipt.fromStatus, 'IN_PROGRESS', 'Closure receipt fromStatus mismatch');
    assert.equal(closureReceipt.toStatus, 'VERIFICATION_PENDING', 'Closure receipt toStatus mismatch');
    assert.equal(closureReceipt.approvedCandidateDigest, data.candidateDigest, 'Closure receipt candidateDigest mismatch');

    // 3. Verify post-merge verification receipt
    assert.equal(postMergeReceipt.schemaVersion, EXPECTED_SCHEMA_VERSION, 'Post-merge receipt schemaVersion mismatch');
    if (postMergeReceipt.workItemId !== EXPECTED_WORK_ITEM_ID) {
      throw new Error(`post-merge receipt workItemId mismatch: expected ${EXPECTED_WORK_ITEM_ID}, got ${postMergeReceipt.workItemId}`);
    }
    if (postMergeReceipt.decision !== 'APPROVE') {
      throw new Error(`decision other than APPROVE cannot authorize verification: ${postMergeReceipt.decision}`);
    }
    if (postMergeReceipt.fromStatus !== 'VERIFICATION_PENDING') {
      throw new Error(`post-merge receipt source status mismatch: expected VERIFICATION_PENDING, got ${postMergeReceipt.fromStatus}`);
    }
    if (postMergeReceipt.toStatus !== 'VERIFIED') {
      throw new Error(`post-merge receipt target status mismatch: expected VERIFIED, got ${postMergeReceipt.toStatus}`);
    }
    if (postMergeReceipt.mergedPullRequest !== EXPECTED_MERGED_PR) {
      throw new Error(`post-merge receipt mergedPullRequest mismatch: expected ${EXPECTED_MERGED_PR}, got ${postMergeReceipt.mergedPullRequest}`);
    }
    if (postMergeReceipt.prHeadSha !== EXPECTED_PR_HEAD_SHA) {
      throw new Error(`post-merge receipt prHeadSha mismatch: expected ${EXPECTED_PR_HEAD_SHA}, got ${postMergeReceipt.prHeadSha}`);
    }
    if (postMergeReceipt.mergeCommitSha !== EXPECTED_MERGE_COMMIT_SHA) {
      throw new Error(`post-merge receipt mergeCommitSha mismatch: expected ${EXPECTED_MERGE_COMMIT_SHA}, got ${postMergeReceipt.mergeCommitSha}`);
    }
    if (postMergeReceipt.masterShaAtVerification !== EXPECTED_MASTER_SHA_AT_VERIFICATION) {
      throw new Error(`post-merge receipt masterShaAtVerification mismatch: expected ${EXPECTED_MASTER_SHA_AT_VERIFICATION}, got ${postMergeReceipt.masterShaAtVerification}`);
    }
    if (postMergeReceipt.masterCiRunId !== EXPECTED_MASTER_CI_RUN_ID) {
      throw new Error(`post-merge receipt masterCiRunId mismatch: expected ${EXPECTED_MASTER_CI_RUN_ID}, got ${postMergeReceipt.masterCiRunId}`);
    }
    if (postMergeReceipt.masterCiConclusion !== EXPECTED_MASTER_CI_CONCLUSION) {
      throw new Error(`post-merge receipt masterCiConclusion mismatch: expected ${EXPECTED_MASTER_CI_CONCLUSION}, got ${postMergeReceipt.masterCiConclusion}`);
    }
    if (postMergeReceipt.approvedCandidateDigest !== data.candidateDigest) {
      throw new Error(`post-merge receipt candidateDigest mismatch: expected ${data.candidateDigest}, got ${postMergeReceipt.approvedCandidateDigest}`);
    }
    if (postMergeReceipt.statusAuditApplicationReceipt !== 'docs/07_verification/dmk-208-status-audit-approval-receipt.json') {
      throw new Error(`post-merge receipt statusAuditApplicationReceipt linkage mismatch`);
    }
    if (postMergeReceipt.closureTransitionReceipt !== 'docs/07_verification/dmk-208-closure-transition-receipt.json') {
      throw new Error(`post-merge receipt closureTransitionReceipt linkage mismatch`);
    }
    if (postMergeReceipt.preVerificationCanonicalWbsSha256 !== closureReceipt.postClosureCanonicalWbsSha256) {
      throw new Error(`preVerificationCanonicalWbsSha256 mismatch: expected ${closureReceipt.postClosureCanonicalWbsSha256}, got ${postMergeReceipt.preVerificationCanonicalWbsSha256}`);
    }
    const expectedVerificationWbsSha = options?.simulateStatusOverrides
      ? EXPECTED_POST_VERIFICATION_CANONICAL_WBS_SHA256
      : actualWbsSha;
    if (postMergeReceipt.postVerificationCanonicalWbsSha256 !== expectedVerificationWbsSha) {
      throw new Error(`postVerificationCanonicalWbsSha256 mismatch: expected=${expectedVerificationWbsSha}, receipt=${postMergeReceipt.postVerificationCanonicalWbsSha256}`);
    }
  } else if (mode === 'POST_CLOSURE_APPROVED') {
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

    const expectedClosureWbsSha = options?.simulateStatusOverrides
      ? EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256
      : actualWbsSha;
    if (closureReceipt.postClosureCanonicalWbsSha256 !== expectedClosureWbsSha) {
      throw new Error(`postClosureCanonicalWbsSha256 mismatch: expected=${expectedClosureWbsSha}, receipt=${closureReceipt.postClosureCanonicalWbsSha256}`);
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
      let item = { ...i };
      const overrideStatus = options?.simulateStatusOverrides?.[i.id];
      if (overrideStatus) {
        item.status = overrideStatus as any;
      }
      const overrideFields = options?.simulateCanonicalItemOverrides?.[i.id];
      if (overrideFields) {
        item = { ...item, ...overrideFields };
      }
      return [i.id, item];
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

    if (mode === 'POST_MERGE_VERIFIED') {
      if (item.id === 'DMK-208') {
        assert.equal(
          canonicalItem.status,
          'VERIFIED',
          `DMK-208 status mismatch in POST_MERGE_VERIFIED mode: expected VERIFIED, got ${canonicalItem.status}`
        );
        assert.equal(
          canonicalItem.verificationStatus,
          'VERIFIED',
          `DMK-208 verificationStatus mismatch: expected VERIFIED, got ${canonicalItem.verificationStatus}`
        );
        assert.ok(
          canonicalItem.verifiedBy && canonicalItem.verifiedBy.trim().length > 0,
          'DMK-208 verifiedBy must be non-empty'
        );
        assert.ok(
          Array.isArray(canonicalItem.evidence) &&
            canonicalItem.evidence.includes('docs/07_verification/dmk-208-post-merge-verification-receipt.json'),
          'DMK-208 evidence must contain post-merge receipt'
        );
        assert.ok(
          !canonicalItem.humanApprovedBy || /\bPENDING\b/i.test(canonicalItem.humanApprovedBy),
          'DMK-208 humanApprovedBy must be absent or pending'
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
    } else if (mode === 'POST_CLOSURE_APPROVED') {
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
