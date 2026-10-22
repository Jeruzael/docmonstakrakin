import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../server/projectStore.ts';
import * as workflow from '../server/verification/service.ts';
import type {VerificationPrincipal} from '../src/verificationTypes.ts';

assert.equal(typeof workflow.cloneVerificationArchive,'function','Strict verification archive clone must exist');
const {cloneVerificationArchive,assertVerificationArchiveRetention,verificationArchiveSummary}=workflow;
const store:any=new ProjectStore();store.projects=[{id:'A',stateVersion:1}];store.auditLogs={A:[]};store.workItems={A:[{id:'TASK-1',title:'Synthetic',status:'IN_PROGRESS',acceptanceCriteria:['Observed response'],updatedAt:'2026-10-22T00:00:00.000Z'}]};
const principal=(id:string,role:string):VerificationPrincipal=>({identityId:id,username:id,personId:`person-${id}`,roles:[role],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',personBindingSource:'LOCAL_ROSTER_ASSERTION'});
const author=principal('author','Security Officer');const binding={commitSha:'a'.repeat(40),buildRevision:'fixture-build',environment:'local'};
const session=workflow.createVerificationDraft(store,'A',{expectedStateVersion:1,workItemId:'TASK-1',...binding,criterionResults:[{criterionIndex:0,result:'PASS',notes:'Synthetic observation',evidenceIds:['EV-1']}],evidence:[{id:'EV-1',kind:'MANUAL',encoding:'UTF8',content:'Observed',sha256:createHash('sha256').update('Observed').digest('hex')}]},author);
workflow.submitVerificationDraft(store,'A',session.id,{expectedStateVersion:store.projects[0].stateVersion,humanAttested:true},author);
for(const [id,role] of [['security','Security Officer'],['architect','Lead Architect']])workflow.decideVerification(store,'A',session.id,{expectedStateVersion:store.projects[0].stateVersion,...binding,submittedDigest:session.submitted!.digest,decision:'APPROVE',role,humanAttested:true,independenceAttested:true},principal(id,role));
let checks=0;const check=(name:string,run:()=>void)=>{run();checks++;console.log(`PASS ${name}`);};
check('valid local review becomes explicitly untrusted portable history',()=>{const archive=cloneVerificationArchive([session],'A');assert.equal(archive.trust,'UNTRUSTED_IMPORTED_HISTORY');assert.equal(archive.activeReviewAuthority,false);assert.equal(archive.trustedProductionEvidence,false);assert.equal(archive.sessionCount,1);assert.equal(archive.sessions[0].status,'APPROVED');});
check('historical validation does not require current task criteria to remain unchanged',()=>{store.workItems.A[0].acceptanceCriteria=['Changed current criterion'];assert.equal(cloneVerificationArchive([session],'A').sessionCount,1);});
check('clone and byte-free summary cannot alias or expose attachment content',()=>{const archive=cloneVerificationArchive([session],'A');archive.sessions[0].draft.evidence[0].content='changed archive clone';assert.equal(session.draft.evidence[0].content,'Observed');const summary=verificationArchiveSummary(cloneVerificationArchive([session],'A'));assert.equal(Object.hasOwn(summary,'sessions'),false);assert.equal(JSON.stringify(summary).includes('Observed'),false);});
for(const [name,mutate] of [
 ['cross-project binding',(s:any)=>{s.projectId='B';}],
 ['submitted content tampering',(s:any)=>{s.submitted.bundle.evidence[0].content='tampered';}],
 ['agent reviewer',(s:any)=>{s.decisions[0].reviewer.kind='AGENT';}],
 ['extra session authority fields',(s:any)=>{s.releaseApproved=true;}],
 ['draft byte/hash mismatch',(s:any)=>{s.draft.evidence[0].sha256='0'.repeat(64);}]
] as const)check(`archive rejects ${name}`,()=>{const altered=structuredClone(session);mutate(altered);assert.throws(()=>cloneVerificationArchive([altered],'A'));});
check('archive rejects rehashed weakened quorum policy',()=>{const altered=structuredClone(session);altered.submitted!.bundle.requiredRoles=['Security Officer'];altered.submitted!.digest=workflow.verificationDigest(altered.submitted!.bundle);for(const decision of altered.decisions)decision.submittedDigest=altered.submitted!.digest;assert.throws(()=>cloneVerificationArchive([altered],'A'));});
check('archive rejects inconsistent approved status without quorum',()=>{const altered=structuredClone(session);altered.decisions=[];assert.throws(()=>cloneVerificationArchive([altered],'A'));});
check('archive rejects count overflow without truncation',()=>{const sessions=Array.from({length:101},(_,n)=>({...structuredClone(session),id:`VER-${n}`}));assert.throws(()=>cloneVerificationArchive(sessions,'A'),error=>(error as any).status===413);assert.equal(sessions.length,101);});
check('aggregate archive admission counts repeated history rather than silently dropping it',()=>{const sessions=Array.from({length:60},(_,n)=>({...structuredClone(session),id:`VER-${n}`}));const archive=cloneVerificationArchive(sessions,'A');assert.throws(()=>assertVerificationArchiveRetention([archive,archive]),error=>(error as any).status===413);assert.equal(archive.sessions.length,60);});
check('imported approved history never contributes to active evidence admission',()=>{store.verificationArchives={A:[cloneVerificationArchive([session],'A')]};store.verificationSessions={A:[]};assert.deepEqual(workflow.projectVerificationEvidence(store,'A',{workItemId:'TASK-1',...binding}).eligibleSessionIds,[]);});
console.log(`Verification archive: ${checks} checks passed`);
