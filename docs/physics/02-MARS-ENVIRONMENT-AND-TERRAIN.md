# Mars physical environment, terrain and data semantics

## 1. Which environment is being simulated
The player starts from a **preselected** shuttle landing point in an **offline** Jezero-compatible region. A 10 x 10 km visible / 5 x 5 km playable area remains a future illustrative design; inspected RAW current dataset is a **4,096 m square**, with a smaller playable box. The astronaut does not choose landing coordinates in either the demo or the future full game; later software may randomly select a *supported* region with verified coverage.

The user approved **real Mars constants and a fixed-weather scenario**. It does not imply a validated planetary climate simulation or true MEDA weather on the chosen game sol.

## 2. Physical parameters and effect on gameplay

| Quantity | Demo value | Origin | Physical interpretation / simulation status |
| --- | ---: | --- | --- |
| Gravity | 3.711 m/s^2 | Conventional Mars reference; NASA Glenn approximate 3.7 | Use in `weightN = mTotalKg * gravity`; **mass/inertia stays unchanged** |
| External ambient temperature | -60 C | Chosen Mars-like scenario | Read-only ambient **outside** suit, not human body or suit-core temperature |
| External pressure | 635 Pa = 0.635 kPa | Chosen Mars-like scenario | Near-vacuum environment; suit pressure control is **not modeled** |
| External CO2 fraction | 0.953 | Chosen CO2-rich scenario | Astronaut cannot breathe it; ambient CO2 is not a suit oxygen source |
| Mars airborne dust / wind | not time-variable | Unimplemented | No wind drag or dust-devil probabilities; visual dust is presentation only |
| Radiation / thermal balance | not modeled | Out of demo | Never show actual dose/heat-flow numbers without models |

NASA-verified sources: `NASA-DATA-AND-PRIMARY-SOURCES.md` N06 (Mars gravity), N08 (MEDA real weather when a particular sol/product is obtained). NASA PDS MEDA can replace demo constants in the future, **only with product identifier/version and measurement context**.

### Caveats on "realistic"
- A 3.711 m/s² reference value does not mean speed is simply Earth speed times 0.38. Reduced gravity changes gravitational force, but suit mobility, inertia, pressure garment, terrain, gait and metabolism have separate effects [N02-N04].
- Ambient temperature may inform the renderer and HUD **only when labeled OUTSIDE/AMBIENT**; Rachel's suit temperature gauge might mean *inside the suit* and must remain N/A until approved.
- No atmospheric oxygen refill, no water balance, CO2 scrubber, suit internal pressure, radiation shielding or dust penetration model. These are unmodeled.

## 3. Terrain and coordinate contract actually present in RAW
- `Region` in `src/core/contracts.ts` includes `id`, `frameId`, `terrainRevision`, `crs`, projected origin, `visibleBounds` and `playableBounds`.
- Local metric axes: **X east, Z south, Y up**. Player movement and objectives are `{x,z}`; scene y comes from `heightAt(x,z)`.
- `src/adapters/world.ts` publishes `HeightProvider` with `heightAt(x,z): number|null`, `coversArea(bounds)`, `cellMetres`, matching region/frame/revision. The demo loader validates dimensions and SHA-based revision and returns null rather than invented heights outside coverage.
- Demo height source: `public/grids/height_4m.bin`, Float32 LE grid **1025 x 1025**, 4m sampling over **4,096m**. Existing scene generates a separate decimated **512 x 512 segment** mesh (~8m spacing), NOT true 2m geometry.
- Victor's independent branch has higher-resolution 2m data and 64 tile binaries, but source provenance, actual loader, mesh format, extent and normal winding must be verified at integration. Do not assume 10 km coverage or arbitrary landing coordinates.
- **Data lineage**: Without a PDS bundle/product identifier + transform and hash for Victor's binaries, credit them as "processed Mars terrain supplied by teammate; source/product provenance pending", not "verified NASA 2m DTM". See source registry N07-N09.

A **real possible provenance source** is the USGS *Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic* (2020), DOI **10.5066/P9REJ9JN**: 1m Jezero elevation GeoTIFF with source XML/LBL (NASA source list N12). The NASA Mars Trek portal serves visual Mars imagery (N13); **25cm imagery resolution is not a 25cm height grid**. Neither proves which source and GDAL transforms Victor used: demand exact original checksum, processing log, CRS/vertical datum and derived hash.

## 4. Slope is directional
For horizontal motion from `(x,z)` along normalized heading `u=(ux,uz)` and probe distance `d`:
~~~text
hFront = heightAt(x + d/2*ux, z + d/2*uz)
hBack  = heightAt(x - d/2*ux, z - d/2*uz)
grade  = (hFront - hBack) / d                // rise / horizontal run, signed
angle  = atan(grade) * 180/pi                // degrees, uphill positive
~~~
- Reversing direction changes signed grade. A 10-degree uphill outbound segment is approximately 10-degree downhill on return. Reusing a forward-only cost graph for return is incorrect.
- If `heightAt` returns null, NaN or non-finite, reject the attempted motion or return an explicit invalid sample; **never replace with zero elevation** or clamp to edge.
- **25 degrees** is a ***Sharkies demo mobility restriction***. It is not a NASA universal EVA safety threshold or validated astronaut fall probability.
- The first-pass **1m symmetric slope probe** is a heuristic. An elevation grid sampled every 4m does NOT have 1m independent measurement resolution. Probe length is to be reviewed with Victor against DEM resolution, noise and tile seams; do not claim sub-grid science fidelity.

## 5. Rendering is not authoritative physics
- Rachel's `src/terrain/material.ts` height tint, rim lighting and 20/25 degree warning are **visual**. The independent shader uses optional litres-based `uO2Grid`/`uO2Left`, incompatible with gram-based suit physics: keep disabled.
- The renderer's mesh can be lower resolution than the height source. Physics samples `HeightProvider`, not shader normals, palette RGB, drawn contours or screen pixels.
- Route visuals use validated local coordinates. PDS topography and site photos are not automatically a binary walkability, friction or rock-distribution dataset.

## 6. Future environmental realism backlog, no three-hour implementation
- True MEDA time series for a chosen sol and coordinate reference; atmospheric seasonal/time variation.
- Solar elevation and Mars local solar time (Rachel research/08); solar heating and wind-cooling of suit after a verified suit thermal model.
- Locomotion on granular regolith, rock obstacles, slips/falls and dust effects, requiring rover/analog evidence plus geometry.
- NASA MOLA PDS4 catalog and specific HiRISE DTM products; automated site selection only from covered/raster-validated regions.
- Radiation exposure and suit protection, only with specific data/models.
