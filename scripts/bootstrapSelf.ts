#!/usr/bin/env tsx
/**
 * docmonstakrakin - Trusted Self-Bootstrap CLI
 *
 * Implements Step 4 / DMK-192 read-only dry-run and gated executor.
 *
 * Supported Commands:
 *   npm run bootstrap:self -- --dry-run
 *   npm run bootstrap:self -- --dry-run --json
 *   npm run bootstrap:self -- --execute --confirm-project-id PRJ-DOCMONSTAKRAKIN
 */

import { executeSelfBootstrap, type SelfBootstrapReport } from '../server/bootstrap/selfBootstrapExecutor.ts';

function parseArgs(args: string[]) {
  let dryRun = false;
  let execute = false;
  let json = false;
  let confirmProjectId: string | undefined;
  let confirmManifestDigest: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--execute') {
      execute = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--confirm-project-id' && i + 1 < args.length) {
      confirmProjectId = args[++i];
    } else if (arg.startsWith('--confirm-project-id=')) {
      confirmProjectId = arg.split('=')[1];
    } else if (arg === '--confirm-manifest-digest' && i + 1 < args.length) {
      confirmManifestDigest = args[++i];
    } else if (arg.startsWith('--confirm-manifest-digest=')) {
      confirmManifestDigest = arg.split('=')[1];
    }
  }

  return { dryRun, execute, json, confirmProjectId, confirmManifestDigest };
}

function printHumanReport(report: SelfBootstrapReport): void {
  console.log('================================================================');
  console.log('docmonstakrakin - TRUSTED SELF-BOOTSTRAP CLI (DMK-192)');
  console.log('================================================================');
  console.log(`Execution Mode:          ${report.mode}`);
  console.log(`Target Project ID:       ${report.projectToCreate}`);
  console.log(`Bootstrap Schema:        v${report.schemaVersion} (${report.bootstrapMode})`);
  console.log(`Manifest Digest:         ${report.manifestDigest ?? 'N/A'}`);
  console.log(`Overall Status:          ${report.status}`);
  console.log('----------------------------------------------------------------');
  console.log('CANONICAL BASE STATE & PRESERVATION:');
  console.log(`  Snapshot Path:         ${report.snapshot.path}`);
  console.log(`  Snapshot Existed:      ${report.snapshot.existedBefore ? 'YES' : 'NO (Using built-in baseline state)'}`);
  console.log(`  Preserved Projects:    ${report.preservation.preservedProjectCount} (${report.preservation.preservedProjectIds.join(', ') || 'None'})`);
  console.log(`  State Equivalence:     ${report.preservation.unrelatedStateEquivalent ? 'VERIFIED (100% unchanged)' : 'FAILED'}`);
  console.log(`  Unrelated State Before Hash:     ${report.preservation.beforeUnrelatedStateHash}`);
  console.log(`  Unrelated State Candidate Hash:  ${report.preservation.candidateUnrelatedStateHash}`);
  console.log('----------------------------------------------------------------');
  console.log('CANDIDATE SELF-PROJECT DATA:');
  console.log(`  Features:              ${report.candidate.featuresCount}`);
  console.log(`  Requirements:          ${report.candidate.requirementsCount}`);
  console.log(`  Risks:                 ${report.candidate.risksCount}`);
  console.log(`  Threats:               ${report.candidate.threatsCount}`);
  console.log(`  ADRs:                  ${report.candidate.adrCount}`);
  console.log(`  Components:            ${report.candidate.componentCount}`);
  console.log(`  Work Items:            ${report.candidate.workItemCount}`);
  console.log(`  Evidence Artifacts:    ${report.candidate.evidenceCount}`);
  console.log(`  Controlled Documents:  ${report.candidate.documentCount}`);
  console.log('----------------------------------------------------------------');
  console.log('EMPTY INITIALIZED COLLECTIONS (No synthetic wizard data):');
  console.log(`  Collections:           ${report.emptyInitializedCollections.join(', ')}`);
  console.log('----------------------------------------------------------------');
  console.log('AUDIT EVENT & GOVERNANCE INVARIANTS:');
  console.log(`  Planned Action:        ${report.plannedAudit.action}`);
  console.log(`  Actor / Target:        ${report.plannedAudit.actor} -> ${report.plannedAudit.target}`);
  console.log(`  Persisted to Ledger:   ${report.plannedAudit.persisted ? 'YES' : 'NO (Zero persistence in dry-run)'}`);
  console.log(`  Audit Ledger Valid:    ${report.auditLedgerValid ? 'VERIFIED (Genesis chained)' : 'FAILED'}`);
  console.log(`  Approvals Injected:    ${report.governance.approvalsInjected} (Strict zero-injection invariant)`);
  console.log(`  Release Signoff:       ${report.governance.releaseSignoffInjected ? 'INJECTED' : 'NONE (Preserved)'}`);
  console.log(`  Gate 7 Executed:       ${report.governance.gate7Executed ? 'YES' : 'NO (NOT EXECUTED)'}`);
  console.log('----------------------------------------------------------------');
  console.log('FILESYSTEM & MUTATION TOTALS:');
  console.log(`  Snapshot Written:      ${report.filesystem.snapshotWritten ? 'YES' : 'NO'}`);
  console.log(`  Temp Files Created:    ${report.filesystem.tempFilesCreated}`);
  console.log(`  Total Mutations:       ${report.mutationCount}`);
  console.log('================================================================');

  if (report.warnings.length > 0) {
    console.log(`\nWarnings (${report.warnings.length}):`);
    for (const w of report.warnings) {
      console.log(`  - [WARN] ${w}`);
    }
  }

  if (report.errors.length > 0) {
    console.error(`\nErrors (${report.errors.length}):`);
    for (const e of report.errors) {
      console.error(`  - [ERROR] ${e}`);
    }
  }

  if (report.status === 'SAFE_TO_REVIEW') {
    console.log('\n>>> DRY-RUN SUCCESS: Candidate state verified safe for HUMAN REVIEW.');
    console.log('>>> NOTE: Actual bootstrap execution (Step 5 / DMK-193) remains BLOCKED until human approval.');
  } else if (report.status === 'EXECUTED') {
    console.log('\n>>> EXECUTION SUCCESS: Candidate state snapshot atomically written to disk.');
  } else {
    console.error(`\n>>> SELF-BOOTSTRAP EVALUATION FAILED with status: ${report.status}`);
  }
}

function main(): void {
  const { dryRun, execute, json, confirmProjectId, confirmManifestDigest } = parseArgs(process.argv.slice(2));

  if (!dryRun && !execute) {
    console.error('Usage: tsx scripts/bootstrapSelf.ts [--dry-run | --execute] [--json] [--confirm-project-id ID] [--confirm-manifest-digest DIGEST]');
    console.error('Error: Must specify either --dry-run or --execute');
    process.exit(1);
  }

  if (dryRun && execute) {
    console.error('Error: Cannot specify both --dry-run and --execute');
    process.exit(1);
  }

  const mode = dryRun ? 'DRY_RUN' : 'EXECUTE';
  const report = executeSelfBootstrap({
    workspaceRoot: process.cwd(),
    mode,
    confirmProjectId,
    confirmManifestDigest,
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  if (report.status === 'SAFE_TO_REVIEW' || report.status === 'EXECUTED') {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
