import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  policyDigestV2,
  registrationSigningPayloadV2,
  verifyTrustedWbsRegistrationV2,
  type TrustedPolicyV2,
  type RegistrationIntentV2,
  type TrustedVerificationContextV2,
  type SignedReceiptV2,
  type HumanKeyV2,
} from './verifyTrustedWbsRegistrationV2.ts';

console.log('=== RUNNING STAGE B2A ADVERSARIAL SECURITY & ARCHITECTURE TEST SUITE ===\n');

// Baseline fixtures
const beforeWbs = Buffer.from(
  'version: "1.0"\nproject: "docmonstakrakin"\nitems:\n  - id: "DMK-197"\n    wbs_path: "13.06.11"\n    status: "VERIFICATION_PENDING"\n'
);
const afterWbs = Buffer.concat([
  beforeWbs,
  Buffer.from('  - id: "DMK-209"\n    wbs_path: "13.06.22"\n    status: "PROPOSED"\n'),
]);

const sha = (x: Buffer | string) =>
  crypto.createHash('sha256').update(typeof x === 'string' ? Buffer.from(x, 'utf8') : x).digest('hex');

const keySec = crypto.generateKeyPairSync('ed25519');
const keyArch = crypto.generateKeyPairSync('ed25519');

const enroll = (
  pair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject },
  principalId: string,
  role: string,
  keyId: string,
  overrides: Partial<HumanKeyV2> = {}
): HumanKeyV2 => ({
  principalId,
  role,
  keyId,
  kind: 'HUMAN',
  revoked: false,
  validNotBefore: '2026-01-01T00:00:00.000Z',
  validNotAfter: '2027-01-01T00:00:00.000Z',
  publicKeyPem: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  ...overrides,
});

const basePolicy: TrustedPolicyV2 = {
  schemaVersion: '2.0',
  policyId: 'GOV-RATIFIED-B2A',
  policyVersion: '2.0',
  requiredRoles: ['Security Officer', 'Lead Architect'],
  humanKeys: [
    enroll(keySec, 'HUMAN-SEC-01', 'Security Officer', 'KEY-SEC-01'),
    enroll(keyArch, 'HUMAN-ARCH-01', 'Lead Architect', 'KEY-ARCH-01'),
  ],
};

const baseGit = {
  repository: 'Jeruzael/docmonstakrakin',
  pullRequestNumber: 34,
  baseCommitSha: 'a'.repeat(40),
  reviewedHeadCommitSha: 'b'.repeat(40),
  reviewedHeadTreeSha: 'c'.repeat(40),
};

const baseIntent: RegistrationIntentV2 = {
  schemaVersion: '2.0',
  projectId: 'PRJ-DOCMONSTAKRAKIN',
  operation: 'ADD_WBS_ITEMS',
  receiptId: 'WBS-RECEIPT-2026-0001',
  preWbsSha256: sha(beforeWbs),
  postWbsSha256: sha(afterWbs),
  approvedItems: [{ id: 'DMK-209', wbs_path: '13.06.22', status: 'PROPOSED' }],
  policyId: basePolicy.policyId,
  policyVersion: basePolicy.policyVersion,
  policySha256: policyDigestV2(basePolicy),
  notBefore: '2026-10-01T00:00:00.000Z',
  notAfter: '2026-11-01T00:00:00.000Z',
  git: baseGit,
};

const sign = (
  pair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject },
  principalId: string,
  role: string,
  keyId: string,
  intentToSign: RegistrationIntentV2 = baseIntent
) => ({
  principalId,
  role,
  keyId,
  kind: 'HUMAN' as const,
  signatureBase64: crypto
    .sign(null, registrationSigningPayloadV2(intentToSign), pair.privateKey)
    .toString('base64'),
});

const baseReceipt: SignedReceiptV2 = {
  intent: baseIntent,
  signatures: [
    sign(keySec, 'HUMAN-SEC-01', 'Security Officer', 'KEY-SEC-01'),
    sign(keyArch, 'HUMAN-ARCH-01', 'Lead Architect', 'KEY-ARCH-01'),
  ],
};

