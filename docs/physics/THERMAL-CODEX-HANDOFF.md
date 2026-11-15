# CODEX HANDOFF — Mars EVA Thermal Physics + Live Suit TEMP

**Repository:** `mokachkasss/Sharkies`
**Branch:** `feat/thermal-suit-hud-v01`
**Base:** `08b51e2c0a6d8b535dd90c81a530b2da4ab3a5a0`
**Prepared:** 2026-11-15
**Owner:** Alex (physics and app integration); Rachel owns visual/HUD components.
**Priority:** short, focused implementation window, **maximum 30 minutes of intended agent work**, not an excuse to claim unrun checks.
**Status:** IMPLEMENTATION TASK, NOT COMPLETED INTEGRATION.

## Goal / Definition of Done

Integrate the existing isolated thermal prototype into **the one authoritative simulation engine**, so the visible EVA helmet HUD shows a changing, physically calculated **internal suit-gas temperature in degrees Celsius** rather than `N/A`. One clock, one state, no UI-based or FPS-based temperature calculations. The calculation must conserve energy and be explicitly labelled **ENGINEERING MODEL / NOT NASA-VALIDATED** until empirical parameters are calibrated. Preserve every other existing game behaviour (zero functional regression).

## Mandatory preflight

1. Confirm branch `feat/thermal-suit-hud-v01`, clean worktree, and inspect latest `main` and Rachel team/main before editing. **Do not merge/reset/rebase/force-push** automatically. If Rachel's refactor has landed, adapt paths to new architecture rather than overwriting her work.
2. Read this handoff and `docs/physics/{THERMAL-MODEL-V1,THERMAL-SOURCES,THERMAL-VARIABLE-REGISTER,THERMAL-VALIDATION}.md`. Read the existing physics baseline `src/core/{physics,engine,contracts}.ts`, `src/adapters/hud.ts`, `src/dev/Preview.tsx`, `src/ui/HelmetHud.tsx`, tests and current scripts.
3. If `src/physics/thermal.ts` is present, it is the **isolated 12-test prototype**: integrate rather than rewrite casually. It has **NO sourced default Mars-suit configuration**. Do not copy uncalibrated fixture constants into unlabelled production physics.

## Implementation steps (in order)

1. Keep the four physical states: `coreTemperatureK`, `skinTemperatureK`, `suitGasTemperatureK`, `outerShellTemperatureK` plus energy bookkeeping. One `advanceThermalModel(parameters,state,boundaries,seconds)` with SI units, no React/Three/Electron imports.
2. Introduce a **versioned and disclosed** thermal engineering scenario profile and initial conditions; every parameter and forcing must have provenance (NASA source, physical identity, derived, or explicitly UNCALIBRATED ENGINEERING ASSUMPTION). NASA cannot validate a fictional Mars suit. Use a clearly identified **MODELED** readout, not a measured sensor or NASA-approved physiological metric. You may reuse the standalone fixture only in a visibly labelled developer/test scenario; document all assumptions and their consequences. Do NOT block a functional DEMO readout solely because a certified future suit is unavailable.
3. Integrate thermal state in the core's **existing fixed-time `engine.step(dt)`**; read the real `motion.metabolicPowerWatts`, do not invent a second metabolism. Integrate over **`gas.elapsedSeconds`**, not the requested `seconds`, so O2 depletion mid-step does not advance thermal energy after mission failure. On `pause` or failed state, thermal stops. On `reset`, restore the exact initial thermal state and counters. Publish immutable snapshot telemetry and keep old callers backward compatible.
4. Introduce `thermal?: { suitGasTemperatureK, coreTemperatureK, skinTemperatureK, outerShellTemperatureK, coolingHeatW, ... }` or equivalent strictly typed read-only telemetry. All temperatures in the solver use K; UI conversion is K → °C once.
5. In Alex's HUD adapter, map the current **suit-gas** temperature to `HelmetHudProps.temperature` (e.g. `23.1°C`). No ambient −60°C or core-body temperature masquerading as suit TEMP. An existing visual bar `fraction` is a **display mapping only**; do not call it a medical threshold or generate heat-stress failure from it. Include the explicit engineering-estimate / nonvalidated status somewhere in diagnostics or demo presentation.
6. **Critical visibility issue:** the player's actual route currently uses `src/dev/Preview.tsx`. It explicitly passes `temperature={{label:'TEMP',value:'N/A',fraction:0}}`, ignoring the existing HUD adapter. Replace only that binding with `temperature={physicalHud?.temperature ?? {label:'TEMP',value:'N/A',fraction:0}}` (or equivalent) so the existing Rachel helmet HUD displays the current computed result. A change to `src/ui/**` should NOT be necessary. This ONE minimal `src/dev/**` integration edit is allowed by Alex for the handoff but **requires Rachel's review**, not a broad rewrite.
7. Make sure actual visible suit TEMP reacts over simulation time and activity/cooling conditions. It must freeze while paused, restore on reset, and not update after terminal O2 exhaustion. No phantom heat while the mission is inactive, and no unphysical fast jumps.
8. Keep `src/app/App.tsx` legacy demo compatibility if present. Prioritise the main actual EVA scene (`Preview.tsx`), not `#raw`. Do NOT refactor `Preview.tsx`, `main.tsx`, terrain, VR, routing, animations, fog, HUD layout, or unrelated tasks.

