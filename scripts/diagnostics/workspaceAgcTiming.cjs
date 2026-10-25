'use strict';
// Opt-in, disposable-CI observer. No request bodies, paths, SQL, identities or secrets.
// Atomics expose the worker's current stage even when synchronous admission blocks
// its event loop. The original worker receives its original workerData unchanged.
const wt = require('node:worker_threads');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const cp = require('node:child_process');
const STAGE = ['idle', 'rpc', 'boundary.capture', 'boundary.acquire', 'boundary.assertFiles',
  'boundary.assertLock', 'boundary.release', 'boundary.assertRoot', 'boundary.other',
  'filesystem', 'sqlite', 'sqlite.begin', 'sqlite.commit', 'sqlite.rollback',
  'reserved14', 'reserved15', 'reserved16', 'reserved17', 'reserved18', 'reserved19',
  'subprocess.icacls', 'subprocess.powershell', 'subprocess.whoami', 'subprocess.other'];
const SLOTS = 512, WIDTH = 5, now = () => process.hrtime.bigint();
const ms = n => Number(n) / 1e6;
function setStage(c, stage, start, requestId) {
  Atomics.add(c, 13, 1n);
  if (requestId !== undefined) { Atomics.store(c, 3, requestId); Atomics.store(c, 2, start); }
  Atomics.store(c, 1, start); Atomics.store(c, 0, stage);
  Atomics.add(c, 13, 1n);
}
function observe(control, events, root) {
  const c = new BigInt64Array(control), e = new BigInt64Array(events);
  function record(stage, begin, elapsed) {
    const seq = Atomics.add(c, 12, 1n), i = Number(seq % BigInt(SLOTS)) * WIDTH;
    // Sequence is committed last; readers discard a slot still being written.
    Atomics.store(e, i, 0n);
    for (const [offset, value] of [[1, BigInt(stage)], [2, begin], [3, elapsed], [4, Atomics.load(c, 3)]]) Atomics.store(e, i + offset, value);
    Atomics.store(e, i, seq + 1n);
  }
  function timed(stage, fn, counter) {
    return function (...args) {
      const previous = Atomics.load(c, 0), previousStart = Atomics.load(c, 1), start = now();
      setStage(c, BigInt(stage), start);
      try { return Reflect.apply(fn, this, args); }
      finally {
        const elapsed = now() - start;
        if (counter !== undefined) Atomics.add(c, counter, elapsed);
        record(stage, start, elapsed);
        setStage(c, previous, previousStart);
      }
    };
  }
  const originalExec = cp.execFileSync;
  cp.execFileSync = function (file, ...args) {
    const name = path.basename(String(file)).toLowerCase();
    const stage = name === 'icacls.exe' ? 20 : name === 'powershell.exe' ? 21 : name === 'whoami.exe' ? 22 : 23;
    // Combined subprocess creation + execution + pipe acquisition; not OS ETW.
    return timed(stage, originalExec, 4).call(this, file, ...args);
  };
  for (const name of ['lstatSync', 'statSync', 'realpathSync', 'readdirSync', 'readFileSync', 'writeFileSync', 'openSync', 'closeSync', 'unlinkSync']) {
    const original = fs[name], wrapped = timed(9, original, 5);
    Object.assign(wrapped, original);
    if (original.native) wrapped.native = timed(9, original.native, 5);
    fs[name] = wrapped;
  }
  const boundary = require(path.join(root, 'server/security/workspaceAccess/privateBoundary.cjs'));
  const names = ['capture', 'acquire', 'assertFiles', 'assertLock', 'release', 'assertRoot'];
  for (const name of Object.keys(boundary)) if (typeof boundary[name] === 'function') {
    const index = names.indexOf(name);
    boundary[name] = timed(index < 0 ? 8 : index + 2, boundary[name]);
  }
  const originalLoad = Module._load;
  Module._load = function (name, parent, isMain) {
    const exported = originalLoad.call(this, name, parent, isMain);
    if (name !== 'better-sqlite3') return exported;
    return new Proxy(exported, { construct(target, args) {
      const db = Reflect.construct(target, args), statementCache = new WeakMap();
      return new Proxy(db, { get(object, key) {
        const value = Reflect.get(object, key, object);
        if (typeof value !== 'function') return value;
        if (key === 'prepare') return function (...parameters) {
          const stmt = timed(10, value, 6).apply(object, parameters);
          if (!statementCache.has(stmt)) statementCache.set(stmt, new Proxy(stmt, { get(statement, member) {
            const method = Reflect.get(statement, member, statement);
            return typeof method === 'function' ? timed(10, method.bind(statement), 6) : method;
          }}));
          return statementCache.get(stmt);
        };
        return function (...parameters) {
          // Only classify transaction boundaries; never emit SQL or its parameters.
          const verb = key === 'exec' && typeof parameters[0] === 'string' ? parameters[0].trim().split(/\s/)[0].toUpperCase() : '';
          const stage = verb === 'BEGIN' ? 11 : verb === 'COMMIT' ? 12 : verb === 'ROLLBACK' ? 13 : 10;
          const result = timed(stage, value, 6).apply(object, parameters);
          if (stage === 11) Atomics.store(c, 7, now());
          if (stage === 12 || stage === 13) {
            const start = Atomics.exchange(c, 7, 0n);
            if (start) { const elapsed = now() - start; Atomics.add(c, 8, elapsed); Atomics.add(c, 9, 1n); }
          }
          return result === object ? this : result;
        };
      }});
    }});
  };
  return c;
}
function snapshot(control, events) {
  const c = new BigInt64Array(control), e = new BigInt64Array(events), total = Atomics.load(c, 12), entries = [];
  let current;
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = Atomics.load(c, 13);
    if (before % 2n) continue;
    const stage = Atomics.load(c, 0), start = Atomics.load(c, 1), requestId = Atomics.load(c, 3), received = Atomics.load(c, 2);
    if (Atomics.load(c, 13) === before) { current = {stage: STAGE[Number(stage)], stageElapsedMs: start ? ms(now() - start) : 0, requestId: Number(requestId), workerReceivedMs: ms(received)}; break; }
  }
  for (let seq = total > 32n ? total - 32n : 0n; seq < total; seq++) {
    const i = Number(seq % BigInt(SLOTS)) * WIDTH, seen = Atomics.load(e, i);
    if (seen !== seq + 1n) continue;
    const entry = {stage: STAGE[Number(Atomics.load(e, i + 1))], startMs: ms(Atomics.load(e, i + 2)), durationMs: ms(Atomics.load(e, i + 3)), requestId: Number(Atomics.load(e, i + 4))};
    if (Atomics.load(e, i) === seen) entries.push(entry);
  }
  return {...(current || {stage: 'INCONSISTENT_SNAPSHOT', stageElapsedMs: null}), workerPostedMs: ms(Atomics.load(c, 10)),
    subprocessMs: ms(Atomics.load(c, 4)), filesystemMs: ms(Atomics.load(c, 5)), sqliteMs: ms(Atomics.load(c, 6)),
    transactionMs: ms(Atomics.load(c, 8)), transactions: Number(Atomics.load(c, 9)), events: Number(total), overwrittenEvents: Number(total > BigInt(SLOTS) ? total - BigInt(SLOTS) : 0n), recent: entries};
}
function runWorker() {
  const {payload, control, events, root, workerFile} = wt.workerData;
  wt.workerData = payload;
  const c = observe(control, events, root), port = wt.parentPort;
  const on = port.on, post = port.postMessage;
  port.on = function (event, listener) {
    return on.call(this, event, event !== 'message' ? listener : function (message) {
      setStage(c, 1n, now(), BigInt(Number.isSafeInteger(message?.requestId) ? message.requestId : 0));
      return listener.call(this, message);
    });
  };
  port.postMessage = function (...args) {
    Atomics.store(c, 10, now());
    const result = post.apply(this, args);
    setStage(c, 0n, 0n);
    return result;
  };
  require(workerFile);
}
function runParent() {
  const root = process.cwd(), parentControl = new SharedArrayBuffer(16 * 8), parentEvents = new SharedArrayBuffer(SLOTS * WIDTH * 8);
  observe(parentControl, parentEvents, root);
  const OriginalWorker = wt.Worker;
  let workers = 0;
  const emit = value => console.log('AGC_TIMING ' + JSON.stringify(value));
  wt.Worker = class extends OriginalWorker {
    constructor(file, options = {}) {
      const filename = file instanceof URL ? require('node:url').fileURLToPath(file) : path.resolve(String(file));
      if (!filename.replaceAll('\\', '/').endsWith('/workspaceAccess/worker.cjs')) { super(file, options); return; }
      const control = new SharedArrayBuffer(16 * 8), events = new SharedArrayBuffer(SLOTS * WIDTH * 8);
      super('require(' + JSON.stringify(__filename) + ').runWorker()', {...options, eval: true,
        workerData: {payload: options.workerData, control, events, root, workerFile: filename}});
      const id = ++workers, pending = new Map(), counts = Object.create(null);
      this.diagnostic = {id, control, events, pending, counts};
      emit({event: 'worker-start', worker: id, parent: snapshot(parentControl, parentEvents)});
      super.on('message', message => {
        const request = pending.get(message?.requestId);
        if (!request) return;
        pending.delete(message.requestId);
        const elapsedMs = ms(now() - request.start), state = snapshot(control, events);
        if (elapsedMs >= 2500) emit({event: 'slow-rpc', worker: id, ...request, start: undefined, elapsedMs,
          deltaMs: Object.fromEntries(Object.keys(request.baselineMs).map(k => [k, state[k] - request.baselineMs[k]])), state});
      });
      super.on('exit', code => emit({event: 'worker-exit', worker: id, code, counts, state: snapshot(control, events)}));
    }
    postMessage(message, ...args) {
      const d = this.diagnostic;
      if (d && Number.isSafeInteger(message?.requestId) && /^[A-Za-z]{1,40}$/.test(message?.request?.command)) {
        const command = message.request.command, ordinal = d.counts[command] = (d.counts[command] || 0) + 1;
        const c = new BigInt64Array(d.control);
        d.pending.set(message.requestId, {command, ordinal, requestId: message.requestId, start: now(),
          baselineMs: {subprocessMs: ms(Atomics.load(c, 4)), filesystemMs: ms(Atomics.load(c, 5)), sqliteMs: ms(Atomics.load(c, 6)), transactionMs: ms(Atomics.load(c, 8))}});
      }
      return super.postMessage(message, ...args);
    }
    terminate() {
      const d = this.diagnostic;
      if (d?.pending.size) emit({event: 'terminate-with-pending', worker: d.id,
        pending: [...d.pending.values()].slice(0, 64).map(r => ({...r, start: undefined, elapsedMs: ms(now() - r.start)})), state: snapshot(d.control, d.events)});
      return super.terminate();
    }
  };
  Module.syncBuiltinESMExports();
  emit({event: 'observer-enabled', node: process.version, platform: process.platform,
    restrictions: 'synthetic complete delegation suite only; original checks/deadlines; observer overhead; bounded ring; inclusive stage totals; subprocess timing combines creation/execution/acquisition'});
}
module.exports = {runWorker};
if (wt.isMainThread && process.env.DMK_AGC_DIAGNOSTIC === 'true' && process.env.GITHUB_ACTIONS === 'true' && process.env.CI === 'true' && process.platform === 'win32'
  && path.resolve(process.argv[1] || '') === path.resolve('scripts/testWorkspaceAgentDelegation.ts') && process.argv.length === 2) runParent();
