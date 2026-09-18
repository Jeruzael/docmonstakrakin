# docmonstakrakin UI/UX Design System & Architectural Specification

**Product:** docmonstakrakin  
**Design Direction:** Minimalist Enterprise SaaS  
**Primary Theme:** Calm Technical Light Theme  
**Target Runtime:** Desktop Web / Local-First Web App  
**Authoritative Reference:** UI/UX Design Specification & Master Architecture Document

---

## 1. Design System Tokens & Foundations

The application enforces a calm, technical, trustworthy visual language with medium-low density and high information clarity.

### Color Tokens

| Token | Hex Value | Semantic Usage |
| :--- | :--- | :--- |
| `background` | `#F8FAFB` | Main application canvas background |
| `surface` | `#FFFFFF` | Cards, content containers, tables, and drawers |
| `surface-muted` | `#F4F7F8` | Secondary panels, table headers, and pill backgrounds |
| `border` | `#E5E9ED` | Standard 1px boundaries on cards, inputs, and dividers |
| `text-primary` | `#111827` | Primary headings, titles, and high-emphasis body text |
| `text-secondary` | `#667085` | Descriptions, secondary labels, and metadata |
| `text-tertiary` | `#98A2B3` | Timestamps, muted counters, and tertiary hints |
| `accent` | `#39B98A` | Soft emerald/teal brand default, success badges, active nav |
| `accent-soft` | `#E9F8F2` | Subtle green card backgrounds and selected chip highlights |
| `blue` | `#3978F6` | Informational status, verification tags, and primary actions |
| `purple` | `#8B6CEF` | Security assurance, threat modeling, and control mappings |
| `amber` | `#F5A623` | Warnings, medium risk, and pending human reviews |
| `red` | `#EF5B5B` | Critical risk, blocking questions, and test failures |

### Dimensional & Spatial Tokens

- **Sidebar Width:** `260px` desktop expanded; `72px` collapsed mode.
- **Card Border Radius:** `12px` to `16px` (no extreme capsule radii on containers).
- **Button / Input Radius:** `8px` to `10px`.
- **Card Padding:** `20px` to `24px` standard container padding.
- **Content Max Width:** `1440px` centered with responsive fluidity down to `1024px`.
- **Transitions:** Restrained `150ms`–`220ms` ease-out on drawer openings and hover feedback.

---

## 2. Anti-Slop Visual Rules & Accessibility

1. **No Artificial AI Slop:** Banned purple-to-blue decorative gradients, cyan-on-dark text, glassmorphism, floating drop-shadows, and stacked 3-column promotional marketing cards.
2. **Strict Dual-Indicator Risk Labels:** Never rely on color alone. Every risk indicator must include explicit text (`● LOW`, `● MEDIUM`, `● HIGH`, `● CRITICAL`).
3. **No Nested Card Hall of Mirrors:** Never nest cards inside cards. Flatten depth with subtle dividers, typography scales, and clean padding.
4. **Single-Line Badges & Buttons:** Text inside badges, pills, and buttons must stay on a single line (`white-space: nowrap`).
5. **WCAG AA Compliance:** High-contrast text on all neutral and tinted surfaces (contrast ratio $\ge 4.5:1$).

---

## 3. Global Application Shell

```
┌─────────────────┬─────────────────────────────────────────────────────────────┐
│                 │ Top Bar: [Project Select] [Search Ctrl+K] [● Local] [Bell] [JD]│
│  Left Sidebar   ├─────────────────────────────────────────────────────────────┤
│                 │                                                             │
│  - Overview     │ Main Active Workspace View                                  │
│  - Requirements │ (Dashboard, Requirements, Risk, Work, Architecture, etc.)   │
│  - Architecture │                                                             │
│  - Risk         │                                                             │
│  - Work         │                                                             │
│  - Standards    │                                                             │
│  - Evidence     │                                                             │
│  - Approvals    │                                                             │
│  - Documents    │                                                             │
│                 │                                                             │
│  [Collapse]     │                                                             │
└─────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 4. A-SSDLC Lifecycle State Machine

The control plane orchestrates 15 discrete phases across the development lifecycle:

```
[1. Discovery] ──► [2. Requirements] ──► [3. Req Review] ──► [4. Risk Assessment]
                                                                     │
[8. Planning] ◄── [7. Arch Review] ◄── [6. Architecture] ◄── [5. Threat Modeling]
      │
      ▼
[9. Implementation] ──► [10. Verification] ──► [11. Security Review] ──► [12. Release]
                                                                             │
[15. Feedback] ◄────── [14. Operations] ◄────── [13. Deployment] ◄───────────┘
```

### Mandatory Gate Evaluation Rules
- **Requirements Gate:** Cannot advance to Architecture if any `BLOCKING` discovery question is `UNRESOLVED`.
- **Mandatory Risk Floor:** If an application includes `Public Internet API` or `Autonomous Agent Execution`, the Inherent Risk level is locked at a minimum floor of `HIGH` (Score $\ge 15/25$) or `CRITICAL` (Score $\ge 20/25$).
- **Audit Immutability:** Overrides, approvals, state transitions, and file-access grants append cryptographically hashed events to the audit ledger.
