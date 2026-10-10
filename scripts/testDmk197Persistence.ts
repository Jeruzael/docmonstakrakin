import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto, { randomBytes, scryptSync } from 'node:crypto';
import express from 'express';
import { ProjectStore } from '../server/projectStore.ts';
import {
  installProjectPersistence,
  readProjectSnapshot,
  projectSnapshotDigest,
  snapshotProjectStore,
  writeProjectSnapshotAtomic,
} from '../server/projectPersistence.ts';
import { registerSignoffRoutes } from '../server/proposals/signoff.ts';

console.log('================================================================');
console.log('   DMK-197 PERSISTENCE & TRANSACTIONAL ROLLBACK TEST SUITE');
console.log('   Evaluates Real .local/project-state.json Persistence Invariants');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`✓ [PASS] ${name}`);
}

function fail(name: string, err: any) {
  failed++;
  console.error(`✗ [FAIL] ${name}`);
  console.error(err);
}

// Scrypt password verifier helper
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
};

const originalEnv = process.env.DMK_HUMAN_REVIEWERS;
process.env.DMK_HUMAN_REVIEWERS = JSON.stringify(testReviewers);

async function loginAndGetCookie(base: string, username: string, pw: string): Promise<string> {
  const res = await fetch(`${base}/api/governance/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: pw }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${username}: ${res.status} ${JSON.stringify(data)}`);
  }
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error(`No set-cookie returned for ${username}`);
  return cookie.split(';')[0];
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk197-persist-'));
const testProjectId = 'PRJ-PERSIST-197';

