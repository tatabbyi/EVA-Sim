# Combined build: post-merge runtime QA

Date: 2026-11-14. Status: local QA; no upstream promotion or scientific unification approval.

## Revision and ownership

- Initial clean checkout: `integration/rachel-physics-20261114`, `9541b48ef6f2ef269411e36a8a08dca218f71466`.
- Dedicated local branch created from that exact HEAD: `fix/post-merge-runtime-qa`.
- Final tested implementation commit: `0db4b0b184a8bdede9d45ba48b141f58ec256487`. This report is committed separately after the implementation so it can record the exact tested code SHA. The final documentation-only commit is available through `git log -1`; it does not change the tested code.
- Combined merge `a3f074302698729f7bcc2d4c35c87871c83b813b` retains both parents: Alex `cf2e1c37f1dadad8c6aced727bb430b859e87b01`, Rachel `073f9c96fd707aa6a7b436150325f944646f8df3`.
- `integration/rachel-physics-20261114` remains at the initial SHA. Separate map branch remains `95a9be743bf9507c2d0fa9cc30aad886d5f3d624`; that commit is not an ancestor of this checkout. No map implementation is included or changed.
- Remotes inspected: origin `git@github.com:mokachkasss/Sharkies.git`, team `git@github.com:tatabbyi/EVA-Sim.git`, historical upstream `git@github.com:tatabbyi/Sharkies.git`. No fetch, push, PR, reset, stash, rebase or merge was performed.

Production changes are limited to `src/adapters/input.ts` and **Rachel-owned `src/dev/Preview.tsx`**. The latter needs Rachel's review: it changes input release/gating only, with no public signature or visual architecture change. The user's explicit permission for a necessary minimal Rachel-owned repair applies here. No edits to terrain assets, visual modules under `src/ui`/`src/terrain`, planner, physics equations/contracts, Electron host, dependencies, build system or map feature.

## Machine and execution conditions

Arch Linux x86_64, kernel `7.2.11-arch1-1`; native Wayland session, Hyprland 0.57.0, `WAYLAND_DISPLAY=wayland-1`, `DISPLAY=:0`. Real AMD Radeon Graphics (renoir/radeonsi/ACO, device `0x1636`), Mesa 26.2.6, direct/accelerated rendering, OpenGL 4.6 / GLES 3.2. Electron reports `ANGLE (AMD, AMD Radeon Graphics (radeonsi renoir ACO), OpenGL ES 3.2)`, with no context loss during completed checks. Node 26.12.1, Electron 45.3.2, Three 0.187.0, TypeScript 7.0.2. Installed locked dependencies were present; no installation was needed.

Tests use the real display/GPU outside the filesystem sandbox, which does not expose the host DRM devices. No Xvfb, software-rendering substitute, unsafe GPU flags, `--no-sandbox`, application sandbox removal or graphics error suppression was used. Diagnostics: `release/evidence/post-merge/system.log`.

Hyprland denied reliable application-initiated focus with `Page.bringToFront` alone. The optional QA harness uses `hyprctl eval` to focus **only its own child PIDs**; its initial app window is floated/resized to 1280×800 for readable screenshots. No persistent desktop setting is changed. A second temporary sandboxed Electron window produces genuine OS focus loss. Browser-reserved Escape did not release lock through CDP, so the final Escape check uses the compositor's `send_shortcut` targeted at the QA window object. Other platforms use ordinary window focus/keyboard dispatch and must provide a usable interactive desktop.

These are automated native Electron interactions plus screenshot inspection, not a claim of a human playthrough. CDP delivers trusted keyboard/mouse events. Initial pointer lock uses a user-gesture canvas click and verifies the real lock. Camera quaternions are set as test fixtures for exact headings; dedicated mouse-look checks then rotate the real camera and test against its new direction. Test-only observation uses Three's existing devtools events and React refs; no production test bridge is installed. Loopback remote debugging exists only in the test child process.

## Reproduced bugs and fixes

### High: RAW camera-relative WASD reverses or deflects

Reproduce on the initial build: enter RAW, acquire pointer lock, turn 180° horizontally, press any WASD key. W moves backward relative to the view. Pitching at headings near 90°/270° also deflects travel. Preview base and EVA did not exhibit this direction inversion.

