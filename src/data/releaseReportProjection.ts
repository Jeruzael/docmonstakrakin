import type {Project, Requirement} from '../types';
import type {ReleaseAuditReport} from '../../server/release/releaseGateEvaluator';
import {readinessCommit, readinessText} from './releaseHealthProjection';

export type ReportAvailability = 'LOADING' | 'UNAVAILABLE' | 'FAILED' | 'MALFORMED' | 'AVAILABLE';
const record = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const nonempty = (value: unknown): value is string => text(value) && value.trim().length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const identifiers = (value: unknown): value is string[] => strings(value) && value.every(nonempty) && new Set(value).size === value.length;

function boundScope(value: unknown, projectId: string, targetRelease: string): boolean {
  return record(value) && value.projectId === projectId && value.targetRelease === targetRelease &&
    readinessText(value.scopeId) && value.scopeId.startsWith('RSC-') && count(value.scopeRevision) && value.scopeRevision > 0 &&
    readinessCommit(value.commitSha) && readinessText(value.buildRevision) && readinessText(value.environment) &&
    identifiers(value.workItemIds) && value.workItemIds.length > 0 && value.workItemIds.length <= 1000;
}

/** Admit the versioned server response, never infer approval from planning data.
 * This checks response consistency, not evidence authenticity or release policy.
 * projectStateVersion identifies the evaluated snapshot; the caller also fences
 * its own local snapshot/request across asynchronous responses.
 */
