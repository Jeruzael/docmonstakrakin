import {createHash, randomUUID} from 'node:crypto';
import type {ProjectStore} from '../projectStore.ts';
import type {VerificationArchive, VerificationBinding, VerificationPrincipal, VerificationDraft, VerificationEvidence, VerificationSession, VerificationSessionSummary, VerificationReviewProjection} from '../../src/verificationTypes.ts';
import {evaluateQuorum, REQUIRED_QUORUM_ROLES} from '../proposals/quorum.ts';
import {VerificationError} from './errors.ts';
import {assertVerificationRetention, verificationRetainedBytes, VERIFICATION_RETENTION_LIMITS} from './retention.ts';

export {VerificationError} from './errors.ts';
const fail=(status:number,message:string):never=>{throw new VerificationError(status,message);};
const sha=(content:string|Buffer)=>createHash('sha256').update(content).digest('hex');
function canonical(value:any):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
export const verificationDigest=(value:unknown)=>sha(canonical(value));
function shape(value:any,keys:string[]) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(422,'Invalid verification payload or unsupported fields');
}
function text(value:unknown,max:number,label:string):string {
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail(422,`Invalid ${label}`);return value as string;
}
export function verificationProject(store:ProjectStore,id:string) {
 const project=store.projects.find(p=>p.id===id);if(!project)fail(404,'Project not found');return project;
}
function target(store:ProjectStore,projectId:string,workItemId:string) {
 verificationProject(store,projectId);
 const items=store.workItems[projectId];
 const item=Array.isArray(items)?items.find(w=>w.id===workItemId):undefined;
 if(!item)fail(404,'Work item not found in this project');
 if(!Array.isArray(item.acceptanceCriteria)||item.acceptanceCriteria.length===0||item.acceptanceCriteria.length>100||item.acceptanceCriteria.some(c=>typeof c!=='string'||!c.trim()))fail(409,'Work item requires bounded nonempty acceptance criteria');
 return item;
}
export function requireVerificationVersion(store:ProjectStore,projectId:string,expected:unknown) {
 if(!Number.isSafeInteger(expected)||(expected as number)<0)fail(422,'expectedStateVersion is required');
 const project=verificationProject(store,projectId);
 if(!Number.isSafeInteger(project.stateVersion)||project.stateVersion>=Number.MAX_SAFE_INTEGER||project.stateVersion!==expected)fail(409,'PROJECT_STATE_STALE: reload and review the current project');return project;
}
function binding(value:any):VerificationBinding {
 if(typeof value.commitSha!=='string'||!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(value.commitSha))fail(422,'Commit SHA must be an exact lowercase 40 or 64 character revision');
 return {commitSha:value.commitSha,buildRevision:text(value.buildRevision,160,'build revision'),environment:text(value.environment,160,'environment')};
}
const matches=(a:VerificationBinding,b:VerificationBinding)=>a.commitSha===b.commitSha&&a.buildRevision===b.buildRevision&&a.environment===b.environment;
function evidenceInput(input:any):VerificationEvidence {
 shape(input,['id','kind','encoding','content','sha256']);
 const id=text(input.id,80,'evidence ID');if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id))fail(422,'Invalid evidence ID');
 if(!['MANUAL','LOG','SCREENSHOT','REFERENCE'].includes(input.kind))fail(422,'Invalid evidence kind');
 if(typeof input.content!=='string'||!input.content.length||input.content.length>180_000)fail(422,'Evidence content is empty or exceeds limit');
 let bytes:Buffer;
 if(input.kind==='SCREENSHOT') {
  if(input.encoding!=='BASE64'||input.content.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.content))fail(422,'Screenshot requires canonical inline base64');
  bytes=Buffer.from(input.content,'base64');if(bytes.toString('base64')!==input.content)fail(422,'Noncanonical screenshot base64');
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!png&&!jpeg)fail(422,'Screenshot must contain PNG or JPEG bytes');
 } else {if(input.encoding!=='UTF8')fail(422,'Text and reference evidence require UTF8');bytes=Buffer.from(input.content,'utf8');}
 if(bytes.length>(input.kind==='SCREENSHOT'?131_072:65_536))fail(422,'Evidence exceeds byte limit');
 if(input.kind==='REFERENCE'&&bytes.length>2048)fail(422,'Reference exceeds byte limit');
 if(input.sha256!==sha(bytes))fail(422,'Evidence SHA-256 does not match exact inline bytes');
 return {id,kind:input.kind,encoding:input.encoding,content:input.content,sha256:input.sha256,byteLength:bytes.length,provenance:input.kind==='REFERENCE'?'UNVERIFIED_REFERENCE':'HUMAN_ATTESTED_INLINE'};
}
function draftInput(input:any,criteria:string[]):VerificationDraft {
 const bound=binding(input);
 if(!Array.isArray(input.evidence)||!input.evidence.length||input.evidence.length>8)fail(422,'Provide 1 to 8 bounded evidence records');
 const evidence=input.evidence.map(evidenceInput);const ids=new Set(evidence.map(e=>e.id));
 if(ids.size!==evidence.length||evidence.reduce((n,e)=>n+e.byteLength,0)>262_144)fail(422,'Duplicate evidence IDs or total evidence byte limit exceeded');
 if(!Array.isArray(input.criterionResults)||input.criterionResults.length!==criteria.length)fail(422,'Every current acceptance criterion requires one result');
 const indexes=new Set<number>();
 const criterionResults=input.criterionResults.map((result:any)=>{
  shape(result,['criterionIndex','result','notes','evidenceIds']);
  if(!Number.isInteger(result.criterionIndex)||result.criterionIndex<0||result.criterionIndex>=criteria.length||indexes.has(result.criterionIndex)||!['PASS','FAIL','NOT_RUN'].includes(result.result))fail(422,'Invalid or duplicate criterion result');
  indexes.add(result.criterionIndex);
  if(typeof result.notes!=='string'||result.notes.length>4000||!Array.isArray(result.evidenceIds)||result.evidenceIds.length>8||new Set(result.evidenceIds).size!==result.evidenceIds.length||result.evidenceIds.some((id:any)=>typeof id!=='string'||!ids.has(id)))fail(422,'Invalid criterion notes or evidence references');
  if(result.result==='PASS'&&!result.evidenceIds.length)fail(422,'Passing criterion requires evidence');
  return {criterionIndex:result.criterionIndex,result:result.result,notes:result.notes,evidenceIds:[...result.evidenceIds]};
 }).sort((a,b)=>a.criterionIndex-b.criterionIndex);
 return {...bound,criterionResults,evidence};
}
export function verificationSession(store:ProjectStore,projectId:string,id:string):VerificationSession {
 verificationProject(store,projectId);const list=store.verificationSessions[projectId];const session=Array.isArray(list)?list.find(s=>s.id===id&&s.projectId===projectId):undefined;
 if(!session)fail(404,'Verification session not found in this project');return session;
}
function currentTask(store:ProjectStore,session:VerificationSession) {
 const item=target(store,session.projectId,session.workItemId);
 if(verificationDigest(item)!==session.workItemDigest||verificationDigest(item.acceptanceCriteria)!==verificationDigest(session.acceptanceCriteria))fail(409,'WORK_ITEM_STALE: task or criteria changed; create a new session');
}
const payloadKeys=['expectedStateVersion','workItemId','commitSha','buildRevision','environment','criterionResults','evidence'];
export function createVerificationDraft(store:ProjectStore,projectId:string,input:any,author:VerificationPrincipal) {
 shape(input,payloadKeys);const project=requireVerificationVersion(store,projectId,input.expectedStateVersion);
 const item=target(store,projectId,text(input.workItemId,160,'work item ID'));const now=new Date().toISOString();
 const session:VerificationSession={id:`VER-${randomUUID()}`,projectId,workItemId:item.id,workItemDigest:verificationDigest(item),acceptanceCriteria:[...item.acceptanceCriteria],author:structuredClone(author),createdAt:now,updatedAt:now,status:'DRAFT',draft:draftInput(input,item.acceptanceCriteria),decisions:[]};
 assertVerificationRetention(store,{projectId,session});
 if(!Array.isArray(store.verificationSessions[projectId]))store.verificationSessions[projectId]=[];
 store.verificationSessions[projectId].push(session);touch(store,projectId,author,'VERIFICATION_DRAFT_CREATED',session.id);return session;
}
function touch(store:ProjectStore,projectId:string,actor:VerificationPrincipal,action:string,sessionId:string) {
 const project=verificationProject(store,projectId);project.stateVersion++;project.updatedAt=new Date().toISOString();
 store.addAuditEvent(projectId,actor.identityId,action,sessionId,undefined,{trust:'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION'});
}
export function updateVerificationDraft(store:ProjectStore,projectId:string,id:string,input:any,actor:VerificationPrincipal) {
 shape(input,payloadKeys.filter(k=>k!=='workItemId'));requireVerificationVersion(store,projectId,input.expectedStateVersion);
 const session=verificationSession(store,projectId,id);if(session.status!=='DRAFT')fail(409,'Submitted bundles are immutable; create a new session');
 if(session.author.personId!==actor.personId||session.author.identityId!==actor.identityId)fail(403,'Only the authenticated draft author may edit');currentTask(store,session);
 const candidate={...session,draft:draftInput(input,session.acceptanceCriteria),updatedAt:new Date().toISOString()};assertVerificationRetention(store,{projectId,session:candidate});
 Object.assign(session,candidate);touch(store,projectId,actor,'VERIFICATION_DRAFT_UPDATED',id);return session;
}
export function submitVerificationDraft(store:ProjectStore,projectId:string,id:string,input:any,actor:VerificationPrincipal) {
 shape(input,['expectedStateVersion','humanAttested']);requireVerificationVersion(store,projectId,input.expectedStateVersion);
 const session=verificationSession(store,projectId,id);if(session.status!=='DRAFT')fail(409,'Session already submitted; changes require a new session');
 if(session.author.identityId!==actor.identityId||session.author.personId!==actor.personId)fail(403,'Only the authenticated draft author may submit');
 if(input.humanAttested!==true)fail(422,'Explicit human evidence attestation is required');currentTask(store,session);
 const checked=draftInput({...session.draft,evidence:session.draft.evidence.map(({byteLength,provenance,...entry})=>entry)},session.acceptanceCriteria);
 if(verificationDigest(checked)!==verificationDigest(session.draft))fail(409,'Draft evidence metadata changed; create a new session');
 const bundle={...structuredClone(session.draft),schemaVersion:1 as const,projectId,workItemId:session.workItemId,workItemDigest:session.workItemDigest,acceptanceCriteria:[...session.acceptanceCriteria],author:structuredClone(session.author),submittedAt:new Date().toISOString(),attestation:'HUMAN_ATTESTATION' as const,policyVersion:'LOCAL_SESSION_V1' as const,requiredRoles:[...REQUIRED_QUORUM_ROLES]};
 const candidate:VerificationSession={...session,submitted:{bundle,digest:verificationDigest(bundle)},status:'SUBMITTED',updatedAt:bundle.submittedAt};assertVerificationRetention(store,{projectId,session:candidate});
 Object.assign(session,candidate);touch(store,projectId,actor,'VERIFICATION_SUBMITTED',id);return session;
}
function validatePrincipal(principal:VerificationPrincipal) {
 return principal&&principal.kind==='HUMAN'&&principal.roleSource==='LOCAL_SERVER_ROSTER'&&principal.personBindingSource==='LOCAL_ROSTER_ASSERTION'&&typeof principal.identityId==='string'&&!!principal.identityId.trim()&&typeof principal.username==='string'&&!!principal.username.trim()&&typeof principal.personId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(principal.personId)&&Array.isArray(principal.roles);
}
function inspectSubmitted(store:ProjectStore|undefined,session:VerificationSession,expected?:VerificationBinding):VerificationReviewProjection {
 const projection:VerificationReviewProjection={sessionId:session.id,eligible:false,reason:'Awaiting submitted evidence and independent human review',pendingRoles:[...REQUIRED_QUORUM_ROLES],trust:'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION',trustedProductionEvidence:false};
 if(session.status==='DRAFT')return projection;
 if(store)currentTask(store,session);const submitted=session.submitted;const bundle=submitted?.bundle;
 if(!bundle||submitted.digest!==verificationDigest(bundle)||bundle.schemaVersion!==1||bundle.projectId!==session.projectId||bundle.workItemId!==session.workItemId||bundle.workItemDigest!==session.workItemDigest||verificationDigest(bundle.acceptanceCriteria)!==verificationDigest(session.acceptanceCriteria)||verificationDigest(bundle.author)!==verificationDigest(session.author)||!validatePrincipal(bundle.author)||bundle.attestation!=='HUMAN_ATTESTATION')fail(409,'SUBMITTED_BUNDLE_INVALID: exact submitted digest or binding failed');
 const sanitized=draftInput({...bundle,evidence:bundle.evidence.map(({byteLength,provenance,...input})=>input)},bundle.acceptanceCriteria);
 if(verificationDigest(sanitized.evidence)!==verificationDigest(bundle.evidence))fail(409,'SUBMITTED_BUNDLE_INVALID: evidence provenance or byte lengths changed');
 if(expected&&!matches(bundle,expected))fail(409,'BUILD_BINDING_STALE: exact commit, build and environment are required');
 const people=new Set<string>();const accounts=new Set<string>();
 if(!Array.isArray(session.decisions))fail(409,'Stored verification decisions are invalid');
 for(const decision of session.decisions) {
  if(!decision||!validatePrincipal(decision.reviewer)||decision.submittedDigest!==submitted.digest||!matches(decision,bundle)||decision.humanAttested!==true||decision.independenceAttested!==true||!['APPROVE','REJECT','REQUIRE_REMEDIATION'].includes(decision.decision)||!REQUIRED_QUORUM_ROLES.includes(decision.role as any)||!decision.reviewer.roles.includes(decision.role)||decision.reviewer.personId===bundle.author.personId||decision.reviewer.identityId===bundle.author.identityId||decision.reviewer.username===bundle.author.username||people.has(decision.reviewer.personId)||accounts.has(decision.reviewer.identityId)||(decision.decision!=='APPROVE'&&(typeof decision.reason!=='string'||!decision.reason.trim())))fail(409,'Stored reviewer decisions fail independent human policy');
  people.add(decision.reviewer.personId);accounts.add(decision.reviewer.identityId);
 }
 const quorum=evaluateQuorum({status:session.status==='APPROVED'?'APPROVED':session.status==='REJECTED'||session.status==='REMEDIATION_REQUIRED'?'REJECTED':'PENDING',policyVersion:bundle.policyVersion,requiredRoles:bundle.requiredRoles,targetDigest:submitted.digest,approvalsCollected:session.decisions.map(d=>({identityId:d.reviewer.personId,role:d.role,decision:d.decision==='APPROVE'?'APPROVED':'REJECTED',roleSource:d.reviewer.roleSource}))},submitted.digest);
 projection.pendingRoles=quorum.pendingRoles;
 if(quorum.status==='INVALID')fail(409,quorum.reason??'Stored quorum policy is invalid');
 const passing=bundle.criterionResults.every(c=>c.result==='PASS'&&c.evidenceIds.some(id=>bundle.evidence.some(e=>e.id===id&&e.provenance==='HUMAN_ATTESTED_INLINE')));
 projection.eligible=session.status==='APPROVED'&&quorum.hasQuorum&&passing;
 projection.reason=projection.eligible?'Approved local human attestation for this exact task and build':!passing?'Every criterion needs a PASS result with inline evidence':quorum.reason??(quorum.hasQuorum?'Stored session status is inconsistent with quorum':'Awaiting distinct roster persons for Security Officer and Lead Architect');return projection;
}
export function verificationReview(store:ProjectStore,session:VerificationSession,expected?:VerificationBinding):VerificationReviewProjection {
 try{return inspectSubmitted(store,session,expected);}catch(error){return {sessionId:session.id,eligible:false,reason:error instanceof Error?error.message:'Invalid stored verification session',pendingRoles:[...REQUIRED_QUORUM_ROLES],trust:'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION',trustedProductionEvidence:false};}
}
/** Pure projection: never grants release approval or changes work-item lifecycle. */
export function projectVerificationEvidence(store:ProjectStore,projectId:string,current:VerificationBinding&{workItemId:string}) {
 const sessions=Array.isArray(store.verificationSessions[projectId])?store.verificationSessions[projectId]:[];
 const reviews=sessions.filter(s=>s.projectId===projectId&&s.workItemId===current.workItemId).map(s=>verificationReview(store,s,current));
 return {reviews,eligibleSessionIds:reviews.filter(r=>r.eligible).map(r=>r.sessionId),trust:'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION' as const,trustedProductionEvidence:false as const};
}
export function verificationSummary(session:VerificationSession):VerificationSessionSummary {
 const bound=session.submitted?.bundle??session.draft;
 return {id:session.id,projectId:session.projectId,workItemId:session.workItemId,author:structuredClone(session.author),createdAt:session.createdAt,updatedAt:session.updatedAt,status:session.status,commitSha:bound.commitSha,buildRevision:bound.buildRevision,environment:bound.environment,...(session.submitted?{submittedDigest:session.submitted.digest}:{}),criterionCount:session.acceptanceCriteria.length,evidenceCount:bound.evidence.length,retainedBytes:verificationRetainedBytes(session)};
}
export function decideVerification(store:ProjectStore,projectId:string,id:string,input:any,actor:VerificationPrincipal) {
 shape(input,['expectedStateVersion','submittedDigest','decision','reason','role','humanAttested','independenceAttested','commitSha','buildRevision','environment']);requireVerificationVersion(store,projectId,input.expectedStateVersion);
 const session=verificationSession(store,projectId,id);if(session.status!=='SUBMITTED')fail(409,'Session is not awaiting review; changes require a new session');
 const bound=binding(input);inspectSubmitted(store,session,bound);
 if(input.submittedDigest!==session.submitted.digest)fail(409,'SUBMITTED_DIGEST_STALE: review the exact submitted bundle');
 if(actor.personId===session.author.personId||actor.identityId===session.author.identityId||actor.username===session.author.username)fail(403,'Submitter cannot review their own evidence');
 if(!REQUIRED_QUORUM_ROLES.includes(input.role)||!actor.roles.includes(input.role))fail(403,'The authenticated reviewer cannot assert that role');
 if(session.decisions.some(d=>d.reviewer.personId===actor.personId||d.reviewer.identityId===actor.identityId||d.reviewer.username===actor.username||d.role===input.role))fail(403,'Distinct roster persons and one decision per role are required');
 if(!['APPROVE','REJECT','REQUIRE_REMEDIATION'].includes(input.decision)||input.humanAttested!==true||input.independenceAttested!==true)fail(422,'Explicit human review and independence attestations are required');
 const reason=input.reason===undefined?'':input.reason;if(typeof reason!=='string'||reason.length>4000||(input.decision!=='APPROVE'&&!reason.trim()))fail(422,'Rejection or remediation requires a bounded reason');
 if(input.decision==='APPROVE'&&!session.submitted.bundle.criterionResults.every(c=>c.result==='PASS'&&c.evidenceIds.some(id=>session.submitted.bundle.evidence.some(e=>e.id===id&&e.provenance==='HUMAN_ATTESTED_INLINE'))))fail(422,'Approval requires PASS and inline evidence for every criterion');
 const candidate=structuredClone(session);
 candidate.decisions.push({id:`VD-${randomUUID()}`,...bound,decision:input.decision,reason,role:input.role,reviewer:structuredClone(actor),submittedDigest:session.submitted.digest,createdAt:new Date().toISOString(),humanAttested:true,independenceAttested:true});
 if(input.decision==='REJECT')candidate.status='REJECTED';else if(input.decision==='REQUIRE_REMEDIATION')candidate.status='REMEDIATION_REQUIRED';else if(REQUIRED_QUORUM_ROLES.every(role=>candidate.decisions.some(d=>d.role===role&&d.decision==='APPROVE')))candidate.status='APPROVED';
 candidate.updatedAt=new Date().toISOString();assertVerificationRetention(store,{projectId,session:candidate});Object.assign(session,candidate);touch(store,projectId,actor,'VERIFICATION_REVIEW_DECIDED',id);return session;
}

