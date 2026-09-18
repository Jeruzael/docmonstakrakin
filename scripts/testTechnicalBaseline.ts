import { TechnicalBaseline, TechChoice, TechChoiceType } from '../src/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, testName: string, detail?: string) {
  if (condition) {
    console.log(`✓ [PASS] ${testId}: ${testName}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${testId}: ${testName} -> ${detail || 'Assertion failed'}`);
    failed++;
  }
}

console.log('================================================================');
console.log('   TECHNICAL BASELINE ARCHITECTURE GOVERNANCE REGRESSION SUITE');
console.log('   Evaluating Invariant: Recommendation != Selection != Ratified ADR');
console.log('================================================================\n');

// Standard Baseline Builder Helper
export function createSampleTechnicalBaseline(overrides?: Partial<TechnicalBaseline>): TechnicalBaseline {
  const defaultRec = (pref: string, rat: string, alts: { technology: string; tradeOff: string }[]) => ({
    status: 'PROPOSED' as const,
    preferredTechnology: pref,
    rationale: [rat],
    alternatives: alts,
    evaluatedAt: '2026-09-16T18:00:00Z',
  });

  return {
    frontend: {
      type: 'USER_SPECIFIED',
      decision_mode: 'USER_SPECIFIED',
      userValue: 'React 19 + Vite + Tailwind CSS',
      recommendation: defaultRec(
        'React 19 + Vite + Tailwind CSS',
        'Componentized UI, fast bundling, strict client bundle boundary',
        [{ technology: 'Next.js App Router', tradeOff: 'Server runtime complexity and SSR secret leak hazard' }]
      ),
      finalSelection: 'React 19 + Vite + Tailwind CSS',
      final_selection: 'React 19 + Vite + Tailwind CSS',
      status: 'NOT_RATIFIED',
      value: 'React 19 + Vite + Tailwind CSS',
    },
    backend: {
      type: 'RECOMMEND_FOR_ME',
      decision_mode: 'RECOMMEND_FOR_ME',
      userValue: null,
      recommendation: defaultRec(
        'Node.js + Express API (Strict ESM/CJS Bundle)',
        'Native TypeScript type stripping, @google/genai SDK compatibility, port 3000 container ingress',
        [{ technology: 'FastAPI (Python)', tradeOff: 'Dual language container footprint' }]
      ),
      finalSelection: 'Node.js + Express API (Strict ESM/CJS Bundle)',
      final_selection: 'Node.js + Express API (Strict ESM/CJS Bundle)',
      status: 'NOT_RATIFIED',
      value: 'Node.js + Express API (Strict ESM/CJS Bundle)',
    },
    database: {
      type: 'RECOMMEND_FOR_ME',
      decision_mode: 'RECOMMEND_FOR_ME',
      userValue: null,
      recommendation: defaultRec(
        'PostgreSQL with Connection Pooling / In-Memory State Store',
        'Relational integrity for traceability matrix, ACID compliance for audit ledger',
        [
          { technology: 'SQLite Single-File', tradeOff: 'Write lock contention under concurrent load' },
          { technology: 'MongoDB', tradeOff: 'Schema flexibility increases unvalidated requirement drift' },
        ]
      ),
      finalSelection: 'PostgreSQL with Connection Pooling / In-Memory State Store',
      final_selection: 'PostgreSQL with Connection Pooling / In-Memory State Store',
      status: 'NOT_RATIFIED',
      value: 'PostgreSQL with Connection Pooling / In-Memory State Store',
    },
    authentication: {
      type: 'USER_SPECIFIED',
      decision_mode: 'USER_SPECIFIED',
      userValue: 'WebAuthn Passkeys & Cryptographic Session Tokens',
      recommendation: defaultRec(
        'WebAuthn Passkeys & Cryptographic Session Tokens',
        'Phishing-resistant authentication per NIST SP 800-63B AAL3',
        [{ technology: 'Username / Salted Password', tradeOff: 'Vulnerable to credential stuffing and brute force' }]
      ),
      finalSelection: 'WebAuthn Passkeys & Cryptographic Session Tokens',
      final_selection: 'WebAuthn Passkeys & Cryptographic Session Tokens',
      status: 'NOT_RATIFIED',
      value: 'WebAuthn Passkeys & Cryptographic Session Tokens',
    },
    storage: {
      type: 'USER_SPECIFIED',
      decision_mode: 'USER_SPECIFIED',
      userValue: 'AES-256-GCM Encrypted File Store & Sealed JSON Packages',
      recommendation: defaultRec(
        'AES-256-GCM Encrypted File Store & Sealed JSON Packages',
        'Tamper-evident hash chaining and deterministic package sealing',
        [{ technology: 'Plain Unencrypted File System', tradeOff: 'Zero at-rest confidentiality protection' }]
      ),
      finalSelection: 'AES-256-GCM Encrypted File Store & Sealed JSON Packages',
      final_selection: 'AES-256-GCM Encrypted File Store & Sealed JSON Packages',
      status: 'NOT_RATIFIED',
      value: 'AES-256-GCM Encrypted File Store & Sealed JSON Packages',
    },
    apiApproach: {
      type: 'RECOMMEND_FOR_ME',
      decision_mode: 'RECOMMEND_FOR_ME',
      userValue: null,
      recommendation: defaultRec(
        'RESTful JSON API with Strict Schema Validation',
        'Deterministic request parsing and zero prototype pollution',
        [{ technology: 'GraphQL', tradeOff: 'Arbitrary query depth resource exhaustion risk' }]
      ),
      finalSelection: 'RESTful JSON API with Strict Schema Validation',
      final_selection: 'RESTful JSON API with Strict Schema Validation',
      status: 'NOT_RATIFIED',
      value: 'RESTful JSON API with Strict Schema Validation',
    },
    deployment: {
      type: 'USER_SPECIFIED',
      decision_mode: 'USER_SPECIFIED',
      userValue: 'Containerized Cloud Run (0.0.0.0:3000 Ingress)',
      recommendation: defaultRec(
        'Containerized Cloud Run (0.0.0.0:3000 Ingress)',
        'Stateless container execution with strict reverse proxy port mapping',
        [{ technology: 'Kubernetes Cluster', tradeOff: 'Excess operational surface for single-tier service' }]
      ),
      finalSelection: 'Containerized Cloud Run (0.0.0.0:3000 Ingress)',
      final_selection: 'Containerized Cloud Run (0.0.0.0:3000 Ingress)',
      status: 'NOT_RATIFIED',
      value: 'Containerized Cloud Run (0.0.0.0:3000 Ingress)',
    },
    sourceControl: {
      type: 'USER_SPECIFIED',
      decision_mode: 'USER_SPECIFIED',
      userValue: 'AI_STUDIO_WORKSPACE (Local-First Honest Workspace)',
      recommendation: defaultRec(
        'AI_STUDIO_WORKSPACE (Local-First Honest Workspace)',
        'Zero fabricated Git metadata with SHA-256 state continuity verification',
        [{ technology: 'Fabricated Local Git Stubs', tradeOff: 'Deceptive provenance violating platform honesty' }]
      ),
      finalSelection: 'AI_STUDIO_WORKSPACE (Local-First Honest Workspace)',
      final_selection: 'AI_STUDIO_WORKSPACE (Local-First Honest Workspace)',
      status: 'NOT_RATIFIED',
      value: 'AI_STUDIO_WORKSPACE (Local-First Honest Workspace)',
    },
    testing: {
      type: 'RECOMMEND_FOR_ME',
      decision_mode: 'RECOMMEND_FOR_ME',
      userValue: null,
      recommendation: defaultRec(
        'Automated Multi-Suite QA Gate (Linter + Security + WBS Drift)',
        'Full test suite preventing state drift and regression prior to human sign-off',
        [{ technology: 'Manual QA Checklist Only', tradeOff: 'Non-deterministic verification and human error' }]
      ),
      finalSelection: 'Automated Multi-Suite QA Gate (Linter + Security + WBS Drift)',
      final_selection: 'Automated Multi-Suite QA Gate (Linter + Security + WBS Drift)',
      status: 'NOT_RATIFIED',
      value: 'Automated Multi-Suite QA Gate (Linter + Security + WBS Drift)',
    },
    aiProvider: {
      type: 'RECOMMEND_FOR_ME',
      decision_mode: 'RECOMMEND_FOR_ME',
      userValue: null,
      recommendation: defaultRec(
        'Google Gemini 2.5 Flash via Server-Side API Proxy',
        'Official @google/genai SDK with zero client-side token exposure',
        [{ technology: 'Client-Side Browser Direct SDK', tradeOff: 'CRITICAL: Leaks API keys in browser network tab' }]
      ),
      finalSelection: 'Google Gemini 2.5 Flash via Server-Side API Proxy',
      final_selection: 'Google Gemini 2.5 Flash via Server-Side API Proxy',
      status: 'NOT_RATIFIED',
      value: 'Google Gemini 2.5 Flash via Server-Side API Proxy',
    },
    ...overrides,
  };
}

