import assert from 'node:assert/strict';
import {evaluateReleaseGates, executeReleaseSignoff, type ProjectDataAccessor} from './releaseGateEvaluator.ts';
import {createChainedAuditEvent} from '../security/auditImmutability.ts';
import {INITIAL_PROJECTS, INITIAL_REQUIREMENTS, INITIAL_WORK_ITEMS, INITIAL_QUESTIONS} from '../../src/data/initialData.ts';

// Inert records only: a stored VERIFIED label and a hash chain are not a trusted
// acquisition, independent reviewer, accepted root, or release decision.
const projectId = 'PRJ-SCOPED-RELEASE';
function fixture(ids = ['DMK-017', 'DMK-156', 'DMK-157', 'DMK-158', 'DMK-159']): ProjectDataAccessor {
  const project = {...structuredClone(INITIAL_PROJECTS[0]), id: projectId, targetRelease: 'candidate-20261022',
    readinessContext: {version: 'LOCAL_RELEASE_SCOPE/1' as const, id: 'RSC-FIXTURE', revision: 2,
      targetRelease: 'candidate-20261022', workItemIds: ids, commitSha: '7c20c82856bd7a3be2d97d8f1bb6c59fe3459732',
      buildRevision: 'build-fixture', environment: 'DISCONNECTED_TEST', updatedAt: '2026-10-22T00:00:00Z',
      updatedBy: {identityId: 'FIXTURE', name: 'Inert fixture', roleSource: 'LOCAL_SERVER_ROSTER' as const}}};
  const event = createChainedAuditEvent({actor: 'Inert fixture', action: 'FIXTURE_CREATED', target: projectId});
  return {projects: [project], questions: {[projectId]: []},
    requirements: {[projectId]: [{...structuredClone(INITIAL_REQUIREMENTS[0]), id: 'REQ-SCOPE', priority: 'HIGH',
      status: 'APPROVED', workItems: ['DMK-017'], evidence: ['LOCAL-REFERENCE']}]},
    workItems: {[projectId]: ids.map(id => ({...structuredClone(INITIAL_WORK_ITEMS[0]), id, status: 'VERIFIED', evidence: [`LOCAL-${id}`]}))},
    auditLogs: {[projectId]: [event]}, approvals: {[projectId]: []}};
}
let passed = 0, failed = 0;
function test(name: string, run: () => void) {
  try {run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);}
}
const report = (input = fixture()): any => evaluateReleaseGates(input, projectId);

