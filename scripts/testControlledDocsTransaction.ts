import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert';
import type { ControlledDocumentRecord } from '../src/types.ts';
import {
  prepareDocumentTransaction,
  isDocumentLocked,
  resetDocumentLocksForTesting,
  type DocumentTransactionCoordinator,
  type DocumentTransactionJournal,
} from '../server/docs/controlledDocsTransaction.ts';
import {
  readDocumentDisk,
  encodeDocumentBytes,
} from '../server/docs/controlledDocsPersistence.ts';

// Test workspace helper
function createTestWorkspace(): {
  workspaceDir: string;
  docsDir: string;
  docRelPath: string;
  targetDiskPath: string;
  record: ControlledDocumentRecord;
  initialContent: string;
  initialSha256: string;
  cleanup: () => void;
} {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-tx-test-'));
  const docsDir = path.join(workspaceDir, 'docs', '00_control');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, '.local', 'document-transactions'), { recursive: true });

  const docRelPath = 'docs/00_control/PROJECT_STATE.md';
  const targetDiskPath = path.join(workspaceDir, docRelPath);
  const initialContent = '# docmonstakrakin current project state\n\n## Governance\nCurrent governance and task status: nominal.\nDMK-201: VERIFICATION_PENDING\nGate 7: HUMAN_APPROVAL_REQUIRED\nLive reconciliation active.\nRelease status: RC1.\n';
  fs.writeFileSync(targetDiskPath, initialContent, 'utf8');

  const initialBytes = Buffer.from(initialContent, 'utf8');
  const initialSha256 = crypto.createHash('sha256').update(initialBytes).digest('hex');

  const record: ControlledDocumentRecord = {
    id: 'DOC-CTRL-002',
    title: 'Project State',
    path: docRelPath,
    kind: 'CONTROL',
    authority: 'REFERENCE',
    editability: 'CONTROLLED_EDIT',
    fileType: 'MARKDOWN',
    description: 'Current project state',
    sha256Digest: initialSha256,
    editableLivingDoc: true,
  };

  return {
    workspaceDir,
    docsDir,
    docRelPath,
    targetDiskPath,
    record,
    initialContent,
    initialSha256,
    cleanup: () => {
      try {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    },
  };
}

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  resetDocumentLocksForTesting();
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error('Sync test expected: ' + name);
    }
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    failed++;
  } finally {
    resetDocumentLocksForTesting();
  }
}

console.log('================================================================');
console.log('   CONTROLLED DOCS TRANSACTION PRIMITIVES TEST SUITE (DMK-195)  ');
console.log('================================================================\n');

// Test A: Successful PREPARED transaction
runTest('Test A: Successful PREPARED transaction', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + '\nUpdated note.\n';
    const coordinator = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: 'mock-digest-123',
      stateVersionBefore: 31,
      auditEventId: 'EVT-TEST-001',
      workspaceRoot: ws.workspaceDir,
    });

    assert(coordinator.operationId, 'Coordinator has operationId');
    assert(fs.existsSync(coordinator.rollbackPath), 'Rollback artifact exists on disk');
    assert(fs.existsSync(coordinator.candidatePath), 'Candidate artifact exists on disk');
    assert(fs.existsSync(coordinator.journalPath), 'Journal file exists on disk');
    assert.strictEqual(typeof coordinator.executeReplacement, 'function');
    assert.strictEqual(typeof coordinator.handleCommitSuccess, 'function');
    assert.strictEqual(typeof coordinator.handleRollback, 'function');
  } finally {
    ws.cleanup();
  }
});

// Test B: Journal contains every required field
runTest('Test B: Journal contains every required field', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + '\nUpdated note.\n';
    const coordinator = prepareDocumentTransaction({
      projectId: 'PRJ-DOCMONSTAKRAKIN',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: 'digest-abc',
      stateVersionBefore: 10,
      auditEventId: 'EVT-AUDIT-999',
      workspaceRoot: ws.workspaceDir,
    });

    const rawJournal = fs.readFileSync(coordinator.journalPath, 'utf8');
    const journal: DocumentTransactionJournal = JSON.parse(rawJournal);

    assert.strictEqual(journal.operationId, coordinator.operationId);
    assert.strictEqual(journal.projectId, 'PRJ-DOCMONSTAKRAKIN');
    assert.strictEqual(journal.documentId, 'DOC-CTRL-002');
    assert.strictEqual(journal.targetPath, 'docs/00_control/PROJECT_STATE.md');
    assert.strictEqual(
      journal.candidateArtifactPath,
      `docs/00_control/.PROJECT_STATE.md.dmk-${coordinator.operationId}.candidate`
    );
    assert.strictEqual(
      journal.rollbackArtifactPath,
      `docs/00_control/.PROJECT_STATE.md.dmk-${coordinator.operationId}.rollback`
    );
    assert.strictEqual(journal.previousSha256, ws.initialSha256);

    const expectedCandidateBytes = encodeDocumentBytes(candidateContent, 'LF');
    const expectedCandidateSha256 = crypto.createHash('sha256').update(expectedCandidateBytes).digest('hex');
    assert.strictEqual(journal.candidateSha256, expectedCandidateSha256);

    assert.strictEqual(journal.projectStateBeforeDigest, 'digest-abc');
    assert.strictEqual(journal.stateVersionBefore, 10);
    assert.strictEqual(journal.stateVersionExpectedAfter, 11);
    assert.strictEqual(journal.auditEventId, 'EVT-AUDIT-999');
    assert.strictEqual(journal.phase, 'PREPARED');
    assert(journal.createdAt && !isNaN(Date.parse(journal.createdAt)), 'Valid createdAt ISO string');
    assert(journal.updatedAt && !isNaN(Date.parse(journal.updatedAt)), 'Valid updatedAt ISO string');
  } finally {
    ws.cleanup();
  }
});

