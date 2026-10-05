import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { fileURLToPath } from 'node:url';

export interface VerifyDmk196ClosureOptions {
  workspaceRoot?: string;
  customReceipt?: any;
  customWbsYamlContent?: string;
  allowMissingEvidenceFile?: boolean;
}

export const EXPECTED_SCHEMA_VERSION = '1.0';
export const EXPECTED_WORK_ITEM_ID = 'DMK-196';
export const EXPECTED_DECISION = 'APPROVE';
export const EXPECTED_FROM_STATUS = 'IN_PROGRESS';
export const EXPECTED_TO_STATUS = 'VERIFICATION_PENDING';
export const EXPECTED_BASE_MASTER_SHA = '970c6cdbef21c3cc4cd9701c180d849b9ea69e41';
export const EXPECTED_PRE_CLOSURE_BRANCH_SHA = '808bcff954c226f7e2f4fc2795d95bf814711e0d';
export const EXPECTED_ACCEPTANCE_CRITERION = 'Remove direct Approve Requirement UX; replace with Request Sign-Off';
export const EXPECTED_EVIDENCE_DOC = 'docs/07_verification/DMK_196_FORMAL_REQUIREMENT_SIGNOFF_VERIFICATION.md';
export const EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256 = '974a5d8773902a24655efc3f341a70c38ad840e3738f0be3699c18c6bf690c82';
export const EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256 = 'd5adaec2b4d05ccabf08c00a3ce608fb3503d2ef0391f3bb114f1d4faea38c26';
export const EXPECTED_DECISION_AUTHORITY = 'Human operator';
export const EXPECTED_DECISION_SOURCE = 'Explicit human approval following corrected DMK-196 verification evidence review';
export const EXPECTED_APPLIED_AT = '2026-10-05T08:02:30Z';

export function validateDmk196ClosureReceipt(receipt: any): { valid: boolean; errors: string[] } {
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
  if (receipt.decision !== EXPECTED_DECISION) {
    errors.push(`receipt.decision must be "${EXPECTED_DECISION}", found "${receipt.decision}"`);
  }
  if (receipt.fromStatus !== EXPECTED_FROM_STATUS) {
    errors.push(`receipt.fromStatus must be "${EXPECTED_FROM_STATUS}", found "${receipt.fromStatus}"`);
  }
  if (receipt.toStatus !== EXPECTED_TO_STATUS) {
    errors.push(`receipt.toStatus must be "${EXPECTED_TO_STATUS}", found "${receipt.toStatus}"`);
  }
  if (receipt.baseMasterSha !== EXPECTED_BASE_MASTER_SHA) {
    errors.push(`receipt.baseMasterSha must match ${EXPECTED_BASE_MASTER_SHA}, found "${receipt.baseMasterSha}"`);
  }
  if (receipt.preClosureBranchSha !== EXPECTED_PRE_CLOSURE_BRANCH_SHA) {
    errors.push(`receipt.preClosureBranchSha must match ${EXPECTED_PRE_CLOSURE_BRANCH_SHA}, found "${receipt.preClosureBranchSha}"`);
  }
  if (receipt.acceptanceCriterion !== EXPECTED_ACCEPTANCE_CRITERION) {
    errors.push(`receipt.acceptanceCriterion must be "${EXPECTED_ACCEPTANCE_CRITERION}", found "${receipt.acceptanceCriterion}"`);
  }
  if (receipt.verificationEvidence !== EXPECTED_EVIDENCE_DOC) {
    errors.push(`receipt.verificationEvidence must be "${EXPECTED_EVIDENCE_DOC}", found "${receipt.verificationEvidence}"`);
  }
  if (receipt.implementationChangedDuringClosure !== false) {
    errors.push(`receipt.implementationChangedDuringClosure must be false, found ${receipt.implementationChangedDuringClosure}`);
  }
  if (receipt.preClosureCanonicalWbsSha256 !== EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256) {
    errors.push(`receipt.preClosureCanonicalWbsSha256 must match ${EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256}, found "${receipt.preClosureCanonicalWbsSha256}"`);
  }
  if (receipt.postClosureCanonicalWbsSha256 !== EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256) {
    errors.push(`receipt.postClosureCanonicalWbsSha256 must match ${EXPECTED_POST_CLOSURE_CANONICAL_WBS_SHA256}, found "${receipt.postClosureCanonicalWbsSha256}"`);
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
  if (receipt.decisionAuthority !== EXPECTED_DECISION_AUTHORITY) {
    errors.push(`receipt.decisionAuthority must be "${EXPECTED_DECISION_AUTHORITY}", found "${receipt.decisionAuthority}"`);
  }
  if (receipt.decisionSource !== EXPECTED_DECISION_SOURCE) {
    errors.push(`receipt.decisionSource must match authorized closure decision source ("${EXPECTED_DECISION_SOURCE}"), found "${receipt.decisionSource}"`);
  }
  if (receipt.appliedAt !== EXPECTED_APPLIED_AT) {
    errors.push(`receipt.appliedAt must match immutable applied timestamp "${EXPECTED_APPLIED_AT}", found "${receipt.appliedAt}"`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function verifyDmk196Closure(options: VerifyDmk196ClosureOptions = {}): { valid: boolean; errors: string[] } {
  const root = options.workspaceRoot || process.cwd();
  const receiptPath = path.join(root, 'docs', '07_verification', 'dmk-196-closure-transition-receipt.json');
  const errors: string[] = [];

  let receipt = options.customReceipt;
  if (!receipt) {
    if (!fs.existsSync(receiptPath)) {
      errors.push(`Receipt does not exist at ${receiptPath}`);
      return { valid: false, errors };
    }
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    } catch (e: any) {
      errors.push(`Failed to parse receipt JSON: ${e.message}`);
      return { valid: false, errors };
    }
  }

  const receiptValidation = validateDmk196ClosureReceipt(receipt);
  if (!receiptValidation.valid) {
    errors.push(...receiptValidation.errors);
  }

  // WBS checks
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
  const dmk196 = findItem(allItems, 'DMK-196');
  if (!dmk196) {
    errors.push('DMK-196 not found in MASTER_WBS.yaml');
  } else {
    if (dmk196.status !== 'VERIFICATION_PENDING') {
      errors.push(`DMK-196 status must be "VERIFICATION_PENDING", found "${dmk196.status}"`);
    }
    const evidenceList: string[] = Array.isArray(dmk196.evidence)
      ? dmk196.evidence
      : dmk196.evidence ? [dmk196.evidence] : [];
    if (!evidenceList.includes(EXPECTED_EVIDENCE_DOC)) {
      errors.push(`DMK-196 evidence must contain "${EXPECTED_EVIDENCE_DOC}", found ${JSON.stringify(dmk196.evidence)}`);
    }
  }

  const dmk197 = findItem(allItems, 'DMK-197');
  if (!dmk197 || dmk197.status !== 'IN_PROGRESS') {
    errors.push(`DMK-197 status must remain "IN_PROGRESS", found "${dmk197?.status}"`);
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

  // Verification evidence file exists
  if (!options.allowMissingEvidenceFile) {
    const evidencePath = path.join(root, EXPECTED_EVIDENCE_DOC);
    if (!fs.existsSync(evidencePath)) {
      errors.push(`Verification evidence file missing at ${evidencePath}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('--- Verifying DMK-196 Closure Transition ---');
  const result = verifyDmk196Closure();
  if (result.valid) {
    console.log('✓ [PASS] DMK-196 closure transition verified successfully.');
    process.exit(0);
  } else {
    console.error('✗ [FAIL] DMK-196 closure verification errors:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}