try {
  // TEST A: Successful Restart Recovery
  try {
    const store1: any = new ProjectStore();
    store1.projects = [
      {
        id: testProjectId,
        name: 'Persistence Verification Project',
        owner: 'TestOwner',
        stateVersion: 1,
      },
    ];
    store1.requirements = {
      [testProjectId]: [
        {
          id: 'REQ-PERSIST-01',
          title: 'Durable Authentication Requirement',
          status: 'UNDER_REVIEW',
          statement: 'Must survive server restart and transaction rollback',
          urgency: 'HIGH',
          riskLevel: 'HIGH',
        },
      ],
    };
    store1.approvals = { [testProjectId]: [] };
    store1.auditLogs = { [testProjectId]: [] };

    const app1 = express();
    app1.use(express.json());
    installProjectPersistence(app1, store1, tempDir);
    registerSignoffRoutes(app1, store1);

    const server1 = app1.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server1.once('listening', r));
    const port1 = (server1.address() as any).port;
    const base1 = `http://127.0.0.1:${port1}`;

    const secCookie1 = await loginAndGetCookie(base1, 'secOfficer', 'SecPass123!');
    const archCookie1 = await loginAndGetCookie(base1, 'leadArch', 'ArchPass123!');

    // 1. Submit sign-off request
    const createRes = await fetch(`${base1}/api/projects/${testProjectId}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: secCookie1 },
      body: JSON.stringify({
        title: 'Ratify REQ-PERSIST-01',
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: 'REQ-PERSIST-01',
        targetEntityType: 'REQUIREMENT',
        description: 'Durable authentication sign-off',
        impactAnalysis: 'Core engine',
        urgency: 'HIGH',
      }),
    });
    assert.equal(createRes.status, 201, 'Approval request creation should return HTTP 201');
    const createData = await createRes.json();
    const apvId = createData.id;
    assert.ok(apvId, 'Approval ID must be assigned');

    // 2. Security Officer approval
    const secRes = await fetch(`${base1}/api/projects/${testProjectId}/approvals/${apvId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: secCookie1 },
      body: JSON.stringify({
        humanConfirmed: true,
        decision: 'APPROVED',
        comment: 'Security Officer signature ratified',
      }),
    });
    assert.equal(secRes.status, 200, 'Security Officer decision should succeed');
    const secData = await secRes.json();
    assert.equal(secData.status, 'PENDING', 'Request must remain PENDING after 1 signature');
    assert.equal(store1.requirements[testProjectId][0].status, 'UNDER_REVIEW');

    // 3. Lead Architect approval
    const archRes = await fetch(`${base1}/api/projects/${testProjectId}/approvals/${apvId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: archCookie1 },
      body: JSON.stringify({
        humanConfirmed: true,
        decision: 'APPROVED',
        comment: 'Lead Architect signature ratified',
      }),
    });
    assert.equal(archRes.status, 200, 'Lead Architect decision should succeed');
    const archData = await archRes.json();
    assert.equal(archData.status, 'APPROVED', 'Request must be APPROVED after both signatures');
    assert.equal(store1.requirements[testProjectId][0].status, 'APPROVED', 'Target requirement must be APPROVED');

    const preRestartVersion = store1.projects[0].stateVersion;
    const preRestartDigest = projectSnapshotDigest(tempDir);
    assert.ok(preRestartDigest, 'Snapshot must be written to disk in temp workspace');

    // Stop Server 1
    await new Promise<void>((resolve, reject) => {
      server1.close((err) => (err ? reject(err) : resolve()));
    });

    // 4. Restart Server 2 from persisted on-disk snapshot
    const store2: any = new ProjectStore();
    const app2 = express();
    app2.use(express.json());
    installProjectPersistence(app2, store2, tempDir);
    registerSignoffRoutes(app2, store2);

    const server2 = app2.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server2.once('listening', r));
    const port2 = (server2.address() as any).port;
    const base2 = `http://127.0.0.1:${port2}`;

    const secCookie2 = await loginAndGetCookie(base2, 'secOfficer', 'SecPass123!');

    // Verify hydrated approvals list and quorum
    const listRes = await fetch(`${base2}/api/projects/${testProjectId}/approvals`, {
      headers: { Cookie: secCookie2 },
    });
    assert.equal(listRes.status, 200);
    const approvalsList = await listRes.json();
    assert.equal(approvalsList.length, 1);
    const persistedApv = approvalsList[0];

    assert.equal(persistedApv.id, apvId);
    assert.equal(persistedApv.status, 'APPROVED');
    assert.equal(persistedApv.policyVersion, 'LOCAL_SESSION_V1');
    assert.equal(persistedApv.quorum.status, 'SATISFIED');
    assert.equal(persistedApv.quorum.hasQuorum, true);
    assert.deepEqual(persistedApv.quorum.satisfiedRoles, ['Security Officer', 'Lead Architect']);
    assert.deepEqual(persistedApv.quorum.pendingRoles, []);

    // Verify signature provenance preserved
    assert.equal(persistedApv.approvalsCollected.length, 2);
    const sig1 = persistedApv.approvalsCollected[0];
    assert.equal(sig1.role, 'Security Officer');
    assert.equal(sig1.identityId, 'REV-SEC-01');
    assert.equal(sig1.roleSource, 'LOCAL_SERVER_ROSTER');
    assert.equal(sig1.decision, 'APPROVED');

    const sig2 = persistedApv.approvalsCollected[1];
    assert.equal(sig2.role, 'Lead Architect');
    assert.equal(sig2.identityId, 'REV-ARCH-01');
    assert.equal(sig2.roleSource, 'LOCAL_SERVER_ROSTER');
    assert.equal(sig2.decision, 'APPROVED');

    // Verify target requirement preserved
    const targetReq = store2.requirements[testProjectId].find((r: any) => r.id === 'REQ-PERSIST-01');
    assert.ok(targetReq, 'Target requirement must exist');
    assert.equal(targetReq.status, 'APPROVED', 'Target requirement must remain APPROVED across restart');

    // Verify stateVersion preserved
    assert.equal(store2.projects[0].stateVersion, preRestartVersion, 'stateVersion must match across restart');

    // Verify audit log chain preserved
    const auditLogs = store2.auditLogs[testProjectId];
    assert.ok(auditLogs && auditLogs.length >= 3, 'Audit logs must contain request and 2 signature events');
    for (let i = 0; i < auditLogs.length - 1; i++) {
      assert.equal(auditLogs[i].previousHash, auditLogs[i + 1].stateHash, 'Cryptographic audit chain must remain continuous');
    }
    const reqEvent = auditLogs.find((e: any) => e.action === 'APPROVAL_REQUESTED');
    assert.ok(reqEvent, 'APPROVAL_REQUESTED audit event must exist');
    const sigEvents = auditLogs.filter((e: any) => e.action === 'GOVERNANCE_SIGNATURE');
    assert.equal(sigEvents.length, 2, 'Exactly 2 GOVERNANCE_SIGNATURE audit events must exist');

    pass('PERSIST-1: Successful server restart recovery preserves approvals, signatures, target entity, stateVersion, and audit chain');

    // TEST B: Failed Write Rollback
    try {
      // 1. Induce snapshot write failure by holding the write lock file
      const lockPath = path.join(tempDir, '.local', 'project-state.write.lock');
      const lockFd = fs.openSync(lockPath, 'wx');

      // 2. Record pre-failure state
      const stateVersionBefore = store2.projects[0].stateVersion;
      const auditCountBefore = store2.auditLogs[testProjectId].length;
      const approvalsCountBefore = store2.approvals[testProjectId].length;
      const targetStatusBefore = store2.requirements[testProjectId][0].status;
      const onDiskDigestBefore = projectSnapshotDigest(tempDir);

      // 3. Attempt mutating approval request while write lock is blocked
      const failRes = await fetch(`${base2}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie2 },
        body: JSON.stringify({
          title: 'Should Roll Back',
          type: 'REQUIREMENT_BASELINE',
          targetEntityId: 'REQ-PERSIST-01',
          targetEntityType: 'REQUIREMENT',
          description: 'Fail test',
          impactAnalysis: 'None',
          urgency: 'LOW',
        }),
      });

      assert.equal(failRes.status, 500, 'Blocked persistence write must return HTTP 500');
      const failData = await failRes.json();
      assert.equal(
        failData.error,
        'Failed to persist project transaction; changes rolled back',
        'Failure response must indicate transaction rollback'
      );

      // 4. Verify in-memory rollback
      assert.equal(store2.projects[0].stateVersion, stateVersionBefore, 'stateVersion must not increment on rollback');
      assert.equal(store2.auditLogs[testProjectId].length, auditCountBefore, 'Audit events must not be added on rollback');
      assert.equal(store2.approvals[testProjectId].length, approvalsCountBefore, 'Approvals must not be added on rollback');
      assert.equal(store2.requirements[testProjectId][0].status, targetStatusBefore, 'Target status must not change on rollback');
      assert.equal(projectSnapshotDigest(tempDir), onDiskDigestBefore, 'On-disk snapshot must remain untouched');

      // 5. Verify audit chain validity after rollback
      for (let i = 0; i < store2.auditLogs[testProjectId].length - 1; i++) {
        assert.equal(store2.auditLogs[testProjectId][i].previousHash, store2.auditLogs[testProjectId][i + 1].stateHash);
      }

      // 6. Release lock file and verify recovery
      fs.closeSync(lockFd);
      fs.unlinkSync(lockPath);

      // Add a fresh requirement REQ-PERSIST-02 to verify clean forward recovery
      store2.requirements[testProjectId].push({
        id: 'REQ-PERSIST-02',
        title: 'Second Requirement',
        status: 'UNDER_REVIEW',
        statement: 'Recovery verification statement',
        urgency: 'MEDIUM',
        riskLevel: 'LOW',
      });

      const recoverRes = await fetch(`${base2}/api/projects/${testProjectId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie2 },
        body: JSON.stringify({
          title: 'Ratify REQ-PERSIST-02',
          type: 'REQUIREMENT_BASELINE',
          targetEntityId: 'REQ-PERSIST-02',
          targetEntityType: 'REQUIREMENT',
          description: 'Recovery test',
          impactAnalysis: 'None',
          urgency: 'MEDIUM',
        }),
      });
      assert.equal(recoverRes.status, 201, 'Request must succeed once write lock is cleared');
      assert.equal(store2.approvals[testProjectId].length, approvalsCountBefore + 1, 'Approval must persist on recovery');
      assert.notEqual(projectSnapshotDigest(tempDir), onDiskDigestBefore, 'Snapshot must update on disk on successful write');

      pass('PERSIST-2: Failed snapshot write rolls back in-memory state, prevents stateVersion/audit mutation, preserves on-disk snapshot, and recovers cleanly');
    } catch (e) {
      fail('PERSIST-2: Failed snapshot write rollback', e);
    }

    // TEST C: Reissue Persistence Rollback & Server Restart Recovery
    try {
      // 1. Setup a dedicated requirement REQ-PERSIST-03 and a corrupted pending approval
      const targetReq3 = {
        id: 'REQ-PERSIST-03',
        title: 'Third Requirement for Reissue',
        status: 'UNDER_REVIEW',
        statement: 'Persistence reissue recovery requirement',
        urgency: 'HIGH',
        riskLevel: 'HIGH',
      };
      store2.requirements[testProjectId].push(targetReq3);

      const corruptApvId = 'APV-PERSIST-CORRUPT-01';
      const corruptItem = {
        id: corruptApvId,
        projectId: testProjectId,
        title: targetReq3.title,
        type: 'REQUIREMENT_BASELINE',
        targetEntityId: targetReq3.id,
        targetEntityType: 'REQUIREMENT',
        requestedBy: 'secOfficer',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        urgency: 'HIGH',
        riskLevel: 'MEDIUM',
        description: targetReq3.statement,
        impactAnalysis: 'Persistence reissue recovery test',
        requiredRoles: ['Security Officer', 'Lead Architect'],
        approvalsCollected: [
          { role: 'Security Officer', approver: 'Corrupt', decision: 'APPROVED' }, // corrupted signature without identityId & roleSource
        ],
        targetDigest: crypto.createHash('sha256').update(JSON.stringify(targetReq3)).digest('hex'),
        policyGates: [{ gateName: 'Canonical target exists', passed: true, details: 'Target in project' }],
        policyVersion: 'LOCAL_SESSION_V1',
      };
      store2.approvals[testProjectId].push(corruptItem);

      // Part 1: Failed Write Rollback during Reissue
      const lockPath = path.join(tempDir, '.local', 'project-state.write.lock');
      const lockFd = fs.openSync(lockPath, 'wx');

      const stateVerBefore = store2.projects[0].stateVersion;
      const auditCountBefore = store2.auditLogs[testProjectId].length;
      const approvalsCountBefore = store2.approvals[testProjectId].length;

      const failReissueRes = await fetch(`${base2}/api/projects/${testProjectId}/approvals/${corruptApvId}/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie2 },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Recovery under write failure condition',
        }),
      });

      assert.equal(failReissueRes.status, 500, 'Reissue during write lock must return HTTP 500');
      const failData = await failReissueRes.json();
      assert.equal(failData.error, 'Failed to persist project transaction; changes rolled back');

      // Verify in-memory rollback:
      assert.equal(store2.projects[0].stateVersion, stateVerBefore, 'stateVersion must not change on rollback');
      assert.equal(store2.auditLogs[testProjectId].length, auditCountBefore, 'Audit logs must not change on rollback');
      assert.equal(store2.approvals[testProjectId].length, approvalsCountBefore, 'Approvals count must not change');
      const itemAfterRollback = store2.approvals[testProjectId].find((a: any) => a.id === corruptApvId);
      assert.equal(itemAfterRollback.status, 'PENDING', 'Original approval must remain PENDING after rollback');
      assert.equal(itemAfterRollback.supersededBy, undefined, 'supersededBy must not be set after rollback');

      // Release write lock
      fs.closeSync(lockFd);
      fs.unlinkSync(lockPath);

      // Part 2: Successful Reissue & Persistence
      const successReissueRes = await fetch(`${base2}/api/projects/${testProjectId}/approvals/${corruptApvId}/reissue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: secCookie2 },
        body: JSON.stringify({
          humanConfirmed: true,
          justification: 'Legitimate recovery of corrupted persistence record',
        }),
      });

      assert.ok([200, 201].includes(successReissueRes.status), `Reissue must succeed with 200 or 201, got ${successReissueRes.status}`);
      const replacement = await successReissueRes.json();
      assert.ok(replacement.id.startsWith('APV-'));
      assert.equal(replacement.status, 'PENDING');
      assert.equal(replacement.supersededApprovalId, corruptApvId);

      // Stop Server 2
      await new Promise<void>((resolve, reject) => {
        server2.close((err) => (err ? reject(err) : resolve()));
      });

      // Part 3: Restart recovery on Server 3
      const store3: any = new ProjectStore();
      const app3 = express();
      app3.use(express.json());
      installProjectPersistence(app3, store3, tempDir);
      registerSignoffRoutes(app3, store3);

      const server3 = app3.listen(0, '127.0.0.1');
      await new Promise<void>((r) => server3.once('listening', r));
      const base3 = `http://127.0.0.1:${(server3.address() as any).port}`;

      const secCookie3 = await loginAndGetCookie(base3, 'secOfficer', 'SecPass123!');

      const listRes = await fetch(`${base3}/api/projects/${testProjectId}/approvals`, {
        headers: { Cookie: secCookie3 },
      });
      assert.equal(listRes.status, 200);
      const list = await listRes.json();

      const restoredOriginal = list.find((a: any) => a.id === corruptApvId);
      assert.ok(restoredOriginal, 'Original approval must exist across restart');
      assert.equal(restoredOriginal.status, 'SUPERSEDED', 'Original must be SUPERSEDED across restart');
      assert.equal(restoredOriginal.supersededBy, replacement.id, 'supersededBy link must be preserved');
      assert.equal(restoredOriginal.supersededReason, 'Legitimate recovery of corrupted persistence record');

      const restoredReplacement = list.find((a: any) => a.id === replacement.id);
      assert.ok(restoredReplacement, 'Replacement approval must exist across restart');
      assert.equal(restoredReplacement.status, 'PENDING', 'Replacement must be PENDING across restart');
      assert.equal(restoredReplacement.supersededApprovalId, corruptApvId);
      assert.equal(restoredReplacement.approvalsCollected.length, 0);

      // Verify audit logs across restart
      const audit3 = store3.auditLogs[testProjectId];
      const reissueEvent = audit3.find((e: any) => e.action === 'APPROVAL_REISSUED');
      assert.ok(reissueEvent, 'APPROVAL_REISSUED audit event must be persisted');
      assert.equal(reissueEvent.target, corruptApvId);

      for (let i = 0; i < audit3.length - 1; i++) {
        assert.equal(audit3[i].previousHash, audit3[i + 1].stateHash, 'Audit chain must be valid across restart');
      }

      await new Promise<void>((resolve, reject) => {
        server3.close((err) => (err ? reject(err) : resolve()));
      });

      pass('PERSIST-3: Failed reissue write rolls back completely, and successful reissue supersession/replacement survives server restart');
    } catch (e) {
      fail('PERSIST-3: Reissue persistence rollback and server restart recovery', e);
    }
  } catch (e) {
    fail('PERSIST-1: Server restart recovery', e);
  }
} finally {
  if (originalEnv !== undefined) {
    process.env.DMK_HUMAN_REVIEWERS = originalEnv;
  } else {
    delete process.env.DMK_HUMAN_REVIEWERS;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('\n================================================================');
console.log(`TOTAL PERSISTENCE TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