export function readReleaseReport(value: unknown, projectId: string): ReleaseAuditReport | null {
  if (!record(value) || value.version !== 'OPERATIONAL_RELEASE_EVALUATION/1' || value.projectId !== projectId || !nonempty(value.projectName) ||
      !nonempty(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp)) || !nonempty(value.targetMilestone) ||
      typeof value.allGatesPassed !== 'boolean' || typeof value.releaseReady !== 'boolean' || typeof value.signedOff !== 'boolean') return null;
  const scope = value.evaluationScope, production = value.productionEvidence;
  if (!record(scope) || !['BOUND', 'UNAVAILABLE', 'INVALID'].includes(scope.status) || !nonempty(scope.reason) ||
    (scope.status === 'BOUND' ? !boundScope(scope.scope, projectId, value.targetMilestone) : scope.scope !== null) ||
    !(value.projectStateVersion === null || count(value.projectStateVersion)) ||
    !record(production) || production.status !== 'UNAVAILABLE' || production.providerId !== 'UNCONFIGURED' ||
    production.trustedProductionEvidence !== false || production.reasonCode !== 'TRUST_ROOTS_NOT_ACCEPTED' || !nonempty(production.reason)) return null;
  if (!Array.isArray(value.gates) || value.gates.length !== 7) return null;
  const ids = new Set<number>();
  for (const gate of value.gates) {
    if (!record(gate) || !Number.isInteger(gate.gateId) || gate.gateId < 1 || gate.gateId > 7 || ids.has(gate.gateId) ||
        !nonempty(gate.code) || !nonempty(gate.name) || !text(gate.details) || typeof gate.blocking !== 'boolean' ||
        !['PASSED', 'FAILED', 'PENDING', 'HUMAN_APPROVAL_REQUIRED'].includes(gate.status) || !strings(gate.evidenceLinks) ||
        !record(gate.localCheck) || !['SATISFIED', 'FAILED', 'PENDING', 'NOT_APPLICABLE'].includes(gate.localCheck.status) ||
        !identifiers(gate.localCheck.subjectIds) || !nonempty(gate.localCheck.details) ||
        gate.status !== (gate.gateId === 7 ? 'HUMAN_APPROVAL_REQUIRED' : gate.localCheck.status === 'FAILED' ? 'FAILED' : 'PENDING')) return null;
    ids.add(gate.gateId);
  }
  if (value.allGatesPassed || value.releaseReady || value.signedOff || value.signoffDetails !== undefined ||
      value.allGatesPassed !== value.gates.every(gate => gate.status === 'PASSED') ||
      value.releaseReady !== value.gates.filter(gate => gate.gateId <= 6).every(gate => gate.status === 'PASSED') ||
      value.signedOff !== (value.gates.find(gate => gate.gateId === 7)?.status === 'PASSED')) return null;
  if (!Array.isArray(value.capabilities) || value.capabilities.length !== 25 || !record(value.capabilitiesSummary)) return null;
  const capabilityIds = new Set<number>();
  for (const capability of value.capabilities) {
    if (!record(capability) || !Number.isSafeInteger(capability.capabilityId) || capability.capabilityId < 1 || capability.capabilityId > 25 || capabilityIds.has(capability.capabilityId) ||
        !nonempty(capability.title) || !nonempty(capability.referenceDmk) || !text(capability.evidence) ||
        !['IMPLEMENTED', 'PENDING'].includes(capability.status) ||
        !['IN_SCOPE', 'OUT_OF_SCOPE', 'UNAVAILABLE'].includes(capability.applicability) || !nonempty(capability.rationale) ||
        (capability.applicability === 'IN_SCOPE' ? scope.status !== 'BOUND' || !nonempty(capability.sourceWorkItemId) || !scope.scope.workItemIds.includes(capability.sourceWorkItemId)
          : capability.sourceWorkItemId !== null || capability.status !== 'PENDING' || capability.evidence !== '') ||
        ((scope.status === 'BOUND') === (capability.applicability === 'UNAVAILABLE'))) return null;
    capabilityIds.add(capability.capabilityId);
  }
  const verified = value.capabilities.filter(capability => capability.status === 'VERIFIED').length;
  const total = value.capabilities.length;
  if (value.capabilitiesSummary.total !== total || value.capabilitiesSummary.verified !== verified ||
      value.capabilitiesSummary.percentage !== (total ? Math.round(verified / total * 100) : 0)) return null;
  const audit = value.auditChainIntegrity;
  if (!record(audit) || typeof audit.valid !== 'boolean' || !count(audit.breaksCount) || !count(audit.eventsChecked) ||
      audit.valid !== (audit.breaksCount === 0) || audit.trust !== 'LOCAL_STORED_BYTES_ONLY' ||
      audit.available !== (audit.eventsChecked > 0) ||
      value.gates.find(gate => gate.gateId === 6)?.localCheck.status !== (!audit.valid ? 'FAILED' : audit.eventsChecked ? 'SATISFIED' : 'PENDING')) return null;
  const localSignoffs = value.localSignoffObservations;
  if (!record(localSignoffs) || !identifiers(localSignoffs.auditEventIds) || !identifiers(localSignoffs.approvalIds) || localSignoffs.humanAuthorization !== false) return null;
  if (value.ciObservation !== undefined) {
    const ci = value.ciObservation;
    if (!record(ci) || ci.version !== 'GITHUB_CI_OBSERVATION/1' || ci.provider !== 'GITHUB_PUBLIC_ACTIONS_API' ||
      !['OBSERVED_SUCCESS', 'FAILED', 'UNAVAILABLE', 'REJECTED'].includes(ci.status) || ci.trustedProductionEvidence !== false || ci.humanAuthorization !== false ||
      !count(ci.runId) || ci.runId === 0 || !nonempty(ci.reason) || !nonempty(ci.observedAt) || !Number.isFinite(Date.parse(ci.observedAt)) ||
      scope.status !== 'BOUND' || !boundScope(ci.scope, projectId, value.targetMilestone) || JSON.stringify(ci.scope) !== JSON.stringify(scope.scope)) return null;
  }
  return value as ReleaseAuditReport;
}

export function requirementReferenceSummary(requirements: Requirement[]) {
  return {
    total: requirements.length,
    approved: requirements.filter(requirement => requirement.status === 'APPROVED').length,
    withEvidenceReferences: requirements.filter(requirement => requirement.evidence.length > 0).length,
    withoutEvidenceReferences: requirements.filter(requirement => requirement.evidence.length === 0).length,
  };
}

