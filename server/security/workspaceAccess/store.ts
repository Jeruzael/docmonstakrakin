import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { WorkspaceSecurityError, WORKSPACE_LIMITS, type WorkspaceCommand } from './contracts.ts';
import { acquirePrivateWorkspace, releasePrivateWorkspace, type PrivateWorkspaceHandle } from './privateDirectory.ts';

type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
/** One live authority connection. Close retains data; uncertain exits retain lock. */
export class WorkspaceStore {
  private worker?: Worker;
  private pending = new Map<number, Pending>();
  private counter = 0;
  private available = false;
  private closing = false;
  private uncertain = false;
  private closePromise?: Promise<void>;
  private stopping?: Promise<void>;
  private constructor(private readonly handle: PrivateWorkspaceHandle) {}
  static async open(workspaceRoot: string, options: { initialize?: boolean; actionReceipts?: boolean; agentDelegation?: boolean } = {}): Promise<WorkspaceStore> {
    const version = process.versions.node.split('.').map(Number);
    if (!['win32', 'linux'].includes(process.platform) || process.arch !== 'x64' || version[0] !== 22 || version[1] < 23 || version[1] === 23 && version[2] < 3) throw new WorkspaceSecurityError('WORKSPACE_PLATFORM_UNSUPPORTED');
    if (!options || Object.keys(options).some(k => !['initialize', 'actionReceipts', 'agentDelegation'].includes(k)) || options.initialize !== undefined && typeof options.initialize !== 'boolean' || options.actionReceipts !== undefined && typeof options.actionReceipts !== 'boolean' || options.actionReceipts === true && options.initialize !== true || options.agentDelegation !== undefined && typeof options.agentDelegation !== 'boolean' || options.agentDelegation === true && (options.initialize !== true || options.actionReceipts !== true)) throw new WorkspaceSecurityError('WORKSPACE_INPUT_INVALID');
    const h = acquirePrivateWorkspace(workspaceRoot, options.initialize === true);
    const store = new WorkspaceStore(h);
    try { await store.start(options.initialize === true, options.actionReceipts === true, options.agentDelegation === true); return store; }
    catch (error) {
      await store.stop('WORKSPACE_UNAVAILABLE');
      // No connection is ever made available on startup failure. Data remains.
      try { releasePrivateWorkspace(h); } catch {}
      throw error;
    }
  }
  private async start(initialize: boolean, actionReceipts: boolean, agentDelegation: boolean) {
    const workerFile = typeof __dirname === 'string'
      ? path.resolve(__dirname, path.basename(__dirname) === 'dist' ? '../server/security/workspaceAccess/worker.cjs' : 'worker.cjs')
      : fileURLToPath(new URL('./worker.cjs', import.meta.url));
    const worker = new Worker(workerFile, { workerData: { ...this.handle, initialize, actionReceipts, agentDelegation }, execArgv: [] });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      const timer = setTimeout(() => { reject(new WorkspaceSecurityError('WORKSPACE_START_TIMEOUT')); void this.stop('WORKSPACE_START_TIMEOUT'); }, WORKSPACE_LIMITS.startupMs);
      worker.on('message', message => {
        if (!ready) {
          clearTimeout(timer);
          if (message?.ready !== true) { reject(new WorkspaceSecurityError(this.code(message?.error))); return; }
          ready = true; this.available = true; resolve(); return;
        }
        const pending = this.pending.get(message?.requestId);
        if (!pending || Object.hasOwn(message, 'error') === Object.hasOwn(message, 'value')) { this.uncertain = true; void this.stop('WORKSPACE_PROTOCOL_INVALID'); return; }
        this.pending.delete(message.requestId); clearTimeout(pending.timer);
        if (Object.hasOwn(message, 'error')) pending.reject(new WorkspaceSecurityError(this.code(message.error)));
        else pending.resolve(message.value);
      });
      worker.on('error', () => { clearTimeout(timer); reject(new WorkspaceSecurityError('WORKSPACE_UNAVAILABLE')); this.uncertain = ready; void this.stop('WORKSPACE_UNAVAILABLE'); });
      worker.on('exit', () => { clearTimeout(timer); if (!ready) reject(new WorkspaceSecurityError('WORKSPACE_UNAVAILABLE')); if (this.worker === worker) { if (!this.closing) this.uncertain = true; this.available = false; this.rejectPending('WORKSPACE_UNAVAILABLE'); } });
    });
  }
  private code(value: unknown) { return typeof value === 'string' && /^WORKSPACE_[A-Z_]{1,70}$/.test(value) ? value : 'WORKSPACE_UNAVAILABLE'; }
  private rejectPending(code: string) { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new WorkspaceSecurityError(code)); } this.pending.clear(); }
  private stop(code: string): Promise<void> {
    if (this.stopping) return this.stopping;
    this.available = false; this.rejectPending(code); const worker = this.worker; this.worker = undefined;
    if (!worker) return Promise.resolve();
    const stopping = worker.terminate().then(() => undefined).finally(() => { if (this.stopping === stopping) this.stopping = undefined; });
    this.stopping = stopping; return stopping;
  }
  execute(request: WorkspaceCommand): Promise<any> {
    if (this.closing) return Promise.reject(new WorkspaceSecurityError('WORKSPACE_UNAVAILABLE'));
    return this.send(request);
  }
  private send(request: unknown, closing = false): Promise<any> {
    if (!this.worker || !this.available) return Promise.reject(new WorkspaceSecurityError('WORKSPACE_UNAVAILABLE'));
    if (!closing && this.pending.size >= WORKSPACE_LIMITS.pending) return Promise.reject(new WorkspaceSecurityError('WORKSPACE_OVERLOADED'));
    try {
      // Bounded inert RPC data; descriptor walk rejects executable inputs before
      // structured cloning. Snapshot is the only admitted large string.
      let budget = 0, nodes = 0;
      const visit = (v: any, depth: number): void => {
        if (depth > 8 || ++nodes > 4096) throw Error();
        if (typeof v === 'string') { budget += Buffer.byteLength(v); if (budget > WORKSPACE_LIMITS.snapshotBytes + 16_384) throw Error(); return; }
        if (typeof v === 'number' && Number.isSafeInteger(v) || typeof v === 'boolean' || v === null || v === undefined) return;
        if (!v || typeof v !== 'object' || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(v)) || Object.getOwnPropertySymbols(v).length) throw Error();
        const names = Object.getOwnPropertyNames(v).filter(k => !Array.isArray(v) || k !== 'length'); if (names.length > 128) throw Error();
        if (Array.isArray(v) && (v.length > 128 || names.length !== v.length || names.some((k, i) => k !== String(i)))) throw Error();
        for (const k of names) { const d = Object.getOwnPropertyDescriptor(v, k)!; if (k.length > 128 || !d.enumerable || !('value' in d) || ['__proto__', 'prototype', 'constructor', 'toJSON'].includes(k)) throw Error(); visit(d.value, depth + 1); }
      };
      visit(request, 0);
    } catch { return Promise.reject(new WorkspaceSecurityError('WORKSPACE_INPUT_INVALID')); }
    const requestId = ++this.counter, worker = this.worker;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.uncertain = true; void this.stop('WORKSPACE_REQUEST_TIMEOUT'); }, WORKSPACE_LIMITS.requestMs);
      this.pending.set(requestId, { resolve, reject, timer });
      try { worker.postMessage({ requestId, request }); } catch { clearTimeout(timer); this.pending.delete(requestId); reject(new WorkspaceSecurityError('WORKSPACE_INPUT_INVALID')); }
    });
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.closePromise = (async () => {
      let acknowledged = false;
      try { if (this.available && !this.uncertain) { acknowledged = await this.send({ command: 'close' }, true) === true; } }
      finally { await this.stop('WORKSPACE_UNAVAILABLE'); }
      if (acknowledged && !this.uncertain) releasePrivateWorkspace(this.handle);
    })();
    return this.closePromise;
  }
}
