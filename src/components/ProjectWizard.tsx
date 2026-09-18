import { emptyAssurance, computeAssurance } from '../data/projectInitialization';
import { applicableStandards } from '../data/standardsApplicability';
import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Smartphone,
  Server,
  Monitor,
  Brain,
  Bot,
  Shield,
  Check,
  ArrowRight,
  ArrowLeft,
  Lock,
  X,
  AlertCircle,
  Database,
  Key,
  Cloud,
  Layers,
  Cpu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ProjectProfile,
  SpecializedProfile,
  DeliveryMethod,
  DataSensitivity,
  Project,
  TechChoiceType,
  TechChoice,
  TechnicalBaseline,
} from '../types';

interface TechDomainConfig {
  preferred: string;
  rationale: string;
  alternatives: { technology: string; tradeOff: string }[];
}

const TECHNICAL_RECOMMENDATIONS: Record<string, TechDomainConfig> = {
  frontend: {
    preferred: 'React 19 + Vite + Tailwind CSS',
    rationale: 'High rendering performance, componentized zero-trust security boundaries, and strict client bundle containment.',
    alternatives: [
      { technology: 'Next.js App Router', tradeOff: 'Server runtime complexity and potential SSR credential leakage' },
      { technology: 'SvelteKit', tradeOff: 'Smaller enterprise security ecosystem and custom state patterns' },
    ],
  },
  backend: {
    preferred: 'Node.js + Express API (Strict ESM / CJS Bundle)',
    rationale: 'Native TypeScript type stripping, @google/genai SDK compatibility, and strict container port 3000 compliance.',
    alternatives: [
      { technology: 'FastAPI (Python)', tradeOff: 'Dual language container footprint and package overhead' },
      { technology: 'Go Gin / Fiber', tradeOff: 'Higher build ceremony, slower prototype iteration' },
    ],
  },
  database: {
    preferred: 'PostgreSQL with Connection Pooling / In-Memory Store',
    rationale: 'Strict ACID transactions and relational integrity for traceability matrices, WBS tasks, and audit ledgers.',
    alternatives: [
      { technology: 'SQLite Single-File', tradeOff: 'Write lock contention under concurrent worker load' },
      { technology: 'MongoDB', tradeOff: 'Schema flexibility increases risk of unvalidated requirement drift' },
    ],
  },
  authentication: {
    preferred: 'WebAuthn Passkeys & Cryptographic Session Tokens',
    rationale: 'NIST SP 800-63B AAL3 compliance, complete phishing resistance, and zero shared secrets.',
    alternatives: [
      { technology: 'Username / Salted Password', tradeOff: 'Vulnerable to credential stuffing without mandatory hardware MFA' },
      { technology: 'External OIDC Identity Provider', tradeOff: 'Introduces external cloud identity coupling' },
    ],
  },
  storage: {
    preferred: 'AES-256-GCM Encrypted File Store & Sealed JSON Packages',
    rationale: 'Tamper-evident hash chaining and deterministic package sealing for zero-knowledge offline portability.',
    alternatives: [
      { technology: 'Plain File System', tradeOff: 'Zero at-rest confidentiality protection' },
      { technology: 'Cloud Object Storage (S3 / GCS)', tradeOff: 'Cloud-locked credentials and potential egress leakage' },
    ],
  },
  apiApproach: {
    preferred: 'RESTful JSON API with Strict Schema Validation',
    rationale: 'Deterministic request parsing, universal web client compatibility, and zero prototype pollution.',
    alternatives: [
      { technology: 'GraphQL', tradeOff: 'Arbitrary query depth complexity and resource exhaustion vulnerability' },
      { technology: 'gRPC / Protobuf', tradeOff: 'Requires HTTP/2 proxy infrastructure not supported in standard web iframes' },
    ],
  },
  deployment: {
    preferred: 'Containerized Cloud Run (0.0.0.0:3000 Ingress)',
    rationale: 'Stateless container execution with strict reverse proxy port mapping and automated TLS termination.',
    alternatives: [
      { technology: 'Kubernetes Cluster', tradeOff: 'Excess operational surface and management overhead for single-service MVP' },
      { technology: 'Bare VM Systemd Service', tradeOff: 'Manual patching and immutable infrastructure violation' },
    ],
  },
  sourceControl: {
    preferred: 'AI_STUDIO_WORKSPACE (Local-First Honest Workspace)',
    rationale: 'Zero fabricated Git metadata with SHA-256 state continuity verification and tamper-evident audit ledger.',
    alternatives: [
      { technology: 'Fabricated Local Git Stubs', tradeOff: 'Deceptive provenance violating platform honesty guidelines' },
      { technology: 'External GitHub Remote', tradeOff: 'Requires personal access tokens and external network access' },
    ],
  },
  testing: {
    preferred: 'Automated Multi-Suite QA Gate (Linter + Security + WBS Drift)',
    rationale: 'Comprehensive automated verification gate preventing state drift and regression prior to human sign-off.',
    alternatives: [
      { technology: 'Manual QA Checklist Only', tradeOff: 'Non-deterministic verification and human error' },
      { technology: 'Unit Tests Only', tradeOff: 'Misses cross-module security and state hash regressions' },
    ],
  },
  aiProvider: {
    preferred: 'Google Gemini 2.5 Flash via Server-Side API Proxy',
    rationale: 'Modern @google/genai SDK with sub-second latency and zero client-side token exposure.',
    alternatives: [
      { technology: 'Client-Side Browser Direct SDK', tradeOff: 'CRITICAL SECURITY VIOLATION: Exposes API key in browser devtools' },
      { technology: 'Local Self-Hosted LLM', tradeOff: 'Requires local GPU compute not available in cloud containers' },
    ],
  },
};

