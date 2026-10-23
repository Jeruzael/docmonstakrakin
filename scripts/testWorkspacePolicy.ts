import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const api = (() => { try { return createRequire(import.meta.url)('../server/security/workspaceAccess/projectPolicy.cjs'); } catch { return undefined; } })();
let passed = 0, failed = 0;
function check(name: string, fn: () => void) { try { fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); } }
check('WP01 centralized effective project policy exists', () => assert.equal(typeof api?.evaluateProjectAction, 'function', 'Effective project policy not implemented'));
if (api) {
  const person = (roles: string[] = []) => ({ kind: 'HUMAN', disabled: false, roles });
  const member = (role = 'OWNER', deniedActions: string[] = []) => ({ role, deniedActions });
  const actions = (p = person(), m = member(), projectId = 'PRJ-SYNTHETIC') => api.allowedProjectActions(p, m, projectId);
  check('WP02 OWNER roles[] authors without acquiring review authority', () => {
    assert.deepEqual(actions(), ['project:read', 'project:write', 'project:export', 'project:import']);
    assert.equal(api.evaluateProjectAction(person(), member(), 'project:review', 'PRJ-SYNTHETIC').allowed, false);
  });
  check('WP03 READER reads only and EDITOR authors without replacement import', () => {
    assert.deepEqual(actions(person(), member('READER')), ['project:read']);
    assert.deepEqual(actions(person(), member('EDITOR')), ['project:read', 'project:write', 'project:export']);
  });
  check('WP04 review requires both edit membership and existing SO/LA role', () => {
    for (const role of ['Security Officer', 'Lead Architect']) {
      assert.deepEqual(actions(person([role])), ['project:read', 'project:write', 'project:review', 'project:export', 'project:import']);
      assert.deepEqual(actions(person([role]), member('READER')), ['project:read']);
    }
  });
  check('WP05 explicit DENY beats every role and known action', () => {
    assert.deepEqual(actions(person(['Security Officer', 'Lead Architect']), member('DENY')), []);
    for (const action of api.PROJECT_ACTIONS) assert.equal(api.evaluateProjectAction(person(), member('DENY'), action, 'PRJ-SYNTHETIC').reason, 'EXPLICIT_DENY');
  });
  check('WP06 deniedActions only subtract effective grants', () => {
    assert.deepEqual(actions(person(), member('OWNER', ['project:write', 'project:export'])), ['project:read', 'project:import']);
    assert.deepEqual(actions(person(['Security Officer']), member('OWNER', ['project:review'])), ['project:read', 'project:write', 'project:export', 'project:import']);
    assert.deepEqual(actions(person(), member('READER', ['project:read'])), []);
  });
  check('WP07 canonical self-project retains only read/export regardless of stronger membership', () => {
    for (const role of ['READER', 'EDITOR', 'OWNER']) assert.deepEqual(actions(person(['Security Officer']), member(role), 'PRJ-DOCMONSTAKRAKIN'), ['project:read', 'project:export']);
    assert.deepEqual(actions(person(), member('READER', ['project:export']), 'PRJ-DOCMONSTAKRAKIN'), ['project:read']);
  });
  check('WP08 missing, disabled, agent, unknown membership and unsupported actions deny', () => {
    assert.deepEqual(api.allowedProjectActions(null, member(), 'PRJ-SYNTHETIC'), []);
    assert.deepEqual(api.allowedProjectActions(person(), null, 'PRJ-SYNTHETIC'), []);
    assert.deepEqual(actions({ ...person(), disabled: true }), []);
    assert.deepEqual(actions({ ...person(), kind: 'AGENT' }), []);
    assert.deepEqual(actions(person(), member('ADMIN')), []);
    assert.equal(api.evaluateProjectAction(person(), member(), 'project:create', 'PRJ-SYNTHETIC').allowed, false);
    assert.equal(api.evaluateProjectAction(person(), member(), 'root:apply', 'PRJ-SYNTHETIC').allowed, false);
  });
  check('WP09 enumeration uses the exact same rule and never changes source records', () => {
    const p = person(['Lead Architect']), m = member('EDITOR', ['project:write']), before = JSON.stringify({ p, m });
    const expected = actions(p, m);
    for (const action of api.PROJECT_ACTIONS) assert.equal(api.evaluateProjectAction(p, m, action, 'PRJ-SYNTHETIC').allowed, expected.includes(action));
    assert.equal(JSON.stringify({ p, m }), before); const first = actions(p, m); first.splice(0); assert.deepEqual(actions(p, m), expected);
    assert.equal(api.PROJECT_ACTIONS.length, 5); assert.ok(Object.isFrozen(api.PROJECT_ACTIONS));
  });
}
console.log(`Workspace policy: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
