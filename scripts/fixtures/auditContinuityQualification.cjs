'use strict';
// SYNTHETIC ONLY: task-owned ext4 images; never accepts an operator workspace.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Sqlite=require('better-sqlite3');
const {spawnSync,spawn}=require('node:child_process');
const {fixture}=require('./capacityInspectorSynthetic.cjs');
const {SyntheticAnchor,initialPointer}=require('./auditContinuitySynthetic.cjs');
const C=require('../../server/security/workspaceAccess/continuity/contracts.cjs'),V=require('../../server/security/workspaceAccess/continuity/verify.cjs'),S=require('../../server/security/workspaceAccess/continuity/stage.cjs');
const sourceRoot=process.argv[3],outputRoot=process.argv[4];
function source(n){return path.join(sourceRoot,'source-'+n);}
function image(n){return V.readPrivate(path.join(source(n),'.security/authority.sqlite'),C.LIMITS.segmentBytes);}
function pointer(n,previous={}){const w=fs.statSync(source(n),{bigint:true}),d=fs.statSync(path.join(source(n),'.security'),{bigint:true}),o=V.segment(image(n),{workspaceIdentity:w.dev+':'+w.ino,privateIdentity:d.dev+':'+d.ino}).observation;return initialPointer({...previous,dbSha256:o.databaseSha256,generation:o.generation,policyRevision:o.policyRevision,snapshotRevision:o.snapshotRevision,clockHighWater:o.clockHighWater});}
function prepare(){
  fs.mkdirSync(sourceRoot,{mode:0o700});
  for(let n=0;n<9;n++){
    fs.mkdirSync(source(n),{mode:0o700});const security=path.join(source(n),'.security');fs.mkdirSync(security,{mode:0o700});
    const w=fs.statSync(source(n),{bigint:true}),s=fs.statSync(security,{bigint:true}),count=n===0?4094:n===1?4095:4096;
    const db=fixture({workspaceIdentity:w.dev+':'+w.ino,privateIdentity:s.dev+':'+s.ino,audit:count,operations:count,digests:0});
    db.transaction(()=>{
      db.prepare('UPDATE metadata SET generation=?,policyRevision=?,snapshotRevision=?,clockHighWater=?,stateJson=?').run(n+1,n+1,n+1,(n+1)*1000,JSON.stringify({schemaVersion:1,state:{projects:[{id:'SYNTHETIC-PROJECT'}]}}));
      db.prepare('UPDATE principals SET disabled=1,credentialRevision=?').run(n+3);
      db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run('SYNTHETIC-PROJECT','SYNTHETIC-OWNER','OWNER',JSON.stringify(['project:write']));
      db.prepare('UPDATE operations SET snapshotRevision=?').run(n+1);
      db.prepare('INSERT INTO throttle VALUES(?,?,?)').run(C.sha('SYNTHETIC-THROTTLE'),0,3);
      for(let i=0;i<count;i++)db.prepare('INSERT INTO used_digests VALUES(?)').run(C.sha('SYNTHETIC-'+n+'-'+i));
      db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?)').run(C.sha('SYNTHETIC-'+n+'-0'),'SYNTHETIC-OWNER',n+1,n+3,0,0,1);
      let head='0'.repeat(64);for(const row of db.prepare('SELECT * FROM audit ORDER BY sequence').all()){
        const event=JSON.parse(row.raw);event.generation=n+1;event.policyRevision=n+1;event.snapshotRevision=n+1;event.at=(n+1)*1000;
        const raw=JSON.stringify(event),hash=C.sha(head+'\n'+raw);db.prepare('UPDATE audit SET raw=?,previousHash=?,hash=? WHERE sequence=?').run(raw,head,hash,row.sequence);head=hash;
      }
    })();
    fs.writeFileSync(path.join(security,'authority.sqlite'),db.serialize(),{mode:0o600});db.close();
  }
  const unsupported=path.join(sourceRoot,'schema2');fs.mkdirSync(unsupported,{mode:0o700});fs.mkdirSync(path.join(unsupported,'.security'),{mode:0o700});
  const db=fixture();db.pragma('user_version=2');fs.writeFileSync(path.join(unsupported,'.security/authority.sqlite'),db.serialize(),{mode:0o600});db.close();
  fs.symlinkSync(source(0),path.join(sourceRoot,'linked-source'));
}
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
function newAnchor(n=0){return new SyntheticAnchor(path.join(outputRoot,'anchor-'+crypto.randomUUID()+'.sqlite'),pointer(n));}
function opts(n=0,priorStage){return {sourceWorkspace:source(n),destinationBase:path.join(outputRoot,'.security-backups'),transitionId:crypto.randomUUID(),...(priorStage?{priorStage}:{})};}
function fingerprint(){const rows=[];for(let n=0;n<9;n++)for(const f of [source(n),path.join(source(n),'.security'),path.join(source(n),'.security/authority.sqlite')]){const s=fs.statSync(f,{bigint:true});rows.push([f,...['dev','ino','nlink','uid','gid','mode','size','atimeNs','mtimeNs','ctimeNs','birthtimeNs'].map(k=>String(s[k]))]);}return C.canonical(rows);}
async function verify(){
  fs.mkdirSync(path.join(outputRoot,'.security-backups'),{mode:0o700});
  const before=fingerprint(),hashes=Array.from({length:9},(_,n)=>C.sha(image(n)));let chain=[];
  const anchor=newAnchor();
  try{
    await check('AC10 exact 4094/4095/4096 segments and complete eight-segment chain',async()=>{
      let prior;
      for(let n=0;n<8;n++){
        if(n)anchor.advance(pointer(n,anchor.state().pointer));
        const prepared=await S.prepareTransition(opts(n,prior),anchor,anchor.trust);assert.equal(prepared.activated,false);assert.equal(prepared.status,'PREPARED');
        const pending=await S.recoverTransition(prepared.stage,anchor,anchor.trust);assert.equal(pending.status,'PREPARED_NOT_COMMITTED');
        const done=await S.commitTransition(prepared.stage,anchor,anchor.trust);assert.equal(done.status,'FINALIZED');assert.equal(done.syntheticOnly,true);assert.equal(done.runtimeContinuityComplete,false);
        const value=V.verifyStage(done.stage,anchor.trust);assert.equal(value.manifest.ordinal,n+1);assert.equal(value.expectedIndex.operations.length,4094+(n>=1?4095:0)+Math.max(0,n-1)*4096);
        for(let j=0;j<=n;j++)assert.equal(C.sha(V.readBlob(done.stage,value.manifest.segments[j].image,C.LIMITS.segmentBytes)),hashes[j]);
        assert.equal(value.last.observation.counts.audit,n===0?4094:n===1?4095:4096);
        assert.equal(JSON.parse(value.last.state.principals)[0].disabled,1);assert.equal(JSON.parse(value.last.state.principals)[0].credentialRevision,n+3);
        assert.deepEqual(JSON.parse(JSON.parse(value.last.state.memberships)[0].deniedActions),['project:write']);
        assert.equal(JSON.parse(value.last.state.throttle)[0].attempts,3);
        const successor=new Sqlite(V.readBlob(done.stage,value.manifest.successor,C.LIMITS.successorBytes),{readonly:true});assert.equal(successor.prepare('SELECT count(*) n FROM active_sessions').get().n,0);successor.close();
        chain.push(done.stage);prior=done.stage;
        console.log('MEASURE segments='+value.manifest.ordinal+' operations='+value.expectedIndex.operations.length+' digests='+value.expectedIndex.digests.length+' indexBytes='+value.manifest.index.bytes);
      }
    });
    await check('AC11 exact replay lookup covers oldest and newest records without authorization',()=>{
      const v=V.verifyStage(chain.at(-1),anchor.trust);
      for(const row of [v.expectedIndex.operations[0],v.expectedIndex.operations.at(-1)])assert.deepEqual(V.lookupReplay(chain.at(-1),'operation',row.id,anchor.trust),{seen:true,segmentOrdinal:row.segment,historicalRequestHash:null,authorized:false,completeSealedHistory:true});
      for(const row of [v.expectedIndex.digests[0],v.expectedIndex.digests.at(-1)])assert.equal(V.lookupReplay(chain.at(-1),'digest',row.digest,anchor.trust).seen,true);
      assert.equal(V.lookupReplay(chain.at(-1),'operation',crypto.randomUUID(),anchor.trust).seen,false);
    });
    await check('AC12 ninth segment refuses without pruning or output',async()=>{
      anchor.advance(pointer(8,anchor.state().pointer));const before=fs.readdirSync(path.join(outputRoot,'.security-backups')).sort();
      await assert.rejects(S.prepareTransition(opts(8,chain.at(-1)),anchor,anchor.trust),/CONTINUITY_BOUND_EXCEEDED/);assert.deepEqual(fs.readdirSync(path.join(outputRoot,'.security-backups')).sort(),before);
    });
    await check('AC13 missing corrupt linked and overbroad-permission history fails closed',()=>{
      const stage=chain.at(-1),v=V.verifyStage(stage,anchor.trust),target=path.join(stage,v.manifest.index.file),bytes=V.readPrivate(target,C.LIMITS.indexBytes);
      fs.renameSync(target,target+'.held');assert.throws(()=>V.lookupReplay(stage,'digest','f'.repeat(64),anchor.trust));fs.renameSync(target+'.held',target);
      fs.writeFileSync(target,Buffer.alloc(bytes.length));assert.throws(()=>V.verifyStage(stage,anchor.trust));fs.writeFileSync(target,bytes);
      fs.chmodSync(target,0o644);assert.throws(()=>V.verifyStage(stage,anchor.trust));fs.chmodSync(target,0o600);
      fs.linkSync(target,target+'.linked');assert.throws(()=>V.verifyStage(stage,anchor.trust));fs.unlinkSync(target+'.linked');
      const segment=path.join(stage,'segment-00.sqlite');fs.renameSync(segment,segment+'.held');assert.throws(()=>V.verifyStage(stage,anchor.trust));fs.renameSync(segment+'.held',segment);
      assert.equal(V.verifyStage(stage,anchor.trust).manifest.ordinal,8);
    });
  }finally{anchor.close();}
  await check('AC14 competing prepared successors cannot both commit',async()=>{
    const a=newAnchor();try{const one=await S.prepareTransition(opts(),a,a.trust),two=await S.prepareTransition(opts(),a,a.trust);await S.commitTransition(one.stage,a,a.trust);await assert.rejects(S.commitTransition(two.stage,a,a.trust));assert.equal(a.state().revision,1);assert.equal(V.readControl(two.stage,a.trust).phase,'PREPARED');}finally{a.close();}
  });
  await check('AC15 durable CAS lost acknowledgment resolves without another CAS',async()=>{
    const a=newAnchor();try{const p=await S.prepareTransition(opts(),a,a.trust);a.fault='lost-ack';await assert.rejects(S.commitTransition(p.stage,a,a.trust));assert.equal(a.state().revision,1);assert.equal(V.readControl(p.stage,a.trust).phase,'PREPARED');a.fault=null;
      const forbidden=async()=>{throw Error('CAS must not be called during recovery');};const provider={resolve:r=>a.resolve(r),compareAndSwap:forbidden};
      assert.equal((await S.recoverTransition(p.stage,provider,a.trust)).status,'FINALIZED');assert.equal(a.state().revision,1);
      a.advance({...a.state().pointer,policyRevision:2});assert.equal((await S.recoverTransition(p.stage,provider,a.trust)).status,'FINALIZED_SUPERSEDED');
    }finally{a.close();}
  });
  await check('AC16 intervening revocation invalidates commit and unavailable resolution stays unavailable',async()=>{
    const a=newAnchor();try{const p=await S.prepareTransition(opts(),a,a.trust);a.advance({...a.state().pointer,policyRevision:2});await assert.rejects(S.commitTransition(p.stage,a,a.trust));await assert.rejects(S.recoverTransition(p.stage,{resolve:async()=>{throw Error('offline');}},a.trust));assert.equal(V.readControl(p.stage,a.trust).phase,'PREPARED');}finally{a.close();}
  });
  await check('AC17 source hashes metadata timestamps and sidecar inventory unchanged',()=>{assert.equal(fingerprint(),before);for(let n=0;n<9;n++){assert.equal(C.sha(image(n)),hashes[n]);assert.deepEqual(fs.readdirSync(path.join(source(n),'.security')),['authority.sqlite']);}});
  await check('AC18 unsupported schema2 and linked source cannot produce a stage',async()=>{
    const a=newAnchor();try{for(const child of ['schema2','linked-source']){const before=fs.readdirSync(path.join(outputRoot,'.security-backups')).sort();await assert.rejects(S.prepareTransition({...opts(),sourceWorkspace:path.join(sourceRoot,child)},a,a.trust));assert.deepEqual(fs.readdirSync(path.join(outputRoot,'.security-backups')).sort(),before);}}finally{a.close();}
  });
  for(const fault of ['phase-PREPARING','partial-segment','manifest-flushed','payloads-flushed','after-insert-PREPARED','phase-PREPARED','zero-write','fsync-eio','disk-full','short-write'])await check('AC19 actual process/I/O boundary '+fault,async()=>{
    const a=newAnchor(),options=opts(),stage=path.join(options.destinationBase,'continuity-'+options.transitionId),config=path.join(outputRoot,'fault-'+options.transitionId+'.json'),filler=path.join(outputRoot,'filler-'+options.transitionId);
    try{
      fs.writeFileSync(config,JSON.stringify({anchor:a.db.name,trust:a.trust,privateKeyPem:a.keys.privateKey.export({format:'pem',type:'pkcs8'}),fault,mode:'prepare',options,filler}),{mode:0o600});
      const child=spawnSync(process.execPath,[path.join(__dirname,'auditContinuityFaultProbe.cjs'),config],{timeout:30000,encoding:'utf8'});
      if(fs.existsSync(filler))fs.unlinkSync(filler);
      assert.equal(child.error,undefined);assert.equal(a.state().revision,0);assert.ok(fs.existsSync(stage));
      if(fault==='short-write'){assert.equal(child.status,0,child.stderr);assert.equal((await S.commitTransition(stage,a,a.trust)).status,'FINALIZED');}
      else if(fault==='phase-PREPARED'){assert.equal(child.signal,'SIGKILL');assert.equal((await S.recoverTransition(stage,a,a.trust)).status,'PREPARED_NOT_COMMITTED');}
      else {if(['zero-write','fsync-eio','disk-full'].includes(fault))assert.equal(child.status,2,child.stderr);else assert.equal(child.signal,'SIGKILL');await assert.rejects(S.recoverTransition(stage,a,a.trust));assert.equal(a.state().revision,0);}
    }finally{a.close();}
  });
  for(const fault of ['remote-before','remote-after','after-insert-COMMIT_CONFIRMED','phase-COMMIT_CONFIRMED','after-insert-FINALIZED','phase-FINALIZED','final-ack'])await check('AC20 actual process death at '+fault,async()=>{
    const a=newAnchor();try{
      const prepared=await S.prepareTransition(opts(),a,a.trust),config=path.join(outputRoot,'fault-'+prepared.transitionId+'.json');
      fs.writeFileSync(config,JSON.stringify({anchor:a.db.name,trust:a.trust,privateKeyPem:a.keys.privateKey.export({format:'pem',type:'pkcs8'}),fault,mode:'commit',stage:prepared.stage}),{mode:0o600});
      const child=spawnSync(process.execPath,[path.join(__dirname,'auditContinuityFaultProbe.cjs'),config],{timeout:30000,encoding:'utf8'});assert.equal(child.error,undefined);assert.equal(child.signal,'SIGKILL',child.stderr);
      if(fault.startsWith('after-insert-')){const journal=path.join(prepared.stage,'control.sqlite-journal');assert.ok(fs.existsSync(journal));const bytes=V.readPrivate(journal,C.LIMITS.journalBytes);console.log('MEASURE boundary='+fault+' journalBytes='+bytes.length+' sqliteHotHeader='+(bytes.subarray(0,8).toString('hex')==='d9d505f920a163d7'));}
      const committed=fault!=='remote-before';assert.equal(a.state().revision,committed?1:0);
      const result=await S.recoverTransition(prepared.stage,{resolve:r=>a.resolve(r)},a.trust);assert.equal(result.status,committed?'FINALIZED':'PREPARED_NOT_COMMITTED');assert.equal(a.state().revision,committed?1:0);
    }finally{a.close();}
  });
  await check('AC22 tampering during anchor await prevents completion and resolves only after exact restoration',async()=>{
    const a=newAnchor();try{
      const p=await S.prepareTransition(opts(),a,a.trust),target=path.join(p.stage,'replay.sqlite'),bytes=V.readPrivate(target,C.LIMITS.indexBytes);
      const provider={resolve:r=>a.resolve(r),compareAndSwap:async r=>{const receipt=await a.compareAndSwap(r);fs.writeFileSync(target,Buffer.alloc(bytes.length));return receipt;}};
      await assert.rejects(S.commitTransition(p.stage,provider,a.trust));assert.equal(a.state().revision,1);assert.equal(V.readControl(p.stage,a.trust).phase,'PREPARED');await assert.rejects(S.recoverTransition(p.stage,a,a.trust));
      fs.writeFileSync(target,bytes);assert.equal((await S.recoverTransition(p.stage,a,a.trust)).status,'FINALIZED');assert.equal(a.state().revision,1);
    }finally{a.close();}
  });
  await check('AC23 separate processes cannot commit competing successors',async()=>{
    const a=newAnchor();try{
      const stages=[await S.prepareTransition(opts(),a,a.trust),await S.prepareTransition(opts(),a,a.trust)];
      const runs=stages.map(prepared=>{
        const config=path.join(outputRoot,'concurrent-'+prepared.transitionId+'.json');fs.writeFileSync(config,JSON.stringify({anchor:a.db.name,trust:a.trust,privateKeyPem:a.keys.privateKey.export({format:'pem',type:'pkcs8'}),fault:'none',mode:'commit',stage:prepared.stage}),{mode:0o600});
        return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'auditContinuityFaultProbe.cjs'),config],{stdio:'ignore',timeout:30000});child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));});
      });
      const outcomes=await Promise.all(runs);assert.deepEqual(outcomes.map(o=>o.signal),[null,null]);assert.deepEqual(outcomes.map(o=>o.code).sort(),[0,2]);assert.equal(a.state().revision,1);
      assert.equal(stages.filter(p=>V.readControl(p.stage,a.trust).phase==='FINALIZED').length,1);
    }finally{a.close();}
  });
  await check('AC24 stage UUID mismatch refuses without native SQLite mutation',async()=>{
    const a=newAnchor();try{const p=await S.prepareTransition(opts(),a,a.trust),wrong=path.join(path.dirname(p.stage),'continuity-'+crypto.randomUUID());fs.renameSync(p.stage,wrong);const file=path.join(wrong,'control.sqlite'),bytes=V.readPrivate(file,C.LIMITS.journalBytes),stat=fs.statSync(file,{bigint:true});await assert.rejects(S.recoverTransition(wrong,a,a.trust));assert.deepEqual(fs.statSync(file,{bigint:true}),stat);assert.equal(C.sha(V.readPrivate(file,C.LIMITS.journalBytes)),C.sha(bytes));fs.renameSync(wrong,p.stage);}finally{a.close();}
  });
  await check('AC25 operational trust never calls providers or changes source/output',async()=>{
    const a=newAnchor();try{
      const prepared=await S.prepareTransition(opts(),a,a.trust),sourceBefore=fingerprint(),base=path.join(outputRoot,'.security-backups'),inventory=fs.readdirSync(base).sort();
      const control=path.join(prepared.stage,'control.sqlite'),bytes=V.readPrivate(control,C.LIMITS.journalBytes),stat=fs.statSync(control,{bigint:true});let calls=0;
      const trap=()=>{calls++;throw Error('OPERATIONAL provider must never be called');},client={observe:trap,compareAndSwap:trap,resolve:trap},trust={...a.trust,domain:'OPERATIONAL'};
      await assert.rejects(S.prepareTransition(opts(),client,trust),/CONTINUITY_OPERATIONAL_TRANSITION_UNSUPPORTED/);
      await assert.rejects(S.commitTransition(prepared.stage,client,trust),/CONTINUITY_OPERATIONAL_TRANSITION_UNSUPPORTED/);
      await assert.rejects(S.recoverTransition(prepared.stage,client,trust),/CONTINUITY_OPERATIONAL_TRANSITION_UNSUPPORTED/);
      assert.equal(calls,0);assert.equal(fingerprint(),sourceBefore);assert.deepEqual(fs.readdirSync(base).sort(),inventory);assert.deepEqual(fs.statSync(control,{bigint:true}),stat);assert.equal(C.sha(V.readPrivate(control,C.LIMITS.journalBytes)),C.sha(bytes));
    }finally{a.close();}
  });
  await check('AC21 all fault probes preserve original source bytes and metadata',()=>{assert.equal(fingerprint(),before);for(let n=0;n<9;n++)assert.equal(C.sha(image(n)),hashes[n]);});
  console.log('Audit continuity readonly qualification: '+passed+' passed, 0 failed');
}
if(process.argv[2]==='prepare')prepare();else if(process.argv[2]==='verify')verify().catch(e=>{console.error(e);process.exitCode=1;});else throw Error('Explicit fixture mode required');
