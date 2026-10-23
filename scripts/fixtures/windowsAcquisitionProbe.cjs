'use strict';
// Temporary diagnostic only. Never opens SQLite or creates authority records.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
if (process.platform !== 'win32') throw Error('WINDOWS_ACQUISITION_PROBE_WINDOWS_ONLY');
const source = fs.realpathSync.native(process.cwd()), parent = fs.realpathSync.native(os.tmpdir());
const root = fs.mkdtempSync(path.join(parent, 'dmk-windows-acquisition-'));
const boundaryFile = path.join(source, 'server/security/workspaceAccess/privateBoundary.cjs');
const preloadFile = path.join(root, 'deny-native.mjs');
const sparseKeys = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'];
// Explicit OS configuration only. No arbitrary environment or secret copying.
const osKeys = ['APPDATA', 'LOCALAPPDATA', 'ProgramData', 'ALLUSERSPROFILE', 'PUBLIC', 'SystemDrive', 'COMSPEC', 'PATHEXT', 'OS',
  'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'USERNAME', 'USERDOMAIN', 'USERDOMAIN_ROAMINGPROFILE', 'COMPUTERNAME', 'SESSIONNAME',
  'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER', 'NUMBER_OF_PROCESSORS', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432',
  'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432'];
const sparse = { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '5000', GEMINI_API_KEY: '' };
for (const key of sparseKeys) if (process.env[key]) sparse[key] = process.env[key];
const safeOs = { ...sparse };
for (const key of osKeys) if (process.env[key]) safeOs[key] = process.env[key];
const code = `const cp=require('node:child_process'),path=require('node:path');
const original=cp.execFileSync,observations=[];
cp.execFileSync=function(file,args,options){const start=process.hrtime.bigint();try{const value=original(file,args,options);if(file==='powershell.exe')observations.push({elapsedMs:Number(process.hrtime.bigint()-start)/1e6,status:0,code:null,signal:null,errno:null,stderr:''});return value}catch(e){if(file==='powershell.exe')observations.push({elapsedMs:Number(process.hrtime.bigint()-start)/1e6,status:e.status??null,code:e.code??null,signal:e.signal??null,errno:e.errno??null,stderr:String(e.stderr??'').slice(-2000)});throw e}};
let outcome;const environment={...process.env,PSModulePath:path.join(process.env.WINDIR||'C:\\Windows','System32/WindowsPowerShell/v1.0/Modules')};
try{if(process.argv[1]==='startup'){cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from('$PSVersionTable.PSVersion.ToString()','utf16le').toString('base64')],{windowsHide:true,timeout:4000,stdio:'pipe',env:environment})}else{const b=require(${JSON.stringify(boundaryFile)}),h=b.capture(process.cwd(),false);b.assertFiles(h)}outcome={accepted:true}}catch(e){outcome={accepted:false,code:e.code??null}}
console.log('WINDOWS_ACQUISITION_CHILD '+JSON.stringify({mode:process.argv[1],observations,outcome,environmentPresence:Object.fromEntries(${JSON.stringify([...sparseKeys, ...osKeys, 'PSModulePath'])}.map(k=>[k,!!environment[k]]))}));`;
async function probe(name, mode, input, env, preload = false) {
  const start = process.hrtime.bigint(); let stdout = '', stderr = '', timedOut = false;
  const imports = preload ? ['--import', pathToFileURL(path.join(source, 'node_modules/tsx/dist/loader.mjs')).href, '--import', pathToFileURL(preloadFile).href] : [];
  const child = spawn(process.execPath, [...imports, '--input-type=commonjs', '-e', code, mode], { cwd: root, env, windowsHide: true,
    stdio: [input === 'ignore' ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
  // Only the ended variant closes the asynchronous child's unused input.
  if (input === 'ended') child.stdin.end();
  child.stdout.on('data', data => { stdout = (stdout + data).slice(-20000); });
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-3000); });
  let spawnError;
  child.once('error', error => { spawnError = error.code; });
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 12000);
  const result = await new Promise(resolve => child.once('close', (status, signal) => resolve({ status, signal })));
  clearTimeout(timer);
  const line = stdout.split(/\r?\n/).find(value => value.startsWith('WINDOWS_ACQUISITION_CHILD '));
  const observation = line ? JSON.parse(line.slice('WINDOWS_ACQUISITION_CHILD '.length)) : null;
  console.log('WINDOWS_ACQUISITION_MATRIX ' + JSON.stringify({ name, input, mode, preload, ...result, spawnError, timedOut,
    elapsedMs: Number(process.hrtime.bigint() - start) / 1e6, observation, stderr }));
  if (!observation || spawnError || timedOut || result.status !== 0) throw Error('ACQUISITION_DIAGNOSTIC_PROCESS_FAILED');
}
(async () => {
  try {
    // A genuine, newly created empty private directory; no lock/database/session.
    const boundary = require(boundaryFile); boundary.capture(root, true);
    fs.writeFileSync(preloadFile, `import {installNativeCredentialTripwire} from ${JSON.stringify(pathToFileURL(path.join(source, 'scripts/fixtures/syntheticServerPreload.ts')).href)};installNativeCredentialTripwire();`, { flag: 'wx' });
    await probe('control-sparse-open-startup', 'startup', 'open', sparse);
    await probe('sparse-ended-startup', 'startup', 'ended', sparse);
    await probe('control-sparse-open-strict', 'strict', 'open', sparse);
    await probe('sparse-ended-strict', 'strict', 'ended', sparse);
    await probe('safe-os-open-strict', 'strict', 'open', safeOs);
    await probe('sparse-ignore-strict', 'strict', 'ignore', sparse);
    await probe('sparse-open-tsx-tripwire-strict', 'strict', 'open', sparse, true);
    await probe('sparse-ended-tsx-tripwire-strict', 'strict', 'ended', sparse, true);
    await probe('repeated-control-sparse-open-strict', 'strict', 'open', sparse);
    if (fs.readdirSync(path.join(root, '.security')).length !== 0) throw Error('ACQUISITION_PROBE_UNEXPECTED_AUTHORITY_FILES');
    console.log('DIAGNOSTIC_ONLY_MATRIX_COMPLETE_NOT_QUALIFICATION');
  } finally {
    if (path.dirname(path.resolve(root)) !== parent || !/^dmk-windows-acquisition-/.test(path.basename(root)) || fs.lstatSync(root).isSymbolicLink()) throw Error('ACQUISITION_PROBE_CLEANUP_REJECTED');
    fs.rmSync(root, { recursive: true, maxRetries: 5, retryDelay: 100 });
  }
})().catch(error => { console.error('ACQUISITION_DIAGNOSTIC_FAILED ' + error.message); process.exitCode = 1; });
