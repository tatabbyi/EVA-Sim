# NASA DATA & PRIMARY SOURCES — Sharkies Mars EVA

**Evidence register and dataset plan for the hackathon.**
**As-of date:** 2026-11-14. Curated against NASA/NTRS, NASA Planetary Data System (PDS), NASA Science and NASA-supported HiRISE listings. Published date is NOT the same as the date measurements were made. Entries below identify **what the source genuinely supports**, not whatever number might be convenient for gameplay.

## Evidence classifications
- **NASA-OBS**: measured/archived mission data (with original instrument, product ID, calibration, spatial/temporal coverage and data provenance).
- **NASA-REF**: NASA report, technology estimate, science description, study or engineering baseline. It is **not** a sensor observation from the chosen landing site.
- **MATH**: unit identity or explicitly declared algebra; not an empirical measurement.
- **SHARKIES-SCENARIO**: game team assumption needing later calibration; never describe as an official NASA value.
- **REVIEW**: original Rachel synthesis or archived independent audit, not NASA endorsement.

### N01 — Life-support metabolic reference (NASA-REF, verified)
**NASA NTRS:** Anderson, M. S., Ewert, M. K., and Keener, J. F. **Life Support Baseline Values and Assumptions Document**, NASA/TP-2015-218570/REV1, January 2018. **NTRS ID 20180001338**.
- Landing page: https://ntrs.nasa.gov/citations/20180001338
- Full report: https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf
- **Table 4-76, printed page 143:** *Extravehicular Activity Metabolic Loads*: reference 293 W per crewmember and associated metabolic O2 consumption **0.075 kg per crewmember-hour (75 g/h)** for respiratory quotient **0.9** (reference attributed to McBarron et al., 1993). CO2 production in this table: **0.093 kg/h**.
- This baseline is **not a measured rate for our fictional Mars suit at our selected slope/speed**. The table separately distinguishes metabolic O2 **consumption** from total gas **losses**, which can include other system losses. Do not double count them.
- Sharkies usage: reference pair for an assumed linear demo metabolic conversion: `mDotO2[g/h] = Pmetabolic[W] * 75/293`. The scaling away from 293 W is **our approximation**, not an equation validated by the cited table.

### N02 — Mars spacesuit mass feasibility (NASA-REF, 2026)
**NASA NTRS:** Ogilvie, R. et al. **Mars Spacesuit Mass Requirements**, ICES-2026-127, 55th International Conference on Environmental Systems; **publication date 2026-07-12**, acquisition 2026-04-13. **NTRS ID 20260003038**.
- https://ntrs.nasa.gov/citations/20260003038
- Authors report a preliminary **230 lbm (~104.3 kg)** recommended *starting maximum Mars suit mass* for design studies. They explicitly state further Mars-simulation testing is needed. The contemporary lunar exploration xEMU (just under 400 lbm) is not a realistic straight transplant to Mars.
- Sharkies 65 kg suit is an **unverified fictional light-suit design assumption**, NOT the mass of a NASA-certified Mars suit; 104.3 kg is a preliminary design **ceiling**, not an actual issued suit or recommended fixed game value.
- The new report changes the **framing and uncertainty**, not the user's confirmed game scope.

### N03 — Current traverse-model research direction (NASA-REF, 2025)
**NASA JSC / ICES 2025:** Kim, K. J. et al., **A Consolidated Tool for Planning and Analyzing Simulated Exploration Traverses and Associated Metabolic Workload**, ICES-2025-129. **NTRS ID 20250006519**.
- NTRS download: https://ntrs.nasa.gov/api/citations/20250006519/downloads/ICES_final.pdf
- Notes: NASA's Crew State and Risk Model separates metabolic rate, traverse, human thermal, fatigue, inspired CO2, etc. Pressurized-suit validation remains work in progress; suit constraints, gravity and **walking/running regimes** matter.
- Sharkies use: supports an architectural split between ambient terrain, suit mobility, activity power and consumables. **It does not supply our numerical grade coefficient, walk 0.75 m/s, fast 1.15 m/s or suit O2 capacity.**

