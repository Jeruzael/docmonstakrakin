import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium, type Page, type Route} from 'playwright';
import {createServer} from 'vite';
import {INITIAL_PROJECTS, INITIAL_WORK_ITEMS} from '../src/data/initialData.ts';
import {createPortablePackage} from '../server/package/portablePackage.ts';
import {startPackageFixture} from './fixtures/projectsWorkspaceUiServer.ts';
import {getCanonicalWbsHierarchy} from '../server/workTracking/canonicalWbs.ts';
import {
  generateReconciliationPlan,
  projectSelfWorkItemReconciliation,
} from '../server/workTracking/selfWorkItemReconciliation.ts';
import {readProjectSnapshot} from '../server/projectPersistence.ts';
import {ProjectStore} from '../server/projectStore.ts';

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
const projects=[
  ...['A','B','C'].map(id=>({...structuredClone(INITIAL_PROJECTS[0]),id,name:`Fixture ${id}`})),
  {...structuredClone(INITIAL_PROJECTS[0]),id:'PRJ-DOCMONSTAKRAKIN',name:'docmonstakrakin'},
];
const req=(id:string)=>({id:`REQ-${id}`,title:`Requirement ${id}`,statement:'Synthetic requirement',category:'SECURITY',priority:'HIGH',status:'PROPOSED',source:{type:'stakeholder',id:'fixture'},riskLinks:[],threatLinks:[],standardLinks:[],workItems:[],tests:[],evidence:[]});
const questions=[1,2,3].map(n=>({id:`Q-${n}`,question:`Synthetic question ${n}`,category:'security',domain:'SECURITY',answerType:'FREE_TEXT',state:'UNRESOLVED',importance:'OPTIONAL',contextReason:'Fixture only',standards:[],appliesTo:['WEB_APPLICATION'],derivationRules:[]}));
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function setup(empty=false) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(6000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const state={projects:empty?[]:structuredClone(projects),requirements:{A:[req('A')],B:[req('B')],C:[req('C')],'PRJ-DOCMONSTAKRAKIN':[req('PRJ-DOCMONSTAKRAKIN')]} as Record<string,any[]>,questions:structuredClone(questions),posts:[] as string[],held:new Map<string,ReturnType<typeof deferred>>(),fail:new Set<string>(),reject:false,reads:[] as string[]};
  // Simulate a transport that ignores aborts so late results really reach the loader.
  const workItems = structuredClone(INITIAL_WORK_ITEMS.slice(0,1));
  const localSnap = readProjectSnapshot(root);
  const manifestPath = path.join(root, 'bootstrap/docmonstakrakin.self-bootstrap.json');
  const manifestWorkItems = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).workItems ?? []
    : [];
  const selfWorkItems = (localSnap?.state?.workItems?.['PRJ-DOCMONSTAKRAKIN']?.length)
    ? structuredClone(localSnap.state.workItems['PRJ-DOCMONSTAKRAKIN'])
    : structuredClone(manifestWorkItems);
  await page.addInitScript(()=>{const original=window.fetch;window.fetch=(url,options)=>original(url,options?{...options,signal:undefined}:options);});
  await page.route('**/api/**',async(route:Route)=>{
    const url=new URL(route.request().url()).pathname;const method=route.request().method();
    const send=async(body:unknown,status=200)=>{await route.fulfill({status,json:body}).catch(()=>{});};
    if(method==='POST') {
      state.posts.push(url);const body=route.request().postDataJSON();
      if(url.endsWith('/work-items')) {
        if(state.reject)return send({error:'Fixture rejected work update'},403);
        const isSelf = url.includes('PRJ-DOCMONSTAKRAKIN');
        const targetList = isSelf ? selfWorkItems : workItems;
        const targetItem = targetList.find((w: any) => w.id === body.itemId) || targetList[0];
        if(body.status && targetItem) targetItem.status = body.status;
        if(body.checklistIndex!==undefined && targetItem?.checklist?.[body.checklistIndex]) {
          targetItem.checklist[body.checklistIndex].done=body.checklistDone;
        }
        return send(targetItem || workItems[0]);
      }
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
    if(suffix==='/work-items') {
      if(id==='PRJ-DOCMONSTAKRAKIN')return send(selfWorkItems);
      return send(workItems);
    }
    if(suffix==='/wbs') {
      if(id==='PRJ-DOCMONSTAKRAKIN') {
        const hierarchy=getCanonicalWbsHierarchy(root);
        return send({
          supported:true,
          canonicalSource:'MASTER_WBS.yaml',
          wbsDigest:hierarchy.wbsSha256,
          phases:hierarchy.phases,
          items:hierarchy.items,
        });
      }
      return send({supported:false,phases:[],items:[]});
    }
    if(suffix==='/work-items/reconciliation') {
      if(id==='PRJ-DOCMONSTAKRAKIN') {
        let plan;
        if (localSnap?.state?.workItems?.['PRJ-DOCMONSTAKRAKIN']?.length) {
          plan = generateReconciliationPlan({
            workspaceRoot: root,
            projectId: 'PRJ-DOCMONSTAKRAKIN',
            actor: 'Work Management Viewer',
          });
        } else {
          const synthSnap = structuredClone(localSnap || { schemaVersion: 1, state: new ProjectStore() });
          if (!synthSnap.state) synthSnap.state = new ProjectStore();
          synthSnap.state.projects = synthSnap.state.projects || [projects[3]];
          if (!synthSnap.state.projects.some((p: any) => p.id === 'PRJ-DOCMONSTAKRAKIN')) {
            synthSnap.state.projects.push(projects[3]);
          }
          synthSnap.state.workItems = synthSnap.state.workItems || {};
          synthSnap.state.workItems['PRJ-DOCMONSTAKRAKIN'] = selfWorkItems;
          const { plan: projectedPlan } = projectSelfWorkItemReconciliation({
            workspaceRoot: root,
            snapshotBytes: Buffer.from(JSON.stringify(synthSnap)),
            actor: 'Work Management Viewer',
            timestamp: new Date().toISOString(),
          });
          plan = projectedPlan;
        }
        return send({
          supported:true,
          summary:plan.summary,
          rows:plan.rows,
        });
      }
      return send({supported:false,summary:null,rows:[]});
    }
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
  await test('W1 rejected WorkItem status and checklist retain canonical drawer values',async()=>{
    const f=await setup();try{await f.start();await f.page.getByRole('button',{name:/^Work Management/}).click();
      await f.page.getByText(INITIAL_WORK_ITEMS[0].title,{exact:true}).first().click();
      const select=f.page.locator('select').last();const before=await select.inputValue();
      f.state.reject=true;await select.selectOption('VERIFIED');
      await f.page.getByRole('alert').filter({hasText:'Fixture rejected work update'}).waitFor();assert.equal(await select.inputValue(),before);
      const check=f.page.getByRole('checkbox').first();const checked=await check.isChecked();await check.click();
      await f.page.getByRole('alert').filter({hasText:'Fixture rejected work update'}).waitFor();assert.equal(await check.isChecked(),checked);
      f.state.reject=false;await select.selectOption('IN_PROGRESS');
      await f.page.waitForFunction(()=>document.querySelector('select')?.value==='IN_PROGRESS');
      assert.equal(await f.page.locator('h2').filter({hasText:INITIAL_WORK_ITEMS[0].title}).count(),1);
      await check.click();await f.page.waitForFunction(expected=>(document.querySelector('input[type=checkbox]') as HTMLInputElement)?.checked===expected,!checked);
      assert.equal(await check.isChecked(),!checked);
    }finally{await f.close();}
  });
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
  await test('R1 query parameter ?project=PRJ-DOCMONSTAKRAKIN restores docmonstakrakin on startup and survives reload',async()=>{
    const f=await setup();try{
      await f.page.goto(`${base}?project=PRJ-DOCMONSTAKRAKIN`,{waitUntil:'domcontentloaded'});
      await f.page.getByRole('heading',{name:'docmonstakrakin',exact:true}).waitFor();
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/docmonstakrakin/);
      assert(f.page.url().includes('project=PRJ-DOCMONSTAKRAKIN'));
      await f.page.reload({waitUntil:'domcontentloaded'});
      await f.page.getByRole('heading',{name:'docmonstakrakin',exact:true}).waitFor();
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/docmonstakrakin/);
      assert(f.page.url().includes('project=PRJ-DOCMONSTAKRAKIN'));
    }finally{await f.close();}
  });
  await test('R2 selecting Project B synchronizes URL query param, survives reload, and survives canonical refresh',async()=>{
    const f=await setup();try{
      await f.start();
      await select(f.page,'B');
      await f.page.getByRole('heading',{name:'Fixture B',exact:true}).waitFor();
      assert(f.page.url().includes('project=B'));
      await f.page.reload({waitUntil:'domcontentloaded'});
      await f.page.getByRole('heading',{name:'Fixture B',exact:true}).waitFor();
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Fixture B/);
      assert(f.page.url().includes('project=B'));
      // Canonical refresh keeps Project B
      const gate=deferred();f.state.held.set('B',gate);
      await f.page.getByRole('button',{name:'Select project',exact:true}).click();
      await f.page.getByRole('button',{name:/Fixture B/}).click();
      await f.page.getByText('Refreshing selected project…',{exact:true}).waitFor();
      gate.resolve();
      await f.page.getByRole('heading',{name:'Fixture B',exact:true}).waitFor();
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Fixture B/);
      assert(f.page.url().includes('project=B'));
    }finally{await f.close();}
  });
  await test('R3 browser back and forward navigation deterministically updates active project without full navigation',async()=>{
    const f=await setup();try{
      await f.start();
      await select(f.page,'B');
      await f.page.getByRole('heading',{name:'Fixture B',exact:true}).waitFor();
      assert(f.page.url().includes('project=B'));
      await select(f.page,'C');
      await f.page.getByRole('heading',{name:'Fixture C',exact:true}).waitFor();
      assert(f.page.url().includes('project=C'));
      await f.page.goBack();
      await f.page.getByRole('heading',{name:'Fixture B',exact:true}).waitFor();
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Fixture B/);
      assert(f.page.url().includes('project=B'));
      await f.page.goBack();
      await f.page.getByRole('heading',{name:'Fixture A',exact:true}).waitFor();
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Fixture A/);
      await f.page.goForward();
      await f.page.getByRole('heading',{name:'Fixture B',exact:true}).waitFor();
      assert.match(await f.page.getByRole('button',{name:'Select project',exact:true}).innerText(),/Fixture B/);
      assert(f.page.url().includes('project=B'));
    }finally{await f.close();}
  });
  await test('V1 PRJ-DOCMONSTAKRAKIN pre-sync canonical status ownership, full-WBS badges, and canonical drawer',async()=>{
    const f=await setup();try{
      await f.page.goto(`${base}?project=PRJ-DOCMONSTAKRAKIN`,{waitUntil:'domcontentloaded'});
      await f.page.getByRole('heading',{name:'docmonstakrakin',exact:true}).waitFor();

      // Navigate to Work Management
      await f.page.getByRole('button',{name:/^Work Management/}).click();

      // 12. Reconciliation counts remain 24 canonical, 13 runtime, 9 blocked, with active drift tracking
      await f.page.getByText('24 operational items').waitFor();
      await f.page.getByText('13 WorkItems').waitFor();
      await f.page.getByText(/\d+ missing/).waitFor();
      await f.page.getByText(/\d+ status drift/).waitFor();
      await f.page.getByText(/\d+ metadata drift/).waitFor();
      await f.page.getByText('9 blocked').waitFor();

      // 1. DMK-192 runtime status selector disabled BEFORE reconciliation
      await f.page.getByText('Trusted Self-Bootstrap Executor').first().click();
      const statusSelect = f.page.locator('select').last();
      assert.equal(await statusSelect.isDisabled(), true, 'DMK-192 status selector must be disabled before sync');

      // 2. Disabled reason references canonical WBS authority
      await f.page.getByText('Status is owned by the canonical repository WBS').waitFor();
      await f.page.getByText('Runtime currently differs from canonical state and must be reconciled').waitFor();

      // 3. Checklist remains enabled
      const checklistCheckbox = f.page.getByRole('checkbox').first();
      assert.equal(await checklistCheckbox.isDisabled(), false, 'Checklist checkbox must remain enabled');

      // Close runtime drawer (click close button with X)
      await f.page.locator('button:has(svg.lucide-x)').click();

      // Switch to WBS tab
      await f.page.getByRole('button',{name:'WBS'}).click();
      await f.page.getByText('Canonical Projection: MASTER_WBS.yaml').waitFor();

      // 9. EPIC-13 DMK-205 displays MISSING_RUNTIME
      const dmk205Row = f.page.locator('.divide-y > div').filter({hasText:'DMK-205'}).first();
      await dmk205Row.waitFor();
      assert.ok((await dmk205Row.innerText()).includes('MISSING_RUNTIME'), 'DMK-205 row must display MISSING_RUNTIME');

      // 10. EPIC-01 DMK-001 displays CANONICAL ONLY, not MISSING_RUNTIME
      const dmk001Row = f.page.locator('.divide-y > div').filter({hasText:'DMK-001'}).first();
      await dmk001Row.waitFor();
      const dmk001Text = await dmk001Row.innerText();
      assert.ok(dmk001Text.includes('CANONICAL ONLY'), 'DMK-001 row must display CANONICAL ONLY');
      assert.ok(!dmk001Text.includes('MISSING_RUNTIME'), 'DMK-001 row must NOT display MISSING_RUNTIME');

      // 11. EPIC-16/17 items display CANONICAL ONLY
      const epic16Header = f.page.locator('div').filter({hasText:'EPIC-16 Scope'}).first();
      await epic16Header.waitFor();
      const epic16Parent = f.page.locator('div.border.border-slate-200').filter({hasText:'EPIC-16 Scope'}).first();
      assert.ok((await epic16Parent.innerText()).includes('CANONICAL ONLY'), 'EPIC-16 items must display CANONICAL ONLY');

      // 4. DMK-205 canonical row is clickable
      // 5. Clicking DMK-205 opens canonical read-only drawer
      await dmk205Row.click();

      // 6. Canonical drawer displays VERIFICATION_PENDING
      // 7. Canonical drawer displays Runtime: MISSING
      // 8. Canonical drawer contains no editable status control
      const cDrawer = f.page.locator('.fixed.inset-y-0.right-0');
      await cDrawer.getByText('Canonical Record').waitFor();
      await cDrawer.getByRole('heading',{name:'Canonical WBS → Runtime WorkItem Synchronization'}).waitFor();
      await cDrawer.getByText('VERIFICATION_PENDING',{exact:true}).waitFor();
      await cDrawer.getByText('Runtime Status').waitFor();
      await cDrawer.getByText('MISSING',{exact:true}).waitFor();
      await cDrawer.getByText('13.06.18').waitFor();
      await cDrawer.getByText('Canonical repository record. Runtime WorkItem has not yet been projected.').waitFor();
      assert.equal(await cDrawer.locator('select').count(), 0, 'Canonical drawer must contain NO status select dropdown');
      assert.equal(await cDrawer.locator('input[type="checkbox"]').count(), 0, 'Canonical drawer must contain NO checklist checkboxes');

      // Close canonical drawer
      await cDrawer.locator('button:has(svg.lucide-x)').click();

      // 13. When blocked > 0, review modal displays live reconciliation BLOCKED copy
      await f.page.getByRole('button',{name:'Review Reconciliation'}).click();
      await f.page.getByRole('heading',{name:'Canonical WBS Reconciliation Review'}).waitFor();
      await f.page.getByText('Live reconciliation is currently BLOCKED. Nine canonical VERIFIED items lack sufficient completed human governance provenance. No reconciliation plan may be applied while blocked items remain. No direct writes occur from this preview.').waitFor();

      // Close modal
      await f.page.getByRole('button',{name:'Close Preview'}).click();

      // 14. Switching to PRJ-ATLAS-01 removes self-project reconciliation UI
      await select(f.page,'A');
      await f.page.getByRole('button',{name:'Select project',exact:true}).filter({hasText:'Fixture A'}).waitFor();
      assert.equal(await f.page.getByText('24 operational items').count(), 0, 'Reconciliation banner must disappear for non-self project');
      assert.equal(await f.page.getByText('Review Reconciliation').count(), 0, 'Review button must disappear for non-self project');

      // 15. Switching back reloads canonical/reconciliation state
      await f.page.getByRole('button',{name:'Select project',exact:true}).click();
      await f.page.getByRole('button',{name:/docmonstakrakin/}).first().click();
      await f.page.getByRole('button',{name:'Select project',exact:true}).filter({hasText:'docmonstakrakin'}).waitFor();
      await f.page.getByText('24 operational items').waitFor();
      await f.page.getByText('Review Reconciliation').waitFor();

      // 16. No browser console errors
      assert.deepEqual(f.errors, [], 'No browser runtime errors');
    }finally{await f.close();}
  });
} finally {await browser.close();await vite.close();}
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:'Chromium',passed,failed,results},null,2));
console.log(`Projects workspace UI: ${passed} passed, ${failed} failed.`);process.exitCode=failed?1:0;





