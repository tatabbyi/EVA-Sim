# RAW Engine v0.1 — Actual Exports vs Team Contract Drafts

**Prepared:** 2026-11-14 from pushed `mokachkasss/Sharkies:feat/raw-engine-v01` at `80af8c9259ce979d9f1559b02f1e05fde79e675b` (later smoke/CI commits did not change game interfaces).  
**Status:** TEAM REVIEW DRAFT (real exported code verified; owner approvals outstanding). Native Windows build, source and packaged GUI smokes PASS in run `43611705331`; Linux AppImage built but hosted GUI smoke FAILS on blocklisted WebGL2. Local Linux GUI was reported passing; manual Windows installation and physically disconnected tests NOT TESTED.

## Verified app-owned exports

| Contract topic | Real exported name and source (RAW head) | Accepted semantic invariant | Still missing / needs teammate agreement |
|---|---|---|---|
| Local positions | `XZ` in `src/core/contracts.ts` | `{x,z}` in local metres, east+ south+ | Victor's actual terrain frame per dataset, any transformed global geography |
| Region | `Region` in `src/core/contracts.ts` | `id`, `frameId`, optional `terrainRevision`, `crs`, projected `origin:{X,Y,h0}`, visible/playable bounds | Victor catalog manifest, choice/coverage validation for multiple regions |
| Mission tasks | `TaskId`, `Task`, `Mission` | Four stable IDs; `Mission.regionId`, shuttle local XZ, objective ids/positions | Real objective placement and task mechanics, exact mission/task selection |
| Route | `Route`, `RouteContextV1` in `src/core/contracts.ts` | `source:demo/ml/computed/hybrid/none`, `points:XZ[]`, optional `context`, optional `unavailableReason` | A real Nanda `RouteRequest`/async solver/`RouteOutcome` is **NOT implemented** |
| Safe route entry | `applyRouteCandidate(engine, terrain, route)` from `src/adapters/routes.ts` | Validates context/frame/revision/provenance, shuttle and 2 site visits, full smoothed route and footprint; returns `{ok,reason?}`, dispatches none/error on failure | Nanda must convert solver output to this `Route` candidate; 1m goal tolerance still needs agreement |
| Pure movement/time | `createEngine` in `src/core/engine.ts`, `createFixedClock` in `src/adapters/clock.ts` | Snapshot/simTime/pause/reset/semantic task events; demo WASD/Shift movement | Nanda's final walk adapter, scientific gait/suit cost, non-demo resources |
| Events | `SemanticEvent` in `src/core/contracts.ts` | `task-started`, `task-completed`, `reset`, `route-changed` | Animators must explicitly handle/reject unrecognized event kinds |
| HeightGrid | `createHeightGrid(buffer,n,cell,bounds)` in `src/adapters/world.ts` | Returns finite/null `heightAt`, bounds and conservative `coversArea`; rejects invalid grid dimensions | Victor real mesh/LOD or other grid resolution must be wrapped/mapped |
| HeightProvider | `HeightProvider` in `src/adapters/world.ts` | HeightGrid + `contractVersion=1`, regionId/frameId/terrainRevision, coverage/no-data policy | Actual Victor data version, mask, partial no-data/mesh support (RAW currently rejects whole scene on holes) |
| World loader | `loadDemoWorld()` in `src/adapters/world.ts` | Reads bundled Jezero `public/data/meta.json` and height_4m.bin, hashes bytes + transform into revision | Generic Mars region loader/catalog **NOT implemented** |
| HUD adapter | `toHelmetHud(snapshot)` in `src/adapters/hud.ts` | Read-only actual task completion and N/A resources; doesn't mutate Rachel HUD | Existing Rachel SuitBar still has mandatory `fraction:0` on unknown; optional unknown bar contract needed |
| Scene adapter | `mountScene(host,engine,heights,reportRoute?)` in `src/adapters/scene.ts` | Owns Three.js renderer, uses Rachel material/sky/route sample site, handles route error, lifecycle | Victor real model insertion, all four animations, independent scene visual ownership to agree |
| Route visual | `createRouteVisual(validate,build,detach,report)` in `src/adapters/routes.ts` | Identity-based build; failure is recoverable, no repeated invalid route build | Live `routePath.ts` update may require revisiting matching Catmull-Rom curve and arrow width; Rachel agreement |
| Desktop | `electron/main.cjs`, `electron-builder.json`, `.github/workflows/raw-desktop.yml` | Isolated Electron host, offline local assets, Windows+Linux targets | Native CI still failing smoke in both OS, no actual CI artifacts, unsigned NSIS; physical offline test pending |

