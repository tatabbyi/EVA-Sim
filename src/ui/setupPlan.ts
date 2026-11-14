// Written with AI assistance (Claude).
// Owner: Rachel. Planning numbers for the Setup console: distance, time and O2 for an EVA plan.
// Walking uses the agreed cost model in research/02-walking-cost-model.md through src/sim/cost.ts (evaluateRoute),
// the same numbers the path planner (src/sim/pathfind.ts) optimises.

import type { XZ } from '../shared/coords';
import { evaluateRoute } from '../sim/cost';

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
  const { totals } = evaluateRoute(points, heightAt, terrainFactor);
  return { metres: totals.dist, seconds: totals.seconds, litres: totals.o2 };
}
