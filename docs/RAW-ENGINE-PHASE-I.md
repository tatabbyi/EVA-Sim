# RAW Engine Phase I evidence

Base: upstream/main ac2e18819e3462a89798fb88a75e22cfdd28733e.
Branch: feat/raw-engine-v01. No fetch, connector, push or merge performed.

Added Electron 45.3.2 and electron-builder 26.18.0 (exact lockfile pins),
secure native host, offline asset protocol, packaging config, developer launcher,
two-OS artifact workflow and desktop asset test. Replaced only Alex's placeholder.
Protected teammate sources and preview remain unchanged.

Verified: npm run build, npm test, Linux Electron startup and local protocol fetch
(metadata 862 bytes; grid 4,202,500 bytes). Linux AppImage generated at
release/EVA-RAW-0.1.0-linux-x86_64.AppImage. Packaging initially hit sandbox DNS;
rerun with approved network access succeeded. Initial smoke exposed blocked internal
file requests; protocol now reads only normalized files under bundled dist.

NOT VERIFIED: native Windows build, Windows runtime, manual preview interaction,
physically disconnected network run. Windows target and native Windows/Linux
workflow are prepared but no workflow was dispatched (no push authorized).
Phase I is implementation-ready; its two-platform release gate is incomplete.

Commands: npm run dev:electron; npm run build; npm test; npm run dist:linux;
npm run dist:win. Install development runtime with `npx install-electron` after
`npm ci` (Electron 45 separates runtime installation). Linux runtime needs a
working desktop/GPU stack and FUSE 2 for AppImage; alternatively use
`./EVA-RAW-0.1.0-linux-x86_64.AppImage --appimage-extract-and-run`.
No signing configured; Windows installer will be unsigned.

npm audit reports six moderate build-tool advisories through minimatch (glob
amplification denial of service). No high/critical advisories. No forced downgrade
or unrelated dependency upgrades applied. Default Electron icon remains.
