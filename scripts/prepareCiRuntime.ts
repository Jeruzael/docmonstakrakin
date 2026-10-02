/**
 * scripts/prepareCiRuntime.ts
 *
 * Deterministic Synthetic CI Runtime Fixture Initializer
 * DMK-203: Establishes a zero-credential, zero-secret disposable runtime
 * environment required for automated CI execution without developer-local state.
 *
 * SAFETY INVARIANT:
 * Fails closed unless process.env.CI === 'true' or process.env.DMK_ALLOW_CI_FIXTURE === '1'.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ProjectStore } from '../server/projectStore.ts';
import {
  snapshotProjectStore,
  PROJECT_STATE_SCHEMA_VERSION,
} from '../server/projectPersistence.ts';
import { verifyAuditLedgerChain } from '../server/security/auditImmutability.ts';
import type { Project } from '../src/types.ts';

export function prepareCiRuntime(workspaceRoot: string = process.cwd()): {
  snapshotPath: string;
  stateVersion: number;
  auditCount: number;
  snapshotSha256: string;
} {
  // CRITICAL SAFETY RULE: Refuse execution unless in CI or explicit test mode
  const isCi = process.env.CI === 'true';
  const allowCiFixture = process.env.DMK_ALLOW_CI_FIXTURE === '1';

  if (!isCi && !allowCiFixture) {
    console.error(
      'CI_FIXTURE_REFUSED: Synthetic CI runtime initialization is restricted to CI/test environments.'
    );
    process.exit(1);
  }

  const localDir = path.join(workspaceRoot, '.local');
  const projectStatePath = path.join(localDir, 'project-state.json');
  const txDir = path.join(localDir, 'document-transactions');

  // Ensure .local directory exists
  fs.mkdirSync(localDir, { recursive: true });

  // Clean stale lock if present from aborted processes
  const lockFile = path.join(localDir, 'project-state.write.lock');
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
    } catch {
      // Ignore if lock file could not be unlinked
    }
  }

  // Ensure transaction directory exists and is empty
  if (fs.existsSync(txDir)) {
    const files = fs.readdirSync(txDir);
    for (const file of files) {
      if (!file.startsWith('.')) {
        try {
          fs.unlinkSync(path.join(txDir, file));
        } catch {
          // Ignore
        }
      }
    }
  } else {
    fs.mkdirSync(txDir, { recursive: true });
  }

  // Instantiate canonical ProjectStore using existing schema definitions
  const store = new ProjectStore();

  // Load baseline project fields from self-bootstrap manifest if available, or use deterministic fallback
  const manifestPath = path.join(workspaceRoot, 'bootstrap/docmonstakrakin.self-bootstrap.json');
  let baseProjectData: Partial<Project> = {};
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.project) {
        baseProjectData = structuredClone(manifest.project);
      }
    } catch {
      // Fallback to minimal synthetic project if manifest reading fails
    }
  }

  // Synthetic deterministic PRJ-DOCMONSTAKRAKIN entity (ZERO credentials/secrets/tokens)
  const dmkProject: Project = {
    id: 'PRJ-DOCMONSTAKRAKIN',
    name: baseProjectData.name || 'docmonstakrakin',
    description:
      baseProjectData.description ||
      'Deterministic synthetic runtime fixture for CI validation',
    maturity: baseProjectData.maturity || 'EXISTING_PROJECT',
    owner: 'CI_SYNTHETIC',
    deliveryMethod: baseProjectData.deliveryMethod || 'ITERATIVE',
    targetRelease: 'v0.1.0-rc1',
    lifecyclePhase: baseProjectData.lifecyclePhase || 'IMPLEMENTATION',
    dataSensitivity: 'INTERNAL',
    deploymentIntent: 'Local-first web application',
    healthScore: 100,
    progress: {
      requirementsReadiness: 100,
      architectureReadiness: 100,
      implementation: 100,
      verification: 100,
      securityAssurance: 100,
      releaseReadiness: 100,
    },
    profiles: ['WEB_APPLICATION', 'BACKEND_API', 'AI_APPLICATION', 'AGENTIC_AI_APPLICATION'],
    specializedProfiles: ['DEVELOPER_TOOL', 'INTERNAL_TOOL', 'AI_ENGINEERING'],
    stateVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    repoPath: workspaceRoot,
    repoStatus: 'CLEAN',
  };

  // Remove any pre-existing entry and append PRJ-DOCMONSTAKRAKIN
  store.projects = store.projects.filter((p) => p.id !== 'PRJ-DOCMONSTAKRAKIN');
  store.projects.push(dmkProject);

  // Initialize every required ProjectStore collection for PRJ-DOCMONSTAKRAKIN
  store.questions['PRJ-DOCMONSTAKRAKIN'] = [];
  store.requirements['PRJ-DOCMONSTAKRAKIN'] = [];
  store.adrs['PRJ-DOCMONSTAKRAKIN'] = [];
  store.components['PRJ-DOCMONSTAKRAKIN'] = [];
  store.risks['PRJ-DOCMONSTAKRAKIN'] = [];
  store.threats['PRJ-DOCMONSTAKRAKIN'] = [];
  store.standards['PRJ-DOCMONSTAKRAKIN'] = [];
  store.workItems['PRJ-DOCMONSTAKRAKIN'] = [];
  store.evidence['PRJ-DOCMONSTAKRAKIN'] = [];
  store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = []; // Empty synthetic audit chain (valid under verifyAuditLedgerChain)
  store.overrides['PRJ-DOCMONSTAKRAKIN'] = [];
  store.approvals['PRJ-DOCMONSTAKRAKIN'] = [];
  store.agentRoles['PRJ-DOCMONSTAKRAKIN'] = [];
  store.agentRuns['PRJ-DOCMONSTAKRAKIN'] = [];
  store.features['PRJ-DOCMONSTAKRAKIN'] = [];
  store.derivations['PRJ-DOCMONSTAKRAKIN'] = [];
  store.documents['PRJ-DOCMONSTAKRAKIN'] = [];
  store.importSessions['PRJ-DOCMONSTAKRAKIN'] = [];

  // Verify that empty audit ledger passes verifyAuditLedgerChain
  const auditVerification = verifyAuditLedgerChain(
    store.auditLogs['PRJ-DOCMONSTAKRAKIN'],
    'REVERSE_CHRONOLOGICAL'
  );
  if (!auditVerification.valid) {
    throw new Error('AUDIT_CHAIN_INVALID: Empty synthetic audit chain failed verification');
  }

  // Create serializable snapshot using canonical persistence helper
  const snapshot = snapshotProjectStore(store);

  // Atomic write to project-state.json
  const tempFile = path.join(localDir, `project-state.json.tmp.${crypto.randomUUID()}`);
  const content = JSON.stringify(snapshot, null, 2) + '\n';
  fs.writeFileSync(tempFile, content, 'utf8');
  fs.renameSync(tempFile, projectStatePath);

  const snapshotSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(projectStatePath))
    .digest('hex')
    .toUpperCase();

  console.log('[prepareCiRuntime] Synthetic CI runtime initialized:');
  console.log(`  Path:           ${projectStatePath}`);
  console.log(`  stateVersion:   ${dmkProject.stateVersion}`);
  console.log(`  auditCount:     ${store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length}`);
  console.log(`  snapshot SHA:   ${snapshotSha256}`);
  console.log(`  transactions:   0 active`);

  return {
    snapshotPath: projectStatePath,
    stateVersion: dmkProject.stateVersion,
    auditCount: store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length,
    snapshotSha256,
  };
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename || '')) {
  try {
    prepareCiRuntime();
  } catch (err: unknown) {
    console.error('[prepareCiRuntime] Initialization failed:', err);
    process.exit(1);
  }
}
