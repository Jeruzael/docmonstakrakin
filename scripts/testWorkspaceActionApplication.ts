/** Actual application + fresh schema2 + native credentials; synthetic humans only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import {randomBytes,randomUUID} from 'node:crypto';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';
import {recoverWorkspaceLock} from '../server/security/workspaceAccess/privateDirectory.ts';
const source=process.cwd(),directory=fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()),'dmk-action-application-'));
const password='Synthetic-action-'+randomBytes(18).toString('hex');let child:ReturnType<typeof spawn>|undefined,output='',base='',cookie='',csrf='',passed=0,failed=0;
async function check(name:string,fn:()=>unknown|Promise<unknown>){try{await fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+String(error).replaceAll(password,'[redacted]'));throw error;}}
async function stop(){if(child?.exitCode===null){const done=new Promise<void>(r=>child!.once('exit',()=>r()));child.kill('SIGKILL');await done;}}
async function launch(){
 const probe=net.createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address()as net.AddressInfo).port;await new Promise<void>(r=>probe.close(()=>r()));base='http://127.0.0.1:'+port;output='';
 const env:NodeJS.ProcessEnv={NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),GEMINI_API_KEY:''};for(const key of['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
 child=spawn(process.execPath,['--import',pathToFileURL(path.join(source,'node_modules/tsx/dist/loader.mjs')).href,'--import',pathToFileURL(path.join(directory,'deny-native.mjs')).href,path.join(source,'server.ts')],{cwd:directory,env,windowsHide:true,stdio:'pipe'});
 child.stdout!.on('data',b=>output+=b);child.stderr!.on('data',b=>output+=b);
 const deadline=Date.now()+20000;while(child.exitCode===null&&!output.includes('Control Plane running')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));assert.equal(child.exitCode,null,output.slice(-1600));assert.match(output,/Control Plane running/);
}
async function request(endpoint:string,method='GET',body?:unknown,options:{id?:string;revision?:number;authenticated?:boolean;proof?:boolean;protocol?:boolean}={}){
 const response=await fetch(base+endpoint,{method,headers:{Origin:base,...(body===undefined?{}:{'Content-Type':'application/json'}),...(options.authenticated!==false&&cookie?{Cookie:cookie}:{}),...(options.proof!==false&&csrf?{'X-DMK-CSRF':csrf}:{}),...(options.id?{'X-DMK-Request-ID':options.id}:{}),...(options.revision===undefined?{}:{'X-DMK-Expected-Revision':String(options.revision)}),...(options.protocol?{'X-DMK-Action-Protocol':'1'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(4000)});
 const text=await response.text();let data:any;try{data=JSON.parse(text);}catch{data=text;}return{response,data};
}
async function login(name='synthetic-action-owner'){const r=await request('/api/governance/session','POST',{username:name,password},{authenticated:false});assert.equal(r.response.status,200,JSON.stringify(r.data));cookie=(r.response.headers.get('set-cookie')??'').split(';')[0];csrf=r.data.csrf;assert.match(cookie,/^dmk_workspace=[a-f0-9]{64}$/);}
const cli=(args:string[])=>execFileSync(process.execPath,['--import',pathToFileURL(path.join(source,'node_modules/tsx/dist/loader.mjs')).href,path.join(source,'scripts/workspaceSecurity.ts'),...args],{cwd:directory,input:password+'\n',encoding:'utf8',windowsHide:true,timeout:30000});
let projectId='',createReceipt:any,docReceipt:any;const createId=randomUUID(),docId=randomUUID();
const project={name:'Synthetic receipt project',profiles:['WEB_APPLICATION'],specializedProfiles:[]};
let document:any;
try{
 fs.mkdirSync(path.join(directory,'dist'));fs.writeFileSync(path.join(directory,'dist/index.html'),'<html>Disposable action fixture</html>');
 fs.writeFileSync(path.join(directory,'deny-native.mjs'),`import {installNativeCredentialTripwire} from ${JSON.stringify(pathToFileURL(path.join(source,'scripts/fixtures/syntheticServerPreload.ts')).href)};installNativeCredentialTripwire();`);
 await check('offline CLI explicitly creates fresh receipt schema without migration or default project ownership',()=>{assert.equal(JSON.parse(cli(['init','--id','synthetic-action-owner','--name','synthetic-action-owner','--person','synthetic-person','--can-create','--action-receipts'])).completed,true);assert.equal(fs.existsSync(path.join(directory,'.local/project-state.json')),false);});
 await check('actual authenticated discovery exposes supported protocol and current CAS revision',async()=>{await launch();const anonymous=await request('/api/projects');assert.equal(anonymous.response.status,401);assert.equal(anonymous.response.headers.get('x-dmk-workspace-revision'),null);await login();const r=await request('/api/projects');assert.deepEqual(r.data,[]);assert.equal(r.response.headers.get('x-dmk-action-protocol'),'1');assert.equal(r.response.headers.get('x-dmk-workspace-revision'),'0');});
 await check('real initial project creation acknowledges exactly once and creates scoped ownership',async()=>{
  const r=await request('/api/projects','POST',project,{id:createId,revision:0,protocol:true});assert.equal(r.response.status,201,JSON.stringify(r.data));projectId=r.data.id;assert.match(projectId,/^PRJ-/);assert.equal(r.response.headers.get('x-dmk-action-acknowledged'),createId);
  const repeat=await request('/api/projects','POST',project,{id:createId,revision:0,protocol:true});assert.equal(repeat.response.status,200,JSON.stringify(repeat.data));assert.equal(repeat.data.replayed,true);createReceipt=repeat.data.acknowledgment;assert.equal(createReceipt.projectId,projectId);assert.equal(createReceipt.requestedProjectId,null);assert.equal(createReceipt.snapshotRevision,1);assert.equal((await request('/api/projects')).data.length,1);
 });
 await check('real CSRF and changed-intent checks reject before project creation',async()=>{
  const denied=await request('/api/projects','POST',project,{id:randomUUID(),revision:1,protocol:true,proof:false});assert.equal(denied.response.status,403);
  const changed=await request('/api/projects','POST',{...project,name:'Changed'},{id:createId,revision:0,protocol:true});assert.equal(changed.response.status,409);assert.equal((await request('/api/projects')).data.length,1);
 });
 await check('managed document creation and retry retain one document and one immutable operation acknowledgment',async()=>{
  document={title:'Synthetic receipt doc',kind:'ARCHITECTURE',format:'MARKDOWN',content:'# Synthetic receipt\n\nDisposable content.\n',expectedStateVersion:1,reason:'Receipt regression',humanConfirmed:true,requestId:randomUUID()};
  const first=await request('/api/projects/'+projectId+'/docs','POST',document,{id:docId,revision:1,protocol:true});assert.equal(first.response.status,201,JSON.stringify(first.data));
  const retry=await request('/api/projects/'+projectId+'/docs','POST',document,{id:docId,revision:1,protocol:true});assert.equal(retry.response.status,200,JSON.stringify(retry.data));docReceipt=retry.data.acknowledgment;assert.equal(docReceipt.snapshotRevision,2);assert.equal(retry.data.refreshRequired,true);assert.equal((await request('/api/projects/'+projectId+'/docs')).data.length,1);
 });
 await check('old creation acknowledgment does not certify the later document snapshot',async()=>{const r=await request('/api/projects','POST',project,{id:createId,revision:0,protocol:true});assert.equal(r.response.status,200);assert.deepEqual(r.data.acknowledgment,createReceipt);assert.equal(r.data.refreshRequired,true);assert.equal(r.response.headers.get('x-dmk-workspace-revision'),'2');});
 await check('actual restart fences sessions while retaining exact historical acknowledgments and document bytes',async()=>{
  await stop();await recoverWorkspaceLock(directory);await launch();assert.equal((await request('/api/projects')).response.status,401);await login();const r=await request('/api/projects/'+projectId+'/docs','POST',document,{id:docId,revision:1,protocol:true});assert.equal(r.response.status,200,JSON.stringify(r.data));assert.deepEqual(r.data.acknowledgment,docReceipt);assert.equal((await request('/api/projects/'+projectId+'/docs')).data.length,1);
 });
 await check('revoked target access blocks retrieval of the previously committed acknowledgment',async()=>{
  await stop();await recoverWorkspaceLock(directory);const authority=await WorkspaceStore.open(directory);try{await authority.execute({command:'membership',principalId:'synthetic-action-owner',projectId,role:'DENY',deniedActions:[]});const audit=await authority.execute({command:'audit'});assert.equal(audit.filter((r:any)=>r.type==='ACTION_RECEIPT_COMMITTED').length,2);}finally{await authority.close();}
  await launch();await login();assert.equal((await request('/api/projects/'+projectId+'/docs','POST',document,{id:docId,revision:1,protocol:true})).response.status,404);const create=await request('/api/projects','POST',project,{id:createId,revision:0,protocol:true});assert.equal(create.response.status,403);assert.equal('acknowledgment'in create.data,false);assert.deepEqual((await request('/api/projects')).data,[]);
 });
}catch(error){if(!failed){failed++;console.error('FAIL fixture: '+String(error).replaceAll(password,'[redacted]')+' '+output.slice(-1400));}}
finally{await stop();assert.equal(path.dirname(fs.realpathSync.native(directory)),fs.realpathSync.native(os.tmpdir()));assert.ok(path.basename(directory).startsWith('dmk-action-application-'));fs.rmSync(directory,{recursive:true,force:true});}
console.log(JSON.stringify({suite:'workspace-action-application',passed,failed,profile:'AGENT_EXECUTED_ACCEPTANCE; synthetic identities; no human observation'}));if(failed)process.exitCode=1;
