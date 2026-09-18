import type {NormalizedProposalChange,ProposalDiagnostic} from '../proposalTypes.js';
import {DerivationError,validateText,validateGenerated} from './generationValidation.js';

export class ProposalValidationError extends DerivationError {
  constructor(code:string,path:string,message:string,public context:Partial<ProposalDiagnostic>={}) {super(path,message);this.code=code;this.message=message;}
  toJSON(){return {...super.toJSON(),...Object.fromEntries(Object.entries(this.context).filter(([,value])=>typeof value==='string'))};}
}
export const proposalCollections={REQUIREMENT:'requirements',ADR:'adrs',RISK:'risks',WORK_ITEM:'workItems',CODE_MODIFICATION:'workItems'} as const;
/** Historical wire data remains readable even when it predates current validation rules. */
export function proposalForDisplay(raw:unknown,version:'1.0'|'1.1',index:number) {
  try{return {display:normalizeProposalChange(raw,version,index),displayError:null};}
  catch(e){return {display:null,displayError:e instanceof Error?e.message:'Historical proposal cannot be normalized.'};}
}
export function rejectGovernanceFields(value:unknown,path:string,context:Partial<ProposalDiagnostic>={}) {
  if (!value || typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)) {
    if (/^(approvals?|approvalsCollected|signatures?|reviewer|reviewerName|reviewerRole|humanReviewer|authorizedRole|authorizedBy|roles?|requiredRoles|governancePolicy|policyGates|roleSource|authenticatedIdentity|identityId|actorType|humanConfirmed)$/i.test(key) || (key==='status' && child!=='PROPOSED'))throw new ProposalValidationError('GOVERNANCE_FIELD_FORBIDDEN',`${path}.${key}`,'External proposals cannot supply human identity, approval or governance authority.',context);
    rejectGovernanceFields(child,`${path}.${key}`,context);
  }
}

/** Legacy wire data stays intact; all semantic decisions use distinct normalized identities. */
export function normalizeProposalChange(raw:any,version:'1.0'|'1.1',index:number):NormalizedProposalChange {
  const path=`proposed_changes[${index}]`;
  const ctx={proposal_id:version==='1.1'?raw?.proposal_id:raw?.id,artifact_type:version==='1.1'?raw?.artifact_type:raw?.type};
  const fail=(code:string,field:string,message:string):never=>{throw new ProposalValidationError(code,`${path}${field?'.'+field:''}`,message,ctx);};
  if(!raw || typeof raw!=='object' || Array.isArray(raw))fail('SCHEMA_ERROR','','Expected proposal object.');
  rejectGovernanceFields(raw,path,ctx);
  const artifactType=version==='1.1'?raw.artifact_type:raw.type;
  if(!Object.hasOwn(proposalCollections,artifactType))fail('UNSUPPORTED_ARTIFACT_TYPE',version==='1.1'?'artifact_type':'type','Unsupported proposal artifact type. Features are reference-only.');
  if(!['CREATE','MODIFY'].includes(raw.action))fail('SCHEMA_ERROR','action','Expected CREATE or MODIFY.');
  const content=version==='1.1'?raw.proposed:raw;
  if(!content || typeof content!=='object' || Array.isArray(content))fail('SCHEMA_ERROR','proposed','Expected proposed content object.');
  if(version==='1.1'){
    for(const key of Object.keys(raw))if(!['proposal_id','artifact_type','action','target','proposed'].includes(key))fail('SCHEMA_ERROR',key,'Unknown schema 1.1 proposal field.');
    for(const key of Object.keys(content))if(!['title','details','acceptanceCriteria','requirements','features','assumptions'].includes(key))fail('SCHEMA_ERROR',`proposed.${key}`,'Unknown proposed content field.');
    if(raw.target && typeof raw.target==='object')for(const key of Object.keys(raw.target))if(!['artifact_id','artifact_type'].includes(key))fail('SCHEMA_ERROR',`target.${key}`,'Unknown target field.');
  }
  const text=(value:any,field:string)=>{try{validateText(value,`${path}.${field}`);}catch(e){const err=e as DerivationError;throw new ProposalValidationError(err.code==='INVALID_TEMPLATE_ARTIFACT'?err.code:'SCHEMA_ERROR',err.path,err.message,ctx);}};
  const wireId=version==='1.1'?raw.proposal_id:raw.id;text(wireId,version==='1.1'?'proposal_id':'id');
  for(const key of ['title','details'])text(content[key],version==='1.1'?`proposed.${key}`:key);
  for(const key of ['acceptanceCriteria','requirements','features','assumptions'])if(content[key]!==undefined){
    if(!Array.isArray(content[key]))fail('SCHEMA_ERROR',version==='1.1'?`proposed.${key}`:key,'Expected string array.');
    content[key].forEach((v:any,i:number)=>text(v,`${version==='1.1'?'proposed.':''}${key}[${i}]`));
  }
  let target;
  if(raw.action==='MODIFY'){
    if(version==='1.1'){
      if(!raw.target || typeof raw.target!=='object' || Array.isArray(raw.target))fail('SCHEMA_ERROR','target','MODIFY requires an explicit canonical target.');
      text(raw.target.artifact_id,'target.artifact_id');text(raw.target.artifact_type,'target.artifact_type');
      target={artifactId:raw.target.artifact_id,artifactType:raw.target.artifact_type};
    }else target={artifactId:raw.id,artifactType};
  }else if(version==='1.1' && raw.target!==undefined && raw.target!==null)fail('SCHEMA_ERROR','target','CREATE target must be null or absent; canonical IDs are assigned after human acceptance.');
  if(version==='1.1' && ('id' in raw || 'id' in content))fail('SCHEMA_ERROR','id','Use proposal_id and explicit target; canonical IDs cannot be supplied for CREATE.');
  try{validateGenerated(content,`${path}${version==='1.1'?'.proposed':''}`);}catch(e){const err=e as DerivationError;throw new ProposalValidationError(err.code,err.path,err.message,ctx);}
  return {schemaVersion:version,proposalId:version==='1.0' && raw.action==='MODIFY'?`LEGACY-MODIFY-${index+1}`:wireId,artifactType,action:raw.action,...(target?{target}:{}),title:content.title,details:content.details,...Object.fromEntries(['acceptanceCriteria','requirements','features','assumptions'].filter(k=>content[k]!==undefined).map(k=>[k,content[k]]))};
}
