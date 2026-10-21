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
  AlertTriangle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Evidence, AuditEvent } from '../types';

interface EvidenceViewProps {
  evidenceList?: Evidence[];
  auditLogs?: AuditEvent[];
  auditSyncStatus?: 'CURRENT' | 'REFRESHING' | 'REFRESH_FAILED';
  auditSyncError?: string;
  onRetryAuditRefresh?: () => void;
}

function storedResultPresentation(result: unknown) {
  if (result === 'PASSED' || result === 'VERIFIED') return {
    label: result, Icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  };
  if (result === 'FAILED') return {label: result, Icon: XCircle, color: 'text-rose-700 bg-rose-50 border-rose-200'};
  if (result === 'UNTRUSTED') return {label: result, Icon: AlertTriangle, color: 'text-amber-700 bg-amber-50 border-amber-200'};
  return {label: 'UNAVAILABLE', Icon: Clock, color: 'text-slate-700 bg-slate-50 border-slate-200'};
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({
  evidenceList = [],
  auditLogs = [],
  auditSyncStatus = 'CURRENT',
  auditSyncError = '',
  onRetryAuditRefresh,
}) => {
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
            Evidence Records ({evidenceList.length})
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

          <p className="text-xs text-slate-600">
            Stored results and digest references are displayed as recorded. This view does not independently authenticate
            artifacts, verify their hashes or approve task completion.
          </p>
          {evidenceList.length === 0 && <p role="status" className="text-sm text-slate-500">No evidence records for this project.</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidenceList.map((ev) => {
              const result = storedResultPresentation(ev.result);
              const validDigest = typeof ev.sha256Hash === 'string' && /^[a-fA-F0-9]{64}$/.test(ev.sha256Hash);
              return (
              <div
                key={ev.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {ev.id}
                  </span>
                  <span className={`text-[11px] font-bold border px-2 py-0.5 rounded flex items-center gap-1 ${result.color}`}>
                    <result.Icon className="w-3.5 h-3.5" />
                    Stored result: {result.label}
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
                  <div className="font-mono text-[10px] truncate max-w-[190px]" title={validDigest ? ev.sha256Hash : undefined}>
                    {validDigest ? `Stored SHA-256: ${ev.sha256Hash.substring(0, 10)}...` : 'SHA-256 reference unavailable'}
                  </div>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}

      {/* 2. Audit Ledger */}
      {tab === 'AUDIT' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
          {/* Audit Synchronization Status Warnings */}
          {auditSyncStatus === 'REFRESH_FAILED' && (
            <div
              data-testid="audit-sync-warning"
              role="alert"
              className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {auditSyncError ||
                    'Document save succeeded, but the audit ledger has not finished synchronizing. Refresh audit records to confirm the latest event.'}
                </span>
              </div>
              {onRetryAuditRefresh && (
                <button
                  data-testid="btn-retry-audit-sync"
                  onClick={onRetryAuditRefresh}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md text-xs cursor-pointer shrink-0"
                >
                  Refresh audit records
                </button>
              )}
            </div>
          )}

          {auditSyncStatus === 'REFRESHING' && (
            <div
              data-testid="audit-sync-refreshing"
              role="status"
              className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Synchronizing authoritative audit ledger...</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-700">Audit Invariant:</span>
              <span className="text-slate-500">Append-only; mutation and deletion disabled by system policy.</span>
              <span
                data-testid="audit-sync-status-badge"
                className={`ml-2 font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                  auditSyncStatus === 'CURRENT'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {auditSyncStatus === 'CURRENT'
                  ? 'LEDGER SYNCHRONIZED'
                  : auditSyncStatus === 'REFRESHING'
                  ? 'LEDGER SYNCHRONIZING...'
                  : 'LEDGER UNCONFIRMED'}
              </span>
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
