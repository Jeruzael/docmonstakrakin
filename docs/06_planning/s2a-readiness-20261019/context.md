# Evidence context

Repository Jeruzael/docmonstakrakin. Immutable master baseline bf5d617fa5bb76323714cc21cc20270acd826616; reviewed AZ-08 feature HEAD e33f5ea7869db34654c831550c91029e2236b789; PR34 candidate 5912185a005df3e0469dd46392d7d0dbb0378b68. No source drift observed during preparation. No scan was started and no scan ID is invented.

The input collection is bound by [evidence-manifest.json](evidence-manifest.json), SHA-256 f6cbd1ac346ad152f136d297a79c0bbcf6347cc81bc3000895447056cefe202b. Raw GitHub/API, install, benchmark and reproduction output is retained through managed artifact storage; raw host directory/DACL details are not copied into the distributable metric summary. The synthetic TLS private key is excluded from retained/published artifacts and removed after testing.

| Evidence ID | Reader-facing meaning | Basis | Source |
| --- | --- | --- | --- |
| review-e33 | Exact PR48 human review and CI | observed | github-readiness-snapshot.json |
| primitive-compat | Windows/Linux primitive feasibility | observed | measurements.json |
| canonical-preview | Unapplied registration preview and historical failures | observed | registration-proposal.json |
| legacy-access | 69-route partial perimeter and unscoped operations | inferred | server/security/apiRoutePolicy.ts at bf5d617 |

Code inspected: server.ts, server/requirementLifecycle.ts at reviewed e33f5ea; src/components/RequirementsView.tsx, src/App.tsx, server/proposals/quorum.ts, server/release/releaseGateEvaluator.ts, server/projectPersistence.ts; historical verifiers verifyDmk196Closure/verifyDmk197Closure/verifyDmk208StatusAudit and forward/v2 registration/preflight tooling at master bf5d617. Policy/trust source remains preliminary and unratified where documented.

Experiments: fresh 105 actual-server AZ-08 cases; original PR34 WBS in a disposable current-master clone; no-write revised registration PREVIEW and three negative controls; pinned package installs and 34 primitive cases on Windows/Linux. All credentials, session material, backup keys and TLS keys were synthetic. Benchmark source, lockfile and sanitized metrics are in evidence/. Linux containers were ephemeral and the newly created labeled local data volume was removed.

This package proposes future application code boundaries. It is not a closure receipt, WBS approval, operational authority, certificate trust installation or demonstration of full authentication/tenant isolation.
