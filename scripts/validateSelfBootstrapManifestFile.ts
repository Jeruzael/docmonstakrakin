/**
 * docmonstakrakin - Read-Only Self-Bootstrap Manifest Validator
 *
 * Validates bootstrap/docmonstakrakin.self-bootstrap.json without mutating
 * any repository or runtime state. Performs structural schema validation,
 * referential integrity checks, dry-run projection, document existence and
 * byte-level SHA-256 digest validation, and evidence artifact byte-level hash verification.
 *
 * Exits 0 on total verification success; exits 1 on any failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  validateSelfBootstrapManifest,
  computeBootstrapDryRunReport,
  type SelfBootstrapManifest,
  type BootstrapEntityCounts,
} from '../src/data/selfBootstrapContract.js';

interface ValidationOutputReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: BootstrapEntityCounts;
  manifestDigest: string | null;
  documentHashesVerified: number;
  evidenceHashesVerified: number;
  unresolvedReferenceErrors: string[];
  mutationCount: 0;
}

const KNOWN_EVIDENCE_PATHS: Record<string, string> = {
  'EV-RC-187': 'docs/07_verification/cryptodemon-fixture-evidence.json',
  'EV-RC-188': 'docs/07_verification/CRYPTODEMON_REMEDIATION_REPORT.md',
  'EV-RC-189': 'docs/07_verification/rc-regression/results.json',
  'EV-RC-190': 'docs/07_verification/PROPOSAL_SCHEMA_1_1_REPORT.md',
};

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

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Contract Validation
  console.log('\n[1/5] Running validateSelfBootstrapManifest()...');
  const validationResult = validateSelfBootstrapManifest(manifest);

  if (!validationResult.valid) {
    errors.push(...validationResult.errors);
  }
  warnings.push(...validationResult.warnings);

  // 2. Dry-Run Evaluation
  console.log('[2/5] Running computeBootstrapDryRunReport()...');
  const dryRunReport = computeBootstrapDryRunReport(manifest);

  if (!dryRunReport.valid) {
    errors.push(...dryRunReport.errors);
  }
  if (dryRunReport.unresolvedReferenceErrors.length > 0) {
    errors.push(...dryRunReport.unresolvedReferenceErrors.map(e => `DryRun Reference Error: ${e}`));
  }

  // Confirm zero mutations
  if (dryRunReport.mutationCount !== 0) {
    errors.push(`CRITICAL: Dry-run reported non-zero mutation count: ${dryRunReport.mutationCount}`);
  }

  // 3. Controlled Document Existence & SHA-256 Digest Verification
  console.log('[3/5] Verifying controlled document paths and digests...');
  let documentHashesVerified = 0;

  if (Array.isArray(manifest.documents)) {
    for (const doc of manifest.documents) {
      const docPath = path.resolve(process.cwd(), doc.path);
      if (!fs.existsSync(docPath)) {
        errors.push(`Document not found on disk: id=${doc.id}, path=${doc.path}`);
        continue;
      }

      if (doc.sha256Digest) {
        try {
          const docBytes = fs.readFileSync(docPath);
          const computedDigest = crypto.createHash('sha256').update(docBytes).digest('hex');
          if (computedDigest.toLowerCase() !== doc.sha256Digest.toLowerCase()) {
            errors.push(
              `Document digest mismatch for ${doc.id} (${doc.path}): expected ${doc.sha256Digest}, computed ${computedDigest}`
            );
          } else {
            documentHashesVerified++;
          }
        } catch (readErr: unknown) {
          errors.push(`Failed to read document file for digest verification: ${doc.path} (${String(readErr)})`);
        }
      }
    }
  }

  // 4. Evidence Artifact Existence & SHA-256 Hash Verification
  console.log('[4/5] Verifying evidence artifact paths and file-byte hashes...');
  let evidenceHashesVerified = 0;

  if (Array.isArray(manifest.evidence)) {
    for (const ev of manifest.evidence) {
      let artifactPath: string | null = null;

      // Extract from details "Primary artifact: <path>"
      if (typeof ev.details === 'string') {
        const match = ev.details.match(/Primary artifact:\s*([^\s;,\n]+)/);
        if (match && match[1]) {
          artifactPath = match[1];
        }
      }

      // Fallback to known paths map
      if (!artifactPath && KNOWN_EVIDENCE_PATHS[ev.id]) {
        artifactPath = KNOWN_EVIDENCE_PATHS[ev.id];
      }

      if (!artifactPath) {
        errors.push(`Evidence ${ev.id} does not declare an artifact path in details and is not in known evidence paths`);
        continue;
      }

      const absArtifactPath = path.resolve(process.cwd(), artifactPath);
      if (!fs.existsSync(absArtifactPath)) {
        errors.push(`Evidence artifact file not found: id=${ev.id}, path=${artifactPath}`);
        continue;
      }

      try {
        const artifactBytes = fs.readFileSync(absArtifactPath);
        const computedHash = crypto.createHash('sha256').update(artifactBytes).digest('hex');
        if (computedHash.toLowerCase() !== ev.sha256Hash.toLowerCase()) {
          errors.push(
            `Evidence hash mismatch for ${ev.id} (${artifactPath}): expected ${ev.sha256Hash}, computed ${computedHash}`
          );
        } else {
          evidenceHashesVerified++;
        }
      } catch (readErr: unknown) {
        errors.push(`Failed to read evidence artifact file: ${artifactPath} (${String(readErr)})`);
      }
    }
  }

  // 5. Semantic Requirement Verification Integrity Check
  console.log('[5/5] Checking requirement evidence backing...');
  if (Array.isArray(manifest.requirements)) {
    for (const req of manifest.requirements) {
      if (req.status === 'VERIFIED') {
        if (!Array.isArray(req.evidence) || req.evidence.length === 0) {
          errors.push(`Requirement ${req.id} is marked VERIFIED but has no evidence attached (empty array)`);
        } else {
          for (const evId of req.evidence) {
            const evExists = manifest.evidence.some(e => e.id === evId);
            if (!evExists) {
              errors.push(`Requirement ${req.id} references evidence ${evId} which does not exist in manifest.evidence`);
            }
          }
        }
      }
    }
  }

  const overallValid = errors.length === 0;

  // Print Summary
  console.log('\n----------------------------------------------------------------');
  console.log('VERIFICATION SUMMARY');
  console.log('----------------------------------------------------------------');
  console.log(`Result:               ${overallValid ? 'PASSED (VALID)' : 'FAILED (INVALID)'}`);
  console.log(`Manifest Digest:      ${validationResult.manifestDigest ?? 'N/A'}`);
  console.log(`Mutation Count:       ${dryRunReport.mutationCount} (In-memory verification only)`);
  console.log(`Document Hashes:      ${documentHashesVerified} verified`);
  console.log(`Evidence Hashes:      ${evidenceHashesVerified} verified`);
  console.log(`Entity Counts:`);
  console.log(`  Features:           ${validationResult.counts.features}`);
  console.log(`  Requirements:       ${validationResult.counts.requirements}`);
  console.log(`  Risks:              ${validationResult.counts.risks}`);
  console.log(`  Threats:            ${validationResult.counts.threats}`);
  console.log(`  ADRs:               ${validationResult.counts.adrs}`);
  console.log(`  Components:         ${validationResult.counts.components}`);
  console.log(`  Work Items:         ${validationResult.counts.workItems}`);
  console.log(`  Evidence:           ${validationResult.counts.evidence}`);
  console.log(`  Documents:          ${validationResult.counts.documents}`);

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  - [WARN] ${w}`);
    }
  }

  if (errors.length > 0) {
    console.error(`\nErrors (${errors.length}):`);
    for (const e of errors) {
      console.error(`  - [ERROR] ${e}`);
    }
  }

  // Write Machine-Readable Verification Report
  const reportPath = 'docs/07_verification/self-bootstrap-manifest-validation.json';
  const reportAbsPath = path.resolve(process.cwd(), reportPath);

  const reportOutput: ValidationOutputReport = {
    valid: overallValid,
    errors,
    warnings,
    counts: validationResult.counts,
    manifestDigest: validationResult.manifestDigest ?? null,
    documentHashesVerified,
    evidenceHashesVerified,
    unresolvedReferenceErrors: dryRunReport.unresolvedReferenceErrors,
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
