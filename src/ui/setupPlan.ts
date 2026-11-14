// Written with AI assistance (Claude).
// Owner: Rachel. Planning numbers for the Setup console: distance, time and O2 for an EVA plan.
// Walking uses the agreed cost model in research/02-walking-cost-model.md (Minetti 2002 slope cost, suit factor 2.0,
// Mars gravity, Tobler speed rescaled to Apollo's 3.3 km/h). When Nanda's evaluateRoute (src/sim/cost.ts) is ready,
// swap walkCost for it; the numbers should then match the Leash.

import type { XZ } from '../shared/coords';

const cw = (i: number) => 280.5 * i ** 5 - 58.7 * i ** 4 - 76.8 * i ** 3 + 51.9 * i ** 2 + 19.6 * i + 2.5;
const speed = (t: number) => 1.092 * Math.exp(-3.5 * Math.abs(t + 0.05)); // m/s, t = tan(slope)
const kcalPerM = (t: number) => 0.03585 * (1.825 + 0.38 * (cw(t) - 2.5)) + 0.021 / speed(t);
const o2LitresPerM = (t: number) => kcalPerM(t) / 4.8;

/** O2 while doing each kind of objective, litres per minute in the suit (about 2x shirtsleeve, research/02). */
export const TASK_O2_PER_MIN: Record<string, number> = {
  core: 1.2, // kneeling and drilling: hard work
  laser: 0.6, // standing and aiming
  panorama: 0.5, // turning slowly on the spot
  abrade: 1.1, // kneeling, pressing a grinder into rock
  depot: 0.8, // kneeling, placing a tube
  moxie: 0.5, // standing by while it runs
};
/** Resting in the suit, litres per minute (1 MET x suit factor 2), used for the reserve. */
export const REST_O2_PER_MIN = 0.52;

export interface Leg {
  metres: number;
  seconds: number;
  litres: number;
}

/** Walking cost along a path, sampled every 2 m; slope capped at 24 degrees like the Leash (research/02). */
export function walkCost(points: XZ[], heightAt: (x: number, z: number) => number, terrainFactor = 1.15): Leg {
  const leg: Leg = { metres: 0, seconds: 0, litres: 0 };
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / 2));
    const ds = len / n;
    let hPrev = heightAt(a.x, a.z);
    for (let k = 1; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
      const h = heightAt(x, z);
      const t = Math.max(-0.45, Math.min(0.45, (h - hPrev) / ds));
      hPrev = h;
      leg.metres += ds;
      leg.seconds += ds / speed(t);
      leg.litres += ds * o2LitresPerM(t) * terrainFactor;
    }
  }
  return leg;
}