## Scope and science limitations

- This task is thermal physics + readout only. **NOT** a validated NASA 41-Node Man/Wissler physiological model, humidity, liquid-loop hydraulics, gas exchange, radiation dose, stochastic accidents, weather generation, sensor malfunction, or 3D terrain changes.
- Shell solar irradiation, convective heat transfer and radiative environment currently lack location/sol-specific validated inputs. All fallback/scenario forcing MUST be tagged engineering assumption and cannot be presented as actual observations for Rachel's latest landing site.
- The liquid cooling sink is a limited heat-removal abstraction, not a validated Mars evaporator. Cooling capacity W is **thermal heat removal**, not electrical draw W.
- `TEMP` must be the actual **current simulation state**, not fixed, random, the atmospheric outside temperature, or a React timer.
- The model should remain usable after Rachel's planned modular restructuring; keep it pure and narrowly coupled.

## Acceptance and evidence

Run `npm ci` if needed, `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke` where available and existing/new thermal tests. Record versions, return codes and actual results. New tests must cover: energy conservation; initial temperature; thermal dynamics as metabolism changes; cooling ON/OFF; deterministic/fixed-step behaviour; pause, reset, zero-g O2 terminal partial timestep; immutable snapshot; **HUD adapter suit-gas readout**; and main Preview binding. GUI check in Electron where possible, otherwise explicitly mark GUI unverified.
No invented NASA calibration, no edits to owner's scene beyond the minimum HUD prop. New physics must be opt-in if needed to preserve old no-physics tests. No push to Rachel team main, no merge into fork main. Commit ONLY to the feature branch; propose a reviewable PR only when tested. Rachel must review the single file in her domain.

## Codex completion report

Report: actual changed files; source and scenario parameter table (with units); exact mathematical equations and conservation proof; test commands and passing counts; screenshot or honest limitation for visible LIVE TEMP; how to launch; remaining scientific unknowns; and status `READY FOR REVIEW` or `NOT READY`. Prefer truthful incomplete delivery over faking results.

**Paste into Codex:** "Open `mokachkasss/Sharkies` on `feat/thermal-suit-hud-v01`, read `docs/physics/THERMAL-CODEX-HANDOFF.md` and every linked thermal science document, then implement the smallest tested physics-to-HUD integration. Preserve all existing behaviour, touch Rachel-owned Preview only for the required TEMP prop, commit solely to this branch, and report what you actually verified. Do not merge."