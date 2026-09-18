import assert from 'node:assert';
import path from 'node:path';
import {
  sanitizeAndResolvePath,
  assertWorkspacePath,
} from './pathBoundary.js';
import {
  sanitizeBranchName,
  sanitizeCommitAuthor,
  sanitizeCommitMessage,
  executeSandboxedGit,
} from './commandSandbox.js';
import {
  computeAuditEventHash,
  createChainedAuditEvent,
  verifyAuditLedgerChain,
  GENESIS_AUDIT_HASH,
} from './auditImmutability.js';
import type { AuditEvent } from '../../src/types.js';

console.log('=== Running DMK-159 Comprehensive Security Regression Test Suite ===');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// =========================================================================
// SECTION 1: Path Traversal Attack Suite (SEC-CTRL-011 / OWASP ASVS V12.3)
// =========================================================================
console.log('\n--- Section 1: Path Traversal Attack Defense Suite ---');

const MOCK_WORKSPACE = '/app/workspace';

runTest('Detects and blocks standard parent directory traversal (../../etc/passwd)', () => {
  const result = sanitizeAndResolvePath('../../etc/passwd', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'WORKSPACE_BOUNDARY_ESCAPED');
  assert.throws(() => assertWorkspacePath('../../etc/passwd', MOCK_WORKSPACE), /escapes workspace boundary/);
});

runTest('Detects and blocks deep traversal attack (../../../../../../etc/shadow)', () => {
  const result = sanitizeAndResolvePath('../../../../../../etc/shadow', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'WORKSPACE_BOUNDARY_ESCAPED');
});

runTest('Detects and blocks Windows-style backslash traversal (..\\..\\windows\\system.ini)', () => {
  const result = sanitizeAndResolvePath('..\\..\\windows\\system.ini', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'WORKSPACE_BOUNDARY_ESCAPED');
});

runTest('Detects and blocks single URL-encoded traversal (%2e%2e%2fetc%2fpasswd)', () => {
  const result = sanitizeAndResolvePath('%2e%2e%2fetc%2fpasswd', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'WORKSPACE_BOUNDARY_ESCAPED');
});

runTest('Detects and blocks double URL-encoded traversal (%252e%252e%252fetc%252fpasswd)', () => {
  const result = sanitizeAndResolvePath('%252e%252e%252fetc%252fpasswd', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'WORKSPACE_BOUNDARY_ESCAPED');
});

runTest('Detects and blocks raw poison null-byte injection (src/App.tsx\\0/etc/passwd)', () => {
  const result = sanitizeAndResolvePath('src/App.tsx\0/etc/passwd', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'NULL_BYTE_INJECTION');
  assert.throws(() => assertWorkspacePath('src/App.tsx\0/etc/passwd', MOCK_WORKSPACE), /Null-byte injection/);
});

runTest('Detects and blocks URL-encoded null-byte injection (%00)', () => {
  const result = sanitizeAndResolvePath('docs/ROADMAP.md%00.png', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'NULL_BYTE_INJECTION');
});

