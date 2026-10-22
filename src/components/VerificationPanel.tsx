import React,{useEffect,useRef,useState} from 'react';
import type {WorkItem} from '../types';
import type {VerificationCriterionResult,VerificationEvidenceInput,VerificationPrincipal,VerificationSession,VerificationSessionList} from '../verificationTypes';

interface VerificationPanelProps {projectId:string;workItems:WorkItem[];onChanged?:(projectId:string,stateVersion:number)=>void;}
type EvidenceEditor=Omit<VerificationEvidenceInput,'sha256'>;
type FormState={workItemId:string;commitSha:string;buildRevision:string;environment:string;evidence:EvidenceEditor[];criterionResults:VerificationCriterionResult[]};
const blank=(item?:WorkItem):FormState=>({workItemId:item?.id??'',commitSha:'',buildRevision:'',environment:'local',evidence:[{id:'EV-1',kind:'MANUAL',encoding:'UTF8',content:''}],criterionResults:(item?.acceptanceCriteria??[]).map((_,criterionIndex)=>({criterionIndex,result:'NOT_RUN',notes:'',evidenceIds:[]}))});
const control='border border-slate-300 rounded px-3 py-2 w-full min-w-0 bg-white disabled:bg-slate-100';
const button='border rounded px-3 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';
function responsePrincipal(value:any):VerificationPrincipal|undefined {
 if(!value||typeof value.identityId!=='string'||typeof value.username!=='string'||typeof value.personId!=='string'||value.kind!=='HUMAN'||value.roleSource!=='LOCAL_SERVER_ROSTER'||value.personBindingSource!=='LOCAL_ROSTER_ASSERTION'||!Array.isArray(value.roles)||value.roles.some((role:any)=>typeof role!=='string'))return;
 return value;
}
const samePrincipal=(a:VerificationPrincipal,b:VerificationPrincipal)=>a.identityId===b.identityId&&a.personId===b.personId&&a.username===b.username&&JSON.stringify([...a.roles].sort())===JSON.stringify([...b.roles].sort());
class ResponseFailure extends Error {constructor(message:string,readonly status:number,readonly identity?:VerificationPrincipal){super(message);}}
async function read(response:Response) {
 const data=await response.json().catch(()=>{throw new Error('The server returned an unreadable response; reload sessions');});
 if(!response.ok)throw new ResponseFailure(data.error||`Verification request failed (${response.status})`,response.status,responsePrincipal(data.identity));return data;
}
async function requestJson(url:string,controller:AbortController,init:RequestInit={}) {
 let onAbort!:()=>void;
 const interrupted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new Error('Verification request interrupted'));controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
 try{return await Promise.race([fetch(url,{...init,credentials:'same-origin',signal:controller.signal}).then(read),interrupted]);}
 finally{controller.signal.removeEventListener('abort',onAbort);}
}
function byteDigest(content:string,encoding:'UTF8'|'BASE64') {
 const bytes=encoding==='BASE64'?Uint8Array.from(atob(content),c=>c.charCodeAt(0)):new TextEncoder().encode(content);
 return crypto.subtle.digest('SHA-256',bytes).then(hash=>Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join(''));
}

