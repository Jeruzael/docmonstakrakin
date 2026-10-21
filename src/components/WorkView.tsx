import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Kanban,
  ListOrdered,
  Layers,
  Calendar,
  CheckSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  X,
  Plus,
  ArrowRight,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { WorkItem, WorkItemStatus, RiskLevel, Requirement } from '../types';

interface CanonicalWbsItemSummary {
  id: string;
  wbsPath: string;
  parentId: string;
  epic: string;
  phase: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  risk: string;
  status: string;
  requirements: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  evidence: string[];
}

interface ReconciliationSummary {
  canonicalItems: number;
  runtimeItems: number;
  synced: number;
  missingRuntime: number;
  statusDrift: number;
  metadataDrift: number;
  runtimeOnly: number;
  blocked: number;
}

interface WorkItemSyncRow {
  id: string;
  wbsPath?: string;
  title: string;
  canonicalStatus?: string;
  runtimeStatus?: string;
  canonicalType?: string;
  runtimeType?: string;
  category: 'SYNCED' | 'MISSING_RUNTIME' | 'STATUS_DRIFT' | 'METADATA_DRIFT' | 'STATUS_AND_METADATA_DRIFT' | 'RUNTIME_ONLY' | 'BLOCKED';
  differences?: ('STATUS_DRIFT' | 'METADATA_DRIFT')[];
  action: 'NOOP' | 'CREATE' | 'UPDATE_STATUS' | 'UPDATE_METADATA' | 'UPDATE_STATUS_AND_METADATA' | 'BLOCKED' | 'WARN_RUNTIME_ONLY';
  details?: string;
  proposedResult?: string;
}

interface WorkViewProps {
  projectId?: string;
  workItems?: WorkItem[];
  onUpdateWorkItem: (itemId: string, status?: WorkItemStatus, checklistIdx?: number, done?: boolean) => Promise<void>;
  selectedItemId?: string;
  requirements?: Requirement[];
  onDeriveRequirementWork?: (requirementId:string)=>Promise<void>;
}

