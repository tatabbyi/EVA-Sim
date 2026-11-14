import numpy as np
from skimage.io import imsave

c = np.fromfile("public/grids/comms.bin", dtype="u1").reshape(2049, 2049)
rgb = np.zeros((2049, 2049, 3), "u1")
rgb[c == 0] = (60, 200, 90)     # visible
rgb[c == 1] = (240, 200, 40)    # marginal
rgb[c == 2] = (200, 50, 50)     # dead
imsave(r"C:\data\comms.png", rgb)