// Test C: Target unchanged after prepare
runTest('Test C: Target unchanged after prepare', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + '\nCandidate edit.\n';
    prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const targetBytes = fs.readFileSync(ws.targetDiskPath);
    const targetSha256 = crypto.createHash('sha256').update(targetBytes).digest('hex');
    assert.strictEqual(targetBytes.toString('utf8'), ws.initialContent);
    assert.strictEqual(targetSha256, ws.initialSha256);
  } finally {
    ws.cleanup();
  }
});

// Test D: Exact rollback bytes
runTest('Test D: Exact rollback bytes', () => {
  const ws = createTestWorkspace();
  try {
    const coordinator = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'new content',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const rollbackBytes = fs.readFileSync(coordinator.rollbackPath);
    const initialBytes = fs.readFileSync(ws.targetDiskPath);
    assert.strictEqual(Buffer.compare(rollbackBytes, initialBytes), 0);
  } finally {
    ws.cleanup();
  }
});

// Test E: Exact candidate bytes
runTest('Test E: Exact candidate bytes', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + 'New Line.\n';
    const coordinator = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const candidateBytesOnDisk = fs.readFileSync(coordinator.candidatePath);
    const expectedBytes = encodeDocumentBytes(candidateContent, 'LF');
    assert.strictEqual(Buffer.compare(candidateBytesOnDisk, expectedBytes), 0);
  } finally {
    ws.cleanup();
  }
});

// Test F: Candidate hash matches encoded bytes
runTest('Test F: Candidate hash matches encoded bytes', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + 'Line 2.\n';
    const coordinator = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const journal: DocumentTransactionJournal = JSON.parse(
      fs.readFileSync(coordinator.journalPath, 'utf8')
    );
    const candidateBytes = fs.readFileSync(coordinator.candidatePath);
    const actualCandidateSha = crypto.createHash('sha256').update(candidateBytes).digest('hex');
    assert.strictEqual(journal.candidateSha256, actualCandidateSha);
  } finally {
    ws.cleanup();
  }
});

