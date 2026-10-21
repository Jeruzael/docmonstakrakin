import assert from 'node:assert/strict';
import {evaluateReleaseGates, type ProjectDataAccessor} from '../server/release/releaseGateEvaluator.ts';
import {createChainedAuditEvent} from '../server/security/auditImmutability.ts';
import {INITIAL_PROJECTS, INITIAL_REQUIREMENTS, INITIAL_WORK_ITEMS, INITIAL_QUESTIONS,
  INITIAL_AUDIT_EVENTS, INITIAL_APPROVALS} from '../src/data/initialData.ts';
import type {Requirement, WorkItem, WorkItemStatus} from '../src/types.ts';

// Actual evaluator, inert in-memory records. No ProjectStore, server, signoff
// writer, real identities, filesystem evidence or external verifier is used.
const projectId = 'PRJ-ATLAS-01';
function store(): ProjectDataAccessor {
  return {projects: structuredClone(INITIAL_PROJECTS),
    questions: {[projectId]: structuredClone(INITIAL_QUESTIONS)},
    requirements: {[projectId]: structuredClone(INITIAL_REQUIREMENTS)},
    workItems: {[projectId]: structuredClone(INITIAL_WORK_ITEMS)},
    auditLogs: {[projectId]: structuredClone(INITIAL_AUDIT_EVENTS)}, approvals: {[projectId]: []}};
}
function item(id: string, status: WorkItemStatus, evidence: string[] = []): WorkItem {
  return {...structuredClone(INITIAL_WORK_ITEMS[0]), id, status, evidence};
}
function requirement(id: string, evidence: string[] = ['SYNTHETIC-REF']): Requirement {
  return {...structuredClone(INITIAL_REQUIREMENTS[0]), id, priority: 'HIGH', status: 'APPROVED', evidence};
}
let passed = 0;
let failed = 0;
function test(name: string, run: () => void) {
  try {run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);}
}

test('C1 absent work items cannot manufacture implementation or catalog evidence', () => {
  const input = store(); input.workItems[projectId] = [];
  const report = evaluateReleaseGates(input, projectId);
  assert.equal(report.capabilities.length, 25);
  assert(report.capabilities.every(capability => capability.status === 'PENDING'));
  assert(report.capabilities.every(capability => capability.evidence === ''));
  assert.deepEqual(report.capabilitiesSummary, {total: 25, verified: 0, percentage: 0});
});

test('C2 runtime lifecycle status does not promote early approved released or unknown records', () => {
  const cases: Array<[string, string]> = [['PROPOSED', 'PENDING'], ['BACKLOG', 'PENDING'],
    ['READY', 'PENDING'], ['IN_PROGRESS', 'PENDING'], ['APPROVED', 'PENDING'],
    ['RELEASED', 'PENDING'], ['DEFERRED', 'PENDING'], ['UNKNOWN', 'PENDING'],
    ['IMPLEMENTED', 'PENDING'], ['VERIFICATION', 'IMPLEMENTED'], ['VERIFIED', 'VERIFIED']];
  for (const [status, expected] of cases) {
    const input = store(); input.workItems[projectId] = [item('DMK-017', status as WorkItemStatus, ['LOCAL-REF'])];
    const report = evaluateReleaseGates(input, projectId);
    assert.equal(report.capabilities[0].status, expected, status);
    assert.equal(report.capabilities[0].evidence, 'LOCAL-REF', status);
    assert.equal(report.capabilitiesSummary.verified, status === 'VERIFIED' ? 1 : 0);
  }
});

test('C3 direct work item takes precedence over a verified legacy alias', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-027', 'BACKLOG', ['DIRECT-REF']), item('DMK-020', 'VERIFIED', ['ALIAS-REF'])];
  const capability = evaluateReleaseGates(input, projectId).capabilities[1];
  assert.equal(capability.status, 'PENDING'); assert.equal(capability.evidence, 'DIRECT-REF');
});

test('C4 missing direct item uses only the actual alias references in original order', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-020', 'VERIFIED', ['SECOND-REF', 'FIRST-REF', 'SECOND-REF'])];
  const capability = evaluateReleaseGates(input, projectId).capabilities[1];
  assert.equal(capability.status, 'VERIFIED'); assert.equal(capability.evidence, 'SECOND-REF, FIRST-REF, SECOND-REF');
});

test('C5 malformed and blank capability references are excluded without inventing replacements', () => {
  for (const evidence of [undefined, null, 'NOT-AN-ARRAY', [], ['', '  ', null, 123], ['  EXACT-REF  ', '', 1, 'NEXT-REF']]) {
    const input = store(); input.workItems[projectId] = [{...item('DMK-017', 'VERIFIED'), evidence: evidence as string[]}];
    assert.equal(evaluateReleaseGates(input, projectId).capabilities[0].evidence,
      Array.isArray(evidence) && evidence[0] === '  EXACT-REF  ' ? '  EXACT-REF  , NEXT-REF' : '');
  }
});

