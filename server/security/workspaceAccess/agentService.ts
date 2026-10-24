import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {WorkspaceAgentActor,WorkspaceAgentRead,WorkspaceAgentScope,WorkspaceAgentAction} from './contracts.ts';
import {workspaceTokenDigest} from './service.ts';
import managementContract from './agentManagementContract.cjs';
type Authority={execute(command:any):Promise<any>};
type Revision={expectedPolicyRevision:number;operationId:string};
export type AgentManagementResult={available:true;accepted:true;result:any;token?:string;tokenAvailable?:boolean}|{available:boolean;accepted:false;code:string};
export const agentManagementRequestHash=(command:string,input:Record<string,unknown>):string=>managementContract.requestHash(command,input);
export const agentTokenDigest=(token:unknown):string|null=>typeof token==='string'&&/^dmk_agent_v1_[a-f0-9]{64}$/.test(token)?createHash('sha256').update('dmk-agent-session-v1\0'+token).digest('hex'):null;
function fields(value:unknown,required:string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 return Object.keys(descriptors).length===required.length&&required.every(k=>Object.hasOwn(descriptors,k)&&descriptors[k].enumerable&&Object.hasOwn(descriptors[k],'value'));
}
const denial=(available=true)=>({available,allowed:false as const,reason:available?'SESSION_INVALID' as const:'AUTHORITY_UNAVAILABLE' as const});
/** Development-only host adapter. All current authority decisions remain in the worker. */
export class WorkspaceAgentService {
 private closed=false;private highWater=0;
 constructor(readonly store:Authority,private readonly clock:()=>number=Date.now){}
 private now(){let value:number;try{value=this.clock();}catch{return null;}if(this.closed||!Number.isSafeInteger(value)||value<this.highWater||value<0||value>Number.MAX_SAFE_INTEGER-1_800_000)return null;this.highWater=value;return value;}
 async sessionState(token:unknown):Promise<{available:boolean;actor:WorkspaceAgentActor|null}>{
  const now=this.now(),digest=agentTokenDigest(token);if(now===null)return{available:false,actor:null};if(!digest)return{available:true,actor:null};
  try{return{available:true,actor:await this.store.execute({command:'agentSession',digest,now})};}catch{return{available:false,actor:null};}
 }
 async readTask(token:unknown,input:{projectId:string;taskId:string}):Promise<(WorkspaceAgentRead&{available:true})|ReturnType<typeof denial>>{
  const now=this.now(),digest=agentTokenDigest(token);if(now===null)return denial(false);if(!digest||!fields(input,['projectId','taskId']))return denial();
  try{return{available:true,...await this.store.execute({command:'readAgentTask',digest,...input,now})};}catch{return denial(false);}
 }
 private async management(command:string,token:unknown,input:unknown,required:string[],generated:Record<string,string>={}):Promise<AgentManagementResult>{
  const now=this.now(),sponsorDigest=workspaceTokenDigest(token);if(now===null)return{available:false,accepted:false,code:'AUTHORITY_UNAVAILABLE'};
  if(!sponsorDigest||!fields(input,[...required,'expectedPolicyRevision','operationId'])||typeof input.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.operationId))return{available:true,accepted:false,code:'INPUT_INVALID'};
  try{
   const publicInput=Object.fromEntries([...required,'expectedPolicyRevision'].map(key=>[key,input[key]])),requestHash=agentManagementRequestHash(command,publicInput);
   const result=await this.store.execute({command,sponsorDigest,...input,...generated,requestHash,now}),ack=result?.acknowledgment;
   // The worker is authoritative, but an uncorrelated/malformed response is not
   // confirmation that this candidate secret or newly generated ID was stored.
   if(typeof result?.replayed!=='boolean'||!ack||ack.operationId!==input.operationId||ack.action!==command||ack.requestHash!==requestHash||ack.expectedPolicyRevision!==input.expectedPolicyRevision||!Number.isSafeInteger(ack.policyRevision)||ack.policyRevision<Number(input.expectedPolicyRevision)||ack.policyRevision>Number(input.expectedPolicyRevision)+1||
      !result.replayed&&Object.entries(generated).some(([key,value])=>key.endsWith('Id')&&ack[key]!==value))throw Error('Unconfirmed authority response');
   return{available:true,accepted:true,result};
  }
  catch(error){const code=(error as any)?.code;const denied=typeof code==='string'&&['WORKSPACE_INPUT_INVALID','WORKSPACE_ACCESS_DENIED','WORKSPACE_STALE_REVISION','WORKSPACE_CONFLICT','WORKSPACE_SESSION_REPLAY','WORKSPACE_CAPACITY_EXCEEDED'].includes(code);return{available:denied,accepted:false,code:denied?code:'AUTHORITY_UNAVAILABLE'};}
 }
 enrollAgent(token:unknown,input:Revision&{projectId:string;name:string}){return this.management('enrollAgent',token,input,['projectId','name'],{agentId:randomUUID()});}
 registerAgentClient(token:unknown,input:Revision&{projectId:string;agentId:string;name:string}){return this.management('registerAgentClient',token,input,['projectId','agentId','name'],{clientId:randomUUID()});}
 grantAgent(token:unknown,input:Revision&{agentId:string;clientId:string;projectId:string;scope:WorkspaceAgentScope;actions:WorkspaceAgentAction[];expiresAt:number}){return this.management('grantAgent',token,input,['agentId','clientId','projectId','scope','actions','expiresAt'],{grantId:randomUUID()});}
 async issueAgent(token:unknown,input:Revision&{grantId:string;expectedGrantRevision:number}):Promise<AgentManagementResult>{
  const raw='dmk_agent_v1_'+randomBytes(32).toString('hex');const result=await this.management('issueAgent',token,input,['grantId','expectedGrantRevision'],{sessionId:randomUUID(),digest:agentTokenDigest(raw)!});
  if(!result.accepted)return result;
  if(result.result?.replayed===false)return{...result,token:raw,tokenAvailable:true};
  return{...result,tokenAvailable:false};
 }
 revokeAgent(token:unknown,input:Revision&{agentId:string}){return this.management('revokeAgent',token,input,['agentId']);}
 revokeAgentClient(token:unknown,input:Revision&{clientId:string}){return this.management('revokeAgentClient',token,input,['clientId']);}
 revokeAgentGrant(token:unknown,input:Revision&{grantId:string}){return this.management('revokeAgentGrant',token,input,['grantId']);}
 async revokeAgentSession(token:unknown):Promise<boolean>{const now=this.now(),digest=agentTokenDigest(token);if(now===null||!digest)return false;try{return await this.store.execute({command:'revokeAgentSession',digest,now})===true;}catch{return false;}}
 close(){this.closed=true;}
}
