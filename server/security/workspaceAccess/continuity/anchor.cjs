'use strict';
const crypto=require('node:crypto');
const C=require('./contracts.cjs');
function trustKey(trust){
  C.exact(trust,['lineageId','keyId','publicKeyPem','domain','revokedKeyIds']);
  if(!C.UUID.test(trust.lineageId)||!C.SHA.test(trust.keyId)||!['SYNTHETIC','OPERATIONAL'].includes(trust.domain)||typeof trust.publicKeyPem!=='string'||Buffer.byteLength(trust.publicKeyPem)>4096||
    !Array.isArray(trust.revokedKeyIds)||trust.revokedKeyIds.length>32||trust.revokedKeyIds.some(k=>!C.SHA.test(k))||trust.revokedKeyIds.includes(trust.keyId))C.fail('CONTINUITY_TRUST_UNAVAILABLE');
  const key=crypto.createPublicKey(trust.publicKeyPem);
  if(key.asymmetricKeyType!=='ed25519'||C.sha(key.export({type:'spki',format:'der'}))!==trust.keyId)C.fail('CONTINUITY_TRUST_UNAVAILABLE');
  return key;
}
function verifyReceipt(receipt,trust,nonce,{historical=false}={}){
  try{
    const key=trustKey(trust);
    C.exact(receipt,['payload','signature']);const p=receipt.payload;
    if(Buffer.byteLength(C.canonical(receipt))>16384||typeof receipt.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(receipt.signature))C.fail('CONTINUITY_ANCHOR_INVALID');
    C.exact(p,['schema','domain','lineageId','keyId','nonce','issuedAt','expiresAt','state','resolution']);
    if(p.schema!=='AUDIT_ANCHOR_RECEIPT/1'||p.domain!==trust.domain||p.lineageId!==trust.lineageId||p.keyId!==trust.keyId||!C.SHA.test(p.nonce)||nonce!==undefined&&p.nonce!==nonce)C.fail('CONTINUITY_ANCHOR_INVALID');
    C.integer(p.issuedAt);C.integer(p.expiresAt);if(p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>C.LIMITS.receiptMs)C.fail('CONTINUITY_ANCHOR_INVALID');
    if(!historical){const now=Date.now();if(p.issuedAt>now+2000||p.expiresAt<now||now-p.issuedAt>C.LIMITS.receiptMs)C.fail('CONTINUITY_ANCHOR_STALE');}
    C.exact(p.state,['revision','pointer']);C.integer(p.state.revision);C.pointer(p.state.pointer);
    if(!historical&&p.state.pointer.clockHighWater>Date.now()+2000)C.fail('CONTINUITY_CLOCK_UNCERTAIN');
    if(p.resolution!==null){
      C.exact(p.resolution,['proposal','requestHash','committedRevision']);C.proposal(p.resolution.proposal);
      C.integer(p.resolution.committedRevision,1);
      if(p.resolution.proposal.lineageId!==trust.lineageId||p.resolution.requestHash!==C.sha(C.canonical(p.resolution.proposal))||
        p.resolution.committedRevision!==p.resolution.proposal.expectedRevision+1||p.state.revision<p.resolution.committedRevision||
        p.state.revision===p.resolution.committedRevision&&C.canonical(p.state.pointer)!==C.canonical(p.resolution.proposal.nextPointer))C.fail('CONTINUITY_ANCHOR_INVALID');
    }
    if(!crypto.verify(null,Buffer.from(C.canonical(p)),key,Buffer.from(receipt.signature,'base64')))C.fail('CONTINUITY_ANCHOR_SIGNATURE_INVALID');
    // Provider-owned objects cannot mutate a verified receipt after return.
    return C.parseCanonical(Buffer.from(C.canonical(receipt)),16384);
  }catch(error){throw C.mapped(error);}
}
async function call(client,method,request,trust){
  try{
    trustKey(trust);if(!client||typeof client[method]!=='function')C.fail('CONTINUITY_ANCHOR_UNAVAILABLE');
    const nonce=crypto.randomBytes(32).toString('hex');let timer;
    try{
      const boundedRequest=C.parseCanonical(Buffer.from(C.canonical({...request,lineageId:trust.lineageId,nonce})),16384);
      const value=await Promise.race([Promise.resolve().then(()=>client[method](boundedRequest)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(C.mapped(null)),C.LIMITS.anchorMs);})]);
      return verifyReceipt(value,trust,nonce);
    }finally{clearTimeout(timer);}
  }catch(error){throw C.mapped(error);}
}
async function readCurrent(client,trust){
  const receipt=await call(client,'observe',{},trust);
  if(receipt.payload.resolution!==null)C.fail('CONTINUITY_ANCHOR_INVALID');
  return receipt;
}
function binding(receipt,proposal,required){
  if(receipt.payload.resolution===null){if(required)C.fail('CONTINUITY_ANCHOR_UNCONFIRMED');return receipt;}
  if(C.canonical(receipt.payload.resolution.proposal)!==C.canonical(proposal))C.fail('CONTINUITY_ANCHOR_CONFLICT');
  return receipt;
}
async function commitAnchor(client,trust,proposal){
  C.proposal(proposal);if(proposal.lineageId!==trust.lineageId)C.fail('CONTINUITY_ANCHOR_INVALID');
  return binding(await call(client,'compareAndSwap',{proposal},trust),proposal,true);
}
async function resolveAnchor(client,trust,proposal){
  C.proposal(proposal);
  return binding(await call(client,'resolve',{transitionId:proposal.transitionId,requestHash:C.sha(C.canonical(proposal))},trust),proposal,false);
}
module.exports={verifyReceipt,readCurrent,commitAnchor,resolveAnchor};
