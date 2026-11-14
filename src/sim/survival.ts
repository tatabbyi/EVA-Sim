// Written with AI assistance (Claude). Owner: Nanda.
// Survival Odds: walk a planned EVA 1,000 times with the random draws in research/03-survival-odds.md and count
// how often the astronaut gets back to the airlock with the reserve left, and within the EVA time limit.
//
// One run:
//  1. Draw this run's person and ground: work rate, terrain roughness, walking speed, a slow suit leak.
//  2. Walk the plan step by step (every ≤ 4 m of path, then each task). Along the way, dusty dust devils make you
//     stop and wait, falls during tasks cost time, and a big suit-leak failure can start.
//  3. A leak failure or an injury from a fall means ABORT: walk straight home from where you are, using the
//     planner's cheapest O2-to-home (src/sim/pathfind.ts). This is why the route matters: a route that keeps you
//     close to the base survives a failure better.
// Seeded, so the same plan always gives the same odds (no number jumping during a demo).

import { evaluateRoute } from './cost.ts';
import type { TourPlan, XZ } from './pathfind.ts';

/** One piece of the EVA: a short walk (to `at`) or a task done at `at`. o2 and seconds are the PLANNED values. */
export interface Step { at: XZ; o2: number; seconds: number; task: boolean }
export interface Suit { tankL: number; reserveL: number; restLPerMin: number; limitMin: number }
export interface Odds {
  runs: number;
  /** Fraction of runs back at the airlock with at least the reserve left. */
  home: number;
  /** Fraction back within the EVA time limit. */
  onTime: number;
  /** Fraction home with the reserve AND on time: what plans are ranked on. */
  success: number;
  /** Fraction that did every task (no abort). */
  complete: number;
  /** O2 left at the airlock, litres: 5th, 50th and 95th percentile. */
  o2Left: [number, number, number];
  /** What went wrong most often in the runs that failed, or null if none failed. */
  mainCause: string | null;
}

// ---- research/03 numbers (sources there)
const WORK_SIGMA = 0.12; // metabolic multiplier: lognormal, median 1, clipped 0.7 to 1.5 (Apollo crew averages)
const TERRAIN = [1.0, 1.15, 1.5]; // terrain + suit factor: triangular (Apollo 14 vs smooth-ground model)
const PLANNED_TERRAIN = 1.15; // the factor the planned O2 already includes (cost.ts TERRAIN_FACTOR)
const SPEED = [0.7, 0.9, 1.1]; // walking speed multiplier: triangular (Apollo 14 walked 0.73x the planned speed)
const LEAK_MAX_L_PER_MIN = 0.035; // normal suit leak: uniform up to the EMU spec maximum
const LEAK_FAIL_P = 0.005; // big leak failure per EVA (illustrative assumption: no public rate)
const LEAK_FAIL_L_PER_MIN = [0.5, 2];
const DUSTY_DEVILS_PER_S = 0.2 / 3600; // ~0.6 vortex passes/h around midday (MEDA), 1 in 3 dusty
const DEVIL_WAIT_S = [60, 300];
const FALLS_PER_TASK_S = 0.15 / 3600; // Apollo 16: 6 falls in ~20 crew-hours, all while working, not walking
const FALL_DELAY_S = [30, 120];
const INJURY_P = 0.02; // per fall (illustrative assumption)

/** The plan as steps: each leg's walk (≤ 4 m pieces, real slopes from heightAt), then that objective's task, then home. */
export function buildSteps(plan: TourPlan, task: (objective: number) => { minutes: number; o2PerMin: number }, heightAt: (x: number, z: number) => number): Step[] {
  const steps: Step[] = [];
  const walk = (pts: XZ[]) => {
    for (let i = 1; i < pts.length; i++) {
      const { o2, seconds } = evaluateRoute([pts[i - 1], pts[i]], heightAt).totals;
      steps.push({ at: pts[i], o2, seconds, task: false });
    }
  };
  plan.legs.forEach((leg, k) => {
    walk(leg);
    const t = task(plan.order[k]);
    steps.push({ at: leg[leg.length - 1], o2: t.minutes * t.o2PerMin, seconds: t.minutes * 60, task: true });
  });
  walk(plan.back);
  return steps;
}

