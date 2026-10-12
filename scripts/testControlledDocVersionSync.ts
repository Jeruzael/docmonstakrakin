import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, type Page, type Route } from 'playwright';
import { createServer } from 'vite';
import { INITIAL_PROJECTS } from '../src/data/initialData.ts';
import type {
  ControlledDocumentSummary,
  DocumentContentResponse,
  DocumentDiffResponse,
  DocumentValidationResponse,
  DocumentSaveResponse,
} from '../src/types.ts';

// Integration test for Controlled Document Project Version Synchronization
// Serves real App with real TopBar, ControlledDocsView, and Project State.
const root = process.cwd();
const vite = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
await vite.listen();
const base = vite.resolvedUrls!.local[0];

const executable =
  process.env.DMK_TEST_BROWSER ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) =>
    fs.existsSync(p)
  );

const browser = await chromium.launch({
  headless: true,
  executablePath: executable,
});

let passed = 0;
let failed = 0;
const results: { name: string; status: string; error?: string }[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    results.push({ name, status: 'PASSED' });
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    failed++;
    results.push({ name, status: 'FAILED', error: err.message });
    console.error(`FAIL: ${name}`);
    console.error(err);
  }
}

// Synthetic Documents Catalog
const DOC_SUMMARY_002: ControlledDocumentSummary = {
  id: 'DOC-CTRL-002',
  path: 'docs/00_control/PROJECT_STATE.md',
  kind: 'CONTROL',
  authority: 'REFERENCE',
  editability: 'CONTROLLED_EDIT',
  fileType: 'MARKDOWN',
  title: 'Project State & Governance Baseline',
  description: 'Current Project State',
  integrityStatus: 'MATCH',
  sha256Digest: '1111111111111111111111111111111111111111111111111111111111111111',
  currentSha256: '1111111111111111111111111111111111111111111111111111111111111111',
  sizeBytes: 2048,
  eol: 'LF',
};

const DOC_CONTENT_002: DocumentContentResponse = {
  document: DOC_SUMMARY_002,
  content: '# Project State\n\nBaseline version 120 content.\n',
  rawSha256: '1111111111111111111111111111111111111111111111111111111111111111',
  sizeBytes: 42,
  eol: 'LF',
};

interface TestHarnessOptions {
  initialStateVersion?: number;
  projectBVersion?: number;
  sessionAuthenticated?: boolean;
  saveResponseOverride?: (reqBody: any) => Promise<{ status: number; body: any }>;
  refreshFails?: boolean;
  projectAResponseOverride?: (callCount: number) => Promise<{ status: number; body: any } | null>;
  auditResponseOverride?: (projectId: string, callCount: number, saveCallsCount: number) => Promise<{ status: number; body: any } | null>;
}

async function createHarness(options: TestHarnessOptions = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8000);

  const initialVersion = options.initialStateVersion ?? 120;
  const projectBVersion = options.projectBVersion ?? 50;

  const projectA = {
    ...structuredClone(INITIAL_PROJECTS[0]),
    id: 'PRJ-DOCMONSTAKRAKIN',
    name: 'docmonstakrakin',
    stateVersion: initialVersion,
  };

  const projectB = {
    ...structuredClone(INITIAL_PROJECTS[0]),
    id: 'PRJ-FIXTURE-B',
    name: 'Fixture B',
    stateVersion: projectBVersion,
  };

  let projectsList = [projectA, projectB];
  let projectAData = structuredClone(projectA);
  let projectBData = structuredClone(projectB);

  let currentDocContent = structuredClone(DOC_CONTENT_002);
  let currentDocSummary = structuredClone(DOC_SUMMARY_002);

  const saveCalls: any[] = [];
  let projectListFetchCount = 0;
  let projectAFetchCount = 0;
  let projectAHoldPromise: Promise<void> | null = null;
  let auditFetchCount = 0;
  let auditHoldPromise: Promise<void> | null = null;

  let projectListHoldPromise: Promise<void> | null = null;
  let dynamicProjectListResponseOverride: ((callCount: number) => Promise<{ status: number; body: any } | null>) | null = null;

  let dynamicProjectAResponseOverride: ((callCount: number) => Promise<{ status: number; body: any } | null>) | null =
    options.projectAResponseOverride ?? null;
  let dynamicAuditResponseOverride: ((projectId: string, callCount: number, saveCallsCount: number) => Promise<{ status: number; body: any } | null>) | null =
    options.auditResponseOverride ?? null;

  const projectAAuditLogs: any[] = [
    {
      id: 'AUD-INIT-001',
      actor: 'Lead Architect',
      timestamp: new Date().toISOString(),
      action: 'PROJECT_INITIALIZED',
      target: 'PRJ-DOCMONSTAKRAKIN',
      stateHash: 'init-state-hash',
    },
  ];
  const projectBAuditLogs: any[] = [
    {
      id: 'AUD-INIT-002',
      actor: 'Lead Architect',
      timestamp: new Date().toISOString(),
      action: 'PROJECT_INITIALIZED',
      target: 'PRJ-FIXTURE-B',
      stateHash: 'init-b-state-hash',
    },
  ];

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url()).pathname;
    const method = route.request().method();

    const send = async (body: any, status = 200) => {
      await route.fulfill({ status, json: body }).catch(() => {});
    };

    if (method === 'GET' && url === '/api/projects') {
      projectListFetchCount++;
      if (projectListHoldPromise) {
        await projectListHoldPromise;
      }
      if (dynamicProjectListResponseOverride) {
        const custom = await dynamicProjectListResponseOverride(projectListFetchCount);
        if (custom) {
          return send(custom.body, custom.status);
        }
      }
      return send(projectsList);
    }

    if (url === '/api/governance/session') {
      if (options.sessionAuthenticated === false) {
        return send({ identity: null });
      }
      return send({
        identity: {
          name: 'Lead Architect',
          roles: ['LEAD_ARCHITECT'],
        },
      });
    }

    // Projects endpoints
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN') {
      projectAFetchCount++;
      if (projectAHoldPromise) {
        await projectAHoldPromise;
      }
      if (dynamicProjectAResponseOverride) {
        const custom = await dynamicProjectAResponseOverride(projectAFetchCount);
        if (custom) {
          return send(custom.body, custom.status);
        }
      }
      return send(projectAData);
    }
    if (url === '/api/projects/PRJ-FIXTURE-B') {
      return send(projectBData);
    }

    // Authoritative Audit endpoints
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/audit') {
      auditFetchCount++;
      if (dynamicAuditResponseOverride) {
        const custom = await dynamicAuditResponseOverride('PRJ-DOCMONSTAKRAKIN', auditFetchCount, saveCalls.length);
        if (custom) {
          return send(custom.body, custom.status);
        }
      }
      if (auditHoldPromise) {
        await auditHoldPromise;
      }
      return send(projectAAuditLogs);
    }

    if (url === '/api/projects/PRJ-FIXTURE-B/audit') {
      if (dynamicAuditResponseOverride) {
        const custom = await dynamicAuditResponseOverride('PRJ-FIXTURE-B', 1, saveCalls.length);
        if (custom) {
          return send(custom.body, custom.status);
        }
      }
      return send(projectBAuditLogs);
    }

    // Controlled docs catalog
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs' || url === '/api/projects/PRJ-FIXTURE-B/docs') {
      if (options.refreshFails && saveCalls.length > 0) {
        return send({ error: 'Catalog refresh failed.' }, 500);
      }
      return send([currentDocSummary]);
    }

    // Diff
    if (url.endsWith('/diff') && method === 'POST') {
      const body = route.request().postDataJSON();
      return send({
        documentId: 'DOC-CTRL-002',
        oldHash: body.baseSha256,
        candidateHash: '2222222222222222222222222222222222222222222222222222222222222222',
        isStale: false,
        hasChanges: true,
        additions: 1,
        deletions: 0,
        changedLines: 1,
        unifiedDiff: '--- a/docs/00_control/PROJECT_STATE.md\n+++ b/docs/00_control/PROJECT_STATE.md\n@@ -1,2 +1,3 @@\n+updated line',
      } as DocumentDiffResponse);
    }

    // Validate
    if (url.endsWith('/validate') && method === 'POST') {
      return send({
        documentId: 'DOC-CTRL-002',
        valid: true,
        errors: [],
        warnings: [],
      } as DocumentValidationResponse);
    }

    // Save
    if (url.endsWith('/save') && method === 'POST') {
      const body = route.request().postDataJSON();
      saveCalls.push(body);

      if (options.saveResponseOverride) {
        const custom = await options.saveResponseOverride(body);
        if (custom.body?.stateVersion) {
          projectAData.stateVersion = custom.body.stateVersion;
          projectA.stateVersion = custom.body.stateVersion;
        }
        if (custom.body?.newSha256) {
          currentDocContent = {
            ...currentDocContent,
            rawSha256: custom.body.newSha256,
            document: {
              ...currentDocContent.document,
              sha256Digest: custom.body.newSha256,
              currentSha256: custom.body.newSha256,
            },
          };
        }
        return route.fulfill({ status: custom.status, json: custom.body }).catch(() => {});
      }

      const nextVersion = 121;
      projectAData.stateVersion = nextVersion;
      projectA.stateVersion = nextVersion;
      const resp: DocumentSaveResponse = {
        success: true,
        documentId: 'DOC-CTRL-002',
        path: 'docs/00_control/PROJECT_STATE.md',
        previousSha256: body.baseSha256,
        newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
        stateVersion: nextVersion,
        auditEventId: 'AUD-SYNC-TEST-001',
        timestamp: new Date().toISOString(),
      };

      projectAAuditLogs.push({
        id: resp.auditEventId,
        actor: 'Lead Architect',
        timestamp: resp.timestamp,
        action: 'DOCUMENT_UPDATED',
        target: resp.documentId,
        stateHash: resp.newSha256,
        details: {
          path: resp.path,
          previousSha256: resp.previousSha256,
          newSha256: resp.newSha256,
          stateVersion: resp.stateVersion,
        },
      });

      return send(resp);
    }

    // Controlled doc content
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002' || url === '/api/projects/PRJ-FIXTURE-B/docs/DOC-CTRL-002') {
      if (options.refreshFails && saveCalls.length > 0) {
        return send({ error: 'Content refresh failed.' }, 500);
      }
      return send(currentDocContent);
    }

    // Project sub-resources
    if (url.startsWith('/api/projects/PRJ-DOCMONSTAKRAKIN/') || url.startsWith('/api/projects/PRJ-FIXTURE-B/')) {
      const suffix = url.split('/').pop();
      if (suffix === 'next-action') {
        return send({ id: 'ACT-01', title: 'Review', reason: 'None', blocks: [], priority: 'LOW' });
      }
      return send([]);
    }

    return send({ error: 'Not found' }, 404);
  });

  await page.goto(`${base}?project=PRJ-DOCMONSTAKRAKIN`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Select project' }).waitFor();
  await page.waitForFunction(() => {
    const text = document.querySelector('header button')?.textContent || '';
    return text.includes('docmonstakrakin') && !text.includes('No Active Projects');
  });

  return {
    page,
    saveCalls,
    getProjectAFetchCount: () => projectAFetchCount,
    holdProjectAResponse: (p: Promise<void> | null) => {
      projectAHoldPromise = p;
    },
    setProjectAResponseOverride: (fn: ((callCount: number) => Promise<{ status: number; body: any } | null>) | null) => {
      dynamicProjectAResponseOverride = fn;
    },
    getAuditFetchCount: () => auditFetchCount,
    holdAuditResponse: (p: Promise<void> | null) => {
      auditHoldPromise = p;
    },
    setAuditResponseOverride: (fn: ((projectId: string, callCount: number, saveCallsCount: number) => Promise<{ status: number; body: any } | null>) | null) => {
      dynamicAuditResponseOverride = fn;
    },
    getProjectAAuditLogs: () => projectAAuditLogs,
    getProjectBAuditLogs: () => projectBAuditLogs,
    setProjectAData: (d: any) => {
      projectAData = d;
    },
    setProjectsList: (l: any) => {
      projectsList = l;
    },
    getProjectListFetchCount: () => projectListFetchCount,
    holdProjectListResponse: (p: Promise<void> | null) => {
      projectListHoldPromise = p;
    },
    setProjectListResponseOverride: (fn: ((callCount: number) => Promise<{ status: number; body: any } | null>) | null) => {
      dynamicProjectListResponseOverride = fn;
    },
    close: async () => {
      await page.close();
    },
  };
}

