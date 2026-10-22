/**
 * controlledDocsClient.ts
 * Frontend data client and request sequencing for Controlled Documentation Workspace (DMK-195).
 */

import type {
  ControlledDocumentSummary,
  DocumentContentResponse,
  DocumentDiffResponse,
  DocumentValidationResponse,
  DocumentSaveInput,
  DocumentSaveResponse,
  ReviewerSessionInfo,
  DetectedEol,
} from '../types.js';
import { isValidStateVersion } from '../utils/projectListReconciliation.js';
import type { ManagedDocumentCreateInput, ManagedDocumentCreateResponse, ManagedDocumentSaveInput, ManagedDocumentContentResponse } from '../managedDocumentTypes.js';

const REQUEST_TIMEOUT_MS = 20_000;

type Channel = 'list' | 'content' | 'diff' | 'validate' | 'save' | 'session' | 'create' | 'project';

const VALID_KINDS = new Set([
  'CONTROL',
  'PRODUCT',
  'REQUIREMENTS',
  'ARCHITECTURE',
  'SECURITY',
  'VERIFICATION',
  'OPERATIONS',
]);

const VALID_AUTHORITIES = new Set(['REFERENCE', 'GENERATED_PROJECTION']);
const VALID_EDITABILITIES = new Set(['READ_ONLY', 'CONTROLLED_EDIT']);
const VALID_FILE_TYPES = new Set(['MARKDOWN', 'YAML', 'JSON', 'OTHER']);
const VALID_INTEGRITY_STATUSES = new Set(['MATCH', 'CHANGED', 'UNPINNED', 'MISSING']);
const VALID_EOLS = new Set<DetectedEol>(['LF', 'CRLF', 'MIXED', 'NONE']);
const SHA256_REGEX = /^[0-9a-fA-F]{64}$/;

function validateSummary(item: any): item is ControlledDocumentSummary {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (typeof item.id !== 'string' || item.id.length === 0) return false;
  if (typeof item.path !== 'string' || item.path.length === 0) return false;
  if (!VALID_KINDS.has(item.kind)) return false;
  if (!VALID_AUTHORITIES.has(item.authority)) return false;
  if (!VALID_EDITABILITIES.has(item.editability)) return false;
  if (!VALID_FILE_TYPES.has(item.fileType)) return false;
  if (typeof item.title !== 'string') return false;
  if (!VALID_INTEGRITY_STATUSES.has(item.integrityStatus)) return false;
  if (item.currentSha256 !== null && (typeof item.currentSha256 !== 'string' || !SHA256_REGEX.test(item.currentSha256))) {
    return false;
  }
  if (item.sizeBytes !== undefined && (typeof item.sizeBytes !== 'number' || !Number.isFinite(item.sizeBytes) || item.sizeBytes < 0)) {
    return false;
  }
  if (item.eol !== undefined && !VALID_EOLS.has(item.eol)) return false;
  if (item.description !== undefined && typeof item.description !== 'string') return false;
  if (item.sha256Digest !== undefined && typeof item.sha256Digest !== 'string') return false;
  return true;
}

function validateDocumentContentResponse(data: any): DocumentContentResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid controlled document content response.');
  }
  if (!validateSummary(data.document)) {
    throw new Error('Invalid controlled document content response.');
  }
  if (typeof data.content !== 'string') {
    throw new Error('Invalid controlled document content response.');
  }
  if (typeof data.rawSha256 !== 'string' || !SHA256_REGEX.test(data.rawSha256)) {
    throw new Error('Invalid controlled document content response.');
  }
  if (!VALID_EOLS.has(data.eol)) {
    throw new Error('Invalid controlled document content response.');
  }
  if (typeof data.sizeBytes !== 'number' || !Number.isFinite(data.sizeBytes) || data.sizeBytes < 0) {
    throw new Error('Invalid controlled document content response.');
  }
  return data as DocumentContentResponse;
}

function validateDocumentDiffResponse(data: any): DocumentDiffResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.documentId !== 'string') {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.oldHash !== 'string' || !SHA256_REGEX.test(data.oldHash)) {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.candidateHash !== 'string' || !SHA256_REGEX.test(data.candidateHash)) {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.isStale !== 'boolean') {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.hasChanges !== 'boolean') {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.additions !== 'number' || !Number.isInteger(data.additions) || data.additions < 0) {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.deletions !== 'number' || !Number.isInteger(data.deletions) || data.deletions < 0) {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.changedLines !== 'number' || !Number.isInteger(data.changedLines) || data.changedLines < 0) {
    throw new Error('Invalid controlled document diff response.');
  }
  if (typeof data.unifiedDiff !== 'string') {
    throw new Error('Invalid controlled document diff response.');
  }
  if (data.changedLines !== data.additions + data.deletions) {
    throw new Error('Invalid controlled document diff response.');
  }
  return data as DocumentDiffResponse;
}

