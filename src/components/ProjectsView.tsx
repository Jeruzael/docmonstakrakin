import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  ArrowRight,
  Search,
  Plus,
  ShieldAlert,
  Layers,
  Cpu,
  FileCheck2,
  Activity,
  Package,
  Clock,
  User,
  GitBranch,
  X,
  Calendar,
  AlertTriangle,
  SlidersHorizontal,
  Check,
  Tag,
  Shield,
  Database,
  KeyRound,
  HardDrive,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { Project, ASSDLCPhase, RiskLevel, TechChoice } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  currentProject: Project;
  onSelectProject: (id: string) => void;
  onOpenCreateWizard: () => void;
  onOpenPackageModal?: () => void;
  onNavigateToView?: (view: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  currentProject,
  onSelectProject,
  onOpenCreateWizard,
  onOpenPackageModal,
  onNavigateToView,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [maturityFilter, setMaturityFilter] = useState<string>('ALL');
  const [inspectedProjectId, setInspectedProjectId] = useState<string | null>(null);
  const [inspectedTab, setInspectedTab] = useState<'overview' | 'technical' | 'assurance' | 'product'>('overview');
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  // Active project identification
  const inspectedProject = useMemo(() => {
    if (!inspectedProjectId) return null;
    return projects.find((p) => p.id === inspectedProjectId) || null;
  }, [projects, inspectedProjectId]);

  // Filtering
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (phaseFilter !== 'ALL' && p.lifecyclePhase !== phaseFilter) return false;
      if (maturityFilter !== 'ALL' && p.maturity !== maturityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesOwner = p.owner?.toLowerCase().includes(q);
        const matchesProfile = p.profiles.some((prof) => prof.toLowerCase().includes(q));
        if (!matchesName && !matchesId && !matchesDesc && !matchesOwner && !matchesProfile) {
          return false;
        }
      }
      return true;
    });
  }, [projects, phaseFilter, maturityFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = projects.length;
    const greenfield = projects.filter((p) => p.maturity === 'GREENFIELD').length;
    const highRisk = projects.filter((p) => p.computedRisk?.level === 'HIGH' || p.computedRisk?.level === 'CRITICAL').length;
    const avgHealth = total > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.healthScore || 0), 0) / total) : 0;
    return { total, greenfield, highRisk, avgHealth };
  }, [projects]);

  const handleSwitch = (id: string, name: string) => {
    onSelectProject(id);
    setSwitchFeedback(`Switched active workspace to "${name}"`);
    setTimeout(() => {
      setSwitchFeedback(null);
    }, 3000);
  };

  const getRiskBadgeColor = (level?: RiskLevel) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getPhaseBadgeColor = (phase: ASSDLCPhase) => {
    switch (phase) {
      case 'DISCOVERY':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'REQUIREMENTS':
      case 'REQUIREMENTS_REVIEW':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ARCHITECTURE':
      case 'ARCHITECTURE_REVIEW':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'VERIFICATION':
      case 'SECURITY_REVIEW':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'RELEASE_APPROVAL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DEPLOYMENT':
      case 'OPERATIONS':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="projects-workspace-view" className="space-y-6 pb-12">
      {/* Top Header & Context Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FolderKanban className="w-5 h-5 text-emerald-600" />
              <h1 className="text-lg md:text-xl font-bold text-slate-900">
                Projects Workspace
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Multi-project governance and execution plane. Inspect architectural baselines, monitor assurance posture, and reliably switch active workspace context.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenPackageModal && (
              <button
                id="projects-import-package-btn"
                onClick={onOpenPackageModal}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span>Import Package</span>
              </button>
            )}
            <button
              id="projects-create-new-btn"
              onClick={onOpenCreateWizard}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {switchFeedback && (
          <div
            id="projects-switch-alert"
            className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800 animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{switchFeedback}</span>
            </div>
            {onNavigateToView && (
              <button
                onClick={() => onNavigateToView('overview')}
                className="font-semibold underline hover:text-emerald-900 ml-2"
              >
                Go to Dashboard &rarr;
              </button>
            )}
          </div>
        )}

        {/* Active Project Callout Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/80">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Current Active Workspace:
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {currentProject.name}
                </span>
                <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                  {currentProject.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate max-w-md sm:max-w-xl">
                {currentProject.description || 'No description provided'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="active-project-inspect-btn"
              onClick={() => setInspectedProjectId(currentProject.id)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              Inspect Active Baseline
            </button>
            {onNavigateToView && (
              <button
                id="active-project-dashboard-btn"
                onClick={() => onNavigateToView('overview')}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-200 rounded-md hover:bg-emerald-200/70 transition-colors flex items-center gap-1"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Projects</span>
            <FolderKanban className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Isolated workspace units</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Greenfield Projects</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.greenfield}</div>
          <div className="text-[11px] text-slate-400 mt-1">Full lifecycle generation</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">High / Critical Risk</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.highRisk}</div>
          <div className="text-[11px] text-slate-400 mt-1">Assurance governance active</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Health Score</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.avgHealth}%</div>
          <div className="text-[11px] text-slate-400 mt-1">Portfolio readiness average</div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="projects-search-input"
            type="text"
            placeholder="Search projects by name, ID, profile, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Phase:</span>
          </div>
          <select
            id="projects-phase-filter"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Phases</option>
            <option value="DISCOVERY">Discovery</option>
            <option value="REQUIREMENTS">Requirements</option>
            <option value="ARCHITECTURE">Architecture</option>
            <option value="PLANNING">Planning</option>
            <option value="IMPLEMENTATION">Implementation</option>
            <option value="VERIFICATION">Verification</option>
            <option value="PRODUCTION">Production / Operations</option>
          </select>

          <select
            id="projects-maturity-filter"
            value={maturityFilter}
            onChange={(e) => setMaturityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Maturities</option>
            <option value="GREENFIELD">Greenfield</option>
            <option value="EXISTING_PROJECT">Existing Project</option>
            <option value="MIGRATION">Migration</option>
            <option value="EXTENSION">Extension</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div
          id="projects-empty-state"
          className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-3"
        >
          <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No projects matched your search criteria. Try adjusting filters or initialize a new project.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setPhaseFilter('ALL');
                setMaturityFilter('ALL');
              }}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div id="projects-list-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((p) => {
            const isActive = p.id === currentProject.id;
            return (
              <div
                key={p.id}
                id={`project-card-${p.id}`}
                className={`bg-white rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                  isActive
                    ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                }`}
              >
                {/* Project Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {p.name}
                        </h2>
                        {isActive && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            ACTIVE
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 rounded">
                          v{p.stateVersion}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block truncate">
                        {p.id}
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getPhaseBadgeColor(
                          p.lifecyclePhase
                        )}`}
                      >
                        {p.lifecyclePhase}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                    {p.description || 'No description recorded for this project baseline.'}
                  </p>

                  {/* Profile Tags */}
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {p.profiles.slice(0, 3).map((prof) => (
                      <span
                        key={prof}
                        className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded"
                      >
                        {prof}
                      </span>
                    ))}
                    {p.profiles.length > 3 && (
                      <span className="px-1 py-0.5 text-[10px] text-slate-400">
                        +{p.profiles.length - 3} more
                      </span>
                    )}
                    {p.maturity && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded border border-blue-100">
                        {p.maturity}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress & Assurance Metrics Strip */}
                <div className="px-4 sm:px-5 py-3 bg-slate-50/50 border-b border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Health
                    </span>
                    <span className="font-bold text-slate-800">{p.healthScore || 0}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Risk Level
                    </span>
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getRiskBadgeColor(
                        p.computedRisk?.level
                      )}`}
                    >
                      {p.computedRisk?.level || 'LOW'} ({p.computedRisk?.score || 0})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Method
                    </span>
                    <span className="font-medium text-slate-700 truncate block">
                      {p.deliveryMethod || 'ITERATIVE'}
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 sm:px-5 sm:py-3.5 bg-white flex items-center justify-between gap-2">
                  <button
                    id={`project-inspect-btn-${p.id}`}
                    onClick={() => setInspectedProjectId(p.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <span>Inspect Baseline</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <button
                        id={`project-active-badge-${p.id}`}
                        disabled
                        className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1.5 cursor-default"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Active Workspace</span>
                      </button>
                    ) : (
                      <button
                        id={`project-switch-btn-${p.id}`}
                        onClick={() => handleSwitch(p.id, p.name)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>Switch Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Deep Inspection Drawer */}
      {inspectedProject && (
        <div
          id="project-inspection-modal"
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 md:p-6 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono px-2 py-0.5 bg-slate-200/80 rounded text-slate-700">
                      {inspectedProject.id}
                    </span>
                    {inspectedProject.id === currentProject.id && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ACTIVE WORKSPACE
                      </span>
                    )}
                    <span className="text-xs font-mono text-slate-500">
                      v{inspectedProject.stateVersion}
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-900">
                    {inspectedProject.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg">
                    {inspectedProject.description}
                  </p>
                </div>

                <button
                  id="project-inspector-close-btn"
                  onClick={() => setInspectedProjectId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                  aria-label="Close project inspection"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Inspector Sub-tabs */}
              <div className="flex items-center gap-1 mt-5 border-b border-slate-200 -mb-5 pb-px">
                <button
                  onClick={() => setInspectedTab('overview')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    inspectedTab === 'overview'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Overview & Lifecycle
                </button>
                <button
                  onClick={() => setInspectedTab('technical')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    inspectedTab === 'technical'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Technical Baseline
                </button>
                <button
                  onClick={() => setInspectedTab('assurance')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    inspectedTab === 'assurance'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Assurance & Risk
                </button>
                <button
                  onClick={() => setInspectedTab('product')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    inspectedTab === 'product'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Product Baseline
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-6">
              {inspectedTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                        Lifecycle Phase
                      </span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                        {inspectedProject.lifecyclePhase}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                        Maturity Model
                      </span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                        {inspectedProject.maturity || 'GREENFIELD'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                        Delivery Method
                      </span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                        {inspectedProject.deliveryMethod}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                        Data Sensitivity
                      </span>
                      <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                        {inspectedProject.dataSensitivity || 'INTERNAL'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Governance & Ownership
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>
                        <span className="text-slate-400">Owner:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {inspectedProject.owner || 'Local Operator'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Target Release:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {inspectedProject.targetRelease || 'v0.1'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Created:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {new Date(inspectedProject.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Updated:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {new Date(inspectedProject.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                      Repository & Deployment Intent
                    </h4>
                    <div className="text-slate-600 space-y-1">
                      <div>
                        <span className="text-slate-400">Workspace Repo Path:</span>{' '}
                        <span className="font-mono text-slate-800 bg-slate-50 px-1 py-0.5 rounded">
                          {inspectedProject.repoPath || '/workspace/project'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Deployment Intent:</span>{' '}
                        <span className="text-slate-800">
                          {inspectedProject.deploymentIntent || 'Local Development'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Readiness Progress Breakdown */}
                  {inspectedProject.progress && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                        Lifecycle Readiness Progress
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(inspectedProject.progress).map(([key, val]) => {
                          const numericVal = typeof val === 'number' ? val : Number(val) || 0;
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1')}
                                </span>
                                <span className="font-bold text-slate-800">{numericVal}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(0, numericVal))}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {inspectedTab === 'technical' && (
                <div className="space-y-4 text-xs">
                  <p className="text-slate-500 leading-relaxed">
                    Canonical technical baseline selections and ratification statuses. Unresolved choices prevent automated promotion across gates.
                  </p>

                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                    {inspectedProject.technicalBaseline ? (
                      Object.entries(inspectedProject.technicalBaseline).map(([domain, rawChoice]) => {
                        const choice = rawChoice as TechChoice;
                        const selection = choice.finalSelection || choice.final_selection || choice.userValue || choice.value || 'Not selected';
                        const status = choice.status || (selection !== 'Not selected' ? 'PROPOSED' : 'UNRESOLVED');
                        return (
                          <div key={domain} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                            <div>
                              <span className="font-bold text-slate-800 capitalize block">
                                {domain.replace(/([A-Z])/g, ' $1')}
                              </span>
                              <span className="text-slate-600 font-mono text-[11px]">
                                {selection}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
                                status === 'RATIFIED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : status === 'PROPOSED' || status === 'ACCEPTED'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-slate-400 italic text-center">
                        No technical baseline data available.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {inspectedTab === 'assurance' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">
                      Assurance Posture & Calculated Exposure
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-900">
                        Risk Score: {inspectedProject.computedRisk?.score || 0}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRiskBadgeColor(
                          inspectedProject.computedRisk?.level
                        )}`}
                      >
                        {inspectedProject.computedRisk?.level || 'LOW'}
                      </span>
                    </div>
                  </div>

                  {/* Assurance Inputs List */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
                    <h4 className="font-bold text-slate-800 text-xs">Security & Regulatory Inputs</h4>
                    <div className="space-y-2">
                      {inspectedProject.assuranceInputs ? (
                        <>
                          <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-600">Public Internet Exposure</span>
                            <span className={`font-semibold ${inspectedProject.assuranceInputs.publicInternetExposure ? 'text-amber-600' : 'text-slate-700'}`}>
                              {inspectedProject.assuranceInputs.publicInternetExposure ? 'YES' : 'NO'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-600">Personal Identifiable Information (PII)</span>
                            <span className={`font-semibold ${inspectedProject.assuranceInputs.pii ? 'text-amber-600' : 'text-slate-700'}`}>
                              {inspectedProject.assuranceInputs.pii ? 'YES' : 'NO'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-600">Regulated Financial / Health Data</span>
                            <span className={`font-semibold ${inspectedProject.assuranceInputs.regulatedData ? 'text-amber-600' : 'text-slate-700'}`}>
                              {inspectedProject.assuranceInputs.regulatedData ? 'YES' : 'NO'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-600">Destructive / Financial Operations</span>
                            <span className={`font-semibold ${inspectedProject.assuranceInputs.destructiveOperations ? 'text-amber-600' : 'text-slate-700'}`}>
                              {inspectedProject.assuranceInputs.destructiveOperations ? 'YES' : 'NO'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-600">Autonomous Agent Execution</span>
                            <span className={`font-semibold ${inspectedProject.assuranceInputs.autonomousAgentExecution ? 'text-amber-600' : 'text-slate-700'}`}>
                              {inspectedProject.assuranceInputs.autonomousAgentExecution ? 'YES' : 'NO'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-400 italic">No explicit assurance inputs specified.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {inspectedTab === 'product' && (
                <div className="space-y-4 text-xs">
                  {inspectedProject.productBaseline ? (
                    <>
                      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                        <h4 className="font-bold text-slate-800 text-xs">Problem Statement</h4>
                        <p className="text-slate-600 leading-relaxed">
                          {inspectedProject.productBaseline.problemStatement || 'None documented.'}
                        </p>
                      </div>

                      {inspectedProject.productBaseline.coreFeatures?.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                          <h4 className="font-bold text-slate-800 text-xs">Core Features</h4>
                          <ul className="list-disc list-inside text-slate-600 space-y-1">
                            {inspectedProject.productBaseline.coreFeatures.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {inspectedProject.productBaseline.nonGoals?.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                          <h4 className="font-bold text-slate-800 text-xs">Explicit Non-Goals</h4>
                          <ul className="list-disc list-inside text-slate-600 space-y-1">
                            {inspectedProject.productBaseline.nonGoals.map((ng, i) => (
                              <li key={i}>{ng}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-lg text-slate-400 italic text-center">
                      No product baseline defined yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 md:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setInspectedProjectId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {inspectedProject.id === currentProject.id ? (
                  <button
                    disabled
                    className="px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-lg flex items-center gap-1.5 cursor-default"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Currently Active
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleSwitch(inspectedProject.id, inspectedProject.name);
                      setInspectedProjectId(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Set Active Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
