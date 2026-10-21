import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorkView} from '../src/components/WorkView.tsx';
import type {WorkItem} from '../src/types.ts';

// Render the real board and selected-item drawer. These fixtures provide only
// stored technical status, with no approval identity or human decision record.
// SSR does not execute effects, request canonical data or test browser events.
const verified: WorkItem = {
  id: 'SYN-TECHNICAL', type: 'TASK', title: 'Synthetic technical verification',
  description: 'Stored status without human approval evidence.', status: 'VERIFIED',
  priority: 'P1', risk: 'LOW', sprint: 0, requirements: [], dependencies: [],
  acceptanceCriteria: [], checklist: [], tests: [], evidence: [],
  updatedAt: '2026-10-21T00:00:00Z',
};
const render = (items: WorkItem[], selectedItemId?: string) => renderToStaticMarkup(
  React.createElement(WorkView, {projectId: 'SYNTHETIC-DISPLAY', workItems: items,
    selectedItemId, onUpdateWorkItem: async () => {throw new Error('Unexpected mutation');}}),
);
function technicalLabel(html: string) {
  assert.doesNotMatch(html, /Verified\s*&amp;\s*Approved/i, 'Technical status must not assert human approval');
  assert.match(html, /Verified[^<]*technical/i, 'The displayed VERIFIED label must identify technical verification');
}
function statusSelect(html: string) {
  const match = /<select\b([^>]*aria-label="Work item status"[^>]*)>([\s\S]*?)<\/select>/.exec(html);
  assert(match, 'The existing status control must remain available in the drawer');
  return {attributes: match[1], options: match[2]};
}
let passed = 0, failed = 0;
function check(name: string, run: () => void) {
  try {run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${(error as Error).message}`);}
}

check('W1 empty board explains technical verification without inventing approval', () => {
  const html = render([]);
  technicalLabel(html);
  assert.match(html, /technical verification only/i);
  assert.match(html, /human governance approval is separate/i);
});

check('W2 stored VERIFIED item stays visible with no approval or evidence inferred', () => {
  const items = [structuredClone(verified)];
  const before = JSON.stringify(items);
  const html = render(items);
  assert.match(html, /Synthetic technical verification/);
  assert.match(html, /SYN-TECHNICAL/);
  technicalLabel(html);
  assert.equal(JSON.stringify(items), before, 'Rendering must not rewrite stored status or attach evidence');
});

check('W3 runtime drawer preserves all status values and selected VERIFIED value with qualified text', () => {
  const html = render([verified], verified.id);
  const select = statusSelect(html);
  assert.doesNotMatch(select.attributes, /\bdisabled=/);
  assert.deepEqual([...select.options.matchAll(/<option\b[^>]*value="([^"]+)"/g)].map(match => match[1]),
    ['PROPOSED', 'BACKLOG', 'READY', 'IN_PROGRESS', 'VERIFICATION', 'VERIFIED']);
  assert.match(select.options, /<option\b[^>]*value="VERIFIED"[^>]*selected=""[^>]*>Verified[^<]*technical/i);
  technicalLabel(html);
});

check('W4 canonical-owned status remains locked and does not imply human approval', () => {
  const item: WorkItem = {...verified, canonicalManaged: true, canonicalSource: 'MASTER_WBS',
    canonicalWbsStatus: 'VERIFIED', canonicalWbsPath: 'SYNTHETIC.1', canonicalWbsType: 'TASK'};
  const html = render([item], item.id);
  assert.match(statusSelect(html).attributes, /\bdisabled=""/);
  assert.match(html, /Canonical Managed/);
  assert.match(html, /Status is owned by the canonical repository WBS/);
  technicalLabel(html);
});

console.log(JSON.stringify({suite: 'work-verification-display', passed, failed, skipped: 0}));
process.exitCode = failed ? 1 : 0;
