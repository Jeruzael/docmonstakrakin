import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SecretStore, SecretRotationEvent, AuditEvent } from '../../src/types.ts';
import { defaultRedactor } from './redactionFilter.ts';

export interface MigrationOptions {
  dryRun?: boolean;
  backup?: boolean;
  scrubFile?: boolean;
  targetKeys?: string[];
}

export interface MigratedKeySummary {
  key: string;
  fingerprint: string;
  status: 'MIGRATED' | 'SKIPPED_EMPTY' | 'DRY_RUN';
}

export interface MigrationResult {
  sourcePath: string;
  totalFound: number;
  migratedCount: number;
  skippedCount: number;
  purgedFile: boolean;
  keys: MigratedKeySummary[];
  proofHash: string;
  timestamp: string;
  events: SecretRotationEvent[];
}

export interface RotationCeremonyResult {
  key: string;
  previousFingerprint: string | null;
  newFingerprint: string;
  timestamp: string;
  rotatedBy: string;
  provider: string;
  proofHash: string;
  rotationEvent: SecretRotationEvent;
}

// In-memory registry of executed rotation events
export const rotationHistory: SecretRotationEvent[] = [];

/**
 * Computes a standard SHA-256 fingerprint for a credential value.
 */
export function computeFingerprint(value: string): string {
  const hash = crypto.createHash('sha256').update(value, 'utf8').digest('hex');
  return `sha256:${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

/**
 * Detects whether an environment variable key name indicates a sensitive secret.
 */
export function isSensitiveKey(keyName: string): boolean {
  const sensitiveRegex = /(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY|AUTH_KEY)/i;
  return sensitiveRegex.test(keyName);
}

/**
 * Parses raw .env file contents into key-value pairs while preserving lines for scrubbing.
 */
export function parseEnvLines(content: string): Array<{ line: string; key?: string; value?: string }> {
  const lines = content.split(/\r?\n/);
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return { line };
    }
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      let val = match[2].trim();
      // Strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return { line, key: match[1], value: val };
    }
    return { line };
  });
}

/**
 * Migrates secrets from a specified environment file into SecretStore.
 * Automatically purges plaintext secrets from the file and writes safe placeholders.
 */
export async function migrateEnvironmentFile(
  filePath: string,
  secretStore: SecretStore,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const dryRun = options.dryRun ?? false;
  const backup = options.backup ?? true;
  const scrubFile = options.scrubFile ?? true;

  if (!fs.existsSync(filePath)) {
    throw new Error(`Environment file not found at path: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const parsedLines = parseEnvLines(fileContent);

  const migratedSummaries: MigratedKeySummary[] = [];
  const events: SecretRotationEvent[] = [];
  const modifiedLines: string[] = [];

  for (const item of parsedLines) {
    if (item.key && item.value !== undefined) {
      const isTarget =
        options.targetKeys && options.targetKeys.length > 0
          ? options.targetKeys.includes(item.key)
          : isSensitiveKey(item.key);

      if (isTarget) {
        if (!item.value || item.value.startsWith('# MIGRATED_TO_SECRETSTORE')) {
          migratedSummaries.push({
            key: item.key,
            fingerprint: 'none',
            status: 'SKIPPED_EMPTY',
          });
          modifiedLines.push(item.line);
          continue;
        }

        const fingerprint = computeFingerprint(item.value);

        if (!dryRun) {
          // Persist in SecretStore
          await secretStore.setSecret(
            item.key,
            item.value,
            `Auto-migrated from ${path.basename(filePath)} (DMK-158)`
          );

          // Register with dynamic redactor
          defaultRedactor.registerSecret(item.value);

          // Record rotation event
          const rotEvent: SecretRotationEvent = {
            key: item.key,
            newFingerprint: fingerprint,
            timestamp: new Date().toISOString(),
            rotatedBy: 'Automated Migration Ceremony (DMK-158)',
            provider: secretStore.getProviderType(),
          };
          events.push(rotEvent);
          rotationHistory.unshift(rotEvent);
        }

        migratedSummaries.push({
          key: item.key,
          fingerprint,
          status: dryRun ? 'DRY_RUN' : 'MIGRATED',
        });

        // Scrub plaintext value in output line
        if (scrubFile) {
          modifiedLines.push(`${item.key}=# MIGRATED_TO_SECRETSTORE (DMK-158)`);
        } else {
          modifiedLines.push(item.line);
        }
        continue;
      }
    }
    modifiedLines.push(item.line);
  }

  const migratedCount = migratedSummaries.filter((s) => s.status === 'MIGRATED').length;
  let purgedFile = false;

  if (!dryRun && scrubFile && migratedCount > 0) {
    if (backup) {
      fs.writeFileSync(`${filePath}.bak`, fileContent, 'utf8');
    }
    fs.writeFileSync(filePath, modifiedLines.join('\n'), 'utf8');
    purgedFile = true;
  }

  // Generate cryptographic proof hash over all migrated keys and fingerprints
  const proofHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        source: path.basename(filePath),
        keys: migratedSummaries.map((s) => ({ key: s.key, fp: s.fingerprint })),
        timestamp: new Date().toISOString(),
      }),
      'utf8'
    )
    .digest('hex');

  return {
    sourcePath: filePath,
    totalFound: migratedSummaries.length,
    migratedCount: dryRun ? 0 : migratedCount,
    skippedCount: migratedSummaries.filter((s) => s.status === 'SKIPPED_EMPTY').length,
    purgedFile,
    keys: migratedSummaries,
    proofHash,
    timestamp: new Date().toISOString(),
    events,
  };
}

