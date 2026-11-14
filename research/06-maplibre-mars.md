# 06 MapLibre and Mars Trek tiles

## Answer first

- **Yes, there is a good Jezero imagery layer and browsers can load it.** Mars Trek layer "MRO HiRISE, Jezero Mosaic, Controlled", 25 cm per pixel, same extent as our DTM. Tiles return `Access-Control-Allow-Origin: *`.
- **But Trek tiles are plate carrée (lon/lat grid), and MapLibre's normal maps are Web Mercator.** Pointing a plain raster source at Trek puts tiles in the wrong place. Three ways round it, below. Recommended: a small custom protocol that re-cuts Trek tiles into Web Mercator tiles in the browser.

## The layer

| Item | Value |
|---|---|
| Title | MRO HiRISE, Jezero Mosaic, Controlled |
| Layer id | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` |
| Extent | lon 77.2229331 to 77.583964, lat 18.3067994 to 18.669315 |
| WMTS capabilities | https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml |
| Tile URL | `https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/{z}/{row}/{col}.png` |
| Format | PNG, 256 x 256, greyscale + alpha |
| Levels | 0 to 17. Level 0 is 2 x 1 tiles covering the planet, so a tile at level L spans 180/2^L degrees. Level 17 is about 0.32 m per pixel at Mars scale. |
| CRS | `urn:ogc:def:crs:EPSG::104905` (Mars 2000 geographic) |
| CORS | `Access-Control-Allow-Origin: *` (checked with an `Origin` header) |
| Test tile over the landing site | https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm/15/13026/46867.png (200, 56,849 bytes) |

Note the order in the URL: **row before column**, which is `{z}/{y}/{x}`.

Other Jezero layers on Trek: "MRO CTX, Jezero Mosaic, Controlled" (`JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`, 6 m, a bit wider: lon 77.16 to 77.70, lat 18.21 to 18.72). Good as a zoomed-out base under the HiRISE layer.

How this was found: Trek's own layer search endpoint, `https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?...` (146 Mars layers), then `https://trek.nasa.gov/mars/TrekServices/ws/index/getLayerServices?uuid=ad8d2800-e66e-4f4b-9a85-d377164d3a4e` for the endpoint. Trek API docs: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars

## MapLibre version

- **maplibre-gl 6.18.0**, released 11 Nov 2026 (6.0.0 was 22 Jul 2026). Source: https://registry.npmjs.org/maplibre-gl
- Custom protocol API: `addProtocol(name, async (params, abortController) => ({ data }))`, where `data` can be an `ArrayBuffer`, `ImageBitmap` or `HTMLImageElement` (from the 6.18.0 type definitions).

## Option 1 (recommended): Web Mercator map, re-cut Trek tiles in a custom protocol

Why it works: Trek level `z − 1` tiles have exactly the same longitude width and column numbers as Web Mercator zoom `z` tiles (both are 360/2^z degrees wide, starting at −180). Only the latitude rows differ. So each Mercator tile needs one or two Trek tiles from the same column, stretched vertically.

```ts
import maplibregl from 'maplibre-gl';

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/default/default028mm';
const mercLat = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI;

maplibregl.addProtocol('trek', async (params, abort) => {
  const [z, x, y] = params.url.slice('trek://'.length).split('/').map(Number);
  const L = z - 1, deg = 180 / 2 ** L;                     // Trek level and tile height in degrees
  const north = mercLat(y, z), south = mercLat(y + 1, z);
  const canvas = new OffscreenCanvas(256, 256);
  const ctx = canvas.getContext('2d')!;
  for (let r = Math.floor((90 - north) / deg); r <= Math.floor((90 - south) / deg); r++) {
    const res = await fetch(`${TREK}/${L}/${r}/${x}.png`, { signal: abort.signal });
    if (!res.ok) continue;
    const img = await createImageBitmap(await res.blob());
    const top = 90 - r * deg;                                // this Trek tile's north edge
    const y0 = (north - top) / (north - south) * 256;
    const y1 = (north - (top - deg)) / (north - south) * 256;
    ctx.drawImage(img, 0, y0, 256, y1 - y0);
  }
  return { data: canvas.transferToImageBitmap() };
});
```

