import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Shield,
  ShieldCheck,
  FileCode,
  Terminal,
  RefreshCw,
  Cpu,
  ArrowRight,
  AlertTriangle,
  Sliders,
  ExternalLink,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { Project, AgentRole, AgentRunLog } from '../types';

interface AgentCenterViewProps {
  project: Project;
  onNavigateToCompiler?: () => void;
}

export const AgentCenterView: React.FC<AgentCenterViewProps> = ({ project, onNavigateToCompiler }) => {
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [runs, setRuns] = useState<AgentRunLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AgentRole | null>(null);
  const [activeTab, setActiveTab] = useState<'ROLES' | 'RUN_LOGS'>('ROLES');

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${project.id}/agents`);
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
        setRuns(data.runs || []);
        if (selectedRole) {
          const updated = (data.roles || []).find((r: AgentRole) => r.id === selectedRole.id);
          if (updated) setSelectedRole(updated);
        } else if (data.roles?.length > 0) {
          setSelectedRole(data.roles[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentData();
  }, [project.id]);

  const handleRunAgent = async (roleId: string) => {
    try {
      setRunningAgentId(roleId);
      const res = await fetch(`/api/projects/${project.id}/agents/${roleId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchAgentData();
        setActiveTab('RUN_LOGS');
      }
    } catch (err) {
      console.error('Agent run failed:', err);
    } finally {
      setRunningAgentId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Workspace Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">A-SSDLC Phase 6</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200 font-bold">
              AUTONOMOUS ASSURANCE AGENT FLEET
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            Agent Center & Specialized Autonomous Roles
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Governed multi-agent roles executing zero-trust threat audits, ASVS compliance cross-referencing, test synthesis, and deterministic policy checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAgentData}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Fleet
          </button>
          {onNavigateToCompiler && (
            <button
              onClick={onNavigateToCompiler}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Prompt Compiler & Proposals
            </button>
          )}
        </div>
      </div>

      {/* Fleet Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Agent Roles
            </span>
            <span className="text-lg font-bold text-purple-700 font-mono">
              {roles.length} Specialized Roles
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Fleet Runs
            </span>
            <span className="text-lg font-bold text-blue-700 font-mono">
              {roles.reduce((acc, r) => acc + (r.totalRuns || 0), 0)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Execution Isolation
            </span>
            <span className="text-xs font-bold text-emerald-800">
              Sandboxed Nonce Boundary
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Inference Tiers
            </span>
            <span className="text-xs font-bold text-slate-800">
              Deterministic + Gemini 2.5
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 px-2 text-xs font-semibold gap-2">
        <button
          onClick={() => setActiveTab('ROLES')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ROLES'
              ? 'border-purple-600 text-purple-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Agent Fleet Roles</span>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('RUN_LOGS')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'RUN_LOGS'
              ? 'border-purple-600 text-purple-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Execution Run Audit Log</span>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
            {runs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: AGENT ROLES & CONFIGURATION */}
      {activeTab === 'ROLES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Roles list (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {roles.map((role) => {
              const isSelected = selectedRole?.id === role.id;
              const isRunning = runningAgentId === role.id;
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {role.id}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          {role.category}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {role.modelTier === 'DETERMINISTIC_RULES' ? 'Zero-LLM' : 'Gemini 2.5'}
                        </span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 leading-snug">
                        {role.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {role.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRunAgent(role.id);
                        }}
                        disabled={isRunning}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                          isRunning
                            ? 'bg-purple-200 text-purple-700 cursor-wait'
                            : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                        }`}
                      >
                        <Play className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
                        {isRunning ? 'Running...' : 'Execute'}
                      </button>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        {role.totalRuns || 0} runs executed
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Detailed Role Blueprint & Prompt Contract (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-5">
            {selectedRole ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">{selectedRole.id}</span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        {selectedRole.category}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {selectedRole.modelTier}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 mt-1">
                      {selectedRole.name}
                    </h2>
                  </div>

                  <button
                    onClick={() => handleRunAgent(selectedRole.id)}
                    disabled={runningAgentId === selectedRole.id}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {runningAgentId === selectedRole.id ? 'Running Task...' : 'Dispatch Agent Run'}
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Role Mission & Scope
                    </span>
                    <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {selectedRole.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Canonical Output Structure
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 block mt-0.5">
                        {selectedRole.outputType}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Temperature / Variance
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 block mt-0.5">
                        {selectedRole.temperature.toFixed(2)} (Deterministic)
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Injected Input Entities (Least-Privilege Context)
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedRole.inputEntities.map((entity, i) => (
                        <span
                          key={i}
                          className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200 font-semibold"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      System Prompt Directive & Safety Guardrails
                    </span>
                    <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {selectedRole.promptTemplate}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-16 text-center text-xs text-slate-400">
                Select an agent role to inspect its system prompt and parameters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EXECUTION RUN AUDIT LOGS */}
      {activeTab === 'RUN_LOGS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Autonomous Run Audit & Verification Proof
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Full chronological ledger of agent task invocations, response validation statuses, and token metrics.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">
              {runs.length} Recorded Invocations
            </span>
          </div>

          <div className="space-y-3">
            {runs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No recorded agent runs yet. Trigger a task from the Fleet Roles tab.
              </div>
            ) : (
              runs.map((run) => (
                <div
                  key={run.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-colors space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-800 rounded border border-purple-200">
                        {run.id}
                      </span>
                      <span className="font-bold text-slate-900">
                        {run.agentName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-slate-400">
                        {run.durationMs}ms • {run.tokensUsed} tokens
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          run.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : run.status === 'PENDING_HUMAN_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px]">
                    {run.outputSummary}
                  </p>

                  {run.dualAgentReview && (
                    <div className="mt-2 p-3 bg-indigo-50/60 rounded-lg border border-indigo-200/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
                            DMK-081 Dual-Agent Cross-Review
                          </span>
                          <span className="text-[10px] font-mono text-indigo-700">
                            (Reviewer: {run.dualAgentReview.reviewerAgentName})
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            run.dualAgentReview.passed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          VERDICT: {run.dualAgentReview.verdict}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-900/90 font-mono bg-white/80 p-2 rounded border border-indigo-100">
                        {run.dualAgentReview.critique}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Timestamp: {run.timestamp}</span>
                    {run.proposalCount > 0 && (
                      <span className="font-bold text-emerald-700">
                        Generated {run.proposalCount} candidate proposals for review
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
