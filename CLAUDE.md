# CLAUDE.md — Sharkies physics-demo feature branch ONLY

> BRANCH-SCOPED INSTRUCTIONS. Written for Claude Code working on `mokachkasss/Sharkies:feat/physics-demo-v01`. This is NOT a team-wide instruction file. Do not copy or merge this file into `tatabbyi/EVA-Sim:main` without explicit team agreement.

## Mission / expected result
Implement the **approved Sharkies Mars EVA Physics Engine DEMO v0.1**, within the existing offline Electron + React + TypeScript + Three.js RAW Engine. Start with the team's **fixed, preselected Jezero demo site**; the player NEVER selects the landing position. Automatic supported-region selection, richer tasks, 5x5 map rendering, weather, and other enhancements are separately scoped follow-ups.

Approved physics: suited walk + faster suited locomotion, slope-aware velocity AND metabolic work, realistic Mars environmental reference with fixed scenario atmosphere, oxygen stored/consumed in GRAMS from metabolic power, and an authoritative mission-failed state at ZERO grams.

**DO NOT confuse instructions/documentation with completed features.** As initially inspected, the engine has only demo speeds and O2=null; there is no production physics implementation yet.

## Read before coding (actual files, in order)
1. `docs/physics/README.md` and **`docs/physics/NASA-DATA-AND-PRIMARY-SOURCES.md`**.
2. `docs/physics/PHYSICS-DEMO-V01.md` — approved numerical engineering scenario and requirements.
3. `docs/physics/IMPLEMENTATION-RUNBOOK.md` — concrete work plan, edge cases and integration tests.
4. `docs/physics/CODEX-PHYSICS-DEMO-V01.md`, `docs/physics/07-ENGINE-INTEGRATION.md` and `docs/physics/08-TESTS-VALIDATION-AND-REPRODUCIBILITY.md`.
5. `docs/physics/06-RACHEL-RESEARCH-AND-INDEPENDENT-AUDIT.md` and Rachel original `research/02-walking-cost-model.md`.
6. `docs/integration/AI-AGENT-HANDOFF.md`, `docs/integration/RACHEL-VISUALS.md` and `docs/integration/VICTOR-TERRAIN.md`.
7. Current `src/core/{contracts,engine}.ts`, `src/adapters/{world,clock,hud}.ts`, `src/app/App.tsx`, `tests/core.test.mjs`, and renderer/HUD **exports**, never assume a draft interface is implemented.

**Evidence hierarchy:** measured NASA/PDS data ≠ NASA engineering report/reference ≠ Rachel non-NASA composite research ≠ Sharkies demo assumptions. Preserve these categories in source comments, tests and the implementation report. Never represent fictitious suit mass/speed/O2 capacity or grade factors as NASA facts.

## Absolute branch and worktree safeguards
- Before any write: `git status --short`, branch, remotes, current HEAD, fetch/review latest `team/main` if credentials permit. The initially inspected fork base is `c38c5e772388102a9c0571288c2b7210f3c91c97`; team code may be newer.
- Work ONLY in a personal physics feature branch. Never push to, reset, force-update, rebase or merge the team `main`. Never delete user branches, remove files from another contributor, stash/clean/reset/discard unknown local changes, or overwrite a worktree.
- Existing uncommitted modifications must be treated as user-owned. Inspect before editing; if collision cannot be safely resolved, stop and report. Avoid broad mass formatting.
- Source edits permitted: `src/core/contracts.ts`, `src/core/engine.ts`, **new** pure `src/core/physics.ts`, `src/adapters/hud.ts`, `src/app/App.tsx` and `tests/physics.test.mjs`; limited Alex-owned adapter changes only when necessary.
- PROTECTED: Rachel `src/ui/**`, `src/terrain/**`, `src/dev/**`; Victor terrain loader, `public/**` and `pipeline/**`; Nanda `src/sim/cost.ts` and route internals; team `research/**`, `electron/**`, CI, package/tool configuration. Do not change ANY without respective owner's approval.
- Do not enable Rachel's old **litre-based** O2 Leash shader with gram O2 state. HUD: map via **Alex adapter** only.
- Branch-local root files `CLAUDE.md` and `AGENTS.md` are helper instructions. Exclude from final team PR unless team opts in. Preserve them on this working branch until handoff is complete.

## Minimal implementation expectations
- Prefer opt-in fifth physics configuration argument on `createEngine(region,mission,canOccupy?,speeds?,physics?)`; all current callers/tests without physics must work unchanged (3/8 m/s + O2=null).
- Pure unit-aware calculations for mass/weight, directional grade from `HeightProvider.heightAt`, suited walk/fast speeds, exertion and oxygen grams/hour, one fixed-step state integration under existing 60Hz clock. No React, Three.js or renderer-dependent physics.
- User-approved terminal failure: clamp O2 at exactly 0, emit exactly one `mission-failed`, freeze movement and task state until reset. Pause freezes time/gas; unpaused idle burns some gas.
- NOAA/Earth physiology/terrestrial weather must not be misrepresented as Martian observations. Fixed ambient -60C and 635Pa are DEMO SCENARIO; do not label suit/core temperature with this ambient number.
- Workload is TOTAL W (idle 165, walk 293, fast 430, task 350 W as provisional game config). Do not add resting twice. At 293W NASA reference **75g O2/hour** is an EVA analog, not evidence of rated 750g suit tank.
- For emergency demo show clearly labelled TEST remaining O2 (e.g. 2g/750g); don't make normal consumption artificially fast. The user must see changing g/h telemetry during normal activity.
- Keep current task semantics working; no MOXIE recharge. Do not implement all four task animations or map generation in this pass.

## Execution / QA
Implement small slices (pure physics -> engine opt-in -> HUD overlay -> game-over and reset), adding a unit test per slice. Run `npm run typecheck`, `npm test`, `npm run build` and graphical Electron smoke **if graphics available**. Do not claim checks you did not execute. Verify protected-file diff is empty.

Deliver `docs/physics/IMPLEMENTATION-REPORT.md` as a **new report after coding** with true hashes/test outcomes, calibrated vs fictional parameters, before/after behavior, known blockers, reproduction commands and protected file audit. If conflicting current team exports require owner modifications, **stop and report the exact signatures/diff**.

## One-line first action
Read `docs/physics/IMPLEMENTATION-RUNBOOK.md`, inspect real source signatures and current team head, then implement physical computations without touching other contributors.
