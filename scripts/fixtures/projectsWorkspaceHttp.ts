import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {ProjectStore} from '../../server/projectStore.ts';
import {createProjectLoader,readProjectList} from '../../src/data/projectWorkspace.ts';
import type {Project} from '../../src/types.ts';

export async function verifyProjectsWorkspaceHttp(projects:Project[]) {
  const root=process.cwd();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dmk194-http-'));
  const listener=createServer();await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const port=(listener.address() as {port:number}).port;await new Promise<void>(resolve=>listener.close(()=>resolve()));
  const store=new ProjectStore();store.projects=structuredClone(projects);
  for(const key of Object.keys(store)){const collection=(store as any)[key];if(collection && !Array.isArray(collection) && typeof collection==='object'){(store as any)[key]={};for(const project of projects)(store as any)[key][project.id]=[];}}
  fs.mkdirSync(path.join(dir,'.local'));const snapshot=path.join(dir,'.local/project-state.json');
  fs.writeFileSync(snapshot,JSON.stringify({schemaVersion:1,state:store}));const beforeBytes=fs.readFileSync(snapshot);
  const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,path.join(root,'server.ts')],{cwd:dir,windowsHide:true,env:{...process.env,NODE_ENV:'production',PORT:String(port),GEMINI_API_KEY:'',DMK_HUMAN_REVIEWERS:'{}'},stdio:'pipe'});
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);child.on('error',e=>output+=e.message);
  const request:typeof fetch=(url,options)=>fetch(`http://127.0.0.1:${port}${url}`,options);
  try {
    let ready=false;const deadline=Date.now()+45000;
    while(Date.now()<deadline && child.exitCode===null){try{ready=(await request('/api/health',{signal:AbortSignal.timeout(1000)})).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    assert(ready,`Isolated server failed to start: ${output}`);
    const canonical=async(id:string)=>{const response=await request(`/api/projects/${id}/export`);assert(response.ok);const {metadata,...state}=await response.json();return state;};
    const before=await Promise.all(projects.map(p=>canonical(p.id)));assert.deepEqual(before[0].questions,[]);
    assert.deepEqual((await readProjectList(request)).map(p=>p.id),projects.map(p=>p.id));
    const loader=createProjectLoader(request);let loaded:any;
    for(const id of ['A','B','A']){await loader.load(id,()=>true,{onStart:()=>{},onCommit:value=>loaded=value,onError:message=>assert.fail(message)});assert.equal(loaded.project.id,id);assert(loaded.questions.length>0);}
    assert.deepEqual(await Promise.all(projects.map(p=>canonical(p.id))),before,'Switching must not alter any exported canonical project state or audit');
    assert.deepEqual(fs.readFileSync(snapshot),beforeBytes,'Switching must not persist canonical mutations');
    const answer=await request('/api/projects/A/answers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionId:loaded.questions[0].id,state:'DEFERRED',justification:'Isolated DMK-194 regression deferral',answer:'Pending operator discovery'})});
    assert.equal(answer.status,200,JSON.stringify(await answer.json()));
    assert((await canonical('A')).questions.some((q:any)=>q.id===loaded.questions[0].id && q.state==='DEFERRED'));
    assert.deepEqual(await canonical('B'),before[1],'An explicit A answer must leave B intact');
  } finally {
    if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
    // Only this fixture's generated temporary directory is removed.
    if(path.dirname(dir)===os.tmpdir() && path.basename(dir).startsWith('dmk194-http-'))fs.rmSync(dir,{recursive:true,force:true});
  }
}
