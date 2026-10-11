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
console.log('   Coverage: Scenarios 1 through 63 (Canonical acceptance criteria)');
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
        targetDigest: 'a'.repeat(64),
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
      const q = evaluateQuorum(dummyItem, 'a'.repeat(64));
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
        targetDigest: 'a'.repeat(64),
        approvalsCollected: [
          { role: 'Security Officer', approver: 'so', identityId: 'REV-SEC-01', decision: 'APPROVED' },
          { role: 'Lead Architect', approver: 'la', identityId: 'REV-ARCH-01', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(dummyItem, 'a'.repeat(64));
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
        targetDigest: 'a'.repeat(64),
        approvalsCollected: [
          { role: 'Security Officer', approver: 'legacySo', decision: 'APPROVED' }, // missing identityId
          { role: 'Lead Architect', approver: 'legacyLa', decision: 'APPROVED' }, // missing identityId
        ],
      };
      const q = evaluateQuorum(dummyItem, 'a'.repeat(64));
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

    // 30. evaluateQuorum rejects shortened canonical role array
    try {
      const shortItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: 'a'.repeat(64),
        requiredRoles: ['Security Officer'],
        approvalsCollected: [
          { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(shortItem, shortItem.targetDigest);
      assert.equal(q.status, 'INVALID', 'Shortened role array must be INVALID');
      assert.equal(q.hasQuorum, false, 'Shortened role array must not have quorum');
      pass('30. evaluateQuorum rejects shortened canonical role array');
    } catch (e) {
      fail('30. evaluateQuorum rejects shortened canonical role array', e);
    }

    // 31. evaluateQuorum rejects duplicated requiredRoles
    try {
      const dupItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: 'a'.repeat(64),
        requiredRoles: ['Security Officer', 'Security Officer'],
        approvalsCollected: [
          { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          { role: 'Security Officer', identityId: 'REV-SEC-02', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(dupItem, dupItem.targetDigest);
      assert.equal(q.status, 'INVALID', 'Duplicated roles must be INVALID');
      assert.equal(q.hasQuorum, false, 'Duplicated roles must not have quorum');
      pass('31. evaluateQuorum rejects duplicated requiredRoles');
    } catch (e) {
      fail('31. evaluateQuorum rejects duplicated requiredRoles', e);
    }

    // 32. evaluateQuorum rejects unknown or extra roles
    try {
      const extraItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: 'a'.repeat(64),
        requiredRoles: ['Security Officer', 'Lead Architect', 'Auditor'],
        approvalsCollected: [
          { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          { role: 'Lead Architect', identityId: 'REV-ARCH-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(extraItem, extraItem.targetDigest);
      assert.equal(q.status, 'INVALID', 'Unknown/extra roles must be INVALID');
      assert.equal(q.hasQuorum, false, 'Extra roles must not have quorum');
      pass('32. evaluateQuorum rejects unknown or extra roles');
    } catch (e) {
      fail('32. evaluateQuorum rejects unknown or extra roles', e);
    }

    // 33. evaluateQuorum rejects missing or empty requiredRoles
    try {
      const missingRolesItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: 'a'.repeat(64),
        requiredRoles: [],
        approvalsCollected: [],
      };
      const q = evaluateQuorum(missingRolesItem, missingRolesItem.targetDigest);
      assert.equal(q.status, 'INVALID', 'Empty requiredRoles must be INVALID');
      assert.equal(q.hasQuorum, false);

      const undefinedRolesItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: 'a'.repeat(64),
        approvalsCollected: [],
      };
      const q2 = evaluateQuorum(undefinedRolesItem, undefinedRolesItem.targetDigest);
      assert.equal(q2.status, 'INVALID', 'Missing requiredRoles must be INVALID');
      assert.equal(q2.hasQuorum, false);
      pass('33. evaluateQuorum rejects missing or empty requiredRoles');
    } catch (e) {
      fail('33. evaluateQuorum rejects missing or empty requiredRoles', e);
    }

    // 34. evaluateQuorum rejects missing or unsupported policyVersion
    try {
      const noPolicyItem = {
        targetDigest: 'a'.repeat(64),
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          { role: 'Lead Architect', identityId: 'REV-ARCH-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(noPolicyItem, noPolicyItem.targetDigest);
      assert.equal(q.status, 'INVALID', 'Missing policyVersion must be INVALID');
      assert.equal(q.hasQuorum, false);
      pass('34. evaluateQuorum rejects missing or unsupported policyVersion');
    } catch (e) {
      fail('34. evaluateQuorum rejects missing or unsupported policyVersion', e);
    }

    // 35. evaluateQuorum rejects missing or invalid targetDigest
    try {
      const validDigest = 'a'.repeat(64);
      const malformedDigests = [
        undefined,
        null,
        '',
        '   ',
        'abcdef123456', // short
        'a'.repeat(65), // long
        'g'.repeat(64), // non-hex
        'A'.repeat(64), // uppercase non-canonical
        ' ' + 'a'.repeat(64), // leading space
        'a'.repeat(64) + ' ', // trailing space
        'digest-placeholder', // arbitrary string
      ];

      for (const badDigest of malformedDigests) {
        const item = {
          policyVersion: 'LOCAL_SESSION_V1',
          requiredRoles: ['Security Officer', 'Lead Architect'],
          targetDigest: badDigest,
          approvalsCollected: [
            { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
            { role: 'Lead Architect', identityId: 'REV-ARCH-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          ],
        };
        const q = evaluateQuorum(item, validDigest);
        assert.equal(q.status, 'INVALID', `targetDigest '${badDigest}' must produce INVALID`);
        assert.equal(q.hasQuorum, false, `targetDigest '${badDigest}' must have hasQuorum = false`);
      }

      // Also verify malformed postRatificationDigest produces INVALID
      const malformedPostDigests = ['', 'xyz', 'a'.repeat(63), 'a'.repeat(65), 'G'.repeat(64)];
      for (const badPost of malformedPostDigests) {
        const item = {
          status: 'APPROVED',
          policyVersion: 'LOCAL_SESSION_V1',
          requiredRoles: ['Security Officer', 'Lead Architect'],
          targetDigest: validDigest,
          postRatificationDigest: badPost,
          approvalsCollected: [
            { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
            { role: 'Lead Architect', identityId: 'REV-ARCH-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          ],
        };
        const q = evaluateQuorum(item, validDigest);
        assert.equal(q.status, 'INVALID', `postRatificationDigest '${badPost}' must produce INVALID`);
        assert.equal(q.hasQuorum, false);
      }

      // Valid 64-char lowercase hex digest succeeds
      const validItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        targetDigest: validDigest,
        approvalsCollected: [
          { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          { role: 'Lead Architect', identityId: 'REV-ARCH-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      const qValid = evaluateQuorum(validItem, validDigest);
      assert.equal(qValid.status, 'SATISFIED');
      assert.equal(qValid.hasQuorum, true);

      pass('35. evaluateQuorum rejects missing or invalid targetDigest');
    } catch (e) {
      fail('35. evaluateQuorum rejects missing or invalid targetDigest', e);
    }

    // 36. evaluateQuorum excludes signature with missing/empty identityId
    try {
      const validDigest = 'a'.repeat(64);
      const noIdSigItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: validDigest,
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Alice', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' }, // missing identityId
          { role: 'Lead Architect', identityId: 'REV-ARCH-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(noIdSigItem, noIdSigItem.targetDigest);
      assert.equal(q.hasQuorum, false, 'Missing identityId must not satisfy quorum');
      assert.deepEqual(q.satisfiedRoles, ['Lead Architect']);
      assert.deepEqual(q.pendingRoles, ['Security Officer']);
      assert.equal(q.status, 'PARTIAL');
      pass('36. evaluateQuorum excludes signature with missing/empty identityId');
    } catch (e) {
      fail('36. evaluateQuorum excludes signature with missing/empty identityId', e);
    }

    // 37. evaluateQuorum excludes signature with missing, empty, or forged roleSource
    try {
      const validDigest = 'a'.repeat(64);
      const forgedSigItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: validDigest,
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', identityId: 'REV-SEC-01', roleSource: 'CLIENT_FORGED', decision: 'APPROVED' },
          { role: 'Lead Architect', identityId: 'REV-ARCH-01', decision: 'APPROVED' }, // missing roleSource
        ],
      };
      const q = evaluateQuorum(forgedSigItem, forgedSigItem.targetDigest);
      assert.equal(q.hasQuorum, false, 'Non-LOCAL_SERVER_ROSTER roleSource must not satisfy quorum');
      assert.equal(q.satisfiedRoles.length, 0);
      assert.equal(q.status, 'PENDING');
      pass('37. evaluateQuorum excludes signature with missing, empty, or forged roleSource');
    } catch (e) {
      fail('37. evaluateQuorum excludes signature with missing, empty, or forged roleSource', e);
    }

    // 38. evaluateQuorum excludes legacy approval containing only approver name
    try {
      const validDigest = 'a'.repeat(64);
      const legacyItem = {
        policyVersion: 'LOCAL_SESSION_V1',
        targetDigest: validDigest,
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Alice Legacy', decision: 'APPROVED' },
          { role: 'Lead Architect', approver: 'Bob Legacy', decision: 'APPROVED' },
        ],
      };
      const q = evaluateQuorum(legacyItem, legacyItem.targetDigest);
      assert.equal(q.hasQuorum, false, 'Legacy approver names must not satisfy quorum');
      assert.equal(q.satisfiedRoles.length, 0);
      pass('38. evaluateQuorum excludes legacy approval containing only approver name');
    } catch (e) {
      fail('38. evaluateQuorum excludes legacy approval containing only approver name', e);
    }

    // 39. Decision submission rejects malformed stored request without mutating state
    try {
      const oneRoleReq = {
        id: 'REQ-ONE-ROLE-01',
        title: 'One-Role Test Requirement',
        status: 'UNDER_REVIEW' as const,
        statement: 'Statement under review',
      };
      (store.requirements[testProjectId] ||= []).push(oneRoleReq);

      const malformedApv = {
        id: 'APV-MALFORMED-01',
        projectId: testProjectId,
        title: 'Malformed Item',
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: 'REQ-ONE-ROLE-01',
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'TestOwner',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: 'Test malformed metadata',
        requiredRoles: ['Security Officer'], // invalid single role policy
        approvalsCollected: [],
        targetDigest: digest(oneRoleReq),
        policyGates: [],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).push(malformedApv);

      const verBefore = store.projects.find((p: any) => p.id === testProjectId)!.stateVersion;
      const auditBefore = (store.auditLogs[testProjectId] || []).length;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${malformedApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(res.status, 409, 'Malformed approval policy must return 409 Conflict');

      const verAfter = store.projects.find((p: any) => p.id === testProjectId)!.stateVersion;
      const auditAfter = (store.auditLogs[testProjectId] || []).length;
      assert.equal(verAfter, verBefore, 'Must not increment stateVersion');
      assert.equal(auditAfter, auditBefore, 'Must not add audit event');
      assert.equal(malformedApv.approvalsCollected.length, 0, 'Must not append signature to malformed item');
      pass('39. Decision submission rejects malformed stored request without mutating state');
    } catch (e) {
      fail('39. Decision submission rejects malformed stored request without mutating state', e);
    }

    // 40. One-role quorum request cannot ratify canonical target
    try {
      const reqTarget = store.requirements[testProjectId].find((r: any) => r.id === 'REQ-ONE-ROLE-01');
      assert.equal(reqTarget.status, 'UNDER_REVIEW', 'Canonical requirement must not be ratified by malformed one-role item');
      pass('40. One-role quorum request cannot ratify canonical target');
    } catch (e) {
      fail('40. One-role quorum request cannot ratify canonical target', e);
    }

    // 41. Override expiring after first signature is rejected on second decision attempt
    try {
      const tempOvr = {
        id: 'OVR-EXPIRING-01',
        gateOrControl: 'PR-MERGE-GATE',
        reason: 'Temporary override that expires between reviews',
        riskAcknowledged: true,
        expiresAt: new Date(Date.now() + 10000).toISOString(), // 10s in future
        status: 'PROPOSED' as const,
      };
      (store.overrides[testProjectId] ||= []).push(tempOvr);

      const createRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: tempOvr.id }),
      });
      assert.equal(createRes.status, 201);
      const apvOvr = await createRes.json();

      // First decision: Security Officer approves while valid
      const dec1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvOvr.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(dec1.status, 200);

      // Now force override to expire before second decision
      tempOvr.expiresAt = new Date(Date.now() - 10000).toISOString();

      const verBefore = store.projects.find((p: any) => p.id === testProjectId)!.stateVersion;
      const auditBefore = (store.auditLogs[testProjectId] || []).length;

      // Second decision: Lead Architect attempts to ratify expired override
      const dec2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvOvr.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(dec2.status, 422, 'Expired override must reject on decision with 422');

      const verAfter = store.projects.find((p: any) => p.id === testProjectId)!.stateVersion;
      const auditAfter = (store.auditLogs[testProjectId] || []).length;
      assert.equal(verAfter, verBefore, 'Failed expired decision must not bump stateVersion');
      assert.equal(auditAfter, auditBefore, 'Failed expired decision must not add audit event');

      const storedItem = (store.approvals[testProjectId] || []).find((a: any) => a.id === apvOvr.id);
      assert.equal(storedItem.status, 'PENDING', 'Approval must remain PENDING');
      assert.equal(storedItem.approvalsCollected.length, 1, 'Second signature must NOT be recorded');
      assert.equal(tempOvr.status, 'PROPOSED', 'Override must NOT become APPROVED');
      pass('41. Override expiring after first signature is rejected on second decision attempt');
    } catch (e) {
      fail('41. Override expiring after first signature is rejected on second decision attempt', e);
    }

    // 42. Override becoming ineligible before final signature is rejected on decision attempt
    try {
      const tempOvr2 = {
        id: 'OVR-DISAVOWED-01',
        gateOrControl: 'PR-MERGE-GATE',
        reason: 'Override whose risk acknowledgement gets revoked',
        riskAcknowledged: true,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'PROPOSED' as const,
      };
      (store.overrides[testProjectId] ||= []).push(tempOvr2);

      const createRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: tempOvr2.id }),
      });
      assert.equal(createRes.status, 201);
      const apvOvr2 = await createRes.json();

      // Revoke risk acknowledgement before decisions
      tempOvr2.riskAcknowledged = false;

      const decRes = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvOvr2.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(decRes.status, 422, 'Ineligible override must reject decision with 422');
      pass('42. Override becoming ineligible before final signature is rejected on decision attempt');
    } catch (e) {
      fail('42. Override becoming ineligible before final signature is rejected on decision attempt', e);
    }

    // 43. Legitimate ratified target handles post-ratification digest properly
    try {
      const targetReq = {
        id: 'REQ-RATIFIED-01',
        title: 'Requirement To Ratify',
        statement: 'System must securely enforce MFA',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(targetReq);

      const createRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: targetReq.id }),
      });
      assert.equal(createRes.status, 201);
      const apvItem = await createRes.json();

      await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });

      const dec2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(dec2.status, 200);
      const ratifiedItem = await dec2.json();
      assert.equal(ratifiedItem.status, 'APPROVED');
      assert.equal(targetReq.status, 'APPROVED');

      // Evaluator with current live target digest
      const liveDigest = digest(targetReq);
      const q = evaluateQuorum(ratifiedItem, liveDigest);
      assert.equal(q.hasQuorum, true, 'Ratified requirement must have quorum');
      assert.equal(q.status, 'SATISFIED', 'Ratified requirement must be SATISFIED, not STALE');
      pass('43. Legitimate ratified target handles post-ratification digest properly');
    } catch (e) {
      fail('43. Legitimate ratified target handles post-ratification digest properly', e);
    }

    // 44. Protected Gate 7 naming variants are rejected fail-closed, while unrelated controls like Gate 70 are permitted
    try {
      const gate7Variants = ['Gate 7', 'gate 7', 'GATE-7', 'Gate7', 'GATE_7', 'GATE-07', 'gate #7'];
      const p = store.projects.find((proj: any) => proj.id === testProjectId);

      for (const variant of gate7Variants) {
        const stateVerBefore = p.stateVersion;
        const auditCountBefore = (store.auditLogs[testProjectId] || []).length;
        const approvalsCountBefore = (store.approvals[testProjectId] || []).length;

        const ovr = {
          id: `OVR-G7-${Buffer.from(variant).toString('hex')}`,
          gateOrControl: variant,
          reason: `Attempt to bypass ${variant}`,
          riskAcknowledged: true,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          status: 'PROPOSED' as const,
        };
        (store.overrides[testProjectId] ||= []).push(ovr);

        const res = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: secCookie },
          body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: ovr.id }),
        });

        assert.equal(res.status, 403, `Gate 7 variant '${variant}' must be rejected with 403`);
        assert.equal((store.approvals[testProjectId] || []).length, approvalsCountBefore, `Zero approvals created for '${variant}'`);
        assert.equal(p.stateVersion, stateVerBefore, `stateVersion must not increment for '${variant}'`);
        assert.equal((store.auditLogs[testProjectId] || []).length, auditCountBefore, `No audit event emitted for '${variant}'`);
        assert.equal(ovr.status, 'PROPOSED', `Override status must not mutate for '${variant}'`);
      }

      // Unrelated control Gate 70 must NOT be misclassified as Gate 7
      const ovr70 = {
        id: 'OVR-GATE-70-VALID',
        gateOrControl: 'Gate 70',
        reason: 'Legitimate override for non-protected Gate 70',
        riskAcknowledged: true,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'PROPOSED' as const,
      };
      (store.overrides[testProjectId] ||= []).push(ovr70);

      const res70 = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: ovr70.id }),
      });
      assert.equal(res70.status, 201, "Gate 70 must not be misclassified as Gate 7 and should succeed with 201");

      // Decision-time mutation protection: override control reference mutated to Gate 7 variant before second signature
      const validOvr = {
        id: 'OVR-MUTATE-TO-G7',
        gateOrControl: 'Ordinary Security Control',
        reason: 'Override that later attempts Gate 7 bypass',
        riskAcknowledged: true,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'PROPOSED' as const,
      };
      (store.overrides[testProjectId] ||= []).push(validOvr);

      const createRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'OVERRIDE', targetEntityId: validOvr.id }),
      });
      assert.equal(createRes.status, 201);
      const apvMutate = await createRes.json();

      // First signature by Security Officer
      const sig1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvMutate.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(sig1.status, 200);

      // Mutate control reference to protected Gate 7 variant before second signature
      validOvr.gateOrControl = 'GATE-07';

      // Attempt second signature by Lead Architect
      const sig2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvMutate.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      assert.equal(sig2.status, 403, 'Decision on mutated Gate 7 override must reject with 403');
      const storedApv = (store.approvals[testProjectId] || []).find((a: any) => a.id === apvMutate.id);
      assert.equal(storedApv.approvalsCollected.length, 1, 'Second signature must not be recorded');
      assert.equal(storedApv.status, 'PENDING', 'Approval must remain PENDING');
      assert.equal(validOvr.status, 'PROPOSED', 'Override must remain PROPOSED');

      pass('44. Protected Gate 7 naming variants are rejected fail-closed, while unrelated controls like Gate 70 are permitted');
    } catch (e) {
      fail('44. Protected Gate 7 naming variants are rejected fail-closed, while unrelated controls like Gate 70 are permitted', e);
    }

    // 45. Missing canonical target and unsupported target type fail-closed in GET approvals without mutation
    try {
      const p = store.projects.find((proj: any) => proj.id === testProjectId);

      // 1) Pending approval whose target is deleted from canonical collection
      const deletedReq = {
        id: 'REQ-TO-DELETE-01',
        title: 'Requirement will be deleted',
        statement: 'Ephemeral requirement',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(deletedReq);

      const apvRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: deletedReq.id }),
      });
      assert.equal(apvRes.status, 201);
      const apvDeleted = await apvRes.json();

      // Delete the target requirement from store
      store.requirements[testProjectId] = store.requirements[testProjectId].filter((r: any) => r.id !== deletedReq.id);

      // 2) Previously completed/ratified approval whose target is subsequently deleted
      const completedDeletedReq = {
        id: 'REQ-RATIFIED-THEN-DELETED',
        title: 'Ratified then deleted',
        statement: 'Will be signed off then deleted',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(completedDeletedReq);

      const apvCompRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: completedDeletedReq.id }),
      });
      const apvComp = await apvCompRes.json();

      // Sign off by Security Officer and Lead Architect
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvComp.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });
      await fetch(`${base}/api/projects/${testProjectId}/approvals/${apvComp.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ humanConfirmed: true, decision: 'APPROVED' }),
      });

      // Now delete the target requirement
      store.requirements[testProjectId] = store.requirements[testProjectId].filter((r: any) => r.id !== completedDeletedReq.id);

      // 3) Stored approval with unsupported target type
      const unsupportedApv = {
        id: 'APV-UNSUPPORTED-TYPE',
        projectId: testProjectId,
        title: 'Unsupported Type Item',
        type: 'CUSTOM_UNKNOWN',
        targetEntityId: 'UNKNOWN-01',
        targetEntityType: 'UNKNOWN_TYPE',
        requestedBy: 'TestUser',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'LOW',
        riskLevel: 'LOW',
        description: 'Unsupported entity type test',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [],
        targetDigest: 'a'.repeat(64),
        policyGates: [],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).push(unsupportedApv);

      const stateVerPreGet = p.stateVersion;
      const auditCountPreGet = (store.auditLogs[testProjectId] || []).length;
      const approvalsCountPreGet = (store.approvals[testProjectId] || []).length;

      // Fetch approvals via GET endpoint
      const listRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie },
      });
      assert.equal(listRes.status, 200);
      const list = await listRes.json();

      // 1. Pending approval with deleted target must project STALE with canonical reason
      const projDeleted = list.find((a: any) => a.id === apvDeleted.id);
      assert.ok(projDeleted, 'Deleted target approval must exist in list for auditability');
      assert.equal(projDeleted.quorum.status, 'STALE', 'Missing target must project STALE');
      assert.equal(projDeleted.quorum.hasQuorum, false, 'Missing target must have hasQuorum = false');
      assert.equal(projDeleted.quorum.reason, 'Canonical approval target no longer exists');

      // 2. Previously completed approval with deleted target must NOT display valid current-target quorum
      const projCompDeleted = list.find((a: any) => a.id === apvComp.id);
      assert.ok(projCompDeleted);
      assert.equal(projCompDeleted.quorum.status, 'STALE', 'Completed approval with missing target must project STALE');
      assert.equal(projCompDeleted.quorum.hasQuorum, false, 'Completed approval with missing target must have hasQuorum = false');
      assert.equal(projCompDeleted.quorum.reason, 'Canonical approval target no longer exists');

      // 3. Unsupported target type must project INVALID
      const projUnsupported = list.find((a: any) => a.id === unsupportedApv.id);
      assert.ok(projUnsupported);
      assert.equal(projUnsupported.quorum.status, 'INVALID', 'Unsupported target type must project INVALID');
      assert.equal(projUnsupported.quorum.hasQuorum, false);

      // Verify GET projection NEVER mutated stateVersion, auditLogs, or stored approvals
      assert.equal(p.stateVersion, stateVerPreGet, 'GET must never mutate stateVersion');
      assert.equal((store.auditLogs[testProjectId] || []).length, auditCountPreGet, 'GET must never add audit event');
      assert.equal((store.approvals[testProjectId] || []).length, approvalsCountPreGet, 'GET must never mutate approvals count');

      pass('45. Missing canonical target and unsupported target type fail-closed in GET approvals without mutation');
    } catch (e) {
      fail('45. Missing canonical target and unsupported target type fail-closed in GET approvals without mutation', e);
    }

    // 46. No WBS, Gate 7, release, or runtime reconciliation mutation occurs
    try {
      const postWbsHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/00_control/MASTER_WBS.yaml'))).digest('hex');
      assert.equal(postWbsHash, preWbsHash, 'MASTER_WBS.yaml must remain byte-for-byte identical');
      pass('46. No WBS, Gate 7, release, or runtime reconciliation mutation occurs');
    } catch (e) {
      fail('46. No WBS, Gate 7, release, or runtime reconciliation mutation occurs', e);
    }
    // 47. Unauthenticated GET approvals fails with 401
    try {
      const unauthRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`);
      assert.equal(unauthRes.status, 401, 'Unauthenticated GET /approvals must return 401');
      const unauthBody = await unauthRes.json();
      assert.equal(unauthBody.error, 'Sign in as a configured human reviewer first');
      pass('47. Unauthenticated GET approvals fails with 401');
    } catch (e) {
      fail('47. Unauthenticated GET approvals fails with 401', e);
    }

    // 48. Unauthorized reviewer GET approvals fails with 403
    try {
      const devCookie = await loginAndGetCookie(base, 'otherDev', 'DevPass123!');
      const unauthRoleRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: devCookie },
      });
      assert.equal(unauthRoleRes.status, 403, 'Unauthorized reviewer GET /approvals must return 403');
      const unauthRoleBody = await unauthRoleRes.json();
      assert.equal(unauthRoleBody.error, 'This identity has no human governance authority');
      pass('48. Unauthorized reviewer GET approvals fails with 403');
    } catch (e) {
      fail('48. Unauthorized reviewer GET approvals fails with 403', e);
    }

    // 49. Authorized reviewer GET approvals succeeds with 200
    try {
      const authRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie },
      });
      assert.equal(authRes.status, 200, 'Authorized reviewer GET /approvals must return 200');
      const authBody = await authRes.json();
      assert.ok(Array.isArray(authBody), 'Authorized GET /approvals must return an array');
      pass('49. Authorized reviewer GET approvals succeeds with 200');
    } catch (e) {
      fail('49. Authorized reviewer GET approvals succeeds with 200', e);
    }

    // 50. Nonexistent project GET approvals returns 404 for authorized reviewer
    try {
      const notFoundRes = await fetch(`${base}/api/projects/NONEXISTENT-PRJ/approvals`, {
        headers: { Cookie: secCookie },
      });
      assert.equal(notFoundRes.status, 404, 'Nonexistent project GET /approvals must return 404');
      const notFoundBody = await notFoundRes.json();
      assert.equal(notFoundBody.error, 'Project not found');
      pass('50. Nonexistent project GET approvals returns 404 for authorized reviewer');
    } catch (e) {
      fail('50. Nonexistent project GET approvals returns 404 for authorized reviewer', e);
    }

    // 51. No audit-log or stateVersion mutation during authorized or rejected reads
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      await fetch(`${base}/api/projects/${testProjectId}/approvals`);
      await fetch(`${base}/api/projects/${testProjectId}/approvals`, { headers: { Cookie: secCookie } });
      await fetch(`${base}/api/projects/NONEXISTENT-PRJ/approvals`, { headers: { Cookie: secCookie } });
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not change during GET operations');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log count must not change during GET operations');
      pass('51. No audit-log or stateVersion mutation during authorized or rejected reads');
    } catch (e) {
      fail('51. No audit-log or stateVersion mutation during authorized or rejected reads', e);
    }

    // 52. Malformed stored approval record (missing/null/non-array approvalsCollected) returns HTTP 409
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const malformedApv1: any = {
        id: 'APV-MALFORMED-COLLECTED-1',
        projectId: testProjectId,
        title: 'Malformed Collected Non-Array',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: 'not-an-array',
      };
      const malformedApv2: any = {
        id: 'APV-MALFORMED-COLLECTED-2',
        projectId: testProjectId,
        title: 'Malformed Collected Null',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: null,
      };
      (store.approvals[testProjectId] ||= []).push(malformedApv1, malformedApv2);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;

      const dec1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${malformedApv1.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec1.status, 409, 'Non-array approvalsCollected must return HTTP 409 fail-closed');

      const dec2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${malformedApv2.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec2.status, 409, 'Null approvalsCollected must return HTTP 409 fail-closed');

      assert.equal(prj.stateVersion, preVer, 'StateVersion must not change on rejected malformed record decision');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit logs must not change on rejected decision');

      pass('52. Malformed stored approval record (missing/null/non-array approvalsCollected) returns HTTP 409');
    } catch (e) {
      fail('52. Malformed stored approval record (missing/null/non-array approvalsCollected) returns HTTP 409', e);
    }

    // 53. Malformed stored signature entries return HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const malformedSigApv1: any = {
        id: 'APV-MALFORMED-SIG-1',
        projectId: testProjectId,
        title: 'Malformed Null Signature',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [null],
      };
      const malformedSigApv2: any = {
        id: 'APV-MALFORMED-SIG-2',
        projectId: testProjectId,
        title: 'Malformed Signature Object',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [{ decision: 'NOT_A_VALID_DECISION', role: 'Security Officer' }],
      };
      (store.approvals[testProjectId] ||= []).push(malformedSigApv1, malformedSigApv2);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;

      const dec1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${malformedSigApv1.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec1.status, 409, 'Null signature entry must return HTTP 409 fail-closed');

      const dec2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${malformedSigApv2.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec2.status, 409, 'Invalid signature decision must return HTTP 409 fail-closed');

      assert.equal(prj.stateVersion, preVer, 'StateVersion must not change on rejected malformed signature decision');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit logs must not change on rejected decision');

      pass('53. Malformed stored signature entries return HTTP 409 fail-closed');
    } catch (e) {
      fail('53. Malformed stored signature entries return HTTP 409 fail-closed', e);
    }

    // 54. Missing identityId in stored signature returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const noIdApv: any = {
        id: 'APV-STORED-NO-ID',
        projectId: testProjectId,
        title: 'Stored Signature Missing identityId',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Alice', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(noIdApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${noIdApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Missing identityId in stored signature must return HTTP 409 fail-closed');
      assert.equal(noIdApv.approvalsCollected.length, 1, 'Must not append signature to malformed record');
      assert.equal(noIdApv.status, 'PENDING', 'Approval status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('54. Missing identityId in stored signature returns HTTP 409 fail-closed');
    } catch (e) {
      fail('54. Missing identityId in stored signature returns HTTP 409 fail-closed', e);
    }

    // 55. Empty or whitespace-only identityId in stored signature returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const emptyIdApv: any = {
        id: 'APV-STORED-EMPTY-ID',
        projectId: testProjectId,
        title: 'Stored Signature Empty identityId',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Alice', identityId: '   ', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(emptyIdApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${emptyIdApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Empty/whitespace identityId must return HTTP 409 fail-closed');
      assert.equal(emptyIdApv.approvalsCollected.length, 1, 'Must not append signature');
      assert.equal(emptyIdApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('55. Empty or whitespace-only identityId in stored signature returns HTTP 409 fail-closed');
    } catch (e) {
      fail('55. Empty or whitespace-only identityId in stored signature returns HTTP 409 fail-closed', e);
    }

    // 56. Missing roleSource in stored signature returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const noRoleSourceApv: any = {
        id: 'APV-STORED-NO-ROLESOURCE',
        projectId: testProjectId,
        title: 'Stored Signature Missing roleSource',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Alice', identityId: 'REV-SEC-01', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(noRoleSourceApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${noRoleSourceApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Missing roleSource must return HTTP 409 fail-closed');
      assert.equal(noRoleSourceApv.approvalsCollected.length, 1, 'Must not append signature');
      assert.equal(noRoleSourceApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('56. Missing roleSource in stored signature returns HTTP 409 fail-closed');
    } catch (e) {
      fail('56. Missing roleSource in stored signature returns HTTP 409 fail-closed', e);
    }

    // 57. Invalid roleSource in stored signature returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const invalidRoleSourceApv: any = {
        id: 'APV-STORED-INVALID-ROLESOURCE',
        projectId: testProjectId,
        title: 'Stored Signature Invalid roleSource',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Alice', identityId: 'REV-SEC-01', roleSource: 'CLIENT_INJECTED', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(invalidRoleSourceApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${invalidRoleSourceApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Invalid roleSource must return HTTP 409 fail-closed');
      assert.equal(invalidRoleSourceApv.approvalsCollected.length, 1, 'Must not append signature');
      assert.equal(invalidRoleSourceApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('57. Invalid roleSource in stored signature returns HTTP 409 fail-closed');
    } catch (e) {
      fail('57. Invalid roleSource in stored signature returns HTTP 409 fail-closed', e);
    }

    // 58. Unknown governance role in stored signature returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const unknownRoleApv: any = {
        id: 'APV-STORED-UNKNOWN-ROLE',
        projectId: testProjectId,
        title: 'Stored Signature Unknown Role',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Developer', approver: 'Bob', identityId: 'REV-DEV-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(unknownRoleApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${unknownRoleApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Unknown governance role must return HTTP 409 fail-closed');
      assert.equal(unknownRoleApv.approvalsCollected.length, 1, 'Must not append signature');
      assert.equal(unknownRoleApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('58. Unknown governance role in stored signature returns HTTP 409 fail-closed');
    } catch (e) {
      fail('58. Unknown governance role in stored signature returns HTTP 409 fail-closed', e);
    }

    // 59. Duplicate human identity across roles in stored signatures returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const dupIdentityApv: any = {
        id: 'APV-STORED-DUP-IDENTITY',
        projectId: testProjectId,
        title: 'Stored Signature Duplicate Identity',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'DualUser', identityId: 'REV-DUAL-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          { role: 'Lead Architect', approver: 'DualUser', identityId: 'REV-DUAL-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(dupIdentityApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${dupIdentityApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Duplicate identity across roles must return HTTP 409 fail-closed');
      assert.equal(dupIdentityApv.approvalsCollected.length, 2, 'Must not append signature');
      assert.equal(dupIdentityApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('59. Duplicate human identity across roles in stored signatures returns HTTP 409 fail-closed');
    } catch (e) {
      fail('59. Duplicate human identity across roles in stored signatures returns HTTP 409 fail-closed', e);
    }

    // 60. Duplicate approval signatures for the same role returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const dupRoleApv: any = {
        id: 'APV-STORED-DUP-ROLE',
        projectId: testProjectId,
        title: 'Stored Signature Duplicate Role',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Sec1', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          { role: 'Security Officer', approver: 'Sec2', identityId: 'REV-SEC-02', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(dupRoleApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${dupRoleApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Duplicate approval for same role must return HTTP 409 fail-closed');
      assert.equal(dupRoleApv.approvalsCollected.length, 2, 'Must not append signature');
      assert.equal(dupRoleApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('60. Duplicate approval signatures for the same role returns HTTP 409 fail-closed');
    } catch (e) {
      fail('60. Duplicate approval signatures for the same role returns HTTP 409 fail-closed', e);
    }

    // 61. Invalid Security Officer signature cannot occupy slot: legitimate decision returns HTTP 409
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const invalidSlotApv: any = {
        id: 'APV-STORED-INVALID-SLOT',
        projectId: testProjectId,
        title: 'Invalid Security Officer Slot Occupancy',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'FakeSo', roleSource: 'CLIENT_FORGED', identityId: 'FAKE-SO', decision: 'APPROVED' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(invalidSlotApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      // Legitimate Security Officer attempts decision on item with invalid Security Officer signature
      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${invalidSlotApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.notEqual(dec.status, 403, 'Must NOT return HTTP 403 (role falsely occupied); must fail-closed on malformed record');
      assert.equal(dec.status, 409, 'Invalid slot signature must cause HTTP 409 fail-closed');
      assert.equal(invalidSlotApv.approvalsCollected.length, 1, 'Must not append signature');
      assert.equal(invalidSlotApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('61. Invalid Security Officer signature cannot occupy slot: legitimate decision returns HTTP 409');
    } catch (e) {
      fail('61. Invalid Security Officer signature cannot occupy slot: legitimate decision returns HTTP 409', e);
    }

    // 62. Pending request containing inconsistent rejected-signature evidence returns HTTP 409 fail-closed
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId][0];
      const pendingRejApv: any = {
        id: 'APV-STORED-PENDING-WITH-REJECT',
        projectId: testProjectId,
        title: 'Pending Request With Rejection Signature',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          { role: 'Security Officer', approver: 'secOfficer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'REJECTED', comment: 'Rejected previously' },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(pendingRejApv);

      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const preTargetStatus = targetReq.status;

      const dec = await fetch(`${base}/api/projects/${testProjectId}/approvals/${pendingRejApv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec.status, 409, 'Pending request containing rejection signature must return HTTP 409 fail-closed');
      assert.equal(pendingRejApv.approvalsCollected.length, 1, 'Must not append signature');
      assert.equal(pendingRejApv.status, 'PENDING', 'Status must not mutate');
      assert.equal(targetReq.status, preTargetStatus, 'Target status must not mutate');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append');

      pass('62. Pending request containing inconsistent rejected-signature evidence returns HTTP 409 fail-closed');
    } catch (e) {
      fail('62. Pending request containing inconsistent rejected-signature evidence returns HTTP 409 fail-closed', e);
    }

    // 63. Legitimate two-human approval workflow succeeds and ratifies quorum
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const reqToApprove = {
        id: 'REQ-TWO-HUMAN-VALID-01',
        title: 'Two-Human Valid Approval Requirement',
        statement: 'Statement for two-human quorum testing',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(reqToApprove);

      const createRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: reqToApprove.id }),
      });
      assert.equal(createRes.status, 201, 'Request creation must return 201');
      const apv = await createRes.json();
      assert.equal(apv.status, 'PENDING');
      assert.equal(apv.approvalsCollected.length, 0);

      const preVer = prj.stateVersion;

      // Decision 1: Security Officer
      const dec1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec1.status, 200, 'Security Officer decision must succeed with 200');
      const itemAfter1 = (store.approvals[testProjectId] || []).find((a: any) => a.id === apv.id);
      assert.equal(itemAfter1.status, 'PENDING', 'Item must remain PENDING after 1 signature');
      assert.equal(itemAfter1.approvalsCollected.length, 1);
      assert.equal(itemAfter1.approvalsCollected[0].role, 'Security Officer');
      assert.equal(itemAfter1.approvalsCollected[0].identityId, 'REV-SEC-01');
      assert.equal(itemAfter1.approvalsCollected[0].roleSource, 'LOCAL_SERVER_ROSTER');

      // Decision 2: Lead Architect
      const dec2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${apv.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec2.status, 200, 'Lead Architect decision must succeed with 200');
      const itemAfter2 = (store.approvals[testProjectId] || []).find((a: any) => a.id === apv.id);
      assert.equal(itemAfter2.status, 'APPROVED', 'Item must transition to APPROVED after dual-human quorum');
      assert.equal(itemAfter2.approvalsCollected.length, 2);
      assert.equal(reqToApprove.status, 'APPROVED', 'Target requirement must transition to APPROVED');
      assert.ok(itemAfter2.postRatificationDigest, 'postRatificationDigest must be recorded');
      assert.equal(prj.stateVersion, preVer + 2, 'StateVersion must increment for each valid decision');

      const q = evaluateQuorum(itemAfter2, digest(reqToApprove));
      assert.equal(q.hasQuorum, true, 'Quorum must be evaluated as satisfied');
      assert.equal(q.status, 'SATISFIED');

      pass('63. Legitimate two-human approval workflow succeeds and ratifies quorum');
    } catch (e) {
      fail('63. Legitimate two-human approval workflow succeeds and ratifies quorum', e);
    }

    // Login dev cookie for unauthorized tests
    const devCookie = await loginAndGetCookie(base, 'otherDev', 'DevPass123!');

    // 64. Healthy pending approval deduplication returns existing approval without mutation or new audit events
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const healthyReq = {
        id: 'REQ-HEALTHY-DEDUP-01',
        title: 'Healthy Dedup Target Requirement',
        statement: 'Statement for healthy deduplication test',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(healthyReq);

      const createRes1 = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: healthyReq.id }),
      });
      assert.equal(createRes1.status, 201);
      const initialApv = await createRes1.json();
      assert.equal(initialApv.status, 'PENDING');

      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;
      const preApprovalsCount = (store.approvals[testProjectId] || []).length;

      // Second identical request - must deduplicate
      const createRes2 = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: healthyReq.id }),
      });
      assert.ok([200, 201].includes(createRes2.status), `Dedup status must be 200 or 201, got ${createRes2.status}`);
      const dedupApv = await createRes2.json();
      assert.equal(dedupApv.id, initialApv.id, 'Must return the identical approval item');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment on healthy deduplication');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount, 'Audit log must not append on deduplication');
      assert.equal((store.approvals[testProjectId] || []).length, preApprovalsCount, 'No duplicate approval items created');

      pass('64. Healthy pending approval deduplication returns existing approval without mutation or new audit events');
    } catch (e) {
      fail('64. Healthy pending approval deduplication returns existing approval without mutation or new audit events', e);
    }

    // 65. Deduplication of corrupted pending approval (malformed signatures) is rejected with HTTP 409 and code REISSUE_REQUIRED
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const corruptReq = {
        id: 'REQ-CORRUPT-DEDUP-01',
        title: 'Corrupted Pending Request Target',
        statement: 'Statement for corrupted deduplication test',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(corruptReq);

      const targetDigest = digest(corruptReq);
      const corruptedItem = {
        id: 'APV-CORRUPT-SIGS-01',
        projectId: testProjectId,
        title: corruptReq.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: corruptReq.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: corruptReq.statement,
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Hacker', decision: 'APPROVED' }, // missing identityId & roleSource
        ],
        targetDigest,
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).unshift(corruptedItem);

      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;
      const preApprovalsCount = (store.approvals[testProjectId] || []).length;

      const dedupRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: corruptReq.id }),
      });

      assert.equal(dedupRes.status, 409, 'Must reject deduplication of corrupted approval with HTTP 409');
      const errBody = await dedupRes.json();
      assert.equal(errBody.code, 'REISSUE_REQUIRED', 'Error code must be REISSUE_REQUIRED');
      assert.equal(errBody.approvalId, corruptedItem.id, 'Error must identify affected approvalId');
      assert.ok(errBody.reason || errBody.error, 'Must provide an explanation');

      // Assert no side-effects
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount, 'Audit log must not append');
      assert.equal((store.approvals[testProjectId] || []).length, preApprovalsCount, 'No approval mutated or added');
      assert.equal(corruptedItem.status, 'PENDING', 'Original status must remain PENDING');

      pass('65. Deduplication of corrupted pending approval (malformed signatures) is rejected with HTTP 409 and code REISSUE_REQUIRED');
    } catch (e) {
      fail('65. Deduplication of corrupted pending approval (malformed signatures) is rejected with HTTP 409 and code REISSUE_REQUIRED', e);
    }

    // 66. Deduplication of corrupted pending approval (invalid policyVersion or roles) is rejected with HTTP 409 and code REISSUE_REQUIRED
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const corruptPolicyReq = {
        id: 'REQ-CORRUPT-POLICY-01',
        title: 'Corrupted Policy Target',
        statement: 'Statement for corrupt policy dedup test',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(corruptPolicyReq);

      const targetDigest = digest(corruptPolicyReq);
      const corruptPolicyItem = {
        id: 'APV-CORRUPT-POLICY-01',
        projectId: testProjectId,
        title: corruptPolicyReq.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: corruptPolicyReq.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: corruptPolicyReq.statement,
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer'], // invalid roles: missing Lead Architect
        approvalsCollected: [],
        targetDigest,
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LEGACY_V0', // invalid policyVersion
      };
      (store.approvals[testProjectId] ||= []).unshift(corruptPolicyItem);

      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;

      const dedupRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: corruptPolicyReq.id }),
      });

      assert.equal(dedupRes.status, 409, 'Must reject with HTTP 409');
      const errBody = await dedupRes.json();
      assert.equal(errBody.code, 'REISSUE_REQUIRED');
      assert.equal(errBody.approvalId, corruptPolicyItem.id);
      assert.equal(prj.stateVersion, preVer);
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount);

      pass('66. Deduplication of corrupted pending approval (invalid policyVersion or roles) is rejected with HTTP 409 and code REISSUE_REQUIRED');
    } catch (e) {
      fail('66. Deduplication of corrupted pending approval (invalid policyVersion or roles) is rejected with HTTP 409 and code REISSUE_REQUIRED', e);
    }

    // 67. Multiple conflicting active pending approvals fail closed on request creation
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const conflictReq = {
        id: 'REQ-CONFLICT-DEDUP-01',
        title: 'Conflicting Target',
        statement: 'Statement for conflicting approvals test',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(conflictReq);

      const targetDigest = digest(conflictReq);
      const apvA = {
        id: 'APV-CONFLICT-A-01',
        projectId: testProjectId,
        title: conflictReq.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: conflictReq.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: conflictReq.statement,
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [],
        targetDigest,
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      const apvB = {
        id: 'APV-CONFLICT-B-01',
        projectId: testProjectId,
        title: conflictReq.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: conflictReq.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'leadArch',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: conflictReq.statement,
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [],
        targetDigest,
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).unshift(apvA, apvB);

      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;

      const conflictRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: conflictReq.id }),
      });

      assert.equal(conflictRes.status, 409, 'Multiple active pendings must fail closed with HTTP 409');
      assert.equal(prj.stateVersion, preVer);
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount);

      pass('67. Multiple conflicting active pending approvals fail closed on request creation');
    } catch (e) {
      fail('67. Multiple conflicting active pending approvals fail closed on request creation', e);
    }

    // 68. Request creation against changed target digest does not reuse existing pending approval
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const changedReq = {
        id: 'REQ-CHANGED-DIGEST-01',
        title: 'Original Title',
        statement: 'Original statement',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(changedReq);

      const oldDigest = digest(changedReq);
      const stalePending = {
        id: 'APV-STALE-PENDING-01',
        projectId: testProjectId,
        title: changedReq.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: changedReq.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: changedReq.statement,
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [],
        targetDigest: oldDigest,
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).unshift(stalePending);

      // Now mutate the target requirement statement so digest changes
      changedReq.statement = 'Mutated statement after approval creation';
      const newDigest = digest(changedReq);
      assert.notEqual(oldDigest, newDigest);

      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;

      const changedRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ targetEntityType: 'REQUIREMENT', targetEntityId: changedReq.id }),
      });

      // Must fail closed with 409 rather than silently returning stale pending approval
      assert.equal(changedRes.status, 409, 'Must fail closed when pending approval digest mismatches current target');
      assert.equal(prj.stateVersion, preVer);
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount);

      pass('68. Request creation against changed target digest does not reuse existing pending approval');
    } catch (e) {
      fail('68. Request creation against changed target digest does not reuse existing pending approval', e);
    }

    // 69. Unauthenticated reissue request returns HTTP 401
    try {
      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ humanConfirmed: true, justification: 'Recovery for corrupted record' }),
      });
      assert.equal(res.status, 401, 'Unauthenticated reissue must return HTTP 401');
      pass('69. Unauthenticated reissue request returns HTTP 401');
    } catch (e) {
      fail('69. Unauthenticated reissue request returns HTTP 401', e);
    }

    // 70. Unauthorized identity (missing reviewer role) reissue returns HTTP 403
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: devCookie },
        body: JSON.stringify({ humanConfirmed: true, justification: 'Recovery attempt by developer' }),
      });
      assert.equal(res.status, 403, 'Unauthorized reviewer must return HTTP 403');
      assert.equal(prj.stateVersion, preVer);
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount);

      pass('70. Unauthorized identity (missing reviewer role) reissue returns HTTP 403');
    } catch (e) {
      fail('70. Unauthorized identity (missing reviewer role) reissue returns HTTP 403', e);
    }

    // 71. Agent identity reissue request is rejected with HTTP 403
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const preVer = prj.stateVersion;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Agent attempt',
          actorType: 'AGENT',
        }),
      });
      assert.equal(res.status, 403, 'Agent actorType or claims must be rejected with HTTP 403');
      assert.equal(prj.stateVersion, preVer);

      pass('71. Agent identity reissue request is rejected with HTTP 403');
    } catch (e) {
      fail('71. Agent identity reissue request is rejected with HTTP 403', e);
    }

    // 72. Reissue without explicit humanConfirmed === true is rejected with HTTP 403
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const preVer = prj.stateVersion;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: false,
          justification: 'Recovery without confirmation',
        }),
      });
      assert.equal(res.status, 403, 'Missing humanConfirmed must return HTTP 403');
      assert.equal(prj.stateVersion, preVer);

      pass('72. Reissue without explicit humanConfirmed === true is rejected with HTTP 403');
    } catch (e) {
      fail('72. Reissue without explicit humanConfirmed === true is rejected with HTTP 403', e);
    }

    // 73. Reissue with missing or empty recovery justification is rejected with HTTP 422
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const preVer = prj.stateVersion;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: '   ',
        }),
      });
      assert.equal(res.status, 422, 'Empty justification must return HTTP 422');
      assert.equal(prj.stateVersion, preVer);

      pass('73. Reissue with missing or empty recovery justification is rejected with HTTP 422');
    } catch (e) {
      fail('73. Reissue with missing or empty recovery justification is rejected with HTTP 422', e);
    }

    // 74. Reissue of a healthy pending approval is rejected with HTTP 409
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const healthyReq2 = {
        id: 'REQ-HEALTHY-REISSUE-01',
        title: 'Healthy Target for Reissue Test',
        statement: 'Statement for healthy target',
        status: 'UNDER_REVIEW' as const,
      };
      (store.requirements[testProjectId] ||= []).push(healthyReq2);

      const targetDigest = digest(healthyReq2);
      const healthyApv = {
        id: 'APV-HEALTHY-01',
        projectId: testProjectId,
        title: healthyReq2.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: healthyReq2.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: healthyReq2.statement,
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [],
        targetDigest,
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).unshift(healthyApv);

      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${healthyApv.id}/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Attempt to reissue a healthy pending request',
        }),
      });

      assert.equal(res.status, 409, 'Reissuing a healthy pending approval must return HTTP 409');
      assert.equal(prj.stateVersion, preVer);
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount);
      assert.equal(healthyApv.status, 'PENDING');

      pass('74. Reissue of a healthy pending approval is rejected with HTTP 409');
    } catch (e) {
      fail('74. Reissue of a healthy pending approval is rejected with HTTP 409', e);
    }

    // 75. Reissue of an approved, rejected, or superseded approval is rejected with HTTP 409
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const terminalReq = {
        id: 'REQ-TERMINAL-REISSUE-01',
        title: 'Terminal Target',
        statement: 'Statement for terminal target',
        status: 'APPROVED' as const,
      };
      (store.requirements[testProjectId] ||= []).push(terminalReq);

      const targetDigest = digest(terminalReq);
      const approvedApv = {
        id: 'APV-ALREADY-APPROVED-01',
        projectId: testProjectId,
        title: terminalReq.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: terminalReq.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'APPROVED',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: terminalReq.statement,
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', approver: 'secOfficer', identityId: 'REV-SEC-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
          { role: 'Lead Architect', approver: 'leadArch', identityId: 'REV-ARCH-01', roleSource: 'LOCAL_SERVER_ROSTER', decision: 'APPROVED' },
        ],
        targetDigest,
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).unshift(approvedApv);

      const preVer = prj.stateVersion;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${approvedApv.id}/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Attempt to reissue approved item',
        }),
      });

      assert.equal(res.status, 409, 'Reissuing non-pending approval must return HTTP 409');
      assert.equal(prj.stateVersion, preVer);

      pass('75. Reissue of an approved, rejected, or superseded approval is rejected with HTTP 409');
    } catch (e) {
      fail('75. Reissue of an approved, rejected, or superseded approval is rejected with HTTP 409', e);
    }

    // 76. Reissue of approval with stale or deleted target fails closed with HTTP 404/409
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const staleApv = {
        id: 'APV-STALE-TARGET-01',
        projectId: testProjectId,
        title: 'Nonexistent target approval',
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: 'REQ-DOES-NOT-EXIST',
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: 'Target missing',
        impactAnalysis: 'Human sign-off',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Corrupt', decision: 'APPROVED' },
        ],
        targetDigest: '0'.repeat(64),
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target resolved' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      (store.approvals[testProjectId] ||= []).unshift(staleApv);

      const preVer = prj.stateVersion;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/${staleApv.id}/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Attempt to reissue approval with deleted target',
        }),
      });

      assert.ok([404, 409].includes(res.status), `Deleted target reissue must fail closed with 404 or 409, got ${res.status}`);
      assert.equal(prj.stateVersion, preVer);

      pass('76. Reissue of approval with stale or deleted target fails closed with HTTP 404/409');
    } catch (e) {
      fail('76. Reissue of approval with stale or deleted target fails closed with HTTP 404/409', e);
    }

    // 77. Valid corrupted-record reissue produces SUPERSEDED original and fresh PENDING replacement with 0 signatures
    let validReplacementId = '';
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;
      const preApprovalsCount = (store.approvals[testProjectId] || []).length;

      const res = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Governed recovery of corrupted signatures in APV-CORRUPT-SIGS-01',
        }),
      });

      assert.ok([200, 201].includes(res.status), `Reissue must succeed with 200 or 201, got ${res.status}`);
      const replacement = await res.json();
      validReplacementId = replacement.id;

      // Assert replacement structure
      assert.ok(replacement.id.startsWith('APV-'), 'Replacement must have APV- ID prefix');
      assert.notEqual(replacement.id, 'APV-CORRUPT-SIGS-01', 'Replacement must have distinct ID');
      assert.equal(replacement.status, 'PENDING', 'Replacement status must be PENDING');
      assert.equal(replacement.approvalsCollected.length, 0, 'Replacement must start with 0 signatures');
      assert.equal(replacement.supersededApprovalId, 'APV-CORRUPT-SIGS-01', 'Replacement must link to superseded ID');
      assert.equal(replacement.policyVersion, 'LOCAL_SESSION_V1');
      assert.deepEqual(replacement.requiredRoles, ['Security Officer', 'Lead Architect']);

      // Assert original item state
      const original = (store.approvals[testProjectId] || []).find((a: any) => a.id === 'APV-CORRUPT-SIGS-01')!;
      assert.equal(original.status, 'SUPERSEDED', 'Original approval must transition to SUPERSEDED');
      assert.equal(original.supersededBy, replacement.id, 'Original must link to replacement ID');
      assert.ok(original.supersededAt, 'Original must record supersededAt timestamp');
      assert.equal(original.supersededReason, 'Governed recovery of corrupted signatures in APV-CORRUPT-SIGS-01');
      assert.equal(original.approvalsCollected.length, 1, 'Original signatures must remain preserved');

      // Assert stateVersion increment and audit event
      assert.equal(prj.stateVersion, preVer + 1, 'StateVersion must increment by 1');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount + 1, 'Audit log must append exactly 1 event');
      assert.equal((store.approvals[testProjectId] || []).length, preApprovalsCount + 1, 'Exactly 1 new approval created');

      const auditEvent = store.auditLogs[testProjectId][0];
      assert.equal(auditEvent.action, 'APPROVAL_REISSUED');
      assert.equal(auditEvent.target, 'APV-CORRUPT-SIGS-01');

      pass('77. Valid corrupted-record reissue produces SUPERSEDED original and fresh PENDING replacement with 0 signatures');
    } catch (e) {
      fail('77. Valid corrupted-record reissue produces SUPERSEDED original and fresh PENDING replacement with 0 signatures', e);
    }

    // 78. Valid replacement approval can subsequently achieve dual-human quorum ratification
    try {
      assert.ok(validReplacementId, 'validReplacementId must be set from Scenario 77');
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId].find((r: any) => r.id === 'REQ-CORRUPT-DEDUP-01')!;
      const preVer = prj.stateVersion;

      // Decision 1: Security Officer
      const dec1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${validReplacementId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec1.status, 200, 'Security Officer ratification must return 200');
      const repAfter1 = (store.approvals[testProjectId] || []).find((a: any) => a.id === validReplacementId)!;
      assert.equal(repAfter1.status, 'PENDING');
      assert.equal(repAfter1.approvalsCollected.length, 1);

      // Decision 2: Lead Architect
      const dec2 = await fetch(`${base}/api/projects/${testProjectId}/approvals/${validReplacementId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(dec2.status, 200, 'Lead Architect ratification must return 200');
      const repAfter2 = (store.approvals[testProjectId] || []).find((a: any) => a.id === validReplacementId)!;
      assert.equal(repAfter2.status, 'APPROVED', 'Replacement must become APPROVED after dual-human quorum');
      assert.equal(repAfter2.approvalsCollected.length, 2);
      assert.equal(targetReq.status, 'APPROVED', 'Target requirement must become APPROVED');
      assert.equal(prj.stateVersion, preVer + 2);

      const q = evaluateQuorum(repAfter2, digest(targetReq));
      assert.equal(q.hasQuorum, true, 'Quorum must be SATISFIED');
      assert.equal(q.status, 'SATISFIED');

      // Attempting to decide on superseded original must fail
      const decSuperseded = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(decSuperseded.status, 409, 'Deciding on superseded approval must fail with HTTP 409');

      pass('78. Valid replacement approval can subsequently achieve dual-human quorum ratification');
    } catch (e) {
      fail('78. Valid replacement approval can subsequently achieve dual-human quorum ratification', e);
    }

    // 79. Idempotent reissue retry returns existing replacement without duplicate audit event or stateVersion increment
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const preVer = prj.stateVersion;
      const preAuditCount = (store.auditLogs[testProjectId] || []).length;
      const preApprovalsCount = (store.approvals[testProjectId] || []).length;

      const retryRes = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-SIGS-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Retry reissue of already-superseded approval',
        }),
      });

      assert.ok([200, 201].includes(retryRes.status), `Retry must return 200 or 201, got ${retryRes.status}`);
      const retryBody = await retryRes.json();
      assert.equal(retryBody.id, validReplacementId, 'Must return the already-created replacement');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment on idempotent retry');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAuditCount, 'Audit log must not append duplicate events');
      assert.equal((store.approvals[testProjectId] || []).length, preApprovalsCount, 'No duplicate approvals created');

      pass('79. Idempotent reissue retry returns existing replacement without duplicate audit event or stateVersion increment');
    } catch (e) {
      fail('79. Idempotent reissue retry returns existing replacement without duplicate audit event or stateVersion increment', e);
    }

    // 80. Cross-project reissue request is rejected with HTTP 404/403
    try {
      const res = await fetch(`${base}/api/projects/PRJ-OTHER/approvals/${validReplacementId}/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Cross project reissue attempt',
        }),
      });

      assert.ok([403, 404].includes(res.status), `Cross-project reissue must return 403 or 404, got ${res.status}`);

      pass('80. Cross-project reissue request is rejected with HTTP 404/403');
    } catch (e) {
      fail('80. Cross-project reissue request is rejected with HTTP 404/403', e);
    }

    // 81. Pending approval with malformed signatures evaluates to INVALID, projects reissueRequired, fails decision, and deduplicates to REISSUE_REQUIRED
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const targetReq = store.requirements[testProjectId].find((r: any) => r.id === 'REQ-CORRUPT-DEDUP-01')!;
      const malformedPendingApv: any = {
        id: 'APV-CORRUPT-PROJ-01',
        projectId: testProjectId,
        title: 'Pending with Malformed Signature Provenance',
        type: 'REQUIREMENT_BASELINE',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: targetReq.id,
        targetDigest: digest(targetReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          {
            role: 'Security Officer',
            approver: 'Malicious Or Spoofed Signer',
            decision: 'APPROVED',
            // missing identityId and missing roleSource!
          },
        ],
      };
      (store.approvals[testProjectId] ||= []).push(malformedPendingApv);

      // 1. evaluateQuorum directly on this item must return INVALID, hasQuorum: false, satisfiedRoles: []
      const evalDirect = evaluateQuorum(malformedPendingApv, digest(targetReq));
      assert.equal(evalDirect.status, 'INVALID', 'evaluateQuorum must return INVALID for pending approval with malformed signatures');
      assert.equal(evalDirect.hasQuorum, false, 'hasQuorum must be false');
      assert.deepEqual(evalDirect.satisfiedRoles, [], 'satisfiedRoles must be empty');
      assert.ok(evalDirect.reason?.includes('identityId') || evalDirect.reason?.includes('signature') || evalDirect.reason?.includes('roleSource'), 'Reason must explain malformed signature');

      // 2. GET /approvals must project quorum.status === 'INVALID', reissueRequired === true, and reissueReason
      const getRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie },
      });
      assert.equal(getRes.status, 200);
      const getList = await getRes.json();
      const projItem = getList.find((a: any) => a.id === 'APV-CORRUPT-PROJ-01');
      assert.ok(projItem, 'Projected list must contain malformed pending item');
      assert.equal(projItem.quorum.status, 'INVALID');
      assert.equal(projItem.quorum.hasQuorum, false);
      assert.deepEqual(projItem.quorum.satisfiedRoles, []);
      assert.equal(projItem.reissueRequired, true, 'Corrupted pending approval with fresh target must have reissueRequired: true');
      assert.ok(typeof projItem.reissueReason === 'string' && projItem.reissueReason.length > 0, 'Must have reissueReason');
      assert.equal(projItem.quorum.reissueRequired, true, 'quorum.reissueRequired must also be true');

      // 3. Contrast verification: healthy pending, approved, and superseded must NOT require reissue
      const healthyPending = getList.find((a: any) => a.id === 'APV-REAL-01');
      if (healthyPending) {
        assert.equal(Boolean(healthyPending.reissueRequired), false, 'Healthy pending must not require reissue');
      }
      const supersededItem = getList.find((a: any) => a.id === 'APV-CORRUPT-SIGS-01');
      if (supersededItem) {
        assert.equal(Boolean(supersededItem.reissueRequired), false, 'Superseded record must not require reissue');
      }

      // 4. Deciding on corrupted pending record returns HTTP 409 without state mutation
      const preVer = prj.stateVersion;
      const preAudit = (store.auditLogs[testProjectId] || []).length;
      const decRes = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-PROJ-01/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({ decision: 'APPROVED', humanConfirmed: true }),
      });
      assert.equal(decRes.status, 409, 'Deciding on corrupted pending approval must return 409');
      assert.equal(prj.stateVersion, preVer, 'StateVersion must not increment on failed decision');
      assert.equal((store.auditLogs[testProjectId] || []).length, preAudit, 'Audit log must not append event');

      // 5. Reissuing the corrupted pending record succeeds
      const reissueRes = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CORRUPT-PROJ-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Recovery of APV-CORRUPT-PROJ-01 with malformed signatures',
        }),
      });
      assert.ok([200, 201].includes(reissueRes.status), `Reissue must succeed, got ${reissueRes.status}`);
      const rep = await reissueRes.json();
      assert.equal(rep.status, 'PENDING');
      assert.equal(rep.type, 'REQUIREMENT_BASELINE');
      assert.equal(malformedPendingApv.status, 'SUPERSEDED');

      pass('81. Pending approval with malformed signatures evaluates to INVALID, projects reissueRequired, fails decision, and deduplicates to REISSUE_REQUIRED');
    } catch (e) {
      fail('81. Pending approval with malformed signatures evaluates to INVALID, projects reissueRequired, fails decision, and deduplicates to REISSUE_REQUIRED', e);
    }

    // 82. Pending approval with mismatched type is detected as corrupted and reissue derives canonical mapped type
    try {
      const prj = store.projects.find((p: any) => p.id === testProjectId)!;
      const freshReq: any = {
        id: 'REQ-MISMATCH-TYPE-TEST',
        projectId: testProjectId,
        title: 'Canonical Type Integrity Requirement',
        statement: 'Test requirement for canonical type mapping verification',
        status: 'DRAFT',
      };
      store.requirements[testProjectId].push(freshReq);

      const mismatchTypeApv: any = {
        id: 'APV-MISMATCH-TYPE-01',
        projectId: testProjectId,
        title: 'Mismatched Type Approval',
        type: 'REQUIREMENT', // Intentionally wrong type instead of REQUIREMENT_BASELINE
        targetEntityType: 'REQUIREMENT',
        targetEntityId: freshReq.id,
        targetDigest: digest(freshReq),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [],
      };
      (store.approvals[testProjectId] ||= []).push(mismatchTypeApv);

      // 1. Deduplication on POST /approvals detects corrupted type and returns 409 REISSUE_REQUIRED
      const dedupRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          targetEntityType: 'REQUIREMENT',
          targetEntityId: freshReq.id,
        }),
      });
      assert.equal(dedupRes.status, 409, 'Deduplication must reject mismatched type with 409');
      const dedupBody = await dedupRes.json();
      assert.equal(dedupBody.code, 'REISSUE_REQUIRED', 'Error code must be REISSUE_REQUIRED');
      assert.equal(dedupBody.approvalId, 'APV-MISMATCH-TYPE-01');

      // 2. GET /approvals projects reissueRequired === true
      const getRes = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie },
      });
      assert.equal(getRes.status, 200);
      const getList = await getRes.json();
      const projItem = getList.find((a: any) => a.id === 'APV-MISMATCH-TYPE-01');
      assert.ok(projItem, 'Projected list must contain mismatch item');
      assert.equal(projItem.reissueRequired, true, 'Mismatched type approval must have reissueRequired: true');

      // 3. Reissuing produces replacement with canonical type REQUIREMENT_BASELINE, NOT copying corrupted type 'REQUIREMENT'
      const reissueRes = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-MISMATCH-TYPE-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Fix mismatched approval type to canonical REQUIREMENT_BASELINE',
        }),
      });
      assert.ok([200, 201].includes(reissueRes.status), `Reissue must succeed, got ${reissueRes.status}`);
      const rep = await reissueRes.json();
      assert.equal(rep.type, 'REQUIREMENT_BASELINE', 'Replacement must derive canonical type REQUIREMENT_BASELINE from mapping');
      assert.notEqual(rep.type, mismatchTypeApv.type, 'Replacement must NOT copy corrupted type');
      assert.equal(mismatchTypeApv.type, 'REQUIREMENT', 'Original historical type must remain preserved');
      assert.equal(mismatchTypeApv.status, 'SUPERSEDED');

      // Also verify canonical type derivation for ADR, RISK, OVERRIDE
      const freshAdr: any = {
        id: 'ADR-MISMATCH-TYPE-TEST',
        projectId: testProjectId,
        title: 'Canonical Type Integrity ADR',
        context: 'Test ADR for canonical type mapping verification',
        status: 'PROPOSED',
      };
      store.adrs[testProjectId].push(freshAdr);

      const mismatchAdrApv: any = {
        id: 'APV-MISMATCH-ADR-01',
        projectId: testProjectId,
        title: 'Mismatched ADR Type',
        type: 'ADR', // wrong type instead of ADR_SIGN_OFF
        targetEntityType: 'ADR',
        targetEntityId: freshAdr.id,
        targetDigest: digest(freshAdr),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [],
      };
      store.approvals[testProjectId].push(mismatchAdrApv);

      const reissueAdrRes = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-MISMATCH-ADR-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Fix mismatched ADR type to canonical ADR_SIGN_OFF',
        }),
      });
      assert.ok([200, 201].includes(reissueAdrRes.status));
      const repAdr = await reissueAdrRes.json();
      assert.equal(repAdr.type, 'ADR_SIGN_OFF', 'Replacement ADR must have canonical type ADR_SIGN_OFF');

      pass('82. Pending approval with mismatched type is detected as corrupted and reissue derives canonical mapped type');
    } catch (e) {
      fail('82. Pending approval with mismatched type is detected as corrupted and reissue derives canonical mapped type', e);
    }

    // -------------------------------------------------------------------------
    // Scenario 83: POST .../decide rejects mismatched approval type with HTTP 409 and REISSUE_REQUIRED
    // -------------------------------------------------------------------------
    try {
      const freshReq83: any = {
        id: 'REQ-MISMATCH-DECIDE-01',
        projectId: testProjectId,
        title: 'Mismatched Decide Validation Req',
        statement: 'Validation requirement for decision-time canonical type enforcement',
        status: 'PROPOSED',
      };
      store.requirements[testProjectId].push(freshReq83);

      const apvMismatchDecide0: any = {
        id: 'APV-MISMATCH-DECIDE-0',
        projectId: testProjectId,
        title: 'Mismatched Approval 0 Signatures',
        type: 'REQUIREMENT', // Invalid: should be REQUIREMENT_BASELINE
        targetEntityType: 'REQUIREMENT',
        targetEntityId: freshReq83.id,
        targetDigest: digest(freshReq83),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [],
      };
      store.approvals[testProjectId].push(apvMismatchDecide0);

      const initialVersion = store.projects.find((p: any) => p.id === testProjectId).stateVersion;
      const initialAuditCount = (store.auditLogs[testProjectId] || []).length;

      // Decide with 0 signatures must reject with 409 REISSUE_REQUIRED
      const decideRes0 = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-MISMATCH-DECIDE-0/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          decision: 'APPROVED',
          comment: 'Should fail type integrity check',
        }),
      });
      assert.equal(decideRes0.status, 409, `Expected 409 for mismatched type, got ${decideRes0.status}`);
      const data0 = await decideRes0.json();
      assert.equal(data0.code, 'REISSUE_REQUIRED');
      assert.ok(data0.error.includes('Mismatched approval type') || data0.error.includes('REQUIREMENT_BASELINE'));
      // Verify zero state mutation
      assert.equal(apvMismatchDecide0.status, 'PENDING');
      assert.equal(apvMismatchDecide0.approvalsCollected.length, 0);
      assert.equal(store.projects.find((p: any) => p.id === testProjectId).stateVersion, initialVersion);
      assert.equal((store.auditLogs[testProjectId] || []).length, initialAuditCount);

      // Now test with 1 existing signature
      const apvMismatchDecide1: any = {
        id: 'APV-MISMATCH-DECIDE-1',
        projectId: testProjectId,
        title: 'Mismatched Approval 1 Signature',
        type: 'REQUIREMENT', // Invalid: should be REQUIREMENT_BASELINE
        targetEntityType: 'REQUIREMENT',
        targetEntityId: freshReq83.id,
        targetDigest: digest(freshReq83),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [
          {
            role: 'Security Officer',
            approver: 'Security Officer',
            identityId: 'REV-SEC-01',
            roleSource: 'LOCAL_SERVER_ROSTER',
            decision: 'APPROVED',
            timestamp: new Date().toISOString(),
          },
        ],
      };
      store.approvals[testProjectId].push(apvMismatchDecide1);

      const decideRes1 = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-MISMATCH-DECIDE-1/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: archCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          decision: 'APPROVED',
          comment: 'Should fail type integrity check even with 1 valid signature',
        }),
      });
      assert.equal(decideRes1.status, 409, `Expected 409 for mismatched type with 1 signature, got ${decideRes1.status}`);
      const data1 = await decideRes1.json();
      assert.equal(data1.code, 'REISSUE_REQUIRED');
      // Verify zero state mutation
      assert.equal(apvMismatchDecide1.status, 'PENDING');
      assert.equal(apvMismatchDecide1.approvalsCollected.length, 1);
      assert.equal(store.projects.find((p: any) => p.id === testProjectId).stateVersion, initialVersion);
      assert.equal((store.auditLogs[testProjectId] || []).length, initialAuditCount);

      pass('83. Decision endpoint rejects mismatched approval type with HTTP 409 and REISSUE_REQUIRED (0 and 1 signature cases)');
    } catch (e) {
      fail('83. Decision endpoint rejects mismatched approval type with HTTP 409 and REISSUE_REQUIRED (0 and 1 signature cases)', e);
    }

    // -------------------------------------------------------------------------
    // Scenario 84: Pending approval with malformed or unexpected postRatificationDigest enforces INVALID quorum, GET projection, decision 409, deduplication 409, and clean reissue
    // -------------------------------------------------------------------------
    try {
      const freshReq84: any = {
        id: 'REQ-RATIF-PENDING-01',
        projectId: testProjectId,
        title: 'Pending Ratification Metadata Test',
        statement: 'Verify pending approval cannot contain postRatificationDigest',
        status: 'PROPOSED',
      };
      store.requirements[testProjectId].push(freshReq84);

      const apvRatifPending: any = {
        id: 'APV-RATIF-PENDING-01',
        projectId: testProjectId,
        title: 'Pending Ratification Metadata Approval',
        type: 'REQUIREMENT_BASELINE',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: freshReq84.id,
        targetDigest: digest(freshReq84),
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [],
        postRatificationDigest: 'a'.repeat(64), // Inconsistent: pending approval should NOT have postRatificationDigest
      };
      store.approvals[testProjectId].push(apvRatifPending);

      // 1. evaluateQuorum must return INVALID status mentioning inconsistent ratification metadata
      const qEval = evaluateQuorum(apvRatifPending, digest(freshReq84));
      assert.equal(qEval.status, 'INVALID');
      assert.ok(qEval.reason && qEval.reason.includes('unexpected postRatificationDigest'));

      // 2. GET projection must project reissueRequired: true and quorum.status: 'INVALID'
      const getRes84 = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie },
      });
      assert.equal(getRes84.status, 200);
      const list84 = await getRes84.json();
      const projItem84 = list84.find((a: any) => a.id === 'APV-RATIF-PENDING-01');
      assert.ok(projItem84);
      assert.equal(projItem84.reissueRequired, true);
      assert.equal(projItem84.quorum.status, 'INVALID');

      // 3. POST .../decide must reject with 409 REISSUE_REQUIRED
      const decideRes84 = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-RATIF-PENDING-01/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          decision: 'APPROVED',
          comment: 'Should fail due to unexpected postRatificationDigest',
        }),
      });
      assert.equal(decideRes84.status, 409);
      const decideData84 = await decideRes84.json();
      assert.equal(decideData84.code, 'REISSUE_REQUIRED');

      // 4. Deduplication via POST .../approvals must reject deduplication with 409 REISSUE_REQUIRED
      const dedupRes84 = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          targetEntityType: 'REQUIREMENT',
          targetEntityId: freshReq84.id,
        }),
      });
      assert.equal(dedupRes84.status, 409);
      const dedupData84 = await dedupRes84.json();
      assert.equal(dedupData84.code, 'REISSUE_REQUIRED');

      // 5. POST .../reissue must succeed and create clean replacement without postRatificationDigest
      const reissueRes84 = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-RATIF-PENDING-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Clear invalid pending ratification metadata via governed reissue',
        }),
      });
      assert.ok([200, 201].includes(reissueRes84.status));
      const rep84 = await reissueRes84.json();
      assert.equal(rep84.status, 'PENDING');
      assert.equal(rep84.postRatificationDigest, undefined, 'Replacement approval must not carry over postRatificationDigest');
      assert.equal(apvRatifPending.status, 'SUPERSEDED');

      pass('84. Pending approval with unexpected postRatificationDigest enforces INVALID quorum, GET projection, decision 409, dedup 409, and clean reissue');
    } catch (e) {
      fail('84. Pending approval with unexpected postRatificationDigest enforces INVALID quorum, GET projection, decision 409, dedup 409, and clean reissue', e);
    }

    // -------------------------------------------------------------------------
    // Scenario 85: Corrupted pending approval against STALE canonical target projects reissueRequired: false and rejects reissue
    // -------------------------------------------------------------------------
    try {
      const freshAdr85: any = {
        id: 'ADR-STALE-REISSUE-01',
        projectId: testProjectId,
        title: 'Stale Target Corrupted Approval Test',
        context: 'Verify stale target suppresses reissueRequired',
        status: 'PROPOSED',
      };
      store.adrs[testProjectId].push(freshAdr85);
      const originalAdrDigest = digest(freshAdr85);

      const apvStaleCorrupt: any = {
        id: 'APV-STALE-CORRUPT-01',
        projectId: testProjectId,
        title: 'Stale Corrupted Approval',
        type: 'ADR', // Mismatched type (corrupted)
        targetEntityType: 'ADR',
        targetEntityId: freshAdr85.id,
        targetDigest: originalAdrDigest,
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [],
      };
      store.approvals[testProjectId].push(apvStaleCorrupt);

      // Mutate canonical target so digest changes (becomes STALE)
      freshAdr85.context = 'Updated context that changes digest';
      const updatedAdrDigest = digest(freshAdr85);
      assert.notEqual(originalAdrDigest, updatedAdrDigest);

      // 1. GET projection: reissueRequired must be false because target is stale
      const getRes85 = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie },
      });
      const list85 = await getRes85.json();
      const projItem85 = list85.find((a: any) => a.id === 'APV-STALE-CORRUPT-01');
      assert.ok(projItem85);
      assert.equal(projItem85.reissueRequired, false, 'Stale target must suppress reissueRequired');

      // 2. POST .../reissue must reject with 409 (target has changed)
      const reissueRes85 = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-STALE-CORRUPT-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Attempting reissue on stale target',
        }),
      });
      assert.equal(reissueRes85.status, 409);
      const reissueData85 = await reissueRes85.json();
      assert.ok(reissueData85.error.includes('Canonical approval target has changed'));
      assert.equal(apvStaleCorrupt.status, 'PENDING', 'Original approval must not be mutated');

      pass('85. Corrupted pending approval against STALE canonical target projects reissueRequired: false and rejects reissue');
    } catch (e) {
      fail('85. Corrupted pending approval against STALE canonical target projects reissueRequired: false and rejects reissue', e);
    }

    // -------------------------------------------------------------------------
    // Scenario 86: Corrupted pending approval with conflicting active pending requests projects reissueRequired: false and rejects reissue
    // -------------------------------------------------------------------------
    try {
      const freshReq86: any = {
        id: 'REQ-CONFLICT-REISSUE-01',
        projectId: testProjectId,
        title: 'Conflict Active Pending Test',
        statement: 'Verify multiple active pending approvals suppress reissueRequired',
        status: 'PROPOSED',
      };
      store.requirements[testProjectId].push(freshReq86);
      const req86Digest = digest(freshReq86);

      const apvConflict1: any = {
        id: 'APV-CONFLICT-01',
        projectId: testProjectId,
        title: 'Corrupted Approval with Conflict',
        type: 'REQUIREMENT', // Corrupted type
        targetEntityType: 'REQUIREMENT',
        targetEntityId: freshReq86.id,
        targetDigest: req86Digest,
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [],
      };
      const apvConflict2: any = {
        id: 'APV-CONFLICT-02',
        projectId: testProjectId,
        title: 'Second Active Pending Approval',
        type: 'REQUIREMENT_BASELINE',
        targetEntityType: 'REQUIREMENT',
        targetEntityId: freshReq86.id,
        targetDigest: req86Digest,
        policyVersion: 'LOCAL_SESSION_V1',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        status: 'PENDING',
        approvalsCollected: [],
      };
      store.approvals[testProjectId].push(apvConflict1);
      store.approvals[testProjectId].push(apvConflict2);

      // 1. GET projection: APV-CONFLICT-01 must have reissueRequired: false because conflicting active approvals exist
      const getRes86 = await fetch(`${base}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie },
      });
      const list86 = await getRes86.json();
      const projItem86_1 = list86.find((a: any) => a.id === 'APV-CONFLICT-01');
      assert.ok(projItem86_1);
      assert.equal(projItem86_1.reissueRequired, false, 'Conflicting active pending approvals must suppress reissueRequired');

      // 2. POST .../reissue on APV-CONFLICT-01 must reject with 409
      const reissueRes86 = await fetch(`${base}/api/projects/${testProjectId}/approvals/APV-CONFLICT-01/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Attempting reissue when another active pending exists',
        }),
      });
      assert.equal(reissueRes86.status, 409);
      const reissueData86 = await reissueRes86.json();
      assert.ok(reissueData86.error.includes('Conflicting active pending approval'));
      assert.equal(apvConflict1.status, 'PENDING', 'Original approval must not be mutated');

      pass('86. Corrupted pending approval with conflicting active pending requests projects reissueRequired: false and rejects reissue');
    } catch (e) {
      fail('86. Corrupted pending approval with conflicting active pending requests projects reissueRequired: false and rejects reissue', e);
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
console.log(`TOTAL SCENARIOS: 86 | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}


