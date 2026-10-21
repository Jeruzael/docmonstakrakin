import assert from 'node:assert/strict';
import {OSKeychainSecretStore} from '../server/secrets/osKeychainStore.ts';
import {installNativeCredentialTripwire,createSyntheticServerPreload} from './fixtures/syntheticServerPreload.ts';
import {startPackageFixture} from './fixtures/projectsWorkspaceUiServer.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {SecretStore} from '../src/types.ts';

const ordinaryCredentialRoots=['.docmonstakrakin','.secrets','.machine_token'].map(name=>path.resolve(name));
const credentialMetadata=()=>ordinaryCredentialRoots.flatMap(root=>[root,...(root.endsWith('.docmonstakrakin')?[path.join(root,'.machine_token')]:[])]).map(filename=>{
  const stat=fs.lstatSync(filename,{bigint:true,throwIfNoEntry:false});
  return {filename,metadata:stat?{dev:String(stat.dev),ino:String(stat.ino),size:String(stat.size),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)}:null};
});
const beforeCredentialMetadata=credentialMetadata();
const guardedMethods=['existsSync','mkdirSync','readFileSync','writeFileSync','openSync','statSync','lstatSync','realpathSync','renameSync','unlinkSync'] as const;
const originalMethods=new Map<string,Function>();let credentialFsProbes=0;
for(const method of guardedMethods){
  const original=(fs as any)[method];originalMethods.set(method,original);
  (fs as any)[method]=(...args:any[])=>{
    const candidate=typeof args[0]==='string'?path.resolve(args[0]):undefined;
    if(candidate && ordinaryCredentialRoots.some(root=>candidate===root || candidate.startsWith(root+path.sep))){credentialFsProbes++;throw new Error('ORDINARY_CREDENTIAL_FS_FORBIDDEN');}
    return original(...args);
  };
}
const original=OSKeychainSecretStore.prototype.isNativeAvailable;
let probes=0;OSKeychainSecretStore.prototype.isNativeAvailable=function(){probes++;throw new Error('NATIVE_PROBE_EXECUTED');};
const restore=installNativeCredentialTripwire();
const denyFallback=()=>{throw new Error('FALLBACK_CREDENTIAL_ACCESS_FORBIDDEN');};
const inertFallback:SecretStore={getSecret:async()=>denyFallback(),setSecret:async()=>denyFallback(),deleteSecret:async()=>denyFallback(),hasSecret:async()=>denyFallback(),listSecretMetadata:async()=>denyFallback(),getProviderType:()=>denyFallback()};
try{await assert.rejects(()=>new OSKeychainSecretStore({fallbackStore:inertFallback}).getSecret('SYNTHETIC_ONLY'),/NATIVE_CREDENTIAL_ACCESS_FORBIDDEN/);assert.equal(probes,0);console.log('PASS synthetic server tripwire rejects default native credential acquisition before probing the OS');}
finally{restore();OSKeychainSecretStore.prototype.isNativeAvailable=original;for(const [method,implementation] of originalMethods)(fs as any)[method]=implementation;}
assert.equal(credentialFsProbes,0);assert.deepEqual(credentialMetadata(),beforeCredentialMetadata);
console.log('PASS native-denial test performs zero ordinary-cwd credential filesystem probes and preserves token metadata');
assert.throws(()=>createSyntheticServerPreload(process.cwd()),/SYNTHETIC_FIXTURE_ROOT_REQUIRED/);
console.log('PASS synthetic bootstrap rejects a normal checkout before writing or selecting credentials');
const owned=fs.mkdtempSync(path.join(os.tmpdir(),'dmk194-ui-isolation-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'dmk194-ui-outside-')),retained=owned+'.retained';
try{
  fs.renameSync(owned,retained);fs.symlinkSync(outside,owned,'junction');
  assert.throws(()=>createSyntheticServerPreload(owned),/SYNTHETIC_FIXTURE_ROOT_REQUIRED/);
  assert.deepEqual(fs.readdirSync(outside),[],'Substituted root must not receive bootstrap writes');
}finally{fs.unlinkSync(owned);fs.renameSync(retained,owned);fs.rmSync(owned,{recursive:true});fs.rmSync(outside,{recursive:true});}
console.log('PASS actual substituted fixture junction is rejected before any outside bootstrap write');
const admitted=fs.mkdtempSync(path.join(os.tmpdir(),'dmk194-ui-preload-'));
try{
  const preload=createSyntheticServerPreload(admitted);fs.writeFileSync(preload,'x'.repeat(65536));const read=fs.readFileSync;let reads=0;
  (fs as any).readFileSync=(...args:any[])=>{if(args[0]===preload)reads++;return (read as any)(...args);};
  try{assert.throws(()=>createSyntheticServerPreload(admitted),/SYNTHETIC_PRELOAD_CONFLICT/);assert.equal(reads,0,'Oversized preload must be rejected before read');}
  finally{(fs as any).readFileSync=read;}
}finally{fs.rmSync(admitted,{recursive:true});}
console.log('PASS oversized existing bootstrap is rejected before allocation or file-content read');
const fixture=await startPackageFixture();
try{const health=await (await fetch(fixture.base+'/api/health')).json();assert.equal(health.secretStoreProvider,'ENCRYPTED_FILE');assert.equal(fs.existsSync(path.join(fixture.dir,'.secrets')),false);console.log('PASS actual server boots through the real fixture-owned encrypted fallback with native credential access forbidden');}
finally{await fixture.close();}
