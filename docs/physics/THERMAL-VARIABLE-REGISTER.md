# Thermal variable register — initial integrated slice

**Scope:** physical states and required inputs for the first thermal-to-HUD integration; all SI in solver, Celsius only at UI boundary.

| ID | Symbol / name | Units | Kind | Dependencies / provenance |
| --- | --- | --- | --- | --- |
| T-S01 | T_c coreTemperatureK | K | State | C_core; P_met; mechanical export; respiration; Q_core-skin — not clinically calibrated |
| T-S02 | T_s skinTemperatureK | K | State | C_skin; Q_core-skin; Q_skin-gas; Q_LCVG — unvalidated lumped-body |
| T-S03 | T_g suitGasTemperatureK | K | State | C_gas; Q_skin-gas; respiration; Q_gas-shell; electronic heat — **TEMP HUD source** |
| T-S04 | T_h outerShellTemperatureK | K | State | C_shell; solar gain; radiation; Mars air exchange; gas-shell transfer |
| T-P01 | C_core / C_skin | J/K | Parameter | Human tissue thermodynamics / reference astronaut mass; requires calibration |
| T-P02 | C_gas / C_shell | J/K | Parameter | Suit gas mass, shell construction / specific heats; requires suit design |
| T-P03 | K_cs/K_sg/K_gh | W/K | Parameter | Effective inter-node transport; requires lab data |
| T-P04 | K_LCVG, Q_max, T_coolant | W/K, W, K | Parameter | NASA LCVG analog, engineering Mars PLSS heat rejection, not nominal xEMU inference |
| T-P05 | eps, alpha, A_radiating, A_solar | dimensionless, m2 | Parameter | Shell optical properties, geometry and orientation |
| T-P06 | K_Mars_conv | W/K | Parameter | External pressure, gas properties, wind, boundary layer; uncalibrated |
| T-B01 | P_met | W | Engine forcing | **Existing** authoritative `motion.metabolicPowerWatts` |
| T-B02 | P_exported_mechanical | W | Engine forcing | Actual useful external mechanical power; cannot silently assume measured walking output |
| T-B03 | Q_resp_sensible | W | Engine forcing | Human sensible respiration transfer to suit gas; humidity/latent absent |
| T-B04 | P_electronics | W | Engine forcing | Suit internal electric dissipation, not equal to human metabolism |
| T-B05 | I_solar | W/m2 | Environment | Chosen Mars site/sol and sun orientation; NOT a generic NASA default |
| T-B06 | T_Mars_air | K | Environment | Site/sol-specific atmosphere when available; current −60°C is scenario |
| T-B07 | T_rad_environment | K | Environment | Effective sky/soil IR background; **not** automatically T_Mars_air |
| T-B08 | coolingEnabled | bool | PLSS command | Scenario cooling on/off; random failures out of scope |
| T-D01 | humanStoredHeatJ | J | Diagnostic | Integral core and skin energy change, **not NASA 41-node validation** |
| T-D02 | energyBalanceResidualJ | J | Numeric QA | `sum(C_i * ΔT_i) - integral(netBoundaryPower * dt)` |
| T-H01 | HUD TEMP | °C | Presentation | `kelvinToCelsius(T-S03)`, from snapshot only; may be labelled MODEL |

## Uncertainty policy

For any numeric configuration field, record the value, SI unit, evidence ID, source page/table or declared engineering assumption, valid range and confidence. Do not give unsupported percent probabilities of thermal failure or medical thresholds. A working simulated gauge is **not a real sensor measurement**.