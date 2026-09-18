import fs from 'node:fs';
import path from 'node:path';
import { EncryptedFileSecretStore } from './encryptedFileStore.ts';

async function runSecretStoreTests(): Promise<void> {
  console.log('=== Running DMK-157.2 EncryptedFileSecretStore Verification Suite ===');

  const testDir = path.join(process.cwd(), '.test_secret_store');
  const storagePath = path.join(testDir, 'test_secrets.enc');
  const saltPath = path.join(testDir, 'test_secrets.salt');
  const testPassphrase = 'TestPassphrase-A-SSDLC-Hardened-2026!';

  try {
    // Clean prior runs
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    const store = new EncryptedFileSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: testPassphrase,
    });

    console.log('[Test 1] Verifying provider type...');
    if (store.getProviderType() !== 'ENCRYPTED_FILE') {
      throw new Error(`Expected provider type ENCRYPTED_FILE, got ${store.getProviderType()}`);
    }
    console.log('✓ Provider type is ENCRYPTED_FILE');

    console.log('[Test 2] Setting secret...');
    const secretKey = 'GEMINI_API_KEY';
    const secretValue = 'AIzaSyDocMonstaKrakinSecureKey9876543210';
    await store.setSecret(secretKey, secretValue, 'Primary AI inference key');

    console.log('[Test 3] Verifying hasSecret...');
    const hasKey = await store.hasSecret(secretKey);
    if (!hasKey) {
      throw new Error('hasSecret failed for existing key');
    }
    const hasFake = await store.hasSecret('NON_EXISTENT_KEY');
    if (hasFake) {
      throw new Error('hasSecret returned true for non-existent key');
    }
    console.log('✓ hasSecret checks passed');

    console.log('[Test 4] Verifying getSecret roundtrip...');
    const retrieved = await store.getSecret(secretKey);
    if (retrieved !== secretValue) {
      throw new Error(`Roundtrip mismatch: expected ${secretValue}, got ${retrieved}`);
    }
    console.log('✓ Secret plaintext retrieved and matches perfectly');

    console.log('[Test 5] Verifying metadata and lack of plaintext leakage...');
    const metadataList = await store.listSecretMetadata();
    if (metadataList.length !== 1) {
      throw new Error(`Expected 1 metadata entry, found ${metadataList.length}`);
    }
    const meta = metadataList[0];
    if (meta.key !== secretKey || !meta.isConfigured || meta.provider !== 'ENCRYPTED_FILE') {
      throw new Error(`Invalid metadata fields: ${JSON.stringify(meta)}`);
    }
    if (!meta.fingerprint?.startsWith('sha256:')) {
      throw new Error(`Invalid fingerprint format: ${meta.fingerprint}`);
    }
    console.log(`✓ Metadata valid (fingerprint: ${meta.fingerprint})`);

    console.log('[Test 6] Inspecting encrypted file envelope on disk...');
    if (!fs.existsSync(storagePath)) {
      throw new Error(`Encrypted file was not created at ${storagePath}`);
    }
    const rawDisk = fs.readFileSync(storagePath, 'utf8');
    if (rawDisk.includes(secretValue)) {
      throw new Error('CRITICAL SECURITY LEAK: Plaintext secret found in raw disk storage!');
    }
    const envelope = JSON.parse(rawDisk);
    if (envelope.encryption.algorithm !== 'AES-256-GCM' || !envelope.encryption.authTagHex) {
      throw new Error(`Envelope missing AES-256-GCM authentication data`);
    }
    console.log('✓ Storage envelope confirmed encrypted with AES-256-GCM (0 plaintext leakage on disk)');

    console.log('[Test 7] Verifying cross-instance loading from disk...');
    const store2 = new EncryptedFileSecretStore({
      storagePath,
      saltPath,
      masterPassphrase: testPassphrase,
    });
    const retrieved2 = await store2.getSecret(secretKey);
    if (retrieved2 !== secretValue) {
      throw new Error(`Cross-instance load failed: got ${retrieved2}`);
    }
    console.log('✓ Independent store instance successfully decrypted and loaded data from disk');

    console.log('[Test 8] Verifying AES-256-GCM tamper-resistance...');
    // Corrupt ciphertext in a clone to verify auth tag rejection
    const corruptedDisk = JSON.parse(rawDisk);
    const originalCiphertext = corruptedDisk.ciphertextHex;
    // Flip one hex character
    const flippedChar = originalCiphertext[0] === 'a' ? 'b' : 'a';
    corruptedDisk.ciphertextHex = flippedChar + originalCiphertext.slice(1);
    const corruptedPath = path.join(testDir, 'corrupted.enc');
    fs.writeFileSync(corruptedPath, JSON.stringify(corruptedDisk), 'utf8');

    const corruptStore = new EncryptedFileSecretStore({
      storagePath: corruptedPath,
      saltPath,
      masterPassphrase: testPassphrase,
    });
    let tamperDetected = false;
    try {
      await corruptStore.getSecret(secretKey);
    } catch (err: any) {
      tamperDetected = true;
      console.log(`✓ Tamper successfully detected and rejected by GCM auth tag: ${err.message}`);
    }
    if (!tamperDetected) {
      throw new Error('FAILED: Corrupted ciphertext did not fail authentication!');
    }

    console.log('[Test 9] Verifying secret deletion...');
    const deleted = await store.deleteSecret(secretKey);
    if (!deleted) {
      throw new Error('deleteSecret returned false');
    }
    const afterDelete = await store.getSecret(secretKey);
    if (afterDelete !== null) {
      throw new Error(`Expected null after deletion, got ${afterDelete}`);
    }
    const hasDeleted = await store.hasSecret(secretKey);
    if (hasDeleted) {
      throw new Error('hasSecret returned true after deletion');
    }
    console.log('✓ Deletion verified');

    console.log('\n=== ALL DMK-157.2 VERIFICATION TESTS PASSED (9/9) ===');
  } finally {
    // Clean test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

runSecretStoreTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
