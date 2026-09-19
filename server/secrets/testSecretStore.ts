import fs from 'node:fs';
import path from 'node:path';
import { EncryptedFileSecretStore } from './encryptedFileStore.ts';

async function runSecretStoreTests(): Promise<void> {
  console.log('=== Running DMK-157.2 EncryptedFileSecretStore Verification Suite ===');

  const savedMasterKey = process.env.DOCMONSTAKRAKIN_MASTER_KEY;
  delete process.env.DOCMONSTAKRAKIN_MASTER_KEY;

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

    // =========================================================================
    // Direct SecretStore Migration Test Suite (Scenarios A - F)
    // =========================================================================
    console.log('\n--- Beginning Migration Verification Suite (Scenarios A - F) ---');

    // [Test 10 / Scenario A] Primary-key roundtrip
    console.log('[Test 10] Migration Scenario A: Primary-key roundtrip...');
    const dirA = path.join(testDir, 'scenario_a');
    const storeA1 = new EncryptedFileSecretStore({
      dataDir: dirA,
      masterPassphrase: 'Primary-Key-Roundtrip-Secret-Passphrase-2026!',
    });
    await storeA1.setSecret('SECRET_A', 'plain_value_a', 'Primary roundtrip secret');
    const storeA2 = new EncryptedFileSecretStore({
      dataDir: dirA,
      masterPassphrase: 'Primary-Key-Roundtrip-Secret-Passphrase-2026!',
    });
    const retrievedA = await storeA2.getSecret('SECRET_A');
    if (retrievedA !== 'plain_value_a') {
      throw new Error(`Scenario A roundtrip failed: got ${retrievedA}`);
    }
    const metaA = await storeA2.listSecretMetadata();
    if (metaA.length !== 1 || metaA[0].description !== 'Primary roundtrip secret') {
      throw new Error('Scenario A metadata failed');
    }
    if (storeA2.getMigrationStatus() !== null) {
      throw new Error('Scenario A unexpected migration status recorded');
    }
    console.log('✓ [Scenario A] Primary-key roundtrip preserved secrets and metadata');

    // [Test 11 / Scenario B] Legacy machine-token migration
    console.log('[Test 11] Migration Scenario B: Legacy machine-token migration...');
    const dirB = path.join(testDir, 'scenario_b');
    const tokenPathB = path.join(dirB, '.machine_token');
    fs.mkdirSync(dirB, { recursive: true, mode: 0o700 });
    fs.writeFileSync(tokenPathB, 'legacy-machine-token-abc-1234567890', { encoding: 'utf8', mode: 0o600 });

    const storeB1 = new EncryptedFileSecretStore({
      dataDir: dirB,
      machineTokenPath: tokenPathB,
    });
    await storeB1.setSecret('LEGACY_SECRET_B', 'legacy_value_b', 'Legacy secret B');
    const envBeforeMigration = fs.readFileSync(path.join(dirB, 'secrets.enc'), 'utf8');

    // Now instantiate migration store with a new configured primary master passphrase
    const storeB2 = new EncryptedFileSecretStore({
      dataDir: dirB,
      machineTokenPath: tokenPathB,
      masterPassphrase: 'New-Configured-Master-Passphrase-B-2026!',
    });
    const retrievedB = await storeB2.getSecret('LEGACY_SECRET_B');
    if (retrievedB !== 'legacy_value_b') {
      throw new Error(`Scenario B legacy retrieval failed: got ${retrievedB}`);
    }
    const migrationStatusB = storeB2.getMigrationStatus();
    if (!migrationStatusB?.migrated || migrationStatusB.source !== 'LEGACY_MACHINE_TOKEN' || migrationStatusB.target !== 'CONFIGURED_MASTER_KEY') {
      throw new Error(`Scenario B invalid migration status: ${JSON.stringify(migrationStatusB)}`);
    }
    const envAfterMigration = fs.readFileSync(path.join(dirB, 'secrets.enc'), 'utf8');
    if (envBeforeMigration === envAfterMigration) {
      throw new Error('Scenario B envelope was not re-written after migration');
    }
    console.log('✓ [Scenario B] Legacy machine-token fallback migrated and re-keyed envelope to primary passphrase');

    // [Test 12 / Scenario C] Primary-only reopen after migration
    console.log('[Test 12] Migration Scenario C: Primary-only reopen after migration...');
    // Delete legacy token file to prove store no longer relies on it
    fs.unlinkSync(tokenPathB);
    if (fs.existsSync(tokenPathB)) {
      throw new Error('Failed to delete legacy token file in Scenario C');
    }
    const storeC = new EncryptedFileSecretStore({
      dataDir: dirB,
      machineTokenPath: tokenPathB,
      masterPassphrase: 'New-Configured-Master-Passphrase-B-2026!',
    });
    const retrievedC = await storeC.getSecret('LEGACY_SECRET_B');
    if (retrievedC !== 'legacy_value_b') {
      throw new Error(`Scenario C primary-only retrieval failed: got ${retrievedC}`);
    }
    console.log('✓ [Scenario C] Re-keyed envelope opened with primary key only after legacy token removed');

    // [Test 13 / Scenario D] Missing legacy token does not create one during recovery
    console.log('[Test 13] Migration Scenario D: Missing legacy token does not create token file during recovery...');
    const dirD = path.join(testDir, 'scenario_d');
    const tokenPathD = path.join(dirD, '.machine_token');
    const storeD1 = new EncryptedFileSecretStore({
      dataDir: dirD,
      masterPassphrase: 'Original-Passphrase-D-2026!',
    });
    await storeD1.setSecret('SECRET_D', 'val_d');
    const storagePathD = path.join(dirD, 'secrets.enc');
    const envBeforeD = fs.readFileSync(storagePathD, 'utf8');

    // Ensure no legacy token file exists
    if (fs.existsSync(tokenPathD)) {
      fs.unlinkSync(tokenPathD);
    }

    const storeD2 = new EncryptedFileSecretStore({
      dataDir: dirD,
      machineTokenPath: tokenPathD,
      masterPassphrase: 'Wrong-Primary-Key-D',
    });

    let recoveryFailedD = false;
    try {
      await storeD2.getSecret('SECRET_D');
    } catch {
      recoveryFailedD = true;
    }

    if (!recoveryFailedD) {
      throw new Error('Scenario D expected failure with wrong key, but succeeded');
    }
    if (fs.existsSync(tokenPathD)) {
      throw new Error('CRITICAL FLAW: Missing legacy token file was created during failed recovery attempt in Scenario D');
    }
    const envAfterD = fs.readFileSync(storagePathD, 'utf8');
    if (envBeforeD !== envAfterD) {
      throw new Error('Scenario D original envelope was modified during failed recovery attempt');
    }
    console.log('✓ [Scenario D] Missing legacy token does not create token file during failed recovery and envelope remains unmodified');

    // [Test 14 / Scenario E] Wrong primary and wrong legacy fail closed
    console.log('[Test 14] Migration Scenario E: Wrong primary and wrong legacy fail closed...');
    const dirE = path.join(testDir, 'scenario_e');
    const tokenPathE = path.join(dirE, '.machine_token');
    fs.mkdirSync(dirE, { recursive: true, mode: 0o700 });
    fs.writeFileSync(tokenPathE, 'valid-legacy-token-e', { encoding: 'utf8', mode: 0o600 });

    const storeE1 = new EncryptedFileSecretStore({
      dataDir: dirE,
      machineTokenPath: tokenPathE,
    });
    const sensitiveValE = 'TopSecretValE-DoNotLeakInErrors!';
    await storeE1.setSecret('SECRET_E', sensitiveValE);
    const storagePathE = path.join(dirE, 'secrets.enc');
    const envBeforeE = fs.readFileSync(storagePathE, 'utf8');

    // Overwrite token with wrong token
    fs.writeFileSync(tokenPathE, 'wrong-legacy-token-e', { encoding: 'utf8', mode: 0o600 });

    const storeE2 = new EncryptedFileSecretStore({
      dataDir: dirE,
      machineTokenPath: tokenPathE,
      masterPassphrase: 'wrong-primary-passphrase-e',
    });

    let errorThrownE: Error | null = null;
    try {
      await storeE2.getSecret('SECRET_E');
    } catch (err: any) {
      errorThrownE = err;
    }

    if (!errorThrownE) {
      throw new Error('Scenario E expected failure with wrong primary and wrong legacy, but succeeded');
    }
    if (errorThrownE.message.includes(sensitiveValE) || errorThrownE.message.includes('valid-legacy-token-e')) {
      throw new Error('Scenario E error message leaked secret value or token');
    }
    const envAfterE = fs.readFileSync(storagePathE, 'utf8');
    if (envBeforeE !== envAfterE) {
      throw new Error('Scenario E envelope was modified on failed authentication');
    }
    console.log('✓ [Scenario E] Wrong primary and wrong legacy fail closed without leaking secrets');

    // [Test 15 / Scenario F] Multiple secrets and metadata survive migration
    console.log('[Test 15] Migration Scenario F: Multiple secrets and metadata survive migration...');
    const dirF = path.join(testDir, 'scenario_f');
    const tokenPathF = path.join(dirF, '.machine_token');
    fs.mkdirSync(dirF, { recursive: true, mode: 0o700 });
    fs.writeFileSync(tokenPathF, 'multi-legacy-token-f-12345678', { encoding: 'utf8', mode: 0o600 });

    const storeF1 = new EncryptedFileSecretStore({
      dataDir: dirF,
      machineTokenPath: tokenPathF,
    });

    const multiSecrets: Record<string, { value: string; desc: string }> = {
      API_KEY_1: { value: 'key-1-alpha-beta-999', desc: 'First API key' },
      DATABASE_URL: { value: 'postgres://app:pwd@cluster.local/db', desc: 'Database connection URI' },
      JWT_SIGNING_SECRET: { value: 'jwt-signing-secret-key-32-chars-long!', desc: 'JWT signing secret' },
    };

    for (const [k, item] of Object.entries(multiSecrets)) {
      await storeF1.setSecret(k, item.value, item.desc);
    }

    // Now migrate with configured primary master key
    const primaryKeyF = 'New-Primary-Multi-Key-2026-Secure!';
    const storeF2 = new EncryptedFileSecretStore({
      dataDir: dirF,
      machineTokenPath: tokenPathF,
      masterPassphrase: primaryKeyF,
    });

    const metaF2 = await storeF2.listSecretMetadata();
    if (metaF2.length !== 3) {
      throw new Error(`Scenario F expected 3 metadata entries, found ${metaF2.length}`);
    }
    for (const [k, item] of Object.entries(multiSecrets)) {
      const val = await storeF2.getSecret(k);
      if (val !== item.value) {
        throw new Error(`Scenario F value mismatch for ${k}: expected ${item.value}, got ${val}`);
      }
      const m = metaF2.find((entry) => entry.key === k);
      if (!m || m.description !== item.desc) {
        throw new Error(`Scenario F metadata mismatch for ${k}`);
      }
    }
    if (!storeF2.getMigrationStatus()?.migrated) {
      throw new Error('Scenario F migration status not marked as migrated');
    }

    // Delete legacy token and reopen with primary key only
    fs.unlinkSync(tokenPathF);
    const storeF3 = new EncryptedFileSecretStore({
      dataDir: dirF,
      machineTokenPath: tokenPathF,
      masterPassphrase: primaryKeyF,
    });
    for (const [k, item] of Object.entries(multiSecrets)) {
      const val = await storeF3.getSecret(k);
      if (val !== item.value) {
        throw new Error(`Scenario F post-migration reopen mismatch for ${k}`);
      }
    }
    console.log('✓ [Scenario F] Multiple secrets and complete metadata survived migration and primary-only reload');

    console.log('\n=== ALL DMK-157.2 & MIGRATION VERIFICATION TESTS PASSED (15/15) ===');
  } finally {
    if (savedMasterKey !== undefined) {
      process.env.DOCMONSTAKRAKIN_MASTER_KEY = savedMasterKey;
    }
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
