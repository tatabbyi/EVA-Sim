# EVA Sim style guide

Owner: Rachel. Colours live in `src/ui/palette.ts` only. CSS gets them as `--c-*` variables (call `applyPaletteToCss()` once at startup); shaders get them as uniforms. Don't hard-code colours anywhere else.

Preview everything at `/#preview`: click to look, WASD to walk, Shift to run, E to accept an alert.

## The look

- **World:** the real Jezero terrain under a starry night sky. Ground colour looks are switchable (Look panel > Terrain > ground colours, `terrainPresets` in `palette.ts`): **The Martian** (default, after the film's palette), Realistic Mars, Pastel, Mars ochre, Topographic map, Sandstone, Thermal. Each repeats with height so even the flat crater floor shows variation, with contour lines on top (thin every 1 m, bold every 5 m) and close-up surface detail (bumps and grit) that fades with distance. Relief shading exaggerates slopes in the lighting (not the geometry), so the topography reads clearly; adjustable. Steep ground (20° to 25°) gets a muted red tint.
- **Helmet:** you're inside a realistic NASA-style bubble helmet: a wide dome opening, the world seen through it with a gentle fisheye curve and slight colour fringing at the edges (`src/terrain/visorLens.ts`, desktop only), a thick clear rim catching light, and suit hardware at the chin as real 3D objects inside the helmet (`src/terrain/helmetInterior.ts`): foam microphone on a boom, white valve caps, connector, green and black cables, yellow drink tube, foam pad, cream neck ring. Cream/beige suit fabric (`--c-helmet`, `#e6dcc8`): lit woven base with soft folds, quilted padding above, twill side panels, double stitched seams round the visor and an EV1 crew patch that's out of focus because it's centimetres from the eye, a solid dark rubber seal where the glass meets it (nothing shows through the joint), a cream neck ring at the bottom, a faint gold sun-visor tint at the top, dust, smudges, blurry reflections and breath fog on the glass.
- **UI:** translucent glass panels (blurred, thin bright edge), one colour per suit reading. Nothing on screen that isn't needed.

## Colours

| Use | Variable | Hex |
|---|---|---|
| Sky | `--c-space` | `#02030a` |
| Contour lines and outlines | `--c-line` | set per ground look (default `#3b2418`) |
| Steep ground (20° to 25°) | `--c-steep` | `#d9483b` |
| Leash line / beyond the Leash | `--c-leash-limit` | `#ff3b30` |
| Approaching the Leash | `--c-leash-warn` | `#ffd60a` |
| Comms marginal / dead (hatched) | `--c-comms-marginal` / `--c-comms-dead` | `#ffd60a` / `#bf5af2` |
| Waypoint | `--c-waypoint` | `#64d2ff` |
| Objective (marker and current objective text) | `--c-objective` | `#ffd60a` |
| Cyclone (dust devil) | `--c-cyclone` | `#d9a066` |
| HUD text / dim text | `--c-hud` / `--c-hud-dim` | `#f2f7ff` / `#a9b8c9` |
| Glass panel fill / edge | `--c-glass` / `--c-glass-edge` | 10% / 35% pale blue |
| Danger / warning / ok | `--c-danger` / `--c-warning` / `--c-ok` | `#ff3b30` / `#ffd60a` / `#30d158` |

Ground colour looks live in `terrainPresets` (`src/ui/palette.ts`); default **Realistic Mars**: `#8a5a3c`, `#a86d45`, `#c08a5b`, `#b07850`, `#9a6545`, `#c79a6e`, `#7d5236`, repeating every 6 m, contour lines `#3b2418`. Pastel keeps Rachel's palette (`#EBAFAF`, `#FFC2AA`, `#FAD5B3`, `#FBF6D2`, `#E2ECC0`). The default ramp is also available as `--terrain-ramp` for a legend.

### Suit readings: one colour each

| Reading | Variable | Hex |
|---|---|---|
| O₂ | `--c-o2` | `#0a84ff` blue |
| Temperature | `--c-temperature` | `#ff453a` red |
| Pressure | `--c-pressure` | `#bf5af2` purple |
| Radiation | `--c-radiation` | `#30d158` green |
| Atmosphere / dust | `--c-atmosphere` | `#64d2ff` cyan |

The value text turns yellow (warning) or red and the bar blinks (danger) regardless of the reading's own colour.

## HUD layout (`src/ui/HelmetHud.tsx`)

Everything is drawn on the curved visor glass: no boxes, light glow, and text and bars bend along the edge of the glass they sit next to. The whole helmet sways with your head (`src/ui/headSway.ts`): when you move the mouse the head turns first and the helmet lags, then settles; walking bobs it, running more.

| Where | What | When |
|---|---|---|
| Top-left | Objectives "3/14", mission time left ("TIME 42:10", yellow under 5 min, red under 1 min) and the current objective, as text bending along the glass edge | Always |
| Top, under the rim | Alert, e.g. "⚠ CYCLONE / Switch waypoint to home? [E]", kept out of the line of sight | Only during a danger. [E] accepts: the astronaut decides |
| Right side | Two glass-tube bars, O₂ (blue) and temperature (red), parallel to the right edge: segmented glowing gradient fill, tick marks, a shimmer flowing up the fill and a glowing level marker. Driven by `fraction`, so they rise and fall with the data | Always |

The visor edge: rounded, with a solid rubber seal (dark, slight sheen on the inner lip) between the glass and the cream helmet, and the view softens towards the edge like thick curved glass.

## Type

- System sans (Inter if installed), tabular numbers.
- Labels: uppercase, letter-spaced, small, in the reading's colour or `--c-hud-dim`.
- Values: bold, `--c-hud`.
- Key prompts: a key cap (`<kbd>`), e.g. **E**.

## Rules

- Never rely on colour alone: the Leash is also a solid line; danger also blinks; alerts have a title and icon.
- Respect `prefers-reduced-motion`: pulsing and blinking switch off.
- No NASA logos, flags or mission identifiers. Any AI-generated image gets a visible watermark.
- Outlines and contours stay in the terrain shader (no post-processing; it breaks in VR).

## World objects

- **Path:** solid 3D yellow chevrons every 6 m, hovering about 35 cm up, bobbing and gliding forward, each with a ground shadow. Arrows you've passed disappear; on the way home a new path is built from where you stand (`src/terrain/routePath.ts`).
- **Rock samples:** you kneel beside the rock; your gloved hands (cream EVA gloves, grey grip pads, metal wrist rings) hold the corer while it drills (`src/terrain/sampleSite.ts`).
