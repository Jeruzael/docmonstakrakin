import { ImportReviewView } from './ImportReviewView';
import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Code2,
  FileCheck2,
  Bot,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  Info,
} from 'lucide-react';
import { Project, Requirement, Risk, WorkItem, ContextPackageMode, Feature, ADR, StandardControl } from '../types.js';
import { compileContextPackage } from '../data/contextPackageCompiler.js';

interface PromptCompilerViewProps {
  features?: Feature[]; adrs?: ADR[]; standards?: StandardControl[];
  onImported: () => void; onNavigate: (view: string) => void;
  project: Project;
  requirements?: Requirement[];
  risks?: Risk[];
  workItems?: WorkItem[];
}

export const PromptCompilerView: React.FC<PromptCompilerViewProps> = ({
  project, features=[], adrs=[], standards=[], onImported, onNavigate,
  requirements = [],
  risks = [],
  workItems = [],
}) => {
  const [tab, setTab] = useState<'COMPILER' | 'IMPORT'>('COMPILER');
  const [mode, setMode] = useState<ContextPackageMode>('TASK_CONTEXT');
  const [role, setRole] = useState('Architect');
  const [task, setTask] = useState('Architecture Planning & Boundary Definition');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string>(workItems[0]?.id || '');
  const [provider, setProvider] = useState('Gemini');
  const [copied, setCopied] = useState(false);

  const activeWorkItem = workItems.find((w) => w.id === selectedWorkItemId) || workItems[0];

  // Compile context package using deterministic compiler with full requirement statements
  let compiledPackage;
  try { compiledPackage = compileContextPackage({
    project,
    role,
    taskTitle: task,
    activeWorkItem,
    requirements,
      features, adrs, standards, workItems,
    risks,
    mode,
    includeOmissionReport: true,
  }); } catch(e) {compiledPackage = {compiledPrompt: 'Generation rejected: '+(e as Error).message, handoffReady:false, omissionsReport:[], tokenEstimate:0};}

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledPackage.compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Control Plane</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200 font-bold">
              LEAST-CONTEXT SCOPING
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Prompt Compiler & Context Package Generator
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SUMMARY, TASK_CONTEXT and FULL_BASELINE are outbound context packages. External agents return structured proposals. Tracking changes only after validation, human review and canonical acceptance.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setTab('COMPILER')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              tab === 'COMPILER' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Prompt Compiler
          </button>
          <button
            onClick={() => setTab('IMPORT')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              tab === 'IMPORT' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manual AI Import & Review
          </button>
        </div>
      </div>

      {/* 1. Compiler Tab */}
      {tab === 'COMPILER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Options (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Package Scoping & Parameters
            </h3>

            {/* Scoping Mode Selection */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Package Scoping Mode</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['SUMMARY', 'TASK_CONTEXT', 'FULL_BASELINE'] as ContextPackageMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-2 px-1 text-center rounded-lg border font-semibold text-[11px] transition-all cursor-pointer ${
                      mode === m
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m === 'TASK_CONTEXT' ? 'Task Context' : m === 'SUMMARY' ? 'Summary' : 'Full Baseline'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {mode === 'TASK_CONTEXT' && 'Scoped specifically to the active task with relevant requirements, risks, and omission audit.'}
                {mode === 'SUMMARY' && 'High-level project summary and key milestone counts for lightweight briefing.'}
                {mode === 'FULL_BASELINE' && 'Complete unreduced requirements and risk registers with full statements.'}
              </p>
            </div>

            {mode === 'TASK_CONTEXT' && workItems.length > 0 && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Active Work Item</label>
                <select
                  value={selectedWorkItemId}
                  onChange={(e) => setSelectedWorkItemId(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                >
                  {workItems.map((w) => (
                    <option key={w.id} value={w.id}>
                      [{w.id}] {w.title} ({w.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Agent Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Architect">Architect</option>
                <option value="Security Reviewer">Security Reviewer</option>
                <option value="Developer">Developer Agent</option>
                <option value="Threat Modeler">Threat Modeler</option>
                <option value="Adversarial Reviewer">Adversarial Reviewer</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Task Objective</label>
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Model / Runtime</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Gemini">Google Gemini 2.5 Flash / Pro (JSON Schema)</option>
                <option value="Codex">OpenAI / Claude / Codex</option>
                <option value="Manual">Manual Inspection / Offline Package</option>
              </select>
            </div>

            {/* Omissions Report Callout */}
            {compiledPackage.omissionsReport.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <span className="font-bold text-amber-800 text-[11px] block">
                  Least-Context Omission Report:
                </span>
                {compiledPackage.omissionsReport.map((om, idx) => (
                  <div key={idx} className="text-[10px] text-amber-700">
                    • {om}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compiled Output (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Compiled Context Package</h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                  ~{compiledPackage.tokenEstimate} tokens
                </span>
              </div>
              <button
                disabled={compiledPackage.handoffReady === false}
                onClick={handleCopy}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied to Clipboard!' : 'Copy Compiled Package'}
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[480px] whitespace-pre-wrap">
              {compiledPackage.compiledPrompt}
            </pre>

            <div className="text-[11px] text-slate-400 pt-2 flex items-center justify-between">
              <span>Full requirement statements included • Zero redaction violations</span>
              <span>Output schema: <strong>canonical-v1.0</strong></span>
            </div>
          </div>
        </div>
      )}

      {tab === 'IMPORT' && <ImportReviewView projectId={project.id} onImported={onImported} onNavigate={onNavigate}/>}
    </div>
  );
};
