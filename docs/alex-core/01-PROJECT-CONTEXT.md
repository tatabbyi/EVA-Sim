# Project context, roles, and delivery boundaries

## Product as originally researched
**Sharkies / EVA Sim** is a Mars extravehicular-activity planner/trainer on NASA Jezero Crater terrain. User sees terrain and map, plans routes, sees oxygen return limit ("Leash"), simulated survival probability, Earth–Mars communication delay, and optional walking/training/VR. Scientific models are illustrative, not certified EVA safety systems.

## Immediate new instructions — 2026-11-14
User says: "Моя задача - сделать логику, софт, кор на Electron. Виктор делает модель лучше, работает над ней, я - отрисовываю. Я - мозг."
Operational interpretation:
- Alex is responsible for Electron app/core, software behaviour, data-driven rendering and integrating the deliverables.
- Victor refines the **model**; do not assume whether this means geometric 3D terrain only, underlying DTM/geospatial data, scientific cost model, or all of these; ask.
- Need to reconcile earlier plan assigning route/O2/VR to Nanda and HUD/material to Rachel. Do NOT reassign their tasks without confirmation.
- Goal is to elicit all cross-cutting logic/science/physics constraints now; subsequently receive implementation blocks and ask block-specific questions.
- Final artifacts: detailed, accepted technical specification + dependency-ordered Codex implementation prompts; Alex will review code.

## Confirmed architecture answers, 2026-11-14
- **Q01 / Q02:** Electron-only application for **Windows, Linux, macOS** (D-004). No independent browser app agreed.
- **Q03:** **fully offline**, including required map/terrain/science capabilities at runtime (D-005). Exact bundled data strategy pending.
- **Q04:** Victor develops and improves the **3D mesh / geometry**; Alex renders it (D-006). Exact exported geometry and metadata not yet agreed.
- **Q05:** Alex owns oxygen formulas, route evaluation, pathfinding and Leash (D-007); previous Nanda allocation is historical and requires team coordination.
- **Q06:** Technical interface contracts (CRS, tiles/grids/formats, origin, dimensions) **need agreement**, especially with Victor. Existing TEAM-PLAN is a working reference, NOT approved final schema.
- **Q07:** Rachel owns visual components; Alex may change them **only after agreement** (D-008).
- **Motivation stated by Alex:** Electron selected to escape ordinary browser constraints and use more resources for 3D. **Engineering reality:** Electron embeds Chromium; it does not remove GPU, WebGL, CPU, RAM, context or I/O limits. Performance is a testable goal, not guaranteed.
- **Scope boundary:** No other scientific assumptions or formulas confirmed by these answers.

## Existing architecture (historical plan, not Electron agreement)
- Vite + React + TS front end; Three.js r187 for 3D; MapLibre GL 6.18 for imagery/map.
- Python precompute: GDAL for DTM/viewshed/geo data, SciPy graph Dijkstra for oxygen return-cost, NumPy, pymartini for 64 adaptive terrain tiles.
- Static files at `public/data/`, `public/grids/`, `public/tiles/`; normal client keeps no database or always-on backend.
- Planned modes: Plan, Walk, Training; Houston is a simulation feature. WebXR is stretch.
- Old teammates: Alex app shell/simulation/Houston/merges, Rachel visuals/HUD/shaders, Victor DTM/tiles/comms, Nanda cost/paths/Walk/XR, Aadila pitch/sources/submission.

## Current checked code baseline
- Implemented helper modules: `src/shared/coords.ts`, `src/shared/grids.ts`, `src/shared/meta.ts`.
- Rachel files: `src/terrain/material.ts`, `src/terrain/beacon.ts`, `src/ui/HelmetHud.tsx`, `src/ui/HelmetHud.css`, `src/ui/palette.ts`.
- App shell `src/app/App.tsx` shows skeleton text only.
- `src/terrain/loader.ts`, `src/sim/cost.ts`, `src/houston/time.ts` contain stubs throwing errors.
- Grid/tiles directories have only `.gitkeep`; `public/data/meta.json` is a placeholder (`h0: 0`).
- `pipeline/` has `environment.yml` and description, but not the planned data-generation scripts.
- `package.json` uses React/Vite/Three/MapLibre and GPL-3.0-or-later; no Electron dependency yet.
- No build or runtime testing performed in this logging session.

## Remaining Electron-specific design questions (NOT yet agreed)
- Windows/Linux/macOS **distribution format** and machine compatibility: installer, portable build, development runner and testing matrix.
- Fully offline asset storage: pre-bundled imagery/DTM/mesh and physics inputs; whether NASA sources can be used during **build-time** only; asset size and updating strategy.
- Electron security: main/preload/renderer split; contextIsolation, nodeIntegration off, narrowly scoped IPC, no remote-code permission, secure CSP.
- How to bundle/ship multi-GB data: external assets vs generated tiles, static app protocol, per-platform file paths; whether Python runs at build-time or runtime.
- Maintain domain/simulation logic as pure TS libraries, with UI/Three.js/Electron adapters. Proposed architecture, not yet approved.
- WebXR support under Electron is uncertain and must not be promised before real headset testing.

## Source of truth and change management
Explicit fresh team agreements supersede this snapshot. Record any changed contract in `04-DECISIONS.md` with its impact and approvals. Never infer a completed feature from a research document.

## How to receive blocks
Each future user message that describes a piece to implement becomes a numbered entry in `05-BLOCK-REGISTER.md`:
- block ID/title/version;
- literal user requirements and non-goals;
- scenario, data inputs/outputs, interfaces;
- formulas and scientific assumptions (references);
- UI/visualization/event behaviour;
- error handling, performance, security;
- dependencies/owner;
- specific questions and answer log;
- acceptance tests and Codex prompt dependency.
