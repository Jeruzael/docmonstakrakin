import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readWorkspacePassword} from '../server/security/workspaceAccess/passwordInput.ts';
import {createPrivateDirectory, assertPrivateFile} from '../server/security/workspaceAccess/privateDirectory.ts';
import {ProjectStore} from '../server/projectStore.ts';
import {TrustedLocalAgentService} from '../server/security/workspaceAccess/trustedLocalAgent.ts';
import {buildClientMcpConfigs} from '../server/security/workspaceAccess/mcpBridge.ts';

const help = `Trusted Local Agent enrollment & lifecycle CLI (offline, server stopped)

enroll --sponsor <username> --client <client-name> [--ttl-hours <hours>] [--origin <https://127.0.0.1:3001>]
list [--sponsor <username>]
revoke (--enrollment <id> | --client <client-name>) [--sponsor <username>]

Enrolls a local AI agent client (e.g., claude-code, codex, gemini-cli) under an
existing human workspace account after verifying the sponsor's password via a
private terminal prompt. Writes an owner-only MCP configuration bundle under
.security-agents/mcp-<client-name>/ and outputs ready-to-use client config snippets.
`;

function parseFlags(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!/^--[a-z-]+$/.test(key) || Object.hasOwn(result, key)) throw new Error('CLI_INPUT_INVALID');
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error('CLI_INPUT_INVALID');
    result[key] = value;
  }
  return result;
}

async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  if (['help', '--help'].includes(command)) {
    if (args.length) throw new Error('CLI_INPUT_INVALID');
    console.log(help);
    return;
  }
  if (!['enroll', 'list', 'revoke'].includes(command)) {
    throw new Error('CLI_COMMAND_INVALID');
  }
  const input = parseFlags(args);
  const workspaceRoot = process.cwd();
  const {WorkspaceStore} = await import('../server/security/workspaceAccess/store.ts');
  const authority = await WorkspaceStore.open(workspaceRoot);
  try {
    const service = new TrustedLocalAgentService({
      workspaceRoot,
      authority,
      store: new ProjectStore(),
      enabled: true,
    });

    if (command === 'list') {
      const listed = await service.listLocalClients(input['--sponsor']);
      console.log(JSON.stringify(listed, null, 2));
      return;
    }

    if (command === 'revoke') {
      if (!input['--enrollment'] && !input['--client']) throw new Error('CLI_REVOKE_TARGET_REQUIRED');
      const revoked = await service.revokeLocalClient({
        sponsorPrincipalId: input['--sponsor'],
        enrollmentId: input['--enrollment'],
        clientName: input['--client'],
      });
      console.log(JSON.stringify(revoked, null, 2));
      return;
    }

    // command === 'enroll'
    const sponsorName = input['--sponsor'];
    const clientName = input['--client'];
    if (!sponsorName || !clientName) throw new Error('CLI_SPONSOR_AND_CLIENT_REQUIRED');
    const ttlHours = input['--ttl-hours'] ? Number(input['--ttl-hours']) : 168;
    if (!Number.isSafeInteger(ttlHours) || ttlHours < 1 || ttlHours > 720) {
      throw new Error('CLI_TTL_INVALID');
    }

    const require = createRequire(typeof __filename === 'string' ? __filename : import.meta.url);
    if (require('argon2/package.json').version !== '0.45.1') throw new Error('WORKSPACE_DEPENDENCY_MISMATCH');
    const password = await readWorkspacePassword();
    const {BoundedVerifier} = await import('../server/security/syntheticFoundations/boundedVerifier.ts');
    const argon = await import('argon2');
    const verifier = new BoundedVerifier(argon.default ?? argon);

    const record = await authority.execute({command: 'credential', name: sponsorName});
    if (!record?.principal || record.principal.disabled || !(await verifier.verify(record.verifier, password))) {
      throw new Error('CLI_SPONSOR_AUTHENTICATION_FAILED');
    }

    const enrolled = await service.enrollLocalClient({
      sponsorPrincipalId: sponsorName,
      clientName,
      ttlMs: ttlHours * 3600_000,
    });
    if ('error' in enrolled) {
      throw new Error(enrolled.error);
    }

    const origin = input['--origin'] || 'https://127.0.0.1:3001';
    const agentsDir = path.join(workspaceRoot, '.security-agents');
    if (!fs.existsSync(agentsDir)) createPrivateDirectory(agentsDir);
    const mcpDir = path.join(agentsDir, `mcp-${clientName}`);
    if (!fs.existsSync(mcpDir)) createPrivateDirectory(mcpDir);
    const tokenPath = path.join(mcpDir, 'agent.token');
    const configPath = path.join(mcpDir, 'mcp-config.json');
    const caPath = path.join(workspaceRoot, '.security', 'tls', 'loopback.crt');
    fs.writeFileSync(tokenPath, enrolled.token + '\n', {mode: 0o600});
    assertPrivateFile(tokenPath);
    fs.writeFileSync(configPath, JSON.stringify({origin, caPath, tokenPath}, null, 2) + '\n', {mode: 0o600});
    assertPrivateFile(configPath);

    const clientConfigs = buildClientMcpConfigs({
      repoRoot: workspaceRoot,
      privateConfigPath: configPath,
      mode: 'TRUSTED_LOCAL_AGENT',
    });

    console.log(
      JSON.stringify(
        {
          command: 'enroll',
          completed: true,
          mode: 'TRUSTED_LOCAL_AGENT',
          enrollment: enrolled.enrollment,
          privateMcpConfigPath: configPath,
          privateTokenPath: tokenPath,
          clientConfigs,
        },
        null,
        2
      )
    );
  } finally {
    await authority.close();
  }
}

main().catch(error => {
  const code =
    typeof error?.message === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.message)
      ? error.message
      : 'TRUSTED_LOCAL_AGENT_CLI_FAILED';
  console.error(code);
  process.exitCode = 1;
});