// Test G: Stale base rejection with zero artifacts
runTest('Test G: Stale base rejection with zero artifacts', () => {
  const ws = createTestWorkspace();
  try {
    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new content',
          baseSha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('DOCUMENT_STALE')
    );

    // Verify zero sibling or journal artifacts
    const docsFiles = fs.readdirSync(ws.docsDir);
    assert.strictEqual(docsFiles.length, 1);
    assert.strictEqual(docsFiles[0], 'PROJECT_STATE.md');

    const journalDir = path.join(ws.workspaceDir, '.local', 'document-transactions');
    const journalFiles = fs.existsSync(journalDir) ? fs.readdirSync(journalDir) : [];
    assert.strictEqual(journalFiles.length, 0);

    // Verify lock released
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test H: Missing document rejection
runTest('Test H: Missing document rejection', () => {
  const ws = createTestWorkspace();
  try {
    fs.unlinkSync(ws.targetDiskPath);
    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new content',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('DOCUMENT_MISSING')
    );
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test I: READ_ONLY record rejection
runTest('Test I: READ_ONLY record rejection', () => {
  const ws = createTestWorkspace();
  try {
    const readOnlyRecord: ControlledDocumentRecord = {
      ...ws.record,
      editability: 'READ_ONLY',
    };
    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: readOnlyRecord.id,
          docRecord: readOnlyRecord,
          candidateContent: 'new content',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('DOCUMENT_READ_ONLY')
    );
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test J: Editable-target symlink rejection
runTest('Test J: Editable-target symlink rejection', () => {
  const ws = createTestWorkspace();
  try {
    const realFile = path.join(ws.docsDir, 'REAL_FILE.md');
    fs.writeFileSync(realFile, ws.initialContent, 'utf8');
    fs.unlinkSync(ws.targetDiskPath);
    fs.symlinkSync(realFile, ws.targetDiskPath);

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new content',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('EDITABLE_TARGET_SYMLINK')
    );
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test K: Mixed-EOL candidate rejection
runTest('Test K: Mixed-EOL candidate rejection', () => {
  const ws = createTestWorkspace();
  try {
    // Make target file have mixed line endings
    const mixedContent = 'Line 1\r\nLine 2\nLine 3\r\n';
    fs.writeFileSync(ws.targetDiskPath, mixedContent, 'utf8');
    const mixedSha = crypto.createHash('sha256').update(Buffer.from(mixedContent, 'utf8')).digest('hex');

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'New content',
          baseSha256: mixedSha,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('UNSUPPORTED_MIXED_LINE_ENDINGS')
    );
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test L: Document lock blocks concurrent prepare
runTest('Test L: Document lock blocks concurrent prepare', () => {
  const ws = createTestWorkspace();
  try {
    const coordinator1 = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'edit 1',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), true);

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'edit 2',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-2',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('DOCUMENT_TRANSACTION_BUSY')
    );
  } finally {
    ws.cleanup();
  }
});

// Test M: Lock released after preparation failure
runTest('Test M: Lock released after preparation failure', () => {
  const ws = createTestWorkspace();
  try {
    assert.throws(() => {
      prepareDocumentTransaction({
        projectId: 'PRJ-TEST',
        documentId: ws.record.id,
        docRecord: ws.record,
        candidateContent: 'edit',
        baseSha256: 'invalid-hash',
        projectStateBeforeDigest: null,
        stateVersionBefore: 1,
        auditEventId: 'EVT-1',
        workspaceRoot: ws.workspaceDir,
      });
    });

    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);

    // Second prepare with valid hash must now succeed
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'valid edit',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-2',
      workspaceRoot: ws.workspaceDir,
    });
    assert(coord.operationId);
  } finally {
    ws.cleanup();
  }
});

// Test N: Successful executeReplacement
runTest('Test N: Successful executeReplacement', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + 'Appended Line.\n';
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const candidateSiblingPath = coord.candidatePath;
    const rollbackSiblingPath = coord.rollbackPath;

    const result = coord.executeReplacement();
    assert.strictEqual(result.previousSha256, ws.initialSha256);
    assert(result.newSha256, 'Returns newSha256');
    assert(Buffer.isBuffer(result.candidateBytes), 'Returns candidateBytes');

    // On disk, target has new content
    const targetContentOnDisk = fs.readFileSync(ws.targetDiskPath, 'utf8');
    assert.strictEqual(targetContentOnDisk, candidateContent);

    // Candidate sibling file was renamed away
    assert.strictEqual(fs.existsSync(candidateSiblingPath), false);

    // Rollback sibling remains preserved
    assert.strictEqual(fs.existsSync(rollbackSiblingPath), true);
  } finally {
    ws.cleanup();
  }
});

// Test O: DOCUMENT_REPLACED journal phase
runTest('Test O: DOCUMENT_REPLACED journal phase', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + 'Change.\n';
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();

    const journal: DocumentTransactionJournal = JSON.parse(
      fs.readFileSync(coord.journalPath, 'utf8')
    );
    assert.strictEqual(journal.phase, 'DOCUMENT_REPLACED');
    assert(new Date(journal.updatedAt).getTime() >= new Date(journal.createdAt).getTime());
  } finally {
    ws.cleanup();
  }
});

