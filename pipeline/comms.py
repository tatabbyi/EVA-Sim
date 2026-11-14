import numpy as np, rasterio

with rasterio.open(r"C:\data\vis_t0.tif") as ds:
    v = ds.read(1)[::2, ::2].astype("float64")   # 1 m to 2 m grid
    nd = ds.nodata
assert v.shape == (2049, 2049), v.shape
print("nodata value:", nd)
if nd is not None:
    v[v == nd] = np.inf          # unknown counts as dead
v[~np.isfinite(v)] = np.inf
print("min / median / max height needed:", v.min(), np.median(v), v[np.isfinite(v)].max())

# value = minimum height above ground that is visible from the lander antenna
comms = np.where(v < 0.01, 0, np.where(v <= 2.0, 1, 2)).astype("u1")
comms[1024, 1024] = 0            # the lander itself
comms.tofile("public/grids/comms.bin")
print("share visible / marginal / dead:", np.bincount(comms.ravel(), minlength=3) / comms.size)