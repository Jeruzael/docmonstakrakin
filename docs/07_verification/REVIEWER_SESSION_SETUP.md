# Local reviewer session setup

The server fails closed when `DMK_HUMAN_REVIEWERS` is absent. The application has no default reviewer credentials, registration endpoint or body-selected governance roles.

The local operator configures a JSON map in the server environment. Each username maps to an object containing a stable unique `id`, `kind: "HUMAN"`, a `roles` array and a `credentialVerifier`. Use separate people/IDs for Security Officer and Lead Architect. Agent identities use `kind: "AGENT"` and cannot approve even if a role is accidentally present.

`credentialVerifier` is `<salt>:<hash>`: 16 random salt bytes encoded as 32 lowercase hex characters, followed by the 32-byte result of Node's `scryptSync(password, saltHex, 32)` encoded as 64 lowercase hex characters. The salt argument is the hex string, matching the server implementation. Generate verifiers in a private local credential workflow, avoid command history/plaintext logs, and keep the roster outside committed project files. Never copy integration-test credentials into a real reviewer roster.

Start/restart the server with that environment, then use the app header's Sign in form. Roles come from the server roster. Sessions last 30 minutes, are HttpOnly and SameSite=Strict, and are revoked on logout or server restart. Cookies use Secure on HTTPS. Artifact-level signoff requires distinct authorized identities; one dual-role identity cannot satisfy both quorum slots.

This is a local reviewer mechanism, not SSO or v0.2 team management. Keep it within the intended trusted local deployment. Setup does not authorize release signoff: Gate 7 remains HUMAN_APPROVAL_REQUIRED and the current task must not execute it.
