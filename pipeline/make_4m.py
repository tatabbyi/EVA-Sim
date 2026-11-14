import json, os
import numpy as np, rasterio

with rasterio.open(r"C:\data\height_4m.tif") as ds:
    a = ds.read(1).astype("float32")
assert a.shape == (1025, 1025), a.shape

bad = (a == -9999) | ~np.isfinite(a) | (a < -1e6)
print("nodata cells:", int(bad.sum()))
if bad.any():
    from scipy import ndimage
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    a = a[tuple(idx)]

h0 = float(a[512, 512])          # height at the landing site (centre)
out = (a - h0).astype("<f4")
os.makedirs("public/grids", exist_ok=True)
os.makedirs("public/data", exist_ok=True)
out.tofile("public/grids/height_4m.bin")

meta = {
  "crs": "+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs",
  "origin": {"X": 4354489, "Y": 1093304, "lon": 77.4508, "lat": 18.4447, "h0": h0},
  "boxMetres": 4096,
  "home": {"x": 0, "z": 0},
  "grids": {
    "height_4m": {"file": "grids/height_4m.bin", "type": "float32", "n": 1025, "cell": 4},
    "height_2m": {"file": "grids/height_2m.bin", "type": "float32", "n": 2049, "cell": 2},
    "o2_to_home": {"file": "grids/o2_to_home.bin", "type": "float32", "n": 2049, "cell": 2},
    "comms": {"file": "grids/comms.bin", "type": "uint8", "n": 2049, "cell": 2}
  },
  "tiles": {"dir": "tiles", "count": 8, "samples": 513, "step": 512, "maxError": 0.5},
  "o2": {"usableLitres": 390, "reserveMinutes": 30, "terrainFactor": 1.15},
  "lander": {"antennaHeight": 3, "suitAntennaHeight": 2}
}
json.dump(meta, open("public/data/meta.json", "w"), indent=2)
print("h0 =", h0, " min/max after:", float(out.min()), float(out.max()))