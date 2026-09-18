import React, {useEffect,useState} from 'react';

export function ReviewerSession() {
  const [identity,setIdentity]=useState<{name:string;roles:string[]}|null>(null);
  const [username,setUsername]=useState('');const [password,setPassword]=useState('');
  const [error,setError]=useState('');const [open,setOpen]=useState(false);
  useEffect(()=>{fetch('/api/governance/session').then(r=>r.json()).then(d=>setIdentity(d.identity)).catch(()=>{});},[]);
  async function signIn(e:React.FormEvent) {
    e.preventDefault();setError('');
    try {const r=await fetch('/api/governance/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const d=await r.json();if(!r.ok)throw new Error(d.error);setIdentity(d.identity);setOpen(false);}
    catch(e){setError((e as Error).message);}finally{setPassword('');}
  }
  async function signOut(){await fetch('/api/governance/session',{method:'DELETE'});setIdentity(null);setPassword('');}
  return <div className="px-6 py-2 border-b bg-white text-xs">
    {identity ? <span>Reviewer: <strong>{identity.name}</strong> · {identity.roles.join(', ')} <button className="underline ml-3" onClick={signOut}>Sign out</button></span> : <button className="underline" onClick={()=>setOpen(!open)}>Sign in for governance review</button>}
    {open && <form onSubmit={signIn} className="flex flex-wrap gap-2 mt-2"><input aria-label="Reviewer username" placeholder="Reviewer username" required value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" className="border p-2 rounded"/><input aria-label="Reviewer password" placeholder="Password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" className="border p-2 rounded"/><button className="border p-2 rounded" type="submit">Sign in</button></form>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
