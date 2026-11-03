import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import {execFileSync} from 'node:child_process';
import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import express from 'express';
import {ProjectStore} from '../server/projectStore.ts';
import {snapshotProjectStore} from '../server/projectPersistence.ts';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';
import {installWorkspaceProjectPersistence} from '../server/security/workspaceAccess/projectPersistence.ts';
import {installAgentReadHttp} from '../server/security/workspaceAccess/agentHttp.ts';
import {createPrivateDirectory} from '../server/security/workspaceAccess/privateDirectory.ts';
import {
  TrustedLocalAgentService,
  TRUSTED_LOCAL_AGENT_TOOLS,
  trustedLocalTokenDigest,
} from '../server/security/workspaceAccess/trustedLocalAgent.ts';
import {
  createWorkspaceMcpBridge,
  loadPrivateMcpConfig,
  buildClientMcpConfigs,
  validateMcpCliArgs,
} from '../server/security/workspaceAccess/mcpBridge.ts';

let passed = 0;
let failed = 0;

async function test(name: string, run: () => Promise<void>) {
  try {
    await run();
    passed++;
    console.log('PASS ' + name);
  } catch (error) {
    failed++;
    console.error('FAIL ' + name + ': ' + String(error));
  }
}

const verifier =
  '$argon2id$v=19$m=32768,p=1,t=3$' +
  Buffer.alloc(16).toString('base64').replace(/=/g, '') +
  '$' +
  Buffer.alloc(32).toString('base64').replace(/=/g, '');

const human = (id = 'synthetic-owner') => ({
  id,
  name: id,
  personId: 'SYNTHETIC-' + id,
  kind: 'HUMAN' as const,
  roles: [],
  canCreateProjects: true,
  disabled: false,
  credentialRevision: 1,
});

async function withFixture(
  run: (ctx: {
    root: string;
    authority: WorkspaceStore;
    store: ProjectStore;
    service: TrustedLocalAgentService;
    setAuthority: (next: WorkspaceStore) => void;
  }) => Promise<void>
) {
  const parent = fs.realpathSync.native(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'dmk-tla-unit-'));
  let authority: WorkspaceStore | undefined;
  try {
    const projectStore = new ProjectStore();
    const canonical = structuredClone(projectStore.projects[0]);
    for (const key of Object.keys(projectStore)) {
      (projectStore as any)[key] = key === 'projects' ? [] : {};
    }
    canonical.id = 'PRJ-DOCMONSTAKRAKIN';
    canonical.name = 'Canonical Self Project';
    projectStore.projects.push(canonical);

    authority = await WorkspaceStore.open(root, {initialize: true});
    await authority.execute({
      command: 'bootstrap',
      principal: human(),
      verifier,
      stateJson: JSON.stringify(snapshotProjectStore(projectStore)),
    });

    const app = express();
    app.use(express.json());
    const coordinator = await installWorkspaceProjectPersistence(app, projectStore, authority);
    const service = new TrustedLocalAgentService({
      workspaceRoot: root,
      authority,
      store: projectStore,
      runAuthorityOperation: coordinator.runAuthorityOperation,
      enabled: true,
    });

    await run({
      root,
      authority,
      store: projectStore,
      service,
      setAuthority: (next: WorkspaceStore) => {
        authority = next;
      },
    });
  } finally {
    await authority?.close();
    fs.rmSync(root, {recursive: true, force: true});
  }
}

