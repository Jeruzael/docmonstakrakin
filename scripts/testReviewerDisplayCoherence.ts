import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium, type Page} from 'playwright';
import {startIsolatedVite} from './fixtures/isolatedVite.ts';
import {INITIAL_PROJECTS} from '../src/data/initialData.ts';

// Actual App, header and ApprovalsView; only API transport is synthetic.
// Session abort is recorded but deliberately ineffective to expose late replies.
const vite = await startIsolatedVite(process.cwd());
const base = vite.resolvedUrls!.local[0];
const executablePath = process.env.DMK_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {})});
const alice = {id: 'FIXTURE-ALICE', name: 'Fixture Alice', roles: ['Security Officer'], kind: 'HUMAN', roleSource: 'LOCAL_SERVER_ROSTER'};
const bob = {id: 'FIXTURE-BOB', name: 'Fixture Bob', roles: ['Lead Architect'], kind: 'HUMAN', roleSource: 'LOCAL_SERVER_ROSTER'};
const project = {...structuredClone(INITIAL_PROJECTS[0]), id: 'COHERENCE', name: 'Reviewer display fixture'};
const approval = {id: 'APV-COHERENCE', projectId: project.id, title: 'Synthetic pending decision', type: 'REQUIREMENT_BASELINE', requestedBy: 'fixture', requestedAt: '2026-10-21T00:00:00Z', status: 'PENDING', urgency: 'LOW', targetEntityId: 'REQ-FIXTURE', targetEntityType: 'REQUIREMENT', description: 'Display test only', impactAnalysis: 'None', riskLevel: 'LOW', requiredRoles: ['Security Officer', 'Lead Architect'], approvalsCollected: [], policyGates: [{gateName: 'Fixture target', passed: true, details: 'Synthetic'}], policyVersion: 'LOCAL_SESSION_V1', targetDigest: 'a'.repeat(64)};
const settle = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const panel = (page: Page) => page.getByRole('heading', {name: 'Governance & Quorum Approvals Inbox', exact: true}).locator('xpath=../..').locator('xpath=..');
const plan = (page: Page, value: object) => page.evaluate(value => (window as any).coherence.plans.push(value), value);
const latestHeld = (page: Page) => page.evaluate(() => (window as any).coherence.calls.findLastIndex((call: any) => call.held));
const release = async (page: Page, index: number, identity: unknown) => {await page.evaluate(({index, identity}) => (window as any).coherence.release(index, {identity}), {index, identity}); await settle(page);};
async function setup(options: {childReply?: object; timed?: boolean; reissue?: boolean} = {}) {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.setDefaultTimeout(3500);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const mutations: string[] = [];
  await page.addInitScript(({alice, bob}) => {
    const original = window.fetch.bind(window);
    const pending = new Map<number, (response: Response) => void>();
    const bodies = new Map<number, ReadableStreamDefaultController>();
    const state: any = {identity: alice, plans: [], calls: [], release(index: number, body: unknown, status = 200) {
      if (bodies.has(index)) {bodies.get(index)!.enqueue(new TextEncoder().encode(JSON.stringify(body))); bodies.get(index)!.close(); bodies.delete(index);}
      else {pending.get(index)!(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})); pending.delete(index);}
    }};
    (window as any).coherence = state;
    window.fetch = (input, init) => {
      if (new URL(String(input), location.href).pathname !== '/api/governance/session') return original(input, init);
      const method = init?.method || 'GET';
      const match = state.plans.findIndex((p: any) => p.method === method);
      const reply = match < 0 ? {} : state.plans.splice(match, 1)[0];
      const index = state.calls.length;
      const call = {method, held: !!reply.hold, aborted: !!init?.signal?.aborted}; state.calls.push(call);
      init?.signal?.addEventListener('abort', () => {call.aborted = true;}, {once: true});
      if (reply.hold) return new Promise<Response>(resolve => pending.set(index, resolve));
      if (reply.bodyHold) return Promise.resolve(new Response(new ReadableStream({start(controller) {bodies.set(index, controller);}}), {status: 200}));
      if (reply.network) return Promise.reject(new TypeError('Synthetic transport failure'));
      const status = reply.status || 200;
      if (status === 200 && method !== 'GET') state.identity = method === 'DELETE' ? null : bob;
      return Promise.resolve(new Response(JSON.stringify(Object.hasOwn(reply, 'body') ? reply.body : {identity: state.identity}), {status, headers: {'Content-Type': 'application/json'}}));
    };
  }, {alice, bob});
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (route.request().method() !== 'GET') {mutations.push(url.pathname); return route.abort('blockedbyclient');}
    if (url.pathname === '/api/projects') return route.fulfill({json: [project]});
    if (url.pathname === `/api/projects/${project.id}`) return route.fulfill({json: project});
    if (url.pathname.endsWith('/approvals')) return route.fulfill({json: [options.reissue ? {
      ...approval, approvalsCollected: [{role: 'Security Officer', approver: 'fixture', identityId: '', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED', timestamp: '2026-10-21T00:00:00Z'}],
      reissueRequired: true, reissueReason: 'Malformed stored fixture signature: empty identityId',
      quorum: {status: 'INVALID', hasQuorum: false, satisfiedRoles: [], pendingRoles: ['Security Officer', 'Lead Architect'], reason: 'Malformed stored fixture signature', reissueRequired: true, reissueReason: 'Malformed stored fixture signature: empty identityId'},
    } : approval]});
    if (url.pathname.endsWith('/next-action')) return route.fulfill({json: {id: 'NEXT', title: 'Synthetic next action', reason: 'Fixture', steps: [], blocks: [], blockingItems: []}});
    return route.fulfill({json: []});
  });
  await page.goto(base, {waitUntil: 'domcontentloaded'});
  await page.getByRole('heading', {name: project.name, exact: true}).waitFor();
  await page.getByText(alice.name, {exact: true}).waitFor();
  if (options.timed) await page.clock.install();
  // Actual main.tsx mounts StrictMode: cover both the discarded and current read.
  if (options.childReply) for (let replay = 0; replay < 2; replay++) await plan(page, {method: 'GET', ...options.childReply});
  await page.getByRole('button', {name: /^Approvals(?: |$)/}).click();
  await page.getByRole('heading', {name: 'Governance & Quorum Approvals Inbox', exact: true}).waitFor();
  await settle(page);
  return {page, async close() {await page.close(); assert.deepEqual(errors, [], 'No malformed-session render crash or unhandled rejection'); assert.deepEqual(mutations, [], 'Display checks must not invoke any authority writer');}};
}
async function noAlice(page: Page) {assert.doesNotMatch(await panel(page).innerText(), /Fixture Alice|FIXTURE-ALICE/, 'Approvals must not retain stale Alice identity or roles');}
async function unknown(page: Page) {await noAlice(page); assert.match(await panel(page).innerText(), /session.*(?:unconfirmed|unknown|checking)|(?:unconfirmed|unknown).*session/i);}
async function loginBob(page: Page) {
  await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).click();
  await page.getByLabel('Reviewer username', {exact: true}).fill('fixture-bob');
  await page.getByLabel('Reviewer password', {exact: true}).fill('fixture-only-password');
  await page.getByRole('button', {name: 'Sign in', exact: true}).click(); await settle(page);
}
async function refresh(page: Page) {await panel(page).getByRole('button', {name: 'Refresh', exact: true}).click(); await settle(page);}
let passed = 0, failed = 0;
async function test(name: string, run: () => Promise<void>) {try {await run(); passed++; console.log(`PASS ${name}`);} catch (error) {failed++; console.error(`FAIL ${name}:`, error);}}
try {
  await test('C1 mounted App replaces Alice with confirmed logout and later Bob', async () => {
    const f = await setup(); try {
      assert.match(await panel(f.page).innerText(), /Authenticated Human Reviewer: Fixture Alice/);
      await f.page.getByRole('button', {name: 'Sign out', exact: true}).click(); await settle(f.page); await noAlice(f.page);
      assert.match(await panel(f.page).innerText(), /No active human reviewer session/);
      await loginBob(f.page); assert.match(await panel(f.page).innerText(), /Fixture Bob.*FIXTURE-BOB/); await noAlice(f.page);
    } finally {await f.close();}
  });
  await test('C2 pending logout invalidates identity immediately and does not start a session read', async () => {
    const f = await setup(); try {
      await plan(f.page, {method: 'DELETE', hold: true});
      const before = await f.page.evaluate(() => (window as any).coherence.calls.filter((c: any) => c.method === 'GET').length);
      await f.page.getByRole('button', {name: 'Sign out', exact: true}).click(); await settle(f.page); await unknown(f.page);
      assert.equal(await f.page.evaluate(() => (window as any).coherence.calls.filter((c: any) => c.method === 'GET').length), before);
      assert(await panel(f.page).getByRole('button', {name: 'Refresh', exact: true}).isDisabled());
    } finally {await f.close();}
  });
  await test('C3 a late pre-logout read cannot restore Alice after logout and Bob sign-in', async () => {
    const f = await setup({childReply: {hold: true}}); try {
      const old = await latestHeld(f.page); assert(old >= 0);
      await f.page.getByRole('button', {name: 'Sign out', exact: true}).click(); await settle(f.page);
      await loginBob(f.page); await release(f.page, old, alice);
      await noAlice(f.page); assert.match(await panel(f.page).innerText(), /Fixture Bob.*FIXTURE-BOB/);
    } finally {await f.close();}
  });
  await test('C4 failed logout clears cached authority and explicit re-check can recover a fresh observation', async () => {
    const f = await setup(); try {
      await plan(f.page, {method: 'DELETE', status: 500});
      await f.page.getByRole('button', {name: 'Sign out', exact: true}).click(); await settle(f.page); await unknown(f.page);
      assert.match(await f.page.locator('body').innerText(), /Last confirmed reviewer/);
      await f.page.evaluate(bob => {(window as any).coherence.identity = bob;}, bob);
      await refresh(f.page); assert.match(await panel(f.page).innerText(), /Fixture Bob.*FIXTURE-BOB/); await noAlice(f.page);
    } finally {await f.close();}
  });
  await test('C5 failed sign-in remains unknown until a later confirmed attempt', async () => {
    const f = await setup(); try {
      await f.page.getByRole('button', {name: 'Sign out', exact: true}).click(); await settle(f.page);
      await plan(f.page, {method: 'POST', status: 401}); await loginBob(f.page); await unknown(f.page);
      await f.page.getByLabel('Reviewer password', {exact: true}).fill('fixture-only-password');
      await f.page.getByRole('button', {name: 'Sign in', exact: true}).click(); await settle(f.page);
      assert.match(await panel(f.page).innerText(), /Fixture Bob.*FIXTURE-BOB/);
    } finally {await f.close();}
  });
  await test('C6 malformed full identities and unsuccessful session reads never render authenticated roles', async () => {
    for (const childReply of [{body: {identity: {...alice, roles: 'Security Officer'}}}, {body: {identity: {...alice, id: null}}}, {body: {identity: {...alice, kind: 'AGENT'}}}, {status: 500, body: {identity: alice}}]) {
      const f = await setup({childReply: {hold: true}}); try {
        const index = await latestHeld(f.page);
        await f.page.evaluate(({index, childReply}) => (window as any).coherence.release(index, childReply.body, 'status' in childReply ? childReply.status : 200), {index, childReply});
        await settle(f.page); await unknown(f.page);
      } finally {await f.close();}
    }
  });
  await test('C7 held approval reads and bodies time out without admitting their late identity', async () => {
    for (const childReply of [{hold: true}, {bodyHold: true}]) {
      const f = await setup({childReply, timed: true}); try {
        const index = await f.page.evaluate(() => (window as any).coherence.calls.length - 1);
        await f.page.clock.fastForward(20_001); await settle(f.page); await unknown(f.page);
        assert.equal(await f.page.evaluate(index => (window as any).coherence.calls[index].aborted, index), true);
        await release(f.page, index, alice); await unknown(f.page);
        await f.page.evaluate(bob => {(window as any).coherence.identity = bob;}, bob);
        await refresh(f.page); assert.match(await panel(f.page).innerText(), /Fixture Bob.*FIXTURE-BOB/);
      } finally {await f.close();}
    }
  });
  await test('C8 an open decision loses old human confirmation when the header session changes', async () => {
    const f = await setup(); try {
      const card = f.page.getByTestId('approval-card-APV-COHERENCE'); await card.click();
      await card.getByRole('button', {name: 'Sign Decision'}).click();
      const consent = f.page.getByLabel('I confirm this decision as an authorized human reviewer.'); await consent.check();
      await f.page.getByRole('button', {name: 'Sign out', exact: true}).evaluate(button => (button as HTMLButtonElement).click()); await settle(f.page);
      assert.equal(await consent.isChecked(), false, 'A previous identity cannot leave a checked human confirmation behind');
      await noAlice(f.page);
    } finally {await f.close();}
  });
  await test('C9 unmounted approval reads cannot overwrite a newly mounted fresh reviewer', async () => {
    const f = await setup({childReply: {hold: true}}); try {
      const old = await latestHeld(f.page);
      await f.page.getByRole('button', {name: /^Requirements(?: |$)/}).click();
      await f.page.evaluate(bob => {(window as any).coherence.identity = bob;}, bob);
      await f.page.getByRole('button', {name: /^Approvals(?: |$)/}).click(); await settle(f.page);
      await release(f.page, old, alice); await noAlice(f.page); assert.match(await panel(f.page).innerText(), /Fixture Bob.*FIXTURE-BOB/);
    } finally {await f.close();}
  });
  await test('C10 same-turn re-check followed by logout cannot cancel the mutation or start a competing read', async () => {
    const f = await setup(); try {
      await plan(f.page, {method: 'DELETE', hold: true});
      const before = await f.page.evaluate(() => (window as any).coherence.calls.filter((c: any) => c.method === 'GET').length);
      await f.page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        buttons.find(button => button.textContent?.trim() === 'Refresh')!.click();
        buttons.find(button => button.textContent?.trim() === 'Sign out')!.click();
      });
      await settle(f.page);
      assert.equal(await f.page.evaluate(() => (window as any).coherence.calls.filter((c: any) => c.method === 'GET').length), before, 'Queued re-check must yield to the admitted mutation');
      const index = await latestHeld(f.page);
      assert.equal(await f.page.evaluate(index => (window as any).coherence.calls[index].aborted, index), false);
      await f.page.evaluate(() => {(window as any).coherence.identity = null;});
      await release(f.page, index, null);
      assert(await f.page.getByRole('button', {name: 'Sign in for governance review', exact: true}).isEnabled());
      await noAlice(f.page);
    } finally {await f.close();}
  });
  await test('C11 governed reissue confirmation clears on pending or uncertain logout and stays cleared for a different reviewer', async () => {
    for (const reply of [{hold: true}, {status: 500}, {}]) {
      const f = await setup({reissue: true}); try {
        await f.page.getByTestId('approval-card-APV-COHERENCE').getByRole('button', {name: 'Reissue Sign-Off', exact: true}).click();
        await f.page.getByPlaceholder('Explain why this approval request is being reissued (e.g. malformed signatures, corrupted ingestion)...').fill('Synthetic display attestation test only');
        const consent = f.page.locator('#reissue-confirm'); await consent.check();
        const submit = f.page.getByRole('button', {name: 'Confirm & Reissue Sign-Off', exact: true});
        assert(await submit.isEnabled());
        await plan(f.page, {method: 'DELETE', ...reply});
        await f.page.getByRole('button', {name: 'Sign out', exact: true}).evaluate(button => (button as HTMLButtonElement).click());
        await settle(f.page);
        assert.equal(await consent.isChecked(), false, 'Reissue attestation cannot survive a reviewer-context invalidation');
        assert(await submit.isDisabled(), 'Reissue requires a fresh explicit local confirmation');
        await noAlice(f.page);
        if ('status' in reply) {
          await unknown(f.page);
          await f.page.evaluate(bob => {(window as any).coherence.identity = bob;}, bob);
          await panel(f.page).getByRole('button', {name: 'Refresh', exact: true}).evaluate(button => (button as HTMLButtonElement).click());
          // Header confirmation precedes the approval view's full identity read.
          await panel(f.page).getByText('Authenticated Human Reviewer: Fixture Bob (FIXTURE-BOB)', {exact: true}).waitFor();
          assert.match(await panel(f.page).innerText(), /Fixture Bob.*FIXTURE-BOB/);
          assert.equal(await consent.isChecked(), false); assert(await submit.isDisabled());
        }
      } finally {await f.close();}
    }
  });
} finally {await browser.close(); await vite.close();}
console.log(`Reviewer display coherence: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
