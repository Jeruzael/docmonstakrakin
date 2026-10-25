import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import express from 'express';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import argon from 'argon2';
import {ProjectStore} from '../../server/projectStore.ts';
import {snapshotProjectStore} from '../../server/projectPersistence.ts';
import {WorkspaceStore} from '../../server/security/workspaceAccess/store.ts';
import {WorkspaceAgentService} from '../../server/security/workspaceAccess/agentService.ts';
import {workspaceTokenDigest} from '../../server/security/workspaceAccess/service.ts';
import {BoundedVerifier} from '../../server/security/syntheticFoundations/boundedVerifier.ts';
import {installAgentReadHttp} from '../../server/security/workspaceAccess/agentHttp.ts';
import {createPrivateDirectory} from '../../server/security/workspaceAccess/privateDirectory.ts';

/** Disposable native schema-3 authority; never acquires an existing pilot or operator path. */
export async function mcpAuthorityFixture(){
 const parent=fs.realpathSync.native(os.tmpdir()),directory=fs.mkdtempSync(path.join(parent,'dmk-mcp-authority-'));
 let store:WorkspaceStore|undefined,service:WorkspaceAgentService|undefined,handlers:ReturnType<typeof installAgentReadHttp>|undefined,server:https.Server|undefined;
 const close=async()=>{handlers?.close();service?.close();if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}await store?.close();if(fs.existsSync(directory)){if(path.dirname(fs.realpathSync.native(directory))!==parent||fs.lstatSync(directory).isSymbolicLink())throw Error('FIXTURE_PATH_CHANGED');fs.rmSync(directory,{recursive:true,force:true});}};
 try{
  const state=new ProjectStore(),template=structuredClone(state.projects[0]);
  for(const key of Object.keys(state))(state as any)[key]=key==='projects'?[]:{};
  template.id='PRJ-MCP-SYNTHETIC';template.name='Synthetic MCP qualification';state.projects.push(template);
  state.workItems[template.id]=[{id:'TASK-ALLOWED',title:'Synthetic task',description:'Untrusted synthetic project data',status:'PROPOSED',priority:'P1',updatedAt:'2026-10-25T00:00:00.000Z'} as any];
  const verifier=await new BoundedVerifier(argon).hash('Disposable-'+randomBytes(24).toString('hex'));
  store=await WorkspaceStore.open(directory,{initialize:true,actionReceipts:true,agentDelegation:true});
  await store.execute({command:'bootstrap',principal:{id:'synthetic-mcp-sponsor',name:'synthetic-mcp-sponsor',personId:'synthetic-mcp-person',kind:'HUMAN',roles:[],disabled:false,credentialRevision:1,canCreateProjects:true},verifier,stateJson:JSON.stringify(snapshotProjectStore(state))});
  await store.execute({command:'membership',principalId:'synthetic-mcp-sponsor',projectId:template.id,role:'OWNER',deniedActions:[]});
  const sponsor=randomBytes(32).toString('hex'),credential=await store.execute({command:'credential',name:'synthetic-mcp-sponsor'});
  await store.execute({command:'issue',principalId:'synthetic-mcp-sponsor',expectedCredentialRevision:1,expectedGeneration:credential.generation,digest:workspaceTokenDigest(sponsor)!,now:Date.now()});
  service=new WorkspaceAgentService(store);let revision=(await store.execute({command:'info'})).policyRevision;
  const manage=async(action:'enrollAgent'|'registerAgentClient'|'grantAgent'|'issueAgent'|'revokeAgentGrant',input:any)=>{const result=await (service as any)[action](sponsor,{...input,expectedPolicyRevision:revision,operationId:randomUUID()});if(!result.accepted)throw Error('SYNTHETIC_SPONSOR_OPERATION_FAILED');revision=result.result.acknowledgment.policyRevision;return result;};
  const agentId=(await manage('enrollAgent',{projectId:template.id,name:'synthetic-mcp-agent'})).result.acknowledgment.agentId;
  const clientId=(await manage('registerAgentClient',{projectId:template.id,agentId,name:'synthetic-mcp-client'})).result.acknowledgment.clientId;
  const grantId=(await manage('grantAgent',{projectId:template.id,agentId,clientId,scope:{kind:'TASKS',taskIds:['TASK-ALLOWED']},actions:['task:read'],expiresAt:Date.now()+180000})).result.acknowledgment.grantId;
  const token=(await manage('issueAgent',{grantId,expectedGrantRevision:1})).token as string;
  const privateRoot=path.join(directory,'credentials');createPrivateDirectory(privateRoot);
  const keyPath=path.join(privateRoot,'loopback.key'),caPath=path.join(privateRoot,'loopback.crt'),configPath=path.join(privateRoot,'config.json'),tokenPath=path.join(privateRoot,'token');
  const config=path.join(privateRoot,'openssl.cnf');fs.writeFileSync(config,'[req]\nprompt=no\ndistinguished_name=subject\n[subject]\nCN=Disposable MCP authority\n',{mode:0o600});
  const openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'/usr/bin/openssl';
  execFileSync(openssl,['req','-new','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-sha256','-days','2','-config',config,'-addext','subjectAltName=IP:127.0.0.1','-keyout',keyPath,'-out',caPath],{stdio:'pipe',windowsHide:true,timeout:10000});fs.chmodSync(caPath,0o600);
  const app=express();app.use(express.json({limit:'16kb'}));handlers=installAgentReadHttp(app,service);
  server=https.createServer({key:fs.readFileSync(keyPath),cert:fs.readFileSync(caPath),minVersion:'TLSv1.3'},app);
  await new Promise<void>(r=>server!.listen(0,'127.0.0.1',r));
  const origin=`https://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,ca=fs.readFileSync(caPath);
  fs.writeFileSync(tokenPath,token,{mode:0o600});fs.writeFileSync(configPath,JSON.stringify({origin,caPath,tokenPath}),{mode:0o600});
  return{origin,ca,token,configPath,projectId:template.id,taskId:'TASK-ALLOWED',revoke:()=>manage('revokeAgentGrant',{grantId}),close};
 }catch(error){await close();throw error;}
}
