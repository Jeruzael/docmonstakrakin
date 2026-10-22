import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as projection from '../src/data/releaseHealthProjection';
import {INITIAL_PROJECTS} from '../src/data/initialData';
import type {ProjectReadinessResponse, ReadinessProject} from '../src/releaseScopeTypes';

type Element = {type: unknown; props: Record<string, any>};
const makeProject = (id = 'PRJ-DASHBOARD-A', stateVersion = 7): ReadinessProject => ({
  ...structuredClone(INITIAL_PROJECTS[0]), id, stateVersion, targetRelease: 'Synthetic release',
  readinessContext: {
    version: 'LOCAL_RELEASE_SCOPE/1', id: 'RSC-synthetic-dashboard', revision: 1,
    targetRelease: 'Synthetic release', workItemIds: ['TASK-SCOPED'],
    commitSha: 'a'.repeat(40), buildRevision: 'synthetic-build', environment: 'local-fixture',
    updatedAt: '2026-10-22T00:00:00.000Z',
    updatedBy: {identityId: 'fixture-only', name: 'Fixture only', roleSource: 'LOCAL_SERVER_ROSTER'},
  },
});
function response(project = makeProject()): ProjectReadinessResponse {
  const workItems = [{id: 'TASK-SCOPED', title: 'Synthetic scoped task', status: 'READY' as const}];
  const scope = project.readinessContext!;
  const evidence = [{
    projectId: project.id, workItemId: 'TASK-SCOPED', commitSha: scope.commitSha,
    buildRevision: scope.buildRevision, environment: scope.environment,
    observation: {
      reviews: [], eligibleSessionIds: [],
      trust: 'LOCAL_ROSTER_ASSERTION_AND_HUMAN_ATTESTATION' as const,
      trustedProductionEvidence: false as const,
    },
  }];
  return {
    projectId: project.id, stateVersion: project.stateVersion,
    maturity: project.maturity ?? null, sourceControl: null,
    targetRelease: project.targetRelease, readinessContext: scope, workItems,
    summary: projection.releaseHealthProjection(project, workItems as any, evidence),
  };
}

/** Same in-memory React adapter as the readiness editor tests. No browser or disk writes. */
function fixture() {
  const values: any[] = [];
  const effects: {deps?: unknown[]; cleanup?: () => void}[] = [];
  const todo: (() => void)[] = [];
  const timers = new Map<number, () => void>();
  let timerId = 0, cursor = 0, tree: Element;
  let props = {project: makeProject(), sessionRevision: 1, canInspect: true};
  const requests: {url: string; init: RequestInit; resolve: (value: Response) => void}[] = [];
  const react = {
    useState(initial: any) {
      const key = cursor++;
      if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial;
      return [values[key], (next: any) => {values[key] = typeof next === 'function' ? next(values[key]) : next;}];
    },
    useRef(initial: unknown) {
      const key = cursor++;
      if (!(key in values)) values[key] = {current: initial};
      return values[key];
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const key = cursor++, previous = effects[key];
      if (!previous || !deps || deps.some((value, index) => value !== previous.deps?.[index])) {
        todo.push(() => {
          previous?.cleanup?.();
          effects[key] = {deps, cleanup: effect() || undefined};
        });
      }
    },
  };
  const jsx = (type: unknown, elementProps: Record<string, any>) => ({type, props: elementProps});
  const runtime: Record<string, any> = {
    AbortController, Response,
    setTimeout: (callback: () => void) => {timers.set(++timerId, callback); return timerId;},
    clearTimeout: (key: number) => timers.delete(key),
    // Deliberately ignores AbortSignal: the caller must make timeout finality explicit.
    fetch: (url: string, init: RequestInit) => new Promise<Response>(resolve => requests.push({url, init, resolve})),
  };
  const modules = new Map<string, Record<string, any>>();
  function load(file: string): Record<string, any> {
    const previous = modules.get(file); if (previous) return previous;
    const exports: Record<string, any> = {}; modules.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
    }).outputText;
    vm.runInNewContext(source, {...runtime, exports, require: (name: string) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx, Fragment: 'Fragment'};
      if (name.includes('releaseHealthProjection')) return projection;
      if (name.includes('ProjectReadinessSetup')) return load('src/components/ProjectReadinessSetup.tsx');
      if (name.includes('DashboardView')) return {DashboardView: 'Dashboard'};
      throw new Error(`Unexpected dashboard runtime dependency: ${name}`);
    }});
    return exports;
  }
  const component = load('src/components/ScopedDashboardView.tsx').ScopedDashboardView;
  function render(next?: Partial<typeof props>) {
    props = {...props, ...next}; cursor = 0;
    tree = component(props);
    while (todo.length) todo.shift()!();
    return tree;
  }
  function all(node: unknown = tree): Element[] {
    if (Array.isArray(node)) return node.flatMap(all);
    if (!node || typeof node !== 'object' || !('props' in node)) return [];
    const element = node as Element;
    return [element, ...(element.props.children === undefined ? [] : all(element.props.children))];
  }
  function text(node: unknown = tree): string {
    if (Array.isArray(node)) return node.map(text).join(' ');
    if (node && typeof node === 'object' && 'props' in node) return (node as Element).props.children === undefined ? '' : text((node as Element).props.children);
    return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  }
  const summary = () => all().find(node => node.type === 'Dashboard')?.props.releaseHealth;
  const flush = async () => {await new Promise<void>(resolve => setImmediate(resolve)); render();};
  async function reply(index: number, body: unknown, status = 200) {
    requests[index].resolve(new Response(JSON.stringify(body), {status})); await flush();
  }
  async function delayedJson(index: number) {
    let resolveBody!: (value: any) => void, started = false;
    const body = new Promise<any>(resolve => {resolveBody = resolve;});
    const packet = new Response('{}', {status: 200});
    packet.json = () => {started = true; return body;};
    requests[index].resolve(packet); await flush();
    assert.equal(started, true, 'The decoder must be awaiting the response body before deadline injection');
    return async (value: any) => {resolveBody(value); await flush();};
  }
  render(); render();
  return {
    requests, render, summary, text, flush, reply, delayedJson,
    timeout: async () => {for (const callback of [...timers.values()]) callback(); await flush();},
    close: () => {for (const effect of effects) effect?.cleanup?.();},
  };
}

