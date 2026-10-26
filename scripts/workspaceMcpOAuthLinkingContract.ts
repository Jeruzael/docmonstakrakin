import assert from 'node:assert/strict';
import https from 'node:https';
import {EventEmitter} from 'node:events';

/** No sockets, credentials or grants: protocol-emulation tests only. */
export async function runOAuthLinkingContract(api:any){
 const issuer='https://idp.example.invalid';
 const direct='https://dmk.example.invalid/mcp';
 // Synthetic origin, not a claim about an actual deployed tunnel endpoint.
 const tunnel='https://tunnel.example.invalid/v1/mcp/tunnel_synthetic';
 const metadata=(resource:string)=>{const u=new URL(resource);return u.origin+'/.well-known/oauth-protected-resource'+u.pathname;};
 const originalCreate=https.createServer,originalRequest=https.request;
 let nextPort=45678,claims:any,networkCalls=0,resolverCalls=0;
 const handlers=new Map<number,Function>(),servers:any[]=[],verifiers:any[]=[],results:{name:string;pass:boolean;category?:string}[]=[];
 const tls={key:Buffer.from('unused synthetic bytes'),cert:Buffer.from('unused synthetic bytes')};
 async function check(name:string,fn:()=>unknown|Promise<unknown>){
  try{await fn();results.push({name,pass:true});}
  catch(error){results.push({name,pass:false,category:(error as Error)?.name??'Error'});}
 }
 // HTTPS methods are replaced before constructing the resource or introspector.
 // A request to any endpoint other than this synthetic IdP is a test failure.
 (https as any).createServer=(options:any,handler:Function)=>{
  assert.equal(options.minVersion,'TLSv1.3');
  const port=nextPort++,server:any=new EventEmitter();handlers.set(port,handler);
  server.listen=(_port:number,host:string,cb:Function)=>{assert.equal(host,'127.0.0.1');cb();};
  server.address=()=>({port});server.close=(cb:Function)=>cb();server.closeIdleConnections=()=>{};
  return server;
 };
 (https as any).request=(url:any,options:any,callback:Function)=>{
  assert.equal(String(url),issuer+'/introspect');assert.equal(options.method,'POST');networkCalls++;
  const req:any=new EventEmitter();req.setTimeout=()=>{};req.destroy=()=>{};
  req.end=()=>queueMicrotask(()=>{
   const res:any=new EventEmitter();res.statusCode=200;res.headers={'content-type':'application/json'};res.destroy=()=>{};
   callback(res);res.emit('data',Buffer.from(JSON.stringify(claims)));res.emit('end');
  });return req;
 };
 function options(resource:string,resourceMetadataUrl=metadata(resource)){
  const introspector=api.createMcpOAuthIntrospector({issuer,resource,introspectionEndpoint:issuer+'/introspect',clientId:'synthetic',clientSecret:'synthetic'});
  verifiers.push(introspector);
  return {enabled:true,resource,resourceMetadataUrl,issuer,tls,introspector,resolveBinding:async()=>{resolverCalls++;return null;}};
 }
 async function make(resource:string){const server=await api.createWorkspaceMcpOAuthServer(options(resource));servers.push(server);return server;}
 function request(server:any,message:any,settings:any={}):Promise<any>{
  return new Promise((resolve,reject)=>{
   const req:any=new EventEmitter(),res:any=new EventEmitter();
   req.headers={host:'127.0.0.1:'+server.port,...(message===undefined?{}:{'content-type':'application/json'}),...settings.headers};
   req.rawHeaders=settings.rawHeaders??Object.entries(req.headers).flatMap(([k,v])=>[k,String(v)]);
   req.socket={localPort:server.port,encrypted:true};req.method=settings.method??'POST';req.url=settings.url??'/mcp';req.resume=()=>{};
   req.destroy=()=>{req.emit('aborted');};res.destroyed=false;res.writableEnded=false;res.writableFinished=false;
   const responseHeaders:Record<string,string>={};res.setHeader=(k:string,v:string)=>{responseHeaders[k]=v;};
   res.writeHead=(status:number,headers:any)=>{res.statusCode=status;Object.assign(responseHeaders,headers);};
   res.end=(raw:string)=>{res.writableEnded=true;res.writableFinished=true;res.emit('finish');try{resolve({status:res.statusCode,headers:responseHeaders,body:raw?JSON.parse(raw):null});}catch(e){reject(e);}};
   res.destroy=()=>{res.destroyed=true;res.emit('close');reject(Error('MOCK_RESPONSE_DESTROYED'));};
   try{handlers.get(server.port)!(req,res);if(message!==undefined){req.emit('data',Buffer.from(settings.raw??JSON.stringify(message)));req.emit('end');}}catch(e){reject(e);}
  });
 }
 const call={jsonrpc:'2.0',id:'synthetic-call',method:'tools/call',params:{name:'read_task',arguments:{projectId:'PRJ-SYNTHETIC',taskId:'TASK-SYNTHETIC'}}};
 const auth={authorization:'Bearer synthetic-access'};
 const valid=(resource:string)=>({active:true,token_type:'Bearer',token_use:'access',iss:issuer,aud:resource,sub:'synthetic-user',scope:'task:read',exp:Math.floor(Date.now()/1000)+120});
 function assertLink(result:any,resource:string,port:number){
  assert.equal(result.status,200);assert.equal(result.body.jsonrpc,'2.0');assert.equal(result.body.id,call.id);assert.equal(result.body.result?.isError,true);
  const challenges=result.body.result?._meta?.['mcp/www_authenticate'];assert.equal(challenges?.length,1);
  assert.match(challenges[0],/^Bearer /);assert.ok(challenges[0].includes('resource_metadata="'+metadata(resource)+'"'));
  assert.match(challenges[0],/error="invalid_token"/);assert.match(challenges[0],/error_description="[^"\r\n]+"/);
  assert.ok(result.headers['WWW-Authenticate'].includes('https://127.0.0.1:'+port+'/.well-known/oauth-protected-resource/mcp'));
  assert.equal(JSON.stringify(result).includes('synthetic-access'),false);assert.equal(JSON.stringify(result).includes('synthetic-user'),false);
  assert.equal(result.body.result.content.length,1);assert.equal(result.body.result.content[0].type,'text');
 }
 try{
  const directServer=await make(direct);
  await check('discovery is public, OAuth-only, and does not acquire identity or binding',async()=>{
   const before=[networkCalls,resolverCalls];
   const response=await request(directServer,{jsonrpc:'2.0',id:1,method:'tools/list'});
   assert.deepEqual(response.body.result.tools.map((t:any)=>t.name),['read_task']);
   assert.deepEqual(response.body.result.tools[0].securitySchemes,[{type:'oauth2',scopes:['task:read']}]);
   assert.deepEqual([networkCalls,resolverCalls],before);
  });
  await check('missing OAuth returns correlated MCP linking error and local HTTP metadata pointer',async()=>{
   const before=[networkCalls,resolverCalls];assertLink(await request(directServer,call),direct,directServer.port);assert.deepEqual([networkCalls,resolverCalls],before);
  });
  for(const [name,delta] of [['inactive',{active:false}],['expired',{exp:1}],['refresh token',{token_use:'refresh'}],['missing token-use',{token_use:undefined}],['ID-like token',{token_type:'ID'}],['wrong audience',{aud:'https://other.example.invalid/mcp'}],['wrong issuer',{iss:'https://other.example.invalid'}],['missing scope',{scope:'profile'}],['proof-bound token',{cnf:{jkt:'synthetic'}}]] as const){
   await check(name+' denies with linking metadata before binding',async()=>{const before=resolverCalls;claims={...valid(direct),...delta};assertLink(await request(directServer,call,{headers:auth}),direct,directServer.port);assert.equal(resolverCalls,before);});
  }
  await check('valid OAuth without HUMAN-authorized mapping remains forbidden without relinking',async()=>{
   claims=valid(direct);const before=resolverCalls;const response=await request(directServer,call,{headers:auth});
   assert.equal(response.status,403);assert.deepEqual(response.body,{jsonrpc:'2.0',id:call.id,error:{code:-32003,message:'MCP_TASK_READ_DENIED'}});
   assert.equal(response.body.result,undefined);assert.equal(response.headers['WWW-Authenticate'],undefined);assert.equal(resolverCalls,before+1);
  });
  const perimeter=[['foreign Host',{host:'foreign.invalid'},403],['foreign Origin',{origin:'https://foreign.invalid'},403],['forwarded',{forwarded:'host=foreign.invalid'},403],['x-forwarded Host',{'x-forwarded-host':'foreign.invalid'},403],['cookie',{cookie:'synthetic=true'},403],['wrong media',{'content-type':'text/plain'},415],['compressed input',{'content-encoding':'gzip'},415],['oversized input',{'content-length':'16385'},413]] as const;
  for(const [name,headers,status] of perimeter)await check(name+' remains rejected before identity acquisition',async()=>{
   const before=[networkCalls,resolverCalls];const response=await request(directServer,call,{headers:{...auth,...headers}});assert.equal(response.status,status);assert.deepEqual([networkCalls,resolverCalls],before);
  });
  await check('duplicate Authorization remains denied',async()=>{
   const response=await request(directServer,call,{headers:auth,rawHeaders:['Host','127.0.0.1:'+directServer.port,'Content-Type','application/json','Authorization','Bearer synthetic-access','authorization','Bearer synthetic-access']});assert.equal(response.status,403);
  });
  await check('no-body POST and GET preserve denial while local metadata fallback is available',async()=>{
   assert.equal((await request(directServer,undefined)).status,415);
   assert.equal((await request(directServer,undefined,{method:'GET'})).status,405);
   const response=await request(directServer,undefined,{method:'GET',url:'/.well-known/oauth-protected-resource/mcp'});
   assert.equal(response.status,200);assert.equal(response.body.resource,direct);
  });
  await check('tunnel canonical identity can differ from the fixed backend /mcp path',async()=>{
   const server=await make(tunnel);const response=await request(server,undefined,{method:'GET',url:'/.well-known/oauth-protected-resource/mcp'});
   assert.equal(response.body.resource,tunnel);assertLink(await request(server,call),tunnel,server.port);
   claims=valid(tunnel);assert.equal((await request(server,call,{headers:auth})).status,403); // valid identity, still no DMK mapping
   for(const aud of [direct,tunnel+'-other']){claims={...valid(tunnel),aud};assertLink(await request(server,call,{headers:auth}),tunnel,server.port);}
  });
  await check('port 443 is literal in local metadata pointer',async()=>{
   nextPort=443;const server=await make(direct);assertLink(await request(server,call),direct,443);
  });
  for(const [name,resource,url] of [['missing metadata',direct,undefined],['other metadata origin',direct,'https://other.example.invalid/.well-known/oauth-protected-resource/mcp'],['other tunnel metadata',tunnel,metadata(tunnel+'-other')],['trailing question mark',direct+'?',metadata(direct)],['trailing fragment',direct,metadata(direct)+'#'],['noncanonical default port','https://dmk.example.invalid:443/mcp',metadata(direct)]] as const){
   await check(name+' configuration fails before creating listener',async()=>{
    const configuration=options(resource);(configuration as any).resourceMetadataUrl=url;const before=handlers.size;
    await assert.rejects(api.createWorkspaceMcpOAuthServer(configuration),/MCP_OAUTH_RESOURCE_DISABLED_OR_INVALID/);assert.equal(handlers.size,before);
   });
  }
 }finally{
  for(const server of servers)await server.close();for(const verifier of verifiers)verifier.close();
  https.createServer=originalCreate;https.request=originalRequest;
 }
 return {passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results,mockedIntrospectionRequests:networkCalls,mappingLookups:resolverCalls,realNetworkRequests:0,realListeners:0,issuedGrants:0,qualification:'Protocol emulation only; no TLS, actual tunnel, real provider or ChatGPT acceptance.'};
}
