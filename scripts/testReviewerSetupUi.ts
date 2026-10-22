import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual component with a small hook/element adapter. This focused test
// needs no browser, bundler, server, native modules, credentials or stored data.
type Element = {type: unknown; props: Record<string, any>};
type Reply = {status?: number; body?: unknown; networkError?: boolean};
function fixture() {
  const values: any[] = [], effects: (() => void | (() => void))[] = [], requests: {init: RequestInit; resolve: (value: Response) => void; reject: (error: Error) => void}[] = [];
  let cursor = 0, started = false, tree: Element;
  const cleanups: (() => void)[] = [];
  const phases: string[] = [];
  const react = {
    useState(initial: unknown) {const key = cursor++; if (!(key in values)) values[key] = initial; return [values[key], (next: unknown) => {values[key] = next;}];},
    useRef(initial: unknown) {const key = cursor++; if (!(key in values)) values[key] = {current: initial}; return values[key];},
    useEffect(effect: () => void | (() => void)) {if (!started) effects.push(effect);},
  };
  const jsx = (type: unknown, props: Record<string, any>) => ({type, props});
  const source = ts.transpileModule(fs.readFileSync('src/components/ReviewerSession.tsx', 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
  }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(source, {exports, require: (name: string) => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    throw new Error(`Unexpected runtime dependency ${name}`);
  }, AbortController, setTimeout, clearTimeout, fetch: (_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => requests.push({init, resolve, reject}))});
  function render() {cursor = 0; tree = exports.ReviewerSession({onSessionStateChange: (phase: string) => phases.push(phase)}); if (!started) {started = true; for (const effect of effects) {const cleanup = effect(); if (cleanup) cleanups.push(cleanup);}} return tree;}
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
  const flush = async () => {await new Promise<void>(resolve => setImmediate(resolve)); render();};
  async function reply(index: number, response: Reply) {
    if (response.networkError) requests[index].reject(new Error('Synthetic network failure'));
    else requests[index].resolve(new Response(JSON.stringify(response.body), {status: response.status ?? 200}));
    await flush();
  }
  function button(label: string) {const match = all().find(node => node.type === 'button' && text(node) === label); assert.ok(match, `Missing button ${label}`); return match;}
  async function signIn() {
    button('Sign in for governance review').props.onClick(); render();
    all().find(node => node.props['aria-label'] === 'Reviewer username')!.props.onChange({target: {value: 'synthetic-user'}});
    all().find(node => node.props['aria-label'] === 'Reviewer password')!.props.onChange({target: {value: 'fixture-secret'}});
    render();
    const pending = all().find(node => node.type === 'form')!.props.onSubmit({preventDefault() {}});
    render();
    return {pending};
  }
  render();
  return {all, text, render, reply, button, requests, phases, signIn, flush, close: () => {for (const cleanup of cleanups) cleanup();}};
}

