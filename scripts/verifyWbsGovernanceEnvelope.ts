/**
 * OFFLINE contract verification only. All anchors/people/clocks are supplied
 * synthetic assertions, never production acquisition or authorization.
 * No filesystem, network, environment, enrollment, consumption or apply API.
 */
import crypto from 'node:crypto';
import { policyDigestV2, type TrustedPolicyV2 } from './verifyTrustedWbsRegistrationV2.ts';

export const OFFLINE_ENVELOPE_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, depth: 64,
  clockWindowMs: 60_000, checkpointWindowMs: 300_000, uncertaintyMs: 2_000 });
const DOMAIN = 'DOCMONSTAKRAKIN/WBS_GOVERNANCE_ENVELOPE/1.0';
const CLOCK_DOMAIN = 'DOCMONSTAKRAKIN/WBS_GOVERNANCE_CLOCK/1.0';
const CHECKPOINT_DOMAIN = 'DOCMONSTAKRAKIN/WBS_GOVERNANCE_CHECKPOINT/1.0';
const GOVERNANCE_ROLES = ['Security Officer', 'Lead Architect', 'Independent Human Approver'];
const HASH = /^[0-9a-f]{64}$/, GIT = /^[0-9a-f]{40}$/, ID = /^[A-Za-z0-9._:-]{1,128}$/;
const B64 = /^[A-Za-z0-9+/]{86}==$/;
type ObjectData = Record<string, any>;
export interface OfflineGovernanceResult {
  valid: boolean;
  mode: 'OFFLINE_CONTRACT_VERIFIED' | 'REJECTED';
  mayApply: false;
  operationalAuthority: false;
  errors: string[];
  envelopeSha256?: string;
}
function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const sha = (raw: Buffer | string) => crypto.createHash('sha256').update(raw).digest('hex');
function object(v: unknown, keys: readonly string[], label: string): asserts v is ObjectData {
  requireThat(v && typeof v === 'object' && !Array.isArray(v), label + ' object missing');
  const own = Object.keys(v);
  requireThat(own.length === keys.length && keys.every(k => own.includes(k)), label + ' exact keys required');
}
function token(v: unknown, label: string) { requireThat(typeof v === 'string' && ID.test(v), 'Invalid ' + label); }
function positive(v: unknown, label: string) { requireThat(Number.isSafeInteger(v) && (v as number) > 0, 'Invalid ' + label); }
function instant(v: unknown): number {
  requireThat(typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v), 'Invalid precise UTC time');
  const n = Date.parse(v); requireThat(Number.isFinite(n) && new Date(n).toISOString() === v, 'Invalid UTC time'); return n;
}

/** Bounded inert JSON only. Helpers throw; the verifier catches all failures. */
export function canonicalGovernanceJson(input: unknown): string {
  let used = 0;
  const active = new Set<object>();
  const add = (s: string) => { used += Buffer.byteLength(s); requireThat(used <= OFFLINE_ENVELOPE_LIMITS.bytes, 'JSON byte budget exceeded'); return s; };
  const string = (s: string) => { requireThat(s.length <= OFFLINE_ENVELOPE_LIMITS.bytes, 'JSON string size exceeds budget'); return add(JSON.stringify(s)); };
  const visit = (v: unknown, depth: number): string => {
    if (v === null) return add('null');
    if (typeof v === 'string') return string(v);
    if (typeof v === 'boolean') return add(v ? 'true' : 'false');
    if (typeof v === 'number') { requireThat(Number.isFinite(v), 'Nonfinite JSON number'); return add(JSON.stringify(v)); }
    requireThat(v && typeof v === 'object', 'Non-JSON value');
    requireThat(depth < OFFLINE_ENVELOPE_LIMITS.depth, 'JSON depth exceeds candidate limit');
    requireThat(!active.has(v), 'Cyclic JSON property');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    requireThat(array || proto === Object.prototype || proto === null, 'Non-plain inert JSON required');
    requireThat(Object.getOwnPropertySymbols(v).length === 0, 'Symbol JSON property');
    active.add(v);
    const names = Object.getOwnPropertyNames(v).filter(k => !array || k !== 'length');
    if (!array) names.sort();
    const parts: string[] = [add(array ? '[' : '{')];
    names.forEach((key, index) => {
      requireThat(!['__proto__', 'prototype', 'constructor', 'toJSON'].includes(key), 'Unsafe JSON key');
      const d = Object.getOwnPropertyDescriptor(v, key)!;
      requireThat('value' in d && d.enumerable, 'Accessor or hidden property; inert data required');
      if (array) requireThat(key === String(index), 'Non-JSON array property');
      if (index) parts.push(add(','));
      if (!array) parts.push(string(key), add(':'));
      parts.push(visit(d.value, depth + 1));
    });
    if (array) requireThat(names.length === v.length, 'Sparse JSON array');
    parts.push(add(array ? ']' : '}')); active.delete(v); return parts.join('');
  };
  return visit(input, 0);
}
const signingBytes = (domain: string, payload: unknown) => Buffer.from(domain + '\n' + canonicalGovernanceJson(payload), 'utf8');
export const governanceEnvelopeSigningBytes = (payload: unknown) => signingBytes(DOMAIN, payload);
export const clockObservationSigningBytes = (payload: unknown) => signingBytes(CLOCK_DOMAIN, payload);
export const checkpointSigningBytes = (payload: unknown) => signingBytes(CHECKPOINT_DOMAIN, payload);
export const governanceEnvelopeBytes = (document: unknown) => Buffer.from(canonicalGovernanceJson(document), 'utf8');