const principalKeys=['identityId','username','personId','roles','kind','roleSource','personBindingSource'];
const draftKeys=['commitSha','buildRevision','environment','criterionResults','evidence'];
function archivePrincipal(value:any) {
 shape(value,principalKeys);
 if(!validatePrincipal(value)||value.identityId.length>128||value.username.length>128||value.roles.some((role:any)=>typeof role!=='string')||!value.roles.some((role:string)=>REQUIRED_QUORUM_ROLES.includes(role as any)))fail(422,'Invalid historical local human principal');
}
function archiveTimestamp(value:any) {if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail(422,'Invalid historical verification timestamp');}
function archiveSession(value:any,projectId:string) {
 shape(value,['id','projectId','workItemId','workItemDigest','acceptanceCriteria','author','createdAt','updatedAt','status','draft','submitted','decisions']);
 text(value.id,160,'historical session ID');text(value.workItemId,160,'historical work item ID');
 if(value.projectId!==projectId||typeof value.workItemDigest!=='string'||!/^[a-f0-9]{64}$/.test(value.workItemDigest)||!['DRAFT','SUBMITTED','APPROVED','REJECTED','REMEDIATION_REQUIRED'].includes(value.status))fail(422,'Invalid historical verification project or task binding');
 if(!Array.isArray(value.acceptanceCriteria)||value.acceptanceCriteria.length<1||value.acceptanceCriteria.length>100||value.acceptanceCriteria.some((criterion:any)=>typeof criterion!=='string'||!criterion.trim()))fail(422,'Invalid historical acceptance criteria');
 archivePrincipal(value.author);archiveTimestamp(value.createdAt);archiveTimestamp(value.updatedAt);shape(value.draft,draftKeys);
 const draft=draftInput({...value.draft,evidence:value.draft.evidence?.map(({byteLength,provenance,...input})=>input)},value.acceptanceCriteria);
 if(verificationDigest(draft)!==verificationDigest(value.draft))fail(422,'Historical draft bytes or metadata are invalid');
 if(!Array.isArray(value.decisions)||value.decisions.length>REQUIRED_QUORUM_ROLES.length)fail(422,'Invalid historical review decisions');
 const decisionIds=new Set<string>();const decisionRoles=new Set<string>();
 for(const decision of value.decisions) {
  shape(decision,['id','commitSha','buildRevision','environment','decision','reason','role','reviewer','submittedDigest','createdAt','humanAttested','independenceAttested']);
  text(decision.id,160,'historical decision ID');if(decisionIds.has(decision.id)||decisionRoles.has(decision.role)||typeof decision.reason!=='string'||decision.reason.length>4000)fail(422,'Invalid or duplicate historical decision');decisionIds.add(decision.id);decisionRoles.add(decision.role);archivePrincipal(decision.reviewer);archiveTimestamp(decision.createdAt);
 }
 if(value.status==='DRAFT') {if(value.submitted!==undefined||value.decisions.length)fail(422,'Historical draft cannot claim submitted review decisions');return;}
 shape(value.submitted,['bundle','digest']);const bundle=value.submitted.bundle;
 shape(bundle,[...draftKeys,'schemaVersion','projectId','workItemId','workItemDigest','acceptanceCriteria','author','submittedAt','attestation','policyVersion','requiredRoles']);archiveTimestamp(bundle.submittedAt);archivePrincipal(bundle.author);
 const submittedDraft=draftInput({...bundle,evidence:bundle.evidence?.map(({byteLength,provenance,...input})=>input)},value.acceptanceCriteria);
 if(verificationDigest(submittedDraft)!==verificationDigest(draft))fail(422,'Historical submitted content differs from its retained draft');
 // Deliberately omit a current ProjectStore: this validates historical integrity, not freshness or authority.
 const review=inspectSubmitted(undefined,value);
 if(value.status==='APPROVED'&&!review.eligible||value.status==='REJECTED'&&!value.decisions.some((decision:any)=>decision.decision==='REJECT')||value.status==='REMEDIATION_REQUIRED'&&!value.decisions.some((decision:any)=>decision.decision==='REQUIRE_REMEDIATION')||value.status==='SUBMITTED'&&(value.decisions.some((decision:any)=>decision.decision!=='APPROVE')||value.decisions.length===REQUIRED_QUORUM_ROLES.length))fail(422,'Historical verification status is inconsistent with its decisions');
}

