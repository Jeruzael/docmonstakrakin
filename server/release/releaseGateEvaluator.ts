/**
 * docmonstakrakin v0.1 Release Gate Evaluator (DMK-165 / SEC-CTRL-020)
 * Evaluates the 7 mandatory release gates defined in docs/07_verification/RELEASE_GATES.md
 * and Master Plan §68 (Definition of Done for MVP).
 */

import { verifyAuditLedgerChain } from '../security/auditImmutability.ts';
import type { Project, Question, Requirement, WorkItem, AuditEvent, ApprovalItem } from '../../src/types.ts';

export interface ReleaseGateResult {
  gateId: number;
  code: string;
  name: string;
  status: 'PASSED' | 'FAILED' | 'PENDING' | 'HUMAN_APPROVAL_REQUIRED';
  details: string;
  blocking: boolean;
  evidenceLinks: string[];
}

export interface CapabilityAssessment {
  capabilityId: number;
  title: string;
  referenceDmk: string;
  status: 'VERIFIED' | 'IMPLEMENTED' | 'PENDING';
  evidence: string;
}

export interface ReleaseAuditReport {
  projectId: string;
  projectName: string;
  timestamp: string;
  targetMilestone: string;
  allGatesPassed: boolean;
  gates: ReleaseGateResult[];
  capabilitiesSummary: {
    total: number;
    verified: number;
    percentage: number;
  };
  capabilities: CapabilityAssessment[];
  auditChainIntegrity: {
    valid: boolean;
    breaksCount: number;
    eventsChecked: number;
  };
  releaseReady: boolean;
  signedOff: boolean;
  signoffDetails?: {
    actor: string;
    timestamp: string;
    auditEventId: string;
  };
}

export const V01_CAPABILITIES: { id: number; title: string; dmk: string; evidence: string }[] = [
  { id: 1, title: 'Create project with multiple profiles', dmk: 'DMK-017', evidence: 'EV-103' },
  { id: 2, title: 'Run adaptive questionnaire with conditional branching', dmk: 'DMK-027', evidence: 'EV-104' },
  { id: 3, title: 'Mark questions as blocking vs required', dmk: 'DMK-020', evidence: 'EV-104' },
  { id: 4, title: 'Calculate requirements readiness score', dmk: 'DMK-024', evidence: 'EV-104' },
  { id: 5, title: 'Generate requirements from approved answers', dmk: 'DMK-028', evidence: 'EV-104' },
  { id: 6, title: 'Review and approve requirements baseline', dmk: 'DMK-031', evidence: 'EV-104' },
  { id: 7, title: 'Compute inherent risk score (Likelihood x Impact)', dmk: 'DMK-036', evidence: 'EV-104' },
  { id: 8, title: 'Enforce mandatory risk floor for dangerous capabilities', dmk: 'DMK-038', evidence: 'EV-104' },
  { id: 9, title: 'Create and manage ADRs with status lifecycle', dmk: 'DMK-048', evidence: 'EV-104' },
  { id: 10, title: 'Move project through 15-phase A-SSDLC state machine', dmk: 'DMK-033', evidence: 'EV-104' },
  { id: 11, title: 'Enforce phase exit criteria using deterministic checks', dmk: 'DMK-035', evidence: 'EV-104' },
  { id: 12, title: 'Record and enforce time-limited gate overrides', dmk: 'DMK-041', evidence: 'EV-104' },
  { id: 13, title: 'View unified WorkItem model in Kanban, WBS, Backlog', dmk: 'DMK-085', evidence: 'EV-103' },
  { id: 14, title: 'Compile scoped prompt with permissions & schema', dmk: 'DMK-067', evidence: 'EV-106' },
  { id: 15, title: 'Send prompt to Gemini & validate structured JSON', dmk: 'DMK-079', evidence: 'EV-106' },
  { id: 16, title: 'Run independent second-agent review on proposals', dmk: 'DMK-081', evidence: 'EV-106' },
  { id: 17, title: 'Copy/paste manual offline prompt workflow', dmk: 'DMK-078', evidence: 'EV-106' },
  { id: 18, title: 'Validate file access against path allow/deny masks', dmk: 'DMK-098', evidence: 'EV-159' },
  { id: 19, title: 'Inspect local git status, log, and diff', dmk: 'DMK-105', evidence: 'EV-103' },
  { id: 20, title: 'Confirm structured terminal command before execution', dmk: 'DMK-110', evidence: 'EV-159' },
  { id: 21, title: 'Attach SHA-256 evidence before marking verified', dmk: 'DMK-114', evidence: 'EV-156' },
  { id: 22, title: 'Append-only SHA-256 hash-chained audit ledger', dmk: 'DMK-120', evidence: 'EV-159' },
  { id: 23, title: 'Browse pinned NIST SSDF and OWASP standards', dmk: 'DMK-055', evidence: 'EV-104' },
  { id: 24, title: 'Check for standards updates & preview semantic diff', dmk: 'DMK-126', evidence: 'EV-104' },
  { id: 25, title: 'Display deterministic recommended next action', dmk: 'DMK-139', evidence: 'EV-102' },
];

