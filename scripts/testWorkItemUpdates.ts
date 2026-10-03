import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ProjectStore} from '../server/projectStore.ts';
import {snapshotProjectStore} from '../server/projectPersistence.ts';
import {verifyAuditLedgerChain} from '../server/security/auditImmutability.ts';
import {startPackageFixture} from './fixtures/projectsWorkspaceUiServer.ts';

const store=new ProjectStore();
store.projects.push({
  id: 'PRJ-DOCMONSTAKRAKIN',
  name: 'docmonstakrakin',
  description: 'Self-tracking governance and runtime architecture',
  profiles: ['WEB_APPLICATION'],
  specializedProfiles: ['DEVELOPER_TOOL', 'INTERNAL_TOOL'],
  deliveryMethod: 'ITERATIVE',
  deploymentIntent: 'Local-first web application',
  dataSensitivity: 'INTERNAL',
  lifecyclePhase: 'IMPLEMENTATION',
  targetRelease: 'v0.1.0-rc1',
  healthScore: 100,
  progress: {
    requirementsReadiness: 100,
    architectureReadiness: 100,
    implementation: 100,
    verification: 100,
    securityAssurance: 100,
    releaseReadiness: 100,
  },
  owner: 'Gio',
  stateVersion: 1,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
});
store.workItems['PRJ-DOCMONSTAKRAKIN'] = [
  {
    id: 'DMK-192',
    title: 'Controlled Document Integration',
    description: 'Controlled document integration',
    type: 'TASK',
    status: 'PROPOSED',
    priority: 'P0',
    risk: 'HIGH',
    owner: 'Gio',
    sprint: 1,
    requirements: ['REQ-DATA-001'],
    dependencies: [],
    evidence: [],
    acceptanceCriteria: ['Valid criteria'],
    checklist: [{ text: 'Step 1', done: false }],
    tests: [],
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'DMK-OUT-001',
    title: 'Unscoped Runtime Item',
    description: 'Out of canonical sync scope item',
    type: 'TASK',
    status: 'PROPOSED',
    priority: 'P2',
    risk: 'LOW',
    owner: 'Gio',
    sprint: 1,
    requirements: [],
    dependencies: [],
    evidence: [],
    acceptanceCriteria: [],
    checklist: [{ text: 'Step 1', done: false }],
    tests: [],
    updatedAt: '2026-09-01T00:00:00Z',
  },
];
store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];

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

  // --- DMK-205 Pre-Sync Canonical Status Protection Regression Tests ---
  const selfUrl = fixture.base + '/api/projects/PRJ-DOCMONSTAKRAKIN/work-items';
  const postSelf = (body: any) =>
    fetch(selfUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  // Scenario D: Canonical WBS unavailable fails closed (503)
  const resD = await postSelf({ itemId: 'DMK-192', status: 'IN_PROGRESS' });
  assert.equal(resD.status, 503);
  const bodyD = await resD.json();
  assert.equal(bodyD.error, 'CANONICAL_WBS_UNAVAILABLE');
  console.log('PASS Scenario D: Canonical WBS unavailable fails closed with 503 CANONICAL_WBS_UNAVAILABLE');

  // Provide canonical MASTER_WBS.yaml to fixture environment
  const fixtureWbsDir = path.join(fixture.dir, 'docs', '00_control');
  fs.mkdirSync(fixtureWbsDir, { recursive: true });
  fs.copyFileSync(path.join(process.cwd(), 'docs', '00_control', 'MASTER_WBS.yaml'), path.join(fixtureWbsDir, 'MASTER_WBS.yaml'));

  // Scenario A: PRJ-DOCMONSTAKRAKIN runtime item in EPIC-13 canonical scope, canonicalManaged missing/false, status mutation rejected (409)
  const resA = await postSelf({ itemId: 'DMK-192', status: 'IN_PROGRESS' });
  assert.equal(resA.status, 409);
  const bodyA = await resA.json();
  assert.equal(bodyA.error, 'CANONICAL_WBS_STATUS_OWNED');
  console.log('PASS Scenario A: PRJ-DOCMONSTAKRAKIN canonical-scope status mutation rejected with 409 CANONICAL_WBS_STATUS_OWNED before sync');

  // Scenario B: Same item checklist mutation allowed (200 OK)
  const resB = await postSelf({ itemId: 'DMK-192', checklistIndex: 0, checklistDone: true });
  assert.equal(resB.status, 200);
  const bodyB = await resB.json();
  assert.equal(bodyB.checklist[0].done, true);
  console.log('PASS Scenario B: Checklist toggle on canonical-scope item is allowed with 200 OK');

  // Scenario C: Self-project runtime item outside canonical EPIC-13 scope retains normal status mutation
  const resC = await postSelf({ itemId: 'DMK-OUT-001', status: 'IN_PROGRESS' });
  assert.equal(resC.status, 200);
  const bodyC = await resC.json();
  assert.equal(bodyC.status, 'IN_PROGRESS');
  console.log('PASS Scenario C: Self-project item outside canonical EPIC-13 scope retains normal status mutation');

  // Scenario E: PRJ-ATLAS-01 status mutation is unaffected by canonical WBS protection
  const resE = await post({ itemId: item.id, status: 'READY' });
  assert.equal(resE.status, 200);
  console.log('PASS Scenario E: Non-self project (PRJ-ATLAS-01) status mutation is unaffected by canonical WBS protection');

  fs.appendFileSync(fixture.snapshotPath,' ');const external=fixture.bytes();
  assert.equal((await post({itemId:item.id,status:'IN_PROGRESS'})).status,409);assert.deepEqual(fixture.bytes(),external);
  console.log('PASS stale running server cannot overwrite an external snapshot commit');
} finally {await fixture.close();}
