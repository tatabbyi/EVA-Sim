# Astronaut mass, suit mobility, signed slope and metabolic workload

## 1. Model status and provenance
The 3-hour demo needs a physically dimensioned but deliberately simplified **engineering model**, not an unsubstantiated claim of a NASA-validated Martian astronaut gait. Core physical identities and the 293 W / 75 g/h reference pair are grounded [NASA N01]; the chosen walk/run speeds, workload baselines, grade factors and suit response are **Sharkies scenario parameters**. NASA's more recent terrain/partial-gravity work [N02-N04] stresses that suit motion limits and metabolic effects need calibration.

## 2. Mechanical state
~~~text
mTotalKg = mAstronautKg + mSuitKg + sum(mCarriedGearKg)
weightN  = mTotalKg * gMarsMps2
~~~
- Default illustration: `80 + 65 + carriedMassKg`. 65 kg is a fictional suit scenario, not a measured Mars flight suit; compare to the **preliminary** 2026 NASA 230 lb (~104 kg) recommended upper mass starting point [N02].
- Gravitational **weight** is smaller on Mars; translational **inertial mass** and gear handling are not smaller.
- Account for selected gear *at its actual carried state*. A collected core increases return mass; deposited sample tube decreases carried mass; tools carried home remain part of it.
- Avoid multiplying all oxygen or gait costs by a naïve suit-plus-payload weight ratio and calling it NASA validated.

## 3. Activity state and base rates (proposed, adjustable)
| Activity | Default speed | Baseline total metabolic power | Classification |
| --- | ---: | ---: | --- |
| Idle / standing | 0 m/s | 165 W | Sharkies assumption |
| Suited walk | 0.75 m/s | 293 W | Speed assumption; power uses NASA N01 analogous reference |
| Faster suited locomotion | 1.15 m/s | 430 W | **Sharkies assumption**, not the legacy 8m/s sprint |
| In-place scientific task | 0 m/s | 350 W | Generic Sharkies assumption, individual tasks later |

**TOTAL metabolic power** includes resting/standing consumption. Do **not** add 165 W again to a 293 W total workload. If work is active, compute task power once; do not add standing + task + walk blindly.

User-requested fast locomotion can retain the existing code string `run` for compatibility, but the physical description is **faster suited movement** rather than an unconstrained terrestrial sprint.

## 4. Candidate first-pass grade/load correction (not NASA-calibrated)
From the already approved scenario [PHYSICS-DEMO-V01.md], use a transparent deterministic heuristic, documented with all units:
~~~text
grade = tan(slopeRadians)              // directional rise / horizontal run
payloadFactor = 1 + 0.5 * carriedKg/(astronautKg+suitKg)
slopeWorkFactor = clamp(1 + 3*grade + 6*grade*grade, 0.7, 2.5)
metabolicPowerW =
    powerIdleW +
    max(0, powerForActivityW-powerIdleW) * payloadFactor * slopeWorkFactor

speedFactor =
    clamp(1 - 0.018*max(0, slopeDegrees)
            - 0.005*max(0, -slopeDegrees), 0.35, 1)
movementSpeedMps = suitBaseSpeedForGait * speedFactor / payloadFactor
~~~
For idle, `metabolicPowerW = powerIdleW`, `movementSpeedMps = 0`. During an active stationary task, apply task power and no movement charge. Both uphill and steep downhill can be costly; the simple curve may understate descent instability. Do not extend it to prediction outside the chosen demo range.

**Important explicit limitation:** 1m grade probe against a 4m sampled heightmap does not establish 1m spatial data accuracy. Prefer testing directional signs and smoothness over fictitious precision. Stop on invalid/no-data surface or when the candidate exceeds the demo 25-degree cap; while blocked, the unpaused astronaut still spends **idle** O2. Ensure attempted movement is not incorrectly billed as successful traversal.

## 5. Rachel's more elaborate earlier model — keep as source, not baseline
From `research/02-walking-cost-model.md`:
~~~text
i = tan(theta)
Cw(i) = 280.5*i^5 - 58.7*i^4 - 76.8*i^3 + 51.9*i^2 + 19.6*i + 2.5
v(i)  = 1.092*exp(-3.5*abs(i+0.05))             // m/s
E(i)  = 0.03585*(1.825 + 0.380*(Cw(i)-2.5)) + 0.0210/v(i) // kcal/m
O2eq(i) = E(i)/4.8                           // legacy standard-litres-equivalent per m
~~~
This is a **composite** of a *terrestrial* Minetti slope polynomial, a Tobler-derived preferred walking-speed form, lunar suited analog factors, a fitted Mars 0.38 g adjustment, human mass and an assumed resting contribution. The polynomial's empirical scope is Earth treadmill walking at selected speeds; original running has a **different** polynomial. Rachel's formula is a historical benchmark for research discussion, **not a separately validated NASA Mars-suit equation**.

Archive audit independently reproduces her numerical vectors:
| Slope | Her expected kcal/m | Old oxygen-equivalent L/km |
| --- | ---: | ---: |
| -10 degrees | 0.074563 | 15.5339 |
| 0 degrees | 0.088335 | 18.4031 |
| +10 degrees | 0.171097 | 35.6451 |
| +20 degrees | 0.298094 | 62.1030 |

These are **regression checks of her formula**, not physiological truth. Do not compare the litres column directly with O2 grams. Do not mix her energy-per-distance plus a **second** rest term; this risks double counting. Direct use of this formula by Nanda in `src/sim/cost.ts` remains Nanda-owned and unimplemented at the inspected RAW baseline.

## 6. Better future model
- Empirical separate walking/running metabolic power functions incorporating crew fitness, suit pressure/mobility and payload center of gravity.
- Individual tool/task exertion from NASA suited biomechanics (Norcross N04) and astronaut activity telemetry.
- Mars gravity extrapolation with transparent uncertainty bounds and sensitivity analysis; do not report a single percent as measured truth.
- Terrain granular traction, rocks, path curvature, task fatigue/recovery and inability to traverse slopes based on measured motion, not an arbitrary 25-degree hard cap.
- Validation against NASA Apollo analog N05, newer traverse research N03, and independent suit tests, explicitly marking what is and isn't transferable to Mars.
