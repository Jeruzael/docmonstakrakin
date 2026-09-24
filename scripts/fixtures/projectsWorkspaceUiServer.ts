import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import {ProjectStore} from '../../server/projectStore.ts';
import {readProjectSnapshot} from '../../server/projectPersistence.ts';

/** Actual package endpoints and persistence, confined to a synthetic empty workspace. */
export async function startPackageFixture(initialSnapshot?: unknown) {
  const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmk194-ui-'));
  const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));
  const port=(listener.address() as {port:number}).port;await new Promise<void>(r=>listener.close(()=>r()));
  const store=new ProjectStore();for(const key of Object.keys(store))(store as any)[key]=key==='projects'?[]:{};
  fs.mkdirSync(path.join(dir,'.local'));const snapshot=path.join(dir,'.local/project-state.json');
  fs.writeFileSync(snapshot,JSON.stringify(initialSnapshot ?? {schemaVersion:1,state:store}));
  // Deliberately do not inherit provider keys, reviewer credentials or master keys.
  const env:NodeJS.ProcessEnv={NODE_ENV:'production',PORT:String(port),GEMINI_API_KEY:'',DMK_HUMAN_REVIEWERS:'{}'};
  for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
  let output='';
  const launch=()=>{
    const process=spawn(globalThis.process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,path.join(root,'server.ts')],{cwd:dir,windowsHide:true,env,stdio:'pipe'});
    process.stdout.on('data',b=>output+=b);process.stderr.on('data',b=>output+=b);process.on('error',e=>output+=e.message);return process;
  };
  let child=launch();
  const base=`http://127.0.0.1:${port}`;
  const stop=async()=>{if(child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}};
  const close=async()=>{await stop();assert.equal(path.dirname(dir),os.tmpdir());assert(path.basename(dir).startsWith('dmk194-ui-'));fs.rmSync(dir,{recursive:true,force:true});};
  const ready=async()=>{
    let ready=false;const deadline=Date.now()+30000;
    while(Date.now()<deadline && child.exitCode===null){try{ready=(await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    assert(ready,`Isolated server startup failed: ${output}`);
  };
  try {
    await ready();
    return {base,close,dir,snapshotPath:snapshot,restart:async()=>{await stop();child=launch();await ready();},bytes:()=>fs.readFileSync(snapshot),reopen:()=>readProjectSnapshot(dir)!};
  }catch(e){await close();throw e;}
}
