import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';

// Opt-in, disposable synthetic profiles. No operator authority is opened.
const parent=fs.realpathSync.native(os.tmpdir());
const profiles=[];
for(const count of [1,8,32]){
 const root=fs.mkdtempSync(path.join(parent,'dmk-list-benchmark-'));
 let store:WorkspaceStore|undefined;
 try{
  store=await WorkspaceStore.open(root,{initialize:true});
  const principal={id:'synthetic-owner',name:'synthetic-owner',personId:'synthetic-person',kind:'HUMAN' as const,roles:[],disabled:false,credentialRevision:1,canCreateProjects:true};
  const projects=Array.from({length:count},(_,i)=>({id:'PRJ-'+i}));
  const stateJson=JSON.stringify({schemaVersion:1,state:{projects}});
  const verifier='$argon2id$v=19$m=32768,p=1,t=3$'+Buffer.alloc(16).toString('base64').replace(/=/g,'')+'$'+Buffer.alloc(32).toString('base64').replace(/=/g,'');
  await store.execute({command:'bootstrap',principal,verifier,stateJson});
  for(const project of projects)await store.execute({command:'membership',principalId:principal.id,projectId:project.id,role:'READER'});
  const info=await store.execute({command:'info'}),digest='a'.repeat(64),now=Date.now();
  await store.execute({command:'issue',principalId:principal.id,expectedCredentialRevision:1,expectedGeneration:info.generation,digest,now});
  const sample=async(candidate:boolean)=>{
   const cpu=process.cpuUsage(),start=performance.now();
   let ids:string[];
   if(candidate)ids=(await store!.execute({command:'listProjects',digest,now})).projectIds;
   else{await store!.execute({command:'session',digest,now});ids=[];for(const p of projects)if((await store!.execute({command:'authorize',digest,action:'project:read',projectId:p.id,now})).allowed)ids.push(p.id);}
   if(JSON.stringify(ids)!==JSON.stringify(projects.map(p=>p.id)))throw Error('BENCHMARK_POLICY_MISMATCH');
   return{ms:performance.now()-start,cpu:process.cpuUsage(cpu),memory:process.memoryUsage()};
  };
  await sample(true);const baseline=[],candidate=[];
  for(let i=0;i<5;i++){baseline.push(await sample(false));candidate.push(await sample(true));}
  const summarize=(rows:any[])=>{const times=rows.map(r=>r.ms).sort((a,b)=>a-b);return{p50Ms:times[2],p95Ms:times[4],minMs:times[0],maxMs:times[4],peakSampledRss:Math.max(...rows.map(r=>r.memory.rss)),peakSampledMainHeap:Math.max(...rows.map(r=>r.memory.heapUsed)),cpuUserMicros:rows.reduce((n,r)=>n+r.cpu.user,0),cpuSystemMicros:rows.reduce((n,r)=>n+r.cpu.system,0),samples:rows};};
  profiles.push({projects:count,snapshotBytes:Buffer.byteLength(stateJson),baselineRpcCount:count+1,candidateRpcCount:1,baseline:summarize(baseline),candidate:summarize(candidate)});
 }finally{await store?.close();if(path.dirname(root)!==parent||!path.basename(root).startsWith('dmk-list-benchmark-'))throw Error('CLEANUP_SCOPE_INVALID');fs.rmSync(root,{recursive:true});}
}
console.log(JSON.stringify({version:1,at:new Date().toISOString(),platform:process.platform,node:process.version,arch:process.arch,rounds:5,qualification:'Synthetic warm local measurements only; sampled RSS includes worker in this process, heap is main isolate only; sampled maxima are not guaranteed transient peaks or capacity acceptance.',profiles},null,2));