Native baseline: 171 probes completed. RAW had 34 incorrect direction probes; preview base 57/57 and preview EVA 57/57 direction probes passed. At RAW heading 180°, pitch 0°, W moved from `(11.9977577, 11.9954161)` to `(11.9977577, 11.8086394)`. Camera planar forward was approximately `(0,+1)`: displacement dot forward = `-0.1867767 m`, normalized alignment `-1`. With pitch ±45° at 90°/270°, alignment was approximately `0.7071`, a 45° error. Baseline native run exited 1 with 35 total failures, including the separate preview unlock bug below.

Cause: `camera.rotation.y` is the Y component of the camera's default **XYZ** Euler decomposition, not heading. PointerLockControls constructs orientation using **YXZ**. At a 180° Y rotation, the equivalent XYZ decomposition has Y approximately 0 and X/Z approximately ±π. The old adapter therefore generated W `(0,-1)` when the camera actually faced `(0,+1)`. This adapter was unchanged between Alex's `cf2e1c3` baseline and the initial combined build; the evidence identifies a latent adapter defect, not a Rachel sign change.

Correction: obtain world forward from the camera quaternion using `getWorldDirection()`, flatten and normalize it to `F=(fx,fz)`. In the east-positive X / south-positive Z frame, right is `R=(-fz,fx)`. Dispatch `d=fwd*F+side*R`; the engine retains responsibility for normalizing diagonal input. Since `F·R=0` and both have unit length, W/S have forward dot ±1 and D/A have right dot ±1, independently of Euler representation or pitch. Exactly vertical look falls back to horizontal camera-right to recover heading. No speed, slope or resource calculation changes.

Regression: `tests/input-orientation.test.mjs` runs the actual adapter, real Three camera/quaternion/PointerLockControls, and actual engine at 11 headings with pitches −70°, 0°, +55°, all WASD; also exact vertical views and held-input lifecycle/diagonal cases. The original adapter failed three matrix tests; the correction passes all five tests. `tests/routes.test.mjs` now uses a real camera instead of a yaw-only mock.

### High: preview EVA continues walking after pointer unlock

Reproduce: launch EVA from the base hatch, hold W, release pointer lock without delivering W key-up to the page. The baseline continued walking while unlocked. Base and RAW stopped correctly.

Cause: preview stored all keydowns, dispatched EVA movement without checking lock/pause state, and had no unlock cleanup. Window blur already cleared keys/paused, but pointer unlock alone did not.

Correction in Rachel-owned `Preview.tsx`: only retain held keys while locked; reuse existing blur cleanup on unlock to clear intent/pause EVA; gate walking and jump initiation on lock/pause; remove the unlock handler on cleanup. Existing click-to-lock resumes the existing EVA runtime. Console, room, task animations, terrain and legacy resource model remain intact. Native regression holds W through unlock and checks stationary displacement, then relocks and checks stale intent is absent; genuine second-window focus loss is tested separately in all three movement contexts.

## Test results

Commands below ran from the repository root. Baseline commands ran in the requested order before source edits. Final typecheck/build ran after the two production fixes; subsequent edits were QA tests/report only.

| Command | Baseline | Final | Evidence under `release/evidence/post-merge/` |
|---|---|---|---|
| `npm ls --depth=0` | PASS, 0 | No dependency changes | `system.log` |
| `npm run typecheck` | PASS, 0 | PASS, 0 | `baseline-typecheck.log`, `final-typecheck.log` |
| `npm run build` | PASS, 0 | PASS, 0 | `baseline-build.log`, `final-build.log` |
| `npm test` | PASS, 0; 33 tests | PASS, 0; 38 tests | `baseline-tests.log`, `final-tests.log` |
| `npm run smoke` | PASS, 0 | PASS, 0 | `baseline-smoke.log`, `final-smoke.log` |
| `npm run smoke:preview` | PASS, 0 | PASS, 0 | `baseline-preview.log`, `final-preview.log` |
| `node tests/physics-gui.mjs` | PASS, 0 | PASS, 0 | `baseline-physics-gui.log`, `final-physics-gui.log` |
| `node tests/input-orientation.test.mjs` | FAIL, 1; old adapter | PASS, 0; five tests | `baseline-orientation-unit.log`, `final-orientation-unit.log` |
| `node tests/movement-gui.mjs --baseline` | FAIL, 1; 35 failures | Baseline only | `baseline-movement.log`, `baseline-movement.json` |
| `node tests/movement-gui.mjs` | New regression | PASS, 0; 171 probes, no interrupted fixtures | `final-movement.log`, `movement.json` |
| `node tests/integration-gui.mjs` | New regression | PASS, 0 | `final-integration-gui.log`, `integration.json` |
| `git diff --check` | Clean | PASS, 0 | Repeated during review |

