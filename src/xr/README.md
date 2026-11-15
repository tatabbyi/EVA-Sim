# WebXR headset mode (Owner: Nanda)

Code: `xrRig.ts` (rig, controllers, laser, tutorial), `vrHud.ts` (the helmet HUD rebuilt in 3D: a curved visor band with
the same objectives, alert, O₂ and BODY bars and compass as the web HUD, fed from the same props), `vrConsole.ts` (the
Setup console drawn on the base monitor, with the same plan, map, planner, physics and Survival Odds) and `vrWorld.ts`
(everything else the desktop draws on the page: helmet interior and rim, visor fog and breath, the AR target marker,
the glass path line 160 m ahead, the base aiming dot). Notes: research/04 (WebXR). No post-processing in VR;
outlines live in `src/terrain/material.ts`.

## Using it

Open the site in the Meta Quest Browser and press **ENTER VR** (the button only appears where a headset is available).
A short controls tutorial opens in front of you; press **A** to close it.

| Control | What it does | Desktop key |
|---|---|---|
| Left stick | Walk where you look | W A S D |
| Grip (either hand) | Move faster | Shift |
| Right stick | Turn 30° per flick | mouse |
| A / X or trigger | Act: start a task in range, accept an alert, suit up at the hatch, go inside at the airlock | E |
| Hold B / Y | Fast-forward time | F |
| Click the right stick | Jump | Space |
| Click the left stick | Show the controls again | — |
| A at the console, then point with the laser | Plan: tick two objectives, Save plan; path style, topology, sound | click, O, T, M |

The console opens on the monitor when you press A while looking at it, and closes on Save plan / the back arrow, or
when you walk away.

Tested: `tests/xr-controls.test.mjs` checks every control above with Quest Touch controllers in the WebXR
xr-standard layout. The A/X action sends the same E key press the desktop uses, so it reaches the same handlers.
