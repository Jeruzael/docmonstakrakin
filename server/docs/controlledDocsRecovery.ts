import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { findControlledDoc } from './controlledDocsRegistry.ts';
import {
  resolveDocumentDiskPath,
  deriveSiblingCandidatePath,
  deriveSiblingRollbackPath,
  rollbackDocumentSiblingAtomic,
  unlinkSiblingSafe,
} from './controlledDocsPersistence.ts';
import { readProjectSnapshot } from '../projectPersistence.ts';
import type {
  DocumentTransactionJournal,
  DocumentTransactionPhase,
} from './controlledDocsTransaction.ts';

export interface RecoveryReport {
  recoveredCount: number;
  cleanedCount: number;
  ambiguousCount: number;
  errors: string[];
  locked: boolean;
}

type RecoveryAction =
  | {
      kind: 'CLEAN_PREPARED';
      journalPath: string;
      authoritativeTarget: string;
      candidateDiskPath: string;
      rollbackDiskPath: string;
      previousSha256: string;
      candidateSha256: string;
    }
  | {
      kind: 'ROLLBACK_REPLACED';
      journalPath: string;
      authoritativeTarget: string;
      candidateDiskPath: string;
      rollbackDiskPath: string;
      previousSha256: string;
      candidateSha256: string;
    }
  | {
      kind: 'CLEAN_COMMITTED';
      journalPath: string;
      authoritativeTarget: string;
      candidateDiskPath: string;
      rollbackDiskPath: string;
      candidateExpectedSha: string;
      rollbackExpectedSha: string;
    };

/**
 * Module-level state tracking whether controlled document mutations are locked
 * due to ambiguous or incomplete transaction recovery evidence.
 */
let recoveryLocked = false;

/**
 * Returns true if controlled document transactions are currently locked out.
 */
export function isDocumentTransactionsLocked(): boolean {
  return recoveryLocked;
}

/**
 * Asserts that controlled document transactions are unlocked.
 * Throws DOCUMENT_TRANSACTION_RECOVERY_REQUIRED if recovery is locked.
 */
export function assertDocumentTransactionsUnlocked(): void {
  if (recoveryLocked) {
    throw new Error('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Controlled document transactions are locked due to recovery state');
  }
}

interface FileInspection {
  exists: boolean;
  isSymlink: boolean;
  isFile: boolean;
  isNonRegular: boolean;
  isUnreadable: boolean;
  error?: string;
  sha?: string;
  rawBytes?: Buffer;
}

/**
 * Inspects a file path and returns its existence, symlink status, file type, raw bytes, and SHA-256 digest.
 */
function hashFile(filePath: string): FileInspection {
  let lstat: fs.Stats | undefined;
  try {
    lstat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  } catch (err: any) {
    return { exists: true, isSymlink: false, isFile: false, isNonRegular: false, isUnreadable: true, error: String(err) };
  }
  if (!lstat) {
    return { exists: false, isSymlink: false, isFile: false, isNonRegular: false, isUnreadable: false };
  }
  if (lstat.isSymbolicLink()) {
    return { exists: true, isSymlink: true, isFile: false, isNonRegular: false, isUnreadable: false };
  }
  if (!lstat.isFile()) {
    return { exists: true, isSymlink: false, isFile: false, isNonRegular: true, isUnreadable: false };
  }

  let rawBytes: Buffer;
  try {
    rawBytes = fs.readFileSync(filePath);
  } catch (err: any) {
    return { exists: true, isSymlink: false, isFile: true, isNonRegular: false, isUnreadable: true, error: String(err) };
  }
  const sha = crypto.createHash('sha256').update(rawBytes).digest('hex');
  return { exists: true, isSymlink: false, isFile: true, isNonRegular: false, isUnreadable: false, sha, rawBytes };
}

/**
 * Asserts that a file path exists, is a regular file, is not a symlink,
 * and matches the exact expected raw SHA-256 digest.
 * Throws DOCUMENT_TRANSACTION_RECOVERY_REQUIRED on any failure.
 */