test('C6 approved core requirements with absent nonarray or blank-only evidence block Gate2', () => {
  for (const evidence of [undefined, null, 'NOT-AN-ARRAY', [], ['', '   ', null, 1]]) {
    const input = store(); input.requirements[projectId] = [{...requirement('REQ-MISSING-REF'), evidence: evidence as string[]}];
    const report = evaluateReleaseGates(input, projectId);
    assert.equal(report.gates[1].status, 'FAILED'); assert.equal(report.releaseReady, false);
    assert.match(report.gates[1].details, /REQ-MISSING-REF/);
    assert.match(report.gates[1].details, /missing evidence references/i);
    assert.deepEqual(report.gates[1].evidenceLinks, []);
  }
});

test('C7 references admit the legacy approved predicate without claiming authentication', () => {
  const input = store(); input.requirements[projectId] = [requirement('REQ-ONE', ['SECOND-REF', 'FIRST-REF']),
    requirement('REQ-TWO', ['SECOND-REF', '   ', '  EXACT-REF  '])];
  const gate = evaluateReleaseGates(input, projectId).gates[1];
  assert.equal(gate.status, 'PASSED');
  assert.deepEqual(gate.evidenceLinks, ['SECOND-REF', 'FIRST-REF', 'SECOND-REF', '  EXACT-REF  ']);
  assert.match(gate.details, /APPROVED/); assert.match(gate.details, /does not authenticate/i);
  assert(!gate.details.includes('with authenticated evidence'));
});

test('C8 core priority approved-status and no-core behavior are preserved explicitly', () => {
  const input = store();
  input.requirements[projectId] = [requirement('REQ-CORE'), {...requirement('REQ-LOW', []), priority: 'LOW', status: 'PROPOSED'}];
  assert.equal(evaluateReleaseGates(input, projectId).gates[1].status, 'PASSED');
  input.requirements[projectId][0].status = 'VERIFIED';
  const verified = evaluateReleaseGates(input, projectId).gates[1];
  assert.equal(verified.status, 'FAILED'); assert.match(verified.details, /not APPROVED.*REQ-CORE/);
  input.requirements[projectId] = [input.requirements[projectId][1]];
  const noCore = evaluateReleaseGates(input, projectId).gates[1];
  assert.equal(noCore.status, 'FAILED'); assert.match(noCore.details, /No CRITICAL or HIGH/);
});

test('C9 Gate2 identifies missing references separately from unapproved requirements', () => {
  const input = store(); input.requirements[projectId] = [requirement('REQ-NO-REF', []),
    {...requirement('REQ-NOT-APPROVED'), status: 'PROPOSED'}];
  const gate = evaluateReleaseGates(input, projectId).gates[1];
  assert.equal(gate.status, 'FAILED');
  assert.match(gate.details, /missing evidence references.*REQ-NO-REF/i);
  assert.match(gate.details, /not APPROVED.*REQ-NOT-APPROVED/);
});

test('C10 Gate3 reports stored status rather than a secret sweep or active credential integration', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-157', 'APPROVED', ['MIGRATION-REF']), item('DMK-158', 'VERIFIED', ['KEY-REF'])];
  const gate = evaluateReleaseGates(input, projectId).gates[2];
  assert.equal(gate.status, 'PASSED'); assert.deepEqual(gate.evidenceLinks, ['MIGRATION-REF', 'KEY-REF']);
  assert.match(gate.details, /DMK-157=APPROVED/); assert.match(gate.details, /DMK-158=VERIFIED/);
  assert.match(gate.details, /does not.*secret sweep/i);
  assert(!gate.details.includes('Zero plaintext secrets')); assert(!gate.details.includes('abstraction active'));
  input.workItems[projectId] = [];
  const missing = evaluateReleaseGates(input, projectId).gates[2];
  assert.equal(missing.status, 'FAILED'); assert.deepEqual(missing.evidenceLinks, []);
  assert.match(missing.details, /DMK-157=MISSING/);
});

test('C11 Gate4 cannot invent test counts or evidence for a stored VERIFIED status', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-159', 'VERIFIED', ['ACTUAL-RUN-REF'])];
  const gate = evaluateReleaseGates(input, projectId).gates[3];
  assert.equal(gate.status, 'PASSED'); assert.deepEqual(gate.evidenceLinks, ['ACTUAL-RUN-REF']);
  assert.match(gate.details, /DMK-159=VERIFIED/); assert.match(gate.details, /does not execute/i);
  assert(!gate.details.includes('41/41')); assert(!gate.details.includes('100% pass rate'));
  input.workItems[projectId] = [];
  assert.equal(evaluateReleaseGates(input, projectId).gates[3].status, 'FAILED');
  assert.deepEqual(evaluateReleaseGates(input, projectId).gates[3].evidenceLinks, []);
});

