import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import express from 'express';
import {createWorkspaceBodyAdmission} from '../server/security/workspaceAccess/bodyAdmission.ts';
import {enforceApiRoutePolicy} from '../server/security/apiRoutePolicy.ts';

// Actual loopback HTTP, inert downstream counter. No authority, credentials,
// operator workspace, privileged mutation or claimed deployment acceptance.
const LIMIT = 10 * 1024 * 1024;
type Reply = {status: number; body: any; headers: http.IncomingHttpHeaders};
let passed = 0, failed = 0, sequence = 0;
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
}
async function fixture(receiveTimeoutMs = 1200) {
  const app = express(), arrivals = new Map<string, ReturnType<typeof barrier>>();
  const terminations = new Map<string, ReturnType<typeof barrier>>();
  const incoming = new Set<http.IncomingMessage>();
  let downstream = 0, parserErrors = 0;
  app.use(enforceApiRoutePolicy);
  app.use((req, _res, next) => {
    const id = req.get('x-fixture-id')!;
    incoming.add(req);
    req.once('aborted', () => terminations.get(id)?.resolve());
    req.once('end', () => terminations.get(id)?.resolve());
    req.once('error', () => terminations.get(id)?.resolve());
    req.once('close', () => terminations.get(id)?.resolve());
    arrivals.get(id)?.resolve(); next();
  });
  app.use(createWorkspaceBodyAdmission({receiveTimeoutMs}));
  // An inert transport-only early reply deliberately precedes the parser for
  // BA15. It demonstrates that res.finish is not a receive-lease release.
  app.use((req, res, next) => {
    if (req.get('x-fixture-early') === 'true') {res.json({fixtureEarly: true}); return;}
    if (req.get('x-fixture-stall') === 'true') {res.type('application/json').write('{'); return;}
    next();
  });
  app.use(express.json({limit: '10mb'}));
  app.all(['/api/health', '/api/projects'], (_req, res) => {downstream++; res.json({ok: true});});
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    parserErrors++;
    if (res.headersSent) return;
    if (error?.type === 'entity.parse.failed') {res.status(400).json({error: 'MALFORMED_JSON'}); return;}
    if (error?.type === 'entity.too.large') {res.status(413).json({error: 'REQUEST_BODY_TOO_LARGE'}); return;}
    res.status(500).json({error: 'FIXTURE_UNEXPECTED_ERROR'});
  });
  const listener = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => listener.once('listening', resolve));
  function open(options: {method?: string; path?: string; headers?: http.OutgoingHttpHeaders; first?: string | Buffer} = {}) {
    const id = String(++sequence), arrival = barrier(), termination = barrier();
    arrivals.set(id, arrival); terminations.set(id, termination);
    let responseSeen = false;
    const result = new Promise<Reply>((resolve, reject) => {
      const headers = {'content-type': 'application/json', 'x-fixture-id': id, ...options.headers};
      for (const name of Object.keys(headers)) if (headers[name] === undefined) delete headers[name];
      const request = http.request({hostname: '127.0.0.1', port: (listener.address() as any).port, agent: false,
        method: options.method || 'POST', path: options.path || '/api/projects', headers}, response => {
        responseSeen = true;
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.once('error', reject);
        response.once('end', () => {
          try {resolve({status: response.statusCode!, headers: response.headers, body: JSON.parse(Buffer.concat(chunks).toString())});}
          catch (error) {reject(error);}
        });
      });
      request.once('error', error => {if (!responseSeen) reject(error);});
      request.setTimeout(4000, () => request.destroy(new Error('HTTP fixture deadline')));
      requests.set(id, request);
      request.flushHeaders();
      if (options.first !== undefined) request.write(options.first);
    });
    // Aborted clients deliberately reject; attach a handler immediately.
    void result.catch(() => undefined);
    return {request: requests.get(id)!, result, arrived: arrival.promise, terminated: termination.promise};
  }
  const requests = new Map<string, http.ClientRequest>();
  return {open, port: (listener.address() as any).port as number, counts: () => ({downstream, parserErrors}), close: async () => {
    const closed = [...incoming].filter(request => !request.closed).map(request => new Promise<void>(resolve => request.once('close', () => resolve())));
    for (const request of requests.values()) request.destroy();
    for (const request of incoming) request.destroy();
    listener.closeAllConnections();
    await new Promise<void>(resolve => listener.close(() => resolve()));
    // Process-wide receive leases survive response completion; wait for each
    // actual request reader termination before creating the next fixture.
    await Promise.all(closed);
  }};
}
async function held(s: Awaited<ReturnType<typeof fixture>>, count = 4) {
  const requests = [];
  for (let i = 0; i < count; i++) {
    const request = s.open({headers: {'content-length': '2'}, first: '{'});
    await request.arrived; requests.push(request);
  }
  return requests;
}
async function check(name: string, run: () => Promise<void>) {
  try {await run(); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);}
}
async function bounded<T>(value: Promise<T>, ms = 2500): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {return await Promise.race([value, new Promise<never>((_, reject) => {timer = setTimeout(() => reject(Error('Fixture barrier deadline')), ms);})]);}
  finally {clearTimeout(timer!);}
}

