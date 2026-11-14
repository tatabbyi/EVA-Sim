# Sharkies — Physics Engine DEMO v0.1
**Status:** APPROVED PRODUCT BEHAVIOUR; engine implementation PENDING. **Date:** 2026-11-14. **Owner:** Alex (engine / app integration). **Reference baseline:** `c38c5e772388102a9c0571288c2b7210f3c91c97` (`mokachkasss/Sharkies:main`). **Target branch:** `feat/physics-demo-v01`.

## 0. Demo boundary
Three game stages remain `Capsule Setup -> Surface Mission -> Return Home`. **Player never chooses a landing point.** For this demo the terrain and shuttle are preselected by the team, with eventual automatic/random **supported** region selection deferred. The physics applies to the surface EVA; capsule and cutscene visual delivery belongs to Rachel. No map generator, terrain refactor, procedural landing, planet-wide random access, new task visuals, weather system, or polished mission narrative in this change.

Prioritize physics integration in the app, then ONE existing Rachel task visualization, then map rendering in a **separate** task/PR. Do not delay physics for unrelated blockers.

## 1. User-approved decisions (not suggestions)
- **P-01 suited movement:** controlled walk and faster suited movement, with speed limitations from the suit; no 3 m/s walk or 8 m/s sprint in Physics Mode.
- **P-02 oxygen:** internally store grams of O2, calculate physical depletion from human metabolic power and a named engineering suit **scenario**; Rachel HUD displays normalized percentage, with informative g/hour telemetry.
- **P-03 terrain:** directional uphill/downhill slope influences both attainable speed and metabolic workload using the actual terrain height provider.
- **P-04 Mars environment:** show scientifically grounded Mars gravity, external atmosphere/temperature/pressure as **constant conditions of this one scenario**; no fake live weather or internal suit thermal physics.
- **P-05 oxygen failure:** remaining O2 reaches exactly 0 g -> immediately and permanently fail the active mission until reset. Stop movement, task progression and gas consumption; emit one semantic failure event.
- Previous confirmed rules still apply: one astronaut profile; initial gear only for selected tasks; load changes with tasks when inventory system exists; core adds carried sample, depot removes deposited samples, selected MOXIE/drill/abrasion tool return home; MOXIE NEVER supplies EVA suit oxygen. Route is guidance; player movement not confined to route, but inside playable bounds.

## 2. Verified repository reality
- Core domain: `src/core/contracts.ts`; `EngineSnapshot.resources.oxygenGrams/oxygenCapacityGrams` currently `null`. `EngineSnapshot.player.movementMode: idle|walk|run`.
- `src/core/engine.ts` offers `createEngine(region, mission, canOccupy?, speeds?)`, `dispatch`, `step(seconds)` with 0..0.25 second input, immutable snapshots, events, pause/resume/reset. Existing `DEMO_MOVEMENT` 3 m/s walking, 8 m/s running must be preserved for **legacy callers/tests** until separately retired.
- `src/adapters/clock.ts`: fixed 1/60 second, drops long/focus gaps. Physics must be integrated under this same deterministic clock, not animation frames.
- `src/adapters/world.ts`: `HeightProvider.heightAt(x,z):number|null` in local meters; x east, z south, y elevation. Ground coverage/no-data matters.
- `src/adapters/hud.ts`: app-owned adapter to Rachel's `HelmetHudProps`; existing O2 is `N/A`, zero-fraction unknown. Rachel's `src/ui/HelmetHud.tsx` is **owned by Rachel**.
- `src/terrain/material.ts`: Rachel-owned shader; its optional O2 Leash is in **litres**, with outdated fixed-grid assumptions. RAW disables it. **Do not feed grams to those uniforms, enable the Leash, or edit shader.**
- `src/sim/cost.ts`: owned by **Nanda**, exports placeholders for route cost; **do not modify/import as a calibrated EVA model**.
- `src/app/App.tsx`, `src/adapters/hud.ts`, `src/core/*`: Alex's integration boundary. Use existing app/scene; do not add a second game loop or renderer.
- Existing `tests/core.test.mjs` verifies old demo movement and `oxygenGrams===null`; do not break its backward compatibility. Node tests use .ts import via Node 24+ type stripping.

