import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { DISCOVERY_QUESTION_CATALOG, DISCOVERY_DOMAINS, getDomainMetadata } from '../src/data/discoveryCatalog.js';
import {
  filterQuestionsForProject,
  calculateDiscoveryCoverage,
  deriveArtifactsFromAnswer,
} from '../src/data/derivationEngine.js';
import { compileContextPackage } from '../src/data/contextPackageCompiler.js';
import { Project, Question, Requirement, Risk, WorkItem } from '../src/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${testName}: ${detail || 'Assertion failed'}`);
    failed++;
  }
}

console.log('================================================================');
console.log('   DISCOVERY & CONTEXT REMEDIATION VERIFICATION SUITE');
console.log('================================================================\n');

// 1. Domain Catalog Verification
assert(
  DISCOVERY_DOMAINS.length === 19,
  'Discovery Domain Count',
  `Expected 19 domains, found ${DISCOVERY_DOMAINS.length}`
);

const missingDomains = DISCOVERY_DOMAINS.filter((d) => {
  const meta = getDomainMetadata(d);
  return !meta || !meta.name;
});
assert(
  missingDomains.length === 0,
  'Domain Metadata Complete',
  `Missing metadata for: ${missingDomains.join(', ')}`
);

const catalogDomains = new Set(DISCOVERY_QUESTION_CATALOG.map((q) => q.domain));
assert(
  catalogDomains.size === 19,
  'Catalog Domain Representation',
  `Expected all 19 domains represented in catalog questions, found ${catalogDomains.size}`
);

// 2. Profile Filtering
const sampleProject: Project = {
  id: 'PRJ-TEST-01',
  name: 'Test Project',
  description: 'Test Project for Derivation Verification',
  profiles: ['WEB_APPLICATION', 'BACKEND_SERVICE'],
  specializedProfiles: ['AGENTIC_AI_EXPERIMENTATION', 'PII'],
  deliveryMethod: 'ITERATIVE',
  deploymentIntent: 'Containerized Cloud Run',
  dataSensitivity: 'CONFIDENTIAL',
  lifecyclePhase: 'DISCOVERY',
  stateVersion: 1,
  owner: 'Security Lead',
  targetRelease: 'Q4 2026',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  repoPath: '/workspace',
  repoStatus: 'CLEAN',
  healthScore: 80,
  progress: {
    requirementsReadiness: 20,
    architectureReadiness: 0,
    implementation: 0,
    verification: 0,
    securityAssurance: 40,
    releaseReadiness: 0,
  },
};

const activeQs = filterQuestionsForProject(DISCOVERY_QUESTION_CATALOG, sampleProject);
assert(
  activeQs.length > 0 && activeQs.length <= DISCOVERY_QUESTION_CATALOG.length,
  'Question Filtering for Project Profiles',
  `Active questions: ${activeQs.length}`
);

// 3. Derivation Engine Artifact Generation
const authQuestion = DISCOVERY_QUESTION_CATALOG.find((q) => q.id === 'AUTH-Q-014');
assert(!!authQuestion, 'Auth Discovery Question Found');

if (authQuestion) {
  const result = deriveArtifactsFromAnswer(authQuestion, 'hardware_fido2', 'PRJ-TEST-01');

  assert(
    result.record.disposition === 'ARTIFACTS_GENERATED',
    'Derivation Disposition (Artifacts Generated)',
    `Expected ARTIFACTS_GENERATED, got ${result.record.disposition}`
  );

  assert(
    result.requirements.length > 0,
    'Requirement Derived',
    `Expected at least 1 requirement derived, got ${result.requirements.length}`
  );

  const derivedReq = result.requirements[0];
  assert(
    derivedReq.status === 'PROPOSED',
    'Derived Requirement Initial Status is PROPOSED (Human Approval Required)',
    `Got ${derivedReq?.status}`
  );

  assert(
    derivedReq.source.type === 'questionnaire_answer' && derivedReq.source.id === 'AUTH-Q-014',
    'Derived Requirement Honest Provenance Tracking',
    `Expected source AUTH-Q-014, got ${derivedReq?.source?.id}`
  );

  assert(
    derivedReq.riskLinks.length === 0 &&
    derivedReq.workItems.length === 0 &&
    derivedReq.tests.length === 0 &&
    derivedReq.evidence.length === 0 &&
    derivedReq.standardLinks.length === (authQuestion.standards?.length || 0),
    'No Fabricated Traceability Links on Derived Requirements',
    `Expected empty risks/workItems/tests/evidence, got risks: ${derivedReq.riskLinks.length}, workItems: ${derivedReq.workItems.length}`
  );
}

