// A single source-extracted WS04 attempt. Diagnostic evidence, not qualification.
// Uses retained packages as supplied; never installs dependencies or retries.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = process.argv[2] || 'inherited';
const selection = process.argv[3] || 'isolated';
if (!['inherited', 'sparse'].includes(profile) || !['isolated', 'prefix'].includes(selection) || process.argv.length > 4) throw Error('Usage: node scripts/diagnostics/diagnoseWs04.mjs [inherited|sparse] [isolated|prefix]');
if (process.platform !== 'win32' || process.versions.node !== '22.23.3' || process.arch !== 'x64') throw Error('WS04_DIAGNOSTIC_PROFILE_UNSUPPORTED');
const source = fs.readFileSync(path.join(base, 'scripts/testWorkspaceStore.ts'), 'utf8');
const prefixEnd = source.indexOf('if (api) {');
const start = source.indexOf("  await test('WS04 ");
const end = source.indexOf("  await test('WS05 ", start);
if (prefixEnd < 0 || start < 0 || end < 0) throw Error('WS04_SOURCE_BOUNDARIES_MISSING');
const selected = source.slice(start, end);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const evidenceParent = fs.realpathSync.native(process.env.DMK_WS04_EVIDENCE_PARENT || os.tmpdir());
const evidence = fs.mkdtempSync(path.join(evidenceParent, 'dmk-ws04-evidence-'));
// The generated copy lives beside the original script so its import URLs remain
// identical. All helper/fixture/test bytes are copied, including original catch
// and cleanup semantics; only a process exit summary is appended.
const generated = path.join(base, 'scripts', `.ws04-diagnostic-${crypto.randomUUID()}.ts`);
const generatedSource = (selection === 'prefix' ? source.slice(0, end) : source.slice(0, prefixEnd) + '\nif (api) {\n' + selected) + '\n}\n'
  + "console.log(JSON.stringify({diagnostic:'source-extracted-WS04',passed,failed}));process.exitCode=failed||!api?1:0;\n";
// Exactly PD06's sparse environment (plus the two diagnostic metadata values
// added below). Fixture TEMP and all real acquisition timeouts remain original.
const safeEnvironment = profile === 'sparse'
  ? { NODE_ENV: 'production', ...Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]])) }
  : { ...process.env };
// No inherited Node preload or loader may access unrelated state in this run.
delete safeEnvironment.NODE_OPTIONS;
const observer = path.join(base, 'scripts/diagnostics/ws04Permissions.preload.cjs');
fs.writeFileSync(generated, generatedSource, { flag: 'wx' });
const summary = { schema: 1, diagnosticOnly: true, profile, selection, fixture: selection === 'prefix' ? 'source-prefix-through-WS04' : 'source-extracted-WS04', sourceSha256: sha256(source),
  exactWs04BlockSha256: sha256(selected), generatedSourceSha256: sha256(generatedSource),
  runnerSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))), observerSha256: sha256(fs.readFileSync(observer)),
  sparseMatchesPd06Environment: profile === 'sparse', originalWorkerExecArgv: [], diagnosticWorkerAddsRequire: true, installPerformed: false, attempts: 1 };
try {
  const result = spawnSync(process.execPath, ['--require', observer, '--import', 'tsx', generated], {
    cwd: base, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024,
    env: { ...safeEnvironment, DMK_WS04_DIAGNOSTIC: 'synthetic-only', DMK_WS04_EVIDENCE: evidence },
  });
  // Original WS04 reports only constant test names and public error codes.
  fs.writeFileSync(path.join(evidence, 'fixture.stdout.log'), result.stdout || '');
  fs.writeFileSync(path.join(evidence, 'fixture.stderr.log'), result.stderr || '');
  const events = fs.readdirSync(evidence).filter(name => /^observer-\d+-\d+\.jsonl$/.test(name))
    .flatMap(name => fs.readFileSync(path.join(evidence, name), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
  summary.status = result.status;
  summary.signal = result.signal;
  summary.launchErrorCode = result.error?.code;
  summary.parentObserved = events.some(e => e.event === 'observer-start' && e.actor === 'parent');
  summary.workerObserved = events.some(e => e.event === 'observer-start' && e.actor === 'worker');
  summary.subprocesses = events.filter(e => e.event === 'subprocess-return').map(({ thread, context, operation, target, targetId, ok, status, signal, errorCode, timeoutMs, durationMs }) => ({ thread, context, operation, target, targetId, ok, status, signal, errorCode, timeoutMs, durationMs }));
  summary.permissionFailures = events.filter(e => e.event === 'boundary-return' && e.errorCode === 'WORKSPACE_PERMISSIONS_INVALID');
  summary.result = result.status === 0 && summary.parentObserved && summary.workerObserved ? 'NOT_REPRODUCED' : 'OBSERVED_FAILURE_REQUIRES_CLASSIFICATION';
  console.log(JSON.stringify({ ...summary, subprocesses: summary.subprocesses.length, evidence }));
  process.exitCode = result.status === 0 && summary.parentObserved && summary.workerObserved ? 0 : 1;
} finally {
  fs.writeFileSync(path.join(evidence, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  if (path.dirname(generated) !== path.join(base, 'scripts') || !/^\.ws04-diagnostic-[a-f0-9-]+\.ts$/.test(path.basename(generated)) || fs.lstatSync(generated).isSymbolicLink()) throw Error('WS04_GENERATED_CLEANUP_REJECTED');
  fs.unlinkSync(generated);
}
