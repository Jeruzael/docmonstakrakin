import { WorkspaceSecurityError } from './contracts.ts';

/** Candidate concurrency ceiling, not operational capacity ratification. */
export class WorkspaceAdmission {
  private active = 0;
  constructor(readonly capacity = 4) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 4) throw new WorkspaceSecurityError('WORKSPACE_INPUT_INVALID');
  }
  snapshot(): { active: number; capacity: number; queued: 0 } { return { active: this.active, capacity: this.capacity, queued: 0 }; }
  /** Explicit leases are for host-controlled lifecycles. For async RPC use run;
   * an aborted HTTP response does not prove its authority operation has ended. */
  tryAcquire(): (() => void) | null {
    if (this.active >= this.capacity) return null;
    this.active++; let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
  /** No queue, retry, timeout preemption, session invalidation or role decision. */
  run<T>(operation: () => T | PromiseLike<T>): Promise<T> {
    if (typeof operation !== 'function') return Promise.reject(new WorkspaceSecurityError('WORKSPACE_INPUT_INVALID'));
    const release = this.tryAcquire();
    if (!release) return Promise.reject(new WorkspaceSecurityError('WORKSPACE_OVERLOADED'));
    return Promise.resolve().then(operation).finally(release);
  }
}
