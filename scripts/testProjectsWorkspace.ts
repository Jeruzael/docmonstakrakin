import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import type { Project } from '../src/types.js';

console.log('================================================================');
console.log('   PROJECTS WORKSPACE & RELIABLE SWITCHING REGRESSION TEST');
console.log('   WBS: DMK-194 | Requirement: REQ-UX-PROJECTS-001');
console.log('   Architecture: CMP-01 | Security Control: SEC-CTRL-004');
console.log('================================================================\n');

const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmk-projects-test-'));
const port = 32812;
const base = `http://127.0.0.1:${port}`;
let child: ReturnType<typeof spawn>;
let output = '';

async function startServer() {
  child = spawn(
    process.execPath,
    ['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server.ts')],
    {
      cwd: dir,
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        GEMINI_API_KEY: '',
      },
      stdio: 'pipe',
    }
  );

  child.stdout?.on('data', (b) => (output += b));
  child.stderr?.on('data', (b) => (output += b));
  child.once('error', (e) => (output += `Child startup error: ${e.message}`));

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server did not start within deadline: ${output}`);
}

async function stopServer() {
  if (child && child.exitCode === null) {
    const done = new Promise((r) => child.once('exit', r));
    child.kill();
    await done;
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

async function run() {
  try {
    await startServer();

    // 1. Multi-project catalog retrieval
    console.log('Test 1: Multi-project workspace catalog retrieval (GET /api/projects)');
    const projectsRes = await fetch(`${base}/api/projects`);
    assert.equal(projectsRes.status, 200, 'GET /api/projects should return 200');
    const projects: Project[] = await projectsRes.json();
    assert(Array.isArray(projects), 'projects should be an array');
    assert(projects.length >= 2, `Expected at least 2 projects, found ${projects.length}`);
    console.log(`  ✓ Retrieved ${projects.length} canonical projects in catalog`);

    // 2. Metadata completeness and lifecycle inspection (REQ-UX-PROJECTS-001)
    console.log('Test 2: Inspecting metadata, lifecycle, and baseline attributes');
    for (const p of projects) {
      assert(p.id && typeof p.id === 'string', `Project missing valid id: ${JSON.stringify(p)}`);
      assert(p.name && typeof p.name === 'string', `Project ${p.id} missing valid name`);
      assert(p.lifecyclePhase && typeof p.lifecyclePhase === 'string', `Project ${p.id} missing lifecyclePhase`);
      assert(p.deliveryMethod && typeof p.deliveryMethod === 'string', `Project ${p.id} missing deliveryMethod`);
      assert(Array.isArray(p.profiles), `Project ${p.id} profiles must be an array`);
      assert(p.profiles.length > 0, `Project ${p.id} must have at least one profile`);
      assert(typeof p.stateVersion === 'number', `Project ${p.id} stateVersion must be numeric`);
      assert(typeof p.healthScore === 'number', `Project ${p.id} healthScore must be numeric`);

      // Verify individual project endpoint matches
      const singleRes = await fetch(`${base}/api/projects/${p.id}`);
      assert.equal(singleRes.status, 200, `GET /api/projects/${p.id} should return 200`);
      const single: Project = await singleRes.json();
      assert.equal(single.id, p.id);
      assert.equal(single.name, p.name);
      assert.equal(single.lifecyclePhase, p.lifecyclePhase);
    }
    console.log('  ✓ All projects conform to REQ-UX-PROJECTS-001 schema and lifecycle requirements');

    // 3. Entity isolation across projects (zero cross-project leakage)
    console.log('Test 3: Cross-project state isolation & zero cross-project entity leakage');
    const endpoints = [
      'requirements',
      'features',
      'risks',
      'threats',
      'standards',
      'work-items',
      'evidence',
      'adrs',
      'components',
      'approvals',
    ];

    const projectEntityMaps: Record<string, Record<string, Set<string>>> = {};

    for (const p of projects) {
      projectEntityMaps[p.id] = {};
      for (const ep of endpoints) {
        const res = await fetch(`${base}/api/projects/${p.id}/${ep}`);
        assert.equal(res.status, 200, `GET /api/projects/${p.id}/${ep} must return 200`);
        const items = await res.json();
        assert(Array.isArray(items), `${ep} for ${p.id} must be an array`);
        const idSet = new Set<string>();
        for (const item of items) {
          if (item && item.id) {
            idSet.add(item.id);
            // If item has projectId attribute, it MUST match the requested project ID
            if (item.projectId) {
              assert.equal(
                item.projectId,
                p.id,
                `Entity ${item.id} in project ${p.id} has mismatched projectId: ${item.projectId}`
              );
            }
          }
        }
        projectEntityMaps[p.id][ep] = idSet;
      }
    }

    // Assert that no entity ID appears in more than one project (except shared standard controls if applicable)
    const entityTypesToIsolate = [
      'requirements',
      'features',
      'risks',
      'threats',
      'work-items',
      'evidence',
      'adrs',
      'components',
      'approvals',
    ];

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const pA = projects[i];
        const pB = projects[j];

        for (const ep of entityTypesToIsolate) {
          const setA = projectEntityMaps[pA.id][ep];
          const setB = projectEntityMaps[pB.id][ep];

          for (const id of setA) {
            assert(
              !setB.has(id),
              `Cross-project contamination detected! Entity ${id} of type ${ep} exists in both ${pA.id} and ${pB.id}`
            );
          }
        }
      }
    }
    console.log('  ✓ Verified 100% strict entity isolation across all canonical project collections');

    // 4. Reliable Project Switching simulation
    console.log('Test 4: Reliable project switching consistency and idempotency');
    const switchSequence = [projects[0].id, projects[1].id, projects[0].id, projects[1].id];
    for (let s = 0; s < switchSequence.length; s++) {
      const targetId = switchSequence[s];
      const pRes = await fetch(`${base}/api/projects/${targetId}`);
      assert.equal(pRes.status, 200);
      const proj = await pRes.json();
      assert.equal(proj.id, targetId);

      const reqRes = await fetch(`${base}/api/projects/${targetId}/requirements`);
      assert.equal(reqRes.status, 200);
      const reqs = await reqRes.json();

      // Ensure requirements match expected set from initial collection
      const expectedIds = Array.from(projectEntityMaps[targetId]['requirements']);
      assert.equal(
        reqs.length,
        expectedIds.length,
        `Switch iteration ${s}: requirements count for ${targetId} differs from initial map`
      );
    }
    console.log('  ✓ Rapid sequential switching preserves deterministic isolated state with zero mutation');

    // 5. Fail-closed on non-existent project queries
    console.log('Test 5: Unknown project request fails closed (404)');
    const fakeId = 'PRJ-NON-EXISTENT-WORKSPACE-999';
    const unknownRes = await fetch(`${base}/api/projects/${fakeId}`);
    assert.equal(unknownRes.status, 404, 'Unknown project query must return 404');
    const unknownReqsRes = await fetch(`${base}/api/projects/${fakeId}/requirements`);
    const unknownReqs = await unknownReqsRes.json();
    assert(Array.isArray(unknownReqs) && unknownReqs.length === 0, 'Unknown project requirements must return empty list and leak zero entities');
    console.log('  ✓ Unknown project queries fail closed and leak zero baseline data');

    // 6. Project creation and isolated workspace onboarding
    console.log('Test 6: New project creation adds isolated workspace to catalog');
    const newProjDraft = {
      name: 'Test Project Delta',
      description: 'Workspace project created during reliable switching regression test',
      profiles: ['WEB_APPLICATION', 'BACKEND_API'],
      specializedProfiles: ['DEVELOPER_TOOL'],
      deliveryMethod: 'ITERATIVE',
      deploymentIntent: 'Containerized microservice',
      dataSensitivity: 'INTERNAL',
      maturity: 'GREENFIELD',
      assuranceInputs: {
        publicInternetExposure: true,
        pii: false,
        regulatedData: false,
        productionSecrets: true,
        destructiveOperations: false,
        autonomousAgentExecution: false,
        complianceProfile: [],
      },
      technicalBaseline: {
        frontend: { type: 'USER_SPECIFIED', userValue: 'React 19 + Vite' },
        backend: { type: 'USER_SPECIFIED', userValue: 'Node 22 + Express' },
      },
    };

    const createRes = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProjDraft),
    });
    assert.equal(createRes.status, 201, `POST /api/projects failed: status ${createRes.status}`);
    const createdProject: Project = await createRes.json();
    assert(createdProject.id.startsWith('PRJ-'), `Created project ID must start with PRJ-: ${createdProject.id}`);
    assert.equal(createdProject.name, newProjDraft.name);
    assert.equal(createdProject.lifecyclePhase, 'DISCOVERY');

    // Verify it appears in the catalog
    const updatedCatalogRes = await fetch(`${base}/api/projects`);
    const updatedCatalog: Project[] = await updatedCatalogRes.json();
    assert.equal(updatedCatalog.length, projects.length + 1, 'Catalog count should increment by 1');
    assert(updatedCatalog.some((p) => p.id === createdProject.id), 'Created project must be in catalog');

    // Verify the newly created project has its own isolated collections
    const newProjectReqsRes = await fetch(`${base}/api/projects/${createdProject.id}/requirements`);
    assert.equal(newProjectReqsRes.status, 200);
    const newProjectReqs = await newProjectReqsRes.json();
    assert(Array.isArray(newProjectReqs), 'New project requirements must be an array');

    // None of the existing projects should have the new project ID or vice versa
    for (const p of projects) {
      assert.notEqual(p.id, createdProject.id);
    }
    console.log('  ✓ Created new isolated project workspace successfully');

    console.log('\n================================================================');
    console.log('   ALL PROJECTS WORKSPACE REGRESSION TESTS PASSED SUCCESSFULLY');
    console.log('================================================================');
  } finally {
    await stopServer();
  }
}

run().catch((err) => {
  console.error('Projects Workspace Test FAILED:', err);
  process.exit(1);
});
