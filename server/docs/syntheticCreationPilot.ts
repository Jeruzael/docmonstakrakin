import express from 'express';
import type {Request,Response} from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import type {ReviewerIdentity} from '../proposals/identity.ts';
import type {AuditEvent,ControlledDocumentRecord} from '../../src/types.ts';
import {createChainedAuditEvent,verifyAuditLedgerChain} from '../security/auditImmutability.ts';
import {validateDocumentContent} from './controlledDocsValidator.ts';

interface PilotState {version:number;document:null|{record:ControlledDocumentRecord;content:string;sha256:string};audit:AuditEvent[]}
const digest=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const record:ControlledDocumentRecord={id:'DOC-SYNTHETIC-CREATED',path:'docs/synthetic-plan.md',title:'Synthetic controlled plan',kind:'CONTROL',authority:'REFERENCE',editability:'CONTROLLED_EDIT',editableLivingDoc:true,fileType:'MARKDOWN'};
const scope={scope:'SYNTHETIC_ONLY',operationalAuthority:false} as const;
// JSON may contain escaped unpaired UTF-16 surrogates even when its source bytes
// are valid UTF-8. Reject them before hashing: UTF-8 replaces them with U+FFFD.
const losslessText=(value:string)=>Buffer.from(value,'utf8').toString('utf8')===value;
const losslessJsonStrings=(value:unknown)=>{
  const pending:unknown[]=[value];
  while(pending.length){
    const item=pending.pop();
    if(typeof item==='string'){if(!losslessText(item))return false;}
    else if(item!==null && typeof item==='object'){
      for(const [key,child] of Object.entries(item)){if(!losslessText(key))return false;pending.push(child);}
    }
  }
  return true;
};

