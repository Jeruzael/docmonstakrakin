import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ControlledDocumentRecord } from '../../src/types.ts';

export type DetectedEol = 'LF' | 'CRLF' | 'MIXED' | 'NONE';

export type DocumentFileReadResult =
  | {
      exists: true;
      rawBytes: Buffer;
      rawSha256: string;
      content: string;
      eol: DetectedEol;
      sizeBytes: number;
      integrityStatus: 'MATCH' | 'CHANGED' | 'UNPINNED';
    }
  | {
      exists: false;
      rawBytes: null;
      rawSha256: null;
      content: null;
      eol: 'NONE';
      sizeBytes: 0;
      integrityStatus: 'MISSING';
    };

/**
 * Validates path string against null bytes, traversal segments, absolute paths, and UNC roots.
 */
function assertPathHygiene(docPath: string): void {
  if (docPath.includes('\0') || docPath.includes('%00')) {
    throw new Error('NULL_BYTE_DETECTED: Registered path contains null bytes');
  }

  // Traversal check
  const segments = docPath.split(/[\\/]/);
  if (segments.includes('..') || docPath.includes('..')) {
    throw new Error('TRAVERSAL_DETECTED: Registered path contains directory traversal sequences');
  }

  // Absolute & UNC path checks
  if (docPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(docPath)) {
    throw new Error('ABSOLUTE_PATH_REJECTED: Registered path cannot be absolute');
  }
  if (docPath.startsWith('\\\\') || docPath.startsWith('//')) {
    throw new Error('UNC_PATH_REJECTED: Registered path cannot be a UNC path');
  }
}

/**
 * Resolves and strictly confines a registered document path within the workspace docs/ root.
 * Validates lexical confinement and ensures real paths/symlinks do not escape docs/.
 */
export function resolveDocumentDiskPath(
  docRecord: ControlledDocumentRecord,
  workspaceRoot: string = process.cwd()
): {
  diskPath: string;
  dirPath: string;
} {
  assertPathHygiene(docRecord.path);

  const docsRoot = path.resolve(workspaceRoot, 'docs');
  const target = path.resolve(workspaceRoot, docRecord.path);

  // Lexical confinement
  const rel = path.relative(docsRoot, target);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel) || rel === '') {
    throw new Error(`PATH_OUTSIDE_DOCS_BOUNDARY: Path '${docRecord.path}' escapes the docs boundary`);
  }

  // Realpath & symlink confinement
  const lstat = fs.lstatSync(target, { throwIfNoEntry: false });
  if (lstat) {
    if (lstat.isSymbolicLink()) {
      let real: string;
      try {
        real = fs.realpathSync(target);
      } catch {
        throw new Error(`BROKEN_SYMLINK: Symlink at '${target}' cannot be resolved`);
      }
      const relReal = path.relative(docsRoot, real);
      if (relReal === '..' || relReal.startsWith(`..${path.sep}`) || path.isAbsolute(relReal)) {
        throw new Error('SYMLINK_ESCAPED: Symlink target resolves outside docs boundary');
      }
    } else {
      const real = fs.realpathSync(target);
      const relReal = path.relative(docsRoot, real);
      if (relReal === '..' || relReal.startsWith(`..${path.sep}`) || path.isAbsolute(relReal)) {
        throw new Error('SYMLINK_ESCAPED: Real path escapes docs boundary');
      }
    }
  } else {
    // Missing leaf: inspect the nearest existing ancestor to prevent symlinked parent escapes
    let curr = path.dirname(target);
    while (curr && !fs.existsSync(curr)) {
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }
    if (curr && fs.existsSync(curr)) {
      const realAncestor = fs.realpathSync(curr);
      const relAncestor = path.relative(docsRoot, realAncestor);
      if (relAncestor === '..' || relAncestor.startsWith(`..${path.sep}`) || path.isAbsolute(relAncestor)) {
        throw new Error('SYMLINK_ESCAPED: Parent directory symlink escapes docs boundary');
      }
    }
  }

  return {
    diskPath: target,
    dirPath: path.dirname(target),
  };
}

/**
 * Asserts that an editable target file is not a symbolic link.
 * Even internal safe symlinks are rejected for controlled writes.
 */
export function assertEditableTargetNotSymlink(diskPath: string): void {
  const lstat = fs.lstatSync(diskPath, { throwIfNoEntry: false });
  if (lstat && lstat.isSymbolicLink()) {
    throw new Error('EDITABLE_TARGET_SYMLINK: Controlled document edit targets cannot be symbolic links');
  }
}

/**
 * Reads a registered document from disk, computing exact raw bytes, SHA-256 hash,
 * and integrity status without content alterations or line-ending normalizations.
 */
export function readDocumentDisk(
  docRecord: ControlledDocumentRecord,
  workspaceRoot: string = process.cwd()
): DocumentFileReadResult {
  const { diskPath } = resolveDocumentDiskPath(docRecord, workspaceRoot);

  if (!fs.existsSync(diskPath)) {
    return {
      exists: false,
      rawBytes: null,
      rawSha256: null,
      content: null,
      eol: 'NONE',
      sizeBytes: 0,
      integrityStatus: 'MISSING',
    };
  }

  const rawBytes = fs.readFileSync(diskPath);
  const rawSha256 = crypto.createHash('sha256').update(rawBytes).digest('hex');
  const content = rawBytes.toString('utf8');
  const eol = detectLineEndings(content);
  const sizeBytes = rawBytes.length;

  let integrityStatus: 'MATCH' | 'CHANGED' | 'UNPINNED';
  if (docRecord.sha256Digest) {
    if (rawSha256.toLowerCase() === docRecord.sha256Digest.toLowerCase()) {
      integrityStatus = 'MATCH';
    } else {
      integrityStatus = 'CHANGED';
    }
  } else {
    integrityStatus = 'UNPINNED';
  }

  return {
    exists: true,
    rawBytes,
    rawSha256,
    content,
    eol,
    sizeBytes,
    integrityStatus,
  };
}

