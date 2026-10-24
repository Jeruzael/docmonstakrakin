'use strict';
// Pure parser: receives bytes, never a database pathname. No authority actions.
const crypto = require('node:crypto');
const { PROJECT_ACTIONS, HUMAN_ROLES, SELF_PROJECT_ID } = require('./projectPolicy.cjs');
const SCHEMA_SHA256 = '11db824c5cd6308dfca1fbd9e815a09cdb79c530ed889651edcbf3cecef2c909';
const LIMITS = Object.freeze({ principals:128, memberships:512, sessions:256, used_digests:4096, operations:4096, throttle:128, audit:4096 });
const MAX_BYTES = 256 * 1024 * 1024, MAX_SNAPSHOT = 64 * 1024 * 1024;
const SHA = /^[a-f0-9]{64}$/, ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/, UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const COLLECTIONS = ['managedDocuments','verificationSessions','verificationArchives','importSessions','questions','requirements','adrs','components','risks','threats','standards','workItems','evidence','auditLogs','overrides','approvals','agentRoles','agentRuns','features','derivations','documents'];
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
function fail(code = 'CAPACITY_IMAGE_INVALID') { const error = Error(code); error.code = code; throw error; }
function integer(v, minimum = 0) { if (!Number.isSafeInteger(v) || v < minimum) fail(); }
function exact(v, keys, optional = []) { if (!v || Object.getPrototypeOf(v)!==Object.prototype || keys.some(k=>!Object.hasOwn(v,k)) || Object.keys(v).some(k=>!keys.includes(k)&&!optional.includes(k))) fail(); }
function bounded(v, max) { if(typeof v!=='string' || Buffer.byteLength(v)>max) fail(); return v; }
// Parse bounded JSON without silently accepting duplicate decoded keys.
function parse(raw, maximum) {
  bounded(raw,maximum); let i=0;
  const white=()=>{while(i<raw.length && /[\x20\x09\x0a\x0d]/.test(raw[i]))i++;};
  function quoted() {
    const start=i; if(raw[i++]!=='"')fail();
    while(i<raw.length){if(raw[i]==='"'){i++;return JSON.parse(raw.slice(start,i));}if(raw.charCodeAt(i)<32)fail();i+=raw[i]==='\\'?2:1;}fail();
  }
  const primitive=/(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  function walk(depth){
    if(depth>64)fail();white();const c=raw[i];
    if(c==='{'||c==='['){
      const object=c==='{',close=object?'}':']',keys=new Set();i++;white();if(raw[i]===close){i++;return;}
      for(;;){if(object){white();const key=quoted();if(keys.has(key)||['__proto__','prototype','constructor','toJSON'].includes(key))fail();keys.add(key);white();if(raw[i++]!==':')fail();}walk(depth+1);white();if(raw[i]===close){i++;return;}if(raw[i++]!==',')fail();}
    }
    if(c==='"'){quoted();return;}primitive.lastIndex=i;const match=primitive.exec(raw);if(!match||/^-?\d/.test(match[0])&&!Number.isFinite(Number(match[0])))fail();i=primitive.lastIndex;
  }
  walk(0);white();if(i!==raw.length)fail();return JSON.parse(raw);
}
function snapshot(raw) {
  if(raw===null)return {state:{projects:[]}};
  const value=parse(raw,MAX_SNAPSHOT);exact(value,['schemaVersion','state']);if(value.schemaVersion!==1)fail();exact(value.state,['projects'],COLLECTIONS);
  if(!Array.isArray(value.state.projects))fail();const ids=new Set();
  for(const project of value.state.projects){if(!project||typeof project!=='object'||Array.isArray(project)||!ID.test(project.id)||ids.has(project.id))fail();ids.add(project.id);}
  const bind=(node,id)=>{if(node&&typeof node==='object'){if(Object.hasOwn(node,'projectId')&&node.projectId!==id)fail();for(const child of Object.values(node))bind(child,id);}};
  for(const key of COLLECTIONS)if(Object.hasOwn(value.state,key)){
    const collection=value.state[key];if(!collection||Object.getPrototypeOf(collection)!==Object.prototype)fail();
    for(const id of Object.keys(collection)){if(!ids.has(id)||!collection[id]||typeof collection[id]!=='object')fail();bind(collection[id],id);}
  }
  return value;
}
function inspectCapacityImage(bytes, source) {
  let db;
  try {
    if(!Buffer.isBuffer(bytes)||bytes.length<4096||bytes.length>MAX_BYTES||bytes.length%4096||bytes.subarray(0,16).toString('binary')!=='SQLite format 3\0'||bytes[18]!==1||bytes[19]!==1)fail('CAPACITY_IMAGE_UNSUPPORTED');
    exact(source,['workspaceIdentity','privateIdentity']);
    if(!/^\d+:\d+$/.test(source.workspaceIdentity)||!/^\d+:\d+$/.test(source.privateIdentity))fail('CAPACITY_PROVENANCE_INVALID');
    // The pinned constructor maps Buffer to :memory:, and native Deserialize
    // sets SQLITE_DESERIALIZE_READONLY. It does not receive the source path.
    const Sqlite=require('better-sqlite3');
    if(require('better-sqlite3/package.json').version!=='13.0.3')fail('CAPACITY_NATIVE_UNSUPPORTED');
    db=new Sqlite(bytes,{readonly:true,timeout:0});
    if(!db.readonly||!db.memory||db.name!==':memory:'||db.prepare('SELECT sqlite_version() AS v').get().v!=='3.53.4')fail('CAPACITY_NATIVE_UNSUPPORTED');
    db.pragma('trusted_schema=OFF'); db.pragma('query_only=ON'); db.pragma('temp_store=MEMORY');
    if(db.pragma('trusted_schema',{simple:true})!==0||db.pragma('query_only',{simple:true})!==1)fail('CAPACITY_NATIVE_UNSUPPORTED');
    const schema=db.prepare('SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name').all();
    if(sha(JSON.stringify(schema))!==SCHEMA_SHA256||db.pragma('user_version',{simple:true})!==1||db.pragma('page_size',{simple:true})!==4096||db.pragma('page_count',{simple:true})*4096!==bytes.length)fail('CAPACITY_SCHEMA_UNSUPPORTED');
    const counts={};
    for(const [table,max] of Object.entries(LIMITS)){counts[table]=db.prepare('SELECT count(*) AS n FROM '+table).get().n;integer(counts[table]);if(counts[table]>max)fail('CAPACITY_BOUND_EXCEEDED');}
    const integrity=db.pragma('integrity_check(1)');
    if(integrity.length!==1||integrity[0].integrity_check!=='ok'||db.pragma('foreign_key_check').length)fail();
    const rows=db.prepare('SELECT * FROM metadata').all();if(rows.length!==1)fail();const m=rows[0];
    if(m.id!==1||![0,1].includes(m.initialized)||(m.initialized===0)!==(counts.principals===0))fail();
    for(const key of ['generation','policyRevision','snapshotRevision','clockHighWater'])integer(m[key]);
    if(m.generation<1||m.generation===Number.MAX_SAFE_INTEGER||m.clockHighWater>Number.MAX_SAFE_INTEGER-1800000||(m.stateJson===null)!==(m.snapshotRevision===0))fail();
    const p=parse(m.provenance,4096);
    exact(p,['schema','node','platform','arch','sqlite','betterSqlite3','workspaceIdentity','privateIdentity','initialStateSha256']);
    const version=typeof p.node==='string'&&/^22\.(\d+)\.(\d+)$/.exec(p.node);
    if(p.schema!=='WORKSPACE_AUTHORITY/1'||p.workspaceIdentity!==source.workspaceIdentity||p.privateIdentity!==source.privateIdentity||
      p.sqlite!=='3.53.4'||p.betterSqlite3!=='13.0.3'||p.arch!=='x64'||!['linux','win32'].includes(p.platform)||!version||+version[1]<23||+version[1]===23&&+version[2]<3||
      p.initialStateSha256!==null&&!SHA.test(p.initialStateSha256))fail('CAPACITY_PROVENANCE_INVALID');
    const projects=new Set(snapshot(m.stateJson).state.projects.map(p=>p.id)),principals=new Map();
    for(const row of db.prepare('SELECT * FROM principals').iterate()){
      if(!ID.test(row.id)||!ID.test(row.personId)||typeof row.name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,63}$/.test(row.name)||![0,1].includes(row.disabled)||![0,1].includes(row.canCreateProjects))fail();
      integer(row.credentialRevision,1);
      const roles=parse(row.roles,4096);if(!Array.isArray(roles)||new Set(roles).size!==roles.length||roles.some(r=>!HUMAN_ROLES.includes(r)))fail();
      const verifier=typeof row.verifier==='string'&&/^\$argon2id\$v=19\$m=32768,p=1,t=3\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(row.verifier);
      if(!verifier||![16,32].every((n,i)=>{const b=Buffer.from(verifier[i+1],'base64');return b.length===n&&b.toString('base64').replace(/=/g,'')===verifier[i+1];}))fail();
      principals.set(row.id,row);
    }
    for(const row of db.prepare('SELECT * FROM memberships').iterate()){
      const denied=parse(row.deniedActions,4096);
      if(!projects.has(row.projectId)||!principals.has(row.principalId)||!['OWNER','EDITOR','READER','DENY'].includes(row.role)||row.projectId===SELF_PROJECT_ID&&['OWNER','EDITOR'].includes(row.role)||
        !Array.isArray(denied)||new Set(denied).size!==denied.length||denied.some(a=>![...PROJECT_ACTIONS,'project:create'].includes(a)))fail();
    }
    const digests=new Set();
    for(const row of db.prepare('SELECT digest FROM used_digests').iterate()){if(!SHA.test(row.digest))fail();digests.add(row.digest);}
    let active=0,revoked=0,expiredOrStale=0;
    for(const row of db.prepare('SELECT * FROM sessions').iterate()){
      for(const k of ['generation','credentialRevision'])integer(row[k],1);for(const k of ['issuedAt','lastSeenAt'])integer(row[k]);
      const principal=principals.get(row.principalId);
      if(!SHA.test(row.digest)||!digests.has(row.digest)||!principal||row.generation>m.generation||row.credentialRevision>principal.credentialRevision||
        row.lastSeenAt<row.issuedAt||row.lastSeenAt>m.clockHighWater||![0,1].includes(row.revoked))fail();
      if(row.revoked)revoked++;
      else if(principal.disabled||row.generation!==m.generation||row.credentialRevision!==principal.credentialRevision||m.clockHighWater-row.lastSeenAt>=600000||m.clockHighWater-row.issuedAt>=1800000)expiredOrStale++;
      else active++;
    }
    for(const row of db.prepare('SELECT * FROM throttle').iterate()){
      integer(row.windowStart);integer(row.attempts);if(row.windowStart>m.clockHighWater||row.attempts>31||row.key!=='global'&&!SHA.test(row.key))fail();
    }
    for(const row of db.prepare('SELECT * FROM operations').iterate()){integer(row.snapshotRevision,1);if(!UUID.test(row.operationId)||row.snapshotRevision>m.snapshotRevision)fail();}
    let head='0'.repeat(64),sequence=0,last={at:0,generation:0,policyRevision:0,snapshotRevision:0};
    for(const row of db.prepare('SELECT * FROM audit ORDER BY sequence').iterate()){
      bounded(row.raw,4096);
      if(row.sequence!==++sequence||row.previousHash!==head||!SHA.test(row.hash)||row.hash!==sha(head+'\n'+row.raw))fail('CAPACITY_AUDIT_INVALID');
      const data=parse(row.raw,4096);exact(data,['type','targetHash','at','generation','policyRevision','snapshotRevision']);
      if(typeof data.type!=='string'||!/^[A-Z_]{1,64}$/.test(data.type)||data.targetHash!==null&&!SHA.test(data.targetHash))fail('CAPACITY_AUDIT_INVALID');
      for(const key of ['at','generation','policyRevision','snapshotRevision']){integer(data[key]);if(data[key]<last[key]||data[key]>m[key==='at'?'clockHighWater':key])fail('CAPACITY_AUDIT_INVALID');}
      last=data;head=row.hash;
    }
    const tail=db.prepare('SELECT name,seq FROM sqlite_sequence').all();
    if(sequence<1||tail.length!==1||tail[0].name!=='audit'||tail[0].seq!==sequence||['generation','policyRevision','snapshotRevision'].some(k=>last[k]!==m[k]))fail('CAPACITY_AUDIT_INVALID');
    const remaining={audit:4096-counts.audit,operations:4096-counts.operations,used_digests:4096-counts.used_digests};
    return {schemaVersion:1,initialized:!!m.initialized,bytes:bytes.length,databaseSha256:sha(bytes),schemaSha256:SCHEMA_SHA256,provenanceSha256:sha(m.provenance),
      generation:m.generation,policyRevision:m.policyRevision,snapshotRevision:m.snapshotRevision,clockHighWater:m.clockHighWater,
      counts,remaining,sessions:{activeAtStoredClock:active,revoked,expiredOrStaleAtStoredClock:expiredOrStale},audit:{lastSequence:sequence,headHash:head},full:Object.values(remaining).some(n=>n===0)};
  } catch(error) {
    if(typeof error?.code==='string'&&/^CAPACITY_[A-Z_]+$/.test(error.code))throw error;
    fail();
  } finally {if(db)db.close();}
}
module.exports={inspectCapacityImage,MAX_BYTES};
