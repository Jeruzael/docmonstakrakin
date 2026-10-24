/** Operational host RPC; never expose execute() directly to a browser. */
export type WorkspaceAction = 'project:read' | 'project:write' | 'project:review' | 'project:export' | 'project:import' | 'project:create';
export interface WorkspacePrincipal {
  id: string; name: string; personId: string; kind: 'HUMAN'; roles: ('Security Officer' | 'Lead Architect')[];
  canCreateProjects: boolean; disabled: boolean; credentialRevision: number;
}
export interface WorkspaceMembership {
  projectId: string; principalId: string; role: 'OWNER' | 'EDITOR' | 'READER' | 'DENY'; deniedActions?: WorkspaceAction[];
}
/** Development-only delegated read capability; never a HUMAN/reviewer identity. */
export type WorkspaceAgentAction = 'task:read';
export type WorkspaceAgentScope = {kind:'TASKS';taskIds:string[]}|{kind:'PROJECT_TASKS'};
export interface WorkspaceAgentActor {
  kind:'AGENT'; principalId:string; clientId:string; sessionId:string; sponsorPrincipalId:string;
  grantId:string; grantRevision:number; projectId:string; scope:WorkspaceAgentScope; actions:WorkspaceAgentAction[];
  expiresAt:number; policyRevision:number; snapshotRevision:number;
}
export interface WorkspaceAgentTask {id:string;title:string;description:string;status:string;priority:string;updatedAt:string}
export type WorkspaceAgentRead = {allowed:false;reason:'SESSION_INVALID'|'TASK_ACCESS_DENIED'} |
  {allowed:true;reason:'ALLOWED';actor:WorkspaceAgentActor;task:WorkspaceAgentTask;policyRevision:number;snapshotRevision:number};
export interface WorkspaceAgentManagementReceipt {
  version:1;operationId:string;principalId:string;projectId:string;action:string;requestHash:string;
  expectedPolicyRevision:number;policyRevision:number;agentId:string;clientId:string|null;grantId:string|null;
  sessionId:string|null;grantRevision:number|null;revoked:boolean|null;
}
type AgentManagement = {sponsorDigest:string;operationId:string;requestHash:string;expectedPolicyRevision:number;now:number};
export type WorkspaceAgentCommand =
  | ({command:'enrollAgent';projectId:string;agentId:string;name:string}&AgentManagement)
  | ({command:'registerAgentClient';projectId:string;agentId:string;clientId:string;name:string}&AgentManagement)
  | ({command:'grantAgent';agentId:string;clientId:string;grantId:string;projectId:string;scope:WorkspaceAgentScope;actions:WorkspaceAgentAction[];expiresAt:number}&AgentManagement)
  | ({command:'issueAgent';grantId:string;expectedGrantRevision:number;sessionId:string;digest:string}&AgentManagement)
  | {command:'agentSession'|'revokeAgentSession';digest:string;now:number}
  | {command:'readAgentTask';digest:string;projectId:string;taskId:string;now:number}
  | ({command:'revokeAgent';agentId:string}&AgentManagement)
  | ({command:'revokeAgentClient';clientId:string}&AgentManagement)
  | ({command:'revokeAgentGrant';grantId:string}&AgentManagement);
/** Historical commit acknowledgment, never a claim about the current snapshot. */
export interface WorkspaceActionReceipt {
  version: 1; operationId: string; principalId: string; action: WorkspaceAction;
  requestedProjectId: string | null; projectId: string; requestHash: string; effectHash: string;
  snapshotRevision: number; policyRevision: number;
}
export const WORKSPACE_LIMITS = Object.freeze({ principals: 128, memberships: 512, sessions: 256, audit: 4096,
  throttleKeys: 128, snapshotBytes: 64 * 1024 * 1024, pending: 16, requestMs: 3000, startupMs: 10_000,
  idleMs: 600_000, absoluteMs: 1_800_000, throttleMs: 60_000, perName: 5, global: 30 });
export type WorkspaceCommand = WorkspaceAgentCommand
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
  | { command: 'commit'; operationId: string; digest: string; action: WorkspaceAction; projectId?: string; expectedRevision: number; expectedPolicyRevision: number; stateJson: string; now: number }
  | { command: 'commitReceipt'; operationId: string; digest: string; action: WorkspaceAction; projectId?: string; requestedProjectId?: string; requestHash: string; expectedRevision: number; expectedPolicyRevision: number; stateJson: string; now: number }
  | { command: 'lookupReceipt'; operationId: string; digest: string; action: WorkspaceAction; projectId?: string; requestHash: string; now: number };
export class WorkspaceSecurityError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'WorkspaceSecurityError'; }
}
