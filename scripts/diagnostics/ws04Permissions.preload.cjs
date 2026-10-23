'use strict';
// Diagnostic-only observer. Never enable against an operator workspace.
// Outputs contain operation names and bounded subprocess metadata, never RPC
// payloads, descriptors, process arguments, PHC strings, tokens, or raw SIDs.
if (process.env.DMK_WS04_DIAGNOSTIC !== 'synthetic-only') throw Error('WS04_DIAGNOSTIC_SCOPE_REQUIRED');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Module = require('node:module'), cp = require('node:child_process'), wt = require('node:worker_threads');
const evidence = process.env.DMK_WS04_EVIDENCE;
if (!evidence || !path.isAbsolute(evidence) || fs.realpathSync.native(evidence) !== evidence || fs.lstatSync(evidence).isSymbolicLink()) throw Error('WS04_DIAGNOSTIC_EVIDENCE_REQUIRED');
const output = path.join(evidence, `observer-${process.pid}-${wt.threadId}.jsonl`);
const append = fs.appendFileSync.bind(fs), started = process.hrtime.bigint();
let context = wt.isMainThread ? 'store-open' : 'worker-startup', sequence = 0;
const safeCode = value => typeof value === 'string' && /^[A-Za-z0-9_:.-]{1,100}$/.test(value) ? value : undefined;
function emit(event, data = {}) {
  // Observability must never substitute success/failure for the genuine call.
  try { append(output, JSON.stringify({ event, thread: wt.threadId, sequence: ++sequence,
    elapsedMs: Number(process.hrtime.bigint() - started) / 1e6, context, ...data }) + '\n'); }
  catch { /* The runner rejects missing evidence separately. */ }
}
function targetLabel(value) {
  if (typeof value !== 'string') return undefined;
  const leaf = path.basename(value);
  return ['.security', 'owner.lock', 'authority.sqlite', 'authority.sqlite-wal', 'authority.sqlite-shm'].includes(leaf) ? leaf : 'other-synthetic-path';
}
emit('observer-start', { actor: wt.isMainThread ? 'parent' : 'worker', node: process.versions.node,
  platform: process.platform, arch: process.arch, fixture: process.argv.some(v => v.endsWith('ws04ObserverControls.cjs')) ? 'genuine-negative-controls' : 'source-selected-WS04', launcherAddsWorkerRequire: true });
