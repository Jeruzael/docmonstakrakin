# Independent agent review | Six security-contract resolutions

**Status:** DESIGN CORRECTIONS PROPOSED / NO IMPLEMENTATION OR GOVERNANCE RATIFICATION  
**Edition:** v0.3, 2026-10-19 (three targeted follow-up ambiguities clarified)  
**Reviewed input:** Agent's six findings on v0.1 consolidated brief (authentication, background execution, provider boundary, derived data, run lifecycle, solo signing/names). These findings are treated as review input, not as independently demonstrated runtime vulnerabilities.

## Findings and dispositions

| Finding | Severity reported | Design change / evidence location | Actual implementation status |
| --- | --- | --- | --- |
| F01 Local auth and delegation dependency absent | HIGH | `01` §8.1, `03` AUTH-01..04, EPIC-CA, `02` §6.1, mockup S15 | **BLOCKED**: current specialized reviewer authentication is not sufficient; related DMK-209–214 PR #34 remains unmerged |
| F02 Background workers lack transaction/recovery contract | HIGH | `01` §9.1/§9.1.1, `03` DUR-01..05, US-15/US-21, mockup S18 | **DESIGN CLARIFIED / NOT IMPLEMENTED**: scoped token uniqueness with separate digest, `409` mismatch and crash-safe worker store still require tests |
| F03 On-device/network and cloud consent not specified | HIGH | `01` §11.2, `03` PROV-01..03/OFF-02..03/US-16..17, mockup S16 | **NOT VERIFIED**: no actual app+runtime network-denied test or runtime confinement evidence |
| F04 Derived-output restrictions not inherited | HIGH | `01` §11.1, `03` DATA-01..04/US-18/US-22, `02` §6.1/6.2, mockup S17 | **DESIGN CLARIFIED / NOT IMPLEMENTED**: intersect all source ACLs, discover/read separation, suppress hidden existence |
| F05 Pause/cancel/unknown outcome contract incomplete | MEDIUM | `01` §9.2 and §9.1 recovery, `03` RUN-01..03/US-19/US-23, mockup S18 | **DESIGN CLARIFIED / NOT IMPLEMENTED**: separate local worker, remote provider and billing; verified termination required for `CANCELLED` |
| F06 Solo signing and identifier vocabulary ambiguous | MEDIUM | `01` §4.1/§8; `03` GOV-05/GOV-06/US-20; `02` human labels + UX-FLOW-IDs; `04` S07 | **NOT RATIFIED**: owner session acknowledgment and WBS cryptographic signoff separated; no real signer ceremony |

## v0.3 follow-up disposition and precise contract changes

The independent reviewer rechecked v0.2 and found **three residual ambiguities** (F02, F04, F05) plus four unmatched Markdown bold markers in the architecture rollout. This edition specifies the missing contracts; it **does not** claim implementation, runtime verification, policy ratification or independent security approval.

| Follow-up | Normative v0.3 contract | Minimum negative evidence still NOT RUN |
| --- | --- | --- |
| F02-R1: Idempotency key reused with different payload | Unique `(projectId, serverResolvedActorId, operationName, normalizedToken)` key; independently stored immutable canonical request digest; same digest returns same job, changed digest returns **409**, no additional local/provider effects; explicit retry gets new authority/token | `DUR-N04`: parallel same-key requests, edited body, collision/crash, zero second budget/outbox/provider invocation |
| F04-R1: Source ACL inheritance and existence secrecy | Derive audience as **intersection of every contributing source's ACL**, highest classification, current project/channel permissions and denies; separate source-level `READ` versus `DISCOVER`; hidden existence means **zero notification/pointer/badge** | `DATA-N03`: two same-class sources with disjoint ACLs, uncited paraphrase, per-source revocation and undiscoverable source |
| F05-R1: Local stop vs remote cancellation | Durable independent `localWorkerState`, `providerExecutionState` and `costState`; local `STOPPED` plus remote `MAY_BE_RUNNING` means **RESULT_UNCERTAIN**, never `CANCELLED`; quarantined late output and uncertain cost | `RUN-N02`/`RUN-N03`: kill local worker while provider runs and cancel API acknowledges without termination evidence |
| Editorial: malformed bold rollout list | Corrected entries 4–7 in `01` §12 | Markdown marker/balanced-fence check, not an application test |

