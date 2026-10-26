import assert from 'node:assert/strict';
import https from 'node:https';
import type {ServerResponse} from 'node:http';
import {checkServerIdentity} from 'node:tls';
import {mock} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createPrivateDirectory} from '../server/security/workspaceAccess/privateDirectory.ts';
import {createWorkspaceAgentClient} from './workspaceAgentClient.ts';
import {mcpAuthorityFixture} from './fixtures/mcpAuthority.ts';

let api:any,passed=0,failed=0;
try{api=await import('../server/security/workspaceAccess/mcpOAuth.ts');}catch{}
async function check(name:string,fn:()=>unknown|Promise<unknown>){
 try{await fn();passed++;console.log('PASS '+name);}
 catch(error){failed++;const e=error as any;console.error('FAIL '+name+' '+JSON.stringify({kind:e?.name,code:e?.code,...(typeof e?.actual==='number'?{actual:e.actual}:{}),...(typeof e?.expected==='number'?{expected:e.expected}:{})}));}
}

await check('OAuth resource candidate supports discovery before acquiring any DMK credential',async()=>{
 assert.equal(typeof api?.createWorkspaceMcpOAuthServer,'function');
 assert.equal(typeof api?.createMcpOAuthIntrospector,'function');
 const module=await import('../server/security/workspaceAccess/mcpDiscovery.ts');
 const reply=module.createMcpDiscoveryResponse({jsonrpc:'2.0',id:1,method:'tools/list'});
 assert.deepEqual(reply.result.tools.map((tool:any)=>tool.name),['read_task']);
 assert.equal(module.createMcpDiscoveryResponse({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'read_task'}}),undefined);
});

