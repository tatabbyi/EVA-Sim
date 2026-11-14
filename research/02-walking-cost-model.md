# 02 Walking cost model

## Answer first

Energy to walk 1 m on a slope of θ degrees, suited, on Mars:

```
E(θ) [kcal/m] = 0.03585 × ( 1.825 + 0.380 × (Cw(tan θ) − 2.5) ) + 0.0210 / v(θ)

Cw(i)  = 280.5 i⁵ − 58.7 i⁴ − 76.8 i³ + 51.9 i² + 19.6 i + 2.5      (J per kg per m, Minetti 2002)
v(θ)   = 1.092 × exp(−3.5 × |tan θ + 0.05|)                          (m/s, Tobler shape scaled to Apollo's 3.3 km/h on the flat)
O₂ [L] = kcal / 4.8
```

θ is positive uphill, negative downhill, in the direction of travel.

| Slope | i = tan θ | Cw (Earth, J/kg/m) | Speed | kcal per m | O₂ per 100 m | O₂ per km | kcal/h |
|---|---|---|---|---|---|---|---|
| −10° | −0.176 | 0.97 | 0.70 m/s | 0.075 | 1.6 L | 15.5 L | 188 |
| 0° | 0 | 2.50 | 0.92 m/s | **0.088** | **1.8 L** | **18.4 L** | 292 |
| 10° | 0.176 | 7.14 | 0.50 m/s | **0.171** | **3.6 L** | **35.6 L** | 304 |
| 20° | 0.364 | 13.57 | 0.26 m/s | **0.298** | **6.2 L** | **62.1 L** | 275 |

So a 20° climb costs about 3.4 times the oxygen per metre of flat ground.

**Sanity check against Apollo.** Apollo walk-back planning used 3.3 km/h and an average of 234 kcal/h, which is 0.071 kcal/m or 14.8 L O₂ per km. This model gives 0.088 kcal/m on the flat, about 25% higher. That is the safe direction for a walk-back limit, and Mars gravity is more than double the Moon's.

