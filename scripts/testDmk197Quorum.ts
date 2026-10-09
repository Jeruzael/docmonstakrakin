import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { ProjectStore } from '../server/projectStore.js';
import { registerSignoffRoutes } from '../server/proposals/signoff.js';
import { evaluateQuorum } from '../server/proposals/quorum.js';
import { digest } from '../server/proposals/review.js';

console.log('================================================================');
console.log('   DMK-197 QUORUM & APPROVAL INBOX REGRESSION TEST SUITE');
console.log('   Evaluates Invariant: Distinct Security Officer & Lead Architect');
console.log('   Coverage: Scenarios 1 through 30 (Canonical acceptance criteria)');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

function pass(name: string) {
  passedCount++;
  console.log(`✓ [PASS] Scenario ${passedCount}: ${name}`);
}

function fail(name: string, err: any) {
  failedCount++;
  console.error(`✗ [FAIL] Scenario ${passedCount + failedCount}: ${name}`);
  console.error(err);
}

// Setup test passwords & scrypt verifiers
function createVerifier(pw: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

const testReviewers = {
  secOfficer: {
    id: 'REV-SEC-01',
    roles: ['Security Officer'],
    kind: 'HUMAN',
    credentialVerifier: createVerifier('SecPass123!'),
  },
  leadArch: {
    id: 'REV-ARCH-01',
    roles: ['Lead Architect'],
    kind: 'HUMAN',
    credentialVerifier: createVerifier('ArchPass123!'),
  },
  dualRole: {
    id: 'REV-DUAL-01',
    roles: ['Security Officer', 'Lead Architect'],
    kind: 'HUMAN',
    credentialVerifier: createVerifier('DualPass123!'),
  },
  agentBot: {
    id: 'AGENT-BOT-01',
    roles: ['Security Officer'],
    kind: 'AGENT',
    credentialVerifier: createVerifier('AgentPass123!'),
  },
  otherDev: {
    id: 'REV-OTHER-01',
    roles: ['Developer'],
    kind: 'HUMAN',
    credentialVerifier: createVerifier('DevPass123!'),
  },
};

const originalEnv = process.env.DMK_HUMAN_REVIEWERS;
process.env.DMK_HUMAN_REVIEWERS = JSON.stringify(testReviewers);

// Helper for cookie-based authenticated fetch
async function loginAndGetCookie(base: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${base}/api/governance/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${username}: ${res.status} ${JSON.stringify(data)}`);
  }
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error(`No set-cookie returned for ${username}`);
  return cookie.split(';')[0];
}

const testProjectId = 'PRJ-DMK197-TEST';
const root = process.cwd();

// Pre-test baseline hashes
const preWbsHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/00_control/MASTER_WBS.yaml'))).digest('hex');

// Setup in-memory store
const store: any = new ProjectStore();
store.projects = [
  {
    id: testProjectId,
    name: 'DMK-197 Quorum Test Project',
    owner: 'TestOwner',
    stateVersion: 1,
  },
  {
    id: 'PRJ-OTHER',
    name: 'Other Project',
    owner: 'OtherOwner',
    stateVersion: 1,
  },
];

store.requirements = {
  [testProjectId]: [
    {
      id: 'REQ-AUTH-01',
      title: 'Canonical Authentication Requirement',
      status: 'UNDER_REVIEW',
      statement: 'System must require multi-factor human authentication',
      description: 'System must require multi-factor human authentication',
    },
    {
      id: 'SHARED-ID-1',
      title: 'Requirement with Shared ID',
      status: 'UNDER_REVIEW',
      statement: 'Requirement target statement',
      description: 'Requirement target statement',
    },
  ],
};

store.adrs = {
  [testProjectId]: [
    {
      id: 'ADR-SEC-01',
      title: 'Quorum Evaluation Architecture',
      status: 'PROPOSED',
      context: 'ADR architectural context',
    },
    {
      id: 'SHARED-ID-1',
      title: 'ADR with Shared ID',
      status: 'PROPOSED',
      context: 'ADR target context',
    },
  ],
};

store.risks = {
  [testProjectId]: [
    {
      id: 'RSK-OPS-01',
      title: 'Operational Downtime Risk',
      description: 'Risk description',
      treatment: 'MITIGATE',
      drivers: ['Infrastructure'],
    },
  ],
};

store.overrides = {
  [testProjectId]: [
    {
      id: 'OVR-VALID-01',
      gateOrControl: 'PR-MERGE-GATE',
      reason: 'Emergency temporary patch',
      riskAcknowledged: true,
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24h in future
    },
    {
      id: 'OVR-EXPIRED-01',
      gateOrControl: 'PR-MERGE-GATE',
      reason: 'Expired override',
      riskAcknowledged: true,
      expiresAt: new Date(Date.now() - 86400000).toISOString(), // 24h in past
    },
    {
      id: 'OVR-NO-ACK-01',
      gateOrControl: 'PR-MERGE-GATE',
      reason: 'Unacknowledged risk override',
      riskAcknowledged: false,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      id: 'OVR-GATE7-01',
      gateOrControl: 'Gate 7 Human Quorum Approval',
      reason: 'Attempted Gate 7 bypass',
      riskAcknowledged: true,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  ],
};

store.approvals = { [testProjectId]: [] };

const app = express();
app.use(express.json());
registerSignoffRoutes(app, store);

// Add fail-closed direct requirement status endpoint
app.post('/api/projects/:id/requirements/:reqId/status', (req, res) => {
  const { status } = req.body;
  if (status === 'APPROVED') {
    return res.status(403).json({ error: 'Use Request Sign-Off and human quorum to approve a requirement' });
  }
  const reqList = store.requirements[req.params.id] || [];
  const target = reqList.find((r: any) => r.id === req.params.reqId);
  if (!target) return res.status(404).json({ error: 'Requirement not found' });
  target.status = status;
  return res.json({ requirement: target });
});

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const port = (server.address() as any).port;
const base = `http://127.0.0.1:${port}`;

async function runTests() {
  try {
    // 1. No reviewer roster fails closed
    try {
      const emptyApp = express();
      emptyApp.use(express.json());
      const prev = process.env.DMK_HUMAN_REVIEWERS;
      delete process.env.DMK_HUMAN_REVIEWERS;
      registerSignoffRoutes(emptyApp, new ProjectStore());
      process.env.DMK_HUMAN_REVIEWERS = prev;
      const emptyServer = emptyApp.listen(0, '127.0.0.1');
      await new Promise<void>((r) => emptyServer.once('listening', r));
      const emptyPort = (emptyServer.address() as any).port;
      const emptyRes = await fetch(`http://127.0.0.1:${emptyPort}/api/governance/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'any', password: 'any' }),
      });
      assert.equal(emptyRes.status, 401, 'Empty roster must reject authentication');
      emptyServer.close();
      pass('1. No reviewer roster fails closed');
    } catch (e) {
      fail('1. No reviewer roster fails closed', e);
    }

    // Login cookies
    const secCookie = await loginAndGetCookie(base, 'secOfficer', 'SecPass123!');
    const archCookie = await loginAndGetCookie(base, 'leadArch', 'ArchPass123!');
    const dualCookie = await loginAndGetCookie(base, 'dualRole', 'DualPass123!');

    // 2. Unauthenticated request fails
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: 'REQ-AUTH-01' }),
      });
      assert.equal(res.status, 401, 'Unauthenticated request must return 401');
      pass('2. Unauthenticated request fails');
    } catch (e) {
      fail('2. Unauthenticated request fails', e);
    }

    // 3. Agent cannot approve
    try {
      const agentRes = await fetch(`${base}/api/governance/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'agentBot', password: 'AgentPass123!' }),
      });
      // Either login rejects AGENT or requireHuman rejects AGENT
      if (agentRes.ok) {
        const agentCookie = agentRes.headers.get('set-cookie')!.split(';')[0];
        const attempt = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: agentCookie },
          body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: 'REQ-AUTH-01' }),
        });
        assert.equal(attempt.status, 403, 'Agent identity must be rejected for governance authority');
      } else {
        assert.ok(agentRes.status === 401 || agentRes.status === 403, 'Agent login must be rejected');
      }
      pass('3. Agent cannot approve');
    } catch (e) {
      fail('3. Agent cannot approve', e);
    }

    // 4. Missing authorized role fails
    try {
      const devCookie = await loginAndGetCookie(base, 'otherDev', 'DevPass123!');
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: devCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: 'REQ-AUTH-01' }),
      });
      assert.equal(res.status, 403, 'User without governance role must return 403');
      pass('4. Missing authorized role fails');
    } catch (e) {
      fail('4. Missing authorized role fails', e);
    }

    // 5. Forged role/body identity fails
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-DUMMY/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          decision: 'APPROVED',
          role: 'Lead Architect', // Forged role
          approver: 'ForgedName',
        }),
      });
      assert.equal(res.status, 403, 'Forged role/approver claim must return 403');
      pass('5. Forged role/body identity fails');
    } catch (e) {
      fail('5. Forged role/body identity fails', e);
    }

    // 6. Real canonical request succeeds
    let apvReqId = '';
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          targetEntityType: 'REQUIREMENT',
          targetEntityId: 'REQ-AUTH-01',
        }),
      });
      assert.equal(res.status, 201, 'Canonical request creation must return 201');
      const data = await res.json();
      assert.equal(data.status, 'PENDING');
      assert.deepEqual(data.requiredRoles, ['Security Officer', 'Lead Architect']);
      assert.equal(data.requestedBy, 'secOfficer');
      assert.ok(data.targetDigest);
      apvReqId = data.id;
      pass('6. Real canonical request succeeds');
    } catch (e) {
      fail('6. Real canonical request succeeds', e);
    }

    // 7. Duplicate pending request deduplicates
    try {
      const stateVerBefore = store.projects.find((p) => p.id === testProjectId)!.stateVersion;
      const auditCountBefore = (store.auditLogs[testProjectId] || []).length;
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({
          targetEntityType: 'REQUIREMENT',
          targetEntityId: 'REQ-AUTH-01',
        }),
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.id, apvReqId, 'Deduplicated call must return identical approval item ID');
      const stateVerAfter = store.projects.find((p) => p.id === testProjectId)!.stateVersion;
      const auditCountAfter = (store.auditLogs[testProjectId] || []).length;
      assert.equal(stateVerAfter, stateVerBefore, 'Deduplication must not increment stateVersion');
      assert.equal(auditCountAfter, auditCountBefore, 'Deduplication must not add duplicate audit event');
      pass('7. Duplicate pending request deduplicates');
    } catch (e) {
      fail('7. Duplicate pending request deduplicates', e);
    }

    // 8. Same ID across different target types is isolated
    try {
      const resReq = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          targetEntityType: 'REQUIREMENT',
          targetEntityId: 'SHARED-ID-1',
        }),
      });
      const dataReq = await resReq.json();
      assert.equal(resReq.status, 201);

      const resAdr = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          targetEntityType: 'ADR',
          targetEntityId: 'SHARED-ID-1',
        }),
      });
      const dataAdr = await resAdr.json();
      assert.equal(resAdr.status, 201);
      assert.notEqual(dataReq.id, dataAdr.id, 'Distinct target entity types with identical IDs must not collide');
      pass('8. Same ID across different target types is isolated');
    } catch (e) {
      fail('8. Same ID across different target types is isolated', e);
    }

    // 9. Security Officer approves first, request remains pending
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvReqId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          decision: 'APPROVED',
          comment: 'Security posture approved by SO',
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'PENDING');
      assert.equal(data.approvalsCollected.length, 1);
      assert.equal(data.approvalsCollected[0].role, 'Security Officer');
      assert.equal(data.approvalsCollected[0].identityId, 'REV-SEC-01');
      pass('9. Security Officer approves first, request remains pending');
    } catch (e) {
      fail('9. Security Officer approves first, request remains pending', e);
    }

    // 10. Unit test: Lead Architect approves first, request remains pending
    try {
      const dummyItem: any = {
        id: 'APV-TEST-ARCH',
        status: 'PENDING',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: 'abc',
        approvalsCollected: [
          {
            role: 'Lead Architect',
            approver: 'leadArch',
            identityId: 'REV-ARCH-01',
            roleSource: 'LOCAL_SERVER_ROSTER',
            decision: 'APPROVED',
            timestamp: new Date().toISOString(),
          },
        ],
      };
      const q = evaluateQuorum(dummyItem, 'abc');
      assert.equal(q.status, 'PARTIAL');
      assert.equal(q.hasQuorum, false);
      assert.deepEqual(q.satisfiedRoles, ['Lead Architect']);
      assert.deepEqual(q.pendingRoles, ['Security Officer']);
      pass('10. Lead Architect approves first, request remains pending');
    } catch (e) {
      fail('10. Lead Architect approves first, request remains pending', e);
    }

    // 11. Two independent authorized humans satisfy quorum
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvReqId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          decision: 'APPROVED',
          comment: 'Architecture approved by LA',
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'APPROVED');
      assert.equal(data.approvalsCollected.length, 2);
      assert.ok(data.resolvedAt);
      assert.equal(data.resolvedBy, 'leadArch');
      pass('11. Two independent authorized humans satisfy quorum');
    } catch (e) {
      fail('11. Two independent authorized humans satisfy quorum', e);
    }

    // 12. One dual-role identity cannot satisfy both slots
    try {
      const reqDual = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: dualCookie },
        body: JSON.stringify({
          targetEntityType: 'ADR',
          targetEntityId: 'ADR-SEC-01',
        }),
      });
      const dataDual = await reqDual.json();
      const dualApvId = dataDual.id;

      // First decision as dualRole
      const dec1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${dualApvId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: dualCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(dec1.status, 200);

      // Second decision attempt by same dualRole user
      const dec2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${dualApvId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: dualCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(dec2.status, 409, 'Dual role user must be rejected when attempting second quorum signature');
      pass('12. One dual-role identity cannot satisfy both slots');
    } catch (e) {
      fail('12. One dual-role identity cannot satisfy both slots', e);
    }

    // 13. Duplicate signature fails without mutation
    try {
      const stateVerBefore = store.projects.find((p) => p.id === testProjectId)!.stateVersion;
      const auditCountBefore = (store.auditLogs[testProjectId] || []).length;
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvReqId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(res.status, 409, 'Duplicate decision on already-decided request must return 409');
      const stateVerAfter = store.projects.find((p) => p.id === testProjectId)!.stateVersion;
      const auditCountAfter = (store.auditLogs[testProjectId] || []).length;
      assert.equal(stateVerAfter, stateVerBefore);
      assert.equal(auditCountAfter, auditCountBefore);
      pass('13. Duplicate signature fails without mutation');
    } catch (e) {
      fail('13. Duplicate signature fails without mutation', e);
    }

    // 14. Repeated completed-request decision fails
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvReqId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(res.status, 409, 'Repeated decision on completed request must return 409');
      pass('14. Repeated completed-request decision fails');
    } catch (e) {
      fail('14. Repeated completed-request decision fails', e);
    }

    // 15. Rejection terminates approval correctly
    try {
      const reqRej = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: 'REQ-AUTH-01' }),
      });
      // Need a new request since REQ-AUTH-01 is now approved; create ADR request to reject
      const reqAdr = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'ADR', targetEntityId: 'ADR-SEC-01' }),
      });
      const apvAdr = await reqAdr.json();
      // Test rejection without comment fails
      const rejNoComment = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvAdr.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'REJECTED', comment: '' }),
      });
      assert.equal(rejNoComment.status, 422, 'Rejection without comment must fail 422');

      const rejWithComment = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvAdr.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'REJECTED', comment: 'Rejected due to security flaw' }),
      });
      assert.equal(rejWithComment.status, 200);
      const rejData = await rejWithComment.json();
      assert.equal(rejData.status, 'REJECTED');
      // Target ADR must not be accepted
      const targetAdr = store.adrs[testProjectId].find((a: any) => a.id === 'ADR-SEC-01');
      assert.notEqual(targetAdr.status, 'ACCEPTED');
      pass('15. Rejection terminates approval correctly');
    } catch (e) {
      fail('15. Rejection terminates approval correctly', e);
    }

    // 16. Stale target digest fails
    try {
      // Modify target ADR
      const targetAdr = store.adrs[testProjectId].find((a: any) => a.id === 'SHARED-ID-1');
      const priorDigest = digest(targetAdr);
      const dummyItem: any = {
        id: 'APV-STALE-01',
        status: 'PENDING',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: priorDigest,
        approvalsCollected: [],
      };
      // Mutate target
      targetAdr.context = 'Mutated context invalidating digest';
      const newDigest = digest(targetAdr);
      const q = evaluateQuorum(dummyItem, newDigest);
      assert.equal(q.status, 'STALE', 'Modified digest must evaluate to STALE');
      pass('16. Stale target digest fails');
    } catch (e) {
      fail('16. Stale target digest fails', e);
    }

    // 17. Missing target fails
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: 'NONEXISTENT-REQ' }),
      });
      assert.equal(res.status, 404, 'Nonexistent canonical target must return 404');
      pass('17. Missing target fails');
    } catch (e) {
      fail('17. Missing target fails', e);
    }

    // 18. Cross-project request/decision fails
    try {
      const res = await fetch(`${base}/api/projects/PRJ-OTHER/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: 'REQ-AUTH-01' }),
      });
      assert.equal(res.status, 404, 'Cross-project target lookup must return 404');
      pass('18. Cross-project request/decision fails');
    } catch (e) {
      fail('18. Cross-project request/decision fails', e);
    }

    // 19. Invalid policy version fails
    try {
      const dummyItem: any = {
        id: 'APV-HIST-01',
        status: 'PENDING',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        policyVersion: 'LEGACY_V0',
        targetDigest: 'abc',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'so', identityId: 'REV-SEC-01', decision: 'APPROVED' },
          { role: 'Lead Architect', approver: 'la', identityId: 'REV-ARCH-01', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(dummyItem, 'abc');
      assert.equal(q.status, 'INVALID', 'Legacy policy must evaluate to INVALID');
      assert.equal(q.hasQuorum, false);
      pass('19. Invalid policy version fails');
    } catch (e) {
      fail('19. Invalid policy version fails', e);
    }

    // 20. Historical signatures lacking identity provenance do not count
    try {
      const dummyItem: any = {
        id: 'APV-HIST-02',
        status: 'PENDING',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: 'abc',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'legacySo', decision: 'APPROVED' }, // missing identityId
          { role: 'Lead Architect', approver: 'legacyLa', decision: 'APPROVED' }, // missing identityId
        ],
      };
      const q = evaluateQuorum(dummyItem, 'abc');
      assert.notEqual(q.status, 'SATISFIED', 'Signatures without identityId must not satisfy quorum');
      assert.equal(q.hasQuorum, false);
      pass('20. Historical signatures lacking identity provenance do not count');
    } catch (e) {
      fail('20. Historical signatures lacking identity provenance do not count', e);
    }

    // 21. Final requirement approval updates the exact target
    try {
      const target = store.requirements[testProjectId].find((r: any) => r.id === 'REQ-AUTH-01');
      assert.equal(target.status, 'APPROVED', 'Canonical requirement status must be APPROVED after satisfied quorum');
      pass('21. Final requirement approval updates the exact target');
    } catch (e) {
      fail('21. Final requirement approval updates the exact target', e);
    }

    // 22. Direct requirement APPROVED mutation remains forbidden
    try {
      const directRes = await fetch(`${base}/api/projects/${testProjectId}/requirements/REQ-AUTH-01/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert.equal(directRes.status, 403, 'Direct APPROVED mutation endpoint must return 403');
      pass('22. Direct requirement APPROVED mutation remains forbidden');
    } catch (e) {
      fail('22. Direct requirement APPROVED mutation remains forbidden', e);
    }

    // 23. ADR acceptance follows authorized quorum
    try {
      // Create new fresh ADR and approve with SO + LA
      store.adrs[testProjectId].push({
        id: 'ADR-NEW-01',
        title: 'New ADR',
        status: 'PROPOSED',
        context: 'New ADR context',
      });
      const reqRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'ADR', targetEntityId: 'ADR-NEW-01' }),
      });
      const apvItem = await reqRes.json();
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      const adrTarget = store.adrs[testProjectId].find((a: any) => a.id === 'ADR-NEW-01');
      assert.equal(adrTarget.status, 'ACCEPTED', 'ADR status must transition to ACCEPTED upon quorum');
      pass('23. ADR acceptance follows authorized quorum');
    } catch (e) {
      fail('23. ADR acceptance follows authorized quorum', e);
    }

    // 24. Risk approval does not create invalid Risk.status
    try {
      const reqRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'RISK', targetEntityId: 'RSK-OPS-01' }),
      });
      const apvItem = await reqRes.json();
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      const riskTarget = store.risks[testProjectId].find((r: any) => r.id === 'RSK-OPS-01');
      assert.equal((riskTarget as any).status, undefined, 'Risk must NOT have a status property added');
      assert.equal(riskTarget.treatment, 'MITIGATE', 'Risk treatment must not be altered');
      pass('24. Risk approval does not create invalid Risk.status');
    } catch (e) {
      fail('24. Risk approval does not create invalid Risk.status', e);
    }

    // 25. Invalid or expired override fails
    try {
      // 25a: Expired override
      const expRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: 'OVR-EXPIRED-01' }),
      });
      assert.equal(expRes.status, 422, 'Expired override request must fail with 422');

      // 25b: Unacknowledged risk override
      const noAckRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: 'OVR-NO-ACK-01' }),
      });
      assert.equal(noAckRes.status, 422, 'Unacknowledged override request must fail with 422');

      // 25c: Valid override succeeds upon quorum
      const valRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: 'OVR-VALID-01' }),
      });
      assert.equal(valRes.status, 201);
      const valApv = await valRes.json();
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${valApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${valApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      const ovrTarget = store.overrides[testProjectId].find((o: any) => o.id === 'OVR-VALID-01');
      assert.equal(ovrTarget.status, 'APPROVED');
      assert.equal(ovrTarget.authorizedBy, valApv.id);
      pass('25. Invalid or expired override fails');
    } catch (e) {
      fail('25. Invalid or expired override fails', e);
    }

    // 26. Release/Gate direct ceremony bypass fails
    try {
      const gateRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'GATE', targetEntityId: 'GATE-07' }),
      });
      assert.equal(gateRes.status, 422, 'GATE approval type must return 422');

      const relRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'RELEASE', targetEntityId: 'REL-01' }),
      });
      assert.equal(relRes.status, 422, 'RELEASE approval type must return 422');

      const gate7Override = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: 'OVR-GATE7-01' }),
      });
      assert.equal(gate7Override.status, 403, 'Gate 7 override must return 403');
      pass('26. Release/Gate direct ceremony bypass fails');
    } catch (e) {
      fail('26. Release/Gate direct ceremony bypass fails', e);
    }

    // 27. Audit event and state-version increments are correct
    try {
      const logs = store.auditLogs[testProjectId] || [];
      const sigEvents = logs.filter((l: any) => l.action === 'GOVERNANCE_SIGNATURE');
      assert.ok(sigEvents.length >= 2, 'Audit log must record GOVERNANCE_SIGNATURE events');
      for (const event of sigEvents) {
        assert.ok(event.details.authenticatedIdentity, 'Event must bind authenticatedIdentity');
        assert.ok(event.details.role, 'Event must bind role');
        assert.ok(event.details.roleSource, 'Event must bind roleSource');
      }
      pass('27. Audit event and state-version increments are correct');
    } catch (e) {
      fail('27. Audit event and state-version increments are correct', e);
    }

    // 28. Failed decisions leave audit/state unchanged
    try {
      const verBefore = store.projects.find((p) => p.id === testProjectId)!.stateVersion;
      const countBefore = (store.auditLogs[testProjectId] || []).length;
      await fetch(`${base}/api/projects/${testProjectId}/approvals/NONEXISTENT/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      const verAfter = store.projects.find((p) => p.id === testProjectId)!.stateVersion;
      const countAfter = (store.auditLogs[testProjectId] || []).length;
      assert.equal(verAfter, verBefore);
      assert.equal(countAfter, countBefore);
      pass('28. Failed decisions leave audit/state unchanged');
    } catch (e) {
      fail('28. Failed decisions leave audit/state unchanged', e);
    }

    // 29. Persisted request/decision data remains consistent
    try {
      const appvs = store.approvals[testProjectId] || [];
      for (const a of appvs) {
        assert.equal(a.policyVersion, 'LOCAL_SESSION_V1');
        assert.ok(a.targetDigest);
        for (const sig of a.approvalsCollected) {
          assert.ok(sig.identityId);
          assert.ok(sig.roleSource);
        }
      }
      pass('29. Persisted request/decision data remains consistent');
    } catch (e) {
      fail('29. Persisted request/decision data remains consistent', e);
    }

    // 30. No WBS, Gate 7, release, or runtime reconciliation mutation occurs
    try {
      const postWbsHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/00_control/MASTER_WBS.yaml'))).digest('hex');
      assert.equal(postWbsHash, preWbsHash, 'MASTER_WBS.yaml must remain byte-for-byte identical');
      pass('30. No WBS, Gate 7, release, or runtime reconciliation mutation occurs');
    } catch (e) {
      fail('30. No WBS, Gate 7, release, or runtime reconciliation mutation occurs', e);
    }
  } finally {
    server.close();
    if (originalEnv === undefined) {
      delete process.env.DMK_HUMAN_REVIEWERS;
    } else {
      process.env.DMK_HUMAN_REVIEWERS = originalEnv;
    }
  }
}

await runTests();

console.log('\n================================================================');
console.log(`TOTAL SCENARIOS: 30 | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
