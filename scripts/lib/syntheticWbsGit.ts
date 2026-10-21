/** Read-only TESTONLY Git object proof. Production protected-ref acquisition absent. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { syntheticHash, SYNTHETIC_WBS_LIMITS, type SyntheticGitState } from './syntheticWbsRegistration.ts';
import type { SyntheticRegistrationState } from './syntheticWbsRegistration.ts';
import { canonicalGovernanceJson } from '../verifyWbsGovernanceEnvelope.ts';

interface GitProofNode extends SyntheticGitState {
  parentShas: string[]; commitBase64: string; treeBase64: string; wbsBase64: string; ledgerBase64: string;
}
interface GitChain { kind: 'TESTONLY_GIT_OBJECTS/1'; currentCommitSha: string; nodes: GitProofNode[] }
const GIT = /^[0-9a-f]{40}$/;
function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function inertRecord(value: any, keys: string[]) {
  requireThat(value && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Object.getOwnPropertySymbols(value).length === 0 && Object.getOwnPropertyNames(value).length === keys.length && keys.every(key => {
      const d = Object.getOwnPropertyDescriptor(value, key); return d && d.enumerable && 'value' in d;
    }), 'Exact inert Git acquisition data required');
}
function inertArray(value: unknown): asserts value is any[] {
  requireThat(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && Object.getOwnPropertySymbols(value).length === 0 &&
    Object.getOwnPropertyNames(value).length === value.length + 1 && value.length <= SYNTHETIC_WBS_LIMITS.applications &&
    Array.from({ length: value.length }, (_, i) => { const d = Object.getOwnPropertyDescriptor(value, String(i)); return d && d.enumerable && 'value' in d; }).every(Boolean), 'Inert bounded Git acquisition array required');
}
function identity(type: string, raw: Buffer) {
  return crypto.createHash('sha1').update(Buffer.from(type + ' ' + raw.length + '\0')).update(raw).digest('hex');
}
function treeBlobs(tree: Buffer) {
  let cursor = 0;
  const entries = new Map<string, { mode: string; sha: string }>();
  while (cursor < tree.length) {
    const end = tree.indexOf(0, cursor); requireThat(end !== -1 && end + 21 <= tree.length, 'Malformed Git tree');
    const text = tree.subarray(cursor, end).toString('utf8'); requireThat(Buffer.from(text).equals(tree.subarray(cursor, end)), 'Git tree filename encoding');
    const split = text.indexOf(' '); requireThat(split > 0, 'Malformed Git tree entry');
    const mode = text.slice(0, split), name = text.slice(split + 1); requireThat(name && !entries.has(name) && !name.includes('/'), 'Duplicated/invalid Git tree filename');
    entries.set(name, { mode, sha: tree.subarray(end + 1, end + 21).toString('hex') }); cursor = end + 21;
  }
  return entries;
}
function decode(value: string, cap: number) {
  requireThat(typeof value === 'string' && value.length <= Math.ceil(cap / 3) * 4, 'Git proof encoding exceeds bound');
  const raw = Buffer.from(value, 'base64'); requireThat(raw.length <= cap && raw.toString('base64') === value, 'Noncanonical/bounded Git proof Base64'); return raw;
}
function validateNode(node: GitProofNode) {
  const commit = decode(node.commitBase64, 128 * 1024), tree = decode(node.treeBase64, SYNTHETIC_WBS_LIMITS.bytes);
  const wbs = decode(node.wbsBase64, SYNTHETIC_WBS_LIMITS.bytes), ledger = decode(node.ledgerBase64, SYNTHETIC_WBS_LIMITS.bytes);
  requireThat(GIT.test(node.commitSha) && GIT.test(node.treeSha) && identity('commit', commit) === node.commitSha && identity('tree', tree) === node.treeSha, 'Git commit/tree object identity mismatch');
  const headers = commit.toString('utf8').split('\n\n')[0].split('\n');
  requireThat(headers[0] === 'tree ' + node.treeSha, 'Git commit/tree binding mismatch');
  const parents = headers.filter(v => v.startsWith('parent ')).map(v => v.slice(7));
  requireThat(parents.every(v => GIT.test(v)) && canonicalGovernanceJson(parents) === canonicalGovernanceJson(node.parentShas), 'Git parent object mismatch');
  const blobs = treeBlobs(tree);
  for (const [name, raw] of [['wbs.yaml', wbs], ['ledger.json', ledger]] as const) {
    const item = blobs.get(name); requireThat(item?.mode === '100644' && item.sha === identity('blob', raw), 'Git governed blob/mode mismatch');
  }
  requireThat(node.wbsSha256 === syntheticHash(wbs) && node.ledgerSha256 === syntheticHash(ledger), 'Git governed SHA-256 mismatch');
}
/** Caller pins the applied state from durable evidence; neither mode nor fallback. */
export function verifySyntheticDescendants(applied: SyntheticGitState, acquired: GitChain) {
  const r = { valid: false, mayApply: false as const, operationalAuthority: false as const, errors: [] as string[], currentCommitSha: undefined as string | undefined };
  try {
    inertRecord(acquired, ['kind', 'currentCommitSha', 'nodes']); inertArray(acquired.nodes);
    requireThat(acquired?.kind === 'TESTONLY_GIT_OBJECTS/1' && Array.isArray(acquired.nodes) && acquired.nodes.length > 0 &&
      acquired.nodes.length <= SYNTHETIC_WBS_LIMITS.applications && GIT.test(acquired.currentCommitSha), 'Synthetic Git proof missing/oversized');
    // Separate aggregate bound prevents per-node bounds multiplying unchecked.
    let logicalBytes = 0; const seen = new Set<string>();
    for (let i = 0; i < acquired.nodes.length; i++) {
      const node = acquired.nodes[i];
      inertRecord(node, ['commitSha', 'treeSha', 'wbsSha256', 'ledgerSha256', 'parentShas', 'commitBase64', 'treeBase64', 'wbsBase64', 'ledgerBase64']);
      inertArray(node.parentShas);
      for (const field of ['commitBase64', 'treeBase64', 'wbsBase64', 'ledgerBase64']) {
        requireThat(typeof node[field] === 'string', 'Git proof bytes missing'); logicalBytes += node[field].length;
      }
      requireThat(logicalBytes <= 64 * 1024 * 1024, 'Git proof exceeds 64 MiB encoded candidate budget');
      validateNode(node); requireThat(!seen.has(node.commitSha), 'Repeated Git commit'); seen.add(node.commitSha);
      requireThat(node.wbsSha256 === applied.wbsSha256 && node.ledgerSha256 === applied.ledgerSha256, 'Descendant changes governed WBS/ledger bytes');
      if (i === 0) requireThat(node.commitSha === applied.commitSha && node.treeSha === applied.treeSha, 'Missing pinned applied Git state');
      else requireThat(node.parentShas[0] === acquired.nodes[i - 1].commitSha, 'Incomplete/reordered first-parent descendant chain');
    }
    requireThat(acquired.nodes.at(-1)!.commitSha === acquired.currentCommitSha, 'Missing current protected Git identity');
    r.valid = true; r.currentCommitSha = acquired.currentCommitSha;
  } catch (error) { r.errors.push(error instanceof Error ? error.message : 'Synthetic Git proof rejected'); }
  return r;
}