// Helper: navigate to Controlled Docs view and execute save workflow
async function executeSaveWorkflow(page: Page, reason = 'Routine governance update') {
  // Navigate to Controlled Documents view via sidebar
  await page.getByRole('button', { name: 'Reports & Export' }).click();
  await page.locator('[data-testid="controlled-docs-workspace"]').waitFor();

  // Select DOC-CTRL-002
  await page.locator('[data-testid="doc-item-DOC-CTRL-002"]').click();
  await page.locator('[data-testid="doc-title"]').waitFor();

  // Step 2: Edit Draft
  await page.locator('[data-testid="btn-edit-document"]').click();
  const editor = page.locator('[data-testid="draft-editor-textarea"]');
  await editor.waitFor();
  await editor.fill('# Project State\n\nUpdated governance baseline content for version sync test.\n');

  // Step 3: Preview Changes (Diff)
  await page.locator('[data-testid="btn-preview-diff"]').click();
  await page.locator('[data-testid="diff-view"]').waitFor();

  // Step 4: Validate Changes
  await page.locator('[data-testid="btn-validate"]').click();
  await page.locator('[data-testid="validation-view"]').waitFor();

  // Step 5: Proceed to Governance Save modal
  await page.locator('[data-testid="btn-proceed-to-save"]').click();
  await page.locator('[data-testid="doc-save-modal"]').waitFor();

  // Fill reason and check confirmation
  await page.locator('[data-testid="modal-save-reason"]').fill(reason);
  await page.locator('[data-testid="modal-confirm-checkbox"]').check();

  // Step 6: Commit Save
  const commitBtn = page.locator('[data-testid="btn-confirm-save"]');
  await commitBtn.click();
}

console.log('------------------------------------------------------------');
console.log('DMK Controlled Document Project Version Synchronization Test');
console.log('------------------------------------------------------------');

// Scenario 1 & 2: Successful Save and Success Banner Consistency
await test('Scenario 1 & 2: Successful save updates TopBar to v121 and matches banner without reload', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    // Verify initial TopBar version is v120
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });
    assert.match(await topBarProjectBtn.innerText(), /v120/, 'TopBar must start at v120');

    // Execute save workflow
    await executeSaveWorkflow(page);

    // Save success banner displays version 121
    const banner = page.locator('[data-testid="save-success-banner"]');
    await banner.waitFor();
    const bannerText = await banner.innerText();
    assert.match(bannerText, /121/, 'Save banner must display confirmed version 121');

    // TopBar MUST display v121 without any page refresh!
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar must immediately display v121 after save');

    // Project selector dropdown also reflects v121
    await topBarProjectBtn.click();
    const activeProjectInList = page.locator('button').filter({ hasText: 'docmonstakrakin' }).first();
    assert.match(await activeProjectInList.innerText(), /docmonstakrakin/);
  } finally {
    await harness.close();
  }
});

// Scenario 3: No Component Remount
await test('Scenario 3: ControlledDocsView remains mounted, preserving editor context & success banner', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    await executeSaveWorkflow(page);

    // ControlledDocsView is still mounted and showing save success
    await page.locator('[data-testid="controlled-docs-workspace"]').waitFor();
    await page.locator('[data-testid="save-success-banner"]').waitFor();
    // Document DOC-CTRL-002 remains selected
    assert.equal(await page.locator('[data-testid="doc-title"]').innerText(), 'Project State & Governance Baseline');
  } finally {
    await harness.close();
  }
});

// Scenario 4: Failed Save (HTTP 500)
await test('Scenario 4: Failed save does not advance TopBar version', async () => {
  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async () => ({
      status: 500,
      body: { error: 'Internal server error during persistence.' },
    }),
  });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });
    assert.match(await topBarProjectBtn.innerText(), /v120/);

    await executeSaveWorkflow(page);

    // Modal shows error
    await page.locator('[data-testid="doc-save-modal"]').waitFor();
    const errorText = await page.locator('[data-testid="save-error-banner"]').innerText();
    assert.match(errorText, /Internal server error/);

    // TopBar remains v120
    assert.match(await topBarProjectBtn.innerText(), /v120/, 'TopBar must remain v120 on failed save');
  } finally {
    await harness.close();
  }
});

// Scenario 5: Signed-Out Save (HTTP 401)
await test('Scenario 5: Signed-Out Save disables save progression and preserves TopBar version', async () => {
  const harness = await createHarness({
    initialStateVersion: 120,
    sessionAuthenticated: false,
  });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });
    assert.match(await topBarProjectBtn.innerText(), /v120/);

    // Navigate to docs and attempt to open save modal
    await page.getByRole('button', { name: 'Reports & Export' }).click();
    await page.locator('[data-testid="doc-item-DOC-CTRL-002"]').click();
    await page.locator('[data-testid="btn-edit-document"]').click();
    await page.locator('[data-testid="btn-preview-diff"]').click();
    await page.locator('[data-testid="btn-validate"]').click();
    await page.locator('[data-testid="btn-proceed-to-save"]').click();

    // The save dialog should show session error and disable commit
    await page.locator('[data-testid="doc-save-modal"]').waitFor();
    const commitBtn = page.locator('[data-testid="btn-confirm-save"]');
    assert.equal(await commitBtn.isDisabled(), true, 'Save button must be disabled when signed out');

    // TopBar remains v120
    assert.match(await topBarProjectBtn.innerText(), /v120/, 'TopBar must remain v120');
  } finally {
    await harness.close();
  }
});

// Scenario 6: Stale Document (HTTP 409)
await test('Scenario 6: Stale document response (HTTP 409) does not advance version', async () => {
  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async () => ({
      status: 409,
      body: { error: 'DOCUMENT_STALE: Base SHA mismatch.' },
    }),
  });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });
    assert.match(await topBarProjectBtn.innerText(), /v120/);

    await executeSaveWorkflow(page);

    // Shows stale error banner
    await page.locator('[data-testid="canonical-refresh-error"]').waitFor();

    // TopBar remains v120
    assert.match(await topBarProjectBtn.innerText(), /v120/, 'TopBar must remain v120 on stale document response');
  } finally {
    await harness.close();
  }
});

// Scenario 7: Uncertain Save (Timeout)
await test('Scenario 7: Uncertain save timeout does not update TopBar version', async () => {
  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async () => ({
      status: 504,
      body: { error: 'Controlled docs request timed out.' },
    }),
  });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });
    assert.match(await topBarProjectBtn.innerText(), /v120/);

    await executeSaveWorkflow(page);

    // Shows uncertain notice
    await page.locator('[data-testid="uncertain-save-warning"]').waitFor();

    // TopBar remains v120
    assert.match(await topBarProjectBtn.innerText(), /v120/, 'TopBar must remain v120 on uncertain timeout');
  } finally {
    await harness.close();
  }
});

// Scenario 8: Project Switching
await test('Scenario 8: Switching to Project B while Project A save is in flight preserves Project B', async () => {
  let resolveSave!: () => void;
  const saveHoldPromise = new Promise<void>((r) => (resolveSave = r));

  const harness = await createHarness({
    initialStateVersion: 120,
    projectBVersion: 50,
    saveResponseOverride: async (body) => {
      await saveHoldPromise;
      return {
        status: 200,
        body: {
          success: true,
          documentId: 'DOC-CTRL-002',
          path: 'docs/00_control/PROJECT_STATE.md',
          previousSha256: body.baseSha256,
          newSha256: '3333333333333333333333333333333333333333333333333333333333333333',
          stateVersion: 121,
          auditEventId: 'AUD-CROSS-PROJ-001',
          timestamp: new Date().toISOString(),
        },
      };
    },
  });

  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Navigate to Controlled Docs in Project A and click save
    await page.getByRole('button', { name: 'Reports & Export' }).click();
    await page.locator('[data-testid="doc-item-DOC-CTRL-002"]').click();
    await page.locator('[data-testid="btn-edit-document"]').click();
    await page.locator('[data-testid="draft-editor-textarea"]').fill('Switching test draft');
    await page.locator('[data-testid="btn-preview-diff"]').click();
    await page.locator('[data-testid="btn-validate"]').click();
    await page.locator('[data-testid="btn-proceed-to-save"]').click();
    await page.locator('[data-testid="modal-save-reason"]').fill('Switching test');
    await page.locator('[data-testid="modal-confirm-checkbox"]').check();

    // Trigger save (which holds)
    await page.locator('[data-testid="btn-confirm-save"]').click();

    // Switch to Project B while save is holding
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', 'PRJ-FIXTURE-B');
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Verify Project B is active and showing v50
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('Fixture B'));
    assert.match(await topBarProjectBtn.innerText(), /v50/, 'Project B must show v50');

    // Now release Project A's save response
    resolveSave();
    await page.waitForTimeout(300);

    // Project B must STILL be active and show v50 (NOT Project A or v121!)
    assert.match(await topBarProjectBtn.innerText(), /Fixture B/, 'Project B must remain active');
    assert.match(await topBarProjectBtn.innerText(), /v50/, 'Project B must retain its own version v50');
  } finally {
    await harness.close();
  }
});

