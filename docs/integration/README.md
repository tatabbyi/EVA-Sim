# Sharkies — Team Integration Contracts (RAW Engine v0.1)

**Team PR note (2026-11-14):** Real, checked RAW v0.1 exports are documented in [RAW-V01-API-RECONCILIATION.md](RAW-V01-API-RECONCILIATION.md). The separate Nanda planner request, Victor's future region manifest and Rachel's unknown-resource HUD state remain **proposals requiring owner review**. GitHub Actions run 43611705331: native Windows build and both smokes PASS; Linux AppImage built, hosted GUI smoke FAILS because WebGL2 is blocklisted; manual Windows installation and physically disconnected launch remain unverified. Do not treat this contract draft as blanket team approval.

**Prepared:** 2026-11-14  
**Maintainer / integration owner:** Alex  
**Status:** TEAM REVIEW DRAFT. Shared concepts below; source code and actual API reconciliation are authoritative.

These role contracts are for parallel development against the existing RAW Engine; do not treat source/API proposals as shipped code.


**AI coding agents:** Read [AI-AGENT-HANDOFF.md](AI-AGENT-HANDOFF.md), this README, then the owner-specific contract and real TypeScript source before editing.

| Owner | Document | Team-owned deliverable | Core consumes |
|---|---|---|---|
| **Rachel** | [RACHEL-VISUALS.md](RACHEL-VISUALS.md) | HUD, shaders/sky, route arrows, task/shuttle visual assets | Read-only game snapshot, semantic visual signals and world placement |
| **Nanda** | [NANDA-ROUTING.md](NANDA-ROUTING.md) | Offline path-planning/ML solution and route metadata; eventual walk-controller reconciliation | A mission + region + height/walkability data; returns route or typed failure |
| **Victor** | [VICTOR-TERRAIN.md](VICTOR-TERRAIN.md) | Actual supported Mars terrain/mesh + elevation data + region metadata + terrain loader | Validated terrain geometry, height sampling and coverage/bounds |

## RAW v0.1 actual API reconciliation — review pending

- **Verified implementation** at RAW feature head `80af8c9` (same game interfaces as `2f96c693`; subsequent commits changed CI/smoke only): see **[`RAW-V01-API-RECONCILIATION.md`](RAW-V01-API-RECONCILIATION.md)** for exact `RouteContextV1`, `HeightProvider`, `applyRouteCandidate`, `mountScene` and event exports.
- These are **real code exports** whereas the Nanda `RouteRequest/RouteOutcome` and Victor `RegionManifestV1` in draft documents are still **proposals**. AI agents must not mix them up.
- Native Windows CI PASS; Linux AppImage build PASS, runner GUI smoke blocked by WebGL2. See the status note above.
- AI agents must check out the actual PR branch and read its source instead of assuming remote access.

## 1. Authority, scope and baseline

**Established RAW application behavior** is recorded in [`docs/RAW-ENGINE-V01.md`](../RAW-ENGINE-V01.md); historical `TEAM-PLAN.md` contains older assumptions that must not override the currently implemented APIs:
- The RAW deliverable is **offline Electron on Windows x64 and Linux x64**; macOS packaging later.
- React + Three.js render the world; a **pure TypeScript core owns state, virtual time, task events and movement state**. Python may preprocess datasets but is **not** an assumed runtime backend.
- RAW v0.1 uses current Jezero `height_4m.bin` as an explicitly **DEMO** terrain. The final region/planet model must be extensible rather than universally fixed to Jezero.
- For v0.1: **two deterministic demo objectives** using four supported task identifiers. The later real game selects **two tasks from four** with sites before generating an offline route, which is guidance, not autopilot.
- RAW demo camera supports WASD/Shift; future locomotion/physical speed is separately specified. Demo playable bounds **warn and block passage**, yet outer terrain stays visible.
- Teammate-owned files stay protected. No unrelated edits to Rachel's `src/ui/*`, materials or `#preview`; Victor's `src/shared/{coords,meta}.ts` or loader; Nanda's `src/walk/*`.
- No unapproved suit mass, oxygen capacity, distance-based consumption, slope threshold or energy formula may become “real game science.” Internal O2 **grams** later, HUD normalized **0–100%**. Portable MOXIE never refills the suit.