## Release decision boundaries

- **P0-CONFIGURATION permitted as a proposal:** governance profile settings, locked policy-floor UX, draft agents, simulated-data labels, no-model/manual fallback, and a read-only proof-of-concept UI. No operational cryptographic approval is asserted.
- **P0-LIVE gated:** authenticated human sessions, project membership, agent scope/revocation and per-API authorization; shared HTTP/worker transactional persistence, classification/recipient controls, provider egress and consent enforcement, and negative/restart tests. Do not activate chat or run endpoints simply because front-end mockups exist.
- **Stage B2b2 protected WBS registration remains separate:** ADR-0007 is design, not ratification; PR #34 remains unmerged; no human roster enrollment, policy pin, runtime reconciliation, Gate 7 or release is authorized.

## Minimum adversarial acceptance matrix to implement before P0-LIVE

| Test | Setup / attack | Expected observable result |
| --- | --- | --- |
| AUTH-N01 | Anonymous/forged sender calls message/agent run routes, including loopback | Denied, audited; no state or provider call |
| AUTH-N02 | Authenticated human from another project or revoked delegation sends/reads | Denied, no unauthorized event or caption |
| AUTH-N03 | Agent supplies `kind:HUMAN` or spoofs `authorId` to satisfy required approval | Denied; actor kind server-resolved |
| DUR-N01 | Crash between atomic enqueue and provider call | One durable job, reservation, outbox and audit; no phantom execution |
| DUR-N02 | Crash after external provider accepts but before durable acknowledgment | `RESULT_UNCERTAIN`, preserved reservation; no blind retry or refund |
| DUR-N03 | Duplicate worker lease/replay, cancel race, crash after publish | One local result/mention/audit; late response quarantined and attempts attributable |
| DUR-N04 | Same `(project, actor, operation, token)` reused concurrently with same and different canonical request digests | Identical digest returns original job; changed digest `409`, **zero** second job, budget reservation, outbox or provider request |
| PROV-N01 | Localhost runtime proxies externally/redirects/DNS rebinding | No `ON_DEVICE_VERIFIED`; strict local-only blocks; app+runtime outbound deny works |
| PROV-N02 | Queued cloud context/endpoint/tenant/model/label changes after consent | Old consent invalid; no request until renewed |
| DATA-N01 | Agent paraphrases restricted source without a citation to `@everyone` | Output retains full source lineage and ACL intersection; metadata only if existence access to all sources is explicitly allowed |
| DATA-N02 | Restricted source appears in notification, caption, search, export or cache | Same source-class plus every-source ACL rules; no read/existence leak |
| DATA-N03 | Two same-class restricted documents have different readers; one forbids existence discovery, and access is later revoked | Derived output only readable by intersection; discover-denied user sees **no link/badge/notification/count/caption**; caches invalidate on revoke |
| RUN-N01 | Pause or cancel requested while provider ignores request | UI remains request/uncertain, no false paused/cancelled/billing claim |
| RUN-N02 | Kill local worker after provider accepts and continues processing; provider later returns output | Local `STOPPED`, remote `MAY_BE_RUNNING`, `RESULT_UNCERTAIN`, cost `UNCERTAIN`, late output quarantined |
| RUN-N03 | Provider acknowledges cancel request but gives no verified termination, or supports no cancel | Local cancellation cannot produce `CANCELLED`/refunded verdict; provider/cost uncertainty persists until authenticated evidence |
| GOV-N01 | Solo owner clicks approve with only local authenticated session | `LOCAL_SESSION_ACKNOWLEDGED`, never `OWNER_CRYPTO_SIGNATURE_VERIFIED`; high-assurance floor still blocked |

**Technical review result for this revision:** `NINE_FINDING_CONTRACTS_SPECIFIED / RUNTIME_TESTS_NOT_RUN / HUMAN_DESIGN_REVIEW_PENDING`. These are review/test candidate IDs, not canonical WBS assignments. A new independent design review must confirm whether the three clarifications are adequate before treating any design finding as closed.