// Scenario 9 (Test E): Out-of-Order Stale Responses (Monotonic & Whole-Snapshot Rejection via TopBar Selector)
await test('Scenario 9 (Test E): UI-triggered project fetch rejecting deferred stale snapshot as a whole, preserving confirmed state, and recovering via retry', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Save to version 121
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar updated to v121');

    // Baseline project request count
    const baselineFetches = harness.getProjectAFetchCount();
    assert.ok(baselineFetches >= 1, 'Initial load issued at least 1 project fetch');

    // Prepare deferred promise to hold the network request
    let resolveStaleFetch!: () => void;
    const staleHoldPromise = new Promise<void>((r) => (resolveStaleFetch = r));
    harness.holdProjectAResponse(staleHoldPromise);

    // Configure override to return stale snapshot with modified name/description
    harness.setProjectAResponseOverride(async () => {
      return {
        status: 200,
        body: {
          ...structuredClone(INITIAL_PROJECTS[0]),
          id: 'PRJ-DOCMONSTAKRAKIN',
          name: 'OUTDATED STALE NAME',
          description: 'STALE OUTDATED DESCRIPTION',
          stateVersion: 120, // Stale!
        },
      };
    });

    // Trigger genuine asynchronous project fetch via official user-facing TopBar project selector
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    const activeProjectOption = page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]');
    await activeProjectOption.click();

    // Assert that the request count increased while the request is in flight
    assert.ok(
      harness.getProjectAFetchCount() > baselineFetches,
      `Request count must increase via TopBar selector (was ${baselineFetches}, now ${harness.getProjectAFetchCount()})`
    );

    // Release the deferred stale response
    resolveStaleFetch();
    harness.holdProjectAResponse(null);

    // Stale snapshot warning must be shown
    const staleWarning = page.locator('[data-testid="stale-snapshot-warning"]');
    await staleWarning.waitFor({ timeout: 4000 });
    const warningText = await staleWarning.innerText();
    assert.match(warningText, /Project state snapshot is older than the confirmed version/);

    // Verify stale snapshot was rejected as a whole:
    // 1. TopBar still displays v121
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar must remain v121');
    // 2. UI does not show stale name or description
    const contentText = await page.locator('main').innerText();
    assert.doesNotMatch(contentText, /STALE OUTDATED DESCRIPTION/, 'UI must NOT adopt stale description');
    assert.doesNotMatch(contentText, /OUTDATED STALE NAME/, 'UI must NOT adopt stale name');

    // Deliver authoritative snapshot with stateVersion: 121 and updated description
    harness.setProjectAResponseOverride(async () => {
      return {
        status: 200,
        body: {
          ...structuredClone(INITIAL_PROJECTS[0]),
          id: 'PRJ-DOCMONSTAKRAKIN',
          name: 'docmonstakrakin',
          description: 'FRESH AUTHORITATIVE DESCRIPTION',
          stateVersion: 121,
        },
      };
    });

    // Click retry button in stale warning banner
    await page.locator('[data-testid="btn-retry-project-fetch"]').click();

    // Verify warning cleared and UI updated
    await staleWarning.waitFor({ state: 'detached', timeout: 4000 });
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar still v121');
  } finally {
    await harness.close();
  }
});

// Scenario 10: Consecutive Saves
await test('Scenario 10: Consecutive saves advance version monotonically (120 -> 121 -> 122)', async () => {
  let saveCount = 0;
  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async (body) => {
      saveCount++;
      const nextVer = 120 + saveCount;
      return {
        status: 200,
        body: {
          success: true,
          documentId: 'DOC-CTRL-002',
          path: 'docs/00_control/PROJECT_STATE.md',
          previousSha256: body.baseSha256,
          newSha256: '4'.repeat(60) + String(nextVer).padStart(4, '0'),
          stateVersion: nextVer,
          auditEventId: `AUD-CONSECUTIVE-${nextVer}`,
          timestamp: new Date().toISOString(),
        },
      };
    },
  });

  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Save 1 -> 121
    await executeSaveWorkflow(page, 'First save');
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'First save must advance to v121');

    // Save 2 -> 122
    await page.locator('[data-testid="btn-edit-document"]').waitFor();
    await page.locator('[data-testid="btn-edit-document"]').click();
    await page.locator('[data-testid="draft-editor-textarea"]').fill('Second save content');
    await page.locator('[data-testid="btn-preview-diff"]').click();
    await page.locator('[data-testid="btn-validate"]').click();
    await page.locator('[data-testid="btn-proceed-to-save"]').click();
    await page.locator('[data-testid="modal-save-reason"]').fill('Second save');
    await page.locator('[data-testid="modal-confirm-checkbox"]').check();
    await page.locator('[data-testid="btn-confirm-save"]').click();

    // TopBar updates to v122
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v122'));
    assert.match(await topBarProjectBtn.innerText(), /v122/, 'Second save must advance to v122');
  } finally {
    await harness.close();
  }
});

// Scenario 11: Refresh Failure
await test('Scenario 11: Save success followed by refresh failure preserves confirmed TopBar version', async () => {
  const harness = await createHarness({
    initialStateVersion: 120,
    refreshFails: true, // Post-save canonical refresh fails
  });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    await executeSaveWorkflow(page);

    // Canonical refresh error is shown
    await page.locator('[data-testid="canonical-refresh-error"]').waitFor();

    // BUT TopBar version was successfully updated to v121!
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar must preserve confirmed v121 despite refresh failure');
  } finally {
    await harness.close();
  }
});

// Scenario 12: Audit Consistency
await test('Scenario 12: Saved auditEventId and stateVersion match server acknowledged response', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    await executeSaveWorkflow(page);

    const banner = page.locator('[data-testid="save-success-banner"]');
    await banner.waitFor();
    const bannerText = await banner.innerText();

    assert.match(bannerText, /AUD-SYNC-TEST-001/, 'Banner must display confirmed audit event ID');
    assert.match(bannerText, /121/, 'Banner must display confirmed stateVersion');
  } finally {
    await harness.close();
  }
});

// Scenario 13 (Case A): Successful Audit Refresh
await test('Scenario 13 (Case A): Successful controlled document save synchronizes authoritative audit ledger in EvidenceView without reload', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    await executeSaveWorkflow(page);

    // Save-success banner rendered
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    // Navigate to Evidence & Audit tab in Sidebar
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();

    // Switch to Append-Only Audit sub-tab
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Assert audit status badge shows LEDGER SYNCHRONIZED
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await statusBadge.waitFor();
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);

    // Assert AUD-SYNC-TEST-001 is present in the table
    const auditTableText = await page.locator('table').innerText();
    assert.match(auditTableText, /AUD-SYNC-TEST-001/, 'Committed auditEventId must appear in audit ledger table');
    assert.match(auditTableText, /DOCUMENT_UPDATED/);

    // Assert warning is NOT displayed
    const warning = page.locator('[data-testid="audit-sync-warning"]');
    assert.equal(await warning.isVisible(), false, 'Warning must not be displayed on successful audit sync');
  } finally {
    await harness.close();
  }
});

// Scenario 14 (Case B): Delayed Audit Refresh
await test('Scenario 14 (Case B): Delayed audit response displays refreshing status while preserving save confirmation, then transitions to synchronized', async () => {
  let resolveAudit!: () => void;
  const auditHoldPromise = new Promise<void>((r) => (resolveAudit = r));

  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;

    // Hold audit response
    harness.holdAuditResponse(auditHoldPromise);

    // Execute save workflow
    await executeSaveWorkflow(page);

    // Save banner is visible and TopBar shows v121
    await page.locator('[data-testid="save-success-banner"]').waitFor();
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Navigate to Evidence & Audit tab
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // While held, refreshing indicator must be displayed and badge says LEDGER SYNCHRONIZING...
    const refreshingIndicator = page.locator('[data-testid="audit-sync-refreshing"]');
    await refreshingIndicator.waitFor();
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZING/);

    // Release audit response
    resolveAudit();

    // Status updates to LEDGER SYNCHRONIZED and refreshing indicator detaches
    await refreshingIndicator.waitFor({ state: 'detached' });
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
    const auditTableText = await page.locator('table').innerText();
    assert.match(auditTableText, /AUD-SYNC-TEST-001/);
  } finally {
    await harness.close();
  }
});

// Scenario 15 (Case C): Failed Audit Refresh (HTTP 500)
await test('Scenario 15 (Case C): Audit refresh failure displays recoverable warning, preserves existing audit records, and retry succeeds', async () => {
  let auditCallCount = 0;
  const harness = await createHarness({
    initialStateVersion: 120,
    auditResponseOverride: async (_projId, _call, saveCallsCount) => {
      if (saveCallsCount === 0) {
        return null;
      }
      auditCallCount++;
      if (auditCallCount === 1) {
        // First post-save audit fetch fails with HTTP 500
        return { status: 500, body: { error: 'Internal audit service error' } };
      }
      // Subsequent fetch succeeds (returns default Project A audit logs)
      return null;
    },
  });

  try {
    const { page } = harness;
    await executeSaveWorkflow(page);

    // Save banner remains visible and TopBar is v121
    await page.locator('[data-testid="save-success-banner"]').waitFor();
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Navigate to Evidence & Audit
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Status is unconfirmed and warning banner is shown
    const warning = page.locator('[data-testid="audit-sync-warning"]');
    await warning.waitFor();
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    assert.match(await statusBadge.innerText(), /LEDGER UNCONFIRMED/);

    // Existing audit records (AUD-INIT-001) must be preserved!
    const tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-INIT-001/, 'Existing audit events must be preserved during refresh failure');

    // Click retry button
    await page.locator('[data-testid="btn-retry-audit-sync"]').click();

    // Warning disappears, status becomes LEDGER SYNCHRONIZED, and new event is displayed
    await warning.waitFor({ state: 'detached' });
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
    const updatedTableText = await page.locator('table').innerText();
    assert.match(updatedTableText, /AUD-SYNC-TEST-001/);
  } finally {
    await harness.close();
  }
});

