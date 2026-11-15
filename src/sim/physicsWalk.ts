// Written with AI assistance (Claude). Owner: Nanda.
// The engine's physics (Alex's src/core/physics.ts) as a walking-cost model for the path planner and Survival Odds,
// so routes are ranked, and odds counted, in the same grams of O2 the suit actually spends in the game.
// Grade = rise / horizontal run in the walking direction (uphill positive).

import { activityResponse, gramsPerHour, type MarsEVAEngineeringProfile } from '../core/physics.ts';
import type { CostModel, XZ } from './pathfind.ts';

export interface PhysicsWalk extends CostModel {
  /** Seconds to walk one horizontal metre at this grade. */
  secondsPerMetre(grade: number): number;
  /** O2 grams per minute standing still (idle power) and doing a task (task power). */
  restPerMin: number;
  taskPerMin: number;
  /** Suit O2 capacity, grams. */
  tank: number;
}

/** Walking at the profile's suited walk pace, with `carriedMassKg` of gear. Steepest grade = the physics' slope cap. */
export function physicsWalk(p: Readonly<MarsEVAEngineeringProfile>, carriedMassKg = 0): PhysicsWalk {
  const walk = (g: number) => activityResponse(p, 'walk', g, carriedMassKg);
  return {
    maxGrade: Math.tan((p.maxDemoSlopeDeg * Math.PI) / 180),
    perMetre: (g) => {
      const w = walk(g);
      return gramsPerHour(w.metabolicPowerWatts) / 3600 / w.speedMetresPerSecond; // grams/s ÷ m/s = grams/m
    },
    secondsPerMetre: (g) => 1 / walk(g).speedMetresPerSecond,
    restPerMin: gramsPerHour(p.powerIdleW) / 60,
    taskPerMin: gramsPerHour(p.powerTaskW) / 60,
    tank: p.oxygenCapacityGrams,
  };
}

/** O2 grams and seconds for a short straight walk a→b (a few metres, so one grade fits it). */
export function walkPiece(m: PhysicsWalk, heightAt: (x: number, z: number) => number, a: XZ, b: XZ) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), g = d > 0 ? (heightAt(b.x, b.z) - heightAt(a.x, a.z)) / d : 0;
  return { o2: d * m.perMetre(g), seconds: d * m.secondsPerMetre(g) };
}