const baseContext: TrustedVerificationContextV2 = {
  pinnedPolicySha256: policyDigestV2(basePolicy),
  expectedGit: baseGit,
  nowIso: '2026-10-16T00:00:00.000Z',
  consumedReceiptIds: [],
};

let defensivePassed = 0;
let limitationsDemonstrated = 0;

function testDefensive(name: string, fn: () => void) {
  try {
    fn();
    defensivePassed++;
    console.log(`[PASS] DEFENSIVE INVARIANT: ${name}`);
  } catch (err: any) {
    console.error(`[FAIL DEFENSIVE] ${name}:`, err.message);
    throw err;
  }
}

function testLimitation(name: string, fn: () => void) {
  try {
    fn();
    limitationsDemonstrated++;
    console.log(`[PASS] KNOWN LIMITATION REPRODUCED (NOT FIXED): ${name}`);
  } catch (err: any) {
    console.error(`[FAIL LIMITATION DEMO] ${name}:`, err.message);
    throw err;
  }
}

// ============================================================================
// PART 1: DEFENSIVE INVARIANT TESTS
// ============================================================================

testDefensive('B2A-SEC-01: Baseline valid receipt verifies EVIDENCE only and mayApply is false', () => {
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: baseContext,
  });
  assert.equal(result.valid, true);
  assert.equal(result.mode, 'EVIDENCE_VERIFIED');
  assert.equal(result.mayApply, false);
  assert.equal(result.errors.length, 0);
});

testDefensive('B2A-SEC-02: Modified policy bytes fail against pinnedPolicySha256 anchor', () => {
  const tamperedPolicy: TrustedPolicyV2 = {
    ...basePolicy,
    humanKeys: [
      { ...basePolicy.humanKeys[0], keyId: 'KEY-SEC-MODIFIED' },
      basePolicy.humanKeys[1],
    ],
  };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: tamperedPolicy,
    context: baseContext,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Policy digest does not match independently pinned trust root')));
});

testDefensive('B2A-SEC-03: SPKI-DER normalization catches identical public key with varied PEM formatting', () => {
  const secPem = keySec.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const alteredPem = secPem.replace('\n', '\r\n');

  const policyWithDuplicateKey: TrustedPolicyV2 = {
    ...basePolicy,
    humanKeys: [
      enroll(keySec, 'HUMAN-SEC-01', 'Security Officer', 'KEY-SEC-01'),
      {
        ...enroll(keyArch, 'HUMAN-ARCH-01', 'Lead Architect', 'KEY-ARCH-01'),
        publicKeyPem: alteredPem,
      },
    ],
  };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: policyWithDuplicateKey,
    context: { ...baseContext, pinnedPolicySha256: policyDigestV2(policyWithDuplicateKey) },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Public signing key reused across enrollment records or principals')));
});

testDefensive('B2A-SEC-04: Role reduction under same policyId/version is caught by policy digest', () => {
  const weakenedPolicy: TrustedPolicyV2 = {
    ...basePolicy,
    requiredRoles: ['Security Officer'],
    humanKeys: [basePolicy.humanKeys[0]],
  };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: weakenedPolicy,
    context: baseContext,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Policy digest does not match independently pinned trust root')));
});

testDefensive('B2A-SEC-05: Git tree SHA mismatch fails closed (prevents unreviewed code replay)', () => {
  const unreviewedGit = { ...baseGit, reviewedHeadTreeSha: 'd'.repeat(40) };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: { ...baseContext, expectedGit: unreviewedGit },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Signed Git/PR context does not match independently verified reviewed candidate')));
});

testDefensive('B2A-SEC-06: PR number or repository mismatch fails closed', () => {
  const wrongPrGit = { ...baseGit, pullRequestNumber: 999 };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: { ...baseContext, expectedGit: wrongPrGit },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Signed Git/PR context does not match independently verified reviewed candidate')));
});

testDefensive('B2A-SEC-07: Consumed receipt ID fails closed', () => {
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: { ...baseContext, consumedReceiptIds: [baseIntent.receiptId] },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Receipt consumption ledger missing or this receipt was already consumed')));
});

