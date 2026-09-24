import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Express } from 'express';
import type { ProjectStore } from './projectStore.ts';

export const PROJECT_STATE_SCHEMA_VERSION = 1;

export interface ProjectStateSnapshot {
  schemaVersion: number;
  state: Record<string, any>;
}

/**
 * Resolves the absolute path to .local/project-state.json for a given workspace root.
 */
export function resolveProjectStatePath(workspaceRoot: string = process.cwd()): string {
  return path.join(workspaceRoot, '.local', 'project-state.json');
}

/**
 * Reads and validates an existing project state snapshot from disk.
 * Returns null if the snapshot file does not exist.
 * Throws an Error if the snapshot exists but is corrupted or incompatible.
 */
export function readProjectSnapshot(workspaceRoot: string = process.cwd()): ProjectStateSnapshot | null {
  const filename = resolveProjectStatePath(workspaceRoot);
  if (!fs.existsSync(filename)) {
    return null;
  }
  const raw = fs.readFileSync(filename, 'utf8');
  let saved: any;
  try {
    saved = JSON.parse(raw);
  } catch (err: unknown) {
    throw new Error(`Invalid local project snapshot JSON; preserve file for recovery: ${String(err)}`);
  }
  if (saved.schemaVersion !== PROJECT_STATE_SCHEMA_VERSION || !Array.isArray(saved.state?.projects)) {
    throw new Error('Invalid local project snapshot; preserve file for recovery');
  }
  return saved as ProjectStateSnapshot;
}

/**
 * Hydrates an in-memory ProjectStore from a loaded snapshot.
 * Preserves default built-in sub-collections for any fields not present in older snapshot states.
 */
export function hydrateProjectStoreFromSnapshot(store: ProjectStore | any, snapshot: ProjectStateSnapshot): void {
  if (!snapshot || !snapshot.state || typeof snapshot.state !== 'object') {
    throw new Error('Cannot hydrate store from invalid snapshot state');
  }
  for (const key of Object.keys(store)) {
    if (Object.hasOwn(snapshot.state, key)) {
      store[key] = snapshot.state[key];
    }
  }
  // Ensure documents dictionary exists even if hydrating an older snapshot format
  if (!store.documents) {
    store.documents = { 'PRJ-ATLAS-01': [] };
  }
}

/**
 * Creates a serializable snapshot of the current in-memory ProjectStore state.
 */
export function snapshotProjectStore(store: ProjectStore | any): ProjectStateSnapshot {
  return {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    state: structuredClone({ ...store }),
  };
}

/**
 * Performs an atomic write of the snapshot to .local/project-state.json.
 * 1. Creates .local/ only when authorized to write.
 * 2. Writes to a temporary file in the same directory.
 * 3. Atomically renames the temporary file to target.
 * 4. Cleans up temporary file on failure.
 */
export interface WriteSnapshotAtomicOptions {
  beforeRename?: (tempPath: string, targetPath: string) => void;
  /** Exact on-disk bytes reviewed by the writer; null means no snapshot existed. */
  expectedDigest?: string | null;
}

export function projectSnapshotDigest(workspaceRoot = process.cwd()): string | null {
  const filename = resolveProjectStatePath(workspaceRoot);
  return fs.existsSync(filename) ? crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') : null;
}

export function writeProjectSnapshotAtomic(
  snapshot: ProjectStateSnapshot,
  workspaceRoot: string = process.cwd(),
  options?: WriteSnapshotAtomicOptions
): string {
  if (!snapshot || snapshot.schemaVersion !== PROJECT_STATE_SCHEMA_VERSION || !Array.isArray(snapshot.state?.projects)) {
    throw new Error('Cannot write malformed project state snapshot');
  }

  const targetFile = resolveProjectStatePath(workspaceRoot);
  const targetDir = path.dirname(targetFile);

  // Create .local only when write is authorized
  fs.mkdirSync(targetDir, { recursive: true });

  const tempFile = path.join(targetDir, `project-state.json.tmp.${crypto.randomUUID()}`);
  // All application snapshot writers share this exclusive lock. Never steal a
  // stale lock automatically: recovery requires confirming the owner is stopped.
  const lockFile = path.join(targetDir, 'project-state.write.lock');
  let lock: number;
  try { lock = fs.openSync(lockFile, 'wx'); }
  catch { throw new Error('STATE_WRITER_BUSY: another writer owns the snapshot lock'); }
  const checkExpected = () => {
    if (options && Object.hasOwn(options, 'expectedDigest') && projectSnapshotDigest(workspaceRoot) !== options.expectedDigest) {
      throw new Error('STALE_STATE: snapshot changed; reload and review again');
    }
  };
  try {
    checkExpected();
    fs.writeFileSync(tempFile, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    if (options?.beforeRename) {
      options.beforeRename(tempFile, targetFile);
    }
    checkExpected();
    fs.renameSync(tempFile, targetFile);
    return crypto.createHash('sha256').update(JSON.stringify(snapshot, null, 2) + '\n').digest('hex');
  } catch (err: unknown) {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Best-effort cleanup
    }
    throw err;
  } finally {
    // A cleanup failure after rename must not report a rollback of a committed
    // snapshot. A remaining lock fails closed and requires operator recovery.
    try { fs.closeSync(lock); } catch { /* already closed */ }
    try { fs.unlinkSync(lockFile); } catch { /* fail closed on the next write */ }
  }
}

/**
 * Installs project persistence middleware on Express application.
 * Retains exact transactional rollback semantics.
 */
export function installProjectPersistence(app: Express, store: any, workspaceRoot: string = process.cwd()) {
  let persistedDigest = projectSnapshotDigest(workspaceRoot);
  let transactionInFlight = false;
  const existingSnapshot = readProjectSnapshot(workspaceRoot);
  if (projectSnapshotDigest(workspaceRoot) !== persistedDigest) throw new Error('STALE_STATE during server startup');
  if (existingSnapshot) {
    hydrateProjectStoreFromSnapshot(store, existingSnapshot);
  }

  app.use('/api/projects', (req, res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && !(req.method === 'GET' && req.path.endsWith('/package/export'))) {
      return next();
    }
    if (projectSnapshotDigest(workspaceRoot) !== persistedDigest) {
      return res.status(409).json({error: 'Persisted state changed outside this server; restart before updating projects'});
    }
    if (transactionInFlight) return res.status(409).json({error:'Another project transaction is in progress; retry after it completes'});
    transactionInFlight = true;
    let released = false;
    const release = () => { if (!released) { released = true; transactionInFlight = false; } };
    res.once('finish', release);
    const before = structuredClone({ ...store });
    const send = res.json.bind(res);
    const respond = (body: any) => { const result = send(body); release(); return result; };
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const snapshot = snapshotProjectStore(store);
          persistedDigest = writeProjectSnapshotAtomic(snapshot, workspaceRoot, {expectedDigest: persistedDigest});
        } catch (error) {
          Object.assign(store, before);
          res.status(500);
          return respond({ error: 'Failed to persist project transaction; changes rolled back' });
        }
      } else {
        Object.assign(store, before);
      }
      return respond(body);
    };
    next();
  });
}
