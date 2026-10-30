import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import https from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {pathToFileURL} from 'node:url';
import {createPrivateDirectory} from '../server/security/workspaceAccess/privateDirectory.ts';
import {MCP_LIMITS} from '../server/security/workspaceAccess/mcpTransport.ts';

let api:any,launcher:any,passed=0,failed=0;
try{api=await import('../server/security/workspaceAccess/mcpOAuthConfig.ts');}catch{}
try{launcher=await import('./workspaceMcpOAuth.ts');}catch{}
async function check(name:string,fn:()=>unknown|Promise<unknown>){
 try{await fn();passed++;console.log('PASS '+name);}
 catch(error){failed++;console.error('FAIL '+name+' '+JSON.stringify({kind:(error as any)?.name,code:(error as any)?.code}));}
}
const parent=fs.realpathSync.native(os.tmpdir()),directory=fs.mkdtempSync(path.join(parent,'dmk-oauth-launcher-'));
const privateRoot=path.join(directory,'private');createPrivateDirectory(privateRoot);
const keyPath=path.join(privateRoot,'tls.key'),certPath=path.join(privateRoot,'tls.crt'),conf=path.join(privateRoot,'openssl.cnf');
const configPath=path.join(privateRoot,'launcher.json'),secretPath=path.join(privateRoot,'introspection.secret');
const secret=randomBytes(24).toString('hex');
fs.writeFileSync(conf,'[req]\nprompt=no\ndistinguished_name=subject\n[subject]\nCN=Disposable launcher fixture\n',{mode:0o600});
execFileSync(process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'/usr/bin/openssl',
 ['req','-new','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-sha256','-days','2','-config',conf,'-addext','subjectAltName=IP:127.0.0.1','-keyout',keyPath,'-out',certPath],{stdio:'pipe',windowsHide:true,timeout:10000});
fs.chmodSync(certPath,0o600);
fs.writeFileSync(secretPath,secret,{mode:0o600});
const resource='https://dmk-launcher.example.invalid/tunnels/discovery';
const profile=()=>({schema:'DMK_MCP_OAUTH_LAUNCHER/1',enabled:true,mode:'DISCOVERY_ONLY',port:0,
 issuer:'https://127.0.0.1/',resource,resourceMetadataUrl:'https://dmk-launcher.example.invalid/.well-known/oauth-protected-resource/tunnels/discovery',
 tlsKeyPath:keyPath,tlsCertPath:certPath,introspection:{endpoint:'https://127.0.0.1/introspect',clientId:'synthetic-launcher',clientSecretPath:secretPath,caPath:certPath}});