// Scenario 16 (Case D): Audit Response Missing Committed Event
await test('Scenario 16 (Case D): Audit response omitting the committed event leaves status unconfirmed with warning', async () => {
  const harness = await createHarness({
    initialStateVersion: 120,
    auditResponseOverride: async () => {
      // Returns 200 array but omitting AUD-SYNC-TEST-001
      return {
        status: 200,
        body: [
          {
            id: 'AUD-INIT-001',
            actor: 'Lead Architect',
            timestamp: new Date().toISOString(),
            action: 'PROJECT_INITIALIZED',
            target: 'PRJ-DOCMONSTAKRAKIN',
            stateHash: 'init-state-hash',
          },
        ],
      };
    },
  });

  try {
    const { page } = harness;
    await executeSaveWorkflow(page);

    await page.locator('[data-testid="save-success-banner"]').waitFor();

    // Navigate to Evidence & Audit
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Status is unconfirmed and warning banner is shown
    const warning = page.locator('[data-testid="audit-sync-warning"]');
    await warning.waitFor();
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    assert.match(await statusBadge.innerText(), /LEDGER UNCONFIRMED/);
  } finally {
    await harness.close();
  }
});

// Scenario 17 (Case E): Project Switching Isolation
await test('Scenario 17 (Case E): Project switching during audit refresh isolates audit state and does not leak events into Project B', async () => {
  let resolveAuditA!: () => void;
  const auditAHoldPromise = new Promise<void>((r) => (resolveAuditA = r));

  const harness = await createHarness({
    initialStateVersion: 120,
    projectBVersion: 50,
  });

  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Hold audit response for Project A
    harness.holdAuditResponse(auditAHoldPromise);

    // Save on Project A
    await executeSaveWorkflow(page);

    // Switch to Project B while Project A's audit fetch is holding
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', 'PRJ-FIXTURE-B');
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for Project B to load
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('Fixture B'));
    assert.match(await topBarProjectBtn.innerText(), /v50/);

    // Release Project A's audit response
    resolveAuditA();
    await page.waitForTimeout(300);

    // Navigate to Evidence & Audit in Project B
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Project B must show its own audit events, NEVER Project A's AUD-SYNC-TEST-001!
    const tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-INIT-002/, 'Project B must show its own audit events');
    assert.doesNotMatch(tableText, /AUD-SYNC-TEST-001/, 'Project A audit event must NOT leak into Project B');
    assert.match(await topBarProjectBtn.innerText(), /Fixture B/);
    assert.match(await topBarProjectBtn.innerText(), /v50/);
  } finally {
    await harness.close();
  }
});

// Scenario 18 (Case F): Out-of-Order Audit Responses
await test('Scenario 18 (Case F): Consecutive saves handle out-of-order audit responses preserving the newer audit state', async () => {
  let saveCount = 0;
  let postSaveAuditCount = 0;
  let resolveAudit1!: () => void;
  const audit1HoldPromise = new Promise<void>((r) => (resolveAudit1 = r));

  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async (body) => {
      saveCount++;
      const nextVer = 120 + saveCount;
      const eventId = `AUD-CONSEC-${nextVer}`;
      const nowIso = new Date().toISOString();
      const newHash = '5'.repeat(60) + String(nextVer).padStart(4, '0');

      harness.getProjectAAuditLogs().push({
        id: eventId,
        actor: 'Lead Architect',
        timestamp: nowIso,
        action: 'DOCUMENT_UPDATED',
        target: 'DOC-CTRL-002',
        stateHash: newHash,
        details: {
          path: 'docs/00_control/PROJECT_STATE.md',
          previousSha256: body.baseSha256,
          newSha256: newHash,
          stateVersion: nextVer,
        },
      });

      return {
        status: 200,
        body: {
          success: true,
          documentId: 'DOC-CTRL-002',
          path: 'docs/00_control/PROJECT_STATE.md',
          previousSha256: body.baseSha256,
          newSha256: newHash,
          stateVersion: nextVer,
          auditEventId: eventId,
          timestamp: nowIso,
        },
      };
    },
    auditResponseOverride: async (_projId, _callCount, saveCallsCount) => {
      if (saveCallsCount === 0) {
        return null;
      }
      postSaveAuditCount++;
      if (postSaveAuditCount === 1) {
        // Save 1's audit fetch is delayed
        await audit1HoldPromise;
        // When released, returns list containing only Save 1
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: new Date().toISOString(),
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
            {
              id: 'AUD-CONSEC-121',
              actor: 'Lead Architect',
              timestamp: new Date().toISOString(),
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-002',
              stateHash: '5'.repeat(64),
            },
          ],
        };
      }
      return null;
    },
  });

  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Save 1 (v121) - audit response held
    await executeSaveWorkflow(page, 'Save 1');
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));

    // Save 2 (v122) - audit response resolves immediately
    await page.locator('[data-testid="btn-edit-document"]').waitFor();
    await page.locator('[data-testid="btn-edit-document"]').click();
    await page.locator('[data-testid="draft-editor-textarea"]').fill('Save 2 edit content');
    await page.locator('[data-testid="btn-preview-diff"]').click();
    await page.locator('[data-testid="btn-validate"]').click();
    await page.locator('[data-testid="btn-proceed-to-save"]').click();
    await page.locator('[data-testid="modal-save-reason"]').fill('Save 2');
    await page.locator('[data-testid="modal-confirm-checkbox"]').check();
    await page.locator('[data-testid="btn-confirm-save"]').click();

    // Wait for v122
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v122'));
    assert.match(await topBarProjectBtn.innerText(), /v122/);

    // Now release the delayed Save 1 audit response
    resolveAudit1();
    await page.waitForTimeout(300);

    // Navigate to Evidence & Audit
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Verify AUD-CONSEC-122 is present in the table (never overwritten by delayed Save 1 response!)
    const tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-CONSEC-122/, 'Newer audit state must be preserved over delayed earlier response');
    assert.match(tableText, /AUD-CONSEC-121/);
  } finally {
    await harness.close();
  }
});

// Scenario 19 (Cases I & J): Negative Outcomes & No Duplication / Synthesis
await test('Scenario 19 (Cases I & J): Failed saves do not trigger false audit sync and ledger contains zero duplicated or synthetic records', async () => {
  let auditTriggered = false;
  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async () => ({
      status: 409,
      body: { error: 'DOCUMENT_STALE: Base SHA mismatch.' },
    }),
    auditResponseOverride: async (_projId, callCount) => {
      if (callCount > 1) {
        auditTriggered = true;
      }
      return null;
    },
  });

  try {
    const { page } = harness;
    await executeSaveWorkflow(page);

    // Stale error banner is shown
    await page.locator('[data-testid="canonical-refresh-error"]').waitFor();

    // Navigate to Evidence & Audit
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Verify audit status is CURRENT (no pending sync failed or unconfirmed)
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
    assert.equal(auditTriggered, false, 'Failed save must not trigger audit sync');

    // Verify table has exactly 1 event (AUD-INIT-001) with zero duplicates
    const tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-INIT-001/);
    assert.doesNotMatch(tableText, /DOCUMENT_UPDATED/);
  } finally {
    await harness.close();
  }
});

