# Rachel research — preserved findings and independent physics audit

**Purpose:** represent Rachel's original work accurately, with credit, before deciding what is scientifically justified for Sharkies. **No edits to her original `research/**` or `src/ui/**` / `src/terrain/**` files.** Reference: [ARCHIVED-SOURCE-MAP.md](ARCHIVED-SOURCE-MAP.md). Original audit: `docs/alex-core/12-RACHEL-PHYSICS-AUDIT.md` on the archived branch.

## A. What Rachel actually researched
1. `research/02-walking-cost-model.md`: suited energy-per-metre estimate on signed slopes, synthesizing Minetti (2002) Earth treadmill Cw polynomial, Tobler-style preferred speed, Mars gravity scaling, approximate suited x2 factor and resting power. It yields 0.088335 kcal/m on level ground, 0.171097 at +10 degrees and 0.298094 at +20 degrees (her model arithmetic; not observed Mars suited metabolism). The original separate running polynomial is not represented by Cw.
2. `research/03-survival-odds.md`: design of a Monte Carlo experiment with distributions for human metabolic variation, terrain multiplier, leak, dust-devil encounter, fall delays, comms outages and sample size. It explicitly labels some rare-event rates as **assumptions** (e.g. 0.005 per EVA large leak). It once proposed stock 390 L + 30min reserve; these are **NOT** a calibrated suit tank or the current approved gram resource model.
3. `research/07-viewshed-and-costs.md`: direction-dependent graph weighting/Dijkstra, alternatives in scikit-image, Mars radio-line-of-sight using GDAL, precomputed return-cost grids and raster sampling. Old calculated O2 fields are in **litres** and route criteria differ from the new reverse-route concept.
4. `research/08-mars-time.md`: Earth date -> Mars solar time, Jezero sun elevation/azimuth, light delay; library and licensing notes. This is valuable for later sun/presentation realism, **not implemented by the 3h physics demo**.
5. `research/10-training-tasks.md`: seven real rover activities, action durations and historical references. Current game's **four independent tasks** supersede the suggested seven; original MOXIE-as-refill is not an approved mechanic.
6. `src/terrain/material.ts`: visuals/shader for relief, contours, coloring, optional slope warning and optional litre-based O2 "Leash". Visual computations **do not automatically implement** scientifically valid human metabolic cost or gas policy.

## B. The original formula and its exact provenance
~~~text
i = tan(theta)
Cw(i)=280.5*i^5 - 58.7*i^4 - 76.8*i^3 + 51.9*i^2 + 19.6*i + 2.5
v(i)=1.092 * exp(-3.5 * abs(i + 0.05))
E(i)=0.03585 * (1.825 + 0.380*(Cw(i)-2.5)) + 0.0210/v(i)  // kcal/m
oxygenEquivalent(i)=E(i)/4.8                                   // old L/m convention
~~~
- Minetti et al. (2002), DOI **10.1152/japplphysiol.01177.2001**, supplies the **Earth treadmill** walking cost curve (and separate running cost). It did **not** derive Rachel's complete Mars formula.
- The remaining factors reflect **Rachel's composite engineering adaptation**, including 75kg reference subject, reduced-gravity approximation, suit factor and resting energy.
- Retroactive calibration of these factors using a recent paper must be **proposed and reviewed**, not attributed to Rachel as if she originally used the new NASA source.
- NASA N04 (Norcross 2010), N05 (Waligora 1974) and N03 (NASA JSC 2025 traverse research) are relevant *independent analogs*, but none certifies the combined expression as a Mars EVA law.
- Old values: -10deg **0.074563**, 0deg **0.088335**, +10deg **0.171097**, +20deg **0.298094 kcal/m**. Use only as regression against the old model.

