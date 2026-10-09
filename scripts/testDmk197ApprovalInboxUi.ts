import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Route } from 'playwright';
import { createServer } from 'vite';
import { INITIAL_PROJECTS } from '../src/data/initialData.ts';
import type { ApprovalItem } from '../src/types.ts';

console.log('================================================================');
console.log('   DMK-197 APPROVAL INBOX & QUORUM UI REGRESSION TEST SUITE');
console.log('   Evaluates ApprovalsView Dual-Role Quorum & Inbox UX Invariants');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`✓ [PASS] ${name}`);
}

function fail(name: string, err: any) {
  failed++;
  console.error(`✗ [FAIL] ${name}`);
  console.error(err);
}

const root = process.cwd();
const vite = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
await vite.listen();
const viteBase = vite.resolvedUrls!.local[0];

const executable =
  process.env.DMK_TEST_BROWSER ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((p) => fs.existsSync(p));

const browser = await chromium.launch({
  headless: true,
  ...(executable ? { executablePath: executable } : {}),
});

const testProject = {
  ...INITIAL_PROJECTS[0],
  id: 'PRJ-UI-197',
  name: 'DMK-197 UI Test Project',
  owner: 'TestOwner',
};

const mockApprovals: ApprovalItem[] = [
  {
    id: 'APV-PENDING-01',
    projectId: testProject.id,
    title: 'Quorum Invariant REQ-SEC-001',
    type: 'REQUIREMENT_BASELINE',
    requestedBy: 'secOfficer',
    requestedAt: '2026-10-09T10:00:00.000Z',
    status: 'PENDING',
    urgency: 'HIGH',
    targetEntityId: 'REQ-SEC-001',
    targetEntityType: 'REQUIREMENT',
    description: 'Cryptographic nonces must use hardware RNG.',
    impactAnalysis: 'Affects key generation module.',
    riskLevel: 'HIGH',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    approvalsCollected: [],
    policyGates: [{ gateName: 'Target exists', passed: true, details: 'Target in project' }],
    policyVersion: 'LOCAL_SESSION_V1',
    targetDigest: 'digest-01',
  },
  {
    id: 'APV-PARTIAL-02',
    projectId: testProject.id,
    title: 'Dual Role Quorum ADR-SEC-002',
    type: 'ADR_SIGN_OFF',
    requestedBy: 'leadArch',
    requestedAt: '2026-10-09T11:00:00.000Z',
    status: 'PENDING',
    urgency: 'MEDIUM',
    targetEntityId: 'ADR-SEC-002',
    targetEntityType: 'ADR',
    description: 'Enforce distinct identity quorum checking.',
    impactAnalysis: 'Core governance ledger policy update.',
    riskLevel: 'MEDIUM',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    approvalsCollected: [
      {
        role: 'Security Officer',
        approver: 'secOfficer',
        identityId: 'REV-SEC-01',
        roleSource: 'LOCAL_SERVER_ROSTER',
        decision: 'APPROVED',
        timestamp: '2026-10-09T11:30:00.000Z',
        comment: 'Security posture ratified.',
      },
    ],
    policyGates: [{ gateName: 'Target exists', passed: true, details: 'Target in project' }],
    policyVersion: 'LOCAL_SESSION_V1',
    targetDigest: 'digest-02',
  },
  {
    id: 'APV-SATISFIED-03',
    projectId: testProject.id,
    title: 'Completed Quorum REQ-AUTH-003',
    type: 'REQUIREMENT_BASELINE',
    requestedBy: 'secOfficer',
    requestedAt: '2026-10-09T09:00:00.000Z',
    status: 'APPROVED',
    urgency: 'HIGH',
    targetEntityId: 'REQ-AUTH-003',
    targetEntityType: 'REQUIREMENT',
    description: 'Multi-factor authentication required for administration.',
    impactAnalysis: 'Admin dashboard login flows.',
    riskLevel: 'HIGH',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    approvalsCollected: [
      {
        role: 'Security Officer',
        approver: 'secOfficer',
        identityId: 'REV-SEC-01',
        roleSource: 'LOCAL_SERVER_ROSTER',
        decision: 'APPROVED',
        timestamp: '2026-10-09T09:15:00.000Z',
        comment: 'Security approved.',
      },
      {
        role: 'Lead Architect',
        approver: 'leadArch',
        identityId: 'REV-ARCH-01',
        roleSource: 'LOCAL_SERVER_ROSTER',
        decision: 'APPROVED',
        timestamp: '2026-10-09T09:30:00.000Z',
        comment: 'Architecture approved.',
      },
    ],
    policyGates: [{ gateName: 'Target exists', passed: true, details: 'Target in project' }],
    policyVersion: 'LOCAL_SESSION_V1',
    targetDigest: 'digest-03',
    resolvedAt: '2026-10-09T09:30:00.000Z',
    resolvedBy: 'leadArch',
  },
];