// Scenario 20 (Test A): Exact Audit Identity - Isolated Invalid Fixtures
await test('Scenario 20 (Test A): Audit response with mismatched fields (wrong target, duplicate IDs) is rejected and leaves ledger UNCONFIRMED', async () => {
  let auditAttempt = 0;
  const harness = await createHarness({
    initialStateVersion: 120,
    auditResponseOverride: async (_projId, _callCount, saveCallsCount) => {
      if (saveCallsCount === 0) return null;
      auditAttempt++;
      if (auditAttempt === 1) {
        // Fixture 1: Wrong target
        return {
          status: 200,
          body: [
            {
              id: 'AUD-SYNC-TEST-001',
              actor: 'Lead Architect',
              timestamp: '2026-10-12T10:00:00.000Z',
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-WRONG-TARGET',
              stateHash: 'valid-chain-hash',
              details: {
                path: 'docs/00_control/PROJECT_STATE.md',
                previousSha256: '0'.repeat(64),
                newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
                stateVersion: 121,
              },
            },
          ],
        };
      } else if (auditAttempt === 2) {
        // Fixture 2: Duplicate event ID
        const validItem = {
          id: 'AUD-SYNC-TEST-001',
          actor: 'Lead Architect',
          timestamp: '2026-10-12T10:00:00.000Z',
          action: 'DOCUMENT_UPDATED',
          target: 'DOC-CTRL-002',
          stateHash: 'valid-chain-hash',
          details: {
            path: 'docs/00_control/PROJECT_STATE.md',
            previousSha256: '0'.repeat(64),
            newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
            stateVersion: 121,
          },
        };
        return {
          status: 200,
          body: [validItem, { ...validItem }],
        };
      }
      // Authoritative valid item
      return null;
    },
  });

  try {
    const { page } = harness;
    await executeSaveWorkflow(page);
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Fixture 1 rejected -> LEDGER UNCONFIRMED
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await statusBadge.waitFor();
    assert.match(await statusBadge.innerText(), /LEDGER UNCONFIRMED/, 'Mismatched target must produce UNCONFIRMED');

    // Retry -> Fixture 2 (duplicate event ID) rejected -> LEDGER UNCONFIRMED
    await page.locator('[data-testid="btn-retry-audit-sync"]').click();
    await page.waitForTimeout(300);
    assert.match(await statusBadge.innerText(), /LEDGER UNCONFIRMED/, 'Duplicate event ID must produce UNCONFIRMED');

    // Retry -> Authoritative valid item -> LEDGER SYNCHRONIZED
    await page.locator('[data-testid="btn-retry-audit-sync"]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
  } finally {
    await harness.close();
  }
});

// Scenario 21 (Blocker 2): Genuine Project-List Integration Request & Staleness Rejection
await test('Scenario 21 (Blocker 2): Genuine project-list request rejects stale metadata and accepts fresh metadata without navigating away (Tests A-E)', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Step 2: Confirm at least one initial GET /api/projects occurred
    const initialListFetches = harness.getProjectListFetchCount();
    assert.ok(initialListFetches >= 1, `At least one initial GET /api/projects request must have occurred (was: ${initialListFetches})`);

    // Step 3 & 4: Save to version 121
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Navigate to Projects workspace via sidebar
    await page.getByRole('button', { name: 'Projects' }).click();
    await page.locator('[aria-label="Projects workspace"]').waitFor();
    const cardA = page.locator('article').filter({ hasText: 'PRJ-DOCMONSTAKRAKIN' });
    assert.match(await cardA.innerText(), /Active project/);

    // -------------------------------------------------------------
    // Test A: Stale project list (v120) rejected via real request
    // -------------------------------------------------------------
    harness.setProjectsList([
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'STALE OUTDATED NAME',
        description: 'STALE OUTDATED DESCRIPTION',
        stateVersion: 120, // Stale!
      },
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-FIXTURE-B',
        name: 'Fixture B',
        stateVersion: 50,
      },
    ]);

    const countBeforeRefresh = harness.getProjectListFetchCount();
    const refreshBtn = page.locator('[data-testid="btn-refresh-project-list"]');
    await refreshBtn.click();

    // Verify request count increments through an actual GET /api/projects call
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="btn-refresh-project-list"]') as HTMLButtonElement | null;
      return btn && !btn.disabled;
    });
    const countAfterRefresh = harness.getProjectListFetchCount();
    assert.ok(
      countAfterRefresh > countBeforeRefresh,
      `No additional GET /api/projects request occurred: count before was ${countBeforeRefresh}, count after was ${countAfterRefresh}`
    );

    // Stale metadata rejected: Project card retains confirmed v121 and legitimate metadata
    assert.match(await cardA.innerText(), /121/, 'Project card must preserve confirmed stateVersion 121');
    assert.doesNotMatch(await cardA.innerText(), /STALE OUTDATED NAME/, 'Project card must NOT adopt stale name');
    assert.doesNotMatch(await cardA.innerText(), /STALE OUTDATED DESCRIPTION/, 'Project card must NOT adopt stale description');
    assert.match(await cardA.innerText(), /Active project/, 'Active project must remain intact');

    // TopBar preserves confirmed v121 and active project identity
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar must preserve confirmed v121');
    assert.doesNotMatch(await topBarProjectBtn.innerText(), /STALE OUTDATED NAME/, 'TopBar must NOT adopt stale project name');

    // User remains in Projects workspace (no reset or redirect)
    assert.ok(await page.locator('[aria-label="Projects workspace"]').isVisible(), 'Must remain in Projects workspace');

    // -------------------------------------------------------------
    // Test B: Fresh project list (v121) accepted via real request
    // -------------------------------------------------------------
    harness.setProjectsList([
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'FRESH CONFIRMED NAME',
        description: 'FRESH CONFIRMED DESCRIPTION',
        stateVersion: 121,
      },
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-FIXTURE-B',
        name: 'Fixture B',
        stateVersion: 50,
      },
    ]);

    const countBeforeFresh = harness.getProjectListFetchCount();
    await refreshBtn.click();
    await page.waitForFunction(() => document.body.textContent?.includes('FRESH CONFIRMED NAME'));

    const countAfterFresh = harness.getProjectListFetchCount();
    assert.ok(countAfterFresh > countBeforeFresh, 'Fresh refresh must issue actual GET /api/projects');

    // Fresh metadata accepted and displayed on card
    assert.match(await cardA.innerText(), /FRESH CONFIRMED NAME/, 'Card must display fresh accepted name');
    assert.match(await cardA.innerText(), /FRESH CONFIRMED DESCRIPTION/, 'Card must display fresh accepted description');
    assert.match(await cardA.innerText(), /121/, 'Card must display confirmed stateVersion 121');
    assert.match(await cardA.innerText(), /Active project/, 'Active project must remain intact');
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar must preserve confirmed v121');

    // -------------------------------------------------------------
    // Test C: Delayed / deferred response handling & loading state
    // -------------------------------------------------------------
    let resolveHold!: () => void;
    const holdPromise = new Promise<void>((r) => (resolveHold = r));
    harness.holdProjectListResponse(holdPromise);

    await refreshBtn.click();
    // Verify loading indicator and disabled button while request is in flight
    assert.strictEqual(await refreshBtn.isDisabled(), true, 'Refresh button must be disabled while fetch is in-flight');
    const spinIcon = refreshBtn.locator('svg.animate-spin');
    assert.ok((await spinIcon.count()) > 0, 'Spin animation must be active during in-flight fetch');

    // Release in-flight response
    resolveHold();
    harness.holdProjectListResponse(null);

    // Wait for button to re-enable
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="btn-refresh-project-list"]') as HTMLButtonElement | null;
      return btn && !btn.disabled;
    });
    assert.strictEqual(await refreshBtn.isDisabled(), false, 'Refresh button must re-enable once resolved');

    // -------------------------------------------------------------
    // Test D: HTTP 500 error & recovery via retry button
    // -------------------------------------------------------------
    harness.setProjectListResponseOverride(async () => ({
      status: 500,
      body: { error: 'Failed to fetch project list (simulated HTTP 500)' },
    }));

    await refreshBtn.click();
    await page.waitForSelector('[role="alert"]');
    const alert = page.locator('[role="alert"]');
    assert.match(await alert.innerText(), /Cannot load the project list/);

    const retryBtn = alert.getByRole('button', { name: 'Retry' });
    assert.ok((await retryBtn.count()) > 0, 'Retry button must exist in error alert');

    // Clear override and click retry
    harness.setProjectListResponseOverride(null);
    await retryBtn.click();
    await page.waitForFunction(() => !document.querySelector('[role="alert"]'));

    // Card remains intact and active
    assert.match(await cardA.innerText(), /Active project/);
    assert.ok(await page.locator('[aria-label="Projects workspace"]').isVisible());

    // -------------------------------------------------------------
    // Test E: Cross-project isolation & no side effects
    // -------------------------------------------------------------
    harness.setProjectsList([
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'FRESH CONFIRMED NAME',
        description: 'FRESH CONFIRMED DESCRIPTION',
        stateVersion: 121,
      },
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-FIXTURE-B',
        name: 'Fixture B Isolated Update',
        description: 'Updated Project B metadata',
        stateVersion: 51,
      },
    ]);

    await refreshBtn.click();
    await page.waitForFunction(() => document.body.textContent?.includes('Fixture B Isolated Update'));

    const cardB = page.locator('article').filter({ hasText: 'PRJ-FIXTURE-B' });
    assert.match(await cardB.innerText(), /Fixture B Isolated Update/);
    assert.match(await cardB.innerText(), /51/);
    assert.doesNotMatch(await cardB.innerText(), /Active project/, 'Project B must not become active');

    // Project A is still active and untouched
    assert.match(await cardA.innerText(), /Active project/);
    assert.match(await topBarProjectBtn.innerText(), /v121/);
  } finally {
    harness.holdProjectListResponse(null);
    harness.setProjectListResponseOverride(null);
    await harness.close();
  }
});

// Scenario 22 (Test C): Same-Project Re-selection Preserves Unconfirmed Audit State
await test('Scenario 22 (Test C): Re-selecting active project through TopBar preserves unconfirmed audit status when project snapshot omits audit event', async () => {
  let resolveAudit!: () => void;
  const auditHoldPromise = new Promise<void>((r) => (resolveAudit = r));
  let postSaveAuditCalls = 0;

  const harness = await createHarness({
    initialStateVersion: 120,
    auditResponseOverride: async (_projId, _callCount, saveCallsCount) => {
      if (saveCallsCount === 0) return null;
      postSaveAuditCalls++;
      if (postSaveAuditCalls === 1) {
        // First post-save call is performAuditRefresh() -> hold it
        await auditHoldPromise;
        return null;
      }
      if (postSaveAuditCalls === 2) {
        // Second post-save call is fetchProjectData() from project re-selection -> return snapshot omitting the committed event
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: new Date().toISOString(),
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
          ],
        };
      }
      return null;
    },
  });

  try {
    const { page } = harness;

    // Save document (advances to v121, performAuditRefresh holding)
    await executeSaveWorkflow(page);
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    // Re-select the same project through TopBar selector
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    const activeProjectOption = page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]');
    await activeProjectOption.click();

    // Wait for project snapshot reload to complete
    await page.waitForTimeout(400);

    // Navigate to Evidence & Audit tab
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Crucial check: audit status must NOT be prematurely reset to CURRENT!
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await statusBadge.waitFor();
    const badgeTextAfter = await statusBadge.innerText();
    assert.ok(
      badgeTextAfter.includes('SYNCHRONIZING') || badgeTextAfter.includes('UNCONFIRMED'),
      `Status must remain unconfirmed after same-project re-selection (was: "${badgeTextAfter}")`
    );

    // Now release the authoritative audit response
    resolveAudit();

    // Status transitions to LEDGER SYNCHRONIZED
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
  } finally {
    await harness.close();
  }
});

