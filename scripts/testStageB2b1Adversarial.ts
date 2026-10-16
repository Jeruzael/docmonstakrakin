/**
 * Stage B2b1 / PR #39 adversarial security and architecture regression entrypoint.
 * Discovered automatically by scripts/runCompleteRegression.ts in required GitHub CI.
 *
 * Executes all 37 adversarial scenarios in docs/07_verification/pr39_adversarial.ts:
 * - 28 defensive invariant checks ([PASS] [DEFENSE PASS])
 * - 4 bounded in-memory characterizations ([FINDING])
 * - 5 confirmed Stage B2b production limitations ([LIMITATION CONFIRMED])
 * - Fails CI (exit code 1) on any unexpected outcome or count drift.
 */
import '../docs/07_verification/pr39_adversarial.ts';
