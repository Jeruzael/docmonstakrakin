/** Ephemeral synthetic custody only. No production root, identity or path acquisition. */
import {createHash, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject} from 'node:crypto';

export const TEST_RECOVERY_LIMITS = Object.freeze({proofBytes: 8192, pathCharacters: 2048, lifetimeMs: 60_000, consumedReceipts: 128, sealWaitMs: 2000});
const PROFILE = 'DISCONNECTED_TEST_STORE_TRANSFER_V1';
const DOMAIN = 'DOCMONSTAKRAKIN/TEST_AUTH_STORE_TRANSFER/1\0';
const fields = ['profile', 'rootDirectory', 'parentDirectory', 'rootIdentity', 'parentIdentity', 'owner', 'rootKeySha256', 'nonce', 'fromGeneration', 'issuedAt', 'expiresAt'] as const;
export type TestTransferPayload = Record<typeof fields[number], string>;
export type TestRoot = {publicDer: Buffer; fingerprint: string; seal(payload: TestTransferPayload): Buffer | Promise<Buffer>};
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export const testTransferDigest = (nonce: string) => sha('DOCMONSTAKRAKIN/TEST_AUTH_STORE_NONCE/1\0' + nonce);
const canonical = (data: TestTransferPayload) => JSON.stringify(Object.fromEntries(fields.map(key => [key, data[key]])));
function invalid(): never { throw Error('TEST_RECOVERY_PROOF_INVALID'); }
function key(bytes: Buffer): KeyObject {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 44) invalid();
  const result = createPublicKey({key: bytes, format: 'der', type: 'spki'});
  if (result.asymmetricKeyType !== 'ed25519' || !result.export({format: 'der', type: 'spki'}).equals(bytes)) invalid();
  return result;
}
export function testRootFingerprint(publicDer: Buffer) { key(publicDer); return sha(publicDer); }
function validate(data: TestTransferPayload, fingerprint: string, now: number) {
  if (Object.keys(data).sort().join(',') !== [...fields].sort().join(',') || Object.values(data).some(value => typeof value !== 'string' || value.length > TEST_RECOVERY_LIMITS.pathCharacters || Buffer.from(value, 'utf8').toString('utf8') !== value)) invalid();
  if (data.profile !== PROFILE || data.rootKeySha256 !== fingerprint || ![data.owner, data.rootKeySha256, data.nonce].every(value => /^[a-f0-9]{64}$/.test(value)) || ![data.rootIdentity, data.parentIdentity].every(value => /^\d+:\d+$/.test(value))) invalid();
  for (const field of ['fromGeneration', 'issuedAt', 'expiresAt'] as const) if (!/^[1-9]\d{0,15}$/.test(data[field]) || !Number.isSafeInteger(Number(data[field]))) invalid();
  const issued = Number(data.issuedAt), expires = Number(data.expiresAt);
  if (!Number.isSafeInteger(now) || now < issued || now >= expires || expires - issued !== TEST_RECOVERY_LIMITS.lifetimeMs) invalid();
}
export function createTestRecoveryRoot(): TestRoot {
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const publicDer = publicKey.export({format: 'der', type: 'spki'}), fingerprint = sha(publicDer);
  return {publicDer, fingerprint, seal(payload) {
    validate(payload, fingerprint, Number(payload.issuedAt));
    const signature = sign(null, Buffer.from(DOMAIN + canonical(payload)), privateKey).toString('base64url');
    const raw = Buffer.from(JSON.stringify({...Object.fromEntries(fields.map(field => [field, payload[field]])), signature}));
    if (raw.length > TEST_RECOVERY_LIMITS.proofBytes) invalid();
    return raw;
  }};
}
export function verifyTestTransfer(raw: Buffer, trustedPublicDer: Buffer, now: number): TestTransferPayload {
  try {
    const publicKey = key(trustedPublicDer), fingerprint = sha(trustedPublicDer);
    if (!Buffer.isBuffer(raw) || raw.length > TEST_RECOVERY_LIMITS.proofBytes) invalid();
    const text = raw.toString('utf8'); if (!Buffer.from(text).equals(raw)) invalid();
    const value = JSON.parse(text);
    if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join(',') !== [...fields, 'signature'].sort().join(',')) invalid();
    const {signature, ...payload} = value;
    validate(payload, fingerprint, now);
    if (typeof signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(signature)) invalid();
    const decoded = Buffer.from(signature, 'base64url');
    if (decoded.length !== 64 || decoded.toString('base64url') !== signature || text !== JSON.stringify({...Object.fromEntries(fields.map(field => [field, payload[field]])), signature}) || !verify(null, Buffer.from(DOMAIN + canonical(payload)), publicKey, decoded)) invalid();
    // Exact canonical byte equality rejects duplicate/escaped keys, alternate
    // order and extra whitespace without recursive attacker-controlled walks.
    return Object.freeze(payload);
  } catch { invalid(); }
}
export function testTransferPayload(input: Omit<TestTransferPayload, 'profile'>): TestTransferPayload { return {profile: PROFILE, ...input}; }
