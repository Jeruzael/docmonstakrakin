/**
 * Stage B2a: strictly read-only and context-bound WBS registration evidence.
 *
 * CAUTION: A matching policy hash is only a security anchor if the expected
 * hash comes from an independent, already trusted channel. The calling layer
 * MUST authenticate Git provenance, time, approver enrollment and replay state.
 *
 * The result is EVIDENCE_VERIFIED, not authorization to apply a WBS mutation.
 * Historical v1 receipt schemas and verifiers are intentionally unchanged.
 */
import crypto from 'node:crypto';
import {
  validateWbsRegistration,
  type RegistrationManifest,
} from './verifyWbsRegistration.ts';

export interface ReviewedGitContextV2 {
  repository: string;
  pullRequestNumber: number;
  baseCommitSha: string;
  reviewedHeadCommitSha: string;
  reviewedHeadTreeSha: string;
}
export interface RegistrationIntentV2 {
  schemaVersion: '2.0';
  projectId: 'PRJ-DOCMONSTAKRAKIN';
  operation: 'ADD_WBS_ITEMS';
  receiptId: string;
  preWbsSha256: string;
  postWbsSha256: string;
  approvedItems: Record<string, unknown>[];
  policyId: string;
  policyVersion: string;
  policySha256: string;
  notBefore: string;
  notAfter: string;
  git: ReviewedGitContextV2;
}
export interface HumanKeyV2 {
  principalId: string;
  role: string;
  keyId: string;
  kind: 'HUMAN';
  publicKeyPem: string;
  revoked: boolean;
  validNotBefore: string;
  validNotAfter: string;
}
export interface TrustedPolicyV2 {
  schemaVersion: '2.0';
  policyId: string;
  policyVersion: string;
  requiredRoles: string[];
  humanKeys: HumanKeyV2[];
}
export interface ApprovalSignatureV2 {
  principalId: string;
  role: string;
  keyId: string;
  kind: 'HUMAN';
  signatureBase64: string;
}
export interface SignedReceiptV2 {
  intent: RegistrationIntentV2;
  signatures: ApprovalSignatureV2[];
}
export interface TrustedVerificationContextV2 {
  /** Must be independently pinned; NEVER take from the signed receipt or PR. */
  pinnedPolicySha256: string;
  /** Must be independently retrieved from a trusted Git provider/host. */
  expectedGit: ReviewedGitContextV2;
  /** Must be read from a trusted clock, not user-controlled signed input. */
  nowIso: string;
  /**
   * Must be an authoritative, integrity-protected ledger snapshot.
   * Pure verification is NOT an atomic consume/commit transaction.
   */
  consumedReceiptIds: readonly string[];
}
export interface TrustedWbsVerificationResultV2 {
  valid: boolean;
  mode: 'EVIDENCE_VERIFIED' | 'REJECTED';
  errors: string[];
  /** Evidence verification never grants human or runtime mutation authority. */
  mayApply: false;
  policySha256: string;
}
const SHA256 = /^[0-9a-f]{64}$/;
const GIT_SHA = /^[0-9a-f]{40}$/;
const RECEIPT_ID = /^[A-Za-z0-9._:-]{12,128}$/;