/** Validate and detach history. This result must never be assigned to active verificationSessions. */
export function cloneVerificationArchive(sessions:unknown,projectId:string):VerificationArchive {
 text(projectId,160,'historical source project ID');if(!Array.isArray(sessions))fail(422,'Verification history must be an array');
 const entries=sessions as VerificationSession[];
 assertVerificationRetention({verificationSessions:{[projectId]:entries}});
 const ids=new Set<string>();
 try{for(const session of entries){archiveSession(session,projectId);if(ids.has(session.id))fail(422,'Duplicate historical verification session ID');ids.add(session.id);}}
 catch(error){if(error instanceof VerificationError)throw error;fail(422,'Malformed verification history record');}
 const copied=structuredClone(entries) as VerificationSession[];
 return {schemaVersion:1,trust:'UNTRUSTED_IMPORTED_HISTORY',sourceProjectId:projectId,sessions:copied,sessionCount:copied.length,retainedBytes:copied.reduce((total,session)=>total+verificationRetainedBytes(session),0),activeReviewAuthority:false,trustedProductionEvidence:false};
}
/** Apply the same retained-session budgets across all archive batches before parent persistence. */
export function assertVerificationArchiveRetention(archives:readonly VerificationArchive[]) {
 if(!Array.isArray(archives)||archives.length>100)fail(413,'VERIFICATION_STORAGE_LIMIT: maximum 100 archive batches; no history was truncated');
 const collections:Record<string,VerificationArchive[]>={};
 for(const archive of archives) {
  shape(archive,['schemaVersion','trust','sourceProjectId','sessions','sessionCount','retainedBytes','activeReviewAuthority','trustedProductionEvidence']);
  if(archive.schemaVersion!==1||archive.trust!=='UNTRUSTED_IMPORTED_HISTORY'||archive.activeReviewAuthority!==false||archive.trustedProductionEvidence!==false)fail(422,'Imported verification history cannot carry active review authority');
  const validated=cloneVerificationArchive(archive.sessions,archive.sourceProjectId);
  if(archive.sessionCount!==validated.sessionCount||archive.retainedBytes!==validated.retainedBytes)fail(422,'Historical verification counts or byte totals are invalid');
  if(!Object.hasOwn(collections,archive.sourceProjectId))Object.defineProperty(collections,archive.sourceProjectId,{value:[],enumerable:true,writable:true,configurable:true});
  collections[archive.sourceProjectId].push(archive);
 }
 assertVerificationRetention({verificationSessions:{},verificationArchives:collections});
 if(Buffer.byteLength(JSON.stringify(archives),'utf8')>VERIFICATION_RETENTION_LIMITS.bytesTotal)fail(413,'VERIFICATION_STORAGE_LIMIT: maximum 32 MiB retained archive JSON; no history was truncated');
}
export function verificationArchiveSummary(archive:VerificationArchive) {
 return {schemaVersion:archive.schemaVersion,trust:archive.trust,sourceProjectId:archive.sourceProjectId,sessionCount:archive.sessionCount,retainedBytes:archive.retainedBytes,activeReviewAuthority:false as const,trustedProductionEvidence:false as const};
}
