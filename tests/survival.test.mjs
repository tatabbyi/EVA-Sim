// Written with AI assistance (Claude). Owner: Nanda. Tests for Survival Odds (src/sim/survival.ts).
// Synthetic plans are TEST geometry. The last test uses the real public/grids/height_4m.bin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildLattice, computeField, costFrom, rankTours } from '../src/sim/pathfind.ts';
import { buildSteps, simulate, safestTour } from '../src/sim/survival.ts';

const flat = () => 0;
const SUIT = { tankL: 390, reserveL: 15.6, restLPerMin: 0.52, limitMin: 45 };
const TASK = () => ({ minutes: 5, o2PerMin: 1 });
const line = (n, step) => Array.from({ length: n + 1 }, (_, i) => ({ x: i * step, z: 0 }));
// A straight plan: walk 400 m out, one task, walk back. Home cost = straight-line flat walking.
const plan = { order: [0], legs: [line(100, 4)], points: line(100, 4), back: line(100, 4).reverse(), litres: 0 };
const homeO2 = (p) => (Math.abs(p.x) * 0.0884 * 1.15) / 4.8;

test('the same plan and seed always give the same odds', () => {
  const steps = buildSteps(plan, TASK, flat);
  assert.deepEqual(simulate(steps, SUIT, homeO2), simulate(steps, SUIT, homeO2));
  assert.notDeepEqual(simulate(steps, SUIT, homeO2, 1000, 1).o2Left, simulate(steps, SUIT, homeO2, 1000, 2).o2Left);
});

test('a short walk with a full suit nearly always gets home; a nearly empty suit never does', () => {
  const steps = buildSteps(plan, TASK, flat);
  const full = simulate(steps, SUIT, homeO2);
  assert.ok(full.home > 0.97, `home ${full.home}`);
  assert.ok(full.o2Left[0] < full.o2Left[1] && full.o2Left[1] < full.o2Left[2]);
  const empty = simulate(steps, { ...SUIT, tankL: 20 }, homeO2);
  assert.equal(empty.home, 0);
  assert.equal(empty.mainCause !== null, true);
});

test('a tight time limit is caught (slow walking makes runs late)', () => {
  const steps = buildSteps(plan, TASK, flat);
  const planned = steps.reduce((a, s) => a + s.seconds, 0) / 60;
  const odds = simulate(steps, { ...SUIT, limitMin: planned * 1.05 }, homeO2);
  assert.ok(odds.onTime < 0.5 && odds.home > 0.97, `onTime ${odds.onTime}`);
});

test('safestTour keeps the cheaper tour unless another is clearly safer', () => {
  const fake = (success) => ({ runs: 1000, home: success, onTime: 1, success, complete: 1, o2Left: [0, 0, 0], mainCause: null });
  const a = { ...plan, litres: 1 }, b = { ...plan, litres: 2 };
  const odds = new Map([[a, fake(0.9)], [b, fake(0.905)]]);
  assert.equal(safestTour([a, b], (p) => odds.get(p)).plan, a);
  odds.set(b, fake(0.95));
  assert.equal(safestTour([a, b], (p) => odds.get(p)).plan, b);
});

const GRID = new URL('../public/grids/height_4m.bin', import.meta.url);
test('real Jezero: odds for every visit order of the four sample objectives', { skip: !existsSync(GRID) && 'no height_4m.bin' }, () => {
  const n = 1025, half = 2048, buf = readFileSync(GRID), data = new Float32Array(buf.buffer, buf.byteOffset, n * n);
  const heightAt = (x, z) => {
    const c = Math.min(n - 1, Math.max(0, (x + half) / 4)), r = Math.min(n - 1, Math.max(0, (z + half) / 4));
    const c0 = Math.floor(c), r0 = Math.floor(r), c1 = Math.min(n - 1, c0 + 1), r1 = Math.min(n - 1, r0 + 1), u = c - c0, v = r - r0;
    return (data[r0 * n + c0] * (1 - u) + data[r0 * n + c1] * u) * (1 - v) + (data[r1 * n + c0] * (1 - u) + data[r1 * n + c1] * u) * v;
  };
  const L = buildLattice(heightAt, { minX: -1948, maxX: 1948, minZ: -1948, maxZ: 1948 }, 4, { alignX: -half, alignZ: -half });
  const door = { x: 0, z: 6.4 }, stops = [{ x: -21.6, z: -44.2 }, { x: -58.4, z: -66.4 }, { x: -90, z: -110 }, { x: -191.1, z: -168.6 }];
  const H = computeField(L, door), F = stops.map((s) => computeField(L, s));
  const t0 = performance.now();
  const candidates = rankTours(L, F, H, door, [0, 1, 2, 3], 6);
  const tasks = [{ minutes: 4, o2PerMin: 1.1 }, { minutes: 5, o2PerMin: 1.2 }, { minutes: 3, o2PerMin: 0.8 }, { minutes: 4, o2PerMin: 0.5 }];
  const best = safestTour(candidates, (p) => simulate(buildSteps(p, (i) => tasks[i], heightAt), SUIT, (q) => costFrom(L, H, q)));
  const ms = performance.now() - t0;
  assert.equal(candidates.length, 6);
  assert.ok(best && best.odds.success > 0.5);
  const o = best.odds;
  console.log(`Jezero: ${best.compared} orders x 1,000 runs in ${ms.toFixed(0)} ms. Best ${best.plan.order.join(' → ')}: home ${(o.home * 100).toFixed(1)}%, on time ${(o.onTime * 100).toFixed(1)}%, all tasks ${(o.complete * 100).toFixed(1)}%, O2 left ${o.o2Left.map((x) => x.toFixed(0)).join('/')} L, main cause ${o.mainCause}`);
});
