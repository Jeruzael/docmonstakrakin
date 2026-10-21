import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import tls from 'node:tls';
import type {IncomingHttpHeaders} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {performance, monitorEventLoopDelay} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {randomBytes, createHash, X509Certificate} from 'node:crypto';
import {createAuthPilot, AUTH_PILOT_BOUNDS, type AuthPilot} from '../server/security/authPilot/index.ts';
import {startDisconnectedAuthPilot, parsePilotBody, AUTH_PILOT_ROUTES} from '../server/security/authPilot/transport.ts';
import {verifyAuditChain} from '../server/security/syntheticFoundations/audit.ts';
import {API_ROUTE_POLICIES} from '../server/security/apiRoutePolicy.ts';
const run = promisify(execFile), require = createRequire(import.meta.url);
let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) { await fn(); passed++; console.log('PASS ' + name); }
let time = Date.now();
const tick = () => { time += 60_001; };
const password = 'fixture-correct-horse-2026', replacement = 'fixture-replacement-horse-2026';
const previous = process.env.DMK_S2A_ENABLED; process.env.DMK_S2A_ENABLED = 'true';
await check('default factories remain inactive despite ambient enable text', async () => { assert.deepEqual(await createAuthPilot(), {enabled: false}); assert.deepEqual(await startDisconnectedAuthPilot(), {enabled: false}); });
if (previous === undefined) delete process.env.DMK_S2A_ENABLED; else process.env.DMK_S2A_ENABLED = previous;
await check('unsafe options and non-disconnected authority reject', async () => { await assert.rejects(createAuthPilot({enabled: true, mode: 'PRODUCTION'} as any)); await assert.rejects(createAuthPilot({enabled: false, clock: Date.now} as any)); });
const pilot = await createAuthPilot({enabled: true, mode: 'DISCONNECTED_SYNTHETIC', clock: () => time}) as AuthPilot;
let transport: Awaited<ReturnType<typeof startDisconnectedAuthPilot>> | undefined;
let tlsRoot: string | undefined;
const tlsOwner = randomBytes(32).toString('hex');
async function login(id = 'fixture-human', secret = password) { const result = await pilot.login({principalId: id, password: secret}); if (result.authenticated === false) throw Error('login failed'); return result; }
try {
  await check('versioned owned store uses WAL FULL foreign keys and exact native provenance', async () => { const info = await pilot.fixtures.provenance(); assert.equal(info.schemaVersion, 1); assert.equal(info.journalMode, 'wal'); assert.equal(info.synchronous, 2); assert.equal(info.foreignKeys, 1); assert.equal(info.packages.sqlite, '13.0.3'); assert.equal(info.sqliteVersion, '3.53.4'); assert.match(info.nativeSha256, /^[a-f0-9]{64}$/); });
  await check('only synthetic principals may be provisioned and passwords are bounded', async () => { await assert.rejects(pilot.fixtures.createHuman('operator', password)); await assert.rejects(pilot.fixtures.createHuman('fixture-short', 'short')); await assert.rejects(pilot.fixtures.createHuman('fixture-long', 'x'.repeat(1025))); await assert.rejects(pilot.fixtures.createHuman('fixture-surrogate', 'fixture-key-\ud800'), {message: 'AUTH_PILOT_PASSWORD_INVALID'}); await pilot.fixtures.createHuman('fixture-human', password); await pilot.fixtures.createAgent('fixture-agent'); });
  const resource = await pilot.fixtures.resource('fixture-project');
  await pilot.fixtures.rule('fixture-human', 'READ', resource, 'ALLOW');
  await pilot.fixtures.rule('fixture-human', 'HUMAN_APPROVE', resource, 'ALLOW');
  await check('HUMAN login issues opaque token and synchronizer proof', async () => { const auth = await login(); assert.match(auth.token, /^[A-Za-z0-9_-]{43}$/); assert.match(auth.csrf, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(auth.token, auth.csrf); assert.equal((await pilot.session(auth.token))?.principalId, 'fixture-human'); });
  await check('unknown identities wrong credentials AGENT and forged actor fail uniformly', async () => { for (const input of [{principalId: 'fixture-missing', password}, {principalId: 'fixture-human', password: 'wrong'}, {principalId: 'fixture-agent', password}, {principalId: 'fixture-human', password, kind: 'HUMAN', role: 'Security Officer'}]) assert.deepEqual(await pilot.login(input), {authenticated: false, limited: false}); });
  await check('hostile password types arrays prototype and excess fields reject before authority', async () => { for (const input of [null, [], {principalId: 'fixture-human', password: {}}, {principalId: 'fixture-human', password: 'x'.repeat(1025)}, Object.assign(Object.create({role: 'HUMAN'}), {principalId: 'fixture-human', password})]) assert.equal((await pilot.login(input)).authenticated, false); });
  tick();
  await check('server-owned handles reject forged resources and unregistered actions', async () => { const auth = await login(); assert.equal((await pilot.authorize(auth.token, 'READ', resource)).allowed, true); assert.equal((await pilot.authorize(auth.token, 'WRITE', resource)).allowed, false); assert.equal((await pilot.authorize(auth.token, 'HUMAN_APPROVE', resource)).allowed, true); assert.equal((await pilot.authorize(auth.token, 'READ', {kind: 'DISCONNECTED_RESOURCE'})).allowed, false); assert.equal((await pilot.authorize(auth.token, '__proto__' as any, resource)).allowed, false); });
  await check('policy changes fence existing sessions and explicit denial wins', async () => { const auth = await login(); await pilot.fixtures.rule('fixture-human', 'READ', resource, 'DENY'); assert.equal(await pilot.session(auth.token), null); const next = await login(); assert.equal((await pilot.authorize(next.token, 'READ', resource)).reason, 'EXPLICIT_DENY'); });
  tick();
  await check('CSRF is token-bound and rotation consumes old session exactly once', async () => { const auth = await login(); assert.equal(await pilot.rotate(auth.token, 'x'.repeat(43)), null); const outcomes = await Promise.all([pilot.rotate(auth.token, auth.csrf), pilot.rotate(auth.token, auth.csrf)]); assert.equal(outcomes.filter(Boolean).length, 1); const rotated = outcomes.find(Boolean)!; assert.equal(await pilot.session(auth.token), null); assert.equal(pilot.verifyCsrf(rotated.token, auth.csrf), false); assert.ok(await pilot.session(rotated.token)); assert.equal(await pilot.logout(rotated.token, rotated.csrf), true); assert.equal(await pilot.session(rotated.token), null); });
  tick();
  await check('password change requires current secret and atomically revokes sibling sessions', async () => { const a = await login(), b = await login(); assert.equal(await pilot.changePassword(a.token, a.csrf, 'wrong', replacement), false); assert.equal(await pilot.changePassword(a.token, 'x'.repeat(43), password, replacement), false); assert.equal(await pilot.changePassword(a.token, a.csrf, password, replacement), true); assert.equal(await pilot.session(a.token), null); assert.equal(await pilot.session(b.token), null); assert.equal((await pilot.login({principalId: 'fixture-human', password})).authenticated, false); tick(); await login('fixture-human', replacement); });
  tick();
  await check('offline synthetic reset fences all previous credentials and sessions', async () => { const auth = await login('fixture-human', replacement); await pilot.fixtures.reset('fixture-human', password); assert.equal(await pilot.session(auth.token), null); assert.equal((await pilot.login({principalId: 'fixture-human', password: replacement})).authenticated, false); await login(); });
  tick();
  await check('concurrent credential changes accept exactly one revision-guarded mutation', async () => {
    await pilot.fixtures.createHuman('fixture-password-race', password); const auth = await login('fixture-password-race');
    const results = await Promise.all([pilot.changePassword(auth.token, auth.csrf, password, replacement), pilot.changePassword(auth.token, auth.csrf, password, replacement)]);
    assert.equal(results.filter(Boolean).length, 1); assert.equal(await pilot.session(auth.token), null);
    const audit = await pilot.fixtures.audit(); assert.equal(audit.filter(event => event.action === 'CREDENTIAL_CHANGED' && event.target === 'fixture-password-race').length, 1);
  });
  tick();
  await check('worker crash recovery retains principals audit and schema while fencing sessions', async () => { const auth = await login(); const before = await pilot.fixtures.snapshot(); await pilot.fixtures.terminate(); assert.equal(await pilot.session(auth.token), null); await pilot.fixtures.restart(); const after = await pilot.fixtures.snapshot(); assert.equal(after.generation, before.generation + 1); assert.equal(after.counts.principals, before.counts.principals); assert.equal(await pilot.session(auth.token), null); await login(); });
  await check('unsupported schema rejects recovery without automatic migration or downgrade', async () => {
    await pilot.fixtures.terminate(); const Database = require('better-sqlite3');
    const filename = path.join(pilot.fixtures.rootDirectory, 'authority.sqlite');
    let db = new Database(filename); db.pragma('user_version=99'); db.close();
    await assert.rejects(pilot.fixtures.restart(), {code: 'STORE_SCHEMA_UNSUPPORTED'});
    assert.equal((await pilot.login({principalId: 'fixture-human', password})).authenticated, false);
    db = new Database(filename); assert.equal(db.pragma('user_version', {simple: true}), 99); db.pragma('user_version=1'); db.close();
    // Test-owned offline fixture repair only, never an operational migration.
    await pilot.fixtures.restart(); assert.equal((await pilot.fixtures.provenance()).schemaVersion, 1);
  });
  tick();
  await check('credential disable cannot be bypassed by old token or password', async () => { await pilot.fixtures.createHuman('fixture-disabled', password); const auth = await login('fixture-disabled'); await pilot.fixtures.disable('fixture-disabled'); assert.equal(await pilot.session(auth.token), null); assert.equal((await pilot.login({principalId: 'fixture-disabled', password})).authenticated, false); await assert.rejects(pilot.fixtures.reset('fixture-disabled', replacement)); });
  tick();
  await check('per-principal throttling includes valid and unknown accounts and survives worker restart', async () => { for (let index = 0; index < AUTH_PILOT_BOUNDS.principalAttempts; index++) assert.deepEqual(await pilot.login({principalId: 'fixture-rate', password: 'wrong'}), {authenticated: false, limited: false}); await pilot.fixtures.restart(); assert.deepEqual(await pilot.login({principalId: 'fixture-rate', password: 'wrong'}), {authenticated: false, limited: true}); });
  tick();
  await check('global loopback throttle rejects distinct-account flooding without growing unbounded state', async () => { for (let i = 0; i < AUTH_PILOT_BOUNDS.globalAttempts; i++) assert.equal((await pilot.login({principalId: 'fixture-flood-' + i, password: 'wrong'})).authenticated, false); assert.deepEqual(await pilot.login({principalId: 'fixture-human', password}), {authenticated: false, limited: true}); });
  tick();
  await check('concurrent login work is bounded and eventually releases capacity', async () => { const results = await Promise.all(Array.from({length: 12}, (_, i) => pilot.login({principalId: 'fixture-concurrent-' + i, password: 'wrong'}))); assert.equal(results.every(result => !result.authenticated), true); tick(); await login(); });
  tick();
  const Database = require('better-sqlite3');
  await check('audit-write failure rolls back session creation and reveals no token', async () => { const db = new Database(path.join(pilot.fixtures.rootDirectory, 'authority.sqlite')); try { db.exec("CREATE TRIGGER fixture_reject_auth_audit BEFORE INSERT ON audit WHEN json_extract(NEW.payload,'$.action')='SESSION_ISSUED' BEGIN SELECT RAISE(ABORT,'injected'); END"); const before = await pilot.fixtures.snapshot(); assert.equal((await pilot.login({principalId: 'fixture-human', password})).authenticated, false); const after = await pilot.fixtures.snapshot(); assert.equal(after.domainStateHash, before.domainStateHash); } finally { db.exec('DROP TRIGGER fixture_reject_auth_audit'); db.close(); } });
  tick();
  await check('credential audit failure atomically retains old verifier revision and sessions', async () => {
    const auth = await login(); const db = new Database(path.join(pilot.fixtures.rootDirectory, 'authority.sqlite'));
    const revision = (await pilot.session(auth.token))!.credentialRevision;
    try {
      db.exec("CREATE TRIGGER fixture_reject_change_audit BEFORE INSERT ON audit WHEN json_extract(NEW.payload,'$.action')='CREDENTIAL_CHANGED' BEGIN SELECT RAISE(ABORT,'injected'); END");
      assert.equal(await pilot.changePassword(auth.token, auth.csrf, password, replacement), false);
      assert.ok(await pilot.session(auth.token)); assert.equal((await pilot.session(auth.token))?.credentialRevision, revision);
    } finally { db.exec('DROP TRIGGER fixture_reject_change_audit'); db.close(); }
  });
  tick();
  await check('hostile stored PHC cannot amplify native KDF parameters', async () => { const db = new Database(path.join(pilot.fixtures.rootDirectory, 'authority.sqlite')); const row = db.prepare('SELECT verifier FROM principals WHERE id=?').get('fixture-human'); try { db.prepare('UPDATE principals SET verifier=? WHERE id=?').run('$argon2id$v=19$m=999999999,p=1,t=3$bad$bad', 'fixture-human'); assert.equal((await pilot.login({principalId: 'fixture-human', password})).authenticated, false); } finally { db.prepare('UPDATE principals SET verifier=? WHERE id=?').run(row.verifier, 'fixture-human'); db.close(); } });
  tick();
  await check('idle and absolute expiration are inclusive and clock rollback cannot revive', async () => { const auth = await login(); time += 600_000; assert.equal(await pilot.session(auth.token), null); time--; assert.equal(await pilot.session(auth.token), null); time += 2; const next = await login(); for (let i = 0; i < 5; i++) { time += 300_000; assert.ok(await pilot.session(next.token)); } time += 300_000; assert.equal(await pilot.session(next.token), null); });
  await check('strict flat JSON rejects duplicate escaped keys prototype nesting and malformed UTF8', () => { assert.deepEqual(parsePilotBody(Buffer.from('{"principalId":"fixture-human","password":"ok"}'), ['principalId', 'password']), {principalId: 'fixture-human', password: 'ok'}); for (const raw of ['{"principalId":"a","principalId":"b","password":"x"}', '{"principalId":"a","\\u0070rincipalId":"b","password":"x"}', '{"__proto__":"x","password":"x"}', '{"principalId":{},"password":"x"}', '{"principalId":"a","password":"x"} trailing', '{"principalId":"a","password":"\\ud800"}']) assert.throws(() => parsePilotBody(Buffer.from(raw), ['principalId', 'password'])); assert.throws(() => parsePilotBody(Buffer.from([0xff]), [])); });
  tlsRoot = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'dmk-auth-tls-'));
  await fs.writeFile(path.join(tlsRoot, '.test-owner'), tlsOwner, {flag: 'wx', mode: 0o600});
  const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  await run(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tlsRoot, 'key.pem'), '-out', path.join(tlsRoot, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], {windowsHide: true, timeout: 10_000});
  const cert = await fs.readFile(path.join(tlsRoot, 'cert.pem'));
  transport = await startDisconnectedAuthPilot({enabled: true, pilot, key: await fs.readFile(path.join(tlsRoot, 'key.pem')), cert});
  assert.equal(transport.enabled, true); if (!transport.enabled) throw Error('pilot disabled');
  const origin = transport.origin;
  async function request(route: string, options: {method?: string; body?: string; headers?: Record<string, string | string[]>} = {}) {
    const payload = options.body;
    return new Promise<{status: number; headers: IncomingHttpHeaders; json: any; text: string}>((resolve, reject) => {
      const req = https.request(origin + route, {method: options.method ?? 'GET', ca: cert, checkServerIdentity: (_hostname, peer) => tls.checkServerIdentity('127.0.0.1', peer), headers: {Origin: origin, 'X-DMK-Pilot': '1', ...(payload !== undefined ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload)} : {}), ...options.headers}, timeout: 5000}, res => { let text = ''; res.on('data', chunk => { text += chunk; }); res.on('end', () => { try { resolve({status: res.statusCode!, headers: res.headers, json: JSON.parse(text), text}); } catch (error) { reject(error); } }); });
      req.on('error', reject); req.on('timeout', () => req.destroy(Error('request timeout'))); if (payload !== undefined) req.write(payload); req.end();
    });
  }
  async function rawStatus(extra: string[]) {
    return new Promise<number>((resolve, reject) => {
      const socket = tls.connect({host: '127.0.0.1', port: Number(new URL(origin).port), ca: cert, checkServerIdentity: (_hostname, peer) => tls.checkServerIdentity('127.0.0.1', peer)}, () => {
        socket.write(['GET /pilot/auth/session HTTP/1.1', 'Host: ' + new URL(origin).host, 'Origin: ' + origin, 'X-DMK-Pilot: 1', 'Connection: close', ...extra, '', ''].join('\r\n'));
      });
      let received = '';
      socket.setTimeout(5000, () => socket.destroy(Error('raw request timeout')));
      socket.on('error', reject); socket.on('data', bytes => { received += bytes.toString(); });
      socket.on('end', () => { const match = /^HTTP\/1\.1 (\d{3})/.exec(received); if (!match) reject(Error('invalid raw response')); else resolve(Number(match[1])); });
    });
  }
  tick();
  let cookie = '', proof = '';
  await check('actual trusted-fixture HTTPS login uses secure host-only HttpOnly Strict cookie', async () => { const response = await request('/pilot/auth/login', {method: 'POST', body: JSON.stringify({principalId: 'fixture-human', password})}); assert.equal(response.status, 200); const set = response.headers['set-cookie']![0]; assert.match(set, /^__Host-dmk-pilot=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800$/); assert.doesNotMatch(set, /Domain=/); cookie = set.split(';')[0]; proof = response.json.csrf; assert.equal(response.json.token, undefined); assert.equal(response.headers['cache-control'], 'no-store'); assert.equal(response.headers['access-control-allow-origin'], undefined); assert.equal(response.headers['x-powered-by'], undefined); });
  await check('actual session endpoint returns only sanitized HUMAN identity and proof', async () => { const response = await request('/pilot/auth/session', {headers: {Cookie: cookie}}); assert.equal(response.status, 200); assert.equal(response.json.principalId, 'fixture-human'); assert.equal(response.json.kind, 'HUMAN'); assert.deepEqual(Object.keys(response.json).sort(), ['authenticated', 'csrf', 'kind', 'principalId']); });
  await check('same-origin POST session provides browser-compatible self-inspection without relaxing Origin', async () => {
    const response = await request('/pilot/auth/session', {method: 'POST', body: '{}', headers: {Cookie: cookie}});
    assert.equal(response.status, 200); assert.equal(response.json.kind, 'HUMAN');
    assert.equal((await request('/pilot/auth/session', {method: 'POST', body: '{}', headers: {Cookie: cookie, Origin: ''}})).status, 403);
    assert.equal((await request('/pilot/auth/session', {method: 'POST', body: '{"role":"HUMAN"}', headers: {Cookie: cookie}})).status, 400);
  });
  await check('actual Host Origin proxy and fetch-site mismatch fail closed', async () => { for (const headers of [{Host: 'evil.invalid'}, {Origin: 'https://evil.invalid'}, {Origin: 'null'}, {'X-DMK-Pilot': ''}, {'X-Forwarded-Host': '127.0.0.1'}, {'X-Forwarded-Proto': 'https'}, {'Sec-Fetch-Site': 'cross-site'}]) assert.equal((await request('/pilot/auth/session', {headers: {...headers, Cookie: cookie}})).status, 403); });
  await check('actual duplicated Cookie Origin Host and query secrets reject', async () => { for (const extra of [['Cookie: ' + cookie, 'Cookie: ' + cookie], ['Origin: ' + origin], ['Host: ' + new URL(origin).host]]) assert.equal(await rawStatus(extra), 403); assert.equal((await request('/pilot/auth/session?token=fixture')).status, 403); });
  await check('actual header-count admission rejects excess headers before authority', async () => { assert.equal(await rawStatus(Array.from({length: 33}, (_, i) => 'X-Fixture-' + i + ': inert')), 403); });
  await check('actual JSON body duplicate keys oversized nested and wrong media type reject', async () => { for (const body of ['{"principalId":"fixture-human","principalId":"fixture-agent","password":"x"}', '{"principalId":{},"password":"x"}', JSON.stringify({principalId: 'fixture-human', password: 'x'.repeat(9000)})]) assert.equal((await request('/pilot/auth/login', {method: 'POST', body})).status, 400); assert.equal((await request('/pilot/auth/login', {method: 'POST', body: '{}', headers: {'Content-Type': 'text/plain'}})).status, 400); });
  await check('actual session cookie duplication and forged CSRF cannot rotate or logout', async () => { assert.equal((await request('/pilot/auth/session', {headers: {Cookie: cookie + '; ' + cookie}})).status, 401); for (const route of ['/pilot/auth/rotate', '/pilot/auth/logout']) assert.equal((await request(route, {method: 'POST', body: '{}', headers: {Cookie: cookie, 'X-CSRF-Token': 'x'.repeat(43)}})).status, 401); });
  await check('actual rotation invalidates old cookie and logout clears replacement cookie', async () => { const rotated = await request('/pilot/auth/rotate', {method: 'POST', body: '{}', headers: {Cookie: cookie, 'X-CSRF-Token': proof}}); assert.equal(rotated.status, 200); assert.equal((await request('/pilot/auth/session', {headers: {Cookie: cookie}})).status, 401); cookie = rotated.headers['set-cookie']![0].split(';')[0]; proof = rotated.json.csrf; const logout = await request('/pilot/auth/logout', {method: 'POST', body: '{}', headers: {Cookie: cookie, 'X-CSRF-Token': proof}}); assert.equal(logout.status, 200); assert.match(logout.headers['set-cookie']![0], /Max-Age=0/); assert.equal((await request('/pilot/auth/session', {headers: {Cookie: cookie}})).status, 401); });
  tick();
  await check('actual password endpoint verifies secret and revokes current cookie', async () => { const auth = await request('/pilot/auth/login', {method: 'POST', body: JSON.stringify({principalId: 'fixture-human', password})}); const authCookie = auth.headers['set-cookie']![0].split(';')[0]; const changed = await request('/pilot/auth/password', {method: 'POST', body: JSON.stringify({current: password, replacement}), headers: {Cookie: authCookie, 'X-CSRF-Token': auth.json.csrf}}); assert.equal(changed.status, 200); assert.equal((await request('/pilot/auth/session', {headers: {Cookie: authCookie}})).status, 401); await pilot.fixtures.reset('fixture-human', password); });
  await check('actual pilot exposes no enrollment grant agent production or privileged routes', async () => { assert.equal(AUTH_PILOT_ROUTES.length, 6); for (const route of ['/api/projects', '/api/agents/execute', '/pilot/auth/enroll', '/pilot/auth/grants']) assert.equal((await request(route, {method: 'POST', body: '{}'})).status, 404); });
  tick();
  await check('actual browser supplies Origin uses secure HttpOnly cookie rejects CSRF and logs out', async () => {
    const {chromium} = await import('playwright');
    const spki = new X509Certificate(cert).publicKey.export({type: 'spki', format: 'der'});
    const pin = createHash('sha256').update(spki).digest('base64');
    // Narrow per-process exception for this ephemeral fixture key only. Node's
    // independent HTTPS tests above still verify certificate chain and IP SAN.
    let executable: string | undefined;
    for (const candidate of [process.env.DMK_TEST_BROWSER, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
      try { await fs.access(candidate!); executable = candidate; break; } catch { /* try the next already installed binary */ }
    }
    const browser = await chromium.launch({headless: true, ...(executable ? {executablePath: executable} : {}), args: ['--ignore-certificate-errors-spki-list=' + pin]});
    try {
      const context = await browser.newContext({ignoreHTTPSErrors: false});
      // Only the empty test document is fulfilled. Every authentication call
      // goes through the actual HTTPS Express entrypoint, without interception.
      await context.route(origin + '/fixture', route => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>Synthetic authentication fixture</title>'}));
      await context.route('https://fixture.invalid/page', route => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>Cross-origin synthetic fixture</title>'}));
      const page = await context.newPage();
      const origins: Promise<string>[] = [];
      page.on('request', req => { if (req.url() === origin + '/pilot/auth/login') origins.push(req.allHeaders().then(headers => headers.origin)); });
      await page.goto(origin + '/fixture');
      const authenticated = await page.evaluate(async password => {
        const response = await fetch('/pilot/auth/login', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-DMK-Pilot': '1'}, body: JSON.stringify({principalId: 'fixture-human', password})});
        return {status: response.status, data: await response.json()};
      }, password);
      assert.equal(authenticated.status, 200); assert.ok((await Promise.all(origins)).includes(origin));
      const stored = (await context.cookies()).find(value => value.name === '__Host-dmk-pilot');
      assert.ok(stored); assert.equal(stored.secure, true); assert.equal(stored.httpOnly, true); assert.equal(stored.sameSite, 'Strict');
      assert.equal(await page.evaluate(() => document.cookie.includes('__Host-dmk-pilot')), false);
      const inspect = await page.evaluate(async () => {
        const post = await fetch('/pilot/auth/session', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-DMK-Pilot': '1'}, body: '{}'});
        const get = await fetch('/pilot/auth/session', {headers: {'X-DMK-Pilot': '1'}});
        return {post: post.status, get: get.status, data: await post.json()};
      });
      assert.equal(inspect.post, 200); assert.equal(inspect.get, 403); assert.equal(inspect.data.kind, 'HUMAN');
      assert.equal(await page.evaluate(async () => (await fetch('/pilot/auth/rotate', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-DMK-Pilot': '1', 'X-CSRF-Token': 'x'.repeat(43)}, body: '{}'})).status), 401);
      const beforeDenied = await pilot.fixtures.snapshot();
      await page.goto('https://fixture.invalid/page');
      const crossSiteDenied = await page.evaluate(async origin => {
        try { await fetch(origin + '/pilot/auth/logout', {method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json', 'X-DMK-Pilot': '1', 'X-CSRF-Token': 'x'.repeat(43)}, body: '{}'}); return false; }
        catch { return true; }
      }, origin);
      assert.equal(crossSiteDenied, true); assert.equal((await pilot.fixtures.snapshot()).domainStateHash, beforeDenied.domainStateHash);
      await page.goto(origin + '/fixture');
      const logoutStatus = await page.evaluate(async proof => (await fetch('/pilot/auth/logout', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-DMK-Pilot': '1', 'X-CSRF-Token': proof}, body: '{}'})).status, authenticated.data.csrf);
      assert.equal(logoutStatus, 200); assert.equal((await context.cookies()).filter(value => value.name === '__Host-dmk-pilot').length, 0);
      assert.equal(await page.evaluate(async () => (await fetch('/pilot/auth/session', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-DMK-Pilot': '1'}, body: '{}'})).status), 401);
      console.log('AUTH_PILOT_BROWSER ' + JSON.stringify({browser: browser.version(), trust: 'ephemeral exact-SPKI process pin only; no host trust installation', ignoreHTTPSErrors: false, productionBrowserTrustAccepted: false}));
    } finally { await browser.close(); }
  });
  tick();
  const measurements: number[] = [];
  const rssBefore = process.memoryUsage().rss, cpuBefore = process.cpuUsage();
  await check('native login measurements use fixed reproducible single-concurrency profile', async () => {
    const delay = monitorEventLoopDelay({resolution: 10}); delay.enable(); let sampledPeakRss = rssBefore;
    const sampler = setInterval(() => { sampledPeakRss = Math.max(sampledPeakRss, process.memoryUsage().rss); }, 10);
    try { for (let i = 0; i < 7; i++) { tick(); const start = performance.now(); await login(); measurements.push(performance.now() - start); } }
    finally { clearInterval(sampler); delay.disable(); }
    const sorted = [...measurements].sort((a, b) => a - b), cpu = process.cpuUsage(cpuBefore);
    console.log('AUTH_PILOT_MEASUREMENT ' + JSON.stringify({node: process.version, platform: process.platform, arch: process.arch, profile: '7 sequential real Argon2id logins; fresh per-window admission; fixture SQLite WAL FULL', inputPasswordBytes: Buffer.byteLength(password), runs: measurements.length, p50Ms: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], minMs: sorted[0], maxMs: sorted.at(-1), rssBefore, rssAfter: process.memoryUsage().rss, sampledPeakRss, maxRssKiB: process.resourceUsage().maxRSS, heapUsed: process.memoryUsage().heapUsed, eventLoopP95Ms: delay.percentile(95) / 1e6, eventLoopMaxMs: delay.max / 1e6, cpuUserUs: cpu.user, cpuSystemUs: cpu.system, productionCapacityAccepted: false}));
  });
  await check('audits retain checked hash integrity without credentials PHC tokens or raw secrets', async () => { const audit = await pilot.fixtures.audit(); assert.equal(verifyAuditChain(audit), true); assert.ok(audit.some(event => event.action === 'AUTHENTICATION_FAILED')); assert.ok(audit.some(event => event.action === 'CREDENTIAL_CHANGED')); const serialized = JSON.stringify(audit); assert.equal(serialized.includes(password), false); assert.equal(serialized.includes(replacement), false); assert.equal(serialized.includes('$argon2'), false); assert.equal(serialized.includes(cookie.split('=')[1]), false); });
  await check('normal product entrypoints never import the disconnected authentication pilot', async () => { for (const entry of ['server.ts', 'src/App.tsx']) assert.doesNotMatch(await fs.readFile(entry, 'utf8'), /authPilot|startDisconnectedAuthPilot/); });
  await check('cutover inventory retains 69 product registrations and 14 blocked privileged registrations', () => {
    assert.equal(API_ROUTE_POLICIES.length, 69);
    assert.equal(API_ROUTE_POLICIES.filter(route => route.access.startsWith('BLOCKED_')).length, 14);
    assert.equal(API_ROUTE_POLICIES.filter(route => route.access === 'LEGACY_LOCAL_UNSCOPED').length, 45);
    assert.equal(API_ROUTE_POLICIES.filter(route => route.access === 'SPECIALIZED_REVIEWER').length, 7);
    assert.equal(API_ROUTE_POLICIES.filter(route => route.access === 'REVIEWER_SESSION').length, 3);
  });
} finally {
  if (transport?.enabled) await transport.close();
  await pilot.close();
  if (tlsRoot) {
    assert.equal((await fs.lstat(tlsRoot)).isSymbolicLink(), false);
    const resolved = await fs.realpath(tlsRoot); assert.equal(resolved, tlsRoot);
    assert.equal(path.dirname(resolved), await fs.realpath(os.tmpdir())); assert.match(path.basename(resolved), /^dmk-auth-tls-[A-Za-z0-9]+$/);
    const marker = path.join(resolved, '.test-owner'); assert.equal((await fs.lstat(marker)).isSymbolicLink(), false);
    assert.equal(await fs.readFile(marker, 'utf8'), tlsOwner); await fs.rm(resolved, {recursive: true});
  }
}
await check('close removes task-owned authority store and bars subsequent authentication', async () => { await assert.rejects(fs.stat(pilot.fixtures.rootDirectory), {code: 'ENOENT'}); assert.equal((await pilot.login({principalId: 'fixture-human', password})).authenticated, false); });
console.log(`Authentication pilot: ${passed} checks passed; disconnected synthetic qualification only`);
