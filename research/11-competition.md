# 11 Competition

Searched public GitHub on 14 Nov 2026 (repository search, read only). 23 repos match "interplanetary survival guide" and 26 match "martian map" space apps; most were pushed on 13 Nov 2026. The hackathon runs 14 to 15 Nov worldwide (13), so these are pre-event plans, research and skeletons, not finished entries. Several READMEs say so ("working skeleton", "Routes are still mock data"). The real field will be bigger by Sunday night. Nobody was contacted. Space Apps does not use Devpost; its own team pages render by JavaScript and weren't searchable (01).

## Closest to EVA Sim

| Project | What it does | Leash-like? | Site | Notes |
|---|---|---|---|---|
| **RedSight** https://github.com/RobEn-AAST/RedSight | "Hyperlocal Marswalk decision-support planner": reachable sites, routes, time/O₂ estimates from a cited metabolic model | **Yes, the closest.** "Turn-back marker", green/amber/red "return zones", a "don't go beyond" line, automatic switch to fastest way home when O₂ runs low. Also radio shadow: "where ridges block line of sight to the habitat". | Gale crater / Mount Sharp | README says "Routes are still mock data" and map tiles are "a single preview image". |
| **MarsGo** https://github.com/asaadzx/marsgo | "Suit-aware EVA field map for Jezero": least-cost route over slope and roughness, no-go limits, suit consumables | Partly: computes "walk time, O₂, water, battery, walk-back reserve" for a route. No live boundary mentioned. | Jezero | Streamlit app. CTX 4.83 m/px basemap, USGS geologic map, Mastcam-Z views. |
| **marswalk-planner** https://github.com/FahadHasan8386/marswalk-planner | Draw a route on Jezero; distance, slope profile, climb, time, metabolic energy; rejects routes over the slope limit; Dijkstra pathfinding; `/api/contingency` | Partly: a "walk-back check" on a drawn route. | Jezero | Python server backend. "Runs on a synthetic demo terrain until the real HiRISE DEM is placed". Cost is symmetric: `slope distance × (1 + k (slope/limit)²)`. |
| **Marswalk Map** https://github.com/RagavU1430/marswalk-map | "Tactical 3D EVA route planner", 7 NASA layers, 25° max slope, route risk profile | No | Jezero delta front | Has a "Visor POV - first-person helmet view". Terrain is "procedural ... generated from elevation data". |
| **Sightline** https://github.com/monek825/sightline | "Mars navigation with no GPS": match a 360° skyline against skylines from NASA elevation data to fix position. Crew model: radiation, suit time, cooling, dust devils. | No boundary, but a helmet view with "an arrow/beacon to home and the walk budget as a HUD". | Not stated in summary | Static site, no backend, Python precompute. Same architecture as EVA Sim. |
| **pegasus-martian-map** https://github.com/baatouchehoussem/pegasus-martian-map | "Hyperlocalized 3D Mars EVA Navigation & Science Map built with CesiumJS" | Not mentioned | Not stated | |
| **marswalk-planner (TRAVERSE)** https://github.com/ammarzulfaqar/marswalk-planner | CesiumJS Mars globe, Jezero EVA route planner, route JSON export | Not mentioned | Jezero | Last pushed 14 Oct 2026. |
| **martian-excursion-navigation-ai** https://github.com/python-222/martian-excursion-navigation-ai | "Mars EVA spacesuit HUD with an on-device LLM copilot and real NASA Jezero imagery" | Not mentioned | Jezero | Short README. |

Others found, general Mars maps without EVA safety logic: NOVALITH (Cairo), SheSpace-Mars, OlympusTrail, MartianMap-NeuroNexus, Mars-pathfinder, NASA-Space-Apps-26, martian_map.

## What this means

**Jezero + route planner + slope + O₂ is a crowded idea.** At least five teams are planning it before the weekend has even started. A plain "draw a route, see O₂" demo will not stand out at the global stage.

What the 12 READMEs scanned don't have (searched for Monte Carlo, light delay, round trip, Houston, WebXR, headset, VR, game, par):

- **Survival Odds from Monte Carlo runs.** Zero hits. Everyone else gives one number; EVA Sim gives a probability with sourced spreads (03). Lead with this.
- **Houston view with real light delay.** Zero hits. The NASA ConOps angle (crew decide alone, ground concurs later) is unique so far.
- **WebXR / VR.** Only RedSight mentions it, as a planned "Tier 3 - bonus: the same 360 + HUD in Apple Vision Pro (WebXR)". Two others have a desktop first-person view.
- **Training game with a par route.** Zero hits.
- **Direction-aware walking cost.** The two that publish their cost formula use a symmetric slope penalty. EVA Sim's Minetti-based cost (uphill ≠ downhill) is more correct and easy to show with one chart.
- **A live boundary on Jezero.** RedSight has one but for Gale crater and with mock routes. EVA Sim's Leash on real Jezero data is still distinct, but don't claim "first".

Suggested pitch line: "Other tools tell you if a route is safe. EVA Sim tells you how likely you are to get home, and where the line is right now."

## Not checked

- Space Apps project gallery pages (JavaScript only).
- Private repos and teams without GitHub.
- Past years' winners are in 12.