// Test P: Pre-rename external target modification rejection
runTest('Test P: Pre-rename external target modification rejection', () => {
  const ws = createTestWorkspace();
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'new edit',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    // Modify target externally before replacement
    fs.writeFileSync(ws.targetDiskPath, 'tampered content', 'utf8');

    assert.throws(
      () => {
        coord.executeReplacement();
      },
      (err: any) => err.message.includes('DOCUMENT_STALE')
    );

    // Candidate, rollback, and journal cleaned up, lock released
    assert.strictEqual(fs.existsSync(coord.candidatePath), false);
    assert.strictEqual(fs.existsSync(coord.rollbackPath), false);
    assert.strictEqual(fs.existsSync(coord.journalPath), false);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test Q: Failure Stage A (Rollback write failure)
runTest('Test Q: Failure Stage A (Rollback write failure)', () => {
  const ws = createTestWorkspace();
  const origOpen = fs.openSync;
  try {
    (fs as any).openSync = function (filepath: string, flags: string) {
      if (typeof filepath === 'string' && filepath.endsWith('.rollback')) {
        throw new Error('SIMULATED_DISK_IO_ERROR_ROLLBACK');
      }
      return origOpen.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new edit',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('SIMULATED_DISK_IO_ERROR_ROLLBACK')
    );

    // Target document unchanged
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Zero sibling artifacts or journal remain
    const docsFiles = fs.readdirSync(ws.docsDir);
    assert.strictEqual(docsFiles.length, 1);
    assert.strictEqual(docsFiles[0], 'PROJECT_STATE.md');
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    (fs as any).openSync = origOpen;
    ws.cleanup();
  }
});

// Test R: Failure Stage B (Candidate write failure)
runTest('Test R: Failure Stage B (Candidate write failure)', () => {
  const ws = createTestWorkspace();
  const origOpen = fs.openSync;
  try {
    (fs as any).openSync = function (filepath: string, flags: string) {
      if (typeof filepath === 'string' && filepath.endsWith('.candidate')) {
        throw new Error('SIMULATED_DISK_IO_ERROR_CANDIDATE');
      }
      return origOpen.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new edit',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('SIMULATED_DISK_IO_ERROR_CANDIDATE')
    );

    // Target unchanged
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Rollback sibling cleaned up
    const docsFiles = fs.readdirSync(ws.docsDir);
    assert.strictEqual(docsFiles.length, 1);
    assert.strictEqual(docsFiles[0], 'PROJECT_STATE.md');
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    (fs as any).openSync = origOpen;
    ws.cleanup();
  }
});

// Test S: Failure Stage C (Candidate fsync failure)
runTest('Test S: Failure Stage C (Candidate fsync failure)', () => {
  const ws = createTestWorkspace();
  const origFsync = fs.fdatasyncSync;
  let candidateFsyncEncountered = false;
  try {
    let callCount = 0;
    (fs as any).fdatasyncSync = function (fd: number) {
      callCount++;
      // First fsync is for rollback; second fsync is for candidate
      if (callCount === 2) {
        candidateFsyncEncountered = true;
        throw new Error('SIMULATED_CANDIDATE_FSYNC_FAILURE');
      }
      return origFsync.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new edit',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('SIMULATED_CANDIDATE_FSYNC_FAILURE')
    );

    assert(candidateFsyncEncountered, 'Candidate fsync was intercepted');
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Artifacts cleaned
    const docsFiles = fs.readdirSync(ws.docsDir);
    assert.strictEqual(docsFiles.length, 1);
    assert.strictEqual(docsFiles[0], 'PROJECT_STATE.md');
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    (fs as any).fdatasyncSync = origFsync;
    ws.cleanup();
  }
});

// Test T: Failure Stage D (Journal write/fsync failure)
runTest('Test T: Failure Stage D (Journal write/fsync failure)', () => {
  const ws = createTestWorkspace();
  const origFsync = fs.fsyncSync;
  let journalFsyncEncountered = false;
  try {
    (fs as any).fsyncSync = function (fd: number) {
      journalFsyncEncountered = true;
      throw new Error('SIMULATED_JOURNAL_FSYNC_FAILURE');
    };

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new edit',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('SIMULATED_JOURNAL_FSYNC_FAILURE')
    );

    assert(journalFsyncEncountered, 'Journal fsync was intercepted');
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Rollback and candidate cleaned, journal not present
    const docsFiles = fs.readdirSync(ws.docsDir);
    assert.strictEqual(docsFiles.length, 1);
    assert.strictEqual(docsFiles[0], 'PROJECT_STATE.md');

    const journalDir = path.join(ws.workspaceDir, '.local', 'document-transactions');
    const journalFiles = fs.existsSync(journalDir) ? fs.readdirSync(journalDir) : [];
    assert.strictEqual(journalFiles.length, 0);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    (fs as any).fsyncSync = origFsync;
    ws.cleanup();
  }
});

// Test U: Failure Stage E (Candidate rename failure)
runTest('Test U: Failure Stage E (Candidate rename failure)', () => {
  const ws = createTestWorkspace();
  const origRename = fs.renameSync;
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'new edit',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    (fs as any).renameSync = function (oldPath: string, newPath: string) {
      if (typeof oldPath === 'string' && oldPath.endsWith('.candidate')) {
        throw new Error('SIMULATED_RENAME_FAILURE_CANDIDATE');
      }
      return origRename.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        coord.executeReplacement();
      },
      (err: any) => err.message.includes('SIMULATED_RENAME_FAILURE_CANDIDATE')
    );

    // Target document unchanged
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Rollback and candidate preserved for recovery
    assert.strictEqual(fs.existsSync(coord.candidatePath), true);
    assert.strictEqual(fs.existsSync(coord.rollbackPath), true);
  } finally {
    (fs as any).renameSync = origRename;
    ws.cleanup();
  }
});

