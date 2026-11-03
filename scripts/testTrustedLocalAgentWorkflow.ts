/**
 * End-to-end 10-step vertical workflow test for TRUSTED_LOCAL_AGENT mode.
 * Simulates a local AI agent given a synthetic GitHub repository URL,
 * analyzing the repository, creating a DMK project, populating architecture,
 * running the Adaptive Requirements Questionnaire, asking only missing
 * decision-material questions, recording requirements/decisions, deriving and
 * organizing tasks, proposing SSDLC controls & managed documentation, and
 * reporting progress/blockers over the stdio MCP bridge against a live
 * ENFORCED loopback HTTPS DMK server.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import {spawn, execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {PassThrough} from 'node:stream';
import {randomBytes, randomUUID} from 'node:crypto';
import {ProjectStore} from '../server/projectStore.ts';
import {snapshotProjectStore} from '../server/projectPersistence.ts';
import {WorkspaceStore} from '../server/security/workspaceAccess/store.ts';
import {BoundedVerifier} from '../server/security/syntheticFoundations/boundedVerifier.ts';
import {createPrivateDirectory} from '../server/security/workspaceAccess/privateDirectory.ts';
import {
  attachMcpStdioTransport,
  createWorkspaceMcpBridge,
  loadPrivateMcpConfig,
} from '../server/security/workspaceAccess/mcpBridge.ts';

const source = process.cwd();
const parent = fs.realpathSync.native(os.tmpdir());
const directory = fs.mkdtempSync(path.join(parent, 'dmk-tla-workflow-'));
const password = 'Synthetic-only-' + randomBytes(18).toString('hex');

let passed = 0;
let failed = 0;
let output = '';
let base = '';
let cookie = '';
let csrf = '';
let agentToken = '';
let enrollmentId = '';
let ca: Buffer;
let child: ReturnType<typeof spawn> | undefined;

async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    passed++;
    console.log('PASS ' + name);
  } catch (e) {
    failed++;
    console.error(
      'FAIL ' +
        name +
        ': ' +
        String(e)
          .replaceAll(password, '[redacted]')
          .replaceAll(agentToken || '!EMPTY!', '[redacted]')
    );
    throw e;
  }
}

async function stop() {
  if (child && child.exitCode === null) {
    const done = new Promise<void>(r => child!.once('exit', () => r()));
    child.kill('SIGKILL');
    await done;
  }
}

async function launch() {
  const socket = net.createServer();
  await new Promise<void>(r => socket.listen(0, '127.0.0.1', r));
  const port = (socket.address() as net.AddressInfo).port;
  await new Promise<void>(r => socket.close(() => r()));
  base = 'https://127.0.0.1:' + port;
  output = '';
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    PORT: String(port),
    DMK_WORKSPACE_ACCESS: 'ENFORCED',
    DMK_TRUSTED_LOCAL_AGENT: '1',
    DMK_TLS_CERT: '.security/tls/loopback.crt',
    DMK_TLS_KEY: '.security/tls/loopback.key',
    GEMINI_API_KEY: '',
  };
  for (const k of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP']) {
    if (process.env[k]) env[k] = process.env[k];
  }
  child = spawn(
    process.execPath,
    [
      '--import',
      pathToFileURL(path.join(source, 'node_modules/tsx/dist/loader.mjs')).href,
      '--import',
      pathToFileURL(path.join(directory, 'deny-native.mjs')).href,
      path.join(source, 'server.ts'),
    ],
    {cwd: directory, env, windowsHide: true, stdio: 'pipe'}
  );
  child.stdout!.on('data', b => (output += b));
  child.stderr!.on('data', b => (output += b));
  const deadline = Date.now() + 20000;
  while (child.exitCode === null && !output.includes('Control Plane running') && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 30));
  }
  assert.equal(child.exitCode, null, output.slice(-1500));
  assert.match(output, /Control Plane running/);
}

async function api(endpoint: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return await new Promise<{status: number; data: any; cookie: string}>((resolve, reject) => {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request(
      base + endpoint,
      {
        method,
        ca,
        minVersion: 'TLSv1.3',
        agent: false,
        headers: {
          Origin: base,
          ...(text ? {'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(text))} : {}),
          ...headers,
        },
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', d => chunks.push(Buffer.from(d)));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode!,
              data: JSON.parse(Buffer.concat(chunks).toString()),
              cookie: res.headers['set-cookie']?.[0] ?? '',
            });
          } catch {
            reject(Error('FIXTURE_RESPONSE_INVALID'));
          }
        });
      }
    );
    req.setTimeout(8000, () => req.destroy(Error('FIXTURE_HTTP_TIMEOUT')));
    req.on('error', reject);
    req.end(text);
  });
}

const humanHeaders = () => ({Cookie: cookie, 'X-DMK-CSRF': csrf});

/**
 * Helper to call an MCP tool over standard newline-delimited JSON-RPC stdio streams.
 */
