import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import type {Decision, SessionPrincipal} from '../syntheticFoundations/contracts.ts';
import type {PrivateSyntheticStore} from '../syntheticFoundations/privateStore.ts';
import type {BoundedVerifier} from '../syntheticFoundations/boundedVerifier.ts';
import type {SyntheticSessions} from '../syntheticFoundations/sessions.ts';

export const AUTH_PILOT_BOUNDS = Object.freeze({principalAttempts: 5, globalAttempts: 30, windowMs: 60_000, throttleKeys: 128, passwordBytes: 1024});
export type ResourceHandle = Readonly<{kind: 'DISCONNECTED_RESOURCE'}>;
export type PilotCapability = 'READ' | 'WRITE' | 'HUMAN_APPROVE';
type Options = {enabled?: false} | {enabled: true; mode: 'DISCONNECTED_SYNTHETIC'; clock?: () => number};
type Login = {authenticated: false; limited: boolean} | {authenticated: true; token: string; csrf: string};
export interface AuthPilot {
  enabled: true;
  login(input: unknown): Promise<Login>;
  session(token: unknown): Promise<SessionPrincipal | null>;
  csrf(token: unknown): string | null;
  verifyCsrf(token: unknown, proof: unknown): boolean;
  rotate(token: unknown, proof: unknown): Promise<{token: string; csrf: string} | null>;
  logout(token: unknown, proof: unknown): Promise<boolean>;
  changePassword(token: unknown, proof: unknown, current: unknown, replacement: unknown): Promise<boolean>;
  authorize(token: unknown, capability: PilotCapability, resource: ResourceHandle): Promise<Decision>;
  close(): Promise<void>;
  /** Offline synthetic test capability only; never passed to the HTTP router. */
  fixtures: {
    readonly rootDirectory: string;
    createHuman(id: string, password: string): Promise<void>;
    createAgent(id: string): Promise<void>;
    resource(id: string): Promise<ResourceHandle>;
    rule(id: string, capability: PilotCapability, resource: ResourceHandle, effect: 'ALLOW' | 'DENY'): Promise<void>;
    reset(id: string, password: string): Promise<void>;
    disable(id: string): Promise<void>;
    restart(): Promise<void>;
    terminate(): Promise<void>;
    audit(): Promise<any[]>;
    snapshot(): Promise<any>;
    provenance(): Promise<any>;
  };
}
const idValid = (value: unknown): value is string => typeof value === 'string' && /^fixture-[A-Za-z0-9][A-Za-z0-9_-]{0,55}$/.test(value);
const passwordValid = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= AUTH_PILOT_BOUNDS.passwordBytes && Buffer.byteLength(value, 'utf8') <= AUTH_PILOT_BOUNDS.passwordBytes && Buffer.from(value, 'utf8').toString('utf8') === value;
const newPasswordValid = (value: unknown): value is string => passwordValid(value) && value.length >= 12;
const actions = Object.freeze({READ: 'synthetic:read', WRITE: 'synthetic:write', HUMAN_APPROVE: 'synthetic:human-approve'} as const);