## 3. Model provenance: verified physics vs scenario assumptions
**References:**
- Mars gravity and average environment: https://www.esa.int/ga/articles/about-us/directorates/science/mars-express/facts-about-mars (g ~3.711 m/s2; atmospheric pressure ~6.35 mbar; mean temperature ~-55 C).
- NASA astronaut life-support baseline: https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf (Table 4-76: metabolic 293 W, O2 use 0.075 kg/hour with RQ 0.9; lunar/EVA reference, NOT validated Mars EVA rate).
- NASA newer caveat re Mars suit mass: https://ntrs.nasa.gov/citations/20260003038 (modern lunar xEMU mass is not a feasible direct Mars suit baseline).
- Existing research: `research/02-walking-cost-model.md` (Minetti/Tobler-based **composite extrapolation**), and archived `docs/alex-core/12-RACHEL-PHYSICS-AUDIT.md` (limitations). Do NOT hard-code the old polynomial into suit running or conflate net walking cost with total metabolic watts.

**Values below are configurable DEMO ENGINEERING ASSUMPTIONS, not certified NASA equipment specs:**
```text
profileId               = "mars-eva-engineering-demo-v1"
gravityMps2             = 3.711
ambientPressurePa       = 635
ambientTemperatureC     = -60
co2VolumeFraction       = 0.953
astronautMassKg         = 80     (scenario assumption)
suitMassKg              = 65     (fictional light Mars suit mass, scenario assumption)
baseWalkSpeedMps        = 0.75   (scenario, not NASA-calibrated gait)
baseFastSpeedMps        = 1.15   (faster suited motion; no high-speed sprint)
powerIdleW              = 165    (TOTAL power)
powerWalkW              = 293    (TOTAL power; NASA analog reference)
powerFastW              = 430    (TOTAL power, transient concept)
powerTaskW              = 350    (TOTAL power; task-type defaults may override later)
oxygenCapacityGrams     = 750    (assumed demo-suit usable stock; NOT NASA certified)
oxygenReserveGrams      = 150    (20% initial warning/reserve boundary)
oxygenCriticalGrams     = 75     (10% critical warning)
maxDemoSlopeDeg         = 25     (scenario mobility cut-off, NOT a medical NASA safety limit)
slopeProbeMetres        = 1      (engineering sampling length)
```
NO ambient temperature-to-O2 penalty, no oxygen leak, no CO2 scrubber dynamics, no heat-control power deductions and no self-oxygen refill. Those are unmodeled, not physically absent.

**Mass and gravity:** `totalMassKg = 80 + 65 + carriedItemsKg`; `weightNewtons = totalMassKg * 3.711`. Mass stays the same on Mars; gravitational force changes. Payload affects movement and exertion via **declared suit/scenario coefficients**, not `0.38 * earthly oxygen` or `P proportional to mass` blindly.

**Reference-consistent oxygen conversion (first-pass):**
```text
o2RateGramsPerHour = metabolicPowerWatts * (75 / 293)   // NASA analogy calibrated at 293W
deltaO2Grams = o2RateGramsPerHour * dtSeconds / 3600
o2Next = max(0, o2Now - deltaO2Grams)
energyNextJ = energyNowJ + metabolicPowerWatts * dtSeconds
```
NASA's 75 g/hour is a metabolic **reference**, not necessarily total suit oxygen inventory loss; external gas leakage is omitted. Never equate a litre to a gram; no external atmosphere O2 breathing. Rate at 293 W = 75 g/h. Make helper pure/unit-tested.

