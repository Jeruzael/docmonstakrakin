import React, { useState, useEffect } from 'react';
import { Search, X, Shield, FileText, CheckSquare, AlertTriangle, BookOpen, ArrowRight } from 'lucide-react';
import { Project, Requirement, WorkItem, Risk, StandardControl } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  requirements: Requirement[];
  workItems: WorkItem[];
  risks: Risk[];
  standards: StandardControl[];
  onNavigate: (view: string, entityId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  project,
  requirements,
  workItems,
  risks,
  standards,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // toggle handled externally
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.toLowerCase().trim();

  const filteredReqs = cleanQuery
    ? requirements.filter(
        (r) =>
          r.id.toLowerCase().includes(cleanQuery) ||
          r.title.toLowerCase().includes(cleanQuery) ||
          r.statement.toLowerCase().includes(cleanQuery)
      )
    : requirements.slice(0, 3);

  const filteredWork = cleanQuery
    ? workItems.filter(
        (w) =>
          w.id.toLowerCase().includes(cleanQuery) ||
          w.title.toLowerCase().includes(cleanQuery) ||
          w.description.toLowerCase().includes(cleanQuery)
      )
    : workItems.slice(0, 3);

  const filteredRisks = cleanQuery
    ? risks.filter(
        (r) =>
          r.id.toLowerCase().includes(cleanQuery) ||
          r.title.toLowerCase().includes(cleanQuery) ||
          r.description.toLowerCase().includes(cleanQuery)
      )
    : risks.slice(0, 2);

  const filteredStandards = cleanQuery
    ? standards.filter(
        (s) =>
          s.id.toLowerCase().includes(cleanQuery) ||
          s.title.toLowerCase().includes(cleanQuery) ||
          s.standardName.toLowerCase().includes(cleanQuery)
      )
    : standards.slice(0, 2);

  const totalResults =
    filteredReqs.length + filteredWork.length + filteredRisks.length + filteredStandards.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-150">
        <div className="flex items-center px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search requirements (REQ-...), tasks (DMK-...), risks, controls..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-slate-900 placeholder-slate-400 text-sm focus:outline-hidden bg-transparent"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs">
          {totalResults === 0 && (
            <div className="py-8 text-center text-slate-500 text-sm">
              No matching entities found for "{query}".
            </div>
          )}

          {filteredReqs.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Requirements ({filteredReqs.length})
              </div>
              <div className="space-y-1 mt-1">
                {filteredReqs.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => {
                      onNavigate('requirements', req.id);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-emerald-50/60 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px]">
                          {req.id}
                        </span>
                        <span className="font-medium text-slate-800 text-sm">{req.title}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{req.statement}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredWork.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                Work Items & Tasks ({filteredWork.length})
              </div>
              <div className="space-y-1 mt-1">
                {filteredWork.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate('work', item.id);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-blue-50/60 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded text-[11px]">
                          {item.id}
                        </span>
                        <span className="font-medium text-slate-800 text-sm">{item.title}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{item.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredRisks.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Risk Register ({filteredRisks.length})
              </div>
              <div className="space-y-1 mt-1">
                {filteredRisks.map((risk) => (
                  <button
                    key={risk.id}
                    onClick={() => {
                      onNavigate('risk', risk.id);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-amber-50/60 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded text-[11px]">
                          {risk.id}
                        </span>
                        <span className="font-medium text-slate-800 text-sm">{risk.title}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-red-100 text-red-700 rounded">
                          {risk.inherentLevel}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{risk.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredStandards.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                Standards & Controls ({filteredStandards.length})
              </div>
              <div className="space-y-1 mt-1">
                {filteredStandards.map((std) => (
                  <button
                    key={std.id}
                    onClick={() => {
                      onNavigate('standards', std.id);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-purple-50/60 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded text-[11px]">
                          {std.id}
                        </span>
                        <span className="font-medium text-slate-800 text-sm">{std.title}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{std.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <div>Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-600">Esc</kbd> to close</div>
          <div>Project: <span className="font-medium text-slate-600">{project.name}</span> (v{project.stateVersion})</div>
        </div>
      </div>
    </div>
  );
};
