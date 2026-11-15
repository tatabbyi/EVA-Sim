# Copy-paste prompt for Codex — Physics Engine DEMO v0.1

This file is a reusable dispatch prompt for an agent operating **locally on the current user's checked-out feature branch**. Source of truth: `PHYSICS-DEMO-V01.md` + NASA source registry + `IMPLEMENTATION-RUNBOOK.md`. Do not invent a different scope.

## SEND TO CODEX

You are implementing the Sharkies Mars EVA **Physics Engine DEMO v0.1** in the existing offline Electron/React/Three.js desktop app, not a new prototype. The user has approved all five required physics behaviors. You must implement the code, test it and provide an evidence-backed completion report; do not merely revise docs.

**Preflight:** Inspect `git status --short`, current branch, HEAD, remotes, fork/main and latest team/main. Do not reset/stash/clean/force-push any unknown user work, and do not merge into or push to team main. Work only in the personal `feat/physics-demo-v01` branch or a safe descendant; if team/main moved, examine diffs and adapt without overwriting teammates' edits.

**Read in full before editing:**
- `CLAUDE.md` and `AGENTS.md`, because both contain the same branch-scope protection rules.
- `docs/physics/README.md`, `docs/physics/NASA-DATA-AND-PRIMARY-SOURCES.md`.
- `docs/physics/PHYSICS-DEMO-V01.md` and `docs/physics/IMPLEMENTATION-RUNBOOK.md`.
- `docs/physics/03-EVA-LOCOMOTION-METABOLISM.md`, `04-LIFE-SUPPORT-AND-FAILURE.md`, `06-RACHEL-RESEARCH-AND-INDEPENDENT-AUDIT.md`, `07-ENGINE-INTEGRATION.md`, `08-TESTS-VALIDATION-AND-REPRODUCIBILITY.md`.
- Team integration/ownership docs and actual RAW exports in `src/core/`, `src/adapters/`, `src/app/App.tsx`, `tests/core.test.mjs`. Treat documented draft interfaces as proposals until exports are inspected.

**Write only Alex-owned source and tests:** a pure, unit-aware `src/core/physics.ts` model; minimal opt-in changes in `src/core/{contracts,engine}.ts`; `src/adapters/hud.ts` and `src/app/App.tsx`; new `tests/physics.test.mjs`; narrow Alex adapter if absolutely necessary. **Protected from any edit:** Rachel `src/ui/**`, `src/terrain/**` and `src/dev/**`; Victor terrain/`public/**`/`pipeline/**`; Nanda `src/sim/cost.ts`/planner; `research/**`, Electron configs, assets and CI. If a teammate-owned API must change, stop and report exact incompatibility rather than modifying their files.

**Implement:**
1. Fixed demo region/shuttle site; **player NEVER chooses landing point**. Future auto-random region and detailed top-down map are out of scope.
2. Suited movement: walk ~0.75 m/s, faster ~1.15 m/s in physics-enabled mode; directional terrain grade and carried mass alter both attainable speed and **total metabolic workload**. Block steep/no-data moves honestly and charge idle while stationary. Legacy no-physics callers remain 3/8 m/s, O2=null.
3. Named scenario profile: Mars g 3.711m/s², ambient -60°C, 635Pa, CO2 ~0.953; assumed 80kg astronaut + **fictional 65kg** Mars suit, assumed 750g O2 supply, low 150g / critical 75g, idle 165W, walking 293W, fast 430W, task 350W. **These are configurable DEMO assumptions, not NASA-certified suit specs.**
4. NASA BVAD NTRS ID **20180001338**, Table 4-76: reference **293W -> 75 g oxygen/hour** at RQ 0.9. Use a clearly labelled simplified linear g/h-from-W model, no litres/grams confusion, no NASA overclaim. See exact equations/test vectors in `IMPLEMENTATION-RUNBOOK.md`. One authoritative 60Hz simulation step, no physics in React/Rachel shader.
5. Idle/walk/fast/active stationary task bill exactly **one TOTAL power** per time step. Pause freezes. Remaining O2 is clamped between 0 and capacity. If O2 reaches exactly 0g, transition once to `mission-failed` and stop movement/tasks until reset. A clearly marked **O2 EMERGENCY TEST** reduced-start scenario must demonstrate this in live UI; normal stock/burn unchanged.
6. Map state into the existing Rachel `HelmetHud` **through Alex's HUD adapter**; show true percentage and current g/h, current slope/power, prioritize fail/low alerts. Ambient outside temperature must NOT be mislabeled internal suit temperature. **Do not enable/edit Rachel's litres-based terrain O2 Leash**. MOXIE remains scientific experiment, NEVER refills suit oxygen.
7. Maintain the existing two demo task semantic actions; don't implement new animations, generic map generator, or full suit climate/thermal system. Preserve engine tests unchanged wherever possible.

**QA is mandatory:** add pure math, synthetic directional slope, no-data, frame-step determinism, idle/pause, task workload, 0g failure exactly once, blocked movement, reset, and backward-compat tests. Run `npm run typecheck`, `npm test` and `npm run build`; smoke/GUI check only where supported. Ensure no protected files appear in diff. Record truthful results.

**Deliverables:** reviewable changes only on personal branch, a new `docs/physics/IMPLEMENTATION-REPORT.md` with test evidence, actual changed files, NASA-vs-scenario distinctions, demo launch/emergency instructions and any genuine blockers. Don't merge to team main, don't publish installers without approval. Root `CLAUDE.md` and `AGENTS.md` are BRANCH-ONLY and must not be introduced to team main without approval.

Start by reading the sources and inspecting actual signatures, then implement the smallest complete working and testable physics vertical slice.
