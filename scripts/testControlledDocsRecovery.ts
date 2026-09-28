import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert';
import {
  recoverDocumentTransactions,
  isDocumentTransactionsLocked,
  assertDocumentTransactionsUnlocked,
  type RecoveryReport,
} from '../server/docs/controlledDocsRecovery.ts';
import {
  deriveSiblingCandidatePath,
  deriveSiblingRollbackPath,
} from '../server/docs/controlledDocsPersistence.ts';
import type { DocumentTransactionJournal } from '../server/docs/controlledDocsTransaction.ts';

const REAL_WORKSPACE_ROOT = process.cwd();

interface TestWorkspace {
  workspaceDir: string;
  docsDir: string;
  targetDiskPath: string;
  targetRelPath: string;
  previousContent: string;
  previousBytes: Buffer;
  previousSha256: string;
  candidateContent: string;
  candidateBytes: Buffer;
  candidateSha256: string;
  journalDir: string;
  writeSnapshot: (options?: {
    stateVersion?: number;
    auditEvents?: any[];
  }) => void;
  writeJournal: (journal: Partial<DocumentTransactionJournal> & { operationId: string }) => string;
  writeCandidateFile: (operationId: string, bytes?: Buffer) => string;
  writeRollbackFile: (operationId: string, bytes?: Buffer) => string;
  cleanup: () => void;
}

function createRecoveryTestWorkspace(): TestWorkspace {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-rec-test-'));

  // 1. Copy bootstrap manifest for authoritative registry lookup
  const bootstrapDir = path.join(workspaceDir, 'bootstrap');
  fs.mkdirSync(bootstrapDir, { recursive: true });
  fs.copyFileSync(
    path.join(REAL_WORKSPACE_ROOT, 'bootstrap', 'docmonstakrakin.self-bootstrap.json'),
    path.join(bootstrapDir, 'docmonstakrakin.self-bootstrap.json')
  );

  // 2. Prepare docs directory and target file (DOC-CTRL-002: PROJECT_STATE.md)
  const docsDir = path.join(workspaceDir, 'docs', '00_control');
  fs.mkdirSync(docsDir, { recursive: true });
  const targetRelPath = 'docs/00_control/PROJECT_STATE.md';
  const targetDiskPath = path.join(workspaceDir, targetRelPath);

  const previousContent = '# docmonstakrakin current project state\n\n## Governance\nInitial nominal state.\nDMK-201: VERIFICATION_PENDING\nGate 7: HUMAN_APPROVAL_REQUIRED\nLive reconciliation active.\nRelease status: RC1.\n';
  const previousBytes = Buffer.from(previousContent, 'utf8');
  const previousSha256 = crypto.createHash('sha256').update(previousBytes).digest('hex');
  fs.writeFileSync(targetDiskPath, previousBytes);

  const candidateContent = '# docmonstakrakin current project state\n\n## Governance\nUpdated state.\nDMK-201: VERIFICATION_PENDING\nGate 7: HUMAN_APPROVAL_REQUIRED\nLive reconciliation active.\nRelease status: RC1.\n';
  const candidateBytes = Buffer.from(candidateContent, 'utf8');
  const candidateSha256 = crypto.createHash('sha256').update(candidateBytes).digest('hex');

  const journalDir = path.join(workspaceDir, '.local', 'document-transactions');
  fs.mkdirSync(journalDir, { recursive: true });

  const writeSnapshot = (options?: { stateVersion?: number; auditEvents?: any[] }) => {
    const localDir = path.join(workspaceDir, '.local');
    fs.mkdirSync(localDir, { recursive: true });
    const stateVersion = options?.stateVersion ?? 31;
    const auditEvents = options?.auditEvents ?? [];

    const snapshot = {
      schemaVersion: 1,
      state: {
        projects: [
          {
            id: 'PRJ-DOCMONSTAKRAKIN',
            name: 'docmonstakrakin',
            stateVersion,
          },
        ],
        auditLogs: {
          'PRJ-DOCMONSTAKRAKIN': auditEvents,
        },
      },
    };
    fs.writeFileSync(
      path.join(localDir, 'project-state.json'),
      JSON.stringify(snapshot, null, 2) + '\n',
      'utf8'
    );
  };

  const writeJournal = (journalInput: Partial<DocumentTransactionJournal> & { operationId: string }) => {
    const opId = journalInput.operationId;
    const candDisk = deriveSiblingCandidatePath(targetDiskPath, opId);
    const rollDisk = deriveSiblingRollbackPath(targetDiskPath, opId);

    const now = new Date().toISOString();
    const fullJournal: DocumentTransactionJournal = {
      operationId: opId,
      projectId: 'PRJ-DOCMONSTAKRAKIN',
      documentId: 'DOC-CTRL-002',
      targetPath: 'docs/00_control/PROJECT_STATE.md',
      candidateArtifactPath: path.relative(workspaceDir, candDisk).replace(/\\/g, '/'),
      rollbackArtifactPath: path.relative(workspaceDir, rollDisk).replace(/\\/g, '/'),
      previousSha256,
      candidateSha256,
      projectStateBeforeDigest: 'mock-digest',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: `EVT-${opId}`,
      phase: 'PREPARED',
      createdAt: now,
      updatedAt: now,
      ...journalInput,
    };

    const jPath = path.join(journalDir, `${opId}.json`);
    fs.writeFileSync(jPath, JSON.stringify(fullJournal, null, 2) + '\n', 'utf8');
    return jPath;
  };

  const writeCandidateFile = (operationId: string, bytes?: Buffer) => {
    const candPath = deriveSiblingCandidatePath(targetDiskPath, operationId);
    fs.writeFileSync(candPath, bytes ?? candidateBytes);
    return candPath;
  };

  const writeRollbackFile = (operationId: string, bytes?: Buffer) => {
    const rollPath = deriveSiblingRollbackPath(targetDiskPath, operationId);
    fs.writeFileSync(rollPath, bytes ?? previousBytes);
    return rollPath;
  };

  return {
    workspaceDir,
    docsDir,
    targetDiskPath,
    targetRelPath,
    previousContent,
    previousBytes,
    previousSha256,
    candidateContent,
    candidateBytes,
    candidateSha256,
    journalDir,
    writeSnapshot,
    writeJournal,
    writeCandidateFile,
    writeRollbackFile,
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
  }
}

