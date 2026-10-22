/**
 * Server Integration Tests for DMK-165 / SEC-CTRL-020
 * Verifies GET /api/projects/:id/release/gates and POST /api/projects/:id/release/signoff
 * through an isolated evaluator-response harness. Production reviewer authentication
 * is covered separately; actor text here never establishes human authorization.
 */

import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import {
  evaluateReleaseGates,
  executeReleaseSignoff,
  ProjectDataAccessor,
} from './releaseGateEvaluator.ts';
import {
  createChainedAuditEvent,
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

console.log('=== DMK-165: Running Release Gate Server Integration Tests ===\n');

function createTestServer() {
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

  const app = express();
  app.use(express.json());

  app.get('/api/projects/:id/release/gates', (req, res) => {
    try {
      const report = evaluateReleaseGates(store, req.params.id);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/projects/:id/release/signoff', (req, res) => {
    try {
      const { actor, notes } = req.body || {};
      if (!actor) {
        return res.status(400).json({ error: 'Actor required for release sign-off audit trail' });
      }

      const result = executeReleaseSignoff(store, req.params.id, actor, notes);
      if (!result.success) {
        return res.status(412).json({
          error: result.error,
          report: result.report,
        });
      }

      res.status(200).json({
        message: 'v0.1 Definition-of-Done sign-off recorded successfully',
        report: result.report,
        auditEvent: result.auditEvent,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return { app, store };
}

function request(
  server: http.Server,
  options: { method: string; path: string; headers?: Record<string, string> },
  body?: any
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        method: options.method,
        path: options.path,
        headers: options.headers || {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {}
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  const { app, store } = createTestServer();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const initialState = JSON.stringify(store);
    // Test 1: GET /api/projects/:id/release/gates returns 7 gates and 25 capabilities
    console.log('[Test 1] Querying /api/projects/PRJ-ATLAS-01/release/gates...');
    const res1 = await request(server, {
      method: 'GET',
      path: '/api/projects/PRJ-ATLAS-01/release/gates',
    });
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.gates.length, 7);
    assert.strictEqual(res1.body.capabilities.length, 25);
    assert.strictEqual(res1.body.releaseReady, false);
    assert.strictEqual(res1.body.allGatesPassed, false);
    assert.strictEqual(res1.body.gates.find((gate: any) => gate.gateId === 3).status, 'PENDING');
    assert.strictEqual(res1.body.signedOff, false);
    assert.strictEqual(JSON.stringify(store), initialState, 'Gate evaluation must not mutate the stored-status fixture');
    console.log('✓ GET returned 7 gates and 25 capabilities without promoting stored statuses to production readiness.');

    // Test 2: POST /api/projects/:id/release/signoff without actor is rejected (400)
    console.log('[Test 2] Attempting sign-off without actor...');
    const res2 = await request(
      server,
      {
        method: 'POST',
        path: '/api/projects/PRJ-ATLAS-01/release/signoff',
        headers: { 'Content-Type': 'application/json' },
      },
      {}
    );
    assert.strictEqual(res2.statusCode, 400);
    assert.ok(res2.body.error.includes('Actor required'));
    assert.strictEqual(JSON.stringify(store), initialState, 'Missing-actor refusal must preserve project and audit state');
    console.log('✓ Missing-actor request correctly rejected with HTTP 400 and no state changes.');

    // Test 3: POST /api/projects/:id/release/signoff with failed gates is rejected (412)
    console.log('[Test 3] Attempting sign-off when a blocker question exists...');
    store.questions['PRJ-ATLAS-01'].push({
      id: 'BLOCK-FAIL-Q',
      category: 'AUTH',
      questionText: 'Unresolved blocker',
      state: 'UNRESOLVED',
      isBlocking: true,
      profiles: ['API_BACKEND'],
      dependencies: [],
    } as any);
    const blockedState = JSON.stringify(store);

    const res3 = await request(
      server,
      {
        method: 'POST',
        path: '/api/projects/PRJ-ATLAS-01/release/signoff',
        headers: { 'Content-Type': 'application/json' },
      },
      { actor: 'Lead Architect', notes: 'Should fail' }
    );
    assert.strictEqual(res3.statusCode, 412);
    assert.ok(res3.body.error.includes('GATE-01-BLOCKERS'));
    assert.strictEqual(res3.body.report.gates.find((gate: any) => gate.gateId === 1).status, 'FAILED');
    assert.strictEqual(JSON.stringify(store), blockedState, 'Failed prerequisite gates must not mutate lifecycle or audit state');
    console.log('✓ Premature sign-off correctly rejected with HTTP 412 Precondition Failed.');

    // Removing this blocker does not provide the missing authenticated production evidence.
    store.questions['PRJ-ATLAS-01'].pop();
    assert.strictEqual(JSON.stringify(store), initialState);

    // Test 4: Stored statuses and an actor string cannot execute a release ceremony.
    console.log('[Test 4] Attempting sign-off with a stored-status fixture...');
    const res4 = await request(
      server,
      {
        method: 'POST',
        path: '/api/projects/PRJ-ATLAS-01/release/signoff',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        actor: 'Synthetic fixture actor',
        notes: 'Inert refusal test; no real release decision.',
      }
    );
    assert.strictEqual(res4.statusCode, 412);
    assert.ok(res4.body.error.includes('GATE-03-SECRETS'));
    assert.strictEqual(res4.body.report.releaseReady, false);
    assert.strictEqual(res4.body.report.allGatesPassed, false);
    assert.strictEqual(res4.body.report.signedOff, false);
    assert.strictEqual(res4.body.report.signoffDetails, undefined);
    assert.strictEqual(res4.body.auditEvent, undefined);
    assert.strictEqual(JSON.stringify(store), initialState, 'Status-only signoff refusal must preserve every project, work-item, approval and audit byte');
    console.log('✓ Status-only sign-off returned HTTP 412 without recording approval or changing state.');

    // Test 5: GET after refusal still reports the original unsigned state.
    console.log('[Test 5] Querying release gates after refused sign-off...');
    const res5 = await request(server, {
      method: 'GET',
      path: '/api/projects/PRJ-ATLAS-01/release/gates',
    });
    assert.strictEqual(res5.statusCode, 200);
    assert.strictEqual(res5.body.releaseReady, false);
    assert.strictEqual(res5.body.allGatesPassed, false);
    assert.strictEqual(res5.body.signedOff, false);
    assert.strictEqual(res5.body.gates.find((gate: any) => gate.gateId === 3).status, 'PENDING');
    assert.strictEqual(res5.body.gates[6].status, 'HUMAN_APPROVAL_REQUIRED');
    assert.strictEqual(res5.body.signoffDetails, undefined);
    assert.deepStrictEqual(res5.body.gates.map((gate: any) => [gate.gateId, gate.status]), res1.body.gates.map((gate: any) => [gate.gateId, gate.status]));
    assert.strictEqual(JSON.stringify(store), initialState, 'A refused ceremony and subsequent reads must leave the complete fixture unchanged');
    console.log('✓ Subsequent GET remains unsigned, requires human approval, and preserves all stored state.');

    console.log('\n=== ALL 5/5 RELEASE SERVER INTEGRATION TESTS PASSED ===');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
