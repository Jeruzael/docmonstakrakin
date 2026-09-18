import path from 'node:path';

/**
 * SEC-CTRL-011: Path Boundary & Traversal Defense
 * OWASP ASVS V12.3: File Execution and Path Traversal
 *
 * Enforces workspace confinement, canonicalizes paths, and evaluates
 * deny-precedence rules before any filesystem or repository operation.
 */

export interface PathValidationResult {
  safe: boolean;
  canonicalPath: string;
  relativePath: string;
  error?: string;
  matchedDenyRule?: string;
}

/**
 * Deny patterns with absolute precedence over allow lists.
 * Any path matching these patterns is immediately blocked.
 */
export const DENIED_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /(?:^|[/\\])secrets(?:[/\\]|$)/i, description: 'Secret storage directory access' },
  { pattern: /(?:^|[/\\])\.test_secret_store(?:[/\\]|$)/i, description: 'Test secret store access' },
  { pattern: /(?:^|[/\\])private_keys(?:[/\\]|$)/i, description: 'Private key directory access' },
  { pattern: /(?:^|[/\\])\.env(?:\.[a-zA-Z0-9_-]+)*$/i, description: 'Plaintext environment file access' },
  { pattern: /(?:^|[/\\])\.git[/\\](?:config|credentials|hooks)/i, description: 'Sensitive Git internal configuration' },
  { pattern: /\.(?:key|pem|p12|pfx|pkcs12)$/i, description: 'Cryptographic certificate/key file' },
  { pattern: /(?:^|[/\\])(?:etc|proc|sys|dev|root)(?:[/\\]|$)/i, description: 'Operating system sensitive paths' },
];

/**
 * Exceptions to deny patterns (e.g., .env.example is public documentation)
 */
export const ALLOWED_EXCEPTIONS: RegExp[] = [
  /(?:^|[/\\])\.env\.example$/i,
];

/**
 * Canonicalizes, decodes, and validates a relative or absolute target path
 * against the workspace root.
 */
export function sanitizeAndResolvePath(
  rawPath: string,
  customWorkspaceRoot?: string
): PathValidationResult {
  const workspaceRoot = path.resolve(customWorkspaceRoot || process.cwd());

  if (!rawPath || typeof rawPath !== 'string') {
    return {
      safe: false,
      canonicalPath: '',
      relativePath: '',
      error: 'Invalid path: path must be a non-empty string',
    };
  }

  // 1. Check for null-byte injections (poison null byte attack)
  if (rawPath.includes('\0') || rawPath.includes('%00')) {
    return {
      safe: false,
      canonicalPath: '',
      relativePath: '',
      error: 'Path traversal attempt detected: Null-byte injection is strictly prohibited',
      matchedDenyRule: 'NULL_BYTE_INJECTION',
    };
  }

  // 2. Perform URL decoding in case of encoded traversal sequences
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
    // Double decoding check for %252e style evasions
    if (decodedPath.includes('%')) {
      try {
        decodedPath = decodeURIComponent(decodedPath);
      } catch {
        // Keep single decoded if secondary decode fails
      }
    }
  } catch {
    return {
      safe: false,
      canonicalPath: '',
      relativePath: '',
      error: 'Path decoding error: Malformed URI encoding',
    };
  }

  // Check again for null bytes in decoded string
  if (decodedPath.includes('\0')) {
    return {
      safe: false,
      canonicalPath: '',
      relativePath: '',
      error: 'Path traversal attempt detected: Decoded null-byte injection',
      matchedDenyRule: 'NULL_BYTE_INJECTION',
    };
  }

  // 3. Resolve canonical path against workspace root
  let canonicalPath: string;
  if (path.isAbsolute(decodedPath)) {
    canonicalPath = path.normalize(path.resolve(decodedPath));
  } else {
    canonicalPath = path.normalize(path.resolve(workspaceRoot, decodedPath));
  }

  // 4. Assert workspace confinement boundary
  const relativeFromRoot = path.relative(workspaceRoot, canonicalPath);
  const isContained =
    canonicalPath === workspaceRoot ||
    (!relativeFromRoot.startsWith('..') && !path.isAbsolute(relativeFromRoot));

  if (!isContained) {
    return {
      safe: false,
      canonicalPath,
      relativePath: relativeFromRoot,
      error: `Path traversal attempt detected: Target path escapes workspace boundary (${relativeFromRoot})`,
      matchedDenyRule: 'WORKSPACE_BOUNDARY_ESCAPED',
    };
  }

  // Standardize relative path with forward slashes for pattern matching
  const normalizedRel = relativeFromRoot.replace(/\\/g, '/');

  // 5. Check allowed exceptions
  const isAllowedException = ALLOWED_EXCEPTIONS.some((regex) => regex.test(normalizedRel));

  if (!isAllowedException) {
    // 6. Enforce deny-precedence rules
    for (const rule of DENIED_PATTERNS) {
      if (rule.pattern.test(normalizedRel)) {
        return {
          safe: false,
          canonicalPath,
          relativePath: normalizedRel,
          error: `Security boundary violation: Access to denied path "${normalizedRel}" blocked (${rule.description})`,
          matchedDenyRule: rule.description,
        };
      }
    }
  }

  return {
    safe: true,
    canonicalPath,
    relativePath: normalizedRel,
  };
}

/**
 * Asserts that a target path is safe and within workspace boundaries.
 * Throws a SecurityError if validation fails.
 */
export function assertWorkspacePath(rawPath: string, customWorkspaceRoot?: string): string {
  const result = sanitizeAndResolvePath(rawPath, customWorkspaceRoot);
  if (!result.safe) {
    const err = new Error(result.error || 'Security path validation failed');
    (err as any).code = 'ERR_SECURITY_PATH_TRAVERSAL';
    (err as any).matchedRule = result.matchedDenyRule;
    throw err;
  }
  return result.canonicalPath;
}