export interface ProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectDraft: any) => Promise<Project | boolean | void> | void;
  triggerButtonId?: string;
}

export const ProjectWizard: React.FC<ProjectWizardProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  triggerButtonId = 'topbar-new-project-btn',
}) => {
  const [maturity, setMaturity] = useState<Project['maturity']>('GREENFIELD');
  const [assurance, setAssurance] = useState({...emptyAssurance});
  const [submitError, setSubmitError] = useState('');
  const [step, setStep] = useState<number>(1);

  // Step 1: Project Identification
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('ITERATIVE');
  const [deploymentIntent, setDeploymentIntent] = useState('');
  const [dataSensitivity, setDataSensitivity] = useState<DataSensitivity>('INTERNAL');

  // Step 2: Profiles
  const [selectedProfiles, setSelectedProfiles] = useState<ProjectProfile[]>(['WEB_APPLICATION']);
  const [selectedSpecialized, setSelectedSpecialized] = useState<SpecializedProfile[]>([]);

  // Step 3: Product Baseline
  const [problemStatement, setProblemStatement] = useState('');
  const [targetUsers, setTargetUsers] = useState('');
  const [coreCapabilities, setCoreCapabilities] = useState('');
  const [coreFeatures, setCoreFeatures] = useState('');
  const [primaryWorkflows, setPrimaryWorkflows] = useState('');
  const [nonGoals, setNonGoals] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');

  // Step 4: Technical Baseline (Separating Decision Mode, Recommendation, and Final Selection)
  const [frontendChoice, setFrontendChoice] = useState<TechChoiceType>('UNKNOWN');
  const [frontendVal, setFrontendVal] = useState('');
  const [frontendFinal, setFrontendFinal] = useState('');

  const [backendChoice, setBackendChoice] = useState<TechChoiceType>('UNKNOWN');
  const [backendVal, setBackendVal] = useState('');
  const [backendFinal, setBackendFinal] = useState('');

  const [databaseChoice, setDatabaseChoice] = useState<TechChoiceType>('UNKNOWN');
  const [databaseVal, setDatabaseVal] = useState('');
  const [databaseFinal, setDatabaseFinal] = useState('');

  const [authChoice, setAuthChoice] = useState<TechChoiceType>('UNKNOWN');
  const [authVal, setAuthVal] = useState('');
  const [authFinal, setAuthFinal] = useState('');

  const [storageChoice, setStorageChoice] = useState<TechChoiceType>('UNKNOWN');
  const [storageVal, setStorageVal] = useState('');
  const [storageFinal, setStorageFinal] = useState('');

  const [apiChoice, setApiChoice] = useState<TechChoiceType>('UNKNOWN');
  const [apiVal, setApiVal] = useState('');
  const [apiFinal, setApiFinal] = useState('');

  const [deploymentChoice, setDeploymentChoice] = useState<TechChoiceType>('UNKNOWN');
  const [deploymentVal, setDeploymentVal] = useState('');
  const [deploymentFinal, setDeploymentFinal] = useState('');

  const [sourceControlChoice, setSourceControlChoice] = useState<TechChoiceType>('UNKNOWN');
  const [sourceControlVal, setSourceControlVal] = useState('');
  const [sourceControlFinal, setSourceControlFinal] = useState('');

  const [testingChoice, setTestingChoice] = useState<TechChoiceType>('UNKNOWN');
  const [testingVal, setTestingVal] = useState('');
  const [testingFinal, setTestingFinal] = useState('');

  const [aiChoice, setAiChoice] = useState<TechChoiceType>('UNKNOWN');
  const [aiVal, setAiVal] = useState('');
  const [aiFinal, setAiFinal] = useState('');

  const buildTechChoice = (
    mode: TechChoiceType,
    userVal: string,
    key: keyof typeof TECHNICAL_RECOMMENDATIONS,
    finalVal: string
  ): TechChoice => {
    const rec = TECHNICAL_RECOMMENDATIONS[key];
    const isRecommended = mode === 'RECOMMEND_FOR_ME';
    const isUserSpecified = mode === 'USER_SPECIFIED';
    const isUnknown = mode === 'UNKNOWN';

    // In UNKNOWN mode: user value = null, recommendation = null, finalSelection = null
    if (isUnknown) {
      return {
        type: 'UNKNOWN',
        decision_mode: 'UNKNOWN',
        userValue: null,
        recommendation: null,
        finalSelection: null,
        final_selection: null,
        status: 'NOT_RATIFIED',
        value: null,
      };
    }

    // In RECOMMEND_FOR_ME mode, finalSelection MUST NOT be pre-populated unless explicitly selected/applied
    const explicitFinal = isUserSpecified
      ? (userVal.trim() || null)
      : (finalVal.trim() || null);

    return {
      type: mode,
      decision_mode: mode,
      userValue: isUserSpecified ? (userVal.trim() || null) : null,
      recommendation: {
        status: isRecommended ? (explicitFinal ? 'ACCEPTED' : 'PROPOSED') : 'NOT_EVALUATED',
        preferredTechnology: rec.preferred,
        rationale: [rec.rationale],
        alternatives: rec.alternatives,
        evaluatedAt: new Date().toISOString(),
      },
      finalSelection: explicitFinal,
      final_selection: explicitFinal,
      status: 'NOT_RATIFIED',
      value: explicitFinal || null,
    };
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus first input when opening
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (step === 1) {
          nameInputRef.current?.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, step]);

  const profileOptions: {
    id: ProjectProfile;
    title: string;
    description: string;
    icon: any;
    standards: string[];
  }[] = [
    {
      id: 'WEB_APPLICATION',
      title: 'Web Application',
      description: 'Browser-based systems with modern frontend + secure server backend.',
      icon: Globe,
      standards: ['NIST SSDF', 'OWASP ASVS', 'OWASP Top 10'],
    },
    {
      id: 'BACKEND_API',
      title: 'Backend / API',
      description: 'REST, gRPC, and GraphQL service architectures with high concurrency.',
      icon: Server,
      standards: ['OWASP API Security', 'NIST SSDF', 'OWASP ASVS'],
    },
    {
      id: 'MOBILE_APPLICATION',
      title: 'Mobile Application',
      description: 'iOS and Android client applications with local device keystore.',
      icon: Smartphone,
      standards: ['OWASP MASVS', 'NIST SSDF'],
    },
    {
      id: 'DESKTOP_APPLICATION',
      title: 'Desktop Application',
      description: 'Native or Electron desktop binaries with OS sandbox isolation.',
      icon: Monitor,
      standards: ['NIST SSDF', 'CWE Secure Architecture'],
    },
    {
      id: 'AI_APPLICATION',
      title: 'AI Application',
      description: 'LLM integrations, prompt engines, retrieval-augmented generation (RAG).',
      icon: Brain,
      standards: ['OWASP AISVS', 'NIST AI RMF'],
    },
    {
      id: 'AGENTIC_AI_APPLICATION',
      title: 'Agentic AI Application',
      description: 'Autonomous agents with tool calling, shell execution, and code synthesis.',
      icon: Bot,
      standards: ['OWASP AISVS', 'OWASP Agentic Guidance', 'NIST AI RMF'],
    },
  ];

  const specializedOptions: { id: SpecializedProfile; label: string; riskEffect: string }[] = [
    { id: 'FINANCIAL', label: 'Financial / FinTech', riskEffect: 'Imposes HIGH minimum risk floor' },
    { id: 'HEALTHCARE', label: 'Healthcare (HIPAA)', riskEffect: 'Mandatory encrypted audit logs' },
    { id: 'PII', label: 'Personal Data / PII', riskEffect: 'Data retention compliance gates' },
    { id: 'DEVELOPER_TOOL', label: 'Developer Tool', riskEffect: 'Strict path & command boundaries' },
    { id: 'INTERNAL_TOOL', label: 'Internal Business Tool', riskEffect: 'SSO & identity assertion' },
    { id: 'PUBLIC_INTERNET', label: 'Public Internet Service', riskEffect: 'Rate-limiting & DoS controls' },
    { id: 'AUTONOMOUS_AGENT', label: 'Autonomous Agent', riskEffect: 'Human approval for destructive actions' },
  ];

  const toggleProfile = (p: ProjectProfile) => {
    if (selectedProfiles.includes(p)) {
      if (selectedProfiles.length > 1) {
        setSelectedProfiles(selectedProfiles.filter((item) => item !== p));
      }
    } else {
      setSelectedProfiles([...selectedProfiles, p]);
    }
  };

  const toggleSpecialized = (sp: SpecializedProfile) => {
    if (selectedSpecialized.includes(sp)) {
      setSelectedSpecialized(selectedSpecialized.filter((item) => item !== sp));
    } else {
      setSelectedSpecialized([...selectedSpecialized, sp]);
    }
  };

  // Derive activated standards from selected profiles
  const activatedStandards = Array.from(new Set(applicableStandards({profiles: selectedProfiles}).map(s => s.standardName + ' v' + s.version)));
  const computedRisk = computeAssurance(assurance, selectedProfiles, selectedSpecialized);

  const isFormDirty = () => {
    return (
      name.trim().length > 0 ||
      description.trim().length > 0 ||
      step > 1 ||
      selectedProfiles.length !== 1 ||
      selectedProfiles[0] !== 'WEB_APPLICATION' ||
      owner !== 'Gio'
    );
  };

  const resetForm = () => {
    setMaturity('GREENFIELD');
    setAssurance({...emptyAssurance});
    setSubmitError('');
    setStep(1);
    setName('');
    setDescription('');
    setOwner('');
    setDeliveryMethod('ITERATIVE');
    setDeploymentIntent('');
    setDataSensitivity('INTERNAL');
    setSelectedProfiles(['WEB_APPLICATION']);
    setSelectedSpecialized([]);
    setProblemStatement('');
    setTargetUsers('');
    setCoreCapabilities('');
    setCoreFeatures('');
    setPrimaryWorkflows('');
    setNonGoals('');
    setSuccessCriteria('');
    setFrontendChoice('UNKNOWN');
    setFrontendVal('');
    setFrontendFinal('');
    setBackendChoice('UNKNOWN');
    setBackendVal('');
    setBackendFinal('');
    setDatabaseChoice('UNKNOWN');
    setDatabaseVal('');
    setDatabaseFinal('');
    setAuthChoice('UNKNOWN');
    setAuthVal('');
    setAuthFinal('');
    setStorageChoice('UNKNOWN');
    setStorageVal('');
    setStorageFinal('');
    setApiChoice('UNKNOWN');
    setApiVal('');
    setApiFinal('');
    setDeploymentChoice('UNKNOWN');
    setDeploymentVal('');
    setDeploymentFinal('');
    setSourceControlChoice('UNKNOWN');
    setSourceControlVal('');
    setSourceControlFinal('');
    setTestingChoice('UNKNOWN');
    setTestingVal('');
    setTestingFinal('');
    setAiChoice('UNKNOWN');
    setAiVal('');
    setAiFinal('');
    setIsSubmitting(false);
    setShowDiscardConfirm(false);
  };

  const handleAttemptClose = () => {
    if (isFormDirty()) {
      setShowDiscardConfirm(true);
    } else {
      handleConfirmDiscard();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    resetForm();
    onClose();
    if (triggerButtonId) {
      document.getElementById(triggerButtonId)?.focus();
    }
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleAttemptClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDiscardConfirm, name, description, step, selectedProfiles, owner]);

  const handleFinish = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);

    try {
      const draft = {
        name: name.trim(),
        description: description.trim(),
        owner,
        profiles: selectedProfiles,
        specializedProfiles: selectedSpecialized,
        deliveryMethod,
        deploymentIntent,
        dataSensitivity,
        maturity,
        assuranceInputs: assurance,
        productBaseline: {
          problemStatement: problemStatement.trim() || description.trim(),
          targetUsers: targetUsers.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
          coreCapabilities: coreCapabilities.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
          coreFeatures: coreFeatures.split('\n').map((s) => s.trim()).filter(Boolean),
          primaryWorkflows: primaryWorkflows.split('\n').map((s) => s.trim()).filter(Boolean),
          nonGoals: nonGoals.split('\n').map((s) => s.trim()).filter(Boolean),
          successCriteria: successCriteria.split('\n').map((s) => s.trim()).filter(Boolean),
        },
        technicalBaseline: {
          frontend: buildTechChoice(frontendChoice, frontendVal, 'frontend', frontendFinal),
          backend: buildTechChoice(backendChoice, backendVal, 'backend', backendFinal),
          database: buildTechChoice(databaseChoice, databaseVal, 'database', databaseFinal),
          authentication: buildTechChoice(authChoice, authVal, 'authentication', authFinal),
          storage: buildTechChoice(storageChoice, storageVal, 'storage', storageFinal),
          apiApproach: buildTechChoice(apiChoice, apiVal, 'apiApproach', apiFinal),
          deployment: buildTechChoice(deploymentChoice, deploymentVal, 'deployment', deploymentFinal),
          sourceControl: buildTechChoice(sourceControlChoice, sourceControlVal, 'sourceControl', sourceControlFinal),
          testing: buildTechChoice(testingChoice, testingVal, 'testing', testingFinal),
          aiProvider: buildTechChoice(aiChoice, aiVal, 'aiProvider', aiFinal),
        },
      };

      await onCreateProject(draft);
      resetForm();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Project creation failed. Your draft is retained.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const wizardSteps = [
    { num: 1, label: 'Project' },
    { num: 2, label: 'Profiles' },
    { num: 3, label: 'Product' },
    { num: 4, label: 'Technical' },
    { num: 5, label: 'Assurance' },
    { num: 6, label: 'Review' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Subtle Dimming Overlay */}
          <motion.div
            key="wizard-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 bg-slate-900/15 backdrop-blur-[0.5px]"
            onClick={handleAttemptClose}
            aria-hidden="true"
          />

          {/* Right-Side Slide-In Drawer */}
          <motion.aside
            key="wizard-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-drawer-heading"
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[50vw] md:max-w-[640px] lg:w-[620px] max-w-full bg-white border-l border-slate-200 shadow-2xl flex flex-col focus:outline-hidden"
          >
            {/* Drawer Header */}
            <div className="p-5 md:p-6 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="new-project-drawer-heading"
                    className="text-lg md:text-xl font-bold text-slate-900 tracking-tight"
                  >
                    Create a new project
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define project baseline and architectural posture for rigorous A-SSDLC execution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAttemptClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  aria-label="Close project creation drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stepper Indicator (6 Steps) */}
              <div className="flex items-center justify-between gap-1 mt-4">
                {wizardSteps.map((s, idx, arr) => (
                  <React.Fragment key={s.num}>
                    <button
                      type="button"
                      disabled={step < s.num && (!name.trim() || step === 1)}
                      onClick={() => {
                        if (s.num < step || (name.trim() && s.num <= step + 1)) {
                          setStep(s.num);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                        step === s.num
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : step > s.num
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold">
                        {step > s.num ? '✓' : s.num}
                      </span>
                      <span className="text-[11px] font-medium hidden sm:inline">{s.label}</span>
                    </button>
                    {idx < arr.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-0.5"></div>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Drawer Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
              {submitError && <p role="alert" className="text-red-700">{submitError}</p>}
              {/* Step 1: Project Details */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 pb-1">1. Project Identification</h3>
                    <p className="text-xs text-slate-500">Name and categorize your application baseline.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Project Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Nexus Identity Broker, Atlas Portal"
                      className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Project Description & Strategic Purpose
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is this application solving? Who are the primary consumers?"
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  <label className="block text-xs font-semibold">Project Maturity
                    <select aria-label="Project Maturity" value={maturity} onChange={e => setMaturity(e.target.value as Project['maturity'])} className="w-full border rounded p-2 mt-1">
                      {['GREENFIELD','EXISTING_PROJECT','MIGRATION','EXTENSION'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Owner / Lead</label>
                      <input
                        type="text"
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Method</label>
                      <select
                        value={deliveryMethod}
                        onChange={(e) => setDeliveryMethod(e.target.value as DeliveryMethod)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="ITERATIVE">Iterative (Recommended)</option>
                        <option value="SCRUM">Scrum (Sprints)</option>
                        <option value="KANBAN">Kanban (Continuous)</option>
                        <option value="SCRUMBAN">Scrumban</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Data Sensitivity</label>
                      <select
                        value={dataSensitivity}
                        onChange={(e) => setDataSensitivity(e.target.value as DataSensitivity)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="INTERNAL">Internal Business</option>
                        <option value="CONFIDENTIAL">Confidential (Default)</option>
                        <option value="RESTRICTED">Restricted / Regulated</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Deployment Intent</label>
                      <input
                        type="text"
                        value={deploymentIntent}
                        onChange={(e) => setDeploymentIntent(e.target.value)}
                        placeholder="e.g. Containerized Cloud Run"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Profiles & Activated Standards */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 pb-1">2. Project Profiles</h3>
                    <p className="text-xs text-slate-500">
                      Select one or more profiles. Profiles automatically activate security standards, risk floors, and questionnaire branches.
                    </p>
                  </div>

                  {/* Profile Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profileOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedProfiles.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleProfile(opt.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all relative ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            {isSelected && (
                              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Selected
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-xs text-slate-900">{opt.title}</div>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{opt.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Activated Standards Notice */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      Activated Standards & Assurance Frameworks:
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activatedStandards.map((std) => (
                        <span
                          key={std}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 text-[11px] font-medium shadow-2xs flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {std}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Specialized Profiles */}
                  <div className="pt-1">
                    <span className="text-xs font-bold text-slate-700 block mb-2">Specialized Domain Profiles:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {specializedOptions.map((sp) => {
                        const active = selectedSpecialized.includes(sp.id);
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => toggleSpecialized(sp.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-semibold'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {sp.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Product Baseline */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 pb-1">3. Product Baseline</h3>
                    <p className="text-xs text-slate-500">
                      Establish core product boundaries, user personas, workflows, non-goals, and success criteria.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Problem Statement <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={problemStatement}
                      onChange={(e) => setProblemStatement(e.target.value)}
                      placeholder="What exact user pain or organizational bottleneck is this application solving?"
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Users / Personas (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={targetUsers}
                      onChange={(e) => setTargetUsers(e.target.value)}
                      placeholder="e.g. Lead Developer, SecOps Analyst, Auditor"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Core Capabilities (high-level system value)
                    </label>
                    <input
                      type="text"
                      value={coreCapabilities}
                      onChange={(e) => setCoreCapabilities(e.target.value)}
                      placeholder="e.g. Identity Management, Vault Encryption, Automated Auditing"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Candidate Features (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={coreFeatures}
                      onChange={(e) => setCoreFeatures(e.target.value)}
                      placeholder="List primary capabilities/features to be seeded into the backlog..."
                      className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Workflows (ordered sequence)
                    </label>
                    <textarea
                      rows={3}
                      value={primaryWorkflows}
                      onChange={(e) => setPrimaryWorkflows(e.target.value)}
                      placeholder="Describe the end-to-end operational flow..."
                      className="w-full text-xs px-3.5 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Explicit Non-Goals
                      </label>
                      <textarea
                        rows={2}
                        value={nonGoals}
                        onChange={(e) => setNonGoals(e.target.value)}
                        placeholder="What will this system explicitly NOT do?"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Success Criteria
                      </label>
                      <textarea
                        rows={2}
                        value={successCriteria}
                        onChange={(e) => setSuccessCriteria(e.target.value)}
                        placeholder="Measurable definitions of done..."
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Technical Baseline */}
              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 pb-1">4. Technical Baseline</h3>
                    <p className="text-xs text-slate-500">
                      Specify architecture inputs across 10 core domains. Distinguish user selection, proposed recommendations, and ratified decisions.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs">
                    {[
                      {
                        key: 'frontend',
                        title: 'Frontend Architecture',
                        icon: Globe,
                        color: 'text-blue-600',
                        mode: frontendChoice,
                        setMode: setFrontendChoice,
                        userVal: frontendVal,
                        setUserVal: setFrontendVal,
                        finalVal: frontendFinal,
                        setFinalVal: setFrontendFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.frontend,
                      },
                      {
                        key: 'backend',
                        title: 'Backend API & Runtime',
                        icon: Server,
                        color: 'text-indigo-600',
                        mode: backendChoice,
                        setMode: setBackendChoice,
                        userVal: backendVal,
                        setUserVal: setBackendVal,
                        finalVal: backendFinal,
                        setFinalVal: setBackendFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.backend,
                      },
                      {
                        key: 'database',
                        title: 'Database & Persistence',
                        icon: Database,
                        color: 'text-purple-600',
                        mode: databaseChoice,
                        setMode: setDatabaseChoice,
                        userVal: databaseVal,
                        setUserVal: setDatabaseVal,
                        finalVal: databaseFinal,
                        setFinalVal: setDatabaseFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.database,
                      },
                      {
                        key: 'authentication',
                        title: 'Authentication & Session',
                        icon: Key,
                        color: 'text-amber-600',
                        mode: authChoice,
                        setMode: setAuthChoice,
                        userVal: authVal,
                        setUserVal: setAuthVal,
                        finalVal: authFinal,
                        setFinalVal: setAuthFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.authentication,
                      },
                      {
                        key: 'storage',
                        title: 'Encrypted Storage & Packaging',
                        icon: Lock,
                        color: 'text-emerald-600',
                        mode: storageChoice,
                        setMode: setStorageChoice,
                        userVal: storageVal,
                        setUserVal: setStorageVal,
                        finalVal: storageFinal,
                        setFinalVal: setStorageFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.storage,
                      },
                      {
                        key: 'apiApproach',
                        title: 'API Protocol & Schema Design',
                        icon: Layers,
                        color: 'text-cyan-600',
                        mode: apiChoice,
                        setMode: setApiChoice,
                        userVal: apiVal,
                        setUserVal: setApiVal,
                        finalVal: apiFinal,
                        setFinalVal: setApiFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.apiApproach,
                      },
                      {
                        key: 'deployment',
                        title: 'Deployment Target & Ingress',
                        icon: Cloud,
                        color: 'text-sky-600',
                        mode: deploymentChoice,
                        setMode: setDeploymentChoice,
                        userVal: deploymentVal,
                        setUserVal: setDeploymentVal,
                        finalVal: deploymentFinal,
                        setFinalVal: setDeploymentFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.deployment,
                      },
                      {
                        key: 'sourceControl',
                        title: 'Source Control & Provenance',
                        icon: Shield,
                        color: 'text-teal-600',
                        mode: sourceControlChoice,
                        setMode: setSourceControlChoice,
                        userVal: sourceControlVal,
                        setUserVal: setSourceControlVal,
                        finalVal: sourceControlFinal,
                        setFinalVal: setSourceControlFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.sourceControl,
                      },
                      {
                        key: 'testing',
                        title: 'Automated Multi-Suite Testing Gate',
                        icon: Check,
                        color: 'text-rose-600',
                        mode: testingChoice,
                        setMode: setTestingChoice,
                        userVal: testingVal,
                        setUserVal: setTestingVal,
                        finalVal: testingFinal,
                        setFinalVal: setTestingFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.testing,
                      },
                      {
                        key: 'aiProvider',
                        title: 'AI / LLM Gateway & Provider',
                        icon: Cpu,
                        color: 'text-purple-600',
                        mode: aiChoice,
                        setMode: setAiChoice,
                        userVal: aiVal,
                        setUserVal: setAiVal,
                        finalVal: aiFinal,
                        setFinalVal: setAiFinal,
                        rec: TECHNICAL_RECOMMENDATIONS.aiProvider,
                      },
                    ].map((item) => {
                      const IconComp = item.icon;
                      return (
                        <div key={item.key} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                              <IconComp className={`w-4 h-4 ${item.color}`} /> {item.title}
                            </span>
                            <div className="flex items-center gap-2">
                              {(['USER_SPECIFIED', 'RECOMMEND_FOR_ME', 'UNKNOWN'] as TechChoiceType[]).map((t) => (
                                <label key={t} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`${item.key}Choice`}
                                    checked={item.mode === t}
                                    onChange={() => {
                                      item.setMode(t);
                                      if (t === 'RECOMMEND_FOR_ME') {
                                        // Batch 3 invariant: Do NOT pre-populate finalSelection in RECOMMEND_FOR_ME mode
                                        item.setUserVal('');
                                        item.setFinalVal('');
                                      } else if (t === 'USER_SPECIFIED') {
                                        item.setUserVal('');
                                        item.setFinalVal('');
                                      } else {
                                        // UNKNOWN mode: zero values
                                        item.setUserVal('');
                                        item.setFinalVal('');
                                      }
                                    }}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-[10px] text-slate-600 font-medium">
                                    {t === 'USER_SPECIFIED' ? 'User Specified' : t === 'RECOMMEND_FOR_ME' ? 'Recommend for Me' : 'Unknown / Defer'}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Mode-Specific Content */}
                          {item.mode === 'USER_SPECIFIED' && (
                            <div className="space-y-1 pl-3 border-l-2 border-slate-300">
                              <label className="text-[11px] font-medium text-slate-600 block">
                                User-Specified Technology or Framework:
                              </label>
                              <input
                                type="text"
                                value={item.userVal}
                                onChange={(e) => {
                                  item.setUserVal(e.target.value);
                                  item.setFinalVal(e.target.value);
                                }}
                                placeholder="Enter specific technology choice..."
                                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          )}

                          {item.mode === 'RECOMMEND_FOR_ME' && (
                            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-blue-900 flex items-center gap-1">
                                  Proposed Recommendation: <span className="font-mono text-blue-950 font-bold">{item.rec.preferred}</span>
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                  Status: PROPOSED
                                </span>
                              </div>
                              <p className="text-blue-800 text-[10px] leading-relaxed">
                                <strong>Rationale:</strong> {item.rec.rationale}
                              </p>
                              {item.rec.alternatives.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-blue-100">
                                  <span className="text-[10px] font-bold text-blue-900 block">Alternatives & Trade-offs:</span>
                                  {item.rec.alternatives.map((alt) => (
                                    <div key={alt.technology} className="text-[10px] text-blue-700">
                                      • <span className="font-semibold">{alt.technology}</span>: {alt.tradeOff}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="pt-1 flex items-center justify-between">
                                <span className="text-[10px] text-blue-800 italic">
                                  {item.finalVal ? `Applied: ${item.finalVal}` : 'Not yet applied to final selection'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => item.setFinalVal(item.rec.preferred)}
                                  className="text-[10px] font-semibold px-2 py-1 bg-blue-100 text-blue-900 rounded hover:bg-blue-200 transition-colors cursor-pointer"
                                >
                                  Apply Recommendation to Selection
                                </button>
                              </div>
                            </div>
                          )}

                          {item.mode === 'UNKNOWN' && (
                            <div className="p-2 bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-500 italic">
                              Deferred to Discovery Phase (Decision Mode: UNKNOWN / UNRESOLVED)
                            </div>
                          )}

                          {/* Final Selection Field & Ratification Invariant */}
                          {item.mode !== 'UNKNOWN' && (
                            <div className="pt-1 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5 text-slate-700 flex-1">
                                <span className="font-semibold shrink-0">Final Selection:</span>
                                <input
                                  type="text"
                                  value={item.finalVal}
                                  placeholder={item.mode === 'RECOMMEND_FOR_ME' ? 'None selected (Click apply above or enter custom)' : 'Enter final selection...'}
                                  onChange={(e) => item.setFinalVal(e.target.value)}
                                  className="px-2 py-1 text-xs font-mono rounded border border-slate-200 bg-white w-full max-w-sm focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                Ratification: NOT_RATIFIED
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Architecture Recommendation ADR Invariant Notice */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-blue-800">
                      <Shield className="w-3.5 h-3.5" /> Architecture Governance Invariant:
                    </span>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Architecture recommendations do <strong>NOT</strong> automatically become approved ADRs. <strong>Recommendation != Selection != Ratified Architecture Decision.</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Step 5: Assurance Baseline */}
              {step === 5 && <div className="space-y-4 text-sm">
                <h3 className="font-bold">ASSURANCE INPUTS</h3>
                {Object.keys(emptyAssurance).filter(k => !['securitySensitivity','complianceProfile'].includes(k)).map(key => <label key={key} className="flex justify-between gap-3 items-center">
                  {key.replace(/([A-Z])/g, ' $1')}
                  <select aria-label={key} value={assurance[key] === null ? 'UNKNOWN' : String(assurance[key])} onChange={e => setAssurance({...assurance, [key]: e.target.value === 'UNKNOWN' ? null : e.target.value === 'true'})} className="border rounded p-2">
                    <option value="UNKNOWN">Unknown</option><option value="false">No</option><option value="true">Yes</option>
                  </select>
                </label>)}
                <label className="block">Security sensitivity <select value={assurance.securitySensitivity} onChange={e => setAssurance({...assurance, securitySensitivity: e.target.value as any})}>{['UNKNOWN','LOW','MEDIUM','HIGH'].map(v => <option key={v}>{v}</option>)}</select></label>
                <label className="block">Regulatory / compliance profile <input className="border rounded p-2 w-full" value={assurance.complianceProfile.join(', ')} onChange={e => setAssurance({...assurance, complianceProfile: e.target.value.split(',').map(v => v.trim()).filter(Boolean)})} placeholder="Applicable regulations, if any" /></label>
                <section className="p-4 bg-amber-50 border rounded"><h3 className="font-bold">COMPUTED RISK RESULT</h3><p>{computedRisk.level} (Score: {computedRisk.score})</p><p className="text-xs">Deterministic initial floor and declared exposure inputs. Score is read-only.</p></section>
                <section className="p-4 border rounded"><h3 className="font-bold">GOVERNANCE OVERRIDE</h3><p className="text-xs">After creation, request an override with rationale and human authorization. Approval and audit history are required; the computed score remains unchanged.</p></section>
              </div>}

              {/* Step 6: Review & Launch */}
              {step === 6 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 pb-1">6. Final Review & Initialization</h3>
                    <p className="text-xs text-slate-500">
                      Confirm configuration parameters before bootstrapping the A-SSDLC lifecycle state.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-3">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Project Name:</span>
                      <span className="font-bold text-slate-900">{name}</span>
                    </div>
                    {description && (
                      <div className="flex flex-col py-1 border-b border-slate-200">
                        <span className="text-slate-500 mb-0.5">Description:</span>
                        <span className="font-normal text-slate-700">{description}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Profiles:</span>
                      <span className="font-medium text-slate-900">{selectedProfiles.join(', ')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Delivery Method:</span>
                      <span className="font-medium text-slate-900">{deliveryMethod}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Standards:</span>
                      <span className="font-medium text-slate-900">{activatedStandards.join(', ')}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Technical Baseline Governance (10 Architecture Domains)
                        </span>
                        <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Recommendation ≠ Selection ≠ Ratification
                        </span>
                      </div>
                      <div className="space-y-2 font-mono text-[11px]">
                        {[
                          { label: 'Frontend', mode: frontendChoice, val: frontendFinal, rec: TECHNICAL_RECOMMENDATIONS.frontend },
                          { label: 'Backend', mode: backendChoice, val: backendFinal, rec: TECHNICAL_RECOMMENDATIONS.backend },
                          { label: 'Database', mode: databaseChoice, val: databaseFinal, rec: TECHNICAL_RECOMMENDATIONS.database },
                          { label: 'Authentication', mode: authChoice, val: authFinal, rec: TECHNICAL_RECOMMENDATIONS.authentication },
                          { label: 'Storage', mode: storageChoice, val: storageFinal, rec: TECHNICAL_RECOMMENDATIONS.storage },
                          { label: 'API Approach', mode: apiChoice, val: apiFinal, rec: TECHNICAL_RECOMMENDATIONS.apiApproach },
                          { label: 'Deployment', mode: deploymentChoice, val: deploymentFinal, rec: TECHNICAL_RECOMMENDATIONS.deployment },
                          { label: 'Source Control', mode: sourceControlChoice, val: sourceControlFinal, rec: TECHNICAL_RECOMMENDATIONS.sourceControl },
                          { label: 'Testing Gate', mode: testingChoice, val: testingFinal, rec: TECHNICAL_RECOMMENDATIONS.testing },
                          { label: 'AI Provider', mode: aiChoice, val: aiFinal, rec: TECHNICAL_RECOMMENDATIONS.aiProvider },
                        ].map((b) => {
                          const hasSelection = Boolean(b.val && b.val.trim());
                          const isRecommended = b.mode === 'RECOMMEND_FOR_ME';
                          return (
                            <div key={b.label} className="p-2.5 rounded-lg bg-white border border-slate-200/90 space-y-2 shadow-2xs font-sans">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="font-bold text-xs text-slate-900">{b.label}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                    b.mode === 'USER_SPECIFIED'
                                      ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                      : isRecommended
                                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}>
                                    Decision Mode: {b.mode === 'USER_SPECIFIED' ? 'User Specified' : isRecommended ? 'Recommend for Me' : 'Unknown / Defer'}
                                  </span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                                    Ratification Status: NOT RATIFIED
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-slate-100">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-500 font-semibold">Suggested Candidate:</span>
                                  <span className="text-slate-800 font-mono text-[10px] truncate" title={isRecommended ? b.rec.preferred : 'None'}>
                                    {isRecommended ? (
                                      <span className="text-blue-900 font-medium">{b.rec.preferred}</span>
                                    ) : (
                                      <span className="text-slate-400 italic">None</span>
                                    )}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-500 font-semibold">Recommendation Status:</span>
                                  <span className="text-slate-800 font-mono text-[10px]">
                                    {isRecommended ? (
                                      <span className="text-amber-800 font-bold bg-amber-50 px-1 py-0.2 rounded border border-amber-200 inline-block w-fit">PROPOSED</span>
                                    ) : (
                                      <span className="text-slate-400 italic">NOT_EVALUATED</span>
                                    )}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-500 font-semibold">Final Selection:</span>
                                  {hasSelection ? (
                                    <span className="text-emerald-900 font-mono font-medium text-[10px] truncate" title={b.val}>
                                      ✓ {b.val}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-slate-200 inline-block w-fit">
                                      NONE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Initial Phase:</span>
                      <span className="font-bold text-emerald-700">A-SSDLC DISCOVERY</span>
                    </div>
                  </div>

                  {/* Architecture Recommendation ADR Invariant Notice */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-blue-800">
                      <Shield className="w-3.5 h-3.5" /> Architecture Governance Invariant:
                    </span>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Architecture recommendations do <strong>NOT</strong> automatically become approved ADRs. They remain open architectural options until evaluated and ratified through formal ADR review.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/90 backdrop-blur-xs flex items-center justify-between shrink-0">
              <div>
                {step > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(step - 1)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 flex items-center gap-1.5 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleAttemptClose}
                      className="px-2.5 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAttemptClose}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/70 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div>
                {step < 6 ? (
                  <button
                    type="button"
                    disabled={step === 1 && !name.trim()}
                    onClick={() => setStep(step + 1)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Continue <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting || !name.trim()}
                    onClick={handleFinish}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isSubmitting ? 'Initializing Project...' : 'Launch Project Control Plane'}
                  </button>
                )}
              </div>
            </div>

            {/* Unsaved Changes Confirmation Modal */}
            {showDiscardConfirm && (
              <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                <div
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="discard-title"
                  aria-describedby="discard-desc"
                  className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center gap-2.5 text-slate-900">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <h3 id="discard-title" className="font-bold text-sm">
                      Discard new project?
                    </h3>
                  </div>
                  <p id="discard-desc" className="text-xs text-slate-600 leading-relaxed">
                    You have unsaved project information. Closing this form will discard it.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDiscardConfirm(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                    >
                      Keep Editing
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDiscard}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
