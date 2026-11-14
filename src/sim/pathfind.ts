// Written with AI assistance (Claude). Owner: Nanda.
// EVA path planner: cheapest walk in O2 from any point to a goal, and the best order to visit objectives.
// Classical Dijkstra (research/07 Option A) with the research/02 walking cost. Pure, worker-safe.
//  - Lattice on the height grid, 16 neighbours (8 + knight moves → 22.5° headings). A step costs the O2 for its own
//    grade in the walking direction (uphill ≠ downhill); steeper than MAX_GRADE anywhere along it = not allowed.
//  - One Dijkstra per goal on the reversed graph gives a field (O2 to the goal + next node) for EVERY node, so a path
//    from wherever the astronaut stands is a lookup.
//  - Lattice paths are string-pulled into straight lines where that stays legal and costs ≤ SMOOTH_SLACK more.

import { MAX_GRADE, TERRAIN_FACTOR, o2LitresPerMetre } from './cost.ts';

export type XZ = { x: number; z: number };
/** Nodes `cell` m apart from (minX, minZ); x east, z south. blocked = no data, outside the play area or a structure. */
export interface Lattice { cols: number; rows: number; cell: number; minX: number; minZ: number; height: Float32Array; blocked: Uint8Array }
/** cost: O2 litres from each node to the goal (Infinity = unreachable); next: node towards it. goalNode -1 = no ground. */
export interface CostField { goal: XZ; goalNode: number; cost: Float32Array; next: Int32Array }
/** legs[k]: walk to objective order[k]; points: all legs joined; back: last objective → home; litres: planned O2 for all. */
export interface TourPlan { order: number[]; legs: XZ[][]; points: XZ[]; back: XZ[]; litres: number }

export const DENSIFY_M = 4; // max spacing of output points (keeps the Catmull-Rom arrows on the line)
export const SMOOTH_SLACK = 0.02;

const DR = [-1, -1, -1, 0, 0, 1, 1, 1, -2, -2, -1, -1, 1, 1, 2, 2];
const DC = [-1, 0, 1, -1, 1, -1, 0, 1, -1, 1, -2, 2, -2, 2, -1, 1];
const DL = DR.map((r, k) => Math.hypot(r, DC[k]));
const dist = (a: XZ, b: XZ) => Math.hypot(b.x - a.x, b.z - a.z);

// O2 per metre (terrain factor in) as a 0.0005-grade lookup table; Infinity beyond MAX_GRADE.
const LUT = Array.from({ length: Math.round(MAX_GRADE / 0.00025) + 1 }, (_, i) => o2LitresPerMetre(-MAX_GRADE + i * 0.0005) * TERRAIN_FACTOR);
function litresPerM(g: number): number {
  if (!(Math.abs(g) <= MAX_GRADE)) return Infinity;
  const f = (g + MAX_GRADE) / 0.0005, i = Math.min(LUT.length - 2, Math.floor(f));
  return LUT[i] + (LUT[i + 1] - LUT[i]) * (f - i);
}

export function buildLattice(
  heightAt: (x: number, z: number) => number,
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
  cell: number,
  { alignX = 0, alignZ = 0, margin = 2, isBlocked }: { alignX?: number; alignZ?: number; margin?: number; isBlocked?: (x: number, z: number) => boolean } = {},
): Lattice {
  const minX = alignX + Math.ceil((b.minX + margin - alignX) / cell - 1e-9) * cell, minZ = alignZ + Math.ceil((b.minZ + margin - alignZ) / cell - 1e-9) * cell;
  const cols = Math.floor((b.maxX - margin - minX) / cell + 1e-9) + 1, rows = Math.floor((b.maxZ - margin - minZ) / cell + 1e-9) + 1;
  if (!(cols >= 2 && rows >= 2)) throw new Error('buildLattice: area too small');
  const height = new Float32Array(cols * rows), blocked = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const x = minX + (i % cols) * cell, z = minZ + Math.floor(i / cols) * cell, h = heightAt(x, z);
    height[i] = Number.isFinite(h) ? h : NaN;
    blocked[i] = !Number.isFinite(h) || isBlocked?.(x, z) ? 1 : 0;
  }
  return { cols, rows, cell, minX, minZ, height, blocked };
}

const nodeXZ = (L: Lattice, i: number): XZ => ({ x: L.minX + (i % L.cols) * L.cell, z: L.minZ + Math.floor(i / L.cols) * L.cell });

