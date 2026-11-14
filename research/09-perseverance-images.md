# 09 Perseverance raw images

## Answer first

- **Yes, there is a JSON API behind the gallery**, it is public, and it sends `Access-Control-Allow-Origin: *`, so the browser can call it directly.
- **Every image record has `site` and `drive`**, the same numbers the waypoints file uses (its `RMC` field is `"site_drive"`, e.g. `"93_0"`). That is the join key.
- The image files themselves (`.jpg`/`.png`) send no CORS header. Fine in an `<img>` tag; not usable as a Three.js texture unless copied into the site's static files.
- Credit comes in each record's `credit` field. Different per camera.

All checked on 14 Nov 2026. Total in the archive: 1,055,868 images; latest sol 2024 (30 Oct 2026).

## Endpoint

```
https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json
```

### Two query styles

**A. One whole sol** (easiest, use this):

```
...&sol=1000
...&sol=1000&search=%7CNAVCAM_LEFT
```

Returns `{ sol, num_images, type: "mars2020-images-1.1", most_recent, mission, images: [...] }`. All images for that sol in one response; `num` is ignored. Sol 1000: 385 images (151 + 151 Mastcam-Z, 33 Navcam Left, 26 Navcam Right, 16 SuperCam RMI...). With the camera filter: 33.

**B. Paged list across all sols:**

```
...&ver=1.2&num=50&page=0&order=sol+desc&search=%7CNAVCAM_LEFT&extended=sample_type%3A%3Afull%2C
```

Returns `{ per_page, total_results, type: "mars2020-images-list-1.1", page, mission, total_images, images }`. `order=sol+asc` / `sol+desc` works.

Gotchas:
- **Encode the `|` as `%7C`.** A raw `|` gives HTTP 400.
- **The `condition_1=1000:sol:gte&condition_2=...` filters seen in older blog posts are ignored now** (tested encoded and unencoded; still returned all 64,795 Navcam Left images). Use `&sol=N` instead.
- Camera filter goes in `search` with a leading `|`.

Camera ids confirmed in responses: `NAVCAM_LEFT`, `NAVCAM_RIGHT`, `MCZ_LEFT`, `MCZ_RIGHT`, `SUPERCAM_RMI`, `SKYCAM`, plus front and rear Hazcam ids (names start `FRONT_HA...` and `REAR_HAZ...`; read the exact strings from a `&sol=1000` response).

### Fields in each image

| Field | Example |
|---|---|
| `imageid` | `NLG_2024_0846620381_164ECM_N0930000NCAM00518_00_2I3J` |
| `sol` | 2024 |
| `site`, `drive` | 93, `"0"` (drive comes back as a string in some records) |
| `camera.instrument` | `NAVCAM_LEFT` |
| `image_files.small / medium / large / full_res` | `..._320.jpg`, `..._800.jpg`, `..._1200.jpg`, `.png` |
| `date_taken_utc`, `date_taken_mars` | `2026-10-30T08:44:57.868`, `Sol-02024M12:35:01.653` (LMST) |
| `extended.mastAz`, `extended.mastEl` | pointing of the mast, degrees |
| `extended.xyz` | position in the site frame, e.g. `(-61.5078,-305.907,-13.5767)` |
| `camera.camera_vector`, `camera_model_component_list` | CAHVORE camera model |
| `credit` | see below |
| `caption`, `title`, `link`, `json_link` | text and gallery page |

## Matching images to the traverse

Waypoints file (01): 708 features. Each has `RMC` (`"93_0"`), `site`, `drive`, `sol`, `lon`, `lat`, `elev_geoid`, `easting`, `northing`, `yaw`, `dist_total_m`, `Note`.

1. Exact match: image `(site, drive)` = waypoint `(site, drive)`.
2. If no exact match (images taken mid-drive), use the waypoint with the same `site` and the largest `drive` not above the image's drive.
3. Fallback: same `sol`, last waypoint of that sol.

`extended.xyz` gives the image's offset from the site origin in metres, if finer placement is wanted.

Simplest flow for Training mode: pick a waypoint near a checkpoint, then fetch `&sol=<waypoint.sol>&search=%7CNAVCAM_LEFT` and filter by `site`/`drive`.

### Panoramas already attached to waypoints

All 708 waypoints have an `images` entry with a Navcam cylindrical panorama, for example:

```json
{ "name": "Panorama", "isPanoramic": true,
  "url": "Layers/mosaics/N_LRGB_2022_RZS_0930000_CYL_L_AUTOGENJ04.jpg",
  "rows": "2180", "columns": "4101",
  "azmin": "11.45", "azmax": "170.354", "elmin": "-69.1358", "elmax": "15.3408" }
```

That suggests a full URL of `https://mars.nasa.gov/mmgis-maps/M20/Layers/mosaics/<file>`. A direct request to it returned **HTTP 403**, so it may only load from the NASA map viewer. Not pursued further. Open it in a normal browser on Saturday; if it loads, these panoramas would make a strong "what the rover saw here" moment in Walk mode (they include azimuth and elevation ranges, so they can be placed correctly).

## Licence and credit

NASA Images and Media Usage Guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/):
- NASA content "generally are not subject to copyright in the United States".
- "NASA content used in a factual manner that does not imply endorsement may be used without needing explicit permission."
- The insignia, logotype and NASA identifiers are protected by law. Matches the Space Apps rule: no NASA logos.

Credit as given in each record's `credit` field (from sol 1000):

| Camera | Credit |
|---|---|
| Navcam, Hazcams | NASA/JPL-Caltech |
| Mastcam-Z | NASA/JPL-Caltech/ASU |
| SuperCam RMI | NASA/JPL-Caltech/LANL/CNES/IRAP |
| SkyCam (MEDA) | NASA/JPL-Caltech/CAB |

Use the record's `credit` string next to each image rather than hard-coding one line.

Sources: the API responses above; gallery page https://mars.nasa.gov/mars2020/multimedia/raw-images/
