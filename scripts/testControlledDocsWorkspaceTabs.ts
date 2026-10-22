import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page, type Route } from 'playwright';
import { startIsolatedVite } from './fixtures/isolatedVite.ts';
import { INITIAL_PROJECTS, INITIAL_WORK_ITEMS } from '../src/data/initialData.ts';

console.log('================================================================');
console.log('   CONTROLLED DOCS WORKSPACE DUAL-TAB INTEGRATION TEST (TASK 11)');
console.log('   Repository Documents + Dynamic Projections Integration');
console.log('================================================================\n');

const root = process.cwd();
const harnessDir = path.resolve('runtime/dmk-195-task11');
fs.mkdirSync(harnessDir, { recursive: true });

const harnessHtml = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>ControlledDocs Workspace Tabs Test Harness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/runtime/dmk-195-task11/harness.tsx"></script>
  </body>
</html>`;

const harnessTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../../src/App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
`;

fs.writeFileSync(path.join(harnessDir, 'index.html'), harnessHtml, 'utf8');
fs.writeFileSync(path.join(harnessDir, 'harness.tsx'), harnessTsx, 'utf8');

const vite = await startIsolatedVite(root);
const base = vite.resolvedUrls!.local[0];
const executable =
  process.env.DMK_TEST_BROWSER ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) =>
    fs.existsSync(p)
  );
const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });

let passedCount = 0;
function pass(testName: string) {
  passedCount++;
  console.log(`✓ [PASS] ${testName}`);
}

const projectA = {
  ...structuredClone(INITIAL_PROJECTS[0]),
  id: 'PRJ-DOCMONSTAKRAKIN',
  name: 'docmonstakrakin',
  stateVersion: 70,
};

const projectB = {
  ...structuredClone(INITIAL_PROJECTS[0]),
  id: 'PRJ-B',
  name: 'Project B Empty',
  stateVersion: 10,
};

const projectDocsA = [
  {
    id: 'DOC-CTRL-001',
    authority: 'REFERENCE',
    path: 'docs/00_control/MASTER_WBS.md',
    title: 'Master Work Breakdown Structure',
    kind: 'CONTROL',
    fileType: 'MARKDOWN',
    integrityStatus: 'MATCH',
    currentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    editability: 'READ_ONLY',
    eol: 'LF',
    sizeBytes: 1000,
  },
  {
    id: 'DOC-CTRL-002',
    authority: 'REFERENCE',
    path: 'docs/00_control/PROJECT_STATE.md',
    title: 'Project State & Governance Lineage',
    kind: 'CONTROL',
    fileType: 'MARKDOWN',
    integrityStatus: 'MATCH',
    currentSha256: '9999c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    editability: 'CONTROLLED_EDIT',
    eol: 'LF',
    sizeBytes: 2000,
  },
];

const docContentA: Record<string, string> = {
  'DOC-CTRL-001': '# Master WBS\nRead-only reference document content.',
  'DOC-CTRL-002': '# Project State\nEditable living document canonical content.\n## Governance\nGate 7 pending.',
};

const approvalsA = [
  {
    id: 'APV-001',
    projectId: 'PRJ-DOCMONSTAKRAKIN',
    title: 'Architecture Review Sign-off',
    type: 'ADR_SIGN_OFF',
    targetEntityId: 'ADR-0001',
    targetEntityType: 'ADR',
    requestedBy: 'Gio',
    requestedAt: '2026-09-28T10:00:00.000Z',
    status: 'APPROVED',
    urgency: 'HIGH',
    riskLevel: 'MEDIUM',
    description: 'Zero-trust architecture boundary review',
    impactAnalysis: 'Human sign-off',
    requiredRoles: ['Lead Architect', 'Security Officer'],
    approvalsCollected: [
      { role: 'Lead Architect', approver: 'Gio', decision: 'APPROVED', timestamp: '2026-09-28T10:05:00.000Z' },
      { role: 'Security Officer', approver: 'SecurityLead', decision: 'APPROVED', timestamp: '2026-09-28T10:10:00.000Z' },
    ],
    targetDigest: 'digest-001',
    policyGates: [{ gateName: 'Quorum', passed: true, details: 'All 2 roles signed' }],
    resolvedAt: '2026-09-28T10:10:00.000Z',
    resolvedBy: 'SecurityLead',
  },
  {
    id: 'APV-002',
    projectId: 'PRJ-DOCMONSTAKRAKIN',
    title: 'Requirement Approval',
    type: 'REQUIREMENT_BASELINE',
    targetEntityId: 'REQ-0001',
    targetEntityType: 'REQUIREMENT',
    requestedBy: 'Developer',
    requestedAt: '2026-09-29T12:00:00.000Z',
    status: 'PENDING',
    urgency: 'MEDIUM',
    riskLevel: 'LOW',
    description: 'Core security baseline requirement',
    impactAnalysis: 'Human sign-off',
    requiredRoles: ['Lead Architect', 'Security Officer'],
    approvalsCollected: [
      { role: 'Lead Architect', approver: 'Gio', decision: 'APPROVED', timestamp: '2026-09-29T12:05:00.000Z' },
    ],
    targetDigest: 'digest-002',
    policyGates: [{ gateName: 'Quorum', passed: false, details: 'Waiting for Security Officer' }],
  },
];

