# Local MVP managed-document verification — 2026-10-22

This is implementation evidence for ordinary-project documents, not human approval, a release receipt, a Gate decision, or canonical project status.

## Scope and persistence contract

`src/managedDocumentTypes.ts` defines `ProjectManagedDocument` and `ProjectManagedDocuments = Record<string, ProjectManagedDocument[]>`. Each record contains the server-generated MDOC UUID, exact project ID, virtual display path, plain title, kind, Markdown/text format, normalized UTF-8 content, SHA-256 digest, creation/update timestamps, and durable used request UUIDs. Bytes and metadata are serialized in the existing atomic project snapshot; no managed-document file is created. Paths are display labels and must never be passed to filesystem APIs.

The existing self-project registry, file reads, document journals, EOL handling, read-only restrictions, and coordinated filesystem save transaction remain in their original router. The managed router only handles ordinary projects. Canonical self-project creation is forbidden, and unknown projects are rejected. Creation/editing confer no governance approval, release authorization, or trust.

Writes require the existing configured HUMAN reviewer with Security Officer or Lead Architect role, explicit human confirmation, a reason, exact `expectedStateVersion`, and a new request UUID. Saves additionally compare `baseSha256` with the stored content digest. Audit events identify the server-resolved reviewer and contain hashes/path/request ID; document content is not copied into audit details. A failed snapshot write restores content, metadata, replay reservation, version, and audit together.

Server limits: 128 KiB normalized UTF-8 per document; at most 1,000 logical lines plus final newline; 100 documents and 2 MiB content per project; 1,024 write request IDs per document. Used IDs are not evicted. Reaching a history/size limit fails closed. New document kinds are PRODUCT, REQUIREMENTS, ARCHITECTURE, SECURITY, VERIFICATION, or OPERATIONS. Markdown and plain text use the same content safety rules. Malformed UTF-8, null/control bytes, raw HTML, and active URL schemes are rejected. Titles cannot contain path separators, traversal, markup delimiters, or directional controls. Client-supplied paths, IDs, project ownership, actor/role, authority, approval/status, and unknown fields are rejected.

The create UI loads the current project version and reviewer session, previews with the existing safe Markdown renderer, and requires a fresh checkbox confirmation. It preserves drafts on conflicts and uncertain outcomes, requires reload/review before retry, and retains the request ID during uncertainty to prevent duplicate creation. Managed edits reuse diff/validate/confirm/save. Project and document generations suppress late results even if a supplied loader ignores aborts. Parent creation and save callbacks are isolated from document commit success.

## Parent integration required

1. In `server/projectStore.ts`, import `ProjectManagedDocuments` and declare `managedDocuments: ProjectManagedDocuments = {}` as an enumerable collection. Existing snapshot/hydration/rollback code serializes declared store collections, including old snapshots with no managed field. Initialize/clear it when other project collections are initialized/cleared.
2. Classify `POST /api/projects/:id/docs` as `SPECIALIZED_REVIEWER` in route policy, including the same supported route aliases/trailing slash conventions as existing API routes. Retain specialized reviewer policy on document saves. The router checks reviewer identity and persistence independently.
3. Wire optional `ControlledDocsView.onDocumentCreated(projectId, ManagedDocumentCreateResponse)` to refresh the parent project catalog, version floor/canonical snapshot, and audit. The existing `onSaveCommitted` signature stays intact. A create acknowledgment has no previous-content digest; do not invent one.
4. `server/package/portablePackage.ts` now supports optional `knowledge.managedDocuments`, validates the strict collection on both create and verify, and includes present records in canonical integrity hashing. Parent export wiring must supply `managedDocuments: project.id === 'PRJ-DOCMONSTAKRAKIN' ? undefined : (store.managedDocuments[project.id] ?? [])` to `createPortablePackage`. Parent import wiring must first require successful `verifyPortablePackage`, retain the existing target project ID, and assign `store.managedDocuments[targetProjectId] = structuredClone(pkg.knowledge.managedDocuments ?? [])` for ordinary projects. A missing collection clears ordinary documents when intentionally overwriting an old-format project; it must not retain stale records from the replaced snapshot. Omit the field for protected self-project exports. Do not change document IDs or virtual paths, infer authority from a matching hash, or import author/reviewer/approval/status/role fields; the closed document schema rejects them. If a separate authorized import deliberately rebinds a project ID, revalidate every record after that explicit rebind. No such rebind is implemented here. Package hashes are public integrity checks and do not authenticate a human producer or governance decision.
5. Parent schedules the browser, build, native-heavy, and full regression runs. This task intentionally performed lightweight focused tests only.

