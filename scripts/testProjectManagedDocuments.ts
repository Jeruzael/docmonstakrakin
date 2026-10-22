import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { ProjectStore } from '../server/projectStore.ts';
import { installProjectPersistence, readProjectSnapshot } from '../server/projectPersistence.ts';
import { createControlledDocsRouter } from '../server/docs/controlledDocsRouter.ts';
import type { ReviewerIdentity } from '../server/proposals/identity.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-managed-docs-owned-'));
const reviewer: ReviewerIdentity = {id:'fixture-human',name:'Synthetic reviewer',kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',roles:['Security Officer']};
const store = new ProjectStore() as ProjectStore & {managedDocuments: Record<string, any[]>};
store.projects = [
  {id:'PRJ-ORDINARY',name:'Ordinary fixture',stateVersion:7},
  {id:'PRJ-OTHER',name:'Other fixture',stateVersion:2},
  {id:'PRJ-DOCMONSTAKRAKIN',name:'Protected fixture',stateVersion:31},
] as any;
store.managedDocuments = {};
store.auditLogs = {};
const app = express();
app.use(express.json({limit:'256kb'}));
installProjectPersistence(app, store, root);
app.use('/api/projects', createControlledDocsRouter(store, (req,res) => {
  if (req.headers['x-fixture-reviewer'] !== 'human') {res.status(401).json({error:'REVIEWER_REQUIRED'});return;}
  return reviewer;
}, root));
app.use((_req,res) => {res.status(404).json({error:'ROUTE_NOT_FOUND'});});
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}/api/projects`;
let passed = 0;
async function test(name: string, body: () => Promise<void>) {
  await body(); passed++; console.log(`PASS ${name}`);
}
async function post(project: string, suffix: string, body: any, authenticated = true) {
  const response = await fetch(`${base}/${project}/docs${suffix}`, {method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{'x-fixture-reviewer':'human'}:{})},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
const creation = (overrides = {}) => ({title:'Design notes',kind:'ARCHITECTURE',format:'MARKDOWN',content:'# Draft\n\nUnreviewed design notes.\n',expectedStateVersion:7,reason:'Record draft notes',humanConfirmed:true,requestId:crypto.randomUUID(),...overrides});
let created: any;
try {
  await test('ordinary document creation stores content and metadata atomically without repository writes', async () => {
    const result = await post('PRJ-ORDINARY','',creation());
    assert.equal(result.status,201,JSON.stringify(result.body)); created=result.body;
    assert.equal(created.success,true); assert.equal(created.projectId,'PRJ-ORDINARY');
    assert.match(created.documentId,/^MDOC-[0-9a-f-]{36}$/);
    assert.equal(created.stateVersion,8);
    assert.equal(created.newSha256,crypto.createHash('sha256').update('# Draft\n\nUnreviewed design notes.\n').digest('hex'));
    assert.match(created.path,/^managed-documents\/MDOC-[0-9a-f-]{36}\.md$/);
    const persisted=readProjectSnapshot(root)!;
    const doc=persisted.state.managedDocuments['PRJ-ORDINARY'][0];
    assert.equal(doc.content,'# Draft\n\nUnreviewed design notes.\n'); assert.equal(doc.sha256Digest,created.newSha256);
    assert.equal(doc.projectId,'PRJ-ORDINARY'); assert.equal(doc.path,created.path);
    assert.equal(fs.existsSync(path.join(root,'docs')),false);
    assert.equal(fs.existsSync(path.join(root,'managed-documents')),false);
    assert.equal(store.auditLogs['PRJ-ORDINARY'][0].action,'DOCUMENT_CREATED');
    assert.equal(store.auditLogs['PRJ-ORDINARY'][0].actor,'Synthetic reviewer');
    assert.equal(store.approvals['PRJ-ORDINARY'],undefined);
  });
  await test('catalog read diff and validate use the persisted managed bytes', async () => {
    const list=await fetch(`${base}/PRJ-ORDINARY/docs`).then(r=>r.json());
    assert.equal(list.length,1); assert.equal(list[0].editability,'CONTROLLED_EDIT');
    assert.equal(list[0].authority,'REFERENCE'); assert.equal(list[0].managed,true);
    const read=await fetch(`${base}/PRJ-ORDINARY/docs/${created.documentId}`).then(r=>r.json());
    assert.equal(read.content,'# Draft\n\nUnreviewed design notes.\n'); assert.equal(read.stateVersion,8); assert.equal(read.projectId,'PRJ-ORDINARY');
    const diff=await post('PRJ-ORDINARY',`/${created.documentId}/diff`,{candidateContent:'# Updated\n',baseSha256:created.newSha256});
    assert.equal(diff.status,200); assert.equal(diff.body.hasChanges,true); assert.equal(diff.body.isStale,false);
    const validation=await post('PRJ-ORDINARY',`/${created.documentId}/validate`,{candidateContent:'# Updated\n'});
    assert.equal(validation.status,200); assert.equal(validation.body.valid,true);
    const excessiveLines=await post('PRJ-ORDINARY',`/${created.documentId}/validate`,{candidateContent:'x\r'.repeat(1001)});
    assert.equal(excessiveLines.body.valid,false);
  });
  await test('creation requires configured reviewer and explicit human confirmation',async()=>{
    assert.equal((await post('PRJ-ORDINARY','',creation({expectedStateVersion:8}),false)).status,401);
    assert.equal((await post('PRJ-ORDINARY','',creation({expectedStateVersion:8,humanConfirmed:false}))).status,422);
    assert.equal(store.projects[0].stateVersion,8);
  });
  await test('canonical and unknown projects reject creation',async()=>{
    assert.equal((await post('PRJ-DOCMONSTAKRAKIN','',creation({expectedStateVersion:31}))).status,403);
    assert.equal((await post('UNKNOWN','',creation())).status,404);
  });
  await test('creation rejects caller paths identities authority status and hostile names',async()=>{
    for(const extra of [{path:'docs/00_control/MASTER_WBS.yaml'},{actor:'Operator'},{role:'Security Officer'},{authority:'GENERATED_PROJECTION'},{status:'APPROVED'},{id:'DOC-CTRL-001'},{projectId:'PRJ-OTHER'}]) {
      assert.equal((await post('PRJ-ORDINARY','',creation({expectedStateVersion:8,...extra}))).status,400,JSON.stringify(extra));
    }
    for(const title of ['../escape','<script>alert(1)</script>','Notes\u202eexe','a/b','[click](https://host)','Bad\ud800title']) {
      assert.equal((await post('PRJ-ORDINARY','',creation({expectedStateVersion:8,title}))).status,422,title);
    }
    for(const content of ['\0','x'.repeat(128*1024+1),'x\n'.repeat(1001),'x\r'.repeat(1001),'\ud800','<script>alert(1)</script>','[click](javascript:alert(1))']) {
      assert.equal((await post('PRJ-ORDINARY','',creation({expectedStateVersion:8,content}))).status,422);
    }
    assert.equal(store.projects[0].stateVersion,8); assert.equal(store.managedDocuments['PRJ-ORDINARY'].length,1);
  });
  await test('stale creation replay and duplicate titles cannot create a second document',async()=>{
    assert.equal((await post('PRJ-ORDINARY','',creation())).status,409);
    const id=store.managedDocuments['PRJ-ORDINARY'][0].requestIds[0];
    assert.equal((await post('PRJ-ORDINARY','',creation({title:'New title',expectedStateVersion:8,requestId:id}))).status,409);
    assert.equal((await post('PRJ-ORDINARY','',creation({title:' design NOTES ',expectedStateVersion:8}))).status,409);
    assert.equal(store.managedDocuments['PRJ-ORDINARY'].length,1);
  });
  const save= (overrides = {}) => ({candidateContent:'# Updated\n',baseSha256:created.newSha256,expectedStateVersion:8,reason:'Revise draft',humanConfirmed:true,requestId:crypto.randomUUID(),...overrides});
  await test('save requires exact project version and digest and rejects cross-project IDs',async()=>{
    assert.equal((await post('PRJ-ORDINARY',`/${created.documentId}/save`,save({expectedStateVersion:7}))).status,409);
    assert.equal((await post('PRJ-ORDINARY',`/${created.documentId}/save`,save({baseSha256:'0'.repeat(64)}))).status,409);
    assert.equal((await post('PRJ-ORDINARY',`/${created.documentId}/save`,save({expectedStateVersion:undefined}))).status,422);
    assert.equal((await post('PRJ-OTHER',`/${created.documentId}/save`,save({expectedStateVersion:2}))).status,404);
    const read=await fetch(`${base}/PRJ-OTHER/docs/${created.documentId}`);assert.equal(read.status,404);
    assert.equal(store.projects[0].stateVersion,8);
  });
  await test('successful save persists new bytes digest audit and one version increment',async()=>{
    const input=save(); const result=await post('PRJ-ORDINARY',`/${created.documentId}/save`,input);
    assert.equal(result.status,200,JSON.stringify(result.body));
    assert.equal(result.body.previousSha256,created.newSha256); assert.equal(result.body.stateVersion,9);
    assert.equal(result.body.newSha256,crypto.createHash('sha256').update('# Updated\n').digest('hex'));
    const doc=readProjectSnapshot(root)!.state.managedDocuments['PRJ-ORDINARY'][0];
    assert.equal(doc.content,'# Updated\n'); assert.equal(doc.sha256Digest,result.body.newSha256);
    assert.equal(store.auditLogs['PRJ-ORDINARY'][0].action,'DOCUMENT_UPDATED');
    assert.equal((await post('PRJ-ORDINARY',`/${created.documentId}/save`,{...input,expectedStateVersion:9,baseSha256:result.body.newSha256,candidateContent:'# Again\n'})).status,409);
    created={...created,newSha256:result.body.newSha256};
  });
  await test('snapshot write failure rolls content digest version audit and replay reservation back',async()=>{
    const before=structuredClone({...store});
    const persisted=fs.readFileSync(path.join(root,'.local','project-state.json'),'utf8');
    const lock=path.join(root,'.local','project-state.write.lock');fs.writeFileSync(lock,'owned failure fixture');
    try {
      const result=await post('PRJ-ORDINARY',`/${created.documentId}/save`,save({expectedStateVersion:9,candidateContent:'# Must roll back\n'}));
      assert.equal(result.status,500); assert.deepEqual({...store},before);
      const failedCreate=await post('PRJ-ORDINARY','',creation({title:'Must roll back',expectedStateVersion:9}));
      assert.equal(failedCreate.status,500); assert.deepEqual({...store},before);
      assert.equal(fs.readFileSync(path.join(root,'.local','project-state.json'),'utf8'),persisted);
    } finally {fs.unlinkSync(lock);}
    const fresh=new ProjectStore() as typeof store; fresh.managedDocuments={};
    const hydrationApp=express(); installProjectPersistence(hydrationApp,fresh,root);
    assert.equal(fresh.managedDocuments['PRJ-ORDINARY'][0].content,'# Updated\n');
    assert.equal(fresh.projects[0].stateVersion,9);
  });
  await test('tampered stored managed content fails closed',async()=>{
    store.managedDocuments['PRJ-ORDINARY'][0].content='tampered';
    const response=await fetch(`${base}/PRJ-ORDINARY/docs/${created.documentId}`);
    assert.equal(response.status,500); assert.equal((await response.json()).error,'MANAGED_DOCUMENT_INTEGRITY_FAILED');
  });
  console.log(`${passed} managed-document API scenarios passed`);
} finally {
  await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  const resolved=path.resolve(root);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));
  assert.ok(path.basename(resolved).startsWith('dmk-managed-docs-owned-'));
  fs.rmSync(resolved,{recursive:true,force:true});
}
