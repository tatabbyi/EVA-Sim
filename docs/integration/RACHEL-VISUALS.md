# Integration Contract R-01 — Rachel: Visuals, HUD, Route and Task Animations

**Owner:** Rachel (visual source); **integrator:** Alex / RAW engine  
**Status:** TEAM REVIEW DRAFT. Real app-owned HUD, scene and route adapters exist at commit `80af8c9`; Rachel reviews visual ownership and missing features.
**Release:** No edits to Rachel-owned files until Rachel explicitly approves them.

## 1. What Rachel can produce independently now

- HUD styling and states; world shader, sky, route arrows/markers and desktop helmet visuals.
- Distinct **four-task animations** as in `docs/FOUR-TASK-ANIMATION-BRIEF.md` (Abrade, Core, Depot, portable MOXIE) and separate brief shuttle intro/outro cutscenes (outside RAW v0.1).
- A new proposal for representing resource **unknown/disabled** without implying 0% (R-01) and a future new Leash shader contract in grams (R-02).
- Visual-only unit/preview scenes may use fixed mock data, but production must label mock values as `DEMO`.

**Alex provides:** immutable game snapshot, task/event lifecycle, selected task IDs and world positions, route points and route provenance, validated terrain height callback, virtual mission clock, actual resource values if/when calibrated, viewport and input adapter.

## 2. Existing code: interfaces VERIFIED in imported Rachel snapshot

| Export | File | Current call / return | Responsibility |
|---|---|---|---|
| `HelmetHud`, `HelmetHudProps` | `src/ui/HelmetHud.tsx` | React `<HelmetHud objectives={...} alert={...} o2={...} temperature={...} />` | Read-only visor rendering; `onAccept` callback forwards an input request |
| `SuitBar` | `src/ui/HelmetHud.tsx` | `{label:string; value:string; fraction:number; level?: 'ok'|'warning'|'danger'}` | `fraction` 0..1 is **required**, even when value unknown |
| `HudAlert` | `src/ui/HelmetHud.tsx` | `{level:'danger'|'warning'|'info';title:string;message:string;acceptKey?:string;onAccept?:()=>void}` | User choice/status; not an engine hazard decision |
| `createTerrainMaterial()` | `src/terrain/material.ts` | `TerrainMaterial` with typed uniforms; `setHeightRange(mat,min,max)` | Own shader/look, not ground-physics logic |
| `createStarrySky(opts?)` | `src/terrain/sky.ts` | `{group,update(camera,timeSeconds),setPixelRatio(pr),dispose()}` | Scene-only presentation |
| `createRoutePath(points,heightAt,opts?)` | `src/terrain/routePath.ts` | `{group,update(timeSeconds),dispose()}` | Render local `{x,z}` waypoints and ground-following arrows |
| `createSampleSite(ground,seed?)` | `src/terrain/sampleSite.ts` | `{group,rockTop,state,progress,start(),update(dt,time,camera),dispose()}` | Current **combined** rock/coring visual prototype |
| `createHeadSway(element)` | `src/ui/headSway.ts` | `{look(dx,dy),step(dt,speed)}`, `speed=0,1,2` | Head/helmet visual sway, not gait physics |
| `applyPaletteToCss()` / `palette` | `src/ui/palette.ts` | CSS variables and shader palette | Shared design tokens |
| `createAdaptiveResolution(renderer,opts?)` | `src/shared/perf.ts` | `{pixelRatio,frame(realDt)}` | Adaptive renderer resolution, not virtual clock |

**Baseline notes:** Rachel `#preview` already wires the functions above with **mock data** and a standalone Three.js scene. RAW v0.1 should **reuse the exports, not copy `Preview.tsx` or create a second independent game state.**

## 3. Proposed READ-ONLY handoff: Core → HUD Adapter → HelmetHud

```ts
// Example view-model only; actual HUD adapter is src/adapters/hud.ts.
type HudViewModel = {
  objectives: { done: number; total: number; current?: string | null;
                timeLeft?: string | null; timeLevel?: 'ok'|'warning'|'danger' };
  alert?: { level: 'danger'|'warning'|'info'; title: string;
            message: string; acceptKey?: string; onAccept?: () => void } | null;
  o2: { label: string; value: string; fraction: number; level?: 'ok'|'warning'|'danger' };
  temperature: { label: string; value: string; fraction: number; level?: 'ok'|'warning'|'danger' };
};
```

**Rules:**
- `objectives.done/total` from core selected mission tasks (RAW demo = 2), **never the old 3/14 preview counter**.
- `objectives.timeLeft` is OPTIONAL; `simTimeSeconds` alone is **elapsed time**, NOT a countdown. Do not invent a mission deadline.
- `alert` is derived from core events/state (demo boundary, task prompt). User pressing E/F generates a core command; the HUD callback must not directly mark task completed or deplete resources.
- `oxygenGrams` / `oxygenCapacityGrams` from future physical model may be **null**. UI normalizes to 0..100% ONLY if both values valid and capacity >0. No 390L, no 30L reserve, no old invented percentage.
- **Current SuitBar cannot truthfully express “unknown”:** `fraction=0` renders an empty bar and could be misread as no oxygen. For RAW, Alex must visibly label unknown resources as **N/A / NOT SIMULATED** and avoid presenting an empty gauge as actual depletion. **Rachel and Alex should agree an explicit optional/unknown bar state in a future approved HUD edit** (e.g. `status:'unknown'` and hide the fill). No unilateral UI source changes.
- `temperature` is likewise unknown unless the core has actual temperature telemetry; no invented 20 °C or danger threshold.