console.log('================================================================');
console.log('   CONTROLLED DOCS TRANSACTION RECOVERY TEST SUITE (DMK-195)    ');
console.log('================================================================\n');

// Test A: no journal directory -> clean unlocked report
runTest('Test A: no journal directory -> clean unlocked report', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.rmSync(ws.journalDir, { recursive: true, force: true });
    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.recoveredCount, 0);
    assert.strictEqual(report.cleanedCount, 0);
    assert.strictEqual(report.ambiguousCount, 0);
    assert.strictEqual(report.locked, false);
    assert.strictEqual(report.errors.length, 0);
    assert.strictEqual(fs.existsSync(ws.journalDir), false, 'Empty scan does not create journal dir');
    assert.strictEqual(isDocumentTransactionsLocked(), false);
    assert.doesNotThrow(() => assertDocumentTransactionsUnlocked());
  } finally {
    ws.cleanup();
  }
});

// Test B: empty journal directory -> clean unlocked report
runTest('Test B: empty journal directory -> clean unlocked report', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.recoveredCount, 0);
    assert.strictEqual(report.cleanedCount, 0);
    assert.strictEqual(report.ambiguousCount, 0);
    assert.strictEqual(report.locked, false);
    assert.strictEqual(report.errors.length, 0);
    assert.strictEqual(isDocumentTransactionsLocked(), false);
  } finally {
    ws.cleanup();
  }
});

// Test C: malformed JSON journal -> locked
runTest('Test C: malformed JSON journal -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const badFile = path.join(ws.journalDir, 'bad-journal.json');
    fs.writeFileSync(badFile, '{ corrupted json syntax...', 'utf8');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
    assert(fs.existsSync(badFile), 'Corrupt journal preserved for human investigation');
    assert.strictEqual(isDocumentTransactionsLocked(), true);
    assert.throws(
      () => assertDocumentTransactionsUnlocked(),
      (err: any) => err.message.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')
    );
  } finally {
    ws.cleanup();
  }
});

// Test D: invalid journal schema -> locked
runTest('Test D: invalid journal schema -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const jPath = path.join(ws.journalDir, 'op-1.json');
    fs.writeFileSync(
      jPath,
      JSON.stringify({ operationId: 'op-1', phase: 'UNKNOWN_PHASE' }) + '\n',
      'utf8'
    );

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
    assert(fs.existsSync(jPath));
  } finally {
    ws.cleanup();
  }
});

