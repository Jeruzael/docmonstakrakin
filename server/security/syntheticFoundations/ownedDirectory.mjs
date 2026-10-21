import fs from 'node:fs';
import path from 'node:path';

// Use the same native resolver as fs.promises.realpath. The legacy synchronous
// JS resolver can retain a Windows 8dot3 alias, producing a different string
// for the same directory. Do not approximate this with case/prefix folding.
export function canonicalDirectory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw Error('PRIVATE_PATH_INVALID');
  return fs.realpathSync.native(value);
}

export function directoryIdentity(value) {
  const stat = fs.lstatSync(value, {bigint: true});
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.ino === 0n) throw Error('PRIVATE_PATH_INVALID');
  return stat.dev.toString() + ':' + stat.ino.toString();
}

export function assertOwnedDirectory(root, parent, rootIdentity, parentIdentity) {
  if (![rootIdentity, parentIdentity].every(value => typeof value === 'string' && /^\d+:\d+$/.test(value)) ||
      path.dirname(root) !== parent || !/^dmk-s2a-synthetic-[A-Za-z0-9]+$/.test(path.basename(root)) ||
      canonicalDirectory(parent) !== parent || canonicalDirectory(root) !== root ||
      directoryIdentity(parent) !== parentIdentity || directoryIdentity(root) !== rootIdentity) throw Error('PRIVATE_PATH_INVALID');
  if (process.platform !== 'win32') {
    const stat = fs.statSync(root);
    if ((stat.mode & 0o777) !== 0o700 || stat.uid !== process.getuid()) throw Error('PRIVATE_PATH_INVALID');
  }
}

export function assertOwnerMarker(root, owner) {
  const marker = path.join(root, '.synthetic-owner');
  const stat = fs.lstatSync(marker);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs.readFileSync(marker, 'utf8') !== owner) throw Error('PRIVATE_PATH_INVALID');
}
