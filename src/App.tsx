import { ReviewerSession } from './components/ReviewerSession';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, NavView } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { ProjectWizard } from './components/ProjectWizard';
import { QuestionnaireView } from './components/QuestionnaireView';
import { RequirementsView } from './components/RequirementsView';
import { RiskWorkspaceView } from './components/RiskWorkspaceView';
import { WorkView } from './components/WorkView';
import { StandardsView } from './components/StandardsView';
import { EvidenceView } from './components/EvidenceView';
import { PromptCompilerView } from './components/PromptCompilerView';
import { DocumentsView } from './components/DocumentsView';
import { ArchitectureView } from './components/ArchitectureView';
import { RepositoryView } from './components/RepositoryView';
import { ApprovalsView } from './components/ApprovalsView';
import { AgentCenterView } from './components/AgentCenterView';
import { FeaturesView } from './components/FeaturesView';
import { ProjectsView } from './components/ProjectsView';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { OverrideModal } from './components/OverrideModal';
import { PackageTransferModal } from './components/PackageTransferModal';
import { FolderPlus, Plus } from 'lucide-react';

import {
  Project,
  Question,
  Requirement,
  Risk,
  Threat,
  StandardControl,
  WorkItem,
  Evidence,
  AuditEvent,
  RecommendedNextAction,
  WorkItemStatus,
  ADR,
  ADRStatus,
  ArchitectureComponent,
  ApprovalItem,
  Feature,
  RequirementStatus,
} from './types';

import {
  INITIAL_PROJECTS,
  INITIAL_QUESTIONS,
  INITIAL_REQUIREMENTS,
  INITIAL_RISKS,
  INITIAL_THREATS,
  INITIAL_STANDARDS,
  INITIAL_WORK_ITEMS,
  INITIAL_EVIDENCE,
  INITIAL_AUDIT_EVENTS,
  INITIAL_NEXT_ACTION,
  INITIAL_ADRS,
  INITIAL_COMPONENTS,
  INITIAL_APPROVALS,
} from './data/initialData';