if(api){
 const resource='https://dmk.example.invalid/mcp';
 const directory=fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()),'dmk-oauth-candidate-'));
 const privateRoot=path.join(directory,'private');createPrivateDirectory(privateRoot);
 const keyPath=path.join(privateRoot,'tls.key'),crtPath=path.join(privateRoot,'tls.crt'),conf=path.join(privateRoot,'openssl.cnf');
 fs.writeFileSync(conf,'[req]\nprompt=no\ndistinguished_name=subject\n[subject]\nCN=Synthetic OAuth fixture\n',{mode:0o600});
 execFileSync(process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'/usr/bin/openssl',
  ['req','-new','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-sha256','-days','2','-config',conf,'-addext','subjectAltName=IP:127.0.0.1','-keyout',keyPath,'-out',crtPath],{stdio:'pipe',windowsHide:true,timeout:10000});
 fs.chmodSync(crtPath,0o600);
 const tls={key:fs.readFileSync(keyPath),cert:fs.readFileSync(crtPath),minVersion:'TLSv1.3' as const};
 const accessToken=randomBytes(24).toString('hex'),idpSecret=randomBytes(24).toString('hex');
 let issuer='',mode='normal',overrides:Record<string,unknown>={},binding:any=null,lookups=0,idpRequests=0,flipSubjectAt=0;
 let observedActor:any,syntheticAgentToken='',fakeActor:any,unexpectedAuthorityReads=0;
 let finalIntrospectionAt=0,finalIntrospectionHook:(()=>Promise<void>)|undefined;
 let shortExpiryAt=0,shortExpiry=0,waitForShortExpiryAtLookup=0,sessionObservations=0;
 let holdBindings=false,bindingReady:()=>void=()=>{};
 let pendingBindings:{resolve:(value:null)=>void;signal:AbortSignal}[]=[];
 let holdReady:()=>void=()=>{},held:ServerResponse[]=[];
 const claims=()=>({active:true,token_type:'Bearer',token_use:'access',iss:issuer,aud:resource,sub:'synthetic-user',scope:'task:read',iat:Math.floor(Date.now()/1000)-1,nbf:Math.floor(Date.now()/1000)-1,exp:Math.floor(Date.now()/1000)+120,...overrides});
 const idp=https.createServer(tls,(req,res)=>{
  if(req.url==='/api/external/session'){
   sessionObservations++;
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({actor:fakeActor,authority:'EXPERIMENTAL_LOCAL_ONLY',humanQuorum:false}));return;
  }
  if(req.url?.startsWith('/api/external/')){unexpectedAuthorityReads++;res.writeHead(403);res.end('{}');return;}
  idpRequests++;let body='';req.on('data',chunk=>{body+=chunk.toString('utf8');if(body.length>16384)req.destroy();});req.on('end',()=>{
   const expected='Basic '+Buffer.from('synthetic-resource:'+idpSecret).toString('base64');
   if(req.method!=='POST'||req.url!=='/introspect'||req.headers.authorization!==expected){res.writeHead(401);res.end();return;}
   if(mode==='hang'){return;}
   if(mode==='hold'){held.push(res);if(held.length===2)holdReady();return;}
   if(mode==='redirect'){res.writeHead(302,{Location:issuer+'/must-not-follow'});res.end();return;}
   if(mode==='error'){res.writeHead(500);res.end('PRIVATE_ERROR_MUST_NOT_ESCAPE');return;}
   if(mode==='duplicate'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"active":false,"active":true}');return;}
   if(mode==='oversized'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"padding":"'+'x'.repeat(16384)+'"}');return;}
   if(mode==='wrong-type'){res.writeHead(200,{'Content-Type':'text/html'});res.end('{}');return;}
   if(idpRequests===finalIntrospectionAt&&finalIntrospectionHook){void finalIntrospectionHook().then(()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(claims()));},()=>{res.writeHead(500);res.end('{}');});return;}
   res.writeHead(200,{'Content-Type':'application/json'});
   if(idpRequests===shortExpiryAt)shortExpiry=(Math.floor(Date.now()/1000)+2)*1000;
   res.end(JSON.stringify(new URLSearchParams(body).get('token')===accessToken?{...claims(),...(idpRequests===flipSubjectAt?{sub:'different-user'}:{}),...(idpRequests===shortExpiryAt?{exp:shortExpiry/1000}:{})}:{active:false}));
  });
 });
 await new Promise<void>(r=>idp.listen(0,'127.0.0.1',r));
 issuer=`https://127.0.0.1:${(idp.address() as import('node:net').AddressInfo).port}`;
 const verifierOptions={issuer,resource,introspectionEndpoint:issuer+'/introspect',clientId:'synthetic-resource',clientSecret:idpSecret,ca:tls.cert};
 const introspector=api.createMcpOAuthIntrospector(verifierOptions);
 const serverOptions={enabled:true,issuer,resource,tls,introspector,resolveBinding:async(identity:any,signal:AbortSignal)=>{
  lookups++;if(holdBindings)return new Promise<null>(resolve=>{pendingBindings.push({resolve,signal});if(pendingBindings.length===2)bindingReady();});
  if(lookups===waitForShortExpiryAtLookup)await new Promise<void>(resolve=>setTimeout(resolve,Math.max(1,shortExpiry-Date.now()+1)));
  return identity.subject==='synthetic-user'?binding:null;
 }};
 let server:any,native:Awaited<ReturnType<typeof mcpAuthorityFixture>>|undefined;
 const callMessage=(taskId='TASK-ALLOWED',projectId='PRJ-MCP-SYNTHETIC')=>({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'read_task',arguments:{projectId,taskId}}});
 function request(message?:unknown,options:{method?:string;url?:string;headers?:Record<string,string|string[]>;raw?:Buffer;signal?:AbortSignal}={}){
  return new Promise<{status:number;body:any;headers:import('node:http').IncomingHttpHeaders}>((resolve,reject)=>{
   const bytes=options.raw??(message===undefined?undefined:Buffer.from(JSON.stringify(message)));
   // Keep strict certificate validation on the real loopback TLS target even
   // when deliberately testing a foreign HTTP Host header above that channel.
   const req=https.request(`https://127.0.0.1:${server.port}${options.url??'/mcp'}`,{agent:false,ca:tls.cert,minVersion:'TLSv1.3',signal:options.signal,checkServerIdentity:(_host,certificate)=>checkServerIdentity('127.0.0.1',certificate),method:options.method??(bytes?'POST':'GET'),headers:{...(bytes?{'Content-Type':'application/json','Content-Length':String(bytes.length)}:{}),...options.headers}},res=>{
    const parts:Buffer[]=[];res.on('data',chunk=>parts.push(Buffer.from(chunk)));res.once('end',()=>{try{const text=Buffer.concat(parts).toString('utf8');resolve({status:res.statusCode!,headers:res.headers,body:text?JSON.parse(text):null});}catch{reject(Error('SYNTHETIC_RESPONSE_INVALID'));}});res.once('error',reject);
   });req.setTimeout(10000,()=>req.destroy(Error('SYNTHETIC_REQUEST_TIMEOUT')));req.once('error',reject);req.end(bytes);
  });
 }
 const auth=()=>({Authorization:'Bearer '+accessToken});
 try{
  await check('resource listener is disabled by default and cannot bind a non-loopback host',async()=>{
   await assert.rejects(api.createWorkspaceMcpOAuthServer({...serverOptions,enabled:undefined}));
   await assert.rejects(api.createWorkspaceMcpOAuthServer({...serverOptions,host:'0.0.0.0'}));
  });
  await check('introspection authenticates the actual TLS IdP and validates a user token',async()=>{
   const identity=await introspector.verify(accessToken);assert.equal(identity.subject,'synthetic-user');assert.equal(identity.issuer,issuer);assert.equal(identity.resource,resource);
   assert.throws(()=>api.createMcpOAuthIntrospector({...verifierOptions,introspectionEndpoint:'http://127.0.0.1/introspect'}));
   assert.throws(()=>api.createMcpOAuthIntrospector({...verifierOptions,introspectionEndpoint:'https://foreign.example.invalid/introspect'}));
  });
  await check('inactive, wrong issuer/audience/scope/subject and invalid time claims all fail closed',async()=>{
   for(const value of [{active:false},{active:'true'},{iss:'https://foreign.example.invalid'},{aud:'https://other.example.invalid/mcp'},{scope:'task:write'},{sub:''},{exp:Math.floor(Date.now()/1000)},{nbf:Math.floor(Date.now()/1000)+120},{iat:Math.floor(Date.now()/1000)+120},{exp:'9999999999'}]){
    overrides=value;await assert.rejects(introspector.verify(accessToken));
   }overrides={};await assert.rejects(introspector.verify('never-issued'));
  });
  await check('refresh/id/DPoP, missing token-kind evidence and sender-constrained tokens cannot become bearer access',async()=>{
   try{for(const value of [{token_type:'DPoP'},{token_type:'refresh_token'},{token_type:undefined},{token_type:42},{token_use:'refresh'},{token_use:'id'},{token_use:undefined},{cnf:{jkt:'synthetic-proof'}},{cnf:null},{cnf:{}}]){overrides=value;await assert.rejects(introspector.verify(accessToken));}}
   finally{overrides={};}
  });
  await check('redirects, upstream errors, duplicate keys, oversized bodies and non-JSON introspection are rejected',async()=>{
   for(const value of ['redirect','error','duplicate','oversized','wrong-type']){mode=value;const before=idpRequests;await assert.rejects(introspector.verify(accessToken));assert.equal(idpRequests,before+1);}mode='normal';
  });
  await check('IdP acquisition cancellation aborts without a fallback or cached success',async()=>{
   mode='hang';const controller=new AbortController();const pending=introspector.verify(accessToken,controller.signal);controller.abort();await assert.rejects(pending);mode='normal';
  });
  await check('IdP certificate and hostname verification remain strict',async()=>{
   const wrongCa=api.createMcpOAuthIntrospector({...verifierOptions,ca:Buffer.from('not-a-trusted-certificate')});
   const wrongKey=path.join(privateRoot,'wrong-name.key'),wrongCrt=path.join(privateRoot,'wrong-name.crt');
   execFileSync(process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'/usr/bin/openssl',
    ['req','-new','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-sha256','-days','2','-config',conf,'-addext','subjectAltName=IP:127.0.0.2','-keyout',wrongKey,'-out',wrongCrt],{stdio:'pipe',windowsHide:true,timeout:10000});fs.chmodSync(wrongCrt,0o600);
   let wrongIssuer='',httpReached=0,tcpReached=0;
   const wrongServer=https.createServer({key:fs.readFileSync(wrongKey),cert:fs.readFileSync(wrongCrt),minVersion:'TLSv1.3'},(_req,res)=>{httpReached++;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({...claims(),iss:wrongIssuer}));});
   wrongServer.on('connection',()=>tcpReached++);await new Promise<void>(r=>wrongServer.listen(0,'127.0.0.1',r));wrongIssuer=`https://127.0.0.1:${(wrongServer.address() as import('node:net').AddressInfo).port}`;
   const wrongName=api.createMcpOAuthIntrospector({...verifierOptions,issuer:wrongIssuer,introspectionEndpoint:wrongIssuer+'/introspect',ca:fs.readFileSync(wrongCrt)});
   try{await assert.rejects(wrongCa.verify(accessToken));await assert.rejects(wrongName.verify(accessToken));assert.equal(tcpReached,1);assert.equal(httpReached,0);}
   finally{wrongCa.close();wrongName.close();wrongServer.closeAllConnections();await new Promise<void>(r=>wrongServer.close(()=>r()));}
  });
  server=await api.createWorkspaceMcpOAuthServer(serverOptions);
  await check('actual TLS discovery and protected-resource metadata work before any authority or binding exists',async()=>{
   const before=idpRequests,lookupBefore=lookups;
   assert.equal(fs.existsSync(path.join(privateRoot,'not-issued.token')),false);
   const metadata=await request(undefined,{url:'/.well-known/oauth-protected-resource/mcp'});assert.equal(metadata.status,200);assert.equal(metadata.body.resource,resource);assert.deepEqual(metadata.body.authorization_servers,[issuer]);
   const initialized=await request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}});assert.equal(initialized.status,200);assert.equal(initialized.body.result.protocolVersion,'2025-06-18');
   const listed=await request({jsonrpc:'2.0',id:3,method:'tools/list'});assert.equal(listed.status,200);assert.deepEqual(listed.body.result.tools.map((t:any)=>t.name),['read_task']);assert.deepEqual(listed.body.result.tools[0].securitySchemes,[{type:'oauth2',scopes:['task:read']}]);
   assert.equal(idpRequests,before);assert.equal(lookups,lookupBefore);
  });
  await check('missing/invalid OAuth receives a metadata challenge and no private acquisition',async()=>{
   const before=lookups;const missing=await request(callMessage());assert.equal(missing.status,401);assert.match(String(missing.headers['www-authenticate']),/oauth-protected-resource\/mcp/);
   const invalid=await request(callMessage(),{headers:{Authorization:'Bearer never-issued'}});assert.equal(invalid.status,401);assert.equal(lookups,before);
  });
  await check('a valid OAuth identity alone grants no DMK task access',async()=>{
   const result=await request(callMessage(),{headers:auth()});assert.equal(result.status,403);assert.equal(JSON.stringify(result.body).includes('Synthetic task'),false);
  });
  await check('transport rejects foreign Host/Origin, cookies, duplicate Authorization, query, media type and oversized JSON',async()=>{
   let index=0;
   for(const options of [{headers:{Host:'foreign.invalid'}},{headers:{Origin:'https://foreign.invalid'}},{headers:{Cookie:'synthetic=true'}},{headers:{Authorization:['Bearer '+accessToken,'Bearer '+accessToken]}},{url:'/mcp?token=forbidden'},{headers:{'Content-Type':'text/plain'}}]){
    const outcome=await request(callMessage(),options);console.log('DIAGNOSTIC transport case '+index+++' status '+outcome.status);assert.ok(outcome.status>=400);
   }
   assert.equal((await request(undefined,{raw:Buffer.alloc(16385,32)})).status,413);
   assert.equal((await request(undefined,{raw:Buffer.from('{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/list"}')})).status,400);
  });
  await check('two held OAuth acquisitions consume the aggregate slots and the third is rejected',async()=>{
   mode='hold';const barrier=new Promise<void>(r=>holdReady=r);
   const first=request(callMessage(),{headers:auth()}),second=request(callMessage(),{headers:auth()});await barrier;
   try{assert.equal((await request(callMessage(),{headers:auth()})).status,503);}
   finally{mode='normal';for(const res of held){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(claims()));}held=[];}
   assert.equal((await first).status,403);assert.equal((await second).status,403);
  });
  await check('disconnect and operation deadline retain slots until uncooperative binding acquisition settles',async()=>{
   holdBindings=true;const barrier=new Promise<void>(r=>bindingReady=r),abort=new AbortController();
   // A controlled timer tick fires the real server's unchanged deadline; no
   // wall-clock sleep, increased timeout, forced ready state or skipped check.
   mock.timers.enable({apis:['setTimeout']});
   const first=request(callMessage(),{headers:auth(),signal:abort.signal});const firstRejected=assert.rejects(first);
   const second=request(callMessage(),{headers:auth()});
   try{
    await barrier;abort.abort();await firstRejected;
    assert.equal((await request(callMessage(),{headers:auth()})).status,503);
    mock.timers.tick(30000);assert.equal((await second).status,504);assert.ok(pendingBindings.every(p=>p.signal.aborted));
    assert.equal((await request(callMessage(),{headers:auth()})).status,503);
   }finally{mock.timers.reset();holdBindings=false;for(const pending of pendingBindings)pending.resolve(null);pendingBindings=[];}
   assert.equal((await request({jsonrpc:'2.0',id:9,method:'ping'})).status,200);
  });
  await check('late HUMAN-sponsored synthetic schema-3 grant reads the exact projection and provenance',async()=>{
   native=await mcpAuthorityFixture();
   const client=createWorkspaceAgentClient({origin:native.origin,ca:native.ca,token:native.token});let actor:any;try{actor=(await client.session()).actor;observedActor=actor;syntheticAgentToken=native.token;}finally{client.close();}
   binding={configPath:native.configPath,projectId:native.projectId,taskId:native.taskId,principalId:actor.principalId,clientId:actor.clientId,sessionId:actor.sessionId,sponsorPrincipalId:actor.sponsorPrincipalId,grantId:actor.grantId,grantRevision:actor.grantRevision};
   const result=await request(callMessage(),{headers:auth()});assert.equal(result.status,200);assert.equal(result.body.result.isError,false);
   const envelope=JSON.parse(result.body.result.content[0].text);assert.deepEqual(Object.keys(envelope.task).sort(),['description','id','priority','status','title','updatedAt']);assert.equal(envelope.task.id,'TASK-ALLOWED');assert.equal(envelope.provenance,'AUTHENTICATED_AGENT_READ');assert.equal(envelope.humanApproval,false);assert.equal(envelope.authorityGranted,false);
  });
  await check('other task/project and canonical self-project are denied without returning content',async()=>{
   for(const message of [callMessage('TASK-DENIED'),callMessage('TASK-ALLOWED','PRJ-OTHER'),callMessage('TASK-ALLOWED','PRJ-DOCMONSTAKRAKIN')]){
    const result=await request(message,{headers:auth()});assert.equal(result.status,403);assert.equal(JSON.stringify(result.body).includes('Synthetic task'),false);
   }
  });
  await check('revocation of the previously working user token is observed on the next call',async()=>{
   const before=lookups;overrides={active:false};const denied=await request(callMessage(),{headers:auth()});assert.equal(denied.status,401);assert.equal(lookups,before);overrides={};
  });
  await check('a different user returned by the final introspection cannot receive the first user task',async()=>{
   flipSubjectAt=idpRequests+2;
   try{const result=await request(callMessage(),{headers:auth()});assert.equal(result.status,401);assert.equal(JSON.stringify(result.body).includes('Synthetic task'),false);}
   finally{flipSubjectAt=0;}
  });
  await check('broader, longer, changed and non-TASKS upstream grants are denied before skill or action reads',async()=>{
   assert.ok(binding);const retained=binding,configPath=path.join(privateRoot,'denial-config.json'),tokenPath=path.join(privateRoot,'denial-token');
   fs.writeFileSync(tokenPath,syntheticAgentToken,{mode:0o600});fs.writeFileSync(configPath,JSON.stringify({origin:issuer,caPath:crtPath,tokenPath}),{mode:0o600});
   try{
    binding={...retained,configPath};
    for(const change of [{scope:{kind:'PROJECT'}},{scope:{kind:'TASKS',taskIds:['TASK-ALLOWED','TASK-DENIED']}},{actions:['task:read','task:write']},{expiresAt:Date.now()+300000},{grantRevision:retained.grantRevision+1},{sponsorPrincipalId:'different-sponsor'}]){
     fakeActor={...observedActor,...change};const before=unexpectedAuthorityReads,observedBefore=sessionObservations;
     const result=await request(callMessage(),{headers:auth()});assert.equal(result.status,403);assert.equal(unexpectedAuthorityReads,before);assert.equal(sessionObservations,observedBefore+1);
    }
   }finally{binding=retained;fakeActor=undefined;}
  });
  await check('changing the bound grant or removing private credentials cannot inherit OAuth authority',async()=>{
   assert.ok(binding);const retained=binding;
   try{binding={...retained,configPath:path.join(privateRoot,'missing.json')};assert.equal((await request(callMessage(),{headers:auth()})).status,403);
    binding={...retained,grantId:'00000000-0000-4000-8000-000000000000'};assert.equal((await request(callMessage(),{headers:auth()})).status,403);
   }finally{binding=retained;}
  });
  await check('a shortened final OAuth expiry is enforced after later binding and session work',async()=>{
   shortExpiryAt=idpRequests+2;waitForShortExpiryAtLookup=lookups+2;
   // Wait for the exact authenticated token expiry, not an arbitrary startup
   // sleep. DMK remains valid; only the final OAuth lifetime is exhausted.
   try{const result=await request(callMessage(),{headers:auth()});assert.equal(idpRequests,shortExpiryAt);assert.ok(shortExpiry>0&&Date.now()>=shortExpiry);assert.equal(result.status,403);assert.equal(JSON.stringify(result.body).includes('Synthetic task'),false);}
   finally{shortExpiryAt=0;shortExpiry=0;waitForShortExpiryAtLookup=0;}
  });
  await check('genuine DMK revocation during final IdP acquisition denies the pending read and same credential afterward',async()=>{
   assert.ok(native);let acknowledged=false;finalIntrospectionAt=idpRequests+2;finalIntrospectionHook=async()=>{await native!.revoke();acknowledged=true;};
   try{const pending=await request(callMessage(),{headers:auth()});assert.ok(acknowledged);assert.equal(pending.status,403);assert.equal(JSON.stringify(pending.body).includes('Synthetic task'),false);}
   finally{finalIntrospectionAt=0;finalIntrospectionHook=undefined;}
   const denied=await request(callMessage(),{headers:auth()});assert.equal(denied.status,403);assert.equal(JSON.stringify(denied.body).includes('Synthetic task'),false);
  });
  await check('DMK grant expiry during final IdP acquisition denies the pending read despite a still-valid user token',async()=>{
   // Separate disposable authority: its clock high-water will intentionally
   // advance. Never roll a persisted authority clock backward or reuse it.
   await native?.close();native=undefined;native=await mcpAuthorityFixture();
   const client=createWorkspaceAgentClient({origin:native.origin,ca:native.ca,token:native.token});let actor:any;
   try{actor=(await client.session()).actor;}finally{client.close();}
   binding={configPath:native.configPath,projectId:native.projectId,taskId:native.taskId,principalId:actor.principalId,clientId:actor.clientId,sessionId:actor.sessionId,sponsorPrincipalId:actor.sponsorPrincipalId,grantId:actor.grantId,grantRevision:actor.grantRevision};
   const originalNow=Date.now;overrides={exp:Math.floor((actor.expiresAt+360000)/1000)};
   let advanced=false;finalIntrospectionAt=idpRequests+2;finalIntrospectionHook=async()=>{Date.now=()=>actor.expiresAt+1;advanced=true;};
   try{const result=await request(callMessage(),{headers:auth()});assert.ok(advanced);assert.equal(result.status,403);assert.equal(JSON.stringify(result.body).includes('Synthetic task'),false);}
   finally{Date.now=originalNow;overrides={};finalIntrospectionAt=0;finalIntrospectionHook=undefined;}
  });
 }finally{
  await server?.close();introspector.close();idp.closeAllConnections();await new Promise<void>(r=>idp.close(()=>r()));await native?.close();
  if(path.dirname(fs.realpathSync.native(directory))!==fs.realpathSync.native(os.tmpdir())||fs.lstatSync(directory).isSymbolicLink())throw Error('SYNTHETIC_CLEANUP_PATH_CHANGED');
  fs.rmSync(directory,{recursive:true,force:true});
 }
}

console.log(JSON.stringify({suite:'workspace-mcp-oauth',passed,failed,qualification:'AGENT_EXECUTED_SYNTHETIC; no model or human acceptance'}));
if(failed)process.exitCode=1;
