import type {Project, Requirement} from '../types';
import type {ReleaseAuditReport} from '../../server/release/releaseGateEvaluator';

export type ReportAvailability = 'LOADING' | 'UNAVAILABLE' | 'FAILED' | 'MALFORMED' | 'AVAILABLE';
const record = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const nonempty = (value: unknown): value is string => text(value) && value.trim().length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);

/** Admit the existing server response shape, never infer approval from planning data.
 * This checks response consistency, not evidence authenticity or release policy.
 * The endpoint supplies no stateVersion; the caller fences its own snapshot/request.
 */
export function readReleaseReport(value: unknown, projectId: string): ReleaseAuditReport | null {
  if (!record(value) || value.projectId !== projectId || !nonempty(value.projectName) ||
      !nonempty(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp)) || !nonempty(value.targetMilestone) ||
      typeof value.allGatesPassed !== 'boolean' || typeof value.releaseReady !== 'boolean' || typeof value.signedOff !== 'boolean') return null;
  if (!Array.isArray(value.gates) || value.gates.length !== 7) return null;
  const ids = new Set<number>();
  for (const gate of value.gates) {
    if (!record(gate) || !Number.isInteger(gate.gateId) || gate.gateId < 1 || gate.gateId > 7 || ids.has(gate.gateId) ||
        !nonempty(gate.code) || !nonempty(gate.name) || !text(gate.details) || typeof gate.blocking !== 'boolean' ||
        !['PASSED', 'FAILED', 'PENDING', 'HUMAN_APPROVAL_REQUIRED'].includes(gate.status) || !strings(gate.evidenceLinks)) return null;
    ids.add(gate.gateId);
  }
  if (value.allGatesPassed !== value.gates.every(gate => gate.status === 'PASSED') ||
      value.releaseReady !== value.gates.filter(gate => gate.gateId <= 6).every(gate => gate.status === 'PASSED') ||
      value.signedOff !== (value.gates.find(gate => gate.gateId === 7)?.status === 'PASSED')) return null;
  if (!Array.isArray(value.capabilities) || !record(value.capabilitiesSummary)) return null;
  const capabilityIds = new Set<number>();
  for (const capability of value.capabilities) {
    if (!record(capability) || !Number.isSafeInteger(capability.capabilityId) || capability.capabilityId < 1 || capabilityIds.has(capability.capabilityId) ||
        !nonempty(capability.title) || !nonempty(capability.referenceDmk) || !text(capability.evidence) ||
        !['VERIFIED', 'IMPLEMENTED', 'PENDING'].includes(capability.status)) return null;
    capabilityIds.add(capability.capabilityId);
  }
  const verified = value.capabilities.filter(capability => capability.status === 'VERIFIED').length;
  const total = value.capabilities.length;
  if (value.capabilitiesSummary.total !== total || value.capabilitiesSummary.verified !== verified ||
      value.capabilitiesSummary.percentage !== (total ? Math.round(verified / total * 100) : 0)) return null;
  const audit = value.auditChainIntegrity;
  if (!record(audit) || typeof audit.valid !== 'boolean' || !count(audit.breaksCount) || !count(audit.eventsChecked) ||
      audit.valid !== (audit.breaksCount === 0) ||
      (value.gates.find(gate => gate.gateId === 6)?.status === 'PASSED') !== audit.valid) return null;
  if (value.signoffDetails !== undefined && (!record(value.signoffDetails) || !nonempty(value.signoffDetails.actor) ||
      !nonempty(value.signoffDetails.auditEventId) || !nonempty(value.signoffDetails.timestamp) ||
      !Number.isFinite(Date.parse(value.signoffDetails.timestamp)) || !value.signedOff)) return null;
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
**Target Milestone:** ${report?.targetMilestone ?? 'UNAVAILABLE'}
**Projection Generated:** ${generatedAt}
**Evaluation Timestamp:** ${report?.timestamp ?? 'UNAVAILABLE'}
**Overall Release Status:** ${status}
**Audit Ledger Chain Integrity:** ${report ? report.auditChainIntegrity.valid ? 'VALID (SERVER-REPORTED)' : 'INVALID (SERVER-REPORTED)' : 'UNAVAILABLE'}
${report?.signoffDetails ? `**Signed Off By:** ${report.signoffDetails.actor} at ${report.signoffDetails.timestamp}\n**Audit Event:** ${report.signoffDetails.auditEventId}` : ''}

This read-only projection reflects the server evaluation. It does not independently authenticate evidence or grant release approval. Human release authorization remains separate. The evaluation endpoint does not return a snapshot version; this view discards results when the local project snapshot changes.

## 1. Release Gates Assessment (7 Formal Gates)
${report ? report.gates.map(gate => `### Gate ${gate.gateId}: ${gate.name} [${gate.code}]
- **Status:** **${gate.status}**
- **Blocking:** ${gate.blocking ? 'YES' : 'NO'}
- **Details:** ${gate.details}
- **Evidence Links:** ${gate.evidenceLinks.join(', ') || 'None'}
`).join('\n') : 'UNAVAILABLE — no current valid release evaluation.'}

## 2. Core MVP Capabilities Matrix
${report ? `Server-reported verification: **${report.capabilitiesSummary.percentage}%** (${report.capabilitiesSummary.verified}/${report.capabilitiesSummary.total} VERIFIED)` : 'Server-reported verification: UNAVAILABLE'}

| Capability ID | Title | WBS Ref | Reported Status | Evidence Reference |
| :--- | :--- | :--- | :--- | :--- |
${report ? report.capabilities.map(capability => `| ${capability.capabilityId} | ${capability.title} | ${capability.referenceDmk} | ${capability.status} | ${capability.evidence || 'None'} |`).join('\n') : ''}

## 3. Reported Audit Chain Result
- **Events Checked:** ${report?.auditChainIntegrity.eventsChecked ?? 'UNAVAILABLE'}
- **Chain Breaks Detected:** ${report?.auditChainIntegrity.breaksCount ?? 'UNAVAILABLE'}
- **Hash Algorithm:** SHA-256 (server evaluator)

No secret-store sweep, security test execution or independent evidence authentication is performed by this projection.
`;
}
