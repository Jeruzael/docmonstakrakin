# PR95 client acknowledgment review and correction

Reviewed immutable signed `9f54b62cb1d939da8400f015f3a96bcbe97b2c01` read-only against integrated PR90 `58f3cabc`. Agent peer review under ACCEL-20261024; routine human review waiver is not independent human approval. No original data, native/application work, server edit or PR comment was performed by this lane.

## Exact correction plan before code

Root accepted the supported P2 finding at `scripts/workspaceAgentClient.ts:27` and delegated a new branch from the reviewed revision. Own only that client, `scripts/testWorkspaceAgentClient.ts` and this evidence. Preserve all prior compiler/onboarding/continuity refs. Root alone integrates and requalifies changed-source CI.

The current client checks operation/project/task/snapshot IDs but ignores the returned requestHash/policyRevision and provenance/humanApproval fields. A pure fake HTTPS transport (zero sockets) delivered baseline, wrong policy999 versus observed3, all-zero hash and HUMAN_APPROVED/humanApproval:true variants; all were accepted. The rejection assertion failed with exit1. This is response correlation, not missing durable read persistence: READ_OBSERVATION/durable:false remains the contract.

Steps:

- Add real client boundary tests through a pure mocked transport; observe failures for strict acknowledgment hash/current policy/provenance and exact bounded task fields before fixing production.
- Require a valid observed policy revision, exact response/task/acknowledgment shapes, matching server request-hash algorithm, same current policy, AUTHENTICATED_AGENT_READ and humanApproval:false. Match existing worker task field byte/enumeration bounds and valid text encoding. Preserve existing trusted TLS configuration and READ_OBSERVATION/durable:false semantics.
- Run only focused pure client/HTTP/JSON/service regressions and whole typecheck; preserve failed reproduction evidence. No shared server/schema/worker/CI edits.
- Record complete review scope and actual CI limitations, sign the minimal fix and hand off without merge.

## Review evidence at original revision

Inspected agentHttp, agentService, agentJson, bodyAdmission, server.ts ordering, workspace HUMAN admission, shared project-persistence coordinator, worker schema3 startup/management/replay/reads/stored validation, management request hashing, CLI new-schema guards, skill admission, Node HTTPS client and qualification workflow/tests. No additional authorization bypass was identified in this bounded pass. Source-derived ACLs, durable read acknowledgments, production skill trust, other transports, schema3 migration/backup and valuable-data activation are documented limitations, not mislabeled newly found bugs.

Original exact-HEAD pure tests on official Node22.23.4 with retained read-only dependencies: Agent JSON6/6, HTTP9/9, client4/4, service7/7 PASS. These did not cover malformed server acknowledgment fields. The added local reproducer `.superpowers/capacity/pr95-ack-review.ts` failed as expected; it did not open a socket or mutate tracked source.

Actual CI inspection: main run40076566373, Windows Native job120821054391 failed at `scripts/testAuthPilot.ts:213`, `87 !== 81`, after all earlier printed authentication checks. The six new route registrations invalidated a historical route-count assertion. This is a distinct root-owned integration fix, not a native dependency diagnosis. Quality & Build and Controlled Docs passed; Complete Regression and separate Agent Authority run40076566408/job120821054025 were still in progress at inspection. No all-green claim or transfer of old CI to a changed revision is made.

## Correction result

The client now computes the exact server `SHA256(JSON.stringify(['DMK_AGENT_READ/1', request]))`, compares it and policyRevision to the outgoing request/current observed actor, and requires AUTHENTICATED_AGENT_READ with humanApproval:false. The outer result and eight-field acknowledgment must have exact key sets. The task must have exactly id/title/description/status/priority/updatedAt, the existing worker byte limits128/1024/65536/32/2/128, valid Unicode and the existing status/priority values. Observed snapshot/policy revisions must be nonnegative safe integers. No server field, read durability, TLS trust or permission was changed.

The committed test expansion first produced **5 PASS / 7 FAIL** on the uncorrected client: hash, policy, authority claims, acknowledgment/response shape, task shape, task bounds and observed revision validation all reproduced missing rejection. After correction and one positive compatibility-boundary group, final **13/13 PASS**. Exact UTF8 byte limits and the worker's permitted empty description remain accepted.

Final pure regressions on official Node22.23.4: client13/13, fixed HTTP9/9, JSON6/6 and service7/7 PASS. Whole `node_modules/typescript/bin/tsc --noEmit` and `git diff --check` passed. Dependencies were existing qualified retained files, read-only through the worktree junction; no fresh-install claim, native workload or actual application/TLS rerun in this lane. The fake transport exercises the real client parsing/correlation boundary but supplies no server authenticity, human authority or new end-to-end qualification.

Correction self-review confirmed the hash algorithm/key order matches `agentHttp.ts`, the task bounds match worker.taskProjection, responses still state READ_OBSERVATION/durable:false and false-human claims are rejected before return. Original peer-review disposition is **changes requested** for the client gap and actual CI failure; this signed code correction resolves the locally reproduced client finding. Root must handle the independent route-count regression, review the exact signed correction and obtain all required fresh CI on the combined candidate before integration. No assertion that this bounded review proves the whole authority system secure is made.