**Actual source baseline:** RAW Engine from `ac2e188` with reviewed source through commit `80af8c9`; project parent is `tatabbyi/EVA-Sim`. Existing Rachel renderer remains in `src/terrain`, HUD in `src/ui`, app adapters under `src/adapters`.

## 2. Shared coordinate and unit rules

All components agree on the **same `frameId` per region**, otherwise the handoff is invalid.

| Value | Units and meaning | Source-of-truth owner |
|---|---|---|
| `x` | **metres east (+)** in the selected local frame | Victor / World Adapter |
| `z` | **metres south (+)** (north is negative z) | Victor / World Adapter |
| `y` | **metres up (+), relative to region's `h0`** | Victor / World Adapter |
| `position` | `{ x, z }`, plain serializable numbers; renderer constructs `THREE.Vector3(x, heightAt(x,z), z)` | Core → render adapter |
| `visibleBounds` | terrain that can be rendered; contains `playableBounds` | Victor data + Alex mission config |
| `playableBounds` | region where astronaut may move / objectives may be placed; demo border blocks | Alex mission config, validated against Victor terrain |
| `simTimeSeconds` | seconds since mission simulation began; **pause freezes** | Alex engine |
| `world`/animation time | rendering-only seconds/frame delta (not physical O2 drain) | Rachel / render adapter |
| `oxygenGrams` | physical inventory **g O2**, presently uncalibrated and nullable | Alex future physical model |
| `hudOxygenPercent` | future derived 0–100%; do not invent if physical capacity unknown | Alex → Rachel HUD adapter |
| `equipmentMassKg` | **kilograms**, only actually carried inventory (future) | Alex future inventory model |

**Legacy Jezero demo only:** existing `src/shared/coords.ts` uses `BOX_HALF=2048` m, a 4096 m square centred on Octavia E. Butler (77.4508 E, 18.4447 N), and projected EQC CRS `+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs`. Grid samples in existing `TEAM-PLAN.md`: row 0 north, col 0 west, row-major little-endian, `x=col*cell-2048`, `z=row*cell-2048`. **Do not make these permanent globals across newly selected Mars regions**; every real dataset must carry its own frame/origin/extent.

### Proposed portable cross-team types (design only)

```ts
// Conceptual cross-team examples, NOT importable RAW v0.1 exports.
export type XZ = { x: number; z: number }; // m, finite
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type TaskId = 'abrade-rock' | 'take-core' | 'sample-depot' | 'run-moxie';
export type TaskStatus = 'pending' | 'active' | 'complete' | 'failed';
export type TaskObjective = { id: string; type: TaskId; position: XZ; status: TaskStatus };
export interface RegionRef {
  regionId: string;
  frameId: string;
  visibleBounds: Bounds;
  playableBounds: Bounds;
}
export interface RoutePolyline {
  frameId: string; // reject foreign coordinate frame
  points: XZ[];   // >=2 finite, non-identical points and validated terrain
  source: 'demo' | 'ml' | 'computed' | 'hybrid' | 'none'; // actual core source variants
}
```

All examples below use these semantics, even if the final Codex names differ. No direct `THREE.Vector3` in domain state and no raw geodetic/projected coordinates inside route/task arrays.

## 3. Event/data flow

```text
Victor: region + height/mesh + coverage --> Alex world adapter
           |                                   |
           +-----------> Nanda planner <--------+ (shuttle, two objectives, bounds)
                              | planned route or typed failure
                              v
Input (WASD/tasks) --> PURE TS CORE --> read-only snapshot / semantic events
                              |                              |
                       Rachel HUD adapter             Three.js scene adapter
                              |                              |
                       visor/alerts/status            terrain/route/visual animations
```

