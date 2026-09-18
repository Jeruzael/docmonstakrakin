import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  Layers,
  CheckCircle2,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  Shield,
  Tag,
} from 'lucide-react';
import { Feature } from '../types.js';

interface FeaturesViewProps {
  features: Feature[];
  onAddFeature: (feat: Partial<Feature>) => Promise<void>;
  onSelectFeature?: (feat: Feature) => void;
}

export const FeaturesView: React.FC<FeaturesViewProps> = ({
  features = [],
  onAddFeature,
  onSelectFeature,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [capability, setCapability] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P1');
  const [personas, setPersonas] = useState('');

  const filteredFeatures = features.filter((f) => {
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && f.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.id.toLowerCase().includes(q) ||
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.capability.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !capability.trim()) return;

    await onAddFeature({
      title: title.trim(),
      capability: capability.trim(),
      description: description.trim(),
      priority,
      status: 'PROPOSED',
      source: 'MANUAL_ENTRY',
      personas: personas
        ? personas.split(',').map((p) => p.trim()).filter(Boolean)
        : ['Target Users'],
      requirements: [],
      dependencies: [],
    });

    setTitle('');
    setCapability('');
    setDescription('');
    setPersonas('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Workspace Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Sparkles className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Product Features & Capabilities
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registered product capabilities derived from discovery questions, product baselines, and engineering inputs.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Register Feature
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search features by ID, title, capability..."
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
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFeatures.map((feat) => (
          <div
            key={feat.id}
            onClick={() => onSelectFeature?.(feat)}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between cursor-pointer group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {feat.id}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {feat.capability}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      feat.priority === 'P0'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : feat.priority === 'P1'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {feat.priority}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      feat.status === 'APPROVED' || feat.status === 'ACCEPTED' || feat.status === 'VERIFIED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : feat.status === 'PROPOSED'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {feat.status}
                  </span>
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-800 transition-colors">
                {feat.title}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {feat.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  {feat.personas?.join(', ') || 'All Users'}
                </span>
                {feat.requirements?.length > 0 && (
                  <span className="flex items-center gap-1 font-mono text-emerald-700">
                    <Layers className="w-3 h-3" />
                    {feat.requirements.length} linked reqs
                  </span>
                )}
              </div>
              <span className="text-slate-400">{feat.source}</span>
            </div>
          </div>
        ))}

        {filteredFeatures.length === 0 && (
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No features match the active search and filter criteria. Register initial features using the button above or answer discovery questions to auto-derive them.
          </div>
        )}
      </div>

      {/* Add Feature Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Register New Product Feature</h2>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Feature Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scoped Tool Execution Sandbox"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Capability Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tool Execution, Authentication, Analytics"
                  value={capability}
                  onChange={(e) => setCapability(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description & Purpose</label>
                <textarea
                  rows={3}
                  placeholder="Detailed functional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="P0">P0 - Critical</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Medium</option>
                    <option value="P3">P3 - Low</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Personas (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Developers, Admins"
                    value={personas}
                    onChange={(e) => setPersonas(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Register Feature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