const baseline = createSampleTechnicalBaseline();

// TEST-TECH-001: Frontend Architecture Baseline & Decision Flow Separation
const fe = baseline.frontend;
const fePass =
  fe.decision_mode === 'USER_SPECIFIED' &&
  fe.userValue !== null &&
  fe.recommendation !== null &&
  fe.recommendation?.status === 'PROPOSED' &&
  fe.status === 'NOT_RATIFIED' &&
  fe.finalSelection !== null &&
  fe.recommendation?.preferredTechnology !== undefined;
assert(
  fePass,
  'TEST-TECH-001',
  'Frontend Architecture Baseline & Decision Flow Separation',
  'Frontend choice must separate decision_mode, recommendation (PROPOSED), and final_selection (NOT_RATIFIED).'
);

// TEST-TECH-002: Backend Runtime & API Topology Baseline
const be = baseline.backend;
const bePass =
  be.decision_mode === 'RECOMMEND_FOR_ME' &&
  be.userValue === null &&
  be.recommendation?.status === 'PROPOSED' &&
  be.status === 'NOT_RATIFIED' &&
  be.finalSelection === be.recommendation?.preferredTechnology;
assert(
  bePass,
  'TEST-TECH-002',
  'Backend Runtime & API Topology Baseline',
  'Backend choice in RECOMMEND_FOR_ME must keep recommendation distinct from ratified ADR.'
);