**Activity and slope (transparent simplified engineering response, NOT a validated Mars gait law):**
```text
P(mode) = TOTAL_WATTS[idle/walk/fast/task] from profile
signedGrade = (heightForward - heightBackward) / probeLength
slopeDeg = atan(signedGrade) * 180 / PI
uphill -> slower and more metabolic load; downhill -> distinct directional response
payloadKg = max(0, carriedMassKg)
payloadFactor = 1 + 0.5 * payloadKg / (astronautMassKg + suitMassKg)
slopeWorkFactor = clamp(1 + 3 * signedGrade + 6 * signedGrade^2, 0.7, 2.5)
P_actual = P_idle + max(0, P(mode)-P_idle) * payloadFactor * slopeWorkFactor
speedFactor = clamp(1 - 0.018*max(0,slopeDeg) - 0.005*max(0,-slopeDeg), 0.35, 1)
speed = baseGaitSpeed(mode) * speedFactor / payloadFactor
```
- When **idle**: `P_actual=P_idle` and `speed=0`, but oxygen still drains with simulation time. When **task active**: `P_actual=P_task` (no duplicate idle charge), and task workload must not be charged twice in gameplay code; defer task-dependent power tuning.
- A decline/downhill is permitted to be less energetically costly than level, but speed is not permitted to exceed the suit baseline. No simulation of jumps/fall damage.
- `slopeProbeMetres=1` is for repeatable signed grade along intended horizontal direction; use bilinear `heightAt` with symmetric probes where valid. If probe or target location falls outside supported terrain or into no-data, reject that attempted movement **without fabricating height**; idle metabolism still applies. Stay in playable bounds.
- If `abs(slopeDeg)>maxDemoSlopeDeg`, reject attempted motion (declared DEMO mobility constraint). Do NOT reuse Rachel's 20/25 degree shader colors as certified physical thresholds.
- If input direction zero or blocked, actual movement mode is `idle` regardless of held `run`.
- During task-active state, for first demo expose current task workload state without implementing a new task timing engine or overriding Rachel's visual animation. Prevent simultaneous locomotion-based and task-based oxygen charges.
- Load must be injectable/configurable; real inventory transfers happen in later work, not inside terrain or HUD. The current demo's selected two tasks may use one clearly labelled assumed payload value, not inventory of all four tasks.

**Smoothing:** avoid instant gait changes causing unrealistic high-frequency toggling if practical, but do NOT risk introducing acceleration and jitter into first three-hour demo. Keep deterministic results, one authoritative dt, minimum path over-consumption, finite outputs.

## 4. State and event contract (minimum additive change)
Recommend a **backward-compatible, opt-in physics config in a fifth `createEngine` argument**, keeping existing positional arguments and default demo behavior untouched. Codex may choose equivalent opt-in after verifying current usages:
```ts
type DemoPhysicsOptions = {
  profile: MarsEVAEngineeringProfile;
  heightAt: (x:number, z:number) => number|null;
  carriedMassKg: number;             // fixed assumed payload in first demo; future inventory provider
  initialOxygenGrams?: number;        // for an EXPLICIT labeled emergency QA scenario
}
```
A separate `src/core/physics.ts` or `src/core/physics/*` pure TS model is preferred; renderer, DOM, React, Electron, network, and camera imports are prohibited inside physics/domain logic.

In a **physics-enabled** snapshot:
- Keep `resources.oxygenGrams` and `oxygenCapacityGrams` as the **single authoritative** O2 stock, both finite. Do not make oxygen negative or > capacity.
- Add minimal read-only telemetry: `oxygenRateGramsPerHour`, `metabolicPowerWatts`, `energySpentJ`, `currentSlopeDeg`, `carriedMassKg`, `weightNewtons`, and mission `status:'active'|'failed'` (exact property names can be adapted). If no physics mode, legacy nullable resources remain.
- Emit exactly one semantic `mission-failed` with `reason:'oxygen-depleted'`; consume no further input or task-finish commands after failure. `reset` restores O2, task states, mission status, time and movement.
- `pause` freezes O2, energy and time. `resume` works unless failed. Idle under unpaused simulation consumes oxygen. No secondary interval/RAF.
- During O2 depletion within a single timestep: clamp exactly to zero, set failed atomically; no negative stock, no repeated failure event or movement afterward. Explicitly define ordering for movement/task energy and depleted state.
- Resource events/warnings are derived from authoritative values: `O2 <= 150g` low/reserve, `O2 <= 75g` critical, `O2 = 0g` failed. Prevent alert spam (transitions only).