// Test E: operationId/filename mismatch -> locked
runTest('Test E: operationId/filename mismatch -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const jPath = path.join(ws.journalDir, 'op-mismatch.json');
    const journal = {
      operationId: 'different-op-id',
      projectId: 'PRJ-DOCMONSTAKRAKIN',
      documentId: 'DOC-CTRL-002',
      targetPath: 'docs/00_control/PROJECT_STATE.md',
      candidateArtifactPath: 'docs/00_control/.PROJECT_STATE.md.dmk-different-op-id.candidate',
      rollbackArtifactPath: 'docs/00_control/.PROJECT_STATE.md.dmk-different-op-id.rollback',
      previousSha256: ws.previousSha256,
      candidateSha256: ws.candidateSha256,
      projectStateBeforeDigest: null,
      stateVersionBefore: 1,
      stateVersionExpectedAfter: 2,
      auditEventId: 'EVT-1',
      phase: 'PREPARED' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(jPath, JSON.stringify(journal, null, 2) + '\n', 'utf8');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test F: unknown document ID -> locked
runTest('Test F: unknown document ID -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    ws.writeJournal({ operationId: 'op-f', documentId: 'DOC-CTRL-NONEXISTENT' });
    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test G: wrong projectId -> locked
runTest('Test G: wrong projectId -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    ws.writeJournal({ operationId: 'op-g', projectId: 'PRJ-OTHER' });
    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test H: read-only registered document journal -> locked
runTest('Test H: read-only registered document journal -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    // DOC-CTRL-003 is MASTER_WBS.yaml (READ_ONLY)
    ws.writeJournal({
      operationId: 'op-h',
      documentId: 'DOC-CTRL-003',
      targetPath: 'docs/00_control/MASTER_WBS.yaml',
      candidateArtifactPath: 'docs/00_control/.MASTER_WBS.yaml.dmk-op-h.candidate',
      rollbackArtifactPath: 'docs/00_control/.MASTER_WBS.yaml.dmk-op-h.rollback',
    });
    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test I: journal path tampering -> locked, external sentinel untouched
runTest('Test I: journal path tampering -> locked, external sentinel untouched', () => {
  const ws = createRecoveryTestWorkspace();
  const sentinelPath = path.join(os.tmpdir(), `sentinel-${crypto.randomUUID()}.txt`);
  fs.writeFileSync(sentinelPath, 'SENTINEL_ORIGINAL_CONTENT', 'utf8');

  try {
    ws.writeJournal({
      operationId: 'op-tamper',
      targetPath: sentinelPath, // Untrusted external path!
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));

    // External sentinel file MUST NOT be touched
    assert.strictEqual(fs.readFileSync(sentinelPath, 'utf8'), 'SENTINEL_ORIGINAL_CONTENT');
    // Authoritative target untouched
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.previousContent);
  } finally {
    try {
      fs.unlinkSync(sentinelPath);
    } catch {}
    ws.cleanup();
  }
});

// Test J: duplicate journals for one target -> locked
runTest('Test J: duplicate journals for one target -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    ws.writeJournal({ operationId: 'op-j1' });
    ws.writeCandidateFile('op-j1');
    ws.writeRollbackFile('op-j1');

    ws.writeJournal({ operationId: 'op-j2' });
    ws.writeCandidateFile('op-j2');
    ws.writeRollbackFile('op-j2');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test K: target symlink -> locked
runTest('Test K: target symlink -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const otherTarget = path.join(ws.docsDir, 'OTHER.md');
    fs.writeFileSync(otherTarget, ws.previousContent, 'utf8');
    fs.unlinkSync(ws.targetDiskPath);
    fs.symlinkSync(otherTarget, ws.targetDiskPath);

    ws.writeJournal({ operationId: 'op-k' });
    ws.writeCandidateFile('op-k');
    ws.writeRollbackFile('op-k');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test L: recovery artifact symlink -> locked
runTest('Test L: recovery artifact symlink -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const fakeFile = path.join(ws.docsDir, 'FAKE.md');
    fs.writeFileSync(fakeFile, ws.candidateContent, 'utf8');

    ws.writeJournal({ operationId: 'op-l' });
    const candPath = deriveSiblingCandidatePath(ws.targetDiskPath, 'op-l');
    fs.symlinkSync(fakeFile, candPath); // Symlink artifact!
    ws.writeRollbackFile('op-l');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test M: PREPARED + target previous + valid artifacts -> cleanup
runTest('Test M: PREPARED + target previous + valid artifacts -> cleanup', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const jPath = ws.writeJournal({ operationId: 'op-m', phase: 'PREPARED' });
    const cPath = ws.writeCandidateFile('op-m');
    const rPath = ws.writeRollbackFile('op-m');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.recoveredCount, 0);
    assert.strictEqual(report.cleanedCount, 1);
    assert.strictEqual(report.ambiguousCount, 0);
    assert.strictEqual(report.locked, false);

    // Target unchanged
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.previousContent);
    // Artifacts cleaned
    assert.strictEqual(fs.existsSync(cPath), false);
    assert.strictEqual(fs.existsSync(rPath), false);
    assert.strictEqual(fs.existsSync(jPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test N: PREPARED + target candidate -> ambiguous lock
runTest('Test N: PREPARED + target candidate -> ambiguous lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    // Disk target has candidate bytes, but journal says PREPARED
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    ws.writeJournal({ operationId: 'op-n', phase: 'PREPARED' });
    ws.writeCandidateFile('op-n');
    ws.writeRollbackFile('op-n');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert.strictEqual(report.recoveredCount, 0);
    assert.strictEqual(report.cleanedCount, 0);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
  } finally {
    ws.cleanup();
  }
});

// Test O: PREPARED + unrelated target hash -> lock
runTest('Test O: PREPARED + unrelated target hash -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, 'unrelated corrupt content');
    ws.writeJournal({ operationId: 'op-o', phase: 'PREPARED' });
    ws.writeCandidateFile('op-o');
    ws.writeRollbackFile('op-o');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test P: PREPARED + missing candidate -> lock
runTest('Test P: PREPARED + missing candidate -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    ws.writeJournal({ operationId: 'op-p', phase: 'PREPARED' });
    ws.writeRollbackFile('op-p');
    // candidate file omitted!

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test Q: PREPARED + corrupt rollback -> lock
runTest('Test Q: PREPARED + corrupt rollback -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    ws.writeJournal({ operationId: 'op-q', phase: 'PREPARED' });
    ws.writeCandidateFile('op-q');
    ws.writeRollbackFile('op-q', Buffer.from('corrupted rollback'));

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test R: DOCUMENT_REPLACED + candidate target + no audit -> rollback
runTest('Test R: DOCUMENT_REPLACED + candidate target + no audit -> rollback', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    // Disk target has candidate content (replacement executed)
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const jPath = ws.writeJournal({ operationId: 'op-r', phase: 'DOCUMENT_REPLACED' });
    const rPath = ws.writeRollbackFile('op-r');
    ws.writeSnapshot({ stateVersion: 31, auditEvents: [] }); // No matching audit event

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.recoveredCount, 1);
    assert.strictEqual(report.cleanedCount, 0);
    assert.strictEqual(report.ambiguousCount, 0);
    assert.strictEqual(report.locked, false);

    // Target restored to previous content
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.previousContent);
    assert.strictEqual(fs.existsSync(rPath), false);
    assert.strictEqual(fs.existsSync(jPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test S: rollback verifies previousSha256
runTest('Test S: rollback verifies previousSha256', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    ws.writeJournal({ operationId: 'op-s', phase: 'DOCUMENT_REPLACED' });
    ws.writeRollbackFile('op-s');
    ws.writeSnapshot({ stateVersion: 31, auditEvents: [] });

    recoverDocumentTransactions(ws.workspaceDir);

    const targetSha = crypto.createHash('sha256').update(fs.readFileSync(ws.targetDiskPath)).digest('hex');
    assert.strictEqual(targetSha, ws.previousSha256);
  } finally {
    ws.cleanup();
  }
});

// Test T: rollback rename failure -> lock and preserve journal
runTest('Test T: rollback rename failure -> lock and preserve journal', () => {
  const ws = createRecoveryTestWorkspace();
  const origRename = fs.renameSync;
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const jPath = ws.writeJournal({ operationId: 'op-t', phase: 'DOCUMENT_REPLACED' });
    const rPath = ws.writeRollbackFile('op-t');
    ws.writeSnapshot({ stateVersion: 31, auditEvents: [] });

    (fs as any).renameSync = function (oldPath: string, newPath: string) {
      if (typeof oldPath === 'string' && oldPath.endsWith('.rollback')) {
        throw new Error('SIMULATED_ROLLBACK_RENAME_ERROR');
      }
      return origRename.apply(fs, arguments as any);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(fs.existsSync(jPath), 'Journal preserved');
    assert(fs.existsSync(rPath), 'Rollback preserved');
  } finally {
    (fs as any).renameSync = origRename;
    ws.cleanup();
  }
});

// Test U: restored-hash verification failure -> lock
runTest('Test U: restored-hash verification failure -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  const origRename = fs.renameSync;
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const jPath = ws.writeJournal({ operationId: 'op-u', phase: 'DOCUMENT_REPLACED' });
    ws.writeRollbackFile('op-u');
    ws.writeSnapshot({ stateVersion: 31, auditEvents: [] });

    // Mock rename to write corrupt bytes
    (fs as any).renameSync = function (oldPath: string, newPath: string) {
      if (typeof oldPath === 'string' && oldPath.endsWith('.rollback')) {
        fs.writeFileSync(newPath, 'corrupted restored bytes');
        return;
      }
      return origRename.apply(fs, arguments as any);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(fs.existsSync(jPath), 'Journal preserved');
  } finally {
    (fs as any).renameSync = origRename;
    ws.cleanup();
  }
});

// Test V: DOCUMENT_REPLACED + candidate target + committed evidence -> cleanup, no rollback
runTest('Test V: DOCUMENT_REPLACED + candidate target + committed evidence -> cleanup, no rollback', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const jPath = ws.writeJournal({
      operationId: 'op-v',
      phase: 'DOCUMENT_REPLACED',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'EVT-OP-V',
    });
    const rPath = ws.writeRollbackFile('op-v');
    const cPath = ws.writeCandidateFile('op-v');

    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [
        {
          id: 'EVT-OP-V',
          action: 'DOCUMENT_UPDATED',
          target: 'DOC-CTRL-002',
          details: {
            previousSha256: ws.previousSha256,
            newSha256: ws.candidateSha256,
            path: ws.targetRelPath,
          },
        },
      ],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.recoveredCount, 0);
    assert.strictEqual(report.cleanedCount, 1);
    assert.strictEqual(report.ambiguousCount, 0);
    assert.strictEqual(report.locked, false);

    // Target retains candidate content (committed!)
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.candidateContent);
    assert.strictEqual(fs.existsSync(cPath), false);
    assert.strictEqual(fs.existsSync(rPath), false);
    assert.strictEqual(fs.existsSync(jPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test W: DOCUMENT_REPLACED + previous target -> lock
runTest('Test W: DOCUMENT_REPLACED + previous target -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    // Target still has previous content even though journal is DOCUMENT_REPLACED
    fs.writeFileSync(ws.targetDiskPath, ws.previousBytes);
    ws.writeJournal({ operationId: 'op-w', phase: 'DOCUMENT_REPLACED' });
    ws.writeRollbackFile('op-w');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test X: COMMITTED + committed evidence + candidate target -> cleanup
runTest('Test X: COMMITTED + committed evidence + candidate target -> cleanup', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const jPath = ws.writeJournal({
      operationId: 'op-x',
      phase: 'COMMITTED',
      stateVersionBefore: 10,
      stateVersionExpectedAfter: 11,
      auditEventId: 'EVT-X',
    });
    const rPath = ws.writeRollbackFile('op-x');

    ws.writeSnapshot({
      stateVersion: 11,
      auditEvents: [
        {
          id: 'EVT-X',
          action: 'DOCUMENT_UPDATED',
          target: 'DOC-CTRL-002',
        },
      ],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.cleanedCount, 1);
    assert.strictEqual(report.recoveredCount, 0);
    assert.strictEqual(report.locked, false);
    assert.strictEqual(fs.existsSync(rPath), false);
    assert.strictEqual(fs.existsSync(jPath), false);
    assert.strictEqual(fs.readFileSync(ws.targetDiskPath, 'utf8'), ws.candidateContent);
  } finally {
    ws.cleanup();
  }
});

// Test Y: COMMITTED_CLEANUP_PENDING -> cleanup
runTest('Test Y: COMMITTED_CLEANUP_PENDING -> cleanup', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const jPath = ws.writeJournal({
      operationId: 'op-y',
      phase: 'COMMITTED_CLEANUP_PENDING',
      stateVersionBefore: 5,
      stateVersionExpectedAfter: 6,
      auditEventId: 'EVT-Y',
    });
    const rPath = ws.writeRollbackFile('op-y');

    ws.writeSnapshot({
      stateVersion: 6,
      auditEvents: [
        {
          id: 'EVT-Y',
          action: 'DOCUMENT_UPDATED',
          target: 'DOC-CTRL-002',
        },
      ],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.cleanedCount, 1);
    assert.strictEqual(report.locked, false);
    assert.strictEqual(fs.existsSync(rPath), false);
    assert.strictEqual(fs.existsSync(jPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test Z: COMMITTED without audit evidence -> lock
runTest('Test Z: COMMITTED without audit evidence -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    ws.writeJournal({
      operationId: 'op-z',
      phase: 'COMMITTED',
      auditEventId: 'EVT-Z',
    });
    ws.writeSnapshot({ stateVersion: 32, auditEvents: [] }); // No audit event!

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test AA: committed audit event with low stateVersion -> lock
runTest('Test AA: committed audit event with low stateVersion -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    ws.writeJournal({
      operationId: 'op-aa',
      phase: 'COMMITTED',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'EVT-AA',
    });
    ws.writeSnapshot({
      stateVersion: 31, // Less than expected 32!
      auditEvents: [
        {
          id: 'EVT-AA',
          action: 'DOCUMENT_UPDATED',
          target: 'DOC-CTRL-002',
        },
      ],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test AB: duplicate audit event ID -> lock
runTest('Test AB: duplicate audit event ID -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    ws.writeJournal({
      operationId: 'op-ab',
      phase: 'COMMITTED',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'EVT-DUP',
    });
    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [
        { id: 'EVT-DUP', action: 'DOCUMENT_UPDATED', target: 'DOC-CTRL-002' },
        { id: 'EVT-DUP', action: 'DOCUMENT_UPDATED', target: 'DOC-CTRL-002' },
      ],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test AC: committed target SHA mismatch -> lock
runTest('Test AC: committed target SHA mismatch -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    // Disk target has unrelated content
    fs.writeFileSync(ws.targetDiskPath, 'corrupted committed target content');
    ws.writeJournal({
      operationId: 'op-ac',
      phase: 'COMMITTED',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'EVT-AC',
    });
    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [{ id: 'EVT-AC', action: 'DOCUMENT_UPDATED', target: 'DOC-CTRL-002' }],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test AD: candidate cleanup artifact hash mismatch -> lock
runTest('Test AD: candidate cleanup artifact hash mismatch -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    ws.writeJournal({
      operationId: 'op-ad',
      phase: 'COMMITTED',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'EVT-AD',
    });
    ws.writeCandidateFile('op-ad', Buffer.from('corrupt candidate bytes'));
    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [{ id: 'EVT-AD', action: 'DOCUMENT_UPDATED', target: 'DOC-CTRL-002' }],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test AE: rollback cleanup artifact hash mismatch -> lock
runTest('Test AE: rollback cleanup artifact hash mismatch -> lock', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    ws.writeJournal({
      operationId: 'op-ae',
      phase: 'COMMITTED',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'EVT-AE',
    });
    ws.writeRollbackFile('op-ae', Buffer.from('corrupt rollback bytes'));
    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [{ id: 'EVT-AE', action: 'DOCUMENT_UPDATED', target: 'DOC-CTRL-002' }],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
  } finally {
    ws.cleanup();
  }
});

// Test AF: partial cleanup missing artifacts accepted for committed phase
runTest('Test AF: partial cleanup missing artifacts accepted for committed phase', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const jPath = ws.writeJournal({
      operationId: 'op-af',
      phase: 'COMMITTED',
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'EVT-AF',
    });
    // Candidate and rollback are already unlinked! Only journal remains.
    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [{ id: 'EVT-AF', action: 'DOCUMENT_UPDATED', target: 'DOC-CTRL-002' }],
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.cleanedCount, 1);
    assert.strictEqual(report.locked, false);
    assert.strictEqual(fs.existsSync(jPath), false);
  } finally {
    ws.cleanup();
  }
});

// Test AG: journal deleted last
runTest('Test AG: journal deleted last', () => {
  const ws = createRecoveryTestWorkspace();
  const origUnlink = fs.unlinkSync;
  let journalUnlinkedLast = false;
  try {
    const jPath = ws.writeJournal({ operationId: 'op-ag', phase: 'PREPARED' });
    const cPath = ws.writeCandidateFile('op-ag');
    const rPath = ws.writeRollbackFile('op-ag');

    (fs as any).unlinkSync = function (filepath: string) {
      if (typeof filepath === 'string' && filepath.endsWith('.json')) {
        // At the moment journal is unlinked, siblings must already be unlinked
        if (!fs.existsSync(cPath) && !fs.existsSync(rPath)) {
          journalUnlinkedLast = true;
        }
      }
      return origUnlink.apply(fs, arguments as any);
    };

    recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(journalUnlinkedLast, true, 'Journal was deleted last');
  } finally {
    (fs as any).unlinkSync = origUnlink;
    ws.cleanup();
  }
});

// Test AH: cleanup failure retains journal + locks
runTest('Test AH: cleanup failure retains journal + locks', () => {
  const ws = createRecoveryTestWorkspace();
  const origUnlink = fs.unlinkSync;
  try {
    const jPath = ws.writeJournal({ operationId: 'op-ah', phase: 'PREPARED' });
    ws.writeCandidateFile('op-ah');
    ws.writeRollbackFile('op-ah');

    (fs as any).unlinkSync = function (filepath: string) {
      if (typeof filepath === 'string' && filepath.endsWith('.candidate')) {
        throw new Error('SIMULATED_UNLINK_ERROR');
      }
      return origUnlink.apply(fs, arguments as any);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.cleanedCount, 0);
    assert(fs.existsSync(jPath), 'Journal file retained on cleanup failure');
  } finally {
    (fs as any).unlinkSync = origUnlink;
    ws.cleanup();
  }
});

// Test AI: two-pass global fail-closed: one safe + one corrupt -> zero mutation
runTest('Test AI: two-pass global fail-closed: one safe + one corrupt -> zero mutation', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    // Journal 1: would be safely recoverable (PREPARED)
    const j1 = ws.writeJournal({ operationId: 'op-safe', phase: 'PREPARED' });
    const c1 = ws.writeCandidateFile('op-safe');
    const r1 = ws.writeRollbackFile('op-safe');

    // Journal 2: corrupt JSON
    const j2 = path.join(ws.journalDir, 'op-corrupt.json');
    fs.writeFileSync(j2, '{ corrupt syntax...', 'utf8');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.recoveredCount, 0);
    assert.strictEqual(report.cleanedCount, 0);

    // Absolutely zero mutations occurred: safe transaction files are still on disk!
    assert.strictEqual(fs.existsSync(j1), true, 'Safe journal retained due to global fail-closed');
    assert.strictEqual(fs.existsSync(c1), true, 'Candidate sibling retained');
    assert.strictEqual(fs.existsSync(r1), true, 'Rollback sibling retained');
    assert.strictEqual(fs.existsSync(j2), true, 'Corrupt journal retained');
  } finally {
    ws.cleanup();
  }
});

// Test AJ: recovery lock assertion behavior
runTest('Test AJ: recovery lock assertion behavior', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const badFile = path.join(ws.journalDir, 'bad.json');
    fs.writeFileSync(badFile, '{ bad', 'utf8');

    recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(isDocumentTransactionsLocked(), true);
    assert.throws(
      () => assertDocumentTransactionsUnlocked(),
      (err: any) => err.message.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')
    );
  } finally {
    ws.cleanup();
  }
});

// Test AK: lock clears only after subsequent fully clean recovery
runTest('Test AK: lock clears only after subsequent fully clean recovery', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const badFile = path.join(ws.journalDir, 'bad.json');
    fs.writeFileSync(badFile, '{ bad', 'utf8');

    const rep1 = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(rep1.locked, true);
    assert.strictEqual(isDocumentTransactionsLocked(), true);

    // Repair condition: remove bad journal
    fs.unlinkSync(badFile);

    // Fresh recovery scan
    const rep2 = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(rep2.locked, false);
    assert.strictEqual(isDocumentTransactionsLocked(), false);
    assert.doesNotThrow(() => assertDocumentTransactionsUnlocked());
  } finally {
    ws.cleanup();
  }
});

