# Agent Center v0.3 — Operator-selected visual directions

**Status:** Selected visual direction for design publication; implementation is not authorized.  
**Decision source:** Operator's “Publish Agent Center Design v0.3” instruction, 2026-10-19.  
**Scope:** Cosmetic presentation and interaction design. Security and governance policies remain subject to their separate approval processes.

## 1. Relationship to the reviewed package

This supplement adds the operator's visual selections to the unchanged v0.3 design documents. It does not replace any requirement, acceptance criterion or traceability ID. The [architecture specification](01_PRODUCT_AND_ARCHITECTURE_SPEC.md), [UX flows](02_INFORMATION_ARCHITECTURE_AND_UX_FLOWS.md), [PRD](03_PRODUCT_REQUIREMENTS_DOCUMENT.md), [text mockups](04_TEXT_UI_SCREEN_MOCKUPS.md) and [security resolution matrix](05_SECURITY_REVIEW_RESOLUTION_MATRIX.md) retain their reviewed contracts. In a conflict, the security contracts and existing protected governance floors prevail over presentation choices.

## 2. 2D Cozy Minimal Workplace

- Use illustrated 2D avatars in a clean, uncluttered shared-office layout with legible stations and generous space between interactive targets.
- The selected animation vocabulary includes walking, sitting, coffee breaks and desk interactions. These are cosmetic avatar behaviors; a coffee break does not pause a scheduler or provider request, and sitting at a desk does not establish that inference is running.
- Characters and stations are clickable entrances to the same authorized inspectors, conversations and actions available in Simple mode. Message bubbles display only actually published messages or authenticated recorded status that the current viewer may see.
- Provide keyboard-accessible controls, a text roster, screen-reader equivalents and reduced-motion alternatives. Reduced motion suppresses decorative walking and ambient loops without losing information or available actions.
- Preserve the existing Simple-mode fallback when assets or rendering are unavailable. Layout and decoration must not obscure policy blocks, uncertain provider outcomes, human decisions or evidence provenance.

## 3. 3D Soft Clay Workplace

- Use simplified clay-style 3D avatars and a minimal isometric office environment. Favor clear silhouettes and readable interaction targets over scene complexity.
- The selected animation vocabulary includes walking, idle, desk and coffee animations. All such movement is cosmetic unless a separately labeled status is derived from an authenticated, durable event.
- 3D is optional and loaded only when selected. Simple mode and 2D must remain usable without loading or requiring the 3D renderer or its scene assets.
- Apply identical permissions, canonical events and available actions across Simple, 2D and 3D. Scene selection and avatar interaction cannot create authority, widen source audiences or change task state.
- Provide reduced-motion controls, keyboard/text-roster alternatives and a reliable fallback to Simple mode. A render failure or mode switch must not interrupt, complete or lose an agent run.

## 4. Cosmetic behavior and authenticated execution

| Presentation | Permitted interpretation | Required boundary |
| --- | --- | --- |
| Walking, sitting, coffee or idle animation | Decorative scene behavior | Never evidence of task progress, provider activity, pause, cancellation or completion |
| Clickable avatar or station | Navigation to an authorized action or inspector | Server-side identity, membership and delegation checks still govern execution |
| Published message bubble | Viewer-authorized durable message or recorded status | Apply every contributing source's current read and discovery permissions, including uncited inputs; no bubble or activity hint when discovery is denied |
| Completion, approval or evidence badge | Projection of the corresponding verified record and its actual assurance level | Never manufacture completion, messages, approvals, signatures, quorum or evidence from animation |
| Worker stops while remote execution may continue | Local stop plus independently uncertain provider outcome | Show `RESULT_UNCERTAIN` and possible billing; never infer `CANCELLED` from the avatar stopping |
| Offline or no model | Supported manual/deterministic operation | No simulated AI activity presented as a real run; no automatic cloud fallback |

F01–F06 remain binding design constraints: authenticated identity/delegation; durable scoped idempotency with a separate digest and `409` on mismatched reuse; provider confinement and scoped cloud consent; complete source-ACL inheritance and existence secrecy; independent worker/provider/cost tracking; and truthful human approval/signing labels.

## 5. Review criteria for future visual implementation

These are design review criteria, not executed tests or authorization to build an animation engine:

1. The same viewer sees the same permitted events and can reach the same permitted actions in all three modes.
2. Decorative animations cannot generate a run, message, approval, evidence receipt or task transition.
3. Source-discovery denial suppresses bubbles, scene activity markers, captions and counts attributable to the protected output; source-read denial prevents content disclosure.
4. Cosmetic coffee/idle states and local worker termination cannot falsely depict a provider pause, cancellation, completion or refund.
5. Reduced-motion and text-roster paths preserve access to permitted information and actions; selecting Simple mode avoids loading 3D.
6. Offline/manual operation, policy floors and the F01–F06 negative-test requirements remain intact.

## 6. Visual reference availability

No identifiable operator-selected UI screenshots were found in the locally available attachment images, Downloads image candidates, or reviewed design package contents during publication preparation. No screenshot is included or represented as implemented functionality. The supplied text mockups remain static design concepts. Any later screenshot addition must identify its source and design-reference status and receive review before publication.

This selection does not implement runtime services, enable live collaboration, ratify policy, change canonical WBS or historical evidence, authorize PR #34, advance Gate 7 or change release status.
