import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {writeProjectSnapshotAtomic,readProjectSnapshot,snapshotProjectStore} from '../server/projectPersistence.ts';
import {ProjectStore} from '../server/projectStore.ts';
import {verifySelfBootstrapExecution} from './verifySelfBootstrapExecution.ts';
import {executeSelfBootstrap} from '../server/bootstrap/selfBootstrapExecutor.ts';
import {dryRunReconciliation,applyReconciliation,verifyReconciliation,projectReconciliation,readReconciliationInputs,TARGET,digest} from '../server/reconciliation/canonicalReconciliation.ts';

// Every write is confined to a new disposable directory. Never copy live state.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-batch-a-'));
try {
  const initial = {schemaVersion: 1, state: {projects: [{id: 'synthetic'}]}};
  writeProjectSnapshotAtomic(initial, dir);
  const filename = path.join(dir, '.local/project-state.json');
  const before = fs.readFileSync(filename);
  assert.throws(() => writeProjectSnapshotAtomic({schemaVersion: 1, state: {projects: []}}, dir,
    {expectedDigest: 'stale-review'} as any), /STALE_STATE/);
  assert.deepEqual(fs.readFileSync(filename), before);
  console.log('PASS stale snapshot compare-and-swap rejects without mutation');
} finally { fs.rmSync(dir, {recursive: true, force: true}); }

