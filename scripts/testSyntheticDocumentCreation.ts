import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes,scryptSync} from 'node:crypto';
import {installReviewerIdentity} from '../server/proposals/identity.ts';
import {localRequestBoundary} from '../server/security/localPerimeter.ts';
import {verifyAuditLedgerChain} from '../server/security/auditImmutability.ts';
import {createSyntheticDocumentCreationPilot} from '../server/docs/syntheticCreationPilot.ts';

const salt=randomBytes(16).toString('hex'),password='Synthetic-only-document-test';
const record=(kind:string)=>({id:`TEST-ONLY-${kind}`,kind,roles:['Security Officer'],credentialVerifier:`${salt}:${scryptSync(password,salt,32).toString('hex')}`});
const previous=process.env.DMK_HUMAN_REVIEWERS;process.env.DMK_HUMAN_REVIEWERS=JSON.stringify({human:record('HUMAN'),agent:record('AGENT')});
const app=express();app.use(localRequestBoundary);app.use(express.json({limit:'128kb'}));const auth=installReviewerIdentity(app);
if(previous===undefined)delete process.env.DMK_HUMAN_REVIEWERS;else process.env.DMK_HUMAN_REVIEWERS=previous;
const pilot=createSyntheticDocumentCreationPilot(auth.requireHuman);app.use('/api/product-demo/documents',pilot.router);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const request=async(endpoint:string,body?:unknown,cookie?:string)=>{const r=await fetch(base+endpoint,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})}});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
const candidate={content:'# Synthetic controlled plan\n\nFixture scope only.\n',reason:'Synthetic creation acceptance',humanConfirmed:true,expectedVersion:0,expectedDigest:null};
try {
  const endpoint='/api/product-demo/documents';assert.equal((await request(endpoint+'/create',candidate)).status,401);
  const agent=await request('/api/governance/session',{username:'agent',password});assert.equal((await request(endpoint+'/create',candidate,agent.cookie)).status,403);
  assert.equal(pilot.inspect().version,0);console.log('PASS disconnected creation requires actual synthetic HUMAN session and rejects anonymous or AGENT authority');
  const human=await request('/api/governance/session',{username:'human',password});assert.equal(human.status,200);assert(human.cookie);
  const markerPath=path.join(pilot.rootDirectory,'.owner'),markerBackup=markerPath+'.retained';
  const targetDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-marker-target-')),targetFile=path.join(targetDirectory,'marker');fs.writeFileSync(targetFile,'Sensitive synthetic marker target');
  const originalRead=fs.readFileSync,originalReadSync=fs.readSync;let markerReads=0;
  const observeReads=()=>{(fs as any).readFileSync=(...args:any[])=>{if(typeof args[0]==='string' && path.resolve(args[0])===markerPath)markerReads++;return (originalRead as any)(...args);};(fs as any).readSync=(...args:any[])=>{markerReads++;return (originalReadSync as any)(...args);};};
  fs.renameSync(markerPath,markerBackup);let linkKind='file symlink';
  try{
    try{fs.symlinkSync(targetFile,markerPath,'file');}catch(error){if(process.platform!=='win32' || (error as NodeJS.ErrnoException).code!=='EPERM')throw error;fs.symlinkSync(targetDirectory,markerPath,'junction');linkKind='directory junction';}
    observeReads();assert.equal((await request(endpoint,undefined,human.cookie)).status,503);assert.equal(markerReads,0,'Marker link must be rejected before target read');
  }finally{(fs as any).readFileSync=originalRead;(fs as any).readSync=originalReadSync;fs.unlinkSync(markerPath);fs.renameSync(markerBackup,markerPath);fs.rmSync(targetDirectory,{recursive:true});}
  console.log(`PASS ${linkKind} owner marker is rejected with zero target read attempts`);
  fs.renameSync(markerPath,markerBackup);fs.writeFileSync(markerPath,'f'.repeat(128*1024));markerReads=0;
  try{observeReads();assert.equal((await request(endpoint,undefined,human.cookie)).status,503);assert.equal(markerReads,0,'Oversized marker must be rejected before content read');}
  finally{(fs as any).readFileSync=originalRead;(fs as any).readSync=originalReadSync;fs.unlinkSync(markerPath);fs.renameSync(markerBackup,markerPath);}
  console.log('PASS oversized owner marker is rejected before allocation or content read');
  const raceTarget=path.join(pilot.rootDirectory,'race-target');fs.writeFileSync(raceTarget,'0'.repeat(64));
  const originalOpen=fs.openSync;let raced=false,raceReads=0;
  const swapMarker=()=>{if(raced)return;raced=true;fs.renameSync(markerPath,markerBackup);try{fs.symlinkSync(raceTarget,markerPath,'file');}catch(error){if(process.platform!=='win32' || (error as NodeJS.ErrnoException).code!=='EPERM')throw error;fs.symlinkSync(pilot.rootDirectory,markerPath,'junction');}};
  (fs as any).readFileSync=(...args:any[])=>{if(args[0]===markerPath){swapMarker();raceReads++;}return (originalRead as any)(...args);};
  (fs as any).openSync=(...args:any[])=>{if(args[0]===markerPath)swapMarker();return (originalOpen as any)(...args);};
  (fs as any).readSync=(...args:any[])=>{if(raced)raceReads++;return (originalReadSync as any)(...args);};
  try{assert.equal((await request(endpoint,undefined,human.cookie)).status,503);assert(raced);assert.equal(raceReads,0,'Marker swap after path checks must fail before target read');}
  finally{(fs as any).readFileSync=originalRead;(fs as any).openSync=originalOpen;(fs as any).readSync=originalReadSync;if(raced){fs.unlinkSync(markerPath);fs.renameSync(markerBackup,markerPath);}fs.unlinkSync(raceTarget);}
  console.log('PASS owner marker replacement between path admission and open cannot redirect a target read');
  for(const body of [{...candidate,path:'MASTER_WBS.yaml'},{...candidate,projectId:'PRJ-DOCMONSTAKRAKIN'},{...candidate,actor:'Security Officer'},{...candidate,humanConfirmed:false},{...candidate,expectedVersion:1},{...candidate,content:''}])assert((await request(endpoint+'/create',body,human.cookie)).status>=400);
  assert.equal(pilot.inspect().version,0);console.log('PASS caller paths, canonical self-project, identity claims, missing confirmation, stale CAS and invalid content are rejected');
  pilot.injectFault('afterJournal');assert.equal((await request(endpoint+'/create',candidate,human.cookie)).status,500);assert.equal(pilot.inspect().version,0);pilot.recover();
  console.log('PASS pre-commit injected failure preserves empty state and recovers journal without creating evidence');
  const concurrent=await Promise.all([request(endpoint+'/create',candidate,human.cookie),request(endpoint+'/create',candidate,human.cookie)]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
  const created=concurrent.find(r=>r.status===201)!;assert.equal(created.body.operationalAuthority,false);assert.equal(created.body.scope,'SYNTHETIC_ONLY');
  const state=pilot.inspect();assert.equal(state.version,1);assert.equal(state.document?.content,candidate.content);assert.equal(state.audit.length,1);assert(verifyAuditLedgerChain(state.audit,'REVERSE_CHRONOLOGICAL').valid);
  assert.equal((await request(endpoint+'/create',candidate,human.cookie)).status,409);assert.deepEqual(pilot.inspect(),state);
  console.log('PASS trusted fixed registry creates one controlled document, registry state and chained audit in one atomic CAS commit');
  pilot.recover();assert.deepEqual(pilot.inspect(),state);assert.equal((await request(endpoint,undefined,human.cookie)).body.document.content,candidate.content);
  console.log('PASS committed creation is recoverable, readable and cannot be replayed or overwrite existing content');
  const statePath=path.join(pilot.rootDirectory,'state.json'),stateBytes=fs.readFileSync(statePath);
  const altered=structuredClone(state);altered.document!.content='Unattested alteration';altered.document!.sha256=(await import('node:crypto')).createHash('sha256').update(altered.document!.content).digest('hex');fs.writeFileSync(statePath,JSON.stringify(altered));
  assert.equal((await request(endpoint,undefined,human.cookie)).status,503);fs.writeFileSync(statePath,stateBytes);
  console.log('PASS altered document bytes and digest cannot detach from their original chained audit');
  const retained=pilot.rootDirectory+'.retained';fs.renameSync(pilot.rootDirectory,retained);fs.mkdirSync(pilot.rootDirectory);
  try{assert.equal((await request(endpoint,undefined,human.cookie)).status,503);}finally{fs.rmdirSync(pilot.rootDirectory);fs.renameSync(retained,pilot.rootDirectory);}
  const retainedState=statePath+'.retained';fs.renameSync(statePath,retainedState);fs.linkSync(retainedState,statePath);
  try{assert.equal((await request(endpoint,undefined,human.cookie)).status,503);}finally{fs.unlinkSync(statePath);fs.renameSync(retainedState,statePath);}
  console.log('PASS replaced fixture directories and hard-linked state files fail closed without deleting external state');
  const postCommit=createSyntheticDocumentCreationPilot(auth.requireHuman);app.use('/post-commit',postCommit.router);
  try{postCommit.injectFault('afterCommit');const uncertain=await request('/post-commit/create',candidate,human.cookie);assert.equal(uncertain.status,500);assert.equal(uncertain.body.error,'CREATION_OUTCOME_REQUIRES_RECOVERY');assert.equal(postCommit.inspect().version,1);postCommit.recover();assert.equal(postCommit.inspect().version,1);}finally{postCommit.close();}
  console.log('PASS uncertain post-commit failure recovers the committed document instead of inventing rollback');
  const serialized=createSyntheticDocumentCreationPilot(auth.requireHuman);app.use('/serialized-limit',serialized.router);
  try{const rejected=await request('/serialized-limit/create',{...candidate,content:'\n'.repeat(65280)+'x'},human.cookie);assert.equal(rejected.status,422,'Serialized state must be admitted before committing');assert.equal(serialized.inspect().version,0);}finally{serialized.close();}
  console.log('PASS serialized state budget rejects escaped-content expansion before creating or committing evidence');
  const unicode=createSyntheticDocumentCreationPilot(auth.requireHuman);app.use('/unicode',unicode.router);
  try{
    for(const invalid of [{...candidate,content:'\ud800'},{...candidate,reason:'\ud800'}])assert.equal((await request('/unicode/create',invalid,human.cookie)).status,422,'Lossy UTF-8 text must not create authority or evidence');
    assert.equal(unicode.inspect().version,0);console.log('PASS unpaired UTF-16 content or reason is rejected before any document or audit mutation');
    const valid={...candidate,content:'# \ufffd',reason:'\ufffd'};assert.equal((await request('/unicode/create',valid,human.cookie)).status,201);
    const filename=path.join(unicode.rootDirectory,'state.json'),original=fs.readFileSync(filename),state=unicode.inspect();
    state.document!.content='# \ud800';fs.writeFileSync(filename,JSON.stringify(state));assert.equal((await request('/unicode',undefined,human.cookie)).status,503);
    fs.writeFileSync(filename,original);const auditAltered=unicode.inspect();auditAltered.audit[0].reason='\ud801';fs.writeFileSync(filename,JSON.stringify(auditAltered));assert.equal((await request('/unicode',undefined,human.cookie)).status,503);
    fs.writeFileSync(filename,original);console.log('PASS parsed document and audit strings cannot exploit replacement-character SHA-256 aliases');
  }finally{unicode.close();}
} finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));pilot.close();}
