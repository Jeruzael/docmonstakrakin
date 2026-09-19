import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SecretStore, SecretMetadata, SecretProviderType } from '../../src/types.ts';

export interface EncryptedStoreConfig {
  /** Base directory where store files reside. Defaults to process.cwd()/.docmonstakrakin */
  dataDir?: string;
  /** File path where encrypted payload envelope is stored */
  storagePath?: string;
  /** File path where the local derivation salt is persisted */
  saltPath?: string;
  /** File path where the host-bound machine token is persisted */
  machineTokenPath?: string;
  /** Explicit one-time historical recovery location. */
  legacyMachineTokenPath?: string;
  /** Optional user-provided master passphrase. If omitted, derived from DOCMONSTAKRAKIN_MASTER_KEY or machine token. */
  masterPassphrase?: string;
}

export interface SecretStoreMigrationStatus {
  migrated: boolean;
  source?: 'LEGACY_MACHINE_TOKEN';
  target?: 'CONFIGURED_MASTER_KEY';
}

interface StoredEnvelope {
  version: number;
  kdf: {
    algorithm: string;
    iterations: number;
    saltHex: string;
  };
  encryption: {
    algorithm: string;
    ivHex: string;
    authTagHex: string;
  };
  ciphertextHex: string;
  metadata: SecretMetadata[];
  updatedAt: string;
}

interface DecryptedPayload {
  secrets: Record<string, string>;
  metadata: Record<string, SecretMetadata>;
}

/**
 * Computes a masked cryptographic fingerprint of a secret for audit tracking.
 * Never leaks the actual secret value.
 */
