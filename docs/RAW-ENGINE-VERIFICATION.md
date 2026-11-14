# RAW v0.1 work report

## Latest independent CI evidence (2026-11-14; supersedes historical results below)

- **Windows x64 — PASS:** GitHub Actions [run 43611705331](https://github.com/mokachkasss/Sharkies/actions/runs/43611705331), head `80af8c9`: native Windows build, 17 automated tests, unsigned NSIS installer, source Electron GUI smoke and packaged `win-unpacked` GUI smoke. The native input diagnostics confirm trusted W/Shift events, advancing simulation clock and movement.
- **Linux x64 — PARTIAL:** the same run built and uploaded the AppImage and passed 17 tests. Both hosted Linux GUI smokes FAILED because WebGL2 was blocklisted in the runner; do **not** describe the CI job as passed. Codex separately reported local Linux/AppImage GUI smoke passing.
- **Unverified:** manual Windows installation, physically disconnected offline run on either OS, and full team ML/terrain integration. No teammate source files were changed in the reviewed diff.
- This is a **documentation-only team PR** layered over the tested engine code. The report sections below retain their original dated snapshots, including earlier statements such as "Windows NOT TESTED" and "no CI links"; those statements described earlier pre-push phases and are **no longer the current status**.

The opening results and hashes record the historical Phase II baseline. Current
review-fix results are appended under Review Fix 01 below.

Branch: `feat/raw-engine-v01`.
Base: `ac2e18819e3462a89798fb88a75e22cfdd28733e` (matched local upstream/main at preflight).
Phase I: `656135e`.
Phase II: use `git log -1 --format=%H --grep='phase II'` (this report is part of that commit).

No fetch, GitHub connector, push, merge or CI dispatch performed.
Owner-protected source, data and pipeline files have zero diff from the base.
Exact file list, contracts, dependencies and manual review steps are in
[RAW-ENGINE-V01.md](RAW-ENGINE-V01.md).

| Check | Result | Evidence / limits |
|---|---|---|
| `npm ci` | PASS, Linux | Node 26.12.1, npm 12.2.1; Electron postinstall succeeds |
| `npm run typecheck` | PASS | Strict checks retained |
| `npm run build` | PASS | Vite warning: 924.74 kB renderer chunk |
| `npm test` | PASS | Two suites; eight domain/adapter cases plus bundled asset test |
| `node tests/core.test.mjs` | PASS | Expanded eight-case output in release/evidence/core-tests.log |
| `npm run dev:electron -- --smoke` | PASS, Linux | Vite native scene, pause/reset, pointer lock, WASD/Shift |
| `electron . --smoke` | PASS, Linux | Real scene, local grid, domain labels and controls |
| `electron . --smoke --smoke-missing` | PASS, Linux | Visible HTTP 404 terrain-load error |
| `electron . --smoke --smoke-preview` | PASS, Linux | Unmodified preview canvas and local grid |
| `npm run dist:linux` | PASS, native Linux x64 | AppImage generated; final retry succeeded after one signal-143 interruption |
| AppImage `--appimage-extract-and-run --smoke` | PASS, Linux | Packaged scene, local grid, pointer lock, WASD/Shift, pause/reset; exit 0 |
| Packaged missing-data smoke | PASS, Linux | Visible error, exit 0 |
| `npm run dist:win` | PASS, Linux cross-build | Offline unsigned NSIS; does not count as Windows execution |
| Native Windows build/runtime | NOT TESTED | No native Windows environment or CI run available |
| Physically disconnected offline run | NOT TESTED | External requests are blocked by host policy; local protocol assets were exercised |
| Full manual boundary traversal | NOT TESTED | Containment, movement hard stop and warning covered by domain tests |
| `git diff --check` | PASS | Protected ownership diff also empty |

The final arrow screenshot was visually checked: yellow route chevrons are visible
along the terrain toward the task marker. During integration the route component
needed its documented player-progress input; that was connected before final
packaging. Earlier desktop smoke caught an internal file-request restriction;
the protocol was corrected and reverified. Neither failure was hidden.

Screenshots: `release/evidence/raw-engine-smoke.png`, `raw-preview-smoke.png`,
`raw-missing-smoke.png`. Test logs live under `release/evidence/` (ignored outputs).
CI workflow is prepared for native Windows/Linux build and packaged smoke; there
are no CI artifact links because no push or dispatch was authorized.

Release blocker: native Windows build/runtime evidence is still missing. The
implementation and cross-built installer do not satisfy that native release gate.
Windows command: `npm ci && npm run build && npm test && npm run smoke && npm run dist:win`.
Then install the unsigned EXE and inspect it offline. On Linux, inspect the
AppImage manually with networking disconnected using the steps in the integration
document. Both phases remain short of the full two-platform release acceptance.

Six moderate build-tool npm advisories remain (minimatch glob amplification);
no high/critical findings were reported. No forced dependency downgrades were used.
Default Electron icon; no code signing. No fabricated resource or NASA calibration
claims. Physics, ML, masses, real science interactions and macOS remain deferred.

## Artifacts and SHA-256

The final filenames and hashes below identify local artifacts, not published releases.

```text
70aa8d8112703958d81a57c6dd8ac6cccb69e5a62e365c9c4d209dbee5c4d027  release/EVA-RAW-0.1.0-linux-x86_64.AppImage
22b5ca5614d86f9212dd2613e158f15a5b654afa240e13bd8d54ca63a207ede6  release/EVA-RAW-0.1.0-win-x64.exe
```

## Review Fix 01 — Commit A

Verified against parent `86cd344` on 2026-11-14. The feature-branch push trigger
is limited to `feat/raw-engine-v01`; native Linux/Windows jobs and artifact-only
uploads remain. YAML parsed locally; Actions execution awaits the user's push.
Existing electron-builder output confirms `linux-unpacked/eva-sim` and
`win-unpacked/EVA RAW.exe` are the actual unpacked executable paths.

`npm ci`, build, preview-readiness regression and occupied-port regression pass.
Linux RAW, actual preview (including terrain-ready badge), missing-grid, and dev
GUI smokes pass. An initial concurrent dev smoke lost pointer lock to another
smoke window; running GUI checks serially resolves this. Sandbox GUI/listen
restrictions require these checks to run outside the filesystem sandbox.
Screenshots are generated at `/tmp/raw-{engine,preview,missing}-smoke.png`.
No native Windows or physically disconnected offline verification was performed.
Run `npm run build` before `npm test`: the desktop asset test consumes `dist/`.

## Review Fix 01 — Commit B and final verification

Local implementation on `feat/raw-engine-v01`, based on reviewed `86cd344`.
Commit A: `2cd18ab36cea79c09f7753773049c541a4681cd1`.
Commit B: resolve with `git log -1 --format=%H --grep='harden route contract'`;
this report is included in that commit. No fetch/push/merge/PR/connector was used.

The versioned route/provider API, compatibility limits, before/after examples,
objective order/tolerance, conservative smoothed geometry/arrow coverage and
whole-scene no-data rejection are documented in [RAW-ENGINE-V01.md](RAW-ENGINE-V01.md#review-fix-01-app-owned-integration-boundary).
These exports are app-owned proposals reconciled with the local integration
drafts; teammate approval and future mesh/planner integration remain separate.

| Final check (2026-11-14, Linux x64) | Result |
|---|---|
| `npm ci` | PASS, unchanged lockfile; Electron postinstall succeeds |
| `npm run typecheck`, `npm run build` | PASS; Vite renderer chunk warning, 929.19 kB |
| `npm test` | PASS, 17 cases; all original 8 core/adapter cases retained |
| Scoped workflow YAML/native OS matrix/permissions | PASS, local parse/assertions; no Actions run initiated |
| Occupied port 5173 | PASS; launcher exits 1 with port-in-use diagnostic before Electron launch |
| `npm run smoke` | PASS; native GUI, terrain, pause/reset, pointer lock, WASD/Shift |
| `npm run smoke:preview` | PASS; actual preview root/canvas, no RAW root, 4 m terrain-ready badge |
| `npm run smoke:missing` | PASS; visible 404 terrain error |
| `npm run dev:electron -- --smoke` | PASS, serial run |
| `npm run dist:linux` | PASS, native Linux AppImage build |
| `release/linux-unpacked/eva-sim --smoke` | PASS on isolated retry; first attempt failed pointer lock |
| AppImage `--appimage-extract-and-run --smoke` | PASS; actual packaged Linux GUI and local assets |
| Packaged missing-grid smoke | PASS; recoverable visible load error |
| `npm run dist:win` | PASS, Linux cross-build of unsigned NSIS EXE only |
| Native Windows build/GUI/install | NOT TESTED; release acceptance remains blocked pending user push/Windows CI and manual install |
| Physically disconnected offline run | NOT TESTED; local protocol assets exercised, no disconnected-network claim |
| Full manual boundary traversal | NOT TESTED; containment/border cases covered by automated tests |
| `git diff --check`, protected source diff against `ac2e188` | PASS; protected source diff empty |

Route regressions include wrong region/frame/revision; revision changes from both
grid bytes and coordinate transform; missing/reordered objectives and wrong shuttle;
nonfinite/duplicate points; no-data between valid endpoints; smoothing into a gap
clear of straight waypoint segments; border/arrow excursion; repeated invalid
updates and runtime rendering failure; valid replacement/recovery, snapshot
immutability, semantic route/reset/task events and unsubscribe. Actual input adapter
is tested for repeated intent suppression, changed yaw/run and reset/disposal.

The deterministic 10,000-point test performs 1,200 fixed steps/visual ticks with
zero JSON serializations, shared route identity, one initial validation/build and
one build on replacement. Final captured loop time was 7.20 ms **with a stub visual**;
this is allocation/rebuild instrumentation, not Three.js/GPU timing or a promised
frame rate. Rachel's existing visual animation cost is unchanged.

Local ignored evidence (not committed):

- `release/evidence/review-fix-01-build.log`, `review-fix-01-tests.log`
- `release/evidence/review-fix-01-smoke.log`, `review-fix-01-preview.log`,
  `review-fix-01-missing.log`, `review-fix-01-dev-smoke.log`
- `release/evidence/review-fix-01-linux-build.log`, `review-fix-01-win-cross-build.log`
- `release/evidence/review-fix-01-unpacked-smoke.log` (first pointer-lock failure),
  `review-fix-01-unpacked-smoke-retry.log` (PASS),
  `review-fix-01-appimage-smoke.log`, `review-fix-01-packaged-missing.log`
- `release/evidence/raw-engine-smoke.png`, `raw-preview-smoke.png`, `raw-missing-smoke.png`;
  current screenshots are also produced at `/tmp/` by the smoke runner. The RAW
  image was inspected: terrain, yellow chevrons, objective marker and HUD visible.

Initial sandbox GUI/listen operations were denied; reruns outside that sandbox
passed. A final sandboxed packaging attempt hit DNS failure while obtaining a build
tool and was stopped; the outside-sandbox build then succeeded. An initial dev
smoke run alongside another GUI smoke lost pointer lock; serial verification passed.
The isolated packaged smoke retry also passed after an initial pointer-lock failure.
These failures show GUI focus sensitivity; native CI result logs after the user's
push must be inspected, not inferred from this local result.

Final local artifact SHA-256 (supersedes historical Phase II hashes above):

```text
412f3a4e119a175b24ebf07dfa3aca545aef9873d069e39c7ebfb6bd982e0d21  release/EVA-RAW-0.1.0-linux-x86_64.AppImage
26751636fa7123862cd11d486896efc5d6648ff829f7e4c8306ad8764c1be480  release/EVA-RAW-0.1.0-win-x64.exe
```

Exact review-fix file list:

| Commit | Files |
|---|---|
| A | `.github/workflows/raw-desktop.yml`, `electron/smoke.cjs`, `electron/smoke-readiness.cjs`, `scripts/dev-electron.mjs`, `tests/smoke.test.mjs`, `docs/RAW-ENGINE-VERIFICATION.md` |
| B | `src/core/contracts.ts`, `src/core/engine.ts`, `src/adapters/input.ts`, `src/adapters/routes.ts`, `src/adapters/scene.ts`, `src/adapters/world.ts`, `src/app/App.tsx`, `tests/core.test.mjs`, `tests/routes.test.mjs`, `docs/RAW-ENGINE-V01.md`, `docs/RAW-ENGINE-VERIFICATION.md` |

No installers, logs, screenshots, release outputs, team assets or teammate source
are committed. No new dependency changes. Prior build-tool advisory notices,
unsigned/default-icon packaging and Vite bundle warning remain outside this fix.
Unknown HUD resources are now explicitly NOT SIMULATED in the app overlay, and
nearest interaction filters out finished/failed tasks; core task-count/type policy
remains deliberately flexible. Partial terrain meshes remain deferred. The source
fix does not satisfy the outstanding native Windows or human offline release gates.

## Fast Track CI follow-up — integration blocked by visible ref (2026-11-14)

This round started at `2f96c693e1788e8c7bc97c04e39d3cc0883ed8ad` in the only
visible worktree, `/home/moka/Projects/Sharkies`, on `feat/raw-engine-v01`.
There was no pending merge or conflict. After the user's manual-fetch notice,
direct checks of `HEAD` and `refs/remotes/upstream/main` in that exact directory
still returned:

```text
HEAD:          2f96c693e1788e8c7bc97c04e39d3cc0883ed8ad
upstream/main: ac2e18819e3462a89798fb88a75e22cfdd28733e
upstream URL:  git@github.com:tatabbyi/Sharkies.git
```

`git log HEAD..upstream/main` was empty. A read outside the filesystem sandbox
confirmed the same SHA/worktree. Per the user's explicit instruction, integration
was stopped: **no merge was started/completed** and this is **not evidence that
latest team main is integrated**. Existing backup branch
`backup/raw-before-rachel-merge-20261114` already points at `2f96c69`; no new backup
or merge commit was created against the stale visible ref. No fetch, reset,
rebase, push, PR, remote-main update or Actions rerun was performed.

### CI findings and focused changes

Read the actual Linux/Windows jobs from
[run 43610325010](https://github.com/mokachkasss/Sharkies/actions/runs/43610325010):
Linux job `132493784693` aborted because its Chromium helper was not root-owned
mode 4755. Windows job `132493784951` passed build and all 17 tests, then failed
`WASD movement failed`; packaging/artifact upload was skipped on both OSes.
The old Windows log has no key/focus/timer diagnostics, so its precise input
failure cause cannot be established from that log alone.

Changes in `.github/workflows/raw-desktop.yml`:

- Build and upload distributions after unit tests and **before GUI smoke**.
  Upload uses explicit package-success/noncancelled conditions. Native source
  and unpacked GUI failures still fail the job; no continue-on-error is used.
- Configure **both** source and unpacked Linux `chrome-sandbox` binaries using
  `sudo chown root:root`, `sudo chmod 4755`, then assert ownership/mode.
  Application `sandbox:true`, isolation, Node restrictions and host request policy
  remain intact; there is no `--no-sandbox` or system-wide security disable.
  This is CI runner setup, not a claimed local execution of that sudo step or
  verification of installed AppImage sandbox behavior on every Linux host.
- Retain both native runners and limited feature-branch push trigger. Unpacked
  smokes can run after source-smoke failure, preserving the failure result.
  Upload success/failure screenshots from runner temp and bound GUI/job duration.

Changes in `electron/smoke.cjs`:

- Show/focus native window **and** web contents, wait for native/document focus,
  then acquire actual canvas pointer lock and verify the app is unpaused.
- Deliver Shift first with explicit left/shift modifiers, then native W with Shift.
  Observe Chromium-delivered key/code/modifier/isTrusted values; do not inject
  DOM KeyboardEvents or call engine movement commands to make the smoke pass.
  The supported native injection API is documented in
  [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents#contentssendinputeventinputevent).
- Replace a fixed 400 ms hold/150 ms HUD wait with a bounded 5 s poll while keys
  are held. Require both trusted keys, live focus/lock, unpaused state, advancing
  simulation clock, run mode and **at least 1 m numeric XZ displacement**.
  Release keys in finally. Emit platform/before/after/key diagnostics and capture
  failure screenshots. Screenshot directory is RUNNER_TEMP in CI, tmpdir locally.
- Windows focus/delivery/timing changes require the next native CI run to confirm;
  this round does not claim a proven Windows runtime fix.

### Actual integration APIs

No files under `src/` changed in this round. Existing signatures remain:

```ts
createEngine(region: Region, mission: Mission,
  canOccupy?: (p: XZ) => boolean, speeds?: DemoMovement): Engine;
mountScene(host: HTMLDivElement, engine: Engine, heights: HeightProvider,
  reportRoute?: (reason: string | null) => void): {
    input: ReturnType<typeof createDemoInput>; dispose(): void;
  };
applyRouteCandidate(engine: Engine, terrain: HeightProvider, route: Route): {
  ok: boolean; reason?: string;
};
```

`HeightProvider`/`RouteContextV1` retain their region/frame/terrain-revision and
coverage/provenance contracts described above. Rachel's preview/visual APIs,
Victor's terrain and Nanda's code are untouched. New upstream signatures cannot
be reconciled until the intended fresh ref/content is visible.

### Minimal verification and ownership

- `npm run typecheck`: PASS.
- `npm run build`: PASS; existing Vite 929.19 kB chunk warning remains.
- `npm test`: PASS, all 17 existing cases.
- **One** `npm run smoke`: PASS on Linux. Native trusted ShiftLeft/KeyW received;
  displayed XZ moved `(12,12)` → `(12.8,10.9)` while clock advanced `0.1` → `0.3 s`,
  run mode/focus/pointer lock remained true. Screenshot `/tmp/raw-engine-smoke.png`.
- Workflow YAML/ordering/conditions and JS syntax checked; `git diff --check` PASS.
  `git diff 2f96c69 -- src` and the protected-folder diff are empty. No protected
  file conflicts or edits. CI sudo configuration itself awaits the hosted runner.
- No local preview, missing-grid or packaging smoke loops. No Linux packaging or
  Windows cross-build in this round. Native two-OS validation awaits Alex's push.

Exact changed files for this round: `.github/workflows/raw-desktop.yml`,
`electron/smoke.cjs`, `docs/RAW-ENGINE-VERIFICATION.md`. Local commits separate the
workflow/sandbox/artifact fix from the native input smoke and this report.
No artifacts or evidence binaries are committed.

Remaining blockers: intended fresh upstream content is not visible here;
native Windows GUI and revised Linux CI sandbox/artifact behavior must pass CI.
Manual install/disconnected offline verification remains separate. No new physics,
ML, terrain catalogs or animations were implemented.
