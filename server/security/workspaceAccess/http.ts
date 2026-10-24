import type {Express,Request,Response,NextFunction} from 'express';
import type {ProjectStore} from '../../projectStore.ts';
import type {ReviewerIdentity} from '../../proposals/identity.ts';
import {API_ROUTE_POLICIES} from '../apiRoutePolicy.ts';
import type {WorkspaceAction} from './contracts.ts';
import {WorkspaceSessionService,workspaceTokenDigest} from './service.ts';
import {workspaceReviewerIdentity} from './identity.ts';
import {WorkspaceAdmission} from './admission.ts';
type Route={kind:'PUBLIC'|'SESSION'|'LIST'|'PROJECT'|'VALIDATION'|'SPONSOR'|'DENY';action?:WorkspaceAction;projectId?:string};
const routePattern=(p:string)=>new RegExp('^'+p.split('/').map(s=>s.startsWith(':')?'([^/]+)':s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'/?$','i');
const routes=API_ROUTE_POLICIES.map(r=>({...r,pattern:routePattern(r.path)}));
const isMutation=(method:string)=>!['GET','HEAD','OPTIONS'].includes(method);
export function resolveWorkspaceAccessMode(env:NodeJS.ProcessEnv=process.env):'ENFORCED'|'LOCAL_DEVELOPMENT'{
 const mode=env.DMK_WORKSPACE_ACCESS??'ENFORCED';if(mode!=='ENFORCED'&&mode!=='LOCAL_DEVELOPMENT')throw Error('WORKSPACE_ACCESS_MODE_INVALID');return mode;
}
export function resolveWorkspaceRoute(req:{method:string;path:string;body?:any}):Route{
 const method=req.method==='HEAD'?'GET':req.method;
 const route=routes.find(r=>r.method===method&&r.pattern.test(req.path));
 if(!route||route.access.startsWith('BLOCKED_'))return{kind:'DENY'};
 if(route.path==='/api/health')return{kind:'PUBLIC'};
 if(route.access==='REVIEWER_SESSION')return{kind:'SESSION'};
 if(route.access==='HUMAN_AGENT_SPONSOR')return{kind:'SPONSOR'};
 if(route.path==='/api/projects'&&method==='GET')return{kind:'LIST'};
 if(route.path==='/api/projects'&&method==='POST')return{kind:'PROJECT',action:'project:create'};
 if(route.path==='/api/projects/package/verify')return{kind:'VALIDATION'};
 if(route.path==='/api/projects/package/import'){
  const payload=req.body?.package??req.body,projectId=payload?.knowledge?.project?.id;
  return typeof projectId==='string'&&projectId.length<=128?{kind:'PROJECT',action:'project:import',projectId}:{kind:'DENY'};
 }
 const match=route.pattern.exec(req.path);const projectId=match?.[1];if(!route.path.startsWith('/api/projects/:id')||!projectId)return{kind:'DENY'};
 if(/\/package\/export\/?$/i.test(req.path)||/\/export\/?$/i.test(req.path))return{kind:'PROJECT',projectId,action:'project:export'};
 if(method==='GET'||/\/docs\/[^/]+\/(diff|validate)\/?$/i.test(req.path))return{kind:'PROJECT',projectId,action:'project:read'};
 const governed=/\/approvals(?:\/|$)/i.test(req.path)||/\/verification-sessions\/[^/]+\/decisions\/?$/i.test(req.path)||/\/release\/signoff\/?$/i.test(req.path)||/\/import-sessions\/[^/]+\/changes\/[^/]+\/review\/?$/i.test(req.path)||(['VERIFIED','APPROVED','RELEASED'].includes(req.body?.status)&&/\/(?:work-items|status)\/?$/i.test(req.path));
 return{kind:'PROJECT',projectId,action:governed?'project:review':'project:write'};
}
export function readWorkspaceCookie(req:Pick<Request,'headers'>):string|null{
 const values=(req.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('dmk_workspace='));
 if(values.length!==1)return null;const token=values[0].slice('dmk_workspace='.length);return workspaceTokenDigest(token)?token:null;
}
const originValid=(req:Request)=>!req.headers.origin||req.headers.origin===`${req.protocol}://${req.headers.host}`;
const deny=(res:Response,status:number,code:string)=>res.status(status).json({error:code});
function cookie(res:Response,req:Request,token:string){res.cookie('dmk_workspace',token,{httpOnly:true,secure:req.secure,sameSite:'strict',path:'/',maxAge:1_800_000});}

/** No HTTP handler provisions principals, changes memberships, chooses an authority path or consumes receipts. */
export function installWorkspaceHttp(app:Express,service:WorkspaceSessionService|null,store:ProjectStore){
 const admission=new WorkspaceAdmission(4);
 const admitted=(handler:(req:Request,res:Response,next:NextFunction)=>unknown|Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{
  void admission.run(()=>handler(req,res,next)).catch(()=>{if(!res.headersSent)deny(res,503,'AUTHORITY_UNAVAILABLE');});
 };
 const access={mode:'ENFORCED' as const,setupRequired:!service,transport:'DIRECT_LOOPBACK',productionDeploymentAccepted:false};
 app.get('/api/governance/session',admitted(async(req,res)=>{
  const token=readWorkspaceCookie(req),observed=service&&token?await service.sessionState(token):{available:true,session:null};if(!observed.available)return void deny(res,503,'AUTHORITY_UNAVAILABLE');const session=observed.session;
  res.json({identity:session?workspaceReviewerIdentity(session.principal):null,setup:null,access,csrf:session?service!.csrf(token):null});
 }));
 app.post('/api/governance/session',admitted(async(req,res)=>{
  if(!originValid(req))return void deny(res,403,'LOCAL_ORIGIN_REQUIRED');
  if(!service)return void res.status(503).json({error:'WORKSPACE_SETUP_REQUIRED',access});
  const old=readWorkspaceCookie(req);let oldActive=false;if(old){const previous=await service.sessionState(old);if(!previous.available)return void deny(res,503,'AUTHORITY_UNAVAILABLE');oldActive=!!previous.session;if(oldActive&&!service.verifyCsrf(old,req.headers['x-dmk-csrf']))return void deny(res,403,'CSRF_REQUIRED');}
  const result=await service.login(req.body);if(result.authenticated===false)return void deny(res,result.unavailable?503:result.limited?429:401,result.unavailable?'AUTHORITY_UNAVAILABLE':result.limited?'LOGIN_RATE_LIMITED':'INVALID_CREDENTIALS');
  if(oldActive&&old&&old!==result.token){
   const proof=service.csrf(old);
   if(!proof||!await service.logout(old,proof)){
    // An unacknowledged replacement must not be reported as a completed switch.
    // Best-effort discard the undelivered successor; no cookie is issued.
    const successorProof=service.csrf(result.token);if(successorProof)await service.logout(result.token,successorProof);
    return void deny(res,503,'SESSION_TRANSITION_UNCONFIRMED');
   }
  }
  const session=await service.session(result.token);if(!session)return void deny(res,503,'AUTHORITY_UNAVAILABLE');
  cookie(res,req,result.token);res.json({identity:workspaceReviewerIdentity(session.principal),csrf:result.csrf,access});
 }));
 app.delete('/api/governance/session',admitted(async(req,res)=>{
  const token=readWorkspaceCookie(req);if(!originValid(req)||!service||!token||!await service.logout(token,req.headers['x-dmk-csrf']))return void deny(res,403,'CSRF_OR_SESSION_INVALID');
  res.clearCookie('dmk_workspace',{path:'/',secure:req.secure,sameSite:'strict',httpOnly:true});res.json({identity:null,csrf:null,access});
 }));
 app.post('/api/governance/session/rotate',admitted(async(req,res)=>{
  const token=readWorkspaceCookie(req);if(!originValid(req)||!service||!token)return void deny(res,403,'CSRF_OR_SESSION_INVALID');
  const next=await service.rotate(token,req.headers['x-dmk-csrf']);if(!next)return void deny(res,403,'CSRF_OR_SESSION_INVALID');const session=await service.session(next.token);if(!session)return void deny(res,503,'AUTHORITY_UNAVAILABLE');cookie(res,req,next.token);res.json({identity:workspaceReviewerIdentity(session.principal),csrf:next.csrf,access});
 }));
 app.post('/api/governance/session/password',admitted(async(req,res)=>{
  const token=readWorkspaceCookie(req);if(!originValid(req)||!service||!token||!await service.changePassword(token,req.headers['x-dmk-csrf'],req.body?.currentPassword,req.body?.replacementPassword))return void deny(res,403,'PASSWORD_CHANGE_REJECTED');
  res.clearCookie('dmk_workspace',{path:'/',secure:req.secure,sameSite:'strict',httpOnly:true});res.json({identity:null,csrf:null,access});
 }));
 app.use(admitted(async(req,res,next)=>{
  if(!/^\/api(?:\/|$)/i.test(req.path))return next();
  const route=resolveWorkspaceRoute(req);if(route.kind==='PUBLIC')return next();
  if(route.kind==='DENY'||route.kind==='SESSION')return void deny(res,404,'API_ROUTE_UNREGISTERED');
  if(!service)return void deny(res,503,'WORKSPACE_SETUP_REQUIRED');
  const token=readWorkspaceCookie(req);if(!token)return void deny(res,401,'WORKSPACE_SIGN_IN_REQUIRED');
  const auditedExport=['GET','HEAD'].includes(req.method)&&/\/package\/export\/?$/i.test(req.path);
  if((isMutation(req.method)||auditedExport)&&(!originValid(req)||!service.verifyCsrf(token,req.headers['x-dmk-csrf'])))return void deny(res,403,'CSRF_REQUIRED');
  res.locals.workspaceToken=token;
  if(route.kind==='LIST'){
   const decision=await service.listProjects(token);
   if(decision.reason==='AUTHORITY_UNAVAILABLE')return void deny(res,503,'AUTHORITY_UNAVAILABLE');
   if(!decision.allowed)return void deny(res,401,'WORKSPACE_SIGN_IN_REQUIRED');
   res.locals.workspaceSession={principal:decision.principal};res.locals.workspaceIdentity=workspaceReviewerIdentity(decision.principal);
   // Creation-capable or project-scoped users may discover the CAS revision;
   // an unrelated signed-in identity receives no global revision disclosure.
   if(decision.principal?.canCreateProjects===true||decision.projectIds.length>0)res.locals.workspaceDiscoveryRevision=decision.snapshotRevision;
   res.locals.workspaceProjects=new Set<string>(decision.projectIds);return next();
  }
  if(route.kind==='VALIDATION'||route.kind==='SPONSOR'){
   const observed=await service.sessionState(token);if(!observed.available)return void deny(res,503,'AUTHORITY_UNAVAILABLE');if(!observed.session)return void deny(res,401,'WORKSPACE_SIGN_IN_REQUIRED');
   if(observed.session.principal.kind!=='HUMAN')return void deny(res,403,'WORKSPACE_HUMAN_REQUIRED');
   res.locals.workspaceSession=observed.session;res.locals.workspaceIdentity=workspaceReviewerIdentity(observed.session.principal);
   return next();
  }
  // Import creation is separately authorized; a package can never grant its own ownership.
  const targetExists=route.projectId&&store.projects.some(p=>p.id===route.projectId);
  const action=route.action==='project:import'&&!targetExists?'project:create':route.action!;
  const decision=await service.authorize(token,action,targetExists||action!=='project:create'?route.projectId:undefined);
  if(decision.reason==='AUTHORITY_UNAVAILABLE')return void deny(res,503,'AUTHORITY_UNAVAILABLE');
  if(decision.reason==='SESSION_INVALID')return void deny(res,401,'WORKSPACE_SIGN_IN_REQUIRED');
  if(!decision.allowed)return void deny(res,route.projectId?404:403,'PROJECT_ACCESS_DENIED');
  res.locals.workspaceSession={principal:decision.principal};res.locals.workspaceIdentity=workspaceReviewerIdentity(decision.principal);
  res.locals.workspaceAuthorization={...decision,action,projectId:route.projectId,digest:workspaceTokenDigest(token)};
  next();
 }));
 const requireHuman=(req:Request,res:Response):ReviewerIdentity|undefined=>{
  const identity=res.locals.workspaceIdentity as ReviewerIdentity|undefined;
  if(!identity||identity.kind!=='HUMAN'||!originValid(req)){deny(res,401,'WORKSPACE_HUMAN_REQUIRED');return;}return identity;
 };
 return{requireHuman};
}
