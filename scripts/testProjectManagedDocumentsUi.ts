import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {startIsolatedVite} from './fixtures/isolatedVite.ts';

// Parent schedules this browser fixture. It uses only synthetic route responses,
// never roster enrollment, real credentials, or live project persistence.
const runtime=path.resolve('runtime');fs.mkdirSync(runtime,{recursive:true});
const harness=fs.mkdtempSync(path.join(runtime,'local-mvp-managed-docs-owned-'));
const relative=path.relative(process.cwd(),harness).replace(/\\/g,'/');
fs.writeFileSync(path.join(harness,'index.html'),`<html><body><div id="root"></div><script type="module" src="/${relative}/harness.tsx"></script></body></html>`);
fs.writeFileSync(path.join(harness,'harness.tsx'),`
import React, {useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ControlledDocsView} from '../../src/components/ControlledDocsView';
import {createControlledDocsLoader} from '../../src/data/controlledDocsClient';
function Harness(){
 const [project,setProject]=useState('PRJ-ORDINARY');
 const loader=useMemo(()=>{const api=createControlledDocsLoader();return {...api,requestCreate:(input)=>{
  if(window.__holdCreate)return new Promise(resolve=>window.__resolveCreate=()=>resolve({success:true,projectId:input.projectId,documentId:'MDOC-00000000-0000-4000-8000-000000000099',path:'managed-documents/MDOC-00000000-0000-4000-8000-000000000099.md',newSha256:'a'.repeat(64),stateVersion:input.expectedStateVersion+1,auditEventId:'AUD-held',timestamp:'2026-10-22T00:00:00.000Z'}));
  return api.requestCreate(input);
 }}},[]);
 window.__setProject=setProject;window.__created=window.__created||[];window.__saved=window.__saved||[];
 return <ControlledDocsView projectId={project} loader={loader} onDocumentCreated={(id,result)=>window.__created.push({id,result})} onSaveCommitted={(id,result)=>window.__saved.push({id,result})}/>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
`);
const vite=await startIsolatedVite(process.cwd());
const executablePath=process.env.DMK_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
const browser=await chromium.launch({headless:true,executablePath});
const page=await browser.newPage();
const documentId='MDOC-00000000-0000-4000-8000-000000000001';
let content='# Design\n\nDraft content.\n';
let version=7,created=false,reviewer=false,conflictSave=true;
let createPayload:any,savePayload:any;
const sha=()=>crypto.createHash('sha256').update(content).digest('hex');
const summary=()=>({id:documentId,path:`managed-documents/${documentId}.md`,kind:'PRODUCT',authority:'REFERENCE',editability:'CONTROLLED_EDIT',fileType:'MARKDOWN',title:'Design notes',managed:true,integrityStatus:'MATCH',currentSha256:sha(),sha256Digest:sha(),sizeBytes:Buffer.byteLength(content),eol:'LF'});
try{
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()), method=route.request().method();
  const answer=(body:any,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/governance/session')return answer({identity:reviewer?{name:'Synthetic reviewer',roles:['Security Officer']}:null});
  if(url.pathname==='/api/projects/PRJ-OTHER')return answer({id:'PRJ-OTHER',stateVersion:2});
  if(url.pathname==='/api/projects/PRJ-OTHER/docs')return answer([]);
  if(url.pathname==='/api/projects/PRJ-ORDINARY')return answer({id:'PRJ-ORDINARY',stateVersion:version});
  if(url.pathname==='/api/projects/PRJ-ORDINARY/docs'&&method==='GET')return answer(created?[summary()]:[]);
  if(url.pathname==='/api/projects/PRJ-ORDINARY/docs'&&method==='POST'){
   createPayload=route.request().postDataJSON();created=true;version++;
   return answer({success:true,projectId:'PRJ-ORDINARY',documentId,path:summary().path,newSha256:sha(),stateVersion:version,auditEventId:'AUD-create',timestamp:'2026-10-22T00:00:00.000Z'},201);
  }
  if(url.pathname.endsWith(`/${documentId}`))return answer({document:summary(),content,rawSha256:sha(),eol:'LF',sizeBytes:Buffer.byteLength(content),projectId:'PRJ-ORDINARY',stateVersion:version});
  if(url.pathname.endsWith('/diff'))return answer({documentId,oldHash:sha(),candidateHash:'b'.repeat(64),isStale:false,hasChanges:true,additions:1,deletions:1,changedLines:2,unifiedDiff:'--- original\n+++ candidate\n-Draft\n+Revised'});
  if(url.pathname.endsWith('/validate'))return answer({documentId,valid:true,errors:[],warnings:[]});
  if(url.pathname.endsWith('/save')){
   savePayload=route.request().postDataJSON();
   if(conflictSave){conflictSave=false;return answer({error:'STALE_STATE'},409);}
   const oldHash=sha();content=savePayload.candidateContent;version++;
   return answer({success:true,documentId,path:summary().path,previousSha256:oldHash,newSha256:sha(),stateVersion:version,auditEventId:'AUD-save',timestamp:'2026-10-22T00:00:00.000Z'});
  }
  return answer({error:'UNEXPECTED_FIXTURE_REQUEST'},404);
 });
 await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as any).port}/${relative}/index.html`);
 await page.getByTestId('controlled-docs-empty').waitFor();
 await page.getByTestId('btn-create-document').click();
 await page.getByTestId('create-document-reviewer').filter({hasText:'Sign in'}).waitFor();
 assert.equal(await page.getByTestId('btn-confirm-create-document').isDisabled(),true);
 reviewer=true;
 await page.getByTestId('btn-reload-create-context').click();
 await page.getByTestId('create-document-reviewer').filter({hasText:'Synthetic reviewer'}).waitFor();
 await page.getByTestId('create-document-title').fill('Design notes');
 await page.getByTestId('create-document-content').fill(content);
 await page.getByTestId('create-document-reason').fill('Record design draft');
 await page.getByTestId('create-document-confirmation').check();
 await page.getByTestId('btn-confirm-create-document').click();
 await page.getByTestId('document-created-notice').waitFor();
 await page.getByTestId('doc-content-rendered').waitFor();
 assert.equal(createPayload.expectedStateVersion,7);assert.equal(createPayload.humanConfirmed,true);assert.match(createPayload.requestId,/^[0-9a-f-]{36}$/);
 assert.equal(createPayload.actor,undefined);assert.equal(createPayload.path,undefined);
 assert.equal(await page.evaluate(()=>(window as any).__created.length),1);
 console.log('PASS empty project creation requires reviewer and confirmation, then refreshes catalog');
 const editThroughModal=async()=>{
  await page.getByTestId('btn-edit-document').click();
  await page.getByTestId('draft-editor-textarea').fill('# Revised\n');
  await page.getByTestId('btn-preview-diff').click();
  await page.getByTestId('btn-validate').click();
  await page.getByTestId('btn-proceed-to-save').click();
  await page.getByTestId('modal-session-name').waitFor();
  await page.getByTestId('modal-save-reason').fill('Revise draft');
  await page.getByTestId('modal-confirm-checkbox').check();
  await page.getByTestId('btn-confirm-save').click();
 };
 await editThroughModal();
 await page.getByTestId('canonical-refresh-error').waitFor();
 assert.equal(savePayload.expectedStateVersion,8);assert.equal(savePayload.baseSha256,sha());
 assert.equal(await page.evaluate(()=>(window as any).__saved.length),0);
 await page.getByTestId('btn-reload-canonical').click();
 await page.getByTestId('btn-edit-document').waitFor();
 await editThroughModal();
 await page.getByTestId('save-success-banner').waitFor();
 assert.equal(await page.evaluate(()=>(window as any).__saved.length),1);
 console.log('PASS managed save sends version/digest CAS and conflict requires canonical reload');
 await page.getByTestId('btn-edit-document').waitFor();
 await page.evaluate(()=>(window as any).__holdCreate=true);
 await page.getByTestId('btn-create-document').click();
 await page.getByTestId('create-document-reviewer').filter({hasText:'Synthetic reviewer'}).waitFor();
 await page.getByTestId('create-document-title').fill('Held creation');
 await page.getByTestId('create-document-content').fill('# Held\n');
 await page.getByTestId('create-document-reason').fill('Exercise stale response');
 await page.getByTestId('create-document-confirmation').check();
 await page.getByTestId('btn-confirm-create-document').click();
 await page.waitForFunction(()=>typeof (window as any).__resolveCreate==='function');
 await page.evaluate(()=>(window as any).__setProject('PRJ-OTHER'));
 await page.getByTestId('controlled-docs-empty').waitFor();
 await page.evaluate(()=>(window as any).__setProject('PRJ-ORDINARY'));
 await page.getByTestId('btn-edit-document').waitFor();
 await page.evaluate(()=>(window as any).__resolveCreate());
 await page.waitForFunction(()=>(window as any).__created.length===1);
 assert.equal(await page.getByTestId('document-created-notice').count(),0);
 assert.equal(await page.getByTestId('doc-save-modal').count(),0);
 console.log('PASS late creation completion after switching projects and returning cannot show success or notify parent');
}finally{
 await browser.close();await vite.close();
 assert.equal(path.dirname(harness),runtime);assert.ok(path.basename(harness).startsWith('local-mvp-managed-docs-owned-'));
 fs.rmSync(harness,{recursive:true,force:true});
}
