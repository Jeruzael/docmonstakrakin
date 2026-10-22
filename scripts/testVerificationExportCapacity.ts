import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../server/projectStore.ts';
import {createVerificationDraft,cloneVerificationArchive} from '../server/verification/service.ts';
import {assertVerificationStoreRetention} from '../server/verification/retention.ts';
import {createPortablePackage,verifyPortablePackage} from '../server/package/portablePackage.ts';
import type {VerificationPrincipal} from '../src/verificationTypes.ts';

// Derived compatibility constraint: export preserves every stored history batch and appends
// one batch for all active sessions. Admission must reserve that batch, not grow the public
// 100-batch package limit or silently coalesce, prune, or truncate imported history.
const projectId='PRJ-EXPORT-CAPACITY';
const author:VerificationPrincipal={identityId:'synthetic-author',username:'synthetic-author',personId:'person-synthetic-author',roles:['Security Officer'],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',personBindingSource:'LOCAL_ROSTER_ASSERTION'};
function fixture(batches:number) {
 const store=new ProjectStore();store.projects=[{id:projectId,name:'Synthetic export capacity',stateVersion:1,updatedAt:'2026-10-22T00:00:00.000Z'} as any];store.workItems={[projectId]:[{id:'TASK-1',title:'Synthetic',acceptanceCriteria:['Observe result'],status:'IN_PROGRESS',updatedAt:'2026-10-22T00:00:00.000Z'} as any]};store.auditLogs={[projectId]:[]};store.verificationSessions={[projectId]:[]};store.verificationArchives={[projectId]:Array.from({length:batches},()=>cloneVerificationArchive([],projectId))};return store;
}
function draft(store:ProjectStore) {return createVerificationDraft(store,projectId,{expectedStateVersion:store.projects[0].stateVersion,workItemId:'TASK-1',commitSha:'a'.repeat(40),buildRevision:'synthetic-build',environment:'local',criterionResults:[{criterionIndex:0,result:'PASS',notes:'Synthetic observation',evidenceIds:['EV-1']}],evidence:[{id:'EV-1',kind:'LOG',encoding:'UTF8',content:'Observed',sha256:createHash('sha256').update('Observed').digest('hex')}]},author);}
function exported(store:ProjectStore) {const active=store.verificationSessions[projectId];return createPortablePackage({project:store.projects[0],verificationHistory:[...store.verificationArchives[projectId],...(active.length?[cloneVerificationArchive(active,projectId)]:[])]});}
let checks=0;const check=(name:string,run:()=>void)=>{run();checks++;console.log(`PASS ${name}`);};

check('100 stored empty batches reserve no unnecessary active export batch',()=>{const store=fixture(100);const before=JSON.stringify(store);assert.doesNotThrow(()=>assertVerificationStoreRetention(store));const pkg=exported(store);assert.equal(pkg.knowledge.verificationHistory!.length,100);assert.equal(verifyPortablePackage(pkg).valid,true);assert.equal(JSON.stringify(store),before);});
check('creating active work beside 100 stored batches rejects before state and audit mutation',()=>{const store=fixture(100);const before=JSON.stringify(store);assert.throws(()=>draft(store),error=>(error as any).status===413);assert.equal(JSON.stringify(store),before,'capacity rejection preserves all collections, project version, timestamps and audit bytes');assert.equal(store.verificationSessions[projectId].length,0);assert.equal(store.verificationArchives[projectId].length,100);assert.equal(store.auditLogs[projectId].length,0);assert.equal(store.projects[0].stateVersion,1);});
check('99 stored batches plus an active session export exactly 100 preserved batches',()=>{const store=fixture(99);const created=draft(store);assert.equal(store.verificationSessions[projectId][0].id,created.id);assert.equal(store.projects[0].stateVersion,2);assert.equal(store.auditLogs[projectId].length,1);assert.doesNotThrow(()=>assertVerificationStoreRetention(store));const before=JSON.stringify(store);const pkg=exported(store);assert.equal(pkg.knowledge.verificationHistory!.length,100);assert.equal(pkg.knowledge.verificationHistory![99].sessions[0].id,created.id);assert.equal(pkg.knowledge.verificationHistory!.slice(0,99).every(archive=>archive.sessionCount===0),true);assert.equal(verifyPortablePackage(pkg).valid,true);assert.equal(JSON.stringify(store),before,'successful export cannot coalesce history or grow stored sessions');});
check('pre-existing over-reserved state is rejected without deleting history or active evidence',()=>{const store=fixture(99);draft(store);store.verificationArchives[projectId].push(cloneVerificationArchive([],projectId));const before=JSON.stringify(store);assert.throws(()=>assertVerificationStoreRetention(store),error=>(error as any).status===413);assert.equal(JSON.stringify(store),before);});
check('the original 100 stored global batch ceiling remains enforced',()=>{const store=fixture(100);store.verificationArchives['PRJ-OTHER']=[cloneVerificationArchive([],'PRJ-OTHER')];assert.throws(()=>assertVerificationStoreRetention(store),error=>(error as any).status===413);assert.equal(store.verificationArchives[projectId].length,100);assert.equal(store.verificationArchives['PRJ-OTHER'].length,1);});
console.log(`Verification export capacity: ${checks} checks passed`);
