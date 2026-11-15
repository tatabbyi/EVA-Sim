# Frontend / physics demo QA

2026-11-14/15. Branch: `fix/post-merge-runtime-qa`. Start: `0b2e01af992a15a8169f6d77589d1f74f2b573fa`. Tested code commit: `e2e240ec27d25df4b4f14e600378ca19af910658`; this report follows in a documentation-only commit. No push, merge, new branch, dependency changes or terrain/map integration.

Rachel's default experience and `#preview` now use the physics-enabled engine outdoors; `#raw` preserves diagnostics. Indoors retain the original room controls. Engine snapshots own X/Z, physical gait/slope response, oxygen grams, workload, time, pause, task status and failure. One fixed 60 Hz timer advances physics independently of rendering. The render loop reads snapshots and drives presentation; no legacy oxygen refill/body-temperature/base-store calculation remains active.

The existing helmet shows physical oxygen percentage/warnings; a compact panel shows grams, g/hour, watts and elapsed simulation time. Temperature is N/A. Fog, breath, sounds, sway, crouch height and tools remain visual. Jumping is disabled; animations cannot reposition the physics player. Only engine-authorized tasks animate; UI completion requires engine confirmation. Zero oxygen freezes gameplay and task progress; Reset to base reloads a fresh normal mission.

Exactly two of four official objectives are required. The shared asset/marker/engine X/Z sites are `(-8,-5)`, `(8,-7)`, `(-12,-17)`, `(12,-20)` m: about 14–29 m from the airlock. All six pairs pass checks against the actual bundled DEM. Physical movement also respects bounds and the existing base footprint mask; decorative loose rocks retain their previous behavior.

## Planning

`src/adapters/eva-demo.ts` samples the actual planar guidance curve at ≤0.5 m intervals, uses the profile's 1 m signed terrain probe, rejects unsupported grades/data/bounds, and calls `activityResponse()`. Duration is distance/speed; oxygen is `gramsPerHour(power) × seconds / 3600`, including outbound and return travel. Tasks use profile 350 W and existing 3–5 minute planning budgets. Reserve is an explicitly assumed 30 minutes of profile idle workload: approximately 21.12 g, distinct from the engine's 150 g low / 75 g critical thresholds. Capacity remains 750 g. No litre conversion or independent Minetti/Tobler model is used. The console labels ENGINEERING SCENARIO ESTIMATES and base storage “Not simulated.” Planning budgets are conservative assumptions; existing short task animations are not NASA-certified task durations.

## Results

Native Linux/Wayland, Hyprland, AMD GPU, Electron 45.3.2; no unsafe graphics flags or security changes. GUI automation uses real key/click input and existing observers; outdoor travel is physical, without teleportation.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, 0 |
| `npm run build` | PASS, 0; existing bundle-size warning |
| `npm test` | PASS, 0; 41 tests |
| `npm run smoke` | PASS, 0; compositor focus assistance, assertions unchanged |
| `npm run smoke:preview` | PASS, 0 |
| `node tests/demo-physics-gui.mjs` | PASS, 0 |
| `node tests/demo-physics-gui.mjs --emergency` | PASS, 0 |
| `node tests/physics-gui.mjs` | PASS, 0 |
| `node tests/integration-gui.mjs` | PASS, 0; all four animations, audio, Escape and route/clock checks |
| `npm run start:electron` | PASS; real native window launched and mapped |
| `git diff --check`, ownership | PASS |

The nominal native flow verified default base → console/grams → two tasks → physical walk/run → stationary 350 W science → both engine-confirmed completions → return guidance. Oxygen continued decreasing at rest; fog reached 0.516, breath condensation animated, and WebAudio ran. Pause froze the authoritative snapshot; forward movement after Esc/relock and RAW navigation passed. The integrated emergency depleted real 2 g stock to exactly zero after 63.0162 simulated seconds, rejected further movement/task input, consumed no further energy/oxygen, and reset to normal base. One EVA showed two intentional renderers, one RAF and one physics timer, with no late disposed draws observed; no long leak-soak claim.

Test-only fixes covered fresh-document navigation, selector quoting, explicit idle readiness and Chromium's Escape cooldown. A RAW GUI attempt and a smoke retry lost native focus; logs retain the interruptions. Reacquiring compositor focus made the RAW retry pass without weakening assertions. The final smoke passed with compositor assistance targeted only at its process descendants; no source focus/security assertion was removed.

Evidence: `release/evidence/demo-physics/` logs and `gui.json` / `emergency.json`; screenshots `release/evidence/post-merge/demo-physics-{base,console,exertion,science,completed,return-guidance}.png` and `demo-emergency-failed.png`. Evidence is local and ignored by Git.

## Changed files / review

- New Alex adapter: `src/adapters/eva-demo.ts`.
- **Rachel review:** `src/dev/Preview.tsx`, `src/ui/SetupConsole.tsx`, `src/main.tsx` — integration, unit-safe console text/props and default routing; existing layout/assets/CSS preserved.
- `electron/smoke.cjs`: route navigation only; assertions/security unchanged.
- `tests/eva-demo.test.mjs`, `tests/demo-physics-gui.mjs`: focused planning, authority, terrain-pair and native regressions.
- `tests/gui-runtime.mjs`: Preview ref observation and actual route/input readiness.
- `tests/physics-gui.mjs`, `tests/movement-gui.mjs`: RAW navigation/focus readiness.
- This report. Core formulas, previous RAW input fix, terrain/audio assets, styles, dependencies and isolated map branch are unchanged.

## Launch / limits

Run `npm run build`, then `npm run start:electron`. Maximize the window if the desktop tiles it narrowly. Click to look; approach/click the console; select exactly two tasks; Save/Esc; E at the hatch. WASD walks, Shift selects the physical faster gait, F starts nearby science. Complete both for return guidance. Esc releases and pauses EVA; wait briefly and click to resume. The panel provides Pause/Resume, Reset and RAW diagnostics. For failure, choose the base's **Developer test → TEST: 2 g emergency oxygen** link before launching EVA; capacity stays 750 g and consumption is not accelerated. Reset removes emergency mode.

Ready for Alex’s manual demo review, with the three Rachel-owned files requiring her review. No remaining reproducible source blocker was observed. This is not Windows/installer certification or approval to merge either main.

Deferred: Victor's new terrain, the separate map feature, unfinished routing/inventory, new collision/physiology models, and a formal engine success state. Completed tasks/return guidance do not invent a new mission-success contract. Native Windows, installers, long GPU soak and human audio-quality review are NOT TESTED.
