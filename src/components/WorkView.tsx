import React, { useState } from 'react';
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
} from 'lucide-react';
import { WorkItem, WorkItemStatus, RiskLevel } from '../types';

interface WorkViewProps {
  workItems?: WorkItem[];
  onUpdateWorkItem: (itemId: string, status?: WorkItemStatus, checklistIdx?: number, done?: boolean) => Promise<void>;
  selectedItemId?: string;
}

export const WorkView: React.FC<WorkViewProps> = ({
  workItems = [],
  onUpdateWorkItem,
  selectedItemId,
}) => {
  const [viewMode, setViewMode] = useState<'BOARD' | 'WBS' | 'BACKLOG' | 'SPRINT' | 'CHECKLIST'>('BOARD');
  const [activeItem, setActiveItem] = useState<WorkItem | null>(() => {
    if (selectedItemId) {
      return (workItems || []).find((w) => w.id === selectedItemId) || null;
    }
    return null;
  });

  const [activeSprint, setActiveSprint] = useState<number>(0);

  const columns: { id: WorkItemStatus; label: string }[] = [
    { id: 'PROPOSED', label: 'Proposed' },
    { id: 'BACKLOG', label: 'Backlog' },
    { id: 'READY', label: 'Ready for Dev' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'VERIFICATION', label: 'In Verification' },
    { id: 'VERIFIED', label: 'Verified & Approved' },
  ];

  const handleStatusChange = async (itemId: string, newStatus: WorkItemStatus) => {
    await onUpdateWorkItem(itemId, newStatus);
    if (activeItem && activeItem.id === itemId) {
      setActiveItem({ ...activeItem, status: newStatus });
    }
  };

  const handleChecklistToggle = async (itemId: string, idx: number, currentDone: boolean) => {
    await onUpdateWorkItem(itemId, undefined, idx, !currentDone);
    if (activeItem && activeItem.id === itemId) {
      const updatedChecklist = [...activeItem.checklist];
      updatedChecklist[idx].done = !currentDone;
      setActiveItem({ ...activeItem, checklist: updatedChecklist });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {/* Work Header & View Mode Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Canonical Work & Task Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single WorkItem source of truth powering Kanban, WBS, Product Backlog, and Verification Checklists.
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
            <CheckSquare className="w-3.5 h-3.5" /> Checklist
          </button>
        </div>
      </div>

      {/* 1. Kanban Board View */}
      {viewMode === 'BOARD' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colItems = workItems.filter((w) => w.status === col.id);
            return (
              <div key={col.id} className="bg-slate-50/70 rounded-xl border border-slate-200 p-3 flex flex-col min-w-[240px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="font-bold text-xs text-slate-700">{col.label}</span>
                  <span className="text-[11px] font-mono font-bold bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {colItems.map((item) => {
                    const doneCount = item.checklist.filter((c) => c.done).length;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveItem(item)}
                        className="p-3.5 bg-white rounded-lg border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                            {item.id}
                          </span>
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

      {/* 2. WBS Hierarchy View */}
      {viewMode === 'WBS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Work Breakdown Structure (WBS)</h2>
            <p className="text-slate-500">Hierarchical decomposition of project capabilities and atomic tasks.</p>
          </div>

          <div className="space-y-4">
            {[
              { epic: 'EPIC-01', title: '1.0 Foundation & Engineering Baseline', tasks: ['DMK-001', 'DMK-002'] },
              { epic: 'EPIC-02', title: '2.0 Canonical Project Core', tasks: ['DMK-010', 'DMK-017'] },
              { epic: 'EPIC-04', title: '4.0 A-SSDLC Lifecycle, Risk & Governance', tasks: ['DMK-035', 'DMK-042'] },
              { epic: 'EPIC-06', title: '6.0 Prompt Compiler & Structured Validation', tasks: ['DMK-065'] },
            ].map((grp) => (
              <div key={grp.epic} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3 font-bold text-slate-800 flex items-center justify-between border-b border-slate-200">
                  <span>{grp.title}</span>
                  <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded">{grp.epic}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {grp.tasks.map((tId) => {
                    const task = workItems.find((w) => w.id === tId);
                    if (!task) return null;
                    return (
                      <div
                        key={task.id}
                        onClick={() => setActiveItem(task)}
                        className="p-3.5 pl-8 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-blue-700">{task.id}</span>
                          <span className="font-medium text-slate-800">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {task.status}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                            {task.risk}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    Sprint {item.sprint} · {item.status}
                  </span>
                </div>

                <div className="space-y-2 pl-2">
                  {item.checklist.map((c, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={c.done}
                        onChange={() => handleChecklistToggle(item.id, idx, c.done)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className={`text-xs ${c.done ? 'line-through text-slate-400' : 'font-medium'}`}>
                        {c.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
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
            {/* Status Control */}
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Update Execution Status:</label>
              <select
                value={activeItem.status}
                onChange={(e) => handleStatusChange(activeItem.id, e.target.value as WorkItemStatus)}
                className="w-full p-2.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
