import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  getControlledDocsRegistry,
  findControlledDoc,
  isControlledEditAllowed,
} from '../server/docs/controlledDocsRegistry.ts';
import type {
  ControlledDocumentRecord,
  ControlledDocumentEditability,
  ControlledDocumentFileType,
} from '../src/types.ts';

// Helper to create an isolated temp workspace
function createTempWorkspace(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk195-test-registry-'));
  return {
    dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    },
  };
}

async function runTests() {
  console.log('--- Starting Task 3: Controlled Document Registry & Types Tests ---');
  let passed = 0;

  const realManifestPath = path.join(process.cwd(), 'bootstrap', 'docmonstakrakin.self-bootstrap.json');
  const realManifestRaw = fs.readFileSync(realManifestPath, 'utf8');
  const realManifest = JSON.parse(realManifestRaw);

  // ============================================================
  // TEST A: EXACT REGISTRY COUNT (28 documents)
  // ============================================================
  console.log('\n[Test A] Exact registry count:');
  {
    const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    assert.equal(registry.length, 28, 'Must return exactly 28 controlled documents from manifest');
    console.log('  ✓ getControlledDocsRegistry returns exactly 28 records for PRJ-DOCMONSTAKRAKIN');
    passed++;
  }

  // ============================================================
  // TEST B: MANIFEST ID PARITY
  // ============================================================
  console.log('\n[Test B] Manifest ID parity:');
  {
    const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    const registryIds = registry.map((d) => d.id);
    const manifestIds = realManifest.documents.map((d: any) => d.id);

    assert.equal(new Set(registryIds).size, registryIds.length, 'Registry must not contain duplicate IDs');
    assert.deepEqual(registryIds.sort(), manifestIds.sort(), 'Registry IDs must match manifest IDs exactly');
    console.log('  ✓ Registry IDs exactly mirror manifest document IDs with zero additions, omissions, or duplicates');
    passed++;
  }

  // ============================================================
  // TEST C: AUTHORITY PARITY
  // ============================================================
  console.log('\n[Test C] Authority parity:');
  {
    const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    for (const doc of registry) {
      const manifestDoc = realManifest.documents.find((d: any) => d.id === doc.id);
      assert.ok(manifestDoc, `Manifest must contain document ${doc.id}`);
      assert.equal(doc.authority, manifestDoc.authority, `Authority mismatch for ${doc.id}`);
      assert.equal(doc.path, manifestDoc.path, `Path mismatch for ${doc.id}`);
      assert.equal(doc.kind, manifestDoc.kind, `Kind mismatch for ${doc.id}`);
      if (manifestDoc.sha256Digest) {
        assert.equal(doc.sha256Digest, manifestDoc.sha256Digest, `Digest mismatch for ${doc.id}`);
      }
    }
    console.log('  ✓ All 28 records preserve authority, path, kind, and sha256Digest from manifest');
    passed++;
  }

  // ============================================================
  // TEST D: EDITABLE ALLOWLIST (DOC-CTRL-002 and DOC-CTRL-006 only)
  // ============================================================
  console.log('\n[Test D] Editable allowlist:');
  {
    const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    const editableDocs = registry.filter((d) => d.editability === 'CONTROLLED_EDIT');
    const editableIds = editableDocs.map((d) => d.id).sort();

    assert.deepEqual(editableIds, ['DOC-CTRL-002', 'DOC-CTRL-006'], 'Only DOC-CTRL-002 and DOC-CTRL-006 may be editable');
    assert.equal(editableDocs.length, 2, 'Exactly two documents must be editable');

    assert.equal(isControlledEditAllowed('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-002'), true);
    assert.equal(isControlledEditAllowed('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-006'), true);

    const doc002 = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-002');
    const doc006 = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-006');
    assert.equal(doc002?.editableLivingDoc, true);
    assert.equal(doc006?.editableLivingDoc, true);

    console.log('  ✓ CONTROLLED_EDIT and editableLivingDoc restricted strictly to DOC-CTRL-002 and DOC-CTRL-006');
    passed++;
  }

  // ============================================================
  // TEST E: MASTER WBS PROTECTION
  // ============================================================
  console.log('\n[Test E] MASTER WBS protection:');
  {
    const wbsYaml = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-003');
    assert.ok(wbsYaml);
    assert.equal(wbsYaml.path, 'docs/00_control/MASTER_WBS.yaml');
    assert.equal(wbsYaml.editability, 'READ_ONLY');
    assert.equal(wbsYaml.editableLivingDoc, false);
    assert.equal(isControlledEditAllowed('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-003'), false);

    const wbsMd = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-004');
    assert.ok(wbsMd);
    assert.equal(wbsMd.path, 'docs/00_control/MASTER_WBS.md');
    assert.equal(wbsMd.authority, 'GENERATED_PROJECTION');
    assert.equal(wbsMd.editability, 'READ_ONLY');
    assert.equal(wbsMd.editableLivingDoc, false);
    assert.equal(isControlledEditAllowed('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-004'), false);

    console.log('  ✓ MASTER_WBS.yaml and MASTER_WBS.md are strictly READ_ONLY');
    passed++;
  }

  // ============================================================
  // TEST F: HASH-PINNED REFERENCES REMAIN READ_ONLY
  // ============================================================
  console.log('\n[Test F] Hash-pinned references remain READ_ONLY:');
  {
    const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    const pinnedDocs = registry.filter((d) => d.authority === 'REFERENCE' && typeof d.sha256Digest === 'string');

    assert.ok(pinnedDocs.length > 0, 'Must have pinned reference documents in manifest');
    for (const d of pinnedDocs) {
      assert.equal(d.editability, 'READ_ONLY', `${d.id} must be READ_ONLY`);
      assert.equal(d.editableLivingDoc, false, `${d.id} editableLivingDoc must be false`);
      assert.equal(isControlledEditAllowed('PRJ-DOCMONSTAKRAKIN', d.id), false);
    }
    console.log(`  ✓ All ${pinnedDocs.length} hash-pinned REFERENCE documents are strictly READ_ONLY`);
    passed++;
  }

  // ============================================================
  // TEST G: FILE TYPE DERIVATION
  // ============================================================
  console.log('\n[Test G] File type derivation:');
  {
    const docMd = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-002');
    assert.equal(docMd?.fileType, 'MARKDOWN');

    const docYaml = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-CTRL-003');
    assert.equal(docYaml?.fileType, 'YAML');

    const docJson = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-VER-004');
    assert.equal(docJson?.fileType, 'JSON');

    // Test OTHER using an isolated temp manifest fixture with safe unknown extension
    const ws = createTempWorkspace();
    try {
      const manifestClone = JSON.parse(realManifestRaw);
      manifestClone.documents.push({
        id: 'DOC-TEST-OTHER',
        path: 'docs/test/sample.txt',
        kind: 'CONTROL',
        authority: 'REFERENCE',
        title: 'Sample Other Document',
      });
      const bootstrapDir = path.join(ws.dir, 'bootstrap');
      fs.mkdirSync(bootstrapDir, { recursive: true });
      fs.writeFileSync(
        path.join(bootstrapDir, 'docmonstakrakin.self-bootstrap.json'),
        JSON.stringify(manifestClone, null, 2),
        'utf8'
      );

      const otherDoc = findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-TEST-OTHER', ws.dir);
      assert.equal(otherDoc?.fileType, 'OTHER');
    } finally {
      ws.cleanup();
    }

    console.log('  ✓ File types derived correctly (.md -> MARKDOWN, .yaml -> YAML, .json -> JSON, other -> OTHER)');
    passed++;
  }

  // ============================================================
  // TEST H: EXTERNAL PROJECT ISOLATION
  // ============================================================
  console.log('\n[Test H] External project isolation:');
  {
    assert.deepEqual(getControlledDocsRegistry('PRJ-ATLAS-01'), []);
    assert.deepEqual(getControlledDocsRegistry('PRJ-FINPAY-02'), []);
    assert.deepEqual(getControlledDocsRegistry('UNKNOWN-PROJECT'), []);

    assert.equal(findControlledDoc('PRJ-ATLAS-01', 'DOC-CTRL-002'), null);
    assert.equal(findControlledDoc('PRJ-FINPAY-02', 'DOC-CTRL-006'), null);

    assert.equal(isControlledEditAllowed('PRJ-ATLAS-01', 'DOC-CTRL-002'), false);
    assert.equal(isControlledEditAllowed('PRJ-FINPAY-02', 'DOC-CTRL-006'), false);

    console.log('  ✓ Non-self projects receive empty registry ([]) and null doc queries');
    passed++;
  }

  // ============================================================
  // TEST I: UNREGISTERED DOCUMENT
  // ============================================================
  console.log('\n[Test I] Unregistered document:');
  {
    assert.equal(findControlledDoc('PRJ-DOCMONSTAKRAKIN', 'DOC-NOT-REGISTERED'), null);
    assert.equal(isControlledEditAllowed('PRJ-DOCMONSTAKRAKIN', 'DOC-NOT-REGISTERED'), false);
    console.log('  ✓ Query for unregistered document returns null and edit allowed returns false');
    passed++;
  }

  // ============================================================
  // TEST J: LAST_HANDOFF.md IS INVISIBLE
  // ============================================================
  console.log('\n[Test J] LAST_HANDOFF.md invisible:');
  {
    const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    const hasLastHandoff = registry.some((d) => d.path === 'docs/00_control/LAST_HANDOFF.md');
    assert.equal(hasLastHandoff, false, 'LAST_HANDOFF.md must not appear in controlled docs registry');
    console.log('  ✓ LAST_HANDOFF.md is absent from registry regardless of physical file existence');
    passed++;
  }

  // ============================================================
  // TEST K: ZERO AUTO-DISCOVERY
  // ============================================================
  console.log('\n[Test K] Zero auto-discovery:');
  {
    const ws = createTempWorkspace();
    try {
      const bootstrapDir = path.join(ws.dir, 'bootstrap');
      fs.mkdirSync(bootstrapDir, { recursive: true });
      fs.writeFileSync(path.join(bootstrapDir, 'docmonstakrakin.self-bootstrap.json'), realManifestRaw, 'utf8');

      // Create an un-manifested physical file under docs/
      const extraDocDir = path.join(ws.dir, 'docs', '00_control');
      fs.mkdirSync(extraDocDir, { recursive: true });
      fs.writeFileSync(path.join(extraDocDir, 'UNREGISTERED_TEST_DOC.md'), '# Unregistered\n', 'utf8');

      const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN', ws.dir);
      assert.equal(registry.length, 28, 'Registry must strictly contain manifest documents only');
      assert.equal(
        registry.some((d) => d.path.includes('UNREGISTERED_TEST_DOC')),
        false,
        'Physical file not in manifest must never be auto-discovered'
      );
      console.log('  ✓ Physical filesystem scan is never performed; unregistered files are ignored');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST L: CUSTOM workspaceRoot HONORED
  // ============================================================
  console.log('\n[Test L] Custom workspaceRoot honored:');
  {
    const ws = createTempWorkspace();
    try {
      const manifestClone = JSON.parse(realManifestRaw);
      // Keep only 3 documents in custom workspace fixture
      manifestClone.documents = manifestClone.documents.slice(0, 3);

      const bootstrapDir = path.join(ws.dir, 'bootstrap');
      fs.mkdirSync(bootstrapDir, { recursive: true });
      fs.writeFileSync(
        path.join(bootstrapDir, 'docmonstakrakin.self-bootstrap.json'),
        JSON.stringify(manifestClone, null, 2),
        'utf8'
      );

      const registry = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN', ws.dir);
      assert.equal(registry.length, 3, 'Must load documents from custom workspaceRoot manifest');
      console.log('  ✓ getControlledDocsRegistry resolves manifest strictly relative to supplied workspaceRoot');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST M: MALFORMED JSON FAILS CLOSED
  // ============================================================
  console.log('\n[Test M] Malformed JSON fails closed:');
  {
    const ws = createTempWorkspace();
    try {
      const bootstrapDir = path.join(ws.dir, 'bootstrap');
      fs.mkdirSync(bootstrapDir, { recursive: true });
      fs.writeFileSync(path.join(bootstrapDir, 'docmonstakrakin.self-bootstrap.json'), '{ broken json ...', 'utf8');

      assert.throws(
        () => getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN', ws.dir),
        (err: any) => {
          assert(String(err).includes('CONTROLLED_DOCS_MANIFEST_INVALID'), 'Error must contain CONTROLLED_DOCS_MANIFEST_INVALID');
          return true;
        }
      );
      console.log('  ✓ Malformed manifest JSON throws CONTROLLED_DOCS_MANIFEST_INVALID fail-closed');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST N: STRUCTURALLY INVALID MANIFEST FAILS CLOSED
  // ============================================================
  console.log('\n[Test N] Structurally invalid manifest fails closed:');
  {
    const ws = createTempWorkspace();
    try {
      const manifestClone = JSON.parse(realManifestRaw);
      manifestClone.schemaVersion = 'INVALID_SCHEMA_VERSION';

      const bootstrapDir = path.join(ws.dir, 'bootstrap');
      fs.mkdirSync(bootstrapDir, { recursive: true });
      fs.writeFileSync(
        path.join(bootstrapDir, 'docmonstakrakin.self-bootstrap.json'),
        JSON.stringify(manifestClone, null, 2),
        'utf8'
      );

      assert.throws(
        () => getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN', ws.dir),
        (err: any) => {
          assert(String(err).includes('CONTROLLED_DOCS_MANIFEST_INVALID'));
          return true;
        }
      );
      console.log('  ✓ Manifest schema violation throws CONTROLLED_DOCS_MANIFEST_INVALID');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST O: MISSING MANIFEST FAILS CLOSED
  // ============================================================
  console.log('\n[Test O] Missing manifest fails closed:');
  {
    const ws = createTempWorkspace();
    try {
      assert.throws(
        () => getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN', ws.dir),
        (err: any) => {
          assert(String(err).includes('CONTROLLED_DOCS_MANIFEST_INVALID'));
          return true;
        }
      );
      console.log('  ✓ Missing manifest file fails closed and does not return empty array');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST P: EXTERNAL PROJECT DOES NOT REQUIRE SELF MANIFEST
  // ============================================================
  console.log('\n[Test P] External project does not require self manifest:');
  {
    const ws = createTempWorkspace();
    try {
      // ws has no bootstrap folder or manifest file
      const externalRegistry = getControlledDocsRegistry('PRJ-ATLAS-01', ws.dir);
      assert.deepEqual(externalRegistry, [], 'External project must cleanly return [] without erroring');
      console.log('  ✓ External projects safely return [] without needing self manifest');
      passed++;
    } finally {
      ws.cleanup();
    }
  }

  // ============================================================
  // TEST Q: RETURN VALUE IS SAFE TO MODIFY
  // ============================================================
  console.log('\n[Test Q] Return value is safe to modify:');
  {
    const firstCall = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    const originalTitle = firstCall[0].title;
    firstCall[0].title = 'MUTATED_CALLER_TITLE';
    firstCall.pop();

    const secondCall = getControlledDocsRegistry('PRJ-DOCMONSTAKRAKIN');
    assert.equal(secondCall.length, 28, 'Subsequent call must not be affected by pop() on previous return');
    assert.equal(secondCall[0].title, originalTitle, 'Subsequent call must not reflect mutations to records');
    console.log('  ✓ Caller mutations on returned registry array or records do not corrupt registry authority');
    passed++;
  }

  console.log(`\nAll ${passed} tests in testControlledDocsRegistry.ts passed!`);
}

runTests().catch((err) => {
  console.error('\nFAIL in testControlledDocsRegistry.ts:', err);
  process.exit(1);
});