Build emits the existing >500 kB chunk warning (final JS approximately 1,013 kB), not a build failure. No packaging/cross-build loops were run.

Diagnostic/unsuccessful attempts are retained rather than hidden:

- Initial instrumentation attempt failed CDP serialization of a camera/DOM object; `until()` now returns a Boolean. This was a test harness failure.
- First post-fix physics GUI attempt exited 1 after the app lost focus and correctly paused before the science site: `final-physics-gui-focus-interrupted.log`, `physics-focus-interrupted.png`. Assertions were not weakened; native compositor focus was added to the optional test.
- Expanded movement attempt exited 1 because a mouse-look event did not rotate and the second window could not take focus: `movement-focus-attempt.log/json`. Native compositor focus and a two-event mouse move resolved the automation setup.
- A later matrix completed 171 probes with one isolated RAW deviation in the shared interactive desktop (`0°/+45° A`, alignment 0.9182; exit 1, recorded in the execution transcript; its intermediate JSON was superseded by the final run). The final harness records before/after orientation and retains externally rotated fixtures in `interferences`; at most two fixture retries are allowed. A direction alignment failure with stable camera orientation is never retried. The final passing run had zero interrupted fixtures or retries.
- First animation suite attempts exited 1 because its template-string regex lost the digit escape. `task-diagnostic.log` independently captured the real animation progressing and completing; the assertion now uses `[0-9]`. `integration-first-attempt.log/json` retain the first failure. No task timing or product code was changed to satisfy it.
- The CDP Escape attempt exited 1 (`integration-cdp-escape-attempt.log`); compositor-delivered Escape succeeded without adding an app keyboard workaround. Installed `ydotool` had no daemon/socket, so it was not used and no daemon was installed.
- A later suite passed all four task animations, then exited 1 on an incorrect exact-zero audio assertion (`integration-audio-assertion-attempt.log`). Existing audio uses a 50 ms exponential target envelope. The corrected check requires running audio, mute gain below 0.001 (>59 dB attenuation from 0.9), then unmute recovery above 0.89; audio source is unchanged.
- `integration-clock-fixture-attempt.log` records another exit 1: the new clock test started its measurement before reading/inspecting the terrain grid, but asserted a 600 ms interval. Measurement now starts immediately before the wait, after fixture preparation, with both simulation and wall times retained; its elapsed-time and 60 Hz assertions are unchanged.

## Coverage matrix and limits

