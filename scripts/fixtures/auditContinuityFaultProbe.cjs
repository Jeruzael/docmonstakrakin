'use strict';
// Test-only process faults. There are no production fault hooks.
const fs=require('node:fs'),path=require('node:path');
const {SyntheticAnchor}=require('./auditContinuitySynthetic.cjs');
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const anchor=SyntheticAnchor.reopen(input.anchor,input.trust,input.privateKeyPem),fault=input.fault;
const nativeWrite=fs.writeSync,nativeSync=fs.fsyncSync;
const Sqlite=require('better-sqlite3'),nativePrepare=Sqlite.prototype.prepare;
Sqlite.prototype.prepare=function(sql){
  const statement=nativePrepare.call(this,sql);
  if(sql==='INSERT INTO records VALUES(?,?,?,?,?)'){
    const run=statement.run.bind(statement);statement.run=(...args)=>{const value=run(...args);if(fault==='after-insert-'+args[1])kill();return value;};
  }
  return statement;
};
function fdPath(fd){try{return fs.readlinkSync('/proc/self/fd/'+fd);}catch{return '';}}
function kill(){process.kill(process.pid,'SIGKILL');}
let fired=false;
fs.writeSync=function(fd,buffer,offset,length,...rest){
  const name=path.basename(fdPath(fd));
  if(!fired&&name==='segment-00.sqlite'&&fault==='partial-segment'){fired=true;nativeWrite.call(fs,fd,buffer,offset,Math.max(1,Math.floor(length/2)),...rest);kill();}
  if(name==='replay.sqlite'&&fault==='zero-write')return 0;
  if(name==='replay.sqlite'&&fault==='short-write')return nativeWrite.call(fs,fd,buffer,offset,Math.max(1,Math.floor(length/2)),...rest);
  return nativeWrite.call(fs,fd,buffer,offset,length,...rest);
};
fs.fsyncSync=function(fd){
  const target=fdPath(fd),name=path.basename(target);
  if(name==='manifest.json'&&fault==='fsync-eio'){const error=Error('Synthetic EIO');error.code='EIO';throw error;}
  const value=nativeSync.call(fs,fd);
  if(name==='manifest.json'&&fault==='manifest-flushed')kill();
  if(/^continuity-/.test(name)){
    const control=path.join(target,'control.sqlite');
    if(fs.existsSync(control)&&fs.statSync(control).size){
      const V=require('../../server/security/workspaceAccess/continuity/verify.cjs');
      let phase;try{phase=V.readControl(target,input.trust).phase;}catch{return value;}
      if(fault==='phase-'+phase)kill();
      if(phase==='PREPARING'&&fs.existsSync(path.join(target,'manifest.json'))&&fault==='payloads-flushed')kill();
      if(phase==='PREPARING'&&fault==='disk-full'&&!fired){
        fired=true;const fd=fs.openSync(input.filler,'wx',0o600),bytes=Buffer.alloc(1024*1024,42);
        try{for(;;)nativeWrite.call(fs,fd,bytes);}catch(error){if(error.code!=='ENOSPC')throw error;}finally{fs.closeSync(fd);}
      }
    }
  }
  return value;
};
const compare=anchor.compareAndSwap.bind(anchor);
anchor.compareAndSwap=async request=>{if(fault==='remote-before')kill();const value=await compare(request);if(fault==='remote-after')kill();return value;};
const S=require('../../server/security/workspaceAccess/continuity/stage.cjs');
(async()=>{
  try{
    const result=input.mode==='prepare'?await S.prepareTransition(input.options,anchor,input.trust):await S.commitTransition(input.stage,anchor,input.trust);
    if(fault==='final-ack')kill();
    console.log(JSON.stringify(result));
  }catch(error){console.error(error.code||'FAULT_PROBE_FAILED');process.exitCode=2;}finally{anchor.close();}
})();