function validateDocumentValidationResponse(data: any): DocumentValidationResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid controlled document validation response.');
  }
  if (typeof data.documentId !== 'string') {
    throw new Error('Invalid controlled document validation response.');
  }
  if (typeof data.valid !== 'boolean') {
    throw new Error('Invalid controlled document validation response.');
  }
  if (!Array.isArray(data.errors) || data.errors.some((e: any) => typeof e !== 'string')) {
    throw new Error('Invalid controlled document validation response.');
  }
  if (!Array.isArray(data.warnings) || data.warnings.some((w: any) => typeof w !== 'string')) {
    throw new Error('Invalid controlled document validation response.');
  }
  return data as DocumentValidationResponse;
}

function validateDocumentSaveResponse(data: any): DocumentSaveResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid controlled document save response.');
  }
  if (data.success !== true) {
    throw new Error('Invalid controlled document save response.');
  }
  if (typeof data.documentId !== 'string' || data.documentId.length === 0) {
    throw new Error('Invalid controlled document save response.');
  }
  if (typeof data.path !== 'string' || data.path.length === 0) {
    throw new Error('Invalid controlled document save response.');
  }
  if (typeof data.previousSha256 !== 'string' || !SHA256_REGEX.test(data.previousSha256)) {
    throw new Error('Invalid controlled document save response.');
  }
  if (typeof data.newSha256 !== 'string' || !SHA256_REGEX.test(data.newSha256)) {
    throw new Error('Invalid controlled document save response.');
  }
  if (!isValidStateVersion(data.stateVersion)) {
    throw new Error('Invalid controlled document save response.');
  }
  if (typeof data.auditEventId !== 'string' || data.auditEventId.length === 0) {
    throw new Error('Invalid controlled document save response.');
  }
  if (typeof data.timestamp !== 'string' || isNaN(Date.parse(data.timestamp))) {
    throw new Error('Invalid controlled document save response.');
  }
  return data as DocumentSaveResponse;
}

function validateGovernanceSessionResponse(data: any): ReviewerSessionInfo | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid governance session response.');
  }
  if (!('identity' in data)) {
    throw new Error('Invalid governance session response.');
  }
  if (data.identity === null) {
    return null;
  }
  const id = data.identity;
  if (!id || typeof id !== 'object' || Array.isArray(id)) {
    throw new Error('Invalid governance session response.');
  }
  if (typeof id.name !== 'string' || id.name.trim().length === 0) {
    throw new Error('Invalid governance session response.');
  }
  if (!Array.isArray(id.roles) || id.roles.some((r: any) => typeof r !== 'string')) {
    throw new Error('Invalid governance session response.');
  }
  return {
    name: id.name,
    roles: [...id.roles],
  };
}

