import express from 'express';
import https from 'node:https';
import type {AddressInfo} from 'node:net';
import type {TLSSocket} from 'node:tls';
import type {AuthPilot} from './index.ts';

const COOKIE = '__Host-dmk-pilot';
export const AUTH_PILOT_ROUTES = Object.freeze([
  ['POST', '/pilot/auth/login'], ['GET', '/pilot/auth/session'], ['POST', '/pilot/auth/session'], ['POST', '/pilot/auth/rotate'], ['POST', '/pilot/auth/logout'], ['POST', '/pilot/auth/password'],
]);

/** Flat JSON string records only: reject duplicate keys, nesting, prototype fields and trailing tokens. */
export function parsePilotBody(raw: unknown, keys: readonly string[]): Record<string, string> {
  if (!Buffer.isBuffer(raw) || raw.byteLength > 8192) throw Error('PILOT_INPUT_INVALID');
  const text = raw.toString('utf8');
  if (!Buffer.from(text).equals(raw)) throw Error('PILOT_INPUT_INVALID');
  let offset = 0;
  const ws = () => { while (offset < text.length && /[ \t\r\n]/.test(text[offset])) offset++; };
  const string = () => {
    ws(); const start = offset;
    if (text[offset++] !== '"') throw Error('PILOT_INPUT_INVALID');
    for (;;) {
      if (offset >= text.length) throw Error('PILOT_INPUT_INVALID');
      const char = text[offset++];
      if (char === '\\') { if (offset >= text.length) throw Error('PILOT_INPUT_INVALID'); offset++; }
      else if (char === '"') break;
    }
    const value = JSON.parse(text.slice(start, offset));
    if (typeof value !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw Error('PILOT_INPUT_INVALID');
    return value;
  };
  const value: Record<string, string> = Object.create(null);
  ws(); if (text[offset++] !== '{') throw Error('PILOT_INPUT_INVALID');
  ws();
  if (text[offset] !== '}') for (;;) {
    const key = string(); if (!keys.includes(key) || Object.hasOwn(value, key)) throw Error('PILOT_INPUT_INVALID');
    ws(); if (text[offset++] !== ':') throw Error('PILOT_INPUT_INVALID');
    value[key] = string(); ws();
    if (text[offset] !== ',') break;
    offset++;
  }
  if (text[offset++] !== '}') throw Error('PILOT_INPUT_INVALID');
  ws(); if (offset !== text.length || Object.keys(value).length !== keys.length) throw Error('PILOT_INPUT_INVALID');
  return {...value};
}
function tokenFromCookie(cookie: unknown): string | null {
  if (typeof cookie !== 'string' || cookie.length > 2048) return null;
  const matches = cookie.split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  if (matches.length !== 1 || !new RegExp('^' + COOKIE + '=[A-Za-z0-9_-]{43}$').test(matches[0])) return null;
  return matches[0].slice(COOKIE.length + 1);
}
function singleHeaders(raw: string[], names: string[]) {
  return names.every(name => raw.filter((_, index) => index % 2 === 0 && raw[index].toLowerCase() === name).length <= 1);
}
function setCookie(res: express.Response, token = '') {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${token ? 1800 : 0}`);
}

/** No listener is created by default. Explicit callers get a dedicated loopback-only HTTPS server. */
export async function startDisconnectedAuthPilot(options: {enabled?: false} | {enabled: true; pilot: AuthPilot; key: Buffer; cert: Buffer} = {}) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype || Object.keys(options).some(key => !['enabled', 'pilot', 'key', 'cert'].includes(key))) throw Error('PILOT_TRANSPORT_INVALID');
  if (options.enabled !== true) {
    if (Object.keys(options).some(key => key !== 'enabled') || options.enabled !== undefined && options.enabled !== false) throw Error('PILOT_TRANSPORT_INVALID');
    return {enabled: false as const};
  }
  if (options.pilot?.enabled !== true || !Buffer.isBuffer(options.key) || !Buffer.isBuffer(options.cert) || options.key.length > 16384 || options.cert.length > 16384) throw Error('PILOT_TRANSPORT_INVALID');
  const pilot = options.pilot;
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', false);
  let origin = '';
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    const socket = req.socket as TLSSocket;
    if (!socket.encrypted || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(socket.remoteAddress ?? '') || req.rawHeaders.length > 64 || !singleHeaders(req.rawHeaders, ['host', 'origin', 'cookie', 'x-dmk-pilot', 'x-csrf-token', 'content-type', 'content-length']) || req.headers.host !== origin.slice(8) || req.headers.origin !== origin || req.headers['x-dmk-pilot'] !== '1' || req.headers['sec-fetch-site'] !== undefined && req.headers['sec-fetch-site'] !== 'same-origin' || req.headers.forwarded !== undefined || req.headers['x-forwarded-host'] !== undefined || req.headers['x-forwarded-proto'] !== undefined || req.originalUrl.includes('?')) {
      res.status(403).json({error: 'PILOT_REQUEST_DENIED'}); return;
    }
    next();
  });
  app.use(express.raw({type: () => true, limit: 8192, inflate: false}));
  const body = (req: express.Request, keys: string[]) => {
    if (req.headers['content-type'] !== 'application/json') throw Error('PILOT_INPUT_INVALID');
    return parsePilotBody(req.body, keys);
  };
  app.post('/pilot/auth/login', (req, res, next) => { void (async () => {
    const result = await pilot.login(body(req, ['principalId', 'password']));
    if (result.authenticated === false) { res.status(result.limited ? 429 : 401).json({error: 'AUTHENTICATION_REJECTED'}); return; }
    setCookie(res, result.token); res.json({authenticated: true, csrf: result.csrf});
  })().catch(next); });
  const inspectSession: express.RequestHandler = (req, res, next) => { void (async () => {
    if (req.method === 'POST') body(req, []);
    else if (Buffer.isBuffer(req.body) && req.body.length) { res.status(400).json({error: 'PILOT_INPUT_INVALID'}); return; }
    const token = tokenFromCookie(req.headers.cookie), session = await pilot.session(token);
    if (!session) { res.status(401).json({error: 'AUTHENTICATION_REJECTED'}); return; }
    res.json({authenticated: true, principalId: session.principalId, kind: session.kind, csrf: pilot.csrf(token)});
  })().catch(next); };
  app.get('/pilot/auth/session', inspectSession);
  // Browsers may omit Origin on same-origin GET. A POST self-inspection path
  // permits browser-generated Origin without weakening this mandatory guard.
  app.post('/pilot/auth/session', inspectSession);
  app.post('/pilot/auth/rotate', (req, res, next) => { void (async () => {
    body(req, []);
    const rotated = await pilot.rotate(tokenFromCookie(req.headers.cookie), req.headers['x-csrf-token']);
    if (!rotated) { res.status(401).json({error: 'AUTHENTICATION_REJECTED'}); return; }
    setCookie(res, rotated.token); res.json({authenticated: true, csrf: rotated.csrf});
  })().catch(next); });
  app.post('/pilot/auth/logout', (req, res, next) => { void (async () => {
    body(req, []);
    if (!await pilot.logout(tokenFromCookie(req.headers.cookie), req.headers['x-csrf-token'])) { res.status(401).json({error: 'AUTHENTICATION_REJECTED'}); return; }
    setCookie(res); res.json({authenticated: false});
  })().catch(next); });
  app.post('/pilot/auth/password', (req, res, next) => { void (async () => {
    const input = body(req, ['current', 'replacement']);
    if (!await pilot.changePassword(tokenFromCookie(req.headers.cookie), req.headers['x-csrf-token'], input.current, input.replacement)) { res.status(401).json({error: 'AUTHENTICATION_REJECTED'}); return; }
    setCookie(res); res.json({authenticated: false});
  })().catch(next); });
  app.use((_req, res) => { res.status(404).json({error: 'PILOT_ROUTE_UNKNOWN'}); });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({error: 'PILOT_INPUT_INVALID'}); });
  const server = https.createServer({key: options.key, cert: options.cert, minVersion: 'TLSv1.2', maxHeaderSize: 8192, handshakeTimeout: 5000}, app);
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.timeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 32; server.maxRequestsPerSocket = 64; server.maxConnections = 16;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  origin = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {enabled: true as const, origin, async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }};
}
