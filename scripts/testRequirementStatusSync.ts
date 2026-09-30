import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import type { Requirement, RequirementStatus } from '../src/types.js';

console.log('================================================================');
console.log('   REQUIREMENT CANONICAL STATE SYNCHRONIZATION REGRESSION TEST');
console.log('   Evaluating Invariant: UI never displays unaccepted state');
console.log('   Coverage: Items A through G specified in BATCH 1B contract');
console.log('================================================================\n');

const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-reqsync-'));
const port = 31989;
const base = `http://127.0.0.1:${port}`;
let child: ReturnType<typeof spawn>;
let output = '';

async function startServer() {
  child = spawn(
    process.execPath,
    ['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server.ts')],
    {
      cwd: dir,
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        GEMINI_API_KEY: '',
      },
      stdio: 'pipe',
    }
  );

  child.stdout?.on('data', (b) => (output += b));
  child.stderr?.on('data', (b) => (output += b));
  child.once('error', (e) => (output += `Child startup error: ${e.message}`));

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server did not start within deadline: ${output}`);
}

async function stopServer() {
  if (child && child.exitCode === null) {
    const done = new Promise((r) => child.once('exit', r));
    child.kill();
    await done;
  }
}

let passedCount = 0;
function pass(testName: string) {
  passedCount++;
  console.log(`✓ [PASS] ${testName}`);
}

try {
  await startServer();

  const projectId = 'PRJ-ATLAS-01';

  // Setup: create a test requirement in PROPOSED status
  const createRes = await fetch(`${base}/api/projects/${projectId}/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Audit Trail Signature Verification',
      statement: 'System must cryptographically verify signatures on audit chain entries.',
      category: 'SECURITY',
      priority: 'HIGH',
      status: 'PROPOSED',
    }),
  });
  assert.equal(createRes.status, 201, 'Requirement creation should succeed');
  const createdReq: Requirement = await createRes.json();
  assert.equal(createdReq.status, 'PROPOSED');

  // Transition to UNDER_REVIEW
  const reviewRes = await fetch(`${base}/api/projects/${projectId}/requirements/${createdReq.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'UNDER_REVIEW', justification: 'Ready for peer review' }),
  });
  assert.equal(reviewRes.status, 200, 'Transition to UNDER_REVIEW should succeed');
  const underReviewReq: Requirement = (await reviewRes.json()).requirement;
  assert.equal(underReviewReq.status, 'UNDER_REVIEW');

  // =========================================================================
  // Test A — Direct APPROVED through ordinary status endpoint returns 403
  // =========================================================================
  const directApproveRes = await fetch(`${base}/api/projects/${projectId}/requirements/${createdReq.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'APPROVED' }),
  });
  assert.equal(directApproveRes.status, 403, 'Direct APPROVED status transition must return 403');
  const directApproveData = await directApproveRes.json();
  assert.match(
    directApproveData.error || '',
    /Request Sign-Off and human quorum/i,
    'Error message must indicate governance sign-off and human quorum requirement'
  );
  pass('Test A: Direct APPROVED through ordinary status endpoint returns 403');

  // =========================================================================
  // Test B — Canonical requirement remains UNDER_REVIEW after rejected direct approval
  // =========================================================================
  const listRes = await fetch(`${base}/api/projects/${projectId}/requirements`);
  assert.equal(listRes.status, 200);
  const serverReqs: Requirement[] = await listRes.json();
  const canonicalReq = serverReqs.find((r) => r.id === createdReq.id);
  assert(canonicalReq, 'Requirement must exist on server');
  assert.equal(
    canonicalReq.status,
    'UNDER_REVIEW',
    'Server canonical requirement status must remain UNDER_REVIEW after rejected direct approval'
  );
  pass('Test B: Canonical requirement remains UNDER_REVIEW after rejected direct approval');

  // =========================================================================
  // Test C — Failed requirement update rejects/propagates an error rather than resolving as success
  // =========================================================================
  const handleUpdateRequirementStatus = async (
    reqId: string,
    status: RequirementStatus,
    justification?: string
  ) => {
    const res = await fetch(`${base}/api/projects/${projectId}/requirements/${reqId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, justification }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.error?.message ||
        data.error ||
        'Requirement status update failed'
      );
    }

    const refreshRes = await fetch(`${base}/api/projects/${projectId}/requirements`);
    return { dataRequirement: data.requirement, refreshedReqs: await refreshRes.json() };
  };

  await assert.rejects(
    async () => {
      await handleUpdateRequirementStatus(createdReq.id, 'APPROVED');
    },
    (err: Error) => {
      assert.match(err.message, /Request Sign-Off and human quorum/i);
      return true;
    },
    'Failed status update must reject and propagate the server error'
  );
  pass('Test C: Failed requirement update rejects/propagates an error rather than resolving as success');

  // =========================================================================
  // Test D — Requirement drawer logic does not write APPROVED after failure
  // =========================================================================
  let clientRequirements: Requirement[] = [...serverReqs];
  let activeDrawerReqId: string | null = createdReq.id;
  let statusError = '';

  const handleStatusChange = async (reqId: string, newStatus: RequirementStatus) => {
    try {
      statusError = '';
      const result = await handleUpdateRequirementStatus(reqId, newStatus);
      clientRequirements = result.refreshedReqs;
    } catch (error) {
      statusError = error instanceof Error ? error.message : 'Requirement status update failed';
    }
  };

  const getActiveDrawerReq = () => clientRequirements.find((r) => r.id === activeDrawerReqId) || null;

  assert.equal(getActiveDrawerReq()?.status, 'UNDER_REVIEW');
  await handleStatusChange(createdReq.id, 'APPROVED');

  assert.equal(
    getActiveDrawerReq()?.status,
    'UNDER_REVIEW',
    'Drawer must not write APPROVED after failure'
  );
  assert.match(statusError, /Request Sign-Off and human quorum/i, 'statusError must be set with server error message');
  pass('Test D: Requirement drawer logic does not write APPROVED after failure');

  // =========================================================================
  // Test E — Valid PROPOSED -> UNDER_REVIEW transition persists
  // =========================================================================
  const createReq2Res = await fetch(`${base}/api/projects/${projectId}/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'TLS 1.3 Strict Cipher Negotiation',
      statement: 'Only TLS 1.3 cipher suites shall be allowed for ingress connections.',
      category: 'SECURITY',
      priority: 'MEDIUM',
      status: 'PROPOSED',
    }),
  });
  assert.equal(createReq2Res.status, 201);
  const req2: Requirement = await createReq2Res.json();
  assert.equal(req2.status, 'PROPOSED');

  // Execute valid transition to UNDER_REVIEW
  const validTransitionRes = await fetch(`${base}/api/projects/${projectId}/requirements/${req2.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'UNDER_REVIEW', justification: 'Advancing to review' }),
  });
  assert.equal(validTransitionRes.status, 200, 'Valid transition must succeed with 200');

  const verifyServerRes = await fetch(`${base}/api/projects/${projectId}/requirements`);
  const verifyServerList: Requirement[] = await verifyServerRes.json();
  const canonicalReq2 = verifyServerList.find((r) => r.id === req2.id);
  assert.equal(canonicalReq2?.status, 'UNDER_REVIEW', 'Canonical requirement must be UNDER_REVIEW');
  pass('Test E: Valid PROPOSED -> UNDER_REVIEW transition persists');

  // =========================================================================
  // Test F — Refreshed requirement props update the open drawer state
  // =========================================================================
  activeDrawerReqId = req2.id;
  clientRequirements = verifyServerList;
  assert.equal(getActiveDrawerReq()?.status, 'UNDER_REVIEW', 'Drawer derives status directly from updated requirements prop');

  // Transition to DEFERRED on server
  const deferRes = await fetch(`${base}/api/projects/${projectId}/requirements/${req2.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DEFERRED', justification: 'Pushed to next milestone' }),
  });
  assert.equal(deferRes.status, 200);

  // Parent receives refreshed project requirements
  const refreshDefer = await fetch(`${base}/api/projects/${projectId}/requirements`);
  clientRequirements = await refreshDefer.json();

  // Drawer automatically reflects updated status without needing internal copy mutation
  assert.equal(
    getActiveDrawerReq()?.status,
    'DEFERRED',
    'Drawer must automatically reflect refreshed status from parent requirements prop'
  );
  pass('Test F: Refreshed requirement props update the open drawer state');

  // =========================================================================
  // Test G — Closing/reopening the drawer shows the same canonical status returned by the server
  // =========================================================================
  // Close drawer
  activeDrawerReqId = null;
  assert.equal(getActiveDrawerReq(), null, 'Drawer is closed');

  // Reopen drawer
  activeDrawerReqId = req2.id;
  assert.equal(
    getActiveDrawerReq()?.status,
    'DEFERRED',
    'Reopening drawer must show canonical DEFERRED status returned by the server'
  );

  // Test with first requirement (UNDER_REVIEW)
  activeDrawerReqId = createdReq.id;
  assert.equal(
    getActiveDrawerReq()?.status,
    'UNDER_REVIEW',
    'Reopening first requirement drawer must show canonical UNDER_REVIEW status'
  );
  pass('Test G: Closing/reopening the drawer shows the same canonical status returned by the server');

  // =========================================================================
  // StateVersion & Audit Integrity Helpers
  // =========================================================================
  const getProjectStateVersion = async (pId: string): Promise<number> => {
    const res = await fetch(`${base}/api/projects/${pId}`);
    assert.equal(res.status, 200, 'Project lookup should succeed');
    const data = await res.json();
    return data.stateVersion;
  };

  const getProjectAuditLogs = async (pId: string): Promise<any[]> => {
    const res = await fetch(`${base}/api/projects/${pId}/audit`);
    assert.equal(res.status, 200, 'Audit lookup should succeed');
    return await res.json();
  };

  // =========================================================================
  // Test H — Valid PROPOSED -> UNDER_REVIEW transition increments stateVersion exactly once
  // =========================================================================
  const createReq3Res = await fetch(`${base}/api/projects/${projectId}/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Mutual TLS Authentication',
      statement: 'Service-to-service communication must enforce mTLS.',
      category: 'SECURITY',
      priority: 'HIGH',
      status: 'PROPOSED',
    }),
  });
  assert.equal(createReq3Res.status, 201);
  const req3: Requirement = await createReq3Res.json();
  assert.equal(req3.status, 'PROPOSED');

  const vBeforeH = await getProjectStateVersion(projectId);
  const auditsBeforeH = await getProjectAuditLogs(projectId);
  const aBeforeH = auditsBeforeH.length;

  const transitionHRes = await fetch(`${base}/api/projects/${projectId}/requirements/${req3.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'UNDER_REVIEW', justification: 'Advancing to review' }),
  });
  assert.equal(transitionHRes.status, 200, 'Status transition to UNDER_REVIEW must return 200');
  const transitionHData = await transitionHRes.json();
  assert.equal(transitionHData.requirement.status, 'UNDER_REVIEW');

  const vAfterH = await getProjectStateVersion(projectId);
  const auditsAfterH = await getProjectAuditLogs(projectId);
  const aAfterH = auditsAfterH.length;

  assert.equal(vAfterH, vBeforeH + 1, `stateVersion must increment by 1 (expected ${vBeforeH + 1}, got ${vAfterH})`);
  assert.equal(aAfterH, aBeforeH + 1, `audit count must increment by 1 (expected ${aBeforeH + 1}, got ${aAfterH})`);

  const newAuditH = auditsAfterH[0];
  assert.equal(newAuditH.action, 'REQUIREMENT_STATUS_CHANGED');
  assert.equal(newAuditH.target, req3.id);
  assert.equal(newAuditH.details?.previousStatus, 'PROPOSED');
  assert.equal(newAuditH.details?.newStatus, 'UNDER_REVIEW');
  pass('Test H: Valid PROPOSED -> UNDER_REVIEW transition increments stateVersion exactly once');

  // =========================================================================
  // Test I — Second valid transition (UNDER_REVIEW -> DEFERRED) increments stateVersion again
  // =========================================================================
  const vBeforeI = await getProjectStateVersion(projectId);
  const auditsBeforeI = await getProjectAuditLogs(projectId);
  const aBeforeI = auditsBeforeI.length;

  const transitionIRes = await fetch(`${base}/api/projects/${projectId}/requirements/${req3.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DEFERRED', justification: 'Deprioritizing for v1' }),
  });
  assert.equal(transitionIRes.status, 200, 'Status transition to DEFERRED must return 200');
  const transitionIData = await transitionIRes.json();
  assert.equal(transitionIData.requirement.status, 'DEFERRED');

  const vAfterI = await getProjectStateVersion(projectId);
  const auditsAfterI = await getProjectAuditLogs(projectId);
  const aAfterI = auditsAfterI.length;

  assert.equal(vAfterI, vBeforeI + 1, `stateVersion must increment by 1 on second mutation (expected ${vBeforeI + 1}, got ${vAfterI})`);
  assert.equal(aAfterI, aBeforeI + 1, `audit count must increment by 1 on second mutation (expected ${aBeforeI + 1}, got ${aAfterI})`);

  const newAuditI = auditsAfterI[0];
  assert.equal(newAuditI.action, 'REQUIREMENT_STATUS_CHANGED');
  assert.equal(newAuditI.target, req3.id);
  assert.equal(newAuditI.details?.previousStatus, 'UNDER_REVIEW');
  assert.equal(newAuditI.details?.newStatus, 'DEFERRED');
  pass('Test I: Second valid transition (UNDER_REVIEW -> DEFERRED) increments stateVersion again');

  // =========================================================================
  // Test J — Rejected direct APPROVED status preserves stateVersion, auditCount, and status
  // =========================================================================
  const vBeforeJ = await getProjectStateVersion(projectId);
  const auditsBeforeJ = await getProjectAuditLogs(projectId);
  const aBeforeJ = auditsBeforeJ.length;

  const rejectedApproveRes = await fetch(`${base}/api/projects/${projectId}/requirements/${req3.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'APPROVED' }),
  });
  assert.equal(rejectedApproveRes.status, 403, 'Direct APPROVED status must return 403');

  const vAfterJ = await getProjectStateVersion(projectId);
  const auditsAfterJ = await getProjectAuditLogs(projectId);
  const aAfterJ = auditsAfterJ.length;

  assert.equal(vAfterJ, vBeforeJ, `stateVersion must remain unchanged after rejected status (expected ${vBeforeJ}, got ${vAfterJ})`);
  assert.equal(aAfterJ, aBeforeJ, `audit count must remain unchanged after rejected status (expected ${aBeforeJ}, got ${aAfterJ})`);

  const req3CheckRes = await fetch(`${base}/api/projects/${projectId}/requirements`);
  const req3CheckList: Requirement[] = await req3CheckRes.json();
  const req3Canonical = req3CheckList.find((r) => r.id === req3.id);
  assert.equal(req3Canonical?.status, 'DEFERRED', 'Requirement status must remain DEFERRED');
  pass('Test J: Rejected direct APPROVED status preserves stateVersion, auditCount, and status');

  // =========================================================================
  // Test K — Nonexistent requirement status update returns 404 and preserves stateVersion and auditCount
  // =========================================================================
  const vBeforeK = await getProjectStateVersion(projectId);
  const auditsBeforeK = await getProjectAuditLogs(projectId);
  const aBeforeK = auditsBeforeK.length;

  const notFoundRes = await fetch(`${base}/api/projects/${projectId}/requirements/NONEXISTENT-REQ-9999/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'UNDER_REVIEW', justification: 'Should fail' }),
  });
  assert.equal(notFoundRes.status, 404, 'Status update on nonexistent requirement must return 404');

  const vAfterK = await getProjectStateVersion(projectId);
  const auditsAfterK = await getProjectAuditLogs(projectId);
  const aAfterK = auditsAfterK.length;

  assert.equal(vAfterK, vBeforeK, `stateVersion must remain unchanged after 404 (expected ${vBeforeK}, got ${vAfterK})`);
  assert.equal(aAfterK, aBeforeK, `audit count must remain unchanged after 404 (expected ${aBeforeK}, got ${aAfterK})`);
  pass('Test K: Nonexistent requirement status update returns 404 and preserves stateVersion and auditCount');

  // =========================================================================
  // Test L — Server restart persists incremented stateVersion, status, and audit entry
  // =========================================================================
  const vBeforeL = await getProjectStateVersion(projectId);
  const auditsBeforeL = await getProjectAuditLogs(projectId);
  const aBeforeL = auditsBeforeL.length;

  // Perform another valid status transition to VERIFIED
  const verifiedRes = await fetch(`${base}/api/projects/${projectId}/requirements/${req3.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'VERIFIED', justification: 'Automated test suite passed' }),
  });
  assert.equal(verifiedRes.status, 200);

  const vAfterLPreRestart = await getProjectStateVersion(projectId);
  assert.equal(vAfterLPreRestart, vBeforeL + 1, 'stateVersion must increment before restart');

  // Restart server within disposable test directory
  await stopServer();
  await startServer();

  const vAfterRestart = await getProjectStateVersion(projectId);
  const auditsAfterRestart = await getProjectAuditLogs(projectId);

  assert.equal(vAfterRestart, vBeforeL + 1, `Persisted stateVersion must survive restart (expected ${vBeforeL + 1}, got ${vAfterRestart})`);
  assert.equal(auditsAfterRestart.length, aBeforeL + 1, `Persisted audit count must survive restart (expected ${aBeforeL + 1}, got ${auditsAfterRestart.length})`);

  const req3RestartCheckRes = await fetch(`${base}/api/projects/${projectId}/requirements`);
  const req3RestartCheckList: Requirement[] = await req3RestartCheckRes.json();
  const req3RestartCanonical = req3RestartCheckList.find((r) => r.id === req3.id);
  assert.equal(req3RestartCanonical?.status, 'VERIFIED', 'Persisted status must remain VERIFIED after restart');
  pass('Test L: Server restart persists incremented stateVersion, status, and audit entry');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: 12 | PASSED: ${passedCount} | FAILED: 0`);
  console.log('================================================================');
} finally {
  await stopServer();
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}
