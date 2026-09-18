import type { Project, Feature, TechChoice, TechnicalBaseline, AssuranceInputs } from '../types.js';
import { DerivationError, validateText } from './generationValidation.js';

export const TECH_DOMAINS = ['frontend', 'backend', 'database', 'authentication', 'storage', 'apiApproach', 'deployment', 'sourceControl', 'testing', 'aiProvider'] as const;
export const emptyAssurance: AssuranceInputs = { publicInternetExposure: null, pii: null, regulatedData: null, productionSecrets: null, destructiveOperations: null, autonomousAgentExecution: null, securitySensitivity: 'UNKNOWN', complianceProfile: [] };

export function validateProjectDraft(body:any):void {
  const strings=(v:unknown,key:string)=>{if(!Array.isArray(v) || v.some(x=>typeof x!=='string'))throw new DerivationError(key,'Expected string array');};
  for(const key of ['profiles','specializedProfiles']) if(body[key]!==undefined)strings(body[key],key);
  if(body.productBaseline!==undefined){
    if(!body.productBaseline || typeof body.productBaseline!=='object' || Array.isArray(body.productBaseline))throw new DerivationError('productBaseline','Expected object');
    for(const key of ['coreFeatures','coreCapabilities','targetUsers','primaryWorkflows','nonGoals','successCriteria'])if(body.productBaseline[key]!==undefined)strings(body.productBaseline[key],key);
  }
  if(body.assuranceInputs!==undefined){
    if(!body.assuranceInputs || typeof body.assuranceInputs!=='object')throw new DerivationError('assuranceInputs','Expected object');
    for(const key of ['publicInternetExposure','pii','regulatedData','productionSecrets','destructiveOperations','autonomousAgentExecution']) {
      const v=body.assuranceInputs[key];if(v!==undefined && v!==null && typeof v!=='boolean')throw new DerivationError(key,'Expected boolean or unknown');
    }
    if(body.assuranceInputs.securitySensitivity!==undefined && !['UNKNOWN','LOW','MEDIUM','HIGH'].includes(body.assuranceInputs.securitySensitivity))throw new DerivationError('securitySensitivity','Invalid sensitivity');
    if(body.assuranceInputs.complianceProfile!==undefined)strings(body.assuranceInputs.complianceProfile,'complianceProfile');
  }
}

export function normalizeTechChoice(choice?: TechChoice): TechChoice {
  const mode = choice?.decision_mode || choice?.type || 'UNKNOWN';
  if(!['UNKNOWN','USER_SPECIFIED','RECOMMEND_FOR_ME'].includes(mode))throw new DerivationError('technicalBaseline','Invalid decision mode');
  const selected = mode === 'USER_SPECIFIED' ? (choice?.userValue ?? choice?.finalSelection ?? choice?.value ?? null)
    : mode === 'RECOMMEND_FOR_ME' && choice?.recommendation?.status === 'ACCEPTED' ? choice.finalSelection ?? null : null;
  if (selected) validateText(selected, 'technicalSelection');
  return { type: mode, decision_mode: mode, userValue: mode === 'USER_SPECIFIED' ? selected : null,
    recommendation: mode === 'RECOMMEND_FOR_ME' ? choice?.recommendation ?? null : null,
    finalSelection: selected, final_selection: selected, value: selected, status: 'NOT_RATIFIED' };
}
export function normalizeTechnicalBaseline(baseline?: TechnicalBaseline): TechnicalBaseline {
  return Object.fromEntries(TECH_DOMAINS.map(k => [k, normalizeTechChoice(baseline?.[k])])) as unknown as TechnicalBaseline;
}
export function computeAssurance(inputs: AssuranceInputs, profiles: string[] = [], specialized: string[] = []): NonNullable<Project['computedRisk']> {
  const drivers = Object.entries(inputs).filter(([key, value]) => value === true && key !== 'complianceProfile').map(([key]) => key);
  let score = 9; // Retain the existing L3 × I3 initial uncertainty floor.
  if (inputs.publicInternetExposure || inputs.pii || inputs.destructiveOperations) score = 12;
  if (inputs.productionSecrets || inputs.regulatedData || inputs.securitySensitivity === 'HIGH' || specialized.includes('FINANCIAL')) score = 16;
  if ((inputs.autonomousAgentExecution || profiles.includes('AGENTIC_AI_APPLICATION')) && (inputs.productionSecrets || inputs.destructiveOperations)) score = 25;
  return { score, level: score >= 20 ? 'CRITICAL' : score >= 15 ? 'HIGH' : score >= 6 ? 'MEDIUM' : 'LOW', drivers };
}
export function baselineFeatures(project: Project, existing: Feature[] = []): Feature[] {
  const result = [...existing];
  for (const title of project.productBaseline?.coreFeatures || []) {
    if (!title.trim()) continue;
    validateText(title, 'productBaseline.coreFeatures');
    if (result.some(f => f.source === 'PRODUCT_BASELINE' && f.title.trim().toLowerCase() === title.trim().toLowerCase())) continue;
    const index = result.length + 1;
    result.push({ id: `FEAT-${project.id}-${String(index).padStart(3, '0')}`, title: title.trim(), description: title.trim(),
      capability: project.productBaseline?.coreCapabilities?.[index - 1] || 'Product', priority: 'P1', status: 'PROPOSED', source: 'PRODUCT_BASELINE',
      personas: project.productBaseline?.targetUsers || [], requirements: [], dependencies: [], updatedAt: project.createdAt,
      provenance: {projectId: project.id, origin: 'PRODUCT_BASELINE', input: title, timestamp: project.createdAt} });
  }
  return result;
}
