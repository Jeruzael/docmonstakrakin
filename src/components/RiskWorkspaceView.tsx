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
import { projectRiskDisplay } from '../data/riskDisplayProjection';

interface RiskWorkspaceViewProps {
  risks?: Risk[];
  threats?: Threat[];
}

export const RiskFloorReference: React.FC = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 text-xs">
    <h2 className="text-sm font-bold text-slate-900">A-SSDLC Mandatory Risk Floors (Section 15)</h2>
    <p className="text-slate-600">Reference information: this catalog describes policy floors. It does not establish enforcement or applicability for the selected project.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      {[
        { rule: 'Financial transaction processing', floor: 'HIGH minimum' },
        { rule: 'Production secret access', floor: 'CRITICAL minimum' },
        { rule: 'Autonomous production deployment', floor: 'CRITICAL minimum' },
        { rule: 'Safety-critical action', floor: 'CRITICAL minimum' },
        { rule: 'Privileged identity management', floor: 'HIGH minimum' },
        { rule: 'Sensitive healthcare / HIPAA info', floor: 'HIGH minimum' },
      ].map((reference) => (
        <div key={reference.rule} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
          <div className="font-bold text-slate-800">{reference.rule}</div>
          <div className="text-slate-700 font-mono text-[11px] font-bold">{reference.floor}</div>
          <span className="text-[10px] text-slate-500">Reference only · Project applicability unavailable</span>
        </div>
      ))}
    </div>
  </div>
);

export const RiskWorkspaceView: React.FC<RiskWorkspaceViewProps> = ({ risks = [], threats = [] }) => {
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'THREATS' | 'FLOORS'>('REGISTER');

  const topRisk = risks[0];
  const riskDisplay = projectRiskDisplay(topRisk);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Risk Overview Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stored Risk Record</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-3">
              <span>{topRisk ? riskDisplay.title : 'No risk record is available.'}</span>
            </h1>
            <p className="text-xs text-slate-600 mt-2">First stored risk record. This is a stored record summary.</p>
            {topRisk && <p className="text-xs text-slate-600 mt-1">Displayed record: <strong>{riskDisplay.id}</strong></p>}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">Inherent Risk</span>
              <span className="text-2xl font-extrabold text-slate-900 block mt-0.5">{riskDisplay.inherentScore}</span>
              <span className="text-[10px] font-semibold text-slate-700">{riskDisplay.inherentLevel}</span>
              <span className="text-[10px] text-slate-600 block">Likelihood {riskDisplay.inherentLikelihood} · Impact {riskDisplay.inherentImpact}</span>
            </div>
            <div className="text-slate-300 font-bold text-lg">→</div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">Residual Risk</span>
              <span className="text-2xl font-extrabold text-slate-900 block mt-0.5">{riskDisplay.residualScore}</span>
              <span className="text-[10px] font-semibold text-slate-700">{riskDisplay.residualLevel}</span>
              <span className="text-[10px] text-slate-600 block">Likelihood {riskDisplay.residualLikelihood} · Impact {riskDisplay.residualImpact}</span>
            </div>
          </div>
        </div>

        {/* Contributing Drivers */}
        <div>
          <span className="text-xs font-semibold text-slate-600 block mb-2">
            Stored Risk Contributors:
          </span>
          <div className="flex flex-wrap gap-2">
            {riskDisplay.drivers.map((driver, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <span>{driver}</span>
              </span>
            ))}
            {riskDisplay.drivers.length === 0 && <span className="text-xs text-slate-500">Unavailable</span>}
          </div>
        </div>
        <div className="text-xs text-slate-600 space-y-1">
          <p>Stored floor flag: {riskDisplay.floorFlag}{riskDisplay.floorReason !== undefined && <> — {riskDisplay.floorReason}</>}</p>
          <p>A stored floor flag does not establish enforcement.</p>
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
                {risks.map((risk, index) => {
                  const display = projectRiskDisplay(risk);
                  return <tr key={`${display.id}-${index}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{display.id}</td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-bold text-slate-900">{display.title}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{display.description}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{display.inherentLikelihood}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{display.inherentImpact}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-slate-900">{display.inherentScore}</span>{' '}
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200 ml-1">
                        {display.inherentLevel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-800 border-slate-200"
                      >
                        {display.residualLevel} ({display.residualScore})
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700 text-[10px]">
                        {display.treatment}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-purple-700">
                      {display.controls.length ? display.controls.join(', ') : 'Unavailable'}
                    </td>
                  </tr>;
                })}
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
      {activeTab === 'FLOORS' && <RiskFloorReference />}
    </div>
  );
};
