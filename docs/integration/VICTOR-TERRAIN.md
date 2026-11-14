# Integration Contract V-01 — Victor: Mars Terrain, Height and Region Data

**Owner:** Victor (terrain data, geometry, source CRS/metadata, optional comms/geologic layers)  
**Integrator:** Alex (Electron scene/world adapter + mission region selection); **Consumers:** Rachel (rendering), Nanda (routes), Alex (player physics later)  
**Status:** TEAM REVIEW DRAFT. RAW exports include `HeightGrid`, `HeightProvider`, `createHeightGrid()` and `loadDemoWorld()` (`src/adapters/world.ts`). `RegionManifestV1`, general-region loader and mesh/LOD remain PROPOSED.

## 1. Immediate work Victor can do independently

1. Deliver a **real locally usable elevation source** and an actual renderable mesh/tile/model, with a versioned manifest explaining the coordinate transform, bounding extent and sample heights.
2. Validate the supplied `height_4m.bin` demo and produce the improved **team Mars mesh** or dataset; label source, processing and which coverage is actually available.
3. Implement or provide a replacement for the existing **Victor-owned** `src/terrain/loader.ts` stub, but do **not** change Alex's core or Rachel's shader to force compatibility; request an adapter when data differs.
4. Give Nanda enough data to plan valid routes and Alex enough data to place the shuttle and two task sites at ground height, with declared no-data/invalid regions.
5. If multiple Mars regions are desired, provide an **offline region catalog with real coverage**, not an API dependency or fictional random coordinates.

**RAW v0.1 uses Jezero `height_4m.bin`** as its demo input; a larger random-region system is a subsequent integration step. User's 10 km visible / 5 km playable idea is an **illustrative design direction**, not confirmation that such real terrain has been delivered or that all available regions have those exact dimensions.

## 2. Existing verified sources and legacy contract

### Legacy fixed Jezero mapping (for compatibility only)

From `TEAM-PLAN.md` §2.1 and `src/shared/coords.ts`:
- Projected Mars EQC CRS: `+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs`.
- Projected origin `X0=4,354,489m`, `Y0=1,093,304m`; lon `77.4508° E`, lat `18.4447° N` (Octavia E. Butler site).
- Local frame `x=X-X0` east+, `z=-(Y-Y0)` south+, `y=height-h0` up+, **all metres**.
- Legacy 4096m square `[-2048,+2048]` in both horizontal axes. Sample row 0 north (z=-2048), col 0 west (x=-2048).
- Existing `public/data/meta.json` has `origin.h0:0` and `home:{x:0,z:0}`. These are **legacy demo metadata**, not evidence of measured origin elevation or the final shuttle landing location. The shuttle must be variable for a real mission.

### Current grid/terrain files vs actually implemented loaders

| Source | Legacy format / shape | Current status implication |
|---|---|---|
| `public/grids/height_4m.bin` | Float32 little-endian, 1025×1025, row-major, 4m spacing, no header; **4,202,500 bytes expected** | Present in inspected fork sync tree as demo source; must still verify local file size/data/validity |
| `public/grids/height_2m.bin` | Float32, 2049×2049, 2m | Declared in meta; **not verified as present** in inspected tree |
| `public/grids/comms.bin` | Uint8, 2049×2049 (0 line-of-sight, 1 marginal, 2 dead) | Declared but **not verified as present**; optional future input |
| `public/tiles/{tx}_{ty}.bin` | As documented in `TEAM-PLAN.md` §2.3: little-endian `u32 nV, u32 nT`, positions `3*nV Float32`, indices `3*nT u16/u32`, normals `3*nV Int8`; sample 8×8 tiles at 513×513 | **Not yet confirmed delivered**; Victor must state actual geometry format/version. A full 513×513 vertex tile has 263,169 vertices and therefore needs **Uint32** indices |
| `src/shared/grids.ts` | Existing `loadFloatGrid` checks byte length, `sampleBilinear` / `sampleNearest` **clamp to the demo edge** using `BOX_HALF` | Useful for demo, **not** a safe general-region height query without wrapper |
| `src/terrain/loader.ts` | Exports `loadTerrain(meta,material):Promise<THREE.Group>`, `heightAt(x,z):number`, `commsAt(x,z)` | At inspected baseline each throws `not implemented yet`; Victor must reconcile |
| Rachel `createTerrainMaterial()` | `THREE.ShaderMaterial`; expects local `x,y,z`, normals and height range | Use existing material on imported mesh; owner Rachel approves any shader modifications |

**Do not interpret existing metadata as a guarantee of accessible 2m grids, full 1m tiles or arbitrary Mars elevation coverage.**

## 3. New portable region/world envelope — PROPOSED, not an exported API

