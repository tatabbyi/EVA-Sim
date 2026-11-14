// Owner: Nanda. Contract: TEAM-PLAN.md section 2.6, formula in research/02-walking-cost-model.md.
// Must match pipeline/cost.py. Test values (smooth ground): 0° 0.088, 10° 0.171, 20° 0.298 kcal/m.

export interface RouteSegment { dist: number; tanSlope: number; kcal: number; o2: number; seconds: number }
export interface RouteResult { segments: RouteSegment[]; totals: { dist: number; kcal: number; o2: number; seconds: number } }

export function kcalPerMetre(_tanSlope: number): number {
  throw new Error('kcalPerMetre: not implemented yet (Nanda)');
}

export function o2LitresPerMetre(_tanSlope: number): number {
  throw new Error('o2LitresPerMetre: not implemented yet (Nanda)');
}

export function evaluateRoute(_points: { x: number; z: number }[]): RouteResult {
  throw new Error('evaluateRoute: not implemented yet (Nanda)');
}

export function o2ToHomeAt(_x: number, _z: number): number {
  throw new Error('o2ToHomeAt: not implemented yet (Nanda)');
}
