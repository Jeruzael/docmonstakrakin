/**
 * docmonstakrakin - Read-Only Trusted Self-Bootstrap Post-Execution Verifier (DMK-193)
 *
 * Strictly READ-ONLY verification tool that compares a baseline pre-execution snapshot
 * against a current post-execution snapshot.
 *
 * Verifies:
 * 1. Snapshot validity & schema integrity
 * 2. Exact target project creation (PRJ-DOCMONSTAKRAKIN)
 * 3. Exact project count addition (N -> N+1) and isolated project ID set
 * 4. Unrelated project state preservation across all canonical entity collections
 * 5. Deep canonical mapping between reviewed manifest and self-project collections
 * 6. Empty initialized discovery/governance collections
 * 7. Zero injected governance / Gate 7 unexecuted
 * 8. Cryptographic audit ledger chaining & single PROJECT_BOOTSTRAPPED genesis event
 * 9. Manifest binding against canonical reviewed digest (229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36)
 *
 * ZERO DISK MUTATIONS:
 * Never writes snapshots, never writes validation reports, never deletes files.
 *
 * CLI Usage:
 *   npx tsx scripts/verifySelfBootstrapExecution.ts --baseline-snapshot <path> [--current-snapshot <path>] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  canonicalizeJson,
  SELF_BOOTSTRAP_DEFAULT_PROJECT_ID,
  type SelfBootstrapManifest,
} from '../src/data/selfBootstrapContract.ts';
import {
  verifySelfBootstrapIntegrity,
  type SelfBootstrapIntegrityResult,
} from '../server/bootstrap/selfBootstrapIntegrity.ts';
import {
  EMPTY_INITIALIZED_COLLECTIONS,
  hashProjectsState,
} from '../server/bootstrap/selfBootstrapExecutor.ts';
import {
  PROJECT_STATE_SCHEMA_VERSION,
  type ProjectStateSnapshot,
  resolveProjectStatePath,
} from '../server/projectPersistence.ts';
import {
  verifyAuditLedgerChain,
  computeAuditEventHash,
  GENESIS_AUDIT_HASH,
} from '../server/security/auditImmutability.ts';

export const TARGET_PROJECT_ID = SELF_BOOTSTRAP_DEFAULT_PROJECT_ID;
export const CANONICAL_REVIEWED_MANIFEST_DIGEST =
  '229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36';

export const EXPECTED_ENTITY_COUNTS = {
  features: 15,
  requirements: 24,
  risks: 6,
  threats: 8,
  adrs: 7,
  components: 6,
  workItems: 13,
  evidence: 4,
  documents: 28,
} as const;

/**
 * Returns true when a value contains an explicit Gate 7 reference.
 *
 * Approval records are persisted JSON and may evolve structurally, so this
 * intentionally inspects nested string values rather than depending on one
 * UI-specific field layout.
 */
function isGate7Reference(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /\bgate[\s_-]*7\b/i.test(value.trim())
  );
}

export interface VerifyExecutionOptions {
  baselineSnapshotPath: string;
  currentSnapshotPath?: string;
  workspaceRoot?: string;
  manifestPath?: string;
}

export interface BootstrapExecutionVerificationResult {
  status: 'BOOTSTRAP_VERIFIED' | 'BOOTSTRAP_VERIFICATION_FAILED';
  targetProject: typeof TARGET_PROJECT_ID;
  baselineSnapshotPath: string;
  currentSnapshotPath: string;
  baselineProjectCount: number;
  currentProjectCount: number;
  newProjectIds: string[];
  unrelatedStateEquivalent: boolean;
  baselineUnrelatedStateHash: string;
  currentUnrelatedStateHash: string;
  manifestDigest: string;
  entityCounts: {
    features: number;
    requirements: number;
    risks: number;
    threats: number;
    adrs: number;
    components: number;
    workItems: number;
    evidence: number;
    documents: number;
  };
  emptyCollectionsVerified: boolean;
  bootstrapAuditEvents: number;
  auditLedgerValid: boolean;
  approvalsInjected: number;
  releaseSignoffInjected: boolean;
  gate7Executed: boolean;
  mutationCount: 0;
  errors: string[];
}

/**
 * Loads a project state snapshot from disk in a strictly read-only manner.
 */
