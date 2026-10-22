import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomBytes, scryptSync} from 'node:crypto';
import express from 'express';
import {ProjectStore} from '../server/projectStore.ts';
import {installProjectPersistence, snapshotProjectStore, writeProjectSnapshotAtomic, readProjectSnapshot, hydrateProjectStoreFromSnapshot} from '../server/projectPersistence.ts';
import {installReviewerIdentity} from '../server/proposals/identity.ts';

// A missing feature must fail as an assertion before loading the candidate.
assert.ok(fs.existsSync(new URL('../server/verification/routes.ts', import.meta.url)), 'Verification routes must exist');
const {registerVerificationRoutes} = await import('../server/verification/routes.ts');
const {projectVerificationEvidence,verificationDigest} = await import('../server/verification/service.ts');
const sha = (s:string) => createHash('sha256').update(s).digest('hex');
const verifier = (password:string) => {const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,32).toString('hex')}`;};
const password='Synthetic-only-password';
const records = {
  author:{id:'author',personId:'person-author',kind:'HUMAN',roles:['Security Officer'],credentialVerifier:verifier(password)},
  security:{id:'security',personId:'person-security',kind:'HUMAN',roles:['Security Officer'],credentialVerifier:verifier(password)},
  architect:{id:'architect',personId:'person-architect',kind:'HUMAN',roles:['Lead Architect'],credentialVerifier:verifier(password)},
  duplicate:{id:'duplicate',personId:'person-security',kind:'HUMAN',roles:['Lead Architect'],credentialVerifier:verifier(password)},
  unbound:{id:'unbound',kind:'HUMAN',roles:['Lead Architect'],credentialVerifier:verifier(password)},
  agent:{id:'agent',personId:'person-agent',kind:'AGENT',roles:['Security Officer'],credentialVerifier:verifier(password)},
};
const savedRoster=process.env.DMK_HUMAN_REVIEWERS;
process.env.DMK_HUMAN_REVIEWERS=JSON.stringify(records);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-verification-'));
const store:any=new ProjectStore();
store.projects=[{id:'A',name:'Fixture A',stateVersion:1},{id:'B',name:'Fixture B',stateVersion:1}];
const item={id:'TASK-1',type:'TASK',title:'Bounded fixture',description:'Synthetic',status:'IN_PROGRESS',priority:'P1',risk:'LOW',sprint:1,requirements:[],dependencies:[],acceptanceCriteria:['Reject unauthenticated requests'],checklist:[],tests:[],evidence:[],updatedAt:'2026-10-22T00:00:00.000Z'};
store.workItems={A:[structuredClone(item)],B:[structuredClone(item)]};store.auditLogs={A:[],B:[]};
const app=express();app.use(express.json({limit:'1mb'}));installProjectPersistence(app,store,root);
registerVerificationRoutes(app,store,installReviewerIdentity(app).requireHuman);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const base=`http://127.0.0.1:${(server.address() as any).port}`;
const cookies:Record<string,string>={};
let checks=0;
async function request(suffix:string,method='GET',body?:any,who='author',project='A') {
 const payload=body===undefined?undefined:{expectedReviewer:{identityId:(records as any)[who]?.id,personId:(records as any)[who]?.personId},...body};
 const res=await fetch(`${base}/api/projects/${project}/verification-sessions${suffix}`,{method,headers:{'Content-Type':'application/json',...(cookies[who]?{Cookie:cookies[who]}:{})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
 return {status:res.status,data:await res.json() as any};
}
function check(actual:unknown,expected:unknown,message:string) {assert.deepEqual(actual,expected,message);checks++;console.log(`PASS ${message}`);}
const binding={commitSha:'a'.repeat(40),buildRevision:'fixture-build-1',environment:'local-test'};
const body=()=>({expectedStateVersion:store.projects[0].stateVersion,workItemId:'TASK-1',...binding,criterionResults:[{criterionIndex:0,result:'PASS',notes:'Observed 401',evidenceIds:['LOG-1']}],evidence:[{id:'LOG-1',kind:'LOG',encoding:'UTF8',content:'HTTP 401',sha256:sha('HTTP 401')}]});
const version=()=>store.projects[0].stateVersion;
async function createAndSubmit() {
 const created=await request('','POST',body());check(created.status,201,'create binds draft to exact project and work item');
 const submitted=await request(`/${created.data.session.id}/submit`,'POST',{expectedStateVersion:version(),humanAttested:true});check(submitted.status,200,'submit immutable bundle');return submitted.data.session;
}
try {
 for(const who of Object.keys(records)) {const response=await fetch(`${base}/api/governance/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:who,password})});cookies[who]=response.headers.get('set-cookie')!.split(';')[0];}
 check((await request('','GET',undefined,'anonymous')).status,401,'anonymous list denied');
 check((await request('','GET',undefined,'agent')).status,403,'agent denied');
 check((await request('','GET',undefined,'unbound')).status,403,'account without person binding denied');
 check((await request('','POST',{...body(),expectedReviewer:undefined})).status,422,'mutation requires explicit expected reviewer binding');
 const beforeActorMismatch=JSON.stringify(snapshotProjectStore(store));
 const actorMismatch=await request('','POST',{...body(),expectedReviewer:{identityId:'someone-else',personId:'other-person'}});
 check(actorMismatch.status,409,'reviewer switch rejects stale personal confirmation before mutation');
 check(actorMismatch.data.identity.identityId,'author','identity mismatch response names actual authenticated principal');
 check(JSON.stringify(snapshotProjectStore(store)),beforeActorMismatch,'reviewer mismatch leaves all project state unchanged');
 check((await request('','POST',{...body(),expectedStateVersion:undefined})).status,422,'missing CAS rejected');
 check((await request('','POST',{...body(),expectedStateVersion:0})).status,409,'stale project CAS rejected');
 check((await request('','POST',{...body(),author:{id:'spoof'}})).status,422,'client identity spoof rejected');
 check((await request('','POST',{...body(),workItemId:'OTHER'})).status,404,'foreign or missing task rejected');
 check((await request('','POST',{...body(),evidence:[{...body().evidence[0],sha256:'0'.repeat(64)}]})).status,422,'incorrect inline digest rejected');
 check((await request('','POST',{...body(),evidence:[{...body().evidence[0],content:'x'.repeat(70_000)}]})).status,422,'oversized inline evidence rejected');
 check((await request('','POST',{...body(),evidence:[{...body().evidence[0],provenance:'AUTHENTICATED_PRODUCER'}]})).status,422,'producer authority cannot be supplied by client');
 const rollback=async(suffix:string,method:string,input:any,who='author')=>{
  const before=JSON.stringify(snapshotProjectStore(store));
  const disk=fs.existsSync(path.join(root,'.local','project-state.json'))?fs.readFileSync(path.join(root,'.local','project-state.json'),'utf8'):null;
  fs.mkdirSync(path.join(root,'.local'),{recursive:true});const lock=path.join(root,'.local','project-state.write.lock');fs.writeFileSync(lock,'fixture lock');
  try {check((await request(suffix,method,input,who)).status,500,`${method} ${suffix||'draft'} reports persistence failure`);}finally{fs.unlinkSync(lock);}
  check(JSON.stringify(snapshotProjectStore(store)),before,`${method} ${suffix||'draft'} rolls back session, audit and stateVersion`);
  check(fs.existsSync(path.join(root,'.local','project-state.json'))?fs.readFileSync(path.join(root,'.local','project-state.json'),'utf8'):null,disk,'failed write preserves disk bytes');
 };
 await rollback('','POST',body());
 const draftCreated=await request('','POST',body());const draftId=draftCreated.data.session.id;
 const {workItemId:ignoredWorkItem,...draftPatch}=body();
 await rollback(`/${draftId}`,'PATCH',draftPatch);
 check((await request(`/${draftId}`,'PATCH',draftPatch)).status,200,'author can revise draft before submission');
 const intactDraft=structuredClone(store.verificationSessions.A.find((s:any)=>s.id===draftId).draft);
 store.verificationSessions.A.find((s:any)=>s.id===draftId).draft.evidence[0].content='altered after draft';
 check((await request(`/${draftId}/submit`,'POST',{expectedStateVersion:version(),humanAttested:true})).status,422,'submission rechecks exact draft evidence bytes');
 store.verificationSessions.A.find((s:any)=>s.id===draftId).draft=intactDraft;
 await rollback(`/${draftId}/submit`,'POST',{expectedStateVersion:version(),humanAttested:true});
 store.workItems.A[0].acceptanceCriteria=['Changed criterion'];
 check((await request(`/${draftId}/submit`,'POST',{expectedStateVersion:version(),humanAttested:true})).status,409,'submission rejects stale work-item criteria');
 store.workItems.A[0]=structuredClone(item);
 let session=await createAndSubmit();
 check(session.submitted.bundle.author.identityId,'author','author comes from authenticated session');
 check(session.submitted.bundle.evidence[0].sha256,sha('HTTP 401'),'exact bytes hash stored');
 check(session.submitted.bundle.evidence[0].provenance,'HUMAN_ATTESTED_INLINE','inline evidence provenance explicit');
 const {workItemId,...patch}=body();
 check((await request(`/${session.id}`,'PATCH',patch)).status,409,'submitted bundle cannot be edited');
 check((await request(`/${session.id}`,'GET',undefined,'author','B')).status,404,'cross-project session read denied');
 const decision=(extra:any={})=>({expectedStateVersion:version(),submittedDigest:session.submitted.digest,decision:'APPROVE',role:'Security Officer',humanAttested:true,independenceAttested:true,...binding,...extra});
 check((await request(`/${session.id}/decisions`,'POST',decision())).status,403,'submitter self approval denied');
 check((await request(`/${session.id}/decisions`,'POST',decision({role:'Lead Architect'}),'security')).status,403,'role spoof denied');
 check((await request(`/${session.id}/decisions`,'POST',decision({submittedDigest:'0'.repeat(64)}),'security')).status,409,'stale digest rejected');
 check((await request(`/${session.id}/decisions`,'POST',decision({buildRevision:'other-build'}),'security')).status,409,'stale build binding rejected');
 check((await request(`/${session.id}/decisions`,'POST',decision({humanAttested:false}),'security')).status,422,'approval requires explicit human review attestation');
 check((await request(`/${session.id}/decisions`,'POST',decision({independenceAttested:false}),'security')).status,422,'approval requires explicit independence attestation');
 check((await request(`/${session.id}/decisions`,'POST',decision({decision:'REJECT'}),'security')).status,422,'rejection reason required');
 check((await request(`/${session.id}/decisions`,'POST',decision({decision:'REQUIRE_REMEDIATION'}),'security')).status,422,'remediation reason required');
 await rollback(`/${session.id}/decisions`,'POST',decision(),'security');
 check((await request(`/${session.id}/decisions`,'POST',decision(),'security')).status,200,'first independent human decision accepted');
 check((await request(`/${session.id}/decisions`,'POST',decision({role:'Lead Architect'}),'duplicate')).status,403,'two accounts for same roster person cannot form quorum');
 check((await request(`/${session.id}/decisions`,'POST',decision(),'security')).status,403,'duplicate person signing rejected');
 const approved=await request(`/${session.id}/decisions`,'POST',decision({role:'Lead Architect'}),'architect');check(approved.status,200,'distinct roster humans satisfy both roles');
 check(approved.data.session.status,'APPROVED','local evidence review approval recorded');
 check(store.workItems.A[0].status,'IN_PROGRESS','approval never mutates work-item lifecycle');
 const admission=projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding});
 check(admission.eligibleSessionIds,[session.id],'read-only admission accepts exact approved local bundle');
 check(admission.trustedProductionEvidence,false,'local reviews never claim trusted production evidence');
 const restarted:any=new ProjectStore();hydrateProjectStoreFromSnapshot(restarted,readProjectSnapshot(root)!);
 check(projectVerificationEvidence(restarted,'A',{workItemId:'TASK-1',...binding}).eligibleSessionIds,[session.id],'submitted bundle and decisions survive snapshot rehydration');
 check(projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding,commitSha:'b'.repeat(40)}).eligibleSessionIds,[],'admission rejects other commit');
 check(projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding,environment:'production'}).eligibleSessionIds,[],'admission rejects other environment');
 store.workItems.A[0].acceptanceCriteria.push('New criterion');
 check(projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding}).eligibleSessionIds,[],'admission rejects stale task criteria');
 store.workItems.A[0]=structuredClone(item);
 const persistedSession=store.verificationSessions.A.find((s:any)=>s.id===session.id);const original=structuredClone(persistedSession);
 persistedSession.submitted.bundle.evidence[0].content='tampered';
 check(projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding}).eligibleSessionIds,[],'admission recomputes submitted integrity');
 Object.assign(persistedSession,structuredClone(original));persistedSession.decisions[1].reviewer.personId='person-security';
 check(projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding}).eligibleSessionIds,[],'stored duplicate person decisions fail closed');
 Object.assign(persistedSession,structuredClone(original));persistedSession.submitted.bundle.requiredRoles=['Security Officer'];
 persistedSession.submitted.digest=verificationDigest(persistedSession.submitted.bundle);
 for(const storedDecision of persistedSession.decisions)storedDecision.submittedDigest=persistedSession.submitted.digest;
 check(projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding}).eligibleSessionIds,[],'stored reduced quorum cannot supply evidence admission');
 Object.assign(persistedSession,structuredClone(original));
 for(const outcome of ['REJECT','REQUIRE_REMEDIATION']) {
  session=await createAndSubmit();const result=await request(`/${session.id}/decisions`,'POST',decision({decision:outcome,reason:'Synthetic bounded reviewer reason'}),'security');
  check(result.data.session.status,outcome==='REJECT'?'REJECTED':'REMEDIATION_REQUIRED',`${outcome} closes local review with recorded reason`);
  check(result.data.session.decisions[0].reason,'Synthetic bounded reviewer reason','reviewer reason preserved');
 }
 const referenceBody=body();referenceBody.evidence[0]={...referenceBody.evidence[0],kind:'REFERENCE',content:'https://invalid.example/not-read',sha256:sha('https://invalid.example/not-read')};
 const refCreated=await request('','POST',referenceBody);const refSubmitted=await request(`/${refCreated.data.session.id}/submit`,'POST',{expectedStateVersion:version(),humanAttested:true});session=refSubmitted.data.session;
 check(session.submitted.bundle.evidence[0].provenance,'UNVERIFIED_REFERENCE','reference text retains unverified provenance');
 check((await request(`/${session.id}/decisions`,'POST',decision(),'security')).status,422,'references alone cannot satisfy passing evidence admission');
 const retained=structuredClone(store.verificationSessions);
 store.verificationSessions.A=Array.from({length:100},(_,n)=>({...structuredClone(retained.A[0]),id:`VER-COUNT-${n}`}));
 const beforeCount=JSON.stringify(snapshotProjectStore(store));
 check((await request('','POST',body())).status,413,'per-project session admission limit rejects the next session');
 check(JSON.stringify(snapshotProjectStore(store)),beforeCount,'capacity rejection preserves all prior sessions without truncation');
 const summaryList=await request('');check(summaryList.status,200,'bounded existing sessions remain available as summaries');
 check(summaryList.data.sessions.length,100,'summary listing does not silently truncate records');
 check(summaryList.data.sessions[0].draft,undefined,'session summary excludes draft evidence and notes');
 check(summaryList.data.sessions[0].submitted,undefined,'session summary excludes submitted attachment bytes');
 check(JSON.stringify(summaryList.data).includes('HTTP 401'),false,'list response contains no inline attachment content');
 store.verificationSessions=retained;
 const {assertVerificationRetention}=await import('../server/verification/retention.ts');
 const capacityFixture=(projects:number,count:number,bytes:number)=>({verificationSessions:Object.fromEntries(Array.from({length:projects},(_,p)=>[`P-${p}`,Array.from({length:count},(_,n)=>({id:`V-${p}-${n}`,projectId:`P-${p}`,notes:'x'.repeat(bytes)}))]))}) as any;
 for(const [name,fixture] of [['session byte limit',capacityFixture(1,1,1_048_576)],['project retained byte limit',capacityFixture(1,9,983_040)],['aggregate retained byte limit',capacityFixture(5,7,983_040)],['aggregate session count limit',capacityFixture(6,84,1)]] as const) {
  const before=sha(JSON.stringify(fixture));assert.throws(()=>assertVerificationRetention(fixture),error=>(error as any).status===413,name);checks++;console.log(`PASS ${name} rejects without truncation`);check(sha(JSON.stringify(fixture)),before,`${name} preserves every retained byte`);
 }
 const shared=capacityFixture(1,60,1);shared.verificationArchives={'P-0':[{schemaVersion:1,trust:'UNTRUSTED_IMPORTED_HISTORY',sourceProjectId:'P-0',activeReviewAuthority:false,trustedProductionEvidence:false,sessions:capacityFixture(1,41,1).verificationSessions['P-0']}]};
 assert.throws(()=>assertVerificationRetention(shared),error=>(error as any).status===413,'active and archived sessions must share one project count budget');checks++;console.log('PASS active and archived sessions share one retained count budget');
 for(const [name,projects,activeCount,archivedCount] of [['project',1,4,5],['global',5,3,4]] as const) {
  const combined=capacityFixture(projects,activeCount,983_040);const historical=capacityFixture(projects,archivedCount,983_040);
  combined.verificationArchives=Object.fromEntries(Object.entries(historical.verificationSessions).map(([projectId,sessions])=>[projectId,[{schemaVersion:1,trust:'UNTRUSTED_IMPORTED_HISTORY',sourceProjectId:projectId,sessions,activeReviewAuthority:false,trustedProductionEvidence:false}]]));
  const before=sha(JSON.stringify(combined));assert.throws(()=>assertVerificationRetention(combined),error=>(error as any).status===413,`${name} bytes must include active and archived records`);checks++;console.log(`PASS ${name} active and archived bytes share one budget`);check(sha(JSON.stringify(combined)),before,`${name} combined byte rejection preserves every record`);
 }
 store.workItems.A[0].acceptanceCriteria=Array.from({length:100},(_,n)=>`Bounded criterion ${n}`);
 const bulky=body();bulky.evidence=Array.from({length:4},(_,n)=>({id:`LOG-${n}`,kind:'LOG',encoding:'UTF8',content:'x'.repeat(65536),sha256:sha('x'.repeat(65536))}));bulky.criterionResults=Array.from({length:100},(_,criterionIndex)=>({criterionIndex,result:'PASS',notes:'n'.repeat(4000),evidenceIds:['LOG-0']}));
 const bulkyCreated=await request('','POST',bulky);check(bulkyCreated.status,201,'bounded draft may be admitted before submitted duplication reaches retention cap');
 const beforeBulky=JSON.stringify(snapshotProjectStore(store));const beforeBulkyDisk=fs.readFileSync(path.join(root,'.local','project-state.json'),'utf8');
 check((await request(`/${bulkyCreated.data.session.id}/submit`,'POST',{expectedStateVersion:version(),humanAttested:true})).status,413,'submission includes retained draft and submitted bundle in capacity admission');
 check(JSON.stringify(snapshotProjectStore(store)),beforeBulky,'oversized submission preserves the complete draft and project version');
 check(fs.readFileSync(path.join(root,'.local','project-state.json'),'utf8'),beforeBulkyDisk,'oversized submission leaves exact persisted snapshot unchanged');
 store.workItems.A[0]=structuredClone(item);
 // Restore disk and memory coherently before persistence failure injection.
 store.verificationSessions={};writeProjectSnapshotAtomic(snapshotProjectStore(store),root);
 // The middleware rejects outside snapshot edits before mutation.
 check((await request('','POST',body())).status,409,'external snapshot mutation fails closed');
 console.log(`Verification workflow: ${checks} checks passed`);
} finally {
 await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 if(savedRoster===undefined)delete process.env.DMK_HUMAN_REVIEWERS;else process.env.DMK_HUMAN_REVIEWERS=savedRoster;
 assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('dmk-verification-'));
 fs.rmSync(root,{recursive:true,force:true});
}
