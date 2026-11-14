// Written with AI assistance (Claude). Owner: Nanda. Tests for the EVA path planner (src/sim/pathfind.ts).
// Synthetic grids are TEST geometry, not NASA data. The last test uses the real public/grids/height_4m.bin.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { kcalPerMetre, evaluateRoute, MAX_GRADE } from '../src/sim/cost.ts';
import { buildLattice, computeField, costFrom, pathFrom, planTour, lineLitres, pathLength } from '../src/sim/pathfind.ts';

const B = { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
/** Terrain defined at 4 m samples (aligned to B) and bilinear in between, like the game's height grid. */
const bilinear4 = (atSample) => (x, z) => {
  const fc = (x - B.minX) / 4, fr = (z - B.minZ) / 4, c = Math.floor(fc), r = Math.floor(fr), u = fc - c, v = fr - r;
  const H = (cc, rr) => atSample(B.minX + cc * 4, B.minZ + rr * 4);
  return (H(c, r) * (1 - u) + H(c + 1, r) * u) * (1 - v) + (H(c, r + 1) * (1 - u) + H(c + 1, r + 1) * u) * v;
};
const steepestOn = (pts, heightAt) => {
  let g = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.5));
    for (let k = 1; k <= n; k++) {
      const x0 = a.x + ((b.x - a.x) * (k - 1)) / n, z0 = a.z + ((b.z - a.z) * (k - 1)) / n;
      const x1 = a.x + ((b.x - a.x) * k) / n, z1 = a.z + ((b.z - a.z) * k) / n;
      g = Math.max(g, Math.abs(heightAt(x1, z1) - heightAt(x0, z0)) / (d / n));
    }
  }
  return g;
};

test('cost model matches research/02 test values (0°, 10°, 20°)', () => {
  assert.equal(kcalPerMetre(0).toFixed(3), '0.088');
  assert.equal(kcalPerMetre(Math.tan((10 * Math.PI) / 180)).toFixed(3), '0.171');
  assert.equal(kcalPerMetre(Math.tan((20 * Math.PI) / 180)).toFixed(3), '0.298');
  const flat = evaluateRoute([{ x: 0, z: 0 }, { x: 100, z: 0 }], () => 0).totals;
  assert.ok(Math.abs(flat.dist - 100) < 1e-9);
  assert.ok(Math.abs(flat.o2 - (100 * 0.0884 * 1.15) / 4.8) < 0.02, `flat O2 ${flat.o2}`);
});

test('direction-aware: walking up a slope costs more than walking down it', () => {
  const ramp = (x) => x * 0.1; // 10% grade, rising east
  const L = buildLattice((x) => ramp(x), B, 4);
  const up = lineLitres(L, { x: -100, z: 0 }, { x: 100, z: 0 }), down = lineLitres(L, { x: 100, z: 0 }, { x: -100, z: 0 });
  assert.ok(up > down * 1.5, `up ${up} vs down ${down}`);
});

test('detours through the gap in a cliff instead of climbing it, never steeper than MAX_GRADE', () => {
  // A 30 m wall along x = 0 (far steeper than 24°), with a flat gap at z > 120. Heights are bilinear between 4 m
  // samples, like the real terrain (sampleBilinear), so the grade check measures the ground the game shows.
  const h = bilinear4((x, z) => (Math.abs(x) < 6 && z < 120 ? 30 : 0));
  const L = buildLattice(h, B, 4);
  const F = computeField(L, { x: 100, z: 0 });
  const pts = pathFrom(L, F, { x: -100, z: 0 });
  assert.ok(pts, 'a path exists');
  assert.deepEqual(pts[0], { x: -100, z: 0 });
  assert.deepEqual(pts[pts.length - 1], { x: 100, z: 0 });
  assert.ok(pts.some((p) => p.z > 115), 'goes round through the gap');
  assert.ok(steepestOn(pts, h) <= MAX_GRADE + 1e-6, `steepest ${steepestOn(pts, h)}`);
});

test('a path can start from ANY point, and blocked ground is avoided', () => {
  const blockedDisc = (x, z) => Math.hypot(x, z) < 40; // e.g. the base footprint
  const L = buildLattice(() => 0, B, 4, { isBlocked: blockedDisc });
  const F = computeField(L, { x: 0, z: 150 });
  for (const start of [{ x: 0, z: -150 }, { x: -173.3, z: 12.7 }, { x: 160, z: -160 }, { x: 47.1, z: -3.9 }]) {
    const pts = pathFrom(L, F, start);
    assert.ok(pts && pts.length >= 2, `path from ${JSON.stringify(start)}`);
    assert.deepEqual(pts[0], start);
    for (let i = 1; i < pts.length; i++) assert.ok(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) <= 4 + 1e-9, 'densified');
    for (const p of pts) assert.ok(Math.hypot(p.x, p.z) > 38, `stays out of the blocked disc: ${JSON.stringify(p)}`);
    // Smoothing never makes it much worse than the field's own optimum.
    assert.ok(lineLitresAlong(L, pts) <= costFrom(L, F, start) * 1.03 + 1e-6);
  }
});
function lineLitresAlong(L, pts) {
  let w = 0;
  for (let i = 1; i < pts.length; i++) w += lineLitres(L, pts[i - 1], pts[i], false);
  return w;
}

