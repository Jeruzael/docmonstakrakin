import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const guard = fileURLToPath(new URL('./lib/bunLifecycleInventory.mjs', import.meta.url));
let api;
try { api = await import('./lib/bunLifecycleInventory.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
assert.ok(api, 'The dependency-free fail-closed Bun inventory guard must exist');
const header = 'bun pm untrusted v1.4.2 (744846f84)';
const footer = 'These dependencies had their lifecycle scripts blocked during install.\n\nIf you trust them and wish to run their scripts, use `bun pm trust`.';
const inventory = (entries = [['@google/genai', '2.22.0', 'preinstall', "echo 'preinstall: no-op'"], ['protobufjs', '7.6.6', 'postinstall', 'node scripts/postinstall']]) => `${header}\n\n${entries.map(([name, version, hook, command]) => `./node_modules/${name} @${version}\n » [${hook}]: ${command}`).join('\n\n')}\n\n${footer}\n`;
const raw = inventory();
let passed = 0;
function check(name, body) { body(); passed++; console.log('PASS ' + name); }
function run(input, args = []) { return spawnSync(process.execPath, [guard, ...args], {input, encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024, windowsHide: true}); }
function rejected(input, code = 'BUN_INVENTORY_INVALID') { const result = run(input); assert.equal(result.status, 1, result.stderr); assert.ok(result.stderr.includes(code), result.stderr); assert.equal(result.stdout, ''); }

check('actual Linux default blocked inventory is disclosed without granting lifecycle trust', () => {
  const result = run(raw); assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout.trim());
  assert.deepEqual(summary.blocked.map(entry => entry.name), ['@google/genai', 'protobufjs']);
  assert.equal(summary.lifecycleTrustChanged, false); assert.equal(summary.nativeLifecycleBlocked, false);
});
check('actual Windows separators CRLF and UTF8 BOM remain compatible', () => {
  const windows = raw.replaceAll('./node_modules/', '.\\node_modules\\').replace('@google/genai', '@google\\genai').replaceAll('\n', '\r\n');
  assert.equal(run(Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(windows)])).status, 0);
});
for (const name of ['better-sqlite3', 'argon2', 'esbuild']) check('blocked ' + name + ' fails the actual Node command', () => rejected(inventory([[name, '1.2.3', 'install', 'node build.js']]), 'BUN_NATIVE_LIFECYCLE_BLOCKED'));
check('valid non-native blocked scripts remain inert and are reported', () => {
  const result = api.inspectBunLifecycleInventory(Buffer.from(inventory([['other-package', '1.0.0-beta.1', 'prepare', 'do-not-execute-this']])));
  assert.deepEqual(result.blocked.map(entry => entry.name), ['other-package']);
});
check('empty whitespace and banner-only acquisition cannot pass', () => { for (const value of ['', ' \r\n', header + '\n']) rejected(value); });
check('truncated package records missing hooks or missing footer fail closed', () => {
  for (const value of [raw.replace(' » [postinstall]: node scripts/postinstall', ''), raw.slice(0, raw.indexOf('These dependencies')), `${header}\n${footer}`]) rejected(value);
});
check('unknown output malformed versions paths and controls cannot masquerade as inventory', () => {
  for (const value of [raw + 'error: inventory failed\n', ...['', '7', '7.6bad', '01.2.3', '1.2.3-01', '1.2.3_bad'].map(version => raw.replace('@7.6.6', '@' + version)), raw.replace('protobufjs @', '../protobufjs @'), raw.replace('protobufjs @', 'protobufjs\0 @'), raw.replace('v1.4.2', 'v9.0.0')]) rejected(value);
});
check('duplicate package records and unexpected lifecycle labels are rejected', () => {
  rejected(inventory([['protobufjs', '7.6.6', 'postinstall', 'a'], ['protobufjs', '7.6.6', 'postinstall', 'b']]));
  rejected(inventory([['protobufjs', '7.6.6', 'unknown-hook', 'a']]));
});
check('malformed UTF8 and oversized inventories reject before acceptance', () => { rejected(Buffer.from([255])); rejected(Buffer.alloc(65537, 97), 'BUN_INVENTORY_TOO_LARGE'); });
check('candidate byte and package admission limits are exact without truncation', () => {
  assert.equal(run(Buffer.concat([Buffer.from(raw), Buffer.alloc(65536 - Buffer.byteLength(raw), 10)])).status, 0);
  const entries = Array.from({length: 128}, (_, index) => ['pkg-' + index, '1.2.3', 'install', 'inert']);
  assert.equal(run(inventory(entries)).status, 0);
  rejected(inventory([...entries, ['pkg-128', '1.2.3', 'install', 'inert']]));
});
check('ANSI wrappers and unsupported control transformations are rejected', () => {
  rejected('\u001b[0m' + raw); rejected(raw.replace(' »', '\t\u001b[33m »'));
});
check('unknown CLI options and missing guard modules return nonzero', () => {
  assert.equal(run(raw, ['--ignore-native']).status, 1);
  const missing = spawnSync(process.execPath, [guard + '.missing'], {input: raw, encoding: 'utf8', timeout: 5000, windowsHide: true});
  assert.notEqual(missing.status, 0); assert.ok(missing.stderr.includes('MODULE_NOT_FOUND'));
});
check('native names cannot hide in Windows or nested package paths', () => {
  rejected(inventory([['argon2', '0.45.1', 'install', 'a']]).replaceAll('./node_modules/', '.\\node_modules\\'), 'BUN_NATIVE_LIFECYCLE_BLOCKED');
  rejected(inventory([['outer/node_modules/argon2', '0.45.1', 'install', 'a']]));
});
check('actual aliased CLI entry cannot skip admission or native rejection', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-bun-alias-'));
  const alias = path.join(directory, 'guard-link');
  fs.symlinkSync(path.dirname(guard), alias, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    const linked = path.join(alias, path.basename(guard));
    for (const input of ['malformed inventory', inventory([['argon2', '0.45.1', 'install', 'inert']])]) {
      const result = spawnSync(process.execPath, [linked], {input, encoding: 'utf8', timeout: 5000, windowsHide: true});
      assert.equal(result.error, undefined); assert.equal(result.status, 1); assert.equal(result.stdout, '');
    }
    const valid = spawnSync(process.execPath, [linked], {input: raw, encoding: 'utf8', timeout: 5000, windowsHide: true});
    assert.equal(valid.status, 0, valid.stderr); assert.ok(JSON.parse(valid.stdout).blocked.length);
  } finally {
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(fs.lstatSync(alias).isSymbolicLink());
    fs.unlinkSync(alias); fs.rmdirSync(directory);
  }
});
check('imported API stays inert instead of treating imports as CLI admission', () => {
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('./lib/bunLifecycleInventory.mjs', import.meta.url).href)})`], {input: 'malformed inventory', encoding: 'utf8', timeout: 5000, windowsHide: true});
  assert.equal(imported.status, 0, imported.stderr); assert.equal(imported.stdout, ''); assert.equal(imported.stderr, '');
});
function shellProvider(input, exit) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-bun-inventory-'));
  const provider = path.join(directory, 'provider.cjs');
  fs.writeFileSync(provider, `process.stdout.write(${JSON.stringify(input)}); process.exit(${exit});`);
  try {
    const env = {...process.env, GUARD_NODE: process.execPath, GUARD_PROVIDER: provider, GUARD_MODULE: guard};
    const command = process.platform === 'win32'
      ? "$ErrorActionPreference='Stop'; $utf8=[System.Text.UTF8Encoding]::new($false); [Console]::OutputEncoding=$utf8; $OutputEncoding=$utf8; $untrusted = & $env:GUARD_NODE $env:GUARD_PROVIDER; $trustExit=$LASTEXITCODE; if ($trustExit -ne 0) { throw 'BUN_ACQUISITION_FAILED' }; $untrusted | & $env:GUARD_NODE $env:GUARD_MODULE; if ($LASTEXITCODE -ne 0) { throw 'BUN_GUARD_FAILED' }"
      : 'set -e; untrusted=$("$GUARD_NODE" "$GUARD_PROVIDER"); printf "%s\\n" "$untrusted" | "$GUARD_NODE" "$GUARD_MODULE"';
    const result = spawnSync(process.platform === 'win32' ? 'pwsh.exe' : 'bash', process.platform === 'win32' ? ['-NoProfile', '-NonInteractive', '-Command', command] : ['-c', command], {env, encoding: 'utf8', timeout: 5000, windowsHide: true});
    assert.equal(result.error, undefined); return result;
  } finally { assert.equal(path.dirname(directory), os.tmpdir()); fs.rmSync(directory, {recursive: true}); }
}
check('provider failure is fatal even when its stdout resembles a valid inventory', () => {
  const result = shellProvider(raw, 7);
  assert.notEqual(result.status, 0); assert.equal(result.stdout.includes('lifecycleTrustChanged'), false);
});
check('real platform shell propagates guard rejection without a conditional test', () => {
  const result = shellProvider(inventory([['argon2', '0.45.1', 'install', 'a']]), 0);
  assert.notEqual(result.status, 0); assert.equal(result.stdout.includes('lifecycleTrustChanged'), false);
});
check('real platform shell admits the disclosed default blocked inventory', () => {
  const result = shellProvider(raw, 0);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()).blocked.map(entry => entry.name), ['@google/genai', 'protobufjs']);
});
console.log(`Bun lifecycle inventory: ${passed}/${passed} checks passed`);