## Important mismatch: Nanda's draft schema is NOT the exported schema

`docs/integration/NANDA-ROUTING.md` proposes a `RouteRequest` and `RouteOutcome` with status/error, `estimatedDistanceM`, diagnostics and optional seed. These types are **NOT exported by RAW v0.1**. The current `applyRouteCandidate` is only an app adapter consuming a pre-built `Route`; it does not run, spawn or train an ML model.

A later Nanda-owned planner may implement those request/outcome types **independently**. Alex's integration wrapper will convert a successful result into a `Route` with `RouteContextV1`, pass it through `applyRouteCandidate`, and translate failure to a typed `none/unavailableReason`. Do not directly call core `engine.dispatch({type:'route',...})` from untrusted model output without terrain/frame validation.

### Example of actually implemented route adapter (from code contracts)

```ts
import { applyRouteCandidate } from '../src/adapters/routes';
import type { Route } from '../src/core/contracts';

// The following objects are conceptual; see actual module paths in the app.
const candidate: Route = {
  source: 'computed',
  points: [shuttle, firstObjective, secondObjective, shuttle],
  context: {
    contractVersion: 1,
    regionId: region.id,
    frameId: region.frameId,
    terrainRevision: terrain.terrainRevision,
    planner: { kind: 'classical', name: 'Declared algorithm', version: '1' },
    visitOrder: [firstObjectiveId, secondObjectiveId],
  },
};
const result = applyRouteCandidate(engine, terrain, candidate);
if (!result.ok) {
  // Show failure; don't portray a DEMO path as trained ML.
}
```

**Not a drop-in file:** snippet illustrates field names and dependency boundaries and uses placeholder locals; data/point suitability must be validated. Do not present this as verified NASA routing output.

## Important mismatch: Victor's manifest is proposed, not delivered

Victor's draft `RegionManifestV1` contains extra data origin/source/asset metadata. The current code only exposes `Region` and `HeightProvider`. Victor can prepare a separate dataset/manifest; Alex's later adapter must map it to these actual contract types without editing `src/shared/coords.ts`, `src/shared/meta.ts` or Rachel's shader spec unilaterally.

The current no-data policy is `reject-scene` for any invalid grid cell; **don't assume partial meshes, multiregion or dynamic LOD are done**. The former `src/terrain/loader.ts` stub belongs to Victor.

## Rachel visual attachment remains intact but limited

Actual app `mountScene` reuses Rachel's `createTerrainMaterial`, `createStarrySky`, `createRoutePath`, and `createSampleSite` (core-taking visual example only). Rachel's existing `#preview` remains a separate dev route. `HelmetHud` receives `toHelmetHud()` props; missing oxygen and temperature are shown as N/A/NOT SIMULATED, but `SuitBar.fraction` must currently be 0. This is a visual API limitation, not an oxygen reading.

## API acceptance process

1. First fix CI smokes and review new native Windows/Linux logs/artifacts; then confirm new v0.1 code head and this mapping.
2. Check latest accessible `tatabbyi/EVA-Sim:main` via user's local Git (private upstream is 404 to this connector) and resolve ownership/diff.
3. Each teammate reviews their actual consumer types/units and suggests changes to their OWN module or Alex's integration adapter; explicitly record proposal vs agreement.
4. Promote only the specific approved field/type signatures to `ACCEPTED`; this document stays `REVIEW` until then.
5. Include a **clean, minimal set** of integration contracts in the later team PR. Do not merge the personal fork's full `main` history.
