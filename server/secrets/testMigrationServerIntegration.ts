import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  migrateEnvironmentFile,
  executeKeyRotationCeremony,
  rotationHistory,
} from './credentialMigration.ts';
import { initializeSecretStore, resetSecretStore } from './secretStoreFactory.ts';
import { defaultRedactor } from './redactionFilter.ts';
import { AuditEvent } from '../../src/types.ts';

async function testMigrationServerIntegration(): Promise<void> {
  console.log('=== Running DMK-158 Migration & Rotation Server Integration Suite ===');

  const testDir = path.join(process.cwd(), '.test_srv_mig');
  const envPath = path.join(testDir, '.env.srv');
  const storagePath = path.join(testDir, 'srv_secrets.enc');
  const saltPath = path.join(testDir, 'srv_secrets.salt');

  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    resetSecretStore();
    defaultRedactor.clearDynamicSecrets();
    rotationHistory.length = 0;

    const secretStore = await initializeSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: 'Server-Migration-Test-2026!',
      forceFallback: true,
    });

    const auditLogs: AuditEvent[] = [];
    const app = express();
    app.use(express.json());

    app.post('/api/secrets/migrate', async (req, res) => {
      try {
        const { filePath, dryRun, backup, scrubFile, targetKeys } = req.body || {};
        const target = filePath || envPath;
        const result = await migrateEnvironmentFile(target, secretStore, {
          dryRun: Boolean(dryRun),
          backup: backup !== false,
          scrubFile: scrubFile !== false,
          targetKeys,
        });

        const ev: AuditEvent = {
          id: `AUD-MIG-${Date.now()}`,
          actor: 'Security Lead',
          timestamp: new Date().toISOString(),
          action: dryRun ? 'CREDENTIAL_MIGRATION_DRY_RUN' : 'CREDENTIAL_MIGRATION_CEREMONY',
          target: path.basename(target),
          stateHash: result.proofHash.slice(0, 10),
          details: { proofHash: result.proofHash, migratedCount: result.migratedCount },
        };
        auditLogs.unshift(defaultRedactor.sanitizeAuditEvent(ev));

        res.status(200).json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/secrets/rotate', async (req, res) => {
      try {
        const { key, newValue, rotatedBy, reason } = req.body || {};
        const result = await executeKeyRotationCeremony(
          key,
          newValue,
          rotatedBy || 'Security Lead',
          reason || 'Scheduled key rotation',
          secretStore
        );

        const ev: AuditEvent = {
          id: `AUD-ROT-${Date.now()}`,
          actor: rotatedBy || 'Security Lead',
          timestamp: new Date().toISOString(),
          action: 'KEY_ROTATION_CEREMONY',
          target: key,
          stateHash: result.proofHash.slice(0, 10),
          details: { proofHash: result.proofHash },
        };
        auditLogs.unshift(defaultRedactor.sanitizeAuditEvent(ev));

        res.status(200).json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/secrets/rotations', (req, res) => {
      res.json({ count: rotationHistory.length, history: rotationHistory });
    });

    const server = app.listen(0);
    const port = (server.address() as any).port;

    // Create env file
    fs.writeFileSync(
      envPath,
      'APP_PORT=3000\nGEMINI_API_KEY=AIzaSyServerTestKey1234567890abcdefABCDEF\nSERVICE_TOKEN=xoxb-123456789012-secret\n',
      'utf8'
    );

    try {
      // Test 1: POST /api/secrets/migrate (dry run)
      console.log('[Test 1] Testing POST /api/secrets/migrate with dryRun=true...');
      const dryRes = await fetch(`http://127.0.0.1:${port}/api/secrets/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: envPath, dryRun: true }),
      });
      const dryData = await dryRes.json();
      if (dryData.totalFound !== 2 || dryData.migratedCount !== 0) {
        throw new Error(`Dry-run migration returned invalid result: ${JSON.stringify(dryData)}`);
      }
      console.log('✓ Dry-run endpoint tested successfully');

      // Test 2: POST /api/secrets/migrate (live migration)
      console.log('[Test 2] Testing POST /api/secrets/migrate live execution...');
      const liveRes = await fetch(`http://127.0.0.1:${port}/api/secrets/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: envPath, dryRun: false }),
      });
      const liveData = await liveRes.json();
      if (liveData.migratedCount !== 2 || !liveData.purgedFile) {
        throw new Error(`Live migration failed: ${JSON.stringify(liveData)}`);
      }
      console.log('✓ Live migration endpoint succeeded; file purged on disk');

      // Test 3: POST /api/secrets/rotate (rotation ceremony)
      console.log('[Test 3] Testing POST /api/secrets/rotate ceremony endpoint...');
      const rotRes = await fetch(`http://127.0.0.1:${port}/api/secrets/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'GEMINI_API_KEY',
          newValue: 'AIzaSyRotatedNewKey9876543210zyxwvutsrq',
          rotatedBy: 'Cryptographic Lead',
          reason: 'Emergency secret rotation routine',
        }),
      });
      const rotData = await rotRes.json();
      if (!rotData.proofHash || !rotData.previousFingerprint || !rotData.newFingerprint) {
        throw new Error(`Rotation ceremony endpoint returned incomplete payload: ${JSON.stringify(rotData)}`);
      }
      console.log(`✓ Rotation ceremony executed with proof: ${rotData.proofHash.slice(0, 16)}...`);

      // Test 4: GET /api/secrets/rotations
      console.log('[Test 4] Querying GET /api/secrets/rotations audit trail...');
      const listRes = await fetch(`http://127.0.0.1:${port}/api/secrets/rotations`);
      const listData = await listRes.json();
      if (listData.count < 3 || listData.history.length < 3) {
        throw new Error(`Expected at least 3 rotation records, got ${listData.count}`);
      }
      console.log(`✓ Rotation history endpoint returned ${listData.count} audit records`);

      // Test 5: Verify Audit Log has zero plaintext leak
      console.log('[Test 5] Verifying AuditEvent zero-leakage guarantee...');
      const auditPayload = JSON.stringify(auditLogs);
      if (auditPayload.includes('AIzaSyServerTestKey1234567890abcdefABCDEF')) {
        throw new Error('AuditEvent leaked old plaintext API key');
      }
      if (auditPayload.includes('AIzaSyRotatedNewKey9876543210zyxwvutsrq')) {
        throw new Error('AuditEvent leaked rotated plaintext API key');
      }
      console.log('✓ Zero plaintext leakage confirmed in server audit events');

      console.log('\n=== ALL DMK-158 SERVER INTEGRATION TESTS PASSED (5/5) ===');
    } finally {
      server.close();
    }
  } finally {
    resetSecretStore();
    defaultRedactor.clearDynamicSecrets();
    rotationHistory.length = 0;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

testMigrationServerIntegration().catch((err) => {
  console.error('Migration server integration test failed:', err);
  process.exit(1);
});
