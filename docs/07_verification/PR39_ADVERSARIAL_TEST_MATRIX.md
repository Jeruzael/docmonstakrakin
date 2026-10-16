# PR #39 Adversarial Test Matrix & Verification Evidence

**Repository:** `Jeruzael/docmonstakrakin`  
**Target Pull Request:** PR #39 (`fix/pr38-postmerge-preflight-canonicalization-20261016`)  
**Evaluated HEAD Commit:** `e6108cbfda34e3262cdc5aa72868f79c507a1551` (previously `9a7b52fac6d0df4c9e5536c07cfd831641ff7ec7`)  
**Master Baseline:** `dfa1e170c5aae6e12824e7d75fcab53baa38fe17` (ordinary two-parent merge commit)  
**Assessment Date:** 2026-10-17  
**Execution Environment:** Isolated Detached Worktree (`docmonstakrakin-pr39-review`)  

---

## 1. Automated Verification Summary

| Verification Layer | Target / Scope | Total Suites | Passed | Failed | Skipped | Exit Code | Result |
|---|---|---|---|---|---|---|---|
| **GitHub Actions CI** (Run 38910028915 on `9a7b52f`) | Quality & Build | 1 | 1 | 0 | 0 | 0 | **PASS** |
| **GitHub Actions CI** (Run 38910028915 on `9a7b52f`) | Controlled Docs | 1 | 1 | 0 | 0 | 0 | **PASS** |
| **GitHub Actions CI** (Run 38910028915 on `9a7b52f`) | Complete Regression | 62 | 62 (1,440 assertions) | 0 | 0 | 0 | **PASS** |
| **GitHub Actions CI** (Run 38955672647 on `e6108cb`) | Quality & Build | 1 | 1 | 0 | 0 | 0 | **PASS** |
| **GitHub Actions CI** (Run 38955672647 on `e6108cb`) | Controlled Docs | 1 | 1 | 0 | 0 | 0 | **PASS** |
| **GitHub Actions CI** (Run 38955672647 on `e6108cb`) | Complete Regression | 62 | 62 (1,440 assertions) | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | `npm run ci:quality` | 1 | 1 | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | `npm run ci:controlled-docs` | 1 | 1 | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | `npm run ci:regression` | 62 | 62 (1,440 assertions) | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | `testPlanWbsRegistrationTransaction` | 1 | 25 assertions | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | `testTrustedWbsRegistrationV2` | 1 | 22 assertions | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | `testStageB2aAdversarial` | 1 | 18 assertions | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | `testGate3Adversarial` | 1 | 27 assertions + 4 empirical | 0 | 0 | 0 | **PASS** |
| **Local Review Worktree** | Historical Verifiers (196, 197, 208) | 4 | 4 suites | 0 | 0 | 0 | **PASS** |
| **External Adversarial Suite** (`pr39_adversarial.ts`) | Sections A, B, C, D | 37 scenarios | 37 (27 Defenses, 5 Findings, 5 Limits) | 0 | 0 | 0 | **PASS** |

---

## 2. Full Adversarial Test Matrix (37 Scenarios)

```json
{"DEFENSE PASS": 27, "FINDING": 5, "LIMITATION CONFIRMED": 5, "UNEXPECTED": 0}
```