### N04 — Suited biomechanics on slopes (NASA-REF, 2010)
**NASA NTRS:** Norcross, J. R. et al., **Metabolic Costs and Biomechanics of Inclined Ambulation and Exploration Tasks in a Planetary Suit**, NASA/TP-2010-216125, June 2010, **NTRS ID 20110003409**.
- https://ntrs.nasa.gov/citations/20110003409
- Simulated lunar partial-gravity and Mark III suit analog measurements demonstrate importance of suit mass, pressure, mobility, slope and task.
- **Not** a direct calibration of a future Mars suit. Rachel's fixed "suit multiplier x2" is her proposed generalization.

### N05 — Apollo EVA metabolic observations (NASA-OBS, analog only)
**NASA NTRS:** Waligora, J. M. and Horrigan, D. J. Jr., **Metabolic Cost of Extravehicular Activities**, published November 1974; NTRS ID **19750006325**.
- https://ntrs.nasa.gov/citations/19750006325
- Apollo 14 traverse: **2.9 km**, average **2.4 km/h**, average **300 kcal/h**. Report stresses substantial activity/terrain variation and poor correlation between traverse speed and metabolic rate in those observations.
- These are **Moon measurements**, not human Mars observations. They are useful as a sanity check and warning against overclaiming suit/gait precision.

### N06 — Mars environmental gravity reference (NASA-REF)
**NASA Glenn Research Center:** *Mars — Beginner's Guide to Aeronautics*.
- https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars/
- NASA Glenn states surface acceleration approximately **3.7 m/s²** (~0.37 Earth g). Sharkies' **3.711 m/s²** is a higher-precision standard value used as a demo constant, not a measured site-specific local gravitational anomaly.
- Thin CO2-dominated atmosphere; local pressure and temperature vary with altitude, season, time of day.

### N07 — Real Mars topography: MGS MOLA PDS4 archive (NASA-OBS, actively maintained)
**NASA Planetary Data System, Geosciences Node:** *Mars Global Surveyor / Mars Orbiter Laser Altimeter (MOLA) Mission Experiment Gridded Data Records (MEGDR)*.
- Dataset index: https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- Mission/product overview: https://pds-geosciences.wustl.edu/missions/mgs/mola.html
- **2026-08-25 important update:** MEGDR/SHADR became a maintained **PDS4 MGS MOLA Topography Derived bundle**. Original PDS3 remains historical. Final MEGDR global topographic product originally released **2003-05-07**.
- Global products at **4/16/32/64/128 pixels per degree**, NOT 2 m/pixel. Contains topography, planetary radius, counts and sometimes areoid. Final products use IAU 2000 coordinates; a game's local coordinate origin and reference height need explicit mapping.
- **Do not claim the 2m grid in Victor's branch is a raw MOLA 2m dataset.** High-resolution Jezero terrain requires its own imagery/DTM product and processing manifest.

### N08 — Site-specific Mars weather observations: Perseverance MEDA (NASA-OBS)
**NASA PDS Atmospheres Node:** *Mars 2020 Mars Environmental Dynamics Analyzer (MEDA)*, RDR/derived/calibrated atmosphere data.
- Data catalog: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html
- PDS bundle: https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amars2020_meda
- **Dataset citation:** Rodriguez-Manfredi et al. (2021), *Mars Environmental Dynamics Analyzer*, NASA Planetary Data System, **DOI 10.17189/1522849**.
- Actual data types: pressure, air/ground temperature, wind, humidity, dust/radiation instrument measurements. **Choose a specific sol, instrument, processing level and product version before quoting an observed value.**
- **Not yet integrated:** As of this document, nobody has supplied a downloaded MEDA observation/product ID or checksum for our demo. Fixed **-60 C and 635 Pa** are **SHARKIES-SCENARIO values**, not reported measurements from Jezero on 2026-11-14.

### N09 — High-resolution Mars DTM / Jezero planning (NASA imagery and supported archive)
- **HiRISE DTM catalog (University of Arizona operating NASA MRO HiRISE):** https://hirise.lpl.arizona.edu/dtm/index.php — listing includes DTM releases dated **2026-11-03** as checked 2026-11-14.
- **NASA/JPL Perseverance Jezero hazard map**, NASA Photojournal **PIA24167**, image date **2021-02-17**: https://science.nasa.gov/photojournal/jezeros-hazard-map/
- **NASA/JPL/USGS/University of Arizona Jezero region map**, 2020-07-13: https://science.nasa.gov/resource/map-of-regions-around-mars-jezero-crater/
- Hazards, DEM grid, slope and high-detail renders require exact matched-source products. An annotated hazard PNG is NOT a quantitative walkability grid. The current 4m and Victor 2m/tile assets have **not** been independently traced here to an explicit DTM product ID.

