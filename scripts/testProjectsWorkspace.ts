import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectsView} from '../src/components/ProjectsView.tsx';
import {TopBar} from '../src/components/TopBar.tsx';
import {createProjectLoader, readProjectList, projectContentReady} from '../src/data/projectWorkspace.ts';
import type {Project} from '../src/types.ts';
import {projectQuestionCatalog} from '../server/projectQueries.ts';
import {verifyProjectsWorkspaceHttp} from './fixtures/projectsWorkspaceHttp.ts';

let passed=0;
async function test(name:string,run:()=>void|Promise<void>){await run();console.log(`PASS ${name}`);passed++;}
const projects=['A','B','PRJ-DOCMONSTAKRAKIN'].map(id=>({id,name:`Project ${id}`,description:`Description ${id}`,profiles:['WEB_APPLICATION'],specializedProfiles:['DEVELOPER_TOOL'],lifecyclePhase:'DISCOVERY',dataSensitivity:'INTERNAL',deliveryMethod:'ITERATIVE',deploymentIntent:'LOCAL_ONLY',progress:{requirementsReadiness:0,architectureReadiness:0,implementation:0,verification:0,securityAssurance:0,releaseReadiness:0},stateVersion:1,owner:'Operator',targetRelease:'v0.1',createdAt:'2026-09-22',updatedAt:'2026-09-22',healthScore:0})) as Project[];
const requests:string[]=[];
const canonical=structuredClone(projects);
await test('question catalog projection preserves empty bootstrap collections and saved answers',()=>{
  const saved:any[]=[];const first=projectQuestionCatalog(saved);assert(first.length>0);assert.deepEqual(saved,[]);
  const answered=[{...first[0],answer:'Saved answer',state:'ANSWERED' as const}];const before=structuredClone(answered);
  const projected=projectQuestionCatalog(answered);assert.equal(projected[0].answer,'Saved answer');projected[0].state='DEFERRED';assert.deepEqual(answered,before);
  const server=fs.readFileSync('server.ts','utf8');const read=server.slice(server.indexOf("app.get('/api/projects/:id/questions'"),server.indexOf("app.post('/api/projects/:id/answers'"));assert(!read.includes('store.questions[project.id] ='));assert(read.includes('projectQuestionCatalog'));
});
const get=async (url:string,options?:RequestInit)=>{
  assert.equal(options?.method,'GET');requests.push(url);
  if(url==='/api/projects')return {ok:true,json:async()=>structuredClone(projects)};
  const [,id,suffix='']=url.match(/^\/api\/projects\/([^/]+)(.*)$/)!;
  return {ok:true,json:async()=>suffix===''?structuredClone(projects.find(p=>p.id===id)):suffix==='/next-action'?{id:`NEXT-${id}`}:[{id:`${id}${suffix}`}]};
};
const props={projects,activeProjectId:'A',loading:false,error:'',onSelectProject:()=>{},onCreateProject:()=>{},onRetry:()=>{}};
await test('multiple canonical projects and explicit active identity render with metadata',()=>{
  const html=renderToStaticMarkup(React.createElement(ProjectsView,props));
  for(const p of projects)assert(html.includes(p.id)&&html.includes(p.name));
  assert(html.includes('Active project'));assert(html.includes('DISCOVERY'));assert(html.includes('Health: 0%'));
});
await test('zero-project workspace offers explicit creation; missing metadata stays absent',()=>{
  const empty=renderToStaticMarkup(React.createElement(ProjectsView,{...props,projects:[]}));assert(empty.includes('No projects yet'));assert(empty.includes('Create New Project'));
  const sparse=renderToStaticMarkup(React.createElement(ProjectsView,{...props,projects:[{id:'SPARSE',name:'Sparse'} as Project]}));assert(!sparse.includes('Health:'));assert(!sparse.includes('undefined'));
});
await test('list retrieval is read-only and rejects failed or malformed responses',async()=>{
  assert.deepEqual(await readProjectList(get as any),projects);
  await assert.rejects(()=>readProjectList((async()=>({ok:false})) as any));
  await assert.rejects(()=>readProjectList((async()=>({ok:true,json:async()=>({})})) as any));
});
let selected='A';let visible:any=null;let error='';let loading=false;
const callbacks={onStart:()=>{loading=true;error='';},onCommit:(value:any)=>{visible=value;loading=false;},onError:(message:string)=>{error=message;loading=false;}};
const loader=createProjectLoader(get as any);
await test('A to B to A replaces every scoped collection without canonical mutation',async()=>{
  for(const id of ['A','B','A']){selected=id;loader.invalidate();await loader.load(id,()=>selected===id,callbacks);assert.equal(visible.project.id,id);for(const [key,value] of Object.entries(visible)){if(key!=='project'&&key!=='nextAction')assert((value as any[]).every(v=>v.id.startsWith(id)));}assert(projectContentReady(id,visible.project,loading,error));}
  assert.deepEqual(projects,canonical);assert.equal(requests.length,43); // list plus 3 complete 14-resource snapshots
});
await test('stale A responses cannot overwrite a newer B selection even if abort is ignored',async()=>{
  let release!:()=>void;const held=new Promise<void>(r=>release=r);
  const raced=createProjectLoader((async(url:string,options:any)=>{if(url.includes('/A'))await held;return get(url,options);}) as any);
  selected='A';const a=raced.load('A',()=>selected==='A',callbacks);selected='B';raced.invalidate();await raced.load('B',()=>selected==='B',callbacks);release();await a;assert.equal(visible.project.id,'B');assert.equal(error,'');
});
await test('late refresh callbacks for an old project cannot invalidate the current load',async()=>{
  let starts=0;selected='B';await loader.load('A',()=>selected==='A',{...callbacks,onStart:()=>starts++});assert.equal(starts,0);assert.equal(visible.project.id,'B');
});
await test('rapid A to B to C ignores both stale errors and stale success',async()=>{
  let release!:()=>void;const held=new Promise<void>(r=>release=r);
  const raced=createProjectLoader((async(url:string,options:any)=>{if(!url.includes('/PRJ-DOCMONSTAKRAKIN')){await held;if(url.includes('/A'))throw new Error('Old A failure');}return get(url,options);}) as any);
  selected='A';const a=raced.load('A',()=>selected==='A',callbacks);
  selected='B';raced.invalidate();const b=raced.load('B',()=>selected==='B',callbacks);
  selected='PRJ-DOCMONSTAKRAKIN';raced.invalidate();await raced.load(selected,()=>selected==='PRJ-DOCMONSTAKRAKIN',callbacks);
  release();await Promise.all([a,b]);assert.equal(visible.project.id,'PRJ-DOCMONSTAKRAKIN');assert.equal(error,'');
});
await test('partial load failure hides prior data and allows retry',async()=>{
  selected='B';await loader.load('B',()=>selected==='B',callbacks);
  const failed=createProjectLoader((async(url:string,options:any)=>url.endsWith('/risks')?{ok:false}:get(url,options)) as any);
  selected='A';await failed.load('A',()=>selected==='A',callbacks);assert(error);assert.equal(visible.project.id,'B');assert(!projectContentReady('A',visible.project,loading,error));
  await loader.load('A',()=>selected==='A',callbacks);assert.equal(error,'');assert.equal(visible.project.id,'A');
});
await test('wrong canonical identity and malformed collections fail closed',async()=>{
  for(const response of [{id:'WRONG'},null]){const invalid=createProjectLoader((async(url:string,options:any)=>url.endsWith('/A')?{ok:true,json:async()=>response}:get(url,options)) as any);await invalid.load('A',()=>true,callbacks);assert(error);}
  const invalid=createProjectLoader((async(url:string,options:any)=>url.endsWith('/features')?{ok:true,json:async()=>null}:get(url,options)) as any);await invalid.load('A',()=>true,callbacks);assert(error);
});
await test('loading and failures have recovery UI; project readiness requires matching identity',()=>{
  assert(!projectContentReady('B',projects[0],false,''));assert(!projectContentReady('A',projects[0],true,''));assert(!projectContentReady('',null,false,''));
  const html=renderToStaticMarkup(React.createElement(ProjectsView,{...props,loading:true,error:'Unavailable'}));assert(html.includes('Unavailable'));assert(html.includes('Retry'));assert(html.includes('Loading'));
});
await test('TopBar shows selected B identity and loading status without previous A metadata',()=>{
  const html=renderToStaticMarkup(React.createElement(TopBar,{currentProject:projects[1],projects,onSelectProject:()=>{},onOpenCreateWizard:()=>{},onOpenSearch:()=>{},selectionStatus:'Loading…',searchDisabled:true}));assert(html.includes('Project B'));assert(!html.includes('Project A'));assert(html.includes('Loading…'));assert(html.includes('disabled'));
});
await test('App wiring shares one selection path, resets scoped dialogs/deep links and passes scoped search data',()=>{
  const app=fs.readFileSync('src/App.tsx','utf8');
  assert(app.includes('<ProjectsView'));assert((app.match(/onSelectProject=\{handleSelectProject\}/g)||[]).length>=2);
  const selection=app.slice(app.indexOf('const handleSelectProject'),app.indexOf('// Fetch projects list'));
  for(const reset of ['setSelectedReqId(undefined)','setSelectedQuestionId(undefined)','setSelectedWorkItemId(undefined)',"setRequirementsSubTab('canonical')",'setIsSearchOpen(false)','setOverrideGate(null)','setIsPackageModalOpen(false)'])assert(selection.includes(reset),reset);
  assert(app.includes('project={currentProject}'));assert(app.includes('requirements={requirements}'));assert(!app.includes('useState<Project[]>(INITIAL_PROJECTS)'));
});
await test('real HTTP A-B-A reads preserve canonical state and explicit answers still persist only to A',()=>verifyProjectsWorkspaceHttp(projects));
console.log(`Projects workspace: ${passed} checks passed. Browser interaction and visual review remain human-pending.`);
