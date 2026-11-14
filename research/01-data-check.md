# 01 Data check

Checked 14 November 2026, 00:00 to 00:30 Irish time.

## Link status

| Link | Status | Notes |
|---|---|---|
| Challenge page | Works in a browser, hard for scripts | Site serves an incomplete TLS certificate chain (missing the SSL.com intermediate), so curl and some fetch tools fail. Page text loads from `https://api.spaceappschallenge.org/graphql` via JavaScript, so a plain HTML fetch is an empty shell. |
| https://trek.nasa.gov/mars/ | 200 | |
| https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars | 200 | |
| https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/ | 200 | |
| https://mars.nasa.gov/mars2020/multimedia/raw-images/ | 200 | |
| https://worldview.earthdata.nasa.gov/ | 200 | Not used |
| DTM landing page (astrogeology.usgs.gov) | 200 | Blocks some bots (403 to WebFetch), fine in a browser and curl |
| DTM file (planetarymaps.usgs.gov) | 200 | Redirects to `https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif` |
| https://pubs.usgs.gov/publication/sim3464 | 200 | |
| M20_traverse.json | 200 | 1,723,218 bytes, updated 28 Oct 2026 |
| M20_waypoints.json | 200 | 603,126 bytes, updated 28 Oct 2026. 708 waypoints, last is sol 2022, 45.25 km total |
| NASA Joint AR ConOps PDF (NTRS) | 200 | |
| NASA PersEIDS (NTRS) | 200 | |
| https://ttu-ir.tdl.org/handle/2346/74208 | 403 to scripts, 202 with a browser user agent | Bot check. Open in a normal browser. |

**Neither traverse JSON sends an `Access-Control-Allow-Origin` header**, so the site cannot fetch them live from mars.nasa.gov. Copy them into the static files on Saturday (they are small).

## Jezero 1 m elevation model (DTM)

Read from the file header only with `gdalinfo /vsicurl/...` (no pixel data downloaded). GDAL 3.13.3.

| Property | Value |
|---|---|
| File size | 1,839,545,409 bytes (1.84 GB). Last modified 10 Nov 2022 |
| Format | GeoTIFF, single band, Float32, **stripped not tiled** (block 21400 x 1) |
| Size | 21,400 x 21,488 pixels |
| Pixel size | 1.0 m x 1.0 m (in projected units) |
| No-data value | -3.4028227e+38 (as reported by GDAL) |
| Projection | Equirectangular, Mars 2000 sphere: `+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs` |
| Origin (upper left) | x 4,577,366 m, y 1,106,618 m |
| Extent | Lon 77°13'22.56"E to 77°35'02.27"E (77.2229 to 77.5840). Lat 18°18'24.48"N to 18°40'09.53"N (18.3068 to 18.6693) |
| Area | About 21.4 km x 21.5 km in projected metres |
| Heights | Name says MOLA topography with a geoid correction ("DeltaGeoid"), so values are metres relative to the Mars areoid. Waypoints JSON uses `elev_geoid` on the same kind of datum (last waypoint -1,936 m). Confirm Saturday by sampling the DTM at a waypoint. |
| Licence | Landing page: "Access Constraints: None", "Use Constraints: Please cite authors". USGS products are US public domain. The page does not show a CC0 label, so cite it as public domain with attribution rather than claiming CC0. |
| DOI | https://doi.org/10.5066/P9REJ9JN |
| Citation | Fergason, R. L., Hare, T. M., Mayer, D. P., Galuszka, D. M., Redding, B. L., Smith, E. D., Shinaman, J. R., Cheng, Y., Otero, R. E., 2020, Mars 2020 Terrain Relative Navigation Flight Product Generation: Digital Terrain Model and Orthorectified Image Mosaics, 51st LPSC, https://www.hou.usra.edu/meetings/lpsc2020/pdf/2020.pdf |

Landing site (Octavia E. Butler, 18.4447°N, 77.4508°E) is at about column 13,507, row 13,314. Well inside the file.

Sources: https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_dtm_mosaic and the file header itself.

### Can `gdal_viewshed` use it directly?

It will run, but distances will be wrong. With `lat_ts=0`, a 1 m pixel at 18.45°N is really 1 m north-south but only cos(18.45°) = 0.949 m east-west on the ground. Viewshed and the cost grids would treat every pixel as 1 m square, so east-west distances come out about 5% too long. Reproject first.

