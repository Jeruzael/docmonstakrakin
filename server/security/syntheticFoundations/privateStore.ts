import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Worker} from 'node:worker_threads';
import {SyntheticSecurityError, type StoreCommand} from './contracts.ts';

const runFile = promisify(execFile);
type Pending = {resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; worker: Worker};

/** Owns one generated root. No API accepts an existing directory/database path. */
export class PrivateSyntheticStore {
  private worker?: Worker;
  private pending = new Map<number, Pending>();
  private counter = 0;
  private available = false;
  private closed = false;
  private closing = false;
  private lifecycle?: Promise<void>;
  private stopping?: Promise<void>;
  private closePromise?: Promise<void>;
  private constructor(readonly rootDirectory: string, private readonly owner: string) {}
  static async create(): Promise<PrivateSyntheticStore> {
    if (!['win32', 'linux'].includes(process.platform) || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 22) throw new SyntheticSecurityError('STORE_PLATFORM_UNSUPPORTED');
    const parent = await fs.realpath(os.tmpdir());
    const root = await fs.mkdtemp(path.join(parent, 'dmk-s2a-synthetic-'));
    const store = new PrivateSyntheticStore(root, randomBytes(32).toString('hex'));
    try {
      if (process.platform === 'win32') {
        // Restrict only this newly-created disposable fixture. No account/ACL
        // provisioning or production directory is touched.
        const identity = await runFile('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {windowsHide: true, timeout: 5000});
        const sid = /S-1-\d+(?:-\d+)+/.exec(identity.stdout)?.[0];
        if (!sid) throw new SyntheticSecurityError('STORE_PRIVATE_DIRECTORY_UNAVAILABLE');
        await runFile('icacls.exe', [root, '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F'], {windowsHide: true, timeout: 5000});
      } else await fs.chmod(root, 0o700);
      await fs.writeFile(path.join(root, '.synthetic-owner'), store.owner, {flag: 'wx', mode: 0o600});
      await store.start(true);
      return store;
    } catch (error) {
      await store.terminate();
      // The generated absolute root is checked before any recursive cleanup.
      if (path.dirname(root) === parent && path.basename(root).startsWith('dmk-s2a-synthetic-') && !(await fs.lstat(root)).isSymbolicLink()) await fs.rm(root, {recursive: true});
      throw new SyntheticSecurityError(error instanceof SyntheticSecurityError ? error.code : 'STORE_UNAVAILABLE');
    }
  }
  private async start(fresh = false) {
    if (this.stopping) await this.stopping;
    if (this.closed || this.closing) throw new SyntheticSecurityError('STORE_UNAVAILABLE');
    const worker = new Worker(new URL('./privateStoreWorker.mjs', import.meta.url), {workerData: {rootDirectory: this.rootDirectory, owner: this.owner, fresh}, execArgv: []});
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      const timer = setTimeout(() => { reject(new SyntheticSecurityError('STORE_START_TIMEOUT')); void this.stopWorker(worker); }, 10_000);
      worker.on('message', message => {
        if (this.worker !== worker) return;
        if (!ready) {
          if (message?.ready !== true || Object.keys(message).length !== 1) {
            clearTimeout(timer); reject(new SyntheticSecurityError(typeof message?.error === 'string' && /^STORE_[A-Z_]+$/.test(message.error) ? message.error : 'STORE_UNAVAILABLE')); return;
          }
          ready = true; this.available = true; clearTimeout(timer); resolve(); return;
        }
        if (!message || !Number.isSafeInteger(message.requestId) || !this.pending.has(message.requestId) || Object.keys(message).some(key => !['requestId', 'value', 'error'].includes(key)) || Object.hasOwn(message, 'error') === Object.hasOwn(message, 'value')) {
          void this.stopWorker(worker); return;
        }
        const pending = this.pending.get(message.requestId)!;
        if (pending.worker !== worker) { void this.stopWorker(worker); return; }
        this.pending.delete(message.requestId); clearTimeout(pending.timer);
        if (Object.hasOwn(message, 'error')) pending.reject(new SyntheticSecurityError(typeof message.error === 'string' && /^[A-Z_]{1,80}$/.test(message.error) ? message.error : 'STORE_UNAVAILABLE'));
        else pending.resolve(message.value);
      });
      worker.on('error', () => { clearTimeout(timer); if (this.worker !== worker) return; reject(new SyntheticSecurityError('STORE_UNAVAILABLE')); this.unavailable(worker); });
      worker.on('exit', () => { clearTimeout(timer); if (this.worker !== worker) return; if (!ready) reject(new SyntheticSecurityError('STORE_UNAVAILABLE')); this.unavailable(worker); });
    });
  }
  private unavailable(worker: Worker) {
    if (this.worker !== worker) return;
    this.available = false;
    for (const [id, pending] of this.pending) if (pending.worker === worker) { clearTimeout(pending.timer); pending.reject(new SyntheticSecurityError('STORE_UNAVAILABLE')); this.pending.delete(id); }
  }
  execute(command: StoreCommand): Promise<any> {
    if (this.lifecycle || this.closing) return Promise.reject(new SyntheticSecurityError('STORE_UNAVAILABLE'));
    return this.send(command);
  }
  private send(command: unknown): Promise<any> {
    if (!this.available || !this.worker || this.closed) return Promise.reject(new SyntheticSecurityError('STORE_UNAVAILABLE'));
    if (this.pending.size >= 16) return Promise.reject(new SyntheticSecurityError('STORE_OVERLOADED'));
    try {
      if (!command || Object.getPrototypeOf(command) !== Object.prototype || Object.keys(command).length > 8 || Object.values(command).some(value => typeof value !== 'string' && typeof value !== 'number' || typeof value === 'string' && value.length > 1024) || Buffer.byteLength(JSON.stringify(command), 'utf8') > 8192) throw Error();
    }
    catch { return Promise.reject(new SyntheticSecurityError('STORE_INPUT_INVALID')); }
    const requestId = ++this.counter;
    const worker = this.worker;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Never reuse an uncertain authority connection or retry a mutation.
        if (this.worker !== worker) return;
        reject(new SyntheticSecurityError('STORE_REQUEST_TIMEOUT')); void this.stopWorker(worker);
      }, 3000);
      this.pending.set(requestId, {resolve, reject, timer, worker});
      try { worker.postMessage({requestId, request: command}); }
      catch { this.pending.delete(requestId); clearTimeout(timer); reject(new SyntheticSecurityError('STORE_INPUT_INVALID')); }
    });
  }
  private stopWorker(worker = this.worker): Promise<void> {
    if (!worker || this.worker !== worker) return this.stopping ?? Promise.resolve();
    this.unavailable(worker); this.worker = undefined;
    const stopping = (async () => {
      try { await worker.terminate(); }
      finally { if (this.stopping === stopping) this.stopping = undefined; }
    })();
    this.stopping = stopping;
    return stopping;
  }
  private transition(operation: () => Promise<void>): Promise<void> {
    if (this.closed || this.closing) return Promise.reject(new SyntheticSecurityError('STORE_UNAVAILABLE'));
    if (this.lifecycle) return Promise.reject(new SyntheticSecurityError('STORE_LIFECYCLE_BUSY'));
    const current = (async () => {
      try { await operation(); }
      finally { if (this.lifecycle === current) this.lifecycle = undefined; }
    })();
    this.lifecycle = current;
    return current;
  }
  terminate(): Promise<void> { return this.transition(() => this.stopWorker()); }
  restart(): Promise<void> {
    if (this.pending.size) return Promise.reject(new SyntheticSecurityError('STORE_UNAVAILABLE'));
    return this.transition(async () => {
      if (this.available) await this.send({command: 'close'});
      await this.stopWorker();
      try { await this.start(); }
      catch (error) { await this.stopWorker(); throw error; }
    });
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closing = true; // Reserve the sole close before any await; bar new RPCs.
    const preceding = this.lifecycle;
    this.closePromise = (async () => {
      // At most one transition may precede close. No unbounded lifecycle queue.
      try { if (preceding) await preceding; } catch { /* close still owns cleanup */ }
      try { if (this.available && this.pending.size === 0) await this.send({command: 'close'}); }
      finally { await this.stopWorker(); this.closed = true; }
      const parent = await fs.realpath(os.tmpdir());
      if (path.dirname(this.rootDirectory) !== parent || !/^dmk-s2a-synthetic-[A-Za-z0-9]+$/.test(path.basename(this.rootDirectory)) || (await fs.lstat(this.rootDirectory)).isSymbolicLink() || await fs.realpath(this.rootDirectory) !== this.rootDirectory || await fs.readFile(path.join(this.rootDirectory, '.synthetic-owner'), 'utf8') !== this.owner) throw new SyntheticSecurityError('STORE_CLEANUP_REFUSED');
      await fs.rm(this.rootDirectory, {recursive: true});
    })();
    return this.closePromise;
  }
}
