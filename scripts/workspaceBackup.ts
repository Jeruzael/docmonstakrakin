import path from 'node:path';
import { createWorkspaceBackup, verifyWorkspaceBackup, prepareWorkspaceRestore } from '../server/security/workspaceAccess/backup.ts';

const usage = 'Offline workspace backup (run from the selected workspace):\n' +
  '  tsx scripts/workspaceBackup.ts create\n' +
  '  tsx scripts/workspaceBackup.ts verify --id UUID [--expected-sha256 HEX]\n' +
  '  tsx scripts/workspaceBackup.ts prepare-restore --id UUID --destination ABSOLUTE_NEW_PATH --confirm-unactivated [--expected-sha256 HEX]\n' +
  'Preparation preserves original provenance and cannot activate authority or establish revocation freshness.\n';
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if ((command === '--help' || command === 'help') && args.length === 0) { process.stdout.write(usage); return; }
  const options = new Map<string, string>();
  const allowed = command === 'verify' ? ['--id', '--expected-sha256'] : command === 'prepare-restore' ? ['--id', '--expected-sha256', '--destination', '--confirm-unactivated'] : [];
  const invalid = () => { const e: any = Error('WORKSPACE_BACKUP_USAGE'); e.code = 'WORKSPACE_BACKUP_USAGE'; throw e; };
  if (!['create', 'verify', 'prepare-restore'].includes(command)) invalid();
  for (let i = 0; i < args.length; i++) {
    const key = args[i]; if (!allowed.includes(key) || options.has(key)) invalid();
    if (key === '--confirm-unactivated') options.set(key, 'true');
    else { const value = args[++i]; if (!value || value.startsWith('--')) invalid(); options.set(key, value); }
  }
  if (command !== 'create' && !options.has('--id')) invalid();
  if (command === 'prepare-restore' && (!options.has('--destination') || !path.isAbsolute(options.get('--destination')!) || !options.has('--confirm-unactivated'))) invalid();
  const root = process.cwd();
  const result = command === 'create' ? await createWorkspaceBackup(root) : command === 'verify'
    ? await verifyWorkspaceBackup(root, options.get('--id')!, options.get('--expected-sha256'))
    : await prepareWorkspaceRestore(root, options.get('--id')!, options.get('--destination')!, options.get('--expected-sha256'));
  process.stdout.write(JSON.stringify(result) + '\n');
}
main().catch(e => {
  const code = typeof e?.code === 'string' && /^WORKSPACE_[A-Z_]+$/.test(e.code) ? e.code : 'WORKSPACE_BACKUP_FAILED';
  process.stderr.write(code + '\n'); process.exitCode = 1;
});
