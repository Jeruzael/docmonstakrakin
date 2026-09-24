import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Each route gets a fresh copy: older suites overwrite retained evidence and
// therefore cannot run safely in the operator workspace or share test copies.
const root=process.cwd(),out=path.join(root,'runtime/batch-a');
const commands={test:'npm.cmd test',complete:'npm.cmd run test:complete',reconciliation:'npm.cmd run test:reconciliation',
  contract:'npm.cmd run test:bootstrap:contract',manifest:'npm.cmd run test:bootstrap:manifest',
  executor:'npm.cmd run test:bootstrap:executor',verifier:'npm.cmd run test:bootstrap:execution-verifier',
  projects:'npm.cmd run test:projects-workspace',ui:'npm.cmd run test:projects-workspace:ui',
  qa:'npm.cmd run qa',lint:'npm.cmd run lint',build:'npm.cmd run build',wbs:'npm.cmd run wbs:check'};
const route=process.argv[2];if(!Object.hasOwn(commands,route))throw Error('Select a known verification route');
fs.mkdirSync(out,{recursive:true});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-batch-a-verification-'));
for(const rel of ['src','server','scripts','docs','bootstrap','public','server.ts','package.json','package-lock.json','AGENT_BOOTSTRAP.md','index.html','vite.config.ts','tsconfig.json']) {
  if(fs.existsSync(path.join(root,rel)))fs.cpSync(path.join(root,rel),path.join(dir,rel),{recursive:true});
}
fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'junction');
if(fs.existsSync(path.join(dir,'.git'))||fs.existsSync(path.join(dir,'.local'))||fs.existsSync(path.join(dir,'.secrets')))throw Error('Unsafe fixture');
const blocked=route==='complete'?['scripts/testEnvironmentFixtures.ts']:[];
for(const rel of blocked)fs.renameSync(path.join(dir,rel),path.join(dir,rel.replace('/test','/blocked-test')));
const env={GEMINI_API_KEY:'',DMK_HUMAN_REVIEWERS:'{}'};
for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','COMSPEC','ComSpec','PATHEXT','APPDATA','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
const logPath=path.join(out,route+'.log'),log=fs.createWriteStream(logPath);
const child=spawn(process.env.ComSpec||'cmd.exe',['/d','/s','/c',commands[route]],{cwd:dir,windowsHide:true,env,stdio:'pipe'});
child.stdout.on('data',b=>log.write(b));child.stderr.on('data',b=>log.write(b));
const exitCode=await new Promise(resolve=>{child.on('error',e=>{log.write(String(e));resolve(-1);});child.on('exit',resolve);});
await new Promise(resolve=>log.end(resolve));
const report={route,command:commands[route],status:exitCode===0?'PASS':'FAIL',exitCode,blocked,copy:dir,log:logPath};
if(route==='complete')fs.cpSync(path.join(dir,'runtime/rc-regression'),path.join(out,'complete-evidence'),{recursive:true});
fs.writeFileSync(path.join(out,route+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));process.exitCode=Number(exitCode)||0;