/** Calls fn for usable nodes within `radius` nodes of p, nearest rows/cols first in index order (deterministic). */
function near(L: Lattice, p: XZ, radius: number, fn: (i: number) => void) {
  const c0 = Math.round((p.x - L.minX) / L.cell), r0 = Math.round((p.z - L.minZ) / L.cell);
  for (let r = Math.max(0, r0 - radius); r <= Math.min(L.rows - 1, r0 + radius); r++)
    for (let c = Math.max(0, c0 - radius); c <= Math.min(L.cols - 1, c0 + radius); c++) if (!L.blocked[r * L.cols + c]) fn(r * L.cols + c);
}

/**
 * Walks the straight line a→b (lattice coords) cell by cell. Heights are bilinear between nodes, so along a line
 * inside one cell the slope changes linearly and peaks at a cell boundary: checking each piece's ends is exact.
 * Returns O2 litres (quarter-cell samples), or Infinity if any part is steeper than MAX_GRADE, off the lattice,
 * on no-data, or (strict) in a cell with a blocked corner.
 */
function walkLine(L: Lattice, c0: number, r0: number, c1: number, r1: number, strict: boolean, cost = true): number {
  const dc = c1 - c0, dr = r1 - r0, len = Math.hypot(dc, dr), n = L.cols, h = L.height;
  if (len < 1e-12) return 0;
  // Step from cell boundary to cell boundary (next column / row line the segment crosses).
  let litres = 0, nc = dc > 0 ? Math.floor(c0) + 1 : Math.ceil(c0) - 1, nr = dr > 0 ? Math.floor(r0) + 1 : Math.ceil(r0) - 1;
  for (let t0 = 0; t0 < 1 - 1e-12;) {
    const tc = dc ? (nc - c0) / dc : Infinity, tr = dr ? (nr - r0) / dr : Infinity, t1 = Math.min(1, tc, tr);
    if (t1 === tc) nc += Math.sign(dc);
    if (t1 === tr) nr += Math.sign(dr);
    if (t1 - t0 < 1e-12) continue;
    const fc = c0 + (dc * (t0 + t1)) / 2, fr = r0 + (dr * (t0 + t1)) / 2;
    if (!(fc >= 0 && fr >= 0 && fc <= L.cols - 1 && fr <= L.rows - 1)) return Infinity;
    const c = Math.min(L.cols - 2, Math.floor(fc)), r = Math.min(L.rows - 2, Math.floor(fr)), j = r * n + c;
    if (strict && (L.blocked[j] | L.blocked[j + 1] | L.blocked[j + n] | L.blocked[j + n + 1])) return Infinity;
    // Bilinear cell: height a + ex·u + ez·v + q·u·v, with u, v the position inside the cell.
    const a = h[j], ex = h[j + 1] - a, ez = h[j + n] - a, q = a - h[j + 1] - h[j + n] + h[j + n + 1];
    const u0 = c0 + dc * t0 - c, v0 = r0 + dr * t0 - r, u1 = c0 + dc * t1 - c, v1 = r0 + dr * t1 - r, k = len * L.cell;
    const g = Math.max(Math.abs((ex + q * v0) * dc + (ez + q * u0) * dr), Math.abs((ex + q * v1) * dc + (ez + q * u1) * dr)) / k;
    if (!(g <= MAX_GRADE)) return Infinity; // NaN (no data) fails too
    if (cost) {
      const m = Math.max(1, Math.ceil(((t1 - t0) * len) / 0.25)), ds = ((t1 - t0) * k) / m;
      for (let s = 0, hp = a + ex * u0 + ez * v0 + q * u0 * v0; s < m; s++) {
        const u = u0 + ((u1 - u0) * (s + 1)) / m, v = v0 + ((v1 - v0) * (s + 1)) / m, hn = a + ex * u + ez * v + q * u * v;
        litres += ds * litresPerM((hn - hp) / ds);
        hp = hn;
      }
    }
    t0 = t1;
  }
  return litres;
}

/** O2 litres for the straight line a→b in metres (Infinity if not walkable; see walkLine). */
export function lineLitres(L: Lattice, a: XZ, b: XZ, strict = true): number {
  const c = (x: number) => (x - L.minX) / L.cell, r = (z: number) => (z - L.minZ) / L.cell;
  return walkLine(L, c(a.x), r(a.z), c(b.x), r(b.z), strict);
}

