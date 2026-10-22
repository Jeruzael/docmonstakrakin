import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import express from 'express';
import {
  classifyProjectRequestMode,
  installProjectPersistence,
  type ProjectPersistenceMode,
  readProjectSnapshot,
  projectSnapshotDigest,
} from '../server/projectPersistence.ts';
import { ProjectStore } from '../server/projectStore.ts';

// Helper to create a temp workspace initialized with a valid snapshot
function createTempWorkspace(): { dir: string; cleanup: () => void; snapshotPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk195-test-persist-'));
  const localDir = path.join(dir, '.local');
  fs.mkdirSync(localDir, { recursive: true });
  const snapshotPath = path.join(localDir, 'project-state.json');

  const initialStore = new ProjectStore();
  const testProject = {
    ...initialStore.projects[0],
    id: 'PRJ-DOCMONSTAKRAKIN',
    name: 'Docmonstakrakin Controlled Docs',
    stateVersion: 1,
  };
  initialStore.projects = [testProject, ...initialStore.projects];
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify({ schemaVersion: 1, state: structuredClone({ ...initialStore }) }, null, 2) + '\n',
    'utf8'
  );

  return {
    dir,
    snapshotPath,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    },
  };
}

async function startTestServer(app: express.Express): Promise<{ base: string; close: () => Promise<void> }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function runTests() {
  console.log('--- Starting Task 2: Persistence Middleware Classifier & Hooks Tests ---');
  let passed = 0;

  // ============================================================
  // 1. UNIT TESTS: classifyProjectRequestMode contract (A - H)
  // ============================================================
  console.log('\n[Group 1] Unit tests for classifyProjectRequestMode:');
  for(const suffix of ['diff/','validate/','DIFF','VaLiDaTe/']){
    assert.equal(classifyProjectRequestMode({method:'POST',baseUrl:'/API/PROJECTS',path:`/synthetic/docs/MDOC-synthetic/${suffix}`}), 'READ_ONLY');
    console.log(`  PASS read-only document alias ${suffix}`);passed++;
  }

  // A. POST diff => READ_ONLY
  {
    const req = {
      method: 'POST',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff',
    } as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'READ_ONLY');
    console.log('  ✓ A. POST diff -> READ_ONLY');
    passed++;
  }

  // B. POST validate => READ_ONLY
  {
    const req = {
      method: 'POST',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/validate',
    } as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'READ_ONLY');
    console.log('  ✓ B. POST validate -> READ_ONLY');
    passed++;
  }

  // C. POST save => MUTATING
  {
    const req = {
      method: 'POST',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/save',
    } as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'MUTATING');
    console.log('  ✓ C. POST save -> MUTATING');
    passed++;
  }

  // D. PATCH diff => MUTATING
  {
    const req = {
      method: 'PATCH',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff',
    } as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'MUTATING');
    console.log('  ✓ D. PATCH diff -> MUTATING');
    passed++;
  }

  // E. PUT validate => MUTATING
  {
    const req = {
      method: 'PUT',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/validate',
    } as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'MUTATING');
    console.log('  ✓ E. PUT validate -> MUTATING');
    passed++;
  }

  // F. DELETE diff => MUTATING
  {
    const req = {
      method: 'DELETE',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff',
    } as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'MUTATING');
    console.log('  ✓ F. DELETE diff -> MUTATING');
    passed++;
  }

  // G. unrelated project POST => MUTATING
  {
    const req = {
      method: 'POST',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/work-items',
    } as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'MUTATING');
    console.log('  ✓ G. unrelated project POST -> MUTATING');
    passed++;
  }

  // H. client cannot force READ_ONLY via body/query/headers
  {
    const req = {
      method: 'POST',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/work-items',
      headers: { 'x-persistence-mode': 'READ_ONLY' },
      query: { mode: 'READ_ONLY' },
      body: { persistenceMode: 'READ_ONLY' },
    } as unknown as express.Request;
    assert.equal(classifyProjectRequestMode(req), 'MUTATING');

    const reqDiff = {
      method: 'POST',
      baseUrl: '/api/projects',
      path: '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff',
      headers: { 'x-persistence-mode': 'MUTATING' },
      query: { mode: 'MUTATING' },
      body: { persistenceMode: 'MUTATING' },
    } as unknown as express.Request;
    assert.equal(classifyProjectRequestMode(reqDiff), 'READ_ONLY');
    console.log('  ✓ H. client claims cannot alter server-derived classification');
    passed++;
  }

  // ============================================================
  // 2. REAL EXPRESS MOUNT TEST: Routed path handling
  // ============================================================
  console.log('\n[Group 2] Real Express Mount with req.baseUrl + req.path:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      const projectRouter = express.Router();
      projectRouter.post('/:id/docs/:docId/diff', (req, res) => {
        res.json({
          baseUrl: req.baseUrl,
          path: req.path,
          mode: res.locals.projectPersistenceMode,
        });
      });
      app.use('/api/projects', projectRouter);

      const server = await startTestServer(app);
      try {
        const res = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: 'test' }),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.baseUrl, '/api/projects');
        assert.equal(data.path, '/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff');
        assert.equal(data.mode, 'READ_ONLY');
        console.log('  ✓ Classifier observes req.baseUrl and resolves full routed path under real Express mount');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 3. READ_ONLY DOES NOT PERSIST OR CAUSE SIDE EFFECTS
  // ============================================================
  console.log('\n[Group 3] READ_ONLY zero persistence side effects:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      app.post('/api/projects/:id/docs/:docId/diff', (req, res) => {
        // Even if route handler inspects or calculates diff, no state mutation
        res.json({ diff: 'no changes' });
      });
      app.post('/api/projects/:id/docs/:docId/validate', (req, res) => {
        res.json({ valid: true });
      });

      const server = await startTestServer(app);
      try {
        const beforeHash = projectSnapshotDigest(ws.dir);
        const beforeBytes = fs.readFileSync(ws.snapshotPath);

        const resDiff = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: 'hello' }),
        });
        assert.equal(resDiff.status, 200);

        const resVal = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: 'hello' }),
        });
        assert.equal(resVal.status, 200);

        const afterHash = projectSnapshotDigest(ws.dir);
        const afterBytes = fs.readFileSync(ws.snapshotPath);

        assert.equal(afterHash, beforeHash, 'Snapshot digest must remain identical');
        assert.deepEqual(afterBytes, beforeBytes, 'Snapshot bytes must remain identical');

        // Verify zero lock files or temp files created
        const localFiles = fs.readdirSync(path.join(ws.dir, '.local'));
        assert(
          !localFiles.some((f) => f.includes('.tmp.') || f.endsWith('.lock')),
          'Zero tmp or lock files permitted for READ_ONLY'
        );
        console.log('  ✓ POST /diff and /validate cause zero persistence side effects or file locks');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 4. READ_ONLY DOES NOT ACQUIRE transactionInFlight
  // ============================================================
  console.log('\n[Group 4] READ_ONLY does not acquire transactionInFlight:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      app.post('/api/projects/:id/docs/:docId/diff', async (req, res) => {
        // Hold READ_ONLY open for 60ms
        await new Promise((r) => setTimeout(r, 60));
        res.json({ diff: 'delayed' });
      });

      app.post('/api/projects/:id/mutate-test', (req, res) => {
        const prj = store.projects.find((p) => p.id === req.params.id);
        if (prj) prj.stateVersion = (prj.stateVersion ?? 0) + 1;
        res.json({ ok: true, version: prj?.stateVersion });
      });

      const server = await startTestServer(app);
      try {
        // Start READ_ONLY in background
        const readOnlyPromise = fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        // Small wait to ensure readOnly request is active inside the middleware
        await new Promise((r) => setTimeout(r, 15));

        // Trigger mutating request concurrently
        const mutateRes = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/mutate-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.equal(mutateRes.status, 200, 'Mutating request must succeed while READ_ONLY is active');
        const readOnlyRes = await readOnlyPromise;
        assert.equal(readOnlyRes.status, 200);
        console.log('  ✓ Concurrent mutating request is not blocked by active READ_ONLY request');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 5. READ_ONLY SKIPS STORE CLONING
  // ============================================================
  console.log('\n[Group 5] READ_ONLY skips structuredClone:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      // Attach an un-cloneable property to store that structuredClone rejects
      (store as any).__uncloneableFn = () => {};

      installProjectPersistence(app, store, ws.dir);

      app.post('/api/projects/:id/docs/:docId/diff', (req, res) => {
        res.json({ diff: 'ok' });
      });

      app.post('/api/projects/:id/mutate-fail', (req, res) => {
        res.json({ ok: true });
      });

      const server = await startTestServer(app);
      try {
        // READ_ONLY must skip structuredClone({ ...store }) and succeed
        const resDiff = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/docs/DOC-CTRL-002/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.equal(resDiff.status, 200, 'READ_ONLY must skip store cloning and return 200');

        // Mutating route attempting to clone store throws DataCloneError and fails
        // (confirming our uncloneable canary is genuinely uncloneable)
        let mutateError = false;
        try {
          structuredClone({ ...store });
        } catch {
          mutateError = true;
        }
        assert.equal(mutateError, true, 'Canary function must be uncloneable by structuredClone');

        console.log('  ✓ READ_ONLY successfully skips store cloning');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 6. onCommit ORDERING AND SINGLE EXECUTION
  // ============================================================
  console.log('\n[Group 6] onCommit lifecycle hook ordering:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      let commitCallCount = 0;
      let stateVersionOnDiskAtCommit = -1;

      app.post('/api/projects/:id/hook-commit-test', (req, res) => {
        const prj = store.projects.find((p) => p.id === req.params.id);
        if (prj) prj.stateVersion = (prj.stateVersion ?? 0) + 1;

        res.locals.projectPersistenceHooks = {
          onCommit: () => {
            commitCallCount++;
            // Read disk directly during onCommit
            const diskSnap = readProjectSnapshot(ws.dir);
            const diskPrj = diskSnap?.state?.projects?.find((p: any) => p.id === req.params.id);
            stateVersionOnDiskAtCommit = diskPrj?.stateVersion ?? -1;
          },
        };

        res.json({ ok: true, version: prj?.stateVersion });
      });

      const server = await startTestServer(app);
      try {
        const res = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/hook-commit-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(commitCallCount, 1, 'onCommit must be called exactly once');
        assert.equal(
          stateVersionOnDiskAtCommit,
          data.version,
          'State must already be durably persisted on disk before onCommit runs'
        );
        console.log('  ✓ onCommit executes exactly once after durable disk write');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 7. SNAPSHOT PERSISTENCE FAILURE + onRollback
  // ============================================================
  console.log('\n[Group 7] onRollback on snapshot persistence failure:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      let rollbackCallCount = 0;
      let rollbackErrorReceived: any = null;
      let commitCallCount = 0;
      const initialVersion = store.projects[0].stateVersion ?? 0;

      app.post('/api/projects/:id/persist-fail-test', (req, res) => {
        const prj = store.projects.find((p) => p.id === req.params.id);
        if (prj) prj.stateVersion = (prj.stateVersion ?? 0) + 99;

        res.locals.projectPersistenceHooks = {
          onCommit: () => {
            commitCallCount++;
          },
          onRollback: (err) => {
            rollbackCallCount++;
            rollbackErrorReceived = err;
          },
        };

        res.json({ ok: true });
      });

      // Inject deterministic lock collision to make writeProjectSnapshotAtomic fail
      const lockFile = path.join(ws.dir, '.local', 'project-state.write.lock');
      fs.writeFileSync(lockFile, 'synthetic conflict lock');

      const server = await startTestServer(app);
      try {
        const res = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/persist-fail-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.equal(res.status, 500, 'Persistence failure must return 500');
        assert.equal(rollbackCallCount, 1, 'onRollback must be called exactly once');
        assert(rollbackErrorReceived, 'onRollback must receive the persistence error');
        assert(
          String(rollbackErrorReceived).includes('STATE_WRITER_BUSY') ||
            String(rollbackErrorReceived?.message).includes('STATE_WRITER_BUSY'),
          'Error must contain STATE_WRITER_BUSY'
        );
        assert.equal(commitCallCount, 0, 'onCommit must not be called when persistence fails');
        assert.equal(store.projects[0].stateVersion, initialVersion, 'Store must be restored to pre-request value');

        console.log('  ✓ onRollback receives persistence error, store rolled back, onCommit skipped');
        passed++;
      } finally {
        fs.unlinkSync(lockFile);
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 7B. SNAPSHOT PERSISTENCE FAILURE + onRollback THROWS
  // ============================================================
  console.log('\n[Group 7B] onRollback failure propagation:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      let rollbackCallCount = 0;
      let commitCallCount = 0;
      const initialVersion = store.projects[0].stateVersion ?? 0;

      app.post('/api/projects/:id/rollback-throw-test', (req, res) => {
        const prj = store.projects.find((p) => p.id === req.params.id);
        if (prj) prj.stateVersion = (prj.stateVersion ?? 0) + 77;

        res.locals.projectPersistenceHooks = {
          onCommit: () => {
            commitCallCount++;
          },
          onRollback: (_err) => {
            rollbackCallCount++;
            throw new Error('DOCUMENT_TRANSACTION_RECOVERY_REQUIRED');
          },
        };

        res.json({ ok: true });
      });

      // Inject deterministic lock collision to make writeProjectSnapshotAtomic fail
      const lockFile = path.join(ws.dir, '.local', 'project-state.write.lock');
      fs.writeFileSync(lockFile, 'synthetic conflict lock');

      const server = await startTestServer(app);
      try {
        const res = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/rollback-throw-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.equal(res.status, 500, 'Persistence failure with throwing onRollback must return 500');
        const data = await res.json();
        assert.equal(rollbackCallCount, 1, 'onRollback must be called exactly once');
        assert.equal(commitCallCount, 0, 'onCommit must not be called when persistence fails');
        assert.equal(store.projects[0].stateVersion, initialVersion, 'Store must be restored to pre-request value');
        assert.equal(
          data.error,
          'DOCUMENT_TRANSACTION_RECOVERY_REQUIRED',
          'Response error must match thrown rollback error'
        );
        assert(
          !String(data.error).includes('changes rolled back'),
          'Middleware must NOT report changes rolled back when rollback hook threw'
        );

        console.log('  ✓ onRollback failure propagates safely as HTTP 500 error, without false rollback claim');
        passed++;
      } finally {
        fs.unlinkSync(lockFile);
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 8. NON-2XX ROUTE RESPONSE DOES NOT DOUBLE-ROLLBACK
  // ============================================================
  console.log('\n[Group 8] Non-2xx route response does not trigger onRollback:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      let rollbackCallCount = 0;
      const initialVersion = store.projects[0].stateVersion ?? 0;

      app.post('/api/projects/:id/error-route-test', (req, res) => {
        const prj = store.projects.find((p) => p.id === req.params.id);
        if (prj) prj.stateVersion = (prj.stateVersion ?? 0) + 1;

        res.locals.projectPersistenceHooks = {
          onRollback: () => {
            rollbackCallCount++;
          },
        };

        // Route deliberately returns 422
        res.status(422).json({ error: 'ROUTE_VALIDATION_FAILED' });
      });

      const server = await startTestServer(app);
      try {
        const res = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/error-route-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.equal(res.status, 422);
        assert.equal(
          rollbackCallCount,
          0,
          'onRollback must NOT be invoked by middleware for non-2xx route responses'
        );
        assert.equal(
          store.projects[0].stateVersion,
          initialVersion,
          'In-memory store still restored by persistence middleware on non-2xx'
        );
        console.log('  ✓ Non-2xx route response restores in-memory store without invoking onRollback');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 9. POST-COMMIT CLEANUP FAILURE SEMANTICS
  // ============================================================
  console.log('\n[Group 9] Post-commit cleanup failure does not rollback committed state:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      let rollbackCallCount = 0;
      let onCommitRan = false;

      app.post('/api/projects/:id/commit-throw-test', (req, res) => {
        const prj = store.projects.find((p) => p.id === req.params.id);
        if (prj) prj.stateVersion = (prj.stateVersion ?? 0) + 5;

        res.locals.projectPersistenceHooks = {
          onCommit: () => {
            onCommitRan = true;
            throw new Error('POST_COMMIT_CLEANUP_FAILURE');
          },
          onRollback: () => {
            rollbackCallCount++;
          },
        };

        res.json({ ok: true, version: prj?.stateVersion });
      });

      const server = await startTestServer(app);
      try {
        const res = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/commit-throw-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.equal(res.status, 200, 'Response still returns 200 since state committed durably');
        assert.equal(onCommitRan, true);
        assert.equal(rollbackCallCount, 0, 'onRollback must NOT be called if onCommit throws');

        // Verify disk has the updated stateVersion
        const diskSnap = readProjectSnapshot(ws.dir);
        assert.equal(diskSnap?.state?.projects?.[0]?.stateVersion, store.projects[0].stateVersion);
        console.log('  ✓ Post-commit cleanup exception does not revert or rollback committed snapshot');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // 10. LEGACY MUTATING ROUTES WITHOUT HOOKS
  // ============================================================
  console.log('\n[Group 10] Legacy routes without hooks:');
  {
    const ws = createTempWorkspace();
    try {
      const app = express();
      app.use(express.json());
      const store = new ProjectStore();
      installProjectPersistence(app, store, ws.dir);

      app.post('/api/projects/:id/legacy-route', (req, res) => {
        const prj = store.projects.find((p) => p.id === req.params.id);
        if (prj) prj.stateVersion = (prj.stateVersion ?? 0) + 1;
        res.json({ ok: true, version: prj?.stateVersion });
      });

      const server = await startTestServer(app);
      try {
        const res = await fetch(`${server.base}/api/projects/PRJ-DOCMONSTAKRAKIN/legacy-route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        const diskSnap = readProjectSnapshot(ws.dir);
        assert.equal(diskSnap?.state?.projects?.[0]?.stateVersion, data.version);
        console.log('  ✓ Legacy mutating route without hooks persists cleanly as before');
        passed++;
      } finally {
        await server.close();
      }
    } finally {
      ws.cleanup();
    }
  }

  console.log(`\nAll ${passed} tests in testProjectPersistenceClassifier.ts passed!`);
}

runTests().catch((err) => {
  console.error('\nFAIL in testProjectPersistenceClassifier.ts:', err);
  process.exit(1);
});
