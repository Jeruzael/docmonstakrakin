import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page, type Route } from 'playwright';
import { createServer } from 'vite';
import type {
  ControlledDocumentSummary,
  DocumentContentResponse,
  DocumentDiffResponse,
  DocumentValidationResponse,
  DocumentSaveResponse,
  ReviewerSessionInfo,
} from '../src/types.js';

// Setup temporary runtime harness directory (gitignored under runtime/)
const root = process.cwd();
const harnessDir = path.resolve('runtime/dmk-195-task10');
fs.mkdirSync(harnessDir, { recursive: true });

const harnessHtml = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>ControlledDocsView Test Harness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/runtime/dmk-195-task10/harness.tsx"></script>
  </body>
</html>`;

const harnessTsx = `import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ControlledDocsView } from '../../src/components/ControlledDocsView';

function Harness() {
  const [projectId, setProjectId] = useState('PRJ-DOCMONSTAKRAKIN');
  const [mounted, setMounted] = useState(true);
  const [customLoader, setCustomLoader] = useState<any>(null);

  useEffect(() => {
    (window as any).__setProjectId = (id: string) => setProjectId(id);
    (window as any).__setMounted = (m: boolean) => setMounted(m);
    (window as any).__setCustomLoader = (ldr: any) => setCustomLoader(() => ldr);
  }, []);

  if (!mounted) return <div id="unmounted-marker">Unmounted</div>;

  return (
    <div style={{ padding: 16 }}>
      <ControlledDocsView
        projectId={projectId}
        loader={customLoader || undefined}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
`;

fs.writeFileSync(path.join(harnessDir, 'index.html'), harnessHtml, 'utf8');
fs.writeFileSync(path.join(harnessDir, 'harness.tsx'), harnessTsx, 'utf8');

// Fixtures
const MOCK_DOCS: ControlledDocumentSummary[] = [
  {
    id: 'DOC-CTRL-001',
    path: 'docs/00_control/PROJECT_CHARTER.md',
    kind: 'CONTROL',
    authority: 'REFERENCE',
    editability: 'READ_ONLY',
    fileType: 'MARKDOWN',
    title: 'Project Charter',
    description: 'Control Plane Charter',
    integrityStatus: 'MATCH',
    sha256Digest: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    currentSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    sizeBytes: 1024,
    eol: 'LF',
  },
  {
    id: 'DOC-CTRL-002',
    path: 'docs/00_control/PROJECT_STATE.md',
    kind: 'CONTROL',
    authority: 'REFERENCE',
    editability: 'CONTROLLED_EDIT',
    fileType: 'MARKDOWN',
    title: 'Project State & Governance Baseline',
    description: 'Current Project State',
    integrityStatus: 'UNPINNED',
    currentSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    sizeBytes: 2048,
    eol: 'LF',
  },
  {
    id: 'DOC-CTRL-003',
    path: 'docs/00_control/MASTER_WBS.yaml',
    kind: 'CONTROL',
    authority: 'REFERENCE',
    editability: 'READ_ONLY',
    fileType: 'YAML',
    title: 'Master Work Breakdown Structure',
    description: 'Canonical WBS Authority',
    integrityStatus: 'CHANGED',
    sha256Digest: '2222222222222222222222222222222222222222222222222222222222222222',
    currentSha256: '3333333333333333333333333333333333333333333333333333333333333333',
    sizeBytes: 4096,
    eol: 'LF',
  },
  {
    id: 'DOC-CTRL-004',
    path: 'docs/03_architecture/ARCHITECTURE_AND_SPECS.md',
    kind: 'ARCHITECTURE',
    authority: 'REFERENCE',
    editability: 'READ_ONLY',
    fileType: 'MARKDOWN',
    title: 'System Architecture Specification',
    description: 'Core System Specs',
    integrityStatus: 'MISSING',
    sha256Digest: '4444444444444444444444444444444444444444444444444444444444444444',
    currentSha256: null,
    sizeBytes: 0,
    eol: 'NONE',
  },
];

const DOC_CTRL_001_CONTENT: DocumentContentResponse = {
  document: MOCK_DOCS[0],
  content: '# Project Charter\n\nThis is a read-only charter document.',
  rawSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  eol: 'LF',
  sizeBytes: 1024,
};

const DOC_CTRL_002_INITIAL_CONTENT: DocumentContentResponse = {
  document: MOCK_DOCS[1],
  content: `# docmonstakrakin current project state

## Overview
Living controlled documentation.

<script>window.__XSS_TRIGGERED__ = true;</script>

[Safe External Link](https://example.com/docs)
[Safe Relative Link](./OTHER.md)
[Malicious JS Link](javascript:alert(1))
[Malicious Data Link](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)

End of doc.
`,
  rawSha256: '1111111111111111111111111111111111111111111111111111111111111111',
  eol: 'LF',
  sizeBytes: 2048,
};

const DOC_CTRL_002_SAVED_CONTENT: DocumentContentResponse = {
  document: {
    ...MOCK_DOCS[1],
    currentSha256: '9999999999999999999999999999999999999999999999999999999999999999',
  },
  content: `# docmonstakrakin current project state\n\nUpdated candidate content for Task 10 verification.`,
  rawSha256: '9999999999999999999999999999999999999999999999999999999999999999',
  eol: 'LF',
  sizeBytes: 2100,
};

const SESSION_INFO: ReviewerSessionInfo = {
  name: 'Gio',
  roles: ['Lead Architect', 'Security Reviewer'],
};

// Start Vite Server
const vite = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
await vite.listen();
const baseUrl = vite.resolvedUrls!.local[0] + 'runtime/dmk-195-task10/index.html';

const executable =
  process.env.DMK_TEST_BROWSER ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(
    (p) => fs.existsSync(p)
  );

const browser = await chromium.launch({
  headless: true,
  ...(executable ? { executablePath: executable } : {}),
});

let passed = 0;
let failed = 0;
const results: { name: string; status: string; error?: string }[] = [];

async function setupPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(6000);

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  let currentDoc2Content = DOC_CTRL_002_INITIAL_CONTENT;
  let saveCalls: any[] = [];
  let diffCalls: any[] = [];
  let validateCalls: any[] = [];
  let listLoadCalls: string[] = [];
  let contentLoadCalls: string[] = [];
  let diffIsStale = false;
  let validationShouldFail = false;

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url()).pathname;
    const method = route.request().method();

    const send = async (body: unknown, status = 200) => {
      await route.fulfill({ status, json: body }).catch(() => {});
    };

    if (url === '/api/governance/session') {
      return send({ identity: SESSION_INFO });
    }

    if (url === '/api/projects/PRJ-ATLAS-01/docs') {
      listLoadCalls.push(url);
      return send([]);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs') {
      listLoadCalls.push(url);
      return send(MOCK_DOCS);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-001') {
      contentLoadCalls.push(url);
      return send(DOC_CTRL_001_CONTENT);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002') {
      contentLoadCalls.push(url);
      return send(currentDoc2Content);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-004') {
      contentLoadCalls.push(url);
      return route.fulfill({ status: 410, json: { error: 'DOCUMENT_MISSING' } }).catch(() => {});
    }

    if (method === 'POST' && url.endsWith('/diff')) {
      const body = route.request().postDataJSON();
      diffCalls.push(body);
      const diffResp: DocumentDiffResponse = {
        documentId: 'DOC-CTRL-002',
        oldHash: body.baseSha256,
        candidateHash: '9999999999999999999999999999999999999999999999999999999999999999',
        isStale: diffIsStale,
        hasChanges: true,
        additions: 1,
        deletions: 1,
        changedLines: 2,
        unifiedDiff: '--- a/docs/00_control/PROJECT_STATE.md\n+++ b/docs/00_control/PROJECT_STATE.md\n@@ -1,3 +1,3 @@\n-old\n+new',
      };
      return send(diffResp);
    }

    if (method === 'POST' && url.endsWith('/validate')) {
      const body = route.request().postDataJSON();
      validateCalls.push(body);
      if (validationShouldFail) {
        const valResp: DocumentValidationResponse = {
          documentId: 'DOC-CTRL-002',
          valid: false,
          errors: ['Content is missing required section: Current governance and task status'],
          warnings: ['Size approaches warning threshold'],
        };
        return send(valResp);
      }
      const valResp: DocumentValidationResponse = {
        documentId: 'DOC-CTRL-002',
        valid: true,
        errors: [],
        warnings: [],
      };
      return send(valResp);
    }

    if (method === 'POST' && url.endsWith('/save')) {
      const body = route.request().postDataJSON();
      saveCalls.push(body);
      currentDoc2Content = DOC_CTRL_002_SAVED_CONTENT;
      const saveResp: DocumentSaveResponse = {
        success: true,
        documentId: 'DOC-CTRL-002',
        path: 'docs/00_control/PROJECT_STATE.md',
        previousSha256: body.baseSha256,
        newSha256: '9999999999999999999999999999999999999999999999999999999999999999',
        stateVersion: 32,
        auditEventId: 'AUD-TEST-EVENT-001',
        timestamp: '2026-09-29T18:00:00.000Z',
      };
      return send(saveResp);
    }

    return send({ error: 'Not found' }, 404);
  });

  return {
    page,
    errors,
    getSaveCalls: () => saveCalls,
    getDiffCalls: () => diffCalls,
    getValidateCalls: () => validateCalls,
    getListLoadCalls: () => listLoadCalls,
    getContentLoadCalls: () => contentLoadCalls,
    setDiffIsStale: (val: boolean) => {
      diffIsStale = val;
    },
    setValidationShouldFail: (val: boolean) => {
      validationShouldFail = val;
    },
    async start() {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Wait for catalog heading or empty indicator
      await page.waitForSelector('[data-testid="controlled-docs-workspace"]', { timeout: 10000 });
    },
    async close() {
      await page.close();
      assert.deepEqual(errors, [], 'No browser runtime errors');
    },
  };
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    results.push({ name, status: 'PASS' });
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    results.push({ name, status: 'FAIL', error: String(err) });
    failed++;
  }
}

