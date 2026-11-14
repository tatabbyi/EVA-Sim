# Sharkies: EVA Sim

NASA Space Apps 2026, Interplanetary Survival Guide: Martian Map. Plan and rehearse a Mars spacewalk at Jezero Crater on real NASA terrain.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build
```

Data pipeline (Python): see `pipeline/README.md`.

## Layout

| Folder | What | Owner |
|---|---|---|
| `src/app` | App shell, modes | Alex |
| `src/map` | Plan mode map | Alex, Nanda |
| `src/terrain` | Terrain loader (Victor), terrain material and beacon (Rachel) | Victor, Rachel |
| `src/ui` | Palette, helmet HUD | Rachel |
| `src/walk`, `src/xr` | Walk camera, WebXR | Nanda |
| `src/sim` | Cost model (Nanda), Survival Odds (Alex) | Nanda, Alex |
| `src/houston` | Mars time, light delay | Alex |
| `src/shared` | Shared contracts: coordinates, meta.json, grids | everyone |
| `public/` | Static data files built by `pipeline/` | Victor, Nanda |
| `pipeline/` | Python, run once | Victor, Nanda |
| `docs/` | Style, sources, submission draft | Rachel, Aadila |
| `research/` | Overnight research notes 00 to 13 | |

Plan and contracts: `TEAM-PLAN.md`.

## AI use

Parts of this project were written with AI assistance (Claude). Files are marked with a header comment, as Space Apps requires.

## Licence

GPL-3.0. NASA data credits are listed in `docs/sources.md`.

## RAW desktop v0.1

`npm ci` then `npm run dev:electron` starts the real app. `npm run dist:linux`
builds an offline AppImage; `npm run dist:win` builds an unsigned NSIS installer.
See [RAW engine contracts and verification](docs/RAW-ENGINE-V01.md) for controls,
team integration examples, native Windows verification gaps and test commands.
RAW implementation used AI assistance (Codex); new source files are marked.
