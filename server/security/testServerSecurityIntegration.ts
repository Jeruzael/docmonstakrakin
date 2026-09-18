import express from 'express';
import assert from 'node:assert';
import http from 'node:http';
import {
  sanitizeAndResolvePath,
} from './pathBoundary.js';
import {
  sanitizeBranchName,
  sanitizeCommitAuthor,
  sanitizeCommitMessage,
  executeSandboxedGit,
} from './commandSandbox.js';
import {
  computeAuditEventHash,
  createChainedAuditEvent,
  verifyAuditLedgerChain,
  GENESIS_AUDIT_HASH,
} from './auditImmutability.js';
import type { AuditEvent } from '../../src/types.js';

console.log('=== Running DMK-159 Server Security Route & Defense Integration Suite ===');

interface TestAuditEvent extends AuditEvent {}

async function testServerSecurityIntegration(): Promise<void> {
  const app = express();
  app.use(express.json());

  const auditStore: Record<string, TestAuditEvent[]> = {
    'PRJ-ATLAS-01': [],
  };

  function addAuditEvent(actor: string, action: string, target: string, reason?: string, details?: any) {
    const previousEvent = auditStore['PRJ-ATLAS-01'][0];
    const previousHash = previousEvent ? previousEvent.stateHash : GENESIS_AUDIT_HASH;
    const timestamp = new Date().toISOString();
    const id = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const stateHash = computeAuditEventHash({
      actor,
      timestamp,
      action,
      target,
      reason,
      details,
      previousHash,
    });

    const event: TestAuditEvent = {
      id,
      actor,
      timestamp,
      action,
      target,
      reason,
      stateHash,
      previousHash,
      details,
    };
    auditStore['PRJ-ATLAS-01'].unshift(event);
    return event;
  }

  // Seed with 2 verified events
  addAuditEvent('Lead Architect', 'PROJECT_INIT', 'PRJ-ATLAS-01', 'Initial setup');
  addAuditEvent('Security Officer', 'CONTROL_RATIFIED', 'SEC-CTRL-011', 'Verified path boundaries');

  // Mount hardened endpoints identical to server.ts
  app.get('/api/repo/diff', (req, res) => {
    try {
      const file = req.query.file as string;
      if (file) {
        const safeFile = sanitizeAndResolvePath(file);
        if (!safeFile.safe) {
          return res.status(403).json({ error: safeFile.error, matchedDenyRule: safeFile.matchedDenyRule });
        }
      }
      res.json({ status: 'ok', diff: '' });
    } catch (err: any) {
      res.status(err.code?.startsWith('ERR_SECURITY') ? 403 : 500).json({ error: err.message });
    }
  });

  app.post('/api/repo/stage', (req, res) => {
    try {
      const { path: filePath, all } = req.body;
      if (filePath) {
        const safeFile = sanitizeAndResolvePath(filePath);
        if (!safeFile.safe) {
          return res.status(403).json({ error: safeFile.error, matchedDenyRule: safeFile.matchedDenyRule });
        }
      }
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(err.code?.startsWith('ERR_SECURITY') ? 403 : 500).json({ error: err.message });
    }
  });

  app.post('/api/repo/branch', (req, res) => {
    try {
      const { branchName, name } = req.body;
      const target = branchName || name;
      if (!target) return res.status(400).json({ error: 'Branch name required' });
      const safeBranch = sanitizeBranchName(target);
      res.json({ status: 'ok', branch: safeBranch });
    } catch (err: any) {
      res.status(err.code?.startsWith('ERR_SECURITY') ? 400 : 500).json({ error: err.message });
    }
  });

  app.post('/api/repo/commit', (req, res) => {
    try {
      const { message, author } = req.body;
      if (!message) return res.status(400).json({ error: 'Commit message required' });
      const safeMessage = sanitizeCommitMessage(message);
      const commitAuthor = sanitizeCommitAuthor(author || 'Lead Engineer');

      addAuditEvent(commitAuthor, 'COMMIT_RECORDED', 'HEAD', safeMessage);
      res.json({ status: 'ok', author: commitAuthor, message: safeMessage });
    } catch (err: any) {
      res.status(err.code?.startsWith('ERR_SECURITY') ? 400 : 500).json({ error: err.message });
    }
  });

  app.get('/api/projects/:id/audit/verify', (req, res) => {
    const logs = auditStore[req.params.id] || [];
    const result = verifyAuditLedgerChain(logs, 'REVERSE_CHRONOLOGICAL');
    res.json(result);
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Test 1: Path Traversal Attack on /api/repo/stage
    console.log('[Test 1] Attacking /api/repo/stage with traversal path (../../etc/passwd)...');
    const stageRes = await fetch(`${baseUrl}/api/repo/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '../../etc/passwd' }),
    });
    assert.strictEqual(stageRes.status, 403);
    const stageData = await stageRes.json();
    assert.strictEqual(stageData.matchedDenyRule, 'WORKSPACE_BOUNDARY_ESCAPED');
    console.log('✓ Path traversal attack correctly rejected with HTTP 403');

    // Test 2: Denied Directory Access on /api/repo/stage
    console.log('[Test 2] Attacking /api/repo/stage with denied secrets path (secrets/vault.enc)...');
    const secretStageRes = await fetch(`${baseUrl}/api/repo/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'secrets/vault.enc' }),
    });
    assert.strictEqual(secretStageRes.status, 403);
    console.log('✓ Secrets directory attack correctly rejected with HTTP 403');

    // Test 3: Null byte injection on /api/repo/diff
    console.log('[Test 3] Attacking /api/repo/diff with null-byte injection (src/App.tsx%00.txt)...');
    const diffRes = await fetch(`${baseUrl}/api/repo/diff?file=src/App.tsx%00.txt`);
    assert.strictEqual(diffRes.status, 403);
    const diffData = await diffRes.json();
    assert.strictEqual(diffData.matchedDenyRule, 'NULL_BYTE_INJECTION');
    console.log('✓ Null-byte injection attack correctly rejected with HTTP 403');

    // Test 4: Command Injection on /api/repo/branch
    console.log('[Test 4] Attacking /api/repo/branch with semicolon shell chaining (main; rm -rf /)...');
    const branchRes = await fetch(`${baseUrl}/api/repo/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchName: 'main; rm -rf /' }),
    });
    assert.strictEqual(branchRes.status, 400);
    const branchData = await branchRes.json();
    assert.ok(branchData.error?.includes('Command injection attempt detected'));
    console.log('✓ Semicolon command injection correctly rejected with HTTP 400');

    // Test 5: Flag Injection on /api/repo/branch
    console.log('[Test 5] Attacking /api/repo/branch with flag injection (--upload-pack=evil)...');
    const flagRes = await fetch(`${baseUrl}/api/repo/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchName: '--upload-pack=evil' }),
    });
    assert.strictEqual(flagRes.status, 400);
    console.log('✓ Flag injection correctly rejected with HTTP 400');

    // Test 6: Commit author newline injection on /api/repo/commit
    console.log('[Test 6] Attacking /api/repo/commit with author newline injection...');
    const commitRes = await fetch(`${baseUrl}/api/repo/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Valid commit', author: 'Lead\nAttacker' }),
    });
    assert.strictEqual(commitRes.status, 400);
    console.log('✓ Commit author injection correctly rejected with HTTP 400');

    // Test 7: Audit Ledger Cryptographic Verification via /api/projects/:id/audit/verify
    console.log('[Test 7] Querying /api/projects/PRJ-ATLAS-01/audit/verify...');
    const verifyRes = await fetch(`${baseUrl}/api/projects/PRJ-ATLAS-01/audit/verify`);
    assert.strictEqual(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.valid, true);
    assert.strictEqual(verifyData.verifiedCount, 2);
    console.log(`✓ Audit chain cryptographically verified: ${verifyData.verifiedCount} events intact`);

    console.log('\n=== ALL DMK-159 SERVER INTEGRATION TESTS PASSED (7/7) ===');
  } finally {
    server.close();
  }
}

testServerSecurityIntegration().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
