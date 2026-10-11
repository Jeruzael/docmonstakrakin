import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { fileURLToPath } from 'node:url';

export interface Dmk197ClosureCandidate {
  schemaVersion: string;
  candidateType: string;
  workItemId: string;
  wbsPath: string;
  decisionRequired: boolean;
  fromStatus: string;
  candidateStatus: string;
  implementationPullRequest: number;
  implementationHeadSha: string;
  baseMasterSha: string;
  implementationCiRunId: number;
  implementationCiAttempt: number;
  implementationCiConclusion: string;
  qualityBuildConclusion: string;
  controlledDocsConclusion: string;
  completeRegressionConclusion: string;
  acceptanceCriterion: string;
  verificationEvidence: string;
  preClosureCanonicalWbsSha256: string;
  technicalImplementationVerification: string;
  humanGovernanceStatus: string;
  humanDecisionStatus: string;
  humanApprovedByPresent: boolean;
  reconciliationBlockerCount: number;
  liveReconciliationExecuted: boolean;
  runtimeWorkItemMutationCount: number;
  gate7Changed: boolean;
  releaseChanged: boolean;
  supersededCandidateDigest?: string;
  candidateDigest: string;
}

export interface VerifyDmk197ClosureCandidateOptions {
  workspaceRoot?: string;
  customCandidate?: any;
  customWbsYamlContent?: string;
  allowMissingEvidenceFile?: boolean;
  skipDigestCheck?: boolean;
}

export const EXPECTED_SCHEMA_VERSION = '1.0';
export const EXPECTED_CANDIDATE_TYPE = 'CLOSURE_TRANSITION';
export const EXPECTED_WORK_ITEM_ID = 'DMK-197';
export const EXPECTED_WBS_PATH = '13.06.11';
export const EXPECTED_DECISION_REQUIRED = true;
export const EXPECTED_FROM_STATUS = 'IN_PROGRESS';
export const EXPECTED_CANDIDATE_STATUS = 'VERIFICATION_PENDING';
export const EXPECTED_IMPLEMENTATION_PR = 27;
export const EXPECTED_FROZEN_IMPLEMENTATION_HEAD_SHA = 'ae9f536b6bb0dcde11f96dbf319a70f89dbd2a00';
export const EXPECTED_BASE_MASTER_SHA = '7e45da9b0d4d8553745e5b7c25597eb48c94d6af';
export const EXPECTED_IMPLEMENTATION_CI_RUN_ID = 38144817899;
export const EXPECTED_IMPLEMENTATION_CI_ATTEMPT = 1;
export const EXPECTED_IMPLEMENTATION_CI_CONCLUSION = 'success';
export const EXPECTED_QUALITY_BUILD_CONCLUSION = 'success';
export const EXPECTED_CONTROLLED_DOCS_CONCLUSION = 'success';
export const EXPECTED_COMPLETE_REGRESSION_CONCLUSION = 'success';
export const EXPECTED_ACCEPTANCE_CRITERION = 'Distinct Security Officer and Lead Architect human identities required for quorum';
export const EXPECTED_VERIFICATION_EVIDENCE_PATH = 'docs/07_verification/DMK_197_APPROVAL_INBOX_QUORUM_VERIFICATION.md';
export const EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256 = 'c4bf5011d5d234b1e16b2ab4f0a3d07b1ab0a34a77b7e97b6463adbcea290087';
export const EXPECTED_TECHNICAL_VERIFICATION = 'PASS';
export const EXPECTED_HUMAN_GOVERNANCE_STATUS = 'PENDING_SIGNOFF';
export const EXPECTED_HUMAN_DECISION_STATUS = 'PENDING';
export const EXPECTED_HUMAN_APPROVED_BY_PRESENT = false;
export const EXPECTED_RECONCILIATION_BLOCKERS = 11;
export const EXPECTED_LIVE_RECONCILIATION = false;
export const EXPECTED_RUNTIME_WORK_ITEM_MUTATIONS = 0;
export const EXPECTED_GATE7_CHANGED = false;
export const EXPECTED_RELEASE_CHANGED = false;
export const EXPECTED_SUPERSEDED_CANDIDATE_DIGEST = 'b6c3aa4874f05813767e12015cda4ffa1996684c48be30defcd210e65296f0d7';
export const EXPECTED_CANDIDATE_DIGEST = '4f808143eb07c2770df238fc4f641de75896bba389f39f99cdc8bb9d92791ad8';

export const CANDIDATE_FILE_PATH = 'docs/07_verification/dmk-197-closure-transition-candidate.json';

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

