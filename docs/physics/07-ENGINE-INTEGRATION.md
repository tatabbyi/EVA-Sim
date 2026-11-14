# RAW Engine integration — verified APIs, ownership and change boundary

**Current inspected baseline:** `mokachkasss/Sharkies:main` at SHA `c38c5e772388102a9c0571288c2b7210f3c91c97`. The team may update `tatabbyi/EVA-Sim:main` while this document is in use; always inspect/fetch the latest team changes before implementation. This is **a planned integration contract, not code already delivered**.

## 1. Existing application architecture
~~~text
Electron app
  └─ React src/app/App.tsx (Alex integration)
        ├─ loadDemoWorld() -> Region/Mission/HeightProvider
        ├─ createEngine(region, mission, canOccupy?, speeds?) [pure domain]
        ├─ createFixedClock(engine) [1/60s virtual simulation step]
        ├─ mountScene(host, engine, heights) [Alex scene adapter]
        │     └─ Rachel terrain material, sky, route visuals, sample-site asset
        └─ toHelmetHud(EngineSnapshot) [Alex HUD view model]
              └─ Rachel HelmetHud render component
~~~
- App currently samples authoritative HUD snapshot roughly at **10Hz**, whereas core updates at **fixed 60Hz**. Physics must advance only in **core step**, not HUD sampling, scene RAF or timers.
- `createEngine` already validates region bounds and task positions, supports immutable snapshots, subscribes to state and emits semantic events. `step(seconds)` is limited to 0..0.25 seconds.
- Demo default movement still **3m/s walk** and **8m/s run** in `DEMO_MOVEMENT`, and resources begin as `oxygenGrams:null, oxygenCapacityGrams:null`. This behavior is expected by legacy tests; do not silently delete it.
- `HeightProvider` already has strict numeric sampling `heightAt(x,z):number|null`; current raster is finite, **4m resolution**. It is not a universal terrain physics system.
- `src/sim/cost.ts` (Nanda) throws "not implemented" in all exported route cost functions; it is NOT a valid existing human metabolic integrator.
- `src/terrain/material.ts` (Rachel) contains old **litres** O2 Leash uniforms; the app currently deliberately disables them. No gram-to-litre direct pass-through.

## 2. Minimal additive physics design (suggestion, subject to implementation QA)
~~~ts
type MarsEVAEngineeringProfile = {
  id: 'mars-eva-engineering-demo-v1';
  gravityMps2: number;
  ambientPressurePa: number;
  ambientTemperatureC: number;
  personMassKg: number;
  suitMassKg: number;
  baseWalkMps: number;
  baseFastMps: number;
  idlePowerW: number; walkPowerW: number; fastPowerW: number; taskPowerW: number;
  oxygenCapacityGrams: number; reserveGrams: number; criticalGrams: number;
  maxDemoSlopeDeg: number; slopeProbeMetres: number;
}
type PhysicsOptions = {
  profile: MarsEVAEngineeringProfile;
  heightAt(x:number,z:number): number|null;
  carriedMassKg: number;
  initialOxygenGrams?: number;  // only explicit TEST scenario when not full
};
~~~
Prefer a **fifth optional** `createEngine` parameter for physics options, leaving existing 4-argument callers unchanged. A different equivalent opt-in signature is acceptable if Codex proves old tests, current scene integration and crew-owned exports are intact.

### Recommended pure modules
1. `src/core/physics.ts` or `src/core/physics/*.ts`: deterministic side-effect-free value functions: grade sample, power, suit speed, weight, gas integration, validation and versioned scenario defaults. **No Three.js, React, Electron, DOM, file IO or network imports.**
2. `src/core/contracts.ts`: minimal additive snapshot fields for mission status and O2 telemetry, retaining existing nullable legacy state. Emit exactly one `mission-failed(reason:'oxygen-depleted')` event.
3. `src/core/engine.ts`: one authoritative integrated state, one step. Real accepted motion may differ from command input; blocked/idle behavior still burns idle O2 until paused. Failed state locks input and task commands; reset restores original snapshot.
4. `src/app/App.tsx`: enable selected physics profile for demo without editing Rachel materials or creating a second game loop. Provide a clearly labelled emergency O2 test mode for rapid failure QA.
5. `src/adapters/hud.ts`: map authoritative `resources` to Rachel HUD `SuitBar` and prioritized `HudAlert`. Only adapter owns decision, Rachel's component remains view-only.

