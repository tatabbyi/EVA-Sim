# 05 pymartini to Three.js

## Package facts

- pymartini **0.6.0**, released 12 Oct 2026. Needs Python 3.11 or newer. Only dependency is NumPy. Prebuilt wheels for Linux, macOS (Intel and ARM) and Windows. Source: https://pypi.org/project/pymartini/
- Also on conda-forge at 0.6.0 (https://anaconda.org/conda-forge/pymartini), so it can go in the same conda env as GDAL: `conda install -c conda-forge pymartini`.
- It is a Cython port of Mapbox's JS Martini (RTIN meshing). README: https://github.com/kylebarron/pymartini

## API in brief (from the README)

```python
from pymartini import Martini, rescale_positions
martini = Martini(513)                 # grid_size must be 2^k + 1. Slowest step; make it once and reuse.
tile = martini.create_tile(terrain)    # float32 only, shape (513, 513) or flat 513*513
vertices, triangles = tile.get_mesh(max_error=0.5)   # metres if heights are metres
xyz = rescale_positions(vertices, terrain)            # adds the height as a third column
```

- `vertices`: shape (n, 2), **pixel coordinates** inside the tile.
- `triangles`: shape (m, 3), indices into `vertices`.
- `create_tile` raises an error unless the dtype is `np.float32`.
- **Axis order trap:** for a 2D array pymartini expects (columns, rows), so transpose first. `rescale_positions` must get the exact same array object passed to `create_tile`, or the mesh comes out scrambled (README, issue #15). Do the transpose once, store it, pass that to both.
- `rescale_positions(..., bounds=[minx, miny, maxx, maxy])` can rescale x,y to metres; `flip_y=True` flips rows. Without `bounds`, x,y stay as pixel indices, which at 1 m pixels are already metres.
- One `Tile` can produce several meshes at different `max_error` values cheaply (reuse it for two levels of detail).
- README benchmark for a 257 grid: init 14.9 ms, create tile 5.9 ms, mesh at max_error=30 about 1 ms. A 4 km area at 1 m is about 250 times more pixels, so expect seconds, not minutes.

## Grid size rules

- Every tile must be **2^k + 1** pixels per side: 257, 513, 1025, 2049, 4097.
- Neighbouring tiles share their edge row/column. So tiles step by 2^k, not 2^k + 1.
- For a 4 km area: crop **4,097 x 4,097** m (not 4,000) and cut **8 x 8 tiles of 513**, stepping 512. Change the `-te` box in 01 to 4,097 m wide.
- One single 4097 tile is possible but the `Martini(4097)` setup grows with the grid (it precomputes every triangle in the full hierarchy, roughly 33 million for 4097). 513 tiles keep memory small and let the browser cull and load per tile.

## Error thresholds

`max_error` is the largest vertical gap allowed between the mesh and the real heights, in metres.

| Use | Suggested `max_error` | Why |
|---|---|---|
| Walk mode, tiles near the astronaut | 0.25 to 0.5 m | Eye height is about 1.7 m, so a 1 m error is a visible bump |
| Walk mode, far tiles | 1 to 2 m | Far away, one pixel covers metres |
| Plan mode / Training overview | 2 m | Seen from above |

These are starting points. Measure vertex counts on Saturday; aim for under about 1 million triangles in view for a standalone headset (04). The DTM's own vertical precision is not stated on its landing page or in its LPSC abstract, so don't claim sub-metre accuracy on slides.

## Chunking

```python
N, STEP = 513, 512
martini = Martini(N)
for ty in range(8):
    for tx in range(8):
        h = dem[ty*STEP : ty*STEP + N, tx*STEP : tx*STEP + N]      # rows, cols
        t_in = np.ascontiguousarray(h.T, dtype=np.float32)          # pymartini wants (cols, rows)
        tile = martini.create_tile(t_in)
        v, tri = tile.get_mesh(max_error=0.5)
        xyz = rescale_positions(v, t_in)                             # [x_px, y_px, height]
        # world: X = tx*STEP + x_px - originX, Y = height - originH, Z = ty*STEP + y_px - originZ
```

- After transposing, check which of `x_px`, `y_px` is the column on one known peak before shipping. Easy to get swapped.
- **Cracks between tiles.** RTIN keeps the four corners but not every edge vertex, so two neighbours can split their shared edge differently and leave thin gaps. Fixes, easiest first: same `max_error` on both sides (reduces gaps but doesn't remove them); add a "skirt" (a strip of triangles hanging 2 to 5 m down along each tile edge, hides gaps from above and at eye level); or force edge vertices by building the mesh with `max_error=0` along borders (not supported by the API, so skip).
- **No-data:** the DTM has no-data cells (-3.4028227e+38 in the original). Replace them before meshing (nearest valid value or the crop's median), or one bad cell creates a spike kilometres deep.

## Binary format and loading in Three.js

One `.bin` per tile, little-endian:

| Offset | Type | Content |
|---|---|---|
| 0 | Uint32 | vertex count `nV` |
| 4 | Uint32 | triangle count `nT` |
| 8 | Float32 × 3nV | positions x, y, z (local metres, origin subtracted) |
| 8 + 12nV | Uint16 or Uint32 × 3nT | indices. Uint16 if `nV ≤ 65,535`, else Uint32 |
| optional | Int8 × 3nV | normals from the full-res DTM (see below) |

Writing in Python: `np.array([nV, nT], '<u4').tobytes() + xyz.astype('<f4').tobytes() + tri.astype('<u2' or '<u4').tobytes()`.

Loading:

```js
const buf = await (await fetch(`/tiles/${tx}_${ty}.bin`)).arrayBuffer();
const dv = new DataView(buf);
const nV = dv.getUint32(0, true), nT = dv.getUint32(4, true);
const pos = new Float32Array(buf, 8, nV * 3);
const idxOffset = 8 + nV * 12;                       // always a multiple of 4, so Uint32Array is safe
const idx = nV > 65535 ? new Uint32Array(buf, idxOffset, nT * 3) : new Uint16Array(buf, idxOffset, nT * 3);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setIndex(new THREE.BufferAttribute(idx, 1));
geo.computeVertexNormals();
geo.computeBoundingSphere();                         // needed for frustum culling per tile
```

- Typed arrays need aligned offsets (Float32/Uint32 at multiples of 4). The layout above keeps that.
- Python `<u2`/`<u4`/`<f4` and `DataView(..., true)` are both little-endian. Browsers are little-endian in practice, so the typed-array views read correctly.
- **Normals:** `computeVertexNormals()` on a simplified mesh gives blocky light and visible seams at tile edges, because each tile only sees its own triangles. Better: compute normals in Python from the full 1 m DTM (`np.gradient`), sample at each vertex, store as Int8 × 3, and load with `new THREE.BufferAttribute(new Int8Array(...), 3, true)` (normalized). Contours and slope outlines in 04 depend on good normals.
- Vercel and most static hosts gzip or brotli `.bin` only if told to; heights compress well. Check response headers on Saturday.

## Alternative if pymartini misbehaves

The same README describes Delatin (Delaunay refinement) as the other common algorithm: fewer triangles for the same error and works on any grid size, but slower. JS version: https://github.com/mapbox/delatin. A plain regular grid (every 2nd or 4th pixel) also works and has no cracks; 1025 x 1025 vertices per 4 km at 4 m spacing is about 2 million triangles.
