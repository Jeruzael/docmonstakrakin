# ADR-0002: Single Canonical WorkItem Model

**Status:** ACCEPTED  
**Date:** 2026-08-20  
**Deciders:** Project Lead, Lead Architect  
**Technical Component:** `CMP-04` (Isolated Project State Repository)  

---

## Context & Problem Statement
Engineering tools frequently fracture task tracking across disparate tables or services: a Kanban board holds sprint cards, a separate document tracks the Work Breakdown Structure, and checklists exist independently in pull request templates. This causes synchronization drift, phantom tasks, and unverified completion claims.

## Decision
We decide that the system will maintain exactly **one canonical `WorkItem` aggregate model**.
All task views—Kanban Board, Hierarchical WBS, Tabular Product Backlog, Sprint Backlog, and Master Task Lists—are deterministic client-side projections of this single canonical dataset.
A work item is created once with a permanent immutable identifier (e.g. `DMK-157`), and its hierarchical position (`wbsPath`) and sprint assignment are attributes on that single entity.

## Consequences
- **Positive:**
  - Zero state drift between Kanban cards and WBS tasks.
  - Updates in one view (e.g. status transition to `VERIFIED`) instantly reflect across all other views.
  - Traceability links to requirements, tests, and evidence are attached directly to the single canonical entity.
- **Negative:**
  - The `WorkItem` model must accommodate diverse view attributes without becoming bloated.
