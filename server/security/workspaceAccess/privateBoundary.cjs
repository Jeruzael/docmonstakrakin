'use strict';
// Shared unprivileged filesystem admission for parent and plain-CJS worker.
// SQLite opens paths: this detects observed substitutions, not a race-free broker
// against arbitrary code already running as the owning OS principal.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const pins = new Map();
function fail(code = 'WORKSPACE_PATH_INVALID') { const e = Error(code); e.code = code; throw e; }
function identity(file, directory) {
  const s = fs.lstatSync(file, { bigint: true });
  if ((directory ? !s.isDirectory() : !s.isFile() || s.nlink !== 1n) || s.isSymbolicLink() || s.ino === 0n) fail();
  return s.dev + ':' + s.ino;
}
let sid;
function currentSid() {
  if (!sid) { const raw = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 2000 }); sid = /S-1-\d+(?:-\d+)+/.exec(raw)?.[0]; if (!sid) fail('WORKSPACE_PRIVATE_DIRECTORY_UNAVAILABLE'); }
  return sid;
}
function privatePermissions(file, directory) {
  if (process.platform !== 'win32') {
    const s = fs.statSync(file); if (s.uid !== process.getuid() || (s.mode & 0o777) !== (directory ? 0o700 : 0o600)) fail('WORKSPACE_PERMISSIONS_INVALID'); return;
  }
  const ownerSid = currentSid();
  const listing = execFileSync('icacls.exe', [file], { encoding: 'utf8', windowsHide: true, timeout: 2000, maxBuffer: 16 * 1024 });
  const pin = crypto.createHash('sha256').update(listing).digest('hex');
  if (pins.has(file)) { if (pins.get(file) !== pin) fail('WORKSPACE_PERMISSIONS_INVALID'); return; }
  // Validate the initial ACL by SID, rather than trusting localized icacls text.
  // Direct .NET reads avoid cmdlet acquisition (Get-Acl stalled on the hosted
  // sparse-environment child). Descriptor predicates and timeout stay identical.
  const literal = file.replace(/'/g, "''");
  const code = "$ErrorActionPreference='Stop';$a=[System.IO." + (directory ? 'Directory' : 'File') + "]::GetAccessControl('" + literal + "');$s=[System.Security.Principal.SecurityIdentifier]::new('" + ownerSid + "');if($a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $s.Value){exit 3};" +
    (directory ? 'if(-not $a.AreAccessRulesProtected){exit 3};' : '') +
    '$r=$a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]);if($r.Count -lt 1){exit 3};foreach($v in $r){if($v.IdentityReference.Value -ne $s.Value -or $v.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow){exit 3}}';
  try { execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { windowsHide: true, timeout: 4000, stdio: 'pipe',
    env: { ...process.env, PSModulePath: path.join(process.env.WINDIR || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/Modules') } }); }
  catch { fail('WORKSPACE_PERMISSIONS_INVALID'); }
  pins.set(file, pin);
}
/** Own exclusive creation: no API for repairing an existing authority path. */
function createPrivateDirectory(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.resolve(file) !== file || fs.realpathSync.native(path.dirname(file)) !== path.dirname(file)) fail();
  identity(path.dirname(file), true);
  fs.mkdirSync(file, { mode: 0o700 }); // Nonrecursive EEXIST refusal precedes any ACL write.
  const created = identity(file, true);
  if (fs.realpathSync.native(file) !== file || fs.readdirSync(file).length !== 0) fail();
  if (process.platform === 'win32') {
    const ownerSid = currentSid(), literal = file.replace(/'/g, "''");
    // Hosted Windows proved icacls can retain foreign explicit grants even
    // with separate inheritance/grant commands. Persist only a new exact DACL
    // through Windows PowerShell 5's .NET API. Never set Owner, Group or SACL.
    const code = "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$p='" + literal + "';$s=[System.Security.Principal.SecurityIdentifier]::new('" + ownerSid + "');" +
      "$a=[System.IO.Directory]::GetAccessControl($p);if($a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $s.Value){exit 3};" +
      "$d=[System.Security.AccessControl.DirectorySecurity]::new();$d.SetAccessRuleProtection($true,$false);" +
      "$r=[System.Security.AccessControl.FileSystemAccessRule]::new($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$d.AddAccessRule($r);[System.IO.Directory]::SetAccessControl($p,$d);" +
      "$a=[System.IO.Directory]::GetAccessControl($p);if($a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $s.Value){exit 3}";
    try { execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { windowsHide: true, timeout: 4000, stdio: 'pipe',
      env: { ...process.env, PSModulePath: path.join(process.env.WINDIR || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/Modules') } }); }
    catch { fail('WORKSPACE_PERMISSIONS_INVALID'); }
  }
  if (identity(file, true) !== created || fs.realpathSync.native(file) !== file) fail();
  privatePermissions(file, true); // The same strict owner/ACL admission as existing state.
  return created;
}
function capture(workspaceRoot, initialize) {
  if (typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot)) fail();
  const workspace = fs.realpathSync.native(workspaceRoot);
  if (workspace !== path.resolve(workspaceRoot)) fail();
  const workspaceIdentity = identity(workspace, true), root = path.join(workspace, '.security');
  if (!fs.existsSync(root)) {
    if (!initialize) fail('WORKSPACE_NOT_INITIALIZED');
    createPrivateDirectory(root);
  }
  const rootIdentity = identity(root, true);
  if (fs.realpathSync.native(root) !== root) fail();
  privatePermissions(root, true);
  return { workspaceRoot: workspace, root, workspaceIdentity, rootIdentity };
}
function assertRoot(h) {
  if (!h || path.dirname(h.root) !== h.workspaceRoot || path.basename(h.root) !== '.security' || fs.realpathSync.native(h.workspaceRoot) !== h.workspaceRoot ||
    fs.realpathSync.native(h.root) !== h.root || identity(h.workspaceRoot, true) !== h.workspaceIdentity || identity(h.root, true) !== h.rootIdentity) fail();
  privatePermissions(h.root, true);
}
function assertFiles(h) {
  assertRoot(h);
  for (const name of fs.readdirSync(h.root)) {
    if (name === 'tls') {
      const tls = path.join(h.root, name); assertPrivateDirectory(tls);
      for (const child of fs.readdirSync(tls)) { if (!['loopback.crt', 'loopback.key'].includes(child)) fail(); assertPrivateFile(path.join(tls, child)); }
      continue;
    }
    if (!['owner.lock', 'authority.sqlite', 'authority.sqlite-wal', 'authority.sqlite-shm'].includes(name)) fail();
    const file = path.join(h.root, name); identity(file, false); privatePermissions(file, false);
  }
}
function readLock(h) {
  assertRoot(h); const file = path.join(h.root, 'owner.lock'), first = identity(file, false), s = fs.statSync(file);
  if (s.size > 1024) fail();
  const raw = fs.readFileSync(file, 'utf8'); if (identity(file, false) !== first) fail();
  const lock = JSON.parse(raw);
  if (!Number.isSafeInteger(lock.pid) || lock.pid < 1 || !/^[a-f0-9]{64}$/.test(lock.token) || lock.workspaceIdentity !== h.workspaceIdentity || lock.rootIdentity !== h.rootIdentity) fail();
  return { lock, raw, identity: first };
}
function assertLock(h) {
  const current = readLock(h); if (current.identity !== h.lockIdentity || current.raw !== h.lockRaw) fail('WORKSPACE_LOCK_CHANGED');
}
function acquire(h) {
  assertRoot(h); const file = path.join(h.root, 'owner.lock');
  const raw = JSON.stringify({ pid: process.pid, token: crypto.randomBytes(32).toString('hex'), workspaceIdentity: h.workspaceIdentity, rootIdentity: h.rootIdentity });
  try { fs.writeFileSync(file, raw, { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (e.code === 'EEXIST') fail('WORKSPACE_BUSY'); throw e; }
  return { ...h, lockRaw: raw, lockIdentity: identity(file, false) };
}
function release(h) { assertRoot(h); assertLock(h); fs.unlinkSync(path.join(h.root, 'owner.lock')); }
function recover(workspaceRoot) {
  const h = capture(workspaceRoot, false); assertFiles(h); const before = readLock(h);
  try { process.kill(before.lock.pid, 0); fail('WORKSPACE_BUSY'); }
  catch (e) { if (e.code !== 'ESRCH') throw e; }
  const after = readLock(h); if (before.raw !== after.raw || before.identity !== after.identity) fail('WORKSPACE_LOCK_CHANGED');
  fs.unlinkSync(path.join(h.root, 'owner.lock')); return true;
}
function assertPrivateDirectory(file) { if (!path.isAbsolute(file) || fs.realpathSync.native(file) !== path.resolve(file)) fail(); const value = identity(file, true); privatePermissions(file, true); return value; }
function assertPrivateFile(file) { if (!path.isAbsolute(file) || fs.realpathSync.native(file) !== path.resolve(file)) fail(); const value = identity(file, false); privatePermissions(file, false); return value; }
module.exports = { capture, assertRoot, assertFiles, acquire, assertLock, release, recover, createPrivateDirectory, assertPrivateDirectory, assertPrivateFile };