// Test AL: orphan .tmp transaction journal artifact -> locked
runTest('Test AL: orphan .tmp transaction journal artifact -> locked', () => {
  const ws = createRecoveryTestWorkspace();
  try {
    const tmpFile = path.join(ws.journalDir, '.tmp-op-crash-123456');
    fs.writeFileSync(tmpFile, 'partial temp bytes', 'utf8');

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
    assert(fs.existsSync(tmpFile), 'Temp artifact preserved for inspection');
  } finally {
    ws.cleanup();
  }
});

// Test AM: server startup wiring occurs before installProjectPersistence
runTest('Test AM: server startup wiring occurs before installProjectPersistence', () => {
  const serverSource = fs.readFileSync(path.join(REAL_WORKSPACE_ROOT, 'server.ts'), 'utf8');
  assert(
    serverSource.includes("import { recoverDocumentTransactions } from './server/docs/controlledDocsRecovery.ts';") ||
    serverSource.includes('import { recoverDocumentTransactions } from "./server/docs/controlledDocsRecovery.ts";'),
    'server.ts imports recoverDocumentTransactions'
  );

  const recoveryCallIndex = serverSource.indexOf('recoverDocumentTransactions(');
  const persistenceInstallIndex = serverSource.indexOf('installProjectPersistence(');

  assert(recoveryCallIndex !== -1, 'recoverDocumentTransactions is called in server.ts');
  assert(persistenceInstallIndex !== -1, 'installProjectPersistence is called in server.ts');
  assert(
    recoveryCallIndex < persistenceInstallIndex,
    'recoverDocumentTransactions must be called before installProjectPersistence'
  );
});

