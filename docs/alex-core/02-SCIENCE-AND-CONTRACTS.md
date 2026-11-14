# Scientific and data contracts — research snapshot + review notes

**Provenance:** existing `TEAM-PLAN.md` §§2, 4–6 and `research/01`–`13`, checked in fork main @ `4e3521e`, 2026-11-14. These are researched/proposed choices, **not newly agreed specifications or scientifically validated operational parameters**.

## Spatial contract
- Location: Jezero Crater, Octavia E. Butler landing site (lon 77.4508° E, lat 18.4447° N).
- Mars sphere R=3,396,190 m; projected CRS: `+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs`.
- Projection origin X0=4,354,489, Y0=1,093,304, height h0=DTM height at origin (currently placeholder 0 in static meta).
- Local frame: x=X-X0 east, y=height-h0 up, z=-(Y-Y0) south. lonLocal scale: 56,222.65 metres/degree; lat scale: 59,274.70 metres/degree. No raw 4M+ projected coords in Float32 browser geometry.
- Area: 4,096 m by 4,096 m, from -2048 to +2048 in x,z. For cell size c metres, n=4096/c+1; row-major grid; row 0 north edge; col 0 west edge; sample (row,col) maps (col*c-2048, row*c-2048).
- Alignment: `gdalwarp` extent must incorporate half-cell offsets; the final TEAM-PLAN §2.2 explicitly says **do not use -tap**. Research/01 contains an older `-tap` example. Treat final contract as provisional leader, confirm with Victor.

## Source data
- Source DTM: USGS HiRISE Jezero TRN DTM, approximately 1.84GB, Float32, source pixel east-west actual scale ~0.949 m at target latitude; reproject first to chosen eqc standard parallel.
- `height_4m.bin` Float32 1025x1025; `height_2m.bin` Float32 2049x2049.
- `o2_to_home.bin` Float32 2049x2049, in litres, Infinity means no accessible home path.
- `comms.bin` Uint8 2049x2049: 0 visible, 1 marginal, 2 dead zone.
- Optional `units.bin` Uint8 geologic unit indices; USGS SIM3464 polygons have ~100–200 m registration offsets.
- Terrain: 8x8 `tiles/{tx}_{ty}.bin`; each originates at 513x513 samples stepping 512; header nVertices+ nTriangles as little-endian UInt32, float32 xyz positions, UInt16 vs UInt32 triangle indices by vertex count, optional Int8 normalized normals, 3 m skirts. Format needs final confirmation with Victor.
- Map imagery: Mars Trek HiRISE (Jezero controlled mosaic) + CTX. Need custom MapLibre re-cut protocol or precomputed local imagery; MapLibre distance calculations use Earth radius and overestimate Mars distances ~1.88x. Avoid native map distance/scale calculations.
- Rover waypoints/traverse must be copied locally (NASA endpoints lack CORS); raw images JSON API offers site/drive matching and CORS, images may not have texture-friendly CORS.

## Metabolic model (research/02)
For tangent slope t (positive uphill, in travel direction):
```text
Cw(t) = 280.5*t^5 - 58.7*t^4 - 76.8*t^3 + 51.9*t^2 + 19.6*t + 2.5
v(t) = 1.092 * exp(-3.5 * abs(t + 0.05))   // m/s
E(t) = 0.03585 * (1.825 + 0.380*(Cw(t)-2.5)) + 0.0210/v(t)  // kcal per metre
O2(t) = E(t)/4.8                            // litres per metre
```
- Assumptions embedded: astronaut 75 kg, Mars g≈3.73m/s² (~0.380 Earth), flat gravity factor 0.73, suited factor 2.0, nominal baseline 3.3km/h on flat.
- Research test anchors BEFORE 1.15 terrain factor: flat ~0.088kcal/m, 18.4L/km; 10° uphill ~0.171kcal/m, 35.6L/km; 20° uphill ~0.298kcal/m, 62.1L/km; 10° downhill ~0.075kcal/m.
- Deterministic 1.15 rough-terrain multiplier suggested. Monte Carlo uses separate triangular terrain/suit multiplier; ensure no accidental 1.15 double count.
- Slope direction matters; research advises 3–5 m smoothing to reduce DTM noise.
- Minetti model measured up to about ±24°, while 25° is used as impassable threshold in graph and shader. Agree one limit or explain boundary zone.

## Leash/path model (research/07)
- Directed 8-neighbour graph on 2m grid; edge slope t=(height(dest)-height(src))/stepDistance; cost=distance*E(t), with terrain penalty.
- Run SciPy Dijkstra on TRANSPOSED graph from home to obtain minimal *cost from anywhere to home*.
- Browser draws contour where `O2_to_home(x,z) = O2_remaining - reserve_litres`.
- Current metadata: `usableLitres:390`, `reserveMinutes:30`, `terrainFactor:1.15`. Current shader has `uReserve=30` in LITRES by default. Must explicitly choose how 30 minutes convert to litres and which activity rate is used.
- If home point moves, static O2 grid from previous home cannot be reused.
- A small 4km box with 390L O2 may have Leash boundary entirely outside the viewport. Need a scientifically disclosed training/emergency O2 scenario to demonstrate it.

