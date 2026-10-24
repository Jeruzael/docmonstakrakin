import assert from 'node:assert/strict';
import http from 'node:http';
import {fork, type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {deflateSync, gzipSync} from 'node:zlib';
import express from 'express';

// Characterize the real shared Express JSON parser used by server.ts (10 MiB,
// default inflation). Every listener is a disposable loopback-only child. No
// authority, credentials, operator state, public target or uncaught-error shim.
// A return to body-parser 1.20.8 must fail the trailing-byte survival checks.
const childMode = process.argv.includes('--body-parser-child');
if (childMode) {
  const app = express();
  app.use(express.json({limit: '10mb'}));
  app.get('/health', (_req, res) => res.json({ok: true}));
  app.post('/echo', (req, res) => {
    const reply = () => res.json(req.body);
    if (req.get('x-fixture-split') === '1') {
      // An IPC barrier puts the tail after decoder completion, without a sleep
      // that could accidentally combine the two chunks and miss the bug.
      req.once('end', reply);
      process.send!({parsed: true});
    } else reply();
  });
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (!res.headersSent) res.status(error.status || 400).json({error: error.type || 'DECODE_ERROR'});
  });
  const listener = app.listen(0, '127.0.0.1', () => {
    process.send!({port: (listener.address() as import('node:net').AddressInfo).port});
  });
  process.on('message', message => {
    if (message === 'stop') listener.close(() => process.exit(0));
  });
} else {
  let passed = 0, failed = 0;
  const require = createRequire(import.meta.url);
  const expressPackage = require.resolve('express/package.json');
  const parserPackage = createRequire(expressPackage).resolve('body-parser/package.json');
  console.log('Parser provenance: ' + JSON.stringify({node: process.version,
    express: JSON.parse(readFileSync(expressPackage, 'utf8')).version,
    bodyParser: JSON.parse(readFileSync(parserPackage, 'utf8')).version}));
  const plain = Buffer.from('{"fixture":"synthetic","count":1}');
  type Fixture = {child: ChildProcess; port: number; log: () => string};
  async function fixture(run: (f: Fixture) => Promise<void>) {
    const env: NodeJS.ProcessEnv = {GEMINI_API_KEY: ''};
    for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
      if (process.env[key]) env[key] = process.env[key];
    }
    const child = fork(fileURLToPath(import.meta.url), ['--body-parser-child'], {
      env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let log = '';
    const capture = (data: Buffer) => {log = (log + data.toString()).slice(-16000);};
    child.stdout!.on('data', capture);
    child.stderr!.on('data', capture);
    try {
      const port = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('Parser child startup timed out')), 10000);
        const onExit = () => finish(new Error('Parser child exited before startup: ' + log));
        const onMessage = (message: any) => {
          if (Number.isInteger(message?.port) && message.port > 0 && message.port <= 65535) finish(undefined, message.port);
        };
        const finish = (error?: Error, value?: number) => {
          clearTimeout(timer); child.off('exit', onExit); child.off('message', onMessage); child.off('error', onError);
          error ? reject(error) : resolve(value!);
        };
        const onError = (error: Error) => finish(error);
        child.once('exit', onExit); child.once('error', onError); child.on('message', onMessage);
      });
      await run({child, port, log: () => log});
    } catch (error) {
      throw new Error(String(error) + (log ? '\nChild output: ' + log : ''));
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        await new Promise<void>(resolve => {
          const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
          child.once('exit', () => {clearTimeout(timer); resolve();});
          child.kill();
        });
      }
    }
  }
  async function request(f: Fixture, body?: Buffer, encoding?: string, splitTail?: Buffer) {
    return await new Promise<{status: number; body: any}>((resolve, reject) => {
      const onParsed = (message: any) => {if (message?.parsed === true) req.end(splitTail);};
      const cleanup = () => f.child.off('message', onParsed);
      const req = http.request({
        host: '127.0.0.1', port: f.port, path: body ? '/echo' : '/health',
        method: body ? 'POST' : 'GET', agent: false,
        headers: body ? {
          'Content-Type': 'application/json', 'Content-Length': body.length + (splitTail?.length || 0),
          ...(encoding ? {'Content-Encoding': encoding} : {}),
          ...(splitTail ? {'x-fixture-split': '1'} : {}),
        } : {},
      }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', data => {text += data;});
        res.once('error', error => {cleanup(); reject(error);});
        res.once('end', () => {
          cleanup();
          try {resolve({status: res.statusCode!, body: JSON.parse(text)});} catch (error) {reject(error);}
        });
      });
      req.setTimeout(5000, () => req.destroy(new Error('Parser request timed out')));
      req.once('error', error => {cleanup(); reject(error);});
      if (splitTail) {f.child.on('message', onParsed); req.write(body!);}
      else req.end(body);
    });
  }
  async function healthy(f: Fixture) {
    const reply = await request(f);
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body, {ok: true});
    assert.equal(f.child.exitCode, null);
    assert.equal(f.child.signalCode, null);
  }
  async function check(name: string, run: () => Promise<void>) {
    try {await run(); passed++; console.log('PASS ' + name);}
    catch (error) {failed++; console.error('FAIL ' + name + ': ' + String(error));}
  }
  for (const encoding of ['identity', 'gzip', 'deflate']) {
    await check('normal ' + encoding + ' JSON keeps its parsed value', () => fixture(async f => {
      const body = encoding === 'gzip' ? gzipSync(plain) : encoding === 'deflate' ? deflateSync(plain) : plain;
      const reply = await request(f, body, encoding);
      assert.equal(reply.status, 200);
      assert.deepEqual(reply.body, {fixture: 'synthetic', count: 1});
      await healthy(f);
    }));
  }
  await check('malformed compressed JSON returns 400 and leaves server available', () => fixture(async f => {
    const reply = await request(f, gzipSync(Buffer.from('{"fixture":')), 'gzip');
    assert.equal(reply.status, 400);
    assert.equal(reply.body.error, 'entity.parse.failed');
    await healthy(f);
  }));
  await check('invalid gzip reports a bounded error and leaves server available', () => fixture(async f => {
    const reply = await request(f, Buffer.from('not-a-compressed-frame'), 'gzip');
    assert.equal(reply.status, 400);
    await healthy(f);
  }));
  await check('gzip frame followed by bounded trailing bytes cannot crash the server', () => fixture(async f => {
    // Maintainer regression shape: valid frame, zero terminator, 100 KiB tail.
    // https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828
    const body = Buffer.concat([gzipSync(plain), Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)]);
    const reply = await request(f, body, 'gzip');
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body, {fixture: 'synthetic', count: 1});
    // Give a decoder's delayed error its own event-loop turn before probing.
    await new Promise(resolve => setTimeout(resolve, 200));
    await healthy(f);
  }));
  await check('deflate tail after parser completion drains and keeps the server available', () => fixture(async f => {
    const first = Buffer.concat([deflateSync(plain), Buffer.from([0])]);
    const reply = await request(f, first, 'deflate', Buffer.alloc(1024));
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body, {fixture: 'synthetic', count: 1});
    await healthy(f);
  }));
  console.log(JSON.stringify({suite: 'body-parser-security', passed, failed}));
  if (failed) process.exitCode = 1;
}