async function createMcpSession(configPath: string) {
  const loaded = loadPrivateMcpConfig(configPath);
  const bridge = createWorkspaceMcpBridge({origin: loaded.origin, ca: loaded.ca, token: loaded.token});
  const input = new PassThrough();
  const outputStream = new PassThrough();
  const transport = attachMcpStdioTransport(bridge, input, outputStream);
  let seq = 1;
  let buffer = '';
  const pending = new Map<number, (msg: any) => void>();

  outputStream.on('data', chunk => {
    buffer += chunk.toString('utf8');
    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        const parsed = JSON.parse(line);
        const resolver = pending.get(parsed.id);
        if (resolver) {
          pending.delete(parsed.id);
          resolver(parsed);
        }
      }
      nl = buffer.indexOf('\n');
    }
  });

  const rpc = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((resolve, reject) => {
      const id = seq++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP RPC timeout on ${method}`));
      }, 10000);
      pending.set(id, msg => {
        clearTimeout(timer);
        resolve(msg);
      });
      input.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n');
    });

  const callTool = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await rpc('tools/call', {name, arguments: args});
    const text = res?.result?.content?.[0]?.text;
    const parsed = text ? JSON.parse(text) : null;
    return {isError: Boolean(res?.result?.isError), data: parsed, raw: res};
  };

  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {name: 'claude-code-local-agent', version: '1.0.0'},
  });

  return {
    rpc,
    callTool,
    close: async () => {
      transport.close();
      bridge.close();
    },
  };
}

try {
  // 0. Initialize disposable ENFORCED workspace authority and loopback TLS
  await check('Step 0: Initialize disposable ENFORCED workspace and enroll Trusted Local Agent in one step', async () => {
    const state = new ProjectStore();
    const canonical = structuredClone(state.projects[0]);
    for (const key of Object.keys(state)) (state as any)[key] = key === 'projects' ? [] : {};
    canonical.id = 'PRJ-DOCMONSTAKRAKIN';
    canonical.name = 'Docmonstakrakin Canonical';
    state.projects.push(canonical);

    const argon = await import('argon2');
    const verifier = await new BoundedVerifier(argon.default ?? argon).hash(password);
    const store = await WorkspaceStore.open(directory, {initialize: true, actionReceipts: true});
    try {
      await store.execute({
        command: 'bootstrap',
        principal: {
          id: 'gio-local-dev',
          name: 'gio-local-dev',
          personId: 'person-gio-local',
          kind: 'HUMAN',
          roles: ['Security Officer', 'Lead Architect'],
          disabled: false,
          credentialRevision: 1,
          canCreateProjects: true,
        },
        verifier,
        stateJson: JSON.stringify(snapshotProjectStore(state)),
      });
    } finally {
      await store.close();
    }

    const tls = path.join(directory, '.security/tls');
    createPrivateDirectory(tls);
    const config = path.join(directory, 'openssl.cnf');
    fs.writeFileSync(config, '[req]\nprompt=no\ndistinguished_name=subject\n[subject]\nCN=Disposable TLA E2E\n');
    const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : '/usr/bin/openssl';
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
        config,
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-addext',
        'basicConstraints=critical,CA:FALSE',
        '-addext',
        'extendedKeyUsage=serverAuth',
        '-keyout',
        path.join(tls, 'loopback.key'),
        '-out',
        path.join(tls, 'loopback.crt'),
      ],
      {stdio: 'pipe', windowsHide: true, timeout: 10000}
    );
    ca = fs.readFileSync(path.join(tls, 'loopback.crt'));
    fs.mkdirSync(path.join(directory, 'dist'));
    fs.writeFileSync(path.join(directory, 'dist/index.html'), '<html>Disposable TLA E2E</html>');
    fs.writeFileSync(
      path.join(directory, 'deny-native.mjs'),
      `import {installNativeCredentialTripwire} from ${JSON.stringify(
        pathToFileURL(path.join(source, 'scripts/fixtures/syntheticServerPreload.ts')).href
      )};installNativeCredentialTripwire();`
    );

    await launch();

    const discovery = await api('/api/external/discovery');
    assert.equal(discovery.status, 200);
    assert.equal(discovery.data.trustedLocalAgent?.enabled, true);
    assert.equal(discovery.data.trustedLocalAgent?.mode, 'TRUSTED_LOCAL_AGENT');

    const loginRes = await api('/api/governance/session', 'POST', {
      username: 'gio-local-dev',
      password,
    });
    assert.equal(loginRes.status, 200);
    cookie = loginRes.cookie.split(';')[0];
    csrf = loginRes.data.csrf;

    // One-time local client enrollment through sponsor endpoint
    const enrollRes = await api(
      '/api/external/sponsor-actions',
      'POST',
      {
        version: 1,
        action: 'enrollTrustedLocalAgent',
        operationId: randomUUID(),
        clientName: 'claude-code-local',
        ttlHours: 168,
      },
      humanHeaders()
    );
    assert.equal(enrollRes.status, 200, JSON.stringify(enrollRes.data));
    assert.equal(enrollRes.data.accepted, true);
    agentToken = enrollRes.data.token;
    enrollmentId = enrollRes.data.enrollment.enrollmentId;
    assert.match(agentToken, /^dmk_tla_v1_[a-f0-9]{64}$/);
  });

  // Prepare private MCP config file for the local agent client
  const agentsDir = path.join(directory, '.security-agents');
  if (!fs.existsSync(agentsDir)) createPrivateDirectory(agentsDir);
  const mcpDir = path.join(agentsDir, 'mcp');
  createPrivateDirectory(mcpDir);
  const tokenFile = path.join(mcpDir, 'agent.token');
  const mcpConfigFile = path.join(mcpDir, 'mcp-config.json');
  fs.writeFileSync(tokenFile, agentToken + '\n', {mode: 0o600});
  fs.writeFileSync(
    mcpConfigFile,
    JSON.stringify({
      origin: base,
      caPath: path.join(directory, '.security/tls/loopback.crt'),
      tokenPath: tokenFile,
    }),
    {mode: 0o600}
  );

  // Create synthetic repository to simulate "User gives an agent a GitHub repository URL"
  const syntheticRepoDir = path.join(directory, 'pulse-ledger-api-repo');
  fs.mkdirSync(path.join(syntheticRepoDir, 'src'), {recursive: true});
  fs.mkdirSync(path.join(syntheticRepoDir, '.github/workflows'), {recursive: true});
  fs.writeFileSync(
    path.join(syntheticRepoDir, 'package.json'),
    JSON.stringify({
      name: 'pulse-ledger-api',
      version: '1.2.0',
      description: 'Multi-tenant financial event ledger API with mTLS and PostgreSQL audit persistence',
      dependencies: {fastify: '^5.0.0', pg: '^8.13.0', zod: '^3.23.8'},
      devDependencies: {typescript: '^5.8.0', vitest: '^3.0.0'},
    })
  );
  fs.writeFileSync(
    path.join(syntheticRepoDir, '.github/workflows/ci.yml'),
    'name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n'
  );

  const mcp = await createMcpSession(mcpConfigFile);
  let projectId = '';
  let stateVersion = 0;
  let derivedReqId = '';
  let proposedSecReqId = '';

  try {
    await check('Steps 1-3: Agent analyzes synthetic GitHub repo, creates DMK project, and populates architecture & ADRs', async () => {
      // Step 1: Agent inspects synthetic repository metadata
      const pkgJson = JSON.parse(fs.readFileSync(path.join(syntheticRepoDir, 'package.json'), 'utf8'));
      const hasCi = fs.existsSync(path.join(syntheticRepoDir, '.github/workflows/ci.yml'));
      assert.equal(pkgJson.name, 'pulse-ledger-api');
      assert.equal(hasCi, true);

      // Verify capability discovery via MCP
      const caps = await mcp.callTool('get_capabilities', {});
      assert.equal(caps.isError, false);
      assert.equal(caps.data.mode, 'TRUSTED_LOCAL_AGENT');

      // Step 2: Create project in DMK from discovered repository context
      const created = await mcp.callTool('create_project', {
        name: 'Pulse Ledger API',
        description: pkgJson.description,
        repoPath: 'https://github.com/acme-sec/pulse-ledger-api',
        maturity: 'EXISTING_PROJECT',
        profiles: ['API_SERVICE', 'CLOUD_SAAS'],
        specializedProfiles: ['FINANCIAL_LEDGER'],
        deliveryMethod: 'CI_CD',
        deploymentIntent: 'Production Cloud Kubernetes',
        dataSensitivity: 'CONFIDENTIAL',
        assuranceInputs: {
          dataSensitivity: 'HIGH',
          businessCriticality: 'HIGH',
          exposure: 'INTERNET_FACING',
          regulatoryScope: ['SOC2', 'PCI_DSS'],
          aiUsage: 'NONE',
          teamMaturity: 'EXPERIENCED',
        },
        productBaseline: {
          problemStatement: 'Tenants need tamper-evident financial transaction recording with strict tenant isolation.',
          targetUsers: ['Fintech Platform Engineers', 'Compliance Auditors'],
          valueProposition: 'Deterministic double-entry event ledger with cryptographic hash chaining.',
          successMetrics: ['Zero cross-tenant data leakage', '99.99% write durability'],
          inScope: ['Ledger ingestion API', 'PostgreSQL append-only store', 'Audit export'],
          outOfScope: ['Consumer mobile UI', 'Card issuing processor'],
          assumptions: ['PostgreSQL 16 with row-level security is available in target VPC'],
          constraints: ['All API traffic must use TLS 1.3'],
          dependencies: ['PostgreSQL 16', 'Fastify 5'],
          initialRisks: ['Broken object-level authorization across tenant IDs'],
        },
        technicalBaseline: {
          stack: {
            languages: ['TypeScript'],
            frameworks: ['Fastify'],
            databases: ['PostgreSQL'],
            infrastructure: ['Docker', 'GitHub Actions'],
          },
          environments: ['local', 'staging', 'production'],
          architectureStyle: 'Modular Service + Append-Only Ledger DB',
          authenticationModel: 'OAuth2 JWT + mTLS service identity',
          dataStorageSummary: 'PostgreSQL 16 with RLS and SHA-256 hash-chained ledger rows',
          externalIntegrations: ['KMS Key Service', 'SIEM Audit Sink'],
          ciCdWorkflowSummary: 'GitHub Actions build, typecheck, unit tests, and SAST on PR',
        },
      });
      assert.equal(created.isError, false, JSON.stringify(created.data));
      projectId = created.data.project.id;
      stateVersion = created.data.project.stateVersion;
      assert.match(projectId, /^PRJ-/);

      // Step 3: Populate architecture components and PROPOSED ADRs discovered from repository
      const arch = await mcp.callTool('upsert_architecture', {
        projectId,
        expectedStateVersion: stateVersion,
        components: [
          {
            id: 'CMP-API-GW',
            name: 'Fastify Ledger Ingestion Gateway',
            category: 'API_GATEWAY',
            trustZone: 'DMZ_PUBLIC',
            technology: 'TypeScript / Fastify 5',
            description: 'Validates tenant JWTs, enforces schema via Zod, and rate-limits ledger writes.',
            dataClassification: 'CONFIDENTIAL',
            inboundProtocols: ['HTTPS'],
            outboundProtocols: ['TLS_PG'],
            securityControls: ['CTRL-ASVS-V4', 'CTRL-TLS-1.3'],
          },
          {
            id: 'CMP-PG-STORE',
            name: 'PostgreSQL Append-Only Ledger Store',
            category: 'DATA_STORE',
            trustZone: 'RESTRICTED_DATA',
            technology: 'PostgreSQL 16',
            description: 'Stores immutable ledger entries with tenant RLS policies and hash chains.',
            dataClassification: 'RESTRICTED',
            inboundProtocols: ['TLS_PG'],
            outboundProtocols: [],
            securityControls: ['CTRL-PG-RLS', 'CTRL-HASH-CHAIN'],
          },
        ],
        adrs: [
          {
            id: 'ADR-001',
            title: 'Enforce PostgreSQL Row-Level Security for Multi-Tenant Isolation',
            context: 'Pulse Ledger API serves multiple financial tenants in a shared PostgreSQL cluster.',
            decision: 'Bind session tenant_id from verified JWT claims and enforce PostgreSQL RLS on all ledger tables.',
            consequences: {
              positive: ['Prevents cross-tenant reads even if query filter is omitted'],
              negative: ['Requires connection-scoped session parameter setup'],
              risks: ['Connection pool state bleed if transaction reset fails'],
            },
          },
        ],
      });
      assert.equal(arch.isError, false, JSON.stringify(arch.data));
      assert.equal(arch.data.components.length, 2);
      assert.equal(arch.data.adrs.length, 1);
      assert.equal(arch.data.adrs[0].status, 'PROPOSED');
      stateVersion = arch.data.stateVersion;
    });

    await check('Steps 4-6: Agent runs Adaptive Questionnaire, identifies missing decision-material questions, and records answers & requirements', async () => {
      // Step 4: Start Adaptive Requirements Questionnaire
      const qRes = await mcp.callTool('get_discovery_questions', {projectId});
      assert.equal(qRes.isError, false);
      assert.ok(Array.isArray(qRes.data.unresolvedDecisionQuestions));
      assert.ok(qRes.data.unresolvedDecisionQuestions.length > 0);
      assert.equal(qRes.data.answeredQuestions.length, 0);
      assert.equal(
        qRes.data.unresolvedDecisionQuestions.some((q: any) => q.id === 'PROD-Q-001' || q.id === 'USER-Q-001'),
        false,
        'facts already established in productBaseline must not be re-asked in unresolvedDecisionQuestions'
      );
      assert.ok(qRes.data.establishedByBaselineQuestions.length >= 2);

      // Step 5 & 6: Answer unresolved questions based on repository findings & user decisions
      const reqQuestions = qRes.data.unresolvedDecisionQuestions.filter(
        (q: any) => Array.isArray(q.derivationRules) && q.derivationRules.some((r: any) => r.outputType === 'REQUIREMENT')
      );
      const toAnswer = reqQuestions.slice(0, 3);
      const answersPayload = toAnswer.map((q: any, idx: number) => ({
        questionId: q.id,
        state: idx < 2 ? 'ANSWERED' : 'DEFERRED',
        answer:
          idx < 2
            ? q.answerType === 'MULTI_SELECT' && q.options?.length
              ? [q.options[0].value]
              : q.options?.length
                ? q.options[0].value
                : `Enforced via Fastify Zod validation and PostgreSQL RLS (${q.id})`
            : '',
        justification:
          idx < 2
            ? 'Established from repository Fastify middleware and ADR-001 architecture decision.'
            : 'Deferred pending staging load-test benchmark confirmation with operator.',
      }));

      const ansRes = await mcp.callTool('submit_discovery_answers', {
        projectId,
        expectedStateVersion: stateVersion,
        answers: answersPayload,
      });
      assert.equal(ansRes.isError, false, JSON.stringify(ansRes.data));
      assert.equal(ansRes.data.answeredCount, 2);
      assert.equal(ansRes.data.deferredCount, 1);
      assert.ok(ansRes.data.derivedRequirements.length >= 1);
      derivedReqId = ansRes.data.derivedRequirements[0].id;
      stateVersion = ansRes.data.stateVersion;

      // Verify re-querying discovery questions does NOT re-ask the already answered questions
      const qAfter = await mcp.callTool('get_discovery_questions', {projectId});
      assert.equal(qAfter.isError, false);
      const answeredIds = new Set(qAfter.data.answeredQuestions.map((q: any) => q.id));
      assert.equal(answeredIds.has(toAnswer[0].id), true);
      assert.equal(
        qAfter.data.unresolvedDecisionQuestions.some((q: any) => q.id === toAnswer[0].id),
        false,
        'answered questions must not appear in unresolvedDecisionQuestions'
      );
    });

    await check('Steps 7-8: Agent proposes SSDLC security requirements, derives/organizes tasks, authors project docs, and stages proposals', async () => {
      // Propose explicit SSDLC security & verification requirements
      const reqRes = await mcp.callTool('propose_requirements', {
        projectId,
        expectedStateVersion: stateVersion,
        requirements: [
          {
            title: 'Tenant Context Isolation on Pooled DB Connections',
            statement:
              'The ledger service SHALL set app.current_tenant_id inside a transaction-local SET LOCAL statement before executing any SQL query.',
            category: 'SECURITY',
            priority: 'CRITICAL',
            rationale: 'Prevents connection-pool tenant bleed under concurrent Fastify requests.',
            acceptanceCriteria: [
              'Every DB query runs inside a transaction with SET LOCAL app.current_tenant_id',
              'Integration test verifies tenant A token cannot read or append to tenant B ledger stream',
            ],
            standardLinks: ['ASVS-V4.1', 'NIST-SSDF-PW.4'],
          },
        ],
      });
      assert.equal(reqRes.isError, false, JSON.stringify(reqRes.data));
      proposedSecReqId = reqRes.data.requirements[0].id;
      assert.equal(reqRes.data.requirements[0].status, 'PROPOSED');
      stateVersion = reqRes.data.stateVersion;

      // Step 7a: Derive work item from requirement
      const deriveRes = await mcp.callTool('manage_work_items', {
        projectId,
        expectedStateVersion: stateVersion,
        mode: 'DERIVE_REQUIREMENT',
        requirementId: proposedSecReqId,
      });
      assert.equal(deriveRes.isError, false, JSON.stringify(deriveRes.data));
      const derivedTaskId = deriveRes.data.workItem.id;
      stateVersion = deriveRes.data.stateVersion;

      // Step 7b: Organize additional tasks with dependencies, priorities, and acceptance criteria
      const organizeRes = await mcp.callTool('manage_work_items', {
        projectId,
        expectedStateVersion: stateVersion,
        mode: 'UPSERT_TASKS',
        tasks: [
          {
            id: 'WORK-PULSE-RLS-TESTS',
            title: 'Implement Cross-Tenant RLS Integration Test Suite',
            description: 'Add Vitest integration suite verifying PostgreSQL RLS blocks cross-tenant queries.',
            type: 'TASK',
            priority: 'P0',
            risk: 'HIGH',
            sprint: 1,
            requirements: [proposedSecReqId, derivedReqId].filter(Boolean),
            dependencies: [derivedTaskId],
            acceptanceCriteria: [
              'Cross-tenant SELECT returns 0 rows',
              'Cross-tenant INSERT is rejected by RLS WITH CHECK policy',
            ],
            checklist: [
              {text: 'Create disposable test tenant fixtures', done: true},
              {text: 'Verify SET LOCAL scoping on transaction rollback', done: false},
            ],
          },
        ],
      });
      assert.equal(organizeRes.isError, false, JSON.stringify(organizeRes.data));
      stateVersion = organizeRes.data.stateVersion;

      // Step 7c: Update task progress (READY -> IN_PROGRESS -> VERIFICATION and checklist completion)
      const progressTaskRes = await mcp.callTool('manage_work_items', {
        projectId,
        expectedStateVersion: stateVersion,
        mode: 'UPDATE_TASK_PROGRESS',
        updates: [
          {
            itemId: 'WORK-PULSE-RLS-TESTS',
            status: 'VERIFICATION',
            checklistIndex: 1,
            checklistDone: true,
          },
        ],
      });
      assert.equal(progressTaskRes.isError, false, JSON.stringify(progressTaskRes.data));
      assert.equal(progressTaskRes.data.updated[0].status, 'VERIFICATION');
      assert.equal(progressTaskRes.data.updated[0].checklist[1].done, true);
      stateVersion = progressTaskRes.data.stateVersion;

      // Step 8a: Author project managed Security & Verification documentation
      const docRes = await mcp.callTool('upsert_project_document', {
        projectId,
        expectedStateVersion: stateVersion,
        title: 'Pulse Ledger Security Architecture and Verification Plan',
        kind: 'SECURITY',
        format: 'MARKDOWN',
        reason: 'Documented multi-tenant RLS controls and verification matrix from repository analysis',
        content: [
          '# Pulse Ledger Security Architecture & Verification Plan',
          '',
          '## 1. Trust Zones & Components',
          '- **CMP-API-GW**: Fastify 5 TLS 1.3 ingress gateway',
          '- **CMP-PG-STORE**: PostgreSQL 16 append-only ledger with RLS',
          '',
          '## 2. Mandatory Security Controls',
          '- Transaction-scoped `SET LOCAL app.current_tenant_id` binding (`' + proposedSecReqId + '`)',
          '- SHA-256 hash chaining across tenant ledger events',
          '',
          '## 3. Verification Activities',
          '- Task `WORK-PULSE-RLS-TESTS` executes cross-tenant isolation assertions in CI.',
        ].join('\n'),
      });
      assert.equal(docRes.isError, false, JSON.stringify(docRes.data));
      assert.match(docRes.data.documentId, /^MDOC-/);
      stateVersion = docRes.data.stateVersion;

      // Step 8b: Stage structured SSDLC proposals for human review
      const stageRes = await mcp.callTool('stage_ssdlc_proposals', {
        projectId,
        expectedStateVersion: stateVersion,
        summary: 'Proposed STRIDE threat mitigations and rate-limiting controls from repo audit',
        changes: [
          {
            entityType: 'RISK',
            action: 'ADD',
            targetId: 'RISK-RLS-POOL',
            after: {
              id: 'RISK-RLS-POOL',
              title: 'Connection Pool Tenant Context Bleed',
              description: 'Session-level SET instead of transaction-local SET LOCAL could leak tenant context.',
            },
          },
        ],
      });
      assert.equal(stageRes.isError, false, JSON.stringify(stageRes.data));
      assert.equal(stageRes.data.session.status, 'AWAITING_HUMAN_REVIEW');
      stateVersion = stageRes.data.stateVersion;
    });

    await check('Steps 9-10: Agent queries progress, blockers, release gates, and verifies human governance signoff remains protected', async () => {
      const progress = await mcp.callTool('get_project_progress', {projectId});
      assert.equal(progress.isError, false, JSON.stringify(progress.data));
      assert.equal(progress.data.projectId, projectId);
      assert.equal(progress.data.stateVersion, stateVersion);
      assert.ok(progress.data.discoveryCoverage.mandatoryResolved >= 2);
      assert.ok(progress.data.counts.requirements >= 2);
      assert.ok(progress.data.counts.components === 2);
      assert.ok(progress.data.counts.adrs === 1);
      assert.ok(progress.data.counts.workItems >= 3);
      assert.ok(progress.data.counts.managedDocuments === 1);
      assert.ok(progress.data.nextAction?.id);
      assert.ok(Array.isArray(progress.data.releaseGates?.gates));

      // Verify agent cannot transition task to VERIFIED (requires human reviewer)
      const forbiddenVerify = await mcp.callTool('manage_work_items', {
        projectId,
        expectedStateVersion: stateVersion,
        mode: 'UPDATE_TASK_PROGRESS',
        updates: [{itemId: 'WORK-PULSE-RLS-TESTS', status: 'VERIFIED'}],
      });
      assert.equal(forbiddenVerify.isError, true);
      assert.equal(forbiddenVerify.data.error, 'GOVERNANCE_HUMAN_SIGNOFF_REQUIRED');

      // Verify human sponsor CAN transition the task to VERIFIED through the human governance API
      const humanVerifyRes = await api(
        `/api/projects/${projectId}/work-items`,
        'POST',
        {itemId: 'WORK-PULSE-RLS-TESTS', status: 'VERIFIED'},
        {...humanHeaders(), 'X-DMK-Request-ID': randomUUID()}
      );
      assert.equal(humanVerifyRes.status, 200, JSON.stringify(humanVerifyRes.data));
      assert.equal(humanVerifyRes.data.status, 'VERIFIED');

      // Verify agent cannot downgrade or overwrite a task once a human has marked it VERIFIED
      const postVerifyProgress = await mcp.callTool('get_project_progress', {projectId});
      stateVersion = postVerifyProgress.data.stateVersion;
      const forbiddenDowngrade = await mcp.callTool('manage_work_items', {
        projectId,
        expectedStateVersion: stateVersion,
        mode: 'UPDATE_TASK_PROGRESS',
        updates: [{itemId: 'WORK-PULSE-RLS-TESTS', status: 'IN_PROGRESS'}],
      });
      assert.equal(forbiddenDowngrade.isError, true);
      assert.equal(forbiddenDowngrade.data.error, 'GOVERNANCE_HUMAN_SIGNOFF_REQUIRED');

      // Verify project audit ledger chain is intact and clearly attributes agent actions vs human actions
      const auditVerifyRes = await api(`/api/projects/${projectId}/audit/verify`, 'GET', undefined, humanHeaders());
      assert.equal(auditVerifyRes.status, 200);
      assert.equal(auditVerifyRes.data.valid, true);

      const auditLogsRes = await api(`/api/projects/${projectId}/audit`, 'GET', undefined, humanHeaders());
      assert.equal(auditLogsRes.status, 200);
      assert.ok(
        auditLogsRes.data.some((e: any) => String(e.actor).includes('agent:claude-code-local')),
        'audit trail must attribute agent mutations to the enrolled local agent'
      );

      // Verify sponsor revocation immediately cuts off the MCP session
      const revokeRes = await api(
        '/api/external/sponsor-actions',
        'POST',
        {
          version: 1,
          action: 'revokeTrustedLocalAgent',
          operationId: randomUUID(),
          enrollmentId,
        },
        humanHeaders()
      );
      assert.equal(revokeRes.status, 200);
      assert.equal(revokeRes.data.revoked, true);

      const afterRevoke = await mcp.callTool('list_projects', {});
      assert.equal(afterRevoke.isError, true);
    });
  } finally {
    await mcp.close();
  }
} finally {
  await stop();
  fs.rmSync(directory, {recursive: true, force: true});
}

console.log(JSON.stringify({suite: 'trusted-local-agent-workflow-e2e', passed, failed}));
if (failed) process.exitCode = 1;
