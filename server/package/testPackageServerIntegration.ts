import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import {
  createPortablePackage,
  verifyPortablePackage,
  DocmonstakrakinPackage,
} from './portablePackage.js';
import { createChainedAuditEvent } from '../security/auditImmutability.js';
import { INITIAL_PROJECTS, INITIAL_REQUIREMENTS } from '../../src/data/initialData.js';
import type { Project, Requirement, AuditEvent } from '../../src/types.js';

console.log('=== DMK-156: Running Portable Package Server Integration Tests ===\n');

const initialMockEvent = createChainedAuditEvent({
  actor: 'Security Lead',
  action: 'PROJECT_CREATED',
  target: 'PRJ-ATLAS-01',
  reason: 'Initial project baseline',
});

// Mock Project Store to test endpoint handler logic in isolated test harness
const mockStore = {
  projects: [
    {
      ...INITIAL_PROJECTS[0],
      id: 'PRJ-ATLAS-01',
      name: 'Atlas Aerospace Avionics Core',
      description: 'DO-178C Flight Control System',
    },
  ] as Project[],
  questions: {} as Record<string, any[]>,
  requirements: {
    'PRJ-ATLAS-01': [
      {
        ...INITIAL_REQUIREMENTS[0],
        id: 'REQ-AV-001',
        title: 'Flight Surface Actuation',
      },
    ] as Requirement[],
  } as Record<string, any[]>,
  risks: {} as Record<string, any[]>,
  threats: {} as Record<string, any[]>,
  standards: {} as Record<string, any[]>,
  workItems: {} as Record<string, any[]>,
  evidence: {} as Record<string, any[]>,
  adrs: {} as Record<string, any[]>,
  components: {} as Record<string, any[]>,
  overrides: {} as Record<string, any[]>,
  approvals: {} as Record<string, any[]>,
  agentRoles: {} as Record<string, any[]>,
  agentRuns: {} as Record<string, any[]>,
  auditLogs: {
    'PRJ-ATLAS-01': [initialMockEvent],
  } as Record<string, any[]>,

  addAuditEvent(projectId: string, actor: string, action: string, target: string, reason?: string, details?: any) {
    if (!this.auditLogs[projectId]) {
      this.auditLogs[projectId] = [];
    }
    const previousEvent = this.auditLogs[projectId][0];
    const evt = createChainedAuditEvent({
      actor,
      action,
      target,
      reason,
      details,
      previousEvent,
    });
    this.auditLogs[projectId].unshift(evt);
  },
};

const app = express();
app.use(express.json({ limit: '10mb' }));

// Export endpoint
app.get('/api/projects/:id/package/export', (req, res) => {
  const projectId = req.params.id;
  const project = mockStore.projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const actor = (req.query.actor as string) || 'docmonstakrakin Control Plane';
  const pkg = createPortablePackage({
    project,
    questions: mockStore.questions[projectId] || [],
    requirements: mockStore.requirements[projectId] || [],
    risks: mockStore.risks[projectId] || [],
    threats: mockStore.threats[projectId] || [],
    standards: mockStore.standards[projectId] || [],
    workItems: mockStore.workItems[projectId] || [],
    evidence: mockStore.evidence[projectId] || [],
    adrs: mockStore.adrs[projectId] || [],
    components: mockStore.components[projectId] || [],
    overrides: mockStore.overrides[projectId] || [],
    approvals: mockStore.approvals[projectId] || [],
    agentRoles: mockStore.agentRoles[projectId] || [],
    agentRuns: mockStore.agentRuns[projectId] || [],
    auditLogs: mockStore.auditLogs[projectId] || [],
    actor,
  });

  const safeName = project.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const filename = `${project.id}_${safeName}.docmonstakrakin`;

  mockStore.addAuditEvent(projectId, actor, 'PACKAGE_EXPORTED', project.id, 'Exported package');

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Docmonstakrakin-State-Hash', pkg.seal.canonicalStateHash);
  res.setHeader('X-Docmonstakrakin-Envelope-Hash', pkg.seal.envelopeHash);
  res.json(pkg);
});

// Verify endpoint
app.post('/api/projects/package/verify', (req, res) => {
  const payload = req.body.package || req.body;
  const verification = verifyPortablePackage(payload);

  if (!verification.valid) {
    return res.status(400).json({ status: 'INVALID', ...verification });
  }

  res.json({ status: 'VERIFIED', ...verification });
});

