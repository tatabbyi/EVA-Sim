# Physics DEMO v0.1 — agent completion checklist

**Used by Claude Code and Codex.** These boxes are acceptance criteria, NOT a claim that implementation has occurred.

### Preflight and ownership
- [ ] Record actual git branch + HEAD, working-tree state, team/main comparison.
- [ ] Read full physics NASA bibliography, fixed model contract, runbook, Rachel audit and actual source exports.
- [ ] Protected teammate files unchanged: `src/ui/**`, `src/terrain/**`, `src/dev/**`, `src/sim/cost.ts`, `public/**`, `pipeline/**`, `research/**`, teammate route/loader modules.
- [ ] No dangerous Git operation; no push or merge into team main.

### Logic
- [ ] Named Mars scenario and clear NASA-vs-assumption source labels.
- [ ] Pure weight/signed-grade/gait speed/payload/total metabolic power/gas rate calculators.
- [ ] Legacy engine mode preserved; enabled physics mode uses 0.75/1.15 m/s and current `heightAt`, not old 3/8 m/s.
- [ ] Idle, walk, fast and task power charged once per active simulated second, independent of render FPS.
- [ ] No-data terrain/steep step rejected; no fake flat DEM or forced motion along Nanda's visual route.
- [ ] O2 grams, capacity/reserve/critical, accumulated energy, pause/reset, exactly one 0g mission-failed event.
- [ ] During active task, movement locked in physics mode and 350W generic TOTAL workload applied; visuals remain independent.
- [ ] No MOXIE suit O2 refill, no device electrical power charged as astronaut breathing.

### UI and test
- [ ] Existing Electron renderer, HUD and Rachel preview remain operational, no second engine loop.
- [ ] HUD normalized O2 correct; low/critical/fail alerts; real g/h, metabolic W and outside conditions clearly identified.
- [ ] Emergency O2 scenario explicitly labelled and reversible, keeps real 750g capacity.
- [ ] `npm run typecheck`: record exact output.
- [ ] `npm test`: record exact output.
- [ ] `npm run build`: record exact output.
- [ ] GUI smoke if supported; report actual result and limitations, no invented evidence.
- [ ] Tests cover NASA 293W/75g/h, +/-slope, mass/weight, pause/idle, group-step consistency, failure/reset, backward compatibility.
- [ ] Write `docs/physics/IMPLEMENTATION-REPORT.md` with file diff, evidence, science caveats and launch commands.
- [ ] Final branch diff protected file audit and clear PR handoff. Keep root agent instructions branch-local unless team approves.
