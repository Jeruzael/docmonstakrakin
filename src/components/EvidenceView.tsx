import React, { useState } from 'react';
import {
  FileBadge,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ShieldCheck,
  Terminal,
  GitCommit,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Evidence, AuditEvent } from '../types';

interface EvidenceViewProps {
  evidenceList?: Evidence[];
  auditLogs?: AuditEvent[];
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ evidenceList = [], auditLogs = [] }) => {
  const [tab, setTab] = useState<'EVIDENCE' | 'AUDIT'>('EVIDENCE');
  const [filterActor, setFilterActor] = useState('ALL');
  const [search, setSearch] = useState('');

  const filteredAudits = (auditLogs || []).filter((log) => {
    if (filterActor !== 'ALL' && !log.actor.includes(filterActor)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        (log.reason && log.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Evidence Center & Append-Only Audit Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            A-SSDLC separates implementation from verified proof. No claim is accepted without evidence.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setTab('EVIDENCE')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              tab === 'EVIDENCE' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Verification Evidence ({evidenceList.length})
          </button>
          <button
            onClick={() => setTab('AUDIT')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              tab === 'AUDIT' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Append-Only Audit ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* 1. Evidence Center */}
      {tab === 'EVIDENCE' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <strong>Assurance Principle:</strong> A task or security control cannot become VERIFIED merely because an agent or engineer claims completion. Completion requires verifiable artifacts.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidenceList.map((ev) => (
              <div
                key={ev.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {ev.id}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ev.result}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm">{ev.title}</h3>

                <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
                  {ev.command && (
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>{ev.command}</span>
                    </div>
                  )}
                  {ev.commitHash && (
                    <div className="flex items-center gap-2">
                      <GitCommit className="w-3.5 h-3.5 text-slate-400" />
                      <span>Commit: {ev.commitHash}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{ev.details}</p>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                  <div>
                    <span>Work Item:</span> <strong className="font-mono text-blue-700">{ev.workItemId}</strong>
                  </div>
                  <div>
                    <span>Producer:</span> <strong className="text-slate-700">{ev.producer}</strong>
                  </div>
                  <div className="font-mono text-[10px] truncate max-w-[140px]" title={ev.sha256Hash}>
                    sha256: {ev.sha256Hash.substring(0, 10)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Audit Ledger */}
      {tab === 'AUDIT' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-700">Audit Invariant:</span>
              <span className="text-slate-500">Append-only; mutation and deletion disabled by system policy.</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter audit actions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
              />
              <select
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="ALL">All Actors</option>
                <option value="Gio">Gio (Developer)</option>
                <option value="Security">Security Policy Engine</option>
                <option value="System">System Bootstrap</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">State Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAudits.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">{event.id}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{event.actor}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {event.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-800">{event.target}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{event.reason || '—'}</td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{event.stateHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
