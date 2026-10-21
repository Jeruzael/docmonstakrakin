import type {Decision} from './contracts.ts';
import type {PrivateSyntheticStore} from './privateStore.ts';
import type {BoundedVerifier} from './boundedVerifier.ts';
import type {SyntheticSessions} from './sessions.ts';

// Records the candidate's conservative development window only. This module
// cannot acquire a final human PR decision or act as an operational clock/trust
// adapter. Work after the earlier decision/deadline needs renewed authority.
export const DEVELOPMENT_CUTOFF_MS = Date.parse('2026-11-04T00:00:00.000Z');
type Request = {token?: unknown; action?: unknown; resourceId?: unknown};
type Disabled = {enabled: false; authorize(request: Request): Promise<Decision>};
type Fixture = {enabled: true; rootDirectory: string; store: PrivateSyntheticStore; verifier: BoundedVerifier; sessions: SyntheticSessions; authenticate(principalId: string, password: string): Promise<string | null>; authorize(request: Request): Promise<Decision>; close(): Promise<void>};
type Options = {enabled?: false} | {enabled: true; clock?: () => number};

/**
 * Deliberately unreferenced by the server. Default import/factory opens, creates
 * and loads nothing. Synthetic opt-in cannot select an existing store or alter
 * any product route, reviewer roster, canonical evidence or production trust.
 */
export async function createSyntheticFoundations(options: Options = {}): Promise<Disabled | Fixture> {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype || Object.keys(options).some(key => !['enabled', 'clock'].includes(key)) || options.enabled !== undefined && typeof options.enabled !== 'boolean' || 'clock' in options && (options.enabled !== true || typeof options.clock !== 'function')) throw Error('SYNTHETIC_OPTIONS_INVALID');
  if (options.enabled !== true) return {enabled: false, authorize: async () => ({allowed: false, reason: 'SYNTHETIC_DISABLED'})};
  const [{PrivateSyntheticStore}, {BoundedVerifier}, {SyntheticSessions, sessionDigest}, argon] = await Promise.all([
    import('./privateStore.ts'), import('./boundedVerifier.ts'), import('./sessions.ts'), import('argon2'),
  ]);
  const {createRequire} = await import('node:module');
  if (createRequire(import.meta.url)('argon2/package.json').version !== '0.45.1') throw Error('SYNTHETIC_DEPENDENCY_MISMATCH');
  // The Node package is CommonJS; no raw native binding/path is accepted.
  const native = argon.default ?? argon;
  const verifier = new BoundedVerifier(native);
  const dummy = await verifier.hash('synthetic-unknown-principal-dummy');
  const store = await PrivateSyntheticStore.create();
  const clock = options.clock ?? Date.now;
  const sessions = new SyntheticSessions(store, clock);
  let closed = false;
  const active = () => !closed;
  return {
    enabled: true, rootDirectory: store.rootDirectory, store, verifier, sessions,
    async authenticate(principalId, password) {
      if (!active()) return null;
      let record;
      try { record = await store.execute({command: 'getCredential', principalId}); } catch { return null; }
      const eligible = record?.kind === 'HUMAN' && !record.disabled;
      try {
        const matches = await verifier.verify(eligible ? record.verifier : dummy, password);
        if (!eligible || !matches || !active()) return null;
        return await sessions.issue(principalId, {credentialRevision: record.credentialRevision, generation: record.generation});
      } catch { return null; }
    },
    async authorize(request) {
      if (!active()) return {allowed: false, reason: 'SYNTHETIC_DISABLED'};
      if (!request || Object.keys(request).some(key => !['token', 'action', 'resourceId'].includes(key)) || typeof request.action !== 'string' || typeof request.resourceId !== 'string') return {allowed: false, reason: 'INPUT_INVALID'};
      const digest = sessionDigest(request.token);
      if (!digest) return {allowed: false, reason: 'SESSION_INVALID'};
      try { return await store.execute({command: 'authorize', digest, action: request.action, resourceId: request.resourceId, now: clock()}); }
      catch { return {allowed: false, reason: 'AUTHORITY_UNAVAILABLE'}; }
    },
    async close() { if (closed) return; closed = true; await store.close(); },
  };
}
