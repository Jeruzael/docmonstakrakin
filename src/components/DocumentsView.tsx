import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  Printer,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  AlertTriangle,
  Lock,
  Eye,
  FileCode,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  Project,
  Requirement,
  Risk,
  WorkItem,
  ADR,
  ArchitectureComponent,
  ApprovalItem,
} from '../types';
import type {ReleaseAuditReport} from '../../server/release/releaseGateEvaluator';
import {readReleaseReport, releaseReportMarkdown, requirementReferenceSummary, type ReportAvailability} from '../data/releaseReportProjection';

const unavailableGateNames = ['Zero Unresolved Discovery Blockers', 'Core Requirements Verification',
  'SecretStore Integration', 'Security Regression', 'Golden Reference Execution',
  'Cryptographic Audit Ledger Integrity', 'Security Lead DoD Sign-off'];

interface DocumentsViewProps {
  project: Project;
  canonicalReady?: boolean;
  requirements?: Requirement[];
  risks?: Risk[];
  workItems?: WorkItem[];
  adrs?: ADR[];
  components?: ArchitectureComponent[];
  approvals?: ApprovalItem[];
  onOpenPackageModal?: () => void;
  onSignoffSuccess?: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  project,
  canonicalReady = true,
  requirements = [],
  risks = [],
  workItems = [],
  adrs = [],
  components = [],
  approvals = [],
  onOpenPackageModal,
  onSignoffSuccess,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<
    'PRD' | 'SAD' | 'THREAT' | 'RTM' | 'GOV' | 'RELEASE'
  >('PRD');
  const [viewMode, setViewMode] = useState<'RENDERED' | 'RAW'>('RENDERED');
  const [copied, setCopied] = useState(false);
  const [reportRequest, setReportRequest] = useState(0);
  const reportScope = JSON.stringify([project.id, project.stateVersion, canonicalReady, reportRequest]);
  const currentReportScope = useRef(reportScope);
  currentReportScope.current = reportScope;
  const reportGeneration = useRef(0);
  const [reportState, setReportState] = useState<{scope: string; status: ReportAvailability; report?: ReleaseAuditReport; message?: string}>({scope: '', status: 'UNAVAILABLE'});
  const currentReportState = reportState.scope === reportScope && canonicalReady ? reportState : {status: 'UNAVAILABLE' as const, report: undefined, message: 'A current project snapshot is required.'};
  const releaseReport = currentReportState.status === 'AVAILABLE' ? currentReportState.report! : null;
  const loadingReport = currentReportState.status === 'LOADING';
  const [isSignoffModalOpen, setIsSignoffModalOpen] = useState(false);
  const [signoffActor, setSignoffActor] = useState('Security Lead (Gio)');
  const [signoffNotes, setSignoffNotes] = useState('');
  const [signoffError, setSignoffError] = useState<string | null>(null);
  const [signingOff, setSigningOff] = useState(false);

  useEffect(() => {
    reportGeneration.current++;
    if (selectedDoc !== 'RELEASE' || !canonicalReady) {
      setReportState({scope: reportScope, status: 'UNAVAILABLE'});
      return () => {reportGeneration.current++;};
    }
    const controller = new AbortController();
    let active = true;
    const publish = (next: Omit<typeof reportState, 'scope'>) => {
      if (active && currentReportScope.current === reportScope) setReportState({...next, scope: reportScope});
    };
    publish({status: 'LOADING'});
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}/release/gates`, {signal: controller.signal});
        if (!response.ok) {
          publish({status: 'FAILED', message: `Release evaluation could not be loaded (HTTP ${response.status}).`});
          return;
        }
        let data: unknown;
        try {data = await response.json();}
        catch {publish({status: 'MALFORMED', message: 'Release evaluation returned invalid JSON.'}); return;}
        const report = readReleaseReport(data, project.id);
        publish(report ? {status: 'AVAILABLE', report} : {status: 'MALFORMED', message: 'Release evaluation is incomplete, inconsistent or belongs to another project.'});
      } catch {
        if (!controller.signal.aborted) publish({status: 'FAILED', message: 'Release evaluation could not be reached.'});
      }
    })();
    return () => {active = false; controller.abort(); reportGeneration.current++;};
  }, [selectedDoc, project.id, reportScope, canonicalReady]);

  useEffect(() => {
    setIsSignoffModalOpen(false);
    setSignoffError(null);
    setSigningOff(false);
  }, [reportScope, selectedDoc]);

  useEffect(() => {
    if (!canonicalReady && isSignoffModalOpen) {
      setIsSignoffModalOpen(false);
    }
  }, [canonicalReady, isSignoffModalOpen]);

  const handleExecuteSignoff = async () => {
    if (!canonicalReady || !releaseReport?.releaseReady || releaseReport.signedOff) return;
    const scope = reportScope;
    const generation = reportGeneration.current;
    const isCurrent = () => currentReportScope.current === scope && reportGeneration.current === generation;
    try {
      setSigningOff(true);
      setSignoffError(null);
      const res = await fetch(`/api/projects/${project.id}/release/signoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: signoffActor.trim(),
          notes: signoffNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!isCurrent()) return;
      if (!res.ok) {
        setSignoffError(data.error || 'Failed to record release sign-off');
        return;
      }