await check('BA1 fifth receiving body is rejected without queue or downstream work', async () => {
  const s = await fixture();
  try {
    await held(s);
    const fifth = s.open({headers: {'content-length': '2'}, first: '{'});
    const reply = await bounded(fifth.result, 700);
    assert.equal(reply.status, 503); assert.equal(reply.body.error, 'REQUEST_BODY_CAPACITY_EXCEEDED');
    assert.equal(reply.headers.connection, 'close'); assert.equal(reply.headers['cache-control'], 'no-store');
    assert.equal(s.counts().downstream, 0);
  } finally {await s.close();}
});
await check('BA2 actual receive end releases a slot before downstream work', async () => {
  const s = await fixture();
  try {
    const requests = await held(s); requests[0].request.end('}');
    assert.equal((await requests[0].result).status, 200); await requests[0].terminated;
    const next = s.open({headers: {'content-length': '2'}}); next.request.end('{}');
    assert.equal((await next.result).status, 200); assert.equal(s.counts().downstream, 2);
  } finally {await s.close();}
});
await check('BA3 aborted body releases once and cannot over-release capacity', async () => {
  const s = await fixture();
  try {
    const requests = await held(s); requests[0].request.destroy(); await bounded(requests[0].terminated);
    const replacement = s.open({headers: {'content-length': '2'}, first: '{'}); await replacement.arrived;
    const fifth = s.open({headers: {'content-length': '2'}, first: '{'});
    assert.equal((await bounded(fifth.result, 700)).status, 503);
    assert.equal(s.counts().downstream, 0);
  } finally {await s.close();}
});
await check('BA4 declared oversize returns canonical413 without parsing or downstream work', async () => {
  const s = await fixture();
  try {
    const large = s.open({headers: {'content-length': String(LIMIT + 1)}, first: '{'});
    const reply = await bounded(large.result, 700); assert.equal(reply.status, 413);
    assert.deepEqual(reply.body, {error: 'REQUEST_BODY_TOO_LARGE'}); assert.equal(s.counts().downstream, 0);
    await bounded(large.terminated);
    await bounded(large.terminated);
    assert.equal(s.counts().parserErrors, 0);
  } finally {await s.close();}
});
await check('BA5 chunked overflow is stopped with413 and no downstream mutation', async () => {
  const s = await fixture();
  try {
    const large = s.open({headers: {'transfer-encoding': 'chunked'}});
    large.request.write(Buffer.concat([Buffer.from('"'), Buffer.alloc(LIMIT, 32), Buffer.from('"')]));
    // Keep receiving open: body-parser alone drains before returning its error.
    const reply = await bounded(large.result, 700); assert.equal(reply.status, 413);
    assert.deepEqual(reply.body, {error: 'REQUEST_BODY_TOO_LARGE'}); assert.equal(s.counts().downstream, 0);
  } finally {await s.close();}
});
await check('BA6 receive deadline408 closes reader and permits a new slot', async () => {
  const s = await fixture(180);
  try {
    const requests = await held(s);
    const replies = await Promise.all(requests.map(request => request.result));
    for (const reply of replies) {
      assert.equal(reply.status, 408); assert.deepEqual(reply.body, {error: 'REQUEST_BODY_RECEIVE_TIMEOUT'});
      assert.equal(reply.headers.connection, 'close');
    }
    await Promise.all(requests.map(request => bounded(request.terminated)));
    assert.equal(s.counts().downstream, 0);
    const next = s.open({headers: {'content-length': '2'}}); next.request.end('{}');
    assert.equal((await next.result).status, 200);
  } finally {await s.close();}
});
await check('BA7 no-body GET and declared zero bytes do not consume receive slots', async () => {
  const s = await fixture();
  try {
    await held(s);
    for (const headers of [{}, {'content-length': '0'}]) {
      const request = s.open({method: 'GET', path: '/api/health', headers: {'content-type': undefined, ...headers}});
      request.request.end(); assert.equal((await request.result).status, 200);
    }
    assert.equal(s.counts().downstream, 2);
  } finally {await s.close();}
});
await check('BA8 GET bodies and chunked bodies receive the same four-slot bound', async () => {
  const s = await fixture();
  try {
    await held(s);
    for (const headers of [{'content-length': '2'}, {'transfer-encoding': 'chunked'}]) {
      const request = s.open({method: 'GET', path: '/api/health', headers, first: '{'});
      assert.equal((await bounded(request.result, 700)).status, 503);
    }
    assert.equal(s.counts().downstream, 0);
  } finally {await s.close();}
});
await check('BA9 unsupported media charset and compression fail before authority work', async () => {
  const s = await fixture();
  try {
    for (const headers of [{'content-type': 'text/plain'}, {'content-type': undefined},
      {'content-type': 'application/problem+json'}, {'content-type': 'application/json; charset=utf-16'},
      {'content-type': 'application/json; charset=utf8'},
      {'content-type': 'application/json; extra=ignored'}, {'content-encoding': 'gzip'}, {'content-encoding': 'deflate'}]) {
      const request = s.open({headers: {'content-length': '2', ...headers}, first: '{'});
      const reply = await bounded(request.result, 700); assert.equal(reply.status, 415);
      assert.deepEqual(reply.body, {error: 'REQUEST_BODY_MEDIA_UNSUPPORTED'});
    }
    assert.equal(s.counts().downstream, 0); assert.equal(s.counts().parserErrors, 0);
  } finally {await s.close();}
});
await check('BA10 exact10MiB and UTF8 JSON retain parser behavior and malformed400', async () => {
  const s = await fixture();
  try {
    const exact = Buffer.concat([Buffer.from('{"value":"'), Buffer.alloc(LIMIT - 12, 32), Buffer.from('"}')]);
    assert.equal(exact.length, LIMIT);
    const request = s.open({headers: {'content-length': String(exact.length), 'content-type': 'application/json; charset="UTF-8"', 'content-encoding': 'identity'}});
    request.request.end(exact); assert.equal((await request.result).status, 200);
    const malformed = s.open({headers: {'content-length': '1'}}); malformed.request.end('{');
    const reply = await malformed.result; assert.equal(reply.status, 400); assert.equal(reply.body.error, 'MALFORMED_JSON');
    assert.equal(s.counts().downstream, 1);
  } finally {await s.close();}
});
await check('BA11 process-wide cap spans independently installed middleware instances', async () => {
  const first = await fixture(), second = await fixture();
  try {
    await held(first, 2); await held(second, 2);
    const fifth = second.open({headers: {'content-length': '2'}, first: '{'});
    assert.equal((await bounded(fifth.result, 700)).status, 503);
  } finally {await first.close(); await second.close();}
});
await check('BA12 upstream unknown and privileged denials retain policy before admission', async () => {
  const s = await fixture();
  try {
    await held(s);
    for (const [path, status, error] of [['/api/unknown', 404, 'API_ROUTE_UNREGISTERED'], ['/api/secrets', 403, 'AUTHORIZATION_UNAVAILABLE']] as const) {
      const request = s.open({path, headers: {'content-length': String(LIMIT + 1)}, first: '{'});
      const reply = await request.result; assert.equal(reply.status, status); assert.equal(reply.body.error, error);
    }
    assert.equal(s.counts().downstream, 0);
  } finally {await s.close();}
});
await check('BA13 timeout overrides cannot remove or increase the candidate deadline', async () => {
  for (const receiveTimeoutMs of [0, -1, 5001, Infinity, NaN, 1.5]) {
    assert.throws(() => createWorkspaceBodyAdmission({receiveTimeoutMs}), /receiveTimeoutMs/);
  }
  assert.equal(typeof createWorkspaceBodyAdmission(), 'function');
  assert.equal(typeof createWorkspaceBodyAdmission({receiveTimeoutMs: 5000}), 'function');
});
await check('BA14 trickled bytes do not extend the total receive deadline', async () => {
  const s = await fixture(180);
  let timer: ReturnType<typeof setInterval>;
  try {
    const request = s.open({headers: {'content-length': '1000'}, first: '{'});
    await request.arrived;
    timer = setInterval(() => request.request.write(' '), 40);
    const reply = await bounded(request.result, 700);
    assert.equal(reply.status, 408); assert.equal(s.counts().downstream, 0);
    await bounded(request.terminated);
  } finally {clearInterval(timer!); await s.close();}
});
await check('BA15 actual response finish does not release a still-receiving body', async () => {
  const s = await fixture();
  const socket = net.createConnection({host: '127.0.0.1', port: s.port});
  socket.on('error', () => undefined);
  try {
    await held(s, 3);
    const response = new Promise<string>((resolve, reject) => {
      let body = '';
      socket.on('data', bytes => {body += bytes.toString(); if (body.includes('{"fixtureEarly":true}')) resolve(body);});
      socket.once('error', reject);
    });
    socket.write('POST /api/projects HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: keep-alive\r\nX-Fixture-Early: true\r\n\r\n{');
    assert.match(await bounded(response, 700), /^HTTP\/1\.1 200/);
    const fifth = s.open({headers: {'content-length': '2'}, first: '{'});
    assert.equal((await bounded(fifth.result, 700)).status, 503);
    assert.equal(s.counts().downstream, 0);
  } finally {socket.destroy(); await s.close();}
});
await check('BA16 a pipelined stalled response cannot delay rejected-reader teardown', async () => {
  const s = await fixture(180), other = await fixture();
  const socket = net.createConnection({host: '127.0.0.1', port: s.port});
  socket.on('error', () => undefined); socket.resume();
  try {
    await held(other, 3);
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
    // First response never finishes. The second request receives a body whose
    // deadline must terminate its reader even while its408 is queued behind it.
    socket.write('GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Fixture-Stall: true\r\nConnection: keep-alive\r\n\r\n'
      + 'POST /api/projects HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 1000\r\nConnection: keep-alive\r\n\r\n{');
    await bounded(closed, 700);
    const next = other.open({headers: {'content-length': '2'}}); next.request.end('{}');
    assert.equal((await next.result).status, 200); assert.equal(s.counts().downstream, 0);
  } finally {socket.destroy(); await s.close(); await other.close();}
});
console.log(`Workspace body admission: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
