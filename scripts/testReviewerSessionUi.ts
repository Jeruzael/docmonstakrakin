import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import {chromium, type Page} from 'playwright';

// Exercise the real component and browser events. Fetch alone is deferred so
// replies can arrive after newer actions; abort is deliberately ineffective.
// No server, reviewer roster, cookie, application store or operator data is used.
const bundle = await build({
  stdin: {resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {ReviewerSession} from './src/components/ReviewerSession.tsx';
    let root;
    const pending = [], bodies = [];
    window.reviewerFixture = {
      requests: [],
      mount(strict = false) {
        root = createRoot(document.getElementById('root'));
        root.render(strict ? <React.StrictMode><ReviewerSession /></React.StrictMode> : <ReviewerSession />);
      },
      unmount() { root.unmount(); },
      headers(index) {
        const request = pending[index];
        if (!request || request.done) throw new Error('Invalid fixture headers');
        request.done = true;
        request.resolve(new Response(new ReadableStream({start(controller) {bodies[index] = controller;}}), {
          status: 200, headers: {'Content-Type': 'application/json'},
        }));
      },
      body(index, value) {
        bodies[index].enqueue(new TextEncoder().encode(JSON.stringify(value)));
        bodies[index].close();
      },
      reply(index, response) {
        const request = pending[index];
        if (!request || request.done) throw new Error('Invalid fixture reply');
        request.done = true;
        if (response.networkError) request.reject(new TypeError('Synthetic network failure'));
        else request.resolve(new Response(response.raw ?? JSON.stringify(response.body), {
          status: response.status ?? 200, headers: {'Content-Type': 'application/json'},
        }));
      },
    };
    window.fetch = (url, init = {}) => {
      const record = {url: String(url), method: init.method ?? 'GET',
        body: init.body ?? null, credentials: init.credentials ?? null, aborted: init.signal?.aborted ?? false};
      window.reviewerFixture.requests.push(record);
      init.signal?.addEventListener('abort', () => {record.aborted = true;});
      return new Promise((resolve, reject) => pending.push({resolve, reject, done: false}));
    };
  `},
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: {'process.env.NODE_ENV': '"development"'}, logLevel: 'silent',
});
interface SessionRequest {url: string; method: string; body: string | null; credentials: string | null; aborted: boolean}
interface Reply {status?: number; body?: unknown; raw?: string; networkError?: boolean}
declare global {
  interface Window {
    reviewerFixture: {
      requests: SessionRequest[];
      mount: (strict?: boolean) => void;
      unmount: () => void;
      headers: (index: number) => void;
      body: (index: number, value: unknown) => void;
      reply: (index: number, response: Reply) => void;
    };
  }
}
const alice = {id: 'SYNTHETIC-ALICE-ID', name: 'Synthetic Alice', roles: ['Security Officer'], kind: 'HUMAN', roleSource: 'LOCAL_SERVER_ROSTER'};
const bob = {id: 'SYNTHETIC-BOB-ID', name: 'Synthetic Bob', roles: ['Lead Architect'], kind: 'HUMAN', roleSource: 'LOCAL_SERVER_ROSTER'};
const executable = process.env.DMK_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(candidate => fs.existsSync(candidate));
const browser = await chromium.launch({headless: true, ...(executable ? {executablePath: executable} : {})});
let passed = 0, failed = 0;
const flush = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
async function reply(page: Page, index: number, response: Reply) {
  await page.evaluate(({index, response}) => window.reviewerFixture.reply(index, response), {index, response});
  await flush(page);
}
async function fixture(run: (page: Page) => Promise<void>, strict = false, timed = false) {
  const page = await browser.newPage();
  page.setDefaultTimeout(1500);
  const errors: string[] = [], network: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {network.push(route.request().url()); return route.abort();});
  try {
    await page.setContent('<div id="root"></div>');
    if (timed) await page.clock.install();
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.evaluate(strict => window.reviewerFixture.mount(strict), strict);
    await page.waitForFunction(count => window.reviewerFixture.requests.length === count, strict ? 2 : 1);
    await run(page);
    assert.deepEqual(errors, [], 'No uncaught browser or React error');
    assert.deepEqual(network, [], 'No actual network request');
  } finally {await page.close();}
}
async function test(name: string, run: () => Promise<void>) {
  try {await run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${(error as Error).message}`);}
}
async function signIn(page: Page) {
  await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).click();
  await page.getByLabel('Reviewer username', {exact: true}).fill('synthetic-user');
  await page.getByLabel('Reviewer password', {exact: true}).fill('fixture-only-password');
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
}
async function assertIdentity(page: Page, name: string) {
  assert.equal(await page.locator('strong').innerText(), name);
  assert.equal(await page.getByRole('button', {name: 'Sign out', exact: true}).count(), 1);
}
async function assertUnknown(page: Page) {
  assert.equal(await page.getByRole('alert').count(), 1, 'A failed or invalid response must be visible');
  assert.match(await page.getByRole('alert').innerText(), /could not be confirmed|could not confirm|unavailable/i);
}
async function assertLogoutUnconfirmed(page: Page) {
  await assertIdentity(page, alice.name);
  await assertUnknown(page);
  assert.match(await page.locator('#root').innerText(), /last confirmed/i, 'Retained identity must not imply a currently confirmed session');
  assert.equal(await page.getByRole('button', {name: 'Sign out', exact: true}).isEnabled(), true, 'A failed logout can be retried');
}
try {
  await test('S1 delayed initial signed-out reply cannot erase a completed sign-in', () => fixture(async page => {
    await signIn(page);
    await reply(page, 1, {body: {identity: alice}});
    await assertIdentity(page, alice.name);
    await reply(page, 0, {body: {identity: null}});
    await assertIdentity(page, alice.name);
  }));
  await test('S2 delayed initial identity cannot resurrect a completed sign-out', () => fixture(async page => {
    await signIn(page);
    await reply(page, 1, {body: {identity: alice}});
    await page.getByRole('button', {name: 'Sign out', exact: true}).click();
    await reply(page, 2, {body: {identity: null}});
    await reply(page, 0, {body: {identity: bob}});
    assert.equal(await page.locator('strong').count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).count(), 1);
  }));
  await test('S3 non-success GET cannot admit an otherwise plausible identity', () => fixture(async page => {
    await reply(page, 0, {status: 500, body: {identity: alice}});
    assert.equal(await page.locator('strong').count(), 0);
    await assertUnknown(page);
  }));
  await test('S4 malformed GET identities fail safely without rendering invalid roles', async () => {
    for (const body of [{identity: {...alice, roles: 'Security Officer'}}, {}, {identity: {}}, {identity: {...alice, name: ''}}, {identity: {...alice, name: 7}}, {identity: {...alice, roles: [7]}}]) {
      await fixture(async page => {
        await reply(page, 0, {body});
        assert.equal(await page.locator('strong').count(), 0);
        await assertUnknown(page);
      });
    }
  });
  await test('S5 successful HTTP POST still requires a valid non-null session response', async () => {
    for (const response of [{body: {identity: null}}, {body: {identity: {...alice, roles: [7]}}}, {body: {}}, {raw: '<html>invalid JSON</html>'}]) {
      await fixture(async page => {
        await reply(page, 0, {body: {identity: null}});
        await signIn(page);
        await reply(page, 1, response);
        assert.equal(await page.locator('strong').count(), 0);
        await assertUnknown(page);
        assert.equal(await page.getByLabel('Reviewer password', {exact: true}).inputValue(), '');
      });
    }
  });
  await test('S6 rejected sign-in clears passwords and reports bounded errors without trusting response text', async () => {
    for (const response of [
      {status: 401, body: {error: 'Invalid reviewer credentials'}},
      {status: 403, body: {error: 'Cross-origin sign-in rejected'}},
      {status: 429, body: {error: 'Too many failed sign-in attempts; retry in 15 minutes'}},
      {status: 500, body: {error: 'fixture-only-password'}},
      {status: 500, body: {error: {arbitrary: 'object'}}},
      {networkError: true},
    ]) {
      await fixture(async page => {
        await reply(page, 0, {body: {identity: null}});
        await signIn(page);
        await reply(page, 1, response);
        assert.equal(await page.locator('strong').count(), 0);
        assert.equal(await page.getByRole('alert').count(), 1);
        assert.doesNotMatch(await page.locator('#root').innerText(), /fixture-only-password|\[object Object\]/);
        assert.equal(await page.getByLabel('Reviewer password', {exact: true}).inputValue(), '');
        assert.equal(await page.getByRole('button', {name: 'Sign in', exact: true}).isEnabled(), true);
      });
    }
  });
  await test('S7 same-turn repeated submits send only one sign-in mutation', () => fixture(async page => {
    await reply(page, 0, {body: {identity: null}});
    await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).click();
    await page.getByLabel('Reviewer username', {exact: true}).fill('synthetic-user');
    await page.getByLabel('Reviewer password', {exact: true}).fill('fixture-only-password');
    await page.locator('form').evaluate(form => {
      form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
      form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    });
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests.filter(r => r.method === 'POST').length), 1);
    await reply(page, 1, {body: {identity: alice}});
    await assertIdentity(page, alice.name);
  }));
  await test('S8 pending sign-in disables editing, form toggle and submit until completion', () => fixture(async page => {
    await signIn(page);
    assert.equal(await page.getByLabel('Reviewer username', {exact: true}).isDisabled(), true);
    assert.equal(await page.getByLabel('Reviewer password', {exact: true}).isDisabled(), true);
    assert.equal(await page.getByRole('button', {name: 'Sign in', exact: true}).isDisabled(), true);
    assert.equal(await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).isDisabled(), true);
    await reply(page, 1, {status: 401, body: {error: 'Invalid reviewer credentials'}});
    assert.equal(await page.getByLabel('Reviewer username', {exact: true}).isEnabled(), true);
    assert.equal(await page.getByLabel('Reviewer password', {exact: true}).inputValue(), '');
  }));
  await test('S9 failed HTTP logout retains last confirmed identity with visible uncertainty', async () => {
    for (const status of [403, 500]) await fixture(async page => {
      await reply(page, 0, {body: {identity: alice}});
      await page.getByRole('button', {name: 'Sign out', exact: true}).click();
      await reply(page, 1, {status, body: {error: 'Synthetic logout rejection'}});
      await assertLogoutUnconfirmed(page);
    });
  });
  await test('S10 lost or malformed logout responses cannot claim successful logout', async () => {
    for (const response of [{networkError: true}, {raw: '<html>invalid JSON</html>'}, {body: {}}, {body: {identity: bob}}]) {
      await fixture(async page => {
        await reply(page, 0, {body: {identity: alice}});
        await page.getByRole('button', {name: 'Sign out', exact: true}).click();
        await reply(page, 1, response);
        await assertLogoutUnconfirmed(page);
      });
    }
  });
  await test('S11 repeated logout clicks send one DELETE and confirmed logout clears identity', () => fixture(async page => {
    await reply(page, 0, {body: {identity: alice}});
    await page.getByRole('button', {name: 'Sign out', exact: true}).evaluate(button => {
      button.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      button.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests.filter(r => r.method === 'DELETE').length), 1);
    assert.equal(await page.getByRole('button', {name: 'Sign out', exact: true}).isDisabled(), true);
    await reply(page, 1, {body: {identity: null}});
    assert.equal(await page.locator('strong').count(), 0);
    assert.equal(await page.getByRole('alert').count(), 0);
  }));
  await test('S12 unmounted requests cannot replace the next mounted component identity', () => fixture(async page => {
    await page.evaluate(() => {window.reviewerFixture.unmount(); window.reviewerFixture.mount();});
    await page.waitForFunction(() => window.reviewerFixture.requests.length === 2);
    await reply(page, 1, {body: {identity: bob}});
    await reply(page, 0, {body: {identity: alice}});
    await assertIdentity(page, bob.name);
  }));
  await test('S13 Strict Mode effect cleanup fences the obsolete first GET reply', () => fixture(async page => {
    await reply(page, 1, {body: {identity: bob}});
    await reply(page, 0, {body: {identity: alice}});
    await assertIdentity(page, bob.name);
  }, true));
  await test('S14 display-only fields and session request contract preserve server authority', () => fixture(async page => {
    await reply(page, 0, {body: {identity: null}});
    await signIn(page);
    const requests = await page.evaluate(() => window.reviewerFixture.requests);
    assert.deepEqual(requests.map(r => [r.url, r.method]), [['/api/governance/session', 'GET'], ['/api/governance/session', 'POST']]);
    const submitted = JSON.parse(requests[1].body!);
    assert.deepEqual(Object.keys(submitted).sort(), ['password', 'username']);
    assert.equal(submitted.username, 'synthetic-user');
    assert.equal(submitted.password === 'fixture-only-password', true);
    await reply(page, 1, {body: {identity: alice}});
    await assertIdentity(page, alice.name);
    const text = await page.locator('#root').innerText();
    assert.match(text, /Security Officer/);
    assert.doesNotMatch(text, /SYNTHETIC-ALICE-ID|LOCAL_SERVER_ROSTER|fixture-only-password/);
  }));
  await test('S15 failed initial reads expose unknown session status instead of silently swallowing failure', async () => {
    for (const response of [{networkError: true}, {raw: '<html>invalid JSON</html>'}]) await fixture(async page => {
      await reply(page, 0, response);
      await assertUnknown(page);
      assert.equal(await page.getByRole('button', {name: 'Sign in for governance review', exact: true}).isEnabled(), true);
    });
  });
  await test('S16 held initial GET times out and cannot replace a later confirmed sign-in', () => fixture(async page => {
    await page.clock.fastForward(20_001);
    await flush(page);
    await assertUnknown(page);
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests[0].aborted), true);
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests.length), 1, 'Timeout must not retry');
    await signIn(page);
    await reply(page, 1, {body: {identity: bob}});
    await reply(page, 0, {body: {identity: alice}});
    await assertIdentity(page, bob.name);
  }, false, true));
  await test('S17 held POST releases controls and password at deadline without accepting its late result', () => fixture(async page => {
    await reply(page, 0, {body: {identity: null}});
    await signIn(page);
    await page.clock.fastForward(20_001);
    await flush(page);
    await assertUnknown(page);
    assert.equal(await page.getByLabel('Reviewer password', {exact: true}).inputValue(), '');
    assert.equal(await page.getByRole('button', {name: 'Sign in', exact: true}).isEnabled(), true);
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests[1].aborted), true);
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests.length), 2, 'Timeout must not retry credentials');
    await page.getByLabel('Reviewer password', {exact: true}).fill('fixture-only-password');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await reply(page, 2, {body: {identity: bob}});
    await reply(page, 1, {body: {identity: alice}});
    await assertIdentity(page, bob.name);
  }, false, true));
  await test('S18 held DELETE reports unknown outcome and its late reply cannot erase a subsequent sign-in', () => fixture(async page => {
    await reply(page, 0, {body: {identity: alice}});
    await page.getByRole('button', {name: 'Sign out', exact: true}).click();
    await page.clock.fastForward(20_001);
    await flush(page);
    await assertLogoutUnconfirmed(page);
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests[1].aborted), true);
    assert.equal(await page.evaluate(() => window.reviewerFixture.requests.length), 2, 'Timeout must not retry logout');
    await page.getByRole('button', {name: 'Sign out', exact: true}).click();
    await reply(page, 2, {body: {identity: null}});
    await signIn(page);
    await reply(page, 3, {body: {identity: bob}});
    await reply(page, 1, {body: {identity: null}});
    await assertIdentity(page, bob.name);
  }, false, true));
  await test('S19 GET POST and DELETE deadlines include response bodies that never finish', async () => {
    for (const method of ['GET', 'POST', 'DELETE']) await fixture(async page => {
      const index = method === 'GET' ? 0 : 1;
      if (method !== 'GET') {
        await reply(page, 0, {body: {identity: method === 'DELETE' ? alice : null}});
        if (method === 'POST') await signIn(page);
        else await page.getByRole('button', {name: 'Sign out', exact: true}).click();
      }
      await page.evaluate(index => window.reviewerFixture.headers(index), index);
      await page.clock.fastForward(20_001);
      await flush(page);
      await assertUnknown(page);
      assert.equal(await page.evaluate(index => window.reviewerFixture.requests[index].aborted, index), true);
      if (method === 'POST') assert.equal(await page.getByLabel('Reviewer password', {exact: true}).inputValue(), '');
      await page.evaluate(({index, body}) => window.reviewerFixture.body(index, body), {index, body: {identity: method === 'DELETE' ? null : alice}});
      await flush(page);
      if (method === 'DELETE') await assertLogoutUnconfirmed(page);
      else assert.equal(await page.locator('strong').count(), 0, 'Late body must not confirm identity');
    }, false, true);
  });
} finally {await browser.close();}
console.log(`Reviewer session UI: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
