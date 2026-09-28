import type { ControlledDocumentRecord } from '../../src/types.ts';

export interface DocumentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DocumentDiffResult {
  oldHash: string;
  candidateHash: string;
  isStale: boolean;
  hasChanges: boolean;
  additions: number;
  deletions: number;
  changedLines: number;
  unifiedDiff: string;
}

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates universal payload constraints:
 * - Size strictly less than 5 MB
 * - Non-empty meaningful content
 * - Valid UTF-8 encoding (fatal decode check)
 * - Absence of null bytes in raw bytes and content string
 */
export function validateUniversalConstraints(
  rawBytes: Buffer,
  content: string
): DocumentValidationResult {
  const errors: string[] = [];

  if (rawBytes.length >= MAX_DOCUMENT_BYTES) {
    errors.push('DOCUMENT_TOO_LARGE');
  }

  if (content.trim().length === 0) {
    errors.push('DOCUMENT_EMPTY');
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
  } catch {
    errors.push('INVALID_UTF8');
  }

  if (rawBytes.includes(0x00) || content.includes('\0')) {
    errors.push('NULL_BYTE_DETECTED');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

/**
 * Validates document content against registry authority and document-specific invariants:
 * - Universal constraints evaluated first
 * - docRecord.editability must be CONTROLLED_EDIT
 * - DOC-CTRL-002: Exact canonical title, governance heading, required governance references
 * - DOC-CTRL-006: Valid Markdown table structure, recognized headers, consistent column counts
 */
export function validateDocumentContent(
  docRecord: ControlledDocumentRecord,
  rawBytes: Buffer,
  candidateContent: string
): DocumentValidationResult {
  const universal = validateUniversalConstraints(rawBytes, candidateContent);
  if (!universal.valid) {
    return universal;
  }

  if (docRecord.editability !== 'CONTROLLED_EDIT') {
    return {
      valid: false,
      errors: ['DOCUMENT_READ_ONLY'],
      warnings: [],
    };
  }

  const errors: string[] = [];

  if (docRecord.id === 'DOC-CTRL-002') {
    validateProjectStateStructure(candidateContent, errors);
  } else if (docRecord.id === 'DOC-CTRL-006') {
    validateTraceabilityStructure(candidateContent, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

function validateProjectStateStructure(content: string, errors: string[]): void {
  const lines = content.split(/\r?\n/);
  const rawFirstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (
    !rawFirstNonEmpty ||
    !/^ {0,3}# docmonstakrakin current project state[ \t]*$/.test(rawFirstNonEmpty)
  ) {
    errors.push('PROJECT_STATE_TITLE_REQUIRED');
  }

  const governanceHeadingRegex = /^#{1,6}\s+Current governance and task status\s*$/m;
  if (!governanceHeadingRegex.test(content)) {
    errors.push('PROJECT_STATE_GOVERNANCE_HEADING_REQUIRED');
  }

  if (!content.includes('DMK-201')) {
    errors.push('PROJECT_STATE_MISSING_DMK_201');
  }
  if (!content.includes('Gate 7')) {
    errors.push('PROJECT_STATE_MISSING_GATE_7');
  }
  if (!content.includes('Live reconciliation')) {
    errors.push('PROJECT_STATE_MISSING_LIVE_RECONCILIATION');
  }
  if (!content.includes('Release status')) {
    errors.push('PROJECT_STATE_MISSING_RELEASE_STATUS');
  }
}

function parseTableRow(line: string): string[] | null {
  if (!/^ {0,3}\S/.test(line)) {
    return null;
  }
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  let s = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  if (s.endsWith('|')) s = s.slice(0, -1);
  const cells = s.split('|').map((c) => c.trim());
  return cells.length >= 2 ? cells : null;
}

function isDelimiterRow(cells: string[]): boolean {
  return cells.length >= 2 && cells.every((c) => /^:?-+:?$/.test(c));
}

function validateTraceabilityStructure(content: string, errors: string[]): void {
  const lines = content.split(/\r?\n/);
  let tableFound = false;
  let recognizedHeaderFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) continue;
    const cells = parseTableRow(line);
    if (!cells) continue;

    const hasReq = cells.some((c) => /requirement/i.test(c));
    const hasWorkItem = cells.some((c) => /work\s*item|wbs/i.test(c));

    if (hasReq || hasWorkItem) {
      tableFound = true;
      if (hasReq && hasWorkItem) {
        recognizedHeaderFound = true;
        if (i + 1 >= lines.length) {
          errors.push('TRACEABILITY_SEPARATOR_INVALID');
          return;
        }
        const sepLine = lines[i + 1];
        const sepCells = parseTableRow(sepLine);
        if (!sepCells || !isDelimiterRow(sepCells) || sepCells.length !== cells.length) {
          errors.push('TRACEABILITY_SEPARATOR_INVALID');
          return;
        }

        let r = i + 2;
        while (r < lines.length && lines[r].trim().length > 0 && lines[r].includes('|')) {
          const rowCells = parseTableRow(lines[r]);
          if (!rowCells || rowCells.length !== cells.length) {
            errors.push('TRACEABILITY_ROW_COLUMN_MISMATCH');
            return;
          }
          r++;
        }
        i = r - 1;
      } else {
        errors.push('TRACEABILITY_HEADER_INVALID');
        return;
      }
    } else {
      tableFound = true;
    }
  }

  if (!tableFound) {
    errors.push('TRACEABILITY_TABLE_REQUIRED');
    return;
  }

  if (!recognizedHeaderFound && !errors.includes('TRACEABILITY_HEADER_INVALID')) {
    errors.push('TRACEABILITY_HEADER_INVALID');
  }
}

// ============================================================
// DIFF ENGINE (MYERS SES & UNIFIED DIFF)
// ============================================================

interface LogicalDocument {
  lines: string[];
  hasTrailingNewline: boolean;
}

function splitLogicalLinesPreservingFinalNewline(text: string): LogicalDocument {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized.length === 0) {
    return { lines: [], hasTrailingNewline: false };
  }
  const hasTrailingNewline = normalized.endsWith('\n');
  const body = hasTrailingNewline ? normalized.slice(0, -1) : normalized;
  const lines = body.length === 0 ? [] : body.split('\n');
  return { lines, hasTrailingNewline };
}

type EditOpType = 'EQUAL' | 'DELETE' | 'INSERT';

interface EditOp {
  type: EditOpType;
  line: string;
}

function myersDiff(a: string[], b: string[]): EditOp[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const v = new Int32Array(2 * max + 1);
  const trace: Int32Array[] = [];
  let foundD = -1;

  for (let d = 0; d <= max; d++) {
    trace.push(new Int32Array(v));
    for (let k = -d; k <= d; k += 2) {
      const kIdx = k + max;
      let x: number;
      if (k === -d || (k !== d && v[kIdx - 1] < v[kIdx + 1])) {
        x = v[kIdx + 1];
      } else {
        x = v[kIdx - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[kIdx] = x;
      if (x >= n && y >= m) {
        foundD = d;
        break;
      }
    }
    if (foundD !== -1) break;
  }

  const edits: EditOp[] = [];
  let x = n;
  let y = m;

  for (let d = foundD; d > 0; d--) {
    const k = x - y;
    const kIdx = k + max;
    const vPrev = trace[d];
    let prevK: number;
    if (k === -d || (k !== d && vPrev[kIdx - 1] < vPrev[kIdx + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vPrev[prevK + max];
    const prevY = prevX - prevK;

    while (
      x > prevX &&
      y > prevY &&
      ((prevK === k + 1 && y > prevY + 1) || (prevK === k - 1 && x > prevX + 1))
    ) {
      edits.push({ type: 'EQUAL', line: a[x - 1] });
      x--;
      y--;
    }

    if (prevK === k - 1) {
      edits.push({ type: 'DELETE', line: a[prevX] });
      x = prevX;
    } else {
      edits.push({ type: 'INSERT', line: b[prevY] });
      y = prevY;
    }
  }

  while (x > 0 && y > 0) {
    edits.push({ type: 'EQUAL', line: a[x - 1] });
    x--;
    y--;
  }

  return edits.reverse();
}

function computeLineEdits(a: string[], b: string[]): EditOp[] {
  const n = a.length;
  const m = b.length;

  let prefixLen = 0;
  while (prefixLen < n && prefixLen < m && a[prefixLen] === b[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < n - prefixLen &&
    suffixLen < m - prefixLen &&
    a[n - 1 - suffixLen] === b[m - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const sliceA = a.slice(prefixLen, n - suffixLen);
  const sliceB = b.slice(prefixLen, m - suffixLen);

  const middleEdits = myersDiff(sliceA, sliceB);

  const edits: EditOp[] = [];
  for (let i = 0; i < prefixLen; i++) {
    edits.push({ type: 'EQUAL', line: a[i] });
  }
  for (const e of middleEdits) {
    edits.push(e);
  }
  for (let i = n - suffixLen; i < n; i++) {
    edits.push({ type: 'EQUAL', line: a[i] });
  }

  return edits;
}

function renderUnifiedDiff(
  edits: EditOp[],
  origDoc: LogicalDocument,
  candDoc: LogicalDocument,
  context = 3
): string {
  const changes: number[] = [];
  for (let i = 0; i < edits.length; i++) {
    if (edits[i].type !== 'EQUAL') {
      changes.push(i);
    }
  }
  if (changes.length === 0) {
    return '';
  }

  const clusters: number[][] = [];
  let currentCluster = [changes[0]];
  for (let i = 1; i < changes.length; i++) {
    const prev = changes[i - 1];
    const curr = changes[i];
    if (curr - prev <= 2 * context + 1) {
      currentCluster.push(curr);
    } else {
      clusters.push(currentCluster);
      currentCluster = [curr];
    }
  }
  clusters.push(currentCluster);

  let origLine = 1;
  let candLine = 1;
  const editLineInfo: Array<{ orig?: number; cand?: number }> = [];
  for (const edit of edits) {
    editLineInfo.push({
      orig: edit.type !== 'INSERT' ? origLine : undefined,
      cand: edit.type !== 'DELETE' ? candLine : undefined,
    });
    if (edit.type !== 'INSERT') origLine++;
    if (edit.type !== 'DELETE') candLine++;
  }

  const totalOrigLines = origDoc.lines.length;
  const totalCandLines = candDoc.lines.length;

  const hunks: string[] = [];
  for (const cluster of clusters) {
    const firstChange = cluster[0];
    const lastChange = cluster[cluster.length - 1];

    const hunkStart = Math.max(0, firstChange - context);
    const hunkEnd = Math.min(edits.length - 1, lastChange + context);

    let origStart = 0;
    let origCount = 0;
    let candStart = 0;
    let candCount = 0;

    for (let i = hunkStart; i <= hunkEnd; i++) {
      const edit = edits[i];
      if (edit.type !== 'INSERT') {
        if (origStart === 0 && editLineInfo[i].orig !== undefined) {
          origStart = editLineInfo[i].orig!;
        }
        origCount++;
      }
      if (edit.type !== 'DELETE') {
        if (candStart === 0 && editLineInfo[i].cand !== undefined) {
          candStart = editLineInfo[i].cand!;
        }
        candCount++;
      }
    }

    if (origStart === 0) {
      origStart = hunkStart > 0 ? editLineInfo[hunkStart - 1].orig || 1 : 0;
    }
    if (candStart === 0) {
      candStart = hunkStart > 0 ? editLineInfo[hunkStart - 1].cand || 1 : 0;
    }

    const origHeader = origCount === 1 ? `${origStart}` : `${origStart},${origCount}`;
    const candHeader = candCount === 1 ? `${candStart}` : `${candStart},${candCount}`;
    const header = `@@ -${origHeader} +${candHeader} @@`;

    const hunkLines = [header];
    for (let i = hunkStart; i <= hunkEnd; i++) {
      const edit = edits[i];
      const isLastOrig = editLineInfo[i].orig === totalOrigLines;
      const isLastCand = editLineInfo[i].cand === totalCandLines;

      if (edit.type === 'EQUAL') {
        hunkLines.push(` ${edit.line}`);
        if (isLastOrig && !origDoc.hasTrailingNewline) {
          hunkLines.push('\\ No newline at end of file');
        }
      } else if (edit.type === 'DELETE') {
        hunkLines.push(`-${edit.line}`);
        if (isLastOrig && !origDoc.hasTrailingNewline) {
          hunkLines.push('\\ No newline at end of file');
        }
      } else if (edit.type === 'INSERT') {
        hunkLines.push(`+${edit.line}`);
        if (isLastCand && !candDoc.hasTrailingNewline) {
          hunkLines.push('\\ No newline at end of file');
        }
      }
    }
    hunks.push(hunkLines.join('\n'));
  }

  return ['--- original', '+++ candidate', ...hunks].join('\n');
}

/**
 * Computes logical line diff between original and candidate documents.
 * Pure function: does not perform encoding, disk operations, or recompute candidateSha256.
 */
export function computeDocumentDiff(params: {
  originalContent: string;
  candidateContent: string;
  baseSha256: string;
  currentSha256: string;
  candidateSha256: string;
}): DocumentDiffResult {
  const { originalContent, candidateContent, baseSha256, currentSha256, candidateSha256 } = params;

  const isStale = baseSha256 !== currentSha256;

  const origDoc = splitLogicalLinesPreservingFinalNewline(originalContent);
  const candDoc = splitLogicalLinesPreservingFinalNewline(candidateContent);

  const edits = computeLineEdits(origDoc.lines, candDoc.lines);

  // If text lines are identical but trailing newline differs
  if (
    origDoc.lines.length === candDoc.lines.length &&
    origDoc.hasTrailingNewline !== candDoc.hasTrailingNewline &&
    origDoc.lines.length > 0 &&
    edits.every((e) => e.type === 'EQUAL')
  ) {
    const lastIdx = edits.length - 1;
    const lastLine = edits[lastIdx].line;
    edits.splice(
      lastIdx,
      1,
      { type: 'DELETE', line: lastLine },
      { type: 'INSERT', line: lastLine }
    );
  }

  let additions = 0;
  let deletions = 0;
  for (const edit of edits) {
    if (edit.type === 'INSERT') additions++;
    else if (edit.type === 'DELETE') deletions++;
  }

  const changedLines = additions + deletions;
  const hasChanges = currentSha256 !== candidateSha256 || additions > 0 || deletions > 0;

  let unifiedDiff = '';
  if (changedLines > 0) {
    unifiedDiff = renderUnifiedDiff(edits, origDoc, candDoc, 3);
  }

  return {
    oldHash: currentSha256,
    candidateHash: candidateSha256,
    isStale,
    hasChanges,
    additions,
    deletions,
    changedLines,
    unifiedDiff,
  };
}