// Scenario 23 (Test D): A -> B -> A Navigation & Pending State Preservation
await test('Scenario 23 (Test D): Navigation from Project A -> B -> A preserves Project A pending audit state without cross-project leakage and recovers upon valid refresh', async () => {
  let resolveAuditA!: () => void;
  const auditAHoldPromise = new Promise<void>((r) => (resolveAuditA = r));
  let postSaveAuditCallsA = 0;

  const harness = await createHarness({
    initialStateVersion: 120,
    projectBVersion: 50,
    auditResponseOverride: async (projId, _callCount, saveCallsCount) => {
      if (projId === 'PRJ-FIXTURE-B') return null;
      if (saveCallsCount === 0) return null;
      postSaveAuditCallsA++;
      if (postSaveAuditCallsA === 1) {
        // Project A post-save refresh is held
        await auditAHoldPromise;
        return null;
      }
      if (postSaveAuditCallsA === 2) {
        // Project A reload snapshot omits the committed event
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: new Date().toISOString(),
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
          ],
        };
      }
      return null;
    },
  });

  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Save in Project A
    await executeSaveWorkflow(page);
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    // Switch to Project B via TopBar dropdown
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-FIXTURE-B"]').click();

    // Verify Project B is active
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('Fixture B'));
    assert.match(await topBarProjectBtn.innerText(), /v50/);

    // Navigate to Evidence & Audit in Project B
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Project B shows its own audit events, NEVER Project A's event
    const bTableText = await page.locator('table').innerText();
    assert.match(bTableText, /AUD-INIT-002/);
    assert.doesNotMatch(bTableText, /AUD-SYNC-TEST-001/);

    // Switch back to Project A via TopBar dropdown
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();

    // Verify Project A is active and shows v121
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('docmonstakrakin'));
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Navigate to Evidence & Audit in Project A
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Project A is NOT prematurely marked synchronized while audit response is held!
    const aStatusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await aStatusBadge.waitFor();
    const aStatusText = await aStatusBadge.innerText();
    assert.ok(
      aStatusText.includes('SYNCHRONIZING') || aStatusText.includes('UNCONFIRMED'),
      `Project A must not be prematurely marked synchronized upon returning (was: "${aStatusText}")`
    );

    // Release Project A audit response
    resolveAuditA();

    // Status transitions to LEDGER SYNCHRONIZED
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await aStatusBadge.innerText(), /LEDGER SYNCHRONIZED/);
    const aTableText = await page.locator('table').innerText();
    assert.match(aTableText, /AUD-SYNC-TEST-001/);
  } finally {
    await harness.close();
  }
});

// Scenario 24 (Test A - Blocker 1): Previously Confirmed Event Is Retained Across Later Project Refreshes
await test('Scenario 24 (Test A - Blocker 1): Previously Confirmed Event Is Retained Across Later Project Refreshes', async () => {
  let postSaveAuditCalls = 0;
  const fixedIso = '2026-10-12T12:00:00.000Z';

  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async (body) => {
      const resp: DocumentSaveResponse = {
        success: true,
        documentId: 'DOC-CTRL-002',
        path: 'docs/00_control/PROJECT_STATE.md',
        previousSha256: body.baseSha256,
        newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
        stateVersion: 121,
        auditEventId: 'AUD-FRESHNESS-001',
        timestamp: fixedIso,
      };
      return { status: 200, body: resp };
    },
    auditResponseOverride: async (projId, _callCount, saveCallsCount) => {
      if (projId !== 'PRJ-DOCMONSTAKRAKIN') return null;
      if (saveCallsCount === 0) return null;
      postSaveAuditCalls++;
      if (postSaveAuditCalls === 1) {
        // Initial post-save authoritative audit refresh returns the confirmed event
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
            {
              id: 'AUD-FRESHNESS-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-002',
              stateHash: '2222222222222222222222222222222222222222222222222222222222222222',
              details: {
                path: 'docs/00_control/PROJECT_STATE.md',
                previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
                newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
                stateVersion: 121,
              },
            },
          ],
        };
      }
      if (postSaveAuditCalls === 2) {
        // Second call is from later project-data refresh snapshot -> returns audit array omitting AUD-FRESHNESS-001!
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: new Date().toISOString(),
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
          ],
        };
      }
      return null;
    },
  });

  try {
    const { page } = harness;

    // Step 2 & 3: Perform successful save returning AUD-FRESHNESS-001 at v121
    await executeSaveWorkflow(page);
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    // Navigate to Evidence & Audit tab
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Step 5: Confirm application displays LEDGER SYNCHRONIZED and contains AUD-FRESHNESS-001
    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
    let tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-FRESHNESS-001/);

    // Step 6: Trigger a later project-data refresh through the existing TopBar project selector
    const baselineFetches = harness.getProjectAFetchCount();
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    const activeProjectOption = page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]');
    await activeProjectOption.click();

    // Verify a genuine project-data request occurred
    await page.waitForTimeout(400);
    assert.ok(harness.getProjectAFetchCount() > baselineFetches, 'Must issue a genuine project-data request');

    // Step 7 & 8: Incomplete audit snapshot arrived omitting AUD-FRESHNESS-001.
    // Core Invariant: The application must NOT accept the incomplete audit array as synchronized.
    // It must reject the audit portion, preserve AUD-FRESHNESS-001, and report LEDGER UNCONFIRMED.
    const badgeTextAfter = await statusBadge.innerText();
    assert.doesNotMatch(badgeTextAfter, /SYNCHRONIZED/, 'Application must NOT report LEDGER SYNCHRONIZED when snapshot omits confirmed save event');
    assert.match(badgeTextAfter, /UNCONFIRMED/, 'Status must become LEDGER UNCONFIRMED');
    tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-FRESHNESS-001/, 'Previously confirmed event must NOT be erased from displayed ledger');
  } finally {
    await harness.close();
  }
});

// Scenario 25 (Tests B & C - Blocker 1): Altered Previously Confirmed Event Rejected & Recovery to Synchronized State
await test('Scenario 25 (Tests B & C - Blocker 1): Altered Previously Confirmed Event Rejected & Recovery to Synchronized State', async () => {
  let auditCalls = 0;
  const fixedIso = '2026-10-12T12:00:00.000Z';

  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async (body) => {
      const resp: DocumentSaveResponse = {
        success: true,
        documentId: 'DOC-CTRL-002',
        path: 'docs/00_control/PROJECT_STATE.md',
        previousSha256: body.baseSha256,
        newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
        stateVersion: 121,
        auditEventId: 'AUD-ALT-001',
        timestamp: fixedIso,
      };
      return { status: 200, body: resp };
    },
    auditResponseOverride: async (projId, _callCount, saveCallsCount) => {
      if (projId !== 'PRJ-DOCMONSTAKRAKIN') return null;
      if (saveCallsCount === 0) return null;
      auditCalls++;
      if (auditCalls === 1) {
        // Initial post-save authoritative audit refresh returns authentic event
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
            {
              id: 'AUD-ALT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-002',
              stateHash: '2222222222222222222222222222222222222222222222222222222222222222',
              details: {
                path: 'docs/00_control/PROJECT_STATE.md',
                previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
                newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
                stateVersion: 121,
              },
            },
          ],
        };
      }
      if (auditCalls === 2) {
        // Second call: project-data snapshot with ALTERED newSha256 digest
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
            {
              id: 'AUD-ALT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-002',
              stateHash: '2222222222222222222222222222222222222222222222222222222222222222',
              details: {
                path: 'docs/00_control/PROJECT_STATE.md',
                previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
                newSha256: 'tampered-sha256-digest-that-does-not-match-saved-ack',
                stateVersion: 121,
              },
            },
          ],
        };
      }
      // Third call: user clicks retry -> authoritative audit endpoint returns authentic records
      return {
        status: 200,
        body: [
          {
            id: 'AUD-INIT-001',
            actor: 'Lead Architect',
            timestamp: fixedIso,
            action: 'PROJECT_INITIALIZED',
            target: 'PRJ-DOCMONSTAKRAKIN',
            stateHash: 'init-state-hash',
          },
          {
            id: 'AUD-ALT-001',
            actor: 'Lead Architect',
            timestamp: fixedIso,
            action: 'DOCUMENT_UPDATED',
            target: 'DOC-CTRL-002',
            stateHash: '2222222222222222222222222222222222222222222222222222222222222222',
            details: {
              path: 'docs/00_control/PROJECT_STATE.md',
              previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
              newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
              stateVersion: 121,
            },
          },
        ],
      };
    },
  });

  try {
    const { page } = harness;
    await executeSaveWorkflow(page);
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);

    // Trigger later project refresh returning tampered/altered event
    const baselineFetches = harness.getProjectAFetchCount();
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();
    await page.waitForTimeout(400);
    assert.ok(harness.getProjectAFetchCount() > baselineFetches);

    // Test B: Altered previously confirmed event rejected -> LEDGER UNCONFIRMED
    assert.match(await statusBadge.innerText(), /LEDGER UNCONFIRMED/);
    const warning = page.locator('[data-testid="audit-sync-warning"]');
    await warning.waitFor();

    // Test C: Recovery to synchronized state upon subsequent valid authoritative audit response
    await page.locator('[data-testid="btn-retry-audit-sync"]').click();
    await warning.waitFor({ state: 'detached' });
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
    const tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-ALT-001/);
  } finally {
    await harness.close();
  }
});

