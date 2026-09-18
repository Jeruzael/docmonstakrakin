import React, {useEffect, useState} from 'react';
import type {ImportSession} from '../proposalTypes';

export function ImportReviewView({projectId,onImported,onNavigate}:{projectId:string;onImported:()=>void;onNavigate:(view:string)=>void}) {
  const [raw,setRaw] = useState('');
  const [provider,setProvider] = useState(''); const [model,setModel] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [sessions,setSessions] = useState<ImportSession[]>([]); const [selected,setSelected] = useState('');
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const [editing,setEditing] = useState<number|null>(null); const [edited,setEdited] = useState('');
  const active = sessions.find(s=>s.id === selected);
  async function load() { const r = await fetch(`/api/projects/${projectId}/import-sessions`); if (!r.ok) throw new Error('Cannot load review history'); setSessions(await r.json()); }
  useEffect(()=>{load().catch(e=>setError(e.message));},[projectId]);
  async function send(path:string,body:any) {
    setBusy(true);setError('');
    try {const r = await fetch(`/api/projects/${projectId}/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const result = await r.json(); if(!r.ok) throw new Error(result.error?.message || result.error || 'Request failed'); await load(); setSelected(result.id); return result;}
    catch(e) {setError((e as Error).message);return null;} finally {setBusy(false);}
  }
  async function review(index:number,disposition:string) {
    let modified;
    try {if(disposition === 'MODIFIED') modified = JSON.parse(edited);} catch {setError('Modified content must be valid JSON');return;}
    const result = await send(`import-sessions/${active!.id}/changes/${index}/review`,{disposition,humanConfirmed:confirmed,modified});
    if(result) {setEditing(null);onImported();}
  }
  const button = 'border rounded px-3 py-2 text-xs font-semibold disabled:opacity-40';
  return <div className="space-y-5 text-sm">
    <p className="p-4 bg-blue-50 rounded">External JSON → Parse → Schema validation → Semantic validation → Assumptions → Human review → Proposed canonical artifacts → Traceability and audit. Validation alone creates no canonical artifacts or governance signatures.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      <section className="p-4 bg-white border rounded space-y-3">
        <h2 className="font-bold">Stage external proposal JSON</h2>
        <input aria-label="Source provider" placeholder="Provider (optional)" value={provider} onChange={e=>setProvider(e.target.value)} className="border p-2 rounded w-full"/>
        <input aria-label="Source model" placeholder="Model (optional)" value={model} onChange={e=>setModel(e.target.value)} className="border p-2 rounded w-full"/>
        <textarea aria-label="External proposal JSON" rows={12} value={raw} onChange={e=>setRaw(e.target.value)} className="font-mono text-xs border rounded p-3 w-full"/>
        <button className={button} disabled={busy || !raw.trim()} onClick={()=>send('import-sessions',{rawJson:raw,provider,model})}>Validate & Open Review Session</button>
      </section>
      <section className="p-4 bg-white border rounded space-y-3">
        <h2 className="font-bold">Import review history</h2>
        {!sessions.length && <p>No review sessions yet.</p>}
        {sessions.map(s=><button key={s.id} className={`${button} block w-full text-left ${selected===s.id?'bg-emerald-50':''}`} onClick={()=>{setSelected(s.id);setEditing(null);}}>{s.id}<br/>{s.provider} / {s.model} · {s.timestamp}<br/>{s.validationStatus}</button>)}
      </section>
    </div>
    {active && <section className="bg-white border rounded p-4 space-y-4">
      <h2 className="font-bold">Review Session {active.id}</h2>
      <p>{active.provider} / {active.model} · {active.validationStatus}</p>
      <p className="font-mono text-xs break-all">Original JSON SHA-256: {active.digest}</p>
      <p>Proposed: {active.changes.length} · {['ACCEPTED','MODIFIED','REJECTED','PENDING'].map(d=>`${d}: ${active.changes.filter(c=>c.disposition===d).length}`).join(' · ')}</p>
      <div><strong>Assumptions requiring review</strong>{active.assumptions.length ? active.assumptions.map((a,i)=><p key={i}>{a}</p>) : <p>No explicit or heuristic assumptions detected. Review all content for unsupported claims.</p>}</div>
      <p>Review uses the human identity signed in at the top of the app.</p>
      <label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I am the human reviewer and have reviewed the assumptions and proposed changes.</label>
      {active.changes.map((c,i)=><article key={c.original.id} className="border rounded p-4 space-y-2">
        <h3 className="font-semibold">{c.original.type}: {c.original.title}</h3><p>{c.original.details}</p>
        <p>{c.disposition} {c.reviewer && `by ${c.reviewer}`} · Imported IDs: {c.artifactIds.join(', ') || 'None'}</p>
        {c.modified && <details><summary>Original and reviewer-modified content</summary><pre className="whitespace-pre-wrap text-xs">{JSON.stringify({original:c.original,modified:c.modified},null,2)}</pre></details>}
        {c.disposition === 'PENDING' && <div className="flex gap-2 flex-wrap">
          <button className={button} disabled={busy||!confirmed} onClick={()=>review(i,'ACCEPTED')}>ACCEPT AS PROPOSED</button>
          <button className={button} disabled={busy} onClick={()=>{setEditing(i);setEdited(JSON.stringify({title:c.original.title,details:c.original.details,acceptanceCriteria:c.original.acceptanceCriteria||[]},null,2));}}>MODIFY</button>
          <button className={button} disabled={busy||!confirmed} onClick={()=>review(i,'REJECTED')}>REJECT</button>
        </div>}
        {editing===i && <div><textarea aria-label="Modified proposal content" className="border rounded p-3 w-full font-mono text-xs" rows={8} value={edited} onChange={e=>setEdited(e.target.value)}/><button className={button} disabled={busy||!confirmed} onClick={()=>review(i,'MODIFIED')}>Import Modified Content as Proposed</button></div>}
      </article>)}
      <div className="flex flex-wrap gap-3">{[['REQUIREMENT','requirements','Imported Requirements'],['ADR','architecture','Proposed ADRs'],['WORK_ITEM','work','Work Items'],['CODE_MODIFICATION','work','Implementation Proposals'],['RISK','risk','Proposed Risks']].map(([type,view,label])=>{const count=active.changes.filter(c=>c.original.type===type).reduce((n,c)=>n+c.artifactIds.length,0); return count ? <button key={type} className={button} onClick={()=>onNavigate(view)}>View {count} {label}</button>:null;})}<button className={button} onClick={()=>onNavigate('evidence')}>Open Import Audit Record</button></div>
    </section>}
  </div>;
}
