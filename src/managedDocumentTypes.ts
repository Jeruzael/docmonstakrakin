import type { ControlledDocumentKind, DocumentSaveInput, DocumentSaveResponse, DocumentContentResponse, ControlledDocumentSummary } from './types.js';

/** Snapshot-owned ordinary-project content. Virtual paths are display labels, never disk targets. */
export interface ProjectManagedDocument {
  id: string;
  projectId: string;
  path: string;
  title: string;
  kind: ControlledDocumentKind;
  format: 'MARKDOWN' | 'TEXT';
  content: string;
  sha256Digest: string;
  createdAt: string;
  updatedAt: string;
  /** Durable replay protection; bounded without dropping previously used IDs. */
  requestIds: string[];
}

export type ProjectManagedDocuments = Record<string, ProjectManagedDocument[]>;
export interface ManagedDocumentCreateInput {
  projectId: string;
  title: string;
  kind: ControlledDocumentKind;
  format: 'MARKDOWN' | 'TEXT';
  content: string;
  expectedStateVersion: number;
  reason: string;
  humanConfirmed: boolean;
  requestId: string;
}
export interface ManagedDocumentCreateResponse extends Omit<DocumentSaveResponse, 'previousSha256'> {
  projectId: string;
}
export interface ManagedDocumentSaveInput extends DocumentSaveInput {
  expectedStateVersion?: number;
  requestId?: string;
}
export interface ManagedDocumentContentResponse extends DocumentContentResponse {
  projectId?: string;
  stateVersion?: number;
}
export interface ManagedDocumentSummary extends ControlledDocumentSummary {
  managed?: boolean;
}