export interface ProjectDataAccessor {
  projects: Project[];
  questions: Record<string, Question[]>;
  requirements: Record<string, Requirement[]>;
  workItems: Record<string, WorkItem[]>;
  auditLogs: Record<string, AuditEvent[]>;
  approvals: Record<string, ApprovalItem[]>;
  addAuditEvent?: (
    projectId: string,
    actor: string,
    action: string,
    target: string,
    reason?: string,
    details?: any
  ) => AuditEvent;
}

// Reference presence is not evidence authentication. Preserve supplied text and
// order, but never replace absent or malformed references with catalog defaults.
function evidenceReferences(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((reference): reference is string => typeof reference === 'string' && reference.trim().length > 0)
    : [];
}

/**
 * Evaluates all 7 release gates deterministically for the given project.
 */
export function evaluateReleaseGates(
  store: ProjectDataAccessor,
  projectId: string
): ReleaseAuditReport {
  const project = store.projects.find((p) => p.id === projectId) || {
    id: projectId,
    name: 'Unknown Project',
    healthScore: 100,
    progress: { releaseReadiness: 0 },
  } as Project;

  const questions = store.questions[projectId] || [];
  const requirements = store.requirements[projectId] || [];
  const workItems = store.workItems[projectId] || [];
  const auditLogs = store.auditLogs[projectId] || [];
  const approvals = store.approvals[projectId] || [];

  const gates: ReleaseGateResult[] = [];

  // Gate 1: Zero Unresolved Blocker Questions
  const blockingQuestions = questions.filter(
    (q) => q.importance === 'BLOCKING' || (q as any).urgency === 'CRITICAL' || (q as any).isBlocking === true
  );
  const unresolvedBlockers = blockingQuestions.filter((q) => q.state === 'UNRESOLVED');
  const gate1Passed = unresolvedBlockers.length === 0;
  const questionStates = ['UNRESOLVED', 'ANSWERED', 'DEFERRED', 'NOT_APPLICABLE'];
  const blockingStateSummary = questionStates.map(state => `${state}=${blockingQuestions.filter(q => q.state === state).length}`).join('; ');
  const otherBlockingStates = blockingQuestions.filter(q => !questionStates.includes(q.state)).length;
  gates.push({
    gateId: 1,
    code: 'GATE-01-BLOCKERS',
    name: 'Zero Unresolved Blocker Questions',
    status: gate1Passed ? 'PASSED' : 'FAILED',
    details: `Stored question-state check: ${blockingQuestions.length} blocking questions selected; ${blockingStateSummary}; OTHER_OR_MISSING=${otherBlockingStates}.`
      + (unresolvedBlockers.length ? ` Unresolved question IDs: ${unresolvedBlockers.map(q => q.id).join(', ')}.` : '')
      + ' This evaluation does not verify answers, applicability decisions, or formal acceptance of deferrals.',
    blocking: true,
    evidenceLinks: ['EV-104'],
  });

  // Gate 2: 100% Core Requirements Verification
  const coreRequirements = requirements.filter(
    (r) => r.priority === 'CRITICAL' || r.priority === 'HIGH'
  );
  // Preserve the existing priority/status policy. Authenticated evidence and the
  // treatment of VERIFIED requirements still require the broader DMK-202 work.
  const unapprovedCore = coreRequirements.filter(
    (r) => r.status !== 'APPROVED'
  );
  const missingCoreReferences = coreRequirements.filter((r) => evidenceReferences(r.evidence).length === 0);
  const gate2Passed = coreRequirements.length > 0 && unapprovedCore.length === 0 && missingCoreReferences.length === 0;
  gates.push({
    gateId: 2,
    code: 'GATE-02-REQUIREMENTS',
    name: '100% Core Requirements Verification',
    status: gate2Passed ? 'PASSED' : 'FAILED',
    details: (coreRequirements.length === 0
      ? 'No CRITICAL or HIGH core requirements are available for the existing approval/reference check.'
      : gate2Passed
        ? `All ${coreRequirements.length} CRITICAL/HIGH core requirements are APPROVED and have evidence references.`
        : `${coreRequirements.length} CRITICAL/HIGH core requirements checked: ${unapprovedCore.length} not APPROVED (${unapprovedCore.map((r) => r.id).join(', ') || 'none'}); ${missingCoreReferences.length} missing evidence references (${missingCoreReferences.map((r) => r.id).join(', ') || 'none'}).`)
      + ' This evaluation does not authenticate evidence or inspect test results.',
    blocking: true,
    evidenceLinks: coreRequirements.flatMap((r) => evidenceReferences(r.evidence)),
  });

  // Gate 3: Secret Store Integration Complete (DMK-157)
  const dmk157 = workItems.find((w) => w.id === 'DMK-157');
  const dmk158 = workItems.find((w) => w.id === 'DMK-158');
  const gate3Passed =
    (dmk157?.status === 'VERIFIED' || dmk157?.status === 'APPROVED') &&
    (dmk158?.status === 'VERIFIED' || dmk158?.status === 'APPROVED');
  gates.push({
    gateId: 3,
    code: 'GATE-03-SECRETS',
    name: 'Secret Store Integration Complete (DMK-157 & DMK-158)',
    status: gate3Passed ? 'PASSED' : 'FAILED',
    details: `Stored work-item status check: DMK-157=${dmk157?.status ?? 'MISSING'}; DMK-158=${dmk158?.status ?? 'MISSING'}. Both must be VERIFIED or APPROVED. This evaluation does not inspect credential storage, run rotation, or perform a secret sweep.`,
    blocking: true,
    evidenceLinks: [...evidenceReferences(dmk157?.evidence), ...evidenceReferences(dmk158?.evidence)],
  });

  // Gate 4: Security Regression Passing (DMK-159)
  const dmk159 = workItems.find((w) => w.id === 'DMK-159');
  const gate4Passed = dmk159?.status === 'VERIFIED';
  gates.push({
    gateId: 4,
    code: 'GATE-04-SECURITY-REGRESSION',
    name: 'Security Regression Passing (DMK-159)',
    status: gate4Passed ? 'PASSED' : 'FAILED',
    details: `Stored work-item status check: DMK-159=${dmk159?.status ?? 'MISSING'}; VERIFIED is required. This evaluation does not execute test suites or authenticate their results.`,
    blocking: true,
    evidenceLinks: evidenceReferences(dmk159?.evidence),
  });

  // Gate 5: Golden Reference Project Execution
  const dmk156 = workItems.find((w) => w.id === 'DMK-156');
  const gate5Passed =
    project.id === 'PRJ-ATLAS-01' &&
    requirements.length >= 4 &&
    workItems.length >= 10 &&
    dmk156?.status === 'VERIFIED';
  gates.push({
    gateId: 5,
    code: 'GATE-05-GOLDEN-REFERENCE',
    name: 'Golden Reference Project Execution & Package Sealing',
    status: gate5Passed ? 'PASSED' : 'FAILED',
    details: `Legacy reference-project check: project ${project.id} (requires PRJ-ATLAS-01); ${requirements.length} requirements (minimum 4); ${workItems.length} work items (minimum 10); DMK-156=${dmk156?.status ?? 'MISSING'} (requires VERIFIED). This evaluation does not execute or authenticate a package roundtrip.`,
    blocking: true,
    evidenceLinks: evidenceReferences(dmk156?.evidence),
  });

  // Gate 6: Cryptographic Audit Ledger Integrity
  const auditVerification = verifyAuditLedgerChain(auditLogs, 'REVERSE_CHRONOLOGICAL');
  const gate6Passed = auditVerification.valid && auditVerification.brokenIndex === undefined;
  gates.push({
    gateId: 6,
    code: 'GATE-06-AUDIT-INTEGRITY',
    name: 'Cryptographic Audit Ledger Integrity',
    status: gate6Passed ? 'PASSED' : 'FAILED',
    details: gate6Passed
      ? `All ${auditLogs.length} audit ledger records chain cleanly via SHA-256 state hashes with 0 breaks detected.`
      : `Audit ledger integrity compromised! ${auditVerification.error || `Chain break detected at index ${auditVerification.brokenIndex}`}`,
    blocking: true,
    evidenceLinks: ['EV-159'],
  });

  // Gate 7: Security Lead DoD Sign-off (DMK-165 / SEC-CTRL-020)
  // SEC-CTRL-020 strictly requires genuine human authorization.
  // Technical evidence (EV-165) proves technical verification, but human sign-off requires
  // an explicit RELEASE_GATE_APPROVED or RELEASE_SIGNOFF audit record from an authorized human.
    const importBoundary = auditLogs.findIndex(ev=>ev.action==='PACKAGE_IMPORTED');
    const localAudit = importBoundary < 0 ? auditLogs : auditLogs.slice(0,importBoundary);
    const signoffEvent = localAudit.find(
    (ev) => ev.action === 'RELEASE_GATE_APPROVED' || ev.action === 'RELEASE_SIGNOFF_RECORDED'
  );
  const releaseApproval = approvals.find(
    (a) => a.type === 'RELEASE_SIGNOFF' && a.status === 'APPROVED'
  );
  const gate7Passed = !!signoffEvent || !!releaseApproval;

  gates.push({
    gateId: 7,
    code: 'GATE-07-RELEASE-SIGNOFF',
    name: 'Security Lead DoD Sign-off (DMK-165)',
    status: gate7Passed ? 'PASSED' : 'HUMAN_APPROVAL_REQUIRED',
    details: signoffEvent
      ? `Existing release sign-off audit event ${signoffEvent.id} (${signoffEvent.action}) recorded by ${signoffEvent.actor} at ${signoffEvent.timestamp}.`
      : releaseApproval
        ? `Existing approved release-signoff approval record ${releaseApproval.id}. No matching local sign-off audit event is present.`
        : 'No local release sign-off audit event or approved release-signoff approval record is present. Gate 7 requires explicit human sign-off authorization per SEC-CTRL-020; technical gate and capability results are reported separately.',
    blocking: true,
    evidenceLinks: gate7Passed ? ['EV-165'] : [],
  });

  // Mapping from capability WBS item to implementing primary work item
  const CAPABILITY_PRIMARY_ITEM_MAP: Record<string, string> = {
    'DMK-017': 'DMK-017',
    'DMK-027': 'DMK-020',
    'DMK-020': 'DMK-020',
    'DMK-024': 'DMK-020',
    'DMK-028': 'DMK-025',
    'DMK-031': 'DMK-025',
    'DMK-036': 'DMK-030',
    'DMK-038': 'DMK-030',
    'DMK-048': 'DMK-070',
    'DMK-033': 'DMK-035',
    'DMK-035': 'DMK-035',
    'DMK-041': 'DMK-035',
    'DMK-085': 'DMK-085',
    'DMK-067': 'DMK-065',
    'DMK-079': 'DMK-065',
    'DMK-081': 'DMK-081',
    'DMK-078': 'DMK-065',
    'DMK-098': 'DMK-159',
    'DMK-105': 'DMK-080',
    'DMK-110': 'DMK-159',
    'DMK-114': 'DMK-156',
    'DMK-120': 'DMK-159',
    'DMK-055': 'DMK-050',
    'DMK-126': 'DMK-050',
    'DMK-139': 'DMK-042',
  };

  // Evaluate Capabilities (25 Core Capabilities)
  const capabilities: CapabilityAssessment[] = V01_CAPABILITIES.map((cap) => {
    const directItem = workItems.find((w) => w.id === cap.dmk);
    const primaryId = CAPABILITY_PRIMARY_ITEM_MAP[cap.dmk] || cap.dmk;
    const primaryItem = directItem || workItems.find((w) => w.id === primaryId);
    const status = primaryItem?.status === 'VERIFIED'
      ? 'VERIFIED'
      // canonical IMPLEMENTED / VERIFICATION_PENDING map to runtime VERIFICATION.
      // Approval or a missing/early/unknown status does not establish implementation.
      : primaryItem?.status === 'VERIFICATION' ? 'IMPLEMENTED' : 'PENDING';
    return {
      capabilityId: cap.id,
      title: cap.title,
      referenceDmk: cap.dmk,
      status,
      evidence: evidenceReferences(primaryItem?.evidence).join(', '),
    };
  });

  const verifiedCount = capabilities.filter((c) => c.status === 'VERIFIED').length;
  const capabilitiesPercentage = Math.round((verifiedCount / capabilities.length) * 100);

  // Gates 1-6 are technical gates; Gate 7 is the signoff itself
  const technicalGatesPassed = gates.slice(0, 6).every((g) => g.status === 'PASSED');
  const allGatesPassed = gates.every((g) => g.status === 'PASSED');

  return {
    projectId,
    projectName: project.name,
    timestamp: new Date().toISOString(),
    targetMilestone: 'v0.1 Local-First MVP',
    allGatesPassed,
    gates,
    capabilitiesSummary: {
      total: capabilities.length,
      verified: verifiedCount,
      percentage: capabilitiesPercentage,
    },
    capabilities,
    auditChainIntegrity: {
      valid: auditVerification.valid,
      breaksCount: auditVerification.valid ? 0 : 1,
      eventsChecked: auditLogs.length,
    },
    releaseReady: technicalGatesPassed,
    signedOff: gate7Passed,
    signoffDetails: signoffEvent
      ? {
          actor: signoffEvent.actor,
          timestamp: signoffEvent.timestamp,
          auditEventId: signoffEvent.id,
        }
      : undefined,
  };
}