### Input/output and location boundary
- Engine accepts user movement as normalized XZ vector; compute grade along **intended directional step** before accepting motion.
- Reject out-of-bounds, invalid samples or unsupported slope; never sample arbitrary sky/material texture colors as ground physics.
- Physics engine computes only active EVA. Shuttle cutscenes stay separate, and no arbitrary terrain relocation is in this scope.
- Route ML remains guidance. Its points, frame/revision and optional return cost must not be replaced by this module.

## 3. Strict file ownership
**Allow Alex changes:** `src/core/contracts.ts`, `src/core/engine.ts`, new `src/core/physics*.ts`, `src/adapters/hud.ts`, `src/app/App.tsx`, tests, and indispensable narrowly scoped Alex adapters.

**PROTECTED; do not touch without owner approval:**
- Rachel: `src/ui/**`, `src/terrain/**`, `src/dev/**`, palettes, shaders, preview and animation assets.
- Nanda: `src/sim/cost.ts`, planner/route-cost module.
- Victor: `src/terrain/loader.ts` and sourced grids/tiles, terrain pipeline, coordinate provenance.
- Team: `research/**`, root architecture/CI/electron config unless explicitly approved.

A slight complication: `src/terrain/loader.ts` lives under Rachel's broad protected folder but is a Victor-owned loader; neither is Alex-owned. Do not use file paths as the sole owner-authority.

## 4. Time, failure and correctness invariants
- One fixed simulation dt and deterministic updates; never integrate gas twice in an interval.
- Pausing stops time, motion, metabolic energy and oxygen consumption.
- Task active: one activity workload, not simultaneous walking and stationary work billed twice. Decide/apply how task status temporarily freezes movement.
- Empty O2 triggers one authoritative fail event, clamps stock exactly to zero and disallows task completion. Reset must restore fresh O2, tasks, simulation time and movement.
- Pure state updates and immutable snapshots; dispatch/observers must not accidentally mutate stale snapshots.
- Legacy no-physics mode retains `oxygenGrams=null` and old motion rates so existing test fixtures remain valid.

## 5. Minimal sequence for Codex
1. `git status --short`; inspect branch and actual team/main; read `docs/physics/{README,NASA-DATA-AND-PRIMARY-SOURCES,PHYSICS-DEMO-V01,CODEX-PHYSICS-DEMO-V01}.md` and team integration docs.
2. Implement pure, well-unit-tested physics model without visuals.
3. Add **opt-in** engine integration; keep same task event contract and default legacy behavior.
4. Map real O2 state to Alex HUD adapter; label ambient conditions separately from suit TEMP.
5. Add one **O2 EMERGENCY TEST** scenario for visually verifiable failure.
6. Run `npm run typecheck`, `npm test`, `npm run build`, Electron smoke if graphics available, check file-owner diff.
7. Commit only approved paths to the personal feature branch and report actual, not aspirational, test outcomes.

## 6. Handoff and approval
Original exact task instructions: `CODEX-PHYSICS-DEMO-V01.md`. Original numerical contract: `PHYSICS-DEMO-V01.md`. The bibliography and auditing docs **add explanation, provenance and warnings**; they do not license editing colleagues' material or changing the five user decisions.

Merge work through team PR only after owner review. If team/main has progressed past the fork baseline (especially Rachel HUD and Victor terrain), **stop and adapt to actual exported contracts**, without force-pushing the team main.
