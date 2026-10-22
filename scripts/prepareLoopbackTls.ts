import {resolveWorkspaceTls} from '../server/security/workspaceAccess/tls.ts';

// Deliberately read-only. There is no key generation, permission repair,
// authority initialization, process termination or trust-store invocation here.
const instructions = `READ_ONLY offline loopback TLS preparation plan

No files or trust settings are changed by this command. Independent human/custody acceptance is not established by a local self-signed certificate.

Operator prerequisites:
1. Initialize the workspace authority through its separate approved offline flow, then stop the workspace server and authority owner. Do not recover or remove a live owner lock.
2. From the canonical complete checkout, prepare exactly .security/tls as a private current-owner directory. POSIX directories must be mode 0700; Windows directories need a protected ACL allowing only the current owner SID. The existing .security directory must already satisfy the shared private boundary.
3. Confirm .security/tls/loopback.crt and .security/tls/loopback.key are BOTH ABSENT. This recipe must never overwrite existing material. Use a genuine operator-selected OpenSSL installation; this tool does not acquire or execute it.
4. Run this fixed recipe only after those checks:

openssl req -new -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -sha256 -days 30 -subj "/CN=docmonstakrakin loopback" -addext "subjectAltName=IP:127.0.0.1" -addext "basicConstraints=critical,CA:FALSE" -addext "keyUsage=critical,digitalSignature" -addext "extendedKeyUsage=serverAuth" -keyout ".security/tls/loopback.key" -out ".security/tls/loopback.crt"

5. Both files must be ordinary, single-link, current-owner private files: POSIX mode 0600; Windows ACL allowing only the current owner SID. No links, aliases, additional SANs, certificate chains or extra files are admitted. Review the public certificate fingerprint through your independent custody process; never print or transmit the key.
6. Set DMK_TLS_CERT=.security/tls/loopback.crt and DMK_TLS_KEY=.security/tls/loopback.key exactly. Validate with: node --import tsx scripts/prepareLoopbackTls.ts --check

Validation reads existing files only. The listener and request origin must be wired separately to HTTPS on 127.0.0.1, with TLS 1.3, authenticated application sessions and strict Host/Origin enforcement. Do not disable client certificate verification to bypass an untrusted self-signed certificate. Trust acceptance is a separate human/operator action; this plan never installs an operational CA or changes a system/browser trust store. Offline rotation requires a fresh process because material identity is pinned in memory.
`;

const args = process.argv.slice(2);
if (args.length > 1 || args.length === 1 && !['--instructions', '--check'].includes(args[0])) {
  console.error('Usage: prepareLoopbackTls.ts [--instructions|--check]'); process.exitCode = 2;
} else if (args[0] === '--check') {
  try {
    const result = resolveWorkspaceTls(process.cwd());
    console.log(JSON.stringify({mode: 'READ_ONLY_VALIDATION', enabled: result.enabled, trustInstalled: false, humanAcceptance: false}));
  } catch (error) {
    console.error(/^WORKSPACE_[A-Z_]+$/.test((error as any)?.code || '') ? (error as any).code : 'WORKSPACE_TLS_UNAVAILABLE'); process.exitCode = 1;
  }
} else console.log(instructions);
