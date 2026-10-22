import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { WorkspaceStore } from '../server/security/workspaceAccess/store.ts';
const Sqlite = createRequire(import.meta.url)('better-sqlite3');
const verifier = '$argon2id$v=19$m=32768,p=1,t=3$' + Buffer.alloc(16).toString('base64').replace(/=/g, '') + '$' + Buffer.alloc(32).toString('base64').replace(/=/g, '');
const sha = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let passed = 0, failed = 0;
async function check(name: string, fn: () => Promise<void>) { try { await fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); } }
async function temporary(fn: (root: string) => Promise<void>) {
  const parent = fs.realpathSync.native(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'dmk-admission-proof-')), original = fs.lstatSync(root, { bigint: true });
  try { await fn(root); } finally { const final = fs.lstatSync(root, { bigint: true }); assert.equal(path.dirname(root), parent); assert.equal(final.ino, original.ino); assert.equal(final.dev, original.dev); fs.rmSync(root, { recursive: true }); }
}
async function initialized(root: string) {
  const store = await WorkspaceStore.open(root, { initialize: true });
  try { await store.execute({ command: 'bootstrap', principal: { id: 'SYNTHETIC-OWNER', name: 'synthetic-owner', personId: 'SYNTHETIC-PERSON', kind: 'HUMAN', roles: [], disabled: false, canCreateProjects: false, credentialRevision: 1 }, verifier }); }
  finally { await store.close(); }
}
await check('AP01 rejected foreign prepared DELETE database retains exact original bytes', () => temporary(async source => {
  await initialized(source); await temporary(async destination => {
    const empty = await WorkspaceStore.open(destination, { initialize: true }); await empty.close();
    const sourceFile = path.join(source, '.security/authority.sqlite'), destinationFile = path.join(destination, '.security/authority.sqlite');
    fs.copyFileSync(sourceFile, destinationFile);
    const prepared = new Sqlite(destinationFile); try { prepared.pragma('journal_mode=DELETE'); } finally { prepared.close(); }
    const before = sha(destinationFile), header = fs.readFileSync(destinationFile).subarray(0, 100);
    assert.equal(header[18], 1); assert.equal(header[19], 1);
    await assert.rejects(WorkspaceStore.open(destination), (error: any) => error.code === 'WORKSPACE_PATH_INVALID');
    assert.equal(sha(destinationFile), before); assert.deepEqual(fs.readFileSync(destinationFile).subarray(0, 100), header);
    assert.equal(fs.existsSync(path.join(destination, '.security/owner.lock')), false);
  });
}));
await check('AP02 rejected invalid audit in DELETE database retains exact original bytes', () => temporary(async root => {
  await initialized(root); const file = path.join(root, '.security/authority.sqlite'), altered = new Sqlite(file);
  try { altered.pragma('journal_mode=DELETE'); altered.prepare('UPDATE audit SET hash=? WHERE sequence=(SELECT max(sequence) FROM audit)').run('0'.repeat(64)); }
  finally { altered.close(); }
  const before = sha(file), header = fs.readFileSync(file).subarray(0, 100);
  await assert.rejects(WorkspaceStore.open(root), (error: any) => error.code === 'WORKSPACE_AUDIT_INVALID');
  assert.equal(sha(file), before); assert.deepEqual(fs.readFileSync(file).subarray(0, 100), header);
  assert.equal(fs.existsSync(path.join(root, '.security/owner.lock')), false);
}));
console.log(`Workspace admission provenance: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
