/**
 * Forward WBS registration validator.
 *
 * PREVIEW validates an exact, additive canonical WBS change but never grants
 * approval. APPROVED requires independently trusted Ed25519 human signatures.
 * Historical receipts and verifier constants are intentionally untouched.
 */
import crypto from 'node:crypto';
import YAML from 'yaml';

export type WbsRegistrationDecision = 'PREVIEW' | 'APPROVED';
export interface RegistrationManifest {
  schemaVersion: '1.0';
  projectId: 'PRJ-DOCMONSTAKRAKIN';
  operation: 'ADD_WBS_ITEMS';
  preWbsSha256: string;
  postWbsSha256: string;
  approvedItems: Record<string, unknown>[];
  policyId: string;
  policyVersion: string;
}
export interface RegistrationSignature {
  identityId: string;
  role: string;
  keyId: string;
  kind: 'HUMAN';
  signatureBase64: string;
}
export interface TrustedHumanKey {
  identityId: string;
  role: string;
  keyId: string;
  kind: 'HUMAN';
  publicKeyPem: string;
  revoked?: boolean;
}
export interface TrustedRegistrationPolicy {
  policyId: string;
  policyVersion: string;
  requiredRoles: string[];
  humanKeys: TrustedHumanKey[];
}
export interface RegistrationResult {
  valid: boolean;
  decision: WbsRegistrationDecision;
  errors: string[];
  addedIds: string[];
  beforeCount: number;
  afterCount: number;
  beforeDigest: string;
  afterDigest: string;
}

