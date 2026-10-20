import fs from 'node:fs';
import { verifyWorkspaceWbsContinuity, combineWbsVerification, type TrustedForwardEvidenceProvider } from './wbsEvidenceContinuity.ts';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { fileURLToPath } from 'node:url';

export interface VerifyDmk197ClosureOptions {
  workspaceRoot?: string;
  customReceipt?: any;
  customAttestation?: any;
  customWbsYamlContent?: string;
  allowMissingEvidenceFile?: boolean;
  allowMissingReceiptFile?: boolean;
}

export const EXPECTED_SCHEMA_VERSION = '1.0';
export const EXPECTED_PROJECT_ID = 'PRJ-DOCMONSTAKRAKIN';
export const EXPECTED_WORK_ITEM_ID = 'DMK-197';
export const EXPECTED_WBS_PATH = '13.06.11';
export const EXPECTED_DECISION = 'APPROVE';
export const EXPECTED_DECISION_AUTHORITY = 'Human operator';
export const EXPECTED_DECISION_SOURCE = 'Explicit human operator approval of DMK-197 closure transition candidate in governed review session';
export const EXPECTED_FROM_STATUS = 'IN_PROGRESS';
export const EXPECTED_TO_STATUS = 'VERIFICATION_PENDING';
export const EXPECTED_APPROVED_CANDIDATE_DIGEST = '0b51dce158c989a437e3ad1776ec3388ada8a556558e3a668393452f5c98cbf7';
export const EXPECTED_CANDIDATE_FILE = 'docs/07_verification/dmk-197-closure-transition-candidate.json';
export const EXPECTED_IMPLEMENTATION_HEAD_SHA = 'dab159041b9b2616c42d2654598d0949e5778d85';
export const EXPECTED_IMPLEMENTATION_CI_RUN_ID = 38150032624;
export const EXPECTED_IMPLEMENTATION_CI_ATTEMPT = 1;
export const EXPECTED_IMPLEMENTATION_CI_CONCLUSION = 'success';
export const EXPECTED_PRE_CLOSURE_BRANCH_SHA = '153c4c5c97df44d367725c4aa94aef4bde81717e';
export const EXPECTED_BASE_MASTER_SHA = '7e45da9b0d4d8553745e5b7c25597eb48c94d6af';
export const EXPECTED_ACCEPTANCE_CRITERION = 'Distinct Security Officer and Lead Architect human identities required for quorum';
export const EXPECTED_VERIFICATION_EVIDENCE = [
  'docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md',
  'docs/07_verification/DMK_197_CLOSURE_TRANSITION_REVIEW.md',
];
export const EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256 = 'c4bf5011d5d234b1e16b2ab4f0a3d07b1ab0a34a77b7e97b6463adbcea290087';
export const EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256 = '53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d';
export const EXPECTED_APPLIED_AT = '2026-10-12T01:40:03Z';

export const RECEIPT_FILE_PATH = 'docs/07_verification/dmk-197-closure-transition-receipt.json';
export const ATTESTATION_FILE_PATH = 'docs/07_verification/dmk-197-post-merge-governance-attestation.json';

export const EXPECTED_ATTESTATION_TYPE = 'POST_MERGE_GOVERNANCE_RECONCILIATION';
export const EXPECTED_ORIGINAL_RECEIPT_SHA256 = '78b66ed881c8d2bd891229b7cc7821c000421573bce29f48eea7a7323d07187a';
export const EXPECTED_CLOSURE_COMMIT_SHA = '59231ea8bb9cdf174f69d0d2cb94561d40c3b551';
export const EXPECTED_MERGED_PULL_REQUEST = 27;
export const EXPECTED_MERGE_COMMIT_SHA = '7196ec4840e8b89d672b61b383beebe148141b7c';
export const EXPECTED_MERGE_TIMESTAMP = '2026-10-11T19:39:32Z';
export const EXPECTED_APPROVAL_COMMENT_ID = 6112940783;
export const EXPECTED_APPROVAL_COMMENT_URL = 'https://github.com/Jeruzael/docmonstakrakin/pull/27#issuecomment-6112940783';
export const EXPECTED_APPROVAL_AUTHOR = 'Jeruzael';
export const EXPECTED_APPROVAL_AUTHOR_ID = 91640195;
export const EXPECTED_APPROVAL_AUTHOR_ASSOCIATION = 'OWNER';
export const EXPECTED_APPROVAL_TIMESTAMP = '2026-10-11T19:39:54Z';
export const EXPECTED_APPROVAL_DECISION = 'APPROVE';
export const EXPECTED_PRIOR_APPROVAL_OBTAINED = false;
export const EXPECTED_RETROSPECTIVE_INTERVAL_SECONDS = 22;
export const EXPECTED_RETROSPECTIVE_GOVERNANCE_STATUS = 'UNRESOLVED_PROCEDURAL_NONCOMPLIANCE';
export const EXPECTED_TIMESTAMP_INTERPRETATION = 'ORIGINAL_APPLICATION_TIMESTAMP_UNVERIFIED';
export const EXPECTED_MASTER_CI_RUN_ID = 38168952638;
export const EXPECTED_MASTER_CI_ATTEMPT = 1;
export const EXPECTED_MASTER_CI_CONCLUSION = 'success';
export const EXPECTED_MASTER_CI_JOBS: Record<string, string> = {
  'Controlled Docs': 'success',
  'Quality & Build': 'success',
  'Complete Regression': 'success',
};

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

