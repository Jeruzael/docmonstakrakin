export type WorkspaceAccessState={phase:'checking'|'authenticated'|'anonymous'|'transition'|'unknown';mode:'ENFORCED'|'LOCAL_DEVELOPMENT';setupRequired:boolean;identity:{id:string;name:string;roles:string[]}|null;epoch:number};
let currentMode:'ENFORCED'|'LOCAL_DEVELOPMENT'='LOCAL_DEVELOPMENT';
export const observedWorkspaceMode=()=>currentMode;
const empty=():WorkspaceAccessState=>({phase:'checking',mode:'ENFORCED',setupRequired:false,identity:null,epoch:0});
/** Per-page memory only. Never persist session or CSRF material in browser storage. */
export function createWorkspaceTransport(request:typeof fetch,origin:string,publish:(state:WorkspaceAccessState)=>void,onSessionChange?:()=>void){
 let state=empty(),csrf:string|null=null,disposed=false,sequence=0,transition=false;
 let active=0;
 const waiting:{grant:()=>void;cancel:(error:Error)=>void}[]=[];
 const releaseLease=()=>{let released=false;return()=>{if(released)return;released=true;active--;waiting.shift()?.grant();};};
 const acquire=(signal?:AbortSignal|null):Promise<()=>void>=>{
  if(disposed||signal?.aborted)return Promise.reject(Error('Workspace request cancelled.'));
  if(active<2){active++;return Promise.resolve(releaseLease());}
  if(waiting.length>=64)return Promise.reject(Error('Workspace request queue is full.'));
  return new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);const index=waiting.indexOf(entry);if(index>=0)waiting.splice(index,1);};
   const entry={grant:()=>{cleanup();active++;resolve(releaseLease());},cancel:(error:Error)=>{cleanup();reject(error);}};
   const abort=()=>entry.cancel(Error('Workspace request cancelled.'));
   const timer=setTimeout(()=>entry.cancel(Error('Workspace request admission timed out.')),20_000);
   waiting.push(entry);signal?.addEventListener('abort',abort,{once:true});
  });
 };
 const update=(next:WorkspaceAccessState)=>{state=next;currentMode=next.mode;if(!disposed)publish({...next,identity:next.identity?{...next.identity,roles:[...next.identity.roles]}:null});};
 const invalidate=(phase:'anonymous'|'unknown')=>{csrf=null;update({...state,phase,identity:null,epoch:state.epoch+1});};
 const wrapped:typeof fetch=async(input,init:RequestInit={})=>{
  const raw=input instanceof Request?input.url:String(input);const url=new URL(raw,origin);
  const localApi=url.origin===origin&&/^\/api(?:\/|$)/i.test(url.pathname);
  const session=localApi&&/^\/api\/governance\/session(?:\/|$)/i.test(url.pathname);
  const method=(init.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  const changing=!['GET','HEAD','OPTIONS'].includes(method);const sessionChange=session&&changing;
  if(session&&transition)throw Error('A session change is pending; recheck after its outcome is confirmed.');
  if(localApi&&!session&&transition)throw new Error('Session transition is pending; reload after the session outcome is confirmed.');
  const privateRequest=localApi&&!session&&state.mode==='ENFORCED';const epoch=state.epoch;
  if(privateRequest&&state.phase!=='authenticated')throw Error('Confirm the workspace session before accessing project data.');
  const release=privateRequest?await acquire(init.signal??(input instanceof Request?input.signal:undefined)):()=>{};
  try{
  if(privateRequest&&(disposed||transition||state.epoch!==epoch||state.phase!=='authenticated'))throw Error('Workspace identity changed while the request was waiting.');
  const headers=new Headers(input instanceof Request?input.headers:undefined);new Headers(init.headers).forEach((v,k)=>headers.set(k,v));
  if(localApi&&state.mode==='ENFORCED'){
   const auditedExport=/\/package\/export\/?$/i.test(url.pathname)&&['GET','HEAD'].includes(method);
   if(changing||auditedExport){if(csrf)headers.set('X-DMK-CSRF',csrf);else headers.delete('X-DMK-CSRF');if(!session&&!headers.has('X-DMK-Request-ID'))headers.set('X-DMK-Request-ID',crypto.randomUUID());}
  }
  const mySequence=session?++sequence:sequence;
  if(sessionChange&&state.mode==='ENFORCED'){transition=true;update({...state,phase:'transition'});}
  try{
   const response=await request(input,{...init,headers});
   if(disposed)return response;
   // Once explicitly admitted, legacy demo review responses retain their own
   // historical contract; they cannot establish operational authority.
   if(state.mode==='LOCAL_DEVELOPMENT')return response;
   if(session&&mySequence===sequence){
    if(!response.ok){transition=false;invalidate(response.status===401?'anonymous':'unknown');return response;}
    try{
     const body=await response.clone().json();
     // Header arrival does not complete a session observation. A newer login,
     // logout or invalidation may occur while its body is still being decoded.
     if(disposed||mySequence!==sequence||state.epoch!==epoch)return response;
     transition=false;const access=body?.access;
     if(access?.mode==='LOCAL_DEVELOPMENT'){
      csrf=null;update({...state,mode:'LOCAL_DEVELOPMENT',phase:'authenticated',setupRequired:false,identity:null});return response;
     }
     if(access?.mode!=='ENFORCED'||typeof access.setupRequired!=='boolean'||!Object.hasOwn(body,'identity'))throw Error('Invalid session boundary');
     if(body.identity===null){csrf=null;update({...state,mode:'ENFORCED',phase:'anonymous',setupRequired:access.setupRequired,identity:null,epoch:state.epoch+1});return response;}
     const identity=body.identity;
     if(typeof identity.id!=='string'||!identity.id||typeof identity.name!=='string'||!identity.name||!Array.isArray(identity.roles)||identity.roles.some((r:unknown)=>typeof r!=='string')||typeof body.csrf!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.csrf))throw Error('Invalid authenticated session');
     const changedProof=csrf!==body.csrf;csrf=body.csrf;update({phase:'authenticated',mode:'ENFORCED',setupRequired:access.setupRequired,identity:{id:identity.id,name:identity.name,roles:[...identity.roles]},epoch:state.epoch+(sessionChange||changedProof||identity.id!==state.identity?.id?1:0)});
    }catch{if(!disposed&&mySequence===sequence&&state.epoch===epoch){transition=false;invalidate('unknown');}}
   }else if(!session&&localApi&&state.mode==='ENFORCED'&&response.status===401&&state.epoch===epoch&&!transition)invalidate('anonymous');
   return response;
  }catch(error){if(!disposed&&state.mode==='ENFORCED'&&session&&mySequence===sequence&&state.epoch===epoch){transition=false;invalidate('unknown');}throw error;}
  }finally{release();if(sessionChange&&state.mode==='ENFORCED'){try{onSessionChange?.();}catch{/* notification never grants authority */}}}
 };
 return{fetch:wrapped,invalidateSession(){if(!disposed&&state.mode==='ENFORCED'){sequence++;transition=false;invalidate('unknown');}},dispose(){disposed=true;csrf=null;transition=false;sequence++;for(const entry of [...waiting])entry.cancel(Error('Workspace request cancelled.'));}};
}
