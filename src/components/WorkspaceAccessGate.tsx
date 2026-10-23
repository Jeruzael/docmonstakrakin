import React,{useEffect,useRef,useState}from'react';
import App from '../App';
import {createWorkspaceTransport,type WorkspaceAccessState}from'../data/workspaceTransport';
const initial:WorkspaceAccessState={phase:'checking',mode:'ENFORCED',setupRequired:false,identity:null,epoch:0};

/** Project UI is mounted only after the server confirms its access mode/session. */
export function WorkspaceAccessGate(){
 const[state,setState]=useState(initial),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');
 const check=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('dmk-workspace-session'):null;
  const original=window.fetch.bind(window),transport=createWorkspaceTransport(original,window.location.origin,setState,()=>channel?.postMessage({type:'SESSION_CHANGED',version:1}));
  if(channel)channel.onmessage=event=>{if(event.data?.type==='SESSION_CHANGED'&&event.data?.version===1){transport.invalidateSession();setPassword('');setError('Another tab changed the session. Recheck the session before continuing.');}};
  window.fetch=transport.fetch;
  check.current=async()=>{setError('');try{await transport.fetch('/api/governance/session',{signal:AbortSignal.timeout(20_000),credentials:'same-origin'});}catch{setError('The session could not be confirmed. Recheck before continuing.');}};
  void check.current();
  return()=>{channel?.close();transport.dispose();if(window.fetch===transport.fetch)window.fetch=original;};
 },[]);
 const signIn=async(event:React.FormEvent)=>{
  event.preventDefault();const secret=password;setPassword('');setError('');
  try{const response=await fetch('/api/governance/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:secret}),signal:AbortSignal.timeout(20_000)});if(!response.ok)setError(response.status===429?'Too many attempts. Wait before retrying.':'Sign-in could not be confirmed. Check your workspace credentials.');}catch{setError('Sign-in outcome is unknown. Recheck the session before another attempt.');}
 };
 const visible=state.phase==='authenticated',keepApp=visible||(state.phase==='transition'&&state.identity!==null);
 return <>{keepApp&&<div hidden={!visible} aria-hidden={!visible}><App key={state.epoch}/></div>}{!visible&&<main className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm" aria-label="Workspace access">
  <h1 className="text-2xl font-bold text-slate-900">docmonstakrakin workspace</h1>
  <p className="mt-3 text-sm text-slate-600">Project access requires your configured workspace identity. Human review roles remain separate from project ownership.</p>
  {state.phase==='checking'||state.phase==='transition'?<p role="status" className="mt-5">Confirming workspace session…</p>:state.setupRequired?<div className="mt-5 text-sm"><h2 className="font-semibold">Private workspace setup required</h2><p className="mt-2">The operator must initialize the private authority from a local terminal using the workspace security tool. There are no default accounts. Keep credentials out of chat and source control.</p><code className="block mt-3">npm run security:workspace -- help</code></div>:<form onSubmit={signIn} className="mt-5 space-y-3">
   <label className="block text-sm">Workspace account<input className="mt-1 w-full rounded border p-2" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" maxLength={128} required/></label>
   <label className="block text-sm">Password<input type="password" className="mt-1 w-full rounded border p-2" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" maxLength={1024} required/></label>
   <button className="rounded bg-emerald-700 px-4 py-2 text-white" type="submit">Sign in</button>
  </form>}
  {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
  <button disabled={state.phase==='transition'} className="mt-4 text-sm text-emerald-800 underline disabled:opacity-40" onClick={()=>void check.current()}>Recheck session</button>
  <p className="mt-5 text-xs text-slate-500">Loopback workspace only. Privileged administration, live agents and release promotion remain unavailable.</p>
 </section></main>}</>;
}
