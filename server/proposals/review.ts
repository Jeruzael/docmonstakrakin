import { createHash, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { DerivationError, validateGenerated, validateText } from '../../src/data/generationValidation.js';
import type { ImportSession, NormalizedProposalChange } from '../../src/proposalTypes.js';
import {normalizeProposalChange,rejectGovernanceFields,ProposalValidationError} from '../../src/data/proposalContract.js';
import {validateProposalTargets} from './targetResolution.js';
import {compileContextPackage} from '../../src/data/contextPackageCompiler.js';
import type { installReviewerIdentity } from './identity.js';

export const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const fail = (path: string, message: string): never => { throw new DerivationError(path, message); };
const collections = { REQUIREMENT: 'requirements', ADR: 'adrs', RISK: 'risks', WORK_ITEM: 'workItems', CODE_MODIFICATION: 'workItems' };
const id = (prefix: string) => `${prefix}-${randomUUID()}`;

function canonical(change: NormalizedProposalChange, provenance: any, reviewer: string): any {
  const base = {id: id(change.artifactType === 'REQUIREMENT' ? 'REQ' : change.artifactType === 'ADR' ? 'ADR' : change.artifactType === 'RISK' ? 'RISK' : 'WORK'), title: change.title, status: 'PROPOSED', provenance, updatedAt: new Date().toISOString()};
  if (change.action === 'MODIFY') Object.assign(base, {proposesModificationOf: change.target!.artifactId});
  switch (change.artifactType) {
    case 'REQUIREMENT': return {...base, statement:change.details, category:'FUNCTIONAL', priority:'MEDIUM', source:{type:'EXTERNAL_AI_PROPOSAL',id:provenance.importSessionId}, riskLinks:[],threatLinks:[],standardLinks:[],workItems:[],tests:[],evidence:[],acceptanceCriteria:change.acceptanceCriteria || [], linkedFeatureId:change.features?.[0]};
    case 'ADR': return {...base,date:base.updatedAt,author:reviewer,context:change.details,decision:change.details,consequences:{positive:[],negative:[],risks:[]},linkedRequirements:change.requirements || [],linkedRisks:[],linkedStandards:[]};
    case 'RISK': return {...base,description:change.details,drivers:provenance.assumptions,inherentLikelihood:3,inherentImpact:3,inherentScore:9,inherentLevel:'MEDIUM',residualLikelihood:3,residualImpact:3,residualScore:9,residualLevel:'MEDIUM',treatment:'MITIGATE',controls:[]};
    default: return {...base,type:'TASK',description:change.details,priority:'P1',risk:'MEDIUM',sprint:0,requirements:change.requirements || [],features:change.features || [],dependencies:[],acceptanceCriteria:change.acceptanceCriteria || [],checklist:[],tests:[],evidence:[],owner:reviewer,proposalType:change.artifactType};
  }
}

export function registerProposalRoutes(app: Express, store: any, identityContext:ReturnType<typeof installReviewerIdentity>) {
  store.importSessions ||= {};
  const project = (projectId: string) => store.projects.find((p:any)=>p.id === projectId) || fail('project','Project not found');
  const session = (projectId: string, sessionId: string): ImportSession => (store.importSessions[projectId] || []).find((s:ImportSession)=>s.id === sessionId) || fail('session','Session not found in this project');
  const touch = (projectId: string) => {const p = project(projectId); p.stateVersion++; p.updatedAt = new Date().toISOString();};
  app.get('/api/projects/:id/import-sessions', (req,res)=>{project(req.params.id); res.json(store.importSessions[req.params.id] || []);});
  app.get('/api/projects/:id/import-sessions/:sessionId', (req,res)=>res.json(session(req.params.id,req.params.sessionId)));
  app.post('/api/projects/:id/import-sessions', (req,res)=>{
    const projectId = req.params.id; project(projectId);
    const raw = req.body.rawJson;
    if (typeof raw !== 'string' || !raw.trim()) fail('rawJson','Expected nonempty JSON text');
    let parsed: any; try {parsed = JSON.parse(raw);} catch {return res.status(422).json({error:{code:'PARSE_ERROR',message:'Invalid JSON'}});}
    if (!parsed || !['1.0','1.1'].includes(parsed.schema_version) || !Array.isArray(parsed.proposed_changes) || !parsed.proposed_changes.length) (() => {throw new ProposalValidationError('SCHEMA_ERROR','schema_version','Expected schema_version 1.0 or 1.1 and nonempty proposed_changes');})();
    validateText(parsed.agent_role,'agent_role'); validateText(parsed.summary,'summary');
    for (const key of ['provider','model']) {
      if (parsed[key] !== undefined) validateText(parsed[key],key);
      if (req.body[key] !== undefined && req.body[key] !== '') validateText(req.body[key],key);
    }
    if (parsed.assumptions !== undefined && (!Array.isArray(parsed.assumptions) || parsed.assumptions.some((s:any)=>typeof s !== 'string'))) fail('assumptions','Expected string array');
    rejectGovernanceFields(Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='proposed_changes')),'response');
    const scope=req.body.context;
    let editableArtifacts;
    if(scope){
      if(!['SUMMARY','TASK_CONTEXT','FULL_BASELINE'].includes(scope.mode))throw new ProposalValidationError('SCHEMA_ERROR','context.mode','Invalid compiler scope.');
      const activeWorkItem=(store.workItems[projectId] || []).find((w:any)=>w.id===scope.activeWorkItemId);
      if(scope.activeWorkItemId && !activeWorkItem)throw new ProposalValidationError('INVALID_REFERENCE','context.activeWorkItemId','Work item does not exist in this project.');
      editableArtifacts=compileContextPackage({project:project(projectId),role:parsed.agent_role,mode:scope.mode,activeWorkItem,workItems:store.workItems[projectId],requirements:store.requirements[projectId],risks:store.risks[projectId],features:store.features[projectId],adrs:store.adrs[projectId]}).editableArtifacts;
    }
    const changes = parsed.proposed_changes.map((c:any,i:number)=>normalizeProposalChange(c,parsed.schema_version,i));
    const seen=new Set<string>();
    changes.forEach((c:NormalizedProposalChange,i:number)=>{
      if(seen.has(c.proposalId))throw new ProposalValidationError('DUPLICATE_PROPOSAL_ID',`proposed_changes[${i}].proposal_id`,'Proposal IDs must be unique within the response.',{proposal_id:c.proposalId});
      seen.add(c.proposalId);validateProposalTargets(c,store,projectId,i,editableArtifacts);
    });
    const hash = digest(raw);
    const prior = (store.importSessions[projectId] || []).find((s:ImportSession)=>s.digest === hash);
    if (prior) return res.status(201).json(prior);
    const assumptions = [...(parsed.assumptions || []), ...changes.flatMap((c:any)=>c.assumptions || [])];
    for (const change of changes) {
      if (/\b(?:assum|presum|probably|recommend|consider)\w*/i.test(change.details)) assumptions.push(`Review inferred assumption in ${change.proposalId}: ${change.details}`);
      if (change.action === 'MODIFY') assumptions.push(`${change.proposalId}: acceptance creates a proposed amendment; original remains unchanged pending governance.`);
    }
    const created: ImportSession = {schemaVersion:parsed.schema_version,...(editableArtifacts?{editableArtifacts}:{}),id:id('IMPORT'),projectId,provider:parsed.provider || req.body.provider || 'Not supplied',model:parsed.model || req.body.model || 'Not supplied',timestamp:new Date().toISOString(),originalJson:raw,digest:hash,validationStatus:'AWAITING_HUMAN_REVIEW',assumptions,changes:changes.map((c:any,i:number)=>({original:structuredClone(parsed.proposed_changes[i]),normalized:c,disposition:'PENDING',artifactIds:[]}))};
    (store.importSessions[projectId] ||= []).unshift(created);
    store.addAuditEvent(projectId,'External model','IMPORT_VALIDATED',created.id,'Schema and semantic validation complete; no canonical artifacts created',{digest:hash,assumptions});
    touch(projectId); res.status(201).json(created);
  });
  app.post('/api/projects/:id/import-sessions/:sessionId/changes/:index/review',(req,res)=>{
    const identity=identityContext.requireHuman(req,res);if(!identity)return;
    const s = session(req.params.id,req.params.sessionId);
    const change = s.changes[Number(req.params.index)];
    if (!change) return res.status(404).json({error:'Change not found'});
    const {disposition,humanConfirmed,modified} = req.body;
    if (req.body.reviewer || req.body.reviewerName || req.body.actorType==='AGENT' || humanConfirmed!==true)return res.status(403).json({error:'Use your authenticated human identity and confirm this review; body identity claims are rejected'});
    const reviewer=identity.name;
    if (!['ACCEPTED','MODIFIED','REJECTED'].includes(disposition)) fail('disposition','Expected ACCEPTED, MODIFIED or REJECTED');
    const index=Number(req.params.index);
    const original=normalizeProposalChange(change.original,s.schemaVersion || ('proposal_id' in change.original?'1.1':'1.0'),index);
    if (change.disposition !== 'PENDING') {
      if (change.disposition === disposition && change.reviewer === reviewer && (disposition !== 'MODIFIED' || digest(change.modified && ('schemaVersion' in change.modified?change.modified:normalizeProposalChange(change.modified,'1.0',index))) === digest({...original,...modified}))) return res.json(s);
      return res.status(409).json({error:'Change already reviewed; history cannot be overwritten'});
    }
    let effective = original;
    if (disposition === 'MODIFIED') {
      if (!modified || Object.keys(modified).some(k=>!['title','details','acceptanceCriteria','requirements','features','assumptions'].includes(k))) fail('modified','Only content and traceability fields may be modified');
      effective = {...original,...modified};
    }
    if (disposition !== 'REJECTED') {
      effective=normalizeProposalChange({proposal_id:effective.proposalId,artifact_type:effective.artifactType,action:effective.action,target:effective.target?{artifact_id:effective.target.artifactId,artifact_type:effective.target.artifactType}:null,proposed:Object.fromEntries(['title','details','acceptanceCriteria','requirements','features','assumptions'].filter(k=>(effective as any)[k]!==undefined).map(k=>[k,(effective as any)[k]]))},'1.1',index);
      effective.schemaVersion=original.schemaVersion;
      validateProposalTargets(effective,store,s.projectId,index,s.editableArtifacts);
      const provenance = {origin:'EXTERNAL_AI_PROPOSAL',importSessionId:s.id,provider:s.provider,model:s.model,timestamp:new Date().toISOString(),originalProposalId:original.proposalId,proposalSchemaVersion:original.schemaVersion,target:original.target || null,originalJsonDigest:s.digest,humanReviewer:reviewer,reviewDisposition:disposition,assumptions:[...new Set([...s.assumptions,...(effective.assumptions || [])])],resultingCanonicalArtifactIds:[] as string[]};
      const artifact = canonical(effective,provenance,reviewer);
      Object.assign(provenance,{authenticatedIdentity:identity.id,roleSource:identity.roleSource});
      provenance.resultingCanonicalArtifactIds.push(artifact.id);
      validateGenerated(artifact);
      (store[collections[effective.artifactType]][s.projectId] ||= []).push(artifact);
      change.artifactIds = [artifact.id];
      if (effective.artifactType === 'REQUIREMENT') for (const f of store.features[s.projectId] || []) if (effective.features?.includes(f.id)) f.requirements = [...new Set([...f.requirements,artifact.id])];
      if (['WORK_ITEM','CODE_MODIFICATION'].includes(effective.artifactType)) for (const r of store.requirements[s.projectId] || []) if (artifact.requirements.includes(r.id)) r.workItems = [...new Set([...r.workItems,artifact.id])];
    }
    Object.assign(change,{disposition,reviewer,reviewedAt:new Date().toISOString(),...(disposition === 'MODIFIED' ? {modified:effective} : {})});
    s.validationStatus = s.changes.some(c=>c.disposition === 'PENDING') ? 'AWAITING_HUMAN_REVIEW' : 'REVIEW_COMPLETE';
    const event = store.addAuditEvent(s.projectId,reviewer,'IMPORT_CHANGE_REVIEWED',s.id,disposition,{authenticatedIdentity:identity.id,roleSource:identity.roleSource,originalProposalId:original.proposalId,digest:s.digest,disposition,artifactIds:change.artifactIds,modified:change.modified || null});
    change.auditId = event.id; touch(s.projectId); res.json(s);
  });
}
