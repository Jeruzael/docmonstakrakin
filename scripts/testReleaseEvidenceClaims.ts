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
  const input: ProjectDataAccessor = {projects: structuredClone(INITIAL_PROJECTS),
    questions: {[projectId]: structuredClone(INITIAL_QUESTIONS)},
    requirements: {[projectId]: structuredClone(INITIAL_REQUIREMENTS)},
    workItems: {[projectId]: structuredClone(INITIAL_WORK_ITEMS)},
    auditLogs: {[projectId]: structuredClone(INITIAL_AUDIT_EVENTS)}, approvals: {[projectId]: []}};
  scopeTo(input, input.workItems[projectId].map(item => item.id));
  return input;
}
function scopeTo(input: ProjectDataAccessor, ids: string[]) {
  input.projects[0].readinessContext = {version: 'LOCAL_RELEASE_SCOPE/1', id: 'RSC-CLAIMS-FIXTURE', revision: 1,
    targetRelease: input.projects[0].targetRelease, workItemIds: ids, commitSha: 'a'.repeat(40),
    buildRevision: 'fixture-build', environment: 'DISCONNECTED_TEST', updatedAt: '2026-10-22T00:00:00Z',
    updatedBy: {identityId: 'FIXTURE', name: 'Inert fixture', roleSource: 'LOCAL_SERVER_ROSTER'}};
}
function item(id: string, status: WorkItemStatus, evidence: string[] = []): WorkItem {
  return {...structuredClone(INITIAL_WORK_ITEMS[0]), id, status, evidence};
}
function requirement(id: string, evidence: string[] = ['SYNTHETIC-REF']): Requirement {
  return {...structuredClone(INITIAL_REQUIREMENTS[0]), id, priority: 'HIGH', status: 'APPROVED', evidence, workItems: ['DMK-017']};
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
    ['IMPLEMENTED', 'PENDING'], ['VERIFICATION', 'IMPLEMENTED'], ['VERIFIED', 'IMPLEMENTED']];
  for (const [status, expected] of cases) {
    const input = store(); input.workItems[projectId] = [item('DMK-017', status as WorkItemStatus, ['LOCAL-REF'])];
    scopeTo(input, ['DMK-017']);
    const report = evaluateReleaseGates(input, projectId);
    assert.equal(report.capabilities[0].status, expected, status);
    assert.equal(report.capabilities[0].evidence, status === 'UNKNOWN' || status === 'IMPLEMENTED' ? '' : 'LOCAL-REF', status);
    assert.equal(report.capabilitiesSummary.verified, 0);
  }
});

test('C3 direct work item takes precedence over a verified legacy alias', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-027', 'BACKLOG', ['DIRECT-REF']), item('DMK-020', 'VERIFIED', ['ALIAS-REF'])];
  scopeTo(input, input.workItems[projectId].map(item => item.id));
  const capability = evaluateReleaseGates(input, projectId).capabilities[1];
  assert.equal(capability.status, 'PENDING'); assert.equal(capability.evidence, 'DIRECT-REF');
});

test('C4 missing direct item uses only the actual alias references in original order', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-020', 'VERIFIED', ['SECOND-REF', 'FIRST-REF', 'SECOND-REF'])];
  scopeTo(input, input.workItems[projectId].map(item => item.id));
  const capability = evaluateReleaseGates(input, projectId).capabilities[1];
  assert.equal(capability.status, 'IMPLEMENTED'); assert.equal(capability.evidence, 'SECOND-REF, FIRST-REF, SECOND-REF');
});

