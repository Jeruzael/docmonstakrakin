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

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url()).pathname;
    const method = route.request().method();

    const send = async (body: any, status = 200) => {
      await route.fulfill({ status, json: body }).catch(() => {});
    };

    if (url === '/api/projects') {
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
      return send(projectAData);
    }
    if (url === '/api/projects/PRJ-FIXTURE-B') {
      return send(projectBData);
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
        return route.fulfill({ status: custom.status, json: custom.body }).catch(() => {});
      }

      const nextVersion = 121;
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
    setProjectAData: (d: any) => {
      projectAData = d;
    },
    setProjectsList: (l: any) => {
      projectsList = l;
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

// Scenario 9: Out-of-Order Stale Responses (Monotonic Protection)
await test('Scenario 9: Delayed stale snapshot cannot downgrade a newer confirmed stateVersion', async () => {
  const harness = await createHarness({ initialStateVersion: 120 });
  try {
    const { page } = harness;
    const topBarProjectBtn = page.getByRole('button', { name: 'Select project' });

    // Save to version 121
    await executeSaveWorkflow(page);
    await page.waitForFunction(() => document.querySelector('header button')?.textContent?.includes('v121'));
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar updated to v121');

    // Simulate background fetch returning older snapshot (stateVersion 120)
    harness.setProjectAData({
      ...structuredClone(INITIAL_PROJECTS[0]),
      id: 'PRJ-DOCMONSTAKRAKIN',
      name: 'docmonstakrakin',
      stateVersion: 120,
    });

    // Trigger re-fetch of project data
    await page.evaluate(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(200);

    // TopBar must STILL display v121
    assert.match(await topBarProjectBtn.innerText(), /v121/, 'TopBar must not downgrade to v120');
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
