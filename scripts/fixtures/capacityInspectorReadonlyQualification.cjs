'use strict';
// Invoked only on a dedicated externally mounted disposable ext4 fixture.
// "prepare" is an explicit fixture writer; "verify" independently observes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {fixture,hash}=require('./capacityInspectorSynthetic.cjs');
const [mode,base]=process.argv.slice(2);
assert.ok(['prepare','verify'].includes(mode));assert.ok(base&&path.isAbsolute(base)&&path.basename(base)==='fixture');
const cases=['audit4094','audit4095','audit4096','digests4096','operations4096','live-lock','stale-lock','empty-wal','shm','journal','unknown','permissive','hardlink','foreign','corrupt','wal-header','schema2','linked-db','linked-directory'];
function source(root){const w=fs.statSync(root,{bigint:true}),s=fs.statSync(path.join(root,'.security'),{bigint:true});return {workspaceIdentity:w.dev+':'+w.ino,privateIdentity:s.dev+':'+s.ino};}
if(mode==='prepare'){
  fs.mkdirSync(base,{mode:0o700});
  for(const name of cases){
    const root=path.join(base,name);fs.mkdirSync(root,{mode:0o700});fs.mkdirSync(path.join(root,'.security'),{mode:0o700});
    const db=fixture({...source(root),audit:name.startsWith('audit')?+name.slice(5):2,digests:name==='digests4096'?4096:0,operations:name==='operations4096'?4096:0});
    if(name==='foreign')db.prepare("UPDATE metadata SET provenance=json_set(provenance,'$.privateIdentity','1:1')").run();
    if(name==='schema2')db.pragma('user_version=2');
    if(name==='corrupt')db.prepare('UPDATE audit SET hash=? WHERE sequence=2').run('f'.repeat(64));
    const bytes=db.serialize();db.close();if(name==='wal-header'){bytes[18]=2;bytes[19]=2;}
    const file=path.join(root,'.security','authority.sqlite');fs.writeFileSync(file,bytes,{mode:0o600,flag:'wx'});
    if(name==='permissive')fs.chmodSync(file,0o644);
    if(name==='hardlink')fs.linkSync(file,path.join(root,'outside-hardlink'));
    if(name==='linked-db'){fs.renameSync(file,path.join(root,'linked-target'));fs.symlinkSync('../linked-target',file);}
    if(name==='linked-directory'){fs.renameSync(path.join(root,'.security'),path.join(root,'private-target'));fs.symlinkSync('private-target',path.join(root,'.security'));}
    const extra={'live-lock':'owner.lock','stale-lock':'owner.lock','empty-wal':'authority.sqlite-wal','shm':'authority.sqlite-shm','journal':'authority.sqlite-journal','unknown':'unknown.sidecar'}[name];
    if(extra)fs.writeFileSync(path.join(root,'.security',extra),name==='live-lock'?JSON.stringify({pid:process.pid}):name==='stale-lock'?'stale':'',{mode:0o600,flag:'wx'});
  }
  console.log('Prepared '+cases.length+' synthetic workspaces');process.exit(0);
}
function observe(root){
  const out={};
  const walk=file=>{
    const s=fs.lstatSync(file,{bigint:true}),relative=path.relative(root,file);
    out[relative]={dev:String(s.dev),ino:String(s.ino),uid:String(s.uid),gid:String(s.gid),mode:String(s.mode),nlink:String(s.nlink),size:String(s.size),atime:String(s.atimeNs),mtime:String(s.mtimeNs),ctime:String(s.ctimeNs),birth:String(s.birthtimeNs)};
    if(s.isDirectory())for(const entry of fs.readdirSync(file).sort())walk(path.join(file,entry));
    else if(s.isFile())out[relative].sha256=hash(fs.readFileSync(file));
    else if(s.isSymbolicLink())out[relative].link=fs.readlinkSync(file);
    else throw Error('Unexpected observer fixture type');
  };walk(root);return out;
}
const worker=path.resolve(__dirname,'../../server/security/workspaceAccess/capacityInspectorWorker.cjs'),guard=path.join(__dirname,'capacityInspectorNoWriteGuard.cjs');
let passed=0;
for(const name of cases){
  const root=path.join(base,name),before=observe(root);
  const trace=process.env.CAPACITY_TRACE_DIRECTORY&&path.join(process.env.CAPACITY_TRACE_DIRECTORY,name+'.trace');
  const r=spawnSync(trace?process.env.CAPACITY_STRACE:process.execPath,trace?['-f','-qq','-yy','-e','trace=%file,write,pwrite64,writev,pwritev,fsync,fdatasync,ftruncate,flock,fcntl','-o',trace,process.execPath,'--require',guard,worker,root]:['--require',guard,worker,root],{encoding:'utf8',timeout:15000,maxBuffer:16384,env:{...process.env,NODE_OPTIONS:''}});
  assert.equal(r.signal,null,name+': '+r.stderr);assert.ok(!r.stderr.includes('INSPECTOR_FORBIDDEN_ATTEMPT'),r.stderr);const result=JSON.parse(r.stdout);
  assert.deepEqual(observe(root),before,name+' metadata or bytes changed');
  if(name.startsWith('audit')||['digests4096','operations4096'].includes(name)){
    assert.equal(r.status,0,name+': '+r.stdout);
    assert.equal(result.status,name==='audit4094'||name==='audit4095'?'VALID_BOUNDED':'FULL');
    assert.equal(result.generation,1);assert.equal(result.policyRevision,1);assert.equal(result.snapshotRevision,1);
    assert.equal(result.counts.audit,name.startsWith('audit')?+name.slice(5):2);
    const repeated=spawnSync(process.execPath,['--require',guard,worker,root],{encoding:'utf8',timeout:15000,maxBuffer:16384});
    assert.deepEqual(JSON.parse(repeated.stdout),result);assert.deepEqual(observe(root),before);
  }else{
    assert.equal(r.status,2,name+': '+r.stdout);assert.ok(['BLOCKED','INVALID'].includes(result.status));assert.equal('counts' in result,false);
    const reason={'live-lock':'CAPACITY_OWNER_PRESENT','stale-lock':'CAPACITY_OWNER_PRESENT','empty-wal':'CAPACITY_SIDECAR_OR_UNKNOWN_INPUT',shm:'CAPACITY_SIDECAR_OR_UNKNOWN_INPUT',journal:'CAPACITY_SIDECAR_OR_UNKNOWN_INPUT',unknown:'CAPACITY_SIDECAR_OR_UNKNOWN_INPUT',permissive:'CAPACITY_PATH_OR_PERMISSIONS_INVALID',hardlink:'CAPACITY_PATH_OR_PERMISSIONS_INVALID',foreign:'CAPACITY_PROVENANCE_INVALID',corrupt:'CAPACITY_AUDIT_INVALID','wal-header':'CAPACITY_IMAGE_UNSUPPORTED',schema2:'CAPACITY_SCHEMA_UNSUPPORTED','linked-db':'CAPACITY_PATH_INVALID','linked-directory':'CAPACITY_PATH_INVALID'}[name];
    assert.equal(result.reason,reason);
  }
  for(const text of [root,'SYNTHETIC','synthetic-owner','argon2'])assert.ok(!r.stdout.includes(text));
  if(trace){
    const lines=fs.readFileSync(trace,'utf8').split('\n').filter(line=>line.includes(root));
    assert.ok(lines.length>0,'No kernel source observations');
    assert.ok(!lines.some(line=>/\b(?:write|pwrite64|writev|pwritev|truncate|ftruncate|unlink|unlinkat|rename|renameat|renameat2|mkdir|mkdirat|rmdir|link|linkat|symlink|symlinkat|chmod|fchmod|fchmodat|chown|fchown|fchownat|utime|utimes|utimensat|fsync|fdatasync|flock)\(/.test(line)||/O_(?:WRONLY|RDWR|CREAT|TRUNC|APPEND)|F_(?:SETLK|SETLKW)/.test(line)),'Source mutation or locking syscall attempted');
    console.log('TRACE '+name+' sha256='+hash(fs.readFileSync(trace))+' sourceSyscalls='+lines.length);
  }
  console.log('PASS RO '+name+' independent bytes/metadata + no-write API guard');passed++;
}
// An ordinary same-owner process cannot start a writer or create a lock marker
// while this admitted superblock remains read-only.
const full=path.join(base,'audit4096'),beforeRace=observe(full);
for(const target of [path.join(full,'.security','owner.lock'),path.join(full,'.security','authority.sqlite')])
  assert.throws(()=>fs.writeFileSync(target,'SYNTHETIC RIVAL'),error=>error.code==='EROFS');
assert.deepEqual(observe(full),beforeRace);
console.log('PASS RO competing writer and lock creation denied by filesystem');passed++;
const cancellation=spawnSync(process.execPath,[path.join(__dirname,'capacityInspectorCancelProbe.cjs'),worker,full],{encoding:'utf8',timeout:15000});
assert.equal(cancellation.status,0,cancellation.stderr);assert.match(cancellation.stdout,/CANCELLED_AFTER_SOURCE_READ_WITHOUT_VERDICT/);
assert.deepEqual(observe(full),beforeRace);
console.log('PASS RO cancellation after source read publishes no verdict and preserves source');passed++;
console.log('Readonly ext4 qualification: '+passed+' passed, 0 failed');
