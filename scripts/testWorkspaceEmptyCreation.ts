import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomBytes,randomUUID} from 'node:crypto';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';
let passed=0,failed=0;
const verifier='$argon2id$v=19$m=32768,p=1,t=3$'+Buffer.alloc(16).toString('base64').replace(/=/g,'')+'$'+Buffer.alloc(32).toString('base64').replace(/=/g,'');
for(const receipts of[false,true]){
 const parent=fs.realpathSync.native(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'dmk-empty-create-'));let store:WorkspaceStore|undefined;
 try{
  store=await WorkspaceStore.open(root,{initialize:true,...(receipts?{actionReceipts:true}:{})});
  await store.execute({command:'bootstrap',principal:{id:'synthetic-owner',name:'synthetic-owner',personId:'synthetic-person',kind:'HUMAN',roles:[],canCreateProjects:true,disabled:false,credentialRevision:1},verifier});
  const info=await store.execute({command:'info'}),digest=randomBytes(32).toString('hex'),now=Date.now();
  await store.execute({command:'issue',principalId:'synthetic-owner',expectedCredentialRevision:1,expectedGeneration:info.generation,digest,now});
  // The real ProjectStore serializer includes empty optional collections even
  // when bootstrap stored no project snapshot. These carry no foreign state.
  const stateJson=JSON.stringify({schemaVersion:1,state:{projects:[{id:'PRJ-FIRST',name:'Synthetic first project'}],importSessions:{},verificationArchives:{},questions:{'PRJ-FIRST':[]}}});
  const baselineSnapshot=await store.execute({command:'snapshot'}),baselineInfo=await store.execute({command:'info'}),baselineAudit=await store.execute({command:'audit'});
  for(const [changed,code]of[
   [{schemaVersion:1,state:{projects:[{id:'PRJ-FIRST'},{id:'PRJ-FOREIGN'}],importSessions:{}}},'WORKSPACE_SCOPE_INVALID'],
   [{schemaVersion:1,state:{projects:[{id:'PRJ-FIRST'}],questions:{'PRJ-FOREIGN':[]}}},'WORKSPACE_SNAPSHOT_INVALID'],
   [{schemaVersion:1,state:{projects:[{id:'PRJ-DOCMONSTAKRAKIN'}],importSessions:{}}},'WORKSPACE_SCOPE_INVALID'],
  ]as const){await assert.rejects(store.execute({command:receipts?'commitReceipt':'commit',operationId:randomUUID(),digest,action:'project:create',projectId:changed.state.projects[0].id,expectedRevision:0,expectedPolicyRevision:info.policyRevision,stateJson:JSON.stringify(changed),now,...(receipts?{requestHash:'f'.repeat(64)}:{})}as any),{code});}
  assert.deepEqual(await store.execute({command:'snapshot'}),baselineSnapshot);assert.deepEqual(await store.execute({command:'info'}),baselineInfo);assert.deepEqual(await store.execute({command:'audit'}),baselineAudit);
  passed++;console.log('PASS empty schema'+(receipts?2:1)+' denies multiple projects foreign collection keys and protected self-project with authority unchanged');
  const result=await store.execute({command:receipts?'commitReceipt':'commit',operationId:randomUUID(),digest,action:'project:create',projectId:'PRJ-FIRST',expectedRevision:0,expectedPolicyRevision:info.policyRevision,stateJson,now,...(receipts?{requestHash:'a'.repeat(64)}:{})}as any);
  assert.equal(result.snapshotRevision,1);assert.equal(JSON.parse((await store.execute({command:'snapshot'})).stateJson).state.projects.length,1);
  passed++;console.log('PASS first project in empty schema'+(receipts?2:1)+' admits empty serializer collections without inheriting foreign data');
  const before=await store.execute({command:'snapshot'}),current=await store.execute({command:'info'});
  const later={schemaVersion:1,state:{projects:[{id:'PRJ-FIRST',name:'Synthetic first project'},{id:'PRJ-SECOND',name:'Second'}],importSessions:{},verificationArchives:{},questions:{'PRJ-FIRST':[]},adrs:{}}};
  const command={command:receipts?'commitReceipt':'commit',operationId:randomUUID(),digest,action:'project:create',projectId:'PRJ-SECOND',expectedRevision:1,expectedPolicyRevision:current.policyRevision,stateJson:JSON.stringify(later),now,...(receipts?{requestHash:'b'.repeat(64)}:{})};
  await assert.rejects(store.execute(command as any),{code:'WORKSPACE_SCOPE_INVALID'});
  delete later.state.adrs;later.state.projects[0].name='Unauthorized existing change';
  await assert.rejects(store.execute({...command,stateJson:JSON.stringify(later)}as any),{code:'WORKSPACE_SCOPE_INVALID'});
  assert.deepEqual(await store.execute({command:'snapshot'}),before);
  passed++;console.log('PASS schema'+(receipts?2:1)+' still rejects later unrelated map additions and edits to another project with no partial snapshot');
 }catch(error){failed++;console.error('FAIL first project in empty schema'+(receipts?2:1)+': '+String(error));}
 finally{await store?.close();assert.equal(path.dirname(fs.realpathSync.native(root)),parent);assert.ok(path.basename(root).startsWith('dmk-empty-create-'));fs.rmSync(root,{recursive:true,force:true});}
}
console.log(JSON.stringify({suite:'workspace-empty-creation',passed,failed}));if(failed)process.exitCode=1;
