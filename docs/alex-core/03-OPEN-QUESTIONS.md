# Open questions — ask now, answer by ID

**State (updated 2026-11-14): Q01–Q05 and Q07 answered and confirmed; Q06 remains OPEN pending team/Victor agreement. Q08–Q36 are still unanswered. Resolved questions are intentionally retained here for traceability. Decisions D-004–D-008 in `04-DECISIONS.md` govern. The user may answer `Q01: ...`, `Q02: unknown`. If the question belongs to a teammate, mark owner/consultant. After answer, set status and add a dated decision in `04-DECISIONS.md`. P0=blocks architecture/meaning, P1=important scientific/feature choice, P2=polish/stretch.

## Ownership, runtime and sources
- **Q01 [P0]** Electron-only app, or Electron core **plus a browser-accessible demo** for NASA judging? Which one is the canonical delivery?
  - **CONFIRMED 2026-11-14:** Electron only; canonical platform. D-004. No browser build agreed.
- **Q02 [P1]** Target OS: Windows, Linux, macOS; must the app be packaged portable, installed, or only launched with npm during the hackathon?
  - **CONFIRMED 2026-11-14:** Windows + Linux + macOS. Packaging method not decided. D-004.
- **Q03 [P0]** Does the app need offline operation? May it call NASA Mars Trek/Perseverance APIs at runtime, or must all layers/images be bundled/cacheable?
  - **CONFIRMED 2026-11-14:** fully offline runtime. Asset pipeline/packaging remains open. D-005.
- **Q04 [P0]** When Victor says he improves the 'model', does that mean (a) mesh/3D terrain, (b) geospatial elevation/visibility datasets, (c) walking physics, or (d) all? What artifacts does he provide and by when?
  - **CONFIRMED 2026-11-14:** Victor provides the improved 3D mesh/geometry; precise file+metadata contracts need coordination. D-006.
- **Q05 [P0]** Who owns scientific formula and route/Leash calculations now—Nanda as in old plan, Victor, or Alex? Who may approve changes?
  - **CONFIRMED 2026-11-14:** Alex owns oxygen formulas, routing and Leash. D-007.
- **Q06 [P0]** Are TEAM-PLAN §2 coordinate axes, grids, tile binary format and meta.json a fixed integration contract with Victor? Can 4096m box/home location change?
  - **OPEN 2026-11-14:** must be agreed; do not treat the existing TEAM-PLAN contracts as newly approved. Consult Victor; see pending decision in `04-DECISIONS.md`.
- **Q07 [P1]** Who owns Rachel's shader/HUD final integration? May Alex alter shader/palette freely, or are visual decisions signed off by Rachel?
  - **CONFIRMED 2026-11-14:** changes to Rachel's visuals require prior agreement. D-008.

## Walking physics and oxygen
- **Q08 [P0]** What exactly are the displayed O2 units—physical tank litres, litre equivalents at some reference conditions, or normalized simulated budget? Is 390L a fixed scenario assumption?
- **Q09 [P0]** Reserve: 30 minutes of WHICH consumption rate (standing, flat walking, current slope, average EVA, worst case)? Dynamic reserve in litres or fixed 30L?
- **Q10 [P1]** Astronaut configurable mass/suit efficiency or fixed 75kg and suit factor 2.0? Are these values disclosed as assumptions?
- **Q11 [P0]** Approve Minetti/Tobler/Mars gravity formula from research/02 unchanged, or does the team want adjustments? Who validates numeric test cases?
- **Q12 [P0]** Hard slope limit 24° (measured evidence) or 25° (research graph/shader convention)? Both uphill and downhill? What happens at boundary?
- **Q13 [P1]** Slope computation/smoothing: 2m grid average, 3–5m smoothed, or more accurate 3D tangent from Victor? Same logic must drive routing and shader explanations.
- **Q14 [P0]** 1.15 terrain factor in deterministic cost only, and triangular terrain factor replaces it in Monte Carlo? Otherwise how avoid double counting?
- **Q15 [P1]** Walking speed from Tobler curve (0.92m/s flat) or direct user-control speed? Simulation clock real-time, accelerated, or time jumps?
- **Q16 [P1]** Should path costs include additional factors not in research: surface type, suit cooling, CO2, radiation, temperature, visibility, batteries? If yes, which with evidence?

## Leash, routing and start state
- **Q17 [P0]** Home: fixed Octavia E. Butler landing site, user-selectable lander, or selectable mission base? Can the base move during a session?
- **Q18 [P0]** Return strategy: cheapest O2 path, fastest route, safest route, or same path backwards? Should each be presented as an option?
- **Q19 [P0]** Is the Leash calculated against current O2 after outgoing route/task consumption, and does it update continuously during Walking/Training?
- **Q20 [P1]** How to show the Leash if 390L covers the entire 4.096km square? Offer a clearly labelled low-O2 emergency scenario/slider, extend the terrain area, or keep it invisible until budget drops?
- **Q21 [P1]** Is comms line-of-sight from one static lander (3m mast and 2m suit antenna), or are relays/rovers included? What does 'marginal' mean?
- **Q22 [P0]** If cost grid is Infinity, route unavailable, O2 missing, or tiles not loaded: block planning, mark unsafe, show uncertainty, or fall back to estimates?

## Survival Odds
- **Q23 [P0]** Monte Carlo simulates exactly WHAT trip: entire planned out-and-back path, current position to home only, task stops, or an auto-optimized return? Does simulation begin with original 390L or current O2?
- **Q24 [P0]** What counts as 'survival': return with 30min reserve, any O2 remaining, meet EVA time budget, avoid major injury/leak, retain communication, or some combination?
- **Q25 [P1]** Accept the nine random processes from research/03 and their assumptions as-is? Which failure distributions are illustrative vs excluded, especially large leak 0.5% and injury 2%?
- **Q26 [P1]** Are dust devils linked to chosen local Martian time/daylight/season? Do falls depend only on task-time? Can events interact (injury in dead comms zone)?
- **Q27 [P1]** Keep fixed 1000 deterministic-seed Monte Carlo runs, rounded result and risk bands >95/80–95/<80; or allow user to change seed/run count/confidence display?

## Houston and Mars time
- **Q28 [P0]** Simulation date/time: current Earth date, fixed Mars mission/sol, user's choice, or timeline slider? Should lighting and communications depend on same clock?
- **Q29 [P0]** Houston delay model: date-dependent one-way light time; request+reply = 2x propagation time (plus optional response time)? Show number, interactive message exchange, and walked distance?
- **Q30 [P1]** Should comms dead zones suspend sending to Houston; queue and replay messages; or remain an informational overlay? Time of relay availability?

## Training, game and scope
- **Q31 [P1]** Is Training mode in Alex's scope now? All seven researched tasks, reduced three-task demo, or only core framework; what tasks are prioritized?
- **Q32 [P1]** During a task, what is standing metabolic rate and elapsed time? Can MOXIE magically refill at a station as game fiction, or must refill use the researched ~8.4L/h maximum?
- **Q33 [P1]** Player success/failure and game scoring: finish required tasks, return to base with reserve, time, O2 consumed versus par route, odds threshold?
- **Q34 [P1]** What must unquestionably work in a live 30-second judge demo? Is VR part of the committed deliverable or stretch only?

## Workflow
- **Q35 [P0]** Does Alex want these notes and later block logs committed on fork `main` (current choice) or in a separate spec branch before eventual PR upstream?
- **Q36 [P1]** What constitutes acceptance for each feature block: unit physics tests, visual screenshot, live demo, performance thresholds, package build, or all?
