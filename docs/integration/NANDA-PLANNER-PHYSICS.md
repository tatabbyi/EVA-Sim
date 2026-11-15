# Planner and Survival Odds on the physics engine (Nanda)

Written with AI assistance (Claude). Status: implemented, 15 Nov 2026.

## What changed

The authoritative physics (`src/core/physics.ts`, Alex) counts O2 in **grams** from metabolic power. The planner and
Survival Odds used the research/02 model in **litres**, so the route was optimised for a different number than the suit
spends, and Survival Odds had been switched off. Now:

| Piece | Before | Now |
|---|---|---|
| Path planner (`src/sim/pathfind.ts`) | research/02 litres, built in | Any `CostModel`; the game passes the physics. The model's table travels with the lattice to the worker |
| Physics as a cost model (`src/sim/physicsWalk.ts`, new) | — | grams/m = `gramsPerHour(activityResponse(walk, grade))` ÷ speed; cap = `maxDemoSlopeDeg` (25°); rest and task g/min from `powerIdleW` / `powerTaskW` |
| Survival Odds (`src/sim/survival.ts`) | litres; off in the app | grams, walked with the physics; back on the console, labelled as scenario odds |
| `o2ToHomeAt` (`src/sim/cost.ts`) | litres | grams (the planner's unit) |

The console's O2 and time numbers still come from Alex's `estimateEVA`; the odds use the same tank (750 g), reserve
(30 min standing, `RESERVE_MINUTES`) and time budget (45 min).

## How the two walking models compare

Cost per metre relative to the flat (physics 0.0278 g/m at 0.75 m/s):

| Grade | −24° | −10° | 0° | +10° | +20° | +24° |
|---|---|---|---|---|---|---|
| Physics (engine) | 1.06× | 0.91× | 1.00× | 1.60× | 2.59× | 2.91× |
| research/02 (Minetti) | 1.78× | 0.84× | 1.00× | 1.94× | 3.37× | 4.26× |

Each two-objective mission on the shaped site, planned with each model and then **charged by the physics**:

| Tasks | Physics-planned | research/02-planned | Extra O2 |
|---|---|---|---|
| 1+2 | 8.6 g, 6.4 min, 262 m | 8.6 g, 6.5 min, 273 m | +0.6% |
| 1+3 | 11.8 g, 9.3 min, 403 m | 11.8 g, 9.3 min, 403 m | +0.1% |
| 1+4 | 14.4 g, 11.1 min, 475 m | 14.5 g, 11.2 min, 480 m | +0.4% |
| 2+3 | 12.4 g, 9.5 min, 401 m | 12.4 g, 9.5 min, 404 m | −0.2% (smoothing noise) |
| 2+4 | 16.5 g, 12.4 min, 519 m | 16.6 g, 12.5 min, 527 m | +0.5% |
| 3+4 | 13.2 g, 10.2 min, 436 m | 13.5 g, 10.4 min, 446 m (other order) | +1.8% |

Mean +0.5%. Routes barely change; what matters is that the planner, the console and the engine agree on one number.
Speed: 5 fields ≈ 2.5 s with either model (worker, at load); comparing visiting orders with 1,000 runs each ≈ 50 ms.

## Alternatives considered

1. **Keep research/02 for planning.** 0.5% worse and in a unit the engine doesn't use. Rejected.
2. **Plan with the physics (chosen).** Same model that spends the O2; no extra cost.
3. **Hybrid (physics uphill, research/02 downhill).** research/02 charges steep descent far more (1.78× vs 1.06× at
   −24°), and Alex's doc says the physics "may understate descent". Planning with it would avoid descents the engine
   doesn't charge for, so the console and suit would disagree. Better fixed in the physics itself if Alex adds a
   descent term; the planner follows automatically.
4. **Search alternatives.** A* per query is unnecessary (fields make every query a lookup); Theta* would gain at most
   the 2% smoothing slack; a 2 m lattice needs the 2 m grid, which isn't shipped.

## Open points

- Survival Odds rates (leak failure, injury, dust devils) are research/03 **assumptions** (AUD-08). The console calls
  the result odds from simulated EVAs, never a NASA or measured probability.
- The physics' descent cost (above) is the largest model gap.
- Return policy after deviating (D-040) is unchanged: the HUD re-plans from where you stand.
- The litres Leash shader stays disabled; a grams cost-to-home grid now exists (`o2ToHomeAt`) if the team wants it.
