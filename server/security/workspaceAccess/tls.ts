import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash, createPrivateKey, X509Certificate} from 'node:crypto';
import {createSecureContext} from 'node:tls';

export const WORKSPACE_TLS_PATHS = Object.freeze({cert: '.security/tls/loopback.crt', key: '.security/tls/loopback.key'});
export const WORKSPACE_TLS_MAX_FILE_BYTES = 32768;
export type WorkspaceTlsResolution = {enabled: false} | {enabled: true; cert: Buffer; key: Buffer};
type Boundary = {assertPrivateDirectory(file: string): string; assertPrivateFile(file: string): string};
let sharedBoundary: Boundary | undefined;
const pins = new Map<string, string>();
function fail(code: string): never {throw Object.assign(new Error(code), {code});}
function boundary(): Boundary {
  if (!sharedBoundary) {
    try {
      // Match privateDirectory.ts: helper authority follows this trusted source
      // or the fixed dist layout, independently of the workspace/caller cwd.
      const helperFile = typeof __dirname === 'string'
        ? path.resolve(__dirname, path.basename(__dirname) === 'dist' ? '../server/security/workspaceAccess/privateBoundary.cjs' : 'privateBoundary.cjs')
        : fileURLToPath(new URL('./privateBoundary.cjs', import.meta.url));
      const candidate = createRequire(helperFile)(helperFile);
      if (typeof candidate.assertPrivateDirectory !== 'function' || typeof candidate.assertPrivateFile !== 'function') throw Error();
      sharedBoundary = candidate;
    } catch {fail('WORKSPACE_TLS_BOUNDARY_UNAVAILABLE');}
  }
  return sharedBoundary!;
}
const identity = (stat: fs.BigIntStats) => `${stat.dev}:${stat.ino}`;
const metadata = (stat: fs.BigIntStats) => [stat.dev, stat.ino, stat.nlink, stat.size, stat.uid, stat.mode, stat.mtimeNs, stat.ctimeNs].map(String).join(':');
function canonicalWorkspace(root: string): string {
  if (typeof root !== 'string' || !path.isAbsolute(root) || root !== path.resolve(root) || root.includes('\0') ||
    (process.platform === 'win32' && !/^[A-Z]:\\/.test(root))) fail('WORKSPACE_TLS_PATH_INVALID');
  try {
    // Reject junction/symlink ancestry and 8.3/case/dot aliases before choosing
    // the fixed descendants. The workspace itself need not be a private folder.
    let current = path.parse(root).root;
    for (const part of root.slice(current.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, part); const stat = fs.lstatSync(current, {bigint: true});
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.ino === 0n || fs.realpathSync.native(current) !== current) fail('WORKSPACE_TLS_PATH_INVALID');
    }
    return identity(fs.lstatSync(root, {bigint: true}));
  } catch {fail('WORKSPACE_TLS_PATH_INVALID');}
}
function privateFile(file: string): {bytes: Buffer; fingerprint: string; identity: string; snapshot: string} {
  const expectedIdentity = boundary().assertPrivateFile(file), before = fs.lstatSync(file, {bigint: true});
  if (identity(before) !== expectedIdentity) fail('WORKSPACE_TLS_CHANGED');
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size < 1n || before.size > BigInt(WORKSPACE_TLS_MAX_FILE_BYTES)) fail('WORKSPACE_TLS_FILE_INVALID');
  let descriptor: number | undefined;
  try {
    const flags = fs.constants.O_RDONLY | (process.platform === 'win32' ? 0 : fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    descriptor = fs.openSync(file, flags);
    const opened = fs.fstatSync(descriptor, {bigint: true});
    if (!opened.isFile() || opened.nlink !== 1n || identity(opened) !== expectedIdentity || metadata(opened) !== metadata(before)) fail('WORKSPACE_TLS_CHANGED');
    const bytes = Buffer.alloc(WORKSPACE_TLS_MAX_FILE_BYTES + 1); let length = 0;
    while (length < bytes.length) {
      const read = fs.readSync(descriptor, bytes, length, bytes.length - length, length); if (!read) break; length += read;
    }
    if (length < 1 || length > WORKSPACE_TLS_MAX_FILE_BYTES || BigInt(length) !== before.size) fail('WORKSPACE_TLS_FILE_INVALID');
    const after = fs.fstatSync(descriptor, {bigint: true});
    if (metadata(after) !== metadata(before) || boundary().assertPrivateFile(file) !== expectedIdentity || metadata(fs.lstatSync(file, {bigint: true})) !== metadata(before)) fail('WORKSPACE_TLS_CHANGED');
    const material = Buffer.from(bytes.subarray(0, length));
    return {bytes: material, fingerprint: `${metadata(before)}:${createHash('sha256').update(material).digest('hex')}`,
      identity: expectedIdentity, snapshot: metadata(before)};
  } catch (error) {
    if (/^WORKSPACE_/.test((error as any)?.code || '')) throw error;
    fail('WORKSPACE_TLS_FILE_INVALID');
  } finally {if (descriptor !== undefined) fs.closeSync(descriptor);}
}

