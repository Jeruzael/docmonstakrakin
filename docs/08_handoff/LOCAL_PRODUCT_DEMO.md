# Deterministic local product demo

**2026-10-22 integrated scope:** ordinary managed documents, verification sessions
and reviewer-setup guidance are merged through PR #80; see the
[actual closure and qualifications](../07_verification/LOCAL_MVP_COMPLETION_CLOSURE_20261022.md).
For normal-checkout startup, restart and package acceptance, use the
[README](../../README.md) and [reproducibility candidate](LOCAL_MVP_REPRODUCIBILITY_20261022.md).
This page describes the separate disposable demo. Its historical checks do not
qualify the new normal-checkout journey or the three-person verification setup.

## Historical demo checkpoint

**Current integration checkpoint (2026-10-21):** this product journey is now on master through PR #66, exact post-merge verified commit `21da1d5bebaecf58b5037c255561c8b8315b429d`. [Actual master CI](https://github.com/Jeruzael/docmonstakrakin/actions/runs/39598218255) passed all four jobs and79/79suites, including the nine-check product journey. A normal checkout of that commit can run the commands below. The original recovery-branch instructions are retained as historical context; they no longer mean the product changes are absent from master. See the [continuation handoff](FAST_TRACK_DEVELOPMENT_HANDOFF.md) and [complete remaining task ledger](../06_planning/FOUR_HOUR_COMPLETION_LEDGER_20261021.md) for current limitations and subsequent integration evidence.

The earlier `codex/pr63-master-integration` recovery branch and baseline
`b4004c167e5a377a324f7eaa21f877d3d71ae33d` are historical context, not current
startup prerequisites. The old PR #63 feature-branch merge alone did not place
its commands on master. Confirm the selected checkout and exact HEAD using the
README before running; current candidate integration evidence belongs in the
parent handoff. Ownership, CI-guard, security-store and fixture protections remain
required.

Use the committed dependencies under Node 22 x64. Install from the committed
lockfile in a disposable checkout using the supported Windows/Linux instructions
in `FAST_TRACK_DEVELOPMENT_HANDOFF.md`; this guide does not repair the operator's
existing installation. No external provider key is needed.

## Ordinary local product journey in a disposable workspace

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/demoLocalProduct.ts
```

Open the printed loopback URL. The command builds and serves the actual App using
the actual server, with a fresh synthetic snapshot and no inherited credentials.
Use only the fixture session details printed by that isolated process, within
its URL. No person, account or password values are supplied by this guide. The
fixture session is neither a real identity nor independent human review.
Inputs and acceptance outcomes are deterministic; real server-generated UUIDs,
timestamps and audit digests vary between fresh runs and are never backdated.

1. Click **New**, name the project, continue through the wizard and launch it.
2. Open **Requirements → Adaptive Discovery Questionnaire**. Answer the first
   problem statement with **Process Automation & Workflow Efficiency**. Observe
   the saved answer, derived PROPOSED requirement and incomplete coverage.
3. Open **Work Management**, choose the governing requirement and click **Propose
   linked task**. Open the new proposed task and move it to **IN_PROGRESS**.
   An unauthenticated **VERIFIED** update must fail; do not seek an override.
4. Open **Prompt Compiler**, choose the linked task and inspect/copy its compiled
   context. This creates an offline handoff package, not an external model call.
5. Inspect **Home** dimensions. Discovery completion is calculated from the
   applicable gates. Implementation and local review counts require explicit
   current-release scope; unavailable security/release dimensions remain explicit.
   Local records do not establish production verification or release authority.
6. Switch to **Synthetic controlled-document workspace**. In **Reports & Export**
   inspect the existing repository documents, edit the living project state,
   preview its diff and validate. A save needs the synthetic reviewer session,
   a reason and explicit confirmation. Keep the invariant title/governance fields.
7. Inspect **Evidence & Audit → Append-Only Audit** for the resulting real save
   event. The seeded synthetic evidence is UNTRUSTED. It is not release proof.
8. A read-only release report may be viewed. No release signoff is invoked; Gate 7
   remains unexecuted and the release remains blocked.

Ctrl+C stops the server and removes its marked synthetic workspace. The isolated
automated journey, including restart/session fencing and denied operations, runs:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/testLocalProductJourney.ts
```

Its JSON and two screenshots are written under `runtime/product-demo/` and may be
regenerated from a normal Git checkout. The acceptance matrix is
`docs/07_verification/LOCAL_PRODUCT_DEMO_ACCEPTANCE_20261021.md`.

## Separate inactive document creation pilot

The historical demo had no ordinary-project document creation. The 2026-10-22
candidate adds managed Markdown/text creation and controlled saving in the
ordinary project's atomic snapshot after integration. That path requires a
configured HUMAN reviewer, reason and explicit confirmation and grants no
governance approval or trust. Existing self-project filesystem registry/save
restrictions remain in place. The following older synthetic entrypoint remains
separate from those normal product routes:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/demoSyntheticDocumentCreation.ts
```

Use only its printed temporary URL and fixture session context. Consult the
fixture source for its isolated request contract; its fixture endpoint is not
the ordinary managed-document API. Do not enroll an operator account or copy
fixture credentials into normal startup to reproduce this pilot.

The fixed external document, content and audit are committed atomically to a
private synthetic state object. Repeating creation fails with 409. Caller paths,
canonical self-project registration, AGENT authority and anonymous creation fail.
The pilot is not mounted by normal startup and grants no real authoring authority.
Ctrl+C removes only its owned synthetic root.

No demo activates authentication, real principals or grants, privileged routes,
agent execution, canonical WBS changes, receipt consumption, Gate 7 or release.

No install, demo, normal-checkout startup, browser, build or full regression was
run for this documentation correction. Parent integration must record the
actual HEAD, environment, commands and outcomes before publication. The new
verification workflow requires operator-controlled person bindings and three
distinct locally asserted people; the existing demo roster does not establish
that setup. Local human attestations and package integrity provide no trusted
production evidence.
