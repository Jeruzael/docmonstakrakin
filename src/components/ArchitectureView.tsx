import { RequestSignoff } from './RequestSignoff';
import React, { useState } from 'react';
import {
  Layers,
  FileCheck2,
  Shield,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Server,
  Lock,
  Cpu,
  Globe,
  Database,
  X,
  FileText,
  BadgeAlert,
  Check,
  ShieldCheck,
} from 'lucide-react';
import {
  Project,
  ADR,
  ADRStatus,
  ArchitectureComponent,
  TrustZone,
  Requirement,
  Risk,
} from '../types';

interface ArchitectureViewProps {
  project: Project;
  adrs?: ADR[];
  components?: ArchitectureComponent[];
  requirements?: Requirement[];
  risks?: Risk[];
  onAddADR: (adr: Partial<ADR>) => Promise<void>;
  onUpdateADRStatus: (adrId: string, status: ADRStatus) => Promise<void>;
  onAddComponent: (comp: Partial<ArchitectureComponent>) => Promise<void>;
  onOpenOverrideModal: (gate: string) => void;
}

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  project,
  adrs = [],
  components = [],
  requirements = [],
  risks = [],
  onAddADR,
  onUpdateADRStatus,
  onAddComponent,
  onOpenOverrideModal,
}) => {
  const [activeTab, setActiveTab] = useState<'ADRS' | 'TOPOLOGY' | 'GATE'>('ADRS');
  const [adrFilter, setAdrFilter] = useState<string>('ALL');
  const [adrSearch, setAdrSearch] = useState('');
  const [selectedAdr, setSelectedAdr] = useState<ADR | null>(adrs[0] || null);
  const [selectedComp, setSelectedComp] = useState<ArchitectureComponent | null>(null);

  // Modals
  const [showNewAdrModal, setShowNewAdrModal] = useState(false);
  const [showNewCompModal, setShowNewCompModal] = useState(false);

  // Form states for new ADR
  const [newAdrTitle, setNewAdrTitle] = useState('');
  const [newAdrContext, setNewAdrContext] = useState('');
  const [newAdrDecision, setNewAdrDecision] = useState('');
  const [newAdrPositives, setNewAdrPositives] = useState('');
  const [newAdrNegatives, setNewAdrNegatives] = useState('');
  const [newAdrRisks, setNewAdrRisks] = useState('');
  const [newAdrReqs, setNewAdrReqs] = useState<string[]>([]);

  // Form states for new Component
  const [newCompName, setNewCompName] = useState('');
  const [newCompCategory, setNewCompCategory] = useState<'CLIENT' | 'GATEWAY' | 'SERVICE' | 'DATASTORE' | 'EXTERNAL'>('SERVICE');
  const [newCompTrustZone, setNewCompTrustZone] = useState<TrustZone>('INTERNAL_SECURE');
  const [newCompTech, setNewCompTech] = useState('');
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompClassification, setNewCompClassification] = useState<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'>('INTERNAL');

  // Filtered ADRs
  const filteredAdrs = (adrs || []).filter((a) => {
    if (adrFilter !== 'ALL' && a.status !== adrFilter) return false;
    if (adrSearch) {
      const q = adrSearch.toLowerCase();
      return (
        a.id.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.context.toLowerCase().includes(q) ||
        a.decision.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate Architecture Gate Readiness
  const acceptedAdrsCount = adrs.filter((a) => a.status === 'ACCEPTED').length;
  const criticalRisksWithAdrOrControl = risks.filter(
    (r) => r.inherentLevel === 'CRITICAL' || r.inherentLevel === 'HIGH'
  ).every((r) => r.controls.length > 0 || adrs.some((a) => a.linkedRisks.includes(r.id)));

  const componentsCoverReqs = requirements
    .filter((req) => req.priority === 'HIGH' || req.priority === 'CRITICAL')
    .every((req) => components.some((c) => c.assignedRequirements.includes(req.id)));

  const hasRestrictedIsolation = components
    .filter((c) => c.trustZone === 'RESTRICTED_DATA')
    .every((c) => c.outboundProtocols.some((p) => p.toLowerCase().includes('none') || p.toLowerCase().includes('local')));

  const gatePassCount = [
    acceptedAdrsCount >= 3,
    criticalRisksWithAdrOrControl,
    components.length >= 4,
    hasRestrictedIsolation,
  ].filter(Boolean).length;

  const isGatePassed = gatePassCount === 4;

  const handleCreateAdr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdrTitle.trim() || !newAdrDecision.trim()) return;

    await onAddADR({
      title: newAdrTitle,
      context: newAdrContext,
      decision: newAdrDecision,
      consequences: {
        positive: newAdrPositives ? newAdrPositives.split('\n').filter(Boolean) : [],
        negative: newAdrNegatives ? newAdrNegatives.split('\n').filter(Boolean) : [],
        risks: newAdrRisks ? newAdrRisks.split('\n').filter(Boolean) : [],
      },
      linkedRequirements: newAdrReqs,
    });

    setNewAdrTitle('');
    setNewAdrContext('');
    setNewAdrDecision('');
    setNewAdrPositives('');
    setNewAdrNegatives('');
    setNewAdrRisks('');
    setNewAdrReqs([]);
    setShowNewAdrModal(false);
  };

  const handleCreateComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim() || !newCompTech.trim()) return;

    await onAddComponent({
      name: newCompName,
      category: newCompCategory,
      trustZone: newCompTrustZone,
      technology: newCompTech,
      description: newCompDesc,
      dataClassification: newCompClassification,
      inboundProtocols: ['HTTPS / gRPC'],
      outboundProtocols: ['Internal IPC'],
      securityControls: ['Policy Interceptor', 'Mutual TLS'],
    });

    setNewCompName('');
    setNewCompTech('');
    setNewCompDesc('');
    setShowNewCompModal(false);
  };

  const getStatusBadge = (status: ADRStatus) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PROPOSED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DEPRECATED':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'SUPERSEDED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getTrustZoneBadge = (zone: TrustZone) => {
    switch (zone) {
      case 'INTERNET':
        return { label: 'Internet / Untrusted', color: 'bg-red-50 text-red-700 border-red-200' };
      case 'DMZ':
        return { label: 'DMZ / Ingress Edge', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'INTERNAL_SECURE':
        return { label: 'Internal Secure Core', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'RESTRICTED_DATA':
        return { label: 'Restricted Data Tier', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {adrs.filter(a=>a.status==='PROPOSED').map(a=><div key={a.id} className="flex justify-between items-center border rounded p-3"><span>{a.title}</span><RequestSignoff projectId={project.id} targetEntityId={a.id} targetEntityType="ADR" requestedBy={project.owner}/></div>)}

      {/* Workspace Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">A-SSDLC Phase 3</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200 font-bold">
              ARCHITECTURE & ADRS
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            Software Architecture & Decision Records
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically bound ADR lifecycle, component trust boundary isolation, and phase exit verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewAdrModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Propose ADR
          </button>
          <button
            onClick={() => setShowNewCompModal(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Server className="w-3.5 h-3.5" /> Register Component
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex border-b border-slate-200 px-2 text-xs font-semibold gap-2">
        <button
          onClick={() => setActiveTab('ADRS')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'ADRS'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Decision Records (ADRs)</span>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
            {adrs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('TOPOLOGY')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'TOPOLOGY'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Trust Boundaries & Topology</span>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
            {components.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('GATE')}
          className={`py-2.5 px-4 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'GATE'
              ? 'border-emerald-600 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Architecture Exit Gate</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              isGatePassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {gatePassCount}/4
          </span>
        </button>
      </div>

      {/* 1. ADRs TAB */}
      {activeTab === 'ADRS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: ADR List (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ADRs by title or ID..."
                  value={adrSearch}
                  onChange={(e) => setAdrSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <select
                value={adrFilter}
                onChange={(e) => setAdrFilter(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700"
              >
                <option value="ALL">All Status</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="PROPOSED">Proposed</option>
                <option value="SUPERSEDED">Superseded</option>
                <option value="DEPRECATED">Deprecated</option>
              </select>
            </div>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredAdrs.map((adr) => {
                const isSelected = selectedAdr?.id === adr.id;
                return (
                  <div
                    key={adr.id}
                    onClick={() => setSelectedAdr(adr)}
                    className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {adr.id}
                        </span>
                        <span className="text-[10px] text-slate-400">{adr.date}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${getStatusBadge(
                          adr.status
                        )}`}
                      >
                        {adr.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 mt-2 line-clamp-1">
                      {adr.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {adr.decision}
                    </p>

                    <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>Author: {adr.author}</span>
                      <span>•</span>
                      <span>{adr.linkedRequirements.length} Linked Req(s)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected ADR Deep View (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-5">
            {selectedAdr ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {selectedAdr.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${getStatusBadge(
                          selectedAdr.status
                        )}`}
                      >
                        {selectedAdr.status}
                      </span>
                      <span className="text-xs text-slate-400">• Published {selectedAdr.date}</span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-2">
                      {selectedAdr.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Authored by <span className="font-semibold text-slate-700">{selectedAdr.author}</span>
                    </p>
                  </div>

                  {/* Status update actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedAdr.status === 'PROPOSED' && (
                      <button
                        onClick={() => onUpdateADRStatus(selectedAdr.id, 'ACCEPTED')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept ADR
                      </button>
                    )}
                    {selectedAdr.status === 'ACCEPTED' && (
                      <button
                        onClick={() => onUpdateADRStatus(selectedAdr.id, 'SUPERSEDED')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                      >
                        Mark Superseded
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 1: Context */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    1. Problem Context & Drivers
                  </h4>
                  <div className="p-3.5 bg-slate-50 rounded-lg text-xs text-slate-700 leading-relaxed border border-slate-100">
                    {selectedAdr.context}
                  </div>
                </div>

                {/* Section 2: Decision */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    2. Architectural Decision
                  </h4>
                  <div className="p-3.5 bg-blue-50/40 rounded-lg text-xs text-slate-800 leading-relaxed border border-blue-100 font-medium">
                    {selectedAdr.decision}
                  </div>
                </div>

                {/* Section 3: Consequences */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    3. Evaluated Consequences
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Positive */}
                    <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-lg space-y-1.5">
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Positive Outcomes
                      </span>
                      <ul className="list-disc list-inside text-emerald-800 text-[11px] space-y-1">
                        {selectedAdr.consequences.positive.map((p, idx) => (
                          <li key={idx}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Negative / Trade-offs */}
                    <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-lg space-y-1.5">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Negative Trade-Offs
                      </span>
                      <ul className="list-disc list-inside text-amber-800 text-[11px] space-y-1">
                        {selectedAdr.consequences.negative.map((n, idx) => (
                          <li key={idx}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Section 4: Governance Links */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Bidirectional Traceability Links
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedAdr.linkedRequirements.map((reqId) => (
                      <span
                        key={reqId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] border border-slate-200"
                      >
                        Req: {reqId}
                      </span>
                    ))}
                    {selectedAdr.linkedRisks.map((riskId) => (
                      <span
                        key={riskId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded font-mono text-[11px] border border-red-200"
                      >
                        Risk: {riskId}
                      </span>
                    ))}
                    {selectedAdr.linkedStandards.map((stdId) => (
                      <span
                        key={stdId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-mono text-[11px] border border-purple-200"
                      >
                        Standard: {stdId}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                Select an Architecture Decision Record to inspect context and consequences.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TOPOLOGY & TRUST BOUNDARIES TAB */}
      {activeTab === 'TOPOLOGY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['INTERNET', 'DMZ', 'INTERNAL_SECURE', 'RESTRICTED_DATA'] as TrustZone[]).map((zone) => {
              const info = getTrustZoneBadge(zone);
              const zoneComponents = components.filter((c) => c.trustZone === zone);
              return (
                <div
                  key={zone}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${info.color}`}>
                        {info.label}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {zoneComponents.length} CMP
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {zoneComponents.map((cmp) => (
                        <div
                          key={cmp.id}
                          onClick={() => setSelectedComp(cmp)}
                          className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                            selectedComp?.id === cmp.id
                              ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/20'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-slate-500">
                              {cmp.id}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {cmp.category}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mt-1">{cmp.name}</h4>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                            {cmp.technology}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Boundary Policy</span>
                    <span className="font-semibold text-slate-700">Strict TLS / Non-Spill</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Component Drawer / Detail Modal */}
          {selectedComp && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4 animate-in fade-in">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      {selectedComp.id}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-bold">
                      {selectedComp.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      Data Classification: <strong className="text-slate-800">{selectedComp.dataClassification}</strong>
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">{selectedComp.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedComp.description}</p>
                </div>

                <button
                  onClick={() => setSelectedComp(null)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">Technology Core:</span>
                  <span className="font-mono text-[11px] text-slate-900">{selectedComp.technology}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">Inbound Allowed:</span>
                  <span className="font-mono text-[11px] text-slate-900">
                    {selectedComp.inboundProtocols.join(', ')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">Outbound Destination:</span>
                  <span className="font-mono text-[11px] text-slate-900">
                    {selectedComp.outboundProtocols.join(', ')}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-semibold">Active Security Controls:</span>
                {selectedComp.securityControls.map((ctrl, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-medium"
                  >
                    {ctrl}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ARCHITECTURE EXIT GATE TAB */}
      {activeTab === 'GATE' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Phase Exit Criteria
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    isGatePassed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {isGatePassed ? 'READY FOR IMPLEMENTATION' : 'ARCHITECTURE GATE BLOCKED'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Architecture Verification & Exit Gate Evaluator
              </h2>
              <p className="text-xs text-slate-500">
                A-SSDLC policy forbids advancing to active implementation until foundational architecture decisions and boundary isolation are formally ratified.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isGatePassed && (
                <button
                  onClick={() => onOpenOverrideModal('ARCHITECTURE_PHASE_GATE')}
                  className="px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Request Gate Concession
                </button>
              )}
              <button
                disabled={!isGatePassed}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  isGatePassed
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Approve & Advance to Sprint Execution
              </button>
            </div>
          </div>

          {/* Verification Criteria Cards */}
          <div className="space-y-3 text-xs">
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                acceptedAdrsCount >= 3
                  ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/40 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {acceptedAdrsCount >= 3 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold">Quorum of Accepted Architecture Decisions (ADRs)</h4>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Foundational decisions must be reviewed and accepted. Current: {acceptedAdrsCount}/3 required.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold">
                {acceptedAdrsCount >= 3 ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                criticalRisksWithAdrOrControl
                  ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/40 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {criticalRisksWithAdrOrControl ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold">High & Critical Risk Architectural Mitigations</h4>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Every High or Critical risk in the Risk Register must map to an active control or accepted ADR.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold">
                {criticalRisksWithAdrOrControl ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                components.length >= 4
                  ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/40 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {components.length >= 4 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold">Component Topology Definition & Surface Demarcation</h4>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    At least 4 canonical components across Client, Gateway, Service, and Datastore tiers must be defined. Current: {components.length}.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold">
                {components.length >= 4 ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                hasRestrictedIsolation
                  ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/40 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {hasRestrictedIsolation ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold">Restricted Data Tier Zero-Public-Exposure Check</h4>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Canonical state stores and cryptographic ledgers must terminate without outbound internet egress.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold">
                {hasRestrictedIsolation ? 'PASS' : 'FAIL'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* NEW ADR MODAL */}
      {showNewAdrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" /> Propose Architecture Decision Record (ADR)
              </h3>
              <button
                onClick={() => setShowNewAdrModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdr} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ADR Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asynchronous Event-Driven Messaging for Order Processing"
                  value={newAdrTitle}
                  onChange={(e) => setNewAdrTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Context & Problem Statement</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What is the problem, constraints, and driving factors?"
                  value={newAdrContext}
                  onChange={(e) => setNewAdrContext(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decision</label>
                <textarea
                  rows={2}
                  required
                  placeholder="We will..."
                  value={newAdrDecision}
                  onChange={(e) => setNewAdrDecision(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Positive Outcomes (one per line)</label>
                  <textarea
                    rows={2}
                    value={newAdrPositives}
                    onChange={(e) => setNewAdrPositives(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trade-offs & Negatives (one per line)</label>
                  <textarea
                    rows={2}
                    value={newAdrNegatives}
                    onChange={(e) => setNewAdrNegatives(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewAdrModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Propose Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW COMPONENT MODAL */}
      {showNewCompModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-900" /> Register Architecture Component
              </h3>
              <button
                onClick={() => setShowNewCompModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateComponent} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Component Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit Log Crypto Signer"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCompCategory}
                    onChange={(e) => setNewCompCategory(e.target.value as any)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="SERVICE">Service</option>
                    <option value="GATEWAY">Gateway</option>
                    <option value="DATASTORE">Datastore</option>
                    <option value="CLIENT">Client</option>
                    <option value="EXTERNAL">External</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trust Zone</label>
                  <select
                    value={newCompTrustZone}
                    onChange={(e) => setNewCompTrustZone(e.target.value as any)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="INTERNAL_SECURE">Internal Secure Core</option>
                    <option value="DMZ">DMZ Edge</option>
                    <option value="RESTRICTED_DATA">Restricted Data Tier</option>
                    <option value="INTERNET">Internet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technology Stack</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Node.js, WebCrypto API, ECDSA P-256"
                  value={newCompTech}
                  onChange={(e) => setNewCompTech(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Role</label>
                <textarea
                  rows={2}
                  placeholder="Responsibilities and purpose within the trust boundary..."
                  value={newCompDesc}
                  onChange={(e) => setNewCompDesc(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCompModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Register Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
