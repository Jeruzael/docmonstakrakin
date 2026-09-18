import fs from 'node:fs';
import path from 'node:path';
import { OSKeychainSecretStore } from './osKeychainStore.ts';
import { EncryptedFileSecretStore } from './encryptedFileStore.ts';

async function runOSKeychainTests(): Promise<void> {
  console.log('=== Running DMK-157.3 OSKeychainSecretStore Verification Suite ===');

  const testDir = path.join(process.cwd(), '.test_os_keychain');
  const storagePath = path.join(testDir, 'os_test_secrets.enc');
  const saltPath = path.join(testDir, 'os_test_secrets.salt');
  const testPassphrase = 'OS-Keychain-Fallback-Passphrase-2026!';

  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    const fallbackStore = new EncryptedFileSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: testPassphrase,
    });

    const store = new OSKeychainSecretStore({
      serviceName: 'docmonstakrakin_test',
      fallbackStore,
    });

    console.log('[Test 1] Detecting current OS platform...');
    const platform = store.getPlatform();
    console.log(`✓ OS platform detected: ${platform}`);
    if (!['darwin', 'win32', 'linux', 'unsupported'].includes(platform)) {
      throw new Error(`Invalid platform returned: ${platform}`);
    }

    console.log('[Test 2] Evaluating native keyring availability...');
    const isAvailable = store.isNativeAvailable();
    console.log(`✓ Native keyring availability: ${isAvailable} (Headless container environment safely detected)`);

    console.log('[Test 3] Verifying active provider resolution...');
    const provider = store.getProviderType();
    console.log(`✓ Active provider: ${provider}`);
    if (isAvailable) {
      if (provider !== 'OS_KEYCHAIN') throw new Error(`Expected OS_KEYCHAIN, got ${provider}`);
    } else {
      if (provider !== 'ENCRYPTED_FILE') throw new Error(`Expected fallback to ENCRYPTED_FILE, got ${provider}`);
    }

    console.log('[Test 4] Storing credential via OS Keychain adapter...');
    const testKey = 'DOCMONSTAKRAKIN_TEST_TOKEN';
    const testSecret = 'tok_secure_test_secret_998877665544332211';
    await store.setSecret(testKey, testSecret, 'Test credentials for DMK-157.3');

    console.log('[Test 5] Verifying hasSecret...');
    const exists = await store.hasSecret(testKey);
    if (!exists) throw new Error('hasSecret failed on stored credential');
    const fakeExists = await store.hasSecret('FAKE_KEY_XYZ');
    if (fakeExists) throw new Error('hasSecret returned true on non-existent key');
    console.log('✓ hasSecret operational');

    console.log('[Test 6] Retrieving secret and checking equality...');
    const retrieved = await store.getSecret(testKey);
    if (retrieved !== testSecret) {
      throw new Error(`Mismatch: expected ${testSecret}, got ${retrieved}`);
    }
    console.log('✓ Secret retrieved successfully and matches source payload');

    console.log('[Test 7] Verifying metadata extraction...');
    const metadata = await store.listSecretMetadata();
    if (metadata.length !== 1) {
      throw new Error(`Expected 1 metadata record, got ${metadata.length}`);
    }
    if (metadata[0].key !== testKey || !metadata[0].isConfigured) {
      throw new Error(`Invalid metadata record: ${JSON.stringify(metadata[0])}`);
    }
    console.log('✓ Metadata successfully retrieved without value exposure');

    console.log('[Test 8] Verifying force-fallback mode...');
    const forcedFallbackStore = new OSKeychainSecretStore({
      serviceName: 'docmonstakrakin_forced',
      forceFallback: true,
      fallbackStore,
    });
    if (forcedFallbackStore.isNativeAvailable()) {
      throw new Error('forceFallback=true must return isNativeAvailable()=false');
    }
    if (forcedFallbackStore.getProviderType() !== 'ENCRYPTED_FILE') {
      throw new Error('Forced fallback did not resolve to ENCRYPTED_FILE');
    }
    // Native keychains and the encrypted file fallback are separate stores.
    // On Windows/macOS the earlier write may have used the native keychain;
    // forceFallback must not silently copy that credential to disk.
    const beforeFallbackWrite = await forcedFallbackStore.getSecret(testKey);
    if (isAvailable && beforeFallbackWrite !== null) throw new Error('Native credential unexpectedly mirrored to fallback');
    await forcedFallbackStore.setSecret(testKey, testSecret, 'Explicit fallback test credential');
    const forcedVal = await forcedFallbackStore.getSecret(testKey);
    if (forcedVal !== testSecret) {
      throw new Error(`Forced fallback failed to read secret: got ${forcedVal}`);
    }
    console.log('✓ Force-fallback mode verified');

    console.log('[Test 9] Verifying secret deletion...');
    const deleted = await store.deleteSecret(testKey);
    if (!deleted) throw new Error('deleteSecret failed');
    const afterDelete = await store.getSecret(testKey);
    if (afterDelete !== null) throw new Error(`Secret not deleted: got ${afterDelete}`);
    await forcedFallbackStore.deleteSecret(testKey);
    console.log('✓ Deletion verified');

    console.log('\n=== ALL DMK-157.3 OS KEYCHAIN ADAPTER TESTS PASSED (9/9) ===');
  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

runOSKeychainTests().catch((err) => {
  console.error('OS Keychain Test Suite Failed:', err);
  process.exit(1);
});