export function validateDmk197ClosureReceipt(
  receipt: any,
  _options: { workspaceRoot?: string } = {}
): { valid: boolean; errors: string[] } {
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
  if (receipt.wbsPath !== EXPECTED_WBS_PATH) {
    errors.push(`receipt.wbsPath must be "${EXPECTED_WBS_PATH}", found "${receipt.wbsPath}"`);
  }
  if (receipt.decision !== EXPECTED_DECISION) {
    errors.push(`receipt.decision must be "${EXPECTED_DECISION}", found "${receipt.decision}"`);
  }
  if (receipt.decisionAuthority !== EXPECTED_DECISION_AUTHORITY) {
    errors.push(`receipt.decisionAuthority must be "${EXPECTED_DECISION_AUTHORITY}", found "${receipt.decisionAuthority}"`);
  }
  if (receipt.decisionSource !== EXPECTED_DECISION_SOURCE) {
    errors.push(`receipt.decisionSource must match authorized closure decision source ("${EXPECTED_DECISION_SOURCE}"), found "${receipt.decisionSource}"`);
  }
  if (receipt.fromStatus !== EXPECTED_FROM_STATUS) {
    errors.push(`receipt.fromStatus must be "${EXPECTED_FROM_STATUS}", found "${receipt.fromStatus}"`);
  }
  if (receipt.toStatus !== EXPECTED_TO_STATUS) {
    errors.push(`receipt.toStatus must be "${EXPECTED_TO_STATUS}", found "${receipt.toStatus}"`);
  }
  if (receipt.approvedCandidateDigest !== EXPECTED_APPROVED_CANDIDATE_DIGEST) {
    errors.push(`receipt.approvedCandidateDigest must match immutable candidate digest "${EXPECTED_APPROVED_CANDIDATE_DIGEST}", found "${receipt.approvedCandidateDigest}"`);
  }
  if (receipt.candidateFile !== EXPECTED_CANDIDATE_FILE) {
    errors.push(`receipt.candidateFile must be "${EXPECTED_CANDIDATE_FILE}", found "${receipt.candidateFile}"`);
  }
  if (receipt.implementationHeadSha !== EXPECTED_IMPLEMENTATION_HEAD_SHA) {
    errors.push(`receipt.implementationHeadSha must match ${EXPECTED_IMPLEMENTATION_HEAD_SHA}, found "${receipt.implementationHeadSha}"`);
  }
  if (receipt.implementationCiRunId !== EXPECTED_IMPLEMENTATION_CI_RUN_ID) {
    errors.push(`receipt.implementationCiRunId must match ${EXPECTED_IMPLEMENTATION_CI_RUN_ID}, found ${receipt.implementationCiRunId}`);
  }
  if (receipt.implementationCiAttempt !== EXPECTED_IMPLEMENTATION_CI_ATTEMPT) {
    errors.push(`receipt.implementationCiAttempt must match ${EXPECTED_IMPLEMENTATION_CI_ATTEMPT}, found ${receipt.implementationCiAttempt}`);
  }
  if (receipt.implementationCiConclusion !== EXPECTED_IMPLEMENTATION_CI_CONCLUSION) {
    errors.push(`receipt.implementationCiConclusion must match "${EXPECTED_IMPLEMENTATION_CI_CONCLUSION}", found "${receipt.implementationCiConclusion}"`);
  }
  if (receipt.preClosureBranchSha !== EXPECTED_PRE_CLOSURE_BRANCH_SHA) {
    errors.push(`receipt.preClosureBranchSha must match ${EXPECTED_PRE_CLOSURE_BRANCH_SHA}, found "${receipt.preClosureBranchSha}"`);
  }
  if (receipt.baseMasterSha !== EXPECTED_BASE_MASTER_SHA) {
    errors.push(`receipt.baseMasterSha must match ${EXPECTED_BASE_MASTER_SHA}, found "${receipt.baseMasterSha}"`);
  }
  if (receipt.acceptanceCriterion !== EXPECTED_ACCEPTANCE_CRITERION) {
    errors.push(`receipt.acceptanceCriterion must be "${EXPECTED_ACCEPTANCE_CRITERION}", found "${receipt.acceptanceCriterion}"`);
  }
  const evidenceList: string[] = Array.isArray(receipt.verificationEvidence)
    ? receipt.verificationEvidence
    : receipt.verificationEvidence ? [receipt.verificationEvidence] : [];
  for (const reqEv of EXPECTED_VERIFICATION_EVIDENCE) {
    if (!evidenceList.includes(reqEv)) {
      errors.push(`receipt.verificationEvidence must contain "${reqEv}", found ${JSON.stringify(receipt.verificationEvidence)}`);
    }
  }
  if (receipt.implementationChangedDuringClosure !== false) {
    errors.push(`receipt.implementationChangedDuringClosure must be false, found ${receipt.implementationChangedDuringClosure}`);
  }
  if (receipt.preClosureCanonicalWbsSha256 !== EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256) {
    errors.push(`receipt.preClosureCanonicalWbsSha256 must match "${EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256}", found "${receipt.preClosureCanonicalWbsSha256}"`);
  }
  if (receipt.postClosureCanonicalWbsSha256 !== EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256) {
    errors.push(`receipt.postClosureCanonicalWbsSha256 must match "${EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256}", found "${receipt.postClosureCanonicalWbsSha256}"`);
  }
  if (receipt.liveReconciliationExecuted !== false) {
    errors.push(`receipt.liveReconciliationExecuted must be false, found ${receipt.liveReconciliationExecuted}`);
  }
  if (receipt.runtimeWorkItemMutationCount !== 0) {
    errors.push(`receipt.runtimeWorkItemMutationCount must be 0, found ${receipt.runtimeWorkItemMutationCount}`);
  }
  if (receipt.gate7Changed !== false) {
    errors.push(`receipt.gate7Changed must be false, found ${receipt.gate7Changed}`);
  }
  if (receipt.releaseChanged !== false) {
    errors.push(`receipt.releaseChanged must be false, found ${receipt.releaseChanged}`);
  }
  if (receipt.applied !== true) {
    errors.push(`receipt.applied must be true, found ${receipt.applied}`);
  }
  if (receipt.appliedAt !== EXPECTED_APPLIED_AT) {
    errors.push(`receipt.appliedAt must match immutable applied timestamp "${EXPECTED_APPLIED_AT}", found "${receipt.appliedAt}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateDmk197PostMergeAttestation(
  attestation: any,
  options: { workspaceRoot?: string; allowMissingReceiptFile?: boolean } = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!attestation || typeof attestation !== 'object') {
    errors.push('attestation must be a valid non-null object');
    return { valid: false, errors };
  }

  if (attestation.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    errors.push(`attestation.schemaVersion must be "${EXPECTED_SCHEMA_VERSION}", found "${attestation.schemaVersion}"`);
  }
  if (attestation.attestationType !== EXPECTED_ATTESTATION_TYPE) {
    errors.push(`attestation.attestationType must be "${EXPECTED_ATTESTATION_TYPE}", found "${attestation.attestationType}"`);
  }
  if (attestation.projectId !== EXPECTED_PROJECT_ID) {
    errors.push(`attestation.projectId must be "${EXPECTED_PROJECT_ID}", found "${attestation.projectId}"`);
  }
  if (attestation.workItemId !== EXPECTED_WORK_ITEM_ID) {
    errors.push(`attestation.workItemId must be "${EXPECTED_WORK_ITEM_ID}", found "${attestation.workItemId}"`);
  }
  if (attestation.wbsPath !== EXPECTED_WBS_PATH) {
    errors.push(`attestation.wbsPath must be "${EXPECTED_WBS_PATH}", found "${attestation.wbsPath}"`);
  }
  if (attestation.approvedCandidateDigest !== EXPECTED_APPROVED_CANDIDATE_DIGEST) {
    errors.push(`attestation.approvedCandidateDigest must match "${EXPECTED_APPROVED_CANDIDATE_DIGEST}", found "${attestation.approvedCandidateDigest}"`);
  }
  if (attestation.originalReceiptPath !== RECEIPT_FILE_PATH) {
    errors.push(`attestation.originalReceiptPath must be "${RECEIPT_FILE_PATH}", found "${attestation.originalReceiptPath}"`);
  }
  if (attestation.originalReceiptSha256 !== EXPECTED_ORIGINAL_RECEIPT_SHA256) {
    errors.push(`attestation.originalReceiptSha256 must match "${EXPECTED_ORIGINAL_RECEIPT_SHA256}", found "${attestation.originalReceiptSha256}"`);
  }
  if (attestation.originalReceiptAppliedAt !== EXPECTED_APPLIED_AT) {
    errors.push(`attestation.originalReceiptAppliedAt must be "${EXPECTED_APPLIED_AT}", found "${attestation.originalReceiptAppliedAt}"`);
  }
  if (attestation.closureCommitSha !== EXPECTED_CLOSURE_COMMIT_SHA) {
    errors.push(`attestation.closureCommitSha must be "${EXPECTED_CLOSURE_COMMIT_SHA}", found "${attestation.closureCommitSha}"`);
  }
  if (attestation.mergedPullRequest !== EXPECTED_MERGED_PULL_REQUEST) {
    errors.push(`attestation.mergedPullRequest must be ${EXPECTED_MERGED_PULL_REQUEST}, found ${attestation.mergedPullRequest}`);
  }
  if (attestation.mergeCommitSha !== EXPECTED_MERGE_COMMIT_SHA) {
    errors.push(`attestation.mergeCommitSha must be "${EXPECTED_MERGE_COMMIT_SHA}", found "${attestation.mergeCommitSha}"`);
  }
  if (attestation.mergeTimestamp !== EXPECTED_MERGE_TIMESTAMP) {
    errors.push(`attestation.mergeTimestamp must be "${EXPECTED_MERGE_TIMESTAMP}", found "${attestation.mergeTimestamp}"`);
  }
  if (attestation.approvalCommentId !== EXPECTED_APPROVAL_COMMENT_ID) {
    errors.push(`attestation.approvalCommentId must be ${EXPECTED_APPROVAL_COMMENT_ID}, found ${attestation.approvalCommentId}`);
  }
  if (attestation.approvalCommentUrl !== EXPECTED_APPROVAL_COMMENT_URL) {
    errors.push(`attestation.approvalCommentUrl must be "${EXPECTED_APPROVAL_COMMENT_URL}", found "${attestation.approvalCommentUrl}"`);
  }
  if (attestation.approvalAuthor !== EXPECTED_APPROVAL_AUTHOR) {
    errors.push(`attestation.approvalAuthor must be "${EXPECTED_APPROVAL_AUTHOR}", found "${attestation.approvalAuthor}"`);
  }
  if (attestation.approvalAuthorId !== EXPECTED_APPROVAL_AUTHOR_ID) {
    errors.push(`attestation.approvalAuthorId must be ${EXPECTED_APPROVAL_AUTHOR_ID}, found ${attestation.approvalAuthorId}`);
  }
  if (attestation.approvalAuthorAssociation !== EXPECTED_APPROVAL_AUTHOR_ASSOCIATION) {
    errors.push(`attestation.approvalAuthorAssociation must be "${EXPECTED_APPROVAL_AUTHOR_ASSOCIATION}", found "${attestation.approvalAuthorAssociation}"`);
  }
  if (attestation.approvalTimestamp !== EXPECTED_APPROVAL_TIMESTAMP) {
    errors.push(`attestation.approvalTimestamp must be "${EXPECTED_APPROVAL_TIMESTAMP}", found "${attestation.approvalTimestamp}"`);
  }
  if (attestation.approvalDecision !== EXPECTED_APPROVAL_DECISION) {
    errors.push(`attestation.approvalDecision must be "${EXPECTED_APPROVAL_DECISION}", found "${attestation.approvalDecision}"`);
  }
  if (attestation.priorApprovalObtained !== EXPECTED_PRIOR_APPROVAL_OBTAINED) {
    errors.push(`attestation.priorApprovalObtained must be false, found ${attestation.priorApprovalObtained}`);
  }
  if (attestation.retrospectiveIntervalSeconds !== EXPECTED_RETROSPECTIVE_INTERVAL_SECONDS) {
    errors.push(`attestation.retrospectiveIntervalSeconds must be ${EXPECTED_RETROSPECTIVE_INTERVAL_SECONDS}, found ${attestation.retrospectiveIntervalSeconds}`);
  }
  if (attestation.retrospectiveGovernanceStatus !== EXPECTED_RETROSPECTIVE_GOVERNANCE_STATUS) {
    errors.push(`attestation.retrospectiveGovernanceStatus must be "${EXPECTED_RETROSPECTIVE_GOVERNANCE_STATUS}", found "${attestation.retrospectiveGovernanceStatus}"`);
  }
  if (attestation.timestampInterpretation !== EXPECTED_TIMESTAMP_INTERPRETATION) {
    errors.push(`attestation.timestampInterpretation must be "${EXPECTED_TIMESTAMP_INTERPRETATION}", found "${attestation.timestampInterpretation}"`);
  }
  if (attestation.masterCiRunId !== EXPECTED_MASTER_CI_RUN_ID) {
    errors.push(`attestation.masterCiRunId must be ${EXPECTED_MASTER_CI_RUN_ID}, found ${attestation.masterCiRunId}`);
  }
  if (attestation.masterCiAttempt !== EXPECTED_MASTER_CI_ATTEMPT) {
    errors.push(`attestation.masterCiAttempt must be ${EXPECTED_MASTER_CI_ATTEMPT}, found ${attestation.masterCiAttempt}`);
  }
  if (attestation.masterCiConclusion !== EXPECTED_MASTER_CI_CONCLUSION) {
    errors.push(`attestation.masterCiConclusion must be "${EXPECTED_MASTER_CI_CONCLUSION}", found "${attestation.masterCiConclusion}"`);
  }
  if (!attestation.masterCiJobs || typeof attestation.masterCiJobs !== 'object' || Array.isArray(attestation.masterCiJobs)) {
    errors.push(`attestation.masterCiJobs must be an object with required CI jobs, found ${typeof attestation.masterCiJobs}`);
  } else {
    for (const [jobName, expectedConclusion] of Object.entries(EXPECTED_MASTER_CI_JOBS)) {
      if (attestation.masterCiJobs[jobName] !== expectedConclusion) {
        errors.push(`attestation.masterCiJobs["${jobName}"] must be "${expectedConclusion}", found "${attestation.masterCiJobs[jobName]}"`);
      }
    }
    for (const jobName of Object.keys(attestation.masterCiJobs)) {
      if (!Object.prototype.hasOwnProperty.call(EXPECTED_MASTER_CI_JOBS, jobName)) {
        errors.push(`attestation.masterCiJobs contains unexpected job "${jobName}"`);
      }
    }
  }
  if (attestation.canonicalStatus !== EXPECTED_TO_STATUS) {
    errors.push(`attestation.canonicalStatus must be "${EXPECTED_TO_STATUS}", found "${attestation.canonicalStatus}"`);
  }
  if (attestation.verifiedPromoted !== false) {
    errors.push(`attestation.verifiedPromoted must be false, found ${attestation.verifiedPromoted}`);
  }
  if (attestation.liveReconciliationExecuted !== false) {
    errors.push(`attestation.liveReconciliationExecuted must be false, found ${attestation.liveReconciliationExecuted}`);
  }
  if (attestation.gate7Changed !== false) {
    errors.push(`attestation.gate7Changed must be false, found ${attestation.gate7Changed}`);
  }
  if (attestation.releaseChanged !== false) {
    errors.push(`attestation.releaseChanged must be false, found ${attestation.releaseChanged}`);
  }

  // Cross-check receipt on disk against attestation.originalReceiptSha256
  const root = options.workspaceRoot || process.cwd();
  const receiptFile = path.join(root, RECEIPT_FILE_PATH);
  if (!options.allowMissingReceiptFile) {
    if (!fs.existsSync(receiptFile)) {
      errors.push(`Original receipt file missing at ${receiptFile}`);
    } else {
      try {
        const receiptContent = fs.readFileSync(receiptFile, 'utf8');
        if (!receiptContent.trim()) {
          errors.push(`Original receipt file at ${receiptFile} is empty`);
        } else {
          try {
            JSON.parse(receiptContent);
          } catch (err: any) {
            errors.push(`Failed to parse original receipt file JSON at ${receiptFile}: ${err.message}`);
          }
          const computedReceiptSha = crypto.createHash('sha256').update(Buffer.from(receiptContent)).digest('hex');
          if (computedReceiptSha !== attestation.originalReceiptSha256) {
            errors.push(`attestation.originalReceiptSha256 mismatch with disk receipt: computed="${computedReceiptSha}", attestation="${attestation.originalReceiptSha256}"`);
          }
        }
      } catch (err: any) {
        errors.push(`Failed to read original receipt file at ${receiptFile}: ${err.message}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateDmk197ClosureComplete(
  receipt: any,
  attestation: any,
  options: { workspaceRoot?: string; allowMissingReceiptFile?: boolean } = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const receiptRes = validateDmk197ClosureReceipt(receipt, options);
  if (!receiptRes.valid) {
    errors.push(...receiptRes.errors);
  }
  const attestationRes = validateDmk197PostMergeAttestation(attestation, options);
  if (!attestationRes.valid) {
    errors.push(...attestationRes.errors);
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function verifyDmk197Closure(options: VerifyDmk197ClosureOptions = {}, acquireForward?: TrustedForwardEvidenceProvider) {
  const { historicalBytes, continuity } = verifyWorkspaceWbsContinuity(options.workspaceRoot || process.cwd(), acquireForward);
  const historical = verifyHistoricalClosure({ ...options, customWbsYamlContent: options.customWbsYamlContent ?? historicalBytes?.toString('utf8') });
  return combineWbsVerification(historical, continuity);
}

function verifyHistoricalClosure(options: VerifyDmk197ClosureOptions): { valid: boolean; errors: string[] } {
  const root = options.workspaceRoot || process.cwd();
  const receiptPath = path.join(root, RECEIPT_FILE_PATH);
  const errors: string[] = [];

  let receipt = options.customReceipt;
  if (receipt === undefined) {
    if (!fs.existsSync(receiptPath)) {
      errors.push(`Closure receipt does not exist at ${receiptPath}`);
      return { valid: false, errors };
    }
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    } catch (e: any) {
      errors.push(`Failed to parse closure receipt JSON: ${e.message}`);
      return { valid: false, errors };
    }
  } else if (receipt === null) {
    errors.push('Closure receipt is missing');
    return { valid: false, errors };
  }

  const receiptValidation = validateDmk197ClosureReceipt(receipt, { workspaceRoot: root });
  if (!receiptValidation.valid) {
    errors.push(...receiptValidation.errors);
  }

  // Post-merge governance attestation validation
  const attestationPath = path.join(root, ATTESTATION_FILE_PATH);
  let attestation = options.customAttestation;
  if (attestation === undefined) {
    if (!fs.existsSync(attestationPath)) {
      errors.push(`Post-merge governance attestation does not exist at ${attestationPath}`);
    } else {
      try {
        attestation = JSON.parse(fs.readFileSync(attestationPath, 'utf8'));
      } catch (e: any) {
        errors.push(`Failed to parse governance attestation JSON: ${e.message}`);
      }
    }
  } else if (attestation === null) {
    errors.push(`Post-merge governance attestation is missing`);
  }

  if (attestation) {
    const attestationValidation = validateDmk197PostMergeAttestation(attestation, {
      workspaceRoot: root,
      allowMissingReceiptFile: options.allowMissingReceiptFile,
    });
    if (!attestationValidation.valid) {
      errors.push(...attestationValidation.errors);
    }
  }

  // Candidate validation
  const candidatePath = path.join(root, receipt?.candidateFile || EXPECTED_CANDIDATE_FILE);
  if (!fs.existsSync(candidatePath)) {
    errors.push(`Candidate file missing at ${candidatePath}`);
  } else {
    try {
      const candidateObj = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
      const { candidateDigest, ...rest } = candidateObj;
      const canonical = canonicalJsonStringify(rest);
      const computed = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
      if (computed !== EXPECTED_APPROVED_CANDIDATE_DIGEST) {
        errors.push(`Candidate digest mismatch: computed="${computed}", expected="${EXPECTED_APPROVED_CANDIDATE_DIGEST}"`);
      }
      if (candidateDigest !== EXPECTED_APPROVED_CANDIDATE_DIGEST) {
        errors.push(`Candidate candidateDigest mismatch: internal="${candidateDigest}", expected="${EXPECTED_APPROVED_CANDIDATE_DIGEST}"`);
      }
    } catch (e: any) {
      errors.push(`Failed to parse candidate JSON: ${e.message}`);
    }
  }

  // Verification evidence files exist
  if (!options.allowMissingEvidenceFile) {
    for (const evRel of EXPECTED_VERIFICATION_EVIDENCE) {
      const evFull = path.join(root, evRel);
      if (!fs.existsSync(evFull)) {
        errors.push(`Verification evidence file missing at ${evFull}`);
      }
    }
  }

  // Canonical WBS checks
  const wbsPath = path.join(root, 'docs', '00_control', 'MASTER_WBS.yaml');
  let wbsContent = options.customWbsYamlContent;
  if (wbsContent === undefined) {
    if (!fs.existsSync(wbsPath)) {
      errors.push(`MASTER_WBS.yaml does not exist at ${wbsPath}`);
      return { valid: false, errors };
    }
    wbsContent = fs.readFileSync(wbsPath, 'utf8');
  }

  const wbsSha = crypto.createHash('sha256').update(Buffer.from(wbsContent)).digest('hex');
  if (receipt?.postClosureCanonicalWbsSha256 !== wbsSha) {
    errors.push(`WBS digest mismatch: receipt postClosureCanonicalWbsSha256="${receipt?.postClosureCanonicalWbsSha256}", actual="${wbsSha}"`);
  }

  let doc: any;
  try {
    doc = YAML.parse(wbsContent);
  } catch (e: any) {
    errors.push(`Failed to parse MASTER_WBS.yaml: ${e.message}`);
    return { valid: false, errors };
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
  const dmk197 = findItem(allItems, 'DMK-197');
  if (!dmk197) {
    errors.push('DMK-197 not found in MASTER_WBS.yaml');
  } else {
    if (dmk197.status !== EXPECTED_TO_STATUS) {
      errors.push(`DMK-197 status must be "${EXPECTED_TO_STATUS}", found "${dmk197.status}"`);
    }
    if (dmk197.wbs_path !== EXPECTED_WBS_PATH) {
      errors.push(`DMK-197 wbs_path mismatch: expected "${EXPECTED_WBS_PATH}", found "${dmk197.wbs_path}"`);
    }
    const criteria: string[] = Array.isArray(dmk197.acceptance_criteria)
      ? dmk197.acceptance_criteria
      : dmk197.acceptance_criteria ? [dmk197.acceptance_criteria] : [];
    if (!criteria.includes(EXPECTED_ACCEPTANCE_CRITERION)) {
      errors.push(`DMK-197 acceptance criteria must contain "${EXPECTED_ACCEPTANCE_CRITERION}", found ${JSON.stringify(dmk197.acceptance_criteria)}`);
    }
    const evidenceList: string[] = Array.isArray(dmk197.evidence)
      ? dmk197.evidence
      : dmk197.evidence ? [dmk197.evidence] : [];
    if (!evidenceList.includes('docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md')) {
      errors.push('DMK-197 evidence must contain "docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md"');
    }
    if (!evidenceList.includes('docs/07_verification/dmk-197-closure-transition-candidate.json')) {
      errors.push('DMK-197 evidence must contain "docs/07_verification/dmk-197-closure-transition-candidate.json"');
    }
  }

  // Adjacent WorkItem invariant checks
  const dmk196 = findItem(allItems, 'DMK-196');
  if (!dmk196 || dmk196.status !== 'VERIFIED') {
    errors.push(`DMK-196 status must remain "VERIFIED", found "${dmk196?.status}"`);
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
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('--- Verifying DMK-197 Closure Transition ---');
  const result = verifyDmk197Closure();
  if (result.valid) {
    console.log('✓ [PASS] DMK-197 closure transition verified successfully.');
    process.exit(0);
  } else {
    console.error('✗ [FAIL] DMK-197 closure verification errors:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}