// Test V: Journal update failure after successful rename
runTest('Test V: Journal update failure after successful rename', () => {
  const ws = createTestWorkspace();
  const origRename = fs.renameSync;
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'new edit',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    let renameCallCount = 0;
    (fs as any).renameSync = function (oldPath: string, newPath: string) {
      renameCallCount++;
      // Call 1 is candidate -> target rename (succeeds)
      // Call 2 is journal tmp -> journal rename (fails)
      if (renameCallCount === 2) {
        throw new Error('SIMULATED_JOURNAL_UPDATE_RENAME_FAILURE');
      }
      return origRename.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        coord.executeReplacement();
      },
      (err: any) => err.message.includes('SIMULATED_JOURNAL_UPDATE_RENAME_FAILURE')
    );

    // Target was replaced, but coordinator tracks replacementApplied = true
    // handleRollback can be called to restore target!
    (fs as any).renameSync = origRename; // restore rename
    coord.handleRollback(new Error('Rollback from journal failure'));

    // Target document restored to original content!
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    (fs as any).renameSync = origRename;
    ws.cleanup();
  }
});

// Test W: Successful PREPARED rollback cleanup
runTest('Test W: Successful PREPARED rollback cleanup', () => {
  const ws = createTestWorkspace();
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'new edit',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    assert.strictEqual(fs.existsSync(coord.candidatePath), true);
    assert.strictEqual(fs.existsSync(coord.rollbackPath), true);
    assert.strictEqual(fs.existsSync(coord.journalPath), true);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), true);

    coord.handleRollback(new Error('User cancelled'));

    // Sibling artifacts and journal unlinked
    assert.strictEqual(fs.existsSync(coord.candidatePath), false);
    assert.strictEqual(fs.existsSync(coord.rollbackPath), false);
    assert.strictEqual(fs.existsSync(coord.journalPath), false);

    // Target unchanged
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Lock released
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test X: Successful replaced-document rollback
runTest('Test X: Successful replaced-document rollback', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + 'New addition.\n';
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), candidateContent);

    coord.handleRollback(new Error('Snapshot write failed'));

    // Target document restored to initial content
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Sibling artifacts and journal cleaned up
    assert.strictEqual(fs.existsSync(coord.rollbackPath), false);
    assert.strictEqual(fs.existsSync(coord.candidatePath), false);
    assert.strictEqual(fs.existsSync(coord.journalPath), false);

    // Lock released
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test Y: Rollback hash verification
runTest('Test Y: Rollback hash verification', () => {
  const ws = createTestWorkspace();
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Edit.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();
    coord.handleRollback(new Error('Rollback check'));

    const restoredBytes = fs.readFileSync(ws.targetDiskPath);
    const restoredSha = crypto.createHash('sha256').update(restoredBytes).digest('hex');
    assert.strictEqual(restoredSha, ws.initialSha256);
  } finally {
    ws.cleanup();
  }
});

// Test Z: Failure Stage I — corrupt rollback artifact
runTest('Test Z: Failure Stage I — corrupt rollback artifact', () => {
  const ws = createTestWorkspace();
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Edit.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();

    // Corrupt the rollback sibling file on disk
    fs.writeFileSync(coord.rollbackPath, 'CORRUPTED_ROLLBACK_BYTES', 'utf8');

    assert.throws(
      () => {
        coord.handleRollback(new Error('Rollback failure'));
      },
      (err: any) => err.message.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')
    );

    // Artifacts retained, lock remains held
    assert.strictEqual(fs.existsSync(coord.rollbackPath), true);
    assert.strictEqual(fs.existsSync(coord.journalPath), true);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), true);
  } finally {
    ws.cleanup();
  }
});

// Test AA: Failure Stage I — rollback rename failure
runTest('Test AA: Failure Stage I — rollback rename failure', () => {
  const ws = createTestWorkspace();
  const origRename = fs.renameSync;
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Edit.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();

    (fs as any).renameSync = function (oldPath: string, newPath: string) {
      if (typeof oldPath === 'string' && oldPath.endsWith('.rollback')) {
        throw new Error('SIMULATED_ROLLBACK_RENAME_FAILURE');
      }
      return origRename.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        coord.handleRollback(new Error('Rollback trigger'));
      },
      (err: any) => err.message.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')
    );

    // Artifacts retained, lock remains held
    assert.strictEqual(fs.existsSync(coord.rollbackPath), true);
    assert.strictEqual(fs.existsSync(coord.journalPath), true);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), true);
  } finally {
    (fs as any).renameSync = origRename;
    ws.cleanup();
  }
});

