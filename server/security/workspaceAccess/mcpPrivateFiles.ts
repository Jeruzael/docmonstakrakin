import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertPrivateDirectory,assertPrivateFile} from './privateDirectory.ts';

const metadata=(s:fs.BigIntStats)=>[s.dev,s.ino,s.nlink,s.size,s.uid,s.mode,s.mtimeNs,s.ctimeNs].join(':');
const identity=(s:fs.BigIntStats)=>`${s.dev}:${s.ino}`;
const fail=():never=>{throw Error('MCP_BRIDGE_CONFIG_INVALID');};

// The shared helper's DACL pin does not contain the Windows owner SID.
// Reacquire current owner/ACL on every read and on the final set, without
// changing shared authority contracts or repairing any existing object.
function currentPermissions(files:{file:string;directory:boolean}[]){
 if(process.platform!=='win32')return;
 const raw=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{windowsHide:true,encoding:'utf8',timeout:2000,maxBuffer:16384});
 const sid=/S-1-\d+(?:-\d+)+/.exec(raw)?.[0];if(!sid)fail();
 const code="$ErrorActionPreference='Stop';"+files.map(({file,directory})=>{
  const literal=file.replaceAll("'","''");
  return `$a=[System.IO.${directory?'Directory':'File'}]::GetAccessControl('${literal}');if($a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne '${sid}'){exit 3};`+
   (directory?'if(-not $a.AreAccessRulesProtected){exit 3};':'')+
   `$r=$a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]);if($r.Count -lt 1){exit 3};foreach($v in $r){if($v.IdentityReference.Value -ne '${sid}' -or $v.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow){exit 3}};`;
 }).join('');
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{windowsHide:true,timeout:4000,stdio:'pipe',env:{...process.env,PSModulePath:path.join(process.env.WINDIR||'C:\\Windows','System32/WindowsPowerShell/v1.0/Modules')}});
}

/** Bounded admission only; callers sanitize errors. Never repairs existing state. */
export function withPrivateMcpFiles<T>(load:(read:(file:string,max:number)=>Buffer)=>T):T{
 const captured:{file:string;snapshot:string;parent:string;parentIdentity:string}[]=[];
 function canonical(file:string){
  if(typeof file!=='string'||!path.isAbsolute(file)||path.resolve(file)!==file||file.includes('\0')||(process.platform==='win32'&&!/^[A-Z]:\\/.test(file)))fail();
  let current=path.parse(file).root;
  for(const part of file.slice(current.length).split(path.sep)){
   if(!part)fail();current=path.join(current,part);
   const stat=fs.lstatSync(current,{bigint:true});
   if(stat.isSymbolicLink()||stat.ino===0n||fs.realpathSync.native(current)!==current)fail();
  }
 }
 function read(file:string,max:number){
  canonical(file);
  const parent=path.dirname(file),parentIdentity=assertPrivateDirectory(parent);
  const expected=assertPrivateFile(file),before=fs.lstatSync(file,{bigint:true});
  currentPermissions([{file,directory:false},{file:parent,directory:true}]);
  if(identity(before)!==expected||before.size<1n||before.size>BigInt(max))fail();
  let fd:number|undefined;
  try{
   fd=fs.openSync(file,fs.constants.O_RDONLY|(process.platform==='win32'?0:fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK));
   const opened=fs.fstatSync(fd,{bigint:true});
   if(!opened.isFile()||opened.nlink!==1n||metadata(opened)!==metadata(before))fail();
   const bytes=Buffer.alloc(max+1);let length=0;
   while(length<bytes.length){const n=fs.readSync(fd,bytes,length,bytes.length-length,length);if(!n)break;length+=n;}
   if(length>max||BigInt(length)!==before.size||metadata(fs.fstatSync(fd,{bigint:true}))!==metadata(before)||assertPrivateFile(file)!==expected||metadata(fs.lstatSync(file,{bigint:true}))!==metadata(before))fail();
   captured.push({file,snapshot:metadata(before),parent,parentIdentity});
   return Buffer.from(bytes.subarray(0,length));
  }finally{if(fd!==undefined)fs.closeSync(fd);}
 }
 const result=load(read);
  // Recheck the entire material set, including earlier members, before use.
  for(const item of captured){canonical(item.file);assertPrivateFile(item.file);if(metadata(fs.lstatSync(item.file,{bigint:true}))!==item.snapshot||assertPrivateDirectory(item.parent)!==item.parentIdentity)fail();}
  currentPermissions(captured.flatMap(item=>[{file:item.file,directory:false},{file:item.parent,directory:true}]));
 return result;
}
