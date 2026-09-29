/**
 * ControlledDocsView.tsx
 * Repository Documents UI & Controlled Documentation Workspace (DMK-195 Task 10).
 * Enforces secure markdown rendering, lockfile conventions, and 6-step edit workflow.
 */

import { useState, useEffect, useMemo, useCallback, type FC } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  FileText,
  Search,
  Edit3,
  Eye,
  FileCode,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Lock,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type {
  ControlledDocumentSummary,
  ControlledDocumentKind,
  DocumentContentResponse,
  DocumentDiffResponse,
  DocumentValidationResponse,
  DocumentSaveResponse,
  ReviewerSessionInfo,
} from '../types.js';
import { createControlledDocsLoader } from '../data/controlledDocsClient.js';

export interface ControlledDocsViewProps {
  projectId: string;
  loader?: ReturnType<typeof createControlledDocsLoader>;
}

type WorkflowStep = 'VIEW' | 'EDIT_DRAFT' | 'PREVIEW_DIFF' | 'VALIDATE' | 'CONFIRM_SAVE';

export const ControlledDocsView: FC<ControlledDocsViewProps> = ({
  projectId,
  loader,
}) => {
  // Stable API loader
  const api = useMemo(() => loader ?? createControlledDocsLoader(), [loader]);

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

  // Save Modal State
  const [reviewerSession, setReviewerSession] = useState<ReviewerSessionInfo | null>(null);
  const [saveReason, setSaveReason] = useState('');
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<DocumentSaveResponse | null>(null);

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
      // Auto-select first doc if none selected or current selection no longer exists
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

  useEffect(() => {
    // Reset state on project change
    api.invalidate();
    setSelectedDocId(null);
    setContentResponse(null);
    setWorkflowStep('VIEW');
    setDraftContent('');
    setDiffResponse(null);
    setValidationResponse(null);
    setSaveSuccess(null);
    refreshDocumentList();
  }, [projectId, refreshDocumentList, api]);

  // Load selected document content
  const loadContent = useCallback(
    async (docId: string) => {
      setLoadingContent(true);
      setContentError(null);
      setSaveSuccess(null);
      try {
        const resp = await api.loadDocumentContent(projectId, docId);
        setContentResponse(resp);
        setDraftContent(resp.content);
        setBaseSha256(resp.rawSha256);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setContentError(err.message || 'Failed to load document content.');
          setContentResponse(null);
        }
      } finally {
        setLoadingContent(false);
      }
    },
    [api, projectId]
  );

  useEffect(() => {
    if (selectedDocId) {
      setWorkflowStep('VIEW');
      setDiffResponse(null);
      setValidationResponse(null);
      loadContent(selectedDocId);
    } else {
      setContentResponse(null);
    }
  }, [selectedDocId, loadContent]);

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

  // Handle Edit Draft transition
  const handleStartEdit = () => {
    if (!contentResponse) return;
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

  // Handle Validate transition
  const handleValidate = async () => {
    if (!selectedDoc) return;
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

  // Handle Proceed to Save (open modal)
  const handleOpenSaveModal = async () => {
    setSaveError(null);
    setSaveReason('');
    setHumanConfirmed(false);
    try {
      const session = await api.loadGovernanceSession();
      setReviewerSession(session);
    } catch {
      setReviewerSession(null);
    }
    setWorkflowStep('CONFIRM_SAVE');
  };

  // Handle Save Execution (Step 6)
  const handleConfirmSave = async () => {
    if (!selectedDoc || !saveReason.trim() || !humanConfirmed) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const resp = await api.requestSave({
        projectId,
        documentId: selectedDoc.id,
        candidateContent: draftContent,
        baseSha256,
        reason: saveReason.trim(),
        humanConfirmed: true,
      });

      setSaveSuccess(resp);
      setWorkflowStep('VIEW');

      // Post-Save Lifecycle:
      // 1. Reload canonical content
      const freshContent = await api.loadDocumentContent(projectId, selectedDoc.id);
      setContentResponse(freshContent);
      setDraftContent(freshContent.content);
      setBaseSha256(freshContent.rawSha256);

      // 2. Refresh document list catalog
      const freshList = await api.loadDocumentList(projectId);
      setDocuments(freshList);

      // 3. Clear diff, validation state
      setDiffResponse(null);
      setValidationResponse(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setSaveError('Save timed out or was aborted. Please reload canonical content to verify current status.');
      } else {
        setSaveError(err.message || 'Failed to save document.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Reload Canonical
  const handleReloadCanonical = async () => {
    if (!selectedDocId) return;
    await loadContent(selectedDocId);
    setWorkflowStep('VIEW');
    setDiffResponse(null);
    setValidationResponse(null);
  };

  // Safe Link Renderer for ReactMarkdown
  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children, ...props }: any) => {
        if (!href) return <a className="text-slate-400 underline cursor-not-allowed" {...props}>{children}</a>;
        const normalized = href.trim().toLowerCase();
        // Block dangerous schemes
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

  // Badge Helper
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
            className="px-2 py-0.5 text-xs font-semibold rounded bg-sky-950 text-sky-300 border border-sky-800"
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

  // If no documents available for this project, show project isolation empty state
  if (!loadingList && documents.length === 0) {
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
              className="w-full bg-slate-950 border border-slate-700 rounded pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Catalog List grouped by kind */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loadingList && (
            <div className="flex items-center justify-center p-6 text-slate-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading catalog...
            </div>
          )}

          {listError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded text-rose-300 text-xs">
              {listError}
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
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-2.5 rounded transition-colors text-sm flex flex-col gap-1.5 ${
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

                    {selectedDoc.editability === 'CONTROLLED_EDIT' && (
                      <button
                        data-testid="btn-edit-document"
                        onClick={handleStartEdit}
                        disabled={selectedDoc.integrityStatus === 'MISSING'}
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
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

            {/* Error or Missing Banner */}
            {contentError && (
              <div className="p-4 m-4 bg-rose-950/60 border border-rose-800 rounded text-rose-200 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{contentError}</span>
              </div>
            )}

            {/* Content Display / 6-Step Workflow Panels */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingContent && (
                <div className="flex items-center justify-center p-12 text-slate-400">
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
                    <div className="p-3 bg-rose-950 border border-rose-800 rounded text-rose-300 text-xs">
                      {diffError}
                    </div>
                  )}

                  <textarea
                    data-testid="draft-editor-textarea"
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
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
                      <button
                        data-testid="btn-validate"
                        onClick={handleValidate}
                        disabled={validationLoading}
                        className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
                      >
                        {validationLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Validate Invariants
                      </button>
                    </div>
                  </div>

                  {/* Stale Warning & Canonical Reload */}
                  {diffResponse.isStale && (
                    <div
                      data-testid="stale-warning"
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
                        onClick={handleReloadCanonical}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded shrink-0 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reload Canonical Content
                      </button>
                    </div>
                  )}

                  {/* Diff Stats */}
                  <div className="flex items-center gap-4 text-xs font-mono bg-slate-900/60 p-3 rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold">+{diffResponse.additions} lines</span>
                    <span className="text-rose-400 font-bold">-{diffResponse.deletions} lines</span>
                    <span className="text-slate-400">Total changed: {diffResponse.changedLines} lines</span>
                  </div>

                  {/* Unified Diff */}
                  <pre className="p-4 bg-slate-900 border border-slate-800 rounded font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre">
                    {diffResponse.unifiedDiff || 'No changes detected.'}
                  </pre>
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

      {/* STEP 5: CONFIRM_SAVE MODAL (DocSaveModal) */}
      {workflowStep === 'CONFIRM_SAVE' && selectedDoc && (
        <div
          data-testid="doc-save-modal"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-slate-100 text-base">
                  Confirm Governance Document Update
                </h3>
              </div>
              <button
                onClick={() => setWorkflowStep('VALIDATE')}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Read-Only Governance Session Info */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded space-y-1 text-xs text-slate-300">
              <div data-testid="modal-session-name" className="font-medium text-slate-200">
                Signed in as: <span className="text-sky-300">{reviewerSession?.name || 'Authorized Operator'}</span>
              </div>
              <div data-testid="modal-session-roles" className="text-slate-400">
                Roles: <span className="text-slate-300">{reviewerSession?.roles?.join(', ') || 'Reviewer'}</span>
              </div>
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
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
                placeholder="Enter mandatory justification for updating this controlled document..."
                className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="human-confirm-checkbox"
                data-testid="modal-confirm-checkbox"
                checked={humanConfirmed}
                onChange={(e) => setHumanConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded bg-slate-950 border-slate-700 text-sky-600 focus:ring-0 focus:outline-none"
              />
              <label htmlFor="human-confirm-checkbox" className="text-xs text-slate-300 select-none">
                Confirm this governance document update and append cryptographic audit record
              </label>
            </div>

            {/* Error Message */}
            {saveError && (
              <div className="p-3 bg-rose-950 border border-rose-800 rounded text-rose-300 text-xs">
                {saveError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setWorkflowStep('VALIDATE')}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition"
              >
                Cancel
              </button>
              <button
                data-testid="btn-confirm-save"
                onClick={handleConfirmSave}
                disabled={!saveReason.trim() || !humanConfirmed || isSaving}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded flex items-center gap-1.5 transition"
              >
                {isSaving ? (
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
