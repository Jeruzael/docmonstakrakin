import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  FileCheck2,
  Cpu,
  ShieldAlert,
  BookOpen,
  CheckSquare,
  Bot,
  FileBadge,
  UserCheck,
  FileText,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  Terminal,
  Sparkles,
} from 'lucide-react';

export type NavView =
  | 'overview'
  | 'projects'
  | 'requirements'
  | 'architecture'
  | 'risk'
  | 'work'
  | 'repository'
  | 'agents'
  | 'compiler'
  | 'standards'
  | 'evidence'
  | 'approvals'
  | 'documents'
  | 'settings';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  unresolvedBlockersCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  collapsed,
  onToggleCollapse,
  unresolvedBlockersCount,
}) => {
  const navSections = [
    {
      label: 'PROJECT',
      items: [
        { id: 'overview', label: 'Home', icon: LayoutDashboard },
        { id: 'projects', label: 'Projects', icon: FolderKanban },
        {
          id: 'requirements',
          label: 'Requirements',
          icon: FileCheck2,
          badge: unresolvedBlockersCount > 0 ? unresolvedBlockersCount : undefined,
          badgeColor: 'bg-red-100 text-red-700',
        },
        { id: 'architecture', label: 'Architecture', icon: Cpu },
        { id: 'risk', label: 'Security & Risk', icon: ShieldAlert },
      ],
    },
    {
      label: 'DELIVERY',
      items: [
        { id: 'work', label: 'Work Management', icon: CheckSquare },
        { id: 'repository', label: 'Repository & Git', icon: Terminal },
        { id: 'agents', label: 'Agent Center', icon: Bot },
        { id: 'compiler', label: 'Prompt Compiler', icon: Sparkles },
      ],
    },
    {
      label: 'ASSURANCE',
      items: [
        { id: 'standards', label: 'Standards Registry', icon: BookOpen },
        { id: 'evidence', label: 'Evidence & Audit', icon: FileBadge },
        { id: 'approvals', label: 'Approvals Inbox', icon: UserCheck },
      ],
    },
    {
      label: 'INSIGHT',
      items: [
        { id: 'documents', label: 'Reports & Export', icon: FileText },
      ],
    },
  ];

  return (
    <aside
      className={`h-screen bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 select-none z-40 sticky top-0 ${
        collapsed ? 'w-[72px]' : 'w-[250px]'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="leading-tight truncate">
                <span className="font-bold text-slate-900 text-sm tracking-tight block">docmonstakrakin</span>
                <span className="text-[10px] text-slate-400 font-mono block uppercase tracking-wider">A-SSDLC Plane</span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Shield className="w-4 h-4" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-130px)]">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id as NavView)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    />
                    {!collapsed && (
                      <div className="flex-1 text-left truncate flex items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                              item.badgeColor || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="p-2 border-t border-slate-100 space-y-1 bg-slate-50/50">
        <button
          onClick={() => onSelectView('settings')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Settings & Secrets"
        >
          <Settings className="w-4 h-4 text-slate-500 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>

        {!collapsed && (
          <div className="px-2.5 py-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200/60 pt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="font-mono text-[10px]">v0.1.0-alpha</span>
            </div>
            <span className="text-[10px] text-slate-400">Offline-Ready</span>
          </div>
        )}
      </div>
    </aside>
  );
};
