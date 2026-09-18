import { createHash, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { DerivationError, validateGenerated, validateText } from '../../src/data/generationValidation.js';
import type { ImportSession, ProposalChange } from '../../src/proposalTypes.js';

export const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const fail = (path: string, message: string): never => { throw new DerivationError(path, message); };
const collections = { REQUIREMENT: 'requirements', ADR: 'adrs', RISK: 'risks', WORK_ITEM: 'workItems', CODE_MODIFICATION: 'workItems' };
const id = (prefix: string) => `${prefix}-${randomUUID()}`;

function checkChange(change: any, store: any, projectId: string): ProposalChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) fail('change', 'Expected object');
  if (!Object.hasOwn(collections, change.type)) fail('change.type', 'Unsupported proposal type');
  if (!['CREATE', 'MODIFY'].includes(change.action)) fail('change.action', 'Expected CREATE or MODIFY');
  for (const key of ['id','title','details']) validateText(change[key], `change.${key}`);
  for (const key of ['acceptanceCriteria','requirements','features','assumptions']) {
    if (change[key] !== undefined && (!Array.isArray(change[key]) || change[key].some((v:any) => typeof v !== 'string'))) fail(`change.${key}`, 'Expected array of strings');
  }
  if (change.status && change.status !== 'PROPOSED') fail('change.status','Import cannot grant governance status');
  if (change.approvalsCollected || change.signatures || change.requiredRoles) fail('change', 'Proposals cannot supply signatures or governance policy');
  if (change.action === 'MODIFY' && !(store[collections[change.type]][projectId] || []).some((a:any)=>a.id === change.id)) fail('change.id', 'Modification target not found in this project');
  for (const [field, collection] of [['requirements','requirements'],['features','features']]) for (const ref of change[field] || []) {
    if (!(store[collection][projectId] || []).some((a:any)=>a.id === ref)) fail(`change.${field}`, 'Reference is not in this project');
  }
  validateGenerated(change);
  return change;
}

function canonical(change: ProposalChange, provenance: any, reviewer: string): any {
  const base = {id: id(change.type === 'REQUIREMENT' ? 'REQ' : change.type === 'ADR' ? 'ADR' : change.type === 'RISK' ? 'RISK' : 'WORK'), title: change.title, status: 'PROPOSED', provenance, updatedAt: new Date().toISOString()};
  if (change.action === 'MODIFY') Object.assign(base, {proposesModificationOf: change.id});
  switch (change.type) {
    case 'REQUIREMENT': return {...base, statement:change.details, category:'FUNCTIONAL', priority:'MEDIUM', source:{type:'EXTERNAL_AI_PROPOSAL',id:provenance.importSessionId}, riskLinks:[],threatLinks:[],standardLinks:[],workItems:[],tests:[],evidence:[],acceptanceCriteria:change.acceptanceCriteria || [], linkedFeatureId:change.features?.[0]};
    case 'ADR': return {...base,date:base.updatedAt,author:reviewer,context:change.details,decision:change.details,consequences:{positive:[],negative:[],risks:[]},linkedRequirements:change.requirements || [],linkedRisks:[],linkedStandards:[]};
    case 'RISK': return {...base,description:change.details,drivers:provenance.assumptions,inherentLikelihood:3,inherentImpact:3,inherentScore:9,inherentLevel:'MEDIUM',residualLikelihood:3,residualImpact:3,residualScore:9,residualLevel:'MEDIUM',treatment:'MITIGATE',controls:[]};
    default: return {...base,type:'TASK',description:change.details,priority:'P1',risk:'MEDIUM',sprint:0,requirements:change.requirements || [],features:change.features || [],dependencies:[],acceptanceCriteria:change.acceptanceCriteria || [],checklist:[],tests:[],evidence:[],owner:reviewer,proposalType:change.type};
  }
}

