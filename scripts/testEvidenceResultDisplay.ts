import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EvidenceView} from '../src/components/EvidenceView.tsx';
import type {Evidence} from '../src/types.ts';

const digest = 'ab'.repeat(32);
const fixture: Evidence = {id: 'EV-SYNTHETIC', type: 'TEST_RUN', title: 'Synthetic result',
  workItemId: 'TEST-ONLY', result: 'PASSED', producer: 'Fixture', createdAt: '2026-01-01T00:00:00Z',
  sha256Hash: digest, details: 'Synthetic rendering input; no verification authority.'};
let passed = 0; let failed = 0;
function check(name: string, fn: () => void) {
  try {fn(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${(error as Error).message}`);}
}
function render(patch: Partial<Evidence> = {}) {
  return renderToStaticMarkup(React.createElement(EvidenceView, {evidenceList: [{...fixture, ...patch}]}));
}
check('failed evidence uses failure presentation without a success checkmark', () => {
  const html = render({result: 'FAILED'});
  assert(!html.includes('lucide-circle-check')); assert(html.includes('text-rose-700')); assert(html.includes('FAILED'));
});
check('untrusted evidence is a warning without a success checkmark', () => {
  const html = render({result: 'UNTRUSTED'});
  assert(!html.includes('lucide-circle-check')); assert(html.includes('text-amber-700')); assert(html.includes('UNTRUSTED'));
});
check('unknown or absent results cannot look like successful verification', () => {
  for (const result of ['FUTURE_RESULT', undefined, null]) {
    const html = render({result: result as Evidence['result']});
    assert(!html.includes('lucide-circle-check')); assert(html.includes('UNAVAILABLE'));
  }
});
check('passed and verified stored results remain visible with a source qualification', () => {
  for (const result of ['PASSED', 'VERIFIED'] as const) {
    const html = render({result}); assert(html.includes(result)); assert(html.includes('Stored result'));
    assert(html.includes('does not independently authenticate'));
  }
});
check('valid stored SHA256 is preserved verbatim and identified as a reference', () => {
  const html = render(); assert(html.includes(`title="${digest}"`)); assert(html.includes('Stored SHA-256'));
});
check('missing and malformed digest references render without crashing or inventing a hash', () => {
  for (const sha256Hash of [undefined, null, '', 'abc', 'z'.repeat(64), 123]) {
    const html = render({sha256Hash: sha256Hash as string});
    assert(html.includes('SHA-256 reference unavailable')); assert(!html.includes('sha256: abc'));
  }
});
check('empty evidence remains an empty inventory rather than passing verification', () => {
  const html = renderToStaticMarkup(React.createElement(EvidenceView, {evidenceList: []}));
  assert(html.includes('No evidence records')); assert(!html.includes('lucide-circle-check'));
});
check('display does not mutate evidence values or provenance', () => {
  const original = structuredClone(fixture);
  renderToStaticMarkup(React.createElement(EvidenceView, {evidenceList: [fixture]}));
  assert.deepEqual(fixture, original);
});
console.log(JSON.stringify({passed, failed}));
if (failed) process.exitCode = 1;