## 5. HUD, visualization and owners
- Only adapt Alex-owned `src/adapters/hud.ts` to return real `o2.fraction` clamped 0..1, meaningful `o2.value` percent and alert priority `mission failed > critical O2 > low O2 > boundary`. For first demo, use concise user-visible O2 consumption telemetry (g/h) in an app-owned text/overlay if Rachel's existing HUD cannot represent it.
- `temperature` in Rachel HUD should **not** silently be the ambient -60 C if the suit thermometer means internal suit temperature. Until Rachel confirms presentation, keep suit TEMP unknown; show a separate explicitly labelled `OUTSIDE / AMBIENT -60 C` stat in Alex's own panel if needed.
- Keep Rachel-owned `src/ui/**`, `src/terrain/**`, `src/dev/**` byte-for-byte unchanged, including `material.ts` and `HelmetHud.tsx`. Do not alter animations or original preview.
- Keep Nanda-owned `src/sim/cost.ts`, all route/planner files, Victor-owned `src/terrain/loader.ts`, `public/grids/**`, `public/tiles/**`, `pipeline/**` and team-owned research untouched.
- Full scene mesh/LOD and map rendering are deferred; verify physics works with today's `loadDemoWorld()` and survives future Victor `HeightProvider` injection.

## 6. Tests and acceptance gates
A `tests/physics.test.mjs` should prove:
1. NASA baseline: `293 W -> 75 g O2/h`; `dt=3600 -> 75 g` (unit tests, not sim step; engine step remains <=0.25s).
2. Constant mode over equal simulated time is independent of caller frame grouping (1/60 vs 1/30 vs 0.1s within engine step bounds). Pause changes neither O2 nor energy.
3. Total mass/weight maths correct, payload increases metabolic workload and never raises speed.
4. Signed ramp tests: same surface, opposite travel directions; uphill slower and more energy-consuming than level; downhill differentiated.
5. Invalid/missing height samples and out-of-bounds movement cannot fake flat height; **idle oxygen still consumes while unpaused**.
6. Exact O2 clamp 0, only one `mission-failed` event, no movement/tasks after failure, `reset` fully restores profile/mission/stock.
7. Starting at 2 g O2 is allowed **only** under explicit `EMERGENCY DEMO TEST` toggle/config and visibly marked as emergency, not normal capacity (750 g remains true capacity).
8. No change to old `createEngine` call semantics; `tests/core.test.mjs` continues to pass (including `oxygenGrams=null` in legacy mode).
9. Suit HUD O2 percentage correct; no grams-to-litres shader feed; no false claim that ambient temperature equals suit temperature.
10. `npm run typecheck && npm test && npm run build` green; manual Electron scene smoke if graphics runner available; do not claim Windows installer/offline QA unless executed.

**Demo happy path:** fixed region loads -> player moves slowly under suited constraints -> O2 depletes according to idle/walk/fast and grade -> a current task can start/finish using existing events -> player can walk toward shuttle -> optional separately labelled low-O2 emergency branch demonstrates failure. Map and final cutscene are separate work.

## 7. Integration prerequisites and escalation
Before coding: `git fetch team main` if authenticated, inspect head diff; `team/main` may be newer than this fork's `c38c5e772388102a9c0571288c2b7210f3c91c97`. Do not overwrite Rachel/Victor/Nanda changes. If team main has advanced, rebase **this personal feature branch** or ask owner before reconciling conflicting interfaces; never force-push team main.
Any source modifications to files owned by other contributors require explicit approval, not hidden edits. If a minimal engine API change is required, document it and test its callers. No refactor of Electron, packages, CI, routes, visual preview or terrain material for physics v0.1.

## 8. Post-demo deferred work
Full task-specific inventory transitions, scientifically calibrated suited gait and terrain/soil interactions, gas loss/pressure/CO2 scrubbing, suit thermal control, return-path resource planner in **grams** (not Rachel old litre Leash), dynamic weather, 10x10/5x5 map selection, procedural/random landing from offline-supported regions, cinematic/game-loop success integration.