export function computeDmk197ClosureCandidateDigest(candidate: any): string {
  const { candidateDigest, ...rest } = candidate;
  const canonical = canonicalJsonStringify(rest);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function validateDmk197ClosureCandidate(
  candidate: any,
  options: { skipDigestCheck?: boolean } = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    errors.push('Candidate must be a valid non-null object');
    return { valid: false, errors };
  }

  if (candidate.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    errors.push(`candidate.schemaVersion must be "${EXPECTED_SCHEMA_VERSION}", found "${candidate.schemaVersion}"`);
  }
  if (candidate.candidateType !== EXPECTED_CANDIDATE_TYPE) {
    errors.push(`candidate.candidateType must be "${EXPECTED_CANDIDATE_TYPE}", found "${candidate.candidateType}"`);
  }
  if (candidate.workItemId !== EXPECTED_WORK_ITEM_ID) {
    errors.push(`candidate.workItemId must be "${EXPECTED_WORK_ITEM_ID}", found "${candidate.workItemId}"`);
  }
  if (candidate.wbsPath !== EXPECTED_WBS_PATH) {
    errors.push(`candidate.wbsPath must be "${EXPECTED_WBS_PATH}", found "${candidate.wbsPath}"`);
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
  if (candidate.implementationPullRequest !== EXPECTED_IMPLEMENTATION_PR) {
    errors.push(`candidate.implementationPullRequest must be ${EXPECTED_IMPLEMENTATION_PR}, found ${candidate.implementationPullRequest}`);
  }
  if (candidate.implementationHeadSha !== EXPECTED_FROZEN_IMPLEMENTATION_HEAD_SHA) {
    errors.push(`candidate.implementationHeadSha must match ${EXPECTED_FROZEN_IMPLEMENTATION_HEAD_SHA}, found "${candidate.implementationHeadSha}"`);
  }
  if (candidate.baseMasterSha !== EXPECTED_BASE_MASTER_SHA) {
    errors.push(`candidate.baseMasterSha must match ${EXPECTED_BASE_MASTER_SHA}, found "${candidate.baseMasterSha}"`);
  }
  if (candidate.implementationCiRunId !== EXPECTED_IMPLEMENTATION_CI_RUN_ID) {
    errors.push(`candidate.implementationCiRunId must be ${EXPECTED_IMPLEMENTATION_CI_RUN_ID}, found ${candidate.implementationCiRunId}`);
  }
  if (candidate.implementationCiAttempt !== EXPECTED_IMPLEMENTATION_CI_ATTEMPT) {
    errors.push(`candidate.implementationCiAttempt must be ${EXPECTED_IMPLEMENTATION_CI_ATTEMPT}, found ${candidate.implementationCiAttempt}`);
  }
  if (candidate.implementationCiConclusion !== EXPECTED_IMPLEMENTATION_CI_CONCLUSION) {
    errors.push(`candidate.implementationCiConclusion must be "${EXPECTED_IMPLEMENTATION_CI_CONCLUSION}", found "${candidate.implementationCiConclusion}"`);
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
  if (candidate.verificationEvidence !== EXPECTED_VERIFICATION_EVIDENCE_PATH) {
    errors.push(`candidate.verificationEvidence must be "${EXPECTED_VERIFICATION_EVIDENCE_PATH}", found "${candidate.verificationEvidence}"`);
  }
  if (candidate.preClosureCanonicalWbsSha256 !== EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256) {
    errors.push(`candidate.preClosureCanonicalWbsSha256 must match "${EXPECTED_PRE_CLOSURE_CANONICAL_WBS_SHA256}", found "${candidate.preClosureCanonicalWbsSha256}"`);
  }
  if (candidate.technicalImplementationVerification !== EXPECTED_TECHNICAL_VERIFICATION) {
    errors.push(`candidate.technicalImplementationVerification must be "${EXPECTED_TECHNICAL_VERIFICATION}", found "${candidate.technicalImplementationVerification}"`);
  }
  if (candidate.humanGovernanceStatus !== EXPECTED_HUMAN_GOVERNANCE_STATUS) {
    errors.push(`candidate.humanGovernanceStatus must be "${EXPECTED_HUMAN_GOVERNANCE_STATUS}", found "${candidate.humanGovernanceStatus}"`);
  }
  if (candidate.humanDecisionStatus !== EXPECTED_HUMAN_DECISION_STATUS) {
    errors.push(`candidate.humanDecisionStatus must be "${EXPECTED_HUMAN_DECISION_STATUS}", found "${candidate.humanDecisionStatus}"`);
  }
  if (candidate.humanApprovedByPresent !== EXPECTED_HUMAN_APPROVED_BY_PRESENT) {
    errors.push(`candidate.humanApprovedByPresent must be false, found ${candidate.humanApprovedByPresent}`);
  }
  if (candidate.reconciliationBlockerCount !== EXPECTED_RECONCILIATION_BLOCKERS) {
    errors.push(`candidate.reconciliationBlockerCount must be ${EXPECTED_RECONCILIATION_BLOCKERS}, found ${candidate.reconciliationBlockerCount}`);
  }
  if (candidate.liveReconciliationExecuted !== EXPECTED_LIVE_RECONCILIATION) {
    errors.push(`candidate.liveReconciliationExecuted must be false, found ${candidate.liveReconciliationExecuted}`);
  }
  if (candidate.runtimeWorkItemMutationCount !== EXPECTED_RUNTIME_WORK_ITEM_MUTATIONS) {
    errors.push(`candidate.runtimeWorkItemMutationCount must be 0, found ${candidate.runtimeWorkItemMutationCount}`);
  }
  if (candidate.gate7Changed !== EXPECTED_GATE7_CHANGED) {
    errors.push(`candidate.gate7Changed must be false, found ${candidate.gate7Changed}`);
  }
  if (candidate.releaseChanged !== EXPECTED_RELEASE_CHANGED) {
    errors.push(`candidate.releaseChanged must be false, found ${candidate.releaseChanged}`);
  }
  if (candidate.supersededCandidateDigest !== EXPECTED_SUPERSEDED_CANDIDATE_DIGEST) {
    errors.push(`candidate.supersededCandidateDigest must match "${EXPECTED_SUPERSEDED_CANDIDATE_DIGEST}", found "${candidate.supersededCandidateDigest}"`);
  }

  // Reject unauthorized closure application or approval fields
  if (candidate.applied !== undefined || candidate.appliedAt !== undefined) {
    errors.push('Candidate must not contain applied or appliedAt fields; application requires explicit separate authorization');
  }
  if (candidate.decision !== undefined || candidate.decisionAuthority !== undefined || candidate.decisionSource !== undefined) {
    errors.push('Candidate must not contain premature approval decision or decisionAuthority fields');
  }
  if (candidate.human_approved_by !== undefined) {
    errors.push('Candidate must not contain human_approved_by; human governance remains PENDING_SIGNOFF');
  }

  if (!options.skipDigestCheck) {
    const computedDigest = computeDmk197ClosureCandidateDigest(candidate);
    if (candidate.candidateDigest !== computedDigest) {
      errors.push(`candidate.candidateDigest mismatch: declared="${candidate.candidateDigest}", computed="${computedDigest}"`);
    }
    if (candidate.candidateDigest !== EXPECTED_CANDIDATE_DIGEST) {
      errors.push(`candidate.candidateDigest mismatch against expected immutable candidate digest "${EXPECTED_CANDIDATE_DIGEST}", found "${candidate.candidateDigest}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function verifyDmk197ClosureCandidate(
  options: VerifyDmk197ClosureCandidateOptions = {}
): { valid: boolean; errors: string[] } {
  const root = options.workspaceRoot || process.cwd();
  const candidatePath = path.join(root, CANDIDATE_FILE_PATH);
  const errors: string[] = [];

  let candidate = options.customCandidate;
  if (!candidate) {
    if (!fs.existsSync(candidatePath)) {
      errors.push(`Candidate file does not exist at ${candidatePath}`);
      return { valid: false, errors };
    }
    try {
      candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    } catch (e: any) {
      errors.push(`Failed to parse candidate JSON: ${e.message}`);
      return { valid: false, errors };
    }
  }

  const candidateValidation = validateDmk197ClosureCandidate(candidate, {
    skipDigestCheck: options.skipDigestCheck,
  });
  if (!candidateValidation.valid) {
    errors.push(...candidateValidation.errors);
  }

  // Verification evidence file exists
  if (!options.allowMissingEvidenceFile) {
    const evidencePath = path.join(root, EXPECTED_VERIFICATION_EVIDENCE_PATH);
    if (!fs.existsSync(evidencePath)) {
      errors.push(`Verification evidence file missing at ${evidencePath}`);
    }
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
  if (candidate?.preClosureCanonicalWbsSha256 !== wbsSha) {
    errors.push(`WBS digest mismatch: candidate preClosureCanonicalWbsSha256="${candidate?.preClosureCanonicalWbsSha256}", actual="${wbsSha}"`);
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
    if (dmk197.status !== 'IN_PROGRESS') {
      errors.push(`DMK-197 status must remain "IN_PROGRESS" during candidate preparation, found "${dmk197.status}"`);
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

  // Check that no closure receipt exists yet for DMK-197
  const receiptPath = path.join(root, 'docs', '07_verification', 'dmk-197-closure-transition-receipt.json');
  if (fs.existsSync(receiptPath)) {
    errors.push(`Closure receipt already exists at ${receiptPath}; premature receipt creation is forbidden`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('--- Verifying DMK-197 Closure Transition Candidate ---');
  const result = verifyDmk197ClosureCandidate();
  if (result.valid) {
    console.log('✓ [PASS] DMK-197 closure transition candidate verified successfully.');
    console.log(`  Candidate Digest: ${EXPECTED_CANDIDATE_DIGEST}`);
    process.exit(0);
  } else {
    console.error('✗ [FAIL] DMK-197 closure candidate verification errors:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
}