test('C12 Gate5 preserves Atlas count and status checks while disclosing what was measured', () => {
  const input = store(); input.requirements[projectId] = ['A', 'B', 'C', 'D'].map(id => requirement(id));
  input.workItems[projectId] = [item('DMK-156', 'VERIFIED', ['PACKAGE-REF']),
    ...Array.from({length: 9}, (_, index) => item(`TEST-${index}`, 'BACKLOG'))];
  const gate = evaluateReleaseGates(input, projectId).gates[4];
  assert.equal(gate.status, 'PASSED'); assert.deepEqual(gate.evidenceLinks, ['PACKAGE-REF']);
  assert.match(gate.details, /4 requirements/); assert.match(gate.details, /10 work items/);
  assert.match(gate.details, /DMK-156=VERIFIED/); assert.match(gate.details, /does not.*roundtrip/i);
  assert(!gate.details.includes('successfully planned, executed'));
  input.workItems[projectId].pop(); assert.equal(evaluateReleaseGates(input, projectId).gates[4].status, 'FAILED');
  input.workItems[projectId].push(item('RESTORED', 'BACKLOG'));
  input.requirements[projectId].pop(); assert.equal(evaluateReleaseGates(input, projectId).gates[4].status, 'FAILED');
  input.requirements[projectId].push(requirement('D'));
  input.workItems[projectId][0].status = 'VERIFICATION'; assert.equal(evaluateReleaseGates(input, projectId).gates[4].status, 'FAILED');
  input.workItems[projectId][0].status = 'VERIFIED';
  const otherId = 'PRJ-SYNTHETIC-OTHER'; input.projects[0].id = otherId;
  input.requirements[otherId] = input.requirements[projectId]; input.workItems[otherId] = input.workItems[projectId];
  assert.equal(evaluateReleaseGates(input, otherId).gates[4].status, 'FAILED');
});

test('C13 absent signoff does not claim failed technical gates or capabilities are verified', () => {
  const input = store(); input.workItems[projectId] = []; input.requirements[projectId] = [];
  const report = evaluateReleaseGates(input, projectId);
  assert.equal(report.gates[6].status, 'HUMAN_APPROVAL_REQUIRED'); assert.equal(report.signedOff, false);
  assert(!report.gates[6].details.includes('100%')); assert(!report.gates[6].details.includes('Gates 1–6 technically verified'));
  assert.match(report.gates[6].details, /human sign-off/i);
});

test('C14 approval-only signoff reports that record without inventing a ledger event or signer', () => {
  const input = store(); input.auditLogs[projectId] = [];
  input.approvals[projectId] = [{...structuredClone(INITIAL_APPROVALS[0]), id: 'APV-SYNTHETIC-ONLY', type: 'RELEASE_SIGNOFF', status: 'APPROVED'}];
  const report = evaluateReleaseGates(input, projectId);
  assert.equal(report.gates[6].status, 'PASSED'); assert.equal(report.signedOff, true); assert.equal(report.signoffDetails, undefined);
  assert.match(report.gates[6].details, /approval record APV-SYNTHETIC-ONLY/i);
  assert(!report.gates[6].details.includes('cryptographic audit ledger')); assert(!report.gates[6].details.includes('Authorized Human Signer'));
});

test('C15 audit-derived signoff identifies the actual event and preserves import-boundary filtering', () => {
  const input = store();
  const event = createChainedAuditEvent({actor: 'Synthetic Audit Reviewer', action: 'RELEASE_GATE_APPROVED', target: 'DMK-165', reason: 'Inert evaluator fixture'});
  input.auditLogs[projectId] = [event];
  const report = evaluateReleaseGates(input, projectId);
  assert.equal(report.signedOff, true); assert.match(report.gates[6].details, /Synthetic Audit Reviewer/);
  assert(report.gates[6].details.includes(event.id)); assert.equal(report.signoffDetails?.auditEventId, event.id);
  const imported = createChainedAuditEvent({actor: 'Synthetic Importer', action: 'PACKAGE_IMPORTED', target: 'FIXTURE', previousEvent: event});
  input.auditLogs[projectId] = [imported, event];
  assert.equal(evaluateReleaseGates(input, projectId).signedOff, false);
});

test('C16 legacy baseline remains compatible and read-only evaluation never mutates inputs', () => {
  const input = store(); const before = structuredClone(input);
  const report = evaluateReleaseGates(input, projectId);
  assert.equal(report.releaseReady, true); assert.equal(report.signedOff, false);
  assert.deepEqual(report.capabilitiesSummary, {total: 25, verified: 25, percentage: 100});
  assert.deepEqual(input, before);
});

