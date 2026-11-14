# Alex Core — persistent engineering record

**Repository:** mokachkasss/Sharkies (private fork of tatabbyi/Sharkies)
**Baseline inspected:** main @ `4e3521e3e176baebec3b26e5fc2b66a0adeae573`
**Created:** 2026-11-14
**Status:** requirements elicitation; NOT an implementation specification yet.

## Purpose
Store durable, reviewable **decision summaries, assumptions, design rationale, accepted contracts, outstanding questions, implementation blocks, and future Codex handoff prompts**. Git commits form the audit trail. These notes are not hidden reasoning transcripts. Do not assume a suggestion is an agreed requirement.

## Read this at the beginning of every new work session
1. `README.md` — workflow and status.
2. `01-PROJECT-CONTEXT.md` — user-confirmed responsibility and source hierarchy.
3. `04-DECISIONS.md` — binding decisions and superseded ones.
4. `03-OPEN-QUESTIONS.md` — unresolved questions; user may reply by ID.
5. `02-SCIENCE-AND-CONTRACTS.md` — original research formulas, formats, assumptions and audit notes.
6. `05-BLOCK-REGISTER.md` — blocks the user gives over the next turns.
7. `06-CODEX-HANDOFF.md` — coding plan and sequential prompt structure (unfinalized).
8. `07-SESSION-LOG.md` — append-only session summaries with dates and source references.

## Update discipline
- After **every** user-delivered feature block: record raw intent faithfully, exact acceptance criteria, open questions, dependencies, conflicts and status (draft/confirmed/rejected/superseded).
- After **every** resolved question: update the questions list AND add a decision with date, owner, source and rationale summary. Never silently convert a question into a decision.
- If contracts change, note the old value, new value, and affected modules.
- Keep preliminary science estimates separate from measured/validated physical facts.
- Do not create or modify application code unless user separately requests it. Currently write **docs only** on the user's fork.
- Before editing, re-read current GitHub head and the latest docs. If source and notes differ, flag divergence; don't overwrite newer work.
- For final handoff, generate many small, testable, ordered Codex prompts with explicit files, inputs/outputs, verification, review points, and no unagreed work.

## Current direction, user-confirmed
- **Alex**: Electron application, core software/logic, renderer, integration ('brain').
- **Victor**: improving the model (precise model type, deliverable, and format still to be clarified); Alex renders the result.
- Other prior allocations (Rachel/Nanda/Aadila) come from older `TEAM-PLAN.md` and are NOT automatically updated by this statement.
- Work starts with project-wide physics/logic questions; user will provide their own assigned work as separate blocks.
- The end products are a coherent documentation pack plus a sequence of Codex prompts; Alex reviews Codex-generated code.

## Project reference order
1. Explicit user-confirmed decisions in this log.
2. Newly delivered work blocks once confirmed.
3. Existing `TEAM-PLAN.md` (historical team plan and technical contracts).
4. `research/00-MORNING-BRIEF.md` through `research/13-space-apps-rules.md` (research and proposed numbers).
5. Current implementation in `src/`, `public/`, `pipeline/` (what *actually exists*, not necessarily desired).

**Important:** The original repo targets React/Vite website + Vercel. An Electron shell is a newly stated direction, and packaging/runtime integration decisions are not yet settled.

## Agreed architecture baseline — 2026-11-14
- **Electron only**; target **Windows, Linux and macOS** (Q01, Q02).
- **Fully offline runtime**: required features must not depend on any live web service or online tiles (Q03). Distribution, data packaging and build pipeline remain undecided.
- **Victor** improves and provides the 3D mesh/geometry; **Alex** implements the core, renders/integrates the mesh, and owns O₂ formulas, routing/pathfinding and Leash (Q04, Q05).
- Technical data contracts between Alex and Victor are **NOT YET APPROVED** (Q06).
- Changing Rachel-owned visual files requires prior coordination (Q07).
- Motivation for Electron: greater control over local resources than an ordinary web page. **Do not promise no lag:** Electron/Chromium still has graphics, CPU, RAM, I/O and memory restrictions; profile the application on the three target OSes.
- Traceability: D-004 through D-008 in `04-DECISIONS.md`; Q01–Q05 and Q07 confirmed in `03-OPEN-QUESTIONS.md`.

## Important identifiers
- Primary repo: `mokachkasss/Sharkies`; upstream: `tatabbyi/Sharkies`.
- Jezero lander: latitude 18.4447 N, longitude 77.4508 E.
- Map/terrain local axes: x east, y up, z south (positive).
- Original working box 4096 m x 4096 m, centered on landing site.
- MVP in old plan: real terrain, route + O2, Leash, Survival Odds, Houston light delay.
- Current status at inspected baseline: framework and Rachel shader/HUD/beacon exist; many core functions throw "not implemented", generated NASA tiles/grids are absent.
