import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertOctagon,
  FileText,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { Project, RecommendedNextAction, AuditEvent, Risk, Question } from '../types';

interface DashboardViewProps {
  project: Project;
  nextAction: RecommendedNextAction;
  recentAudits?: AuditEvent[];
  risks?: Risk[];
  questions?: Question[];
  onNavigate: (view: string, targetId?: string) => void;
  onOpenOverrideModal: (gateName: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  nextAction,
  recentAudits = [],
  risks = [],
  questions = [],
  onNavigate,
  onOpenOverrideModal,
}) => {
  const unresolvedBlockers = (questions || []).filter(
    (q) => q.importance === 'BLOCKING' && q.state === 'UNRESOLVED'
  );

  const topRisk = (risks || []).find((r) => r.inherentLevel === 'CRITICAL') || (risks || [])[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 shadow-2xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                {project.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                On track
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
              Documentation. Verification. Assurance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Project Profiles</span>
              <span className="font-semibold text-slate-700">{project.profiles.join(' + ').replace(/_APPLICATION/g, '')}</span>
            </div>
            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Owner</span>
              <span className="font-semibold text-slate-700">{project.owner}</span>
            </div>
            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Release</span>
              <span className="font-semibold text-slate-700">{project.targetRelease}</span>
            </div>
            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">State Version</span>
              <span className="font-mono font-semibold text-slate-700">project@{project.stateVersion}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Row: Project Health Gauge & Dimensions + Prominent Recommended Next Step */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Project Health Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Project Health & Dimensions</h2>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              ✓ Compliant
            </span>
          </div>

          <div className="py-4 flex flex-col sm:flex-row items-center gap-6">
            {/* Health Score Dial */}
            <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-1000 ease-out"
                  strokeDasharray={`${project.healthScore}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {project.healthScore}%
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Overall</span>
              </div>
            </div>

            {/* Underlying Dimension Bars */}
            <div className="flex-1 w-full space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Implementation</span>
                  <span className="font-semibold text-slate-900">{project.progress.implementation}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${project.progress.implementation}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Verification Evidence</span>
                  <span className="font-semibold text-slate-900">{project.progress.verification}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${project.progress.verification}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Security Assurance</span>
                  <span className="font-semibold text-slate-900">{project.progress.securityAssurance}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${project.progress.securityAssurance}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Release Readiness</span>
                  <span className="font-semibold text-slate-900">{project.progress.releaseReadiness}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${project.progress.releaseReadiness}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>A-SSDLC Phase: <strong className="text-slate-700">{project.lifecyclePhase}</strong></span>
            <button
              onClick={() => onNavigate('requirements')}
              className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              Inspect Matrix <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* The Prominent "Recommended Next Step" Card (7 cols) */}
        <div className="lg:col-span-7 bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-xl p-5 md:p-6 shadow-md relative overflow-hidden flex flex-col justify-between border border-slate-700">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Recommended Next Step (Deterministic)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-700/50">
                CRITICAL GATE
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-white tracking-tight leading-snug">
              {nextAction.title}
            </h3>

            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              {nextAction.reason}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Blocks:</span>
              {nextAction.blocks.map((b) => (
                <span key={b} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-700/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Evaluated deterministically from active blockers & risk floors.
            </span>
            <button
              onClick={() => onNavigate('requirements')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-md"
            >
              <span>Resolve in Discovery</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Middle Row: Risk Flags Panel & Missing-Information Blockers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Flags Panel (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">Project Risk Classification</h2>
            </div>
            <button
              onClick={() => onNavigate('risk')}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
            >
              View Register <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50/60 p-3.5 rounded-lg border border-red-100">
              <span className="text-[11px] font-semibold text-red-600 uppercase">Inherent Risk</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-red-800">{topRisk?.inherentScore || 18}</span>
                <span className="text-xs font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                  ● {topRisk?.inherentLevel || 'CRITICAL'}
                </span>
              </div>
              <span className="text-[10px] text-red-600 mt-1 block">Likelihood 4 × Impact 5</span>
            </div>

            <div className="bg-amber-50/60 p-3.5 rounded-lg border border-amber-100">
              <span className="text-[11px] font-semibold text-amber-600 uppercase">Residual Risk</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-amber-800">{topRisk?.residualScore || 10}</span>
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  ● {topRisk?.residualLevel || 'HIGH'}
                </span>
              </div>
              <span className="text-[10px] text-amber-600 mt-1 block">Post-Control Mitigation</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-700 block mb-2">Key Risk Contributors:</span>
            <div className="flex flex-wrap gap-2">
              {topRisk?.drivers.map((driver, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                >
                  {driver}
                </span>
              ))}
            </div>
          </div>

          {topRisk?.mandatoryFloorApplied && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              <span>
                <strong>Mandatory Risk Floor:</strong> {topRisk.floorReason}
              </span>
            </div>
          )}
        </div>

        {/* Missing-Information Blockers Screen (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-slate-900">
                Phase Transition Gates ({unresolvedBlockers.length} Blockers)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Architecture Gate</span>
          </div>

          <p className="text-xs text-slate-600">
            A-SSDLC transition to <strong>Architecture Planning</strong> is blocked until required discovery decisions are resolved or formally overridden.
          </p>

          <div className="space-y-2">
            {unresolvedBlockers.map((blocker) => (
              <div
                key={blocker.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex items-start justify-between gap-3 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{blocker.id}</span>
                      <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-100">
                        BLOCKING
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5 font-medium">{blocker.question}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onNavigate('requirements', blocker.id)}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => onOpenOverrideModal(blocker.id)}
                    className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                    title="Override gate with recorded risk acceptance"
                  >
                    Override
                  </button>
                </div>
              </div>
            ))}

            {unresolvedBlockers.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                All discovery blockers are resolved! Phase ready for advance.
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Override events are permanently audited</span>
            <button
              onClick={() => onNavigate('requirements')}
              className="text-emerald-700 font-semibold hover:underline"
            >
              Open Adaptive Questionnaire →
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Recent Activity / Append-Only Audit Trail */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Recent Control Plane Activity (Append-Only)</h2>
          </div>
          <button
            onClick={() => onNavigate('evidence')}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
          >
            Full Audit Ledger <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {recentAudits.slice(0, 5).map((audit) => (
            <div key={audit.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">
                  {audit.actor.substring(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{audit.actor}</span>
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                      {audit.action}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">{audit.target}</span>
                  </div>
                  {audit.reason && (
                    <p className="text-slate-500 text-xs mt-0.5">{audit.reason}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 sm:text-right shrink-0">
                <span className="font-mono text-[10px] text-slate-400">hash: {audit.stateHash}</span>
                <span className="text-slate-400 text-[11px]">
                  {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