function assertRegularFileHash(
  filePath: string,
  expectedSha256: string,
  label: string
): void {
  let lstat: fs.Stats | undefined;
  try {
    lstat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  } catch (err: any) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: ${label} inspection failed due to I/O error: ${filePath}: ${String(err)}`);
  }
  if (!lstat) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: ${label} missing on disk: ${filePath}`);
  }
  if (lstat.isSymbolicLink()) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: ${label} is a symbolic link: ${filePath}`);
  }
  if (!lstat.isFile()) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: ${label} is a non-regular filesystem node: ${filePath}`);
  }
  let rawBytes: Buffer;
  try {
    rawBytes = fs.readFileSync(filePath);
  } catch (err: any) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: ${label} read failed due to I/O error: ${filePath}: ${String(err)}`);
  }
  const sha = crypto.createHash('sha256').update(rawBytes).digest('hex');
  if (sha.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: ${label} hash drift: expected ${expectedSha256}, actual ${sha}`);
  }
}

/**
 * For optional cleanup artifacts: if file exists, asserts it is a regular file,
 * not a symlink, and matches the expected raw SHA-256 digest.
 * Missing file is tolerated.
 * Throws DOCUMENT_TRANSACTION_RECOVERY_REQUIRED on any failure.
 */
function assertOptionalRegularFileHash(
  filePath: string,
  expectedSha256: string,
  label: string
): void {
  let lstat: fs.Stats | undefined;
  try {
    lstat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  } catch (err: any) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Optional ${label} inspection failed due to I/O error: ${filePath}: ${String(err)}`);
  }
  if (!lstat) {
    return;
  }
  if (lstat.isSymbolicLink()) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Optional ${label} is a symbolic link: ${filePath}`);
  }
  if (!lstat.isFile()) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Optional ${label} is a non-regular filesystem node: ${filePath}`);
  }
  let rawBytes: Buffer;
  try {
    rawBytes = fs.readFileSync(filePath);
  } catch (err: any) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Optional ${label} read failed due to I/O error: ${filePath}: ${String(err)}`);
  }
  const sha = crypto.createHash('sha256').update(rawBytes).digest('hex');
  if (sha.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: Optional ${label} hash drift: expected ${expectedSha256}, actual ${sha}`);
  }
}

/**
 * Validates a parsed journal object against structural schema requirements.
 */
function validateJournalSchema(
  raw: any,
  filename: string
): { valid: true; journal: DocumentTransactionJournal } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: `Invalid journal JSON object in ${filename}` };
  }

  const opId = raw.operationId;
  if (!opId || typeof opId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(opId)) {
    return { valid: false, error: `Invalid operationId in ${filename}` };
  }

  const baseName = path.basename(filename, '.json');
  if (baseName !== opId) {
    return { valid: false, error: `Filename ${filename} does not match operationId ${opId}` };
  }

  if (raw.projectId !== 'PRJ-DOCMONSTAKRAKIN') {
    return { valid: false, error: `Invalid or untrusted projectId '${raw.projectId}' in ${filename}` };
  }

  if (!raw.documentId || typeof raw.documentId !== 'string') {
    return { valid: false, error: `Missing or invalid documentId in ${filename}` };
  }

  if (!raw.targetPath || typeof raw.targetPath !== 'string') {
    return { valid: false, error: `Missing targetPath in ${filename}` };
  }

  if (!raw.candidateArtifactPath || typeof raw.candidateArtifactPath !== 'string') {
    return { valid: false, error: `Missing candidateArtifactPath in ${filename}` };
  }

  if (!raw.rollbackArtifactPath || typeof raw.rollbackArtifactPath !== 'string') {
    return { valid: false, error: `Missing rollbackArtifactPath in ${filename}` };
  }

  if (!raw.previousSha256 || !/^[0-9a-fA-F]{64}$/.test(raw.previousSha256)) {
    return { valid: false, error: `Invalid previousSha256 in ${filename}` };
  }

  if (!raw.candidateSha256 || !/^[0-9a-fA-F]{64}$/.test(raw.candidateSha256)) {
    return { valid: false, error: `Invalid candidateSha256 in ${filename}` };
  }

  if (
    raw.projectStateBeforeDigest !== null &&
    typeof raw.projectStateBeforeDigest !== 'string'
  ) {
    return { valid: false, error: `Invalid projectStateBeforeDigest in ${filename}` };
  }

  if (
    typeof raw.stateVersionBefore !== 'number' ||
    !Number.isInteger(raw.stateVersionBefore) ||
    raw.stateVersionBefore < 0
  ) {
    return { valid: false, error: `Invalid stateVersionBefore in ${filename}` };
  }

  if (
    typeof raw.stateVersionExpectedAfter !== 'number' ||
    !Number.isInteger(raw.stateVersionExpectedAfter) ||
    raw.stateVersionExpectedAfter !== raw.stateVersionBefore + 1
  ) {
    return { valid: false, error: `Invalid stateVersionExpectedAfter in ${filename}` };
  }

  if (!raw.auditEventId || typeof raw.auditEventId !== 'string') {
    return { valid: false, error: `Missing auditEventId in ${filename}` };
  }

  const validPhases: DocumentTransactionPhase[] = [
    'PREPARED',
    'DOCUMENT_REPLACED',
    'COMMITTED',
    'COMMITTED_CLEANUP_PENDING',
  ];
  if (!validPhases.includes(raw.phase)) {
    return { valid: false, error: `Invalid phase '${raw.phase}' in ${filename}` };
  }

  if (typeof raw.createdAt !== 'string' || isNaN(Date.parse(raw.createdAt))) {
    return { valid: false, error: `Invalid createdAt in ${filename}` };
  }

  if (typeof raw.updatedAt !== 'string' || isNaN(Date.parse(raw.updatedAt))) {
    return { valid: false, error: `Invalid updatedAt in ${filename}` };
  }

  return { valid: true, journal: raw as DocumentTransactionJournal };
}

/**
 * Scans the workspace transaction journal directory and reconciles transaction evidence
 * against the authoritative registry and durable project-state snapshot.
 * Employs a strict two-pass fail-closed model: if ANY ambiguity exists across the workspace,
 * zero mutations are performed and transactions are locked.
 */
export function recoverDocumentTransactions(
  workspaceRoot: string = process.cwd()
): RecoveryReport {
  // A fresh scan resets the lock state unless an ambiguity is encountered.
  recoveryLocked = false;

  const report: RecoveryReport = {
    recoveredCount: 0,
    cleanedCount: 0,
    ambiguousCount: 0,
    errors: [],
    locked: false,
  };

  const recordAmbiguity = (msg: string) => {
    report.ambiguousCount++;
    report.errors.push(`DOCUMENT_TRANSACTION_RECOVERY_REQUIRED: ${msg}`);
    report.locked = true;
    recoveryLocked = true;
  };

  const journalDir = path.join(workspaceRoot, '.local', 'document-transactions');
  if (!fs.existsSync(journalDir)) {
    return report;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(journalDir);
  } catch (err: any) {
    recordAmbiguity(`Failed to read transaction journal directory: ${String(err)}`);
    return report;
  }

  if (entries.length === 0) {
    return report;
  }

  // Detect orphan temporary transaction journal files
  for (const entry of entries) {
    if (entry.startsWith('.tmp')) {
      recordAmbiguity(`Orphan temporary journal file discovered: ${entry}`);
    }
  }

  // Filter recognized final journal files: <operationId>.json
  const journalFiles: string[] = [];
  for (const entry of entries) {
    if (entry.startsWith('.tmp')) {
      continue;
    }
    if (!entry.endsWith('.json')) {
      recordAmbiguity(`Unrecognized non-json artifact in transaction directory: ${entry}`);
      continue;
    }
    const opId = path.basename(entry, '.json');
    if (!/^[A-Za-z0-9_-]+$/.test(opId)) {
      recordAmbiguity(`Invalid non-alphanumeric journal filename: ${entry}`);
      continue;
    }
    journalFiles.push(entry);
  }

  if (journalFiles.length === 0 && report.ambiguousCount > 0) {
    return report;
  }

  // =========================================================================
  // PASS 1: Discovery, Validation, and Classification (Zero disk mutations)
  // =========================================================================

  let snapshot: any = null;
  try {
    snapshot = readProjectSnapshot(workspaceRoot);
  } catch (err: any) {
    recordAmbiguity(`Failed to read project snapshot during recovery: ${String(err)}`);
  }

  const targetMap = new Map<string, string[]>(); // canonicalTargetKey -> operationIds
  const plannedActions: RecoveryAction[] = [];

  for (const jFile of journalFiles) {
    const jPath = path.join(journalDir, jFile);

    // Lstat check before reading: journal file must exist, be a regular file, and not a symlink
    let jStat: fs.Stats | undefined;
    try {
      jStat = fs.lstatSync(jPath, { throwIfNoEntry: false });
    } catch (err: any) {
      recordAmbiguity(`Failed to inspect journal file ${jFile}: ${String(err)}`);
      continue;
    }

    if (!jStat) {
      recordAmbiguity(`Journal file missing on disk: ${jFile}`);
      continue;
    }

    if (jStat.isSymbolicLink()) {
      recordAmbiguity(`Journal file is a symbolic link and will not be followed: ${jFile}`);
      continue;
    }

    if (!jStat.isFile()) {
      recordAmbiguity(`Journal file is not a regular file: ${jFile}`);
      continue;
    }

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(jPath, 'utf8');
    } catch (err: any) {
      recordAmbiguity(`Failed to read journal file ${jFile}: ${String(err)}`);
      continue;
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (err: any) {
      recordAmbiguity(`Malformed JSON in journal file ${jFile}: ${String(err)}`);
      continue;
    }

    const validation = validateJournalSchema(parsedJson, jFile);
    if (validation.valid === false) {
      recordAmbiguity(validation.error);
      continue;
    }

    const journal = validation.journal;

    // Authoritative registry document lookup
    let docRecord: any;
    try {
      docRecord = findControlledDoc('PRJ-DOCMONSTAKRAKIN', journal.documentId, workspaceRoot);
    } catch (err: any) {
      recordAmbiguity(`Manifest or registry lookup failure for ${journal.documentId} in ${jFile}: ${String(err)}`);
      continue;
    }

    if (!docRecord) {
      recordAmbiguity(`Document ID '${journal.documentId}' in ${jFile} is not registered in manifest`);
      continue;
    }

    if (docRecord.editability !== 'CONTROLLED_EDIT') {
      recordAmbiguity(`Document ID '${journal.documentId}' in ${jFile} is registered as READ_ONLY`);
      continue;
    }

    // Re-derive authoritative paths
    let authoritativeTarget: string;
    try {
      const resolved = resolveDocumentDiskPath(docRecord, workspaceRoot);
      authoritativeTarget = resolved.diskPath;
    } catch (err: any) {
      recordAmbiguity(`Failed to resolve authoritative path for ${journal.documentId}: ${String(err)}`);
      continue;
    }

    const expectedCandidateDisk = deriveSiblingCandidatePath(authoritativeTarget, journal.operationId);
    const expectedRollbackDisk = deriveSiblingRollbackPath(authoritativeTarget, journal.operationId);

    const expectedTargetPath = path.relative(workspaceRoot, authoritativeTarget).replace(/\\/g, '/');
    const expectedCandidateRel = path.relative(workspaceRoot, expectedCandidateDisk).replace(/\\/g, '/');
    const expectedRollbackRel = path.relative(workspaceRoot, expectedRollbackDisk).replace(/\\/g, '/');

    // Journal path tampering check
    if (
      journal.targetPath !== expectedTargetPath ||
      journal.candidateArtifactPath !== expectedCandidateRel ||
      journal.rollbackArtifactPath !== expectedRollbackRel
    ) {
      recordAmbiguity(
        `Journal path tampering detected for ${journal.operationId}: paths in journal do not match authoritative derivations`
      );
      continue;
    }

    // Duplicate target journal check
    const canonicalTargetKey = path.resolve(authoritativeTarget);
    const existingOps = targetMap.get(canonicalTargetKey) || [];
    existingOps.push(journal.operationId);
    targetMap.set(canonicalTargetKey, existingOps);

    // Authoritative target inspection
    const targetInfo = hashFile(authoritativeTarget);
    if (targetInfo.isUnreadable) {
      recordAmbiguity(`Authoritative target document could not be inspected due to I/O error: ${expectedTargetPath}: ${targetInfo.error}`);
      continue;
    }
    if (!targetInfo.exists) {
      recordAmbiguity(`Authoritative target document missing on disk: ${expectedTargetPath}`);
      continue;
    }
    if (targetInfo.isSymlink) {
      recordAmbiguity(`Authoritative target document is a symbolic link: ${expectedTargetPath}`);
      continue;
    }
    if (targetInfo.isNonRegular || !targetInfo.isFile) {
      recordAmbiguity(`Authoritative target document is a non-regular filesystem node: ${expectedTargetPath}`);
      continue;
    }
    const targetSha = targetInfo.sha!;

    // Snapshot commit evidence inspection
    let committedEvidence = false;
    if (snapshot && snapshot.state) {
      const auditLogsCollection = snapshot.state.auditLogs;
      if (auditLogsCollection !== undefined && auditLogsCollection !== null) {
        if (typeof auditLogsCollection !== 'object' || Array.isArray(auditLogsCollection)) {
          recordAmbiguity(
            `Malformed auditLogs collection in project snapshot: expected object, got ${Array.isArray(auditLogsCollection) ? 'array' : typeof auditLogsCollection}`
          );
          continue;
        }

        const projectAudits = auditLogsCollection['PRJ-DOCMONSTAKRAKIN'];
        if (projectAudits !== undefined && projectAudits !== null) {
          if (!Array.isArray(projectAudits)) {
            recordAmbiguity(`Malformed project audit log collection for PRJ-DOCMONSTAKRAKIN: expected array, got ${typeof projectAudits}`);
            continue;
          }

          const matchingAudits: any[] = [];
          for (const rawEvt of projectAudits) {
            if (!rawEvt || typeof rawEvt !== 'object') {
              continue;
            }
            if (rawEvt.id === journal.auditEventId) {
              matchingAudits.push(rawEvt);
            }
          }

          if (matchingAudits.length > 1) {
            recordAmbiguity(`Duplicate audit event ID '${journal.auditEventId}' found in project snapshot`);
            continue;
          }

          if (matchingAudits.length === 1) {
            const evt = matchingAudits[0];
            if (
              typeof evt.action !== 'string' ||
              evt.action !== 'DOCUMENT_UPDATED' ||
              typeof evt.target !== 'string' ||
              evt.target !== journal.documentId
            ) {
              recordAmbiguity(
                `Contradictory audit event details for ${journal.auditEventId}: action=${evt.action}, target=${evt.target}`
              );
              continue;
            }

            if (evt.details !== undefined && evt.details !== null) {
              if (typeof evt.details !== 'object' || Array.isArray(evt.details)) {
                recordAmbiguity(`Malformed audit event details for ${journal.auditEventId}: expected object, got ${Array.isArray(evt.details) ? 'array' : typeof evt.details}`);
                continue;
              }

              if (
                evt.details.previousSha256 &&
                evt.details.previousSha256.toLowerCase() !== journal.previousSha256.toLowerCase()
              ) {
                recordAmbiguity(`Audit event previousSha256 contradicts journal for ${journal.operationId}`);
                continue;
              }
              if (
                evt.details.newSha256 &&
                evt.details.newSha256.toLowerCase() !== journal.candidateSha256.toLowerCase()
              ) {
                recordAmbiguity(`Audit event newSha256 contradicts journal for ${journal.operationId}`);
                continue;
              }
              if (evt.details.path && evt.details.path !== docRecord.path) {
                recordAmbiguity(`Audit event path contradicts record path for ${journal.operationId}`);
                continue;
              }
            }

            const prj = snapshot.state.projects?.find((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN');
            if (
              prj &&
              typeof prj.stateVersion === 'number' &&
              Number.isInteger(prj.stateVersion) &&
              prj.stateVersion >= 0
            ) {
              if (prj.stateVersion >= journal.stateVersionExpectedAfter) {
                committedEvidence = true;
              } else {
                recordAmbiguity(
                  `Audit event exists for ${journal.operationId} but project stateVersion (${prj.stateVersion}) is less than expected (${journal.stateVersionExpectedAfter})`
                );
                continue;
              }
            } else {
              recordAmbiguity(`Project record or valid stateVersion missing in snapshot for ${journal.projectId}`);
              continue;
            }
          }
        }
      }
    }

    // Phase Classification & Invariant Evaluation
    if (journal.phase === 'PREPARED') {
      // PREPARED-Crash Ambiguity: target matches candidateSha256
      if (targetSha.toLowerCase() === journal.candidateSha256.toLowerCase()) {
        recordAmbiguity(
          `Ambiguous crash state: target document matches candidateSha256 while journal is PREPARED for ${journal.operationId}`
        );
        continue;
      }

      if (targetSha.toLowerCase() !== journal.previousSha256.toLowerCase()) {
        recordAmbiguity(
          `Target document hash matches neither previous nor candidate hash in PREPARED phase for ${journal.operationId}`
        );
        continue;
      }

      if (committedEvidence) {
        recordAmbiguity(
          `Inconsistent recovery state: PREPARED journal has committed snapshot audit evidence for ${journal.operationId}`
        );
        continue;
      }

      // Both candidate and rollback siblings must exist as valid regular files
      const candInfo = hashFile(expectedCandidateDisk);
      const rollInfo = hashFile(expectedRollbackDisk);

      if (candInfo.isUnreadable) {
        recordAmbiguity(`Candidate sibling unreadable due to I/O error for ${journal.operationId}: ${candInfo.error}`);
        continue;
      }
      if (!candInfo.exists || candInfo.isSymlink || candInfo.isNonRegular || candInfo.sha?.toLowerCase() !== journal.candidateSha256.toLowerCase()) {
        recordAmbiguity(
          `Candidate sibling missing, symlink, or corrupt for PREPARED transaction ${journal.operationId}`
        );
        continue;
      }

      if (rollInfo.isUnreadable) {
        recordAmbiguity(`Rollback sibling unreadable due to I/O error for ${journal.operationId}: ${rollInfo.error}`);
        continue;
      }
      if (!rollInfo.exists || rollInfo.isSymlink || rollInfo.isNonRegular || rollInfo.sha?.toLowerCase() !== journal.previousSha256.toLowerCase()) {
        recordAmbiguity(
          `Rollback sibling missing, symlink, or corrupt for PREPARED transaction ${journal.operationId}`
        );
        continue;
      }

      plannedActions.push({
        kind: 'CLEAN_PREPARED',
        journalPath: jPath,
        authoritativeTarget,
        candidateDiskPath: expectedCandidateDisk,
        rollbackDiskPath: expectedRollbackDisk,
        previousSha256: journal.previousSha256,
        candidateSha256: journal.candidateSha256,
      });
    } else if (journal.phase === 'DOCUMENT_REPLACED') {
      if (targetSha.toLowerCase() !== journal.candidateSha256.toLowerCase()) {
        recordAmbiguity(
          `Target document hash does not match candidateSha256 in DOCUMENT_REPLACED phase for ${journal.operationId}`
        );
        continue;
      }

      if (!committedEvidence) {
        // Safe rollback case: snapshot was not committed, revert to rollback sibling
        const rollInfo = hashFile(expectedRollbackDisk);
        if (rollInfo.isUnreadable) {
          recordAmbiguity(`Rollback artifact unreadable due to I/O error for ${journal.operationId}: ${rollInfo.error}`);
          continue;
        }
        if (!rollInfo.exists || rollInfo.isSymlink || rollInfo.isNonRegular || rollInfo.sha?.toLowerCase() !== journal.previousSha256.toLowerCase()) {
          recordAmbiguity(
            `Rollback artifact missing, symlink, or corrupt for uncommitted DOCUMENT_REPLACED transaction ${journal.operationId}`
          );
          continue;
        }

        let candLstat: fs.Stats | undefined;
        try {
          candLstat = fs.lstatSync(expectedCandidateDisk, { throwIfNoEntry: false });
        } catch (err: any) {
          recordAmbiguity(`Candidate artifact inspection I/O error for ${journal.operationId}: ${String(err)}`);
          continue;
        }
        if (candLstat && (candLstat.isSymbolicLink() || !candLstat.isFile())) {
          recordAmbiguity(
            `Candidate artifact is a symbolic link or non-regular for DOCUMENT_REPLACED transaction ${journal.operationId}`
          );
          continue;
        }

        plannedActions.push({
          kind: 'ROLLBACK_REPLACED',
          journalPath: jPath,
          authoritativeTarget,
          candidateDiskPath: expectedCandidateDisk,
          rollbackDiskPath: expectedRollbackDisk,
          previousSha256: journal.previousSha256,
          candidateSha256: journal.candidateSha256,
        });
      } else {
        // Committed replace: snapshot commit succeeded before cleanup
        const candInfo = hashFile(expectedCandidateDisk);
        if (candInfo.isUnreadable) {
          recordAmbiguity(`Candidate artifact unreadable due to I/O error for ${journal.operationId}: ${candInfo.error}`);
          continue;
        }
        if (candInfo.isSymlink || candInfo.isNonRegular || (candInfo.exists && candInfo.sha?.toLowerCase() !== journal.candidateSha256.toLowerCase())) {
          recordAmbiguity(
            `Candidate artifact corrupt or symlink in committed cleanup for ${journal.operationId}`
          );
          continue;
        }

        const rollInfo = hashFile(expectedRollbackDisk);
        if (rollInfo.isUnreadable) {
          recordAmbiguity(`Rollback artifact unreadable due to I/O error for ${journal.operationId}: ${rollInfo.error}`);
          continue;
        }
        if (rollInfo.isSymlink || rollInfo.isNonRegular || (rollInfo.exists && rollInfo.sha?.toLowerCase() !== journal.previousSha256.toLowerCase())) {
          recordAmbiguity(
            `Rollback artifact corrupt or symlink in committed cleanup for ${journal.operationId}`
          );
          continue;
        }

        plannedActions.push({
          kind: 'CLEAN_COMMITTED',
          journalPath: jPath,
          authoritativeTarget,
          candidateDiskPath: expectedCandidateDisk,
          rollbackDiskPath: expectedRollbackDisk,
          candidateExpectedSha: journal.candidateSha256,
          rollbackExpectedSha: journal.previousSha256,
        });
      }
    } else if (journal.phase === 'COMMITTED' || journal.phase === 'COMMITTED_CLEANUP_PENDING') {
      if (!committedEvidence) {
        recordAmbiguity(
          `Journal phase '${journal.phase}' requires committed snapshot evidence, but none was found for ${journal.operationId}`
        );
        continue;
      }

      if (targetSha.toLowerCase() !== journal.candidateSha256.toLowerCase()) {
        recordAmbiguity(
          `Committed target document hash does not match candidateSha256 for ${journal.operationId}`
        );
        continue;
      }

      // Check artifacts if they still exist
      const candInfo = hashFile(expectedCandidateDisk);
      if (candInfo.isUnreadable) {
        recordAmbiguity(`Candidate artifact unreadable due to I/O error for ${journal.operationId}: ${candInfo.error}`);
        continue;
      }
      if (candInfo.isSymlink || candInfo.isNonRegular || (candInfo.exists && candInfo.sha?.toLowerCase() !== journal.candidateSha256.toLowerCase())) {
        recordAmbiguity(
          `Candidate artifact corrupt or symlink in committed cleanup for ${journal.operationId}`
        );
        continue;
      }

      const rollInfo = hashFile(expectedRollbackDisk);
      if (rollInfo.isUnreadable) {
        recordAmbiguity(`Rollback artifact unreadable due to I/O error for ${journal.operationId}: ${rollInfo.error}`);
        continue;
      }
      if (rollInfo.isSymlink || rollInfo.isNonRegular || (rollInfo.exists && rollInfo.sha?.toLowerCase() !== journal.previousSha256.toLowerCase())) {
        recordAmbiguity(
          `Rollback artifact corrupt or symlink in committed cleanup for ${journal.operationId}`
        );
        continue;
      }

      plannedActions.push({
        kind: 'CLEAN_COMMITTED',
        journalPath: jPath,
        authoritativeTarget,
        candidateDiskPath: expectedCandidateDisk,
        rollbackDiskPath: expectedRollbackDisk,
        candidateExpectedSha: journal.candidateSha256,
        rollbackExpectedSha: journal.previousSha256,
      });
    }
  }

  // Duplicate target documents check
  for (const [tPath, opIds] of targetMap.entries()) {
    if (opIds.length > 1) {
      recordAmbiguity(
        `Duplicate active transaction journals detected for target '${tPath}': operations ${opIds.join(', ')}`
      );
    }
  }

  // Fail-closed gate: if any ambiguity exists across the entire scan, execute ZERO actions!
  if (report.ambiguousCount > 0 || report.errors.length > 0) {
    report.locked = true;
    recoveryLocked = true;
    return report;
  }

  // =========================================================================
  // PASS 2: Execution of Verified Recovery Actions (Zero Ambiguities Proven)
  // =========================================================================

  for (const action of plannedActions) {
    if (action.kind === 'CLEAN_PREPARED') {
      try {
        assertRegularFileHash(action.authoritativeTarget, action.previousSha256, 'Target document');
        assertRegularFileHash(action.candidateDiskPath, action.candidateSha256, 'Candidate artifact');
        assertRegularFileHash(action.rollbackDiskPath, action.previousSha256, 'Rollback artifact');

        unlinkSiblingSafe(action.candidateDiskPath);
        unlinkSiblingSafe(action.rollbackDiskPath);
        fs.unlinkSync(action.journalPath); // Journal deleted LAST
        report.cleanedCount++;
      } catch (err: any) {
        recordAmbiguity(`Failed to clean prepared transaction artifacts: ${String(err)}`);
      }
    } else if (action.kind === 'ROLLBACK_REPLACED') {
      try {
        assertRegularFileHash(action.authoritativeTarget, action.candidateSha256, 'Target document prior to rollback');
        assertRegularFileHash(action.rollbackDiskPath, action.previousSha256, 'Rollback artifact prior to rollback');

        // Atomic rollback rename
        rollbackDocumentSiblingAtomic(action.rollbackDiskPath, action.authoritativeTarget);

        // Post-rollback verification
        assertRegularFileHash(action.authoritativeTarget, action.previousSha256, 'Restored target document');

        unlinkSiblingSafe(action.candidateDiskPath);
        fs.unlinkSync(action.journalPath); // Journal deleted LAST
        report.recoveredCount++;
      } catch (err: any) {
        recordAmbiguity(`Rollback execution failed for ${action.journalPath}: ${String(err)}`);
      }
    } else if (action.kind === 'CLEAN_COMMITTED') {
      try {
        assertRegularFileHash(action.authoritativeTarget, action.candidateExpectedSha, 'Committed target document');
        assertOptionalRegularFileHash(action.candidateDiskPath, action.candidateExpectedSha, 'Candidate artifact');
        assertOptionalRegularFileHash(action.rollbackDiskPath, action.rollbackExpectedSha, 'Rollback artifact');

        unlinkSiblingSafe(action.candidateDiskPath);
        unlinkSiblingSafe(action.rollbackDiskPath);
        fs.unlinkSync(action.journalPath); // Journal deleted LAST
        report.cleanedCount++;
      } catch (err: any) {
        recordAmbiguity(`Failed to clean committed transaction artifacts: ${String(err)}`);
      }
    }
  }

  if (report.ambiguousCount > 0 || report.errors.length > 0) {
    report.locked = true;
    recoveryLocked = true;
  } else {
    report.locked = false;
    recoveryLocked = false;
  }

  return report;
}