test('O1 stored lifecycle and references never establish production gate success or capability verification', () => {
  const value = report();
  assert(value.gates.every((gate: any) => gate.status !== 'PASSED'));
  assert(value.capabilities.every((capability: any) => capability.status !== 'VERIFIED'));
  assert.deepEqual(value.capabilitiesSummary, {total: 25, verified: 0, percentage: 0});
  assert.equal(value.releaseReady, false); assert.equal(value.allGatesPassed, false);
});
test('O2 exact release identity and task scope are returned without static Atlas or milestone substitution', () => {
  const value = report();
  assert.equal(value.evaluationScope.status, 'BOUND');
  assert.deepEqual(value.evaluationScope.scope, {projectId, targetRelease: 'candidate-20261022',
    workItemIds: ['DMK-017', 'DMK-156', 'DMK-157', 'DMK-158', 'DMK-159'],
    commitSha: '7c20c82856bd7a3be2d97d8f1bb6c59fe3459732', buildRevision: 'build-fixture', environment: 'DISCONNECTED_TEST',
    scopeId: 'RSC-FIXTURE', scopeRevision: 2});
  assert.equal(value.targetMilestone, 'candidate-20261022');
});
test('O3 missing drifted malformed ambiguous and incomplete scope fail closed with explicit rationale', () => {
  const mutations: Array<(input: ProjectDataAccessor) => void> = [
    input => {delete input.projects[0].readinessContext;},
    input => {input.projects[0].readinessContext!.targetRelease = 'OLD';},
    input => {input.projects[0].readinessContext!.commitSha = 'short';},
    input => {input.projects.push(structuredClone(input.projects[0]));},
    input => {input.workItems[projectId].pop();},
    input => {input.workItems[projectId].push(structuredClone(input.workItems[projectId][0]));},
    input => {input.workItems[projectId][0].status = 'UNKNOWN' as any;},
    input => {input.projects[0].readinessContext!.workItemIds.push('DMK-017');},
  ];
  for (const mutate of mutations) {
    const input = fixture(); mutate(input); const value = report(input);
    assert.notEqual(value.evaluationScope.status, 'BOUND'); assert.equal(value.evaluationScope.scope, null);
    assert(value.evaluationScope.reason.length > 0); assert.equal(value.gates.length, 7); assert.equal(value.capabilities.length, 25);
    assert(!value.releaseReady); assert(value.capabilities.every((capability: any) => capability.status === 'PENDING'));
  }
});
test('O4 out-of-scope work never contributes verification references or silently disappears', () => {
  const input = fixture(['DMK-017']);
  input.workItems[projectId].push({...structuredClone(INITIAL_WORK_ITEMS[0]), id: 'DMK-020', status: 'VERIFIED', evidence: ['OUTSIDE']});
  const value = report(input), outside = value.capabilities.find((capability: any) => capability.referenceDmk === 'DMK-027');
  assert.equal(value.capabilities.length, 25); assert.equal(outside.applicability, 'OUT_OF_SCOPE');
  assert.equal(outside.status, 'PENDING'); assert.equal(outside.evidence, ''); assert(outside.rationale.length > 0);
  const inside = value.capabilities[0]; assert.equal(inside.status, 'IMPLEMENTED'); assert.equal(inside.sourceWorkItemId, 'DMK-017');
});
test('O5 Gate1 retains blockers and unknown decisions as failures without fabricated catalog evidence', () => {
  for (const state of ['UNRESOLVED', 'DEFERRED', 'NOT_APPLICABLE', 'UNKNOWN']) {
    const input = fixture(); input.questions[projectId] = [{...structuredClone(INITIAL_QUESTIONS[0]), id: 'Q-BLOCK', importance: 'BLOCKING', state: state as any}];
    const gate = report(input).gates[0];
    assert.equal(gate.status, state === 'UNRESOLVED' || state === 'UNKNOWN' ? 'FAILED' : 'PENDING');
    assert.deepEqual(gate.evidenceLinks, []); assert(gate.details.includes('Q-BLOCK'));
  }
});
test('O6 local core approval failures remain visible and references cannot authenticate tests', () => {
  const input = fixture(); input.requirements[projectId][0].status = 'PROPOSED';
  const gate = report(input).gates[1]; assert.equal(gate.status, 'FAILED'); assert(gate.details.includes('REQ-SCOPE'));
  input.requirements[projectId][0].status = 'APPROVED';
  assert.equal(report(input).gates[1].status, 'PENDING');
  assert.equal(report(input).productionEvidence.trustedProductionEvidence, false);
});
test('O7 valid local audit bytes remain distinct from production integrity and an empty ledger stays pending', () => {
  const input = fixture(), value = report(input);
  assert.equal(value.auditChainIntegrity.valid, true); assert.equal(value.auditChainIntegrity.trust, 'LOCAL_STORED_BYTES_ONLY');
  assert.equal(value.gates[5].status, 'PENDING'); assert.deepEqual(value.gates[5].evidenceLinks, []);
  input.auditLogs[projectId] = []; assert.equal(report(input).gates[5].status, 'PENDING');
  assert.equal(report(input).gates[5].localCheck.status, 'PENDING');
});
test('O8 malformed hashes and tampered local chains remain failed rather than ignored', () => {
  const input = fixture(); input.auditLogs[projectId][0].stateHash = 'legacy-short';
  assert.equal(report(input).gates[5].status, 'FAILED'); assert.equal(report(input).auditChainIntegrity.valid, false);
  input.auditLogs[projectId] = fixture().auditLogs[projectId]; input.auditLogs[projectId][0].reason = 'tampered';
  assert.equal(report(input).gates[5].status, 'FAILED');
});
test('O9 local signoff text and imported approvals never impersonate independent human release authorization', () => {
  const input = fixture(); input.auditLogs[projectId] = [createChainedAuditEvent({actor: 'Synthetic reviewer', action: 'RELEASE_GATE_APPROVED', target: 'DMK-165'})];
  input.approvals[projectId] = [{id: 'UNTRUSTED-APPROVAL', type: 'RELEASE_SIGNOFF', status: 'APPROVED'} as any];
  const value = report(input); assert.equal(value.signedOff, false); assert.equal(value.signoffDetails, undefined);
  assert.equal(value.gates[6].status, 'HUMAN_APPROVAL_REQUIRED');
  assert.equal(value.localSignoffObservations.auditEventIds.length, 1); assert.deepEqual(value.localSignoffObservations.approvalIds, ['UNTRUSTED-APPROVAL']);
  assert.equal(value.localSignoffObservations.humanAuthorization, false);
});
test('O10 all gates expose a local check and rationale while trusted production acquisition stays explicitly unavailable', () => {
  const value = report();
  assert.equal(value.productionEvidence.status, 'UNAVAILABLE'); assert.equal(value.productionEvidence.reasonCode, 'TRUST_ROOTS_NOT_ACCEPTED');
  for (const gate of value.gates) {assert(gate.localCheck); assert(gate.details.length > 0); assert(Array.isArray(gate.localCheck.subjectIds));}
  assert.equal(value.gates[4].status, 'PENDING'); assert(!value.gates[4].details.includes('minimum 4'));
});
test('O11 refusal and repeated read preserve every stored lifecycle approval planning and audit byte', () => {
  const input = fixture(), before = structuredClone(input);
  let writes = 0; input.addAuditEvent = () => {writes++; throw new Error('Must never write');};
  const result = executeReleaseSignoff(input, projectId, 'Synthetic fixture', 'No real ceremony');
  assert.equal(result.success, false); assert.equal(writes, 0); assert.equal(result.auditEvent, undefined);
  const {addAuditEvent, ...after} = input; assert.deepEqual(after, before);
  report(input); assert.deepEqual(after, before);
});
console.log(`Operational release evidence: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
