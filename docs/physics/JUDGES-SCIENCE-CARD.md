# Sharkies — scientific credibility card for NASA Space Apps judges

**What Sharkies demonstrates (after physics code is actually implemented and validated):**
> A self-contained Mars surface EVA simulator, using a real-terrain-compatible coordinate system and a deterministic, unit-aware engineering model of suited motion, terrain-dependent metabolic workload and oxygen consumption. One preselected landing site for the demo; future landing sites will be automatically chosen from verifiable offline data coverage.

### Three science pillars and clear limits
1. **Mars environment and terrain:** Reference gravity ~3.7 m/s² from NASA Glenn [N06], real orbital elevation datasets via NASA PDS MOLA [N07], potential high-detail HiRISE DTM and NASA Jezero hazard context [N09]. Our existing Jezero 4m asset is **not yet independently traced** to a specific PDS source file; exact dataset provenance is pending Victor's manifest.
2. **Human performance:** NASA BVAD **2018**, Table 4-76: **293W metabolic workload ↔ 75g O2/h** at RQ 0.9 [N01], plus NASA suited biomechanical studies [N04] and new NASA Mars suit-mass preliminary research **July 2026** [N02]. We use a **simplified linear engineering extension**, not an empirical measurement of Martian humans.
3. **Realistic constraints and decisions:** User-controlled suited speed, signed-uphill/downhill effort, oxygen rate/state, and failure upon depleted **modeled** O2. These mechanics illustrate why the pilot must balance science tasks and resources. O2 0g as mission failure is **our game rule**, not a claim of instant medical death.

### Science sources with persistent direct links
- NASA NASA/TP-2015-218570/REV1 (2018), https://ntrs.nasa.gov/citations/20180001338
- NASA **Mars Spacesuit Mass Requirements** (2026), https://ntrs.nasa.gov/citations/20260003038
- NASA JSC Traverse/Metabolic Workload (2025), https://ntrs.nasa.gov/citations/20250006519
- NASA PDS **MOLA topography**, updated to PDS4 2026-08-25, https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- NASA PDS **MEDA calibrated/derived Jezero weather**: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html
- Detailed bibliography: **[NASA-DATA-AND-PRIMARY-SOURCES.md](NASA-DATA-AND-PRIMARY-SOURCES.md)**.

### What to show live (do not claim completion before it works)
1. In the current fixed Jezero scene, move on flat vs uphill terrain: HUD or scientific debug overlay shows velocity, grade, workload.
2. Watch current oxygen **g/h** and displayed 0–100% bar adapt to load/activity. Metabolic oxygen stays independent of renderer FPS.
3. Trigger a clearly labelled **O2 EMERGENCY TEST** with 2g remaining and demonstrate game-over exactly at 0g, one event, reset.
4. Start/finish ONE existing Rachel science task; show task power charged once. MOXIE remains science and does not refill suit O2.
5. If a top-down map has subsequently been integrated, show it **only for the preselected fixed region**; don't claim full-planet procedural access.

### Claim controls
- **NASA-provided:** reports, published analog data and available PDS science data (with citations).
- **Our derived model:** unit conversion and algebra based on a published NASA analog pair.
- **Team scenario:** 65kg suit, 750g O2, 165/430/350W, 0.75/1.15m/s, ±25deg gate, -60C/635Pa fixed environment.
- **Not claimed:** Mars human EVA experimental validation; an actual NASA hardware inventory; quantitative survival percentages; recorded Jezero real-time atmospheric readings; unverified NASA lineage for processed height grids.

### One-line answer to "What NASA data did you use?"
"We grounded the oxygen reference in NASA's Life Support Baseline Values (Table 4-76), evaluated movement constraints against NASA EVA/partial-gravity research, and structured the terrain against NASA's Mars PDS elevation sources; the selected suit profile and today's fixed-site settings are explicitly labelled engineering assumptions."

**Important:** do not describe the code as implemented until Codex's tests, Electron behavior and an actual PR confirm it. Document verified: 2026-11-14.
