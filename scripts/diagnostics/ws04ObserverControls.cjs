'use strict';
// Genuine negative controls on new disposable directories. They validate the
// observer's discrimination, not the cause of the historical hosted WS04 error.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process');
if (process.env.DMK_WS04_DIAGNOSTIC !== 'synthetic-only') throw Error('WS04_DIAGNOSTIC_SCOPE_REQUIRED');
const boundary = require('../../server/security/workspaceAccess/privateBoundary.cjs');
const parent = fs.realpathSync.native(os.tmpdir());
const root = fs.mkdtempSync(path.join(parent, 'dmk-ws04-controls-'));
let failures = 0;
function reject(label, fn) {
  let code;
  try { fn(); } catch (error) { code = error.code; }
  const expected = code === 'WORKSPACE_PERMISSIONS_INVALID';
  console.log(JSON.stringify({ control: label, expectedCode: 'WORKSPACE_PERMISSIONS_INVALID', actualCode: code || null, expected }));
  if (!expected) failures++;
}
try {
  const permissive = path.join(root, 'permissive'); fs.mkdirSync(permissive); fs.mkdirSync(path.join(permissive, '.security'));
  reject('preexisting-inherited-descriptor', () => boundary.capture(permissive, false));
  const changed = path.join(root, 'changed-pin'); fs.mkdirSync(changed);
  const handle = boundary.capture(changed, true);
  // A well-known Everyone ACE on an exclusively created synthetic directory.
  // This is deliberate corruption of a fixture, never an existing authority.
  cp.execFileSync('icacls.exe', [handle.root, '/grant', '*S-1-1-0:(R)'], { windowsHide: true, timeout: 2000, stdio: 'pipe' });
  reject('changed-listing-pin', () => boundary.assertRoot(handle));
} finally {
  if (path.dirname(path.resolve(root)) !== parent || !/^dmk-ws04-controls-/.test(path.basename(root)) || fs.realpathSync.native(root) !== root || fs.lstatSync(root).isSymbolicLink()) throw Error('WS04_CONTROL_CLEANUP_REJECTED');
  fs.rmSync(root, { recursive: true });
}
process.exitCode = failures ? 1 : 0;
