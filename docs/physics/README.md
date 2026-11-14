# Sharkies Physics — scientific and implementation documentation

**Status:** Approved demo requirements, evidence-reviewed model proposal; **not yet a verified implementation**. **Last evidence review:** 2026-11-14. **Owner:** Alex; visuals: Rachel; terrain: Victor; route costing: Nanda.

## Read these files in this order

| File | Purpose |
| --- | --- |
| **[NASA-DATA-AND-PRIMARY-SOURCES.md](NASA-DATA-AND-PRIMARY-SOURCES.md)** | **Dedicated NASA bibliography and NASA PDS data catalogue, with dates, traceability, evidence limitations and real data vs scenario assumptions** |
| [01-PROVENANCE-AND-DEMO-PARAMETERS.md](01-PROVENANCE-AND-DEMO-PARAMETERS.md) | Single source for agreed choices, scenario coefficients and their labels |
| [02-MARS-ENVIRONMENT-AND-TERRAIN.md](02-MARS-ENVIRONMENT-AND-TERRAIN.md) | Gravity, ambient atmosphere, surface heights and terrain limits |
| [03-EVA-LOCOMOTION-METABOLISM.md](03-EVA-LOCOMOTION-METABOLISM.md) | Suited motion, signed grade, mechanical mass, metabolic power |
| [04-LIFE-SUPPORT-AND-FAILURE.md](04-LIFE-SUPPORT-AND-FAILURE.md) | Oxygen accounting in grams, HUD and oxygen-depletion failure |
| [05-EQUIPMENT-TASKS-AND-MISSION.md](05-EQUIPMENT-TASKS-AND-MISSION.md) | Task workload, inventory, mission lifecycle, NO MOXIE suit refilling |
| [06-RACHEL-RESEARCH-AND-INDEPENDENT-AUDIT.md](06-RACHEL-RESEARCH-AND-INDEPENDENT-AUDIT.md) | Rachel's original research and critical compatibility review |
| [07-ENGINE-INTEGRATION.md](07-ENGINE-INTEGRATION.md) | Actual RAW v0.1 exports, owner boundaries and Codex implementation |
| [08-TESTS-VALIDATION-AND-REPRODUCIBILITY.md](08-TESTS-VALIDATION-AND-REPRODUCIBILITY.md) | Numerical acceptance tests, unit/physics verification and science claims |
| [09-OPEN-QUESTIONS-AND-ROADMAP.md](09-OPEN-QUESTIONS-AND-ROADMAP.md) | All deferred physical models and unresolved calibration choices |
| [ARCHIVED-SOURCE-MAP.md](ARCHIVED-SOURCE-MAP.md) | Exact original research/docs and retained historical audit trail |
| [JUDGES-SCIENCE-CARD.md](JUDGES-SCIENCE-CARD.md) | Responsible, concise competition presentation narrative |

### Implementation handoff documents already in this branch
- [PHYSICS-DEMO-V01.md](PHYSICS-DEMO-V01.md): frozen demo model contract, including engineering defaults. If it differs from newer NASA evidence, **preserve the approved behavior** but explicitly disclose the issue and seek model-parameter approval; never silently relabel a scenario value as NASA data.
- [CODEX-PHYSICS-DEMO-V01.md](CODEX-PHYSICS-DEMO-V01.md): code implementation instructions and protected-owner files.

## Scope / current status
- Product sequence: Capsule Setup -> Surface EVA -> Return Home. **Landing is NOT chosen by the player**. Demo uses a predetermined Jezero-compatible site; future release chooses a random supported site automatically.
- Physics demo: suit-constrained walking/fast motion, signed terrain slopes, a single astronaut/profile, load, metabolic work, oxygen consumption as **grams** and failed mission at exactly zero O2. No live weather, suit heat-flow solver, probabilistic survival, arbitrary Mars landing, or NASA-validated suit gait claim.
- Current inspected code baseline: fork main `c38c5e772388102a9c0571288c2b7210f3c91c97`. Existing RAW physics is still missing; these files document and hand off a new implementation.
- Physical parameters and presentation MUST distinguish [NASA empirical/reference], [derived math], [Rachel composite research], [Sharkies engineering scenario], [future/unmodeled].
- Scientific *reproducibility* means referencing exact NASA paper/table/product, units, dataset processing and code commit; a bibliography alone does not prove the shipped `height_4m.bin` was sourced from a particular PDS product.

## Ownership and document integrity
- Alex owns `src/core/**`, app integrations and `src/adapters/hud.ts`.
- Rachel owns `src/ui/**`, `src/terrain/**`, `src/dev/**`. Never overwrite these without her approval.
- Nanda owns `src/sim/cost.ts` and route-costing; Victor owns source grids, tiles and pipeline.
- The original Rachel research under `research/**`, all original archive files, the team main and current terrain are **not rewritten** by these documents. Interpretations and corrections are in the audit section rather than retroactive edits.
