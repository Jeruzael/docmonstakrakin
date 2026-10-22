import type {RequestHandler} from 'express';

const MAX_RECEIVING = 4;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_RECEIVE_MS = 5000;
// Process-wide, including independently installed instances. No waiting queue.
let receiving = 0;

/**
 * Mount in ENFORCED mode after route/perimeter policy and before express.json.
 * That parser must remain before any authority RPC and retain its 10mb limit.
 * The final error handler must ignore errors after res.headersSent: destroying
 * a rejected reader also causes body-parser to report request.aborted.
 *
 * This only bounds incoming API bodies. It grants no identity or authority and
 * never holds a receive lease for a response, session, parser or RPC lifetime.
 * receiveTimeoutMs may only shorten the candidate deadline for focused tests.
 */
export function createWorkspaceBodyAdmission(options: {receiveTimeoutMs?: number} = {}): RequestHandler {
  const receiveTimeoutMs = options.receiveTimeoutMs ?? MAX_RECEIVE_MS;
  if (!Number.isSafeInteger(receiveTimeoutMs) || receiveTimeoutMs < 1 || receiveTimeoutMs > MAX_RECEIVE_MS) {
    throw new RangeError('receiveTimeoutMs must be an integer from 1 through 5000');
  }
  return (req, res, next) => {
    if (!/^\/api(?:\/|$)/i.test(req.path)) {next(); return;}
    const length = req.headers['content-length'];
    const chunked = req.headers['transfer-encoding'] !== undefined;
    if (!chunked && (length === undefined || /^0+$/.test(length))) {next(); return;}

    let rejected = false, terminating = false;
    const terminate = () => {
      if (terminating) return;
      terminating = true;
      // Graceful FIN lets a trickling sender receive the small error response.
      // reject() independently bounds teardown even if response finish stalls.
      req.socket.end();
    };
    const reject = (status: number, error: string) => {
      if (rejected) return;
      rejected = true;
      // Stop consumption immediately; send the bounded response before closing
      // the reader so an ordinary client can observe the canonical status.
      req.pause();
      // Start the fixed grace bound now, rather than waiting for a possibly
      // backpressured/pipelined response finish. No bytes are consumed while
      // paused, and only actual reader termination releases an admitted lease.
      const teardown = setTimeout(() => req.destroy(), 50);
      teardown.unref();
      req.once('close', () => clearTimeout(teardown));
      if (!res.headersSent) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Connection', 'close');
        res.status(status).json({error});
      }
      // Response finish is only a trigger to terminate the reader. The lease is
      // released by actual receive/reader termination, never by this callback.
      if (res.writableFinished || res.destroyed) terminate();
      else {
        res.once('finish', terminate);
        res.once('close', terminate);
      }
    };

    if (length !== undefined && (!/^\d+$/.test(length) || BigInt(length) > BigInt(MAX_BYTES))) {
      reject(413, 'REQUEST_BODY_TOO_LARGE'); return;
    }
    // The existing express.json default consumes application/json only. Do not
    // permit a media type it would skip, or authority could run during receive.
    const media = req.headers['content-type'] || '';
    const encoding = req.headers['content-encoding'];
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:"utf-8"|utf-8))?\s*$/i.test(media)
      || (encoding !== undefined && encoding.trim().toLowerCase() !== 'identity')) {
      reject(415, 'REQUEST_BODY_MEDIA_UNSUPPORTED'); return;
    }
    if (receiving >= MAX_RECEIVING) {reject(503, 'REQUEST_BODY_CAPACITY_EXCEEDED'); return;}

    receiving++;
    let bytes = 0, released = false;
    const release = () => {
      if (released) return;
      released = true;
      receiving--;
      clearTimeout(timer);
      req.removeListener('data', onData);
      req.removeListener('end', release);
      req.removeListener('aborted', release);
      req.removeListener('error', release);
      req.removeListener('close', release);
    };
    const onData = (chunk: Buffer | string) => {
      bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (bytes > MAX_BYTES) reject(413, 'REQUEST_BODY_TOO_LARGE');
    };
    const timer = setTimeout(() => reject(408, 'REQUEST_BODY_RECEIVE_TIMEOUT'), receiveTimeoutMs);
    timer.unref();
    req.on('data', onData);
    req.once('end', release);
    req.once('aborted', release);
    req.once('error', release);
    // If the HTTP parser already received the final wire chunk, a paused reader
    // can close without emitting readable end or aborted. This is actual reader
    // termination, not response completion; it must also release the lease.
    req.once('close', release);
    // Synchronous next attaches express.json before incoming data is emitted.
    // It waits for end (or fails) before any downstream authority middleware.
    next();
  };
}
