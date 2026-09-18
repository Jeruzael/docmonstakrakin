import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import { SecretStore, SecretMetadata, SecretProviderType } from '../../src/types.ts';
import { EncryptedFileSecretStore } from './encryptedFileStore.ts';

export interface OSKeychainConfig {
  serviceName?: string;
  fallbackStore?: SecretStore;
  forceFallback?: boolean;
}

export type OSPlatform = 'darwin' | 'win32' | 'linux' | 'unsupported';

/**
 * OSKeychainSecretStore
 *
 * Implements native credential storage using platform-native keychains:
 * - macOS: /usr/bin/security find-generic-password / add-generic-password
 * - Linux: secret-tool (freedesktop.org Secret Service API)
 * - Windows: PowerShell CredentialManager / cmdkey
 *
 * Automatically detects whether a graphical desktop keyring daemon is available.
 * If running in a headless container, Docker environment, or non-interactive terminal,
 * it safely and seamlessly delegates to the AES-256-GCM EncryptedFileSecretStore.
 */
export class OSKeychainSecretStore implements SecretStore {
  private readonly serviceName: string;
  private readonly fallbackStore: SecretStore;
  private readonly forceFallback: boolean;
  private isNativeAvailableCache: boolean | null = null;
  private metadataCache: Map<string, SecretMetadata> = new Map();

  constructor(config: OSKeychainConfig = {}) {
    this.serviceName = config.serviceName ?? 'docmonstakrakin';
    this.forceFallback = config.forceFallback ?? false;
    this.fallbackStore = config.fallbackStore ?? new EncryptedFileSecretStore();
  }

  /**
   * Detects current OS platform.
   */
  public getPlatform(): OSPlatform {
    const platform = os.platform();
    if (platform === 'darwin') return 'darwin';
    if (platform === 'win32') return 'win32';
    if (platform === 'linux') return 'linux';
    return 'unsupported';
  }

  /**
   * Evaluates if the current environment possesses an accessible native keyring.
   */
  public isNativeAvailable(): boolean {
    if (this.forceFallback) {
      return false;
    }

    if (this.isNativeAvailableCache !== null) {
      return this.isNativeAvailableCache;
    }

    const platform = this.getPlatform();

    try {
      if (platform === 'darwin') {
        // macOS: Check if 'security' binary exists and is executable
        const res = spawnSync('which', ['security'], { stdio: 'ignore' });
        this.isNativeAvailableCache = res.status === 0;
      } else if (platform === 'linux') {
        // Linux requires DBUS session bus and secret-tool
        const hasDbus = !!process.env.DBUS_SESSION_BUS_ADDRESS;
        const res = spawnSync('which', ['secret-tool'], { stdio: 'ignore' });
        this.isNativeAvailableCache = hasDbus && res.status === 0;
      } else if (platform === 'win32') {
        // Windows: PowerShell credential manager available
        const res = spawnSync('powershell', ['-Command', 'Get-Command'], { stdio: 'ignore' });
        this.isNativeAvailableCache = res.status === 0;
      } else {
        this.isNativeAvailableCache = false;
      }
    } catch {
      this.isNativeAvailableCache = false;
    }

    return this.isNativeAvailableCache;
  }

  public getProviderType(): SecretProviderType {
    return this.isNativeAvailable() ? 'OS_KEYCHAIN' : this.fallbackStore.getProviderType();
  }

  public async getSecret(key: string): Promise<string | null> {
    if (!this.isNativeAvailable()) {
      return this.fallbackStore.getSecret(key);
    }

    const platform = this.getPlatform();

    try {
      if (platform === 'darwin') {
        const result = spawnSync('security', [
          'find-generic-password',
          '-s', this.serviceName,
          '-a', key,
          '-w'
        ], { encoding: 'utf8' });

        if (result.status === 0 && result.stdout) {
          return result.stdout.trim();
        }
        return null;
      }

      if (platform === 'linux') {
        const result = spawnSync('secret-tool', [
          'lookup',
          'service', this.serviceName,
          'account', key
        ], { encoding: 'utf8' });

        if (result.status === 0 && result.stdout) {
          return result.stdout.trim();
        }
        return null;
      }

      if (platform === 'win32') {
        // Retrieve credential via PowerShell command
        const script = `
          $target = "${this.serviceName}:${key}"
          [Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime] | Out-Null
          $vault = New-Object Windows.Security.Credentials.PasswordVault
          try {
            $cred = $vault.Retrieve("${this.serviceName}", "${key}")
            $cred.RetrievePassword()
            Write-Output $cred.Password
          } catch {
            exit 1
          }
        `;
        const result = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
        if (result.status === 0 && result.stdout) {
          return result.stdout.trim();
        }
        return null;
      }

      return null;
    } catch (err) {
      console.warn(`[OSKeychainSecretStore] Error reading key '${key}', falling back to local store:`, err);
      return this.fallbackStore.getSecret(key);
    }
  }

