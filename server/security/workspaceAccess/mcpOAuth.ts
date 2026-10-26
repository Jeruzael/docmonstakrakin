import https from 'node:https';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {createMcpDiscoveryResponse} from './mcpDiscovery.ts';
import {createMcpOAuthIntrospector,isMcpOAuthIntrospector,type McpOAuthIdentity} from './mcpOAuthIntrospection.ts';
import {createWorkspaceMcpBridge,loadPrivateMcpConfig} from './mcpBridge.ts';
import {createWorkspaceAgentClient} from '../../../scripts/workspaceAgentClient.ts';
import {MCP_LIMITS} from './mcpTransport.ts';
import {parseAgentJson} from './agentJson.ts';
import {localRequestBoundary} from '../localPerimeter.ts';
export {createMcpOAuthIntrospector} from './mcpOAuthIntrospection.ts';

export type McpOAuthTaskBinding={configPath:string;projectId:string;taskId:string;principalId:string;clientId:string;sessionId:string;sponsorPrincipalId:string;grantId:string;grantRevision:number};
type Options={enabled?:boolean;host?:string;port?:number;issuer:string;resource:string;tls:{key:Buffer;cert:Buffer};introspector:ReturnType<typeof createMcpOAuthIntrospector>;resolveBinding:(identity:McpOAuthIdentity,signal:AbortSignal)=>Promise<McpOAuthTaskBinding|null>};
const pins=['projectId','principalId','clientId','sessionId','sponsorPrincipalId','grantId','grantRevision'] as const;
const bindingKeys=['configPath','taskId',...pins];
const identifier=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(v);
function snapshotBinding(value:unknown):McpOAuthTaskBinding|null{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)return null;
 const d=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(d).length!==bindingKeys.length||!bindingKeys.every(k=>d[k]?.enumerable&&Object.hasOwn(d[k],'value')))return null;
 const b=value as McpOAuthTaskBinding;
 if(!['projectId','taskId','principalId','clientId','sessionId','sponsorPrincipalId','grantId'].every(k=>identifier((b as any)[k]))||b.projectId==='PRJ-DOCMONSTAKRAKIN'||!Number.isSafeInteger(b.grantRevision)||b.grantRevision<1||typeof b.configPath!=='string'||!b.configPath.length)return null;
 return Object.freeze({...b});
}
function sameBinding(a:McpOAuthTaskBinding,b:McpOAuthTaskBinding|null){return b!==null&&bindingKeys.every(k=>(a as any)[k]===(b as any)[k]);}
function currentBoundSession(session:any,binding:McpOAuthTaskBinding){
 const actor=session?.actor;
 return session?.authority==='EXPERIMENTAL_LOCAL_ONLY'&&session?.humanQuorum===false&&actor?.kind==='AGENT'&&pins.every(k=>actor[k]===binding[k])&&actor.scope?.kind==='TASKS'&&Array.isArray(actor.scope.taskIds)&&actor.scope.taskIds.length===1&&actor.scope.taskIds[0]===binding.taskId&&Array.isArray(actor.actions)&&actor.actions.length===1&&actor.actions[0]==='task:read'&&Number.isSafeInteger(actor.expiresAt)&&actor.expiresAt>Date.now()&&actor.expiresAt-Date.now()<=180000;
}

