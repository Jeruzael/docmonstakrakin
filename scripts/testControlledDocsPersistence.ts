import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import {
  resolveDocumentDiskPath,
  readDocumentDisk,
  detectLineEndings,
  encodeDocumentBytes,
  deriveSiblingCandidatePath,
  deriveSiblingRollbackPath,
  writeSiblingFileAtomic,
  replaceDocumentSiblingAtomic,
  rollbackDocumentSiblingAtomic,
  unlinkSiblingSafe,
  assertEditableTargetNotSymlink,
  type DetectedEol,
  type DocumentFileReadResult,
} from '../server/docs/controlledDocsPersistence.ts';
import type { ControlledDocumentRecord } from '../src/types.ts';

function createTempWorkspace(): { dir: string; docsDir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk195-fs-test-'));
  const docsDir = path.join(dir, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  return {
    dir,
    docsDir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best effort
      }
    },
  };
}

function makeDocRecord(override: Partial<ControlledDocumentRecord> = {}): ControlledDocumentRecord {
  return {
    id: 'DOC-CTRL-002',
    path: 'docs/00_control/PROJECT_STATE.md',
    kind: 'CONTROL',
    authority: 'REFERENCE',
    editability: 'CONTROLLED_EDIT',
    fileType: 'MARKDOWN',
    title: 'Project State',
    editableLivingDoc: true,
    ...override,
  };
}