/**
 * Executes a structured, tamper-evident Key Rotation Ceremony.
 */
export async function executeKeyRotationCeremony(
  key: string,
  newValue: string,
  rotatedBy: string,
  reason: string,
  secretStore: SecretStore
): Promise<RotationCeremonyResult> {
  if (!key || !newValue) {
    throw new Error('Key and new secret value are required for rotation ceremony');
  }

  // 1. Check existing secret to capture previous fingerprint
  const existingSecret = await secretStore.getSecret(key);
  const previousFingerprint = existingSecret ? computeFingerprint(existingSecret) : null;
  const newFingerprint = computeFingerprint(newValue);

  // 2. Persist new secret value into SecretStore
  await secretStore.setSecret(
    key,
    newValue,
    `Rotated by ${rotatedBy}: ${reason}`
  );

  // 3. Update active redaction table
  if (existingSecret) {
    defaultRedactor.unregisterSecret(existingSecret);
  }
  defaultRedactor.registerSecret(newValue);

  // 4. Create and record SecretRotationEvent
  const rotationEvent: SecretRotationEvent = {
    key,
    previousFingerprint: previousFingerprint || undefined,
    newFingerprint,
    timestamp: new Date().toISOString(),
    rotatedBy,
    provider: secretStore.getProviderType(),
  };
  rotationHistory.unshift(rotationEvent);

  // 5. Compute cryptographic ceremony proof hash
  const proofHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        key,
        previousFingerprint,
        newFingerprint,
        rotatedBy,
        timestamp: rotationEvent.timestamp,
        provider: secretStore.getProviderType(),
      }),
      'utf8'
    )
    .digest('hex');

  return {
    key,
    previousFingerprint,
    newFingerprint,
    timestamp: rotationEvent.timestamp,
    rotatedBy,
    provider: secretStore.getProviderType(),
    proofHash,
    rotationEvent,
  };
}

/**
 * Verifies that a target file contains zero plaintext credentials.
 */
export function verifyZeroPlaintextResidual(filePath: string, migratedKeys: string[]): boolean {
  if (!fs.existsSync(filePath)) {
    return true;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  for (const key of migratedKeys) {
    // Check if line has key followed by equal sign and non-empty, non-comment value
    const regex = new RegExp(`^\\s*${key}\\s*=\\s*(?!#)(?!MIGRATED)(?!["']?\\s*$).+$`, 'm');
    if (regex.test(content)) {
      return false;
    }
  }
  return true;
}
