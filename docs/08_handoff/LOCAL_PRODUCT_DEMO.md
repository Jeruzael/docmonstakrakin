# Deterministic local product demo

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
The fixed synthetic login printed by the command exists only in this disposable
process. It is neither a real identity nor independent human review.
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
5. Inspect **Home** health dimensions. They are stored planning estimates, with
   actual review and verification gates still pending.
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

Ordinary external-project document creation is unavailable. The following
explicit disconnected entrypoint exercises a new candidate without changing
normal product routes or the canonical registry:

```text
node --import ./node_modules/tsx/dist/loader.mjs scripts/demoSyntheticDocumentCreation.ts
```

Use its printed URL as `$demoBase` in a second PowerShell terminal:

```powershell
$login = @{ username='synthetic-author'; password='Synthetic-document-demo-only!' } | ConvertTo-Json
Invoke-RestMethod "$demoBase/api/governance/session" -Method Post -ContentType 'application/json' -Body $login -SessionVariable demoSession
$draft = @{ content="# Synthetic controlled plan`n`nFixture only.`n"; reason='Disconnected demo'; humanConfirmed=$true; expectedVersion=0; expectedDigest=$null } | ConvertTo-Json
Invoke-RestMethod "$demoBase/api/product-demo/documents/create" -Method Post -ContentType 'application/json' -Body $draft -WebSession $demoSession
Invoke-RestMethod "$demoBase/api/product-demo/documents" -WebSession $demoSession
```

The fixed external document, content and audit are committed atomically to a
private synthetic state object. Repeating creation fails with 409. Caller paths,
canonical self-project registration, AGENT authority and anonymous creation fail.
The pilot is not mounted by normal startup and grants no real authoring authority.
Ctrl+C removes only its owned synthetic root.

No demo activates authentication, real principals or grants, privileged routes,
agent execution, canonical WBS changes, receipt consumption, Gate 7 or release.
