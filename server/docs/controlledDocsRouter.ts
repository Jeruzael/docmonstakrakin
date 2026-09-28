import express, { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import type { ProjectStore } from '../projectStore.ts';
import { createAuditEventId } from '../projectStore.ts';
import type { ReviewerIdentity } from '../proposals/identity.ts';
import type { ControlledDocumentRecord } from '../../src/types.ts';
import {
  getControlledDocsRegistry,
  findControlledDoc,
} from './controlledDocsRegistry.ts';
import {
  readDocumentDisk,
  encodeDocumentBytes,
  DocumentFileReadResult,
} from './controlledDocsPersistence.ts';
import {
  validateDocumentContent,
  computeDocumentDiff,
} from './controlledDocsValidator.ts';
import {
  prepareDocumentTransaction,
  DocumentTransactionCoordinator,
} from './controlledDocsTransaction.ts';
import { assertDocumentTransactionsUnlocked } from './controlledDocsRecovery.ts';
import { projectSnapshotDigest } from '../projectPersistence.ts';

export interface DocumentSaveResponse {
  success: true;
  documentId: string;
  path: string;
  previousSha256: string;
  newSha256: string;
  stateVersion: number;
  auditEventId: string;
  timestamp: string;
}

const PROHIBITED_IDENTITY_FIELDS = [
  'actor',
  'role',
  'approver',
  'reviewerName',
  'reviewerRole',
  'authorizedRole',
  'identityId',
  'actorType',
  'auditEventId',
];

/**
 * Creates the Controlled Documents REST API router.
 */
export function createControlledDocsRouter(
  store: ProjectStore,
  requireHuman: (req: Request, res: Response) => ReviewerIdentity | undefined,
  workspaceRoot: string = process.cwd()
): Router {
  const router = express.Router();

  // -------------------------------------------------------------------------
  // GET /:id/docs - Catalog listing
  // -------------------------------------------------------------------------
  router.get('/:id/docs', (req: Request, res: Response) => {
    const project = store.projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
    }

    let records: ControlledDocumentRecord[];
    try {
      records = getControlledDocsRegistry(req.params.id, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'CONTROLLED_DOCS_REGISTRY_FAILED' });
    }

    try {
      const items = records.map((doc) => {
        const disk = readDocumentDisk(doc, workspaceRoot);
        return {
          id: doc.id,
          path: doc.path,
          kind: doc.kind,
          authority: doc.authority,
          editability: doc.editability,
          fileType: doc.fileType,
          title: doc.title,
          description: doc.description,
          sha256Digest: doc.sha256Digest,
          editableLivingDoc: doc.editableLivingDoc,
          integrityStatus: disk.integrityStatus,
          currentSha256: disk.rawSha256,
          sizeBytes: disk.sizeBytes,
          eol: disk.eol,
        };
      });
      return res.json(items);
    } catch {
      return res.status(500).json({ error: 'DOCUMENT_READ_FAILED' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /:id/docs/:documentId - Document content retrieval
  // -------------------------------------------------------------------------
  router.get('/:id/docs/:documentId', (req: Request, res: Response) => {
    const project = store.projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
    }

    let doc: ControlledDocumentRecord | null = null;
    try {
      doc = findControlledDoc(req.params.id, req.params.documentId, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'CONTROLLED_DOCS_REGISTRY_FAILED' });
    }
    if (!doc) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    let disk: DocumentFileReadResult;
    try {
      disk = readDocumentDisk(doc, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'DOCUMENT_READ_FAILED' });
    }

    if (!disk.exists) {
      return res.status(410).json({ error: 'DOCUMENT_MISSING' });
    }

    return res.json({
      document: {
        id: doc.id,
        path: doc.path,
        kind: doc.kind,
        authority: doc.authority,
        editability: doc.editability,
        fileType: doc.fileType,
        title: doc.title,
        description: doc.description,
        sha256Digest: doc.sha256Digest,
        editableLivingDoc: doc.editableLivingDoc,
        integrityStatus: disk.integrityStatus,
        currentSha256: disk.rawSha256,
        sizeBytes: disk.sizeBytes,
        eol: disk.eol,
      },
      content: disk.content,
      rawSha256: disk.rawSha256,
      eol: disk.eol,
      sizeBytes: disk.sizeBytes,
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/docs/:documentId/diff - Diff computation (READ_ONLY)
  // -------------------------------------------------------------------------
  router.post('/:id/docs/:documentId/diff', (req: Request, res: Response) => {
    const project = store.projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
    }

    let doc: ControlledDocumentRecord | null = null;
    try {
      doc = findControlledDoc(req.params.id, req.params.documentId, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'CONTROLLED_DOCS_REGISTRY_FAILED' });
    }
    if (!doc) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    if (doc.editability !== 'CONTROLLED_EDIT') {
      return res.status(403).json({ error: 'DOCUMENT_READ_ONLY' });
    }

    const { candidateContent, baseSha256 } = req.body || {};
    if (typeof candidateContent !== 'string') {
      return res.status(422).json({ error: 'INVALID_DOCUMENT_CONTENT' });
    }
    if (typeof baseSha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(baseSha256)) {
      return res.status(422).json({ error: 'INVALID_BASE_SHA256' });
    }

    let current: DocumentFileReadResult;
    try {
      current = readDocumentDisk(doc, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'DOCUMENT_READ_FAILED' });
    }
    if (!current.exists) {
      return res.status(410).json({ error: 'DOCUMENT_MISSING' });
    }
    if (current.eol === 'MIXED') {
      return res.status(422).json({ error: 'UNSUPPORTED_MIXED_LINE_ENDINGS' });
    }

    let candidateBytes: Buffer;
    try {
      candidateBytes = encodeDocumentBytes(candidateContent, current.eol);
    } catch {
      return res.status(422).json({ error: 'UNSUPPORTED_MIXED_LINE_ENDINGS' });
    }

    const candidateSha256 = crypto.createHash('sha256').update(candidateBytes).digest('hex');

    const diff = computeDocumentDiff({
      originalContent: current.content!,
      candidateContent,
      baseSha256,
      currentSha256: current.rawSha256!,
      candidateSha256,
    });

    return res.json({
      documentId: doc.id,
      oldHash: diff.oldHash,
      candidateHash: diff.candidateHash,
      isStale: diff.isStale,
      hasChanges: diff.hasChanges,
      additions: diff.additions,
      deletions: diff.deletions,
      changedLines: diff.changedLines,
      unifiedDiff: diff.unifiedDiff,
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/docs/:documentId/validate - Candidate validation (READ_ONLY)
  // -------------------------------------------------------------------------
  router.post('/:id/docs/:documentId/validate', (req: Request, res: Response) => {
    const project = store.projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
    }

    let doc: ControlledDocumentRecord | null = null;
    try {
      doc = findControlledDoc(req.params.id, req.params.documentId, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'CONTROLLED_DOCS_REGISTRY_FAILED' });
    }
    if (!doc) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    if (doc.editability !== 'CONTROLLED_EDIT') {
      return res.status(403).json({ error: 'DOCUMENT_READ_ONLY' });
    }

    const { candidateContent } = req.body || {};
    if (typeof candidateContent !== 'string') {
      return res.status(422).json({ error: 'INVALID_DOCUMENT_CONTENT' });
    }

    let current: DocumentFileReadResult;
    try {
      current = readDocumentDisk(doc, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'DOCUMENT_READ_FAILED' });
    }
    if (!current.exists) {
      return res.status(410).json({ error: 'DOCUMENT_MISSING' });
    }
    if (current.eol === 'MIXED') {
      return res.status(422).json({ error: 'UNSUPPORTED_MIXED_LINE_ENDINGS' });
    }

    let candidateBytes: Buffer;
    try {
      candidateBytes = encodeDocumentBytes(candidateContent, current.eol);
    } catch {
      return res.status(422).json({ error: 'UNSUPPORTED_MIXED_LINE_ENDINGS' });
    }

    const validation = validateDocumentContent(doc, candidateBytes, candidateContent);

    return res.json({
      documentId: doc.id,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/docs/:documentId/save - Coordinated Document Save
  // -------------------------------------------------------------------------
  router.post('/:id/docs/:documentId/save', (req: Request, res: Response) => {
    // 1. Prohibited client identity claims check (Occurs BEFORE auth!)
    if (req.body && typeof req.body === 'object') {
      for (const field of PROHIBITED_IDENTITY_FIELDS) {
        if (Object.hasOwn(req.body, field)) {
          return res.status(400).json({ error: 'CLIENT_IDENTITY_CLAIMS_PROHIBITED' });
        }
      }
    }

    // 2. Human authentication
    const reviewer = requireHuman(req, res);
    if (!reviewer) {
      return;
    }

    // 3. Request payload validation
    const { candidateContent, baseSha256, reason, humanConfirmed } = req.body || {};

    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(422).json({ error: 'DOCUMENT_SAVE_REASON_REQUIRED' });
    }

    if (humanConfirmed !== true) {
      return res.status(422).json({ error: 'HUMAN_CONFIRMATION_REQUIRED' });
    }

    if (typeof candidateContent !== 'string') {
      return res.status(422).json({ error: 'INVALID_DOCUMENT_CONTENT' });
    }

    if (typeof baseSha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(baseSha256)) {
      return res.status(422).json({ error: 'INVALID_BASE_SHA256' });
    }

    // 4. Recovery lock enforcement (Zero mutations or artifacts if locked)
    try {
      assertDocumentTransactionsUnlocked();
    } catch {
      return res.status(500).json({ error: 'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED' });
    }

    // 5. Project lookup
    const project = store.projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
    }

    // 6. Document registry lookup & editability check
    let docRecord: ControlledDocumentRecord | null = null;
    try {
      docRecord = findControlledDoc(req.params.id, req.params.documentId, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'CONTROLLED_DOCS_REGISTRY_FAILED' });
    }
    if (!docRecord) {
      return res.status(404).json({ error: 'DOCUMENT_NOT_FOUND' });
    }

    if (docRecord.editability !== 'CONTROLLED_EDIT') {
      return res.status(403).json({ error: 'DOCUMENT_READ_ONLY' });
    }

    // 7. Pre-transaction validation
    let currentRead: DocumentFileReadResult;
    try {
      currentRead = readDocumentDisk(docRecord, workspaceRoot);
    } catch {
      return res.status(500).json({ error: 'DOCUMENT_READ_FAILED' });
    }
    if (!currentRead.exists) {
      return res.status(410).json({ error: 'DOCUMENT_MISSING' });
    }
    if (currentRead.eol === 'MIXED') {
      return res.status(422).json({ error: 'UNSUPPORTED_MIXED_LINE_ENDINGS' });
    }

    let candidateBytes: Buffer;
    try {
      candidateBytes = encodeDocumentBytes(candidateContent, currentRead.eol);
    } catch {
      return res.status(422).json({ error: 'UNSUPPORTED_MIXED_LINE_ENDINGS' });
    }

    const validation = validateDocumentContent(docRecord, candidateBytes, candidateContent);
    if (!validation.valid) {
      return res.status(422).json({
        error: 'DOCUMENT_VALIDATION_FAILED',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // 8. Server-reserved audit event ID
    const auditEventId = createAuditEventId();

    // 9. Prepare transaction
    let coordinator: DocumentTransactionCoordinator;
    try {
      coordinator = prepareDocumentTransaction({
        projectId: project.id,
        documentId: docRecord.id,
        docRecord,
        candidateContent,
        baseSha256,
        projectStateBeforeDigest: projectSnapshotDigest(workspaceRoot),
        stateVersionBefore: project.stateVersion,
        auditEventId,
        workspaceRoot,
      });
    } catch (prepErr: any) {
      const msg = String(prepErr?.message || prepErr);
      if (msg.includes('DOCUMENT_STALE')) {
        return res.status(409).json({ error: 'DOCUMENT_STALE' });
      }
      if (msg.includes('DOCUMENT_TRANSACTION_BUSY')) {
        return res.status(409).json({ error: 'DOCUMENT_TRANSACTION_BUSY' });
      }
      if (msg.includes('DOCUMENT_MISSING')) {
        return res.status(410).json({ error: 'DOCUMENT_MISSING' });
      }
      if (msg.includes('DOCUMENT_READ_ONLY')) {
        return res.status(403).json({ error: 'DOCUMENT_READ_ONLY' });
      }
      if (msg.includes('UNSUPPORTED_MIXED_LINE_ENDINGS')) {
        return res.status(422).json({ error: 'UNSUPPORTED_MIXED_LINE_ENDINGS' });
      }
      if (msg.includes('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED')) {
        return res.status(500).json({ error: 'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED' });
      }
      return res.status(500).json({ error: 'DOCUMENT_UPDATE_FAILED' });
    }

    // 10. Attach persistence hooks IMMEDIATELY after prepare and BEFORE executeReplacement()
    res.locals.projectPersistenceHooks = {
      onCommit: coordinator.handleCommitSuccess,
      onRollback: coordinator.handleRollback,
    };

    // 11. Route-level execution with rollback handling
    try {
      const replacement = coordinator.executeReplacement();

      const auditEvent = store.addAuditEvent(
        project.id,
        reviewer.name,
        'DOCUMENT_UPDATED',
        docRecord.id,
        reason.trim(),
        {
          previousSha256: replacement.previousSha256,
          newSha256: replacement.newSha256,
          path: docRecord.path,
        },
        auditEventId
      );

      project.stateVersion += 1;

      const responseBody: DocumentSaveResponse = {
        success: true,
        documentId: docRecord.id,
        path: docRecord.path,
        previousSha256: replacement.previousSha256,
        newSha256: replacement.newSha256,
        stateVersion: project.stateVersion,
        auditEventId: auditEvent.id,
        timestamp: auditEvent.timestamp,
      };

      return res.json(responseBody);
    } catch (error) {
      try {
        coordinator.handleRollback(error);
      } catch {
        return res.status(500).json({
          error: 'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED',
        });
      }

      return res.status(500).json({
        error: 'DOCUMENT_UPDATE_FAILED',
      });
    }
  });

  return router;
}