const releaseReportA = {
  projectId: 'PRJ-DOCMONSTAKRAKIN',
  generatedAt: new Date().toISOString(),
  targetMilestone: 'v0.1 Local-First MVP',
  governancePolicy: 'SEC-CTRL-020 (Gate 7 Separation of Roles) / DMK-165',
  auditChainIntegrity: { valid: true, breaksCount: 0, details: 'Chain valid' },
  releaseReady: false,
  signedOff: false,
  capabilitiesSummary: { total: 25, verified: 25, percentage: 100 },
  gates: [
    { gateId: 1, name: 'Zero Unresolved Discovery Blockers', status: 'PASSED', details: 'All blockers resolved', evidenceLinks: ['EV-104'] },
    { gateId: 2, name: '100% Core Requirements Verification', status: 'PASSED', details: 'All requirements verified', evidenceLinks: ['EV-101'] },
    { gateId: 3, name: 'SecretStore Integration Complete', status: 'PASSED', details: 'No plaintext secrets', evidenceLinks: ['EV-157'] },
    { gateId: 4, name: 'Security Regression Passing', status: 'PASSED', details: 'All attack vectors blocked', evidenceLinks: ['EV-159'] },
    { gateId: 5, name: 'Golden Reference Execution & Sealing', status: 'PASSED', details: 'Sealed package roundtrip verified', evidenceLinks: ['EV-156'] },
    { gateId: 6, name: 'Cryptographic Audit Ledger Integrity', status: 'PASSED', details: 'All records chain cleanly', evidenceLinks: ['EV-159'] },
    { gateId: 7, name: 'Security Lead DoD Sign-off', status: 'HUMAN_APPROVAL_REQUIRED', details: 'Pending human sign-off', evidenceLinks: [] },
  ],
};

const interceptedMutations: { url: string; method: string; body: any }[] = [];

async function setupPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('requestfailed', (req) => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url()).pathname;
    const method = req.method();

    if (method === 'POST') {
      const body = req.postDataJSON ? req.postDataJSON() : null;
      interceptedMutations.push({ url, method, body });
      return route.fulfill({ status: 200, json: { ok: true } });
    }

    if (url === '/api/projects') {
      return route.fulfill({ status: 200, json: [projectA, projectB] });
    }
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN') {
      return route.fulfill({ status: 200, json: projectA });
    }
    if (url === '/api/projects/PRJ-B') {
      return route.fulfill({ status: 200, json: projectB });
    }
    if (url === '/api/governance/session') {
      return route.fulfill({
        status: 200,
        json: {
          identity: {
            id: 'usr-gio',
            name: 'Security Lead (Gio)',
            roles: ['Security Officer', 'Lead Architect'],
          },
        },
      });
    }

    // Controlled Docs endpoints
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/docs') {
      return route.fulfill({ status: 200, json: projectDocsA });
    }
    if (url === '/api/projects/PRJ-B/docs') {
      return route.fulfill({ status: 200, json: [] });
    }
    if (url.startsWith('/api/projects/PRJ-DOCMONSTAKRAKIN/docs/')) {
      const parts = url.split('/');
      const docId = parts[5];
      const sub = parts[6];
      if (!sub) {
        const content = docContentA[docId] || '# Document';
        return route.fulfill({
          status: 200,
          json: {
            document: projectDocsA.find((d) => d.id === docId),
            content,
            rawSha256: '9999c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            eol: 'LF',
            sizeBytes: content.length,
          },
        });
      }
    }

    // Dynamic Projections endpoints
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/approvals') {
      return route.fulfill({ status: 200, json: approvalsA });
    }
    if (url === '/api/projects/PRJ-B/approvals') {
      return route.fulfill({ status: 200, json: [] });
    }
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/release/gates') {
      return route.fulfill({ status: 200, json: releaseReportA });
    }
    if (url === '/api/projects/PRJ-B/release/gates') {
      return route.fulfill({ status: 200, json: { ...releaseReportA, projectId: 'PRJ-B' } });
    }
    if (url.endsWith('/requirements')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/questions')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/work-items')) return route.fulfill({ status: 200, json: INITIAL_WORK_ITEMS.slice(0, 1) });
    if (url.endsWith('/adrs')) return route.fulfill({ status: 200, json: [] });
    if (url === '/api/projects/PRJ-DOCMONSTAKRAKIN/components') {
      return route.fulfill({
        status: 200,
        json: [
          {
            id: 'CMP-01',
            projectId: 'PRJ-DOCMONSTAKRAKIN',
            name: 'API Gateway',
            trustZone: 'ZONE-01',
            category: 'GATEWAY',
            technology: 'Node.js',
            inboundProtocols: ['HTTPS'],
            outboundProtocols: ['gRPC'],
            securityControls: ['TLS 1.3', 'JWT Verification'],
          },
        ],
      });
    }
    if (url.endsWith('/components')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/risks')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/threats')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/standards')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/evidence')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/audit')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/features')) return route.fulfill({ status: 200, json: [] });
    if (url.endsWith('/next-action')) {
      return route.fulfill({
        status: 200,
        json: {
          id: 'NEXT',
          title: 'Next Action',
          actionType: 'RESOLVE_BLOCKER',
          reason: 'Baseline ready',
          targetEntityId: 'Q-001',
          blocks: [],
          severity: 'LOW',
        },
      });
    }

    return route.fulfill({ status: 200, json: {} });
  });

  return { page, errors };
}