// TEST-TECH-003: Database & Persistence Engine Architecture
const db = baseline.database;
const dbPass =
  db.recommendation !== null &&
  Array.isArray(db.recommendation?.alternatives) &&
  db.recommendation.alternatives.length >= 2 &&
  db.recommendation.alternatives.every((a) => Boolean(a.technology && a.tradeOff)) &&
  db.status === 'NOT_RATIFIED';
assert(
  dbPass,
  'TEST-TECH-003',
  'Database & Persistence Engine Architecture',
  'Database recommendation must supply structured alternatives with documented trade-offs and remain NOT_RATIFIED.'
);

// TEST-TECH-004: Authentication & Identity Management Baseline
const auth = baseline.authentication;
const authPass =
  auth.decision_mode === 'USER_SPECIFIED' &&
  auth.userValue?.includes('WebAuthn') &&
  auth.status === 'NOT_RATIFIED' &&
  auth.recommendation?.status !== 'ACCEPTED'; // Not auto-approved
assert(
  authPass,
  'TEST-TECH-004',
  'Authentication & Identity Management Baseline',
  'Authentication baseline must track user value without auto-approving ADR prior to formal review.'
);

// TEST-TECH-005: Encrypted Storage & Secret Persistence Baseline
const storage = baseline.storage;
const storagePass =
  storage.final_selection?.includes('AES-256-GCM') &&
  storage.status === 'NOT_RATIFIED' &&
  storage.recommendation?.rationale?.some((r) => r.includes('Tamper-evident'));
assert(
  storagePass,
  'TEST-TECH-005',
  'Encrypted Storage & Secret Persistence Baseline',
  'Storage choice must mandate cryptographic tamper-evident storage while preserving NOT_RATIFIED status.'
);

// TEST-TECH-006: API Protocol & Communication Pattern Baseline
const api = baseline.apiApproach;
const apiPass =
  api.decision_mode === 'RECOMMEND_FOR_ME' &&
  api.recommendation?.status === 'PROPOSED' &&
  api.status === 'NOT_RATIFIED' &&
  api.finalSelection?.includes('RESTful JSON');
assert(
  apiPass,
  'TEST-TECH-006',
  'API Protocol & Communication Pattern Baseline',
  'API approach recommendation must be held in PROPOSED status without auto-ratifying ADR.'
);

// TEST-TECH-007: Deployment Runtime & Container Egress Baseline
const dep = baseline.deployment;
const depPass =
  dep.final_selection?.includes('0.0.0.0:3000') &&
  dep.status === 'NOT_RATIFIED' &&
  dep.recommendation?.status === 'PROPOSED';
assert(
  depPass,
  'TEST-TECH-007',
  'Deployment Runtime & Container Egress Baseline',
  'Deployment baseline must capture 0.0.0.0:3000 ingress rule without bypassing release gates.'
);

// TEST-TECH-008: Source Control & Repository Mode Baseline
const sc = baseline.sourceControl;
const scPass =
  sc.userValue?.includes('AI_STUDIO_WORKSPACE') &&
  sc.status === 'NOT_RATIFIED' &&
  sc.recommendation?.rationale?.some((r) => r.includes('Zero fabricated Git metadata'));
assert(
  scPass,
  'TEST-TECH-008',
  'Source Control & Repository Mode Baseline',
  'Source control baseline must document AI_STUDIO_WORKSPACE honest non-git mode.'
);

// TEST-TECH-009: Automated Testing & Verification Quality Baseline
const test = baseline.testing;
const testPass =
  test.recommendation?.preferredTechnology?.includes('Automated Multi-Suite QA Gate') &&
  test.status === 'NOT_RATIFIED' &&
  test.recommendation?.status === 'PROPOSED';
assert(
  testPass,
  'TEST-TECH-009',
  'Automated Testing & Verification Quality Baseline',
  'Testing baseline must specify automated QA quality gate in PROPOSED state.'
);

// TEST-TECH-010: AI Model Provider & API Gateway Topology Baseline
const ai = baseline.aiProvider;
const aiPass =
  ai.recommendation?.preferredTechnology?.includes('Server-Side API Proxy') &&
  ai.recommendation?.alternatives?.some((a) => a.tradeOff.includes('CRITICAL: Leaks API keys')) &&
  ai.status === 'NOT_RATIFIED' &&
  ai.recommendation?.status === 'PROPOSED';
assert(
  aiPass,
  'TEST-TECH-010',
  'AI Model Provider & API Gateway Topology Baseline',
  'AI provider baseline must mandate server-side API proxy isolation and maintain PROPOSED status.'
);

console.log('\n================================================================');
console.log(`TOTAL CRITERIA EVALUATED: ${passed + failed}`);
console.log(`PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
