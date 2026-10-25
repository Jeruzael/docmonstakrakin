'use strict';
const {createHash}=require('node:crypto');
const INPUT_FIELDS=Object.freeze({
 enrollAgent:['projectId','name','expectedPolicyRevision'],
 registerAgentClient:['projectId','agentId','name','expectedPolicyRevision'],
 grantAgent:['agentId','clientId','projectId','scope','actions','expiresAt','expectedPolicyRevision'],
 issueAgent:['grantId','expectedGrantRevision','expectedPolicyRevision'],
 revokeAgent:['agentId','expectedPolicyRevision'],
 revokeAgentClient:['clientId','expectedPolicyRevision'],
 revokeAgentGrant:['grantId','expectedPolicyRevision'],
});
for(const keys of Object.values(INPUT_FIELDS))Object.freeze(keys);
function requestHash(command,input){
 const keys=INPUT_FIELDS[command];if(!keys||!input||Object.getPrototypeOf(input)!==Object.prototype||Object.getOwnPropertySymbols(input).length)throw Error('WORKSPACE_INPUT_INVALID');
 const descriptors=Object.getOwnPropertyDescriptors(input);
 if(Object.keys(descriptors).length!==keys.length||keys.some(k=>!Object.hasOwn(descriptors,k)||!Object.hasOwn(descriptors[k],'value')||!descriptors[k].enumerable))throw Error('WORKSPACE_INPUT_INVALID');
 let nodes=0,bytes=0;
 const canonical=(v,depth=0)=>{
  if(++nodes>4096||depth>8)throw Error('WORKSPACE_INPUT_INVALID');
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isSafeInteger(v))return JSON.stringify(v);
  if(typeof v==='string'){bytes+=Buffer.byteLength(v);if(bytes>16384||Buffer.from(v).toString('utf8')!==v)throw Error('WORKSPACE_INPUT_INVALID');return JSON.stringify(v);}
  if(!v||typeof v!=='object'||Object.getOwnPropertySymbols(v).length||![Object.prototype,Array.prototype].includes(Object.getPrototypeOf(v)))throw Error('WORKSPACE_INPUT_INVALID');
  const d=Object.getOwnPropertyDescriptors(v),names=Object.keys(d).filter(k=>!(Array.isArray(v)&&k==='length'));
  if(names.length>128||names.some(k=>!d[k].enumerable||!Object.hasOwn(d[k],'value')||['__proto__','prototype','constructor','toJSON'].includes(k)))throw Error('WORKSPACE_INPUT_INVALID');
  if(Array.isArray(v)){if(names.length!==v.length||names.some((k,i)=>k!==String(i)))throw Error('WORKSPACE_INPUT_INVALID');return'['+names.map(k=>canonical(d[k].value,depth+1)).join(',')+']';}
  return'{'+names.sort().map(k=>JSON.stringify(k)+':'+canonical(d[k].value,depth+1)).join(',')+'}';
 };
 return createHash('sha256').update('dmk-agent-management-v1\0'+canonical({command,input})).digest('hex');
}
module.exports={INPUT_FIELDS,requestHash};