try {
  const { page, errors } = await setupPage();
  await page.goto(`${base}runtime/dmk-195-task11/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for initial render of Project A
  await page.getByRole('button', { name: 'Select project', exact: true }).waitFor();

  // Navigate to Reports & Export view
  await page.getByRole('button', { name: /^Reports & Export/ }).click();

  // =========================================================================
  // Test 11A — Default Integration
  // =========================================================================
  const repoTab = page.getByRole('tab', { name: 'Repository Documents' });
  const dynamicTab = page.getByRole('tab', { name: 'Dynamic Projections' });

  await repoTab.waitFor({ timeout: 5000 });
  await dynamicTab.waitFor({ timeout: 5000 });

  assert.equal(await repoTab.getAttribute('aria-selected'), 'true', 'Repository Documents must be default selected tab');
  assert.equal(await dynamicTab.getAttribute('aria-selected'), 'false', 'Dynamic Projections tab must not be selected by default');

  const repoPanel = page.locator('#panel-repository-docs');
  const dynamicPanel = page.locator('#panel-dynamic-projections');

  assert.equal(await repoPanel.isVisible(), true, 'Repository Documents panel must be visible');
  assert.equal(await dynamicPanel.isHidden(), true, 'Dynamic Projections panel must be hidden');
  pass('Test 11A: Default Integration (Repository Documents active, Dynamic Projections hidden)');

  // =========================================================================
  // Test 11B — Tab Accessibility
  // =========================================================================
  const tablist = page.getByRole('tablist');
  await tablist.waitFor();

  const repoControls = await repoTab.getAttribute('aria-controls');
  const dynamicControls = await dynamicTab.getAttribute('aria-controls');
  assert.equal(repoControls, 'panel-repository-docs');
  assert.equal(dynamicControls, 'panel-dynamic-projections');

  assert.equal(await repoPanel.getAttribute('role'), 'tabpanel');
  assert.equal(await repoPanel.getAttribute('aria-labelledby'), 'tab-repository-docs');
  assert.equal(await dynamicPanel.getAttribute('role'), 'tabpanel');
  assert.equal(await dynamicPanel.getAttribute('aria-labelledby'), 'tab-dynamic-projections');

  // Switch to Dynamic Projections
  await dynamicTab.click();
  assert.equal(await dynamicTab.getAttribute('aria-selected'), 'true');
  assert.equal(await repoTab.getAttribute('aria-selected'), 'false');
  assert.equal(await dynamicPanel.isVisible(), true);
  assert.equal(await repoPanel.isHidden(), true);

  // Switch back to Repository Documents
  await repoTab.click();
  assert.equal(await repoTab.getAttribute('aria-selected'), 'true');
  assert.equal(await dynamicTab.getAttribute('aria-selected'), 'false');
  assert.equal(await repoPanel.isVisible(), true);
  assert.equal(await dynamicPanel.isHidden(), true);
  pass('Test 11B: Tab Accessibility (role=tablist, aria-controls, aria-labelledby, keyboard/click navigation)');

  // =========================================================================
  // Test 11C — Dynamic Projection Baseline & GFM Table Rendering
  // =========================================================================
  await dynamicTab.click();

  await page.getByText('Canonical Document Projections', { exact: true }).waitFor();
  await page.getByText('STATE PROJECTION ONLY', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Portable Package (.docmonstakrakin)' }).waitFor();
  await page.getByRole('button', { name: 'Copy Markdown' }).waitFor();
  await page.getByRole('button', { name: 'Export .md' }).waitFor();

  const projectionTabs = [
    'Product Requirements (PRD)',
    'Threat Model & Risk Register',
    'Traceability Matrix (RTM)',
    'Software Architecture (SAD)',
    'Governance & Quorum (GOV)',
    'Release Gates & DoD (REL)',
  ];
  for (const label of projectionTabs) {
    await page.getByRole('button', { name: label, exact: true }).waitFor();
  }

  // Verify Rendered / Raw toggle and default view in Dynamic Projections
  const toggleRendered = page.locator('[data-testid="projection-toggle-rendered"]');
  const toggleRaw = page.locator('[data-testid="projection-toggle-raw"]');
  await toggleRendered.waitFor();
  await toggleRaw.waitFor();

  // Default view is Rendered
  const renderedView = page.locator('[data-testid="dynamic-projection-rendered"]');
  const rawView = page.locator('[data-testid="dynamic-projection-raw"]');
  assert.equal(await renderedView.isVisible(), true, 'Dynamic projection defaults to Rendered mode');
  assert.equal(await rawView.isVisible(), false, 'Raw source view is hidden by default');

  // Click Software Architecture (SAD) projection tab
  await page.getByRole('button', { name: 'Software Architecture (SAD)', exact: true }).click();
  await page.getByText('Software Architecture Document (SAD)').waitFor();

  // In Rendered mode:
  assert.equal(await renderedView.isVisible(), true, 'Dynamic projection rendered view must be visible');
  const sadTable = renderedView.locator('table');
  await sadTable.waitFor();
  assert.equal(await sadTable.isVisible(), true, 'SAD projection table must be visible');
  const sadTableText = await sadTable.textContent();
  assert(sadTableText?.includes('API Gateway'), 'SAD table must contain API Gateway');

  const sadStrong = sadTable.locator('td strong', { hasText: 'API Gateway' });
  assert.equal(await sadStrong.count() > 0, true, 'SAD table cell must contain <strong> element with "API Gateway"');

  const sadCode = sadTable.locator('td code', { hasText: 'ZONE-01' });
  assert.equal(await sadCode.count() > 0, true, 'SAD table cell must contain <code> element with "ZONE-01"');

  // In Raw Source mode:
  await toggleRaw.click();
  await rawView.waitFor();
  assert.equal(await rawView.isVisible(), true, 'Raw source view is visible after toggle');
  assert.equal(await renderedView.isVisible(), false, 'Rendered view is hidden in raw mode');
  const rawSADContent = await rawView.textContent();
  assert(rawSADContent?.includes('| Component | Trust Zone |'), 'Raw source contains table header');
  assert(rawSADContent?.includes('**API Gateway**'), 'Raw source contains **API Gateway**');
  assert(rawSADContent?.includes('`ZONE-01`'), 'Raw source contains `ZONE-01`');

  // Switch back to Rendered:
  await toggleRendered.click();
  await renderedView.waitFor();
  assert.equal(await renderedView.isVisible(), true, 'Rendered view is visible after toggling back');
  assert.equal(await sadTable.isVisible(), true, 'SAD table is visible again after toggling back');

  pass('Test 11C: Dynamic Projection Baseline & GFM Table Rendering (Header, disclaimer, action buttons, 6 projection tabs, Rendered/Raw toggle, semantic table)');

  // =========================================================================
  // Test 11D — Package Modal
  // =========================================================================
  await page.getByRole('button', { name: 'Portable Package (.docmonstakrakin)' }).click();
  const packageModal = page.locator('#portable-package-modal, [role="dialog"]').filter({ hasText: 'Portable Project Package' });
  await packageModal.waitFor();

  assert((await packageModal.textContent())?.includes('docmonstakrakin'));
  assert((await packageModal.textContent())?.includes('PRJ-DOCMONSTAKRAKIN'));
  assert((await packageModal.textContent())?.includes('70'));

  // Close modal
  await page.getByRole('button', { name: /Close/i }).click();
  await packageModal.waitFor({ state: 'hidden' });
  pass('Test 11D: Package Modal (Opens from Dynamic Projections, renders Project A metadata and version 70)');

  // =========================================================================
  // Test 11E — Client-side Markdown Export
  // =========================================================================
  const copyBtn = page.getByRole('button', { name: 'Copy Markdown' });
  const exportBtn = page.getByRole('button', { name: 'Export .md' });
  assert.equal(await copyBtn.isVisible(), true);
  assert.equal(await exportBtn.isVisible(), true);
  pass('Test 11E: Client-side Markdown Export (Copy Markdown and Export .md buttons available)');

  // =========================================================================
  // Test 11F — Governance Projection
  // =========================================================================
  await page.getByRole('button', { name: 'Governance & Quorum (GOV)', exact: true }).click();
  await page.getByText('GOV.md', { exact: false }).first().waitFor();

  const dynamicText = await dynamicPanel.textContent();
  assert(dynamicText?.includes('APPROVED'), 'APPROVED status must be visible in GOV projection');
  assert(dynamicText?.includes('PENDING'), 'PENDING status must be visible in GOV projection');
  assert(dynamicText?.includes('2 / 2'), '2 / 2 signatures must be visible');
  assert(dynamicText?.includes('1 / 2'), '1 / 2 signatures must be visible');
  pass('Test 11F: Governance Projection (GOV.md, APPROVED 2/2, PENDING 1/2 signatures rendered)');

  // =========================================================================
  // Test 11G — Release Projection
  // =========================================================================
  await page.getByRole('button', { name: 'Release Gates & DoD (REL)', exact: true }).click();
  await page.getByText('v0.1 Definition-of-Done (DoD) Review & Release Gate').waitFor();
  await page.getByText('Release Gate Evaluations (7 Gates)').waitFor();
  await page.getByText('Gate 7', { exact: false }).first().waitFor();
  await page.getByText('Security Lead DoD Sign-off', { exact: false }).first().waitFor();

  // Verify Gate 7 was NOT executed and zero release-signoff mutations occurred
  const releaseSignoffPosts = interceptedMutations.filter((m) => m.url.includes('/release/signoff'));
  assert.equal(releaseSignoffPosts.length, 0, 'Release sign-off must NOT be executed');
  pass('Test 11G: Release Projection (7 gates visible, Gate 7 visible, zero sign-off mutations)');

  // =========================================================================
  // Test 11H — Repository Draft Survives Tab Switch
  // =========================================================================
  await repoTab.click();
  await page.getByText('Project State & Governance Lineage').click();

  const editBtn = page.getByRole('button', { name: 'Edit Document' });
  await editBtn.waitFor();
  await editBtn.click();

  const textarea = page.locator('textarea');
  await textarea.waitFor();
  await textarea.fill('# Project State\nTASK11-DRAFT-SENTINEL\n## Governance');

  // Switch to Dynamic Projections
  await dynamicTab.click();
  assert.equal(await dynamicPanel.isVisible(), true);

  // Switch back to Repository Documents
  await repoTab.click();
  assert.equal(await repoPanel.isVisible(), true);
  const draftVal = await page.locator('textarea').inputValue();
  assert(draftVal.includes('TASK11-DRAFT-SENTINEL'), 'Draft text must be preserved across tab switches');
  pass('Test 11H: Repository Draft Survives Tab Switch (Draft textarea preserved across tab roundtrip)');

  // =========================================================================
  // Test 11I — Dynamic Selection Survives Tab Switch
  // =========================================================================
  await dynamicTab.click();
  await page.getByRole('button', { name: 'Governance & Quorum (GOV)', exact: true }).click();
  await page.getByText('GOV.md', { exact: false }).first().waitFor();

  // Switch to Repository Documents
  await repoTab.click();
  assert.equal(await repoPanel.isVisible(), true);

  // Switch back to Dynamic Projections
  await dynamicTab.click();
  assert.equal(await dynamicPanel.isVisible(), true);
  await page.getByText('GOV.md', { exact: false }).first().waitFor();
  pass('Test 11I: Dynamic Selection Survives Tab Switch (GOV projection remains selected)');

  // =========================================================================
  // Test 11J — Project Switch Clears Repository State
  // =========================================================================
  await repoTab.click();
  assert.equal(await page.locator('textarea').inputValue().then((v) => v.includes('TASK11-DRAFT-SENTINEL')), true);

  // Switch to Project B
  await page.getByRole('button', { name: 'Select project', exact: true }).click();
  await page.getByRole('button', { name: /Project B Empty/ }).click();

  // Wait for Project B selection in TopBar
  await page.getByText('Project B Empty', { exact: false }).first().waitFor();

  // Verify Repository Documents is active by default
  assert.equal(await repoTab.getAttribute('aria-selected'), 'true', 'Repository Documents must be active on project switch');

  // Project A draft must be absent
  assert.equal(await page.locator('textarea').count(), 0, 'Textarea must not exist for empty Project B');

  // Ordinary Project B has no managed documents yet.
  await page.getByText('No project documents yet', {exact:true}).waitFor();
  pass('Test 11J: Project Switch Clears Repository State (Draft cleared, tab reset to Repository, empty state shown)');

  // =========================================================================
  // Test 11K — Empty Repository Still Has Projections
  // =========================================================================
  await dynamicTab.click();
  await page.getByText('Canonical Document Projections', { exact: true }).waitFor();
  assert.equal(await dynamicPanel.isVisible(), true, 'Dynamic projections must be accessible even when repository is empty');
  pass('Test 11K: Empty Repository Still Has Projections (Empty repo does not hide Dynamic Projections)');

  // =========================================================================
  // Test 11L — Project-Scoped Package
  // =========================================================================
  await page.getByRole('button', { name: 'Portable Package (.docmonstakrakin)' }).click();
  const packageModalB = page.locator('#portable-package-modal, [role="dialog"]').filter({ hasText: 'Portable Project Package' });
  await packageModalB.waitFor();

  const modalTextB = await packageModalB.textContent();
  assert(modalTextB?.includes('Project B Empty'), 'Modal must show Project B name');
  assert(modalTextB?.includes('PRJ-B'), 'Modal must show PRJ-B');
  assert(!modalTextB?.includes('PRJ-DOCMONSTAKRAKIN'), 'Modal must not show Project A ID');

  await page.getByRole('button', { name: /Close/i }).click();
  await packageModalB.waitFor({ state: 'hidden' });
  pass('Test 11L: Project-Scoped Package (Modal reflects Project B identity without leaking Project A)');

  // =========================================================================
  // Test 11M — True Project Switch Resets Projection Local State
  // =========================================================================
  // Switch back to Project A
  await page.getByRole('button', { name: 'Select project', exact: true }).click();
  await page.getByRole('button', { name: /^docmonstakrakin\b/ }).click();
  await page.getByText('docmonstakrakin', { exact: false }).first().waitFor();

  // In Project A, select GOV in Dynamic Projections
  await dynamicTab.click();
  await page.getByRole('button', { name: 'Governance & Quorum (GOV)', exact: true }).click();
  await page.getByText('GOV.md', { exact: false }).first().waitFor();

  // Switch to Project B
  await page.getByRole('button', { name: 'Select project', exact: true }).click();
  await page.getByRole('button', { name: /Project B Empty/ }).click();
  await page.getByText('Project B Empty', { exact: false }).first().waitFor();

  // In Project B, open Dynamic Projections
  await dynamicTab.click();

  // DocumentsView in Project B must start from PRD (default projection), not GOV
  const prdTabBtn = page.getByRole('button', { name: 'Product Requirements (PRD)', exact: true });
  assert.match(await prdTabBtn.getAttribute('class') || '', /border-emerald-600/, 'Project B must start on default PRD tab');
  pass('Test 11M: True Project Switch Resets Projection Local State (Keying resets local selection)');

  // =========================================================================
  // Test 11N — Zero Live Mutations
  // =========================================================================
  const forbiddenMutations = interceptedMutations.filter((m) =>
    m.url.includes('/docs/') && m.url.endsWith('/save') ||
    m.url.includes('/release/signoff') ||
    m.url.includes('/approvals/') && m.url.endsWith('/decide')
  );
  assert.equal(forbiddenMutations.length, 0, `No mutating actions permitted during navigation tests: ${JSON.stringify(forbiddenMutations)}`);
  pass('Test 11N: Zero Live Mutations (No save, sign-off, or approval mutations generated)');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: 14 | PASSED: ${passedCount} | FAILED: 0`);
  console.log('================================================================');
} finally {
  await browser.close();
  await vite.close();
  try {
    fs.rmSync(harnessDir, { recursive: true, force: true });
  } catch {}
}