### N10 — MOXIE real instrument vs game adaptation (NASA-REF + experiment observation)
**NASA Science:** *Mars 2020 Perseverance Science Instruments*.
- https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/
- NASA lists real **rover-mounted MOXIE** mass **17.1 kg** and electrical draw **300 W**; its campaign produced **122 g** of oxygen in total, peaking around **12 g/h**, ended in **2023**.
- Sharkies' **portable** MOXIE is **fictionalized game hardware**. Its electrical power is NOT the astronaut's metabolic power. It **never replenishes suit oxygen** as a game mechanic.

### N11 — Crew fitness, EVA workload limits (NASA-REF, 2025)
**NASA Office of the Chief Health and Medical Officer:** **OCHMO-TB-031 Exercise Overview**, NASA/SP-20250000273.
- https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/
- References NASA-STD-3001 Volume 1 Revision C (2023) for extraterrestrial EVA aerobic capacity and individual variations. Documents Apollo activity-specific oxygen requirements and deconditioning considerations.
- **Not** a replacement for modeled per-task mass and oxygen rates; the demo uses one fixed astronaut profile.

## Non-NASA science used by Rachel — KEEP SEPARATE
- Minetti, A. E. et al. (2002), **Energy Cost of Walking and Running at Extreme Uphill and Downhill Slopes**, *Journal of Applied Physiology*. DOI **10.1152/japplphysiol.01177.2001**. Original **Earth treadmill** walking and separate running curves. This is NOT NASA's equation for Mars EVA.
- Tobler hiking-speed curve: as adapted and rescaled in Rachel's `research/02-walking-cost-model.md`; old scale factors, kg and calorie-to-O2 volume conversions are **composite engineering extrapolations**, not NASA-calibrated Mars suit laws.
- Project review/critique: `docs/physics/06-RACHEL-RESEARCH-AND-INDEPENDENT-AUDIT.md`.

## Do NOT claim these are NASA-measured
| Sharkies value or feature | True provenance |
| --- | --- |
| 80 kg person, 65 kg hypothetical suit, gear inventory values | team engineering assumptions, not NASA issuance |
| 750 g usable O2, 150 g low reserve, 75 g critical | game assumptions, not a certified PLSS |
| Idle 165 W, fast motion 430 W, task 350 W | modeled examples; NASA N01 directly anchors only the 293 W / 75 g/h reference pair |
| Walk 0.75 m/s, fast 1.15 m/s | selected suited DEMO speeds |
| 25-degree hard mobility cap, 1m slope sampling | game/engineering heuristics; not NASA safety thresholds |
| Fixed -60 C, 635 Pa, 95.3% CO2 | scenario approximation of Mars atmosphere; not site/sol-specific MEDA observation |
| Random landing point from all of Mars | **future** feature; demo location preselected by team |
| Earth-style sprint, full photoreal Mars, true 10x10km NASA coverage | not currently implemented or independently verified |

## Required data citation chain before presenting a real dataset to judges
1. Dataset name + instrument/mission + PDS **bundle/product identifier** or HiRISE DTM ID.
2. Producer and acquisition date/sol; released/archived product version, processing level and retrieval date.
3. File URL or PDS label, SHA-256 of original and transformed file; data license/credit notice if applicable.
4. Coordinate reference system, projection, axis orientation, elevation datum, grid cell size, no-data mask, coverage.
5. Processing script/parameters (warp, crop, smooth, decimate, tiles), derived SHA-256 and code commit.
6. One or more exact control-point comparisons between source DEM, height sampler, displayed mesh, ML route and map.
7. If any link is unreachable, use the stable NTRS/PDS landing page and **record that the binary or PDF download was not independently verified**.

**Access note:** A previous NASA NSSDC Mars Fact Sheet URL (`nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html`) redirected to a NASA NSSDC maintenance page when directly opened during this research. It is useful historical context but should **not** be the only auditable citation for the demo. The NTRS full report was indexed and Table 4-76 text confirmed; a full-page raster screenshot could not be retrieved in this research interface. No raw MEDA/DTM binaries were downloaded or independently hashed.