// Test AB: Normal handleCommitSuccess
runTest('Test AB: Normal handleCommitSuccess', () => {
  const ws = createTestWorkspace();
  try {
    const candidateContent = ws.initialContent + 'Finalized change.\n';
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent,
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();
    coord.handleCommitSuccess();

    // Target document retains candidate content
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), candidateContent);

    // All artifacts and journal cleaned up
    assert.strictEqual(fs.existsSync(coord.candidatePath), false);
    assert.strictEqual(fs.existsSync(coord.rollbackPath), false);
    assert.strictEqual(fs.existsSync(coord.journalPath), false);

    // Lock released
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test AC: Durable COMMITTED marker precedes cleanup
runTest('Test AC: Durable COMMITTED marker precedes cleanup', () => {
  const ws = createTestWorkspace();
  const origUnlink = fs.unlinkSync;
  let sawCommittedPhaseBeforeUnlink = false;
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Change.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();

    (fs as any).unlinkSync = function (filepath: string) {
      if (typeof filepath === 'string' && filepath.endsWith('.rollback')) {
        const currentJournal: DocumentTransactionJournal = JSON.parse(
          fs.readFileSync(coord.journalPath, 'utf8')
        );
        if (currentJournal.phase === 'COMMITTED') {
          sawCommittedPhaseBeforeUnlink = true;
        }
      }
      return origUnlink.apply(fs, arguments as any);
    };

    coord.handleCommitSuccess();
    assert(sawCommittedPhaseBeforeUnlink, 'Journal was in COMMITTED phase before artifact unlinking');
  } finally {
    (fs as any).unlinkSync = origUnlink;
    ws.cleanup();
  }
});

// Test AD: Failure Stage J — cleanup pending
runTest('Test AD: Failure Stage J — cleanup pending', () => {
  const ws = createTestWorkspace();
  const origUnlink = fs.unlinkSync;
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Change.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();

    (fs as any).unlinkSync = function (filepath: string) {
      if (typeof filepath === 'string' && filepath.endsWith('.rollback')) {
        throw new Error('SIMULATED_UNLINK_ERROR');
      }
      return origUnlink.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        coord.handleCommitSuccess();
      },
      (err: any) => err.message.includes('COMMITTED_CLEANUP_PENDING')
    );

    // Target is NOT rolled back
    assert.strictEqual(
      fs.readFileSync(ws.targetDiskPath, 'utf8'),
      ws.initialContent + 'Change.\n'
    );

    // Journal phase is COMMITTED_CLEANUP_PENDING
    const journal: DocumentTransactionJournal = JSON.parse(
      fs.readFileSync(coord.journalPath, 'utf8')
    );
    assert.strictEqual(journal.phase, 'COMMITTED_CLEANUP_PENDING');

    // Lock remains held
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), true);
  } finally {
    (fs as any).unlinkSync = origUnlink;
    ws.cleanup();
  }
});

// Test AE: Cleanup-pending retry succeeds
runTest('Test AE: Cleanup-pending retry succeeds', () => {
  const ws = createTestWorkspace();
  const origUnlink = fs.unlinkSync;
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Change.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    coord.executeReplacement();

    (fs as any).unlinkSync = function (filepath: string) {
      if (typeof filepath === 'string' && filepath.endsWith('.rollback')) {
        throw new Error('SIMULATED_UNLINK_ERROR');
      }
      return origUnlink.apply(fs, arguments as any);
    };

    try {
      coord.handleCommitSuccess();
    } catch {
      // Expected COMMITTED_CLEANUP_PENDING
    }

    // Restore normal unlinkSync
    (fs as any).unlinkSync = origUnlink;

    // Retry handleCommitSuccess from COMMITTED_CLEANUP_PENDING
    coord.handleCommitSuccess();

    // Now cleanup succeeds
    assert.strictEqual(fs.existsSync(coord.rollbackPath), false);
    assert.strictEqual(fs.existsSync(coord.journalPath), false);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    (fs as any).unlinkSync = origUnlink;
    ws.cleanup();
  }
});

// Test AF: stateVersionExpectedAfter == before + 1
runTest('Test AF: stateVersionExpectedAfter == before + 1', () => {
  const ws = createTestWorkspace();
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Change.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 42,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const journal: DocumentTransactionJournal = JSON.parse(
      fs.readFileSync(coord.journalPath, 'utf8')
    );
    assert.strictEqual(journal.stateVersionBefore, 42);
    assert.strictEqual(journal.stateVersionExpectedAfter, 43);
  } finally {
    ws.cleanup();
  }
});

// Test AG: auditEventId preserved exactly
runTest('Test AG: auditEventId preserved exactly', () => {
  const ws = createTestWorkspace();
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Change.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'AUDIT-SPECIFIC-ID-999-XYZ',
      workspaceRoot: ws.workspaceDir,
    });

    const journal: DocumentTransactionJournal = JSON.parse(
      fs.readFileSync(coord.journalPath, 'utf8')
    );
    assert.strictEqual(journal.auditEventId, 'AUDIT-SPECIFIC-ID-999-XYZ');
  } finally {
    ws.cleanup();
  }
});

// Test AH: operationId drives exact sibling/journal names
runTest('Test AH: operationId drives exact sibling/journal names', () => {
  const ws = createTestWorkspace();
  try {
    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Change.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const opId = coord.operationId;
    assert.strictEqual(
      coord.rollbackPath,
      path.join(ws.docsDir, `.PROJECT_STATE.md.dmk-${opId}.rollback`)
    );
    assert.strictEqual(
      coord.candidatePath,
      path.join(ws.docsDir, `.PROJECT_STATE.md.dmk-${opId}.candidate`)
    );
    assert.strictEqual(
      coord.journalPath,
      path.join(ws.workspaceDir, '.local', 'document-transactions', `${opId}.json`)
    );
  } finally {
    ws.cleanup();
  }
});

