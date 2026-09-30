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
  {
    id: 'DOC-CTRL-005',
    path: 'docs/00_control/MIXED_DOC.md',
    kind: 'CONTROL',
    authority: 'REFERENCE',
    editability: 'CONTROLLED_EDIT',
    fileType: 'MARKDOWN',
    title: 'Mixed EOL Document',
    description: 'Document with mixed line endings',
    integrityStatus: 'UNPINNED',
    currentSha256: '5555555555555555555555555555555555555555555555555555555555555555',
    sizeBytes: 1024,
    eol: 'MIXED',
  },
  {
    id: 'DOC-CTRL-006',
    path: 'docs/00_control/RICH_FORMATTING.md',
    kind: 'CONTROL',
    authority: 'REFERENCE',
    editability: 'READ_ONLY',
    fileType: 'MARKDOWN',
    title: 'Rich Formatting Test Document',
    description: 'Document verifying all typography elements',
    integrityStatus: 'MATCH',
    sha256Digest: '6666666666666666666666666666666666666666666666666666666666666666',
    currentSha256: '6666666666666666666666666666666666666666666666666666666666666666',
    sizeBytes: 2048,
    eol: 'LF',
  },
];

const DOC_CTRL_001_CONTENT: DocumentContentResponse = {
  document: MOCK_DOCS[0],
  content: '# Project Charter\n\nThis is a read-only charter document.',
  rawSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  eol: 'LF',
  sizeBytes: 1024,
};

