import {randomBytes} from 'node:crypto';
import {SyntheticSecurityError} from './contracts.ts';

export const KDF_PROFILE = Object.freeze({type: 2 as const, version: 0x13, memoryCost: 32768, timeCost: 3, parallelism: 1, hashLength: 32});
export interface NativeKdf {
  hash(password: string, options: typeof KDF_PROFILE & {salt: Buffer}): Promise<string>;
  verify(verifier: string, password: string): Promise<boolean>;
}
export function validVerifier(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 128) return false;
  const parts = /^\$argon2id\$v=19\$m=32768,p=1,t=3\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(value);
  return !!parts && [16, 32].every((length, index) => {
    const encoded = parts[index + 1], decoded = Buffer.from(encoded, 'base64');
    return decoded.length === length && decoded.toString('base64').replace(/=/g, '') === encoded;
  });
}
// Disposable-fixture input budget only: no normalization, migration, enrollment
// or operational password-policy acceptance follows from this bound.
const validPassword = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 1024;
type Job = {run: () => Promise<any>; resolve: (value: any) => void; reject: (error: Error) => void; signal?: AbortSignal; abort?: () => void; timer?: ReturnType<typeof setTimeout>; active: boolean; settled: boolean};

/** Limits are candidate fixture bounds, not an operational capacity acceptance. */
export class BoundedVerifier {
  private active = 0;
  private queue: Job[] = [];
  private readonly waitMs: number;
  constructor(private readonly native: NativeKdf, options: {queuedWaitMs?: number} = {}) {
    this.waitMs = options.queuedWaitMs ?? 2000;
    if (!Number.isSafeInteger(this.waitMs) || this.waitMs < 1 || this.waitMs > 2000) throw new SyntheticSecurityError('KDF_CONFIG_INVALID');
  }
  stats() { return {active: this.active, queued: this.queue.length}; }
  async hash(password: string, options: {signal?: AbortSignal} = {}): Promise<string> {
    if (!validPassword(password)) throw new SyntheticSecurityError('KDF_INPUT_INVALID');
    return this.admit(async () => {
      const result = await this.native.hash(password, {...KDF_PROFILE, salt: randomBytes(16)});
      if (!validVerifier(result)) throw new SyntheticSecurityError('KDF_UNAVAILABLE');
      return result;
    }, options.signal);
  }
  async verify(verifier: string, password: string, options: {signal?: AbortSignal} = {}): Promise<boolean> {
    if (!validVerifier(verifier) || !validPassword(password)) return false;
    return this.admit(() => this.native.verify(verifier, password), options.signal);
  }
  private admit(run: () => Promise<any>, signal?: AbortSignal): Promise<any> {
    if (signal?.aborted) return Promise.reject(new SyntheticSecurityError('KDF_ABORTED'));
    if (this.active >= 2 && this.queue.length >= 4) return Promise.reject(new SyntheticSecurityError('KDF_OVERLOADED'));
    return new Promise((resolve, reject) => {
      const job: Job = {run, resolve, reject, signal, active: false, settled: false};
      const cancel = (code: string) => {
        if (job.settled) return;
        job.settled = true; job.reject(new SyntheticSecurityError(code));
        if (!job.active) { this.queue = this.queue.filter(item => item !== job); this.detach(job); }
        // Native Argon2 cannot be canceled: its active budget is retained.
      };
      job.abort = () => cancel('KDF_ABORTED');
      signal?.addEventListener('abort', job.abort, {once: true});
      if (this.active < 2) this.start(job);
      else { this.queue.push(job); job.timer = setTimeout(() => cancel('KDF_QUEUE_TIMEOUT'), this.waitMs); }
    });
  }
  private detach(job: Job) { if (job.timer) clearTimeout(job.timer); if (job.abort) job.signal?.removeEventListener('abort', job.abort); }
  private start(job: Job) {
    job.active = true; this.active++; if (job.timer) clearTimeout(job.timer);
    const complete = () => {
      this.detach(job); this.active--;
      while (this.active < 2 && this.queue.length) this.start(this.queue.shift()!);
    };
    Promise.resolve().then(job.run).then(value => {
      complete(); if (!job.settled) { job.settled = true; job.resolve(value); }
    }, () => {
      complete(); if (!job.settled) { job.settled = true; job.reject(new SyntheticSecurityError('KDF_UNAVAILABLE')); }
    });
  }
}
