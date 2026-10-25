import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import type {Readable,Writable} from 'node:stream';
import {parseAgentJson} from './agentJson.ts';
import {localRequestBoundary} from '../localPerimeter.ts';

/** Candidate limits for this disconnected read-only adapter; not production capacity. */
export const MCP_LIMITS=Object.freeze({messageBytes:16384,outputBytes:524288,pendingMessages:8,queuedBytes:131072,concurrent:2,connections:8,operationMs:30000,bodyMs:5000,writeMs:5000,shutdownMs:1000});
type Bridge={handleMessage(message:unknown,signal?:AbortSignal):Promise<Record<string,unknown>|null>;verifyShortScopedGrant(signal?:AbortSignal):Promise<boolean>};
const protocolError=(code:number,message:string)=>({jsonrpc:'2.0',id:null,error:{code,message}});
const resourceError=()=>protocolError(-32000,'MCP resource limit or cancellation');
function encode(value:unknown){let text=JSON.stringify(value);if(Buffer.byteLength(text)>MCP_LIMITS.outputBytes)text=JSON.stringify(resourceError());return text;}

/** Standard MCP newline JSON only. Resource exhaustion closes this transport explicitly. */
export function attachMcpStdioTransport(bridge:Bridge,input:Readable=process.stdin,output:Writable=process.stdout){
 let closed=false,buffer=Buffer.alloc(0),queuedBytes=0,running=false,pending=Promise.resolve();
 const queue:Buffer[]=[],cancelled=new Set<Buffer>();let active:AbortController|undefined,activeId:unknown,writeCancel:(()=>void)|undefined;
 function close(){if(closed)return;const blockedOutput=!!writeCancel;closed=true;active?.abort();writeCancel?.();if(blockedOutput)output.destroy();queue.length=0;cancelled.clear();queuedBytes=0;buffer=Buffer.alloc(0);input.off('data',onData);input.off('end',onEnd);input.pause();output.off('error',onOutputError);}
 function onOutputError(){close();}
 async function write(value:unknown){
  if(closed)return;
  const line=encode(value)+'\n';
  await new Promise<void>((resolve,reject)=>{
   let done=false;
   const finish=(error?:Error)=>{if(done)return;done=true;clearTimeout(timer);output.off('error',errorHandler);writeCancel=undefined;error?reject(error):resolve();};
   const errorHandler=()=>finish(Error('MCP_OUTPUT_FAILED'));
   const timer=setTimeout(()=>{finish(Error('MCP_OUTPUT_DEADLINE'));output.destroy();},MCP_LIMITS.writeMs);
   writeCancel=()=>finish(Error('MCP_CLOSED'));output.once('error',errorHandler);
   // Write completion is stronger than write() returning true: even a small
   // accepted write can still be pending in an OS pipe at EOF or shutdown.
   try{output.write(line,error=>finish(error?Error('MCP_OUTPUT_FAILED'):undefined));}catch{errorHandler();}
  });
 }
 function terminate(value:unknown){
  if(closed)return;
  // One terminal protocol error, never one response per over-limit input.
  // Do not append a second write behind an already blocked output buffer.
  if(!writeCancel){try{const timer=setTimeout(()=>output.destroy(),MCP_LIMITS.writeMs);timer.unref();const terminalError=()=>output.destroy();output.once('error',terminalError);output.once('close',()=>{clearTimeout(timer);output.off('error',terminalError);});output.write(encode(value)+'\n',()=>clearTimeout(timer));}catch{}}
  close();
 }
 function start(){
  if(running||closed)return;running=true;
  pending=(async()=>{
   while(queue.length&&!closed){
    const raw=queue.shift()!;queuedBytes-=raw.length;active=new AbortController();
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
     let parsed:Record<string,unknown>;
     try{parsed=parseAgentJson(raw);}catch{await write(protocolError(-32700,'Parse error'));continue;}
     if(cancelled.delete(raw)){await write({jsonrpc:'2.0',id:parsed.id??null,error:{code:-32800,message:'Request cancelled'}});continue;}
     const controller=active;activeId=parsed.id;
     const work=bridge.handleMessage(parsed,controller.signal);
     const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('MCP_OPERATION_DEADLINE'));},MCP_LIMITS.operationMs);});
     const reply=await Promise.race([work,deadline]);if(reply!==null)await write(reply);
    }catch{terminate(resourceError());}
    finally{if(timer)clearTimeout(timer);active=undefined;activeId=undefined;}
   }
  })().finally(()=>{running=false;});
 }
 function admit(raw:Buffer){
  if(!raw.length)return;
  // Cancellation must not wait behind the operation it is cancelling.
  try{const message=parseAgentJson(raw);if(message.jsonrpc==='2.0'&&message.method==='notifications/cancelled'&&message.id===undefined){const id=(message.params as any)?.requestId;if(id===activeId)active?.abort();for(const item of queue){try{if(parseAgentJson(item).id===id)cancelled.add(item);}catch{}}return;}}catch{}
  if(raw.length>MCP_LIMITS.messageBytes||queue.length+(running?1:0)>=MCP_LIMITS.pendingMessages||queuedBytes+raw.length>MCP_LIMITS.queuedBytes){terminate(resourceError());return;}
  queue.push(Buffer.from(raw));queuedBytes+=raw.length;start();
 }
 function onData(chunk:Buffer|string){
  if(closed)return;const part=typeof chunk==='string'?Buffer.from(chunk):chunk;let offset=0;
  while(offset<part.length&&!closed){
   const end=part.indexOf(10,offset),stop=end<0?part.length:end,length=stop-offset;
   if(buffer.length+length>MCP_LIMITS.messageBytes){terminate(resourceError());return;}
   if(length)buffer=Buffer.concat([buffer,part.subarray(offset,stop)]);
   if(end<0)break;
   const line=buffer;buffer=Buffer.alloc(0);admit(line);offset=end+1;
  }
 }
 function onEnd(){if(buffer.length)terminate(protocolError(-32700,'Incomplete newline-delimited message'));}
 input.on('data',onData);input.once('end',onEnd);output.on('error',onOutputError);
 return{drain:()=>pending,close};
}

