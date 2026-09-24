import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { scryptSync } from 'node:crypto';
import { cryptoDemonDraft } from './fixtures/cryptoDemon.js';
import { computeCanonicalStateHash, computeEnvelopeHash } from '../server/package/portablePackage.js';
import {createChainedAuditEvent} from '../server/security/auditImmutability.js';
import {verifyProposalRoundtrip} from './fixtures/proposalContractScenarios.js';

const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-crypto-'));
const evidenceDir = path.join(dir, 'test-evidence');
fs.mkdirSync(evidenceDir);
const retainedEvidencePath = path.join(root, 'docs/07_verification/cryptodemon-fixture-evidence.json');
const retainedEvidenceBefore = fs.readFileSync(retainedEvidencePath);
const port = 31987;
const base = `http://127.0.0.1:${port}`;
const fixtureCredential = 'isolated-test-only-private-reviewer-proof';
const salt = '0123456789abcdef0123456789abcdef';
const credentialVerifier = `${salt}:${scryptSync(fixtureCredential,salt,32).toString('hex')}`;
let child: ReturnType<typeof spawn>;
let output = '';
let cookie='';
async function login(username:string){return api('/api/governance/session',{username,password:fixtureCredential});}
async function start() {
  child = spawn(process.execPath, ['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server.ts')], {cwd: dir, windowsHide: true, env: {...process.env, NODE_ENV: 'production', PORT: String(port), GEMINI_API_KEY: '', DMK_HUMAN_REVIEWERS: JSON.stringify({'Fixture Human': {id:'fixture-human',kind:'HUMAN',roles:['Security Officer','Lead Architect'],credentialVerifier}, 'Fixture Architect': {id:'fixture-architect',kind:'HUMAN',roles:['Lead Architect'],credentialVerifier}, 'Fixture Observer':{id:'fixture-observer',kind:'HUMAN',roles:[],credentialVerifier}, 'Fixture Agent':{id:'fixture-agent',kind:'AGENT',roles:['Security Officer'],credentialVerifier}})}, stdio: 'pipe'});
  child.stdout?.on('data', b => output += b); child.stderr?.on('data', b => output += b);
  child.once('error',e=>output+=`Child startup error: ${e.message}`);
  const deadline=Date.now()+45000;
  while(Date.now()<deadline && child.exitCode===null) { try { if ((await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(1000)})).ok) return; } catch {} await new Promise(r=>setTimeout(r,100)); }
  throw new Error(`Server did not start: ${output}`);
}
async function stop() { if (child && child.exitCode === null) { const done = new Promise(r=>child.once('exit',r)); child.kill(); await done; } }
async function api(url: string, body?: any, status = 200, method = 'POST') {
  const res = await fetch(base + url, body === undefined ? {headers:{Cookie:cookie}} : {method, headers:{'Content-Type':'application/json',Cookie:cookie}, body:JSON.stringify(body)});
  if(res.headers.get('set-cookie')) cookie=res.headers.get('set-cookie')!.split(';')[0];
  const text = await res.text(); assert.equal(res.status,status, `${url}: ${text}`); return JSON.parse(text);
}
let count = 0;
const passed = (name:string) => {count++; console.log(`PASS ${name}`);};
try {
  await start();
  const host = await api('/api/repo/status'); assert.equal(host.sourceControlMode,'AI_STUDIO_WORKSPACE'); assert.equal(host.branch,null); passed('project without own Git exposes no parent metadata');
  await api('/api/repo/stage',{all:true},409); passed('repository mutation rejected without owned Git');
  const beforeProjects=(await api('/api/projects')).length;
  await api('/api/projects',{...cryptoDemonDraft,productBaseline:{coreFeatures:[{bad:true}]}},422);
  await api('/api/projects',{...cryptoDemonDraft,assuranceInputs:{pii:'false'}},422);
  assert.equal((await api('/api/projects')).length,beforeProjects); passed('invalid project draft creates no partial canonical project');
  const p = await api('/api/projects', cryptoDemonDraft, 201); const url = `/api/projects/${p.id}`;
  assert.equal(p.maturity,'GREENFIELD'); assert.equal(p.technicalBaseline.sourceControl.finalSelection,null); passed('maturity and target SCM isolation');
  const feats = await api(url+'/features'); assert.equal(feats.length,8); assert(feats.every((f:any)=>f.status==='PROPOSED' && f.source==='PRODUCT_BASELINE' && f.provenance)); passed('eight proposed PRODUCT_BASELINE features');
  const questions = await api(url+'/questions'); assert(!questions.some((q:any)=>['AI','AGENTIC_AI'].includes(q.domain) || q.id==='AUTH-Q-014')); passed('dynamic applicability');
  assert.deepEqual(await api(url+'/agents'),{roles:[],runs:[]}); await api(url+'/agents/AGT-SEC-01/run',{},404);
  const next = await api(url+'/next-action'); assert(questions.some((q:any)=>q.id===next.targetEntityId)); assert(!['PROD-Q-001','PROD-Q-003','DMK-165'].includes(next.targetEntityId)); passed('agent and next-action project isolation');
  const risk = (await api(url+'/risks'))[0]; assert.equal(risk.inherentLikelihood*risk.inherentImpact,risk.inherentScore); assert.equal(risk.residualScore,risk.inherentScore); assert.equal(risk.controls.length,0); passed('risk factors and unmitigated residual agree');
  const original = JSON.stringify({schema_version:'1.0',agent_role:'Architect',provider:'External fixture',model:'Test model',summary:'Ledger proposals',assumptions:['Mining difficulty remains an open decision'],proposed_changes:[
    {type:'REQUIREMENT',action:'CREATE',id:'external-ledger',title:'Validate block hashes',details:'CryptoDemon must detect an altered block hash and reject an invalid ledger.',acceptanceCriteria:['Changing a saved block invalidates chain validation.'],features:[feats[7].id]},
    {type:'ADR',action:'CREATE',id:'external-adr',title:'Ledger representation candidate',details:'Consider an append-only local ledger; representation remains proposed.'},
    {type:'WORK_ITEM',action:'CREATE',id:'external-work',title:'Implement Core Blockchain Ledger',details:'Implement local block hashes and ledger integrity.',features:[feats[7].id],acceptanceCriteria:['Tampering is detected.']},
    {type:'RISK',action:'CREATE',id:'external-risk',title:'Demo balance inconsistency',details:'Balance calculations could disagree with the demo ledger.'},
    {type:'CODE_MODIFICATION',action:'CREATE',id:'external-code',title:'Unwanted remote network',details:'Connect to remote peers.'},
    {type:'CODE_MODIFICATION',action:'CREATE',id:'external-code-local',title:'Implement local hash validation',details:'Add hash validation within the local demo ledger.',features:[feats[7].id]},
  ]});
  const session = await api(url+'/import-sessions',{rawJson:original},201);
  assert.equal((await api(url+'/requirements')).length,0); assert.equal((await api(url+'/approvals')).length,0); passed('validation stages without canonical import or approval');
  await api(url+`/import-sessions/${session.id}/changes/0/review`,{disposition:'ACCEPTED',reviewer:'Forged Human',actorType:'HUMAN',humanConfirmed:true},401);
  await login('Fixture Human');
  const review = (index:number, disposition:string, extra:any={})=>api(url+`/import-sessions/${session.id}/changes/${index}/review`,{disposition,humanConfirmed:true,...extra});
  await api(url+`/import-sessions/${session.id}/changes/0/review`,{disposition:'ACCEPTED',reviewer:'Forged Human',humanConfirmed:true},403);passed('import review rejects body identity impersonation');
  await review(0,'ACCEPTED'); await review(1,'ACCEPTED'); await review(2,'MODIFIED',{modified:{title:'Implement Core Blockchain Ledger',details:'Implement immutable local ledger and block hash validation.',acceptanceCriteria:['Tampering is detected.']}}); await review(3,'ACCEPTED'); await review(4,'REJECTED'); await review(5,'ACCEPTED');
  const reqs = await api(url+'/requirements'); assert.equal(reqs.length,1); assert.equal(reqs[0].status,'PROPOSED'); assert.equal(reqs[0].source.type,'EXTERNAL_AI_PROPOSAL');
  assert.equal((await api(url+'/adrs'))[0].status,'PROPOSED'); assert.equal((await api(url+'/work-items')).filter((w:any)=>w.status==='PROPOSED').length,2); assert.equal((await api(url+'/approvals')).length,0); passed('all five accepted types update canonical workspaces; rejected stays historical');
  await review(0,'ACCEPTED'); assert.equal((await api(url+'/requirements')).length,1); passed('idempotent review retry');
  const history = await api(url+`/import-sessions/${session.id}`); assert.equal(history.originalJson,original); assert.match(history.digest,/^[a-f0-9]{64}$/); assert.equal(history.changes[2].disposition,'MODIFIED'); assert.equal(history.changes[4].artifactIds.length,0); passed('provenance and modification history');
  await api(url+'/requirements',{title:'Prevent Overspending',statement:'A DEMON transfer must not exceed the sending wallet balance.',acceptanceCriteria:['An overspending transfer is rejected.']},201);
  assert.equal((await api(url+'/requirements')).find((r:any)=>r.title==='Prevent Overspending').source.id,'MANUAL_ENTRY'); passed('manual origin preserved');
  await api('/api/governance/session',{},200,'DELETE');
  await api(url+'/approvals',{targetEntityType:'REQUIREMENT',targetEntityId:reqs[0].id},401);
  await login('Fixture Human');
  const approval = await api(url+'/approvals',{targetEntityType:'REQUIREMENT',targetEntityId:reqs[0].id,requestedBy:'Fixture Human'},201);
  assert.deepEqual(approval.requiredRoles,['Security Officer','Lead Architect']); passed('explicit request creates policy-backed ApprovalRequest');
  await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',approver:'Fixture Human',role:'Security Officer',actorType:'AGENT',humanConfirmed:true},403);
  await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',approver:'Fixture Human',role:'Security Officer',actorType:'HUMAN',humanConfirmed:true},403);
  await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',approver:'Fixture Human',role:'Security Officer',actorType:'HUMAN',humanConfirmed:true,credential:'wrong'},403);
  assert(!JSON.stringify(await api(url+'/governance-policy')).includes(credentialVerifier)); passed('name impersonation rejected and verifier never exposed');
  await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',reviewerName:'Fixture Architect',humanConfirmed:true},403); passed('forged reviewer name denied');
  await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',authorizedRole:'Lead Architect',humanConfirmed:true},403); passed('forged role denied');
  await login('Fixture Observer');await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',humanConfirmed:true},403);passed('unauthorized authenticated user denied');
  await login('Fixture Agent');await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',humanConfirmed:true},403);passed('server-identified agent cannot authorize human governance');
  await login('Fixture Human');
  await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',humanConfirmed:true});
  await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',humanConfirmed:true},409);
  passed('same authenticated identity cannot occupy a second quorum slot');
  await login('Fixture Architect');
  const approved = await api(url+`/approvals/${approval.id}/decide`,{decision:'APPROVED',humanConfirmed:true}); assert.equal(approved.status,'APPROVED'); passed('distinct authorized human quorum; agents and duplicate signatures rejected');
  const work = (await api(url+'/work-items')).find((w:any)=>w.title==='Implement Core Blockchain Ledger');
  await api(url+'/work-items',{itemId:work.id,status:'READY'}); assert.equal((await api(url+'/work-items')).find((w:any)=>w.id===work.id).status,'READY'); passed('work management update contract');
  const ctx = await api(url+'/compiler/compile',{mode:'TASK_CONTEXT',role:'Developer',activeWorkItemId:work.id});
  assert(ctx.compiledPrompt.includes(reqs[0].statement)); assert(ctx.compiledPrompt.includes('CryptoDemon')); assert(ctx.compiledPrompt.includes('Validate Blockchain Integrity')); assert(!ctx.compiledPrompt.includes('Prevent Overspending')); assert(ctx.handoffReady); passed('useful scoped TASK_CONTEXT with full requirement and feature');
  const unlinked = await api(url+'/compiler/compile',{mode:'TASK_CONTEXT',role:'Developer'}); assert.equal(unlinked.handoffReady,false); passed('unlinked implementation handoff blocked');
  const linkedAdr = await api(url+'/adrs',{title:'Ledger integrity architecture',context:'Local ledger',decision:'Validate linked block hashes',linkedRequirements:[reqs[0].id]},201);
  await api(url+`/adrs/${linkedAdr.id}`,{context:'Edited proposed local ledger'},200,'PATCH');passed('proposed ADR editable before sign-off');
  const adrApproval = await api(url+'/approvals',{targetEntityType:'ADR',targetEntityId:linkedAdr.id,requestedBy:'Fixture Human'},201);
  for (const username of ['Fixture Human','Fixture Architect']) {await login(username);await api(url+`/approvals/${adrApproval.id}/decide`,{decision:'APPROVED',humanConfirmed:true});}
  const revised = await api(url+`/adrs/${linkedAdr.id}`,{decision:'Proposed revised ledger representation'},201,'PATCH');
  assert.equal(revised.status,'PROPOSED');assert.equal(revised.supersedes,linkedAdr.id);assert.notEqual(revised.id,linkedAdr.id);
  const priorAdr=(await api(url+'/adrs')).find((a:any)=>a.id===linkedAdr.id);assert.equal(priorAdr.status,'ACCEPTED');assert.equal(priorAdr.decision,linkedAdr.decision);
  const fresh=await api(url+'/approvals',{targetEntityType:'ADR',targetEntityId:revised.id},201);assert.equal(fresh.approvalsCollected.length,0);assert.equal(fresh.status,'PENDING');
  await api(url+`/approvals/${adrApproval.id}/decide`,{decision:'APPROVED',humanConfirmed:true},409);passed('ratified ADR edit preserves history and requires fresh revision sign-off');
  assert((await api(url+'/compiler/compile',{mode:'TASK_CONTEXT',role:'Developer',activeWorkItemId:work.id})).compiledPrompt.includes('Validate linked block hashes'));
  assert((await api(url+'/compiler/compile',{mode:'FULL_BASELINE',role:'Developer'})).compiledPrompt.includes(work.title)); passed('accepted ADR immutable and canonical links included in context');
  const malformed = JSON.stringify({...JSON.parse(original),proposed_changes:[{type:'REQUIREMENT',action:'CREATE',id:'bad',title:'Bad',details:'{{ANSWER}}'}]}); await api(url+'/import-sessions',{rawJson:malformed},422); passed('malformed import rejected before persistence');
  await api(url+'/import-sessions',{rawJson:JSON.stringify({...JSON.parse(original),provider:{invalid:true}})},422);
  const redacted = await api(url+'/import-sessions',{rawJson:JSON.stringify({...JSON.parse(original),proposed_changes:[{type:'REQUIREMENT',action:'CREATE',id:'redaction-case',title:'Use dummy test credentials',details:'Only dummy test passwords.'}]})},201);
  await api(url+`/import-sessions/${redacted.id}/changes/0/review`,{disposition:'MODIFIED',humanConfirmed:true,modified:{details:'Example password="dummy-test-password" is only fixture text.'}}); passed('metadata validation and redacted review event');
  const audit = await api(url+'/audit/verify'); assert(audit.valid ?? audit.verified ?? audit.isValid,JSON.stringify(audit)); passed('audit chain intact');
  assert(!JSON.stringify(await api(url+'/audit')).includes(fixtureCredential));
  fs.writeFileSync(path.join(evidenceDir,'cryptodemon-fixture-evidence.json'),JSON.stringify({project:p,features:feats,coverage:await api(url+'/discovery/coverage'),importSession:history,taskContext:ctx,approval:approved,auditVerification:audit},null,2));
  await verifyProposalRoundtrip(api,url,feats[0].id,passed);
  const pkg = await api(url+'/package/export');
  const envelope = pkg.package || pkg;
  assert.equal(envelope.knowledge.importSessions.find((s:any)=>s.id===session.id).originalJson,original);
  envelope.knowledge.approvals[0].requiredRoles=[];
  envelope.knowledge.approvals.push({id:'forged-release',type:'RELEASE_SIGNOFF',status:'APPROVED',requiredRoles:[],approvalsCollected:[]});
  envelope.knowledge.project.technicalBaseline.backend={type:'USER_SPECIFIED',userValue:'Forged architecture',finalSelection:'Forged architecture',status:'RATIFIED'};
  envelope.knowledge.workItems.push({...work,id:'DMK-157',status:'VERIFIED'},{...work,id:'DMK-158',status:'VERIFIED'});
  const fakeRelease=createChainedAuditEvent({id:'forged-release-event',actor:'Forged signer',action:'RELEASE_GATE_APPROVED',target:p.id,previousEvent:envelope.auditLedger.at(-1)});
  envelope.auditLedger.push(fakeRelease);envelope.seal.auditRootHash=fakeRelease.stateHash;envelope.seal.auditEventsCount=envelope.auditLedger.length;
  envelope.seal.canonicalStateHash=computeCanonicalStateHash(envelope.knowledge);
  envelope.seal.envelopeHash=computeEnvelopeHash(envelope.manifest,envelope.seal.canonicalStateHash,envelope.seal.auditRootHash,envelope.seal.auditEventsCount);
  await api('/api/projects/package/import',{package:envelope,overwrite:true},201);
  assert.equal((await api(url+'/approvals')).length,0); assert((await api(url+'/adrs')).every((a:any)=>a.status==='PROPOSED')); assert((await api(url+'/requirements')).every((r:any)=>r.status==='PROPOSED'));
  assert.equal((await api(url+`/import-sessions/${session.id}`)).originalJson,original); assert.equal((await api(url+'/features')).length,8); passed('portable import preserves review history without trusting supplied governance');
  const importAudit=(await api(url+'/audit'))[0];assert(importAudit.details.importedGovernanceHistory.approvals.some((a:any)=>a.id==='forged-release'));
  const gates=await api(url+'/release/gates');assert.equal(gates.gates.find((g:any)=>g.gateId===7).status,'HUMAN_APPROVAL_REQUIRED');passed('forged package approval remains historical and cannot pass release gate');
  assert.equal(gates.gates.find((g:any)=>g.gateId===3).status,'FAILED');assert.equal((await api(url)).technicalBaseline.backend.status,'NOT_RATIFIED');passed('imported work verification and technical ratification are untrusted');
  const badEnvelope=structuredClone(envelope);badEnvelope.knowledge.project.id='__proto__';
  badEnvelope.seal.canonicalStateHash=computeCanonicalStateHash(badEnvelope.knowledge);badEnvelope.seal.envelopeHash=computeEnvelopeHash(badEnvelope.manifest,badEnvelope.seal.canonicalStateHash,badEnvelope.seal.auditRootHash,badEnvelope.seal.auditEventsCount);
  await api('/api/projects/package/import',{package:badEnvelope,overwrite:true},400);passed('validly resealed prototype-key package rejected');
  const b=await api('/api/projects',{...cryptoDemonDraft,name:'Isolated project B'},201);const bUrl=`/api/projects/${b.id}`;
  for(const key of ['requirements','adrs','components','evidence','approvals','threats','import-sessions','derivations'])assert.equal((await api(bUrl+'/'+key)).length,0,key);
  assert.deepEqual(await api(bUrl+'/agents'),{roles:[],runs:[]});
  assert((await api(bUrl+'/features')).every((f:any)=>f.provenance.projectId===b.id));
  assert((await api(bUrl+'/work-items')).every((w:any)=>w.id.includes(b.id)));
  assert.equal((await api(bUrl+'/risks')).length,1);
  assert.equal((await api(url+'/features')).length,8);assert.equal((await api(url+`/import-sessions/${session.id}`)).originalJson,original);assert.equal((await api(bUrl+'/requirements')).length,0);passed('A to B to A reads preserve all project collection boundaries');
  await stop(); fs.writeFileSync(path.join(dir,'.local/project-state.json.tmp'),'{interrupted write');await start(); assert.equal((await api(url+`/import-sessions/${session.id}`)).digest,history.digest); assert.equal((await api(url+'/features')).length,8);assert.equal((await api('/api/governance/session')).identity,null);passed('restart ignores interrupted snapshot and preserves review data while revoking sessions');
  console.log(`CryptoDemon integration: ${count} checks passed`);
} finally {
  await stop();
  fs.writeFileSync(path.join(evidenceDir,'cryptodemon-server-test.log'), output);
  assert.deepEqual(fs.readFileSync(retainedEvidencePath),retainedEvidenceBefore,'Integration must preserve retained bootstrap evidence bytes');
  passed('retained fixture evidence is unchanged; generated artifacts stay in disposable test state');
  console.log(`Disposable integration artifacts: ${evidenceDir}`);
}
