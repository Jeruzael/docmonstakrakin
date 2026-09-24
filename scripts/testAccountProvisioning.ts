import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,scryptSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import express from 'express';
import {registerSignoffRoutes} from '../server/proposals/signoff.ts';

// Execute the real operator helper, replacing only interactive input and server
// launch. Passwords are random, passed through the child environment, never logged.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dmk-account-test-'));
const password=randomBytes(32).toString('hex');
const script=path.join(temp,'capture.ps1');
fs.writeFileSync(script,`param([string]$AccountPath)
$ErrorActionPreference = 'Stop'
$script:prompts = @()
function Read-Host { param([string]$Prompt, [switch]$AsSecureString)
    $script:prompts += $Prompt
    ConvertTo-SecureString $env:DMK_FIXTURE_PASSWORD -AsPlainText -Force
}
function npm {
    @{ roster = ($env:DMK_HUMAN_REVIEWERS | ConvertFrom-Json); prompts = $script:prompts; temporaryPasswordCleared = -not [bool]$env:DMK_TEMP_REVIEWER_PASSWORD } | ConvertTo-Json -Compress -Depth 8
}
. $AccountPath
`);
function provision(flag:string|undefined,mode:string|undefined){
  const env:NodeJS.ProcessEnv={...process.env,DMK_FIXTURE_PASSWORD:password};
  delete env.DMK_HUMAN_REVIEWERS;delete env.DMK_TEMP_REVIEWER_PASSWORD;delete env.DMK_ENABLE_TEST_REVIEWER;delete env.NODE_ENV;
  if(flag!==undefined)env.DMK_ENABLE_TEST_REVIEWER=flag;if(mode!==undefined)env.NODE_ENV=mode;
  // Process-only policy for this generated test wrapper; no machine/user policy change.
  const result=spawnSync(process.platform==='win32'?'powershell.exe':'pwsh',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,path.resolve('account.ps1')],{env,encoding:'utf8',windowsHide:true,timeout:20000});
  assert.equal(result.status,0,`Provisioning failed: ${result.error?.message||result.stderr}`);
  // PowerShell's warning stream is rendered on stdout by the console host.
  const captured=JSON.parse(result.stdout.split(/\r?\n/).find(line=>line.startsWith('{'))!);assert.equal(captured.temporaryPasswordCleared,true);
  for(const record of Object.values(captured.roster) as any[]){
    assert.match(record.credentialVerifier,/^[a-f0-9]{32}:[a-f0-9]{64}$/);
    const [salt,hash]=record.credentialVerifier.split(':');assert.equal(scryptSync(password,salt,32).toString('hex'),hash);
    assert(!record.credentialVerifier.includes(password));
  }
  return captured;
}
async function governance(roster:any,securityExpected:boolean){
  const original=process.env.DMK_HUMAN_REVIEWERS;process.env.DMK_HUMAN_REVIEWERS=JSON.stringify(roster);
  const app=express();app.use(express.json());
  const store={projects:[{id:'fixture',stateVersion:0}],requirements:{fixture:[{id:'requirement',title:'Fixture requirement',statement:'Fixture must remain proposed until distinct human roles sign.',status:'PROPOSED'}]},approvals:{fixture:[]},addAuditEvent:()=>{}};
  try{registerSignoffRoutes(app,store);}finally{if(original===undefined)delete process.env.DMK_HUMAN_REVIEWERS;else process.env.DMK_HUMAN_REVIEWERS=original;}
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;let cookie='';
  const post=async(url:string,body:any,status=200)=>{const res=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});assert.equal(res.status,status);if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie')!.split(';')[0];return res.json();};
  try{
    await post('/api/governance/session',{username:'Gio',password:password+'wrong'},401);
    const session=await post('/api/governance/session',{username:'Gio',password});assert.deepEqual(session.identity.roles,['Lead Architect']);assert(!JSON.stringify(session).includes('credentialVerifier'));
    const request=await post('/api/projects/fixture/approvals',{targetEntityType:'REQUIREMENT',targetEntityId:'requirement'},201);
    assert.deepEqual(request.requiredRoles,['Security Officer','Lead Architect']);
    const decide=`/api/projects/fixture/approvals/${request.id}/decide`;
    assert.equal((await post(decide,{decision:'APPROVED',humanConfirmed:true})).status,'PENDING');
    await post(decide,{decision:'APPROVED',humanConfirmed:true},409);
    await post('/api/governance/session',{username:'SecurityTest',password},securityExpected?200:401);
    if(securityExpected)assert.equal((await post(decide,{decision:'APPROVED',humanConfirmed:true})).status,'APPROVED');
    else assert.equal(store.requirements.fixture[0].status,'PROPOSED');
  }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
}
try{
  const normal=provision(undefined,undefined);assert.deepEqual(Object.keys(normal.roster),['Gio'],'Normal startup must not provision SecurityTest');assert.equal(normal.prompts.length,1);await governance(normal.roster,false);
  console.log('PASS normal startup provisions Gio only; authentication works and missing Security Officer blocks quorum');
  for(const flag of ['','0','true',' 1','1 ']){const x=provision(flag,'development');assert.deepEqual(Object.keys(x.roster),['Gio']);assert.equal(x.prompts.length,1);await governance(x.roster,false);}
  console.log('PASS unset and malformed test flags do not provision a test identity or satisfy quorum');
  const enabled=provision('1','development');assert.deepEqual(Object.keys(enabled.roster).sort(),['Gio','SecurityTest']);assert.deepEqual(enabled.roster.SecurityTest.roles,['Security Officer']);assert.equal(enabled.roster.SecurityTest.kind,'HUMAN');assert.equal(enabled.prompts.length,2);await governance(enabled.roster,true);
  console.log('PASS explicit development mode uses securely generated separate reviewer credentials and distinct-role quorum');
  for(const mode of [undefined,'test'])assert(provision('1',mode).roster.SecurityTest);
  console.log('PASS explicit flag works for local dev startup and test environment');
  for(const mode of ['production','Production','unknown']){const x=provision('1',mode);assert.deepEqual(Object.keys(x.roster),['Gio']);await governance(x.roster,false);}
  console.log('PASS production and unknown environments reject test reviewer even with explicit flag');
  const again=provision('1','development');assert.notEqual(enabled.roster.Gio.credentialVerifier,again.roster.Gio.credentialVerifier);assert.notEqual(enabled.roster.Gio.credentialVerifier,enabled.roster.SecurityTest.credentialVerifier);
  console.log('PASS verifier salts are fresh per reviewer and run; temporary password environment is cleared');
}finally{
  // temp was created here with mkdtemp; no caller-provided deletion path.
  fs.rmSync(temp,{recursive:true,force:true});
}
