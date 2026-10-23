/** Genuine native filesystem fixtures; no operator authority or token changes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const boundary = createRequire(import.meta.url)('../server/security/workspaceAccess/privateBoundary.cjs');
const parent = fs.realpathSync.native(os.tmpdir());
const root = fs.mkdtempSync(path.join(parent, 'dmk-private-directory-'));
let passed = 0, failed = 0;
function check(name: string, run: () => void) {
  try { run(); passed++; console.log('PASS ' + name); }
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
} finally {
  assert.equal(path.dirname(root), parent); assert.match(path.basename(root), /^dmk-private-directory-/);
  fs.rmSync(root, { recursive: true });
}
console.log(JSON.stringify({ suite: 'workspace-private-directory', passed, failed }));
if (failed) process.exitCode = 1;
