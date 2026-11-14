# RAW v0.1 work report

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