## C. Audit issue register — all 16 inherited findings
| ID | Severity / concern | Consequence and disposition |
| --- | --- | --- |
| AUD-01 | Blocker: no implemented metabolic engine | `src/sim/cost.ts` exports four throwing placeholders; implement **Alex-owned pure domain physics**; do not overwrite Nanda's module |
| AUD-02 | Blocker: O2 units mixed | Legacy `390 L` Leash cannot be gram-based stock; keep old shader feature disabled |
| AUD-03 | Blocker: walk-only formula used for user sprint | Suit fast motion must be modeled separately, with calibrated/assumed rates and unit tests |
| AUD-04 | High: payload mass erroneously treated as a simple multiplier | Separate mechanical mass/inertia from suit mobility and metabolic penalty |
| AUD-05 | High: Mars gravity and x2 suit cost are extrapolations | Cite limitations and use named scenario factors, not NASA validation claim |
| AUD-06 | High: optimal-to-home path isn't the reversed flown/walked route | Keep route-policy question open; cannot badge return as safe from an unrelated grid |
| AUD-07 | High: resting cost potentially double counted | Total W per activity; integration once per simulated second |
| AUD-08 | High: survival odds rates are assumptions | No numeric "NASA survival probability" from an invented leak/dust event distribution |
| AUD-09 | High: MOXIE research vs new game rules | Real device rover-mounted; game portable science experiment **not oxygen refill** |
| AUD-10 | Medium: shader 20/25 deg warnings not a physically validated gait limit | Use shader for visuals, separate labeled scenario mobility gate |
| AUD-11 | Medium: storm visibility and rock-to-visor impacts conflated | Do not claim thin-atmosphere wind has Earth-like ability to throw rocks into visor |
| AUD-12 | Medium: game clock tied to FPS in possible approaches | Use existing authoritative fixed-step 60Hz engine; do not run physics from RAF/HUD |
| AUD-13 | High: legacy grid clamping outside coverage | Use RAW `HeightProvider` strict null semantics; no edge clamping in physics |
| AUD-14 | High: non-finite bilinear interpolation | Check every sampled neighbour; reject NaN/no-data before grade calculations |
| AUD-15 | High: fixed-grid shader and future randomized region conflict | Current fixed Jezero demo only; dynamic region manifest requires owner-coordinated interfaces |
| AUD-16 | Medium: MOXIE electrical watts conflated with astronaut metabolic watts | Instrument power is not respiration; charge astronaut workload separately |

**This is a summary, not a replacement of the full archived audit.** The original contains source links, tests and rationale for every issue.

## D. Numerical and conceptual discrepancies to preserve
- Prior Rachel "O2 L per metre" is an **equivalent standard gas volume** derived via energy; our current suit telemetry is O2 **mass (g)**. Their identity is not known without volume reference conditions; do not swap labels.
- Prior Rachel 390L/30min Leash budgets came from scenario modeling, not a certified suit supply. Current nominal suit stock 750g + reserve 150g is likewise **fictional scenario**, but dimensions are explicit.
- Rachel's older `research/03` probability examples do not justify life risk estimates; "1000 Monte Carlo trials" does not make assumed input distributions real data.
- Original `research/07` reverse-graph Dijkstra is useful for a cost-to-shuttle map; because walking uphill/downhill differs, graph edge reversal is essential. But cost-to-home along shortest route and "same outward route reversed" are distinct return policies.
- Rachel's original sun/time, communications and thermal assumptions are future candidate features; **not part of current NASA-data-driven demo physics**.

## E. Human/team ownership
- Rachel's art/shaders/HUD/visual animation remain hers and are unchanged.
- Alex's additive adapters read authoritative `EngineSnapshot` and provide factual HUD props, using physical units.
- Nanda's route-cost module is independent and must not be rewritten using Rachel's formula without discussion.
- Victor's 2m/4m meshes and data format are independent of metabolic formula; only `HeightProvider` is physics input.
- To present research to judges, credit Rachel for the researched synthesis and state **which NASA primary sources were directly verified** in `NASA-DATA-AND-PRIMARY-SOURCES.md`.
