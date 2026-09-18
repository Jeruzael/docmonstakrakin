import React, {useState} from 'react';
export function RequestSignoff({projectId,targetEntityId,targetEntityType,requestedBy}:{projectId:string;targetEntityId:string;targetEntityType:string;requestedBy:string}) {
  const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  async function request() { setBusy(true); try { const res=await fetch(`/api/projects/${projectId}/approvals`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetEntityId,targetEntityType,requestedBy})}); const data=await res.json(); if(!res.ok) throw new Error(data.error?.message || data.error);setMessage(`Request ${data.id} is in Approval Inbox.`); } catch(e){setMessage((e as Error).message);}finally{setBusy(false);} }
  return <div className="text-xs"><button disabled={busy} onClick={request} className="border rounded px-3 py-2 font-semibold">REQUEST SIGN-OFF</button>{message && <p role="status">{message}</p>}</div>;
}
