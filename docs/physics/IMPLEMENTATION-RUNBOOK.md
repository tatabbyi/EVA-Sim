# Implementation Runbook — Physics Engine DEMO v0.1

**Contract:** `PHYSICS-DEMO-V01.md` + `01-PROVENANCE-AND-DEMO-PARAMETERS.md`.
**Scientific sources:** `NASA-DATA-AND-PRIMARY-SOURCES.md`.
**Agent bootstrap:** root `CLAUDE.md` (Claude) and `AGENTS.md` (Codex).
**Source baseline for the inspected fork:** `c38c5e772388102a9c0571288c2b7210f3c91c97`; repo team main can advance. **Status: NOT YET IMPLEMENTED; follow this plan, don't report success until tests pass.**

## 0. Target demo and exclusions
The fixed scene starts at a team-chosen Jezero shuttle point. The player walks or moves faster in a pressurized-suit scenario, encountering slopes. Terrain affects both speed and modeled metabolic O2 demand. The O2 stock is in grams; HUD displays stock fraction and current rate in g/h. Active science work consumes O2 and can complete via existing semantic task events. Depletion to precisely 0g fails the mission permanently until reset. Fixed outdoor Mars conditions can appear in the app as **AMBIENT / OUTSIDE**.

The app has 3 story stages: capsule setup -> surface EVA -> return home. Rachel owns story visuals and task animations. THIS PR covers only **Surface EVA physics** and works with the current simple task screen. Do not build a landing picker, pseudo-random terrain, topo screenshot, full extraction cutscene, new task UI or medical thermal system.

## 1. Preflight / safe base selection
1. `git status --short`, `git branch --show-current`, `git remote -v`, record current SHA. User or teammate unstaged changes must be preserved.
2. Identify actual `origin` fork and `team` = `git@github.com:tatabbyi/EVA-Sim.git` (if configured). Fetch when authorized; if latest team/main differs, **inspect differences before adapting**. Do not reset or force-push any shared branch.
3. Work under `feat/physics-demo-v01`, or an explicitly named personal descendant with new team-main base + this branch's docs safely reconciled. Do not accidentally implement against a stale Rachel shader/HUD version.
4. Read root agent files, full `docs/physics/PHYSICS-DEMO-V01.md` and NASA bibliography. Read `src/core/engine.ts`, `contracts.ts`, `src/adapters/world.ts`, `clock.ts`, `hud.ts`, `src/app/App.tsx`, `tests/core.test.mjs`, `docs/integration/RACHEL-VISUALS.md`. Actual imports/exports override old draft pseudo-APIs.
5. If working tree dirty in a file you would edit: compare changes and **do not overwrite**; either isolate independent files or request a collision decision. No cleanup `git reset --hard`, `git clean`, `git stash`, `git push --force`.
6. Document preflight status in the completion report, including the actual branch SHA, not just the frozen source-baseline SHA.

## 2. Owner boundaries / allowed files
| Scope | Owner | Permission |
| --- | --- | --- |
| `src/core/contracts.ts`, `engine.ts`, new `physics.ts` | Alex | add minimal v0.1 physics contract & deterministic implementation |
| `src/adapters/hud.ts`, `src/app/App.tsx` | Alex | turn on physics and map authoritative state into existing UI |
| `src/adapters/world.ts` and `scene.ts` | Alex adapter boundary | only minimal necessary changes, **no terrain format changes** |
| `tests/physics.test.mjs` + relevant tests | Alex | add precise fixture + regression, preserve legacy tests |
| `docs/physics/IMPLEMENTATION-REPORT.md` | Alex | created after implementation |
| `src/ui/**`, `src/terrain/**` except `loader.ts`, `src/dev/**` | Rachel | **NO modifications** |
| `src/terrain/loader.ts`, `public/**`, `pipeline/**`, source coords | Victor | **NO modifications** |
| `src/sim/cost.ts`, route/planner modules | Nanda | **NO modifications** |
| `research/**`, Electron config, dependencies/CI and unrelated demos | Team | **NO modifications** |

The old **Rachel shader O2 Leash** uses litres; engine physics uses grams. **Keep it disabled** and do not update shader or Nanda's route file in this task.

## 3. Fixed scenario profile, science traceability
**Reference vs assumptions:** NASA [N01] Table 4-76 has **293 W / 75 g/h human metabolic oxygen use** for an EVA analog; this does **not** certify our exact movement, Mars suit, 750g oxygen stock, 65kg suit, high-gradient coefficients or pressure assumptions. NASA [N02] 2026 Mars suit mass report is preliminary and can be cited as a boundary/limitation, not as the source of our 65kg suit.