**But real Apollo walking cost more.** On Apollo 14 the crew walked 2.9 km at an average 2.4 km/h and 300 kcal/h (Waligora and Horrigan 1975, https://ntrs.nasa.gov/citations/19750006325). That is 0.125 kcal/m, 42% above this model's flat value, on rough ground that included the climb towards Cone crater. So the formula is a smooth-ground baseline. 03 adds a terrain factor of 1.0 to 1.5 in the Monte Carlo. For the deterministic Leash line, multiply by 1.15.

## Where each piece comes from

### 1. Slope curve: Minetti et al. 2002

Minetti AE, Moia C, Roi GS, Susta D, Ferretti G. Energy cost of walking and running at extreme uphill and downhill slopes. J Appl Physiol 93: 1039–1046, 2002. Free PDF: https://journals.physiology.org/doi/pdf/10.1152/japplphysiol.01177.2001

- Equation 1 in the paper: `Cw_i = 280.5i⁵ − 58.7i⁴ − 76.8i³ + 51.9i² + 19.6i + 2.5` (R² = 0.999). Checked against the PDF. (Some search tools quote 155.4 as the first coefficient. That is the running equation, `Cr_i`.)
- Units J per kg body mass per metre. **Net** cost: measured O₂ minus resting O₂ (paper p. 1040). So resting cost has to be added back separately, which is the `0.0210 / v` term.
- Valid for gradients −0.45 to +0.45 (about ±24°). Measured at each subject's cheapest speed.
- Lowest cost is at about −0.10 (−6°): 0.81 J/kg/m. At +0.45 it is 17.33 J/kg/m. Gentle downhill is cheaper than flat; steep downhill gets expensive again (3.46 at −0.45).

Why Minetti and not Pandolf: Pandolf (1977, J Appl Physiol 43: 577–581) is built for loaded soldiers at walking speed and only handles uphill. Downhill needs the separate Santee et al. correction. Minetti covers up and down in one smooth curve, which matters because the walk home is often downhill.

### 2. Mars gravity

Mars mean surface gravity = 3.73 m/s², 0.380 of Earth (9.80) (NASA Mars fact sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html).

Split Cw into a flat part (2.5) and a slope part (Cw − 2.5), and scale them differently:

- **Slope part × 0.380.** Climbing cost is mostly lifting body weight, which scales directly with g. Same logic for the downhill saving.
- **Flat part × 0.73.** Farley and McMahon (1992, J Appl Physiol 73: 2709–2712, https://doi.org/10.1152/jappl.1992.73.6.2709) found that cutting gravity by 75% cut the energy rate of walking by only 33%. Interpolating linearly to Mars (62% cut) gives a 27% saving, so 0.73. Grabowski, Farley and Kram (2005, J Appl Physiol 98: 579–583, https://doi.org/10.1152/japplphysiol.00734.2004) found the saving from less body weight is smaller than Farley and McMahon's, so 0.73 is on the conservative (higher cost) side.

### 3. Suit factor × 2.0

NASA's suited slope tests (Norcross et al. 2010, NASA/TP-2010-216125, Mark III suit, 121 kg, 29.6 kPa, lunar gravity) found that for inclined walking "the baseline shirtsleeve metabolic cost accounted for approximately 50% independent of grade" (p. 82). So suited ≈ 2 × unsuited at the same gravity, and the factor does not change much with slope. Suit pressure was a minor contributor; extra weight mattered mainly at grades of 20% and steeper.

Source: https://ntrs.nasa.gov/api/citations/20110003409/downloads/Norcross%20et%20al%202010%2C%20Metabolic%20costs%20%26%20biomech%20of%20inclined%20ambulation%20%26%20exploration%20tasks%20in%20a%20planet%20suit.pdf

The same report fits a regression, `VO₂ = b0 + b1·(speed × grade) + b2·shank + b3·shoulder + b4·pressure + b5·suit mass`, but the coefficients are not printed in the text and it was only tested at lunar gravity. Not usable directly.

Caveat: the test used the POGO suspension rig at 1/6 g. A Mars suit at 0.38 g carries more weight per step, so 2.0 may be low. Use 1.6 to 2.5 in the Monte Carlo (see 03).

### 4. Resting cost and speed

- Resting: 1 MET = 3.5 mL O₂ per kg per minute (standard definition, Compendium of Physical Activities: https://pacompendium.com/). For 75 kg that is 0.26 L/min, 88 W, 76 kcal/h. Divided by speed gives J per metre.
- Speed: Tobler's hiking function, `6 × exp(−3.5 × |tan θ + 0.05|)` km/h (Tobler 1993, "Three presentations on geographical analysis and modeling", NCGIA Technical Report 93-1; summary at https://en.wikipedia.org/wiki/Tobler%27s_hiking_function), rescaled so the flat speed is Apollo's planned 3.3 km/h. This makes the resting term grow on steep ground, where you move slowly.

### Constants used

`0.03585` = suit factor 2.0 × body mass 75 kg ÷ 4184 J/kcal.
`1.825` = 2.5 × 0.73 (flat cost on Mars).
`0.380` = Mars/Earth gravity.
`0.0210` = 88 W resting ÷ 4184.
`1.092` m/s = 3.3 km/h ÷ 3.6 ÷ exp(−0.175).

Rescale the first constant for a different body mass: 0.03585 × (mass / 75).

## Limits and decisions for the team

- **Cap slope at 24°.** Minetti's data stops at ±0.45. Above 25°, treat terrain as impassable for the Leash. Steep extrapolation blows up (30° gives 0.58 kcal/m).
- **Cost depends on direction.** Uphill and downhill differ a lot, so the walk-home cost is not the same as the walk-out cost. This affects the choice of shortest-path tool. See 07.
- **Smooth slope before using it.** A 1 m DTM slope is noisy. Compute slope over 3 to 5 m before feeding the formula.
- This model ignores loose sand, rocks and suit cooling limits. Fine for a hackathon if said out loud on the slide.

## TypeScript form (for reference on Saturday)

```ts
const cw = (i: number) => 280.5*i**5 - 58.7*i**4 - 76.8*i**3 + 51.9*i**2 + 19.6*i + 2.5;
const speed = (t: number) => 1.092 * Math.exp(-3.5 * Math.abs(t + 0.05));          // m/s, t = tan θ
const kcalPerM = (t: number) => 0.03585 * (1.825 + 0.380 * (cw(t) - 2.5)) + 0.0210 / speed(t);
const o2LitresPerM = (t: number) => kcalPerM(t) / 4.8;
```