/** Unwired development resource server. No enrollment, token issue or OAuth AS. */
export async function createWorkspaceMcpOAuthServer(options:Options){
 let resource:URL;
 try{
  if(options?.enabled!==true||options.host!==undefined&&options.host!=='127.0.0.1'||options.port!==undefined&&(!Number.isSafeInteger(options.port)||options.port<0||options.port>65535)||!isMcpOAuthIntrospector(options.introspector)||typeof options.resolveBinding!=='function')throw Error();
  resource=new URL(options.resource);
  if(resource.protocol!=='https:'||resource.username||resource.password||resource.hash||resource.search||resource.pathname!=='/mcp'||options.introspector.resource!==options.resource||options.introspector.issuer!==options.issuer||!Buffer.isBuffer(options.tls?.key)||!options.tls.key.length||!Buffer.isBuffer(options.tls?.cert)||!options.tls.cert.length)throw Error();
 }catch{throw Error('MCP_OAUTH_RESOURCE_DISABLED_OR_INVALID');}
 const metadataPath='/.well-known/oauth-protected-resource/mcp',metadataUrl=new URL(metadataPath,resource).href;
 const introspector=options.introspector,resolveBinding=options.resolveBinding,issuer=options.issuer,resourceIdentifier=options.resource;
 const controllers=new Set<AbortController>(),sockets=new Set<import('node:net').Socket>();let occupied=0,closing=false;
 const challenge=`Bearer resource_metadata="${metadataUrl}", scope="task:read"`;
 function reply(res:ServerResponse,status:number,value?:unknown){
  if(res.destroyed||res.writableEnded)return;
  let encoded=value===undefined?'':JSON.stringify(value);
  if(Buffer.byteLength(encoded)>MCP_LIMITS.outputBytes){status=503;encoded=JSON.stringify({error:'MCP_RESOURCE_LIMIT'});}
  const writeTimer=setTimeout(()=>res.destroy(),MCP_LIMITS.writeMs);
  const written=()=>clearTimeout(writeTimer);res.once('finish',written);res.once('close',written);
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close',...(status===401?{'WWW-Authenticate':challenge}:{})});res.end(encoded);
 }
 function denied(res:ServerResponse,status=403){reply(res,status,{error:status===401?'MCP_OAUTH_REQUIRED':'MCP_TASK_READ_DENIED'});}
 const server=https.createServer({key:Buffer.from(options.tls.key),cert:Buffer.from(options.tls.cert),minVersion:'TLSv1.3',maxHeaderSize:8192,headersTimeout:5000,requestTimeout:10000,keepAliveTimeout:1000},(req:IncomingMessage,res:ServerResponse)=>{
  const count=(key:string)=>req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()===key).length;
  if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`||count('authorization')>1||req.headers.cookie!==undefined){reply(res,403,{error:'MCP_TRANSPORT_REJECTED'});req.resume();return;}
  localRequestBoundary(req,res,()=>{
   if(req.url===metadataPath&&req.method==='GET'){reply(res,200,{resource:resourceIdentifier,authorization_servers:[issuer],scopes_supported:['task:read'],bearer_methods_supported:['header']});return;}
   if(req.url!=='/mcp'){reply(res,403,{error:'MCP_TRANSPORT_REJECTED'});req.resume();return;}
   if(req.method!=='POST'){reply(res,405,{error:'MCP_METHOD_UNSUPPORTED'});req.resume();return;}
   if(!/^application\/json(?:\s*;.*)?$/i.test(String(req.headers['content-type']??''))||req.headers['content-encoding']!==undefined&&req.headers['content-encoding']!=='identity'){reply(res,415,{error:'MCP_MESSAGE_REJECTED'});req.resume();return;}
   if(closing||occupied>=MCP_LIMITS.concurrent){reply(res,503,{error:'MCP_RESOURCE_LIMIT'});req.resume();return;}
   if(req.headers['content-length']!==undefined&&(!/^\d+$/.test(req.headers['content-length'])||Number(req.headers['content-length'])>MCP_LIMITS.messageBytes)){reply(res,413,{error:'MCP_RESOURCE_LIMIT'});req.resume();return;}
   occupied++;const controller=new AbortController();controllers.add(controller);
   let working=false,released=false,total=0,chunks:Buffer[]=[],deadline:ReturnType<typeof setTimeout>|undefined;
   const release=()=>{if(released)return;released=true;occupied--;controllers.delete(controller);clearTimeout(bodyTimer);clearTimeout(deadline);};
   const finished=()=>{controller.abort();if(!working)release();};
   const bodyTimer=setTimeout(()=>{controller.abort();reply(res,408,{error:'MCP_BODY_DEADLINE'});req.destroy();if(!working)release();},MCP_LIMITS.bodyMs);
   req.once('aborted',finished);req.once('error',finished);res.once('close',finished);res.once('finish',()=>{if(!working)release();});
   req.on('data',(chunk:Buffer)=>{if(released)return;total+=chunk.length;if(total>MCP_LIMITS.messageBytes){chunks=[];reply(res,413,{error:'MCP_RESOURCE_LIMIT'});req.destroy();release();return;}chunks.push(Buffer.from(chunk));});
   req.once('end',()=>{
    if(released)return;clearTimeout(bodyTimer);working=true;
    deadline=setTimeout(()=>{controller.abort();reply(res,504,{error:'MCP_OPERATION_DEADLINE'});},MCP_LIMITS.operationMs);
    void(async()=>{
     try{
      let message:Record<string,any>;
      try{message=parseAgentJson(Buffer.concat(chunks));chunks=[];}catch{reply(res,400,{error:'MCP_MESSAGE_REJECTED'});return;}
      if(message.jsonrpc!=='2.0'||typeof message.method!=='string'||message.id!==undefined&&message.id!==null&&typeof message.id!=='string'&&typeof message.id!=='number'){reply(res,400,{error:'MCP_MESSAGE_REJECTED'});return;}
      const discovery=createMcpDiscoveryResponse(message);
      if(discovery!==undefined){if(discovery?.result?.tools)discovery.result.tools[0].securitySchemes=[{type:'oauth2',scopes:['task:read']}];reply(res,discovery===null?202:200,discovery??undefined);return;}
      if(message.method!=='tools/call'||message.params?.name!=='read_task'){reply(res,400,{error:'MCP_METHOD_UNSUPPORTED'});return;}
      const auth=typeof req.headers.authorization==='string'?/^Bearer ([-A-Za-z0-9._~+/]+=*)$/i.exec(req.headers.authorization):null;
      if(!auth){denied(res,401);return;}
      let identity:McpOAuthIdentity;
      try{identity=await introspector.verify(auth[1],controller.signal);}catch{denied(res,401);return;}
      const args=message.params?.arguments;
      const binding=snapshotBinding(await resolveBinding(identity,controller.signal));
      if(controller.signal.aborted||!binding||!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).sort().join(',')!=='projectId,taskId'||args.projectId!==binding.projectId||args.taskId!==binding.taskId){denied(res);return;}
      // The existing loader is unchanged: acquire every current file, ACL and
      // link identity only AFTER user authorization and exact trusted mapping.
      const config=loadPrivateMcpConfig(binding.configPath);
      const client=createWorkspaceAgentClient({origin:config.origin,ca:config.ca,token:config.token});
      const bridge=createWorkspaceMcpBridge({origin:config.origin,ca:config.ca,token:config.token});
      try{
       if(!currentBoundSession(await client.session(controller.signal),binding)){denied(res);return;}
       const outcome=await bridge.handleMessage(message,controller.signal) as any;
       if(outcome?.result?.isError!==false){denied(res);return;}
       const envelope=JSON.parse(outcome.result.content[0].text);
       let finalIdentity:McpOAuthIdentity;
       try{finalIdentity=await introspector.verify(auth[1],controller.signal);if(finalIdentity.subject!==identity.subject||finalIdentity.issuer!==identity.issuer||finalIdentity.resource!==identity.resource)throw Error();}catch{denied(res,401);return;}
       const finalBinding=snapshotBinding(await resolveBinding(identity,controller.signal)),after=await client.session(controller.signal);
       if(!currentBoundSession(after,binding)||after.actor.policyRevision!==envelope.acknowledgment.policyRevision||after.actor.snapshotRevision!==envelope.acknowledgment.snapshotRevision||!sameBinding(binding,finalBinding)){denied(res);return;}
       // No awaited IdP or mapping work follows the final DMK observation.
       // These independent systems are not an atomic distributed transaction.
       if(controller.signal.aborted||Math.min(identity.expiresAt,finalIdentity.expiresAt)<=Date.now()||after.actor.expiresAt<=Date.now()){denied(res);return;}
       reply(res,200,outcome);
      }finally{bridge.close();client.close();}
     }catch{denied(res);}
     finally{working=false;if(res.destroyed||res.writableFinished)release();else res.once('finish',release);}
    })();
   });
  });
 });
 server.maxConnections=MCP_LIMITS.connections;
 server.on('connection',stream=>{const socket=stream as import('node:net').Socket;sockets.add(socket);socket.setTimeout(MCP_LIMITS.operationMs,()=>socket.destroy());socket.once('close',()=>sockets.delete(socket));});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??0,'127.0.0.1',resolve);});
 return{port:(server.address() as import('node:net').AddressInfo).port,close:()=>new Promise<void>(resolve=>{closing=true;for(const controller of controllers)controller.abort();const timer=setTimeout(()=>{for(const socket of sockets)socket.destroy();resolve();},MCP_LIMITS.shutdownMs);server.close(()=>{clearTimeout(timer);resolve();});server.closeIdleConnections();})};
}