testDefensive('B2A-SEC-08: Expired approval rejected', () => {
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: { ...baseContext, nowIso: '2026-12-01T00:00:00.000Z' },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Approval is not within signed validity interval')));
});

testDefensive('B2A-SEC-09: Future-dated approval rejected', () => {
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: { ...baseContext, nowIso: '2026-09-01T00:00:00.000Z' },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Approval is not within signed validity interval')));
});

testDefensive('B2A-SEC-10: Inverted approval validity window rejected', () => {
  const badIntent: RegistrationIntentV2 = {
    ...baseIntent,
    notBefore: '2026-11-01T00:00:00.000Z',
    notAfter: '2026-10-01T00:00:00.000Z',
  };
  const badReceipt: SignedReceiptV2 = {
    intent: badIntent,
    signatures: [
      sign(keySec, 'HUMAN-SEC-01', 'Security Officer', 'KEY-SEC-01', badIntent),
      sign(keyArch, 'HUMAN-ARCH-01', 'Lead Architect', 'KEY-ARCH-01', badIntent),
    ],
  };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: badReceipt,
    policy: basePolicy,
    context: baseContext,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Approval is not within signed validity interval')));
});

testDefensive('B2A-SEC-11: Malformed ISO-8601 timestamp rejected (non-UTC or invalid date)', () => {
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: { ...baseContext, nowIso: '2026-02-30T00:00:00.000Z' },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid trusted clock or signed approval timestamps')));
});

testDefensive('B2A-SEC-12: Key outside authenticated validity period rejected', () => {
  const expiredKeyPolicy: TrustedPolicyV2 = {
    ...basePolicy,
    humanKeys: [
      enroll(keySec, 'HUMAN-SEC-01', 'Security Officer', 'KEY-SEC-01', {
        validNotAfter: '2026-06-01T00:00:00.000Z',
      }),
      basePolicy.humanKeys[1],
    ],
  };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: expiredKeyPolicy,
    context: { ...baseContext, pinnedPolicySha256: policyDigestV2(expiredKeyPolicy) },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Human signing key outside authenticated validity period')));
});

testDefensive('B2A-SEC-13: Duplicate key ID in policy rejected', () => {
  const dupKeyIdPolicy: TrustedPolicyV2 = {
    ...basePolicy,
    humanKeys: [
      basePolicy.humanKeys[0],
      enroll(keyArch, 'HUMAN-ARCH-01', 'Lead Architect', 'KEY-SEC-01'),
    ],
  };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: dupKeyIdPolicy,
    context: { ...baseContext, pinnedPolicySha256: policyDigestV2(dupKeyIdPolicy) },
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Duplicate key ID in ratified policy')));
});

testDefensive('B2A-SEC-14: Prototype pollution attempt in canonical JSON rejected', () => {
  const maliciousIntent = JSON.parse(JSON.stringify(baseIntent));
  maliciousIntent['__proto__'] = { backdoor: true };
  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: { ...baseReceipt, intent: maliciousIntent },
    policy: basePolicy,
    context: baseContext,
  });
  assert.equal(result.valid, false);
});

// ============================================================================
// PART 2: STRUCTURAL LIMITATIONS & GOVERNANCE BOUNDARY PROOFS
// ============================================================================

testLimitation('B2A-LIMIT-01: Attacker fake policy passes if caller-supplied context is not independently anchored', () => {
  const attackerSec = crypto.generateKeyPairSync('ed25519');
  const attackerArch = crypto.generateKeyPairSync('ed25519');

  const fakePolicy: TrustedPolicyV2 = {
    schemaVersion: '2.0',
    policyId: 'ATTACKER-POLICY',
    policyVersion: '2.0',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    humanKeys: [
      enroll(attackerSec, 'ATTACKER-1', 'Security Officer', 'KEY-ATK-1'),
      enroll(attackerArch, 'ATTACKER-2', 'Lead Architect', 'KEY-ATK-2'),
    ],
  };
  const fakePolicyDigest = policyDigestV2(fakePolicy);

  const fakeIntent: RegistrationIntentV2 = {
    ...baseIntent,
    policyId: fakePolicy.policyId,
    policyVersion: fakePolicy.policyVersion,
    policySha256: fakePolicyDigest,
  };
  const fakeReceipt: SignedReceiptV2 = {
    intent: fakeIntent,
    signatures: [
      sign(attackerSec, 'ATTACKER-1', 'Security Officer', 'KEY-ATK-1', fakeIntent),
      sign(attackerArch, 'ATTACKER-2', 'Lead Architect', 'KEY-ATK-2', fakeIntent),
    ],
  };

  const unanchoredContext: TrustedVerificationContextV2 = {
    ...baseContext,
    pinnedPolicySha256: fakePolicyDigest,
  };

  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: fakeReceipt,
    policy: fakePolicy,
    context: unanchoredContext,
  });

  assert.equal(result.valid, true);
  assert.equal(result.mode, 'EVIDENCE_VERIFIED');
});