const write=(value:unknown)=>fs.writeFileSync(configPath,JSON.stringify(value),{mode:0o600});
const invalid=()=>assert.throws(()=>api.loadPrivateMcpOAuthConfig(configPath),{message:'MCP_OAUTH_CONFIG_INVALID'});
try{
 await check('CLI is disabled by default and requires a separate discovery-only opt-in',()=>{
  assert.deepEqual(api.parseMcpOAuthLauncherArgs([]),{enabled:false});
  assert.deepEqual(api.parseMcpOAuthLauncherArgs(['--config',configPath]),{enabled:false,configPath});
  assert.deepEqual(api.parseMcpOAuthLauncherArgs(['--enable-discovery-only','--config',configPath]),{enabled:true,configPath});
  assert.deepEqual(api.parseMcpOAuthLauncherArgs(['--help']),{help:true});
 });
 await check('CLI rejects ambiguous flags, secret arguments and missing configuration',()=>{
  for(const args of [['--enable-discovery-only'],['--config'],['--config',configPath,'--config',configPath],['--enable-discovery-only','--enable-discovery-only','--config',configPath],['--help','--enable-discovery-only'],['--token',secret],['--config',secret]])
   assert.throws(()=>api.parseMcpOAuthLauncherArgs(args),{message:'MCP_OAUTH_ARGUMENTS_INVALID'});
 });
 await check('strict private profile admits only matching loopback TLS and separate private introspection secret',()=>{
  write(profile());const result=api.loadPrivateMcpOAuthConfig(configPath);
  assert.equal(result.mode,'DISCOVERY_ONLY');assert.equal(result.port,0);
  assert.equal(result.resource,resource);assert.equal(result.introspection.clientSecret,secret);
  assert.ok(result.tls.key.equals(fs.readFileSync(keyPath)));assert.ok(result.tls.cert.equals(fs.readFileSync(certPath)));
 });
 await check('JSON duplicate keys, malformed UTF-8 and oversized input fail closed',()=>{
  for(const bytes of [Buffer.from('{"schema":"x","schema":"DMK_MCP_OAUTH_LAUNCHER/1"}'),Buffer.from('{'),Buffer.from([0x7b,0x22,0xff,0x22,0x3a,0x31,0x7d]),Buffer.alloc(16385,0x20)]){
   fs.writeFileSync(configPath,bytes);invalid();
  }
 });
 await check('unknown fields cannot supply a binding, authority path, inline secret or public host',()=>{
  for(const field of ['resolveBinding','bindings','authorityPath','token','host']){write({...profile(),[field]:'not-authorized'});invalid();}
  write({...profile(),introspection:{...profile().introspection,clientSecret:secret}});invalid();
 });
 await check('URLs, exact metadata path and issuer origin are validated before material acquisition',()=>{
  for(const delta of [{issuer:'http://127.0.0.1/'},{resource:resource+'?x=1'},{resource:resource+'#fragment'},{resource:'https://user:secret@dmk-launcher.example.invalid/mcp'},
   {resourceMetadataUrl:'https://dmk-launcher.example.invalid/.well-known/oauth-protected-resource/mcp'},
   {introspection:{...profile().introspection,endpoint:'https://other.example.invalid/introspect'}}]){write({...profile(),...delta});invalid();}
 });
 await check('private profile enablement and exact schema/mode are required',()=>{
  for(const delta of [{schema:'other'},{mode:'TASK_READ'},{enabled:'true'},{port:-1},{port:65536},{port:1.5}]){write({...profile(),...delta});invalid();}
  write({...profile(),enabled:false,tlsKeyPath:path.join(privateRoot,'missing.key')});
  assert.throws(()=>api.loadPrivateMcpOAuthConfig(configPath),{message:'MCP_OAUTH_LAUNCHER_DISABLED'});
 });
 await check('hard-linked credential material and noncanonical config paths are denied',()=>{
  const linked=path.join(privateRoot,'linked.secret');fs.linkSync(secretPath,linked);
  try{write(profile());invalid();}finally{fs.unlinkSync(linked);}
  write(profile());assert.throws(()=>api.loadPrivateMcpOAuthConfig(path.join(privateRoot,'..','private','launcher.json').replace('private'+path.sep+'launcher.json','private'+path.sep+'.'+path.sep+'launcher.json')),{message:'MCP_OAUTH_CONFIG_INVALID'});
 });
 await check('private secret is bounded exact UTF-8 and never silently trimmed',()=>{
  try{for(const bytes of [Buffer.alloc(1025,0x61),Buffer.from([0xff]),Buffer.from(secret+'\n')]){fs.writeFileSync(secretPath,bytes);write(profile());invalid();}}
  finally{fs.writeFileSync(secretPath,secret);}
 });
 await check('a mismatched TLS key/certificate is rejected before any listener opens',()=>{
  write({...profile(),tlsKeyPath:certPath});invalid();
 });
 await check('importing the launcher is inert and disabled startup acquires no private path',async()=>{
  assert.equal(typeof launcher?.startMcpOAuthDiscoveryLauncher,'function');
  assert.deepEqual(await launcher.startMcpOAuthDiscoveryLauncher(),{enabled:false});
  assert.deepEqual(await launcher.startMcpOAuthDiscoveryLauncher({enabled:false,configPath:path.join(privateRoot,'missing.json')}),{enabled:false});
 });
 if(launcher){
  const tls={key:fs.readFileSync(keyPath),cert:fs.readFileSync(certPath),minVersion:'TLSv1.3' as const};
  const accessToken=randomBytes(24).toString('hex');let issuer='',requests=0,overrides:Record<string,unknown>={},hold=false;
  let heldSeen:()=>void=()=>{},heldClosed:()=>void=()=>{};
  const idp=https.createServer(tls,(req,res)=>{
   requests++;let body='';req.setEncoding('utf8');req.on('data',chunk=>{body+=chunk;});req.on('end',()=>{
    const authorized=req.url==='/introspect'&&req.method==='POST'&&req.headers.authorization==='Basic '+Buffer.from('synthetic-launcher:'+secret).toString('base64')&&new URLSearchParams(body).get('token')===accessToken;
    if(authorized&&hold){req.socket.once('close',()=>heldClosed());heldSeen();return;}
    res.setHeader('content-type','application/json');res.end(JSON.stringify(authorized?{active:true,token_type:'Bearer',token_use:'access',iss:issuer,aud:resource,sub:'synthetic-launcher-user',scope:'task:read',iat:Math.floor(Date.now()/1000)-1,nbf:Math.floor(Date.now()/1000)-1,exp:Math.floor(Date.now()/1000)+120,...overrides}:{active:false}));
   });
  });
  await new Promise<void>(resolve=>idp.listen(0,'127.0.0.1',resolve));
  issuer=`https://127.0.0.1:${(idp.address() as any).port}/`;
  write({...profile(),issuer,introspection:{...profile().introspection,endpoint:issuer+'introspect'}});
  let running:any;
  const request=(port:number,message?:unknown,options:{url?:string;headers?:Record<string,string>;badCa?:boolean;tls12?:boolean}={})=>new Promise<{status:number;headers:any;body:any;protocol:string|null}>((resolve,reject)=>{
   const data=message===undefined?undefined:JSON.stringify(message);
   const req=https.request({hostname:'127.0.0.1',port,path:options.url??'/mcp',method:data===undefined?'GET':'POST',ca:options.badCa?undefined:tls.cert,
    minVersion:options.tls12?'TLSv1.2':'TLSv1.3',maxVersion:options.tls12?'TLSv1.2':'TLSv1.3',checkServerIdentity:(_host,cert)=>checkServerIdentity('127.0.0.1',cert),
    agent:false,headers:{...(data===undefined?{}:{'content-type':'application/json','content-length':String(Buffer.byteLength(data))}),...options.headers}},res=>{
     let bytes='';res.setEncoding('utf8');res.on('data',chunk=>{bytes+=chunk;if(Buffer.byteLength(bytes)>MCP_LIMITS.outputBytes)req.destroy(Error('TEST_RESPONSE_TOO_LARGE'));});
     const protocol=(res.socket as any).getProtocol();res.on('end',()=>{try{resolve({status:res.statusCode!,headers:res.headers,body:JSON.parse(bytes),protocol});}catch{reject(Error('TEST_RESPONSE_NOT_JSON'));}});
    });
   req.setTimeout(MCP_LIMITS.operationMs,()=>req.destroy(Error('TEST_REQUEST_TIMEOUT')));req.on('error',reject);req.end(data);
  });
  const call={jsonrpc:'2.0',id:47,method:'tools/call',params:{name:'read_task',arguments:{projectId:'PRJ-SYNTHETIC',taskId:'TASK-NO-BINDING'}}};
  const child=(args:string[])=>{
   const env:NodeJS.ProcessEnv={};for(const key of ['SystemRoot','WINDIR','PATH','Path','TEMP','TMP','COMSPEC','PATHEXT','SystemDrive','USERPROFILE'])if(process.env[key])env[key]=process.env[key];
   env.DMK_MCP_OAUTH_ENABLED='true'; // Must not enable a default-disabled CLI.
   const proc=spawn(process.execPath,['--import',pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href,path.resolve('scripts/workspaceMcpOAuth.ts'),...args],{windowsHide:true,env,stdio:['pipe','pipe','pipe']});
   let output='',errors='',readyResolve:(value:any)=>void=()=>{},readyReject:(error:Error)=>void=()=>{};
   const ready=new Promise<any>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
   const timer=setTimeout(()=>{proc.kill();readyReject(Error('TEST_CHILD_TIMEOUT'));},MCP_LIMITS.operationMs);
   proc.stdout.on('data',chunk=>{output+=chunk.toString();if(Buffer.byteLength(output)>MCP_LIMITS.messageBytes)proc.kill();for(const line of output.split('\n')){try{const value=JSON.parse(line);if(value.status==='MCP_OAUTH_DISCOVERY_ONLY')readyResolve(value);}catch{}}});
   proc.stderr.on('data',chunk=>{errors+=chunk.toString();if(Buffer.byteLength(errors)>MCP_LIMITS.messageBytes)proc.kill();});
   const closed=new Promise<{code:number|null;output:string;errors:string}>((resolve,reject)=>{proc.once('error',reject);proc.once('close',code=>{clearTimeout(timer);readyReject(Error('TEST_CHILD_STOPPED'));resolve({code,output,errors});});});
   return{proc,ready,closed};
  };
  try{
   await check('explicit startup serves only read_task discovery on actual loopback TLS 1.3 without IdP acquisition',async()=>{
    running=await launcher.startMcpOAuthDiscoveryLauncher({enabled:true,configPath});assert.equal(running.enabled,true);
    const listed=await request(running.port,{jsonrpc:'2.0',id:1,method:'tools/list'});
    assert.equal(listed.status,200);assert.equal(listed.protocol,'TLSv1.3');assert.deepEqual(listed.body.result.tools.map((tool:any)=>tool.name),['read_task']);assert.equal(requests,0);
    const metadata=await request(running.port,undefined,{url:'/.well-known/oauth-protected-resource/mcp'});
    assert.equal(metadata.body.resource,resource);assert.deepEqual(metadata.body.authorization_servers,[issuer]);assert.equal(requests,0);
   });
   await check('missing OAuth retains correlated MCP linking metadata and canonical resource identity',async()=>{
    const result=await request(running.port,call);assert.equal(result.body.id,47);assert.equal(result.body.result.isError,true);
    const challenge=result.body.result._meta['mcp/www_authenticate'];assert.ok(Array.isArray(challenge));
    assert.ok(challenge[0].includes(profile().resourceMetadataUrl));assert.ok(challenge[0].includes('error_description='));assert.equal(requests,0);
   });
   await check('authenticated synthetic OAuth cannot create a DMK permission or reveal task existence',async()=>{
    const before=requests,result=await request(running.port,call,{headers:{authorization:'Bearer '+accessToken}});
    assert.ok(requests>before);assert.equal(result.status,403);assert.equal(result.body.result?.isError??!!result.body.error,true);
    assert.equal(result.headers['www-authenticate'],undefined);assert.ok(!JSON.stringify(result.body).includes('TASK-NO-BINDING'));
   });
   await check('wrong audience, ID-token profile, missing access marker and revoked OAuth still require authentication',async()=>{
    for(const claims of [{aud:'https://wrong.example.invalid/mcp'},{token_use:'id'},{token_use:undefined},{active:false},{cnf:{jkt:'not-supported'}}]){
     overrides=claims;const result=await request(running.port,call,{headers:{authorization:'Bearer '+accessToken}});
     assert.equal(result.body.id,47);assert.equal(result.body.result.isError,true);assert.ok(result.body.result._meta['mcp/www_authenticate']);
    }overrides={};
   });
   await check('foreign Host, Origin and forwarded identity cannot bypass the loopback perimeter',async()=>{
    const before=requests;for(const headers of [{host:'foreign.example.invalid'},{origin:'https://foreign.example.invalid'},{'x-forwarded-host':'foreign.example.invalid'}]){
     const result=await request(running.port,call,{headers:{authorization:'Bearer '+accessToken,...headers}});assert.equal(result.status,403);
    }assert.equal(requests,before);
   });
   await check('untrusted CA and TLS 1.2 are rejected rather than downgraded',async()=>{
    await assert.rejects(request(running.port,undefined,{badCa:true}));await assert.rejects(request(running.port,undefined,{tls12:true}));
   });
   await check('disabled and invalid CLI runs are secret-free and ignore environment enablement',async()=>{
    for(const args of [[],['--config',path.join(privateRoot,'missing.json')]]){const c=child(args),result=await c.closed;assert.equal(result.code,0);assert.deepEqual(JSON.parse(result.output),{status:'MCP_OAUTH_DISABLED'});assert.equal(result.errors,'');}
    const c=child(['--token',secret]),result=await c.closed;assert.equal(result.code,1);assert.equal(result.output,'');assert.equal(result.errors.trim(),'MCP_OAUTH_LAUNCHER_FAILED');assert.ok(!result.errors.includes(secret));
   });
   await check('foreground child CLI provides real discovery and closes its listener on stdin EOF',async()=>{
    const c=child(['--enable-discovery-only','--config',configPath]);let port=0;
    try{const ready=await c.ready;port=ready.port;assert.equal(ready.taskAccess,'DENIED');assert.equal(ready.authority,'NONE');
     const listed=await request(port,{jsonrpc:'2.0',id:91,method:'tools/list'});assert.equal(listed.body.id,91);
    }finally{c.proc.stdin.end();const result=await c.closed;assert.equal(result.code,0);assert.equal(result.errors,'');assert.ok(!result.output.includes(secret));assert.ok(!result.output.includes(configPath));}
    await assert.rejects(request(port,{jsonrpc:'2.0',id:92,method:'tools/list'}));
   });
   await check('occupied-port startup fails sanitized without readiness, IdP requests or a lingering child',async()=>{
    const occupied=https.createServer(tls);await new Promise<void>(resolve=>occupied.listen(0,'127.0.0.1',resolve));
    const before=requests;
    try{
     write({...profile(),port:(occupied.address() as any).port,issuer,introspection:{...profile().introspection,endpoint:issuer+'introspect'}});
     await assert.rejects(launcher.startMcpOAuthDiscoveryLauncher({enabled:true,configPath}),{message:'MCP_OAUTH_LAUNCHER_FAILED'});
     const c=child(['--enable-discovery-only','--config',configPath]),result=await c.closed;
     assert.equal(result.code,1);assert.equal(result.output,'');assert.equal(result.errors.trim(),'MCP_OAUTH_LAUNCHER_FAILED');assert.equal(requests,before);
    }finally{await new Promise<void>(resolve=>occupied.close(()=>resolve()));write({...profile(),issuer,introspection:{...profile().introspection,endpoint:issuer+'introspect'}});}
   });
   await check('active introspection, caller and listener close within the existing shutdown bound, idempotently',async()=>{
    const observed=new Promise<void>(resolve=>{heldSeen=resolve;}),disconnected=new Promise<void>(resolve=>{heldClosed=resolve;});hold=true;
    const settled=request(running.port,call,{headers:{authorization:'Bearer '+accessToken}}).then(result=>({result}),()=>({result:undefined}));
    const bounded=<T>(promise:Promise<T>)=>new Promise<T>((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('TEST_EVENT_TIMEOUT')),MCP_LIMITS.shutdownMs);
     promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
    });
    await bounded(observed);const port=running.port,start=performance.now();
    await bounded(Promise.all([running.close(),running.close(),disconnected,settled]));
    assert.ok(performance.now()-start<MCP_LIMITS.shutdownMs);
    const outcome=await settled;if(outcome.result)assert.ok(outcome.result.body.result?.isError||outcome.result.body.error);
    await assert.rejects(request(port,{jsonrpc:'2.0',id:99,method:'tools/list'}));running=undefined;hold=false;
   });
  }finally{await running?.close();idp.closeAllConnections();await new Promise<void>(resolve=>idp.close(()=>resolve()));}
 }
}finally{
 if(path.dirname(fs.realpathSync.native(directory))!==parent||!path.basename(directory).startsWith('dmk-oauth-launcher-')||fs.lstatSync(directory).isSymbolicLink())throw Error('FIXTURE_CLEANUP_REJECTED');
 fs.rmSync(directory,{recursive:true,force:true});
}
console.log(JSON.stringify({suite:'workspace-mcp-oauth-launcher',passed,failed}));if(failed)process.exitCode=1;
