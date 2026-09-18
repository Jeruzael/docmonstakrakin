import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { digest } from './review.js';
import { validateText } from '../../src/data/generationValidation.js';
import { installReviewerIdentity } from './identity.js';

export function registerSignoffRoutes(app: Express, store: any) {
  const {requireHuman} = installReviewerIdentity(app);
  const roles = ['Security Officer','Lead Architect'];
  const mapping = {REQUIREMENT:['requirements','REQUIREMENT_BASELINE'],ADR:['adrs','ADR_SIGN_OFF'],RISK:['risks','RISK_ACCEPTANCE'],OVERRIDE:['overrides','SECURITY_OVERRIDE']};
  app.get('/api/projects/:id/governance-policy', (req,res)=>res.json({requiredRoles:roles}));
  app.post('/api/projects/:id/approvals',(req,res)=>{
    const identity=requireHuman(req,res); if (!identity) return;
    const p = store.projects.find((p:any)=>p.id === req.params.id); if (!p) return res.status(404).json({error:'Project not found'});
    const {targetEntityType,targetEntityId} = req.body;
    const requestedBy = identity.name;
    const spec = Object.hasOwn(mapping,targetEntityType) ? mapping[targetEntityType] : null;
    if (!spec) return res.status(422).json({error:'Use the dedicated release gate ceremony for release sign-off; select a canonical requirement, ADR, risk or override here'});
    const target = (store[spec[0]][p.id] || []).find((a:any)=>a.id === targetEntityId);
    if (!target) return res.status(404).json({error:'Canonical target not found in this project'});
    validateText(requestedBy,'requestedBy');
    const prior = (store.approvals[p.id] || []).find((a:any)=>a.targetEntityId === targetEntityId && a.policyVersion === 'LOCAL_SESSION_V1' && a.status === 'PENDING' && a.targetDigest === digest(target));
    if (prior) return res.status(201).json(prior);
    const item = {id:`APV-${randomUUID()}`,projectId:p.id,title:target.title || target.gateOrControl,type:spec[1],targetEntityId,targetEntityType,requestedBy,requestedAt:new Date().toISOString(),status:'PENDING',urgency:'HIGH',riskLevel:'MEDIUM',description:target.statement || target.context || target.description || target.reason,impactAnalysis:'Human sign-off of canonical proposed artifact',requiredRoles:[...roles],approvalsCollected:[],targetDigest:digest(target),policyGates:[{gateName:'Canonical target exists',passed:true,details:'Target resolved within this project; distinct authorized humans required'}]};
    Object.assign(item,{policyVersion:'LOCAL_SESSION_V1'});
    (store.approvals[p.id] ||= []).unshift(item); p.stateVersion++;
    store.addAuditEvent(p.id,requestedBy,'APPROVAL_REQUESTED',item.id,'Explicit Request Sign-Off',{targetEntityId,authenticatedIdentity:identity.id,roleSource:identity.roleSource});
    res.status(201).json(item);
  });
  app.post('/api/projects/:id/approvals/:apvId/decide',(req,res)=>{
    const identity=requireHuman(req,res); if (!identity) return;
    const item = (store.approvals[req.params.id] || []).find((a:any)=>a.id === req.params.apvId);
    if (!item) return res.status(404).json({error:'Approval request not found'});
    if (item.policyVersion !== 'LOCAL_SESSION_V1') return res.status(409).json({error:'Historical approval policy; request fresh authenticated sign-off'});
    const {decision,humanConfirmed,comment} = req.body;
    if (req.body.approver || req.body.role || req.body.reviewerName || req.body.reviewerRole || req.body.authorizedRole || req.body.actorType === 'AGENT') return res.status(403).json({error:'Identity and role claims are not accepted; the server uses your authenticated session'});
    const approver=identity.name;
    const role=roles.find(r=>identity.roles.includes(r));
    if (humanConfirmed!==true || !role || JSON.stringify(item.requiredRoles)!==JSON.stringify(roles)) return res.status(403).json({error:'Canonical policy and explicit human confirmation required'});
    if (!['APPROVED','REJECTED'].includes(decision)) return res.status(422).json({error:'Invalid decision'});
    if (item.status !== 'PENDING' || item.approvalsCollected.some((a:any)=>a.role === role || a.identityId === identity.id || a.approver === approver)) return res.status(409).json({error:'Request resolved or duplicate reviewer/role'});
    const collection = mapping[item.targetEntityType]?.[0];
    const target = (store[collection]?.[req.params.id] || []).find((a:any)=>a.id === item.targetEntityId);
    if (!target || digest(target) !== item.targetDigest) return res.status(409).json({error:'Target changed; request fresh sign-off'});
    item.approvalsCollected.push({role,approver,identityId:identity.id,roleSource:identity.roleSource,decision,timestamp:new Date().toISOString(),comment});
    if (decision === 'REJECTED') item.status = 'REJECTED';
    else if (item.requiredRoles.every((r:string)=>item.approvalsCollected.some((a:any)=>a.role === r && a.decision === 'APPROVED'))) item.status = 'APPROVED';
    if (item.status !== 'PENDING') {
      item.resolvedAt = new Date().toISOString(); item.resolvedBy = approver;
      if (item.status === 'APPROVED') { target.status = item.targetEntityType === 'ADR' ? 'ACCEPTED' : 'APPROVED'; if (item.targetEntityType === 'OVERRIDE') target.authorizedBy = item.id; }
    }
    store.projects.find((p:any)=>p.id === req.params.id).stateVersion++;
    store.addAuditEvent(req.params.id,approver,'GOVERNANCE_SIGNATURE',item.id,decision,{role,authenticatedIdentity:identity.id,roleSource:identity.roleSource,comment:comment || '',status:item.status});
    res.json(item);
  });
  return {requireHuman};
}
