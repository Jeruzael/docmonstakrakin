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

export const EXPECTED_BASE_MASTER_SHA = '970c6cdbef21c3cc4cd9701c180d849b9ea69e41';
export const EXPECTED_PRE_CLOSURE_BRANCH_SHA = '808bcff954c226f7e2f4fc2795d95bf814711e0d';
export const EXPECTED_EVIDENCE_DOC = 'docs/07_verification/DMK_196_FORMAL_REQUIREMENT_SIGNOFF_VERIFICATION.md';

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

  if (receipt.workItemId !== 'DMK-196') {
    errors.push(`receipt.workItemId must be "DMK-196", found "${receipt.workItemId}"`);
  }
  if (receipt.decision !== 'APPROVE') {
    errors.push(`receipt.decision must be "APPROVE", found "${receipt.decision}"`);
  }
  if (receipt.fromStatus !== 'IN_PROGRESS') {
    errors.push(`receipt.fromStatus must be "IN_PROGRESS", found "${receipt.fromStatus}"`);
  }
  if (receipt.toStatus !== 'VERIFICATION_PENDING') {
    errors.push(`receipt.toStatus must be "VERIFICATION_PENDING", found "${receipt.toStatus}"`);
  }
  if (receipt.baseMasterSha !== EXPECTED_BASE_MASTER_SHA) {
    errors.push(`receipt.baseMasterSha must match ${EXPECTED_BASE_MASTER_SHA}, found "${receipt.baseMasterSha}"`);
  }
  if (receipt.preClosureBranchSha !== EXPECTED_PRE_CLOSURE_BRANCH_SHA) {
    errors.push(`receipt.preClosureBranchSha must match ${EXPECTED_PRE_CLOSURE_BRANCH_SHA}, found "${receipt.preClosureBranchSha}"`);
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
  if (receipt.postClosureCanonicalWbsSha256 !== wbsSha) {
    errors.push(`WBS digest mismatch: receipt postClosureCanonicalWbsSha256="${receipt.postClosureCanonicalWbsSha256}", actual="${wbsSha}"`);
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
