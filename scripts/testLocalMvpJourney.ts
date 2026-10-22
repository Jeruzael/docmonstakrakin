import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium, request, type Page, type APIRequestContext} from 'playwright';
import type {Project, Requirement, Question, WorkItem, AuditEvent, DocumentSaveResponse, DocumentContentResponse} from '../src/types.ts';
import type {ManagedDocumentCreateResponse} from '../src/managedDocumentTypes.ts';
import type {ProjectReadinessResponse} from '../src/releaseScopeTypes.ts';
import type {VerificationArchive, VerificationSession, VerificationSessionList, VerificationReviewProjection} from '../src/verificationTypes.ts';
import type {DocmonstakrakinPackage} from '../server/package/portablePackage.ts';
import type {ReleaseAuditReport} from '../server/release/releaseGateEvaluator.ts';
import {startLocalMvpJourney, JOURNEY_ACCOUNTS} from './fixtures/localMvpJourney.ts';

/**
 * Real App -> real API -> real snapshot journey. No route fulfills, replacement
 * stores, fake successful writes, provider requests, or operator data are used.
 * Build/server/browser execution is deliberately opt-in by running this script.
 * --plan prints the coverage contract without starting any fixture or browser.
 */
const plan = [
  'Create a project through the actual App wizard; resolve discovery and derive proposed work.',
  'Inspect aggregate reviewer setup; deny anonymous/AGENT mutation and switch synthetic HUMAN reviewers through the App.',
  'Create and revise a managed document through App controls; verify content digests, exact audit IDs and persistence.',
  'Set explicit current-release scope in the App, excluding a real future task from its denominator.',
  'Create/submit a verification bundle through App controls; deny self-review and record SO/LA reviews from two other synthetic persons.',
  'Observe 1/1 locally reviewed scoped task while lifecycle remains IN_PROGRESS and production release remains denied.',
  'Export/verify/import real package content; retain review history solely as UNTRUSTED_IMPORTED_HISTORY with active sessions cleared.',
  'Restart the actual server; require identical snapshot/document digests, expired old reviewer sessions and persistent untrusted history.',
];
const sha = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');
type PortableJourneyPackage = DocmonstakrakinPackage & {knowledge: DocmonstakrakinPackage['knowledge'] & {verificationHistory?: VerificationArchive[]}};
type VerificationMutation = {session: VerificationSession; review: VerificationReviewProjection; stateVersion: number};
type SessionResponse = {identity: {id: string; name: string; roles: string[]; kind: string} | null; setup: {
  state: string; missingRoles: string[]; distinctHumanRoleCoverage: boolean;
  verification: {validHumanPersonBindings: number; missingHumanPersonBindings: boolean; ambiguousAccountIds: boolean; distinctPersonRoleCoverage: boolean; distinctSubmitterCoverage: boolean};
}};