/**
 * Detects line endings in a string (LF, CRLF, MIXED, or NONE).
 */
export function detectLineEndings(rawContent: string): DetectedEol {
  const hasCrlf = rawContent.includes('\r\n');
  const withoutCrlf = rawContent.replace(/\r\n/g, '');
  const hasBareLf = withoutCrlf.includes('\n');

  if (hasCrlf && hasBareLf) return 'MIXED';
  if (hasCrlf) return 'CRLF';
  if (hasBareLf) return 'LF';
  return 'NONE';
}

/**
 * Encodes document content to exact bytes matching target line endings.
 * Normalizes draft logical newlines before encoding to avoid \r\r\n bugs.
 * Throws UNSUPPORTED_MIXED_LINE_ENDINGS for MIXED target line endings.
 */
export function encodeDocumentBytes(content: string, targetEol: DetectedEol): Buffer {
  if (targetEol === 'MIXED') {
    throw new Error('UNSUPPORTED_MIXED_LINE_ENDINGS: Cannot encode document with mixed line endings');
  }

  const normalized = content.replace(/\r\n/g, '\n');
  if (targetEol === 'CRLF') {
    const crlf = normalized.replace(/\n/g, '\r\n');
    return Buffer.from(crlf, 'utf8');
  }
  // 'LF' or 'NONE'
  return Buffer.from(normalized, 'utf8');
}

/**
 * Validates operationId hygiene.
 */
function assertValidOperationId(operationId: string): void {
  if (!operationId || typeof operationId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(operationId)) {
    throw new Error('INVALID_OPERATION_ID: Operation ID must be non-empty and alphanumeric');
  }
}

/**
 * Derives the exact candidate target-sibling path in the same directory.
 * Format: .<filename>.dmk-<operationId>.candidate
 */
export function deriveSiblingCandidatePath(targetDiskPath: string, operationId: string): string {
  assertValidOperationId(operationId);
  const dir = path.dirname(targetDiskPath);
  const base = path.basename(targetDiskPath);
  return path.join(dir, `.${base}.dmk-${operationId}.candidate`);
}

/**
 * Derives the exact rollback target-sibling path in the same directory.
 * Format: .<filename>.dmk-<operationId>.rollback
 */
export function deriveSiblingRollbackPath(targetDiskPath: string, operationId: string): string {
  assertValidOperationId(operationId);
  const dir = path.dirname(targetDiskPath);
  const base = path.basename(targetDiskPath);
  return path.join(dir, `.${base}.dmk-${operationId}.rollback`);
}

/**
 * Durably writes bytes to a sibling artifact using exclusive file creation (wx)
 * and fdatasync flushing.
 */
export function writeSiblingFileAtomic(siblingPath: string, bytes: Buffer): void {
  const fd = fs.openSync(siblingPath, 'wx');
  let closed = false;
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (written <= 0) {
        throw new Error('SIBLING_WRITE_INCOMPLETE: filesystem made no forward write progress');
      }
      offset += written;
    }
    fs.fdatasyncSync(fd);
    fs.closeSync(fd);
    closed = true;
  } catch (err: unknown) {
    if (!closed) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore descriptor close failure
      }
    }
    try {
      if (fs.existsSync(siblingPath)) {
        fs.unlinkSync(siblingPath);
      }
    } catch {
      // ignore unlink failure
    }
    throw err;
  }
}

/**
 * Replaces the target file atomically with the candidate sibling file.
 * Strictly enforces that both files reside in the exact same directory.
 */
export function replaceDocumentSiblingAtomic(
  candidateSiblingPath: string,
  targetDiskPath: string
): void {
  const candidateDir = path.resolve(path.dirname(candidateSiblingPath));
  const targetDir = path.resolve(path.dirname(targetDiskPath));
  if (candidateDir !== targetDir) {
    throw new Error('DOCUMENT_SIBLING_DIRECTORY_MISMATCH: Candidate and target must reside in the same directory');
  }
  fs.renameSync(candidateSiblingPath, targetDiskPath);
}

/**
 * Rolls back the target file atomically from the rollback sibling file.
 * Strictly enforces that both files reside in the exact same directory.
 */
export function rollbackDocumentSiblingAtomic(
  rollbackSiblingPath: string,
  targetDiskPath: string
): void {
  const rollbackDir = path.resolve(path.dirname(rollbackSiblingPath));
  const targetDir = path.resolve(path.dirname(targetDiskPath));
  if (rollbackDir !== targetDir) {
    throw new Error('DOCUMENT_SIBLING_DIRECTORY_MISMATCH: Rollback artifact and target must reside in the same directory');
  }
  fs.renameSync(rollbackSiblingPath, targetDiskPath);
}

/**
 * Safely unlinks a sibling artifact. No-ops if the file does not exist (ENOENT).
 */
export function unlinkSiblingSafe(siblingPath: string): void {
  try {
    fs.unlinkSync(siblingPath);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
}
