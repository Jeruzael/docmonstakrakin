import { AuditEvent, SecretRedactionRule } from '../../src/types.ts';

export const DEFAULT_REDACTION_RULES: SecretRedactionRule[] = [
  // Google / Gemini API Keys (AIza followed by 30 to 45 alphanumeric/dash/underscore chars)
  { pattern: /AIza[0-9A-Za-z-_]{30,45}/g, mask: '[REDACTED_SECRET]' },
  // Generic / OpenAI-style secret keys (sk-, sk-proj-, etc.)
  { pattern: /sk-(?:proj-)?[a-zA-Z0-9_-]{20,}/g, mask: '[REDACTED_SECRET]' },
  // GitHub PAT / OAuth tokens
  { pattern: /ghp_[a-zA-Z0-9]{30,45}/g, mask: '[REDACTED_SECRET]' },
  { pattern: /github_pat_[a-zA-Z0-9_]{40,}/g, mask: '[REDACTED_SECRET]' },
  // Slack tokens
  { pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g, mask: '[REDACTED_SECRET]' },
  // Bearer JWT / OAuth headers
  { pattern: /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, mask: 'Bearer [REDACTED_SECRET]' },
  // Key-value pairs in logs (e.g. apiKey="...", password=...)
  { pattern: /(["']?(?:api[_-]?key|password|secret|token|credential|auth)["']?\s*[:=]\s*["'])([^"'\s]{4,})(["'])/gi, mask: '$1[REDACTED_SECRET]$3' },
];

export class SecretRedactor {
  private rules: SecretRedactionRule[];
  private dynamicSecrets: Set<string>;
  private isConsolePatched = false;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null = null;

  constructor(customRules: SecretRedactionRule[] = []) {
    this.rules = [...DEFAULT_REDACTION_RULES, ...customRules];
    this.dynamicSecrets = new Set<string>();
  }

  /**
   * Registers a specific plaintext secret value to be dynamically redacted.
   * Ignores short or trivial strings (< 4 chars) to prevent over-redaction.
   */
  public registerSecret(secretValue: string): void {
    if (secretValue && typeof secretValue === 'string' && secretValue.trim().length >= 4) {
      this.dynamicSecrets.add(secretValue.trim());
    }
  }

  /**
   * Unregisters a secret from dynamic redaction (e.g. after rotation/deletion).
   */
  public unregisterSecret(secretValue: string): void {
    if (secretValue) {
      this.dynamicSecrets.delete(secretValue.trim());
    }
  }

  /**
   * Clears all registered dynamic secrets.
   */
  public clearDynamicSecrets(): void {
    this.dynamicSecrets.clear();
  }

  /**
   * Redacts any sensitive patterns or registered dynamic secrets from a string.
   */
  public redactString(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let sanitized = text;

    // 1. Apply static regex rules
    for (const rule of this.rules) {
      sanitized = sanitized.replace(rule.pattern, rule.mask);
    }

    // 2. Apply registered dynamic secret values
    for (const secret of this.dynamicSecrets) {
      if (sanitized.includes(secret)) {
        // Escape special regex characters in the secret value
        const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        sanitized = sanitized.replace(new RegExp(escaped, 'g'), '[REDACTED_SECRET]');
      }
    }

    return sanitized;
  }

  /**
   * Recursively redacts sensitive patterns in any object, array, or primitive.
   * Sensitive object keys (e.g. 'password', 'apiKey') have their values masked unconditionally.
   */
  public redactObject<T>(input: T, seen = new WeakSet()): T {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      return this.redactString(input) as unknown as T;
    }

    if (typeof input !== 'object') {
      return input;
    }

    // Prevent cyclic recursion
    if (seen.has(input as object)) {
      return '[Circular]' as unknown as T;
    }
    seen.add(input as object);

    if (Array.isArray(input)) {
      return input.map((item) => this.redactObject(item, seen)) as unknown as T;
    }

    const sensitiveKeyPattern = /^(?:api[_-]?key|password|client_?secret|private_?key|auth_?token|credential|secret)$/i;
    const output: Record<string, any> = {};

    for (const [key, val] of Object.entries(input as Record<string, any>)) {
      if (sensitiveKeyPattern.test(key) && typeof val === 'string') {
        output[key] = '[REDACTED_SECRET]';
      } else {
        output[key] = this.redactObject(val, seen);
      }
    }

    return output as T;
  }

  /**
   * Sanitizes an AuditEvent record before appending to the audit log or disk.
   */
  public sanitizeAuditEvent(event: AuditEvent): AuditEvent {
    return {
      ...event,
      target: this.redactString(event.target),
      reason: event.reason ? this.redactString(event.reason) : undefined,
      details: event.details ? this.redactObject(event.details) : undefined,
    };
  }

  /**
   * Installs automatic redaction on global console logging methods.
   */
  public installConsoleInterceptor(): void {
    if (this.isConsolePatched) return;

    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    const wrapMethod = (origFn: (...args: any[]) => void) => {
      return (...args: any[]) => {
        const sanitizedArgs = args.map((arg) => {
          if (typeof arg === 'string') {
            return this.redactString(arg);
          }
          if (typeof arg === 'object' && arg !== null) {
            return this.redactObject(arg);
          }
          return arg;
        });
        origFn.apply(console, sanitizedArgs);
      };
    };

    console.log = wrapMethod(this.originalConsole.log);
    console.info = wrapMethod(this.originalConsole.info);
    console.warn = wrapMethod(this.originalConsole.warn);
    console.error = wrapMethod(this.originalConsole.error);

    this.isConsolePatched = true;
  }

  /**
   * Restores original console methods (for testing).
   */
  public restoreConsoleInterceptor(): void {
    if (!this.isConsolePatched || !this.originalConsole) return;

    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;

    this.originalConsole = null;
    this.isConsolePatched = false;
  }
}

// Default singleton redactor
export const defaultRedactor = new SecretRedactor();
