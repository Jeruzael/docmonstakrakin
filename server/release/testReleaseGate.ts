/**
 * Automated Verification Suite for DMK-165 / SEC-CTRL-020
 * v0.1 Definition-of-Done Review & Release Gate
 */

import {
  evaluateReleaseGates,
  executeReleaseSignoff,
  V01_CAPABILITIES,
  type ProjectDataAccessor,
} from './releaseGateEvaluator.ts';
import {
  createChainedAuditEvent,
  verifyAuditLedgerChain,
  GENESIS_AUDIT_HASH,
} from '../security/auditImmutability.ts';
import {
  INITIAL_PROJECTS,
  INITIAL_QUESTIONS,
  INITIAL_REQUIREMENTS,
  INITIAL_WORK_ITEMS,
  INITIAL_AUDIT_EVENTS,
  INITIAL_APPROVALS,
} from '../../src/data/initialData.ts';
import type { AuditEvent } from '../../src/types.ts';

function createMockStore(): ProjectDataAccessor {
  // Deep clone initial data for test isolation
  const store: ProjectDataAccessor = {
    projects: JSON.parse(JSON.stringify(INITIAL_PROJECTS)),
    questions: {
      'PRJ-ATLAS-01': JSON.parse(JSON.stringify(INITIAL_QUESTIONS)),
    },
    requirements: {
      'PRJ-ATLAS-01': JSON.parse(JSON.stringify(INITIAL_REQUIREMENTS)),
    },
    workItems: {
      'PRJ-ATLAS-01': JSON.parse(JSON.stringify(INITIAL_WORK_ITEMS)),
    },
    auditLogs: {
      'PRJ-ATLAS-01': JSON.parse(JSON.stringify(INITIAL_AUDIT_EVENTS)),
    },
    approvals: {
      'PRJ-ATLAS-01': JSON.parse(JSON.stringify(INITIAL_APPROVALS)),
    },
    addAuditEvent(projectId, actor, action, target, reason, details) {
      const logs = this.auditLogs[projectId] || [];
      const event = createChainedAuditEvent({
        actor,
        action,
        target,
        reason,
        details,
        previousEvent: logs[0],
      });
      logs.unshift(event);
      return event;
    },
  };
  return store;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runReleaseGateTests() {
  console.log('=== DMK-165 / SEC-CTRL-020: v0.1 Release Gate Verification Suite ===\n');

  // Test 1: Capability Catalog Completeness
  console.log('--- Test Suite 1: Master Plan §68 Capability Catalog ---');
  assert(
    V01_CAPABILITIES.length === 25,
    'Catalog contains exactly 25 core MVP capabilities',
    `Found ${V01_CAPABILITIES.length}`
  );
  const uniqueDmk = new Set(V01_CAPABILITIES.map((c) => c.dmk));
  assert(
    uniqueDmk.size === 25,
    'All 25 capabilities map to unique DMK work items',
    `Unique count: ${uniqueDmk.size}`
  );

  // Test 2: Golden Project Baseline Evaluation
  console.log('\n--- Test Suite 2: Golden Project Baseline Gate Evaluation ---');
  const store = createMockStore();
  const report = evaluateReleaseGates(store, 'PRJ-ATLAS-01');

  assert(report.gates.length === 7, 'Evaluates all 7 release gates');
  assert(report.gates[0].status === 'PASSED', 'Gate 1 (Zero Unresolved Blockers) PASSED');
  assert(report.gates[1].status === 'PASSED', 'Gate 2 (100% Core Requirements Verification) PASSED');
  assert(report.gates[2].status === 'PASSED', 'Gate 3 (SecretStore Integration Complete) PASSED');
  assert(report.gates[3].status === 'PASSED', 'Gate 4 (Security Regression Suite) PASSED');
  assert(report.gates[4].status === 'PASSED', 'Gate 5 (Golden Reference Execution & Package) PASSED');
  assert(report.gates[5].status === 'PASSED', 'Gate 6 (Cryptographic Audit Ledger Integrity) PASSED');
  assert(report.gates[6].status === 'HUMAN_APPROVAL_REQUIRED' || report.gates[6].status === 'PENDING' || report.gates[6].status === 'PASSED', 'Gate 7 (Sign-off) in valid state');
  assert(report.releaseReady === true, 'releaseReady is TRUE (prerequisites satisfied)');
  assert(
    report.capabilitiesSummary.percentage >= 96,
    `Capabilities readiness meets MVP threshold (current: ${report.capabilitiesSummary.percentage}%)`
  );

  // Test 3: Negative Detection - Unresolved Blocking Question
  console.log('\n--- Test Suite 3: Negative Detection - Unresolved Blocker ---');
  const storeWithBlocker = createMockStore();
  storeWithBlocker.questions['PRJ-ATLAS-01'].push({
    id: 'BLOCK-TEST-01',
    category: 'AUTH',
    questionText: 'Test Blocker Question',
    state: 'UNRESOLVED',
    isBlocking: true,
    profiles: ['API_BACKEND'],
    dependencies: [],
  } as any);

  const blockerReport = evaluateReleaseGates(storeWithBlocker, 'PRJ-ATLAS-01');
  assert(
    blockerReport.gates[0].status === 'FAILED',
    'Gate 1 correctly FAILS when an unresolved blocker exists'
  );
  assert(
    blockerReport.releaseReady === false,
    'releaseReady is FALSE when Gate 1 fails'
  );

  const signoffAttempt = executeReleaseSignoff(
    storeWithBlocker,
    'PRJ-ATLAS-01',
    'Project Lead'
  );
  assert(
    signoffAttempt.success === false,
    'Sign-off rejected when prerequisite gates fail'
  );

  // Test 4: Negative Detection - Missing Requirement Verification
  console.log('\n--- Test Suite 4: Negative Detection - Missing Requirement Verification ---');
  const storeWithUnverifiedReq = createMockStore();
  storeWithUnverifiedReq.requirements['PRJ-ATLAS-01'].push({
    id: 'REQ-FAIL-01',
    title: 'Unverified Critical Requirement',
    category: 'SECURITY',
    statement: 'Must be verified before release',
    priority: 'CRITICAL',
    status: 'PROPOSED',
    source: { type: 'standard_control', id: 'SEC-CTRL-001' },
    threatLinks: [],
    standardLinks: [],
    riskLinks: [],
    workItems: [],
    tests: [],
    evidence: [],
    updatedAt: new Date().toISOString(),
  });

  const reqReport = evaluateReleaseGates(storeWithUnverifiedReq, 'PRJ-ATLAS-01');
  assert(
    reqReport.gates[1].status === 'FAILED',
    'Gate 2 correctly FAILS when a P0 requirement is PROPOSED / unverified'
  );
  assert(
    reqReport.releaseReady === false,
    'releaseReady is FALSE when Gate 2 fails'
  );

  // Test 5: Negative Detection - Audit Chain Tampering
  console.log('\n--- Test Suite 5: Negative Detection - Audit Chain Tampering ---');
  const storeWithTamperedAudit = createMockStore();
  // Tamper with an audit event's reason while keeping its stateHash
  const targetEvent = storeWithTamperedAudit.auditLogs['PRJ-ATLAS-01'][2];
  if (targetEvent) {
    targetEvent.reason = 'MALICIOUS_UNAUTHORIZED_MUTATION';
  }

  const tamperedReport = evaluateReleaseGates(storeWithTamperedAudit, 'PRJ-ATLAS-01');
  assert(
    tamperedReport.gates[5].status === 'FAILED',
    'Gate 6 correctly FAILS when audit ledger hash chain is tampered'
  );
  assert(
    tamperedReport.auditChainIntegrity.valid === false,
    'Audit chain validity reported as FALSE'
  );

  // Test 6: Happy Path - Release Sign-Off Execution Ceremony
  console.log('\n--- Test Suite 6: Release Sign-Off Execution Ceremony ---');
  const cleanStore = createMockStore();
  const signoffResult = executeReleaseSignoff(
    cleanStore,
    'PRJ-ATLAS-01',
    'Project Lead / Security Lead (Gio)',
    'Formal v0.1 Definition-of-Done review certified; all 25 core capabilities verified across 7 release gates.'
  );

  assert(signoffResult.success === true, 'Sign-off executes successfully on clean store');
  assert(
    signoffResult.report.allGatesPassed === true,
    'All 7 release gates report PASSED after sign-off'
  );
  assert(
    signoffResult.report.signedOff === true,
    'signedOff state is TRUE'
  );
  assert(
    signoffResult.report.signoffDetails?.actor === 'Project Lead / Security Lead (Gio)',
    'Sign-off actor accurately captured in report'
  );

  // Verify WorkItem DMK-165
  const dmk165 = cleanStore.workItems['PRJ-ATLAS-01'].find((w) => w.id === 'DMK-165');
  assert(dmk165?.status === 'VERIFIED', 'WorkItem DMK-165 status transitioned to VERIFIED');
  assert(
    dmk165?.evidence?.includes('EV-165') === true,
    'WorkItem DMK-165 links to evidence EV-165'
  );
  assert(
    dmk165?.checklist?.every((c) => c.done) === true,
    'All DMK-165 checklist items marked done'
  );

  // Verify Project Release Readiness
  const updatedProject = cleanStore.projects.find((p) => p.id === 'PRJ-ATLAS-01');
  assert(
    updatedProject?.progress?.releaseReadiness === 100,
    'Project release readiness reached 100%'
  );
  assert(
    updatedProject?.healthScore === 100,
    'Project health score maintained at 100%'
  );

  // Verify Audit Chain Preservation
  const postSignoffAudit = verifyAuditLedgerChain(
    cleanStore.auditLogs['PRJ-ATLAS-01'],
    'REVERSE_CHRONOLOGICAL'
  );
  assert(
    postSignoffAudit.valid === true,
    'Post-signoff audit chain maintains 100% cryptographic integrity (0 breaks)'
  );
  assert(
    cleanStore.auditLogs['PRJ-ATLAS-01'][0].action === 'RELEASE_GATE_APPROVED',
    'Newest audit event is RELEASE_GATE_APPROVED'
  );

  // Summary
  console.log(`\n=== Verification Results: ${passedTests}/${totalTests} Tests Passed ===`);
  if (passedTests === totalTests) {
    console.log('✓ All Release Gate verification invariants SATISFIED.\n');
  } else {
    console.error(`✗ ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runReleaseGateTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