const originalExec = cp.execFileSync;
cp.execFileSync = function observedExec(file, args, options) {
  if (!new Error().stack.includes('privateBoundary.cjs')) return originalExec.apply(this, arguments);
  let operation = 'other-boundary-subprocess', targetPath;
  const executable = path.basename(file).toLowerCase();
  if (executable === 'whoami.exe') operation = 'resolve-current-user-sid';
  if (executable === 'icacls.exe') { operation = 'read-acl-listing-and-pin'; targetPath = args[0]; }
  if (executable === 'powershell.exe') {
    const index = args.indexOf('-EncodedCommand');
    const script = index >= 0 ? Buffer.from(args[index + 1], 'base64').toString('utf16le') : '';
    operation = script.includes('[System.Security.AccessControl.DirectorySecurity]::new()') ? 'create-private-directory-dacl'
      : script.includes('[System.IO.Directory]::GetAccessControl') ? 'initial-directory-descriptor-admission'
      : script.includes('[System.IO.File]::GetAccessControl') ? 'initial-file-descriptor-admission' : 'other-boundary-powershell';
    targetPath = /\$p='((?:''|[^'])*)'/.exec(script)?.[1]?.replaceAll("''", "'")
      || /GetAccessControl\('((?:''|[^'])*)'\)/.exec(script)?.[1]?.replaceAll("''", "'");
  }
  const before = process.hrtime.bigint(), metadata = { operation, target: targetLabel(targetPath),
    targetId: targetPath ? crypto.createHash('sha256').update(targetPath).digest('hex').slice(0, 16) : undefined,
    timeoutMs: options?.timeout };
  emit('subprocess-enter', metadata);
  try {
    const result = originalExec.apply(this, arguments);
    emit('subprocess-return', { ...metadata, ok: true, status: 0, durationMs: Number(process.hrtime.bigint() - before) / 1e6,
      ...(operation === 'read-acl-listing-and-pin' ? { listingSha256: crypto.createHash('sha256').update(result).digest('hex') } : {}) });
    return result;
  } catch (error) {
    emit('subprocess-return', { ...metadata, ok: false, status: Number.isInteger(error.status) ? error.status : null,
      signal: safeCode(error.signal), errorCode: safeCode(error.code), syscall: safeCode(error.syscall?.replaceAll(' ', ':')),
      stdoutBytes: error.stdout?.length || 0, stderrBytes: error.stderr?.length || 0,
      durationMs: Number(process.hrtime.bigint() - before) / 1e6 });
    throw error;
  }
};
// Boundary exports are wrappers only; the closed-over permission predicates,
// pins, inputs, return values, and exceptions remain the original implementation.
const load = Module._load, wrapped = new WeakSet();
Module._load = function observedLoad(request, parent, isMain) {
  const value = load.apply(this, arguments);
  if (typeof request === 'string' && request.endsWith('privateBoundary.cjs') && !wrapped.has(value)) {
    wrapped.add(value);
    for (const [name, fn] of Object.entries(value)) if (typeof fn === 'function') {
      value[name] = function observedBoundary(...args) {
        if (wt.isMainThread && name === 'capture') context = 'store-open';
        emit('boundary-enter', { operation: name });
        try { const result = fn.apply(this, args); emit('boundary-return', { operation: name, ok: true }); return result; }
        catch (error) { emit('boundary-return', { operation: name, ok: false, errorCode: safeCode(error.code) }); throw error; }
      };
    }
  }
  return value;
};
if (wt.isMainThread) {
  const OriginalWorker = wt.Worker, observedWorkers = new WeakSet();
  wt.Worker = class ObservedWorker extends OriginalWorker {
    constructor(file, options) {
      const observed = path.basename(String(file)) === 'worker.cjs';
      // store.ts explicitly supplies execArgv:[]; NODE_OPTIONS alone is not
      // assumed to observe the worker. This is a declared diagnostic perturbation.
      super(file, observed ? { ...options, execArgv: [...(options?.execArgv || []), '--require', __filename] } : options);
      if (observed) {
        observedWorkers.add(this);
        emit('worker-created', { workerThreadId: this.threadId, originalExecArgvCount: options?.execArgv?.length || 0 });
        this.on('message', message => emit('worker-reply', { requestId: message?.requestId, ready: message?.ready,
          errorCode: safeCode(message?.error), hasValue: Object.hasOwn(message || {}, 'value') }));
        this.on('exit', code => emit('worker-exit', { status: code }));
      }
    }
    postMessage(message, ...rest) {
      if (!observedWorkers.has(this)) return super.postMessage(message, ...rest);
      if (safeCode(message?.request?.command)) context = `${message.request.command}:${message.requestId}`;
      emit('rpc-send', { requestId: message?.requestId, command: safeCode(message?.request?.command) });
      return super.postMessage(message, ...rest);
    }
  };
  require('node:module').syncBuiltinESMExports();
} else {
  wt.parentPort.on('message', message => {
    context = safeCode(message?.request?.command) ? `${message.request.command}:${message.requestId}` : 'unclassified-request';
    emit('rpc-receive', { requestId: message?.requestId, command: safeCode(message?.request?.command) });
  });
  const post = wt.parentPort.postMessage;
  wt.parentPort.postMessage = function observedReply(message, ...rest) {
    emit('rpc-reply', { requestId: message?.requestId, ready: message?.ready, errorCode: safeCode(message?.error),
      hasValue: Object.hasOwn(message || {}, 'value') });
    return post.call(this, message, ...rest);
  };
}
