# Live suit-gas TEMP integration — engineering scenario v1

Status: **READY FOR REVIEW**, subject to the actual verification results below. Branch `feat/thermal-suit-hud-v01`, starting at `c9c5b4b` (isolated prototype) on the working `08b51e2` game baseline. Tested implementation commit: `a421b27`; this report is committed separately after the code. No merge or push was performed.

Preflight inspected fork main `08b51e2` and the newer independent team main (initially `819ee21`, fetched as `95afe5e`). Team changes were not imported or overwritten. The feature branch's actual engine/Preview paths remain authoritative for this focused change.

## Integration and ownership

- The original `src/physics/thermal.ts` solver and its 12 mathematical tests are unchanged.
- New `src/physics/thermal-scenario.ts` declares a versioned, explicitly **engineering-unvalidated** scenario and immutable telemetry. This is a new disclosed configuration, not an import of the test-only fixture.
- `src/core/engine.ts` initializes four thermal states and advances them inside the existing `step()`, using the exact `motion.metabolicPowerWatts` and **`gas.elapsedSeconds`**. There is no second clock/metabolism/O2 debit. Pause, terminal failure and inactive base do not advance thermal energy; reset restores initial temperatures and counters.
- `src/core/contracts.ts` adds optional typed `thermal` telemetry. `src/core/physics.ts` adds only a type import and optional `thermal` configuration: default disclosed scenario for physics-enabled EVA, `false` to opt out, or an explicit custom scenario. Movement/life-support formulas and constants are unchanged. Legacy non-physics callers remain thermal-free with TEMP=N/A.
- `src/adapters/hud.ts` converts **suit-gas Kelvin to Celsius** and formats one decimal. Its existing bar maps 0–50 °C to 0–1 for display only, with no medical thresholds, heat-stress warnings or thermal mission failure.
- **Rachel review required:** `src/dev/Preview.tsx` has exactly two TEMP-related changes: use the adapter's temperature prop, and replace the stale `TEMP UNKNOWN` telemetry text with the current value plus `MODELED / NOT NASA-VALIDATED`. No scene refactor. No `src/ui/**`, CSS, terrain, VR, routing, input, clock, animation, audio, package or Electron changes.
- `src/app/App.tsx` keeps RAW diagnostics working, distinguishes unknown measured temperature from modeled gas, and shows cooling heat/remnant numerical energy residual.
- `tests/thermal-integration.test.mjs` and `tests/thermal-gui.mjs` add focused authority/readout coverage. `tests/physics.test.mjs` updates the intentional TEMP expectation and retains N/A fallback coverage. This document is the remaining changed file.

## Complete scenario / provenance register

ID: `mars-suit-thermal-engineering-unvalidated-v1`. Every numeric empirical value below is an **UNCALIBRATED ENGINEERING ASSUMPTION**, not a NASA measurement/default. Empirical valid ranges and confidence intervals are **unknown**. Solver checks of finite values, positive capacities, nonnegative temperatures/transport, and optical coefficients in [0,1] are mathematical domains, not physiological validation.

| Parameter / forcing | Value and unit | Provenance / consequence |
|---|---|---|
| Human reference mass | 80 kg | Existing Sharkies engineering reference; not measured astronaut mass |
| Core / skin mass split and specific heat | 0.9 / 0.1; 3500 J/(kg K) | Assumed lumping and tissue specific heat |
| Core / skin capacities | 252000 / 28000 J/K | DERIVED from preceding assumptions; not calibrated thermoregulation |
| Effective suit-gas / shell capacities | 500 / 12000 J/K | Assumed lumped capacities; no identified suit hardware |
| Core→skin / skin→gas / gas→shell conductance | 60 / 7 / 2 W/K | Assumed transport coefficients |
| Skin→coolant conductance | 12 W/K | Assumed LCVG coupling |
| Maximum cooling heat removal | 350 W | Assumed thermal capacity, **not electrical draw or nominal xEMU rating** |
| Coolant inlet | 294.15 K (21 °C) | Prescribed assumed inlet; no pump/liquid-loop solver |
| Radiating / projected solar area | 2.6 / 0.7 m² | Assumed effective suit geometry/orientation |
| Longwave emissivity / solar absorptivity | 0.7 / 0.3 | Assumed coatings, dimensionless |
| Mars-atmosphere conductance | 1 W/K | Assumed finite low-pressure exchange; not measured wind transport |
| Metabolic power | Actual engine W, including slope/payload/activity | Sole existing authoritative input; nominal idle/walk/fast/task 165/293/430/350 W before movement modifiers |
| Exported useful mechanical power | 0 W | Explicit upper heat-retention assumption: no useful mechanical export from modeled volumes, **not measured zero walking work** |
| Sensible respiration transfer | 0.03 × actual metabolic W | Assumed redistribution from core to gas; subtract/add cancel in total energy |
| Internal equipment heat | 5 W | Assumed gas-volume dissipation; no new O2 charge |
| Surface solar irradiance | 400 W/m² | Hypothetical constant forcing, not MEDA/site/sol data or a visual-sky observation |
| Mars air / effective radiative background | 213.15 / 200 K | Separate assumed boundary temperatures; sky/ground view factors uncalibrated |
| Cooling enabled | true | Prescribed operating scenario; tests also instantiate OFF, no random failures |
| Initial core / skin / gas / shell | 310.15 / 306.15 / 296.15 / 260.15 K | Assumed preconditioned state: 37 / 33 / **23** / −13 °C |
| Initial human heat / cumulative boundary energy | 0 / 0 J | Bookkeeping origin, not absolute zero stored energy |
| Stefan–Boltzmann constant | 5.670374419e−8 W/(m² K⁴) | TH-C01 physical constant; unchanged solver |
| Solver controls | ≤0.2 s and ≤5% estimated minimum thermal time constant | Numerical stability criteria, not empirical suit parameters |
| HUD resolution / bar span | 0.1 °C / 0–50 °C | Presentation assumptions, **not accuracy or safety limits** |