~~~text
profileId = mars-eva-engineering-demo-v1
Mars gravity        3.711 m/s²       (reference constant)
Ambient temp        -60°C           (fixed DEMO condition; not measured MEDA sol)
Ambient pressure    635 Pa          (fixed DEMO condition)
Ambient CO2         0.953 fraction  (fixed DEMO approximation)
Astronaut body      80 kg           (scenario)
Hypothetical suit   65 kg           (scenario)
Walk base speed     0.75 m/s        (scenario)
Faster EVA speed    1.15 m/s        (scenario; user input still "run" in old type)
Idle total power    165 W           (scenario)
Walk total power    293 W           (NASA reference power, simulated mode)
Fast total power    430 W           (scenario)
Task total power    350 W           (scenario; separate per-task rates later)
Nominal O2 stock    750 g           (scenario; not NASA rated cylinder)
Low O2 warning      150 g           (scenario; 20%)
Critical O2         75 g            (scenario; 10%)
Max movement grade  25°             (scenario safety/mobile heuristic)
Grade sampling      1 m            (scenario numerical choice; 4m DEM does NOT resolve real 1m detail)
~~~

**Equations, dimensions and derivation**:
~~~text
totalMassKg = astronautMassKg + suitMassKg + carriedEquipmentMassKg
weightN = totalMassKg * 3.711
signedGrade = (heightAt(front) - heightAt(back)) / horizontalProbeMetres
slopeDeg = atan(signedGrade) * 180 / pi
payloadFactor = 1 + 0.5 * carriedMassKg / (astronautMassKg + suitMassKg)
slopeWorkFactor = clamp(1 + 3*signedGrade + 6*signedGrade^2, 0.7, 2.5)
powerW = powerIdleW + max(0, powerModeW - powerIdleW) * payloadFactor * slopeWorkFactor
speedFactor = clamp(1 - 0.018*max(0, slopeDeg) - 0.005*max(0, -slopeDeg), 0.35, 1)
speedMps = baseModeSpeedMps * speedFactor / payloadFactor
o2RateGramsPerHour = powerW * 75 / 293        // NASA pair, SHARKIES linear-extension assumption
o2BurnGrams = o2RateGramsPerHour * dtSeconds / 3600
energyIncrementJ = powerW * dtSeconds
O2next = max(0, O2now - o2BurnGrams)
~~~
**Critical:** `powerModeW` is **total**, already including rest; DO NOT add idle 165W to 293W walk. For blocked/idle movement, `powerW = 165W` independent of grade. For task status "active" with stationary astronaut, `powerW = 350W`, regardless of input; no double walk+task charge. Downhill is direction-dependent and might be easier but remains *scenario heuristic*, not calibrated NASA suit biomechanics.

## 4. Exact implementation stages and success gates

### Stage A — Pure physical model (no app changes yet)
- Add `src/core/physics.ts` exporting scenario type/object, input validation and pure deterministic calculators: weight, signed terrain slope, activity power, speed, `gramsPerHour(powerW)` and O2/energy integration. Use SI and no renderer imports.
- Validate `heightAt` exists/returns finite height at required positions; invalid front/back or next footfall -> block move, no fabricated zero-height.
- ±25° applies to attempted direction only. Reject a steeper or unsupported move. Do not use terrain RGB normals for ground physics.
- Validate masses, dt, gas capacity and coefficients finite/nonnegative; a zero oxygen stock is **valid depleted state** not missing data.
- **Gate A:** pure tests: 293W=>75g/h; 165W=>42.235...g/h; 430W=>110.068...g/h; weight at 145kg=>538.095N; +/-10° slope shows asymmetric power/speed; null terrain correctly invalidates step; no NaN outputs.

### Stage B — Opt-in existing engine integration
- Extend `createEngine(region, mission, canOccupy?, speeds?, physicsOptions?)` or another **backward-compatible opt-in**; do not change default 4-argument behavior or legacy old tests: 3m/s walk/8m/s run, `oxygenGrams:null` when physics off.
- Physics-enabled snapshot adds optional quantitative telemetry (metabolic W, O2 g/h, energy J, grade degrees, carried kg/weight N), and mission status `active|failed`; optional properties must remain compatible with legacy source consumers. Copy/freeze state at publish as before.
- Start physics mode at 750g/750g normal. Fixed carriedMassKg input is acceptable for short demo; do not invent NASA item-by-item mass source, leave extensible future inventory.
- On each `engine.step(dt)` (dt 0..0.25; fixed clock usually 1/60): choose **actual** movement mode first based on accepted step and task state; do not charge attempted running if movement blocked. Integrate gas/time/energy exactly once. Freeze all updates on pause/failure.
- **Task active policy for this sprint:** a task already marked active is a **stationary** science-work state; prevent locomotion until finish/reset. Existing task semantic events must fire once as before, no new task timing engine or animation auto-completion. When idle unpaused, even not moving, oxygen drains.
- **Hard fail atomicity:** if O2 is exhausted during a tick, clamp to precisely 0, status failed, emit exactly one mission-failed reason oxygen-depleted. No post-fail input/tasks/route updates or further time progression; only reset accepted. Ensure last tick never moves past the point where consumable was exhausted (optional partial-dt split if needed for correctness; document choice and test). Reset restores initial mission tasks, O2, time, movement input and warnings; no event spam.
- **Gate B:** full `tests/core.test.mjs` unchanged and passing; new determinism, task, fail/reset, blocked/no-data and immutability tests passing.

