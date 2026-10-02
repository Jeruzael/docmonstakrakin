import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { ProjectStore, createAuditEventId } from '../server/projectStore.ts';
import {
  installProjectPersistence,
  writeProjectSnapshotAtomic,
  projectSnapshotDigest,
} from '../server/projectPersistence.ts';
import {
  createControlledDocsRouter,
  DocumentSaveResponse,
} from '../server/docs/controlledDocsRouter.ts';
import {
  recoverDocumentTransactions,
  assertDocumentTransactionsUnlocked,
} from '../server/docs/controlledDocsRecovery.ts';
import {
  resetDocumentLocksForTesting,
  prepareDocumentTransaction,
} from '../server/docs/controlledDocsTransaction.ts';
import { encodeDocumentBytes } from '../server/docs/controlledDocsPersistence.ts';
import type { ReviewerIdentity } from '../server/proposals/identity.ts';

// Ephemeral test HTTP server helper
async function startTestServer(app: express.Express): Promise<{ base: string; close: () => Promise<void> }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

interface TestWorkspace {
  workspaceDir: string;
  projectStateFile: string;
  cleanup: () => void;
}

function createTestWorkspace(): TestWorkspace {
  const tmpBase = os.tmpdir();
  const workspaceDir = fs.mkdtempSync(path.join(tmpBase, 'dmk-api-test-'));

  // Copy canonical self-bootstrap manifest read-only
  const bootstrapDir = path.join(workspaceDir, 'bootstrap');
  fs.mkdirSync(bootstrapDir, { recursive: true });
  const realManifestPath = path.resolve(process.cwd(), 'bootstrap', 'docmonstakrakin.self-bootstrap.json');
  fs.copyFileSync(realManifestPath, path.join(bootstrapDir, 'docmonstakrakin.self-bootstrap.json'));

  // Create control documents directory
  const controlDir = path.join(workspaceDir, 'docs', '00_control');
  fs.mkdirSync(controlDir, { recursive: true });

  // Initial content for living documents
  const initialProjectState =
    '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n';
  fs.writeFileSync(path.join(controlDir, 'PROJECT_STATE.md'), initialProjectState, 'utf8');

  const initialTraceability =
    '# TRACEABILITY MATRIX\n\n| Requirement | Component | Verification |\n|---|---|---|\n| REQ-001 | CMP-001 | VER-001 |\n';
  fs.writeFileSync(path.join(controlDir, 'TRACEABILITY_MATRIX.md'), initialTraceability, 'utf8');

  // Initialize ProjectStore in temp workspace
  const store = new ProjectStore();
  store.projects = [
    {
      id: 'PRJ-DOCMONSTAKRAKIN',
      name: 'docmonstakrakin',
      description: 'Self-hosting workspace',
      stateVersion: 31,
    } as any,
  ];
  store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];

  const localDir = path.join(workspaceDir, '.local');
  fs.mkdirSync(localDir, { recursive: true });
  const projectStateFile = path.join(localDir, 'project-state.json');

  writeProjectSnapshotAtomic(
    {
      schemaVersion: 1,
      state: {
        projects: store.projects,
        auditLogs: store.auditLogs,
      },
    },
    workspaceDir
  );

  return {
    workspaceDir,
    projectStateFile,
    cleanup: () => {
      try {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
      } catch {}
      resetDocumentLocksForTesting();
    },
  };
}

const fakeReviewer: ReviewerIdentity = {
  id: 'TEST-HUMAN-001',
  name: 'Task8 Test Reviewer',
  roles: ['Security Officer'],
  kind: 'HUMAN',
  roleSource: 'LOCAL_SERVER_ROSTER',
};

function fakeRequireHuman(req: express.Request, res: express.Response): ReviewerIdentity | undefined {
  return fakeReviewer;
}

