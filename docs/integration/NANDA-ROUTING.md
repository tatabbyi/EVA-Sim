# Integration Contract N-01 — Nanda: Offline Route Planning / ML

**Owner:** Nanda (route/ML research & implementation with team agreement)  
**Runtime integrator / domain authority:** Alex  
**Status:** TEAM REVIEW DRAFT. Implemented RAW types: `Route`, `RouteContextV1` and `applyRouteCandidate()` (see `src/core/contracts.ts` and `src/adapters/routes.ts`). `RouteRequest` and `RouteOutcome` examples below are PROPOSED, not exported.
**Not a claim that a trained model, solver or Leash is already implemented.**

## 1. Scope and ownership

Nanda can start independently now on: terrain-derived route algorithms, optional train/inference pipeline, offline packaging of any trained weights or precalculated routes, path quality evaluation and deterministic fixture tests. RAW v0.1 only displays a **DEMO** polyline. The future planning engine must return an actual route through mission objectives without owning the game's movement, survival logic or physics.

**Ownership:** Nanda owns proposed offline planning provider and research; Alex owns the authoritative pure game core, integration adapters and any accepted oxygen/Leash physics. Historical TEAM-PLAN interfaces must be reconciled rather than reused as final science.

**Input owner:** Alex chooses the region and two objectives **before** invoking the planner; Victor supplies terrain/height/coverage. **Output owner:** Nanda produces ordered route candidate(s), metadata and explicit errors. **Renderer:** Rachel consumes only validated local `XZ[]` coordinates via Alex's scene adapter.

## 2. Required coordinate and environment contract

- Route points are **local metres `{x,z}`**, where +x east and +z south; `y` is *not* supplied in path coordinates. Rendering obtains `y=heightAt(x,z)` using Victor's data.
- Every request/result carries **both** `regionId` and `frameId`. Reject a route for the wrong frame, missing height coverage or different terrain revision.
- `playableBounds` and `visibleBounds` are separate. Route and two objective sites must be **inside playableBounds**, not merely visible bounds.
- Shuttle is an arbitrary per-mission position (not always `{x:0,z:0}` and not permanently at the Octavia E. Butler site).
- Mission contains exactly **two task sites**; each has `objectiveId` and one of the four `TaskId` values, but their task mechanics are not the planner's concern.
- Full game: route is requested **after** region, shuttle and both objective positions have been selected. Player may freely depart from the recommendation; planner does not drive WASD or reposition the astronaut.
- Current fixed Jezero 4096 m / 4 m height grid is a **known demo case**; do not hardcode it into all models or assume all of Mars is available offline.

## 3. PROPOSED request/result schema (not yet a shipped TypeScript API)

```ts
type XZ = { x: number; z: number }; // finite, local metres
type TaskId = 'abrade-rock'|'take-core'|'sample-depot'|'run-moxie';
type Bounds = { minX:number; maxX:number; minZ:number; maxZ:number };
type Site = { objectiveId:string; taskId:TaskId; position:XZ };

interface RouteRequest {
  contractVersion: 1;
  regionId: string;
  frameId: string;
  terrainRevision: string;        // version/hash so routes cannot be reused on a different grid
  visibleBounds: Bounds;
  playableBounds: Bounds;
  shuttle: XZ;
  objectives: [Site, Site];       // exactly TWO preselected sites
  scenarioSeed?: number;         // optional deterministic seed; semantics still to agree
  // Future movement/cost settings belong to versioned scientific scenario data, not magic literals
}

type PlannerKind = 'trained-ml' | 'classical' | 'hybrid' | 'demo';

type RouteOutcome =
  | { status:'ok';
      regionId:string; frameId:string; terrainRevision:string;
      planner:{kind:PlannerKind; name:string; version:string; modelDataVersion?:string};
      visitOrder:[string,string];    // objective IDs, in route visitation order
      points:XZ[];                   // start at shuttle; pass both sites in visitOrder
      estimatedDistanceM:number;     // from geometry, NOT oxygen cost
      diagnostics?:{runtimeMs?:number; warnings?:string[]}; }
  | { status:'error'; regionId:string; frameId:string;
      code:'NO_ROUTE'|'INVALID_INPUT'|'MISSING_TERRAIN'|'UNSUPPORTED_FRAME'|'MODEL_UNAVAILABLE'|'CANCELLED';
      message:string; };
```