await test('TLA01 one-time enrollment stores only SHA-256 digest in owner-only registry and generates Codex/Claude/Gemini MCP configs', () =>
  withFixture(async ({root, service}) => {
    const enrolled = await service.enrollLocalClient({
      sponsorPrincipalId: 'synthetic-owner',
      clientName: 'claude-code',
      ttlMs: 7 * 24 * 60 * 60 * 1000,
    });
    assert.equal(enrolled.accepted, true);
    if (!enrolled.accepted) return;
    assert.match(enrolled.token, /^dmk_tla_v1_[a-f0-9]{64}$/);
    assert.equal(enrolled.enrollment.clientName, 'claude-code');
    assert.equal(enrolled.enrollment.sponsorPrincipalId, 'synthetic-owner');
    assert.equal(enrolled.enrollment.sponsorCredentialRevision, 1);

    const registryPath = path.join(root, '.security-agents', 'trusted-local-agents.json');
    assert.equal(fs.existsSync(registryPath), true);
    const rawRegistry = fs.readFileSync(registryPath, 'utf8');
    assert.equal(rawRegistry.includes(enrolled.token), false, 'raw token must never be stored in registry');
    assert.equal(rawRegistry.includes(trustedLocalTokenDigest(enrolled.token)!), true);

    // Verify CLI secret protection rejects dmk_tla_v1_ tokens on command line
    assert.throws(() => validateMcpCliArgs(['--token', enrolled.token]), /MCP_CLI_SECRET_FORBIDDEN/);
    assert.throws(() => validateMcpCliArgs([enrolled.token]), /MCP_CLI_SECRET_FORBIDDEN/);

    // Verify private MCP config loader and multi-agent client config builder
    const mcpDir = path.join(root, '.security-agents', 'mcp-client');
    createPrivateDirectory(mcpDir);
    const caPath = path.join(mcpDir, 'loopback.crt');
    const tokenPath = path.join(mcpDir, 'agent.token');
    const configPath = path.join(mcpDir, 'mcp-config.json');
    fs.writeFileSync(caPath, '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n', {mode: 0o600});
    fs.writeFileSync(tokenPath, enrolled.token + '\n', {mode: 0o600});
    fs.writeFileSync(configPath, JSON.stringify({origin: 'https://127.0.0.1:3001', caPath, tokenPath}), {mode: 0o600});

    const loaded = loadPrivateMcpConfig(configPath);
    assert.equal(loaded.token, enrolled.token);

    const clientConfigs = buildClientMcpConfigs({
      repoRoot: process.cwd(),
      privateConfigPath: configPath,
      mode: 'TRUSTED_LOCAL_AGENT',
    });
    assert.ok(clientConfigs.claudeDesktop?.mcpServers?.['dmk-agent-bridge']);
    assert.ok(clientConfigs.claudeCode?.mcpServers?.['dmk-agent-bridge']);
    assert.ok(clientConfigs.codexCli?.mcpServers?.['dmk-agent-bridge']);
    assert.ok(clientConfigs.geminiCli?.mcpServers?.['dmk-agent-bridge']);
    assert.deepEqual(clientConfigs.geminiCli.mcpServers['dmk-agent-bridge'].includeTools, TRUSTED_LOCAL_AGENT_TOOLS);
    assert.equal(JSON.stringify(clientConfigs).includes(enrolled.token), false);
  }));

await test('TLA02 pooled native session reuses a single authority session across reads/writes and enforces 4096-entry audit reserve', () =>
  withFixture(async ({root, authority, service, setAuthority}) => {
    const enrolled = await service.enrollLocalClient({
      sponsorPrincipalId: 'synthetic-owner',
      clientName: 'codex-cli',
    });
    assert.equal(enrolled.accepted, true);
    if (!enrolled.accepted) return;

    const beforeInfo = await authority.execute({command: 'info'});
    assert.equal(beforeInfo.counts.sessions, 0);

    // Execute multiple read & write operations using the same enrollment token
    const capRes = await service.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'get_capabilities',
      input: {},
    });
    assert.equal(capRes.ok, true);

    const createRes = await service.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'create_project',
      input: {
        name: 'Pooled Session Test Project',
        description: 'Testing native authority session pooling',
        repoPath: 'https://github.com/acme/pooled-test',
        maturity: 'EXISTING_PROJECT',
        profiles: ['WEB_APPLICATION', 'API_SERVICE'],
      },
    });
    assert.equal(createRes.ok, true);
    if (!createRes.ok) return;
    const projectId = createRes.data.project.id;

    for (let i = 0; i < 4; i++) {
      const listRes = await service.executeOperation(enrolled.token, {
        version: 1,
        operationId: randomUUID(),
        operation: 'list_projects',
        input: {},
      });
      assert.equal(listRes.ok, true);
    }

    const afterInfo = await authority.execute({command: 'info'});
    const auditEvents = await authority.execute({command: 'audit'});
    const sessionIssuedCount = auditEvents.filter((e: any) => e.type === 'SESSION_ISSUED').length;
    assert.equal(afterInfo.counts.sessions, 1, 'must pool a single native session across calls');
    assert.equal(sessionIssuedCount, 1, 'must emit only one SESSION_ISSUED audit event for pooled session');

    // Fill audit table up to the 3968 reserve threshold and verify new session allocation fails closed
    await authority.close();
    const Sqlite = createRequire(import.meta.url)('better-sqlite3');
    const db = new Sqlite(path.join(root, '.security', 'authority.sqlite'));
    try {
      const m = db.prepare('SELECT * FROM metadata').get();
      let prev = db.prepare('SELECT hash FROM audit ORDER BY sequence DESC LIMIT 1').get().hash;
      const existing = db.prepare('SELECT count(*) AS n FROM audit').get().n;
      db.exec('BEGIN IMMEDIATE');
      for (let i = existing; i < 3968; i++) {
        const raw = JSON.stringify({
          type: 'SYNTHETIC_CAPACITY_FIXTURE',
          targetHash: null,
          at: m.clockHighWater,
          generation: m.generation,
          policyRevision: m.policyRevision,
          snapshotRevision: m.snapshotRevision,
        });
        const hash = createHash('sha256').update(prev + '\n' + raw).digest('hex');
        db.prepare('INSERT INTO audit(raw,previousHash,hash) VALUES(?,?,?)').run(raw, prev, hash);
        prev = hash;
      }
      db.exec('COMMIT');
    } finally {
      db.close();
    }

    const reopened = await WorkspaceStore.open(root);
    setAuthority(reopened);
    const reserveService = new TrustedLocalAgentService({
      workspaceRoot: root,
      authority: reopened,
      store: new ProjectStore(),
      runAuthorityOperation: async fn => fn(),
      enabled: true,
    });
    const deniedByReserve = await reserveService.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'list_projects',
      input: {},
    });
    assert.equal(deniedByReserve.ok, false);
    if (!deniedByReserve.ok) {
      assert.equal(deniedByReserve.error, 'WORKSPACE_AUDIT_RESERVE_REACHED');
    }
    assert.ok(projectId);
  }));

