'use strict';
const fs=require('node:fs'),path=require('node:path'),Sqlite=require('better-sqlite3');
const C=require('./contracts.cjs'),A=require('./anchor.cjs');
const {inspectCapacityImage}=require('../capacityImage.cjs');
const INDEX_SQL=[
 'CREATE TABLE operations(id TEXT PRIMARY KEY,segment INTEGER NOT NULL,snapshotRevision INTEGER NOT NULL,requestHash TEXT)',
 'CREATE TABLE digests(digest TEXT PRIMARY KEY,segment INTEGER NOT NULL)'
];
const SUCCESSOR_SQL=[
 'CREATE TABLE config(id INTEGER PRIMARY KEY CHECK(id=1),raw TEXT NOT NULL)',
 'CREATE TABLE state(name TEXT PRIMARY KEY,raw TEXT)',
 'CREATE TABLE active_sessions(digest TEXT PRIMARY KEY)',
 'CREATE TABLE audit(sequence INTEGER PRIMARY KEY,raw TEXT NOT NULL,previousHash TEXT NOT NULL,hash TEXT NOT NULL)'
];
const CONTROL_SQL='CREATE TABLE records(sequence INTEGER PRIMARY KEY,phase TEXT NOT NULL,payload TEXT NOT NULL,previousHash TEXT NOT NULL,hash TEXT NOT NULL)';
const PHASES=['PREPARING','PREPARED','COMMIT_CONFIRMED','FINALIZED'];
function platform(){const v=process.versions.node.split('.').map(Number);if(process.platform!=='linux'||process.arch!=='x64'||v[0]!==22||v[1]<23||v[1]===23&&v[2]<3)C.fail('CONTINUITY_PROFILE_UNSUPPORTED');}
function privatePath(file,directory){
  if(typeof file!=='string'||!path.isAbsolute(file)||path.resolve(file)!==file||fs.realpathSync.native(file)!==file)C.fail('CONTINUITY_PATH_INVALID');
  const s=fs.lstatSync(file,{bigint:true});
  if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile()||s.nlink!==1n)||s.ino===0n||s.uid!==BigInt(process.getuid())||(s.mode&0o777n)!==(directory?0o700n:0o600n))C.fail('CONTINUITY_PERMISSIONS_INVALID');
  return s;
}
function fingerprint(s){return [s.dev,s.ino,s.nlink,s.uid,s.gid,s.mode,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');}
function readPrivate(file,max){
  const before=privatePath(file,false);if(before.size<1n||before.size>BigInt(max))C.fail('CONTINUITY_BOUND_EXCEEDED');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOATIME|fs.constants.O_NOFOLLOW);
  try{
    if(fingerprint(fs.fstatSync(fd,{bigint:true}))!==fingerprint(before))C.fail('CONTINUITY_SOURCE_CHANGED');
    const bytes=Buffer.alloc(Number(before.size));let offset=0;
    while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,Math.min(bytes.length-offset,65536),offset);if(!n)C.fail('CONTINUITY_SOURCE_CHANGED');offset+=n;}
    if(fingerprint(fs.fstatSync(fd,{bigint:true}))!==fingerprint(before)||fingerprint(privatePath(file,false))!==fingerprint(before))C.fail('CONTINUITY_SOURCE_CHANGED');
    return bytes;
  }finally{fs.closeSync(fd);}
}
function stagePath(stage){
  platform();if(!/^continuity-[0-9a-f-]{36}$/.test(path.basename(stage))||!C.UUID.test(path.basename(stage).slice(11))||path.basename(path.dirname(stage))!=='.security-backups')C.fail('CONTINUITY_PATH_INVALID');
  privatePath(path.dirname(stage),true);privatePath(stage,true);
  if(Number(fs.statfsSync(stage).type)!==0xef53)C.fail('CONTINUITY_PROFILE_UNSUPPORTED');
}
function memory(bytes,sql){
  const db=new Sqlite(bytes,{readonly:true,timeout:0});
  try{
    if(require('better-sqlite3/package.json').version!=='13.0.3'||db.prepare('SELECT sqlite_version() v').get().v!=='3.53.4')C.fail('CONTINUITY_NATIVE_UNSUPPORTED');
    db.pragma('trusted_schema=OFF');db.pragma('query_only=ON');db.pragma('temp_store=MEMORY');
    if(db.pragma('user_version',{simple:true})!==1||db.pragma('integrity_check(1)',{simple:true})!=='ok')C.fail('CONTINUITY_CORRUPT');
    const actual=db.prepare('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name').all().map(r=>r.sql).sort();
    if(C.canonical(actual)!==C.canonical([...sql].sort()))C.fail('CONTINUITY_SCHEMA_UNSUPPORTED');
    return db;
  }catch(e){db.close();throw e;}
}
function segment(bytes,source){
  C.exact(source,['workspaceIdentity','privateIdentity']);
  const observation=inspectCapacityImage(bytes,source),db=new Sqlite(bytes,{readonly:true,timeout:0});
  try{
    const m=db.prepare('SELECT * FROM metadata').get(),state={};
    const {stateJson,...metadata}=m;
    state.metadata=C.canonical(metadata);state.snapshot=stateJson;
    state.principals=C.canonical(db.prepare('SELECT * FROM principals ORDER BY id').all());
    state.memberships=C.canonical(db.prepare('SELECT * FROM memberships ORDER BY projectId,principalId').all());
    state.throttle=C.canonical(db.prepare('SELECT * FROM throttle ORDER BY key').all());
    const operations=db.prepare('SELECT operationId AS id,snapshotRevision FROM operations ORDER BY operationId').all();
    const digests=db.prepare('SELECT digest FROM used_digests ORDER BY digest').all().map(r=>r.digest);
    return {observation,state,stateSha256:C.sha(C.canonical(state)),operations,digests};
  }finally{db.close();}
}
function blob(file,bytes){return {file,bytes:bytes.length,sha256:C.sha(bytes)};}
function readBlob(stage,ref,max){
  C.exact(ref,['file','bytes','sha256']);
  if(typeof ref.file!=='string'||!/^[a-z][a-z0-9-]*\.(?:sqlite|json)$/.test(ref.file)||!C.SHA.test(ref.sha256))C.fail();
  C.integer(ref.bytes,1,max);const bytes=readPrivate(path.join(stage,ref.file),max);
  if(bytes.length!==ref.bytes||C.sha(bytes)!==ref.sha256)C.fail('CONTINUITY_ARTIFACT_CHANGED');return bytes;
}
function rootOf(rows){return C.sha(rows.map(row=>C.canonical(row)).join(''));}
function expectedIndex(images){
  if(!Array.isArray(images)||images.length<1||images.length>C.LIMITS.segments||images.some(image=>!Array.isArray(image.operations)||!Array.isArray(image.digests)||image.operations.length>C.LIMITS.entriesPerSegment||image.digests.length>C.LIMITS.entriesPerSegment))C.fail('CONTINUITY_BOUND_EXCEEDED');
  const operations=[],digests=[],seenOperations=new Set(),seenDigests=new Set();
  images.forEach((image,ordinal)=>{
    for(const row of image.operations){if(seenOperations.has(row.id))C.fail('CONTINUITY_DUPLICATE_REPLAY');seenOperations.add(row.id);operations.push({id:row.id,segment:ordinal,snapshotRevision:row.snapshotRevision,requestHash:null});}
    for(const digest of image.digests){if(seenDigests.has(digest))C.fail('CONTINUITY_DUPLICATE_REPLAY');seenDigests.add(digest);digests.push({digest,segment:ordinal});}
  });
  operations.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);digests.sort((a,b)=>a.digest<b.digest?-1:a.digest>b.digest?1:0);
  return {operations,digests,operationRoot:rootOf(operations),digestRoot:rootOf(digests)};
}
function verifyIndex(bytes,expected){
  const db=memory(bytes,INDEX_SQL);
  try{
    for(const [table,rows,key] of [['operations',expected.operations,'id'],['digests',expected.digests,'digest']]){
      if(db.prepare('SELECT count(*) n FROM '+table).get().n!==rows.length)C.fail('CONTINUITY_INDEX_INVALID');
      const actual=db.prepare('SELECT * FROM '+table+' ORDER BY '+key).all();if(C.canonical(actual)!==C.canonical(rows))C.fail('CONTINUITY_INDEX_INVALID');
    }
  }finally{db.close();}
}
function verifySuccessor(bytes,expected,last,sealHash){
  const db=memory(bytes,SUCCESSOR_SQL);
  try{
    if(db.prepare('SELECT count(*) n FROM config').get().n!==1||db.prepare('SELECT count(*) n FROM state').get().n!==5||db.prepare('SELECT count(*) n FROM active_sessions').get().n!==0||db.prepare('SELECT count(*) n FROM audit').get().n!==1)C.fail('CONTINUITY_SUCCESSOR_INVALID');
    const config=C.parseCanonical(Buffer.from(db.prepare('SELECT raw FROM config WHERE id=1').get().raw));
    if(C.canonical(config)!==C.canonical({...expected,sealSha256:sealHash,sourceStateSha256:last.stateSha256,serviceKeysProvisioned:false,activated:false}))C.fail('CONTINUITY_SUCCESSOR_INVALID');
    for(const [name,raw] of Object.entries(last.state))if(db.prepare('SELECT raw FROM state WHERE name=?').get(name)?.raw!==raw)C.fail('CONTINUITY_SUCCESSOR_INVALID');
    const row=db.prepare('SELECT * FROM audit').get(),genesis={type:'AUDIT_CONTINUITY_GENESIS',lineageId:expected.lineageId,authorityId:expected.authorityId,epoch:expected.epoch,sealSha256:sealHash,generation:expected.generation,policyRevision:expected.policyRevision,snapshotRevision:expected.snapshotRevision,clockHighWater:expected.clockHighWater};
    if(row.sequence!==1||row.raw!==C.canonical(genesis)||row.previousHash!==last.observation.audit.headHash||row.hash!==C.sha(row.previousHash+'\n'+row.raw))C.fail('CONTINUITY_SUCCESSOR_INVALID');
  }finally{db.close();}
}
function controlFrom(db,trust){
  const actual=db.prepare('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL').all();if(actual.length!==1||actual[0].sql!==CONTROL_SQL||db.pragma('user_version',{simple:true})!==1||db.pragma('integrity_check(1)',{simple:true})!=='ok')C.fail('CONTINUITY_JOURNAL_INVALID');
  const rows=db.prepare('SELECT * FROM records ORDER BY sequence').all();if(rows.length<1||rows.length>4)C.fail('CONTINUITY_JOURNAL_INVALID');
  let head='0'.repeat(64);const values=[];
  for(let i=0;i<rows.length;i++){
    const r=rows[i];if(r.sequence!==i+1||r.phase!==PHASES[i]||r.previousHash!==head||r.hash!==C.sha(head+'\n'+r.payload))C.fail('CONTINUITY_JOURNAL_INVALID');
    values.push(C.parseCanonical(Buffer.from(r.payload)));head=r.hash;
  }
  const intent=values[0];C.exact(intent,['schema','lineageId','transitionId','expectedRevision','expectedPointer','successorAuthorityId','rootAnchorSha256','createdAt']);
  if(intent.schema!=='AUDIT_CONTINUITY_INTENT/1'||intent.lineageId!==trust.lineageId||!C.UUID.test(intent.transitionId)||!C.UUID.test(intent.successorAuthorityId)||!C.SHA.test(intent.rootAnchorSha256))C.fail('CONTINUITY_JOURNAL_INVALID');
  C.pointer(intent.expectedPointer);C.integer(intent.expectedRevision);C.integer(intent.createdAt);
  let prepared,receipt;
  if(values[1]){prepared=values[1];C.exact(prepared,['manifestSha256','proposal']);C.proposal(prepared.proposal);if(!C.SHA.test(prepared.manifestSha256)||prepared.proposal.intentHash!==C.sha(C.canonical(intent))||prepared.proposal.nextPointer.historyRoot!==prepared.manifestSha256||prepared.proposal.transitionId!==intent.transitionId||prepared.proposal.lineageId!==intent.lineageId||prepared.proposal.expectedRevision!==intent.expectedRevision||C.canonical(prepared.proposal.expectedPointer)!==C.canonical(intent.expectedPointer)||prepared.proposal.nextPointer.authorityId!==intent.successorAuthorityId)C.fail('CONTINUITY_JOURNAL_INVALID');}
  if(values[2]){C.exact(values[2],['anchorReceipt']);receipt=A.verifyReceipt(values[2].anchorReceipt,trust,undefined,{historical:true});if(C.canonical(receipt.payload.resolution?.proposal)!==C.canonical(prepared.proposal))C.fail('CONTINUITY_JOURNAL_INVALID');}
  if(values[3]){C.exact(values[3],['requestHash']);if(values[3].requestHash!==C.sha(C.canonical(prepared.proposal)))C.fail('CONTINUITY_JOURNAL_INVALID');}
  return {phase:rows.at(-1).phase,intent,...(prepared?{prepared}:{}),...(receipt?{receipt}:{})};
}
function readControl(stage,trust,{allowJournal=false}={}){
  const journal=path.join(stage,'control.sqlite-journal');
  if(fs.existsSync(journal)){
    if(!allowJournal)C.fail('CONTINUITY_STAGE_UNCERTAIN');
    if(privatePath(journal,false).size>BigInt(C.LIMITS.journalBytes))C.fail('CONTINUITY_BOUND_EXCEEDED');
  }
  const db=memory(readPrivate(path.join(stage,'control.sqlite'),C.LIMITS.journalBytes),[CONTROL_SQL]);
  try{return controlFrom(db,trust);}finally{db.close();}
}
function verifyStage(stage,trust,{allowPreparing=false,allowJournal=false}={}){
  try{
    const deadline=C.deadline();stagePath(stage);
    const control=readControl(stage,trust,{allowJournal});if(control.phase==='PREPARING'&&!allowPreparing)C.fail('CONTINUITY_STAGE_INCOMPLETE');
    if(path.basename(stage)!=='continuity-'+control.intent.transitionId)C.fail('CONTINUITY_PATH_INVALID');
    const manifestBytes=readPrivate(path.join(stage,'manifest.json'),C.LIMITS.manifestBytes),manifest=C.parseCanonical(manifestBytes);
    C.exact(manifest,['schema','lineageId','transitionId','ordinal','previousManifestHash','rootAnchor','segments','archives','index','seal','successor','successorConfig']);
    if(manifest.schema!=='AUDIT_LINEAGE_MANIFEST/1'||manifest.lineageId!==trust.lineageId||manifest.transitionId!==control.intent.transitionId)C.fail();
    C.integer(manifest.ordinal,1,C.LIMITS.segments);if(manifest.ordinal!==control.intent.expectedPointer.segments+1||!Array.isArray(manifest.segments)||manifest.segments.length!==manifest.ordinal||!Array.isArray(manifest.archives)||manifest.archives.length!==manifest.ordinal-1||
      manifest.previousManifestHash!==control.intent.expectedPointer.historyRoot)C.fail('CONTINUITY_LINEAGE_INVALID');
    if(control.prepared&&C.sha(manifestBytes)!==control.prepared.manifestSha256)C.fail('CONTINUITY_MANIFEST_CHANGED');
    const expectedFiles=['control.sqlite','manifest.json',manifest.rootAnchor.file,manifest.index.file,manifest.seal.file,manifest.successor.file];
    if(allowJournal&&fs.existsSync(path.join(stage,'control.sqlite-journal')))expectedFiles.push('control.sqlite-journal');
    const rootBytes=readBlob(stage,manifest.rootAnchor,16384),root=A.verifyReceipt(C.parseCanonical(rootBytes,16384),trust,undefined,{historical:true});
    if(C.sha(rootBytes)!==control.intent.rootAnchorSha256||root.payload.resolution!==null||root.payload.state.pointer.segments!==0)C.fail('CONTINUITY_LINEAGE_INVALID');
    const images=[],summaries=[];
    for(let i=0;i<manifest.segments.length;i++){
      C.checkDeadline(deadline);const record=manifest.segments[i];C.exact(record,['ordinal','image','source','observation','stateSha256']);
      if(record.ordinal!==i||record.image.file!=='segment-'+String(i).padStart(2,'0')+'.sqlite')C.fail('CONTINUITY_LINEAGE_INVALID');
      expectedFiles.push(record.image.file);const bytes=readBlob(stage,record.image,C.LIMITS.segmentBytes),parsed=segment(bytes,record.source);
      if(C.canonical(parsed.observation)!==C.canonical(record.observation)||parsed.stateSha256!==record.stateSha256)C.fail('CONTINUITY_LINEAGE_INVALID');
      const previous=summaries.at(-1);if(previous&&(parsed.observation.generation<=previous.generation||['policyRevision','snapshotRevision','clockHighWater'].some(k=>parsed.observation[k]<previous[k])))C.fail('CONTINUITY_ROLLBACK');
      summaries.push(parsed.observation);
      images.push({operations:parsed.operations,digests:parsed.digests,...(i===manifest.segments.length-1?{state:parsed.state,stateSha256:parsed.stateSha256,observation:parsed.observation}:{})});
    }
    const first=manifest.segments[0].observation,last=images.at(-1);
    if(root.payload.state.pointer.dbSha256!==first.databaseSha256||['generation','policyRevision','snapshotRevision','clockHighWater'].some(k=>root.payload.state.pointer[k]!==first[k])||
      control.intent.expectedPointer.dbSha256!==last.observation.databaseSha256||['generation','policyRevision','snapshotRevision','clockHighWater'].some(k=>control.intent.expectedPointer[k]!==last.observation[k])||
      control.intent.expectedPointer.epoch!==root.payload.state.pointer.epoch+manifest.ordinal-1)C.fail('CONTINUITY_LINEAGE_INVALID');
    let previousHash=null,previousPointer=root.payload.state.pointer,previousRevision=root.payload.state.revision;
    for(let i=0;i<manifest.archives.length;i++){
      C.checkDeadline(deadline);const archive=manifest.archives[i];C.exact(archive,['ordinal','manifest','index','seal','successor','anchorReceipt']);
      if(archive.ordinal!==i+1)C.fail('CONTINUITY_LINEAGE_INVALID');
      for(const ref of Object.values(archive).filter(v=>typeof v==='object'))expectedFiles.push(ref.file);
      const oldBytes=readBlob(stage,archive.manifest,C.LIMITS.manifestBytes),old=C.parseCanonical(oldBytes);
      C.exact(old,['schema','lineageId','transitionId','ordinal','previousManifestHash','rootAnchor','segments','archives','index','seal','successor','successorConfig']);
      if(old.schema!=='AUDIT_LINEAGE_MANIFEST/1'||old.lineageId!==manifest.lineageId||old.ordinal!==i+1||old.previousManifestHash!==previousHash||C.canonical(old.segments)!==C.canonical(manifest.segments.slice(0,i+1))||
        C.canonical(old.archives)!==C.canonical(manifest.archives.slice(0,i))||old.rootAnchor.sha256!==manifest.rootAnchor.sha256)C.fail('CONTINUITY_LINEAGE_INVALID');
      const archived={};
      for(const [key,max] of [['index',C.LIMITS.indexBytes],['seal',C.LIMITS.manifestBytes],['successor',C.LIMITS.successorBytes]]){
        const bytes=readBlob(stage,archive[key],max);if(old[key].sha256!==C.sha(bytes)||old[key].bytes!==bytes.length)C.fail('CONTINUITY_LINEAGE_INVALID');archived[key]=bytes;
      }
      const receipt=A.verifyReceipt(C.parseCanonical(readBlob(stage,archive.anchorReceipt,16384),16384),trust,undefined,{historical:true});
      const proposal=receipt.payload.resolution?.proposal,observation=manifest.segments[i].observation;
      if(!proposal||proposal.expectedRevision<previousRevision||proposal.transitionId!==old.transitionId||proposal.nextPointer.historyRoot!==C.sha(oldBytes)||proposal.nextPointer.dbSha256!==old.successor.sha256||proposal.expectedPointer.authorityId!==previousPointer.authorityId||proposal.expectedPointer.epoch!==previousPointer.epoch||proposal.expectedPointer.historyRoot!==previousHash||proposal.expectedPointer.segments!==i||proposal.expectedPointer.dbSha256!==observation.databaseSha256||['generation','policyRevision','snapshotRevision','clockHighWater'].some(k=>proposal.expectedPointer[k]!==observation[k]))C.fail('CONTINUITY_LINEAGE_INVALID');
      const historicalIndex=expectedIndex(images.slice(0,i+1));verifyIndex(archived.index,historicalIndex);
      const historicalSeal={schema:'AUDIT_CONTINUITY_SEAL/1',lineageId:old.lineageId,transitionId:old.transitionId,previousManifestHash:old.previousManifestHash,rootAnchorSha256:old.rootAnchor.sha256,segments:old.segments,indexSha256:old.index.sha256,operationCount:historicalIndex.operations.length,digestCount:historicalIndex.digests.length,operationRoot:historicalIndex.operationRoot,digestRoot:historicalIndex.digestRoot};
      if(C.canonical(C.parseCanonical(archived.seal))!==C.canonical(historicalSeal))C.fail('CONTINUITY_SEAL_INVALID');
      const historicalConfig={schema:'CONTINUITY_SUCCESSOR/1',lineageId:old.lineageId,transitionId:old.transitionId,authorityId:proposal.nextPointer.authorityId,epoch:proposal.nextPointer.epoch,generation:proposal.nextPointer.generation,policyRevision:observation.policyRevision,snapshotRevision:observation.snapshotRevision,clockHighWater:observation.clockHighWater,sourceDbSha256:observation.databaseSha256};
      if(C.canonical(old.successorConfig)!==C.canonical(historicalConfig))C.fail('CONTINUITY_SUCCESSOR_INVALID');
      const historicalSegment=segment(readBlob(stage,manifest.segments[i].image,C.LIMITS.segmentBytes),manifest.segments[i].source);
      verifySuccessor(archived.successor,historicalConfig,historicalSegment,C.sha(archived.seal));
      previousHash=C.sha(oldBytes);previousPointer=proposal.nextPointer;previousRevision=receipt.payload.resolution.committedRevision;
    }
    if(previousHash!==manifest.previousManifestHash||control.intent.expectedPointer.authorityId!==previousPointer.authorityId||control.intent.expectedRevision<previousRevision)C.fail('CONTINUITY_LINEAGE_INVALID');
    const expected=expectedIndex(images),indexBytes=readBlob(stage,manifest.index,C.LIMITS.indexBytes);verifyIndex(indexBytes,expected);
    const sealBytes=readBlob(stage,manifest.seal,C.LIMITS.manifestBytes),seal=C.parseCanonical(sealBytes);
    const wantedSeal={schema:'AUDIT_CONTINUITY_SEAL/1',lineageId:manifest.lineageId,transitionId:manifest.transitionId,previousManifestHash:manifest.previousManifestHash,rootAnchorSha256:manifest.rootAnchor.sha256,segments:manifest.segments,indexSha256:manifest.index.sha256,operationCount:expected.operations.length,digestCount:expected.digests.length,operationRoot:expected.operationRoot,digestRoot:expected.digestRoot};
    if(C.canonical(seal)!==C.canonical(wantedSeal))C.fail('CONTINUITY_SEAL_INVALID');
    const wantedConfig={schema:'CONTINUITY_SUCCESSOR/1',lineageId:manifest.lineageId,transitionId:manifest.transitionId,authorityId:control.intent.successorAuthorityId,epoch:control.intent.expectedPointer.epoch+1,generation:last.observation.generation+1,policyRevision:last.observation.policyRevision,snapshotRevision:last.observation.snapshotRevision,clockHighWater:last.observation.clockHighWater,sourceDbSha256:last.observation.databaseSha256};
    if(C.canonical(manifest.successorConfig)!==C.canonical(wantedConfig))C.fail('CONTINUITY_SUCCESSOR_INVALID');
    verifySuccessor(readBlob(stage,manifest.successor,C.LIMITS.successorBytes),wantedConfig,last,C.sha(sealBytes));
    if(control.prepared&&(control.prepared.proposal.nextPointer.dbSha256!==manifest.successor.sha256||control.prepared.proposal.nextPointer.epoch!==wantedConfig.epoch||control.prepared.proposal.nextPointer.generation!==wantedConfig.generation))C.fail('CONTINUITY_FENCE_INVALID');
    const entries=fs.readdirSync(stage).sort();if(new Set(expectedFiles).size!==expectedFiles.length||C.canonical(entries)!==C.canonical(expectedFiles.sort()))C.fail('CONTINUITY_STAGE_INVENTORY_INVALID');
    C.checkDeadline(deadline);
    return {control,manifest,manifestBytes,expectedIndex:expected,last,rootAnchorBytes:rootBytes};
  }catch(error){throw C.mapped(error);}
}
function lookupReplay(stage,kind,value,trust){
  if(!['operation','digest'].includes(kind)||typeof value!=='string'||(kind==='operation'?!/^[0-9a-f-]{36}$/.test(value):!C.SHA.test(value)))C.fail('CONTINUITY_INPUT_INVALID');
  const verified=verifyStage(stage,trust),rows=kind==='operation'?verified.expectedIndex.operations:verified.expectedIndex.digests,key=kind==='operation'?'id':'digest';
  const row=rows.find(row=>row[key]===value);
  return {seen:!!row,segmentOrdinal:row?.segment??null,historicalRequestHash:row&&kind==='operation'?row.requestHash:null,authorized:false,completeSealedHistory:true};
}
module.exports={INDEX_SQL,SUCCESSOR_SQL,CONTROL_SQL,PHASES,platform,privatePath,readPrivate,stagePath,memory,segment,blob,readBlob,expectedIndex,verifyIndex,verifySuccessor,controlFrom,readControl,verifyStage,lookupReplay};