The default 80 kg thermal reference matches the current physical scenario. Other astronaut/suit designs require an explicit corresponding thermal configuration and calibration. Source interpretation remains [THERMAL-SOURCES.md](THERMAL-SOURCES.md): TH-N01/02 support architecture/research context, not these coefficients; TH-N03's medical requirement cannot be certified by this four-node model.

## Equations and conservation

The unchanged equations and flow definitions are recorded in [THERMAL-MODEL-V1.md](THERMAL-MODEL-V1.md). Each substep `h` applies:

```text
C_core ΔT_core = (P_met − P_export − Q_resp − Q_cs) h
C_skin ΔT_skin = (Q_cs − Q_sg − Q_cooling) h
C_gas  ΔT_gas  = (Q_resp + Q_sg − Q_gh + P_electronics) h
C_shell ΔT_shell = (Q_gh + Q_solar − Q_IR − Q_atmos) h
```

Adding cancels Q_cs, Q_sg, Q_gh and Q_resp pairwise. Thus
`ΔΣ(C_i T_i) = (P_met − P_export + P_electronics + Q_solar − Q_cooling − Q_IR − Q_atmos) h`.
The solver integrates that boundary energy independently; snapshot `energyBalanceResidualJ` compares stored-energy change with cumulative boundary input relative to the initial state. `lastStepEnergyBalanceResidualJ` preserves the solver's per-call residual. Cooling/last-metabolism diagnostics describe the last modeled state, not additional energy consumption while time is frozen.

Integration tests bound cumulative residual below 0.01 J after 600 s at fixed 60 Hz; original solver tests cover closed-system conservation, external radiation/solar/cooling and ≤0.002 J residual in an 1800 s case. The terminal test exhausts O2 after 0.025 s of a requested 0.2 s step and compares thermal state against exactly 0.025 s of the standalone solver. Subsequent failed commands cannot alter it. These prove mathematical/numerical behavior, **not empirical Mars-suit predictions**.

## Actual verification

Node 26.12.1, TypeScript 7.0.2, Electron 45.3.2; Linux Wayland/Hyprland with the real AMD radeonsi GPU. Installed locked dependencies were present; no `npm ci` or dependency changes needed.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm test` | PASS, exit 0: **62 tests**, including 12 original thermal and 9 new thermal integration cases |
| `node tests/thermal-integration.test.mjs` | PASS, exit 0: 9 focused integration cases |
| `npm run build` | PASS, exit 0; existing large-chunk warning only |
| `npm run smoke` | PASS, exit 0; native pointer lock, WASD/Shift, scene, pause/reset |
| `npm run smoke:preview` | PASS, exit 0; immersive canvas and offline terrain |
| `node tests/thermal-gui.mjs` | PASS, exit 0 |
| `git diff --check` / ownership review | PASS |

The new tests cover initial state, immutable/captured configuration, sole actual metabolism, idle/walk/fast/task dynamics, stationary science and unchanged O2/movement, cooling ON/OFF, pause/resume/reset, terminal partial dt, initial zero O2, fixed-clock grouping, bounded coarse-step error, legacy/explicit opt-out, correct suit-gas Celsius and the main Preview binding.

A sandboxed repeat of `npm test` exited 1 in the existing local-port smoke test; all other test files passed. Running the complete suite outside the sandbox passed **62/62**, exit 0. The failed sandbox log is preserved as `release/evidence/thermal/tests-sandbox.log`; no test was skipped or weakened.

**VISIBLE LIVE TEMP VERIFIED:** the native main base→console→airlock→EVA path showed `23.0°C → 23.2°C`, matching current gas Kelvin within display/sample resolution; walking/running and O2 remained functional. Pause froze exact thermal state and the displayed string, resume continued continuously, and the real Reset button returned to an inactive base with no engine. No runtime errors or unsafe graphics flags. Native setup used the existing observer/targeted-focus harness; no production debug bridge or UI clock was added.

Screenshot: `release/evidence/post-merge/thermal-live.png`. Exact native states: `release/evidence/thermal/gui.json`; logs: `release/evidence/thermal/{typecheck,tests,build,gui,smoke,smoke-preview}.log`. These are local ignored evidence.

Launch with `npm run build` and `npm run start:electron`. Plan two tasks, press E at the airlock, observe TEMP for several seconds, then Esc to pause; wait briefly and click to resume. RAW thermal diagnostics remain at `#raw`.

## Review and limitations

**READY FOR ALEX AND RACHEL'S REVIEW** on this feature branch. Verified movement/O2 equivalence with thermal disabled, exact terminal-time coupling, and the real main helmet readout. This is not approval to merge or a claim of exhaustive gameplay regression coverage.

No calibration to real human/suit tests, measured site/sol forcing, humidity/sweat/latent heat, coolant hydraulics, battery draw, weather/visual sun coupling, validated useful work output, medical limits or NASA safety compliance is claimed. Thermal does not cause a new mission failure. Windows native/installer verification and long-duration human validation are NOT TESTED. This is a reviewable mathematical engineering demo; Alex reviews the model/configuration and Rachel reviews the two minimal TEMP bindings, with the existing HUD design unchanged.
