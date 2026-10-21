import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardView } from '../src/components/DashboardView.tsx';
import * as riskWorkspace from '../src/components/RiskWorkspaceView.tsx';
import { INITIAL_PROJECTS, INITIAL_NEXT_ACTION } from '../src/data/initialData.ts';
import { computeAssurance, emptyAssurance } from '../src/data/projectInitialization.ts';
import type { AssuranceInputs, Risk } from '../src/types.ts';

// Stored literal example matching server.ts's preliminary 9/6 initializer, not
// its final creation result. The route later replaces both scores, factors,
// drivers and controls from computedRisk; RISK-D16 covers those current shapes.
// No server, persistence, browser or authority-bearing operation runs here.
const seed: Risk = {
  id: 'RISK-001', title: 'Initial Discovery Uncertainty & Undefined Scope',
  description: 'Baseline risk before completing architecture reviews and threat modeling.',
  drivers: ['New Project (+2)'], inherentLikelihood: 3, inherentImpact: 3,
  inherentScore: 9, inherentLevel: 'MEDIUM', residualLikelihood: 2, residualImpact: 3,
  residualScore: 6, residualLevel: 'MEDIUM', treatment: 'MITIGATE', controls: ['CTRL-SSDF-PW.1'],
};
const low: Risk = { ...seed, id: 'RISK-LOW', title: 'Small local concern',
  drivers: ['Local-only driver'], inherentLikelihood: 1, inherentImpact: 2,
  inherentScore: 2, inherentLevel: 'LOW', residualLikelihood: 1, residualImpact: 1,
  residualScore: 1, residualLevel: 'LOW' };
const critical: Risk = { ...seed, id: 'RISK-CRITICAL', title: 'Critical fixture concern',
  drivers: ['Critical fixture driver'], inherentLikelihood: 5, inherentImpact: 5,
  inherentScore: 25, inherentLevel: 'CRITICAL', residualLikelihood: 3, residualImpact: 5,
  residualScore: 15, residualLevel: 'HIGH', mandatoryFloorApplied: true,
  floorReason: 'Stored fixture floor reason' };
const props = { project: INITIAL_PROJECTS[0], nextAction: INITIAL_NEXT_ACTION,
  questions: [], onNavigate: () => {}, onOpenOverrideModal: () => {} };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const renderDashboard = (risks: Risk[]) => text(renderToStaticMarkup(React.createElement(DashboardView, { ...props, risks })));