// Test AI: Real repository pristine with zero artifacts
runTest('Test AI: Real repository pristine with zero artifacts', () => {
  const realJournalDir = path.resolve(process.cwd(), '.local', 'document-transactions');
  if (fs.existsSync(realJournalDir)) {
    const files = fs.readdirSync(realJournalDir);
    assert.strictEqual(files.length, 0, 'Real .local/document-transactions/ must be empty');
  }

  const realDocs00 = path.resolve(process.cwd(), 'docs', '00_control');
  if (fs.existsSync(realDocs00)) {
    const files = fs.readdirSync(realDocs00);
    const siblings = files.filter(f => f.includes('.candidate') || f.includes('.rollback'));
    assert.strictEqual(siblings.length, 0, 'No candidate or rollback siblings in real repo');
  }
});

// Test AJ: Journal durability contract (fdatasync for siblings, fsync for journal)
runTest('Test AJ: Journal durability contract (fdatasync for siblings, fsync for journal)', () => {
  const ws = createTestWorkspace();
  const origFdatasync = fs.fdatasyncSync;
  const origFsync = fs.fsyncSync;
  let fdatasyncCount = 0;
  let fsyncCount = 0;
  try {
    (fs as any).fdatasyncSync = function (fd: number) {
      fdatasyncCount++;
      return origFdatasync.apply(fs, arguments as any);
    };
    (fs as any).fsyncSync = function (fd: number) {
      fsyncCount++;
      return origFsync.apply(fs, arguments as any);
    };

    prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Line.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    // 2 siblings use fdatasync (rollback and candidate)
    assert.strictEqual(fdatasyncCount, 2, 'Exactly 2 fdatasyncSync calls for sibling files');
    // 1 journal uses fsync
    assert.strictEqual(fsyncCount, 1, 'Exactly 1 fsyncSync call for PREPARED journal');
  } finally {
    (fs as any).fdatasyncSync = origFdatasync;
    (fs as any).fsyncSync = origFsync;
    ws.cleanup();
  }
});

// Test AK: DOCUMENT_REPLACED and COMMITTED journal updates invoke fs.fsyncSync
runTest('Test AK: DOCUMENT_REPLACED and COMMITTED journal updates invoke fs.fsyncSync', () => {
  const ws = createTestWorkspace();
  const origFsync = fs.fsyncSync;
  let fsyncCount = 0;
  try {
    (fs as any).fsyncSync = function (fd: number) {
      fsyncCount++;
      return origFsync.apply(fs, arguments as any);
    };

    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: ws.initialContent + 'Line.\n',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    const fsyncAfterPrepare = fsyncCount;
    assert.strictEqual(fsyncAfterPrepare, 1, '1 fsync during prepare');

    coord.executeReplacement();
    const fsyncAfterReplace = fsyncCount;
    assert.strictEqual(fsyncAfterReplace, 2, 'fsyncSync invoked during DOCUMENT_REPLACED journal write');

    coord.handleCommitSuccess();
    const fsyncAfterCommit = fsyncCount;
    assert.strictEqual(fsyncAfterCommit, 3, 'fsyncSync invoked during COMMITTED journal write');
  } finally {
    (fs as any).fsyncSync = origFsync;
    ws.cleanup();
  }
});

// Test AL: Journal fsync failure during prepare cleans artifacts and releases lock
runTest('Test AL: Journal fsync failure during prepare cleans artifacts and releases lock', () => {
  const ws = createTestWorkspace();
  const origFsync = fs.fsyncSync;
  let fsyncIntercepted = false;
  try {
    (fs as any).fsyncSync = function (fd: number) {
      fsyncIntercepted = true;
      throw new Error('SIMULATED_JOURNAL_FSYNC_FAILURE');
    };

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new edit',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('SIMULATED_JOURNAL_FSYNC_FAILURE')
    );

    assert(fsyncIntercepted, 'fsyncSync was intercepted');
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.initialContent);

    // Rollback and candidate cleaned, journal not present
    const docsFiles = fs.readdirSync(ws.docsDir);
    assert.strictEqual(docsFiles.length, 1);
    assert.strictEqual(docsFiles[0], 'PROJECT_STATE.md');

    const journalDir = path.join(ws.workspaceDir, '.local', 'document-transactions');
    const journalFiles = fs.existsSync(journalDir) ? fs.readdirSync(journalDir) : [];
    assert.strictEqual(journalFiles.length, 0);
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false);
  } finally {
    (fs as any).fsyncSync = origFsync;
    ws.cleanup();
  }
});

