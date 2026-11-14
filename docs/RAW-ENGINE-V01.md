# RAW Engine v0.1 integration and verification

Written with AI assistance (Codex). Contract version: RAW 0.1, 2026-11-14.

Implementation is on `feat/raw-engine-v01`, based on local `upstream/main`
`ac2e18819e3462a89798fb88a75e22cfdd28733e`. Preflight HEAD matched that ref.
Specifications were read with `git show origin/main:docs/alex-core/18-RAW-ENGINE-V01-APPROVED-SCOPE.md`
and the corresponding `19-CODEX-RAW-ENGINE-V01-FINAL.md`.
No fetch, GitHub connector, push, merge, release publication or CI dispatch was performed.

Phase I commit: `656135e` (secure desktop foundation).
Phase II commit: locate with `git log -1 --format=%H --grep='phase II'`.
The implementation is reviewable; the release gate still requires native Windows evidence.

## Run and package

Use Node 24+ (local verification used Node 26.12.1). Existing React/Vite/TS/Three
versions are unchanged. New exact dependencies: Electron 45.3.2 and
electron-builder 26.18.0. `npm ci` installs the Electron development runtime via
`postinstall: install-electron`; packaging may download additional platform tools.
No server or internet is required by a distributed app.

```sh
npm ci
npm run dev:electron
npm run typecheck
npm run build
npm test
npm run smoke
npm run smoke:missing
npm run smoke:preview
npm run dist:linux
# Run on native Windows for release evidence:
npm run dist:win
```

`npm run dev` retains Vite browser development; `#preview` retains Rachel's view.
`npm run dev:electron -- --smoke` tests the Vite-backed native launcher.
`npm run smoke` uses the compiled `dist`, without Vite. Smoke flags are main-process
only and expose no renderer IPC or filesystem APIs.

Linux output: `release/EVA-RAW-0.1.0-linux-x86_64.AppImage`.
Windows output: `release/EVA-RAW-0.1.0-win-x64.exe` (offline NSIS, unsigned).
The Windows installer may trigger SmartScreen; there is no signing certificate.
Linux needs a supported desktop, graphics libraries, user namespace sandboxing,
and FUSE 2. If FUSE is unavailable:

```sh
chmod +x release/EVA-RAW-0.1.0-linux-x86_64.AppImage
release/EVA-RAW-0.1.0-linux-x86_64.AppImage --appimage-extract-and-run
```

Do not disable Chromium sandboxing to bypass a platform configuration error.
The CI workflow `raw-desktop.yml` builds on native Windows and Linux, runs scene
smokes before/after packaging, and uploads artifacts. It never publishes a release.
No CI links exist yet because this branch has not been pushed/dispatched.

## Contracts and copy/paste examples

The shared, serializable domain types are in `src/core/contracts.ts`.
Distances are metres; time is simulation seconds; X east, Z south, Y up.
`frameId`, CRS and projected origin travel with each region. Visible and playable
bounds differ. The fixed shipped Jezero fixture has a nonzero home `(12,12)`;
this does not override Victor's metadata home or define future mission placement.

Victor's adapter provides nullable heights and explicit bounds. No out-of-range
coordinate is clamped into a fabricated sample. Binary input is read as
little-endian float32 and checked for dimensions, byte count, nonfinite and
no-data sentinel values. Production terrain tiles/LOD remain Victor's work;
`src/terrain/loader.ts` is still a stub, as is Nanda's `src/sim/cost.ts`.

```ts
import { createEngine } from '../core/engine';
import { loadDemoWorld } from '../adapters/world';
const world = await loadDemoWorld();
const engine = createEngine(world.region, world.mission,
  p => world.heights.heightAt(p.x, p.z) !== null);
```

Route providers send local waypoints through `applyRouteCandidate`, with explicit
region/frame/revision, planner provenance and objective order. See the Review Fix
01 contract and before/after example below for the complete exported API.
Routes reject nonfinite/out-of-playable-bounds points, repeated adjacent points,
unsupported sources, invalid lengths and unsafe rendered geometry. The initial
route is explicitly `DEMO`; players can ignore it. This adapter implements no ML
or route cost model.

