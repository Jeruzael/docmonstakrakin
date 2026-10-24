# Trusted prompt retrieval component — ACCEL-20261024

Implementation basefec902620145e1526861b20c2c2400d198a1779d; signed file-level plan7358b6a. Owner EXT-CAND-03/DMK-171/209. OPERATOR_DELEGATED_DECISION / HUMAN_REVIEW_WAIVED_BY_OPERATOR. Component development only; HTTP/client activation, final combined CI and all remaining package13 criteria are pending.

The existing `INITIAL_AGENT_ROLES` catalog is extended by one provider-independent scoped task-read instruction with zero invented runs. Its five legacy entries retain their order/content. `publishedPromptSkills` derives metadata/instructions from the same catalog, insulated from mutable project role cards and returned-object edits. It does not create a competing prompt library or operational authority. Content versions and registry digests use SHA-256; authority is explicitly bundled source publication, not independent WBS signer trust.

Host-only instruction receipts use a fresh random HMAC-SHA256 process key, fixed domain, canonical exact fields, constant-time MAC comparison, canonical base64url/UTF8, and maximum4096 encoded characters. They bind the exact request/UUID, actor/client/session/grant/scope, policy/snapshot, skill content/version and publication. Description retrieval precedes instruction content and project-operation admission. Receipt validity is at most60seconds and grant expiry; expired/changed/revoked/context-mismatched receipts deny. Clock and observed publication epochs have per-instance high-water fences. Publication changes require an increased epoch; a subsequently observed older publication cannot revive a revoked receipt.

Inert admission rejects accessors/proxies/symbols/nonplain objects, nonfinite data, malformed schemas and unsafe keys. Candidate logical limits: depth8,16384 nodes/array entries,1MiB aggregate strings/keys/publication content,128 assets/revocation IDs; IDs<=128 ASCII characters and task scope<=64 IDs. These bound the component, not process RSS or production capacity. No RPC/time/retention limit was changed.

Actual pure tests used qualified portable Node22.23.4 with regular retained task dependencies:

| Experiment | Actual outcome |
|---|---|
|Missing registry and admission before implementation|Each0/1 RED, missing export|
|Initial component implementation|Registry4/4,admission7/7|
|Nested accessor/equivalent scope-order adversarial test|Admission7 pass/1 FAIL; nested getter executed|
|Recursive inert guard and canonical scope binding|Admission8/8|
|Legacy selection-order regression test|Registry4 pass/1 FAIL with new asset prepended|
|Append new asset preserving legacy order; proxy guard|Registry5/5,admission9/9|
|Newer-revoked publication followed by older source|Admission9 pass/1 FAIL; old receipt revived|
|Observed publication epoch/digest fence|Final registry5/5 and admission10/10 PASS|

No test result is human observation. No fresh installation, application session, native benchmark, full typecheck/build or hosted CI is qualified by these pure component results. The earlier PR90 fresh-install child-loader failure remains separate and is not corrected here.

Independent agent review of0f90912 reproduced a P2 same-epoch equivocation: baseline receipt accepted; conflicting revoked publication rejected; restoration of original bytes accepted it again. The new regression produced10pass/1fail. A same-epoch digest conflict now latches the epoch unavailable until a strictly newer valid publication; restoring old bytes cannot clear it. This is a local component fix, not persistent cross-restart currentness. Final rerun is recorded with the integration candidate; no HTTP permission bypass or actual activation was claimed from the original component.

Remaining boundaries: callers must acquire fresh actor context from the existing authority rather than accept an actor JSON from a client. The component proves retrieval, not comprehension or permission, and does not consume durable operation IDs or provide result idempotency. Actual actions must independently reauthorize and use the common transaction/receipt boundary. The source publication trust channel, currentness across deployment rollback and persistent epoch acquisition are not a production policy service. Restart invalidates receipts by rotating the process key; clients bootstrap again. No arbitrary uploaded skills, dynamic policy injection, manual-import-to-live identity conversion, real grants or client compatibility are asserted. No project/operator/canonical state was mutated.
