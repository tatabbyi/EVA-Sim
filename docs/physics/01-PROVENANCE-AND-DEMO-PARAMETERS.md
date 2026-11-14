# Physics decisions, provenance and DEMO configuration

**Status:** Five user decisions approved; the numbers are **a proposed scenario profile already documented in** [PHYSICS-DEMO-V01.md](PHYSICS-DEMO-V01.md), **not NASA-validated Mars-suit hardware**. This is an index and reconciliation guide, not a silent replacement for the approved specification.

## Five non-negotiable product requirements
1. Human-controlled **suited walk and faster suited movement**, not RAW's unsuited-feeling 3m/s walk + 8m/s run.
2. **Oxygen stock in grams**, metabolic consumption tied to activity and engineering profile, percent HUD and depletion telemetry.
3. **Signed terrain grade changes both movement speed and metabolic burden**. Uphill/downhill are directional; no fake flat normal when the DEM has no-data.
4. Realistic physical *environmental facts* with **fixed demo weather**, no invented local readings or full suit thermal model.
5. At **0g oxygen** the mission enters **failed** status once; stop movement/tasks until reset.

## Proposed DEMO profile vs evidence, full traceability
| Parameter | Scenario value | Unit | Category | Justification / caveat |
| --- | ---: | --- | --- | --- |
| gMars | 3.711 | m/s² | NASA reference + conventional precision | NASA Glenn ~3.7; do not claim local variation |
| Ambient temperature | -60 | °C | SHARKIES-SCENARIO | Fixed chosen outdoor condition; no MEDA product imported |
| Ambient pressure | 635 | Pa | SHARKIES-SCENARIO | Typical Mars-scale chosen scenario; not measured at demo sol |
| Ambient CO2 mole fraction | 0.953 | dimensionless | SHARKIES-SCENARIO | NASA references Mars CO2-dominated air; exact fraction local/seasonal |
| Astronaut body mass | 80 | kg | SHARKIES-SCENARIO | One fixed astronaut |
| Fictional suit mass | 65 | kg | SHARKIES-SCENARIO | Not actual NASA suit. NASA 2026 report offers preliminary ~104kg design maximum; compare honestly |
| Base walk | 0.75 | m/s | SHARKIES-SCENARIO | Suit-limited movement setting, not certified gait law |
| Faster suited movement | 1.15 | m/s | SHARKIES-SCENARIO | **Not** an 8m/s sprint and not a validated walk/run transition |
| Total metabolic power idle | 165 | W | SHARKIES-SCENARIO | Entire metabolic rate, *not increment above rest* |
| Total metabolic power walking | 293 | W | NASA-REF anchor + scenario use | N01 Table 4-76 pairs 293 W with 75 g/h, but not at our exact pace |
| Total metabolic power faster | 430 | W | SHARKIES-SCENARIO | Faster exertion; NASA does not supply this game setting |
| Total metabolic power task | 350 | W | SHARKIES-SCENARIO | Generic first demo; individual tasks TBD |
| O2 usable capacity | 750 | g | SHARKIES-SCENARIO | Fictional usable suit stock; not a certified tank |
| Low/reserve O2 threshold | 150 | g | SHARKIES-SCENARIO | 20% nominal stock |
| Critical O2 threshold | 75 | g | SHARKIES-SCENARIO | 10% nominal stock |
| Terrain movement cut-off | 25 | degrees | SHARKIES-SCENARIO | Gameplay slope block, not NASA medical/suit threshold |
| Signed slope probe | 1 | m | SHARKIES-SCENARIO | Numerical scheme; may be noisy vs grid resolution |
| NASA O2 reference | 75 at 293W | g/h | NASA-REF | N01, metabolic consumption and RQ 0.9 |
| O2 rate at 165W idle | ~42.24 | g/h | MATH + scenario | Derived by assumed linear scaling from 75/293 |
| O2 rate at 430W fast | ~110.07 | g/h | MATH + scenario | Derived by assumed linear scaling from 75/293 |
| Oxygen failure | 0 | g | APPROVED GAME RULE | User requirement; zero O2 is a simplified mission-failure trigger |

Sample maths: at flat 293W (assumed), 10 real **simulated minutes** consume `75 * 10/60 = 12.5 g`. A one-minute presentation would consume only **1.25g** at this reference rate. Do not rig a huge gas depletion for theatrical effect. Use a distinctly labelled **emergency test start** (e.g. 2g *remaining out of 750g capacity*) for the fail demonstration, not an inaccurate physiology model.

## Source hierarchy
1. Primary instrument PDS product for site/sol if product ID and calibration are verified.
2. NASA NTRS measured human analog or NASA life-support engineering report, labeled appropriately.
3. Peer-reviewed research on terrestrial gait (non-NASA) with transfer limits.
4. Rachel engineering synthesis + independent audit; **not automatically approved for implementation**.
5. Sharkies scenario choices for demonstration; never mislabeled as NASA-derived.

## Scope and version discipline
- **Frozen now:** fixed landing chosen by team, two science tasks in long-term loop, physical O2 failure, offline, fixed ambient conditions.
- **Not selected by player:** landing coordinate. Future random supported region (not any arbitrary pixel on Mars).
- **Pending:** actual suit profile, gear masses, task duration and workload, oxygen leak and return reserve calibration, signed-grade probe scale, thermal suit equation, human body variability, full random landing and map producer.
- Numeric settings can be tuned **only as explicit changes to the named scenario profile**, with a source/evidence note. Do not silently replace approved behavior.
