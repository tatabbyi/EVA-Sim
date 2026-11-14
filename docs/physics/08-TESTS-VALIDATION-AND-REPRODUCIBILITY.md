# Physics test, calibration and reproducibility plan

**Status:** expected checks, not evidence of a completed implementation. Original broader tests in archived `docs/alex-core/13-PHYSICS-TEST-PLAN.md`. Current RAW legacy test suite: `tests/core.test.mjs`, `routes.test.mjs`, `desktop.test.mjs` and `smoke.test.mjs`.

## 1. Source-level acceptance (required)
- [ ] Cite NASA [N01] exact report ID/revision and Table 4-76, and correctly distinguish **75 g/h metabolic O2 consumption at 293W** from total system gas losses.
- [ ] Source file [N02] quotes 2026 NASA **preliminary** 230 lbm starting-max Mars suit mass estimate; no claim that our fictional 65kg suit is an actual product.
- [ ] Every chosen per-activity power, walking speed, payload/slope coefficient, 750g capacity and 25-degree cap labelled **scenario**.
- [ ] Explicit NASA PDS data provenance **not verified** until original product IDs, asset SHA-256 and conversion logs exist.
- [ ] Original Rachel research remains intact and is not described as NASA-certified Mars physiology.
- [ ] No source text copied wholesale into app code or docs; brief paraphrase, direct links, traceable data tables.

## 2. Pure model numeric vectors (first-pass scenario)
Use 293 W -> 75 g/h from NASA N01 as an analog reference. All other rates below are derived using the **Sharkies linear assumption**. Suggested precision ±0.01 g/h for reports, tight machine precision in code tests.

| Test | Calculation | Expected |
| --- | --- | --- |
| NASA reference at 293 W | `293 * 75/293` | **75.000 g/h** |
| 10 minutes normal walk, flat | `75*600/3600` | **12.500 g** |
| 1 minute normal walk, flat | `75*60/3600` | **1.250 g** |
| Idle at 165W | `165 * 75/293` | **42.2355 g/h** |
| Faster locomotion flat at 430W | `430*75/293` | **110.0683 g/h** |
| Generic task at 350W | `350*75/293` | **89.5904 g/h** |
| Body+fictional suit 80+65kg | `145*3.711` | **538.095 N** |
| Add 10kg carried gear | `155*3.711` | **575.205 N** |
| 10kg payload factor | `1+0.5*10/145` | **~1.034483** |
| +10-degree grade, no gear | `grade=tan(10deg)=0.176327; slope work =1+3*grade+6*grade²` | **~1.7154** |
| -10-degree grade, no gear | `grade=-tan(10deg); clamp(...,0.7,2.5)` | **0.7**, based on *scenario* clamp |
| +10-degree walk speed | `0.75*(1-.018*10)` | **0.615 m/s** |
| -10-degree walk speed | `0.75*(1-.005*10)` | **0.7125 m/s** |

**Important:** numerical tests show math internally matches the chosen model, **not proof of physiological Mars accuracy**. NASA 2025 traverse report [N03] explicitly notes further pressurized suit test validation.

## 3. Determinism and lifecycle tests
- [ ] Equal simulated seconds, different update grouping (60Hz vs 30Hz vs capped 0.1s) -> same O2 within floating-point tolerance; renderer FPS irrelevant.
- [ ] Paused during O2 consumption -> no time/energy/stock changes; resume continues from same state.
- [ ] Actual movement blocked by edge, steep grade, invalid or NaN DTM -> no fake motion; **idle O2** continues while unpaused.
- [ ] Signed same elevation plane: opposite heading yields inverted grade; uphill slows motion and increases metabolic rate compared with level; return slope direction reevaluated.
- [ ] 0g O2 exactly clamped; one `mission-failed` event; all later movement/task commands ignored except reset.
- [ ] Start with 2g in **explicit emergency QA**; initial capacity remains 750g. UI shows remaining **0.27%**, not 100% or false 2g capacity; fail happens visibly with physically consistent rate.
- [ ] Reset returns original tasks, snapshot, O2, energy/time, paused flag and input state.
- [ ] **MOXIE task does not increase suit O2**. Its 300W *electrical* usage does not become 300W of additional human metabolic power.
- [ ] Inventory future test: core adds sample kg; depot removes carried tube kg; carrying heavy tools slows motion and raises work **under chosen coefficient**.
- [ ] Immutability: previous published snapshots do not mutate; raw reference events not dispatched as duplicate.
- [ ] Backward compatibility: old `createEngine` uses 3/8m/s legacy speeds and `oxygenGrams===null` until physics opt-in is activated.

## 4. Rachel + Victor + Nanda integration boundaries
- [ ] Rachel `HelmetHudProps` receives only normalized valid O2 fraction and correct alerts; suit TEMP does not display ambient -60C as if a body measurement.
- [ ] Rachel's `uO2Left` shader remains **litres-based and disabled**; no grams passed by accident. No modifications to Rachel visuals for this physics PR.
- [ ] The same local X east / Z south frame and terrain revision are used for heights, player, shuttle and task positions.
- [ ] Invalid DTM sample returns explicit invalid response, no edge clamp.
- [ ] 2m/4m slope probe uses **interpolated** DEM and declares its true spatial resolution. Verify scene mesh and sampler alignment; no model interprets data pixel resolution as scientifically more precise than source.
- [ ] Nanda's cost placeholders are **not used** as live metabolic predictions.

## 5. What to run and evidence to retain
~~~sh
git status --short
npm run typecheck
npm test
npm run build
npm run smoke            # ONLY in a supported graphical environment
git diff --stat
git diff --name-only
~~~
These commands are **required actions for Codex**, not claims of having been run by the documentation author. Also run native Electron manually if available: start normal mode, walk on grade, inspect O2/g/h, finish a simple current task; switch to labelled O2 emergency, walk/idle to O2=0, verify one failure and reset.

For each manual or automated run record in an implementation report: OS/runtime, commit, source asset revision, test command, exit code, result screenshot/log if useful, and missing coverage. Do not claim Windows installer or no-network operation passed unless physically checked.

## 6. Environmental-data reproducibility
- [ ] MOLA/HiRISE/MEDA datasets: record NASA PDS original label/product ID, release/version, original SHA-256 and derived hash, extent, lat/lon, CRS, elevation datum, processing script and software versions.
- [ ] Compare sample numeric heights at ≥3 documented control locations against final `heightAt` and displayed mesh.
- [ ] NASA 2018 BVAD Table 4-76 source link remains reachable; note inability to retrieve screenshot/page in automated interface if relevant.
- [ ] NASA 2026 Mars suit preliminary 230lbm estimate cited **as preliminary**; do not present it as definitive.
- [ ] Scientific source and scenario assumptions can be reconstructed from repository without paid APIs or a network connection at app runtime.

## 7. Hackathon claim levels
- **Can claim**: "We use a deterministic, unit-aware oxygen budget anchored to NASA's published EVA baseline and a selectable engineering scenario, with Mars terrain slope affecting modeled effort."
- **Do not claim**: "NASA has measured this person's exact oxygen use on Mars" / "this oxygen tank is NASA certified" / "survival odds are NASA-approved" / "our 4m/2m dataset is verified NASA HiRISE DTM" without original product proof.
- **Can claim only after testing**: "Our Electron application runs the model on an offline Jezero region, with a low-O2 scenario and terminal failure at zero."
