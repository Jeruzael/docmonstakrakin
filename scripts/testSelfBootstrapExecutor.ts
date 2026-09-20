import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  executeSelfBootstrap,
  type SelfBootstrapReport,
} from '../server/bootstrap/selfBootstrapExecutor.ts';
import {
  readProjectSnapshot,
  writeProjectSnapshotAtomic,
  resolveProjectStatePath,
  PROJECT_STATE_SCHEMA_VERSION,
  type ProjectStateSnapshot,
} from '../server/projectPersistence.ts';
import { ProjectStore } from '../server/projectStore.ts';
import type { SelfBootstrapManifest } from '../src/data/selfBootstrapContract.ts';

const realWorkspaceRoot = process.cwd();
const realManifestPath = path.resolve(realWorkspaceRoot, 'bootstrap/docmonstakrakin.self-bootstrap.json');
const realManifest: SelfBootstrapManifest = JSON.parse(fs.readFileSync(realManifestPath, 'utf-8'));

function createTestWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-exec-test-'));
  // Mirror minimal directory structure needed by manifest references
  fs.mkdirSync(path.join(dir, 'bootstrap'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', '07_verification', 'rc-regression'), { recursive: true });
  fs.copyFileSync(realManifestPath, path.join(dir, 'bootstrap', 'docmonstakrakin.self-bootstrap.json'));

  // Copy controlled documents referenced by manifest
  for (const doc of realManifest.documents) {
    const srcDocPath = path.resolve(realWorkspaceRoot, doc.path);
    const destDocPath = path.resolve(dir, doc.path);
    fs.mkdirSync(path.dirname(destDocPath), { recursive: true });
    if (fs.existsSync(srcDocPath)) {
      fs.copyFileSync(srcDocPath, destDocPath);
    } else {
      fs.writeFileSync(destDocPath, 'dummy controlled document\n', 'utf-8');
    }
  }

  // Copy evidence artifacts referenced by manifest
  const evidenceMap: Record<string, string> = {
    'EV-RC-187': 'docs/07_verification/cryptodemon-fixture-evidence.json',
    'EV-RC-188': 'docs/07_verification/CRYPTODEMON_REMEDIATION_REPORT.md',
    'EV-RC-189': 'docs/07_verification/rc-regression/results.json',
    'EV-RC-190': 'docs/07_verification/PROPOSAL_SCHEMA_1_1_REPORT.md',
  };
  for (const relPath of Object.values(evidenceMap)) {
    const srcEvPath = path.resolve(realWorkspaceRoot, relPath);
    const destEvPath = path.resolve(dir, relPath);
    fs.mkdirSync(path.dirname(destEvPath), { recursive: true });
    if (fs.existsSync(srcEvPath)) {
      fs.copyFileSync(srcEvPath, destEvPath);
    }
  }

  return dir;
}

function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function sha256File(filePath: string): string {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

let passedCount = 0;
function pass(testName: string) {
  passedCount++;
  console.log(`✓ [PASS] ${testName}`);
}

console.log('================================================================');
console.log('docmonstakrakin - SELF-BOOTSTRAP EXECUTOR REGRESSION SUITE (DMK-192)');
console.log('================================================================');

// Test A: Dry-run with no .local snapshot
{
  const tempDir = createTestWorkspace();
  try {
    const snapshotPath = resolveProjectStatePath(tempDir);
    assert.equal(fs.existsSync(snapshotPath), false, 'Snapshot must not exist before test');
    assert.equal(fs.existsSync(path.dirname(snapshotPath)), false, '.local must not exist before test');

    const report = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'DRY_RUN',
    });

    assert.equal(report.status, 'SAFE_TO_REVIEW');
    assert.equal(report.mode, 'DRY_RUN');
    assert.equal(report.mutationCount, 0);
    assert.equal(report.snapshot.existedBefore, false);
    assert.equal(report.preservation.preservedProjectCount, 2);
    assert.equal(report.preservation.preservedProjectIds.includes('PRJ-ATLAS-01'), true);
    assert.equal(report.preservation.preservedProjectIds.includes('PRJ-FINPAY-02'), true);
    assert.equal(report.preservation.unrelatedStateEquivalent, true);
    assert.equal(report.candidate.projectCountAfterBootstrap, 3);
    assert.equal(report.plannedAudit.action, 'PROJECT_BOOTSTRAPPED');
    assert.equal(report.plannedAudit.persisted, false);
    assert.equal(report.auditLedgerValid, true);
    assert.equal(report.filesystem.snapshotWritten, false);
    assert.equal(report.filesystem.tempFilesCreated, 0);

    // Verify disk was NOT modified
    assert.equal(fs.existsSync(path.join(tempDir, '.local')), false, '.local must not be created during dry-run');
    assert.equal(fs.existsSync(snapshotPath), false, 'Snapshot file must not be created during dry-run');

    pass('Test A: Dry-run with no .local snapshot preserves built-in baseline with 0 mutations');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test B: Dry-run with existing unrelated snapshot
{
  const tempDir = createTestWorkspace();
  try {
    const unrelatedSnapshot: ProjectStateSnapshot = {
      schemaVersion: 1,
      state: {
        projects: [
          {
            id: 'PRJ-UNRELATED-99',
            name: 'Unrelated Existing System',
            owner: 'ops-lead',
            description: 'Existing pre-bootstrap project',
            maturity: 'BROWNFIELD',
            profiles: ['INTERNAL_SERVICE'],
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
            progress: { requirementsReadiness: 100 },
          },
        ],
        questions: { 'PRJ-UNRELATED-99': [] },
        requirements: { 'PRJ-UNRELATED-99': [] },
        risks: { 'PRJ-UNRELATED-99': [] },
        threats: { 'PRJ-UNRELATED-99': [] },
        standards: { 'PRJ-UNRELATED-99': [] },
        workItems: { 'PRJ-UNRELATED-99': [] },
        evidence: { 'PRJ-UNRELATED-99': [] },
        adrs: { 'PRJ-UNRELATED-99': [] },
        components: { 'PRJ-UNRELATED-99': [] },
        overrides: { 'PRJ-UNRELATED-99': [] },
        approvals: { 'PRJ-UNRELATED-99': [] },
        agentRoles: { 'PRJ-UNRELATED-99': [] },
        agentRuns: { 'PRJ-UNRELATED-99': [] },
        features: { 'PRJ-UNRELATED-99': [] },
        derivations: { 'PRJ-UNRELATED-99': [] },
        importSessions: { 'PRJ-UNRELATED-99': [] },
        documents: { 'PRJ-UNRELATED-99': [] },
        auditLogs: { 'PRJ-UNRELATED-99': [] },
      },
    };
    writeProjectSnapshotAtomic(unrelatedSnapshot, tempDir);
    const snapshotPath = resolveProjectStatePath(tempDir);
    const hashBefore = sha256File(snapshotPath);

    const report = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'DRY_RUN',
    });

    assert.equal(report.status, 'SAFE_TO_REVIEW');
    assert.equal(report.snapshot.existedBefore, true);
    assert.equal(report.preservation.unrelatedStateEquivalent, true);
    assert.equal(report.preservation.preservedProjectIds.includes('PRJ-UNRELATED-99'), true);
    assert.equal(report.mutationCount, 0);

    const hashAfter = sha256File(snapshotPath);
    assert.equal(hashBefore, hashAfter, 'Snapshot byte hash must remain identical after dry-run');

    pass('Test B: Dry-run with existing unrelated snapshot preserves state and leaves snapshot byte-identical');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test C: CREATE_ONLY conflict check
{
  const tempDir = createTestWorkspace();
  try {
    const conflictSnapshot: ProjectStateSnapshot = {
      schemaVersion: 1,
      state: {
        projects: [
          {
            id: 'PRJ-DOCMONSTAKRAKIN',
            name: 'docmonstakrakin Pre-Existing',
            owner: 'lead',
            description: 'Already exists',
            maturity: 'GREENFIELD',
            profiles: ['DEVELOPER_TOOL'],
            assuranceInputs: {
              publicInternetExposure: false,
              pii: false,
              regulatedData: false,
              productionSecrets: false,
              destructiveOperations: false,
              autonomousAgentExecution: false,
              securitySensitivity: 'HIGH',
              complianceProfile: [],
            },
            progress: { requirementsReadiness: 100 },
          },
        ],
        questions: { 'PRJ-DOCMONSTAKRAKIN': [] },
        requirements: { 'PRJ-DOCMONSTAKRAKIN': [] },
        risks: { 'PRJ-DOCMONSTAKRAKIN': [] },
        threats: { 'PRJ-DOCMONSTAKRAKIN': [] },
        standards: { 'PRJ-DOCMONSTAKRAKIN': [] },
        workItems: { 'PRJ-DOCMONSTAKRAKIN': [] },
        evidence: { 'PRJ-DOCMONSTAKRAKIN': [] },
        adrs: { 'PRJ-DOCMONSTAKRAKIN': [] },
        components: { 'PRJ-DOCMONSTAKRAKIN': [] },
        overrides: { 'PRJ-DOCMONSTAKRAKIN': [] },
        approvals: { 'PRJ-DOCMONSTAKRAKIN': [] },
        agentRoles: { 'PRJ-DOCMONSTAKRAKIN': [] },
        agentRuns: { 'PRJ-DOCMONSTAKRAKIN': [] },
        features: { 'PRJ-DOCMONSTAKRAKIN': [] },
        derivations: { 'PRJ-DOCMONSTAKRAKIN': [] },
        importSessions: { 'PRJ-DOCMONSTAKRAKIN': [] },
        documents: { 'PRJ-DOCMONSTAKRAKIN': [] },
        auditLogs: { 'PRJ-DOCMONSTAKRAKIN': [] },
      },
    };
    writeProjectSnapshotAtomic(conflictSnapshot, tempDir);
    const snapshotPath = resolveProjectStatePath(tempDir);
    const hashBefore = sha256File(snapshotPath);

    const report = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'DRY_RUN',
    });

    assert.equal(report.status, 'PROJECT_ALREADY_EXISTS');
    assert.equal(report.errors.some(e => e.includes('already exists')), true);
    assert.equal(report.mutationCount, 0);

    const hashAfter = sha256File(snapshotPath);
    assert.equal(hashBefore, hashAfter, 'Snapshot byte hash must remain untouched on conflict');

    pass('Test C: CREATE_ONLY conflict check rejects pre-existing PRJ-DOCMONSTAKRAKIN with zero mutations');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test D: Invalid manifest fails closed
{
  const tempDir = createTestWorkspace();
  try {
    const invalidManifest = { ...realManifest, schemaVersion: 'INVALID_VERSION_99' };
    const manifestPath = path.join(tempDir, 'bootstrap', 'docmonstakrakin.self-bootstrap.json');
    fs.writeFileSync(manifestPath, JSON.stringify(invalidManifest, null, 2), 'utf-8');

    const report = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'DRY_RUN',
    });

    assert.equal(report.status, 'INVALID_MANIFEST');
    assert.equal(report.errors.length > 0, true);
    assert.equal(report.mutationCount, 0);
    assert.equal(fs.existsSync(path.join(tempDir, '.local')), false);

    pass('Test D: Invalid manifest fails closed before candidate persistence');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test E: Controlled-document / Evidence digest failure fails closed
{
  const tempDir = createTestWorkspace();
  try {
    // Tamper with one controlled document
    const targetDoc = realManifest.documents[0];
    const tamperedDocPath = path.resolve(tempDir, targetDoc.path);
    fs.appendFileSync(tamperedDocPath, '\n# TAMPERED UNVERIFIED CONTENT\n', 'utf-8');

    const report = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'DRY_RUN',
    });

    assert.equal(report.status, 'INVALID_MANIFEST');
    assert.equal(report.errors.some(e => e.includes('digest mismatch') || e.includes('mismatch')), true);
    assert.equal(report.mutationCount, 0);

    pass('Test E: Document/evidence byte digest mismatch fails closed with zero mutations');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test F: Execution in TEMP WORKSPACE ONLY
{
  const tempDir = createTestWorkspace();
  try {
    const report = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'EXECUTE',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      authEnvValue: 'PRJ-DOCMONSTAKRAKIN',
      clock: () => '2026-09-19T21:00:00.000Z',
      generateAuditId: () => 'AUD-BOOT-TEST-FIXED-001',
    });

    assert.equal(report.status, 'EXECUTED');
    assert.equal(report.mode, 'EXECUTE');
    assert.equal(report.mutationCount, 1);
    assert.equal(report.filesystem.snapshotWritten, true);

    const snapshotPath = resolveProjectStatePath(tempDir);
    assert.equal(fs.existsSync(snapshotPath), true, 'Snapshot must be written to disk in execute mode');

    // Load and verify snapshot
    const saved = readProjectSnapshot(tempDir);
    assert.notEqual(saved, null);
    assert.equal(saved!.schemaVersion, 1);
    assert.equal(saved!.state.projects.some((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN'), true);
    assert.equal(saved!.state.projects.some((p: any) => p.id === 'PRJ-ATLAS-01'), true);

    // Check entity counts in persisted snapshot
    const targetId = 'PRJ-DOCMONSTAKRAKIN';
    assert.equal(saved!.state.features[targetId].length, realManifest.features.length);
    assert.equal(saved!.state.requirements[targetId].length, realManifest.requirements.length);
    assert.equal(saved!.state.risks[targetId].length, realManifest.risks.length);
    assert.equal(saved!.state.threats[targetId].length, realManifest.threats.length);
    assert.equal(saved!.state.adrs[targetId].length, realManifest.adrs.length);
    assert.equal(saved!.state.components[targetId].length, realManifest.components.length);
    assert.equal(saved!.state.workItems[targetId].length, realManifest.workItems.length);
    assert.equal(saved!.state.evidence[targetId].length, realManifest.evidence.length);
    assert.equal(saved!.state.documents[targetId].length, realManifest.documents.length);

    // Check empty initialized collections
    assert.deepEqual(saved!.state.questions[targetId], []);
    assert.deepEqual(saved!.state.standards[targetId], []);
    assert.deepEqual(saved!.state.overrides[targetId], []);
    assert.deepEqual(saved!.state.approvals[targetId], []);
    assert.deepEqual(saved!.state.agentRoles[targetId], []);
    assert.deepEqual(saved!.state.agentRuns[targetId], []);
    assert.deepEqual(saved!.state.derivations[targetId], []);
    assert.deepEqual(saved!.state.importSessions[targetId], []);

    // Check audit log
    assert.equal(saved!.state.auditLogs[targetId].length, 1);
    const auditEvent = saved!.state.auditLogs[targetId][0];
    assert.equal(auditEvent.action, 'PROJECT_BOOTSTRAPPED');
    assert.equal(auditEvent.target, 'PRJ-DOCMONSTAKRAKIN');
    assert.equal(auditEvent.actor, 'docmonstakrakin-bootstrap-cli');
    assert.equal(auditEvent.previousHash, '0'.repeat(64));

    pass('Test F: Execution in temporary workspace creates verified atomic canonical snapshot');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test G: Second execute in same temp workspace fails with PROJECT_ALREADY_EXISTS
{
  const tempDir = createTestWorkspace();
  try {
    const firstReport = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'EXECUTE',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      authEnvValue: 'PRJ-DOCMONSTAKRAKIN',
    });
    assert.equal(firstReport.status, 'EXECUTED');

    const snapshotPath = resolveProjectStatePath(tempDir);
    const hashAfterFirst = sha256File(snapshotPath);

    // Second execution attempt
    const secondReport = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'EXECUTE',
      confirmProjectId: 'PRJ-DOCMONSTAKRAKIN',
      authEnvValue: 'PRJ-DOCMONSTAKRAKIN',
    });

    assert.equal(secondReport.status, 'PROJECT_ALREADY_EXISTS');
    assert.equal(secondReport.mutationCount, 0);

    const hashAfterSecond = sha256File(snapshotPath);
    assert.equal(hashAfterFirst, hashAfterSecond, 'Snapshot must remain untouched on second execution');

    pass('Test G: Second execute in same workspace fails closed with PROJECT_ALREADY_EXISTS and 0 mutations');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test H: Authorization guard failure rejects execution
{
  const tempDir = createTestWorkspace();
  try {
    // Missing confirmProjectId and env var
    const report1 = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'EXECUTE',
    });
    assert.equal(report1.status, 'UNAUTHORIZED_EXECUTION');
    assert.equal(report1.mutationCount, 0);
    assert.equal(fs.existsSync(path.join(tempDir, '.local')), false);

    // Wrong project ID in confirm
    const report2 = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'EXECUTE',
      confirmProjectId: 'PRJ-WRONG-ID',
      authEnvValue: 'PRJ-DOCMONSTAKRAKIN',
    });
    assert.equal(report2.status, 'UNAUTHORIZED_EXECUTION');
    assert.equal(report2.mutationCount, 0);

    pass('Test H: Execution authorization guard strictly blocks unconfirmed or unauthorized execution');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test I: Atomic persistence failure cleanup
{
  const tempDir = createTestWorkspace();
  try {
    const localDir = path.join(tempDir, '.local');
    fs.mkdirSync(localDir, { recursive: true });

    // Intentionally write an invalid snapshot structure to writeProjectSnapshotAtomic
    let threw = false;
    try {
      writeProjectSnapshotAtomic({ schemaVersion: 999, state: {} } as any, tempDir);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, 'Atomic writer must reject invalid snapshot');

    // Confirm no stray temp files remain in .local
    const files = fs.readdirSync(localDir);
    const tempFiles = files.filter(f => f.includes('.tmp'));
    assert.equal(tempFiles.length, 0, 'No temporary files must linger in .local after error');

    pass('Test I: Atomic persistence failure leaves no temporary artifacts');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test J: Candidate preservation check detects deliberate unrelated mutation
{
  const tempDir = createTestWorkspace();
  try {
    const report = executeSelfBootstrap({
      workspaceRoot: tempDir,
      mode: 'DRY_RUN',
      simulateUnrelatedMutation: true,
    });

    assert.equal(report.status, 'PRESERVATION_CHECK_FAILED');
    assert.equal(report.mutationCount, 0);

    pass('Test J: Preservation check detects unrelated mutation and fails closed');
  } finally {
    cleanupDir(tempDir);
  }
}

// Test K: Dry-run never writes the existing manifest validation report
{
  const tempDir = createTestWorkspace();
  try {
    const reportRelPath = 'docs/07_verification/self-bootstrap-manifest-validation.json';
    const reportAbsPath = path.resolve(realWorkspaceRoot, reportRelPath);
    let originalReportHash = '';
    if (fs.existsSync(reportAbsPath)) {
      originalReportHash = sha256File(reportAbsPath);
    }

    const dryRunReport = executeSelfBootstrap({
      workspaceRoot: realWorkspaceRoot,
      mode: 'DRY_RUN',
    });
    assert.equal(dryRunReport.status, 'SAFE_TO_REVIEW');

    if (fs.existsSync(reportAbsPath)) {
      const currentReportHash = sha256File(reportAbsPath);
      assert.equal(
        originalReportHash,
        currentReportHash,
        'docs/07_verification/self-bootstrap-manifest-validation.json must NOT be modified by dry-run'
      );
    }

    pass('Test K: Dry-run execution uses pure integrity check and never touches validation report file');
  } finally {
    cleanupDir(tempDir);
  }
}

console.log('================================================================');
console.log(`TOTAL TESTS: ${passedCount} | ALL TESTS PASSED SUCCESSFULLY`);
console.log('================================================================');