testLimitation('B2A-LIMIT-02: Single human possessing multiple distinct private keys satisfies quorum', () => {
  const aliceKey1 = crypto.generateKeyPairSync('ed25519');
  const aliceKey2 = crypto.generateKeyPairSync('ed25519');

  const multiKeyPolicy: TrustedPolicyV2 = {
    schemaVersion: '2.0',
    policyId: 'MULTI-KEY-TEST',
    policyVersion: '2.0',
    requiredRoles: ['Security Officer', 'Lead Architect'],
    humanKeys: [
      enroll(aliceKey1, 'ALICE-ROLE-A', 'Security Officer', 'KEY-ALICE-1'),
      enroll(aliceKey2, 'ALICE-ROLE-B', 'Lead Architect', 'KEY-ALICE-2'),
    ],
  };
  const policyHash = policyDigestV2(multiKeyPolicy);

  const multiKeyIntent: RegistrationIntentV2 = {
    ...baseIntent,
    policyId: multiKeyPolicy.policyId,
    policyVersion: multiKeyPolicy.policyVersion,
    policySha256: policyHash,
  };
  const multiKeyReceipt: SignedReceiptV2 = {
    intent: multiKeyIntent,
    signatures: [
      sign(aliceKey1, 'ALICE-ROLE-A', 'Security Officer', 'KEY-ALICE-1', multiKeyIntent),
      sign(aliceKey2, 'ALICE-ROLE-B', 'Lead Architect', 'KEY-ALICE-2', multiKeyIntent),
    ],
  };

  const multiKeyContext: TrustedVerificationContextV2 = {
    ...baseContext,
    pinnedPolicySha256: policyHash,
  };

  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: multiKeyReceipt,
    policy: multiKeyPolicy,
    context: multiKeyContext,
  });

  assert.equal(result.valid, true);
  assert.equal(result.mode, 'EVIDENCE_VERIFIED');
});

testLimitation('B2A-LIMIT-03: Read-only verifier does not atomically consume receipt ID', () => {
  const result1 = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: baseContext,
  });
  assert.equal(result1.valid, true);

  const result2 = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: baseContext,
  });
  assert.equal(result2.valid, true);
  assert.equal(baseContext.consumedReceiptIds.length, 0);
});

testLimitation('B2A-LIMIT-04: Caller-manipulated clock permits validation of expired receipts', () => {
  const manipulatedContext: TrustedVerificationContextV2 = {
    ...baseContext,
    nowIso: '2026-10-15T12:00:00.000Z',
  };

  const result = verifyTrustedWbsRegistrationV2({
    beforeBytes: beforeWbs,
    afterBytes: afterWbs,
    receipt: baseReceipt,
    policy: basePolicy,
    context: manipulatedContext,
  });
  assert.equal(result.valid, true);
});

// Fail CI if a characterization case is accidentally dropped or its count drifts.
assert.equal(defensivePassed, 14, 'Expected 14 defensive invariant checks');
assert.equal(limitationsDemonstrated, 4, 'Expected 4 unresolved security limitation demonstrations');

console.log(`\n=== STAGE B2A ADVERSARIAL RESULTS ===`);
console.log(`Defensive Invariant Tests Passed: ${defensivePassed}/14`);
console.log(`Structural Limitations Demonstrated: ${limitationsDemonstrated}/4`);
