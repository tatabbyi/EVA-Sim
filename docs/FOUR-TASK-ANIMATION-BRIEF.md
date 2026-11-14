# Sharkies — Four EVA Tasks: Animation Brief

**For:** 3D artists and animation teammates  
**Status:** Visual production brief · 14 November 2026  
**Scope:** Four **separate** task animations. **No gameplay, physics, mission rules, UI programming, or final timing requirements in this file.**

The astronaut lands on Mars in a shuttle, takes the tools needed for the mission, and performs **two randomly chosen tasks out of the four below**. Every task must make sense **on its own**: there is no required Abrade → Core sequence, and Sample Depot does not require Take a Core in the same mission. The player sees the world in **first person**, with Rachel's helmet HUD.

## 1. Abrade a Rock
**Visual goal:** Remove the weathered outer surface of a rock to reveal fresh material beneath.

- **Visible assets:** Rock with an outer weathered layer, handheld abrasion/grinding tool, fresh exposed patch.
- **Suggested action:** Astronaut positions the tool against the rock → abrasive head spins/rubs the surface → small dust/rock particles appear → an approximately circular, visually distinct fresh patch is revealed → tool is lifted away.
- **End image:** Rock remains in place with a clearly visible abraded patch; the tool is still available to bring back to the shuttle.
- **Important:** This is **surface abrasion**, not extracting a cylindrical core. It must be a standalone animation.

## 2. Take a Core
**Visual goal:** Drill a cylindrical rock core, collect it and secure it for transport.

- **Visible assets:** Rock target, **drill/coring tool**, cylindrical core, sample tube/container.
- **Suggested action:** Position drill → engage and rotate the bit into rock with light debris → withdraw tool with visible rock core → place core into a tube/container → seal and stow the sample.
- **End image:** A visibly collected/sealed sample is carried by the astronaut, and the drill remains available for the return journey.
- **Important:** This must work **without a prior Abrade a Rock task**. An abrasion patch may exist aesthetically, but must not be a required start state.
- **Existing starting point:** Rachel's current `src/terrain/sampleSite.ts` (in the synced preview branch) already animates a combined coring/stowing sequence. It is a *reference/prototype*, **not** an instruction to combine both standalone tasks.

## 3. Sample Depot
**Visual goal:** Place previously collected, **sealed sample tube(s)** on the Martian ground for later retrieval.

- **Visible assets:** Sealed sample tube(s), astronaut's carrying pouch/container, visible surface placement area.
- **Suggested action:** Astronaut takes a sealed tube from storage → kneels/reaches toward a suitable patch of ground → places the tube carefully → releases it and withdraws the hand/tool.
- **End image:** The tube **stays on the ground** as a recognizable deposited sample; it is no longer visibly carried.
- **Important:** The astronaut may have brought the sealed tubes **from the shuttle**, so no core-drilling animation is a prerequisite. For multiple tubes, the same placement animation should be reusable at different positions.

## 4. Run MOXIE
**Visual goal:** Deploy and operate a **portable science device** that demonstrates oxygen production from Martian atmospheric CO₂.

- **Visible assets:** A **portable, fictionalized MOXIE-inspired unit**, visible intake/vent or instrument features, a simple light or readout indicating experiment progress.
- **Suggested action:** Astronaut retrieves/positions the unit → sets it up on the ground or another stable support → activates it → indicator/readout communicates that the instrument is running and producing oxygen as an **experiment** → shuts it down → packs it back up.
- **End image:** The portable equipment is ready to be carried **back to the shuttle**.
- **Important:** **MOXIE does not refill the astronaut's suit O₂**. Do not show a hose refilling the backpack/tank or a magic oxygen recharge. Real Perseverance MOXIE was **rover-mounted**; portability is our gameplay adaptation, not a claim about NASA's actual hardware.

## Visual handoff checklist

- **One distinct animation per task**, not one generic work animation reused for all four.
- Each should read clearly at **first-person/close camera distance**, matching Rachel's existing stylized Mars terrain, visor and palette where practical.
- Show a recognizable **before → action → after** result; keep task props and the important result visible.
- Prefer reusable motions and independently positionable props on terrain. The astronaut should not depend on a particular rock, camera location or the historical Jezero origin.
- **Do not assume fixed durations, detailed rig/skeleton specifications, file formats or exact hardware dimensions**; the team must agree on those at asset handoff.
- Provide a short preview of each animation and identify its required 3D props. If producing scene/animation files, keep task assets separately named so they can be integrated without bringing in demo-only game logic.
- The shuttle's landing/takeoff uses **separate short cutscenes**; it is **not** one of these four animations.

**References:** `research/10-training-tasks.md` (historic task background), `src/core/contracts.ts` (four actual TaskId strings), [`docs/integration/RACHEL-VISUALS.md`](integration/RACHEL-VISUALS.md) (scene/animation handoff), and Rachel's `src/terrain/sampleSite.ts` (existing combined visual prototype).

> **Boundary for animators:** Make the **visual actions and assets**. Alex handles task selection, timing, inventory/mass, physics, resources, success/failure and integration with the engine.