async function run() {
  const fixture = await startLocalMvpJourney();
  const executable = process.env.DMK_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, page: Page | undefined;
  const clients: APIRequestContext[] = [];
  const artifactRoot = path.resolve('runtime/local-mvp-journey');
  fs.mkdirSync(artifactRoot, {recursive: true});
  const results: {name: string; status: 'PASS' | 'FAIL'; error?: string}[] = [];
  const browserErrors: string[] = [], externalRequests: string[] = [], mutations: {method: string; path: string}[] = [];
  let currentStep = 'Start browser', projectId = '', workId = '', sessionId = '', documentId = '';
  let expectedDocumentHash = '', submittedDigest = '', restartSnapshotHash = '';
  const evidenceContent = 'Synthetic disposable journey observation. Local-only fixture evidence; not product acceptance or production producer proof.';
  const binding = {commitSha: 'a'.repeat(40), buildRevision: 'synthetic-journey-build-1', environment: 'local-disposable-journey'};
  async function api<T>(client: APIRequestContext, endpoint: string, method = 'GET', data?: unknown, expectedStatus = 200): Promise<T> {
    const response = await client.fetch(fixture.base + endpoint, {method, ...(data === undefined ? {} : {data}), headers: {'Content-Type': 'application/json'}});
    assert.equal(response.status(), expectedStatus, `${method} ${endpoint} must return ${expectedStatus}; received ${response.status()}`);
    return await response.json() as T;
  }
  const step = async (name: string, action: () => Promise<void>) => {
    currentStep = name;
    try {await action(); results.push({name, status: 'PASS'}); console.log(`PASS ${name}`);}
    catch (error) {results.push({name, status: 'FAIL', error: error instanceof Error ? error.message : String(error)}); throw error;}
  };
  const signIn = async (who: keyof typeof JOURNEY_ACCOUNTS) => {
    assert.ok(page);
    const logout = page.getByRole('button', {name: 'Sign out', exact: true});
    if (await logout.count()) {await logout.click(); await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).waitFor();}
    await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).click();
    await page.getByLabel('Reviewer username', {exact: true}).fill(JOURNEY_ACCOUNTS[who].username);
    await page.getByLabel('Reviewer password', {exact: true}).fill(fixture.password);
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await page.getByRole('button', {name: 'Sign out', exact: true}).waitFor();
    const session = await api<SessionResponse>(page.request, '/api/governance/session');
    assert.equal(session.identity?.id, JOURNEY_ACCOUNTS[who].id);
    assert.equal(session.identity?.name, JOURNEY_ACCOUNTS[who].username);
  };
  const independentClient = async (who: keyof typeof JOURNEY_ACCOUNTS) => {
    const client = await request.newContext(); clients.push(client);
    const session = await api<SessionResponse>(client, '/api/governance/session', 'POST', {username: JOURNEY_ACCOUNTS[who].username, password: fixture.password});
    assert.equal(session.identity?.id, JOURNEY_ACCOUNTS[who].id);
    return client;
  };
  try {
    browser = await chromium.launch({headless: true, ...(executable ? {executablePath: executable} : {})});
    page = await browser.newPage({viewport: {width: 1440, height: 1080}});
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== fixture.base) {externalRequests.push(url.origin + url.pathname); await route.abort('blockedbyclient'); return;}
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(route.request().method())) mutations.push({method: route.request().method(), path: url.pathname});
      await route.continue();
    });
    await step('actual App wizard creates an empty local project and saves discovery-derived requirements', async () => {
      assert.ok(page);
      await page.goto(fixture.base, {waitUntil: 'domcontentloaded', timeout: 30_000});
      assert.deepEqual(await api<Project[]>(page.request, '/api/projects'), [], 'Fixture starts without seeded or operator projects');
      await page.locator('#topbar-new-project-btn').click();
      await page.getByPlaceholder('e.g., Nexus Identity Broker, Atlas Portal').fill('Synthetic local MVP journey');
      for (let wizardStep = 1; wizardStep < 6; wizardStep++) await page.getByRole('button', {name: 'Continue', exact: true}).click();
      await page.getByRole('button', {name: 'Launch Project Control Plane', exact: true}).click();
      await page.getByRole('heading', {name: 'Synthetic local MVP journey', exact: true}).waitFor();
      const projects = await api<Project[]>(page.request, '/api/projects'); assert.equal(projects.length, 1);
      projectId = projects[0].id; assert.match(projectId, /^PRJ-/); assert.equal(projects[0].lifecyclePhase, 'DISCOVERY'); assert.equal(projects[0].progress.releaseReadiness, 0);
      await page.getByRole('button', {name: /^Requirements(?: |$)/}).click();
      await page.getByRole('button', {name: /^Adaptive Discovery Questionnaire/}).click();
      await page.getByRole('button', {name: /Process Automation & Workflow Efficiency/}).click();
      await page.getByRole('button', {name: /Process Automation & Workflow Efficiency/}).getByText('Saved', {exact: true}).waitFor();
      const questions = await api<Question[]>(page.request, `/api/projects/${projectId}/questions`);
      assert.equal(questions.find(question => question.id === 'PROD-Q-001')?.state, 'ANSWERED');
      const requirements = await api<Requirement[]>(page.request, `/api/projects/${projectId}/requirements`);
      assert.equal(requirements.length, 1); assert.equal(requirements[0].status, 'PROPOSED'); assert.ok(requirements[0].acceptanceCriteria.length);
      assert.equal(fixture.state().requirements[projectId][0].id, requirements[0].id, 'Discovery-derived record reached actual snapshot');
    });
    await step('real work proposal tracks implementation; anonymous and AGENT governance mutations are denied', async () => {
      assert.ok(page);
      const base = `/api/projects/${projectId}`;
      const [requirement] = await api<Requirement[]>(page.request, base + '/requirements');
      await page.getByRole('button', {name: 'Work Management', exact: true}).click();
      await page.getByRole('combobox', {name: 'Requirement to plan'}).selectOption(requirement.id);
      await page.getByRole('button', {name: 'Propose linked task', exact: true}).click();
      await page.getByText(`Implement: ${requirement.title}`, {exact: true}).first().waitFor();
      const work = (await api<WorkItem[]>(page.request, base + '/work-items')).find(item => item.requirements.length === 1 && item.requirements[0] === requirement.id);
      assert.ok(work, 'Find the requirement-derived proposal independently of the initial discovery task'); workId = work.id;
      assert.equal(work.status, 'PROPOSED'); assert.deepEqual(work.requirements, [requirement.id]);
      await page.getByText(work.title, {exact: true}).first().click();
      const statusSaved = page.waitForResponse(response => new URL(response.url()).pathname === base + '/work-items' && response.request().method() === 'POST' && response.status() === 200);
      await page.getByRole('combobox', {name: 'Work item status', exact: true}).selectOption('IN_PROGRESS');
      await statusSaved;
      assert.equal((await api<WorkItem[]>(page.request, base + '/work-items')).find(item => item.id === workId)?.status, 'IN_PROGRESS');
      const before = fixture.bytes();
      await api(page.request, base + '/work-items', 'POST', {itemId: workId, status: 'VERIFIED'}, 401);
      await api(page.request, base + '/readiness', 'GET', undefined, 401);
      assert.deepEqual(fixture.bytes(), before);
      const setup = await api<SessionResponse>(page.request, '/api/governance/session');
      assert.equal(setup.identity, null); assert.equal(setup.setup.state, 'configured'); assert.deepEqual(setup.setup.missingRoles, []);
      assert.equal(setup.setup.verification.validHumanPersonBindings, 3); assert.equal(setup.setup.verification.distinctSubmitterCoverage, true);
      assert.doesNotMatch(JSON.stringify(setup), /synthetic-journey-|SYNTHETIC-AUTHOR|synthetic-person-|credentialVerifier/);
      const agent = await independentClient('agent');
      await api(agent, base + '/docs', 'POST', {}, 403); await api(agent, base + '/verification-sessions', 'GET', undefined, 403);
      assert.deepEqual(fixture.bytes(), before);
      const futureRequirement = await api<Requirement>(page.request, base + '/requirements', 'POST', {title: 'Future synthetic release work', statement: 'Synthetic future work excluded from this release scope.', category: 'FUNCTIONAL', priority: 'LOW', acceptanceCriteria: ['Future fixture behavior remains unreviewed']}, 201);
      const current = await api<Project>(page.request, base);
      const future = await api<{created: boolean; workItem: WorkItem}>(page.request, base + '/work-items', 'POST', {operation: 'DERIVE_REQUIREMENT', requirementId: futureRequirement.id, expectedStateVersion: current.stateVersion}, 201);
      assert.notEqual(future.workItem.id, workId); assert.equal(future.workItem.status, 'PROPOSED');
      await page.reload({waitUntil: 'domcontentloaded'});
    });
    await step('App reviewer login creates and revises actual managed content with bound creation/update audits', async () => {
      assert.ok(page);
      await signIn('author');
      await page.getByRole('button', {name: 'Reports & Export', exact: true}).click();
      await page.getByTestId('controlled-docs-empty').waitFor();
      await page.getByTestId('btn-create-document').click();
      await page.getByTestId('create-document-reviewer').filter({hasText: JOURNEY_ACCOUNTS.author.username}).waitFor();
      const content = '# Synthetic local MVP document\n\nCreated in the disposable actual App journey.\n';
      await page.getByTestId('create-document-title').fill('Synthetic journey design notes');
      await page.getByTestId('create-document-content').fill(content);
      await page.getByTestId('create-document-reason').fill('Synthetic fixture creation; no governance approval');
      await page.getByTestId('create-document-confirmation').check();
      const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/projects/${projectId}/docs` && response.request().method() === 'POST');
      await page.getByTestId('btn-confirm-create-document').click();
      const response = await createdResponse; assert.equal(response.status(), 201);
      const created = await response.json() as ManagedDocumentCreateResponse; documentId = created.documentId;
      assert.equal(created.projectId, projectId); assert.equal(created.newSha256, sha(content)); assert.match(documentId, /^MDOC-/); assert.equal(Object.hasOwn(created, 'previousSha256'), false);
      await page.getByTestId('doc-title').filter({hasText: 'Synthetic journey design notes'}).waitFor();
      assert.equal((await api<DocumentContentResponse>(page.request, `/api/projects/${projectId}/docs/${documentId}`)).content, content);
      await page.getByTestId('btn-edit-document').click();
      const revised = content + '\nRevision saved through the actual diff, validation and confirmation controls.\n';
      await page.getByTestId('draft-editor-textarea').fill(revised);
      await page.getByTestId('btn-preview-diff').click(); await page.getByTestId('btn-validate').click(); await page.getByTestId('btn-proceed-to-save').click();
      await page.getByTestId('modal-session-name').filter({hasText: JOURNEY_ACCOUNTS.author.username}).waitFor();
      await page.getByTestId('modal-save-reason').fill('Synthetic fixture revision'); await page.getByTestId('modal-confirm-checkbox').check();
      const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/projects/${projectId}/docs/${documentId}/save` && response.request().method() === 'POST');
      await page.getByTestId('btn-confirm-save').click();
      const save = await savedResponse; assert.equal(save.status(), 200);
      const saved = await save.json() as DocumentSaveResponse; expectedDocumentHash = sha(revised);
      assert.equal(saved.previousSha256, created.newSha256); assert.equal(saved.newSha256, expectedDocumentHash);
      await page.getByTestId('save-success-banner').waitFor();
      const events = await api<AuditEvent[]>(page.request, `/api/projects/${projectId}/audit`);
      for (const [ack, action] of [[created, 'DOCUMENT_CREATED'], [saved, 'DOCUMENT_UPDATED']] as const) {
        const event = events.find(event => event.id === ack.auditEventId); assert.ok(event); assert.equal(event.action, action); assert.equal(event.target, documentId);
        assert.equal(event.actor, JOURNEY_ACCOUNTS.author.username); assert.equal(event.details?.newSha256, ack.newSha256);
      }
      assert.equal(fixture.state().managedDocuments[projectId][0].sha256Digest, expectedDocumentHash);
      await page.getByRole('button', {name: 'Evidence & Audit', exact: true}).click();
      await page.getByRole('button', {name: /^Append-Only Audit/}).click();
      await page.getByText('DOCUMENT_CREATED', {exact: true}).first().waitFor(); await page.getByText('DOCUMENT_UPDATED', {exact: true}).first().waitFor();
      await page.screenshot({path: path.join(artifactRoot, 'managed-document-audit.png'), fullPage: true});
    });
    await step('explicit App scope excludes future work and initially reports no locally reviewed evidence', async () => {
      assert.ok(page);
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.getByRole('button', {name: 'Projects', exact: true}).click();
      const editor = page.getByRole('region', {name: 'Project readiness setup'});
      await editor.getByLabel('Target source-control selection', {exact: true}).waitFor();
      await editor.getByLabel('Project maturity', {exact: true}).selectOption('GREENFIELD'); await editor.getByLabel('Target source-control selection', {exact: true}).fill('Git');
      await editor.getByLabel(`Include ${workId} in current release`, {exact: true}).check();
      await editor.getByLabel('Commit SHA', {exact: true}).fill(binding.commitSha); await editor.getByLabel('Build revision', {exact: true}).fill(binding.buildRevision); await editor.getByLabel('Environment', {exact: true}).fill(binding.environment);
      const saveResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/projects/${projectId}/readiness` && response.request().method() === 'POST');
      await editor.getByRole('button', {name: 'Save release scope and setup', exact: true}).click();
      assert.equal((await saveResponse).status(), 200);
      const readiness = await api<ProjectReadinessResponse>(page.request, `/api/projects/${projectId}/readiness`);
      assert.deepEqual(readiness.readinessContext?.workItemIds, [workId]); assert.equal(readiness.summary.scope?.count, 1);
      assert.equal(readiness.summary.localEvidence.reviewedCount, 0); assert.equal(readiness.summary.localEvidence.percentage, 0);
      assert.equal(readiness.summary.lifecycle.counts.IN_PROGRESS, 1); assert.equal(readiness.summary.lifecycle.counts.PROPOSED, 0);
      assert.equal(readiness.summary.productionRelease.status, 'Unavailable');
    });
    await step('App verification creates immutable submitted evidence and denies author self-review', async () => {
      assert.ok(page);
      await page.getByRole('button', {name: 'Evidence & Audit', exact: true}).click();
      const panel = page.getByRole('region', {name: 'Verification sessions'});
      await panel.getByText(`Authenticated reviewer: ${JOURNEY_ACCOUNTS.author.username}.`, {exact: false}).waitFor();
      await panel.getByLabel('Verification work item', {exact: true}).selectOption(workId);
      await panel.getByLabel('Commit SHA', {exact: true}).fill(binding.commitSha); await panel.getByLabel('Build revision', {exact: true}).fill(binding.buildRevision); await panel.getByLabel('Verification environment', {exact: true}).fill(binding.environment);
      await panel.getByLabel('Evidence type 1', {exact: true}).selectOption('LOG'); await panel.getByLabel('Evidence content 1', {exact: true}).fill(evidenceContent);
      const work = (await api<WorkItem[]>(page.request, `/api/projects/${projectId}/work-items`)).find(item => item.id === workId); assert.ok(work); assert.ok(work.acceptanceCriteria.length);
      for (let index = 1; index <= work.acceptanceCriteria.length; index++) {
        await panel.getByLabel(`Criterion ${index} result`, {exact: true}).selectOption('PASS');
        await panel.getByLabel(`Criterion ${index} notes`, {exact: true}).fill('Synthetic fixture criterion result for exercising the local review protocol; not product acceptance evidence.');
        await panel.getByLabel(`Criterion ${index} uses evidence 1`, {exact: true}).check();
      }
      await panel.getByRole('button', {name: 'Create verification draft', exact: true}).click(); await panel.getByText('DRAFT', {exact: true}).waitFor();
      const list = await api<VerificationSessionList>(page.request, `/api/projects/${projectId}/verification-sessions`); assert.equal(list.sessions.length, 1); sessionId = list.sessions[0].id;
      assert.equal(list.identity.identityId, JOURNEY_ACCOUNTS.author.id); assert.doesNotMatch(JSON.stringify(list.sessions), /Synthetic disposable journey observation/);
      await panel.getByLabel('I attest this submitted evidence was observed by me', {exact: true}).check(); await panel.getByRole('button', {name: 'Submit immutable bundle', exact: true}).click();
      await panel.getByText('SUBMITTED', {exact: true}).waitFor();
      const detail = await api<VerificationMutation>(page.request, `/api/projects/${projectId}/verification-sessions/${sessionId}`); assert.ok(detail.session.submitted); submittedDigest = detail.session.submitted.digest;
      assert.equal(detail.session.submitted.bundle.evidence[0].sha256, sha(evidenceContent)); assert.equal(detail.session.submitted.bundle.evidence[0].provenance, 'HUMAN_ATTESTED_INLINE');
      const before = fixture.bytes();
      await api(page.request, `/api/projects/${projectId}/verification-sessions/${sessionId}/decisions`, 'POST', {expectedStateVersion: detail.stateVersion, expectedReviewer: {identityId: JOURNEY_ACCOUNTS.author.id, personId: JOURNEY_ACCOUNTS.author.personId}, submittedDigest, ...binding, decision: 'APPROVE', role: 'Security Officer', humanAttested: true, independenceAttested: true}, 403);
      assert.deepEqual(fixture.bytes(), before); assert.equal(await panel.getByRole('button', {name: 'Record review decision', exact: true}).count(), 0);
    });
    await step('two other synthetic persons independently review the same submitted digest through App controls', async () => {
      assert.ok(page);
      for (const who of ['security', 'architect'] as const) {
        await signIn(who);
        const panel = page.getByRole('region', {name: 'Verification sessions'});
        await panel.getByRole('button', {name: 'Reload sessions', exact: true}).click();
        await panel.getByText(`Authenticated reviewer: ${JOURNEY_ACCOUNTS[who].username}.`, {exact: false}).waitFor();
        await panel.getByRole('button', {name: sessionId, exact: true}).click(); await panel.getByText(submittedDigest, {exact: true}).waitFor();
        await panel.getByLabel('Review role', {exact: true}).selectOption(JOURNEY_ACCOUNTS[who].roles[0]);
        await panel.getByLabel('Review reason', {exact: true}).fill('Synthetic fixture review of exact submitted bytes; local assertion only.');
        await panel.getByLabel('I reviewed this exact submitted digest', {exact: true}).check(); await panel.getByLabel('I attest I am a different person from the author and other reviewers', {exact: true}).check();
        await panel.getByRole('button', {name: 'Record review decision', exact: true}).click();
        await panel.getByText('Human review decision recorded.', {exact: true}).waitFor();
      }
      const detail = await api<VerificationMutation>(page.request, `/api/projects/${projectId}/verification-sessions/${sessionId}`);
      assert.equal(detail.session.status, 'APPROVED'); assert.equal(detail.review.eligible, true); assert.equal(detail.review.trustedProductionEvidence, false);
      assert.deepEqual(detail.session.decisions.map(decision => decision.reviewer.personId).sort(), [JOURNEY_ACCOUNTS.security.personId, JOURNEY_ACCOUNTS.architect.personId].sort());
      assert.equal((await api<WorkItem[]>(page.request, `/api/projects/${projectId}/work-items`)).find(item => item.id === workId)?.status, 'IN_PROGRESS');
    });
    await step('scope counts local review while production acquisition/signoff remain denied without mutation', async () => {
      assert.ok(page);
      const beforeRead = fixture.bytes();
      const readiness = await api<ProjectReadinessResponse>(page.request, `/api/projects/${projectId}/readiness`);
      assert.deepEqual(readiness.summary.localEvidence.reviewedWorkItemIds, [workId]); assert.equal(readiness.summary.localEvidence.percentage, 100); assert.equal(readiness.summary.scope?.count, 1);
      assert.equal(readiness.summary.securityAssurance.status, 'Unavailable'); assert.equal(readiness.summary.productionRelease.status, 'Unavailable');
      const report = await api<ReleaseAuditReport>(page.request, `/api/projects/${projectId}/release/gates`);
      assert.equal(report.releaseReady, false); assert.equal(report.signedOff, false); assert.deepEqual(fixture.bytes(), beforeRead);
      const security = await independentClient('security');
      await api(security, `/api/projects/${projectId}/release/signoff`, 'POST', {humanConfirmed: true, notes: 'Synthetic denial probe only; no actual human or production approval.'}, 412);
      assert.deepEqual(fixture.bytes(), beforeRead, 'Denied production signoff must not mutate audit, approvals, task or progress');
      await page.getByRole('button', {name: 'Home', exact: true}).click();
      await page.getByRole('heading', {name: 'Project Health & Dimensions', exact: true}).waitFor();
      await page.screenshot({path: path.join(artifactRoot, 'local-review-production-denied.png'), fullPage: true});
    });
    await step('actual package roundtrip preserves document bytes but archives approved reviews as untrusted history', async () => {
      assert.ok(page);
      const base = `/api/projects/${projectId}`;
      const exported = await api<PortableJourneyPackage>(page.request, base + '/package/export');
      assert.equal(exported.knowledge.managedDocuments?.find(document => document.id === documentId)?.sha256Digest, expectedDocumentHash);
      const history = exported.knowledge.verificationHistory; assert.ok(history?.length); assert.equal(history.reduce((sum, archive) => sum + archive.sessionCount, 0), 1);
      for (const archive of history) {assert.equal(archive.trust, 'UNTRUSTED_IMPORTED_HISTORY'); assert.equal(archive.activeReviewAuthority, false); assert.equal(archive.trustedProductionEvidence, false);}
      const sealed = await api<{valid: boolean}>(page.request, '/api/projects/package/verify', 'POST', {package: exported}); assert.equal(sealed.valid, true);
      fs.writeFileSync(path.join(artifactRoot, 'synthetic-export.docmonstakrakin'), JSON.stringify(exported, null, 2));
      await api<{status: string}>(page.request, '/api/projects/package/import', 'POST', {package: exported, overwrite: true, actor: 'Synthetic disposable journey import'}, 201);
      const imported = await api<VerificationSessionList>(page.request, base + '/verification-sessions');
      assert.equal(imported.sessions.length, 0); assert.ok(imported.archives?.length); assert.equal(imported.archives.reduce((sum, archive) => sum + archive.sessionCount, 0), 1);
      assert.ok(imported.archives.every(archive => archive.trust === 'UNTRUSTED_IMPORTED_HISTORY' && archive.activeReviewAuthority === false && archive.trustedProductionEvidence === false));
      const document = await api<DocumentContentResponse>(page.request, base + `/docs/${documentId}`); assert.equal(document.rawSha256, expectedDocumentHash); assert.equal(sha(document.content), expectedDocumentHash);
      const local = await api<ProjectReadinessResponse>(page.request, base + '/readiness'); assert.equal(local.summary.localEvidence.reviewedCount, 0); assert.notEqual(local.summary.localEvidence.percentage, 100);
      assert.equal((await api<WorkItem[]>(page.request, base + '/work-items')).find(item => item.id === workId)?.status, 'PROPOSED');
      assert.equal((await api<{valid: boolean}>(page.request, base + '/audit/verify')).valid, true);
    });
    await step('actual restart preserves exact snapshot/document digests while reviewer sessions expire', async () => {
      assert.ok(page);
      const before = fixture.bytes(); restartSnapshotHash = sha(before);
      await fixture.restart(); assert.deepEqual(fixture.bytes(), before); assert.equal(sha(fixture.bytes()), restartSnapshotHash);
      assert.equal((await api<SessionResponse>(page.request, '/api/governance/session')).identity, null);
      await api(page.request, `/api/projects/${projectId}/readiness`, 'GET', undefined, 401);
      await page.reload({waitUntil: 'domcontentloaded'}); await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).waitFor();
      await signIn('architect');
      const document = await api<DocumentContentResponse>(page.request, `/api/projects/${projectId}/docs/${documentId}`); assert.equal(document.rawSha256, expectedDocumentHash);
      const sessions = await api<VerificationSessionList>(page.request, `/api/projects/${projectId}/verification-sessions`); assert.equal(sessions.sessions.length, 0); assert.equal(sessions.archives?.[0].trust, 'UNTRUSTED_IMPORTED_HISTORY');
      assert.equal(fixture.state().managedDocuments[projectId][0].sha256Digest, expectedDocumentHash);
      assert.ok(fixture.state().auditLogs[projectId].every(event => !['RELEASE_GATE_APPROVED', 'RELEASE_SIGNOFF_RECORDED'].includes(event.action)));
      assert.deepEqual(browserErrors, []); assert.equal(externalRequests.length, 0, 'No outside origin was contacted by the real App');
    });
  } catch (error) {
    await page?.screenshot({path: path.join(artifactRoot, 'failure.png'), fullPage: true}).catch(() => {});
    fs.writeFileSync(path.join(artifactRoot, 'server-failure.log'), fixture.log());
    throw error;
  } finally {
    fs.writeFileSync(path.join(artifactRoot, 'results.json'), JSON.stringify({scope: 'Actual App/API/persistence in a disposable synthetic workspace; no production activation or real human approval',
      currentStep, results, projectId, workId, sessionId, documentId, documentSha256: expectedDocumentHash, submittedDigest, restartSnapshotSha256: restartSnapshotHash,
      browserErrors, externalRequests, browserMutations: mutations, limitations: ['Synthetic persons and test attestations are not real-world identity proof', 'Local evidence is not authenticated production acquisition', 'Legacy ordinary-project endpoints remain partially contained'], plan}, null, 2));
    for (const client of clients) await client.dispose();
    await browser?.close(); await fixture.close();
  }
  console.log(`Local MVP journey: ${results.length} actual App/API/persistence steps passed`);
}

if (process.argv.includes('--plan')) console.log(JSON.stringify({execution: 'Not started', plan}, null, 2));
else await run();