const DOC_CTRL_006_CONTENT: DocumentContentResponse = {
  document: MOCK_DOCS[5],
  content: `# Heading 1
## Heading 2
### Heading 3

Paragraph with **bold** and *italic* text.

- Bullet 1
- Bullet 2

1. Numbered 1
2. Numbered 2

> Blockquote

\`inline code\`

\`\`\`bash
echo hello
\`\`\`

| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`,
  rawSha256: '6666666666666666666666666666666666666666666666666666666666666666',
  eol: 'LF',
  sizeBytes: 2048,
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

const DOC_CTRL_005_CONTENT: DocumentContentResponse = {
  document: MOCK_DOCS[4],
  content: 'Line 1\r\nLine 2\nLine 3',
  rawSha256: '5555555555555555555555555555555555555555555555555555555555555555',
  eol: 'MIXED',
  sizeBytes: 1024,
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
  let diffHasChanges = true;
  let validationShouldFail = false;
  let sessionMode: 'AUTHENTICATED' | 'SIGNED_OUT' | 'ERROR' = 'AUTHENTICATED';
  let catalogFailOnce = false;
  let postSaveRefreshFailOnce = false;
  let saveHoldPromise: Promise<void> | null = null;
  let saveFailsTimeout = false;
  let holdDoc2ContentPromise: Promise<void> | null = null;
  let saveFailsDocStale = false;
  let refreshFailOnce = false;

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url()).pathname;
    const method = route.request().method();

    const send = async (body: unknown, status = 200) => {
      await route.fulfill({ status, json: body }).catch(() => {});
    };

    if (url === '/api/governance/session') {
      if (sessionMode === 'ERROR') {
        return route.fulfill({ status: 500, json: { error: 'SESSION_STORE_UNAVAILABLE' } }).catch(() => {});
      }
      if (sessionMode === 'SIGNED_OUT') {
        return send({ identity: null });
      }
      return send({ identity: SESSION_INFO });
    }

    if (url === '/api/projects/PRJ-ATLAS-01/docs') {
      listLoadCalls.push(url);
      return send([]);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs') {
      listLoadCalls.push(url);
      if (catalogFailOnce) {
        catalogFailOnce = false;
        return route.fulfill({ status: 503, json: { error: 'CATALOG_FETCH_FAILED' } }).catch(() => {});
      }
      if (postSaveRefreshFailOnce && saveCalls.length > 0) {
        postSaveRefreshFailOnce = false;
        return route.fulfill({ status: 500, json: { error: 'REFRESH_CATALOG_FAILED' } }).catch(() => {});
      }
      return send(MOCK_DOCS);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-001') {
      contentLoadCalls.push(url);
      return send(DOC_CTRL_001_CONTENT);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002') {
      if (holdDoc2ContentPromise) {
        await holdDoc2ContentPromise;
      }
      if (refreshFailOnce) {
        refreshFailOnce = false;
        return route.fulfill({ status: 500, json: { error: 'REFRESH_CONTENT_FAILED' } }).catch(() => {});
      }
      contentLoadCalls.push(url);
      return send(currentDoc2Content);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-004') {
      contentLoadCalls.push(url);
      return route.fulfill({ status: 410, json: { error: 'DOCUMENT_MISSING' } }).catch(() => {});
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-005') {
      contentLoadCalls.push(url);
      return send(DOC_CTRL_005_CONTENT);
    }

    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-006') {
      contentLoadCalls.push(url);
      return send(DOC_CTRL_006_CONTENT);
    }

    if (method === 'POST' && url.endsWith('/diff')) {
      const body = route.request().postDataJSON();
      diffCalls.push(body);
      const diffResp: DocumentDiffResponse = {
        documentId: 'DOC-CTRL-002',
        oldHash: body.baseSha256,
        candidateHash: '9999999999999999999999999999999999999999999999999999999999999999',
        isStale: diffIsStale,
        hasChanges: diffHasChanges,
        additions: diffHasChanges ? 1 : 0,
        deletions: diffHasChanges ? 1 : 0,
        changedLines: diffHasChanges ? 2 : 0,
        unifiedDiff: diffHasChanges
          ? '--- a/docs/00_control/PROJECT_STATE.md\n+++ b/docs/00_control/PROJECT_STATE.md\n@@ -1,3 +1,3 @@\n-old\n+new'
          : '',
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

      if (saveHoldPromise) {
        await saveHoldPromise;
      }

      if (saveFailsTimeout) {
        return route.fulfill({ status: 504, json: { error: 'Controlled docs request timed out.' } }).catch(() => {});
      }

      if (saveFailsDocStale) {
        return route.fulfill({ status: 409, json: { error: 'DOCUMENT_STALE: Base SHA mismatch.' } }).catch(() => {});
      }

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
    setDiffHasChanges: (val: boolean) => {
      diffHasChanges = val;
    },
    setValidationShouldFail: (val: boolean) => {
      validationShouldFail = val;
    },
    setSessionMode: (mode: 'AUTHENTICATED' | 'SIGNED_OUT' | 'ERROR') => {
      sessionMode = mode;
    },
    setCatalogFailOnce: (val: boolean) => {
      catalogFailOnce = val;
    },
    setPostSaveRefreshFailOnce: (val: boolean) => {
      postSaveRefreshFailOnce = val;
    },
    setSaveHoldPromise: (p: Promise<void> | null) => {
      saveHoldPromise = p;
    },
    setSaveFailsTimeout: (val: boolean) => {
      saveFailsTimeout = val;
    },
    setHoldDoc2ContentPromise: (p: Promise<void> | null) => {
      holdDoc2ContentPromise = p;
    },
    setSaveFailsDocStale: (val: boolean) => {
      saveFailsDocStale = val;
    },
    setRefreshFailOnce: (val: boolean) => {
      refreshFailOnce = val;
    },
    async start() {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
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

  // Test 2: Document catalog grouping, search filter, and status badges (with UNPINNED slate)
  await runTest('Test 2: Document catalog grouping, search filter, and status badges', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.waitForSelector('[data-testid="kind-group-CONTROL"]');
      await ctx.page.waitForSelector('[data-testid="kind-group-ARCHITECTURE"]');

      const badgeMatch = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-001"]');
      assert.equal(await badgeMatch.textContent(), 'MATCH');

      // UNPINNED should use neutral/slate family styling
      const badgeUnpinned = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-002"]');
      assert.equal(await badgeUnpinned.textContent(), 'UNPINNED');
      const unpinnedClasses = (await badgeUnpinned.getAttribute('class')) || '';
      assert(unpinnedClasses.includes('bg-slate-100') || unpinnedClasses.includes('text-slate-600') || unpinnedClasses.includes('bg-slate-800'), 'UNPINNED uses slate style');

      const badgeEdit = await ctx.page.waitForSelector('[data-testid="badge-editability-DOC-CTRL-002"]');
      assert.equal(await badgeEdit.textContent(), 'CONTROLLED_EDIT');

      const badgeChanged = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-003"]');
      assert.equal(await badgeChanged.textContent(), 'CHANGED');

      const badgeMissing = await ctx.page.waitForSelector('[data-testid="badge-integrity-DOC-CTRL-004"]');
      assert.equal(await badgeMissing.textContent(), 'MISSING');

      // Search filter
      const searchInput = ctx.page.locator('[data-testid="docs-search-input"]');
      await searchInput.fill('DOC-CTRL-002');
      assert(await ctx.page.locator('[data-testid="doc-item-DOC-CTRL-002"]').isVisible());
      assert(!(await ctx.page.locator('[data-testid="doc-item-DOC-CTRL-001"]').isVisible()));

      await searchInput.fill('');
      assert(await ctx.page.locator('[data-testid="doc-item-DOC-CTRL-001"]').isVisible());
    } finally {
      await ctx.close();
    }
  });

  // Test 3: Read-only document selection and absence of Edit button
  await runTest('Test 3: Read-only document selection and absence of Edit button', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-001"]');
      await ctx.page.waitForSelector('[data-testid="doc-title"]');
      const title = await ctx.page.textContent('[data-testid="doc-title"]');
      assert(title?.includes('Project Charter'));

      const editButtonCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editButtonCount, 0, 'No edit button for read-only documents');
    } finally {
      await ctx.close();
    }
  });

  // Test 4: Markdown security & link safety
  await runTest('Test 4: Markdown security & link safety (inert HTML, blocked URI, safe links)', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');

      const xssTriggered = await ctx.page.evaluate("window.__XSS_TRIGGERED__");
      assert.strictEqual(xssTriggered, undefined, 'Embedded script must not execute');

      const jsLink = ctx.page.locator('a', { hasText: 'Malicious JS Link' });
      const jsHref = (await jsLink.getAttribute('href')) || '';
      assert(!jsHref.toLowerCase().startsWith('javascript:'), 'javascript: URI must be stripped or blocked');

      const dataLink = ctx.page.locator('a', { hasText: 'Malicious Data Link' });
      const dataHref = (await dataLink.getAttribute('href')) || '';
      assert(!dataHref.toLowerCase().startsWith('data:'), 'data: URI must be stripped or blocked');

      const extLink = ctx.page.locator('a', { hasText: 'Safe External Link' });
      assert.equal(await extLink.getAttribute('target'), '_blank');
      const extRel = (await extLink.getAttribute('rel')) || '';
      assert(extRel.includes('noopener') && extRel.includes('noreferrer'), 'External link has safe rel');

      const relLink = ctx.page.locator('a', { hasText: 'Safe Relative Link' });
      assert.equal(await relLink.getAttribute('href'), './OTHER.md');

      // Test Raw Source Toggle
      await ctx.page.click('[data-testid="btn-toggle-raw"]');
      await ctx.page.waitForSelector('[data-testid="doc-content-raw"]');
      const rawText = await ctx.page.textContent('[data-testid="doc-content-raw"]');
      assert(rawText?.includes('# docmonstakrakin current project state'));

      await ctx.page.click('[data-testid="btn-toggle-rendered"]');
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');
    } finally {
      await ctx.close();
    }
  });

  // Test 5A: Controlled 6-step edit workflow
  await runTest('Test 5A: Controlled 6-step edit workflow (VIEW -> EDIT -> DIFF -> VALIDATE -> MODAL -> COMMIT)', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.waitForSelector('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');

      await ctx.page.waitForSelector('[data-testid="draft-editor-textarea"]');
      const editor = ctx.page.locator('[data-testid="draft-editor-textarea"]');
      await editor.fill('# docmonstakrakin current project state\n\nUpdated candidate content for Task 10 verification.');
      await ctx.page.click('[data-testid="btn-preview-diff"]');

      await ctx.page.waitForSelector('[data-testid="diff-view"]');
      await ctx.page.click('[data-testid="btn-validate"]');

      await ctx.page.waitForSelector('[data-testid="validation-view"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');

      await ctx.page.waitForSelector('[data-testid="doc-save-modal"]');
      const sessionName = await ctx.page.textContent('[data-testid="modal-session-name"]');
      assert(sessionName?.includes('Gio'), 'Reviewer name displayed');
      const sessionRoles = await ctx.page.textContent('[data-testid="modal-session-roles"]');
      assert(sessionRoles?.includes('Lead Architect'), 'Reviewer roles displayed');

      const identityInputs = await ctx.page.locator('input[name="actor"], input[name="role"], input[name="reviewer"]').count();
      assert.strictEqual(identityInputs, 0, 'No identity input fields in save modal');

      const confirmSaveBtn = ctx.page.locator('[data-testid="btn-confirm-save"]');
      assert(await confirmSaveBtn.isDisabled(), 'Confirm button disabled initially');

      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Formal Task 10 verification update');
      assert(await confirmSaveBtn.isDisabled(), 'Confirm button still disabled without checkbox');

      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');
      assert(!(await confirmSaveBtn.isDisabled()), 'Confirm button enabled once reason and checkbox valid');

      await confirmSaveBtn.click();

      await ctx.page.waitForSelector('[data-testid="save-success-banner"]');
      const saveCalls = ctx.getSaveCalls();
      assert.strictEqual(saveCalls.length, 1, 'requestSave called exactly once');
      assert.strictEqual(saveCalls[0].reason, 'Formal Task 10 verification update');
      assert.strictEqual(saveCalls[0].humanConfirmed, true);

      const metaText = await ctx.page.textContent('[data-testid="save-success-banner"]');
      assert(metaText?.includes('AUD-TEST-EVENT-001'));
      assert(metaText?.includes('32'));
    } finally {
      await ctx.close();
    }
  });

  // Test 5B: Signed-out session disables final save and shows signed-out text
  await runTest('Test 5B: Signed-out session disables final save without fake identity', async () => {
    const ctx = await setupPage();
    ctx.setSessionMode('SIGNED_OUT');
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');

      await ctx.page.waitForSelector('[data-testid="doc-save-modal"]');
      const text = await ctx.page.textContent('[data-testid="modal-session-name"]');
      assert(text?.includes('No authenticated governance reviewer session'), 'Explicit signed-out message');
      assert(!text?.includes('Authorized Operator') && !text?.includes('Reviewer'), 'No fallback fake identity');

      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Justification text');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');

      const confirmBtn = ctx.page.locator('[data-testid="btn-confirm-save"]');
      assert(await confirmBtn.isDisabled(), 'Confirm button must remain disabled when signed out');
      assert.strictEqual(ctx.getSaveCalls().length, 0, 'No save call permitted');
    } finally {
      await ctx.close();
    }
  });

  // Test 5C: Session load failure disables final save and shows error text
  await runTest('Test 5C: Session load failure disables final save and displays error text', async () => {
    const ctx = await setupPage();
    ctx.setSessionMode('ERROR');
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');

      await ctx.page.waitForSelector('[data-testid="doc-save-modal"]');
      const text = await ctx.page.textContent('[data-testid="doc-save-modal"]');
      assert(text?.includes('Unable to load governance reviewer session'), 'Explicit session load error displayed');

      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Justification text');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');

      const confirmBtn = ctx.page.locator('[data-testid="btn-confirm-save"]');
      assert(await confirmBtn.isDisabled(), 'Confirm button must remain disabled on session error');
    } finally {
      await ctx.close();
    }
  });

  // Test 5D: Accessible save dialog (role="dialog" and aria-modal="true")
  await runTest('Test 5D: Accessible save dialog attributes', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');

      const modal = ctx.page.locator('[data-testid="doc-save-modal"] [role="dialog"]');
      await modal.waitFor();
      assert.equal(await modal.getAttribute('aria-modal'), 'true');
      assert(await modal.getAttribute('aria-labelledby'), 'aria-labelledby present');
    } finally {
      await ctx.close();
    }
  });

  // Test 5E: Explicit COORDINATED_COMMIT pending state + exactly one save request
  await runTest('Test 5E: Explicit COORDINATED_COMMIT pending state + single save call', async () => {
    const ctx = await setupPage();
    let resolveSave!: () => void;
    const saveDeferred = new Promise<void>((r) => (resolveSave = r));
    ctx.setSaveHoldPromise(saveDeferred);

    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');

      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Testing deferred save commit');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');

      const confirmBtn = ctx.page.locator('[data-testid="btn-confirm-save"]');
      await confirmBtn.click();

      // Check Step 6 COORDINATED_COMMIT state in UI
      await ctx.page.waitForSelector('[data-testid="saving-indicator"]');
      assert(await confirmBtn.isDisabled(), 'Duplicate save button disabled during commit');

      // Verify catalog navigation is disabled
      const otherDocItem = ctx.page.locator('[data-testid="doc-item-DOC-CTRL-001"]');
      assert(await otherDocItem.isDisabled() || (await otherDocItem.getAttribute('disabled')) !== null, 'Catalog navigation disabled during save');

      // Resolve the held save
      resolveSave();

      await ctx.page.waitForSelector('[data-testid="save-success-banner"]');
      assert.strictEqual(ctx.getSaveCalls().length, 1, 'requestSave called exactly once');
    } finally {
      await ctx.close();
    }
  });

  // Test 6A: Stale base hash blocks validation and save progression
  await runTest('Test 6A: Stale base hash in diff hides Validate button and blocks save progression', async () => {
    const ctx = await setupPage();
    ctx.setDiffIsStale(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');

      await ctx.page.waitForSelector('[data-testid="stale-warning"]');
      const validateCount = await ctx.page.locator('[data-testid="btn-validate"]').count();
      assert.strictEqual(validateCount, 0, 'Validate button must not be rendered when diff is stale');

      assert.strictEqual(ctx.getValidateCalls().length, 0, 'No requestValidate called');
      assert.strictEqual(ctx.getSaveCalls().length, 0, 'No requestSave called');
    } finally {
      await ctx.close();
    }
  });

  // Test 6B: No-change diff blocks validation and save progression
  await runTest('Test 6B: No-change diff blocks validation and save progression', async () => {
    const ctx = await setupPage();
    ctx.setDiffHasChanges(false);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');

      await ctx.page.waitForSelector('[data-testid="no-changes-detected"]');
      const text = await ctx.page.textContent('[data-testid="no-changes-detected"]');
      assert(text?.includes('No changes detected'), 'Displays No changes detected');

      const validateCount = await ctx.page.locator('[data-testid="btn-validate"]').count();
      assert.strictEqual(validateCount, 0, 'Validate button must not be rendered when no changes exist');

      assert.strictEqual(ctx.getValidateCalls().length, 0, 'No requestValidate called');
      assert.strictEqual(ctx.getSaveCalls().length, 0, 'No requestSave called');
    } finally {
      await ctx.close();
    }
  });

  // Test 7A: Validation failure blocks progression to save
  await runTest('Test 7A: Validation failure blocks progression to save', async () => {
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

      const proceedCount = await ctx.page.locator('[data-testid="btn-proceed-to-save"]').count();
      assert.strictEqual(proceedCount, 0, 'Cannot proceed to save when validation fails');
    } finally {
      await ctx.close();
    }
  });

  // Test 7B: Draft mutation invalidation clears diff and validation results
  await runTest('Test 7B: Draft mutation clears diff and validation results', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.waitForSelector('[data-testid="diff-view"]');

      // Go back to editor and change draft
      await ctx.page.click('button:has-text("Back to Editor")');
      const editor = ctx.page.locator('[data-testid="draft-editor-textarea"]');
      await editor.type(' Additional draft modifications.');

      // Check that internal diff is cleared or re-preview is required
      assert.strictEqual(await ctx.page.locator('[data-testid="diff-view"]').count(), 0);
    } finally {
      await ctx.close();
    }
  });

  // Test 7C: MIXED EOL document hides Edit button and shows explicit warning
  await runTest('Test 7C: MIXED EOL document hides Edit button and shows explicit warning', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-005"]');
      await ctx.page.waitForSelector('[data-testid="doc-title"]');

      const editBtnCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editBtnCount, 0, 'No edit button for MIXED EOL document');

      await ctx.page.waitForSelector('[data-testid="mixed-eol-warning"]');
      const warningText = await ctx.page.textContent('[data-testid="mixed-eol-warning"]');
      assert(warningText?.includes('Editing is unavailable because this document has mixed line endings'));
    } finally {
      await ctx.close();
    }
  });

  // Test 7D: MISSING document hides Edit button and shows explicit missing state
  await runTest('Test 7D: MISSING document hides Edit button and shows explicit missing state', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-004"]');

      const editBtnCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editBtnCount, 0, 'No edit button for MISSING document');

      await ctx.page.waitForSelector('[data-testid="missing-doc-state"]');
      const text = await ctx.page.textContent('[data-testid="missing-doc-state"]');
      assert(text?.includes('missing') || text?.includes('Missing'));
    } finally {
      await ctx.close();
    }
  });

  // Test 8: Custom loader prop injection and unmount invalidation
  await runTest('Test 8: Custom loader prop injection and unmount invalidation', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
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

      await ctx.page.waitForSelector('[data-testid="doc-item-DOC-CUSTOM-001"]');
      const customTitle = await ctx.page.textContent('[data-testid="doc-item-DOC-CUSTOM-001"]');
      assert(customTitle?.includes('Custom Injected Doc'));

      await ctx.page.evaluate("window.__setMounted(false)");
      await ctx.page.waitForSelector('#unmounted-marker');

      const invResult = await ctx.page.evaluate("window.__invalidateCalled()");
      assert.strictEqual(invResult, true, 'api.invalidate() must be called on unmount');
    } finally {
      await ctx.close();
    }
  });

  // Test 9A: Save succeeds but canonical refresh fails, preserving metadata and blocking Edit until retry
  await runTest('Test 9A: Save succeeds + refresh fails preserves metadata and blocks Edit until retry', async () => {
    const ctx = await setupPage();
    ctx.setPostSaveRefreshFailOnce(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');
      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Valid save justification');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');
      await ctx.page.click('[data-testid="btn-confirm-save"]');

      // Save metadata preserved
      await ctx.page.waitForSelector('[data-testid="save-success-banner"]');
      const bannerText = await ctx.page.textContent('[data-testid="save-success-banner"]');
      assert(bannerText?.includes('AUD-TEST-EVENT-001'), 'Audit ID preserved');

      // Refresh failure message
      await ctx.page.waitForSelector('[data-testid="canonical-refresh-error"]');
      const errText = await ctx.page.textContent('[data-testid="canonical-refresh-error"]');
      assert(errText?.includes('Save succeeded, but canonical refresh failed'));

      // doc-save-modal absent
      const modalCount = await ctx.page.locator('[data-testid="doc-save-modal"]').count();
      assert.strictEqual(modalCount, 0, 'doc-save-modal must be absent');

      // saving-indicator absent
      const savingCount = await ctx.page.locator('[data-testid="saving-indicator"]').count();
      assert.strictEqual(savingCount, 0, 'saving-indicator must be absent');

      // Edit button must NOT be available while refresh is required
      const editBtnCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editBtnCount, 0, 'Edit unavailable during refresh error');

      // Retry button present
      await ctx.page.waitForSelector('[data-testid="btn-retry-canonical-refresh"]');
      await ctx.page.click('[data-testid="btn-retry-canonical-refresh"]');

      // Successful refresh re-enables Edit
      await ctx.page.waitForSelector('[data-testid="btn-edit-document"]');
    } finally {
      await ctx.close();
    }
  });

  // Test 9B: Retry refresh uses fresh base hash in subsequent edit
  await runTest('Test 9B: Subsequent edit uses freshly loaded base hash', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');
      await ctx.page.fill('[data-testid="modal-save-reason"]', 'First update');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');
      await ctx.page.click('[data-testid="btn-confirm-save"]');

      await ctx.page.waitForSelector('[data-testid="save-success-banner"]');

      // Start second edit
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');

      const diffCalls = ctx.getDiffCalls();
      const lastDiff = diffCalls[diffCalls.length - 1];
      assert.equal(
        lastDiff.baseSha256,
        '9999999999999999999999999999999999999999999999999999999999999999',
        'Next edit uses new canonical rawSha256'
      );
    } finally {
      await ctx.close();
    }
  });

  // Test 9C: Uncertain timeout save triggers canonical reload without auto-retrying save
  await runTest('Test 9C: Uncertain save timeout reloads canonical state without auto-retry', async () => {
    const ctx = await setupPage();
    ctx.setSaveFailsTimeout(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');
      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Timing out update');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');
      await ctx.page.click('[data-testid="btn-confirm-save"]');

      // Should display uncertain outcome banner
      await ctx.page.waitForSelector('[data-testid="uncertain-save-warning"]');
      const text = await ctx.page.textContent('[data-testid="uncertain-save-warning"]');
      assert(text?.includes('Save outcome was uncertain; canonical state was reloaded'));

      assert.strictEqual(ctx.getSaveCalls().length, 1, 'Never retries save automatically');
    } finally {
      await ctx.close();
    }
  });

  // Test 10A: Catalog initial failure shows role="alert" and Retry catalog button
  await runTest('Test 10A: Catalog initial load error shows alert and Retry catalog button', async () => {
    const ctx = await setupPage();
    ctx.setCatalogFailOnce(true);
    try {
      await ctx.start();
      await ctx.page.waitForSelector('[data-testid="catalog-error-alert"][role="alert"]');
      const emptyStateCount = await ctx.page.locator('[data-testid="controlled-docs-empty"]').count();
      assert.strictEqual(emptyStateCount, 0, 'Must not show empty state when catalog fails');

      await ctx.page.click('[data-testid="btn-retry-catalog"]');
      // Retry succeeds and catalog displays
      await ctx.page.waitForSelector('[data-testid="kind-group-CONTROL"]');
    } finally {
      await ctx.close();
    }
  });

  // Test 11: Document selection reset and race condition protection (Section 10 & 11)
  await runTest('Test 11: Document selection reset and race condition protection', async () => {
    const ctx = await setupPage();
    let resolveDoc2: (() => void) | null = null;
    const holdDoc2 = new Promise<void>((resolve) => {
      resolveDoc2 = resolve;
    });
    ctx.setHoldDoc2ContentPromise(holdDoc2);

    try {
      await ctx.start();
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');
      const doc1Text = await ctx.page.textContent('[data-testid="doc-content-rendered"]');
      assert(doc1Text?.includes('Project Charter'), 'Doc 1 content rendered initially');

      // Click Document 2 (DOC-CTRL-002), whose content load is held
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');

      // 1. Loading state is shown
      await ctx.page.waitForSelector('text=Loading document content...');

      // 2. A's rendered/raw content is NOT visible
      const renderedCount = await ctx.page.locator('[data-testid="doc-content-rendered"]').count();
      assert.strictEqual(renderedCount, 0, "Document A's rendered content is not visible while B loads");

      // 3. A's draft/base is not usable (Edit button is not shown while loading)
      const editBtnCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editBtnCount, 0, 'Edit button not visible while document content is loading');

      // Now resolve Document B
      resolveDoc2!();

      // Only B content appears
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');
      const doc2Text = await ctx.page.textContent('[data-testid="doc-content-rendered"]');
      assert(doc2Text?.includes('docmonstakrakin current project state'), 'Only Doc B content rendered');
      assert(!doc2Text?.includes('Project Charter'), 'Doc A content must not remain');
    } finally {
      resolveDoc2?.();
      await ctx.close();
    }
  });

  // Test 12: DOCUMENT_STALE save rejection locks editing until reload (Section 9 & 12)
  await runTest('Test 12: DOCUMENT_STALE save rejection locks editing until reload', async () => {
    const ctx = await setupPage();
    ctx.setSaveFailsDocStale(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');
      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Stale edit attempt');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');
      await ctx.page.click('[data-testid="btn-confirm-save"]');

      // Modal must close
      const modalCount = await ctx.page.locator('[data-testid="doc-save-modal"]').count();
      assert.strictEqual(modalCount, 0, 'Save modal closed after DOCUMENT_STALE');

      // Canonical reload warning shown
      await ctx.page.waitForSelector('[data-testid="canonical-refresh-error"]');
      const errText = await ctx.page.textContent('[data-testid="canonical-refresh-error"]');
      assert(
        errText?.includes('Document changed before save. Reload canonical state before editing again.'),
        'Shows document changed message'
      );

      // No second save request
      assert.strictEqual(ctx.getSaveCalls().length, 1, 'Only one save request made');

      // Edit unavailable
      const editBtnCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editBtnCount, 0, 'Edit unavailable while refresh is required');

      // Reload Canonical Content action exposed
      await ctx.page.waitForSelector('[data-testid="btn-reload-canonical"]');
      await ctx.page.click('[data-testid="btn-reload-canonical"]');

      // Refresh succeeds: Edit becomes available again
      await ctx.page.waitForSelector('[data-testid="btn-edit-document"]');
    } finally {
      await ctx.close();
    }
  });

  // Test 13: Stale-diff reload failure message is context-neutral (Section 8)
  await runTest('Test 13: Stale-diff reload failure message is context-neutral', async () => {
    const ctx = await setupPage();
    ctx.setDiffIsStale(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.waitForSelector('[data-testid="btn-edit-document"]');
      ctx.setRefreshFailOnce(true);
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');

      await ctx.page.waitForSelector('[data-testid="stale-warning"]');
      await ctx.page.click('[data-testid="btn-reload-canonical"]');

      await ctx.page.waitForSelector('[data-testid="canonical-refresh-error"]');
      const errText = await ctx.page.textContent('[data-testid="canonical-refresh-error"]');
      assert(
        errText?.includes('Canonical refresh failed. Reload the latest document before continuing.'),
        'Must display exact stale-diff reload failure message'
      );
      assert(!errText?.includes('Save succeeded'), 'Must not say Save succeeded');
    } finally {
      await ctx.close();
    }
  });

  // Test 14: Uncertain save timeout followed by refresh failure displays uncertain failure message (Section 7)
  await runTest('Test 14: Uncertain save timeout followed by refresh failure', async () => {
    const ctx = await setupPage();
    ctx.setSaveFailsTimeout(true);
    try {
      await ctx.start();
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-002"]');
      await ctx.page.waitForSelector('[data-testid="btn-edit-document"]');
      ctx.setRefreshFailOnce(true);
      await ctx.page.click('[data-testid="btn-edit-document"]');
      await ctx.page.click('[data-testid="btn-preview-diff"]');
      await ctx.page.click('[data-testid="btn-validate"]');
      await ctx.page.click('[data-testid="btn-proceed-to-save"]');
      await ctx.page.fill('[data-testid="modal-save-reason"]', 'Uncertain timeout update');
      await ctx.page.check('[data-testid="modal-confirm-checkbox"]');
      await ctx.page.click('[data-testid="btn-confirm-save"]');

      await ctx.page.waitForSelector('[data-testid="canonical-refresh-error"]');
      const errText = await ctx.page.textContent('[data-testid="canonical-refresh-error"]');
      assert(
        errText?.includes('Save outcome is uncertain and canonical refresh failed.'),
        'Displays uncertain refresh failure message'
      );

      const modalCount = await ctx.page.locator('[data-testid="doc-save-modal"]').count();
      assert.strictEqual(modalCount, 0, 'Modal is closed');

      const editBtnCount = await ctx.page.locator('[data-testid="btn-edit-document"]').count();
      assert.strictEqual(editBtnCount, 0, 'Edit unavailable');

      assert.strictEqual(ctx.getSaveCalls().length, 1, 'Never retries save');
    } finally {
      await ctx.close();
    }
  });

  // Test 15: Rich markdown rendering and light presentation shell verification
  await runTest('Test 15: Rich markdown rendering and light presentation shell verification', async () => {
    const ctx = await setupPage();
    try {
      await ctx.start();

      // Check light background on repository-docs-shell or controlled-docs-workspace
      const shell = ctx.page.locator('[data-testid="controlled-docs-workspace"]');
      await shell.waitFor();
      const shellClasses = (await shell.getAttribute('class')) || '';
      assert(
        !shellClasses.includes('bg-slate-950'),
        'Outer workspace shell must not use dark background bg-slate-950'
      );
      assert(
        shellClasses.includes('bg-white') || shellClasses.includes('bg-slate-50'),
        'Outer workspace shell must use light background (bg-white or bg-slate-50)'
      );

      // Select DOC-CTRL-006 (Rich formatting document)
      await ctx.page.click('[data-testid="doc-item-DOC-CTRL-006"]');
      await ctx.page.waitForSelector('[data-testid="doc-content-rendered"]');
      const rendered = ctx.page.locator('[data-testid="doc-content-rendered"]');

      // h1 element is rendered with appropriate styling
      const h1 = rendered.locator('h1');
      assert.strictEqual(await h1.count(), 1, 'h1 rendered');
      assert.strictEqual((await h1.textContent())?.trim(), 'Heading 1');
      const h1Class = (await h1.getAttribute('class')) || '';
      assert(h1Class.includes('text-3xl') || h1Class.includes('font-bold'), 'h1 has appropriate styling');

      // h2 element is rendered
      const h2 = rendered.locator('h2');
      assert.strictEqual(await h2.count(), 1, 'h2 rendered');
      assert.strictEqual((await h2.textContent())?.trim(), 'Heading 2');

      // h3 element is rendered
      const h3 = rendered.locator('h3');
      assert.strictEqual(await h3.count(), 1, 'h3 rendered');
      assert.strictEqual((await h3.textContent())?.trim(), 'Heading 3');

      // p element is rendered
      const p = rendered.locator('p');
      assert((await p.count()) >= 1, 'p rendered');

      // strong element is rendered
      const strong = rendered.locator('strong');
      assert.strictEqual(await strong.count(), 1, 'strong rendered');
      assert.strictEqual((await strong.textContent())?.trim(), 'bold');

      // ul and li elements are rendered
      const ul = rendered.locator('ul');
      assert.strictEqual(await ul.count(), 1, 'ul rendered');
      const ulLi = ul.locator('li');
      assert.strictEqual(await ulLi.count(), 2, 'ul li rendered');

      // ol and li elements are rendered
      const ol = rendered.locator('ol');
      assert.strictEqual(await ol.count(), 1, 'ol rendered');
      const olLi = ol.locator('li');
      assert.strictEqual(await olLi.count(), 2, 'ol li rendered');

      // blockquote element is rendered
      const blockquote = rendered.locator('blockquote');
      assert.strictEqual(await blockquote.count(), 1, 'blockquote rendered');
      assert((await blockquote.textContent())?.includes('Blockquote'));

      // code element is rendered
      const inlineCode = rendered.locator('code').filter({ hasText: 'inline code' });
      assert.strictEqual(await inlineCode.count(), 1, 'inline code rendered');

      // pre element is rendered
      const pre = rendered.locator('pre');
      assert((await pre.count()) >= 1, 'pre rendered');
      assert((await pre.textContent())?.includes('echo hello'), 'pre code block content rendered');

      // table, th, and td elements are rendered
      const table = rendered.locator('table');
      assert.strictEqual(await table.count(), 1, 'table rendered');
      const th = table.locator('th');
      assert.strictEqual(await th.count(), 2, 'th rendered');
      const td = table.locator('td');
      assert.strictEqual(await td.count(), 2, 'td rendered');
    } finally {
      await ctx.close();
    }
  });
} finally {
  await browser.close();
  await vite.close();
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
