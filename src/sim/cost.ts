// Written with AI assistance (Claude). Owner: Nanda. Contract: TEAM-PLAN.md 2.6, formula in research/02. Must match
// pipeline/cost.py. Suited walk on Mars, smooth ground: 0° 0.088, 10° 0.171, 20° 0.298 kcal/m.
// tanSlope = grade in the walking direction (rise / horizontal run), positive uphill.

export const TERRAIN_FACTOR = 1.15; // rough ground vs the smooth formula (Apollo 14 gap; meta.json o2.terrainFactor)
export const MAX_GRADE = 0.45; // Minetti 2002 measured ±0.45 (about 24°): steeper is extrapolation, so impassable
export const KCAL_PER_LITRE_O2 = 4.8;

/** m/s: Tobler's hiking function rescaled to Apollo's 3.3 km/h on the flat. */
export const speedMps = (t: number) => 1.092 * Math.exp(-3.5 * Math.abs(t + 0.05));

/** kcal per horizontal metre: Minetti slope curve, Mars gravity, suit factor 2.0, plus resting cost. */
export function kcalPerMetre(t: number): number {
  const cw = ((((280.5 * t - 58.7) * t - 76.8) * t + 51.9) * t + 19.6) * t + 2.5;
  return 0.03585 * (1.825 + 0.38 * (cw - 2.5)) + 0.021 / speedMps(t);
}

export const o2LitresPerMetre = (t: number) => kcalPerMetre(t) / KCAL_PER_LITRE_O2;

export interface RouteSegment { dist: number; tanSlope: number; kcal: number; o2: number; seconds: number }
export interface RouteResult { segments: RouteSegment[]; totals: { dist: number; kcal: number; o2: number; seconds: number } }

type HeightAt = (x: number, z: number) => number;
let terrain: HeightAt | null = null, home: HeightAt | null = null;
/** Default terrain for evaluateRoute, and the O2-to-home lookup behind o2ToHomeAt (the planner registers it). */
export const setCostTerrain = (heightAt: HeightAt | null) => void (terrain = heightAt);
export const setHomeCost = (lookup: HeightAt | null) => void (home = lookup);

/** Walking cost along a polyline, sampled every 2 m; grades clamped to ±MAX_GRADE. kcal/o2 include the terrain factor. */
export function evaluateRoute(points: { x: number; z: number }[], heightAt = terrain, terrainFactor = TERRAIN_FACTOR): RouteResult {
  if (!heightAt) throw new Error('evaluateRoute: no terrain (call setCostTerrain or pass heightAt)');
  const segments: RouteSegment[] = [], totals = { dist: 0, kcal: 0, o2: 0, seconds: 0 };
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2), ds = Math.hypot(b.x - a.x, b.z - a.z) / n;
    for (let k = 1, hp = heightAt(a.x, a.z); k <= n; k++) {
      const h = heightAt(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n);
      const tanSlope = Math.max(-MAX_GRADE, Math.min(MAX_GRADE, (h - hp) / ds)), kcal = ds * kcalPerMetre(tanSlope) * terrainFactor;
      const s = { dist: ds, tanSlope, kcal, o2: kcal / KCAL_PER_LITRE_O2, seconds: ds / speedMps(tanSlope) };
      segments.push(s);
      for (const key of ['dist', 'kcal', 'o2', 'seconds'] as const) totals[key] += s[key];
      hp = h;
    }
  }
  return { segments, totals };
}

/** O2 from (x, z) to the airlock on the cheapest route, in the planner's unit (grams: the game plans with the physics).
 * Infinity if unreachable, NaN before the planner is ready. */
export const o2ToHomeAt = (x: number, z: number) => (home ? home(x, z) : NaN);
