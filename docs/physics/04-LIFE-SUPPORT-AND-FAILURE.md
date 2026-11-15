# Metabolic oxygen, life support state, reserve and mission failure

## 1. Single authoritative units and definitions
- **O2 stock: grams of molecular oxygen available for the astronaut's modeled metabolic use**. Do not mix grams, standard litres, regulator pressure, gaseous tank volume or external atmosphere.
- **O2 depletion: metabolic consumption**. A real PLSS has other demands/losses (purges/leaks and other gas handling); these are **not modeled** in this version. NASA BVAD [N01] distinguishes metabolic **consumption** and total system gas losses; do not add one into the other without explicit definitions.
- The HUD 0-100% bar is a normalized display of `remainingGrams/capacityGrams`, not proof that the chosen capacity is NASA certified.
- A user-facing reserve is a warning/planning budget, **not additional oxygen beyond the modeled capacity**.

## 2. Primary NASA reference
NASA NTRS 20180001338, `Life Support Baseline Values and Assumptions Document`, Table 4-76 printed p143: 293 W and 0.075 kg O2/h at respiratory quotient 0.9. That is **75 grams per hour** for a published reference metabolic load. It is not the rated O2 tank capacity, and it is **not a measured Mars EVA rate**.

## 3. DEMO calculation, equations and labels
~~~text
o2RateGramsPerHour = metabolicPowerWatts * (75/293)  // demo linear extrapolation of NASA pair
deltaO2Grams = (o2RateGramsPerHour * deltaSimSeconds) / 3600
oxygenNextGrams = max(0, oxygenNowGrams - deltaO2Grams)
energyNextJoules = energyNowJoules + metabolicPowerWatts*deltaSimSeconds
oxygenFraction = clamp(oxygenRemainingGrams/oxygenCapacityGrams, 0, 1)
~~~
- Every displayed value specifies **grams, g/h, watts or joules**.
- Coefficient `75/293 = 0.2559726962 (g/h)/W`; for 293 W exactly **75g/h**; 10min -> 12.5g; 1min -> 1.25g.
- At 165 W idle: **~42.24 g/h**. At 430 W faster gait on flat terrain: **~110.07 g/h**. At 350 W generic scientific task: **~89.59 g/h**. These are **derived scenario results**, not observed NASA activity rates.
- Do not apply an atmosphere-pressure-to-human-O2 multiplier; human breathes **suit** oxygen, not 0.6kPa CO2 ambient. Ambient -60C is not suit metabolic heat balance.
- In a single update choose **exactly one** total activity power (idle, walk, fast or task) plus signed slope/payload correction where applicable. Standing metabolic expenditure is already part of the total power. No duplicate charges for the same elapsed second.

## 4. DEMO gas stock and failure (explicit game choices)
| Quantity | Value | Meaning |
| --- | ---: | --- |
| O2 usable capacity | 750 g | Assumed usable stock of fictional demo PLSS |
| Initial normal remaining | 750 g | Start 100% |
| Low/reserve warning threshold | 150 g | At or below 20% of capacity |
| Critical warning threshold | 75 g | At or below 10% of capacity |
| Mission failed | exactly 0 g | **User-approved gameplay fail rule**, not a medical claim that death is instantaneous |
| Optional QA emergency | e.g. 2 g remaining / 750 g capacity | **Clearly labelled separate test scenario**, not real normal EVA physiology |

At normal 75g/h, going from 750g to zero would mathematically take **10 hours** under constant 293W and no other losses. This is intentionally slow for a 3-hour development sprint. Demonstrate the failure using a distinct and prominently marked `O2 EMERGENCY TEST` initialization, **never fake consumption by multiplying the NASA reference silently**.

### State-machine requirement
~~~text
ACTIVE:
   if paused: dt=0 effective, no gas/time/energy
   else evaluate intended motion and terrain validity
        determine actual activity and total power exactly once
        integrate O2, energy and time in one fixed-dt step
        if remaining<=0 -> clamp to 0, status=FAILED,
          emit mission-failed(reason='oxygen-depleted') ONCE
FAILED:
   no movement, no task progression, no resource changes
   ignore resume; allow reset only
RESET:
   restore initial mission tasks, O2, energy, virtual time and motion
~~~
Exact ordering when a time step both reaches a task and depletes O2 must be deterministic and tested. Do not let a visually completed animation override the authoritative mission failure. O2 warning transitions must not spam every 60-Hz tick.

## 5. Reality-check: physical vs gameplay fail state
A real astronaut would experience serious life-support risk as oxygen supply, pressure and partial pressure deteriorate; the consequences are not captured by a simplistic linear gas-stock gauge. The selected rule is **"mission failed at 0g resource"**, not **"astronaut medically dies at 0g instantly"**. No real tank specification, breathing pressure regulation, leak or CO2 scrubbing is claimed. Define mission success separately from respiratory health and UI animations.

## 6. HUD and shader compatibility
- Real O2 gauge in Rachel's existing `HelmetHud` via **Alex's** `src/adapters/hud.ts`, with fraction 0..1 and meaningful label.
- Alert precedence: failed > critical > reserve/low > terrain boundary. Exact wording requires visual owner review, but the adapter may emit existing documented alert props.
- For high-visibility demo add g/h numeric telemetry in **Alex's app-owned controls**, not by editing Rachel's visuals.
- **Do not** pass grams into Rachel's litre-based terrain shader `uO2Left`, `uReserve` or `uO2Grid`. Existing RAW deliberately disables the Leash overlay; a gram-based return-cost grid is a later coordinated Alex/Nanda/Rachel project.
- Rachel's suit-temperature gauge must not be populated with the external ambient -60C unless her contract explicitly states it is an outside-temperature reading.

## 7. Return-path safety and future extensions
The user previously requested an estimated ability to return home. A credible estimate needs a geometrically valid **return route** (including its reversed slopes), current equipment load, time/task workload and a reserve. Nanda's route may be only guidance; the player can deviate. Either the planned route, reverse actual walked trail or real new path must be chosen and tracked. **Do not invent a 100%-safe green label** without a validated return estimator.

Future: oxygen leak, regulator pressure, partial-pressure alarms, CO2 scrubber performance, cooling electrical energy, metabolic recovery, the true capacity/rated pressure of a specific future suit, and a validated calibrated O2-versus-power transfer curve.
