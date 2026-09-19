import { RequestSignoff } from './RequestSignoff';
import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Clock,
  Layers,
  Code2,
  ExternalLink,
  ChevronRight,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Project, Requirement, RiskLevel, RequirementCategory, RequirementStatus } from '../types.js';

interface RequirementsViewProps {
  project?: Project;
  requirements?: Requirement[];
  onAddRequirement: (req: Partial<Requirement>) => Promise<void>;
  onUpdateRequirementStatus?: (reqId: string, status: RequirementStatus, justification?: string) => Promise<any>;
  selectedReqId?: string;
}

export const RequirementsView: React.FC<RequirementsViewProps> = ({
  project,
  requirements = [],
  onAddRequirement,
  onUpdateRequirementStatus,
  selectedReqId,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeDrawerReqId, setActiveDrawerReqId] = useState<string | null>(() => selectedReqId || null);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (selectedReqId) {
      setActiveDrawerReqId(selectedReqId);
      setStatusError('');
    }
  }, [selectedReqId]);

  const activeDrawerReq = (requirements || []).find((r) => r.id === activeDrawerReqId) || null;
  const [drawerTab, setDrawerTab] = useState<'OVERVIEW' | 'TRACEABILITY' | 'EVIDENCE'>('TRACEABILITY');
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusActionNote, setStatusActionNote] = useState('');

  // New Req form state
  const [newTitle, setNewTitle] = useState('');
  const [newStatement, setNewStatement] = useState('');
  const [newCategory, setNewCategory] = useState<RequirementCategory>('FUNCTIONAL');
  const [newPriority, setNewPriority] = useState<RiskLevel>('MEDIUM');
  const [newRationale, setNewRationale] = useState('');

  const filteredRequirements = (requirements || []).filter((r) => {
    if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
    if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.statement.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStatement.trim()) return;

    // Honest manual entry: NO fabricated links to RISK-001, CTRL-SSDF-PW.1, or DMK-042!
    await onAddRequirement({
      title: newTitle.trim(),
      statement: newStatement.trim(),
      category: newCategory,
      priority: newPriority,
      status: 'PROPOSED',
      source: { type: 'stakeholder', id: 'MANUAL_ENTRY' },
      riskLinks: [],
      threatLinks: [],
      standardLinks: [],
      workItems: [],
      tests: [],
      evidence: [],
      rationale: newRationale.trim() || undefined,
    });

    setNewTitle('');
    setNewStatement('');
    setNewRationale('');
    setShowAddModal(false);
  };

  const handleStatusChange = async (reqId: string, newStatus: RequirementStatus) => {
    if (!onUpdateRequirementStatus) return;
    try {
      setStatusError('');
      await onUpdateRequirementStatus(reqId, newStatus, statusActionNote);
      setStatusActionNote('');
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : 'Requirement status update failed'
      );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Canonical Requirements Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Structured requirements with honest provenance and bidirectional traceability to discovery origins, risks, standards, and verification proof.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Requirement
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by ID, title, keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="PROPOSED">Proposed</option>
            <option value="APPROVED">Approved</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="DEFERRED">Deferred</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Categories</option>
            <option value="FUNCTIONAL">Functional</option>
            <option value="SECURITY">Security</option>
            <option value="AI_SPECIFIC">AI Specific</option>
            <option value="PRIVACY">Privacy</option>
            <option value="OPERATIONAL">Operational</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Requirements Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="divide-y divide-slate-100">
          {filteredRequirements.map((req) => (
            <div
              key={req.id}
              onClick={() => {
                setStatusError('');
                setActiveDrawerReqId(req.id);
              }}
              className="p-5 hover:bg-slate-50/80 transition-colors cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {req.id}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-800 transition-colors">
                    {req.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {req.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      req.priority === 'CRITICAL'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : req.priority === 'HIGH'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    ● {req.priority}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : req.status === 'PROPOSED'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : req.status === 'UNDER_REVIEW'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>

              {/* Full Statement display */}
              <p className="text-xs text-slate-700 leading-relaxed max-w-4xl">{req.statement}</p>

              {/* Source & Traceability Metadata row */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                <div>
                  <span className="text-slate-400">Origin:</span>{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {req.source.type}: {req.source.id}
                    {project && req.status === 'PROPOSED' && <RequestSignoff projectId={project.id} targetEntityId={req.id} targetEntityType="REQUIREMENT" requestedBy={project.owner}/>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Risk:</span>{' '}
                  {req.riskLinks && req.riskLinks.length > 0 ? (
                    <span className="font-mono font-medium text-red-700">{req.riskLinks.join(', ')}</span>
                  ) : (
                    <span className="font-mono font-medium text-slate-500">NOT ASSESSED</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Controls:</span>{' '}
                  {req.standardLinks && req.standardLinks.length > 0 ? (
                    <span className="font-mono font-medium text-purple-700">{req.standardLinks.join(', ')}</span>
                  ) : (
                    <span className="font-mono font-medium text-slate-500">NOT MAPPED</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Work Items:</span>{' '}
                  {req.workItems && req.workItems.length > 0 ? (
                    <span className="font-mono font-medium text-blue-700">{req.workItems.join(', ')}</span>
                  ) : (
                    <span className="font-mono font-medium text-slate-500">NONE</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Tests:</span>{' '}
                  {req.tests && req.tests.length > 0 ? (
                    <span className="font-mono font-medium text-emerald-700">{req.tests.join(', ')}</span>
                  ) : (
                    <span className="font-mono font-medium text-slate-500">NONE</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Evidence:</span>{' '}
                  {req.evidence && req.evidence.length > 0 ? (
                    <span className="font-mono font-medium text-emerald-700">{req.evidence.join(', ')}</span>
                  ) : (
                    <span className="font-mono font-medium text-slate-500">NONE</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredRequirements.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No requirements match the search and filter criteria.
            </div>
          )}
        </div>
      </div>

      {/* Side Drawer for Selected Requirement */}
      {activeDrawerReq && (
        <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  {activeDrawerReq.id}
                </span>
                <span className="text-xs font-semibold text-slate-500">{activeDrawerReq.category}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    activeDrawerReq.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {activeDrawerReq.status}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{activeDrawerReq.title}</h2>
            </div>
            <button
              onClick={() => {
                setStatusError('');
                setActiveDrawerReqId(null);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="flex border-b border-slate-200 px-5 text-xs font-semibold">
            <button
              onClick={() => setDrawerTab('TRACEABILITY')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
                drawerTab === 'TRACEABILITY'
                  ? 'border-emerald-600 text-emerald-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Traceability Chain
            </button>
            <button
              onClick={() => setDrawerTab('OVERVIEW')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
                drawerTab === 'OVERVIEW'
                  ? 'border-emerald-600 text-emerald-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Overview & Governance
            </button>
            <button
              onClick={() => setDrawerTab('EVIDENCE')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
                drawerTab === 'EVIDENCE'
                  ? 'border-emerald-600 text-emerald-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Evidence & Tests ({activeDrawerReq.evidence?.length || 0})
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            {statusError && (
              <div
                id="requirement-status-error-banner"
                className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5 shadow-2xs"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-red-900">Requirement status update failed</p>
                  <p className="text-red-700 font-medium">{statusError}</p>
                </div>
              </div>
            )}
            {drawerTab === 'TRACEABILITY' && (
              <div className="space-y-6">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                  <strong>Honest Traceability:</strong> Tracks exact origin and dependencies without fabricated links.
                </div>

                {/* Vertical Traceability Chain */}
                <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {/* 1. Origin Question / Source */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-2xs"></div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                        Origin Source
                      </span>
                      <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                        {activeDrawerReq.source.type}: {activeDrawerReq.source.id}
                      </div>
                    </div>
                  </div>

                  {/* 2. Requirement Statement */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-2xs"></div>
                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                        Requirement Statement
                      </span>
                      <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                        {activeDrawerReq.id} [{activeDrawerReq.status}]
                      </div>
                      <p className="text-slate-700 text-xs mt-1 font-medium">{activeDrawerReq.statement}</p>
                    </div>
                  </div>

                  {/* 3. Linked Risk */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-2xs"></div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                        Governing Risks
                      </span>
                      {activeDrawerReq.riskLinks && activeDrawerReq.riskLinks.length > 0 ? (
                        <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                          {activeDrawerReq.riskLinks.join(', ')}
                        </div>
                      ) : (
                        <p className="font-mono text-slate-500 text-xs mt-0.5 font-semibold">
                          Risk: NOT ASSESSED
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 4. Assurance Control */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow-2xs"></div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                        Pinned Standards & Controls
                      </span>
                      {activeDrawerReq.standardLinks && activeDrawerReq.standardLinks.length > 0 ? (
                        <div className="font-mono font-bold text-purple-800 text-xs mt-0.5">
                          {activeDrawerReq.standardLinks.join(', ')}
                        </div>
                      ) : (
                        <p className="font-mono text-slate-500 text-xs mt-0.5 font-semibold">
                          Controls: NOT MAPPED
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 5. Assigned Work Items */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-2xs"></div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                        Assigned Tasks / Work Items
                      </span>
                      {activeDrawerReq.workItems && activeDrawerReq.workItems.length > 0 ? (
                        <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                          {activeDrawerReq.workItems.join(', ')}
                        </div>
                      ) : (
                        <p className="font-mono text-slate-500 text-xs mt-0.5 font-semibold">
                          Work Items: NONE
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 6. Verification Tests */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-2xs"></div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                        Verification Tests
                      </span>
                      {activeDrawerReq.tests && activeDrawerReq.tests.length > 0 ? (
                        <div className="font-mono font-bold text-indigo-800 text-xs mt-0.5">
                          {activeDrawerReq.tests.join(', ')}
                        </div>
                      ) : (
                        <p className="font-mono text-slate-500 text-xs mt-0.5 font-semibold">
                          Tests: NONE
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 7. Verification Evidence */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-teal-500 border-2 border-white shadow-2xs"></div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                        Verification Evidence
                      </span>
                      {activeDrawerReq.evidence && activeDrawerReq.evidence.length > 0 ? (
                        <div className="font-mono font-bold text-emerald-800 text-xs mt-0.5">
                          {activeDrawerReq.evidence.join(', ')}
                        </div>
                      ) : (
                        <p className="font-mono text-slate-500 text-xs mt-0.5 font-semibold">
                          Evidence: NONE
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'OVERVIEW' && (
              <div className="space-y-4">
                <div>
                  <label className="text-slate-500 font-semibold block mb-1">Requirement Statement:</label>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 text-xs leading-relaxed font-mono">
                    {activeDrawerReq.statement}
                  </div>
                </div>

                {activeDrawerReq.rationale && (
                  <div>
                    <label className="text-slate-500 font-semibold block mb-1">Rationale & Context:</label>
                    <p className="text-slate-700 text-xs leading-relaxed">{activeDrawerReq.rationale}</p>
                  </div>
                )}

                {/* Status Governance Actions */}
                {onUpdateRequirementStatus && (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <label className="text-slate-700 font-bold block">
                      Requirement Governance Actions:
                    </label>

                    {statusError && (
                      <div
                        id="requirement-status-error"
                        className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-red-900">Requirement status update failed</p>
                          <p className="text-red-700 font-medium mt-0.5">{statusError}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {activeDrawerReq.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleStatusChange(activeDrawerReq.id, 'APPROVED')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Requirement
                        </button>
                      )}
                      {activeDrawerReq.status !== 'UNDER_REVIEW' && (
                        <button
                          onClick={() => handleStatusChange(activeDrawerReq.id, 'UNDER_REVIEW')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          Mark Under Review
                        </button>
                      )}
                      {activeDrawerReq.status !== 'DEFERRED' && (
                        <button
                          onClick={() => handleStatusChange(activeDrawerReq.id, 'DEFERRED')}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                        >
                          Defer
                        </button>
                      )}
                      {activeDrawerReq.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleStatusChange(activeDrawerReq.id, 'REJECTED')}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs cursor-pointer"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {drawerTab === 'EVIDENCE' && (
              <div className="space-y-4">
                {activeDrawerReq.evidence && activeDrawerReq.evidence.length > 0 ? (
                  activeDrawerReq.evidence.map((ev, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="font-mono text-emerald-800 font-bold">{ev}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500">
                    No verification evidence records attached yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Requirement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Add Canonical Requirement</h2>
            <form onSubmit={handleCreateRequirement} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Requirement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scoped Tool Execution Sandbox"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Requirement Statement</label>
                <textarea
                  required
                  rows={4}
                  placeholder="The system MUST enforce..."
                  value={newStatement}
                  onChange={(e) => setNewStatement(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Rationale / Business Justification</label>
                <input
                  type="text"
                  placeholder="Reasoning for this requirement..."
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="FUNCTIONAL">Functional</option>
                    <option value="SECURITY">Security</option>
                    <option value="AI_SPECIFIC">AI Specific</option>
                    <option value="PRIVACY">Privacy</option>
                    <option value="OPERATIONAL">Operational</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Save as Proposed Requirement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