## Test evidence

All commands below use the provided Node 22.23.3 executable and existing `--import tsx`; no dependencies were installed.

- RED: `scripts/testProjectManagedDocuments.ts` expected HTTP 201 from the missing create route and observed HTTP 404 `ROUTE_NOT_FOUND`.
- GREEN: same script passed 10 API scenarios covering create/read/list/diff/validate/save, configured reviewer and explicit confirmation, self/unknown/cross-project isolation, hostile fields/content/names, version/digest CAS, duplicate title/replayed UUID, snapshot-lock failure rollback, restart hydration, and stored digest tampering.
- RED/GREEN: added surrogate-title and carriage-return line-limit probes exposed accepted invalid input and were corrected; validation and writes now normalize line endings consistently.
- RED: `scripts/testProjectManagedDocumentsClient.ts` observed missing `requestCreate`; GREEN verifies exact project/version/ID/path acknowledgment, request payloads, mismatched managed save rejection, project-version identity, and invalidation of late creation.
- RED: `scripts/testProjectManagedDocumentsView.ts` observed no ordinary-project create entry; GREEN verifies scoped entry visibility and stale-project readiness gating.
- Existing `scripts/testControlledDocsApi.ts`: 36/36 passing, including legacy filesystem rollback and recovery guarantees.
- Existing `scripts/testControlledDocsClient.ts`: 27/27 passing, including exact legacy save body and response sequencing/timeouts.
- `node_modules/typescript/bin/tsc --noEmit`: passed at Task 4 freeze and again after the package extension before signing.
- `scripts/testProjectManagedDocumentsUi.ts`: authored synthetic browser fixture, not run by this task. Covers reviewer/confirmation, empty-project creation and refresh, managed CAS conflict/reload/save, and a late creation response from an old project whose loader ignores aborts. Parent must execute and report its actual outcome.

## Portable managed-content package evidence

- RED: `scripts/testProjectManagedDocumentsPackage.ts` observed `knowledge.managedDocuments` missing from the existing package engine.
- GREEN: the focused fixture passes 11 resealed hostile-input cases plus exact Unicode content/digest/metadata/request-history serialization, detached caller ownership, strict creation validation, explicit empty collection semantics, and legacy omission compatibility. The 11 cases cover a foreign project ID, mismatched bytes/digest, canonical filesystem path, registry ID, injected authority, HUMAN reviewer, approval status, repeated request history, repeated document, null collection, and protected self-project content. Publicly recomputing canonical/envelope hashes does not make these malformed records acceptable.
- The pre-extension legacy fixture hash is a literal `a4512e49ce1f696d2b370fe9373ad20013d1abcf8b13a70e7948fd0a25d584e4`; the new engine produces exactly the same hash when the optional field is absent. A present empty array is deliberately different sealed knowledge, never injected into old packages.
- Existing `server/package/testPortablePackage.ts`: 9/9 passing. No server routes or import handlers were edited for this extension. No imported HUMAN authority is added by the content schema.

## Remaining limitations

No deletion, title/format/kind changes, attachments, real credential enrollment, production authentication, approval automation, root/WBS/history mutation, privilege activation, agent execution, Gate 7, release activation, push, PR, or merge is part of this change. Raw HTML is conservatively disallowed even inside fenced examples. The package engine round-trip is covered by the focused fixture below. HTTP export/import collection wiring remains the explicit parent bridge above; this task does not claim a completed normal-server package journey. Snapshot integrity checks fail closed on corrupt managed data; operators must recover the preserved snapshot rather than silently replacing it.