/** Disconnected candidate. Normal server.ts never imports this factory. */
export function createSyntheticDocumentCreationPilot(requireHuman:(req:Request,res:Response)=>ReviewerIdentity|undefined) {
  if(typeof requireHuman!=='function')throw new Error('TRUSTED_REVIEWER_RESOLVER_REQUIRED');
  const parent=fs.realpathSync.native(os.tmpdir());
  const parentIdentity=fs.lstatSync(parent,{bigint:true});
  const root=fs.mkdtempSync(path.join(parent,'dmk-controlled-creation-'));
  const identity=fs.lstatSync(root,{bigint:true});
  const admit=()=>{
    const currentParent=fs.lstatSync(parent,{bigint:true}),current=fs.lstatSync(root,{bigint:true});
    if(currentParent.isSymbolicLink() || !currentParent.isDirectory() || currentParent.dev!==parentIdentity.dev || currentParent.ino!==parentIdentity.ino || fs.realpathSync.native(parent)!==parent ||
      current.isSymbolicLink() || !current.isDirectory() || current.dev!==identity.dev || current.ino!==identity.ino || fs.realpathSync.native(root)!==root || path.dirname(root)!==parent)throw new Error('FIXTURE_REPLACED');
  };
  admit();
  if(process.platform==='win32'){
    const sid=/S-1-\d+(?:-\d+)+/.exec(execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true,timeout:5000}))?.[0];
    if(!sid)throw new Error('PRIVATE_FIXTURE_OWNER_UNAVAILABLE');
    admit();
    execFileSync('icacls.exe',[root,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`],{windowsHide:true,timeout:5000});
  }else if(process.platform==='linux')fs.chmodSync(root,0o700);else throw new Error('PRIVATE_FIXTURE_PLATFORM_UNSUPPORTED');
  admit();
  const owner=randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(root,'.owner'),owner,{flag:'wx',mode:0o600});
  const statePath=path.join(root,'state.json'),journalPath=path.join(root,'pending.json'),candidatePath=path.join(root,'candidate.json'),lockPath=path.join(root,'write.lock');
  admit();fs.writeFileSync(statePath,JSON.stringify({version:0,document:null,audit:[]}),{flag:'wx',mode:0o600});
  let fault='',closed=false;
  const guard=()=>{
    if(closed)throw new Error('FIXTURE_CLOSED');
    admit();
    let markerIdentity:fs.BigIntStats|undefined;
    for(const file of ['.owner','state.json','pending.json','candidate.json','write.lock']){
      const stat=fs.lstatSync(path.join(root,file),{throwIfNoEntry:false,bigint:true});
      if(stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1n))throw new Error('FIXTURE_FILE_UNTRUSTED');
      if(file==='.owner' && (!stat || stat.size!==64n || fs.realpathSync.native(path.join(root,file))!==path.join(root,file)))throw new Error('FIXTURE_OWNER_INVALID');
      if(file==='.owner')markerIdentity=stat;
    }
    const markerFd=fs.openSync(path.join(root,'.owner'),fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try{
      const opened=fs.fstatSync(markerFd,{bigint:true});
      if(!markerIdentity || !opened.isFile() || opened.nlink!==1n || opened.size!==64n || opened.dev!==markerIdentity.dev || opened.ino!==markerIdentity.ino)throw new Error('FIXTURE_OWNER_REPLACED');
      const bytes=Buffer.alloc(65);let length=0;
      while(length<bytes.length){const count=fs.readSync(markerFd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;}
      const marker=bytes.subarray(0,length).toString('utf8');
      if(length!==64 || !/^[a-f0-9]{64}$/.test(marker) || marker!==owner)throw new Error('FIXTURE_OWNER_INVALID');
    }finally{fs.closeSync(markerFd);}
  };
  const readBounded=(filename:string,maximum:number):Buffer=>{
    admit();const admitted=fs.lstatSync(filename,{bigint:true});
    if(!admitted.isFile() || admitted.isSymbolicLink() || admitted.nlink!==1n || admitted.size>BigInt(maximum) || fs.realpathSync.native(filename)!==filename)throw new Error('PRIVATE_FILE_ADMISSION_FAILED');
    const fd=fs.openSync(filename,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try{
      const opened=fs.fstatSync(fd,{bigint:true});
      if(!opened.isFile() || opened.nlink!==1n || opened.dev!==admitted.dev || opened.ino!==admitted.ino || opened.size!==admitted.size)throw new Error('PRIVATE_FILE_REPLACED');
      const bytes=Buffer.alloc(Number(opened.size)+1);let length=0;
      while(length<bytes.length){const count=fs.readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;}
      if(length!==Number(opened.size) || fs.fstatSync(fd,{bigint:true}).size!==opened.size)throw new Error('PRIVATE_FILE_CHANGED');
      return bytes.subarray(0,length);
    }finally{fs.closeSync(fd);}
  };
  const inspect=():PilotState=>{
    guard();
    const state=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(readBounded(statePath,128*1024))) as PilotState;
    if(!losslessJsonStrings(state))throw new Error('STATE_TEXT_ENCODING_INVALID');
    if(Object.keys(state).sort().join(',')!=='audit,document,version' || ![0,1].includes(state.version) || !Array.isArray(state.audit) || state.audit.length!==state.version ||
      (state.version===0 && state.document!==null) || (state.version===1 && (!state.document || JSON.stringify(state.document.record)!==JSON.stringify(record) || digest(state.document.content)!==state.document.sha256)) ||
      !verifyAuditLedgerChain(state.audit,'REVERSE_CHRONOLOGICAL').valid)throw new Error('STATE_INTEGRITY_FAILED');
    if(state.document && (state.audit[0].action!=='SYNTHETIC_DOCUMENT_CREATED' || state.audit[0].target!==record.id || state.audit[0].details?.sha256!==state.document.sha256 || state.audit[0].details?.projectId!=='PRJ-SYNTHETIC-CREATION' || state.audit[0].details?.scope!=='SYNTHETIC_ONLY'))throw new Error('STATE_AUDIT_BINDING_FAILED');
    return state;
  };
  const durable=(file:string,bytes:string)=>{const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
  const cleanup=()=>{for(const file of [candidatePath,journalPath,lockPath])if(fs.existsSync(file))fs.unlinkSync(file);};
  const recover=()=>{
    guard();
    if(!fs.existsSync(journalPath)){if(fs.existsSync(candidatePath) || fs.existsSync(lockPath))throw new Error('RECOVERY_UNCLASSIFIED_ARTIFACT');return;}
    const journal=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(readBounded(journalPath,4096)));
    if(Object.keys(journal).sort().join(',')!=='after,before' || !/^[a-f0-9]{64}$/.test(journal.before) || !/^[a-f0-9]{64}$/.test(journal.after))throw new Error('RECOVERY_JOURNAL_INVALID');
    const actual=digest(readBounded(statePath,128*1024));
    if(actual!==journal.before && actual!==journal.after)throw new Error('RECOVERY_STATE_CONFLICT');
    inspect();cleanup();
  };
  const router=express.Router();
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  router.get('/',(req,res)=>{if(!requireHuman(req,res))return;try{res.json({...scope,...inspect()});}catch{res.status(503).json({error:'FIXTURE_RECOVERY_REQUIRED',...scope});}});
  router.post('/create',(req,res)=>{
    const reviewer=requireHuman(req,res);if(!reviewer)return;
    if(reviewer.kind!=='HUMAN' || reviewer.roleSource!=='LOCAL_SERVER_ROSTER' || !reviewer.roles.some(role=>['Security Officer','Lead Architect'].includes(role)))return res.status(403).json({error:'HUMAN_AUTHORING_AUTHORITY_REQUIRED'});
    const body=req.body;
    if(!body || typeof body!=='object' || Object.keys(body).some(key=>!['content','reason','humanConfirmed','expectedVersion','expectedDigest'].includes(key)) ||
      typeof body.content!=='string' || !losslessText(body.content) || Buffer.byteLength(body.content)>64*1024 || typeof body.reason!=='string' || !losslessText(body.reason) || !body.reason.trim() || body.reason.length>1024 || body.humanConfirmed!==true)return res.status(422).json({error:'INVALID_CONTROLLED_CREATION'});
    if(!validateDocumentContent(record,Buffer.from(body.content),body.content).valid)return res.status(422).json({error:'DOCUMENT_VALIDATION_FAILED'});
    let fd:number|undefined,prepared=false,committed=false;
    try{
      const state=inspect();
      if(fs.existsSync(journalPath) || fs.existsSync(candidatePath))return res.status(503).json({error:'FIXTURE_RECOVERY_REQUIRED'});
      if(body.expectedVersion!==state.version || body.expectedDigest!==null || state.document)return res.status(409).json({error:'DOCUMENT_CREATION_STALE'});
      fd=fs.openSync(lockPath,'wx',0o600);
      const before=readBounded(statePath,128*1024),sha256=digest(body.content);
      const event=createChainedAuditEvent({actor:reviewer.name,action:'SYNTHETIC_DOCUMENT_CREATED',target:record.id,reason:body.reason.trim(),details:{projectId:'PRJ-SYNTHETIC-CREATION',identity:reviewer.id,sha256,scope:'SYNTHETIC_ONLY'}});
      const nextState={version:1,document:{record,content:body.content,sha256},audit:[event]};
      if(!losslessJsonStrings(nextState))return res.status(422).json({error:'STATE_TEXT_ENCODING_INVALID',...scope});
      const next=JSON.stringify(nextState);
      if(Buffer.byteLength(next)>128*1024)return res.status(422).json({error:'SERIALIZED_STATE_RESOURCE_LIMIT',...scope});
      durable(candidatePath,next);durable(journalPath,JSON.stringify({before:digest(before),after:digest(next)}));prepared=true;
      if(fault==='afterJournal'){fault='';throw new Error('INJECTED_PRECOMMIT_FAILURE');}
      guard();if(digest(readBounded(statePath,128*1024))!==digest(before))throw new Error('CREATION_CAS_CONFLICT');
      fs.renameSync(candidatePath,statePath);committed=true;
      if(fault==='afterCommit'){fault='';throw new Error('INJECTED_POSTCOMMIT_FAILURE');}
      fs.closeSync(fd);fd=undefined;cleanup();
      return res.status(201).json({...scope,...inspect()});
    }catch{
      return res.status(500).json({error:committed?'CREATION_OUTCOME_REQUIRES_RECOVERY':prepared?'CREATION_ROLLED_BACK_PENDING_CLEANUP':'CREATION_FAILED',...scope});
    }finally{if(fd!==undefined){fs.closeSync(fd);if(!prepared && fs.existsSync(lockPath))fs.unlinkSync(lockPath);}}
  });
  return {router,inspect,recover,rootDirectory:root,injectFault:(point:string)=>{if(!['afterJournal','afterCommit'].includes(point))throw new Error('UNKNOWN_FAULT_POINT');fault=point;},close:()=>{guard();closed=true;fs.rmSync(root,{recursive:true});}};
}
