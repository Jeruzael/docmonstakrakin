# docmonstakrakin Integration Architecture
## AI Gateway, Provider Adapters & External Systems

**Document ID:** DOC-ARC-004  
**Baseline:** v0.1 Local-First MVP  

---

## 1. Provider-Neutral AI Gateway

The core domain logic never couples directly to a specific AI vendor SDK. The **AI Gateway** sits between domain services and concrete vendor implementations:

```
                  ┌───────────────────────────────┐
                  │    Internal AI Gateway Core   │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Gemini Adapter  │    │  Codex Adapter   │    │  Offline Manual  │
│  (@google/genai) │    │  (OpenAI Agents) │    │  Copy/Paste Pack │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 2. Gemini Provider Adapter (`DMK-079`)

- **SDK:** `@google/genai` TypeScript SDK running exclusively in server-side Express context (`server.ts`).
- **Key Isolation:** Uses `process.env.GEMINI_API_KEY`. The secret is never sent to the browser or stored in project databases.
- **Output Enforcement:** Structured JSON Schema constraints (`responseMimeType: "application/json"`) ensure that model outputs map directly to typed domain objects.

---

## 3. Google Forms Integration (`DMK-150` – `DMK-153`)

- **Purpose:** Enable non-technical stakeholders to complete discovery questions via familiar Google Forms.
- **Mapping:** Internal conditional questions export to a Google Form JSON payload.
- **Ingestion Policy:** Responses imported from Google Forms are placed into a **Stakeholder Review Inbox** as *proposed* answers; they are NEVER automatically promoted to approved requirements without explicit engineer review.
