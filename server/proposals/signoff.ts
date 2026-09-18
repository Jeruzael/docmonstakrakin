import type { Express } from 'express';
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { digest } from './review.js';
import { validateText } from '../../src/data/generationValidation.js';

export function registerSignoffRoutes(app: Express, store: any) {
  const configured = JSON.parse(process.env.DMK_HUMAN_REVIEWERS || '{}');
  const roles = ['Security Officer','Lead Architect'];
  const mapping = {REQUIREMENT:['requirements','REQUIREMENT_BASELINE'],ADR:['adrs','ADR_SIGN_OFF'],RISK:['risks','RISK_ACCEPTANCE'],OVERRIDE:['overrides','SECURITY_OVERRIDE']};
  const authorized = (name: string, role: string, credential: unknown) => {
    const reviewer = Object.hasOwn(configured, name || '') ? configured[name] : null;
    if (!reviewer || !Array.isArray(reviewer.roles) || !reviewer.roles.includes(role) || typeof credential !== 'string' || credential.length > 1024) return false;
    const [salt, hash] = String(reviewer.credentialVerifier || '').split(':');
    if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(hash || '')) return false;
    return timingSafeEqual(scryptSync(credential, salt, 32), Buffer.from(hash, 'hex'));
  };
  app.get('/api/projects/:id/governance-policy', (req,res)=>res.json({requiredRoles:roles,humanReviewers:Object.fromEntries(Object.entries(configured).map(([name, value]:[string,any])=>[name,Array.isArray(value.roles)?value.roles:[]]))}));
  app.post('/api/projects/:id/approvals',(req,res)=>{
    const p = store.projects.find((p:any)=>p.id === req.params.id); if (!p) return res.status(404).json({error:'Project not found'});
    const {targetEntityType,targetEntityId,requestedBy} = req.body;
    const spec = mapping[targetEntityType];
    if (!spec) return res.status(422).json({error:'Use the dedicated release gate ceremony for release sign-off; select a canonical requirement, ADR, risk or override here'});
    const target = (store[spec[0]][p.id] || []).find((a:any)=>a.id === targetEntityId);
    if (!target) return res.status(404).json({error:'Canonical target not found in this project'});
    validateText(requestedBy,'requestedBy');
    const prior = (store.approvals[p.id] || []).find((a:any)=>a.targetEntityId === targetEntityId && a.status === 'PENDING' && a.targetDigest === digest(target));
    if (prior) return res.status(201).json(prior);
    const item = {id:`APV-${randomUUID()}`,projectId:p.id,title:target.title || target.gateOrControl,type:spec[1],targetEntityId,targetEntityType,requestedBy,requestedAt:new Date().toISOString(),status:'PENDING',urgency:'HIGH',riskLevel:'MEDIUM',description:target.statement || target.context || target.description || target.reason,impactAnalysis:'Human sign-off of canonical proposed artifact',requiredRoles:[...roles],approvalsCollected:[],targetDigest:digest(target),policyGates:[{gateName:'Canonical target exists',passed:true,details:'Target resolved within this project; distinct authorized humans required'}]};
    (store.approvals[p.id] ||= []).unshift(item); p.stateVersion++;
    store.addAuditEvent(p.id,requestedBy,'APPROVAL_REQUESTED',item.id,'Explicit Request Sign-Off',{targetEntityId});
    res.status(201).json(item);
  });
  app.post('/api/projects/:id/approvals/:apvId/decide',(req,res)=>{
    const item = (store.approvals[req.params.id] || []).find((a:any)=>a.id === req.params.apvId);
    if (!item) return res.status(404).json({error:'Approval request not found'});
    const {decision,approver,role,actorType,humanConfirmed,comment,credential} = req.body;
    if (actorType !== 'HUMAN' || humanConfirmed !== true || typeof approver !== 'string' || !authorized(approver,role,credential) || !item.requiredRoles.includes(role) || /\b(agent|bot|codex|gemini|gpt)\b/i.test(approver)) return res.status(403).json({error:'A configured human reviewer credential, assigned role and explicit confirmation are required.'});
    if (!['APPROVED','REJECTED'].includes(decision)) return res.status(422).json({error:'Invalid decision'});
    if (item.status !== 'PENDING' || item.approvalsCollected.some((a:any)=>a.role === role || a.approver === approver)) return res.status(409).json({error:'Request resolved or duplicate reviewer/role'});
    const collection = mapping[item.targetEntityType]?.[0];
    const target = (store[collection]?.[req.params.id] || []).find((a:any)=>a.id === item.targetEntityId);
    if (!target || digest(target) !== item.targetDigest) return res.status(409).json({error:'Target changed; request fresh sign-off'});
    item.approvalsCollected.push({role,approver,decision,timestamp:new Date().toISOString(),comment});
    if (decision === 'REJECTED') item.status = 'REJECTED';
    else if (item.requiredRoles.every((r:string)=>item.approvalsCollected.some((a:any)=>a.role === r && a.decision === 'APPROVED'))) item.status = 'APPROVED';
    if (item.status !== 'PENDING') {
      item.resolvedAt = new Date().toISOString(); item.resolvedBy = approver;
      if (item.status === 'APPROVED') { target.status = item.targetEntityType === 'ADR' ? 'ACCEPTED' : 'APPROVED'; if (item.targetEntityType === 'OVERRIDE') target.authorizedBy = item.id; }
    }
    store.projects.find((p:any)=>p.id === req.params.id).stateVersion++;
    store.addAuditEvent(req.params.id,approver,'GOVERNANCE_SIGNATURE',item.id,decision,{role,comment:comment || '',status:item.status});
    res.json(item);
  });
}
