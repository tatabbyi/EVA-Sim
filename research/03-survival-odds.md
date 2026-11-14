# 03 Survival Odds: what to randomise

Each of the 1,000 runs walks the planned route and then the walk home, with one random draw per variable per run (except the event counts, which are drawn along the way). A run "survives" if the astronaut gets back with at least the 30-minute reserve left.

## Summary table

| # | Variable | Distribution | Range | Main source |
|---|---|---|---|---|
| 1 | Metabolic multiplier | Lognormal, median 1.0, σ = 0.12 | Clip 0.7 to 1.5 | Apollo crew averages 200 to 300 kcal/h around 234 |
| 2 | Terrain and suit factor | Triangular (1.0, 1.15, 1.5) | 1.0 to 1.5 | Apollo 14 traverse vs model |
| 3 | Walking speed multiplier | Triangular (0.7, 0.9, 1.1) | 0.7 to 1.1, cap at 1.3 m/s | Apollo 14: 2.4 km/h vs 3.3 planned |
| 4 | Suit leak, normal | Uniform | 0 to 0.035 L/min | EMU spec maximum |
| 5 | Suit leak, failure | Bernoulli, p = 0.005 per EVA (assumption), leak 0.5 to 2 L/min | | No public rate found |
| 6 | Dust devil encounters | Poisson | Mean about 3 per midday EVA | Perseverance MEDA, 4.9 vortices per sol |
| 7 | Falls | Poisson, 0.15 per hour of task time | Delay 0.5 to 2 min each | Apollo 16: 6 falls |
| 8 | Injury after a fall | Bernoulli, p = 0.02 per fall (assumption) | Speed × 0.6 for the rest of the run | |
| 9 | Comms loss | Deterministic from viewshed, plus random relay outage | | NASA Joint AR ConOps |

Fixed (not random): usable O₂ 390 L, reserve = 30 min at the current rate.

## 1. Metabolic multiplier

Scales the whole cost formula from 02 for that run (one person on one day).

- Apollo lunar EVAs: average 234 kcal/h across all crewmen. Lowest crew-EVA averages were "approximately 200 kcal/h", highest average 300 kcal/h (Apollo 11 LMP). So individual averages sit about ±25% around the mean.
- Peaks of 350 to 450 kcal/h came on "steep uphill walking traverses" and carrying the ALSEP pallet. The slope term in 02 already covers this, so don't add it again here.
- Over all 1/6-g and zero-g EVAs, rates ranged from 100 to 500 kcal/h.

Lognormal with σ = 0.12 puts 95% of runs between 0.79 and 1.27. It is always positive and has a longer high tail, which matches people working harder than planned more often than easier.

Source: Waligora JM, Horrigan DJ. Metabolic cost of extravehicular activities. NASA, 1975. https://ntrs.nasa.gov/citations/19750006325 (PDF: https://ntrs.nasa.gov/api/citations/19750006325/downloads/19750006325.pdf)

## 2. Terrain and suit factor

The 02 model is for smooth ground. The same Waligora report says the Apollo 14 walking traverses covered **2.9 km at 2.4 km/h and 300 kcal/h**. That is 0.125 kcal/m (26 L O₂ per km) on the Moon, against 0.088 kcal/m in the 02 model on flat Mars ground. The Apollo 14 route included the climb towards Cone crater, so not all of that 42% gap is roughness.

Triangular (1.0, 1.15, 1.5): most runs a little worse than smooth ground, a few runs as bad as Apollo 14 on top of the slope cost. The suit factor range from 02 (1.6 to 2.5) is folded in here rather than drawn separately, to avoid stacking two correlated factors.

## 3. Walking speed multiplier

- Apollo 14 crews averaged 2.4 km/h. The Apollo walk-back plan assumed 3.3 km/h. Ratio 0.73.
- Waligora: "very poor correlation between traverse rate and metabolic rate". Crews kept a comfortable effort and their speed changed with terrain. So model speed as the thing that varies, not effort.
- Cap at 1.3 m/s (Mars walk-to-run switch, already in the brief).

Speed only affects O₂ through the resting term in 02 (time spent walking). Its bigger effect is on the clock: a slow run may hit the EVA time limit or the reserve.

## 4 and 5. Suit leak

- Normal leak: NASA specification maximum for the EMU is 0.035 L/min at 760 mmHg and 21.1 °C (as cited in an Aerospace Medicine and Human Performance paper on EMU carbon monoxide modelling, which used 0.01 L/min as a realistic value). Source: https://meridian-asma-published.prime-prod-local.pubfactory.com/downloadpdf/view/journals/amhp/90/2/article-p84.pdf (the PDF blocked scripts; figures taken from its search abstract).
- In O₂ terms that is at most 2.1 L/h, under 4% of walking use (about 60 L/h from 02). **So normal leakage barely moves the odds.** Worth saying on a slide: the risk is in big failures and in work rate, not in slow leaks.
- Failure: no public per-EVA rate for large suit leaks. Use p = 0.005 per EVA with a 0.5 to 2 L/min leak, and label it as an illustrative assumption in the UI.

## 6. Dust devil encounters

