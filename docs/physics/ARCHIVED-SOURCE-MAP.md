# Historical source map — archived Alex docs and Rachel's original research

**No original source was copied over, rewritten or deleted.** The new physics documentation interprets them; original content remains reachable. This matters for audit, intellectual attribution and future re-calibration.

## Original Alex physics and environment work retained in archive
Archive ref: `mokachkasss/Sharkies:archive/main-pre-team-sync-20261114-05ec566`
Repository link: https://github.com/mokachkasss/Sharkies/tree/archive/main-pre-team-sync-20261114-05ec566

| Original path | What it records | Consolidated counterpart |
| --- | --- | --- |
| `docs/alex-core/03-OPEN-QUESTIONS.md` | Q-series uncertainties, unresolved NASA/gear/movement inputs | `09-OPEN-QUESTIONS-AND-ROADMAP.md` |
| `docs/alex-core/04-DECISIONS.md` | D-series accepted requirements; historical decisions superseded by later confirmations | `01-PROVENANCE-AND-DEMO-PARAMETERS.md` |
| `docs/alex-core/08-ENVIRONMENT-SIMULATION.md` | Scope separation: environment vs incidents vs outcome statistics; weather and physics plans | `02-MARS-ENVIRONMENT-AND-TERRAIN.md` and `09-OPEN-QUESTIONS-AND-ROADMAP.md` |
| `docs/alex-core/09-TRAINING-MISSION.md` | Four independent tasks; site/gear/sequence, two tasks/mission, shuttle | `05-EQUIPMENT-TASKS-AND-MISSION.md` |
| `docs/alex-core/10-WORLD-REGION-AND-BOUNDARIES.md` | Height/coordinate bounds, visible vs playable data, future 10x10/5x5 proposal | `02-MARS-ENVIRONMENT-AND-TERRAIN.md` |
| `docs/alex-core/11-PHYSICS-ENGINE.md` | V0.2/0.3 concept, load, Mars g, gas units, physical domain split | `03-EVA-LOCOMOTION-METABOLISM.md` / `04-LIFE-SUPPORT-AND-FAILURE.md` |
| `docs/alex-core/12-RACHEL-PHYSICS-AUDIT.md` | Full 16-issue independent critical research/code audit | `06-RACHEL-RESEARCH-AND-INDEPENDENT-AUDIT.md` |
| `docs/alex-core/13-PHYSICS-TEST-PLAN.md` | Scientific source hierarchy, numeric regression, unit and integration tests | `08-TESTS-VALIDATION-AND-REPRODUCIBILITY.md` |
| `docs/alex-core/14-PHYSICS-MODEL-PROPOSAL.md` | Calibration ideas and additional NASA analog references; NOT previous approved production API | `03-EVA-LOCOMOTION-METABOLISM.md` / `09-OPEN-QUESTIONS-AND-ROADMAP.md` |

Note: the archive branch is a special multi-parent history preservation commit; its **first parent** is the old personal main and the other parents preserve discontinued feature histories. Never merge the archive into active team main. The live current/archived contents have separate authorship and technical status.

## Rachel originals — preserved unchanged on main
| Path | Scope | Clarification |
| --- | --- | --- |
| `research/02-walking-cost-model.md` | Minetti/Tobler slope cost, lunar and suited analog factors, illustrative kcal/m and litres/m | Rachel's valuable **composite research**, not validated Mars-suit gait |
| `research/03-survival-odds.md` | Monte Carlo proposal, O2/reserve, dust, leak, fall, comms failure probabilities | Stochastic events **not authorized for 3h physics demo**; many rates are illustrative |
| `research/07-viewshed-and-costs.md` | Directional Dijkstra and return cost field; comms line-of-sight, raster resolutions | Planner proposal; old **litres** cannot be fed into gram O2 UI |
| `research/08-mars-time.md` | Solar angles, local Mars time and light delay, external library options | Dynamic solar and day/night simulation deferred |
| `research/10-training-tasks.md` | Seven historical rover activities and suggested game durations | The product is **four independent EVA tasks**, not seven rover tasks; MOXIE refilling superseded |
| `docs/FOUR-TASK-ANIMATION-BRIEF.md` | Four separate task animations and shuttle cutscenes | Visual ownership Rachel; Alex physics owns state/resource impacts |
| `docs/integration/RACHEL-VISUALS.md` | Verified HUD, renderer, events, legacy litre-based shader | No touching Rachel-owned files for this documentation pass |

| `research/00-MORNING-BRIEF.md` | Historic first-day science and pitch assumptions | Earlier plan; do not treat as current decisions |
| `research/01-data-check.md` | Jezero USGS Mars 2020 HiRISE **1m DTM** and crop/reprojection/source tests | Independently cross-checked original USGS source in NASA registry **N12**; exact Victor-derived binary lineage remains unverified |
| `research/04-threejs-terrain.md` | Three.js shaders, contour rendering, WebGL compatibility | Visual engineering not human physiology |
| `research/05-pymartini-to-threejs.md` | Tile geometry, RTIN mesh simplification, LOD | Geospatial visualization, not validated slope workload |
| `research/06-maplibre-mars.md` | Mars Trek Jezero 25cm image layer, WMTS projection, MapLibre workaround | Image resolution is not DTM elevation resolution; NASA portal N13 |
| `research/09-perseverance-images.md` | Perseverance image API and rover location attribution | Images, not a crew metabolic dataset |
| `research/12-pitch-facts.md` | Historical Apollo walk-back and EVA talking points | Verify against primary source for current judge claim |

## Previous work this pass retains
- `docs/physics/PHYSICS-DEMO-V01.md`, committed in `bc78b0f`: first approved engineering scenario (user five decisions) and API/test proposal.
- `docs/physics/CODEX-PHYSICS-DEMO-V01.md`, committed in `bc78b0f`: implementation contract, file ownership.
- RAW Engine v0.1 in current main: `src/core/engine.ts`, `contracts.ts`, `src/adapters/world.ts`, `clock.ts`, `hud.ts`. All survive unchanged.
- To keep a scientific audit trail, cited papers are indexed separately in `NASA-DATA-AND-PRIMARY-SOURCES.md`, not copied into the repository as third-party PDFs.

## Changes of interpretation versus original sources
- Original NASA Mars fact-sheet URL may redirect to maintenance page; newer stable NASA Glenn/NTRS/PDS links used as sources, with caveat.
- Rachel's old O2 "390 litres" and the litres-based Leash must NOT be equated to new suit O2 capacity in **grams**.
- An old suggested return-to-home optimal grid is not automatically the agreed "reverse mission route" with directional slopes.
- Rachel's random incident distribution inputs are **unvalidated scenario hypotheses**; science cannot claim measured survival probability from a few chosen numbers.
- Original rover MOXIE is not portable; **portable experiment** is fictional for Sharkies, and it must **not** refill suit life support.
- User's latest scope: fixed landing for demo -> automatically selected supported landing in future; **no player location selection**.
