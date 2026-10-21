import fs from 'node:fs';

// Candidate admission bounds for the pinned Bun 1.4.2 text protocol, not a
// package-trust policy or an operational process-memory budget.
const MAX_BYTES = 65536, MAX_PACKAGES = 128;
const REQUIRED_NATIVE = new Set(['better-sqlite3', 'argon2', 'esbuild']);
const HOOKS = new Set(['preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare']);
const FOOTER = ['These dependencies had their lifecycle scripts blocked during install.', 'If you trust them and wish to run their scripts, use `bun pm trust`.'];
const CODES = new Set(['BUN_INVENTORY_INVALID', 'BUN_INVENTORY_TOO_LARGE', 'BUN_NATIVE_LIFECYCLE_BLOCKED', 'BUN_INVENTORY_ACQUISITION_FAILED']);
function fail(code = 'BUN_INVENTORY_INVALID') { throw Object.assign(Error(code), {code}); }
function validVersion(version) {
  const parts = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(version);
  return parts && (!parts[4] || parts[4].split('.').every(part => !/^0[0-9]+$/.test(part)));
}

/** Inspect data only. Never execute scripts, expand lifecycle trust or use rg. */
export function inspectBunLifecycleInventory(bytes) {
  if (!Buffer.isBuffer(bytes)) fail();
  if (bytes.length > MAX_BYTES) fail('BUN_INVENTORY_TOO_LARGE');
  let text;
  try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes).replaceAll('\r\n', '\n'); }
  catch { fail(); }
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(text)) fail();
  const lines = text.split('\n').map(line => line.trimEnd()).filter(Boolean);
  if (lines.length < 5 || !/^bun pm untrusted v1\.4\.2 \([a-f0-9]{7,40}\)$/.test(lines[0]) ||
      lines.at(-2) !== FOOTER[0] || lines.at(-1) !== FOOTER[1]) fail();
  const blocked = [], seen = new Set();
  let current;
  for (const line of lines.slice(1, -2)) {
    const entry = /^\.\/node_modules\/((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*) @([0-9][0-9A-Za-z.+_-]*)$/.exec(line.replaceAll('\\', '/'));
    if (entry) {
      if (!validVersion(entry[2]) || current && !current.hooks.length || seen.has(entry[1]) || blocked.length >= MAX_PACKAGES) fail();
      seen.add(entry[1]); current = {name: entry[1], version: entry[2], hooks: []}; blocked.push(current);
    } else {
      const script = /^[ \t]{1,4}» \[([a-z]+)\]: ([^\r\n]{1,4096})$/.exec(line);
      if (!current || !script || !HOOKS.has(script[1]) || current.hooks.includes(script[1])) fail();
      current.hooks.push(script[1]);
    }
  }
  if (!current || !current.hooks.length) fail();
  if (blocked.some(entry => REQUIRED_NATIVE.has(entry.name))) fail('BUN_NATIVE_LIFECYCLE_BLOCKED');
  return Object.freeze({blocked: Object.freeze(blocked.map(entry => Object.freeze({...entry, hooks: Object.freeze(entry.hooks)}))),
    nativeLifecycleBlocked: false, lifecycleTrustChanged: false,
    qualification: 'Remaining blocked scripts are disclosed; this is not full lifecycle compatibility acceptance.'});
}

/** Bounded synchronous pipe acquisition; no unbounded readFileSync(0). */
function readStdin() {
  const chunks = []; let total = 0;
  for (;;) {
    const chunk = Buffer.alloc(Math.min(4096, MAX_BYTES + 1 - total));
    let count;
    try { count = fs.readSync(0, chunk, 0, chunk.length, null); }
    catch { fail('BUN_INVENTORY_ACQUISITION_FAILED'); }
    if (!count) return Buffer.concat(chunks, total);
    total += count;
    if (total > MAX_BYTES) fail('BUN_INVENTORY_TOO_LARGE');
    chunks.push(chunk.subarray(0, count));
  }
}

// Node's main-module identity survives file symlinks and directory junctions.
// A lexical argv comparison can skip the entire guard through an entry alias.
if (typeof import.meta.main !== 'boolean') throw Error('BUN_INVENTORY_RUNTIME_UNSUPPORTED');
if (import.meta.main) {
  try {
    if (process.argv.length !== 2) fail();
    console.log(JSON.stringify(inspectBunLifecycleInventory(readStdin())));
  } catch (error) {
    // Do not echo untrusted script text or native diagnostics into CI logs.
    console.error(CODES.has(error?.code) ? error.code : 'BUN_INVENTORY_ACQUISITION_FAILED');
    process.exitCode = 1;
  }
}
