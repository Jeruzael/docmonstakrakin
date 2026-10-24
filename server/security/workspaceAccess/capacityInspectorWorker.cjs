'use strict';
// Dedicated offline process. Never imports WorkspaceStore, backup or lock helpers.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectCapacityImage,MAX_BYTES}=require('./capacityImage.cjs');
const PROFILE='LINUX_EXT4_READONLY_SUPERBLOCK/1';
function fail(code){const e=Error(code);e.code=code;throw e;}
function refuse(reason,status='BLOCKED'){return {schema:'WORKSPACE_CAPACITY_OBSERVATION/1',status,reason,activated:false,freshnessEstablished:false,pilotAuthorized:false};}
function mountProfile(root){
  const raw=fs.readFileSync('/proc/self/mountinfo','utf8');if(Buffer.byteLength(raw)>1024*1024)fail('CAPACITY_PROFILE_UNSUPPORTED');
  const decode=s=>s.replace(/\\(040|011|012|134)/g,(_,n)=>String.fromCharCode(parseInt(n,8)));
  const mounts=raw.trim().split('\n').map(line=>{
    const [a,b,...rest]=line.split(' - ');if(!b||rest.length)fail('CAPACITY_PROFILE_UNSUPPORTED');
    const left=a.split(' '),right=b.split(' ');if(left.length<6||right.length!==3)fail('CAPACITY_PROFILE_UNSUPPORTED');
    return {mount:decode(left[4]),root:decode(left[3]),device:left[2],options:left[5].split(','),type:right[0],source:decode(right[1]),superOptions:right[2].split(',')};
  });
  const matches=mounts.filter(m=>root===m.mount||root.startsWith(m.mount==='/'?'/':m.mount+'/')).sort((a,b)=>b.mount.length-a.mount.length);
  const selected=matches[0];
  if(!selected||selected.type!=='ext4'||selected.root!=='/'||!selected.source.startsWith('/dev/')||!selected.options.includes('ro')||!selected.superOptions.includes('ro')||
    mounts.some(m=>m.mount!==selected.mount&&(m.mount===root||m.mount.startsWith(root+'/'))))fail('CAPACITY_IMMUTABLE_SOURCE_REQUIRED');
  // Pin all namespace descriptors; an observed remount/submount is a refusal.
  return {mount:selected.mount,device:selected.device,pin:crypto.createHash('sha256').update(raw).digest('hex')};
}
function stat(file,directory,device){
  if(fs.realpathSync.native(file)!==file)fail('CAPACITY_PATH_INVALID');
  const s=fs.lstatSync(file,{bigint:true});
  if((directory?!s.isDirectory():!s.isFile()||s.nlink!==1n)||s.isSymbolicLink()||s.ino===0n||s.uid!==BigInt(process.getuid())||
    (s.mode&0o777n)!==(directory?0o700n:0o600n)||device!==undefined&&s.dev!==device)fail('CAPACITY_PATH_OR_PERMISSIONS_INVALID');
  return s;
}
function fingerprint(s){return [s.dev,s.ino,s.nlink,s.uid,s.gid,s.mode,s.size,s.atimeNs,s.mtimeNs,s.ctimeNs,s.birthtimeNs].map(String).join(':');}
function inventory(root){
  const workspace=stat(root,true),security=path.join(root,'.security'),directory=stat(security,true,workspace.dev),entries=fs.readdirSync(security).sort();
  if(entries.includes('owner.lock'))fail('CAPACITY_OWNER_PRESENT');
  if(entries.length<1||entries.length>2||!entries.includes('authority.sqlite')||entries.some(n=>!['authority.sqlite','tls'].includes(n)))fail('CAPACITY_SIDECAR_OR_UNKNOWN_INPUT');
  const file=path.join(security,'authority.sqlite'),database=stat(file,false,workspace.dev);
  if(database.size<4096n||database.size>BigInt(MAX_BYTES))fail('CAPACITY_IMAGE_UNSUPPORTED');
  const pins={workspace:fingerprint(workspace),security:fingerprint(directory),database:fingerprint(database)};
  if(entries.includes('tls')){
    const tls=path.join(security,'tls');pins.tls=fingerprint(stat(tls,true,workspace.dev));
    const children=fs.readdirSync(tls).sort();if(children.length!==2||children[0]!=='loopback.crt'||children[1]!=='loopback.key')fail('CAPACITY_SIDECAR_OR_UNKNOWN_INPUT');
    for(const child of children)pins[child]=fingerprint(stat(path.join(tls,child),false,workspace.dev));
  }
  return {file,database,pin:JSON.stringify(pins),source:{workspaceIdentity:workspace.dev+':'+workspace.ino,privateIdentity:directory.dev+':'+directory.ino}};
}
function inspectWorkspaceCapacityOffline(root){
  let fd;
  try{
    const version=process.versions.node.split('.').map(Number);
    if(process.platform!=='linux'||process.arch!=='x64'||version[0]!==22||version[1]<23||version[1]===23&&version[2]<3)fail('CAPACITY_PROFILE_UNSUPPORTED');
    if(typeof root!=='string'||root.length>4096||!path.isAbsolute(root)||path.resolve(root)!==root||root.includes('\0'))fail('CAPACITY_PATH_INVALID');
    // Admission precedes all source-directory enumeration and source-byte reads.
    const profile=mountProfile(root),before=inventory(root);
    if(typeof fs.constants.O_NOATIME!=='number'||typeof fs.constants.O_NOFOLLOW!=='number')fail('CAPACITY_PROFILE_UNSUPPORTED');
    fd=fs.openSync(before.file,fs.constants.O_RDONLY|fs.constants.O_NOATIME|fs.constants.O_NOFOLLOW);
    const original=fs.fstatSync(fd,{bigint:true});
    if(fingerprint(original)!==fingerprint(before.database))fail('CAPACITY_SOURCE_CHANGED');
    const bytes=Buffer.alloc(Number(original.size));let offset=0;
    while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,Math.min(65536,bytes.length-offset),offset);if(!n)fail('CAPACITY_SOURCE_CHANGED');offset+=n;}
    if(fingerprint(fs.fstatSync(fd,{bigint:true}))!==fingerprint(original)||mountProfile(root).pin!==profile.pin||inventory(root).pin!==before.pin)fail('CAPACITY_SOURCE_CHANGED');
    const image=inspectCapacityImage(bytes,before.source);
    if(fingerprint(fs.fstatSync(fd,{bigint:true}))!==fingerprint(original)||mountProfile(root).pin!==profile.pin||inventory(root).pin!==before.pin)fail('CAPACITY_SOURCE_CHANGED');
    fs.closeSync(fd);fd=undefined;
    return {schema:'WORKSPACE_CAPACITY_OBSERVATION/1',status:image.full?'FULL':'VALID_BOUNDED',profile:PROFILE,
      sourceEvidenceSha256:crypto.createHash('sha256').update(profile.pin+'\n'+before.pin).digest('hex'),...image,
      activated:false,freshnessEstablished:false,pilotAuthorized:false};
  }catch(error){
    const reason=typeof error?.code==='string'&&/^CAPACITY_[A-Z_]{1,64}$/.test(error.code)?error.code:'CAPACITY_INPUT_UNAVAILABLE';
    return refuse(reason,/^CAPACITY_(IMAGE_INVALID|AUDIT_INVALID|PROVENANCE_INVALID|BOUND_EXCEEDED)$/.test(reason)?'INVALID':'BLOCKED');
  }finally{if(fd!==undefined)try{fs.closeSync(fd);}catch{}}
}
if(require.main===module){
  const result=process.argv.length===3?inspectWorkspaceCapacityOffline(process.argv[2]):refuse('CAPACITY_ARGUMENTS_INVALID');
  const output=JSON.stringify(result);
  if(Buffer.byteLength(output)>8192){process.stdout.write(JSON.stringify(refuse('CAPACITY_OUTPUT_INVALID'))+'\n');process.exitCode=2;}
  else{process.stdout.write(output+'\n');process.exitCode=['VALID_BOUNDED','FULL'].includes(result.status)?0:2;}
}
module.exports={inspectWorkspaceCapacityOffline};
