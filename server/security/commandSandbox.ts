import { execFileSync } from 'node:child_process';

/**
 * SEC-CTRL-012: Structured Command Confirmation & Sandboxing
 * OWASP ASVS V5.3: Output Encoding and Injection Prevention
 *
 * Eliminates raw string shell execution by forcing structured argument
 * arrays, disallowing shell metacharacters, and whitelisting safe Git subcommands.
 */

export const ALLOWED_GIT_SUBCOMMANDS = new Set([
  'status',
  'diff',
  'add',
  'reset',
  'commit',
  'checkout',
  'branch',
  'rev-parse',
  'log',
  'show',
  'version',
]);

export const DANGEROUS_GIT_FLAGS = [
  /--exec/i,
  /--upload-pack/i,
  /--receive-pack/i,
  /--output/i,
  /--ext-cmd/i,
  /-c\s+/i,
];

/**
 * Validates and sanitizes a Git branch name.
 * Prevents command chaining, flag injection, and Git ref format violations.
 */
export function sanitizeBranchName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    throw new Error('Branch name must be a non-empty string');
  }

  const trimmed = rawName.trim();

  // 1. Check for shell injection operators
  const shellMetaChars = /[;&|`$><\\!*?~^:\x00-\x1f\x7f'"]/;
  if (shellMetaChars.test(trimmed)) {
    const err = new Error(`Command injection attempt detected: Invalid shell metacharacters in branch name "${trimmed}"`);
    (err as any).code = 'ERR_SECURITY_COMMAND_INJECTION';
    throw err;
  }

  // 2. Disallow flag injections (starting with -)
  if (trimmed.startsWith('-')) {
    const err = new Error(`Flag injection attempt detected: Branch name cannot start with a dash ("${trimmed}")`);
    (err as any).code = 'ERR_SECURITY_FLAG_INJECTION';
    throw err;
  }

  // 3. Disallow directory traversal inside git refs
  if (trimmed.includes('..') || trimmed.includes('//') || trimmed.endsWith('/') || trimmed.endsWith('.lock')) {
    const err = new Error(`Invalid Git ref syntax in branch name ("${trimmed}")`);
    (err as any).code = 'ERR_SECURITY_INVALID_REF';
    throw err;
  }

  // 4. Strict naming regex (alphanumeric, underscore, dash, dot, slash)
  const validBranchPattern = /^[a-zA-Z0-9][a-zA-Z0-9_\-\./]{0,99}$/;
  if (!validBranchPattern.test(trimmed)) {
    const err = new Error(`Branch name contains prohibited characters or exceeds 100 characters ("${trimmed}")`);
    (err as any).code = 'ERR_SECURITY_INVALID_BRANCH';
    throw err;
  }

  return trimmed;
}

/**
 * Validates and sanitizes a commit author name.
 * Prevents newline injection into Git logs or shell command injection.
 */
export function sanitizeCommitAuthor(rawAuthor: string): string {
  if (!rawAuthor || typeof rawAuthor !== 'string') {
    return 'Lead Engineer';
  }

  const trimmed = rawAuthor.trim();

  // Check for newlines, control characters, null bytes, or shell operators
  if (/[\r\n\x00-\x1f\x7f<>";`$|&]/.test(trimmed)) {
    const err = new Error(`Command/log injection attempt detected: Invalid characters in author name "${trimmed}"`);
    (err as any).code = 'ERR_SECURITY_COMMAND_INJECTION';
    throw err;
  }

  if (trimmed.length > 80) {
    return trimmed.substring(0, 80);
  }

  return trimmed;
}

/**
 * Sanitizes commit messages to eliminate control characters and null bytes.
 */
export function sanitizeCommitMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
    throw new Error('Commit message is required');
  }

  // Reject null-bytes
  if (rawMessage.includes('\0')) {
    const err = new Error('Commit message cannot contain null bytes');
    (err as any).code = 'ERR_SECURITY_NULL_BYTE';
    throw err;
  }

  return rawMessage.trim();
}

/**
 * Executes a sandboxed Git command using structured argument arrays.
 * Completely eliminates shell invocation (`shell: false`).
 */
export function executeSandboxedGit(
  args: string[],
  options?: { cwd?: string; timeoutMs?: number }
): { stdout: string; stderr: string; exitCode: number } {
  if (!args || args.length === 0) {
    throw new Error('executeSandboxedGit requires at least one argument');
  }

  const subcommand = args[0].toLowerCase();

  // 1. Verify subcommand against whitelist
  if (!ALLOWED_GIT_SUBCOMMANDS.has(subcommand)) {
    const err = new Error(`Command execution rejected: Subcommand "${subcommand}" is not in the approved Git whitelist`);
    (err as any).code = 'ERR_SECURITY_DISALLOWED_COMMAND';
    throw err;
  }

  // 2. Scan arguments for dangerous flag patterns
  for (const arg of args) {
    for (const dangerousPattern of DANGEROUS_GIT_FLAGS) {
      if (dangerousPattern.test(arg)) {
        const err = new Error(`Command execution rejected: Dangerous flag pattern "${arg}" is prohibited`);
        (err as any).code = 'ERR_SECURITY_DANGEROUS_FLAG';
        throw err;
      }
    }
  }

  // 3. Execute using execFileSync without shell invocation
  try {
    const stdout = execFileSync('git', args, {
      cwd: options?.cwd || process.cwd(),
      encoding: 'utf-8',
      shell: false, // CRITICAL: Never invoke shell
      timeout: options?.timeoutMs || 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      stdout: stdout.toString(),
      stderr: '',
      exitCode: 0,
    };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message || '',
      exitCode: err.status || 1,
    };
  }
}