/** Startup-only local transport material admission. This does not install trust,
 * authenticate humans, enroll authority, create keys, or authorize a listener. */
export function resolveWorkspaceTls(workspaceRoot: string, env: NodeJS.ProcessEnv = process.env): WorkspaceTlsResolution {
  if (env.DMK_TLS_CERT === undefined && env.DMK_TLS_KEY === undefined) return {enabled: false};
  if (env.DMK_TLS_CERT !== WORKSPACE_TLS_PATHS.cert || env.DMK_TLS_KEY !== WORKSPACE_TLS_PATHS.key) fail('WORKSPACE_TLS_CONFIG_INVALID');
  try {return resolveEnabledTls(workspaceRoot);}
  catch (error) {
    if (/^WORKSPACE_[A-Z_]+$/.test((error as any)?.code || '')) throw error;
    fail('WORKSPACE_TLS_FILE_INVALID');
  }
}
function resolveEnabledTls(workspaceRoot: string): WorkspaceTlsResolution {
  const rootIdentity = canonicalWorkspace(workspaceRoot), security = path.join(workspaceRoot, '.security'), tls = path.join(security, 'tls');
  const securityIdentity = boundary().assertPrivateDirectory(security), tlsIdentity = boundary().assertPrivateDirectory(tls);
  const names = fs.readdirSync(tls).sort();
  if (names.length !== 2 || names[0] !== 'loopback.crt' || names[1] !== 'loopback.key') fail('WORKSPACE_TLS_FILE_INVALID');
  const cert = privateFile(path.join(tls, 'loopback.crt')), key = privateFile(path.join(tls, 'loopback.key'));
  // Recheck the pair, not just each individual read: opening the key must not
  // let an earlier certificate pathname or ACL change go unnoticed.
  for (const [name, material] of [['loopback.crt', cert], ['loopback.key', key]] as const) {
    const file = path.join(tls, name);
    if (boundary().assertPrivateFile(file) !== material.identity || metadata(fs.lstatSync(file, {bigint: true})) !== material.snapshot) fail('WORKSPACE_TLS_CHANGED');
  }
  if (canonicalWorkspace(workspaceRoot) !== rootIdentity || boundary().assertPrivateDirectory(security) !== securityIdentity || boundary().assertPrivateDirectory(tls) !== tlsIdentity) fail('WORKSPACE_TLS_CHANGED');
  const fingerprint = [rootIdentity, securityIdentity, tlsIdentity, cert.fingerprint, key.fingerprint].join('|');
  if (pins.has(workspaceRoot) && pins.get(workspaceRoot) !== fingerprint) fail('WORKSPACE_TLS_CHANGED');
  // One PEM leaf and one unencrypted private key only; no concatenated chain,
  // hidden trailing objects, alternate format or interactive passphrase source.
  if (!/^\s*-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(cert.bytes.toString('utf8')) ||
    !/^\s*-----BEGIN (PRIVATE KEY|EC PRIVATE KEY|RSA PRIVATE KEY)-----\r?\n[A-Za-z0-9+/=\r\n]+-----END \1-----\s*$/.test(key.bytes.toString('utf8'))) fail('WORKSPACE_TLS_MATERIAL_INVALID');
  let certificate: X509Certificate;
  try {certificate = new X509Certificate(cert.bytes);} catch {fail('WORKSPACE_TLS_CERT_INVALID');}
  const now = Date.now(), from = Date.parse(certificate.validFrom), to = Date.parse(certificate.validTo);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || !Number.isFinite(now)) fail('WORKSPACE_TLS_CERT_INVALID');
  if (now < from) fail('WORKSPACE_TLS_CERT_NOT_YET_VALID');
  if (now >= to) fail('WORKSPACE_TLS_CERT_EXPIRED');
  if (certificate.ca || certificate.checkIP('127.0.0.1') !== '127.0.0.1' || certificate.subjectAltName !== 'IP Address:127.0.0.1') fail('WORKSPACE_TLS_SAN_INVALID');
  try {
    if (!certificate.checkPrivateKey(createPrivateKey(key.bytes))) fail('WORKSPACE_TLS_KEY_MISMATCH');
    createSecureContext({cert: cert.bytes, key: key.bytes, minVersion: 'TLSv1.3'});
  } catch (error) {
    if ((error as any)?.code === 'WORKSPACE_TLS_KEY_MISMATCH') throw error;
    fail('WORKSPACE_TLS_MATERIAL_INVALID');
  }
  pins.set(workspaceRoot, fingerprint);
  return {enabled: true, cert: cert.bytes, key: key.bytes};
}
