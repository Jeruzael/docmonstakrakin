import {createHash} from 'node:crypto';

const forbidden = /password|verifier|token|secret|digest/i;
/** Strict JSON subset; reject ambiguity rather than silently changing evidence. */
export function canonicalAuditPayload(value) {
  let nodes = 0;
  function encode(item, depth) {
    if (++nodes > 1024 || depth > 8) throw Error('AUDIT_INPUT_INVALID');
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item) || Object.is(item, -0)) throw Error('AUDIT_INPUT_INVALID');
      return String(item);
    }
    if (typeof item === 'string') {
      if (item.length > 1024) throw Error('AUDIT_INPUT_INVALID');
      return JSON.stringify(item);
    }
    if (Array.isArray(item)) {
      if (item.length > 128 || Object.keys(item).length !== item.length) throw Error('AUDIT_INPUT_INVALID');
      return '[' + item.map(child => encode(child, depth + 1)).join(',') + ']';
    }
    if (!item || Object.getPrototypeOf(item) !== Object.prototype) throw Error('AUDIT_INPUT_INVALID');
    const keys = Object.keys(item).sort();
    if (keys.length > 32 || keys.some(key => forbidden.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))) throw Error('AUDIT_INPUT_INVALID');
    return '{' + keys.map(key => JSON.stringify(key) + ':' + encode(item[key], depth + 1)).join(',') + '}';
  }
  return encode(value, 0);
}
export function auditHash(value) { return createHash('sha256').update(canonicalAuditPayload(value)).digest('hex'); }
export function verifyAuditChain(entries, expectedHead) {
  try {
    if (!Array.isArray(entries) || entries.length > 4096) return false;
    let previousHash = '0'.repeat(64), sequence = 1;
    for (const event of entries) {
      if (!event || Object.keys(event).sort().join(',') !== 'action,actor,hash,previousHash,reason,sequence,target,timestamp') return false;
      const {hash, ...payload} = event;
      if (payload.sequence !== sequence++ || payload.previousHash !== previousHash || !/^[a-f0-9]{64}$/.test(hash) || hash !== auditHash(payload)) return false;
      previousHash = hash;
    }
    return expectedHead === undefined || expectedHead === previousHash;
  } catch { return false; }
}