- **Core is authoritative:** neither shaders, animation completion timers nor ML metadata can unilaterally spend oxygen, finish scientific work, move shuttle or declare mission survival.
- **No hidden coordinate conversion:** convert projection/latitude/longitude into `frameId`-scoped local metres once at the world adapter boundary.
- **No missing data masquerading as zeros:** `null`/typed error for unavailable/out-of-bounds samples. `0` is a valid height or oxygen quantity, not a missing-data sentinel.
- **No runtime network:** bundle model weights, metadata, height grids, meshes and visual assets with Windows/Linux distributions. Build-time downloads/preprocessing are permitted; gameplay should work offline.
- **No silent fallback:** if route/height/asset is invalid, show a clear error or explicitly labelled `DEMO` route. The existing Rachel preview values (390 L, fixed 14 tasks, 20/25 degree warning) are demo assumptions, not approved production physics.

## 4. Shared integration acceptance handshake

Each teammate should provide **one PR or clearly named branch** with:
1. A short `README`: file paths, format/version, region/frameId, expected inputs and returned outputs, provenance and limitations.
2. At least one **small deterministic fixture** that can run without NASA/cloud APIs; original data may be larger, but include a tiny test sample.
3. A minimal usage example and a small automated test or repeatable manual check. Failure/empty-data and two valid coordinates must be exercised.
4. Demonstrated cleanup for all Three.js groups/textures/materials/controllers where applicable; no duplicate event/render loops.
5. Zero unsolicited changes to other owners' files. If an adapter/API needs a change, open an issue or explicit review request rather than directly rewriting it.
6. A report stating which checks were actually **PASS / FAIL / NOT TESTED**, with OS/platform and commit hash.

### Alex's final merge gate (after Codex)

- Pull fresh team `main`; compare completed Codex `feat/raw-engine-v01` exports to the **proposed** signatures here.
- Fill an **API reconciliation table**: proposal → actual type/path → adjustments → owner's approval. Only after owner review promote contract sections to **ACCEPTED** and share approved import paths.
- Smoke test `#preview`, 3D scene in Electron, one Victor height fixture, one Nanda route fixture and one Rachel HUD/animation event.
- Build Windows+Linux offline artifacts again after integrating the branches; run what can genuinely be tested and report the native Windows smoke evidence and any unverified manual Windows installation.

## 5. Coordination issues that remain open

| ID | Required input | Owner | Blocks |
|---|---|---|---|
| **X-01** | Real exports reconciled to proposed API; pending Rachel/Nanda/Victor acceptance | Alex + team | Team review |
| **V-01** | Victor's next terrain asset kind, extent, source CRS/origin, versioned manifest and true no-data semantics | Victor | Switching from Jezero preview to final regions |
| **V-02** | How walkable/playable area and valid shuttle landing sites are determined | Victor + Alex | Real random mission placement |
| **N-01** | Whether Nanda uses trained ML, a classical planner, or a hybrid; deterministic outputs and offline packaging | Nanda | Honest route provenance and cost model |
| **N-02** | Real scientifically calibrated travel/oxygen cost contract (grams vs legacy litres) | Nanda + Alex | Physics/Leash beyond RAW demo |
| **R-01** | HUD representation of **unknown oxygen/temperature** (current `SuitBar` requires `fraction`) | Rachel + Alex | Honest UI in unfinished science mode |
| **R-02** | Legacy O2-to-home shader is **litres-based** and spatially fixed; new gram-based shader contract | Rachel + Alex + Nanda | Production Leash overlay |
| **R-03** | Final animation rigs/formats/durations/scene ownership and semantic task hooks | Rachel / artists + Alex | Four full scientific animations |
| **G-01** | Final border collision/warning semantics and off-route return path rule | Alex / team | Later real mission, **not** RAW demo |

**Important:** These are *coordination requests*, not permissions for any teammate to change physics, engine, ownership, or end-game rules unilaterally.

### Pointers to existing docs

- `TEAM-PLAN.md` §2 (historic shared coordinate/grid/loader contracts; inspect against new mission requirements)
- `docs/FOUR-TASK-ANIMATION-BRIEF.md` (four separate visual actions; already given to team)
