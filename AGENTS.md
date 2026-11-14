# AGENTS.md — Codex instructions, physics demo branch

> TEMPORARY ROOT AGENT CONFIG FOR `feat/physics-demo-v01` ONLY. Not intended for automatic merge into team main. Detailed single source of truth is `docs/physics/IMPLEMENTATION-RUNBOOK.md`.

## Goal
Implement the **already approved** Sharkies Mars EVA physics in the real offline Electron RAW Engine: suited walk + fast suit-constrained movement, directional terrain-grade speed and cost, fixed Mars ambient reference, oxygen MASS in grams and consumption from metabolic workload, exactly one failure at 0g oxygen, real HUD integration and tests. **Fixed site selected by the team**, not by user; future random region and visual map are explicitly separate.

## Must read, in this order
- `CLAUDE.md` (same branch-local restrictions apply regardless of agent).
- `docs/physics/README.md`, `NASA-DATA-AND-PRIMARY-SOURCES.md`, `PHYSICS-DEMO-V01.md`, `IMPLEMENTATION-RUNBOOK.md`, `CODEX-PHYSICS-DEMO-V01.md`.
- `docs/physics/06-RACHEL-RESEARCH-AND-INDEPENDENT-AUDIT.md`, `07-ENGINE-INTEGRATION.md`, `08-TESTS-VALIDATION-AND-REPRODUCIBILITY.md`.
- Real `src/core`, `src/adapters`, `src/app` exports, `tests/core.test.mjs` and integration owner docs before coding.

## Worktree safety
- Inspect Git status, branch, remotes, fork HEAD and actual team/main. Treat every uncommitted change as someone else's until understood.
- DO NOT reset, stash, clean, force-push, delete branches, merge to team main or overwrite an owner's edits.
- Allowed edits only: Alex physics/core, Alex HUD adapter and App, additive tests and final implementation report. Tiny Alex adapter edit only if justified.
- PROTECTED: `src/ui/**` / `src/terrain/**` / `src/dev/**` (Rachel), `src/sim/cost.ts` / routing (Nanda), `src/terrain/loader.ts` / `public/**` / `pipeline/**` (Victor), `research/**`, root Electron/build/CI assets. If integration needs protected changes, stop and request owner approval with precise details.
- NASA reference data are NOT permission to claim our configurable values are NASA suit measurements. Always label NASA-REF vs SHARKIES-SCENARIO.
- Do not merge root `CLAUDE.md` and `AGENTS.md` to the team repo without agreement.

## Minimum acceptance
- Opt-in fifth argument or equally non-breaking physics mode in `createEngine`; old 3/8 m/s and null O2 tests continue passing.
- Physically dimensioned O2: NASA BVAD Table 4-76 reference **293 W -> 75 g/h**; explicit DEMO linear scaling and configurable baseline. All units explicit.
- Fixed dt deterministic (60Hz), no renderer/React timers for actual physics, idle O2 drains, pause does not, task billed once, no data/steep slope blocks movement.
- At 0g: fail exactly once, freeze tasks and movement, reset restores. No MOXIE O2 refill.
- HUD visual from app-owned adapter; no changes to Rachel shader (old litres Leash stays off); telemetry g/h with honest scenario labels.
- Add `tests/physics.test.mjs`. Run `npm run typecheck`, `npm test`, `npm run build`. Check `git diff --name-only` against protected paths. Report actual results and limitations.

## Finish
Update `docs/physics/IMPLEMENTATION-REPORT.md` only after code exists and tests have run. Keep code changes reviewable, stop before any shared merge. Copy-paste dispatch prompt is in `docs/physics/CODEX-RUN-PROMPT.md`.
