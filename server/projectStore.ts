import { sanitizeAndHashAudit } from './security/sanitizedAudit.ts';
import { GENESIS_AUDIT_HASH } from './security/auditImmutability.ts';
import {
  INITIAL_PROJECTS,
  INITIAL_QUESTIONS,
  INITIAL_REQUIREMENTS,
  INITIAL_RISKS,
  INITIAL_THREATS,
  INITIAL_STANDARDS,
  INITIAL_WORK_ITEMS,
  INITIAL_EVIDENCE,
  INITIAL_AUDIT_EVENTS,
  INITIAL_ADRS,
  INITIAL_COMPONENTS,
  INITIAL_APPROVALS,
  INITIAL_AGENT_ROLES,
  INITIAL_AGENT_RUNS,
} from '../src/data/initialData.ts';
import type {
  Project,
  Question,
  Requirement,
  Risk,
  Threat,
  StandardControl,
  WorkItem,
  Evidence,
  AuditEvent,
  GateOverride,
  ADR,
  ArchitectureComponent,
  ApprovalItem,
  AgentRole,
  AgentRunLog,
  Feature,
  DerivationRecord,
} from '../src/types.ts';
import type { ControlledDocumentReference } from '../src/data/selfBootstrapContract.ts';
import type { ImportSession } from '../src/proposalTypes.ts';

/**
 * Canonical in-memory project store for docmonstakrakin.
 * Houses all multi-project collections, audit events, and controlled document references.
 */
export class ProjectStore {
  importSessions: Record<string, ImportSession[]> = {};
  projects: Project[] = [...INITIAL_PROJECTS];
  questions: Record<string, Question[]> = {
    'PRJ-ATLAS-01': [...INITIAL_QUESTIONS],
  };
  requirements: Record<string, Requirement[]> = {
    'PRJ-ATLAS-01': [...INITIAL_REQUIREMENTS],
  };
  adrs: Record<string, ADR[]> = {
    'PRJ-ATLAS-01': [...INITIAL_ADRS],
  };
  components: Record<string, ArchitectureComponent[]> = {
    'PRJ-ATLAS-01': [...INITIAL_COMPONENTS],
  };
  risks: Record<string, Risk[]> = {
    'PRJ-ATLAS-01': [...INITIAL_RISKS],
  };
  threats: Record<string, Threat[]> = {
    'PRJ-ATLAS-01': [...INITIAL_THREATS],
  };
  standards: Record<string, StandardControl[]> = {
    'PRJ-ATLAS-01': [...INITIAL_STANDARDS],
  };
  workItems: Record<string, WorkItem[]> = {
    'PRJ-ATLAS-01': [...INITIAL_WORK_ITEMS],
  };
  evidence: Record<string, Evidence[]> = {
    'PRJ-ATLAS-01': [...INITIAL_EVIDENCE],
  };
  auditLogs: Record<string, AuditEvent[]> = {
    'PRJ-ATLAS-01': [...INITIAL_AUDIT_EVENTS],
  };
  overrides: Record<string, GateOverride[]> = {
    'PRJ-ATLAS-01': [],
  };
  approvals: Record<string, ApprovalItem[]> = {
    'PRJ-ATLAS-01': [...INITIAL_APPROVALS],
  };
  agentRoles: Record<string, AgentRole[]> = {
    'PRJ-ATLAS-01': [...INITIAL_AGENT_ROLES],
  };
  agentRuns: Record<string, AgentRunLog[]> = {
    'PRJ-ATLAS-01': [...INITIAL_AGENT_RUNS],
  };
  features: Record<string, Feature[]> = {
    'PRJ-ATLAS-01': [
      {
        id: 'FEAT-CORE-001',
        title: 'Deterministic Workflow Engine',
        description: 'Core state transition machine governing A-SSDLC lifecycle phases.',
        capability: 'Workflow Automation',
        priority: 'P0',
        status: 'APPROVED',
        source: 'MANUAL_ENTRY',
        personas: ['Technical Operators'],
        requirements: ['REQ-OPS-001'],
        dependencies: [],
        updatedAt: '2026-09-15T15:25:00Z',
      },
    ],
  };
  derivations: Record<string, DerivationRecord[]> = {
    'PRJ-ATLAS-01': [],
  };
  documents: Record<string, ControlledDocumentReference[]> = {
    'PRJ-ATLAS-01': [],
  };

  addAuditEvent(
    projectId: string,
    actor: string,
    action: string,
    target: string,
    reason?: string,
    details?: any
  ): AuditEvent {
    if (!this.auditLogs[projectId]) {
      this.auditLogs[projectId] = [];
    }
    const previousEvent = this.auditLogs[projectId][0];
    const previousHash = previousEvent ? previousEvent.stateHash : GENESIS_AUDIT_HASH;
    const timestamp = new Date().toISOString();
    const id = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const rawEvent: AuditEvent = {
      id,
      actor,
      timestamp,
      action,
      target,
      reason,
      stateHash: '',
      previousHash,
      details,
    };
    const event = sanitizeAndHashAudit(rawEvent);
    this.auditLogs[projectId].unshift(event);
    return event;
  }
}
