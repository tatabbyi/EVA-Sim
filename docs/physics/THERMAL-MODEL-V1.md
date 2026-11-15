# Thermal physical model v0.1 — mathematical contract

**Status 2026-11-15:** energy-balance prototype independently tested, not calibrated to a real Mars EVA suit, not integrated to game. `src/physics/thermal.ts` when present is a transfer-ready isolated prototype. No claim of NASA physiological validation.

## State / units

Four thermal capacitances, temperatures in **Kelvin**: human core `T_c`, human skin `T_s`, pressurised suit gas `T_g`, exterior shell `T_h`. Heat capacities `C_c,C_s,C_g,C_h` [J/K]; all conductances `K` [W/K]. This is a coarse **engineering thermal network**, not the NASA 41-Node Man or Wissler human model.

**Temperature in Rachel's HelmetHud: `T_g - 273.15` degrees Celsius.** Not human body temperature, not ambient Mars temperature, not coolant temperature.

## Internal heat flows [W]

```text
Q_cs = K_cs * (T_c - T_s)         // human core to skin
Q_sg = K_sg * (T_s - T_g)         // skin to suit gas
Q_gh = K_gh * (T_g - T_h)         // suit gas to shell
Q_LCVG = coolingOn ? min(Q_max, max(0, K_LCVG * (T_s - T_coolant))) : 0
```

## External environmental flows [W]

```text
Q_solar = solarAbsorptivity * projectedAreaM2 * incidentSolarFluxWm2
Q_IR = emissivity * sigma * radiatingAreaM2 * (T_h^4 - T_radiation^4)
Q_atmos = MarsAtmosphereConductanceWK * (T_h - T_MarsAir)
sigma = 5.670374419e-8 W/(m2 K4)  // NIST/CODATA
```

The effective radiative background `T_radiation` is NOT generally Mars-air temperature; account for sky/ground view factors in future calibration. Mars convection is low but not identically zero. Solar input requires location/time/pose assumptions.

## Differential energy conservation

```text
C_c * dT_c/dt = P_metabolic - P_exported_mechanical - Q_resp_sensible - Q_cs
C_s * dT_s/dt = Q_cs - Q_sg - Q_LCVG
C_g * dT_g/dt = Q_resp_sensible + Q_sg - Q_gh + P_electronics_internal
C_h * dT_h/dt = Q_gh + Q_solar - Q_IR - Q_atmos

sum_i C_i * dT_i/dt =
    P_metabolic - P_exported_mechanical
    + P_electronics_internal + Q_solar - Q_LCVG - Q_IR - Q_atmos
```

All internal transfers cancel exactly. The solver must report the residual between change in stored node energy and integrated net external energy, with a numerical tolerance stated in tests. Finite heat capacities ensure continuous thermal state. Thermal `P_metabolic` uses the existing accepted core value; **do not charge metabolic power a second time**.

## Solver

The isolated prototype uses explicit Euler with stability substeps <=0.2 s and <=5% of the smallest estimated thermal time constant. These are **numerical tolerances, not NASA empirical values**. Reject nonfinite/out-of-domain input. O2 terminal steps use `gas.elapsedSeconds` so partial-step failure is coherent. No integration during pause or after failed status.

## LCVG / boundaries

LCVG coolant inlet temperature and maximum heat removal are prescribed for this first model; a dynamic pump, pressure, water/evaporation, latent heat, human sweating and humidity solver are OUT OF SCOPE. The model is a heat transfer backbone, not a certified thermal safety system.

## Science claim constraints

NASA BVAD documents LCVG and PLSS thermal transport. xEMU tests reported primary/auxiliary loop **test ranges**, not a nominal Mars-suit cooling capacity. NASA-STD-3001 Vol 2 Rev F [V2 11011] specifies stored-heat requirements assessed using **41-Node Man or Wissler**; a four-node result cannot claim compliance or produce medical failure thresholds. `T_c` and `T_s` are illustrative lumped-node states pending calibration. See `THERMAL-SOURCES.md` and `THERMAL-VARIABLE-REGISTER.md`.

## Explicit engineering-demo disposition

When genuine material and site observations are missing, use a separate, versioned `engineering-unvalidated` demonstration profile with traceable declared assumptions and `MODELED` indication. Do not call assumptions measured NASA data. Avoid misleading fixed or random thermal values. If initialization is impossible or inputs invalid, `TEMP=N/A` is required instead of invented precision.