await test('TLA03 enrollment revocation and sponsor credential reset immediately invalidate agent access', () =>
  withFixture(async ({authority, service}) => {
    const first = await service.enrollLocalClient({
      sponsorPrincipalId: 'synthetic-owner',
      clientName: 'gemini-cli',
    });
    const second = await service.enrollLocalClient({
      sponsorPrincipalId: 'synthetic-owner',
      clientName: 'claude-code',
    });
    assert.ok(first.accepted && second.accepted);
    if (!first.accepted || !second.accepted) return;

    assert.equal((await service.sessionState(first.token)).actor !== null, true);
    const revoked = await service.revokeLocalClient({
      sponsorPrincipalId: 'synthetic-owner',
      enrollmentId: first.enrollment.enrollmentId,
    });
    assert.equal(revoked.revoked, true);
    assert.equal((await service.sessionState(first.token)).actor, null);

    // Second enrollment remains active until sponsor credentialRevision changes
    assert.equal((await service.sessionState(second.token)).actor !== null, true);
    await authority.execute({
      command: 'resetCredential',
      principalId: 'synthetic-owner',
      verifier,
    });
    assert.equal((await service.sessionState(second.token)).actor, null);
  }));

await test('TLA04 hard governance guardrails block canonical self-project, requirement approval, ADR ratification, and VERIFIED/APPROVED/RELEASED tasks', () =>
  withFixture(async ({service}) => {
    const enrolled = await service.enrollLocalClient({
      sponsorPrincipalId: 'synthetic-owner',
      clientName: 'codex-cli',
    });
    assert.equal(enrolled.accepted, true);
    if (!enrolled.accepted) return;

    // 1. Canonical self-project PRJ-DOCMONSTAKRAKIN is strictly off-limits
    const canonicalRead = await service.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'get_project_overview',
      input: {projectId: 'PRJ-DOCMONSTAKRAKIN'},
    });
    assert.equal(canonicalRead.ok, false);
    if (!canonicalRead.ok) assert.equal(canonicalRead.error, 'CANONICAL_PROJECT_PROTECTED');

    // Create a disposable project
    const created = await service.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'create_project',
      input: {
        name: 'Guardrail Verification Project',
        description: 'Verifies governance boundaries',
        repoPath: 'https://github.com/acme/guardrails',
      },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const projectId = created.data.project.id;
    const v1 = created.data.project.stateVersion;

    // 2. Attempting to propose an already-APPROVED requirement fails closed
    const badReq = await service.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'propose_requirements',
      input: {
        projectId,
        expectedStateVersion: v1,
        requirements: [
          {
            title: 'Self-Approved Requirement',
            statement: 'Agent attempts to bypass human signoff.',
            status: 'APPROVED',
          },
        ],
      },
    });
    assert.equal(badReq.ok, false);
    if (!badReq.ok) assert.equal(badReq.error, 'GOVERNANCE_HUMAN_SIGNOFF_REQUIRED');

    // 3. Attempting to create an ACCEPTED ADR fails closed
    const badAdr = await service.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'upsert_architecture',
      input: {
        projectId,
        expectedStateVersion: v1,
        adrs: [
          {
            title: 'Self-Ratified ADR',
            status: 'ACCEPTED',
            context: 'Context',
            decision: 'Decision',
          },
        ],
      },
    });
    assert.equal(badAdr.ok, false);
    if (!badAdr.ok) assert.equal(badAdr.error, 'GOVERNANCE_HUMAN_SIGNOFF_REQUIRED');

    // 4. Attempting to transition a task to VERIFIED, APPROVED, or RELEASED fails closed
    const initialTaskId = `WORK-${projectId}-DISCOVERY`;
    for (const forbiddenStatus of ['VERIFIED', 'APPROVED', 'RELEASED']) {
      const badTask = await service.executeOperation(enrolled.token, {
        version: 1,
        operationId: randomUUID(),
        operation: 'manage_work_items',
        input: {
          projectId,
          expectedStateVersion: v1,
          mode: 'UPDATE_TASK_PROGRESS',
          updates: [{itemId: initialTaskId, status: forbiddenStatus}],
        },
      });
      assert.equal(badTask.ok, false);
      if (!badTask.ok) assert.equal(badTask.error, 'GOVERNANCE_HUMAN_SIGNOFF_REQUIRED');
    }

    // 5. Stale stateVersion fails closed with STALE_STATE
    const staleWrite = await service.executeOperation(enrolled.token, {
      version: 1,
      operationId: randomUUID(),
      operation: 'propose_requirements',
      input: {
        projectId,
        expectedStateVersion: v1 + 99,
        requirements: [
          {
            title: 'Valid Proposed Requirement',
            statement: 'The system SHALL enforce stale state checks.',
          },
        ],
      },
    });
    assert.equal(staleWrite.ok, false);
    if (!staleWrite.ok) assert.equal(staleWrite.error, 'STALE_STATE');
  }));

