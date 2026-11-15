// Written with AI assistance (Claude).
// Owner: Rachel. The EVA site, shaped for the demo from real terrain. The site is a real Jezero ridge field (HiRISE
// DTM, west of the delta front), but at true scale its ridges are low and far apart, so the path planner rarely needs
// to go round them. Here its small hills are brought closer together and made taller, and the big landforms (the
// delta scarp) are flattened, so the planner visibly weaves between hills in a small area:
//   height = big landforms x `landforms` + small hills x `hills`, sampled `closer` times closer together round the base.
// "Small hills" are the height minus a 40 m blur of it; "big landforms" are that blur. Where the drawing-in reaches
// past the edge of the data, the big landforms are mirrored back in and the small hills fade out over 100 m, so the
// ridge field ends in open plain (no mirror-image hills, no smeared edges). The base stands on a levelled pad (as a real habitat
// would), blended smoothly into the ground around it.
// Everything uses the shaped heights: the 3D ground, the path planner, the route checks and the plan map.
// ?terrain=real in the address skips the shaping (true-scale terrain).

import type { Grid } from '../shared/grids';
import type { XZ } from '../sim/pathfind';

export interface SiteShaping {
  /** Where the shaping is centred (the base): it stays put, everything else is drawn in towards it. */
  centre: XZ;
  /** How many times closer together the hills are. */
  closer: number;
  /** How many times taller the small hills are. */
  hills: number;
  /** How tall the big landforms stay (fraction). */
  landforms: number;
  /** Levelled pad under the base: flat out to padRadius metres, blending into the ground over padBlend more. */
  padRadius: number;
  padBlend: number;
}

const BLUR_M = 40; // what counts as a big landform: wider than about this
const EDGE_FADE_M = 100; // past the edge of the data, small hills fade out over this distance

/** Separable Gaussian blur of an n x n grid, sigma in samples, edges clamped. */
function blur(src: Float32Array, n: number, sigma: number): Float32Array {
  const k = Math.ceil(3 * sigma), w = new Float32Array(2 * k + 1);
  let sum = 0;
  for (let i = -k; i <= k; i++) sum += w[i + k] = Math.exp((-i * i) / (2 * sigma * sigma));
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let r = 0; r < n; r++) {
    const row = r * n;
    for (let c = 0; c < n; c++) {
      let a = 0;
      for (let i = -k; i <= k; i++) a += w[i + k] * src[row + Math.min(n - 1, Math.max(0, c + i))];
      tmp[row + c] = a;
    }
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let a = 0;
      for (let i = -k; i <= k; i++) a += w[i + k] * tmp[Math.min(n - 1, Math.max(0, r + i)) * n + c];
      out[r * n + c] = a;
    }
  }
  return out;
}

/** Returns a new grid with the shaped heights (same size and spacing as the input). */
export function shapeTerrain(grid: Grid<Float32Array>, s: SiteShaping): Grid<Float32Array> {
  const { n, cell, data } = grid;
  const half = ((n - 1) * cell) / 2;
  const low = blur(data, n, BLUR_M / cell);
  // Mirror any coordinate back into the data (a triangle wave), so there are no smeared edges.
  const mirror = (v: number) => {
    const p = 4 * half;
    let u = (((v + half) % p) + p) % p;
    if (u > 2 * half) u = p - u;
    return u - half;
  };
  const sample = (arr: Float32Array, x: number, z: number) => {
    const c = Math.min(n - 1, Math.max(0, (x + half) / cell)), r = Math.min(n - 1, Math.max(0, (z + half) / cell));
    const c0 = Math.floor(c), r0 = Math.floor(r), c1 = Math.min(n - 1, c0 + 1), r1 = Math.min(n - 1, r0 + 1), tc = c - c0, tr = r - r0;
    return (arr[r0 * n + c0] * (1 - tc) + arr[r0 * n + c1] * tc) * (1 - tr) + (arr[r1 * n + c0] * (1 - tc) + arr[r1 * n + c1] * tc) * tr;
  };
  const ref = sample(low, s.centre.x, s.centre.z);
  const out = new Float32Array(n * n);
  for (let r = 0; r < n; r++) {
    const z = r * cell - half, uz = s.centre.z + (z - s.centre.z) * s.closer, sz = mirror(uz);
    const ez = Math.max(0, Math.abs(uz) - half);
    for (let c = 0; c < n; c++) {
      const x = c * cell - half, ux = s.centre.x + (x - s.centre.x) * s.closer, sx = mirror(ux);
      const e = Math.min(1, Math.hypot(Math.max(0, Math.abs(ux) - half), ez) / EDGE_FADE_M); // 0 inside the data
      const lo = sample(low, sx, sz);
      out[r * n + c] = ref + s.landforms * (lo - ref) + s.hills * (1 - e * e * (3 - 2 * e)) * (sample(data, sx, sz) - lo);
    }
  }
  // Levelled pad under the base: its height is the average of the ground out to the middle of the blend (so it sits
  // level with its surroundings, not on a terrace), blended out with a smoothstep.
  const reach = s.padRadius + s.padBlend;
  const r0 = Math.max(0, Math.floor((s.centre.z - reach + half) / cell)), r1 = Math.min(n - 1, Math.ceil((s.centre.z + reach + half) / cell));
  const c0 = Math.max(0, Math.floor((s.centre.x - reach + half) / cell)), c1 = Math.min(n - 1, Math.ceil((s.centre.x + reach + half) / cell));
  let padSum = 0, padN = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (Math.hypot(c * cell - half - s.centre.x, r * cell - half - s.centre.z) <= s.padRadius + s.padBlend / 2) {
        padSum += out[r * n + c];
        padN++;
      }
    }
  }
  const padH = padN ? padSum / padN : ref;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d = Math.hypot(c * cell - half - s.centre.x, r * cell - half - s.centre.z);
      const t = Math.min(1, Math.max(0, (d - s.padRadius) / s.padBlend));
      const w = 1 - t * t * (3 - 2 * t);
      out[r * n + c] += (padH - out[r * n + c]) * w;
    }
  }
  return { data: out, n, cell };
}
