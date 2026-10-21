import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import {chromium, type Page} from 'playwright';
import {INITIAL_PROJECTS} from '../src/data/initialData.ts';
import {DISCOVERY_QUESTION_CATALOG} from '../src/data/discoveryCatalog.ts';
import {normalizeTechnicalBaseline} from '../src/data/projectInitialization.ts';
import type {Project, Question} from '../src/types.ts';

// Mount the real component and exercise real browser events. Persistence is a
// deliberately held callback, not an HTTP route or a claim of server idempotency.
const bundle = await build({
  stdin: {resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {QuestionnaireView} from './src/components/QuestionnaireView.tsx';
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const deadlines = new Map();
    window.setTimeout = (handler, delay, ...args) => {
      const id = nativeSetTimeout(handler, delay === 20000 ? 60000 : delay, ...args);
      if (delay === 20000) deadlines.set(id, () => handler(...args));
      return id;
    };
    window.clearTimeout = id => { deadlines.delete(id); nativeClearTimeout(id); };
    const calls = [];
    let root;
    window.saveFixture = {
      calls, deadlineCount: () => deadlines.size,
      expire() {
        const pending = [...deadlines];
        if (!pending.length) throw new Error('A 20000ms UI deadline must be registered');
        pending.forEach(([id, fire]) => {window.clearTimeout(id); fire();});
      },
      settle(index, message) {
        const call = calls[index];
        if (!call) throw new Error('Missing pending persistence call');
        if (message) call.reject(new Error(message)); else call.resolve();
      },
      unmount() {root.unmount();},
      mount(fixture) {
        root = createRoot(document.getElementById('root'));
        root.render(<QuestionnaireView project={fixture.project} questions={fixture.questions}
          onOpenOverrideModal={() => {throw new Error('Governance actions are outside this fixture');}}
          onAnswerQuestion={(id, answer, state, justification) => new Promise((resolve, reject) => {
            calls.push({id, answer, state, justification, resolve, reject});
          })} />);
      },
    };
  `},
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: {'process.env.NODE_ENV': '"development"'}, logLevel: 'silent',
});
interface AnswerCall {id: string; answer: unknown; state: string; justification: string}
interface Fixture {project: Project; questions: Question[]}
declare global {
  interface Window {
    saveFixture: {
      calls: AnswerCall[];
      mount: (input: Fixture) => void;
      unmount: () => void;
      settle: (index: number, message?: string) => void;
      expire: () => void;
      deadlineCount: () => number;
    };
  }
}
const project: Project = {
  ...structuredClone(INITIAL_PROJECTS[0]), id: 'PRJ-SAVE-SEQUENCING-SYNTHETIC',
  name: 'Synthetic pending discovery', profiles: ['WEB_APPLICATION'], specializedProfiles: [],
  maturity: 'GREENFIELD',
  technicalBaseline: normalizeTechnicalBaseline({sourceControl: {
    type: 'USER_SPECIFIED', userValue: 'Local Git', finalSelection: 'Local Git',
  }} as Project['technicalBaseline']),
};
function question(id: string, overrides: Partial<Question> = {}): Question {
  const source = DISCOVERY_QUESTION_CATALOG.find(q => q.id === id);
  assert(source, `Known catalog question ${id}`);
  return {...structuredClone(source), state: 'UNRESOLVED', answer: '', justification: '', ...overrides};
}
const freeQuestion = (id: string) => question('PROD-Q-003', {
  id, question: `Synthetic statement ${id}`, answerType: 'FREE_TEXT',
});
const justification = 'Record architectural reasoning or risk justification for this selection...';
const naPlaceholder = 'e.g., Single-node local utility does not require distributed CRDT replication...';
const executable = process.env.DMK_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(candidate => fs.existsSync(candidate));
const browser = await chromium.launch({headless: true, ...(executable ? {executablePath: executable} : {})});
let passed = 0;
let failed = 0;
const outcomes: Array<{name: string; status: string; error?: string}> = [];
const calls = (page: Page) => page.evaluate(() => window.saveFixture.calls.map(({id, answer, state, justification}) => ({id, answer, state, justification})));
const flush = (page: Page) => page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
async function settle(page: Page, index: number, message?: string) {
  await page.evaluate(({index, message}) => window.saveFixture.settle(index, message), {index, message});
  await flush(page);
}
async function fixture(questions: Question[], run: (page: Page) => Promise<void>) {
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {requests.push(route.request().url()); return route.abort();});
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.evaluate(input => window.saveFixture.mount(input), {project, questions});
    await page.getByRole('heading', {name: questions[0].question, exact: true}).waitFor();
    await run(page);
    assert.deepEqual(errors, [], 'No browser runtime error or unhandled rejection');
    assert.deepEqual(requests, [], 'No network request or live service');
  } finally {await page.close();}
}
async function test(name: string, run: () => Promise<void>) {
  try {await run(); passed++; outcomes.push({name, status: 'PASS'}); console.log(`PASS ${name}`);}
  catch (error) {failed++; outcomes.push({name, status: 'FAIL', error: (error as Error).message}); console.error(`FAIL ${name}: ${(error as Error).message}`);}
}
async function saveText(page: Page, text = 'Retain this complete draft') {
  await page.getByPlaceholder('Type statement here...').fill(text);
  await page.getByPlaceholder(justification).fill('Explicit synthetic reasoning');
  await page.getByRole('button', {name: 'Save Statement', exact: true}).click();
}
try {
  await test('S1 two same-turn numeric presets admit one save and retain its selected draft', () => fixture([question('DATA-Q-009')], async page => {
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      buttons.find(button => button.textContent?.includes('30 Days (Rolling'))!.click();
      buttons.find(button => button.textContent?.includes('90 Days (Quarterly'))!.click();
    });
    assert.deepEqual(await calls(page), [{id: 'DATA-Q-009', answer: 30, state: 'ANSWERED', justification: ''}]);
    assert.equal(await page.getByPlaceholder('Enter numerical quantity...').inputValue(), '30');
    await settle(page, 0);
    assert.equal(await page.getByPlaceholder('Enter numerical quantity...').isEnabled(), true);
  }));
  await test('S2 pending div-based technology preset cannot change draft or submit again', () => fixture([question('TECH-Q-001')], async page => {
    await page.getByText('TypeScript / Node.js 20+ (Strict Type Checking)', {exact: true}).click();
    await page.getByText('Go (Golang 1.22+) Compiled Binary', {exact: true}).click();
    assert.equal((await calls(page)).length, 1);
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').inputValue(), 'typescript_node');
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').isDisabled(), true);
    await settle(page, 0, 'Synthetic unavailable');
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').isEnabled(), true);
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').inputValue(), 'typescript_node');
  }));
  await test('S3 pending answer and reasoning controls disable while navigation remains available', () => fixture([freeQuestion('A'), freeQuestion('B')], async page => {
    await saveText(page);
    assert.equal(await page.getByPlaceholder('Type statement here...').isDisabled(), true);
    assert.equal(await page.getByPlaceholder(justification).isDisabled(), true);
    assert.equal(await page.getByRole('button', {name: 'Mark Not Applicable', exact: true}).isDisabled(), true);
    assert.equal(await page.getByRole('button', {name: 'Next Question', exact: true}).isEnabled(), true);
  }));
  await test('S4 failure retains answer and reasoning, exposes error, and allows one successful manual retry', () => fixture([freeQuestion('A')], async page => {
    await saveText(page);
    await settle(page, 0, 'Synthetic persistence rejected this answer');
    await page.getByText('Synthetic persistence rejected this answer', {exact: true}).waitFor();
    assert.equal(await page.getByPlaceholder('Type statement here...').inputValue(), 'Retain this complete draft');
    assert.equal(await page.getByPlaceholder(justification).inputValue(), 'Explicit synthetic reasoning');
    await page.getByRole('button', {name: 'Save Statement', exact: true}).click();
    await settle(page, 1);
    const saved = await calls(page);
    assert.deepEqual(saved, Array(2).fill({id: 'A', answer: 'Retain this complete draft', state: 'ANSWERED', justification: 'Explicit synthetic reasoning'}));
    assert.equal(await page.getByText('Synthetic persistence rejected this answer', {exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Save Statement', exact: true}).isEnabled(), true);
  }));
  await test('S5 a late failure for A cannot enter B and still releases the outstanding save lock', () => fixture([freeQuestion('A'), freeQuestion('B')], async page => {
    await saveText(page);
    await page.getByRole('button', {name: 'Next Question', exact: true}).click();
    await settle(page, 0, 'Stale A failure');
    assert.equal(await page.getByText('Stale A failure', {exact: true}).count(), 0);
    await saveText(page, 'Question B draft');
    await settle(page, 1);
    assert.equal((await calls(page))[1].id, 'B');
  }));
  await test('S6 A to B to A navigation invalidates feedback from the first visit', () => fixture([freeQuestion('A'), freeQuestion('B')], async page => {
    await saveText(page);
    await page.getByRole('button', {name: 'Next Question', exact: true}).click();
    await page.getByRole('button', {name: 'Previous', exact: true}).click();
    await settle(page, 0, 'Obsolete first-visit error');
    assert.equal(await page.getByText('Obsolete first-visit error', {exact: true}).count(), 0);
    assert.equal(await page.getByPlaceholder('Type statement here...').isEnabled(), true);
  }));
  await test('S7 rejected Not Applicable retains its justification and only closes after acknowledged retry', () => fixture([freeQuestion('A')], async page => {
    await page.getByRole('button', {name: 'Mark Not Applicable', exact: true}).click();
    await page.getByPlaceholder(naPlaceholder).fill('  No distributed component exists in this scope.  ');
    await page.getByRole('button', {name: 'Confirm Not Applicable', exact: true}).click();
    await settle(page, 0, 'Synthetic scope rejection');
    assert.equal(await page.getByPlaceholder(naPlaceholder).count(), 1, 'Failed save must keep the dialog open');
    assert.equal(await page.getByPlaceholder(naPlaceholder).inputValue(), '  No distributed component exists in this scope.  ');
    assert.equal(await page.getByText('Synthetic scope rejection', {exact: true}).last().isVisible(), true);
    await page.getByRole('button', {name: 'Confirm Not Applicable', exact: true}).click();
    await settle(page, 1);
    assert.equal(await page.getByPlaceholder(naPlaceholder).count(), 0);
    assert.deepEqual(await calls(page), Array(2).fill({id: 'A', answer: 'NOT_APPLICABLE', state: 'NOT_APPLICABLE', justification: 'No distributed component exists in this scope.'}));
  }));
  await test('S8 pending Not Applicable inputs disable and question navigation cannot reuse its modal', () => fixture([freeQuestion('A'), freeQuestion('B')], async page => {
    await page.getByRole('button', {name: 'Mark Not Applicable', exact: true}).click();
    await page.getByPlaceholder(naPlaceholder).fill('Synthetic scope justification');
    await page.getByRole('button', {name: 'Confirm Not Applicable', exact: true}).click();
    assert.equal(await page.getByPlaceholder(naPlaceholder).isDisabled(), true);
    assert.equal(await page.getByRole('button', {name: 'Cancel', exact: true}).isDisabled(), true);
    // Deliberately exercise a background keyboard/programmatic navigation path.
    await page.getByRole('button', {name: 'Next Question', exact: true}).evaluate((button: HTMLButtonElement) => button.click());
    await settle(page, 0, 'Stale modal failure');
    assert.equal(await page.getByPlaceholder(naPlaceholder).count(), 0);
    assert.equal(await page.getByText('Stale modal failure', {exact: true}).count(), 0);
  }));
  await test('S9 a held save reaches a bounded uncertain-outcome deadline without retry or late feedback', () => fixture([freeQuestion('A')], async page => {
    await saveText(page);
    assert.equal(await page.evaluate(() => window.saveFixture.deadlineCount()), 1, 'Register the explicit 20-second UI deadline');
    await page.evaluate(() => window.saveFixture.expire());
    await flush(page);
    const uncertain = page.getByText(/Could not confirm.*20 seconds.*Refresh.*before retrying/);
    await uncertain.waitFor();
    assert.equal(await page.getByPlaceholder('Type statement here...').inputValue(), 'Retain this complete draft');
    assert.equal(await page.getByPlaceholder(justification).inputValue(), 'Explicit synthetic reasoning');
    assert.equal(await page.getByPlaceholder('Type statement here...').isEnabled(), true);
    assert.equal((await calls(page)).length, 1, 'Timeout must not automatically resubmit');
    await page.getByPlaceholder('Type statement here...').fill('Edited after uncertain outcome');
    await settle(page, 0, 'Late persistence failure');
    assert.equal(await uncertain.count(), 1);
    assert.equal(await page.getByText('Late persistence failure', {exact: true}).count(), 0);
    assert.equal(await page.getByPlaceholder('Type statement here...').inputValue(), 'Edited after uncertain outcome');
  }));
  await test('S10 late success after timeout cannot unlock a newer manual save', () => fixture([freeQuestion('A')], async page => {
    await saveText(page);
    assert.equal(await page.evaluate(() => window.saveFixture.deadlineCount()), 1);
    await page.evaluate(() => window.saveFixture.expire());
    await flush(page);
    await page.getByRole('button', {name: 'Save Statement', exact: true}).click();
    await settle(page, 0);
    assert.equal(await page.getByPlaceholder('Type statement here...').isDisabled(), true);
    assert.equal((await calls(page)).length, 2);
    await settle(page, 1);
    assert.equal(await page.getByPlaceholder('Type statement here...').isEnabled(), true);
    assert.equal(await page.evaluate(() => window.saveFixture.deadlineCount()), 0);
  }));
  await test('S11 unmount clears deadline and late callback cannot enter a remounted component', () => fixture([freeQuestion('A')], async page => {
    await saveText(page);
    await page.evaluate(() => window.saveFixture.unmount());
    assert.equal(await page.evaluate(() => window.saveFixture.deadlineCount()), 0);
    await page.evaluate(input => window.saveFixture.mount(input), {project: {...project, id: 'PRJ-SECOND-SYNTHETIC'}, questions: [freeQuestion('B')]});
    await page.getByRole('heading', {name: 'Synthetic statement B', exact: true}).waitFor();
    await settle(page, 0, 'Unmounted A error');
    assert.equal(await page.getByText('Unmounted A error', {exact: true}).count(), 0);
    await saveText(page, 'Independent B draft');
    await settle(page, 1);
    assert.equal((await calls(page))[1].id, 'B');
  }));
} finally {await browser.close();}
if (process.env.DMK_TEST_RESULT_PATH) fs.writeFileSync(process.env.DMK_TEST_RESULT_PATH, JSON.stringify({passed, failed, outcomes}, null, 2));
console.log(`Discovery save sequencing: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
