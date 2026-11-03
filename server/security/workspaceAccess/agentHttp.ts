import {createHash} from 'node:crypto';
import type {Express,Request,Response} from 'express';
import {WorkspaceAgentService,agentTokenDigest} from './agentService.ts';
import {
 TRUSTED_LOCAL_AGENT_TOOLS,
 TRUSTED_LOCAL_AGENT_TOKEN_REGEX,
 TrustedLocalAgentService,
 trustedLocalTokenDigest,
} from './trustedLocalAgent.ts';
import {TaskReadSkillAdmission} from '../../skills/admission.ts';
import {WorkspaceAdmission} from './admission.ts';
import {readWorkspaceCookie} from './http.ts';

type AgentReads=Pick<WorkspaceAgentService,'sessionState'|'readTask'>;
const deny=(res:Response,status:number,error:string)=>{res.status(status).json({error});};
function exact(value:unknown,keys:string[]):value is Record<string,any>{return !!value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
function transport(req:Request,res:Response):boolean {
 const authorizationCount=req.rawHeaders?.filter((_,i,a)=>i%2===0&&a[i].toLowerCase()==='authorization').length??0;
 if(!req.secure||req.originalUrl.includes('?')||req.headers.cookie!==undefined||authorizationCount!==1||req.headers.origin!==undefined&&req.headers.origin!==`https://${req.headers.host}`){deny(res,403,'AGENT_TRANSPORT_REJECTED');return false;}return true;
}
function matchTrustedLocalBearer(req:Request):string|null{
 const raw=req.headers.authorization,match=typeof raw==='string'?/^Bearer (dmk_tla_v1_[a-f0-9]{64})$/i.exec(raw):null;
 return match&&TRUSTED_LOCAL_AGENT_TOKEN_REGEX.test(match[1])&&trustedLocalTokenDigest(match[1])?match[1]:null;
}
/** These fixed read handlers cannot enroll an identity or invoke a HUMAN route. */
export function createAgentTransportHandlers(service:AgentReads|null,skills=new TaskReadSkillAdmission(),trustedLocal:TrustedLocalAgentService|null=null){
 const current=async(req:Request,res:Response)=>{
  if(!transport(req,res))return null;
  const raw=req.headers.authorization,match=typeof raw==='string'?/^Bearer (dmk_agent_v1_[a-f0-9]{64})$/i.exec(raw):null;
  if(!match||!agentTokenDigest(match[1])){deny(res,401,'AGENT_SESSION_REQUIRED');return null;}
  if(!service){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return null;}
  const observed=await service.sessionState(match[1]);if(!observed.available){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return null;}
  if(!observed.actor){deny(res,401,'AGENT_SESSION_REQUIRED');return null;}return{token:match[1],actor:observed.actor};
 };
 const discovery=async(_req:Request,res:Response)=>{
  const tlaEnabled=Boolean(trustedLocal?.enabled);
  res.json({
   protocol:'DMK_AGENT_READ/1',
   authority:'EXPERIMENTAL_LOCAL_ONLY',
   enabled:Boolean(service||tlaEnabled),
   transport:'DIRECT_LOOPBACK_HTTPS',
   actions:['task:read'],
   skillBootstrap:['description','instructions'],
   providerApiKeyRequired:false,
   writeOperations:false,
   productionAccepted:false,
   durableReadAcknowledgments:false,
   ...(tlaEnabled?{
    trustedLocalAgent:{
     enabled:true,
     mode:'TRUSTED_LOCAL_AGENT',
     protocol:'DMK_TRUSTED_LOCAL_AGENT/1',
     tools:TRUSTED_LOCAL_AGENT_TOOLS,
     writeOperations:true,
     humanGovernanceRequired:true,
    }
   }:{}),
  });
 };
 const session=async(req:Request,res:Response)=>{
  const tlaToken=matchTrustedLocalBearer(req);
  if(tlaToken){
   if(!transport(req,res))return;
   if(!trustedLocal?.enabled){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
   const observed=await trustedLocal.sessionState(tlaToken);
   if(!observed.available){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
   if(!observed.actor){deny(res,401,'AGENT_SESSION_REQUIRED');return;}
   res.json({actor:observed.actor,authority:'TRUSTED_LOCAL_AGENT',mode:'TRUSTED_LOCAL_AGENT',humanQuorum:false});
   return;
  }
  const c=await current(req,res);if(c)res.json({actor:c.actor,authority:'EXPERIMENTAL_LOCAL_ONLY',humanQuorum:false});
 };
 const description=async(req:Request,res:Response)=>{const c=await current(req,res);if(!c)return;try{if(!exact(req.body,['request']))throw Error();res.json(skills.describe(c.actor,req.body.request));}catch{deny(res,403,'SKILL_ADMISSION_REJECTED');}};
 const content=async(req:Request,res:Response)=>{const c=await current(req,res);if(!c)return;try{if(!exact(req.body,['request','consultationReceipt']))throw Error();res.json(skills.content(c.actor,req.body.request,req.body.consultationReceipt));}catch{deny(res,403,'SKILL_ADMISSION_REJECTED');}};
 const action=async(req:Request,res:Response)=>{
  const tlaToken=matchTrustedLocalBearer(req);
  if(tlaToken){
   if(!transport(req,res))return;
   if(!trustedLocal?.enabled){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
   const outcome=await trustedLocal.executeOperation(tlaToken,req.body);
   if(outcome.ok===false){res.status(outcome.status).json({error:outcome.error,...(outcome.message?{message:outcome.message}:{})});return;}
   res.json(outcome.data);
   return;
  }
  const c=await current(req,res);if(!c)return;
  if(!exact(req.body,['request','admissionReceipt'])||!skills.admit(c.actor,req.body.request,req.body.admissionReceipt).accepted){deny(res,403,'SKILL_ADMISSION_REJECTED');return;}
  const request=req.body.request,result=await service!.readTask(c.token,{projectId:request.projectId,taskId:request.taskId});
  if(!result.available){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
  if(!result.allowed){deny(res,404,'AGENT_TASK_UNAVAILABLE');return;}
  const actor=result.actor;
  // Independent current worker authorization remains necessary after retrieval.
  // A raced revision never exposes an old/new mixed projection.
  if(!actor||['kind','principalId','clientId','sessionId','sponsorPrincipalId','grantId','grantRevision','projectId','policyRevision','snapshotRevision'].some(k=>(actor as any)[k]!==(c.actor as any)[k])||result.policyRevision!==c.actor.policyRevision||result.snapshotRevision!==request.expectedRevision){deny(res,409,'AGENT_CONTEXT_CHANGED');return;}
  if(!exact(result.task,['id','title','description','status','priority','updatedAt'])||result.task.id!==request.taskId||Object.values(result.task).some(v=>typeof v!=='string')){deny(res,503,'AGENT_RESULT_INVALID');return;}
  res.json({task:result.task,acknowledgment:{kind:'READ_OBSERVATION',durable:false,operationId:request.operationId,requestHash:createHash('sha256').update(JSON.stringify(['DMK_AGENT_READ/1',request])).digest('hex'),projectId:request.projectId,taskId:request.taskId,policyRevision:result.policyRevision,snapshotRevision:result.snapshotRevision},provenance:'AUTHENTICATED_AGENT_READ',humanApproval:false});
 };
 return{discovery,session,description,content,action,close:()=>skills.close()};
}
/** Install before HUMAN workspace admission; no AGENT credential enters it. */
export function installAgentReadHttp(app:Express,service:AgentReads|null,trustedLocal:TrustedLocalAgentService|null=null){
 const h=createAgentTransportHandlers(service,new TaskReadSkillAdmission(),trustedLocal),admission=new WorkspaceAdmission(4);
 const wrap=(handler:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response)=>{void admission.run(()=>handler(req,res)).catch(()=>{if(!res.headersSent)deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');});};
 app.get('/api/external/discovery',wrap(h.discovery));app.get('/api/external/session',wrap(h.session));app.post('/api/external/skills/description',wrap(h.description));app.post('/api/external/skills/content',wrap(h.content));app.post('/api/external/actions',wrap(h.action));return h;
}
type AuthorityCoordinator=<T>(fn:()=>Promise<T>)=>Promise<T>;
/** Authenticated HUMAN admission precedes this fixed sponsor dispatcher. */
export function installAgentSponsorHttp(app:Express,service:WorkspaceAgentService|null,coordinate:AuthorityCoordinator|null,trustedLocal:TrustedLocalAgentService|null=null){
 app.post('/api/external/sponsor-actions',(req,res)=>{
  if(!req.secure||req.originalUrl.includes('?')||req.headers.authorization!==undefined||res.locals.workspaceSession?.principal?.kind!=='HUMAN'){deny(res,403,'HUMAN_SPONSOR_REQUIRED');return;}
  const token=readWorkspaceCookie(req),body=req.body;
  if(!token||!body||body.version!==1||typeof body.action!=='string'){deny(res,400,'AGENT_MANAGEMENT_INPUT_INVALID');return;}
  const tlaActions=['enrollTrustedLocalAgent','listTrustedLocalAgents','revokeTrustedLocalAgent'] as const;
  if((tlaActions as readonly string[]).includes(body.action)){
   if(!trustedLocal?.enabled){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
   const principal=res.locals.workspaceSession.principal;
   if(body.action==='enrollTrustedLocalAgent'){
    const ttlMs=typeof body.ttlHours==='number'&&Number.isSafeInteger(body.ttlHours)?body.ttlHours*3600_000:undefined;
    void trustedLocal.enrollLocalClient({sponsorPrincipalId:principal.name,clientName:body.clientName,ttlMs,projectScope:body.projectScope}).then(result=>{
     if('error' in result){deny(res,400,result.error);return;}
     res.json(result);
    }).catch(()=>{if(!res.headersSent)deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');});
    return;
   }
   if(body.action==='listTrustedLocalAgents'){
    void trustedLocal.listLocalClients(principal.id).then(result=>{
     if(!result.available){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
     res.json(result);
    }).catch(()=>{if(!res.headersSent)deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');});
    return;
   }
   void trustedLocal.revokeLocalClient({sponsorPrincipalId:principal.id,enrollmentId:body.enrollmentId,clientName:body.clientName}).then(result=>{
    if(!result.available){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
    res.json(result);
   }).catch(()=>{if(!res.headersSent)deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');});
   return;
  }
  if(!service||!coordinate){deny(res,503,'AGENT_AUTHORITY_UNAVAILABLE');return;}
  const actions=['enrollAgent','registerAgentClient','grantAgent','issueAgent','revokeAgent','revokeAgentClient','revokeAgentGrant'] as const;
  const action=actions.find(a=>a===body.action);if(!action){deny(res,400,'AGENT_MANAGEMENT_ACTION_INVALID');return;}
  const {version:_version,action:_action,...input}=body;
  void coordinate(async()=>{
   const result=await service[action](token,input as any);
   // Only confirmed rejections are safe to continue from. Lost/unconfirmed
   // management replies fence the shared projection until authoritative reload.
   if(!result.available)throw Error('WORKSPACE_AUTHORITY_OUTCOME_UNKNOWN');return result;
  }).then(result=>{if(result.accepted===false){deny(res,result.code.includes('STALE')||result.code.includes('REPLAY')||result.code.includes('CONFLICT')?409:403,'AGENT_MANAGEMENT_REJECTED');return;}res.json(result);}).catch(()=>{if(!res.headersSent)deny(res,503,'WORKSPACE_RECOVERY_REQUIRED');});
 });
}