// Import endpoint
app.post('/api/projects/package/import', (req, res) => {
  const payload = req.body.package || req.body;
  const overwrite = req.body.overwrite === true;
  const actor = req.body.actor || 'docmonstakrakin User';

  const verification = verifyPortablePackage(payload);
  if (!verification.valid) {
    return res.status(400).json({
      status: 'REJECTED',
      error: 'Package verification failed',
      errors: verification.errors,
    });
  }

  const pkg = payload as DocmonstakrakinPackage;
  const incomingProject = pkg.knowledge.project;
  const targetProjectId = incomingProject.id;

  const existingIndex = mockStore.projects.findIndex((p) => p.id === targetProjectId);
  if (existingIndex !== -1 && !overwrite) {
    return res.status(409).json({
      status: 'CONFLICT',
      error: `Project ${targetProjectId} already exists. Set overwrite: true to replace.`,
    });
  }

  if (existingIndex !== -1) {
    mockStore.projects[existingIndex] = incomingProject;
  } else {
    mockStore.projects.push(incomingProject);
  }

  mockStore.questions[targetProjectId] = pkg.knowledge.questions || [];
  mockStore.requirements[targetProjectId] = pkg.knowledge.requirements || [];
  mockStore.risks[targetProjectId] = pkg.knowledge.risks || [];
  mockStore.threats[targetProjectId] = pkg.knowledge.threats || [];
  mockStore.standards[targetProjectId] = pkg.knowledge.standards || [];
  mockStore.workItems[targetProjectId] = pkg.knowledge.workItems || [];
  mockStore.evidence[targetProjectId] = pkg.knowledge.evidence || [];
  mockStore.adrs[targetProjectId] = pkg.knowledge.adrs || [];
  mockStore.components[targetProjectId] = pkg.knowledge.components || [];
  mockStore.overrides[targetProjectId] = pkg.knowledge.overrides || [];
  mockStore.approvals[targetProjectId] = pkg.knowledge.approvals || [];
  mockStore.agentRoles[targetProjectId] = pkg.knowledge.agentRoles || [];
  mockStore.agentRuns[targetProjectId] = pkg.knowledge.agentRuns || [];

  const restoredAudit = pkg.auditLedger ? [...pkg.auditLedger].reverse() : [];
  mockStore.auditLogs[targetProjectId] = restoredAudit;

  mockStore.addAuditEvent(targetProjectId, actor, 'PACKAGE_IMPORTED', targetProjectId, 'Imported package');

  res.status(201).json({
    status: 'SUCCESS',
    project: incomingProject,
    stateHash: pkg.seal.canonicalStateHash,
    envelopeHash: pkg.seal.envelopeHash,
    auditVerified: verification.auditVerified,
    auditCount: mockStore.auditLogs[targetProjectId].length,
  });
});

