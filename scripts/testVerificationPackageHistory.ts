import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../server/projectStore.ts';
import {createPortablePackage,verifyPortablePackage,serializePortablePackage,parsePortablePackage,computeCanonicalStateHash,computeEnvelopeHash} from '../server/package/portablePackage.ts';
import {createVerificationDraft,submitVerificationDraft,decideVerification,cloneVerificationArchive,projectVerificationEvidence} from '../server/verification/service.ts';
import type {VerificationArchive,VerificationPrincipal} from '../src/verificationTypes.ts';
import type {ProjectManagedDocument} from '../src/managedDocumentTypes.ts';

const project={id:'PRJ-PACKAGE-HISTORY',name:'Synthetic portable project',stateVersion:1} as any;
const sha=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex');
const principal=(id:string,role:string):VerificationPrincipal=>({identityId:id,username:id,personId:`person-${id}`,roles:[role],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',personBindingSource:'LOCAL_ROSTER_ASSERTION'});
const binding={commitSha:'a'.repeat(40),buildRevision:'synthetic-build',environment:'local-test'};
function fixture(projectId=project.id) {
 const store:any=new ProjectStore();store.projects=[{...project,id:projectId}];store.auditLogs={[projectId]:[]};store.workItems={[projectId]:[{id:'TASK-1',title:'Synthetic task',acceptanceCriteria:['Observe exact response'],status:'IN_PROGRESS',updatedAt:'2026-10-22T00:00:00.000Z'}]};
 const author=principal('synthetic-author','Security Officer');const content='HTTP 401 — 台灣\n';
 const session=createVerificationDraft(store,projectId,{expectedStateVersion:1,workItemId:'TASK-1',...binding,criterionResults:[{criterionIndex:0,result:'PASS',notes:'Synthetic observation',evidenceIds:['EV-1']}],evidence:[{id:'EV-1',kind:'LOG',encoding:'UTF8',content,sha256:sha(content)}]},author);
 submitVerificationDraft(store,projectId,session.id,{expectedStateVersion:store.projects[0].stateVersion,humanAttested:true},author);
 for(const [id,role] of [['synthetic-security','Security Officer'],['synthetic-architect','Lead Architect']])decideVerification(store,projectId,session.id,{expectedStateVersion:store.projects[0].stateVersion,...binding,submittedDigest:session.submitted!.digest,decision:'APPROVE',role,humanAttested:true,independenceAttested:true},principal(id,role));
 return {store,session,archive:cloneVerificationArchive([session],projectId)};
}
const source=fixture();const history=[source.archive];
const pkg=createPortablePackage({project,verificationHistory:history} as any);
// First RED proves the extension is missing, before testing its validation paths.
assert.deepEqual((pkg.knowledge as any).verificationHistory,history,'Portable package must preserve explicit untrusted verification history');
let checks=1;console.log('PASS explicit verification history is preserved in portable knowledge');
const check=(name:string,run:()=>void)=>{run();checks++;console.log(`PASS ${name}`);};
const reseal=(value:any)=>{value.seal.canonicalStateHash=computeCanonicalStateHash(value.knowledge);value.seal.envelopeHash=computeEnvelopeHash(value.manifest,value.seal.canonicalStateHash,value.seal.auditRootHash,value.seal.auditEventsCount);return value;};
check('omitted history preserves the literal pre-extension canonical hash input',()=>{const legacy=createPortablePackage({project});assert.equal(Object.hasOwn(legacy.knowledge,'verificationHistory'),false);assert.equal(legacy.seal.canonicalStateHash,'e54f640ca5a4e2076a7c6280bed6125f4319e13c4b2e8e55c9cc593e3e40646e');assert.equal(verifyPortablePackage(legacy).valid,true);assert.equal(createPortablePackage({project,verificationHistory:undefined} as any).seal.canonicalStateHash,legacy.seal.canonicalStateHash);});
check('explicit empty history is sealed distinctly from omitted history',()=>{const empty=createPortablePackage({project,verificationHistory:[]} as any);assert.deepEqual((empty.knowledge as any).verificationHistory,[]);assert.notEqual(empty.seal.canonicalStateHash,createPortablePackage({project}).seal.canonicalStateHash);assert.equal(verifyPortablePackage(empty).valid,true);});
check('valid approved local records round-trip only as untrusted historical claims',()=>{const roundtrip=parsePortablePackage(serializePortablePackage(pkg));assert.equal(verifyPortablePackage(roundtrip).valid,true);assert.deepEqual((roundtrip.knowledge as any).verificationHistory,history);const archive=(roundtrip.knowledge as any).verificationHistory[0];assert.equal(archive.sessions[0].status,'APPROVED');assert.equal(archive.trust,'UNTRUSTED_IMPORTED_HISTORY');assert.equal(archive.activeReviewAuthority,false);assert.equal(archive.trustedProductionEvidence,false);assert.equal(archive.sessions[0].submitted.bundle.evidence[0].content,'HTTP 401 — 台灣\n');});
check('history export is detached from caller arrays and nested attachment bytes',()=>{const input=structuredClone(history);const exported=createPortablePackage({project,verificationHistory:input} as any);input[0].sessions[0].draft.evidence[0].content='changed caller bytes';input.push(cloneVerificationArchive([],project.id));assert.deepEqual((exported.knowledge as any).verificationHistory,history);assert.equal(verifyPortablePackage(exported).valid,true);});
check('verification is read-only and cannot create active review authority',()=>{const before=JSON.stringify(source.store);const packaged=serializePortablePackage(pkg);for(let n=0;n<3;n++)assert.equal(verifyPortablePackage(pkg).valid,true);assert.equal(serializePortablePackage(pkg),packaged);assert.equal(JSON.stringify(source.store),before);const imported:any=new ProjectStore();imported.projects=[project];imported.verificationSessions={[project.id]:[]};imported.verificationArchives={[project.id]:structuredClone(history)};assert.deepEqual(projectVerificationEvidence(imported,project.id,{workItemId:'TASK-1',...binding}).eligibleSessionIds,[]);});

const foreign=fixture('PRJ-FOREIGN').archive;
const hostile:(readonly [string,(value:any)=>void])[]=[
 ['null history',value=>{value.knowledge.verificationHistory=null;}],
 ['object history',value=>{value.knowledge.verificationHistory={};}],
 ['undefined present history',value=>{value.knowledge.verificationHistory=undefined;}],
 ['null archive',value=>{value.knowledge.verificationHistory=[null];}],
 ['foreign but internally valid source project',value=>{value.knowledge.verificationHistory=[foreign];}],
 ['active authority flag',value=>{value.knowledge.verificationHistory[0].activeReviewAuthority=true;}],
 ['production trust flag',value=>{value.knowledge.verificationHistory[0].trustedProductionEvidence=true;}],
 ['unrecognized archive fields',value=>{value.knowledge.verificationHistory[0].releaseApproval={approved:true};}],
 ['unsafe archive count',value=>{value.knowledge.verificationHistory[0].sessionCount=Number.MAX_SAFE_INTEGER+1;}],
 ['forged retained byte count',value=>{value.knowledge.verificationHistory[0].retainedBytes=0;}],
 ['incorrect attachment digest',value=>{value.knowledge.verificationHistory[0].sessions[0].submitted.bundle.evidence[0].content='forged content';}],
 ['forged reviewer kind',value=>{value.knowledge.verificationHistory[0].sessions[0].decisions[0].reviewer.kind='AGENT';}],
 ['missing quorum decisions',value=>{value.knowledge.verificationHistory[0].sessions[0].decisions=[];}],
 ['oversized retained session',value=>{value.knowledge.verificationHistory[0].sessions[0].draft.criterionResults[0].notes='n'.repeat(1_048_576);}],
 ['archive batch overflow',value=>{value.knowledge.verificationHistory=Array.from({length:101},()=>cloneVerificationArchive([],project.id));}],
 ['aggregate session count overflow',value=>{const sessions=Array.from({length:60},(_,n)=>({...structuredClone(source.session),id:`VER-HISTORY-${n}`}));const archive=cloneVerificationArchive(sessions,project.id);value.knowledge.verificationHistory=[archive,structuredClone(archive)];}],
];
for(const [name,mutate] of hostile)check(`public resealing cannot authorize ${name}`,()=>{const altered=structuredClone(pkg);mutate(altered);reseal(altered);const before=JSON.stringify(altered);const result=verifyPortablePackage(altered);assert.equal(result.valid,false);assert.ok(result.errors.some(error=>error.includes('verification history')));assert.equal(JSON.stringify(altered),before,'failed verification preserves every input field');});
check('invalid creation and repeated rejection preserve caller records without growth',()=>{const input:any=structuredClone(history);input[0].activeReviewAuthority=true;const before=JSON.stringify({store:source.store,input});for(let n=0;n<3;n++)assert.throws(()=>createPortablePackage({project,verificationHistory:input} as any));assert.equal(JSON.stringify({store:source.store,input}),before);assert.equal(source.store.verificationSessions[project.id].length,1);assert.equal(source.store.verificationArchives[project.id]?.length??0,0);});
check('creation enforces exact source project binding before sealing',()=>{assert.throws(()=>createPortablePackage({project,verificationHistory:[foreign]} as any));});
check('managed document extension remains intact beside verification history',()=>{const content='# Synthetic draft\n';const document:ProjectManagedDocument={id:'MDOC-00000000-0000-4000-8000-000000000001',projectId:project.id,path:'managed-documents/MDOC-00000000-0000-4000-8000-000000000001.md',title:'Synthetic notes',kind:'ARCHITECTURE',format:'MARKDOWN',content,sha256Digest:sha(content),createdAt:'2026-10-22T00:00:00.000Z',updatedAt:'2026-10-22T00:01:00.000Z',requestIds:['00000000-0000-4000-8000-000000000002']};const together=createPortablePackage({project,managedDocuments:[document],verificationHistory:history} as any);assert.equal(verifyPortablePackage(together).valid,true);assert.deepEqual(together.knowledge.managedDocuments,[document]);assert.deepEqual((together.knowledge as any).verificationHistory,history);const altered=structuredClone(together);altered.knowledge.managedDocuments![0].content='forged';reseal(altered);assert.equal(verifyPortablePackage(altered).valid,false);});
console.log(`Verification package history: ${checks} checks passed`);
