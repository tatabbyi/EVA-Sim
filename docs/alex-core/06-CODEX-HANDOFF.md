# Codex handoff blueprint — NOT ready to execute

Final objective: reviewer-friendly, ordered implementation prompt series **based only on accepted project blocks and decisions**. Keep scoped stages, one atomic change per step, with review gates and source references.

## Confirmed delivery constraints (2026-11-14)
- Build for **Electron only**; explicitly target **Windows, Linux, macOS**. No browser app should be introduced as an unrequested feature.
- App **must run entirely offline** (no essential runtime CDN, NASA API, Mars Trek tile fetch, hosted backend, external font or remote asset).
- **Alex** owns formula implementation, route solver/logic and Leash; **Victor** provides improved 3D mesh/geometry (unknown format). Require a written, agreed geometry/coordinate/data contract before consuming Victor's deliverables.
- Protect Rachel's shader/HUD/beacon/palette from unsolicited edits; ask for approval if modifications are necessary.
- Existing `src/` is Vite/React skeleton; treat migration to Electron as a scoped change, not as proof that any rendering problem has been solved.
- Cross-platform packaging, asset distribution, security architecture and performance acceptance tests still need specific decisions.
- **Performance expectation:** do NOT claim Electron is unlimited or automatically lag-free; include reproducible profiling benchmarks after requirements are specified.
- Source references: `04-DECISIONS.md` D-004–D-008 and `03-OPEN-QUESTIONS.md` Q01–Q07.

## Suggested prompt pipeline (subject to scope blocks)
1. **Repository read-only inventory and gap analysis**: inspect exact tree, preserve contributors' files, map planned APIs to stubs; no modifications.
2. **Electron foundation**: decide platform(s), main/preload/renderer boundary, start/build scripts, secure asset/data access, dev/prod mode.
3. **Data contracts and validations**: validate meta/CRS/grids/tile formats, fixtures, missing/corrupt/NaN/Infinity handling.
4. **Real terrain rendering**: connect Victor's data outputs to Three.js material/loader/camera and verify coordinate alignment.
5. **Domain algorithms**: deterministic walking/O2/route evaluation with research reference tests; isolate from rendering.
6. **Leash/route overlay**: integrate precomputed directional home-cost grid, reserve semantics, and live state.
7. **Survival Odds**: seeded Monte Carlo worker; scenario-configured distributions; validation and edge-case tests.
8. **Houston/time**: date-dependent Mars time/light delay, visual timeline, same clock as sun shading.
9. **Modes/training/game**: based on actual user scope blocks, checkpoints, task budgets and outcome criteria.
10. **Polish/reliability/release**: HUD, overlays, failed-data states, performance, Electron packaging, accessible demo (if required), testing.
11. **Integration/presentation**: source credits, AI disclosure, demonstrable test cases and handoff docs.

**These are possible stages, not a promise of implementation.** Reorder after blocks and dependency graph are known.

## Each final Codex prompt must specify
- Prompt ID and prerequisites
- Objective and explicit non-goals
- Read these exact files first
- Allowed paths to edit; files to preserve
- Data contract (types, units, coordinate frame)
- Observable acceptance criteria (numerical anchors, user flow and UI if relevant)
- Tests, command(s) to run, errors that must be handled
- No undocumented scientific tweaks; ask or flag if a contract is inconsistent
- Do not rewrite colleagues' work without approval
- Require a concise diff summary, test report, limitations, unresolved questions, and commit suggestion
- Do not automatically merge into upstream repo

## Codex review checklist
- Confirm source baseline/branch before coding.
- Confirm modified paths limited to scope.
- Unit tests for formulas and coordinate transforms.
- Integration tests for missing real data and invalid bytes.
- Inspect security boundary if Electron API exposed.
- Electron rendering smoke test on target OSes; offline launch smoke test.
- Verify scientific claims remain labelled as assumptions where appropriate.
- Review diff manually before merging.
