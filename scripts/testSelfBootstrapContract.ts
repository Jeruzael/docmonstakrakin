/**
 * docmonstakrakin - Self-Bootstrap Contract & Schema Test Suite (Hardened V1)
 * Validates the schema, referential integrity rules, governance restrictions,
 * sensitive key scanning, runtime enums, canonical serialization, and dry-run reporting
 * for SELF_BOOTSTRAP_V1.
 */

import assert from 'node:assert/strict';
import {
  SELF_BOOTSTRAP_SCHEMA_VERSION,
  SELF_BOOTSTRAP_MODE,
  SELF_BOOTSTRAP_DEFAULT_PROJECT_ID,
  SELF_BOOTSTRAP_DEFAULT_REPOSITORY,
  validateSelfBootstrapManifest,
  computeBootstrapManifestDigest,
  computeBootstrapDryRunReport,
  canonicalizeJson,
  type SelfBootstrapManifest,
} from '../src/data/selfBootstrapContract.js';
import { canonicalizeJson as portableCanonicalizeJson } from '../server/package/portablePackage.js';

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log('PASS ' + name);
  } catch (e) {
    failures++;
    console.error('FAIL ' + name, e);
  }
}

function createValidManifest(): SelfBootstrapManifest {
  return {
    schemaVersion: SELF_BOOTSTRAP_SCHEMA_VERSION,
    mode: SELF_BOOTSTRAP_MODE,
    provenance: {
      repository: 'Jeruzael/docmonstakrakin',
      baselineCommit: 'ab3cdda66f59b1e0acef3299d6107cfa09d5efa7',
      source: 'LOCAL_REPOSITORY_DOCUMENTATION',
      preparedAt: '2026-09-19T00:00:00Z',
      preparer: 'docmonstakrakin-bootstrap-contract',
    },
    project: {
      id: 'PRJ-DOCMONSTAKRAKIN',
      name: 'docmonstakrakin',
      description: 'A-SSDLC Development Control Plane',
      maturity: 'EXISTING_PROJECT',
      profiles: ['WEB_APPLICATION', 'BACKEND_API'],
      specializedProfiles: ['DEVELOPER_TOOL', 'INTERNAL_TOOL'],
      deliveryMethod: 'ITERATIVE',
      deploymentIntent: 'Containerized Web Application on Cloud Run',
      dataSensitivity: 'CONFIDENTIAL',
      lifecyclePhase: 'IMPLEMENTATION',
      stateVersion: 1,
      owner: 'docmonstakrakin-core',
      targetRelease: 'v0.1.0-rc1',
      createdAt: '2026-09-19T00:00:00Z',
      updatedAt: '2026-09-19T00:00:00Z',
      healthScore: 100,
      progress: {
        requirementsReadiness: 100,
        architectureReadiness: 100,
        implementation: 100,
        verification: 100,
        securityAssurance: 100,
        releaseReadiness: 85,
      },
    },
    features: [
      {
        id: 'FEAT-001',
        title: 'Project Control Plane',
        description: 'Core project management and governance tracking',
        capability: 'Control Plane Management',
        priority: 'P0',
        status: 'PROPOSED', // Allowed during bootstrap (APPROVED is forbidden)
        source: 'PRODUCT_BASELINE',
        personas: ['developer', 'architect'],
        requirements: ['REQ-001'],
        dependencies: [],
        updatedAt: '2026-09-19T00:00:00Z',
      },
    ],
    requirements: [
      {
        id: 'REQ-001',
        title: 'Self-Bootstrap Contract',
        statement: 'The system must provide deterministic self-bootstrap validation.',
        category: 'FUNCTIONAL',
        status: 'VERIFIED',
        priority: 'HIGH',
        source: {
          type: 'wizard_baseline',
          id: 'SYS-BOOTSTRAP',
        },
        riskLinks: ['RISK-001'],
        threatLinks: ['THREAT-001'],
        standardLinks: [],
        workItems: ['DMK-200'],
        tests: ['TEST-BOOTSTRAP-001'],
        evidence: ['EVID-001'],
        linkedFeatureId: 'FEAT-001',
        updatedAt: '2026-09-19T00:00:00Z',
      },
    ],
    risks: [
      {
        id: 'RISK-001',
        title: 'Unauthorized Bootstrap Mutation',
        description: 'Tampered bootstrap payload compromises project state',
        drivers: ['tampering', 'unauthorized injection'],
        inherentLikelihood: 2,
        inherentImpact: 4,
        inherentScore: 8,
        inherentLevel: 'HIGH',
        residualLikelihood: 1,
        residualImpact: 2,
        residualScore: 2,
        residualLevel: 'LOW',
        treatment: 'MITIGATE',
        controls: ['SEC-CTRL-BOOTSTRAP'],
      },
    ],
    threats: [
      {
        id: 'THREAT-001',
        title: 'Secret Leakage via Bootstrap Manifest',
        attackSurface: 'Bootstrap Importer',
        asset: 'Credentials and Master Keys',
        impact: 'Credential compromise',
        likelihood: 2,
        impactScore: 4,
        riskLevel: 'HIGH',
        mitigations: [
          {
            title: 'Structural sensitive key scanner',
            status: 'RESOLVED',
          },
        ],
      },
    ],
    adrs: [
      {
        id: 'ADR-001',
        title: 'Use Deterministic Self-Bootstrap Schema',
        status: 'PROPOSED', // Allowed during bootstrap (ACCEPTED is forbidden)
        date: '2026-09-19',
        author: 'System Architect',
        context: 'Canonical knowledge initialization requires safe contracts',
        decision: 'Implement SELF_BOOTSTRAP_V1 with atomic commit and SHA-256 sealing',
        consequences: {
          positive: ['Safe, reproducible project bootstrapping without external side-effects'],
          negative: [],
          risks: [],
        },
        linkedRequirements: ['REQ-001'],
        linkedRisks: ['RISK-001'],
        linkedStandards: [],
        updatedAt: '2026-09-19T00:00:00Z',
      },
    ],
    components: [
      {
        id: 'COMP-001',
        name: 'Bootstrap Engine',
        category: 'SERVICE',
        trustZone: 'INTERNAL_SECURE',
        technology: 'TypeScript / Node.js',
        description: 'Executes validated project bootstrap',
        dataClassification: 'INTERNAL',
        inboundProtocols: ['CLI'],
        outboundProtocols: ['LOCAL_FS'],
        assignedRequirements: ['REQ-001'],
        linkedADRs: ['ADR-001'],
        securityControls: ['SEC-CTRL-BOOTSTRAP'],
      },
    ],
    workItems: [
      {
        id: 'DMK-200',
        type: 'TASK',
        title: 'Self-Bootstrap Contract Definition',
        description: 'Define schema and contract for self-bootstrap',
        status: 'VERIFICATION', // Technical evidence exists; VERIFIED is forbidden during bootstrap
        priority: 'P0',
        risk: 'HIGH',
        sprint: 1,
        requirements: ['REQ-001'],
        dependencies: [],
        acceptanceCriteria: ['Passes contract test suite'],
        checklist: [{ text: 'Write contract', done: true }],
        tests: ['TEST-BOOTSTRAP-001'],
        evidence: ['EVID-001'],
        features: ['FEAT-001'],
        updatedAt: '2026-09-19T00:00:00Z',
      },
    ],
    evidence: [
      {
        id: 'EVID-001',
        type: 'TEST_RUN',
        title: 'Contract test execution report',
        workItemId: 'DMK-200',
        result: 'VERIFIED',
        producer: 'automated-test-runner',
        createdAt: '2026-09-19T00:00:00Z',
        sha256Hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        details: 'Self-bootstrap contract test suite passed with 0 errors.',
      },
    ],
    documents: [
      {
        id: 'DOC-001',
        path: 'docs/00_control/SELF_BOOTSTRAP_CONTRACT.md',
        kind: 'CONTROL',
        authority: 'REFERENCE',
        title: 'Self-Bootstrap Contract',
        description: 'Governs self-bootstrap schema and validation',
        sha256Digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ],
  };
}

// --- TEST CASES ---

test('valid complete manifest passes validation with zero errors', () => {
  const manifest = createValidManifest();
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, true, `Validation failed: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0);
  assert.equal(res.counts.features, 1);
  assert.equal(res.counts.requirements, 1);
  assert.equal(res.counts.risks, 1);
  assert.equal(res.counts.threats, 1);
  assert.equal(res.counts.adrs, 1);
  assert.equal(res.counts.components, 1);
  assert.equal(res.counts.workItems, 1);
  assert.equal(res.counts.evidence, 1);
  assert.equal(res.counts.documents, 1);
  assert.equal(typeof res.manifestDigest, 'string');
  assert.equal(res.manifestDigest?.length, 64);
});

test('invalid schemaVersion and mode fail validation', () => {
  const badSchema = { ...createValidManifest(), schemaVersion: 'INVALID_VERSION' };
  const res1 = validateSelfBootstrapManifest(badSchema);
  assert.equal(res1.valid, false);
  assert(res1.errors.some((e) => e.includes('Invalid schemaVersion')));

  const badMode = { ...createValidManifest(), mode: 'UNTRUSTED_REMOTE_IMPORT' };
  const res2 = validateSelfBootstrapManifest(badMode);
  assert.equal(res2.valid, false);
  assert(res2.errors.some((e) => e.includes('Invalid mode')));
});

test('closed root schema: unexpected root properties are strictly rejected', () => {
  const unexpectedProperties = [
    'approvals',
    'auditLogs',
    'releaseSignoff',
    'hiddenState',
    'arbitraryExtension',
    'credentials',
    'runtimeState',
  ];

  for (const prop of unexpectedProperties) {
    const corrupted: any = createValidManifest();
    corrupted[prop] = { unauthorized: true };
    const res = validateSelfBootstrapManifest(corrupted);
    assert.equal(res.valid, false, `Expected rejection for unexpected root property '${prop}'`);
    assert(
      res.errors.some((e) => e.includes(`Unexpected root property '${prop}'`)),
      `Error did not cite unexpected root property '${prop}'`
    );
  }
});

test('provenance & identity: enforces PRJ-DOCMONSTAKRAKIN, repository, and 40-character Git SHA', () => {
  // Wrong project ID
  const badProj = createValidManifest();
  badProj.project.id = 'PRJ-SOME-OTHER-APP';
  const res1 = validateSelfBootstrapManifest(badProj);
  assert.equal(res1.valid, false);
  assert(res1.errors.some((e) => e.includes(`Project ID must be exactly '${SELF_BOOTSTRAP_DEFAULT_PROJECT_ID}'`)));

  // Wrong repository
  const badRepo = createValidManifest();
  badRepo.provenance.repository = 'Attacker/fake-repo';
  const res2 = validateSelfBootstrapManifest(badRepo);
  assert.equal(res2.valid, false);
  assert(res2.errors.some((e) => e.includes(`Provenance repository must be exactly '${SELF_BOOTSTRAP_DEFAULT_REPOSITORY}'`)));

  // Malformed baselineCommit: non-hex
  const badSha1 = createValidManifest();
  badSha1.provenance.baselineCommit = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
  const res3 = validateSelfBootstrapManifest(badSha1);
  assert.equal(res3.valid, false);
  assert(res3.errors.some((e) => e.includes('Provenance baselineCommit must be a valid 40-character hexadecimal')));

  // Malformed baselineCommit: too short
  const badSha2 = createValidManifest();
  badSha2.provenance.baselineCommit = 'ab3cdda66f';
  const res4 = validateSelfBootstrapManifest(badSha2);
  assert.equal(res4.valid, false);
  assert(res4.errors.some((e) => e.includes('Provenance baselineCommit must be a valid 40-character hexadecimal')));

  // Malformed baselineCommit: too long
  const badSha3 = createValidManifest();
  badSha3.provenance.baselineCommit = 'ab3cdda66f59b1e0acef3299d6107cfa09d5efa712345';
  const res5 = validateSelfBootstrapManifest(badSha3);
  assert.equal(res5.valid, false);
  assert(res5.errors.some((e) => e.includes('Provenance baselineCommit must be a valid 40-character hexadecimal')));
});

test('structural sensitive-key scanner detects prohibited credential fields at root or nested levels', () => {
  const suspiciousKeys = [
    'password',
    'secret',
    'apiKey',
    'api_key',
    'token',
    'machineToken',
    'machine_token',
    'privateKey',
    'credential',
    'verifier',
    'auth_tag',
  ];

  for (const key of suspiciousKeys) {
    const corrupted: any = createValidManifest();
    corrupted.project[key] = 'super-secret-value-never-to-be-printed';
    const res = validateSelfBootstrapManifest(corrupted);
    assert.equal(res.valid, false, `Should have rejected sensitive key '${key}'`);
    assert(
      res.errors.some((e) => e.includes(`Prohibited sensitive key detected`)),
      `Error did not report sensitive key '${key}'`
    );
    // CRITICAL SECURITY INVARIANT: Error messages must NEVER contain the secret value!
    for (const err of res.errors) {
      assert(
        !err.includes('super-secret-value-never-to-be-printed'),
        `Error message leaked secret value: ${err}`
      );
    }
  }
});

test('recursive governance field scanning detects injection at any depth without leaking values', () => {
  const injectionVectors: [string, (m: any) => void][] = [
    ['project.releaseSignoff', (m) => { m.project.releaseSignoff = { signed: true, secret: 'val' }; }],
    ['documents[0].approvals', (m) => { m.documents[0].approvals = ['admin']; }],
    ['features[0].signatures', (m) => { m.features[0].signatures = ['sig-abc']; }],
    ['workItems[0].authorizedBy', (m) => { m.workItems[0].authorizedBy = 'Chief Officer'; }],
    ['project.gate7Approval', (m) => { m.project.gate7Approval = { passed: true }; }],
    ['requirements[0].approvalsCollected', (m) => { m.requirements[0].approvalsCollected = 5; }],
  ];

  for (const [vectorName, mutator] of injectionVectors) {
    const corrupted: any = createValidManifest();
    mutator(corrupted);
    const res = validateSelfBootstrapManifest(corrupted);
    assert.equal(res.valid, false, `Should have failed governance injection at ${vectorName}`);
    assert(
      res.errors.some((e) => e.includes('strictly forbidden in bootstrap manifests')),
      `Expected governance field rejection for vector ${vectorName}`
    );
    // Verify no secret or value was leaked
    for (const err of res.errors) {
      assert(!err.includes('Chief Officer') && !err.includes('sig-abc'));
    }
  }
});

test('workItem status rules: VERIFIED, APPROVED, and RELEASED are strictly forbidden', () => {
  for (const badStatus of ['VERIFIED', 'APPROVED', 'RELEASED'] as const) {
    const manifest = createValidManifest();
    manifest.workItems[0].status = badStatus;
    const res = validateSelfBootstrapManifest(manifest);
    assert.equal(res.valid, false);
    assert(
      res.errors.some((e) => e.includes(`WorkItem 'DMK-200' has forbidden status '${badStatus}'`)),
      `Expected rejection of WorkItem status '${badStatus}'`
    );
  }

  // Allowed statuses
  for (const allowedStatus of ['PROPOSED', 'BACKLOG', 'READY', 'IN_PROGRESS', 'VERIFICATION', 'DEFERRED'] as const) {
    const manifest = createValidManifest();
    manifest.workItems[0].status = allowedStatus;
    const res = validateSelfBootstrapManifest(manifest);
    assert.equal(res.valid, true, `Allowed status '${allowedStatus}' failed: ${res.errors.join('; ')}`);
  }
});

test('governance-bearing entity statuses: Requirement APPROVED, ADR ACCEPTED, Feature APPROVED are rejected', () => {
  // Requirement APPROVED rejected
  const badReq = createValidManifest();
  badReq.requirements[0].status = 'APPROVED';
  const res1 = validateSelfBootstrapManifest(badReq);
  assert.equal(res1.valid, false);
  assert(res1.errors.some((e) => e.includes("Requirement 'REQ-001' has forbidden status 'APPROVED'")));

  // ADR ACCEPTED rejected
  const badAdr = createValidManifest();
  badAdr.adrs[0].status = 'ACCEPTED';
  const res2 = validateSelfBootstrapManifest(badAdr);
  assert.equal(res2.valid, false);
  assert(res2.errors.some((e) => e.includes("ADR 'ADR-001' has forbidden status 'ACCEPTED'")));

  // Feature APPROVED rejected
  const badFeat = createValidManifest();
  badFeat.features[0].status = 'APPROVED';
  const res3 = validateSelfBootstrapManifest(badFeat);
  assert.equal(res3.valid, false);
  assert(res3.errors.some((e) => e.includes("Feature 'FEAT-001' has forbidden status 'APPROVED'")));
});

test('strict runtime enum validation: domain types validated against allowlists without leaking raw values', () => {
  // Invalid project lifecyclePhase
  const m1 = createValidManifest();
  (m1.project as any).lifecyclePhase = 'MAGIC_PHASE';
  const res1 = validateSelfBootstrapManifest(m1);
  assert.equal(res1.valid, false);
  assert(res1.errors.some((e) => e.includes("Invalid enum value at 'project.lifecyclePhase'")));
  assert(!res1.errors.some((e) => e.includes('MAGIC_PHASE'))); // Security invariant: no raw value leakage

  // Invalid requirement category
  const m2 = createValidManifest();
  (m2.requirements[0] as any).category = 'CUSTOM_CAT';
  const res2 = validateSelfBootstrapManifest(m2);
  assert.equal(res2.valid, false);
  assert(res2.errors.some((e) => e.includes("Invalid enum value at 'requirements[0].category'")));

  // Invalid risk treatment
  const m3 = createValidManifest();
  (m3.risks[0] as any).treatment = 'YOLO';
  const res3 = validateSelfBootstrapManifest(m3);
  assert.equal(res3.valid, false);
  assert(res3.errors.some((e) => e.includes("Invalid enum value at 'risks[0].treatment'")));

  // Invalid architecture component trustZone
  const m4 = createValidManifest();
  (m4.components[0] as any).trustZone = 'OUTER_SPACE';
  const res4 = validateSelfBootstrapManifest(m4);
  assert.equal(res4.valid, false);
  assert(res4.errors.some((e) => e.includes("Invalid enum value at 'components[0].trustZone'")));

  // Invalid evidence result
  const m5 = createValidManifest();
  (m5.evidence[0] as any).result = 'PRETTY_GOOD';
  const res5 = validateSelfBootstrapManifest(m5);
  assert.equal(res5.valid, false);
  assert(res5.errors.some((e) => e.includes("Invalid enum value at 'evidence[0].result'")));
});

test('duplicate entity IDs in any canonical collection are detected and rejected', () => {
  const manifest = createValidManifest();
  manifest.requirements.push({
    ...manifest.requirements[0],
    title: 'Duplicate Requirement',
  });
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes(`Duplicate ID 'REQ-001'`)));
});

test('complete referential integrity: verifies cross-entity link resolution', () => {
  // Feature -> non-existent requirement
  const m1 = createValidManifest();
  m1.features[0].requirements = ['REQ-NONEXISTENT'];
  const res1 = validateSelfBootstrapManifest(m1);
  assert.equal(res1.valid, false);
  assert(res1.errors.some((e) => e.includes("Feature 'FEAT-001' references non-existent requirement 'REQ-NONEXISTENT'")));

  // Feature -> non-existent dependency
  const m2 = createValidManifest();
  m2.features[0].dependencies = ['FEAT-GHOST'];
  const res2 = validateSelfBootstrapManifest(m2);
  assert.equal(res2.valid, false);
  assert(res2.errors.some((e) => e.includes("Feature 'FEAT-001' references non-existent dependency feature 'FEAT-GHOST'")));

  // Requirement -> non-existent risk
  const m3 = createValidManifest();
  m3.requirements[0].riskLinks = ['RISK-NONEXISTENT'];
  const res3 = validateSelfBootstrapManifest(m3);
  assert.equal(res3.valid, false);
  assert(res3.errors.some((e) => e.includes("Requirement 'REQ-001' references non-existent risk 'RISK-NONEXISTENT'")));

  // Requirement -> non-existent threat
  const m4 = createValidManifest();
  m4.requirements[0].threatLinks = ['THREAT-NONEXISTENT'];
  const res4 = validateSelfBootstrapManifest(m4);
  assert.equal(res4.valid, false);
  assert(res4.errors.some((e) => e.includes("Requirement 'REQ-001' references non-existent threat 'THREAT-NONEXISTENT'")));

  // Requirement -> non-existent workItem
  const m5 = createValidManifest();
  m5.requirements[0].workItems = ['DMK-GHOST'];
  const res5 = validateSelfBootstrapManifest(m5);
  assert.equal(res5.valid, false);
  assert(res5.errors.some((e) => e.includes("Requirement 'REQ-001' references non-existent workItem 'DMK-GHOST'")));

  // Requirement -> non-existent evidence
  const m6 = createValidManifest();
  m6.requirements[0].evidence = ['EVID-GHOST'];
  const res6 = validateSelfBootstrapManifest(m6);
  assert.equal(res6.valid, false);
  assert(res6.errors.some((e) => e.includes("Requirement 'REQ-001' references non-existent evidence 'EVID-GHOST'")));

  // ADR -> non-existent requirement
  const m7 = createValidManifest();
  m7.adrs[0].linkedRequirements = ['REQ-MISSING'];
  const res7 = validateSelfBootstrapManifest(m7);
  assert.equal(res7.valid, false);
  assert(res7.errors.some((e) => e.includes("ADR 'ADR-001' references non-existent requirement 'REQ-MISSING'")));

  // ADR -> non-existent risk
  const m8 = createValidManifest();
  m8.adrs[0].linkedRisks = ['RISK-MISSING'];
  const res8 = validateSelfBootstrapManifest(m8);
  assert.equal(res8.valid, false);
  assert(res8.errors.some((e) => e.includes("ADR 'ADR-001' references non-existent risk 'RISK-MISSING'")));

  // WorkItem -> non-existent requirement
  const m9 = createValidManifest();
  m9.workItems[0].requirements = ['REQ-MISSING'];
  const res9 = validateSelfBootstrapManifest(m9);
  assert.equal(res9.valid, false);
  assert(res9.errors.some((e) => e.includes("WorkItem 'DMK-200' references non-existent requirement 'REQ-MISSING'")));

  // WorkItem -> non-existent feature
  const m10 = createValidManifest();
  m10.workItems[0].features = ['FEAT-MISSING'];
  const res10 = validateSelfBootstrapManifest(m10);
  assert.equal(res10.valid, false);
  assert(res10.errors.some((e) => e.includes("WorkItem 'DMK-200' references non-existent feature 'FEAT-MISSING'")));

  // WorkItem -> non-existent evidence
  const m11 = createValidManifest();
  m11.workItems[0].evidence = ['EVID-GHOST'];
  const res11 = validateSelfBootstrapManifest(m11);
  assert.equal(res11.valid, false);
  assert(res11.errors.some((e) => e.includes("WorkItem 'DMK-200' references non-existent evidence 'EVID-GHOST'")));

  // WorkItem -> non-existent dependency
  const m12 = createValidManifest();
  m12.workItems[0].dependencies = ['DMK-MISSING'];
  const res12 = validateSelfBootstrapManifest(m12);
  assert.equal(res12.valid, false);
  assert(res12.errors.some((e) => e.includes("WorkItem 'DMK-200' references non-existent dependency workItem 'DMK-MISSING'")));

  // Evidence -> non-existent workItemId
  const m13 = createValidManifest();
  m13.evidence[0].workItemId = 'DMK-GHOST';
  const res13 = validateSelfBootstrapManifest(m13);
  assert.equal(res13.valid, false);
  assert(res13.errors.some((e) => e.includes("Evidence 'EVID-001' references non-existent workItemId 'DMK-GHOST'")));

  // ArchitectureComponent -> non-existent requirement
  const m14 = createValidManifest();
  m14.components[0].assignedRequirements = ['REQ-GHOST'];
  const res14 = validateSelfBootstrapManifest(m14);
  assert.equal(res14.valid, false);
  assert(res14.errors.some((e) => e.includes("ArchitectureComponent 'COMP-001' references non-existent requirement 'REQ-GHOST'")));

  // ArchitectureComponent -> non-existent ADR
  const m15 = createValidManifest();
  m15.components[0].linkedADRs = ['ADR-GHOST'];
  const res15 = validateSelfBootstrapManifest(m15);
  assert.equal(res15.valid, false);
  assert(res15.errors.some((e) => e.includes("ArchitectureComponent 'COMP-001' references non-existent ADR 'ADR-GHOST'")));
});

test('controlled document path validation: enforces repository-relative, docs/ prefix, traversal rejection', () => {
  const invalidPaths = [
    ['/etc/passwd', 'absolute POSIX path'],
    ['C:\\Users\\admin\\secret.txt', 'absolute Windows path'],
    ['\\\\server\\share\\doc.md', 'absolute Windows path'],
    ['docs/../../secret.txt', 'forbidden \'..\' directory traversal'],
    ['../outside.md', 'forbidden \'..\' directory traversal'],
    ['src/index.ts', 'must be repository-relative under \'docs/\''],
    ['', 'must specify a non-empty string \'path\''],
  ];

  for (const [path, expectedReason] of invalidPaths) {
    const manifest = createValidManifest();
    manifest.documents[0].path = path;
    const res = validateSelfBootstrapManifest(manifest);
    assert.equal(res.valid, false, `Path '${path}' should have failed`);
    assert(
      res.errors.some((e) => e.includes(expectedReason)),
      `Error did not mention '${expectedReason}' for path '${path}': ${res.errors.join('; ')}`
    );
  }

  // Digest validation: invalid hex or wrong length rejected
  const badDigestManifest = createValidManifest();
  badDigestManifest.documents[0].sha256Digest = 'not-a-valid-sha256';
  const resDigest = validateSelfBootstrapManifest(badDigestManifest);
  assert.equal(resDigest.valid, false);
  assert(resDigest.errors.some((e) => e.includes('sha256Digest must be a valid 64-character hexadecimal SHA-256 string')));
});

test('cross-project entity contamination is rejected', () => {
  const manifest = createValidManifest();
  (manifest.requirements[0] as any).projectId = 'PRJ-DIFFERENT-EXTERNAL';
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes(`belongs to foreign project 'PRJ-DIFFERENT-EXTERNAL'`)));
});

test('canonical JSON serialization is key-order invariant and produces deterministic SHA-256 digest', () => {
  const objA = { z: 1, a: 'hello', m: [3, 2, 1], nested: { y: true, b: false } };
  const objB = { nested: { b: false, y: true }, m: [3, 2, 1], a: 'hello', z: 1 };

  assert.equal(canonicalizeJson(objA), canonicalizeJson(objB));
  const digestA = computeBootstrapManifestDigest(objA);
  const digestB = computeBootstrapManifestDigest(objB);
  assert.equal(digestA, digestB);
  assert.equal(typeof digestA, 'string');
  assert.equal(digestA.length, 64);
});

test('canonical JSON compatibility: self-bootstrap helper matches portable-package helper identically', () => {
  const testObjects = [
    { a: 1, b: 2, c: [1, 2, 3] },
    { z: 'end', a: 'start', nested: { beta: 2, alpha: 1 } },
    { arrayWithNested: [{ b: 2, a: 1 }, { d: 4, c: 3 }], flag: true, nullVal: null },
    createValidManifest(),
  ];

  for (const obj of testObjects) {
    const str1 = canonicalizeJson(obj);
    const str2 = portableCanonicalizeJson(obj as any);
    assert.equal(str1, str2, 'Canonical serialization produced divergent output');
  }
});

test('dry-run report accurately summarizes manifest and guarantees zero mutations', () => {
  const manifest = createValidManifest();
  const dryRun = computeBootstrapDryRunReport(manifest);

  assert.equal(dryRun.valid, true);
  assert.equal(dryRun.errors.length, 0);
  assert.equal(dryRun.mutationCount, 0, 'Dry-run must make zero mutations');
  assert.equal(dryRun.mode, 'TRUSTED_LOCAL_BOOTSTRAP');
  assert.equal(dryRun.projectToCreate?.id, 'PRJ-DOCMONSTAKRAKIN');
  assert.equal(dryRun.projectToCreate?.name, 'docmonstakrakin');
  assert.equal(dryRun.counts.features, 1);
  assert.equal(dryRun.counts.requirements, 1);
  assert.equal(dryRun.counts.workItems, 1);
  assert.equal(dryRun.counts.evidence, 1);
  assert.equal(dryRun.counts.documents, 1);
  assert(dryRun.governanceRestrictions.length > 0);
  assert(dryRun.governanceRestrictions.some((r) => r.includes('Gate 7 status = HUMAN_APPROVAL_REQUIRED')));
  assert(dryRun.governanceRestrictions.some((r) => r.includes('approvals = []')));
  assert(dryRun.governanceRestrictions.some((r) => r.includes('Closed root schema enforced')));
  assert.equal(typeof dryRun.manifestDigest, 'string');
  assert.equal(dryRun.unresolvedReferenceErrors.length, 0);
});

console.log(`\n=== Self-Bootstrap Contract Verification Complete ===`);
console.log(`Results: ${failures === 0 ? 'ALL TESTS PASSED' : `${failures} FAILURES`}`);
process.exitCode = failures ? 1 : 0;
