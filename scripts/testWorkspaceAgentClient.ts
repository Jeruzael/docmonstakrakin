import assert from 'node:assert/strict';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
let api:any,passed=0,failed=0;try{api=await import('./workspaceAgentClient.ts');}catch{}
async function check(name:string,fn:()=>unknown|Promise<unknown>){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e);}}
await check('explicitly trusted loopback HTTPS client exists',()=>assert.equal(typeof api?.createWorkspaceAgentClient,'function'));
if(api){
 const input={origin:'https://127.0.0.1:3000',ca:Buffer.from('synthetic public trust input'),token:'dmk_agent_v1_'+'a'.repeat(64)};
 await check('plaintext remote URLs URL credentials paths and queries reject without network',()=>{for(const origin of['http://127.0.0.1:3000','https://example.com','https://user:pass@127.0.0.1:3000','https://127.0.0.1:3000/project','https://127.0.0.1:3000/?token=x'])assert.throws(()=>api.createWorkspaceAgentClient({...input,origin}));});
 await check('missing CA invalid token and permissive TLS options reject',()=>{for(const value of[{...input,ca:Buffer.alloc(0)},{...input,token:'a'.repeat(64)},{...input,rejectUnauthorized:false},{...input,timeoutMs:6000}])assert.throws(()=>api.createWorkspaceAgentClient(value));});
 await check('construction never enrolls or opens network and close is explicit',()=>{const c=api.createWorkspaceAgentClient(input);assert.equal(typeof c.readTask,'function');c.close();assert.throws(()=>c.session());});
 // Exercise the real client response boundary with a controlled transport only.
 // No socket, native authority, TLS certificate or synthetic human proof is used.
 async function response(mutate:(value:any)=>void=()=>{},session:any={}){
  const original=https.request,stages:string[]=[],paths:string[]=[],operationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  (https as any).request=(url:URL,_options:any,received:(res:any)=>void)=>{
   paths.push(url.pathname);const req:any=new EventEmitter();req.setTimeout=()=>req;req.destroy=()=>req;
   req.end=(bytes?:Buffer)=>queueMicrotask(()=>{
    const body=bytes?JSON.parse(bytes.toString()):null;let value:any;
    if(url.pathname.endsWith('/session'))value={actor:{kind:'AGENT',projectId:'PRJ-A',policyRevision:3,snapshotRevision:2,...session}};
    else if(url.pathname.endsWith('/description'))value={description:'Fixture description',consultationReceipt:'fixture'};
    else if(url.pathname.endsWith('/content'))value={instructions:'Fixture instructions',admissionReceipt:'fixture'};
    else{value={task:{id:'TASK-A',title:'Task',description:'Literal task data',status:'BACKLOG',priority:'P1',updatedAt:'2026-10-24'},acknowledgment:{kind:'READ_OBSERVATION',durable:false,operationId,requestHash:createHash('sha256').update(JSON.stringify(['DMK_AGENT_READ/1',body.request])).digest('hex'),projectId:'PRJ-A',taskId:'TASK-A',policyRevision:3,snapshotRevision:2},provenance:'AUTHENTICATED_AGENT_READ',humanApproval:false};mutate(value);}
    const res:any=new PassThrough();res.statusCode=200;received(res);res.end(JSON.stringify(value));
   });return req;
  };
  const client=api.createWorkspaceAgentClient(input);
  try{const result=await client.readTask('PRJ-A','TASK-A',async(stage:string)=>{stages.push(stage);},operationId);return{result,stages,paths};}finally{client.close();https.request=original;}
 }
 await check('correlated response remains a nondurable read observation after both instruction stages',async()=>{
  const {result,stages,paths}=await response();assert.equal(result.acknowledgment.durable,false);assert.equal(result.humanApproval,false);assert.equal(result.provenance,'AUTHENTICATED_AGENT_READ');assert.deepEqual(stages,['DESCRIPTION','INSTRUCTIONS']);assert.equal(paths.length,4);
 });
 await check('mismatched request hash rejects the response',async()=>{await assert.rejects(response(value=>{value.acknowledgment.requestHash='0'.repeat(64);}),/AGENT_CLIENT_ACK_INVALID/);});
 await check('policy revision must match the observed current agent context',async()=>{await assert.rejects(response(value=>{value.acknowledgment.policyRevision=999;}),/AGENT_CLIENT_ACK_INVALID/);});
 await check('provenance and human approval claims cannot change read meaning',async()=>{
  for(const [key,value] of [['provenance','HUMAN_APPROVED'],['humanApproval',true]] as const)await assert.rejects(response(result=>{result[key]=value;}),/AGENT_CLIENT_ACK_INVALID/);
 });
 await check('response and acknowledgment shapes are exact with no missing or extra claims',async()=>{
  for(const change of [(v:any)=>{v.extra='unrecognized';},(v:any)=>{delete v.humanApproval;},(v:any)=>{v.acknowledgment.actor='forged';},(v:any)=>{delete v.acknowledgment.policyRevision;},(v:any)=>{v.acknowledgment.durable=true;}])await assert.rejects(response(change),/AGENT_CLIENT_ACK_INVALID/);
 });
 await check('task projection requires the exact six fields',async()=>{
  for(const change of [(v:any)=>{v.task.accepted=true;},(v:any)=>{delete v.task.description;},(v:any)=>{v.task.title={text:'not a string'};}])await assert.rejects(response(change),/AGENT_CLIENT_ACK_INVALID/);
 });
 await check('task projection preserves worker byte enum and Unicode bounds',async()=>{
  for(const [key,value] of [['title','x'.repeat(1025)],['description','x'.repeat(65537)],['updatedAt','x'.repeat(129)],['status','UNRECOGNIZED'],['priority','P9'],['description','\ud800']] as const)await assert.rejects(response(result=>{result.task[key]=value;}),/AGENT_CLIENT_ACK_INVALID/);
 });
 await check('exact worker byte limits and permitted empty description remain compatible',async()=>{
  const {result}=await response(value=>{value.task.title='é'.repeat(512);value.task.description='x'.repeat(65536);value.task.updatedAt='x'.repeat(128);value.task.status='APPROVED';value.task.priority='P0';});assert.equal(Buffer.byteLength(result.task.title),1024);assert.equal(result.task.description.length,65536);assert.equal((await response(value=>{value.task.description='';})).result.task.description,'');
 });
 await check('missing negative or noninteger session revisions cannot initiate a read',async()=>{
  for(const session of [{policyRevision:undefined},{policyRevision:-1},{policyRevision:1.5},{snapshotRevision:-1}])await assert.rejects(response(()=>{},session),/AGENT_CLIENT_CONTEXT_INVALID/);
 });
}
console.log(JSON.stringify({suite:'workspace-agent-client',passed,failed}));if(failed)process.exitCode=1;