      const report = readReleaseReport(data.report, project.id);
      setReportState(report ? {scope, status: 'AVAILABLE', report} : {scope, status: 'MALFORMED', message: 'Sign-off returned an invalid evaluation. Refresh the project before continuing.'});
      setIsSignoffModalOpen(false);
      if (onSignoffSuccess) {
        onSignoffSuccess();
      }
    } catch (err: any) {
      if (isCurrent()) setSignoffError(err.message || 'Network error during release sign-off');
    } finally {
      if (isCurrent()) setSigningOff(false);
    }
  };

  // Generate document projection on the fly from canonical state
  const generateMarkdown = () => {
    const timestamp = new Date().toISOString();

    if (selectedDoc === 'RELEASE') {
      return releaseReportMarkdown(project, releaseReport, currentReportState.status, timestamp);
    }

    if (selectedDoc === 'PRD') {
      return `# Product Requirements Document (PRD)
**Project:** ${project.name}
**Project ID:** ${project.id}
**Projection Generated:** ${timestamp}
**Project State Version:** ${project.stateVersion}
**Governance:** A-SSDLC Control Plane (NIST SSDF SP 800-218 v1.1)

---

## 1. Executive Summary
${project.description}

- **Methodology:** ${project.deliveryMethod}
- **Assurance Profiles:** ${project.profiles.join(', ')}
- **Current Lifecycle Phase:** ${project.lifecyclePhase}
- **Stored Planning Health Score:** ${project.healthScore} / 100 (does not establish verification or release approval)

---

## 2. Canonical Requirements Baseline
Total Requirements: ${requirements.length}
Approved Requirements: ${requirementReferenceSummary(requirements).approved}

${requirements
  .map(
    (r) => `### ${r.id}: ${r.title}
- **Category:** ${r.category}
- **Priority:** ${r.priority}
- **Status:** ${r.status}
- **Governing Standard:** ${r.standardLinks.join(', ') || 'N/A'}
- **Associated Risk:** ${r.riskLinks.join(', ') || 'N/A'}

> ${r.statement}
`
  )
  .join('\n')}

---
*Notice: This document is a read-only projection generated deterministically from the canonical state store.*
`;
    }

    if (selectedDoc === 'THREAT') {
      return `# Security Threat Model & Risk Assessment
**Project:** ${project.name}
**Projection Generated:** ${timestamp}
**Standards:** OWASP ASVS v4.0.3, OWASP AISVS v1.0

---

## 1. Risk Register & Treatments
${risks
  .map(
    (rk) => `### ${rk.id}: ${rk.title}
- **Inherent Risk:** ${rk.inherentLevel} (${rk.inherentScore}/25) [Likelihood: ${rk.inherentLikelihood}, Impact: ${rk.inherentImpact}]
- **Residual Risk:** ${rk.residualLevel} (${rk.residualScore}/25)
- **Treatment Strategy:** ${rk.treatment}
- **Governing Controls:** ${rk.controls.join(', ')}

${rk.description}
`
  )
  .join('\n')}
`;
    }

    if (selectedDoc === 'RTM') {
      const summary = requirementReferenceSummary(requirements);
      return `# Requirements Traceability Matrix (RTM)
**Project:** ${project.name}
**Projection Generated:** ${timestamp}
**State Items Traced:** ${requirements.length} Requirements, ${risks.length} Risks, ${workItems.length} Work Items

| Requirement ID | Priority | Status | Standard Control | Risk Item | Assigned Work Item | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${requirements
  .map(
    (r) =>
      `| **${r.id}** | ${r.priority} | ${r.status} | ${r.standardLinks.join(', ') || '—'} | ${r.riskLinks.join(', ') || '—'} | ${
        r.workItems.join(', ') || '—'
      } | ${r.evidence.join(', ') || 'PENDING'} |`
  )
  .join('\n')}

---
### Lifecycle and Evidence Reference Summary
- **Approved Requirements:** ${summary.approved} / ${summary.total}
- **Requirements with Evidence References:** ${summary.withEvidenceReferences} / ${summary.total}
- **Requirements without Evidence References:** ${summary.withoutEvidenceReferences} / ${summary.total}

Approval is a lifecycle status. Evidence references do not establish authenticated evidence, a passing result or independent verification.
`;
    }

    if (selectedDoc === 'GOV') {
      return `# Governance, Quorum Sign-Off & Audit Report
**Project:** ${project.name}
**Projection Generated:** ${timestamp}
**Assurance Status:** Dual-Role Quorum Enforcement Active

---

## 1. Multi-Role Sign-Off Ledger
Total Approvals Tracked: ${approvals.length}

${approvals
  .map(
    (a) => `### ${a.id}: ${a.title}
- **Type:** ${a.type} | **Urgency:** ${a.urgency} | **Status:** ${a.status}
- **Target Entity:** ${a.targetEntityId} (${a.targetEntityType})
- **Requested By:** ${a.requestedBy} on ${a.requestedAt}
- **Signatures Collected:** ${a.approvalsCollected.length} / ${a.requiredRoles.length} (${a.requiredRoles.join(', ')})
- **Context:** ${a.description}
- **Policy Gates Passed:** ${a.policyGates.filter((g) => g.passed).length} / ${a.policyGates.length}
${a.resolutionNotes ? `- **Resolution:** ${a.resolutionNotes} (by ${a.resolvedBy || 'Quorum'})` : ''}
`
  )
  .join('\n')}

---

## 2. Work Delivery & Epic Progress
Total Tasks: ${workItems.length}
- **Verified / Completed:** ${workItems.filter((w) => w.status === 'VERIFIED' || w.status === 'RELEASED').length}
- **In Progress:** ${workItems.filter((w) => w.status === 'IN_PROGRESS').length}
- **Backlog / Ready:** ${workItems.filter((w) => w.status === 'BACKLOG' || w.status === 'READY').length}
`;
    }

    return `# Software Architecture Document (SAD)
**Project:** ${project.name}
**Architecture Baseline:** Component boundary isolation, explicit policy interceptors, least-privilege role separation.
**Projection Generated:** ${timestamp}

---

## 1. Architectural Decision Records (ADRs)
Total ADRs: ${adrs.length}

${adrs
  .map(
    (a) => `### ${a.id}: ${a.title}
- **Status:** ${a.status}
- **Context:** ${a.context}
- **Decision:** ${a.decision}
- **Consequences:** ${a.consequences}
- **Linked Requirements:** ${a.linkedRequirements.join(', ') || 'None'}
`
  )
  .join('\n')}

---

## 2. Component Topology & Trust Boundaries
Total Components: ${components.length}

| Component | Trust Zone | Category | Tech Stack | Protocols | Security Controls |
| :--- | :--- | :--- | :--- | :--- | :--- |
${components
  .map(
    (c) =>
      `| **${c.name}** | \`${c.trustZone}\` | ${c.category} | ${c.technology} | In: ${c.inboundProtocols.join(', ')} / Out: ${c.outboundProtocols.join(', ')} | ${c.securityControls.join('; ')} |`
  )
  .join('\n')}