| Behavior | RAW | Rachel base / console | Rachel EVA |
|---|---|---|---|
| Native startup, real GPU, scene/HUD | PASS | PASS | PASS |
| Cardinal/pitched/wrapped camera-relative WASD | PASS, 57 probes | PASS, 57 probes | PASS, 57 probes |
| Diagonal normalization and Shift | PASS; measured diagonal/walk 1.076, fast/walk 1.646 (terrain and fixed-step timing) | PASS; diagonal/walk 0.933, Shift has no faster indoor gait | PASS; diagonal/walk 1.000, fast/walk 2.091 (legacy speeds) |
| Native mouse-look then relative W | PASS | PASS | PASS |
| Release key, held W through unlock, relock, genuine native focus loss | PASS | PASS | PASS |
| Camera XZ / engine authority | PASS; compared every RAW probe | Indoor room/collision controller, not RAW physics | Legacy engine synchronizes camera; no scientific equivalence claim |
| Console interaction / plan / hatch launch | N/A | PASS; native walk/click, Esc stand, E at hatch | PASS; reached through real base flow |
| 60 Hz simulation, pause/resume/reset | PASS; native clock quantization and exact paused snapshot, deterministic unit grouping tests | N/A, legacy setup | Legacy clock/focus handling PASS; independent demo time remains |
| 750 g inventory, idle/fast/task rates | PASS; native and deterministic tests | N/A | NOT APPLICABLE: legacy litres, not grams |
| 2 g emergency, exact 0 g failure, frozen movement, reset and normal restoration | PASS, real-time native depletion; command freeze covered by unit tests too | N/A | NOT APPLICABLE: separate legacy model |
| Terrain height / bounds / upward finite normals | PASS; bundled-grid camera height match; 263,169 vertices; sampled normal Y minimum 0.7883; mesh spans ±2,048 m | Existing console terrain presentation preserved | Real grid loaded and rendered; signed slope physics assertions apply to RAW only |
| Route visible, unavailable explicit, recovery | PASS; native route group and unavailable UI, reset restored route | PASS; console plan visible | PASS; existing visible guidance retained |
| Science task start/finish and four official IDs | PASS; stationary 350 W native task + deterministic ID/workload/lifecycle tests | N/A | Four actual animations tested separately below |
| Duplicate loops/canvases/listeners after three RAW↔preview cycles | PASS | PASS | EVA unmounted before repeated base cycles; no post-disposal draws |
| Runtime JS/console errors and online requests | None observed in successful movement run | None observed in successful movement run | None observed in successful movement run |
| Compositor-delivered Escape | PASS | PASS | PASS |
| Four task animations | Separate RAW core-site visual/native task tested; full four-animation unification deferred | N/A | PASS: abrade → PATCH ABRADED, core → SAMPLE STORED, depot → TUBE DEPOSITED, MOXIE → MOXIE RUN COMPLETE |
| Audio | N/A, no RAW audio integration claim | N/A, audio starts on EVA click | PASS: running WebAudio, mute gain 0.000208, unmute 0.89815; audible listening NOT TESTED |

Final direction alignment minima were approximately 1.0 in all three modes (floating-point error <1e-15). In the three same-document remount cycles, RAW consistently had one renderer, one scheduled RAF, two intervals and six tracked input listeners; preview had its two intentional renderers (scene + helmet interior), one RAF, one interval and six tracked listeners. No disposed renderer drew later; no context loss was observed. This is a bounded lifecycle check, not a memory-soak certification.

The native clock observation advanced from 1.8666667 s to 2.45 s in 604.1 ms wall time: 35 complete 1/60 s ticks. The pause check retained the entire authoritative snapshot unchanged for 500 ms, then resume advanced it again. Native terrain height matched the separately loaded bundled height provider plus the unchanged 1.7 m eye height.

The automated core tests cover signed uphill/downhill response, physical mass/weight, NASA-reference conversion dimensions (293 W → 75 g/h), payload response, slope/no-data/boundary rejection, pause/reset, no double-counted science workload, exact terminal partial tick and zero oxygen, frozen post-failure commands, four official task IDs and physics-disabled compatibility. These are deterministic model tests, not native expeditions to every terrain boundary.

Screenshots and numerical evidence are local, ignored build artifacts, not Git additions. Important paths:

- `baseline-movement.json`: all original before/after positions, camera quaternion/Euler, planar oracle and displacements.
- `movement.json`: final numeric probes, lifecycle/resource observations, runtime errors, requested URLs and any interrupted fixed-heading fixtures.
- `movement-raw.png`, `movement-base.png`, `movement-console.png`, `movement-eva.png`: actual native scenes.
- `integration-raw-route.png`, `integration-route-unavailable.png`, `integration-{abrade,core,depot,moxie}-{active,complete}.png`.
- Existing physics harness: `release/evidence/physics-{normal-task,emergency,failed,restored}.png`; smoke screenshots `/tmp/raw-engine-smoke.png`, `/tmp/raw-preview-smoke.png`.
- Corresponding `*-electron.log`, `integration.json`, `system.log` contain startup/graphics/state diagnostics. Evidence should be copied separately if sharing the checkout's results.

## Changed files and reproduction