## Survival Odds (research/03)
1,000 seeded Monte Carlo runs of planned route + walk home, with proposed variables:
- Metabolic factor: lognormal median 1.0 sigma 0.12, clip [0.7, 1.5].
- Terrain/suit factor: triangular min=1.0, mode=1.15, max=1.5.
- Speed: triangular min=0.7, mode=0.9, max=1.1, max 1.3m/s.
- Normal leak: uniform [0,0.035] L/min.
- Large leak: Bernoulli 0.005 per EVA; 0.5–2 L/min conditional; **unvalidated illustrative assumption**.
- Dust devil counts: Poisson around 3 for 10am–3pm; about 1/3 dusty (assumption); 1–5min delay at resting rate.
- Falls: Poisson 0.15/hour TASK time, not walking; each 0.5–2min delay; 2% chance of injury per fall causing subsequent speed*0.6 — assumptions.
- Communications: deterministic lander viewshed plus optional relay failure; loss affects decisions especially if a failure occurs in a dead zone, not O2 directly.
- Success suggested if returns home with ≥30min reserve, possibly time constraints (undecided). Outputs: success rate; 5th/50th/95th O2 remaining; leading failure causes.
- 1,000-run proportion uncertainty: p=.8 -> SE ~1.3 percentage points; use rounded %. Seed by route to avoid flicker. These are *scenario outcomes of an assumed model*, NOT NASA-certified survival probabilities.

## Houston / time (research/08,12)
- Earth–Mars signal one-way delay approximately 3.0–22.3 minutes, varying by date; a response needs roughly 2x one-way propagation delay (excluding thinking/processing).
- For Jezero solar time library in research: longitude must be WEST **282.5492°**, not 77.4508° E.
- Research proposes `mars-date-utils` v1.1.1 GPL-3.0-or-later; not present in current package deps. Could implement Mars24-based calculations or choose library; verify numerical outputs.
- Existing repo is GPL-3.0-or-later. Need whether Electron app stays GPL and whether public submission variant exists.
- User choice needed: physical date and time controls, daylight effects, communications modelling.

## Visual/render/VR constraints (research/04–06)
- Three.js WebGL ShaderMaterial: contours every 5m and 25m, steep warn 20°–25°, O2 Leash threshold, comms hatching; Rachel already implemented candidate shader at `src/terrain/material.ts`.
- No reliance on EffectComposer/OutlinePass for XR; VR HUD must be world-space texture/mesh, not DOM.
- Normalized tile normals from full-res DTM avoid seams. Float32 O2 grid texture must use nearest filtering or manual shader bilinear.
- Rachel's code includes HelmetHud/Beacon/palette but the App is still a placeholder.

## Scientific and integration risks to resolve
- 'Model' owned by Victor unclear: geometry or physiology/physics.
- The reserve is specified in minutes while the shader uses litres, with current hardcoded 30.
- Deterministic + Monte Carlo terrain factors may be double-applied.
- No definition yet of failure/success for timeouts, injuries, comms, and repairs.
- Return route cost-optimal versus time-optimal might differ.
- Exact mission time/year and solar/day-night semantics not defined.
- Interpolating Infinity in cost grid must not make inaccessible zones artificially safe.
- No data loaded/validated in existing repo, therefore no proven numerical/visual accuracy yet.
- Electron file://, secure asset protocol, GPU/CORS and headset support need design.
- Do not silently alter formulas; record agreed changes and cite evidence if any external verification is performed.

## Ownership/architecture update, 2026-11-14
- **User confirmed:** Alex now owns scientific oxygen formulas, routing/pathfinding and Leash implementation (Q05, D-007). Scientific equations and assumptions above have **not** themselves been validated or accepted by this ownership decision.
- **Victor confirmed responsibility:** developing/improving 3D mesh / geometry as an input to Alex's renderer (Q04, D-006). The user has **not** yet confirmed precise mesh type, density, LOD, normals, texture UVs, coordinate frame or file format.
- **Unresolved:** agreement with Victor on CRS/axis order, tile/mesh file specs, scaling, origin and matching grids is required (Q06). Do not interpret the earlier TEAM-PLAN data contract as final.
- **Runtime requirement:** fully offline Electron only on Windows/Linux/macOS (D-004, D-005). NASA/USGS data may need offline redistribution and attribution; how to prepare, size and package assets remains undecided.
- **Visual ownership:** Rachel's files may be modified only after coordination (D-008).
- **Performance caution:** Electron does not inherently remove Chromium/WebGL memory and rendering limits. GPU profiling, LOD, streaming, and asset budgets are implementation concerns for later approved blocks.
