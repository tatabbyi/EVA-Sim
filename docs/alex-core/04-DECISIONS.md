# Decisions and change log

Record decisions that have been explicitly confirmed, not inferred.

## D-001 — Alex owns desktop core and rendering direction
- **Date:** 2026-11-14
- **Status:** User confirmed (scope described; interfaces not yet specified)
- **Source:** user's 2026-11-14 instructions in this conversation.
- **Decision:** Alex's job is logic/software/core on Electron and rendering of Victor's improved model; Alex is the software/integration brain.
- **Impact:** The old TEAM-PLAN.md React/Vite browser-only assumptions must be reconciled with Electron.
- **Not decided:** whether browser demo remains, precise model file formats, physics ownership, code organization.

## D-002 — Documentation-first implementation workflow
- **Date:** 2026-11-14
- **Status:** User confirmed
- **Source:** user's 2026-11-14 instructions.
- **Decision:** Start by answering cross-project questions on logic/formulas/physics; user will then supply assigned work as blocks. Assistant asks scoped questions, logs each block, and ultimately assembles technical documentation and ordered, reviewable Codex prompts. Alex will review generated code.
- **Impact:** No application code generation until user explicitly asks for handoff or implementation.

## D-003 — Preserve durable engineering context as files
- **Date:** 2026-11-14
- **Status:** User confirmed; storage location is assistant's operational choice, subject to Q35
- **Decision:** Version-controlled Markdown notes under `docs/alex-core/` in user's fork, tracking decisions, assumptions, questions, changes and handoffs.
- **Impact:** Read the files at the start of new sessions and update after each work block.
- **Open:** Confirm whether main branch or dedicated branch is preferred for long-term ongoing edits.

## Proposed decisions (NOT confirmed)
- P-001: React/TS renderer + Three.js inside Electron, keeping pure TS simulation/domain modules independent of Electron.
- P-002: Separate data payloads and static Python generation from Electron runtime.
- P-003: Publish a web-compatible demo of the same renderer for judges, alongside Electron.
- P-004: Treat physical/scientific parameter sets as versioned scenarios with explicit assumptions and units.

Use format for future items:
```
## D-XXX — title
Date:
Status: confirmed / superseded / rejected
Owner:
Source:
Decision:
Reasoning summary:
Alternatives rejected:
Affected files/contracts:
Verification:
```