| File | Reason |
|---|---|
| `src/adapters/input.ts` | Quaternion-based RAW planar movement; vertical-view fallback |
| `src/dev/Preview.tsx` | Minimal Rachel-reviewed unlock/input gating repair |
| `tests/input-orientation.test.mjs` | Deterministic inversion, vertical look and lifecycle regressions |
| `tests/routes.test.mjs` | Actual Three camera fixture for existing input test |
| `tests/gui-runtime.mjs` | Optional native instrumentation, screenshots, real focus-window helper |
| `tests/movement-gui.mjs` | Native 171-probe RAW/base/EVA movement and transition/resource matrix |
| `tests/integration-gui.mjs` | Native RAW route/clock/reset, four preview animations, audio, Escape checks |
| `tests/physics-gui.mjs` | Focus/size its own native child on this compositor; assertions unchanged |
| `docs/integration/POST-MERGE-RUNTIME-QA.md` | This evidence/report |

No exported production API signatures changed. `createDemoInput(camera: PerspectiveCamera, canvas: HTMLCanvasElement, engine: Engine)` still returns `{update(), dispose()}`. The engine dispatch/snapshot/task APIs and physical units are unchanged. No merge conflict occurred; the sole cross-ownership patch is called out above.

Reproduce with an idle interactive desktop; do not move the physical mouse during fixed-heading/held-key checks. Run GUI commands **serially**, as simultaneous apps compete for focus:

```sh
npm run typecheck
npm run build
npm test
npm run smoke
npm run smoke:preview
node tests/physics-gui.mjs
node tests/movement-gui.mjs
node tests/integration-gui.mjs
git diff --check
```

Git preflight executed before changes: `git status -sb`, `git branch -vv`, `git log --graph --oneline --decorate -25`, `git remote -v`, `git worktree list`. The clean combined checkout was branched with `git switch -c fix/post-merge-runtime-qa`. Ownership verification used `git diff --exit-code 9541b48 -- src/core src/terrain src/ui src/map src/app src/adapters/world.ts src/core/contracts.ts package.json package-lock.json electron .github` (0), and `git merge-base --is-ancestor 95a9be7 HEAD` (1, expected: map feature absent).

For ordinary native launch: `npm run build`, then `npm run start:electron`. Default route is RAW Physics; click **Visual preview** for Rachel's base. Click to acquire look controls; WASD, Shift fast, Esc release. In base, approach/click the console, Esc stand, approach the hatch and E launch a valid plan. Preview F starts a nearby objective, M toggles audio. RAW emergency button explicitly selects 2 g initial stock with unchanged 750 g capacity and normal consumption. The native GUI tests launch that same compiled `electron .` host, not a browser-only substitute.

## Architecture gaps, remaining verification and review decision

RAW remains the physics-authoritative experience: one pure engine with grams, the fixed 60 Hz clock and read-only HUD mapping. Preview remains a separate legacy/demo experience: legacy engine position/tasks, independent litres/time/temperature/refill rules, faster demo speeds and visual animation completion driving its own task-finish requests. Its four animations working does **not** mean they are all integrated with RAW's scientific workload/timing. Preview task demos intentionally use existing visual timings; none are NASA-calibrated task durations. Unifying these authorities is deferred, not silently implemented here.

Actual Windows runtime/installer verification is NOT TESTED on this Linux machine. Hosted Xvfb/blocklisted GPU behavior, packaging/installers, physical network-disconnection QA, audible output/listening quality, exhaustive kilometre-scale terrain traversal and long-duration GPU-memory soak are NOT TESTED. Observed local requests are bundled `eva:`/`data:` assets only; Electron sandbox, isolation, web security, CSP and navigation restrictions are unchanged. Short transition counters can detect retained loops/listeners/canvases, but do not prove absence of every driver/GPU allocation leak.

This exact combined code is **ready for Alex's manual review of the two input fixes**, with the minimal preview patch explicitly pending Rachel's review. No remaining reproducible source blocker was observed in the completed local test matrix. This is **not** release certification or permission to promote team main: native Windows verification, owner review, broader platform/installer testing and any claimed scientific unification remain outstanding. Nothing was pushed or merged into either main branch.
