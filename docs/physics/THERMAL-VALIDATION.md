# Thermal verification and live integration acceptance

**Previous isolated prototype evidence (2026-11-15):** 12/12 mathematical tests passed under Node 22 experimental type stripping; standalone `tsc --strict` passed. **These results do not prove this new branch is integrated, nor that Electron GUI was tested.** Once staged in the repository and integrated by Codex, tests must be rerun and independently reported.

## Known standalone tested behaviours

1. Celsius/Kelvin SI conversion and CODATA sigma.
2. dt=0 leaves temperatures and heat budget unchanged.
3. Correct signs for core-to-skin, skin-to-gas, gas-to-shell and ambient cooling flows.
4. Stefan–Boltzmann radiation and possible sign reversal.
5. Closed four-node system conserves total energy.
6. Metabolic heat contributes correct Joules with other boundaries disabled.
7. Exported mechanical work does not heat control volumes.
8. External radiation, solar, Mars gas exchange and LCVG satisfy energy balance.
9. Cooling failure causes more human heat storage for fixed activity.
10. Different timestep grouping gives temperatures within a declared tolerance.
11. HUD candidate equals internal gas, not ambient or body core.
12. Invalid inputs rejected (NaN, bad emissivity, negative Kelvin, impossible work).

## New integration tests Codex must add

- Current fixed-step engine (not UI timer) advances suit gas as a **real state**.
- `motion.metabolicPowerWatts` is the sole heat-generation input, avoid double-charge.
- Different accepted activities change thermal evolution at a scientifically explainable rate.
- `pause` freezes all temperatures and cumulative energy; `resume` continues; `reset` restores initial conditions.
- O2 terminal substep uses actual `gas.elapsedSeconds`; subsequent failed time does not heat.
- Historical no-physics/legacy createEngine calls still work.
- `toHelmetHud(snapshot).temperature.value` returns a finite Celsius readout when thermal present, `N/A` otherwise.
- **Main `src/dev/Preview.tsx` displays the adapter-provided TEMP**. Avoid existing hardcoded `N/A` override; inspect real GUI.
- `TEMP` reflects **suit gas**, not −60°C outdoors or 37°C core. No fabricated danger thresholds.
- Alpha/warning visualization does not claim medical "safe" range without evidence.
- Build, unit tests, smoke and Electron GUI as available; log actual commands and results.

## Science versus engineering qualification

**MATHEMATICAL IMPLEMENTATION:** testable, four-node energy-balance model.

**SCIENTIFIC CALIBRATION:** incomplete; core/skin simplified, LCVG capacity and suit coefficients unverified, site/sol data missing.

**DISPLAY:** dynamic current **simulated** suit-gas temperature, visibly labelled as engineering estimate. NOT a NASA sensor reading or certified body safety prediction.

**CONSTRAINT:** zero functional regressions in routes, tasks, controls, HUD other bars, O2 rate, O2=0 failure, pauses, reset, Electron. Rachel owns visible Preview and must review its minimal integration diff.

## Suggested completion record

```text
Base SHA:
Branch head:
Paths modified:
Model profile ID and each parameter provenance:
New run tests:
npm run typecheck: PASS/FAIL (details)
npm test: PASS/FAIL (count)
npm run build: PASS/FAIL
npm run smoke: PASS/FAIL/NOT RUN
Electron visible TEMP: VERIFIED/NOT VERIFIED
MODEL / assumption label shown:
Rachel-owned paths changed:
Ready for PR: YES/NO (reason)
```