let passed = 0, failed = 0;
async function test(name: string, run: (subject: ReturnType<typeof fixture>) => Promise<void>) {
  const subject = fixture();
  try {await run(subject); passed++; console.log(`PASS ${name}`);}
  catch (error) {failed++; console.error(`FAIL ${name}`); console.error(error instanceof Error ? error.message : error);}
  finally {subject.close();}
}

await test('valid current scoped response reaches the dashboard with local evidence only', async f => {
  assert.equal(f.requests[0].url, '/api/projects/PRJ-DASHBOARD-A/readiness');
  assert.equal(f.requests[0].init.credentials, 'same-origin');
  await f.reply(0, response());
  assert.equal(f.summary()?.localEvidence.reviewedCount, 0);
  assert.equal(f.summary()?.scope.count, 1);
  assert.equal(f.summary()?.securityAssurance.status, 'Unavailable');
  assert.equal(f.summary()?.productionRelease.status, 'Unavailable');
});
await test('an abort-ignoring fetch cannot deliver scoped evidence after the deadline', async f => {
  await f.timeout();
  assert.equal(f.requests[0].init.signal?.aborted, true);
  await f.reply(0, response());
  assert.equal(f.summary(), undefined, 'A timed-out fetch must never resurrect an available summary');
  assert.match(f.text(), /unavailable.*Retry scoped evidence/s);
});
await test('a JSON body completing after the deadline cannot resurrect scoped evidence', async f => {
  const finishBody = await f.delayedJson(0);
  await f.timeout();
  await finishBody(response());
  assert.equal(f.summary(), undefined, 'Timeout finality also covers response.json(), not only fetch()');
  assert.match(f.text(), /unavailable.*Retry scoped evidence/s);
});
for (const kind of ['project', 'version', 'session'] as const) {
  await test(`${kind} change masks a late previous-scope success and admits only the replacement`, async f => {
    const project = kind === 'project' ? makeProject('PRJ-DASHBOARD-B') : makeProject('PRJ-DASHBOARD-A', kind === 'version' ? 8 : 7);
    f.render({project, ...(kind === 'session' ? {sessionRevision: 2} : {})});
    assert.equal(f.requests.length, 2);
    assert.equal(f.summary(), undefined);
    await f.reply(0, response());
    assert.equal(f.summary(), undefined, 'Old project/version/session success must remain masked');
    await f.reply(1, response(project));
    assert.equal(f.summary()?.scope.count, 1);
  });
}
await test('a session becoming unconfirmed masks previously loaded evidence immediately', async f => {
  await f.reply(0, response()); assert.ok(f.summary());
  f.render({canInspect: false, sessionRevision: 2});
  assert.equal(f.summary(), undefined);
  assert.equal(f.requests.length, 1, 'Unconfirmed reviewer state must not start a privileged observation');
});
await test('a malformed rendered formula is rejected before reaching the dashboard', async f => {
  const malformed = response(); (malformed.summary.localEvidence as any).formula = {unexpected: 'object'};
  await f.reply(0, malformed);
  assert.equal(f.summary(), undefined);
  assert.match(f.text(), /unavailable.*Retry scoped evidence/s);
});
for (const kind of ['project', 'version'] as const) {
  await test(`a successful HTTP response for the wrong ${kind} stays unavailable`, async f => {
    const wrong = response(kind === 'project' ? makeProject('PRJ-DASHBOARD-B') : makeProject('PRJ-DASHBOARD-A', 8));
    await f.reply(0, wrong);
    assert.equal(f.summary(), undefined);
    assert.match(f.text(), /unavailable.*Retry scoped evidence/s);
  });
}
console.log(`Scoped dashboard state: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
