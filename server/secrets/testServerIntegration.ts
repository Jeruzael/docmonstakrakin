import express from 'express';
import { getSecretStore, initializeSecretStore, resolveSecret, resetSecretStore } from './secretStoreFactory.ts';
import path from 'node:path';
import fs from 'node:fs';

async function testServerIntegration(): Promise<void> {
  console.log('=== Running DMK-157.4 Server Integration & Route Verification ===');

  const testDir = path.join(process.cwd(), '.test_server_integration');
  const storagePath = path.join(testDir, 'server_test.enc');
  const saltPath = path.join(testDir, 'server_test.salt');

  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    resetSecretStore();

    // Preserve and temporarily isolate ambient environment for the test run
    const originalEnvKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    // Initialize store
    const store = await initializeSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: 'Server-Integration-Test-2026!',
      forceFallback: true,
    });

    const app = express();
    app.use(express.json());

    // Mount secret endpoints mirroring server.ts
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'docmonstakrakin-control-plane',
        secretStoreProvider: store.getProviderType(),
      });
    });

    app.get('/api/secrets/metadata', async (req, res) => {
      try {
        const metadata = await store.listSecretMetadata();
        res.json({
          provider: store.getProviderType(),
          count: metadata.length,
          secrets: metadata,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/secrets', async (req, res) => {
      try {
        const { key, value, description } = req.body;
        if (!key || !value) return res.status(400).json({ error: 'Missing key or value' });
        await store.setSecret(key, value, description);
        res.status(200).json({ status: 'ok', key, provider: store.getProviderType() });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/ai/status', async (req, res) => {
      try {
        const isConfigured = await store.hasSecret('GEMINI_API_KEY');
        res.json({
          isConfigured,
          provider: store.getProviderType(),
          model: 'gemini-2.5-flash',
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete('/api/secrets/:key', async (req, res) => {
      try {
        const deleted = await store.deleteSecret(req.params.key);
        res.json({ status: deleted ? 'ok' : 'not_found', key: req.params.key });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Start ephemeral server on random port
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      console.log(`[Test 1] Querying /api/health...`);
      const healthRes = await fetch(`${baseUrl}/api/health`);
      const healthData = await healthRes.json();
      if (healthData.status !== 'ok' || !healthData.secretStoreProvider) {
        throw new Error(`Invalid health response: ${JSON.stringify(healthData)}`);
      }
      console.log(`✓ Health checked: provider=${healthData.secretStoreProvider}`);

      console.log(`[Test 2] Querying /api/ai/status before credential provision...`);
      const aiStatusRes1 = await fetch(`${baseUrl}/api/ai/status`);
      const aiStatusData1 = await aiStatusRes1.json();
      if (aiStatusData1.isConfigured !== false) {
        throw new Error(`Expected isConfigured=false initially, got: ${JSON.stringify(aiStatusData1)}`);
      }
      console.log(`✓ Initial AI status verified: isConfigured=false`);

      console.log(`[Test 3] Storing GEMINI_API_KEY via POST /api/secrets...`);
      const postRes = await fetch(`${baseUrl}/api/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'GEMINI_API_KEY',
          value: 'AIzaSy_Integration_Test_Key_1234567890',
          description: 'Production integration test key',
        }),
      });
      const postData = await postRes.json();
      if (postData.status !== 'ok') {
        throw new Error(`POST /api/secrets failed: ${JSON.stringify(postData)}`);
      }
      console.log(`✓ Secret stored via REST endpoint`);

      console.log(`[Test 4] Querying /api/ai/status after credential provision...`);
      const aiStatusRes2 = await fetch(`${baseUrl}/api/ai/status`);
      const aiStatusData2 = await aiStatusRes2.json();
      if (aiStatusData2.isConfigured !== true) {
        throw new Error(`Expected isConfigured=true, got: ${JSON.stringify(aiStatusData2)}`);
      }
      console.log(`✓ AI status verified after provision: isConfigured=true`);

      console.log(`[Test 5] Querying /api/secrets/metadata and checking zero value leakage...`);
      const metaRes = await fetch(`${baseUrl}/api/secrets/metadata`);
      const metaData = await metaRes.json();
      if (metaData.count !== 1 || !metaData.secrets[0].isConfigured) {
        throw new Error(`Invalid metadata response: ${JSON.stringify(metaData)}`);
      }
      if (JSON.stringify(metaData).includes('AIzaSy_Integration_Test_Key_1234567890')) {
        throw new Error(`CRITICAL SECURITY LEAK: Metadata payload exposes secret value!`);
      }
      console.log(`✓ Metadata returned safely: 1 secret configured, zero value leakage`);

      console.log(`[Test 6] Testing DELETE /api/secrets/GEMINI_API_KEY...`);
      const delRes = await fetch(`${baseUrl}/api/secrets/GEMINI_API_KEY`, { method: 'DELETE' });
      const delData = await delRes.json();
      if (delData.status !== 'ok') {
        throw new Error(`Delete failed: ${JSON.stringify(delData)}`);
      }
      const aiStatusRes3 = await fetch(`${baseUrl}/api/ai/status`);
      const aiStatusData3 = await aiStatusRes3.json();
      if (aiStatusData3.isConfigured !== false) {
        throw new Error(`Expected isConfigured=false after delete, got: ${JSON.stringify(aiStatusData3)}`);
      }
      console.log(`✓ Deletion verified via REST API`);

      console.log('\n=== ALL DMK-157.4 SERVER INTEGRATION TESTS PASSED (6/6) ===');
    } finally {
      server.close();
      if (originalEnvKey) {
        process.env.GEMINI_API_KEY = originalEnvKey;
      }
    }
  } finally {
    resetSecretStore();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

testServerIntegration().catch((err) => {
  console.error('Server integration test failed:', err);
  process.exit(1);
});
