/** Test-only observation of an original strict failure. No admission or repair. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';

const PRESENCE = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'PSModulePath'];
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
function failure(error: any) {
  return { status: error?.status ?? null, signal: error?.signal ?? null, code: error?.code ?? null, errno: error?.errno ?? null,
    stderr: String(error?.stderr ?? '').slice(-3000) };
}
export function installWorkspaceAdmissionFailureDiagnostics(profile?: { appData?: string; localAppData?: string }): () => void {
  if (process.platform !== 'win32') return () => {};
  const root = process.cwd(), stat = fs.lstatSync(root), parent = fs.realpathSync.native(os.tmpdir());
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync.native(root) !== root || path.dirname(root) !== parent || !/^dmk-workspace-application-/.test(path.basename(root))) throw Error('SYNTHETIC_DIAGNOSTIC_ROOT_REQUIRED');
  const original = childProcess.execFileSync, security = path.join(root, '.security');
  const wrapped = ((file: any, args: any, options: any) => {
    const started = process.hrtime.bigint();
    try { return original(file, args, options); }
    catch (error) {
      try {
      const encoded = Array.isArray(args) ? args[args.indexOf('-EncodedCommand') + 1] : null;
      const code = typeof encoded === 'string' && encoded.length < 16384 ? Buffer.from(encoded, 'base64').toString('utf16le') : '';
      const match = /Get-Acl -LiteralPath '((?:''|[^'])*)'/.exec(code), target = match?.[1].replaceAll("''", "'");
      if (file === 'powershell.exe' && target && (target === security || path.dirname(target) === security) && code.includes('$r=$a.GetAccessRules($true,$true,') && !code.includes('SetAccessControl')) {
        const environment = options?.env ?? process.env;
        const hasProfile = [profile?.appData, profile?.localAppData].every(value => typeof value === 'string' && value.length <= 4096 && !value.includes('\0') && path.isAbsolute(value));
        console.error('WORKSPACE_STRICT_ADMISSION_FAILURE ' + JSON.stringify({ nodeProcessId: process.pid, resource: path.relative(root, target), ...failure(error),
          elapsedMs: Number(process.hrtime.bigint() - started) / 1e6, profileContextAvailable: hasProfile,
          environmentPresence: Object.fromEntries(PRESENCE.map(key => [key, !!environment[key]])) }));
        if ((error as any)?.code === 'ETIMEDOUT' && hasProfile) {
          // Original failure is control-before. Reuse the exact strict command
          // and its 4s budget, changing only two parent-supplied OS folders for
          // the middle probe. Final control exposes a cache-warming confound.
          // These read-only probes never substitute for successful admission.
          for (const variant of ['restored-both', 'control-after']) {
            const probeEnvironment = variant === 'restored-both'
              ? { ...environment, APPDATA: profile!.appData!, LOCALAPPDATA: profile!.localAppData! } : environment;
            const probeOptions = variant === 'restored-both' ? { ...options, env: probeEnvironment } : options;
            const watch = process.hrtime.bigint(); let result: Record<string, unknown>;
            try { original(file, args, probeOptions); result = { status: 0, signal: null, code: null, errno: null, stderr: '' }; }
            catch (probeError) { result = failure(probeError); }
            console.error('WORKSPACE_STRICT_ADMISSION_PROFILE_PROBE ' + JSON.stringify({ variant, resource: path.relative(root, target),
              elapsedMs: Number(process.hrtime.bigint() - watch) / 1e6, ...result,
              environmentPresence: Object.fromEntries(PRESENCE.map(key => [key, !!probeEnvironment[key]])) }));
          }
        } else {
        // Read only known, nonlinked synthetic resources. Do not call the
        // boundary here: capture/assert would populate its permission pins.
        try {
          const resources = [security, ...['owner.lock', 'authority.sqlite', 'authority.sqlite-wal', 'authority.sqlite-shm'].map(name => path.join(security, name))]
            .filter(name => { try { const s = fs.lstatSync(name); return !s.isSymbolicLink() && fs.realpathSync.native(name) === name && (s.isDirectory() || s.isFile()); } catch { return false; } });
          const context = "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$i=[System.Security.Principal.WindowsIdentity]::GetCurrent();$p=[System.Security.Principal.WindowsPrincipal]::new($i);" +
            "$resources=@(foreach($f in @(" + resources.map(literal).join(',') + ")){$a=Get-Acl -LiteralPath $f;[ordered]@{path=$f;owner=$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;protected=$a.AreAccessRulesProtected;rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{[ordered]@{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();inherited=$_.IsInherited;rights=[int]$_.FileSystemRights}})}});" +
            "[ordered]@{contextProcess='strict-powershell-child';processId=$PID;userSid=$i.User.Value;tokenOwnerSid=$i.Owner.Value;adminEnabled=$p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator);resources=$resources}|ConvertTo-Json -Depth 7 -Compress";
          const observed = original('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(context, 'utf16le').toString('base64')], options);
          const json = JSON.parse(String(observed));
          console.error('WORKSPACE_STRICT_ADMISSION_CONTEXT ' + JSON.stringify(json).slice(0, 12000));
        } catch (contextError) { console.error('WORKSPACE_STRICT_ADMISSION_CONTEXT_FAILURE ' + JSON.stringify(failure(contextError))); }
        }
      }
      } catch {} // Diagnostics must never replace the original failure.
      throw error; // Preserve the original result and original failure object.
    }
  }) as typeof childProcess.execFileSync;
  childProcess.execFileSync = wrapped;
  return () => { if (childProcess.execFileSync === wrapped) childProcess.execFileSync = original; };
}
