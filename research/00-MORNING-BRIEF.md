# Morning brief, Sat 14 Nov

All 13 tasks done. Details and sources in files 01 to 13.

## Changes to the plan

1. **Lead the pitch with Survival Odds and the Houston view, not the Leash** (11). At least five public repos are planning "Jezero route planner with slope and O₂" for this weekend. RedSight (Gale crater) already has a turn-back marker, a "don't go beyond" line and radio shadow. None of 12 competitor READMEs mention Monte Carlo odds, light delay or a training game. Line: "Other tools tell you if a route is safe. EVA Sim tells you how likely you are to get home."
2. **Use SciPy `dijkstra`, not `MCP_Geometric`, for the Leash** (07). Walking cost depends on direction; one cost per cell underestimates an uphill walk home by about 28% at 10°. Recipe ready. The Leash is then just a threshold on one precomputed O₂-to-home grid (2 m cells, about 17 MB).
3. **Reproject the DTM first** (01). At Jezero its pixels are 0.949 m east-west, not 1 m. `gdalwarp` command ready; target projection matches the rover waypoints. Crop **4,097 m** square so it cuts into 8 x 8 pymartini tiles of 513 (05).
4. **MapLibre needs a 20-line `addProtocol` to show Mars Trek tiles** (06). Trek is plate carrée, MapLibre is Web Mercator. The 25 cm Jezero HiRISE layer exists and has CORS `*`. Hide MapLibre's scale bar (it uses Earth's radius).
5. **Licence decision needed** (08, 13). Space Apps requires an OSI licence (default Apache 2.0). mars-date-utils is GPL-3.0. Pick GPL-3.0 for the repo, or replace the library with ~40 lines of Mars24 maths. It also wants **west** longitude: Jezero = 282.5492.

## Pitch facts (12)

- "Mission rules restricted us from going more than 6 miles from the LM - the distance we could walk back in a pinch" (NASA SP-350).
- Light delay 3.0 to 22.3 min one way. At worst case, a crew walking home covers about 2.5 km before Houston's reply arrives.
- NASA's own Joint AR ConOps walk-back scenario uses a topo map, a line-of-sight comms layer and slope-based path estimates, and accepts about 10 min of comms loss. That is Plan mode. Moon document; we do Mars.
- MOXIE's best hour made about 8.4 L of O₂, a seventh of what one walking astronaut uses.

## Numbers ready to use

- Walking O₂ (02): 18.4 L/km flat, 35.6 at 10°, 62.1 at 20°. Slopes over 25° impassable. × 1.15 for rough ground (Apollo 14 cost 42% more than smooth-ground maths).
- Monte Carlo (03): metabolic lognormal σ 0.12; terrain triangular 1.0 to 1.5; speed 0.7 to 1.1; leak 0 to 0.035 L/min (barely matters); dust devils about 3 per midday EVA, cost time not falls; falls 0.15 per hour of task time. Usable O₂ 390 L is derived, not quoted.
- Versions: three 0.187.0, maplibre-gl 6.18.0, pymartini 0.6.0, scikit-image 0.26.0.

## Rules to remember (13)

- Demo: video ≤ 30 s with English subtitles, or ≤ 7 slides in English. Public links only.
- AI is called "SI" this year. Watermark any SI images or video; note SI use for code in text and metadata (README, file headers). SI must not be used to come up with the idea.
- Request a Web Filter Classification for the Vercel URL so judges' networks don't block it.
- Online submission closes Sun 23:59; local judging times may differ.

## Problems and gaps

- Space Apps site: broken certificate chain and JavaScript pages. Use a browser. Athlone schedule not confirmed from the site.
- Blocked or not opened: TTU V-SUIT page, waypoint panoramas (403), NASA Ames autonomy paper. Check in a browser if needed.
- mars-date-utils was read, not run. Check its output on Saturday (08 has the checks).
- Not measured: skimage memory (estimated 0.4 to 0.5 GB on 4,000²), pymartini vertex counts on real terrain.

## Open questions for 09:00 kickoff

1. Licence: GPL-3.0 with mars-date-utils, or Apache/MIT and our own sun maths?
2. Which feature leads the 30-second video: Survival Odds or the Houston delay?
3. Home point: landing site (flat crater floor) or a spot near the delta, which has more slope and more drama?
4. Leash grid at 2 m: OK, or does anyone need 1 m?
5. Video or slides for the demo? Who owns it?
6. Is VR in scope for Sunday 05:00, or a stretch goal? Who has a headset?
7. Ask the Local Lead: local judging format and slide/video limits for the 11:30 presentations.
8. Lander antenna height for the viewshed: 3 m placeholder. Any better number?
