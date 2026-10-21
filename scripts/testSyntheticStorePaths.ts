import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {PrivateSyntheticStore} from '../server/security/syntheticFoundations/privateStore.ts';

let passed = 0;
async function check(name: string, body: () => Promise<void>) {
  const selection = process.argv.find(value => value.startsWith('--case='))?.slice(7);
  if (selection && !name.includes(selection)) return;
  await body(); passed++; console.log('PASS ' + name);
}
const parent = await fs.realpath(os.tmpdir());
// Test-owned generated roots only. Never follow a substituted junction during
// test cleanup, and never accept an operator-supplied path.
async function removeProbe(root: string) {
  assert.equal(path.dirname(root), parent);
  assert.match(path.basename(root), /^dmk-s2a-synthetic-[A-Za-z0-9]+(?:-saved)?$/);
  try {
    assert.equal((await fs.lstat(root)).isSymbolicLink(), false);
    assert.equal(await fs.realpath(root), root);
    await fs.rm(root, {recursive: true});
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

await check('creation admission rejects a substituted junction before provisioning its target', async () => {
  const originalMkdtemp = fs.mkdtemp;
  let generated: string | undefined, saved: string | undefined, target: string | undefined;
  let unexpected: PrivateSyntheticStore | undefined;
  try {
    // Deterministic scheduling of a real filesystem substitution immediately
    // after native creation. All directories are fresh test-owned allocations;
    // no mocked SQLite/ACL/identity result can satisfy the assertion.
    fs.mkdtemp = (async (prefix: string) => {
      generated = await originalMkdtemp(prefix);
      saved = generated + '-saved';
      target = await originalMkdtemp(path.join(parent, 'dmk-s2a-synthetic-'));
      await fs.rename(generated, saved);
      await fs.symlink(target, generated, process.platform === 'win32' ? 'junction' : 'dir');
      return generated;
    }) as typeof fs.mkdtemp;
    await assert.rejects(async () => { unexpected = await PrivateSyntheticStore.create(); }, {code: 'STORE_PATH_INVALID'});
    assert.deepEqual(await fs.readdir(target!), [], 'rejected target receives no owner/database files');
  } finally {
    fs.mkdtemp = originalMkdtemp;
    if (unexpected) await unexpected.close();
    if (generated && (await fs.lstat(generated)).isSymbolicLink()) await fs.unlink(generated);
    if (saved) await removeProbe(saved);
    if (target) await removeProbe(target);
  }
});

await check('replacement directory with copied database and owner denies worker restart', async () => {
  const store = await PrivateSyntheticStore.create();
  const root = store.rootDirectory, saved = root + '-saved';
  try {
    await store.execute({command: 'checkpoint'});
    await store.terminate();
    await fs.rename(root, saved);
    await fs.mkdir(root, {mode: 0o700});
    for (const name of await fs.readdir(saved)) await fs.copyFile(path.join(saved, name), path.join(root, name));
    await assert.rejects(() => store.restart(), {code: 'STORE_PATH_INVALID'});
  } finally {
    try { await store.close(); } catch { /* the replaced root must be refused */ }
    await removeProbe(root); await removeProbe(saved);
  }
});

await check('cleanup refuses a substituted directory even when owner bytes match', async () => {
  const store = await PrivateSyntheticStore.create();
  const root = store.rootDirectory, saved = root + '-saved';
  const marker = await fs.readFile(path.join(root, '.synthetic-owner'));
  try {
    await store.terminate();
    await fs.rename(root, saved);
    await fs.mkdir(root, {mode: 0o700});
    await fs.writeFile(path.join(root, '.synthetic-owner'), marker, {mode: 0o600});
    await assert.rejects(() => store.close(), {code: 'STORE_CLEANUP_REFUSED'});
    assert.deepEqual(await fs.readFile(path.join(root, '.synthetic-owner')), marker);
    assert.ok((await fs.stat(saved)).isDirectory());
  } finally {
    try { await store.close(); } catch {}
    await removeProbe(root); await removeProbe(saved);
  }
});

await check('junction or symlink substitution denies access and never deletes its target', async () => {
  const store = await PrivateSyntheticStore.create();
  const root = store.rootDirectory, saved = root + '-saved';
  try {
    await store.terminate();
    await fs.rename(root, saved);
    await fs.symlink(saved, root, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(() => store.restart(), {code: 'STORE_PATH_INVALID'});
    await assert.rejects(() => store.close(), {code: 'STORE_CLEANUP_REFUSED'});
    assert.ok((await fs.stat(saved)).isDirectory());
  } finally {
    try { await store.close(); } catch {}
    if ((await fs.lstat(root)).isSymbolicLink()) await fs.unlink(root);
    await removeProbe(saved);
  }
});

await check('database links reject before a new worker can open an external target', async () => {
  const store = await PrivateSyntheticStore.create();
  const root = store.rootDirectory, database = path.join(root, 'authority.sqlite');
  const outside = path.join(parent, path.basename(root) + '-saved');
  let linked = false;
  try {
    await store.terminate();
    await fs.rename(database, outside);
    // Windows file symlinks need an extra privilege, so exercise a real file
    // hard link there; the directory-junction test above remains mandatory.
    if (process.platform === 'win32') await fs.link(outside, database);
    else await fs.symlink(outside, database);
    linked = true;
    await assert.rejects(() => store.restart(), {code: 'STORE_PATH_INVALID'});
    assert.ok((await fs.stat(outside)).isFile());
  } finally {
    try { await store.terminate(); } catch {}
    if (linked) await fs.unlink(database);
    await fs.rename(outside, database);
    await store.close();
  }
});

await check('cleanup stays bound to its original parent after process TEMP changes', async () => {
  const store = await PrivateSyntheticStore.create(), root = store.rootDirectory;
  const prior = {TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR};
  const alternate = await fs.mkdtemp(path.join(parent, 'dmk-s2a-synthetic-'));
  try {
    process.env.TEMP = alternate; process.env.TMP = alternate; process.env.TMPDIR = alternate;
    await store.close();
    await assert.rejects(() => fs.stat(root), {code: 'ENOENT'});
    assert.ok((await fs.stat(alternate)).isDirectory());
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    try { await store.close(); } catch {}
    await removeProbe(root); await removeProbe(alternate);
  }
});

await check('actual native canonical TEMP supports available Windows 8dot3 aliases', async () => {
  if (process.platform !== 'win32') {
    const store = await PrivateSyntheticStore.create(); await store.close(); return;
  }
  const directory = await fs.mkdtemp(path.join(parent, 'dmk-s2a-synthetic-'));
  const prior = {TEMP: process.env.TEMP, TMP: process.env.TMP};
  // Use Windows' existing filesystem automation API, avoiding a C# compiler
  // startup in every test process. Hosted Windows PowerShell 5.1 timed out
  // before output with both Add-Type and this compilation-free helper. Use
  // the existing PowerShell 7 host, with explicit stage diagnostics.
  // The same canonical-equality and actual native-open assertions remain.
  const probe = `$filesystem = New-Object -ComObject Scripting.FileSystemObject; $alias = $filesystem.GetFolder($env:DMK_TEST_ALIAS_PARENT).ShortPath; if ([string]::IsNullOrWhiteSpace($alias)) { throw 'Short-path acquisition failed' }; [Console]::Write($alias)`;
  try {
    const quietProbe = "$ProgressPreference='SilentlyContinue';[Console]::Error.WriteLine('ALIAS_HELPER_STARTED pwsh7');" + probe + ";[Console]::Error.WriteLine('ALIAS_HELPER_COMPLETE')";
    // Inherit normal process bootstrap variables; do not print environment
    // values. The script reads only its generated fixture path and OS metadata.
    const alias = execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', Buffer.from(quietProbe, 'utf16le').toString('base64')], {env: {...process.env, DMK_TEST_ALIAS_PARENT: directory}, windowsHide: true, timeout: 15_000, encoding: 'utf8'}).trim();
    assert.equal(await fs.realpath(alias), directory);
    process.env.TEMP = alias; process.env.TMP = alias;
    await assert.doesNotReject(async () => {
      const store = await PrivateSyntheticStore.create();
      try { assert.equal((await store.execute({command: 'info'})).schemaVersion, 1); }
      finally { await store.close(); }
    });
    console.log('WINDOWS_ALIAS_PROFILE ' + JSON.stringify({aliasDiffers: alias !== directory, defaultTemp: os.tmpdir(), nativeTemp: await fs.realpath(os.tmpdir())}));
  } finally {
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await removeProbe(directory);
  }
});
assert.ok(passed > 0, 'Selected native path scenario must match a real check');
console.log('Synthetic store paths: ' + passed + ' named checks passed; native compatibility only.');
