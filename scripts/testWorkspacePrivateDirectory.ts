/** Genuine native filesystem fixtures; no operator authority or token changes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const boundary = createRequire(import.meta.url)('../server/security/workspaceAccess/privateBoundary.cjs');
const parent = fs.realpathSync.native(os.tmpdir());
const root = fs.mkdtempSync(path.join(parent, 'dmk-private-directory-'));
let passed = 0, failed = 0;
function check(name: string, run: () => void) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); }
}
async function checkAsync(name: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); }
}
function powershell(code: string): string {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';" + code, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true, timeout: 8000, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PSModulePath: path.join(process.env.WINDIR || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/Modules') } }).trim();
}
const literal = (file: string) => "'" + file.replaceAll("'", "''") + "'";
const sid = process.platform === 'win32'
  ? /S-1-\d+(?:-\d+)+/.exec(execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }))![0] : '';
function observation(file: string) {
  if (process.platform !== 'win32') { const s = fs.statSync(file); return { uid: s.uid, mode: s.mode & 0o777 }; }
  return JSON.parse(powershell(`$a=Get-Acl -LiteralPath ${literal(file)};[ordered]@{owner=$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;protected=$a.AreAccessRulesProtected;sddl=$a.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access);rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{[ordered]@{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();inherited=$_.IsInherited;rights=[int]$_.FileSystemRights}})}|ConvertTo-Json -Depth 5 -Compress`));
}
function foreignGrants(file: string) {
  if (process.platform !== 'win32') { fs.chmodSync(file, 0o755); return; }
  // Include explicit foreign grants, not merely an inheritance flag. The hosted
  // Admin-enabled fixture retained all three grants after both icacls commands.
  powershell(`$d=New-Object System.Security.AccessControl.DirectorySecurity;$d.SetAccessRuleProtection($true,$false);foreach($id in @('${sid}','S-1-5-18','S-1-5-32-544')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule([System.Security.Principal.SecurityIdentifier]::new($id),'FullControl','ContainerInherit,ObjectInherit','None','Allow');$d.AddAccessRule($r)};[System.IO.Directory]::SetAccessControl(${literal(file)},$d)`);
}
function assertPrivate(file: string, directory: boolean) {
  const value = observation(file);
  if (process.platform !== 'win32') { assert.equal(value.uid, process.getuid!()); assert.equal(value.mode, directory ? 0o700 : 0o600); return; }
  assert.equal(value.owner, sid);
  if (directory) assert.equal(value.protected, true);
  assert.equal(value.rules.length, 1);
  assert.deepEqual(value.rules.map((rule: any) => [rule.sid, rule.type, rule.rights]), [[sid, 'Allow', 2032127]]);
}
try {
  check('PD01 fresh creator excludes foreign inherited grants and preserves native ownership', () => {
    const container = path.join(root, 'foreign-parent'); fs.mkdirSync(container); foreignGrants(container);
    const before = observation(container), child = path.join(container, 'new-private');
    assert.equal(typeof boundary.createPrivateDirectory, 'function', 'exclusive private-directory creator missing');
    boundary.createPrivateDirectory(child); assertPrivate(child, true);
    assert.deepEqual(observation(container), before, 'parent ACL must not be repaired');
    const file = path.join(child, 'synthetic.txt'); fs.writeFileSync(file, 'synthetic-only', { flag: 'wx', mode: 0o600 });
    assertPrivate(file, false); assert.equal(fs.readFileSync(file, 'utf8'), 'synthetic-only');
    boundary.assertPrivateFile(file);
  });
  check('PD02 exclusive creation refuses an existing permissive directory without changing its ACL or bytes', () => {
    const existing = path.join(root, 'preexisting'); fs.mkdirSync(existing); foreignGrants(existing);
    const marker = path.join(existing, 'preserve.txt'); fs.writeFileSync(marker, 'original synthetic bytes');
    const before = observation(existing);
    assert.equal(typeof boundary.createPrivateDirectory, 'function');
    assert.throws(() => boundary.createPrivateDirectory(existing));
    assert.deepEqual(observation(existing), before); assert.equal(fs.readFileSync(marker, 'utf8'), 'original synthetic bytes');
    assert.throws(() => boundary.assertPrivateDirectory(existing), (error: any) => error.code === 'WORKSPACE_PERMISSIONS_INVALID');
  });
  check('PD03 initialize refuses existing .security foreign grants without repairing authority', () => {
    const workspace = path.join(root, 'existing-workspace'), security = path.join(workspace, '.security');
    fs.mkdirSync(workspace); fs.mkdirSync(security); foreignGrants(security);
    const marker = path.join(security, 'authority.sqlite'); fs.writeFileSync(marker, 'inert database marker');
    const before = observation(security);
    assert.throws(() => boundary.capture(workspace, true), (error: any) => error.code === 'WORKSPACE_PERMISSIONS_INVALID');
    assert.deepEqual(observation(security), before); assert.equal(fs.readFileSync(marker, 'utf8'), 'inert database marker');
  });
  check('PD04 creation rejects a junction or symlink parent without modifying its target', () => {
    const target = path.join(root, 'alias-target'), alias = path.join(root, 'alias'); fs.mkdirSync(target);
    fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
    try { assert.equal(typeof boundary.createPrivateDirectory, 'function'); assert.throws(() => boundary.createPrivateDirectory(path.join(alias, 'unexpected'))); assert.equal(fs.existsSync(path.join(target, 'unexpected')), false); }
    finally { fs.unlinkSync(alias); }
  });
  check('PD05 fresh workspace capture uses exact private ACL and does not mutate its workspace parent', () => {
    const workspace = path.join(root, 'new-workspace'); fs.mkdirSync(workspace); foreignGrants(workspace);
    const before = observation(workspace), handle = boundary.capture(workspace, true);
    assertPrivate(handle.root, true); boundary.assertRoot(handle); assert.deepEqual(observation(workspace), before);
  });
  await checkAsync('PD06 asynchronous sparse-environment acquisition preserves positive and negative admission', async () => {
    const existing = path.join(root, 'async-existing'), fresh = path.join(root, 'async-fresh'), denied = path.join(root, 'async-denied');
    for (const directory of [existing, fresh, denied]) fs.mkdirSync(directory);
    const handle = boundary.capture(existing, true), inert = path.join(handle.root, 'authority.sqlite');
    fs.writeFileSync(inert, 'inert synthetic bytes', { flag: 'wx', mode: 0o600 });
    const deniedRoot = path.join(denied, '.security'); fs.mkdirSync(deniedRoot); foreignGrants(deniedRoot);
    const deniedMarker = path.join(deniedRoot, 'authority.sqlite'); fs.writeFileSync(deniedMarker, 'preserved denied bytes');
    const before = observation(deniedRoot);
    const code = `const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
      const b=require(${JSON.stringify(path.resolve('server/security/workspaceAccess/privateBoundary.cjs'))});
      b.assertFiles(b.capture(${JSON.stringify(existing)},false));
      const fresh=b.capture(${JSON.stringify(fresh)},true);b.assertFiles(fresh);
      assert.throws(()=>b.capture(${JSON.stringify(denied)},true),e=>e.code==='WORKSPACE_PERMISSIONS_INVALID');
      assert.equal(fs.readFileSync(${JSON.stringify(inert)},'utf8'),'inert synthetic bytes');
      assert.equal(fs.readFileSync(${JSON.stringify(deniedMarker)},'utf8'),'preserved denied bytes');
      console.log('ASYNC_PRIVATE_ADMISSION '+JSON.stringify({existing:true,fresh:true,file:true,foreignRejected:true}));`;
    const environment: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) environment[key] = process.env[key];
    const child = spawn(process.execPath, ['--input-type=commonjs', '-e', code], { cwd: root, env: environment, windowsHide: true, stdio: 'pipe' });
    // Keep the asynchronous child's input open, matching a supervising process.
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout = (stdout + data).slice(-4000); });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
    const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
    try {
      const status = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      assert.equal(status, 0, 'asynchronous native admission failed: ' + stderr);
      const line = stdout.split(/\r?\n/).find(value => value.startsWith('ASYNC_PRIVATE_ADMISSION '));
      assert.ok(line); assert.deepEqual(JSON.parse(line.slice('ASYNC_PRIVATE_ADMISSION '.length)), { existing: true, fresh: true, file: true, foreignRejected: true });
      assert.deepEqual(observation(deniedRoot), before, 'denied authority ACL must remain unchanged');
      assert.equal(fs.readFileSync(deniedMarker, 'utf8'), 'preserved denied bytes');
    } finally { clearTimeout(timer); }
  });
  if (process.platform === 'win32') check('PD07 Windows direct and cmdlet reads preserve owner group and access descriptor bytes', () => {
    const directory = path.join(root, 'descriptor-equivalence'); boundary.createPrivateDirectory(directory);
    const file = path.join(directory, 'inert.txt'); fs.writeFileSync(file, 'inert', { flag: 'wx', mode: 0o600 });
    const query = "$sections=[System.Security.AccessControl.AccessControlSections]::Owner -bor [System.Security.AccessControl.AccessControlSections]::Group -bor [System.Security.AccessControl.AccessControlSections]::Access;$out=@();" +
      ([[directory, 'Directory'], [file, 'File']] as const).map(([target, kind]) =>
        `$a=Get-Acl -LiteralPath ${literal(target)};$b=[System.IO.${kind}]::GetAccessControl(${literal(target)});$old=$a.GetSecurityDescriptorSddlForm($sections);$new=$b.GetSecurityDescriptorSddlForm($sections);$sha=[System.Security.Cryptography.SHA256]::Create();try{$out+=[ordered]@{kind='${kind}';equal=($old -ceq $new);protectedEqual=($a.AreAccessRulesProtected -eq $b.AreAccessRulesProtected);oldBytes=[Text.Encoding]::UTF8.GetByteCount($old);newBytes=[Text.Encoding]::UTF8.GetByteCount($new);oldSha256=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($old))).Replace('-','');newSha256=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($new))).Replace('-','')}}finally{$sha.Dispose()};`).join('') + '$out|ConvertTo-Json -Compress';
    const result = JSON.parse(powershell(query)); assert.equal(result.length, 2);
    for (const record of result) { assert.equal(record.equal, true); assert.equal(record.protectedEqual, true); assert.equal(record.oldBytes, record.newBytes); assert.equal(record.oldSha256, record.newSha256); }
    console.log('PRIVATE_DESCRIPTOR_EQUIVALENCE ' + JSON.stringify(result));
    assert.equal(fs.readFileSync(file, 'utf8'), 'inert');
  });
} finally {
  assert.equal(path.dirname(root), parent); assert.match(path.basename(root), /^dmk-private-directory-/);
  fs.rmSync(root, { recursive: true });
}
console.log(JSON.stringify({ suite: 'workspace-private-directory', passed, failed }));
if (failed) process.exitCode = 1;
