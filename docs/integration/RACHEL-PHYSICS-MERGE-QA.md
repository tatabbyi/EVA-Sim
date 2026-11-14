# Rachel + Mars EVA physics integration — staged review

Branch: `integration/rachel-physics-20261114`
Parents: Alex personal physics main `cf2e1c3` and Rachel team-main mirror `073f9c9`.
**Status: staged source merge for QA, NOT a verified release or main-branch promotion.**

## Scope and ownership
Rachel's updated `src/terrain/**`, `src/ui/**`, `src/audio/suitAudio.ts`, `src/dev/Preview*`, `src/main.tsx` and `docs/style.md` were copied **byte-for-byte** from the mirrored Rachel main. Her baseline has a new immersive base, planning console, rock/space visuals, audio, four science animations, and historic laser/panorama demos.

Physics stays authoritative inside Alex's default `src/app/App.tsx` and its `src/core/physics.ts`; default Electron launch remains RAW Physics v0.1. Navigate to `#preview` (or click `Visual preview`) for Rachel's immersive base scene, which is a **separate visual/legacy gameplay preview**, not yet scientifically integrated with gram-based O2.

Do **not** claim that the Rachel preview applies the 750g suit stock, 293W NASA reference or automatic 0g mission failure. It currently uses demo oxygen **litres** and independent body temp/workload calculations. The team must integrate the agreed physics snapshot into that visual scene before publishing it as the canonical scientific experience. Rachel's portable fictional MOXIE does not refill the suit.

## Source conflict resolutions
- `src/app/App.tsx` — keep Alex's physics-enabled RAW scene as default. Rachel's `Preview` is still accessible via `#preview`.
- `src/core/engine.ts` — preserve fifth-argument physics and failure mechanics; add **legacy-only** `setPosition()` for Rachel's kneel/camera synchronization (returns false in physics mode); add preview-only laser 2–7m interaction range.
- `src/core/contracts.ts` — keep exactly four scientific `TASK_IDS`. Add `PREVIEW_ONLY_TASK_IDS` for Rachel's optional old laser/panorama; physics-enabled missions reject these two.
- `src/main.tsx` — keep Rachel's enhanced React error boundary/hash routing; normal route opens Alex RAW, `#preview` opens Rachel scene.
- `electron/main.cjs` — keep Alex's safer existing offline Electron entrypoint with RAW as default, NOT Rachel's auto-preview default. Existing `smoke:preview` drives the hash explicitly.
- `package.json` — preserve Alex tests/build/smoke/physics scripts and add Rachel's `npm start` alias.
- `scripts/dev-electron.mjs` — use Rachel's newer launch handling for desktop development (needs local smoke check).
- `tsconfig.json` — preserve Alex's stricter equivalent TS configuration; dependency lockfile is byte-identical.

## Scientific and runtime gates BEFORE promotion to personal main
1. Verify the integration branch contains both parent commits and the diff against personal main touches *only* Rachel-owned sources, app boot/error boundary, compatibility adapter, dev scripts, and documentation/test additions.
2. Run `npm ci`, `npm run typecheck`, `npm run build` and `npm test`. Confirm original 29 physics regressions pass, plus new legacy compatibility tests.
3. Run `npm run smoke` and `npm run smoke:preview` in Electron on Linux (Xvfb where needed) and Windows if possible.
4. Run `node tests/physics-gui.mjs` on a graphical Linux session. Verify actual grams, alerts, O2 emergency 0g terminal failure, pause/reset and native WASD/Shift.
5. Launch `npm run start:electron` (RAW physics) and `npm run start:electron -- --smoke-preview` for preview smoke. In ordinary app click `Visual preview` and verify Rachel's new base, 4 science animations, HUD, audio, console and tasks. Do not mistake her litre display for NASA-calibrated grams.
6. The shared terrain still uses the existing 4096m/4m data. Victor's new 2m tiles remain separate and source lineage is unresolved.
7. Only after clean typecheck, build, 29 physics tests, integration tests, Electron RAW/preview smoke and GUI checks, integrate to personal `main`. Do not change upstream Rachel team main until separate review/PR.
8. Keep `feat/fixed-region-map-v01` at its own head; map is not part of this merge.

## Next project task (not done by this git merge)
Reconcile Rachel's immersive Preview camera + science-task loop with Alex's physics engine, **without** duplicating position/O2/time authority. The ideal result has one engine, one O2 stock in grams, one 60Hz clock and semantically linked tasks. Replace Rachel's litres-only preview O2/temperature simulation with read-only adapters from the approved EngineSnapshot. Explicitly label provisional model rates.

## QA operator
If any test fails, fix only the minimal integration glue with both owner contracts in mind. Record exact command results and errors. No force-push, reset, silent physics fallback, or merge to either main while unresolved.
