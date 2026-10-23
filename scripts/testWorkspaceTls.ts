import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import {X509Certificate} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {buildSync} from 'esbuild';

// Fresh synthetic roots and keys only. No operator workspace, trust store,
// SQLite authority, credential enrollment or actual reviewer is used.
const checkout = fs.realpathSync.native(process.cwd());
const boundaryCheckout = process.argv.find(arg => arg.startsWith('--boundary-checkout='))?.slice('--boundary-checkout='.length);
const boundarySource = fs.realpathSync.native(boundaryCheckout || checkout);
const temporaryParent = fs.realpathSync.native(os.tmpdir());
const base = fs.mkdtempSync(path.join(temporaryParent, 'dmk-workspace-tls-'));
const env = {DMK_TLS_CERT: '.security/tls/loopback.crt', DMK_TLS_KEY: '.security/tls/loopback.key'};
let passed = 0, failed = 0, skipped = 0;
const onlyMetadata = process.argv.includes('--metadata-only');
const selectedCase = process.argv.find(arg => arg.startsWith('--case='))?.slice('--case='.length);
const sid = process.platform === 'win32' ? /S-1-\d+(?:-\d+)+/.exec(execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {encoding: 'utf8', windowsHide: true}))?.[0] : undefined;
function privatePaths(files: ReadonlyArray<readonly [file:string,directory:boolean]>) {
  for(const [file,directory] of files){
    assert(file.startsWith(base + path.sep) || file === base);
    const stat=fs.lstatSync(file);
    assert(!stat.isSymbolicLink() && (directory?stat.isDirectory():stat.isFile()&&stat.nlink===1));
    assert.equal(fs.realpathSync.native(file),file);
  }
  if (process.platform === 'win32') {
    assert(sid);
    // Only newly created synthetic fixtures reach this helper. Replace their
    // DACL exactly; inherited broad grants can become explicit under icacls.
    // Validate every path and owner before the batch mutates any DACL. Persist
    // Access only, preserving ownership/SACL without one process per pathname.
    const encoded=Buffer.from(JSON.stringify(files.map(([file,directory])=>({file,directory}))),'utf8').toString('base64');
    const code="$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$s=New-Object System.Security.Principal.SecurityIdentifier('"+sid+"');"+
      "$items=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"')));"+
      "function ReadOwner($i){if($i.directory){$a=[IO.Directory]::GetAccessControl($i.file,[Security.AccessControl.AccessControlSections]::Owner)}else{$a=[IO.File]::GetAccessControl($i.file,[Security.AccessControl.AccessControlSections]::Owner)};return $a.GetOwner([Security.Principal.SecurityIdentifier]).Value};"+
      "foreach($i in $items){if((ReadOwner $i) -ne $s.Value){throw 'FIXTURE_OWNER_INVALID'}};"+
      "foreach($i in $items){if($i.directory){$a=New-Object Security.AccessControl.DirectorySecurity;$flags='OICI'}else{$a=New-Object Security.AccessControl.FileSecurity;$flags=''};"+
      "$a.SetSecurityDescriptorSddlForm(('D:P(A;'+$flags+';FA;;;'+$s.Value+')'),[Security.AccessControl.AccessControlSections]::Access);if($i.directory){[IO.Directory]::SetAccessControl($i.file,$a)}else{[IO.File]::SetAccessControl($i.file,$a)};if((ReadOwner $i) -ne $s.Value){throw 'FIXTURE_OWNER_CHANGED'}}";
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],
      {windowsHide:true,stdio:'pipe',timeout:5000,env:{...process.env,PSModulePath:path.join(process.env.WINDIR||'C:\\Windows','System32/WindowsPowerShell/v1.0/Modules')}});
  } else for(const [file,directory] of files)fs.chmodSync(file,directory?0o700:0o600);
}
function privatePath(file:string,directory:boolean){privatePaths([[file,directory]]);}
privatePath(base, true);
// Exercise genuine source bytes and the genuine shared policy in a disposable
// deployment, even while the two implementation branches are separate.
const sourceDirectory = path.join(base, 'deployment/server/security/workspaceAccess'); fs.mkdirSync(sourceDirectory, {recursive: true});
fs.writeFileSync(path.join(base, 'deployment/package.json'), '{"type":"module"}\n');
const sourceTls = path.join(sourceDirectory, 'tls.ts');
fs.copyFileSync(path.join(checkout, 'server/security/workspaceAccess/tls.ts'), sourceTls);
fs.copyFileSync(path.join(boundarySource, 'server/security/workspaceAccess/privateBoundary.cjs'), path.join(sourceDirectory, 'privateBoundary.cjs'));
const {resolveWorkspaceTls} = await import(pathToFileURL(sourceTls).href) as typeof import('../server/security/workspaceAccess/tls.ts');
const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : '/usr/bin/openssl';
const fixtureDir = path.join(base, 'certificates'); fs.mkdirSync(fixtureDir); privatePath(fixtureDir, true);
const configPath = path.join(fixtureDir, 'openssl.cnf');
fs.writeFileSync(configPath, '[req]\nprompt=no\ndistinguished_name=subject\n[subject]\nCN=Inert loopback fixture\n', {mode: 0o600});
function certificate(name: string, extensions: string[]) {
  const key = path.join(fixtureDir, `${name}.key`), cert = path.join(fixtureDir, `${name}.crt`);
  execFileSync(openssl, ['req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-sha256', '-days', '2',
    '-config', configPath, ...extensions.flatMap(extension => ['-addext', extension]), '-keyout', key, '-out', cert],
    {windowsHide: true, stdio: 'pipe', timeout: 10000, maxBuffer: 65536});
  privatePaths([[key,false],[cert,false]]); return {cert: fs.readFileSync(cert), key: fs.readFileSync(key)};
}
const valid = certificate('valid', ['subjectAltName=IP:127.0.0.1', 'basicConstraints=critical,CA:FALSE', 'extendedKeyUsage=serverAuth']);
const noSan = certificate('no-san', ['basicConstraints=critical,CA:FALSE']);
const aliasSan = certificate('alias-san', ['subjectAltName=DNS:localhost', 'basicConstraints=critical,CA:FALSE']);
const caCert = certificate('ca', ['subjectAltName=IP:127.0.0.1', 'basicConstraints=critical,CA:TRUE']);
let serial = 0;
function workspace(material = valid) {
  const root = path.join(base, `workspace-${++serial}`), security = path.join(root, '.security'), tls = path.join(security, 'tls');
  for (const directory of [root, security, tls]) fs.mkdirSync(directory);
  fs.writeFileSync(path.join(tls, 'loopback.crt'), material.cert, {flag: 'wx', mode: 0o600});
  fs.writeFileSync(path.join(tls, 'loopback.key'), material.key, {flag: 'wx', mode: 0o600});
  privatePaths([[root,true],[security,true],[tls,true],[path.join(tls,'loopback.crt'),false],[path.join(tls,'loopback.key'),false]]);
  return {root, security, tls, cert: path.join(tls, 'loopback.crt'), key: path.join(tls, 'loopback.key')};
}
function rejects(run: () => unknown, code?: string) {
  assert.throws(run, error => typeof (error as any)?.code === 'string' && (code ? (error as any).code === code : /^WORKSPACE_/.test((error as any).code)));
}
async function test(name: string, run: () => void | Promise<void>, live = false) {
  if (selectedCase && !name.startsWith(selectedCase + ' ')) {skipped++; return;}
  if (live && onlyMetadata) {skipped++; console.log(`SKIP ${name}: explicit metadata-only run`); return;}
  try {await run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);}
}
try {
  await test('TLS1 disabled configuration performs no filesystem provisioning', () => {
    const absent = path.join(base, 'absent'); assert.deepEqual(resolveWorkspaceTls(absent, {}), {enabled: false}); assert(!fs.existsSync(absent));
  });
  await test('TLS2 partial empty alternate absolute aliased and URL configuration is rejected before reading', () => {
    for (const candidate of [{DMK_TLS_CERT: env.DMK_TLS_CERT}, {DMK_TLS_KEY: env.DMK_TLS_KEY}, {DMK_TLS_CERT: '', DMK_TLS_KEY: ''},
      {...env, DMK_TLS_CERT: '/tmp/caller.crt'}, {...env, DMK_TLS_KEY: 'https://evil.invalid/key'},
      {...env, DMK_TLS_CERT: './.security/tls/loopback.crt'}, {...env, DMK_TLS_KEY: '.security/tls/../tls/loopback.key'},
      {...env, DMK_TLS_CERT: '.security\\tls\\loopback.crt'}, {...env, DMK_TLS_KEY: ' .security/tls/loopback.key'}])
      rejects(() => resolveWorkspaceTls(base, candidate), 'WORKSPACE_TLS_CONFIG_INVALID');
  });
  await test('TLS3 exactly bound private certificate/key buffers can be loaded without installing trust', () => {
    const w = workspace(), resolved = resolveWorkspaceTls(w.root, env); assert.equal(resolved.enabled, true);
    if (!resolved.enabled) throw new Error('TLS must be enabled'); assert.deepEqual(resolved.cert, valid.cert); assert.deepEqual(resolved.key, valid.key);
  });
  await test('TLS4 canonical workspace spelling rejects dot segments relative roots and junction aliases', () => {
    const w = workspace(); rejects(() => resolveWorkspaceTls('.', env)); rejects(() => resolveWorkspaceTls(w.root + path.sep + '.', env));
    const alias = path.join(base, 'workspace-alias'); fs.symlinkSync(w.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    try {rejects(() => resolveWorkspaceTls(alias, env));} finally {fs.unlinkSync(alias);}
  });
  await test('TLS5 linked directories and hardlinked key files cannot borrow a trusted pathname', () => {
    const w = workspace(), saved = path.join(w.security, 'saved-tls'); fs.renameSync(w.tls, saved);
    fs.symlinkSync(saved, w.tls, process.platform === 'win32' ? 'junction' : 'dir');
    try {rejects(() => resolveWorkspaceTls(w.root, env));} finally {fs.unlinkSync(w.tls); fs.renameSync(saved, w.tls);}
    const keyAlias = path.join(w.root, 'key-alias'); fs.linkSync(w.key, keyAlias); rejects(() => resolveWorkspaceTls(w.root, env)); fs.unlinkSync(keyAlias);
  });
  await test('TLS6 key and certificate file permissions are checked independently', () => {
    for (const target of ['key', 'cert'] as const) {
      const w = workspace(); if (process.platform === 'win32') execFileSync('icacls.exe', [w[target], '/grant', '*S-1-1-0:R'], {windowsHide: true, stdio: 'pipe'});
      else fs.chmodSync(w[target], 0o644);
      rejects(() => resolveWorkspaceTls(w.root, env));
    }
  });
  await test('TLS7 excessive zero-byte or non-PEM material is refused before TLS activation', () => {
    for (const bytes of [Buffer.alloc(32769, 65), Buffer.alloc(0), Buffer.from('not a certificate')]) {
      const w = workspace(); fs.writeFileSync(w.cert, bytes); rejects(() => resolveWorkspaceTls(w.root, env));
    }
    const w = workspace(); fs.writeFileSync(w.key, Buffer.alloc(32769, 65)); rejects(() => resolveWorkspaceTls(w.root, env));
  });
  await test('TLS8 mismatched private keys SAN aliases missing SAN and CA certificates are rejected', () => {
    for (const material of [noSan, aliasSan, caCert, {cert: valid.cert, key: noSan.key}]) {
      const w = workspace(material); rejects(() => resolveWorkspaceTls(w.root, env));
    }
  });
  await test('TLS9 startup rejects certificates outside their validity window', () => {
    const cert = new X509Certificate(valid.cert), originalNow = Date.now;
    try {
      Date.now = () => Date.parse(cert.validFrom) - 1;
      rejects(() => resolveWorkspaceTls(workspace().root, env), 'WORKSPACE_TLS_CERT_NOT_YET_VALID');
      Date.now = () => Date.parse(cert.validTo) + 1;
      rejects(() => resolveWorkspaceTls(workspace().root, env), 'WORKSPACE_TLS_CERT_EXPIRED');
    } finally {Date.now = originalNow;}
  });
  await test('TLS10 same-path file and directory substitutions are refused on subsequent reads', () => {
    const w = workspace(); resolveWorkspaceTls(w.root, env);
    fs.renameSync(w.key, path.join(w.root, 'key-saved')); fs.writeFileSync(w.key, valid.key, {flag: 'wx', mode: 0o600}); privatePath(w.key, false);
    rejects(() => resolveWorkspaceTls(w.root, env), 'WORKSPACE_TLS_CHANGED');
    const other = workspace(); resolveWorkspaceTls(other.root, env); fs.renameSync(other.tls, other.tls + '-saved');
    fs.mkdirSync(other.tls);
    for (const name of ['loopback.crt', 'loopback.key']) fs.copyFileSync(path.join(other.tls + '-saved', name), path.join(other.tls, name));
    privatePaths([[other.tls,true],[path.join(other.tls,'loopback.crt'),false],[path.join(other.tls,'loopback.key'),false]]);
    rejects(() => resolveWorkspaceTls(other.root, env), 'WORKSPACE_TLS_CHANGED');
  });
  await test('TLS11 an opened file descriptor cannot be replaced between admission and bounded read', () => {
    const w = workspace(), originalOpen = fs.openSync; let changed = false;
    try {
      fs.openSync = ((file, flags, mode) => {
        if (file === w.key && !changed) {changed = true; fs.renameSync(w.key, path.join(w.root, 'key-original')); fs.writeFileSync(w.key, valid.key, {flag: 'wx', mode: 0o600}); privatePath(w.key, false);}
        return originalOpen(file as any, flags as any, mode);
      }) as typeof fs.openSync;
      rejects(() => resolveWorkspaceTls(w.root, env), 'WORKSPACE_TLS_CHANGED'); assert(changed);
    } finally {fs.openSync = originalOpen;}
  });
  await test('TLS12 preparation CLI prints an offline fixed recipe without provisioning files', () => {
    const w = workspace(), before = fs.readdirSync(w.tls).sort();
    const run = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(checkout, 'node_modules/tsx/dist/loader.mjs')).href, path.join(checkout, 'scripts/prepareLoopbackTls.ts'), '--instructions'],
      {cwd: w.root, encoding: 'utf8', windowsHide: true, timeout: 10000});
    assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /openssl req/); assert.match(run.stdout, /subjectAltName=IP:127\.0\.0\.1/);
    assert.match(run.stdout, /READ_ONLY/); assert.match(run.stdout, /independent.*acceptance.*not/i);
    assert(!run.stdout.includes('BEGIN PRIVATE KEY')); assert.deepEqual(fs.readdirSync(w.tls).sort(), before);
  });
  await test('TLS14 certificate path or permission changes while the paired key is opened abort admission', () => {
    for (const attack of ['replace', 'permissions']) {
      const w = workspace(), originalOpen = fs.openSync; let changed = false;
      try {
        fs.openSync = ((file, flags, mode) => {
          if (file === w.key && !changed) {
            changed = true;
            if (attack === 'replace') {fs.renameSync(w.cert, path.join(w.root, 'cert-saved')); fs.writeFileSync(w.cert, valid.cert, {flag: 'wx', mode: 0o600}); privatePath(w.cert, false);}
            else if (process.platform === 'win32') execFileSync('icacls.exe', [w.cert, '/grant', '*S-1-1-0:R'], {windowsHide: true, stdio: 'pipe'});
            else fs.chmodSync(w.cert, 0o644);
          }
          return originalOpen(file as any, flags as any, mode);
        }) as typeof fs.openSync;
        rejects(() => resolveWorkspaceTls(w.root, env)); assert(changed);
      } finally {fs.openSync = originalOpen;}
    }
  });
  await test('TLS15 missing fixed files directories and unexpected children fail with stable workspace errors', () => {
    for (const target of ['key', 'tls', 'security'] as const) {
      const w = workspace();
      if (target === 'key') fs.unlinkSync(w.key);
      else fs.renameSync(w[target], path.join(w.root, `saved-${target}`));
      rejects(() => resolveWorkspaceTls(w.root, env));
    }
    const w = workspace(); fs.writeFileSync(path.join(w.tls, 'unapproved.txt'), 'inert'); rejects(() => resolveWorkspaceTls(w.root, env));
  });
  await test('TLS16 source import resolves its trusted helper independently of workspace cwd', () => {
    const w = workspace();
    const code = `import {resolveWorkspaceTls} from ${JSON.stringify(pathToFileURL(sourceTls).href)};try{const result=resolveWorkspaceTls(process.cwd(),${JSON.stringify(env)});console.log(JSON.stringify({enabled:result.enabled}));}catch(error){console.error(error.code);process.exitCode=1;}`;
    const run = spawnSync(process.execPath, ['--import', pathToFileURL(path.join(checkout, 'node_modules/tsx/dist/loader.mjs')).href, '--input-type=module', '-e', code],
      {cwd: w.root, encoding: 'utf8', windowsHide: true, timeout: 15000});
    assert.equal(run.status, 0, run.stderr); assert.deepEqual(JSON.parse(run.stdout), {enabled: true});
  });
  await test('TLS17 bundled CJS resolves the fixed source helper independently of workspace cwd', () => {
    const w = workspace(), bundled = path.join(base, 'deployment/dist/tls.cjs');
    buildSync({entryPoints: [sourceTls], outfile: bundled, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent'});
    const code = `const {resolveWorkspaceTls}=require(${JSON.stringify(bundled)});try{console.log(JSON.stringify({enabled:resolveWorkspaceTls(process.cwd(),${JSON.stringify(env)}).enabled}));}catch(error){console.error(error.code);process.exitCode=1;}`;
    const run = spawnSync(process.execPath, ['-e', code], {cwd: w.root, encoding: 'utf8', windowsHide: true, timeout: 15000});
    assert.equal(run.status, 0, run.stderr); assert.deepEqual(JSON.parse(run.stdout), {enabled: true});
  });
  await test('TLS13 actual loopback HTTPS authenticates the exact SAN and refuses untrusted hostname and unauthenticated requests', async () => {
    const w = workspace(), resolved = resolveWorkspaceTls(w.root, env); if (!resolved.enabled) throw new Error('TLS must be enabled');
    const server = https.createServer({...resolved, minVersion: 'TLSv1.3'}, (request, response) => {
      response.statusCode = request.headers.authorization === 'Fixture inert token' ? 200 : 401; response.end('inert fixture');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const port = (server.address() as any).port;
    const request = (options: https.RequestOptions = {}) => new Promise<number>((resolve, reject) => {
      const req = https.get({hostname: '127.0.0.1', port, ca: resolved.cert, rejectUnauthorized: true, ...options}, response => {response.resume(); response.on('end', () => resolve(response.statusCode!));});
      req.on('error', reject); req.setTimeout(3000, () => req.destroy(new Error('Fixture deadline')));
    });
    try {
      assert.equal(await request(), 401); assert.equal(await request({headers: {authorization: 'Fixture inert token'}}), 200);
      await assert.rejects(request({ca: undefined}), error => /SELF_SIGNED|UNABLE_TO_VERIFY/.test((error as any).code));
      await assert.rejects(request({servername: 'localhost'}), {code: 'ERR_TLS_CERT_ALTNAME_INVALID'});
    } finally {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));}
  }, true);
} finally {
  process.chdir(checkout);
  // Recursive cleanup is limited to the one fresh test-owned absolute root;
  // junctions used in attacks are removed in their own test before cleanup.
  assert.equal(path.dirname(base), temporaryParent); assert.match(path.basename(base), /^dmk-workspace-tls-[A-Za-z0-9]+$/);
  assert.equal(fs.lstatSync(base).isSymbolicLink(), false); assert.equal(fs.realpathSync.native(base), base);
  fs.rmSync(base, {recursive: true});
}
console.log(`Workspace TLS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed) process.exitCode = 1;