function computeFingerprint(value: string): string {
  const hash = crypto.createHash('sha256').update(value).digest('hex');
  return `sha256:${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

/**
 * EncryptedFileSecretStore
 *
 * Implements AES-256-GCM authenticated encryption for local-first credential storage.
 * Provides fallback security when desktop OS native keyrings (macOS Keychain,
 * Windows Credential Manager, Linux SecretService) are unavailable (e.g. headless containers).
 *
 * Invariants:
 * - Encryption key derived via PBKDF2 with 100,000 iterations and 32-byte cryptographically secure salt.
 * - AES-256-GCM authenticated encryption with 12-byte random IV and 16-byte authentication tag.
 * - Atomic disk writes (tempfile -> rename) to guarantee interruption safety.
 * - Zero plaintext secret values in envelope metadata or logs.
 */
export class EncryptedFileSecretStore implements SecretStore {
  private readonly dataDir: string;
  private readonly storagePath: string;
  private readonly saltPath: string;
  private readonly machineTokenPath: string;
  private readonly legacyMachineTokenPath?: string;
  private readonly configuredPassphrase: string | null;
  private passphrase: string;
  private cachedPayload: DecryptedPayload | null = null;
  private isInitialized = false;
  private migrationStatus: SecretStoreMigrationStatus | null = null;

  constructor(config: EncryptedStoreConfig = {}) {
    const rootDir = process.cwd();
    this.dataDir = config.dataDir ?? (config.storagePath ? path.dirname(config.storagePath) : path.join(rootDir, '.docmonstakrakin'));

    this.storagePath = config.storagePath ?? path.join(this.dataDir, 'secrets.enc');
    this.saltPath = config.saltPath ?? path.join(this.dataDir, 'secrets.salt');
    this.machineTokenPath = config.machineTokenPath ?? path.join(this.dataDir, '.machine_token');
    this.legacyMachineTokenPath = config.legacyMachineTokenPath;

    const envKey = process.env.DOCMONSTAKRAKIN_MASTER_KEY?.trim() || undefined;
    this.configuredPassphrase = config.masterPassphrase || envKey || null;

    if (this.configuredPassphrase) {
      this.passphrase = this.configuredPassphrase;
    } else {
      // Existing envelope recovery: only read an existing token, never create one as a recovery attempt.
      // New store: generating a local machine token is appropriate when no master passphrase is configured.
      if (fs.existsSync(this.storagePath)) {
        this.passphrase = this.readExistingMachineToken() || this.readExistingLegacyToken() || '';
      } else {
        this.passphrase = this.getOrCreateMachineToken();
      }
    }
  }

  public getProviderType(): SecretProviderType {
    return 'ENCRYPTED_FILE';
  }

  /**
   * Exposes structured provenance for legacy re-key migration ceremonies.
   */
  public getMigrationStatus(): SecretStoreMigrationStatus | null {
    return this.migrationStatus;
  }

  /**
   * Reads an existing historical legacy machine installation token without generating or creating one.
   * Used for explicit one-time backward-compatible migration candidate discovery.
   */
  public readExistingLegacyToken(): string | null {
    if (!this.legacyMachineTokenPath) {
      return null;
    }
    try {
      if (fs.existsSync(this.legacyMachineTokenPath)) {
        const token = fs.readFileSync(this.legacyMachineTokenPath, 'utf8').trim();
        return token.length > 0 ? token : null;
      }
    } catch {
      // Fall through to return null
    }
    return null;
  }

  /**
   * Reads an existing host-bound machine installation token without generating or creating one.
   * Used for legacy fallback key candidate discovery.
   */
  public readExistingMachineToken(): string | null {
    try {
      if (fs.existsSync(this.machineTokenPath)) {
        const token = fs.readFileSync(this.machineTokenPath, 'utf8').trim();
        return token.length > 0 ? token : null;
      }
    } catch {
      // Fall through to return null
    }
    return null;
  }

  /**
   * Generates or retrieves a host-bound installation token used for local KDF derivation.
   * Only called when establishing a brand new unencrypted store with no configured master passphrase.
   */
  public getOrCreateMachineToken(): string {
    try {
      if (fs.existsSync(this.machineTokenPath)) {
        const token = fs.readFileSync(this.machineTokenPath, 'utf8').trim();
        if (token.length > 0) {
          return token;
        }
      }
    } catch {
      // Fall through to generation
    }

    const token = crypto.randomBytes(32).toString('hex');
    try {
      const dir = path.dirname(this.machineTokenPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(this.machineTokenPath, token, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // If filesystem restricted, return token in memory
    }
    return token;
  }

  /**
   * Retrieves or initializes the local 32-byte salt for PBKDF2 derivation.
   */
  private getOrCreateSalt(): Buffer {
    if (fs.existsSync(this.saltPath)) {
      const hex = fs.readFileSync(this.saltPath, 'utf8').trim();
      return Buffer.from(hex, 'hex');
    }

    const dir = path.dirname(this.saltPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const salt = crypto.randomBytes(32);
    fs.writeFileSync(this.saltPath, salt.toString('hex'), { encoding: 'utf8', mode: 0o600 });
    return salt;
  }

  /**
   * Derives a 256-bit symmetric encryption key using PBKDF2.
   */
  private deriveKey(salt: Buffer, customPassphrase?: string): Buffer {
    const passphraseToUse = customPassphrase || this.passphrase;
    return crypto.pbkdf2Sync(passphraseToUse, salt, 100_000, 32, 'sha256');
  }

  /**
   * Initializes store and loads existing payload from disk if present.
   * Handles authenticated decryption, candidate fallback, and post-verified re-key migration.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized && this.cachedPayload) {
      return;
    }

    if (!fs.existsSync(this.storagePath)) {
      this.cachedPayload = {
        secrets: {},
        metadata: {},
      };
      this.isInitialized = true;
      return;
    }

    try {
      const rawEnvelope = fs.readFileSync(this.storagePath, 'utf8');
      const envelope: StoredEnvelope = JSON.parse(rawEnvelope);

      if (envelope.version !== 1 || envelope.encryption?.algorithm !== 'AES-256-GCM') {
        throw new Error(`Unsupported secret envelope format: v${envelope?.version}`);
      }

      const salt = Buffer.from(envelope.kdf.saltHex, 'hex');
      const iv = Buffer.from(envelope.encryption.ivHex, 'hex');
      const authTag = Buffer.from(envelope.encryption.authTagHex, 'hex');
      const ciphertext = Buffer.from(envelope.ciphertextHex, 'hex');

      interface CandidateKey {
        source: 'CONFIGURED_MASTER_KEY' | 'CURRENT_MACHINE_TOKEN' | 'LEGACY_MACHINE_TOKEN';
        passphrase: string;
      }

      const candidates: CandidateKey[] = [];
      const seenPassphrases = new Set<string>();

      // 1. Configured primary master passphrase (or current passphrase if no explicit master passphrase)
      if (this.configuredPassphrase && this.configuredPassphrase.trim().length > 0) {
        candidates.push({
          source: 'CONFIGURED_MASTER_KEY',
          passphrase: this.configuredPassphrase.trim(),
        });
        seenPassphrases.add(this.configuredPassphrase.trim());
      } else if (this.passphrase && this.passphrase.trim().length > 0) {
        candidates.push({
          source: 'CURRENT_MACHINE_TOKEN',
          passphrase: this.passphrase.trim(),
        });
        seenPassphrases.add(this.passphrase.trim());
      }

      // 2. Existing current machine token (if exists on disk and not yet tried)
      const currentToken = this.readExistingMachineToken();
      if (currentToken && !seenPassphrases.has(currentToken)) {
        candidates.push({
          source: 'CURRENT_MACHINE_TOKEN',
          passphrase: currentToken,
        });
        seenPassphrases.add(currentToken);
      }

      // 3. Existing historical legacy machine token (if configured and exists on disk and not yet tried)
      const legacyToken = this.readExistingLegacyToken();
      if (legacyToken && !seenPassphrases.has(legacyToken)) {
        candidates.push({
          source: 'LEGACY_MACHINE_TOKEN',
          passphrase: legacyToken,
        });
        seenPassphrases.add(legacyToken);
      }

      // 4. Never create any token during recovery.
      // 5. Authenticate against candidates in priority order; fail closed if none match.
      let decryptedBytes: Buffer | null = null;
      let successfulCandidate: CandidateKey | null = null;
      const attemptedSources: string[] = [];

      for (const candidate of candidates) {
        attemptedSources.push(candidate.source);
        try {
          const key = this.deriveKey(salt, candidate.passphrase);
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(authTag);
          decryptedBytes = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
          ]);
          successfulCandidate = candidate;
          break;
        } catch {
          // Candidate failed authentication; continue to next candidate
        }
      }

      if (!decryptedBytes || !successfulCandidate) {
        throw new Error(
          `Authentication failed for all attempted key sources: [${attemptedSources.join(', ')}]`
        );
      }

      // 3. If authentication succeeds, deserialize secrets and metadata
      const decryptedJson: { secrets: Record<string, string> } = JSON.parse(
        decryptedBytes.toString('utf8')
      );

      const metadataMap: Record<string, SecretMetadata> = {};
      if (Array.isArray(envelope.metadata)) {
        for (const meta of envelope.metadata) {
          metadataMap[meta.key] = meta;
        }
      }

      this.cachedPayload = {
        secrets: decryptedJson.secrets || {},
        metadata: metadataMap,
      };

      // 4. If legacy token fallback was used and a primary master key is configured, execute re-key ceremony
      const needsRekey = Boolean(
        this.configuredPassphrase &&
        (successfulCandidate.source === 'LEGACY_MACHINE_TOKEN' ||
          (successfulCandidate.source === 'CURRENT_MACHINE_TOKEN' && successfulCandidate.passphrase !== this.configuredPassphrase))
      );

      if (needsRekey && this.configuredPassphrase) {
        console.warn(
          `[SecretStore] Decrypted envelope using ${successfulCandidate.source} fallback. Re-encrypting envelope with primary master passphrase...`
        );

        const targetPassphrase = this.configuredPassphrase;
        const newSalt = this.getOrCreateSalt();
        const newKey = this.deriveKey(newSalt, targetPassphrase);
        const newIv = crypto.randomBytes(12);

        const plaintext = JSON.stringify({
          secrets: this.cachedPayload.secrets,
        });

        const cipher = crypto.createCipheriv('aes-256-gcm', newKey, newIv);
        const newCiphertext = Buffer.concat([
          cipher.update(Buffer.from(plaintext, 'utf8')),
          cipher.final(),
        ]);
        const newAuthTag = cipher.getAuthTag();

        const newEnvelope: StoredEnvelope = {
          version: 1,
          kdf: {
            algorithm: 'PBKDF2-SHA256',
            iterations: 100_000,
            saltHex: newSalt.toString('hex'),
          },
          encryption: {
            algorithm: 'AES-256-GCM',
            ivHex: newIv.toString('hex'),
            authTagHex: newAuthTag.toString('hex'),
          },
          ciphertextHex: newCiphertext.toString('hex'),
          metadata: Object.values(this.cachedPayload.metadata),
          updatedAt: new Date().toISOString(),
        };

        const targetDir = path.dirname(this.storagePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
        }

        const tempFile = `${this.storagePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        const backupFile = `${this.storagePath}.${crypto.randomBytes(4).toString('hex')}.orig.bak`;

        fs.writeFileSync(tempFile, JSON.stringify(newEnvelope, null, 2), {
          encoding: 'utf8',
          mode: 0o600,
        });

        // Atomically replace envelope, preserving an encrypted backup of original in case post-write verification fails
        try {
          fs.copyFileSync(this.storagePath, backupFile);
          fs.renameSync(tempFile, this.storagePath);
        } catch (writeErr: any) {
          try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch {}
          try { if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile); } catch {}
          throw new Error(`Failed to commit re-keyed envelope to disk: ${writeErr.message}`);
        }

        // 5. Post-write verification: confirm newly written envelope decrypts with primary key
        try {
          const verifyRaw = fs.readFileSync(this.storagePath, 'utf8');
          const verifyEnv: StoredEnvelope = JSON.parse(verifyRaw);
          const vSalt = Buffer.from(verifyEnv.kdf.saltHex, 'hex');
          const vIv = Buffer.from(verifyEnv.encryption.ivHex, 'hex');
          const vTag = Buffer.from(verifyEnv.encryption.authTagHex, 'hex');
          const vCipher = Buffer.from(verifyEnv.ciphertextHex, 'hex');

          const vKey = this.deriveKey(vSalt, targetPassphrase);
          const vDecipher = crypto.createDecipheriv('aes-256-gcm', vKey, vIv);
          vDecipher.setAuthTag(vTag);
          const vBytes = Buffer.concat([
            vDecipher.update(vCipher),
            vDecipher.final(),
          ]);
          const vJson = JSON.parse(vBytes.toString('utf8'));
          if (JSON.stringify(vJson.secrets) !== JSON.stringify(this.cachedPayload.secrets)) {
            throw new Error('Re-key verification mismatch between original and re-keyed payload');
          }

          // 6. Only then report migration success and remove backup
          try { if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile); } catch {}
          this.passphrase = targetPassphrase;
          this.migrationStatus = {
            migrated: true,
            source: 'LEGACY_MACHINE_TOKEN',
            target: 'CONFIGURED_MASTER_KEY',
          };
          console.warn(
            '[SecretStore] Successfully re-encrypted and verified envelope with primary master passphrase.'
          );
        } catch (verifyErr: any) {
          // Post-write verification failed: fail closed and restore original envelope
          try {
            if (fs.existsSync(backupFile)) {
              fs.copyFileSync(backupFile, this.storagePath);
              fs.unlinkSync(backupFile);
            }
          } catch {}
          throw new Error(
            `Post-write re-key verification failed: ${verifyErr.message}. Original envelope preserved.`
          );
        }
      }

      this.isInitialized = true;
    } catch (err: any) {
      this.cachedPayload = null;
      this.isInitialized = false;
      throw new Error(
        `Failed to decrypt local SecretStore at ${this.storagePath}: ${err.message}`
      );
    }
  }

  /**
   * Atomically commits current in-memory payload to encrypted disk envelope.
   */
  private async persistToDisk(): Promise<void> {
    if (!this.cachedPayload) {
      return;
    }

    const salt = this.getOrCreateSalt();
    const key = this.deriveKey(salt);
    const iv = crypto.randomBytes(12);

    const plaintext = JSON.stringify({
      secrets: this.cachedPayload.secrets,
    });

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const metadataList = Object.values(this.cachedPayload.metadata);

    const envelope: StoredEnvelope = {
      version: 1,
      kdf: {
        algorithm: 'PBKDF2-SHA256',
        iterations: 100_000,
        saltHex: salt.toString('hex'),
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        ivHex: iv.toString('hex'),
        authTagHex: authTag.toString('hex'),
      },
      ciphertextHex: ciphertext.toString('hex'),
      metadata: metadataList,
      updatedAt: new Date().toISOString(),
    };

    const targetDir = path.dirname(this.storagePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    }

    // Atomic write pattern: write to .tmp and rename
    const tempFile = `${this.storagePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(envelope, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(tempFile, this.storagePath);
  }

  public async getSecret(key: string): Promise<string | null> {
    await this.ensureInitialized();
    if (!this.cachedPayload) return null;
    return this.cachedPayload.secrets[key] ?? null;
  }

  public async setSecret(key: string, value: string, description?: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.cachedPayload) {
      this.cachedPayload = { secrets: {}, metadata: {} };
    }

    const now = new Date().toISOString();
    const fingerprint = computeFingerprint(value);

    this.cachedPayload.secrets[key] = value;
    this.cachedPayload.metadata[key] = {
      key,
      description: description || `Secret key: ${key}`,
      provider: 'ENCRYPTED_FILE',
      lastRotated: now,
      isConfigured: true,
      fingerprint,
      updatedAt: now,
      createdAt: this.cachedPayload.metadata[key]?.createdAt || now,
    };

    await this.persistToDisk();
  }

  public async deleteSecret(key: string): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.cachedPayload || !(key in this.cachedPayload.secrets)) {
      return false;
    }

    delete this.cachedPayload.secrets[key];
    if (this.cachedPayload.metadata[key]) {
      this.cachedPayload.metadata[key].isConfigured = false;
      this.cachedPayload.metadata[key].updatedAt = new Date().toISOString();
      delete this.cachedPayload.metadata[key].fingerprint;
    }

    await this.persistToDisk();
    return true;
  }

  public async hasSecret(key: string): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.cachedPayload) return false;
    return (
      key in this.cachedPayload.secrets &&
      this.cachedPayload.secrets[key] !== undefined &&
      this.cachedPayload.secrets[key] !== ''
    );
  }

  public async listSecretMetadata(): Promise<SecretMetadata[]> {
    await this.ensureInitialized();
    if (!this.cachedPayload) return [];
    return Object.values(this.cachedPayload.metadata);
  }
}
