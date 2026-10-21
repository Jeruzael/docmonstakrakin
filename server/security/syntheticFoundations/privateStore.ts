import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Worker} from 'node:worker_threads';
import {SyntheticSecurityError, type StoreCommand} from './contracts.ts';
import {canonicalDirectory, directoryIdentity, assertOwnedDirectory, assertOwnerMarker} from './ownedDirectory.mjs';
import type {TestRoot} from '../authPilot/fixtureRecovery.ts';

const runFile = promisify(execFile);
type Pending = {resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; worker: Worker};
type RecoveryProfile = {rootKeySha256: string; authorityId: string; claim?: {transferDigest: string; fromGeneration: number; issuedAt: number; now: number}};

/** Default owns a generated schema1 root; explicit TESTONLY schema2 accepts signed, pinned transfers. */
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
  private detached = false;
  private constructor(readonly rootDirectory: string, private readonly owner: string, private readonly parentDirectory: string, private readonly rootIdentity: string, private readonly parentIdentity: string, private readonly recovery?: RecoveryProfile) {}
  static async create(): Promise<PrivateSyntheticStore> {
    return this.allocate();
  }
  /** Explicit synthetic schema2 only; normal schema1 factories never opt in. */
  static async createRecoveryFixture(root: TestRoot): Promise<PrivateSyntheticStore> {
    const {testRootFingerprint} = await import('../authPilot/fixtureRecovery.ts');
    const fingerprint = testRootFingerprint(root.publicDer);
    if (root.fingerprint !== fingerprint) throw new SyntheticSecurityError('STORE_RECOVERY_PROOF_INVALID');
    return this.allocate({rootKeySha256: fingerprint, authorityId: randomBytes(32).toString('hex')});
  }
  private static async allocate(recovery?: RecoveryProfile): Promise<PrivateSyntheticStore> {
    if (!['win32', 'linux'].includes(process.platform) || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 22) throw new SyntheticSecurityError('STORE_PLATFORM_UNSUPPORTED');
    const parent = canonicalDirectory(os.tmpdir()), parentIdentity = directoryIdentity(parent);
    // Preserve the lexical result of exclusive creation. Canonicalizing a
    // substituted root here could adopt its junction target before pinning.
    const root = await fs.mkdtemp(path.join(parent, 'dmk-s2a-synthetic-'));
    let rootIdentity: string;
    try {
      rootIdentity = directoryIdentity(root);
      assertOwnedDirectory(root, parent, rootIdentity, parentIdentity);
    } catch { throw new SyntheticSecurityError('STORE_PATH_INVALID'); }
    const store = new PrivateSyntheticStore(root, randomBytes(32).toString('hex'), parent, rootIdentity, parentIdentity, recovery);
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
      try {
        assertOwnedDirectory(root, parent, rootIdentity, parentIdentity);
        await fs.rm(root, {recursive: true});
      } catch { /* Never delete a replaced or uncertain directory on failure. */ }
      throw new SyntheticSecurityError(error instanceof SyntheticSecurityError ? error.code : 'STORE_UNAVAILABLE');
    }
  }
  static async acceptTestTransfer(raw: Buffer, trustedPublicDer: Buffer, now: number): Promise<PrivateSyntheticStore> {
    const {verifyTestTransfer, testTransferDigest} = await import('../authPilot/fixtureRecovery.ts');
    const proof = verifyTestTransfer(raw, trustedPublicDer, now);
    try {
      if (proof.parentDirectory !== canonicalDirectory(os.tmpdir())) throw Error();
      assertOwnedDirectory(proof.rootDirectory, proof.parentDirectory, proof.rootIdentity, proof.parentIdentity); assertOwnerMarker(proof.rootDirectory, proof.owner);
    }
    catch { throw new SyntheticSecurityError('STORE_PATH_INVALID'); }
    const store = new PrivateSyntheticStore(proof.rootDirectory, proof.owner, proof.parentDirectory, proof.rootIdentity, proof.parentIdentity, {
      rootKeySha256: proof.rootKeySha256, authorityId: randomBytes(32).toString('hex'),
      claim: {transferDigest: testTransferDigest(proof.nonce), fromGeneration: Number(proof.fromGeneration), issuedAt: Number(proof.issuedAt), now},
    });
    try { await store.start(); return store; }
    catch (error) { await store.terminate(); throw error; } // Never delete a failed claim's existing root.
  }
  async prepareTestTransfer(root: TestRoot, now: number): Promise<Buffer> {
    if (!this.recovery || this.detached || this.pending.size) throw new SyntheticSecurityError('STORE_RECOVERY_UNAVAILABLE');
    const {testRootFingerprint, testTransferDigest, testTransferPayload, verifyTestTransfer, TEST_RECOVERY_LIMITS} = await import('../authPilot/fixtureRecovery.ts');
    if (testRootFingerprint(root.publicDer) !== this.recovery.rootKeySha256) throw new SyntheticSecurityError('STORE_RECOVERY_PROOF_INVALID');
    let raw: Buffer;
    await this.transition(async () => {
      const nonce = randomBytes(32).toString('hex');
      // Reserve nondeleting custody BEFORE dispatch. A COMMIT followed by a
      // lost reply must never let the old manager delete a successor's root.
      // Even an uncommitted failure leaves cleanup to the fixture supervisor.
      this.detached = true;
      const receipt = await this.send({command: 'prepareTestTransfer', transferDigest: testTransferDigest(nonce), now});
      const payload = testTransferPayload({rootDirectory: this.rootDirectory, parentDirectory: this.parentDirectory,
        rootIdentity: this.rootIdentity, parentIdentity: this.parentIdentity, owner: this.owner,
        rootKeySha256: this.recovery!.rootKeySha256, nonce, fromGeneration: String(receipt.generation),
        issuedAt: String(now), expiresAt: String(now + TEST_RECOVERY_LIMITS.lifetimeMs)});
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        raw = await Promise.race([root.seal(payload), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new SyntheticSecurityError('STORE_RECOVERY_SEAL_TIMEOUT')), TEST_RECOVERY_LIMITS.sealWaitMs);
        })]);
      } finally { if (timer) clearTimeout(timer); }
      if (JSON.stringify(verifyTestTransfer(raw, root.publicDer, now)) !== JSON.stringify(payload)) throw new SyntheticSecurityError('STORE_RECOVERY_PROOF_INVALID');
    });
    return raw!;
  }
  private async start(fresh = false) {
    if (this.stopping) await this.stopping;
    if (this.closed || this.closing) throw new SyntheticSecurityError('STORE_UNAVAILABLE');
    const worker = new Worker(new URL('./privateStoreWorker.mjs', import.meta.url), {workerData: {rootDirectory: this.rootDirectory, owner: this.owner, fresh, parentDirectory: this.parentDirectory, rootIdentity: this.rootIdentity, parentIdentity: this.parentIdentity, ...(this.recovery ? {recovery: this.recovery} : {})}, execArgv: []});
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
    if (this.recovery) delete this.recovery.claim;
  }
  private unavailable(worker: Worker) {
    if (this.worker !== worker) return;
    this.available = false;
    for (const [id, pending] of this.pending) if (pending.worker === worker) { clearTimeout(pending.timer); pending.reject(new SyntheticSecurityError('STORE_UNAVAILABLE')); this.pending.delete(id); }
  }
  execute(command: StoreCommand): Promise<any> {
    if (command?.command === 'prepareTestTransfer') return Promise.reject(new SyntheticSecurityError('STORE_RECOVERY_UNAVAILABLE'));
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
    if (this.detached || this.pending.size) return Promise.reject(new SyntheticSecurityError('STORE_UNAVAILABLE'));
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
      let mayRemoveRoot = !this.recovery;
      // At most one transition may precede close. No unbounded lifecycle queue.
      try { if (preceding) await preceding; } catch { /* close still owns cleanup */ }
      try {
        if (this.available && this.pending.size === 0) {
          const receipt = await this.send({command: 'close'});
          if (this.recovery) mayRemoveRoot = receipt?.mayRemoveRoot === true;
        }
      }
      finally { await this.stopWorker(); this.closed = true; }
      if (this.detached || !mayRemoveRoot) return; // Never delete transferred or uncertain authority.
      try {
        assertOwnedDirectory(this.rootDirectory, this.parentDirectory, this.rootIdentity, this.parentIdentity);
        assertOwnerMarker(this.rootDirectory, this.owner);
      } catch { throw new SyntheticSecurityError('STORE_CLEANUP_REFUSED'); }
      await fs.rm(this.rootDirectory, {recursive: true});
    })();
    return this.closePromise;
  }
}
