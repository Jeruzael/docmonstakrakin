import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID,randomBytes,createHash} from 'node:crypto';import {createRequire} from 'node:module';import {Worker} from 'node:worker_threads';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';
import {WorkspaceAgentService,agentManagementRequestHash} from '../server/security/workspaceAccess/agentService.ts';
import {workspaceReviewerIdentity} from '../server/security/workspaceAccess/identity.ts';
import contract from '../server/security/workspaceAccess/agentManagementContract.cjs';
let passed=0,failed=0;
const mode=process.argv.find(v=>v.startsWith('--mode='))?.slice(7);if(mode&&!['core','capacity','edges','service'].includes(mode))throw Error('Unknown test mode');
async function test(name:string,run:()=>Promise<void>){if(mode==='capacity'&&!name.startsWith('AGC')||mode==='core'&&/^(AGC|AGE)/.test(name)||mode==='edges'&&!name.startsWith('AGE')||mode==='service'&&!name.startsWith('AG10 '))return;try{await run();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+String(error));}}
const at=1_700_000_000_000;
const verifier='$argon2id$v=19$m=32768,p=1,t=3$'+Buffer.alloc(16).toString('base64').replace(/=/g,'')+'$'+Buffer.alloc(32).toString('base64').replace(/=/g,'');
const human=(id='synthetic-owner')=>({id,name:id,personId:'SYNTHETIC-'+id,kind:'HUMAN',roles:[],canCreateProjects:true,disabled:false,credentialRevision:1});
const task=(id:string)=>({id,title:'Synthetic '+id,description:'Visible task content',status:'READY',priority:'P1',updatedAt:'2026-10-24T00:00:00Z',dependencies:['SECRET-OTHER-TASK'],evidence:['SECRET-EVIDENCE']});
const initial=()=>({schemaVersion:1,state:{projects:[{id:'PRJ-A',title:'A'},{id:'PRJ-B',title:'B'},{id:'PRJ-DOCMONSTAKRAKIN',title:'Canonical'}],workItems:{'PRJ-A':[task('TASK-A'),task('TASK-B')],'PRJ-B':[task('TASK-A')],'PRJ-DOCMONSTAKRAKIN':[task('DMK-001')]}}});
const reject=(promise:Promise<any>,code:string)=>assert.rejects(promise,(e:any)=>e.code===code,code);
async function fixture(run:(f:any)=>Promise<void>){
 const parent=fs.realpathSync.native(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'dmk-agent-authority-'));let store:WorkspaceStore|undefined;
 try{store=await WorkspaceStore.open(root,{initialize:true,actionReceipts:true,agentDelegation:true}as any);await run({root,store,setStore:(next:WorkspaceStore)=>{store=next;}});}
 finally{await store?.close();assert.equal(path.dirname(path.resolve(root)),parent);assert.match(path.basename(root),/^dmk-agent-authority-/);fs.rmSync(root,{recursive:true,force:true});}
}
async function humanSession(store:WorkspaceStore,principalId='synthetic-owner',now=at){const info=await store.execute({command:'info'}),digest=randomBytes(32).toString('hex');await store.execute({command:'issue',principalId,expectedCredentialRevision:1,expectedGeneration:info.generation,digest,now});return digest;}
async function bootstrap(store:WorkspaceStore){await store.execute({command:'bootstrap',principal:human()as any,verifier,stateJson:JSON.stringify(initial())});await store.execute({command:'membership',principalId:'synthetic-owner',projectId:'PRJ-A',role:'OWNER'});return humanSession(store);}
async function managementCommand(store:WorkspaceStore,sponsorDigest:string,command:string,fields:any={},now=at){const info=await store.execute({command:'info'});const c={command,sponsorDigest,operationId:randomUUID(),expectedPolicyRevision:info.policyRevision,now,...fields};return{...c,requestHash:agentManagementRequestHash(command,Object.fromEntries((contract.INPUT_FIELDS as any)[command].map((key:string)=>[key,c[key]])))};}
async function managed(store:WorkspaceStore,sponsorDigest:string,command:string,fields:any={},now=at){return store.execute(await managementCommand(store,sponsorDigest,command,fields,now)as any);}
async function enroll(store:WorkspaceStore,sponsorDigest:string,scope:any={kind:'TASKS',taskIds:['TASK-A']}){
 const agentId=randomUUID(),clientId=randomUUID(),grantId=randomUUID(),sessionId=randomUUID(),digest=randomBytes(32).toString('hex');
 await managed(store,sponsorDigest,'enrollAgent',{projectId:'PRJ-A',agentId,name:'synthetic-agent'});
 await managed(store,sponsorDigest,'registerAgentClient',{projectId:'PRJ-A',agentId,clientId,name:'synthetic-client'});
 await managed(store,sponsorDigest,'grantAgent',{agentId,clientId,grantId,projectId:'PRJ-A',scope,actions:['task:read'],expiresAt:at+1_800_000});
 const issuance=await managed(store,sponsorDigest,'issueAgent',{grantId,expectedGrantRevision:1,sessionId,digest});const actor=await store.execute({command:'agentSession',digest,now:at});return{agentId,clientId,grantId,sessionId,digest,actor,issuance};
}
const read=(store:WorkspaceStore,digest:string,projectId='PRJ-A',taskId='TASK-A',now=at)=>store.execute({command:'readAgentTask',digest,projectId,taskId,now});
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const sqlite=(root:string)=>new(createRequire(import.meta.url)('better-sqlite3'))(path.join(root,'.security','authority.sqlite'));
await test('AG01 fresh schema3 is explicit, development-only and keeps HUMAN receipts',()=>fixture(async({store})=>{
 assert.equal((await store.execute({command:'info'})).schemaVersion,3);
 assert.deepEqual(await store.execute({command:'snapshot'}),{stateJson:null,snapshotRevision:0,actionReceipts:true,agentDelegation:true,agentDevelopmentOnly:true});
}));
await test('AG02 exact scoped projection, cross-kind/project/task denial, no snapshot or action receipt effect',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),before=await store.execute({command:'snapshot'}),a=await enroll(store,sponsor),audit=await store.execute({command:'audit'});
 const result=await read(store,a.digest);assert.equal(result.allowed,true);assert.deepEqual(Object.keys(result.task).sort(),['description','id','priority','status','title','updatedAt']);assert.equal(result.actor.kind,'AGENT');
 for(const [p,t]of[['PRJ-A','TASK-B'],['PRJ-A','MISSING'],['PRJ-B','TASK-A'],['PRJ-DOCMONSTAKRAKIN','DMK-001']])assert.deepEqual(await read(store,a.digest,p,t),{allowed:false,reason:'TASK_ACCESS_DENIED'});
 assert.equal(await store.execute({command:'session',digest:a.digest,now:at}),null);assert.equal(await store.execute({command:'agentSession',digest:sponsor,now:at}),null);
 assert.throws(()=>workspaceReviewerIdentity(a.actor),/WORKSPACE_IDENTITY_INVALID/);
 await reject(store.execute({command:'enrollAgent',sponsorDigest:a.digest,operationId:randomUUID(),requestHash:'a'.repeat(64),expectedPolicyRevision:a.actor.policyRevision,agentId:randomUUID(),name:'fake',projectId:'PRJ-A',now:at}as any),'WORKSPACE_INPUT_INVALID');
 assert.deepEqual(await store.execute({command:'snapshot'}),before);assert.deepEqual(await store.execute({command:'audit'}),audit);
}));
await test('AG03 management retries bind body/actor, return original IDs before CAS, and never duplicate effects',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),c=await managementCommand(store,sponsor,'enrollAgent',{projectId:'PRJ-A',agentId:randomUUID(),name:'synthetic-agent'});
 const first=await store.execute(c as any),audit=await store.execute({command:'audit'}),replay=await store.execute({...c,agentId:randomUUID()}as any);
 assert.equal(replay.replayed,true);assert.deepEqual(replay.acknowledgment,first.acknowledgment);assert.equal((await store.execute({command:'info'})).counts.agentPrincipals,1);assert.deepEqual(await store.execute({command:'audit'}),audit);
 const changed={...c,name:'changed'};changed.requestHash=agentManagementRequestHash(c.command,{projectId:c.projectId,name:changed.name,expectedPolicyRevision:c.expectedPolicyRevision});
 await reject(store.execute(changed as any),'WORKSPACE_OPERATION_REPLAY');
 await store.execute({command:'provision',principal:human('synthetic-other')as any,verifier});await store.execute({command:'membership',principalId:'synthetic-other',projectId:'PRJ-A',role:'OWNER'});
 await reject(store.execute({...c,sponsorDigest:await humanSession(store,'synthetic-other')}as any),'WORKSPACE_ACCESS_DENIED');
}));
await test('AG04 reopened identities persist, old sessions fence, same grant permits fresh current issuance',()=>fixture(async({store,root,setStore})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);await store.close();const next=await WorkspaceStore.open(root);setStore(next);
 assert.equal(await next.execute({command:'agentSession',digest:a.digest,now:at}),null);const fresh=await humanSession(next),digest=randomBytes(32).toString('hex');
 await managed(next,fresh,'issueAgent',{grantId:a.grantId,expectedGrantRevision:1,sessionId:randomUUID(),digest});const actor=await next.execute({command:'agentSession',digest,now:at});
 assert.equal(actor.principalId,a.agentId);assert.equal(actor.clientId,a.clientId);assert.equal((await read(next,digest)).allowed,true);
 const counts=(await next.execute({command:'info'})).counts;assert.equal(counts.agentPrincipals,1);assert.equal(counts.agentClients,1);assert.equal(counts.agentGrants,1);
}));
await test('AG05 loss/restoration of OWNER cannot revive grant; sponsor may still revoke with replay',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);await store.execute({command:'membership',principalId:'synthetic-owner',projectId:'PRJ-A',role:'EDITOR'});
 assert.equal(await store.execute({command:'agentSession',digest:a.digest,now:at}),null);await store.execute({command:'membership',principalId:'synthetic-owner',projectId:'PRJ-A',role:'OWNER'});assert.equal((await read(store,a.digest)).allowed,false);
 await reject(managed(store,sponsor,'issueAgent',{grantId:a.grantId,expectedGrantRevision:1,sessionId:randomUUID(),digest:randomBytes(32).toString('hex')}),'WORKSPACE_ACCESS_DENIED');
 await store.execute({command:'membership',principalId:'synthetic-owner',projectId:'PRJ-A',role:'DENY'});const revoke=await managementCommand(store,sponsor,'revokeAgent',{agentId:a.agentId});
 const first=await store.execute(revoke as any),audit=await store.execute({command:'audit'});assert.equal(first.acknowledgment.revoked,true);assert.equal((await store.execute(revoke as any)).replayed,true);assert.deepEqual(await store.execute({command:'audit'}),audit);
}));
await test('AG06 HUMAN logout preserves bounded delegation; individual session and client revocation isolate correctly',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor),otherDigest=randomBytes(32).toString('hex');await managed(store,sponsor,'issueAgent',{grantId:a.grantId,expectedGrantRevision:1,sessionId:randomUUID(),digest:otherDigest});
 assert.equal(await store.execute({command:'revokeAgentSession',digest:a.digest,now:at}),true);assert.equal((await read(store,a.digest)).allowed,false);assert.equal((await read(store,otherDigest)).allowed,true);
 await store.execute({command:'logout',digest:sponsor,now:at});assert.equal((await read(store,otherDigest)).allowed,true);
 const fresh=await humanSession(store);await managed(store,fresh,'revokeAgentClient',{clientId:a.clientId});assert.equal((await read(store,otherDigest)).allowed,false);
}));
for(const operation of ['resetCredential','disable'])await test('AG07 '+operation+' cascades to delegated sessions',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);await store.execute({command:operation,principalId:'synthetic-owner',...(operation==='resetCredential'?{verifier}:{})}as any);assert.equal(await store.execute({command:'agentSession',digest:a.digest,now:at}),null);assert.equal((await read(store,a.digest)).allowed,false);
}));
await test('AG08 expiry equality, idle boundary and clock rollback fail closed',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);await reject(store.execute({command:'agentSession',digest:a.digest,now:at-1}),'WORKSPACE_CLOCK_ROLLBACK');
 for(const offset of [599_999,1_199_998,1_799_997])assert.ok(await store.execute({command:'agentSession',digest:a.digest,now:at+offset}));assert.equal(await store.execute({command:'agentSession',digest:a.digest,now:at+1_800_000}),null);
}));
await test('AG09 scopes/actions and direct privilege requests deny without audit/snapshot effects',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor),before=await store.execute({command:'audit'});
 const base={agentId:a.agentId,clientId:a.clientId,grantId:randomUUID(),projectId:'PRJ-A',scope:{kind:'TASKS',taskIds:['TASK-A']},actions:['task:read'],expiresAt:at+1000};
 for(const scope of [{kind:'TASKS',taskIds:[]},{kind:'TASKS',taskIds:['TASK-A','TASK-A']},{kind:'TASKS',taskIds:['TASK-B','TASK-A']},{kind:'*'}])await reject(managed(store,sponsor,'grantAgent',{...base,scope}),'WORKSPACE_INPUT_INVALID');
 await reject(managed(store,sponsor,'grantAgent',{...base,actions:['task:write']}),'WORKSPACE_INPUT_INVALID');await reject(managed(store,sponsor,'grantAgent',{...base,scope:{kind:'TASKS',taskIds:['MISSING']}}),'WORKSPACE_ACCESS_DENIED');
 await reject(managed(store,sponsor,'grantAgent',{...base,projectId:'PRJ-DOCMONSTAKRAKIN'}),'WORKSPACE_ACCESS_DENIED');
 await reject(store.execute({command:'commitAgentReceipt',digest:a.digest}as any),'WORKSPACE_COMMAND_UNSUPPORTED');assert.deepEqual(await store.execute({command:'audit'}),before);
 const broad=await enroll(store,sponsor,{kind:'PROJECT_TASKS'});assert.equal((await read(store,broad.digest,'PRJ-A','TASK-B')).allowed,true);assert.equal((await read(store,broad.digest,'PRJ-B','TASK-B')).allowed,false);
}));
await test('AG10 real service issues secret once; same operation recovers acknowledgment without another session',()=>fixture(async({store,root})=>{
 await bootstrap(store);const humanToken='e'.repeat(64),sponsor=sha(humanToken),info=await store.execute({command:'info'});await store.execute({command:'issue',principalId:'synthetic-owner',expectedCredentialRevision:1,expectedGeneration:info.generation,digest:sponsor,now:at});
 const a=await enroll(store,sponsor),service=new WorkspaceAgentService(store,()=>at),input={operationId:randomUUID(),grantId:a.grantId,expectedGrantRevision:1,expectedPolicyRevision:(await store.execute({command:'info'})).policyRevision};
 const first=await service.issueAgent(humanToken,input);assert.equal(first.accepted,true);assert.ok(first.accepted&&first.tokenAvailable);const audit=await store.execute({command:'audit'}),counts=(await store.execute({command:'info'})).counts;
 const retry=await service.issueAgent(humanToken,input);assert.equal(retry.accepted,true);assert.ok(retry.accepted&&!retry.tokenAvailable);assert.equal(Object.hasOwn(retry,'token'),false);assert.deepEqual((await store.execute({command:'info'})).counts,counts);assert.deepEqual(await store.execute({command:'audit'}),audit);
 if(first.accepted){assert.equal((await service.readTask(first.token,{projectId:'PRJ-A',taskId:'TASK-A'})).allowed,true);const db=sqlite(root);try{assert.ok(!JSON.stringify(db.prepare('SELECT * FROM agent_sessions').all()).includes(first.token!));assert.ok(!JSON.stringify(db.prepare('SELECT * FROM agent_management_ops').all()).includes(first.token!));}finally{db.close();}}
 const raceInput={operationId:randomUUID(),projectId:'PRJ-A',name:'synthetic-race',expectedPolicyRevision:(await store.execute({command:'info'})).policyRevision};
 const raced=await Promise.all([service.enrollAgent(humanToken,raceInput),service.enrollAgent(humanToken,raceInput)]);assert.ok(raced.every(r=>r.accepted));
 if(raced[0].accepted&&raced[1].accepted){assert.deepEqual(raced[0].result.acknowledgment,raced[1].result.acknowledgment);assert.deepEqual([raced[0].result.replayed,raced[1].result.replayed].sort(),[false,true]);}
 const stale=await service.enrollAgent(humanToken,{...raceInput,operationId:randomUUID()});assert.equal(stale.accepted,false);if(!stale.accepted)assert.equal(stale.code,'WORKSPACE_STALE_REVISION');assert.equal((await store.execute({command:'info'})).counts.agentPrincipals,2);
}));
await test('AG11 schema3 HUMAN receipt compatibility and global operation collision denial',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor),info=await store.execute({command:'info'}),operationId=randomUUID(),state=initial();state.state.projects[0].title='Human update';
 const c={command:'commitReceipt',operationId,digest:sponsor,action:'project:write',projectId:'PRJ-A',requestedProjectId:'PRJ-A',requestHash:sha('human-body'),expectedRevision:info.snapshotRevision,expectedPolicyRevision:info.policyRevision,stateJson:JSON.stringify(state),now:at};
 const first=await store.execute(c as any);assert.equal(first.receipt.version,1);assert.equal((await store.execute(c as any)).receipt.operationId,operationId);
 await reject(managed(store,sponsor,'registerAgentClient',{projectId:'PRJ-A',agentId:a.agentId,clientId:randomUUID(),name:'collision',operationId}),'WORKSPACE_OPERATION_REPLAY');
 await reject(store.execute({...c,operationId:a.issuance.acknowledgment.operationId}as any),'WORKSPACE_OPERATION_REPLAY');
}));
await test('AG12 raw option rejects before acquisition, existing schema opt-in never rewrites SQLite',()=>fixture(async({store,root})=>{
 await bootstrap(store);await store.close();const file=path.join(root,'.security','authority.sqlite'),bytes=fs.readFileSync(file);
 await reject(WorkspaceStore.open(root,{initialize:true,actionReceipts:true,agentDelegation:true}),'WORKSPACE_SCHEMA_UNSUPPORTED');assert.deepEqual(fs.readFileSync(file),bytes);
 for(const value of ['true',true]){const worker=new Worker(new URL('../server/security/workspaceAccess/worker.cjs',import.meta.url),{workerData:{initialize:true,actionReceipts:value===true?false:true,agentDelegation:value},execArgv:[]});try{const ready=await new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Option admission exceeded existing startup budget')),10000);worker.once('message',v=>{clearTimeout(timer);resolve(v);});worker.once('error',e=>{clearTimeout(timer);reject(e);});});assert.deepEqual(ready,{ready:false,error:'WORKSPACE_INPUT_INVALID'});}finally{await worker.terminate();}}
}));
await test('AG13 canonical-looking grant tamper and management receipt tamper reject on reopen',()=>fixture(async({store,root})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);await store.close();const db=sqlite(root);const original=db.prepare('SELECT scopeJson FROM agent_grants WHERE id=?').get(a.grantId).scopeJson;
 db.prepare('UPDATE agent_grants SET scopeJson=? WHERE id=?').run('{"kind":"PROJECT_TASKS"}',a.grantId);db.close();await reject(WorkspaceStore.open(root),'WORKSPACE_CORRUPT');
 const repair=sqlite(root);repair.prepare('UPDATE agent_grants SET scopeJson=? WHERE id=?').run(original,a.grantId);const row=repair.prepare('SELECT operationId,receiptJson FROM agent_management_ops LIMIT 1').get();const receipt=JSON.parse(row.receiptJson);receipt.requestHash='f'.repeat(64);repair.prepare('UPDATE agent_management_ops SET receiptJson=?,requestHash=? WHERE operationId=?').run(JSON.stringify(receipt),receipt.requestHash,row.operationId);repair.close();await reject(WorkspaceStore.open(root),'WORKSPACE_CORRUPT');
}));
await test('AGC1 combined principal/session and explicit client/grant limits reject atomically',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);
 for(let i=0;i<126;i++)await store.execute({command:'provision',principal:human('synthetic-cap-'+i)as any,verifier});
 await reject(managed(store,sponsor,'enrollAgent',{projectId:'PRJ-A',agentId:randomUUID(),name:'overflow'}),'WORKSPACE_CAPACITY_EXCEEDED');await reject(store.execute({command:'provision',principal:human('synthetic-overflow')as any,verifier}),'WORKSPACE_CAPACITY_EXCEEDED');
 for(let i=0;i<254;i++)await humanSession(store);await reject(managed(store,sponsor,'issueAgent',{grantId:a.grantId,expectedGrantRevision:1,sessionId:randomUUID(),digest:randomBytes(32).toString('hex')}),'WORKSPACE_CAPACITY_EXCEEDED');
 for(let i=1;i<256;i++)await managed(store,sponsor,'registerAgentClient',{projectId:'PRJ-A',agentId:a.agentId,clientId:randomUUID(),name:'synthetic-cap'});
 await reject(managed(store,sponsor,'registerAgentClient',{projectId:'PRJ-A',agentId:a.agentId,clientId:randomUUID(),name:'overflow'}),'WORKSPACE_CAPACITY_EXCEEDED');
 for(let i=1;i<512;i++)await managed(store,sponsor,'grantAgent',{agentId:a.agentId,clientId:a.clientId,grantId:randomUUID(),projectId:'PRJ-A',scope:{kind:'TASKS',taskIds:['TASK-A']},actions:['task:read'],expiresAt:at+1_800_000});
 const before=await store.execute({command:'info'});await reject(managed(store,sponsor,'grantAgent',{agentId:a.agentId,clientId:a.clientId,grantId:randomUUID(),projectId:'PRJ-A',scope:{kind:'PROJECT_TASKS'},actions:['task:read'],expiresAt:at+1_800_000}),'WORKSPACE_CAPACITY_EXCEEDED');assert.deepEqual(await store.execute({command:'info'}),before);
}));
await test('AGC2 shared operation ceiling includes management and HUMAN tombstones',()=>fixture(async({store,root,setStore})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);await store.close();const db=sqlite(root);try{const used=db.prepare('SELECT count(*) AS n FROM agent_management_ops').get().n;db.exec('BEGIN IMMEDIATE');for(let i=used;i<4096;i++)db.prepare('INSERT INTO operations VALUES(?,?,NULL)').run(randomUUID(),1);db.exec('COMMIT');}finally{db.close();}
 const next=await WorkspaceStore.open(root);setStore(next);const fresh=await humanSession(next),before=await next.execute({command:'info'});
 await reject(managed(next,fresh,'registerAgentClient',{projectId:'PRJ-A',agentId:a.agentId,clientId:randomUUID(),name:'overflow'}),'WORKSPACE_CAPACITY_EXCEEDED');
 await reject(next.execute({command:'commit',operationId:randomUUID(),digest:fresh,action:'project:write',projectId:'PRJ-A',expectedRevision:before.snapshotRevision,expectedPolicyRevision:before.policyRevision,stateJson:JSON.stringify(initial()),now:at}),'WORKSPACE_CAPACITY_EXCEEDED');assert.deepEqual(await next.execute({command:'info'}),before);
}));
for(const limit of [4095,4096])await test('AGC3 audit '+limit+' rolls back management identity, receipt and clock together',()=>fixture(async({store,root,setStore})=>{
 await bootstrap(store);await store.close();const db=sqlite(root);try{const m=db.prepare('SELECT * FROM metadata').get();let prev=db.prepare('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').get().hash;const existing=db.prepare('SELECT count(*) AS n FROM audit').get().n;db.exec('BEGIN IMMEDIATE');for(let i=existing;i<limit-2;i++){const raw=JSON.stringify({type:'SYNTHETIC_CAPACITY_FIXTURE',targetHash:null,at,generation:m.generation,policyRevision:m.policyRevision,snapshotRevision:m.snapshotRevision}),hash=sha(prev+'\n'+raw);db.prepare('INSERT INTO audit(raw,previousHash,hash) VALUES(?,?,?)').run(raw,prev,hash);prev=hash;}db.exec('COMMIT');}finally{db.close();}
 const next=await WorkspaceStore.open(root);setStore(next);const fresh=await humanSession(next),before=await next.execute({command:'info'});assert.equal(before.counts.audit,limit);
 await reject(managed(next,fresh,'enrollAgent',{projectId:'PRJ-A',agentId:randomUUID(),name:'rollback'},at+1),'WORKSPACE_CAPACITY_EXCEEDED');assert.deepEqual(await next.execute({command:'info'}),before);const inspect=sqlite(root);try{assert.equal(inspect.prepare('SELECT count(*) AS n FROM agent_management_ops').get().n,0);assert.equal(inspect.prepare('SELECT clockHighWater FROM metadata').get().clockHighWater,at);}finally{inspect.close();}
}));
await test('AGE1 exact agent idle boundary and shorter grant expiry deny before absolute limit',()=>fixture(async({store})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor),grantId=randomUUID(),digest=randomBytes(32).toString('hex');
 await managed(store,sponsor,'grantAgent',{agentId:a.agentId,clientId:a.clientId,grantId,projectId:'PRJ-A',scope:{kind:'TASKS',taskIds:['TASK-A']},actions:['task:read'],expiresAt:at+1000});
 await managed(store,sponsor,'issueAgent',{grantId,expectedGrantRevision:1,sessionId:randomUUID(),digest});assert.equal((await store.execute({command:'agentSession',digest,now:at})).expiresAt,at+1000);
 assert.equal(await store.execute({command:'agentSession',digest,now:at+1000}),null);assert.equal(await store.execute({command:'agentSession',digest:a.digest,now:at+600_000}),null);
}));
for(const beforeAgent of [4094,4095])await test('AGE2 shared digest budget '+beforeAgent+' counts token and session-ID tombstones',()=>fixture(async({store,root,setStore})=>{
 const sponsor=await bootstrap(store),a=await enroll(store,sponsor);await store.close();const db=sqlite(root);try{const n=db.prepare('SELECT count(*) AS n FROM used_digests').get().n;db.exec('BEGIN IMMEDIATE');for(let i=n;i<beforeAgent-1;i++)db.prepare('INSERT INTO used_digests VALUES(?)').run(sha('SYNTHETIC-DIGEST-CAPACITY-'+i));db.exec('COMMIT');}finally{db.close();}
 const next=await WorkspaceStore.open(root);setStore(next);const fresh=await humanSession(next),fields={grantId:a.grantId,expectedGrantRevision:1,sessionId:randomUUID(),digest:randomBytes(32).toString('hex')};
 if(beforeAgent===4094)assert.equal((await managed(next,fresh,'issueAgent',fields)).replayed,false);
 else{const before=await next.execute({command:'info'});await reject(managed(next,fresh,'issueAgent',fields),'WORKSPACE_CAPACITY_EXCEEDED');assert.deepEqual(await next.execute({command:'info'}),before);await humanSession(next);}
 await reject(humanSession(next),'WORKSPACE_CAPACITY_EXCEEDED');await reject(managed(next,fresh,'issueAgent',{...fields,sessionId:randomUUID(),digest:randomBytes(32).toString('hex')}),'WORKSPACE_CAPACITY_EXCEEDED');
 const inspect=sqlite(root);try{assert.equal(inspect.prepare('SELECT count(*) AS n FROM used_digests').get().n,4096);}finally{inspect.close();}
}));
console.log(JSON.stringify({suite:'workspace-agent-delegation',mode:mode??'complete',node:process.version,passed,failed}));if(failed)process.exitCode=1;