Rachel's HUD remains untouched:

```tsx
import { toHelmetHud } from '../adapters/hud';
<HelmetHud {...toHelmetHud(engine.getSnapshot())} />
```

Oxygen inventory/capacity are `null` grams. Gauge values read `N/A`; the overlay
says `UNKNOWN / DEMO`. No mission countdown deadline has been approved, so the
app shows elapsed clock seconds. The terrain material's O2/comms features are
turned off; unapproved slope hazard coloration is disabled through uniforms.

All four animator IDs are stable: `abrade-rock`, `take-core`, `sample-depot`,
`run-moxie`. Two deterministic sites demonstrate `take-core` and `run-moxie`.
The visual brief `docs/FOUR-TASK-ANIMATION-BRIEF.md` remains authoritative.

```ts
import type { TaskId } from '../core/contracts';
const animations: Partial<Record<TaskId, { start(): void; finish(): void }>> = {};
const off = engine.onEvent(event => {
  if (event.type === 'reset') return; // animator resets its own visuals here
  const animation = animations[event.taskId];
  if (event.type === 'task-started') animation?.start();
  if (event.type === 'task-completed') animation?.finish();
});
engine.dispatch({ type: 'task-start', siteId: 'demo-core-01' });
engine.dispatch({ type: 'task-finish', siteId: 'demo-core-01' });
off(); // cleanup
```

Commands require a site within 5 m, an unpaused engine and valid status transitions.
The UI labels these as demo semantic signals, not completed science interactions.
Coring uses Rachel's independent prototype; its animation never completes a task
automatically. No Abrade prerequisite. MOXIE never refills astronaut oxygen.

## Clock, movement and lifecycle

The pure core imports no DOM, React, Three, Electron, Node or Python. Commands
produce frozen serializable snapshots and events. `createEngine` exposes
start/pause/resume/reset/step/dispatch/getSnapshot/subscribe/onEvent/dispose.

`createFixedClock` accumulates monotonic wall time at fixed 1/60 s simulation steps,
independent of RAF. Gaps over 250 ms are dropped instead of fast-forwarding an
unobserved mission. Reset clears clock accumulation. Focus loss/hidden documents
clear keys, release pointer lock and pause; the user explicitly resumes. Slow
rendering changes visual sampling, not authoritative simulation time.

Movement defaults (3 m/s walk, 8 m/s run, 1.7 m eye height) are centralized **demo
approximations**, never calibrated suit dynamics. Directions normalize diagonals.
Terrain height follows the original 4 m sampler; the temporary scene mesh samples
it at 8 m (263,169 vertices, 524,288 triangles), rather than replacing Victor's
production pipeline. The orange playable border sits 100 m inside visible terrain.
The HUD warns within 10 m and core blocks crossing the border. This is demo policy.

React effects abort stale loads and own timers, event handlers and scene cleanup.
The scene stops RAF, disconnects resize/input, frees geometry/material/texture
resources, route/sample/sky resources and WebGL context. Setup errors also unwind
resources. GPU pixel ratio is capped at 2; HUD updates at 10 Hz; the engine steps
at 60 Hz. No claim of comprehensive performance or long-duration leak testing.

## Manual review

1. Launch the AppImage (default app, not `#preview`). Confirm real terrain, stars,
   helmet, `DEMO route`, arrow path, two yellow task markers and blue home marker.
2. Click terrain, use mouse/WASD and Shift. Esc releases pointer lock. Confirm X/Z
   change, camera stays above terrain, and no diagonal speed boost.
3. Pause/resume/reset. Confirm paused time/position stay still, reset returns home
   and objectives pending. Switch away from the window and confirm automatic pause.
4. Reach a site, release pointer lock and press Start/Finish demo task. Confirm the
   HUD objective count follows commands. No oxygen refill occurs.