test('C17 Gate1 reports absent questions and missing states without inventing resolution', () => {
  const input = store(); delete input.questions[projectId];
  const empty = evaluateReleaseGates(input, projectId).gates[0];
  assert.equal(empty.status, 'PASSED'); assert.deepEqual(empty.evidenceLinks, ['EV-104']);
  assert.match(empty.details, /0 blocking questions selected/);
  assert.match(empty.details, /UNRESOLVED=0; ANSWERED=0; DEFERRED=0; NOT_APPLICABLE=0; OTHER_OR_MISSING=0/);
  const missing = {...structuredClone(INITIAL_QUESTIONS[0]), id: 'Q-MISSING', importance: 'BLOCKING' as const};
  delete (missing as any).state;
  input.questions[projectId] = [missing, {...missing, id: 'Q-UNKNOWN', state: 'UNKNOWN' as any}];
  const before = structuredClone(input), report = evaluateReleaseGates(input, projectId);
  assert.equal(report.gates[0].status, 'PASSED', 'Missing/unknown state must retain the existing UNRESOLVED-only predicate');
  assert.match(report.gates[0].details, /OTHER_OR_MISSING=2/);
  assert.match(report.gates[0].details, /does not verify.*formal acceptance/i);
  assert.doesNotMatch(report.gates[0].details, /resolved or formally addressed|formally accepted/i);
  assert.deepEqual(input, before);
});

test('C18 Gate1 reports unresolved IDs and preserves the existing blocker selectors', () => {
  const input = store(), base = {...structuredClone(INITIAL_QUESTIONS[0]), state: 'UNRESOLVED' as const};
  input.questions[projectId] = [{...base, id: 'Q-IMPORTANCE', importance: 'BLOCKING'},
    {...base, id: 'Q-URGENCY', importance: 'RECOMMENDED', urgency: 'CRITICAL'} as any,
    {...base, id: 'Q-LEGACY-FLAG', importance: 'RECOMMENDED', isBlocking: true} as any,
    {...base, id: 'Q-OUTSIDE-PREDICATE', importance: 'RECOMMENDED', blocking: true}];
  const gate = evaluateReleaseGates(input, projectId).gates[0];
  assert.equal(gate.status, 'FAILED'); assert.match(gate.details, /3 blocking questions selected; UNRESOLVED=3/);
  for (const id of ['Q-IMPORTANCE', 'Q-URGENCY', 'Q-LEGACY-FLAG']) assert(gate.details.includes(id));
  assert(!gate.details.includes('Q-OUTSIDE-PREDICATE'));
  assert.match(gate.details, /does not verify.*formal acceptance/i);
  assert.deepEqual(gate.evidenceLinks, ['EV-104']);
});

test('C19 Gate1 counts ANSWERED records without claiming their answers were verified', () => {
  const input = store(); input.questions[projectId] = [0, 1].map(index => ({
    ...structuredClone(INITIAL_QUESTIONS[0]), id: `Q-ANSWERED-${index}`, importance: 'BLOCKING',
    state: 'ANSWERED', answer: undefined, justification: undefined,
  }));
  const gate = evaluateReleaseGates(input, projectId).gates[0];
  assert.equal(gate.status, 'PASSED'); assert.match(gate.details, /ANSWERED=2/);
  assert.match(gate.details, /does not verify answers/i);
  assert.doesNotMatch(gate.details, /resolved or formally addressed|formally accepted/i);
});

test('C20 Gate1 counts DEFERRED records without fabricating formal deferral acceptance', () => {
  const input = store(); input.questions[projectId] = [{...structuredClone(INITIAL_QUESTIONS[0]),
    id: 'Q-DEFERRED', importance: 'BLOCKING', state: 'DEFERRED', answer: undefined, justification: undefined}];
  const gate = evaluateReleaseGates(input, projectId).gates[0];
  assert.equal(gate.status, 'PASSED'); assert.match(gate.details, /DEFERRED=1/);
  assert.match(gate.details, /does not verify.*formal acceptance of deferrals/i);
  assert.doesNotMatch(gate.details, /resolved or formally addressed|formally accepted/i);
});

test('C21 Gate1 counts NOT_APPLICABLE records without authenticating applicability decisions', () => {
  const input = store(); input.questions[projectId] = [{...structuredClone(INITIAL_QUESTIONS[0]),
    id: 'Q-NOT-APPLICABLE', importance: 'BLOCKING', state: 'NOT_APPLICABLE', answer: undefined, justification: undefined}];
  const gate = evaluateReleaseGates(input, projectId).gates[0];
  assert.equal(gate.status, 'PASSED'); assert.match(gate.details, /NOT_APPLICABLE=1/);
  assert.match(gate.details, /does not verify answers, applicability decisions, or formal acceptance/i);
  assert.doesNotMatch(gate.details, /resolved or formally addressed|formally accepted/i);
});

console.log(`Release evidence claims: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
