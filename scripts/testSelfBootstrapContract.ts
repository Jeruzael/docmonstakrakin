/**
 * docmonstakrakin - Self-Bootstrap Contract & Schema Test Suite
 * Validates the schema, referential integrity rules, governance restrictions,
 * sensitive key scanning, canonical serialization, and dry-run reporting
 * for SELF_BOOTSTRAP_V1.
 */

import assert from 'node:assert/strict';
import {
  SELF_BOOTSTRAP_SCHEMA_VERSION,
  SELF_BOOTSTRAP_MODE,
  validateSelfBootstrapManifest,
  computeBootstrapManifestDigest,
  computeBootstrapDryRunReport,
  canonicalizeJson,
  type SelfBootstrapManifest,
} from '../src/data/selfBootstrapContract.js';

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
      baselineCommit: '0a54283cdd4f0d26bc138d01c037ad1dee5bc018',
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
        status: 'APPROVED',
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
        status: 'ACCEPTED',
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
        status: 'VERIFIED',
        priority: 'P0',
        risk: 'HIGH',
        sprint: 1,
        requirements: ['REQ-001'],
        dependencies: [],
        acceptanceCriteria: ['Passes contract tests citing EVID-001'],
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

test('governance fields (approvals, signatures, releaseSignoff) are strictly forbidden', () => {
  const forbiddenGovernance = ['approvals', 'signatures', 'releaseSignoff', 'gate7Approval'];
  for (const field of forbiddenGovernance) {
    const corrupted: any = createValidManifest();
    corrupted[field] = [{ approvedBy: 'someone', timestamp: '2026-09-19T00:00:00Z' }];
    const res = validateSelfBootstrapManifest(corrupted);
    assert.equal(res.valid, false);
    assert(res.errors.some((e) => e.includes(`Governance field '${field}' is strictly forbidden`)));
  }
});

test('work items with status APPROVED or RELEASED are rejected', () => {
  for (const badStatus of ['APPROVED', 'RELEASED'] as const) {
    const manifest = createValidManifest();
    manifest.workItems[0].status = badStatus;
    const res = validateSelfBootstrapManifest(manifest);
    assert.equal(res.valid, false);
    assert(res.errors.some((e) => e.includes(`has forbidden status '${badStatus}'`)));
  }
});

test('work items marked VERIFIED without supporting evidence are rejected', () => {
  const manifest = createValidManifest();
  manifest.workItems[0].status = 'VERIFIED';
  manifest.workItems[0].evidence = [];
  manifest.workItems[0].acceptanceCriteria = ['Plain text criteria with no evidence reference'];
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes('does not cite supporting evidence')));
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

test('referential integrity: missing requirement reference in workItem is rejected', () => {
  const manifest = createValidManifest();
  manifest.workItems[0].requirements = ['REQ-MISSING'];
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes(`references non-existent requirement 'REQ-MISSING'`)));
});

test('referential integrity: missing risk reference in requirement is rejected', () => {
  const manifest = createValidManifest();
  manifest.requirements[0].riskLinks = ['RISK-NONEXISTENT'];
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes(`references non-existent risk 'RISK-NONEXISTENT'`)));
});

test('referential integrity: missing threat reference in requirement is rejected', () => {
  const manifest = createValidManifest();
  manifest.requirements[0].threatLinks = ['THREAT-NONEXISTENT'];
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes(`references non-existent threat 'THREAT-NONEXISTENT'`)));
});

test('referential integrity: missing evidence reference in workItem is rejected', () => {
  const manifest = createValidManifest();
  manifest.workItems[0].evidence = ['EVID-GHOST'];
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes(`references non-existent evidence 'EVID-GHOST'`)));
});

test('cross-project entity contamination is rejected', () => {
  const manifest = createValidManifest();
  (manifest.requirements[0] as any).projectId = 'PRJ-DIFFERENT-EXTERNAL';
  const res = validateSelfBootstrapManifest(manifest);
  assert.equal(res.valid, false);
  assert(res.errors.some((e) => e.includes(`belongs to foreign project 'PRJ-DIFFERENT-EXTERNAL'`)));
});

test('controlled document reference enforces kind and authority enums', () => {
  const manifest1 = createValidManifest();
  manifest1.documents[0].kind = 'INVALID_KIND' as any;
  const res1 = validateSelfBootstrapManifest(manifest1);
  assert.equal(res1.valid, false);
  assert(res1.errors.some((e) => e.includes(`has invalid kind 'INVALID_KIND'`)));

  const manifest2 = createValidManifest();
  manifest2.documents[0].authority = 'SUPREME_COMMAND' as any;
  const res2 = validateSelfBootstrapManifest(manifest2);
  assert.equal(res2.valid, false);
  assert(res2.errors.some((e) => e.includes(`has invalid authority 'SUPREME_COMMAND'`)));
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
  assert.equal(typeof dryRun.manifestDigest, 'string');
  assert.equal(dryRun.unresolvedReferenceErrors.length, 0);
});

console.log(`\n=== Self-Bootstrap Contract Verification Complete ===`);
console.log(`Results: ${failures === 0 ? 'ALL TESTS PASSED' : `${failures} FAILURES`}`);
process.exitCode = failures ? 1 : 0;
