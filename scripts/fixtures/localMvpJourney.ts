import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes, scryptSync} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import {ProjectStore} from '../../server/projectStore.ts';
import {createSyntheticServerPreload} from './syntheticServerPreload.ts';

export const JOURNEY_ACCOUNTS = {
  author: {username: 'synthetic-journey-author', id: 'SYNTHETIC-AUTHOR', personId: 'synthetic-person-author', kind: 'HUMAN', roles: ['Security Officer']},
  security: {username: 'synthetic-journey-security', id: 'SYNTHETIC-SECURITY', personId: 'synthetic-person-security', kind: 'HUMAN', roles: ['Security Officer']},
  architect: {username: 'synthetic-journey-architect', id: 'SYNTHETIC-ARCHITECT', personId: 'synthetic-person-architect', kind: 'HUMAN', roles: ['Lead Architect']},
  agent: {username: 'synthetic-journey-agent', id: 'SYNTHETIC-AGENT', personId: 'synthetic-person-agent', kind: 'AGENT', roles: ['Security Officer', 'Lead Architect']},
} as const;

/** Actual App/server/persistence, with no inherited runtime state or operator credentials. */
export async function startLocalMvpJourney() {
  const sourceRoot = fs.realpathSync.native(process.cwd());
  // Reuses the admitted native-tripwire prefix, with a distinct journey marker.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-product-demo-mvp-'));
  const marker = randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(dir, '.local-mvp-journey-owned'), marker, {flag: 'wx'});
  const password = `Synthetic-only-${randomBytes(24).toString('hex')}`;
  const roster = Object.fromEntries(Object.values(JOURNEY_ACCOUNTS).map(({username, ...record}) => {
    const salt = randomBytes(16).toString('hex');
    return [username, {...record, credentialVerifier: `${salt}:${scryptSync(password, salt, 32).toString('hex')}`}];
  }));
  const store = new ProjectStore();
  for (const key of Object.keys(store)) (store as unknown as Record<string, unknown>)[key] = key === 'projects' ? [] : {};
  const snapshot = path.join(dir, '.local', 'project-state.json');
  fs.mkdirSync(path.dirname(snapshot));
  fs.writeFileSync(snapshot, JSON.stringify({schemaVersion: 1, state: store}));

  // Copy repository contract resources only, never .env, .local, an operator
  // snapshot, credentials or node_modules. App assets are built into temp below.
  const manifestPath = 'bootstrap/docmonstakrakin.self-bootstrap.json';
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, manifestPath), 'utf8')) as {documents: {path: string}[]};
  for (const relative of [manifestPath, ...manifest.documents.map(document => document.path), 'MASTER_WBS.yaml']) {
    const source = path.resolve(sourceRoot, relative), destination = path.resolve(dir, relative);
    assert.ok(source.startsWith(sourceRoot + path.sep)); assert.ok(destination.startsWith(dir + path.sep));
    if (fs.existsSync(source)) {fs.mkdirSync(path.dirname(destination), {recursive: true}); fs.copyFileSync(source, destination);}
  }
  fs.writeFileSync(path.join(dir, 'docs/00_control/PROJECT_STATE.md'), '# Disposable local MVP journey\n\nSynthetic fixture only. Production release remains blocked.\n');
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = (listener.address() as {port: number}).port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const base = `http://127.0.0.1:${port}`;
  const preload = createSyntheticServerPreload(dir);
  const env: NodeJS.ProcessEnv = {NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), GEMINI_API_KEY: '', DMK_HUMAN_REVIEWERS: JSON.stringify(roster)};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
  let child: ReturnType<typeof spawn> | undefined, output = '';
  const safeOutput = () => output.replaceAll(password, '[synthetic credential redacted]').slice(-16_000);
  const launch = () => {
    const instance = spawn(process.execPath, ['--import', pathToFileURL(path.join(sourceRoot, 'node_modules/tsx/dist/loader.mjs')).href,
      '--import', pathToFileURL(preload).href, path.join(sourceRoot, 'server.ts')], {cwd: dir, env, windowsHide: true, stdio: 'pipe'});
    instance.stdout!.on('data', data => {output += String(data);});
    instance.stderr!.on('data', data => {output += String(data);});
    instance.on('error', error => {output += error.message;});
    return instance;
  };
  const ready = async () => {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline && child?.exitCode === null) {
      try {if ((await fetch(base + '/api/health', {signal: AbortSignal.timeout(1000)})).ok) {assert.match(output, /SYNTHETIC_NATIVE_CREDENTIALS_FORBIDDEN/); return;}} catch { /* startup only */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Local MVP journey server failed to start: ${safeOutput()}`);
  };
  const stop = async () => {
    if (child?.exitCode === null) {
      const instance = child;
      const exited = new Promise<void>(resolve => instance.once('exit', () => resolve()));
      instance.kill();
      await Promise.race([exited, new Promise<never>((_, reject) => {const timer = setTimeout(() => reject(new Error('Fixture server did not stop')), 10_000); timer.unref();})]);
    }
  };
  const cleanup = () => {
    const target = fs.realpathSync.native(dir);
    assert.equal(path.dirname(target), fs.realpathSync.native(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('dmk-product-demo-mvp-'));
    assert.equal(fs.readFileSync(path.join(target, '.local-mvp-journey-owned'), 'utf8'), marker);
    assert.equal(fs.lstatSync(target).isSymbolicLink(), false);
    fs.rmSync(target, {recursive: true, force: true});
  };
  try {
    await build({root: sourceRoot, envDir: dir, envPrefix: 'DMK_SYNTHETIC_PUBLIC_', cacheDir: path.join(dir, '.vite-cache'), logLevel: 'silent',
      build: {outDir: path.join(dir, 'dist'), emptyOutDir: true}});
    child = launch(); await ready();
    return {base, dir, snapshot, password, accounts: JOURNEY_ACCOUNTS, bytes: () => fs.readFileSync(snapshot),
      state: () => (JSON.parse(fs.readFileSync(snapshot, 'utf8')) as {state: ProjectStore}).state,
      log: safeOutput, restart: async () => {await stop(); child = launch(); await ready();},
      close: async () => {await stop(); cleanup();}};
  } catch (error) {await stop(); cleanup(); throw error;}
}
