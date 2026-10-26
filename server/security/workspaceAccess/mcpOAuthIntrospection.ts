import https from 'node:https';
import {parseAgentJson} from './agentJson.ts';
import {MCP_LIMITS} from './mcpTransport.ts';

export type McpOAuthIdentity=Readonly<{issuer:string;subject:string;resource:string;expiresAt:number}>;
type Options={issuer:string;resource:string;introspectionEndpoint:string;clientId:string;clientSecret:string;ca?:Buffer};
const instances=new WeakSet<object>();
const rejected=()=>Error('MCP_OAUTH_TOKEN_REJECTED');
export function isMcpOAuthIntrospector(value:unknown):value is ReturnType<typeof createMcpOAuthIntrospector>{return !!value&&typeof value==='object'&&instances.has(value);}

/** Resource-server client_secret_basic is not end-user or DMK grant authority. */
export function createMcpOAuthIntrospector(options:Options){
 function url(text:string){const value=new URL(text);if(value.protocol!=='https:'||value.username||value.password||value.hash||value.search)throw Error();return value;}
 let endpoint:URL;
 try{
  const issuer=url(options.issuer);url(options.resource);endpoint=url(options.introspectionEndpoint);
  if(endpoint.origin!==issuer.origin||![options.clientId,options.clientSecret].every(v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=1024)||options.ca!==undefined&&(!Buffer.isBuffer(options.ca)||!options.ca.length||options.ca.length>65536))throw Error();
 }catch{throw Error('MCP_OAUTH_CONFIG_INVALID');}
 const issuer=options.issuer,resource=options.resource;
 const authorization='Basic '+Buffer.from(encodeURIComponent(options.clientId)+':'+encodeURIComponent(options.clientSecret)).toString('base64');
 const agent=new https.Agent({ca:options.ca?Buffer.from(options.ca):undefined,rejectUnauthorized:true,minVersion:'TLSv1.3',maxSockets:MCP_LIMITS.concurrent});
 const active=new Set<import('node:http').ClientRequest>();let closed=false,occupied=0;
 const safeTime=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number.isSafeInteger(Number(v)*1000);
 async function verify(token:string,signal?:AbortSignal):Promise<McpOAuthIdentity>{
  if(closed||signal?.aborted||occupied>=MCP_LIMITS.concurrent||typeof token!=='string'||!token.length||token.length>8192||!/^[-A-Za-z0-9._~+/]+=*$/.test(token))throw rejected();
  occupied++;
  try{
   const data=await new Promise<Record<string,unknown>>((resolve,reject)=>{
    const body=new URLSearchParams({token,token_type_hint:'access_token'}).toString();
    let done=false,parts:Buffer[]=[],total=0,req:import('node:http').ClientRequest;
    const finish=(value?:Record<string,unknown>)=>{if(done)return;done=true;clearTimeout(timer);parts=[];active.delete(req);value?resolve(value):reject(rejected());};
    const timer=setTimeout(()=>{req?.destroy();finish();},MCP_LIMITS.bodyMs);
    try{
     req=https.request(endpoint,{agent,signal,method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body),Accept:'application/json','Accept-Encoding':'identity'}},res=>{
      if(res.statusCode!==200||!/^application\/json(?:\s*;.*)?$/i.test(String(res.headers['content-type']??''))||res.headers['content-encoding']!==undefined&&res.headers['content-encoding']!=='identity'||Number(res.headers['content-length']??0)>MCP_LIMITS.messageBytes){res.destroy();finish();return;}
      res.on('data',chunk=>{total+=chunk.length;if(total>MCP_LIMITS.messageBytes){res.destroy();finish();return;}parts.push(Buffer.from(chunk));});
      res.once('error',()=>finish());res.once('aborted',()=>finish());
      res.once('end',()=>{if(done)return;try{finish(parseAgentJson(Buffer.concat(parts)));}catch{finish();}});
     });active.add(req);req.setTimeout(MCP_LIMITS.bodyMs,()=>{req.destroy();finish();});req.once('error',()=>finish());req.end(body);
    }catch{finish();}
   });
   const now=Date.now();
   if(signal?.aborted||data.active!==true||typeof data.token_type!=='string'||data.token_type.toLowerCase()!=='bearer'||data.token_use!=='access'||Object.hasOwn(data,'cnf')||data.iss!==issuer||!(data.aud===resource||Array.isArray(data.aud)&&data.aud.every(v=>typeof v==='string')&&data.aud.includes(resource))||
     typeof data.sub!=='string'||!data.sub.length||Buffer.byteLength(data.sub)>128||/[\x00-\x1f\x7f]/.test(data.sub)||
     typeof data.scope!=='string'||!data.scope.split(' ').includes('task:read')||!safeTime(data.exp)||data.exp*1000<=now||
     data.nbf!==undefined&&(!safeTime(data.nbf)||data.nbf*1000>now)||data.iat!==undefined&&(!safeTime(data.iat)||data.iat*1000>now))throw rejected();
   return Object.freeze({issuer,subject:data.sub,resource,expiresAt:data.exp*1000});
  }catch{throw rejected();}finally{occupied--;}
 }
 const result=Object.freeze({issuer,resource,verify,close(){closed=true;for(const req of active)req.destroy();agent.destroy();}});instances.add(result);return result;
}
