import fs from 'node:fs';
import path from 'node:path';
import {
  migrateEnvironmentFile,
  executeKeyRotationCeremony,
  verifyZeroPlaintextResidual,
  computeFingerprint,
  isSensitiveKey,
  rotationHistory,
} from './credentialMigration.ts';
import { initializeSecretStore, resetSecretStore } from './secretStoreFactory.ts';
import { defaultRedactor } from './redactionFilter.ts';

async function testCredentialMigrationSuite(): Promise<void> {
  console.log('=== Running DMK-158 Credential Migration & Key Rotation Verification Suite ===');

  const testDir = path.join(process.cwd(), '.test_migration');
  const envFilePath = path.join(testDir, '.env.test');
  const storagePath = path.join(testDir, 'migration_store.enc');
  const saltPath = path.join(testDir, 'migration_store.salt');

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
      masterPassphrase: 'Migration-Master-Key-2026!',
      forceFallback: true,
    });

    // Test 1: Sensitive Key Detection
    console.log('[Test 1] Testing sensitive key identification heuristics...');
    if (!isSensitiveKey('GEMINI_API_KEY')) throw new Error('Failed to match GEMINI_API_KEY');
    if (!isSensitiveKey('APP_SESSION_SECRET')) throw new Error('Failed to match APP_SESSION_SECRET');
    if (!isSensitiveKey('DATABASE_PASSWORD')) throw new Error('Failed to match DATABASE_PASSWORD');
    if (isSensitiveKey('PORT')) throw new Error('PORT should not be identified as sensitive');
    if (isSensitiveKey('APP_NAME')) throw new Error('APP_NAME should not be identified as sensitive');
    console.log('✓ Sensitive key heuristics verified');

    // Create a mock .env file with sensitive and non-sensitive keys
    const rawEnvContent = [
      '# Application Configuration',
      'APP_NAME=DocMonstaKrakin',
      'PORT=3000',
      'NODE_ENV=production',
      '',
      '# Secrets & API Tokens',
      'GEMINI_API_KEY=AIzaSyB1234567890abcdefABCDEF123456789',
      'SESSION_SECRET=super_secret_session_token_xyz987',
      'DATABASE_PASSWORD="P@ssw0rd123!Secure"',
      '',
      '# Public flags',
      'DEBUG_MODE=false',
    ].join('\n');

    fs.writeFileSync(envFilePath, rawEnvContent, 'utf8');

    // Test 2: Dry Run Mode
    console.log('[Test 2] Testing migration in DRY_RUN mode...');
    const dryRunResult = await migrateEnvironmentFile(envFilePath, secretStore, {
      dryRun: true,
    });
    if (dryRunResult.totalFound !== 3) {
      throw new Error(`Expected 3 sensitive keys, found: ${dryRunResult.totalFound}`);
    }
    if (dryRunResult.migratedCount !== 0) {
      throw new Error(`Dry run should not migrate keys to store: ${dryRunResult.migratedCount}`);
    }
    if (fs.readFileSync(envFilePath, 'utf8') !== rawEnvContent) {
      throw new Error('Dry run modified source file on disk');
    }
    console.log('✓ Dry-run completed safely without disk or store mutations');

    // Test 3: Live Migration & File Scrubbing
    console.log('[Test 3] Executing live migration ceremony...');
    const liveResult = await migrateEnvironmentFile(envFilePath, secretStore, {
      dryRun: false,
      backup: true,
      scrubFile: true,
    });

    if (liveResult.migratedCount !== 3) {
      throw new Error(`Expected 3 keys migrated, got ${liveResult.migratedCount}`);
    }
    if (!liveResult.purgedFile) {
      throw new Error('Expected purgedFile to be true');
    }
    if (!fs.existsSync(`${envFilePath}.bak`)) {
      throw new Error('Backup file was not created');
    }

    // Verify SecretStore holds the migrated secrets
    const geminiVal = await secretStore.getSecret('GEMINI_API_KEY');
    if (geminiVal !== 'AIzaSyB1234567890abcdefABCDEF123456789') {
      throw new Error(`Migrated Gemini API key mismatch: ${geminiVal}`);
    }
    const sessionVal = await secretStore.getSecret('SESSION_SECRET');
    if (sessionVal !== 'super_secret_session_token_xyz987') {
      throw new Error(`Migrated Session secret mismatch: ${sessionVal}`);
    }
    const dbVal = await secretStore.getSecret('DATABASE_PASSWORD');
    if (dbVal !== 'P@ssw0rd123!Secure') {
      throw new Error(`Migrated DB password mismatch: ${dbVal}`);
    }
    console.log('✓ All 3 secrets verified loaded inside SecretStore');

    // Test 4: Verify Zero Plaintext Residual in Scrubbed File
    console.log('[Test 4] Verifying zero plaintext residuals in scrubbed .env file...');
    const scrubbedContent = fs.readFileSync(envFilePath, 'utf8');
    if (scrubbedContent.includes('AIzaSyB1234567890abcdefABCDEF123456789')) {
      throw new Error('Plaintext GEMINI_API_KEY leaked in scrubbed .env file');
    }
    if (scrubbedContent.includes('super_secret_session_token_xyz987')) {
      throw new Error('Plaintext SESSION_SECRET leaked in scrubbed .env file');
    }
    if (scrubbedContent.includes('P@ssw0rd123!Secure')) {
      throw new Error('Plaintext DATABASE_PASSWORD leaked in scrubbed .env file');
    }
    if (!scrubbedContent.includes('PORT=3000') || !scrubbedContent.includes('NODE_ENV=production')) {
      throw new Error('Non-sensitive config was inadvertently removed or corrupted');
    }

    const isScrubbedClean = verifyZeroPlaintextResidual(envFilePath, [
      'GEMINI_API_KEY',
      'SESSION_SECRET',
      'DATABASE_PASSWORD',
    ]);
    if (!isScrubbedClean) {
      throw new Error('verifyZeroPlaintextResidual reported residual plaintext tokens');
    }
    console.log('✓ File sanitization confirmed: zero plaintext secrets remaining on disk');

    // Test 5: Key Rotation Ceremony
    console.log('[Test 5] Executing structured Key Rotation Ceremony...');
    const oldSessionFp = computeFingerprint('super_secret_session_token_xyz987');
    const newSessionToken = 'new_rotated_session_token_abc999_super_safe';

    const rotationResult = await executeKeyRotationCeremony(
      'SESSION_SECRET',
      newSessionToken,
      'SecOps Chief',
      'Scheduled 90-day cryptographic key rotation',
      secretStore
    );

    if (rotationResult.previousFingerprint !== oldSessionFp) {
      throw new Error(
        `Previous fingerprint mismatch: expected ${oldSessionFp}, got ${rotationResult.previousFingerprint}`
      );
    }
    if (!rotationResult.newFingerprint.startsWith('sha256:')) {
      throw new Error(`Invalid new fingerprint format: ${rotationResult.newFingerprint}`);
    }
    if (!rotationResult.proofHash || rotationResult.proofHash.length !== 64) {
      throw new Error(`Invalid SHA-256 proof hash: ${rotationResult.proofHash}`);
    }

    // Verify updated store value
    const updatedVal = await secretStore.getSecret('SESSION_SECRET');
    if (updatedVal !== newSessionToken) {
      throw new Error('Store was not updated with newly rotated secret');
    }

    // Verify dynamic redaction updated
    const testLog = `Attempting connection with ${newSessionToken}`;
    const redactedLog = defaultRedactor.redactString(testLog);
    if (redactedLog.includes(newSessionToken)) {
      throw new Error(`Rotated secret was not registered for redaction: ${redactedLog}`);
    }
    if (!redactedLog.includes('[REDACTED_SECRET]')) {
      throw new Error(`Expected [REDACTED_SECRET] in rotated secret test: ${redactedLog}`);
    }
    console.log('✓ Key rotation ceremony completed with proof hash, store update, and dynamic redaction');

    // Test 6: Rotation History Trail
    console.log('[Test 6] Inspecting rotation history trail...');
    if (rotationHistory.length < 4) {
      throw new Error(`Expected at least 4 rotation records (3 migration + 1 rotation), found ${rotationHistory.length}`);
    }
    const latestEvent = rotationHistory[0];
    if (latestEvent.key !== 'SESSION_SECRET' || latestEvent.rotatedBy !== 'SecOps Chief') {
      throw new Error(`Latest rotation history entry invalid: ${JSON.stringify(latestEvent)}`);
    }
    console.log(`✓ Rotation audit trail verified (${rotationHistory.length} events registered)`);

    console.log('\n=== ALL DMK-158 CREDENTIAL MIGRATION & ROTATION TESTS PASSED (6/6) ===');
  } finally {
    resetSecretStore();
    defaultRedactor.clearDynamicSecrets();
    rotationHistory.length = 0;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

testCredentialMigrationSuite().catch((err) => {
  console.error('Credential migration test failed:', err);
  process.exit(1);
});
