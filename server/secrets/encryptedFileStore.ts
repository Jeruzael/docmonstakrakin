import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SecretStore, SecretMetadata, SecretProviderType } from '../../src/types.ts';

export interface EncryptedStoreConfig {
  /** File path where encrypted payload envelope is stored */
  storagePath?: string;
  /** File path where the local derivation salt is persisted */
  saltPath?: string;
  /** Optional user-provided master passphrase. If omitted, derived from local machine install token. */
  masterPassphrase?: string;
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
  private readonly storagePath: string;
  private readonly saltPath: string;
  private readonly passphrase: string;
  private cachedPayload: DecryptedPayload | null = null;
  private isInitialized = false;

  constructor(config: EncryptedStoreConfig = {}) {
    const rootDir = process.cwd();
    const defaultDataDir = path.join(rootDir, '.docmonstakrakin');

    this.storagePath = config.storagePath ?? path.join(defaultDataDir, 'secrets.enc');
    this.saltPath = config.saltPath ?? path.join(defaultDataDir, 'secrets.salt');
    
    // Master passphrase fallback: configured passphrase -> machine-specific seed -> fallback token
    this.passphrase = config.masterPassphrase ||
      process.env.DOCMONSTAKRAKIN_MASTER_KEY ||
      this.getOrCreateMachineToken(defaultDataDir);
  }

  public getProviderType(): SecretProviderType {
    return 'ENCRYPTED_FILE';
  }

  /**
   * Generates or retrieves a host-bound installation token used for local KDF derivation.
   */
  private getOrCreateMachineToken(dataDir: string): string {
    const tokenFile = path.join(dataDir, '.machine_token');
    try {
      if (fs.existsSync(tokenFile)) {
        return fs.readFileSync(tokenFile, 'utf8').trim();
      }
    } catch {
      // Fall through to generation
    }

    const token = crypto.randomBytes(32).toString('hex');
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(tokenFile, token, { encoding: 'utf8', mode: 0o600 });
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
    return crypto.pbkdf2Sync(customPassphrase || this.passphrase, salt, 100_000, 32, 'sha256');
  }

  /**
   * Initializes store and loads existing payload from disk if present.
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

      if (envelope.version !== 1 || envelope.encryption.algorithm !== 'AES-256-GCM') {
        throw new Error(`Unsupported secret envelope format: v${envelope.version}`);
      }

      const salt = Buffer.from(envelope.kdf.saltHex, 'hex');
      const iv = Buffer.from(envelope.encryption.ivHex, 'hex');
      const authTag = Buffer.from(envelope.encryption.authTagHex, 'hex');
      const ciphertext = Buffer.from(envelope.ciphertextHex, 'hex');

      // Candidate passphrases: primary configured passphrase, followed by machine token fallback
      const candidatePassphrases = [this.passphrase];
      const defaultDataDir = path.join(process.cwd(), '.docmonstakrakin');
      const machineToken = this.getOrCreateMachineToken(defaultDataDir);
      if (machineToken && !candidatePassphrases.includes(machineToken)) {
        candidatePassphrases.push(machineToken);
      }

      let decryptedBytes: Buffer | null = null;
      let usedPassphrase = this.passphrase;
      let lastDecryptErr: Error | null = null;

      for (const pass of candidatePassphrases) {
        try {
          const key = this.deriveKey(salt, pass);
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(authTag);
          decryptedBytes = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
          ]);
          usedPassphrase = pass;
          break;
        } catch (err: any) {
          lastDecryptErr = err;
        }
      }

      if (!decryptedBytes) {
        throw lastDecryptErr || new Error('Authentication failed for all candidate passphrases');
      }

      const decryptedJson: { secrets: Record<string, string> } = JSON.parse(
        decryptedBytes.toString('utf8')
      );

      const metadataMap: Record<string, SecretMetadata> = {};
      for (const meta of envelope.metadata) {
        metadataMap[meta.key] = meta;
      }

      this.cachedPayload = {
        secrets: decryptedJson.secrets || {},
        metadata: metadataMap,
      };
      this.isInitialized = true;

      // If envelope was decrypted using a fallback passphrase rather than the current primary passphrase,
      // re-encrypt with current primary passphrase so future accesses use the primary passphrase.
      if (usedPassphrase !== this.passphrase) {
        await this.persistToDisk();
      }
    } catch (err: any) {
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
