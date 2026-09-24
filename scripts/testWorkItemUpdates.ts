import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ProjectStore} from '../server/projectStore.ts';
import {snapshotProjectStore} from '../server/projectPersistence.ts';
import {verifyAuditLedgerChain} from '../server/security/auditImmutability.ts';
import {startPackageFixture} from './fixtures/projectsWorkspaceUiServer.ts';

const store=new ProjectStore();
const projectId=store.projects[0].id,item=store.workItems[projectId][0];
const fixture=await startPackageFixture(snapshotProjectStore(store));
const url=fixture.base+`/api/projects/${projectId}/work-items`;
const post=(body:any)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
try {
  const before=fixture.bytes();
  for(const body of [{itemId:item.id,status:'VERIFIED'},{itemId:item.id,status:''},{itemId:item.id,status:'VERIFICATION_PENDING'},
    {itemId:item.id,checklistIndex:-1,checklistDone:true},{itemId:item.id,checklistIndex:0,checklistDone:'true'},
    {itemId:item.id,status:'READY',checklistIndex:999,checklistDone:true},{itemId:item.id},{itemId:'missing',status:'READY'}]) {
    const res=await post(body);assert(res.status>=400,JSON.stringify(body));assert.deepEqual(fixture.bytes(),before);
    assert.deepEqual(await (await fetch(url)).json(),store.workItems[projectId],'rejection rolls back in-memory state too');
  }
  console.log('PASS rejected status/auth/checklist/no-op requests preserve disk, audit and server state');
  const lock=path.join(fixture.dir,'.local/project-state.write.lock');fs.writeFileSync(lock,'synthetic conflict');
  try {assert.equal((await post({itemId:item.id,status:'IN_PROGRESS'})).status,500);assert.deepEqual(fixture.bytes(),before);
    assert.deepEqual(await (await fetch(url)).json(),store.workItems[projectId]);
  } finally {fs.unlinkSync(lock);}
  console.log('PASS persistence failure rolls back status, version and audit');
  assert.equal((await post({itemId:item.id,status:'IN_PROGRESS'})).status,200);
  assert.equal((await post({itemId:item.id,checklistIndex:0,checklistDone:!item.checklist[0].done})).status,200);
  const saved=fixture.reopen();const changed=saved.state.workItems[projectId].find((w:any)=>w.id===item.id);
  assert.equal(changed.status,'IN_PROGRESS');assert.equal(changed.checklist[0].done,!item.checklist[0].done);
  assert.equal(saved.state.projects.find((p:any)=>p.id===projectId).stateVersion,(store.projects[0].stateVersion??0)+2);
  assert.equal(saved.state.auditLogs[projectId].length,store.auditLogs[projectId].length+2);
  assert(verifyAuditLedgerChain(saved.state.auditLogs[projectId].slice(0,2),'REVERSE_CHRONOLOGICAL').valid);
  for(const project of store.projects.filter(p=>p.id!==projectId))assert.deepEqual(saved.state.projects.find((p:any)=>p.id===project.id),project);
  await fixture.restart();assert.deepEqual(await (await fetch(url)).json(),saved.state.workItems[projectId]);
  console.log('PASS successful status/checklist updates persist with audit and survive actual server restart');
  fs.appendFileSync(fixture.snapshotPath,' ');const external=fixture.bytes();
  assert.equal((await post({itemId:item.id,status:'READY'})).status,409);assert.deepEqual(fixture.bytes(),external);
  console.log('PASS stale running server cannot overwrite an external snapshot commit');
} finally {await fixture.close();}
