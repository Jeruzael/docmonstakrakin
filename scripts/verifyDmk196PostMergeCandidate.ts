import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { fileURLToPath } from 'node:url';
import { validateDmk196ClosureReceipt } from './verifyDmk196Closure.ts';
import { validateDmk197ClosureComplete } from './verifyDmk197Closure.ts';

export interface Dmk196PostMergeCandidate {
  schemaVersion: string;
  workItemId: string;
  candidateType: string;
  decisionRequired: boolean;
  fromStatus: string;
  candidateStatus: string;
  mergedPullRequest: number;
  prHeadSha: string;
  mergeCommitSha: string;
  masterShaAtVerification: string;
  masterCiRunId: number;
  masterCiAttempt: number;
  masterCiConclusion: string;
  qualityBuildConclusion: string;
  controlledDocsConclusion: string;
  completeRegressionConclusion: string;
  acceptanceCriterion: string;
  closureTransitionReceipt: string;
  implementationVerificationEvidence: string;
  postMergeVerificationEvidence: string;
  preVerificationCanonicalWbsSha256: string;
  runtimeWorkItemMutationCount: number;
  liveReconciliationExecuted: boolean;
  technicalVerificationCandidate: string;
  humanGovernanceStatus: string;
  humanApprovedByPresent: boolean;
  expectedReconciliationBlockerCountIfApplied: number;
  gate7Changed: boolean;
  releaseChanged: boolean;
  candidateDigest: string;
}

export interface Dmk196PostMergeReceipt {
  schemaVersion: string;
  workItemId: string;
  decision: string;
  decisionAuthority: string;
  decisionSource: string;
  candidateDigest: string;
  fromStatus: string;
  toStatus: string;
  mergedPullRequest: number;
  prHeadSha: string;
  mergeCommitSha: string;
  masterShaAtVerification: string;
  masterCiRunId: number;
  masterCiAttempt: number;
  masterCiConclusion: string;
  qualityBuildConclusion: string;
  controlledDocsConclusion: string;
  completeRegressionConclusion: string;
  closureTransitionReceipt: string;
  postMergeVerificationCandidate: string;
  postMergeVerificationEvidence: string;
  preApplyCanonicalWbsSha256: string;
  postApplyCanonicalWbsSha256: string;
  runtimeWorkItemSha256Before: string;
  runtimeWorkItemSha256After: string;
  runtimeWorkItemMutationCount: number;
  technicalVerificationStatus: string;
  humanGovernanceStatus: string;
  humanApprovedByPresent: boolean;
  reconciliationBlockerCountBefore: number;
  reconciliationBlockerCountAfter: number;
  liveReconciliationExecuted: boolean;
  gate7Changed: boolean;
  releaseChanged: boolean;
  applied: boolean;
  appliedAt: string;
}

export interface VerifyDmk196PostMergeCandidateOptions {
  workspaceRoot?: string;
  customCandidate?: any;
  customClosureReceipt?: any;
  customPostMergeReceipt?: any;
  customWbsYamlContent?: string;
  allowMissingEvidenceFile?: boolean;
  skipDigestCheck?: boolean;
  mode?: 'CANDIDATE_PENDING' | 'POST_APPLY_VERIFIED';
  customDmk197ClosureReceipt?: any;
  customDmk197Attestation?: any;
}

export const EXPECTED_SCHEMA_VERSION = '1.0';
export const EXPECTED_WORK_ITEM_ID = 'DMK-196';
export const EXPECTED_CANDIDATE_TYPE = 'POST_MERGE_TECHNICAL_VERIFICATION';
export const EXPECTED_DECISION_REQUIRED = true;
export const EXPECTED_FROM_STATUS = 'VERIFICATION_PENDING';
export const EXPECTED_CANDIDATE_STATUS = 'VERIFIED';
export const EXPECTED_MERGED_PR = 25;
export const EXPECTED_PR_HEAD_SHA = '8d6d240559983c53162a52b5c1c9064cae509fae';
export const EXPECTED_MERGE_COMMIT_SHA = '2eb763b936327629a809d05fc9f198f541ca0ab2';
export const EXPECTED_MASTER_SHA_AT_VERIFICATION = '2eb763b936327629a809d05fc9f198f541ca0ab2';
export const EXPECTED_MASTER_CI_RUN_ID = 37318919644;
export const EXPECTED_MASTER_CI_ATTEMPT = 1;
export const EXPECTED_MASTER_CI_CONCLUSION = 'success';
export const EXPECTED_QUALITY_BUILD_CONCLUSION = 'success';
export const EXPECTED_CONTROLLED_DOCS_CONCLUSION = 'success';
export const EXPECTED_COMPLETE_REGRESSION_CONCLUSION = 'success';
export const EXPECTED_ACCEPTANCE_CRITERION = 'Remove direct Approve Requirement UX; replace with Request Sign-Off';
export const EXPECTED_CLOSURE_RECEIPT_PATH = 'docs/07_verification/dmk-196-closure-transition-receipt.json';
export const EXPECTED_IMPL_EVIDENCE_PATH = 'docs/07_verification/DMK_196_FORMAL_REQUIREMENT_SIGNOFF_VERIFICATION.md';
export const EXPECTED_POST_MERGE_EVIDENCE_PATH = 'docs/07_verification/DMK_196_POST_MERGE_VERIFICATION.md';
export const EXPECTED_PRE_VERIFICATION_WBS_SHA256 = 'd5adaec2b4d05ccabf08c00a3ce608fb3503d2ef0391f3bb114f1d4faea38c26';
export const EXPECTED_POST_APPLY_WBS_SHA256 = 'c4bf5011d5d234b1e16b2ab4f0a3d07b1ab0a34a77b7e97b6463adbcea290087';
export const EXPECTED_POST_MERGE_RECEIPT_PATH = 'docs/07_verification/dmk-196-post-merge-verification-receipt.json';
export const EXPECTED_POST_MERGE_CANDIDATE_PATH = 'docs/07_verification/dmk-196-post-merge-verification-candidate.json';
export const EXPECTED_RUNTIME_MUTATION_COUNT = 0;
export const EXPECTED_LIVE_RECONCILIATION = false;
export const EXPECTED_TECHNICAL_VERIFICATION_CANDIDATE = 'PASS';
export const EXPECTED_HUMAN_GOVERNANCE_STATUS = 'PENDING_SIGNOFF';
export const EXPECTED_HUMAN_APPROVED_BY_PRESENT = false;
export const EXPECTED_RECONCILIATION_BLOCKERS_IF_APPLIED = 11;
export const EXPECTED_GATE7_CHANGED = false;
export const EXPECTED_RELEASE_CHANGED = false;
export const EXPECTED_CANDIDATE_DIGEST = 'efc0462ee9326e35ca05e3da95cfbae0cb911f8a79723f551c7fe390e0db24ce';

