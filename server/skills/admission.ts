import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';
import {publishedPromptSkills,type PromptSkillPublication,type PublishedSkillAction} from '../../src/data/skillRegistry.ts';

const fail=():never=>{throw Error('SKILL_ADMISSION_REJECTED');};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identifier=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(value);
function exact(value:any,keys:string[]){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)fail();
 const fields=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(fields).length!==keys.length||keys.some(key=>!Object.hasOwn(fields,key))||Object.values(fields).some(field=>!field.enumerable||!Object.hasOwn(field,'value')))fail();
}
const safeInteger=(value:unknown,minimum=0):value is number=>Number.isSafeInteger(value)&&Number(value)>=minimum;
function inert(value:unknown){
 let nodes=0,bytes=0;
 function visit(v:any,depth:number){
  if(depth>8||++nodes>16384)fail();
  if(typeof v==='string'){bytes+=Buffer.byteLength(v);if(bytes>1024*1024||Buffer.from(v).toString('utf8')!==v)fail();return;}
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
  if(!v||typeof v!=='object'||types.isProxy(v)||Object.getOwnPropertySymbols(v).length)fail();
  const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);if(array?prototype!==Array.prototype:prototype!==Object.prototype)fail();
  const keys=Object.getOwnPropertyNames(v).filter(k=>!array||k!=='length');if(keys.length>16384)fail();
  if(array&&(v.length>16384||keys.length!==v.length||keys.some((k,i)=>k!==String(i))))fail();
  for(const key of keys){bytes+=Buffer.byteLength(key);if(bytes>1024*1024)fail();const d=Object.getOwnPropertyDescriptor(v,key)!;if(!d.enumerable||!Object.hasOwn(d,'value')||['__proto__','prototype','constructor','toJSON'].includes(key))fail();visit(d.value,depth+1);}
 }
 visit(value,0);
}
function publicationDigest(p:PromptSkillPublication):string {
 inert(p);exact(p,['schema','epoch','revokedIds','assets']);
 if(p.schema!=='PROMPT_SKILL_PUBLICATION/1'||!safeInteger(p.epoch,1)||!Array.isArray(p.revokedIds)||p.revokedIds.length>128||p.revokedIds.some(id=>!identifier(id))||new Set(p.revokedIds).size!==p.revokedIds.length||!Array.isArray(p.assets)||p.assets.length>128)fail();
 const ids=new Set<string>();let total=0;
 for(const a of p.assets){exact(a,['id','description','instructions','authority','actions']);if(!identifier(a.id)||ids.has(a.id)||a.authority!=='BUNDLED_SOURCE'||typeof a.description!=='string'||!a.description.trim()||typeof a.instructions!=='string'||!a.instructions.trim()||!Array.isArray(a.actions)||a.actions.some(x=>!['task:read','proposal:stage'].includes(x))||new Set(a.actions).size!==a.actions.length)fail();ids.add(a.id);total+=Buffer.byteLength(a.description)+Buffer.byteLength(a.instructions);if(total>1024*1024)fail();}
 return hash([p.schema,p.epoch,[...p.revokedIds].sort(),p.assets.map(a=>[a.id,a.description,a.instructions,a.authority,a.actions]).sort((a,b)=>String(a[0])<String(b[0])?-1:String(a[0])>String(b[0])?1:0)]);
}
const skillVersion=(a:{id:string;description:string;instructions:string})=>'sha256:'+hash([a.id,a.description,a.instructions]);
/** Public metadata only. This cannot mint an instruction or authority receipt. */
function currentSkillPublication(action:PublishedSkillAction){
 if(!['task:read','proposal:stage'].includes(action))fail();const p=publishedPromptSkills(),registryDigest=publicationDigest(p);
 const selected=p.assets.filter(a=>a.actions.includes(action)&&!p.revokedIds.includes(a.id));if(selected.length!==1)fail();
 return{p,registryDigest,selected};
}
export function currentSkillContext(action:PublishedSkillAction){
 const {p,registryDigest,selected}=currentSkillPublication(action);
 return{schema:'DMK_SKILL_CONTEXT/1' as const,publicationEpoch:p.epoch,registryDigest,requiredSkills:selected.map(a=>({id:a.id,version:skillVersion(a)}))};
}
/** Manual delivery material, with no authenticated-retrieval assertion. */
export function currentSkillInstructions(action:PublishedSkillAction){
 return currentSkillPublication(action).selected.map(a=>({id:a.id,version:skillVersion(a),description:a.description,instructions:a.instructions}));
}
export type TaskReadInstructionRequest={version:1;operationId:string;action:'task:read';projectId:string;taskId:string;expectedRevision:number};
type Context={binding:string;requestHash:string;skillId:string;version:string;registryDigest:string;policyRevision:number;instructions:string;description:string;expiresAt:number;now:number};

