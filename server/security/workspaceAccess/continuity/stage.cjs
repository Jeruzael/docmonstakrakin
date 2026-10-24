'use strict';
// Offline protocol only. This module never opens a live authority or activates a successor.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Sqlite=require('better-sqlite3');
const C=require('./contracts.cjs'),A=require('./anchor.cjs'),V=require('./verify.cjs');
const {inspectWorkspaceCapacityOffline}=require('../capacityInspectorWorker.cjs');
function requireOfflineDomain(trust){if(trust?.domain!=='SYNTHETIC')C.fail('CONTINUITY_OPERATIONAL_TRANSITION_UNSUPPORTED');}
function flushDirectory(directory){const fd=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function writeNew(file,bytes,max){
  if(bytes.length>max)C.fail('CONTINUITY_BOUND_EXCEEDED');
  const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try{let offset=0;while(offset<bytes.length){const n=fs.writeSync(fd,bytes,offset,bytes.length-offset);if(!n)C.fail('CONTINUITY_WRITE_FAILED');offset+=n;}fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function append(db,phase,payload){
  const previous=db.prepare('SELECT * FROM records ORDER BY sequence DESC LIMIT 1').get(),sequence=(previous?.sequence??0)+1;
  if(V.PHASES[sequence-1]!==phase)C.fail('CONTINUITY_JOURNAL_INVALID');
  const raw=C.canonical(payload),head=previous?.hash??'0'.repeat(64);
  if(Buffer.byteLength(raw)>C.LIMITS.manifestBytes)C.fail('CONTINUITY_BOUND_EXCEEDED');
  db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(sequence,phase,raw,head,C.sha(head+'\n'+raw));
}
function openControl(stage,create=false,trust){
  const file=path.join(stage,'control.sqlite');V.stagePath(stage);
  if(create)writeNew(file,Buffer.alloc(0),C.LIMITS.journalBytes);
  else{
    V.privatePath(file,false);if(fs.statSync(file).size>C.LIMITS.journalBytes)C.fail('CONTINUITY_BOUND_EXCEEDED');
    const journal=file+'-journal';if(fs.existsSync(journal)){
      const s=V.privatePath(journal,false);if(s.size>BigInt(C.LIMITS.journalBytes))C.fail('CONTINUITY_BOUND_EXCEEDED');
      // Before native SQLite can roll back anything, prove that the *main-file
      // snapshot* already binds a complete prepared stage. Torn/unprovable main
      // pages and incomplete preparation remain unavailable, with bytes retained.
      V.verifyStage(stage,trust,{allowJournal:true});
    }
    if(fs.existsSync(file+'-wal')||fs.existsSync(file+'-shm'))C.fail('CONTINUITY_STAGE_UNCERTAIN');
  }
  // Recovery may roll back this task-owned journal, never any original authority.
  const db=new Sqlite(file,{timeout:0});
  try{
    db.pragma('trusted_schema=OFF');db.pragma('temp_store=MEMORY');
    if(!create&&db.pragma('journal_mode',{simple:true})!=='delete')C.fail('CONTINUITY_STAGE_UNCERTAIN');
    db.pragma('journal_mode=DELETE');db.pragma('synchronous=FULL');
    if(create)db.exec(V.CONTROL_SQL+';PRAGMA user_version=1');
    return db;
  }catch(e){db.close();throw e;}
}
function build(sql,fn,max){const db=new Sqlite(':memory:');try{db.exec(sql.join(';')+';PRAGMA user_version=1');db.transaction(()=>fn(db))();const bytes=db.serialize();if(bytes.length>max)C.fail('CONTINUITY_BOUND_EXCEEDED');return bytes;}finally{db.close();}}
function sameState(receipt,revision,pointer){if(receipt.payload.state.revision!==revision||C.canonical(receipt.payload.state.pointer)!==C.canonical(pointer))C.fail('CONTINUITY_ANCHOR_CONFLICT');}
function sourcePointer(pointer,observation){if(pointer.dbSha256!==observation.databaseSha256||['generation','policyRevision','snapshotRevision','clockHighWater'].some(k=>pointer[k]!==observation[k]))C.fail('CONTINUITY_SOURCE_NOT_CURRENT');}
function result(stage,control,receipt,status){
  return {schema:'AUDIT_CONTINUITY_RESULT/1',status,stage,transitionId:control.intent.transitionId,lineageId:control.intent.lineageId,
    manifestSha256:control.prepared?.manifestSha256??null,anchorRevision:receipt?.payload.state.revision??null,
    configuredTrustDomain:receipt?.payload.domain??null,currentnessAcquisition:'NOT_IMPLEMENTED',
    syntheticOnly:receipt?.payload.domain==='SYNTHETIC',activated:false,runtimeContinuityComplete:false,serviceKeysProvisioned:false};
}
async function prepareTransition(options,client,trust){
  let control;
  try{
    requireOfflineDomain(trust);V.platform();C.exact(options,['sourceWorkspace','destinationBase','transitionId'],['priorStage']);
    if(!C.UUID.test(options.transitionId))C.fail('CONTINUITY_INPUT_INVALID');
    const observed=inspectWorkspaceCapacityOffline(options.sourceWorkspace);
    if(!['FULL','VALID_BOUNDED'].includes(observed.status)||!observed.initialized)C.fail('CONTINUITY_IMMUTABLE_SOURCE_REQUIRED');
    const base=options.destinationBase;V.privatePath(base,true);
    if(path.basename(base)!=='.security-backups'||Number(fs.statfsSync(base).type)!==0xef53)C.fail('CONTINUITY_PROFILE_UNSUPPORTED');
    const initial=await A.readCurrent(client,trust),current=initial.payload.state,pointer=current.pointer;
    sourcePointer(pointer,observed);if(pointer.segments>=C.LIMITS.segments)C.fail('CONTINUITY_BOUND_EXCEEDED');
    let prior;
    if(pointer.segments){
      if(typeof options.priorStage!=='string')C.fail('CONTINUITY_HISTORY_REQUIRED');
      prior=V.verifyStage(options.priorStage,trust);
      if(prior.control.phase!=='FINALIZED'||C.sha(prior.manifestBytes)!==pointer.historyRoot||prior.manifest.ordinal!==pointer.segments||prior.manifest.successorConfig.authorityId!==pointer.authorityId||prior.manifest.successorConfig.epoch!==pointer.epoch)C.fail('CONTINUITY_LINEAGE_INVALID');
    }else if(options.priorStage!==undefined)C.fail('CONTINUITY_LINEAGE_INVALID');
    const security=path.join(options.sourceWorkspace,'.security'),w=V.privatePath(options.sourceWorkspace,true),s=V.privatePath(security,true);
    const source={workspaceIdentity:w.dev+':'+w.ino,privateIdentity:s.dev+':'+s.ino};
    const original=V.readPrivate(path.join(security,'authority.sqlite'),C.LIMITS.segmentBytes),last=V.segment(original,source);
    if(last.observation.databaseSha256!==observed.databaseSha256)C.fail('CONTINUITY_SOURCE_CHANGED');
    // Re-admit the readonly superblock after the independent source copy.
    const after=inspectWorkspaceCapacityOffline(options.sourceWorkspace);
    if(after.sourceEvidenceSha256!==observed.sourceEvidenceSha256||after.databaseSha256!==observed.databaseSha256)C.fail('CONTINUITY_SOURCE_CHANGED');
    const images=[],segments=[],archives=prior?[...prior.manifest.archives]:[],copies=[];
    if(prior){
      for(const item of prior.manifest.segments){const parsed=V.segment(V.readBlob(options.priorStage,item.image,C.LIMITS.segmentBytes),item.source);images.push({operations:parsed.operations,digests:parsed.digests});segments.push(item);copies.push([item.image.file,{stage:options.priorStage,ref:item.image},C.LIMITS.segmentBytes]);}
      for(const archive of prior.manifest.archives)for(const key of ['manifest','index','seal','successor','anchorReceipt']){const ref=archive[key];copies.push([ref.file,{stage:options.priorStage,ref},key==='index'?C.LIMITS.indexBytes:key==='successor'?C.LIMITS.successorBytes:C.LIMITS.manifestBytes]);}
      const n=String(prior.manifest.ordinal).padStart(2,'0'),archive={ordinal:prior.manifest.ordinal};
      for(const key of ['manifest','index','seal','successor','anchorReceipt']){
        const bytes=key==='manifest'?prior.manifestBytes:key==='anchorReceipt'?Buffer.from(C.canonical(prior.control.receipt)):null;
        const file='history-'+n+'-'+key.toLowerCase()+(['index','successor'].includes(key)?'.sqlite':'.json');archive[key]=bytes?V.blob(file,bytes):{...prior.manifest[key],file};copies.push([file,bytes??{stage:options.priorStage,ref:prior.manifest[key]},key==='index'?C.LIMITS.indexBytes:key==='successor'?C.LIMITS.successorBytes:C.LIMITS.manifestBytes]);
      }archives.push(archive);
    }
    const imageFile='segment-'+String(segments.length).padStart(2,'0')+'.sqlite';images.push(last);segments.push({ordinal:segments.length,image:V.blob(imageFile,original),source,observation:last.observation,stateSha256:last.stateSha256});copies.push([imageFile,original,C.LIMITS.segmentBytes]);
    const expected=V.expectedIndex(images),rootBytes=prior?prior.rootAnchorBytes:Buffer.from(C.canonical(initial));
    const indexBytes=build(V.INDEX_SQL,db=>{const op=db.prepare('INSERT INTO operations VALUES(@id,@segment,@snapshotRevision,@requestHash)'),digest=db.prepare('INSERT INTO digests VALUES(@digest,@segment)');for(const r of expected.operations)op.run(r);for(const r of expected.digests)digest.run(r);},C.LIMITS.indexBytes);
    const intent={schema:'AUDIT_CONTINUITY_INTENT/1',lineageId:trust.lineageId,transitionId:options.transitionId,expectedRevision:current.revision,expectedPointer:pointer,successorAuthorityId:crypto.randomUUID(),rootAnchorSha256:C.sha(rootBytes),createdAt:Date.now()};
    const index=V.blob('replay.sqlite',indexBytes),rootAnchor=V.blob('root-anchor.json',rootBytes);
    const seal={schema:'AUDIT_CONTINUITY_SEAL/1',lineageId:trust.lineageId,transitionId:options.transitionId,previousManifestHash:pointer.historyRoot,rootAnchorSha256:rootAnchor.sha256,segments,indexSha256:index.sha256,operationCount:expected.operations.length,digestCount:expected.digests.length,operationRoot:expected.operationRoot,digestRoot:expected.digestRoot};
    const sealBytes=Buffer.from(C.canonical(seal)),sealHash=C.sha(sealBytes);
    const config={schema:'CONTINUITY_SUCCESSOR/1',lineageId:trust.lineageId,transitionId:options.transitionId,authorityId:intent.successorAuthorityId,epoch:pointer.epoch+1,generation:pointer.generation+1,policyRevision:pointer.policyRevision,snapshotRevision:pointer.snapshotRevision,clockHighWater:pointer.clockHighWater,sourceDbSha256:observed.databaseSha256};
    const successorBytes=build(V.SUCCESSOR_SQL,db=>{
      db.prepare('INSERT INTO config VALUES(1,?)').run(C.canonical({...config,sealSha256:sealHash,sourceStateSha256:last.stateSha256,serviceKeysProvisioned:false,activated:false}));
      for(const [name,raw] of Object.entries(last.state))db.prepare('INSERT INTO state VALUES(?,?)').run(name,raw);
      const raw=C.canonical({type:'AUDIT_CONTINUITY_GENESIS',lineageId:config.lineageId,authorityId:config.authorityId,epoch:config.epoch,sealSha256:sealHash,generation:config.generation,policyRevision:config.policyRevision,snapshotRevision:config.snapshotRevision,clockHighWater:config.clockHighWater});
      db.prepare('INSERT INTO audit VALUES(1,?,?,?)').run(raw,last.observation.audit.headHash,C.sha(last.observation.audit.headHash+'\n'+raw));
    },C.LIMITS.successorBytes);
    const successor=V.blob('successor.sqlite',successorBytes),manifest={schema:'AUDIT_LINEAGE_MANIFEST/1',lineageId:trust.lineageId,transitionId:options.transitionId,ordinal:segments.length,previousManifestHash:pointer.historyRoot,rootAnchor,segments,archives,index,seal:V.blob('seal.json',sealBytes),successor,successorConfig:config};
    const manifestBytes=Buffer.from(C.canonical(manifest));
    copies.push(['root-anchor.json',rootBytes,16384],['replay.sqlite',indexBytes,C.LIMITS.indexBytes],['seal.json',sealBytes,C.LIMITS.manifestBytes],['successor.sqlite',successorBytes,C.LIMITS.successorBytes],['manifest.json',manifestBytes,C.LIMITS.manifestBytes]);
    const length=data=>Buffer.isBuffer(data)?data.length:data.ref.bytes;
    if(copies.some(([,data,max])=>length(data)>max))C.fail('CONTINUITY_BOUND_EXCEEDED');
    const space=fs.statfsSync(base,{bigint:true}),needed=copies.reduce((sum,[,b])=>sum+BigInt(Math.ceil(length(b)/4096)*4096),BigInt(C.LIMITS.reserveBytes+C.LIMITS.journalBytes));
    if(space.bavail*space.bsize<needed)C.fail('CONTINUITY_SPACE_UNAVAILABLE');
    sameState(await A.readCurrent(client,trust),current.revision,pointer);
    const stage=path.join(base,'continuity-'+options.transitionId);fs.mkdirSync(stage,{mode:0o700});flushDirectory(base);
    control=openControl(stage,true);control.transaction(()=>append(control,'PREPARING',intent))();flushDirectory(stage);
    for(const [file,data,max] of copies)writeNew(path.join(stage,file),Buffer.isBuffer(data)?data:V.readBlob(data.stage,data.ref,max),max);
    flushDirectory(stage);V.verifyStage(stage,trust,{allowPreparing:true});sameState(await A.readCurrent(client,trust),current.revision,pointer);V.verifyStage(stage,trust,{allowPreparing:true});
    const proposal={lineageId:trust.lineageId,transitionId:options.transitionId,intentHash:C.sha(C.canonical(intent)),expectedRevision:current.revision,expectedPointer:pointer,nextPointer:{authorityId:config.authorityId,epoch:config.epoch,dbSha256:successor.sha256,historyRoot:C.sha(manifestBytes),segments:segments.length,generation:config.generation,policyRevision:config.policyRevision,snapshotRevision:config.snapshotRevision,clockHighWater:config.clockHighWater}};
    C.proposal(proposal);control.transaction(()=>append(control,'PREPARED',{manifestSha256:C.sha(manifestBytes),proposal}))();flushDirectory(stage);
    return result(stage,V.controlFrom(control,trust),initial,'PREPARED');
  }catch(error){throw C.mapped(error);}finally{control?.close();}
}
async function finish(stage,client,trust,commit){
  let db;
  try{
    requireOfflineDomain(trust);V.verifyStage(stage,trust,{allowJournal:true});db=openControl(stage,false,trust);db.exec('BEGIN IMMEDIATE');
    const verified=V.verifyStage(stage,trust,{allowJournal:true}),control=V.controlFrom(db,trust),proposal=control.prepared.proposal;
    if(C.canonical(control)!==C.canonical(verified.control))C.fail('CONTINUITY_SOURCE_CHANGED');
    let receipt;
    if(commit&&control.phase==='PREPARED'){
      // Resolve first: an earlier CAS may have committed despite a lost acknowledgment.
      receipt=await A.resolveAnchor(client,trust,proposal);
      if(!receipt.payload.resolution){sameState(receipt,proposal.expectedRevision,proposal.expectedPointer);V.verifyStage(stage,trust,{allowJournal:true});receipt=await A.commitAnchor(client,trust,proposal);}
    }else receipt=await A.resolveAnchor(client,trust,proposal);
    if(!receipt.payload.resolution){
      if(control.phase!=='PREPARED')C.fail('CONTINUITY_ANCHOR_CONFLICT');sameState(receipt,proposal.expectedRevision,proposal.expectedPointer);db.exec('ROLLBACK');return result(stage,control,receipt,'PREPARED_NOT_COMMITTED');
    }
    // An asynchronous provider may overlap a local writer. Never acknowledge
    // finalization using only the verification performed before that await.
    const after=V.verifyStage(stage,trust,{allowJournal:true});
    if(C.sha(after.manifestBytes)!==control.prepared.manifestSha256||C.canonical(after.control)!==C.canonical(control))C.fail('CONTINUITY_SOURCE_CHANGED');
    if(control.phase==='PREPARED')append(db,'COMMIT_CONFIRMED',{anchorReceipt:receipt});
    db.exec('COMMIT');flushDirectory(stage);
    if(V.controlFrom(db,trust).phase==='COMMIT_CONFIRMED'){db.transaction(()=>append(db,'FINALIZED',{requestHash:C.sha(C.canonical(proposal))}))();flushDirectory(stage);}
    const current=receipt.payload.state,status=current.revision===receipt.payload.resolution.committedRevision?'FINALIZED':'FINALIZED_SUPERSEDED';
    return result(stage,V.controlFrom(db,trust),receipt,status);
  }catch(error){if(db?.inTransaction)try{db.exec('ROLLBACK');}catch{}throw C.mapped(error);}finally{db?.close();}
}
module.exports={prepareTransition,commitTransition:(stage,client,trust)=>finish(stage,client,trust,true),recoverTransition:(stage,client,trust)=>finish(stage,client,trust,false)};
