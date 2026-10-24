/** One real source-application journey. Synthetic fixture only; never human acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn, execFileSync, type ChildProcess} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {normalizeProposalChange} from '../src/data/proposalContract.ts';

const source = fs.realpathSync.native(fileURLToPath(new URL('..', import.meta.url)));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const change = {proposal_id:'ACCEPTANCE-CHANGE',artifact_type:'REQUIREMENT',action:'CREATE',target:null,
  proposed:{title:'Synthetic acceptance follow-up',details:'Record a follow-up for the disposable project.',acceptanceCriteria:['The scoped document remains available after restart.']}};
let passed = 0, failed = 0, stage = 'contract-controls';
async function check(name: string, body: () => unknown | Promise<unknown>) {
  stage = name;
  await body(); passed++; console.log('PASS ' + name);
}

// These controlled negative inputs exercise the real validator before the journey.
// Removing either production validation must fail the corresponding assertion.
await check('AJ01 object criteria are rejected before proposal staging', () => {
  assert.throws(() => normalizeProposalChange({...change,proposed:{...change.proposed,acceptanceCriteria:[{text:'Not a string'}]}},'1.1',0),
    (error: any) => error.code === 'SCHEMA_ERROR' && error.path === 'proposed_changes[0].proposed.acceptanceCriteria[0]');
});
await check('AJ02 external approval claims are rejected by the proposal contract', () => {
  assert.throws(() => normalizeProposalChange({...change,proposed:{...change.proposed,approvals:['invented']}},'1.1',0),
    (error: any) => error.code === 'GOVERNANCE_FIELD_FORBIDDEN');
});
if (process.argv.slice(2).length) {
  assert.deepEqual(process.argv.slice(2), ['--contract-controls']);
  console.log(JSON.stringify({suite:'workspace-acceptance-journey',scope:'contract-controls-only',passed,failed,humanAcceptance:'NOT_RUN'}));
} else {
  const {ProjectStore} = await import('../server/projectStore.ts');
  const {snapshotProjectStore} = await import('../server/projectPersistence.ts');
  const {WorkspaceStore} = await import('../server/security/workspaceAccess/store.ts');
  const {recoverWorkspaceLock} = await import('../server/security/workspaceAccess/privateDirectory.ts');
  const temporaryParent = fs.realpathSync.native(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryParent, 'dmk-acceptance-journey-'));
  const password = 'Synthetic-only-' + randomBytes(18).toString('hex');
  const loader = pathToFileURL(path.join(source,'node_modules/tsx/dist/loader.mjs')).href;
  const sourceRevision = execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
  const sourceTree = execFileSync('git',['-C',source,'rev-parse','HEAD^{tree}'],{encoding:'utf8',windowsHide:true}).trim();
  const scriptSha256 = sha(fs.readFileSync(fileURLToPath(import.meta.url)));
  const projectId = 'PRJ-SYNTHETIC-ACCEPTANCE', otherProjectId = 'PRJ-SYNTHETIC-UNGRANTED';
  const ownerId = 'synthetic-acceptance-owner', readerId = 'synthetic-acceptance-reader', outsiderId = 'synthetic-acceptance-outsider';
  const root = '/api/projects/' + projectId;
  const criterion = 'A scoped owner saves a document; stale requests cannot overwrite it and restart preserves its bytes.';
  type Client = {cookie:string;csrf:string};
  const owner: Client = {cookie:'',csrf:''}, reader: Client = {cookie:'',csrf:''}, outsider: Client = {cookie:'',csrf:''};
  let child: ChildProcess | undefined, childOutput = '', base = '', requests = 0, openAttempts = 0;
  let lastResponse: {method:string;status:number;sequence:number} | undefined;
  let authorityCounts: unknown, documentId = '', workItemId = '', proposalId = '', migrationHash = '';
  const environment: NodeJS.ProcessEnv = {NODE_ENV:'production',HOST:'127.0.0.1',GEMINI_API_KEY:''};
  for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP']) if (process.env[key] !== undefined) environment[key] = process.env[key];
  const budgetOpen = () => assert(++openAttempts <= 12, 'Finite authority-open budget exceeded');
  const cli = (args: string[], secret = false) => {
    budgetOpen();
    const raw = execFileSync(process.execPath,['--import',loader,path.join(source,'scripts/workspaceSecurity.ts'),...args],
      {cwd:directory,env:environment,input:secret?password+'\n':undefined,encoding:'utf8',windowsHide:true,timeout:30_000});
    assert(!raw.includes(password)); return JSON.parse(raw);
  };
  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const active = child;
    await new Promise<void>((resolve,reject) => {
      const timer = setTimeout(() => reject(Object.assign(Error('STOP_UNCONFIRMED'),{code:'STOP_UNCONFIRMED'})),5_000);
      active.once('exit',() => {clearTimeout(timer);resolve();});
      active.once('error',error => {clearTimeout(timer);reject(error);});
      active.kill('SIGKILL');
    });
  }
  async function launch() {
    budgetOpen(); childOutput = '';
    const probe = net.createServer(); await new Promise<void>(resolve => probe.listen(0,'127.0.0.1',resolve));
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>(resolve => probe.close(() => resolve())); base = 'http://127.0.0.1:' + port;
    child = spawn(process.execPath,['--import',loader,'--import',pathToFileURL(path.join(directory,'deny-native.mjs')).href,path.join(source,'server.ts')],
      {cwd:directory,env:{...environment,PORT:String(port)},windowsHide:true,stdio:'pipe'});
    const capture = (bytes: Buffer) => {childOutput = (childOutput + bytes.toString()).slice(-65_536);};
    child.stdout!.on('data',capture); child.stderr!.on('data',capture);
    const deadline = Date.now() + 20_000;
    while (child.exitCode === null && !childOutput.includes('Control Plane running') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve,30));
    assert.equal(child.exitCode,null,'Application child exited before startup');
    assert(childOutput.includes('Control Plane running'),'Application did not start within its fixture envelope');
  }
  async function request(endpoint: string, method = 'GET', body?: unknown, client?: Client, csrf = true) {
    assert(++requests <= 120,'Finite HTTP request budget exceeded');
    const headers = {...(body === undefined?{}:{'Content-Type':'application/json'}),...(client?.cookie?{Cookie:client.cookie}:{}),
      ...(client && method !== 'GET' && csrf?{'X-DMK-CSRF':client.csrf,'X-DMK-Request-ID':randomUUID()}: {})};
    const response = await fetch(base+endpoint,{method,headers,signal:AbortSignal.timeout(15_000),...(body===undefined?{}:{body:JSON.stringify(body)})});
    lastResponse = {method,status:response.status,sequence:requests}; const data = await response.json();
    return {status:response.status,data,cookie:response.headers.get('set-cookie')??''};
  }
  const expect = (result: {status:number;data:any}, status: number) => {assert.equal(result.status,status,'Unexpected HTTP result in '+stage);return result.data;};
  const read = async(endpoint: string, client = owner) => expect(await request(endpoint,'GET',undefined,client),200);
  const version = async() => (await read(root)).stateVersion as number;
  async function login(id: string, client: Client) {
    const result = await request('/api/governance/session','POST',{username:id,password});
    const data = expect(result,200); client.cookie = result.cookie.split(';')[0]; client.csrf = data.csrf;
    assert.deepEqual(data.identity.roles,[]); assert.equal(data.access.mode,'ENFORCED');
    assert.match(result.cookie,/HttpOnly/i); assert.match(result.cookie,/SameSite=Strict/i);
    assert.doesNotMatch(JSON.stringify(data),/\$argon2|credentialVerifier/);
  }
  try {
    fs.mkdirSync(path.join(directory,'dist'));
    fs.writeFileSync(path.join(directory,'dist/index.html'),'<html>Disposable acceptance HTTP fixture</html>');
    fs.writeFileSync(path.join(directory,'deny-native.mjs'),`import {installNativeCredentialTripwire} from ${JSON.stringify(pathToFileURL(path.join(source,'scripts/fixtures/syntheticServerPreload.ts')).href)};installNativeCredentialTripwire();`);
    await check('AJ03 fresh source application requires explicit setup and exposes no project data',async() => {
      await launch(); const session = expect(await request('/api/governance/session'),200);
      assert.equal(session.identity,null); assert.equal(session.access.setupRequired,true);
      expect(await request('/api/projects'),503);
      expect(await request('/api/governance/session','POST',{username:ownerId,password}),503);
      await stop(); assert.equal(fs.existsSync(path.join(directory,'.security')),false);
    });
    await check('AJ04 explicit synthetic import preserves its source and grants no implicit membership',async() => {
      const state = new ProjectStore(), template = structuredClone(state.projects[0]);
      for (const key of Object.keys(state)) (state as any)[key] = key === 'projects'?[]:{};
      for (const [id,name] of [[projectId,'Synthetic acceptance project'],[otherProjectId,'Synthetic ungranted project']]) {
        state.projects.push({...structuredClone(template),id,name,stateVersion:1}); state.managedDocuments[id] = [];
      }
      fs.mkdirSync(path.join(directory,'.local'));
      const migration = path.join(directory,'.local/project-state.json'); fs.writeFileSync(migration,JSON.stringify(snapshotProjectStore(state)));
      migrationHash = sha(fs.readFileSync(migration));
      assert.equal(cli(['init','--id',ownerId,'--name',ownerId,'--person',ownerId+'-person','--can-create','--import-state'],true).completed,true);
      await launch(); await login(ownerId,owner); assert.deepEqual(await read('/api/projects'),[]);
      expect(await request(root+'/docs','GET',undefined,owner),404);
      assert.equal(sha(fs.readFileSync(migration)),migrationHash);
      await stop(); await recoverWorkspaceLock(directory);
    });
    await check('AJ05 explicit ordinary memberships expose only the selected project',async() => {
      for (const id of [readerId,outsiderId]) assert.equal(cli(['provision','--id',id,'--name',id,'--person',id+'-person'],true).completed,true);
      for (const [id,role] of [[ownerId,'OWNER'],[readerId,'READER']]) assert.equal(cli(['membership','--id',id,'--project',projectId,'--role',role]).completed,true);
      await launch(); await login(ownerId,owner); await login(readerId,reader); await login(outsiderId,outsider);
      assert.deepEqual((await read('/api/projects')).map((project: any) => project.id),[projectId]);
      assert.deepEqual(await read('/api/projects',outsider),[]);
      expect(await request('/api/projects/'+otherProjectId,'GET',undefined,owner),404);
      expect(await request(root,'GET',undefined,outsider),404); expect(await request(root),401);
      expect(await request(root+'/docs','POST',{},owner,false),403);
      expect(await request(root+'/docs','POST',{},reader),404);
    });
    await check('AJ06 document creation validation and stale rejection preserve exact authored bytes',async() => {
      const initial = '# Synthetic acceptance\n\nDraft for this disposable journey.\n';
      // Existing ordinary-author confirmation wire field, exercised by a named
      // synthetic fixture. It is not a human review or acceptance attestation.
      const created = expect(await request(root+'/docs','POST',{title:'Acceptance notes',kind:'ARCHITECTURE',format:'MARKDOWN',content:initial,
        expectedStateVersion:await version(),reason:'Synthetic agent acceptance fixture',humanConfirmed:true,requestId:randomUUID()},owner),201);
      documentId = created.documentId; assert.equal(created.newSha256,sha(initial));
      const document = root+'/docs/'+documentId, updated = '# Synthetic acceptance\n\nSaved and retained across restart.\n';
      assert.equal((await read(document)).content,initial);
      assert.equal(expect(await request(document+'/validate','POST',{candidateContent:updated},owner),200).valid,true);
      const revision = await version();
      const save = {candidateContent:updated,baseSha256:created.newSha256,expectedStateVersion:revision,reason:'Record observed synthetic change',humanConfirmed:true,requestId:randomUUID()};
      expect(await request(document+'/save','POST',{...save,baseSha256:'0'.repeat(64)},owner),409);
      assert.equal((await read(document)).content,initial); assert.equal(await version(),revision);
      const saved = expect(await request(document+'/save','POST',save,owner),200); assert.equal(saved.newSha256,sha(updated));
      expect(await request(document+'/save','POST',{...save,requestId:randomUUID()},owner),409);
      assert.equal((await read(document)).content,updated);
    });
    await check('AJ07 requirement-derived work compiles actual targets without provider access or promotion',async() => {
      const requirement = expect(await request(root+'/requirements','POST',{title:'Persist scoped acceptance notes',statement:criterion,acceptanceCriteria:[criterion]},owner),201);
      assert.equal(requirement.status,'PROPOSED');
      const work = expect(await request(root+'/work-items','POST',{operation:'DERIVE_REQUIREMENT',requirementId:requirement.id,expectedStateVersion:await version()},owner),201).workItem;
      workItemId = work.id; assert.equal(work.status,'PROPOSED'); assert.deepEqual(work.requirements,[requirement.id]); assert.deepEqual(work.acceptanceCriteria,[criterion]);
      const requirements = await read(root+'/requirements'); assert(requirements.find((entry: any) => entry.id===requirement.id).workItems.includes(workItemId));
      const compiled = expect(await request(root+'/compiler/compile','POST',{mode:'TASK_CONTEXT',role:'Developer',activeWorkItemId:workItemId},owner),200);
      assert.equal(compiled.activeWorkItem.id,workItemId); assert(compiled.includedRequirementIds.includes(requirement.id));
      assert(compiled.editableArtifacts.some((entry: any) => entry.artifact_id===requirement.id && entry.artifact_type==='REQUIREMENT'));
      assert(compiled.editableArtifacts.some((entry: any) => entry.artifact_id===workItemId && entry.artifact_type==='WORK_ITEM'));
      assert.match(compiled.compiledPrompt,/"schema_version": "1.1"/); assert.match(compiled.compiledPrompt,/arrays of JSON strings/);
      const response = (item: unknown) => JSON.stringify({schema_version:'1.1',agent_role:'Developer',summary:'Synthetic manual proposal fixture; no live provider',assumptions:[],proposed_changes:[item]});
      const before = await read(root+'/import-sessions');
      const invalid = expect(await request(root+'/import-sessions','POST',{rawJson:response({...change,proposed:{...change.proposed,acceptanceCriteria:[{text:'Invalid'}]}})},owner),422);
      assert.equal(invalid.error.code,'SCHEMA_ERROR'); assert.deepEqual(await read(root+'/import-sessions'),before);
      const injected = expect(await request(root+'/import-sessions','POST',{rawJson:response({...change,proposed:{...change.proposed,approvals:['forged']}})},owner),422);
      assert.equal(injected.error.code,'GOVERNANCE_FIELD_FORBIDDEN');
      const proposal = expect(await request(root+'/import-sessions','POST',{rawJson:response(change),context:{mode:'TASK_CONTEXT',activeWorkItemId:workItemId}},owner),201);
      proposalId = proposal.id; assert.equal(proposal.validationStatus,'AWAITING_HUMAN_REVIEW');
      assert.equal(proposal.changes[0].disposition,'PENDING'); assert.deepEqual(proposal.changes[0].artifactIds,[]);
      expect(await request(root+'/import-sessions/'+proposalId+'/changes/0/review','POST',{disposition:'ACCEPTED',humanConfirmed:false},owner),404);
      assert.deepEqual(await read(root+'/requirements'),requirements);
    });
    await check('AJ08 ordinary evidence projection conveys no release approval and reviewer-only sessions stay denied',async() => {
      assert.deepEqual(await read(root+'/evidence'),[]);
      const readiness = await read(root+'/readiness');
      assert.equal(readiness.summary.productionRelease.status,'Unavailable');
      assert.equal(readiness.summary.securityAssurance.status,'Unavailable');
      assert.equal(readiness.summary.localEvidence.reviewedCount,0);
      // The current durable-identity bridge deliberately requires an explicit
      // SO/LA role even to draft evidence. Keep this ordinary owner unprivileged;
      // report that workflow as blocked instead of inventing a reviewer.
      const revision = await version();
      expect(await request(root+'/verification-sessions','GET',undefined,owner),403);
      expect(await request(root+'/verification-sessions','POST',{expectedStateVersion:revision,workItemId},owner),403);
      assert.equal(await version(),revision); assert.deepEqual(await read(root+'/evidence'),[]);
      assert.equal((await read(root+'/work-items')).find((item: any) => item.id===workItemId).status,'PROPOSED');
    });
    await check('AJ09 restart persists connected artifacts and fences the prior session',async() => {
      const before = {document:await read(root+'/docs/'+documentId),work:await read(root+'/work-items'),proposal:await read(root+'/import-sessions/'+proposalId),evidence:await read(root+'/evidence')};
      await stop(); await recoverWorkspaceLock(directory); await launch();
      expect(await request('/api/projects','GET',undefined,owner),401); await login(ownerId,owner);
      assert.deepEqual(await read(root+'/docs/'+documentId),before.document); assert.deepEqual(await read(root+'/work-items'),before.work);
      assert.deepEqual(await read(root+'/import-sessions/'+proposalId),before.proposal);
      assert.deepEqual(await read(root+'/evidence'),before.evidence);
      expect(await request(root+'/verification-sessions','GET',undefined,owner),403);
      assert.equal(sha(fs.readFileSync(path.join(directory,'.local/project-state.json'))),migrationHash);
      assert.equal(fs.existsSync(path.join(directory,'.secrets')),false);
    });
    await check('AJ10 acknowledged logout denies the old cookie and bounded offline closeout retains headroom',async() => {
      const loggedOut = await request('/api/governance/session','DELETE',undefined,owner); expect(loggedOut,200);
      assert.match(loggedOut.cookie,/dmk_workspace=;/); expect(await request(root,'GET',undefined,owner),401);
      await stop(); await recoverWorkspaceLock(directory); budgetOpen();
      const authority = await WorkspaceStore.open(directory);
      try {const info = await authority.execute({command:'info'}); authorityCounts = info.counts;
        assert.equal(info.counts.principals,3); assert.equal(info.counts.memberships,2); assert(info.counts.audit < 512,'Acceptance exceeded its bounded audit allowance');
      } finally {await authority.close();}
    });
  } catch (error: any) {
    failed++;
    const code = typeof error?.code === 'string' && /^[A-Z_]{1,80}$/.test(error.code)?error.code:'ACCEPTANCE_STAGE_FAILED';
    const numeric = (value: unknown) => typeof value === 'number' || typeof value === 'boolean'?value:undefined;
    console.error(JSON.stringify({suite:'workspace-acceptance-journey',stage,code,lastResponse,requests,openAttempts,
      expected:numeric(error?.expected),actual:numeric(error?.actual),childCodes:childOutput.match(/\bWORKSPACE_[A-Z_]{1,70}\b/g)?.slice(-4)}));
  } finally {
    try {
      await stop();
      const resolved = fs.realpathSync.native(directory);
      assert.equal(path.dirname(resolved),temporaryParent); assert(path.basename(resolved).startsWith('dmk-acceptance-journey-'));
      assert.equal(fs.lstatSync(directory).isSymbolicLink(),false); fs.rmSync(directory,{recursive:true,force:true});
    } catch {failed++;console.error(JSON.stringify({suite:'workspace-acceptance-journey',stage:'cleanup',code:'OWNED_FIXTURE_CLEANUP_UNCONFIRMED'}));}
    console.log(JSON.stringify({suite:'workspace-acceptance-journey',scope:'actual-source-application-http',passed,failed,requests,openAttempts,authorityCounts,
      sourceRevision,sourceTree,scriptSha256,node:process.version,platform:process.platform,acceptance:'AGENT_EXECUTED_ACCEPTANCE',
      evidenceSession:'BLOCKED_REVIEW_ROLE_REQUIRED',humanAcceptance:'NOT_RUN',liveProvider:'NOT_RUN'}));
    if (failed) process.exitCode = 1;
  }
}
