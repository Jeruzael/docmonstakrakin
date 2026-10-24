'use strict';
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const LIMITS=Object.freeze({segments:8,segmentBytes:256*1024*1024,indexBytes:16*1024*1024,snapshotBytes:64*1024*1024,successorBytes:80*1024*1024,manifestBytes:65536,journalBytes:1024*1024,reserveBytes:16*1024*1024,entriesPerSegment:4096,verificationMs:30000,anchorMs:5000,receiptMs:30000});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,SHA=/^[0-9a-f]{64}$/;
function fail(code='CONTINUITY_INVALID'){const error=Error(code);error.code=code;throw error;}
function mapped(error){if(typeof error?.code==='string'&&/^CONTINUITY_[A-Z_]{1,70}$/.test(error.code))return error;const e=Error('CONTINUITY_UNAVAILABLE');e.code='CONTINUITY_UNAVAILABLE';return e;}
function exact(value,keys,optional=[]){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length||keys.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>!keys.includes(k)&&!optional.includes(k)))fail();}
function integer(value,min=0,max=Number.MAX_SAFE_INTEGER-1800000){if(!Number.isSafeInteger(value)||value<min||value>max)fail();}
function canonical(value){
  let nodes=0;
  const walk=(v,depth)=>{
    if(++nodes>200000||depth>64)fail('CONTINUITY_BOUND_EXCEEDED');
    if(v===null||typeof v==='boolean'||typeof v==='string')return v;
    if(typeof v==='number'){if(!Number.isSafeInteger(v))fail();return v;}
    if(Array.isArray(v)){if(v.length>65536)fail('CONTINUITY_BOUND_EXCEEDED');return v.map(x=>walk(x,depth+1));}
    if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.getOwnPropertySymbols(v).length)fail();
    const result={};
    for(const k of Object.keys(v).sort()){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d)||['__proto__','prototype','constructor','toJSON'].includes(k))fail();result[k]=walk(d.value,depth+1);}
    return result;
  };
  return JSON.stringify(walk(value,0))+'\n';
}
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function parseCanonical(bytes,limit=LIMITS.manifestBytes){
  if(!Buffer.isBuffer(bytes)||bytes.length>limit)fail('CONTINUITY_BOUND_EXCEEDED');
  let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{fail();}
  if(!Buffer.from(canonical(value),'utf8').equals(bytes))fail();return value;
}
function pointer(p){
  exact(p,['authorityId','epoch','dbSha256','historyRoot','segments','generation','policyRevision','snapshotRevision','clockHighWater']);
  if(!UUID.test(p.authorityId)||!SHA.test(p.dbSha256)||p.historyRoot!==null&&!SHA.test(p.historyRoot))fail();
  integer(p.epoch,1);integer(p.generation,1);integer(p.policyRevision);integer(p.snapshotRevision);integer(p.clockHighWater);integer(p.segments,0,LIMITS.segments);
  if((p.historyRoot===null)!==(p.segments===0))fail();
}
function proposal(p){
  exact(p,['lineageId','transitionId','intentHash','expectedRevision','expectedPointer','nextPointer']);
  if(!UUID.test(p.lineageId)||!UUID.test(p.transitionId)||!SHA.test(p.intentHash))fail();
  integer(p.expectedRevision);pointer(p.expectedPointer);pointer(p.nextPointer);
  if(p.nextPointer.authorityId===p.expectedPointer.authorityId||p.nextPointer.epoch!==p.expectedPointer.epoch+1||p.nextPointer.segments!==p.expectedPointer.segments+1||p.nextPointer.generation!==p.expectedPointer.generation+1||
    ['policyRevision','snapshotRevision','clockHighWater'].some(k=>p.nextPointer[k]!==p.expectedPointer[k]))fail('CONTINUITY_FENCE_INVALID');
}
function deadline(){return performance.now()+LIMITS.verificationMs;}
function checkDeadline(until){if(performance.now()>until)fail('CONTINUITY_DEADLINE_EXCEEDED');}
module.exports={LIMITS,UUID,SHA,fail,mapped,exact,integer,canonical,sha,parseCanonical,pointer,proposal,deadline,checkDeadline};