5. Travel to an orange playable edge. Within 10 m the HUD says turn back; movement
   stops at the line while outer landscape remains visible. This long traversal
   is covered by core tests; a full manual boundary walk is still a review step.
6. Open Visual preview; return by removing `#preview`. Confirm only one app canvas.
7. Disconnect networking, restart the packaged app and repeat. The app blocks all
   external renderer requests by policy; physical network disconnection still
   requires user verification.

Automated screenshots are saved in the OS temp directory as
`raw-engine-smoke.png`, `raw-preview-smoke.png`, `raw-missing-smoke.png`.
Final copies and hashes are under ignored `release/` when present.

## Limitations and deferred work

Native Windows verification and physically disconnected offline review are release
verification gaps, not silently passed checks. Native Linux Electron smokes are
real GUI runs; Windows cross-building does not establish Windows execution.
Six moderate npm audit findings stem from build-tool minimatch glob amplification;
no forced downgrade or unrelated upgrades were made. Builder uses the default icon;
Vite warns about the approximately 925 kB renderer chunk. npm may warn about an
unused Squirrel helper install script; the selected Windows format is NSIS.

Deferred: calibrated physics/gait/masses/O2, Leash/cost/survival models, actual ML,
random mission regions, hazards, four complete minigames/final animations,
orbital/flight sequences, macOS packaging/signing and launch marketing. Shipped
terrain provenance is inherited from this repository; this work does not newly
certify NASA accuracy or claim new terrain data processing.

## File ownership audit

Changes across both phases are limited to these files (plus this document and the
verification report):

- `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`
- `.github/workflows/raw-desktop.yml`, `electron-builder.json`
- `electron/main.cjs`, `electron/smoke.cjs`, `scripts/dev-electron.mjs`
- `src/app/App.tsx`, `src/app/App.css`
- `src/core/contracts.ts`, `src/core/engine.ts`
- `src/adapters/world.ts`, `src/adapters/clock.ts`, `src/adapters/input.ts`,
  `src/adapters/scene.ts`, `src/adapters/hud.ts`
- `tests/core.test.mjs`, `tests/desktop.test.mjs`
- `docs/RAW-ENGINE-PHASE-I.md`

`git diff --name-only ac2e18819e3462a89798fb88a75e22cfdd28733e -- src/dev src/ui
src/terrain src/shared src/walk pipeline public` returned no changes. No teammate
ownership exception was needed. The original build workflow is also unchanged.

## Review Fix 01: app-owned integration boundary

These are Alex-owned exported names, reconciled with the **review drafts**
`docs/integration/NANDA-ROUTING.md` and `VICTOR-TERRAIN.md` read from local
`origin/main`. They are not claims of teammate approval or delivered ML/mesh.
No new solver, asset format, slope suitability rule or physics is introduced.

Before, a core route was only `{ source: 'demo' | 'ml' | 'none', points: XZ[] }`
and `HeightProvider` exposed only `bounds` and `heightAt`. Existing demo/none
inputs and pure-core legacy ML inputs remain accepted. Core validation is metric
validation only; integrations must use the app boundary, never treat direct
`engine.dispatch({type:'route', ...})` as terrain/planner approval. Scene rendering
always runs the full validation even if a caller bypasses that boundary.

After, `Route.source` also supports `computed` (classical) and `hybrid`.
`Route.context?: RouteContextV1` contains `contractVersion`, region/frame/revision,
planner kind/name/version and `visitOrder`. `Route.unavailableReason?: string`
explains absence. Planned routes require context at the app boundary:

```ts
// Before: no frame, revision, objectives or truthful classical provenance.
engine.dispatch({ type: 'route', route: { source: 'ml', points } });

// After: points start at mission.shuttle and include both objective positions.
// Example assumes the candidate is classical; it does not implement an algorithm.
const result = applyRouteCandidate(engine, world.heights, {
  source: 'computed', points,
  context: {
    contractVersion: 1,
    regionId: world.region.id,
    frameId: world.region.frameId,
    terrainRevision: world.heights.terrainRevision,
    planner: { kind: 'classical', name: 'Actual solver name', version: 'Actual version' },
    visitOrder: [world.mission.tasks[0].id, world.mission.tasks[1].id],
  },
});
// result: {ok:true} or {ok:false,reason}; failure publishes source:'none',
// points:[], unavailableReason. No replacement path is fabricated.
```

