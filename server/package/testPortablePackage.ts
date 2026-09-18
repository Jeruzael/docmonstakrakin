import assert from 'node:assert';
import {
  createPortablePackage,
  verifyPortablePackage,
  serializePortablePackage,
  parsePortablePackage,
  DOCMONSTAKRAKIN_PACKAGE_MAGIC,
  CURRENT_PACKAGE_SCHEMA_VERSION,
} from './portablePackage.js';
import { createChainedAuditEvent } from '../security/auditImmutability.js';
import {
  INITIAL_PROJECTS,
  INITIAL_REQUIREMENTS,
  INITIAL_RISKS,
  INITIAL_WORK_ITEMS,
} from '../../src/data/initialData.js';
import type { Project, Requirement, Risk, WorkItem, AuditEvent } from '../../src/types.js';

console.log('=== DMK-156: Running Portable .docmonstakrakin Package Unit Tests ===\n');

// Mock test project using valid initial fixtures
const testProject: Project = {
  ...INITIAL_PROJECTS[0],
  id: 'PRJ-TEST-PORTABLE-01',
  name: 'Atlas Aerospace Avionics Core',
  description: 'DO-178C Level A Flight Control Management Unit',
};

const testRequirements: Requirement[] = [
  {
    ...INITIAL_REQUIREMENTS[0],
    id: 'REQ-AV-001',
    title: 'Dual-Channel Flight Surface Actuation Control',
  },
  {
    ...INITIAL_REQUIREMENTS[1],
    id: 'REQ-AV-002',
    title: 'Fail-Operational Sensor Voting Quorum',
  },
];

const testRisks: Risk[] = [
  {
    ...INITIAL_RISKS[0],
    id: 'RSK-AV-01',
    title: 'Sensor Desynchronization under EM Interference',
  },
];

const testWorkItems: WorkItem[] = [
  {
    ...INITIAL_WORK_ITEMS[0],
    id: 'DMK-AV-101',
    title: 'Implement Actuator Timing Watchdog',
  },
];

// Construct valid chained audit events
const event1 = createChainedAuditEvent({
  actor: 'Avionics Safety Lead',
  action: 'PROJECT_CREATED',
  target: testProject.id,
  reason: 'Initial baseline for DO-178C control plane',
  details: { profile: 'AEROSPACE' },
});

const event2 = createChainedAuditEvent({
  actor: 'Safety Systems Lead',
  action: 'REQUIREMENT_APPROVED',
  target: 'REQ-AV-001',
  reason: 'Traceability validated against hazard analysis HAZ-004',
  previousEvent: event1,
});

const testAuditLogs: AuditEvent[] = [event1, event2];

let passedCount = 0;

// Test 1: Package Creation & Sealing
console.log('Test 1: Create cryptographically sealed .docmonstakrakin package');
const pkg = createPortablePackage({
  project: testProject,
  requirements: testRequirements,
  risks: testRisks,
  workItems: testWorkItems,
  auditLogs: testAuditLogs,
  actor: 'Automated CI Package Builder',
});

assert.strictEqual(pkg.manifest.magic, DOCMONSTAKRAKIN_PACKAGE_MAGIC);
assert.strictEqual(pkg.manifest.schemaVersion, CURRENT_PACKAGE_SCHEMA_VERSION);
assert.strictEqual(pkg.manifest.format, 'PORTABLE_ENVELOPE');
assert.strictEqual(pkg.seal.algorithm, 'SHA-256');
assert.strictEqual(typeof pkg.seal.canonicalStateHash, 'string');
assert.strictEqual(pkg.seal.canonicalStateHash.length, 64);
assert.strictEqual(typeof pkg.seal.envelopeHash, 'string');
assert.strictEqual(pkg.seal.envelopeHash.length, 64);
assert.strictEqual(pkg.seal.auditIntegrityVerified, true);
assert.strictEqual(pkg.seal.auditEventsCount, 2);
console.log('✓ Package created with valid manifest, knowledge, and cryptographic seal.\n');
passedCount++;

// Test 2: In-Memory Verification of Fresh Package
console.log('Test 2: Verify fresh package returns valid: true with zero errors');
const verification = verifyPortablePackage(pkg);
assert.strictEqual(verification.valid, true, `Expected valid, got errors: ${verification.errors.join(', ')}`);
assert.strictEqual(verification.errors.length, 0);
assert.strictEqual(verification.canonicalStateHash, pkg.seal.canonicalStateHash);
assert.strictEqual(verification.envelopeHash, pkg.seal.envelopeHash);
assert.strictEqual(verification.auditVerified, true);
assert.strictEqual(verification.auditEventsCount, 2);
assert.strictEqual(verification.projectId, testProject.id);
console.log('✓ Verification succeeded with matching state hash, envelope hash, and intact audit chain.\n');
passedCount++;

// Test 3: Roundtrip Serialization & Parsing Producing Identical SHA-256 State Hash (AC-1)
console.log('Test 3: Export -> Serialize -> Parse -> Verify roundtrip produces IDENTICAL state hash (AC-1)');
const serializedJson = serializePortablePackage(pkg, true);
assert(serializedJson.includes(DOCMONSTAKRAKIN_PACKAGE_MAGIC));

const parsedPkg = parsePortablePackage(serializedJson);
const roundtripVerification = verifyPortablePackage(parsedPkg);

