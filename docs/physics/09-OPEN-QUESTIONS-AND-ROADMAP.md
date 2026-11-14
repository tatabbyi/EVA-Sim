# Physics scope ledger — approved demo, open questions and deferred modules

## A. Approved requirements for this hackathon sprint
- Suited user-controlled walk + faster suited movement, with realistic *constraints* but explicitly assumed numerical gait coefficients.
- Oxygen internally measured in **grams**, based on task/idle/walk/faster metabolic power; HUD normalized.
- Terrain signed slope affects speed and metabolic power in both outbound and return direction.
- Fixed environment displaying Mars-like gravity, ambient pressure, temperature and CO2 atmosphere. No live weather.
- At 0g modeled usable oxygen the mission **fails**.
- For the demo the **team** chooses a landing site, not the player. A later version chooses one automatically from coverage-validated Mars regions.
- Physics first, then one Rachel-created task, then rendered map of the **fixed demo region**, not 10x10 procedural terrain.
- Offline Electron, deterministic fixed simulation clock, no parallel second engine.

## B. Open scientific calibration questions (not secretly answered)
1. **Actual EVA suit**: what exact suit analogue (Mark III, xEMU, future Mars)? Distinguish N02's preliminary 2026 ~104kg maximum starting point from actual physical issued suit mass. Is a fictional 65kg future suit narratively acceptable?
2. **Gas stock**: does 750g represent tank contained, metabolically usable or post-reserve stock? Purges, regulator supply and temperature pressure need credible PLSS design.
3. **Metabolic conversion**: 75g/h at 293W [N01] is a reference at RQ 0.9; linear scaling may not hold uniformly across work, rests or subjects. Select a transfer model, gas conditions, uncertainty.
4. **Slope sampling**: a 1m probe across a 4m DEM interpolates, not resolves true 1m relief. Choose physical scale and smoothness tolerance with Victor.
5. **Direction and terrain**: selected 25deg mobility cap, grade factors and traction/rock obstacles are scenario heuristics, not a validated probability of falls; need careful safety characterization.
6. **Run vs fast movement**: continuous fast gait for suited user requires mass, pressure garment, acceleration and reduced-g testing, not Earth sprint mechanics.
7. **Loadout weights**: drill, abrasion tool, core/sample tube, portable fictional MOXIE, carrying position, return trips and task-specific changes need NASA analog evidence and explicit game picks.
8. **Task rates/duration**: scientific work varies by tool, posture and duration, especially when task animation and simulated mission time are not identical.
9. **O2-to-shuttle estimate**: do we reverse the displayed suggested ML path, reverse the actual walked track, or choose a replan? User has not fully resolved the off-route return policy.
10. **Terminal rule**: 0g -> mission failed is approved game logic; full medical/suit depressurization and emergency procedural outcomes are not modeled.
11. **Site-specific climate**: to claim "measured Jezero pressure -60C on sol X", retrieve an exact NASA MEDA RDR data file with product/version and quote its actual measurements. No such data imported yet.
12. **Terrain lineage**: the current 4m grid and Victor's new 2m/tiles require PDS/DTM product ID, provenance, CRS/vertical datum, and transformation hashes.
13. **Survival odds**: rare equipment leaks, dust events, astronaut injuries, comm outages and their rates are **unvalidated**; need proper empirical inputs and sensitivity analysis.
14. **Sun/time**: NASA Mars-specific solar calculations and local-time library licensing/inputs are future work, not current physics.
15. **Thermal/CO2/water/electrical**: separate suit thermal, CO2 scrubbing, cooling water and power models — not justified by a fixed outside -60 C.
16. **Human variability/fatigue**: only one fixed astronaut now; deconditioning/fatigue, medical limits and interindividual gait differences later.
17. **Radiation**: true dose depends on actual solar/space environment and shielding; don't invent danger bars with unverified dose.
18. **Map and random landing**: future 10x10km rendered/5x5km playable design must match **actual available offline data**, automatic valid landing placement, LOIs and player-only navigation. No map-based manual landing selection.

## C. Versioned backlog (not work completed)
| Order | Phase | Dependency | Deliverable |
| --- | --- | --- | --- |
| P0 | **DEMO Physics** | Current RAW engine and 4m height provider | O2, signed grade, mass/load, deterministic time, warnings/failure |
| P1 | **One task** | Rachel animation API and task event contract | One in-world science objective charges task power, completes/aborts safely |
| P2 | **Fixed-region map** | Victor's real height/mesh data; Rachel visual integration | Top-down view for preselected terrain; no global Mars player pin |
| P3 | **Physical calibration** | NASA analog literature, chosen suit and test fixtures | Better suit gait, extra task profiles, O2 reserve/return energy |
| P4 | **Return-to-shuttle calculation** | Nanda route + signed grade, player deviation policy | Physically dimensioned O2 grams-to-home and honest warning |
| P5 | **NASA site data reproducibility** | PDS products, Victor provenance/processing | Auditable Jezero DTM and MEDA import; exact data product IDs |
| P6 | **Environmental incidents & life support** | calibrated studies and suits | thermal, CO2, leaks, dust, fatigue, power/radiation risk |
| P7 | **Auto-landing and procedural selection** | verified offline region catalog, 10km assets | automatic candidate-region and safe-shuttle-site selection; no player pin |

## D. Explicitly prohibited shortcuts
- Never claim 65kg Mars suit, 750g O2 and 25deg cliff cap are NASA-verified design parameters.
- Never use a fake huge O2 drain in a *normal* gameplay mode to make the demo exciting. Emergency QA mode is labelled separately.
- Never silently substitute NASA lunar/Earth treadmill observations for validated Mars EVA telemetry.
- Never confuse the rover-mounted real MOXIE with a portable astronaut suit recharger.
- Never modify Rachel-owned visuals or Victor terrain data just to fit a physics calculation; write an adapter or escalate the contract.
- Never delete the archive or rewrite historical research while consolidating into this new documentation.

## E. Next engineering instruction
Give Codex the existing [CODEX-PHYSICS-DEMO-V01.md](CODEX-PHYSICS-DEMO-V01.md), with [PHYSICS-DEMO-V01.md](PHYSICS-DEMO-V01.md) and [NASA-DATA-AND-PRIMARY-SOURCES.md](NASA-DATA-AND-PRIMARY-SOURCES.md). Implement P0 as small independently testable pure logic, then opt-in core, then HUD. **No unrelated renderer or map work in the physics PR.**
