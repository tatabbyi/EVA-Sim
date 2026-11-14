import json
import numpy as np, rasterio
from scipy import ndimage

h0 = json.load(open("public/data/meta.json"))["origin"]["h0"]  # same h0 as the 4 m grid
with rasterio.open(r"C:\data\jezero_2m.tif") as ds:
    a = ds.read(1).astype("float32")
assert a.shape == (2049, 2049), a.shape
bad = (a == -9999) | ~np.isfinite(a) | (a < -1e6)
print("nodata cells:", int(bad.sum()))
if bad.any():
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    a = a[tuple(idx)]
out = (a - h0).astype("<f4")
out.tofile("public/grids/height_2m.bin")
print("min/max:", float(out.min()), float(out.max()), " centre:", float(out[1024, 1024]))