### Example event boundary (PROPOSED, not existing source export)

```ts
type VisualEvent =
  | { type:'task-started'; objectiveId:string; taskId:'abrade-rock'|'take-core'|'sample-depot'|'run-moxie' }
  | { type:'task-finished'; objectiveId:string }
  | { type:'alert-presented'; alertId:string; message:string }
  | { type:'mission-cutscene'; kind:'arrival'|'departure' }; // later, NOT RAW v0.1
```

Animation player consumes a signal and plays a visual sequence; core alone validates prerequisites, duration, inventory and actual success. Visual progress/animation end is **not** automatically a scientific success or oxygen event.

## 4. Scene placement and render lifecycle

- Project every task location `{x,z}` into `THREE.Vector3(x,heightAt(x,z),z)`, in the **same local frameId/metres** as Victor's terrain. `heightAt` must be finite before calling Rachel's `createRoutePath`, `createSampleSite`.
- `createRoutePath` expects **at least two usable route points**; its internal Catmull-Rom ribbon interpolates per metre. The adapter must validate the **interpolated path + nearby footprint** for height coverage, not merely endpoints; out-of-bounds/no-data should disable the ribbon with an explicit error rather than silently clamp its heights.
- Once created, `route.group` and `sky.group` belong in **Alex's scene**, updated once per render frame (`update(timeSeconds)` and `update(camera,timeSeconds)` respectively).
- `createSampleSite(new THREE.Vector3(x,y,z),seed)` currently exposes `start()`, `state`, `progress` and `update(dt,timeSeconds,camera)`; it is a **combined abrasion/coring prototype**, not the approved standalone Abrade+Core task split. Its built-in ~5.7s animation phases are **visual timing**, never mission-time or NASA workload constants.
- `createHeadSway(...).step(realFrameDt, 0|1|2)` is a display effect driven from current movement mode; do not change physical speed from head sway.
- Unmount: remove scene groups, dispose textures/materials/geometry created by adapters and invoke provided `dispose()` functions; do not dispose a shared material twice. One RAF/render loop controlled by Alex; Rachel's preview remains its own isolated dev route.

## 5. Two current shader conflicts that must be made explicit

**R-02 — Old Leash is in litres, new scientific O2 inventory in grams.** Inspected `src/terrain/material.ts` uses `uO2Grid` as `R32F` **litres to walk home**, `uO2Left` **litres**, `uReserve` **litres**, and a hardcoded grid origin/spacing from `BOX_HALF`. These values are from the older `TEAM-PLAN.md` and do NOT match the new user-approved physical units or random region frame. In RAW v0.1:
- **disable data-driven Leash** until Alex/Nanda supply an approved **mass-based (grams) to-home resource grid** in matching coordinates, then coordinate a Rachel-owned shader update/adapter;
- do NOT feed oxygen grams into litres uniforms or reuse old 390L as stock.
- Existing slope tint default 20°/25° remains a **look/preview setting only**, not a real walking safety/speed constraint.

**R-01 — Unknown telemetry in existing HUD.** The current `SuitBar` cannot encode unknown separately from 0%. Rachel should propose a backward-compatible resource presentation variant with an explicit unknown state; Alex owns mapping logic and physical thresholds.

**R-03 — Four independent visuals.** Rachel's existing `sampleSite.ts` is a valuable visual prototype but cannot satisfy all four independent animations. The animators' brief defines distinct before/action/after for Abrade, Core, Depot, portable MOXIE; no MOXIE suit refills.

## 6. Rachel-owned output and acceptance tests

Rachel can provide:
1. Updated or additional **visual-only assets/components** on her own branch (do not edit core); a short demo/showcase for each.
2. Optional backward-compatible proposal for unknown resource bar state **subject to Alex's agreement**.
3. For each animation: `taskId`, asset names, dependencies (textures/models/rigs), how to mount/unmount, start/cancel/complete visual events, local coordinate anchor rules and `dispose()` ownership.
4. A simple app-free test with a fixture (two objectives, no real resource telemetry, one alert, finite route heights).

**Review acceptance:**
- [ ] Rachel `#preview` remains functional, but the actual app uses its own core state.
- [ ] O2 and temperature unknown are visibly **not simulated**, not portrayed as 0% or 100% verified science.
- [ ] The two demo tasks render independently; no forced Abrade→Core or Core→Depot.
- [ ] Route+task placements use finite ground heights in the same frame, not a fixed global home at (0,0).
- [ ] Alerts are requests to core; no direct mutation of oxygen, route or task success by visuals.
- [ ] Existing shader/preview changes (if any) have Rachel's explicit review.
- [ ] Animations/disposables and page unmount do not leak render loops or WebGL allocations.

## 7. Decisions needed from Rachel

- Can we add a backwards-compatible `unknown` display to `SuitBar`, and how should it look?
- Will future task animations be Three.js procedural components, GLTF/GLB clips, or pre-rendered media? Specify only after visual team chooses; don't force asset format from core.
- What are the exact scale/origin/orientation/scene-ownership needs for assets? First-person proximity constraints?
- Does Rachel intend to move the **litres-based Leash** to a separate future mass-based visual API? If so, agree uniform names/units **with Alex and Nanda first**.
- Does existing `createSampleSite` remain a demo-only coring reference or get split by Rachel into independent animations?

**Source baseline:** Rachel's `src/ui/*`, `src/terrain/{material,routePath,sampleSite,sky}.ts`, app-owned `src/adapters/{hud,scene,routes}.ts`, and four-task visual brief.
