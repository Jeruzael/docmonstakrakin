import { ReviewerSession } from './components/ReviewerSession';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, NavView } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ProjectsView } from './components/ProjectsView';
import { createProjectLoader, readProjectList, projectContentReady } from './data/projectWorkspace';
import { DashboardView } from './components/DashboardView';
import { ProjectWizard } from './components/ProjectWizard';
import { QuestionnaireView } from './components/QuestionnaireView';
import { RequirementsView } from './components/RequirementsView';
import { RiskWorkspaceView } from './components/RiskWorkspaceView';
import { WorkView } from './components/WorkView';
import { StandardsView } from './components/StandardsView';
import { EvidenceView } from './components/EvidenceView';
import { PromptCompilerView } from './components/PromptCompilerView';
import { ControlledDocsView } from './components/ControlledDocsView';
import { ArchitectureView } from './components/ArchitectureView';
import { RepositoryView } from './components/RepositoryView';
import { ApprovalsView } from './components/ApprovalsView';
import { AgentCenterView } from './components/AgentCenterView';
import { FeaturesView } from './components/FeaturesView';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { OverrideModal } from './components/OverrideModal';
import { PackageTransferModal } from './components/PackageTransferModal';
import { FolderPlus, Plus, AlertTriangle } from 'lucide-react';

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
  DocumentSaveResponse,
} from './types';
import {
  ExpectedAuditAcknowledgment,
  reconcileAuditEvents,
  combineRequiredAuditAcks,
} from './utils/auditValidation';
import { reconcileProjectList } from './utils/projectListReconciliation';

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
  const [packageMode, setPackageMode] = useState<'export' | 'import'>('export');
  const [overrideGate, setOverrideGate] = useState<string | null>(null);

  // Selected sub-items for deep linking from dashboard or search
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);
  const [selectedReqId, setSelectedReqId] = useState<string | undefined>(undefined);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | undefined>(undefined);

  // URL Project Parameter Helpers
  const getProjectFromUrl = (): string => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('project') || '';
    } catch {
      return '';
    }
  };

  const syncProjectUrl = (id: string, replace = false) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const current = url.searchParams.get('project') || '';
      if (id) {
        if (current !== id) {
          url.searchParams.set('project', id);
          if (replace) {
            window.history.replaceState(window.history.state, '', url.toString());
          } else {
            window.history.pushState(window.history.state, '', url.toString());
          }
        }
      } else {
        if (current) {
          url.searchParams.delete('project');
          if (replace) {
            window.history.replaceState(window.history.state, '', url.toString());
          } else {
            window.history.pushState(window.history.state, '', url.toString());
          }
        }
      }
    } catch (_) {}
  };

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => getProjectFromUrl());

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

  // Active Project Data
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [standards, setStandards] = useState<StandardControl[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [nextAction, setNextAction] = useState<RecommendedNextAction | null>(null);
  const [adrs, setAdrs] = useState<ADR[]>([]);
  const [components, setComponents] = useState<ArchitectureComponent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [requirementsSubTab, setRequirementsSubTab] = useState<'canonical' | 'features' | 'discovery'>('canonical');

  // Selection stays in App. Refs only guard async callbacks and request ordering.
  const selectedProjectRef = useRef<string>(getProjectFromUrl());
  const confirmedVersionsRef = useRef<Record<string, number>>({});
  const auditRefreshSeqRef = useRef<Record<string, number>>({});
  const outstandingAuditAcksRef = useRef<Record<string, ExpectedAuditAcknowledgment[]>>({});
  const confirmedAuditAcksRef = useRef<Record<string, ExpectedAuditAcknowledgment[]>>({});
  const projectAuditRecordsRef = useRef<Record<string, AuditEvent[]>>({});
  const projectAuditStatusRef = useRef<Record<string, 'CURRENT' | 'REFRESHING' | 'REFRESH_FAILED'>>({});
  const projectAuditErrorRef = useRef<Record<string, string>>({});
  const acceptedProjectsRef = useRef<Project[]>([]);
  const loader = useRef<ReturnType<typeof createProjectLoader> | null>(null);
  if (!loader.current) loader.current = createProjectLoader();
  const listSequence = useRef(0);
  const [projectsLoading,setProjectsLoading] = useState(true);
  const [projectsError,setProjectsError] = useState('');
  const [projectLoading,setProjectLoading] = useState(false);
  const [loadError,setLoadError] = useState('');
  const [auditSyncStatus, setAuditSyncStatus] = useState<'CURRENT' | 'REFRESHING' | 'REFRESH_FAILED'>('CURRENT');
  const [auditSyncError, setAuditSyncError] = useState<string>('');
  const [staleSnapshotWarning, setStaleSnapshotWarning] = useState<string>('');
  const projectReady = projectContentReady(activeProjectId,currentProject,projectLoading,loadError);
  // A refresh keeps the last complete matching tree mounted, but never ready.
  const projectMounted = Boolean(activeProjectId && currentProject?.id === activeProjectId);

  const getRequiredAcksForProject = useCallback((projectId: string) => {
    const confirmed = confirmedAuditAcksRef.current[projectId] ?? [];
    const outstanding = outstandingAuditAcksRef.current[projectId] ?? [];
    return combineRequiredAuditAcks(confirmed, outstanding);
  }, []);

  const performAuditRefresh = useCallback(async (projectId: string, seq: number) => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/audit`);
      if (!res.ok) {
        throw new Error(`Audit endpoint returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Audit endpoint returned non-array payload');
      }

      if (seq !== auditRefreshSeqRef.current[projectId]) {
        return;
      }

      const combo = getRequiredAcksForProject(projectId);
      if (!combo.valid) {
        projectAuditStatusRef.current[projectId] = 'REFRESH_FAILED';
        projectAuditErrorRef.current[projectId] = combo.reason;
        if (selectedProjectRef.current === projectId) {
          setAuditSyncStatus('REFRESH_FAILED');
          setAuditSyncError(combo.reason);
        }
        return;
      }

      const reconciliation = reconcileAuditEvents(data, combo.requiredAcks);

      if (!reconciliation.valid) {
        projectAuditStatusRef.current[projectId] = 'REFRESH_FAILED';
        projectAuditErrorRef.current[projectId] =
          'Document save succeeded, but the audit ledger has not finished synchronizing. Refresh audit records to confirm the latest event.';
        if (selectedProjectRef.current === projectId) {
          setAuditSyncStatus('REFRESH_FAILED');
          setAuditSyncError(projectAuditErrorRef.current[projectId]);
        }
        return;
      }

      const previouslyAccepted = projectAuditRecordsRef.current[projectId] ?? [];
      const dataIds = new Set(data.map((e: any) => e?.id));
      if (previouslyAccepted.some(e => !dataIds.has(e.id))) {
        projectAuditStatusRef.current[projectId] = 'REFRESH_FAILED';
        projectAuditErrorRef.current[projectId] =
          'Audit response omitted previously accepted audit record. Refresh audit records to confirm.';
        if (selectedProjectRef.current === projectId) {
          setAuditSyncStatus('REFRESH_FAILED');
          setAuditSyncError(projectAuditErrorRef.current[projectId]);
        }
        return;
      }

      // Satisfied: promote newly satisfied outstanding acknowledgments to confirmedAuditAcksRef
      const currentConfirmed = confirmedAuditAcksRef.current[projectId] ?? [];
      const currentOutstanding = outstandingAuditAcksRef.current[projectId] ?? [];
      const promoteCombo = combineRequiredAuditAcks(currentConfirmed, currentOutstanding);
      if (promoteCombo.valid) {
        confirmedAuditAcksRef.current[projectId] = promoteCombo.requiredAcks;
      }
      outstandingAuditAcksRef.current[projectId] = [];
      projectAuditRecordsRef.current[projectId] = data;
      projectAuditStatusRef.current[projectId] = 'CURRENT';
      projectAuditErrorRef.current[projectId] = '';

      if (selectedProjectRef.current === projectId) {
        setAuditLogs(data);
        setAuditSyncStatus('CURRENT');
        setAuditSyncError('');
      }
    } catch {
      if (seq !== auditRefreshSeqRef.current[projectId]) {
        return;
      }
      projectAuditStatusRef.current[projectId] = 'REFRESH_FAILED';
      projectAuditErrorRef.current[projectId] =
        'Document save succeeded, but the audit ledger has not finished synchronizing. Refresh audit records to confirm the latest event.';
      if (selectedProjectRef.current === projectId) {
        setAuditSyncStatus('REFRESH_FAILED');
        setAuditSyncError(projectAuditErrorRef.current[projectId]);
      }
    }
  }, [getRequiredAcksForProject]);

  const handleRetryAuditRefresh = useCallback(() => {
    const projId = selectedProjectRef.current;
    if (!projId) return;
    const nextSeq = (auditRefreshSeqRef.current[projId] ?? 0) + 1;
    auditRefreshSeqRef.current[projId] = nextSeq;
    projectAuditStatusRef.current[projId] = 'REFRESHING';
    projectAuditErrorRef.current[projId] = '';
    setAuditSyncStatus('REFRESHING');
    setAuditSyncError('');
    void performAuditRefresh(projId, nextSeq);
  }, [performAuditRefresh]);

  const handleControlledDocumentCommitted = useCallback((projectId: string, saveResponse: DocumentSaveResponse) => {
    if (
      !projectId ||
      typeof projectId !== 'string' ||
      !saveResponse ||
      saveResponse.success !== true ||
      typeof saveResponse.stateVersion !== 'number' ||
      !Number.isInteger(saveResponse.stateVersion) ||
      saveResponse.stateVersion < 0
    ) {
      return;
    }

    const currentConfirmed = confirmedVersionsRef.current[projectId] ?? 0;
    const nextVersion = Math.max(currentConfirmed, saveResponse.stateVersion);
    confirmedVersionsRef.current[projectId] = nextVersion;

    if (selectedProjectRef.current === projectId) {
      setCurrentProject(prev => {
        if (!prev || prev.id !== projectId) return prev;
        const currentVersion = prev.stateVersion ?? 0;
        const targetVersion = Math.max(currentVersion, nextVersion);
        return prev.stateVersion === targetVersion ? prev : { ...prev, stateVersion: targetVersion };
      });
    }

    setProjects(prevProjects => {
      const updated = prevProjects.map(p =>
        p.id === projectId
          ? { ...p, stateVersion: Math.max(p.stateVersion ?? 0, nextVersion) }
          : p
      );
      acceptedProjectsRef.current = updated;
      return updated;
    });

    if (saveResponse.auditEventId) {
      const newAck: ExpectedAuditAcknowledgment = {
        auditEventId: saveResponse.auditEventId,
        documentId: saveResponse.documentId,
        path: saveResponse.path,
        previousSha256: saveResponse.previousSha256,
        newSha256: saveResponse.newSha256,
        timestamp: saveResponse.timestamp,
        stateVersion: nextVersion,
      };
      const existingAcks = outstandingAuditAcksRef.current[projectId] ?? [];
      outstandingAuditAcksRef.current[projectId] = [...existingAcks, newAck];

      const nextSeq = (auditRefreshSeqRef.current[projectId] ?? 0) + 1;
      auditRefreshSeqRef.current[projectId] = nextSeq;
      projectAuditStatusRef.current[projectId] = 'REFRESHING';
      projectAuditErrorRef.current[projectId] = '';

      if (selectedProjectRef.current === projectId) {
        setAuditSyncStatus('REFRESHING');
        setAuditSyncError('');
      }
      void performAuditRefresh(projectId, nextSeq);
    }
  }, [performAuditRefresh]);

  const fetchProjectData = useCallback(async (projectId:string) => {
    await loader.current!.load(projectId,()=>selectedProjectRef.current===projectId,{
      onStart:()=>{setProjectLoading(true);setLoadError('');},
      onCommit:data=>{
        const confirmed = confirmedVersionsRef.current[data.project.id] ?? 0;
        const incomingVersion = data.project.stateVersion ?? 0;

        if (incomingVersion < confirmed) {
          // Reject stale snapshot as a whole to prevent overwriting confirmed canonical data
          setProjectLoading(false);
          setStaleSnapshotWarning('Project state snapshot is older than the confirmed version. Retry to refresh.');
          return;
        }

        setStaleSnapshotWarning('');
        setCurrentProject(data.project);setQuestions(data.questions);setRequirements(data.requirements);
        setRisks(data.risks);setWorkItems(data.workItems);setEvidenceList(data.evidence);

        // Validate snapshot audit against confirmed and outstanding acknowledgments
        const combo = getRequiredAcksForProject(data.project.id);
        const auditReconciliation = combo.valid
          ? reconcileAuditEvents(data.audit, combo.requiredAcks)
          : { valid: false, reason: combo.reason, satisfiedAckIds: [] };

        const previouslyAccepted = projectAuditRecordsRef.current[data.project.id] ?? [];
        const dataIds = new Set((data.audit || []).map((e: any) => e?.id));
        const missingPreviouslyAccepted = previouslyAccepted.some(e => !dataIds.has(e.id));

        if (auditReconciliation.valid && !missingPreviouslyAccepted) {
          const currentConfirmed = confirmedAuditAcksRef.current[data.project.id] ?? [];
          const currentOutstanding = outstandingAuditAcksRef.current[data.project.id] ?? [];
          const promoteCombo = combineRequiredAuditAcks(currentConfirmed, currentOutstanding);
          if (promoteCombo.valid) {
            confirmedAuditAcksRef.current[data.project.id] = promoteCombo.requiredAcks;
          }
          outstandingAuditAcksRef.current[data.project.id] = [];
          projectAuditRecordsRef.current[data.project.id] = data.audit;
          projectAuditStatusRef.current[data.project.id] = 'CURRENT';
          projectAuditErrorRef.current[data.project.id] = '';
          setAuditLogs(data.audit);
          setAuditSyncStatus('CURRENT');
          setAuditSyncError('');
        } else {
          // Keep previously accepted audit logs; do not erase or overwrite with omitting snapshot
          const preservedLogs = projectAuditRecordsRef.current[data.project.id] || [];
          setAuditLogs(preservedLogs);
          projectAuditStatusRef.current[data.project.id] = 'REFRESH_FAILED';
          const errMsg = !combo.valid
            ? combo.reason
            : missingPreviouslyAccepted
            ? 'Project data snapshot omitted previously accepted audit record. Refresh audit records to confirm.'
            : 'Project data snapshot omitted confirmed audit event. Refresh audit records to confirm.';
          projectAuditErrorRef.current[data.project.id] = errMsg;
          setAuditSyncStatus('REFRESH_FAILED');
          setAuditSyncError(errMsg);
        }

        setNextAction(data.nextAction);setAdrs(data.adrs);setComponents(data.components);setApprovals(data.approvals);
        setFeatures(data.features);setStandards(data.standards);setThreats(data.threats);setProjectLoading(false);
        setProjects(previous => {
          const updated = previous.map(p => p.id === data.project.id ? data.project : p);
          acceptedProjectsRef.current = updated;
          return updated;
        });
      },
      onError:message=>{setLoadError(message);setProjectLoading(false);},
    });
  },[getRequiredAcksForProject]);

  const handleSelectProject = useCallback((id:string, replaceBaseline=false, syncHistory: 'push' | 'replace' | 'none' = 'push') => {
    if (syncHistory !== 'none') {
      syncProjectUrl(id, syncHistory === 'replace');
    }
    setStaleSnapshotWarning('');

    if(id && id===selectedProjectRef.current && !replaceBaseline) {
      // Same-project re-selection:
      // Preserve project's own audit status & error instead of resetting to CURRENT
      const currentStatus = projectAuditStatusRef.current[id] || 'CURRENT';
      const currentError = projectAuditErrorRef.current[id] || '';
      setAuditSyncStatus(currentStatus);
      setAuditSyncError(currentError);

      setCurrentView(view=>view==='projects'?'overview':view);
      void fetchProjectData(id);
      return;
    }
    loader.current!.invalidate();
    selectedProjectRef.current=id;
    setCurrentProject(null);
    setSelectedReqId(undefined);setSelectedQuestionId(undefined);setSelectedWorkItemId(undefined);
    setRequirementsSubTab('canonical');setIsSearchOpen(false);setOverrideGate(null);setIsPackageModalOpen(false);
    setCurrentView(view=>view==='projects'?'overview':view);
    setActiveProjectId(id);setLoadError('');setProjectLoading(Boolean(id));
    if(id) {
      // Restore target project's own audit records & status
      const targetStatus = projectAuditStatusRef.current[id] || 'CURRENT';
      const targetError = projectAuditErrorRef.current[id] || '';
      const targetLogs = projectAuditRecordsRef.current[id] || [];
      setAuditSyncStatus(targetStatus);
      setAuditSyncError(targetError);
      setAuditLogs(targetLogs);

      void fetchProjectData(id);
    } else {
      setCurrentProject(null);
      setProjectLoading(false);
      setAuditSyncStatus('CURRENT');
      setAuditSyncError('');
      setAuditLogs([]);
    }
  },[fetchProjectData, performAuditRefresh]);

  // Browser back / forward buttons close or open the drawer accordingly & restore project
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const hasDrawer = params.get('drawer') === 'new-project' || params.get('dialog') === 'new-project';
      setIsWizardOpen(hasDrawer);

      const projParam = params.get('project');
      setProjects(currentList => {
        const targetId = projParam || currentList[0]?.id || '';
        if (targetId && targetId !== selectedProjectRef.current && currentList.some(p => p.id === targetId)) {
          handleSelectProject(targetId, false, 'none');
        }
        return currentList;
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handleSelectProject]);

  // Fetch projects list without falling back to seeded/demo identities.
  const fetchProjects = useCallback(async () => {
    const sequence=++listSequence.current;
    setProjectsLoading(true);setProjectsError('');
    try {
      const data=await readProjectList();
      if(sequence!==listSequence.current)return;

      const { acceptedProjects, staleProjects } = reconcileProjectList(
        data,
        acceptedProjectsRef.current,
        confirmedVersionsRef.current
      );
      acceptedProjectsRef.current = acceptedProjects;
      setProjects(acceptedProjects);

      if (staleProjects.length > 0) {
        setStaleSnapshotWarning('Some project list items are older than confirmed versions. Refreshing authoritative data...');
      }

      if (acceptedProjects.length === 0) {
        handleSelectProject('', false, 'replace');
        return;
      }

      // Check URL query param first, then ref
      const requestedId = getProjectFromUrl() || selectedProjectRef.current;
      const matched = acceptedProjects.find(p => p.id === requestedId);

      if (matched) {
        handleSelectProject(matched.id, false, 'replace');
      } else {
        // Fall back to first project only when there is no valid requested/remembered project
        handleSelectProject(acceptedProjects[0]?.id || '', false, 'replace');
      }
    } catch(error) {
      if(sequence===listSequence.current)setProjectsError(error instanceof Error?error.message:'Cannot load projects.');
    } finally {if(sequence===listSequence.current)setProjectsLoading(false);}
  },[handleSelectProject]);

  useEffect(()=>{
    void fetchProjects();
    return ()=>{listSequence.current++;loader.current!.invalidate();};
  },[fetchProjects]);

  // Keyboard shortcut Ctrl+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (projectReady && (e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectReady]);

  // Project-scoped mutations retain their originating project ID.
  const handleCreateProject = async (newProjDraft: any) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjDraft),
      });
      if (res.ok) {
        const created: Project = await res.json();
        listSequence.current++;setProjectsLoading(false);setProjectsError('');
        setProjects((prev) => [created, ...prev.filter(p=>p.id!==created.id)]);
        handleSelectProject(created.id);
        setCurrentView('overview');
        handleCloseCreateWizard();
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
    if (!projectReady || !currentProject) throw new Error('Select a ready project before updating work items');
    const projectId = currentProject.id;
      const res = await fetch(`/api/projects/${projectId}/work-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, status, checklistIndex: checklistIdx, checklistDone: done }),
      });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Work item update failed (${res.status})`);
    }
    await fetchProjectData(projectId);
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
        unresolvedBlockersCount={projectReady ? unresolvedBlockersCount : 0}
      />

      {/* Main Control Plane Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Control Bar */}
        <TopBar
          currentProject={projectReady ? currentProject : projects.find(p=>p.id===activeProjectId) || null}
          selectionStatus={loadError ? 'Unavailable' : projectLoading ? projectMounted ? 'Refreshing…' : 'Loading…' : projectsLoading ? 'Loading projects…' : ''}
          searchDisabled={!projectReady}
          projects={projects}
          onSelectProject={handleSelectProject}
          onOpenCreateWizard={handleOpenCreateWizard}
          onOpenSearch={() => {if(projectReady)setIsSearchOpen(true);}}
          onOpenPackageModal={projectReady ? () => {setPackageMode('export');setIsPackageModalOpen(true);} : undefined}
          onImportPackage={() => {setPackageMode('import');setIsPackageModalOpen(true);}}
        />

        <ReviewerSession />
        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{loadError}</p><button className="mt-2 underline font-semibold" onClick={()=>void fetchProjectData(activeProjectId)}>Retry selected project</button></div>}
          {staleSnapshotWarning && (
            <div
              data-testid="stale-snapshot-warning"
              role="alert"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{staleSnapshotWarning}</span>
              </div>
              <button
                data-testid="btn-retry-project-fetch"
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md text-xs cursor-pointer shrink-0"
                onClick={() => void fetchProjectData(activeProjectId)}
              >
                Retry to refresh
              </button>
            </div>
          )}
          {projectMounted && projectLoading && <p role="status" className="mb-4 text-sm text-slate-600">Refreshing selected project…</p>}
          {currentView === 'projects' ? <ProjectsView projects={projects} activeProjectId={projectReady ? activeProjectId : ''} loading={projectsLoading} error={projectsError} onSelectProject={handleSelectProject} onCreateProject={handleOpenCreateWizard} onRetry={()=>void fetchProjects()}/> : projectsLoading && projects.length===0 ? <p role="status">Loading projects…</p> : projectsError && projects.length===0 ? <div role="alert"><p>{projectsError}</p><button className="mt-2 underline" onClick={()=>void fetchProjects()}>Retry project list</button></div> : projects.length === 0 ? (
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
          ) : !projectMounted ? <p role="status">{loadError ? 'Select another project or retry to continue.' : 'Loading selected project…'}</p> : (
            <div key={currentProject.id} inert={!projectReady} hidden={Boolean(loadError)} aria-busy={projectLoading} data-project-scope={currentProject.id}>
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
              projectId={activeProjectId}
              workItems={workItems}
              onUpdateWorkItem={handleUpdateWorkItem}
              selectedItemId={selectedWorkItemId}
            />
          )}

          {currentView === 'standards' && (
            <StandardsView standards={standards} />
          )}

          {currentView === 'evidence' && (
            <EvidenceView
              evidenceList={evidenceList}
              auditLogs={auditLogs}
              auditSyncStatus={auditSyncStatus}
              auditSyncError={auditSyncError}
              onRetryAuditRefresh={handleRetryAuditRefresh}
            />
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
            <ControlledDocsView
              key={`controlled-docs-${currentProject.id}`}
              projectId={currentProject.id}
              onSaveCommitted={handleControlledDocumentCommitted}
              dynamicProjectionsProps={{
                project: currentProject,
                requirements,
                risks,
                workItems,
                adrs,
                components,
                approvals,
                onOpenPackageModal: () => {
                  setPackageMode('export');
                  setIsPackageModalOpen(true);
                },
                onSignoffSuccess: () => fetchProjectData(currentProject.id),
              }}
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

          {/* Fallback for other sidebar views */}
          {currentView === 'settings' && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 max-w-2xl mx-auto shadow-2xs">
              <h2 className="text-base font-bold text-slate-900 capitalize">
                {currentView} Control Workspace
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
            </div>
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

      {projectMounted && <div key={activeProjectId} inert={!projectReady} hidden={!projectReady}>
      <GlobalSearchModal
        project={currentProject}
        requirements={requirements}
        workItems={workItems}
        risks={risks}
        standards={standards}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleGlobalSearchNavigate}
      />

      <OverrideModal
        isOpen={!!overrideGate}
        gateOrBlockerName={overrideGate || 'DISCOVERY_PHASE_GATE'}
        onClose={() => setOverrideGate(null)}
        onConfirmOverride={(reason, riskAcknowledged) =>
          handleCreateOverride({
            gateOrControl: overrideGate || 'DISCOVERY_PHASE_GATE',
            reason,
            riskAcknowledged,
          })
        }
      />

      </div>}

      {isPackageModalOpen && <PackageTransferModal
        key={activeProjectId}
        isOpen={isPackageModalOpen}
        initialTab={packageMode}
        onClose={() => setIsPackageModalOpen(false)}
        currentProject={projectReady ? currentProject : null}
        onProjectImported={(importedProjectId) => {
          handleSelectProject(importedProjectId, true);
          void fetchProjects();
        }}
      />}
    </div>
  );
}