`applyRouteCandidate`, `validateSceneRoute` and `createRouteVisual` are exported
from `src/adapters/routes.ts`; `RouteContextV1` is in `src/core/contracts.ts`.
Planner kinds map exactly: demo → demo, trained-ml → ml, classical → computed,
hybrid → hybrid. An unversioned planned route is rejected by the scene.
External exhaustive source/event switches must handle the added variants.

Exactly two mission objective IDs are required for planned routes, each present
once in `visitOrder`. Their **first** encounters must occur in that order, both
at waypoint level and on the rendered lookup polyline. Shuttle and objective
position tolerance is **1 metre**, an app integration choice pending team review,
not a physical suitability threshold. A return to the same shuttle is allowed;
first encounter semantics do not forbid retracing. The core deliberately remains
flexible in mission task count/types; `demoMission` supplies two distinct types.

Visual safety uses the same Three.js centripetal Catmull-Rom curve and default
arc-length divisions as Rachel's current `createRoutePath`, then its exact
`max(2, ceil(length * 4))` spaced lookup table. Every segment between table
entries is checked against playable bounds and valid bilinear cells, expanded
by a conservative **0.75 m** radius for the centred chevron and bevel. This tests
the geometry the renderer actually interpolates, including smoothing excursions.
The rectangle test can reject a safe near-edge path; it never clamps or fabricates
height. The scene rejects visuals above 200,000 table steps (about 50 km lookup
length), separately from the existing 10,000-waypoint input cap. If Rachel changes
her curve/table/arrow dimensions, this adapter must be reviewed with her.

`createRouteVisual` owns identity-based rebuild, disposal and recoverable route
errors, including errors during `update`/`setProgress`. The app displays
`Route unavailable: ...`; RAF, sky, player and simulation continue. Failed route
identities are remembered rather than retried every frame. A new valid identity
or reset restores the route. No renderer-owned files are modified.

`createHeightGrid` still consumes the existing float32 little-endian grid and
returns `HeightGrid` (`bounds`, `cellMetres`, nullable `heightAt`, `coversArea`).
`HeightProvider` extends this with `contractVersion:1`, `regionId`, `frameId`,
`terrainRevision`, `coverage:'bilinear-valid-cells'`, `noDataPolicy:'reject-scene'`.
`Region.terrainRevision` is optional for core backwards compatibility and always
set by `loadDemoWorld`. The demo revision is SHA-256 over a deterministic descriptor
containing a SHA-256 of grid bytes, region/frame/CRS/origin/bounds, grid dimensions,
spacing, encoding and no-data interpretation. Compare the returned opaque string;
it is not the raw grid file hash. Byte or coordinate-transform changes invalidate
old plans. Future Victor adapters must supply matching identity, nullable sampling
and conservative `coversArea` semantics for their actual asset; this does not
prescribe a second permanent terrain file format.

No-data remains nonfinite or absolute sample >= 1e30, with all four bilinear
neighbours required. Outside coverage returns null. RAW intentionally rejects the
**whole scene** if any grid cell is invalid, including holes between display mesh
vertices. Partial mesh rendering is deferred for Victor review. No fake 0 m
fallback is used.

Snapshots now share frozen region, mission, task and route objects until those
fields change. Input updates private movement intent without publishing redundant
snapshots; steps publish elapsed simulation time. Route replacement copies and
freezes only once; reset reuses the frozen initial snapshot. `route-changed`
(source, simTimeSeconds) joins existing task/reset semantic events. Task updates
replace only the affected task/list/mission. Input deduplication clears on reset,
unlock, pause, blur and visibility loss, retaining unsubscribe/dispose behavior.
The app overlay also labels unknown resources NOT SIMULATED and chooses the
nearest pending/active task so a finished site cannot block interaction.
