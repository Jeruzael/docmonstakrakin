import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Search,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';
import { Project, ApprovalItem, ApprovalType } from '../types';

interface ApprovalsViewProps {
  project: Project;
  onRefreshData?: () => void;
}

interface ReviewerSessionIdentity {
  id: string;
  name: string;
  roles: string[];
  kind: 'HUMAN' | 'AGENT';
  roleSource: string;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({ project, onRefreshData }) => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [sessionIdentity, setSessionIdentity] = useState<ReviewerSessionIdentity | null>(null);
  const [error, setError] = useState('');
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  // Decision Modal
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionComment, setDecisionComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Request New Approval Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqType, setReqType] = useState<ApprovalType>('REQUIREMENT_BASELINE');
  const [reqTargetId, setReqTargetId] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqImpact, setReqImpact] = useState('');
  const [reqUrgency, setReqUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/governance/session');
      if (res.ok) {
        const data = await res.json();
        setSessionIdentity(data.identity || null);
      }
    } catch (err) {
      console.error('Failed to fetch governance session:', err);
    }
  };

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/approvals`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
        if (selectedItem && selectedItem.projectId === project.id) {
          const updated = data.find((a: ApprovalItem) => a.id === selectedItem.id);
          if (updated) setSelectedItem(updated);
          else setSelectedItem(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    setSelectedItem(null);
    setError('');
    setShowDecisionModal(false);
    setShowRequestModal(false);
    setHumanConfirmed(false);
    setApprovals([]);

    const fetchForProject = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${project.id}/approvals`);
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setApprovals(data);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to fetch approvals:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchForProject();
    fetchSession();

    return () => {
      isCancelled = true;
    };
  }, [project.id]);

  const getQuorumProgress = (item: ApprovalItem) => {
    if (item.quorum) {
      return {
        status: item.quorum.status,
        hasQuorum: item.quorum.hasQuorum,
        required: ['Security Officer', 'Lead Architect'],
        satisfied: item.quorum.satisfiedRoles || [],
        pending: item.quorum.pendingRoles || [],
        reason: item.quorum.reason,
      };
    }

    const required = ['Security Officer', 'Lead Architect'];
    if (
      item.policyVersion !== 'LOCAL_SESSION_V1' ||
      !Array.isArray(item.requiredRoles) ||
      item.requiredRoles.length !== 2 ||
      item.requiredRoles[0] !== required[0] ||
      item.requiredRoles[1] !== required[1] ||
      !item.targetDigest
    ) {
      return {
        status: 'INVALID' as const,
        hasQuorum: false,
        required,
        satisfied: [],
        pending: required,
        reason: 'Invalid or unsupported approval policy metadata',
      };
    }

    const satisfied: string[] = [];
    const usedIdentities = new Set<string>();

    for (const sig of item.approvalsCollected || []) {
      if (
        sig.decision === 'APPROVED' &&
        required.includes(sig.role) &&
        typeof sig.identityId === 'string' &&
        sig.identityId.trim() &&
        sig.roleSource === 'LOCAL_SERVER_ROSTER'
      ) {
        if (!usedIdentities.has(sig.identityId) && !satisfied.includes(sig.role)) {
          usedIdentities.add(sig.identityId);
          satisfied.push(sig.role);
        }
      }
    }

    const pending = required.filter((r) => !satisfied.includes(r));
    const hasQuorum = required.length > 0 && pending.length === 0;
    const status = item.status === 'REJECTED'
      ? 'REJECTED'
      : hasQuorum
      ? 'SATISFIED'
      : satisfied.length > 0
      ? 'PARTIAL'
      : 'PENDING';

    return { status, hasQuorum, required, satisfied, pending, reason: undefined };
  };

  const handleOpenDecision = (item: ApprovalItem, decision: 'APPROVED' | 'REJECTED') => {
    setError('');
    setHumanConfirmed(false);
    setSelectedItem(item);
    setDecisionType(decision);
    setDecisionComment(
      decision === 'APPROVED'
        ? 'Verified against zero-trust architectural boundaries and regulatory security profile.'
        : 'Requires additional mitigation proof or ADR specification.'
    );
    setShowDecisionModal(true);
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (selectedItem.projectId !== project.id) {
      setError('Active approval item belongs to a different project; submission cancelled.');
      setSelectedItem(null);
      return;
    }
    setError('');

    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/approvals/${selectedItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          humanConfirmed,
          decision: decisionType,
          comment: decisionComment,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Decision failed with status ${res.status}`);
        return;
      }

      setShowDecisionModal(false);
      await fetchApprovals();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Decision submission failed:', err);
      setError(err?.message || 'Decision submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!reqTitle.trim()) {
      setError('Title is required');
      return;
    }
    if (!reqTargetId.trim()) {
      setError('Target Entity ID is required; select a canonical requirement, ADR, risk, or override.');
      return;
    }

    try {
      setSubmitting(true);
      let targetEntityType: 'REQUIREMENT' | 'ADR' | 'RISK' | 'OVERRIDE' = 'REQUIREMENT';
      if (reqType === 'ADR_SIGN_OFF') targetEntityType = 'ADR';
      else if (reqType === 'SECURITY_OVERRIDE') targetEntityType = 'OVERRIDE';
      else if (reqType === 'RISK_ACCEPTANCE') targetEntityType = 'RISK';

      const res = await fetch(`/api/projects/${project.id}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reqTitle.trim(),
          type: reqType,
          targetEntityId: reqTargetId.trim(),
          targetEntityType,
          description: reqDescription.trim(),
          impactAnalysis: reqImpact.trim(),
          urgency: reqUrgency,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Request failed with status ${res.status}`);
        return;
      }

      setShowRequestModal(false);
      setReqTitle('');
      setReqDescription('');
      setReqImpact('');
      setReqTargetId('');
      await fetchApprovals();
    } catch (err: any) {
      console.error('Failed to create approval request:', err);
      setError(err?.message || 'Failed to create approval request');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredApprovals = approvals.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.targetEntityId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;
  const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = approvals.filter((a) => a.status === 'REJECTED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Reviewer Session Identity Banner */}
      {sessionIdentity ? (
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              <strong>Authenticated Human Reviewer:</strong> {sessionIdentity.name} ({sessionIdentity.id})
            </span>
            <span className="font-mono text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
              Roles: {sessionIdentity.roles.join(', ')}
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-wider">
            LOCAL ROSTER SESSION
          </span>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>No active human reviewer session. Sign in as a configured reviewer to sign decisions.</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase">UNAUTHENTICATED</span>
        </div>
      )}

      {/* View Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">A-SSDLC Phase 6</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 font-bold">
              MULTI-ROLE GOVERNANCE INBOX
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            Governance & Quorum Approvals Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Formal multi-role sign-off gates for lifecycle transitions, architectural decision records, requirement baselines, and security overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchApprovals(); fetchSession(); }}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => { setError(''); setShowRequestModal(true); }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Request Sign-Off
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Quorum
            </span>
            <span className="text-lg font-bold text-amber-700 font-mono">
              {pendingCount}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Ratified & Enacted
            </span>
            <span className="text-lg font-bold text-emerald-700 font-mono">
              {approvedCount}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-700 rounded-lg">
            <XCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Rejected / Remediating
            </span>
            <span className="text-lg font-bold text-red-700 font-mono">
              {rejectedCount}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Enforcement Policy
            </span>
            <span className="text-xs font-bold text-slate-800">
              Distinct Security Officer & Lead Architect
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search approvals, targets, IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-slate-400 font-medium"
          />
        </div>
      </div>

      {/* Main Grid: Approvals List & Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          {filteredApprovals.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              No governance sign-off requests are pending. Select a canonical requirement, ADR, risk, or override to request sign-off.
            </div>
          ) : (
            filteredApprovals.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const q = getQuorumProgress(item);
              return (
                <div
                  key={item.id}
                  data-testid={`approval-card-${item.id}`}
                  onClick={() => setSelectedItem(item)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {item.id}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          {item.type}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            item.urgency === 'CRITICAL'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : item.urgency === 'HIGH'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-50 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {item.urgency}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full inline-block ${
                          q.status === 'INVALID'
                            ? 'bg-red-100 text-red-800'
                            : q.status === 'STALE'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'APPROVED' || q.status === 'SATISFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'REJECTED' || q.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {q.status === 'INVALID'
                          ? 'INVALID POLICY'
                          : q.status === 'STALE'
                          ? 'STALE TARGET'
                          : item.status}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        {q.status === 'INVALID'
                          ? 'policy invalid'
                          : q.status === 'STALE'
                          ? 'target stale'
                          : `${q.satisfied.length}/${q.required.length} roles ratified`}
                      </div>
                    </div>
                  </div>

                  {/* Quorum Role Status Pills */}
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    {q.required.map((role) => {
                      const isSat = q.satisfied.includes(role);
                      return (
                        <span
                          key={role}
                          className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            q.status === 'INVALID'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : isSat
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {role}: {q.status === 'INVALID' ? '⚠️ INVALID' : isSat ? '✓ RATIFIED' : '⏳ PENDING'}
                        </span>
                      );
                    })}
                  </div>

                  {item.status === 'PENDING' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Requested by <strong>{item.requestedBy}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {q.status === 'INVALID' ? (
                          <span className="text-[11px] font-semibold text-red-600">
                            Policy invalid: fresh sign-off required
                          </span>
                        ) : q.status === 'STALE' ? (
                          <span className="text-[11px] font-semibold text-amber-600">
                            Target modified: fresh sign-off required
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDecision(item, 'REJECTED');
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 rounded border border-red-200 cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDecision(item, 'APPROVED');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-2xs cursor-pointer"
                            >
                              Sign Decision
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Inspector (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-5">
          {selectedItem && selectedItem.projectId === project.id ? (
            (() => {
              const q = getQuorumProgress(selectedItem);
              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">{selectedItem.id}</span>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            q.status === 'INVALID'
                              ? 'bg-red-100 text-red-800'
                              : q.status === 'STALE'
                              ? 'bg-amber-100 text-amber-800'
                              : selectedItem.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : selectedItem.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {q.status === 'INVALID'
                            ? 'INVALID POLICY'
                            : q.status === 'STALE'
                            ? 'STALE TARGET'
                            : selectedItem.status}
                        </span>
                      </div>
                      <h2 className="text-sm font-bold text-slate-900 mt-1">
                        {selectedItem.title}
                      </h2>
                    </div>

                    {selectedItem.status === 'PENDING' && q.status !== 'INVALID' && q.status !== 'STALE' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenDecision(selectedItem, 'REJECTED')}
                          className="px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleOpenDecision(selectedItem, 'APPROVED')}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs cursor-pointer"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>

                  {(q.status === 'INVALID' || q.status === 'STALE') && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        q.status === 'INVALID'
                          ? 'bg-red-50 border-red-200 text-red-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${q.status === 'INVALID' ? 'text-red-600' : 'text-amber-600'}`} />
                      <div>
                        <span className="font-bold block">
                          {q.status === 'INVALID' ? 'Invalid Approval Policy' : 'Stale Target Entity Revision'}
                        </span>
                        <p className="mt-0.5 text-[11px] leading-relaxed">
                          {q.reason || (q.status === 'INVALID' ? 'Approval metadata does not match canonical dual-role quorum policy.' : 'Target entity was modified after sign-off was requested.')}
                        </p>
                        <span className="text-[10px] font-semibold text-slate-600 mt-1 block">
                          Action required: A fresh authorized sign-off request must be initiated.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quorum Progress Breakdown */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Dual-Role Quorum Progress
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-700">
                        {q.satisfied.length} of {q.required.length} Roles Satisfied
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {q.required.map((role) => {
                        const isSat = q.satisfied.includes(role);
                        return (
                          <div
                            key={role}
                            className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between ${
                              isSat
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span className="font-bold">{role}</span>
                            <span className={isSat ? 'text-emerald-700 font-bold' : 'text-amber-600 font-semibold'}>
                              {isSat ? '✓ SATISFIED' : '⏳ PENDING'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                      Rule: Quorum requires distinct human reviewer identities for Security Officer and Lead Architect.
                    </p>
                  </div>

                  {/* Description & Impact */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Sign-Off Context & Intent
                      </span>
                      <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {selectedItem.description}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Downstream Impact Analysis
                      </span>
                      <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-[11px]">
                        {selectedItem.impactAnalysis || 'No formal impact assessment attached.'}
                      </p>
                    </div>
                  </div>

                  {/* Target Entity & Risk Metadata */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Target Entity
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 block mt-0.5">
                        {selectedItem.targetEntityId} ({selectedItem.targetEntityType})
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Risk Classification
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 block mt-0.5">
                        {selectedItem.riskLevel}
                      </span>
                    </div>
                  </div>

                  {/* Sign-Off Quorum Ledger */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Sign-Off Quorum Ledger
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Required Roles: {q.required.join(', ')}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {selectedItem.approvalsCollected.length === 0 ? (
                        <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                          No signatures collected yet. Pending review from assigned roles.
                        </div>
                      ) : (
                        selectedItem.approvalsCollected.map((sig, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border ${
                              sig.decision === 'APPROVED'
                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                                : 'bg-red-50/50 border-red-200 text-red-950'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs">
                                {sig.approver} ({sig.role})
                              </span>
                              <span className="font-mono text-[10px] font-bold uppercase">
                                {sig.decision} • {sig.timestamp ? sig.timestamp.substring(0, 10) : ''}
                              </span>
                            </div>
                            {sig.identityId && (
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                Identity ID: {sig.identityId} ({sig.roleSource || 'LOCAL_SERVER_ROSTER'})
                              </div>
                            )}
                            {sig.comment && (
                              <p className="text-[11px] opacity-85 mt-1 italic">
                                "{sig.comment}"
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="p-16 text-center text-xs text-slate-400">
              Select an item from the inbox to inspect policy criteria and sign off.
            </div>
          )}
        </div>
      </div>

      {/* DECISION SIGN-OFF MODAL */}
      {showDecisionModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-900" />
                Sign Governance Decision: {decisionType}
              </h3>
              <button
                onClick={() => setShowDecisionModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitDecision} className="p-5 space-y-4 text-xs">
              {error && (
                <div role="alert" className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-lg">
                  {error}
                </div>
              )}

              <label className="block font-medium cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={humanConfirmed}
                  onChange={(e) => setHumanConfirmed(e.target.checked)}
                  className="mr-2"
                />
                I confirm this decision as an authorized human reviewer.
              </label>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">{selectedItem.title}</span>
                <span className="font-mono text-[10px] text-slate-500 block">
                  Target: {selectedItem.targetEntityId} • Type: {selectedItem.type}
                </span>
              </div>

              {sessionIdentity ? (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
                  Reviewer: <strong>{sessionIdentity.name}</strong> ({sessionIdentity.id})
                  <div className="text-[10px] font-mono text-blue-700 mt-0.5">
                    Authorized roles: {sessionIdentity.roles.join(', ')}
                  </div>
                </div>
              ) : (
                <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Note: Decision requires an active reviewer session.
                </p>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rationale & Governance Audit Note {decisionType === 'REJECTED' && <span className="text-red-600">*</span>}
                </label>
                <textarea
                  rows={3}
                  required={decisionType === 'REJECTED'}
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Record justification for audit trail and compliance verification..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-[11px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-white rounded-lg font-bold shadow-xs cursor-pointer ${
                    decisionType === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? 'Recording...' : `Record ${decisionType} Decision`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST NEW APPROVAL MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-900" />
                Submit Formal Sign-Off Request
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitNewRequest} className="p-5 space-y-4 text-xs">
              {error && (
                <div role="alert" className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Proposal Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ratify REQ-AI-008: Automated Model Prompt Redaction"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Approval Type
                  </label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as ApprovalType)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="REQUIREMENT_BASELINE">Requirement Baseline</option>
                    <option value="ADR_SIGN_OFF">Architectural Decision Record (ADR)</option>
                    <option value="SECURITY_OVERRIDE">Security Override</option>
                    <option value="RISK_ACCEPTANCE">Risk Acceptance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Entity ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. REQ-SEC-019 or ADR-004"
                    value={reqTargetId}
                    onChange={(e) => setReqTargetId(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Note: Release promotion and Gate 7 transitions require dedicated ceremonies and cannot be initiated from this inbox.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Context & Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="Detailed rationale and requirements for sign-off..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Impact Analysis
                </label>
                <textarea
                  rows={2}
                  value={reqImpact}
                  onChange={(e) => setReqImpact(e.target.value)}
                  placeholder="Downstream architectural or operational consequences..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Sign-Off Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
