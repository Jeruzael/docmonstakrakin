import assert from 'node:assert/strict';
import {startPackageFixture} from './fixtures/projectsWorkspaceUiServer.ts';

const fixture=await startPackageFixture({schemaVersion:1,state:{projects:[{id:'PRJ-DOCMONSTAKRAKIN',name:'Synthetic canonical guard',stateVersion:1}],requirements:{},workItems:{},auditLogs:{}}});
const call=async(path:string,body?:unknown)=>{const r=await fetch(fixture.base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
try {
  const p=await call('/api/projects',{name:'Synthetic linked work',profiles:['WEB_APPLICATION']});
  assert.equal(p.status,201);const id=p.body.id,base=`/api/projects/${id}`;
  const answer=await call(base+'/answers',{questionId:'PROD-Q-001',answer:'workflow_efficiency'});assert.equal(answer.status,200);
  const requirement=answer.body.derivedRequirements[0];assert(requirement);assert.equal(requirement.status,'PROPOSED');
  const before=(await call(base)).body;
  const derived=await call(base+'/work-items',{operation:'DERIVE_REQUIREMENT',requirementId:requirement.id,expectedStateVersion:before.stateVersion});
  assert.equal(derived.status,201,JSON.stringify(derived.body));
  assert.equal(derived.body.workItem.status,'PROPOSED');assert.deepEqual(derived.body.workItem.requirements,[requirement.id]);
  assert.deepEqual(derived.body.workItem.evidence,[]);assert.deepEqual(derived.body.workItem.tests,[]);
  const saved=fixture.reopen();assert.deepEqual(saved.state.requirements[id][0].workItems,[derived.body.workItem.id]);
  console.log('PASS explicit derivation persists a real PROPOSED WorkItem and reciprocal requirement link');
  const bytes=fixture.bytes(),version=(await call(base)).body.stateVersion;
  const repeat=await call(base+'/work-items',{operation:'DERIVE_REQUIREMENT',requirementId:requirement.id,expectedStateVersion:version});
  assert.equal(repeat.status,200);assert.equal(repeat.body.created,false);assert.deepEqual(fixture.bytes(),bytes);
  console.log('PASS current-version re-derivation returns existing work without duplicate audit or persistence');
  for(const body of [
    {operation:'DERIVE_REQUIREMENT',requirementId:requirement.id,expectedStateVersion:version-1},
    {operation:'DERIVE_REQUIREMENT',requirementId:'missing',expectedStateVersion:version},
    {operation:'DERIVE_REQUIREMENT',requirementId:requirement.id,expectedStateVersion:version,status:'APPROVED'},
    {operation:'DERIVE_REQUIREMENT',requirementId:requirement.id},
    {operation:'UNKNOWN',requirementId:requirement.id,expectedStateVersion:version},
  ]){const r=await call(base+'/work-items',body);assert(r.status>=400);assert.deepEqual(fixture.bytes(),bytes);}
  console.log('PASS stale, missing, spoofed and unknown operations fail without state change');
  const denied=await call(base+'/work-items',{itemId:derived.body.workItem.id,status:'VERIFIED'});assert.equal(denied.status,401);assert.deepEqual(fixture.bytes(),bytes);
  console.log('PASS a derived work item cannot bypass the real human verification gate');
  const changed=await call(base+'/answers',{questionId:'PROD-Q-001',answer:'security_assurance'});assert.equal(changed.status,200);
  assert.deepEqual(changed.body.derivedRequirements[0].workItems,[derived.body.workItem.id]);
  assert.equal((await call(base+'/work-items')).body.find((w:any)=>w.id===derived.body.workItem.id).description,requirement.statement,'Existing work is not silently rewritten by later discovery');
  console.log('PASS later discovery preserves existing reciprocal work links without rewriting task commitments');
  await fixture.restart();assert.equal((await call(base+'/work-items')).body.filter((w:any)=>w.id===derived.body.workItem.id).length,1);
  console.log('PASS derived work and links survive actual server restart');
  const guarded=fixture.bytes();assert.equal((await call('/api/projects/PRJ-DOCMONSTAKRAKIN/work-items',{operation:'DERIVE_REQUIREMENT',requirementId:requirement.id,expectedStateVersion:1})).status,409);assert.deepEqual(fixture.bytes(),guarded);
  console.log('PASS canonical self-project registration cannot be reached through ordinary requirement derivation');
  const unicodeIds=['REQ-\ufffd','REQ-\ud800'],unicodeTasks:string[]=[];
  for(const requirementId of unicodeIds){
    const created=await call(base+'/requirements',{id:requirementId,title:'Synthetic Unicode identity',statement:'Distinct accepted requirement identity',acceptanceCriteria:['Keep the exact governing requirement identity']});
    assert.equal(created.status,201);assert.equal(created.body.id,requirementId);
    const version=(await call(base)).body.stateVersion;
    const linked=await call(base+'/work-items',{operation:'DERIVE_REQUIREMENT',requirementId,expectedStateVersion:version});
    assert.equal(linked.status,201,'Distinct accepted Unicode identities must each derive their own task');assert.equal(linked.body.workItem.status,'PROPOSED');
    assert.deepEqual(linked.body.workItem.requirements,[requirementId]);assert.deepEqual(linked.body.workItem.tests,[]);assert.deepEqual(linked.body.workItem.evidence,[]);unicodeTasks.push(linked.body.workItem.id);
  }
  assert.equal(new Set(unicodeTasks).size,2);
  const unicodeState=fixture.reopen();for(const [index,requirementId] of unicodeIds.entries())assert.deepEqual(unicodeState.state.requirements[id].find((item:any)=>item.id===requirementId).workItems,[unicodeTasks[index]]);
  console.log('PASS distinct accepted replacement-character and unpaired-surrogate requirement IDs persist separate PROPOSED tasks and reciprocal links');
  const unicodeBytes=fixture.bytes();assert.equal((await call(base+'/work-items',{itemId:unicodeTasks[1],status:'VERIFIED'})).status,401);assert.deepEqual(fixture.bytes(),unicodeBytes);
  assert.deepEqual((await call(base+'/governance-policy')).body.requiredRoles,['Security Officer','Lead Architect']);
  console.log('PASS Unicode-safe requirement derivation retains actual human verification denial and unchanged governance quorum');
} finally {await fixture.close();}
