import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let passed=0,failed=0;
async function check(name:string,fn:()=>unknown){try{await fn();passed++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+String(error));}}
const base=path.resolve('server/security/workspaceAccess/continuity');
for(const name of ['contracts','anchor','verify','stage'])await check('AC01 '+name+' exists',()=>assert.ok(fs.existsSync(path.join(base,name+'.cjs')),'Missing continuity '+name));
if(['contracts','anchor'].every(name=>fs.existsSync(path.join(base,name+'.cjs')))){
  const {readCurrent,commitAnchor,resolveAnchor}=require(path.join(base,'anchor.cjs'));
  const {canonical,sha}=require(path.join(base,'contracts.cjs'));
  const {SyntheticAnchor,initialPointer}=require('./fixtures/auditContinuitySynthetic.cjs');
  const parent=fs.realpathSync.native(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'dmk-continuity-anchor-'));
  const anchor=new SyntheticAnchor(path.join(root,'anchor.sqlite'),initialPointer());
  const trust=anchor.trust;
  try{
    await check('AC02 configured synthetic signer and fresh nonce bind observation',async()=>{
      const receipt=await readCurrent(anchor,trust);assert.equal(receipt.payload.domain,'SYNTHETIC');assert.equal(receipt.payload.state.revision,0);
    });
    await check('AC03 stale future wrong nonce and revoked signer fail closed',async()=>{
      for(const mode of ['stale','future','nonce','signature']){
        anchor.fault=mode;await assert.rejects(readCurrent(anchor,trust));anchor.fault=null;
      }
      await assert.rejects(readCurrent(anchor,{...trust,revokedKeyIds:[trust.keyId]}));
    });
    const current=anchor.state(),proposal={lineageId:trust.lineageId,transitionId:'11111111-1111-4111-8111-111111111111',intentHash:'a'.repeat(64),expectedRevision:0,expectedPointer:current.pointer,nextPointer:{...current.pointer,authorityId:'22222222-2222-4222-8222-222222222222',epoch:2,generation:2,historyRoot:'b'.repeat(64),dbSha256:'c'.repeat(64),segments:1}};
    await check('AC04 real SQLite CAS is idempotent and changed body cannot recommit',async()=>{
      const first=await commitAnchor(anchor,trust,proposal);assert.equal(first.payload.state.revision,1);
      const repeated=await commitAnchor(anchor,trust,proposal);assert.equal(repeated.payload.state.revision,1);
      await assert.rejects(commitAnchor(anchor,trust,{...proposal,nextPointer:{...proposal.nextPointer,dbSha256:'d'.repeat(64)}}));
      assert.equal(anchor.state().revision,1);
    });
    await check('AC05 lost acknowledgement resolves exact committed request',async()=>{
      const resolved=await resolveAnchor(anchor,trust,proposal);assert.equal(resolved.payload.resolution.requestHash,sha(canonical(proposal)));assert.equal(anchor.state().revision,1);
      await assert.rejects(resolveAnchor(anchor,trust,{...proposal,intentHash:'f'.repeat(64)}));
    });
    await check('AC06 stale competing CAS cannot publish another current authority',async()=>{
      await assert.rejects(commitAnchor(anchor,trust,{...proposal,transitionId:'33333333-3333-4333-8333-333333333333',nextPointer:{...proposal.nextPointer,authorityId:'44444444-4444-4444-8444-444444444444'}}));
      assert.equal(anchor.state().pointer.authorityId,proposal.nextPointer.authorityId);
    });
    if(fs.existsSync(path.join(base,'stage.cjs')))await check('AC07 offline staging refuses ordinary writable or unsupported source before output',async()=>{
      const output=path.join(root,'.security-backups');fs.mkdirSync(output,{mode:0o700});
      const {prepareTransition}=require(path.join(base,'stage.cjs'));
      await assert.rejects(prepareTransition({sourceWorkspace:root,destinationBase:output,transitionId:'55555555-5555-4555-8555-555555555555'},anchor,trust));
      assert.deepEqual(fs.readdirSync(output),[]);
    });
    await check('AC08 noncanonical duplicate unsafe and oversized contracts fail closed',()=>{
      const C=require(path.join(base,'contracts.cjs'));
      assert.throws(()=>C.parseCanonical(Buffer.from('{"a":1,"a":2}\n')));
      assert.throws(()=>C.parseCanonical(Buffer.from([34,255,34,10])));
      assert.throws(()=>C.canonical(JSON.parse('{"__proto__":{}}')));
      assert.throws(()=>C.parseCanonical(Buffer.alloc(C.LIMITS.manifestBytes+1)));
      assert.throws(()=>C.pointer({...initialPointer(),segments:9}));
    });
    await check('AC08b operational transitions are unavailable before file access or provider calls',async()=>{
      const S=require(path.join(base,'stage.cjs'));let calls=0;const client={observe:()=>{calls++;},compareAndSwap:()=>{calls++;},resolve:()=>{calls++;}};
      const operational={...trust,domain:'OPERATIONAL'};
      await assert.rejects(S.prepareTransition({},client,operational),/CONTINUITY_OPERATIONAL_TRANSITION_UNSUPPORTED/);
      await assert.rejects(S.commitTransition('not-a-path',client,operational),/CONTINUITY_OPERATIONAL_TRANSITION_UNSUPPORTED/);
      await assert.rejects(S.recoverTransition('not-a-path',client,operational),/CONTINUITY_OPERATIONAL_TRANSITION_UNSUPPORTED/);assert.equal(calls,0);
    });
    await check('AC09 maximum complete index has no body copies and rejects truncation duplication or changed receipts',()=>{
      const V=require(path.join(base,'verify.cjs')),C=require(path.join(base,'contracts.cjs')),Sqlite=require('better-sqlite3');
      const images=Array.from({length:8},(_,n)=>({operations:Array.from({length:4096},()=>({id:randomUUID(),snapshotRevision:Number.MAX_SAFE_INTEGER-1800000})),digests:Array.from({length:4096},(_,i)=>sha('SYNTHETIC-MAX-'+n+'-'+i))}));
      const expected=V.expectedIndex(images);assert.equal(expected.operations.length,32768);assert.equal(expected.digests.length,32768);
      assert.throws(()=>V.expectedIndex([...images,images[0]]));assert.throws(()=>V.expectedIndex([images[0],images[0]]));
      const db=new Sqlite(':memory:');try{
        db.exec(V.INDEX_SQL.join(';')+';PRAGMA user_version=1');db.transaction(()=>{
          const op=db.prepare('INSERT INTO operations VALUES(@id,@segment,@snapshotRevision,@requestHash)'),digest=db.prepare('INSERT INTO digests VALUES(@digest,@segment)');
          for(const row of expected.operations)op.run(row);for(const row of expected.digests)digest.run(row);
        })();
        const bytes=db.serialize();assert.ok(bytes.length<C.LIMITS.indexBytes);V.verifyIndex(bytes,expected);console.log('MEASURE maximumIndexBytes='+bytes.length+' operations=32768 digests=32768');
        db.prepare('UPDATE operations SET requestHash=? WHERE id=?').run('a'.repeat(64),expected.operations[0].id);assert.throws(()=>V.verifyIndex(db.serialize(),expected));
        db.prepare('DELETE FROM operations WHERE id=?').run(expected.operations[0].id);assert.throws(()=>V.verifyIndex(db.serialize(),expected));
      }finally{db.close();}
    });
  }finally{anchor.close();assert.equal(path.dirname(root),parent);fs.rmSync(root,{recursive:true});}
}
console.log(`Audit continuity: ${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
