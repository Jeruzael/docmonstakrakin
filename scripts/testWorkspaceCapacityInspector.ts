import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { fixture, hash } = require('./fixtures/capacityInspectorSynthetic.cjs');
let passed = 0, failed = 0;
async function check(name: string, run: () => unknown) {
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); }
}
const imageFile = path.resolve('server/security/workspaceAccess/capacityImage.cjs');
await check('CI01 pure capacity image inspector exists', () => assert.ok(fs.existsSync(imageFile), 'capacityImage.cjs missing'));
if (fs.existsSync(imageFile)) {
  const { inspectCapacityImage } = require(imageFile);
  const expected = {workspaceIdentity:'1:2',privateIdentity:'1:3'};
  const inspect = (options = {}, mutate?: (db: any) => void) => {
    const db = fixture(options);
    try { mutate?.(db); const bytes = db.serialize(), before = hash(bytes); const result = inspectCapacityImage(bytes,expected); assert.equal(hash(bytes),before); return result; }
    finally { db.close(); }
  };
  for (const count of [4094,4095,4096]) await check('CI02 audit boundary ' + count, () => {
    const r = inspect({audit:count}); assert.equal(r.counts.audit,count); assert.equal(r.remaining.audit,4096-count); assert.equal(r.full,count===4096);
  });
  for (const key of ['digests','operations']) for (const count of [4094,4095,4096]) await check('CI03 independent ' + key + ' boundary ' + count, () => {
    const r = inspect({[key]:count}); const table = key==='digests'?'used_digests':'operations';
    assert.equal(r.counts[table],count); assert.equal(r.remaining[table],4096-count); assert.equal(r.counts.audit,2); assert.equal(r.full,count===4096);
  });
  for (const key of ['audit','digests','operations']) await check('CI04 over-limit ' + key, () => assert.throws(() => inspect({[key]:4097})));
  const invalid: [string,(db:any)=>void][] = [
    ['foreign provenance', db=>db.prepare("UPDATE metadata SET provenance=json_set(provenance,'$.workspaceIdentity','2:3')").run()],
    ['foreign literal', db=>db.prepare("UPDATE metadata SET provenance=json_set(provenance,'$.schema','FORGED/1')").run()],
    ['unsupported native', db=>db.prepare("UPDATE metadata SET provenance=json_set(provenance,'$.sqlite','0.0')").run()],
    ['unsupported schema', db=>db.pragma('user_version=2')],
    ['extra table', db=>db.exec('CREATE TABLE extra(value TEXT)')],
    ['trigger', db=>db.exec("CREATE TRIGGER corrupt AFTER INSERT ON audit BEGIN SELECT 1; END")],
    ['audit hash tamper', db=>db.prepare("UPDATE audit SET hash=? WHERE sequence=2").run('f'.repeat(64))],
    ['missing tail', db=>db.prepare('DELETE FROM audit WHERE sequence=2').run()],
    ['audit future generation', db=>{const raw=JSON.stringify({type:'SYNTHETIC_EVENT',targetHash:null,at:0,generation:2,policyRevision:1,snapshotRevision:1}); const previous=db.prepare('SELECT hash FROM audit WHERE sequence=1').get().hash; db.prepare('UPDATE audit SET raw=?,hash=? WHERE sequence=2').run(raw,hash(previous+'\n'+raw));}],
    ['invalid integer', db=>db.prepare('UPDATE metadata SET clockHighWater=-1').run()],
    ['dangling session', db=>db.prepare('INSERT INTO sessions VALUES(?,?,1,1,0,0,0)').run('a'.repeat(64),'missing')],
    ['invalid retained digest', db=>db.prepare('INSERT INTO used_digests VALUES(?)').run('PRIVATE-SENTINEL')],
    ['invalid operation', db=>db.prepare("INSERT INTO operations VALUES('PRIVATE-SENTINEL',1)").run()],
    ['invalid project JSON', db=>db.prepare('UPDATE metadata SET stateJson=?').run('{"schemaVersion":1,"schemaVersion":1,"state":{"projects":[]}}')],
    ['oversize audit row', db=>db.prepare('UPDATE audit SET raw=? WHERE sequence=2').run('PRIVATE-SENTINEL'.repeat(400))]
  ];
  for (const [name,mutate] of invalid) await check('CI05 ' + name, () => assert.throws(() => inspect({},mutate), (error:any)=> !String(error).includes('PRIVATE-SENTINEL')));
  await check('CI06 malformed and WAL bytes rejected unchanged', () => {
    for (const bytes of [Buffer.from('SYNTHETIC CORRUPT'), (()=>{const db=fixture();try{const b=db.serialize();b[18]=2;b[19]=2;return b;}finally{db.close();}})()]) {
      const before=hash(bytes); assert.throws(()=>inspectCapacityImage(bytes,expected)); assert.equal(hash(bytes),before);
    }
  });
  await check('CI07 output excludes identities, verifiers and stored values', () => {
    const raw=JSON.stringify(inspect({digests:1,operations:1})); assert.ok(raw.length<4096);
    for(const secret of ['SYNTHETIC','synthetic-owner','argon2','1:2','1:3','stateJson','personId']) assert.ok(!raw.includes(secret),secret);
  });
  await check('CI07b pinned native Buffer constructor is readonly memory and denies writes', () => {
    const db=fixture(),bytes=db.serialize();db.close();
    const Sqlite=require('better-sqlite3'),readonly=new Sqlite(bytes,{readonly:true});
    try {
      assert.equal(readonly.memory,true);assert.equal(readonly.readonly,true);assert.equal(readonly.name,':memory:');
      assert.throws(()=>readonly.prepare('UPDATE metadata SET generation=2').run(),(error:any)=>error.code==='SQLITE_READONLY');
      assert.equal(readonly.prepare('SELECT generation FROM metadata').get().generation,1);
    } finally {readonly.close();}
  });
}
const publicFile=path.resolve('server/security/workspaceAccess/capacityInspector.ts');
await check('CI08 public inspector exists',()=>assert.ok(fs.existsSync(publicFile),'capacityInspector.ts missing'));
if (fs.existsSync(publicFile)) {
  const {inspectWorkspaceCapacity}=await import('../server/security/workspaceAccess/capacityInspector.ts');
  const parent=fs.realpathSync.native(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'dmk-capacity-refusal-'));
  try {
    fs.mkdirSync(path.join(root,'.security'),{mode:0o700}); fs.writeFileSync(path.join(root,'.security','authority.sqlite'),'SYNTHETIC PRIVATE SENTINEL',{mode:0o600});
    const observation=()=>[fs.lstatSync(root,{bigint:true}),fs.lstatSync(path.join(root,'.security'),{bigint:true}),fs.lstatSync(path.join(root,'.security','authority.sqlite'),{bigint:true})].map(s=>({dev:s.dev,ino:s.ino,mode:s.mode,size:s.size,atime:s.atimeNs,mtime:s.mtimeNs,ctime:s.ctimeNs,birth:s.birthtimeNs,nlink:s.nlink}));
    await check('CI09 writable unsupported input never read or mutated',async()=>{
      const before=observation(),result=await inspectWorkspaceCapacity(root);
      assert.equal(result.status,'BLOCKED'); assert.equal('counts' in result,false); assert.deepEqual(observation(),before);
      assert.ok(!JSON.stringify(result).includes(root)); assert.deepEqual(fs.readdirSync(path.join(root,'.security')),['authority.sqlite']);
    });
    await check('CI10 relative and object inputs produce bounded failures',async()=>{
      for(const input of ['.',null,{},'file:/secret'] as any[]) {const r=await inspectWorkspaceCapacity(input);assert.equal(r.status,'BLOCKED');assert.ok(JSON.stringify(r).length<512);}
    });
    await check('CI11 concurrent refusals preserve source',async()=>{
      const before=observation(),results=await Promise.all([inspectWorkspaceCapacity(root),inspectWorkspaceCapacity(root),inspectWorkspaceCapacity(root)]);
      assert.ok(results.every(r=>r.status==='BLOCKED'));assert.deepEqual(observation(),before);
    });
    await check('CI12 CLI rejects ambiguous arguments without echo or source access',()=>{
      const before=observation();
      for(const args of [[],['--workspace',root,'--recover'],['--workspace','PRIVATE-SENTINEL']]){
        const r=spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/inspectWorkspaceCapacity.ts',...args],{encoding:'utf8',timeout:15000});
        assert.equal(r.status,2);const result=JSON.parse(r.stdout);assert.equal(result.status,'BLOCKED');assert.ok(!r.stdout.includes(root));assert.ok(!r.stdout.includes('PRIVATE-SENTINEL'));
      }
      assert.deepEqual(observation(),before);
    });
  } finally {assert.equal(path.dirname(root),parent);fs.rmSync(root,{recursive:true});}
}
console.log(`Capacity inspector: ${passed} passed, ${failed} failed`); process.exitCode=failed?1:0;
