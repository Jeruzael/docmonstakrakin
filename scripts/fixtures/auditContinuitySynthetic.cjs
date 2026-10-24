'use strict';
// SYNTHETIC ONLY. Test mechanics use genuine SQLite CAS and Ed25519 signatures.
// This fixture is not a production custody/currentness provider.
const fs=require('node:fs'),crypto=require('node:crypto'),Sqlite=require('better-sqlite3');
const C=require('../../server/security/workspaceAccess/continuity/contracts.cjs');
function initialPointer(overrides={}){return {authorityId:crypto.randomUUID(),epoch:1,dbSha256:'0'.repeat(64),historyRoot:null,segments:0,generation:1,policyRevision:1,snapshotRevision:1,clockHighWater:0,...overrides};}
class SyntheticAnchor{
  static reopen(file,trust,privateKeyPem){
    const value=Object.create(SyntheticAnchor.prototype);value.trust=trust;value.keys={privateKey:crypto.createPrivateKey(privateKeyPem)};value.fault=null;
    value.db=new Sqlite(file,{timeout:0});value.db.pragma('journal_mode=DELETE');value.db.pragma('synchronous=FULL');return value;
  }
  constructor(file,pointer,keys=crypto.generateKeyPairSync('ed25519'),lineageId=crypto.randomUUID()){
    this.keys=keys;this.fault=null;
    this.trust={lineageId,keyId:C.sha(keys.publicKey.export({type:'spki',format:'der'})),publicKeyPem:keys.publicKey.export({type:'spki',format:'pem'}),domain:'SYNTHETIC',revokedKeyIds:[]};
    const fd=fs.openSync(file,'wx',0o600);fs.closeSync(fd);
    this.db=new Sqlite(file);this.db.pragma('journal_mode=DELETE');this.db.pragma('synchronous=FULL');
    this.db.exec('CREATE TABLE current(id INTEGER PRIMARY KEY CHECK(id=1),raw TEXT NOT NULL);CREATE TABLE transitions(id TEXT PRIMARY KEY,requestHash TEXT NOT NULL,raw TEXT NOT NULL)');
    this.db.prepare('INSERT INTO current VALUES(1,?)').run(C.canonical({revision:0,pointer}));
  }
  state(){return JSON.parse(this.db.prepare('SELECT raw FROM current').get().raw);}
  receipt(nonce,resolution=null){
    const issuedAt=Date.now()+(this.fault==='stale'?-60000:this.fault==='future'?60000:0);
    const payload={schema:'AUDIT_ANCHOR_RECEIPT/1',domain:'SYNTHETIC',lineageId:this.trust.lineageId,keyId:this.trust.keyId,nonce:this.fault==='nonce'?'0'.repeat(64):nonce,issuedAt,expiresAt:issuedAt+30000,state:this.state(),resolution};
    let signature=crypto.sign(null,Buffer.from(C.canonical(payload)),this.keys.privateKey).toString('base64');
    if(this.fault==='signature')signature=Buffer.alloc(64).toString('base64');
    return {payload,signature};
  }
  async observe(request){if(this.fault==='unavailable')throw Error('SYNTHETIC_ANCHOR_UNAVAILABLE');return this.receipt(request.nonce);}
  async compareAndSwap({proposal,nonce}){
    const requestHash=C.sha(C.canonical(proposal));
    const resolution=this.db.transaction(()=>{
      const prior=this.db.prepare('SELECT requestHash,raw FROM transitions WHERE id=?').get(proposal.transitionId);
      if(prior){if(prior.requestHash!==requestHash)throw Error('SYNTHETIC_CAS_CONFLICT');return JSON.parse(prior.raw);}
      const current=this.state();
      if(current.revision!==proposal.expectedRevision||C.canonical(current.pointer)!==C.canonical(proposal.expectedPointer))throw Error('SYNTHETIC_CAS_CONFLICT');
      const value={proposal,requestHash,committedRevision:current.revision+1};
      this.db.prepare('INSERT INTO transitions VALUES(?,?,?)').run(proposal.transitionId,requestHash,C.canonical(value));
      this.db.prepare('UPDATE current SET raw=? WHERE id=1').run(C.canonical({revision:current.revision+1,pointer:proposal.nextPointer}));
      return value;
    }).immediate();
    if(this.fault==='lost-ack')throw Error('SYNTHETIC_LOST_ACK_AFTER_DURABLE_CAS');
    return this.receipt(nonce,resolution);
  }
  async resolve({transitionId,requestHash,nonce}){
    const row=this.db.prepare('SELECT requestHash,raw FROM transitions WHERE id=?').get(transitionId);
    if(row&&row.requestHash!==requestHash)throw Error('SYNTHETIC_RESOLVE_CONFLICT');
    return this.receipt(nonce,row?JSON.parse(row.raw):null);
  }
  // Represents an independently committed source/revocation change in tests.
  advance(pointer){const current=this.state();this.db.prepare('UPDATE current SET raw=? WHERE id=1').run(C.canonical({revision:current.revision+1,pointer}));}
  close(){this.db.close();}
}
module.exports={SyntheticAnchor,initialPointer};
