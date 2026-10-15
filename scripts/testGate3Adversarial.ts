/**
 * Gate 3 audit regression: 27 defensive cases plus 4 reproducible weaknesses.
 * A passing weakness demonstration means a vulnerability is reproducible, not fixed.
 * This test cannot grant or substitute human governance approval.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateWbsRegistration,
  registrationPayload,
  type RegistrationManifest,
  type RegistrationSignature,
  type TrustedRegistrationPolicy,
  type TrustedHumanKey,
} from './verifyWbsRegistration.ts';
import {
  verifyForwardWbsEvidence,
  HISTORICAL_WBS_SHA256,
} from './verifyForwardWbsEvidence.ts';

// Baseline valid fixtures
const originalWbs = `version: "1.0"
project: "docmonstakrakin"
items:
  - id: "DMK-197"
    wbs_path: "13.06.11"
    status: "VERIFICATION_PENDING"
`;

const validAddedWbs = originalWbs + `  - id: "DMK-209"
    wbs_path: "13.06.22"
    status: "PROPOSED"
`;

const hash = (b: Buffer | string) =>
  crypto.createHash('sha256').update(typeof b === 'string' ? Buffer.from(b, 'utf8') : b).digest('hex');

const validItem = { id: 'DMK-209', wbs_path: '13.06.22', status: 'PROPOSED' };

const baseManifest: RegistrationManifest = {
  schemaVersion: '1.0',
  projectId: 'PRJ-DOCMONSTAKRAKIN',
  operation: 'ADD_WBS_ITEMS',
  preWbsSha256: hash(originalWbs),
  postWbsSha256: hash(validAddedWbs),
  approvedItems: [validItem],
  policyId: 'GOV-TEST-POLICY',
  policyVersion: '1.0',
};

// Key generation for testing
const secKey = crypto.generateKeyPairSync('ed25519');
const archKey = crypto.generateKeyPairSync('ed25519');
const attackerKey = crypto.generateKeyPairSync('ed25519');

const makeKey = (
  identityId: string,
  role: string,
  keyId: string,
  pair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject },
  revoked = false
): TrustedHumanKey => ({
  identityId,
  role,
  keyId,
  kind: 'HUMAN',
  publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  revoked,
});

const trustedPolicy: TrustedRegistrationPolicy = {
  policyId: 'GOV-TEST-POLICY',
  policyVersion: '1.0',
  requiredRoles: ['Security Officer', 'Lead Architect'],
  humanKeys: [
    makeKey('SEC-ID', 'Security Officer', 'KEY-SEC-1', secKey),
    makeKey('ARCH-ID', 'Lead Architect', 'KEY-ARCH-1', archKey),
  ],
};

const signManifest = (
  manifest: RegistrationManifest,
  identityId: string,
  role: string,
  keyId: string,
  privateKey: crypto.KeyObject
): RegistrationSignature => {
  const payload = registrationPayload(manifest);
  const signatureBase64 = crypto.sign(null, payload, privateKey).toString('base64');
  return {
    identityId,
    role,
    keyId,
    kind: 'HUMAN',
    signatureBase64,
  };
};

const validSignatures: RegistrationSignature[] = [
  signManifest(baseManifest, 'SEC-ID', 'Security Officer', 'KEY-SEC-1', secKey.privateKey),
  signManifest(baseManifest, 'ARCH-ID', 'Lead Architect', 'KEY-ARCH-1', archKey.privateKey),
];

let totalTests = 0;
let passedTests = 0;

function runAdversarialCase(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

console.log('=== RUNNING GATE 3 ADVERSARIAL SECURITY TEST SUITE ===\n');

// ADV-01: Untrusted Public Key Injection
runAdversarialCase('ADV-01: Untrusted Public Key Injection rejected fail-closed', () => {
  const forgedSig = signManifest(baseManifest, 'ATTACKER', 'Security Officer', 'KEY-ATTACK-1', attackerKey.privateKey);
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy,
    signatures: [forgedSig, validSignatures[1]],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Untrusted or revoked human signer')));
});

// ADV-02: Revoked Credential Attack
runAdversarialCase('ADV-02: Revoked key signature rejected fail-closed', () => {
  const policyWithRevoked: TrustedRegistrationPolicy = {
    ...trustedPolicy,
    humanKeys: [
      makeKey('SEC-ID', 'Security Officer', 'KEY-SEC-1', secKey, true), // REVOKED!
      makeKey('ARCH-ID', 'Lead Architect', 'KEY-ARCH-1', archKey),
    ],
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy: policyWithRevoked,
    signatures: validSignatures,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Untrusted or revoked human signer')));
});

// ADV-03: Single Identity Multi-Role Collusion / Dual Role Signing
runAdversarialCase('ADV-03: Single identity signing both roles rejected (separation of duties violation)', () => {
  // Alice attempts to sign as Security Officer AND Lead Architect
  const aliceArchSig = signManifest(baseManifest, 'SEC-ID', 'Lead Architect', 'KEY-SEC-1', secKey.privateKey);
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy,
    signatures: [validSignatures[0], aliceArchSig],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Signer role, identity, or separation of duties invalid')));
});

// ADV-04: Role Collision / Duplicate Role Signatures
runAdversarialCase('ADV-04: Duplicate role signatures rejected without full quorum', () => {
  const secondSecKey = crypto.generateKeyPairSync('ed25519');
  const policyWithTwoSecs: TrustedRegistrationPolicy = {
    ...trustedPolicy,
    humanKeys: [
      ...trustedPolicy.humanKeys,
      makeKey('SEC-2', 'Security Officer', 'KEY-SEC-2', secondSecKey),
    ],
  };
  const secondSecSig = signManifest(baseManifest, 'SEC-2', 'Security Officer', 'KEY-SEC-2', secondSecKey.privateKey);
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy: policyWithTwoSecs,
    signatures: [validSignatures[0], secondSecSig],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Signer role, identity, or separation of duties invalid')));
  assert.ok(result.errors.some((e) => e.includes('Missing independent human approval for role: Lead Architect')));
});

// ADV-05: Signature Corruption & Non-64-Byte Ed25519 Signatures
runAdversarialCase('ADV-05A: Truncated 63-byte signature rejected fail-closed without exception', () => {
  const truncatedSig: RegistrationSignature = {
    ...validSignatures[0],
    signatureBase64: Buffer.alloc(63, 0xaa).toString('base64'),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy,
    signatures: [truncatedSig, validSignatures[1]],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid human approval signature')));
});

runAdversarialCase('ADV-05B: Oversized 65-byte signature rejected fail-closed without exception', () => {
  const oversizedSig: RegistrationSignature = {
    ...validSignatures[0],
    signatureBase64: Buffer.alloc(65, 0xbb).toString('base64'),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy,
    signatures: [oversizedSig, validSignatures[1]],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid human approval signature')));
});

runAdversarialCase('ADV-05C: Corrupted 64-byte payload signature rejected fail-closed', () => {
  const corruptedRaw = Buffer.from(validSignatures[0].signatureBase64, 'base64');
  corruptedRaw[10] ^= 0xff; // flip bits
  const corruptedSig: RegistrationSignature = {
    ...validSignatures[0],
    signatureBase64: corruptedRaw.toString('base64'),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy,
    signatures: [corruptedSig, validSignatures[1]],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid human approval signature')));
});

runAdversarialCase('ADV-05D: Malformed non-base64 signature string handled gracefully fail-closed', () => {
  const malformedSig: RegistrationSignature = {
    ...validSignatures[0],
    signatureBase64: '???Not-Base64-Content###!@$%',
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy,
    signatures: [malformedSig, validSignatures[1]],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid human approval signature')));
});

// ADV-06: Cross-State Replay Attack
runAdversarialCase('ADV-06A: Replay across altered pre-WBS state rejected', () => {
  const alteredOriginal = originalWbs.replace('VERIFICATION_PENDING', 'PROPOSED');
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(alteredOriginal),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest, // binds old preWbsSha256
    decision: 'APPROVED',
    trustedPolicy,
    signatures: validSignatures,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('WBS digest does not match manifest exact before/after bytes')));
});

runAdversarialCase('ADV-06B: Replay across altered post-WBS state rejected', () => {
  const alteredAdded = validAddedWbs + '  # comment\n';
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(alteredAdded),
    manifest: baseManifest, // binds original postWbsSha256
    decision: 'APPROVED',
    trustedPolicy,
    signatures: validSignatures,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('WBS digest does not match manifest exact before/after bytes')));
});

// ADV-07: Cross-Project / Cross-Operation Domain Replay
runAdversarialCase('ADV-07A: Tampered projectId rejected fail-closed', () => {
  const badManifest = { ...baseManifest, projectId: 'PRJ-ROGUE' as any };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: badManifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Malformed registration manifest')));
});

runAdversarialCase('ADV-07B: Tampered operation rejected fail-closed', () => {
  const badManifest = { ...baseManifest, operation: 'DELETE_WBS_ITEMS' as any };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: badManifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Malformed registration manifest')));
});

// ADV-08: Policy Version Mismatch
runAdversarialCase('ADV-08: Policy version mismatch between manifest and trusted policy rejected', () => {
  const badPolicy: TrustedRegistrationPolicy = {
    ...trustedPolicy,
    policyVersion: '2.0',
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest, // policyVersion 1.0
    decision: 'APPROVED',
    trustedPolicy: badPolicy,
    signatures: validSignatures,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Trusted independent policy is missing or mismatched')));
});

// ADV-09: Stealth Status Escalation (Non-PROPOSED Status Injection)
runAdversarialCase('ADV-09: New item starting in VERIFIED status rejected fail-closed', () => {
  const sneakyWbs = originalWbs + `  - id: "DMK-209"
    wbs_path: "13.06.22"
    status: "VERIFIED"
`;
  const sneakyItem = { id: 'DMK-209', wbs_path: '13.06.22', status: 'VERIFIED' };
  const sneakyManifest: RegistrationManifest = {
    ...baseManifest,
    postWbsSha256: hash(sneakyWbs),
    approvedItems: [sneakyItem],
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(sneakyWbs),
    manifest: sneakyManifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('New item must start PROPOSED: DMK-209')));
});

// ADV-10: Existing Item Mutation Disguised as Addition
runAdversarialCase('ADV-10: Mutating existing item status while adding item rejected fail-closed', () => {
  const tamperedWbs = `version: "1.0"
project: "docmonstakrakin"
items:
  - id: "DMK-197"
    wbs_path: "13.06.11"
    status: "CLOSED"
  - id: "DMK-209"
    wbs_path: "13.06.22"
    status: "PROPOSED"
`;
  const manifest: RegistrationManifest = {
    ...baseManifest,
    postWbsSha256: hash(tamperedWbs),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(tamperedWbs),
    manifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Existing WBS item modified or removed: DMK-197')));
});

// ADV-11: Existing Item Deletion
runAdversarialCase('ADV-11: Deleting existing item rejected fail-closed', () => {
  const deletedWbs = `version: "1.0"
project: "docmonstakrakin"
items:
  - id: "DMK-209"
    wbs_path: "13.06.22"
    status: "PROPOSED"
`;
  const manifest: RegistrationManifest = {
    ...baseManifest,
    postWbsSha256: hash(deletedWbs),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(deletedWbs),
    manifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Existing WBS item modified or removed: DMK-197')));
  assert.ok(result.errors.some((e) => e.includes('Existing WBS item count lost')));
});

// ADV-12: Duplicate WBS Item ID and Path Collisions
runAdversarialCase('ADV-12A: Adding item with duplicate existing ID rejected fail-closed', () => {
  const dupeIdWbs = originalWbs + `  - id: "DMK-197"
    wbs_path: "13.06.22"
    status: "PROPOSED"
`;
  const manifest: RegistrationManifest = {
    ...baseManifest,
    postWbsSha256: hash(dupeIdWbs),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(dupeIdWbs),
    manifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid or duplicated WBS item ID or path')));
});

runAdversarialCase('ADV-12B: Adding item with duplicate existing WBS path rejected fail-closed', () => {
  const dupePathWbs = originalWbs + `  - id: "DMK-209"
    wbs_path: "13.06.11"
    status: "PROPOSED"
`;
  const manifest: RegistrationManifest = {
    ...baseManifest,
    postWbsSha256: hash(dupePathWbs),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(dupePathWbs),
    manifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid or duplicated WBS item ID or path')));
});

// ADV-13: Root Metadata Tampering
runAdversarialCase('ADV-13: Altering root metadata rejected fail-closed', () => {
  const rootTamperedWbs = `version: "1.1"
project: "docmonstakrakin"
items:
  - id: "DMK-197"
    wbs_path: "13.06.11"
    status: "VERIFICATION_PENDING"
  - id: "DMK-209"
    wbs_path: "13.06.22"
    status: "PROPOSED"
`;
  const manifest: RegistrationManifest = {
    ...baseManifest,
    postWbsSha256: hash(rootTamperedWbs),
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(rootTamperedWbs),
    manifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('WBS root metadata changed')));
});

// ADV-14: Discrepancy Between Manifest approvedItems and Actual Added Items
runAdversarialCase('ADV-14A: Manifest approvedItems contains extra item not in YAML', () => {
  const manifest: RegistrationManifest = {
    ...baseManifest,
    approvedItems: [validItem, { id: 'DMK-210', wbs_path: '13.06.23', status: 'PROPOSED' }],
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Added item count differs from manifest')));
});

runAdversarialCase('ADV-14B: Added item attributes differ from approved manifest item', () => {
  const manifest: RegistrationManifest = {
    ...baseManifest,
    approvedItems: [{ ...validItem, description: 'Approved manifest description' }],
  };
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs), // lacks description
    manifest,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Unexpected or altered newly registered item: DMK-209')));
});

// ADV-15: Historical Anchor Tampering in verifyForwardWbsEvidence
runAdversarialCase('ADV-15A: Modified historical snapshot buffer fails closed', () => {
  const tamperedHistory = Buffer.from('corrupted snapshot content');
  const result = verifyForwardWbsEvidence({
    historicalBytes: tamperedHistory,
    currentBytes: Buffer.from(originalWbs),
  });
  assert.equal(result.valid, false);
  assert.equal(result.mode, 'REJECTED');
  assert.ok(result.errors.some((e) => e.includes('Historical WBS snapshot hash mismatch')));
});

runAdversarialCase('ADV-15B: Current bytes differ from historical without manifest/signatures rejected', () => {
  const realHistoryPath = path.resolve(process.cwd(), 'docs/07_verification/historical-wbs/DMK_197_POST_CLOSURE_MASTER_WBS.yaml');
  const realHistoryBytes = fs.readFileSync(realHistoryPath);
  assert.equal(hash(realHistoryBytes), HISTORICAL_WBS_SHA256);

  const modifiedCurrent = Buffer.concat([realHistoryBytes, Buffer.from('\n# stealth modification')]);
  const result = verifyForwardWbsEvidence({
    historicalBytes: realHistoryBytes,
    currentBytes: modifiedCurrent,
  });
  assert.equal(result.valid, false);
  assert.equal(result.mode, 'REJECTED');
  assert.ok(result.errors.some((e) => e.includes('Current WBS differs from historical state without approved registration evidence')));
});

// ADV-16: Malformed Input Fuzzing / Null Safety / Empty Arrays
runAdversarialCase('ADV-16A: Null/empty manifest rejected fail-closed without crashing', () => {
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: null as any,
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Malformed registration manifest')));
});

runAdversarialCase('ADV-16B: Malformed YAML in beforeBytes caught and rejected fail-closed', () => {
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(':::not yaml:::'),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: { ...baseManifest, preWbsSha256: hash(':::not yaml:::') },
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

runAdversarialCase('ADV-16C: Empty approvedItems in manifest rejected fail-closed', () => {
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: { ...baseManifest, approvedItems: [] },
    decision: 'PREVIEW',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Malformed registration manifest')));
});

runAdversarialCase('ADV-16D: Empty signatures array for APPROVED decision fails closed', () => {
  const result = validateWbsRegistration({
    beforeBytes: Buffer.from(originalWbs),
    afterBytes: Buffer.from(validAddedWbs),
    manifest: baseManifest,
    decision: 'APPROVED',
    trustedPolicy,
    signatures: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Missing independent human approval for role: Security Officer')));
  assert.ok(result.errors.some((e) => e.includes('Missing independent human approval for role: Lead Architect')));
});

// ============================================================================
// PART 2: EMPIRICAL DEMONSTRATION OF REVIEW FINDINGS & WEAKNESSES
// ============================================================================
console.log('\n=== RUNNING EMPIRICAL TESTS DEMONSTRATING REVIEW FINDINGS ===\n');

let totalFindings = 0;
let confirmedFindings = 0;

function runFindingDemonstration(id: string, name: string, fn: () => void) {
  totalFindings++;
  try {
    fn();
    confirmedFindings++;
    console.log(`[WEAKNESS CONFIRMED] ${id}: ${name}`);
  } catch (err: any) {
    console.error(`[FINDING DEMONSTRATION FAILED] ${id}: ${name}:`, err.message);
    throw err;
  }
}

// ADV-FINDING-01: Attacker-Controlled Trusted Policy Substitution
runFindingDemonstration(
  'ADV-FINDING-01',
  'Attacker-controlled trusted-policy substitution permits arbitrary authorization bypass',
  () => {
    // Attacker generates their own rogue Ed25519 keypair
    const rogueKey1 = crypto.generateKeyPairSync('ed25519');
    const rogueKey2 = crypto.generateKeyPairSync('ed25519');

    // Attacker constructs their own policy matching the manifest's policyId/version
    const attackerPolicy: TrustedRegistrationPolicy = {
      policyId: baseManifest.policyId,
      policyVersion: baseManifest.policyVersion,
      requiredRoles: ['Security Officer', 'Lead Architect'],
      humanKeys: [
        makeKey('ATTACKER-1', 'Security Officer', 'ROGUE-K1', rogueKey1),
        makeKey('ATTACKER-2', 'Lead Architect', 'ROGUE-K2', rogueKey2),
      ],
    };

    // Attacker signs the manifest using rogue private keys
    const attackerSignatures = [
      signManifest(baseManifest, 'ATTACKER-1', 'Security Officer', 'ROGUE-K1', rogueKey1.privateKey),
      signManifest(baseManifest, 'ATTACKER-2', 'Lead Architect', 'ROGUE-K2', rogueKey2.privateKey),
    ];

    // Verifier executes with attacker-controlled policy
    const result = validateWbsRegistration({
      beforeBytes: Buffer.from(originalWbs),
      afterBytes: Buffer.from(validAddedWbs),
      manifest: baseManifest,
      decision: 'APPROVED',
      trustedPolicy: attackerPolicy, // Injected untrusted policy!
      signatures: attackerSignatures,
    });

    // FINDING PROOF: The verifier accepts the untrusted policy and returns valid: true!
    // This proves that Ed25519 validation is only relative to trustedPolicy; without an anchored
    // root of trust or policy integrity check, caller policy control completely bypasses governance.
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  }
);

// ADV-FINDING-02: Shared Cryptographic Key Across Distinct Identity IDs
runFindingDemonstration(
  'ADV-FINDING-02',
  'Shared cryptographic key across distinct identity IDs satisfies quorum (separation of duties vulnerability)',
  () => {
    // Single actor (Alice) generates ONE keypair
    const aliceSingleKey = crypto.generateKeyPairSync('ed25519');

    // Policy registers the SAME public key under two different identityId strings
    const policyWithSharedKey: TrustedRegistrationPolicy = {
      policyId: baseManifest.policyId,
      policyVersion: baseManifest.policyVersion,
      requiredRoles: ['Security Officer', 'Lead Architect'],
      humanKeys: [
        makeKey('ALICE-IDENTITY-A', 'Security Officer', 'K-ALICE-1', aliceSingleKey),
        makeKey('ALICE-IDENTITY-B', 'Lead Architect', 'K-ALICE-2', aliceSingleKey), // Same key!
      ],
    };

    // Alice creates both signatures using her single private key
    const signaturesWithSharedKey = [
      signManifest(baseManifest, 'ALICE-IDENTITY-A', 'Security Officer', 'K-ALICE-1', aliceSingleKey.privateKey),
      signManifest(baseManifest, 'ALICE-IDENTITY-B', 'Lead Architect', 'K-ALICE-2', aliceSingleKey.privateKey),
    ];

    const result = validateWbsRegistration({
      beforeBytes: Buffer.from(originalWbs),
      afterBytes: Buffer.from(validAddedWbs),
      manifest: baseManifest,
      decision: 'APPROVED',
      trustedPolicy: policyWithSharedKey,
      signatures: signaturesWithSharedKey,
    });

    // FINDING PROOF: Code checks usedPeople.has(signature.identityId), which compares strings ('ALICE-IDENTITY-A' !== 'ALICE-IDENTITY-B').
    // It does NOT verify that the underlying public keys are distinct. A single person possessing one private key
    // can sign both roles if registered under multiple identity IDs!
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  }
);

// ADV-FINDING-03: Replay Across Different Git Branches/Commits with Identical WBS Bytes
runFindingDemonstration(
  'ADV-FINDING-03',
  'Replay of valid authorization payload across different Git branches or commits with unchanged WBS content',
  () => {
    // Simulated Branch 1 (e.g. PR #34 branch with reviewed code)
    const branch1PreBytes = Buffer.from(originalWbs);
    const branch1PostBytes = Buffer.from(validAddedWbs);

    // Initial valid verification on Branch 1
    const branch1Result = validateWbsRegistration({
      beforeBytes: branch1PreBytes,
      afterBytes: branch1PostBytes,
      manifest: baseManifest,
      decision: 'APPROVED',
      trustedPolicy,
      signatures: validSignatures,
    });
    assert.equal(branch1Result.valid, true);

    // Simulated Branch 2 (e.g. rogue/different branch or commit C2 with unreviewed code changes elsewhere,
    // but identical MASTER_WBS.yaml bytes)
    const branch2PreBytes = Buffer.from(originalWbs);
    const branch2PostBytes = Buffer.from(validAddedWbs);

    // Replay the exact manifest and signatures from Branch 1 on Branch 2
    const branch2Result = validateWbsRegistration({
      beforeBytes: branch2PreBytes,
      afterBytes: branch2PostBytes,
      manifest: baseManifest, // Replayed!
      decision: 'APPROVED',
      trustedPolicy,
      signatures: validSignatures, // Replayed!
    });

    // FINDING PROOF: The manifest contains NO git commit SHA, branch name, nonce, expiry, or consumed receipt ID.
    // Therefore, the exact same authorization is 100% valid on any branch, fork, or commit with identical WBS bytes.
    assert.equal(branch2Result.valid, true);
    assert.equal(branch2Result.errors.length, 0);
  }
);

// ADV-FINDING-04: Weakening Policy by Altering requiredRoles or Key Roster While Retaining policyId/Version
runFindingDemonstration(
  'ADV-FINDING-04',
  'Policy weakening via mutable requiredRoles/keys with unchanged policyId and policyVersion',
  () => {
    // Manifest binds policyId: 'GOV-TEST-POLICY' and policyVersion: '1.0'
    // Weakened policy silently drops 'Lead Architect' from requiredRoles, requiring ONLY Security Officer!
    const weakenedPolicy: TrustedRegistrationPolicy = {
      policyId: baseManifest.policyId, // Still 'GOV-TEST-POLICY'
      policyVersion: baseManifest.policyVersion, // Still '1.0'
      requiredRoles: ['Security Officer'], // Weakened from 2 roles to 1!
      humanKeys: [
        makeKey('SEC-ID', 'Security Officer', 'KEY-SEC-1', secKey),
      ],
    };

    // Authorization submitted with ONLY the Security Officer signature
    const singleSignature = [
      signManifest(baseManifest, 'SEC-ID', 'Security Officer', 'KEY-SEC-1', secKey.privateKey),
    ];

    const result = validateWbsRegistration({
      beforeBytes: Buffer.from(originalWbs),
      afterBytes: Buffer.from(validAddedWbs),
      manifest: baseManifest, // Binds policyId and policyVersion strings
      decision: 'APPROVED',
      trustedPolicy: weakenedPolicy,
      signatures: singleSignature,
    });

    // FINDING PROOF: The manifest only checks string equality of policyId and policyVersion.
    // It does NOT bind a cryptographic hash of the policy contents (policySha256).
    // Thus, an administrator or adversary who can modify the policy file can weaken governance rules
    // without breaking the manifest binding!
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  }
);

console.log(`\n=== ADVERSARIAL TEST RESULTS: ${passedTests}/${totalTests} DEFENSIVE INVARIANT CHECKS PASSED ===`);
console.log(`=== EMPIRICAL FINDINGS DEMONSTRATED: ${confirmedFindings}/${totalFindings} REVIEW FINDINGS CONFIRMED ===\n`);
