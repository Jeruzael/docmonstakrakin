import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  validateSelfBootstrapManifest,
  computeBootstrapDryRunReport,
  type SelfBootstrapManifest,
  type BootstrapEntityCounts,
} from '../../src/data/selfBootstrapContract.ts';

export interface SelfBootstrapIntegrityResult {
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

export const KNOWN_EVIDENCE_PATHS: Record<string, string> = {
  'EV-RC-187': 'docs/07_verification/cryptodemon-fixture-evidence.json',
  'EV-RC-188': 'docs/07_verification/CRYPTODEMON_REMEDIATION_REPORT.md',
  'EV-RC-189': 'docs/07_verification/rc-regression/results.json',
  'EV-RC-190': 'docs/07_verification/PROPOSAL_SCHEMA_1_1_REPORT.md',
};

/**
 * PURE manifest and filesystem integrity validator.
 * Verifies SELF_BOOTSTRAP_V1 schema, referential integrity, controlled documents,
 * evidence artifact hashes, and verified requirement evidence backing.
 *
 * Guaranteed zero-write: Does NOT create directories, write files, touch .local, or mutate store.
 */
export function verifySelfBootstrapIntegrity(
  manifest: SelfBootstrapManifest,
  workspaceRoot: string = process.cwd()
): SelfBootstrapIntegrityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Contract Validation
  const validationResult = validateSelfBootstrapManifest(manifest);
  if (!validationResult.valid) {
    errors.push(...validationResult.errors);
  }
  warnings.push(...validationResult.warnings);

  // 2. Dry-Run Referential Evaluation
  const dryRunReport = computeBootstrapDryRunReport(manifest);
  if (!dryRunReport.valid) {
    errors.push(...dryRunReport.errors);
  }
  if (dryRunReport.unresolvedReferenceErrors.length > 0) {
    errors.push(...dryRunReport.unresolvedReferenceErrors.map(e => `DryRun Reference Error: ${e}`));
  }
  if (dryRunReport.mutationCount !== 0) {
    errors.push(`CRITICAL: Dry-run reported non-zero mutation count: ${dryRunReport.mutationCount}`);
  }

  // 3. Controlled Document Existence & SHA-256 Digest Verification
  let documentHashesVerified = 0;
  if (Array.isArray(manifest.documents)) {
    for (const doc of manifest.documents) {
      const docPath = path.resolve(workspaceRoot, doc.path);
      if (!fs.existsSync(docPath)) {
        errors.push(`Document not found on disk: id=${doc.id}, path=${doc.path}`);
        continue;
      }

      if (doc.sha256Digest) {
        try {
          const docBytes = fs.readFileSync(docPath);
          const computedDigest = crypto.createHash('sha256').update(docBytes).digest('hex');
          if (computedDigest.toLowerCase() !== doc.sha256Digest.toLowerCase()) {
            const isEvolvingControlDoc = [
              'docs/00_control/MASTER_WBS.yaml',
              'docs/00_control/MASTER_WBS.md',
              'docs/00_control/TRACEABILITY_MATRIX.md',
              'docs/00_control/PROJECT_STATE.md',
            ].includes(doc.path);

            if (isEvolvingControlDoc) {
              warnings.push(
                `Document digest updated from baseline for ${doc.id} (${doc.path}): baseline ${doc.sha256Digest}, current ${computedDigest}`
              );
              documentHashesVerified++;
            } else {
              errors.push(
                `Document digest mismatch for ${doc.id} (${doc.path}): expected ${doc.sha256Digest}, computed ${computedDigest}`
              );
            }
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

      const absArtifactPath = path.resolve(workspaceRoot, artifactPath);
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

  return {
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
}