// Test AM: Symlink swap after prepare triggers safe abort with EDITABLE_TARGET_SYMLINK
runTest('Test AM: Symlink swap after prepare triggers safe abort with EDITABLE_TARGET_SYMLINK', () => {
  const ws = createTestWorkspace();
  try {
    const otherFile = path.join(ws.docsDir, 'OTHER_TARGET.md');
    fs.writeFileSync(otherFile, 'OTHER_TARGET_ORIGINAL_CONTENT', 'utf8');

    const coord = prepareDocumentTransaction({
      projectId: 'PRJ-TEST',
      documentId: ws.record.id,
      docRecord: ws.record,
      candidateContent: 'candidate content',
      baseSha256: ws.initialSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      auditEventId: 'EVT-1',
      workspaceRoot: ws.workspaceDir,
    });

    // Before executeReplacement, replace target file externally with internal symlink to otherFile
    fs.unlinkSync(ws.targetDiskPath);
    fs.symlinkSync(otherFile, ws.targetDiskPath);

    assert.throws(
      () => {
        coord.executeReplacement();
      },
      (err: any) => err.message.includes('EDITABLE_TARGET_SYMLINK')
    );

    // Symlink must NOT be overwritten by rename
    const lstat = fs.lstatSync(ws.targetDiskPath);
    assert(lstat.isSymbolicLink(), 'Target remains a symbolic link');

    // Symlink target content must remain unchanged
    const otherContent = fs.readFileSync(otherFile, 'utf8');
    assert.strictEqual(otherContent, 'OTHER_TARGET_ORIGINAL_CONTENT');

    // Sibling candidate, rollback, and journal cleaned up
    assert.strictEqual(fs.existsSync(coord.candidatePath), false, 'Candidate sibling cleaned');
    assert.strictEqual(fs.existsSync(coord.rollbackPath), false, 'Rollback sibling cleaned');
    assert.strictEqual(fs.existsSync(coord.journalPath), false, 'Journal cleaned');

    // Lock released
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false, 'Lock released');
  } finally {
    ws.cleanup();
  }
});

// Test AN: Symlink assertion is lock-bound and releases lock on rejection
runTest('Test AN: Symlink assertion is lock-bound and releases lock on rejection', () => {
  const ws = createTestWorkspace();
  const origLstat = fs.lstatSync;
  let targetReplacedWithSymlink = false;
  const otherFile = path.join(ws.docsDir, 'OTHER_FILE.md');
  fs.writeFileSync(otherFile, 'OTHER_CONTENT', 'utf8');

  try {
    let lstatCallCount = 0;
    let lockWasHeldDuringAssertion = false;
    (fs as any).lstatSync = function (filepath: string, options?: any) {
      if (typeof filepath === 'string' && path.resolve(filepath) === path.resolve(ws.targetDiskPath)) {
        lstatCallCount++;
        // Call 1: resolveDocumentDiskPath -> observe real file
        // Immediately after Call 1, swap target with a symlink to otherFile
        if (lstatCallCount === 1) {
          const res = origLstat.apply(fs, arguments as any);
          fs.unlinkSync(ws.targetDiskPath);
          fs.symlinkSync(otherFile, ws.targetDiskPath);
          targetReplacedWithSymlink = true;
          return res;
        }
        if (lstatCallCount === 2) {
          lockWasHeldDuringAssertion = isDocumentLocked(ws.targetDiskPath);
        }
      }
      return origLstat.apply(fs, arguments as any);
    };

    assert.throws(
      () => {
        prepareDocumentTransaction({
          projectId: 'PRJ-TEST',
          documentId: ws.record.id,
          docRecord: ws.record,
          candidateContent: 'new candidate',
          baseSha256: ws.initialSha256,
          projectStateBeforeDigest: null,
          stateVersionBefore: 1,
          auditEventId: 'EVT-1',
          workspaceRoot: ws.workspaceDir,
        });
      },
      (err: any) => err.message.includes('EDITABLE_TARGET_SYMLINK')
    );

    assert.strictEqual(lockWasHeldDuringAssertion, true, 'Document lock was held during assertEditableTargetNotSymlink');
    assert(targetReplacedWithSymlink, 'Target was swapped to symlink between resolve and check');

    // Zero sibling artifacts or journal
    const docsFiles = fs.readdirSync(ws.docsDir);
    const siblings = docsFiles.filter(f => f.includes('.candidate') || f.includes('.rollback'));
    assert.strictEqual(siblings.length, 0, 'Zero sibling artifacts created');

    const journalDir = path.join(ws.workspaceDir, '.local', 'document-transactions');
    const journalFiles = fs.existsSync(journalDir) ? fs.readdirSync(journalDir) : [];
    assert.strictEqual(journalFiles.length, 0, 'Zero journal artifacts created');

    // Lock must be released
    assert.strictEqual(isDocumentLocked(ws.targetDiskPath), false, 'Lock released');
  } finally {
    (fs as any).lstatSync = origLstat;
    ws.cleanup();
  }
});

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