export async function createMcpHttpBridgeServer(options:{bridge:Bridge;host?:string;port?:number;connectorToken:string}){
 const host=options.host??'127.0.0.1';
 if(host!=='127.0.0.1'||!/^mcp_conn_v1_[a-f0-9]{64}$/.test(options.connectorToken)||options.port!==undefined&&(!Number.isSafeInteger(options.port)||options.port<0||options.port>65535))throw Error('MCP_HTTP_CONFIG_INVALID');
 const expected=Buffer.from('Bearer '+options.connectorToken);let occupied=0,closing=false;
 const controllers=new Set<AbortController>(),sockets=new Set<import('node:net').Socket>();
 const server=http.createServer({maxHeaderSize:8192,headersTimeout:5000,requestTimeout:10000,keepAliveTimeout:1000},(req,res)=>{
  const reject=(status:number,error:string)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json','Connection':'close','Cache-Control':'no-store'});res.end(JSON.stringify({error}));req.resume();};
  // Raw-header checks run before bearer comparison or any private authority call.
  const count=(key:string)=>req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()===key).length;
  if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`||count('authorization')>1){reject(403,'MCP_TRANSPORT_REJECTED');return;}
  localRequestBoundary(req,res,()=>{
   const auth=typeof req.headers.authorization==='string'?Buffer.from(req.headers.authorization):null;
   if(!auth||auth.length!==expected.length||!timingSafeEqual(auth,expected)){reject(401,'MCP_CONNECTOR_UNAUTHORIZED');return;}
   if(req.url!=='/mcp'||req.headers.cookie!==undefined){reject(403,'MCP_TRANSPORT_REJECTED');return;}
   if(req.method!=='POST'){reject(405,'MCP_METHOD_UNSUPPORTED');return;}
   if(closing||occupied>=MCP_LIMITS.concurrent){reject(503,'MCP_RESOURCE_LIMIT');return;}
   const declared=req.headers['content-length'];
   if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MCP_LIMITS.messageBytes)){reject(413,'MCP_RESOURCE_LIMIT');return;}
   occupied++;const controller=new AbortController();controllers.add(controller);
   let chunks:Buffer[]=[],total=0,working=false,released=false;
   const release=()=>{if(released)return;released=true;occupied--;controllers.delete(controller);clearTimeout(bodyTimer);clearTimeout(writeTimer);};
   const finish=()=>{if(!working)release();};
   let writeTimer:ReturnType<typeof setTimeout>|undefined;
   const bodyTimer=setTimeout(()=>{controller.abort();reject(408,'MCP_BODY_DEADLINE');req.destroy();release();},MCP_LIMITS.bodyMs);
   req.once('aborted',()=>{controller.abort();finish();});req.once('error',()=>{controller.abort();finish();});
   res.once('close',()=>{controller.abort();finish();});
   req.on('data',(part:Buffer)=>{if(released)return;total+=part.length;if(total>MCP_LIMITS.messageBytes){reject(413,'MCP_RESOURCE_LIMIT');req.destroy();release();return;}chunks.push(Buffer.from(part));});
   req.once('end',()=>{
    if(released)return;clearTimeout(bodyTimer);working=true;
    void(async()=>{
     let deadline:ReturnType<typeof setTimeout>|undefined;
     try{
      const parsed=parseAgentJson(Buffer.concat(chunks));chunks=[];
      // The slot is held until underlying authority work actually settles.
      deadline=setTimeout(()=>{controller.abort();reject(504,'MCP_OPERATION_DEADLINE');},MCP_LIMITS.operationMs);
      const reply=parsed.method==='tools/call'&&!await options.bridge.verifyShortScopedGrant(controller.signal)
       ?{jsonrpc:'2.0',id:parsed.id??null,result:{isError:true,content:[{type:'text',text:JSON.stringify({error:'MCP_TASK_READ_DENIED',message:'Task read was denied or unavailable under current agent authority.'})}]}}
       :await options.bridge.handleMessage(parsed,controller.signal);
      if(!res.destroyed&&!res.writableEnded){
       writeTimer=setTimeout(()=>res.destroy(),MCP_LIMITS.writeMs);
       res.once('finish',()=>{clearTimeout(writeTimer);release();});
       if(reply===null){res.writeHead(202);res.end();}else{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(encode(reply));}
      }
     }catch{reject(400,'MCP_MESSAGE_REJECTED');}
     finally{if(deadline)clearTimeout(deadline);working=false;if(res.destroyed||res.writableFinished)release();else res.once('finish',release);}
    })();
   });
  });
 });
 server.maxConnections=MCP_LIMITS.connections;
 server.on('connection',socket=>{sockets.add(socket);socket.setTimeout(MCP_LIMITS.operationMs,()=>socket.destroy());socket.once('close',()=>sockets.delete(socket));});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??0,host,resolve);});
 return{port:(server.address() as import('node:net').AddressInfo).port,
  close:()=>new Promise<void>(resolve=>{closing=true;for(const controller of controllers)controller.abort();const timer=setTimeout(()=>{for(const socket of sockets)socket.destroy();resolve();},MCP_LIMITS.shutdownMs);server.close(()=>{clearTimeout(timer);resolve();});server.closeIdleConnections();})};
}
