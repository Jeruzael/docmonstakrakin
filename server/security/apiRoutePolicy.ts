import type {RequestHandler} from 'express';

export const API_ROUTE_POLICIES=[
  {method:"GET",path:"/api/health",access:"PUBLIC_HEALTH"},
  {method:"GET",path:"/api/external/discovery",access:"AGENT_BOOTSTRAP"},
  {method:"GET",path:"/api/external/session",access:"AGENT_READ"},
  {method:"POST",path:"/api/external/skills/description",access:"AGENT_READ"},
  {method:"POST",path:"/api/external/skills/content",access:"AGENT_READ"},
  {method:"POST",path:"/api/external/actions",access:"AGENT_READ"},
  {method:"POST",path:"/api/external/sponsor-actions",access:"HUMAN_AGENT_SPONSOR"},
  {method:"GET",path:"/api/secrets/metadata",access:"BLOCKED_SECRET_ADMIN"},
  {method:"POST",path:"/api/secrets",access:"BLOCKED_SECRET_ADMIN"},
  {method:"DELETE",path:"/api/secrets/:key",access:"BLOCKED_SECRET_ADMIN"},
  {method:"POST",path:"/api/secrets/migrate",access:"BLOCKED_SECRET_ADMIN"},
  {method:"POST",path:"/api/secrets/rotate",access:"BLOCKED_SECRET_ADMIN"},
  {method:"GET",path:"/api/secrets/rotations",access:"BLOCKED_SECRET_ADMIN"},
  {method:"GET",path:"/api/ai/status",access:"BLOCKED_SECRET_ADMIN"},
  {method:"GET",path:"/api/projects",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/questions",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/answers",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/discovery/coverage",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/derivations",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/features",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/features",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/requirements",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/requirements",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/requirements/:reqId/status",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/compiler/compile",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/risks",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/threats",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/standards",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/wbs",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/work-items/reconciliation",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/work-items",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/work-items",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/evidence",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/verification-sessions",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/verification-sessions/:sessionId",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/verification-sessions",access:"SPECIALIZED_REVIEWER"},
  {method:"PATCH",path:"/api/projects/:id/verification-sessions/:sessionId",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/verification-sessions/:sessionId/submit",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/verification-sessions/:sessionId/decisions",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/audit",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/audit/verify",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/adrs",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/adrs",access:"WORKSPACE_ACCESS"},
  {method:"PATCH",path:"/api/projects/:id/adrs/:adrId",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/components",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/components",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/next-action",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/overrides",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/export",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/package/export",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/package/verify",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/package/import",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/release/gates",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/release/ci",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/release/signoff",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/repo/status",access:"BLOCKED_REPOSITORY"},
  {method:"GET",path:"/api/repo/diff",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/stage",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/unstage",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/commit",access:"BLOCKED_REPOSITORY"},
  {method:"POST",path:"/api/repo/branch",access:"BLOCKED_REPOSITORY"},
  {method:"GET",path:"/api/projects/:id/agents",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/agents/:agentId/run",access:"BLOCKED_AGENT_DISPATCH"},
  {method:"GET",path:"/api/governance/session",access:"REVIEWER_SESSION"},
  {method:"POST",path:"/api/governance/session",access:"REVIEWER_SESSION"},
  {method:"DELETE",path:"/api/governance/session",access:"REVIEWER_SESSION"},
  {method:"POST",path:"/api/governance/session/rotate",access:"REVIEWER_SESSION"},
  {method:"POST",path:"/api/governance/session/password",access:"REVIEWER_SESSION"},
  {method:"GET",path:"/api/projects/:id/governance-policy",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/approvals",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/approvals",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/approvals/:apvId/reissue",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/approvals/:apvId/decide",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/import-sessions",access:"WORKSPACE_ACCESS"},
  {method:"GET",path:"/api/projects/:id/import-sessions/:sessionId",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/import-sessions",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/import-sessions/:sessionId/changes/:index/review",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/docs",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/docs",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/readiness",access:"SPECIALIZED_REVIEWER"},
  {method:"POST",path:"/api/projects/:id/readiness",access:"SPECIALIZED_REVIEWER"},
  {method:"GET",path:"/api/projects/:id/docs/:documentId",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/docs/:documentId/diff",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/docs/:documentId/validate",access:"WORKSPACE_ACCESS"},
  {method:"POST",path:"/api/projects/:id/docs/:documentId/save",access:"SPECIALIZED_REVIEWER"},
] as const;

const pattern=(route:string)=>new RegExp('^'+route.split('/').map(s=>s.startsWith(':')?'[^/]+':s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'/?$','i');
const compiled=API_ROUTE_POLICIES.map(route=>({...route,match:pattern(route.path)}));
export const PRIVILEGED_UNAVAILABLE='Secret administration, repository access and agent dispatch are disabled until suitable authenticated authorization is available. Reviewer sessions do not grant these permissions.';

/** Route registration and privileged denial. Enforced workspace authority runs after JSON parsing; LOCAL_DEVELOPMENT is explicitly separate. */
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