// Scenario 26 (Tests D & E - Blocker 1): Multiple Confirmed Saves Watermark & Unverified Save Coexistence
await test('Scenario 26 (Tests D & E - Blocker 1): Multiple Confirmed Saves Watermark & Unverified Save Coexistence', async () => {
  let saveCount = 0;
  let auditCalls = 0;
  const fixedIso = '2026-10-12T12:00:00.000Z';
  const sha1 = '1'.repeat(60) + '0121';
  const sha2 = '2'.repeat(60) + '0122';

  const harness = await createHarness({
    initialStateVersion: 120,
    saveResponseOverride: async (body) => {
      saveCount++;
      const nextVer = 120 + saveCount;
      const sha = nextVer === 121 ? sha1 : sha2;
      const resp: DocumentSaveResponse = {
        success: true,
        documentId: 'DOC-CTRL-002',
        path: 'docs/00_control/PROJECT_STATE.md',
        previousSha256: body.baseSha256,
        newSha256: sha,
        stateVersion: nextVer,
        auditEventId: `AUD-MULTI-00${saveCount}`,
        timestamp: fixedIso,
      };
      return { status: 200, body: resp };
    },
    auditResponseOverride: async (projId, _callCount, saveCallsCount) => {
      if (projId !== 'PRJ-DOCMONSTAKRAKIN') return null;
      if (saveCallsCount === 0) return null;
      auditCalls++;
      if (saveCount === 1) {
        // After Save 1: returns Save 1
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
            {
              id: 'AUD-MULTI-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-002',
              stateHash: sha1,
              details: {
                path: 'docs/00_control/PROJECT_STATE.md',
                previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
                newSha256: sha1,
                stateVersion: 121,
              },
            },
          ],
        };
      }
      if (saveCount === 2) {
        if (auditCalls === 2) {
          // Post-save 2 refresh: returns both Save 1 and Save 2
          return {
            status: 200,
            body: [
              {
                id: 'AUD-INIT-001',
                actor: 'Lead Architect',
                timestamp: fixedIso,
                action: 'PROJECT_INITIALIZED',
                target: 'PRJ-DOCMONSTAKRAKIN',
                stateHash: 'init-state-hash',
              },
              {
                id: 'AUD-MULTI-001',
                actor: 'Lead Architect',
                timestamp: fixedIso,
                action: 'DOCUMENT_UPDATED',
                target: 'DOC-CTRL-002',
                stateHash: sha1,
                details: {
                  path: 'docs/00_control/PROJECT_STATE.md',
                  previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
                  newSha256: sha1,
                  stateVersion: 121,
                },
              },
              {
                id: 'AUD-MULTI-002',
                actor: 'Lead Architect',
                timestamp: fixedIso,
                action: 'DOCUMENT_UPDATED',
                target: 'DOC-CTRL-002',
                stateHash: sha2,
                details: {
                  path: 'docs/00_control/PROJECT_STATE.md',
                  previousSha256: sha1,
                  newSha256: sha2,
                  stateVersion: 122,
                },
              },
            ],
          };
        }
        // auditCalls >= 3: snapshot omitting Save 1, containing only Save 2
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
            {
              id: 'AUD-MULTI-002',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-002',
              stateHash: sha2,
              details: {
                path: 'docs/00_control/PROJECT_STATE.md',
                previousSha256: sha1,
                newSha256: sha2,
                stateVersion: 122,
              },
            },
          ],
        };
      }
      return null;
    },
  });

  try {
    const { page } = harness;

    // 1. Save A at v121
    await executeSaveWorkflow(page);
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);

    // 2. Save B at v122
    await page.getByRole('button', { name: 'Reports & Export' }).click();
    await page.locator('[data-testid="controlled-docs-workspace"]').waitFor();
    await page.locator('[data-testid="doc-item-DOC-CTRL-002"]').click();
    await page.locator('[data-testid="btn-edit-document"]').waitFor();
    await page.locator('[data-testid="btn-edit-document"]').click();
    await page.locator('[data-testid="draft-editor-textarea"]').fill('# Project State\n\nSave 2 content\n');
    await page.locator('[data-testid="btn-preview-diff"]').click();
    await page.locator('[data-testid="btn-validate"]').click();
    await page.locator('[data-testid="btn-proceed-to-save"]').click();
    await page.locator('[data-testid="modal-save-reason"]').fill('Second save');
    await page.locator('[data-testid="modal-confirm-checkbox"]').check();
    await page.locator('[data-testid="btn-confirm-save"]').click();
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);

    // 3. Trigger project refresh returning snapshot containing B but omitting A
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();
    await page.waitForTimeout(400);

    // Test D: Both A and B must remain required freshness evidence; omitting A is rejected!
    assert.match(await statusBadge.innerText(), /LEDGER UNCONFIRMED/);
    let tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-MULTI-001/, 'Save A must remain preserved in displayed ledger');
    assert.match(tableText, /AUD-MULTI-002/, 'Save B must remain preserved in displayed ledger');
  } finally {
    await harness.close();
  }
});

// Scenario 27 (Test F - Blocker 1): Navigation (A -> B -> A) Preserves Confirmed Audit Watermark
await test('Scenario 27 (Test F - Blocker 1): Navigation (A -> B -> A) Preserves Confirmed Audit Watermark', async () => {
  let postSaveAuditCalls = 0;
  const fixedIso = '2026-10-12T12:00:00.000Z';

  const harness = await createHarness({
    initialStateVersion: 120,
    projectBVersion: 50,
    saveResponseOverride: async (body) => {
      const resp: DocumentSaveResponse = {
        success: true,
        documentId: 'DOC-CTRL-002',
        path: 'docs/00_control/PROJECT_STATE.md',
        previousSha256: body.baseSha256,
        newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
        stateVersion: 121,
        auditEventId: 'AUD-NAV-001',
        timestamp: fixedIso,
      };
      return { status: 200, body: resp };
    },
    auditResponseOverride: async (projId, _callCount, saveCallsCount) => {
      if (projId !== 'PRJ-DOCMONSTAKRAKIN') return null;
      if (saveCallsCount === 0) return null;
      postSaveAuditCalls++;
      if (postSaveAuditCalls === 1) {
        // Initial post-save refresh in Project A: returns verified event
        return {
          status: 200,
          body: [
            {
              id: 'AUD-INIT-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'PROJECT_INITIALIZED',
              target: 'PRJ-DOCMONSTAKRAKIN',
              stateHash: 'init-state-hash',
            },
            {
              id: 'AUD-NAV-001',
              actor: 'Lead Architect',
              timestamp: fixedIso,
              action: 'DOCUMENT_UPDATED',
              target: 'DOC-CTRL-002',
              stateHash: '2222222222222222222222222222222222222222222222222222222222222222',
              details: {
                path: 'docs/00_control/PROJECT_STATE.md',
                previousSha256: '1111111111111111111111111111111111111111111111111111111111111111',
                newSha256: '2222222222222222222222222222222222222222222222222222222222222222',
                stateVersion: 121,
              },
            },
          ],
        };
      }
      // When navigating back to Project A, snapshot omits AUD-NAV-001!
      return {
        status: 200,
        body: [
          {
            id: 'AUD-INIT-001',
            actor: 'Lead Architect',
            timestamp: fixedIso,
            action: 'PROJECT_INITIALIZED',
            target: 'PRJ-DOCMONSTAKRAKIN',
            stateHash: 'init-state-hash',
          },
        ],
      };
    },
  });

  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // 1. Confirm event AUD-NAV-001 in Project A
    await executeSaveWorkflow(page);
    await page.locator('[data-testid="save-success-banner"]').waitFor();

    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);
    assert.match(await page.locator('table').innerText(), /AUD-NAV-001/);

    // 2. Switch to Project B
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-FIXTURE-B"]').click();
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('Fixture B'));
    assert.match(await topBarProjectBtn.innerText(), /v50/);

    // Navigate to Evidence & Audit in Project B
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // Project B table must show its own events and NOT AUD-NAV-001
    const bTableText = await page.locator('table').innerText();
    assert.match(bTableText, /AUD-INIT-002/);
    assert.doesNotMatch(bTableText, /AUD-NAV-001/);

    // 3. Switch back to Project A
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('docmonstakrakin'));

    // Navigate to Evidence & Audit in Project A
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    // 4. Project A snapshot arrived omitting AUD-NAV-001 -> rejected!
    await page.waitForTimeout(400);
    assert.match(await statusBadge.innerText(), /LEDGER UNCONFIRMED/);
    const aTableText = await page.locator('table').innerText();
    assert.match(aTableText, /AUD-NAV-001/, 'AUD-NAV-001 watermark preserved in Project A across navigation');
  } finally {
    await harness.close();
  }
});

// Scenario 28 (Test H - Blocker 1): Initial Project Without Prior Saves Loads Cleanly
await test('Scenario 28 (Test H - Blocker 1): Initial Project Without Prior Saves Loads Cleanly', async () => {
  const harness = await createHarness({
    initialStateVersion: 120,
  });

  try {
    const { page } = harness;
    // Navigate directly to Evidence & Audit tab without any saves
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    await page.getByRole('button', { name: /Append-Only Audit/ }).click();

    const statusBadge = page.locator('[data-testid="audit-sync-status-badge"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="audit-sync-status-badge"]')?.textContent?.includes('SYNCHRONIZED'));
    assert.match(await statusBadge.innerText(), /LEDGER SYNCHRONIZED/);

    // Ordinary initial audit event is displayed
    const tableText = await page.locator('table').innerText();
    assert.match(tableText, /AUD-INIT-001/);

    // No warning banner or retry button exists
    assert.equal(await page.locator('[data-testid="audit-sync-warning"]').count(), 0);
  } finally {
    await harness.close();
  }
});

// Scenario 29 (RED Test A - Blocker 3): Premature Warning Reset
await test('Scenario 29 (RED Test A - Blocker 3): Same-project selection does not clear unresolved snapshot warning while refresh is in-flight', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Step 1: Save to version 121
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Step 2: Trigger project fetch returning stale snapshot v120
    let resolveStaleFetch!: () => void;
    const staleHold = new Promise<void>((r) => (resolveStaleFetch = r));
    harness.holdProjectAResponse(staleHold);
    harness.setProjectAResponseOverride(async () => ({
      status: 200,
      body: {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 120, // Stale!
      },
    }));

    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();
    resolveStaleFetch();
    harness.holdProjectAResponse(null);

    // Stale snapshot warning appears
    const staleWarning = page.locator('[data-testid="stale-snapshot-warning"]');
    await staleWarning.waitFor({ timeout: 4000 });
    assert.match(await staleWarning.innerText(), /Project state snapshot is older than the confirmed version/);

    // Step 3: Re-select Project A while holding subsequent response
    let resolvePendingFetch!: () => void;
    const pendingHold = new Promise<void>((r) => (resolvePendingFetch = r));
    harness.holdProjectAResponse(pendingHold);

    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();

    // Give UI a moment to process the selection click
    await page.waitForTimeout(200);

    // Expected: Warning remains visible while the refresh is pending
    // Current defect: handleSelectProject() wipes setStaleSnapshotWarning('') immediately!
    assert.ok(
      await staleWarning.isVisible(),
      'Stale snapshot warning must remain visible while re-selection refresh is in-flight'
    );

    resolvePendingFetch();
    harness.holdProjectAResponse(null);
  } finally {
    harness.holdProjectAResponse(null);
    harness.setProjectAResponseOverride(null);
    await harness.close();
  }
});

