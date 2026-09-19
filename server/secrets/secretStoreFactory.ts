import path from 'node:path';
import { SecretStore, SecretMetadata } from '../../src/types.ts';
import { EncryptedFileSecretStore } from './encryptedFileStore.ts';
import { OSKeychainSecretStore } from './osKeychainStore.ts';

export interface SecretStoreFactoryConfig {
  dataDir?: string;
  storagePath?: string;
  saltPath?: string;
  machineTokenPath?: string;
  legacyMachineTokenPath?: string;
  serviceName?: string;
  masterPassphrase?: string;
  forceFallback?: boolean;
}

let activeStore: SecretStore | null = null;
let isInitialized = false;

/**
 * Creates or retrieves the singleton SecretStore instance.
 *
 * Defaults to OSKeychainSecretStore with automatic fallback to EncryptedFileSecretStore.
 */
export function getSecretStore(config?: SecretStoreFactoryConfig): SecretStore {
  if (activeStore && !config) {
    return activeStore;
  }

  const defaultDir = config?.dataDir ?? path.join(process.cwd(), '.secrets');
  const storagePath = config?.storagePath ?? path.join(defaultDir, 'store.enc');
  const saltPath = config?.saltPath ?? path.join(defaultDir, 'store.salt');
  const machineTokenPath = config?.machineTokenPath ?? path.join(defaultDir, '.machine_token');
  const legacyMachineTokenPath = config?.legacyMachineTokenPath ?? path.join(process.cwd(), '.docmonstakrakin', '.machine_token');
  const serviceName = config?.serviceName ?? 'docmonstakrakin';

  const fallbackStore = new EncryptedFileSecretStore({
    dataDir: defaultDir,
    storagePath,
    saltPath,
    machineTokenPath,
    legacyMachineTokenPath,
    masterPassphrase: config?.masterPassphrase,
  });

  activeStore = new OSKeychainSecretStore({
    serviceName,
    fallbackStore,
    forceFallback: config?.forceFallback,
  });

  return activeStore;
}

/**
 * Initializes the SecretStore and bootstraps known ambient environment credentials
 * (e.g. GEMINI_API_KEY) into the secure store if not already provisioned.
 *
 * Fails closed if the store fails integrity or decryption verification.
 */
export async function initializeSecretStore(config?: SecretStoreFactoryConfig): Promise<SecretStore> {
  const store = getSecretStore(config);

  if (!isInitialized) {
    // Sync GEMINI_API_KEY from ambient environment if available and not yet in store
    const ambientKey = process.env.GEMINI_API_KEY;
    if (ambientKey && ambientKey.trim()) {
      const hasKey = await store.hasSecret('GEMINI_API_KEY');
      if (!hasKey) {
        await store.setSecret(
          'GEMINI_API_KEY',
          ambientKey.trim(),
          'Ambient runtime Gemini API key auto-migrated into SecretStore'
        );
        console.log('[SecretStore] Bootstrapped ambient GEMINI_API_KEY into secure credential store.');
      }
    }
    isInitialized = true;
  }

  return store;
}

/**
 * Safely resolves a credential value by key from the active store.
 *
 * Invariant: Fails closed. If the secure store fails authentication, decryption,
 * or integrity verification, the failure is propagated and never swallowed.
 * Falling back to process.env is permitted ONLY when the store access itself succeeded
 * but the requested key was absent.
 */
export async function resolveSecret(key: string): Promise<string | null> {
  const store = getSecretStore();
  const val = await store.getSecret(key);
  if (val) return val;

  // Fallback to process.env during migration phase only when store access succeeded but key was absent
  return process.env[key] || null;
}

/**
 * Resets the active singleton (used in test fixtures).
 */
export function resetSecretStore(): void {
  activeStore = null;
  isInitialized = false;
}