// Bit k set = the diagonal/knight step from this node along neighbour k isn't legal. Goal-independent: once per lattice.
const masks = new WeakMap<Lattice, Uint16Array>();
function steepMask(L: Lattice): Uint16Array {
  let m = masks.get(L);
  if (m) return m;
  m = new Uint16Array(L.cols * L.rows);
  for (let i = 0; i < m.length; i++) {
    const r = Math.floor(i / L.cols), c = i % L.cols;
    for (let k = 0; k < 16; k++) {
      const r1 = r + DR[k], c1 = c + DC[k];
      if (DR[k] && DC[k] && r1 >= 0 && c1 >= 0 && r1 < L.rows && c1 < L.cols && walkLine(L, c, r, c1, r1, true, false) === Infinity) m[i] |= 1 << k;
    }
  }
  masks.set(L, m);
  return m;
}

/** Field towards `goal`: Dijkstra from the goal over reversed steps (each step u→v keeps its walking direction). */
export function computeField(L: Lattice, goal: XZ): CostField {
  const N = L.cols * L.rows, n = L.cols, h = L.height, mask = steepMask(L);
  const best = new Float64Array(N).fill(Infinity), next = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  let goalNode = -1, gd = Infinity;
  near(L, goal, 3, (i) => { const d = dist(nodeXZ(L, i), goal); if (d < gd - 1e-9) { gd = d; goalNode = i; } });
  // Binary min-heap; equal keys pop in node order so results are deterministic.
  let hk = new Float64Array(1 << 16), hv = new Int32Array(1 << 16), size = 0;
  const less = (i: number, k: number, v: number) => hk[i] < k || (hk[i] === k && hv[i] < v);
  const push = (k: number, v: number) => {
    if (size === hk.length) { const k2 = new Float64Array(size * 2), v2 = new Int32Array(size * 2); k2.set(hk); v2.set(hv); hk = k2; hv = v2; }
    let i = size++;
    for (let p; i > 0 && !less((p = (i - 1) >> 1), k, v); i = p) { hk[i] = hk[p]; hv[i] = hv[p]; }
    hk[i] = k; hv[i] = v;
  };
  const pop = () => {
    const top = hv[0], k = hk[--size], v = hv[size];
    let i = 0;
    for (let c; (c = 2 * i + 1) < size; i = c) {
      if (c + 1 < size && less(c + 1, hk[c], hv[c])) c++;
      if (!less(c, k, v)) break;
      hk[i] = hk[c]; hv[i] = hv[c];
    }
    hk[i] = k; hv[i] = v;
    return top;
  };
  if (goalNode >= 0) { best[goalNode] = 0; push(0, goalNode); }
  while (size) {
    const v = pop();
    if (done[v]) continue;
    done[v] = 1;
    const vr = (v / n) | 0, vc = v - vr * n;
    for (let k = 0; k < 16; k++) {
      const ur = vr - DR[k], uc = vc - DC[k], u = ur * n + uc; // u steps onto v along k
      if (ur < 0 || uc < 0 || ur >= L.rows || uc >= n || done[u] || L.blocked[u] || (mask[u] >> k) & 1) continue;
      const d = DL[k] * L.cell, w = best[v] + d * litresPerM((h[v] - h[u]) / d);
      if (w < best[u]) { best[u] = w; next[u] = v; push(w, u); }
    }
  }
  return { goal: { ...goal }, goalNode, cost: Float32Array.from(best), next };
}

/** Where a walk from p joins the field: the nearby node with the cheapest hop + rest of the way. */
function entry(L: Lattice, F: CostField, p: XZ) {
  let node = -1, litres = Infinity;
  near(L, p, 3, (i) => {
    // The hop only has to respect the grade limit: you may be standing beside the base or at the airlock.
    const w = F.cost[i] < Infinity ? lineLitres(L, p, nodeXZ(L, i), false) + F.cost[i] : Infinity;
    if (w < litres - 1e-9) { litres = w; node = i; }
  });
  return node < 0 ? null : { node, litres };
}

/** O2 litres from p to the goal on the cheapest route; Infinity if there is none. */
export function costFrom(L: Lattice, F: CostField, p: XZ): number {
  if (F.goalNode < 0) return Infinity;
  if (dist(p, F.goal) < 1e-6) return 0;
  const e = entry(L, F, p);
  return e ? e.litres + lineLitres(L, nodeXZ(L, F.goalNode), F.goal, false) : Infinity;
}

const dedupe = (pts: XZ[]) => pts.filter((p, i) => i === 0 || dist(pts[i - 1], p) >= 0.01);

