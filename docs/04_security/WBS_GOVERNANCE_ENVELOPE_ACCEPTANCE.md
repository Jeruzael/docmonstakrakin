# Offline envelope acceptance and security assumptions

Baseline: `5ecf92d1d7bb1a1bb622fd010265eb989113b3a5`. Contract: [candidate 1.0](../06_planning/WBS_GOVERNANCE_ENVELOPE_CONTRACT.md). Scope is a synthetic offline verifier, not a security attestation for operational trust or registration.

## E01–E12 and additional evidence

| ID | Implemented test cases | Required result |
| --- | --- | --- |
| E01 | Ordinary two-role and elevated three-role policy; independent canonical Unicode/message vectors; unchanged v2 signing bytes/digest; next-epoch positive | Offline consistency valid; `mayApply:false`, `operationalAuthority:false` |
| E02 | Missing context, extra self-pin, mismatched external root | Reject; no source fallback or bootstrap |
| E03 | Duplicate decoded keys; BOM/invalid UTF-8; malformed/trailing/incomplete JSON; bad escapes/primitives; noncanonical whitespace; schema/field/ID/digest/Git/time errors; 2-MiB and depth 63/64/65 boundaries | Reject ambiguity before cryptographic acceptance; inclusive admission bounds do not make malformed documents valid |
| E04 | Missing/duplicate/altered governance signatures; malformed Base64; duplicate people/keys/principals; unused-person mapping attack; purpose reuse; conflict/custody failure; Project Lead substitution; elevated downgrade or omitted IHA | Reject without reducing core quorum |
| E05 | Epoch/revocation/checkpoint rollback, missing/rogue witness, governance/witness overlap, clock/witness key reuse, disconnected chain, new-root-only rotation | Reject; no permissive rotation or recovery |
| E06 | Valid next policy epoch; reused version/digest, hidden policy alteration or skipped epoch | Exact predecessor plus fresh policy/version; otherwise reject |
| E07 | Repository/owner/project/operation/classifier/registry/source/ratification substitutions | Reject exact expected binding mismatch |
| E08 | Unsigned clock tampering, outside observation, sequence rollback, uncertainty crossing validity, excessive uncertainty, stale checkpoint/input binding | Reject; signed fixture observations are not real trusted-clock acquisition |
| E09 | Revoked governance/registration key; expired key; missing eligibility | Reject; no toggling historical flags to obtain a pass |
| E10 | Digest-only or registration-domain signature used for governance message | Reject cross-purpose signing |
| E11 | Consumed envelope/nonce, cycles, accessors, oversized metadata, non-mutation and deterministic repeat against unchanged context | Reject attacks; do not consume state; do not invoke serialization hooks |
| E12 | Missing authority/malformed input, production context label, recovery label replacing required role | Reject; every outcome remains non-authorizing |

The test program prints one named PASS/FAIL per observed compound check; those counts are not the number of individual Node assertions. Real ephemeral Ed25519 keys are generated only in the test process and never retained, printed, enrolled or used as operational anchors. Dates and numeric repository IDs in fixtures are deliberately synthetic/fixed.

## Explicit trust assumptions and exclusions

- Caller-supplied fixed time, public anchors, person/custody/conflict assertions, expected record digests and replay floors are synthetic inputs. A self-consistent fabricated context can pass offline checks and **still cannot authorize anything**.
- Person IDs and separate SPKI fingerprints cannot prove physical independence, sole custody, actual acceptance or appointment. Out-of-band human identity verification remains absent.
- The envelope binds expected registry/classifier/revocation references but does not fetch/reconstruct the external registry, classify real operations or authenticate actual historical compromise adjudication.
- No live trusted clock, witness/registry availability, anti-rollback store, OIDC/Git provider, human signing client or root bootstrap is supplied. Signed clock/checkpoint tests use separately pinned synthetic keys and nonce/input binding only.
- No application receipt or actual applied Git identity is authenticated; no current tree/ancestry is resolved. Signed intent is not evidence of application. Existing conservative descendant rejection is unchanged.
- Repeated calls do not persist consumption. Operational replay prevention and crash-safe receipt transactions require another independently reviewed engine and explicit activation.
- Input objects must be inert. Descriptor admission rejects common traps without invoking accessors; it is not an arbitrary JavaScript/proxy sandbox or a bound on upstream allocations.
- Positive policy verification does not extend the existing two-role continuity gate to elevated registration. Runtime DMK-197 and historical receipts retain their original contracts.

## Narrowing and implementation choices requiring reviewer acceptance

Schema 1.0 selects per-profile envelopes with explicit classifier digest and profile ID; direct domain+LF+JSON signatures; positive consecutive policy epochs; no root rotation; one active registration key per required role; fixed three-role governance anchors; independent witness; purpose-separated keys; exact byte/depth/time-window limits. These make the R14 proposal concrete for an offline candidate. They are not operational policy ratification, arbitrary risk/quorum configuration, overlapping key rotation or a general-purpose trust protocol.

Raw canonical JSON has no trailing LF. Unsupported root rotation/recovery and arbitrary quorum shapes fail closed. Diagnostic digest metadata is absent on any rejection. These compatibility choices, additional context/binding byte caps and candidate freshness values must remain visible in independent review.

## Verification and rollback gates

Public-only key fields reject private PEM material. The negative fixture uses an ephemeral synthetic key in memory only; this test does not collect, persist or enroll a private key.

Run the focused test program, Node V8 source-specific coverage, existing WBS integrity, TypeScript, production build, complete regression and controlled-document checks in disposable fixtures. Keep genuine failures/root causes; do not change old assertions. Required CI is Quality & Build, Controlled Docs and Complete Regression for the exact signed candidate HEAD.

Independent agent review is advisory, not human approval. A GitHub review request is separate from a submitted exact-HEAD human approval; a draft PR is not authority to merge. An approved candidate still needs a separate operator merge decision and does not activate production policy.

Before operational integration rollback is code-only. After any future real epoch/application, freeze new use, preserve all ledgers/receipts/high-water marks, independently reconcile uncertain outcomes and obtain incident authorization. Never lower quorum, delete consumed IDs, accept stale roots or restore historical WBS to manufacture green checks.

All current boundaries remain: canonical WBS and historical receipts intact; PR34/52 separate; no signer enrollment, trust installation, privileged route/live-agent activation, S2-A, Gate7 or release promotion.