export const EXPECTED_DECISION_AUTHORITY = 'Human operator';
export const EXPECTED_DECISION_SOURCE = 'Explicit human authorization of approved DMK-196 post-merge technical verification candidate';
export const EXPECTED_RUNTIME_WORK_ITEM_SHA256 = '7efb4945bbc439e3211965f70a97f650b424367769dcc4afb3912f12ff9c5b6c';
export const EXPECTED_RECONCILIATION_BLOCKERS_BEFORE = 10;
export const EXPECTED_RECONCILIATION_BLOCKERS_AFTER = 11;

export const EXPECTED_VERIFIED_BY =
  'PR #25 merged to master at 2eb763b936327629a809d05fc9f198f541ca0ab2; GitHub Actions master CI 37318919644 attempt 1 passed Quality & Build, Controlled Docs, and Complete Regression; DMK-196 post-merge verification receipt.';

export const EXPECTED_ALL_EVIDENCE_FILES = [
  'docs/07_verification/DMK_196_FORMAL_REQUIREMENT_SIGNOFF_VERIFICATION.md',
  'docs/07_verification/dmk-196-closure-transition-receipt.json',
  'docs/07_verification/DMK_196_POST_MERGE_VERIFICATION.md',
  'docs/07_verification/dmk-196-post-merge-verification-candidate.json',
  'docs/07_verification/dmk-196-post-merge-verification-receipt.json',
];

export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJsonStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const parts = keys.map((key) => JSON.stringify(key) + ':' + canonicalJsonStringify(obj[key]));
  return '{' + parts.join(',') + '}';
}

