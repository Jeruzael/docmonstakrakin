/** Actual server.ts registrations, disposable state and synthetic reviewer identities. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawn, execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {scryptSync, createHash} from 'node:crypto';
import {ProjectStore} from '../server/projectStore.ts';

const root=process.cwd();
const fixturePassword='disposable-reviewer-only';
const salt='0123456789abcdef0123456789abcdef';
const roster=JSON.stringify({'Fixture Human':{id:'human-a',kind:'HUMAN',roles:['Security Officer'],credentialVerifier:`${salt}:${scryptSync(fixturePassword,salt,32).toString('hex')}`}});
let passed=0,failed=0;
async function check(name:string,fn:()=>void|Promise<void>){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+(e instanceof Error?e.message:String(e)));}}
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=net.createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const port=(s.address() as net.AddressInfo).port;await new Promise<void>(r=>s.close(()=>r()));return port;}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
function files(dir:string):Record<string,string>{return Object.fromEntries(fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.name!=='fixture-preload.mjs').flatMap(e=>{const file=path.join(dir,e.name);return e.isDirectory()?Object.entries(files(file)).map(([p,h])=>[e.name+'/'+p,h]):[[e.name,hash(fs.readFileSync(file))]];}));}

async function fixture(overrides:NodeJS.ProcessEnv={},seed=true){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-perimeter-'));
  const port=await freePort();
  if(seed){
    const store=new ProjectStore();
    store.projects.push({...structuredClone(store.projects[0]),id:'PRJ-OTHER',name:'Other synthetic project'});
    fs.mkdirSync(path.join(dir,'.local'));
    fs.writeFileSync(path.join(dir,'.local/project-state.json'),JSON.stringify({schemaVersion:1,state:store}));
    fs.mkdirSync(path.join(dir,'docs'));
    fs.writeFileSync(path.join(dir,'docs/sentinel.md'),'unchanged fixture document');
    fs.writeFileSync(path.join(dir,'sentinel.txt'),'unchanged fixture repository');
    execFileSync('git',['init','--quiet'],{cwd:dir,windowsHide:true});
    fs.mkdirSync(path.join(dir,'.secrets'));
    fs.writeFileSync(path.join(dir,'.secrets/sentinel'),'unchanged synthetic vault sentinel');
  }
  const secretModule=pathToFileURL(path.join(root,'server/secrets/secretStoreFactory.ts')).href;
  // Test-only injection selects the existing fallback driver before actual app startup.
  // This disposable historical-contract fixture explicitly selects demo mode.
  const preload=`import http from 'node:http';\nimport {getSecretStore} from ${JSON.stringify(secretModule)};\ngetSecretStore({forceFallback:true,masterPassphrase:'disposable-perimeter-master'});\nconst listen=http.Server.prototype.listen;http.Server.prototype.listen=function(...args){this.once('listening',()=>console.log('FIXTURE_BOUND '+JSON.stringify(this.address())));return listen.apply(this,args);};\n`;
  fs.writeFileSync(path.join(dir,'fixture-preload.mjs'),preload);
  const before=files(dir);
  const env:NodeJS.ProcessEnv={NODE_ENV:'production',DMK_WORKSPACE_ACCESS:'LOCAL_DEVELOPMENT',PORT:String(port),GEMINI_API_KEY:'',DMK_HUMAN_REVIEWERS:roster,DOCMONSTAKRAKIN_MASTER_KEY:'disposable-perimeter-master'};
  for(const k of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
  Object.assign(env,overrides);
  let output='';
  const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,'--import',pathToFileURL(path.join(dir,'fixture-preload.mjs')).href,path.join(root,'server.ts')],{cwd:dir,windowsHide:true,env,stdio:'pipe'});
  child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('error',e=>output+=e.message);
  const deadline=Date.now()+30000;
  while(child.exitCode===null&&!output.includes('FIXTURE_BOUND ')&&Date.now()<deadline)await delay(30);
  const binding=()=>{const match=output.match(/FIXTURE_BOUND (.+)/);return match?JSON.parse(match[1]):null;};
  const request=(url:string,method='GET',headers:Record<string,string>={},body?:unknown)=>new Promise<{status:number;body:any;text:string;cookie:string}>((resolve,reject)=>{
    const data=body===undefined?undefined:JSON.stringify(body);
    const req=http.request({host:'127.0.0.1',port:binding()?.port??port,path:url,method,headers:{Host:`127.0.0.1:${binding()?.port??port}`,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}),...headers}},res=>{let text='';res.on('data',d=>text+=d);res.on('end',()=>{let body:any;try{body=JSON.parse(text);}catch{body=text;}resolve({status:res.statusCode!,body,text,cookie:(res.headers['set-cookie']?.[0]??'').split(';')[0]});});});req.on('error',reject);req.end(data);
  });
  const close=async()=>{if(child.exitCode===null){const exited=new Promise<void>(r=>child.once('exit',()=>r()));child.kill();await exited;}
    assert.equal(path.dirname(dir),os.tmpdir());assert(path.basename(dir).startsWith('dmk-perimeter-'));fs.rmSync(dir,{recursive:true,force:true});};
  return {dir,child,port,before,request,binding,output:()=>output,close};
}

const app=await fixture();
try{
  assert(app.binding(),'Actual application failed to start in disposable fixture');
  await check('Actual application binds only IPv4 loopback',()=>assert.equal(app.binding().address,'127.0.0.1'));
  await check('Every actual API registration has exactly one explicit route policy',async()=>{
    const {API_ROUTE_POLICIES}=await import('../server/security/apiRoutePolicy.ts');
    const registrations=new Map<string,string[]>();
    for(const file of ['server.ts','server/security/workspaceAccess/http.ts','server/security/workspaceAccess/agentHttp.ts','server/proposals/identity.ts','server/proposals/signoff.ts','server/proposals/review.ts','server/docs/controlledDocsRouter.ts','server/docs/projectManagedDocuments.ts','server/verification/routes.ts','server/readiness/routes.ts','server/release/githubCiRoutes.ts']){
      for(const m of fs.readFileSync(path.join(root,file),'utf8').matchAll(/(?:app|router)\.(get|post|patch|delete|put)\(\s*['"]([^'"]+)['"]/g)){
        const p=(['server/docs/controlledDocsRouter.ts','server/docs/projectManagedDocuments.ts'].includes(file)?'/api/projects':'')+m[2];if(p.startsWith('/api/')){const key=m[1].toUpperCase()+' '+p;registrations.set(key,[...(registrations.get(key)||[]),file]);}
      }
    }
    const sharedDocumentDispatch=new Set(['GET /api/projects/:id/docs','GET /api/projects/:id/docs/:documentId','POST /api/projects/:id/docs/:documentId/diff','POST /api/projects/:id/docs/:documentId/validate','POST /api/projects/:id/docs/:documentId/save']);
    const conditionalSessionDispatch=new Set(['GET /api/governance/session','POST /api/governance/session','DELETE /api/governance/session']);
    for(const [key,files] of registrations){if(files.length>1){if(conditionalSessionDispatch.has(key))assert.deepEqual(files.sort(),['server/proposals/identity.ts','server/security/workspaceAccess/http.ts'].sort());else {assert(sharedDocumentDispatch.has(key),`Unexpected duplicate route ${key}`);assert.deepEqual(files.sort(),['server/docs/controlledDocsRouter.ts','server/docs/projectManagedDocuments.ts'].sort());}}}
    const registered=[...registrations.keys()];
    assert.equal(registered.length,87);assert.deepEqual(API_ROUTE_POLICIES.map(p=>p.method+' '+p.path).sort(),registered.sort());
    assert.equal(new Set(API_ROUTE_POLICIES.map(route=>route.method+' '+route.path)).size,registered.length);
    const {resolveLocalNetworkConfig}=await import('../server/security/localPerimeter.ts');
    assert.deepEqual(resolveLocalNetworkConfig({}),{host:'127.0.0.1',port:3000});
  });
  await check('Same-origin health and ordinary local development remain functional',async()=>{
    assert.equal((await app.request('/api/health','GET',{Origin:`http://127.0.0.1:${app.port}`})).status,200);
    assert.equal((await app.request('/api/projects')).status,200);
  });
  await check('New evidence, document-create and readiness endpoints require configured human authority',async()=>{
    for(const [method,path] of [['GET','/verification-sessions'],['POST','/verification-sessions'],['GET','/verification-sessions/unknown'],['PATCH','/verification-sessions/unknown'],['POST','/verification-sessions/unknown/submit'],['POST','/verification-sessions/unknown/decisions'],['POST','/docs'],['GET','/readiness'],['POST','/readiness']])assert.equal((await app.request('/api/projects/PRJ-ATLAS-01'+path,method)).status,401,method+' '+path);
  });
  for(const [label,headers] of [
    ['DNS rebinding Host',{Host:`attacker.example:${app.port}`}],
    ['Foreign Origin',{Origin:'https://attacker.example'}],
    ['Null Origin',{Origin:'null'}],
    ['Same-site different-port Origin',{Origin:`http://127.0.0.1:${app.port+1}`}],
    ['Cross-site browser navigation',{'Sec-Fetch-Site':'cross-site'}],
    ['Forwarded authority',{Forwarded:'host=localhost;proto=http'}],
    ['Spoofed forwarded host',{'X-Forwarded-Host':`127.0.0.1:${app.port}`}],
    ['Wrong local Host port',{Host:`127.0.0.1:${app.port+1}`}],
  ] as [string,Record<string,string>][]){await check(label+' rejected on actual application',async()=>assert.equal((await app.request('/api/projects','GET',headers)).status,403));}
  await check('Static/development fallback receives the same browser boundary',async()=>assert.equal((await app.request('/','GET',{Host:'attacker.example'})).status,403));
  for(const [method,url,body] of [
    ['GET','/api/secrets/metadata',undefined],['GET','/api/secrets/rotations',undefined],
    ['POST','/api/secrets',{key:'SYNTHETIC',value:'synthetic-value'}],['DELETE','/api/secrets/SYNTHETIC',{}],
    ['POST','/api/secrets/migrate',{envFilePath:'sentinel.txt',actor:'Security Officer'}],['POST','/api/secrets/rotate',{actor:'Owner'}],
    ['GET','/api/repo/status',undefined],['GET','/api/repo/diff?file=sentinel.txt',undefined],
    ['POST','/api/repo/stage',{all:true}],['POST','/api/repo/unstage',{all:true}],['POST','/api/repo/commit',{message:'spoof',author:'Owner'}],['POST','/api/repo/branch',{branchName:'spoof',create:true}],
    ['POST','/api/projects/PRJ-ATLAS-01/agents/AGT-SEC-01/run',{}],
    ['POST','/API/PROJECTS/PRJ-OTHER/AGENTS/anything/RUN/',{projectId:'PRJ-ATLAS-01',role:'Security Officer'}],
    ['HEAD','/API/SECRETS/METADATA/',undefined],['OPTIONS','/api/repo/commit',undefined],
  ] as [string,string,unknown][]){await check(method+' '+url+' denied before privileged handlers',async()=>assert.equal((await app.request(url,method,{'X-Role':'Owner','X-Actor':'Security Officer'},body)).status,403));}
  await check('Unknown API routes fail closed before SPA fallback',async()=>assert.equal((await app.request('/api/not-registered')).status,404));
  for(const url of ['/api/projects/PRJ%2fOTHER/agents/A/run','/api/projects/PRJ%252fOTHER/agents/A/run','/api/projects/%ZZ/agents/A/run'])await check('Ambiguous path rejected: '+url,async()=>assert.equal((await app.request(url,'POST',{},{})).status,400));
  await check('Privileged denials preserve snapshot, documents, vault and Git bytes',()=>assert.deepEqual(files(app.dir),app.before));
  await check('Denial precedes JSON parsing and stale-state persistence checks',async()=>{
    const snapshot=path.join(app.dir,'.local/project-state.json');const original=fs.readFileSync(snapshot);
    try{
      fs.appendFileSync(snapshot,' ');
      const status=await new Promise<number>((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:app.port,path:'/api/projects/PRJ-OTHER/agents/A/run',method:'POST',headers:{Host:`127.0.0.1:${app.port}`,'Content-Type':'application/json','Content-Length':1}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});req.on('error',reject);req.end('{');});
      assert.equal(status,403);assert.deepEqual(fs.readFileSync(snapshot),Buffer.concat([original,Buffer.from(' ')]));
    }finally{fs.writeFileSync(snapshot,original);}
  });
  await check('Duplicate Host and Origin headers are rejected',async()=>{
    for(const duplicate of [`Host: attacker.example\r\n`,`Origin: http://127.0.0.1:${app.port}\r\nOrigin: https://attacker.example\r\n`]){
      const response=await new Promise<string>((resolve,reject)=>{const socket=net.connect(app.port,'127.0.0.1',()=>socket.end(`GET /api/projects HTTP/1.1\r\nHost: 127.0.0.1:${app.port}\r\n${duplicate}Connection: close\r\n\r\n`));let data='';socket.on('data',d=>data+=d);socket.on('end',()=>resolve(data));socket.on('error',reject);});
      assert.match(response,/^HTTP\/1\.1 (400|403) /);
    }
  });
  await check('Forged reviewer claims cannot authorize governance',async()=>assert.equal((await app.request('/api/projects/PRJ-ATLAS-01/approvals','POST',{}, {reviewerName:'Fixture Human',role:'Security Officer'})).status,401));
  await check('Specialized reviewer denial precedes stale-state persistence checks',async()=>{
    const snapshot=path.join(app.dir,'.local/project-state.json');const original=fs.readFileSync(snapshot);
    try{fs.appendFileSync(snapshot,' ');assert.equal((await app.request('/api/projects/PRJ-ATLAS-01/approvals','POST',{}, {role:'Security Officer'})).status,401);assert.equal((await app.request('/API/PROJECTS/PRJ-ATLAS-01/WORK-ITEMS/','POST',{}, {itemId:'any',status:'VERIFIED',role:'Security Officer'})).status,401);assert.deepEqual(fs.readFileSync(snapshot),Buffer.concat([original,Buffer.from(' ')]));}finally{fs.writeFileSync(snapshot,original);}
  });
  let cookie='';
  await check('Legitimate specialized reviewer session remains usable',async()=>{
    const login=await app.request('/api/governance/session','POST',{}, {username:'Fixture Human',password:fixturePassword});assert.equal(login.status,200);cookie=login.cookie;assert(cookie);
    assert.equal((await app.request('/api/projects/PRJ-ATLAS-01/approvals','GET',{Cookie:cookie})).status,200);
  });
  await check('Reviewer cookie is not general administrator or cross-project authority',async()=>{
    const before=files(app.dir);
    for(const url of ['/api/secrets/metadata','/api/repo/status'])assert.equal((await app.request(url,'GET',{Cookie:cookie})).status,403);
    assert.equal((await app.request('/api/projects/PRJ-OTHER/agents/A/run','POST',{Cookie:cookie},{projectId:'PRJ-ATLAS-01'})).status,403);
    assert.deepEqual(files(app.dir),before);
  });
  await check('Cross-origin requests to another project deny before state changes',async()=>{
    const before=files(app.dir);
    assert.equal((await app.request('/api/projects/PRJ-OTHER/work-items','POST',{Origin:'https://attacker.example'},{itemId:'any',status:'IN_PROGRESS'})).status,403);
    assert.deepEqual(files(app.dir),before);
  });
  await check('Partial scope explicitly characterizes missing project membership enforcement',async()=>assert.equal((await app.request('/api/projects/PRJ-OTHER')).status,200));
  await check('Agent records expose demonstration provenance, never execution proof',async()=>{
    const res=await app.request('/api/projects/PRJ-ATLAS-01/agents');assert.equal(res.status,200);assert.equal(res.body.executionMode,'DEMONSTRATION_ONLY');assert.equal(res.body.liveExecutionAvailable,false);
  });
  await check('HEAD/case/trailing-slash package export retains atomic audit persistence',async()=>{
    const snapshot=path.join(app.dir,'.local/project-state.json');
    const before=JSON.parse(fs.readFileSync(snapshot,'utf8')).state.auditLogs['PRJ-ATLAS-01'].length;
    assert.equal((await app.request('/API/PROJECTS/PRJ-ATLAS-01/PACKAGE/EXPORT/','HEAD')).status,200);
    assert.equal(JSON.parse(fs.readFileSync(snapshot,'utf8')).state.auditLogs['PRJ-ATLAS-01'].length,before+1);
  });
}finally{await app.close();}

for(const env of [{HOST:'0.0.0.0'},{HOST:'::'},{HOST:'192.0.2.1'},{HOST:''},{PORT:'0'},{PORT:''},{PORT:'12junk'},{PORT:'65536'}]){
  await check('Invalid startup '+Object.keys(env)[0]+' rejected before credential side effects ('+Object.values(env)[0]+')',async()=>{
    const bad=await fixture({...env,GEMINI_API_KEY:'synthetic-ambient-credential'},false);
    try{assert.equal(bad.binding(),null);assert.notEqual(bad.child.exitCode,0);assert.notEqual(bad.child.exitCode,null);assert.match(bad.output(),/INVALID_LOCAL_(HOST|PORT)/);assert(!fs.existsSync(path.join(bad.dir,'.secrets')));assert(!fs.existsSync(path.join(bad.dir,'.local')));}finally{await bad.close();}
  });
}
console.log(`Security perimeter actual-server checks: ${passed} passed, ${failed} failed.`);
if(failed)process.exitCode=1;