export default function App() {
  // Navigation & Shell State
  const [currentView, setCurrentView] = useState<NavView>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('drawer') === 'new-project' || params.get('dialog') === 'new-project';
    }
    return false;
  });
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState<boolean>(false);
  const [overrideGate, setOverrideGate] = useState<string | null>(null);

  // Selected sub-items for deep linking from dashboard or search
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);
  const [selectedReqId, setSelectedReqId] = useState<string | undefined>(undefined);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | undefined>(undefined);

  // Projects State
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>('PRJ-ATLAS-01');

  // Synchronize URL search params with drawer state
  const handleOpenCreateWizard = () => {
    setIsWizardOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('drawer', 'new-project');
      window.history.pushState({ drawer: 'new-project' }, '', url.toString());
    } catch (_) {}
  };

  const handleCloseCreateWizard = () => {
    setIsWizardOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('drawer') || url.searchParams.has('dialog')) {
        url.searchParams.delete('drawer');
        url.searchParams.delete('dialog');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (_) {}
    document.getElementById('topbar-new-project-btn')?.focus();
  };

  // Browser back / forward buttons close or open the drawer accordingly
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const hasDrawer = params.get('drawer') === 'new-project' || params.get('dialog') === 'new-project';
      setIsWizardOpen(hasDrawer);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Active Project Data
  const [currentProject, setCurrentProject] = useState<Project>(INITIAL_PROJECTS[0]);
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [requirements, setRequirements] = useState<Requirement[]>(INITIAL_REQUIREMENTS);
  const [risks, setRisks] = useState<Risk[]>(INITIAL_RISKS);
  const [threats, setThreats] = useState<Threat[]>(INITIAL_THREATS);
  const [standards, setStandards] = useState<StandardControl[]>(INITIAL_STANDARDS);
  const [workItems, setWorkItems] = useState<WorkItem[]>(INITIAL_WORK_ITEMS);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>(INITIAL_EVIDENCE);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(INITIAL_AUDIT_EVENTS);
  const [nextAction, setNextAction] = useState<RecommendedNextAction>(INITIAL_NEXT_ACTION);
  const [adrs, setAdrs] = useState<ADR[]>(INITIAL_ADRS);
  const [components, setComponents] = useState<ArchitectureComponent[]>(INITIAL_COMPONENTS);
  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [requirementsSubTab, setRequirementsSubTab] = useState<'canonical' | 'features' | 'discovery'>('canonical');

  // Fetch projects list
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.warn('Backend unavailable, using initial projects state', err);
    }
  }, []);

  const loadSequence = useRef(0);
  const [loadError,setLoadError] = useState('');
  // Fetch full project payload
  const fetchProjectData = useCallback(async (projectId: string) => {
    const sequence = ++loadSequence.current;
    setLoadError('');
    try {
      const paths = ['', '/questions','/requirements','/risks','/work-items','/evidence','/audit','/next-action','/adrs','/components','/approvals','/features','/standards','/threats'];
      const data = await Promise.all(paths.map(async path => { const r=await fetch('/api/projects/'+projectId+path); if(!r.ok) throw new Error('Cannot load project '+path); return r.json(); }));
      if(sequence !== loadSequence.current) return;
      const [p,q,r,rk,w,ev,aud,na,adr,comp,apv,feat,std,threat] = data;
      setCurrentProject(p);setQuestions(q);setRequirements(r);setRisks(rk);setWorkItems(w);setEvidenceList(ev);setAuditLogs(aud);setNextAction(na);setAdrs(adr);setComponents(comp);setApprovals(apv);setFeatures(feat);setStandards(std);setThreats(threat);
    } catch(e) {if(sequence===loadSequence.current) setLoadError((e as Error).message);}
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchProjectData(activeProjectId);
  }, [activeProjectId, fetchProjectData]);

  // Keyboard shortcut Ctrl+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const handleSelectProject = (id: string) => {
    loadSequence.current++;
    setSelectedReqId(undefined);
    setSelectedQuestionId(undefined);
    setSelectedWorkItemId(undefined);
    const target = projects.find((p) => p.id === id);
    if (target) {
      setCurrentProject(target);
    }
    setActiveProjectId(id);
  };

  const handleCreateProject = async (newProjDraft: any) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjDraft),
      });
      if (res.ok) {
        const created: Project = await res.json();
        setProjects((prev) => [created, ...prev]);
        setActiveProjectId(created.id);
        setCurrentView('overview');
        handleCloseCreateWizard();
        await fetchProjectData(created.id);
        return created;
      } else {
        throw new Error('Server returned non-ok status');
      }
    } catch (err) {
      throw new Error('Project creation failed. Your wizard draft is retained; retry when the server is available.');
    }
  };

  const handleAnswerQuestion = async (
    questionId: string,
    answer: any,
    state?: any,
    justification?: string
  ) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer, state, justification }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error?.message || error.error || 'Answer rejected'); }
      if (res.ok) {
        // Refresh project data to sync readiness and requirements
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      throw err;
    }
  };

  const handleAddRequirement = async (reqData: Partial<Requirement>) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData),
      });
      if (res.ok) {
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to add requirement:', err);
    }
  };

  const handleUpdateRequirementStatus = async (
    reqId: string,
    status: RequirementStatus,
    justification?: string
  ) => {
    const res = await fetch(
      `/api/projects/${currentProject.id}/requirements/${reqId}/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          justification,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error?.message ||
        data.error ||
        'Requirement status update failed'
      );
    }

    await fetchProjectData(currentProject.id);

    return data.requirement;
  };

  const handleAddFeature = async (featData: Partial<Feature>) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featData),
      });
      if (res.ok) {
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to add feature:', err);
    }
  };

  const handleUpdateWorkItem = async (
    itemId: string,
    status?: WorkItemStatus,
    checklistIdx?: number,
    done?: boolean
  ) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/work-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, status, checklistIndex: checklistIdx, checklistDone: done }),
      });
      if (res.ok) {
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to update work item:', err);
    }
  };

  const handleAddADR = async (adrData: Partial<ADR>) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/adrs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adrData),
      });
      if (res.ok) {
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to create ADR:', err);
    }
  };

  const handleUpdateADRStatus = async (adrId: string, status: ADRStatus) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/adrs/${adrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to update ADR status:', err);
    }
  };

  const handleAddComponent = async (compData: Partial<ArchitectureComponent>) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compData),
      });
      if (res.ok) {
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to register component:', err);
    }
  };

  const handleCreateOverride = async (overrideData: any) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrideData),
      });
      if (res.ok) {
        await fetchProjectData(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to record gate override:', err);
    }
  };

  const handleGlobalSearchNavigate = (view: NavView, itemId?: string) => {
    setCurrentView(view);
    if (view === 'requirements') {
      setSelectedReqId(itemId);
    } else if (view === 'work') {
      setSelectedWorkItemId(itemId);
    }
  };

  const unresolvedBlockersCount = questions.filter(
    (q) => q.importance === 'BLOCKING' && q.state === 'UNRESOLVED'
  ).length;

  return (
    <div className="flex h-screen bg-[#FBFBFC] text-slate-900 overflow-hidden font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Collapsible Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => {
          setSelectedQuestionId(undefined);
          setSelectedReqId(undefined);
          setSelectedWorkItemId(undefined);
          setCurrentView(view);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        unresolvedBlockersCount={unresolvedBlockersCount}
      />

      {/* Main Control Plane Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Control Bar */}
        <TopBar
          currentProject={currentProject}
          projects={projects}
          onSelectProject={handleSelectProject}
          onOpenCreateWizard={handleOpenCreateWizard}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenPackageModal={() => setIsPackageModalOpen(true)}
        />

        <ReviewerSession />
        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {loadError && <p role="alert" className="text-red-700">{loadError}</p>}
          {currentProject.id !== activeProjectId ? <p>Loading selected project…</p> : projects.length === 0 ? (
            /* First-ever application use / zero projects empty state */
            <div className="h-full min-h-[480px] flex items-center justify-center p-6">
              <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-2xs space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 mx-auto flex items-center justify-center shadow-2xs">
                  <FolderPlus className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Welcome to docmonstakrakin
                  </h1>
                  <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                    Zero Projects Registered
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    You don't have any projects yet. Create your first project and docmonstakrakin will guide you through requirements, risk, architecture, planning, implementation, verification, and release.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleOpenCreateWizard}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Project
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <React.Fragment key={currentProject.id}>
              {currentView === 'overview' && (
            <DashboardView
              project={currentProject}
              nextAction={nextAction}
              questions={questions}
              risks={risks}
              recentAudits={auditLogs}
              onNavigate={(view, targetId) => {
                if (view === 'discovery') {
                  setSelectedQuestionId(targetId);
                  setCurrentView('requirements' as any);
                } else if (view === 'requirements') {
                  setSelectedReqId(targetId);
                  setCurrentView('requirements');
                } else if (view === 'work') {
                  setSelectedWorkItemId(targetId);
                  setCurrentView('work');
                } else {
                  setCurrentView(view as NavView);
                }
              }}
              onOpenOverrideModal={(gate) => setOverrideGate(gate)}
            />
          )}

          {currentView === 'requirements' && (
            <div className="space-y-6">
              {/* Sub-tabs across Canonical Requirements, Features, and Adaptive Discovery */}
              <div className="flex border-b border-slate-200 px-2 text-xs font-semibold gap-2 mb-2">
                <button
                  onClick={() => {
                    setRequirementsSubTab('canonical');
                    setSelectedQuestionId(undefined);
                  }}
                  className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                    requirementsSubTab === 'canonical' && !selectedQuestionId
                      ? 'border-emerald-600 text-emerald-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Canonical Requirements ({requirements.length})
                </button>
                <button
                  onClick={() => {
                    setRequirementsSubTab('features');
                    setSelectedQuestionId(undefined);
                  }}
                  className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                    requirementsSubTab === 'features' && !selectedQuestionId
                      ? 'border-emerald-600 text-emerald-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Product Features & Capabilities ({features.length})
                </button>
                <button
                  onClick={() => {
                    setRequirementsSubTab('discovery');
                    setSelectedQuestionId(questions[0]?.id || 'AUTH-Q-014');
                  }}
                  className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                    requirementsSubTab === 'discovery' || selectedQuestionId
                      ? 'border-emerald-600 text-emerald-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Adaptive Discovery Questionnaire ({questions.length})
                </button>
              </div>

              {selectedQuestionId || requirementsSubTab === 'discovery' ? (
                <QuestionnaireView
                  project={currentProject}
                  questions={questions}
                  onAnswerQuestion={handleAnswerQuestion}
                  onOpenOverrideModal={(gate) => setOverrideGate(gate)}
                  selectedQuestionId={selectedQuestionId}
                />
              ) : requirementsSubTab === 'features' ? (
                <FeaturesView
                  features={features}
                  onAddFeature={handleAddFeature}
                />
              ) : (
                <RequirementsView
                  project={currentProject}
                  requirements={requirements}
                  onAddRequirement={handleAddRequirement}
                  onUpdateRequirementStatus={handleUpdateRequirementStatus}
                  selectedReqId={selectedReqId}
                />
              )}
            </div>
          )}

          {currentView === 'risk' && (
            <RiskWorkspaceView risks={risks} threats={threats} />
          )}

          {currentView === 'work' && (
            <WorkView
              workItems={workItems}
              onUpdateWorkItem={handleUpdateWorkItem}
              selectedItemId={selectedWorkItemId}
            />
          )}

          {currentView === 'standards' && (
            <StandardsView standards={standards} />
          )}

          {currentView === 'evidence' && (
            <EvidenceView evidenceList={evidenceList} auditLogs={auditLogs} />
          )}

          {currentView === 'compiler' && (
            <PromptCompilerView
              project={currentProject}
              requirements={requirements}
              risks={risks}
              workItems={workItems}
              features={features}
              adrs={adrs}
              standards={standards}
              onImported={() => fetchProjectData(currentProject.id)}
              onNavigate={view => {setRequirementsSubTab('canonical');setCurrentView(view as NavView);}}
            />
          )}

          {currentView === 'documents' && (
            <DocumentsView
              project={currentProject}
              requirements={requirements}
              risks={risks}
              workItems={workItems}
              adrs={adrs}
              components={components}
              approvals={approvals}
              onOpenPackageModal={() => setIsPackageModalOpen(true)}
              onSignoffSuccess={() => fetchProjectData(currentProject.id)}
            />
          )}

          {currentView === 'architecture' && (
            <ArchitectureView
              project={currentProject}
              adrs={adrs}
              components={components}
              requirements={requirements}
              risks={risks}
              onAddADR={handleAddADR}
              onUpdateADRStatus={handleUpdateADRStatus}
              onAddComponent={handleAddComponent}
              onOpenOverrideModal={(gate) => setOverrideGate(gate)}
            />
          )}

          {currentView === 'repository' && (
            <RepositoryView project={currentProject} />
          )}

          {currentView === 'approvals' && (
            <ApprovalsView
              project={currentProject}
              onRefreshData={() => fetchProjectData(currentProject.id)}
            />
          )}

          {currentView === 'agents' && (
            <AgentCenterView
              project={currentProject}
              onNavigateToCompiler={() => setCurrentView('compiler')}
            />
          )}

          {currentView === 'projects' && (
            <ProjectsView
              projects={projects}
              currentProject={currentProject}
              onSelectProject={handleSelectProject}
              onOpenCreateWizard={handleOpenCreateWizard}
              onOpenPackageModal={() => setIsPackageModalOpen(true)}
              onNavigateToView={(view) => setCurrentView(view as NavView)}
            />
          )}

          {/* Fallback for settings view */}
          {currentView === 'settings' && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 max-w-2xl mx-auto shadow-2xs">
              <h2 className="text-base font-bold text-slate-900 capitalize">
                Settings Control Workspace
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Governed by active project profiles ({currentProject.profiles.join(', ')}). All baseline state items are accessible across Requirements, Risk, Work, Standards, and Evidence modules.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setCurrentView('overview')}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Return to Project Overview
                </button>
              </div>
            </div>
          )}
            </React.Fragment>
          )}
        </main>
      </div>

      {/* Slide-In Project Wizard Right Drawer */}
      <ProjectWizard
        isOpen={isWizardOpen}
        onClose={handleCloseCreateWizard}
        onCreateProject={handleCreateProject}
        triggerButtonId="topbar-new-project-btn"
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleGlobalSearchNavigate}
      />

      <OverrideModal
        isOpen={!!overrideGate}
        gateName={overrideGate || 'DISCOVERY_PHASE_GATE'}
        onClose={() => setOverrideGate(null)}
        onSubmitOverride={handleCreateOverride}
      />

      <PackageTransferModal
        isOpen={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
        currentProject={currentProject}
        onProjectImported={(importedProjectId) => {
          fetchProjects();
          setActiveProjectId(importedProjectId);
          fetchProjectData(importedProjectId);
        }}
      />
    </div>
  );
}