### Stage C — App + HUD integration
- In `src/app/App.tsx` instantiate the same existing RAW engine with real `world.heights.heightAt` injected into physics options and normal profile. No second scene, renderer or time loop.
- In `src/adapters/hud.ts` convert O2 grams/capacity to clamp 0..1 percentage; priority: **failed > critical (<=75g) > low (<=150g) > existing boundary warning**.
- Show current g/h, useful number of decimals for a short demonstration, current slope and total metabolic watts in **Alex-owned** debug/info area. Must show changes immediately when switching gait even though stock changes slowly; do not lie about gas disappearing quickly.
- Show **OUTSIDE: -60°C / 635 Pa** only separately labelled as ambient data. Keep Rachel `TEMP` internal unknown unless approved. Leave Rachel `src/ui/HelmetHud.tsx` / `src/terrain/material.ts` unchanged and O2-Leash disabled.
- Add a visually explicit switch/entry **TEST / EMERGENCY O2** with reduced **remaining** O2 but full 750g capacity. Have a reliable UI path to revert/reset to full normal profile; do not silently modify normal gas burn rates.
- **Gate C:** normal scene loads, existing controls work, HUD O2 is real, status failure is visible, no errors in console, emergency and reset demo understandable.

### Stage D — Validation, evidence and clean PR handoff
- Implement **tests/physics.test.mjs** with synthetic small grids and explicit numerical tolerances. Preserve normal existing tests/snapshots, no flaky renderer timing.
- Run `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke` if supported. Record actual command exit codes. If WebGL2 blocked in hosted Linux, report it rather than claiming GUI pass.
- Validate using normal + emergency path in actual Electron GUI if available.
- `git diff --name-only <team-base>...HEAD` (or pinned main SHA) must show **zero owner-protected source edits**. If branch is rebased, compare against its actual team base.
- Write `docs/physics/IMPLEMENTATION-REPORT.md`: implementation SHA, exact file list and diff, model formulas / scenario markers, tests and GUI status, QA steps, unresolved source/terrain problems.
- Commit to the personal feature branch. **Do not merge the team main and don't create team-wide agent instructions**. For eventual team PR, create a clean integration branch containing only approved implementation/docs; keep root branch-only `CLAUDE.md` and `AGENTS.md` out of team main unless team explicitly wants them.

## 5. Acceptance test matrix
| Case | Expected |
| --- | --- |
| no-physics old engine | raw 3m/s walk, 8m/s run, O2 null, existing unit tests pass |
| physics flat walk | ~0.75m/s, total 293W, O2 rate 75g/h, 1min consumes 1.25g |
| physics faster gait | ~1.15m/s, power 430W, rate 110.068...g/h (no gradient/payload) |
| idle | no travel, 165W, oxygen decreases if not paused |
| +10deg vs level | slower travel, higher expenditure; directional grade positive |
| same -10deg | grade negative, distinct direction and workload; not automatically faster than baseline |
| beyond ±25deg or missing height | move rejected, idle metabolic charge persists |
| extra 10kg load | weight 575.205N, more effort, lower speed than no payload |
| paused | O2, energy, time frozen |
| active stationary task | only one total task power (350W nominal), no movement while active |
| low and critical | distinct non-spamming warning states; normal HUD fractions truthful |
| O2 reaches 0g | exactly one failure event, no negative gas, further input/task/clock steps rejected until reset |
| reset | all active mission state incl. gas and tasks restored; state snapshot immutable |
| MOXIE task | never changes suit O2 positively; electric device W not human metabolic W |
| emergency QA mode | plainly labelled lower remaining stock, true 750g capacity; no secret time acceleration |

## 6. Safety / scientific red flags
- No source metadata to prove current processed game 2m/4m elevation is from exact USGS Jezero DTM: see NASA registry N12; do not claim lineage.
- 1m probe with 4m DTM is interpolation, not 1m empirical resolution. Profile option may be improved later with Victor.
- NASA BVAD report Table 4-76 is a **reference at one workload and RQ**, not a linear Mars law or real gas-tank capacity.
- Current fictional 65kg suit ≠ a measured NASA Mars suit; NASA 2026 design study preliminary ~104kg starting maximum is context, not endorsement.
- User-required 0g **mission failure** ≠ instantaneous medical death model.
- Do not generate "survival odds" by randomly drawing unsupported event probabilities from Rachel's earlier research without user scope approval.
- Any inability to simulate a visual terrain tile properly is a separate Victor/provider integration issue; physics must never hide it by fabricating flat heights.