**Schema status:** proposed adapter boundary, not a requirement that Codex already exported these names. Confirm via actual Codex result before shipping. `terrainRevision`, `visitOrder`, `planner.kind` and `estimatedDistanceM` are recommended metadata to avoid false attribution and stale routes.

A planner may expose an async `plan(request, terrainProvider)` interface or consume an offline `RouteRequest` JSON plus a locally packaged DEM/feature artifact; **no live Python server** or NASA/cloud API is allowed during the user's game session. If using a Web Worker, exchange serializable metadata/buffers rather than function callbacks. Data preprocessing or model training can run in Python before shipping.

### Important provenance mapping to v0.1

The implemented `Route.source` supports `'demo' | 'ml' | 'computed' | 'hybrid' | 'none'`. Use truthful provenance and a matching `context.planner.kind`:
- **DEMO fixture:** core source `demo`.
- **Actually trained model:** `ml` if provenance is supported.
- **Classical or hybrid method:** use existing `computed` or `hybrid` source, with planner kinds `classical` or `hybrid`; never relabel as ML.
- Missing route: `none` + a visible reason.

## 4. Route validity requirements

At minimum, validate:
1. All coordinates/parameters finite; point count >=2; adjacent duplicate points handled consistently (rejected or deduplicated).
2. Both mission sites have a **matching objective ID** in `visitOrder`, each visited exactly once; route starts at shuttle within the agreed **site tolerance in metres** (final tolerance still OPEN).
3. Every polyline segment is inside `playableBounds`; no only-vertices check that misses a path cutting through invalid terrain or outside a concave area in a future design.
4. All path samples have actual **valid height** in Victor's region frame. A cell containing no-data/NaN/Infinity is not traversable. Do not rely on `sampleBilinear` silently clamping to edge samples.
5. Any additional **walkability/slope/hazard constraints** must have versioned provenance and explicit Alex approval. Old 25° shader warning is *not* a scientific walking cutoff.
6. The planner reports `NO_ROUTE` or `MISSING_TERRAIN` rather than returning a fabricated straight line with `source='ml'`.
7. `estimatedDistanceM` is computed from local-metre segment lengths; if 3D terrain distance is used, label it separately from horizontal distance. Do not use Earth-distance results from MapLibre without Mars conversion.
8. Determinism: same input dataset/revision/seed/model version should produce a repeatable route where the algorithm promises deterministic execution. If model inference can be nondeterministic, disclose it.
9. Performance: provide benchmark on the real Jezero-size dataset and actual target CPU; do not invent fixed milliseconds before a tested baseline. Avoid blocking the UI rendering thread; worker/offline preprocessing is encouraged.

**Renderer caveat:** Rachel's current `createRoutePath(points,heightAt)` uses a Catmull-Rom curve and samples an **interpolated ribbon roughly every metre**. Even a waypoint-valid path may overshoot into invalid samples between points; Alex's adapter needs safe densification/coverage checks before calling a `heightAt:(x,z)=>number` renderer. Do not add silent clamping to conceal bad route geometry.

## 5. Mission, off-path behavior, return and Leash

- The outbound plan should visit the two selected task sites, typically shuttle → first task → second task. **Task order optimization** (fixed vs planner-chosen) is still an Alex/team design decision. Carry `visitOrder` explicitly so the game can display the actual order.
- The game narrative intends a return to **the same shuttle**, with planned outward route potentially retraced in reverse.
- **Open D-040 / Q81:** once the player deviates, is return guidance the reverse of *actual travelled track* or of the original *planned path*? Nanda must not freeze this behavior by embedding it into the route solver; support storing planned path independently from actual player track.
- **Leash and O2-to-home are NOT RAW v0.1 features.** Historical `TEAM-PLAN.md` uses `o2_to_home.bin` in litres with old 390L, `uReserve` litres, and a 2m grid. New internal suit O2 is **grams**, physical coefficients, reserve and slope model are still not approved. **Do not train/calibrate a model to those legacy numbers as if they were final.**
- If Nanda explores a standalone scoring function, record the exact units (distance m, time s, energy J or kcal, oxygen g if validated), source/assumptions and scenario version. Keep any mock costs separate from scientific outputs.
- Task animations/interruptions are Alex/Rachel concerns. No automatic task-completion callback inside route code.

