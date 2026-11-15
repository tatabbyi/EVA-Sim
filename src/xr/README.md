# WebXR headset mode (Owner: Nanda)

Code: `xrRig.ts` (rig, controllers, floating HUD, tutorial). Notes: research/04 (WebXR). No post-processing in VR;
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
| Click the left stick | Show the controls again | — |

Plan the EVA before entering VR: the Setup console is a page overlay a headset can't show. A two-objective plan is
already set, so you can walk to the hatch and press A.

Tested: `tests/xr-controls.test.mjs` checks every control above with Quest Touch controllers in the WebXR
xr-standard layout. The A/X action sends the same E key press the desktop uses, so it reaches the same handlers.
