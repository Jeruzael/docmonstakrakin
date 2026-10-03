import fs from 'node:fs';
import path from 'node:path';

function main() {
  const root = process.cwd();
  const resultsPath = path.join(root, 'runtime/rc-regression/results.json');

  if (!fs.existsSync(resultsPath)) {
    console.log('[dumpFailedRegressionLogs] No results.json found at runtime/rc-regression/results.json');
    process.exit(0);
  }

  let report: any;
  try {
    report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch (err: any) {
    console.error(`[dumpFailedRegressionLogs] Failed to parse results.json: ${err?.message || err}`);
    process.exit(0);
  }

  const failedEntries = (report.results || []).filter((r: any) => r.status === 'FAILED');

  if (failedEntries.length === 0) {
    console.log('[dumpFailedRegressionLogs] No failed regression suites found in results.json.');
    process.exit(0);
  }

  console.log(`\n==================================================`);
  console.log(`[dumpFailedRegressionLogs] FOUND ${failedEntries.length} FAILED REGRESSION SUITE(S):`);
  console.log(`==================================================\n`);

  for (const entry of failedEntries) {
    console.log(`--------------------------------------------------`);
    console.log(`FAILED SUITE: ${entry.suite}`);
    console.log(`Exit Code: ${entry.exitCode}`);
    console.log(`Counts: passed=${entry.passed}, failed=${entry.failed}, skipped=${entry.skipped}`);
    if (entry.error) {
      console.log(`Process Error: ${entry.error}`);
    }
    if (entry.changedEvidence && entry.changedEvidence.length > 0) {
      console.log(`Changed Protected Evidence: ${entry.changedEvidence.join(', ')}`);
    }

    const logPath = path.join(root, 'runtime/rc-regression', entry.log || `${entry.suite.replaceAll('/', '_').replace('.ts', '.log')}`);
    console.log(`Log File: ${logPath}`);
    console.log(`--- LOG OUTPUT BEGIN ---`);
    if (fs.existsSync(logPath)) {
      console.log(fs.readFileSync(logPath, 'utf8'));
    } else {
      console.log(`[LOG FILE NOT FOUND ON DISK: ${logPath}]`);
    }
    console.log(`--- LOG OUTPUT END ---\n`);
  }
}

main();
