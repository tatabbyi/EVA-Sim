# 10 Training mode tasks

Seven real Perseverance activities, each turned into a game task. "Real time" is what the rover took. "Game time" is a suggestion for Training mode; it costs oxygen at a working rate while the player stands still.

Map units are from SIM 3464 (see 01): **Njf** Jezero floor, **Nle** lower etched (olivine-rich, Séítah area), **NHjf2** Jezero fan unit 2 (the delta). Remember the 100 to 200 m offset between the geologic map and the terrain.

## Summary

| # | Task | One line | Real time | Game time | Unit |
|---|---|---|---|---|---|
| 1 | Abrade a rock | Grind off a 5 cm patch of weathered surface to see fresh rock | Part of a multi-sol sampling sequence | 3 min | Njf |
| 2 | Take a core | Drill a rock core into a titanium tube and seal it | Full autonomous coring sequence fits in one sol | 5 min | Nle |
| 3 | SuperCam laser shots | Zap a target 2 to 7 m away and read its chemistry from the spark | Minutes per target | 1 min | Any; best at NHjf2 cliffs |
| 4 | PIXL X-ray map | Map elements across a few millimetres of abraded rock | 8 to 9 hours, overnight | 2 min (time skip) | Nle |
| 5 | SHERLOC organics scan | Look for organic molecules and minerals with a UV laser | Not found tonight | 3 min | NHjf2 |
| 6 | Drop a sample tube at a depot | Place a sealed tube on the ground for a future mission to collect | 10 tubes in under six weeks | 1 min per tube | Njf near the delta |
| 7 | Run MOXIE | Make oxygen from the Martian air | About an hour per run | Refill station | Lander / base |

Optional 8th: **Scout with Mastcam-Z** (stand on high ground and take a panorama). Ties to the viewshed layer: a good scouting spot is one that sees a lot. Not separately sourced.

## Details and sources

### 1. Abrade a rock (Njf)

- NASA's "sampling sol path" is a fixed sequence at each sampling site: drive to the site, survey with cameras and instruments, abrade a patch to expose fresh rock, analyse the patch, then core a nearby spot.
- An abrasion patch is about 5 cm across (NASA blog on the "Pumbe" abrasion; figure via search, page not opened).
- Fits the crater floor: the first sampling campaigns (Roubion, Citadelle) were on the crater floor. Citadelle blog (sol 185): https://science.nasa.gov/blogs/kicking-off-the-sampling-sol-path-at-citadelle/
- Game: must be done before task 2 at the same rock, like the real sequence.

### 2. Take a core (Nle)

- After the first successful core, NASA reported the first complete autonomous run of the sampling system "within the time constraints of a single sol" (quote from a NASA mission update surfaced by search; exact page not opened, so check before putting it on a slide. Related: https://science.nasa.gov/missions/mars-2020-perseverance/assessing-perseverances-first-sample-attempt).
- Put it in the olivine-rich Nle unit: the SIM 3464 pamphlet says Njf has eroded to expose Nle at lat 18.44°N, long 77.44°E, about 1 km from the landing site. The rover sampled the olivine-rich Séítah area there.
- Real failure worth using: the first attempt (Roubion, Aug 2021) came back empty because the rock crumbled. A random "core crumbled, try another rock" event fits the game.

### 3. SuperCam laser shots (any unit)

- LIBS fires at 5 to 10 points per target, 30 laser shots per point; deep analyses use 250 shots on one point. Works on targets about 2 to 7 m away. By early 2025, 291,769 LIBS shots on 1,031 targets. Source: CNES, https://cnes.fr/en/news/perseverance-half-million-laser-shots-supercam-mars
- Game: point at a rock within 7 m, hold to fire. Good at the delta front (NHjf2) where cliffs are out of reach.

### 4. PIXL X-ray map (Nle)

- PIXL is placed on the arm the sol before, about 25.5 mm above the rock, and the scan runs overnight. NASA: it measures thousands of points "over the course of as many as eight or nine hours". Source: https://www.nasa.gov/solar-system/nasas-new-mars-rover-will-use-x-rays-to-hunt-fossils
- Example scan (sol 294, "Quartier"): 7 x 7 mm, 3,299 points 0.125 mm apart, about 10 s per point. Source: https://arxiv.org/abs/2405.14471
- Game: a "set it and wait" task. Show a time skip and the oxygen cost of waiting, which is the point: long tasks eat consumables even when you're still.

### 5. SHERLOC organics scan (NHjf2)

- SHERLOC is the UV Raman and luminescence instrument on the arm. On "Wildcat Ridge", a rock about 1 m wide at the delta front that formed as mud and fine sand settled in an evaporating saltwater lake, it found the most organic compounds of any sample collected up to then (Sept 2022), correlated with sulfate minerals. NASA: organic molecules are not proof of past life. Source: https://www.jpl.nasa.gov/news/nasas-perseverance-rover-investigates-geologically-rich-mars-terrain/
- Real duration not found tonight. Pick a game time and don't claim it is real.

### 6. Drop a sample tube at a depot (Njf near the delta)

- Three Forks depot: 10 tubes, the 10th dropped on sol 684. Tubes laid "in an intricate zigzag pattern, with each sample about 15 to 50 feet (5 to 15 meters) apart" so they can be recovered safely. Each tube has a twin still on the rover. Source: https://www.jpl.nasa.gov/news/nasas-perseverance-rover-completes-mars-sample-depot/
- First tube dropped 21 Dec 2022, depot complete 28 Jan 2023, so under six weeks. Depot map: https://science.nasa.gov/resource/perseverances-three-forks-sample-depot-map/
- Game: place tubes 5 to 15 m apart on flat ground; the slope shader (04) can mark ground that is too steep.

### 7. Run MOXIE (base)

- MOXIE made 122 g of oxygen in total, "about what a small dog breathes in 10 hours". At its best it made **12 g per hour**, twice NASA's goal, at 98% purity or better. 16 runs; last run Aug 2023. Source: https://www.jpl.nasa.gov/news/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/
- **Pitch number:** 12 g/h of O₂ is about 8.4 L/h (at 1.429 g/L). A suited astronaut walking uses about 60 L/h (02). So the best MOXIE run made about one seventh of what one walking astronaut breathes. Good for the "why oxygen planning matters" slide.
- Game: the refill station at checkpoints, with a refill rate shown in litres per minute.

## Notes

- Real sol counts for abrasion and SHERLOC were not found in the time available. The game times above are design choices.
- All seven fit within 2 to 4 km of the landing site except the delta tasks, which may sit at the edge of a 4 km box. Check positions against `GeoUnits_v1` on Saturday.
