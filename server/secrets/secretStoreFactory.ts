import path from 'node:path';
import { SecretStore, SecretMetadata } from '../../src/types.ts';
import { EncryptedFileSecretStore } from './encryptedFileStore.ts';
import { OSKeychainSecretStore } from './osKeychainStore.ts';

export interface SecretStoreFactoryConfig {
  dataDir?: string;
  storagePath?: string;
  saltPath?: string;
  machineTokenPath?: string;
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
  const serviceName = config?.serviceName ?? 'docmonstakrakin';

  const fallbackStore = new EncryptedFileSecretStore({
    dataDir: defaultDir,
    storagePath,
    saltPath,
    machineTokenPath,
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
 */
export async function initializeSecretStore(config?: SecretStoreFactoryConfig): Promise<SecretStore> {
  const store = getSecretStore(config);

  if (!isInitialized) {
    try {
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
    } catch (err) {
      console.warn('[SecretStore] Non-fatal notice during environment bootstrap:', err);
    }
    isInitialized = true;
  }

  return store;
}

/**
 * Safely resolves a credential value by key from the active store.
 */
export async function resolveSecret(key: string): Promise<string | null> {
  try {
    const store = getSecretStore();
    const val = await store.getSecret(key);
    if (val) return val;
  } catch (err) {
    console.warn(`[SecretStore] Non-fatal notice resolving credential '${key}':`, err);
  }

  // Fallback to process.env during migration phase if not present in store
  return process.env[key] || null;
}

/**
 * Resets the active singleton (used in test fixtures).
 */
export function resetSecretStore(): void {
  activeStore = null;
  isInitialized = false;
}
