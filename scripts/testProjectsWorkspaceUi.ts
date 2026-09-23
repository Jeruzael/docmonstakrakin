import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium, type Page, type Route} from 'playwright';
import {createServer} from 'vite';
import {INITIAL_PROJECTS} from '../src/data/initialData.ts';
import {createPortablePackage} from '../server/package/portablePackage.ts';
import {startPackageFixture} from './fixtures/projectsWorkspaceUiServer.ts';

// Real App, real React children and CSS. Only the API boundary is controlled.
// Vite serves source only; this harness never connects to the operator's server.
const root=process.cwd();
const vite=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});
await vite.listen();
const base=vite.resolvedUrls!.local[0];
const executable=process.env.DMK_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
const output=path.resolve('runtime/dmk-194-remediation/ui');fs.mkdirSync(output,{recursive:true});
let passed=0,failed=0;
const results:{name:string;status:string;error?:string}[]=[];
const projects=['A','B','C'].map(id=>({...structuredClone(INITIAL_PROJECTS[0]),id,name:`Fixture ${id}`}));
const req=(id:string)=>({id:`REQ-${id}`,title:`Requirement ${id}`,statement:'Synthetic requirement',category:'SECURITY',priority:'HIGH',status:'PROPOSED',source:{type:'stakeholder',id:'fixture'},riskLinks:[],threatLinks:[],standardLinks:[],workItems:[],tests:[],evidence:[]});
const questions=[1,2,3].map(n=>({id:`Q-${n}`,question:`Synthetic question ${n}`,category:'security',domain:'SECURITY',answerType:'FREE_TEXT',state:'UNRESOLVED',importance:'OPTIONAL',contextReason:'Fixture only',standards:[],appliesTo:['WEB_APPLICATION'],derivationRules:[]}));
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function setup(empty=false) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(6000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const state={projects:empty?[]:structuredClone(projects),requirements:{A:[req('A')],B:[req('B')],C:[req('C')]} as Record<string,any[]>,questions:structuredClone(questions),posts:[] as string[],held:new Map<string,ReturnType<typeof deferred>>(),fail:new Set<string>(),reject:false,reads:[] as string[]};
  // Simulate a transport that ignores aborts so late results really reach the loader.
  await page.addInitScript(()=>{const original=window.fetch;window.fetch=(url,options)=>original(url,options?{...options,signal:undefined}:options);});
  await page.route('**/api/**',async(route:Route)=>{
    const url=new URL(route.request().url()).pathname;const method=route.request().method();
    const send=async(body:unknown,status=200)=>{await route.fulfill({status,json:body}).catch(()=>{});};
    if(method==='POST') {
      state.posts.push(url);const body=route.request().postDataJSON();
      if(url.endsWith('/status')) {if(state.reject)return send({error:'Fixture rejected transition'},403);state.requirements.A[0].status='UNDER_REVIEW';return send({requirement:state.requirements.A[0]});}
      if(url.endsWith('/answers')) {const q=state.questions.find(q=>q.id===body.questionId)!;Object.assign(q,{answer:body.answer,state:'ANSWERED'});return send({ok:true});}
      return send({error:'Unexpected mutation'},400);
    }
    if(url==='/api/governance/session')return send({identity:null});
    if(url==='/api/projects')return send(state.projects);
    const match=url.match(/^\/api\/projects\/([^/]+)(.*)$/);
    if(!match)return send({});
    const [,id,suffix]=match;state.reads.push(url);
    const gate=state.held.get(id);if(gate)await gate.promise;
    if(state.fail.has(id))return send({error:'Fixture load failed'},503);
    if(!suffix)return send(state.projects.find(p=>p.id===id));
    if(suffix==='/requirements')return send(state.requirements[id]||[]);
    if(suffix==='/questions')return send(state.questions);
    if(suffix==='/next-action')return send({id:'NEXT',title:'Fixture next action',reason:'Fixture',steps:[],blocks:[],blockingItems:[]});
    return send([]);
  });
  return {page,state,errors,async start(){await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});if(!empty)await page.getByRole('heading',{name:'Fixture A',exact:true}).waitFor();},async close(){for(const h of state.held.values())h.resolve();await page.close();assert.deepEqual(errors,[],'No browser runtime errors');}};
}
async function drawer(page:Page) {
  await page.getByRole('button',{name:/^Requirements(?: |$)/}).click();
  await page.getByPlaceholder('Search by ID, title, keyword...').fill('Requirement');
  await page.locator('select').nth(1).selectOption('SECURITY');
  await page.getByText('Requirement A',{exact:true}).click();
  await page.getByRole('button',{name:'Overview & Governance'}).click();
  await page.getByText('Requirement Governance Actions:',{exact:true}).waitFor();
}
async function preserved(page:Page) {
  await page.locator('h2').filter({hasText:'Requirement A'}).waitFor();
  assert.equal(await page.getByPlaceholder('Search by ID, title, keyword...').inputValue(),'Requirement');
  assert.equal(await page.locator('select').nth(1).inputValue(),'SECURITY');
  await page.getByText('Requirement Governance Actions:',{exact:true}).waitFor();
}
async function select(page:Page,id:string){await page.getByRole('button',{name:'Select project',exact:true}).click();await page.getByRole('button',{name:new RegExp(`Fixture ${id}`)}).click();}
async function test(name:string,run:()=>Promise<void>){if(process.env.DMK_UI_CASE && !name.startsWith(process.env.DMK_UI_CASE))return;try{await run();console.log(`PASS ${name}`);results.push({name,status:'PASS'});passed++;}catch(e){console.error(`FAIL ${name}:`,e);results.push({name,status:'FAIL',error:String(e)});failed++;for(const p of browser.contexts().flatMap(c=>c.pages()))await p.screenshot({path:path.join(output,`${name.slice(0,2)}-failure.png`)}).catch(()=>{});}}
try {
  await test('A1 row-opened drawer, filter and governance tab survive delayed canonical refresh',async()=>{
    const f=await setup();try{await f.start();await drawer(f.page);const gate=deferred();f.state.held.set('A',gate);
      await f.page.getByRole('button',{name:'Mark Under Review',exact:true}).click();
      await f.page.waitForFunction(()=>document.querySelector('header')?.textContent?.match(/Loading|Refreshing/));
      assert.equal(await f.page.locator('h2').filter({hasText:'Requirement A'}).count(),1,'same-project refresh must retain the drawer DOM');
      await f.page.getByText('Refreshing selected project…',{exact:true}).waitFor();
      assert(await f.page.getByRole('button',{name:'Mark Under Review',exact:true}).evaluate(el=>!!el.closest('[inert]')),'refresh actions must be inert');
      await f.page.screenshot({path:path.join(output,'refresh.png')});
      gate.resolve();await preserved(f.page);await f.page.getByRole('button',{name:'Mark Under Review',exact:true}).waitFor({state:'detached'});
      assert((await f.page.locator('main').textContent())!.includes('UNDER_REVIEW'));
    }finally{await f.close();}
  });
  await test('A2 rejected status leaves canonical status and visible error in the same drawer',async()=>{
    const f=await setup();try{await f.start();await drawer(f.page);f.state.reject=true;await f.page.getByRole('button',{name:'Approve Requirement',exact:true}).click();await f.page.getByText('Fixture rejected transition',{exact:true}).waitFor();await preserved(f.page);assert((await f.page.locator('main').textContent())!.includes('PROPOSED'));assert.equal(f.state.posts.length,1);}finally{await f.close();}
  });
  await test('A3 later question and selected domain survive answer refresh',async()=>{
    const f=await setup();try{await f.start();await f.page.getByRole('button',{name:/^Requirements(?: |$)/}).click();await f.page.getByRole('button',{name:/Adaptive Discovery Questionnaire/}).click();
      await f.page.getByRole('button',{name:/Security.*0\/3/}).click();await f.page.getByRole('button',{name:'Next Question'}).click();
      await f.page.getByRole('heading',{name:'Synthetic question 2',exact:true}).waitFor();await f.page.getByPlaceholder('Type statement here...').fill('Synthetic saved answer');
      await f.page.getByRole('button',{name:'Save Statement',exact:true}).click();await f.page.waitForFunction(()=>!document.querySelector('header')?.textContent?.match(/Loading|Refreshing/));
      await f.page.getByRole('heading',{name:'Synthetic question 2',exact:true}).waitFor();assert.match(await f.page.getByRole('button',{name:/Security.*1\/3/}).getAttribute('class')||'',/bg-emerald-700/);
      // A legitimate filter change may remove the answered question.
      await f.page.getByRole('button',{name:'Unresolved',exact:true}).click();await f.page.getByRole('heading',{name:'Synthetic question 3',exact:true}).waitFor();
    }finally{await f.close();}
  });
  await test('A4 refresh failure hides stale drawer; keyboard retry preserves state without repost',async()=>{
    const f=await setup();try{await f.start();await drawer(f.page);f.state.fail.add('A');await f.page.getByRole('button',{name:'Mark Under Review',exact:true}).click();
      const retry=f.page.getByRole('button',{name:'Retry selected project'});await retry.waitFor();
      assert.equal(await f.page.locator('h2').filter({hasText:'Requirement A'}).count(),1,'failed refresh retains mounted drawer');
      assert(!(await f.page.locator('h2').filter({hasText:'Requirement A'}).isVisible()),'stale drawer is hidden');
      await f.page.screenshot({path:path.join(output,'refresh-error.png')});
      f.state.fail.clear();await retry.focus();await f.page.keyboard.press('Enter');await preserved(f.page);assert.equal(f.state.posts.length,1);
    }finally{await f.close();}
  });
  await test('A5 switch during refresh rejects late A/B payloads and clears previous drawer',async()=>{
    for(const failedId of ['A','B']) {const f=await setup();try{await f.start();await drawer(f.page);const a=deferred(),b=deferred();f.state.held.set('A',a);f.state.held.set('B',b);
      await f.page.getByRole('button',{name:'Mark Under Review',exact:true}).click();await f.page.waitForFunction(()=>document.querySelector('header')?.textContent?.match(/Loading|Refreshing/));
      await select(f.page,'B');await select(f.page,'C');await f.page.getByText('Requirement C',{exact:true}).waitFor();
      f.state.fail.add(failedId);a.resolve();b.resolve();await f.page.waitForTimeout(100);
      assert.equal(await f.page.locator('h2').filter({hasText:'Requirement A'}).count(),0);assert(!(await f.page.getByRole('button',{name:'Retry selected project'}).count()));
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Fixture C/);
      assert.equal(await f.page.getByPlaceholder('Search by ID, title, keyword...').inputValue(),'');
    }finally{await f.close();}}
  });
  await test('B1 empty workspace exposes keyboard import without creation or export',async()=>{
    const f=await setup(true);try{await f.start();await f.page.getByText('Zero Projects Registered',{exact:true}).waitFor();
      const open=f.page.getByRole('button',{name:'Import package',exact:true});assert.equal(await open.count(),1,'empty workspace must expose global import');
      await open.focus();await f.page.keyboard.press('Enter');await f.page.locator('#portable-package-modal input[type=file]').waitFor({state:'attached'});
      await f.page.getByRole('button',{name:'Choose package file',exact:true}).focus();assert(await f.page.getByRole('button',{name:'Choose package file',exact:true}).evaluate(el=>el===document.activeElement));
      await f.page.screenshot({path:path.join(output,'empty-import.png')});
      assert(await f.page.getByRole('button',{name:'Export Sealed Package',exact:true}).isDisabled());assert.deepEqual(f.state.posts,[]);assert(!f.state.reads.some(p=>p.includes('/package/export')));
    }finally{await f.close();}
  });
  await test('B2 valid package imports, selects and persists; B5 invalid/conflict requests preserve snapshot',async()=>{
    const fixture=await startPackageFixture();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(8000);
    const requests:string[]=[];
    await page.route('**/api/**',async route=>{const url=new URL(route.request().url());requests.push(route.request().method()+' '+url.pathname);const response=await route.fetch({url:fixture.base+url.pathname+url.search});await route.fulfill({response});});
    try{await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByText('Zero Projects Registered',{exact:true}).waitFor();
      const open=page.getByRole('button',{name:'Import package',exact:true});assert.equal(await open.count(),1,'import available before first project');await open.click();
      const upload=page.locator('#portable-package-modal input[type=file]');const before=fixture.bytes();
      await upload.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"invalid":true}')});
      await page.getByText('Cryptographic Seal Verification Failed',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Restore Project into Control Plane'}).count(),0);assert.deepEqual(fixture.bytes(),before);
      const invalid=await fetch(fixture.base+'/api/projects/package/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package:{invalid:true}})});assert.equal(invalid.status,400);assert.deepEqual(fixture.bytes(),before);
      const pkg=createPortablePackage({project:{...projects[0],id:'PRJ-UI-A'},requirements:[req('A') as any],actor:'Synthetic UI fixture'});
      await upload.setInputFiles({name:'valid.docmonstakrakin',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});
      await page.getByText('Cryptographic Seal Verified',{exact:true}).waitFor();await page.getByRole('button',{name:'Restore Project into Control Plane'}).click();
      await page.getByRole('heading',{name:'Fixture A',exact:true}).waitFor();assert.match(await page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Fixture A/);
      assert.equal(fixture.reopen().state.projects[0].id,'PRJ-UI-A','reopened persisted snapshot contains imported project');assert.deepEqual(fixture.reopen().state.approvals['PRJ-UI-A'],[],'import grants no local signoff');
      assert(!requests.includes('POST /api/projects'));assert(!requests.some(p=>p.includes('/package/export')));
      const persisted=fixture.bytes();await open.click();await upload.setInputFiles({name:'existing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});await page.getByText('Cryptographic Seal Verified',{exact:true}).waitFor();await page.getByRole('button',{name:'Restore Project into Control Plane'}).click();
      await page.getByText(/Project already exists/).waitFor();assert.deepEqual(fixture.bytes(),persisted,'conflict without overwrite consent is mutation-free');
      await page.getByRole('button',{name:'Close dialog',exact:true}).click();await drawer(page);
      await open.click();await upload.setInputFiles({name:'replacement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});await page.getByText('Cryptographic Seal Verified',{exact:true}).waitFor();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Restore Project into Control Plane'}).click();
      await page.locator('#portable-package-modal').waitFor({state:'detached'});await page.getByText('Requirement A',{exact:true}).waitFor();assert.equal(await page.locator('h2').filter({hasText:'Requirement A'}).count(),0,'explicit overwrite resets drawer despite same project ID');assert.equal(await page.getByPlaceholder('Search by ID, title, keyword...').inputValue(),'');
    }finally{await page.close();await fixture.close();}
  });
  await test('B3 failed selection retains import while export is unavailable',async()=>{
    const f=await setup();try{f.state.fail.add('A');await f.page.goto(base,{waitUntil:'domcontentloaded'});await f.page.getByRole('button',{name:'Retry selected project'}).waitFor();
      const open=f.page.getByRole('button',{name:'Import package',exact:true});assert.equal(await open.count(),1,'failed selection must not remove global importer');await open.click();assert(await f.page.getByRole('button',{name:'Export Sealed Package',exact:true}).isDisabled());assert.equal(await f.page.getByRole('button',{name:'Download .docmonstakrakin Package'}).count(),0);
    }finally{await f.close();}
  });
  await test('B4 export uses ready exact ID; switching and refreshing forbid stale export',async()=>{
    const f=await setup();try{await f.start();await f.page.locator('#topbar-package-btn').click();await f.page.getByRole('button',{name:'Download .docmonstakrakin Package'}).click();await f.page.waitForTimeout(100);assert.equal(f.state.reads.filter(p=>p.endsWith('/package/export')).join(','),'/api/projects/A/package/export');await f.page.getByRole('button',{name:'Close dialog',exact:true}).click();
      const gate=deferred();f.state.held.set('B',gate);await select(f.page,'B');await f.page.getByRole('button',{name:'Import package',exact:true}).click();assert(await f.page.getByRole('button',{name:'Export Sealed Package',exact:true}).isDisabled());assert.equal(await f.page.getByRole('button',{name:'Download .docmonstakrakin Package'}).count(),0);gate.resolve();await f.page.getByRole('button',{name:'Export Sealed Package',exact:true}).waitFor();
      await f.page.waitForFunction(()=>!(document.querySelector('#portable-package-modal button') as HTMLButtonElement)?.disabled && !document.querySelector('header')?.textContent?.includes('Loading'));
      await f.page.getByRole('button',{name:'Export Sealed Package',exact:true}).click();await f.page.getByRole('button',{name:'Download .docmonstakrakin Package'}).click();await f.page.waitForTimeout(100);assert.deepEqual(f.state.reads.filter(p=>p.endsWith('/package/export')),['/api/projects/A/package/export','/api/projects/B/package/export']);
      await f.page.getByRole('button',{name:'Close dialog',exact:true}).click();await select(f.page,'A');await drawer(f.page);const a=deferred();f.state.held.set('A',a);await f.page.getByRole('button',{name:'Mark Under Review',exact:true}).click();await f.page.getByText('Refreshing selected project…',{exact:true}).waitFor();await f.page.getByRole('button',{name:'Import package',exact:true}).click();assert(await f.page.getByRole('button',{name:'Export Sealed Package',exact:true}).isDisabled());assert.equal(await f.page.getByRole('button',{name:'Download .docmonstakrakin Package'}).count(),0);a.resolve();
    }finally{await f.close();}
  });
} finally {await browser.close();await vite.close();}
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:'Chromium',passed,failed,results},null,2));
console.log(`Projects workspace UI: ${passed} passed, ${failed} failed.`);process.exitCode=failed?1:0;