Best target: equirectangular with standard parallel 18.4663°. That is exactly what the M20 waypoints JSON uses for its `easting`/`northing` fields (worked out from the file: easting / (lon x 59,274.7 m per degree) = 0.94851 = cos 18.4663°). Using the same projection means rover waypoints drop straight onto the grid with no conversion.

Note: the tool is `gdalwarp`, not `gdal_warp`.

```bash
# 4 km x 4 km crop centred on the landing site, true 1 m pixels.
# Landing site in the target projection (checked with gdaltransform):
#   x = 4,354,489   y = 1,093,304
gdalwarp \
  -t_srs "+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs" \
  -te 4352489 1091304 4356489 1095304 \
  -tr 1 1 -tap \
  -r bilinear \
  -srcnodata -3.4028227e+38 -dstnodata -9999 \
  -ot Float32 \
  -co TILED=YES -co COMPRESS=DEFLATE -co PREDICTOR=3 \
  -multi -wo NUM_THREADS=ALL_CPUS \
  JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif \
  jezero_4km_1m.tif
```

To move the box, get new centre coordinates with `echo "LON LAT" | gdaltransform -s_srs "+proj=longlat +R=3396190" -t_srs "<target string above>"`. Check the no-data value with `gdalinfo -stats` on the result.

Possible time saver (untested, it would count as processing so not tried tonight): run the same `gdalwarp` with the input as `/vsicurl/https://asc-pds-services.s3.us-west-2.amazonaws.com/...tif`. Because the file is stored in strips of one row each (85,600 bytes per row), GDAL should only fetch the rows it needs: roughly 4,200 rows, about 360 MB, instead of 1.84 GB. Worth trying first on venue Wi-Fi; fall back to the full download if it is slow.

## SIM 3464 geologic map

Citation: Sun, V., and Stack, K., 2020, Geologic map of Jezero crater and the Nili Planum region, Mars: U.S. Geological Survey Scientific Investigations Map 3464, pamphlet 14 p., 1 sheet, scale 1:75,000, https://doi.org/10.3133/sim3464

| File | Size | Format |
|---|---|---|
| https://pubs.usgs.gov/sim/3464/sim3464_database.zip | 349,336,873 bytes | Esri file geodatabase plus rasters. GDAL's OpenFileGDB driver reads it: `ogr2ogr -f GeoJSON units.geojson <gdb> GeoUnits_v1` |
| https://pubs.usgs.gov/sim/3464/sim3464.pdf | 36.4 MB | Map sheet with the Description of Map Units |
| https://pubs.usgs.gov/sim/3464/sim3464_pamphlet.pdf | 728 KB | Text |
| https://pubs.usgs.gov/sim/3464/sim3464_readme.txt | 4 KB | |
| sim3464_metadata.xml / .txt | 21 KB each | |

Projection of the GIS layers: Mars Transverse Mercator, central meridian 77.5°E, Mars 2000 sphere (R = 3,396,190 m). Needs reprojecting to match the DTM. Polygon layer for units is `GeoUnits_v1`. There is also a `LandingEllipse` layer.

**Watch out:** the readme says the map was drawn on a semi-controlled CTX mosaic and "will have random offsets of about 100-200 meters" from the controlled surface-operations mosaic. The DTM is a surface-ops product. So unit boundaries may sit 100 to 200 m off the terrain. Fine for "which unit is this task in" but don't present boundaries as exact. Source: https://pubs.usgs.gov/sim/3464/sim3464_readme.txt

### Units near the landing site

14 units in total. Four occur only inside Jezero (pamphlet p. 5):

- **Njf, Jezero floor unit.** The crater floor the rover landed on. Late Noachian.
- **Nle, lower etched unit.** Olivine-bearing. Exposed where Njf has eroded away at lat 18.44°N, long 77.44°E (pamphlet p. 8), about 1 km from the landing site. This matches the Séítah area Perseverance explored.
- **NHjf1, Jezero fan unit 1.** Older, lower fan deposit in the northwest of the crater floor.
- **NHjf2, Jezero fan unit 2.** The main delta on the western crater floor, with distinct lobes. The delta front is the most famous target.

Widespread units that also occur inside Jezero: Nue (upper etched, olivine-bearing, interpreted as ash fall), Nrb (rugged bright), su (smooth undivided, mantled), Aeb (eolian bedforms), and the crater units cr, ce, ci (rim, ejecta, interior).

For a 4 km box around the landing site, expect Njf, Nle, Aeb, su and small craters, with NHjf2 at the western edge. Confirm with the `GeoUnits_v1` polygons on Saturday.

Source: https://pubs.usgs.gov/sim/3464/sim3464_pamphlet.pdf
