/**
 * docmonstakrakin - Post-Execution Verifier Regression Suite (DMK-193)
 *
 * Tests all positive and negative verification paths for scripts/verifySelfBootstrapExecution.ts:
 *
 * A. Valid baseline + valid bootstrapped snapshot passes.
 * B. Missing current snapshot fails.
 * C. Missing target project fails.
 * D. Duplicate PRJ-DOCMONSTAKRAKIN fails.
 * E. Unrelated project mutation fails.
 * F. Unrelated audit-log mutation fails.
 * G. Self-project manifest collection mismatch fails.
 * H. Non-empty approvals fails.
 * I. Non-empty initialized governance/discovery collection fails where required.
 * J. Missing PROJECT_BOOTSTRAPPED audit event fails.
 * K. Duplicate bootstrap audit events fail.
 * L. Invalid audit chain fails.
 * M. Wrong manifest digest in bootstrap audit fails.
 * N. Current manifest digest differs from reviewed digest fails.
 * O. Additional unexpected project ID fails.
 * P. Verifier does not modify baseline or current snapshot bytes (SHA-256 before/after verification).
 * Q. Missing baseline snapshot fails.
 * R. Invalid snapshot schema version fails.
 * S. Target project already present in baseline fails.
 * T. Approved Gate 7 execution evidence is explicitly detected and fails.
 *
 * ZERO LEAKAGE:
 * All test cases execute against isolated temporary directories and never mutate
 * the workspace's real .local/project-state.json.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  verifySelfBootstrapExecution,
  CANONICAL_REVIEWED_MANIFEST_DIGEST,
  TARGET_PROJECT_ID,
  EXPECTED_ENTITY_COUNTS,
} from './verifySelfBootstrapExecution.ts';
import {
  executeSelfBootstrap,
} from '../server/bootstrap/selfBootstrapExecutor.ts';
import {
  PROJECT_STATE_SCHEMA_VERSION,
  type ProjectStateSnapshot,
} from '../server/projectPersistence.ts';
import {
  GENESIS_AUDIT_HASH,
  computeAuditEventHash,
} from '../server/security/auditImmutability.ts';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function computeFileSha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function buildRealisticBaselineStore() {
  return {
    projects: [
      {
        id: 'PRJ-ATLAS-01',
        name: 'Atlas Observability',
        description: 'Observability platform',
        maturity: 'PILOT',
        profiles: ['BACKEND_API'],
        specializedProfiles: [],
        assuranceInputs: {
          publicInternetExposure: false,
          pii: false,
          regulatedData: false,
          productionSecrets: false,
          destructiveOperations: false,
          autonomousAgentExecution: false,
          securitySensitivity: 'LOW',
          complianceProfile: [],
        },
        computedRisk: { score: 0, level: 'LOW', drivers: [] },
        deliveryMethod: 'ITERATIVE',
        deploymentIntent: 'Internal demo',
        dataSensitivity: 'PUBLIC',
        lifecyclePhase: 'DISCOVERY',
        stateVersion: 1,
        owner: 'Local Developer',
        targetRelease: 'v1.0',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
        repoPath: '',
        repoStatus: 'CLEAN',
        healthScore: 100,
        progress: {
          requirementsReadiness: 100,
          architectureReadiness: 100,
          implementation: 100,
          verification: 100,
          securityAssurance: 100,
          releaseReadiness: 100,
        },
      },
      {
        id: 'PRJ-FINPAY-02',
        name: 'FinPay Gateway',
        description: 'Payment gateway',
        maturity: 'BETA',
        profiles: ['BACKEND_API'],
        specializedProfiles: [],
        assuranceInputs: {
          publicInternetExposure: true,
          pii: true,
          regulatedData: true,
          productionSecrets: true,
          destructiveOperations: false,
          autonomousAgentExecution: false,
          securitySensitivity: 'HIGH',
          complianceProfile: ['PCI-DSS'],
        },
        computedRisk: { score: 40, level: 'HIGH', drivers: ['pii', 'regulatedData'] },
        deliveryMethod: 'FORMAL',
        deploymentIntent: 'Production cloud',
        dataSensitivity: 'CONFIDENTIAL',
        lifecyclePhase: 'ARCHITECTURE',
        stateVersion: 1,
        owner: 'Local Developer',
        targetRelease: 'v2.0',
        createdAt: '2026-09-02T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
        repoPath: '',
        repoStatus: 'CLEAN',
        healthScore: 80,
        progress: {
          requirementsReadiness: 80,
          architectureReadiness: 60,
          implementation: 0,
          verification: 0,
          securityAssurance: 70,
          releaseReadiness: 0,
        },
      },
    ],
    features: {
      'PRJ-ATLAS-01': [{ id: 'FEAT-ATLAS-01', title: 'Telemetry' }],
      'PRJ-FINPAY-02': [{ id: 'FEAT-FIN-01', title: 'Payment Processing' }],
    },
    requirements: {
      'PRJ-ATLAS-01': [{ id: 'REQ-ATLAS-01', title: 'Metric Ingestion' }],
      'PRJ-FINPAY-02': [{ id: 'REQ-FIN-01', title: 'Tokenization' }],
    },
    risks: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [{ id: 'RSK-FIN-01', title: 'Data Breach' }],
    },
    threats: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    standards: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    workItems: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    evidence: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    adrs: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    components: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    overrides: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    approvals: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    agentRoles: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    agentRuns: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    derivations: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    importSessions: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    questions: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    documents: {
      'PRJ-ATLAS-01': [],
      'PRJ-FINPAY-02': [],
    },
    auditLogs: {
      'PRJ-ATLAS-01': [
        {
          id: 'AUD-ATLAS-01',
          actor: 'Developer',
          timestamp: '2026-09-01T00:00:00Z',
          action: 'PROJECT_CREATED',
          target: 'PRJ-ATLAS-01',
          reason: 'Initial setup',
          previousHash: GENESIS_AUDIT_HASH,
          stateHash: '1111111111111111111111111111111111111111111111111111111111111111',
          details: {},
        },
      ],
      'PRJ-FINPAY-02': [
        {
          id: 'AUD-FINPAY-01',
          actor: 'Developer',
          timestamp: '2026-09-02T00:00:00Z',
          action: 'PROJECT_CREATED',
          target: 'PRJ-FINPAY-02',
          reason: 'Initial setup',
          previousHash: GENESIS_AUDIT_HASH,
          stateHash: '2222222222222222222222222222222222222222222222222222222222222222',
          details: {},
        },
      ],
    },
  };
}

function writeSnapshot(filePath: string, state: any, schemaVersion = PROJECT_STATE_SCHEMA_VERSION): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const snapshot: ProjectStateSnapshot = {
    schemaVersion,
    state,
  };
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
}

function setupBootstrapPair(): {
  tempDir: string;
  baselinePath: string;
  currentPath: string;
} {
  const tempDir = createTempDir('dmk-test-verify-');
  // Symlink docs and bootstrap into tempDir for zero-copy file resolution
  fs.symlinkSync(path.resolve(process.cwd(), 'docs'), path.join(tempDir, 'docs'), 'dir');
  fs.symlinkSync(path.resolve(process.cwd(), 'bootstrap'), path.join(tempDir, 'bootstrap'), 'dir');

  const baselinePath = path.join(tempDir, 'baseline-snapshot.json');
  const currentPath = path.join(tempDir, '.local', 'project-state.json');

  const baseStore = buildRealisticBaselineStore();
  writeSnapshot(baselinePath, baseStore);
  writeSnapshot(currentPath, baseStore);

  // Execute bootstrap into currentPath using the real manifest and executor
  process.env.DMK_SELF_BOOTSTRAP_EXECUTE = TARGET_PROJECT_ID;
  const execResult = executeSelfBootstrap({
    mode: 'EXECUTE',
    workspaceRoot: tempDir,
    manifestPath: path.resolve(process.cwd(), 'bootstrap/docmonstakrakin.self-bootstrap.json'),
    confirmProjectId: TARGET_PROJECT_ID,
    confirmManifestDigest: CANONICAL_REVIEWED_MANIFEST_DIGEST,
  });
  delete process.env.DMK_SELF_BOOTSTRAP_EXECUTE;

  assert.equal(execResult.status, 'EXECUTED', `Execution setup failed: ${execResult.errors?.join('; ')}`);
  assert(fs.existsSync(currentPath), 'Current snapshot must exist after execution');

  return { tempDir, baselinePath, currentPath };
}

let testCount = 0;
function pass(name: string): void {
  testCount++;
  console.log(`✓ [PASS] ${name}`);
}

async function runVerifierTests(): Promise<void> {
  console.log('================================================================');
  console.log('docmonstakrakin - POST-EXECUTION VERIFIER REGRESSION SUITE (DMK-193)');
  console.log('================================================================');

  // TEST A: Valid baseline + valid bootstrapped snapshot passes
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFIED');
    assert.equal(result.targetProject, TARGET_PROJECT_ID);
    assert.equal(result.baselineProjectCount, 2);
    assert.equal(result.currentProjectCount, 3);
    assert.deepEqual(result.newProjectIds, [TARGET_PROJECT_ID]);
    assert.equal(result.unrelatedStateEquivalent, true);
    assert.equal(result.manifestDigest, CANONICAL_REVIEWED_MANIFEST_DIGEST);
    assert.deepEqual(result.entityCounts, EXPECTED_ENTITY_COUNTS);
    assert.equal(result.emptyCollectionsVerified, true);
    assert.equal(result.bootstrapAuditEvents, 1);
    assert.equal(result.auditLedgerValid, true);
    assert.equal(result.approvalsInjected, 0);
    assert.equal(result.releaseSignoffInjected, false);
    assert.equal(result.gate7Executed, false);
    assert.equal(result.mutationCount, 0);
    assert.equal(result.errors.length, 0);

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test A: Valid baseline + valid bootstrapped snapshot passes');
  }

  // TEST B: Missing current snapshot fails
  {
    const { tempDir, baselinePath } = setupBootstrapPair();
    const nonExistent = path.join(tempDir, 'does-not-exist.json');
    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: nonExistent,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('does not exist')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test B: Missing current snapshot fails');
  }

  // TEST C: Missing target project fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    // Overwrite current snapshot with baseline (no PRJ-DOCMONSTAKRAKIN)
    const baseRaw = fs.readFileSync(baselinePath, 'utf8');
    fs.writeFileSync(currentPath, baseRaw);

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('does not contain target project')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test C: Missing target project fails');
  }

  // TEST D: Duplicate PRJ-DOCMONSTAKRAKIN fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    const targetProject = currentData.state.projects.find((p: any) => p.id === TARGET_PROJECT_ID);
    currentData.state.projects.push({ ...targetProject });
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('duplicate entries')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test D: Duplicate PRJ-DOCMONSTAKRAKIN fails');
  }

  // TEST E: Unrelated project mutation fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    // Mutate an unrelated project's requirement
    currentData.state.requirements['PRJ-ATLAS-01'][0].title = 'Tampered Requirement';
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert.equal(result.unrelatedStateEquivalent, false);
    assert(result.errors.some(e => e.includes('Unrelated project state was mutated') || e.includes('modified')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test E: Unrelated project mutation fails');
  }

  // TEST F: Unrelated audit-log mutation fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    // Mutate unrelated audit log
    currentData.state.auditLogs['PRJ-ATLAS-01'][0].reason = 'Tampered audit';
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert.equal(result.unrelatedStateEquivalent, false);
    assert(result.errors.some(e => e.includes('auditLogs')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test F: Unrelated audit-log mutation fails');
  }

  // TEST G: Self-project manifest collection mismatch fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    // Remove a requirement from target project
    currentData.state.requirements[TARGET_PROJECT_ID].pop();
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes("Entity count mismatch for 'requirements'")));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test G: Self-project manifest collection mismatch fails');
  }

  // TEST H: Non-empty approvals fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    currentData.state.approvals[TARGET_PROJECT_ID] = [
      { id: 'FORGED-APP-01', targetEntityType: 'PROJECT', status: 'APPROVED' },
    ];
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('Governance violation: target project has')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test H: Non-empty approvals fails');
  }

  // TEST I: Non-empty initialized governance/discovery collection fails where required
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    currentData.state.questions[TARGET_PROJECT_ID] = [
      { id: 'Q-FAKE-01', question: 'Injected question' },
    ];
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert.equal(result.emptyCollectionsVerified, false);
    assert(result.errors.some(e => e.includes("Collection 'questions'")));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test I: Non-empty initialized collection fails');
  }

  // TEST J: Missing PROJECT_BOOTSTRAPPED audit event fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    currentData.state.auditLogs[TARGET_PROJECT_ID] = [];
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('Audit ledger count mismatch')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test J: Missing PROJECT_BOOTSTRAPPED audit event fails');
  }

  // TEST K: Duplicate bootstrap audit events fail
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    currentData.state.auditLogs[TARGET_PROJECT_ID].push({
      ...currentData.state.auditLogs[TARGET_PROJECT_ID][0],
      id: 'AUD-DUP-01',
    });
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('Audit ledger count mismatch')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test K: Duplicate bootstrap audit events fail');
  }

  // TEST L: Invalid audit chain fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    // Corrupt audit event stateHash
    currentData.state.auditLogs[TARGET_PROJECT_ID][0].stateHash = 'bad-hash';
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('stateHash is invalid')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test L: Invalid audit chain fails');
  }

  // TEST M: Wrong manifest digest in bootstrap audit fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    const auditEvent = currentData.state.auditLogs[TARGET_PROJECT_ID][0];
    auditEvent.details.manifestDigest = '0'.repeat(64);
    // Recompute hash so stateHash is valid but digest is wrong
    auditEvent.stateHash = computeAuditEventHash({
      actor: auditEvent.actor,
      timestamp: auditEvent.timestamp,
      action: auditEvent.action,
      target: auditEvent.target,
      reason: auditEvent.reason,
      details: auditEvent.details,
      previousHash: auditEvent.previousHash,
    });
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('details.manifestDigest mismatch')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test M: Wrong manifest digest in bootstrap audit fails');
  }

  // TEST N: Current manifest digest differs from reviewed digest fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    // Point verifier to a dummy modified manifest
    const badManifestPath = path.join(tempDir, 'tampered-manifest.json');
    const realManifest = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'bootstrap/docmonstakrakin.self-bootstrap.json'), 'utf8')
    );
    realManifest.provenance.baselineCommit = '0'.repeat(40); // mutate
    fs.writeFileSync(badManifestPath, JSON.stringify(realManifest));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
      manifestPath: badManifestPath,
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('Manifest digest mismatch')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test N: Current manifest digest differs from reviewed digest fails');
  }

  // TEST O: Additional unexpected project ID fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    currentData.state.projects.push({
      id: 'PRJ-SURPRISE-99',
      name: 'Surprise Project',
    });
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('PRJ-SURPRISE-99') || e.includes('Expected exactly one new project ID')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test O: Additional unexpected project ID fails');
  }

  // TEST P: Verifier does not modify baseline or current snapshot bytes (SHA-256 before/after verification)
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const baselineShaBefore = computeFileSha256(baselinePath);
    const currentShaBefore = computeFileSha256(currentPath);

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFIED');
    assert.equal(result.mutationCount, 0);

    const baselineShaAfter = computeFileSha256(baselinePath);
    const currentShaAfter = computeFileSha256(currentPath);

    assert.equal(baselineShaBefore, baselineShaAfter, 'Baseline snapshot was modified during verification!');
    assert.equal(currentShaBefore, currentShaAfter, 'Current snapshot was modified during verification!');

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test P: Verifier does not modify snapshot bytes (SHA-256 byte-identity preserved)');
  }

  // TEST Q: Missing baseline snapshot fails
  {
    const { tempDir, currentPath } = setupBootstrapPair();
    const missingBaseline = path.join(tempDir, 'missing-base.json');

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: missingBaseline,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('Failed to load baseline snapshot')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test Q: Missing baseline snapshot fails');
  }

  // TEST R: Invalid snapshot schema version fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    currentData.schemaVersion = 999;
    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('Unsupported snapshot schemaVersion')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test R: Invalid snapshot schema version fails');
  }

  // TEST S: Target project already present in baseline fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const baseData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    baseData.state.projects.push({ id: TARGET_PROJECT_ID, name: 'Already here' });
    fs.writeFileSync(baselinePath, JSON.stringify(baseData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert(result.errors.some(e => e.includes('Baseline snapshot already contains target project')));

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test S: Target project already present in baseline fails');
  }

  console.log('================================================================');
  console.log(`TOTAL TESTS: ${testCount} | ALL POST-EXECUTION VERIFIER TESTS PASSED`);
    // TEST T: Approved Gate 7 execution evidence is explicitly detected and fails
  {
    const { tempDir, baselinePath, currentPath } = setupBootstrapPair();
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

    currentData.state.approvals[TARGET_PROJECT_ID] = [
      {
        id: 'APP-GATE-7-TEST',
        type: 'GATE_TRANSITION',
        targetEntityType: 'GATE',
        targetEntityId: 'GATE-7',
        title: 'Gate 7 Human Release Approval',
        status: 'APPROVED',
      },
    ];

    fs.writeFileSync(currentPath, JSON.stringify(currentData));

    const result = verifySelfBootstrapExecution({
      baselineSnapshotPath: baselinePath,
      currentSnapshotPath: currentPath,
      workspaceRoot: process.cwd(),
    });

    assert.equal(result.status, 'BOOTSTRAP_VERIFICATION_FAILED');
    assert.equal(result.gate7Executed, true);
    assert.equal(result.approvalsInjected, 1);
    assert(
      result.errors.some(e =>
        e.includes('approved Gate 7 execution evidence')
      )
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
    pass('Test T: Approved Gate 7 execution evidence is explicitly detected and fails');
  }
  console.log('================================================================');
}

runVerifierTests().catch(err => {
  console.error('FATAL TEST RUNNER ERROR:', err);
  process.exit(1);
});