runTest('Detects and blocks absolute root filesystem paths outside workspace (/etc/passwd)', () => {
  const result = sanitizeAndResolvePath('/etc/passwd', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.strictEqual(result.matchedDenyRule, 'WORKSPACE_BOUNDARY_ESCAPED');
});

runTest('Blocks access to restricted secrets directory (secrets/vault.enc)', () => {
  const result = sanitizeAndResolvePath('secrets/vault.enc', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.ok(result.error?.includes('Secret storage directory access'));
});

runTest('Blocks access to test secret storage (.test_secret_store/key.enc)', () => {
  const result = sanitizeAndResolvePath('.test_secret_store/key.enc', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.ok(result.error?.includes('Test secret store access'));
});

runTest('Blocks access to plaintext environment file (.env)', () => {
  const result = sanitizeAndResolvePath('.env', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.ok(result.error?.includes('Plaintext environment file access'));
});

runTest('Blocks access to custom environment files (.env.local, .env.production)', () => {
  const res1 = sanitizeAndResolvePath('.env.local', MOCK_WORKSPACE);
  const res2 = sanitizeAndResolvePath('.env.production', MOCK_WORKSPACE);
  assert.strictEqual(res1.safe, false);
  assert.strictEqual(res2.safe, false);
});

runTest('Blocks access to internal Git config & credentials (.git/config)', () => {
  const result = sanitizeAndResolvePath('.git/config', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, false);
  assert.ok(result.error?.includes('Sensitive Git internal configuration'));
});

runTest('Allows safe paths inside workspace (src/App.tsx, docs/MASTER_PLAN.md)', () => {
  const res1 = sanitizeAndResolvePath('src/App.tsx', MOCK_WORKSPACE);
  const res2 = sanitizeAndResolvePath('docs/MASTER_PLAN.md', MOCK_WORKSPACE);
  assert.strictEqual(res1.safe, true);
  assert.strictEqual(res2.safe, true);
  assert.strictEqual(res1.relativePath, 'src/App.tsx');
  assert.strictEqual(res2.relativePath, 'docs/MASTER_PLAN.md');
});

runTest('Allows approved documentation exception (.env.example)', () => {
  const result = sanitizeAndResolvePath('.env.example', MOCK_WORKSPACE);
  assert.strictEqual(result.safe, true);
  assert.strictEqual(result.relativePath, '.env.example');
});

// =========================================================================
// SECTION 2: Command Sandboxing & Injection Defense Suite (SEC-CTRL-012)
// =========================================================================
console.log('\n--- Section 2: Command Sandboxing & Injection Defense Suite ---');

runTest('Rejects branch name with semicolon command chaining (main; rm -rf /)', () => {
  assert.throws(() => sanitizeBranchName('main; rm -rf /'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
});

runTest('Rejects branch name with boolean AND command chaining (main && curl evil.com)', () => {
  assert.throws(() => sanitizeBranchName('main && curl evil.com'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
});

runTest('Rejects branch name with pipe chaining (main | cat /etc/passwd)', () => {
  assert.throws(() => sanitizeBranchName('main | cat /etc/passwd'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
});

runTest('Rejects branch name with subshell execution substitution (main$(id))', () => {
  assert.throws(() => sanitizeBranchName('main$(id)'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
});

runTest('Rejects branch name with backtick command substitution (main`whoami`)', () => {
  assert.throws(() => sanitizeBranchName('main`whoami`'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
});

runTest('Rejects branch name with output redirection (main > /tmp/hacked)', () => {
  assert.throws(() => sanitizeBranchName('main > /tmp/hacked'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
});

runTest('Rejects branch name with newline command injection (feature/test\\nid)', () => {
  assert.throws(() => sanitizeBranchName('feature/test\nid'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
});

runTest('Rejects branch name starting with dash (flag injection attempt: --upload-pack)', () => {
  assert.throws(() => sanitizeBranchName('--upload-pack=exploit'), (err: any) => {
    return err.code === 'ERR_SECURITY_FLAG_INJECTION';
  });
});

runTest('Rejects branch name with Git ref directory traversal (feature/../main)', () => {
  assert.throws(() => sanitizeBranchName('feature/../main'), (err: any) => {
    return err.code === 'ERR_SECURITY_INVALID_REF';
  });
});

runTest('Sanitizes author names and rejects newline / shell injections', () => {
  assert.throws(() => sanitizeCommitAuthor('Lead Engineer\nMalicious User'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
  assert.throws(() => sanitizeCommitAuthor('Engineer; rm -rf /'), (err: any) => {
    return err.code === 'ERR_SECURITY_COMMAND_INJECTION';
  });
  const safe = sanitizeCommitAuthor('Lead Architect (Control Plane)');
  assert.strictEqual(safe, 'Lead Architect (Control Plane)');
});

runTest('Accepts valid Git branch names', () => {
  assert.strictEqual(sanitizeBranchName('feature/DMK-159-security-suite'), 'feature/DMK-159-security-suite');
  assert.strictEqual(sanitizeBranchName('fix_auth-token.v2'), 'fix_auth-token.v2');
  assert.strictEqual(sanitizeBranchName('v0.1.0-rc1'), 'v0.1.0-rc1');
});

runTest('executeSandboxedGit rejects unapproved Git subcommands (config, clone, push)', () => {
  assert.throws(() => executeSandboxedGit(['config', '--get', 'user.email']), (err: any) => {
    return err.code === 'ERR_SECURITY_DISALLOWED_COMMAND';
  });
  assert.throws(() => executeSandboxedGit(['push', 'origin', 'main']), (err: any) => {
    return err.code === 'ERR_SECURITY_DISALLOWED_COMMAND';
  });
});

runTest('executeSandboxedGit rejects dangerous flag patterns (--upload-pack)', () => {
  assert.throws(() => executeSandboxedGit(['fetch', '--upload-pack=calc.exe']), (err: any) => {
    return err.code === 'ERR_SECURITY_DISALLOWED_COMMAND'; // fetch not allowed
  });
  assert.throws(() => executeSandboxedGit(['diff', '--output=/etc/shadow']), (err: any) => {
    return err.code === 'ERR_SECURITY_DANGEROUS_FLAG';
  });
});

// =========================================================================
// SECTION 3: Cryptographic Audit Ledger Immutability Suite (SEC-CTRL-013)
// =========================================================================
console.log('\n--- Section 3: Audit Ledger Immutability & Tamper Detection Suite ---');

runTest('Generates sequential cryptographic hash chain linking consecutive events', () => {
  const ev1 = createChainedAuditEvent({
    actor: 'Lead Architect',
    action: 'REQUIREMENT_APPROVED',
    target: 'REQ-SEC-011',
    reason: 'Initial ratification',
  });

  const ev2 = createChainedAuditEvent({
    actor: 'Security Officer',
    action: 'CONTROL_VERIFIED',
    target: 'SEC-CTRL-011',
    reason: 'Verified path traversal defenses',
    previousEvent: ev1,
  });

  const ev3 = createChainedAuditEvent({
    actor: 'CI Test Harness',
    action: 'TEST_PASSED',
    target: 'TEST-159',
    reason: 'All regression tests passing',
    previousEvent: ev2,
  });

  assert.strictEqual(ev1.previousHash, GENESIS_AUDIT_HASH);
  assert.strictEqual(ev2.previousHash, ev1.stateHash);
  assert.strictEqual(ev3.previousHash, ev2.stateHash);

  const chain = [ev1, ev2, ev3];
  const verification = verifyAuditLedgerChain(chain, 'CHRONOLOGICAL');
  assert.strictEqual(verification.valid, true);
  assert.strictEqual(verification.verifiedCount, 3);
});

runTest('Tamper Detection 1: Fails verification if an event actor is altered', () => {
  const ev1 = createChainedAuditEvent({
    actor: 'Authorized Officer',
    action: 'GATE_OVERRIDE',
    target: 'PHASE-12',
  });
  const ev2 = createChainedAuditEvent({
    actor: 'Developer',
    action: 'COMMIT_CREATED',
    target: 'abc1234',
    previousEvent: ev1,
  });

  // Tamper with ev1's actor retroactively
  const tamperedChain: AuditEvent[] = [
    { ...ev1, actor: 'Attacker Impersonator' },
    ev2,
  ];

  const verification = verifyAuditLedgerChain(tamperedChain, 'CHRONOLOGICAL');
  assert.strictEqual(verification.valid, false);
  assert.strictEqual(verification.brokenIndex, 0);
  assert.ok(verification.error?.includes('Tampered event payload detected'));
});

runTest('Tamper Detection 2: Fails verification if an event timestamp is altered', () => {
  const ev1 = createChainedAuditEvent({
    actor: 'Security Officer',
    action: 'KEY_ROTATED',
    target: 'GEMINI_API_KEY',
  });

  const tamperedChain: AuditEvent[] = [
    { ...ev1, timestamp: '1970-01-01T00:00:00.000Z' },
  ];

  const verification = verifyAuditLedgerChain(tamperedChain, 'CHRONOLOGICAL');
  assert.strictEqual(verification.valid, false);
  assert.ok(verification.error?.includes('Tampered event payload detected'));
});

runTest('Tamper Detection 3: Fails verification if event details payload is altered', () => {
  const ev1 = createChainedAuditEvent({
    actor: 'Admin',
    action: 'SECRET_MIGRATED',
    target: '.env',
    details: { count: 3, keys: ['API_KEY'] },
  });

  const tamperedChain: AuditEvent[] = [
    { ...ev1, details: { count: 3, keys: ['FORGED_KEY'] } },
  ];

  const verification = verifyAuditLedgerChain(tamperedChain, 'CHRONOLOGICAL');
  assert.strictEqual(verification.valid, false);
  assert.ok(verification.error?.includes('Tampered event payload detected'));
});

runTest('Tamper Detection 4: Fails verification if intermediate event is deleted (broken link)', () => {
  const ev1 = createChainedAuditEvent({ actor: 'User1', action: 'A', target: 'T1' });
  const ev2 = createChainedAuditEvent({ actor: 'User2', action: 'B', target: 'T2', previousEvent: ev1 });
  const ev3 = createChainedAuditEvent({ actor: 'User3', action: 'C', target: 'T3', previousEvent: ev2 });

  // Delete ev2
  const brokenChain = [ev1, ev3];
  const verification = verifyAuditLedgerChain(brokenChain, 'CHRONOLOGICAL');
  assert.strictEqual(verification.valid, false);
  assert.strictEqual(verification.brokenIndex, 1);
  assert.ok(verification.error?.includes('Broken chain link'));
});

runTest('Tamper Detection 5: Fails verification if an attacker injects a forged event with spoofed previousHash', () => {
  const ev1 = createChainedAuditEvent({ actor: 'User1', action: 'A', target: 'T1' });
  const ev2 = createChainedAuditEvent({ actor: 'User2', action: 'B', target: 'T2', previousEvent: ev1 });

  // Forged event claiming ev1 as previous, but inserted after ev1 before ev2
  const forgedEvent: AuditEvent = {
    id: 'AUD-FORGED',
    actor: 'Hacker',
    action: 'BACKDOOR_INSTALLED',
    target: 'SYSTEM',
    timestamp: new Date().toISOString(),
    previousHash: ev1.stateHash,
    stateHash: 'invalid-or-unlinked-hash',
  };

  const compromisedChain = [ev1, forgedEvent, ev2];
  const verification = verifyAuditLedgerChain(compromisedChain, 'CHRONOLOGICAL');
  assert.strictEqual(verification.valid, false);
});

console.log(`\n=== ALL DMK-159 SECURITY REGRESSION TESTS PASSED (${passedTests}/${totalTests}) ===`);