// Seeded random numbers and the distributions research/03 uses.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const uniform = (r: Rng, [a, b]: number[]) => a + (b - a) * r();
const gauss = (r: Rng) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const triangular = (r: Rng, [a, c, b]: number[]) => {
  const u = r(), f = (c - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
};

/**
 * Runs the EVA `runs` times. homeO2(p) = planned O2 litres to walk home from p (the planner's field).
 * The same seed gives the same odds; comparing plans with one seed uses the same luck for each (fairer).
 */
export function simulate(steps: Step[], suit: Suit, homeO2: (p: XZ) => number, runs = 1000, seed = 2026): Odds {
  const r = mulberry32(seed);
  const rest = suit.restLPerMin / 60; // litres per second standing still
  const walking = steps.filter((s) => !s.task);
  const secondsPerLitre = walking.reduce((a, s) => a + s.seconds, 0) / Math.max(1e-9, walking.reduce((a, s) => a + s.o2, 0));
  const homeCache = new Map<number, number>();
  const home = (i: number) => homeCache.get(i) ?? homeCache.set(i, homeO2(steps[i].at)).get(i)!;

  const left: number[] = [], causes = new Map<string, number>();
  let homeOk = 0, onTime = 0, success = 0, complete = 0;
  for (let run = 0; run < runs; run++) {
    // 1. This run's person and ground.
    const work = Math.min(1.5, Math.max(0.7, Math.exp(WORK_SIGMA * gauss(r))));
    const ground = triangular(r, TERRAIN) / PLANNED_TERRAIN;
    let speed = triangular(r, SPEED);
    let leak = uniform(r, [0, LEAK_MAX_L_PER_MIN]) / 60; // litres per second
    const failAt = r() < LEAK_FAIL_P ? r() * steps.length : Infinity; // step where a big leak starts
    const failLeak = uniform(r, LEAK_FAIL_L_PER_MIN) / 60;
    let used = 0, t = 0, abort: string | null = null;
    const spend = (litres: number, seconds: number) => { used += litres + leak * seconds; t += seconds; };

    // 2. Walk the plan.
    for (let i = 0; i < steps.length && !abort; i++) {
      const s = steps[i];
      if (s.task) {
        spend(s.o2 * work, s.seconds);
        if (r() < FALLS_PER_TASK_S * s.seconds) {
          const d = uniform(r, FALL_DELAY_S); // getting up and checking the suit
          spend(d * rest, d);
          if (r() < INJURY_P) { speed *= 0.6; abort = 'injury after a fall'; }
        }
      } else {
        const seconds = s.seconds / speed; // slower than planned = more time breathing
        spend(s.o2 * work * ground + Math.max(0, seconds - s.seconds) * rest, seconds);
      }
      if (r() < DUSTY_DEVILS_PER_S * s.seconds) { const w = uniform(r, DEVIL_WAIT_S); spend(w * rest, w); }
      if (i >= failAt) { leak += failLeak; abort = 'suit leak'; } // the loop stops after this step
      // 3. Abort: straight home from here.
      if (abort) {
        const litres = home(i) * work * ground;
        spend(litres, (litres * secondsPerLitre) / speed);
      }
    }

    const o2Left = suit.tankL - used, isHome = o2Left >= suit.reserveL, isOnTime = t / 60 <= suit.limitMin;
    left.push(o2Left);
    homeOk += +isHome;
    onTime += +isOnTime;
    success += +(isHome && isOnTime);
    complete += +!abort;
    if (!(isHome && isOnTime)) {
      const cause = abort ?? (speed < 0.8 ? 'slow walking' : work * ground > 1.2 ? 'hard work on rough ground' : 'dust devil stops');
      causes.set(cause, (causes.get(cause) ?? 0) + 1);
    }
  }
  left.sort((a, b) => a - b);
  const pct = (q: number) => left[Math.min(runs - 1, Math.floor(q * runs))];
  return {
    runs,
    home: homeOk / runs,
    onTime: onTime / runs,
    success: success / runs,
    complete: complete / runs,
    o2Left: [pct(0.05), pct(0.5), pct(0.95)],
    mainCause: [...causes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

/**
 * Of the candidate tours (cheapest first), the one most likely to succeed. Within one run in a hundred of the best,
 * the cheaper tour wins (1,000 runs can't tell them apart: ±1 point).
 */
export function safestTour(candidates: TourPlan[], odds: (plan: TourPlan) => Odds): { plan: TourPlan; odds: Odds; compared: number } | null {
  let best: { plan: TourPlan; odds: Odds } | null = null;
  for (const plan of candidates) {
    const o = odds(plan);
    if (!best || o.success > best.odds.success + 0.01) best = { plan, odds: o };
  }
  return best && { ...best, compared: candidates.length };
}
