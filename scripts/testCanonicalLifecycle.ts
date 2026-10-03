import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  CANONICAL_LIFECYCLE_STATUSES,
  CANONICAL_LIFECYCLE_DEFINITIONS,
  isCanonicalLifecycleStatus,
  assertCanonicalLifecycleStatus,
  type CanonicalLifecycleStatus,
} from '../server/workTracking/canonicalLifecycle.ts';
import { parseCanonicalWbsBytes, readCanonicalWbs } from '../server/workTracking/canonicalWbs.ts';
import { mapCanonicalStatus } from '../server/workTracking/wbsMapping.ts';

let passed = 0;
let failed = 0;

function scenario(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS Scenario: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL Scenario: ${name}:`, err);
    failed++;
  }
}

console.log('--- Starting Canonical Lifecycle & Mapping Test Suite (DMK-208) ---');

// A. Approved canonical lifecycle contains exactly 7 states
scenario('Canonical lifecycle contains exactly 7 states', () => {
  assert.equal(CANONICAL_LIFECYCLE_STATUSES.length, 7);
  assert.equal(Object.keys(CANONICAL_LIFECYCLE_DEFINITIONS).length, 7);
});

// B. All seven expected names are present
scenario('All seven expected canonical states are present', () => {
  const expected: CanonicalLifecycleStatus[] = [
    'PROPOSED',
    'BACKLOG',
    'READY',
    'IN_PROGRESS',
    'IMPLEMENTED',
    'VERIFICATION_PENDING',
    'VERIFIED',
  ];
  for (const s of expected) {
    assert.ok(CANONICAL_LIFECYCLE_STATUSES.includes(s), `Missing status: ${s}`);
    assert.ok(isCanonicalLifecycleStatus(s), `isCanonicalLifecycleStatus failed for: ${s}`);
    assert.doesNotThrow(() => assertCanonicalLifecycleStatus(s), `assertCanonicalLifecycleStatus threw for: ${s}`);
  }
});

// C. BACKLOG is present
scenario('BACKLOG is present in canonical lifecycle', () => {
  assert.ok(CANONICAL_LIFECYCLE_STATUSES.includes('BACKLOG'));
  assert.equal(CANONICAL_LIFECYCLE_DEFINITIONS.BACKLOG.status, 'BACKLOG');
});

// D. IN_PROGRESS is present
scenario('IN_PROGRESS is present in canonical lifecycle', () => {
  assert.ok(CANONICAL_LIFECYCLE_STATUSES.includes('IN_PROGRESS'));
  assert.equal(CANONICAL_LIFECYCLE_DEFINITIONS.IN_PROGRESS.status, 'IN_PROGRESS');
});

// E-I. Excluded states must not be part of canonical v1
scenario('BLOCKED is not part of canonical v1 lifecycle', () => {
  assert.ok(!CANONICAL_LIFECYCLE_STATUSES.includes('BLOCKED' as any));
  assert.equal(isCanonicalLifecycleStatus('BLOCKED'), false);
  assert.throws(() => assertCanonicalLifecycleStatus('BLOCKED', 'TEST-01'), /UNSUPPORTED_WBS_STATUS/);
});

scenario('DEFERRED is not part of canonical v1 lifecycle', () => {
  assert.ok(!CANONICAL_LIFECYCLE_STATUSES.includes('DEFERRED' as any));
  assert.equal(isCanonicalLifecycleStatus('DEFERRED'), false);
  assert.throws(() => assertCanonicalLifecycleStatus('DEFERRED', 'TEST-02'), /UNSUPPORTED_WBS_STATUS/);
});

scenario('CANCELLED is not part of canonical v1 lifecycle', () => {
  assert.ok(!CANONICAL_LIFECYCLE_STATUSES.includes('CANCELLED' as any));
  assert.equal(isCanonicalLifecycleStatus('CANCELLED'), false);
  assert.throws(() => assertCanonicalLifecycleStatus('CANCELLED', 'TEST-03'), /UNSUPPORTED_WBS_STATUS/);
});

scenario('ACCEPTED is not part of canonical v1 lifecycle', () => {
  assert.ok(!CANONICAL_LIFECYCLE_STATUSES.includes('ACCEPTED' as any));
  assert.equal(isCanonicalLifecycleStatus('ACCEPTED'), false);
  assert.throws(() => assertCanonicalLifecycleStatus('ACCEPTED', 'TEST-04'), /UNSUPPORTED_WBS_STATUS/);
});

scenario('SUPERSEDED is not part of canonical v1 lifecycle', () => {
  assert.ok(!CANONICAL_LIFECYCLE_STATUSES.includes('SUPERSEDED' as any));
  assert.equal(isCanonicalLifecycleStatus('SUPERSEDED'), false);
  assert.throws(() => assertCanonicalLifecycleStatus('SUPERSEDED', 'TEST-05'), /UNSUPPORTED_WBS_STATUS/);
});

// J. Parser accepts IN_PROGRESS
scenario('Parser accepts IN_PROGRESS status in WBS YAML bytes', () => {
  const yamlContent = `
version: "1.0.0"
project: "PRJ-TEST"
baseline: "v0.1.0"
items:
  - id: "DMK-TEST-01"
    wbs_path: "13.99.01"
    title: "Test In Progress Item"
    status: "IN_PROGRESS"
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
`;
  const doc = parseCanonicalWbsBytes(Buffer.from(yamlContent, 'utf8'));
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].status, 'IN_PROGRESS');
});

// K. Parser rejects unsupported lifecycle states
scenario('Parser rejects unsupported lifecycle states with UNSUPPORTED_WBS_STATUS', () => {
  const badStatuses = ['BLOCKED', 'DEFERRED', 'CANCELLED', 'ACCEPTED', 'SUPERSEDED', 'UNKNOWN_STATUS'];
  for (const bad of badStatuses) {
    const yamlContent = `
version: "1.0.0"
project: "PRJ-TEST"
baseline: "v0.1.0"
items:
  - id: "DMK-BAD-01"
    wbs_path: "13.99.02"
    title: "Test Bad Status Item"
    status: "${bad}"
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
`;
    assert.throws(
      () => parseCanonicalWbsBytes(Buffer.from(yamlContent, 'utf8')),
      /UNSUPPORTED_WBS_STATUS/,
      `Parser should reject status "${bad}"`
    );
  }
});

// L. Parser rejects missing / blank canonical status
scenario('Parser rejects missing or blank canonical status', () => {
  const yamlContentMissing = `
version: "1.0.0"
project: "PRJ-TEST"
baseline: "v0.1.0"
items:
  - id: "DMK-NO-STATUS"
    wbs_path: "13.99.03"
    title: "Missing Status"
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(yamlContentMissing, 'utf8')),
    /UNSUPPORTED_WBS_STATUS/,
    'Parser should reject missing status'
  );

  const yamlContentBlank = `
version: "1.0.0"
project: "PRJ-TEST"
baseline: "v0.1.0"
items:
  - id: "DMK-BLANK-STATUS"
    wbs_path: "13.99.04"
    title: "Blank Status"
    status: "   "
    type: "FEATURE"
    priority: "P1"
    risk: "LOW"
`;
  assert.throws(
    () => parseCanonicalWbsBytes(Buffer.from(yamlContentBlank, 'utf8')),
    /UNSUPPORTED_WBS_STATUS/,
    'Parser should reject blank status'
  );
});