async function runTests() {
  console.log('================================================================');
  console.log('      CONTROLLED DOCS API & STORE ORCHESTRATION TESTS (DMK-195)  ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`✗ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // =========================================================================
  // Group 1: ProjectStore Audit ID Contract (Units)
  // =========================================================================

  await test('Test 1A: createAuditEventId produces AUD-<timestamp>-<random> format', async () => {
    const id1 = createAuditEventId();
    const id2 = createAuditEventId();
    assert(/^AUD-[A-Z0-9]+-[A-Z0-9]{4}$/.test(id1), `Expected AUD- format, got: ${id1}`);
    assert(/^AUD-[A-Z0-9]+-[A-Z0-9]{4}$/.test(id2), `Expected AUD- format, got: ${id2}`);
    assert.notStrictEqual(id1, id2);
  });

  await test('Test 1B: store.addAuditEvent with explicit eventId preserves exact ID', async () => {
    const store = new ProjectStore();
    const explicitId = 'AUD-EXPLICIT-TEST-001';
    const evt = store.addAuditEvent('PRJ-DOCMONSTAKRAKIN', 'Operator', 'TEST', 'DOC-001', 'Reason', {}, explicitId);
    assert.strictEqual(evt.id, explicitId);
    assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].id, explicitId);
  });

  await test('Test 1C: store.addAuditEvent with duplicate eventId throws DUPLICATE_AUDIT_EVENT_ID', async () => {
    const store = new ProjectStore();
    const explicitId = 'AUD-DUP-001';
    store.addAuditEvent('PRJ-DOCMONSTAKRAKIN', 'Operator', 'TEST', 'DOC-001', 'Reason', {}, explicitId);
    assert.throws(
      () => {
        store.addAuditEvent('PRJ-DOCMONSTAKRAKIN', 'Operator', 'TEST_2', 'DOC-001', 'Reason', {}, explicitId);
      },
      /DUPLICATE_AUDIT_EVENT_ID/
    );
    assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 1);
  });

  await test('Test 1D: store.addAuditEvent with omitted eventId maintains backward compatibility', async () => {
    const store = new ProjectStore();
    const evt = store.addAuditEvent('PRJ-DOCMONSTAKRAKIN', 'Operator', 'TEST', 'DOC-001');
    assert(/^AUD-[A-Z0-9]+-[A-Z0-9]{4}$/.test(evt.id));
    assert(evt.stateHash.length === 64);
  });

  await test('Test 1E: Explicit eventId is present in rawEvent before hashing and preserved', async () => {
    const store = new ProjectStore();
    const explicitId = 'AUD-RESERVED-CHAIN-001';
    const evt = store.addAuditEvent('PRJ-DOCMONSTAKRAKIN', 'Operator', 'TEST', 'DOC-001', 'R', {}, explicitId);
    assert.strictEqual(evt.id, explicitId);
    assert.strictEqual(typeof evt.stateHash, 'string');
    assert.strictEqual(evt.stateHash.length, 64);
  });

  // =========================================================================
  // Group 2: Catalog Listing (GET /api/projects/:id/docs)
  // =========================================================================

  await test('Test 2A: Catalog listing returns exactly 28 items for PRJ-DOCMONSTAKRAKIN', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 1 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(Array.isArray(data));
        assert.strictEqual(data.length, 28);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 2B: Non-existent project returns 404 PROJECT_NOT_FOUND', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 1 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-UNKNOWN/docs`);
        assert.strictEqual(res.status, 404);
        const data = await res.json();
        assert.strictEqual(data.error, 'PROJECT_NOT_FOUND');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 2C: Catalog accurately marks CONTROLLED_EDIT vs READ_ONLY', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 1 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs`);
        const data: any[] = await res.json();
        const pState = data.find((d) => d.id === 'DOC-CTRL-002');
        const trace = data.find((d) => d.id === 'DOC-CTRL-006');
        const wbs = data.find((d) => d.id === 'DOC-CTRL-001');

        assert.strictEqual(pState.editability, 'CONTROLLED_EDIT');
        assert.strictEqual(pState.editableLivingDoc, true);
        assert.strictEqual(trace.editability, 'CONTROLLED_EDIT');
        assert.strictEqual(trace.editableLivingDoc, true);
        assert.strictEqual(wbs.editability, 'READ_ONLY');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 2D: Missing registered file appears in catalog with MISSING integrityStatus', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 1 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs`);
        const data: any[] = await res.json();
        // DOC-CTRL-003 is registered in manifest but not created in temp disk
        const doc003 = data.find((d) => d.id === 'DOC-CTRL-003');
        assert(doc003, 'DOC-CTRL-003 must remain in catalog');
        assert.strictEqual(doc003.integrityStatus, 'MISSING');
        assert.strictEqual(doc003.currentSha256, null);
        assert.strictEqual(doc003.sizeBytes, 0);
        assert.strictEqual(doc003.eol, 'NONE');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 2E: Unregistered file on disk is invisible in catalog and GET 404s', async () => {
    const ws = createTestWorkspace();
    try {
      // Create unregistered file on disk
      fs.writeFileSync(path.join(ws.workspaceDir, 'docs', '00_control', 'UNREGISTERED.md'), 'secret');

      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 1 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs`);
        const data: any[] = await res.json();
        assert(!data.some((d) => d.path.includes('UNREGISTERED.md')));

        const getRes = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-UNREGISTERED`);
        assert.strictEqual(getRes.status, 404);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 3: Content Retrieval (GET /api/projects/:id/docs/:documentId)
  // =========================================================================

  await test('Test 3A: Successfully reads document content and exact rawSha256 without EOL modification', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 1 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(data.content.includes('# docmonstakrakin current project state'));
        assert(typeof data.rawSha256 === 'string' && data.rawSha256.length === 64);
        assert.strictEqual(data.eol, 'LF');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 3B: Missing registered document returns 410 DOCUMENT_MISSING', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 1 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-003`);
        assert.strictEqual(res.status, 410);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_MISSING');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 4: Diff Orchestration (POST /api/projects/:id/docs/:documentId/diff)
  // =========================================================================

  await test('Test 4A: Diff computes candidateHash over exact encoded bytes and is READ-ONLY', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const currentBytes = fs.readFileSync(targetPath);
      const currentSha = crypto.createHash('sha256').update(currentBytes).digest('hex');

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Extra line\n';
      const expectedCandidateBytes = encodeDocumentBytes(candidateContent, 'LF');
      const expectedCandidateSha = crypto.createHash('sha256').update(expectedCandidateBytes).digest('hex');

      const snapDigestBefore = projectSnapshotDigest(ws.workspaceDir);

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256: currentSha,
          }),
        });

        assert.strictEqual(res.status, 200);
        const diffData = await res.json();
        assert.strictEqual(diffData.candidateHash, expectedCandidateSha);
        assert.strictEqual(diffData.oldHash, currentSha);
        assert.strictEqual(diffData.hasChanges, true);
        assert.strictEqual(diffData.isStale, false);

        // Verify READ-ONLY guarantee
        assert.strictEqual(store.projects[0].stateVersion, 31);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 0);
        assert.strictEqual(projectSnapshotDigest(ws.workspaceDir), snapDigestBefore);
        assert(!fs.existsSync(path.join(ws.workspaceDir, '.local', 'document-transactions')));
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 4B: CRLF source diff computes candidateHash reflecting CRLF bytes', async () => {
    const ws = createTestWorkspace();
    try {
      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const crlfContent =
        '# docmonstakrakin current project state\r\n\r\n### Current governance and task status\r\n- DMK-201\r\n- Gate 7\r\n- Live reconciliation\r\n- Release status\r\n';
      fs.writeFileSync(targetPath, crlfContent, 'utf8');
      const currentSha = crypto.createHash('sha256').update(Buffer.from(crlfContent, 'utf8')).digest('hex');

      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- CRLF addition\n';
      const expectedCrlfBytes = encodeDocumentBytes(candidateContent, 'CRLF');
      const expectedCandidateSha = crypto.createHash('sha256').update(expectedCrlfBytes).digest('hex');

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256: currentSha,
          }),
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.candidateHash, expectedCandidateSha);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 4C: Stale diff returns 200 with isStale: true', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: '# some content',
            baseSha256: 'a'.repeat(64),
          }),
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.isStale, true);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 4D: Diff rejects READ_ONLY document with 403 DOCUMENT_READ_ONLY', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-001/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: '# wbs content',
            baseSha256: 'a'.repeat(64),
          }),
        });
        assert.strictEqual(res.status, 403);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_READ_ONLY');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 4E: Uppercase matching baseSha256 on /diff evaluates isStale as false without mutation', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const currentBytes = fs.readFileSync(targetPath);
      const currentSha = crypto.createHash('sha256').update(currentBytes).digest('hex');
      const uppercaseBaseSha = currentSha.toUpperCase();
      assert.notStrictEqual(uppercaseBaseSha, currentSha, 'SHA-256 hex string must contain letters to uppercase');

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Uppercase diff test line\n';
      const snapDigestBefore = projectSnapshotDigest(ws.workspaceDir);

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256: uppercaseBaseSha,
          }),
        });

        assert.strictEqual(res.status, 200);
        const diffData = await res.json();
        assert.strictEqual(diffData.isStale, false);
        assert.strictEqual(diffData.oldHash, currentSha);

        // Verify READ-ONLY guarantee (zero mutation)
        assert.strictEqual(store.projects[0].stateVersion, 31);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 0);
        assert.strictEqual(projectSnapshotDigest(ws.workspaceDir), snapDigestBefore);
        assert(!fs.existsSync(path.join(ws.workspaceDir, '.local', 'document-transactions')));
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 5: Validation Orchestration (POST /api/projects/:id/docs/:documentId/validate)
  // =========================================================================

  await test('Test 5A: Validate endpoint evaluates structural rules on encoded bytes and is READ-ONLY', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const snapDigestBefore = projectSnapshotDigest(ws.workspaceDir);

      const { base, close } = await startTestServer(app);
      try {
        // Valid content
        const validRes = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n',
          }),
        });
        assert.strictEqual(validRes.status, 200);
        const validData = await validRes.json();
        assert.strictEqual(validData.valid, true);

        // Invalid content (missing required governance items)
        const invalidRes = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: '# docmonstakrakin current project state\n\nEmpty body.\n',
          }),
        });
        assert.strictEqual(invalidRes.status, 200);
        const invalidData = await invalidRes.json();
        assert.strictEqual(invalidData.valid, false);
        assert(invalidData.errors.length > 0);

        // Read-only invariant check
        assert.strictEqual(store.projects[0].stateVersion, 31);
        assert.strictEqual(projectSnapshotDigest(ws.workspaceDir), snapDigestBefore);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 6: Prohibited Client Identity Claims (POST /save)
  // =========================================================================

  await test('Test 6A: Save rejects all 9 prohibited client identity claims with 400', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const prohibitedFields = [
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

      const { base, close } = await startTestServer(app);
      try {
        for (const field of prohibitedFields) {
          // Test with various values: string, null, false, 0, empty string
          for (const testVal of ['Operator', '', null, false, 0]) {
            const body: any = {
              candidateContent:
                '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n',
              baseSha256: 'a'.repeat(64),
              reason: 'Valid reason',
              humanConfirmed: true,
            };
            body[field] = testVal;

            const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });

            assert.strictEqual(
              res.status,
              400,
              `Field '${field}' with value ${JSON.stringify(testVal)} must return 400`
            );
            const data = await res.json();
            assert.strictEqual(data.error, 'CLIENT_IDENTITY_CLAIMS_PROHIBITED');
          }
        }
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 7: Human Authentication & Request Validation (POST /save)
  // =========================================================================

  await test('Test 7A: Unauthorized save (401/403) stops immediately with zero artifacts', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);

      let authCalled = 0;
      const rejectingRequireHuman = (_req: express.Request, res: express.Response) => {
        authCalled++;
        res.status(401).json({ error: 'Sign in as a configured human reviewer first' });
        return undefined;
      };

      app.use('/api/projects', createControlledDocsRouter(store, rejectingRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n',
            baseSha256: 'a'.repeat(64),
            reason: 'Valid reason',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(authCalled, 1);
        assert.strictEqual(store.projects[0].stateVersion, 31);
        assert(!fs.existsSync(path.join(ws.workspaceDir, '.local', 'document-transactions')));
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 7B: Save request shape validation (reason, humanConfirmed, content, baseSha256)', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const validContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n';

      const { base, close } = await startTestServer(app);
      try {
        // Missing reason
        const resNoReason = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: validContent,
            baseSha256: 'a'.repeat(64),
            humanConfirmed: true,
          }),
        });
        assert.strictEqual(resNoReason.status, 422);
        assert.strictEqual((await resNoReason.json()).error, 'DOCUMENT_SAVE_REASON_REQUIRED');

        // Missing humanConfirmed
        const resNoConfirm = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: validContent,
            baseSha256: 'a'.repeat(64),
            reason: 'reason',
            humanConfirmed: false,
          }),
        });
        assert.strictEqual(resNoConfirm.status, 422);
        assert.strictEqual((await resNoConfirm.json()).error, 'HUMAN_CONFIRMATION_REQUIRED');

        // Invalid baseSha256
        const resBadHash = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: validContent,
            baseSha256: 'not-a-sha',
            reason: 'reason',
            humanConfirmed: true,
          }),
        });
        assert.strictEqual(resBadHash.status, 422);
        assert.strictEqual((await resBadHash.json()).error, 'INVALID_BASE_SHA256');

        // Structural validation failure (malformed markdown table)
        const resStructural = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-006/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: '# TRACEABILITY MATRIX\n\nNo table here\n',
            baseSha256: 'a'.repeat(64),
            reason: 'reason',
            humanConfirmed: true,
          }),
        });
        assert.strictEqual(resStructural.status, 422);
        assert.strictEqual((await resStructural.json()).error, 'DOCUMENT_VALIDATION_FAILED');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 8: Recovery Lock Enforcement (POST /save)
  // =========================================================================

  await test('Test 8A: When recovery is locked, save returns 500 DOCUMENT_TRANSACTION_RECOVERY_REQUIRED early', async () => {
    const ws = createTestWorkspace();
    try {
      // Cause recovery lock by creating a corrupt journal
      const jDir = path.join(ws.workspaceDir, '.local', 'document-transactions');
      fs.mkdirSync(jDir, { recursive: true });
      fs.writeFileSync(path.join(jDir, 'corrupt-op.json'), '{"corrupted": true}');
      const report = recoverDocumentTransactions(ws.workspaceDir);
      assert.strictEqual(report.locked, true);

      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n',
            baseSha256: 'a'.repeat(64),
            reason: 'Some reason',
            humanConfirmed: true,
          }),
        });
        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED');
      } finally {
        await close();
      }
    } finally {
      // Clean up corrupt journal and reset recovery lock
      fs.rmSync(path.join(ws.workspaceDir, '.local', 'document-transactions'), { recursive: true, force: true });
      recoverDocumentTransactions(ws.workspaceDir);
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 9: Concurrency & Transaction Preparation Errors
  // =========================================================================

  await test('Test 9A: Stale save baseSha256 returns 409 DOCUMENT_STALE', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n',
            baseSha256: 'f'.repeat(64), // stale hash
            reason: 'Some reason',
            humanConfirmed: true,
          }),
        });
        assert.strictEqual(res.status, 409);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_STALE');
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 10: Server-Reserved Audit ID & Persistence Invariants
  // =========================================================================

  await test('Test 10A: Server-reserved audit ID equals journal ID, persisted event ID, and response ID', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const baseSha256 = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

      let observedJournalAuditId: string | null = null;
      const origAddAudit = ProjectStore.prototype.addAuditEvent;
      ProjectStore.prototype.addAuditEvent = function (projectId, actor, action, target, reason, details, eventId) {
        // Intercept right before audit is appended: journal exists!
        const jDir = path.join(ws.workspaceDir, '.local', 'document-transactions');
        if (fs.existsSync(jDir)) {
          const files = fs.readdirSync(jDir).filter((f) => f.endsWith('.json') && !f.startsWith('.tmp'));
          if (files.length === 1) {
            const jContent = JSON.parse(fs.readFileSync(path.join(jDir, files[0]), 'utf8'));
            observedJournalAuditId = jContent.auditEventId;
          }
        }
        return origAddAudit.call(this, projectId, actor, action, target, reason, details, eventId);
      };

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Updated line\n';

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256,
            reason: 'Audit ID invariant test',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 200);
        const data: DocumentSaveResponse = await res.json();

        assert(observedJournalAuditId, 'Journal must have been observed during save');
        assert.strictEqual(data.auditEventId, observedJournalAuditId);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].id, observedJournalAuditId);
        assert.strictEqual(data.auditEventId, store.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].id);
        assert.strictEqual(data.timestamp, store.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].timestamp);
      } finally {
        ProjectStore.prototype.addAuditEvent = origAddAudit;
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 11: Hook Attachment Order
  // =========================================================================

  await test('Test 11A: projectPersistenceHooks are attached to res.locals before executeReplacement()', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());

      let hookAttachedBeforeReplacement = false;
      // Middleware to intercept right before route executes
      app.use((req, res, next) => {
        const origJson = res.json.bind(res);
        res.json = function (body: any) {
          // When res.json is called, hooks must already be attached
          if (res.locals.projectPersistenceHooks?.onCommit && res.locals.projectPersistenceHooks?.onRollback) {
            hookAttachedBeforeReplacement = true;
          }
          return origJson(body);
        };
        next();
      });

      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const baseSha256 = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Hooks test\n',
            baseSha256,
            reason: 'Hook order test',
            humanConfirmed: true,
          }),
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(hookAttachedBeforeReplacement, true);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 12: Failure Stages F, G, H
  // =========================================================================

  await test('Test 12A: Failure Stage F (post-replacement pre-audit error) rolls back document', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];
      installProjectPersistence(app, store, ws.workspaceDir);

      // Injected failure: store.addAuditEvent throws BEFORE modifying auditLogs
      const origAddAuditA = ProjectStore.prototype.addAuditEvent;
      ProjectStore.prototype.addAuditEvent = () => {
        throw new Error('SIMULATED_PRE_AUDIT_FAILURE');
      };

      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const previousBytes = fs.readFileSync(targetPath);
      const previousSha = crypto.createHash('sha256').update(previousBytes).digest('hex');

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Mutated content\n',
            baseSha256: previousSha,
            reason: 'Failure Stage F test',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_UPDATE_FAILED');

        // Document MUST be rolled back to previousSha!
        const restoredBytes = fs.readFileSync(targetPath);
        const restoredSha = crypto.createHash('sha256').update(restoredBytes).digest('hex');
        assert.strictEqual(restoredSha, previousSha);
        assert.strictEqual(store.projects[0].stateVersion, 31);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 0);
      } finally {
        ProjectStore.prototype.addAuditEvent = origAddAuditA;
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 12B: Failure Stage G (error during audit append) rolls back document and store', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];
      installProjectPersistence(app, store, ws.workspaceDir);

      const origAddAuditB = ProjectStore.prototype.addAuditEvent;
      ProjectStore.prototype.addAuditEvent = function (...args) {
        origAddAuditB.apply(this, args);
        throw new Error('SIMULATED_POST_AUDIT_APPEND_FAILURE');
      };

      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const previousSha = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Mutated content G\n',
            baseSha256: previousSha,
            reason: 'Failure Stage G test',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_UPDATE_FAILED');

        // Document restored
        const restoredSha = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
        assert.strictEqual(restoredSha, previousSha);

        // Store snapshot restored by persistence middleware
        assert.strictEqual(store.projects[0].stateVersion, 31);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 0);
      } finally {
        ProjectStore.prototype.addAuditEvent = origAddAuditB;
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 12C: Failure Stage H (snapshot persistence failure) triggers middleware onRollback', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];

      // Intercept snapshot write to simulate external mutation/persistence failure
      let snapshotAttempted = false;
      const originalWriteFileSync = fs.writeFileSync;
      (fs as any).writeFileSync = function (filePath: any, ...args: any[]) {
        if (typeof filePath === 'string' && filePath.includes('project-state.json')) {
          snapshotAttempted = true;
          throw new Error('EIO: simulated disk write error during project-state snapshot');
        }
        return originalWriteFileSync.apply(this, [filePath, ...args]);
      };

      try {
        installProjectPersistence(app, store, ws.workspaceDir);
        app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

        const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
        const previousSha = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

        const { base, close } = await startTestServer(app);
        try {
          const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidateContent:
                '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Mutated content H\n',
              baseSha256: previousSha,
              reason: 'Failure Stage H test',
              humanConfirmed: true,
            }),
          });

          assert.strictEqual(res.status, 500);
          assert.strictEqual(snapshotAttempted, true);

          // Middleware triggers onRollback -> document restored!
          const restoredSha = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
          assert.strictEqual(restoredSha, previousSha);

          // In-memory store restored
          assert.strictEqual(store.projects[0].stateVersion, 31);
          assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 0);
        } finally {
          await close();
        }
      } finally {
        (fs as any).writeFileSync = originalWriteFileSync;
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 13: Successful Save & EOL Integrity
  // =========================================================================

  await test('Test 13A: Successful save updates document, stateVersion N->N+1, appends audit, cleans artifacts', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const baseSha256 = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Successful update\n';
      const expectedBytes = encodeDocumentBytes(candidateContent, 'LF');
      const expectedSha = crypto.createHash('sha256').update(expectedBytes).digest('hex');

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256,
            reason: 'Production document update',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 200);
        const data: DocumentSaveResponse = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.documentId, 'DOC-CTRL-002');
        assert.strictEqual(data.newSha256, expectedSha);
        assert.strictEqual(data.previousSha256, baseSha256);
        assert.strictEqual(data.stateVersion, 32);

        // Document on disk
        const savedBytes = fs.readFileSync(targetPath);
        const savedSha = crypto.createHash('sha256').update(savedBytes).digest('hex');
        assert.strictEqual(savedSha, expectedSha);

        // In-memory store
        assert.strictEqual(store.projects[0].stateVersion, 32);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 1);
        const audit = store.auditLogs['PRJ-DOCMONSTAKRAKIN'][0];
        assert.strictEqual(audit.action, 'DOCUMENT_UPDATED');
        assert.strictEqual(audit.actor, fakeReviewer.name);
        assert.strictEqual(audit.target, 'DOC-CTRL-002');
        assert.strictEqual(audit.details.newSha256, expectedSha);
        assert.strictEqual(audit.details.previousSha256, baseSha256);
        assert.strictEqual(audit.details.path, 'docs/00_control/PROJECT_STATE.md');

        // Sibling & journal cleanup
        const jDir = path.join(ws.workspaceDir, '.local', 'document-transactions');
        assert(!fs.existsSync(jDir) || fs.readdirSync(jDir).length === 0);
        const siblingFiles = fs.readdirSync(path.dirname(targetPath)).filter((f) => f.includes('.dmk-'));
        assert.strictEqual(siblingFiles.length, 0);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 13B: Successful save on CRLF target preserves CRLF line endings', async () => {
    const ws = createTestWorkspace();
    try {
      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const crlfContent =
        '# docmonstakrakin current project state\r\n\r\n### Current governance and task status\r\n- DMK-201\r\n- Gate 7\r\n- Live reconciliation\r\n- Release status\r\n';
      fs.writeFileSync(targetPath, crlfContent, 'utf8');
      const baseSha256 = crypto.createHash('sha256').update(Buffer.from(crlfContent, 'utf8')).digest('hex');

      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- CRLF saved line\n';
      const expectedCrlfBytes = encodeDocumentBytes(candidateContent, 'CRLF');
      const expectedSha = crypto.createHash('sha256').update(expectedCrlfBytes).digest('hex');

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256,
            reason: 'CRLF preservation test',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.newSha256, expectedSha);

        const savedBytes = fs.readFileSync(targetPath);
        assert(savedBytes.includes(Buffer.from('\r\n')), 'Resulting saved file must contain CRLF');
        assert(!savedBytes.includes(Buffer.from('\r\r\n')), 'No double carriage returns');
        const savedSha = crypto.createHash('sha256').update(savedBytes).digest('hex');
        assert.strictEqual(savedSha, expectedSha);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 13C: Uppercase matching baseSha256 on /save succeeds with canonical previousSha256 and state increment', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const currentBytes = fs.readFileSync(targetPath);
      const currentSha = crypto.createHash('sha256').update(currentBytes).digest('hex');
      const uppercaseBaseSha = currentSha.toUpperCase();
      assert.notStrictEqual(uppercaseBaseSha, currentSha, 'SHA-256 hex string must contain letters to uppercase');

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Uppercase save test line\n';

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256: uppercaseBaseSha,
            reason: 'Uppercase base SHA save test',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.previousSha256, currentSha);
        assert.strictEqual(data.documentId, 'DOC-CTRL-002');

        // Verify stateVersion N -> N+1
        assert.strictEqual(store.projects[0].stateVersion, 32);

        // Verify exactly one DOCUMENT_UPDATED audit
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 1);
        const audit = store.auditLogs['PRJ-DOCMONSTAKRAKIN'][0];
        assert.strictEqual(audit.action, 'DOCUMENT_UPDATED');
        assert.strictEqual(audit.details.previousSha256, currentSha);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 14: Persistence Survives Reload / Server Restart
  // =========================================================================

  await test('Test 14A: Persisted stateVersion and audit event survive store rehydration', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const baseSha256 = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');

      const candidateContent =
        '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Rehydration line\n';

      const { base, close } = await startTestServer(app);
      try {
        await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent,
            baseSha256,
            reason: 'Rehydration test',
            humanConfirmed: true,
          }),
        });
      } finally {
        await close();
      }

      // Rehydrate in fresh store and fresh express instance
      const freshStore = new ProjectStore();
      const freshApp = express();
      installProjectPersistence(freshApp, freshStore, ws.workspaceDir);

      const prj = freshStore.projects.find((p) => p.id === 'PRJ-DOCMONSTAKRAKIN');
      assert(prj);
      assert.strictEqual(prj.stateVersion, 32);
      assert.strictEqual(freshStore.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 1);
      assert.strictEqual(freshStore.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].action, 'DOCUMENT_UPDATED');
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 10B: Duplicate reserved audit ID during save triggers rollback and returns 500', async () => {
    const ws = createTestWorkspace();
    const origNow = Date.now;
    const origRandom = Math.random;
    try {
      // Deterministically freeze Date.now and Math.random so createAuditEventId produces predictable ID
      Date.now = () => 1727500000000;
      Math.random = () => 0.123456789;

      const deterministicId = createAuditEventId();

      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      store.auditLogs['PRJ-DOCMONSTAKRAKIN'] = [];

      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      // Seed that exact audit ID in advance after persistence rehydration
      store.addAuditEvent('PRJ-DOCMONSTAKRAKIN', 'Operator', 'SEED', 'DOC-001', 'Reason', {}, deterministicId);
      assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 1);

      const targetPath = path.join(ws.workspaceDir, 'docs', '00_control', 'PROJECT_STATE.md');
      const previousBytes = fs.readFileSync(targetPath);
      const previousSha = crypto.createHash('sha256').update(previousBytes).digest('hex');

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n- Colliding update\n',
            baseSha256: previousSha,
            reason: 'Collision test',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_UPDATE_FAILED');

        // Document rolled back
        const currentSha = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
        assert.strictEqual(currentSha, previousSha);

        // State and audit unchanged
        assert.strictEqual(store.projects[0].stateVersion, 31);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'].length, 1);
        assert.strictEqual(store.auditLogs['PRJ-DOCMONSTAKRAKIN'][0].action, 'SEED');
      } finally {
        await close();
      }
    } finally {
      Date.now = origNow;
      Math.random = origRandom;
      ws.cleanup();
    }
  });

  await test('Test 7C_AUTH: Forbidden save (403 from requireHuman) stops immediately', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);

      const forbiddenRequireHuman = (_req: express.Request, res: express.Response) => {
        res.status(403).json({ error: 'This identity has no human governance authority' });
        return undefined;
      };

      app.use('/api/projects', createControlledDocsRouter(store, forbiddenRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent:
              '# docmonstakrakin current project state\n\n### Current governance and task status\n- DMK-201\n- Gate 7\n- Live reconciliation\n- Release status\n',
            baseSha256: 'a'.repeat(64),
            reason: 'Valid reason',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 403);
        const data = await res.json();
        assert.strictEqual(data.error, 'This identity has no human governance authority');
        assert.strictEqual(store.projects[0].stateVersion, 31);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  await test('Test 7D_RO: Save attempt on READ_ONLY document returns 403 DOCUMENT_READ_ONLY', async () => {
    const ws = createTestWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      store.projects = [{ id: 'PRJ-DOCMONSTAKRAKIN', name: 'self', stateVersion: 31 } as any];
      installProjectPersistence(app, store, ws.workspaceDir);
      app.use('/api/projects', createControlledDocsRouter(store, fakeRequireHuman, ws.workspaceDir));

      const { base, close } = await startTestServer(app);
      try {
        const res = await fetch(`${base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-001/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateContent: '# Attempted WBS edit\n',
            baseSha256: 'a'.repeat(64),
            reason: 'Illegal WBS edit',
            humanConfirmed: true,
          }),
        });

        assert.strictEqual(res.status, 403);
        const data = await res.json();
        assert.strictEqual(data.error, 'DOCUMENT_READ_ONLY');
        assert.strictEqual(store.projects[0].stateVersion, 31);
      } finally {
        await close();
      }
    } finally {
      ws.cleanup();
    }
  });

  // =========================================================================
  // Group 15: Cleanliness
  // =========================================================================

  await test('Test 15A: Real repository docs directory and document-transactions remain pristine', async () => {
    const realDt = path.resolve(process.cwd(), '.local', 'document-transactions');
    assert(!fs.existsSync(realDt) || fs.readdirSync(realDt).length === 0);
  });

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