/** Detect duplicate decoded keys and depth BEFORE constructing the JSON object. */
function rawJson(raw: Buffer): ObjectData {
  requireThat(Buffer.isBuffer(raw), 'Raw envelope bytes missing');
  requireThat(raw.length <= OFFLINE_ENVELOPE_LIMITS.bytes, 'Raw envelope exceeds candidate limit');
  const s = raw.toString('utf8');
  requireThat(Buffer.from(s).equals(raw) && !s.startsWith('\ufeff'), 'Invalid UTF-8 or BOM');
  let i = 0;
  const white = () => { while (i < s.length && /[\x20\x09\x0a\x0d]/.test(s[i])) i++; };
  const quoted = (): string => {
    requireThat(s[i] === '"', 'Expected JSON string'); const start = i++;
    while (i < s.length) {
      if (s[i] === '"') { i++; return s.slice(start, i); }
      requireThat(s.charCodeAt(i) >= 32, 'Invalid JSON control character');
      i += s[i] === '\\' ? 2 : 1;
    }
    throw new Error('Incomplete JSON string');
  };
  const primitive = /(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  const walk = (depth: number): void => {
    white(); const c = s[i];
    if (c === '{' || c === '[') {
      requireThat(depth < OFFLINE_ENVELOPE_LIMITS.depth, 'JSON depth exceeds candidate limit');
      const isObject = c === '{', close = isObject ? '}' : ']', seen = new Set<string>(); i++; white();
      if (s[i] === close) { i++; return; }
      for (;;) {
        if (isObject) {
          white(); const key = JSON.parse(quoted()); requireThat(!seen.has(key), 'Duplicate raw JSON key'); seen.add(key);
          white(); requireThat(s[i++] === ':', 'Missing JSON colon');
        }
        walk(depth + 1); white(); if (s[i] === close) { i++; return; }
        requireThat(s[i++] === ',', 'Malformed JSON framing');
      }
    }
    if (c === '"') { quoted(); return; }
    primitive.lastIndex = i; const match = primitive.exec(s); requireThat(match, 'Invalid JSON primitive'); i = primitive.lastIndex;
  };
  walk(0); white(); requireThat(i === s.length, 'Trailing JSON data');
  const value = JSON.parse(s);
  requireThat(canonicalGovernanceJson(value) === s, 'Raw envelope is not canonical JSON');
  return value;
}

/** Session binding helper, not an authority issuer. No checkpoint/time circularity. */
export function offlineGovernanceInputDigest(raw: Buffer, policy: unknown, context: unknown): string {
  requireThat(Buffer.isBuffer(raw) && raw.length <= OFFLINE_ENVELOPE_LIMITS.bytes, 'Raw envelope exceeds candidate limit');
  const p = JSON.parse(canonicalGovernanceJson(policy));
  const c = JSON.parse(canonicalGovernanceJson(context));
  requireThat(c && typeof c === 'object' && !Array.isArray(c), 'Context object missing');
  delete c.checkpoint; delete c.clockObservation;
  return sha(canonicalGovernanceJson({ envelopeSha256: sha(raw), policySha256: policyDigestV2(p), context: c }));
}
const EXPECTED = ['repository', 'repositoryId', 'ownerId', 'projectId', 'operation', 'profileId',
  'classificationRulesSha256', 'personRegistrySha256', 'policyId', 'policyVersion', 'policySha256',
  'revocationStateSha256', 'verifierCommitSha', 'workflowCommitSha', 'ratificationEvidenceSha256'];
const PAYLOAD = ['schemaVersion', ...EXPECTED, 'rootId', 'rootVersion', 'envelopeId', 'authorityEpoch',
  'previousEnvelopeSha256', 'effectiveNotBefore', 'effectiveNotAfter', 'requiredRoles', 'revocationSequence'];
const CONTEXT = ['kind', 'expected', 'root', 'registrationPeople', 'witness', 'clock', 'fixedNowIso', 'sessionNonce',
  'minimumAuthorityEpoch', 'minimumRevocationSequence', 'minimumCheckpointSequence', 'minimumClockSequence',
  'consumedEnvelopeIds', 'consumedNonces', 'previous', 'checkpoint', 'clockObservation'];
function publicKey(pem: unknown) {
  requireThat(typeof pem === 'string' && /^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END PUBLIC KEY-----\r?\n?$/.test(pem), 'Only public SPKI PEM keys accepted');
  const key = crypto.createPublicKey(pem); requireThat(key.asymmetricKeyType === 'ed25519', 'Only Ed25519 keys supported');
  return { key, fingerprint: sha(key.export({ format: 'der', type: 'spki' }) as Buffer) };
}
function signature(value: unknown, bytes: Buffer, key: crypto.KeyObject, label: string) {
  requireThat(typeof value === 'string' && B64.test(value), label + ' signature Base64 invalid');
  const raw = Buffer.from(value, 'base64');
  requireThat(raw.toString('base64') === value && crypto.verify(null, bytes, key, raw), label + ' signature invalid');
}
function window(from: unknown, to: unknown, lo: number, hi: number, label: string) {
  const a = instant(from), b = instant(to); requireThat(a < b && lo >= a && hi <= b, label + ' validity/uncertainty interval mismatch');
}
function eligibility(v: ObjectData, label: string) {
  requireThat(v.eligible === true && v.conflicted === false && v.custodySeparated === true, label + ' eligibility/conflict/custody rejected');
}
function uniqueStrings(v: unknown, isNonce: boolean): asserts v is string[] {
  requireThat(Array.isArray(v), 'Missing replay state array');
  requireThat(v.every(x => typeof x === 'string' && (isNonce ? HASH.test(x) : ID.test(x))) && new Set(v).size === v.length, 'Invalid or duplicated replay state');
}

/** This is the only verification entry point; no permissive or production mode. */
export function verifyOfflineWbsGovernanceEnvelope(raw: unknown, policyInput: unknown, contextInput: unknown): OfflineGovernanceResult {
  const r: OfflineGovernanceResult = { valid: false, mode: 'REJECTED', mayApply: false, operationalAuthority: false, errors: [] };
  try {
    const doc = rawJson(raw as Buffer); object(doc, ['payload', 'signatures'], 'Envelope');
    const p = doc.payload; object(p, PAYLOAD, 'Payload'); requireThat(p.schemaVersion === '1.0', 'Unsupported envelope schema');
    const policy = JSON.parse(canonicalGovernanceJson(policyInput)) as TrustedPolicyV2;
    const c = JSON.parse(canonicalGovernanceJson(contextInput)); object(c, CONTEXT, 'Context');
    requireThat(c.kind === 'SYNTHETIC_OFFLINE', 'Only synthetic offline context supported');
    object(c.expected, EXPECTED, 'Expected binding');
    for (const name of EXPECTED) requireThat(typeof p[name] === 'string' && p[name] === c.expected[name], 'Expected binding mismatch: ' + name);
    requireThat(p.repository === 'Jeruzael/docmonstakrakin' && p.projectId === 'PRJ-DOCMONSTAKRAKIN' && p.operation === 'ADD_WBS_ITEMS', 'Wrong repository/project/operation');
    requireThat(/^[1-9]\d*$/.test(p.repositoryId) && /^[1-9]\d*$/.test(p.ownerId), 'Invalid immutable repository/owner IDs');
    const registrationRoles = p.profileId === 'ORDINARY' ? GOVERNANCE_ROLES.slice(0, 2) : p.profileId === 'ELEVATED' ? GOVERNANCE_ROLES : undefined;
    requireThat(registrationRoles, 'Unknown profile');
    requireThat(JSON.stringify(p.requiredRoles) === JSON.stringify(registrationRoles), 'Profile required roles mismatch');
    for (const name of ['classificationRulesSha256', 'personRegistrySha256', 'policySha256', 'revocationStateSha256', 'ratificationEvidenceSha256', 'previousEnvelopeSha256'])
      requireThat(typeof p[name] === 'string' && HASH.test(p[name]), 'Invalid digest: ' + name);
    for (const name of ['verifierCommitSha', 'workflowCommitSha']) requireThat(GIT.test(p[name]), 'Invalid Git identity: ' + name);
    for (const name of ['rootId', 'envelopeId', 'policyId', 'policyVersion']) token(p[name], name);
    for (const name of ['rootVersion', 'authorityEpoch', 'revocationSequence']) positive(p[name], name);
    for (const name of ['minimumAuthorityEpoch', 'minimumRevocationSequence', 'minimumCheckpointSequence', 'minimumClockSequence']) positive(c[name], name);
    requireThat(p.authorityEpoch >= c.minimumAuthorityEpoch, 'Authority epoch rollback');
    requireThat(p.revocationSequence >= c.minimumRevocationSequence, 'Revocation sequence rollback');
    requireThat(typeof c.sessionNonce === 'string' && HASH.test(c.sessionNonce), 'Invalid session nonce');
    uniqueStrings(c.consumedEnvelopeIds, false); uniqueStrings(c.consumedNonces, true);
    requireThat(!c.consumedEnvelopeIds.includes(p.envelopeId) && !c.consumedNonces.includes(c.sessionNonce), 'Consumed envelope/session replay');

    object(c.root, ['rootId', 'rootVersion', 'keys'], 'Root');
    requireThat(c.root.rootId === p.rootId && c.root.rootVersion === p.rootVersion, 'Independent root binding mismatch');
    if (c.previous === null) {
      requireThat(p.authorityEpoch === 1 && p.rootVersion === 1 && p.previousEnvelopeSha256 === '0'.repeat(64), 'Invalid genesis epoch/root/predecessor');
    } else {
      const prev = c.previous;
      object(prev, ['envelopeSha256', 'authorityEpoch', 'policySha256', 'policyVersion', 'revocationSequence', 'rootId', 'rootVersion'], 'Predecessor');
      positive(prev.authorityEpoch, 'previous epoch'); positive(prev.revocationSequence, 'previous revocation sequence');
      requireThat(typeof prev.envelopeSha256 === 'string' && HASH.test(prev.envelopeSha256) &&
        typeof prev.policySha256 === 'string' && HASH.test(prev.policySha256), 'Invalid predecessor digest');
      token(prev.policyVersion, 'previous policy version');
      requireThat(prev.rootId === p.rootId && prev.rootVersion === p.rootVersion, 'Root rotation unsupported; new-root-only evidence rejected');
      requireThat(p.previousEnvelopeSha256 === prev.envelopeSha256 && p.authorityEpoch === prev.authorityEpoch + 1, 'Disconnected/reordered authority epoch');
      requireThat(p.policySha256 !== prev.policySha256 && p.policyVersion !== prev.policyVersion, 'Advanced epoch reuses immutable policy digest/version');
      requireThat(p.revocationSequence >= prev.revocationSequence, 'Predecessor revocation rollback');
    }

    const binding = offlineGovernanceInputDigest(raw as Buffer, policy, c);
    object(c.clock, ['keyId', 'publicKeyPem'], 'Clock'); token(c.clock.keyId, 'clock key ID');
    const clockKey = publicKey(c.clock.publicKeyPem);
    object(c.clockObservation, ['payload', 'signatureBase64'], 'Clock observation'); const clock = c.clockObservation.payload;
    object(clock, ['schemaVersion', 'sessionNonce', 'inputsSha256', 'nowIso', 'validUntilIso', 'uncertaintyMs', 'sequence'], 'Clock payload');
    requireThat(clock.schemaVersion === '1.0' && clock.sessionNonce === c.sessionNonce && clock.inputsSha256 === binding, 'Clock binding mismatch');
    signature(c.clockObservation.signatureBase64, clockObservationSigningBytes(clock), clockKey.key, 'Clock');
    positive(clock.sequence, 'clock sequence'); requireThat(clock.sequence >= c.minimumClockSequence, 'Clock sequence rollback');
    requireThat(Number.isSafeInteger(clock.uncertaintyMs) && clock.uncertaintyMs >= 0 && clock.uncertaintyMs <= OFFLINE_ENVELOPE_LIMITS.uncertaintyMs, 'Clock uncertainty exceeds candidate limit');
    const now = instant(c.fixedNowIso), lo = now - clock.uncertaintyMs, hi = now + clock.uncertaintyMs;
    requireThat(instant(clock.validUntilIso) - instant(clock.nowIso) <= OFFLINE_ENVELOPE_LIMITS.clockWindowMs, 'Clock observation window exceeds candidate limit');
    window(clock.nowIso, clock.validUntilIso, lo, hi, 'Clock');
    window(p.effectiveNotBefore, p.effectiveNotAfter, lo, hi, 'Envelope');

    requireThat(Array.isArray(c.root.keys) && c.root.keys.length === 3, 'Three-human governance quorum required');
    const roots = new Map<string, { data: ObjectData; key: crypto.KeyObject; fingerprint: string }>();
    const people = new Set<string>(), principals = new Set<string>(), rootRoles = new Set<string>(), purposes = new Set<string>();
    for (const k of c.root.keys) {
      object(k, ['principalId', 'personId', 'role', 'keyId', 'publicKeyPem', 'revoked', 'eligible', 'conflicted', 'custodySeparated', 'validNotBefore', 'validNotAfter'], 'Governance key');
      for (const name of ['principalId', 'personId', 'keyId']) token(k[name], name);
      requireThat(GOVERNANCE_ROLES.includes(k.role) && !rootRoles.has(k.role), 'Invalid/repeated governance role');
      requireThat(!people.has(k.personId) && !principals.has(k.principalId), 'Governance person independence mismatch');
      eligibility(k, 'Governance'); requireThat(k.revoked === false, 'Revoked governance key');
      window(k.validNotBefore, k.validNotAfter, lo, hi, 'Governance key');
      const pub = publicKey(k.publicKeyPem);
      requireThat(!roots.has(k.keyId) && !purposes.has(pub.fingerprint), 'Duplicate governance key/fingerprint');
      roots.set(k.keyId, { data: k, ...pub }); purposes.add(pub.fingerprint); people.add(k.personId); principals.add(k.principalId); rootRoles.add(k.role);
    }
    object(c.witness, ['keyId', 'personId', 'publicKeyPem'], 'Witness'); token(c.witness.keyId, 'witness key'); token(c.witness.personId, 'witness person');
    requireThat(!people.has(c.witness.personId), 'Witness is not independent of governance');
    const witness = publicKey(c.witness.publicKeyPem);
    requireThat(!purposes.has(witness.fingerprint) && !purposes.has(clockKey.fingerprint) && witness.fingerprint !== clockKey.fingerprint, 'Witness/clock key purpose separation mismatch');
    purposes.add(witness.fingerprint); purposes.add(clockKey.fingerprint);

    object(policy, ['schemaVersion', 'policyId', 'policyVersion', 'requiredRoles', 'humanKeys'], 'V2 policy');
    requireThat(policy.schemaVersion === '2.0' && policy.policyId === p.policyId && policy.policyVersion === p.policyVersion && policyDigestV2(policy) === p.policySha256, 'V2 policy binding mismatch');
    requireThat(JSON.stringify(policy.requiredRoles) === JSON.stringify(registrationRoles), 'V2 profile roles mismatch');
    requireThat(Array.isArray(policy.humanKeys) && policy.humanKeys.length === registrationRoles.length, 'Exactly one active registration key per required role');
    requireThat(Array.isArray(c.registrationPeople) && c.registrationPeople.length === registrationRoles.length, 'Registration person mapping missing');
    const regPeople = new Set<string>(), regPrincipals = new Set<string>(), regRoles = new Set<string>(), regIds = new Set<string>();
    for (const person of c.registrationPeople) {
      object(person, ['principalId', 'personId', 'eligible', 'conflicted', 'custodySeparated'], 'Registration person');
      token(person.principalId, 'registration principal'); token(person.personId, 'registration person'); eligibility(person, 'Registration');
      requireThat(!regPeople.has(person.personId) && !regPrincipals.has(person.principalId), 'Registration person independence mismatch');
      regPeople.add(person.personId); regPrincipals.add(person.principalId);
    }
    const usedRegistrationPrincipals = new Set<string>();
    for (const k of policy.humanKeys) {
      object(k, ['principalId', 'role', 'keyId', 'kind', 'publicKeyPem', 'revoked', 'validNotBefore', 'validNotAfter'], 'Registration key');
      token(k.principalId, 'registration principal'); token(k.keyId, 'registration key ID');
      requireThat(k.kind === 'HUMAN' && k.revoked === false, 'Registration key revoked/ineligible');
      requireThat(registrationRoles.includes(k.role) && !regRoles.has(k.role) && !regIds.has(k.keyId), 'Invalid/duplicated registration role/key');
      requireThat(regPrincipals.has(k.principalId), 'Missing registration person mapping');
      requireThat(!usedRegistrationPrincipals.has(k.principalId), 'Registration principal repeated across roles');
      usedRegistrationPrincipals.add(k.principalId);
      window(k.validNotBefore, k.validNotAfter, lo, hi, 'Registration key');
      const key = publicKey(k.publicKeyPem); requireThat(!purposes.has(key.fingerprint), 'Registration key purpose/independence mismatch');
      purposes.add(key.fingerprint); regRoles.add(k.role); regIds.add(k.keyId);
    }
    requireThat(Array.isArray(doc.signatures) && doc.signatures.length === 3, 'Exactly three governance signatures required');
    const signedRoles = new Set<string>();
    for (const s of doc.signatures) {
      object(s, ['principalId', 'role', 'keyId', 'signatureBase64'], 'Governance signature');
      const root = roots.get(s.keyId);
      requireThat(root && s.principalId === root.data.principalId && s.role === root.data.role && !signedRoles.has(s.role), 'Governance signature principal/role mismatch');
      signature(s.signatureBase64, governanceEnvelopeSigningBytes(p), root.key, 'Governance'); signedRoles.add(s.role);
    }
    object(c.checkpoint, ['payload', 'signatureBase64'], 'Checkpoint'); const checkpoint = c.checkpoint.payload;
    object(checkpoint, ['schemaVersion', 'sessionNonce', 'inputsSha256', 'envelopeSha256', 'authorityEpoch', 'revocationSequence', 'sequence', 'observedAt', 'validUntilIso'], 'Checkpoint payload');
    requireThat(checkpoint.schemaVersion === '1.0' && checkpoint.sessionNonce === c.sessionNonce && checkpoint.inputsSha256 === binding && checkpoint.envelopeSha256 === sha(raw as Buffer), 'Checkpoint binding mismatch');
    requireThat(checkpoint.authorityEpoch === p.authorityEpoch && checkpoint.revocationSequence === p.revocationSequence, 'Checkpoint authority epoch/revocation mismatch');
    positive(checkpoint.sequence, 'checkpoint sequence'); requireThat(checkpoint.sequence >= c.minimumCheckpointSequence, 'Checkpoint sequence rollback');
    requireThat(instant(checkpoint.validUntilIso) - instant(checkpoint.observedAt) <= OFFLINE_ENVELOPE_LIMITS.checkpointWindowMs, 'Checkpoint validity window exceeds candidate limit');
    window(checkpoint.observedAt, checkpoint.validUntilIso, lo, hi, 'Checkpoint');
    signature(c.checkpoint.signatureBase64, checkpointSigningBytes(checkpoint), witness.key, 'Witness');
    r.valid = true; r.mode = 'OFFLINE_CONTRACT_VERIFIED'; r.envelopeSha256 = sha(raw as Buffer);
  } catch (e) { r.errors.push(e instanceof Error ? e.message : 'Invalid offline proof'); }
  return r;
}