export const WorkView: React.FC<WorkViewProps> = ({
  projectId,
  workItems = [],
  onUpdateWorkItem,
  selectedItemId,
  requirements = [],
  onDeriveRequirementWork,
}) => {
  const [viewMode, setViewMode] = useState<'BOARD' | 'WBS' | 'BACKLOG' | 'SPRINT' | 'CHECKLIST'>('BOARD');
  const [activeItemId, setActiveItemId] = useState<string | null>(selectedItemId || null);
  const activeItem = workItems.find((w) => w.id === activeItemId) || null;
  const [activeCanonicalItemId, setActiveCanonicalItemId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const pending = useRef(false);
  const [requirementToPlan,setRequirementToPlan]=useState('');

  // Canonical WBS and Reconciliation state (DMK-205)
  const [wbsItems, setWbsItems] = useState<CanonicalWbsItemSummary[]>([]);
  const [wbsSupported, setWbsSupported] = useState(false);
  const [reconSummary, setReconSummary] = useState<ReconciliationSummary | null>(null);
  const [reconRows, setReconRows] = useState<WorkItemSyncRow[]>([]);
  const [reconSupported, setReconSupported] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [loadingRecon, setLoadingRecon] = useState(false);

  const activeCanonicalItem = useMemo(() => {
    return wbsItems.find((item) => item.id === activeCanonicalItemId) || null;
  }, [wbsItems, activeCanonicalItemId]);

  const setActiveItem = (item: WorkItem | null) => {
    setActiveItemId(item?.id || null);
    if (item) setActiveCanonicalItemId(null);
    setUpdateError(null);
  };

  const setActiveCanonicalItem = (item: CanonicalWbsItemSummary | null) => {
    setActiveCanonicalItemId(item?.id || null);
    if (item) setActiveItemId(null);
    setUpdateError(null);
  };

  useEffect(() => {
    if (selectedItemId) {
      setActiveItemId(selectedItemId);
      setActiveCanonicalItemId(null);
    }
  }, [selectedItemId]);

  const [activeSprint, setActiveSprint] = useState<number>(0);

  const fetchSyncData = () => {
    if (projectId === 'PRJ-DOCMONSTAKRAKIN') {
      setLoadingRecon(true);
      Promise.all([
        fetch(`/api/projects/${projectId}/wbs`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
        fetch(`/api/projects/${projectId}/work-items/reconciliation`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ])
        .then(([wbsData, reconData]) => {
          if (wbsData && wbsData.supported) {
            setWbsSupported(true);
            setWbsItems(wbsData.items || []);
          } else {
            setWbsSupported(false);
            setWbsItems([]);
          }

          if (reconData && reconData.supported) {
            setReconSupported(true);
            setReconSummary(reconData.summary || null);
            setReconRows(reconData.rows || []);
          } else {
            setReconSupported(false);
            setReconSummary(null);
            setReconRows([]);
          }
        })
        .finally(() => setLoadingRecon(false));
    }
  };

  // Fetch canonical WBS and reconciliation when project is PRJ-DOCMONSTAKRAKIN
  useEffect(() => {
    if (projectId === 'PRJ-DOCMONSTAKRAKIN') {
      fetchSyncData();
    } else {
      // Clear canonical self-project state when switching to any other project (Section 30)
      setWbsSupported(false);
      setWbsItems([]);
      setReconSupported(false);
      setReconSummary(null);
      setReconRows([]);
      setIsReviewOpen(false);
      setActiveCanonicalItemId(null);
    }
  }, [projectId]);

  const reconciliationById = useMemo(() => {
    return new Map<string, WorkItemSyncRow>(reconRows.map((r) => [r.id, r]));
  }, [reconRows]);

  const activeItemCanonicalStatusOwned = useMemo(() => {
    if (!activeItem) return false;
    if (activeItem.canonicalManaged) return true;
    if (projectId === 'PRJ-DOCMONSTAKRAKIN') {
      const reconRow = reconciliationById.get(activeItem.id);
      if (reconRow && reconRow.category !== 'RUNTIME_ONLY') {
        return true;
      }
    }
    return false;
  }, [activeItem, projectId, reconciliationById]);

  const columns: { id: WorkItemStatus; label: string }[] = [
    { id: 'PROPOSED', label: 'Proposed' },
    { id: 'BACKLOG', label: 'Backlog' },
    { id: 'READY', label: 'Ready for Dev' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'VERIFICATION', label: 'In Verification' },
    { id: 'VERIFIED', label: 'Verified & Approved' },
  ];

  const update = async (itemId: string, status?: WorkItemStatus, idx?: number, done?: boolean) => {
    if (pending.current) return;
    pending.current = true;
    setUpdating(true);
    setUpdateError(null);
    try {
      await onUpdateWorkItem(itemId, status, idx, done);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Work item update failed');
    } finally {
      pending.current = false;
      setUpdating(false);
    }
  };
  const handleStatusChange = (itemId: string, status: WorkItemStatus) => update(itemId, status);
  const handleChecklistToggle = (itemId: string, idx: number, done: boolean) => update(itemId, undefined, idx, !done);

  // Group dynamic canonical WBS items by epic
  const groupedWbs = useMemo(() => {
    if (!wbsSupported || wbsItems.length === 0) return [];
    const groups: { epic: string; title: string; items: CanonicalWbsItemSummary[] }[] = [];
    const groupMap = new Map<string, CanonicalWbsItemSummary[]>();

    for (const item of wbsItems) {
      const epicKey = item.epic || item.parentId || 'UNASSIGNED';
      if (!groupMap.has(epicKey)) {
        groupMap.set(epicKey, []);
      }
      groupMap.get(epicKey)!.push(item);
    }

    // Sort items within each group by wbsPath
    for (const [epic, items] of groupMap.entries()) {
      items.sort((a, b) => a.wbsPath.localeCompare(b.wbsPath, undefined, { numeric: true }));
      groups.push({
        epic,
        title: `${epic} Scope`,
        items,
      });
    }

    return groups;
  }, [wbsSupported, wbsItems]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {updateError && !activeItem && <p role="alert" className="text-sm text-red-700">{updateError}</p>}

      {/* Reconciliation Summary Banner (PRJ-DOCMONSTAKRAKIN) */}
      {reconSupported && reconSummary && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500 font-semibold block">Canonical WBS</span>
              <span className="font-bold text-slate-900">{reconSummary.canonicalItems} operational items</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-500 font-semibold block">Runtime</span>
              <span className="font-bold text-slate-900">{reconSummary.runtimeItems} WorkItems</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-500 font-semibold block">Synchronization</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={reconSummary.missingRuntime > 0 ? 'font-bold text-amber-700' : 'text-slate-600'}>
                  {reconSummary.missingRuntime} missing
                </span>
                <span>•</span>
                <span className={reconSummary.statusDrift > 0 ? 'font-bold text-orange-700' : 'text-slate-600'}>
                  {reconSummary.statusDrift} status drift
                </span>
                <span>•</span>
                <span className={reconSummary.metadataDrift > 0 ? 'font-bold text-blue-700' : 'text-slate-600'}>
                  {reconSummary.metadataDrift} metadata drift
                </span>
                <span>•</span>
                <span className={reconSummary.blocked > 0 ? 'font-bold text-red-700' : 'text-slate-600'}>
                  {reconSummary.blocked} blocked
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={fetchSyncData}
              disabled={loadingRecon}
              title="Refresh reconciliation projection"
              className="p-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRecon ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={() => setIsReviewOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-2xs transition-colors"
            >
              Review Reconciliation
            </button>
          </div>
        </div>
      )}

      {/* Work Header & View Mode Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Canonical Work & Task Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {wbsSupported
              ? 'Canonical WBS authority with governed runtime execution projection.'
              : 'Single WorkItem source of truth powering Kanban, WBS, Product Backlog, and Verification Checklists.'}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setViewMode('BOARD')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              viewMode === 'BOARD' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" /> Board
          </button>
          <button
            onClick={() => setViewMode('WBS')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              viewMode === 'WBS' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> WBS
          </button>
          <button
            onClick={() => setViewMode('BACKLOG')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              viewMode === 'BACKLOG' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" /> Backlog
          </button>
          <button
            onClick={() => setViewMode('SPRINT')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              viewMode === 'SPRINT' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Sprints
          </button>
          <button
            onClick={() => setViewMode('CHECKLIST')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              viewMode === 'CHECKLIST' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" /> Checklists
          </button>
        </div>
      </div>

      {onDeriveRequirementWork && projectId !== 'PRJ-DOCMONSTAKRAKIN' && (
        <form className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end" onSubmit={async(event)=>{
          event.preventDefault();if(pending.current || !requirementToPlan)return;
          pending.current=true;setUpdating(true);setUpdateError(null);
          try {await onDeriveRequirementWork(requirementToPlan);}catch(error){setUpdateError(error instanceof Error?error.message:'Task proposal failed');}
          finally {pending.current=false;setUpdating(false);}
        }}>
          <label className="text-xs font-semibold flex-1">Requirement to plan
            <select aria-label="Requirement to plan" className="block w-full mt-1 rounded border border-slate-300 p-2" value={requirementToPlan} onChange={event=>setRequirementToPlan(event.target.value)} disabled={updating}>
              <option value="">Select a governing requirement</option>
              {requirements.map(requirement=><option key={requirement.id} value={requirement.id}>{requirement.id}: {requirement.title}</option>)}
            </select>
          </label>
          <button type="submit" disabled={!requirementToPlan || updating} className="px-3 py-2 rounded bg-blue-600 text-white text-xs disabled:opacity-50">Propose linked task</button>
          <p className="text-xs text-slate-500 w-full">Creates proposed planning work only. Requirement approval, verification and release remain separate human gates.{requirements.length===0?' Answer discovery questions or add a requirement first.':''}</p>
        </form>
      )}

      {/* 1. Kanban Board View */}
      {viewMode === 'BOARD' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {columns.map((col) => {
            const colItems = workItems.filter((w) => w.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-3 flex flex-col min-h-[480px]"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 px-1">
                  <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">{col.label}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-bold">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colItems.map((item) => {
                    const doneCount = item.checklist.filter((c) => c.done).length;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveItem(item)}
                        className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all cursor-pointer space-y-2.5 group"
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span title={item.id} className="truncate font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {item.id}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              item.risk === 'CRITICAL'
                                ? 'bg-red-100 text-red-700'
                                : item.risk === 'HIGH'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            ● {item.risk}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                          {item.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>Sprint {item.sprint}</span>
                          <span className="font-mono text-[10px]">
                            {doneCount}/{item.checklist.length} gates
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {colItems.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Dynamic WBS Hierarchy View (DMK-205) */}
      {viewMode === 'WBS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6 text-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Work Breakdown Structure (WBS)</h2>
              <p className="text-slate-500">
                {wbsSupported
                  ? 'Authoritative canonical repository hierarchy from MASTER_WBS.yaml.'
                  : 'Hierarchical decomposition of project capabilities and operational tasks.'}
              </p>
            </div>
            {wbsSupported && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Canonical Projection: MASTER_WBS.yaml
              </span>
            )}
          </div>

          <div className="space-y-4">
            {wbsSupported && groupedWbs.length > 0 ? (
              groupedWbs.map((grp) => (
                <div key={grp.epic} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-3 font-bold text-slate-800 flex items-center justify-between border-b border-slate-200">
                    <span>{grp.title}</span>
                    <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded">{grp.epic}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {grp.items.map((item) => {
                      const rItem = workItems.find((w) => w.id === item.id);
                      const inRuntimeSyncScope = item.epic === 'EPIC-13' || item.parentId === 'EPIC-13';
                      const reconRow = reconciliationById.get(item.id);

                      let syncBadge = 'SYNCED';
                      let syncBadgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';

                      if (!inRuntimeSyncScope) {
                        syncBadge = 'CANONICAL ONLY';
                        syncBadgeClass = 'bg-slate-100 text-slate-600 border border-slate-300';
                      } else {
                        const category = reconRow ? reconRow.category : (!rItem ? 'MISSING_RUNTIME' : 'SYNCED');
                        switch (category) {
                          case 'MISSING_RUNTIME':
                            syncBadge = 'MISSING_RUNTIME';
                            syncBadgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                            break;
                          case 'STATUS_DRIFT':
                            syncBadge = 'STATUS_DRIFT';
                            syncBadgeClass = 'bg-orange-50 text-orange-700 border border-orange-200';
                            break;
                          case 'METADATA_DRIFT':
                            syncBadge = 'METADATA_DRIFT';
                            syncBadgeClass = 'bg-blue-50 text-blue-700 border border-blue-200';
                            break;
                          case 'STATUS_AND_METADATA_DRIFT':
                            syncBadge = 'STATUS & METADATA DRIFT';
                            syncBadgeClass = 'bg-purple-50 text-purple-700 border border-purple-200';
                            break;
                          case 'BLOCKED':
                            syncBadge = 'BLOCKED';
                            syncBadgeClass = 'bg-red-50 text-red-700 border border-red-200';
                            break;
                          case 'RUNTIME_ONLY':
                            syncBadge = 'RUNTIME_ONLY';
                            syncBadgeClass = 'bg-slate-100 text-slate-700 border border-slate-300';
                            break;
                          case 'SYNCED':
                          default:
                            syncBadge = 'SYNCED';
                            syncBadgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                            break;
                        }
                      }

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (rItem) {
                              setActiveItem(rItem);
                            } else {
                              setActiveCanonicalItem(item);
                            }
                          }}
                          className="p-3.5 pl-6 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] text-slate-400 w-16">{item.wbsPath}</span>
                            <span className="font-mono font-bold text-blue-700">{item.id}</span>
                            <span className="font-medium text-slate-800">{item.title}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Canonical: {item.status}
                            </span>
                            {rItem && (
                              <span className="font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                Runtime: {rItem.status}
                              </span>
                            )}
                            <span className={`font-bold px-2 py-0.5 rounded ${syncBadgeClass}`}>
                              {syncBadge}
                            </span>
                            <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.type}
                            </span>
                            <span className="font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                              ● {item.risk}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No canonical WBS hierarchy available for this project.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Product Backlog Tabular View */}
      {viewMode === 'BACKLOG' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Epic</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Risk</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {workItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setActiveItem(item)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{item.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{item.title}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{item.parentEpicId || 'EPIC-01'}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">{item.priority}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        item.risk === 'CRITICAL'
                          ? 'bg-red-100 text-red-700'
                          : item.risk === 'HIGH'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      ● {item.risk}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">Sprint {item.sprint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Sprint Plan View */}
      {viewMode === 'SPRINT' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[0, 1, 4, 6].map((s) => (
              <button
                key={s}
                onClick={() => setActiveSprint(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSprint === s
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Sprint {s}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sprint {activeSprint} Plan & Scope</h3>
                <p className="text-xs text-slate-500">Scheduled work items for this milestone delivery batch.</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
                Sequenced Execution
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {workItems
                .filter((w) => w.sprint === activeSprint)
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveItem(item)}
                    className="py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer px-2 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 text-xs">{item.id}</span>
                        <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-slate-400">{item.status}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Implementation Checklist View */}
      {viewMode === 'CHECKLIST' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6 text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Operational Verification Checklist</h3>
            <p className="text-slate-500 mt-0.5">
              Interactive completion gates for active work items. Changes update project activity and evidence logs.
            </p>
          </div>

          <div className="space-y-6">
            {workItems.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-700 text-xs">{item.id}</span>
                    <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded font-semibold text-slate-700">
                    {item.status}
                  </span>
                </div>

                <div className="space-y-1.5 pl-2">
                  {item.checklist.map((c, idx) => (
                    <label key={idx} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.done}
                        disabled={updating}
                        onChange={() => handleChecklistToggle(item.id, idx, c.done)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <span className={c.done ? 'line-through text-slate-400' : ''}>{c.text}</span>
                    </label>
                  ))}
                  {item.checklist.length === 0 && (
                    <span className="text-slate-400 italic">No checklist items defined.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reconciliation Review Modal (DMK-205) */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">Canonical WBS Reconciliation Review</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Read-only comparison of repository MASTER_WBS.yaml vs runtime WorkItems for PRJ-DOCMONSTAKRAKIN.
                </p>
              </div>
              <button
                onClick={() => setIsReviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 font-medium text-slate-700">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Canonical</span>
                  <span className="text-sm font-bold text-slate-900">{reconSummary?.canonicalItems || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Runtime</span>
                  <span className="text-sm font-bold text-slate-900">{reconSummary?.runtimeItems || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Missing</span>
                  <span className="text-sm font-bold text-amber-700">{reconSummary?.missingRuntime || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Status Drift</span>
                  <span className="text-sm font-bold text-orange-700">{reconSummary?.statusDrift || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Meta Drift</span>
                  <span className="text-sm font-bold text-blue-700">{reconSummary?.metadataDrift || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Blocked</span>
                  <span className="text-sm font-bold text-red-700">{reconSummary?.blocked || 0}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">WorkItem ID</th>
                      <th className="py-2.5 px-3">CANONICAL Status</th>
                      <th className="py-2.5 px-3">RUNTIME Status</th>
                      <th className="py-2.5 px-3">Difference Category</th>
                      <th className="py-2.5 px-3">PROPOSED Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {reconRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{row.id}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {row.canonicalStatus || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {row.runtimeStatus || 'MISSING'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              row.category === 'SYNCED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : row.category === 'MISSING_RUNTIME'
                                ? 'bg-amber-50 text-amber-700'
                                : row.category === 'STATUS_DRIFT'
                                ? 'bg-orange-50 text-orange-700'
                                : row.category === 'METADATA_DRIFT'
                                ? 'bg-blue-50 text-blue-700'
                                : row.category === 'STATUS_AND_METADATA_DRIFT'
                                ? 'bg-purple-50 text-purple-700'
                                : row.category === 'BLOCKED'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {row.category}
                          </span>
                          {row.differences && row.differences.length > 0 && (
                            <span className="block text-[9px] text-slate-500 mt-0.5">
                              {row.differences.join(' + ')}
                            </span>
                          )}
                          {row.details && (
                            <span className="block text-[9px] text-slate-400 mt-0.5">
                              {row.details}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-900">
                          {row.proposedResult || 'NOOP'}
                        </td>
                      </tr>
                    ))}
                    {reconRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No items to reconcile.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-[11px] leading-relaxed">
                <strong>Administrative Governance Note:</strong>{' '}
                {reconSummary && reconSummary.blocked > 0 ? (
                  <>
                    Live reconciliation is currently BLOCKED. {reconSummary.blocked === 9 ? 'Nine' : reconSummary.blocked} canonical VERIFIED items lack sufficient completed human governance provenance. No reconciliation plan may be applied while blocked items remain. No direct writes occur from this preview.
                  </>
                ) : (
                  <>
                    Applying reconciliation changes to live runtime state requires explicit plan authorization and administrative execution via CLI (<code>npm run reconcile:self-work -- --apply</code>). No direct writes occur from this preview.
                  </>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setIsReviewOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Work Item Detail Drawer */}
      {activeItem && (
        <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  {activeItem.id}
                </span>
                <span className="text-xs font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded">
                  ● {activeItem.risk} Risk
                </span>
                {activeItemCanonicalStatusOwned && (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                    {activeItem.canonicalManaged ? 'Canonical Managed' : 'Canonical Status Owned'}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{activeItem.title}</h2>
            </div>
            <button
              onClick={() => setActiveItem(null)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            {updateError && <p role="alert" className="text-sm text-red-700">{updateError}</p>}
            {/* Status Control */}
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Update Execution Status:</label>
              <select
                aria-label="Work item status"
                disabled={updating || activeItemCanonicalStatusOwned}
                value={activeItem.status}
                onChange={(e) => handleStatusChange(activeItem.id, e.target.value as WorkItemStatus)}
                className={`w-full p-2.5 rounded-lg border font-semibold ${
                  activeItemCanonicalStatusOwned
                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
              {activeItemCanonicalStatusOwned && (
                <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                  {activeItem.canonicalManaged
                    ? 'Status is owned by the canonical repository WBS. Update canonical WBS through the governed repository workflow, then reconcile runtime.'
                    : 'Status is owned by the canonical repository WBS. Runtime currently differs from canonical state and must be reconciled through the governed synchronization process.'}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Description:</label>
              <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                {activeItem.description}
              </p>
            </div>

            {/* Acceptance Criteria */}
            <div>
              <label className="text-slate-500 font-semibold block mb-1.5">Acceptance Criteria:</label>
              <div className="space-y-1.5">
                {activeItem.acceptanceCriteria.map((ac, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-700 p-2 bg-slate-50 rounded border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{ac}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Checklist */}
            <div>
              <label className="text-slate-500 font-semibold block mb-1.5">Task Checklist Gates:</label>
              <div className="space-y-2">
                {activeItem.checklist.map((c, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-2.5 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      disabled={updating}
                      checked={c.done}
                      onChange={() => handleChecklistToggle(activeItem.id, idx, c.done)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className={`text-xs ${c.done ? 'line-through text-slate-400' : 'font-medium text-slate-800'}`}>
                      {c.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Traceability Metadata */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px]">
              <div>
                <span className="text-slate-400">Linked Requirements:</span>{' '}
                <span className="font-mono font-medium text-emerald-700">{activeItem.requirements.join(', ') || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400">Verification Evidence:</span>{' '}
                <span className="font-mono font-medium text-purple-700">{activeItem.evidence.join(', ') || 'None attached'}</span>
              </div>
              {activeItem.canonicalWbsPath && (
                <div>
                  <span className="text-slate-400">Canonical WBS Path:</span>{' '}
                  <span className="font-mono font-medium text-blue-700">{activeItem.canonicalWbsPath}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Canonical Item Detail Drawer (Read-Only) */}
      {activeCanonicalItem && (
        <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  {activeCanonicalItem.id}
                </span>
                <span className="text-xs font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded">
                  ● {activeCanonicalItem.risk} Risk
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                  Canonical Record
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{activeCanonicalItem.title}</h2>
            </div>
            <button
              onClick={() => setActiveCanonicalItem(null)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            {/* Status & Sync Scope Grid */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block font-semibold">Canonical Status</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px]">{activeCanonicalItem.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Runtime Status</span>
                  <span className="font-mono font-bold text-amber-700 text-[11px]">MISSING</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Sync State</span>
                  <span className="font-mono font-bold text-blue-700 text-[11px]">
                    {activeCanonicalItem.epic === 'EPIC-13' || activeCanonicalItem.parentId === 'EPIC-13'
                      ? 'MISSING_RUNTIME'
                      : 'CANONICAL ONLY'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">WBS Path</span>
                  <span className="font-mono font-bold text-slate-700 text-[11px]">{activeCanonicalItem.wbsPath}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Epic / Phase</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {activeCanonicalItem.epic || 'N/A'} / {activeCanonicalItem.phase || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Type / Priority</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {activeCanonicalItem.type} / {activeCanonicalItem.priority}
                  </span>
                </div>
              </div>
            </div>

            {/* Read-only Governance Banner */}
            <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-xl text-[11px] leading-relaxed">
              <p className="font-semibold mb-0.5">Canonical repository record. Runtime WorkItem has not yet been projected.</p>
              {activeCanonicalItem.epic === 'EPIC-13' || activeCanonicalItem.parentId === 'EPIC-13' ? (
                <p className="text-blue-700">Runtime synchronization is currently governed by reconciliation status.</p>
              ) : (
                <p className="text-blue-700">This canonical WBS item is outside the current EPIC-13 operational runtime synchronization scope.</p>
              )}
            </div>

            {/* Proposed Result if available in reconciliationById */}
            {reconciliationById.get(activeCanonicalItem.id)?.proposedResult && (
              <div>
                <label className="text-slate-500 font-semibold block mb-1">Proposed Result:</label>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs font-semibold text-slate-800">
                  {reconciliationById.get(activeCanonicalItem.id)!.proposedResult}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Description:</label>
              <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                {activeCanonicalItem.description}
              </p>
            </div>

            {/* Acceptance Criteria */}
            <div>
              <label className="text-slate-500 font-semibold block mb-1.5">Acceptance Criteria:</label>
              <div className="space-y-1.5">
                {activeCanonicalItem.acceptanceCriteria && activeCanonicalItem.acceptanceCriteria.length > 0 ? (
                  activeCanonicalItem.acceptanceCriteria.map((ac, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-700 p-2 bg-slate-50 rounded border border-slate-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span>{ac}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic">None specified</p>
                )}
              </div>
            </div>

            {/* Traceability Metadata */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px]">
              <div>
                <span className="text-slate-400">Linked Requirements:</span>{' '}
                <span className="font-mono font-medium text-emerald-700">
                  {activeCanonicalItem.requirements?.join(', ') || 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Dependencies:</span>{' '}
                <span className="font-mono font-medium text-slate-700">
                  {activeCanonicalItem.dependencies?.join(', ') || 'None'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Verification Evidence:</span>{' '}
                <span className="font-mono font-medium text-purple-700">
                  {activeCanonicalItem.evidence?.join(', ') || 'None attached'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