/** Project-scoped local human attestation UI. Shared ReviewerSession owns login. */
export function VerificationPanel({projectId,workItems,onChanged}:VerificationPanelProps) {
 const [loaded,setLoaded]=useState<{projectId:string;data:VerificationSessionList}|null>(null);
 const [loading,setLoading]=useState(true);const [pending,setPending]=useState(false);
 const [error,setError]=useState('');const [message,setMessage]=useState('');const [stale,setStale]=useState(false);
 const [form,setForm]=useState<FormState>(()=>blank(workItems[0]));const [editing,setEditing]=useState<string|null>(null);
 const [selectedId,setSelectedId]=useState('');const [attested,setAttested]=useState(false);
 const [detail,setDetail]=useState<{projectId:string;session:VerificationSession}|null>(null);
 const [decision,setDecision]=useState<'APPROVE'|'REJECT'|'REQUIRE_REMEDIATION'>('APPROVE');const [role,setRole]=useState('');const [reason,setReason]=useState('');const [reviewed,setReviewed]=useState(false);const [independent,setIndependent]=useState(false);
 const generation=useRef(0);const currentProject=useRef(projectId);currentProject.current=projectId;
 const controller=useRef<AbortController|null>(null);const busy=useRef(false);const mounted=useRef(true);
 const data=loaded?.projectId===projectId?loaded.data:null;
 const selected=detail?.projectId===projectId&&detail.session.id===selectedId?detail.session:undefined;
 const current=(token:number,id:string)=>mounted.current&&generation.current===token&&currentProject.current===id;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 function resetPersonal() {setAttested(false);setReviewed(false);setIndependent(false);setReason('');setDecision('APPROVE');}
 function clearSelection() {resetPersonal();setSelectedId('');setDetail(null);setEditing(null);setForm(blank(workItems[0]));}
 async function load() {
  const id=projectId;const token=++generation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;
  setLoading(true);setError('');setMessage('');setStale(true);busy.current=false;setPending(false);
  clearSelection();
  const timeout=setTimeout(()=>abort.abort(),20_000);
  try {
   const result=await requestJson(`/api/projects/${encodeURIComponent(id)}/verification-sessions`,abort);
   if(!Array.isArray(result.sessions)||!Array.isArray(result.reviews)||!Number.isSafeInteger(result.stateVersion)||!responsePrincipal(result.identity)||!Array.isArray(result.requiredRoles))throw new Error('Verification state is unavailable; reload sessions');
   if(!current(token,id))return;setLoaded({projectId:id,data:result});setStale(false);setRole(result.identity.roles.find((r:string)=>result.requiredRoles.includes(r))??'');
  }catch(cause){if(current(token,id)){setLoaded(null);setError(abort.signal.aborted?'Verification request timed out; reload sessions':cause instanceof Error?cause.message:'Unable to load verification sessions');}}
  finally{clearTimeout(timeout);if(current(token,id))setLoading(false);}
 }
 useEffect(()=>{setLoaded(null);setSelectedId('');setEditing(null);setForm(blank(workItems[0]));setAttested(false);setReviewed(false);setIndependent(false);void load();return()=>{generation.current++;controller.current?.abort();busy.current=false;};},[projectId]);
 // Work-item props may arrive after the project session list.
 useEffect(()=>{if(!form.workItemId&&workItems.length)setForm(blank(workItems[0]));},[workItems,form.workItemId]);
 const disabled=loading||pending||stale||!data;
 async function mutate(suffix:string,method:string,makeBody:()=>Promise<any>|any,success:string) {
  if(disabled||busy.current||!data)return;busy.current=true;setPending(true);setError('');setMessage('');
  const id=projectId;const token=generation.current;const abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),20_000);
  try {
   const input=await makeBody();if(!current(token,id))return;
   const result=await requestJson(`/api/projects/${encodeURIComponent(id)}/verification-sessions${suffix}`,abort,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,expectedStateVersion:data.stateVersion,expectedReviewer:{identityId:data.identity.identityId,personId:data.identity.personId}})});
   if(!current(token,id))return;
   const actual=responsePrincipal(result.identity);
   if(!result.session||result.session.projectId!==id||!Number.isSafeInteger(result.stateVersion)||result.stateVersion!==data.stateVersion+1||!actual)throw new Error('Verification response cannot be confirmed; reload sessions');
   const s=result.session as VerificationSession;const bound=s.submitted?.bundle??s.draft;
   const summary={id:s.id,projectId:s.projectId,workItemId:s.workItemId,author:s.author,createdAt:s.createdAt,updatedAt:s.updatedAt,status:s.status,commitSha:bound.commitSha,buildRevision:bound.buildRevision,environment:bound.environment,criterionCount:s.acceptanceCriteria.length,evidenceCount:bound.evidence.length,retainedBytes:result.retainedBytes??0,...(s.submitted?{submittedDigest:s.submitted.digest}:{})};
   setLoaded(previous=>previous?.projectId===id?{projectId:id,data:{...previous.data,identity:actual,stateVersion:result.stateVersion,sessions:[...previous.data.sessions.filter(s=>s.id!==result.session.id),summary],reviews:[...previous.data.reviews.filter(r=>r.sessionId!==result.session.id),result.review]}}:previous);
   setSelectedId(s.id);setDetail({projectId:id,session:s});setEditing(null);resetPersonal();
   if(!samePrincipal(data.identity,actual)){setStale(true);setMessage(`Operation recorded as ${actual.username}. Reviewer identity changed; reload and review again before any further personal confirmation.`);}else setMessage(success);
   onChanged?.(id,result.stateVersion);
  }catch(cause){if(current(token,id)){setError(abort.signal.aborted?'The request outcome is unknown; reload sessions before retrying':cause instanceof Error?cause.message:'Verification request failed');if(cause instanceof ResponseFailure&&cause.identity){const actual=cause.identity;setLoaded(previous=>previous?.projectId===id?{projectId:id,data:{...previous.data,identity:actual}}:previous);clearSelection();}if(!(cause instanceof ResponseFailure)||[401,403,409,500,503].includes(cause.status))setStale(true);}}
  finally{clearTimeout(timeout);if(current(token,id)){busy.current=false;setPending(false);}}
 }
 async function chooseSession(sessionId:string,forEditing=false) {
  if(disabled||busy.current||!data)return;const id=projectId,token=++generation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setLoading(true);setError('');setMessage('');clearSelection();const timeout=setTimeout(()=>abort.abort(),20_000);
  try{const result=await requestJson(`/api/projects/${encodeURIComponent(id)}/verification-sessions/${encodeURIComponent(sessionId)}`,abort);if(!current(token,id))return;const actual=responsePrincipal(result.identity);if(!actual||!result.session||result.session.projectId!==id||result.session.id!==sessionId||!Number.isSafeInteger(result.stateVersion))throw new Error('Selected verification detail is unavailable; reload sessions');
   setLoaded(previous=>previous?.projectId===id?{projectId:id,data:{...previous.data,identity:actual,stateVersion:result.stateVersion}}:previous);resetPersonal();setSelectedId(sessionId);setDetail({projectId:id,session:result.session});setRole(actual.roles.find(r=>data.requiredRoles.includes(r))??'');
   if(forEditing&&result.session.author.identityId===actual.identityId&&result.session.author.personId===actual.personId&&result.session.status==='DRAFT'){setEditing(sessionId);setForm({workItemId:result.session.workItemId,...result.session.draft,evidence:result.session.draft.evidence.map(({byteLength,provenance,sha256,...input})=>input)});}
  }catch(cause){if(current(token,id)){setError(abort.signal.aborted?'Selected verification detail timed out; reload sessions':cause instanceof Error?cause.message:'Selected verification detail failed');setStale(true);}}
  finally{clearTimeout(timeout);if(current(token,id))setLoading(false);}
 }
 async function save(event:React.FormEvent) {
  event.preventDefault();await mutate(editing?`/${encodeURIComponent(editing)}`:'',editing?'PATCH':'POST',async()=>{
   const evidence=await Promise.all(form.evidence.map(async e=>({...e,sha256:await byteDigest(e.content,e.encoding)})));
   const input={...form,evidence};if(editing){const {workItemId,...update}=input;return update;}return input;
  },editing?'Draft changes saved.':'Verification draft created.');
 }
 const selectedItem=workItems.find(w=>w.id===form.workItemId);
 const self=!!(selected&&data&&(selected.author.personId===data.identity.personId||selected.author.identityId===data.identity.identityId));
 const alreadyReviewed=!!selected?.decisions.some(d=>d.reviewer.personId===data?.identity.personId);
 const selectedReview=data?.reviews.find(r=>r.sessionId===selected?.id);
 const display=selected?.submitted?.bundle??selected?.draft;
 return <section aria-label="Verification sessions" className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 min-w-0 text-sm">
  <div className="flex flex-wrap justify-between items-start gap-3"><div><h2 className="text-lg font-bold text-slate-900">Verification sessions</h2><p className="text-xs text-slate-600">Review bounded evidence for an exact task, commit, build and environment.</p></div><button className={button} disabled={pending} onClick={()=>void load()}>Reload sessions</button></div>
  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded">Local roster assertions and human attestations only. Separate roster accounts do not prove separate people. Review approval does not verify a trusted production producer, change task status, or authorize release.</p>
  {loading&&<p role="status">Loading verification sessions...</p>}
  {pending&&<p role="status">Saving verification operation...</p>}
  {error&&<div role="alert" className="text-rose-800 bg-rose-50 p-3 rounded break-words">{error}{stale&&<p>Reload sessions before another mutation. Sign in through the reviewer session if required; the operator must configure a person binding for verification.</p>}</div>}
  {message&&<p role="status" className="text-emerald-800">{message}</p>}
  {data&&<>
   <p className="text-xs text-slate-500">Authenticated reviewer: {data.identity.username}. Person binding: LOCAL_ROSTER_ASSERTION. Project version: {data.stateVersion}.</p>
   {!!data.archives?.length&&<p className="text-xs text-amber-900">Imported verification history: {data.archives.reduce((total,archive)=>total+archive.sessionCount,0)} sessions in {data.archives.length} batches (UNTRUSTED_IMPORTED_HISTORY). Historical reviews do not authorize active verification.</p>}
   {data.sessions.length===0&&<p>No verification sessions for this project.</p>}
   <ul className="space-y-2">{data.sessions.map(session=><li key={session.id} className="border rounded p-3 flex flex-wrap gap-2 items-center"><button className="font-mono text-blue-700 break-all text-left" disabled={disabled} onClick={()=>void chooseSession(session.id)}>{session.id}</button><span className="text-xs text-slate-600">{session.workItemId}</span><strong>{session.status}</strong><span className="text-xs">{session.evidenceCount} evidence records; detail loads on selection.</span>{session.status==='DRAFT'&&session.author.identityId===data.identity.identityId&&<button className={button} disabled={disabled} onClick={()=>void chooseSession(session.id,true)}>Edit draft</button>}</li>)}</ul>
   <form onSubmit={save} className="space-y-3 border-t pt-4">
    <h3 className="font-bold">{editing?'Edit verification draft':'Create verification draft'}</h3>
    {!workItems.length&&<p>No work items are available for verification.</p>}
    <fieldset disabled={disabled||!workItems.length} className="space-y-3 min-w-0">
     <label className="block">Work item<select aria-label="Verification work item" required className={control} disabled={!!editing} value={form.workItemId} onChange={event=>{setForm(blank(workItems.find(w=>w.id===event.target.value)));}}>{workItems.map(item=><option key={item.id} value={item.id}>{item.id} — {item.title}</option>)}</select></label>
     <div className="grid sm:grid-cols-3 gap-3"><label>Commit SHA<input aria-label="Commit SHA" required pattern="([a-f0-9]{40}|[a-f0-9]{64})" maxLength={64} className={control} value={form.commitSha} onChange={e=>setForm({...form,commitSha:e.target.value})}/></label><label>Build revision<input aria-label="Build revision" required maxLength={160} className={control} value={form.buildRevision} onChange={e=>setForm({...form,buildRevision:e.target.value})}/></label><label>Environment<input aria-label="Verification environment" required maxLength={160} className={control} value={form.environment} onChange={e=>setForm({...form,environment:e.target.value})}/></label></div>
     <p className="text-xs text-slate-500">Build and environment are explicit human assertions. No commands, filesystem paths or external references are fetched.</p>
     {form.evidence.map((evidence,index)=><div key={index} className="border rounded p-3 space-y-2 min-w-0">
      <label>Evidence {index+1} type<select aria-label={`Evidence type ${index+1}`} className={control} value={evidence.kind} onChange={event=>{const kind=event.target.value as EvidenceEditor['kind'];setForm({...form,evidence:form.evidence.map((e,i)=>i===index?{...e,kind,encoding:kind==='SCREENSHOT'?'BASE64':'UTF8',content:''}:e)});}}><option value="MANUAL">Manual observation</option><option value="LOG">Inline log</option><option value="SCREENSHOT">Inline screenshot (PNG/JPEG)</option><option value="REFERENCE">Unverified reference (display only)</option></select></label>
      {evidence.kind==='SCREENSHOT'?<label>Screenshot file<input aria-label={`Evidence screenshot ${index+1}`} type="file" accept="image/png,image/jpeg" className={control} onChange={async event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>131072){setError('Screenshot must be at most 128 KiB');return;}const id=projectId,token=generation.current;const bytes=new Uint8Array(await file.arrayBuffer());if(!current(token,id))return;let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);setForm(previous=>({...previous,evidence:previous.evidence.map((e,i)=>i===index?{...e,content:btoa(binary)}:e)}));}}/>{evidence.content&&<span className="text-xs">Inline image bytes ready for hashing.</span>}</label>:<label>{evidence.kind==='REFERENCE'?'Unverified reference text':'Evidence content'}<textarea aria-label={`Evidence content ${index+1}`} required maxLength={evidence.kind==='REFERENCE'?2048:65536} rows={3} className={control} value={evidence.content} onChange={event=>setForm({...form,evidence:form.evidence.map((e,i)=>i===index?{...e,content:event.target.value}:e)})}/></label>}
      <p className="text-xs text-slate-500">{evidence.kind==='REFERENCE'?'UNVERIFIED_REFERENCE: reference text is hashed; target content is never read and cannot satisfy a passing criterion.':'HUMAN_ATTESTED_INLINE: exact submitted bytes receive a server-checked SHA-256.'}</p>
      <button type="button" className={button} disabled={form.evidence.length<=1} onClick={()=>setForm({...form,evidence:form.evidence.filter((_,i)=>i!==index),criterionResults:form.criterionResults.map(r=>({...r,evidenceIds:r.evidenceIds.filter(id=>id!==evidence.id)}))})}>Remove evidence {index+1}</button>
     </div>)}
     <button className={button} type="button" disabled={form.evidence.length>=8} onClick={()=>setForm({...form,evidence:[...form.evidence,{id:`EV-${crypto.randomUUID()}`,kind:'LOG',encoding:'UTF8',content:''}]})}>Add evidence</button>
     {form.criterionResults.map((result,index)=><div key={index} className="border rounded p-3 space-y-2"><p className="font-semibold">Criterion {index+1}: {selectedItem?.acceptanceCriteria[index]??'Criteria changed; reload this task'}</p><label>Result<select aria-label={`Criterion ${index+1} result`} className={control} value={result.result} onChange={event=>setForm({...form,criterionResults:form.criterionResults.map((r,i)=>i===index?{...r,result:event.target.value as VerificationCriterionResult['result']}:r)})}><option value="NOT_RUN">Not run</option><option value="PASS">Pass</option><option value="FAIL">Fail</option></select></label><label>Observation<textarea aria-label={`Criterion ${index+1} notes`} maxLength={4000} className={control} value={result.notes} onChange={event=>setForm({...form,criterionResults:form.criterionResults.map((r,i)=>i===index?{...r,notes:event.target.value}:r)})}/></label><div className="flex gap-3 flex-wrap">{form.evidence.map((e,ei)=><label key={e.id} className="flex items-center gap-2"><input type="checkbox" aria-label={`Criterion ${index+1} uses evidence ${ei+1}`} checked={result.evidenceIds.includes(e.id)} onChange={event=>setForm({...form,criterionResults:form.criterionResults.map((r,i)=>i===index?{...r,evidenceIds:event.target.checked?[...r.evidenceIds,e.id]:r.evidenceIds.filter(id=>id!==e.id)}:r)})}/>Evidence {ei+1}</label>)}</div></div>)}
     {!selectedItem?.acceptanceCriteria.length&&<p>This task has no acceptance criteria; add criteria before creating a session.</p>}
     <div className="flex gap-2 flex-wrap"><button className={button} type="submit" disabled={!selectedItem?.acceptanceCriteria.length}>{editing?'Save draft changes':'Create verification draft'}</button>{editing&&<button className={button} type="button" onClick={()=>{setEditing(null);setForm(blank(workItems[0]));}}>Start new session</button>}</div>
    </fieldset>
   </form>
   {selected&&display&&<article className="space-y-3 border-t pt-4 min-w-0">
    <h3 className="font-bold">Selected session: <span className="font-mono break-all">{selected.id}</span></h3>
    <dl className="text-xs space-y-2"><div><dt>Author</dt><dd>{selected.author.username} (LOCAL_ROSTER_ASSERTION)</dd></div><div><dt>Commit</dt><dd className="font-mono break-all">{display.commitSha}</dd></div><div><dt>Build / environment</dt><dd className="break-words">{display.buildRevision} / {display.environment}</dd></div>{selected.submitted&&<div><dt>Exact immutable submitted SHA-256</dt><dd className="font-mono break-all">{selected.submitted.digest}</dd></div>}</dl>
    <p className="text-xs">{selectedReview?.reason}</p>
    <ul className="space-y-2">{display.criterionResults.map(result=><li key={result.criterionIndex} className="border rounded p-3 break-words"><strong>Criterion {result.criterionIndex+1}: {result.result}</strong><p>{selected.acceptanceCriteria[result.criterionIndex]}</p><p className="whitespace-pre-wrap">{result.notes}</p><p className="text-xs">Evidence: {result.evidenceIds.join(', ')||'None'}</p></li>)}</ul>
    {display.evidence.map(evidence=><details key={evidence.id} className="border rounded p-3 min-w-0"><summary className="cursor-pointer break-words">{evidence.id} — {evidence.kind} — {evidence.provenance}</summary><p className="font-mono text-xs break-all">SHA-256: {evidence.sha256}</p>{evidence.kind==='SCREENSHOT'?<p>{evidence.byteLength} inline PNG/JPEG bytes.</p>:<pre className="whitespace-pre-wrap break-words text-xs max-h-64 overflow-auto">{evidence.content}</pre>}</details>)}
    {selected.decisions.map(d=><p key={d.id} className="text-xs break-words">{d.reviewer.username} — {d.role}: {d.decision}. {d.reason}</p>)}
    {selected.status==='DRAFT'&&self&&<div className="space-y-2"><label className="flex gap-2 items-start"><input type="checkbox" disabled={disabled} checked={attested} onChange={e=>setAttested(e.target.checked)}/>I attest this submitted evidence was observed by me</label><button className={button} disabled={disabled||!attested||!!editing} onClick={()=>void mutate(`/${encodeURIComponent(selected.id)}/submit`,'POST',()=>({humanAttested:true}),'Immutable bundle submitted for independent review.')}>Submit immutable bundle</button>{editing&&<p>Save draft changes before submitting.</p>}</div>}
    {selected.status==='SUBMITTED'&&self&&<p className="text-amber-800">The author cannot review their own evidence. Two other distinct roster persons must supply the Security Officer and Lead Architect decisions.</p>}
    {selected.status==='SUBMITTED'&&!self&&!alreadyReviewed&&<form className="space-y-3" onSubmit={event=>{event.preventDefault();const bundle=selected.submitted!.bundle;void mutate(`/${encodeURIComponent(selected.id)}/decisions`,'POST',()=>({submittedDigest:selected.submitted!.digest,commitSha:bundle.commitSha,buildRevision:bundle.buildRevision,environment:bundle.environment,decision,reason,role,humanAttested:reviewed,independenceAttested:independent}),'Human review decision recorded.');}}>
     <fieldset disabled={disabled} className="space-y-3"><label>Review role<select aria-label="Review role" className={control} required value={role} onChange={e=>setRole(e.target.value)}>{data.requiredRoles.filter(r=>data.identity.roles.includes(r)).map(r=><option key={r}>{r}</option>)}</select></label><label>Decision<select aria-label="Review decision" className={control} value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="APPROVE">Approve local evidence review</option><option value="REJECT">Reject</option><option value="REQUIRE_REMEDIATION">Require remediation</option></select></label><label>Reason<textarea aria-label="Review reason" className={control} required={decision!=='APPROVE'} maxLength={4000} value={reason} onChange={e=>setReason(e.target.value)}/></label><label className="flex gap-2 items-start"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed this exact submitted digest</label><label className="flex gap-2 items-start"><input type="checkbox" checked={independent} onChange={e=>setIndependent(e.target.checked)}/>I attest I am a different person from the author and other reviewers</label><button className={button} type="submit" disabled={!reviewed||!independent||!role}>Record review decision</button></fieldset>
    </form>}
    {['APPROVED','REJECTED','REMEDIATION_REQUIRED'].includes(selected.status)&&<p className="text-xs">This review is closed. Evidence changes require a new verification session and fresh review.</p>}
   </article>}
  </>}
 </section>;
}
