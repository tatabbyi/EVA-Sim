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

## D-004 — Electron-only desktop delivery on three operating systems
- **Date:** 2026-11-14
- **Status:** User confirmed
- **Question IDs:** Q01, Q02
- **Decision:** Electron is the canonical and **only** application target; support Windows, Linux, and macOS.
- **User's stated reason:** moving away from a web-only app to avoid ordinary browser restrictions and increase usable resources for the 3D experience.
- **Boundary:** No separate web build is part of the agreed target. Electron still uses Chromium/graphics drivers and is subject to CPU/GPU, RAM, WebGL, OS and asset I/O limits. "No lag" is an **unverified performance aspiration**, not a guaranteed property.
- **Impact:** Supersedes the TEAM-PLAN.md browser/Vercel deploy architecture as the delivery target; update build/packaging/integration prompts accordingly. Whether judges require a publicly accessible demo artifact remains a submission issue, not authorization to build a web app.

## D-005 — Fully offline runtime
- **Date:** 2026-11-14
- **Status:** User confirmed
- **Question ID:** Q03
- **Decision:** The Electron app must work completely offline.
- **Impact:** Runtime must not depend on connectivity to Mars Trek, NASA images/API, Vercel, online tiles, a remote backend, web fonts, or other third-party services for required features. Assets, scientific inputs and processing needed at runtime must be locally available. Exact asset packaging, caching and data generation strategy are **not yet agreed**.
- **Verification to define:** Cold launch with network disabled; Plan/Walk/physics features required by later scope blocks continue to work.

## D-006 — Victor's deliverable is the 3D mesh / geometry
- **Date:** 2026-11-14
- **Status:** User confirmed for Q04
- **Decision:** Victor owns improvement/preparation of the **3D mesh / geometry**. Alex renders and integrates the model in the application.
- **Not inferred:** Victor's ownership of metadata, DTM, scientific models, texture formats, and pipeline is not established by this answer; clarify interfaces and outputs before Codex implementation.
- **Impact:** Define versioned geometry file/coordinate/material/normal/LOD contracts with Victor.

## D-007 — Alex owns calculations, routing and Leash
- **Date:** 2026-11-14
- **Status:** User confirmed
- **Question ID:** Q05
- **Decision:** Alex is responsible for oxygen/physics formulas, route evaluation/pathfinding and the Leash. This overrides the earlier TEAM-PLAN.md allocation of those responsibilities to Nanda for Alex's implementation scope; team coordination may still be needed.
- **Impact:** All scientific changes require an explicit logged decision. Shared test vectors, units and coordinate mapping must be agreed before coding.

## D-008 — Rachel's visuals require prior coordination to modify
- **Date:** 2026-11-14
- **Status:** User confirmed
- **Question ID:** Q07
- **Decision:** Alex must obtain agreement before modifying Rachel-owned shader, HUD, palette or other visual components. Integration alone is not a blanket authorization to redesign or edit visuals.
- **Impact:** Codex prompts should protect `src/terrain/material.ts`, `src/terrain/beacon.ts`, `src/ui/HelmetHud.*`, `src/ui/palette.ts` until a concrete change is approved.

## Pending architecture decision — Q06
- **Status:** OPEN as of 2026-11-14; user response: "Нужно согласовать".
- **Issue:** TEAM-PLAN.md §2 coordinates, grid alignments, tile binary format, metadata and working area are **not yet confirmed** with Victor. Do not freeze or silently rewrite these contracts.
- **Action:** Agree exactly what geometry+metadata Victor ships and provide a representative test asset.

## Proposed decisions (NOT confirmed)
- P-001: React/TS renderer + Three.js inside Electron, keeping pure TS simulation/domain modules independent of Electron.
- P-002: Separate data payloads and static Python generation from Electron runtime.
- P-003: SUPERSEDED/REJECTED by D-004: independent browser app is **not** in the agreed delivery scope.
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
