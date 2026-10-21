/**
 * Actual durable transactions in a minted disposable TESTONLY database. Never
 * opens a repository WBS, operational ledger, configured identity store or root.
 * SQLite commits fixture WBS bytes + consumed ledger + raw evidence together.
 * This is NOT a remote Git transaction or operational application authority.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { canonicalGovernanceJson } from '../verifyWbsGovernanceEnvelope.ts';
import { HISTORICAL_WBS_SHA256 } from '../verifyForwardWbsEvidence.ts';
import { parseWbsReceiptLedgerV1 } from '../planWbsRegistrationTransaction.ts';
import { syntheticHash, syntheticRequestDigest, snapshotSyntheticRequest, verifySyntheticRegistration, SYNTHETIC_WBS_LIMITS,
  type SyntheticRegistrationState, type SyntheticRegistrationRequest, type TestOnlyAuthoritySource } from './syntheticWbsRegistration.ts';

type FixtureHandle = { root: string; owner: string; dev: string; ino: string; parentDev: string; parentIno: string };
export type SyntheticFaultPoint = 'AFTER_BEGIN' | 'AFTER_STATE' | 'AFTER_RECEIPT' | 'BEFORE_COMMIT' | 'AFTER_COMMIT';
const require = createRequire(import.meta.url);
const Sqlite = require('better-sqlite3');
const HASH = /^[0-9a-f]{64}$/;
const GIT = /^[0-9a-f]{40}$/;
function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const canonical = canonicalGovernanceJson;
const snap = <T>(value: T): T => JSON.parse(canonical(value));
function assertPinnedRoot(h: FixtureHandle) {
  requireThat(h && HASH.test(h.owner) && path.isAbsolute(h.root) && path.dirname(h.root) === fs.realpathSync.native(os.tmpdir()) &&
    /^dmk-wbs-synthetic-[A-Za-z0-9]+$/.test(path.basename(h.root)) &&
    [h.dev, h.ino, h.parentDev, h.parentIno].every(value => typeof value === 'string' && /^\d+$/.test(value)), 'Synthetic fixture root identity/boundary invalid');
  const parent = path.dirname(h.root), p = fs.lstatSync(parent, { bigint: true }), stat = fs.lstatSync(h.root, { bigint: true });
  requireThat(p.isDirectory() && !p.isSymbolicLink() && fs.realpathSync.native(parent) === parent &&
    String(p.dev) === h.parentDev && String(p.ino) === h.parentIno, 'Synthetic fixture parent identity replaced');
  requireThat(stat.isDirectory() && !stat.isSymbolicLink() && fs.realpathSync.native(h.root) === h.root &&
    String(stat.dev) === h.dev && String(stat.ino) === h.ino, 'Synthetic fixture directory identity replaced/linked');
  return stat;
}
function verifyOwnerMarker(root: string, owner: string) {
  const file = path.join(root, '.testonly-owner'), marker = fs.lstatSync(file, { bigint: true });
  requireThat(marker.isFile() && !marker.isSymbolicLink() && marker.nlink === 1n && marker.size === 64n && fs.realpathSync.native(file) === file, 'Synthetic fixture marker invalid/linked');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    requireThat(opened.isFile() && opened.nlink === 1n && opened.size === 64n && opened.dev === marker.dev && opened.ino === marker.ino, 'Synthetic fixture marker identity replaced');
    const bytes = Buffer.alloc(65); let length = 0;
    while (length < bytes.length) { const n = fs.readSync(fd, bytes, length, bytes.length - length, null); if (!n) break; length += n; }
    requireThat(length === 64 && bytes.subarray(0, length).toString('utf8') === owner, 'Synthetic fixture ownership mismatch');
  } finally { fs.closeSync(fd); }
}

export class SyntheticWbsStore {
  private db: any;
  private readonly file: string;
  private constructor(private handle: FixtureHandle, fresh = false, initial?: SyntheticRegistrationState, pin?: string) {
    this.file = path.join(handle.root, 'synthetic-registration.sqlite');
    this.assertOwned();
    if (!fresh) this.assertFile(this.file);
    this.db = new Sqlite(this.file, { timeout: 100, fileMustExist: !fresh });
    try {
      requireThat(require('better-sqlite3/package.json').version === '13.0.3' && this.db.prepare('SELECT sqlite_version() AS v').get().v === '3.53.4', 'Synthetic native dependency mismatch');
      this.db.pragma('trusted_schema = OFF'); this.db.pragma('foreign_keys = ON');
      requireThat(this.db.pragma('journal_mode = WAL', { simple: true }) === 'wal', 'Synthetic WAL unavailable'); this.db.pragma('synchronous = FULL');
      this.db.pragma('busy_timeout = 100'); this.db.pragma('max_page_count = 16384');
      requireThat(this.db.pragma('synchronous', { simple: true }) === 2 && this.db.pragma('foreign_keys', { simple: true }) === 1 &&
        this.db.pragma('trusted_schema', { simple: true }) === 0 && this.db.pragma('busy_timeout', { simple: true }) === 100 &&
        this.db.pragma('max_page_count', { simple: true }) === 16384 && this.db.pragma('page_size', { simple: true }) === 4096, 'Synthetic SQLite configuration rejected');
      if (fresh) {
        requireThat(initial?.revision === 0 && syntheticHash(initial.wbsBytes) === HISTORICAL_WBS_SHA256 &&
          initial.authorityEpoch === 0 && initial.revocationSequence === 0 && initial.clockSequence === 0 && initial.checkpointSequence === 0 &&
          initial.consumedEnvelopeIds.length === 0 && initial.consumedNonces.length === 0 && HASH.test(pin!) &&
          GIT.test(initial.commitSha) && GIT.test(initial.treeSha), 'Only pristine pinned historical synthetic genesis supported');
        requireThat(parseWbsReceiptLedgerV1(initial.ledgerBytes).entries.length === 0, 'Synthetic genesis ledger must be empty');
        this.db.exec(`BEGIN IMMEDIATE;
          CREATE TABLE fixture (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, pin TEXT NOT NULL, genesis BLOB NOT NULL);
          CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, wbs BLOB NOT NULL, ledger BLOB NOT NULL,
            commit_sha TEXT NOT NULL, tree_sha TEXT NOT NULL, authority TEXT NOT NULL);
          CREATE TABLE operations (id TEXT PRIMARY KEY, request_hash TEXT UNIQUE NOT NULL, receipt_id TEXT UNIQUE NOT NULL,
            envelope_id TEXT UNIQUE NOT NULL, nonce TEXT UNIQUE NOT NULL, before_wbs BLOB NOT NULL, after_wbs BLOB NOT NULL, receipt BLOB NOT NULL, envelope BLOB NOT NULL,
            acquisition TEXT NOT NULL, record TEXT NOT NULL, audit_hash TEXT UNIQUE NOT NULL);
          PRAGMA user_version=1;`);
        this.db.prepare('INSERT INTO fixture VALUES(1,?,?,?)').run(handle.owner, pin, initial.wbsBytes);
        this.db.prepare('INSERT INTO state VALUES(1,?,?,?,?,?,?)').run(0, initial.wbsBytes, initial.ledgerBytes,
          initial.commitSha, initial.treeSha, canonical(this.authority(initial)));
        this.db.exec('COMMIT');
        if (process.platform !== 'win32') fs.chmodSync(this.file, 0o600);
      }
      this.snapshot();
    } catch (error) { this.db.close(); this.db = undefined; throw error; }
  }
  static async create(initial: SyntheticRegistrationState, pinnedTestAnchorSha256: string, onFixtureRootPinned?: (root: string) => void) {
    requireThat(['win32', 'linux'].includes(process.platform) && process.arch === 'x64' && process.versions.node.split('.')[0] === '22', 'Synthetic fixture requires Windows/Linux Node22 x64');
    const parent = fs.realpathSync.native(os.tmpdir());
    const parentStat = fs.lstatSync(parent, { bigint: true });
    requireThat(parentStat.isDirectory() && !parentStat.isSymbolicLink(), 'Synthetic fixture parent boundary invalid');
    const root = fs.mkdtempSync(path.join(parent, 'dmk-wbs-synthetic-'));
    const owner = crypto.randomBytes(32).toString('hex');
    // Preserve lexical mkdtemp target and exact identities before any external
    // command, ACL provisioning, marker creation, callback or database open.
    const stat = fs.lstatSync(root, { bigint: true });
    const handle = { root, owner, dev: String(stat.dev), ino: String(stat.ino), parentDev: String(parentStat.dev), parentIno: String(parentStat.ino) };
    assertPinnedRoot(handle); let markerWritten = false;
    try {
      onFixtureRootPinned?.(root); assertPinnedRoot(handle);
      if (process.platform === 'win32') {
        const identity = spawnSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', timeout: 5_000, windowsHide: true });
        const sid = /S-1-\d+(?:-\d+)+/.exec(identity.stdout || '')?.[0];
        requireThat(identity.status === 0 && sid, 'Synthetic fixture SID unavailable'); assertPinnedRoot(handle);
        const acl = spawnSync('icacls.exe', [root, '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F'], { timeout: 5_000, windowsHide: true });
        requireThat(acl.status === 0, 'Synthetic fixture private DACL unavailable');
      } else fs.chmodSync(root, 0o700);
      assertPinnedRoot(handle); fs.writeFileSync(path.join(root, '.testonly-owner'), owner, { flag: 'wx', mode: 0o600 }); markerWritten = true;
      assertPinnedRoot(handle); return new SyntheticWbsStore(handle, true, initial, pinnedTestAnchorSha256);
    }
    catch (error) {
      try {
        assertPinnedRoot(handle);
        if (markerWritten) verifyOwnerMarker(root, owner);
        assertPinnedRoot(handle);
        fs.rmSync(root, { recursive: true });
      } catch { /* A replacement is never adopted or recursively removed. */ }
      throw error;
    }
  }
  /** Test handoff only; contains no real credential or authority. No ambient path. */
  get fixtureHandle(): FixtureHandle { return { ...this.handle }; }
  static open(handle: FixtureHandle) { return new SyntheticWbsStore({ ...handle }); }
  private assertFile(file: string) {
    // existsSync follows links and reports false for dangling targets. Inspect
    // the directory entry itself before SQLite could create through such a link.
    const stat = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
    if (!stat) return;
    requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n && fs.realpathSync.native(file) === file, 'Synthetic fixture file replaced/linked');
  }
  private assertOwned() {
    const h = this.handle;
    const stat = assertPinnedRoot(h);
    if (process.platform !== 'win32') requireThat((stat.mode & 0o077n) === 0n, 'Synthetic fixture permissions broadened');
    verifyOwnerMarker(h.root, h.owner);
    for (const suffix of ['', '-wal', '-shm']) this.assertFile(path.join(h.root, 'synthetic-registration.sqlite' + suffix));
  }
  private authority(state: SyntheticRegistrationState) {
    return { authorityEpoch: state.authorityEpoch, revocationSequence: state.revocationSequence, checkpointSequence: state.checkpointSequence,
      clockSequence: state.clockSequence, consumedEnvelopeIds: state.consumedEnvelopeIds, consumedNonces: state.consumedNonces,
      ...(state.lastNowIso ? { lastNowIso: state.lastNowIso } : {}), ...(state.lastEnvelope ? { lastEnvelope: state.lastEnvelope } : {}) };
  }
  snapshot(): SyntheticRegistrationState {
    this.assertOwned(); requireThat(this.db?.open, 'Synthetic fixture closed');
    requireThat(this.db.pragma('user_version', { simple: true }) === 1 && this.db.pragma('quick_check', { simple: true }) === 'ok', 'Synthetic schema/integrity rejected');
    const fixture = this.db.prepare('SELECT * FROM fixture WHERE id=1').get();
    requireThat(fixture?.owner === this.handle.owner && HASH.test(fixture.pin) && syntheticHash(fixture.genesis) === HISTORICAL_WBS_SHA256, 'Synthetic genesis or anchor corrupted');
    const row = this.db.prepare('SELECT * FROM state WHERE id=1').get(); requireThat(row, 'Synthetic state missing');
    const authority = JSON.parse(row.authority);
    requireThat(canonical(authority) === row.authority, 'Synthetic authority noncanonical');
    const state = { revision: row.revision, wbsBytes: Buffer.from(row.wbs), ledgerBytes: Buffer.from(row.ledger), commitSha: row.commit_sha,
      treeSha: row.tree_sha, ...authority } as SyntheticRegistrationState;
    const ledger = parseWbsReceiptLedgerV1(state.ledgerBytes);
    const ops = this.db.prepare('SELECT * FROM operations ORDER BY rowid').all();
    requireThat(ops.length <= SYNTHETIC_WBS_LIMITS.applications && ops.length === ledger.entries.length && state.revision === ops.length &&
      authority.consumedEnvelopeIds.length === ops.length && authority.consumedNonces.length === ops.length, 'Synthetic consumed state/ledger mismatch');
    let prior = '0'.repeat(64), previousWbs = Buffer.from(fixture.genesis);
    ops.forEach((op: any, i: number) => {
      const record = JSON.parse(op.record);
      requireThat(canonical(record) === op.record && record.previousAuditSha256 === prior && syntheticHash(op.record) === op.audit_hash &&
        record.receiptRawSha256 === syntheticHash(op.receipt) && record.envelopeRawSha256 === syntheticHash(op.envelope) &&
        record.acquisitionSha256 === syntheticHash(op.acquisition) && record.receiptId === op.receipt_id &&
        op.receipt_id === ledger.entries[i].receiptId && op.envelope_id === authority.consumedEnvelopeIds[i] && op.nonce === authority.consumedNonces[i] &&
        Buffer.from(op.before_wbs).equals(previousWbs) && syntheticHash(op.before_wbs) === ledger.entries[i].preWbsSha256 &&
        syntheticHash(op.after_wbs) === ledger.entries[i].postWbsSha256 && record.wbsSha256 === syntheticHash(op.after_wbs), 'Synthetic audit/raw evidence integrity rejected');
      prior = op.audit_hash;
      previousWbs = Buffer.from(op.after_wbs);
    });
    if (ops.length) {
      const final = JSON.parse(ops.at(-1).record);
      requireThat(final.wbsSha256 === syntheticHash(state.wbsBytes) && final.ledgerSha256 === syntheticHash(state.ledgerBytes) &&
        final.commitSha === state.commitSha && final.treeSha === state.treeSha && final.authoritySha256 === syntheticHash(row.authority), 'Synthetic terminal state/audit mismatch');
    } else requireThat(syntheticHash(state.wbsBytes) === HISTORICAL_WBS_SHA256, 'Synthetic historical bytes altered');
    return state;
  }
  evidence() {
    this.snapshot();
    return this.db.prepare('SELECT before_wbs,after_wbs,receipt,envelope,record,acquisition FROM operations ORDER BY rowid').all().map((r: any) => ({
      beforeBytes: Buffer.from(r.before_wbs), afterBytes: Buffer.from(r.after_wbs), receiptBytes: Buffer.from(r.receipt), envelopeBytes: Buffer.from(r.envelope), record: JSON.parse(r.record), acquisition: JSON.parse(r.acquisition) }));
  }
  provenance() {
    this.snapshot();
    const packageRoot = path.dirname(require.resolve('better-sqlite3/package.json'));
    const loaded = Object.keys(require.cache).filter(file => file.startsWith(packageRoot + path.sep) && file.endsWith('.node'));
    requireThat(loaded.length === 1, 'Synthetic native provenance unavailable');
    return { packageVersion: require('better-sqlite3/package.json').version, sqliteVersion: this.db.prepare('SELECT sqlite_version() AS v').get().v,
      nativeSha256: syntheticHash(fs.readFileSync(loaded[0])), node: process.versions.node, platform: process.platform, arch: process.arch,
      journalMode: this.db.pragma('journal_mode', { simple: true }), synchronous: this.db.pragma('synchronous', { simple: true }),
      busyTimeoutMs: this.db.pragma('busy_timeout', { simple: true }), maxPageCount: this.db.pragma('max_page_count', { simple: true }), pageSize: this.db.pragma('page_size', { simple: true }) };
  }
  commit(request: SyntheticRegistrationRequest, source: TestOnlyAuthoritySource, injectFault?: (point: SyntheticFaultPoint) => void) {
    this.assertOwned(); requireThat(this.db?.open, 'Synthetic fixture closed');
    request = snapshotSyntheticRequest(request);
    const digest = syntheticRequestDigest(request);
    const fixture = this.db.prepare('SELECT pin FROM fixture WHERE id=1').get();
    requireThat(source?.kind === 'TESTONLY_PUBLIC_ROOTS' && source.pinnedAnchorSha256 === fixture.pin, 'Synthetic fixture anchor cannot rotate or self-select');
    this.db.exec('BEGIN IMMEDIATE'); let committed = false;
    try {
      injectFault?.('AFTER_BEGIN');
      const state = this.snapshot();
      const prior = this.db.prepare('SELECT * FROM operations WHERE id=?').get(request.operationId);
      if (prior) {
        requireThat(prior.request_hash === digest, 'Idempotency key reused with different request');
        this.db.exec('COMMIT'); committed = true;
        return { status: 'IDEMPOTENT_RECORDED', mayApply: false as const, operationalAuthority: false as const, record: JSON.parse(prior.record) };
      }
      const result = verifySyntheticRegistration(request, source, state);
      requireThat(result.valid && result.acquisition && result.proposedLedgerBytes, result.errors.join('; ') || 'Synthetic proof rejected');
      const a = result.acquisition, p = a.provenance, payload = JSON.parse(a.envelopeBytes.toString()).payload;
      const receipt = JSON.parse(request.receiptBytes.toString());
      const next = { ...state, revision: state.revision + 1, wbsBytes: request.afterBytes, ledgerBytes: result.proposedLedgerBytes,
        commitSha: p.applied.commitSha, treeSha: p.applied.treeSha, authorityEpoch: p.authorityEpoch, revocationSequence: p.revocationSequence,
        clockSequence: p.clockSequence, checkpointSequence: p.checkpointSequence, lastNowIso: p.nowIso,
        lastEnvelope: { envelopeSha256: syntheticHash(a.envelopeBytes), authorityEpoch: payload.authorityEpoch, policySha256: payload.policySha256,
          policyVersion: payload.policyVersion, revocationSequence: payload.revocationSequence, rootId: payload.rootId, rootVersion: payload.rootVersion },
        consumedEnvelopeIds: [...state.consumedEnvelopeIds, payload.envelopeId], consumedNonces: [...state.consumedNonces, a.context.sessionNonce] };
      const authority = canonical(this.authority(next));
      const changed = this.db.prepare('UPDATE state SET revision=?,wbs=?,ledger=?,commit_sha=?,tree_sha=?,authority=? WHERE id=1 AND revision=? AND wbs=? AND ledger=? AND commit_sha=? AND tree_sha=?')
        .run(next.revision, next.wbsBytes, next.ledgerBytes, next.commitSha, next.treeSha, authority,
          state.revision, state.wbsBytes, state.ledgerBytes, state.commitSha, state.treeSha);
      requireThat(changed.changes === 1, 'Protected synthetic compare-and-swap failed'); injectFault?.('AFTER_STATE');
      const acquisition = canonical({ ...a, envelopeBytes: a.envelopeBytes.toString('base64') });
      const previous = this.db.prepare('SELECT audit_hash FROM operations ORDER BY rowid DESC LIMIT 1').get()?.audit_hash || '0'.repeat(64);
      const record = { schemaVersion: 'TESTONLY_APPLIED/1', operationId: request.operationId, receiptId: receipt.intent.receiptId,
        revision: next.revision, requestSha256: digest, previousAuditSha256: previous, receiptRawSha256: syntheticHash(request.receiptBytes),
        envelopeRawSha256: syntheticHash(a.envelopeBytes), acquisitionSha256: syntheticHash(acquisition), authoritySha256: syntheticHash(authority),
        wbsSha256: syntheticHash(next.wbsBytes), ledgerSha256: syntheticHash(next.ledgerBytes), commitSha: next.commitSha, treeSha: next.treeSha };
      const recordText = canonical(record);
      this.db.prepare('INSERT INTO operations(id,request_hash,receipt_id,envelope_id,nonce,before_wbs,after_wbs,receipt,envelope,acquisition,record,audit_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(request.operationId, digest, receipt.intent.receiptId, payload.envelopeId, a.context.sessionNonce, request.beforeBytes, request.afterBytes,
          request.receiptBytes, a.envelopeBytes, acquisition, recordText, syntheticHash(recordText));
      injectFault?.('AFTER_RECEIPT'); this.assertOwned(); this.snapshot(); injectFault?.('BEFORE_COMMIT');
      // Fresh signed acquisition under the same local write transaction. A real
      // distributed policy/Git fence is deliberately outside this TESTONLY engine.
      const finalCheck = verifySyntheticRegistration(request, source, state);
      requireThat(finalCheck.valid && finalCheck.acquisition && canonical({ ...finalCheck.acquisition, envelopeBytes: finalCheck.acquisition.envelopeBytes.toString('base64') }) === acquisition,
        'Final authority rejected or changed before synthetic commit: ' + finalCheck.errors.join('; '));
      this.db.exec('COMMIT'); committed = true; injectFault?.('AFTER_COMMIT');
      this.db.pragma('wal_checkpoint(PASSIVE)');
      return { status: 'SYNTHETIC_COMMITTED', mayApply: false as const, operationalAuthority: false as const, record: snap(record) };
    } catch (error) { if (!committed && this.db.inTransaction) this.db.exec('ROLLBACK'); throw error; }
  }
  close() { if (this.db?.open) this.db.close(); this.db = undefined; }
  restart() { this.close(); const reopened = SyntheticWbsStore.open(this.handle); this.db = reopened.db; reopened.db = undefined; }
  destroy() {
    this.close(); this.assertOwned();
    // Resolved generated target checked above, within the exact current temp parent.
    fs.rmSync(this.handle.root, { recursive: true });
  }
}