test('unreachable goals give null, not a made-up straight line', () => {
  const h = (x) => (Math.abs(x) < 6 ? 50 : 0); // a wall right across the map
  const L = buildLattice(h, B, 4);
  const F = computeField(L, { x: 100, z: 0 });
  assert.equal(pathFrom(L, F, { x: -100, z: 0 }), null);
  assert.equal(costFrom(L, F, { x: -100, z: 0 }), Infinity);
});

test('visiting order is the cheapest over all orders (walk home counted) and deterministic', () => {
  const h = (x, z) => 0.0004 * (x * x) + 0.05 * z; // a valley with a tilt, so order matters
  const L = buildLattice(h, B, 4);
  const home = { x: 0, z: 0 }, goals = [{ x: 120, z: -60 }, { x: -90, z: 110 }, { x: 40, z: 150 }, { x: -150, z: -120 }];
  const H = computeField(L, home), F = goals.map((g) => computeField(L, g));
  const plan = planTour(L, F, H, home, [0, 1, 2, 3]);
  assert.ok(plan);
  const cost = (o) => {
    let at = home, w = 0;
    for (const i of o) { w += costFrom(L, F[i], at); at = goals[i]; }
    return w + costFrom(L, H, at);
  };
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  const best = Math.min(...perms([0, 1, 2, 3]).map(cost));
  assert.ok(Math.abs(plan.litres - best) < 1e-6, `plan ${plan.litres} vs brute force ${best}`);
  assert.deepEqual(planTour(L, F, H, home, [0, 1, 2, 3]), plan);
  assert.deepEqual(plan.back[plan.back.length - 1], home);
  // Every objective is on the outbound path, in the planned order.
  let from = 0;
  for (const i of plan.order) {
    const k = plan.points.findIndex((p, j) => j >= from && Math.hypot(p.x - goals[i].x, p.z - goals[i].z) < 1e-6);
    assert.ok(k >= from, `objective ${i} visited in order`);
    from = k;
  }
  // No objectives left: straight home.
  const homeOnly = planTour(L, F, H, { x: 100, z: 100 }, []);
  assert.deepEqual(homeOnly.points[homeOnly.points.length - 1], home);
});

const GRID = new URL('../public/grids/height_4m.bin', import.meta.url);
test('real Jezero 4 m grid: tour from the airlock passes the scene route validation', { skip: !existsSync(GRID) && 'no height_4m.bin' }, async () => {
  const { createHeightGrid } = await import('../src/adapters/world.ts');
  const { validateSceneRoute } = await import('../src/adapters/routes.ts');
  const n = 1025, cell = 4, half = 2048, buf = readFileSync(GRID);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + n * n * 4);
  const region = { id: 'jezero-local-preview', frameId: 'local-m', terrainRevision: 'test', crs: 'eqc', origin: { X: 0, Y: 0, h0: 0 },
    visibleBounds: { minX: -half, maxX: half, minZ: -half, maxZ: half }, playableBounds: { minX: -half + 100, maxX: half - 100, minZ: -half + 100, maxZ: half - 100 } };
  const grid = createHeightGrid(ab, n, cell, region.visibleBounds);
  const terrain = { ...grid, contractVersion: 1, regionId: region.id, frameId: region.frameId, terrainRevision: 'test', coverage: 'bilinear-valid-cells', noDataPolicy: 'reject-scene' };
  const heightAt = (x, z) => grid.heightAt(x, z) ?? NaN;
  const L = buildLattice(heightAt, region.playableBounds, 4, { alignX: -half, alignZ: -half });
  const door = { x: 0, z: 6.4 };
  const stops = [{ x: -21.6, z: -44.2 }, { x: -58.4, z: -66.4 }, { x: -90, z: -110 }, { x: -191.1, z: -168.6 }];
  const t0 = performance.now();
  const H = computeField(L, door), F = stops.map((s) => computeField(L, s));
  const ms = performance.now() - t0;
  const plan = planTour(L, F, H, door, [0, 1, 2, 3]);
  assert.ok(plan, 'tour found');
  const mission = { regionId: region.id, shuttle: door, tasks: [], route: { source: 'demo', points: plan.points } };
  for (const pts of [plan.points, plan.back, pathFrom(L, H, { x: 1500, z: -1500 })]) {
    validateSceneRoute({ source: 'demo', points: pts }, region, mission, terrain);
    assert.ok(steepestOn(pts, heightAt) <= MAX_GRADE + 0.02);
  }
  console.log(`Jezero: ${L.cols}x${L.rows} nodes, 5 fields in ${ms.toFixed(0)} ms; tour ${pathLength(plan.points).toFixed(0)} m out + ${pathLength(plan.back).toFixed(0)} m back, ${plan.litres.toFixed(1)} L O2, order ${plan.order.join(' → ')}`);
});
