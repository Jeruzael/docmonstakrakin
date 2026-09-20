/**
 * docmonstakrakin - Read-Only Self-Bootstrap Manifest Validator
 *
 * Validates bootstrap/docmonstakrakin.self-bootstrap.json without mutating
 * any runtime state. Performs structural schema validation, referential integrity checks,
 * dry-run projection, document existence and byte-level SHA-256 digest validation,
 * and evidence artifact byte-level hash verification using the pure integrity helper.
 *
 * Exits 0 on total verification success; exits 1 on any failure.
 * Explicitly writes verification report to docs/07_verification/self-bootstrap-manifest-validation.json
 * when invoked via npm run test:bootstrap:manifest.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { SelfBootstrapManifest } from '../src/data/selfBootstrapContract.ts';
import {
  verifySelfBootstrapIntegrity,
  type SelfBootstrapIntegrityResult,
} from '../server/bootstrap/selfBootstrapIntegrity.ts';

function main(): void {
  const manifestRelPath = 'bootstrap/docmonstakrakin.self-bootstrap.json';
  const manifestAbsPath = path.resolve(process.cwd(), manifestRelPath);

  console.log('================================================================');
  console.log('docmonstakrakin - Self-Bootstrap Manifest Verification');
  console.log('================================================================');
  console.log(`Reading manifest: ${manifestRelPath}`);

  if (!fs.existsSync(manifestAbsPath)) {
    console.error(`FATAL: Manifest file not found at ${manifestRelPath}`);
    process.exit(1);
  }

  let rawContent: string;
  let manifest: SelfBootstrapManifest;

  try {
    rawContent = fs.readFileSync(manifestAbsPath, 'utf-8');
    manifest = JSON.parse(rawContent) as SelfBootstrapManifest;
  } catch (err: unknown) {
    console.error('FATAL: Failed to read or parse JSON manifest:', err);
    process.exit(1);
  }

  console.log('\nRunning pure integrity verification (schema, referential, docs, evidence, requirements)...');
  const result: SelfBootstrapIntegrityResult = verifySelfBootstrapIntegrity(manifest, process.cwd());

  const overallValid = result.valid;

  // Print Summary
  console.log('\n----------------------------------------------------------------');
  console.log('VERIFICATION SUMMARY');
  console.log('----------------------------------------------------------------');
  console.log(`Result:               ${overallValid ? 'PASSED (VALID)' : 'FAILED (INVALID)'}`);
  console.log(`Manifest Digest:      ${result.manifestDigest ?? 'N/A'}`);
  console.log(`Mutation Count:       ${result.mutationCount} (In-memory verification only)`);
  console.log(`Document Hashes:      ${result.documentHashesVerified} verified`);
  console.log(`Evidence Hashes:      ${result.evidenceHashesVerified} verified`);
  console.log(`Entity Counts:`);
  console.log(`  Features:           ${result.counts.features}`);
  console.log(`  Requirements:       ${result.counts.requirements}`);
  console.log(`  Risks:              ${result.counts.risks}`);
  console.log(`  Threats:            ${result.counts.threats}`);
  console.log(`  ADRs:               ${result.counts.adrs}`);
  console.log(`  Components:         ${result.counts.components}`);
  console.log(`  Work Items:         ${result.counts.workItems}`);
  console.log(`  Evidence:           ${result.counts.evidence}`);
  console.log(`  Documents:          ${result.counts.documents}`);

  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.log(`  - [WARN] ${w}`);
    }
  }

  if (result.errors.length > 0) {
    console.error(`\nErrors (${result.errors.length}):`);
    for (const e of result.errors) {
      console.error(`  - [ERROR] ${e}`);
    }
  }

  // Write Machine-Readable Verification Report
  const reportPath = 'docs/07_verification/self-bootstrap-manifest-validation.json';
  const reportAbsPath = path.resolve(process.cwd(), reportPath);

  const reportOutput = {
    valid: overallValid,
    errors: result.errors,
    warnings: result.warnings,
    counts: result.counts,
    manifestDigest: result.manifestDigest ?? null,
    documentHashesVerified: result.documentHashesVerified,
    evidenceHashesVerified: result.evidenceHashesVerified,
    unresolvedReferenceErrors: result.unresolvedReferenceErrors,
    mutationCount: 0,
  };

  try {
    fs.mkdirSync(path.dirname(reportAbsPath), { recursive: true });
    fs.writeFileSync(reportAbsPath, JSON.stringify(reportOutput, null, 2) + '\n', 'utf-8');
    console.log(`\nSaved verification report: ${reportPath}`);
  } catch (writeErr: unknown) {
    console.error(`Failed to write verification report to ${reportPath}:`, writeErr);
  }

  if (!overallValid) {
    console.error('\nSelf-bootstrap manifest verification FAILED.');
    process.exit(1);
  }

  console.log('\nSelf-bootstrap manifest verification PASSED successfully.');
}

main();