const renderWorkspace = (risks: Risk[]) => text(renderToStaticMarkup(React.createElement(riskWorkspace.RiskWorkspaceView, { risks, threats: [] })));
const dashboardSummary = (risks: Risk[]) => {
  const output = renderDashboard(risks);
  return output.slice(output.indexOf('Project Risk'), output.indexOf('Phase Transition Gates'));
};
const workspaceSummary = (risks: Risk[]) => renderWorkspace(risks).split('Risk Register (')[0];
const summaries = [dashboardSummary, workspaceSummary];
// Selection-policy prose may mention CRITICAL; severity assertions inspect the
// displayed values after the Inherent Risk label, not that explanatory prose.
const displayedValues = (output: string) => output.slice(output.indexOf('Inherent Risk'));
let passed = 0;
let failed = 0;
function test(name: string, body: () => void) {
  try { body(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}
function contains(output: string, expected: string) { assert(output.includes(expected), `Expected ${JSON.stringify(expected)} in ${JSON.stringify(output)}`); }
function excludes(output: string, unexpected: RegExp) { assert(!unexpected.test(output), `Unexpected ${unexpected} in ${JSON.stringify(output)}`); }

test('RISK-D1 empty dashboard has no fabricated score or severity', () => {
  const output = dashboardSummary([]);
  contains(output, 'Unavailable');
  excludes(displayedValues(output), /\b(?:18|10|CRITICAL|HIGH)\b/);
});
test('RISK-D2 empty risk workspace has no fabricated scores, drivers or aggregate claim', () => {
  const output = workspaceSummary([]);
  contains(output, 'Unavailable');
  excludes(output, /\b(?:18|10|CRITICAL|HIGH)\b|Overall Project Risk|Financial \/ Transaction Data|Production Credential Access/);
});
test('RISK-D3 stored literal example retains distinct 9/6 scores and 3/3,2/3 factors', () => {
  for (const summary of summaries) {
    const output = summary([seed]);
    for (const expected of ['RISK-001', seed.title, '9 / 25', '6 / 25', 'MEDIUM', 'Likelihood 3 / 5', 'Impact 3 / 5', 'Likelihood 2 / 5', 'New Project (+2)']) contains(output, expected);
    excludes(displayedValues(output), /Overall Project Risk|Likelihood 4 × Impact 5|CRITICAL|Financial \/ Transaction Data/);
  }
});
test('RISK-D4 LOW values are retained without HIGH or CRITICAL defaults', () => {
  for (const summary of summaries) {
    const output = summary([low]);
    for (const expected of ['RISK-LOW', low.title, '2 / 25', '1 / 25', 'LOW', 'Likelihood 1 / 5', 'Impact 2 / 5', 'Local-only driver']) contains(output, expected);
    excludes(displayedValues(output), /\bHIGH\b|\bCRITICAL\b|Overall Project Risk/);
  }
});
test('RISK-D5 actual CRITICAL record and stored floor reason remain visible', () => {
  for (const summary of summaries) {
    const output = summary([critical]);
    for (const expected of ['RISK-CRITICAL', '25 / 25', '15 / 25', 'CRITICAL', 'HIGH', 'Likelihood 5 / 5', 'Impact 5 / 5', 'Stored fixture floor reason', 'Stored floor flag: Applied']) contains(output, expected);
    contains(output, 'does not establish enforcement');
  }
});
test('RISK-D6 dashboard preserves first-CRITICAL selection and identifies the record', () => {
  const output = dashboardSummary([low, critical, { ...critical, id: 'RISK-LATER-CRITICAL', title: 'Later critical', drivers: ['Later critical driver'] }]);
  contains(output, 'First CRITICAL record, otherwise first stored record');
  contains(output, 'RISK-CRITICAL'); contains(output, 'Critical fixture driver');
  excludes(output, /RISK-LOW|RISK-LATER-CRITICAL|Local-only driver|Later critical driver/);
});
test('RISK-D7 workspace preserves first-record selection despite later CRITICAL record', () => {
  const output = workspaceSummary([low, critical]);
  contains(output, 'First stored risk record'); contains(output, 'RISK-LOW'); contains(output, 'Local-only driver');
  excludes(output, /RISK-CRITICAL|Critical fixture driver|Overall Project Risk/);
});
test('RISK-D8 no-CRITICAL dashboard keeps first record rather than introducing score ranking', () => {
  const output = dashboardSummary([low, seed]);
  contains(output, 'RISK-LOW'); contains(output, '2 / 25'); excludes(output, /RISK-001|9 \/ 25/);
});
test('RISK-D9 missing optional-looking runtime fields render unavailable without crashing', () => {
  const missing = { ...seed, inherentScore: undefined, residualScore: undefined,
    inherentLevel: undefined, residualLevel: undefined, inherentLikelihood: undefined,
    inherentImpact: undefined, residualLikelihood: undefined, residualImpact: undefined,
    drivers: undefined, controls: undefined } as unknown as Risk;
  for (const summary of summaries) {
    const output = summary([missing]);
    contains(output, 'Unavailable'); contains(output, 'RISK-001');
    contains(output, 'Inherent Risk Unavailable Unavailable');
    contains(output, 'Residual Risk Unavailable Unavailable');
    excludes(displayedValues(output), /\b(?:18|10|CRITICAL|HIGH|NaN|undefined)\b/);
  }
});
test('RISK-D10 invalid numeric and enum values are unavailable rather than coerced or clamped', () => {
  const invalidValues = [NaN, Infinity, -1, 0, 26, 1.5, '9', null];
  for (const invalid of invalidValues) {
    const record = { ...seed, inherentScore: invalid, residualScore: invalid,
      inherentLevel: 'CERTIFIED', residualLevel: { label: 'LOW' }, inherentLikelihood: 6,
      inherentImpact: -1, residualLikelihood: '2', residualImpact: NaN } as unknown as Risk;
    for (const summary of summaries) {
      const output = summary([record]);
      contains(output, 'Inherent Risk Unavailable Unavailable');
      contains(output, 'Residual Risk Unavailable Unavailable');
      contains(output, 'Likelihood Unavailable');
      contains(output, 'Impact Unavailable');
      excludes(output, /CERTIFIED|NaN|Infinity|\b(?:18|10)\b|\b(?:9|6) \/ 25|Likelihood (?:6|2)|Impact -1/);
    }
  }
});
test('RISK-D11 malformed driver entries are excluded while valid stored text and order survive', () => {
  const record = { ...seed, drivers: ['', '  ', 7, null, { label: 'Invented object driver' }, 'Actual second driver', 'Actual last driver'] } as unknown as Risk;
  for (const summary of summaries) {
    const output = summary([record]);
    contains(output, 'Actual second driver'); contains(output, 'Actual last driver');
    assert(output.indexOf('Actual second driver') < output.indexOf('Actual last driver'));
    excludes(output, /Invented object driver|Financial \/ Transaction Data/);
  }
});
test('RISK-D12 stored score is not recomputed from factors or promoted by the level label', () => {
  for (const summary of summaries) {
    const output = summary([{ ...seed, inherentScore: 16, inherentLevel: 'HIGH' }]);
    contains(output, '16 / 25'); contains(output, 'Likelihood 3 / 5'); contains(output, 'Impact 3 / 5');
    excludes(output, /9 \/ 25/);
  }
});
test('RISK-D13 false or malformed floor flags never claim an applied floor', () => {
  for (const flag of [false, undefined, 'true', 1]) {
    for (const summary of summaries) {
      const output = summary([{ ...seed, mandatoryFloorApplied: flag, floorReason: 'Untrusted applied claim' } as unknown as Risk]);
      excludes(output, /Stored floor flag: Applied|Untrusted applied claim/);
      contains(output, flag === false ? 'Stored floor flag: Not applied' : 'Stored floor flag: Unavailable');
    }
  }
});
test('RISK-D14 valid register contents and existing navigation labels remain present', () => {
  const output = renderWorkspace([low, critical]);
  for (const expected of ['Risk Register (2)', 'Threat Model (0)', 'Mandatory Risk Floors', 'RISK-LOW', 'RISK-CRITICAL', 'Small local concern', 'Critical fixture concern', 'MITIGATE', 'CTRL-SSDF-PW.1']) contains(output, expected);
  contains(renderDashboard([seed]), 'View Register');
});
test('RISK-D15 floor catalog is rendered as reference without invented per-project enforcement', () => {
  const Reference = (riskWorkspace as Record<string, unknown>).RiskFloorReference as React.FC | undefined;
  assert.equal(typeof Reference, 'function', 'The production floor-reference panel must be renderable independently of tab state');
  const output = text(renderToStaticMarkup(React.createElement(Reference!)));
  contains(output, 'Reference information'); contains(output, 'does not establish enforcement');
  contains(output, 'Financial transaction processing'); contains(output, 'Production secret access');
  excludes(output, /ACTIVE in|OmniPay|Atlas|NOT_TRIGGERED|\bBLOCKED\b|automatically enforce/);
});

test('RISK-D16 current final-creation shapes retain computed 9/12/16/25 scores factors and drivers', () => {
  // Hand-checked outcomes of the production computeAssurance function, with the
  // complete Risk shape finalized at server.ts:489-494. This is pure projection
  // coverage of that shape, not execution of the project-creation HTTP route.
  const cases: Array<{ inputs: Partial<AssuranceInputs>; score: number; level: Risk['inherentLevel'];
    likelihood: number; impact: number; drivers: string[] }> = [
    { inputs: {}, score: 9, level: 'MEDIUM', likelihood: 3, impact: 3, drivers: [] },
    { inputs: { publicInternetExposure: true }, score: 12, level: 'MEDIUM', likelihood: 3, impact: 4, drivers: ['publicInternetExposure'] },
    { inputs: { productionSecrets: true }, score: 16, level: 'HIGH', likelihood: 4, impact: 4, drivers: ['productionSecrets'] },
    { inputs: { productionSecrets: true, autonomousAgentExecution: true }, score: 25, level: 'CRITICAL', likelihood: 5, impact: 5, drivers: ['productionSecrets', 'autonomousAgentExecution'] },
  ];
  for (const expected of cases) {
    const computed = computeAssurance({ ...emptyAssurance, ...expected.inputs }, ['WEB_APPLICATION'], []);
    assert.deepEqual(computed, { score: expected.score, level: expected.level, drivers: expected.drivers });
    const finalized: Risk = { ...seed, inherentScore: computed.score, inherentLevel: computed.level,
      residualScore: computed.score, residualLevel: computed.level, drivers: computed.drivers, controls: [],
      inherentLikelihood: expected.likelihood, residualLikelihood: expected.likelihood,
      inherentImpact: expected.impact, residualImpact: expected.impact };
    for (const summary of summaries) {
      const output = summary([finalized]);
      for (const prefix of ['Inherent Risk', 'Residual Risk']) {
        contains(output, `${prefix} ${expected.score} / 25 ${expected.level} Likelihood ${expected.likelihood} / 5 · Impact ${expected.impact} / 5`);
      }
      for (const driver of expected.drivers) contains(output, driver);
      if (!expected.drivers.length) contains(output, 'Stored Risk Contributors: Unavailable');
      excludes(output, /New Project \(\+2\)|\b6 \/ 25/);
    }
    // Creation clears the initial control list; the register must not resurrect it.
    excludes(renderWorkspace([finalized]), /CTRL-SSDF-PW\.1/);
  }
});

console.log(`Risk display truthfulness: ${passed} passed; ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
