import express from 'express';
import { defaultRedactor } from './redactionFilter.ts';
import { initializeSecretStore, resetSecretStore } from './secretStoreFactory.ts';
import { AuditEvent } from '../../src/types.ts';
import path from 'node:path';
import fs from 'node:fs';

async function testAuditRedactionIntegration(): Promise<void> {
  console.log('=== Running DMK-157.5 Audit & Server Redaction Integration Suite ===');

  const testDir = path.join(process.cwd(), '.test_redact_audit');
  const storagePath = path.join(testDir, 'audit_test.enc');
  const saltPath = path.join(testDir, 'audit_test.salt');

  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    resetSecretStore();
    defaultRedactor.clearDynamicSecrets();

    // Initialize store
    const store = await initializeSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: 'Audit-Redaction-Test-2026!',
      forceFallback: true,
    });

    const auditLogs: Record<string, AuditEvent[]> = {
      'PRJ-TEST-01': [],
    };

    function addAuditEvent(
      projectId: string,
      actor: string,
      action: string,
      target: string,
      reason?: string,
      details?: any
    ): AuditEvent {
      const rawEvent: AuditEvent = {
        id: `AUD-${Date.now().toString(36).toUpperCase()}`,
        actor,
        timestamp: new Date().toISOString(),
        action,
        target,
        reason,
        stateHash: 'statehash123',
        details,
      };
      const event = defaultRedactor.sanitizeAuditEvent(rawEvent);
      if (!auditLogs[projectId]) {
        auditLogs[projectId] = [];
      }
      auditLogs[projectId].unshift(event);
      return event;
    }

    console.log('[Test 1] Testing AuditEvent creation with raw API key in target and reason...');
    const rawKey = 'AIzaSyBN1234567890abcdefABCDEF123456789';
    const rawOpenAIKey = 'sk-proj-abc123456789012345678901234567890';
    const ev1 = addAuditEvent(
      'PRJ-TEST-01',
      'Lead Architect',
      'ROTATE_SECRET',
      `Credential ${rawKey} rotation`,
      `Replaced compromised token ${rawOpenAIKey}`,
      {
        apiKey: 'sk-secret-plain-key-1234567890',
        metadata: {
          note: `Auto-rotation for key ${rawKey}`,
        },
      }
    );

    const logJson = JSON.stringify(ev1);
    if (logJson.includes(rawKey)) {
      throw new Error(`CRITICAL LEAK: Raw Google key found in audit event JSON: ${logJson}`);
    }
    if (logJson.includes(rawOpenAIKey)) {
      throw new Error(`CRITICAL LEAK: Raw OpenAI key found in audit event JSON: ${logJson}`);
    }
    if (logJson.includes('sk-secret-plain-key-1234567890')) {
      throw new Error(`CRITICAL LEAK: Sensitive key payload was not redacted: ${logJson}`);
    }
    console.log('✓ AuditEvent safely sanitized: all raw secrets masked as [REDACTED_SECRET]');

    console.log('[Test 2] Testing dynamic secret registration on secret store setSecret...');
    const proprietaryToken = 'CustomEnterpriseDBSecretToken9988!';
    await store.setSecret('ENTERPRISE_TOKEN', proprietaryToken, 'Corporate DB token');
    defaultRedactor.registerSecret(proprietaryToken);

    const ev2 = addAuditEvent(
      'PRJ-TEST-01',
      'DB Admin',
      'CONNECT_DB',
      'Postgres Cluster',
      `Connected using credential ${proprietaryToken}`,
      {
        connectionString: `postgres://user:${proprietaryToken}@db.internal:5432/main`,
      }
    );

    const ev2Json = JSON.stringify(ev2);
    if (ev2Json.includes(proprietaryToken)) {
      throw new Error(`CRITICAL LEAK: Dynamic secret leaked in audit event: ${ev2Json}`);
    }
    if (!ev2Json.includes('[REDACTED_SECRET]')) {
      throw new Error(`Expected [REDACTED_SECRET] in dynamic secret audit log`);
    }
    console.log('✓ Dynamically registered secret safely redacted from audit event and details');

    console.log('[Test 3] Testing Express POST /api/secrets endpoint integration...');
    const app = express();
    app.use(express.json());

    app.post('/api/secrets', async (req, res) => {
      const { key, value, description } = req.body;
      await store.setSecret(key, value, description);
      defaultRedactor.registerSecret(value);

      addAuditEvent(
        'PRJ-TEST-01',
        'Security Lead',
        'SECRET_ROTATED',
        key,
        `Credential '${key}' securely updated (simulated leak attempt: ${value})`
      );

      res.status(200).json({ status: 'ok', key });
    });

    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const secretToStore = 'AIzaSySuperSecretKey99887766554433221100';
      const postRes = await fetch(`http://127.0.0.1:${port}/api/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ROTATED_KEY',
          value: secretToStore,
          description: 'Testing audit redaction',
        }),
      });
      const postData = await postRes.json();
      if (postData.status !== 'ok') {
        throw new Error(`POST failed: ${JSON.stringify(postData)}`);
      }

      // Check the latest audit event generated by this call
      const latestAudit = auditLogs['PRJ-TEST-01'][0];
      const auditStr = JSON.stringify(latestAudit);
      if (auditStr.includes(secretToStore)) {
        throw new Error(`CRITICAL LEAK: Stored secret was not redacted in audit event: ${auditStr}`);
      }
      if (!auditStr.includes('[REDACTED_SECRET]')) {
        throw new Error(`Audit event missing [REDACTED_SECRET] tag: ${auditStr}`);
      }
      console.log('✓ Live endpoint audit event successfully sanitized');
    } finally {
      server.close();
    }

    console.log('\n=== ALL DMK-157.5 AUDIT REDACTION INTEGRATION TESTS PASSED (3/3) ===');
  } finally {
    resetSecretStore();
    defaultRedactor.clearDynamicSecrets();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

testAuditRedactionIntegration().catch((err) => {
  console.error('Audit redaction integration test failed:', err);
  process.exit(1);
});