// Test AN: real repository remains pristine
runTest('Test AN: real repository remains pristine', () => {
  const realJournalDir = path.join(REAL_WORKSPACE_ROOT, '.local', 'document-transactions');
  if (fs.existsSync(realJournalDir)) {
    const files = fs.readdirSync(realJournalDir);
    assert.strictEqual(files.length, 0, 'Real .local/document-transactions/ must be empty');
  }

  const realDocs00 = path.join(REAL_WORKSPACE_ROOT, 'docs', '00_control');
  if (fs.existsSync(realDocs00)) {
    const files = fs.readdirSync(realDocs00);
    const siblings = files.filter(f => f.includes('.candidate') || f.includes('.rollback'));
    assert.strictEqual(siblings.length, 0, 'No candidate or rollback siblings in real repo');
  }
});

// Test AO: rollback artifact swap between Pass 1 and Pass 2 prevents rollback and locks recovery
runTest('Test AO: rollback artifact swap between Pass 1 and Pass 2 prevents rollback and locks recovery', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-swap-rollback';
  const originalReadFileSync = fs.readFileSync;
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const rollbackPath = ws.writeRollbackFile(opId, ws.previousBytes);
    ws.writeCandidateFile(opId, ws.candidateBytes);
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'DOCUMENT_REPLACED',
      previousSha256: ws.previousSha256,
      candidateSha256: ws.candidateSha256,
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId: 'evt-swap-rollback',
    });

    let rollbackReads = 0;
    (fs as any).readFileSync = function (filePath: any, ...args: any[]) {
      if (filePath === rollbackPath) {
        rollbackReads++;
        if (rollbackReads === 1) {
          // Pass 1 inspection reads valid bytes, but we simulate disk tampering before Pass 2
          fs.writeFileSync(rollbackPath, Buffer.from('corrupted rollback tampered bytes', 'utf8'));
          return ws.previousBytes;
        }
      }
      return originalReadFileSync.apply(this, [filePath, ...args]);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true, 'Report must be locked');
    assert.strictEqual(report.recoveredCount, 0, 'Zero rollbacks executed');
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));

    // Target must NOT have been overwritten by corrupt rollback artifact
    const targetContent = originalReadFileSync.call(fs, ws.targetDiskPath);
    assert(targetContent.equals(ws.candidateBytes), 'Target must remain candidate bytes');
    assert(fs.existsSync(rollbackPath), 'Corrupt rollback artifact remains on disk');
    assert(fs.existsSync(journalPath), 'Journal remains on disk');
  } finally {
    (fs as any).readFileSync = originalReadFileSync;
    ws.cleanup();
  }
});

