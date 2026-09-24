import React from 'react';
import {
  ChevronDown,
  Search,
  Bell,
  Plus,
  Server,
  FolderOpen,
  CheckCircle2,
  Package,
  Upload,
} from 'lucide-react';
import { Project } from '../types';

interface TopBarProps {
  currentProject?: Project | null;
  projects: Project[];
  onSelectProject: (id: string) => void;
  onOpenCreateWizard: () => void;
  onOpenSearch: () => void;
  onOpenPackageModal?: () => void;
  onImportPackage?: () => void;
  selectionStatus?: string;
  searchDisabled?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentProject,
  projects,
  onSelectProject,
  onOpenCreateWizard,
  onOpenSearch,
  onOpenPackageModal,
  onImportPackage,
  selectionStatus,
  searchDisabled=false,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Project Selector & + New Button */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-slate-800 text-xs md:text-sm font-semibold group shadow-2xs"
            aria-label="Select project"
          >
            <span className={`w-2 h-2 rounded-full ${currentProject ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
            <span className="max-w-[150px] sm:max-w-[200px] md:max-w-[240px] truncate">
              {currentProject ? currentProject.name : 'No Active Projects'}
            </span>
            {currentProject && (
              <span className="text-[11px] font-mono text-slate-400 font-normal hidden sm:inline">
                v{currentProject.stateVersion}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
          </button>
          {selectionStatus && <span role="status" className="text-[10px] text-slate-500 block mt-0.5">{selectionStatus}</span>}

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              ></div>
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in duration-100 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Projects
                </div>
                {projects.length === 0 ? (
                  <div className="px-3 py-3 text-slate-400 text-center italic">
                    No projects yet
                  </div>
                ) : (
                  projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProject(p.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        currentProject && p.id === currentProject.id
                          ? 'bg-emerald-50/70 text-emerald-800 font-medium'
                          : 'text-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.profiles.join(', ')}</div>
                      </div>
                      {currentProject && p.id === currentProject.id && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-2" />
                      )}
                    </button>
                  ))
                )}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenCreateWizard();
                    }}
                    className="w-full text-left px-3 py-2 text-emerald-700 hover:bg-emerald-50/80 font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create New Project
                  </button>
                  {onOpenPackageModal && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenPackageModal();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1.5 border-t border-slate-100"
                    >
                      <Package className="w-3.5 h-3.5 text-slate-500" />
                      Portable Package (.docmonstakrakin)
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Prominent + New Button */}
        <button
          id="topbar-new-project-btn"
          onClick={onOpenCreateWizard}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-colors"
          title="Create a new project"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-600" />
          <span>New</span>
        </button>

        {/* Portable Package Button */}
        {onImportPackage && <button onClick={onImportPackage} aria-label="Import package" title="Import a project package" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs"><Upload className="w-3.5 h-3.5 text-emerald-600"/><span className="hidden sm:inline">Import</span></button>}
        {onOpenPackageModal && (
          <button
            id="topbar-package-btn"
            onClick={onOpenPackageModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-colors"
            title="Portable .docmonstakrakin Package (Export/Import)"
          >
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Package</span>
          </button>
        )}
      </div>

      {/* Middle: Global Search */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          disabled={searchDisabled}
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-xs text-slate-400 transition-all shadow-2xs group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            <span className="text-slate-500">Search requirements, tasks, risks...</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-400 group-hover:text-slate-600">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Mode & User Info */}
      <div className="flex items-center gap-3">
        <button
          disabled={searchDisabled}
          onClick={onOpenSearch}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Local Status */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Local</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"
            title="System alerts & pending gates"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500"></span>
          </button>
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-semibold text-xs border border-emerald-200">
            JD
          </div>
          <span className="text-xs font-medium text-slate-700 hidden sm:inline">Gio</span>
        </div>
      </div>
    </header>
  );
};
