/**
 * ControlledDocsView.tsx
 * Repository Documents UI & Controlled Documentation Workspace (DMK-195 Task 10 / Task 10A).
 * Enforces secure markdown rendering, lockfile conventions, and hardened 6-step edit workflow.
 */

import { useState, useEffect, useMemo, useCallback, useRef, type ComponentProps, type FC } from 'react';
import {
  Search,
  Edit3,
  Eye,
  FileCode,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Check,
  AlertCircle,
  FileText,
  Layers,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type {
  ControlledDocumentSummary,
  DocumentContentResponse,
  DocumentDiffResponse,
  DocumentValidationResponse,
  DocumentSaveResponse,
  ReviewerSessionInfo,
} from '../types.js';
import { createControlledDocsLoader } from '../data/controlledDocsClient.js';
import { isValidStateVersion } from '../utils/projectListReconciliation.js';
import { DocumentsView } from './DocumentsView';
import type { ManagedDocumentContentResponse, ManagedDocumentCreateResponse } from '../managedDocumentTypes.js';
import {observedWorkspaceMode} from '../data/workspaceTransport.ts';

type DynamicProjectionsProps = ComponentProps<typeof DocumentsView>;

export interface ControlledDocsViewProps {
  projectId: string;
  canonicalReady?: boolean;
  loader?: ReturnType<typeof createControlledDocsLoader>;
  dynamicProjectionsProps?: DynamicProjectionsProps;
  onSaveCommitted?: (projectId: string, result: DocumentSaveResponse) => void;
  onDocumentCreated?: (projectId: string, result: ManagedDocumentCreateResponse) => void;
}

export type DocsWorkspaceTab = 'REPOSITORY' | 'PROJECTIONS';

export type WorkflowStep =
  | 'VIEW'
  | 'EDIT_DRAFT'
  | 'PREVIEW_DIFF'
  | 'VALIDATE'
  | 'CONFIRM_SAVE'
  | 'COORDINATED_COMMIT';

export const ControlledDocsView: FC<ControlledDocsViewProps> = ({
  projectId,
  canonicalReady = true,
  loader,
  dynamicProjectionsProps,
  onSaveCommitted,
  onDocumentCreated,
}) => {
  // Stable API loader
  const api = useMemo(() => loader ?? createControlledDocsLoader(), [loader]);

  // Tab State
  const [workspaceTab, setWorkspaceTab] = useState<DocsWorkspaceTab>('REPOSITORY');

  // Catalog State
  const [documents, setDocuments] = useState<ControlledDocumentSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Content & View State
  const [contentResponse, setContentResponse] = useState<ManagedDocumentContentResponse | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [isRawMode, setIsRawMode] = useState(false);

  // 6-Step Workflow State
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('VIEW');
  const [draftContent, setDraftContent] = useState('');
  const [baseSha256, setBaseSha256] = useState('');

  // Diff & Validation State
  const [diffResponse, setDiffResponse] = useState<DocumentDiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const [validationResponse, setValidationResponse] = useState<DocumentValidationResponse | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Governance Session State
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [reviewerSession, setReviewerSession] = useState<ReviewerSessionInfo | null>(null);

  // Save Modal & Lifecycle State
  const [saveReason, setSaveReason] = useState('');
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<DocumentSaveResponse | null>(null);

  // Canonical Refresh State
  const [canonicalRefreshRequired, setCanonicalRefreshRequired] = useState(false);
  const [canonicalRefreshError, setCanonicalRefreshError] = useState<string | null>(null);
  const [uncertainSaveNotice, setUncertainSaveNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createFormat, setCreateFormat] = useState<'MARKDOWN' | 'TEXT'>('MARKDOWN');
  const [createKind, setCreateKind] = useState<'PRODUCT' | 'REQUIREMENTS' | 'ARCHITECTURE' | 'SECURITY' | 'VERIFICATION' | 'OPERATIONS'>('PRODUCT');
  const [createContent, setCreateContent] = useState('');
  const [createReason, setCreateReason] = useState('');
  const [createConfirmed, setCreateConfirmed] = useState(false);
  const [createVersion, setCreateVersion] = useState<number | null>(null);
  const [createAllowed,setCreateAllowed]=useState(false);
  const [createRequestId, setCreateRequestId] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createContextLoading, setCreateContextLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createRecoveryRequired, setCreateRecoveryRequired] = useState(false);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);

  // Update refs during render, before effects invalidate network channels. This
  // also protects callers that supply a loader which ignores AbortSignal.
  const projectRef = useRef(projectId);
  const selectedRef = useRef(selectedDocId);
  const lifecycleRef = useRef(0);
  const selectionEpochRef = useRef(0);
  if (projectRef.current !== projectId) lifecycleRef.current++;
  if (selectedRef.current !== selectedDocId) selectionEpochRef.current++;
  projectRef.current = projectId;
  selectedRef.current = selectedDocId;
  const captureContext = (documentId?: string | null) => {
    const epoch = lifecycleRef.current;
    const selectionEpoch = selectionEpochRef.current;
    return () => epoch === lifecycleRef.current && projectRef.current === projectId &&
      (documentId === undefined || (selectedRef.current === documentId && selectionEpoch === selectionEpochRef.current));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      lifecycleRef.current++;
      api.invalidate();
    };
  }, [api]);

  // Load document list whenever projectId changes
  const refreshDocumentList = useCallback(async () => {
    const epoch = lifecycleRef.current;
    const current = () => projectRef.current === projectId && lifecycleRef.current === epoch;
    setLoadingList(true);
    setListError(null);
    try {
      const list = await api.loadDocumentList(projectId);
      if (!current()) return;
      setDocuments(list);
      if (list.length > 0) {
        setSelectedDocId((prev) => (prev && list.some((d) => d.id === prev) ? prev : list[0].id));
      } else {
        setSelectedDocId(null);
      }
    } catch (err: any) {
      if (!current()) return;
      if (err.name !== 'AbortError') {
        setListError(err.message || 'Failed to load document catalog.');
      }
    } finally {
      if (current()) setLoadingList(false);
    }
  }, [api, projectId]);

  // Project switching reset
  useEffect(() => {
    setWorkspaceTab('REPOSITORY');
    api.invalidate();
    setSelectedDocId(null);
    setContentResponse(null);
    setContentError(null);
    setWorkflowStep('VIEW');
    setDraftContent('');
    setBaseSha256('');
    setDiffResponse(null);
    setDiffError(null);
    setDiffLoading(false);
    setValidationResponse(null);
    setValidationError(null);
    setValidationLoading(false);
    setSaveSuccess(null);
    setSaveError(null);
    setSaveReason('');
    setHumanConfirmed(false);
    setReviewerSession(null);
    setSessionError(null);
    setSessionLoading(false);
    setCanonicalRefreshRequired(false);
    setCanonicalRefreshError(null);
    setUncertainSaveNotice(null);
    setCreateOpen(false);
    setCreateBusy(false);
    setCreateContextLoading(false);
    setCreateTitle('');
    setCreateContent('');
    setCreateReason('');
    setCreateConfirmed(false);
    setCreateVersion(null);
    setCreateAllowed(false);
    setCreateRequestId('');
    setCreateError(null);
    setCreateRecoveryRequired(false);
    setCreatedNotice(null);
    setIsSaving(false);
    refreshDocumentList();
  }, [projectId, refreshDocumentList, api]);

  // Selected document content loader and synchronous selection reset (Section 10)
  useEffect(() => {
    setDiffLoading(false);
    setValidationLoading(false);
    setSessionLoading(false);
    if (!selectedDocId) {
      setContentResponse(null);
      setContentError(null);
      setDraftContent('');
      setBaseSha256('');
      setDiffResponse(null);
      setDiffError(null);
      setValidationResponse(null);
      setValidationError(null);
      setSaveReason('');
      setHumanConfirmed(false);
      setReviewerSession(null);
      setSessionError(null);
      setSaveError(null);
      setSaveSuccess(null);
      setUncertainSaveNotice(null);
      setCanonicalRefreshRequired(false);
      setCanonicalRefreshError(null);
      setWorkflowStep('VIEW');
      return;
    }

    let active = true;

    // Reset document state BEFORE starting loadDocumentContent
    setContentResponse(null);
    setContentError(null);
    setDraftContent('');
    setBaseSha256('');
    setDiffResponse(null);
    setDiffError(null);
    setValidationResponse(null);
    setValidationError(null);
    setSaveReason('');
    setHumanConfirmed(false);
    setReviewerSession(null);
    setSessionError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setUncertainSaveNotice(null);
    setCanonicalRefreshRequired(false);
    setCanonicalRefreshError(null);
    setWorkflowStep('VIEW');

    setLoadingContent(true);
    api
      .loadDocumentContent(projectId, selectedDocId)
      .then((resp) => {
        if (!active) return;
        setContentResponse(resp);
        setDraftContent(resp.content);
        setBaseSha256(resp.rawSha256);
      })
      .catch((err: any) => {
        if (!active) return;
        if (err.name !== 'AbortError') {
          setContentError(err.message || 'Failed to load document content.');
          setContentResponse(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingContent(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedDocId, api, projectId]);

  // Selected document summary
  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId),
    [documents, selectedDocId]
  );

  // Group documents by kind
  const filteredAndGroupedDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = documents.filter((d) => {
      if (!q) return true;
      return (
        d.id.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q)
      );
    });

    const groups: Record<string, ControlledDocumentSummary[]> = {};
    for (const doc of filtered) {
      const kind = doc.kind || 'OTHER';
      if (!groups[kind]) groups[kind] = [];
      groups[kind].push(doc);
    }
    return groups;
  }, [documents, searchQuery]);

  // Context-neutral canonical refresh helper (Section 5)
  const performCanonicalRefresh = useCallback(
    async (docId: string): Promise<boolean> => {
      const current = captureContext(docId);
      try {
        const [freshContent, freshList] = await Promise.all([
          api.loadDocumentContent(projectId, docId),
          api.loadDocumentList(projectId),
        ]);
        if (!current()) return false;
        setContentResponse(freshContent);
        setDraftContent(freshContent.content);
        setBaseSha256(freshContent.rawSha256);
        setDocuments(freshList);
        setDiffResponse(null);
        setValidationResponse(null);
        setSaveReason('');
        setHumanConfirmed(false);
        setReviewerSession(null);
        setSessionError(null);
        setCanonicalRefreshRequired(false);
        setCanonicalRefreshError(null);
        setWorkflowStep('VIEW');
        return true;
      } catch {
        if (!current()) return false;
        setCanonicalRefreshRequired(true);
        return false;
      }
    },
    [api, projectId]
  );

  // Editability calculation
  const isEditable = useMemo(() => {
    if (!selectedDoc) return false;
    if (selectedDoc.editability !== 'CONTROLLED_EDIT') return false;
    if (selectedDoc.integrityStatus === 'MISSING') return false;
    if (!contentResponse) return false;
    if (contentResponse.eol === 'MIXED') return false;
    if (canonicalRefreshRequired) return false;
    return true;
  }, [selectedDoc, contentResponse, canonicalRefreshRequired]);

  // Handle Draft Change with automatic downstream invalidation
  const handleDraftChange = (newContent: string) => {
    setDraftContent(newContent);
    setDiffResponse(null);
    setValidationResponse(null);
    setDiffError(null);
    setValidationError(null);
  };

  // Handle Edit Draft transition
  const handleStartEdit = () => {
    if (!contentResponse || !isEditable) return;
    setDraftContent(contentResponse.content);
    setBaseSha256(contentResponse.rawSha256);
    setDiffResponse(null);
    setValidationResponse(null);
    setWorkflowStep('EDIT_DRAFT');
  };

  // Handle Preview Diff transition
  const handlePreviewDiff = async () => {
    if (!selectedDoc) return;
    const current = captureContext(selectedDoc.id);
    setDiffLoading(true);
    setDiffError(null);
    try {
      const diff = await api.requestDiff(projectId, selectedDoc.id, draftContent, baseSha256);
      if (!current()) return;
      setDiffResponse(diff);
      setWorkflowStep('PREVIEW_DIFF');
    } catch (err: any) {
      if (!current()) return;
      if (err.name !== 'AbortError') {
        setDiffError(err.message || 'Failed to compute diff.');
      }
    } finally {
      if (current()) setDiffLoading(false);
    }
  };

  // Handle Validate transition (strictly guarded against stale or empty changes)
  const handleValidate = async () => {
    if (!selectedDoc || !diffResponse || diffResponse.isStale || !diffResponse.hasChanges) {
      return;
    }
    const current = captureContext(selectedDoc.id);
    setValidationLoading(true);
    setValidationError(null);
    try {
      const val = await api.requestValidate(projectId, selectedDoc.id, draftContent);
      if (!current()) return;
      setValidationResponse(val);
      setWorkflowStep('VALIDATE');
    } catch (err: any) {
      if (!current()) return;
      if (err.name !== 'AbortError') {
        setValidationError(err.message || 'Validation request failed.');
      }
    } finally {
      if (current()) setValidationLoading(false);
    }
  };

  // Handle Proceed to Save (open modal and load session state)
  const handleOpenSaveModal = async () => {
    const current = captureContext(selectedDocId);
    setSaveError(null);
    setSaveReason('');
    setHumanConfirmed(false);
    setReviewerSession(null);
    setSessionError(null);
    setSessionLoading(true);
    setWorkflowStep('CONFIRM_SAVE');

    try {
      const session = await api.loadGovernanceSession();
      if (!current()) return;
      setReviewerSession(session);
    } catch {
      if (!current()) return;
      setSessionError('Unable to load governance reviewer session.');
    } finally {
      if (current()) setSessionLoading(false);
    }
  };

  // Handle Save Execution (Step 6 COORDINATED_COMMIT)
  const handleConfirmSave = async () => {
    if (
      !selectedDoc ||
      !saveReason.trim() ||
      !humanConfirmed ||
      !reviewerSession ||
      isSaving ||
      workflowStep === 'COORDINATED_COMMIT'
    ) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setWorkflowStep('COORDINATED_COMMIT');
    const current = captureContext(selectedDoc.id);

    let saveResp: DocumentSaveResponse | null = null;
    try {
      saveResp = await api.requestSave({
        projectId,
        documentId: selectedDoc.id,
        candidateContent: draftContent,
        baseSha256,
        reason: saveReason.trim(),
        humanConfirmed: true,
        ...(selectedDoc.id.startsWith('MDOC-') ? {
          expectedStateVersion: contentResponse?.stateVersion,
          requestId: crypto.randomUUID(),
        } : {}),
      });
      if (!current()) return;

      // Commit phase ends immediately when requestSave resolves (Section 2)
      setSaveSuccess(saveResp);
      setIsSaving(false);
      setWorkflowStep('VIEW');

      // Lock editing during post-save refresh (Section 3)
      setCanonicalRefreshRequired(true);

      // Notify parent of confirmed save transaction (isolated failure domain)
      if (
        onSaveCommitted &&
        saveResp &&
        saveResp.success === true &&
        isValidStateVersion(saveResp.stateVersion)
      ) {
        try {
          onSaveCommitted(projectId, saveResp);
        } catch (callbackErr) {
          console.error('ControlledDocsView: onSaveCommitted parent callback threw an error:', callbackErr);
        }
      }
    } catch (err: any) {
      if (!current()) return;
      setIsSaving(false);
      const isUncertain = err.name === 'AbortError' || /timed out|Invalid managed document save response/.test(err.message ?? '');
      if (isUncertain) {
        setWorkflowStep('VIEW');
        setCanonicalRefreshRequired(true);
        const refreshed = await performCanonicalRefresh(selectedDoc.id);
        if (!current()) return;
        if (refreshed) {
          setUncertainSaveNotice('Save outcome was uncertain; canonical state was reloaded.');
        } else {
          setCanonicalRefreshRequired(true);
          setCanonicalRefreshError('Save outcome is uncertain and canonical refresh failed.');
        }
        return;
      }

      const isDocStale = typeof err.message === 'string' && /DOCUMENT_STALE|STALE_STATE|DOCUMENT_REQUEST_REPLAYED|Persisted state changed/.test(err.message);
      if (isDocStale) {
        setWorkflowStep('VIEW');
        setCanonicalRefreshRequired(true);
        setCanonicalRefreshError('Document changed or project state is stale. Reload canonical state before editing again.');
        return;
      }

      setWorkflowStep('CONFIRM_SAVE');
      setSaveError(err.message || 'Failed to save document.');
      return;
    }

    // Step B: Canonical-refresh phase (separated from save)
    const refreshed = await performCanonicalRefresh(selectedDoc.id);
    if (!current()) return;
    if (!refreshed) {
      setCanonicalRefreshRequired(true);
      setCanonicalRefreshError('Save succeeded, but canonical refresh failed.');
    }
  };

  const loadCreateContext = async () => {
    const current = captureContext();
    setCreateContextLoading(true);
    setCreateConfirmed(false);
    setCreateVersion(null);
    setCreateAllowed(false);
    setReviewerSession(null);
    try {
      const [session, context] = await Promise.all([
        api.loadGovernanceSession(), api.loadProjectAuthoringContext(projectId),
      ]);
      if (!current()) return;
      setReviewerSession(session);
      setCreateVersion(context.stateVersion);
      setCreateAllowed(!!session&&(context.actions?.includes('project:write')??(observedWorkspaceMode()==='LOCAL_DEVELOPMENT'&&session.roles.some(role=>['Security Officer','Lead Architect'].includes(role)))));
      setCreateRecoveryRequired(false);
    } catch (err: any) {
      if (current()) setCreateError(err.message || 'Unable to load reviewer session and project state.');
    } finally { if (current()) setCreateContextLoading(false); }
  };

  const handleOpenCreate = () => {
    setCreateOpen(true);
    setCreateTitle('');
    setCreateContent('');
    setCreateReason('');
    setCreateError(null);
    setCreateRequestId(crypto.randomUUID());
    void loadCreateContext();
  };

  const handleCreate = async () => {
    if (!canonicalReady || createBusy || createContextLoading || createVersion === null || createRecoveryRequired || !createConfirmed ||
      !createAllowed ||
      !createTitle.trim() || !createContent.trim() || !createReason.trim()) return;
    const current = captureContext();
    setCreateBusy(true);
    setCreateError(null);
    try {
      const result = await api.requestCreate({ projectId, title: createTitle.trim(), kind: createKind, format: createFormat,
        content: createContent, expectedStateVersion: createVersion, reason: createReason.trim(), humanConfirmed: true, requestId: createRequestId });
      if (!current()) return;
      if (result.projectId !== projectId || result.stateVersion !== createVersion + 1) throw new Error('Creation acknowledgment is uncertain; reload before continuing.');
      setCreateOpen(false);
      setCreatedNotice(`Document created. Audit ID: ${result.auditEventId}. Creation confers no governance approval or trust.`);
      try { onDocumentCreated?.(projectId, result); } catch (error) { console.error('ControlledDocsView: creation callback failed:', error); }
      await refreshDocumentList();
      if (!current()) return;
      setSelectedDocId(result.documentId);
    } catch (err: any) {
      if (!current()) return;
      const uncertain = err.name === 'AbortError' || /timed out|uncertain|Invalid managed document create response/.test(err.message ?? '');
      const conflict = /STALE_STATE|DOCUMENT_TITLE_EXISTS|DOCUMENT_REQUEST_REPLAYED|Persisted state changed/.test(err.message ?? '');
      setCreateError(uncertain
        ? 'Creation outcome is uncertain. Reload the catalog and reviewer context before continuing; check whether the document already exists.'
        : conflict ? 'Project changed or this request was already recorded. Your draft is preserved. Reload the catalog and reviewer context, then review it again.'
        : err.message || 'Document creation failed. Your draft is preserved.');
      if (uncertain || conflict) { setCreateRecoveryRequired(true); setCreateConfirmed(false); setCreateVersion(null); }
    } finally { if (current()) setCreateBusy(false); }
  };

  const renderCreateControls = () => projectId === 'PRJ-DOCMONSTAKRAKIN' ? null : (
    <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2">
      <button data-testid="btn-create-document" disabled={!canonicalReady || workflowStep !== 'VIEW' || createBusy}
        onClick={handleOpenCreate} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-40">Create document</button>
      <span className="ml-3 text-xs text-slate-500">Project documents require a configured human reviewer. Saving adds no governance approval.</span>
      {createdNotice && <p role="status" data-testid="document-created-notice" className="text-sm text-emerald-800">{createdNotice}</p>}
      {createOpen && <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="create-document-title" className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
          <h3 id="create-document-title" className="font-bold text-lg">Create project document</h3>
          <p className="text-sm text-slate-600">This draft stays in the project snapshot. Creation confers no governance approval or trust.</p>
          <label className="block text-sm">Title<input data-testid="create-document-title" value={createTitle} maxLength={120} disabled={createBusy} onChange={e => { setCreateTitle(e.target.value); setCreateConfirmed(false); }} className="block w-full border rounded p-2" /></label>
          <div className="flex gap-4">
            <label className="text-sm">Kind<select aria-label="Document kind" value={createKind} disabled={createBusy} onChange={e => { setCreateKind(e.target.value as typeof createKind); setCreateConfirmed(false); }} className="block border rounded p-2">
              {['PRODUCT','REQUIREMENTS','ARCHITECTURE','SECURITY','VERIFICATION','OPERATIONS'].map(kind => <option key={kind}>{kind}</option>)}
            </select></label>
            <label className="text-sm">Format<select aria-label="Document format" value={createFormat} disabled={createBusy} onChange={e => { setCreateFormat(e.target.value as typeof createFormat); setCreateConfirmed(false); }} className="block border rounded p-2"><option value="MARKDOWN">Markdown</option><option value="TEXT">Plain text</option></select></label>
          </div>
          <label className="block text-sm">Content<textarea data-testid="create-document-content" rows={8} value={createContent} maxLength={131072} disabled={createBusy} onChange={e => { setCreateContent(e.target.value); setCreateConfirmed(false); }} className="block w-full border rounded p-2 font-mono text-xs" /></label>
          {createContent && <div data-testid="create-document-preview" className="border rounded p-3 max-h-48 overflow-auto">{createFormat === 'MARKDOWN' ? <MarkdownRenderer content={createContent} /> : <pre className="whitespace-pre-wrap text-xs">{createContent}</pre>}</div>}
          <label className="block text-sm">Reason<input data-testid="create-document-reason" value={createReason} maxLength={500} disabled={createBusy} onChange={e => { setCreateReason(e.target.value); setCreateConfirmed(false); }} className="block w-full border rounded p-2" /></label>
          <p data-testid="create-document-reviewer" className="text-sm text-slate-600">{createContextLoading ? 'Loading reviewer and project state…' : reviewerSession ? `Signed in as ${reviewerSession.name} (${reviewerSession.roles.join(', ')}). Project version: ${createVersion ?? 'reload required'}.` : 'Sign in through the configured reviewer session before creating a document.'}</p>
          {createError && <p role="alert" data-testid="create-document-error" className="text-sm text-rose-700">{createError}</p>}
          <label className="flex gap-2 text-sm"><input data-testid="create-document-confirmation" type="checkbox" checked={createConfirmed} disabled={createBusy || createContextLoading || createRecoveryRequired} onChange={e => setCreateConfirmed(e.target.checked)} />I reviewed this content and confirm creating it in this project.</label>
          <div className="flex flex-wrap gap-3 justify-end">
            <button disabled={createBusy} onClick={() => setCreateOpen(false)} className="border rounded px-3 py-2 text-sm">Cancel</button>
            <button data-testid="btn-reload-create-context" disabled={createBusy || createContextLoading} onClick={async () => { const current = captureContext(); await refreshDocumentList(); if (current()) await loadCreateContext(); }} className="border rounded px-3 py-2 text-sm">Reload catalog and reviewer context</button>
            <button data-testid="btn-confirm-create-document" onClick={handleCreate} disabled={!canonicalReady || createBusy || createContextLoading || createRecoveryRequired || createVersion === null || !createConfirmed || !createTitle.trim() || !createContent.trim() || !createReason.trim() || !createAllowed} className="bg-emerald-600 text-white rounded px-3 py-2 text-sm disabled:opacity-40">{createBusy ? 'Creating…' : 'Confirm and create'}</button>
          </div>
        </div>
      </div>}
    </div>
  );

  // Handle Reload Canonical Content from stale diff (Section 8)
  const handleReloadFromStaleDiff = async () => {
    if (!selectedDocId) return;
    const current = captureContext(selectedDocId);
    setCanonicalRefreshError(null);
    const refreshed = await performCanonicalRefresh(selectedDocId);
    if (!current()) return;
    if (!refreshed) {
      setCanonicalRefreshRequired(true);
      setCanonicalRefreshError('Canonical refresh failed. Reload the latest document before continuing.');
    }
  };

  // Handle Retry Canonical Refresh from banner (Section 4 & 9)
  const handleRetryCanonicalRefresh = async () => {
    if (!selectedDocId) return;
    const current = captureContext(selectedDocId);
    const previousError = canonicalRefreshError;
    const refreshed = await performCanonicalRefresh(selectedDocId);
    if (!current()) return;
    if (!refreshed) {
      setCanonicalRefreshRequired(true);
      setCanonicalRefreshError(previousError || 'Canonical refresh failed. Please try again.');
    }
  };

  // Badge Helpers
  const renderIntegrityBadge = (doc: ControlledDocumentSummary) => {
    switch (doc.integrityStatus) {
      case 'MATCH':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
          >
            MATCH
          </span>
        );
      case 'CHANGED':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-700 border border-amber-200"
          >
            CHANGED
          </span>
        );
      case 'UNPINNED':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200"
          >
            UNPINNED
          </span>
        );
      case 'MISSING':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-rose-50 text-rose-700 border border-rose-200"
          >
            MISSING
          </span>
        );
      default:
        return null;
    }
  };

  const renderEditabilityBadge = (doc: ControlledDocumentSummary) => {
    if (doc.editability === 'CONTROLLED_EDIT') {
      return (
        <span
          data-testid={`badge-editability-${doc.id}`}
          className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700 border border-blue-200"
        >
          CONTROLLED_EDIT
        </span>
      );
    }
    return (
      <span
        data-testid={`badge-editability-${doc.id}`}
        className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500 border border-slate-200"
      >
        READ_ONLY
      </span>
    );
  };

  const isCoordinatedCommit = workflowStep === 'COORDINATED_COMMIT';

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (isCoordinatedCommit) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setWorkspaceTab('PROJECTIONS');
      document.getElementById('tab-dynamic-projections')?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setWorkspaceTab('REPOSITORY');
      document.getElementById('tab-repository-docs')?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setWorkspaceTab('REPOSITORY');
      document.getElementById('tab-repository-docs')?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setWorkspaceTab('PROJECTIONS');
      document.getElementById('tab-dynamic-projections')?.focus();
    }
  };

  const renderRepositoryWorkspace = () => {
    // If no documents available and no list error, show project isolation empty state
    if (!loadingList && !listError && documents.length === 0) {
      return (
        <div data-testid="repository-docs-shell" className="h-[calc(100vh-120px)] flex flex-col">
          {renderCreateControls()}
          <div data-testid="controlled-docs-workspace" className="p-8 text-slate-700">
            <div
              data-testid="controlled-docs-empty"
              className="max-w-xl mx-auto p-6 bg-white border border-slate-200 rounded-xl shadow-xs text-center"
            >
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {projectId === 'PRJ-DOCMONSTAKRAKIN' ? 'No Repository Documentation Available' : 'No project documents yet'}
              </h3>
              <p className="text-sm text-slate-500">
                Project <span className="font-mono text-slate-700">{projectId}</span> has no documents in this catalog.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div data-testid="repository-docs-shell" className="h-[calc(100vh-120px)] flex flex-col">
        {renderCreateControls()}
        <div
          data-testid="controlled-docs-workspace"
          className="flex flex-1 h-full bg-white text-slate-900 border border-slate-200 rounded-xl shadow-xs overflow-hidden"
        >
          {/* Sidebar: Document Catalog */}
          <div
            data-testid="repository-docs-catalog"
            className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col"
          >
            {/* Search Header */}
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  data-testid="docs-search-input"
                  placeholder="Search by ID, title, or path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isCoordinatedCommit}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Catalog List grouped by kind */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {loadingList && (
                <div role="status" className="flex items-center justify-center p-6 text-slate-400 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading catalog...
                </div>
              )}

              {listError && (
                <div
                  data-testid="catalog-error-alert"
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs space-y-2"
                >
                  <div>{listError}</div>
                  <button
                    data-testid="btn-retry-catalog"
                    onClick={refreshDocumentList}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    Retry catalog
                  </button>
                </div>
              )}

              {Object.entries(filteredAndGroupedDocs).map(([kind, docs]) => (
                <div key={kind} data-testid={`kind-group-${kind}`} className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>{kind}</span>
                    <span className="text-slate-400 text-[11px] font-normal">{docs.length}</span>
                  </div>
                  {docs.map((doc) => {
                    const isSelected = doc.id === selectedDocId;
                    return (
                      <button
                        key={doc.id}
                        data-testid={`doc-item-${doc.id}`}
                        disabled={isCoordinatedCommit}
                        onClick={() => {
                          if (!isCoordinatedCommit) setSelectedDocId(doc.id);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg transition-colors text-sm flex flex-col gap-1.5 disabled:opacity-50 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-medium'
                            : 'hover:bg-slate-100/80 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900 truncate">{doc.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">{doc.path}</div>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {renderIntegrityBadge(doc)}
                          {renderEditabilityBadge(doc)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Main View Area */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedDoc ? (
              <>
                {/* Document Header & Metadata */}
                <div className="p-6 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 data-testid="doc-title" className="text-xl font-bold text-slate-900">
                        {selectedDoc.title}
                      </h2>
                      {renderIntegrityBadge(selectedDoc)}
                      {renderEditabilityBadge(selectedDoc)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-mono flex-wrap">
                      <span>ID: {selectedDoc.id}</span>
                      <span>Path: {selectedDoc.path}</span>
                      <span>Authority: {selectedDoc.authority}</span>
                      <span>EOL: {selectedDoc.eol || 'LF'}</span>
                      {selectedDoc.currentSha256 && (
                        <span title={selectedDoc.currentSha256}>
                          SHA: {selectedDoc.currentSha256.slice(0, 8)}...{selectedDoc.currentSha256.slice(-8)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* View / Edit Mode Controls */}
                  <div className="flex items-center gap-2">
                    {workflowStep === 'VIEW' && (
                      <>
                        <div className="bg-slate-100 border border-slate-200 rounded-lg p-0.5 flex items-center text-xs">
                          <button
                            data-testid="btn-toggle-rendered"
                            onClick={() => setIsRawMode(false)}
                            className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                              !isRawMode ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Rendered
                          </button>
                          <button
                            data-testid="btn-toggle-raw"
                            onClick={() => setIsRawMode(true)}
                            className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                              isRawMode ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            <FileCode className="w-3.5 h-3.5" />
                            Raw Source
                          </button>
                        </div>

                        {isEditable && (
                          <button
                            data-testid="btn-edit-document"
                            onClick={handleStartEdit}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Document
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Save Success Banner */}
                {saveSuccess && (
                  <div
                    data-testid="save-success-banner"
                    role="status"
                    className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold">Document update committed successfully!</span>
                        <span className="ml-2 font-mono">
                          Audit ID: {saveSuccess.auditEventId} | State Version: {saveSuccess.stateVersion}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSaveSuccess(null)}
                      className="text-emerald-700 hover:text-emerald-900 text-xs underline cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Canonical Refresh Error Banner with Retry */}
                {canonicalRefreshError && (
                  <div
                    data-testid="canonical-refresh-error"
                    role="alert"
                    className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{canonicalRefreshError}</span>
                    </div>
                    {canonicalRefreshError.includes('Document changed') ? (
                      <button
                        data-testid="btn-reload-canonical"
                        onClick={handleRetryCanonicalRefresh}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reload Canonical Content
                      </button>
                    ) : (
                      <button
                        data-testid="btn-retry-canonical-refresh"
                        onClick={handleRetryCanonicalRefresh}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry canonical refresh
                      </button>
                    )}
                  </div>
                )}

                {/* Uncertain Save Outcome Notice */}
                {uncertainSaveNotice && (
                  <div
                    data-testid="uncertain-save-warning"
                    role="alert"
                    className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{uncertainSaveNotice}</span>
                    </div>
                    <button
                      onClick={() => setUncertainSaveNotice(null)}
                      className="text-amber-700 hover:text-amber-900 text-xs underline cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Mixed-EOL Warning */}
                {contentResponse?.eol === 'MIXED' && (
                  <div
                    data-testid="mixed-eol-warning"
                    role="alert"
                    className="p-3 m-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Editing is unavailable because this document has mixed line endings.</span>
                  </div>
                )}

                {/* Missing Document State */}
                {(selectedDoc.integrityStatus === 'MISSING' || contentError) && (
                  <div
                    data-testid="missing-doc-state"
                    role="alert"
                    className="p-4 m-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center gap-2"
                  >
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-semibold">Document is missing from repository disk (410 Gone).</p>
                      {contentError && (
                        <p className="text-xs text-rose-600 font-mono mt-1">{contentError}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Content Display / 6-Step Workflow Panels */}
                {loadingContent && (
                  <div role="status" className="flex-1 flex items-center justify-center p-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Loading document content...
                  </div>
                )}

                {/* STEP 1: VIEW */}
                {!loadingContent && workflowStep === 'VIEW' && contentResponse && (
                  <>
                    {isRawMode ? (
                      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        <pre
                          data-testid="doc-content-raw"
                          className="max-w-4xl mx-auto font-mono text-xs text-slate-800 whitespace-pre-wrap bg-white p-6 rounded-xl border border-slate-200/80 leading-relaxed shadow-xs"
                        >
                          {contentResponse.content}
                        </pre>
                      </div>
                    ) : (
                      <div
                        className="flex-1 overflow-y-auto p-8 bg-slate-50"
                        data-testid="repository-docs-reader"
                      >
                        <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200/80 p-8 shadow-xs">
                          <MarkdownRenderer
                            content={contentResponse.content}
                            testId="doc-content-rendered"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

              {/* STEP 2: EDIT_DRAFT */}
              {workflowStep === 'EDIT_DRAFT' && (
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4 flex flex-col">
                  <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Step 2: Edit Candidate Draft
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWorkflowStep('VIEW')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        data-testid="btn-preview-diff"
                        onClick={handlePreviewDiff}
                        disabled={diffLoading}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {diffLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Preview Diff
                      </button>
                    </div>
                  </div>

                  {diffError && (
                    <div role="alert" className="max-w-4xl w-full mx-auto p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                      {diffError}
                    </div>
                  )}

                  <textarea
                    data-testid="draft-editor-textarea"
                    value={draftContent}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    className="flex-1 max-w-4xl w-full mx-auto bg-white border border-slate-300 rounded-xl p-4 font-mono text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none min-h-[400px] shadow-xs"
                    placeholder="Enter document markdown or text content..."
                  />
                </div>
              )}

              {/* STEP 3: PREVIEW_DIFF */}
              {workflowStep === 'PREVIEW_DIFF' && diffResponse && (
                <div data-testid="diff-view" className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                  <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Step 3: Preview Structured Diff
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWorkflowStep('EDIT_DRAFT')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        Back to Editor
                      </button>
                      {!diffResponse.isStale && diffResponse.hasChanges && (
                        <button
                          data-testid="btn-validate"
                          onClick={handleValidate}
                          disabled={validationLoading}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {validationLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                          Validate Invariants
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stale Warning & Canonical Reload */}
                  {diffResponse.isStale && (
                    <div
                      data-testid="stale-warning"
                      role="alert"
                      className="max-w-4xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex items-center justify-between shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <p className="font-semibold">Document on disk has changed (Base SHA Stale)</p>
                          <p className="text-xs text-amber-700">
                            The live file has been updated by another process. Please reload canonical content before saving.
                          </p>
                        </div>
                      </div>
                      <button
                        data-testid="btn-reload-canonical"
                        onClick={handleReloadFromStaleDiff}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reload Canonical Content
                      </button>
                    </div>
                  )}

                  {/* No Changes Notice */}
                  {!diffResponse.hasChanges && (
                    <div
                      data-testid="no-changes-detected"
                      className="max-w-4xl mx-auto p-4 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm shadow-xs"
                    >
                      No changes detected.
                    </div>
                  )}

                  {/* Diff Stats */}
                  {diffResponse.hasChanges && (
                    <div className="max-w-4xl mx-auto flex items-center gap-4 text-xs font-mono bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <span className="text-emerald-600 font-bold">+{diffResponse.additions} lines</span>
                      <span className="text-rose-600 font-bold">-{diffResponse.deletions} lines</span>
                      <span className="text-slate-500">Total changed: {diffResponse.changedLines} lines</span>
                    </div>
                  )}

                  {/* Unified Diff */}
                  {diffResponse.hasChanges && (
                    <div className="max-w-4xl mx-auto">
                      <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-100 overflow-x-auto whitespace-pre leading-relaxed shadow-xs">
                        {diffResponse.unifiedDiff}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: VALIDATE */}
              {workflowStep === 'VALIDATE' && validationResponse && (
                <div data-testid="validation-view" className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                  <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Step 4: Structural & Format Invariant Validation
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWorkflowStep('PREVIEW_DIFF')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        Back to Diff
                      </button>
                      {validationResponse.valid && (
                        <button
                          data-testid="btn-proceed-to-save"
                          onClick={handleOpenSaveModal}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Proceed to Save
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Validation Status */}
                  {validationResponse.valid ? (
                    <div className="max-w-4xl mx-auto p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-2 shadow-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>All format and structural validation checks PASSED cleanly.</span>
                    </div>
                  ) : (
                    <div
                      data-testid="validation-errors"
                      role="alert"
                      className="max-w-4xl mx-auto p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm space-y-2 shadow-xs"
                    >
                      <div className="flex items-center gap-2 font-bold text-rose-900">
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>Validation Checks Failed (Save Blocked):</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-xs text-rose-700">
                        {validationResponse.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResponse.warnings.length > 0 && (
                    <div className="max-w-4xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1 shadow-xs">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Warnings:
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-amber-700">
                        {validationResponse.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select a document from the catalog to view or edit.
          </div>
        )}
      </div>

      {/* STEP 5 & 6: CONFIRM_SAVE & COORDINATED_COMMIT (DocSaveModal) */}
      {(workflowStep === 'CONFIRM_SAVE' || workflowStep === 'COORDINATED_COMMIT') && selectedDoc && (
        <div
          data-testid="doc-save-modal"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-save-title"
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-slate-900"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h3 id="modal-save-title" className="font-bold text-slate-900 text-base">
                  Confirm Governance Document Update
                </h3>
              </div>
              {!isCoordinatedCommit && (
                <button
                  onClick={() => setWorkflowStep('VALIDATE')}
                  className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Read-Only Governance Session Info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs text-slate-700">
              {sessionLoading ? (
                <div role="status" className="flex items-center gap-2 text-slate-500">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading governance session...
                </div>
              ) : sessionError ? (
                <div role="alert" className="text-rose-600 font-medium">
                  {sessionError}
                </div>
              ) : reviewerSession ? (
                <>
                  <div data-testid="modal-session-name" className="font-medium text-slate-900">
                    Signed in as: <span className="text-emerald-700">{reviewerSession.name}</span>
                  </div>
                  <div data-testid="modal-session-roles" className="text-slate-500">
                    Roles: <span className="text-slate-700">{reviewerSession.roles.join(', ')}</span>
                  </div>
                </>
              ) : (
                <div data-testid="modal-session-name" role="alert" className="text-amber-700 font-medium">
                  No authenticated governance reviewer session.
                </div>
              )}
            </div>

            {/* Target Document */}
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>Target: <span className="font-mono text-slate-800">{selectedDoc.path}</span></div>
              <div>Document ID: <span className="font-mono text-slate-800">{selectedDoc.id}</span></div>
            </div>

            {/* Reason / Change Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Change Justification / Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                data-testid="modal-save-reason"
                rows={3}
                disabled={isCoordinatedCommit}
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
                placeholder="Enter mandatory justification for updating this controlled document..."
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="human-confirm-checkbox"
                data-testid="modal-confirm-checkbox"
                disabled={isCoordinatedCommit}
                checked={humanConfirmed}
                onChange={(e) => setHumanConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded bg-white border-slate-300 text-emerald-600 focus:ring-0 focus:outline-none disabled:opacity-50"
              />
              <label htmlFor="human-confirm-checkbox" className="text-xs text-slate-700 select-none cursor-pointer">
                Confirm this governance document update and append cryptographic audit record
              </label>
            </div>

            {/* Saving indicator during Step 6 */}
            {isCoordinatedCommit && (
              <div
                data-testid="saving-indicator"
                role="status"
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Executing coordinated document replacement and audit persistence...</span>
              </div>
            )}

            {/* Error Message */}
            {saveError && (
              <div
                data-testid="save-error-banner"
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs"
              >
                {saveError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setWorkflowStep('VALIDATE')}
                disabled={isCoordinatedCommit}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                data-testid="btn-confirm-save"
                onClick={handleConfirmSave}
                disabled={
                  !saveReason.trim() ||
                  !humanConfirmed ||
                  !reviewerSession ||
                  isSaving ||
                  isCoordinatedCommit
                }
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {isCoordinatedCommit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Confirm & Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    );
  };

  if (!dynamicProjectionsProps) {
    return renderRepositoryWorkspace();
  }

  return (
    <div className="space-y-4">
      {/* Dual Workspace Tab Bar */}
      <div
        role="tablist"
        aria-label="Documentation Workspace Navigation"
        className="flex border-b border-slate-200 bg-white px-6 pt-3 gap-4"
      >
        <button
          id="tab-repository-docs"
          role="tab"
          aria-selected={workspaceTab === 'REPOSITORY'}
          aria-controls="panel-repository-docs"
          tabIndex={workspaceTab === 'REPOSITORY' ? 0 : -1}
          disabled={isCoordinatedCommit}
          onClick={() => !isCoordinatedCommit && setWorkspaceTab('REPOSITORY')}
          onKeyDown={handleTabKeyDown}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            workspaceTab === 'REPOSITORY'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <FileText className="w-4 h-4" />
          Repository Documents
        </button>
        <button
          id="tab-dynamic-projections"
          role="tab"
          aria-selected={workspaceTab === 'PROJECTIONS'}
          aria-controls="panel-dynamic-projections"
          tabIndex={workspaceTab === 'PROJECTIONS' ? 0 : -1}
          disabled={isCoordinatedCommit}
          onClick={() => !isCoordinatedCommit && setWorkspaceTab('PROJECTIONS')}
          onKeyDown={handleTabKeyDown}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            workspaceTab === 'PROJECTIONS'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <Layers className="w-4 h-4" />
          Dynamic Projections
        </button>
      </div>

      <div
        id="panel-repository-docs"
        role="tabpanel"
        aria-labelledby="tab-repository-docs"
        hidden={workspaceTab !== 'REPOSITORY'}
        className={workspaceTab !== 'REPOSITORY' ? 'hidden' : undefined}
      >
        {renderRepositoryWorkspace()}
      </div>

      <div
        id="panel-dynamic-projections"
        role="tabpanel"
        aria-labelledby="tab-dynamic-projections"
        hidden={workspaceTab !== 'PROJECTIONS'}
        className={workspaceTab !== 'PROJECTIONS' ? 'hidden' : undefined}
      >
        <DocumentsView
          key={`projections-${dynamicProjectionsProps.project.id}`}
          {...dynamicProjectionsProps}
          canonicalReady={dynamicProjectionsProps.canonicalReady ?? canonicalReady}
        />
      </div>
    </div>
  );
};