  public async setSecret(key: string, value: string, description?: string): Promise<void> {
    if (!this.isNativeAvailable()) {
      return this.fallbackStore.setSecret(key, value, description);
    }

    const platform = this.getPlatform();

    try {
      if (platform === 'darwin') {
        // -U updates item if it already exists
        const result = spawnSync('security', [
          'add-generic-password',
          '-U',
          '-s', this.serviceName,
          '-a', key,
          '-w', value,
          '-l', description || `${this.serviceName} (${key})`
        ]);

        if (result.status !== 0) {
          throw new Error(`security command exited with code ${result.status}: ${result.stderr?.toString()}`);
        }
      } else if (platform === 'linux') {
        const result = spawnSync('secret-tool', [
          'store',
          '--label', description || `${this.serviceName} (${key})`,
          'service', this.serviceName,
          'account', key
        ], { input: value, encoding: 'utf8' });

        if (result.status !== 0) {
          throw new Error(`secret-tool exited with code ${result.status}`);
        }
      } else if (platform === 'win32') {
        const script = `
          [Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime] | Out-Null
          $vault = New-Object Windows.Security.Credentials.PasswordVault
          $cred = New-Object Windows.Security.Credentials.PasswordCredential("${this.serviceName}", "${key}", "${value}")
          $vault.Add($cred)
        `;
        const result = spawnSync('powershell', ['-NoProfile', '-Command', script]);
        if (result.status !== 0) {
          throw new Error(`PowerShell credential store failed: code ${result.status}`);
        }
      }

      // Record metadata
      const now = new Date().toISOString();
      this.metadataCache.set(key, {
        key,
        description: description || `Native OS keychain secret: ${key}`,
        provider: 'OS_KEYCHAIN',
        lastRotated: now,
        isConfigured: true,
        updatedAt: now,
        createdAt: this.metadataCache.get(key)?.createdAt || now,
      });
    } catch (err) {
      console.warn(`[OSKeychainSecretStore] Failed to write to native keychain. Persisting to encrypted fallback:`, err);
      await this.fallbackStore.setSecret(key, value, description);
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      return this.fallbackStore.deleteSecret(key);
    }

    const platform = this.getPlatform();

    try {
      if (platform === 'darwin') {
        const result = spawnSync('security', [
          'delete-generic-password',
          '-s', this.serviceName,
          '-a', key
        ]);
        this.metadataCache.delete(key);
        return result.status === 0;
      }

      if (platform === 'linux') {
        const result = spawnSync('secret-tool', [
          'clear',
          'service', this.serviceName,
          'account', key
        ]);
        this.metadataCache.delete(key);
        return result.status === 0;
      }

      if (platform === 'win32') {
        const script = `
          [Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime] | Out-Null
          $vault = New-Object Windows.Security.Credentials.PasswordVault
          try {
            $cred = $vault.Retrieve("${this.serviceName}", "${key}")
            $vault.Remove($cred)
          } catch {
            exit 1
          }
        `;
        const result = spawnSync('powershell', ['-NoProfile', '-Command', script]);
        this.metadataCache.delete(key);
        return result.status === 0;
      }

      return false;
    } catch {
      return this.fallbackStore.deleteSecret(key);
    }
  }

  public async hasSecret(key: string): Promise<boolean> {
    const val = await this.getSecret(key);
    return val !== null && val !== '';
  }

  public async listSecretMetadata(): Promise<SecretMetadata[]> {
    if (!this.isNativeAvailable()) {
      return this.fallbackStore.listSecretMetadata();
    }
    return Array.from(this.metadataCache.values());
  }
}
