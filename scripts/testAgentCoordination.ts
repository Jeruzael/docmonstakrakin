import assert from 'node:assert/strict';import express from 'express';
import {ProjectStore} from '../server/projectStore.ts';import {installWorkspaceProjectPersistence} from '../server/security/workspaceAccess/projectPersistence.ts';
let passed=0,failed=0;async function check(name:string,fn:()=>Promise<unknown>){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e);}}
const app=express(),store=new ProjectStore();const coordinator=await installWorkspaceProjectPersistence(app,store,{execute:async()=>({snapshotRevision:0,stateJson:null})});
app.get('/api/projects',(_req,res)=>res.json([]));const listener=app.listen(0,'127.0.0.1');await new Promise<void>(r=>listener.once('listening',r));const base='http://127.0.0.1:'+(listener.address() as any).port;
try{
 await check('authority-only operation uses the shared projection reservation without a fake snapshot',async()=>{let release!:()=>void,started!:()=>void;const entered=new Promise<void>(r=>started=r);const pending=coordinator.runAuthorityOperation(async()=>{started();await new Promise<void>(r=>release=r);return{accepted:false,code:'KNOWN_REJECTION'};});await entered;assert.equal((await fetch(base+'/api/projects')).status,409);await assert.rejects(coordinator.runAuthorityOperation(async()=>1),/IN_PROGRESS/);release();assert.equal((await pending).accepted,false);assert.equal((await fetch(base+'/api/projects')).status,200);});
 await check('unknown authority outcome fences reads and later sponsor operations',async()=>{await assert.rejects(coordinator.runAuthorityOperation(async()=>{throw Error('UNKNOWN_OUTCOME');}));assert.equal((await fetch(base+'/api/projects')).status,503);await assert.rejects(coordinator.runAuthorityOperation(async()=>1),/RECOVERY_REQUIRED/);});
}finally{await new Promise<void>(r=>listener.close(()=>r()));}
console.log(JSON.stringify({suite:'agent-coordination',passed,failed}));if(failed)process.exitCode=1;