// M-P. Mapping assertions
scenario('mapCanonicalStatus maps canonical statuses correctly', () => {
  assert.equal(mapCanonicalStatus('PROPOSED'), 'PROPOSED');
  assert.equal(mapCanonicalStatus('BACKLOG'), 'BACKLOG');
  assert.equal(mapCanonicalStatus('READY'), 'READY');
  assert.equal(mapCanonicalStatus('IN_PROGRESS'), 'IN_PROGRESS');
  assert.equal(mapCanonicalStatus('IMPLEMENTED'), 'VERIFICATION');
  assert.equal(mapCanonicalStatus('VERIFICATION_PENDING'), 'VERIFICATION');
  assert.equal(mapCanonicalStatus('VERIFIED'), 'VERIFIED');
});

// Q. Unknown mapping fails closed
scenario('mapCanonicalStatus fails closed on unsupported statuses', () => {
  const unmapped = ['BLOCKED', 'DEFERRED', 'CANCELLED', 'ACCEPTED', 'SUPERSEDED', 'UNKNOWN', ''];
  for (const s of unmapped) {
    assert.throws(
      () => mapCanonicalStatus(s),
      /UNSUPPORTED_WBS_STATUS/,
      `mapCanonicalStatus should fail closed on "${s}"`
    );
  }
});

// R. MASTER_WBS.yaml status_definitions match the approved contract
scenario('MASTER_WBS.yaml status_definitions match canonical lifecycle contract', () => {
  const masterWbsPath = path.join(process.cwd(), 'docs', '00_control', 'MASTER_WBS.yaml');
  const content = fs.readFileSync(masterWbsPath, 'utf8');
  const parsed = YAML.parse(content);
  assert.ok(parsed.status_definitions, 'status_definitions section must exist');
  
  const defKeys = parsed.status_definitions.map((entry: Record<string, string>) => Object.keys(entry)[0]);
  assert.equal(defKeys.length, 7, `Expected 7 status definitions, found: ${defKeys.join(', ')}`);
  for (const s of CANONICAL_LIFECYCLE_STATUSES) {
    assert.ok(defKeys.includes(s), `status_definitions missing: ${s}`);
  }
  assert.ok(!defKeys.includes('BLOCKED'), 'status_definitions must not contain BLOCKED');
  assert.ok(!defKeys.includes('DEFERRED'), 'status_definitions must not contain DEFERRED');
  assert.ok(!defKeys.includes('CANCELLED'), 'status_definitions must not contain CANCELLED');
});

// S. All current canonical WorkItems in MASTER_WBS.yaml have valid statuses
scenario('All canonical WorkItems in MASTER_WBS.yaml have valid v1 statuses', () => {
  const doc = readCanonicalWbs();
  assert.ok(doc.items.length > 0, 'WBS items must not be empty');
  for (const item of doc.items) {
    assert.ok(
      isCanonicalLifecycleStatus(item.status),
      `Item ${item.id} has invalid canonical status: "${item.status}"`
    );
  }
});

console.log(`\nLifecycle test summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
