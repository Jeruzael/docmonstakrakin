import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FilePlus,
  FileMinus,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Clock,
  ArrowRight,
  Terminal,
  Eye,
  Lock,
  Layers,
  FileText,
  X,
} from 'lucide-react';
import {
  Project,
  GitFileStatus,
  GitCommitRecord,
  PreCommitCheck,
  RepoStatusResponse,
} from '../types';

interface RepositoryViewProps {
  project: Project;
}

export const RepositoryView: React.FC<RepositoryViewProps> = ({ project }) => {
  const [repoStatus, setRepoStatus] = useState<RepoStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [diffStaged, setDiffStaged] = useState(false);
  const [activeTab, setActiveTab] = useState<'WORKING_TREE' | 'PRE_COMMIT_CHECKS' | 'COMMITS'>('WORKING_TREE');

  // Commit Form
  const [commitMessage, setCommitMessage] = useState('');
  const [commitAuthor, setCommitAuthor] = useState('Lead Engineer');
  const [committing, setCommitting] = useState(false);
  const [commitSuccessReceipt, setCommitSuccessReceipt] = useState<any | null>(null);

  // Branch Dialog
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  // Copy feedback
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchRepoStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/repo/status?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setRepoStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch repo status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepoStatus();
  }, [project.id]);

  const handleStageFile = async (path?: string, all = false) => {
    try {
      await fetch('/api/repo/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, all }),
      });
      await fetchRepoStatus();
      if (selectedFile === path) {
        handleViewDiff(path, true);
      }
    } catch (err) {
      console.error('Failed to stage:', err);
    }
  };

  const handleUnstageFile = async (path?: string, all = false) => {
    try {
      await fetch('/api/repo/unstage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, all }),
      });
      await fetchRepoStatus();
      if (selectedFile === path) {
        handleViewDiff(path, false);
      }
    } catch (err) {
      console.error('Failed to unstage:', err);
    }
  };

  const handleViewDiff = async (file: string, staged: boolean) => {
    try {
      setSelectedFile(file);
      setDiffStaged(staged);
      const res = await fetch(`/api/repo/diff?file=${encodeURIComponent(file)}&staged=${staged}`);
      if (res.ok) {
        const data = await res.json();
        setDiffContent(data.diff || '(No textual changes detected)');
      }
    } catch (err) {
      console.error('Failed to fetch diff:', err);
      setDiffContent('Error loading file diff.');
    }
  };

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) return;

    try {
      setCommitting(true);
      const res = await fetch('/api/repo/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commitMessage,
          author: commitAuthor,
          projectId: project.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCommitSuccessReceipt(data);
        setCommitMessage('');
        await fetchRepoStatus();
      }
    } catch (err) {
      console.error('Commit failed:', err);
    } finally {
      setCommitting(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    try {
      const res = await fetch('/api/repo/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchName: newBranchName, create: true }),
      });
      if (res.ok) {
        setShowBranchModal(false);
        setNewBranchName('');
        await fetchRepoStatus();
      }
    } catch (err) {
      console.error('Branch creation failed:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const isPreCommitReady = repoStatus?.checks.every(
    (c) => !c.blocking || c.status === 'PASSED'
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Workspace Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">A-SSDLC Phase 5</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200 font-bold">
              LOCAL GIT INTEGRATION & HOOKS
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            Repository & Code Provenance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic local git branch tracking, pre-push security gates, and Merkle-backed state commit receipts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRepoStatus}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
          </button>
          <button
            onClick={() => setShowBranchModal(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" /> Branch Manager
          </button>
        </div>
      </div>

      {/* Repository Telemetry Bar */}
      {repoStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Active Branch
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                {repoStatus.branch}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
              <GitCommit className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                HEAD Commit
              </span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold text-slate-900">
                  {repoStatus.headCommit}
                </span>
                <button
                  onClick={() => copyToClipboard(repoStatus.headCommit)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400"
                >
                  {copiedHash === repoStatus.headCommit ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg ${
                repoStatus.isClean ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {repoStatus.isClean ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Working Tree Status
              </span>
              <span
                className={`text-xs font-bold ${
                  repoStatus.isClean ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {repoStatus.isClean ? 'CLEAN (In Sync)' : 'DIRTY (Uncommitted Changes)'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg ${
                isPreCommitReady ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {isPreCommitReady ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Pre-Push Security Gate
              </span>
              <span
                className={`text-xs font-bold ${
                  isPreCommitReady ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {isPreCommitReady ? 'GATES SATISFIED' : 'POLICY BLOCKED'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 px-2 text-xs font-semibold gap-2">
        <button
          onClick={() => setActiveTab('WORKING_TREE')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'WORKING_TREE'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Working Tree & Staging</span>
          {repoStatus && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
              {repoStatus.stagedFiles.length + repoStatus.unstagedFiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('PRE_COMMIT_CHECKS')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'PRE_COMMIT_CHECKS'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>A-SSDLC Policy Hooks</span>
          {repoStatus && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                isPreCommitReady ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {repoStatus.checks.filter((c) => c.status === 'PASSED').length}/{repoStatus.checks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('COMMITS')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'COMMITS'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitCommit className="w-4 h-4" />
          <span>Commit Provenance Log</span>
          {repoStatus && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
              {repoStatus.recentCommits.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: WORKING TREE & STAGING */}
      {activeTab === 'WORKING_TREE' && repoStatus && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Staging & Changes list (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Staged Files Box */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Staged Changes</span>
                  <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    {repoStatus.stagedFiles.length}
                  </span>
                </div>
                {repoStatus.stagedFiles.length > 0 && (
                  <button
                    onClick={() => handleUnstageFile(undefined, true)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Unstage All
                  </button>
                )}
              </div>

              {repoStatus.stagedFiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No staged changes ready for commit.
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {repoStatus.stagedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => handleViewDiff(file.path, true)}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        selectedFile === file.path && diffStaged
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                          {file.status[0]}
                        </span>
                        <span className="font-mono text-[11px] text-slate-800 truncate">
                          {file.path}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnstageFile(file.path);
                        }}
                        className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-200"
                      >
                        Unstage
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unstaged / Modified Files Box */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Unstaged Changes</span>
                  <span className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-bold">
                    {repoStatus.unstagedFiles.length}
                  </span>
                </div>
                {repoStatus.unstagedFiles.length > 0 && (
                  <button
                    onClick={() => handleStageFile(undefined, true)}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800"
                  >
                    Stage All
                  </button>
                )}
              </div>

              {repoStatus.unstagedFiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Working tree is clean.
                </div>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {repoStatus.unstagedFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => handleViewDiff(file.path, false)}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        selectedFile === file.path && !diffStaged
                          ? 'bg-amber-50 border border-amber-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">
                          {file.status[0]}
                        </span>
                        <span className="font-mono text-[11px] text-slate-800 truncate">
                          {file.path}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStageFile(file.path);
                        }}
                        className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 px-1.5 py-0.5 rounded hover:bg-emerald-50"
                      >
                        Stage
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commit Box */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-emerald-600" /> Commit Staged Snapshot
              </h3>

              <form onSubmit={handleCommit} className="space-y-3 text-xs">
                <div>
                  <textarea
                    rows={2}
                    placeholder="feat(auth): add hardware token isolation and session rotation"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono text-[11px]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">Author:</span>
                    <input
                      type="text"
                      value={commitAuthor}
                      onChange={(e) => setCommitAuthor(e.target.value)}
                      className="px-2 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-800 w-32"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={committing || repoStatus.stagedFiles.length === 0 || !commitMessage.trim()}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      repoStatus.stagedFiles.length > 0 && commitMessage.trim()
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    {committing ? 'Recording...' : 'Commit with Receipt'}
                  </button>
                </div>
              </form>

              {commitSuccessReceipt && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Commit Recorded to Audit Ledger
                  </span>
                  <div className="font-mono text-[11px] text-emerald-800">
                    Hash: <strong>{commitSuccessReceipt.shortHash}</strong> | {commitSuccessReceipt.message}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Diff Inspector (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Diff Inspector
                </span>
                <span className="font-mono text-xs font-bold text-slate-800">
                  {selectedFile ? `${selectedFile} (${diffStaged ? 'Staged' : 'Unstaged'})` : 'No file selected'}
                </span>
              </div>

              {selectedFile && (
                <div className="flex items-center gap-2">
                  {diffStaged ? (
                    <button
                      onClick={() => handleUnstageFile(selectedFile)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
                    >
                      Unstage File
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStageFile(selectedFile)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200"
                    >
                      Stage File
                    </button>
                  )}
                </div>
              )}
            </div>

            {diffContent ? (
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto max-h-[500px] leading-relaxed select-text">
                {diffContent.split('\n').map((line, idx) => {
                  let color = 'text-slate-300';
                  if (line.startsWith('+') && !line.startsWith('+++')) color = 'text-emerald-400 bg-emerald-950/40';
                  if (line.startsWith('-') && !line.startsWith('---')) color = 'text-red-400 bg-red-950/40';
                  if (line.startsWith('@@')) color = 'text-cyan-400 font-bold';
                  return (
                    <div key={idx} className={color}>
                      {line || ' '}
                    </div>
                  );
                })}
              </pre>
            ) : (
              <div className="p-16 text-center text-xs text-slate-400">
                Select an unstaged or staged file from the left panel to inspect git line diffs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: A-SSDLC PRE-COMMIT & PRE-PUSH POLICY HOOKS */}
      {activeTab === 'PRE_COMMIT_CHECKS' && repoStatus && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Git Hook Policy Enforcement
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    isPreCommitReady
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {isPreCommitReady ? 'PRE-COMMIT HOOKS PASSED' : 'COMMITS / PUSHES BLOCKED'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Automated Security & Governance Pre-Flight Checks
              </h2>
              <p className="text-xs text-slate-500">
                Every code mutation must satisfy cryptographic secret isolation, risk floor constraints, and requirement traceability before commit or push.
              </p>
            </div>

            <button
              onClick={fetchRepoStatus}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-run Pre-Commit Suite
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {repoStatus.checks.map((chk) => (
              <div
                key={chk.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                  chk.status === 'PASSED'
                    ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                    : chk.status === 'WARNING'
                    ? 'bg-amber-50/40 border-amber-200 text-amber-950'
                    : 'bg-red-50/40 border-red-200 text-red-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  {chk.status === 'PASSED' && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {chk.status === 'WARNING' && (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  {chk.status === 'FAILED' && (
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{chk.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 bg-white/60 rounded border border-slate-200 font-semibold">
                        {chk.category}
                      </span>
                      {chk.blocking && (
                        <span className="text-[10px] font-bold text-red-700 uppercase">
                          • Blocking Gate
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-80 mt-1">{chk.details}</p>
                  </div>
                </div>

                <span className="font-mono text-xs font-bold uppercase shrink-0">
                  {chk.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COMMIT PROVENANCE LOG */}
      {activeTab === 'COMMITS' && repoStatus && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Commit Provenance & State Hash Ledger
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cryptographic timeline linking git commit objects to project state snapshots and audit signatures.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {repoStatus.recentCommits.length} Recorded Commits
            </span>
          </div>

          <div className="space-y-3">
            {repoStatus.recentCommits.map((cmt) => (
              <div
                key={cmt.hash}
                className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {cmt.shortHash}
                    </span>
                    <span className="font-bold text-slate-900 text-xs truncate">
                      {cmt.message}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Author: <strong className="text-slate-600">{cmt.author}</strong></span>
                    <span>•</span>
                    <span>Timestamp: {cmt.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    <Lock className="w-3 h-3 text-emerald-600" /> Tamper-Evident Receipt
                  </span>
                  <button
                    onClick={() => copyToClipboard(cmt.hash)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    title="Copy full SHA-256 commit hash"
                  >
                    {copiedHash === cmt.hash ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BRANCH MODAL */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-slate-900" /> Create / Switch Git Branch
              </h3>
              <button
                onClick={() => setShowBranchModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Branch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. feature/adr-002-crypto-keys"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Checkout Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
