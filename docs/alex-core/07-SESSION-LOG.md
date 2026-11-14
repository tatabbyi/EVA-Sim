# Session log (append-only)

## 2026-11-14 — persistent specification workflow initialized

### User request
- Treat Alex as responsible for Electron software core, logic and rendering Victor's improved model; Victor handles the model.
- Ask all foundational project questions on logic/formulas/physics now.
- Next receive implementation responsibility as separate blocks, clarify where needed, preserve in durable files.
- End result: full documentation of Alex's implementation + sequential Codex prompts for reviewed code generation.
- Maximize reliable retention in files, not assumed chat memory.

### Source inventory examined in previous read
- Private fork `mokachkasss/Sharkies` main commit `4e3521e3e176baebec3b26e5fc2b66a0adeae573`.
- `TEAM-PLAN.md`, `README.md`, `research/00`–`research/13`, `docs/sources.md`, `docs/submission.md`.
- Application/source: `src/app/App.tsx`, `src/shared/*`, `src/sim/cost.ts`, `src/houston/time.ts`, `src/terrain/{loader,material,beacon}.ts`, `src/ui/{HelmetHud.tsx,HelmetHud.css,palette.ts}`.
- Settings: `package.json`, `tsconfig.json`, `vite.config.ts`, `pipeline/environment.yml`, `public/data/meta.json`.

### Evidence-backed status
- Prior architecture Vite+React+TS web app; not yet Electron.
- Domain and terrain loaders have `throw new Error('not implemented')` stubs.
- Actual DTM grids and terrain tile assets missing in inspected baseline.
- Rachel visual shader, HUD, beacon and palette are written, not yet wired into a functioning Plan/Walk app.
- Scientific assumptions in research are proposals; several key values (reserve, terrain factor, 25° limits, 390L O2) need agreement.

### Artifacts created
- `docs/alex-core/README.md`
- `docs/alex-core/01-PROJECT-CONTEXT.md`
- `docs/alex-core/02-SCIENCE-AND-CONTRACTS.md`
- `docs/alex-core/03-OPEN-QUESTIONS.md`
- `docs/alex-core/04-DECISIONS.md`
- `docs/alex-core/05-BLOCK-REGISTER.md`
- `docs/alex-core/06-CODEX-HANDOFF.md`
- `docs/alex-core/07-SESSION-LOG.md`

### Still open
All Q01–Q36 are pending. Respond using IDs; questions that don't concern Alex may be assigned to teammates. Do not treat sample defaults as user confirmation.

### Next
Collect user answers, update decision register and open-questions statuses, then process their implementation blocks.

## 2026-11-14 — answers Q01–Q07 recorded (architecture and responsibility)
**User answers (verbatim content preserved by meaning):**
- Q01: "Только Electron".
- Q02: "Windows + Linux + macOS".
- Q03: "Полный офлайн".
- Q04: "3D mesh / геометрию" — Victor's model deliverable.
- Q05: "Я" — Alex owns O₂ physics/calculation and route/Leash tasks asked in Q05.
- Q06: "Нужно согласовать" — OPEN; finalize with Victor before changing shared spatial/data formats.
- Q07: "Только после согласования" — changes to Rachel-owned visuals must be approved.

**User's reason for Electron:** "Electron - основа. Я решился на уход от веба по тому что в электроне нет ограничения веб ресурсов как это есть в браузере, мы не сжаты по ним, ничего не будет лагать".

**Record interpretation (not a user claim):** Electron allows greater desktop integration and local file access, but is Chromium-based and still constrained by GPU/WebGL, memory and CPU; lag-free performance must be measured, not assumed.

**Documentation changes:** confirmed D-004 (Electron-only cross-platform), D-005 (offline), D-006 (Victor mesh), D-007 (Alex formula/routing/Leash), D-008 (Rachel coordination). Pending Q06. Updated `README.md`, `01-PROJECT-CONTEXT.md`, `02-SCIENCE-AND-CONTRACTS.md`, `03-OPEN-QUESTIONS.md`, `04-DECISIONS.md`, `06-CODEX-HANDOFF.md` and this log. Other Q08–Q36 unresolved.

**Next:** User provides next group of science/physics or simulator answers and later feature blocks. No application code changed in this session.
