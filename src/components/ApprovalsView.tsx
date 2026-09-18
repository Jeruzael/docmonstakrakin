import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  FileCheck2,
  Cpu,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Plus,
  ArrowRight,
  MessageSquare,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  Send,
} from 'lucide-react';
import { Project, ApprovalItem, ApprovalType, ApprovalStatus } from '../types';

interface ApprovalsViewProps {
  project: Project;
  onRefreshData?: () => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({ project, onRefreshData }) => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [error,setError] = useState('');
  const [humanConfirmed,setHumanConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  // Decision Modal
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionRole, setDecisionRole] = useState('Security Officer');
  const [decisionApprover, setDecisionApprover] = useState('');
  const [decisionCredential, setDecisionCredential] = useState('');
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

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/approvals`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
        if (selectedItem) {
          const updated = data.find((a: ApprovalItem) => a.id === selectedItem.id);
          if (updated) setSelectedItem(updated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [project.id]);

  const handleOpenDecision = (item: ApprovalItem, decision: 'APPROVED' | 'REJECTED') => {
    setDecisionCredential('');
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

    try {
      setSubmitting(true);
      const res = await fetch(`/api/projects/${project.id}/approvals/${selectedItem.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorType: 'HUMAN', humanConfirmed,
          decision: decisionType,
          role: decisionRole,
          approver: decisionApprover,
          credential: decisionCredential,
          comment: decisionComment,
        }),
      });

      if (!res.ok) {const data = await res.json();setError(data.error);return;}
      if (res.ok) {
        setDecisionCredential('');
        setShowDecisionModal(false);
        await fetchApprovals();
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Decision submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;

    try {
      setSubmitting(true);
      let targetEntityType: 'GATE' | 'REQUIREMENT' | 'ADR' | 'RISK' | 'OVERRIDE' | 'RELEASE' = 'REQUIREMENT';
      if (reqType === 'GATE_TRANSITION') targetEntityType = 'GATE';
      else if (reqType === 'ADR_SIGN_OFF') targetEntityType = 'ADR';
      else if (reqType === 'SECURITY_OVERRIDE') targetEntityType = 'OVERRIDE';
      else if (reqType === 'RISK_ACCEPTANCE') targetEntityType = 'RISK';
      else if (reqType === 'RELEASE_SIGNOFF') targetEntityType = 'RELEASE';

      const res = await fetch(`/api/projects/${project.id}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reqTitle,
          type: reqType,
          targetEntityId: reqTargetId || 'REQ-SEC-019',
          targetEntityType,
          description: reqDescription,
          impactAnalysis: reqImpact,
          urgency: reqUrgency,
          riskLevel: reqUrgency === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          requestedBy: 'Lead Engineer',
          requiredRoles: ['Security Officer', 'Lead Architect'],
        }),
      });

      if (res.ok) {
        setShowRequestModal(false);
        setReqTitle('');
        setReqDescription('');
        setReqImpact('');
        setReqTargetId('');
        await fetchApprovals();
      }
    } catch (err) {
      console.error('Failed to create approval request:', err);
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
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <label className="text-sm block"><input type="checkbox" checked={humanConfirmed} onChange={e=>setHumanConfirmed(e.target.checked)}/> I am an authorized human reviewer, signing in my assigned role.</label>

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
            onClick={fetchApprovals}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowRequestModal(true)}
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
              Dual-Role Quorum Required
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
        {/* Left List (6 or 7 cols) */}
        <div className="lg:col-span-6 space-y-3">
          {filteredApprovals.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              No governance sign-off requests are pending. Imported AI proposals must first be reviewed and accepted into canonical project state before sign-off can be requested.
            </div>
          ) : (
            filteredApprovals.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const hasQuorum = item.approvalsCollected.length >= item.requiredRoles.length;
              return (
                <div
                  key={item.id}
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
                          item.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        {item.approvalsCollected.length}/{item.requiredRoles.length} signed
                      </div>
                    </div>
                  </div>

                  {item.status === 'PENDING' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Requested by <strong>{item.requestedBy}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDecision(item, 'REJECTED');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 rounded border border-red-200"
                        >
                          Reject
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDecision(item, 'APPROVED');
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-2xs"
                        >
                          Sign & Ratify
                        </button>
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
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">{selectedItem.id}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        selectedItem.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedItem.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedItem.status}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 mt-1">
                    {selectedItem.title}
                  </h2>
                </div>

                {selectedItem.status === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenDecision(selectedItem, 'REJECTED')}
                      className="px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleOpenDecision(selectedItem, 'APPROVED')}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                    >
                      Approve
                    </button>
                  </div>
                )}
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

              {/* Policy Gates Verification */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Automated Pre-Flight Policy Gates
                </span>
                <div className="space-y-1.5 text-xs">
                  {selectedItem.policyGates.map((gate, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        {gate.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <div>
                          <span className="font-bold text-slate-800 text-[11px] block">{gate.gateName}</span>
                          <span className="text-[10px] text-slate-500 block">{gate.details}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] font-bold uppercase text-slate-500">
                        {gate.passed ? 'PASSED' : 'PENDING'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign-Off Quorum Ledger */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Sign-Off Quorum Signatures
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Required Roles: {selectedItem.requiredRoles.join(', ')}
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
                            {sig.decision} • {sig.timestamp.substring(0, 10)}
                          </span>
                        </div>
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
              {error && <p role="alert" className="text-red-700">{error}</p>}
              <label className="block">Private reviewer credential
                <input type="password" required autoComplete="off" value={decisionCredential} onChange={e=>setDecisionCredential(e.target.value)} className="block w-full p-2 border rounded" />
              </label>
              <label className="block"><input type="checkbox" required checked={humanConfirmed} onChange={e=>setHumanConfirmed(e.target.checked)} /> I confirm this decision as the named human reviewer.</label>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 block">{selectedItem.title}</span>
                <span className="font-mono text-[10px] text-slate-500 block">
                  Target: {selectedItem.targetEntityId} • Type: {selectedItem.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Signatory Role
                  </label>
                  <select
                    value={decisionRole}
                    onChange={(e) => setDecisionRole(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white font-medium"
                  >
                    <option value="Security Officer">Security Officer</option>
                    <option value="Lead Architect">Lead Architect</option>
                    <option value="Engineering Director">Engineering Director</option>
                    <option value="Compliance Lead">Compliance Lead</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Approver Name
                  </label>
                  <input
                    type="text"
                    required
                    value={decisionApprover}
                    onChange={(e) => setDecisionApprover(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rationale & Governance Audit Note
                </label>
                <textarea
                  rows={3}
                  required
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
                    <option value="GATE_TRANSITION">GATE_TRANSITION</option>
                    <option value="REQUIREMENT_BASELINE">REQUIREMENT_BASELINE</option>
                    <option value="ADR_SIGN_OFF">ADR_SIGN_OFF</option>
                    <option value="SECURITY_OVERRIDE">SECURITY_OVERRIDE</option>
                    <option value="RISK_ACCEPTANCE">RISK_ACCEPTANCE</option>
                    <option value="RELEASE_SIGNOFF">RELEASE_SIGNOFF</option>
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
