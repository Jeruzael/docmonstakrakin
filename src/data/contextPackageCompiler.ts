import {
  Project,
  Requirement,
  Risk,
  WorkItem,
  ADR,
  ArchitectureComponent,
  Feature,
  ContextPackageMode,
  CompiledContextPackage,
} from '../types.js';
import { applicableStandards } from './standardsApplicability.js';
import { normalizeTechChoice } from './projectInitialization.js';
import { validateText } from './generationValidation.js';
import type {EditableArtifact} from '../proposalTypes.js';

export interface ContextCompilerInput {
  project: Project;
  role: string;
  taskTitle?: string;
  activeWorkItem?: WorkItem;
  workItems?: WorkItem[];
  requirements?: Requirement[];
  risks?: Risk[];
  features?: Feature[];
  adrs?: ADR[];
  components?: ArchitectureComponent[];
  standards?: any[];
  mode: ContextPackageMode;
  includeOmissionReport?: boolean;
}

/**
 * REQ-AI-002: Least-Context Scoped Prompt Package Compiler
 * SEC-CTRL-017: Context Injection Boundary & Information Boundary
 *
 * Compiles rich, structured task-scoped execution packages without reducing
 * requirements to titles alone, while maintaining least-context discipline.
 */
export function compileContextPackage(input: ContextCompilerInput): CompiledContextPackage {
  const {
    project,
    role,
    taskTitle = 'General Engineering Task',
    activeWorkItem,
    workItems = [],
    requirements = [],
    risks = [],
    features = [],
    adrs = [],
    components = [],
    standards = [],
    mode,
    includeOmissionReport = true,
  } = input;

  const timestamp = new Date().toISOString();
  const omissions: string[] = [];
  const includedReqIds: string[] = [];
  const includedRiskIds: string[] = [];
  const includedAdrIds = new Set<string>();
  const includedWorkIds = new Set<string>();

  let sections: string[] = [];

  // 1. Role & Project Identity (Common to all modes)
  sections.push(`=== A-SSDLC CONTROL PLANE EXECUTION PACKAGE ===`);
  sections.push('=== REFERENCE CONTEXT ===');
  sections.push(`Agent Role: ${role}`);
  sections.push(`Project: ${project.name} (${project.id})`);
  sections.push(`Lifecycle Phase: ${project.lifecyclePhase} | Target Release: ${project.targetRelease}`);
  sections.push(`Profiles: ${project.profiles.join(', ')}${project.specializedProfiles?.length ? ` [Specialized: ${project.specializedProfiles.join(', ')}]` : ''}`);
  sections.push(`Delivery Method: ${project.deliveryMethod} | Data Sensitivity: ${project.dataSensitivity}`);
  sections.push(`Package Scoping Mode: ${mode}`);
  sections.push(`Purpose: ${project.description || project.productBaseline?.problemStatement || 'Not recorded'}`);
  sections.push(`Deployment intent: ${project.deploymentIntent || 'Open decision'}`);
  sections.push(`Non-goals: ${(project.productBaseline?.nonGoals || []).join('; ') || 'Not recorded'}`);
  sections.push(`Pinned Standards: ${Array.from(new Set(applicableStandards(project).map(s => `${s.standardName} v${s.version}`))).join(', ')}`);
  const blockers: string[] = [];
  if (mode === 'TASK_CONTEXT' && (!activeWorkItem || (!activeWorkItem.requirements?.some(id => requirements.some(r => r.id === id)) && !activeWorkItem.features?.some(id => features.some(f => f.id === id))))) {
    blockers.push('Link a project work item to governing requirements or features before implementation handoff.');
    sections.push(`IMPLEMENTATION HANDOFF BLOCKED: ${blockers[0]}`);
  }
  if (project.technicalBaseline) {
    sections.push('\n=== SELECTED ARCHITECTURE AND OPEN DECISIONS ===');
    Object.entries(project.technicalBaseline).forEach(([key, choice]) => {
      const normalized = normalizeTechChoice(choice);
      sections.push(normalized.finalSelection ? `${key}: ${normalized.finalSelection} (Selected; ${choice.status === 'RATIFIED' ? 'RATIFIED' : 'NOT_RATIFIED'})` : `${key}: OPEN DECISION${normalized.recommendation?.preferredTechnology ? `; PROPOSED candidate: ${normalized.recommendation.preferredTechnology}` : ''}`);
    });
  }

  if (mode === 'SUMMARY') {
    // Mode 1: Summary Mode
    sections.push(`\n=== EXECUTIVE PROJECT SUMMARY ===`);
    sections.push(`Description: ${project.description || 'No description provided.'}`);
    if (project.productBaseline) {
      sections.push(`Problem Statement: ${project.productBaseline.problemStatement}`);
      sections.push(`Target Users: ${project.productBaseline.targetUsers.join(', ')}`);
    }
    sections.push(`Requirements Baseline: ${requirements.length} total (Requirements Count: ${requirements.length}) (${requirements.filter((r) => r.status === 'APPROVED').length} approved, ${requirements.filter((r) => r.status === 'PROPOSED').length} proposed)`);
    sections.push(`Active Risks: ${risks.length} recorded`);
    sections.push(`Architecture Decision Records: ${adrs.length} recorded`);
    sections.push(`Features / Capabilities: ${features.length} registered`);

    requirements.slice(0, 5).forEach((r) => {
      includedReqIds.push(r.id);
      sections.push(`  * [${r.id}] ${r.title} (${r.status})`);
    });
    if (requirements.length > 5) {
      omissions.push(`${requirements.length - 5} requirements omitted in SUMMARY mode`);
    }
  } else if (mode === 'TASK_CONTEXT') {
    // Mode 2: Task Context Mode (Least-context scoped to active work item)
    sections.push(`\n=== ACTIVE TASK CONTEXT ===`);
    if (activeWorkItem) {
      includedWorkIds.add(activeWorkItem.id);
      sections.push(`Work Item ID: ${activeWorkItem.id} [${activeWorkItem.priority}]`);
      sections.push(`Title: ${activeWorkItem.title}`);
      sections.push(`Objective: ${activeWorkItem.description}`);
      sections.push(`Status: ${activeWorkItem.status} | Sprint: ${activeWorkItem.sprint}`);
      if (activeWorkItem.dependencies?.length) {
        sections.push(`Dependencies: ${activeWorkItem.dependencies.join(', ')}`);
      }
      if (activeWorkItem.acceptanceCriteria?.length) {
        sections.push(`Acceptance Criteria:`);
        activeWorkItem.acceptanceCriteria.forEach((ac, idx) => {
          sections.push(`  ${idx + 1}. ${ac}`);
        });
      }
      if (activeWorkItem.checklist?.length) {
        sections.push(`Execution Checklist:`);
        activeWorkItem.checklist.forEach((item) => {
          sections.push(`  [${item.done ? 'X' : ' '}] ${item.text}`);
        });
      }
    } else {
      sections.push(`Task Title: ${taskTitle}`);
      sections.push(`Objective: General implementation within current lifecycle phase.`);
    }

    // Demonstrable relationship filtering for requirements:
    // Only include requirements with a direct, provable link to the active task:
    // 1. Explicitly linked on activeWorkItem.requirements
    // 2. Linked via parent feature/capability
    // 3. Or if no explicit link provided, match by explicit task category / domain
    const linkedReqIds = new Set<string>(activeWorkItem?.requirements || []);
    features.filter(f => activeWorkItem?.features?.includes(f.id)).forEach(f => f.requirements.forEach(id => linkedReqIds.add(id)));
    
    let relevantRequirements: Requirement[] = [];
    if (linkedReqIds.size > 0) {
      relevantRequirements = requirements.filter((r) => linkedReqIds.has(r.id));
    } else if (activeWorkItem) {
      // If task has no requirements linked, do not dump unrelated requirements
      relevantRequirements = [];
    } else {
      // General task: include approved core baseline requirements
      relevantRequirements = requirements.filter((r) => r.status === 'APPROVED').slice(0, 5);
    }

    const displayedReqs = relevantRequirements;
    sections.push(`\n=== GOVERNING REQUIREMENTS (${displayedReqs.length} in task scope) ===`);
    if (displayedReqs.length === 0) {
      sections.push(`(No task-specific requirements linked. Global architectural constraints govern execution.)`);
    } else {
      displayedReqs.forEach((r) => {
        includedReqIds.push(r.id);
        sections.push(`--- Requirement ${r.id}: ${r.title} ---`);
        sections.push(`  Category: ${r.category} | Priority: ${r.priority} | Status: ${r.status}`);
        sections.push(`  Statement: ${r.statement}`);
        if (r.rationale) {
          sections.push(`  Rationale: ${r.rationale}`);
        }
        sections.push(`  Origin: ${r.source.type} (${r.source.id})`);
        if (r.acceptanceCriteria?.length) {
          sections.push(`  Acceptance Criteria:`);
          r.acceptanceCriteria.forEach((ac) => sections.push(`    - ${ac}`));
        }
        if (r.standardLinks?.length) {
          sections.push(`  Standard Controls: ${r.standardLinks.join(', ')}`);
        }
      });
    }

    const unincludedReqCount = requirements.length - displayedReqs.length;
    if (unincludedReqCount > 0) {
      omissions.push(`${unincludedReqCount} requirements out of task scope omitted per least-context policy`);
    }

    // Demonstrable relationship for Features / Capabilities:
    // Only include parent capability or directly linked features
    const relevantFeatures = features.filter((f) => {
      if (activeWorkItem?.features?.includes(f.id) || displayedReqs.some(r => r.linkedFeatureId === f.id || f.requirements.includes(r.id))) return true;
      if (activeWorkItem?.id && (f as any).workItems?.includes(activeWorkItem.id)) return true;
      if (activeWorkItem?.dependencies?.includes(f.id)) return true;
      return false;
    });

    if (relevantFeatures.length > 0) {
      sections.push(`\n=== GOVERNING FEATURES & CAPABILITIES (${relevantFeatures.length} in scope) ===`);
      relevantFeatures.forEach((f) => {
        sections.push(`* [${f.id}] ${f.title} (${f.status}) - Capability: ${f.capability}`);
        sections.push(`  Description: ${f.description}`);
      });
    }

    const omittedFeaturesCount = features.length - relevantFeatures.length;
    if (omittedFeaturesCount > 0) {
      omissions.push(`${omittedFeaturesCount} features out of task scope omitted per least-context policy`);
    }

    // Architecture & Constraints
    sections.push(`\n=== ARCHITECTURE & TECHNICAL CONSTRAINTS ===`);
    // Global Architectural Constraints
    const archConstraints = requirements.filter(
      (r) => r.category === 'ARCHITECTURE' && r.status === 'APPROVED' && !displayedReqs.some((dr) => dr.id === r.id)
    );
    if (archConstraints.length > 0) {
      sections.push(`\n[GLOBAL ARCHITECTURAL CONSTRAINTS]`);
      archConstraints.forEach((ac) => {
        sections.push(`* [${ac.id}] ${ac.title}: ${ac.statement}`);
      });
    }

    // Relevant ADRs: only include ADRs with demonstrable relationship to task or governing requirements
    const relevantAdrs = adrs.filter((adr) => {
      if (adr.status !== 'ACCEPTED') return false;
      if (activeWorkItem?.dependencies?.includes(adr.id)) return true;
      if (displayedReqs.some((r) => (r as any).adrLinks?.includes(adr.id))) return true;
      if (displayedReqs.some(r => adr.linkedRequirements?.includes(r.id))) return true;
      return false;
    });

    if (relevantAdrs.length > 0) {
      sections.push(`Governing Architecture Decisions:`);
      relevantAdrs.forEach((adr) => {
        includedAdrIds.add(adr.id);
        sections.push(`  * [${adr.id}] ${adr.title} (${adr.status}): ${adr.decision}`);
      });
    }

    const omittedAdrsCount = adrs.length - relevantAdrs.length;
    if (omittedAdrsCount > 0) {
      omissions.push(`${omittedAdrsCount} architecture decision records (ADRs) out of task scope omitted`);
    }

    // Relevant Components
    const relevantComponents = components.filter((c) => {
      if (activeWorkItem?.dependencies?.includes(c.id)) return true;
      if (displayedReqs.some((r) => (r as any).componentLinks?.includes(c.id))) return true;
      return false;
    });

    if (relevantComponents.length > 0) {
      sections.push(`System Components:`);
      relevantComponents.forEach((c) => {
        sections.push(`  * [${c.id}] ${c.name} (${c.category}) - ${c.description}`);
      });
    }

    // Security & Risks: Demonstrable relationship to governing requirements or active task
    const inScopeRiskIds = new Set<string>();
    displayedReqs.forEach((r) => {
      (r.riskLinks || []).forEach((rkId) => inScopeRiskIds.add(rkId));
    });
    if (activeWorkItem && (activeWorkItem as any).riskLinks) {
      (activeWorkItem as any).riskLinks.forEach((rkId: string) => inScopeRiskIds.add(rkId));
    }

    const relevantRisks = risks.filter((rk) => inScopeRiskIds.has(rk.id));
    sections.push(`\n=== TASK-SPECIFIC GOVERNING RISKS & CONTROLS (${relevantRisks.length} in scope) ===`);
    if (relevantRisks.length === 0) {
      sections.push(`(No task-specific risks linked. General risk floor enforced via global constraints.)`);
    } else {
      relevantRisks.forEach((rk) => {
        includedRiskIds.push(rk.id);
        sections.push(`* [${rk.id}] ${rk.title} (Inherent: ${rk.inherentLevel}, Residual: ${rk.residualLevel})`);
        sections.push(`  Treatment: ${rk.treatment} | Controls: ${rk.controls.join(', ')}`);
      });
    }

    const omittedRisksCount = risks.length - relevantRisks.length;
    if (omittedRisksCount > 0) {
      const omittedRiskIds = risks
        .filter((rk) => !inScopeRiskIds.has(rk.id))
        .map((rk) => rk.id);
      omissions.push(`${omittedRisksCount} risks out of task scope omitted per least-context policy (${omittedRiskIds.join(', ')})`);
    }

    // Global Architectural Constraints (Explicitly labeled to distinguish from task-scoped context)
    sections.push(`\n=== [GLOBAL ARCHITECTURAL CONSTRAINTS] ===`);
    sections.push(`* Respect the project's recorded scope, non-goals and explicit governing requirements.`);

    // Verification Discipline & Gating Guidance (No hardcoded test counts or static pass statuses)
    sections.push(`\n=== [VERIFICATION DISCIPLINE & QA GATING] ===`);
    sections.push(`* All proposed changes must be accompanied by explicit acceptance tests.`);
    sections.push(`* Zero-defect policy: Candidate proposals must pass all automated verification suites prior to promotion.`);
    sections.push(`* Evidence integrity: Evidence must be cryptographically recorded with honest execution metadata.`);
  } else {
    // Mode 3: Full Baseline Mode
    workItems.forEach(w=>includedWorkIds.add(w.id));
    if(activeWorkItem)includedWorkIds.add(activeWorkItem.id);
    adrs.forEach(a=>includedAdrIds.add(a.id));
    sections.push(`\n=== PROJECT WORK ITEMS ===`);
    for (const work of workItems) sections.push(`[${work.id}] ${work.title} (${work.status}): ${work.description}; Requirements: ${work.requirements.join(', ')}; Criteria: ${work.acceptanceCriteria.join('; ')}`);
    sections.push(`\n=== COMPLETE PROJECT REQUIREMENTS BASELINE (${requirements.length} items) ===`);
    requirements.forEach((r) => {
      includedReqIds.push(r.id);
      sections.push(`--- [${r.id}] ${r.title} (${r.status}) ---`);
      sections.push(`  Statement: ${r.statement}`);
      sections.push(`  Category: ${r.category} | Priority: ${r.priority} | Origin: ${r.source.type} (${r.source.id})`);
      if (r.acceptanceCriteria?.length) {
        sections.push(`  Criteria: ${r.acceptanceCriteria.join('; ')}`);
      }
    });

    sections.push(`\n=== COMPLETE RISK REGISTER (${risks.length} items) ===`);
    risks.forEach((rk) => {
      includedRiskIds.push(rk.id);
      sections.push(`* [${rk.id}] ${rk.title} (Level: ${rk.inherentLevel} -> ${rk.residualLevel}) Controls: ${rk.controls.join(', ')}`);
    });

    sections.push(`\n=== ALL FEATURES & CAPABILITIES (${features.length} items) ===`);
    features.forEach((f) => {
      sections.push(`* [${f.id}] ${f.title} (${f.status}) - ${f.description}`);
    });
    sections.push(`\n=== ARCHITECTURE DECISIONS ===`);
    adrs.forEach(a => sections.push(`[${a.id}] ${a.title} (${a.status}): ${a.decision}`));
    sections.push(`\n=== WORK MANAGEMENT ===`);
    if (activeWorkItem) sections.push(`[${activeWorkItem.id}] ${activeWorkItem.title}: ${activeWorkItem.description}`);
  }

  const editableArtifacts:EditableArtifact[] = [
    ...requirements.filter(r=>includedReqIds.includes(r.id)).map(r=>({artifact_id:r.id,artifact_type:'REQUIREMENT' as const,status:r.status,allowed_actions:['MODIFY'] as ['MODIFY']})),
    ...risks.filter(r=>includedRiskIds.includes(r.id)).map(r=>({artifact_id:r.id,artifact_type:'RISK' as const,status:(r as any).status || 'OPEN',allowed_actions:['MODIFY'] as ['MODIFY']})),
    ...adrs.filter(a=>includedAdrIds.has(a.id)).map(a=>({artifact_id:a.id,artifact_type:'ADR' as const,status:a.status,allowed_actions:['MODIFY'] as ['MODIFY']})),
    ...[...workItems,...(activeWorkItem?[activeWorkItem]:[])].filter((w,i,all)=>includedWorkIds.has(w.id)&&all.findIndex(other=>other.id===w.id)===i).map(w=>({artifact_id:w.id,artifact_type:'WORK_ITEM' as const,status:w.status,allowed_actions:['MODIFY'] as ['MODIFY']})),
  ];
  sections.push('\n=== EDITABLE CANONICAL ARTIFACTS ===');
  sections.push(JSON.stringify({editable_artifacts:editableArtifacts},null,2));
  sections.push('\n=== MANDATORY AGENT OUTPUT CONTRACT ===');
  sections.push('Respond ONLY with valid JSON using schema_version 1.1. External output never grants approval or governance status.');
  sections.push('CREATE: provide a unique proposal_id; target must be null (or absent). Proposal IDs identify external changes only. Canonical artifact IDs are assigned by docmonstakrakin after authenticated human acceptance.');
  sections.push('MODIFY: target.artifact_id MUST be copied verbatim from editable_artifacts. Never construct or infer a modification target ID; never transform or guess one. artifact_type MUST match the target artifact_type. If no valid editable target exists, do not emit MODIFY. Use CREATE for a genuinely new proposal, or record the unresolved issue in assumptions.');
  sections.push('MODIFY creates a new PROPOSED amendment; the original canonical artifact remains unchanged and fresh governance is required.');
  sections.push('REFERENCE CONTEXT is not modification authority. Features, questionnaire IDs, derivation IDs, source IDs and provenance IDs are reference-only. FEATURE mutation is unsupported: propose a WORK_ITEM or record the issue in assumptions. CODE_MODIFICATION supports CREATE of proposed work only; use WORK_ITEM for an existing work target.');
  sections.push(JSON.stringify({schema_version:'1.1',agent_role:role,summary:'Precise summary of proposed changes',assumptions:[],proposed_changes:[{proposal_id:'CHG-001',artifact_type:'REQUIREMENT',action:'CREATE',target:null,proposed:{title:'New requirement proposal',details:'Full proposed requirement statement',acceptanceCriteria:[],requirements:[],features:[],assumptions:[]}}]},null,2));

  if (includeOmissionReport && omissions.length > 0) {
    sections.push(`\n=== LEAST-CONTEXT OMISSION REPORT ===`);
    omissions.forEach((om) => sections.push(`- ${om}`));
  }

  const compiledPrompt = sections.join('\n');
  validateText(compiledPrompt, 'contextPackage');
  const tokenEstimate = Math.ceil(compiledPrompt.length / 4);

  return {
    editableArtifacts,
    handoffReady: blockers.length === 0,
    blockers,
    mode,
    role,
    compiledPrompt,
    activeWorkItem,
    includedRequirementIds: includedReqIds,
    includedRiskIds: includedRiskIds,
    omissionsReport: omissions,
    tokenEstimate,
    timestamp,
  };
}
