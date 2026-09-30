/**
 * ControlledDocsView.tsx
 * Repository Documents UI & Controlled Documentation Workspace (DMK-195 Task 10 / Task 10A).
 * Enforces secure markdown rendering, lockfile conventions, and hardened 6-step edit workflow.
 */

import { useState, useEffect, useMemo, useCallback, type ComponentProps, type FC } from 'react';
import ReactMarkdown from 'react-markdown';
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
  ExternalLink,
  FileText,
  Layers,
} from 'lucide-react';
import type {
  ControlledDocumentSummary,
  DocumentContentResponse,
  DocumentDiffResponse,
  DocumentValidationResponse,
  DocumentSaveResponse,
  ReviewerSessionInfo,
} from '../types.js';
import { createControlledDocsLoader } from '../data/controlledDocsClient.js';
import { DocumentsView } from './DocumentsView';

type DynamicProjectionsProps = ComponentProps<typeof DocumentsView>;

export interface ControlledDocsViewProps {
  projectId: string;
  loader?: ReturnType<typeof createControlledDocsLoader>;
  dynamicProjectionsProps?: DynamicProjectionsProps;
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
  loader,
  dynamicProjectionsProps,
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
  const [contentResponse, setContentResponse] = useState<DocumentContentResponse | null>(null);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      api.invalidate();
    };
  }, [api]);

  // Load document list whenever projectId changes
  const refreshDocumentList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const list = await api.loadDocumentList(projectId);
      setDocuments(list);
      if (list.length > 0) {
        setSelectedDocId((prev) => (prev && list.some((d) => d.id === prev) ? prev : list[0].id));
      } else {
        setSelectedDocId(null);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setListError(err.message || 'Failed to load document catalog.');
      }
    } finally {
      setLoadingList(false);
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
    setValidationResponse(null);
    setValidationError(null);
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
    refreshDocumentList();
  }, [projectId, refreshDocumentList, api]);

  // Selected document content loader and synchronous selection reset (Section 10)
  useEffect(() => {
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
      try {
        const [freshContent, freshList] = await Promise.all([
          api.loadDocumentContent(projectId, docId),
          api.loadDocumentList(projectId),
        ]);
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
    setDiffLoading(true);
    setDiffError(null);
    try {
      const diff = await api.requestDiff(projectId, selectedDoc.id, draftContent, baseSha256);
      setDiffResponse(diff);
      setWorkflowStep('PREVIEW_DIFF');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setDiffError(err.message || 'Failed to compute diff.');
      }
    } finally {
      setDiffLoading(false);
    }
  };

  // Handle Validate transition (strictly guarded against stale or empty changes)
  const handleValidate = async () => {
    if (!selectedDoc || !diffResponse || diffResponse.isStale || !diffResponse.hasChanges) {
      return;
    }
    setValidationLoading(true);
    setValidationError(null);
    try {
      const val = await api.requestValidate(projectId, selectedDoc.id, draftContent);
      setValidationResponse(val);
      setWorkflowStep('VALIDATE');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setValidationError(err.message || 'Validation request failed.');
      }
    } finally {
      setValidationLoading(false);
    }
  };

  // Handle Proceed to Save (open modal and load session state)
  const handleOpenSaveModal = async () => {
    setSaveError(null);
    setSaveReason('');
    setHumanConfirmed(false);
    setReviewerSession(null);
    setSessionError(null);
    setSessionLoading(true);
    setWorkflowStep('CONFIRM_SAVE');

    try {
      const session = await api.loadGovernanceSession();
      setReviewerSession(session);
    } catch {
      setSessionError('Unable to load governance reviewer session.');
    } finally {
      setSessionLoading(false);
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

    let saveResp: DocumentSaveResponse | null = null;
    try {
      saveResp = await api.requestSave({
        projectId,
        documentId: selectedDoc.id,
        candidateContent: draftContent,
        baseSha256,
        reason: saveReason.trim(),
        humanConfirmed: true,
      });

      // Commit phase ends immediately when requestSave resolves (Section 2)
      setSaveSuccess(saveResp);
      setIsSaving(false);
      setWorkflowStep('VIEW');

      // Lock editing during post-save refresh (Section 3)
      setCanonicalRefreshRequired(true);
    } catch (err: any) {
      setIsSaving(false);
      const isUncertain = err.name === 'AbortError' || err.message?.includes('timed out');
      if (isUncertain) {
        setWorkflowStep('VIEW');
        setCanonicalRefreshRequired(true);
        const refreshed = await performCanonicalRefresh(selectedDoc.id);
        if (refreshed) {
          setUncertainSaveNotice('Save outcome was uncertain; canonical state was reloaded.');
        } else {
          setCanonicalRefreshRequired(true);
          setCanonicalRefreshError('Save outcome is uncertain and canonical refresh failed.');
        }
        return;
      }

      const isDocStale = typeof err.message === 'string' && err.message.includes('DOCUMENT_STALE');
      if (isDocStale) {
        setWorkflowStep('VIEW');
        setCanonicalRefreshRequired(true);
        setCanonicalRefreshError('Document changed before save. Reload canonical state before editing again.');
        return;
      }

      setWorkflowStep('CONFIRM_SAVE');
      setSaveError(err.message || 'Failed to save document.');
      return;
    }

    // Step B: Canonical-refresh phase (separated from save)
    const refreshed = await performCanonicalRefresh(selectedDoc.id);
    if (!refreshed) {
      setCanonicalRefreshRequired(true);
      setCanonicalRefreshError('Save succeeded, but canonical refresh failed.');
    }
  };

  // Handle Reload Canonical Content from stale diff (Section 8)
  const handleReloadFromStaleDiff = async () => {
    if (!selectedDocId) return;
    setCanonicalRefreshError(null);
    const refreshed = await performCanonicalRefresh(selectedDocId);
    if (!refreshed) {
      setCanonicalRefreshRequired(true);
      setCanonicalRefreshError('Canonical refresh failed. Reload the latest document before continuing.');
    }
  };

  // Handle Retry Canonical Refresh from banner (Section 4 & 9)
  const handleRetryCanonicalRefresh = async () => {
    if (!selectedDocId) return;
    const previousError = canonicalRefreshError;
    const refreshed = await performCanonicalRefresh(selectedDocId);
    if (!refreshed) {
      setCanonicalRefreshRequired(true);
      setCanonicalRefreshError(previousError || 'Canonical refresh failed. Please try again.');
    }
  };

  // Safe Link Renderer for ReactMarkdown
  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children, ...props }: any) => {
        if (!href) return <a className="text-slate-400 underline cursor-not-allowed" {...props}>{children}</a>;
        const normalized = href.trim().toLowerCase();
        if (
          normalized.startsWith('javascript:') ||
          normalized.startsWith('data:') ||
          normalized.startsWith('vbscript:')
        ) {
          return <a className="text-slate-400 underline cursor-not-allowed" {...props}>{children}</a>;
        }

        const isExternal = normalized.startsWith('http://') || normalized.startsWith('https://');
        if (isExternal) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-1"
              {...props}
            >
              {children}
              <ExternalLink className="w-3 h-3 inline-block" />
            </a>
          );
        }

        return (
          <a href={href} className="text-sky-400 hover:text-sky-300 underline" {...props}>
            {children}
          </a>
        );
      },
    }),
    []
  );

  // Badge Helpers
  const renderIntegrityBadge = (doc: ControlledDocumentSummary) => {
    switch (doc.integrityStatus) {
      case 'MATCH':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-950 text-emerald-300 border border-emerald-800"
          >
            MATCH
          </span>
        );
      case 'CHANGED':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-950 text-amber-300 border border-amber-800"
          >
            CHANGED
          </span>
        );
      case 'UNPINNED':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700"
          >
            UNPINNED
          </span>
        );
      case 'MISSING':
        return (
          <span
            data-testid={`badge-integrity-${doc.id}`}
            className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-950 text-rose-300 border border-rose-800"
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
          className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-950 text-blue-300 border border-blue-800"
        >
          CONTROLLED_EDIT
        </span>
      );
    }
    return (
      <span
        data-testid={`badge-editability-${doc.id}`}
        className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700"
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
        <div data-testid="controlled-docs-workspace" className="p-8 text-slate-200">
          <div
            data-testid="controlled-docs-empty"
            className="max-w-xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-lg text-center"
          >
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-100 mb-2">
              No Repository Documentation Available
            </h3>
            <p className="text-sm text-slate-400">
              Project <span className="font-mono text-slate-300">{projectId}</span> does not have a
              repository-controlled documentation registry configured.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        data-testid="controlled-docs-workspace"
        className="flex h-[calc(100vh-120px)] bg-slate-950 text-slate-100 border border-slate-800 rounded-lg overflow-hidden"
      >
      {/* Sidebar: Document Catalog */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              data-testid="docs-search-input"
              placeholder="Search by ID, title, or path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isCoordinatedCommit}
              className="w-full bg-slate-950 border border-slate-700 rounded pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-50"
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
              className="p-3 bg-rose-950/80 border border-rose-800 rounded text-rose-300 text-xs space-y-2"
            >
              <div>{listError}</div>
              <button
                data-testid="btn-retry-catalog"
                onClick={refreshDocumentList}
                className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white text-xs font-semibold rounded"
              >
                Retry catalog
              </button>
            </div>
          )}

          {Object.entries(filteredAndGroupedDocs).map(([kind, docs]) => (
            <div key={kind} data-testid={`kind-group-${kind}`} className="space-y-1">
              <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{kind}</span>
                <span className="text-slate-500 text-[11px] font-normal">{docs.length}</span>
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
                    className={`w-full text-left p-2.5 rounded transition-colors text-sm flex flex-col gap-1.5 disabled:opacity-50 ${
                      isSelected
                        ? 'bg-sky-950/80 border border-sky-600/60 text-sky-100'
                        : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">{doc.title}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate">{doc.path}</div>
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
      <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
        {selectedDoc ? (
          <>
            {/* Document Header & Metadata */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 data-testid="doc-title" className="text-lg font-bold text-slate-100">
                    {selectedDoc.title}
                  </h2>
                  {renderIntegrityBadge(selectedDoc)}
                  {renderEditabilityBadge(selectedDoc)}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 font-mono flex-wrap">
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
                    <div className="bg-slate-900 border border-slate-700 rounded flex p-0.5 text-xs">
                      <button
                        data-testid="btn-toggle-rendered"
                        onClick={() => setIsRawMode(false)}
                        className={`px-3 py-1 rounded flex items-center gap-1.5 ${
                          !isRawMode ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Rendered
                      </button>
                      <button
                        data-testid="btn-toggle-raw"
                        onClick={() => setIsRawMode(true)}
                        className={`px-3 py-1 rounded flex items-center gap-1.5 ${
                          isRawMode ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
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
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
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
                className="p-3 bg-emerald-950/70 border-b border-emerald-800 text-emerald-200 text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold">Document update committed successfully!</span>
                    <span className="ml-2 font-mono">
                      Audit ID: {saveSuccess.auditEventId} | State Version: {saveSuccess.stateVersion}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSaveSuccess(null)}
                  className="text-emerald-400 hover:text-emerald-200 text-xs underline"
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
                className="p-3 bg-amber-950/80 border-b border-amber-800 text-amber-200 text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{canonicalRefreshError}</span>
                </div>
                {canonicalRefreshError.includes('Document changed') ? (
                  <button
                    data-testid="btn-reload-canonical"
                    onClick={handleRetryCanonicalRefresh}
                    className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white font-semibold rounded flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reload Canonical Content
                  </button>
                ) : (
                  <button
                    data-testid="btn-retry-canonical-refresh"
                    onClick={handleRetryCanonicalRefresh}
                    className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white font-semibold rounded flex items-center gap-1"
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
                className="p-3 bg-amber-950/80 border-b border-amber-800 text-amber-200 text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{uncertainSaveNotice}</span>
                </div>
                <button
                  onClick={() => setUncertainSaveNotice(null)}
                  className="text-amber-400 hover:text-amber-200 text-xs underline"
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
                className="p-3 m-4 bg-amber-950/60 border border-amber-800 rounded text-amber-200 text-xs flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Editing is unavailable because this document has mixed line endings.</span>
              </div>
            )}

            {/* Missing Document State */}
            {(selectedDoc.integrityStatus === 'MISSING' || contentError) && (
              <div
                data-testid="missing-doc-state"
                role="alert"
                className="p-4 m-4 bg-rose-950/60 border border-rose-800 rounded text-rose-200 text-sm flex items-center gap-2"
              >
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <p className="font-semibold">Document is missing from repository disk (410 Gone).</p>
                  {contentError && (
                    <p className="text-xs text-rose-300 font-mono mt-1">{contentError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Content Display / 6-Step Workflow Panels */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingContent && (
                <div role="status" className="flex items-center justify-center p-12 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading document content...
                </div>
              )}

              {/* STEP 1: VIEW */}
              {workflowStep === 'VIEW' && contentResponse && (
                <div>
                  {isRawMode ? (
                    <pre
                      data-testid="doc-content-raw"
                      className="font-mono text-sm text-slate-200 whitespace-pre-wrap bg-slate-900/60 p-4 rounded border border-slate-800"
                    >
                      {contentResponse.content}
                    </pre>
                  ) : (
                    <div
                      data-testid="doc-content-rendered"
                      className="prose prose-invert max-w-none text-slate-200"
                    >
                      <ReactMarkdown components={markdownComponents}>
                        {contentResponse.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: EDIT_DRAFT */}
              {workflowStep === 'EDIT_DRAFT' && (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Step 2: Edit Candidate Draft
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWorkflowStep('VIEW')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded"
                      >
                        Cancel
                      </button>
                      <button
                        data-testid="btn-preview-diff"
                        onClick={handlePreviewDiff}
                        disabled={diffLoading}
                        className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
                      >
                        {diffLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Preview Diff
                      </button>
                    </div>
                  </div>

                  {diffError && (
                    <div role="alert" className="p-3 bg-rose-950 border border-rose-800 rounded text-rose-300 text-xs">
                      {diffError}
                    </div>
                  )}

                  <textarea
                    data-testid="draft-editor-textarea"
                    value={draftContent}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    className="flex-1 w-full bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none min-h-[400px]"
                    placeholder="Enter document markdown or text content..."
                  />
                </div>
              )}

              {/* STEP 3: PREVIEW_DIFF */}
              {workflowStep === 'PREVIEW_DIFF' && diffResponse && (
                <div data-testid="diff-view" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Step 3: Preview Structured Diff
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWorkflowStep('EDIT_DRAFT')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded"
                      >
                        Back to Editor
                      </button>
                      {!diffResponse.isStale && diffResponse.hasChanges && (
                        <button
                          data-testid="btn-validate"
                          onClick={handleValidate}
                          disabled={validationLoading}
                          className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
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
                      className="p-4 bg-amber-950/80 border border-amber-700 rounded text-amber-200 text-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <p className="font-semibold">Document on disk has changed (Base SHA Stale)</p>
                          <p className="text-xs text-amber-300">
                            The live file has been updated by another process. Please reload canonical content before saving.
                          </p>
                        </div>
                      </div>
                      <button
                        data-testid="btn-reload-canonical"
                        onClick={handleReloadFromStaleDiff}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded shrink-0 flex items-center gap-1"
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
                      className="p-4 bg-slate-900 border border-slate-800 rounded text-slate-400 text-sm"
                    >
                      No changes detected.
                    </div>
                  )}

                  {/* Diff Stats */}
                  {diffResponse.hasChanges && (
                    <div className="flex items-center gap-4 text-xs font-mono bg-slate-900/60 p-3 rounded border border-slate-800">
                      <span className="text-emerald-400 font-bold">+{diffResponse.additions} lines</span>
                      <span className="text-rose-400 font-bold">-{diffResponse.deletions} lines</span>
                      <span className="text-slate-400">Total changed: {diffResponse.changedLines} lines</span>
                    </div>
                  )}

                  {/* Unified Diff */}
                  {diffResponse.hasChanges && (
                    <pre className="p-4 bg-slate-900 border border-slate-800 rounded font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre">
                      {diffResponse.unifiedDiff}
                    </pre>
                  )}
                </div>
              )}

              {/* STEP 4: VALIDATE */}
              {workflowStep === 'VALIDATE' && validationResponse && (
                <div data-testid="validation-view" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Step 4: Structural & Format Invariant Validation
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWorkflowStep('PREVIEW_DIFF')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded"
                      >
                        Back to Diff
                      </button>
                      {validationResponse.valid && (
                        <button
                          data-testid="btn-proceed-to-save"
                          onClick={handleOpenSaveModal}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Proceed to Save
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Validation Status */}
                  {validationResponse.valid ? (
                    <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded text-emerald-300 text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>All format and structural validation checks PASSED cleanly.</span>
                    </div>
                  ) : (
                    <div
                      data-testid="validation-errors"
                      role="alert"
                      className="p-4 bg-rose-950/70 border border-rose-800 rounded text-rose-200 text-sm space-y-2"
                    >
                      <div className="flex items-center gap-2 font-bold text-rose-300">
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        <span>Validation Checks Failed (Save Blocked):</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-xs">
                        {validationResponse.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResponse.warnings.length > 0 && (
                    <div className="p-4 bg-amber-950/60 border border-amber-800 rounded text-amber-300 text-xs space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Warnings:
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {validationResponse.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a document from the catalog to view or edit.
          </div>
        )}
      </div>

      {/* STEP 5 & 6: CONFIRM_SAVE & COORDINATED_COMMIT (DocSaveModal) */}
      {(workflowStep === 'CONFIRM_SAVE' || workflowStep === 'COORDINATED_COMMIT') && selectedDoc && (
        <div
          data-testid="doc-save-modal"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-save-title"
            className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-400" />
                <h3 id="modal-save-title" className="font-bold text-slate-100 text-base">
                  Confirm Governance Document Update
                </h3>
              </div>
              {!isCoordinatedCommit && (
                <button
                  onClick={() => setWorkflowStep('VALIDATE')}
                  className="text-slate-400 hover:text-slate-200 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Read-Only Governance Session Info */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded space-y-1 text-xs text-slate-300">
              {sessionLoading ? (
                <div role="status" className="flex items-center gap-2 text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading governance session...
                </div>
              ) : sessionError ? (
                <div role="alert" className="text-rose-400 font-medium">
                  {sessionError}
                </div>
              ) : reviewerSession ? (
                <>
                  <div data-testid="modal-session-name" className="font-medium text-slate-200">
                    Signed in as: <span className="text-sky-300">{reviewerSession.name}</span>
                  </div>
                  <div data-testid="modal-session-roles" className="text-slate-400">
                    Roles: <span className="text-slate-300">{reviewerSession.roles.join(', ')}</span>
                  </div>
                </>
              ) : (
                <div data-testid="modal-session-name" role="alert" className="text-amber-400 font-medium">
                  No authenticated governance reviewer session.
                </div>
              )}
            </div>

            {/* Target Document */}
            <div className="text-xs text-slate-400 space-y-0.5">
              <div>Target: <span className="font-mono text-slate-200">{selectedDoc.path}</span></div>
              <div>Document ID: <span className="font-mono text-slate-200">{selectedDoc.id}</span></div>
            </div>

            {/* Reason / Change Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Change Justification / Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                data-testid="modal-save-reason"
                rows={3}
                disabled={isCoordinatedCommit}
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
                placeholder="Enter mandatory justification for updating this controlled document..."
                className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-50"
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
                className="mt-0.5 h-4 w-4 rounded bg-slate-950 border-slate-700 text-sky-600 focus:ring-0 focus:outline-none disabled:opacity-50"
              />
              <label htmlFor="human-confirm-checkbox" className="text-xs text-slate-300 select-none">
                Confirm this governance document update and append cryptographic audit record
              </label>
            </div>

            {/* Saving indicator during Step 6 */}
            {isCoordinatedCommit && (
              <div
                data-testid="saving-indicator"
                role="status"
                className="p-3 bg-sky-950/80 border border-sky-800 rounded text-sky-200 text-xs flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Executing coordinated document replacement and audit persistence...</span>
              </div>
            )}

            {/* Error Message */}
            {saveError && (
              <div role="alert" className="p-3 bg-rose-950 border border-rose-800 rounded text-rose-300 text-xs">
                {saveError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setWorkflowStep('VALIDATE')}
                disabled={isCoordinatedCommit}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition disabled:opacity-50"
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
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
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
        className="flex border-b border-slate-800 bg-slate-900/60 px-4 pt-2 gap-2"
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
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            workspaceTab === 'REPOSITORY'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'
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
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            workspaceTab === 'PROJECTIONS'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'
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
        <DocumentsView key={`projections-${dynamicProjectionsProps.project.id}`} {...dynamicProjectionsProps} />
      </div>
    </div>
  );
};
