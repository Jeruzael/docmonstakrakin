import assert from 'node:assert/strict';
import {OSKeychainSecretStore} from '../server/secrets/osKeychainStore.ts';
import {installNativeCredentialTripwire,createSyntheticServerPreload} from './fixtures/syntheticServerPreload.ts';
import {startPackageFixture} from './fixtures/projectsWorkspaceUiServer.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const original=OSKeychainSecretStore.prototype.isNativeAvailable;
let probes=0;OSKeychainSecretStore.prototype.isNativeAvailable=function(){probes++;throw new Error('NATIVE_PROBE_EXECUTED');};
const restore=installNativeCredentialTripwire();
try{await assert.rejects(()=>new OSKeychainSecretStore().getSecret('SYNTHETIC_ONLY'),/NATIVE_CREDENTIAL_ACCESS_FORBIDDEN/);assert.equal(probes,0);console.log('PASS synthetic server tripwire rejects default native credential acquisition before probing the OS');}
finally{restore();OSKeychainSecretStore.prototype.isNativeAvailable=original;}
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
