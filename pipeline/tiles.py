import json, os
import numpy as np, rasterio
from scipy import ndimage
from pymartini import Martini, rescale_positions

N, STEP, SKIRT, MAXERR = 513, 512, 3.0, 0.5
h0 = json.load(open("public/data/meta.json"))["origin"]["h0"]
with rasterio.open(r"C:\data\jezero_1m.tif") as ds:
    dem = ds.read(1).astype("float32")
assert dem.shape == (4097, 4097), dem.shape
bad = (dem == -9999) | ~np.isfinite(dem) | (dem < -1e6)
print("nodata cells:", int(bad.sum()))
if bad.any():
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    dem = dem[tuple(idx)]
dem = dem - h0
gz, gx = np.gradient(dem)

os.makedirs("public/tiles", exist_ok=True)
martini = Martini(N)
for ty in range(8):
    for tx in range(8):
        h = dem[ty*STEP:ty*STEP+N, tx*STEP:tx*STEP+N]
        t_in = np.ascontiguousarray(h.T, dtype=np.float32)
        v, tri = martini.create_tile(t_in).get_mesh(max_error=MAXERR)
        xyz = rescale_positions(v, t_in)
        a, b = v[:, 0].astype(int), v[:, 1].astype(int)
        if np.allclose(h[b, a], xyz[:, 2], atol=1e-3):
            col, row = a, b
        elif np.allclose(h[a, b], xyz[:, 2], atol=1e-3):
            col, row = b, a
        else:
            raise SystemExit(f"tile {tx}_{ty}: vertex heights don't match the DEM")
        gc, gr = tx*STEP + col, ty*STEP + row
        pos = np.stack([gc - 2048, h[row, col], gr - 2048], 1).astype("<f4")
        nrm = np.stack([-gx[gr, gc], np.ones(len(gc)), -gz[gr, gc]], 1)
        nrm = (nrm / np.linalg.norm(nrm, axis=1, keepdims=True) * 127).round().astype("i1")

        edges = [(col == 0, row), (col == N-1, row), (row == 0, col), (row == N-1, col)]
        new, extra, nv = {}, [], len(pos)
        for mask, key in edges:
            ids = np.where(mask)[0]
            ids = ids[np.argsort(key[ids])]
            for i in ids:
                if i not in new:
                    new[i] = nv + len(new)
            for p, q in zip(ids[:-1], ids[1:]):
                extra += [[p, q, new[q]], [p, new[q], new[p]]]
        src = np.array(list(new.keys()), dtype=int)
        low = pos[src].copy(); low[:, 1] -= SKIRT
        pos = np.concatenate([pos, low]); nrm = np.concatenate([nrm, nrm[src]])
        tri = np.concatenate([tri, np.array(extra, dtype=tri.dtype)]) if extra else tri

        nV, nT = len(pos), len(tri)
        itype = "<u2" if nV <= 65535 else "<u4"
        with open(f"public/tiles/{tx}_{ty}.bin", "wb") as f:
            f.write(np.array([nV, nT], "<u4").tobytes())
            f.write(pos.tobytes())
            f.write(tri.astype(itype).tobytes())
            f.write(nrm.tobytes())
        print(f"{tx}_{ty}: {nV} vertices, {nT} triangles")