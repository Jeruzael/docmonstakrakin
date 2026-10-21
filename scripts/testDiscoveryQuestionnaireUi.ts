import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import {chromium, type Page} from 'playwright';
import {INITIAL_PROJECTS} from '../src/data/initialData.ts';
import {DISCOVERY_QUESTION_CATALOG} from '../src/data/discoveryCatalog.ts';
import {normalizeTechnicalBaseline} from '../src/data/projectInitialization.ts';
import type {Project, Question, TechChoice} from '../src/types.ts';

// Actual React component, browser events and effects; only its persistence callback
// is an in-memory fixture. No HTTP server, application store or operator data.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: 'tsx',
    contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {QuestionnaireView} from './src/components/QuestionnaireView.tsx';
      window.discoveryFixture = {answers: [], mount(fixture) {
        function Harness() {
          const [questions, setQuestions] = useState(fixture.questions);
          return <QuestionnaireView project={fixture.project} questions={questions}
            onOpenOverrideModal={() => {throw new Error('Fixture must not invoke governance actions');}}
            onAnswerQuestion={async (id, answer, state, justification) => {
              window.discoveryFixture.answers.push({id, answer, state, justification});
              setQuestions(previous => previous.map(q => q.id === id
                ? {...q, answer, state, justification} : q));
            }} />;
        }
        createRoot(document.getElementById('root')).render(<Harness />);
      }};
    `,
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: {'process.env.NODE_ENV': '"development"'}, logLevel: 'silent',
});
interface AnswerCall {id: string; answer: unknown; state: string; justification: string}
interface Fixture {project: Project; questions: Question[]}
declare global {
  interface Window {
    discoveryFixture: {answers: AnswerCall[]; mount: (fixture: Fixture) => void};
  }
}
const project: Project = {
  ...structuredClone(INITIAL_PROJECTS[0]),
  id: 'PRJ-QUESTIONNAIRE-SYNTHETIC', name: 'Synthetic questionnaire project',
  description: 'Local fixture only', owner: 'Synthetic operator', profiles: ['WEB_APPLICATION'],
  specializedProfiles: [], maturity: 'GREENFIELD',
  productBaseline: {
    problemStatement: 'Track a synthetic local workflow', targetUsers: [], coreCapabilities: [],
    coreFeatures: [], primaryWorkflows: [], nonGoals: [], successCriteria: [],
  },
  technicalBaseline: normalizeTechnicalBaseline({sourceControl: {
    type: 'USER_SPECIFIED', userValue: 'Local Git', finalSelection: 'Local Git',
  }} as Project['technicalBaseline']),
};
function question(id: string, overrides: Partial<Question> = {}): Question {
  const source = DISCOVERY_QUESTION_CATALOG.find(q => q.id === id);
  assert(source, `Known catalog question ${id}`);
  return {...structuredClone(source), state: 'UNRESOLVED', answer: '', justification: '', ...overrides};
}
const productQuestion = () => question('PROD-Q-001');
const technicalQuestion = (overrides: Partial<Question> = {}) => question('TECH-Q-001', overrides);
const freeQuestion = (id: string, state: Question['state'] = 'UNRESOLVED'): Question =>
  question('PROD-Q-003', {id, question: `Synthetic statement ${id}`, answerType: 'FREE_TEXT', state, answer: state === 'ANSWERED' ? 'Saved statement' : ''});
const executable = process.env.DMK_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(candidate => fs.existsSync(candidate));
const browser = await chromium.launch({headless: true, ...(executable ? {executablePath: executable} : {})});
let passed = 0;
let failed = 0;
async function fixture(questions: Question[], run: (page: Page) => Promise<void>, fixtureProject = project) {
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {requests.push(route.request().url()); return route.abort();});
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.evaluate(input => window.discoveryFixture.mount(input), {project: fixtureProject, questions});
    await page.getByRole('heading', {name: 'Adaptive Discovery & Derivation Workspace', exact: true}).waitFor();
    await run(page);
    assert.deepEqual(errors, [], 'No browser runtime errors');
    assert.deepEqual(requests, [], 'Fixture must make no network requests');
  } finally {
    await page.close();
  }
}
async function test(name: string, run: () => Promise<void>) {
  try {await run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${(error as Error).message}`);}
}
const position = (page: Page) => page.getByText(/^Question \d+ of \d+ in this view$/).innerText();
const readiness = (page: Page) => page.getByRole('heading', {name: 'Requirements Readiness', exact: true}).locator('..').innerText();
try {
  await test('D1 empty domain has no unrelated question or answer action', () => fixture([productQuestion(), technicalQuestion()], async page => {
    await page.getByRole('button', {name: /^Scope & Non-Goals/}).click();
    assert.equal(await page.getByText('No questions found for the selected domain or filter.', {exact: true}).count(), 1);
    assert.equal(await page.getByRole('heading', {name: productQuestion().question, exact: true}).count(), 0);
    assert.equal(await page.getByRole('button', {name: 'Next Question', exact: true}).count(), 0);
    assert.equal(await page.getByText(/^Question \d+ of 0 in this view$/).count(), 0);
  }));
  await test('D2 empty unresolved filter does not expose answered question', () => fixture([freeQuestion('ONE', 'ANSWERED')], async page => {
    await page.getByRole('button', {name: 'Unresolved', exact: true}).click();
    assert.equal(await page.getByText('No questions found for the selected domain or filter.', {exact: true}).count(), 1);
    assert.equal(await page.getByRole('button', {name: 'Save Statement', exact: true}).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.discoveryFixture.answers), []);
  }));
  await test('D3 shrinking filter clamps position and subsequent navigation', () => fixture([
    freeQuestion('ONE', 'ANSWERED'), freeQuestion('TWO', 'ANSWERED'), freeQuestion('THREE'),
  ], async page => {
    await page.getByRole('button', {name: 'Next Question', exact: true}).click();
    await page.getByRole('button', {name: 'Next Question', exact: true}).click();
    assert.equal(await position(page), 'Question 3 of 3 in this view');
    await page.getByRole('button', {name: 'Unresolved', exact: true}).click();
    assert.equal(await position(page), 'Question 1 of 1 in this view');
    await page.getByRole('button', {name: /^All \(/}).click();
    assert.equal(await position(page), 'Question 1 of 3 in this view');
    await page.getByRole('button', {name: 'Next Question', exact: true}).click();
    await page.getByRole('heading', {name: 'Synthetic statement TWO', exact: true}).waitFor();
  }));
  await test('T1 accepted recommendation survives save and question navigation', () => fixture([technicalQuestion(), freeQuestion('OTHER')], async page => {
    await page.getByRole('button', {name: 'Recommend For Me', exact: true}).click();
    await page.getByRole('button', {name: 'Accept Selection (Not Ratified)', exact: true}).click();
    const [saved] = await page.evaluate(() => window.discoveryFixture.answers);
    assert.deepEqual(saved.answer, {
      type: 'RECOMMEND_FOR_ME', decision_mode: 'RECOMMEND_FOR_ME',
      recommendation: {status: 'ACCEPTED', preferredTechnology: 'typescript_node'},
      finalSelection: 'typescript_node', status: 'NOT_RATIFIED',
    });
    await page.getByRole('button', {name: 'Next Question', exact: true}).click();
    await page.getByRole('button', {name: 'Previous', exact: true}).click();
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').count(), 0);
    assert.match(await page.getByRole('button', {name: 'Recommend For Me', exact: true}).getAttribute('class') || '', /bg-indigo-50/);
    assert.equal(await page.getByRole('button', {name: 'Accept Selection (Not Ratified)', exact: true}).count(), 1);
    assert.equal((await page.evaluate(() => window.discoveryFixture.answers)).length, 1, 'Navigation must not write an answer');
  }));
  await test('T2 legacy string selection remains editable without another save', () => fixture([technicalQuestion({state: 'ANSWERED', answer: 'rust'})], async page => {
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').inputValue(), 'rust');
    assert.equal(await page.getByText('Selected', {exact: true}).count(), 1);
    assert.deepEqual(await page.evaluate(() => window.discoveryFixture.answers), []);
  }));
  await test('T3 structured user selection restores final selection', () => fixture([technicalQuestion({state: 'ANSWERED', answer: {
    type: 'USER_SPECIFIED', decision_mode: 'USER_SPECIFIED', userValue: 'Custom local runtime',
    finalSelection: 'Custom local runtime', status: 'NOT_RATIFIED',
  } satisfies TechChoice})], async page => {
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').inputValue(), 'Custom local runtime');
    assert.deepEqual(await page.evaluate(() => window.discoveryFixture.answers), []);
  }));
  await test('T4 deferred legacy decision restores Unknown mode', () => fixture([technicalQuestion({state: 'DEFERRED', answer: 'undecided', justification: 'Await local compatibility review'})], async page => {
    assert.match(await page.getByRole('button', {name: 'Unknown / Defer', exact: true}).getAttribute('class') || '', /bg-amber-50/);
    assert.equal(await page.getByRole('button', {name: 'Mark as Deferred', exact: true}).count(), 1);
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.discoveryFixture.answers), []);
  }));
  await test('T5 structured catalog selection retains its selected option badge', () => fixture([technicalQuestion({state: 'ANSWERED', answer: {
    type: 'USER_SPECIFIED', decision_mode: 'USER_SPECIFIED', userValue: 'rust',
    finalSelection: 'rust', status: 'NOT_RATIFIED',
  } satisfies TechChoice})], async page => {
    assert.equal(await page.getByPlaceholder('Specify custom runtime/toolchain...').inputValue(), 'rust');
    assert.equal(await page.getByText('Selected', {exact: true}).count(), 1);
    assert.deepEqual(await page.evaluate(() => window.discoveryFixture.answers), []);
  }));
  await test('T6 stored non-first recommendation displays and reaccepts its saved technology', () => fixture([
    technicalQuestion({state: 'ANSWERED', answer: {
      type: 'RECOMMEND_FOR_ME', decision_mode: 'RECOMMEND_FOR_ME',
      recommendation: {status: 'ACCEPTED', preferredTechnology: 'rust', rationale: ['Existing local selection']},
      finalSelection: 'rust', status: 'NOT_RATIFIED',
    } satisfies TechChoice}), freeQuestion('OTHER'),
  ], async page => {
    assert.equal(await page.getByText('Rust 2021 Edition (Memory-Safe Native)', {exact: true}).count(), 1);
    await page.getByRole('button', {name: 'Accept Selection (Not Ratified)', exact: true}).click();
    const [saved] = await page.evaluate(() => window.discoveryFixture.answers);
    const answer = saved.answer as TechChoice;
    assert.equal(answer.finalSelection, 'rust');
    assert.equal(answer.recommendation?.preferredTechnology, 'rust');
    assert.deepEqual(answer.recommendation?.rationale, ['Existing local selection']);
    assert.equal(answer.status, 'NOT_RATIFIED');
    await page.getByRole('button', {name: 'Next Question', exact: true}).click();
    await page.getByRole('button', {name: 'Previous', exact: true}).click();
    assert.equal(await page.getByText('Rust 2021 Edition (Memory-Safe Native)', {exact: true}).count(), 1);
  }));
  await test('R1 readiness and domain counts include wizard-resolved mandatory answer', () => fixture([productQuestion(), technicalQuestion()], async page => {
    assert.match(await readiness(page), /50%/);
    assert.match(await page.getByText('Answered / Resolved:', {exact: true}).locator('..').innerText(), /1$/);
    assert.match(await page.getByRole('button', {name: /^Product Problem & Value/}).innerText(), /1\/1/);
    assert.equal(await page.getByRole('button', {name: 'Blockers (1)', exact: true}).count(), 1);
    await page.getByRole('button', {name: 'Blockers (1)', exact: true}).click();
    await page.getByRole('heading', {name: technicalQuestion().question, exact: true}).waitFor();
    assert.equal(await position(page), 'Question 1 of 1 in this view');
  }));
  await test('R2 optional open question does not dilute mandatory readiness', () => fixture([
    productQuestion(), freeQuestion('OPTIONAL'),
  ], async page => {
    assert.match(await readiness(page), /100%/);
    assert.equal(await page.getByRole('button', {name: 'Blockers (0)', exact: true}).count(), 1);
    assert.match(await page.getByRole('button', {name: /^Product Problem & Value/}).innerText(), /1\/2/);
  }));
  await test('R3 metadata-only prerequisite preserves readiness without a question override', () => fixture([
    productQuestion(),
  ], async page => {
    assert.match(await readiness(page), /50%/);
    assert.equal(await page.getByRole('button', {name: 'Blockers (0)', exact: true}).count(), 1);
    assert.equal(await page.getByRole('button', {name: 'Override Discovery Gate', exact: true}).count(), 0);
    assert.match(await page.getByText('Open project prerequisites:', {exact: true}).locator('..').innerText(), /1$/);
    await page.getByRole('button', {name: 'Blockers (0)', exact: true}).click();
    assert.equal(await page.getByText('No questions found for the selected domain or filter.', {exact: true}).count(), 1);
    assert.deepEqual(await page.evaluate(() => window.discoveryFixture.answers), []);
  }, {...project, technicalBaseline: normalizeTechnicalBaseline()}));
  await test('R4 mixed prerequisites count only question blockers in filter and override card', () => fixture([
    productQuestion(), technicalQuestion(),
  ], async page => {
    assert.match(await readiness(page), /25%/);
    assert.equal(await page.getByRole('button', {name: 'Blockers (1)', exact: true}).count(), 1);
    assert.equal(await page.getByRole('button', {name: 'Override Discovery Gate', exact: true}).count(), 1);
    assert.match(await page.getByText('Open project prerequisites:', {exact: true}).locator('..').innerText(), /2$/);
    await page.getByRole('button', {name: 'Blockers (1)', exact: true}).click();
    await page.getByRole('heading', {name: technicalQuestion().question, exact: true}).waitFor();
    assert.equal(await position(page), 'Question 1 of 1 in this view');
  }, {...project, maturity: undefined, technicalBaseline: normalizeTechnicalBaseline()}));
} finally {
  await browser.close();
}
console.log(`Discovery questionnaire UI: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