// Test AP: clean PREPARED target swap between Pass 1 and Pass 2 prevents cleanup and locks recovery
runTest('Test AP: clean PREPARED target swap between Pass 1 and Pass 2 prevents cleanup and locks recovery', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-swap-prep-target';
  const originalReadFileSync = fs.readFileSync;
  try {
    const candidatePath = ws.writeCandidateFile(opId, ws.candidateBytes);
    const rollbackPath = ws.writeRollbackFile(opId, ws.previousBytes);
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'PREPARED',
      previousSha256: ws.previousSha256,
      candidateSha256: ws.candidateSha256,
    });

    let targetReads = 0;
    (fs as any).readFileSync = function (filePath: any, ...args: any[]) {
      if (filePath === ws.targetDiskPath) {
        targetReads++;
        if (targetReads === 1) {
          // Pass 1 inspection reads previous bytes, but we alter target before Pass 2
          fs.writeFileSync(ws.targetDiskPath, Buffer.from('externally altered target bytes', 'utf8'));
          return ws.previousBytes;
        }
      }
      return originalReadFileSync.apply(this, [filePath, ...args]);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true, 'Report must be locked');
    assert.strictEqual(report.cleanedCount, 0, 'Zero cleanups executed');
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));

    // All artifacts and modified target preserved
    assert(fs.existsSync(candidatePath), 'Candidate artifact preserved');
    assert(fs.existsSync(rollbackPath), 'Rollback artifact preserved');
    assert(fs.existsSync(journalPath), 'Journal preserved');
    const targetAfter = originalReadFileSync.call(fs, ws.targetDiskPath, 'utf8');
    assert.strictEqual(targetAfter, 'externally altered target bytes');
  } finally {
    (fs as any).readFileSync = originalReadFileSync;
    ws.cleanup();
  }
});

