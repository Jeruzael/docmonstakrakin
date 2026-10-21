import assert from 'node:assert/strict';
import {readReleaseReport, releaseReportMarkdown, requirementReferenceSummary} from '../src/data/releaseReportProjection.ts';
import {evaluateReleaseGates} from '../server/release/releaseGateEvaluator.ts';
import {INITIAL_PROJECTS, INITIAL_REQUIREMENTS} from '../src/data/initialData.ts';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DocumentsView} from '../src/components/DocumentsView.tsx';

const project = {...structuredClone(INITIAL_PROJECTS[0]), id: 'PRJ-REPORT-PURE', name: 'Synthetic report',
  progress: {...INITIAL_PROJECTS[0].progress, releaseReadiness: 100}};
// Real evaluator, inert in-memory inputs: compatibility with the current API is
// exercised without importing ProjectStore, starting a server or recording signoff.
const source = evaluateReleaseGates({projects: [project], requirements: {}, questions: {}, workItems: {}, approvals: {}, auditLogs: {}}, project.id);
let passed = 0;
function test(name: string, run: () => void) {run(); passed++; console.log(`PASS ${name}`);}
test('P1 current server evaluation admits without invented snapshot or signer fields', () => {
  const report = readReleaseReport(source, project.id);
  assert(report); assert.equal(report.signedOff, false); assert.equal(report.releaseReady, false);
  assert.equal(report.capabilitiesSummary.total, 25); assert.equal(report.capabilitiesSummary.verified, 0);
});
test('P2 unavailable projections never infer success from planning 100', () => {
  for (const status of ['LOADING', 'UNAVAILABLE', 'FAILED', 'MALFORMED'] as const) {
    const markdown = releaseReportMarkdown(project, null, status, '2026-10-21T12:00:00Z');
    assert.match(markdown, /Overall Release Status:\*\* UNAVAILABLE/);
    assert.match(markdown, /Chain Breaks Detected:\*\* UNAVAILABLE/);
    assert(!markdown.includes('100%')); assert(!markdown.includes('APPROVED & SIGNED OFF'));
  }
});
test('P3 wrong project and missing response fields are rejected before rendering', () => {
  assert.equal(readReleaseReport(source, 'OTHER'), null);
  for (const key of ['capabilities', 'capabilitiesSummary', 'auditChainIntegrity', 'gates', 'signedOff', 'releaseReady', 'timestamp']) {
    const candidate = structuredClone(source); delete candidate[key];
    assert.equal(readReleaseReport(candidate, project.id), null, key);
  }
  for (const candidate of [null, [], true, 'success', {projectId: project.id}]) assert.equal(readReleaseReport(candidate, project.id), null);
});
test('P4 partial duplicate unknown or malformed gates cannot manufacture complete evaluation', () => {
  const candidates = [
    {...source, gates: source.gates.slice(0, 6)},
    {...source, gates: source.gates.map((gate, index) => index === 1 ? source.gates[0] : gate)},
    {...source, gates: source.gates.map((gate, index) => index === 0 ? {...gate, status: 'UNKNOWN'} : gate)},
    {...source, gates: source.gates.map((gate, index) => index === 0 ? {...gate, evidenceLinks: 'EV-TEST'} : gate)},
  ];
  for (const candidate of candidates) assert.equal(readReleaseReport(candidate, project.id), null);
});
test('P5 summary counts and percentages must match capability status records', () => {
  for (const capabilitiesSummary of [{total: 26, verified: 0, percentage: 0}, {total: 25, verified: 25, percentage: 100}, {total: 25, verified: 0, percentage: 100}])
    assert.equal(readReleaseReport({...source, capabilitiesSummary}, project.id), null);
  assert.equal(readReleaseReport({...source, capabilities: [...source.capabilities.slice(1), source.capabilities[1]]}, project.id), null);
});
test('P6 audit flags require finite nonnegative counts and agree with gate six', () => {
  for (const auditChainIntegrity of [null, {valid: true, breaksCount: 1, eventsChecked: 1},
    {valid: true, breaksCount: 0, eventsChecked: -1}, {valid: false, breaksCount: 1, eventsChecked: 1},
    {valid: true, breaksCount: 0, eventsChecked: Infinity}])
    assert.equal(readReleaseReport({...source, auditChainIntegrity}, project.id), null);
});
test('P7 success flags cannot disagree with returned gates', () => {
  for (const flags of [{signedOff: true}, {releaseReady: true}, {allGatesPassed: true}])
    assert.equal(readReleaseReport({...source, ...flags}, project.id), null);
});
test('P8 signoff sourced from existing approval may omit signer detail without inventing a person', () => {
  const candidate = {...source, signedOff: true,
    gates: source.gates.map(gate => gate.gateId === 7 ? {...gate, status: 'PASSED' as const} : gate)};
  const report = readReleaseReport(candidate, project.id); assert(report);
  const markdown = releaseReportMarkdown(project, report, 'AVAILABLE', '2026-10-21T12:00:00Z');
  assert.match(markdown, /SIGNED OFF \(SERVER-REPORTED\)/); assert(!markdown.includes('Signed Off By:'));
  assert.equal(readReleaseReport({...candidate, signoffDetails: {actor: '', timestamp: 'bad', auditEventId: ''}}, project.id), null);
});
test('P9 RTM keeps approval and reference coverage separate from verification', () => {
  const requirement = structuredClone(INITIAL_REQUIREMENTS[0]);
  const summary = requirementReferenceSummary([
    {...requirement, status: 'APPROVED', evidence: []},
    {...requirement, status: 'PROPOSED', evidence: ['UNTRUSTED-REF']},
    {...requirement, status: 'REJECTED', evidence: []},
  ]);
  assert.deepEqual(summary, {total: 3, approved: 1, withEvidenceReferences: 1, withoutEvidenceReferences: 2});
  assert.deepEqual(requirementReferenceSummary([]), {total: 0, approved: 0, withEvidenceReferences: 0, withoutEvidenceReferences: 0});
});
test('P10 failed evaluator output is projected without unmeasured security assurances', () => {
  const markdown = releaseReportMarkdown(project, source, 'AVAILABLE', '2026-10-21T12:00:00Z');
  assert.match(markdown, /INCOMPLETE \(SERVER-REPORTED\)/);
  assert.match(markdown, /0\/25 VERIFIED/);
  assert(!markdown.includes('Zero Plaintext Secrets:** Enforced'));
  assert.match(markdown, /does not independently authenticate evidence/);
});
test('P11 PRD exposes actual lifecycle counts without fabricated hash or computed health', () => {
  const requirement = structuredClone(INITIAL_REQUIREMENTS[0]);
  const html = renderToStaticMarkup(React.createElement(DocumentsView, {project, requirements: [
    {...requirement, id: 'REQ-A', status: 'APPROVED', evidence: []},
    {...requirement, id: 'REQ-B', status: 'PROPOSED', evidence: []},
  ]}));
  assert(!html.includes('#7f8a91c2b'), 'Projection must not print a fabricated canonical hash');
  assert(!html.includes('canonical state hash'), 'Rendering does not compute a canonical hash');
  assert.match(html, /Total Requirements: 2/);
  assert.match(html, /Approved Requirements: 1/);
  assert.match(html, /Stored Planning Health Score/);
});
console.log(`Release report projection: ${passed} passed`);
