import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as projection from '../src/data/releaseHealthProjection';
import {INITIAL_PROJECTS} from '../src/data/initialData';
import type {ReadinessProject, ProjectReadinessResponse} from '../src/releaseScopeTypes';

type Element = {type: unknown; props: Record<string, any>};
const makeProject = (id = 'PRJ-A'): ReadinessProject => ({...structuredClone(INITIAL_PROJECTS[0]), id, stateVersion: 1, maturity: undefined, targetRelease: 'Synthetic release'});
function response(id = 'PRJ-A', stateVersion = 1): ProjectReadinessResponse {
  const project = makeProject(id);
  return {projectId: id, stateVersion, maturity: null, sourceControl: null, targetRelease: project.targetRelease, readinessContext: null,
    workItems: [{id: `${id}-WORK`, title: 'Synthetic scoped work', status: 'READY'}], summary: projection.releaseHealthProjection(project, [])};
}
function fixture(id = 'PRJ-A') {
  const values: any[] = [], effects: {deps?: unknown[]; cleanup?: () => void}[] = [], todo: (() => void)[] = [];
  let cursor = 0, tree: Element, props = {project: makeProject(id), sessionRevision: 0, canEdit: true};
  const changed: string[] = [], changedVersions: number[] = [], timers = new Map<number, () => void>(); let timerId = 0;
  const requests: {url: string; init: RequestInit; resolve: (response: Response) => void; reject: (error: Error) => void}[] = [];
  const react = {
    useState(initial: any) {const key = cursor++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial; return [values[key], (next: any) => {values[key] = typeof next === 'function' ? next(values[key]) : next;}];},
    useRef(initial: unknown) {const key = cursor++; if (!(key in values)) values[key] = {current: initial}; return values[key];},
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const key = cursor++, previous = effects[key];
      if (!previous || !deps || deps.some((value, index) => value !== previous.deps?.[index])) todo.push(() => {previous?.cleanup?.(); const cleanup = effect(); effects[key] = {deps, cleanup: cleanup || undefined};});
    },
  };
  const jsx = (type: unknown, elementProps: Record<string, any>) => ({type, props: elementProps});
  const source = ts.transpileModule(fs.readFileSync('src/components/ProjectReadinessSetup.tsx', 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(source, {exports, require: (name: string) => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (name.includes('releaseHealthProjection')) return projection;
    throw new Error(`Unexpected runtime dependency: ${name}`);
  }, AbortController, setTimeout: (fn: () => void) => {timers.set(++timerId, fn); return timerId;}, clearTimeout: (key: number) => timers.delete(key),
  fetch: (url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => requests.push({url, init, resolve, reject}))});
  function render(next?: Partial<typeof props>) {props = {...props, ...next}; cursor = 0; tree = exports.ProjectReadinessSetup({...props, onChanged: (projectId: string, stateVersion: number) => {changed.push(projectId); changedVersions.push(stateVersion);}}); while (todo.length) todo.shift()!(); return tree;}
  function all(node: unknown = tree): Element[] {if (Array.isArray(node)) return node.flatMap(all); if (!node || typeof node !== 'object' || !('props' in node)) return []; const element = node as Element; return [element, ...(element.props.children === undefined ? [] : all(element.props.children))];}
  function text(node: unknown = tree): string {if (Array.isArray(node)) return node.map(text).join(' '); if (node && typeof node === 'object' && 'props' in node) return (node as Element).props.children === undefined ? '' : text((node as Element).props.children); return typeof node === 'string' || typeof node === 'number' ? String(node) : '';}
  const flush = async () => {await new Promise<void>(resolve => setImmediate(resolve)); render();};
  async function reply(index: number, body: unknown, status = 200) {requests[index].resolve(new Response(JSON.stringify(body), {status})); await flush();}
  function button(label: string) {const found = all().find(node => node.type === 'button' && text(node) === label); assert.ok(found, `Missing ${label}`); return found;}
  function fill(label: string, value: string | boolean) {const input = all().find(node => node.props['aria-label'] === label); assert.ok(input, `Missing ${label}`); input.props.onChange({target: {value, checked: value}}); render();}
  function fillSetup() {fill('Project maturity', 'GREENFIELD'); fill('Target source-control selection', 'Git');}
  render(); render();
  return {requests, changed, changedVersions, render, all, text, flush, reply, button, fill, fillSetup,
    timeout: async () => {for (const fn of [...timers.values()]) fn(); await flush();},
    close: () => {for (const effect of effects) effect?.cleanup?.();}};
}
let passed = 0;
async function test(name: string, run: (subject: ReturnType<typeof fixture>) => Promise<void>) {const f = fixture(); try {await run(f); passed++; console.log(`PASS ${name}`);} finally {f.close();}}
await test('setup remains disabled until current reviewer-gated GET confirms CAS and work options', async f => {
  assert.equal(f.requests[0].url, '/api/projects/PRJ-A/readiness'); assert.equal(f.requests[0].init.credentials, 'same-origin');
  assert.match(f.text(), /Loading readiness/);
  await f.reply(0, response()); f.fillSetup();
  const save = f.button('Save project setup'); const first = save.props.onClick(); save.props.onClick(); f.render();
  assert.equal(f.requests.length, 2); assert.equal(f.button('Save project setup').props.disabled, true);
  assert.deepEqual(JSON.parse(String(f.requests[1].init.body)), {expectedStateVersion: 1, maturity: 'GREENFIELD', sourceControl: 'Git'});
  await f.reply(1, {...response('PRJ-A', 2), maturity: 'GREENFIELD', sourceControl: 'Git'}); await first; f.render();
  assert.deepEqual(f.changed, ['PRJ-A']); assert.match(f.text(), /Planning context saved/); assert.match(f.text(), /no approval or release authority/);
  assert.deepEqual(f.changedVersions, [2], 'Parent receives the validated acknowledgement floor before reloading');
});
await test('explicit scope sends selected work IDs and exact binding with current target release', async f => {
  await f.reply(0, response()); f.fillSetup();
  f.fill('Include PRJ-A-WORK in current release', true); f.fill('Commit SHA', 'a'.repeat(40)); f.fill('Build revision', 'build-1'); f.fill('Environment', 'local-loopback');
  const pending = f.button('Save release scope and setup').props.onClick();
  const body = JSON.parse(String(f.requests[1].init.body));
  assert.deepEqual(body.scope, {targetRelease: 'Synthetic release', workItemIds: ['PRJ-A-WORK'], commitSha: 'a'.repeat(40), buildRevision: 'build-1', environment: 'local-loopback'});
  assert.equal('updatedBy' in body, false); assert.equal('trustedProductionEvidence' in body, false);
  await f.reply(1, {error: 'fixture-secret'}, 422); await pending; f.render();
  assert.deepEqual(f.changed, []); assert.doesNotMatch(f.text(), /fixture-secret/);
});
await test('CAS conflict preserves draft and blocks another mutation until an explicit reload', async f => {
  await f.reply(0, response()); f.fillSetup(); const pending = f.button('Save project setup').props.onClick();
  await f.reply(1, {error: 'fixture-secret'}, 409); await pending; f.render();
  assert.match(f.text(), /changed.*Reload readiness/s); assert.equal(f.all().find(node => node.props['aria-label'] === 'Target source-control selection')!.props.value, 'Git');
  assert.equal(f.button('Save project setup').props.disabled, true); assert.deepEqual(f.changed, []);
  const reload = f.button('Reload readiness').props.onClick(); await f.reply(2, response('PRJ-A', 3)); await reload; f.render();
  assert.equal(f.requests[2].init.method ?? 'GET', 'GET'); assert.equal(f.button('Save project setup').props.disabled, false);
});
await test('timeout reports unknown save outcome without auto retry or accepting a late acknowledgement', async f => {
  await f.reply(0, response()); f.fillSetup(); f.button('Save project setup').props.onClick();
  await f.timeout(); assert.match(f.text(), /could not be confirmed.*Reload readiness/s); assert.equal(f.requests.length, 2); assert.deepEqual(f.changed, []);
  assert.equal(f.button('Save project setup').props.disabled, true); assert.equal(f.requests[1].init.signal!.aborted, true);
  await f.reply(1, {...response('PRJ-A', 2), maturity: 'GREENFIELD', sourceControl: 'Git'}); assert.deepEqual(f.changed, []); assert.doesNotMatch(f.text(), /Planning context saved/);
});
await test('project switch fences pending save acknowledgements and resets the previous draft', async f => {
  await f.reply(0, response()); f.fillSetup(); f.button('Save project setup').props.onClick();
  f.render({project: makeProject('PRJ-B')});
  assert.doesNotMatch(f.text(), /PRJ-A-WORK|Saving planning context/, 'Old project state must be hidden before the switch effect rerenders');
  await f.reply(1, {...response('PRJ-A', 2), maturity: 'GREENFIELD', sourceControl: 'Git'}); assert.deepEqual(f.changed, []);
  await f.reply(2, response('PRJ-B'));
  assert.doesNotMatch(f.text(), /PRJ-A-WORK/); assert.match(f.text(), /PRJ-B-WORK/);
  assert.equal(f.all().find(node => node.props['aria-label'] === 'Target source-control selection')!.props.value, '');
});
await test('session revision immediately hides previous reviewer-scoped observations', async f => {
  await f.reply(0, response()); f.render({sessionRevision: 1});
  assert.doesNotMatch(f.text(), /PRJ-A-WORK/);
  await f.reply(1, {error: 'fixture-secret'}, 403);
  assert.doesNotMatch(f.text(), /PRJ-A-WORK|fixture-secret/);
});
await test('project version change immediately fences pending saves and reloads current CAS', async f => {
  await f.reply(0, response()); f.fillSetup(); f.button('Save project setup').props.onClick();
  f.render({project: {...makeProject(), stateVersion: 2}});
  assert.doesNotMatch(f.text(), /PRJ-A-WORK|Saving planning context/);
  assert.equal(f.requests.length, 3, 'A new project version starts a fresh read');
  assert.equal(f.requests[1].init.signal!.aborted, true);
  await f.reply(1, {...response('PRJ-A', 2), maturity: 'GREENFIELD', sourceControl: 'Git'});
  assert.deepEqual(f.changed, [], 'Late save result cannot notify after version invalidation');
  await f.reply(2, response('PRJ-A', 3)); f.fillSetup();
  const pending = f.button('Save project setup').props.onClick();
  assert.equal(JSON.parse(String(f.requests[3].init.body)).expectedStateVersion, 3);
  await f.reply(3, {...response('PRJ-A', 4), maturity: 'GREENFIELD', sourceControl: 'Git'}); await pending;
  assert.deepEqual(f.changed, ['PRJ-A']);
});
for (const status of [401, 403, 500]) await test(`GET ${status} remains unavailable with bounded guidance`, async f => {await f.reply(0, {error: 'fixture-secret'}, status); assert.doesNotMatch(f.text(), /fixture-secret/); assert.equal(f.all().some(node => node.props.role === 'alert'), true); assert.equal(f.all().some(node => node.type === 'input'), false);});
await test('malformed successful save cannot announce completion or update parent state', async f => {await f.reply(0, response()); f.fillSetup(); const pending = f.button('Save project setup').props.onClick(); await f.reply(1, {projectId: 'PRJ-B', stateVersion: 2}); await pending; f.render(); assert.deepEqual(f.changed, []); assert.match(f.text(), /could not be confirmed/);});
await test('saved scope can remove an item no longer present in current project work', async f => {
  const loaded = response();
  loaded.readinessContext = {version: 'LOCAL_RELEASE_SCOPE/1', id: 'RSC-synthetic', revision: 1, targetRelease: loaded.targetRelease, workItemIds: ['PRJ-A-WORK', 'REMOVED-WORK'], commitSha: 'a'.repeat(40), buildRevision: 'build-1', environment: 'local-loopback', updatedAt: '2026-10-22T01:00:00.000Z', updatedBy: {identityId: 'synthetic-reviewer', name: 'Synthetic Reviewer', roleSource: 'LOCAL_SERVER_ROSTER'}};
  loaded.summary = projection.releaseHealthProjection({...makeProject(), readinessContext: loaded.readinessContext}, loaded.workItems as any);
  await f.reply(0, loaded); f.fillSetup();
  assert.match(f.text(), /Unavailable scoped item.*REMOVED-WORK/s);
  f.fill('Include REMOVED-WORK in current release', false);
  const pending = f.button('Save release scope and setup').props.onClick();
  assert.deepEqual(JSON.parse(String(f.requests[1].init.body)).scope.workItemIds, ['PRJ-A-WORK']);
  await f.reply(1, {error: 'Synthetic rejection'}, 422); await pending;
});
await test('invalid local evidence totals cannot appear as a trusted summary', async f => {
  const loaded = response(); (loaded.summary.localEvidence as any) = {...loaded.summary.localEvidence, status: 'Available', reviewedCount: 1, total: 'fixture-secret', percentage: 100};
  await f.reply(0, loaded); assert.doesNotMatch(f.text(), /fixture-secret/); assert.equal(f.all().some(node => node.props.role === 'alert'), true);
});
console.log(`Project readiness UI: ${passed} passed`);
