import fs from 'node:fs';
import path from 'node:path';
import { validateSelfBootstrapManifest } from '../../src/data/selfBootstrapContract.ts';
import type {
  ControlledDocumentRecord,
  ControlledDocumentEditability,
  ControlledDocumentFileType,
} from '../../src/types.ts';

export const SELF_BOOTSTRAP_PROJECT_ID = 'PRJ-DOCMONSTAKRAKIN';

const EDITABLE_LIVING_DOC_IDS = new Set(['DOC-CTRL-002', 'DOC-CTRL-006']);

/**
 * Derives the ControlledDocumentFileType enum from the registered file path extension.
 * Performs case-insensitive extension matching.
 */
function deriveFileType(filePath: string): ControlledDocumentFileType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md') return 'MARKDOWN';
  if (ext === '.yaml' || ext === '.yml') return 'YAML';
  if (ext === '.json') return 'JSON';
  return 'OTHER';
}

/**
 * Loads and validates the self-bootstrap manifest from the specified workspace root.
 * Fails closed if the manifest file is missing, malformed, or fails canonical schema validation.
 */
function loadValidatedSelfManifest(workspaceRoot: string): any {
  const manifestPath = path.join(workspaceRoot, 'bootstrap', 'docmonstakrakin.self-bootstrap.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`CONTROLLED_DOCS_MANIFEST_INVALID: Manifest file not found at ${manifestPath}`);
  }

  let raw: unknown;
  try {
    const rawContent = fs.readFileSync(manifestPath, 'utf8');
    raw = JSON.parse(rawContent);
  } catch (err: unknown) {
    throw new Error(`CONTROLLED_DOCS_MANIFEST_INVALID: Malformed JSON manifest - ${String(err)}`);
  }

  const validation = validateSelfBootstrapManifest(raw);
  if (!validation.valid) {
    throw new Error(`CONTROLLED_DOCS_MANIFEST_INVALID: Validation failed: ${validation.errors.join('; ')}`);
  }

  const manifest = raw as { documents?: unknown[] };
  if (!Array.isArray(manifest.documents)) {
    throw new Error('CONTROLLED_DOCS_MANIFEST_INVALID: documents array missing or malformed');
  }

  return manifest;
}

/**
 * Projects a validated manifest document reference into an authoritative ControlledDocumentRecord.
 */
function toControlledDocumentRecord(doc: any): ControlledDocumentRecord {
  const isLivingEditable = EDITABLE_LIVING_DOC_IDS.has(doc.id);
  const editability: ControlledDocumentEditability = isLivingEditable ? 'CONTROLLED_EDIT' : 'READ_ONLY';
  const editableLivingDoc = isLivingEditable;

  const title =
    typeof doc.title === 'string' && doc.title.trim().length > 0
      ? doc.title.trim()
      : doc.id || path.basename(doc.path);

  const record: ControlledDocumentRecord = {
    id: doc.id,
    path: doc.path,
    kind: doc.kind,
    authority: doc.authority,
    editability,
    fileType: deriveFileType(doc.path),
    title,
    editableLivingDoc,
  };

  if (doc.description) {
    record.description = doc.description;
  }
  if (doc.sha256Digest) {
    record.sha256Digest = doc.sha256Digest;
  }

  return record;
}

/**
 * Returns the authoritative list of controlled documents for the given project.
 * For PRJ-DOCMONSTAKRAKIN, loads and validates the self-bootstrap manifest.
 * For all external projects, returns an empty array ([]).
 */
export function getControlledDocsRegistry(
  projectId: string,
  workspaceRoot: string = process.cwd()
): ControlledDocumentRecord[] {
  if (projectId !== SELF_BOOTSTRAP_PROJECT_ID) {
    return [];
  }

  const manifest = loadValidatedSelfManifest(workspaceRoot);
  return manifest.documents.map((d: any) => toControlledDocumentRecord(d));
}

/**
 * Looks up a single controlled document by project ID and document ID.
 * Returns null if the project is external or the document is not registered.
 */
export function findControlledDoc(
  projectId: string,
  documentId: string,
  workspaceRoot: string = process.cwd()
): ControlledDocumentRecord | null {
  if (projectId !== SELF_BOOTSTRAP_PROJECT_ID) {
    return null;
  }

  const registry = getControlledDocsRegistry(projectId, workspaceRoot);
  const found = registry.find((d) => d.id === documentId);
  return found ? { ...found } : null;
}

/**
 * Checks whether controlled editing is permitted for the specified project and document.
 * Returns true only for explicitly allowlisted living documents (DOC-CTRL-002, DOC-CTRL-006)
 * under PRJ-DOCMONSTAKRAKIN.
 */
export function isControlledEditAllowed(
  projectId: string,
  documentId: string,
  workspaceRoot: string = process.cwd()
): boolean {
  if (projectId !== SELF_BOOTSTRAP_PROJECT_ID) {
    return false;
  }

  const doc = findControlledDoc(projectId, documentId, workspaceRoot);
  return doc?.editability === 'CONTROLLED_EDIT';
}
