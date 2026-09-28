import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ControlledDocumentRecord } from '../../src/types.ts';
import {
  resolveDocumentDiskPath,
  assertEditableTargetNotSymlink,
  readDocumentDisk,
  encodeDocumentBytes,
  deriveSiblingCandidatePath,
  deriveSiblingRollbackPath,
  writeSiblingFileAtomic,
  replaceDocumentSiblingAtomic,
  rollbackDocumentSiblingAtomic,
  unlinkSiblingSafe,
} from './controlledDocsPersistence.ts';

export type DocumentTransactionPhase =
  | 'PREPARED'
  | 'DOCUMENT_REPLACED'
  | 'COMMITTED'
  | 'COMMITTED_CLEANUP_PENDING';

export interface DocumentTransactionJournal {
  operationId: string;
  projectId: string;
  documentId: string;
  targetPath: string;
  candidateArtifactPath: string;
  rollbackArtifactPath: string;
  previousSha256: string;
  candidateSha256: string;
  projectStateBeforeDigest: string | null;
  stateVersionBefore: number;
  stateVersionExpectedAfter: number;
  auditEventId: string;
  phase: DocumentTransactionPhase;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTransactionCoordinator {
  operationId: string;
  candidatePath: string;
  rollbackPath: string;
  journalPath: string;
  executeReplacement: () => { previousSha256: string; newSha256: string; candidateBytes: Buffer };
  handleCommitSuccess: () => void;
  handleRollback: (error: unknown) => void;
}

/**
 * In-process write lock tracker keyed by canonical absolute target disk path.
 * Guarantees only one active transaction per target document across the process.
 */
const activeLocks = new Set<string>();

/**
 * Checks if a target document path currently holds an active transaction lock.
 */
export function isDocumentLocked(targetDiskPath: string): boolean {
  return activeLocks.has(path.resolve(targetDiskPath));
}

/**
 * Resets active transaction locks for test isolation.
 */
export function resetDocumentLocksForTesting(): void {
  activeLocks.clear();
}

/**
 * Durably writes transaction journal to disk via temporary sibling file, fsync, and atomic rename.
 */
function writeDurableJournal(journalPath: string, journal: DocumentTransactionJournal): void {
  const dir = path.dirname(journalPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.tmp-${journal.operationId}-${crypto.randomBytes(6).toString('hex')}`);
  const jsonContent = JSON.stringify(journal, null, 2) + '\n';
  const buf = Buffer.from(jsonContent, 'utf8');
  const fd = fs.openSync(tmpPath, 'w');
  let renamed = false;
  try {
    let offset = 0;
    while (offset < buf.length) {
      const written = fs.writeSync(fd, buf, offset, buf.length - offset);
      if (written <= 0) {
        throw new Error('JOURNAL_WRITE_INCOMPLETE: filesystem made no forward write progress');
      }
      offset += written;
    }
    fs.fdatasyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmpPath, journalPath);
    renamed = true;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // already closed
    }
    if (!renamed) {
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {
        // ignore temp unlink error
      }
    }
  }
}

/**
 * Prepares a cross-domain document transaction conforming to approved DMK-195 specifications.
 * Enforces strict fail-closed safety, in-process target locking, base hash verification,
 * durable rollback/candidate sibling writes, and PREPARED journal creation.
 */
export function prepareDocumentTransaction(params: {
  projectId: string;
  documentId: string;
  docRecord: ControlledDocumentRecord;
  candidateContent: string;
  baseSha256: string;
  projectStateBeforeDigest: string | null;
  stateVersionBefore: number;
  auditEventId: string;
  workspaceRoot?: string;
}): DocumentTransactionCoordinator {
  const workspaceRoot = params.workspaceRoot || process.cwd();

  // 1. Authoritative editability check
  if (params.docRecord.editability !== 'CONTROLLED_EDIT') {
    throw new Error('DOCUMENT_READ_ONLY: Document is not configured for controlled editing');
  }

  // 2. Identity match check
  if (params.documentId !== params.docRecord.id) {
    throw new Error('DOCUMENT_ID_MISMATCH: Provided document ID does not match record');
  }

  // 3. Resolve disk target & verify not symlink
  const { diskPath: targetDiskPath } = resolveDocumentDiskPath(params.docRecord, workspaceRoot);
  assertEditableTargetNotSymlink(targetDiskPath);

  // 4. Acquire canonical in-process lock
  const canonicalKey = path.resolve(targetDiskPath);
  if (activeLocks.has(canonicalKey)) {
    throw new Error('DOCUMENT_TRANSACTION_BUSY: Document is currently undergoing another transaction');
  }
  activeLocks.add(canonicalKey);

  let lockHeld = true;
  let candidatePath: string | null = null;
  let rollbackPath: string | null = null;
  let journalPath: string | null = null;

  try {
    // 5. Authoritative live disk read
    const liveRead = readDocumentDisk(params.docRecord, workspaceRoot);
    if (!liveRead.exists || !liveRead.rawBytes || !liveRead.rawSha256) {
      throw new Error('DOCUMENT_MISSING: Controlled document file does not exist on disk');
    }

    // 6. Stale base hash check under lock
    if (liveRead.rawSha256 !== params.baseSha256) {
      throw new Error('DOCUMENT_STALE: Base hash does not match current on-disk document hash');
    }

    // 7. EOL style preservation and candidate encoding
    const candidateBytes = encodeDocumentBytes(params.candidateContent, liveRead.eol);
    const candidateSha256 = crypto.createHash('sha256').update(candidateBytes).digest('hex');

    // 8. Generate operationId and derive sibling & journal paths
    const operationId = crypto.randomUUID();
    rollbackPath = deriveSiblingRollbackPath(targetDiskPath, operationId);
    candidatePath = deriveSiblingCandidatePath(targetDiskPath, operationId);
    const journalDir = path.resolve(workspaceRoot, '.local', 'document-transactions');
    journalPath = path.join(journalDir, `${operationId}.json`);

    // 9. Write durable rollback sibling
    writeSiblingFileAtomic(rollbackPath, liveRead.rawBytes);

    // 10. Write durable candidate sibling
    writeSiblingFileAtomic(candidatePath, candidateBytes);

    // 11. Create and write durable PREPARED journal
    const targetPathRel = path.relative(workspaceRoot, targetDiskPath).replace(/\\/g, '/');
    const candidateRel = path.relative(workspaceRoot, candidatePath).replace(/\\/g, '/');
    const rollbackRel = path.relative(workspaceRoot, rollbackPath).replace(/\\/g, '/');
    const nowIso = new Date().toISOString();

    const journal: DocumentTransactionJournal = {
      operationId,
      projectId: params.projectId,
      documentId: params.documentId,
      targetPath: targetPathRel,
      candidateArtifactPath: candidateRel,
      rollbackArtifactPath: rollbackRel,
      previousSha256: liveRead.rawSha256,
      candidateSha256,
      projectStateBeforeDigest: params.projectStateBeforeDigest,
      stateVersionBefore: params.stateVersionBefore,
      stateVersionExpectedAfter: params.stateVersionBefore + 1,
      auditEventId: params.auditEventId,
      phase: 'PREPARED',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    writeDurableJournal(journalPath, journal);

    let replacementApplied = false;

    const coordinator: DocumentTransactionCoordinator = {
      operationId,
      candidatePath,
      rollbackPath,
      journalPath,

      executeReplacement: () => {
        if (journal.phase !== 'PREPARED') {
          throw new Error(`DOCUMENT_TRANSACTION_INVALID_PHASE: Cannot execute replacement from phase ${journal.phase}`);
        }

        // Pre-rename TOCTOU check: verify target file on disk still matches previousSha256
        const currentTargetBytes = fs.readFileSync(targetDiskPath);
        const currentTargetSha = crypto.createHash('sha256').update(currentTargetBytes).digest('hex');
        if (currentTargetSha !== journal.previousSha256) {
          unlinkSiblingSafe(candidatePath!);
          unlinkSiblingSafe(rollbackPath!);
          unlinkSiblingSafe(journalPath!);
          activeLocks.delete(canonicalKey);
          lockHeld = false;
          throw new Error('DOCUMENT_STALE: Target document was modified on disk prior to replacement');
        }

        // Same-filesystem atomic rename
        replaceDocumentSiblingAtomic(candidatePath!, targetDiskPath);
        replacementApplied = true;

        // Advance journal durably
        journal.phase = 'DOCUMENT_REPLACED';
        journal.updatedAt = new Date().toISOString();
        writeDurableJournal(journalPath!, journal);

        return {
          previousSha256: journal.previousSha256,
          newSha256: journal.candidateSha256,
          candidateBytes,
        };
      },

      handleRollback: (_error: unknown) => {
        if (!replacementApplied) {
          // Prepared phase rollback: verify live target document remains uncorrupted
          let targetMatches = false;
          try {
            if (fs.existsSync(targetDiskPath)) {
              const currentTargetBytes = fs.readFileSync(targetDiskPath);
              const currentTargetSha = crypto.createHash('sha256').update(currentTargetBytes).digest('hex');
              if (currentTargetSha === journal.previousSha256) {
                targetMatches = true;
              }
            }
          } catch {
            targetMatches = false;
          }

          if (!targetMatches) {
            throw new Error('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Live document state corrupted or altered during prepared rollback');
          }

          unlinkSiblingSafe(candidatePath!);
          unlinkSiblingSafe(rollbackPath!);
          unlinkSiblingSafe(journalPath!);
          activeLocks.delete(canonicalKey);
          lockHeld = false;
          return;
        }

        // Replacement applied: restore target from rollback sibling
        if (!fs.existsSync(rollbackPath!)) {
          throw new Error('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Rollback artifact missing');
        }

        const rollbackBytes = fs.readFileSync(rollbackPath!);
        const rollbackSha = crypto.createHash('sha256').update(rollbackBytes).digest('hex');
        if (rollbackSha !== journal.previousSha256) {
          throw new Error('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Rollback artifact corrupt or does not match previousSha256');
        }

        try {
          rollbackDocumentSiblingAtomic(rollbackPath!, targetDiskPath);
        } catch (renameErr) {
          throw new Error(
            'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Failed to atomically restore target document: ' +
              (renameErr instanceof Error ? renameErr.message : String(renameErr))
          );
        }

        const restoredBytes = fs.readFileSync(targetDiskPath);
        const restoredSha = crypto.createHash('sha256').update(restoredBytes).digest('hex');
        if (restoredSha !== journal.previousSha256) {
          throw new Error('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Restored target document SHA-256 does not match previousSha256');
        }

        unlinkSiblingSafe(candidatePath!);
        unlinkSiblingSafe(journalPath!);
        activeLocks.delete(canonicalKey);
        lockHeld = false;
      },

      handleCommitSuccess: () => {
        if (journal.phase === 'PREPARED') {
          throw new Error('DOCUMENT_TRANSACTION_INVALID_PHASE: Cannot commit prepared transaction before replacement');
        }

        if (journal.phase === 'DOCUMENT_REPLACED') {
          journal.phase = 'COMMITTED';
          journal.updatedAt = new Date().toISOString();
          writeDurableJournal(journalPath!, journal);
        }

        try {
          unlinkSiblingSafe(candidatePath!);
          unlinkSiblingSafe(rollbackPath!);
          unlinkSiblingSafe(journalPath!);
          activeLocks.delete(canonicalKey);
          lockHeld = false;
        } catch (cleanupErr) {
          try {
            journal.phase = 'COMMITTED_CLEANUP_PENDING';
            journal.updatedAt = new Date().toISOString();
            writeDurableJournal(journalPath!, journal);
          } catch {
            // ignore secondary journal write error
          }
          throw new Error(
            `COMMITTED_CLEANUP_PENDING: Post-commit artifact cleanup failed: ${
              cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
            }`
          );
        }
      },
    };

    return coordinator;
  } catch (err) {
    if (candidatePath) unlinkSiblingSafe(candidatePath);
    if (rollbackPath) unlinkSiblingSafe(rollbackPath);
    if (journalPath) unlinkSiblingSafe(journalPath);
    if (lockHeld) {
      activeLocks.delete(canonicalKey);
    }
    throw err;
  }
}
