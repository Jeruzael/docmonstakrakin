import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertPrivateDirectory,assertPrivateFile} from './privateDirectory.ts';
import {parseAgentJson} from './agentJson.ts';

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

/** Admission only. Never changes an existing ACL, owner or credential. */
export function loadPrivateMcpConfig(configPath:string):{origin:string;ca:Buffer;token:string;httpPort?:number;connectorToken?:string}{
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
 try{
  const parsed=parseAgentJson(read(configPath,16384));
  const allowed=['origin','caPath','token','tokenPath','connectorToken','connectorTokenPath','httpPort'];
  if(Object.keys(parsed).some(k=>!allowed.includes(k))||typeof parsed.origin!=='string'||typeof parsed.caPath!=='string')fail();
  if(Object.hasOwn(parsed,'token')===Object.hasOwn(parsed,'tokenPath')||(Object.hasOwn(parsed,'connectorToken')&&Object.hasOwn(parsed,'connectorTokenPath')))fail();
  const ca=read(parsed.caPath as string,65536);
  const text=(inline:unknown,file:unknown)=>{
   if(file!==undefined&&typeof file!=='string')fail();
   const bytes=typeof file==='string'?read(file,1024):typeof inline==='string'?Buffer.from(inline):fail();
   const value=bytes.toString('utf8');if(!Buffer.from(value).equals(bytes))fail();return value.trim();
  };
  const token=text(parsed.token,parsed.tokenPath);
  if(!/^dmk_agent_v1_[a-f0-9]{64}$/.test(token))fail();
  let connectorToken:string|undefined;
  if(parsed.connectorToken!==undefined||parsed.connectorTokenPath!==undefined){connectorToken=text(parsed.connectorToken,parsed.connectorTokenPath);if(!/^mcp_conn_v1_[a-f0-9]{64}$/.test(connectorToken))fail();}
  const httpPort=parsed.httpPort;
  if(httpPort!==undefined&&(typeof httpPort!=='number'||!Number.isSafeInteger(httpPort)||httpPort<0||httpPort>65535))fail();
  // Recheck the entire material set, including earlier members, before use.
  for(const item of captured){canonical(item.file);assertPrivateFile(item.file);if(metadata(fs.lstatSync(item.file,{bigint:true}))!==item.snapshot||assertPrivateDirectory(item.parent)!==item.parentIdentity)fail();}
  currentPermissions(captured.flatMap(item=>[{file:item.file,directory:false},{file:item.parent,directory:true}]));
  return{origin:parsed.origin as string,ca,token,httpPort:httpPort as number|undefined,connectorToken};
 }catch{throw Error('MCP_BRIDGE_CONFIG_INVALID');}
}