// Test AQ: clean PREPARED candidate artifact swap between Pass 1 and Pass 2 prevents cleanup and locks recovery
runTest('Test AQ: clean PREPARED candidate artifact swap between Pass 1 and Pass 2 prevents cleanup and locks recovery', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-swap-prep-cand';
  const originalReadFileSync = fs.readFileSync;
  try {
    const candidatePath = ws.writeCandidateFile(opId, ws.candidateBytes);
    const rollbackPath = ws.writeRollbackFile(opId, ws.previousBytes);
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'PREPARED',
      previousSha256: ws.previousSha256,
      candidateSha256: ws.candidateSha256,
    });

    let candReads = 0;
    (fs as any).readFileSync = function (filePath: any, ...args: any[]) {
      if (filePath === candidatePath) {
        candReads++;
        if (candReads === 1) {
          fs.writeFileSync(candidatePath, Buffer.from('tampered candidate bytes', 'utf8'));
          return ws.candidateBytes;
        }
      }
      return originalReadFileSync.apply(this, [filePath, ...args]);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true, 'Report must be locked');
    assert.strictEqual(report.cleanedCount, 0, 'Zero cleanups executed');
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));

    assert(fs.existsSync(candidatePath), 'Candidate artifact preserved');
    assert(fs.existsSync(rollbackPath), 'Rollback artifact preserved');
    assert(fs.existsSync(journalPath), 'Journal preserved');
  } finally {
    (fs as any).readFileSync = originalReadFileSync;
    ws.cleanup();
  }
});

// Test AR: clean COMMITTED target swap between Pass 1 and Pass 2 prevents cleanup and locks recovery
runTest('Test AR: clean COMMITTED target swap between Pass 1 and Pass 2 prevents cleanup and locks recovery', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-swap-com-target';
  const originalReadFileSync = fs.readFileSync;
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const candidatePath = ws.writeCandidateFile(opId, ws.candidateBytes);
    const rollbackPath = ws.writeRollbackFile(opId, ws.previousBytes);
    const auditEventId = 'evt-swap-com-target';
    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [
        {
          id: auditEventId,
          action: 'DOCUMENT_UPDATED',
          target: 'DOC-CTRL-002',
          details: {
            previousSha256: ws.previousSha256,
            newSha256: ws.candidateSha256,
            path: ws.targetRelPath,
          },
        },
      ],
    });
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'COMMITTED',
      previousSha256: ws.previousSha256,
      candidateSha256: ws.candidateSha256,
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId,
    });

    let targetReads = 0;
    (fs as any).readFileSync = function (filePath: any, ...args: any[]) {
      if (filePath === ws.targetDiskPath) {
        targetReads++;
        if (targetReads === 1) {
          fs.writeFileSync(ws.targetDiskPath, Buffer.from('externally altered committed target', 'utf8'));
          return ws.candidateBytes;
        }
      }
      return originalReadFileSync.apply(this, [filePath, ...args]);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true, 'Report must be locked');
    assert.strictEqual(report.cleanedCount, 0, 'Zero cleanups executed');
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));

    assert(fs.existsSync(candidatePath), 'Candidate artifact preserved');
    assert(fs.existsSync(rollbackPath), 'Rollback artifact preserved');
    assert(fs.existsSync(journalPath), 'Journal preserved');
    const targetAfter = originalReadFileSync.call(fs, ws.targetDiskPath, 'utf8');
    assert.strictEqual(targetAfter, 'externally altered committed target');
  } finally {
    (fs as any).readFileSync = originalReadFileSync;
    ws.cleanup();
  }
});

