# Mars EVA Physics DEMO v0.1 — implementation report

Implemented on personal branch `feat/physics-demo-v01`.
Implementation commit: **`411689e9df84d8ae9e441153ca92f4190f4e8b02`**.
Preflight HEAD: `e51669739672b9c0e2fee27403f48bb9c3f1b598`, clean working tree;
no pre-existing work was overwritten. Local `team/main` was
`c38c5e772388102a9c0571288c2b7210f3c91c97`, already contained, with no incoming
commits. `team` points to `git@github.com:tatabbyi/EVA-Sim.git`; `origin` is the
personal `mokachkasss/Sharkies` fork. No fetch, reset, rebase, stash, merge, push or
PR was performed in this implementation. Remote freshness beyond the local refs
was not verified. Root branch-local agent instructions are preserved.

## Delivered behavior and API

The existing RAW scene now enables a pure TypeScript physics model through a
backwards-compatible fifth argument:

```ts
createEngine(region, mission, canOccupy?, speeds?, physicsOptions?);
// DemoPhysicsOptions:
{
  profile: MARS_EVA_DEMO_PROFILE,
  heightAt: (x, z) => world.heights.heightAt(x, z), // local metres, nullable
  carriedMassKg: 0, // explicitly assumed initial payload; configurable by caller
  // Optional, only for visibly labelled emergency QA:
  initialOxygenGrams: 2,
  emergencyTest: true,
}
```

Four-argument callers retain 3/8 m/s movement, null oxygen and absent physics
telemetry/mission status. Physics-enabled callers use suited 0.75/1.15 m/s gait
baselines and authoritative gram stock. Fixed landing/shuttle/task locations and
terrain loading are unchanged; the player does not choose a landing site.

`EngineSnapshot.physics?: PhysicsTelemetry` adds activity, total metabolic watts,
O2 g/h, cumulative joules, signed slope (null for unavailable probe), actual
accepted speed, payload/total kg, weight N, warning and fixed ambient conditions.
`mission.status?: 'active'|'failed'` is set in physics mode. Existing authoritative
`resources.oxygenGrams/oxygenCapacityGrams` remain the only gas stock.
`mission-failed(reason:'oxygen-depleted')` and transition-only `oxygen-warning`
join the existing semantic events. Existing task/route/reset events are preserved.

The model advances once inside `engine.step(dt)` under the existing 60 Hz clock.
Pause freezes time, gas and energy. Active science tasks are stationary and charge
one 350 W total workload; duplicate start/finish commands cannot duplicate task
events. MOXIE never supplies suit oxygen, and its electrical power is not charged
as astronaut metabolism. Blocked/no-data/steep movement burns only idle power.

On the final tick, the model computes survival duration `min(dt, O2 / burnRate)`.
Position, time and energy advance only through that duration; stock clamps to
exactly zero atomically with failed mission state. Failure is emitted once per
mission; all subsequent movement, task, route, pause/resume commands and steps
are ignored until reset. Telemetry then reports zero simulated workload/rate.
Reset restores the exact initial snapshot, tasks, stock, energy, time and intent.
A deliberately configured initial zero starts failed immediately; its single
failure notification is delivered on the first positive step so listeners can
observe it. No simulation time advances in that case.

The Alex HUD adapter maps real stock/capacity to percentage and prioritizes
failed > critical (<=75 g) > low (<=150 g) > boundary. Suit TEMP remains N/A;
OUTSIDE/AMBIENT -60 C / 635 Pa is labelled separately. The app reports changing
W, g/h, slope, speed, grams and kJ. Rachel's existing litre-based Leash remains
disabled; no grams are passed to it.

## Scientific traceability and scenario equations

Directly checked NASA's [2018 BVAD, NASA/TP-2015-218570/REV1](https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf),
Table 4-76, printed p143 (PDF index 156): 293 W and 0.075 kg O2 per crewmember-hour,
RQ 0.9. This is an EVA engineering reference, **not a validated Mars gait law**.
The adjacent discussion distinguishes consumption from overall suit gas losses.
The NTRS landing page timed out during this run; the full PDF and table text were
retrieved. The source catalog remains [NASA-DATA-AND-PRIMARY-SOURCES.md](NASA-DATA-AND-PRIMARY-SOURCES.md).

