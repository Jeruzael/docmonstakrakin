import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import type {Server} from 'node:http';
import express from 'express';
import {installReviewerIdentity} from '../server/proposals/identity';

// Isolated Express routes only: no application store, native modules or operator roster.
const original = process.env.DMK_HUMAN_REVIEWERS;
const salt = '0123456789abcdef0123456789abcdef';
const password = 'synthetic-test-password';
const verifier = `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
const human = (id: string, roles: string[]) => ({id, roles, kind: 'HUMAN', credentialVerifier: verifier});
const security = 'Security Officer', architect = 'Lead Architect';
let passed = 0;

async function fixture(raw: string | undefined, run: (base: string) => Promise<void>) {
  if (raw === undefined) delete process.env.DMK_HUMAN_REVIEWERS;
  else process.env.DMK_HUMAN_REVIEWERS = raw;
  const app = express();
  app.use(express.json());
  const context = installReviewerIdentity(app);
  app.get('/protected', (req, res) => {if (context.requireHuman(req, res)) res.json({authorized: true});});
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    await run(`http://127.0.0.1:${address.port}`);
  } finally {await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));}
}

async function setup(raw: string | undefined, expected: unknown, verification?: unknown) {
  await fixture(raw, async base => {
    const response = await fetch(`${base}/api/governance/session`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), null);
    const body = await response.json();
    assert.equal(body.identity, null);
    const {verification: actualVerification, ...summary} = body.setup;
    assert.deepEqual(summary, expected);
    assert.deepEqual(Object.keys(body.setup).sort(), ['distinctHumanRoleCoverage', 'missingRoles', 'state', 'verification']);
    if (verification) assert.deepEqual(actualVerification, verification);
    assert.deepEqual(Object.keys(body).sort(), ['identity', 'setup']);
    assert.doesNotMatch(JSON.stringify(body), /synthetic-|person-[abc]|credentialVerifier|0123456789|LOCAL_SERVER_ROSTER/);
  });
  passed++;
}

