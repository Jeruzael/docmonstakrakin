import React, { useState } from 'react';
import {
  BookOpen,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  FileDiff,
  Sparkles,
  Layers,
  Lock,
} from 'lucide-react';
import { StandardControl } from '../types';

interface StandardsViewProps {
  standards?: StandardControl[];
}

export const StandardsView: React.FC<StandardsViewProps> = ({ standards = [] }) => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [migrationPhase, setMigrationPhase] = useState<'DISCOVERED' | 'PREVIEW' | 'APPROVED'>('DISCOVERED');
  const [activeStandardTab, setActiveStandardTab] = useState<string>('ALL');

  const filteredStandards = activeStandardTab === 'ALL'
    ? standards
    : standards.filter((s) => s.standardId === activeStandardTab);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trusted Standards Registry</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
              PINNED LOCKFILE
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Authoritative Security & Development Standards
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Projects pin specific standard versions from official publishers. Updates are never silently applied.
          </p>
        </div>

        <button
          onClick={() => setShowUpdateModal(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Check for Trusted Updates
        </button>
      </div>

      {/* Pinned Standards Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { name: 'NIST SSDF', pub: 'NIST SP 800-218', ver: 'v1.1', status: 'Current', badge: 'bg-emerald-50 text-emerald-700' },
          { name: 'OWASP ASVS', pub: 'OWASP Foundation', ver: 'v4.0.3', status: 'Current', badge: 'bg-emerald-50 text-emerald-700' },
          { name: 'OWASP AISVS', pub: 'OWASP AI Exchange', ver: 'v1.0', status: 'Update Available (v1.1)', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
          { name: 'OWASP SAMM', pub: 'OWASP Maturity Model', ver: 'v2.0.1', status: 'Current', badge: 'bg-emerald-50 text-emerald-700' },
        ].map((std, idx) => (
          <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{std.name}</span>
              <span className="font-mono text-xs font-semibold text-slate-500">{std.ver}</span>
            </div>
            <div className="text-slate-500 text-xs">{std.pub}</div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${std.badge}`}>
                ● {std.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Controls Listing */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 text-xs">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-600" />
            <h2 className="font-bold text-slate-900">Active Pinned Controls & Requirements Mapping</h2>
          </div>
          <span className="text-slate-500 font-mono">5 Pinned Controls Active</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {filteredStandards.map((ctrl) => (
            <div key={ctrl.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                    {ctrl.id}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{ctrl.title}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-500">{ctrl.standardName} {ctrl.version}</span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px]">
                    OFFICIAL
                  </span>
                </div>
              </div>

              <p className="text-slate-600 text-xs leading-relaxed max-w-4xl">{ctrl.description}</p>

              <div className="pt-2 flex items-center gap-6 text-[11px] text-slate-500">
                <div>
                  <span className="text-slate-400">Category:</span>{' '}
                  <span className="font-medium text-slate-800">{ctrl.category}</span>
                </div>
                <div>
                  <span className="text-slate-400">Mapped Requirements:</span>{' '}
                  <span className="font-mono font-bold text-slate-800">{ctrl.mappedRequirementsCount}</span>
                </div>
                <div className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{ctrl.verifiedCount} Verified Controls</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Standards Update Simulation Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">A-SSDLC Standards Update Pipeline</h3>
              </div>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {migrationPhase === 'DISCOVERED' && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                    <span className="font-bold text-amber-900 text-sm block">OWASP AISVS Update Discovered</span>
                    <p className="text-amber-800">
                      Official release <strong>AISVS v1.1</strong> detected from verified publisher mirror with valid SHA-256 signature.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Source Changes</span>
                      <div className="text-slate-800 font-medium space-y-0.5">
                        <div className="text-emerald-700 font-semibold">+ 12 New controls (Agent security & MCP)</div>
                        <div className="text-amber-700 font-semibold">~ 8 Modified verification criteria</div>
                        <div className="text-slate-500">- 2 Deprecated legacy guidelines</div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Project Impact Analysis</span>
                      <div className="text-slate-800 font-medium space-y-0.5">
                        <div>Requirements affected: <strong>14</strong></div>
                        <div>Questions affected: <strong>5</strong></div>
                        <div>Work items affected: <strong>3</strong></div>
                        <div>Lifecycle gates: <strong>1</strong></div>
                      </div>
                    </div>
                  </div>

                  {/* Semantic Diff Preview */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                      <span>Semantic Control Diff Preview</span>
                      <span className="font-mono text-[10px] text-slate-500">CTRL-AISVS-1.3</span>
                    </div>
                    <div className="p-3 font-mono text-[11px] space-y-1 bg-slate-50/50">
                      <div className="text-red-700 line-through">
                        - Validate tool calling arguments using basic type checks.
                      </div>
                      <div className="text-emerald-700 font-semibold">
                        + Enforce deterministic JSON Schema validation and policy boundary verification prior to tool call execution.
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">Current project state remains locked on v1.0.</span>
                    <button
                      onClick={() => setMigrationPhase('PREVIEW')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      Run Migration Dry-Run <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {migrationPhase === 'PREVIEW' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1">
                    <span className="font-bold text-emerald-900 text-sm block">Migration Dry-Run Successful</span>
                    <p className="text-emerald-800">
                      Dry-run completed in an isolated snapshot. No breaking schema changes detected. 1 new requirement will be drafted. Rollback point saved: <strong>snapshot@127</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <span className="font-bold text-slate-800 block">Required Human Migration Approval:</span>
                    <p className="text-slate-600">
                      Per A-SSDLC Section 39, standards migrations alter project controls and must be approved by authorized actors.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                    <button
                      onClick={() => setMigrationPhase('DISCOVERED')}
                      className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setMigrationPhase('APPROVED')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      Approve & Pin AISVS v1.1
                    </button>
                  </div>
                </div>
              )}

              {migrationPhase === 'APPROVED' && (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-base font-bold text-slate-900">AISVS v1.1 Migration Pinned Successfully!</h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    The project standards lockfile has been updated. Audit event logged with pre-migration hash. Rollback remains available at any time.
                  </p>
                  <button
                    onClick={() => {
                      setShowUpdateModal(false);
                      setMigrationPhase('DISCOVERED');
                    }}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white font-bold rounded-lg"
                  >
                    Return to Standards Registry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