try {
  // Test 1: Empty state for unconfigured project
  await runTest('Test 1: Empty state for projects with no documents', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.evaluate("window.__setProjectId('PRJ-ATLAS-01')");
      await ctx.page.waitForSelector('[data-testid="controlled-docs-empty"]', { timeout: 5000 });
      const text = await ctx.page.textContent('[data-testid="controlled-docs-empty"]');
      assert(text?.includes('No Repository Documentation Available'), 'Empty state banner displayed');
      assert(text?.includes('PRJ-ATLAS-01'), 'Includes project ID in message');
    } finally {
      await ctx.close();
    }
  });

  // Test 2: Document catalog rendering, grouping by kind, search filter, and status badges
  await runTest('Test 2: Document catalog grouping, search filter, and status badges', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      // Check group headers
      await ctx.page.waitForSelector('[data-testid="kind-group-CONTROL"]');
      await ctx.page.waitForSelector('[data-testid="kind-group-ARCHITECTURE"]');

      // Check badges for DOC-CTRL-001 (MATCH, READ_ONLY)
      const badgeMatch = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-001"]');
      assert.equal(await badgeMatch.textContent(), 'MATCH');

      // Check badges for DOC-CTRL-002 (UNPINNED, CONTROLLED_EDIT)
      const badgeUnpinned = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-002"]');
      assert.equal(await badgeUnpinned.textContent(), 'UNPINNED');
      const badgeEdit = await ctx.page.waitForSelector('[data-testid="badge-editability-DOC-CTRL-002"]');
      assert.equal(await badgeEdit.textContent(), 'CONTROLLED_EDIT');

      // Check badges for DOC-CTRL-003 (CHANGED, READ_ONLY)
      const badgeChanged = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-003"]');
      assert.equal(await badgeChanged.textContent(), 'CHANGED');

      // Check badges for DOC-CTRL-004 (MISSING, READ_ONLY)
      const badgeMissing = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-004"]');
      assert.equal(await badgeMissing.textContent(), 'MISSING');

      // Search filter
      const searchInput = ctx.page.locator('[data-testid="docs-search-input"]');
      await searchInput.fill('DOC-CTRL-002');
      // DOC-CTRL-002 should be visible, others hidden
      assert(await ctx.page.locator('[data-testid="doc-item-DOC-CTRL-002"]').isVisible());
      assert(!(await ctx.page.locator('[data-testid="doc-item-DOC-CTRL-001"]').isVisible()));

      // Clear search
      await searchInput.fill('');
      assert(await ctx.page.locator('[data-testid="doc-item-DOC-CTRL-001"]').isVisible());
    } finally {
      await ctx.close();
    }
  });

  // Test 3: Read-only document selection & absence of Edit controls
  await runTest('Test 3: Read-only document selection and absence of Edit button', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      // Click DOC-CTRL-001
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-001"]');
      await ctx.page.waitForSelector('[data-testid="doc-title"]');
      const title = await ctx.page.textContent('[data-testid="doc-title"]');
      assert(title?.includes('Project Charter'));

      // Verify NO Edit button is rendered
      const editButtonCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editButtonCount, 0, 'No edit button for read-only documents');
    } finally {
      await ctx.close();
    }
  });

  // Test 4: Markdown security, inert script tags, dangerous URI blocking, and safe external links
  await runTest('Test 4: Markdown security & link safety (inert HTML, blocked URI, safe links)', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      // Click DOC-CTRL-002
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');

      // Verify embedded <script> did NOT execute
      const xssTriggered = await ctx.page.evaluate("window.__XSS_TRIGGERED__");
      assert.strictEqual(xssTriggered, undefined, 'Embedded script must not execute');

      // Verify malicious javascript: link is sanitized/inert (no executable javascript href)
      const jsLink = ctx.page.locator('a', { hasText: 'Malicious JS Link' });
      const jsHref = (await jsLink.getAttribute('href')) || '';
      assert(!jsHref.toLowerCase().startsWith('javascript:'), 'javascript: URI must be stripped or blocked');

      // Verify malicious data: link is sanitized/inert
      const dataLink = ctx.page.locator('a', { hasText: 'Malicious Data Link' });
      const dataHref = (await dataLink.getAttribute('href')) || '';
      assert(!dataHref.toLowerCase().startsWith('data:'), 'data: URI must be stripped or blocked');

      // Verify external link has target="_blank" and rel="noopener noreferrer"
      const extLink = ctx.page.locator('a', { hasText: 'Safe External Link' });
      assert.equal(await extLink.getAttribute('target'), '_blank');
      const extRel = (await extLink.getAttribute('rel')) || '';
      assert(extRel.includes('noopener') && extRel.includes('noreferrer'), 'External link has safe rel');

      // Verify relative link is preserved and safe
      const relLink = ctx.page.locator('a', { hasText: 'Safe Relative Link' });
      assert.equal(await relLink.getAttribute('href'), './OTHER.md');

      // Test Raw Source Toggle
      await ctx.page.click('[data-testid="btn-toggle-raw"]');
      await ctx.page.waitForSelector('[data-testid="doc-content-raw"]');
      const rawText = await ctx.page.textContent('[data-testid="doc-content-raw"]');
      assert(rawText?.includes('# docmonstakrakin current project state'));

      // Toggle back to rendered
      await ctx.page.click('[data-testid="btn-toggle-rendered"]');
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');
    } finally {
      await ctx.close();
    }
  });

  // Test 5: Controlled 6-step edit workflow progression
  await runTest('Test 5: Controlled 6-step edit workflow (VIEW -> EDIT -> DIFF -> VALIDATE -> MODAL -> COMMIT)', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      // Step 1: VIEW
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.waitForSelector('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');

      // Step 2: EDIT_DRAFT
      await ctx.page.waitForSelector('[data-testid="draft-editor-textarea"]');
      const editor = ctx.page.locator('[data-testid="draft-editor-textarea"]');
      await editor.fill('# docmonstakrakin current project state\n\nUpdated candidate content for Task 10 verification.');
      await ctx.page.click('[data-testid="btn-preview-diff"]');

      // Step 3: PREVIEW_DIFF
      await ctx.page.waitForSelector('[data-testid="diff-view"]');
      assert(ctx.getDiffCalls().length > 0, 'diff API was called');
      const diffCalls = ctx.getDiffCalls();
      assert.equal(diffCalls[0].baseSha256, '1111111111111111111111111111111111111111111111111111111111111111');
      await ctx.page.click('[data-testid="btn-validate"]');

      // Step 4: VALIDATE
      await ctx.page.waitForSelector('[data-testid="validation-view"]');
      assert(ctx.getValidateCalls().length > 0, 'validate API was called');
      await ctx.page.waitForSelector('[data-testid="btn-proceed-to-save"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');

      // Step 5: CONFIRM_SAVE (DocSaveModal)
      await ctx.page.waitForSelector('[data-testid="doc-save-modal"]');
      // Verify governance session identity display
      const sessionName = await ctx.page.textContent('[data-testid="modal-session-name"]');
      assert(sessionName?.includes('Gio'), 'Reviewer name displayed');
      const sessionRoles = await ctx.page.textContent('[data-testid="modal-session-roles"]');
      assert(sessionRoles?.includes('Lead Architect'), 'Reviewer roles displayed');

      // Verify NO editable identity fields exist
      const identityInputs = await ctx.page.locator('input[name="actor"], input[name="role"], input[name="reviewer"]').count();
      assert.strictEqual(identityInputs, 0, 'No identity input fields in save modal');

      // Confirm & Save button should be disabled until reason & checkbox checked
      const confirmSaveBtn = ctx.page.locator('[data-testid="btn-confirm-save"]');
      assert(await confirmSaveBtn.isDisabled(), 'Confirm button disabled initially');

      // Fill reason
      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Formal Task 10 verification update');
      assert(await confirmSaveBtn.isDisabled(), 'Confirm button still disabled without checkbox');

      // Check confirmation checkbox
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');
      assert(!(await confirmSaveBtn.isDisabled()), 'Confirm button enabled once reason and checkbox valid');

      // Step 6: COORDINATED_COMMIT
      await confirmSaveBtn.click();

      // Post-save checks
      await ctx.page.waitForSelector('[data-testid="save-success-banner"]');
      const saveCalls = ctx.getSaveCalls();
      assert.strictEqual(saveCalls.length, 1, 'requestSave called exactly once');
      assert.strictEqual(saveCalls[0].reason, 'Formal Task 10 verification update');
      assert.strictEqual(saveCalls[0].humanConfirmed, true);
      assert.strictEqual(saveCalls[0].baseSha256, '1111111111111111111111111111111111111111111111111111111111111111');
      // Assert zero client identity claims in payload
      const prohibitedKeys = ['actor', 'role', 'approver', 'reviewerName', 'reviewerRole', 'authorizedRole', 'identityId', 'actorType', 'auditEventId'];
      for (const key of prohibitedKeys) {
        assert.strictEqual(saveCalls[0][key], undefined, `Payload must not contain prohibited key: ${key}`);
      }

      // Verify post-save reload: content and catalog reloaded
      assert(ctx.getContentLoadCalls().length >= 2, 'Canonical content reloaded post-save');
      assert(ctx.getListLoadCalls().length >= 2, 'Catalog reloaded post-save');

      // Verify save metadata displayed
      const metaText = await ctx.page.textContent('[data-testid="save-success-banner"]');
      assert(metaText?.includes('AUD-TEST-EVENT-001'), 'Audit event ID displayed in save metadata');
      assert(metaText?.includes('32'), 'State version displayed');
    } finally {
      await ctx.close();
    }
  });

  // Test 6: Stale base hash handling during diff
  await runTest('Test 6: Stale base hash detection in diff offers canonical reload', async () => {
    const ctx = await setupPage();
    ctx.setDiffIsStale(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');

      // Verify stale warning and reload button
      await ctx.page.waitForSelector('[data-testid="stale-warning"]');
      await ctx.page.waitForSelector('[data-testid="btn-reload-canonical"]');

      // Click reload canonical
      await ctx.page.click('[data-testid="btn-reload-canonical"]');
      // Should reload and reset back to view or fresh draft
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');
    } finally {
      await ctx.close();
    }
  });

  // Test 7: Validation failure blocks progression to save
  await runTest('Test 7: Validation failure blocks progression to save', async () => {
    const ctx = await setupPage();
    ctx.setValidationShouldFail(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');

      await ctx.page.waitForSelector('[data-testid="validation-errors"]');
      const errText = await ctx.page.textContent('[data-testid="validation-errors"]');
      assert(errText?.toLowerCase().includes('missing required section'));

      // Proceed to save button should NOT be available
      const proceedCount = await ctx.page.locator('[data-testid="btn-proceed-to-save"]').count();
      assert.strictEqual(proceedCount, 0, 'Cannot proceed to save when validation fails');
    } finally {
      await ctx.close();
    }
  });

  // Test 8: Custom loader prop injection and unmount invalidation
  await runTest('Test 8: Custom loader prop injection and unmount invalidation', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      let invalidateCalled = false;
      await ctx.page.evaluate(`
        let inv = false;
        window.__invalidateCalled = () => inv;
        window.__setCustomLoader({
          loadDocumentList: async () => [
            {
              id: 'DOC-CUSTOM-001',
              path: 'docs/custom.md',
              kind: 'CONTROL',
              authority: 'REFERENCE',
              editability: 'READ_ONLY',
              fileType: 'MARKDOWN',
              title: 'Custom Injected Doc',
              integrityStatus: 'MATCH',
              currentSha256: null,
            },
          ],
          loadDocumentContent: async () => ({
            document: {
              id: 'DOC-CUSTOM-001',
              path: 'docs/custom.md',
              kind: 'CONTROL',
              authority: 'REFERENCE',
              editability: 'READ_ONLY',
              fileType: 'MARKDOWN',
              title: 'Custom Injected Doc',
              integrityStatus: 'MATCH',
              currentSha256: null,
            },
            content: '# Custom Injected Content',
            rawSha256: 'customsha',
            eol: 'LF',
            sizeBytes: 25,
          }),
          requestDiff: async () => ({}),
          requestValidate: async () => ({}),
          requestSave: async () => ({}),
          loadGovernanceSession: async () => null,
          invalidate: () => {
            inv = true;
          },
        });
      `);

      // Wait for custom doc to be rendered in catalog
      await ctx.page.waitForSelector('[data-testid="doc-item-DOC-CUSTOM-001"]');
      const customTitle = await ctx.page.textContent('[data-testid="doc-item-DOC-CUSTOM-001"]');
      assert(customTitle?.includes('Custom Injected Doc'));

      // Trigger unmount
      await ctx.page.evaluate("window.__setMounted(false)");
      await ctx.page.waitForSelector('#unmounted-marker');

      const invResult = await ctx.page.evaluate("window.__invalidateCalled()");
      assert.strictEqual(invResult, true, 'api.invalidate() must be called on unmount');
    } finally {
      await ctx.close();
    }
  });
} finally {
  await browser.close();
  await vite.close();
  // Cleanup temporary harness directory
  try {
    fs.rmSync(harnessDir, { recursive: true, force: true });
  } catch {}
}

console.log('\n============================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
}
