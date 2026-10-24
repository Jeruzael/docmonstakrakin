import https from 'node:https';import {createHash,randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';import fs from 'node:fs';
type Options={origin:string;ca:Buffer;token:string};
const revision=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>=0;
function exact(value:unknown,keys:string[]):value is Record<string,any>{return !!value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
function taskProjection(value:unknown,taskId:string):boolean{
 const bounds={id:128,title:1024,description:65536,status:32,priority:2,updatedAt:128};
 if(!exact(value,Object.keys(bounds))||value.id!==taskId)return false;
 return Object.entries(bounds).every(([key,max])=>typeof value[key]==='string'&&Buffer.byteLength(value[key])<=max&&Buffer.from(value[key]).toString('utf8')===value[key])&&
  ['PROPOSED','BACKLOG','READY','IN_PROGRESS','VERIFICATION','VERIFIED','APPROVED','RELEASED','DEFERRED'].includes(value.status)&&['P0','P1','P2'].includes(value.priority);
}
/** One demonstrated adapter capability. No provider key or implicit host trust. */
export function createWorkspaceAgentClient(options:Options){
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Object.keys(options).sort().join(',')!=='ca,origin,token'||typeof options.origin!=='string'||!/^https:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/?$/.test(options.origin)||!Buffer.isBuffer(options.ca)||!options.ca.length||options.ca.length>65536||typeof options.token!=='string'||!/^dmk_agent_v1_[a-f0-9]{64}$/.test(options.token))throw Error('AGENT_CLIENT_INPUT_INVALID');
 const origin=new URL(options.origin);if(Number(origin.port)>65535)throw Error('AGENT_CLIENT_INPUT_INVALID');
 const agent=new https.Agent({ca:Buffer.from(options.ca),rejectUnauthorized:true,minVersion:'TLSv1.3',maxSockets:1});let closed=false;let token=options.token;
 function request(path:string,body?:unknown):Promise<any>{
  if(closed)throw Error('AGENT_CLIENT_CLOSED');
  const encoded=body===undefined?undefined:Buffer.from(JSON.stringify(body));if(encoded&&encoded.length>16384)throw Error('AGENT_CLIENT_BODY_TOO_LARGE');
  return new Promise((resolve,reject)=>{
   const req=https.request(new URL(path,origin),{agent,method:encoded?'POST':'GET',headers:{Authorization:'Bearer '+token,...(encoded?{'Content-Type':'application/json','Content-Length':encoded.length}:{})}},res=>{
    let bytes=0;const chunks:Buffer[]=[];res.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024){req.destroy(Error('AGENT_CLIENT_RESPONSE_TOO_LARGE'));return;}chunks.push(Buffer.from(chunk));});res.once('error',()=>reject(Error('AGENT_CLIENT_RESPONSE_FAILED')));
    res.once('end',()=>{if(res.statusCode!==200){reject(Error('AGENT_CLIENT_REJECTED_'+res.statusCode));return;}try{const raw=Buffer.concat(chunks);if(!Buffer.from(raw.toString('utf8')).equals(raw))throw Error();resolve(JSON.parse(raw.toString('utf8')));}catch{reject(Error('AGENT_CLIENT_RESPONSE_INVALID'));}});
   });req.setTimeout(5000,()=>req.destroy(Error('AGENT_CLIENT_TIMEOUT')));req.once('error',()=>reject(Error('AGENT_CLIENT_REQUEST_FAILED')));req.end(encoded);
  });
 }
 return{
  session:()=>request('/api/external/session'),
  async readTask(projectId:string,taskId:string,consume:(stage:'DESCRIPTION'|'INSTRUCTIONS',material:any)=>Promise<void>,operationId=randomUUID()){
   if(typeof consume!=='function')throw Error('AGENT_CLIENT_SKILL_CONSUMER_REQUIRED');
   const observed=await request('/api/external/session'),actor=observed?.actor;if(actor?.kind!=='AGENT'||actor.projectId!==projectId||!revision(actor.snapshotRevision)||!revision(actor.policyRevision))throw Error('AGENT_CLIENT_CONTEXT_INVALID');
   const input={version:1,operationId,action:'task:read',projectId,taskId,expectedRevision:actor.snapshotRevision};
   const description=await request('/api/external/skills/description',{request:input});await consume('DESCRIPTION',description);
   const instructions=await request('/api/external/skills/content',{request:input,consultationReceipt:description.consultationReceipt});await consume('INSTRUCTIONS',instructions);
   const result=await request('/api/external/actions',{request:input,admissionReceipt:instructions.admissionReceipt});
   const requestHash=createHash('sha256').update(JSON.stringify(['DMK_AGENT_READ/1',input])).digest('hex');
   if(!exact(result,['task','acknowledgment','provenance','humanApproval'])||!exact(result.acknowledgment,['kind','durable','operationId','requestHash','projectId','taskId','policyRevision','snapshotRevision'])||
      result.acknowledgment.kind!=='READ_OBSERVATION'||result.acknowledgment.durable!==false||result.acknowledgment.operationId!==operationId||result.acknowledgment.requestHash!==requestHash||
      result.acknowledgment.projectId!==projectId||result.acknowledgment.taskId!==taskId||result.acknowledgment.policyRevision!==actor.policyRevision||result.acknowledgment.snapshotRevision!==input.expectedRevision||
      result.provenance!=='AUTHENTICATED_AGENT_READ'||result.humanApproval!==false||!taskProjection(result.task,taskId))throw Error('AGENT_CLIENT_ACK_INVALID');return result;
  },
  close(){closed=true;token='';agent.destroy();}
 };
}
async function main(){
 if(process.argv.length!==2)throw Error('AGENT_CLIENT_STDIN_ONLY');let bytes=0;const chunks:Buffer[]=[];for await(const part of process.stdin){bytes+=part.length;if(bytes>16384)throw Error('AGENT_CLIENT_STDIN_TOO_LARGE');chunks.push(Buffer.from(part));}
 const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!input||Object.keys(input).sort().join(',')!=='caPath,origin,projectId,taskId,token'||typeof input.caPath!=='string')throw Error('AGENT_CLIENT_INPUT_INVALID');
 const ca=fs.readFileSync(input.caPath);const client=createWorkspaceAgentClient({origin:input.origin,ca,token:input.token});
 try{const consulted:any[]=[];const result=await client.readTask(input.projectId,input.taskId,async(stage,material)=>{consulted.push({stage,material});});console.log(JSON.stringify({consulted,result,qualification:'Instruction material delivered to this client; model comprehension is not asserted.'}));}finally{client.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('AGENT_CLIENT_FAILED');process.exitCode=1;});
