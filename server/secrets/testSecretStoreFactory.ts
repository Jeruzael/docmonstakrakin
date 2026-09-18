import fs from 'node:fs';
import path from 'node:path';
import {
  getSecretStore,
  initializeSecretStore,
  resolveSecret,
  resetSecretStore,
} from './secretStoreFactory.ts';

async function runFactoryTests(): Promise<void> {
  console.log('=== Running DMK-157.4 SecretStore Factory Verification Suite ===');

  const testDir = path.join(process.cwd(), '.test_factory_secrets');
  const storagePath = path.join(testDir, 'factory.enc');
  const saltPath = path.join(testDir, 'factory.salt');

  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    resetSecretStore();

    console.log('[Test 1] Instantiating SecretStore via getSecretStore()...');
    const store1 = getSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: 'Factory-Test-Passphrase-2026!',
      forceFallback: true,
    });
    if (!store1) throw new Error('getSecretStore returned null/undefined');
    console.log(`✓ Instantiated store with provider type: ${store1.getProviderType()}`);

    console.log('[Test 2] Verifying singleton consistency...');
    const store2 = getSecretStore();
    if (store1 !== store2) {
      throw new Error('getSecretStore() did not return the singleton instance');
    }
    console.log('✓ Singleton instance verified');

    console.log('[Test 3] Testing initializeSecretStore with simulated ambient GEMINI_API_KEY...');
    const testAmbientKey = 'AIzaSy_Simulated_Gemini_Key_998877';
    process.env.GEMINI_API_KEY = testAmbientKey;

    resetSecretStore();
    const initializedStore = await initializeSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: 'Factory-Test-Passphrase-2026!',
      forceFallback: true,
    });

    const hasGeminiKey = await initializedStore.hasSecret('GEMINI_API_KEY');
    if (!hasGeminiKey) {
      throw new Error('initializeSecretStore failed to bootstrap GEMINI_API_KEY from environment');
    }
    const retrievedGeminiKey = await initializedStore.getSecret('GEMINI_API_KEY');
    if (retrievedGeminiKey !== testAmbientKey) {
      throw new Error(`Bootstrap mismatch: expected ${testAmbientKey}, got ${retrievedGeminiKey}`);
    }
    console.log('✓ Ambient credential automatically bootstrapped into encrypted store');

    console.log('[Test 4] Testing resolveSecret helper...');
    const resolved = await resolveSecret('GEMINI_API_KEY');
    if (resolved !== testAmbientKey) {
      throw new Error(`resolveSecret failed: expected ${testAmbientKey}, got ${resolved}`);
    }
    console.log('✓ resolveSecret resolved successfully');

    console.log('[Test 5] Storing custom credential via factory-managed store...');
    await initializedStore.setSecret(
      'CUSTOM_API_TOKEN',
      'secret_token_abcdef123456',
      'Integration secret for testing'
    );
    const customResolved = await resolveSecret('CUSTOM_API_TOKEN');
    if (customResolved !== 'secret_token_abcdef123456') {
      throw new Error(`Custom token mismatch: got ${customResolved}`);
    }
    console.log('✓ Custom credential stored and retrieved');

    console.log('[Test 6] Verifying metadata endpoint safety (zero secret leakage)...');
    const metadataList = await initializedStore.listSecretMetadata();
    if (metadataList.length < 2) {
      throw new Error(`Expected at least 2 metadata records, got ${metadataList.length}`);
    }
    for (const meta of metadataList) {
      if ((meta as any).value !== undefined) {
        throw new Error(`CRITICAL SECURITY FAILURE: Metadata object leaks 'value' property for ${meta.key}`);
      }
      if (!meta.isConfigured) {
        throw new Error(`Metadata isConfigured is false for ${meta.key}`);
      }
    }
    console.log(`✓ Metadata safely retrieved for ${metadataList.length} keys with zero credential leakage`);

    console.log('\n=== ALL DMK-157.4 FACTORY TESTS PASSED (6/6) ===');
  } finally {
    resetSecretStore();
    delete process.env.GEMINI_API_KEY;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

runFactoryTests().catch((err) => {
  console.error('Factory tests failed:', err);
  process.exit(1);
});