export function loadSnapshotReadOnly(filePath: string): ProjectStateSnapshot {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Snapshot file does not exist: ${filePath}`);
  }
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    throw new Error(`Failed to read snapshot file at ${filePath}: ${String(err)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    throw new Error(`Invalid JSON in snapshot file at ${filePath}: ${String(err)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Snapshot at ${filePath} is not a valid JSON object`);
  }

  if (parsed.schemaVersion !== PROJECT_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported snapshot schemaVersion ${parsed.schemaVersion} at ${filePath}. Expected ${PROJECT_STATE_SCHEMA_VERSION}.`
    );
  }

  if (!parsed.state || typeof parsed.state !== 'object' || !Array.isArray(parsed.state.projects)) {
    throw new Error(`Snapshot at ${filePath} does not contain valid state.projects array`);
  }

  return parsed as ProjectStateSnapshot;
}

/**
 * Executes deep read-only verification of a post-bootstrap snapshot against a baseline snapshot
 * and the authoritative reviewed manifest.
 */
export function verifySelfBootstrapExecution(
  options: VerifyExecutionOptions
): BootstrapExecutionVerificationResult {
  const errors: string[] = [];
  const workspaceRoot = options.workspaceRoot || process.cwd();
  const baselineSnapshotPath = path.isAbsolute(options.baselineSnapshotPath)
    ? options.baselineSnapshotPath
    : path.resolve(workspaceRoot, options.baselineSnapshotPath);

  const currentSnapshotPath = options.currentSnapshotPath
    ? path.isAbsolute(options.currentSnapshotPath)
      ? options.currentSnapshotPath
      : path.resolve(workspaceRoot, options.currentSnapshotPath)
    : resolveProjectStatePath(workspaceRoot);

  const manifestRelPath = options.manifestPath || 'bootstrap/docmonstakrakin.self-bootstrap.json';
  const manifestAbsPath = path.isAbsolute(manifestRelPath)
    ? manifestRelPath
    : path.resolve(workspaceRoot, manifestRelPath);

  // Initialize report skeleton
  const report: BootstrapExecutionVerificationResult = {
    status: 'BOOTSTRAP_VERIFICATION_FAILED',
    targetProject: TARGET_PROJECT_ID,
    baselineSnapshotPath,
    currentSnapshotPath,
    baselineProjectCount: 0,
    currentProjectCount: 0,
    newProjectIds: [],
    unrelatedStateEquivalent: false,
    baselineUnrelatedStateHash: '',
    currentUnrelatedStateHash: '',
    manifestDigest: '',
    entityCounts: {
      features: 0,
      requirements: 0,
      risks: 0,
      threats: 0,
      adrs: 0,
      components: 0,
      workItems: 0,
      evidence: 0,
      documents: 0,
    },
    emptyCollectionsVerified: false,
    bootstrapAuditEvents: 0,
    auditLedgerValid: false,
    approvalsInjected: 0,
    releaseSignoffInjected: false,
    gate7Executed: false,
    mutationCount: 0,
    errors,
  };

  // CHECK A: Manifest integrity & digest binding
  if (!fs.existsSync(manifestAbsPath)) {
    errors.push(`Authoritative manifest file not found: ${manifestAbsPath}`);
    return report;
  }

  let manifest: SelfBootstrapManifest;
  try {
    const rawManifest = fs.readFileSync(manifestAbsPath, 'utf8');
    manifest = JSON.parse(rawManifest) as SelfBootstrapManifest;
  } catch (err: unknown) {
    errors.push(`Failed to read or parse manifest at ${manifestAbsPath}: ${String(err)}`);
    return report;
  }

  const manifestIntegrity: SelfBootstrapIntegrityResult = verifySelfBootstrapIntegrity(
    manifest,
    workspaceRoot
  );

  report.manifestDigest = manifestIntegrity.manifestDigest || '';

  if (!manifestIntegrity.valid) {
    errors.push(
      `Manifest integrity verification failed: ${manifestIntegrity.errors.join('; ')}`
    );
  }

  if (manifestIntegrity.manifestDigest !== CANONICAL_REVIEWED_MANIFEST_DIGEST) {
    errors.push(
      `Manifest digest mismatch: expected ${CANONICAL_REVIEWED_MANIFEST_DIGEST}, got ${manifestIntegrity.manifestDigest}`
    );
  }

  // CHECK B: Load baseline snapshot
  let baselineSnapshot: ProjectStateSnapshot;
  try {
    baselineSnapshot = loadSnapshotReadOnly(baselineSnapshotPath);
  } catch (err: unknown) {
    errors.push(`Failed to load baseline snapshot: ${(err as Error).message}`);
    return report;
  }

  // CHECK C: Load current snapshot
  let currentSnapshot: ProjectStateSnapshot;
  try {
    currentSnapshot = loadSnapshotReadOnly(currentSnapshotPath);
  } catch (err: unknown) {
    errors.push(`Failed to load current snapshot: ${(err as Error).message}`);
    return report;
  }

  const baseStore = baselineSnapshot.state;
  const currentStore = currentSnapshot.state;

  const baseProjects: any[] = baseStore.projects || [];
  const currentProjects: any[] = currentStore.projects || [];

  report.baselineProjectCount = baseProjects.length;
  report.currentProjectCount = currentProjects.length;

  const baseProjectIds = baseProjects.map(p => p.id);
  const currentProjectIds = currentProjects.map(p => p.id);

  // Target project existence in baseline must be FALSE
  if (baseProjectIds.includes(TARGET_PROJECT_ID)) {
    errors.push(
      `Baseline snapshot already contains target project ${TARGET_PROJECT_ID}. Baseline must precede self-bootstrap.`
    );
  }

  // Target project existence in current must be TRUE
  const targetProjectMatches = currentProjects.filter(p => p.id === TARGET_PROJECT_ID);
  if (targetProjectMatches.length === 0) {
    errors.push(`Current snapshot does not contain target project ${TARGET_PROJECT_ID}.`);
  } else if (targetProjectMatches.length > 1) {
    errors.push(
      `Current snapshot contains duplicate entries for target project ${TARGET_PROJECT_ID} (${targetProjectMatches.length}).`
    );
  }

  // CHECK D: Expected project addition (N -> N+1)
  const newlyCreatedIds = currentProjectIds.filter(id => !baseProjectIds.includes(id));
  const removedIds = baseProjectIds.filter(id => !currentProjectIds.includes(id));
  report.newProjectIds = newlyCreatedIds;

  if (removedIds.length > 0) {
    errors.push(`Projects from baseline were unexpectedly removed: ${removedIds.join(', ')}`);
  }

  if (newlyCreatedIds.length !== 1 || newlyCreatedIds[0] !== TARGET_PROJECT_ID) {
    errors.push(
      `Expected exactly one new project ID [${TARGET_PROJECT_ID}], but found: ${JSON.stringify(newlyCreatedIds)}`
    );
  }

  if (report.currentProjectCount !== report.baselineProjectCount + 1) {
    errors.push(
      `Project count mismatch: baseline has ${report.baselineProjectCount}, current has ${report.currentProjectCount}. Expected ${report.baselineProjectCount + 1}.`
    );
  }

  // CHECK E: Unrelated project preservation across all canonical entity collections
  const baseHash = hashProjectsState(baseStore, baseProjectIds);
  const currentUnrelatedHash = hashProjectsState(currentStore, baseProjectIds);

  report.baselineUnrelatedStateHash = baseHash;
  report.currentUnrelatedStateHash = currentUnrelatedHash;
  report.unrelatedStateEquivalent = baseHash === currentUnrelatedHash;

  if (!report.unrelatedStateEquivalent) {
    errors.push(
      `Unrelated project state was mutated during bootstrap. Baseline hash: ${baseHash}, Current hash: ${currentUnrelatedHash}`
    );
  }

  // Detailed per-collection unrelated check for actionable reporting
  for (const pid of baseProjectIds) {
    const baseP = canonicalizeJson(baseProjects.find(p => p.id === pid));
    const currP = canonicalizeJson(currentProjects.find(p => p.id === pid));
    if (baseP !== currP) {
      errors.push(`Unrelated project ${pid} core metadata was modified`);
    }

    const collections = [
      'questions',
      'requirements',
      'risks',
      'threats',
      'standards',
      'workItems',
      'evidence',
      'adrs',
      'components',
      'overrides',
      'approvals',
      'agentRoles',
      'agentRuns',
      'features',
      'derivations',
      'importSessions',
      'documents',
      'auditLogs',
    ];

    for (const col of collections) {
      const baseCol = canonicalizeJson(baseStore[col]?.[pid] || []);
      const currCol = canonicalizeJson(currentStore[col]?.[pid] || []);
      if (baseCol !== currCol) {
        errors.push(`Unrelated project ${pid} collection '${col}' was modified`);
      }
    }
  }

  // CHECK F: Self-project manifest mapping
  const targetProject = targetProjectMatches[0];
  if (targetProject) {
    const projectCanonical = canonicalizeJson(targetProject);
    const manifestProjectCanonical = canonicalizeJson(manifest.project);
    if (projectCanonical !== manifestProjectCanonical) {
      errors.push(
        `Target project core metadata does not match manifest.project canonically`
      );
    }

    // Compare manifest collections
    const manifestMappings: Array<{
      name: keyof typeof EXPECTED_ENTITY_COUNTS;
      storeKey: string;
      manifestData: any[];
      expectedCount: number;
    }> = [
      { name: 'features', storeKey: 'features', manifestData: manifest.features, expectedCount: EXPECTED_ENTITY_COUNTS.features },
      { name: 'requirements', storeKey: 'requirements', manifestData: manifest.requirements, expectedCount: EXPECTED_ENTITY_COUNTS.requirements },
      { name: 'risks', storeKey: 'risks', manifestData: manifest.risks, expectedCount: EXPECTED_ENTITY_COUNTS.risks },
      { name: 'threats', storeKey: 'threats', manifestData: manifest.threats, expectedCount: EXPECTED_ENTITY_COUNTS.threats },
      { name: 'adrs', storeKey: 'adrs', manifestData: manifest.adrs, expectedCount: EXPECTED_ENTITY_COUNTS.adrs },
      { name: 'components', storeKey: 'components', manifestData: manifest.components, expectedCount: EXPECTED_ENTITY_COUNTS.components },
      { name: 'workItems', storeKey: 'workItems', manifestData: manifest.workItems, expectedCount: EXPECTED_ENTITY_COUNTS.workItems },
      { name: 'evidence', storeKey: 'evidence', manifestData: manifest.evidence, expectedCount: EXPECTED_ENTITY_COUNTS.evidence },
      { name: 'documents', storeKey: 'documents', manifestData: manifest.documents, expectedCount: EXPECTED_ENTITY_COUNTS.documents },
    ];

    for (const mapping of manifestMappings) {
      const storeItems: any[] = currentStore[mapping.storeKey]?.[TARGET_PROJECT_ID] || [];
      report.entityCounts[mapping.name] = storeItems.length;

      if (storeItems.length !== mapping.expectedCount) {
        errors.push(
          `Entity count mismatch for '${mapping.name}': expected ${mapping.expectedCount}, got ${storeItems.length}`
        );
      }

      const storeCanonical = canonicalizeJson(storeItems);
      const manifestCanonical = canonicalizeJson(mapping.manifestData);
      if (storeCanonical !== manifestCanonical) {
        errors.push(
          `Collection '${mapping.name}' for ${TARGET_PROJECT_ID} does not match reviewed manifest content canonically`
        );
      }
    }
  }

  // CHECK G: Empty initialized collections
  let allEmpty = true;
  for (const emptyCol of EMPTY_INITIALIZED_COLLECTIONS) {
    const items = currentStore[emptyCol]?.[TARGET_PROJECT_ID];
    if (!Array.isArray(items) || items.length !== 0) {
      allEmpty = false;
      errors.push(
        `Collection '${emptyCol}' for ${TARGET_PROJECT_ID} must be initialized as empty array []. Found: ${JSON.stringify(items)}`
      );
    }
  }
  report.emptyCollectionsVerified = allEmpty;

  // CHECK H: Governance invariants
  const approvals: any[] = currentStore.approvals?.[TARGET_PROJECT_ID] || [];
  report.approvalsInjected = approvals.length;
  if (approvals.length > 0) {
    errors.push(
      `Governance violation: target project has ${approvals.length} approvals. Must be strictly 0.`
    );
  }

  const releaseSignoff = approvals.some(
    (a: any) => a.type === 'RELEASE_SIGNOFF' || a.id === 'release-signoff'
  );
  report.releaseSignoffInjected = releaseSignoff;
  if (releaseSignoff) {
    errors.push('Governance violation: RELEASE_SIGNOFF approval was injected');
  }

  // Gate 7 execution check.
  // This must be derived from persisted canonical governance state rather than
  // hardcoded. The bootstrap contract requires approvals to be empty, but the
  // explicit Gate 7 check keeps the reported invariant independently truthful.
  const gate7ExecutionEvidence = approvals.some((approval: any) => {
  if (approval?.status !== 'APPROVED') {
    return false;
  }

  if (
    approval?.type !== 'GATE_TRANSITION' ||
    approval?.targetEntityType !== 'GATE'
  ) {
    return false;
  }

  const targetIsGate7 = isGate7Reference(
    approval?.targetEntityId
  );

  const passedGate7Policy =
    Array.isArray(approval?.policyGates) &&
    approval.policyGates.some(
      (gate: any) =>
        gate?.passed === true &&
        isGate7Reference(gate?.gateName)
    );

  return targetIsGate7 || passedGate7Policy;
});

report.gate7Executed = gate7ExecutionEvidence;

if (gate7ExecutionEvidence) {
  errors.push(
    'Governance violation: approved Gate 7 execution evidence was found in the bootstrapped project'
  );
}

  // CHECK I: Audit ledger verification
  const auditLogs: any[] = currentStore.auditLogs?.[TARGET_PROJECT_ID] || [];
  report.bootstrapAuditEvents = auditLogs.length;

  if (auditLogs.length !== 1) {
    errors.push(
      `Audit ledger count mismatch for ${TARGET_PROJECT_ID}: expected exactly 1 initial audit event, found ${auditLogs.length}`
    );
  }

  if (auditLogs.length > 0) {
    const event = auditLogs[0];
    if (event.action !== 'PROJECT_BOOTSTRAPPED') {
      errors.push(
        `Audit event action mismatch: expected 'PROJECT_BOOTSTRAPPED', got '${event.action}'`
      );
    }

    if (event.target !== TARGET_PROJECT_ID) {
      errors.push(
        `Audit event target mismatch: expected '${TARGET_PROJECT_ID}', got '${event.target}'`
      );
    }

    if (event.actor !== 'docmonstakrakin-bootstrap-cli') {
      errors.push(
        `Audit event actor mismatch: expected 'docmonstakrakin-bootstrap-cli', got '${event.actor}'`
      );
    }

    if (event.previousHash !== GENESIS_AUDIT_HASH) {
      errors.push(
        `Audit event previousHash mismatch: expected genesis hash (${GENESIS_AUDIT_HASH}), got '${event.previousHash}'`
      );
    }

    const eventDigest = event.details?.manifestDigest;
    if (eventDigest !== CANONICAL_REVIEWED_MANIFEST_DIGEST) {
      errors.push(
        `Audit event details.manifestDigest mismatch: expected ${CANONICAL_REVIEWED_MANIFEST_DIGEST}, got '${eventDigest}'`
      );
    }

    // Verify cryptographic event hash calculation
    const expectedHash = computeAuditEventHash({
      actor: event.actor,
      timestamp: event.timestamp,
      action: event.action,
      target: event.target,
      reason: event.reason,
      details: event.details,
      previousHash: event.previousHash,
    });

    if (event.stateHash !== expectedHash) {
      errors.push(
        `Audit event stateHash is invalid: declared '${event.stateHash}', computed '${expectedHash}'`
      );
    }

    // Verify cryptographic audit chain
    const chainVerification = verifyAuditLedgerChain(auditLogs, 'REVERSE_CHRONOLOGICAL');
    report.auditLedgerValid = chainVerification.valid;
    if (!chainVerification.valid) {
      errors.push(`Audit ledger chain validation failed: ${chainVerification.error}`);
    }
  }

  // Final status determination (FAIL-CLOSED)
  if (errors.length === 0) {
    report.status = 'BOOTSTRAP_VERIFIED';
  } else {
    report.status = 'BOOTSTRAP_VERIFICATION_FAILED';
  }

  return report;
}

/**
 * CLI Entrypoint
 */
export function main(): void {
  const args = process.argv.slice(2);
  let baselineSnapshotPath: string | undefined;
  let currentSnapshotPath: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--baseline-snapshot') {
      baselineSnapshotPath = args[++i];
    } else if (arg.startsWith('--baseline-snapshot=')) {
      baselineSnapshotPath = arg.split('=')[1];
    } else if (arg === '--current-snapshot') {
      currentSnapshotPath = args[++i];
    } else if (arg.startsWith('--current-snapshot=')) {
      currentSnapshotPath = arg.split('=')[1];
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
docmonstakrakin - Trusted Self-Bootstrap Post-Execution Verifier (DMK-193)

Usage:
  npx tsx scripts/verifySelfBootstrapExecution.ts --baseline-snapshot <path> [options]

Required:
  --baseline-snapshot <path>   Path to pre-execution snapshot JSON

Options:
  --current-snapshot <path>    Path to post-execution snapshot JSON (default: .local/project-state.json)
  --json                       Output result in JSON format
  --help, -h                   Show this help message
`);
      process.exit(0);
    }
  }

  if (!baselineSnapshotPath) {
    console.error('ERROR: --baseline-snapshot <path> is required.');
    console.error('Usage: npx tsx scripts/verifySelfBootstrapExecution.ts --baseline-snapshot <path>');
    process.exit(1);
  }

  const result = verifySelfBootstrapExecution({
    baselineSnapshotPath,
    currentSnapshotPath,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('================================================================');
    console.log('docmonstakrakin - POST-BOOTSTRAP EXECUTION VERIFIER (DMK-193)');
    console.log('================================================================');
    console.log(`Status:                     ${result.status}`);
    console.log(`Target Project ID:          ${result.targetProject}`);
    console.log(`Baseline Snapshot Path:     ${result.baselineSnapshotPath}`);
    console.log(`Current Snapshot Path:      ${result.currentSnapshotPath}`);
    console.log(`Baseline Project Count:     ${result.baselineProjectCount}`);
    console.log(`Current Project Count:      ${result.currentProjectCount}`);
    console.log(`Newly Added Project IDs:    ${JSON.stringify(result.newProjectIds)}`);
    console.log(`Unrelated State Preserved:  ${result.unrelatedStateEquivalent ? 'VERIFIED' : 'FAILED'}`);
    console.log(`Baseline Unrelated Hash:    ${result.baselineUnrelatedStateHash}`);
    console.log(`Current Unrelated Hash:     ${result.currentUnrelatedStateHash}`);
    console.log(`Manifest Digest:            ${result.manifestDigest}`);
    console.log('----------------------------------------------------------------');
    console.log('ENTITY COUNTS (PRJ-DOCMONSTAKRAKIN):');
    console.log(`  Features:                 ${result.entityCounts.features} (expected 15)`);
    console.log(`  Requirements:             ${result.entityCounts.requirements} (expected 24)`);
    console.log(`  Risks:                    ${result.entityCounts.risks} (expected 6)`);
    console.log(`  Threats:                  ${result.entityCounts.threats} (expected 8)`);
    console.log(`  ADRs:                     ${result.entityCounts.adrs} (expected 7)`);
    console.log(`  Components:               ${result.entityCounts.components} (expected 6)`);
    console.log(`  Work Items:               ${result.entityCounts.workItems} (expected 13)`);
    console.log(`  Evidence Artifacts:       ${result.entityCounts.evidence} (expected 4)`);
    console.log(`  Controlled Documents:     ${result.entityCounts.documents} (expected 28)`);
    console.log('----------------------------------------------------------------');
    console.log(`Empty Collections Verified: ${result.emptyCollectionsVerified ? 'YES' : 'NO'}`);
    console.log(`Bootstrap Audit Events:     ${result.bootstrapAuditEvents} (expected 1)`);
    console.log(`Audit Ledger Valid:         ${result.auditLedgerValid ? 'YES' : 'NO'}`);
    console.log(`Approvals Injected:         ${result.approvalsInjected} (expected 0)`);
    console.log(`Release Signoff Injected:   ${result.releaseSignoffInjected ? 'YES (VIOLATION)' : 'NO'}`);
    console.log(`Gate 7 Executed:            ${result.gate7Executed ? 'YES (VIOLATION)' : 'NO'}`);
    console.log(`Filesystem Mutations:       ${result.mutationCount} (Strictly Read-Only)`);

    if (result.errors.length > 0) {
      console.log('----------------------------------------------------------------');
      console.log(`ERRORS (${result.errors.length}):`);
      for (const err of result.errors) {
        console.log(`  - [ERROR] ${err}`);
      }
      console.log('================================================================');
      console.log('>>> POST-EXECUTION VERIFICATION FAILED.');
    } else {
      console.log('================================================================');
      console.log('>>> POST-EXECUTION VERIFICATION PASSED: State is CANONICAL & TRUSTED.');
    }
  }

  process.exit(result.status === 'BOOTSTRAP_VERIFIED' ? 0 : 1);
}

// Run CLI when invoked directly
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('verifySelfBootstrapExecution.ts') ||
  process.argv[1].endsWith('verifySelfBootstrapExecution.js')
);

if (isDirectCli) {
  main();
}
