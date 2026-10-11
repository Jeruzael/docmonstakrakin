import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { fileURLToPath } from 'node:url';

export interface VerifyDmk197ClosureOptions {
  workspaceRoot?: string;
  customReceipt?: any;
  customWbsYamlContent?: string;
  allowMissingEvidenceFile?: boolean;
}

export const EXPECTED_SCHEMA_VERSION = '1.0';
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

export function verifyDmk197Closure(options: VerifyDmk197ClosureOptions = {}): { valid: boolean; errors: string[] } {
  const root = options.workspaceRoot || process.cwd();
  const receiptPath = path.join(root, RECEIPT_FILE_PATH);
  const errors: string[] = [];

  let receipt = options.customReceipt;
  if (!receipt) {
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
  }

  const receiptValidation = validateDmk197ClosureReceipt(receipt, { workspaceRoot: root });
  if (!receiptValidation.valid) {
    errors.push(...receiptValidation.errors);
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