// Helper for testing HTTP requests
function httpRequest(
  server: http.Server,
  options: { path: string; method: string; body?: any; headers?: Record<string, string> }
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const port = address.port;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsedBody: any;
          try {
            parsedBody = JSON.parse(raw);
          } catch {
            parsedBody = raw;
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: parsedBody,
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runIntegrationTests() {
  const server = http.createServer(app);
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));

  try {
    let passedCount = 0;

    // Test 1: GET /api/projects/:id/package/export
    console.log('Test 1: GET /api/projects/:id/package/export delivers attachment with cryptographic headers');
    const exportRes = await httpRequest(server, {
      path: '/api/projects/PRJ-ATLAS-01/package/export',
      method: 'GET',
    });

    assert.strictEqual(exportRes.statusCode, 200);
    assert(exportRes.headers['content-disposition']?.includes('attachment; filename="PRJ-ATLAS-01_'));
    assert(exportRes.headers['content-disposition']?.endsWith('.docmonstakrakin"'));
    assert(exportRes.headers['x-docmonstakrakin-state-hash']);
    assert(exportRes.headers['x-docmonstakrakin-envelope-hash']);
    assert.strictEqual(exportRes.body.manifest.magic, 'DOCMONSTAKRAKIN_PACKAGE');
    assert.strictEqual(exportRes.body.knowledge.project.id, 'PRJ-ATLAS-01');
    console.log('✓ Export endpoint responded with valid sealed package attachment.\n');
    passedCount++;

    const exportedPackage: DocmonstakrakinPackage = exportRes.body;

    // Test 2: POST /api/projects/package/verify on exported package
    console.log('Test 2: POST /api/projects/package/verify validates genuine package');
    const verifyRes = await httpRequest(server, {
      path: '/api/projects/package/verify',
      method: 'POST',
      body: { package: exportedPackage },
    });

    assert.strictEqual(verifyRes.statusCode, 200);
    assert.strictEqual(verifyRes.body.status, 'VERIFIED');
    assert.strictEqual(verifyRes.body.valid, true);
    assert.strictEqual(verifyRes.body.canonicalStateHash, exportedPackage.seal.canonicalStateHash);
    console.log('✓ Verify endpoint approved genuine package.\n');
    passedCount++;

    // Test 3: POST /api/projects/package/verify on tampered package
    console.log('Test 3: POST /api/projects/package/verify rejects tampered package');
    const tampered = JSON.parse(JSON.stringify(exportedPackage));
    tampered.knowledge.requirements[0].title = 'Injected Malicious Title';

    const verifyTamperedRes = await httpRequest(server, {
      path: '/api/projects/package/verify',
      method: 'POST',
      body: { package: tampered },
    });

    assert.strictEqual(verifyTamperedRes.statusCode, 400);
    assert.strictEqual(verifyTamperedRes.body.status, 'INVALID');
    assert.strictEqual(verifyTamperedRes.body.valid, false);
    assert(verifyTamperedRes.body.errors.some((e: string) => e.includes('Canonical state hash mismatch')));
    console.log('✓ Verify endpoint rejected tampered package with 400 Bad Request.\n');
    passedCount++;

    // Test 4: POST /api/projects/package/import for a new project package
    console.log('Test 4: POST /api/projects/package/import imports new project package into store');
    const newProject: Project = {
      ...INITIAL_PROJECTS[0],
      id: 'PRJ-SATELLITE-09',
      name: 'Orion Lunar Lander Comms',
      description: 'Ka-Band Deep Space Transponder',
      createdAt: '2026-09-10T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
      owner: 'Orion Communications Group',
    };

    const newPkg = createPortablePackage({
      project: newProject,
      requirements: [
        {
          ...INITIAL_REQUIREMENTS[0],
          id: 'REQ-ORION-01',
          title: '34GHz Ka-band Uplink Sensitivity',
        },
      ],
      auditLogs: [],
      actor: 'Orion Ground Station',
    });

    const importRes = await httpRequest(server, {
      path: '/api/projects/package/import',
      method: 'POST',
      body: { package: newPkg, actor: 'Import Test Runner' },
    });

    assert.strictEqual(importRes.statusCode, 201);
    assert.strictEqual(importRes.body.status, 'SUCCESS');
    assert.strictEqual(importRes.body.project.id, 'PRJ-SATELLITE-09');
    assert.strictEqual(importRes.body.stateHash, newPkg.seal.canonicalStateHash);
    assert(mockStore.projects.some((p) => p.id === 'PRJ-SATELLITE-09'));
    assert.strictEqual(mockStore.requirements['PRJ-SATELLITE-09']?.length, 1);
    console.log('✓ Import endpoint restored new project into store with 201 Created.\n');
    passedCount++;

    // Test 5: Conflict detection on re-importing existing project without overwrite
    console.log('Test 5: POST /api/projects/package/import returns 409 CONFLICT on existing project');
    const conflictRes = await httpRequest(server, {
      path: '/api/projects/package/import',
      method: 'POST',
      body: { package: newPkg, overwrite: false },
    });

    assert.strictEqual(conflictRes.statusCode, 409);
    assert.strictEqual(conflictRes.body.status, 'CONFLICT');
    console.log('✓ Conflict safely prevented accidental overwrite without explicit flag.\n');
    passedCount++;

    // Test 6: Overwrite existing project with overwrite: true
    console.log('Test 6: POST /api/projects/package/import succeeds when overwrite: true is provided');
    const overwriteRes = await httpRequest(server, {
      path: '/api/projects/package/import',
      method: 'POST',
      body: { package: newPkg, overwrite: true },
    });

    assert.strictEqual(overwriteRes.statusCode, 201);
    assert.strictEqual(overwriteRes.body.status, 'SUCCESS');
    console.log('✓ Overwrite import succeeded with 201 Created.\n');
    passedCount++;

    // Test 7: Export freshly imported project and assert identical state hash (Fidelity check)
    console.log('Test 7: Export freshly imported project and assert identical state hash (AC-1)');
    const reExportRes = await httpRequest(server, {
      path: '/api/projects/PRJ-SATELLITE-09/package/export',
      method: 'GET',
    });

    assert.strictEqual(reExportRes.statusCode, 200);
    assert.strictEqual(
      reExportRes.body.seal.canonicalStateHash,
      newPkg.seal.canonicalStateHash,
      'Exported state hash must match original sealed state hash'
    );
    console.log('✓ Roundtrip state hash idempotency verified.\n');
    passedCount++;

    console.log(`=== ALL ${passedCount}/${passedCount} PACKAGE SERVER INTEGRATION TESTS PASSED ===`);
  } finally {
    server.close();
  }
}

runIntegrationTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