let passed = 0;
const security = 'Security Officer', architect = 'Lead Architect';
for (const [setup, expected] of [
  [{state: 'not-configured', missingRoles: [security, architect], distinctHumanRoleCoverage: false}, /No human reviewers are configured.*DMK_HUMAN_REVIEWERS.*restart/s],
  [{state: 'malformed', missingRoles: [security, architect], distinctHumanRoleCoverage: false}, /Reviewer setup is malformed.*operator.*restart/s],
  [{state: 'configured', missingRoles: [architect], distinctHumanRoleCoverage: false}, /missing required human roles: Lead Architect/],
  [{state: 'configured', missingRoles: [], distinctHumanRoleCoverage: false}, /do not cover two distinct human reviewer IDs/],
  [{state: 'configured', missingRoles: [], distinctHumanRoleCoverage: true}, /Roster entries alone do not verify real-world human independence/],
] as const) {
  const f = fixture();
  try {await f.reply(0, {body: {identity: null, setup}}); assert.match(f.text(), expected); assert.doesNotMatch(f.text(), /fixture-secret|synthetic-user/); passed++;}
  finally {f.close();}
}
for (const [response, expected] of [
  [{status: 401, body: {error: 'fixture-secret'}}, /credentials were rejected.*operator-issued/s],
  [{status: 403, body: {error: 'fixture-secret'}}, /server rejected.*server's own address/s],
  [{status: 429, body: {error: 'fixture-secret'}}, /Too many.*15 minutes/s],
  [{networkError: true}, /may have accepted.*Check reviewer session/s],
  [{status: 500, body: {error: 'fixture-secret'}}, /may have accepted.*Check reviewer session/s],
] as const) {
  const f = fixture();
  try {
    await f.reply(0, {body: {identity: null}});
    const {pending} = await f.signIn();
    await f.reply(1, response); await pending; f.render();
    assert.match(f.text(), expected);
    assert.doesNotMatch(f.text(), /fixture-secret/);
    assert.equal(f.all().find(node => node.props['aria-label'] === 'Reviewer password')!.props.value, '');
    assert.equal(f.requests.length, 2, 'Never automatically retry credentials');
    const check = f.button('Check reviewer session');
    check.props.onClick(); check.props.onClick(); f.render();
    assert.equal(f.requests.length, 3);
    assert.equal(f.button('Check reviewer session').props.disabled, true);
    assert.equal(f.requests[2].init.method ?? 'GET', 'GET');
    assert.equal(f.requests[2].init.body, undefined);
    assert.equal(f.requests[2].init.credentials, 'same-origin');
    await f.reply(2, {body: {identity: {name: 'Confirmed reviewer', roles: [security]}}});
    assert.match(f.text(), /Reviewer:.*Confirmed reviewer/s);
    assert.doesNotMatch(f.text(), /could not be confirmed/);
    assert.deepEqual(f.phases, ['checking', 'confirmed', 'pending', 'unknown', 'pending', 'confirmed']);
    passed++;
  } finally {f.close();}
}
for (const [verification, expected] of [
  [{missingHumanPersonBindings: true}, /Verification person bindings are missing or invalid.*personId/s],
  [{ambiguousAccountIds: true}, /Reviewer account IDs are ambiguous/],
  [{distinctPersonRoleCoverage: false}, /two distinct locally asserted persons covering Security Officer and Lead Architect/],
  [{distinctPersonRoleCoverage: true, distinctSubmitterCoverage: false}, /third distinct locally asserted person for evidence submission/],
  [{distinctPersonRoleCoverage: true, distinctSubmitterCoverage: true}, /Configuration coverage only.*submitter cannot approve.*operator must confirm/s],
] as const) {
  const f = fixture();
  try {
    const coverage = {trust: 'LOCAL_ROSTER_ASSERTION', validHumanPersonBindings: 3, missingHumanPersonBindings: false, ambiguousAccountIds: false, distinctPersonRoleCoverage: false, distinctSubmitterCoverage: false, ...verification};
    await f.reply(0, {body: {identity: null, setup: {state: 'configured', missingRoles: [], distinctHumanRoleCoverage: true, verification: coverage}}});
    assert.match(f.text(), expected);
    passed++;
  } finally {f.close();}
}
for (const setup of [
  {state: {toString: null, valueOf: null}, missingRoles: [], distinctHumanRoleCoverage: true},
  {state: 'fixture-secret', missingRoles: [], distinctHumanRoleCoverage: true},
  {state: 'configured', missingRoles: ['fixture-secret'], distinctHumanRoleCoverage: true},
  {state: 'configured', missingRoles: [], distinctHumanRoleCoverage: 'fixture-secret'},
]) {
  const f = fixture();
  try {
    await f.reply(0, {body: {identity: {name: 'Confirmed reviewer', roles: [security]}, setup}});
    assert.match(f.text(), /Reviewer:.*Confirmed reviewer/s, 'Bad optional diagnostics must not replace a valid session');
    assert.doesNotMatch(f.text(), /fixture-secret/);
    passed++;
  } finally {f.close();}
}
{
  const f = fixture();
  try {
    await f.reply(0, {body: {identity: {name: 'Confirmed reviewer', roles: [security]}}});
    const pending = f.button('Sign out').props.onClick();
    await f.reply(1, {networkError: true}); await pending; f.render();
    assert.match(f.text(), /Last confirmed reviewer:.*Confirmed reviewer/s);
    assert.match(f.text(), /may have completed.*Check reviewer session/s);
    f.button('Check reviewer session').props.onClick();
    await f.reply(2, {body: {identity: null}});
    assert.equal(f.all().some(node => node.type === 'strong'), false);
    assert.doesNotMatch(f.text(), /could not be confirmed/);
    assert.equal(f.requests[2].init.method ?? 'GET', 'GET');
    passed++;
  } finally {f.close();}
}
console.log(`Reviewer setup UI: ${passed} passed`);