/** No environment variable, normal server import or production store adapter enables this pilot. */
export async function createAuthPilot(options: Options = {}): Promise<{enabled: false} | AuthPilot> {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype || Object.keys(options).some(key => !['enabled', 'mode', 'clock'].includes(key)) || options.enabled !== undefined && typeof options.enabled !== 'boolean') throw Error('AUTH_PILOT_OPTIONS_INVALID');
  if (options.enabled !== true) {
    if (Object.keys(options).some(key => key !== 'enabled')) throw Error('AUTH_PILOT_OPTIONS_INVALID');
    return {enabled: false};
  }
  if (options.mode !== 'DISCONNECTED_SYNTHETIC' || options.clock !== undefined && typeof options.clock !== 'function') throw Error('AUTH_PILOT_OPTIONS_INVALID');
  const [{PrivateSyntheticStore}, {BoundedVerifier}, {SyntheticSessions, sessionDigest}, argon, {createRequire}] = await Promise.all([
    import('../syntheticFoundations/privateStore.ts'), import('../syntheticFoundations/boundedVerifier.ts'), import('../syntheticFoundations/sessions.ts'), import('argon2'), import('node:module'),
  ]);
  if (createRequire(import.meta.url)('argon2/package.json').version !== '0.45.1') throw Error('AUTH_PILOT_DEPENDENCY_MISMATCH');
  const verifier: BoundedVerifier = new BoundedVerifier(argon.default ?? argon);
  const dummy = await verifier.hash(randomBytes(32).toString('base64url'));
  const store: PrivateSyntheticStore = await PrivateSyntheticStore.create();
  const clock = options.clock ?? Date.now;
  const sessions: SyntheticSessions = new SyntheticSessions(store, clock);
  const secret = randomBytes(32);
  const handles = new WeakMap<ResourceHandle, string>();
  let closed = false, highWater = 0, globalWindow = 0, globalCount = 0;
  const attempts = new Map<string, {start: number; count: number}>();
  function now(): number | null {
    const value = clock();
    if (!Number.isSafeInteger(value) || value < highWater || value < 0 || value > Number.MAX_SAFE_INTEGER - 1_800_000) return null;
    highWater = value; return value;
  }
  function admit(principalId: string): boolean {
    const time = now(); if (time === null || closed) return false;
    if (time - globalWindow >= AUTH_PILOT_BOUNDS.windowMs) { globalWindow = time; globalCount = 0; }
    if (++globalCount > AUTH_PILOT_BOUNDS.globalAttempts) return false;
    for (const [key, state] of attempts) if (time - state.start >= AUTH_PILOT_BOUNDS.windowMs) attempts.delete(key);
    const key = createHmac('sha256', secret).update('attempt\0' + principalId).digest('hex');
    let state = attempts.get(key);
    if (!state) {
      if (attempts.size >= AUTH_PILOT_BOUNDS.throttleKeys) return false;
      state = {start: time, count: 0}; attempts.set(key, state);
    }
    return ++state.count <= AUTH_PILOT_BOUNDS.principalAttempts;
  }
  const csrf = (token: unknown) => !closed && sessionDigest(token) ? createHmac('sha256', secret).update('csrf\0' + token).digest('base64url') : null;
  const verifyCsrf = (token: unknown, proof: unknown) => {
    const expected = csrf(token);
    return !!expected && typeof proof === 'string' && /^[A-Za-z0-9_-]{43}$/.test(proof) && timingSafeEqual(Buffer.from(expected), Buffer.from(proof));
  };
  const requireOpen = () => { if (closed) throw Error('AUTH_PILOT_UNAVAILABLE'); };
  const requireId = (id: unknown) => { if (!idValid(id)) throw Error('AUTH_PILOT_FIXTURE_INVALID'); };
  const hashNew = async (password: unknown) => { if (!newPasswordValid(password)) throw Error('AUTH_PILOT_PASSWORD_INVALID'); return verifier.hash(password); };
  const deny: Decision = {allowed: false, reason: 'AUTHORITY_UNAVAILABLE'};
  return {
    enabled: true,
    async login(input) {
      if (closed || !input || Object.getPrototypeOf(input) !== Object.prototype || Object.keys(input).sort().join(',') !== 'password,principalId') return {authenticated: false, limited: false};
      const credentials = input as Record<string, unknown>;
      if (!idValid(credentials.principalId) || !passwordValid(credentials.password)) return {authenticated: false, limited: false};
      if (!admit(credentials.principalId)) return {authenticated: false, limited: true};
      try {
        const record = await store.execute({command: 'getCredential', principalId: credentials.principalId});
        const eligible = record?.kind === 'HUMAN' && !record.disabled;
        const valid = await verifier.verify(eligible ? record.verifier : dummy, credentials.password);
        if (!valid || !eligible || closed || now() === null) {
          await store.execute({command: 'recordAuthFailure', now: highWater});
          return {authenticated: false, limited: false};
        }
        // Revision/generation CAS and SESSION_ISSUED audit share one SQLite transaction.
        const token = await sessions.issue(record.id, {credentialRevision: record.credentialRevision, generation: record.generation});
        if (closed) return {authenticated: false, limited: false};
        return {authenticated: true, token, csrf: csrf(token)!};
      } catch { return {authenticated: false, limited: false}; }
    },
    async session(token) { return !closed && now() !== null ? sessions.accept(token) : null; },
    csrf, verifyCsrf,
    async rotate(token, proof) {
      if (!verifyCsrf(token, proof) || now() === null) return null;
      const replacement = await sessions.rotate(token); return replacement ? {token: replacement, csrf: csrf(replacement)!} : null;
    },
    async logout(token, proof) {
      if (!verifyCsrf(token, proof) || now() === null) return false;
      try { return await sessions.revoke(token); } catch { return false; }
    },
    async changePassword(token, proof, current, replacement) {
      if (!verifyCsrf(token, proof) || !passwordValid(current) || !newPasswordValid(replacement) || now() === null) return false;
      try {
        const session = await sessions.accept(token); if (!session || session.kind !== 'HUMAN' || !admit(session.principalId)) return false;
        const record = await store.execute({command: 'getCredential', principalId: session.principalId});
        if (!record || !await verifier.verify(record.verifier, current)) return false;
        const hash = await verifier.hash(replacement);
        if (closed || now() === null) return false;
        return await store.execute({command: 'changeOwnCredential', digest: sessionDigest(token)!, verifier: hash, expectedCredentialRevision: record.credentialRevision, now: highWater});
      } catch { return false; }
    },
    async authorize(token, capability, resource) {
      const digest = sessionDigest(token), resourceId = handles.get(resource);
      if (closed || now() === null || !digest || !resourceId || !Object.hasOwn(actions, capability)) return deny;
      try { return await store.execute({command: 'authorize', digest, action: actions[capability], resourceId, now: highWater}); }
      catch { return deny; }
    },
    async close() { closed = true; secret.fill(0); attempts.clear(); await store.close(); },
    fixtures: {
      rootDirectory: store.rootDirectory,
      async createHuman(id, password) { requireOpen(); requireId(id); const hash = await hashNew(password); requireOpen(); await store.execute({command: 'createPrincipal', id, kind: 'HUMAN', verifier: hash}); },
      async createAgent(id) { requireOpen(); requireId(id); await store.execute({command: 'createPrincipal', id, kind: 'AGENT'}); },
      async resource(id) { requireOpen(); requireId(id); await store.execute({command: 'registerResource', id}); const handle: ResourceHandle = Object.freeze({kind: 'DISCONNECTED_RESOURCE'}); handles.set(handle, id); return handle; },
      async rule(id, capability, resource, effect) { requireOpen(); requireId(id); const resourceId = handles.get(resource); if (!resourceId || !Object.hasOwn(actions, capability) || !['ALLOW', 'DENY'].includes(effect)) throw Error('AUTH_PILOT_FIXTURE_INVALID'); await store.execute({command: 'setRule', principalId: id, action: actions[capability], resourceId, effect}); },
      async reset(id, password) { requireOpen(); requireId(id); const hash = await hashNew(password); requireOpen(); await store.execute({command: 'resetCredential', principalId: id, verifier: hash}); },
      async disable(id) { requireOpen(); requireId(id); await store.execute({command: 'disablePrincipal', principalId: id}); },
      async restart() { requireOpen(); await store.restart(); },
      async terminate() { requireOpen(); await store.terminate(); },
      audit: () => store.execute({command: 'audit'}), snapshot: () => store.execute({command: 'snapshot'}), provenance: () => store.execute({command: 'info'}),
    },
  };
}
