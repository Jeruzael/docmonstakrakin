import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import express from 'express';
import {ProjectStore} from '../server/projectStore.ts';
import {installWorkspaceProjectPersistence} from '../server/security/workspaceAccess/projectPersistence.ts';

// Synthetic HTTP adapter contract only. Actual SQL/session/permission checks
// are exercised separately by the native receipt and enforced-server suites.
let passed=0,failed=0;
async function check(name:string,fn:()=>Promise<void>){try{await fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+String(error));}}
async function fixture(options:{capable?:boolean;lostReply?:boolean;lookupError?:string;authorized?:boolean}={}){
 let revision=0,handlerCalls=0,commitCalls=0,lookupCalls=0,cleanupCalls=0;
 let stateJson=JSON.stringify({schemaVersion:1,state:{projects:[{id:'PRJ-A',name:'Before',stateVersion:1}]}});
 const receipts=new Map<string,any>(),commands:any[]=[];
 let lookupGate:Promise<void>|undefined,release=()=>{};
 const authority={execute:async(c:any)=>{
  commands.push(c);
  if(c.command==='snapshot')return{stateJson,snapshotRevision:revision,actionReceipts:options.capable!==false};
  if(c.command==='lookupReceipt'){
   lookupCalls++;if(lookupGate)await lookupGate;
   if(options.lookupError)throw Object.assign(Error(options.lookupError),{code:options.lookupError});
   const receipt=receipts.get(c.operationId);
   if(receipt&&(receipt.requestHash!==c.requestHash||receipt.action!==c.action||receipt.requestedProjectId!==(c.projectId??null)))throw Object.assign(Error('WORKSPACE_OPERATION_REPLAY'),{code:'WORKSPACE_OPERATION_REPLAY'});
   return receipt??null;
  }
  if(c.command==='commit'||c.command==='commitReceipt'){
   commitCalls++;assert.equal(c.expectedRevision,revision);revision++;stateJson=c.stateJson;
   if(c.command==='commitReceipt'){
    const receipt={version:1,operationId:c.operationId,principalId:'SYNTHETIC-OWNER',action:c.action,requestedProjectId:c.requestedProjectId??null,projectId:c.projectId,requestHash:c.requestHash,effectHash:createHash('sha256').update(c.stateJson).digest('hex'),snapshotRevision:revision,policyRevision:1};
    receipts.set(c.operationId,receipt);if(options.lostReply)return null;
    return{snapshotRevision:revision,policyRevision:1,receipt};
   }
   return{snapshotRevision:revision,policyRevision:1};
  }
  throw Error('UNEXPECTED_FIXTURE_COMMAND');
 }};
 async function start(){
  const projection=new ProjectStore(),app=express();app.use(express.json());
  app.use((_req,res,next)=>{if(options.authorized!==false)res.locals.workspaceAuthorization={digest:'a'.repeat(64),action:'project:write',projectId:'PRJ-A',policyRevision:1,snapshotRevision:revision};next();});
  await installWorkspaceProjectPersistence(app,projection,authority);
  app.get('/api/projects/PRJ-A/test',(_req,res)=>res.json({name:projection.projects[0].name}));
  app.post('/api/projects/PRJ-A/test',(req,res)=>{handlerCalls++;res.locals.projectPersistenceHooks={onCommit:()=>cleanupCalls++};projection.projects[0].name=req.body.name;projection.projects[0].stateVersion++;res.status(201).json({name:req.body.name});});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const url='http://127.0.0.1:'+(server.address()as any).port+'/api/projects/PRJ-A/test';
  return{projection,url,close:()=>new Promise<void>(r=>server.close(()=>r()))};
 }
 let runtime=await start();
 return{
  get url(){return runtime.url;},get projection(){return runtime.projection;},get stats(){return{revision,handlerCalls,commitCalls,lookupCalls,cleanupCalls};},commands,receipts,
  async restart(){await runtime.close();runtime=await start();},close:()=>runtime.close(),
  gateLookup(){lookupGate=new Promise(r=>release=r);return()=>{release();lookupGate=undefined;};},
  post(name:string,operationId=randomUUID(),expected='0',protocol='1'){return fetch(runtime.url,{method:'POST',headers:{'Content-Type':'application/json','X-DMK-Request-ID':operationId,'X-DMK-Expected-Revision':expected,...(protocol?{'X-DMK-Action-Protocol':protocol}:{})},body:JSON.stringify({name})});}
 };
}
await check('opt-in supported protocol exposes revision only after authenticated project admission',async()=>{
 const f=await fixture();try{const response=await fetch(f.url);assert.equal(response.headers.get('x-dmk-workspace-revision'),'0');assert.equal(response.headers.get('x-dmk-action-protocol'),'1');}finally{await f.close();}
 const absent=await fixture({authorized:false});try{const r=await fetch(absent.url);assert.equal(r.headers.get('x-dmk-workspace-revision'),null);assert.equal((await absent.post('Denied')).status,409);assert.equal(absent.stats.handlerCalls,0);}finally{await absent.close();}
});
await check('exact retry acknowledges historical commit without repeating handler audit effect or cleanup',async()=>{
 const f=await fixture(),id=randomUUID();try{
  const first=await f.post('First',id);assert.equal(first.status,201);assert.deepEqual(await first.json(),{name:'First'});assert.equal(first.headers.get('x-dmk-workspace-revision'),'1');
  const second=await f.post('First',id);assert.equal(second.status,200);const ack=await second.json();assert.equal(ack.replayed,true);assert.equal(ack.refreshRequired,true);assert.equal(ack.acknowledgment.operationId,id);assert.equal(ack.acknowledgment.snapshotRevision,1);
  assert.equal(f.stats.handlerCalls,1);assert.equal(f.stats.commitCalls,1);assert.equal(f.stats.cleanupCalls,1);
  assert.equal(f.commands.find(c=>c.command==='commitReceipt').requestedProjectId,'PRJ-A');
 }finally{await f.close();}
});
await check('later current state is not certified by an older committed acknowledgment',async()=>{
 const f=await fixture(),id=randomUUID();try{await f.post('First',id);assert.equal((await f.post('Second',randomUUID(),'1')).status,201);const ack=await(await f.post('First',id)).json();assert.equal(ack.acknowledgment.snapshotRevision,1);assert.equal(ack.refreshRequired,true);assert.equal(f.projection.projects[0].name,'Second');assert.equal(f.stats.commitCalls,2);}finally{await f.close();}
});
await check('changed content or original expected revision with a reused ID fails before handler',async()=>{
 const f=await fixture(),id=randomUUID();try{await f.post('First',id);assert.equal((await f.post('Changed',id)).status,409);assert.equal((await f.post('First',id,'1')).status,409);assert.equal(f.stats.handlerCalls,1);}finally{await f.close();}
});
await check('unknown operation with stale or malformed expected revision never invokes a handler',async()=>{
 const f=await fixture();try{for(const revision of['1','-1','01','1.5','9007199254740992',''])assert.ok([400,409].includes((await f.post('Denied',randomUUID(),revision)).status));assert.equal(f.stats.handlerCalls,0);}finally{await f.close();}
});
await check('unsupported protocol or legacy workspace rejects explicit opt-in without a legacy fallback',async()=>{
 const f=await fixture();try{assert.equal((await f.post('Denied',randomUUID(),'0','2')).status,400);assert.equal(f.stats.handlerCalls,0);}finally{await f.close();}
 const legacy=await fixture({capable:false});try{assert.equal((await legacy.post('Denied')).status,409);assert.equal(legacy.stats.handlerCalls,0);assert.equal((await legacy.post('Legacy',randomUUID(),'0','')).status,201);assert.equal(legacy.commands.some(c=>c.command==='commitReceipt'),false);}finally{await legacy.close();}
});
await check('lookup denial or unavailable authority never falls through to a mutation',async()=>{
 for(const code of['WORKSPACE_ACCESS_DENIED','WORKSPACE_STORE_UNAVAILABLE']){const f=await fixture({lookupError:code});try{assert.ok([403,503].includes((await f.post('Denied')).status));assert.equal(f.stats.handlerCalls,0);assert.equal(f.stats.commitCalls,0);}finally{await f.close();}}
});
await check('dynamic create-or-import route rejects explicit protocol before any authority lookup',async()=>{
 const f=await fixture();try{const r=await fetch(f.url.replace('/PRJ-A/test','/package/import'),{method:'POST',headers:{'Content-Type':'application/json','X-DMK-Request-ID':randomUUID(),'X-DMK-Expected-Revision':'0','X-DMK-Action-Protocol':'1'},body:JSON.stringify({package:{knowledge:{project:{id:'PRJ-NEW'}}}})});assert.equal(r.status,400);assert.equal((await r.json()).error,'WORKSPACE_ACTION_ROUTE_UNSUPPORTED');assert.equal(f.stats.lookupCalls,0);assert.equal(f.stats.commitCalls,0);}finally{await f.close();}
});
await check('concurrent requests cannot enter while authoritative lookup is pending',async()=>{
 const f=await fixture(),release=f.gateLookup();try{
  const request=f.post('First');
  // Deterministic RPC gate: no sleeps or timeout changes to create ordering.
  const deadline=Date.now()+1000;while(!f.stats.lookupCalls&&Date.now()<deadline)await new Promise<void>(r=>setImmediate(r));assert.ok(f.stats.lookupCalls,'lookup must enter within the bounded fixture observation');
  assert.equal((await fetch(f.url)).status,409);assert.equal((await f.post('Racing')).status,409);assert.equal(f.stats.handlerCalls,0);release();assert.equal((await request).status,201);
 }finally{release();await f.close();}
});
await check('lost commit acknowledgment keeps the projection fenced until restart then permits exact recovery',async()=>{
 const f=await fixture({lostReply:true}),id=randomUUID();try{assert.equal((await f.post('Durable',id)).status,503);assert.equal((await fetch(f.url)).status,503);assert.equal((await f.post('Durable',id)).status,503);await f.restart();assert.equal(f.projection.projects[0].name,'Durable');const retry=await f.post('Durable',id);assert.equal(retry.status,200);assert.equal((await retry.json()).acknowledgment.operationId,id);assert.equal(f.stats.commitCalls,1);assert.equal(f.stats.handlerCalls,1);}finally{await f.close();}
});
console.log(JSON.stringify({suite:'workspace-action-http',passed,failed,profile:'synthetic RPC; no authority qualification'}));if(failed)process.exitCode=1;
