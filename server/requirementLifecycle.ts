import type { RequirementStatus } from '../src/types.ts';

/** Tactical policy for snapshot schema1; not authentication or governance ratification. */
export const REQUIREMENT_LIFECYCLE_POLICY_VERSION = 1;

// Preserve existing UI actions and VERIFIED compatibility. APPROVED is exclusively
// assigned by signoff.ts after human quorum; PROPOSED is creation/import state.
// Exhaustive keys force review when the canonical RequirementStatus type grows.
const transitions = {
  PROPOSED: ['UNDER_REVIEW', 'REJECTED', 'DEFERRED', 'VERIFIED'],
  UNDER_REVIEW: ['REJECTED', 'DEFERRED', 'VERIFIED'],
  APPROVED: ['UNDER_REVIEW', 'REJECTED', 'DEFERRED', 'VERIFIED'],
  REJECTED: ['UNDER_REVIEW', 'DEFERRED', 'VERIFIED'],
  DEFERRED: ['UNDER_REVIEW', 'REJECTED', 'VERIFIED'],
  VERIFIED: ['UNDER_REVIEW', 'REJECTED', 'DEFERRED'],
} as const satisfies Record<RequirementStatus, readonly RequirementStatus[]>;

type Failure = { ok: false; status: 403 | 409 | 422; error: string };
type Request = { status: RequirementStatus; justification?: string; expectedStateVersion?: number };
const fail = (status: Failure['status'], error: string): Failure => ({ ok: false, status, error });
const knownStatus = (value: unknown): value is RequirementStatus =>
  typeof value === 'string' && Object.hasOwn(transitions, value);

export function parseRequirementStatusRequest(body: unknown): Failure | { ok: true; value: Request } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(422, 'Requirement status body must be an object');
  const input = body as Record<string, unknown>;
  if (!Object.hasOwn(input, 'status') || !knownStatus(input.status)) return fail(422, 'Invalid requirement status');
  if (input.status === 'APPROVED') return fail(403, 'Use Request Sign-Off and human quorum to approve a requirement');
  if (Object.hasOwn(input, 'justification') && typeof input.justification !== 'string') return fail(422, 'Requirement justification must be a string');
  if (Object.hasOwn(input, 'expectedStateVersion') && (!Number.isSafeInteger(input.expectedStateVersion) || (input.expectedStateVersion as number) < 0)) return fail(422, 'expectedStateVersion must be a nonnegative safe integer');
  return { ok: true, value: { status: input.status, justification: input.justification as string | undefined, expectedStateVersion: input.expectedStateVersion as number | undefined } };
}

export function validateRequirementTransition(current: unknown, stateVersion: unknown, request: Request): Failure | { ok: true } {
  if (!knownStatus(current)) return fail(409, 'Unknown persisted requirement lifecycle; review and repair through a separate recovery');
  if (!Number.isSafeInteger(stateVersion) || (stateVersion as number) < 0 || stateVersion === Number.MAX_SAFE_INTEGER) return fail(409, 'Invalid persisted project stateVersion');
  if (request.expectedStateVersion !== undefined && request.expectedStateVersion !== stateVersion) return fail(409, 'Project stateVersion changed; reload and review again');
  if (!(transitions[current] as readonly RequirementStatus[]).includes(request.status)) return fail(409, `Invalid requirement transition from ${current} to ${request.status}`);
  return { ok: true };
}