`;
  };

  const mdContent = generateMarkdown();

  const handleCopy = () => {
    navigator.clipboard.writeText(mdContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_${selectedDoc.toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Projections</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
              STATE PROJECTION ONLY
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Canonical Document Projections
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Documents are not the source of truth. They are synchronized, deterministic views projected from project state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPackageModal && (
            <button
              onClick={onOpenPackageModal}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export or import cryptographically sealed .docmonstakrakin package"
            >
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>Portable Package (.docmonstakrakin)</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Markdown'}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export .md
          </button>
        </div>
      </div>

      {/* Projection Selector Tabs */}
      <div className="flex border-b border-slate-200 px-2 text-xs font-semibold gap-2 overflow-x-auto">
        {[
          { id: 'PRD', label: 'Product Requirements (PRD)' },
          { id: 'THREAT', label: 'Threat Model & Risk Register' },
          { id: 'RTM', label: 'Traceability Matrix (RTM)' },
          { id: 'SAD', label: 'Software Architecture (SAD)' },
          { id: 'GOV', label: 'Governance & Quorum (GOV)' },
          { id: 'RELEASE', label: 'Release Gates & DoD (REL)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedDoc(tab.id as any)}
            className={`py-2.5 px-4 border-b-2 transition-colors whitespace-nowrap ${
              selectedDoc === tab.id
                ? 'border-emerald-600 text-emerald-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Visual Release Gate Control Panel when RELEASE tab is active */}
      {selectedDoc === 'RELEASE' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  v0.1 Definition-of-Done (DoD) Review & Release Gate
                </h2>
                {releaseReport?.signedOff ? (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    SIGNED OFF (SERVER-REPORTED)
                  </span>
                ) : releaseReport?.releaseReady ? (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                    READY FOR SIGNOFF (SERVER-REPORTED)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    {releaseReport ? 'INCOMPLETE (SERVER-REPORTED)' : loadingReport ? 'LOADING EVALUATION' : 'EVALUATION UNAVAILABLE'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Governance Protocol: SEC-CTRL-020. Server evaluation and human release authorization remain separate. This view does not independently authenticate evidence.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setReportRequest(request => request + 1)} disabled={!canonicalReady || loadingReport || signingOff}
                className="px-3 py-2 border rounded-lg text-xs disabled:opacity-40">Refresh evaluation</button>
              {releaseReport?.releaseReady && !releaseReport?.signedOff && (
                <button
                  onClick={() => setIsSignoffModalOpen(true)}
                  disabled={!canonicalReady}
                  title={!canonicalReady ? 'Canonical data snapshot is stale. Refresh canonical project data before sign-off.' : undefined}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Execute v0.1 DoD Sign-Off</span>
                </button>
              )}
              {releaseReport?.signedOff && (
                <div className="text-right text-xs">
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {releaseReport.signoffDetails ? `Signed by ${releaseReport.signoffDetails.actor}` : 'Sign-off reported; signer details unavailable'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {releaseReport.signoffDetails?.timestamp?.slice(0, 19).replace('T', ' ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!releaseReport && <div role="status" data-testid="release-evaluation-status" className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-950">
            {loadingReport ? 'Loading current release evaluation…' : `Evaluation unavailable (${currentReportState.status.toLowerCase()}). ${currentReportState.message ?? 'Refresh evaluation to load the current project report.'}`}
          </div>}

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Reported Technical Gates
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {releaseReport ? `${releaseReport.gates.filter(gate => gate.gateId <= 6 && gate.status === 'PASSED').length} / 6` : 'UNAVAILABLE'}
                </span>
                <span className="text-xs text-slate-500">
                  {releaseReport ? 'reported passed; human approval is separate' : 'No current evaluation'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Core Capabilities
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {releaseReport ? `${releaseReport.capabilitiesSummary.verified} / ${releaseReport.capabilitiesSummary.total}` : 'UNAVAILABLE'}
                </span>
                <span className="text-xs text-slate-500 font-medium">{releaseReport ? `${releaseReport.capabilitiesSummary.percentage}% reported VERIFIED` : 'No current evaluation'}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Cryptographic Audit Ledger
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${releaseReport?.auditChainIntegrity.valid ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {releaseReport ? `${releaseReport.auditChainIntegrity.breaksCount} Breaks` : 'UNAVAILABLE'}
                </span>
                <span className="text-xs text-slate-500">
                  {releaseReport ? `${releaseReport.auditChainIntegrity.valid ? 'Valid' : 'Invalid'} chain reported; ${releaseReport.auditChainIntegrity.eventsChecked} events checked` : 'No current evaluation'}
                </span>
              </div>
            </div>
          </div>

          {/* 7 Gates Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Release Gate Evaluations (7 Gates)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(releaseReport?.gates ?? unavailableGateNames.map((name, index) => ({gateId: index + 1, name, status: 'UNAVAILABLE', details: 'No current valid evaluation.', evidenceLinks: []}))).map((g) => (
                <div
                  key={g.gateId}
                  className={`p-3.5 rounded-lg border flex items-start justify-between gap-3 ${
                    g.status === 'PASSED'
                      ? 'bg-emerald-50/40 border-emerald-200/70'
                      : g.status === 'PENDING' || g.status === 'UNAVAILABLE'
                      ? 'bg-amber-50/30 border-amber-200/70'
                      : 'bg-rose-50/40 border-rose-200/70'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600 font-bold">
                        Gate {g.gateId}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {g.name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {g.details}
                    </p>
                    {g.evidenceLinks && g.evidenceLinks.length > 0 && (
                      <div className="flex items-center gap-1 pt-1">
                        <span className="text-[10px] text-slate-400">Evidence:</span>
                        {g.evidenceLinks.map((ev: string) => (
                          <span
                            key={ev}
                            className="text-[10px] font-mono px-1 bg-white border border-slate-200 rounded text-slate-700 font-semibold"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      g.status === 'PASSED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : g.status === 'HUMAN_APPROVAL_REQUIRED'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : g.status === 'PENDING' || g.status === 'UNAVAILABLE'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}
                  >
                    {g.status === 'HUMAN_APPROVAL_REQUIRED' ? 'Human Sign-off Required' : g.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sign-Off Modal */}
      {isSignoffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Execute v0.1 Definition-of-Done Sign-Off
                </h3>
                <p className="text-xs text-slate-500">
                  Governance SEC-CTRL-020: Gate 7 Quorum & Audit Record
                </p>
              </div>
            </div>

            {signoffError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{signoffError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Authorized Signer Identity (Actor)
                </label>
                <input
                  type="text"
                  value={signoffActor}
                  onChange={(e) => setSignoffActor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g., Security Lead (Gio)"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sign-Off Notes / Ratification Justification
                </label>
                <textarea
                  rows={3}
                  value={signoffNotes}
                  onChange={(e) => setSignoffNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Notes recorded into cryptographic audit ledger"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-[11px] text-slate-600">
                <div className="font-semibold text-slate-800">Ceremony Invariants Enforced:</div>
                <div>• Cryptographic SHA-256 state hash committed to audit ledger.</div>
                <div>• Work item DMK-165 transitioned to VERIFIED status with EV-165 link.</div>
                <div>• Project release readiness set to 100%.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSignoffModalOpen(false)}
                disabled={signingOff}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSignoff}
                disabled={signingOff || !signoffActor.trim() || !canonicalReady}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                {signingOff ? 'Recording Ceremony...' : 'Authorize & Seal v0.1 Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Projection Viewer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-700">{selectedDoc}.md</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] hidden sm:inline">Project state version {project.stateVersion}</span>
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-0.5 flex items-center text-xs">
              <button
                type="button"
                data-testid="projection-toggle-rendered"
                onClick={() => setViewMode('RENDERED')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                  viewMode === 'RENDERED'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Rendered
              </button>
              <button
                type="button"
                data-testid="projection-toggle-raw"
                onClick={() => setViewMode('RAW')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                  viewMode === 'RAW'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                Raw Source
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'RENDERED' ? (
          <div className="p-8 bg-slate-50/50">
            <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200/80 p-8 shadow-xs">
              <MarkdownRenderer
                content={mdContent}
                testId="dynamic-projection-rendered"
              />
            </div>
          </div>
        ) : (
          <div
            data-testid="dynamic-projection-raw"
            className="p-8 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto bg-white"
          >
            {mdContent}
          </div>
        )}
      </div>
    </div>
  );
};

