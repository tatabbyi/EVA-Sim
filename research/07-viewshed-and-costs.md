# 07 Cost grids, routes and viewshed

## Answer first

- **The Leash is a threshold on a precomputed "cost to home" grid.** One grid, computed once in Python from the home point (lander). In the browser, the Leash line is where `costToHome = O₂ left − reserve`. As O₂ drops, only the threshold changes, so it stays live with no path-finding in the browser. Same idea as Apollo's walk-back limit.
- **`MCP_Geometric` can't do uphill vs downhill.** It gives each cell one cost per metre, the same in every direction. From 02, the walk home on a 10° slope costs 0.171 kcal/m uphill but 0.075 downhill. Averaging gives 0.123, which **underestimates a walk home that is uphill by 28%**. That's the unsafe direction.
- Two direction-aware options below. Recommended: SciPy's `dijkstra` on a directed graph built with NumPy. Fallback: `MCP_Flexible` with elevation in place of costs.
- `gdal_viewshed` needs a projected DTM (01's warp does that), and for a Mars CRS it switches curvature to 1.0 (no refraction) on its own.

Versions: scikit-image 0.26.0 (20 Dec 2025, Python ≥ 3.11, https://pypi.org/project/scikit-image/). GDAL 3.13.3 (13 Aug 2026).

## scikit-image API (0.26)

Docs: https://scikit-image.org/docs/stable/api/skimage.graph.html

- `route_through_array(array, start, end, fully_connected=True, geometric=True)` → `(path, cost)`. `path` is a list of (row, col). Convenience wrapper: builds a new `MCP_Geometric` each call. Fine for one route, wasteful for many.
- `MCP_Geometric(costs, offsets=None, fully_connected=True, sampling=None)`. `costs[r, c]` is cost per unit distance through that cell. A move from (1,1) to (1,2) costs ½·costs[1,1] + ½·costs[1,2]; diagonals use √2. **Infinite or negative costs are skipped**, so `np.inf` marks impassable cells.
- `mcp.find_costs(starts, ends=None, find_all_ends=True, max_coverage=1.0, *, max_step_cost=None)` → `(cumulative_costs, traceback)`. With `ends=None` it fills the whole grid. **`max_cumulative_cost` and `max_cost` are deprecated in 0.26**; don't use them.
- `mcp.traceback(end)` → list of indices from the nearest start to `end`. Cheap after `find_costs`, so call `find_costs` once from home and trace back many routes.
- `MCP_Flexible`: same, plus Python-overridable hooks. `travel_cost(old_cost, new_cost, offset_length)` returns the cost of one step (default: `new_cost`). `examine_neighbor` and `update_node` exist too.

### Memory on 4,000 x 4,000 (16 million cells)

From the source (`_mcp.pyx`, v0.26.0): costs copied to float64 (8 B per cell), cumulative costs float64 (8 B), traceback int16 (2 B), an int8 edge map (2 B per cell in 2D), plus a binary heap with a slot per cell. About 25 to 30 bytes per cell, so **roughly 0.4 to 0.5 GB** plus your input array. Fine on an 8 GB laptop. Estimated from the source, not measured.

Pass a float64 array in Fortran order (`np.asfortranarray(cost, dtype=np.float64)`) to skip one extra copy.

## Option A (recommended): SciPy directed Dijkstra

Build every 8-neighbour step once with NumPy, weight it with the 02 formula using the step's own slope and direction, then run one Dijkstra on the reversed graph from home. No Python per step.

```python
import numpy as np
from scipy.sparse import coo_array
from scipy.sparse.csgraph import dijkstra

def kcal_per_m(t):                       # t = tan(slope) in the direction of travel, from 02
    cw = 280.5*t**5 - 58.7*t**4 - 76.8*t**3 + 51.9*t**2 + 19.6*t + 2.5
    v = 1.092 * np.exp(-3.5 * np.abs(t + 0.05))
    return 0.03585 * (1.825 + 0.380 * (cw - 2.5)) + 0.0210 / v

H, W = dem.shape; cell = 2.0              # metres per cell (see grid size below)
idx = np.arange(H * W, dtype=np.int32).reshape(H, W)
src, dst, wt = [], [], []
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        if dy == dx == 0: continue
        a = idx[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)]
        b = idx[max(0, dy):H - max(0, -dy), max(0, dx):W - max(0, -dx)]
        d = cell * np.hypot(dy, dx)
        t = (dem.flat[b] - dem.flat[a]) / d                      # rise per metre walking a -> b
        ok = np.abs(t) <= np.tan(np.radians(25))                  # 25° limit from 02
        src += [a[ok]]; dst += [b[ok]]; wt += [(d * kcal_per_m(t[ok])).astype(np.float32)]
G = coo_array((np.concatenate(wt), (np.concatenate(src), np.concatenate(dst))), shape=(H*W, H*W)).tocsr()

# cost of walking from every cell TO home = Dijkstra from home on the reversed graph
cost_to_home = dijkstra(G.T, directed=True, indices=home_index).reshape(H, W)   # kcal
o2_to_home = cost_to_home / 4.8                                                   # litres
```

- `dijkstra(csgraph, directed=True, indices=None, return_predecessors=False, unweighted=False, limit=np.inf, min_only=False)` (SciPy docs: https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csgraph.dijkstra.html). `limit` stops the search beyond a cost, for example the full O₂ budget in kcal, which saves time.
- For a best route from A to B: `dijkstra(G, indices=a, return_predecessors=True)` and walk the predecessors back from B.
- Memory: 8 edges per cell. On a 2 m grid (2,048 x 2,048, 4.2 M cells) that is about 33 M edges: int32 source + int32 target + float32 weight = 12 B each, about 0.4 GB, and the CSR copy about the same again. A 1 m grid is four times that (about 3 GB), which is why 2 m is suggested for the Leash.
- Also add the 1.15 terrain factor from 02 to the weights, or apply it to the threshold in the browser.

## Option B: `MCP_Flexible` with elevation as the "cost"

`travel_cost(old_cost, new_cost, offset_length)` only sees the two cell values and the step length. If the array holds **elevation** instead of cost, those two values give the slope.

```python
from skimage.graph import MCP_Flexible

class WalkHome(MCP_Flexible):
    def travel_cost(self, old_h, new_h, length):
        d = length * CELL
        t = (old_h - new_h) / d          # search runs outward from home, the walk runs inward
        if abs(t) > TAN25: return np.inf
        return d * kcal_per_m_scalar(t)

z = dem - dem.min() + 1.0               # MCP ignores negative values; Jezero heights are about -2,500 m
m = WalkHome(np.asfortranarray(z, dtype=np.float64), fully_connected=True)
cost_to_home, tb = m.find_costs([home_rc])
```

Catch: the hook is called from Cython into Python for every step, about 8 calls per cell. On 4 M cells that is roughly 33 M Python calls, likely minutes. Workable as a one-off, but Option A is faster and easier to test. Note the sign: the search spreads out from home, but the astronaut walks towards home, so the slope is `old − new`.

## Option C (simplest, not direction-aware)

`MCP_Geometric` with `cost[r,c] = max(E(θ), E(−θ))` per cell (the worse of up and down for that slope). Conservative in both directions, so it never underestimates the walk home. It overestimates downhill walks, which shrinks the Leash. Acceptable if time runs short; say so on the slide.

```python
from skimage.graph import MCP_Geometric
m = MCP_Geometric(np.asfortranarray(cell_cost_per_m * CELL, dtype=np.float64))
cost_to_home, tb = m.find_costs([home_rc])
route = m.traceback(target_rc)          # cheapest path home from target
```

## Par route for Training mode

Par = cheapest route through the checkpoints in order. Run Option A's `dijkstra(G, indices=[cp0, cp1, ...], return_predecessors=True)` once (one row per checkpoint), stitch the legs, and sum the weights. Store the par O₂ per leg in the JSON so the game compares the player's use leg by leg.

## Grid size

| Grid | Cells for 4 km | Use |
|---|---|---|
| 1 m | 16.8 M (4,097²) | Terrain mesh (05), viewshed |
| 2 m | 4.2 M (2,049²) | Leash cost-to-home grid, routes |
| 4 m | 1.0 M | Quick tests on Saturday morning |

Downsample the 1 m DTM with `gdalwarp -tr 2 2 -r average` before computing slopes for the 2 m grid. Smoothing the slope (02) comes free with averaging.

Ship `o2_to_home` as Float32 `.bin` (2,049² x 4 B = 16.8 MB, compresses well) or as UInt16 decilitres (8.4 MB, max 6,553 L).

## gdal_viewshed

Docs: https://gdal.org/programs/gdal_viewshed.html (and `gdal_viewshed --long-usage` locally, GDAL 3.13.3).

Options that matter:

| Option | Meaning | Default |
|---|---|---|
| `-ox`, `-oy` | Observer position, in the raster's SRS units | |
| `-oz` | Observer height above the DEM surface | 2 |
| `-tz` | Target height above the DEM surface | 0 |
| `-md` | Maximum distance | 0 (no limit) |
| `-cc` | Curvature coefficient | 0.85714 for Earth CRSs; **1 for non-Earth CRSs** (semi-major axis more than 5% from WGS 84) |
| `-om` | `NORMAL` (Byte visible/invisible), `DEM` or `GROUND` (Float64: minimum target height needed to be seen), `ACCUM` (many observers) | NORMAL |
| `-vv`, `-iv`, `-ov` | Values for visible, invisible, out of range | 255, 0, 0 |

From the docs: the algorithm (Wang 2000) "will only output meaningful results if the georeferencing is in a projected coordinate reference system". The 01 warp gives that. Height correction is `Height − CurvCoeff × Distance² / SphereDiameter`, with the sphere taken from the SRS (R = 3,396,190 m here), so Mars curvature is handled.

Line of sight is symmetric, so one run from the lander answers "can a suit antenna 2 m up anywhere see the lander antenna":

```bash
# Lander antenna 3 m above ground (assumption, change to the real mast height), suit antenna 2 m.
# Observer = landing site in the 01 projection.
gdal_viewshed -ox 4354489 -oy 1093304 -oz 3 -tz 2 -md 5000 -cc 1 \
  -om NORMAL -vv 255 -iv 0 -ov 0 -co COMPRESS=DEFLATE \
  jezero_4km_1m.tif comms_lander.tif

# Better for display: how high would the suit antenna need to be to see the lander?
gdal_viewshed -ox 4354489 -oy 1093304 -oz 3 -cc 1 -om GROUND \
  jezero_4km_1m.tif comms_needed_height.tif
# dead zone = value > 2 m; "marginal" = 1.5 to 2 m
```

Notes:
- Horizon at Mars scale for a 2 m antenna to a 3 m antenna over flat ground: √(2Rh₁) + √(2Rh₂) ≈ 3.7 + 4.5 = 8.2 km. Bigger than the 4 km box, so terrain, not curvature, makes the dead zones here.
- Viewshed is optical line of sight. Real UHF radio bends a little round edges, so dead zones are slightly pessimistic. Fine for a safety tool; say so.
- A crewmate-to-crewmate link would need a viewshed per position. Skip, or precompute a few `ACCUM` runs (`-os` spacing) for "fraction of nearby ground visible".
