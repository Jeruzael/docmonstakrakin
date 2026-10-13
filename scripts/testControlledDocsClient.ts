/**
 * testControlledDocsClient.ts
 * Comprehensive test suite for Task 9: Controlled Docs Frontend Client, Types, and Session Display.
 */

import assert from 'node:assert';
import { createControlledDocsLoader } from '../src/data/controlledDocsClient.js';
import type {
  ControlledDocumentSummary,
  DocumentContentResponse,
  DocumentDiffResponse,
  DocumentValidationResponse,
  DocumentSaveInput,
  DocumentSaveResponse,
  ReviewerSessionInfo,
  DetectedEol,
} from '../src/types.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

// Helper to create a fake fetch Response
function jsonResponse(status: number, data: any): Response {
  const body = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

function textResponse(status: number, text: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'Content-Type': 'text/plain' }),
    json: async () => {
      throw new Error('Not JSON');
    },
    text: async () => text,
  } as unknown as Response;
}

const sampleSummary: ControlledDocumentSummary = {
  id: 'DOC-CTRL-002',
  path: 'docs/00_control/PROJECT_STATE.md',
  kind: 'CONTROL',
  authority: 'GENERATED_PROJECTION',
  editability: 'CONTROLLED_EDIT',
  fileType: 'MARKDOWN',
  title: 'Project State Document',
  description: 'Tracks state',
  integrityStatus: 'MATCH',
  sha256Digest: 'a'.repeat(64),
  currentSha256: 'a'.repeat(64),
  sizeBytes: 1234,
  eol: 'LF',
};