await test('TLA05 MCP bridge exposes full TRUSTED_LOCAL_AGENT tool suite over TLS 1.3 while preserving read_task-only for dmk_agent_v1 tokens', () =>
  withFixture(async ({root, service}) => {
    const enrolled = await service.enrollLocalClient({
      sponsorPrincipalId: 'synthetic-owner',
      clientName: 'claude-code',
    });
    assert.equal(enrolled.accepted, true);
    if (!enrolled.accepted) return;

    const tlsDir = path.join(root, '.security', 'tls');
    createPrivateDirectory(tlsDir);
    const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : '/usr/bin/openssl';
    const cnfPath = path.join(root, 'openssl.cnf');
    const keyPath = path.join(tlsDir, 'loopback.key');
    const crtPath = path.join(tlsDir, 'loopback.crt');
    fs.writeFileSync(cnfPath, '[req]\nprompt=no\ndistinguished_name=subject\n[subject]\nCN=Disposable TLA MCP TLS\n');
    execFileSync(
      openssl,
      [
        'req',
        '-new',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-sha256',
        '-days',
        '2',
        '-config',
        cnfPath,
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-addext',
        'basicConstraints=critical,CA:FALSE',
        '-addext',
        'extendedKeyUsage=serverAuth',
        '-keyout',
        keyPath,
        '-out',
        crtPath,
      ],
      {stdio: 'pipe', windowsHide: true, timeout: 10000}
    );

    const app = express();
    app.use(express.json({limit: '16kb'}));
    const handlers = installAgentReadHttp(app, null, service);
    const server = https.createServer(
      {key: fs.readFileSync(keyPath), cert: fs.readFileSync(crtPath), minVersion: 'TLSv1.3'},
      app
    );
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as {port: number}).port;
    const ca = fs.readFileSync(crtPath);

    try {
      const tlaBridge = createWorkspaceMcpBridge({
        origin: `https://127.0.0.1:${port}`,
        ca,
        token: enrolled.token,
      });
      const legacyBridge = createWorkspaceMcpBridge({
        origin: `https://127.0.0.1:${port}`,
        ca,
        token: 'dmk_agent_v1_' + 'a'.repeat(64),
      });
      try {
        const legacyTools = (await legacyBridge.handleMessage({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        })) as any;
        assert.deepEqual(
          legacyTools.result.tools.map((t: any) => t.name),
          ['read_task']
        );

        const tlaTools = (await tlaBridge.handleMessage({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        })) as any;
        assert.deepEqual(
          tlaTools.result.tools.map((t: any) => t.name),
          TRUSTED_LOCAL_AGENT_TOOLS
        );

        const capCall = (await tlaBridge.handleMessage({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {name: 'get_capabilities', arguments: {}},
        })) as any;
        assert.equal(capCall.result.isError, false);
        const capPayload = JSON.parse(capCall.result.content[0].text);
        assert.equal(capPayload.mode, 'TRUSTED_LOCAL_AGENT');
        assert.equal(capPayload.untrustedProjectData, true);
        assert.equal(capPayload.humanApproval, false);
      } finally {
        tlaBridge.close();
        legacyBridge.close();
      }
    } finally {
      handlers.close();
      await new Promise<void>(r => server.close(() => r()));
    }
  }));

console.log(JSON.stringify({suite: 'trusted-local-agent-mcp', passed, failed}));
if (failed) process.exitCode = 1;
