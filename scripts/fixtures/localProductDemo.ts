import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,scryptSync,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import {ProjectStore} from '../../server/projectStore.ts';
import {INITIAL_PROJECTS} from '../../src/data/initialData.ts';
import {createSyntheticServerPreload} from './syntheticServerPreload.ts';

export const DEMO_PASSWORD='Synthetic-demo-only!';
export const DEMO_REVIEWER='synthetic-security-officer';
export const DEMO_AGENT='synthetic-agent';

/** Explicit test/demo entrypoint. Production startup never imports this fixture. */
export async function startLocalProductDemo() {
  const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-product-demo-'));
  const marker=randomBytes(32).toString('hex');fs.writeFileSync(path.join(dir,'.synthetic-product-demo'),marker);
  const listener=createServer();await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const port=(listener.address() as {port:number}).port;await new Promise<void>(resolve=>listener.close(()=>resolve()));
  const store=new ProjectStore();for(const key of Object.keys(store))(store as any)[key]=key==='projects'?[]:{};
  const self={...structuredClone(INITIAL_PROJECTS[0]),id:'PRJ-DOCMONSTAKRAKIN',name:'Synthetic controlled-document workspace',stateVersion:1,owner:'Synthetic fixture operator',healthScore:0,lifecyclePhase:'DISCOVERY' as const,progress:{requirementsReadiness:0,architectureReadiness:0,implementation:0,verification:0,securityAssurance:0,releaseReadiness:0}};
  store.projects=[self];for(const key of Object.keys(store))if(key!=='projects')(store as any)[key][self.id]=[];
  store.evidence[self.id]=[{id:'EV-SYNTHETIC-DEMO',type:'TEST_RUN',title:'Synthetic fixture provenance',workItemId:'FIXTURE-ONLY',result:'UNTRUSTED',producer:'Disconnected demo fixture',createdAt:'2026-10-21T00:00:00Z',sha256Hash:createHash('sha256').update('synthetic product demo fixture').digest('hex'),details:'Fixture bytes only; not product acceptance or release evidence.'}];
  fs.mkdirSync(path.join(dir,'.local'));const snapshot=path.join(dir,'.local/project-state.json');fs.writeFileSync(snapshot,JSON.stringify({schemaVersion:1,state:store}));
  const manifestPath='bootstrap/docmonstakrakin.self-bootstrap.json';
  const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
  for(const relative of [manifestPath,...manifest.documents.map((doc:any)=>doc.path),'MASTER_WBS.yaml']){
    const source=path.resolve(root,relative),destination=path.resolve(dir,relative);
    assert(source.startsWith(root+path.sep) && destination.startsWith(dir+path.sep));
    if(fs.existsSync(source)){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);}
  }
  const stateDocument='# docmonstakrakin current project state\n\nSynthetic disposable fixture only.\n\n### Current governance and task status\n- DMK-201 remains historical.\n- Gate 7 remains unexecuted.\n- Live reconciliation remains disabled.\n- Release status: BLOCKED.\n';
  fs.writeFileSync(path.join(dir,'docs/00_control/PROJECT_STATE.md'),stateDocument);
  const roster=Object.fromEntries([[DEMO_REVIEWER,'HUMAN'],[DEMO_AGENT,'AGENT']].map(([name,kind])=>{
    const salt=randomBytes(16).toString('hex');return [name,{id:`TEST-ONLY-${kind}`,kind,roles:['Security Officer'],credentialVerifier:`${salt}:${scryptSync(DEMO_PASSWORD,salt,32).toString('hex')}`}];
  }));
  const env:NodeJS.ProcessEnv={NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),GEMINI_API_KEY:'',DMK_HUMAN_REVIEWERS:JSON.stringify(roster)};
  for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'])if(process.env[key])env[key]=process.env[key];
  let output='';let child:ReturnType<typeof spawn>|undefined;
  const preload=createSyntheticServerPreload(dir);
  const launch=()=>{const process=spawn(globalThis.process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,'--import',pathToFileURL(preload).href,path.join(root,'server.ts')],{cwd:dir,windowsHide:true,env,stdio:'pipe'});process.stdout!.on('data',b=>output+=b);process.stderr!.on('data',b=>output+=b);return process;};
  const base=`http://127.0.0.1:${port}`;
  const stop=async()=>{if(child && child.exitCode===null){const exited=new Promise(resolve=>child!.once('exit',resolve));child.kill();await exited;}};
  const cleanup=()=>{assert.equal(path.dirname(dir),os.tmpdir());assert(path.basename(dir).startsWith('dmk-product-demo-'));assert.equal(fs.readFileSync(path.join(dir,'.synthetic-product-demo'),'utf8'),marker);fs.rmSync(dir,{recursive:true,force:true});};
  const ready=async()=>{const deadline=Date.now()+30000;while(Date.now()<deadline && child?.exitCode===null){try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Product fixture startup failed: ${output}`);};
  try {
    await build({root,logLevel:'silent',build:{outDir:path.join(dir,'dist'),emptyOutDir:true}});
    child=launch();await ready();
    return {base,dir,snapshot,bytes:()=>fs.readFileSync(snapshot),state:()=>JSON.parse(fs.readFileSync(snapshot,'utf8')).state,restart:async()=>{await stop();child=launch();await ready();},close:async()=>{await stop();cleanup();}};
  }catch(error){await stop();cleanup();throw error;}
}
