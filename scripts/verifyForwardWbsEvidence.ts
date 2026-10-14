import crypto from 'node:crypto';
import { validateWbsRegistration, type RegistrationManifest, type RegistrationSignature, type TrustedRegistrationPolicy } from './verifyWbsRegistration.ts';

export const HISTORICAL_WBS_SHA256 = '53050b92be8de04eb0bc9a38c44a401e5d13d88465550b4ff32355c7ea9a0a3d';

export interface ForwardWbsEvidence {
  historicalBytes: Buffer;
  currentBytes: Buffer;
  manifest?: RegistrationManifest;
  signatures?: RegistrationSignature[];
  trustedPolicy?: TrustedRegistrationPolicy;
}
export interface ForwardWbsResult {
  valid: boolean;
  mode: 'HISTORICAL' | 'FORWARD_APPROVED' | 'REJECTED';
  errors: string[];
  currentSha256: string;
}
export function verifyForwardWbsEvidence(input: ForwardWbsEvidence): ForwardWbsResult {
  const errors: string[] = [];
  const hash = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');
  const currentSha256 = hash(input.currentBytes);
  const fail = (error: string): ForwardWbsResult => ({
    valid: false, mode: 'REJECTED', errors: [error], currentSha256
  });
  if (hash(input.historicalBytes) !== HISTORICAL_WBS_SHA256) {
    return fail('Historical WBS snapshot hash mismatch');
  }
  if (currentSha256 === HISTORICAL_WBS_SHA256) {
    return { valid: true, mode: 'HISTORICAL', errors, currentSha256 };
  }
  if (!input.manifest || !input.trustedPolicy || !input.signatures) {
    return fail('Current WBS differs from historical state without approved registration evidence');
  }
  const verification = validateWbsRegistration({
    beforeBytes: input.historicalBytes,
    afterBytes: input.currentBytes,
    manifest: input.manifest,
    signatures: input.signatures,
    trustedPolicy: input.trustedPolicy,
    decision: 'APPROVED',
  });
  if (!verification.valid) return {
    valid: false, mode: 'REJECTED', errors: verification.errors, currentSha256
  };
  return { valid: true, mode: 'FORWARD_APPROVED', errors, currentSha256 };
}
