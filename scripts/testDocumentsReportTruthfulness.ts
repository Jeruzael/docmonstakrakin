import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import {chromium, type Page} from 'playwright';
import {INITIAL_PROJECTS, INITIAL_REQUIREMENTS} from '../src/data/initialData.ts';

// Real React component, effects, rendering and export handlers. HTTP responses
// are fixture-only; the final lifecycle case holds a denied signoff response.
// No server, credential, successful mutation or application store exists.
const bundle = await build({
  stdin: {resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {DocumentsView} from './src/components/DocumentsView.tsx';
    const pending = [];
    const deniedSignoffs = [];
    const mutationAttempts = [];
    window.fetch = (url, options) => {
      if (options?.method && options.method !== 'GET') {
        mutationAttempts.push({url, method: options.method});
        if (window.reportFixture.allowDeniedSignoff && options.method === 'POST' && url === '/api/projects/PRJ-REPORT-A/release/signoff') {
          return new Promise(resolve => deniedSignoffs.push(resolve));
        }
        throw new Error('No mutation permitted');
      }
      if (!/^\\/api\\/projects\\/PRJ-REPORT-[AB]\\/release\\/gates$/.test(url)) throw new Error('Unexpected fixture URL: ' + url);
      // Deliberately ignore cancellation: request identity must reject late results.
      return new Promise((resolve, reject) => pending.push({url, resolve, reject}));
    };
    window.reportFixture = {
      pending, deniedSignoffs, mutationAttempts, allowDeniedSignoff: false, copied: '', downloads: [],
      settle(index, body, status = 200) {
        pending[index].resolve({ok: status >= 200 && status < 300, status, json: async () => body});
      },
      invalidJson(index) {pending[index].resolve({ok: true, json: async () => {throw new SyntaxError('invalid JSON');}});},
      denySignoff(index) {deniedSignoffs[index]({ok: false, status: 403, json: async () => ({error: 'Synthetic denial; no action executed'})});},
      mount(input) {
        function Harness() {
          const [props, setProps] = useState(input);
          window.reportFixture.update = next => setProps(previous => ({...previous, ...next}));
          return <DocumentsView {...props} />;
        }
        Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => {window.reportFixture.copied = text;}}});
        URL.createObjectURL = blob => {window.reportFixture.downloads.push(blob); return 'blob:synthetic-report';};
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = () => {};
        createRoot(document.getElementById('root')).render(<Harness />);
      },
    };
  `},
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: {'process.env.NODE_ENV': '"development"'}, logLevel: 'silent',
});
const projectA = {...structuredClone(INITIAL_PROJECTS[0]), id: 'PRJ-REPORT-A', name: 'Report A', stateVersion: 1,
  progress: {...INITIAL_PROJECTS[0].progress, releaseReadiness: 100}};
const projectB = {...structuredClone(projectA), id: 'PRJ-REPORT-B', name: 'Report B'};
const requirement = structuredClone(INITIAL_REQUIREMENTS[0]);
function report(projectId = projectA.id) {
  return {projectId, projectName: projectId === projectA.id ? 'Report A' : 'Report B', timestamp: '2026-10-21T12:00:00Z',
    targetMilestone: 'v0.1 Local-First MVP', allGatesPassed: false, releaseReady: false, signedOff: false,
    gates: Array.from({length: 7}, (_, index) => ({gateId: index + 1, code: `GATE-${index + 1}`, name: `Reported gate ${index + 1}`,
      status: index === 6 ? 'HUMAN_APPROVAL_REQUIRED' : index === 0 || index === 5 ? 'FAILED' : 'PASSED',
      details: `Fixture ${projectId} gate ${index + 1}`, blocking: true, evidenceLinks: []})),
    capabilities: [{capabilityId: 1, title: 'First capability', referenceDmk: 'DMK-017', status: 'VERIFIED', evidence: 'EV-TEST'},
      {capabilityId: 2, title: 'Second capability', referenceDmk: 'DMK-020', status: 'IMPLEMENTED', evidence: ''}],
    capabilitiesSummary: {total: 2, verified: 1, percentage: 50}, auditChainIntegrity: {valid: false, breaksCount: 1, eventsChecked: 3}};
}
const executable = process.env.DMK_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
const browser = await chromium.launch({headless: true, ...(executable ? {executablePath: executable} : {})});
let passed = 0, failed = 0;
const raw = (page: Page) => page.getByTestId('dynamic-projection-raw').innerText();
const settle = async (page: Page, index: number, body: unknown, status = 200) => {
  await page.evaluate(({index, body, status}) => (window as any).reportFixture.settle(index, body, status), {index, body, status});
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
};
async function fixture(run: (page: Page) => Promise<void>, requirements: unknown[] = [], expectsSyntheticDenial = false) {
  const page = await browser.newPage(); page.setDefaultTimeout(3000);
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {requests.push(route.request().url()); return route.abort();});
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.evaluate(input => (window as any).reportFixture.mount(input), {project: projectA, requirements});
    await page.getByRole('button', {name: 'Release Gates & DoD (REL)', exact: true}).waitFor();
    await page.getByTestId('projection-toggle-raw').click();
    await run(page);
    assert.deepEqual(errors, [], 'No browser rendering errors');
    assert.deepEqual(requests, [], 'No network or mutation request escaped the read-only fixture');
    assert.deepEqual(await page.evaluate(() => (window as any).reportFixture.mutationAttempts), expectsSyntheticDenial
      ? [{url: '/api/projects/PRJ-REPORT-A/release/signoff', method: 'POST'}] : [], 'Read-only navigation must not attempt a mutation');
  } finally {await page.close();}
}
async function test(name: string, run: () => Promise<void>) {
  try {await run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${(error as Error).message}`);}
}
const openRelease = async (page: Page) => {
  await page.getByRole('button', {name: 'Release Gates & DoD (REL)', exact: true}).click();
  await page.waitForFunction(() => (window as any).reportFixture.pending.length > 0);
};
try {
  await test('R1 missing report never infers signoff or verification from stored progress 100', () => fixture(async page => {
    await openRelease(page);
    const markdown = await raw(page);
    assert(!markdown.includes('APPROVED & SIGNED OFF'), 'Stored planning score must not sign a release');
    assert(!markdown.includes('Readiness: **100%**'), 'Missing capabilities cannot default to 100%');
    assert(!markdown.includes('**Chain Breaks Detected:** 0'), 'Missing audit cannot claim zero breaks');
    assert.equal(await page.getByText('All blocking discovery questions resolved.', {exact: true}).count(), 0, 'Missing report must not fabricate passed gates');
    assert.match(markdown, /LOADING|UNAVAILABLE/);
  }));
  await test('R2 failed HTTP evaluation is explicit and copy/export preserve unavailable state', () => fixture(async page => {
    await openRelease(page); await settle(page, 0, {error: 'Synthetic failure'}, 503);
    assert.match(await raw(page), /UNAVAILABLE/);
    await page.getByRole('button', {name: 'Copy Markdown', exact: true}).click();
    assert.match(await page.evaluate(() => (window as any).reportFixture.copied), /UNAVAILABLE/);
    await page.getByRole('button', {name: 'Export .md', exact: true}).click();
    assert.match(await page.evaluate(() => (window as any).reportFixture.downloads[0].text()), /UNAVAILABLE/);
    assert.equal(await page.getByRole('button', {name: 'Execute v0.1 DoD Sign-Off', exact: true}).count(), 0);
  }));
  await test('R3 actual incomplete report controls capability totals and audit failure in UI/export', () => fixture(async page => {
    await openRelease(page); await settle(page, 0, report());
    const markdown = await raw(page);
    assert.match(markdown, /50%/); assert.match(markdown, /1\/2/);
    assert.match(markdown, /\*\*Chain Breaks Detected:\*\* 1/);
    assert.equal(await page.getByText('100% Verified', {exact: true}).count(), 0);
    assert.equal(await page.getByText('0 Breaks', {exact: true}).count(), 0);
    assert(!markdown.includes('Zero Plaintext Secrets:** Enforced'), 'Evaluation cannot attest an unmeasured secret sweep');
  }));
  await test('R4 delayed project A response cannot replace project B report', () => fixture(async page => {
    await openRelease(page);
    await page.evaluate(project => (window as any).reportFixture.update({project}), projectB);
    await page.waitForFunction(() => (window as any).reportFixture.pending.length === 2);
    await settle(page, 1, report(projectB.id)); await settle(page, 0, report());
    assert.match(await raw(page), /Fixture PRJ-REPORT-B gate 1/);
    assert(!(await raw(page)).includes('Fixture PRJ-REPORT-A'), 'Late prior-project data must be discarded');
  }));
  await test('R5 stateVersion change invalidates current report and refetches before reuse', () => fixture(async page => {
    await openRelease(page); await settle(page, 0, report());
    await page.evaluate(project => (window as any).reportFixture.update({project}), {...projectA, stateVersion: 2});
    await page.waitForFunction(() => (window as any).reportFixture.pending.length === 2);
    assert(!(await raw(page)).includes('Fixture PRJ-REPORT-A gate 1'));
    assert.match(await raw(page), /LOADING|UNAVAILABLE/);
  }));
  await test('R6 malformed or wrong-project report cannot render release success', () => fixture(async page => {
    await openRelease(page); await settle(page, 0, {...report(projectB.id), signedOff: true});
    assert.match(await raw(page), /UNAVAILABLE/);
    assert(!(await raw(page)).includes('APPROVED & SIGNED OFF'));
  }));
  await test('R7 traceability separates approval status from evidence references', () => fixture(async page => {
    await page.getByRole('button', {name: 'Traceability Matrix (RTM)', exact: true}).click();
    const markdown = await raw(page);
    assert(!markdown.includes('Verified Requirements'), 'Approval and arbitrary references cannot count as verification');
    assert.match(markdown, /Approved Requirements:\*\* 1 \/ 3/);
    assert.match(markdown, /Requirements with Evidence References:\*\* 1 \/ 3/);
    assert.match(markdown, /Requirements without Evidence References:\*\* 2 \/ 3/);
  }, [{...requirement, id: 'REQ-1', status: 'APPROVED', evidence: []},
    {...requirement, id: 'REQ-2', status: 'PROPOSED', evidence: ['UNTRUSTED-REF']},
    {...requirement, id: 'REQ-3', status: 'PROPOSED', evidence: []}]));
  await test('R8 refresh failure removes previous report and a retry can recover', () => fixture(async page => {
    await openRelease(page); await settle(page, 0, report());
    await page.getByRole('button', {name: 'Refresh evaluation', exact: true}).click();
    assert(!(await raw(page)).includes('Fixture PRJ-REPORT-A gate 1'));
    await settle(page, 1, {error: 'Synthetic failure'}, 500);
    assert.match(await raw(page), /UNAVAILABLE \(FAILED\)/);
    await page.getByRole('button', {name: 'Refresh evaluation', exact: true}).click();
    await settle(page, 2, report());
    assert.match(await raw(page), /Fixture PRJ-REPORT-A gate 1/);
  }));
  await test('R9 missing capability data fails closed without a rendering crash', () => fixture(async page => {
    await openRelease(page);
    const malformed = report(); delete (malformed as any).capabilitiesSummary;
    await settle(page, 0, malformed);
    assert.match(await raw(page), /UNAVAILABLE \(MALFORMED\)/);
    assert.equal(await page.getByRole('button', {name: 'Execute v0.1 DoD Sign-Off', exact: true}).count(), 0);
  }));
  await test('R10 failed network and invalid JSON are explicit non-success states', () => fixture(async page => {
    await openRelease(page);
    await page.evaluate(() => (window as any).reportFixture.pending[0].reject(new Error('Synthetic network failure')));
    await page.getByTestId('release-evaluation-status').filter({hasText: '(failed)'}).waitFor();
    assert.match(await raw(page), /UNAVAILABLE \(FAILED\)/);
    await page.getByRole('button', {name: 'Refresh evaluation', exact: true}).click();
    await page.evaluate(() => (window as any).reportFixture.invalidJson(1));
    await page.getByTestId('release-evaluation-status').filter({hasText: '(malformed)'}).waitFor();
    assert.match(await raw(page), /UNAVAILABLE \(MALFORMED\)/);
  }));
  await test('R11 stale canonical snapshot invalidates report and never initiates signoff', () => fixture(async page => {
    await openRelease(page); await settle(page, 0, report());
    await page.evaluate(() => (window as any).reportFixture.update({canonicalReady: false}));
    await page.getByTestId('release-evaluation-status').waitFor();
    assert(!(await raw(page)).includes('Fixture PRJ-REPORT-A gate 1'));
    assert.equal(await page.getByRole('button', {name: 'Refresh evaluation', exact: true}).isDisabled(), true);
    await page.evaluate(() => (window as any).reportFixture.update({canonicalReady: true}));
    await page.waitForFunction(() => (window as any).reportFixture.pending.length === 2);
    assert.match(await raw(page), /UNAVAILABLE \(LOADING\)/);
    await settle(page, 1, report());
    assert.match(await raw(page), /Fixture PRJ-REPORT-A gate 1/);
  }));
  await test('R12 late same-project response from an older version is discarded', () => fixture(async page => {
    await openRelease(page);
    await page.evaluate(project => (window as any).reportFixture.update({project}), {...projectA, stateVersion: 2});
    await page.waitForFunction(() => (window as any).reportFixture.pending.length === 2);
    const newer = report(); newer.gates[0].details = 'Current snapshot response';
    await settle(page, 1, newer); await settle(page, 0, report());
    assert.match(await raw(page), /Current snapshot response/);
    assert(!(await raw(page)).includes('Fixture PRJ-REPORT-A gate 1'));
  }));
  await test('R13 returning A to B to A rejects the first A request even at the same version', () => fixture(async page => {
    await openRelease(page);
    await page.evaluate(project => (window as any).reportFixture.update({project}), projectB);
    await page.waitForFunction(() => (window as any).reportFixture.pending.length === 2);
    await page.evaluate(project => (window as any).reportFixture.update({project}), projectA);
    await page.waitForFunction(() => (window as any).reportFixture.pending.length === 3);
    const current = report(); current.gates[0].details = 'New A request';
    await settle(page, 2, current); await settle(page, 1, report(projectB.id)); await settle(page, 0, report());
    assert.match(await raw(page), /New A request/);
    assert(!(await raw(page)).includes('Fixture PRJ-REPORT-A gate 1'));
  }));
  await test('R14 document-tab invalidation clears pending denied signoff UI without accepting stale response', () => fixture(async page => {
    await openRelease(page);
    const ready = report(); ready.releaseReady = true;
    ready.gates = ready.gates.map(gate => gate.gateId <= 6 ? {...gate, status: 'PASSED'} : gate);
    ready.auditChainIntegrity = {valid: true, breaksCount: 0, eventsChecked: 3};
    await settle(page, 0, ready);
    await page.evaluate(() => {(window as any).reportFixture.allowDeniedSignoff = true;});
    await page.getByRole('button', {name: 'Execute v0.1 DoD Sign-Off', exact: true}).click();
    await page.getByRole('button', {name: 'Authorize & Seal v0.1 Release', exact: true}).click();
    await page.waitForFunction(() => (window as any).reportFixture.deniedSignoffs.length === 1);
    // The existing modal does not trap keyboard focus. Exercise the actual
    // background-tab keyboard event while only a mocked denial is outstanding.
    await page.getByRole('button', {name: 'Product Requirements (PRD)', exact: true}).press('Enter');
    await page.getByRole('button', {name: 'Release Gates & DoD (REL)', exact: true}).press('Enter');
    await page.waitForFunction(() => (window as any).reportFixture.pending.length === 2);
    await settle(page, 1, ready);
    await page.evaluate(() => (window as any).reportFixture.denySignoff(0));
    assert.equal(await page.getByRole('button', {name: 'Refresh evaluation', exact: true}).isDisabled(), false, 'Invalidated request must not leave the current UI permanently busy');
    assert.equal(await page.getByRole('button', {name: 'Recording Ceremony...', exact: true}).count(), 0);
    assert(!(await raw(page)).includes('SIGNED OFF (SERVER-REPORTED)'));
  }, [], true));
} finally {await browser.close();}
console.log(`Reports truthfulness: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
