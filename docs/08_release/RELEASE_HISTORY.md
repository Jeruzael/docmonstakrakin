# docmonstakrakin Release History
## Version Milestones & Release Changelog

**Document ID:** DOC-REL-002  
**Baseline:** v0.1.0-rc1 (Technically Verified Release Candidate; Gate 7 Human Sign-off Pending)  

---

## 1. Version History

### `v0.1.0-rc1` (Current State: Technically Verified Release Candidate)
- **Release Target:** `v0.1.0-rc1` (Release Candidate; Gate 7 Human Sign-off Pending)
- **Baseline Date:** September 2026
- **Distribution Mode:** Local Developer Web App / AI Studio Container Preview
- **Included Capabilities:**
  - Implemented and verified all 25 core MVP capabilities across UI shell, server-side Express API, and in-memory/SQLite state repository.
  - SecretStore credential abstraction with OS Keyring integration and AES-256-GCM fallback verified (`DMK-157`, `DMK-158`, `EV-157`, `EV-158`).
  - Comprehensive security regression suite verified across 41 vectors (`DMK-159`, `EV-159`).
  - Standalone portable `.docmonstakrakin` sealed package verified (`DMK-156`, `EV-156`).
  - 6 of 6 technical release gates verified; Gate 7 DoD human sign-off held at `HUMAN_APPROVAL_REQUIRED` per SEC-CTRL-020 (not a formally released baseline until Gate 7 sign-off is recorded).

### `v0.1.0-alpha.1` (Initial Prototype State)
- **Release Date:** September 2026
- **Distribution Mode:** Local Developer Web App / AI Studio Container Preview
- **Included Capabilities:**
  - Implemented all 25 core MVP capabilities across UI shell, server-side Express API, and in-memory/SQLite state repository.
  - Interactive lifecycle dashboard with real-time health scoring and deterministic recommended next action.
  - Adaptive questionnaire engine with blocker tracking and requirements readiness calculations.
  - Risk workspace supporting STRIDE threat modeling, mandatory risk floors, and audited gate overrides.
  - Server-side Gemini API adapter and independent dual-agent cross-review engine.
  - Full audit ledger with SHA-256 cryptographic hash chaining.
  - Canonical documentation hierarchy established (`00_control/` through `08_release/`).
- **Known Limitations:**
  - `SecretStore` driver (`DMK-157`) currently uses local environment variable fallback; native keyring integration queued for v0.1.0-beta.
  - Automated CI test harness (`DMK-005`) scheduled for containerization.
