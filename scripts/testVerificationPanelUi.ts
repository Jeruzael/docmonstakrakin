import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {startIsolatedVite} from './fixtures/isolatedVite.ts';

// Run the inexpensive missing-feature RED before starting a browser.
assert.ok(fs.existsSync(new URL('../src/components/VerificationPanel.tsx',import.meta.url)), 'VerificationPanel must exist');
const vite=await startIsolatedVite(process.cwd());
const executable=process.env.DMK_TEST_BROWSER||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try {
 browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
 const page=await browser.newPage();
 const identity={identityId:'author',username:'Author',personId:'person-author',roles:['Security Officer'],kind:'HUMAN',roleSource:'LOCAL_SERVER_ROSTER',personBindingSource:'LOCAL_ROSTER_ASSERTION'};
 const state={version:1,sessions:[] as any[],fail:false,stale:false,posts:[] as string[],holdA:false,release:()=>{}};
 let gate:Promise<void>|undefined;
 await page.addInitScript(()=>{const original=window.fetch;window.fetch=(url,options)=>original(url,options?{...options,signal:undefined}:options);});
 await page.route('**/api/projects/*/verification-sessions**',async route=>{
  const req=route.request();const url=new URL(req.url());const project=url.pathname.split('/')[3];
  if(project==='A'&&state.holdA)await gate;
  if(state.fail)return route.fulfill({status:503,json:{error:'Fixture unavailable'}});
  if(req.method()==='GET') {
   if(/\/verification-sessions\/[^/]+$/.test(url.pathname))return route.fulfill({json:{session:state.sessions[0],review:{sessionId:state.sessions[0].id,eligible:false,reason:'Awaiting review'},stateVersion:state.version,identity,requiredRoles:['Security Officer','Lead Architect']}});
   const summaries=state.sessions.map(session=>{const bound=session.submitted?.bundle??session.draft;return {id:session.id,projectId:session.projectId,workItemId:session.workItemId,status:session.status,author:session.author,commitSha:bound.commitSha,buildRevision:bound.buildRevision,environment:bound.environment,evidenceCount:bound.evidence.length,criterionCount:1};});
   return route.fulfill({json:{sessions:project==='A'?summaries:[],reviews:[],stateVersion:state.version,identity,requiredRoles:['Security Officer','Lead Architect']}});
  }
  state.posts.push(url.pathname);if(state.stale)return route.fulfill({status:409,json:{error:'PROJECT_STATE_STALE'}});
  const input=req.postDataJSON();assert.deepEqual(input.expectedReviewer,{identityId:identity.identityId,personId:identity.personId},'mutation binds confirmations to observed principal');let session:any;
  if(url.pathname.endsWith('/submit')){session=state.sessions[0];session.status='SUBMITTED';session.submitted={digest:'d'.repeat(64),bundle:{...session.draft,acceptanceCriteria:['Fixture criterion'],author:session.author}};}
  else if(url.pathname.endsWith('/decisions')){assert.deepEqual(Object.keys(input).sort(),['buildRevision','commitSha','decision','environment','expectedReviewer','expectedStateVersion','humanAttested','independenceAttested','reason','role','submittedDigest'].sort(),'review submits only the exact API decision contract');session=state.sessions[0];session.status=input.decision==='REJECT'?'REJECTED':'REMEDIATION_REQUIRED';}
  else {session={id:'VER-FIXTURE',projectId:project,workItemId:input.workItemId||'TASK-1',acceptanceCriteria:['Fixture criterion'],status:'DRAFT',author:structuredClone(identity),draft:{...input,evidence:input.evidence.map((e:any)=>({...e,provenance:'HUMAN_ATTESTED_INLINE',byteLength:8}))},decisions:[]};state.sessions=[session];}
  return route.fulfill({status:req.method()==='POST'&&!url.pathname.endsWith('/submit')?201:200,json:{session,stateVersion:++state.version,review:{eligible:false,reason:'Awaiting review'},identity}});
 });
 await page.goto(`${vite.resolvedUrls!.local[0]}scripts/fixtures/verification-panel.html`);
 await page.getByText('No verification sessions for this project.').waitFor();
 await page.getByLabel('Commit SHA').fill('a'.repeat(40));await page.getByLabel('Build revision').fill('build-1');await page.getByLabel('Verification environment').fill('local');
 await page.getByLabel('Evidence content 1').fill('HTTP 401');await page.getByLabel('Criterion 1 result').selectOption('PASS');await page.getByLabel('Criterion 1 uses evidence 1').check();
 await page.getByRole('button',{name:'Create verification draft'}).click();await page.getByText('DRAFT',{exact:true}).waitFor();
 assert.equal(state.posts.length,1,'create sends one mutation');
 await page.getByLabel('I attest this submitted evidence was observed by me').check();await page.getByRole('button',{name:'Submit immutable bundle'}).click();
 await page.getByText('SUBMITTED',{exact:true}).waitFor();await page.getByText('d'.repeat(64),{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Record review decision'}).count(),0,'author cannot review own evidence');
 // A locally asserted different reviewer may reject/remediate with a reason.
 identity.identityId='reviewer';identity.username='Reviewer';identity.personId='person-reviewer';
 await page.getByRole('button',{name:'Reload sessions'}).click();await page.getByRole('button',{name:'VER-FIXTURE',exact:true}).click();await page.getByRole('button',{name:'Record review decision'}).waitFor();
 await page.getByLabel('Review decision').selectOption('REQUIRE_REMEDIATION');await page.getByLabel('Review reason').fill('Need reproducible logs');
 await page.getByLabel('I reviewed this exact submitted digest').check();await page.getByLabel('I attest I am a different person from the author and other reviewers').check();
 await page.getByRole('button',{name:'Record review decision'}).click();await page.getByText('REMEDIATION_REQUIRED',{exact:true}).waitFor();
 state.fail=true;await page.getByRole('button',{name:'Reload sessions'}).click();await page.getByRole('alert').filter({hasText:'Fixture unavailable'}).waitFor();
 state.fail=false;await page.getByRole('button',{name:'Reload sessions'}).click();await page.getByRole('button',{name:'Create verification draft'}).waitFor();
 // Late A response must never populate B or enable stale-project mutation.
 state.holdA=true;gate=new Promise<void>(resolve=>state.release=resolve);await page.getByRole('button',{name:'Reload sessions'}).click();
 await page.getByRole('button',{name:'Switch to project B'}).click();await page.getByText('No verification sessions for this project.').waitFor();state.release();
 await page.waitForTimeout(100);assert.equal(await page.getByText('VER-FIXTURE',{exact:true}).count(),0,'late prior-project response ignored');
 await page.getByRole('button',{name:'Switch to project A'}).click();await page.getByRole('button',{name:'Create verification draft'}).waitFor();
 state.stale=true;await page.getByLabel('Commit SHA').fill('a'.repeat(40));await page.getByLabel('Build revision').fill('build-2');await page.getByLabel('Verification environment').fill('local');await page.getByLabel('Evidence content 1').fill('evidence');
 await page.getByRole('button',{name:'Create verification draft'}).click();await page.getByRole('alert').filter({hasText:'PROJECT_STATE_STALE'}).waitFor();assert.equal(await page.getByRole('button',{name:'Create verification draft'}).isDisabled(),true,'CAS error requires fresh session state');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'panel fits mobile viewport');
 console.log('PASS verification panel create/submit/remediation/error/project-race/CAS/mobile browser flow');
}finally{await browser?.close();await vite.close();}