/** The cheapest walk from p (anywhere) to the goal, smoothed, points ≤ DENSIFY_M apart. null if unreachable. */
export function pathFrom(L: Lattice, F: CostField, p: XZ): XZ[] | null {
  if (F.goalNode < 0) return null;
  if (dist(p, F.goal) < 0.01) return [{ ...p }];
  const e = entry(L, F, p);
  if (!e) return null;
  const nodes = [e.node];
  while (nodes[nodes.length - 1] !== F.goalNode && nodes[nodes.length - 1] >= 0 && nodes.length <= F.next.length) nodes.push(F.next[nodes[nodes.length - 1]]);
  if (nodes[nodes.length - 1] !== F.goalNode) return null;
  const pts = [{ ...p }, ...nodes.map((v) => nodeXZ(L, v)), { ...F.goal }];
  // O2 to reach each point; the lattice part comes straight from the field.
  const cum = [0, lineLitres(L, p, pts[1], false)];
  for (let i = 1; i < nodes.length; i++) cum.push(cum[i] + F.cost[nodes[i - 1]] - F.cost[nodes[i]]);
  cum.push(cum[cum.length - 1] + lineLitres(L, pts[pts.length - 2], F.goal, false));
  // String-pulling: from each kept point jump to the farthest point a straight line reaches cheaply enough.
  const out = [pts[0]];
  for (let i = 0, j = 0; i < pts.length - 1; i = j) {
    for (j = Math.min(pts.length - 1, i + 64); j > i + 1; j--) if (lineLitres(L, pts[i], pts[j]) <= (cum[j] - cum[i]) * (1 + SMOOTH_SLACK) + 1e-6) break;
    const a = pts[i], b = pts[j], k = Math.ceil(dist(a, b) / DENSIFY_M);
    for (let s = 1; s <= k; s++) out.push(s === k ? b : { x: a.x + ((b.x - a.x) * s) / k, z: a.z + ((b.z - a.z) * s) / k });
  }
  return dedupe(out);
}

const permutations = (a: number[]): number[][] =>
  a.length <= 1 ? [a] : a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));

/**
 * The `count` cheapest walks from `from` through every objective in `todo` (all orders tried, ≤ 8 objectives),
 * counting the walk home when `home` is given. Cheapest first; equal costs keep the commander's order.
 * No objectives: the way home. Empty if a needed leg is unreachable.
 */
export function rankTours(L: Lattice, objectives: CostField[], home: CostField | null, from: XZ, todo: number[], count = 1): TourPlan[] {
  if (todo.length > 8) throw new Error('rankTours: at most 8 objectives');
  const memo = new Map<string, number>();
  const cost = (F: CostField, p: XZ, key: string) => memo.get(key) ?? memo.set(key, costFrom(L, F, p)).get(key)!;
  const goal = (i: number) => objectives[i].goal;
  const scored = (todo.length ? permutations([...todo].sort((a, b) => a - b)) : home ? [[]] : []).map((order) => {
    let litres = order.length ? cost(objectives[order[0]], from, `s${order[0]}`) : 0;
    for (let k = 1; k < order.length; k++) litres += cost(objectives[order[k]], goal(order[k - 1]), `${order[k - 1]}>${order[k]}`);
    if (home) litres += cost(home, order.length ? goal(order[order.length - 1]) : from, `h${order[order.length - 1] ?? ''}`);
    return { order, litres };
  });
  const tours: TourPlan[] = [];
  for (const { order, litres } of scored.filter((t) => t.litres < Infinity).sort((a, b) => a.litres - b.litres)) {
    if (tours.length >= count) break;
    const legs = order.map((i, k) => pathFrom(L, objectives[i], k ? goal(order[k - 1]) : from));
    const back = home ? pathFrom(L, home, order.length ? goal(order[order.length - 1]) : from) : [];
    if (!back || legs.some((leg) => !leg)) continue;
    tours.push(order.length ? { order, legs: legs as XZ[][], points: dedupe(legs.flat() as XZ[]), back, litres } : { order, legs: [], points: back, back: [], litres });
  }
  return tours;
}

/** The single cheapest tour (see rankTours), or null. */
export const planTour = (L: Lattice, objectives: CostField[], home: CostField | null, from: XZ, todo: number[]) =>
  rankTours(L, objectives, home, from, todo)[0] ?? null;

/** Distance from p to the nearest point of a polyline, metres. */
export function distanceToPath(pts: XZ[], p: XZ): number {
  let best = pts.length ? dist(pts[0], p) : Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], vx = pts[i + 1].x - a.x, vz = pts[i + 1].z - a.z, l2 = vx * vx + vz * vz;
    const f = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - vx * f, p.z - a.z - vz * f));
  }
  return best;
}

export const pathLength = (pts: XZ[]) => pts.reduce((m, p, i) => (i ? m + dist(pts[i - 1], p) : 0), 0);
