# 08 Mars time and sun position

## Answer first

- `mars-date-utils` does what we need: sun elevation, sun azimuth, local solar time and **one-way light delay** for any Earth date. Zero dependencies, TypeScript types included.
- **Longitude is in degrees WEST.** Jezero is 77.4508°E, so pass **282.5492**, not 77.45. Passing east longitude gives the sun position for the wrong side of the planet, with no error.
- **Licence is GPL-3.0-or-later.** Bundling it into the site makes the site's code a combined GPL work. Fine if the repo is public under GPL-3.0; a problem if the team wants MIT. See options below.
- The Python side probably doesn't need Mars time at all: lighting can be done live in the shader from the JS sun direction.

## mars-date-utils

| Item | Value |
|---|---|
| Version | 1.1.1, published 17 Oct 2021 (no release since) |
| Licence | GPL-3.0-or-later |
| Repo | https://github.com/mendahu/mars-date |
| npm | https://www.npmjs.com/package/mars-date-utils |
| Algorithm | Follows NASA GISS Mars24 (Allison and McEwen 2000). Code comments use the same step numbers (A-4 UTC to TT, A-5 Julian date TT, A-6 J2000 offset). Reference: https://www.giss.nasa.gov/tools/mars24/help/algorithm.html |
| Leap seconds | Hard-coded table. No leap seconds have been added since the end of 2016, so it is still current. |

Methods (from the README and the 1.1.1 source):

| Method | Returns |
|---|---|
| `new MarsDate(earthDate: Date)` | instance |
| `getSolarElevation(lat, lonWest)` | degrees above the horizon; negative = night |
| `getSolarAzimuth(lat, lonWest)` | degrees clockwise from north (90 = east, 180 = south) |
| `getLTST(lonWest)` | local true solar time, `"hh:mm:ss"` |
| `getLMST(lonWest)` | local mean solar time, `"hh:mm:ss"` |
| `getLs()` | solar longitude (season), degrees |
| `getCalendarYear()` | Mars Year (MY 1 starts 11 Apr 1955) |
| `getLightDelay()` | **one-way light time Earth to Mars, seconds** (centre to centre) |
| `getDistanceBetweenEarthAndMars({unit: 'au' or 'km'})` | distance |
| `getMarsSolDate()`, `getMST()` | Mars Sol Date, Coordinated Mars Time |

Latitude is planetocentric degrees north (south negative). Note the source's JSDoc comment for `getSolarAzimuth` swaps the labels ("@param lon Latitude, @param lat Longitude"), but the argument order is `(lat, lon)`, as in the README examples.

### Example for Jezero

```ts
import { MarsDate } from 'mars-date-utils';

const JEZERO_LAT = 18.4447;              // °N, Octavia E. Butler landing site
const JEZERO_LON_W = 360 - 77.4508;      // 282.5492 °W  (library wants WEST longitude)

const m = new MarsDate(new Date('2026-11-14T12:00:00Z'));
const elevation = m.getSolarElevation(JEZERO_LAT, JEZERO_LON_W);  // degrees
const azimuth   = m.getSolarAzimuth(JEZERO_LAT, JEZERO_LON_W);    // degrees from north
const localTime = m.getLTST(JEZERO_LON_W);                        // "hh:mm:ss"
const delaySec  = m.getLightDelay();                              // Houston view

// Three.js sun direction (x east, y up, z south, as in 04)
const el = elevation * Math.PI / 180, az = azimuth * Math.PI / 180;
const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
```

Not run tonight (executing a downloaded package was blocked in this session). Two checks to do on Saturday in 30 seconds: at `LTST ≈ 12:00` the azimuth should be close to 180 or 0 and the elevation close to 90 − |18.44 − subsolar latitude|; and `getLightDelay()` should fall between about 180 s and 1,340 s (3 to 22 minutes).

Useful for the game: dust devils at Jezero peak around local noon (03), so `getLTST` can drive the dust devil rate through the day.

### If GPL is a problem

The Mars24 steps for sun position are short and public (GISS page above, sections A to D). Writing them directly in TypeScript is about 40 lines and has no licence strings attached. The library's README examples (Spirit landing site) give test values to check against.

## Python side

There is **no PyPI package called `mars-time-converter`**. The closest matches:

| Package | Version | What it does | Licence |
|---|---|---|---|
| `marstimeconverter` | 0.1.1 (22 Apr 2025) | UTC ↔ LMST, MSD, MTC, equation of time, mission configs in XML, CLI. **No sun elevation in its feature list.** Only needs NumPy. | MIT (PyPI listing) |
| `marstime` | 0.5.6 (9 Jul 2019) | Python version of the full Mars24 algorithm (Allison and McEwen 2000), by Christopher Lee | Modified BSD |

Sources: https://pypi.org/project/marstimeconverter/ (docs: https://gitlab.obspm.fr/gsainton/marstimeconverter/-/wikis) and https://pypi.org/project/marstime/

Recommendation: skip Mars time in Python. If a precomputed illumination map is wanted (for example "shadowed at 16:00"), use `marstime` for the sun vector and `gdaldem hillshade -az <azimuth> -alt <elevation>` on the DTM. Check whether `marstime` wants east or west longitude before using it; `mars-date-utils` wants west.
