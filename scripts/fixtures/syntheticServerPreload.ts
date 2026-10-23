import {OSKeychainSecretStore} from '../../server/secrets/osKeychainStore.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Test-only denial, not a fake successful credential provider. */
export function installNativeCredentialTripwire(){
  const original=OSKeychainSecretStore.prototype.isNativeAvailable;
  OSKeychainSecretStore.prototype.isNativeAvailable=function(){
    if((this as any).forceFallback!==true)throw new Error('NATIVE_CREDENTIAL_ACCESS_FORBIDDEN');
    return false;
  };
  return ()=>{OSKeychainSecretStore.prototype.isNativeAvailable=original;};
}

/** Pins an already generated fixture cwd before selecting the real fallback driver. */
export function createSyntheticServerPreload(directory:string):string {
  const lexical=path.resolve(directory),identity=fs.lstatSync(lexical,{bigint:true});
  if(identity.isSymbolicLink() || !identity.isDirectory())throw new Error('SYNTHETIC_FIXTURE_ROOT_REQUIRED');
  const parent=fs.realpathSync.native(os.tmpdir()),parentIdentity=fs.lstatSync(path.dirname(lexical),{bigint:true});
  const root=fs.realpathSync.native(lexical);
  const admit=()=>{
    const current=fs.lstatSync(lexical,{bigint:true}),native=fs.lstatSync(root,{bigint:true}),currentParent=fs.lstatSync(path.dirname(lexical),{bigint:true}),nativeParent=fs.lstatSync(parent,{bigint:true});
    if(current.isSymbolicLink() || !current.isDirectory() || current.dev!==identity.dev || current.ino!==identity.ino || native.dev!==identity.dev || native.ino!==identity.ino ||
      currentParent.isSymbolicLink() || currentParent.dev!==parentIdentity.dev || currentParent.ino!==parentIdentity.ino || nativeParent.dev!==parentIdentity.dev || nativeParent.ino!==parentIdentity.ino ||
      fs.realpathSync.native(lexical)!==root || fs.realpathSync.native(root)!==root || path.dirname(root)!==parent || path.basename(root)!==path.basename(lexical) ||
      !/^dmk(?:194-(?:ui|http)|-product-demo|-crypto|-reqsync)-/.test(path.basename(root)))throw new Error('SYNTHETIC_FIXTURE_ROOT_REQUIRED');
  };
  admit();
  const filename=path.join(root,'synthetic-server-preload.mjs');
  const utility=new URL('./syntheticServerPreload.ts',import.meta.url).href;
  const factory=new URL('../../server/secrets/secretStoreFactory.ts',import.meta.url).href;
  const content=`import fs from 'node:fs';
import path from 'node:path';
import {installNativeCredentialTripwire} from ${JSON.stringify(utility)};
import {getSecretStore} from ${JSON.stringify(factory)};
const root=${JSON.stringify(root)};
const identity=fs.lstatSync(process.cwd(),{bigint:true});
if(fs.realpathSync.native(process.cwd())!==root || identity.isSymbolicLink() || !identity.isDirectory() || String(identity.dev)!==${JSON.stringify(String(identity.dev))} || String(identity.ino)!==${JSON.stringify(String(identity.ino))} || process.env.GEMINI_API_KEY)throw new Error('SYNTHETIC_FIXTURE_ADMISSION_FAILED');
installNativeCredentialTripwire();
// Only this independently admitted disposable legacy fixture selects demo mode.
process.env.DMK_WORKSPACE_ACCESS='LOCAL_DEVELOPMENT';
const dataDir=path.join(root,'.synthetic-secrets');
getSecretStore({forceFallback:true,dataDir,legacyMachineTokenPath:path.join(dataDir,'legacy-token'),serviceName:'docmonstakrakin-synthetic-only',masterPassphrase:'synthetic-server-fixture-only'});
console.log('SYNTHETIC_NATIVE_CREDENTIALS_FORBIDDEN');
`;
  if(fs.existsSync(filename)){
    const existing=fs.lstatSync(filename,{bigint:true}),expected=Buffer.from(content);
    if(!existing.isFile() || existing.isSymbolicLink() || existing.nlink!==1n || existing.size!==BigInt(expected.length) || fs.realpathSync.native(filename)!==filename)throw new Error('SYNTHETIC_PRELOAD_CONFLICT');
    const fd=fs.openSync(filename,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try{
      const opened=fs.fstatSync(fd,{bigint:true});if(opened.dev!==existing.dev || opened.ino!==existing.ino || opened.nlink!==1n || opened.size!==existing.size)throw new Error('SYNTHETIC_PRELOAD_CONFLICT');
      const bytes=Buffer.alloc(expected.length+1);let length=0;
      while(length<bytes.length){const count=fs.readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;}
      if(length!==expected.length || !bytes.subarray(0,length).equals(expected))throw new Error('SYNTHETIC_PRELOAD_CONFLICT');
    }finally{fs.closeSync(fd);}
  }else{admit();fs.writeFileSync(filename,content,{flag:'wx',mode:0o600});admit();}
  return filename;
}
