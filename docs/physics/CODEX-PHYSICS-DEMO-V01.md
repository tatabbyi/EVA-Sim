# CODEX TASK — Sharkies Physics Engine DEMO v0.1

You are working in the private GitHub fork `mokachkasss/Sharkies` of `tatabbyi/EVA-Sim`, in the **Alex-owned physics/engine integration scope**. User-approved physics choices are recorded in **`docs/physics/PHYSICS-DEMO-V01.md`**. **Read that entire specification before coding.**

## Objective
Ship a physics-enabled **offline Electron Surface EVA demo**, building on actual RAW Engine v0.1. Implement plausible Mars suited movement, signed terrain-grade effects, task/idle/walk/fast metabolic workload, physically dimensioned O2 consumption in **grams**, HUD telemetry/warnings, and a **hard failure at 0 g O2**. Keep the existing app and Rachel's visual components functional. No new renderer, terrain algorithm, map generator or AI planner.

## Source ownership: mandatory safety contract
- Allowed to edit: `src/core/contracts.ts`, `src/core/engine.ts`, **new** `src/core/physics.ts`, `src/adapters/hud.ts`, `src/app/App.tsx`, tests under `tests/`, and (only if unavoidable) narrowly scoped Alex-owned adapters.
- **PROTECTED: do NOT modify or delete** `src/ui/**`, `src/terrain/**`, `src/dev/**`, `src/sim/cost.ts`, `src/walk/**`, `src/map/**`, `src/houston/**`, `public/**`, `pipeline/**`, `research/**`, team CI, assets, electron/, and any team contributor's owned code.
- Do not reset working trees or force-update protected/shared refs. Use a **separate personal feature branch** and publish a PR/hand-off; do not merge team main yourself.
- If Rachel's current API differs from the fork baseline, inspect first and adapt **only Alex-owned adapters**, or stop and document a needed owner approval.

## Preflight (strict)
1. `git status --short`, `git branch --show-current`, `git remote -v`, `git fetch team main` if authorized, `git fetch origin`.
2. Confirm current fork/main and team/main heads. The documented inspected baseline is `c38c5e772388102a9c0571288c2b7210f3c91c97`, but new team changes may exist. Work on `feat/physics-demo-v01` or a new feature branch from a newer team main with these spec docs cherry-picked, without destroying pending local user changes.
3. Read: `docs/physics/PHYSICS-DEMO-V01.md`, `docs/integration/README.md`, `docs/integration/RACHEL-VISUALS.md`, `docs/integration/VICTOR-TERRAIN.md`, `src/core/{contracts,engine}.ts`, `src/adapters/{world,clock,hud}.ts`, `src/app/App.tsx`, `tests/core.test.mjs`, `research/02-walking-cost-model.md`. Verify real exports before changing TypeScript.

## Implement: small, auditable slices
A. **Pure physics** in `src/core/physics.ts`: named `mars-eva-engineering-demo-v1` profile and units, input validation; gravity/weight calculations, directional slope from existing heightAt along intended direction, suit-constrained movement and task/idle/walk/fast metabolic rates. All numeric defaults classified as NASA/ESA reference vs scenario assumption. Test pure functions.
B. **Engine integration**: backward-compatible opt-in fifth argument (or equivalent no-breaking signature) to `createEngine`. Legacy calls preserve speeds 3m/s/8m/s and null gas, so old tests still pass. Physics-enabled calls start with 750g O2 (or explicitly labelled QA emergency override), 150g reserve and 75g critical, with actual astronaut load. Advance in `step(dt)` under existing fixed 60Hz clock, never renderer time. No gas during pause. No negative gas. High grade/no-data blocks movement rather than inventing height; idle consumption continues.
C. **Mission failure**: state+event exactly once at 0g; disable input/tasks/movement once failed; reset restores initial state, clock semantics and events. O2=0 not a fake low alert; it is mission-failed.
D. **HUD adapter**: map current remaining/capacity to honest O2 display and alert priority. Show consumption g/h in a minimal Alex-owned overlay if appropriate. Do not confuse environmental -60C with suit-body internal temperature. No edit to Rachel's UI/shader and no litres/grams API mismatch.
E. **Demonstration hook**: a conspicuously labelled, opt-in, test-only `O2 EMERGENCY DEMO` scenario (e.g., 2g starting stock with unchanged true 750g capacity), used to visibly prove zero-O2 mission failure without faking normal EVA physiology or speeding the simulation globally. Keep default scenario nominal. Keep both current demo task events working.
F. **Tests and QA**: add `tests/physics.test.mjs`. Preserve `tests/core.test.mjs` and other existing tests. Run `npm run typecheck`, `npm test`, `npm run build`; if a graphical desktop environment is actually available, run `npm run smoke` and verify HUD O2 and failure overlay. No CI/integration/release assertions without evidence.

## Required invariants
- `293 W -> 75 g/h O2` NASA analogy: all rates linear in *total metabolic watts* and dt, idle charged exactly once.
- `O2_remaining >= 0`, `O2_remaining <= O2_capacity`, O2 strictly decreases when unpaused and active, high load increases hourly O2 rate.
- Deterministic fixed-dt state; same simulated duration => same stock within numerical tolerance.
- State snapshot remains immutable, reset is exact, no side effects in React render or physics calculation.
- Coordinates local metres x east z south, `heightAt` returns metres or null, no synthetic height beyond data coverage.
- `task-started/task-completed` events preserved; no task-completion logic secretly moved into visual animations.
- Mars constants fixed for demo; label suit/consumables and mobility multipliers as engineering scenarios, not NASA-certified Mars equipment.
- `src/terrain/material.ts` O2 Leash stays disabled: it expects litres and is not compatible with gram-based life-support.
- Player does NOT select landing location; fixed demo point only. Random selected location is a future feature.

## Deliverables at completion
1. A small, reviewable commit or PR in the user's fork with strictly necessary production source and new tests.
2. A concise `docs/physics/IMPLEMENTATION-REPORT.md`: files changed, formulas with units/provenance, numerical examples for idle/walk/fast/uphill, tests actually run and their results, HUD/failure proof, any explicit science/model approximations, known issues.
3. A short **git diff --stat** and confirmation of zero changed protected files. If a third-party change is necessary, STOP rather than silently editing it.
4. Working exact commands to run normal and emergency demo in current Electron desktop setup. No unverified success claims.

## Out of scope
Random region/landing selection, tiled 5x5/10x10 top-down map renderer, astronaut suit heat-transfer physics, dynamic atmospheric systems, accurate NASA hardware mass model, metabolic oxygen leak/vent model, full Nanda routing or Rachel animations rewrite, success/end cutscenes, procedural Mars generation.

**First action:** inspect code, reconcile signatures and implement the smallest verifiable physics slice. Do not ask for unneeded reconfirmation of the five already approved physics decisions.
