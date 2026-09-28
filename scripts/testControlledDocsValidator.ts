import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateUniversalConstraints,
  validateDocumentContent,
  computeDocumentDiff,
  type DocumentValidationResult,
  type DocumentDiffResult,
} from '../server/docs/controlledDocsValidator.ts';
import { getControlledDocsRegistry } from '../server/docs/controlledDocsRegistry.ts';
import type { ControlledDocumentRecord } from '../src/types.ts';

async function runTests(): Promise<void> {
  console.log('--- Starting Task 5: Validation & Line Diff Tests ---\n');
  let passed = 0;

  const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
  const doc002 = registry.find((d) => d.id === 'DOC-CTRL-002')!;
  const doc003 = registry.find((d) => d.id === 'DOC-CTRL-003')!;
  const doc004 = registry.find((d) => d.id === 'DOC-CTRL-004')!;
  const doc006 = registry.find((d) => d.id === 'DOC-CTRL-006')!;

  assert(doc002, 'DOC-CTRL-002 must exist in registry');
  assert(doc003, 'DOC-CTRL-003 must exist in registry');
  assert(doc004, 'DOC-CTRL-004 must exist in registry');
  assert(doc006, 'DOC-CTRL-006 must exist in registry');

  // ============================================================
  // TEST A: NORMAL UNIVERSAL VALIDATION
  // ============================================================
  console.log('[Test A] Normal universal validation:');
  {
    const content = '# Sample Title\n\nSome valid markdown body text.\n';
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateUniversalConstraints(rawBytes, content);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    console.log('  ✓ Normal valid UTF-8 text passes universal constraints');
    passed++;
  }

  // ============================================================
  // TEST B: EMPTY CONTENT REJECTION
  // ============================================================
  console.log('\n[Test B] Empty content rejection:');
  {
    const emptyContents = ['', '   ', '\n\t\n  \r\n'];
    for (const empty of emptyContents) {
      const rawBytes = Buffer.from(empty, 'utf8');
      const result = validateUniversalConstraints(rawBytes, empty);
      assert.equal(result.valid, false);
      assert(result.errors.includes('DOCUMENT_EMPTY'));
    }
    console.log('  ✓ Whitespace-only or empty content rejected with DOCUMENT_EMPTY');
    passed++;
  }

  // ============================================================
  // TEST C: EXACTLY-AT-LIMIT / OVERSIZED REJECTION
  // ============================================================
  console.log('\n[Test C] Exactly-at-limit / oversized rejection:');
  {
    const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
    // Exactly at 5MB limit
    const atLimitBytes = Buffer.alloc(MAX_DOCUMENT_BYTES, 0x61); // 'a'
    const atLimitContent = atLimitBytes.toString('utf8');
    const resultAtLimit = validateUniversalConstraints(atLimitBytes, atLimitContent);
    assert.equal(resultAtLimit.valid, false);
    assert(resultAtLimit.errors.includes('DOCUMENT_TOO_LARGE'));

    // 1 byte over limit
    const overLimitBytes = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 0x61);
    const overLimitContent = overLimitBytes.toString('utf8');
    const resultOverLimit = validateUniversalConstraints(overLimitBytes, overLimitContent);
    assert.equal(resultOverLimit.valid, false);
    assert(resultOverLimit.errors.includes('DOCUMENT_TOO_LARGE'));

    // Just under limit
    const underLimitBytes = Buffer.alloc(1024, 0x61);
    const underLimitContent = underLimitBytes.toString('utf8');
    const resultUnderLimit = validateUniversalConstraints(underLimitBytes, underLimitContent);
    assert.equal(resultUnderLimit.valid, true);
    console.log('  ✓ Payload >= 5MB strictly rejected with DOCUMENT_TOO_LARGE');
    passed++;
  }

  // ============================================================
  // TEST D: RAW BYTE SIZE VS CHARACTER LENGTH
  // ============================================================
  console.log('\n[Test D] Raw byte size vs character length:');
  {
    // A string where character length is < 5MB but UTF-8 byte length >= 5MB
    // Euro symbol '€' is 1 JS char (length 1) but 3 bytes in UTF-8
    // 2,000,000 chars * 3 bytes/char = 6,000,000 bytes (> 5MB)
    const charCount = 2 * 1024 * 1024; // 2,097,152 chars (< 5MB chars)
    const euroString = '€'.repeat(charCount);
    assert(euroString.length < 5 * 1024 * 1024, 'String length must be under 5M chars');
    const rawBytes = Buffer.from(euroString, 'utf8');
    assert(rawBytes.length > 5 * 1024 * 1024, 'Byte length must exceed 5MB');

    const result = validateUniversalConstraints(rawBytes, euroString);
    assert.equal(result.valid, false);
    assert(result.errors.includes('DOCUMENT_TOO_LARGE'));
    console.log('  ✓ Validator enforces raw byte limit rather than JS string character length');
    passed++;
  }

  // ============================================================
  // TEST E: INVALID UTF-8 REJECTION
  // ============================================================
  console.log('\n[Test E] Invalid UTF-8 rejection:');
  {
    // Invalid UTF-8 sequence [0xFF, 0xFE, 0xFD]
    const invalidBytes = Buffer.from([0xff, 0xfe, 0xfd, 0x61, 0x62, 0x63]);
    const lossyContent = invalidBytes.toString('utf8'); // Node replaces with replacement chars
    const result = validateUniversalConstraints(invalidBytes, lossyContent);
    assert.equal(result.valid, false);
    assert(result.errors.includes('INVALID_UTF8'));
    console.log('  ✓ Fatal UTF-8 decoding rejects malformed byte sequences with INVALID_UTF8');
    passed++;
  }

  // ============================================================
  // TEST F: NULL BYTE REJECTION
  // ============================================================
  console.log('\n[Test F] Null byte rejection:');
  {
    const nullBytes = Buffer.from('Hello \x00 World\n', 'binary');
    const nullContent = 'Hello \0 World\n';
    const result = validateUniversalConstraints(nullBytes, nullContent);
    assert.equal(result.valid, false);
    assert(result.errors.includes('NULL_BYTE_DETECTED'));
    console.log('  ✓ Null bytes in bytes or content rejected with NULL_BYTE_DETECTED');
    passed++;
  }

  // ============================================================
  // TEST G: READ-ONLY GENERIC REJECTION
  // ============================================================
  console.log('\n[Test G] Read-only generic rejection:');
  {
    const mockReadOnlyRecord: ControlledDocumentRecord = {
      id: 'DOC-MOCK-RO',
      path: 'docs/test.md',
      kind: 'CONTROL',
      authority: 'REFERENCE',
      editability: 'READ_ONLY',
      fileType: 'MARKDOWN',
      title: 'Mock Read-Only',
      editableLivingDoc: false,
    };
    const content = '# Title\nValid content\n';
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(mockReadOnlyRecord, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('DOCUMENT_READ_ONLY'));
    console.log('  ✓ Any document with editability !== CONTROLLED_EDIT rejected with DOCUMENT_READ_ONLY');
    passed++;
  }

  // ============================================================
  // TEST H: DOC-CTRL-003 REJECTION (MASTER_WBS.yaml)
  // ============================================================
  console.log('\n[Test H] DOC-CTRL-003 rejection:');
  {
    const content = 'schemaVersion: 1.0\nwbs: []\n';
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc003, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('DOCUMENT_READ_ONLY'));
    console.log('  ✓ DOC-CTRL-003 (MASTER_WBS.yaml) rejected with DOCUMENT_READ_ONLY');
    passed++;
  }

  // ============================================================
  // TEST I: DOC-CTRL-004 REJECTION (MASTER_WBS.md)
  // ============================================================
  console.log('\n[Test I] DOC-CTRL-004 rejection:');
  {
    const content = '# Master WBS\n\n- Task 1\n';
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc004, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('DOCUMENT_READ_ONLY'));
    console.log('  ✓ DOC-CTRL-004 (MASTER_WBS.md) rejected with DOCUMENT_READ_ONLY');
    passed++;
  }

  // ============================================================
  // TEST J: VALID PROJECT_STATE
  // ============================================================
  console.log('\n[Test J] Valid PROJECT_STATE:');
  {
    const content = `# docmonstakrakin current project state

## 2026-09-28 — Status Update

### Current governance and task status

- **DMK-195:** IN_PROGRESS
- **DMK-201:** VERIFICATION_PENDING
- **Gate 7:** HUMAN_APPROVAL_REQUIRED / NOT EXECUTED
- **Live reconciliation:** NOT AUTHORIZED
- **Release status:** v0.1.0-rc1
`;
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc002, rawBytes, content);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    console.log('  ✓ Well-formed PROJECT_STATE passes validation');
    passed++;
  }

  // ============================================================
  // TEST K: PROJECT_STATE WRONG TITLE
  // ============================================================
  console.log('\n[Test K] PROJECT_STATE wrong title:');
  {
    const badTitles = [
      '## docmonstakrakin current project state',
      '# Docmonstakrakin Current Project State',
      '# docmonstakrakin project state',
      '# completely wrong title',
    ];
    for (const title of badTitles) {
      const content = `${title}\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n`;
      const rawBytes = Buffer.from(content, 'utf8');
      const result = validateDocumentContent(doc002, rawBytes, content);
      assert.equal(result.valid, false);
      assert(result.errors.includes('PROJECT_STATE_TITLE_REQUIRED'));
    }
    console.log('  ✓ PROJECT_STATE requires exact canonical top-level title');
    passed++;
  }

  // ============================================================
  // TEST K2: PROJECT_STATE CODE-BLOCK TITLE REJECTION
  // ============================================================
  console.log('\n[Test K2] PROJECT_STATE code-block title rejection:');
  {
    const content = `    # docmonstakrakin current project state

### Current governance and task status

- **DMK-201:** VERIFICATION_PENDING
- **Gate 7:** HUMAN_APPROVAL_REQUIRED / NOT EXECUTED
- **Live reconciliation:** NOT AUTHORIZED
- **Release status:** v0.1.0-rc1
`;
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc002, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('PROJECT_STATE_TITLE_REQUIRED'));

    // Tab-indented title
    const tabContent = `\t# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n`;
    const tabResult = validateDocumentContent(doc002, Buffer.from(tabContent, 'utf8'), tabContent);
    assert.equal(tabResult.valid, false);
    assert(tabResult.errors.includes('PROJECT_STATE_TITLE_REQUIRED'));

    // Up to 3 leading spaces (valid Markdown ATX heading)
    const threeSpacesContent = `   # docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n`;
    const threeSpacesResult = validateDocumentContent(
      doc002,
      Buffer.from(threeSpacesContent, 'utf8'),
      threeSpacesContent
    );
    assert.equal(threeSpacesResult.valid, true);

    console.log('  ✓ 4+ leading spaces / tabs before title rejected; up to 3 spaces accepted');
    passed++;
  }

  // ============================================================
  // TEST L: PROJECT_STATE MISSING GOVERNANCE HEADING
  // ============================================================
  console.log('\n[Test L] PROJECT_STATE missing governance heading:');
  {
    const content = `# docmonstakrakin current project state

## Some other section

- DMK-201
- Gate 7
- Live reconciliation
- Release status
`;
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc002, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('PROJECT_STATE_GOVERNANCE_HEADING_REQUIRED'));
    console.log('  ✓ Missing governance heading rejected with PROJECT_STATE_GOVERNANCE_HEADING_REQUIRED');
    passed++;
  }

  // ============================================================
  // TEST M: PROJECT_STATE MISSING REQUIRED GOVERNANCE REFERENCES
  // ============================================================
  console.log('\n[Test M] PROJECT_STATE missing required governance references:');
  {
    const requiredInvariants: Array<{ name: string; missingText: string; expectedError: string }> = [
      { name: 'DMK-201', missingText: 'DMK-201', expectedError: 'PROJECT_STATE_MISSING_DMK_201' },
      { name: 'Gate 7', missingText: 'Gate 7', expectedError: 'PROJECT_STATE_MISSING_GATE_7' },
      { name: 'Live reconciliation', missingText: 'Live reconciliation', expectedError: 'PROJECT_STATE_MISSING_LIVE_RECONCILIATION' },
      { name: 'Release status', missingText: 'Release status', expectedError: 'PROJECT_STATE_MISSING_RELEASE_STATUS' },
    ];

    for (const inv of requiredInvariants) {
      const fullText = `# docmonstakrakin current project state

### Current governance and task status
- DMK-201
- Gate 7
- Live reconciliation
- Release status
`;
      const modifiedText = fullText.replace(inv.missingText, 'OMITTED');
      const rawBytes = Buffer.from(modifiedText, 'utf8');
      const result = validateDocumentContent(doc002, rawBytes, modifiedText);
      assert.equal(result.valid, false);
      assert(result.errors.includes(inv.expectedError), `Expected error ${inv.expectedError} when missing ${inv.name}`);
    }
    console.log('  ✓ Missing any of DMK-201, Gate 7, Live reconciliation, or Release status rejected');
    passed++;
  }

  // ============================================================
  // TEST N: VARIABLE GOVERNANCE HEADING DEPTH
  // ============================================================
  console.log('\n[Test N] Variable governance heading depth:');
  {
    const depths = ['#', '##', '###', '####', '#####', '######'];
    for (const d of depths) {
      const content = `# docmonstakrakin current project state\n\n${d} Current governance and task status\n\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n`;
      const rawBytes = Buffer.from(content, 'utf8');
      const result = validateDocumentContent(doc002, rawBytes, content);
      assert.equal(result.valid, true, `Heading depth ${d} must be valid`);
      assert.deepEqual(result.errors, []);
    }
    console.log('  ✓ Flexible heading depth for governance section accepted');
    passed++;
  }

  // ============================================================
  // TEST O: VALID TRACEABILITY MATRIX
  // ============================================================
  console.log('\n[Test O] Valid TRACEABILITY_MATRIX:');
  {
    const content = `# Requirements Traceability Matrix

| Requirement ID | Description | Work Item | Status |
| :--- | :--- | :--- | :--- |
| REQ-001 | Field masking | DMK-010 | VERIFIED |
| REQ-002 | Session tokens | DMK-085 | VERIFIED |
`;
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc006, rawBytes, content);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    console.log('  ✓ Valid pipe-delimited table with Requirement and Work Item passes');
    passed++;
  }

  // ============================================================
  // TEST P: TRACEABILITY MISSING TABLE
  // ============================================================
  console.log('\n[Test P] Traceability missing table:');
  {
    const content = `# Requirements Traceability Matrix\n\nNo table here, just some bullet points:\n- Point 1\n- Point 2\n`;
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc006, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('TRACEABILITY_TABLE_REQUIRED'));
    console.log('  ✓ Traceability without markdown table rejected with TRACEABILITY_TABLE_REQUIRED');
    passed++;
  }

  // ============================================================
  // TEST P2: TRACEABILITY CODE-BLOCK TABLE REJECTION
  // ============================================================
  console.log('\n[Test P2] Traceability code-block table rejection:');
  {
    const content = `# Requirements Traceability Matrix

    | Requirement | WBS |
    | --- | --- |
    | REQ-001 | DMK-001 |
`;
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc006, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('TRACEABILITY_TABLE_REQUIRED'));
    console.log('  ✓ Indented code block table rejected with TRACEABILITY_TABLE_REQUIRED');
    passed++;
  }

  // ============================================================
  // TEST Q: INVALID SEPARATOR
  // ============================================================
  console.log('\n[Test Q] Invalid separator:');
  {
    // Header present, but separator row is missing or malformed
    const noSepContent = `# RTM\n| Requirement ID | Work Item |\n| REQ-001 | DMK-001 |\n`;
    const badSepContent = `# RTM\n| Requirement ID | Work Item |\n| not-a-separator | also-not |\n| REQ-001 | DMK-001 |\n`;
    const mismatchedSep = `# RTM\n| Requirement ID | Work Item |\n| :--- | :--- | :--- |\n| REQ-001 | DMK-001 |\n`;

    for (const c of [noSepContent, badSepContent, mismatchedSep]) {
      const rawBytes = Buffer.from(c, 'utf8');
      const result = validateDocumentContent(doc006, rawBytes, c);
      assert.equal(result.valid, false);
      assert(result.errors.includes('TRACEABILITY_SEPARATOR_INVALID'));
    }
    console.log('  ✓ Missing, malformed, or column-mismatched separator rejected with TRACEABILITY_SEPARATOR_INVALID');
    passed++;
  }

  // ============================================================
  // TEST R: MISSING RECOGNIZED REQUIREMENT / WORKITEM HEADERS
  // ============================================================
  console.log('\n[Test R] Missing recognized Requirement/WorkItem headers:');
  {
    // Has table, but header lacks requirement or work item
    const content1 = `| Foo | Bar |\n| :--- | :--- |\n| 1 | 2 |\n`;
    const content2 = `| Requirement ID | Some Column |\n| :--- | :--- |\n| REQ-1 | A |\n`;
    const content3 = `| Work Item | Other Column |\n| :--- | :--- |\n| DMK-1 | B |\n`;

    for (const c of [content1, content2, content3]) {
      const rawBytes = Buffer.from(c, 'utf8');
      const result = validateDocumentContent(doc006, rawBytes, c);
      assert.equal(result.valid, false);
      assert(result.errors.includes('TRACEABILITY_HEADER_INVALID'));
    }
    console.log('  ✓ Table without both Requirement and WorkItem/WBS headers rejected with TRACEABILITY_HEADER_INVALID');
    passed++;
  }

  // ============================================================
  // TEST S: MALFORMED ROW COLUMN COUNT
  // ============================================================
  console.log('\n[Test S] Malformed row column count:');
  {
    const content = `| Requirement ID | Work Item | Status |\n| :--- | :--- | :--- |\n| REQ-001 | DMK-001 |\n`;
    const rawBytes = Buffer.from(content, 'utf8');
    const result = validateDocumentContent(doc006, rawBytes, content);
    assert.equal(result.valid, false);
    assert(result.errors.includes('TRACEABILITY_ROW_COLUMN_MISMATCH'));
    console.log('  ✓ Data row column count mismatch rejected with TRACEABILITY_ROW_COLUMN_MISMATCH');
    passed++;
  }

  // ============================================================
  // GOLDEN TEST 1: CURRENT PROJECT_STATE.md
  // ============================================================
  console.log('\n[Golden Test 1] Current repository PROJECT_STATE.md:');
  {
    const realPath = path.join(process.cwd(), 'docs', '00_control', 'PROJECT_STATE.md');
    const content = fs.readFileSync(realPath, 'utf8');
    const rawBytes = fs.readFileSync(realPath);
    const result = validateDocumentContent(doc002, rawBytes, content);
    assert.equal(result.valid, true, `Real PROJECT_STATE.md must be valid, got errors: ${result.errors.join(', ')}`);
    assert.deepEqual(result.errors, []);
    console.log('  ✓ Current docs/00_control/PROJECT_STATE.md passes validation completely');
    passed++;
  }

  // ============================================================
  // GOLDEN TEST 2: CURRENT TRACEABILITY_MATRIX.md
  // ============================================================
  console.log('\n[Golden Test 2] Current repository TRACEABILITY_MATRIX.md:');
  {
    const realPath = path.join(process.cwd(), 'docs', '00_control', 'TRACEABILITY_MATRIX.md');
    const content = fs.readFileSync(realPath, 'utf8');
    const rawBytes = fs.readFileSync(realPath);
    const result = validateDocumentContent(doc006, rawBytes, content);
    assert.equal(result.valid, true, `Real TRACEABILITY_MATRIX.md must be valid, got errors: ${result.errors.join(', ')}`);
    assert.deepEqual(result.errors, []);
    console.log('  ✓ Current docs/00_control/TRACEABILITY_MATRIX.md passes validation completely');
    passed++;
  }

  // ============================================================
  // TEST T: IDENTICAL DOCUMENT DIFF
  // ============================================================
  console.log('\n[Test T] Identical document diff:');
  {
    const text = 'alpha\nbeta\ngamma\n';
    const hash = 'a'.repeat(64);
    const diff = computeDocumentDiff({
      originalContent: text,
      candidateContent: text,
      baseSha256: hash,
      currentSha256: hash,
      candidateSha256: hash,
    });

    assert.equal(diff.additions, 0);
    assert.equal(diff.deletions, 0);
    assert.equal(diff.changedLines, 0);
    assert.equal(diff.hasChanges, false);
    assert.equal(diff.isStale, false);
    assert.equal(diff.unifiedDiff, '');
    console.log('  ✓ Identical document reports 0 additions, 0 deletions, no changes, empty diff');
    passed++;
  }

  // ============================================================
  // TEST U: SIMPLE ADDITION DIFF
  // ============================================================
  console.log('\n[Test U] Simple addition diff:');
  {
    const orig = 'alpha\nbeta\n';
    const cand = 'alpha\nbeta\ngamma\n';
    const diff = computeDocumentDiff({
      originalContent: orig,
      candidateContent: cand,
      baseSha256: 'hash-orig',
      currentSha256: 'hash-orig',
      candidateSha256: 'hash-cand',
    });

    assert.equal(diff.additions, 1);
    assert.equal(diff.deletions, 0);
    assert.equal(diff.changedLines, 1);
    assert.equal(diff.hasChanges, true);
    assert(diff.unifiedDiff.includes('+gamma'));
    console.log('  ✓ Simple addition reports 1 addition, 0 deletions, 1 changedLine, +gamma');
    passed++;
  }

  // ============================================================
  // TEST V: SIMPLE DELETION DIFF
  // ============================================================
  console.log('\n[Test V] Simple deletion diff:');
  {
    const orig = 'alpha\nbeta\ngamma\n';
    const cand = 'alpha\ngamma\n';
    const diff = computeDocumentDiff({
      originalContent: orig,
      candidateContent: cand,
      baseSha256: 'hash-orig',
      currentSha256: 'hash-orig',
      candidateSha256: 'hash-cand',
    });

    assert.equal(diff.additions, 0);
    assert.equal(diff.deletions, 1);
    assert.equal(diff.changedLines, 1);
    assert.equal(diff.hasChanges, true);
    assert(diff.unifiedDiff.includes('-beta'));
    console.log('  ✓ Simple deletion reports 0 additions, 1 deletion, 1 changedLine, -beta');
    passed++;
  }

  // ============================================================
  // TEST W: SIMPLE REPLACEMENT DIFF
  // ============================================================
  console.log('\n[Test W] Simple replacement diff:');
  {
    const orig = 'alpha\nold\nomega\n';
    const cand = 'alpha\nnew\nomega\n';
    const diff = computeDocumentDiff({
      originalContent: orig,
      candidateContent: cand,
      baseSha256: 'hash-orig',
      currentSha256: 'hash-orig',
      candidateSha256: 'hash-cand',
    });

    assert.equal(diff.additions, 1);
    assert.equal(diff.deletions, 1);
    assert.equal(diff.changedLines, 2);
    assert.equal(diff.hasChanges, true);
    assert(diff.unifiedDiff.includes('-old'));
    assert(diff.unifiedDiff.includes('+new'));
    console.log('  ✓ Simple replacement reports 1 addition, 1 deletion, 2 changedLines, -old/+new');
    passed++;
  }

  // ============================================================
  // TEST X: MULTIPLE SEPARATED CHANGES
  // ============================================================
  console.log('\n[Test X] Multiple separated changes:');
  {
    const origLines = [
      'line 1',
      'line 2 (old A)',
      'line 3',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
      'line 8',
      'line 9',
      'line 10',
      'line 11',
      'line 12',
      'line 13',
      'line 14',
      'line 15 (old B)',
      'line 16',
    ];
    const candLines = [
      'line 1',
      'line 2 (new A)',
      'line 3',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
      'line 8',
      'line 9',
      'line 10',
      'line 11',
      'line 12',
      'line 13',
      'line 14',
      'line 15 (new B)',
      'line 16',
    ];
    const diff = computeDocumentDiff({
      originalContent: origLines.join('\n') + '\n',
      candidateContent: candLines.join('\n') + '\n',
      baseSha256: 'hash-1',
      currentSha256: 'hash-1',
      candidateSha256: 'hash-2',
    });

    assert.equal(diff.additions, 2);
    assert.equal(diff.deletions, 2);
    assert.equal(diff.changedLines, 4);
    assert.equal(diff.hasChanges, true);
    // Must contain 2 hunks because separation > 2 * 3 context lines
    const hunkMatches = diff.unifiedDiff.match(/^@@\s/gm);
    assert(hunkMatches && hunkMatches.length === 2, `Expected 2 hunks, got ${hunkMatches?.length}`);
    assert(diff.unifiedDiff.includes('-line 2 (old A)'));
    assert(diff.unifiedDiff.includes('+line 2 (new A)'));
    assert(diff.unifiedDiff.includes('-line 15 (old B)'));
    assert(diff.unifiedDiff.includes('+line 15 (new B)'));
    console.log('  ✓ Separated changes form distinct hunks with correct context and counts');
    passed++;
  }

  // ============================================================
  // TEST Y: REPEATED LINE DETERMINISM
  // ============================================================
  console.log('\n[Test Y] Repeated-line determinism:');
  {
    const orig = 'a\nsame\nsame\nb\n';
    const cand = 'a\nsame\nchanged\nb\n';
    const firstResult = computeDocumentDiff({
      originalContent: orig,
      candidateContent: cand,
      baseSha256: 'h1',
      currentSha256: 'h1',
      candidateSha256: 'h2',
    });

    for (let i = 0; i < 10; i++) {
      const nextResult = computeDocumentDiff({
        originalContent: orig,
        candidateContent: cand,
        baseSha256: 'h1',
        currentSha256: 'h1',
        candidateSha256: 'h2',
      });
      assert.deepEqual(nextResult, firstResult);
    }
    console.log('  ✓ Repeated identical lines yield deterministic diff output across repeated runs');
    passed++;
  }

  // ============================================================
  // TEST Z: STALE BASE HASH
  // ============================================================
  console.log('\n[Test Z] Stale base hash:');
  {
    const diff = computeDocumentDiff({
      originalContent: 'hello\n',
      candidateContent: 'hello world\n',
      baseSha256: 'base-old',
      currentSha256: 'current-new',
      candidateSha256: 'candidate-hash',
    });

    assert.equal(diff.isStale, true);
    assert.equal(diff.oldHash, 'current-new');
    console.log('  ✓ baseSha256 !== currentSha256 marks isStale === true');
    passed++;
  }

  // ============================================================
  // TEST AA: NON-STALE BASE HASH
  // ============================================================
  console.log('\n[Test AA] Non-stale base hash:');
  {
    const diff = computeDocumentDiff({
      originalContent: 'hello\n',
      candidateContent: 'hello world\n',
      baseSha256: 'matching-hash',
      currentSha256: 'matching-hash',
      candidateSha256: 'candidate-hash',
    });

    assert.equal(diff.isStale, false);
    assert.equal(diff.oldHash, 'matching-hash');
    console.log('  ✓ baseSha256 === currentSha256 marks isStale === false');
    passed++;
  }

  // ============================================================
  // TEST AB: CANDIDATE HASH PASSED THROUGH UNCHANGED
  // ============================================================
  console.log('\n[Test AB] Candidate hash passed through unchanged:');
  {
    const arbitraryCandidateHash = 'EXACT-UNTOUCHED-OPAQUE-CANDIDATE-HASH-12345';
    const diff = computeDocumentDiff({
      originalContent: 'alpha\n',
      candidateContent: 'beta\n',
      baseSha256: 'h0',
      currentSha256: 'h1',
      candidateSha256: arbitraryCandidateHash,
    });

    assert.equal(diff.candidateHash, arbitraryCandidateHash);
    console.log('  ✓ candidateSha256 is passed through verbatim without re-hashing candidate content');
    passed++;
  }

  // ============================================================
  // TEST AC: CRLF/LF LOGICAL EQUIVALENCE
  // ============================================================
  console.log('\n[Test AC] CRLF/LF logical equivalence:');
  {
    const origCRLF = 'line 1\r\nline 2\r\nline 3\r\n';
    const candLF = 'line 1\nline 2\nline 3\n';
    const diff = computeDocumentDiff({
      originalContent: origCRLF,
      candidateContent: candLF,
      baseSha256: 'h-same',
      currentSha256: 'h-same',
      candidateSha256: 'h-same',
    });

    assert.equal(diff.additions, 0);
    assert.equal(diff.deletions, 0);
    assert.equal(diff.changedLines, 0);
    assert.equal(diff.hasChanges, false);
    assert.equal(diff.unifiedDiff, '');
    console.log('  ✓ Logical line comparison normalizes CRLF and LF as identical lines');
    passed++;
  }

  // ============================================================
  // TEST AD: FINAL NEWLINE DIFFERENCE
  // ============================================================
  console.log('\n[Test AD] Final newline difference:');
  {
    const withNewline = 'alpha\nbeta\n';
    const withoutNewline = 'alpha\nbeta';

    const diff1 = computeDocumentDiff({
      originalContent: withNewline,
      candidateContent: withoutNewline,
      baseSha256: 'h-with',
      currentSha256: 'h-with',
      candidateSha256: 'h-without',
    });

    assert.equal(diff1.hasChanges, true);
    assert(diff1.changedLines > 0);
    assert(diff1.unifiedDiff.includes('No newline at end of file') || diff1.unifiedDiff.includes('beta'));

    const diff2 = computeDocumentDiff({
      originalContent: withoutNewline,
      candidateContent: withNewline,
      baseSha256: 'h-without',
      currentSha256: 'h-without',
      candidateSha256: 'h-with',
    });

    assert.equal(diff2.hasChanges, true);
    assert(diff2.changedLines > 0);
    console.log('  ✓ Adding or removing final newline detected as content change');
    passed++;
  }

  // ============================================================
  // TEST AE: DETERMINISTIC UNIFIED DIFF OUTPUT
  // ============================================================
  console.log('\n[Test AE] Deterministic unified diff output:');
  {
    const orig = 'alpha\nold\nomega\n';
    const cand = 'alpha\nnew\nomega\n';
    const diff = computeDocumentDiff({
      originalContent: orig,
      candidateContent: cand,
      baseSha256: 'h1',
      currentSha256: 'h1',
      candidateSha256: 'h2',
    });

    const expectedDiff = [
      '--- original',
      '+++ candidate',
      '@@ -1,3 +1,3 @@',
      ' alpha',
      '-old',
      '+new',
      ' omega',
    ].join('\n');

    assert.equal(diff.unifiedDiff, expectedDiff);
    assert(!diff.unifiedDiff.includes('\r\n'), 'unifiedDiff must always use LF');
    console.log('  ✓ Unified diff output matches standard format with LF newlines');
    passed++;
  }

  console.log(`\nAll ${passed} tests in testControlledDocsValidator.ts passed!`);
}

runTests().catch((err) => {
  console.error('\nFAIL in testControlledDocsValidator.ts:', err);
  process.exit(1);
});
