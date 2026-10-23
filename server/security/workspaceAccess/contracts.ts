/** Operational host RPC; never expose execute() directly to a browser. */
export type WorkspaceAction = 'project:read' | 'project:write' | 'project:review' | 'project:export' | 'project:import' | 'project:create';
export interface WorkspacePrincipal {
  id: string; name: string; personId: string; kind: 'HUMAN'; roles: ('Security Officer' | 'Lead Architect')[];
  canCreateProjects: boolean; disabled: boolean; credentialRevision: number;
}
export interface WorkspaceMembership {
  projectId: string; principalId: string; role: 'OWNER' | 'EDITOR' | 'READER' | 'DENY'; deniedActions?: WorkspaceAction[];
}
export const WORKSPACE_LIMITS = Object.freeze({ principals: 128, memberships: 512, sessions: 256, audit: 4096,
  throttleKeys: 128, snapshotBytes: 64 * 1024 * 1024, pending: 16, requestMs: 3000, startupMs: 10_000,
  idleMs: 600_000, absoluteMs: 1_800_000, throttleMs: 60_000, perName: 5, global: 30 });
export type WorkspaceCommand =
  | { command: 'info' | 'snapshot' | 'audit' }
  | { command: 'bootstrap'; principal: WorkspacePrincipal; verifier: string; stateJson?: string }
  | { command: 'provision'; principal: WorkspacePrincipal; verifier: string }
  | ({ command: 'membership' } & WorkspaceMembership)
  | { command: 'credential'; name: string }
  | { command: 'admitLogin'; key: string; now: number }
  | { command: 'issue'; principalId: string; expectedCredentialRevision: number; expectedGeneration: number; digest: string; now: number }
  | { command: 'session' | 'logout' | 'listProjects'; digest: string; now: number }
  | { command: 'rotate'; digest: string; replacementDigest: string; now: number }
  | { command: 'changeCredential'; digest: string; expectedCredentialRevision: number; verifier: string; now: number }
  | { command: 'resetCredential'; principalId: string; verifier: string }
  | { command: 'disable'; principalId: string }
  | { command: 'authorize'; digest: string; action: WorkspaceAction; projectId?: string; now: number }
  | { command: 'commit'; operationId: string; digest: string; action: WorkspaceAction; projectId?: string; expectedRevision: number; expectedPolicyRevision: number; stateJson: string; now: number };
export class WorkspaceSecurityError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'WorkspaceSecurityError'; }
}