// Test AS: clean COMMITTED rollback artifact swap between Pass 1 and Pass 2 prevents cleanup and locks recovery
runTest('Test AS: clean COMMITTED rollback artifact swap between Pass 1 and Pass 2 prevents cleanup and locks recovery', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-swap-com-roll';
  const originalReadFileSync = fs.readFileSync;
  try {
    fs.writeFileSync(ws.targetDiskPath, ws.candidateBytes);
    const candidatePath = ws.writeCandidateFile(opId, ws.candidateBytes);
    const rollbackPath = ws.writeRollbackFile(opId, ws.previousBytes);
    const auditEventId = 'evt-swap-com-roll';
    ws.writeSnapshot({
      stateVersion: 32,
      auditEvents: [
        {
          id: auditEventId,
          action: 'DOCUMENT_UPDATED',
          target: 'DOC-CTRL-002',
          details: {
            previousSha256: ws.previousSha256,
            newSha256: ws.candidateSha256,
            path: ws.targetRelPath,
          },
        },
      ],
    });
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'COMMITTED',
      previousSha256: ws.previousSha256,
      candidateSha256: ws.candidateSha256,
      stateVersionBefore: 31,
      stateVersionExpectedAfter: 32,
      auditEventId,
    });

    let rollReads = 0;
    (fs as any).readFileSync = function (filePath: any, ...args: any[]) {
      if (filePath === rollbackPath) {
        rollReads++;
        if (rollReads === 1) {
          fs.writeFileSync(rollbackPath, Buffer.from('tampered rollback artifact bytes', 'utf8'));
          return ws.previousBytes;
        }
      }
      return originalReadFileSync.apply(this, [filePath, ...args]);
    };

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true, 'Report must be locked');
    assert.strictEqual(report.cleanedCount, 0, 'Zero cleanups executed');
    assert(report.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));

    assert(fs.existsSync(rollbackPath), 'Rollback artifact preserved');
    assert(fs.existsSync(journalPath), 'Journal preserved');
  } finally {
    (fs as any).readFileSync = originalReadFileSync;
    ws.cleanup();
  }
});

// Test AT: non-regular target (directory) fails closed without TypeError
runTest('Test AT: non-regular target (directory) fails closed without TypeError', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-dir-target';
  try {
    // Replace target file with a directory
    fs.rmSync(ws.targetDiskPath, { recursive: true, force: true });
    fs.mkdirSync(ws.targetDiskPath);

    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'PREPARED',
    });

    let report: RecoveryReport | undefined;
    assert.doesNotThrow(() => {
      report = recoverDocumentTransactions(ws.workspaceDir);
    }, 'Non-regular target must not throw uncaught TypeError');

    assert.strictEqual(report?.locked, true);
    assert(report?.ambiguousCount! >= 1);
    assert(report?.errors.some(e => e.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')));
    assert(fs.existsSync(journalPath), 'Journal preserved');
  } finally {
    ws.cleanup();
  }
});

// Test AU: schema rejects numeric projectStateBeforeDigest
runTest('Test AU: schema rejects numeric projectStateBeforeDigest', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-schema-num-digest';
  try {
    ws.writeCandidateFile(opId, ws.candidateBytes);
    ws.writeRollbackFile(opId, ws.previousBytes);
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'PREPARED',
      projectStateBeforeDigest: 123 as any,
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('projectStateBeforeDigest')));
    assert(fs.existsSync(journalPath));
  } finally {
    ws.cleanup();
  }
});

// Test AV: schema rejects object projectStateBeforeDigest
runTest('Test AV: schema rejects object projectStateBeforeDigest', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-schema-obj-digest';
  try {
    ws.writeCandidateFile(opId, ws.candidateBytes);
    ws.writeRollbackFile(opId, ws.previousBytes);
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'PREPARED',
      projectStateBeforeDigest: { sha: 'abc' } as any,
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('projectStateBeforeDigest')));
    assert(fs.existsSync(journalPath));
  } finally {
    ws.cleanup();
  }
});

// Test AW: schema rejects numeric createdAt
runTest('Test AW: schema rejects numeric createdAt', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-schema-num-created';
  try {
    ws.writeCandidateFile(opId, ws.candidateBytes);
    ws.writeRollbackFile(opId, ws.previousBytes);
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'PREPARED',
      createdAt: 2026 as any,
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('createdAt')));
    assert(fs.existsSync(journalPath));
  } finally {
    ws.cleanup();
  }
});

// Test AX: schema rejects numeric updatedAt
runTest('Test AX: schema rejects numeric updatedAt', () => {
  const ws = createRecoveryTestWorkspace();
  const opId = 'op-schema-num-updated';
  try {
    ws.writeCandidateFile(opId, ws.candidateBytes);
    ws.writeRollbackFile(opId, ws.previousBytes);
    const journalPath = ws.writeJournal({
      operationId: opId,
      phase: 'PREPARED',
      updatedAt: 2026 as any,
    });

    const report = recoverDocumentTransactions(ws.workspaceDir);
    assert.strictEqual(report.locked, true);
    assert.strictEqual(report.ambiguousCount, 1);
    assert(report.errors.some(e => e.includes('updatedAt')));
    assert(fs.existsSync(journalPath));
  } finally {
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