export function registerProposalRoutes(app: Express, store: any) {
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
    if (!parsed || parsed.schema_version !== '1.0' || !Array.isArray(parsed.proposed_changes) || !parsed.proposed_changes.length) fail('schema','Expected schema_version 1.0 and nonempty proposed_changes');
    validateText(parsed.agent_role,'agent_role'); validateText(parsed.summary,'summary');
    for (const key of ['provider','model']) {
      if (parsed[key] !== undefined) validateText(parsed[key],key);
      if (req.body[key] !== undefined) validateText(req.body[key],key);
    }
    if (parsed.assumptions !== undefined && (!Array.isArray(parsed.assumptions) || parsed.assumptions.some((s:any)=>typeof s !== 'string'))) fail('assumptions','Expected string array');
    if (parsed.signatures || parsed.approvals) fail('schema','External proposals cannot submit approvals');
    const changes = parsed.proposed_changes.map((c:any)=>checkChange(c,store,projectId));
    if (new Set(changes.map((c:any)=>c.id)).size !== changes.length) fail('proposed_changes','Duplicate original proposal IDs');
    const hash = digest(raw);
    const prior = (store.importSessions[projectId] || []).find((s:ImportSession)=>s.digest === hash);
    if (prior) return res.status(201).json(prior);
    const assumptions = [...(parsed.assumptions || []), ...changes.flatMap((c:any)=>c.assumptions || [])];
    for (const change of changes) {
      if (/\b(?:assum|presum|probably|recommend|consider)\w*/i.test(change.details)) assumptions.push(`Review inferred assumption in ${change.id}: ${change.details}`);
      if (change.action === 'MODIFY') assumptions.push(`${change.id}: acceptance creates a proposed amendment; original remains unchanged pending governance.`);
    }
    const created: ImportSession = {id:id('IMPORT'),projectId,provider:parsed.provider || req.body.provider || 'Not supplied',model:parsed.model || req.body.model || 'Not supplied',timestamp:new Date().toISOString(),originalJson:raw,digest:hash,validationStatus:'AWAITING_HUMAN_REVIEW',assumptions,changes:changes.map((c:any)=>({original:structuredClone(c),disposition:'PENDING',artifactIds:[]}))};
    (store.importSessions[projectId] ||= []).unshift(created);
    store.addAuditEvent(projectId,'External model','IMPORT_VALIDATED',created.id,'Schema and semantic validation complete; no canonical artifacts created',{digest:hash,assumptions});
    touch(projectId); res.status(201).json(created);
  });
  app.post('/api/projects/:id/import-sessions/:sessionId/changes/:index/review',(req,res)=>{
    const s = session(req.params.id,req.params.sessionId);
    const change = s.changes[Number(req.params.index)];
    if (!change) return res.status(404).json({error:'Change not found'});
    const {disposition,reviewer,actorType,humanConfirmed,modified} = req.body;
    if (actorType !== 'HUMAN' || humanConfirmed !== true || typeof reviewer !== 'string' || !reviewer.trim() || /\b(agent|bot|codex|gemini|gpt)\b/i.test(reviewer)) return res.status(403).json({error:'Explicit human review and reviewer name required'});
    if (!['ACCEPTED','MODIFIED','REJECTED'].includes(disposition)) fail('disposition','Expected ACCEPTED, MODIFIED or REJECTED');
    if (change.disposition !== 'PENDING') {
      if (change.disposition === disposition && change.reviewer === reviewer && (disposition !== 'MODIFIED' || digest(change.modified) === digest({...change.original,...modified}))) return res.json(s);
      return res.status(409).json({error:'Change already reviewed; history cannot be overwritten'});
    }
    let effective = change.original;
    if (disposition === 'MODIFIED') {
      if (!modified || Object.keys(modified).some(k=>!['title','details','acceptanceCriteria','requirements','features','assumptions'].includes(k))) fail('modified','Only content and traceability fields may be modified');
      effective = {...change.original,...modified};
    }
    if (disposition !== 'REJECTED') {
      checkChange(effective,store,s.projectId);
      const provenance = {origin:'EXTERNAL_AI_PROPOSAL',importSessionId:s.id,provider:s.provider,model:s.model,timestamp:new Date().toISOString(),originalProposalId:change.original.id,originalJsonDigest:s.digest,humanReviewer:reviewer,reviewDisposition:disposition,assumptions:[...new Set([...s.assumptions,...(effective.assumptions || [])])],resultingCanonicalArtifactIds:[] as string[]};
      const artifact = canonical(effective,provenance,reviewer);
      provenance.resultingCanonicalArtifactIds.push(artifact.id);
      validateGenerated(artifact);
      (store[collections[effective.type]][s.projectId] ||= []).push(artifact);
      change.artifactIds = [artifact.id];
      if (effective.type === 'REQUIREMENT') for (const f of store.features[s.projectId] || []) if (effective.features?.includes(f.id)) f.requirements = [...new Set([...f.requirements,artifact.id])];
      if (['WORK_ITEM','CODE_MODIFICATION'].includes(effective.type)) for (const r of store.requirements[s.projectId] || []) if (artifact.requirements.includes(r.id)) r.workItems = [...new Set([...r.workItems,artifact.id])];
    }
    Object.assign(change,{disposition,reviewer,reviewedAt:new Date().toISOString(),...(disposition === 'MODIFIED' ? {modified:effective} : {})});
    s.validationStatus = s.changes.some(c=>c.disposition === 'PENDING') ? 'AWAITING_HUMAN_REVIEW' : 'REVIEW_COMPLETE';
    const event = store.addAuditEvent(s.projectId,reviewer,'IMPORT_CHANGE_REVIEWED',s.id,disposition,{originalProposalId:change.original.id,digest:s.digest,disposition,artifactIds:change.artifactIds,modified:change.modified || null});
    change.auditId = event.id; touch(s.projectId); res.json(s);
  });
}