## 6. Independent Nanda deliverables / suggested test fixtures

**Useful immediate delivery (even before Codex finishes):**
1. `README` explaining chosen `PlannerKind`, inputs, output schema and algorithm/model provenance; optional trained weights/feature pipeline and how they're bundled offline.
2. **A tiny deterministic elevation fixture** with known slope/no-data cells and two objective positions; expected path and expected rejection path. The **fixture geometry is synthetic and labelled TEST**, not NASA data.
3. One real Jezero test using Victor's existing `height_4m.bin`, with input/output `regionId/frameId/terrainRevision` and a JSON route sample in metres.
4. `plan()` or offline generator that **never makes runtime network calls**, logs algorithm, failures and time.
5. Tests for wrong frame, no route, no-data, route crossing bounds, duplicated points, swapping task order, seed consistency and wrong grid revision.
6. A brief report: data/runtime memory, test performance, any assumptions needed from Alex and whether it is actually ML.

### Example single-request data (ILLUSTRATIVE LOCAL METRES, not validated NASA waypoints)

```json
{
  "contractVersion": 1,
  "regionId": "jezero-demo",
  "frameId": "jezero-eqc-local-demo",
  "terrainRevision": "demo-grid-revision-to-fill",
  "visibleBounds": {"minX": -2048,"maxX": 2048,"minZ": -2048,"maxZ": 2048},
  "playableBounds": {"minX": -500,"maxX": 500,"minZ": -500,"maxZ": 500},
  "shuttle": {"x": -120,"z": 60},
  "objectives": [
    {"objectiveId":"task-a","taskId":"take-core","position":{"x": -40,"z": 120}},
    {"objectiveId":"task-b","taskId":"run-moxie","position":{"x": 180,"z": 160}}
  ],
  "scenarioSeed": 7
}
```

**No scientific/path clearance claim:** sample numbers are fictional schema test data; they are not verified landing or walkable locations. Note that the 500m bounds are a **test fixture only**, not the user's 5x5km example.

## 7. Acceptance checklist and open handoff questions

- [ ] Nanda sends a meaningful **route or typed failure** for the two-site test without using the internet.
- [ ] Input and output carry matching `frameId`, `regionId` and `terrainRevision`.
- [ ] Route starts at actual shuttle and passes two valid objective sites inside playable bounds.
- [ ] No `NaN`, out-of-coverage sampling, assumed Octavia E Butler home or hidden 25° safety limit.
- [ ] Model type is honestly named; old litres-based oxygen grid is not connected to new physical simulation.
- [ ] Route renders via a **validated adapter** using Rachel's route API in Alex's real Electron scene.
- [ ] Core and model do not share implicit mutable player state; player may leave suggested route.
- [ ] Nanda delivers short repeatable tests, runtime benchmark and model/data version.
- [ ] Any change of responsibility from legacy TEAM-PLAN has Alex's signoff.

**Questions for Nanda:** Is the first output ML, A*, Dijkstra, hybrid or a precomputed static path? Can it run completely offline under Electron on Windows and Linux? How is valid terrain data delivered to the solver (grid/tiles/accessor)? Does Nanda choose visiting order or follow one from Alex? What inputs are required before later O2/Leash scoring is scientifically honest?

**Real exports:** `src/core/contracts.ts`, `src/adapters/{routes,world}.ts`. `RouteRequest` and `RouteOutcome` are planner-side proposals. See [API reconciliation](RAW-V01-API-RECONCILIATION.md).