export function computeDmk196PostMergeCandidateDigest(candidate: any): string {
  const { candidateDigest, ...rest } = candidate;
  const canonical = canonicalJsonStringify(rest);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function validateDmk196PostMergeCandidate(
  candidate: any,
  options: { skipDigestCheck?: boolean } = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    errors.push('candidate must be a valid non-null object');
    return { valid: false, errors };
  }

  if (candidate.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    errors.push(`candidate.schemaVersion must be "${EXPECTED_SCHEMA_VERSION}", found "${candidate.schemaVersion}"`);
  }
  if (candidate.workItemId !== EXPECTED_WORK_ITEM_ID) {
    errors.push(`candidate.workItemId must be "${EXPECTED_WORK_ITEM_ID}", found "${candidate.workItemId}"`);
  }
  if (candidate.candidateType !== EXPECTED_CANDIDATE_TYPE) {
    errors.push(`candidate.candidateType must be "${EXPECTED_CANDIDATE_TYPE}", found "${candidate.candidateType}"`);
  }
  if (candidate.decisionRequired !== EXPECTED_DECISION_REQUIRED) {
    errors.push(`candidate.decisionRequired must be ${EXPECTED_DECISION_REQUIRED}, found ${candidate.decisionRequired}`);
  }
  if (candidate.fromStatus !== EXPECTED_FROM_STATUS) {
    errors.push(`candidate.fromStatus must be "${EXPECTED_FROM_STATUS}", found "${candidate.fromStatus}"`);
  }
  if (candidate.candidateStatus !== EXPECTED_CANDIDATE_STATUS) {
    errors.push(`candidate.candidateStatus must be "${EXPECTED_CANDIDATE_STATUS}", found "${candidate.candidateStatus}"`);
  }
  if (candidate.mergedPullRequest !== EXPECTED_MERGED_PR) {
    errors.push(`candidate.mergedPullRequest must be ${EXPECTED_MERGED_PR}, found ${candidate.mergedPullRequest}`);
  }
  if (candidate.prHeadSha !== EXPECTED_PR_HEAD_SHA) {
    errors.push(`candidate.prHeadSha must match ${EXPECTED_PR_HEAD_SHA}, found "${candidate.prHeadSha}"`);
  }
  if (candidate.mergeCommitSha !== EXPECTED_MERGE_COMMIT_SHA) {
    errors.push(`candidate.mergeCommitSha must match ${EXPECTED_MERGE_COMMIT_SHA}, found "${candidate.mergeCommitSha}"`);
  }
  if (candidate.masterShaAtVerification !== EXPECTED_MASTER_SHA_AT_VERIFICATION) {
    errors.push(`candidate.masterShaAtVerification must match ${EXPECTED_MASTER_SHA_AT_VERIFICATION}, found "${candidate.masterShaAtVerification}"`);
  }
  if (candidate.masterCiRunId !== EXPECTED_MASTER_CI_RUN_ID) {
    errors.push(`candidate.masterCiRunId must be ${EXPECTED_MASTER_CI_RUN_ID}, found ${candidate.masterCiRunId}`);
  }
  if (candidate.masterCiAttempt !== EXPECTED_MASTER_CI_ATTEMPT) {
    errors.push(`candidate.masterCiAttempt must be ${EXPECTED_MASTER_CI_ATTEMPT}, found ${candidate.masterCiAttempt}`);
  }
  if (candidate.masterCiConclusion !== EXPECTED_MASTER_CI_CONCLUSION) {
    errors.push(`candidate.masterCiConclusion must be "${EXPECTED_MASTER_CI_CONCLUSION}", found "${candidate.masterCiConclusion}"`);
  }
  if (candidate.qualityBuildConclusion !== EXPECTED_QUALITY_BUILD_CONCLUSION) {
    errors.push(`candidate.qualityBuildConclusion must be "${EXPECTED_QUALITY_BUILD_CONCLUSION}", found "${candidate.qualityBuildConclusion}"`);
  }
  if (candidate.controlledDocsConclusion !== EXPECTED_CONTROLLED_DOCS_CONCLUSION) {
    errors.push(`candidate.controlledDocsConclusion must be "${EXPECTED_CONTROLLED_DOCS_CONCLUSION}", found "${candidate.controlledDocsConclusion}"`);
  }
  if (candidate.completeRegressionConclusion !== EXPECTED_COMPLETE_REGRESSION_CONCLUSION) {
    errors.push(`candidate.completeRegressionConclusion must be "${EXPECTED_COMPLETE_REGRESSION_CONCLUSION}", found "${candidate.completeRegressionConclusion}"`);
  }
  if (candidate.acceptanceCriterion !== EXPECTED_ACCEPTANCE_CRITERION) {
    errors.push(`candidate.acceptanceCriterion must be "${EXPECTED_ACCEPTANCE_CRITERION}", found "${candidate.acceptanceCriterion}"`);
  }
  if (candidate.closureTransitionReceipt !== EXPECTED_CLOSURE_RECEIPT_PATH) {
    errors.push(`candidate.closureTransitionReceipt must be "${EXPECTED_CLOSURE_RECEIPT_PATH}", found "${candidate.closureTransitionReceipt}"`);
  }
  if (candidate.implementationVerificationEvidence !== EXPECTED_IMPL_EVIDENCE_PATH) {
    errors.push(`candidate.implementationVerificationEvidence must be "${EXPECTED_IMPL_EVIDENCE_PATH}", found "${candidate.implementationVerificationEvidence}"`);
  }
  if (candidate.postMergeVerificationEvidence !== EXPECTED_POST_MERGE_EVIDENCE_PATH) {
    errors.push(`candidate.postMergeVerificationEvidence must be "${EXPECTED_POST_MERGE_EVIDENCE_PATH}", found "${candidate.postMergeVerificationEvidence}"`);
  }
  if (candidate.preVerificationCanonicalWbsSha256 !== EXPECTED_PRE_VERIFICATION_WBS_SHA256) {
    errors.push(`candidate.preVerificationCanonicalWbsSha256 must match ${EXPECTED_PRE_VERIFICATION_WBS_SHA256}, found "${candidate.preVerificationCanonicalWbsSha256}"`);
  }
  if (candidate.runtimeWorkItemMutationCount !== EXPECTED_RUNTIME_MUTATION_COUNT) {
    errors.push(`candidate.runtimeWorkItemMutationCount must be ${EXPECTED_RUNTIME_MUTATION_COUNT}, found ${candidate.runtimeWorkItemMutationCount}`);
  }
  if (candidate.liveReconciliationExecuted !== EXPECTED_LIVE_RECONCILIATION) {
    errors.push(`candidate.liveReconciliationExecuted must be ${EXPECTED_LIVE_RECONCILIATION}, found ${candidate.liveReconciliationExecuted}`);
  }
  if (candidate.technicalVerificationCandidate !== EXPECTED_TECHNICAL_VERIFICATION_CANDIDATE) {
    errors.push(`candidate.technicalVerificationCandidate must be "${EXPECTED_TECHNICAL_VERIFICATION_CANDIDATE}", found "${candidate.technicalVerificationCandidate}"`);
  }
  if (candidate.humanGovernanceStatus !== EXPECTED_HUMAN_GOVERNANCE_STATUS) {
    errors.push(`candidate.humanGovernanceStatus must be "${EXPECTED_HUMAN_GOVERNANCE_STATUS}", found "${candidate.humanGovernanceStatus}"`);
  }
  if (candidate.humanApprovedByPresent !== EXPECTED_HUMAN_APPROVED_BY_PRESENT) {
    errors.push(`candidate.humanApprovedByPresent must be ${EXPECTED_HUMAN_APPROVED_BY_PRESENT}, found ${candidate.humanApprovedByPresent}`);
  }
  if (candidate.expectedReconciliationBlockerCountIfApplied !== EXPECTED_RECONCILIATION_BLOCKERS_IF_APPLIED) {
    errors.push(`candidate.expectedReconciliationBlockerCountIfApplied must be ${EXPECTED_RECONCILIATION_BLOCKERS_IF_APPLIED}, found ${candidate.expectedReconciliationBlockerCountIfApplied}`);
  }
  if (candidate.gate7Changed !== EXPECTED_GATE7_CHANGED) {
    errors.push(`candidate.gate7Changed must be ${EXPECTED_GATE7_CHANGED}, found ${candidate.gate7Changed}`);
  }
  if (candidate.releaseChanged !== EXPECTED_RELEASE_CHANGED) {
    errors.push(`candidate.releaseChanged must be ${EXPECTED_RELEASE_CHANGED}, found ${candidate.releaseChanged}`);
  }

  if (!options.skipDigestCheck) {
    if (typeof candidate.candidateDigest !== 'string' || candidate.candidateDigest.length !== 64) {
      errors.push('candidate.candidateDigest must be a 64-character hex SHA-256 string');
    } else {
      const calculatedDigest = computeDmk196PostMergeCandidateDigest(candidate);
      if (candidate.candidateDigest !== calculatedDigest) {
        errors.push(`candidate.candidateDigest mismatch: recorded="${candidate.candidateDigest}", calculated="${calculatedDigest}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateDmk196PostMergeReceipt(receipt: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!receipt || typeof receipt !== 'object') {
    errors.push('receipt must be a valid non-null object');
    return { valid: false, errors };
  }

  if (receipt.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    errors.push(`receipt.schemaVersion must be "${EXPECTED_SCHEMA_VERSION}", found "${receipt.schemaVersion}"`);
  }
  if (receipt.workItemId !== EXPECTED_WORK_ITEM_ID) {
    errors.push(`receipt.workItemId must be "${EXPECTED_WORK_ITEM_ID}", found "${receipt.workItemId}"`);
  }
  if (receipt.decision !== 'APPROVE') {
    errors.push(`receipt.decision must be "APPROVE", found "${receipt.decision}"`);
  }
  if (receipt.decisionAuthority !== EXPECTED_DECISION_AUTHORITY) {
    errors.push(`receipt.decisionAuthority must be "${EXPECTED_DECISION_AUTHORITY}", found "${receipt.decisionAuthority}"`);
  }
  if (receipt.decisionSource !== EXPECTED_DECISION_SOURCE) {
    errors.push(`receipt.decisionSource must be "${EXPECTED_DECISION_SOURCE}", found "${receipt.decisionSource}"`);
  }
  if (receipt.candidateDigest !== EXPECTED_CANDIDATE_DIGEST) {
    errors.push(`receipt.candidateDigest must match "${EXPECTED_CANDIDATE_DIGEST}", found "${receipt.candidateDigest}"`);
  }
  if (receipt.fromStatus !== EXPECTED_FROM_STATUS) {
    errors.push(`receipt.fromStatus must be "${EXPECTED_FROM_STATUS}", found "${receipt.fromStatus}"`);
  }
  if (receipt.toStatus !== EXPECTED_CANDIDATE_STATUS) {
    errors.push(`receipt.toStatus must be "${EXPECTED_CANDIDATE_STATUS}", found "${receipt.toStatus}"`);
  }
  if (receipt.mergedPullRequest !== EXPECTED_MERGED_PR) {
    errors.push(`receipt.mergedPullRequest must be ${EXPECTED_MERGED_PR}, found ${receipt.mergedPullRequest}`);
  }
  if (receipt.prHeadSha !== EXPECTED_PR_HEAD_SHA) {
    errors.push(`receipt.prHeadSha must match ${EXPECTED_PR_HEAD_SHA}, found "${receipt.prHeadSha}"`);
  }
  if (receipt.mergeCommitSha !== EXPECTED_MERGE_COMMIT_SHA) {
    errors.push(`receipt.mergeCommitSha must match ${EXPECTED_MERGE_COMMIT_SHA}, found "${receipt.mergeCommitSha}"`);
  }
  if (receipt.masterShaAtVerification !== EXPECTED_MASTER_SHA_AT_VERIFICATION) {
    errors.push(`receipt.masterShaAtVerification must match ${EXPECTED_MASTER_SHA_AT_VERIFICATION}, found "${receipt.masterShaAtVerification}"`);
  }
  if (receipt.masterCiRunId !== EXPECTED_MASTER_CI_RUN_ID) {
    errors.push(`receipt.masterCiRunId must be ${EXPECTED_MASTER_CI_RUN_ID}, found ${receipt.masterCiRunId}`);
  }
  if (receipt.masterCiAttempt !== EXPECTED_MASTER_CI_ATTEMPT) {
    errors.push(`receipt.masterCiAttempt must be ${EXPECTED_MASTER_CI_ATTEMPT}, found ${receipt.masterCiAttempt}`);
  }
  if (receipt.masterCiConclusion !== EXPECTED_MASTER_CI_CONCLUSION) {
    errors.push(`receipt.masterCiConclusion must be "${EXPECTED_MASTER_CI_CONCLUSION}", found "${receipt.masterCiConclusion}"`);
  }
  if (receipt.qualityBuildConclusion !== EXPECTED_QUALITY_BUILD_CONCLUSION) {
    errors.push(`receipt.qualityBuildConclusion must be "${EXPECTED_QUALITY_BUILD_CONCLUSION}", found "${receipt.qualityBuildConclusion}"`);
  }
  if (receipt.controlledDocsConclusion !== EXPECTED_CONTROLLED_DOCS_CONCLUSION) {
    errors.push(`receipt.controlledDocsConclusion must be "${EXPECTED_CONTROLLED_DOCS_CONCLUSION}", found "${receipt.controlledDocsConclusion}"`);
  }
  if (receipt.completeRegressionConclusion !== EXPECTED_COMPLETE_REGRESSION_CONCLUSION) {
    errors.push(`receipt.completeRegressionConclusion must be "${EXPECTED_COMPLETE_REGRESSION_CONCLUSION}", found "${receipt.completeRegressionConclusion}"`);
  }
  if (receipt.closureTransitionReceipt !== EXPECTED_CLOSURE_RECEIPT_PATH) {
    errors.push(`receipt.closureTransitionReceipt must be "${EXPECTED_CLOSURE_RECEIPT_PATH}", found "${receipt.closureTransitionReceipt}"`);
  }
  if (receipt.postMergeVerificationCandidate !== EXPECTED_POST_MERGE_CANDIDATE_PATH) {
    errors.push(`receipt.postMergeVerificationCandidate must be "${EXPECTED_POST_MERGE_CANDIDATE_PATH}", found "${receipt.postMergeVerificationCandidate}"`);
  }
  if (receipt.postMergeVerificationEvidence !== EXPECTED_POST_MERGE_EVIDENCE_PATH) {
    errors.push(`receipt.postMergeVerificationEvidence must be "${EXPECTED_POST_MERGE_EVIDENCE_PATH}", found "${receipt.postMergeVerificationEvidence}"`);
  }
  if (receipt.preApplyCanonicalWbsSha256 !== EXPECTED_PRE_VERIFICATION_WBS_SHA256) {
    errors.push(`receipt.preApplyCanonicalWbsSha256 must match ${EXPECTED_PRE_VERIFICATION_WBS_SHA256}, found "${receipt.preApplyCanonicalWbsSha256}"`);
  }
  if (receipt.postApplyCanonicalWbsSha256 !== EXPECTED_POST_APPLY_WBS_SHA256) {
    errors.push(`receipt.postApplyCanonicalWbsSha256 must match ${EXPECTED_POST_APPLY_WBS_SHA256}, found "${receipt.postApplyCanonicalWbsSha256}"`);
  }
  if (receipt.runtimeWorkItemSha256Before !== EXPECTED_RUNTIME_WORK_ITEM_SHA256) {
    errors.push(`receipt.runtimeWorkItemSha256Before must match ${EXPECTED_RUNTIME_WORK_ITEM_SHA256}, found "${receipt.runtimeWorkItemSha256Before}"`);
  }
  if (receipt.runtimeWorkItemSha256After !== EXPECTED_RUNTIME_WORK_ITEM_SHA256) {
    errors.push(`receipt.runtimeWorkItemSha256After must match ${EXPECTED_RUNTIME_WORK_ITEM_SHA256}, found "${receipt.runtimeWorkItemSha256After}"`);
  }
  if (receipt.runtimeWorkItemMutationCount !== EXPECTED_RUNTIME_MUTATION_COUNT) {
    errors.push(`receipt.runtimeWorkItemMutationCount must be ${EXPECTED_RUNTIME_MUTATION_COUNT}, found ${receipt.runtimeWorkItemMutationCount}`);
  }
  if (receipt.technicalVerificationStatus !== EXPECTED_CANDIDATE_STATUS) {
    errors.push(`receipt.technicalVerificationStatus must be "${EXPECTED_CANDIDATE_STATUS}", found "${receipt.technicalVerificationStatus}"`);
  }
  if (receipt.humanGovernanceStatus !== EXPECTED_HUMAN_GOVERNANCE_STATUS) {
    errors.push(`receipt.humanGovernanceStatus must be "${EXPECTED_HUMAN_GOVERNANCE_STATUS}", found "${receipt.humanGovernanceStatus}"`);
  }
  if (receipt.humanApprovedByPresent !== EXPECTED_HUMAN_APPROVED_BY_PRESENT) {
    errors.push(`receipt.humanApprovedByPresent must be ${EXPECTED_HUMAN_APPROVED_BY_PRESENT}, found ${receipt.humanApprovedByPresent}`);
  }
  if (receipt.reconciliationBlockerCountBefore !== EXPECTED_RECONCILIATION_BLOCKERS_BEFORE) {
    errors.push(`receipt.reconciliationBlockerCountBefore must be ${EXPECTED_RECONCILIATION_BLOCKERS_BEFORE}, found ${receipt.reconciliationBlockerCountBefore}`);
  }
  if (receipt.reconciliationBlockerCountAfter !== EXPECTED_RECONCILIATION_BLOCKERS_AFTER) {
    errors.push(`receipt.reconciliationBlockerCountAfter must be ${EXPECTED_RECONCILIATION_BLOCKERS_AFTER}, found ${receipt.reconciliationBlockerCountAfter}`);
  }
  if (receipt.liveReconciliationExecuted !== EXPECTED_LIVE_RECONCILIATION) {
    errors.push(`receipt.liveReconciliationExecuted must be ${EXPECTED_LIVE_RECONCILIATION}, found ${receipt.liveReconciliationExecuted}`);
  }
  if (receipt.gate7Changed !== EXPECTED_GATE7_CHANGED) {
    errors.push(`receipt.gate7Changed must be ${EXPECTED_GATE7_CHANGED}, found ${receipt.gate7Changed}`);
  }
  if (receipt.releaseChanged !== EXPECTED_RELEASE_CHANGED) {
    errors.push(`receipt.releaseChanged must be ${EXPECTED_RELEASE_CHANGED}, found ${receipt.releaseChanged}`);
  }
  if (receipt.applied !== true) {
    errors.push(`receipt.applied must be true, found ${receipt.applied}`);
  }
  if (!receipt.appliedAt || typeof receipt.appliedAt !== 'string') {
    errors.push('receipt.appliedAt must be a non-empty string timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function verifyDmk196PostMergeCandidate(
  options: VerifyDmk196PostMergeCandidateOptions = {}
): { valid: boolean; errors: string[]; mode: 'CANDIDATE_PENDING' | 'POST_APPLY_VERIFIED' } {
  const root = options.workspaceRoot || process.cwd();
  const candidatePath = path.join(root, EXPECTED_POST_MERGE_CANDIDATE_PATH);
  const errors: string[] = [];

  let candidate = options.customCandidate;
  if (!candidate) {
    if (!fs.existsSync(candidatePath)) {
      errors.push(`Candidate file does not exist at ${candidatePath}`);
      return { valid: false, errors, mode: 'CANDIDATE_PENDING' };
    }
    try {
      candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    } catch (e: any) {
      errors.push(`Failed to parse candidate JSON: ${e.message}`);
      return { valid: false, errors, mode: 'CANDIDATE_PENDING' };
    }
  }

  const candidateValidation = validateDmk196PostMergeCandidate(candidate, {
    skipDigestCheck: options.skipDigestCheck,
  });
  if (!candidateValidation.valid) {
    errors.push(...candidateValidation.errors);
  }

  // Verify closure receipt exists and is valid
  const closureReceiptPath = path.join(root, EXPECTED_CLOSURE_RECEIPT_PATH);
  let closureReceipt = options.customClosureReceipt;
  if (!closureReceipt) {
    if (!fs.existsSync(closureReceiptPath)) {
      errors.push(`Closure transition receipt does not exist at ${closureReceiptPath}`);
    } else {
      try {
        closureReceipt = JSON.parse(fs.readFileSync(closureReceiptPath, 'utf8'));
      } catch (e: any) {
        errors.push(`Failed to parse closure receipt JSON: ${e.message}`);
      }
    }
  }
  if (closureReceipt) {
    const receiptValidation = validateDmk196ClosureReceipt(closureReceipt);
    if (!receiptValidation.valid) {
      errors.push(...receiptValidation.errors.map((e) => `closure receipt invalid: ${e}`));
    }
  }

  // WBS checks
  const wbsPath = path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml');
  let wbsContent = options.customWbsYamlContent;
  if (wbsContent === undefined) {
    if (!fs.existsSync(wbsPath)) {
      errors.push(`MASTER_WBS.yaml does not exist at ${wbsPath}`);
      return { valid: false, errors, mode: 'CANDIDATE_PENDING' };
    }
    wbsContent = fs.readFileSync(wbsPath, 'utf8');
  }

  let doc: any;
  try {
    doc = YAML.parse(wbsContent);
  } catch (e: any) {
    errors.push(`Failed to parse MASTER_WBS.yaml: ${e.message}`);
    return { valid: false, errors, mode: 'CANDIDATE_PENDING' };
  }

  function findItem(items: any[], id: string): any {
    for (const item of items || []) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItem(item.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const allItems = doc.items || [];
  const dmk196 = findItem(allItems, 'DMK-196');

  // Determine mode
  let mode = options.mode;
  if (!mode) {
    if (dmk196 && dmk196.status === 'VERIFIED') {
      mode = 'POST_APPLY_VERIFIED';
    } else if (dmk196 && dmk196.status === 'VERIFICATION_PENDING') {
      mode = 'CANDIDATE_PENDING';
    } else {
      mode = 'POST_APPLY_VERIFIED';
    }
  }

  const wbsSha = crypto.createHash('sha256').update(Buffer.from(wbsContent)).digest('hex');

  if (mode === 'CANDIDATE_PENDING') {
    if (candidate?.preVerificationCanonicalWbsSha256 !== wbsSha) {
      errors.push(`WBS digest mismatch: candidate preVerificationCanonicalWbsSha256="${candidate?.preVerificationCanonicalWbsSha256}", actual="${wbsSha}"`);
    }

    if (!options.allowMissingEvidenceFile) {
      const implEvidencePath = path.join(root, EXPECTED_IMPL_EVIDENCE_PATH);
      if (!fs.existsSync(implEvidencePath)) {
        errors.push(`Implementation verification evidence file missing at ${implEvidencePath}`);
      }
      const postMergeEvidencePath = path.join(root, EXPECTED_POST_MERGE_EVIDENCE_PATH);
      if (!fs.existsSync(postMergeEvidencePath)) {
        errors.push(`Post-merge verification evidence file missing at ${postMergeEvidencePath}`);
      }
    }

    if (!dmk196) {
      errors.push('DMK-196 not found in MASTER_WBS.yaml');
    } else {
      if (dmk196.status !== 'VERIFICATION_PENDING') {
        errors.push(`DMK-196 status must be "VERIFICATION_PENDING" during post-merge candidate evaluation, found "${dmk196.status}"`);
      }
      const evidenceList: string[] = Array.isArray(dmk196.evidence)
        ? dmk196.evidence
        : dmk196.evidence ? [dmk196.evidence] : [];
      if (!evidenceList.includes(EXPECTED_IMPL_EVIDENCE_PATH)) {
        errors.push(`DMK-196 evidence must contain "${EXPECTED_IMPL_EVIDENCE_PATH}", found ${JSON.stringify(dmk196.evidence)}`);
      }
    }
  } else {
    // mode === 'POST_APPLY_VERIFIED'
    // Verify post-merge application receipt
    const pmReceiptPath = path.join(root, EXPECTED_POST_MERGE_RECEIPT_PATH);
    let pmReceipt = options.customPostMergeReceipt;
    if (!pmReceipt) {
      if (!fs.existsSync(pmReceiptPath)) {
        errors.push(`Post-merge verification receipt does not exist at ${pmReceiptPath}`);
      } else {
        try {
          pmReceipt = JSON.parse(fs.readFileSync(pmReceiptPath, 'utf8'));
        } catch (e: any) {
          errors.push(`Failed to parse post-merge verification receipt JSON: ${e.message}`);
        }
      }
    }

    if (pmReceipt) {
      const receiptValidation = validateDmk196PostMergeReceipt(pmReceipt);
      if (!receiptValidation.valid) {
        errors.push(...receiptValidation.errors.map((e) => `post-merge verification receipt invalid: ${e}`));
      }
      if (candidate && pmReceipt.candidateDigest !== candidate.candidateDigest) {
        errors.push(`post-merge verification receipt candidateDigest mismatch: receipt="${pmReceipt.candidateDigest}", candidate="${candidate.candidateDigest}"`);
      }
      if (pmReceipt.postApplyCanonicalWbsSha256 && wbsSha !== pmReceipt.postApplyCanonicalWbsSha256) {
        const dmk197ReceiptPath = path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-receipt.json');
        let chainValid = false;
        if (fs.existsSync(dmk197ReceiptPath)) {
          try {
            const dmk197Receipt = JSON.parse(fs.readFileSync(dmk197ReceiptPath, 'utf8'));
            if (
              dmk197Receipt.workItemId === 'DMK-197' &&
              dmk197Receipt.toStatus === 'VERIFICATION_PENDING' &&
              dmk197Receipt.decision === 'APPROVE' &&
              dmk197Receipt.applied === true &&
              dmk197Receipt.preClosureCanonicalWbsSha256 === pmReceipt.postApplyCanonicalWbsSha256 &&
              dmk197Receipt.postClosureCanonicalWbsSha256 === wbsSha
            ) {
              chainValid = true;
            }
          } catch {
            // ignore
          }
        }
        if (!chainValid) {
          errors.push(`WBS digest mismatch: receipt postApplyCanonicalWbsSha256="${pmReceipt.postApplyCanonicalWbsSha256}", actual="${wbsSha}"`);
        }
      }
    }

    // Verify all 5 evidence files exist
    if (!options.allowMissingEvidenceFile) {
      for (const evPath of EXPECTED_ALL_EVIDENCE_FILES) {
        const fullEvPath = path.join(root, evPath);
        if (!fs.existsSync(fullEvPath)) {
          errors.push(`Required evidence file missing at ${fullEvPath}`);
        }
      }
    }

    if (!dmk196) {
      errors.push('DMK-196 not found in MASTER_WBS.yaml');
    } else {
      if (dmk196.status !== 'VERIFIED') {
        errors.push(`DMK-196 status must be "VERIFIED" after applied post-merge transition, found "${dmk196.status}"`);
      }
      if (dmk196.verification_status !== 'VERIFIED') {
        errors.push(`DMK-196 verification_status must be "VERIFIED", found "${dmk196.verification_status}"`);
      }
      if (dmk196.verified_by !== EXPECTED_VERIFIED_BY) {
        errors.push(`DMK-196 verified_by mismatch: expected "${EXPECTED_VERIFIED_BY}", found "${dmk196.verified_by}"`);
      }
      if (dmk196.human_approved_by && !/\bPENDING\b/i.test(dmk196.human_approved_by)) {
        errors.push(`DMK-196 human_approved_by must remain absent or pending, found completed: "${dmk196.human_approved_by}"`);
      }
      const evidenceList: string[] = Array.isArray(dmk196.evidence)
        ? dmk196.evidence
        : dmk196.evidence ? [dmk196.evidence] : [];
      for (const reqEv of EXPECTED_ALL_EVIDENCE_FILES) {
        if (!evidenceList.includes(reqEv)) {
          errors.push(`DMK-196 evidence must contain "${reqEv}", found ${JSON.stringify(dmk196.evidence)}`);
        }
      }
    }
  }

  // Fail-closed checks on other items in both modes
  const dmk197 = findItem(allItems, 'DMK-197');
  if (!dmk197) {
    errors.push('DMK-197 not found in MASTER_WBS.yaml');
  } else if (dmk197.status === 'IN_PROGRESS') {
    // Permitted historical status
  } else if (dmk197.status === 'VERIFICATION_PENDING') {
    let receipt = options.customDmk197ClosureReceipt;
    if (receipt === undefined) {
      const rPath = path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-receipt.json');
      if (fs.existsSync(rPath)) {
        try {
          receipt = JSON.parse(fs.readFileSync(rPath, 'utf8'));
        } catch (e: any) {
          errors.push(`DMK-197 closure receipt JSON parse failed: ${e.message}`);
        }
      } else {
        errors.push(`DMK-197 status is "VERIFICATION_PENDING" but dmk-197-closure-transition-receipt.json does not exist at ${rPath}`);
      }
    } else if (receipt === null) {
      errors.push(`DMK-197 status is "VERIFICATION_PENDING" but dmk-197-closure-transition-receipt.json is missing`);
    }

    let attestation = options.customDmk197Attestation;
    if (attestation === undefined) {
      const aPath = path.join(root, 'docs', '07_verification', 'dmk-197-post-merge-governance-attestation.json');
      if (fs.existsSync(aPath)) {
        try {
          attestation = JSON.parse(fs.readFileSync(aPath, 'utf8'));
        } catch (e: any) {
          errors.push(`DMK-197 post-merge governance attestation JSON parse failed: ${e.message}`);
        }
      } else {
        errors.push(`DMK-197 status is "VERIFICATION_PENDING" but post-merge governance attestation is missing at ${aPath}`);
      }
    } else if (attestation === null) {
      errors.push(`DMK-197 status is "VERIFICATION_PENDING" but post-merge governance attestation is missing`);
    }

    if (receipt && attestation) {
      const val = validateDmk197ClosureComplete(receipt, attestation, { workspaceRoot: root });
      if (!val.valid) {
        errors.push(...val.errors.map((e) => `DMK-197 verification failed: ${e}`));
      }
    }
  } else {
    errors.push(`DMK-197 status must remain "IN_PROGRESS" or authorized "VERIFICATION_PENDING", found "${dmk197?.status}"`);
  }
  const dmk198 = findItem(allItems, 'DMK-198');
  if (!dmk198 || dmk198.status !== 'IN_PROGRESS') {
    errors.push(`DMK-198 status must remain "IN_PROGRESS", found "${dmk198?.status}"`);
  }
  const dmk206 = findItem(allItems, 'DMK-206');
  if (!dmk206 || dmk206.status !== 'BACKLOG') {
    errors.push(`DMK-206 status must remain "BACKLOG", found "${dmk206?.status}"`);
  }
  const dmk207 = findItem(allItems, 'DMK-207');
  if (!dmk207 || dmk207.status !== 'BACKLOG') {
    errors.push(`DMK-207 status must remain "BACKLOG", found "${dmk207?.status}"`);
  }
  const dmk208 = findItem(allItems, 'DMK-208');
  if (!dmk208 || dmk208.status !== 'VERIFIED') {
    errors.push(`DMK-208 status must remain "VERIFIED", found "${dmk208?.status}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
    mode,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('--- Verifying DMK-196 Post-Merge Verification Candidate ---');
  const result = verifyDmk196PostMergeCandidate();
  if (result.valid) {
    console.log(`✓ [PASS] DMK-196 post-merge verification verified successfully (mode: ${result.mode}).`);
    process.exit(0);
  } else {
    console.error(`✗ [FAIL] DMK-196 post-merge verification errors (mode: ${result.mode}):`);
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}