function sha256(raw: Buffer | string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Nonfinite number in signed evidence');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object' &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const data = value as Record<string, unknown>;
    return '{' + Object.keys(data).sort().map(key => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new Error('Unsafe object key in signed evidence');
      }
      return JSON.stringify(key) + ':' + canonicalJson(data[key]);
    }).join(',') + '}';
  }
  throw new Error('Non-JSON value in signed evidence');
}
function utcMillis(value: string): number {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error('Timestamp must be a precise UTC ISO-8601 string');
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) {
    throw new Error('Invalid ISO-8601 timestamp');
  }
  return millis;
}
function spkiFingerprint(pem: string): string {
  const key = crypto.createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Only Ed25519 human signing keys are allowed');
  return sha256(key.export({format: 'der', type: 'spki'}) as Buffer);
}
export function policyDigestV2(policy: TrustedPolicyV2): string {
  return sha256(Buffer.from(canonicalJson(policy), 'utf8'));
}
export function registrationSigningPayloadV2(intent: RegistrationIntentV2): Buffer {
  return Buffer.from('DOCMONSTAKRAKIN/WBS_REGISTRATION/2.0\n' + canonicalJson(intent), 'utf8');
}
export function verifyTrustedWbsRegistrationV2(input: {
  beforeBytes: Buffer;
  afterBytes: Buffer;
  receipt: SignedReceiptV2;
  policy: TrustedPolicyV2;
  context: TrustedVerificationContextV2;
}): TrustedWbsVerificationResultV2 {
  const errors: string[] = [];
  let policySha256 = '';
  const deny = (message: string) => { errors.push(message); };
  const finish = (): TrustedWbsVerificationResultV2 => ({
    valid: errors.length === 0,
    mode: errors.length === 0 ? 'EVIDENCE_VERIFIED' : 'REJECTED',
    errors, mayApply: false, policySha256,
  });
  if (!input || !Buffer.isBuffer(input.beforeBytes) || !Buffer.isBuffer(input.afterBytes) ||
      !input.receipt || !input.policy || !input.context) {
    return {valid: false, mode: 'REJECTED',
      errors: ['Required bytes, receipt, policy or independent context missing'],
      mayApply: false, policySha256};
  }
  const {intent, signatures} = input.receipt;
  const {policy, context} = input;
  if (!intent || intent.schemaVersion !== '2.0' || intent.projectId !== 'PRJ-DOCMONSTAKRAKIN' ||
      intent.operation !== 'ADD_WBS_ITEMS' || !RECEIPT_ID.test(intent.receiptId || '') ||
      !SHA256.test(intent.preWbsSha256 || '') || !SHA256.test(intent.postWbsSha256 || '') ||
      !SHA256.test(intent.policySha256 || '') ||
      !Array.isArray(intent.approvedItems) || intent.approvedItems.length === 0 ||
      typeof intent.policyId !== 'string' || !intent.policyId ||
      typeof intent.policyVersion !== 'string' || !intent.policyVersion) {
    deny('Invalid v2 registration intent');
    return finish();
  }
  if (!policy || policy.schemaVersion !== '2.0' ||
      policy.policyId !== intent.policyId || policy.policyVersion !== intent.policyVersion ||
      !Array.isArray(policy.requiredRoles) || policy.requiredRoles.length === 0 ||
      policy.requiredRoles.some(x => typeof x !== 'string' || !x) ||
      new Set(policy.requiredRoles).size !== policy.requiredRoles.length ||
      !Array.isArray(policy.humanKeys) || policy.humanKeys.length === 0) {
    deny('Invalid ratified-policy structure or required-role configuration');
    return finish();
  }
  try { policySha256 = policyDigestV2(policy); }
  catch { deny('Policy contains invalid JSON evidence'); return finish(); }
  if (!SHA256.test(context.pinnedPolicySha256 || '') ||
      policySha256 !== context.pinnedPolicySha256 ||
      intent.policySha256 !== policySha256) {
    deny('Policy digest does not match independently pinned trust root and signed intent');
  }
  if (intent.preWbsSha256 !== sha256(input.beforeBytes) ||
      intent.postWbsSha256 !== sha256(input.afterBytes)) {
    deny('Before or after WBS bytes differ from signed intent');
  }
  if (!context.expectedGit || !intent.git ||
      !Number.isSafeInteger(intent.git.pullRequestNumber) || intent.git.pullRequestNumber <= 0 ||
      !GIT_SHA.test(intent.git.baseCommitSha || '') ||
      !GIT_SHA.test(intent.git.reviewedHeadCommitSha || '') ||
      !GIT_SHA.test(intent.git.reviewedHeadTreeSha || '') ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(intent.git.repository || '')) {
    deny('Invalid reviewed Git identity');
  } else {
    try {
      if (canonicalJson(intent.git) !== canonicalJson(context.expectedGit)) {
        deny('Signed Git/PR context does not match independently verified reviewed candidate');
      }
    } catch { deny('Malformed reviewed Git context'); }
  }
  if (!Array.isArray(context.consumedReceiptIds) ||
      context.consumedReceiptIds.includes(intent.receiptId)) {
    deny('Receipt consumption ledger missing or this receipt was already consumed');
  }
  let now = NaN;
  try {
    now = utcMillis(context.nowIso);
    if (now < utcMillis(intent.notBefore) || now > utcMillis(intent.notAfter) ||
        utcMillis(intent.notBefore) >= utcMillis(intent.notAfter)) {
      deny('Approval is not within signed validity interval');
    }
  } catch { deny('Invalid trusted clock or signed approval timestamps'); }
  const preview: RegistrationManifest = {
    schemaVersion: '1.0',
    projectId: intent.projectId,
    operation: intent.operation,
    preWbsSha256: intent.preWbsSha256,
    postWbsSha256: intent.postWbsSha256,
    approvedItems: intent.approvedItems,
    policyId: intent.policyId,
    policyVersion: intent.policyVersion,
  };
  const candidateCheck = validateWbsRegistration({
    beforeBytes: input.beforeBytes, afterBytes: input.afterBytes,
    manifest: preview, decision: 'PREVIEW',
  });
  if (!candidateCheck.valid) errors.push(...candidateCheck.errors);
  const fingerprintByKey = new Map<string, string>();
  const principalByFingerprint = new Map<string, string>();
  const rosterIdentity = new Set<string>();
  const rosterKeyIds = new Set<string>();
  for (const key of policy.humanKeys) {
    if (!key || key.kind !== 'HUMAN' || typeof key.principalId !== 'string' ||
        !key.principalId || typeof key.role !== 'string' || !key.role ||
        typeof key.keyId !== 'string' || !key.keyId ||
        !policy.requiredRoles.includes(key.role) || typeof key.revoked !== 'boolean' ||
        typeof key.publicKeyPem !== 'string' || !key.publicKeyPem) {
      deny('Invalid human signer enrollment record');
      continue;
    }
    try {
      const fingerprint = spkiFingerprint(key.publicKeyPem);
      if (principalByFingerprint.has(fingerprint)) {
        deny('Public signing key reused across enrollment records or principals');
      }
      principalByFingerprint.set(fingerprint, key.principalId);
      if (rosterKeyIds.has(key.keyId)) deny('Duplicate key ID in ratified policy');
      rosterKeyIds.add(key.keyId);
      const tuple = key.principalId + '\0' + key.role;
      if (rosterIdentity.has(tuple)) deny('Duplicate human principal-role enrollment');
      rosterIdentity.add(tuple);
      fingerprintByKey.set(key.keyId, fingerprint);
      if (Number.isFinite(now) &&
          (now < utcMillis(key.validNotBefore) || now > utcMillis(key.validNotAfter) ||
           utcMillis(key.validNotBefore) >= utcMillis(key.validNotAfter))) {
        deny('Human signing key outside authenticated validity period');
      }
    } catch { deny('Invalid Ed25519 signing key or key validity interval'); }
  }
  if (!Array.isArray(signatures) || signatures.length !== policy.requiredRoles.length) {
    deny('Missing or unexpected number of human approval signatures');
    return finish();
  }
  let payload: Buffer;
  try { payload = registrationSigningPayloadV2(intent); }
  catch { deny('Signed manifest has invalid JSON structure'); return finish(); }
  const seenPeople = new Set<string>(), seenRoles = new Set<string>(), seenKeyFingerprints = new Set<string>();
  for (const signature of signatures) {
    if (!signature || signature.kind !== 'HUMAN' ||
        typeof signature.principalId !== 'string' || !signature.principalId ||
        typeof signature.role !== 'string' ||
        typeof signature.keyId !== 'string' || !signature.keyId ||
        typeof signature.signatureBase64 !== 'string' ||
        !policy.requiredRoles.includes(signature.role)) {
      deny('Invalid human signature claim');
      continue;
    }
    if (seenPeople.has(signature.principalId) || seenRoles.has(signature.role)) {
      deny('Human principal or approver role reused');
      continue;
    }
    const key = policy.humanKeys.find(k =>
      k.principalId === signature.principalId && k.keyId === signature.keyId &&
      k.role === signature.role && k.kind === 'HUMAN' && !k.revoked);
    const fingerprint = fingerprintByKey.get(signature.keyId);
    if (!key || !fingerprint || seenKeyFingerprints.has(fingerprint)) {
      deny('Signer key untrusted, revoked or already used');
      continue;
    }
    let matches = false;
    try {
      const raw = Buffer.from(signature.signatureBase64, 'base64');
      matches = raw.length === 64 && crypto.verify(null, payload, key.publicKeyPem, raw);
    } catch { /* fail closed */ }
    if (!matches) {
      deny('Human approval signature invalid');
      continue;
    }
    seenPeople.add(signature.principalId);
    seenRoles.add(signature.role);
    seenKeyFingerprints.add(fingerprint);
  }
  for (const role of policy.requiredRoles) {
    if (!seenRoles.has(role)) deny('Missing authentic signature for required role: ' + role);
  }
  return finish();
}
