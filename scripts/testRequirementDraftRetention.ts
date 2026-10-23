import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium, type Page} from 'playwright';
import {startIsolatedVite} from './fixtures/isolatedVite.ts';
import {INITIAL_PROJECTS} from '../src/data/initialData.ts';
import {DerivationError, validateText} from '../src/data/generationValidation.ts';

// Mount the actual App and RequirementsView. Only the API boundary is synthetic;
// no server, credentials, native storage, canonical documents or signoff is used.
const vite=await startIsolatedVite(process.cwd());
const base=vite.resolvedUrls!.local[0];
const executable=process.env.DMK_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
const output=path.resolve('runtime/requirement-draft-retention');fs.mkdirSync(output,{recursive:true});
const results:{name:string;status:string;error?:string}[]=[];
const projects=['A','B'].map(id=>({...structuredClone(INITIAL_PROJECTS[0]),id,name:`Draft fixture ${id}`}));
const draft={title:'Confirm {{value}} safely',statement:'The system MUST retain a rejected manual requirement draft.',rationale:'Synthetic regression proof only.',category:'PRIVACY',priority:'HIGH'};
type Reply='422'|'503'|'network'|'success';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
const settle=(page:Page)=>page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
const modal=(page:Page)=>page.locator('form').filter({has:page.getByPlaceholder('The system MUST enforce...')});
async function setup(reply:Reply) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(4000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const state={reply,hold:undefined as ReturnType<typeof deferred>|undefined,posts:[] as {projectId:string;body:any}[],requirements:{A:[],B:[]} as Record<string,any[]>,completed:0,expectAbortedResponse:false};
  await page.addInitScript(()=>{
    const original=window.fetch;const calls:string[]=[];(window as any).__requirementPosts=calls;
    window.fetch=(url,options)=>{if(options?.method==='POST' && /\/requirements$/.test(String(url)))calls.push(String(url));return original(url,options);};
    const originalTimeout=AbortSignal.timeout.bind(AbortSignal);
    (window as any).__requirementDeadlines=[];
    AbortSignal.timeout=(milliseconds:number)=>{
      if(!(window as any).__captureRequirementDeadline)return originalTimeout(milliseconds);
      const controller=new AbortController();
      (window as any).__requirementDeadlines.push({milliseconds,controller});
      return controller.signal;
    };
  });
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==new URL(base).origin)return route.abort('blockedbyclient');
    if(!url.pathname.startsWith('/api/'))return route.continue();
    const send=(body:unknown,status=200)=>route.fulfill({status,json:body});
    const match=url.pathname.match(/^\/api\/projects\/([^/]+)(.*)$/);
    if(route.request().method()==='POST') {
      assert(match && match[2]==='/requirements',`Unexpected mutation: ${url.pathname}`);
      const projectId=match[1],body=route.request().postDataJSON();state.posts.push({projectId,body});
      const response=state.reply,gate=state.hold;if(gate)await gate.promise;
      try {
        if(response==='network')return await route.abort('failed');
        if(response==='503')return await route.fulfill({status:503,contentType:'text/html',body:'<h1>Synthetic service unavailable</h1>'});
        if(response==='422') {
          let error:DerivationError|undefined;
          try{validateText(body.title,'requirement.title');}catch(cause){assert(cause instanceof DerivationError);error=cause;}
          assert(error,'422 fixture must exercise the actual title validator');
          return await send({error:error.toJSON()},422);
        }
        validateText(body.title,'requirement.title');validateText(body.statement,'requirement.statement');
        const created={...body,id:`REQ-${projectId}-${state.requirements[projectId].length+1}`};
        state.requirements[projectId].push(created);
        try{return await send(created,201);}catch(error){if(!state.expectAbortedResponse)throw error;}
      }finally{state.completed++;}
    }
    if(url.pathname==='/api/governance/session')return send({identity:null,access:{mode:'LOCAL_DEVELOPMENT',setupRequired:false,productionDeploymentAccepted:false}});
    if(url.pathname==='/api/projects')return send(projects);
    if(!match)return send({});
    const [,id,suffix]=match;
    if(!suffix)return send(projects.find(p=>p.id===id));
    if(suffix==='/requirements')return send(state.requirements[id]||[]);
    if(suffix==='/next-action')return send({id:'NEXT',title:'Synthetic next action',reason:'Fixture',steps:[],blocks:[],blockingItems:[]});
    return send([]);
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByRole('heading',{name:'Draft fixture A',exact:true}).waitFor();
  await page.getByRole('button',{name:/^Requirements(?: |$)/}).click();
  return {page,state,async close(){state.hold?.resolve();await page.close();assert.deepEqual(errors,[],'No browser runtime errors or unhandled promise rejections');}};
}
async function fill(page:Page,values=draft) {
  await page.getByRole('button',{name:'Add Requirement',exact:true}).click();
  await page.getByPlaceholder('e.g. Scoped Tool Execution Sandbox').fill(values.title);
  await page.getByPlaceholder('The system MUST enforce...').fill(values.statement);
  await page.getByPlaceholder('Reasoning for this requirement...').fill(values.rationale);
  await modal(page).locator('select').nth(0).selectOption(values.category);
  await modal(page).locator('select').nth(1).selectOption(values.priority);
}
async function retained(page:Page,values=draft) {
  assert(await modal(page).isVisible(),'Rejected submission must retain the open form');
  assert.equal(await page.getByPlaceholder('e.g. Scoped Tool Execution Sandbox').inputValue(),values.title);
  assert.equal(await page.getByPlaceholder('The system MUST enforce...').inputValue(),values.statement);
  assert.equal(await page.getByPlaceholder('Reasoning for this requirement...').inputValue(),values.rationale);
  assert.equal(await modal(page).locator('select').nth(0).inputValue(),values.category);
  assert.equal(await modal(page).locator('select').nth(1).inputValue(),values.priority);
}
async function submit(page:Page) {await modal(page).getByRole('button',{name:'Save as Proposed Requirement',exact:true}).click();}
async function completed(f:Awaited<ReturnType<typeof setup>>,count=1) {
  const deadline=Date.now()+3000;while(f.state.completed<count && Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
  assert.equal(f.state.completed,count);await settle(f.page);
}
async function select(page:Page,id:string) {
  await page.getByRole('button',{name:'Select project',exact:true}).evaluate(button=>(button as HTMLButtonElement).click());
  await page.getByRole('button',{name:new RegExp(`Draft fixture ${id}`)}).evaluate(button=>(button as HTMLButtonElement).click());
  await page.getByRole('button',{name:'Add Requirement',exact:true}).waitFor();
}
async function test(name:string,run:()=>Promise<void>) {
  try{await run();console.log(`PASS ${name}`);results.push({name,status:'PASS'});}
  catch(error){console.error(`FAIL ${name}:`,error);results.push({name,status:'FAIL',error:String(error)});}
}
try {
  for(const reply of ['422','503','network'] as const)await test(`D${results.length+1} ${reply} rejection retains all draft fields and exposes a retryable error`,async()=>{
    const f=await setup(reply);try{
      await fill(f.page);await submit(f.page);await completed(f);await retained(f.page);
      const error=modal(f.page).getByRole('alert');await error.waitFor();assert((await error.innerText()).trim());
      if(reply==='422')assert.match(await error.innerText(),/Unresolved template or serialization artifact/);
      if(reply==='network')assert.match(await error.innerText(),/confirm whether.*saved.*refresh and check.*before retrying/i);
      assert.equal(f.state.requirements.A.length,0);assert.equal(f.state.posts.length,1);
      assert(!(await modal(f.page).getByRole('button',{name:'Save as Proposed Requirement',exact:true}).isDisabled()));
    }finally{await f.close();}
  });
  await test('D4 same-turn duplicate submits admit one request and freeze the pending draft',async()=>{
    const f=await setup('success');try{
      f.state.hold=deferred();await fill(f.page,{...draft,title:'One synthetic requirement'});
      await modal(f.page).evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
      assert.equal(await f.page.evaluate(()=>(window as any).__requirementPosts.length),1,'Synchronous admission must precede React rerender');
      for(const control of await modal(f.page).locator('input,textarea,select,button').all())assert(await control.isDisabled(),'Pending form and cancel must be disabled');
      f.state.hold.resolve();await completed(f);await modal(f.page).waitFor({state:'detached'});
      assert.equal(f.state.posts.length,1);assert.equal(f.state.requirements.A.length,1);
    }finally{await f.close();}
  });
  await test('D5 successful retry sends the preserved edited draft once and closes only after acknowledgement',async()=>{
    const f=await setup('422');try{
      await fill(f.page);await submit(f.page);await completed(f);await retained(f.page);
      f.state.reply='success';f.state.hold=deferred();
      const corrected={...draft,title:'Confirmed synthetic value'};
      await f.page.getByPlaceholder('e.g. Scoped Tool Execution Sandbox').fill(corrected.title);await submit(f.page);
      await retained(f.page,corrected);assert.equal(await modal(f.page).getByRole('alert').count(),0,'Retry clears the prior error');
      f.state.hold.resolve();await completed(f,2);await modal(f.page).waitFor({state:'detached'});
      await f.page.getByText(corrected.title,{exact:true}).waitFor();assert.equal(f.state.posts.length,2);
      const saved=f.state.requirements.A[0];assert.equal(saved.status,'PROPOSED');assert.equal(saved.category,draft.category);assert.equal(saved.priority,draft.priority);assert.equal(saved.rationale,draft.rationale);
      for(const field of ['riskLinks','threatLinks','standardLinks','workItems','tests','evidence'])assert.deepEqual(saved[field],[]);
      await f.page.getByRole('button',{name:'Add Requirement',exact:true}).click();
      for(const placeholder of ['e.g. Scoped Tool Execution Sandbox','The system MUST enforce...','Reasoning for this requirement...'])assert.equal(await f.page.getByPlaceholder(placeholder).inputValue(),'');
    }finally{await f.close();}
  });
  for(const reply of ['422','success'] as const)await test(`D${results.length+1} late A ${reply} completion cannot clear or fail a new B draft`,async()=>{
    const f=await setup(reply);try{
      f.state.hold=deferred();await fill(f.page,reply==='success'?{...draft,title:'Valid originating project requirement'}:draft);await submit(f.page);
      // Deliberate background navigation exercises the actual App key/remount,
      // without pretending a pointer normally passes through the modal overlay.
      await select(f.page,'B');const other={...draft,title:'New B draft',statement:'Project B statement'};await fill(f.page,other);
      f.state.hold.resolve();await completed(f);await retained(f.page,other);
      assert.equal(await modal(f.page).getByRole('alert').count(),0);assert.equal(f.state.posts[0].projectId,'A');
      assert.equal(f.state.requirements.B.length,0);assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Draft fixture B/);
    }finally{await f.close();}
  });
  await test('D8 rejected completion after view unmount does not affect the replacement form',async()=>{
    const f=await setup('422');try{
      f.state.hold=deferred();await fill(f.page);await submit(f.page);
      await f.page.getByRole('button',{name:/^Home$/}).evaluate(button=>(button as HTMLButtonElement).click());
      await f.page.getByRole('button',{name:/^Requirements(?: |$)/}).click();
      const next={...draft,title:'Replacement form draft'};await fill(f.page,next);
      f.state.hold.resolve();await completed(f);await retained(f.page,next);assert.equal(await modal(f.page).getByRole('alert').count(),0);
    }finally{await f.close();}
  });
  await test('D9 a held request deadline retains the draft, unlocks controls and ignores a late response',async()=>{
    const f=await setup('success');try{
      f.state.hold=deferred();f.state.expectAbortedResponse=true;
      const pending={...draft,title:'Held synthetic requirement'};await fill(f.page,pending);
      // Control the actual browser abort signal instead of waiting 20 wall-clock
      // seconds. The request really stays held at the API transport boundary.
      await f.page.evaluate(()=>(window as any).__captureRequirementDeadline=true);await submit(f.page);
      const deadline=Date.now()+3000;while(!f.state.posts.length && Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
      assert.equal(f.state.posts.length,1);assert.equal(f.state.completed,0);
      assert.deepEqual(await f.page.evaluate(()=>(window as any).__requirementDeadlines.map((d:any)=>d.milliseconds)),[20000],'Creation must declare a bounded 20 second transport deadline');
      await f.page.evaluate(()=>(window as any).__requirementDeadlines[0].controller.abort(new DOMException('Synthetic deadline reached','TimeoutError')));
      const error=modal(f.page).getByRole('alert');await error.waitFor();assert.match(await error.innerText(),/timed out.*confirm whether.*saved.*refresh and check.*before retrying/i);
      await retained(f.page,pending);
      for(const control of await modal(f.page).locator('input,textarea,select,button').all())assert(!(await control.isDisabled()),'Deadline must re-enable every form control including Cancel');
      const edited={...pending,title:'Edited after uncertain outcome'};await f.page.getByPlaceholder('e.g. Scoped Tool Execution Sandbox').fill(edited.title);
      f.state.hold.resolve();await completed(f);await retained(f.page,edited);
      assert.equal(f.state.posts.length,1,'No automatic POST retry');assert.equal(f.state.requirements.A.length,1,'Server may still commit after client cancellation');
      assert.match(await error.innerText(),/confirm whether.*saved/i,'Late response must not clear the uncertain outcome');
      await modal(f.page).getByRole('button',{name:'Cancel',exact:true}).click();
      await f.page.getByRole('button',{name:'Add Requirement',exact:true}).click();await retained(f.page,edited);
    }finally{await f.close();}
  });
  await test('D10 an originating request deadline after project switch cannot fail the new draft',async()=>{
    const f=await setup('success');try{
      f.state.hold=deferred();f.state.expectAbortedResponse=true;
      await fill(f.page,{...draft,title:'Originating held requirement'});
      await f.page.evaluate(()=>(window as any).__captureRequirementDeadline=true);await submit(f.page);
      assert.deepEqual(await f.page.evaluate(()=>(window as any).__requirementDeadlines.map((d:any)=>d.milliseconds)),[20000]);
      await select(f.page,'B');const other={...draft,title:'B draft during A deadline'};await fill(f.page,other);
      await f.page.evaluate(()=>(window as any).__requirementDeadlines[0].controller.abort(new DOMException('Synthetic deadline after switch','TimeoutError')));
      await settle(f.page);await retained(f.page,other);assert.equal(await modal(f.page).getByRole('alert').count(),0);
      f.state.hold.resolve();await completed(f);await retained(f.page,other);assert.equal(await modal(f.page).getByRole('alert').count(),0);
      assert.equal(f.state.posts.length,1);assert.equal(f.state.posts[0].projectId,'A');assert.equal(f.state.requirements.B.length,0);
    }finally{await f.close();}
  });
} finally {
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  await browser.close();await vite.close();
}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,skipped:0}));
process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
