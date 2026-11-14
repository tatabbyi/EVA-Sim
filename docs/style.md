# EVA Sim style guide

Owner: Rachel. Colours live in `src/ui/palette.ts` only. CSS gets them as `--c-*` variables (call `applyPaletteToCss()` once at startup); shaders get them as uniforms. Don't hard-code colours anywhere else.

Preview everything at `/#preview`: click to look, WASD to walk, Shift to run, E to accept an alert.

## The look

- **World:** the real Jezero terrain under a starry night sky. Ground colour looks are switchable (Look panel > Terrain > ground colours, `terrainPresets` in `palette.ts`): **The Martian** (default, after the film's palette), Realistic Mars, Pastel, Mars ochre, Topographic map, Sandstone, Thermal. Each repeats with height so even the flat crater floor shows variation, with contour lines on top (thin every 1 m, bold every 5 m) and close-up surface detail (bumps and grit) that fades with distance. Relief shading exaggerates slopes in the lighting (not the geometry), so the topography reads clearly; adjustable. Steep ground (20° to 25°) gets a muted red tint.
- **Helmet:** you're inside a realistic NASA-style bubble helmet: a wide dome opening, the world seen through it with a gentle fisheye curve and slight colour fringing at the edges (`src/terrain/visorLens.ts`, desktop only), a thick clear rim catching light, and suit hardware at the chin as real 3D objects inside the helmet (`src/terrain/helmetInterior.ts`): foam microphone on a boom, white valve caps, connector, green and black cables, yellow drink tube, foam pad, cream neck ring. Cream/beige suit fabric (`--c-helmet`, `#e6dcc8`): lit woven base with soft folds and quilted padding over the whole lining, out of focus because it's centimetres from the eye. No gasket where the glass meets it: the padding rolls into a soft sewn edge with a shadow in the fold. A cream neck ring at the bottom, a faint gold sun-visor tint at the top, dust, smudges, blurry reflections and breath fog on the glass.
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
| Top-left | "OBJECTIVES 1/4" and "RETURN 42:10", the total time left to get back to base (yellow under 5 min, red under 1 min). Under it, one line per objective with its own timer: the current one counts down from its budget (yellow under 1 min, red with "+0:12" once over), the ones to come show their budget, done ones show ✓ and the time taken. All bend along the glass edge | Always |
| Top, under the rim | Alert, e.g. "⚠ CYCLONE / Switch waypoint to home? [E]", kept out of the line of sight | Only during a danger. [E] accepts: the astronaut decides |
| Right side | Two glass-tube bars, O₂ (blue) and temperature (red), parallel to the right edge: segmented glowing gradient fill, tick marks, a shimmer flowing up the fill and a glowing level marker. Driven by `fraction`, so they rise and fall with the data | Always |

Inside the helmet at the bottom, in front of the seal: the 3D chin hardware (white valve caps, foam microphone on a boom, connector, green and black cables, yellow drink tube, foam pad, top of the neck ring). It has its own transparent layer between the helmet frame and the HUD text (`src/terrain/helmetInterior.ts`).

The visor opening follows a real EVA helmet seen from inside (NASA's EMU and the Apollo visor assembly it grew from: a clear bubble with a visor shell over it): a round dome over the top that sits just above the screen (look up and it comes into view), near-straight sides at the temples, the round visor pivot hubs a little below eye level, then the opening tapers diagonally into a U at the chin. The gold sun visor is partly lowered: a gold band across the top of the view with a soft edge. The cream padded helmet shows in the corners, and the view softens towards the edge like thick curved glass. Where you look moves the helmet in view: a hard helmet doesn't tilt with your head, so looking up brings its top edge and gold visor into view and looking down shows more of the chin hardware (`src/ui/headSway.ts`, `setPitch`). The HUD text and bars follow their own guide curve inside the opening, so they stay readable.

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

- **Ground:** "The Martian" colours by height with blue (cyan) contour lines glowing on top (Look panel > ground colours has the others). Dust haze fades the far plain into the butterscotch sky. Loose angular rocks with dusty tops fill in around you as you walk (`src/terrain/rockField.ts`); the base, rocks, tools and hands cast real sun shadows (`src/terrain/shadows.ts`). The sun is small, as seen from Mars, with a blue-white glow.
- **Path, two versions:** `#preview` puts cyan hologram chevrons in the world every 6 m (they fade as you reach them and hide while you work). `?outline=glass#preview` draws the path on the visor instead: a thin cyan line and flat arrow marks projected onto the glass, the same width at any distance, never hidden by hills (`src/ui/glassPath.ts`). **O** switches between them. On the way home a new path is built from where you stand to the airlock.
- **Objectives:** rock core sample (kneel, the corer drills), laser scan of a boulder (SuperCam-style), 360° panorama from a marker (`src/terrain/tasks.ts`). Your gloves are thick and padded like real insulated EVA gloves: pillowy hand, fat fingers, flared gauntlet, bulging sleeve rings (`src/terrain/suitArm.ts`).
- **Base:** habitat drum with dome, windows, ladder and tanks; airlock with hatch, steps, handrails and floodlights; greenhouse with grow lights; solar field; ascent lander with gold foil and engine bell; comms mast; pressurised rover. Panels with seams, rivets and red dust low down. Built from modules so it can be expanded later (`src/terrain/base.ts`).

## The base and the Setup console

The EVA starts standing inside the habitat, helmet off (`src/terrain/baseInterior.ts`): the same 8 m drum as outside, with the console deck at the back (main monitor, two angled side screens with base status and surface conditions, a backlit keyboard), the airlock hatch at the front (stencilled sign, green ready light), an EVA suit on its stand by the hatch, lockers, a ladder up to a ceiling hatch (the upper floor comes with the base expansion) and a window out onto the plain. WASD walks you round (walls and furniture stop you); a crosshair and a short prompt say what you can do with what you're looking at. Click the console screen to sit down (the view eases into the seat and the Setup screen comes up); Esc, the ✕ or SAVE PLAN stand you up again. **E at the hatch** suits you up and takes you out, if the plan fits; otherwise it tells you why. `?demo=console` starts seated at the console.

The Setup screen sits on the main monitor as real HTML, sharp and clickable (`src/ui/SetupConsole.tsx`), following the whiteboard:

- **Left third, MISSIONS:** each objective with its time budget, walking distance from the airlock and the O₂ the work itself takes. Click to pick or drop it; hovering highlights it on the map. Done ones are ticked off.
- **Left third, LEVELS:** O₂ PLAN (walking out and back, plus the work, plus the 30-minute reserve, against the 390 L suit tank), TIME (against the 45-minute EVA), BASE O₂ STORE, RECOVERED · LAST EVA (what the suit brought back and what the base's O₂ plant made). Then **SAVE PLAN** (stands you up), with "Plan ready" in green, or the reason the plan doesn't fit.
- **Right two thirds:** a top-down map of the real terrain in the same colours and blue contours as the 3D world, with hill shading, the route (the planned part bright), numbered objectives, the base, a scale bar and north.

Walking numbers come from research/02 (`src/ui/setupPlan.ts`) until Nanda's `evaluateRoute` replaces them. Going out fills the suit from the base store and puts you at the airlock with only the picked objectives out there and the path trimmed to the furthest one. Back at the airlock, **E** goes inside, just inside the hatch (any time after the first 30 s; "WELCOME BACK" when you've finished). The suit's leftover O₂ returns to the store.

## Visor fog

Run too long and the suit can't keep up: heat and moisture outrun the air flow that keeps the glass clear. A milky fog with fine droplets grows in a round patch from in front of your mouth, like breath on a window, blurring and greying the view behind it; at about half way the HUD says "⚠ VISOR FOGGING / Slow down to let it clear", and breathing gets faster and heavier. Running fogs it in about 20 s (the warning comes at about 11 s); walking clears it slowly, working on an objective faster, standing still fastest (about 10 s from fully fogged). Running also burns O₂ three times as fast, so overdoing it costs both. `?demo=fog` holds it fogged to judge the look; the Look panel has a "set visor fog" slider.

## Sound (`src/audio/suitAudio.ts`)

All generated in the browser; starts on the first click; **M** mutes. Mars air is about 1% as dense as Earth's, so outside sound is faint and low. Perseverance's microphones recorded soft wind gusts and the SuperCam laser as clicks.

- Inside the suit: fan and air flow, breathing (faster with effort), and a small valve puff on each exhale, in time with a small patch of fog on the visor. Suits blow air across the visor to keep it clear, so the fog is small and clears fast.
- Through the body, muffled: footsteps, landing from a jump, the corer drilling.
- Outside, faint: wind, stronger during the cyclone alert.
- Tools and HUD: laser clicks, camera shutter for the panorama, a soft ping at an objective, a chime when one is done, a two-tone warning for the cyclone.