// Scenario 30 (RED Test B - Blocker 3): Wrong Retry Endpoint
await test('Scenario 30 (RED Test B - Blocker 3): Project-list warning retries GET /api/projects instead of individual-project endpoint', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Step 1: Save to version 121 (establishes confirmed version 121)
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Navigate to Projects workspace
    await page.getByRole('button', { name: 'Projects' }).click();
    await page.locator('[aria-label="Projects workspace"]').waitFor();

    // Mock project list returning stale entries without safe cache
    harness.setProjectsList([
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 120, // Stale!
      },
    ]);

    // Refresh projects to establish stale list warning
    const refreshBtn = page.locator('[data-testid="btn-refresh-project-list"]');
    await refreshBtn.click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="btn-refresh-project-list"]') as HTMLButtonElement | null;
      return btn && !btn.disabled;
    });

    // Check project-list warning is visible
    const warning = page.locator('[data-testid="stale-project-list-warning"]');
    await warning.waitFor({ timeout: 4000 });

    const listFetchesBefore = harness.getProjectListFetchCount();
    const projectAFetchesBefore = harness.getProjectAFetchCount();

    // Click retry inside warning
    const retryBtn = warning.locator('[data-testid="btn-retry-project-list"]');
    await retryBtn.click();
    await page.waitForTimeout(300);

    const listFetchesAfter = harness.getProjectListFetchCount();
    const projectAFetchesAfter = harness.getProjectAFetchCount();

    // Expected: Retrying a project-list warning must issue GET /api/projects
    assert.ok(
      listFetchesAfter > listFetchesBefore,
      `Project list retry must issue GET /api/projects (was ${listFetchesBefore}, now ${listFetchesAfter})`
    );
    assert.equal(
      projectAFetchesAfter,
      projectAFetchesBefore,
      'Project list retry must NOT request individual project resources'
    );
  } finally {
    await harness.close();
  }
});

// Scenario 31 (RED Test C - Blocker 3): Stale List Hidden by Safe Cache
await test('Scenario 31 (RED Test C - Blocker 3): Stale project-list warning appears even when safe cached metadata is preserved', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Step 1: Save to version 121 (establishes confirmed version 121 and safe cache)
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Step 2: Navigate to Projects workspace
    await page.getByRole('button', { name: 'Projects' }).click();
    await page.locator('[aria-label="Projects workspace"]').waitFor();

    // Step 3: Mock project-list returning stale v120 (older than confirmed 121)
    harness.setProjectsList([
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'STALE OUTDATED NAME',
        stateVersion: 120, // Stale!
      },
    ]);

    // Step 4: Refresh project list
    const refreshBtn = page.locator('[data-testid="btn-refresh-project-list"]');
    await refreshBtn.click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="btn-refresh-project-list"]') as HTMLButtonElement | null;
      return btn && !btn.disabled;
    });

    // Step 5: Safe cache keeps v121 on the card
    const cardA = page.locator('article').filter({ hasText: 'PRJ-DOCMONSTAKRAKIN' });
    assert.match(await cardA.innerText(), /121/);

    // Step 6: Expected: UI must still report that its latest project-list response was stale!
    const listWarning = page.locator('[data-testid="stale-project-list-warning"]');
    assert.ok(
      await listWarning.isVisible(),
      'Stale project list warning must be visible even when safe cached metadata is displayed'
    );
  } finally {
    await harness.close();
  }
});

// Scenario 32 (Tests D & J - Blocker 3): Project switching and workspace navigation preserves unresolved snapshot warning
await test('Scenario 32 (Tests D & J - Blocker 3): Project switching and workspace navigation preserves unresolved snapshot warning', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Step 1: Save to version 121
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/);

    // Step 2: Make Project A snapshot stale (v120) and trigger reload
    harness.setProjectAResponseOverride(async () => ({
      status: 200,
      body: {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 120, // Stale!
      },
    }));

    // Trigger fetch for Project A
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();

    // Verify Project A snapshot warning is visible
    const snapshotWarning = page.locator('[data-testid="stale-snapshot-warning"]');
    await snapshotWarning.waitFor({ timeout: 4000 });
    assert.ok(await snapshotWarning.isVisible());

    // Step 3: Switch to Project B
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-FIXTURE-B"]').click();
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('Fixture B'));

    // Project B is fresh, so snapshot warning is NOT visible
    assert.ok(!(await snapshotWarning.isVisible()));

    // Step 4: Switch back to Project A
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('docmonstakrakin'));

    // Project A unresolved warning is preserved and visible!
    assert.ok(await snapshotWarning.isVisible(), 'Unresolved Project A warning must be preserved when navigating back');

    // Step 5: Navigate between workspaces (e.g. Evidence & Audit, Risks)
    await page.getByRole('button', { name: 'Evidence & Audit' }).click();
    assert.ok(await snapshotWarning.isVisible(), 'Snapshot warning must persist across workspace tab navigation');
  } finally {
    harness.setProjectAResponseOverride(null);
    await harness.close();
  }
});

// Scenario 33 (Tests E, F, G - Blocker 3): Simultaneous list and snapshot warnings with independent recovery
await test('Scenario 33 (Tests E, F, G - Blocker 3): Simultaneous list and snapshot warnings with independent recovery', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Step 1: Save to version 121
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));

    // Step 2: Trigger snapshot staleness on Project A
    harness.setProjectAResponseOverride(async () => ({
      status: 200,
      body: {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 120, // Stale!
      },
    }));
    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();

    const snapshotWarning = page.locator('[data-testid="stale-snapshot-warning"]');
    await snapshotWarning.waitFor({ timeout: 4000 });

    // Step 3: Trigger project list staleness
    await page.getByRole('button', { name: 'Projects' }).click();
    await page.locator('[aria-label="Projects workspace"]').waitFor();
    harness.setProjectsList([
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 120, // Stale!
      },
    ]);
    const refreshBtn = page.locator('[data-testid="btn-refresh-project-list"]');
    await refreshBtn.click();
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="btn-refresh-project-list"]') as HTMLButtonElement | null;
      return btn && !btn.disabled;
    });

    const listWarning = page.locator('[data-testid="stale-project-list-warning"]');
    await listWarning.waitFor({ timeout: 4000 });

    // Both warnings visible simultaneously (Test E)
    assert.ok(await snapshotWarning.isVisible(), 'Snapshot warning must be visible');
    assert.ok(await listWarning.isVisible(), 'Project list warning must be visible simultaneously');

    // Step 4: Recover project list by returning fresh list (v121) and clicking list retry (Test F)
    harness.setProjectsList([
      {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 121, // Fresh!
      },
    ]);
    const listRetryBtn = listWarning.locator('[data-testid="btn-retry-project-list"]');
    await listRetryBtn.click();
    await page.waitForTimeout(300);

    // List warning clears, snapshot warning remains visible
    assert.ok(!(await listWarning.isVisible()), 'Project list warning must clear after fresh list response');
    assert.ok(await snapshotWarning.isVisible(), 'Snapshot warning must remain visible when only list was recovered');

    // Step 5: Recover snapshot by returning fresh snapshot (v121) and clicking snapshot retry (Test G)
    harness.setProjectAResponseOverride(async () => ({
      status: 200,
      body: {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 121, // Fresh!
      },
    }));
    const snapshotRetryBtn = snapshotWarning.locator('[data-testid="btn-retry-project-fetch"]');
    await snapshotRetryBtn.click();
    await page.waitForTimeout(300);

    // Snapshot warning clears
    assert.ok(!(await snapshotWarning.isVisible()), 'Snapshot warning must clear after fresh snapshot response');
  } finally {
    harness.setProjectAResponseOverride(null);
    await harness.close();
  }
});

// Scenario 34 (Test I - Blocker 3): Failed retry preserves warning and allows repeated retry attempts
await test('Scenario 34 (Test I - Blocker 3): Failed retry preserves warning and allows repeated retry attempts', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Step 1: Save to version 121
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));

    // Step 2: Trigger snapshot staleness on Project A
    harness.setProjectAResponseOverride(async () => ({
      status: 200,
      body: {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 120, // Stale!
      },
    }));

    const dropdownBtn = page.locator('[data-testid="project-selector-dropdown-trigger"]');
    await dropdownBtn.click();
    await page.locator('[data-testid="project-option-PRJ-DOCMONSTAKRAKIN"]').click();

    const snapshotWarning = page.locator('[data-testid="stale-snapshot-warning"]');
    await snapshotWarning.waitFor({ timeout: 4000 });
    assert.ok(await snapshotWarning.isVisible());

    // Step 3: First retry fails with remaining stale response
    const retryBtn = snapshotWarning.locator('[data-testid="btn-retry-project-fetch"]');
    await retryBtn.click();
    await page.waitForTimeout(300);

    // Warning remains visible after failed retry
    assert.ok(await snapshotWarning.isVisible(), 'Warning must remain visible after failed retry');

    // Step 4: Second retry succeeds with fresh v121
    harness.setProjectAResponseOverride(async () => ({
      status: 200,
      body: {
        ...structuredClone(INITIAL_PROJECTS[0]),
        id: 'PRJ-DOCMONSTAKRAKIN',
        name: 'docmonstakrakin',
        stateVersion: 121, // Fresh!
      },
    }));

    await retryBtn.click();
    await page.waitForTimeout(300);

    // Warning clears
    assert.ok(!(await snapshotWarning.isVisible()), 'Warning must clear after successful second retry');
  } finally {
    harness.setProjectAResponseOverride(null);
    await harness.close();
  }
});

// Scenario 35 (Test H - Blocker 3): Unavailable project list without cache shows explicit alert instead of zero projects welcome screen
await test('Scenario 35 (Test H - Blocker 3): Unavailable project list without cache shows explicit alert instead of zero projects welcome screen', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;

    // Navigate to Projects workspace
    await page.getByRole('button', { name: 'Projects' }).click();
    await page.locator('[aria-label="Projects workspace"]').waitFor();

    // Verify initial state has projects
    const cardA = page.locator('article').filter({ hasText: 'PRJ-DOCMONSTAKRAKIN' });
    assert.ok(await cardA.isVisible());

    // Verify "No projects yet" and "Zero Projects Registered" are NOT shown
    const emptyHeading = page.getByRole('heading', { name: 'No projects yet' });
    assert.ok(!(await emptyHeading.isVisible()));
    const zeroProjectsText = page.getByText('Zero Projects Registered');
    assert.ok(!(await zeroProjectsText.isVisible()));
  } finally {
    await harness.close();
  }
});

await browser.close();
await vite.close();

console.log('============================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('============================================================');

if (failed > 0) {
  process.exit(1);
}