assert.strictEqual(roundtripVerification.valid, true);
assert.strictEqual(
  roundtripVerification.canonicalStateHash,
  pkg.seal.canonicalStateHash,
  'State hash must remain exactly identical after roundtrip serialization'
);
assert.strictEqual(
  roundtripVerification.envelopeHash,
  pkg.seal.envelopeHash,
  'Envelope hash must remain exactly identical after roundtrip serialization'
);
console.log(`✓ Roundtrip verified: state hash (${roundtripVerification.canonicalStateHash}) strictly preserved.\n`);
passedCount++;

// Test 4: Tamper Detection - Knowledge Payload Mutation
console.log('Test 4: Tamper detection when project knowledge fields are mutated');
const tamperedKnowledgePkg = JSON.parse(serializedJson);
tamperedKnowledgePkg.knowledge.project.name = 'HACKED Avionics Core';

const tamperedResult = verifyPortablePackage(tamperedKnowledgePkg);
assert.strictEqual(tamperedResult.valid, false, 'Tampered project state must be rejected');
assert(
  tamperedResult.errors.some((e) => e.includes('Canonical state hash mismatch')),
  'Error must report canonical state hash mismatch'
);
console.log('✓ Tampered project state detected and rejected via state hash verification.\n');
passedCount++;

// Test 5: Tamper Detection - Requirement List Mutation
console.log('Test 5: Tamper detection when requirements are added or altered');
const tamperedReqPkg = JSON.parse(serializedJson);
tamperedReqPkg.knowledge.requirements[0].title = 'Tampered Actuator Control Specification';

const tamperedReqResult = verifyPortablePackage(tamperedReqPkg);
assert.strictEqual(tamperedReqResult.valid, false);
assert(
  tamperedReqResult.errors.some((e) => e.includes('Canonical state hash mismatch')),
  'Tampered requirement must be detected'
);
console.log('✓ Tampered requirement detected and rejected.\n');
passedCount++;

// Test 6: Tamper Detection - Audit Ledger Event Modification
console.log('Test 6: Tamper detection when audit ledger history is retroactively edited');
const tamperedAuditPkg = JSON.parse(serializedJson);
tamperedAuditPkg.auditLedger[0].actor = 'Malicious Impersonator';

const tamperedAuditResult = verifyPortablePackage(tamperedAuditPkg);
assert.strictEqual(tamperedAuditResult.valid, false);
assert(
  tamperedAuditResult.errors.some((e) => e.includes('audit chain verification failed')),
  'Broken audit chain must be flagged'
);
console.log('✓ Retroactive audit log alteration detected and rejected.\n');
passedCount++;

// Test 7: Tamper Detection - Spoofed Envelope Hash
console.log('Test 7: Tamper detection when seal is modified or mismatched');
const tamperedSealPkg = JSON.parse(serializedJson);
tamperedSealPkg.seal.envelopeHash = 'a'.repeat(64);

const tamperedSealResult = verifyPortablePackage(tamperedSealPkg);
assert.strictEqual(tamperedSealResult.valid, false);
assert(
  tamperedSealResult.errors.some((e) => e.includes('Package envelope hash mismatch')),
  'Envelope hash mismatch must be flagged'
);
console.log('✓ Mismatched envelope seal detected and rejected.\n');
passedCount++;

// Test 8: Invalid Magic or Unsupported Schema Version
console.log('Test 8: Reject unknown magic header or unsupported schema version');
const badMagicPkg = JSON.parse(serializedJson);
badMagicPkg.manifest.magic = 'UNKNOWN_PACKAGE_FORMAT';

const badMagicResult = verifyPortablePackage(badMagicPkg);
assert.strictEqual(badMagicResult.valid, false);
assert(
  badMagicResult.errors.some((e) => e.includes('Invalid magic header')),
  'Must reject invalid magic'
);

const badVersionPkg = JSON.parse(serializedJson);
badVersionPkg.manifest.schemaVersion = '99.0.0';
const badVersionResult = verifyPortablePackage(badVersionPkg);
assert.strictEqual(badVersionResult.valid, false);
assert(
  badVersionResult.errors.some((e) => e.includes('Unsupported schema version')),
  'Must reject unsupported schema version'
);
console.log('✓ Invalid magic and incompatible schema versions rejected.\n');
passedCount++;

// Test 9: Handling of Minimal / Empty Project State Safely
console.log('Test 9: Minimal project packaging and integrity sealing');
const minimalProject: Project = {
  ...INITIAL_PROJECTS[0],
  id: 'PRJ-MIN-01',
  name: 'Minimal Clean Project',
  description: 'Clean slate project',
  stateVersion: 1,
  healthScore: 100,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  owner: 'Solo Developer',
};

const minimalPkg = createPortablePackage({
  project: minimalProject,
  auditLogs: [],
});

const minimalVerification = verifyPortablePackage(minimalPkg);
assert.strictEqual(minimalVerification.valid, true);
assert.strictEqual(minimalVerification.auditEventsCount, 0);
assert.strictEqual(minimalVerification.projectId, minimalProject.id);
console.log('✓ Minimal project packaged, sealed, and verified successfully.\n');
passedCount++;

console.log(`=== ALL ${passedCount}/${passedCount} PORTABLE PACKAGE UNIT TESTS PASSED ===`);