| ID | Category | Scenario Description | Expected Outcome | Observed Result & Evidence | Status | Classification |
|---|---|---|---|---|---|---|
| **A01** | Hashing | Baseline synthetic receipt against genesis | Valid preview, `mayApply: false` | `proposedLedgerSha256: 423f1a0f...` | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A02** | Hashing | TOCTOU getter flipping `receiptId` from string to number | Reject fail-closed | Caught during re-validation (`"Signed receipt schema or canonical serialization invalid: Signed receipt intent has invalid field values"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A03** | Hashing | TOCTOU getter flipping `signatureBase64` to alternate bytes | Reject fail-closed | Caught during canonical 64-byte re-encoding check (`"Signature base64 is not canonical 64-byte encoding"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A04** | Hashing | Array hole + named property in `signatures` | First-pass length check bypassed; caught downstream | Bypasses `keys.length === length`; caught by downstream canonical re-validation (`"Signed receipt signatures must be a non-empty array"`) | **FINDING** | `ACCEPTABLE_BOUNDED_RISK` |
| **A05** | Hashing | Array hole + named property in `approvedItems` | First-pass length check bypassed; caught downstream | Bypasses length check; caught by downstream canonical re-validation (`"Signed receipt approvedItems must be a non-empty array"`) | **FINDING** | `ACCEPTABLE_BOUNDED_RISK` |
| **A06** | Hashing | Hostile Proxy with throwing `ownKeys` trap | Contained in preflight; no uncaught exception | Caught fail-closed (`"Signed receipt schema or canonical serialization invalid: hostile ownKeys"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A07** | Hashing | Deeply nested (20,000) object inside `approvedItems` | V8 call stack contained; structured reject | Contained (`"Signed receipt schema or canonical serialization invalid: Maximum call stack size exceeded"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A08** | Hashing | Symbol-keyed property on `intent` | Reject unexpected keys | Caught fail-closed (`"Signed receipt intent contains missing or unexpected properties"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A09** | Hashing | Null-prototype receipt object | Hashed identically to plain object | Byte-identical digest: `283e0f9932001b41c7a8e9d446847194bd1d3b3317a102a36db6c4d53fb958a9` | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A10** | Hashing | Non-enumerable extra property on `intent` | Omitted by `Object.keys` | Ignored during normalization; dropped from canonical payload | **FINDING** | `ACCEPTABLE_BOUNDED_RISK` |
| **A11** | Hashing | Numeric `-0` vs `+0` canonicalization; Unicode NFC vs NFD | Deterministic behavior | `-0 === +0` normalized identically; NFC/NFD produce distinct UTF-8 bytes | **FINDING** | `ACCEPTABLE_BOUNDED_RISK` |
| **A12** | Hashing | Duplicate signature entry (same principal/role twice) | Quorum verification fails | Rejected (`"Human principal or approver role reused; Missing authentic signature for required role"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A13** | Hashing | Duplicate keys in receipt JSON text | Pre-parsed object sees last-wins | Standard JavaScript `JSON.parse` behavior; shadow values overwritten before preflight | **LIMITATION CONFIRMED** | `DEFERRED_PRODUCTION_BLOCKER` |
| **A14** | Hashing | BigInt inside caller policy object | Reject fail-closed | Rejected (`"Policy contains invalid JSON evidence"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A15** | Hashing | Custom class instance with non-plain prototype | Reject non-plain object | Rejected (`"Signed receipt must be a plain object with exact keys [intent, signatures]"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **A16** | Hashing | Subclass of `Array` for `signatures` | Reject non-standard array | Rejected (`"Signed receipt signatures must be a non-empty array"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **B01** | Ledger | Pretty-printed (2-space) ledger with duplicate key | Reject non-canonical ledger | Rejected by byte-exact reserialization (`"Receipt ledger must match exact canonical serialization"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **B02** | Ledger | UTF-8 BOM or CRLF line breaks in ledger | Reject non-canonical bytes | Rejected by JSON parse or byte comparison (`"Receipt ledger must match exact canonical serialization"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **B03** | Ledger | `__proto__` property in ledger JSON | Reject prototype pollution | Rejected (`"Receipt ledger header contains unexpected or missing properties"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **B04** | Ledger | Non-historical genesis SHA-256 in ledger header | Reject invalid genesis | Rejected (`"Receipt ledger header or historical genesis digest is invalid"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **B05** | Ledger | Type confusion (fractional PR number, uppercase hex) | Reject invalid entry types | Rejected (`"Receipt ledger chain contains invalid, duplicate or disconnected entry"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **B06** | Ledger | Oversized ledger (>2 MiB) | Reject before parsing | Rejected (`"Receipt ledger exceeds supported preflight limit"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **B07** | Ledger | Forged historical entry in ledger (valid chain hashes) | Structural check passes; signature not checked | Previews `valid: true`; confirms Stage B2b1 structural-only ledger validation | **LIMITATION CONFIRMED** | `DEFERRED_PRODUCTION_BLOCKER` |
| **B08** | Ledger | Cyclic WBS state transition (`G -> X -> G`) | Structural chain continuity accepts cycle | Chain hashes continuous; preflight accepts cycle; blocked downstream by additive validator | **FINDING** | `DEFERRED_PRODUCTION_BLOCKER` |
| **B09** | Ledger | Stale snapshot replay (consumed receipt with old ledger) | Previews valid if caller supplies matching old state | Preflight freshness relies on caller's `expectedCurrent*` inputs | **LIMITATION CONFIRMED** | `DEFERRED_PRODUCTION_BLOCKER` |
| **C01** | Multi-Reg | Sequential registrations (`G -> W1 -> W2`) | Valid sequential chaining | Step 2 proposed ledger correctly contains chained entries (`5b994593...`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **C02** | Multi-Reg | Out-of-order registration (`R2` executed against Genesis) | Reject byte mismatch | Rejected (`"Before or after WBS bytes differ from signed intent; WBS digest does not match..."`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **C03** | Multi-Reg | Reversed ledger entry order | Reject chain disconnect | Rejected (`"Receipt ledger chain contains invalid, duplicate or disconnected entry"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **C04** | Multi-Reg | Consumed snapshot with unknown receipt ID | Reject snapshot conflict | Rejected (`"Trusted receipt-consumption snapshot conflicts with canonical ledger"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **C05** | Multi-Reg | Step-2 registration with altered `afterBytes` | Reject digest mismatch | Rejected (`"Before or after WBS bytes differ from signed intent; WBS digest does not match..."`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **C06** | Multi-Reg | Re-presenting `R1` after Step 2 | Reject already consumed | Rejected (`"Registration receipt was already consumed"`) | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **C07** | Multi-Reg | Two concurrent valid receipts against same base WBS | Both preview valid independently; conflicting ledgers | Demonstrates preflight is advisory; concurrency requires Git/CAS merge locking | **LIMITATION CONFIRMED** | `DEFERRED_PRODUCTION_BLOCKER` |
| **C08** | Multi-Reg | Input mutability and purity check | Preflight does not mutate input objects | All input buffers and objects unchanged after execution | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **D01** | Boundaries | Self-attested `trustedContext` with attacker keys/policy | Valid preview, `mayApply: false` | Preflight verifies logic against context; does not grant authority | **LIMITATION CONFIRMED** | `DEFERRED_PRODUCTION_BLOCKER` |
| **D02** | Boundaries | Static code scan for I/O and write APIs | Zero write/network APIs | `node:fs`, `node:child_process`, `fetch` absent; `mayApply: true` absent | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **D03** | Boundaries | Invariant check across all executions | `mayApply` strictly `false` | All 41 results evaluated with `mayApply === false` | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |
| **D04** | Boundaries | Protected file hash verification before/after harness | Zero file modifications | 111 protected files and `.local/project-state.json` byte-identical | **DEFENSE PASS** | `FIXED_AND_VERIFIED` |

---

## 3. Reproduction Command & Execution Instructions

To execute the independent adversarial test suite in any fresh worktree:

```bash
# From repository root:
npx tsx docs/07_verification/pr39_adversarial.ts
```

The test runner executes all 37 scenarios and outputs JSON tally:
```json
{"DEFENSE PASS": 27, "FINDING": 5, "LIMITATION CONFIRMED": 5, "unexpected": 0}
```
Exits with returncode `0`.
