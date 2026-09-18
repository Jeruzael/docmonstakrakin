import React, { useState } from 'react';
import {
  ShieldAlert,
  Flame,
  Lock,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  FileCheck,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Risk, Threat } from '../types';

interface RiskWorkspaceViewProps {
  risks?: Risk[];
  threats?: Threat[];
}

export const RiskWorkspaceView: React.FC<RiskWorkspaceViewProps> = ({ risks = [], threats = [] }) => {
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'THREATS' | 'FLOORS'>('REGISTER');

  const topRisk = risks[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Risk Overview Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">A-SSDLC Risk Classification</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">v0.1 Rulebook</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-3">
              <span>Overall Project Risk:</span>
              <span className="text-red-700 bg-red-50 border border-red-200 text-sm px-2.5 py-0.5 rounded-full font-bold">
                ● HIGH (Residual)
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-red-600 uppercase block">Inherent Risk</span>
              <span className="text-2xl font-extrabold text-red-900 block mt-0.5">18 / 25</span>
              <span className="text-[10px] font-semibold text-red-700">● CRITICAL</span>
            </div>
            <div className="text-slate-300 font-bold text-lg">→</div>
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-amber-600 uppercase block">Residual Risk</span>
              <span className="text-2xl font-extrabold text-amber-900 block mt-0.5">10 / 25</span>
              <span className="text-[10px] font-semibold text-amber-700">● HIGH</span>
            </div>
          </div>
        </div>

        {/* Contributing Drivers */}
        <div>
          <span className="text-xs font-semibold text-slate-600 block mb-2">
            Deterministic Contributing Drivers:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Public API Exposure', delta: '+3' },
              { label: 'Financial / Transaction Data', delta: '+4' },
              { label: 'User & Machine Authentication', delta: '+2' },
              { label: 'Agent Tool & Shell Capabilities', delta: '+3' },
              { label: 'Production Credential Access', delta: '+5' },
            ].map((d, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <span>{d.label}</span>
                <span className="font-mono font-bold text-red-600 bg-red-50 px-1 py-0.2 rounded text-[10px]">
                  {d.delta}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-2 text-xs font-semibold gap-2">
        <button
          onClick={() => setActiveTab('REGISTER')}
          className={`py-2.5 px-4 border-b-2 transition-colors ${
            activeTab === 'REGISTER'
              ? 'border-emerald-600 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Risk Register ({risks.length})
        </button>
        <button
          onClick={() => setActiveTab('THREATS')}
          className={`py-2.5 px-4 border-b-2 transition-colors ${
            activeTab === 'THREATS'
              ? 'border-emerald-600 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Threat Model ({threats.length})
        </button>
        <button
          onClick={() => setActiveTab('FLOORS')}
          className={`py-2.5 px-4 border-b-2 transition-colors ${
            activeTab === 'FLOORS'
              ? 'border-emerald-600 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Mandatory Risk Floors
        </button>
      </div>

      {/* Tab Content: Risk Register */}
      {activeTab === 'REGISTER' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Risk ID</th>
                  <th className="py-3 px-4">Title & Description</th>
                  <th className="py-3 px-4">Likelihood</th>
                  <th className="py-3 px-4">Impact</th>
                  <th className="py-3 px-4">Inherent Score</th>
                  <th className="py-3 px-4">Residual Level</th>
                  <th className="py-3 px-4">Treatment</th>
                  <th className="py-3 px-4">Governing Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {risks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{risk.id}</td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-bold text-slate-900">{risk.title}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{risk.description}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{risk.inherentLikelihood} / 5</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{risk.inherentImpact} / 5</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-slate-900">{risk.inherentScore}</span>{' '}
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-100 ml-1">
                        {risk.inherentLevel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          risk.residualLevel === 'HIGH'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        ● {risk.residualLevel} ({risk.residualScore})
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 text-[10px]">
                        {risk.treatment}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-purple-700">
                      {risk.controls.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Threat Model */}
      {activeTab === 'THREATS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {threats.map((threat) => (
            <div
              key={threat.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                  {threat.id}
                </span>
                <span className="text-xs font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded">
                  ● {threat.riskLevel}
                </span>
              </div>

              <h3 className="font-bold text-slate-900 text-sm">{threat.title}</h3>

              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-400">Attack Surface:</span>{' '}
                  <span className="text-slate-800 font-medium">{threat.attackSurface}</span>
                </div>
                <div>
                  <span className="text-slate-400">Target Asset:</span>{' '}
                  <span className="text-slate-800 font-medium">{threat.asset}</span>
                </div>
                <div>
                  <span className="text-slate-400">Impact:</span>{' '}
                  <span className="text-slate-800 font-medium">{threat.impact}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">Mitigations:</span>
                <div className="space-y-1 text-xs">
                  {threat.mitigations.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-600 bg-slate-50 p-2 rounded">
                      <span className="truncate pr-2">{m.title}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                          m.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Mandatory Risk Floors */}
      {activeTab === 'FLOORS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900">A-SSDLC Mandatory Risk Floors (Section 15)</h2>
          <p className="text-slate-600">
            Certain project capabilities automatically enforce minimum risk classifications that cannot be manually reduced by users without recorded risk acceptance.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              { rule: 'Financial transaction processing', floor: 'HIGH minimum', status: 'ACTIVE in OmniPay' },
              { rule: 'Production secret access', floor: 'CRITICAL minimum', status: 'ACTIVE in Atlas' },
              { rule: 'Autonomous production deployment', floor: 'CRITICAL minimum', status: 'BLOCKED' },
              { rule: 'Safety-critical action', floor: 'CRITICAL minimum', status: 'NOT_TRIGGERED' },
              { rule: 'Privileged identity management', floor: 'HIGH minimum', status: 'ACTIVE in Atlas' },
              { rule: 'Sensitive healthcare / HIPAA info', floor: 'HIGH minimum', status: 'NOT_TRIGGERED' },
            ].map((rf, idx) => (
              <div key={idx} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{rf.rule}</div>
                  <div className="text-red-700 font-mono text-[11px] font-bold mt-0.5">{rf.floor}</div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                  {rf.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