/** No caller-selected historical/current mode. Durable applied bytes remain fixed. */
export function verifySyntheticCurrentState(state: SyntheticRegistrationState, source: { kind: 'TESTONLY_GIT_SOURCE/1'; acquire: () => GitChain }) {
  if (source?.kind !== 'TESTONLY_GIT_SOURCE/1' || typeof source.acquire !== 'function')
    return { valid: false, mayApply: false as const, operationalAuthority: false as const, errors: ['Independent test-only Git acquisition required'] };
  try {
    return verifySyntheticDescendants({ commitSha: state.commitSha, treeSha: state.treeSha,
      wbsSha256: syntheticHash(state.wbsBytes), ledgerSha256: syntheticHash(state.ledgerBytes) }, source.acquire());
  } catch {
    return { valid: false, mayApply: false as const, operationalAuthority: false as const, errors: ['Test-only current Git acquisition failed'] };
  }
}

/** Actual local object acquisition for minted disposable fixture repositories only. */
export function acquireTestOnlyGitDescendants(root: string, appliedCommitSha: string, currentCommitSha: string): GitChain {
  requireThat(path.isAbsolute(root) && path.dirname(root) === fs.realpathSync.native(os.tmpdir()) && /^dmk-wbs-git-[A-Za-z0-9]+$/.test(path.basename(root)) &&
    !fs.lstatSync(root).isSymbolicLink() && fs.realpathSync.native(root) === root, 'Only generated synthetic Git fixture boundary supported');
  const markerPath = path.join(root, '.testonly-wbs-git'), marker = fs.lstatSync(markerPath, { bigint: true });
  requireThat(marker.isFile() && !marker.isSymbolicLink() && marker.nlink === 1n && marker.size === 15n && fs.realpathSync.native(markerPath) === markerPath, 'Synthetic Git fixture marker rejected');
  const fd = fs.openSync(markerPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    requireThat(opened.isFile() && opened.nlink === 1n && opened.size === 15n && opened.dev === marker.dev && opened.ino === marker.ino, 'Synthetic Git fixture marker replaced');
    const bytes = Buffer.alloc(16); let length = 0;
    while (length < bytes.length) { const n = fs.readSync(fd, bytes, length, bytes.length - length, null); if (!n) break; length += n; }
    requireThat(length === 15 && bytes.subarray(0, length).toString('utf8') === 'SYNTHETIC_ONLY\n', 'Synthetic Git fixture marker invalid');
  } finally { fs.closeSync(fd); }
  const gitDir = path.join(root, '.git'); requireThat(fs.lstatSync(gitDir).isDirectory() && !fs.lstatSync(gitDir).isSymbolicLink(), 'Synthetic Git directory required');
  for (const name of ['shallow', 'info/grafts', 'objects/info/alternates']) requireThat(!fs.existsSync(path.join(gitDir, name)), 'Synthetic shallow/replaced external Git objects unsupported');
  requireThat(GIT.test(appliedCommitSha) && GIT.test(currentCommitSha), 'Malformed requested Git identities');
  const command = (...args: string[]) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
    const result = spawnSync('git', ['--no-replace-objects', '-c', 'core.hooksPath=', '-c', 'core.fsmonitor=false', '-C', root, ...args],
      { encoding: 'buffer', timeout: 5_000, windowsHide: true, maxBuffer: 3 * 1024 * 1024, env });
    requireThat(result.status === 0 && Buffer.isBuffer(result.stdout), 'Synthetic Git objects missing or command rejected'); return result.stdout;
  };
  const history = command('rev-list', '--first-parent', '--max-count=257', currentCommitSha).toString('utf8').trim().split('\n');
  const index = history.indexOf(appliedCommitSha);
  requireThat(index >= 0 && index < SYNTHETIC_WBS_LIMITS.applications, 'Applied Git ancestor missing or descendant chain exceeds candidate bound');
  const nodes = history.slice(0, index + 1).reverse().map(commitSha => {
    const commit = command('cat-file', 'commit', commitSha), headers = commit.toString('utf8').split('\n\n')[0].split('\n');
    const treeSha = headers[0].slice(5); requireThat(GIT.test(treeSha), 'Git tree identity missing');
    const tree = command('cat-file', 'tree', treeSha), blobs = treeBlobs(tree);
    const wbsSha = blobs.get('wbs.yaml')?.sha, ledgerSha = blobs.get('ledger.json')?.sha;
    requireThat(wbsSha && ledgerSha, 'Governed synthetic Git blobs missing');
    const wbs = command('cat-file', 'blob', wbsSha), ledger = command('cat-file', 'blob', ledgerSha);
    return { commitSha, treeSha, parentShas: headers.filter(v => v.startsWith('parent ')).map(v => v.slice(7)), wbsSha256: syntheticHash(wbs), ledgerSha256: syntheticHash(ledger),
      commitBase64: commit.toString('base64'), treeBase64: tree.toString('base64'), wbsBase64: wbs.toString('base64'), ledgerBase64: ledger.toString('base64') };
  });
  return { kind: 'TESTONLY_GIT_OBJECTS/1', currentCommitSha, nodes };
}