function hash(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return '{' + Object.keys(source).sort().map(key => JSON.stringify(key) + ':' + canonical(source[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
function parseWbs(bytes: Buffer): { root: Record<string, any>; items: Record<string, any>[] } {
  const root = YAML.parse(bytes.toString('utf8'));
  if (!root || typeof root !== 'object' || Array.isArray(root) || !Array.isArray(root.items)) {
    throw new Error('WBS root must be an object with an items array');
  }
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  for (const item of root.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.id !== 'string' || !item.id.trim() ||
        typeof item.wbs_path !== 'string' || !item.wbs_path.trim() ||
        seenIds.has(item.id) || seenPaths.has(item.wbs_path)) {
      throw new Error('Invalid or duplicated WBS item ID or path');
    }
    seenIds.add(item.id);
    seenPaths.add(item.wbs_path);
  }
  return { root, items: root.items };
}
export function registrationPayload(manifest: RegistrationManifest): Buffer {
  return Buffer.from('DOCMONSTAKRAKIN/WBS_REGISTRATION/1.0\n' + canonical(manifest), 'utf8');
}
export function validateWbsRegistration(args: {
  beforeBytes: Buffer;
  afterBytes: Buffer;
  manifest: RegistrationManifest;
  decision: WbsRegistrationDecision;
  trustedPolicy?: TrustedRegistrationPolicy;
  signatures?: RegistrationSignature[];
}): RegistrationResult {
  const { beforeBytes, afterBytes, manifest, decision, trustedPolicy, signatures = [] } = args;
  const errors: string[] = [];
  const beforeDigest = hash(beforeBytes), afterDigest = hash(afterBytes);
  const result: RegistrationResult = {
    valid: false, decision, errors, addedIds: [], beforeCount: 0,
    afterCount: 0, beforeDigest, afterDigest
  };
  if (!manifest || manifest.schemaVersion !== '1.0' ||
      manifest.projectId !== 'PRJ-DOCMONSTAKRAKIN' ||
      manifest.operation !== 'ADD_WBS_ITEMS' ||
      !manifest.policyId || !manifest.policyVersion ||
      !Array.isArray(manifest.approvedItems) || manifest.approvedItems.length === 0) {
    errors.push('Malformed registration manifest');
    return result;
  }
  if (manifest.preWbsSha256 !== beforeDigest || manifest.postWbsSha256 !== afterDigest) {
    errors.push('WBS digest does not match manifest exact before/after bytes');
  }
  let oldWbs: ReturnType<typeof parseWbs>, newWbs: ReturnType<typeof parseWbs>;
  try { oldWbs = parseWbs(beforeBytes); newWbs = parseWbs(afterBytes); }
  catch (e) { errors.push(String(e)); return result; }
  result.beforeCount = oldWbs.items.length;
  result.afterCount = newWbs.items.length;
  const oldRoot = { ...oldWbs.root }; delete oldRoot.items;
  const newRoot = { ...newWbs.root }; delete newRoot.items;
  if (canonical(oldRoot) !== canonical(newRoot)) errors.push('WBS root metadata changed');
  const oldMap = new Map(oldWbs.items.map(item => [item.id, item]));
  const newMap = new Map(newWbs.items.map(item => [item.id, item]));
  for (const oldItem of oldWbs.items) {
    const updated = newMap.get(oldItem.id);
    if (!updated || canonical(updated) !== canonical(oldItem)) {
      errors.push('Existing WBS item modified or removed: ' + oldItem.id);
    }
  }
  const additions = newWbs.items.filter(item => !oldMap.has(item.id));
  result.addedIds = additions.map(item => item.id);
  if (additions.length !== manifest.approvedItems.length) {
    errors.push('Added item count differs from manifest');
  }
  const expected = new Map<string, Record<string, unknown>>();
  for (const item of manifest.approvedItems) {
    if (!item || typeof item.id !== 'string' || expected.has(item.id)) {
      errors.push('Duplicate or invalid manifest item ID');
      continue;
    }
    expected.set(item.id, item);
  }
  for (const item of additions) {
    if (item.status !== 'PROPOSED') errors.push('New item must start PROPOSED: ' + item.id);
    const matched = expected.get(item.id);
    if (!matched || canonical(item) !== canonical(matched)) {
      errors.push('Unexpected or altered newly registered item: ' + item.id);
    }
  }
  if (oldWbs.items.length + additions.length !== newWbs.items.length) {
    errors.push('Existing WBS item count lost');
  }
  if (decision === 'APPROVED') {
    if (!trustedPolicy || trustedPolicy.policyId !== manifest.policyId ||
        trustedPolicy.policyVersion !== manifest.policyVersion ||
        !Array.isArray(trustedPolicy.requiredRoles) || trustedPolicy.requiredRoles.length === 0 ||
        !Array.isArray(trustedPolicy.humanKeys)) {
      errors.push('Trusted independent policy is missing or mismatched');
    } else {
      const approvedRoles = new Set<string>(), usedPeople = new Set<string>();
      const payload = registrationPayload(manifest);
      for (const signature of signatures) {
        if (!signature || signature.kind !== 'HUMAN' ||
            !trustedPolicy.requiredRoles.includes(signature.role) ||
            usedPeople.has(signature.identityId) || approvedRoles.has(signature.role)) {
          errors.push('Signer role, identity, or separation of duties invalid');
          continue;
        }
        const key = trustedPolicy.humanKeys.find(k =>
          k.identityId === signature.identityId && k.keyId === signature.keyId &&
          k.role === signature.role && k.kind === 'HUMAN' && !k.revoked);
        if (!key) { errors.push('Untrusted or revoked human signer'); continue; }
        let valid = false;
        try {
          const raw = Buffer.from(signature.signatureBase64, 'base64');
          valid = raw.length === 64 && crypto.verify(null, payload, key.publicKeyPem, raw);
        } catch { /* reject malformed signature */ }
        if (!valid) { errors.push('Invalid human approval signature'); continue; }
        usedPeople.add(signature.identityId);
        approvedRoles.add(signature.role);
      }
      for (const role of trustedPolicy.requiredRoles) {
        if (!approvedRoles.has(role)) errors.push('Missing independent human approval for role: ' + role);
      }
    }
  } else if (decision !== 'PREVIEW') {
    errors.push('Unknown registration decision');
  }
  result.valid = errors.length === 0;
  return result;
}