test('C5 malformed and blank capability references are excluded without inventing replacements', () => {
  for (const evidence of [undefined, null, 'NOT-AN-ARRAY', [], ['', '  ', null, 123], ['  EXACT-REF  ', '', 1, 'NEXT-REF']]) {
    const input = store(); input.workItems[projectId] = [{...item('DMK-017', 'VERIFIED'), evidence: evidence as string[]}];
    scopeTo(input, ['DMK-017']);
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

test('C7 local approval and references stay pending without authenticated requirement verification', () => {
  const input = store(); input.requirements[projectId] = [requirement('REQ-ONE', ['SECOND-REF', 'FIRST-REF']),
    requirement('REQ-TWO', ['SECOND-REF', '   ', '  EXACT-REF  '])];
  const gate = evaluateReleaseGates(input, projectId).gates[1];
  assert.equal(gate.status, 'PENDING');
  assert.deepEqual(gate.evidenceLinks, ['SECOND-REF', 'FIRST-REF', 'SECOND-REF', '  EXACT-REF  ']);
  assert.match(gate.details, /APPROVED/); assert.match(gate.details, /do not authenticate/i);
  assert(!gate.details.includes('with authenticated evidence'));
});

test('C8 core lifecycle labels remain pending and absent core coverage is never passed', () => {
  const input = store();
  input.requirements[projectId] = [requirement('REQ-CORE'), {...requirement('REQ-LOW', []), priority: 'LOW', status: 'PROPOSED'}];
  assert.equal(evaluateReleaseGates(input, projectId).gates[1].status, 'PENDING');
  input.requirements[projectId][0].status = 'VERIFIED';
  assert.equal(evaluateReleaseGates(input, projectId).gates[1].status, 'PENDING');
  input.requirements[projectId] = [input.requirements[projectId][1]];
  const noCore = evaluateReleaseGates(input, projectId).gates[1];
  assert.equal(noCore.status, 'PENDING'); assert.match(noCore.details, /observations: none/);
});

test('C9 Gate2 identifies missing references separately from unapproved requirements', () => {
  const input = store(); input.requirements[projectId] = [requirement('REQ-NO-REF', []),
    {...requirement('REQ-NOT-APPROVED'), status: 'PROPOSED'}];
  const gate = evaluateReleaseGates(input, projectId).gates[1];
  assert.equal(gate.status, 'FAILED');
  assert.match(gate.details, /missing evidence references.*REQ-NO-REF/i);
  assert.match(gate.details, /not APPROVED.*REQ-NOT-APPROVED/i);
});

test('C10 Gate3 keeps satisfactory stored status pending without authenticated production acquisition', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-157', 'APPROVED', ['MIGRATION-REF']), item('DMK-158', 'VERIFIED', ['KEY-REF'])];
  scopeTo(input, ['DMK-157', 'DMK-158']);
  const gate = evaluateReleaseGates(input, projectId).gates[2];
  assert.equal(gate.status, 'PENDING'); assert.deepEqual(gate.evidenceLinks, ['MIGRATION-REF', 'KEY-REF']);
  assert.match(gate.details,/Authenticated production evidence acquisition is unavailable/);
  assert.match(gate.details, /DMK-157=APPROVED/); assert.match(gate.details, /DMK-158=VERIFIED/);
  assert.match(gate.details, /does not.*secret sweep/i);
  assert(!gate.details.includes('Zero plaintext secrets')); assert(!gate.details.includes('abstraction active'));
  input.workItems[projectId] = [];
  const missing = evaluateReleaseGates(input, projectId).gates[2];
  assert.equal(missing.status, 'PENDING'); assert.deepEqual(missing.evidenceLinks, []);
  assert.match(missing.details, /DMK-157=OUT_OF_SCOPE_OR_UNAVAILABLE/);
});

test('C11 Gate4 cannot invent test counts or evidence for a stored VERIFIED status', () => {
  const input = store(); input.workItems[projectId] = [item('DMK-159', 'VERIFIED', ['ACTUAL-RUN-REF'])];
  scopeTo(input, ['DMK-159']);
  const gate = evaluateReleaseGates(input, projectId).gates[3];
  assert.equal(gate.status, 'PENDING'); assert.deepEqual(gate.evidenceLinks, ['ACTUAL-RUN-REF']);
  assert.match(gate.details, /DMK-159=VERIFIED/); assert.match(gate.details, /does not execute/i);
  assert(!gate.details.includes('41/41')); assert(!gate.details.includes('100% pass rate'));
  input.workItems[projectId] = [];
  assert.equal(evaluateReleaseGates(input, projectId).gates[3].status, 'PENDING');
  assert.deepEqual(evaluateReleaseGates(input, projectId).gates[3].evidenceLinks, []);
});

test('C12 project IDs and entity counts never substitute for a golden project execution', () => {
  const input = store(); input.requirements[projectId] = [];
  input.workItems[projectId] = [item('DMK-156', 'VERIFIED', ['PACKAGE-REF'])]; scopeTo(input, ['DMK-156']);
  const gate = evaluateReleaseGates(input, projectId).gates[4];
  assert.equal(gate.status, 'PENDING'); assert.deepEqual(gate.evidenceLinks, ['PACKAGE-REF']);
  assert.match(gate.details, /DMK-156=VERIFIED/); assert.match(gate.details, /counts do not prove/);
  input.workItems[projectId][0].status = 'VERIFICATION';
  assert.equal(evaluateReleaseGates(input, projectId).gates[4].status, 'FAILED');
  input.workItems[projectId][0].status = 'VERIFIED';
  const otherId = 'PRJ-SYNTHETIC-OTHER'; input.projects[0].id = otherId;
  input.requirements[otherId] = []; input.workItems[otherId] = input.workItems[projectId];
  assert.equal(evaluateReleaseGates(input, otherId).gates[4].status, 'PENDING');
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
  assert.equal(report.gates[6].status, 'HUMAN_APPROVAL_REQUIRED'); assert.equal(report.signedOff, false); assert.equal(report.signoffDetails, undefined);
  assert.deepEqual(report.localSignoffObservations.approvalIds, ['APV-SYNTHETIC-ONLY']);
  assert.equal(report.localSignoffObservations.humanAuthorization, false);
  assert(!report.gates[6].details.includes('cryptographic audit ledger')); assert(!report.gates[6].details.includes('Authorized Human Signer'));
});

test('C15 audit signoff text including imported history remains observable without human authority', () => {
  const input = store();
  const event = createChainedAuditEvent({actor: 'Synthetic Audit Reviewer', action: 'RELEASE_GATE_APPROVED', target: 'DMK-165', reason: 'Inert evaluator fixture'});
  input.auditLogs[projectId] = [event];
  const report = evaluateReleaseGates(input, projectId);
  assert.equal(report.signedOff, false); assert.equal(report.signoffDetails, undefined);
  assert.deepEqual(report.localSignoffObservations.auditEventIds, [event.id]);
  const imported = createChainedAuditEvent({actor: 'Synthetic Importer', action: 'PACKAGE_IMPORTED', target: 'FIXTURE', previousEvent: event});
  input.auditLogs[projectId] = [imported, event];
  const importedReport = evaluateReleaseGates(input, projectId);
  assert.equal(importedReport.signedOff, false); assert.deepEqual(importedReport.localSignoffObservations.auditEventIds, [event.id]);
  assert.equal(importedReport.localSignoffObservations.humanAuthorization, false);
});

test('C16 historical lifecycle labels remain readable but cannot open release, and evaluation is read-only', () => {
  const input = store(); const before = structuredClone(input);
  const report = evaluateReleaseGates(input, projectId);
  assert.equal(report.releaseReady, false); assert.equal(report.signedOff, false);
  assert.deepEqual(report.capabilitiesSummary, {total: 25, verified: 0, percentage: 0});
  assert.deepEqual(input, before);
});

test('C17 absent questions stay pending while missing and unknown blocker states fail closed', () => {
  const input = store(); delete input.questions[projectId];
  const empty = evaluateReleaseGates(input, projectId).gates[0];
  assert.equal(empty.status, 'PENDING'); assert.deepEqual(empty.evidenceLinks, []);
  const missing = {...structuredClone(INITIAL_QUESTIONS[0]), id: 'Q-MISSING', importance: 'BLOCKING' as const};
  delete (missing as any).state;
  input.questions[projectId] = [missing, {...missing, id: 'Q-UNKNOWN', state: 'UNKNOWN' as any}];
  const before = structuredClone(input), report = evaluateReleaseGates(input, projectId);
  assert.equal(report.gates[0].status, 'FAILED');
  assert.match(report.gates[0].details, /Q-MISSING=MISSING/); assert.match(report.gates[0].details, /Q-UNKNOWN=UNKNOWN/);
  assert.deepEqual(input, before);
});

test('C18 Gate1 reports every canonical or legacy blocker selector without inventing catalog evidence', () => {
  const input = store(), base = {...structuredClone(INITIAL_QUESTIONS[0]), state: 'UNRESOLVED' as const};
  input.questions[projectId] = [{...base, id: 'Q-IMPORTANCE', importance: 'BLOCKING'},
    {...base, id: 'Q-URGENCY', importance: 'RECOMMENDED', urgency: 'CRITICAL'} as any,
    {...base, id: 'Q-LEGACY-FLAG', importance: 'RECOMMENDED', isBlocking: true} as any,
    {...base, id: 'Q-CANONICAL-FLAG', importance: 'RECOMMENDED', blocking: true}];
  const gate = evaluateReleaseGates(input, projectId).gates[0]; assert.equal(gate.status, 'FAILED');
  for (const id of ['Q-IMPORTANCE', 'Q-URGENCY', 'Q-LEGACY-FLAG', 'Q-CANONICAL-FLAG']) assert(gate.details.includes(id));
  assert.deepEqual(gate.evidenceLinks, []);
});

for (const [number, state] of [[19, 'ANSWERED'], [20, 'DEFERRED'], [21, 'NOT_APPLICABLE']] as const) {
  test(`C${number} Gate1 exposes ${state} labels without authenticating answers acceptance or applicability`, () => {
    const input = store(); input.questions[projectId] = [{...structuredClone(INITIAL_QUESTIONS[0]),
      id: 'Q-LOCAL-STATE', importance: 'BLOCKING', state, answer: undefined, justification: undefined}];
    const gate = evaluateReleaseGates(input, projectId).gates[0];
    assert.equal(gate.status, 'PENDING'); assert.match(gate.details, new RegExp(`Q-LOCAL-STATE=${state}`));
    assert.match(gate.details, /do not authenticate answers or formal risk acceptance/i);
    assert.deepEqual(gate.evidenceLinks, []);
  });
}
console.log(`Release evidence claims: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