/** Host-only retrieval proof. The authority still decides every actual read. */
export class TaskReadSkillAdmission {
 private readonly key=randomBytes(32);private closed=false;private highWater=0;
 private publicationEpoch=0;private publicationDigest='';private publicationConflicted=false;
 private readonly clock:()=>number;private readonly publication:()=>PromptSkillPublication;
 constructor(options:{clock?:()=>number;publication?:()=>PromptSkillPublication}={}){this.clock=options.clock??Date.now;this.publication=options.publication??publishedPromptSkills;}
 private context(actor:any,request:any):Context {
  if(this.closed)fail();const now=this.clock();if(!safeInteger(now)||now<this.highWater||now>Number.MAX_SAFE_INTEGER-60000)fail();this.highWater=now;
  inert(actor);inert(request);
  exact(request,['version','operationId','action','projectId','taskId','expectedRevision']);
  if(request.version!==1||request.action!=='task:read'||typeof request.operationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(request.operationId)||!identifier(request.projectId)||!identifier(request.taskId)||!safeInteger(request.expectedRevision))fail();
  exact(actor,['kind','principalId','clientId','sessionId','sponsorPrincipalId','grantId','grantRevision','projectId','scope','actions','expiresAt','policyRevision','snapshotRevision']);
  if(actor.kind!=='AGENT'||['principalId','clientId','sessionId','sponsorPrincipalId','grantId','projectId'].some(k=>!identifier(actor[k]))||actor.projectId!==request.projectId||actor.projectId==='PRJ-DOCMONSTAKRAKIN'||!safeInteger(actor.grantRevision,1)||!safeInteger(actor.policyRevision)||actor.snapshotRevision!==request.expectedRevision||!safeInteger(actor.expiresAt)||actor.expiresAt<=now)fail();
  if(!Array.isArray(actor.actions)||actor.actions.length!==1||actor.actions[0]!=='task:read')fail();
  if(actor.scope?.kind==='PROJECT_TASKS')exact(actor.scope,['kind']);
  else{exact(actor.scope,['kind','taskIds']);if(actor.scope.kind!=='TASKS'||!Array.isArray(actor.scope.taskIds)||actor.scope.taskIds.length<1||actor.scope.taskIds.length>64||actor.scope.taskIds.some((id:any,i:number,a:any[])=>!identifier(id)||i>0&&a[i-1]>=id)||!actor.scope.taskIds.includes(request.taskId))fail();}
  const p=this.publication(),registryDigest=publicationDigest(p);
  if(p.epoch<this.publicationEpoch)fail();
  if(p.epoch===this.publicationEpoch){if(registryDigest!==this.publicationDigest)this.publicationConflicted=true;if(this.publicationConflicted)fail();}
  else{this.publicationEpoch=p.epoch;this.publicationDigest=registryDigest;this.publicationConflicted=false;}
  const applicable=p.assets.filter(a=>a.actions.includes('task:read')&&!p.revokedIds.includes(a.id));if(applicable.length!==1)fail();const asset=applicable[0];
  const requestHash=hash(['DMK_TASK_READ/1',request.version,request.operationId,request.action,request.projectId,request.taskId,request.expectedRevision]);
  return{binding:hash(['DMK_SKILL_ACTOR/1',actor.kind,actor.principalId,actor.clientId,actor.sessionId,actor.sponsorPrincipalId,actor.grantId,actor.grantRevision,actor.projectId,[actor.scope.kind,actor.scope.taskIds??[]],actor.actions,actor.expiresAt,actor.policyRevision,actor.snapshotRevision]),requestHash,skillId:asset.id,version:skillVersion(asset),registryDigest,policyRevision:actor.policyRevision,instructions:asset.instructions,description:asset.description,expiresAt:Math.min(actor.expiresAt,now+60000),now};
 }
 private mint(c:Context,stage:'DESCRIPTION'|'INSTRUCTIONS',expiresAt=c.expiresAt){
  const raw=JSON.stringify({schema:'DMK_SKILL_RETRIEVAL/1',stage,binding:c.binding,requestHash:c.requestHash,skillId:c.skillId,version:c.version,registryDigest:c.registryDigest,policyRevision:c.policyRevision,issuedAt:c.now,expiresAt});
  const payload=Buffer.from(raw).toString('base64url'),signature=createHmac('sha256',this.key).update('DMK_SKILL_RETRIEVAL/1\0'+payload).digest('base64url');return payload+'.'+signature;
 }
 private validate(c:Context,token:unknown,stage:string){
  if(typeof token!=='string'||token.length>4096||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))return fail();
  const [payload,mac]=token.split('.'),expected=createHmac('sha256',this.key).update('DMK_SKILL_RETRIEVAL/1\0'+payload).digest();
  const signature=Buffer.from(mac,'base64url');if(signature.length!==32||signature.toString('base64url')!==mac||!timingSafeEqual(signature,expected))fail();
  const bytes=Buffer.from(payload,'base64url');if(bytes.toString('base64url')!==payload)fail();const raw=bytes.toString('utf8');if(!Buffer.from(raw).equals(bytes))fail();const p=JSON.parse(raw);
  exact(p,['schema','stage','binding','requestHash','skillId','version','registryDigest','policyRevision','issuedAt','expiresAt']);
  if(raw!==JSON.stringify(p)||p.schema!=='DMK_SKILL_RETRIEVAL/1'||p.stage!==stage||p.binding!==c.binding||p.requestHash!==c.requestHash||p.skillId!==c.skillId||p.version!==c.version||p.registryDigest!==c.registryDigest||p.policyRevision!==c.policyRevision||!safeInteger(p.issuedAt)||!safeInteger(p.expiresAt)||p.issuedAt>c.now||p.expiresAt<=c.now||p.expiresAt-p.issuedAt>60000||p.expiresAt>c.expiresAt)fail();return p;
 }
 describe(actor:unknown,request:unknown){const c=this.context(actor,request);return{skillId:c.skillId,version:c.version,description:c.description,registryDigest:c.registryDigest,consultationReceipt:this.mint(c,'DESCRIPTION'),qualification:'Authenticated instruction-description retrieval only; permissions remain independently enforced.'};}
 content(actor:unknown,request:unknown,consultationReceipt:unknown){const c=this.context(actor,request),p=this.validate(c,consultationReceipt,'DESCRIPTION');return{skillId:c.skillId,version:c.version,instructions:c.instructions,registryDigest:c.registryDigest,admissionReceipt:this.mint(c,'INSTRUCTIONS',p.expiresAt),qualification:'Authenticated instruction retrieval only; not proof of model understanding or human approval.'};}
 admit(actor:unknown,request:unknown,receipt:unknown):{accepted:boolean;reason?:string}{try{const c=this.context(actor,request);this.validate(c,receipt,'INSTRUCTIONS');return{accepted:true};}catch{return{accepted:false,reason:'SKILL_ADMISSION_REJECTED'};}}
 close(){this.closed=true;this.key.fill(0);}
}