// 4. Derivation Engine No-Artifact Disposition
const scopeQuestion = DISCOVERY_QUESTION_CATALOG.find((q) => q.id === 'SCOPE-Q-001');
if (scopeQuestion) {
  const result = deriveArtifactsFromAnswer(scopeQuestion, 'internal_only', 'PRJ-TEST-01');
  assert(
    result.record.id.startsWith('DERIV-'),
    'Derivation Record Created for Every Processed Answer',
    `Got id: ${result.record.id}`
  );
}

// 5. Context Package Compiler (Least-Context Scoping)
const sampleReqs: Requirement[] = [
  {
    id: 'REQ-SEC-001',
    title: 'Phishing-resistant authentication enforcement',
    statement: 'The system MUST require FIDO2 / WebAuthn hardware-bound passkeys for all administrative sessions.',
    category: 'SECURITY',
    status: 'APPROVED',
    priority: 'CRITICAL',
    source: { type: 'questionnaire_answer', id: 'AUTH-Q-001' },
    riskLinks: ['RISK-001'],
    threatLinks: ['THREAT-001'],
    standardLinks: ['NIST-SSDF-PW.1'],
    workItems: ['TASK-001'],
    tests: ['test_webauthn_challenge'],
    evidence: ['EV-101'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'REQ-FUNC-002',
    title: 'Export portable project package',
    statement: 'The system MUST generate a single encrypted JSON package conforming to the canonical schema.',
    category: 'FUNCTIONAL',
    status: 'APPROVED',
    priority: 'HIGH',
    source: { type: 'stakeholder', id: 'LEAD_ARCHITECT' },
    riskLinks: [],
    threatLinks: [],
    standardLinks: [],
    workItems: ['TASK-002'],
    tests: [],
    evidence: [],
    updatedAt: new Date().toISOString(),
  },
];

const sampleRisks: Risk[] = [
  {
    id: 'RISK-001',
    title: 'Credential Stuffing and Session Hijacking',
    description: 'Attackers replay compromised credentials against authentication endpoints.',
    drivers: ['Weak authentication', 'Password reuse'],
    inherentLikelihood: 5,
    inherentImpact: 5,
    inherentScore: 25,
    inherentLevel: 'CRITICAL',
    residualLikelihood: 2,
    residualImpact: 3,
    residualScore: 6,
    residualLevel: 'MEDIUM',
    treatment: 'MITIGATE',
    controls: ['NIST-SSDF-PW.1'],
  },
];

const sampleWorkItem: WorkItem = {
  id: 'TASK-001',
  type: 'TASK',
  title: 'Implement WebAuthn Authentication Provider',
  description: 'Setup hardware passkey challenge endpoints and token validation.',
  status: 'IN_PROGRESS',
  priority: 'P0',
  risk: 'HIGH',
  sprint: 1,
  requirements: ['REQ-SEC-001'],
  dependencies: [],
  acceptanceCriteria: ['Passkey registration and authentication verified'],
  checklist: [{ text: 'Setup challenge endpoint', done: true }],
  tests: ['test_webauthn'],
  evidence: [],
  updatedAt: new Date().toISOString(),
};

// Mode: TASK_CONTEXT
const taskPackage = compileContextPackage({
  project: sampleProject,
  role: 'Developer Agent',
  taskTitle: 'Implement WebAuthn Authentication Provider',
  activeWorkItem: sampleWorkItem,
  requirements: sampleReqs,
  risks: sampleRisks,
  mode: 'TASK_CONTEXT',
  includeOmissionReport: true,
});

assert(
  taskPackage.mode === 'TASK_CONTEXT',
  'Context Package Mode TASK_CONTEXT',
  `Got mode ${taskPackage.mode}`
);

assert(
  taskPackage.compiledPrompt.includes('The system MUST require FIDO2 / WebAuthn hardware-bound passkeys'),
  'Full Requirement Statement Rendered in Scoped Package (No Title-Only Reduction)',
  'Missing full statement in prompt'
);

assert(
  !taskPackage.compiledPrompt.includes('REQ-FUNC-002'),
  'Least-Context Scoping: Irrelevant Requirements Excluded in TASK_CONTEXT',
  'REQ-FUNC-002 should have been excluded from TASK-001 scoped prompt'
);

assert(
  taskPackage.omissionsReport !== undefined && taskPackage.omissionsReport.length > 0,
  'Least-Context Omission Report Generated',
  `Omission count: ${taskPackage.omissionsReport?.length}`
);

// Mode: FULL_BASELINE
const fullPackage = compileContextPackage({
  project: sampleProject,
  role: 'Architect',
  taskTitle: 'Architecture Baseline Review',
  requirements: sampleReqs,
  risks: sampleRisks,
  mode: 'FULL_BASELINE',
});

assert(
  fullPackage.compiledPrompt.includes('REQ-SEC-001') && fullPackage.compiledPrompt.includes('REQ-FUNC-002'),
  'Full Baseline Package Includes All Approved Requirements',
  'Missing requirements in full baseline'
);

// Mode: SUMMARY
const summaryPackage = compileContextPackage({
  project: sampleProject,
  role: 'Executive Reviewer',
  taskTitle: 'Milestone Progress Check',
  requirements: sampleReqs,
  risks: sampleRisks,
  mode: 'SUMMARY',
});

assert(
  summaryPackage.compiledPrompt.includes('Requirements Count: 2'),
  'Summary Package Emits Executive Metrics',
  'Missing requirements count in summary'
);

// ================================================================
// 4. DMK Identifier Integrity & Canonical Non-Collision
// ================================================================
console.log('\n--- Evaluating DMK Identifier Integrity & Canonical Preservation ---');

const wbsPath = path.resolve(process.cwd(), 'docs/00_control/MASTER_WBS.yaml');
const wbsRaw = fs.readFileSync(wbsPath, 'utf8');
const wbsData = YAML.parse(wbsRaw) as { items: any[] };
const workItems = wbsData.items;

// Verify DMK-166 remains the canonical v0.2 item
const dmk166 = workItems.find((w) => w.id === 'DMK-166');
assert(
  dmk166 !== undefined && dmk166.title === 'Multi-Peer Ed25519 Identity Model & Keyring',
  'DMK-166 Canonical Integrity: Preserved as Multi-Peer Identity Model',
  `DMK-166 title is: ${dmk166?.title}`
);
assert(
  dmk166?.status === 'PROPOSED',
  'DMK-166 Status Integrity: Remains Gated in PROPOSED Status',
  `DMK-166 status is: ${dmk166?.status}`
);
assert(
  dmk166?.epic === 'EPIC-14',
  'DMK-166 Epic Assignment: Governed by EPIC-14',
  `DMK-166 epic is: ${dmk166?.epic}`
);

// Verify DMK-186 is assigned to adaptive question navigation
const dmk186 = workItems.find((w) => w.id === 'DMK-186');
assert(
  dmk186 !== undefined && dmk186.title.includes('Adaptive Question Navigation'),
  'DMK-186 Allocation: Assigned to Adaptive Question Navigation & Dynamic Branching',
  `DMK-186 title is: ${dmk186?.title}`
);
assert(
  dmk186?.epic === 'EPIC-03' && dmk186?.phase === 'PHASE-2',
  'DMK-186 Hierarchy: Governed by EPIC-03 / PHASE-2',
  `DMK-186 epic: ${dmk186?.epic}, phase: ${dmk186?.phase}`
);
assert(
  dmk186?.status === 'VERIFIED',
  'DMK-186 Implementation Status: Verified in v0.1.0-rc1',
  `DMK-186 status: ${dmk186?.status}`
);

// Verify zero duplicate DMK IDs in WBS
const dmkIdCounts = new Map<string, number>();
workItems.forEach((w) => {
  dmkIdCounts.set(w.id, (dmkIdCounts.get(w.id) || 0) + 1);
});
const duplicates = Array.from(dmkIdCounts.entries()).filter(([_, count]) => count > 1);
assert(
  duplicates.length === 0,
  'Global DMK Identifier Uniqueness: Zero Collisions Across All Work Items',
  `Duplicate IDs found: ${duplicates.map(([id, c]) => `${id} (${c}x)`).join(', ')}`
);

// ================================================================
// 5. Multi-Profile Full Derivation Accounting
// ================================================================
console.log('\n--- Evaluating Multi-Profile Full Derivation Accounting ---');

const evaluationProfiles: Array<{
  name: string;
  project: Project;
}> = [
  {
    name: 'Profile 1: WEB_APPLICATION',
    project: {
      id: 'PRJ-PROF-WEB',
      name: 'Web Application Profile Project',
      description: 'Standard client-server web application evaluation',
      profiles: ['WEB_APPLICATION'],
      specializedProfiles: [],
      deliveryMethod: 'ITERATIVE',
      deploymentIntent: 'Containerized Web App',
      dataSensitivity: 'INTERNAL',
      lifecyclePhase: 'DISCOVERY',
      stateVersion: 1,
      owner: 'QA',
      targetRelease: 'v0.1',
      repoPath: '/workspace',
      repoStatus: 'CLEAN',
      healthScore: 100,
      progress: { requirementsReadiness: 0, architectureReadiness: 0, implementation: 0, verification: 0, securityAssurance: 0, releaseReadiness: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Profile 2: AI_APPLICATION',
    project: {
      id: 'PRJ-PROF-AI',
      name: 'AI Application Profile Project',
      description: 'AI model proxy and inference application',
      profiles: ['WEB_APPLICATION', 'BACKEND_SERVICE'],
      specializedProfiles: ['AI_ENGINEERING'],
      deliveryMethod: 'ITERATIVE',
      deploymentIntent: 'Cloud Run Service with Gemini Proxy',
      dataSensitivity: 'CONFIDENTIAL',
      lifecyclePhase: 'DISCOVERY',
      stateVersion: 1,
      owner: 'QA',
      targetRelease: 'v0.1',
      repoPath: '/workspace',
      repoStatus: 'CLEAN',
      healthScore: 100,
      progress: { requirementsReadiness: 0, architectureReadiness: 0, implementation: 0, verification: 0, securityAssurance: 0, releaseReadiness: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
  {
    name: 'Profile 3: AGENTIC_AI',
    project: {
      id: 'PRJ-PROF-AGENTIC',
      name: 'Agentic AI Experimentation Profile Project',
      description: 'Autonomous tool-calling and code mutation agent platform',
      profiles: ['WEB_APPLICATION', 'BACKEND_SERVICE'],
      specializedProfiles: ['AGENTIC_AI_EXPERIMENTATION'],
      deliveryMethod: 'ITERATIVE',
      deploymentIntent: 'Sandboxed Container Execution',
      dataSensitivity: 'RESTRICTED',
      lifecyclePhase: 'DISCOVERY',
      stateVersion: 1,
      owner: 'QA',
      targetRelease: 'v0.1',
      repoPath: '/workspace',
      repoStatus: 'CLEAN',
      healthScore: 100,
      progress: { requirementsReadiness: 0, architectureReadiness: 0, implementation: 0, verification: 0, securityAssurance: 0, releaseReadiness: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  },
];

for (const prof of evaluationProfiles) {
  const applicableQuestions = filterQuestionsForProject(DISCOVERY_QUESTION_CATALOG, prof.project);
  let derivationSuccessCount = 0;
  let honestProvenanceCount = 0;
  let proposedStatusCount = 0;
  let zeroFabricatedLinksCount = 0;

  for (const q of applicableQuestions) {
    // Pick the first valid option value
    const answerVal = q.options && q.options.length > 0 ? q.options[0].value : 'default_answer';
    const result = deriveArtifactsFromAnswer(q, answerVal, prof.project.id);

    if (result.record.disposition === 'ARTIFACTS_GENERATED' || result.record.disposition === 'NO_DERIVED_ARTIFACT') {
      derivationSuccessCount++;
    }

    if (result.record.disposition === 'ARTIFACTS_GENERATED') {
      for (const req of result.requirements) {
        if (req.status === 'PROPOSED') proposedStatusCount++;
        if (req.source?.type === 'questionnaire_answer' && req.source?.id === q.id) {
          honestProvenanceCount++;
        }
        if (
          req.riskLinks.length === 0 &&
          req.workItems.length === 0 &&
          req.tests.length === 0 &&
          req.evidence.length === 0
        ) {
          zeroFabricatedLinksCount++;
        }
      }
    }
  }

  assert(
    derivationSuccessCount === applicableQuestions.length,
    `Full Derivation Accounting [${prof.name}]: 100% of Questions Evaluated Deterministically`,
    `Evaluated ${derivationSuccessCount}/${applicableQuestions.length} questions`
  );
  assert(
    honestProvenanceCount === proposedStatusCount && zeroFabricatedLinksCount === proposedStatusCount,
    `Artifact Invariant Integrity [${prof.name}]: All ${proposedStatusCount} Derived Reqs are PROPOSED with Honest Provenance & Zero Fabricated Links`,
    `Provenance: ${honestProvenanceCount}, ZeroLinks: ${zeroFabricatedLinksCount}, Proposed: ${proposedStatusCount}`
  );
}

// ================================================================
// 6. Deterministic Least-Context Relevance with DMK-186
// ================================================================
console.log('\n--- Evaluating Deterministic Task Relevance with Work Item DMK-186 ---');

const dmk186WorkItem: WorkItem = {
  id: 'DMK-186',
  type: 'FEATURE',
  title: 'Implement Adaptive Question Navigation & Dynamic Branch Evaluation Engine',
  description: 'Build dynamic condition-based question skipping, profile-aware filtering, and branch navigation.',
  status: 'IN_PROGRESS',
  priority: 'P0',
  risk: 'MEDIUM',
  sprint: 2,
  requirements: ['REQ-REQ-001'],
  dependencies: ['DMK-020', 'DMK-027'],
  acceptanceCriteria: ['Dynamic question skipping verified', 'Branch evaluation returns deterministic next question'],
  checklist: [{ text: 'Condition evaluator', done: true }],
  tests: ['test_adaptive_nav'],
  evidence: [],
  updatedAt: new Date().toISOString(),
};

const comprehensiveReqs: Requirement[] = [
  {
    id: 'REQ-REQ-001',
    title: 'Adaptive Question Navigation & Dynamic Branching Engine Requirement',
    statement: 'The discovery engine must dynamically evaluate prerequisite conditions and profile flags to skip irrelevant questions.',
    category: 'FUNCTIONAL',
    status: 'APPROVED',
    priority: 'CRITICAL',
    source: { type: 'stakeholder', id: 'Lead Architect' },
    acceptanceCriteria: ['Conditional questions evaluate dynamically based on prior responses'],
    riskLinks: [],
    workItems: ['DMK-186'],
    tests: ['test_adaptive_nav'],
    evidence: [],
    threatLinks: [],
    standardLinks: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'REQ-ARCH-001',
    title: 'Local-first portable package persistence constraint',
    statement: 'All canonical project state must serialize into self-contained sealed JSON packages.',
    category: 'ARCHITECTURE',
    status: 'APPROVED',
    priority: 'CRITICAL',
    source: { type: 'standard_control', id: 'SEC-CTRL-018' },
    acceptanceCriteria: ['Package exports serialize deterministically'],
    riskLinks: [],
    workItems: [],
    tests: [],
    evidence: [],
    threatLinks: [],
    standardLinks: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'REQ-AI-007',
    title: 'Autonomous multi-agent negotiation consensus protocol',
    statement: 'Autonomous sub-agents must negotiate consensus prior to multi-peer branch merging.',
    category: 'AGENT_SPECIFIC',
    status: 'APPROVED',
    priority: 'LOW',
    source: { type: 'threat_mitigation', id: 'THREAT-018' },
    acceptanceCriteria: ['Consensus voting logged'],
    riskLinks: [],
    workItems: ['DMK-166'],
    tests: [],
    evidence: [],
    threatLinks: [],
    standardLinks: [],
    updatedAt: new Date().toISOString(),
  },
];

const dmk186Context = compileContextPackage({
  project: sampleProject,
  role: 'Senior Core Engine Developer',
  taskTitle: 'Execute DMK-186: Adaptive Question Navigation Logic',
  activeWorkItem: dmk186WorkItem,
  requirements: comprehensiveReqs,
  risks: sampleRisks,
  mode: 'TASK_CONTEXT',
  includeOmissionReport: true,
});

assert(
  dmk186Context.compiledPrompt.includes('DMK-186') &&
  dmk186Context.compiledPrompt.includes('Adaptive Question Navigation & Dynamic Branch Evaluation Engine'),
  'DMK-186 Context Binding: Work Item Title & Metadata Rendered in Active Header',
  'Missing DMK-186 in active header'
);

assert(
  dmk186Context.compiledPrompt.includes('The discovery engine must dynamically evaluate prerequisite conditions'),
  'Demonstrable Relationship: Directly Linked Requirement REQ-REQ-001 Rendered in Full Text',
  'REQ-REQ-001 full statement missing'
);

assert(
  dmk186Context.compiledPrompt.includes('[GLOBAL ARCHITECTURAL CONSTRAINTS]') &&
  dmk186Context.compiledPrompt.includes('REQ-ARCH-001'),
  'Architecture Scoping: Global Architectural Constraints Included with Explicit Labeling',
  'Missing global architectural constraint labeling'
);

assert(
  !dmk186Context.compiledPrompt.includes('REQ-AI-007'),
  'Least-Context Boundary: Unrelated Requirement REQ-AI-007 Strictly Excluded',
  'REQ-AI-007 should have been omitted'
);

assert(
  !dmk186Context.compiledPrompt.includes('DMK-166'),
  'Isolation Verification: DMK-166 Neither Appears as Active Work Item nor Leaks into Context',
  'DMK-166 must not appear in DMK-186 context'
);

assert(
  dmk186Context.omissionsReport !== undefined && dmk186Context.omissionsReport.length > 0,
  'Omission Audit: Explicit Omission Report Present in Task Context',
  'Omission report missing from DMK-186 package'
);

console.log('\n================================================================');
console.log(`TOTAL CRITERIA EVALUATED: ${passed + failed}`);
console.log(`PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