```ts
type XZ = { x:number; z:number }; // local metres
type Bounds = { minX:number; maxX:number; minZ:number; maxZ:number };
type HeightSample = number | null; // y in local metres; null = invalid/missing/outside

interface RegionManifestV1 {
  contractVersion:1;
  regionId:string;             // stable identifier for a concrete coverage area
  frameId:string;              // must match route/player/tasks/mesh
  terrainRevision:string;      // version/checksum; routes can reference this
  provenance:{dataset:string; processing:string; licenseOrSource?:string};
  coordinateFrame:{
    crs:string;                // projected Mars CRS (or fully explained local transform)
    originProjected:{xM:number;yM:number};
    originLonLatDeg?:{lon:number;lat:number};
    elevationReferenceM:number;  // h0; must identify vertical datum
    axes:'x-east-y-up-z-south';
  };
  dataBounds:Bounds;           // actual valid coverage / ability to sample
  visibleBounds:Bounds;        // what the app will render
  heightGrid?:{
    file:string; encoding:'float32-le'; rows:number; cols:number;
    cellSizeM:number; sample0:XZ; nodata?:number|null;
  };
  terrainAsset?:{
    kind:'tiles'|'gltf'|'height-mesh';
    path:string; formatVersion:string;
  };
  // Mission-level playableBounds, shuttle location and tasks are assigned by Alex.
}
```

This is a **versioned schema proposal**, not a request that Victor immediately rewrite his existing `src/shared/meta.ts`. Victor should review the fields and return a real sample manifest with actual revision/provenance and an explicit valid-sample policy. If a different format is more practical, agree a lossless documented mapping at Alex's **world adapter**.

**Never conflate:**
- `dataBounds`: known actual valid terrain coverage;
- `visibleBounds`: the larger render area, inside loaded coverage;
- `playableBounds`: **mission-owned** navigable region inside safely sampled coverage, not necessarily centred;
- `shuttle`: mission-specific start/home inside playable bounds, **not** the Mars projection origin.

## 4. Required Victor→Alex provider behavior (proposed semantics)

```ts
// EXAMPLE semantics; actual Codex adapters may use different names.
interface TerrainProvider {
  readonly regionId:string;
  readonly frameId:string;
  readonly terrainRevision:string;
  readonly dataBounds:Bounds;
  heightAt(x:number,z:number):number|null; // local y, metres relative h0
  // Optional future capabilities:
  normalAt?(x:number,z:number):{x:number;y:number;z:number}|null;
  commsAt?(x:number,z:number):0|1|2|null;
  loadSceneGeometry?(material:unknown):Promise<unknown>; // actual adapter may use THREE.Group
  dispose?():void;
}
```

**Sampling rules:**
- Validate `x,z` finite, inside data coverage and supported no-data mask; otherwise return `null`/typed invalid, **never clamp to the nearest border cell** and do not return 0 as an error.
- For valid grid coordinates, bilinear heights are local **metres above `h0`**. Document interpolation choice, handling of no-data neighbors and edges.
- If an elevation sample is NaN/Infinity, grid size incorrect, wrong endianness or shape not matching manifest: load/sampling **fails explicitly**.
- If `normalAt` is provided, normals must be unit-length in the same x-east/y-up/z-south frame; mesh vertex normals and height-derived normals should agree within documented tolerance.
- Route and task validation must not depend on unused static `HOME={0,0}`; placing shuttle on a steep/invalid surface should return a named error rather than pretending it is safe.
- If the rendered mesh uses LOD/decimation, exact ground sampling for walk/route can use a higher-resolution height field, but must not visibly diverge from rendered ground. State tolerances after measuring real data.
- No on-demand terrain streaming from NASA/Mars Trek/cloud providers in the offline desktop app. Any remote retrieval occurs **before release**, producing bundled local files.

## 5. Geometry format, LOD and render compatibility

**Legacy plan** offered a custom tile binary layout; **no fixed GLB choice has been approved**. Victor should choose and document one geometry delivery (tiles, glTF/GLB or an explicitly versioned new binary format), with:
- vertices in correct local metres, `y=height-h0`, `+z=south`; triangle winding/front faces, index width, normal encoding, vertical scale, axis transform and origin;
- actual mesh bounds matching declared manifest; no hidden unit scale (centimetres vs metres), no double transform (`x,z` already local);
- LOD/tile edge continuity, visible cracks/skirt behavior, memory/GPU allocation and measured performance on the real target device;
- whether a single material instance from Rachel `createTerrainMaterial()` can be assigned to meshes without shader changes, and when to call `setHeightRange(min,max)`;
- separate cache/render geometry ownership: one owner disposes shared material, each owner disposes own geometries/textures; no double disposal.

