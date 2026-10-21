import { stripVTControlCharacters } from 'node:util';

export const REGRESSION_REPORT_SCHEMA_VERSION = '2.0';
export const REGRESSION_COUNTING_VERSION = 'NAMED_CHECK_PREFIXES/2';
export const REGRESSION_COUNTING_DESCRIPTION = 'Observed leading PASS/FAIL/SKIP markers (including check/cross glyphs and bracketed markers); descriptions do not change the marker. Compound checks may contain multiple Node assertions. Historical banner totals are not used; the legacy Release Gate success summary is excluded. A process/evidence failure contributes at least one failed check, without double-counting named failures.';

interface SuiteExecution {
  status: number | null;
  signal?: string | null;
  error?: { message: string; code?: string };
}

export function classifyRegressionResult(output: string, execution: SuiteExecution, changedEvidence: readonly string[]) {
  let passed = 0;
  let namedFailures = 0;
  let skipped = 0;
  for (const rawLine of output.split(/\r?\n/)) {
    const line = stripVTControlCharacters(rawLine).trimStart();
    if (/^(?:✗|❌|FAIL\b|\[FAIL\])/.test(line)) namedFailures++;
    else if (/^(?:SKIP\b|\[SKIP\])/.test(line)) skipped++;
    else if (/^(?:✓|✅|PASS\b|\[PASS\])/.test(line)
      && !/^✓ All Release Gate verification invariants/.test(line)) passed++;
  }

  const failureReasons: string[] = [];
  if (namedFailures > 0) failureReasons.push('NAMED_FAILURE');
  if (execution.status === null) failureReasons.push('MISSING_EXIT_STATUS');
  else if (execution.status !== 0) failureReasons.push('NONZERO_EXIT');
  if (execution.signal) failureReasons.push('PROCESS_SIGNAL');
  if (execution.error) failureReasons.push(execution.error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'PROCESS_ERROR');
  if (changedEvidence.length > 0) failureReasons.push('RETAINED_EVIDENCE_CHANGED');

  return {
    status: failureReasons.length ? 'FAILED' as const : 'PASSED' as const,
    passed,
    failed: Math.max(namedFailures, failureReasons.length ? 1 : 0),
    skipped,
    failureReasons,
  };
}