try {
  const missing = {state: 'not-configured', missingRoles: [security, architect], distinctHumanRoleCoverage: false};
  for (const raw of [undefined, '', '   ', '{}']) await setup(raw, missing);
  for (const raw of ['{invalid', 'null', '[]', '123', JSON.stringify({'synthetic-user': null}),
    JSON.stringify({'synthetic-user': human('', [security])}),
    JSON.stringify({'synthetic-user': {...human('synthetic-a', [security]), roles: [7]}}),
    JSON.stringify({'synthetic-user': {...human('synthetic-a', [security]), credentialVerifier: 'invalid'}}),
  ]) await setup(raw, {state: 'malformed', missingRoles: [security, architect], distinctHumanRoleCoverage: false});
  await setup(JSON.stringify({'synthetic-security': human('synthetic-a', [security])}),
    {state: 'configured', missingRoles: [architect], distinctHumanRoleCoverage: false});
  await setup(JSON.stringify({'synthetic-agent': {...human('synthetic-a', [security, architect]), kind: 'AGENT'}}),
    {state: 'configured', missingRoles: [security, architect], distinctHumanRoleCoverage: false});
  for (const roster of [
    {'synthetic-dual': human('synthetic-a', [security, architect])},
    {'synthetic-security': human('synthetic-a', [security]), 'synthetic-alias': human('synthetic-a', [architect])},
  ]) await setup(JSON.stringify(roster), {state: 'configured', missingRoles: [], distinctHumanRoleCoverage: false});
  const roster = {'synthetic-security': human('synthetic-a', [security]), 'synthetic-architect': human('synthetic-b', [architect])};
  const configured = {state: 'configured', missingRoles: [], distinctHumanRoleCoverage: true};
  const binding = {trust: 'LOCAL_ROSTER_ASSERTION', validHumanPersonBindings: 0, missingHumanPersonBindings: true, ambiguousAccountIds: false, distinctPersonRoleCoverage: false, distinctSubmitterCoverage: false};
  await setup(JSON.stringify(roster), configured, binding);
  for (const invalidPerson of ['', '   ', ' invalid', 'invalid ', 'invalid/person', 'a'.repeat(129), 7]) {
    await setup(JSON.stringify({'synthetic-security': {...roster['synthetic-security'], personId: invalidPerson}, 'synthetic-architect': {...roster['synthetic-architect'], personId: 'person-b'}}), configured, {...binding, validHumanPersonBindings: 1});
  }
  const boundRoster = {'synthetic-security': {...roster['synthetic-security'], personId: 'person-a'}, 'synthetic-architect': {...roster['synthetic-architect'], personId: 'person-b'}};
  for (const invalidRoster of [
    {...boundRoster, 'synthetic-security': {...boundRoster['synthetic-security'], id: 'a'.repeat(129)}},
    {['a'.repeat(129)]: boundRoster['synthetic-security'], 'synthetic-architect': boundRoster['synthetic-architect']},
  ]) await setup(JSON.stringify(invalidRoster), {state: 'malformed', missingRoles: [security], distinctHumanRoleCoverage: false},
    {...binding, validHumanPersonBindings: 1, missingHumanPersonBindings: false});
  await setup(JSON.stringify(boundRoster), configured, {...binding, validHumanPersonBindings: 2, missingHumanPersonBindings: false, distinctPersonRoleCoverage: true});
  await setup(JSON.stringify({...boundRoster, 'synthetic-author': {...human('synthetic-c', []), personId: 'person-c'}}), configured,
    {...binding, validHumanPersonBindings: 3, missingHumanPersonBindings: false, distinctPersonRoleCoverage: true});
  await setup(JSON.stringify({...boundRoster, 'synthetic-author': {...human('synthetic-c', [security]), personId: 'person-c'}}), configured,
    {...binding, validHumanPersonBindings: 3, missingHumanPersonBindings: false, distinctPersonRoleCoverage: true, distinctSubmitterCoverage: true});
  await setup(JSON.stringify({...boundRoster, 'synthetic-author-alias': {...human('synthetic-c', []), personId: 'person-a'}}), configured,
    {...binding, validHumanPersonBindings: 3, missingHumanPersonBindings: false, distinctPersonRoleCoverage: true});
  await setup(JSON.stringify({'synthetic-security': {...boundRoster['synthetic-security'], personId: 'person-b'}, 'synthetic-architect': boundRoster['synthetic-architect']}), configured,
    {...binding, validHumanPersonBindings: 2, missingHumanPersonBindings: false});
  await setup(JSON.stringify({...boundRoster, 'synthetic-alias': {...human('synthetic-a', []), personId: 'person-c'}}), configured,
    {...binding, validHumanPersonBindings: 1, missingHumanPersonBindings: false, ambiguousAccountIds: true});
  await fixture(JSON.stringify(roster), async base => {
    const signIn = await fetch(`${base}/api/governance/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'synthetic-security', password})});
    assert.equal(signIn.status, 200);
    const signedIn = await signIn.json();
    assert.deepEqual(Object.keys(signedIn), ['identity'], 'POST contract stays unchanged');
    assert.deepEqual(signedIn.identity, {id: 'synthetic-a', name: 'synthetic-security', roles: [security], kind: 'HUMAN', roleSource: 'LOCAL_SERVER_ROSTER'});
    const cookie = signIn.headers.get('set-cookie')!.split(';')[0];
    assert.match(signIn.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(signIn.headers.get('set-cookie')!, /SameSite=Strict/);
    const session = await fetch(`${base}/api/governance/session`, {headers: {Cookie: cookie}});
    assert.deepEqual((await session.json()).identity, signedIn.identity);
    assert.equal((await fetch(`${base}/protected`, {headers: {Cookie: cookie}})).status, 200);
    const signOut = await fetch(`${base}/api/governance/session`, {method: 'DELETE', headers: {Cookie: cookie}});
    assert.deepEqual(await signOut.json(), {identity: null});
    assert.equal((await fetch(`${base}/protected`, {headers: {Cookie: cookie}})).status, 401);
    const invalid = await fetch(`${base}/api/governance/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'synthetic-unknown', password})});
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), {error: 'Invalid reviewer credentials'});
    passed++;
  });
  await fixture(JSON.stringify({'synthetic-agent': {...human('synthetic-a', [security, architect]), kind: 'AGENT'}}), async base => {
    const signIn = await fetch(`${base}/api/governance/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'synthetic-agent', password})});
    assert.equal(signIn.status, 200, 'Existing agent session behavior stays unchanged');
    const cookie = signIn.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(`${base}/protected`, {headers: {Cookie: cookie}})).status, 403, 'Agent role strings cannot grant human governance');
    assert.equal((await fetch(`${base}/api/governance/session`, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://untrusted.example'}, body: JSON.stringify({username: 'synthetic-agent', password})})).status, 403);
    for (let attempt = 0; attempt < 10; attempt++) {
      assert.equal((await fetch(`${base}/api/governance/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'synthetic-unknown', password})})).status, 401);
    }
    const limited = await fetch(`${base}/api/governance/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: 'synthetic-agent', password})});
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), {error: 'Too many failed sign-in attempts; retry in 15 minutes'});
    passed++;
  });
  console.log(`Reviewer setup: ${passed} passed`);
} finally {
  if (original === undefined) delete process.env.DMK_HUMAN_REVIEWERS;
  else process.env.DMK_HUMAN_REVIEWERS = original;
}
