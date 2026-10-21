import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KNOWN_EVIDENCE_PATHS } from '../server/bootstrap/selfBootstrapIntegrity.ts';
import { classifyRegressionResult } from './lib/regressionResult.ts';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loader = pathToFileURL(path.join(sourceRoot, 'node_modules/tsx/dist/loader.mjs')).href;
let passed = 0;
let failed = 0;

function check(name: string, run: () => void) {
  try {
    run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Execute the real runner, unchanged and without a test-only mode. Its cwd is a
// minimal disposable checkout, so discovery cannot launch application/browser suites.
function withRunner(childSource: string, inspect: (result: ReturnType<typeof spawnSync>, report: any, root: string) => void) {
  const temporaryParent = fs.realpathSync.native(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporaryParent, 'dmk-regression-classifier-'));
  assert.equal(path.dirname(root), temporaryParent);
  try {
    for (const directory of ['bootstrap', 'scripts', 'server']) fs.mkdirSync(path.join(root, directory));
    fs.symlinkSync(fs.realpathSync.native(path.join(sourceRoot, 'node_modules')), path.join(root, 'node_modules'), 'junction');
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n');
    fs.writeFileSync(path.join(root, 'bootstrap/docmonstakrakin.self-bootstrap.json'), '{"documents":[]}\n');
    for (const evidencePath of Object.values(KNOWN_EVIDENCE_PATHS)) {
      fs.mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
      fs.writeFileSync(path.join(root, evidencePath), 'Synthetic retained evidence.\n');
    }
    fs.writeFileSync(path.join(root, 'scripts/runAutomatedQa.ts'), 'console.log("PASS synthetic QA control");\n');
    fs.writeFileSync(path.join(root, 'scripts/testFixture.ts'), childSource);
    const result = spawnSync(process.execPath, ['--import', loader, path.join(sourceRoot, 'scripts/runCompleteRegression.ts')], {
      cwd: root, windowsHide: true, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, GEMINI_API_KEY: '' },
    });
    assert.equal(result.error, undefined, `Runner startup failed: ${result.error?.message}`);
    const report = JSON.parse(fs.readFileSync(path.join(root, 'runtime/rc-regression/results.json'), 'utf8'));
    inspect(result, report, root);
  } finally {
    // Remove the test-created junction itself before recursively cleaning its
    // verified temporary parent; never traverse or alter the shared dependencies.
    fs.rmSync(path.join(root, 'node_modules'), { force: true });
    assert.equal(path.dirname(path.resolve(root)), temporaryParent);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

check('actual runner exits nonzero when an exit-zero child reports a named failure', () => {
  withRunner('console.log("FAIL synthetic named failure");\n', (result, report, root) => {
    const suite = report.results.find((entry: any) => entry.suite === 'scripts/testFixture.ts');
    assert.equal(suite.exitCode, 0);
    assert.equal(suite.failed, 1);
    assert.equal(suite.status, 'FAILED', `exit-zero named failure was ${suite.status}`);
    assert.equal(result.status, 1);
    assert.equal(report.suites.failed, 1);
    assert.match(fs.readFileSync(path.join(root, 'runtime/rc-regression', suite.log), 'utf8'), /FAIL synthetic named failure/);
  });
});

check('actual runner detects a colored stderr failure after stdout without a newline', () => {
  withRunner('process.stdout.write("PASS unterminated output"); console.error("\\u001b[31mFAIL stderr check\\u001b[0m");\n', (result, report) => {
    const suite = report.results.find((entry: any) => entry.suite === 'scripts/testFixture.ts');
    assert.equal(suite.exitCode, 0);
    assert.equal(suite.status, 'FAILED');
    assert.equal(result.status, 1);
    assert.equal(suite.passed, 1);
    assert.equal(suite.failed, 1);
  });
});

check('actual runner counts PASS labels mentioning skip and counts only leading skip markers', () => {
  const output = ['PASS rejects skip option', '✓ skipped alias is rejected', '[PASS] literal [SKIP] label remains a pass',
    'SKIP unavailable synthetic feature', '[SKIP] another unavailable synthetic feature',
    'diagnostic mentions [SKIP] without a result marker', '✓ All Release Gate verification invariants SATISFIED.'];
  withRunner(`console.log(${JSON.stringify(output.join('\n'))});\n`, (result, report) => {
    const suite = report.results.find((entry: any) => entry.suite === 'scripts/testFixture.ts');
    assert.equal(result.status, 0);
    assert.equal(suite.status, 'PASSED');
    assert.equal(suite.passed, 3);
    assert.equal(suite.failed, 0);
    assert.equal(suite.skipped, 2);
    assert.equal(report.assertions.passed, 4); // Three fixture checks plus the QA control.
  });
});

check('actual runner preserves successful suites with zero named check outputs', () => {
  withRunner('console.log("Synthetic suite completed without named markers");\n', (result, report) => {
    const suite = report.results.find((entry: any) => entry.suite === 'scripts/testFixture.ts');
    assert.equal(result.status, 0);
    assert.equal(suite.status, 'PASSED');
    assert.deepEqual([suite.passed, suite.failed, suite.skipped], [0, 0, 0]);
    assert.equal(report.schemaVersion, '2.0');
    assert.equal(report.countingVersion, 'NAMED_CHECK_PREFIXES/2');
    assert.deepEqual(suite.failureReasons, []);
  });
});

check('actual runner rejects a nonzero child even when its named checks pass', () => {
  withRunner('console.log("PASS synthetic check before exit"); process.exitCode = 7;\n', (result, report) => {
    const suite = report.results.find((entry: any) => entry.suite === 'scripts/testFixture.ts');
    assert.equal(result.status, 1);
    assert.equal(suite.exitCode, 7);
    assert.equal(suite.status, 'FAILED');
    assert.equal(suite.passed, 1);
    assert.equal(suite.failed, 1);
  });
});

check('actual runner rejects changed protected evidence and preserves the failed child log', () => {
  withRunner('import fs from "node:fs"; fs.writeFileSync("docs/07_verification/rc-regression/results.json", "tampered synthetic evidence"); console.log("PASS child exited normally");\n', (result, report, root) => {
    const suite = report.results.find((entry: any) => entry.suite === 'scripts/testFixture.ts');
    assert.equal(result.status, 1);
    assert.equal(suite.exitCode, 0);
    assert.equal(suite.status, 'FAILED');
    assert.deepEqual(suite.changedEvidence, ['docs/07_verification/rc-regression/results.json']);
    assert.match(fs.readFileSync(path.join(root, 'runtime/rc-regression', suite.log), 'utf8'), /FAIL retained evidence changed/);
    assert.equal(fs.readFileSync(path.join(root, 'docs/07_verification/rc-regression/results.json'), 'utf8'), 'tampered synthetic evidence');
  });
});

check('all supported leading failure markers reject even when their labels mention skip', () => {
  const outcome = classifyRegressionResult('✗ skip forbidden\n❌ skipped branch\nFAIL skipped request\n[FAIL] skipped route\n', { status: 0 }, []);
  assert.equal(outcome.status, 'FAILED');
  assert.deepEqual([outcome.passed, outcome.failed, outcome.skipped], [0, 4, 0]);
  assert.deepEqual(outcome.failureReasons, ['NAMED_FAILURE']);
});

check('a real timeout rejects partial successful output and records its process cause', () => {
  const child = spawnSync(process.execPath, ['-e', 'console.log("PASS before timeout"); setInterval(() => {}, 1000);'], {
    windowsHide: true, encoding: 'utf8', timeout: 500,
  });
  assert.equal((child.error as NodeJS.ErrnoException | undefined)?.code, 'ETIMEDOUT');
  const outcome = classifyRegressionResult(child.stdout || '', child, []);
  assert.equal(outcome.status, 'FAILED');
  assert.equal(outcome.failed, 1);
  assert.ok(outcome.failureReasons.includes('TIMEOUT'));
});

check('real process termination cannot be accepted as a successful suite', () => {
  const child = spawnSync(process.execPath, ['-e', 'process.kill(process.pid, "SIGTERM");'], {
    windowsHide: true, encoding: 'utf8', timeout: 5000,
  });
  assert.ok(child.signal || child.status !== 0);
  const outcome = classifyRegressionResult(child.stdout || '', child, []);
  assert.equal(outcome.status, 'FAILED');
  assert.equal(outcome.failed, 1);
});

check('a real spawn error rejects a suite with no named failure output', () => {
  const child = spawnSync(path.join(sourceRoot, 'node_modules', '.nonexistent-regression-node'), [], { windowsHide: true, encoding: 'utf8', timeout: 1000 });
  assert.equal((child.error as NodeJS.ErrnoException | undefined)?.code, 'ENOENT');
  const outcome = classifyRegressionResult('', child, []);
  assert.equal(outcome.status, 'FAILED');
  assert.equal(outcome.failed, 1);
  assert.ok(outcome.failureReasons.includes('PROCESS_ERROR'));
});

check('process error, signal and evidence drift each override an otherwise zero exit', () => {
  const outcomes = [
    classifyRegressionResult('PASS check\n', { status: 0, error: { message: 'synthetic process error' } }, []),
    classifyRegressionResult('PASS check\n', { status: 0, signal: 'SIGTERM' }, []),
    classifyRegressionResult('PASS check\n', { status: 0 }, ['synthetic/evidence.json']),
    classifyRegressionResult('PASS check\n', { status: null }, []),
  ];
  for (const outcome of outcomes) {
    assert.equal(outcome.status, 'FAILED');
    assert.deepEqual([outcome.passed, outcome.failed], [1, 1]);
  }
  assert.ok(outcomes[0].failureReasons.includes('PROCESS_ERROR'));
  assert.ok(outcomes[1].failureReasons.includes('PROCESS_SIGNAL'));
  assert.ok(outcomes[2].failureReasons.includes('RETAINED_EVIDENCE_CHANGED'));
  assert.ok(outcomes[3].failureReasons.includes('MISSING_EXIT_STATUS'));
});

check('named failures are not counted again for concurrent process and evidence causes', () => {
  const outcome = classifyRegressionResult('FAIL first\n[FAIL] second\n', { status: 8, signal: 'SIGTERM', error: { message: 'timeout', code: 'ETIMEDOUT' } }, ['synthetic/evidence']);
  assert.equal(outcome.status, 'FAILED');
  assert.deepEqual([outcome.passed, outcome.failed, outcome.skipped], [0, 2, 0]);
  assert.deepEqual(outcome.failureReasons, ['NAMED_FAILURE', 'NONZERO_EXIT', 'PROCESS_SIGNAL', 'TIMEOUT', 'RETAINED_EVIDENCE_CHANGED']);
});

console.log(`Regression runner checks: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