- Jezero dust devil formation: 1.3 to 3.4 per km² per sol (Toledo et al. 2023, first 365 sols, MEDA radiation sensors) and 2.0 to 3.0 per km² per sol (Hueso et al. 2023).
- Diameters 5 to 135 m, mean 20 m (Hueso) or 29 m (Toledo). Devils over 100 m: 0.1 per km² per sol.
- Close passes at the rover: about **4.9 vortices per sol** with a pressure drop over 0.5 Pa (Hueso, over 415 sols). Activity peaks around noon.
- Suggested model: Poisson with mean 4.9 × (share of daily vortex activity inside the EVA window). For a 10:00 to 15:00 EVA, use about 0.6, so a mean of about 3 passes. Each dusty pass costs a 1 to 5 minute pause (shelter, visor) at resting O₂ rate. Most passes are weak vortices, not dusty devils, so make 1 in 3 dusty (assumption).
- **Don't oversell the danger.** Mars surface air density is about 0.016 kg/m³ (NASA fact sheet). A 20 m/s gust there pushes with ½ρv² = 3.2 Pa, against about 245 Pa for the same wind on Earth. Dust devils cost time and visibility, not knock-downs.

Sources:
- Toledo D. et al. 2023, JGR Planets 128, e2022JE007494. https://digital.inta.es:8443/jspui/bitstream/20.500.12666/868/1/JGR%20Planets%20-%202023%20-%20Toledo%20-%20Dust%20Devil%20Frequency%20of%20Occurrence%20and%20Radiative%20Effects%20at%20Jezero%20Crater%20%20Mars%20%20as%20Measured.pdf
- Hueso R. et al. 2023, JGR Planets. https://digital.inta.es:8443/jspui/bitstream/20.500.12666/883/1/JGR%20Planets%20-%202023%20-%20Hueso%20-%20Convective%20Vortices%20and%20Dust%20Devils%20Detected%20and%20Characterized%20by%20Mars%202020.pdf
- Mars density: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html

## 7 and 8. Falls and slowdowns

- Apollo 16: "During the three lunar EVAs of Apollo 16 six falls of the crewmen were recorded on the TV kinescopes." Two crew over about 20 hours of EVA, so roughly 0.15 falls per crew-hour.
- All six were while picking up objects or using the penetrometer. None while simply walking. So apply the fall rate to **task time** (Training mode science tasks, stops on the route), not to walking time.
- Recovery took seconds (one recovery logged at "about 6 seconds"). A 0.5 to 2 minute delay per fall is generous and covers checking the suit.
- Injury after a fall is the real risk. NASA treats falls as a key injury risk for Artemis (EVA injury evidence report: https://ntrs.nasa.gov/api/citations/20220004017/downloads/2021%20EVA%20Injury%20Evidence%20Report%20Final.docx.pdf). No public rate per fall. Use p = 0.02 per fall, speed × 0.6 afterwards, and label it as an assumption.

Source: Apollo 16 time and motion study, fall analysis section. https://ntrs.nasa.gov/api/citations/19730008098/downloads/19730008098.pdf

## 9. Comms loss

- Mostly deterministic: minutes the route spends in viewshed dead zones (07). Show this as a number, not a random draw.
- NASA's Joint AR ConOps walk-back scenario (section 5.1.6) has the crew look at a "line-of-sight communication coverage layer" and accept that on the direct path "they should expect to lose communications for approximately 10 minutes". So dead zones are a planning input, not an automatic abort.
- In the simulation, comms loss doesn't use O₂. It matters when another event (leak failure, injury) happens inside a dead zone: add the dead-zone time left as a decision delay before the walk home starts.
- Random relay outage: optional, small. No good public number for a surface-to-habitat link.

Source: https://ntrs.nasa.gov/api/citations/20230016622/downloads/JointAR_ConOps_RevA_2023-11-14_Final_Signed.pdf

## Fixed values

- **Usable O₂ 390 L.** Derived, not quoted: the EMU primary life support is rated 8 hours with a 30-minute backup (https://en.wikipedia.org/wiki/Extravehicular_Mobility_Unit). 8 h × 234 kcal/h ÷ 4.8 kcal/L = 390 L. Present it as "8 hours at the Apollo average rate".
- **Reserve: 30 minutes** at the current rate. Matches the Apollo walk-back reserve and the EMU 30-minute backup.

## How precise is "1,000 runs"?

The standard error of a success rate p from 1,000 runs is √(p(1−p)/1000). At p = 0.80 that is ±1.3 points; at p = 0.95 it is ±0.7. Show odds rounded to the nearest whole percent, or as bands (Safe above 95%, Marginal 80 to 95%, Unsafe below 80%).

Use a seeded generator (for example mulberry32 with the seed from a hash of the route) so the same route always shows the same odds. That avoids the number jumping during the demo.

## Sampling snippets (TypeScript)

```ts
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const lognormal = (r: () => number, sigma: number) => Math.exp(sigma * gauss(r));
const triangular = (r: () => number, a: number, c: number, b: number) => {
  const u = r(), f = (c - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
};
const poisson = (r: () => number, mean: number) => {
  let k = 0, p = 1; const L = Math.exp(-mean);
  do { k++; p *= r(); } while (p > L);
  return k - 1;
};
```