export function releaseReportMarkdown(project: Pick<Project, 'id' | 'name' | 'stateVersion'>,
  report: ReleaseAuditReport | null, availability: ReportAvailability, generatedAt: string): string {
  const status = report ? report.signedOff ? 'SIGNED OFF (SERVER-REPORTED)' : report.releaseReady ? 'READY FOR SIGNOFF (SERVER-REPORTED)' : 'INCOMPLETE (SERVER-REPORTED)'
    : `UNAVAILABLE (${availability})`;
  return `# Definition-of-Done (DoD) & Release Gate Evaluation Report
**Project:** ${project.name} (${project.id})
**Project Snapshot:** ${project.stateVersion}
**Evaluated Server Snapshot:** ${report?.projectStateVersion ?? 'UNAVAILABLE'}
**Target Milestone:** ${report?.targetMilestone ?? 'UNAVAILABLE'}
**Projection Generated:** ${generatedAt}
**Evaluation Timestamp:** ${report?.timestamp ?? 'UNAVAILABLE'}
**Release Scope:** ${report?.evaluationScope.status ?? 'UNAVAILABLE'}
**Commit:** ${report?.evaluationScope.scope?.commitSha ?? 'UNAVAILABLE'}
**Build / Environment:** ${report?.evaluationScope.scope ? `${report.evaluationScope.scope.buildRevision} / ${report.evaluationScope.scope.environment}` : 'UNAVAILABLE'}
**Scoped Tasks:** ${report?.evaluationScope.scope?.workItemIds.join(', ') ?? 'UNAVAILABLE'}
**Overall Release Status:** ${status}
**Audit Ledger Chain Integrity:** ${report?.auditChainIntegrity.available ? report.auditChainIntegrity.valid ? 'CONSISTENT LOCAL BYTES (SERVER-REPORTED)' : 'INVALID LOCAL BYTES (SERVER-REPORTED)' : 'UNAVAILABLE'}
${report?.signoffDetails ? `**Signed Off By:** ${report.signoffDetails.actor} at ${report.signoffDetails.timestamp}\n**Audit Event:** ${report.signoffDetails.auditEventId}` : ''}

This read-only projection reflects the server evaluation. It does not independently authenticate evidence or grant release approval. Human release authorization remains separate. The report identifies the evaluated server snapshot; this view also discards results when the local project snapshot changes.

## 1. Release Gates Assessment (7 Formal Gates)
${report ? report.gates.map(gate => `### Gate ${gate.gateId}: ${gate.name} [${gate.code}]
- **Status:** **${gate.status}**
- **Blocking:** ${gate.blocking ? 'YES' : 'NO'}
- **Details:** ${gate.details}
- **Local Observation:** ${gate.localCheck.status} — ${gate.localCheck.details}
- **Evidence Links:** ${gate.evidenceLinks.join(', ') || 'None'}
`).join('\n') : 'UNAVAILABLE — no current valid release evaluation.'}

## 2. Core MVP Capabilities Matrix
${report ? `Server-reported verification: **${report.capabilitiesSummary.percentage}%** (${report.capabilitiesSummary.verified}/${report.capabilitiesSummary.total} VERIFIED)` : 'Server-reported verification: UNAVAILABLE'}

| Capability ID | Title | WBS Ref | Scope | Reported Local Status | Evidence Reference | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${report ? report.capabilities.map(capability => `| ${capability.capabilityId} | ${capability.title} | ${capability.referenceDmk} | ${capability.applicability} | ${capability.status} | ${capability.evidence || 'None'} | ${capability.rationale} |`).join('\n') : ''}

## 3. Reported Audit Chain Result
- **Events Checked:** ${report?.auditChainIntegrity.eventsChecked ?? 'UNAVAILABLE'}
- **Chain Breaks Detected:** ${report?.auditChainIntegrity.breaksCount ?? 'UNAVAILABLE'} (first local validation failure reported; no exhaustive origin/completeness proof)
- **Hash Algorithm:** SHA-256 (server evaluator)

Production evidence acquisition remains ${report?.productionEvidence.status ?? 'UNAVAILABLE'}. No secret-store sweep, security test execution or independent evidence authentication is performed by this projection. CI observations never establish independent human release authorization.
`;
}