The [2026 Mars suit mass study](https://ntrs.nasa.gov/citations/20260003038)
was also checked: its preliminary 230 lbm starting maximum is design-study context,
not validation of this demo's fictional 65 kg suit. Rachel's original
Minetti/Tobler composite research and independent audit were read and preserved;
the old litre-based walking formula is not repurposed as a fast suited gait law.

All numeric values other than conventional gravity and the NASA reference pair
are **SHARKIES-SCENARIO**: 80 kg astronaut, 65 kg fictional suit, 750 g usable O2,
150/75 g warning thresholds, 165/293/430/350 W activity totals, suited speeds,
25-degree mobility cut-off, 1 m probe and fixed ambient conditions. The assumed
linear extension `O2[g/h] = P[W] * 75/293` is ours; no ambient breathing, gas leak,
vent loss, CO2 scrubber or thermal model is implemented.

```text
mass[kg] = astronaut + suit + carried payload
weight[N] = mass * 3.711 m/s²
signedGrade = (height(front) - height(back)) / probeMetres
front/back = position +/- half the 1 m probe along intended horizontal direction
payloadFactor = 1 + 0.5 * payloadKg / (astronautKg + suitKg)
slopeWorkFactor = clamp(1 + 3*grade + 6*grade², 0.7, 2.5)
locomotionPower[W] = idleW + max(0, gaitTotalW-idleW) * payloadFactor * slopeWorkFactor
speedFactor = clamp(1 - .018*uphillDegrees - .005*downhillDegrees, .35, 1)
speed[m/s] = gaitBaseline * speedFactor / payloadFactor
idlePower = 165 W total; stationaryTaskPower = 350 W total (not added to walking)
deltaO2[g] = P * 75/293 * elapsedSeconds/3600
energy[J] += P * elapsedSeconds
```

| Synthetic numerical vector | Speed m/s | Total W | O2 g/h |
|---|---:|---:|---:|
| Idle, no gear | 0 | 165 | 42.2355 |
| Walk flat, no gear | 0.750 | 293 | 75.0000 |
| Fast flat, no gear | 1.150 | 430 | 110.0683 |
| Stationary task | 0 | 350 | 89.5904 |
| Walk +10 degrees, no gear | 0.615 | 384.5876 | 98.4439 |
| Walk -10 degrees, no gear | 0.7125 | 254.6000 | 65.1706 |
| Walk flat with 10 kg gear | 0.725 | 297.4138 | 76.1298 |

145 kg weighs 538.095 N on this Mars scenario; adding 10 kg gives 575.205 N.
One minute at 293 W consumes 1.25 g; ten minutes consume 12.5 g. A 2 g emergency
at constant idle lasts about 170.47 simulated seconds, or about 65.41 seconds at
flat fast workload. Normal consumption and simulation time are never sped up.

## Actual validation and reproduction

Executed on Linux x86_64, Node 26.12.1, existing Electron 45.3.2. All commands
below exited 0. GUI/listen checks ran outside the filesystem sandbox with approval.

| Check | Actual result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS, 29 tests (17 existing unchanged, 12 new physics groups) |
| `npm run build` | PASS; existing chunk-size warning, final renderer 938.49 kB |
| `npm run smoke` | PASS, actual physics-enabled scene, pause/reset, native trusted W/Shift input and >=1 m suited movement |
| `node tests/physics-gui.mjs` | PASS, real Electron normal idle/fast, science-site traversal, stationary task/start/finish, emergency, zero-O2 failure, stopped movement, reset, nominal restoration |
| `git diff --check` and protected-path diff | PASS |

Tests cover reference conversion/energy, invalid configurations, gram capacity and
labelled reduced-stock starts, mass/load, signed bilinear ramp/heading, movement
normalization, fixed-clock/frame grouping, blocked/steep/no-data/nonfinite targets,
idle drain, pause/reset, immutable snapshots/caller config isolation, task total
workload and MOXIE, partial terminal ticks, frozen post-fail commands, one failure,
transition-only warnings, unsubscribe, HUD priority and legacy engine behavior.

GUI observations: normal idle displayed 165 W and 42.24 g/h; suited traversal
reached the task at approximately `(34.1,-15.4)` local metres with 440.2 W and
112.68 g/h on its actual local grade. The task remained stationary at 350 W.
Emergency showed 0.27% with true 750 g capacity. Failure screenshot shows exactly
0 g, zero simulated W/g/h, 28.128 kJ and a stopped clock near 66.4 s on that
traverse; the GUI then reset and restored normal stock. Screenshots were inspected.

Ignored local screenshot evidence:
`release/evidence/physics-normal-task.png`, `physics-emergency.png`,
`physics-failed.png`, `physics-restored.png`; standard smoke `/tmp/raw-engine-smoke.png`.
No screenshots, installers or generated data are committed.

Fresh checkout reproduction (existing asset test consumes a built `dist/`):

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run smoke
node tests/physics-gui.mjs   # optional full GUI QA; real elapsed time, ~2 minutes
npm run start:electron
```

The normal application starts full. Click **TEST: O2 EMERGENCY DEMO (2 g / 750 g)**
to restart at the same fixed site with labelled test stock; click terrain and use
WASD/Shift. Wait for failure, use **Reset** to repeat that scenario or
**Return to normal O2 (750 g)** to start nominal again. The GUI QA driver is
optional test-only DevTools automation on loopback; production Electron source,
sandbox and application architecture are unchanged.

## Files, ownership and limitations

Implementation diff: **7 files, 404 insertions, 19 deletions**; this report adds
one documentation file. Exact paths:

- `src/core/physics.ts` — pure profile, SI calculators, strict config, terrain grade, life support and accepted motion.
- `src/core/contracts.ts` — additive telemetry, optional status, events.
- `src/core/engine.ts` — opt-in deterministic integration and terminal failure.
- `src/adapters/hud.ts` — real percentage and prioritized alerts through unchanged Rachel props.
- `src/app/App.tsx` — enable profile, telemetry, explicit test scenario and reset/failure controls.
- `tests/physics.test.mjs` — numerical/lifecycle/integration regressions.
- `tests/physics-gui.mjs` — optional end-to-end GUI QA.
- `docs/physics/IMPLEMENTATION-REPORT.md` — this report.

Compared against both preflight HEAD and local team baseline: **zero changes** to
`src/ui`, `src/terrain`, `src/dev`, `src/shared`, `src/sim`, `src/walk`, `src/map`,
`src/houston`, `public`, `pipeline`, `research`, `electron`, CI, package/dependency
or build files. No owner approval exceptions or new dependencies were needed.

Shipped 4 m grid SHA-256:
`a298e207a647e3e3edb06e18efa7314c439b3dfae6741e348952929ef4d3f059`.
Its exact original NASA/USGS product lineage and processing manifest are still
unverified. A 1 m symmetric probe over this bilinear 4 m grid adds no measured
resolution. Source/control-point calibration remains Victor's follow-up. The
movement model checks probes, target and midpoint; it is not a general continuous
collision detector for arbitrary sub-grid hazards. Endpoint bounds are enforced
conservatively: an attempted step outside the playable box is fully blocked.

The shipped app assumes 0 kg additional payload and exposes that assumption;
10 kg behavior is tested via injectable options. Task-dependent inventories,
sample transfer, individual workload durations, trained gait/soil calibration,
acceleration, thermal/CO2/pressure dynamics, map generation and mission-success
cutscenes remain deferred. Zero oxygen is an authoritative **game mission failure**,
not an instantaneous medical-death prediction. Paused telemetry retains its
activity setting, but elapsed time, gas and energy do not integrate.

No Windows runtime/installer, packaging or physically disconnected offline check
was performed in this round. The terrain, existing scene, NASA citations and
scenario are locally bundled/referenced; no runtime network data was added.
No production blocker was found in the tested Linux demo. Scientific calibration
and the separate native Windows/offline release gates remain open. Changes are
local for review; no push or team-main merge was performed.