Within one tile the stretch is treated as linear in latitude. At zoom 10 and above (a tile is under 0.35° tall) the error is well under a pixel. That's why the source below starts at `minzoom: 10`.

Minimal style:

```json
{
  "version": 8,
  "sources": {
    "hirise": {
      "type": "raster",
      "tiles": ["trek://{z}/{x}/{y}"],
      "tileSize": 256,
      "minzoom": 10,
      "maxzoom": 18,
      "bounds": [77.2229, 18.3068, 77.5840, 18.6693],
      "attribution": "HiRISE: NASA/JPL-Caltech/University of Arizona. Mosaic: USGS. Tiles: NASA Mars Trek"
    }
  },
  "layers": [
    { "id": "space", "type": "background", "paint": { "background-color": "#111111" } },
    { "id": "hirise", "type": "raster", "source": "hirise" }
  ]
}
```

Start view: `center: [77.4508, 18.4447], zoom: 15`. Add the CTX layer the same way (second protocol name or a `?layer=` in the URL) with `minzoom: 8` underneath.

## Option 2 (experimental): MapLibre custom CRS, no re-cutting

MapLibre 6 has `addProjection({ name, projection, tileMatrixSet })`, marked `@experimental` in the 6.18.0 types. "Every tile source of such a map is taken to be cut in the quad tile grid described by `tileMatrixSet`, and the map does not reproject tile content." A Mars plate carrée CRS would be roughly:

```ts
maplibregl.addProjection({
  name: 'custom:mars-eqc',
  projection: { forward: ([lng, lat]) => [lng, lat], inverse: ([x, y]) => [x, y] },
  tileMatrixSet: { origin: [-180, 90], extentAtZoom0: 360 },
});
// style: { version: 8, projection: { type: 'custom:mars-eqc' }, ... }
```

With a 360° zoom-0 tile, MapLibre zoom `z` lines up with Trek level `z − 1`, so a protocol is still needed just to subtract 1 from `z` (simpler than Option 1).

Not recommended for the hackathon: it's experimental and three days old, and the types say GeoJSON sources (our routes, Leash outline, dead zones) need a CRS `definition` string plus a worker-side projection handler, "Without it, GeoJSON sources warn and draw in the wrong place."

## Option 3 (fallback): one pre-made image

Stitch the area once on Saturday and show it as an `image` source. GDAL can read Trek directly through its WMTS driver:

```bash
gdal_translate -of JPEG -q 85 \
  -projwin 77.42 18.47 77.48 18.42 -outsize 4096 0 \
  "WMTS:https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml" \
  jezero.jpg
```

```json
"jezero-img": {
  "type": "image",
  "url": "/img/jezero.jpg",
  "coordinates": [[77.42, 18.47], [77.48, 18.47], [77.48, 18.42], [77.42, 18.42]]
}
```

MapLibre stretches the image between the four corners. Over a few kilometres the difference between plate carrée and Mercator is far below a pixel. Untested tonight (it would mean processing data); the GDAL WMTS driver is documented at https://gdal.org/drivers/raster/wmts.html.

## Gotchas for any option

- **MapLibre thinks it's Earth.** Lon/lat positions are fine, but anything in metres uses Earth's radius (6,371 km) instead of Mars (3,396.19 km for the DTM sphere). Distances come out 1.88 times too long. Don't use the built-in `ScaleControl`. Measure route lengths in the projected DTM grid, or with a haversine using R = 3,396,190 m.
- Trek tiles outside the mosaic come back transparent or missing. The `bounds` in the source stops MapLibre asking for them.
- Credit line: HiRISE images are NASA/JPL-Caltech/University of Arizona; the controlled mosaic is USGS (01). Use the attribution field rather than any NASA logo.
