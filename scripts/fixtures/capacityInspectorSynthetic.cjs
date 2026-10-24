'use strict';
// Test-only synthetic authorities. This never reads an operator database.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Sqlite = require('better-sqlite3');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function fixture(options = {}) {
  const db = new Sqlite(':memory:');
  const worker = fs.readFileSync(path.join(__dirname, '../../server/security/workspaceAccess/worker.cjs'), 'utf8');
  const schema = worker.slice(worker.indexOf('const SCHEMA = {'), worker.indexOf('\n};', worker.indexOf('const SCHEMA = {')));
  const statements = [...schema.matchAll(/\w+: '(CREATE TABLE[^']*)'/g)].map(match => match[1]);
  if (statements.length !== 8) throw Error('Fixture schema unavailable');
  db.exec(statements.join(';') + ';PRAGMA user_version=1');
  const provenance = { schema: 'WORKSPACE_AUTHORITY/1', node: '22.23.3', platform: process.platform, arch: 'x64', sqlite: '3.53.4', betterSqlite3: '13.0.3',
    workspaceIdentity: options.workspaceIdentity || '1:2', privateIdentity: options.privateIdentity || '1:3', initialStateSha256: null };
  db.prepare('INSERT INTO metadata VALUES(1,1,1,1,1,0,?,?)').run(JSON.stringify({schemaVersion:1,state:{projects:[]}}), JSON.stringify(provenance));
  const verifier = '$argon2id$v=19$m=32768,p=1,t=3$' + Buffer.alloc(16).toString('base64').replace(/=/g,'') + '$' + Buffer.alloc(32).toString('base64').replace(/=/g,'');
  db.prepare('INSERT INTO principals VALUES(?,?,?,?,0,0,1,?)').run('SYNTHETIC-OWNER','synthetic-owner','SYNTHETIC-PERSON','[]',verifier);
  let head = '0'.repeat(64);
  db.transaction(() => {
    for (let i = 0; i < (options.audit ?? 2); i++) {
      const raw = JSON.stringify({type:i ? 'SYNTHETIC_EVENT':'AUTHORITY_OPENED',targetHash:null,at:0,generation:1,policyRevision:1,snapshotRevision:1});
      const next = hash(head + '\n' + raw); db.prepare('INSERT INTO audit(raw,previousHash,hash) VALUES(?,?,?)').run(raw,head,next); head = next;
    }
    for (let i = 0; i < (options.digests ?? 0); i++) db.prepare('INSERT INTO used_digests VALUES(?)').run(hash('SYNTHETIC-' + i));
    for (let i = 0; i < (options.operations ?? 0); i++) db.prepare('INSERT INTO operations VALUES(?,1)').run(crypto.randomUUID());
  })();
  return db;
}
module.exports = { fixture, hash };
