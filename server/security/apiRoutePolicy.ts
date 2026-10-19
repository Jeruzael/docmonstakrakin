import type {RequestHandler} from 'express';

export const API_ROUTE_POLICIES=[
  {method:"GET",path:"/api/health",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/secrets/metadata",access:"BLOCKED_SECRET_ADMIN"},
  {method:"POST",path:"/api/secrets",access:"BLOCKED_SECRET_ADMIN"},
  {method:"DELETE",path:"/api/secrets/:key",access:"BLOCKED_SECRET_ADMIN"},
  {method:"POST",path:"/api/secrets/migrate",access:"BLOCKED_SECRET_ADMIN"},
  {method:"POST",path:"/api/secrets/rotate",access:"BLOCKED_SECRET_ADMIN"},
  {method:"GET",path:"/api/secrets/rotations",access:"BLOCKED_SECRET_ADMIN"},
  {method:"GET",path:"/api/ai/status",access:"BLOCKED_SECRET_ADMIN"},
  {method:"GET",path:"/api/projects",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/questions",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/answers",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/discovery/coverage",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/derivations",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/features",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/features",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/requirements",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/requirements",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/requirements/:reqId/status",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/compiler/compile",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/risks",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/threats",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/standards",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/wbs",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/work-items/reconciliation",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/work-items",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/work-items",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/evidence",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/audit",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/audit/verify",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/adrs",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/adrs",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"PATCH",path:"/api/projects/:id/adrs/:adrId",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/components",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/components",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/next-action",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/overrides",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/export",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/package/export",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/package/verify",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/package/import",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/release/gates",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/release/signoff",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/repo/status",access:"BLOCKED_REPOSITORY"},
  {method:"GET",path:"/api/repo/diff",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/stage",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/unstage",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/commit",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/branch",access:"BLOCKED_REPOSITORY"},
  {method:"GET",path:"/api/projects/:id/agents",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/agents/:agentId/run",access:"BLOCKED_AGENT_DISPATCH"},
  {method:"GET",path:"/api/governance/session",access:"REVIEWER_SESSION"},
  {method:"POST",path:"/api/governance/session",access:"REVIEWER_SESSION"},
  {method:"DELETE",path:"/api/governance/session",access:"REVIEWER_SESSION"},
  {method:"GET",path:"/api/projects/:id/governance-policy",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/approvals",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/approvals",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/approvals/:apvId/reissue",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/approvals/:apvId/decide",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/import-sessions",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/import-sessions/:sessionId",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/import-sessions",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/import-sessions/:sessionId/changes/:index/review",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/docs",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"GET",path:"/api/projects/:id/docs/:documentId",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/docs/:documentId/diff",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/docs/:documentId/validate",access:"LEGACY_LOCAL_UNSCOPED"},
  {method:"POST",path:"/api/projects/:id/docs/:documentId/save",access:"SPECIALIZED_REVIEWER"},
] as const;

const pattern=(route:string)=>new RegExp('^'+route.split('/').map(s=>s.startsWith(':')?'[^/]+':s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'/?$','i');
const compiled=API_ROUTE_POLICIES.map(route=>({...route,match:pattern(route.path)}));
export const PRIVILEGED_UNAVAILABLE='Secret administration, repository access and agent dispatch are disabled until suitable authenticated authorization is available. Reviewer sessions do not grant these permissions.';

/** Explicit PARTIAL containment. Legacy project access is inventoried, not authenticated. */
export const enforceApiRoutePolicy:RequestHandler=(req,res,next)=>{
  if(!/^\/api(?:\/|$)/i.test(req.path))return next();
  res.setHeader('Cache-Control','no-store');
  const blocked=/^\/api\/(?:secrets|repo)(?:\/|$)/i.test(req.path)||/^\/api\/ai\/status\/?$/i.test(req.path)||/^\/api\/projects\/[^/]+\/agents\/[^/]+\/run\/?$/i.test(req.path);
  if(blocked){res.status(403).json({error:'AUTHORIZATION_UNAVAILABLE',message:PRIVILEGED_UNAVAILABLE,containment:'PARTIAL'});return;}
  const method=req.method==='HEAD'?'GET':req.method;
  const route=compiled.find(r=>r.method===method&&r.match.test(req.path));
  if(!route){res.status(404).json({error:'API_ROUTE_UNREGISTERED',message:'Unregistered API method or path'});return;}
  res.locals.securityRouteClass=route.access;
  next();
};