**Original custom tile plan (only if Victor elects to keep it):** `u32 nV`, `u32 nT`, `Float32[3*nV]` positions, `Uint16/Uint32[3*nT]` indices, `Int8[3*nV]` normals. The exact index-width rule and tile count should be documented **per file**; don't assume Uint16 for a 513×513 tile or that the `tiles` directory exists merely because meta.json names it.

**Renderer must use Victor's correct geometry and Rachel's existing look.** Codex's RAW v0.1 heightgrid-generated demo mesh is a temporary adapter, not an instruction to discard Victor's improved mesh.

## 6. Random region and shuttle/task validity — future integration, not RAW v0.1

The agreed later mission flow is: select one **locally available supported Mars region** → compute its visible and playable bounds → choose a safe shuttle landing site → choose TWO independent task objectives/sites → request Nanda's route **through both** → free movement → return to same shuttle.

Victor should supply or document enough geometry/data to decide:
- **coverage and invalid/missing terrain** within the proposed playable region, plus fallbacks when a randomly selected region is not usable;
- optional candidate safe landing areas/terrain suitability features (slope/clearance/obstacles) **without deciding final physical pass/fail thresholds on Alex's behalf**;
- reachable task sites and no discontinuities/bad height samples between sites (route solver decides navigability);
- validation of larger visible terrain around the playable zone, so the border looks like a continuous landscape;
- local region frame/origin where shuttle can be at any valid `XZ` site without global `BOX_HALF=2048` dependencies.

**Do not claim the current fixed 4,096m grid supports a visible 10×10km region or random selection anywhere on Mars.** Actual supported geography must be drawn from a verified bundled terrain catalog.

## 7. Integration tests and acceptance

Victor should supply:
1. **One actual 4m Jezero demo fixture check**: exact `height_4m.bin` byte count, metadata, SHA/revision, 3–5 `heightAt` samples including one near each side, sample outside coverage returns `null`/error.
2. **A tiny synthetic grid** (e.g., 3×3) with known elevations, a no-data cell and known interpolation, labelled **TEST ONLY**. This catches flipped row/col, south sign, wrong offset and border clamping.
3. **A real rendered mesh/tile fixture** and 2–3 checkpoints with expected `{x,y,z}` and vertex normal orientation.
4. **Region manifest + data provenance**: file paths, projection/origin, elevation reference, grid/mesh dimensions, actual visible extent, no-data mask and asset size/hash.
5. **Brief performance note** from real Electron/WebGL or a similar Three.js runner: time to load, actual geometry count, GPU/memory tradeoff and LOD coverage; values measured, not guessed.

### Contract test checklist

- [ ] `frameId` agrees across geometry, height grid, shuttle, routes and task markers.
- [ ] Rows advance **south** (positive z), cols advance **east** (positive x); no east/west or north/south inversion.
- [ ] `heightAt` returns finite local metres for valid points, explicit null/error outside coverage and no-data.
- [ ] Sampled height and rendered mesh surface align within reported tolerance; no arbitrary h0=0 assumption.
- [ ] Demo and improved meshes display under Rachel's material without editing her shader.
- [ ] Exactly declared region/asset coverage; missing 2m grid/tile files do not produce silent flat terrain.
- [ ] The data and textures load **offline** in Windows and Linux packaged applications (Alex tests alongside Victor).
- [ ] Mission playable bounds may be smaller than visible terrain; shuttle not forced to original Jezero origin.
- [ ] No unstable huge projected `X,Y` coordinates are fed directly as Float32 Three.js vertex positions.

## 8. Questions to resolve with Victor before the final mesh import

- What **exact** asset do you deliver: height-grid only, custom `.bin` tiles, GLB/glTF, or something else? Which loader/metadata revision?
- Which exact Mars location(s), resolution and **real usable extent** do we have offline? One Jezero scene or a catalog?
- Is the source height vertical datum/`h0` known and reproducible? What does `public/data/meta.json`'s current `h0:0` represent?
- Which no-data sentinel/coverage mask is used, and can every proposed task/landing location be sampled?
- Will you provide `heightAt(x,z)` and the mesh in the **same local frame**? How close is visual mesh Y to the height sampler?
- Who is responsible for tiles/LOD/collisions vs merely data output? What are measured memory/GPU limits on actual demo hardware?
- Are comms and geology separate optional artifacts? Which actual files exist, not merely names in legacy `meta.json`?

**Source baseline:** `TEAM-PLAN.md` historical section 2, `src/shared/{coords,grids,meta}.ts`, `src/terrain/loader.ts`, `public/data/meta.json`, and implemented `src/adapters/world.ts`. See [API reconciliation](RAW-V01-API-RECONCILIATION.md).