const root=process.cwd(),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-batch-a-'));
let passed=1;
const test=(name:string,fn:()=>void)=>{fn();passed++;console.log(`PASS ${name}`);};
try {
  for(const rel of ['docs','bootstrap'])fs.cpSync(path.join(root,rel),path.join(fixture,rel),{recursive:true});
  const store=new ProjectStore();
  const baseline=path.join(fixture,'before-bootstrap.json');
  fs.writeFileSync(baseline,JSON.stringify(snapshotProjectStore(store)));
  writeProjectSnapshotAtomic(snapshotProjectStore(store),fixture);
  const execution=executeSelfBootstrap({workspaceRoot:fixture,mode:'EXECUTE',confirmProjectId:TARGET,
    confirmManifestDigest:'229215f6847f1a2e3748d057a2a159d415626d481209870a83dd7d74074d7b36',
    authEnvValue:TARGET});
  assert.equal(execution.status,'EXECUTED',JSON.stringify(execution.errors));
  const filename=path.join(fixture,'.local/project-state.json');
  test('pristine bootstrap verifier still passes the untouched disposable initialization',()=>{
    assert.equal(verifySelfBootstrapExecution({baselineSnapshotPath:baseline,currentSnapshotPath:filename,workspaceRoot:fixture}).status,'BOOTSTRAP_VERIFIED');
  });
  const snapshot=readProjectSnapshot(fixture)!;
  // Synthetic legacy drift. No live operator snapshot is ever copied.
  snapshot.state.workItems[TARGET].find((w:any)=>w.id==='DMK-193').status='IN_PROGRESS';
  snapshot.state.extraFutureCollection={unrelated:{preserve:['exactly']}};
  writeProjectSnapshotAtomic(snapshot,fixture);
  const before=fs.readFileSync(filename), timestamp='2026-09-23T00:00:00.000Z';
  const reset=()=>fs.writeFileSync(filename,before);
  const review=()=>dryRunReconciliation(fixture,fixture,'Synthetic operator',timestamp);
  const plan=review();
  const auth={authorized:true,confirmProjectId:TARGET,confirmPlanDigest:plan.planDigest};
  test('bounded mapping, DMK-192/193/194 validated, current DMK-194 VERIFIED projection; dry-run has zero writes',()=>{
    const files=fs.readdirSync(path.dirname(filename));
    assert.deepEqual(review(),plan);assert.deepEqual(fs.readFileSync(filename),before);assert.deepEqual(fs.readdirSync(path.dirname(filename)),files);
    assert.equal(plan.mapping.length,13);
    assert.deepEqual(plan.changes.map(c=>[c.workItemId,c.to]),[['DMK-192','VERIFIED'],['DMK-193','VERIFIED'],['DMK-194','VERIFIED']]);
    assert.equal(plan.evidence['DMK-192'],'VALIDATED');
    assert.equal(plan.evidence['DMK-193'],'VALIDATED');
    assert.equal(plan.evidence['DMK-194'],'VALIDATED');
    assert.equal(plan.mapping.filter(m=>m.apply).length,3);
  });
  test('historical status mapping: VERIFICATION_PENDING maps to runtime VERIFICATION',()=>{
    const inputs=readReconciliationInputs(fixture);
    inputs.items.find(i=>i.id==='DMK-194').status='VERIFICATION_PENDING';
    const proj=projectReconciliation(before,inputs,'Synthetic operator',timestamp);
    const change=proj.plan.changes.find(c=>c.workItemId==='DMK-194');
    assert.equal(change?.to,'VERIFICATION');
    const mapping=proj.plan.mapping.find(m=>m.wbsId==='DMK-194');
    assert.equal(mapping?.wbsStatus,'VERIFICATION_PENDING');
    assert.equal(mapping?.mappedStatus,'VERIFICATION');
  });
  test('unknown WBS status, missing mapping and duplicate runtime IDs fail closed',()=>{
    const inputs=readReconciliationInputs(fixture);
    inputs.items.find(i=>i.id==='DMK-194').status='IMPLEMENTED';
    assert.throws(()=>projectReconciliation(before,inputs,'Operator',timestamp),/Unmapped/);
    for(const mutate of [(s:any)=>s.state.workItems[TARGET].pop(),(s:any)=>s.state.workItems[TARGET].push(s.state.workItems[TARGET][0])]) {
      const s=JSON.parse(before.toString());mutate(s);assert.throws(()=>projectReconciliation(Buffer.from(JSON.stringify(s)),readReconciliationInputs(fixture),'Operator',timestamp),/Unmapped|duplicate|Missing/);
    }
  });
  test('explicit authorization and exact reviewed plan are required',()=>{
    for(const guard of [{...auth,authorized:false},{...auth,confirmProjectId:'other'},{...auth,confirmPlanDigest:'wrong'}])assert.throws(()=>applyReconciliation(fixture,fixture,plan,guard),/AUTHORIZATION/);
    const tampered=structuredClone(plan);tampered.changes[0].to='RELEASED';assert.throws(()=>applyReconciliation(fixture,fixture,tampered,auth),/INVALID_REVIEW/);
    assert.deepEqual(fs.readFileSync(filename),before);
  });
  test('stale state and stateVersion block apply, preserving changed bytes',()=>{
    for(const mutate of [(s:any)=>s.state.projects[0].name+='changed',(s:any)=>s.state.projects.find((p:any)=>p.id===TARGET).stateVersion=42]) {
      const s=JSON.parse(before.toString());mutate(s);fs.writeFileSync(filename,JSON.stringify(s));const stale=fs.readFileSync(filename);
      assert.throws(()=>applyReconciliation(fixture,fixture,plan,auth),/STALE_STATE/);assert.deepEqual(fs.readFileSync(filename),stale);reset();
    }
  });
  test('missing/corrupt retained DMK-192 and DMK-193 evidence blocks proposal and apply',()=>{
    for(const name of ['SELF_BOOTSTRAP_DRY_RUN_REVIEW.md','self-bootstrap-manifest-validation.json','SELF_BOOTSTRAP_EXECUTION_REVIEW.md','self-bootstrap-execution-verification.json']) {
      const file=path.join(fixture,'docs/07_verification',name), original=fs.readFileSync(file);
      try {fs.writeFileSync(file,'{}');assert.throws(review,/EVIDENCE_INVALID/);assert.throws(()=>applyReconciliation(fixture,fixture,plan,auth),/EVIDENCE_INVALID/);
        fs.unlinkSync(file);assert.throws(review);
      } finally {fs.writeFileSync(file,original);}
      assert.deepEqual(fs.readFileSync(filename),before);
    }
  });
  test('changed WBS after review is rejected even when mapped statuses match',()=>{
    const file=path.join(fixture,'docs/00_control/MASTER_WBS.yaml'), original=fs.readFileSync(file);
    try {fs.appendFileSync(file,'\n# changed after review\n');assert.throws(()=>applyReconciliation(fixture,fixture,plan,auth),/STALE_INPUTS/);}
    finally {fs.writeFileSync(file,original);}
    assert.deepEqual(fs.readFileSync(filename),before);
  });
  test('pre-rename state TOCTOU and input TOCTOU abort without partial commit',()=>{
    assert.throws(()=>applyReconciliation(fixture,fixture,plan,auth,{beforeRename:()=>fs.appendFileSync(filename,' ')}),/STALE_STATE/);
    assert.equal(fs.readFileSync(filename).toString(),before.toString()+' ');reset();
    const file=path.join(fixture,'docs/00_control/MASTER_WBS.yaml'), original=fs.readFileSync(file);
    try {assert.throws(()=>applyReconciliation(fixture,fixture,plan,auth,{beforeRename:()=>fs.appendFileSync(file,'\n# race\n')}),/STALE_INPUTS/);}
    finally {fs.writeFileSync(file,original);}
    assert.deepEqual(fs.readFileSync(filename),before);
    assert.deepEqual(fs.readdirSync(path.dirname(filename)),['project-state.json']);
  });
  test('exclusive writer and injected atomic failure leave state and audit unchanged',()=>{
    const lock=path.join(fixture,'.local/project-state.write.lock');fs.writeFileSync(lock,'synthetic owner');
    try {assert.throws(()=>applyReconciliation(fixture,fixture,plan,auth),/STATE_WRITER_BUSY/);}finally{fs.unlinkSync(lock);}
    assert.throws(()=>applyReconciliation(fixture,fixture,plan,auth,{beforeRename:()=>{throw Error('simulated write failure');}}),/simulated/);
    assert.deepEqual(fs.readFileSync(filename),before);assert.deepEqual(fs.readdirSync(path.dirname(filename)),['project-state.json']);
  });
  test('atomic apply, restart readback, full preservation and idempotent retry',()=>{
    assert.equal(applyReconciliation(fixture,fixture,plan,auth).status,'APPLIED');
    const after=fs.readFileSync(filename);assert.equal(digest(after),plan.candidateDigest);
    assert.equal(verifyReconciliation(before,after,plan,fixture).status,'RECONCILIATION_VERIFIED');
    const reopened=readProjectSnapshot(fixture)!;
    assert.deepEqual(reopened.state.extraFutureCollection,snapshot.state.extraFutureCollection);
    assert.deepEqual(reopened.state.auditLogs[TARGET].slice(1),snapshot.state.auditLogs[TARGET]);
    assert.equal(applyReconciliation(fixture,fixture,plan,auth).status,'ALREADY_APPLIED');
    assert.deepEqual(fs.readFileSync(filename),after);
    const noOp=review();assert.equal(noOp.changes.length,0);assert.equal(noOp.auditEvent,null);
    assert.equal(applyReconciliation(fixture,fixture,noOp,{...auth,confirmPlanDigest:noOp.planDigest}).mutationCount,0);
    assert.deepEqual(fs.readFileSync(filename),after);
  });
  test('separate post-bootstrap verifier rejects unexpected items, Gate 7, audit and unrelated changes',()=>{
    const after=fs.readFileSync(filename);
    for(const mutate of [(s:any)=>s.state.workItems[TARGET].find((w:any)=>w.id==='DMK-195').status='READY',
      (s:any)=>s.state.approvals[TARGET].push({gate:'Gate 7',status:'APPROVED'}),
      (s:any)=>s.state.auditLogs[TARGET].pop(),(s:any)=>s.state.projects[0].name+='changed']) {
      const s=JSON.parse(after.toString());mutate(s);assert.throws(()=>verifyReconciliation(before,Buffer.from(JSON.stringify(s)),plan,fixture),/MISMATCH/);
    }
  });
  test('post-reconciliation CLI verifies separately while pristine verifier remains strict',()=>{
    const beforePath=path.join(fixture,'before-reconciliation.json'),planPath=path.join(fixture,'plan.json');
    fs.writeFileSync(beforePath,before);fs.writeFileSync(planPath,JSON.stringify(plan));
    const run=(script:string,args:string[])=>spawnSync(process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,path.join(root,'scripts',script),...args],
      {cwd:fixture,encoding:'utf8',env:{...process.env,DMK_RECONCILIATION_EXECUTE:''},windowsHide:true});
    const verified=run('verifyCanonicalReconciliation.ts',['--before',beforePath,'--after',filename,'--plan',planPath,'--evidence-root',fixture]);
    assert.equal(verified.status,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).status,'RECONCILIATION_VERIFIED');
    const committed=fs.readFileSync(filename);
    const rejected=run('reconcileCanonicalState.ts',['--apply','--plan',planPath]);assert.equal(rejected.status,1);assert.match(rejected.stderr,/AUTHORIZATION/);
    assert.deepEqual(fs.readFileSync(filename),committed);
    assert.equal(verifySelfBootstrapExecution({baselineSnapshotPath:baseline,currentSnapshotPath:filename,workspaceRoot:fixture}).status,'BOOTSTRAP_VERIFICATION_FAILED');
  });
  console.log(`Canonical reconciliation: ${passed} tests passed (disposable state only).`);
} finally {fs.rmSync(fixture,{recursive:true,force:true});}