export function createControlledDocsLoader(request: typeof fetch = fetch) {
  const sequence: Record<Channel, number> = {
    list: 0,
    content: 0,
    diff: 0,
    validate: 0,
    save: 0,
    session: 0,
    create: 0,
    project: 0,
  };

  const controllers: Partial<Record<Channel, AbortController>> = {};

  const executeChannel = async <T>(
    channel: Channel,
    url: string,
    init: RequestInit,
    validateFn: (data: any) => T
  ): Promise<T> => {
    sequence[channel]++;
    const token = sequence[channel];

    if (controllers[channel]) {
      controllers[channel]!.abort(
        new DOMException('Controlled docs request superseded', 'AbortError')
      );
    }

    const controller = new AbortController();
    controllers[channel] = controller;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException('Controlled docs request timed out.', 'AbortError'));
    }, REQUEST_TIMEOUT_MS);

    const assertCurrent = () => {
      if (timedOut) {
        throw new Error('Controlled docs request timed out.');
      }
      if (sequence[channel] !== token) {
        throw new DOMException('Controlled docs request superseded', 'AbortError');
      }
    };

    try {
      const response = await request(url, {
        ...init,
        signal: controller.signal,
        credentials: 'same-origin',
      });

      assertCurrent();

      if (!response.ok) {
        let errJson: any = null;
        try {
          errJson = await response.json();
        } catch {
          // Response body was not JSON
        }

        assertCurrent();

        if (errJson && typeof errJson === 'object' && typeof errJson.error === 'string') {
          throw new Error(errJson.error);
        }
        throw new Error(`Controlled documents request failed with HTTP ${response.status}.`);
      }

      const rawJson = await response.json();

      assertCurrent();

      const result = validateFn(rawJson);

      assertCurrent();

      return result;
    } catch (error: any) {
      if (timedOut || (error instanceof Error && error.message.includes('timed out'))) {
        throw new Error('Controlled docs request timed out.');
      }
      if (sequence[channel] !== token) {
        throw new DOMException('Controlled docs request superseded', 'AbortError');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (controllers[channel] === controller) {
        delete controllers[channel];
      }
    }
  };

  const invalidate = () => {
    for (const key of Object.keys(sequence) as Channel[]) {
      sequence[key]++;
      if (controllers[key]) {
        controllers[key]!.abort(
          new DOMException('Controlled docs request invalidated', 'AbortError')
        );
        delete controllers[key];
      }
    }
  };

  return {
    loadDocumentList: async (projectId: string): Promise<ControlledDocumentSummary[]> => {
      const url = `/api/projects/${encodeURIComponent(projectId)}/docs`;
      return executeChannel('list', url, { method: 'GET' }, (data: any) => {
        if (!Array.isArray(data) || !data.every(validateSummary)) {
          throw new Error('Invalid controlled document list response.');
        }
        return data as ControlledDocumentSummary[];
      });
    },

    loadDocumentContent: async (
      projectId: string,
      documentId: string
    ): Promise<ManagedDocumentContentResponse> => {
      const url = `/api/projects/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(documentId)}`;
      return executeChannel('content', url, { method: 'GET' }, (data: any) => {
        const result = validateDocumentContentResponse(data);
        if ((documentId.startsWith('MDOC-') || data.document.managed === true) && (data.projectId !== projectId || data.document.id !== documentId || !isValidStateVersion(data.stateVersion))) {
          throw new Error('Invalid managed document content response.');
        }
        return result as ManagedDocumentContentResponse;
      });
    },

    requestDiff: async (
      projectId: string,
      documentId: string,
      candidateContent: string,
      baseSha256: string
    ): Promise<DocumentDiffResponse> => {
      const url = `/api/projects/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(documentId)}/diff`;
      return executeChannel(
        'diff',
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256,
          }),
        },
        validateDocumentDiffResponse
      );
    },

    requestValidate: async (
      projectId: string,
      documentId: string,
      candidateContent: string
    ): Promise<DocumentValidationResponse> => {
      const url = `/api/projects/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(documentId)}/validate`;
      return executeChannel(
        'validate',
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
          }),
        },
        validateDocumentValidationResponse
      );
    },

    requestSave: async (input: ManagedDocumentSaveInput): Promise<DocumentSaveResponse> => {
      const url = `/api/projects/${encodeURIComponent(input.projectId)}/docs/${encodeURIComponent(input.documentId)}/save`;
      return executeChannel(
        'save',
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: input.candidateContent,
            baseSha256: input.baseSha256,
            reason: input.reason,
            humanConfirmed: input.humanConfirmed,
            ...(input.expectedStateVersion !== undefined ? { expectedStateVersion: input.expectedStateVersion } : {}),
            ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
          }),
        },
        (data: any) => {
          if (!input.documentId.startsWith('MDOC-')) return validateDocumentSaveResponse(data);
          try {
            const result = validateDocumentSaveResponse(data);
            if (result.documentId !== input.documentId || result.previousSha256 !== input.baseSha256.toLowerCase() ||
              result.stateVersion !== input.expectedStateVersion! + 1 ||
              ![`managed-documents/${input.documentId}.md`, `managed-documents/${input.documentId}.txt`].includes(result.path)) throw new Error();
            return result;
          } catch { throw new Error('Invalid managed document save response.'); }
        }
      );
    },

    requestCreate: async (input: ManagedDocumentCreateInput): Promise<ManagedDocumentCreateResponse> => {
      const { projectId, ...body } = input;
      return executeChannel('create', `/api/projects/${encodeURIComponent(projectId)}/docs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }, (data: any) => {
        try {
          validateDocumentSaveResponse({ ...data, previousSha256: data?.newSha256 });
          if (data.projectId !== projectId || data.stateVersion !== input.expectedStateVersion + 1 ||
            !/^MDOC-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.documentId) ||
            data.path !== `managed-documents/${data.documentId}.${input.format === 'MARKDOWN' ? 'md' : 'txt'}`) throw new Error();
        } catch { throw new Error('Invalid managed document create response.'); }
        return data as ManagedDocumentCreateResponse;
      });
    },

    loadProjectStateVersion: async (projectId: string): Promise<number> => executeChannel(
      'project', `/api/projects/${encodeURIComponent(projectId)}`, { method: 'GET' }, (data: any) => {
        if (!data || data.id !== projectId || !isValidStateVersion(data.stateVersion)) throw new Error('Invalid project version response.');
        return data.stateVersion;
      }
    ),

    loadGovernanceSession: async (): Promise<ReviewerSessionInfo | null> => {
      const url = '/api/governance/session';
      return executeChannel('session', url, { method: 'GET' }, validateGovernanceSessionResponse);
    },

    invalidate,
  };
}