const mockSession = {
  identity: {
    id: 'REV-SEC-01',
    name: 'secOfficer',
    roles: ['Security Officer'],
    kind: 'HUMAN',
    roleSource: 'LOCAL_SERVER_ROSTER',
  },
};

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(8000);

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url()).pathname;
    const method = route.request().method();

    if (url === '/api/projects') {
      return route.fulfill({ status: 200, json: [testProject] });
    }

    if (url === '/api/governance/session') {
      return route.fulfill({ status: 200, json: mockSession });
    }

    if (url === `/api/projects/${testProject.id}/approvals` && method === 'GET') {
      return route.fulfill({ status: 200, json: mockApprovals });
    }

    if (url === `/api/projects/${testProject.id}` && method === 'GET') {
      return route.fulfill({ status: 200, json: testProject });
    }

    if (url.startsWith(`/api/projects/${testProject.id}/`)) {
      const suffix = url.replace(`/api/projects/${testProject.id}/`, '');
      if (suffix === 'requirements') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'questions') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'risks') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'adrs') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'overrides') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'components') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'audit-logs') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'work-items') return route.fulfill({ status: 200, json: [] });
      if (suffix === 'next-action') {
        return route.fulfill({
          status: 200,
          json: { id: 'NEXT-1', title: 'Next', reason: 'Testing', steps: [], blocks: [], blockingItems: [] },
        });
      }
    }

    return route.fulfill({ status: 200, json: [] });
  });

  await page.goto(`${viteBase}?project=${testProject.id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 1. Navigate to Approvals Inbox view
  try {
    const approvalsNavBtn = page.getByRole('button', { name: /^Approvals Inbox/ });
    await approvalsNavBtn.waitFor();
    await approvalsNavBtn.click();
    await page.getByText('Governance & Quorum Approvals Inbox', { exact: true }).waitFor();
    pass('UI-1: Approvals Inbox navigation succeeds');
  } catch (e) {
    fail('UI-1: Approvals Inbox navigation succeeds', e);
  }

  // 2. Active Reviewer Session banner displays authenticated identity and roles
  try {
    const banner = page.getByText('Authenticated Human Reviewer: secOfficer (REV-SEC-01)');
    await banner.waitFor();
    const rolePill = page.getByText('Roles: Security Officer');
    await rolePill.waitFor();
    pass('UI-2: Active reviewer session banner displays authenticated identity and roles');
  } catch (e) {
    fail('UI-2: Active reviewer session banner displays authenticated identity and roles', e);
  }

  // 3. Approval cards render dual-role quorum status pills
  try {
    // Check partial item APV-PARTIAL-02
    const partialItemCard = page.getByTestId('approval-card-APV-PARTIAL-02');
    await partialItemCard.waitFor();

    const secRatified = partialItemCard.getByText('Security Officer: ✓ RATIFIED');
    assert.ok((await secRatified.count()) >= 1, 'Partial item must show Security Officer: ✓ RATIFIED');

    const archPending = partialItemCard.getByText('Lead Architect: ⏳ PENDING');
    assert.ok((await archPending.count()) >= 1, 'Partial item must show Lead Architect: ⏳ PENDING');

    pass('UI-3: Approval cards render dual-role quorum status pills correctly');
  } catch (e) {
    fail('UI-3: Approval cards render dual-role quorum status pills correctly', e);
  }

  // 4. Right inspector shows detailed Dual-Role Quorum Progress breakdown
  try {
    const partialItemCard = page.getByTestId('approval-card-APV-PARTIAL-02');
    await partialItemCard.click();

    await page.getByText('Dual-Role Quorum Progress', { exact: true }).waitFor();
    await page.getByText('1 of 2 Roles Satisfied', { exact: true }).waitFor();
    await page.getByText('Rule: Quorum requires distinct human reviewer identities for Security Officer and Lead Architect.').waitFor();

    pass('UI-4: Right inspector displays Dual-Role Quorum Progress breakdown and distinct identity rule');
  } catch (e) {
    fail('UI-4: Right inspector displays Dual-Role Quorum Progress breakdown and distinct identity rule', e);
  }

  // 5. Completed item shows both roles satisfied and resolution metadata
  try {
    // Switch filter to ALL to view approved items
    await page.getByRole('button', { name: 'ALL', exact: true }).click();
    const satisfiedCard = page.getByTestId('approval-card-APV-SATISFIED-03');
    await satisfiedCard.waitFor();
    await satisfiedCard.click();

    await page.getByText('2 of 2 Roles Satisfied', { exact: true }).waitFor();
    const secSat = page.locator('div').filter({ hasText: 'Security Officer' }).getByText('✓ SATISFIED');
    const archSat = page.locator('div').filter({ hasText: 'Lead Architect' }).getByText('✓ SATISFIED');
    assert.ok((await secSat.count()) >= 1);
    assert.ok((await archSat.count()) >= 1);

    pass('UI-5: Completed item shows both roles satisfied');
  } catch (e) {
    fail('UI-5: Completed item shows both roles satisfied', e);
  }

  // 6. Request Sign-Off modal does NOT contain GATE_TRANSITION or RELEASE_SIGNOFF
  try {
    const reqBtn = page.getByRole('button', { name: 'Request Sign-Off' });
    await reqBtn.click();

    const modalTitle = page.getByText('Submit Formal Sign-Off Request', { exact: true });
    await modalTitle.waitFor();

    const select = page.locator('select');
    const options = await select.locator('option').allInnerTexts();

    assert.equal(options.includes('GATE_TRANSITION'), false, 'Dropdown must NOT include GATE_TRANSITION');
    assert.equal(options.includes('RELEASE_SIGNOFF'), false, 'Dropdown must NOT include RELEASE_SIGNOFF');

    const note = page.getByText('Release promotion and Gate 7 transitions require dedicated ceremonies');
    assert.ok((await note.count()) >= 1, 'Modal must explain dedicated ceremonies for release and Gate 7');

    pass('UI-6: Request Sign-Off modal excludes GATE/RELEASE and explains dedicated ceremonies');
  } catch (e) {
    fail('UI-6: Request Sign-Off modal excludes GATE/RELEASE and explains dedicated ceremonies', e);
  }

  // 7. Request Sign-Off validates required Target Entity ID (no silent fallback)
  try {
    // Fill title but leave Target Entity ID empty
    const titleInput = page.getByPlaceholder('e.g. Ratify REQ-AI-008');
    await titleInput.fill('Test Proposal Missing Target');

    const submitBtn = page.getByRole('button', { name: 'Submit Sign-Off Request' });
    // In HTML5 with required input, submitting empty input triggers browser validation or our validation
    const targetInput = page.getByPlaceholder('e.g. REQ-SEC-019 or ADR-004');
    assert.equal(await targetInput.getAttribute('required'), '', 'Target Entity ID input must be required');

    // Close modal
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();
    pass('UI-7: Request Sign-Off requires explicit Target Entity ID without fallback');
  } catch (e) {
    fail('UI-7: Request Sign-Off requires explicit Target Entity ID without fallback', e);
  }

  // 8. Decision modal displays human confirmation and reviewer identity context
  try {
    // Switch filter to PENDING
    await page.getByRole('button', { name: 'PENDING', exact: true }).click();
    const pendingCard = page.getByTestId('approval-card-APV-PENDING-01');
    await pendingCard.waitFor();
    await pendingCard.click();

    const signBtn = pendingCard.getByRole('button', { name: 'Sign Decision' });
    await signBtn.click();

    const modalTitle = page.getByText('Sign Governance Decision: APPROVED', { exact: true });
    await modalTitle.waitFor();

    const confirmCheckbox = page.getByLabel('I confirm this decision as an authorized human reviewer.');
    assert.ok((await confirmCheckbox.count()) === 1, 'Decision modal must contain human confirmation checkbox');

    const reviewerCtx = page.getByText(/Reviewer:\s*secOfficer/);
    assert.ok((await reviewerCtx.count()) >= 1, 'Decision modal must display reviewer session context');

    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();
    pass('UI-8: Decision modal displays human confirmation and reviewer context');
  } catch (e) {
    fail('UI-8: Decision modal displays human confirmation and reviewer context', e);
  }

  await page.close();
} finally {
  await browser.close();
  await vite.close();
}

console.log('\n================================================================');
console.log(`TOTAL UI TESTS: 8 | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