async function runTests() {
  console.log('--- Starting Task 4: Safe Document Filesystem Primitives Tests ---');
  let passed = 0;

  // ============================================================
  // TEST A: NORMAL REGISTERED PATH
  // ============================================================
  console.log('\n[Test A] Normal registered path:');
  {
    const ws = createTempWorkspace();
    try {
      const docPath = path.join(ws.docsDir, '00_control', 'PROJECT_STATE.md');
      fs.mkdirSync(path.dirname(docPath), { recursive: true });
      fs.writeFileSync(docPath, '# Project State\n', 'utf8');

      const record = makeDocRecord();
      const res = resolveDocumentDiskPath(record, ws.dir);

      assert.equal(res.diskPath, path.resolve(docPath));
      assert.equal(res.dirPath, path.resolve(path.dirname(docPath)));
      console.log('  ✓ resolveDocumentDiskPath resolves correct diskPath and dirPath inside docs/');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST B: FORWARD TRAVERSAL
  // ============================================================
  console.log('\n[Test B] Forward traversal rejection:');
  {
    const ws = createTempWorkspace();
    try {
      const traversalPaths = [
        '../secret.md',
        'docs/../../secret.md',
        'docs/00_control/../../../secret.md',
      ];
      for (const p of traversalPaths) {
        assert.throws(
          () => resolveDocumentDiskPath(makeDocRecord({ path: p }), ws.dir),
          (err: any) => {
            assert(String(err).includes('TRAVERSAL_DETECTED') || String(err).includes('DOCS_BOUNDARY'));
            return true;
          },
          `Expected traversal error for ${p}`
        );
      }
      console.log('  ✓ Forward traversal sequences (..) rejected fail-closed');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST C: BACKSLASH TRAVERSAL
  // ============================================================
  console.log('\n[Test C] Backslash traversal rejection:');
  {
    const ws = createTempWorkspace();
    try {
      const backslashPaths = [
        'docs\\..\\..\\secret.md',
        'docs/00_control\\..\\..\\secret.md',
      ];
      for (const p of backslashPaths) {
        assert.throws(
          () => resolveDocumentDiskPath(makeDocRecord({ path: p }), ws.dir),
          (err: any) => {
            assert(String(err).includes('TRAVERSAL_DETECTED') || String(err).includes('DOCS_BOUNDARY'));
            return true;
          },
          `Expected backslash traversal error for ${p}`
        );
      }
      console.log('  ✓ Backslash traversal sequences rejected fail-closed on all platforms');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST D: ABSOLUTE PATHS
  // ============================================================
  console.log('\n[Test D] Absolute paths rejection:');
  {
    const ws = createTempWorkspace();
    try {
      const absolutePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        'C:/Windows/System32/config/SAM',
        '\\\\server\\share\\secret.txt',
      ];
      for (const p of absolutePaths) {
        assert.throws(
          () => resolveDocumentDiskPath(makeDocRecord({ path: p }), ws.dir),
          (err: any) => {
            assert(
              String(err).includes('ABSOLUTE_PATH_REJECTED') ||
                String(err).includes('UNC_PATH_REJECTED') ||
                String(err).includes('DOCS_BOUNDARY')
            );
            return true;
          },
          `Expected absolute/UNC rejection for ${p}`
        );
      }
      console.log('  ✓ POSIX absolute, Windows drive absolute, and UNC paths rejected fail-closed');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST E: NULL PATHS
  // ============================================================
  console.log('\n[Test E] Null paths rejection:');
  {
    const ws = createTempWorkspace();
    try {
      const nullPaths = [
        'docs/00_control/doc\0.md',
        'docs/00_control/doc%00.md',
      ];
      for (const p of nullPaths) {
        assert.throws(
          () => resolveDocumentDiskPath(makeDocRecord({ path: p }), ws.dir),
          (err: any) => {
            assert(String(err).includes('NULL_BYTE_DETECTED'));
            return true;
          },
          `Expected null byte error for ${p}`
        );
      }
      console.log('  ✓ Actual and encoded null bytes rejected fail-closed');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST F: PREFIX ESCAPE
  // ============================================================
  console.log('\n[Test F] Prefix escape rejection:');
  {
    const ws = createTempWorkspace();
    try {
      const prefixPaths = [
        'docs_evil/file.md',
        'docs-secret/file.md',
      ];
      for (const p of prefixPaths) {
        assert.throws(
          () => resolveDocumentDiskPath(makeDocRecord({ path: p }), ws.dir),
          (err: any) => {
            assert(String(err).includes('DOCS_BOUNDARY'));
            return true;
          },
          `Expected prefix escape error for ${p}`
        );
      }
      console.log('  ✓ Prefix sibling escapes beside docs/ rejected fail-closed');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST G: SYMLINK ESCAPE
  // ============================================================
  console.log('\n[Test G] Symlink escape:');
  {
    const ws = createTempWorkspace();
    try {
      const outsideDir = path.join(ws.dir, 'outside_docs');
      fs.mkdirSync(outsideDir, { recursive: true });
      fs.writeFileSync(path.join(outsideDir, 'secret.md'), 'sensitive content\n', 'utf8');

      const linkDir = path.join(ws.docsDir, 'linkdir');
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      fs.symlinkSync(outsideDir, linkDir, linkType);

      assert.throws(
        () => resolveDocumentDiskPath(makeDocRecord({ path: 'docs/linkdir/secret.md' }), ws.dir),
        (err: any) => {
          assert(String(err).includes('SYMLINK_ESCAPED'));
          return true;
        }
      );
      console.log('  ✓ Symlink/junction escaping docs boundary throws SYMLINK_ESCAPED');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST H: INTERNAL SAFE SYMLINK READ
  // ============================================================
  console.log('\n[Test H] Internal safe symlink read vs editable write target:');
  {
    const ws = createTempWorkspace();
    try {
      const realTarget = path.join(ws.docsDir, 'real_doc.md');
      fs.writeFileSync(realTarget, 'internal safe doc content\n', 'utf8');

      const symlinkDoc = path.join(ws.docsDir, 'symlink_doc.md');
      let symlinkCreated = false;
      try {
        fs.symlinkSync(realTarget, symlinkDoc, 'file');
        symlinkCreated = true;
      } catch (e: any) {
        console.log(`  (File symlink creation unavailable on current environment: ${e.code}; skipping file symlink assertions)`);
      }

      if (symlinkCreated) {
        // Read should succeed because realpath is inside docs
        const readRes = readDocumentDisk(makeDocRecord({ path: 'docs/symlink_doc.md' }), ws.dir);
        assert.equal(readRes.exists, true);
        if (readRes.exists) {
          assert.equal(readRes.content, 'internal safe doc content\n');
        }

        // assertEditableTargetNotSymlink must reject it for writes
        assert.throws(
          () => assertEditableTargetNotSymlink(symlinkDoc),
          (err: any) => {
            assert(String(err).includes('EDITABLE_TARGET_SYMLINK'));
            return true;
          }
        );
      }
      console.log('  ✓ Safe internal symlink read permitted; write target rejected by assertEditableTargetNotSymlink');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST I: BROKEN SYMLINK
  // ============================================================
  console.log('\n[Test I] Broken symlink fails closed:');
  {
    const ws = createTempWorkspace();
    try {
      const nonExistentTarget = path.join(ws.docsDir, 'does_not_exist.md');
      const brokenLink = path.join(ws.docsDir, 'broken_link.md');
      let brokenSymlinkCreated = false;
      try {
        fs.symlinkSync(nonExistentTarget, brokenLink, 'file');
        brokenSymlinkCreated = true;
      } catch (e: any) {
        console.log(`  (Broken file symlink creation unavailable: ${e.code}; skipping)`);
      }

      if (brokenSymlinkCreated) {
        assert.throws(
          () => resolveDocumentDiskPath(makeDocRecord({ path: 'docs/broken_link.md' }), ws.dir),
          (err: any) => {
            assert(String(err).includes('BROKEN_SYMLINK'));
            return true;
          }
        );
      }
      console.log('  ✓ Broken symlink fails closed and does not return ordinary MISSING');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST J: ORDINARY MISSING DOCUMENT
  // ============================================================
  console.log('\n[Test J] Ordinary missing document:');
  {
    const ws = createTempWorkspace();
    try {
      const record = makeDocRecord({ path: 'docs/00_control/NON_EXISTENT.md' });
      const res = readDocumentDisk(record, ws.dir);

      assert.deepEqual(res, {
        exists: false,
        rawBytes: null,
        rawSha256: null,
        content: null,
        eol: 'NONE',
        sizeBytes: 0,
        integrityStatus: 'MISSING',
      });
      console.log('  ✓ Missing document returns exact MISSING discriminated union without dummy hashes');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST K: RAW BYTE SHA
  // ============================================================
  console.log('\n[Test K] Raw byte SHA calculation:');
  {
    const ws = createTempWorkspace();
    try {
      const rawCrlfBuffer = Buffer.from('alpha\r\nbeta\r\n', 'utf8');
      const docPath = path.join(ws.docsDir, 'crlf.md');
      fs.writeFileSync(docPath, rawCrlfBuffer);

      const expectedRawSha = crypto.createHash('sha256').update(rawCrlfBuffer).digest('hex');
      const lfNormalizedSha = crypto.createHash('sha256').update('alpha\nbeta\n').digest('hex');

      assert.notEqual(expectedRawSha, lfNormalizedSha, 'CRLF and LF hashes must differ');

      const res = readDocumentDisk(makeDocRecord({ path: 'docs/crlf.md' }), ws.dir);
      assert.equal(res.exists, true);
      if (res.exists) {
        assert.equal(res.rawSha256, expectedRawSha);
      }
      console.log('  ✓ Raw byte SHA calculated without newline normalization');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST L: PINNED MATCH (Case-Insensitive)
  // ============================================================
  console.log('\n[Test L] Pinned match:');
  {
    const ws = createTempWorkspace();
    try {
      const content = Buffer.from('pinned content\n', 'utf8');
      const docPath = path.join(ws.docsDir, 'pinned.md');
      fs.writeFileSync(docPath, content);

      const exactSha = crypto.createHash('sha256').update(content).digest('hex');
      const record = makeDocRecord({
        path: 'docs/pinned.md',
        sha256Digest: exactSha.toUpperCase(), // Test uppercase compatibility
      });

      const res = readDocumentDisk(record, ws.dir);
      assert.equal(res.exists, true);
      if (res.exists) {
        assert.equal(res.integrityStatus, 'MATCH');
      }
      console.log('  ✓ Matching hash evaluates to MATCH (including case-insensitive digest support)');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST M: PINNED CHANGED
  // ============================================================
  console.log('\n[Test M] Pinned changed:');
  {
    const ws = createTempWorkspace();
    try {
      const content = Buffer.from('actual content\n', 'utf8');
      const docPath = path.join(ws.docsDir, 'changed.md');
      fs.writeFileSync(docPath, content);

      const record = makeDocRecord({
        path: 'docs/changed.md',
        sha256Digest: '0'.repeat(64), // Mismatched digest
      });

      const res = readDocumentDisk(record, ws.dir);
      assert.equal(res.exists, true);
      if (res.exists) {
        assert.equal(res.integrityStatus, 'CHANGED');
      }
      console.log('  ✓ Mismatched hash evaluates to CHANGED');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST N: UNPINNED
  // ============================================================
  console.log('\n[Test N] Unpinned document:');
  {
    const ws = createTempWorkspace();
    try {
      const content = Buffer.from('unpinned content\n', 'utf8');
      const docPath = path.join(ws.docsDir, 'unpinned.md');
      fs.writeFileSync(docPath, content);

      const record = makeDocRecord({
        path: 'docs/unpinned.md',
        sha256Digest: undefined,
      });

      const res = readDocumentDisk(record, ws.dir);
      assert.equal(res.exists, true);
      if (res.exists) {
        assert.equal(res.integrityStatus, 'UNPINNED');
      }
      console.log('  ✓ Unpinned document evaluates to UNPINNED');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST O: BYTE SIZE VS CHARACTER LENGTH
  // ============================================================
  console.log('\n[Test O] Byte size vs char length:');
  {
    const ws = createTempWorkspace();
    try {
      const multiByteString = '🚀 Docmonstakrakin — 👾 2026';
      const rawBytes = Buffer.from(multiByteString, 'utf8');
      const docPath = path.join(ws.docsDir, 'unicode.md');
      fs.writeFileSync(docPath, rawBytes);

      assert.notEqual(rawBytes.length, multiByteString.length, 'Byte length must differ from char length');

      const res = readDocumentDisk(makeDocRecord({ path: 'docs/unicode.md' }), ws.dir);
      assert.equal(res.exists, true);
      if (res.exists) {
        assert.equal(res.sizeBytes, rawBytes.length);
        assert.equal(res.content, multiByteString);
      }
      console.log('  ✓ sizeBytes reflects exact UTF-8 byte count, not JavaScript character count');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST P: EOL DETECTION
  // ============================================================
  console.log('\n[Test P] EOL detection:');
  {
    assert.equal(detectLineEndings('a\nb\n'), 'LF');
    assert.equal(detectLineEndings('a\r\nb\r\n'), 'CRLF');
    assert.equal(detectLineEndings('a\r\nb\n'), 'MIXED');
    assert.equal(detectLineEndings('no newline here'), 'NONE');
    console.log('  ✓ detectLineEndings correctly classifies LF, CRLF, MIXED, and NONE');
    passed++;
  }

  // ============================================================
  // TEST Q: MIXED READ ALLOWED
  // ============================================================
  console.log('\n[Test Q] Mixed EOL read allowed:');
  {
    const ws = createTempWorkspace();
    try {
      const mixedContent = 'first line\r\nsecond line\nthird line\r\n';
      const docPath = path.join(ws.docsDir, 'mixed.md');
      fs.writeFileSync(docPath, mixedContent, 'utf8');

      const res = readDocumentDisk(makeDocRecord({ path: 'docs/mixed.md' }), ws.dir);
      assert.equal(res.exists, true);
      if (res.exists) {
        assert.equal(res.eol, 'MIXED');
        assert.equal(res.content, mixedContent);
      }
      console.log('  ✓ readDocumentDisk allows MIXED line endings for read-only inspection');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST R: LF ENCODING
  // ============================================================
  console.log('\n[Test R] LF encoding:');
  {
    const input = 'line1\nline2\n';
    const encoded = encodeDocumentBytes(input, 'LF');
    assert.deepEqual(encoded, Buffer.from('line1\nline2\n', 'utf8'));
    console.log('  ✓ encodeDocumentBytes encodes exact LF bytes');
    passed++;
  }

  // ============================================================
  // TEST S: CRLF ENCODING & NO DOUBLE CONVERSION
  // ============================================================
  console.log('\n[Test S] CRLF encoding without double conversion:');
  {
    const inputLf = 'line1\nline2\n';
    const encodedFromLf = encodeDocumentBytes(inputLf, 'CRLF');
    assert.deepEqual(encodedFromLf, Buffer.from('line1\r\nline2\r\n', 'utf8'));

    // Candidate already containing CRLF must not become \r\r\n
    const inputCrlf = 'line1\r\nline2\r\n';
    const encodedFromCrlf = encodeDocumentBytes(inputCrlf, 'CRLF');
    assert.deepEqual(encodedFromCrlf, Buffer.from('line1\r\nline2\r\n', 'utf8'));
    assert.equal(encodedFromCrlf.toString('utf8').includes('\r\r\n'), false);

    console.log('  ✓ encodeDocumentBytes converts to CRLF without double-converting \\r\\r\\n');
    passed++;
  }

  // ============================================================
  // TEST T: MIXED ENCODING REJECTION
  // ============================================================
  console.log('\n[Test T] Mixed encoding rejection:');
  {
    assert.throws(
      () => encodeDocumentBytes('draft content', 'MIXED'),
      (err: any) => {
        assert(String(err).includes('UNSUPPORTED_MIXED_LINE_ENDINGS'));
        return true;
      }
    );
    console.log('  ✓ encodeDocumentBytes throws UNSUPPORTED_MIXED_LINE_ENDINGS for MIXED targetEol');
    passed++;
  }

  // ============================================================
  // TEST U: NONE ENCODING
  // ============================================================
  console.log('\n[Test U] NONE encoding:');
  {
    const singleLine = 'no newlines';
    const encodedSingle = encodeDocumentBytes(singleLine, 'NONE');
    assert.deepEqual(encodedSingle, Buffer.from('no newlines', 'utf8'));

    // If candidate introduces logical newlines, use deterministic LF
    const multiLine = 'line1\nline2';
    const encodedMulti = encodeDocumentBytes(multiLine, 'NONE');
    assert.deepEqual(encodedMulti, Buffer.from('line1\nline2', 'utf8'));

    console.log('  ✓ encodeDocumentBytes preserves single line text and uses deterministic LF when candidate introduces newlines');
    passed++;
  }

  // ============================================================
  // TEST V: CANDIDATE SIBLING PATH
  // ============================================================
  console.log('\n[Test V] Candidate sibling path:');
  {
    const target = path.resolve('docs/00_control/PROJECT_STATE.md');
    const sibling = deriveSiblingCandidatePath(target, 'op123');

    assert.equal(path.dirname(sibling), path.dirname(target));
    assert.equal(path.basename(sibling), '.PROJECT_STATE.md.dmk-op123.candidate');
    console.log('  ✓ deriveSiblingCandidatePath derives exact target-sibling path in same directory');
    passed++;
  }

  // ============================================================
  // TEST W: ROLLBACK SIBLING PATH
  // ============================================================
  console.log('\n[Test W] Rollback sibling path:');
  {
    const target = path.resolve('docs/00_control/PROJECT_STATE.md');
    const sibling = deriveSiblingRollbackPath(target, 'op123');

    assert.equal(path.dirname(sibling), path.dirname(target));
    assert.equal(path.basename(sibling), '.PROJECT_STATE.md.dmk-op123.rollback');
    console.log('  ✓ deriveSiblingRollbackPath derives exact rollback path in same directory');
    passed++;
  }

  // ============================================================
  // TEST X: MALICIOUS OPERATION ID
  // ============================================================
  console.log('\n[Test X] Malicious operation ID rejection:');
  {
    const target = path.resolve('docs/00_control/PROJECT_STATE.md');
    const badOpIds = ['../escape', '..\\escape', 'slash/bad', 'backslash\\bad', 'null\0bad', ''];

    for (const badId of badOpIds) {
      assert.throws(
        () => deriveSiblingCandidatePath(target, badId),
        (err: any) => {
          assert(String(err).includes('INVALID_OPERATION_ID'));
          return true;
        },
        `Expected INVALID_OPERATION_ID for ${badId}`
      );
    }
    console.log('  ✓ Malicious/invalid operation IDs rejected fail-closed');
    passed++;
  }

  // ============================================================
  // TEST Y: EXCLUSIVE SIBLING WRITE (NO OVERWRITE)
  // ============================================================
  console.log('\n[Test Y] Exclusive sibling write:');
  {
    const ws = createTempWorkspace();
    try {
      const siblingPath = path.join(ws.docsDir, '.test.md.dmk-op1.candidate');
      writeSiblingFileAtomic(siblingPath, Buffer.from('first write\n', 'utf8'));

      // Re-running on existing sibling must throw EEXIST and not overwrite
      assert.throws(
        () => writeSiblingFileAtomic(siblingPath, Buffer.from('overwrite attempt\n', 'utf8')),
        (err: any) => {
          assert.equal(err.code, 'EEXIST');
          return true;
        }
      );

      const content = fs.readFileSync(siblingPath, 'utf8');
      assert.equal(content, 'first write\n', 'Existing sibling artifact must not be overwritten');
      console.log('  ✓ writeSiblingFileAtomic uses exclusive creation (wx) and prevents overwriting');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST Z: SIBLING WRITE CONTENT
  // ============================================================
  console.log('\n[Test Z] Sibling write exact content:');
  {
    const ws = createTempWorkspace();
    try {
      const siblingPath = path.join(ws.docsDir, '.test.md.dmk-op2.candidate');
      const expectedBytes = Buffer.from('exact binary content \x00\xFF\r\n', 'binary');

      writeSiblingFileAtomic(siblingPath, expectedBytes);
      const onDisk = fs.readFileSync(siblingPath);

      assert.deepEqual(onDisk, expectedBytes);
      console.log('  ✓ writeSiblingFileAtomic writes exact bytes with fdatasync flush');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AA: FORWARD SAME-DIRECTORY RENAME
  // ============================================================
  console.log('\n[Test AA] Forward same-directory rename:');
  {
    const ws = createTempWorkspace();
    try {
      const targetPath = path.join(ws.docsDir, 'doc.md');
      const candidatePath = path.join(ws.docsDir, '.doc.md.dmk-op3.candidate');

      fs.writeFileSync(targetPath, 'old content\n', 'utf8');
      fs.writeFileSync(candidatePath, 'new content\n', 'utf8');

      replaceDocumentSiblingAtomic(candidatePath, targetPath);

      assert.equal(fs.readFileSync(targetPath, 'utf8'), 'new content\n');
      assert.equal(fs.existsSync(candidatePath), false, 'Candidate sibling must be unlinked/consumed by rename');
      console.log('  ✓ replaceDocumentSiblingAtomic replaces target atomically in same directory');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AB: CROSS-DIRECTORY FORWARD REJECTED
  // ============================================================
  console.log('\n[Test AB] Cross-directory forward replacement rejected:');
  {
    const ws = createTempWorkspace();
    try {
      const targetPath = path.join(ws.docsDir, 'doc.md');
      const otherDir = path.join(ws.dir, 'other_dir');
      fs.mkdirSync(otherDir, { recursive: true });
      const candidatePath = path.join(otherDir, '.doc.md.dmk-op4.candidate');

      fs.writeFileSync(targetPath, 'target content\n', 'utf8');
      fs.writeFileSync(candidatePath, 'remote content\n', 'utf8');

      assert.throws(
        () => replaceDocumentSiblingAtomic(candidatePath, targetPath),
        (err: any) => {
          assert(String(err).includes('DOCUMENT_SIBLING_DIRECTORY_MISMATCH'));
          return true;
        }
      );
      assert.equal(fs.readFileSync(targetPath, 'utf8'), 'target content\n', 'Target must remain unmodified');
      console.log('  ✓ Cross-directory candidate rename rejected with DOCUMENT_SIBLING_DIRECTORY_MISMATCH');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AC: ROLLBACK SAME-DIRECTORY RENAME
  // ============================================================
  console.log('\n[Test AC] Rollback same-directory rename:');
  {
    const ws = createTempWorkspace();
    try {
      const targetPath = path.join(ws.docsDir, 'doc.md');
      const rollbackPath = path.join(ws.docsDir, '.doc.md.dmk-op5.rollback');

      fs.writeFileSync(targetPath, 'mutated content\n', 'utf8');
      fs.writeFileSync(rollbackPath, 'original content\n', 'utf8');

      rollbackDocumentSiblingAtomic(rollbackPath, targetPath);

      assert.equal(fs.readFileSync(targetPath, 'utf8'), 'original content\n');
      assert.equal(fs.existsSync(rollbackPath), false, 'Rollback sibling must be unlinked/consumed by rename');
      console.log('  ✓ rollbackDocumentSiblingAtomic restores original target atomically');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AD: CROSS-DIRECTORY ROLLBACK REJECTED
  // ============================================================
  console.log('\n[Test AD] Cross-directory rollback rejected:');
  {
    const ws = createTempWorkspace();
    try {
      const targetPath = path.join(ws.docsDir, 'doc.md');
      const otherDir = path.join(ws.dir, 'other_dir');
      fs.mkdirSync(otherDir, { recursive: true });
      const rollbackPath = path.join(otherDir, '.doc.md.dmk-op6.rollback');

      fs.writeFileSync(targetPath, 'target content\n', 'utf8');
      fs.writeFileSync(rollbackPath, 'remote rollback\n', 'utf8');

      assert.throws(
        () => rollbackDocumentSiblingAtomic(rollbackPath, targetPath),
        (err: any) => {
          assert(String(err).includes('DOCUMENT_SIBLING_DIRECTORY_MISMATCH'));
          return true;
        }
      );
      assert.equal(fs.readFileSync(targetPath, 'utf8'), 'target content\n');
      console.log('  ✓ Cross-directory rollback rejected with DOCUMENT_SIBLING_DIRECTORY_MISMATCH');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AE: unlinkSiblingSafe
  // ============================================================
  console.log('\n[Test AE] unlinkSiblingSafe:');
  {
    const ws = createTempWorkspace();
    try {
      const siblingPath = path.join(ws.docsDir, '.doc.md.dmk-op7.candidate');
      fs.writeFileSync(siblingPath, 'temp sibling\n', 'utf8');

      // Existing file unlinked
      unlinkSiblingSafe(siblingPath);
      assert.equal(fs.existsSync(siblingPath), false);

      // Missing file is safe no-op
      assert.doesNotThrow(() => unlinkSiblingSafe(siblingPath));

      // Parent directory remains intact
      assert.equal(fs.existsSync(ws.docsDir), true);
      console.log('  ✓ unlinkSiblingSafe unlinks existing file, no-ops on missing, and preserves parent dir');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AG: DETERMINISTIC PARTIAL WRITE COMPLETION
  // ============================================================
  console.log('\n[Test AG] Deterministic partial write completion:');
  {
    const ws = createTempWorkspace();
    const originalWriteSync = fs.writeSync;
    try {
      const siblingPath = path.join(ws.docsDir, '.test.md.dmk-op8.candidate');
      const expectedBytes = Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'utf8');

      let callCount = 0;
      (fs as any).writeSync = function (
        fd: number,
        buffer: any,
        offset?: number,
        length?: number,
        position?: any
      ): number {
        callCount++;
        if (callCount === 1) {
          const partialLen = 10;
          return originalWriteSync.call(fs, fd, buffer, offset, partialLen, position);
        }
        return originalWriteSync.call(fs, fd, buffer, offset, length, position);
      };

      writeSiblingFileAtomic(siblingPath, expectedBytes);
      const onDisk = fs.readFileSync(siblingPath);
      assert.deepEqual(onDisk, expectedBytes, 'Disk content must match expectedBytes completely');
      assert(callCount > 1, 'writeSync must have been called multiple times to complete write');
      console.log('  ✓ writeSiblingFileAtomic loops until complete buffer is written');
      passed++;
    } finally {
      fs.writeSync = originalWriteSync;
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AH: ZERO-PROGRESS FAIL-CLOSED TEST
  // ============================================================
  console.log('\n[Test AH] Zero-progress fail-closed test:');
  {
    const ws = createTempWorkspace();
    const originalWriteSync = fs.writeSync;
    try {
      const siblingPath = path.join(ws.docsDir, '.test.md.dmk-op9.candidate');
      const expectedBytes = Buffer.from('some content for zero progress test', 'utf8');

      (fs as any).writeSync = function (): number {
        return 0;
      };

      assert.throws(
        () => writeSiblingFileAtomic(siblingPath, expectedBytes),
        (err: any) => {
          assert(String(err).includes('SIBLING_WRITE_INCOMPLETE'));
          return true;
        }
      );
      assert.equal(fs.existsSync(siblingPath), false, 'Partial artifact must be cleaned up on write failure');
      console.log('  ✓ Zero-progress write throws SIBLING_WRITE_INCOMPLETE and unlinks partial sibling');
      passed++;
    } finally {
      fs.writeSync = originalWriteSync;
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST AF: LIVE REPOSITORY NEVER WRITTEN
  // ============================================================
  console.log('\n[Test AF] Live repository never written:');
  {
    const realDocsDir = path.join(process.cwd(), 'docs');
    const realFiles = fs.readdirSync(realDocsDir, { recursive: true }) as string[];

    const siblingArtifacts = realFiles.filter(
      (f) => typeof f === 'string' && (f.includes('.candidate') || f.includes('.rollback') || f.includes('.dmk-'))
    );
    assert.equal(
      siblingArtifacts.length,
      0,
      `Real repository docs/ must contain zero test sibling artifacts: ${siblingArtifacts.join(', ')}`
    );
    console.log('  ✓ Real repository docs/ directory is completely pristine with zero test artifacts');
    passed++;
  }

  console.log(`\nAll ${passed} tests in testControlledDocsPersistence.ts passed!`);
}

runTests().catch((err) => {
  console.error('\nFAIL in testControlledDocsPersistence.ts:', err);
  process.exit(1);
});
