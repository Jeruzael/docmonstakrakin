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

const testProject2 = {
  ...INITIAL_PROJECTS[0],
  id: 'PRJ-UI-197-ALT',
  name: 'Alternative Isolation Project',
  owner: 'TestOwner2',
};

const mockApprovalsAlt: ApprovalItem[] = [
  {
    id: 'APV-ALT-01',
    projectId: testProject2.id,
    title: 'Isolated Project Approval',
    type: 'REQUIREMENT_BASELINE',
    requestedBy: 'secOfficer',
    requestedAt: '2026-10-09T12:00:00.000Z',
    status: 'PENDING',
    urgency: 'LOW',
    targetEntityId: 'REQ-ALT-001',
    targetEntityType: 'REQUIREMENT',
    description: 'Isolation test requirement.',
    impactAnalysis: 'None',
    riskLevel: 'LOW',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    approvalsCollected: [],
    policyGates: [{ gateName: 'Target exists', passed: true, details: 'Target in project' }],
    policyVersion: 'LOCAL_SESSION_V1',
    targetDigest: 'a'.repeat(63) + '0',
  },
];

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
    targetDigest: 'a'.repeat(63) + '1',
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
    targetDigest: 'a'.repeat(63) + '2',
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
    targetDigest: 'a'.repeat(63) + '3',
    resolvedAt: '2026-10-09T09:30:00.000Z',
    resolvedBy: 'leadArch',
  },
  {
    id: 'APV-INVALID-04',
    projectId: testProject.id,
    title: 'Invalid Policy Sign-Off REQ-INV-004',
    type: 'REQUIREMENT_BASELINE',
    requestedBy: 'secOfficer',
    requestedAt: '2026-10-09T08:00:00.000Z',
    status: 'PENDING',
    urgency: 'HIGH',
    targetEntityId: 'REQ-INV-004',
    targetEntityType: 'REQUIREMENT',
    description: 'Item with invalid quorum policy.',
    impactAnalysis: 'Core governance test.',
    riskLevel: 'HIGH',
    requiredRoles: ['Security Officer'],
    approvalsCollected: [],
    policyGates: [{ gateName: 'Target exists', passed: true, details: 'Target in project' }],
    policyVersion: 'LEGACY_V0',
    targetDigest: 'a'.repeat(63) + '4',
    quorum: {
      status: 'INVALID',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: ['Security Officer', 'Lead Architect'],
      reason: 'Invalid or unsupported approval policy metadata',
    },
  },
  {
    id: 'APV-STALE-05',
    projectId: testProject.id,
    title: 'Stale Target Sign-Off ADR-STALE-005',
    type: 'ADR_SIGN_OFF',
    requestedBy: 'leadArch',
    requestedAt: '2026-10-09T08:30:00.000Z',
    status: 'PENDING',
    urgency: 'MEDIUM',
    targetEntityId: 'ADR-STALE-005',
    targetEntityType: 'ADR',
    description: 'Item where target changed after request was created.',
    impactAnalysis: 'Stale target verification.',
    riskLevel: 'MEDIUM',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    approvalsCollected: [],
    policyGates: [{ gateName: 'Target exists', passed: true, details: 'Target in project' }],
    policyVersion: 'LOCAL_SESSION_V1',
    targetDigest: 'a'.repeat(63) + '5',
    quorum: {
      status: 'STALE',
      hasQuorum: false,
      satisfiedRoles: [],
      pendingRoles: ['Security Officer', 'Lead Architect'],
      reason: 'Target canonical entity has been modified since request was opened',
    },
  },
  {
    id: 'APV-LEGACY-06',
    projectId: testProject.id,
    title: 'Legacy Signature REQ-LEG-006',
    type: 'REQUIREMENT_BASELINE',
    requestedBy: 'secOfficer',
    requestedAt: '2026-10-09T08:45:00.000Z',
    status: 'PENDING',
    urgency: 'LOW',
    targetEntityId: 'REQ-LEG-006',
    targetEntityType: 'REQUIREMENT',
    description: 'Item with legacy signature lacking identityId or with forged roleSource.',
    impactAnalysis: 'Signature provenance verification.',
    riskLevel: 'LOW',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    approvalsCollected: [
      {
        role: 'Security Officer',
        approver: 'secOfficer',
        identityId: '',
        roleSource: 'CLIENT_PROVIDED' as any,
        decision: 'APPROVED',
        timestamp: '2026-10-09T08:50:00.000Z',
      },
    ],
    policyGates: [{ gateName: 'Target exists', passed: true, details: 'Target in project' }],
    policyVersion: 'LOCAL_SESSION_V1',
    targetDigest: 'a'.repeat(63) + '6',
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

let holdProjectAResponse: (() => void) | null = null;
let delayProjectAApprovals = false;

let holdProjectARefresh: (() => void) | null = null;
let delayProjectARefresh = false;

let holdDecisionResponse: (() => void) | null = null;
let delayDecision = false;

let holdProjectADecision: (() => void) | null = null;
let delayProjectADecision = false;

let holdProjectBRequest: (() => void) | null = null;
let delayProjectBRequest = false;
let countProjectBRequests = 0;

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(8000);

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url()).pathname;
    const method = route.request().method();

    if (url === '/api/projects') {
      return route.fulfill({ status: 200, json: [testProject, testProject2] });
    }

    if (url === '/api/governance/session') {
      return route.fulfill({ status: 200, json: mockSession });
    }

    if (url === `/api/projects/${testProject.id}/approvals` && method === 'GET') {
      if (delayProjectAApprovals) {
        delayProjectAApprovals = false;
        await new Promise<void>((r) => { holdProjectAResponse = r; });
      }
      if (delayProjectARefresh) {
        delayProjectARefresh = false;
        await new Promise<void>((r) => { holdProjectARefresh = r; });
      }
      return route.fulfill({ status: 200, json: mockApprovals });
    }

    if (url === `/api/projects/${testProject2.id}/approvals` && method === 'GET') {
      return route.fulfill({ status: 200, json: mockApprovalsAlt });
    }

    if (url === `/api/projects/${testProject2.id}/approvals` && method === 'POST') {
      countProjectBRequests++;
      if (delayProjectBRequest) {
        delayProjectBRequest = false;
        await new Promise<void>((r) => { holdProjectBRequest = r; });
      }
      return route.fulfill({
        status: 201,
        json: {
          id: 'APV-NEW-B-01',
          projectId: testProject2.id,
          title: 'Project B Formal Sign-Off',
          type: 'REQUIREMENT_BASELINE',
          status: 'PENDING',
          requiredRoles: ['Security Officer', 'Lead Architect'],
          approvalsCollected: [],
          policyVersion: 'LOCAL_SESSION_V1',
          targetDigest: 'b'.repeat(64),
        },
      });
    }

    if (url.includes('/decide') && method === 'POST') {
      if (delayDecision) {
        delayDecision = false;
        await new Promise<void>((r) => { holdDecisionResponse = r; });
      }
      if (delayProjectADecision) {
        delayProjectADecision = false;
        await new Promise<void>((r) => { holdProjectADecision = r; });
      }
      return route.fulfill({
        status: 200,
        json: {
          ...mockApprovals[1],
          approvalsCollected: [
            ...mockApprovals[1].approvalsCollected,
            {
              role: 'Security Officer',
              approver: 'secOfficer',
              identityId: 'REV-SEC-01',
              roleSource: 'LOCAL_SERVER_ROSTER',
              decision: 'APPROVED',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });
    }

    if (url === `/api/projects/${testProject.id}` && method === 'GET') {
      return route.fulfill({ status: 200, json: testProject });
    }

    if (url === `/api/projects/${testProject2.id}` && method === 'GET') {
      return route.fulfill({ status: 200, json: testProject2 });
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

    if (url.startsWith(`/api/projects/${testProject2.id}/`)) {
      const suffix = url.replace(`/api/projects/${testProject2.id}/`, '');
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
          json: { id: 'NEXT-2', title: 'Next 2', reason: 'Testing', steps: [], blocks: [], blockingItems: [] },
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

  // 9. Invalid policy visibly identified on card & inspector; decision buttons suppressed
  try {
    const invalidCard = page.getByTestId('approval-card-APV-INVALID-04');
    await invalidCard.waitFor();
    const invalidBadge = invalidCard.getByText('INVALID POLICY');
    assert.ok((await invalidBadge.count()) >= 1, 'Card must display INVALID POLICY badge');

    const warningText = invalidCard.getByText('Policy invalid: fresh sign-off required');
    assert.ok((await warningText.count()) >= 1, 'Card must show policy invalid warning text');

    // Decision buttons must be suppressed
    assert.equal(await invalidCard.getByRole('button', { name: 'Sign Decision' }).count(), 0);
    assert.equal(await invalidCard.getByRole('button', { name: 'Reject' }).count(), 0);

    // Click to view inspector
    await invalidCard.click();
    const inspectorBadge = page.locator('div').filter({ hasText: 'APV-INVALID-04' }).getByText('INVALID POLICY');
    assert.ok((await inspectorBadge.count()) >= 1, 'Inspector must display INVALID POLICY badge');

    pass('UI-9: Invalid policy visibly identified on card & inspector; decision buttons suppressed');
  } catch (e) {
    fail('UI-9: Invalid policy visibly identified on card & inspector; decision buttons suppressed', e);
  }

  // 10. Stale target visibly identified on card & inspector; decision buttons suppressed
  try {
    const staleCard = page.getByTestId('approval-card-APV-STALE-05');
    await staleCard.waitFor();
    const staleBadge = staleCard.getByText('STALE TARGET');
    assert.ok((await staleBadge.count()) >= 1, 'Card must display STALE TARGET badge');

    const warningText = staleCard.getByText('Target modified: fresh sign-off required');
    assert.ok((await warningText.count()) >= 1, 'Card must show target modified warning text');

    assert.equal(await staleCard.getByRole('button', { name: 'Sign Decision' }).count(), 0);
    assert.equal(await staleCard.getByRole('button', { name: 'Reject' }).count(), 0);

    await staleCard.click();
    const inspectorBadge = page.locator('div').filter({ hasText: 'ADR-STALE-005' }).getByText('STALE TARGET');
    assert.ok((await inspectorBadge.count()) >= 1, 'Inspector must display STALE TARGET badge');

    pass('UI-10: Stale target visibly identified on card & inspector; decision buttons suppressed');
  } catch (e) {
    fail('UI-10: Stale target visibly identified on card & inspector; decision buttons suppressed', e);
  }

  // 11. Legacy or forged signature provenance excluded from satisfied roles in client fallback
  try {
    const legacyCard = page.getByTestId('approval-card-APV-LEGACY-06');
    await legacyCard.waitFor();
    await legacyCard.click();

    // In inspector, dual-role progress should show 0 of 2 Roles Satisfied
    await page.getByText('0 of 2 Roles Satisfied', { exact: true }).waitFor();
    const pendingCount = legacyCard.getByText('0/2 roles ratified');
    assert.ok((await pendingCount.count()) >= 1, 'Card must show 0/2 roles ratified');

    pass('UI-11: Legacy or forged signature provenance excluded from satisfied roles in client fallback');
  } catch (e) {
    fail('UI-11: Legacy or forged signature provenance excluded from satisfied roles in client fallback', e);
  }

  // 12. Project-switch isolation: switching project clears selectedItem and closes open decision modal
  try {
    // Select an item and open decision modal
    const partialCard = page.getByTestId('approval-card-APV-PARTIAL-02');
    await partialCard.waitFor();
    await partialCard.click();

    const signBtn = partialCard.getByRole('button', { name: 'Sign Decision' });
    await signBtn.click();
    await page.getByText('Sign Governance Decision: APPROVED', { exact: true }).waitFor();

    // Trigger project switch while modal was open
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject2.id);

    // Verify modal is closed
    await page.waitForFunction(() => !document.body.innerText.includes('Sign Governance Decision: APPROVED'));
    assert.equal(await page.getByText('Sign Governance Decision: APPROVED').count(), 0, 'Decision modal must close on project switch');

    // Verify inspector selection is cleared
    const emptyInspector = page.getByText('Select an item from the inbox to inspect policy criteria and sign off.');
    await emptyInspector.waitFor();
    assert.ok((await emptyInspector.count()) >= 1, 'Inspector selection must be cleared on project switch');

    // Verify new project's item is displayed
    const altCard = page.getByTestId('approval-card-APV-ALT-01');
    await altCard.waitFor();
    assert.ok((await altCard.count()) >= 1, 'Alternative project approvals must be loaded');

    pass('UI-12: Project-switch isolation: switching project clears selectedItem and closes open decision modal');
  } catch (e) {
    fail('UI-12: Project-switch isolation: switching project clears selectedItem and closes open decision modal', e);
  }

  // UI-13. Deterministic Race Scenario A: Delayed initial fetch response from switched project is discarded
  try {
    // Current project is testProject2 (ALT).
    // Arm route interception to hold testProject's initial fetch.
    delayProjectAApprovals = true;

    // Trigger switch to testProject (Project A)
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject.id);

    // While Project A fetch is held in-flight, immediately switch back to testProject2 (Project B)
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject2.id);

    // Project B approvals load immediately
    const altCard = page.getByTestId('approval-card-APV-ALT-01');
    await altCard.waitFor();
    assert.ok((await altCard.count()) >= 1, 'Project B approvals must be loaded and visible');

    // Release held Project A response
    if (holdProjectAResponse) {
      holdProjectAResponse();
      holdProjectAResponse = null;
    }
    await page.waitForTimeout(200);

    // Verify Project A's approvals do NOT overwrite Project B
    assert.equal(await page.getByTestId('approval-card-APV-PENDING-01').count(), 0, 'Delayed Project A approvals must not appear');
    assert.ok((await altCard.count()) >= 1, 'Current project must remain Project B');
    assert.equal(await page.getByText('Sign Governance Decision: APPROVED').count(), 0, 'No stale modal should appear');

    pass('UI-13: Deterministic Race Scenario A: Delayed initial fetch response from switched project is discarded');
  } catch (e) {
    fail('UI-13: Deterministic Race Scenario A: Delayed initial fetch response from switched project is discarded', e);
  }

  // UI-14. Deterministic Race Scenario B: Delayed manual refresh response from switched project is discarded
  try {
    // Switch to Project A normally
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject.id);

    const firstCard = page.getByTestId('approval-card-APV-PENDING-01');
    await firstCard.waitFor();

    // Arm delay on Project A's manual refresh
    delayProjectARefresh = true;

    // Click Refresh button
    const refreshBtn = page.getByRole('button', { name: /Refresh/i });
    await refreshBtn.click();

    // While refresh is held, switch to Project B
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject2.id);

    const altCard = page.getByTestId('approval-card-APV-ALT-01');
    await altCard.waitFor();

    // Release held Project A refresh response
    if (holdProjectARefresh) {
      holdProjectARefresh();
      holdProjectARefresh = null;
    }
    await page.waitForTimeout(200);

    // Verify Project B state remains completely unchanged
    assert.equal(await page.getByTestId('approval-card-APV-PENDING-01').count(), 0, 'Held refresh must not overwrite Project B');
    assert.ok((await altCard.count()) >= 1, 'Project B state must remain intact');

    pass('UI-14: Deterministic Race Scenario B: Delayed manual refresh response from switched project is discarded');
  } catch (e) {
    fail('UI-14: Deterministic Race Scenario B: Delayed manual refresh response from switched project is discarded', e);
  }

  // UI-15. Deterministic Race Scenario C: Stale decision response does not affect switched project
  try {
    // Switch back to Project A
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject.id);

    const partialCard = page.getByTestId('approval-card-APV-PARTIAL-02');
    await partialCard.waitFor();
    await partialCard.click();

    const signBtn = partialCard.getByRole('button', { name: 'Sign Decision' });
    await signBtn.click();
    await page.getByText('Sign Governance Decision: APPROVED', { exact: true }).waitFor();

    const confirmCheckbox = page.getByRole('checkbox');
    await confirmCheckbox.check();

    // Arm delay on decision response
    delayDecision = true;

    const submitBtn = page.getByRole('button', { name: /Record APPROVED Decision/i });
    await submitBtn.click();

    // Switch to Project B while decision is in-flight
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject2.id);

    const altCard = page.getByTestId('approval-card-APV-ALT-01');
    await altCard.waitFor();

    // Release held decision response
    if (holdDecisionResponse) {
      holdDecisionResponse();
      holdDecisionResponse = null;
    }
    await page.waitForTimeout(200);

    // Confirm Project B's state, approvals, and lack of error banners
    assert.ok((await altCard.count()) >= 1, 'Project B card remains visible');
    assert.equal(await page.getByRole('alert').count(), 0, 'No stale error alert should appear on Project B');
    assert.equal(await page.getByText('Sign Governance Decision: APPROVED').count(), 0, 'No decision modal should appear on Project B');
    assert.equal(await page.getByTestId('approval-card-APV-PARTIAL-02').count(), 0, 'Project A card must not appear on Project B');

    pass('UI-15: Deterministic Race Scenario C: Stale decision response does not affect switched project');
  } catch (e) {
    fail('UI-15: Deterministic Race Scenario C: Stale decision response does not affect switched project', e);
  }

  // UI-16: Project B remains usable after delayed Project A decision
  try {
    // 1. Open Project A
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject.id);

    // 2. Select a pending approval
    const cardA = page.getByTestId('approval-card-APV-PARTIAL-02');
    await cardA.waitFor();
    await cardA.click();

    const signBtn = cardA.getByRole('button', { name: 'Sign Decision' });
    await signBtn.click();
    await page.getByText('Sign Governance Decision: APPROVED', { exact: true }).waitFor();

    const confirmCheckbox = page.getByRole('checkbox');
    await confirmCheckbox.check();

    // 3 & 4. Begin valid decision POST and hold response
    delayProjectADecision = true;
    const submitBtn = page.getByRole('button', { name: /Record APPROVED Decision/i });
    await submitBtn.click();

    // 5. Confirm submission becomes busy
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn && (btn.hasAttribute('disabled') || btn.textContent?.includes('Recording...'));
    });

    // 6. Switch to Project B while Project A decision is held
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject2.id);

    // 7. Verify Project A's decision modal closes and Project B cards load
    await page.waitForFunction(() => !document.body.innerText.includes('Sign Governance Decision: APPROVED'));
    assert.equal(await page.getByText('Sign Governance Decision: APPROVED').count(), 0, 'Decision modal must close on project switch');

    const altCard = page.getByTestId('approval-card-APV-ALT-01');
    await altCard.waitFor();

    // 8. Open Project B's request modal and verify submission controls are enabled
    const reqBtnB = page.getByRole('button', { name: 'Request Sign-Off' });
    await reqBtnB.click();
    await page.getByText('Submit Formal Sign-Off Request', { exact: true }).waitFor();

    const bSubmitBtn = page.getByRole('button', { name: 'Submit Sign-Off Request' });
    assert.equal(await bSubmitBtn.isDisabled(), false, 'Project B submit button must be enabled initially');
    assert.equal(await bSubmitBtn.innerText(), 'Submit Sign-Off Request', 'Button must not display submitting state');

    // 9. Release the Project A response
    if (holdProjectADecision) {
      holdProjectADecision();
      holdProjectADecision = null;
    }
    await page.waitForTimeout(200);

    // 10. Verify Project B remains usable after Project A completes
    assert.equal(await bSubmitBtn.isDisabled(), false, 'Project B submit button must remain enabled after Project A response resolves');
    assert.equal(await bSubmitBtn.innerText(), 'Submit Sign-Off Request', 'Button text must remain normal');

    // 11 & 12. Fill and submit in Project B
    const titleInput = page.getByPlaceholder('e.g. Ratify REQ-AI-008');
    await titleInput.fill('Project B Formal Sign-Off');
    const targetInput = page.getByPlaceholder('e.g. REQ-SEC-019 or ADR-004');
    await targetInput.fill('REQ-B-001');
    const descInput = page.getByPlaceholder('Detailed rationale and requirements for sign-off...');
    await descInput.fill('Detailed rationale for Project B');

    const prevReqCount = countProjectBRequests;
    await bSubmitBtn.click();

    // 13. Verify the Project B POST is actually issued and succeeds
    await page.waitForFunction(() => !document.body.innerText.includes('Submit Formal Sign-Off Request'));
    assert.ok(countProjectBRequests > prevReqCount, 'Project B request must actually be issued to server');

    // 14. Verify there is no stale Project A error, modal, or loading state
    assert.equal(await page.getByRole('alert').count(), 0, 'No alert should appear on Project B');
    assert.equal(await page.getByText('Sign Governance Decision: APPROVED').count(), 0, 'No stale modal');

    pass('UI-16: Project B remains usable after delayed Project A decision');
  } catch (e) {
    fail('UI-16: Project B remains usable after delayed Project A decision', e);
  }

  // UI-17: Old completion cannot interrupt a newer submission
  try {
    // 1. Start delayed Project A submission
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject.id);

    const cardA = page.getByTestId('approval-card-APV-PARTIAL-02');
    await cardA.waitFor();
    await cardA.click();

    const signBtn = cardA.getByRole('button', { name: 'Sign Decision' });
    await signBtn.click();
    await page.getByText('Sign Governance Decision: APPROVED', { exact: true }).waitFor();
    await page.getByRole('checkbox').check();

    delayProjectADecision = true;
    const submitBtnA = page.getByRole('button', { name: /Record APPROVED Decision/i });
    await submitBtnA.click();

    // 2. Switch to Project B
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject2.id);

    const altCard = page.getByTestId('approval-card-APV-ALT-01');
    await altCard.waitFor();

    // 3. Begin Project B's valid submission
    const reqBtnB = page.getByRole('button', { name: 'Request Sign-Off' });
    await reqBtnB.click();
    await page.getByText('Submit Formal Sign-Off Request', { exact: true }).waitFor();

    const titleInput = page.getByPlaceholder('e.g. Ratify REQ-AI-008');
    await titleInput.fill('Project B Overlapping Request');
    const targetInput = page.getByPlaceholder('e.g. REQ-SEC-019 or ADR-004');
    await targetInput.fill('REQ-B-002');
    const descInput = page.getByPlaceholder('Detailed rationale and requirements for sign-off...');
    await descInput.fill('Detailed rationale for Project B overlapping request');

    // 4. Arm delay on Project B response and submit
    delayProjectBRequest = true;
    const bSubmitBtn = page.getByRole('button', { name: 'Submit Sign-Off Request' });
    await bSubmitBtn.click();

    // Verify Project B is in submitting state
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn && btn.textContent?.includes('Submitting...');
    });

    // 5. Release Project A's old response first
    if (holdProjectADecision) {
      holdProjectADecision();
      holdProjectADecision = null;
    }
    await page.waitForTimeout(200);

    // 6 & 7. Verify Project B remains in its own active submitting state!
    const pendingSubmitBtn = page.locator('button[type="submit"]');
    assert.equal(await pendingSubmitBtn.isDisabled(), true, 'Project B submit button must stay disabled while Project B POST is pending');
    assert.equal(await pendingSubmitBtn.innerText(), 'Submitting...', 'Project B submit button must still show Submitting...');

    // 8. Release Project B's response
    if (holdProjectBRequest) {
      holdProjectBRequest();
      holdProjectBRequest = null;
    }
    await page.waitForTimeout(200);

    // 9. Verify Project B completes normally
    await page.waitForFunction(() => !document.body.innerText.includes('Submit Formal Sign-Off Request'));

    // 10. Verify submitting resets and controls become usable
    const freshReqBtn = page.getByRole('button', { name: 'Request Sign-Off' });
    await freshReqBtn.click();
    await page.getByText('Submit Formal Sign-Off Request', { exact: true }).waitFor();
    const freshSubmitBtn = page.getByRole('button', { name: 'Submit Sign-Off Request' });
    assert.equal(await freshSubmitBtn.isDisabled(), false, 'Submit button must be enabled again');
    await page.getByRole('button', { name: 'Cancel' }).click();

    pass('UI-17: Old completion cannot interrupt a newer submission');
  } catch (e) {
    fail('UI-17: Old completion cannot interrupt a newer submission', e);
  }

  // UI-18: A → B → A operation invalidation
  try {
    // 1. Begin delayed submission in Project A (e.g. on APV-PARTIAL-02)
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject.id);

    const cardA = page.getByTestId('approval-card-APV-PARTIAL-02');
    await cardA.waitFor();
    await cardA.click();

    const signBtn = cardA.getByRole('button', { name: 'Sign Decision' });
    await signBtn.click();
    await page.getByText('Sign Governance Decision: APPROVED', { exact: true }).waitFor();
    await page.getByRole('checkbox').check();

    delayProjectADecision = true;
    const submitBtnA = page.getByRole('button', { name: /Record APPROVED Decision/i });
    await submitBtnA.click();

    // 2. Switch to Project B
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject2.id);

    const altCard = page.getByTestId('approval-card-APV-ALT-01');
    await altCard.waitFor();

    // 3. Switch back to Project A
    await page.evaluate((targetProjId) => {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetProjId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, testProject.id);

    // 4. Establish a new valid operation or new project UI state in Project A
    const pendingCard = page.getByTestId('approval-card-APV-PENDING-01');
    await pendingCard.waitFor();
    await pendingCard.click();

    const signBtn2 = pendingCard.getByRole('button', { name: 'Sign Decision' });
    await signBtn2.click();
    await page.getByText('Sign Governance Decision: APPROVED', { exact: true }).waitFor();

    // Verify modal is open for APV-PENDING-01
    const reviewerCtx = page.getByText(/Reviewer:\s*secOfficer/);
    assert.ok((await reviewerCtx.count()) >= 1);

    // 5. Release original outdated Project A response (from APV-PARTIAL-02)
    if (holdProjectADecision) {
      holdProjectADecision();
      holdProjectADecision = null;
    }
    await page.waitForTimeout(200);

    // 6. Verify that stale response does NOT close modal, mutate selection, or trigger stale reload
    assert.ok((await page.getByText('Sign Governance Decision: APPROVED').count()) >= 1, 'Decision modal must remain open');
    assert.ok((await page.locator('div').filter({ hasText: 'APV-PENDING-01' }).count()) >= 1, 'Focus must remain on APV-PENDING-01');
    assert.equal(await page.getByRole('alert').count(), 0, 'No alert error from stale response');

    // Cleanly cancel modal
    await page.getByRole('button', { name: 'Cancel' }).click();

    pass('UI-18: A → B → A operation invalidation');
  } catch (e) {
    fail('UI-18: A → B → A operation invalidation', e);
  }

  await page.close();
} finally {
  await browser.close();
  await vite.close();
}

console.log('\n================================================================');
console.log(`TOTAL UI TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