async function runTests(): Promise<void> {
  console.log('================================================================');
  console.log('    CONTROLLED DOCS FRONTEND CLIENT & TYPES TEST SUITE (DMK-195) ');
  console.log('================================================================\n');

  // =========================================================================
  // Group 1: Document List (Section 42)
  // =========================================================================

  await test('Test 1A: loadDocumentList uses correct URL, method, and credentials', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(200, [sampleSummary]);
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const list = await loader.loadDocumentList('PRJ-DOCMONSTAKRAKIN');

    assert.strictEqual(capturedUrl, '/api/projects/PRJ-DOCMONSTAKRAKIN/docs');
    assert.strictEqual(capturedInit?.method, 'GET');
    assert.strictEqual(capturedInit?.credentials, 'same-origin');
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 'DOC-CTRL-002');
  });

  await test('Test 1B: loadDocumentList validates well-formed list', async () => {
    const fakeFetch: typeof fetch = async () => {
      return jsonResponse(200, [
        sampleSummary,
        {
          id: 'DOC-CTRL-001',
          path: 'docs/00_control/MASTER_WBS.yaml',
          kind: 'CONTROL',
          authority: 'REFERENCE',
          editability: 'READ_ONLY',
          fileType: 'YAML',
          title: 'Master WBS',
          integrityStatus: 'UNPINNED',
          currentSha256: null,
        },
      ]);
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const list = await loader.loadDocumentList('PRJ-DOCMONSTAKRAKIN');
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[1].currentSha256, null);
    assert.strictEqual(list[1].integrityStatus, 'UNPINNED');
  });

  await test('Test 1C: loadDocumentList rejects non-array response', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse(200, { notAnArray: true });
    const loader = createControlledDocsLoader(fakeFetch);
    await assert.rejects(
      () => loader.loadDocumentList('PRJ-DOCMONSTAKRAKIN'),
      (err: Error) => err.message.includes('Invalid controlled document list response.')
    );
  });

  await test('Test 1D: loadDocumentList rejects malformed summary item', async () => {
    const malformed = [
      { ...sampleSummary, id: '' }, // empty id
      { ...sampleSummary, kind: 'INVALID_KIND' },
      { ...sampleSummary, authority: 'INVALID_AUTH' },
      { ...sampleSummary, editability: 'INVALID_EDIT' },
      { ...sampleSummary, fileType: 'INVALID_TYPE' },
      { ...sampleSummary, integrityStatus: 'INVALID_INTEGRITY' },
      { ...sampleSummary, currentSha256: 'short-sha' },
      { ...sampleSummary, sizeBytes: -5 },
      { ...sampleSummary, eol: 'INVALID_EOL' },
    ];

    for (const item of malformed) {
      const fakeFetch: typeof fetch = async () => jsonResponse(200, [item]);
      const loader = createControlledDocsLoader(fakeFetch);
      await assert.rejects(
        () => loader.loadDocumentList('PRJ-DOCMONSTAKRAKIN'),
        (err: Error) => err.message.includes('Invalid controlled document list response.')
      );
    }
  });

  await test('Test 1E: loadDocumentList accepts all integrity statuses (MATCH, CHANGED, UNPINNED, MISSING)', async () => {
    const statuses = ['MATCH', 'CHANGED', 'UNPINNED', 'MISSING'] as const;
    for (const status of statuses) {
      const fakeFetch: typeof fetch = async () =>
        jsonResponse(200, [{ ...sampleSummary, integrityStatus: status }]);
      const loader = createControlledDocsLoader(fakeFetch);
      const list = await loader.loadDocumentList('PRJ-DOCMONSTAKRAKIN');
      assert.strictEqual(list[0].integrityStatus, status);
    }
  });

  // =========================================================================
  // Group 2: Document Content (Section 43)
  // =========================================================================

  await test('Test 2A: loadDocumentContent uses URL-encoded IDs and GET method', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(200, {
        document: sampleSummary,
        content: '# Test content\n',
        rawSha256: 'b'.repeat(64),
        eol: 'LF',
        sizeBytes: 15,
      });
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const res = await loader.loadDocumentContent('PRJ/SPECIAL', 'DOC/ID?1');

    assert.strictEqual(capturedUrl, '/api/projects/PRJ%2FSPECIAL/docs/DOC%2FID%3F1');
    assert.strictEqual(capturedInit?.method, 'GET');
    assert.strictEqual(capturedInit?.credentials, 'same-origin');
    assert.strictEqual(res.content, '# Test content\n');
    assert.strictEqual(res.eol, 'LF');
    assert.strictEqual(res.rawSha256, 'b'.repeat(64));
  });

  await test('Test 2B: loadDocumentContent rejects malformed rawSha256, eol, or sizeBytes', async () => {
    const baseContent = {
      document: sampleSummary,
      content: '# Hello',
      rawSha256: 'b'.repeat(64),
      eol: 'LF',
      sizeBytes: 7,
    };

    const malformed = [
      { ...baseContent, rawSha256: 'not-64-hex' },
      { ...baseContent, eol: 'CR' },
      { ...baseContent, sizeBytes: -1 },
      { ...baseContent, sizeBytes: 'seven' },
      { ...baseContent, content: 123 },
    ];

    for (const bad of malformed) {
      const fakeFetch: typeof fetch = async () => jsonResponse(200, bad);
      const loader = createControlledDocsLoader(fakeFetch);
      await assert.rejects(
        () => loader.loadDocumentContent('PRJ', 'DOC'),
        (err: Error) => err.message.includes('Invalid controlled document content response.')
      );
    }
  });

  await test('Test 2C: loadDocumentContent rejects malformed nested document summary', async () => {
    const fakeFetch: typeof fetch = async () =>
      jsonResponse(200, {
        document: { ...sampleSummary, id: '' },
        content: '# Hello',
        rawSha256: 'b'.repeat(64),
        eol: 'LF',
        sizeBytes: 7,
      });
    const loader = createControlledDocsLoader(fakeFetch);
    await assert.rejects(
      () => loader.loadDocumentContent('PRJ', 'DOC'),
      (err: Error) => err.message.includes('Invalid controlled document content response.')
    );
  });

  // =========================================================================
  // Group 3: Document Diff (Section 44)
  // =========================================================================

  await test('Test 3A: requestDiff sends EXACT request body and verifies response parsing', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(200, {
        documentId: 'DOC-CTRL-002',
        oldHash: 'a'.repeat(64),
        candidateHash: 'b'.repeat(64),
        isStale: false,
        hasChanges: true,
        additions: 3,
        deletions: 1,
        changedLines: 4,
        unifiedDiff: '@@ -1 +1 @@\n-old\n+new',
      });
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const diff = await loader.requestDiff(
      'PRJ-1',
      'DOC-CTRL-002',
      '# Candidate Content\n',
      'A'.repeat(64) // Uppercase caller baseSha256
    );

    assert.strictEqual(capturedUrl, '/api/projects/PRJ-1/docs/DOC-CTRL-002/diff');
    assert.strictEqual(capturedInit?.method, 'POST');
    assert.strictEqual(
      (capturedInit?.headers as Record<string, string>)?.['Content-Type'],
      'application/json'
    );
    assert.strictEqual(capturedInit?.credentials, 'same-origin');

    // Verify EXACT body keys
    const parsedBody = JSON.parse(String(capturedInit?.body));
    assert.deepStrictEqual(Object.keys(parsedBody).sort(), ['baseSha256', 'candidateContent']);
    assert.strictEqual(parsedBody.candidateContent, '# Candidate Content\n');
    assert.strictEqual(parsedBody.baseSha256, 'A'.repeat(64)); // caller casing preserved

    // Verify parsed diff response
    assert.strictEqual(diff.documentId, 'DOC-CTRL-002');
    assert.strictEqual(diff.oldHash, 'a'.repeat(64));
    assert.strictEqual(diff.isStale, false);
    assert.strictEqual(diff.hasChanges, true);
    assert.strictEqual(diff.changedLines, 4);
    assert.strictEqual(diff.changedLines, diff.additions + diff.deletions);
  });

  await test('Test 3B: requestDiff rejects changedLines arithmetic mismatch or malformed diff response', async () => {
    const validDiff = {
      documentId: 'DOC-CTRL-002',
      oldHash: 'a'.repeat(64),
      candidateHash: 'b'.repeat(64),
      isStale: false,
      hasChanges: true,
      additions: 3,
      deletions: 1,
      changedLines: 4,
      unifiedDiff: 'diff text',
    };

    const malformed = [
      { ...validDiff, changedLines: 99 }, // arithmetic mismatch: 3 + 1 !== 99
      { ...validDiff, oldHash: 'invalid-hex' },
      { ...validDiff, candidateHash: 'short' },
      { ...validDiff, isStale: 'not-a-bool' },
      { ...validDiff, additions: -1 },
      { ...validDiff, unifiedDiff: 123 },
    ];

    for (const bad of malformed) {
      const fakeFetch: typeof fetch = async () => jsonResponse(200, bad);
      const loader = createControlledDocsLoader(fakeFetch);
      await assert.rejects(
        () => loader.requestDiff('PRJ', 'DOC', '# Cand', 'a'.repeat(64)),
        (err: Error) => err.message.includes('Invalid controlled document diff response.')
      );
    }
  });

  // =========================================================================
  // Group 4: Document Validation (Section 45)
  // =========================================================================

  await test('Test 4A: requestValidate sends EXACT body and returns valid response', async () => {
    let capturedInit: RequestInit | undefined;
    const fakeFetch: typeof fetch = async (input, init) => {
      capturedInit = init;
      return jsonResponse(200, {
        documentId: 'DOC-CTRL-002',
        valid: true,
        errors: [],
        warnings: [],
      });
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const res = await loader.requestValidate('PRJ-1', 'DOC-CTRL-002', '# Content');

    const parsedBody = JSON.parse(String(capturedInit?.body));
    assert.deepStrictEqual(Object.keys(parsedBody), ['candidateContent']);
    assert.strictEqual(parsedBody.candidateContent, '# Content');
    assert.strictEqual(res.valid, true);
    assert.deepStrictEqual(res.errors, []);
  });

  await test('Test 4B: requestValidate returns structurally invalid response normally without throwing', async () => {
    const fakeFetch: typeof fetch = async () =>
      jsonResponse(200, {
        documentId: 'DOC-CTRL-002',
        valid: false,
        errors: ['Missing required header'],
        warnings: ['Trailing whitespace'],
      });

    const loader = createControlledDocsLoader(fakeFetch);
    const res = await loader.requestValidate('PRJ-1', 'DOC-CTRL-002', 'bad content');
    assert.strictEqual(res.valid, false);
    assert.deepStrictEqual(res.errors, ['Missing required header']);
    assert.deepStrictEqual(res.warnings, ['Trailing whitespace']);
  });

  await test('Test 4C: requestValidate rejects malformed validation response shape', async () => {
    const malformed = [
      { documentId: 'DOC-CTRL-002', valid: 'true', errors: [], warnings: [] },
      { documentId: 'DOC-CTRL-002', valid: true, errors: [123], warnings: [] },
      { documentId: 'DOC-CTRL-002', valid: true, errors: [], warnings: 'none' },
    ];

    for (const bad of malformed) {
      const fakeFetch: typeof fetch = async () => jsonResponse(200, bad);
      const loader = createControlledDocsLoader(fakeFetch);
      await assert.rejects(
        () => loader.requestValidate('PRJ', 'DOC', 'test'),
        (err: Error) => err.message.includes('Invalid controlled document validation response.')
      );
    }
  });

  // =========================================================================
  // Group 5: Document Save & Error Handling (Sections 46, 47, 48)
  // =========================================================================

  await test('Test 5A: requestSave sends EXACT keys and zero prohibited identity claims', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(200, {
        success: true,
        documentId: 'DOC-CTRL-002',
        path: 'docs/00_control/PROJECT_STATE.md',
        previousSha256: 'a'.repeat(64),
        newSha256: 'b'.repeat(64),
        stateVersion: 32,
        auditEventId: 'AUD-TEST-1234',
        timestamp: new Date().toISOString(),
      });
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const input: DocumentSaveInput = {
      projectId: 'PRJ-1',
      documentId: 'DOC-CTRL-002',
      candidateContent: '# Updated',
      baseSha256: 'a'.repeat(64),
      reason: 'Valid update reason',
      humanConfirmed: true,
    };

    const res = await loader.requestSave(input);

    assert.strictEqual(capturedUrl, '/api/projects/PRJ-1/docs/DOC-CTRL-002/save');
    assert.strictEqual(capturedInit?.method, 'POST');
    assert.strictEqual(capturedInit?.credentials, 'same-origin');

    const parsedBody = JSON.parse(String(capturedInit?.body));
    const bodyKeys = Object.keys(parsedBody).sort();
    assert.deepStrictEqual(bodyKeys, [
      'baseSha256',
      'candidateContent',
      'humanConfirmed',
      'reason',
    ]);

    // Explicitly verify prohibited keys are ABSENT
    const prohibitedKeys = [
      'actor',
      'role',
      'approver',
      'reviewerName',
      'reviewerRole',
      'authorizedRole',
      'identityId',
      'actorType',
      'auditEventId',
      'projectId',
      'documentId',
    ];
    for (const key of prohibitedKeys) {
      assert(!(key in parsedBody), `Prohibited key "${key}" must NOT be sent in save body`);
    }

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.stateVersion, 32);
    assert.strictEqual(res.newSha256, 'b'.repeat(64));
    assert.strictEqual(res.auditEventId, 'AUD-TEST-1234');
  });

  await test('Test 5B: requestSave rejects malformed save responses', async () => {
    const validSave = {
      success: true,
      documentId: 'DOC-CTRL-002',
      path: 'docs/00_control/PROJECT_STATE.md',
      previousSha256: 'a'.repeat(64),
      newSha256: 'b'.repeat(64),
      stateVersion: 32,
      auditEventId: 'AUD-123',
      timestamp: new Date().toISOString(),
    };

    const malformed = [
      { ...validSave, success: false },
      { ...validSave, documentId: '' },
      { ...validSave, path: '' },
      { ...validSave, previousSha256: 'short' },
      { ...validSave, newSha256: 'invalid' },
      { ...validSave, stateVersion: -1 },
      { ...validSave, stateVersion: 3.5 },
      { ...validSave, stateVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...validSave, stateVersion: '32' as any },
      { ...validSave, auditEventId: '' },
      { ...validSave, timestamp: 'invalid-date-string' },
    ];

    for (const bad of malformed) {
      const fakeFetch: typeof fetch = async () => jsonResponse(200, bad);
      const loader = createControlledDocsLoader(fakeFetch);
      await assert.rejects(
        () =>
          loader.requestSave({
            projectId: 'P',
            documentId: 'D',
            candidateContent: 'C',
            baseSha256: 'a'.repeat(64),
            reason: 'R',
            humanConfirmed: true,
          }),
        (err: Error) => err.message.includes('Invalid controlled document save response.')
      );
    }
  });

  await test('Test 5C: requestSave preserves stable server errors (409 DOCUMENT_STALE, 500 RECOVERY_REQUIRED)', async () => {
    const testCases = [
      { status: 409, code: 'DOCUMENT_STALE' },
      { status: 410, code: 'DOCUMENT_MISSING' },
      { status: 403, code: 'DOCUMENT_READ_ONLY' },
      { status: 422, code: 'DOCUMENT_VALIDATION_FAILED' },
      { status: 500, code: 'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED' },
      { status: 400, code: 'CLIENT_IDENTITY_CLAIMS_PROHIBITED' },
    ];

    for (const { status, code } of testCases) {
      const fakeFetch: typeof fetch = async () => jsonResponse(status, { error: code });
      const loader = createControlledDocsLoader(fakeFetch);
      await assert.rejects(
        () =>
          loader.requestSave({
            projectId: 'P',
            documentId: 'D',
            candidateContent: 'C',
            baseSha256: 'a'.repeat(64),
            reason: 'R',
            humanConfirmed: true,
          }),
        (err: Error) => err.message.includes(code)
      );
    }
  });

  await test('Test 5D: requestSave handles non-JSON / malformed server error body gracefully', async () => {
    const fakeFetch: typeof fetch = async () => textResponse(500, 'Internal Server Error HTML');
    const loader = createControlledDocsLoader(fakeFetch);
    await assert.rejects(
      () =>
        loader.requestSave({
          projectId: 'P',
          documentId: 'D',
          candidateContent: 'C',
          baseSha256: 'a'.repeat(64),
          reason: 'R',
          humanConfirmed: true,
        }),
      (err: Error) => err.message.includes('Controlled documents request failed with HTTP 500.')
    );
  });

  // =========================================================================
  // Group 6: Governance Session Display (Sections 49, 50, 51)
  // =========================================================================

  await test('Test 6A: loadGovernanceSession extracts display-only name and roles without ID', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(200, {
        identity: {
          id: 'SECRET-IDENTITY-ID-123',
          name: 'Gio',
          roles: ['Lead Architect', 'Security Officer'],
          kind: 'HUMAN',
          roleSource: 'LOCAL_SERVER_ROSTER',
        },
      });
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const session = await loader.loadGovernanceSession();

    assert.strictEqual(capturedUrl, '/api/governance/session');
    assert.strictEqual(capturedInit?.method, 'GET');
    assert.strictEqual(capturedInit?.credentials, 'same-origin');
    assert.deepStrictEqual(session, {
      name: 'Gio',
      roles: ['Lead Architect', 'Security Officer'],
    });
    assert(!('id' in (session as any)), 'id must NOT be exposed in ReviewerSessionInfo');
  });

  await test('Test 6B: loadGovernanceSession returns null when signed out (identity: null)', async () => {
    const fakeFetch: typeof fetch = async () => jsonResponse(200, { identity: null });
    const loader = createControlledDocsLoader(fakeFetch);
    const session = await loader.loadGovernanceSession();
    assert.strictEqual(session, null);
  });

  await test('Test 6C: loadGovernanceSession rejects malformed session shapes', async () => {
    const malformed = [
      { identity: {} }, // missing name/roles
      { identity: { name: '', roles: [] } }, // empty name
      { identity: { name: 123, roles: [] } },
      { identity: { name: 'Gio', roles: 'Not an array' } },
      { identity: { name: 'Gio', roles: [123] } },
      'not even an object',
    ];

    for (const bad of malformed) {
      const fakeFetch: typeof fetch = async () => jsonResponse(200, bad);
      const loader = createControlledDocsLoader(fakeFetch);
      await assert.rejects(
        () => loader.loadGovernanceSession(),
        (err: Error) => err.message.includes('Invalid governance session response.')
      );
    }
  });

  // =========================================================================
  // Group 7: Request Sequencing, Races & Lifecycle (Sections 52, 53, 54, 55)
  // =========================================================================

  await test('Test 7A: Out-of-order response on same channel supersedes older request', async () => {
    type Deferred = { resolve: (val: Response) => void; reject: (err: any) => void };
    const deferredA: Deferred = {} as any;
    const promiseA = new Promise<Response>((res, rej) => {
      deferredA.resolve = res;
      deferredA.reject = rej;
    });

    const deferredB: Deferred = {} as any;
    const promiseB = new Promise<Response>((res, rej) => {
      deferredB.resolve = res;
      deferredB.reject = rej;
    });

    let callCount = 0;
    const fakeFetch: typeof fetch = async () => {
      callCount++;
      if (callCount === 1) return promiseA;
      return promiseB;
    };

    const loader = createControlledDocsLoader(fakeFetch);

    // Start request A
    const reqA = loader.loadDocumentContent('PRJ', 'DOC');
    // Start request B on the same channel
    const reqB = loader.loadDocumentContent('PRJ', 'DOC');

    // Resolve B first
    deferredB.resolve(
      jsonResponse(200, {
        document: sampleSummary,
        content: '# Content B',
        rawSha256: 'b'.repeat(64),
        eol: 'LF',
        sizeBytes: 12,
      })
    );
    const resultB = await reqB;
    assert.strictEqual(resultB.content, '# Content B');

    // Resolve A afterward (even though abort signal might have fired)
    deferredA.resolve(
      jsonResponse(200, {
        document: sampleSummary,
        content: '# Content A (STALE)',
        rawSha256: 'a'.repeat(64),
        eol: 'LF',
        sizeBytes: 19,
      })
    );

    // Request A must reject with AbortError and NOT return stale data
    await assert.rejects(
      async () => await reqA,
      (err: any) => err.name === 'AbortError' || err.message.includes('superseded')
    );
  });

  await test('Test 7B: Cross-channel requests operate independently without aborting each other', async () => {
    let listResolved = false;
    let sessionResolved = false;

    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/docs')) {
        await new Promise((r) => setTimeout(r, 20));
        listResolved = true;
        return jsonResponse(200, [sampleSummary]);
      } else if (url.includes('/governance/session')) {
        await new Promise((r) => setTimeout(r, 10));
        sessionResolved = true;
        return jsonResponse(200, { identity: null });
      }
      return jsonResponse(404, { error: 'Not found' });
    };

    const loader = createControlledDocsLoader(fakeFetch);

    const [listRes, sessionRes] = await Promise.all([
      loader.loadDocumentList('PRJ-1'),
      loader.loadGovernanceSession(),
    ]);

    assert(listResolved && sessionResolved);
    assert.strictEqual(listRes.length, 1);
    assert.strictEqual(sessionRes, null);
  });

  await test('Test 7C: loader.invalidate() aborts all active channels and prevents late resolution', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fakeFetch: typeof fetch = async (input, init) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_, reject) => {
        if (capturedSignal) {
          capturedSignal.addEventListener('abort', () => {
            const err = new DOMException('Aborted', 'AbortError');
            reject(err);
          });
        }
      });
    };

    const loader = createControlledDocsLoader(fakeFetch);
    const contentPromise = loader.loadDocumentContent('PRJ', 'DOC');

    assert(capturedSignal);
    assert.strictEqual(capturedSignal.aborted, false);

    loader.invalidate();

    assert.strictEqual(capturedSignal.aborted, true);
    await assert.rejects(
      async () => await contentPromise,
      (err: any) => err.name === 'AbortError' || err.message.includes('aborted')
    );
  });

  await test('Test 7D: Request timeout triggers abort and rejects with stable timeout error', async () => {
    // Intercept setTimeout inside the client test to trigger timeout deterministically
    const originalSetTimeout = globalThis.setTimeout;
    let timeoutCallback: (() => void) | undefined;

    (globalThis as any).setTimeout = (cb: () => void, ms?: number) => {
      if (ms === 20000) {
        timeoutCallback = cb;
        return 9999 as any;
      }
      return originalSetTimeout(cb, ms);
    };

    try {
      const fakeFetch: typeof fetch = async (input, init) => {
        const signal = init?.signal as AbortSignal;
        return new Promise<Response>((_, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Controlled docs request timed out.', 'AbortError'));
          });
        });
      };

      const loader = createControlledDocsLoader(fakeFetch);
      const req = loader.loadDocumentList('PRJ');

      // Trigger the 20-second timeout manually
      assert(timeoutCallback, 'Timeout handler must be registered');
      timeoutCallback();

      await assert.rejects(
        async () => await req,
        (err: Error) => err.message.includes('Controlled docs request timed out.')
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  await test('Test 7E: Timeout finality prevents late fetch resolution from succeeding when abort is ignored', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    let timeoutCallback: (() => void) | undefined;

    (globalThis as any).setTimeout = (cb: () => void, ms?: number) => {
      if (ms === 20000) {
        timeoutCallback = cb;
        return 9999 as any;
      }
      return originalSetTimeout(cb, ms);
    };

    try {
      let deferredResolve: (res: Response) => void;
      let capturedSignal: AbortSignal | undefined;

      const deferredPromise = new Promise<Response>((resolve) => {
        deferredResolve = resolve;
      });

      const fakeFetch: typeof fetch = async (input, init) => {
        capturedSignal = init?.signal as AbortSignal;
        // Deliberately ignore signal.abort() and return deferredPromise
        return deferredPromise;
      };

      const loader = createControlledDocsLoader(fakeFetch);
      const req = loader.loadDocumentList('PRJ-DOCMONSTAKRAKIN');

      assert(timeoutCallback, 'Timeout callback must be registered');
      timeoutCallback();

      assert(capturedSignal, 'Signal must be passed to request');
      assert.strictEqual(capturedSignal.aborted, true, 'Signal must be aborted upon timeout');

      // Now resolve the deferred fetch with valid HTTP 200 document-list payload
      deferredResolve!(jsonResponse(200, [sampleSummary]));

      await assert.rejects(
        async () => await req,
        (err: Error) => {
          assert.strictEqual(err.message, 'Controlled docs request timed out.');
          return true;
        }
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  await test('Test 7F: Timeout during response.json() rejects with timeout error and prevents payload return', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    let timeoutCallback: (() => void) | undefined;

    (globalThis as any).setTimeout = (cb: () => void, ms?: number) => {
      if (ms === 20000) {
        timeoutCallback = cb;
        return 9999 as any;
      }
      return originalSetTimeout(cb, ms);
    };

    try {
      let deferredJsonResolve: (data: any) => void;
      const deferredJsonPromise = new Promise<any>((resolve) => {
        deferredJsonResolve = resolve;
      });

      let capturedSignal: AbortSignal | undefined;

      const fakeFetch: typeof fetch = async (input, init) => {
        capturedSignal = init?.signal as AbortSignal;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: () => deferredJsonPromise,
          text: async () => JSON.stringify([sampleSummary]),
        } as unknown as Response;
      };

      const loader = createControlledDocsLoader(fakeFetch);
      const req = loader.loadDocumentList('PRJ-DOCMONSTAKRAKIN');

      await new Promise((r) => setImmediate(r));

      assert(timeoutCallback, 'Timeout callback must be registered');
      timeoutCallback();

      assert(capturedSignal, 'Signal must be captured');
      assert.strictEqual(capturedSignal.aborted, true, 'Signal must be aborted upon timeout');

      deferredJsonResolve!([sampleSummary]);

      await assert.rejects(
        async () => await req,
        (err: Error) => {
          assert.strictEqual(err.message, 'Controlled docs request timed out.');
          return true;
        }
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  await test('Test 7G: Timeout during non-2xx response body parse returns timeout error instead of server error', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    let timeoutCallback: (() => void) | undefined;

    (globalThis as any).setTimeout = (cb: () => void, ms?: number) => {
      if (ms === 20000) {
        timeoutCallback = cb;
        return 9999 as any;
      }
      return originalSetTimeout(cb, ms);
    };

    try {
      let deferredJsonResolve: (data: any) => void;
      const deferredJsonPromise = new Promise<any>((resolve) => {
        deferredJsonResolve = resolve;
      });

      const fakeFetch: typeof fetch = async () => {
        return {
          ok: false,
          status: 409,
          statusText: 'Conflict',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: () => deferredJsonPromise,
          text: async () => JSON.stringify({ error: 'DOCUMENT_STALE' }),
        } as unknown as Response;
      };

      const loader = createControlledDocsLoader(fakeFetch);
      const req = loader.requestSave({
        projectId: 'P',
        documentId: 'D',
        candidateContent: 'C',
        baseSha256: 'a'.repeat(64),
        reason: 'R',
        humanConfirmed: true,
      });

      await new Promise((r) => setImmediate(r));

      assert(timeoutCallback, 'Timeout callback must be registered');
      timeoutCallback();

      deferredJsonResolve!({ error: 'DOCUMENT_STALE' });

      await assert.rejects(
        async () => await req,
        (err: Error) => {
          assert.strictEqual(err.message, 'Controlled docs request timed out.');
          return true;
        }
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
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
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
