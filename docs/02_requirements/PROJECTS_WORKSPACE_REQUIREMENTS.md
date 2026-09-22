# REQ-UX-PROJECTS-001 — Projects Workspace & Reliable Project Switching

Source: human DMK-194 implementation instruction, 2026-09-22. WBS DMK-194; architecture CMP-01; isolation control SEC-CTRL-004. Implementation authorized; human UI verification pending. This records the supplied requirement without changing the historical reviewed bootstrap manifest or granting governance approval.

The operator can browse the canonical project list, inspect available metadata/lifecycle, identify the active project and open another project. Both the Projects workspace and TopBar use App's one selection path. ProjectsView does not own active-project state or fetch scoped collections.

Acceptance criteria:

1. Projects navigation renders the canonical list, available metadata, an active-project indicator and an Open Project action. Missing optional values are omitted.
2. A-to-B-to-A selection replaces identity and all scoped collections together without modifying canonical content.
3. Requirement/question/work selections, requirement subtab and scoped dialogs reset on selection. Search receives only the ready project's data.
4. The latest selection wins over late success/failure responses, cancelled requests and old mutation-refresh callbacks.
5. Loading is visible. Load failures hide stale scoped content, expose an error and allow retry or another selection.
6. Empty lists expose explicit creation through the existing wizard; merely opening Projects never opens the wizard.
7. Successfully created/imported projects use the same selection path and appear without a full reload.

Automated evidence: scripts/testProjectsWorkspace.ts. Human interaction checklist: docs/07_verification/DMK_194_PROJECTS_WORKSPACE_REVIEW.md. No project administration, governance changes, DMK-195+ work, live bootstrap or Gate 7 execution is included.
