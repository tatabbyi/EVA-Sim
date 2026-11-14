# EVA Sim team plan

HackAthlone, TUS Athlone. Build Sat 14 Nov 09:00 to Sun 15 Nov 05:00 (feature freeze). Presentations Sun 11:30. Online submission closes Sun 23:59.

Research notes are in `research/` (files 00 to 13). This plan says who does what, in what order, and what each person hands to the others. Read your own section and section 2 before 09:00.

## Contents

1. Team and roles
1a. Vision: the EVA world (Rachel's whiteboard)
2. Shared contracts (read this whole section)
3. Rachel: look and graphics
4. Alex: app logic, build and integration
5. Victor: terrain at the right place and height
6. Nanda: pathfinding and VR
7. Aadila: presentation and submission
8. Timeline and check-ins
9. What to cut if we fall behind
10. Working together
11. Kickoff agenda (09:00 to 09:45)
12. Final checklists

---

## 1. Team and roles

| Person | Owns | Hands to |
|---|---|---|
| **Rachel** | How it looks: terrain shader, colours, HUD design, overlay styling, helmet view, visuals for the demo | Alex (styles, HUD design), Nanda (VR HUD), Aadila (screenshots) |
| **Alex** | App shell, modes, map,, Survival Odds worker, Training game rules, Houston view, deploys, merging | Everyone (the running site) |
| **Victor** | Elevation data, reprojection, terrain tiles, height grid, comms viewshed, geologic units, terrain loader | Rachel, Nanda, Alex (all data files) |
| **Nanda** | Oxygen cost formula, O₂-to-home grid (the Leash), route drawing best and par routes, route evaluation, Walk mode camera, WebXR | Alex (cost code, routes), Rachel (Leash grid) |
| **Aadila** | Story, demo video or slides, submission form, source list, SI disclosure, Local Lead contact, Training task text | Whole team (script, deadlines) |

**Critical path: Victor.** Every visual and pathfinding task needs terrain. That is why Victor ships a quick 4 m grid by 11:00 before the full 1 m pipeline (section 5).

**The product in one line:** plan a Mars spacewalk at Jezero on real NASA terrain, see how far you can go and still walk home, and the odds you make it.

**MVP (must exist at 05:00). Decided Sat 14 Nov: free roam is the core.** Walk the real Jezero terrain in first person, follow the outlined path, stop to take an animated rock sample, with the helmet HUD (objectives and time, O₂, temperature, hazard alerts). Plus the Leash line, Survival Odds and the Houston light delay. Everything else is extra. See section 9.

---

## 1a. Vision: the EVA world (Rachel's whiteboard)

From the "PLAN" whiteboard, Sat 14 Nov. This is the agreed understanding so far; open questions for Rachel are at the end.

**In one line:** not one fixed screen, but a **3D world on the real Jezero terrain that you walk around in first person**. What you see depends on where you are and where you look. Plan mode becomes the **Setup** screen before you head out.

### Setup screen (before the EVA)

- **Missions** list: pick the objectives for this EVA.
- **Levels** panel: bars or sliders (meaning to confirm, question 1).
- **Big topographic map**: contour lines, route and destination marker.

### The EVA

- First person on the real terrain: WASD to walk, **Shift to run**, mouse or headset to look around.
- **Dangers are things in the world in your path**: obstacles, rocks, steep ground, and a **cyclone** (dust devil) moving across the terrain.
- **Route arrows on the ground** show the pathfinding route to the current waypoint.
- **Topology local view and highlighting**: the terrain around you is outlined and contoured, and important spots are highlighted.

### The helmet HUD (like a fighter-jet helmet display)

- **Follows your vision**: fixed to the helmet, moves with your head.
- **Some parts move into view depending on head direction** (for example, look down to see more).
- **Nothing on screen that isn't needed**: elements appear only when relevant.
- **Top-left**: objective progress ("3/14") and the current objective ("Rock sample").
- **Centre, only when there's a danger**: "⚠ CYCLONE", then "Switch waypoint to home? [E]". Press E to accept. **Human in the loop**: the suit suggests, the astronaut decides.
- **Bottom (chin)**: "could be hologram", possibly a small holographic topo map of the local area.

### Rules

- **Too slow wipes objectives**: when behind schedule, remaining objectives are dropped and the suit tells you to move or head home.
- The suit tracks **O₂, temperature and pressure, radiation, atmosphere (weather)**, plus objectives and pathfinding.

### Demo mode

- **Shift to run** loses O₂ faster; **when you stop, it refills** (question 4).
- **Two endings**: a dying scene when O₂ runs out, and a happy case when you get home.

### What changes for each person (added to each person's tasks: R4 to R7, A2, A7, N5, V11, D4, D5)

| Person | Change |
|---|---|
| Rachel | HUD reworked to the list above. New visuals: dust devil, route arrows, objective highlights, Setup screen, both endings. Section 3 updated. |
| Nanda | Walk mode becomes **free roam** (WASD, Shift to run, mouse or headset look), not a camera on rails. Route arrows need the current route as a list of points. |
| Alex | Game rules: objectives list and timer ("too slow wipes objectives"), hazard events with an [E] accept prompt, O₂ drain while running, the two endings. The Setup screen is the first screen. |
| Victor | No change to the data. Objective spots and hazards need positions on the terrain (`heightAt`). |
| Aadila | Demo shows the dying scene and the happy case. "Human in the loop" is a strong pitch line. |
| Everyone | **Decided:** free roam is the core. There is an outlined path you can follow, and you can stop at places to take a rock sample, which is animated (R5). |

### Open questions for Rachel

1. **"Levels" on the Setup screen**: difficulty, or starting settings such as O₂ and radiation?
2. **Chin hologram**: a mini 3D topo map of the area around you, your stats (O₂, temperature, radiation), or both?
3. **"Moves into view depending on head direction"**: which parts? Guess: looking down brings up stats and the hologram; objectives and alerts stay visible.
4. **"When you stop, it refills"**: does O₂ actually refill (demo simplification), or does the breathing rate just drop back to normal?
5. **The tall column on the right of the sketch**: is it the cyclone/dust devil? Realistic dust column, or stylised to match the outlined terrain?
6. **Overall style**: stylised line-art terrain like the drawings, or realistic Mars colours with outlines on top?
7. **"3/14"**: 14 objectives, or litres?

---

## 2. Shared contracts

Agree these at kickoff and don't change them without telling everyone. If one changes, the owner posts it in the group chat.

### 2.1 Coordinates (owner: Victor)

- **Projection for all data:** `+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs`. Same as the rover waypoint eastings (research file 01).
- **Origin:** Octavia E. Butler landing site, lon 77.4508°E, lat 18.4447°N. In the projection: **X0 = 4,354,489, Y0 = 1,093,304.** Origin height `h0` = DTM height at the origin, written into `meta.json`.
- **Three.js local frame, metres:**
  - `x = X − X0` (east is +x)
  - `y = height − h0` (up is +y)
  - `z = −(Y − Y0)` (south is +z, north is −z)
- **Lon/lat ↔ local** (needed by Alex for the map and Nanda for routes):
  - 56,222.65 m per degree of longitude, 59,274.70 m per degree of latitude (Mars sphere R = 3,396,190 m, standard parallel 18.4663°)
  - `x = (lon − 77.4508) × 56222.65`
  - `z = −(lat − 18.4447) × 59274.70`
  - and back: `lon = 77.4508 + x / 56222.65`, `lat = 18.4447 − z / 59274.70`
- **Box:** 4,096 m square centred on the origin, from x = −2,048 to +2,048 and z = −2,048 to +2,048.
- **Never use raw projected coordinates in the browser.** Values around 4,354,000 in 32-bit floats jitter by about 0.5 m.

### 2.2 Grids (owner: Victor, except the O₂ grid: Nanda)

All grids share the same sample points, so they line up:

- A grid with cell size `c` has `N = 4096 / c + 1` samples per side.
- Sample `(row, col)` sits at `x = col × c − 2048`, `z = row × c − 2048`.
- Row 0 is the north edge, col 0 the west edge. Row-major, little-endian, no header.
- `gdalwarp -te` for cell `c`: `X0 − (2048 + c/2)`, `Y0 − (2048 + c/2)`, `X0 + (2048 + c/2)`, `Y0 + (2048 + c/2)`. Don't use `-tap`; it breaks the half-cell alignment.

| File | Cell | N | Type | Content | Owner |
|---|---|---|---|---|---|
| `grids/height_4m.bin` | 4 m | 1,025 | Float32 | height − h0, metres. Quick grid for the morning | Victor |
| `grids/height_2m.bin` | 2 m | 2,049 | Float32 | height − h0, metres. Used by `heightAt()` and route profiles | Victor |
| `grids/o2_to_home.bin` | 2 m | 2,049 | Float32 | litres of O₂ to walk home from here. `Infinity` = can't get home | Nanda |
| `grids/comms.bin` | 2 m | 2,049 | Uint8 | 0 = lander visible, 1 = marginal, 2 = dead zone | Victor |
| `grids/units.bin` (optional) | 2 m | 2,049 | Uint8 | geologic unit index, list in `meta.json` | Victor |

### 2.3 Terrain tiles (owner: Victor)

- 8 x 8 tiles of 513 x 513 samples from the 1 m grid, stepping 512. Tile `(tx, ty)` covers columns `tx×512` to `tx×512+512` and rows `ty×512` to `ty×512+512`.
- File: `tiles/{tx}_{ty}.bin`. Layout from research file 05:
  - Uint32 vertex count `nV`, Uint32 triangle count `nT`
  - Float32 × 3nV positions, **already in the local frame** (no per-tile offset)
  - Uint16 indices if `nV ≤ 65,535`, else Uint32
  - Int8 × 3nV normals (normalised), computed from the full 1 m DTM
- Skirts on tile edges, 3 m down, to hide cracks.
- Optional second set `tiles_far/` at `max_error` 2 m for distant tiles.

### 2.4 `data/meta.json` (owner: Victor, fields added by others)

```json
{
  "crs": "+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs",
  "origin": { "X": 4354489, "Y": 1093304, "lon": 77.4508, "lat": 18.4447, "h0": 0 },
  "boxMetres": 4096,
  "home": { "x": 0, "z": 0 },
  "grids": {
    "height_2m":  { "file": "grids/height_2m.bin",  "type": "float32", "n": 2049, "cell": 2 },
    "o2_to_home": { "file": "grids/o2_to_home.bin", "type": "float32", "n": 2049, "cell": 2 },
    "comms":      { "file": "grids/comms.bin",      "type": "uint8",   "n": 2049, "cell": 2 }
  },
  "tiles": { "dir": "tiles", "count": 8, "samples": 513, "step": 512, "maxError": 0.5 },
  "o2": { "usableLitres": 390, "reserveMinutes": 30, "terrainFactor": 1.15 },
  "lander": { "antennaHeight": 3, "suitAntennaHeight": 2 }
}
```

`h0` gets filled in by Victor's pipeline. `o2` is owned by Nanda.

### 2.5 Other data files

| File | Owner | Content |
|---|---|---|
| `data/waypoints.json` | Victor | Perseverance waypoints inside the box, with `x`, `z`, `sol`, `site`, `drive` added |
| `data/traverse.json` | Victor | Rover track inside the box, as local x/z and lon/lat |
| `data/units.geojson` | Victor | Geologic units (SIM 3464), lon/lat, clipped to the box, with unit code and name |
| `data/training.json` | Nanda, text by Aadila | Checkpoints, tasks, par route per leg with par O₂ |
| `data/pois.json` | Nanda | Named targets (delta front, Séítah edge, depot site) with precomputed best route home |

### 2.6 Shared code interfaces

| Function | Owner | Used by | Notes |
|---|---|---|---|
| `kcalPerMetre(tanSlope)` and `o2LitresPerMetre(tanSlope)` | Nanda | Alex, Nanda | From research file 02. Must match the Python version |
| `heightAt(x, z)` | Victor | Nanda, Alex | Bilinear on `height_2m` |
| `evaluateRoute(points)` | Nanda | Alex | Samples every 2 m. Returns per segment `{dist, tanSlope, kcal, o2, seconds}` and totals |
| `o2ToHomeAt(x, z)` | Nanda | Alex, Rachel | Nearest sample of the O₂ grid |
| `commsAt(x, z)` | Victor | Alex | 0, 1 or 2 |
| `loadTerrain()` | Victor | Rachel, Nanda | Returns a `THREE.Group` of tile meshes with Rachel's material set on them |
| `createTerrainMaterial(opts)` | Rachel | Victor's loader | One `ShaderMaterial`, uniforms listed in section 3 |
| `sunDirection(date)` and `lightDelaySeconds(date)` | Alex | Rachel, Alex | Wraps the chosen Mars time code. **West longitude** for Jezero = 282.5492 |

Test values everyone checks against (research file 02, smooth ground, before the 1.15 factor):

| Slope | kcal per m | O₂ per km |
|---|---|---|
| 0° | 0.088 | 18.4 L |
| 10° uphill | 0.171 | 35.6 L |
| 20° uphill | 0.298 | 62.1 L |

### 2.7 Repo layout (owner: Alex)

```
eva-sim/
  LICENSE                 decided at kickoff
  README.md               what it is, how to run, SI note, credits
  pipeline/               Python, run once (Victor, Nanda)
    environment.yml
    warp.sh  tiles.py  viewshed.sh  units.sh  o2_grid.py  routes.py  cost.py
  public/                 static files served by Vercel
    tiles/  grids/  data/
  src/
    app/       shell, modes, state            (Alex)
    map/       MapLibre, Trek tiles, drawing  (Alex)
    terrain/   loader (Victor), material (Rachel)
    walk/      camera rig                     (Nanda)
    xr/        WebXR                          (Nanda)
    sim/       cost.ts (Nanda), odds worker (Alex)
    houston/   time and delay                 (Alex)
    ui/        HUD and style                  (Rachel design, Alex wiring)
  docs/
    style.md        (Rachel)
    sources.md      (everyone adds, Aadila owns)
    submission.md   (Aadila)
```

- One branch per person (`rachel/...`, `alex/...`). Alex merges into `main` at each check-in. `main` always deploys.
- Keep each data file under 50 MB. Alex checks the total size at check-in 1.
- Every source file where AI helped gets a one-line header comment saying so (Space Apps rule, research file 13).

---

## 3. Rachel: look and graphics

**Goal:** EVA Sim looks like one designed thing: outlined terrain that reads at a glance, a 3D world you want to walk through, and a helmet HUD that shows only what's needed (section 1a).

**Read:** section 1a, research files 04 (shaders, WebXR limits), 06 (map), 08 (sun position).

**Gets from:** Victor (4 m grid by 11:00, 1 m tiles by about 18:00), Nanda (O₂ grid, current route points), Alex (sun direction, app shell, game state: objectives, hazards, timer).

**Started (Sat 11:00, first drafts, uncommitted):** `src/ui/palette.ts` (all colours), `src/terrain/material.ts` (contours, slope warning, outlines, Leash line, comms hatching), `src/terrain/beacon.ts` (light pillar marker; may become the waypoint marker or be dropped), `src/ui/HelmetHud.tsx` (from the first whiteboard photo; to rework for section 1a).

### Tasks in order

| # | Task | Done by | Done when |
|---|---|---|---|
| R1 | **Style guide** in `docs/style.md`: palette as CSS variables (ground, outline, Leash safe/warning/limit, comms marginal/dead, HUD text), type, line widths | Sat 12:00 | Alex and Aadila can use the same colours |
| R2 | **Terrain material v1** on the 4 m grid: contour lines (minor 5 m, major 25 m), slope warning from 20° to 25°, crease lines, silhouette rim, simple sun lighting | Sat 13:00 (check-in 1) | Terrain is readable in the browser |
| R3 | **Leash and comms in the shader.** Sample `o2_to_home` with `uO2Left` and draw a glowing line where the value equals O₂ left minus reserve (same `fract`/`fwidth` trick as contours). Tint ground beyond it. Hatch or tint comms dead zones | Sat 18:00 | The line moves when `uO2Left` changes |
| R4 | **Helmet HUD (section 1a)**: follows the head; parts move into view depending on head direction; objectives block top-left ("3/14", current objective); hazard alert centre only when needed ("⚠ CYCLONE / Switch waypoint to home? [E]"); chin hologram. Desktop HTML/CSS for Alex, VR panel spec for Nanda (CanvasTexture) | Sat 20:00 | Alex and Nanda can build it without asking |
| R5 | **World visuals**: the outlined path with flowing arrows (`src/terrain/routePath.ts`, done); rock-sample stops with the animated coring sequence (`src/terrain/sampleSite.ts`, done: corer lowers, drills with dust, lifts the core, stows; press F within 3 m); the cyclone (dust devil) moving across the terrain; obstacles in the path highlighted | Sat 23:00 | Walking the terrain shows where to go and what's dangerous |
| R6 | **Setup screen look**: missions list, levels panel, topographic map with route and destination (replaces Plan mode map styling) | Sun 01:00 | Setup screen matches the 3D look |
| R7 | **Helmet view finish and endings**: visor frame, vignette, line widths at eye height on 1 m tiles; look of the dying scene and the happy case | Sun 02:00 | Walk mode and both endings look finished |
| R8 | **Visuals for Aadila**: best camera angles, 6 to 8 screenshots, title card | first set Sun 01:00, final Sun 05:30 | Aadila has what the demo needs |

### Uniforms for `createTerrainMaterial`

| Uniform | Type | Set by |
|---|---|---|
| `uSunDir` | vec3 | Alex (from Mars time) |
| `uMinor`, `uMajor` | float | Rachel (5, 25) |
| `uO2Grid` | sampler2D (R32F, `NearestFilter`) | loaded from `o2_to_home.bin` |
| `uComms` | sampler2D (R8) | loaded from `comms.bin` |
| `uO2Left` | float, litres | Alex / Training mode, every frame |
| `uReserve` | float, litres | Alex |
| `uGridOrigin`, `uGridSize` | vec2 | from `meta.json`, to map world x/z to grid texture coordinates |

### Watch out

- Outlines and contours **must live in the terrain shader**. `EffectComposer` and `OutlinePass` break in WebXR (research file 04).
- Use `NearestFilter` on Float32 textures. Linear filtering on float textures isn't available everywhere.
- Tile normals come from the full 1 m DTM. If tile edges show seams, tell Victor; don't patch it in the shader.
- No NASA logos, flags or mission identifiers anywhere. Any AI-generated image needs a visible watermark.
- Check colours for colour-blind safety: the Leash must not rely on red versus green alone.

---

## 4. Alex: app logic, build and integration

**Goal:** one working site at a public URL from Saturday lunchtime onwards, and everybody's work merged into it.

**Read:** research files 03 (Survival Odds), 06 (MapLibre and Trek tiles), 08 (Mars time), 10 (Training tasks), 13 (rules).

**Gets from:** Victor (data files, terrain loader), Nanda (cost code, route evaluation, routes), Rachel (styles, HUD design, material), Aadila (task text).

### Tasks in order

| # | Task | Done by | Done when |
|---|---|---|---|
| A1 | **Repo and deploy**: Vite + React + TypeScript, `LICENSE`, README with SI note, folder layout from 2.7, Vercel project, deploy on push to `main`. Pin `three@0.187.0`, `maplibre-gl@6.18.0` | Sat 10:30 | Everyone can clone, run and see a deployed page |
| A2 | **App shell**: Setup screen first, then the EVA (section 1a); one shared state store (route, O₂ left, time, mode, objectives, active hazard), loads `meta.json` | Sat 12:00 | Setup → EVA → back without reloading |
| A3 | **Plan mode map**: MapLibre with the Trek HiRISE `addProtocol` loader (research file 06), CTX layer underneath, scale bar hidden, click to add route points, show route stats from `evaluateRoute` | Sat 13:00 (check-in 1) | Real Jezero imagery on screen, route drawn |
| A4 | **Leash on the map**: draw the O₂ grid as an image overlay coloured by `uO2Left` threshold (canvas → `image` source), refresh when O₂ changes | Sat 18:00 | Map and 3D view show the same Leash |
| A5 | **Survival Odds worker**: 1,000 runs in a Web Worker using the distributions in research file 03, seeded RNG keyed on the route, returns success %, O₂ left at 5th/50th/95th percentile, main cause of failures | Sat 23:00 | Under 1 s for a 3 km route; same route gives same number |
| A6 | **Houston view**: light delay for the chosen date, a message timeline (sent, reaches Earth, reply arrives), and how far the crew walks while waiting | Sat 23:00 | Delay matches 3 to 22 minutes; numbers change with date |
| A7 | **EVA game rules (section 1a)**: objectives list and timer ("too slow wipes objectives": drop the rest and tell the player to head home); hazard events such as the cyclone with an [E] accept prompt ("Switch waypoint to home?"); O₂ drain from `evaluateRoute`, faster while running (Shift), refill when stopped in demo mode; checkpoints and tasks from `training.json`; the two endings (dying scene, happy case) | Sun 02:00 | Can play one full round and reach both endings |
| A8 | **Integration and freeze**: merge at each check-in, fix build breaks, final build at 05:00, tag it | Sun 05:00 | Deployed URL works in a private window |

### Watch out

- MapLibre thinks it's Earth. Any distance it shows is 1.88 times too long. Use Nanda's functions for distances.
- Trek tile URLs are `{z}/{row}/{col}`. The loader uses Trek level `z − 1` (research file 06).
- Mars time library: **west longitude** for Jezero (282.5492). If the team rejects GPL at kickoff, write the sun maths from the NASA GISS Mars24 page instead (research file 08).
- Copy the traverse and waypoint JSON into `public/data`. They have no CORS header.
- Survival Odds: show the % rounded, or as Safe / Marginal / Unsafe bands. 1,000 runs give ±1.3 points at 80% (research file 03).
- Keep a short changelog in the group chat at each merge so Aadila can describe features accurately.

---

## 5. Victor: terrain at the right place and height

**Goal:** every data file in section 2, correct to the metre, and terrain in the browser sitting exactly where the map says it is.

**Read:** research files 01 (DTM facts, `gdalwarp`), 05 (pymartini, tile format), 07 (viewshed section).

### Tasks in order

| # | Task | Done by | Done when |
|---|---|---|---|
| V1 | **Environment**: `conda create -n eva -c conda-forge python=3.12 gdal numpy scipy scikit-image pymartini rasterio`. Share as `pipeline/environment.yml` so Nanda uses the same one | Sat 09:45 | `gdalinfo --version` and `import pymartini` work |
| V2 | **Start the full download** (1.84 GB) in the background, **and** try the `/vsicurl/` warp straight from the server (research file 01), which may pull only the rows needed | start 09:45 | One of the two finishes |
| V3 | **Quick 4 m grid**: warp a 4 m version of the box (`-tr 4 4`, `-te` from 2.2), subtract `h0`, write `height_4m.bin` and a first `meta.json`. Post it in the chat | **Sat 11:00** | Rachel and Nanda start on real data |
| V4 | **Terrain loader** in `src/terrain/`: reads tiles (or the 4 m grid as a plain mesh at first), applies Rachel's material, exposes `loadTerrain()` and `heightAt()` | Sat 13:00 (check-in 1) | Terrain at the right spot, at the right height |
| V5 | **Full 1 m crop**: warp with `-r bilinear`, check no-data with `gdalinfo -stats`, fill holes (`gdal_fillnodata`), make `height_2m.bin` with `-r average` | Sat 14:00 | No spikes, no holes |
| V6 | **Height check**: sample the DTM at 3 waypoints near the landing site and compare with their `elev_geoid`. Post the difference in the chat | Sat 14:30 | Within a few metres, or the offset is known and explained |
| V7 | **Tiles**: pymartini 8 x 8 at `max_error` 0.5 m, normals from the 1 m DTM, skirts, write `.bin`. Report vertex counts per tile | Sat 18:00 (check-in 2) | Full detail terrain in the browser, no visible cracks |
| V8 | **Comms viewshed**: `gdal_viewshed -om GROUND` from the lander (antenna 3 m), classify to 0/1/2 using suit antenna 2 m, resample to 2 m, write `comms.bin` | Sat 21:00 | Dead zones show behind ridges |
| V9 | **Geologic units**: `ogr2ogr` the `GeoUnits_v1` layer from the SIM 3464 database (349 MB zip), reproject, clip, write `units.geojson` | Sat 23:00 | Units show on the map |
| V10 | **Waypoints and traverse** clipped to the box, with local x/z | Sat 23:00 | Rover track lines up with the imagery |
| V11 | **Ground positions for the EVA world (section 1a)**: make sure `heightAt` works anywhere in the box, so objective spots, obstacles and the cyclone sit on the ground | Sat 20:00 | Objects placed by Alex and Rachel never float or sink |

### Checks that prove the terrain is in the right place

1. The landing site at local (0, 0) shows the same ground on the map and in 3D.
2. A crater rim on the HiRISE map lines up with the same rim in the 3D terrain (overlay the map image on the terrain once as a test).
3. `heightAt(0, 0)` returns 0.
4. Waypoint heights match within a few metres (V6).
5. North is −z: the delta is to the west (−x).

### Watch out

- The source DTM is `lat_ts=0`. **Reproject before anything else** or east-west distances are 5% off (research file 01).
- No-data is about −3.4e+38. One missed cell makes a spike kilometres deep.
- pymartini wants (columns, rows): transpose once and pass the same array to `create_tile` and `rescale_positions` (research file 05).
- The geologic map is 100 to 200 m off the terrain (USGS readme). Fine for labels, not for exact boundaries.
- If V7 runs into trouble, ship a plain regular-grid mesh from the 2 m grid and move on. Nobody in the audience will count triangles.

---

## 6. Nanda: pathfinding and VR

**Goal:** the numbers behind the Leash and routes are right and consistent, and the walk feels real (on screen, then in a headset if time allows).

**Read:** research files 02 (cost formula), 07 (Dijkstra, routes), 04 (camera rig, WebXR), 03 (how routes feed Survival Odds).

**Gets from:** Victor (height grids, `heightAt`), Rachel (VR HUD design).

### Tasks in order

| # | Task | Done by | Done when |
|---|---|---|---|
| N1 | **Cost formula** in `pipeline/cost.py` and `src/sim/cost.ts`, with a tiny test for 0°, 10°, 20° (table in 2.6) in both | Sat 11:00 | Both languages give the same three numbers |
| N2 | **O₂-to-home grid on the 4 m quick grid**: SciPy `dijkstra` on the reversed graph from home, 8 neighbours, 25° cap, × 1.15 terrain factor (research file 07) | Sat 13:00 | First Leash visible at check-in 1 |
| N3 | **`evaluateRoute(points)`** in TypeScript using `heightAt`, sampled every 2 m | Sat 15:00 | Alex shows O₂ for a drawn route |
| N4 | **O₂ grid at 2 m** on the full data, written to `grids/o2_to_home.bin` | Sat 18:00 (check-in 2) | Leash line follows real slopes |
| N5 | **Walk mode, free roam (section 1a)**: WASD to walk, Shift to run, mouse look (pointer lock) or headset; eye height 1.7 m on `heightAt`; walking speed from the cost model, faster when running; slopes over 25° block you. Share the current route as points (Rachel's ground arrows) and position and heading (HUD) | Sat 18:00 | Walk anywhere on the terrain |
| N6 | **Routes for Training and POIs**: best route home from each POI, par route per Training leg with par O₂, written to `training.json` and `pois.json` | Sat 23:00 | Alex can build Training mode |
| N7 | **WebXR**: `VRButton`, camera in a rig group, `setAnimationLoop`, HUD as a camera-attached panel using Rachel's design. Test on the headset with `adb reverse tcp:5173 tcp:5173` | Sun 03:00 go/no-go | Walk mode works in the headset, or we drop it |

### Watch out

- **Cost depends on direction.** Build the graph with the slope of each step in the direction of travel, then run Dijkstra **from home on the reversed graph** to get "cost from here to home" (research file 07).
- Use `limit=` in `dijkstra` (full O₂ budget in kcal) to save time.
- A 2 m graph is about 33 million edges and about 0.8 GB at peak. Use int32 indices and float32 weights. A 1 m grid is about 3 GB, so don't.
- Store `Infinity` for cells that can't get home. Check that Rachel's shader handles it.
- VR: yaw only, never pitch the rig. No post-processing. Setting `camera.position` directly gets overwritten by the headset; move the rig.
- The 390 L O₂ supply and 30-minute reserve live in `meta.json` (`o2` block). Change them there only.

### On "machine learning"

Nothing in the plan needs ML. Survival Odds is a Monte Carlo simulation, not ML. Adding ML just to have it won't help the Validity score and has to be disclosed under the SI rules. If N1 to N6 finish early, the better extra is helping Alex with the Survival Odds worker, since it uses the same cost code.

---

## 7. Aadila: presentation and submission

**Goal:** the judges understand EVA Sim in 30 seconds, trust its numbers, and see why it's different from the other route planners.

**Read:** research files 11 (competition), 12 (pitch facts), 13 (rules), 10 (Training tasks).

### Tasks in order

| # | Task | Done by | Done when |
|---|---|---|---|
| D1 | **Kickoff notes**: record the decisions in section 11 and post them in the chat | Sat 09:45 | Everyone sees the same decisions |
| D2 | **Local Lead questions**: local judging format, time per team at 11:30, whether local slots use the same 30 s / 7 slide limit, screen and adapter at the venue | Sat 11:00 | Answers posted |
| D3 | **Web Filter Classification** request for the Vercel URL (Alex gives the URL) | Sat 12:00 | Requested (it can take time) |
| D4 | **Story and script**. Hook, problem, solution, proof, difference (outline below). Include the free-roam EVA from section 1a: the human-in-the-loop [E] prompt, the dying scene and the happy case | Sat 16:00 | Team agrees at check-in 2 |
| D5 | **Objective and task card text** for the 7 tasks in research file 10: short title that fits the HUD (e.g. "Rock sample"), one line on the real activity, the game rule, the credit | Sat 20:00 | Alex can put them in the game |
| D6 | **`docs/sources.md`**: every dataset, paper, library and licence. Everyone posts sources; Aadila collects them | ongoing, done Sun 05:00 | Ready to paste into the form |
| D7 | **Draft submission text** in `docs/submission.md` (fields below) | Sun 01:00 | Draft reviewed by Alex |
| D8 | **First demo cut** with footage from Rachel | Sun 03:00 | Rough version exists |
| D9 | **Final video or slides**, English subtitles if video | Sun 09:00 | Exported and uploaded, public link tested |
| D10 | **Rehearse** twice with the team, time it | Sun 10:30 | Under the time limit |
| D11 | **Submit online** right after presenting | Sun ~13:00 | Confirmation received; don't wait for 23:59 |

### Story outline

1. **Hook:** "Apollo crews had a walk-back limit: 6 miles, the distance they could walk back in a pinch." (NASA SP-350)
2. **Problem:** on Mars, help is 3 to 22 minutes away each way. By the time Houston answers, a crew walking home has covered up to 2.5 km.
3. **Solution:** EVA Sim. Plan a spacewalk at Jezero on real NASA terrain, see the Leash, get your odds.
4. **Proof it's grounded:** NASA's own walk-back ConOps uses a topo map, a line-of-sight comms layer and slope-based estimates. EVA Sim builds that for Mars, with a walking cost model from published physiology and NASA suit tests.
5. **Difference:** "Other tools tell you if a route is safe. EVA Sim tells you how likely you are to get home." Survival Odds and the Houston view are what the other projects don't have (research file 11).

### 30-second video storyboard (if video)

| Seconds | Shot | Subtitle |
|---|---|---|
| 0 to 4 | Apollo-style paper map with a circle drawn on it (our own drawing, no NASA logos) | "Apollo crews had a walk-back limit." |
| 4 to 8 | Earth and Mars with a signal travelling slowly | "On Mars, help is up to 22 minutes away." |
| 8 to 16 | Plan mode: draw a route on Jezero, Leash line appears | "EVA Sim shows how far you can go and still walk home." |
| 16 to 21 | Survival Odds counting up across 1,000 runs | "1,000 simulated walks give your odds." |
| 21 to 25 | Houston view timeline | "And what Houston sees, minutes late." |
| 25 to 28 | Helmet view walking the route | "Then rehearse it from inside the helmet." |
| 28 to 30 | Title card | "EVA Sim. Built on NASA Mars data." |

### 7-slide outline (if slides)

1. Title, tagline, team
2. The problem: walk-back limits and the light delay
3. What NASA already plans (ConOps walk-back, Apollo)
4. EVA Sim in action: Plan, Walk, Training (screenshots)
5. How it works: NASA data → walking cost → Leash → 1,000 runs
6. NASA data used, with sources
7. What's next and why it matters

### Submission form fields (from research file 13)

| Field | Source |
|---|---|
| Project Name | Team decision |
| High-Level Project Summary | Story outline, 3 to 4 sentences |
| Link to Project Demo | Video or slides, public link |
| Link to Final Project | Vercel URL and GitHub repo |
| Detailed Project Description | What it does, how, benefits, tools (Vite, React, TypeScript, Three.js, MapLibre, Python, GDAL, SciPy, pymartini) |
| Use of SI | Which parts used AI (research help, code help). Honest and specific |
| NASA Data | HiRISE DTM mosaic (USGS), HiRISE and CTX mosaics via Mars Trek, SIM 3464 geologic map, Perseverance traverse and waypoints, raw images API, Mars fact sheet, Apollo metabolic and time-and-motion reports, Joint AR ConOps |
| Space Agency Partner Data and Other References | Everything in `docs/sources.md`, including code libraries and their licences |

### Watch out

- English everywhere. A video needs English subtitles.
- No recognisable people under 18 in the video or screenshots.
- No NASA logos, flags or mission identifiers. Watermark any AI-generated image or video.
- Test every link in a private browser window. No logins.
- Space Apps scores mostly on the submission page, not the demo, so the written description matters.

---

## 8. Timeline and check-ins

Check-ins are 10 minutes, everyone in one place. Each person says: done, next, blocked.

| Time | Milestone | What must be demonstrable |
|---|---|---|
| **Sat 09:00** | Kickoff (section 11) | Decisions made, repo exists |
| 10:30 | Repo deployed | Blank site live on Vercel |
| **11:00** | **Quick 4 m grid shared** | Victor posts `height_4m.bin` + `meta.json` |
| **13:00** | **Check-in 1** | Terrain renders at the right place; Trek imagery on the map; a drawn route; first Leash from the 4 m grid |
| 13:00 to 14:00 | Lunch, staggered | |
| **18:00** | **Check-in 2** | 1 m tiles; 2 m O₂ grid; Leash in 3D and on the map; route O₂ numbers; Walk mode follows a route; shader v1 done; script agreed |
| 19:00 | Dinner, staggered | |
| **23:00** | **Check-in 3** | Survival Odds; Houston view; comms dead zones; units and rover track on the map; Training data ready. Cut decisions (section 9) |
| Sun 01:00 | Footage and draft submission | Rachel's first screenshots; Aadila's draft text |
| **03:00** | **Check-in 4, VR go/no-go** | Training mode playable; VR works or is dropped |
| **05:00** | **Feature freeze** | Tagged build on Vercel. Bug fixes only after this |
| 05:00 to 09:00 | Demo production | Video or slides, form text final |
| 09:00 to 10:30 | Rehearse twice | |
| **11:30** | Presentations | |
| after presenting | **Submit online** | Don't leave it to 23:59 |

### Sleep plan (suggestion)

Twenty hours is long. Stagger so each pair always has one person awake.

| Person | Sleep |
|---|---|
| Aadila | Sat 21:00 to 00:30 (heavy work after the freeze) |
| Victor | Sun 00:00 to 03:00 (data done by then) |
| Nanda | Sun 00:30 to 02:30, back for the VR go/no-go |
| Rachel | Sun 05:30 to 08:00 (after final screenshots) |
| Alex | Sun 05:30 to 08:00 (after the freeze build) |

---

## 9. What to cut if we fall behind

Decide at check-in 3 (23:00). Cut from the top of this list first.

1. **VR.** Desktop helmet view is enough for the demo.
2. **Training mode depth.** Keep 3 tasks instead of 7, drop the end screen.
3. **Geologic units on the map.** Nice context, not core.
4. **Comms dead zones.** Keep if `comms.bin` exists; drop the styling polish.
5. **1 m tiles.** Fall back to the 2 m regular mesh.

**Never cut:** real terrain, the Leash, Survival Odds, the Houston delay number, the demo. Those are what make EVA Sim different (research file 11).

---

## 10. Working together

- **One group chat** for everything. Post files and decisions there, not in private messages.
- **Stuck for 30 minutes? Ask your pair.**
  - Rachel and Victor: terrain looks wrong (normals, seams, scale, placement).
  - Nanda and Alex: numbers don't match between the Leash, route and odds.
  - Aadila and Rachel: footage and visuals.
- **Changing a contract in section 2?** Tell the owner first, then post it.
- **Sources:** when you use a paper, dataset or library, post the link. Aadila collects them.
- **AI use:** note it in a header comment and tell Aadila what for. Required by Space Apps.
- **Data files:** regenerate from `pipeline/` scripts rather than editing by hand, so we can rebuild if something changes.

---

## 11. Kickoff agenda (09:00 to 09:45)

| Minutes | Item | Who |
|---|---|---|
| 0 to 5 | Goal and MVP (section 1), timeline (section 8) | Aadila |
| 5 to 15 | Walk through the contracts in section 2. Any objections now | Victor, Nanda |
| 15 to 30 | Decide the items below | All |
| 30 to 40 | Each person states their first 2 tasks and their 13:00 target | All |
| 40 to 45 | Set up chat, repo access, Vercel access | Alex |

### Decisions to make

1. **Licence.** GPL-3.0 (keep mars-date-utils) or Apache/MIT (write our own Mars24 sun maths). Space Apps needs an OSI licence either way.
2. **Home point.** Landing site (flat, safe) or nearer the delta (more slope, more drama). This sets `home` in `meta.json`; the box origin stays at the landing site.
3. **Video or slides** for the demo, and which feature leads it.
4. **VR in scope or stretch.** Who has a headset, and which one?
5. **Lander antenna height** for the viewshed. 3 m placeholder.
6. **Project name and tagline** (can wait until check-in 2).
7. **Leash grid at 2 m.** Fine for everyone?

---

## 12. Final checklists

### Before feature freeze (Sun 05:00, Alex leads)

- [ ] Deployed URL works in a private window on a laptop and a phone
- [ ] Plan mode: terrain, imagery, route, Leash, Survival Odds, Houston delay all on screen
- [ ] No console errors on load
- [ ] Credits visible in the app (HiRISE, CTX, USGS, Perseverance images with their `credit` strings)
- [ ] `LICENSE` and README with SI note in the repo
- [ ] Build tagged

### Before presenting (Aadila leads)

- [ ] Video ≤ 30 s with English subtitles, or ≤ 7 slides in English
- [ ] No under-18s, no NASA logos, AI images watermarked
- [ ] Demo link public and tested in a private window
- [ ] Laptop charged, adapter for the venue screen, offline copy of the video
- [ ] Rehearsed twice, timed

### Submission (right after presenting)

- [ ] All form fields filled from `docs/submission.md`
- [ ] NASA Data field names each NASA dataset used
- [ ] References list every library and dataset, with licences
- [ ] SI use described honestly
- [ ] Every team member registered for the HackAthlone event (otherwise not eligible for global judging)
- [ ] Submitted, confirmation screenshot posted in the chat