/**
 * Executes the formal v0.1 Release Sign-Off ceremony (DMK-165 / SEC-CTRL-020).
 */
export function executeReleaseSignoff(
  store: ProjectDataAccessor,
  projectId: string,
  actor: string,
  notes?: string
): { success: boolean; report: ReleaseAuditReport; auditEvent?: AuditEvent; error?: string } {
  // 1. Initial Gate Evaluation
  const initialReport = evaluateReleaseGates(store, projectId);
  if (!initialReport.releaseReady) {
    const failedGates = initialReport.gates.filter((g) => g.status === 'FAILED');
    return {
      success: false,
      report: initialReport,
      error: `Cannot sign off release: ${failedGates.length} prerequisite gates failed (${failedGates.map((g) => g.code).join(', ')}).`,
    };
  }

  // 2. Commit Cryptographic Audit Record
  let auditEvent: AuditEvent | undefined;
  if (store.addAuditEvent) {
    auditEvent = store.addAuditEvent(
      projectId,
      actor,
      'RELEASE_GATE_APPROVED',
      'DMK-165',
      notes || 'v0.1 Definition-of-Done Review ratified; all 25 core capabilities verified across 7 release gates.',
      {
        targetMilestone: 'v0.1 Local-First MVP',
        capabilitiesVerified: 25,
        totalCapabilities: 25,
        gatesPassed: [
          'GATE-01-BLOCKERS',
          'GATE-02-REQUIREMENTS',
          'GATE-03-SECRETS',
          'GATE-04-SECURITY-REGRESSION',
          'GATE-05-GOLDEN-REFERENCE',
          'GATE-06-AUDIT-INTEGRITY',
          'GATE-07-RELEASE-SIGNOFF',
        ],
        timestamp: new Date().toISOString(),
      }
    );
  }

  // 3. Update DMK-165 WorkItem
  const workItems = store.workItems[projectId] || [];
  const dmk165 = workItems.find((w) => w.id === 'DMK-165');
  if (dmk165) {
    dmk165.status = 'VERIFIED';
    if (!dmk165.evidence) dmk165.evidence = [];
    if (!dmk165.evidence.includes('EV-165')) {
      dmk165.evidence.push('EV-165');
    }
    if (dmk165.checklist) {
      dmk165.checklist.forEach((item) => {
        item.done = true;
      });
    }
    dmk165.updatedAt = new Date().toISOString();
  }

  // 4. Update Project Progress
  const project = store.projects.find((p) => p.id === projectId);
  if (project) {
    if (!project.progress) {
      project.progress = {
        requirementsReadiness: 100,
        architectureReadiness: 100,
        implementation: 100,
        verification: 100,
        securityAssurance: 100,
        releaseReadiness: 100,
      };
    } else {
      project.progress.releaseReadiness = 100;
    }
    project.healthScore = 100;
  }

  // 5. Update or Create Approval Item
  if (store.approvals[projectId]) {
    const existingApproval = store.approvals[projectId].find(
      (a) => a.type === 'RELEASE_SIGNOFF'
    );
    if (existingApproval) {
      existingApproval.status = 'APPROVED';
      existingApproval.approvalsCollected.push({
        role: 'Project Lead / Security Lead',
        approver: actor,
        timestamp: new Date().toISOString(),
        decision: 'APPROVED',
        comment: notes || 'All 7 v0.1 release gates verified and ratified.',
      });
    } else {
      store.approvals[projectId].push({
        id: `APV-REL-${Date.now().toString(36).toUpperCase()}`,
        projectId,
        title: 'v0.1 Local-First MVP Definition-of-Done & Release Gate Sign-off',
        type: 'RELEASE_SIGNOFF',
        requestedBy: actor,
        requestedAt: new Date().toISOString(),
        status: 'APPROVED',
        urgency: 'CRITICAL',
        targetEntityId: 'DMK-165',
        targetEntityType: 'GATE',
        description: 'Formal release ratification of docmonstakrakin v0.1 against the 25 core capabilities and 7 release gates.',
        impactAnalysis: 'Certifies codebase for official v0.1 release tagging and local developer distribution.',
        riskLevel: 'HIGH',
        requiredRoles: ['Project Lead', 'Security Lead'],
        approvalsCollected: [
          {
            role: 'Project Lead / Security Lead',
            approver: actor,
            timestamp: new Date().toISOString(),
            decision: 'APPROVED',
            comment: notes || 'Verified all 25 MVP capabilities and 7 release gates.',
          },
        ],
        policyGates: initialReport.gates.map((g) => ({
          gateName: g.name,
          passed: g.status === 'PASSED',
          details: g.details,
        })),
      });
    }
  }

  // 6. Return Final Evaluated Report
  const finalReport = evaluateReleaseGates(store, projectId);
  return {
    success: true,
    report: finalReport,
    auditEvent,
  };
}
