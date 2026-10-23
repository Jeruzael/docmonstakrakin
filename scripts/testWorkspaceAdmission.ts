import assert from 'node:assert/strict';
const api = await import(new URL('../server/security/workspaceAccess/admission.ts', import.meta.url).href).catch(() => undefined);
let passed = 0, failed = 0;
async function check(name: string, fn: () => void | Promise<void>) { try { await fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + ': ' + String(error)); } }
await check('WA01 bounded nonqueuing workspace admission exists', () => assert.equal(typeof api?.WorkspaceAdmission, 'function', 'Workspace admission not implemented'));
if (api) {
  await check('WA02 four leases admit; overflow returns no lease and queues nothing', () => {
    const gate = new api.WorkspaceAdmission(), releases = Array.from({ length: 4 }, () => gate.tryAcquire());
    assert.ok(releases.every(Boolean)); assert.equal(gate.tryAcquire(), null);
    assert.deepEqual(gate.snapshot(), { active: 4, capacity: 4, queued: 0 }); releases.forEach(release => release());
    assert.equal(gate.snapshot().active, 0);
  });
  await check('WA03 release is idempotent and snapshots cannot alter admission state', () => {
    const gate = new api.WorkspaceAdmission(2), first = gate.tryAcquire(), second = gate.tryAcquire();
    first(); first(); assert.equal(gate.snapshot().active, 1);
    const observed = gate.snapshot(); observed.active = -100; observed.capacity = 100;
    assert.deepEqual(gate.snapshot(), { active: 1, capacity: 2, queued: 0 }); second(); second(); assert.equal(gate.snapshot().active, 0);
  });
  await check('WA04 invalid or unmeasured capacity overrides reject', () => {
    for (const capacity of [0, -1, 1.5, 5, 16, Infinity, NaN, '4', null]) assert.throws(() => new api.WorkspaceAdmission(capacity), (e: any) => e.code === 'WORKSPACE_INPUT_INVALID');
  });
  await check('WA05 overflow rejects before invoking work; completing one task admits one successor', async () => {
    const gate = new api.WorkspaceAdmission(), finish: (() => void)[] = [];
    const pending = Array.from({ length: 4 }, () => gate.run(() => new Promise<void>(resolve => finish.push(resolve))));
    await Promise.resolve(); assert.equal(finish.length, 4); let invoked = false;
    await assert.rejects(gate.run(() => { invoked = true; }), (e: any) => e.code === 'WORKSPACE_OVERLOADED'); assert.equal(invoked, false);
    finish[0](); await pending[0]; assert.equal(gate.snapshot().active, 3);
    assert.equal(await gate.run(() => 'successor'), 'successor'); assert.equal(gate.snapshot().active, 3);
    finish.slice(1).forEach(resolve => resolve()); await Promise.all(pending); assert.equal(gate.snapshot().active, 0);
  });
  await check('WA06 sync and async failures release their exact lease and preserve error identity', async () => {
    const gate = new api.WorkspaceAdmission(1), failure = new Error('synthetic work failed');
    await assert.rejects(gate.run(() => { throw failure; }), (e: any) => e === failure); assert.equal(gate.snapshot().active, 0);
    await assert.rejects(gate.run(async () => { throw failure; }), (e: any) => e === failure); assert.equal(gate.snapshot().active, 0);
    assert.equal(await gate.run(() => 42), 42);
  });
  await check('WA07 caller abort does not free an RPC still running; completion releases it', async () => {
    const gate = new api.WorkspaceAdmission(1), caller = new AbortController(); let finish!: () => void;
    const pending = gate.run(() => new Promise<void>(resolve => { finish = resolve; })); await Promise.resolve(); caller.abort();
    assert.equal(caller.signal.aborted, true); assert.equal(gate.snapshot().active, 1); assert.equal(gate.tryAcquire(), null);
    finish(); await pending; assert.equal(gate.snapshot().active, 0);
  });
  await check('WA08 nested over-capacity work rejects without deadlock or leaked slots', async () => {
    const gate = new api.WorkspaceAdmission(1);
    await assert.rejects(gate.run(() => gate.run(() => 'never')), (e: any) => e.code === 'WORKSPACE_OVERLOADED');
    assert.equal(gate.snapshot().active, 0); assert.equal(await gate.run(() => 'available'), 'available');
  });
  await check('WA09 invalid callbacks reject without acquiring a lease', async () => {
    const gate = new api.WorkspaceAdmission(); await assert.rejects(gate.run(null), (e: any) => e.code === 'WORKSPACE_INPUT_INVALID');
    assert.deepEqual(gate.snapshot(), { active: 0, capacity: 4, queued: 0 });
  });
}
console.log(`Workspace admission: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
