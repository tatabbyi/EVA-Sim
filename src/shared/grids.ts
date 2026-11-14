// Written with AI assistance (Claude).
// Loading and sampling the shared .bin grids. Contract: TEAM-PLAN.md section 2.2.
// Sample (row, col) sits at x = col*cell - half, z = row*cell - half. Row 0 = north edge. Little-endian, no header.

import { BOX_HALF } from './coords';

export interface Grid<T extends Float32Array | Uint8Array> {
  data: T;
  n: number;
  cell: number;
}

async function fetchBin(path: string, expectedBytes: number): Promise<ArrayBuffer | null> {
  const res = await fetch(path);
  // Vite's dev server answers missing files with index.html, so check the type and size too.
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength !== expectedBytes) {
    console.warn(`${path}: expected ${expectedBytes} bytes, got ${buf.byteLength}`);
    return null;
  }
  return buf;
}

/** Returns null if the file is missing or the wrong size. */
export async function loadFloatGrid(path: string, n: number, cell: number): Promise<Grid<Float32Array> | null> {
  const buf = await fetchBin(path, n * n * 4);
  return buf ? { data: new Float32Array(buf), n, cell } : null;
}

export async function loadByteGrid(path: string, n: number, cell: number): Promise<Grid<Uint8Array> | null> {
  const buf = await fetchBin(path, n * n);
  return buf ? { data: new Uint8Array(buf), n, cell } : null;
}

/** Continuous grid coordinates: integer values are sample centres. */
export function gridCoord(grid: Grid<Float32Array | Uint8Array>, x: number, z: number) {
  return { col: (x + BOX_HALF) / grid.cell, row: (z + BOX_HALF) / grid.cell };
}

export function sampleNearest(grid: Grid<Float32Array | Uint8Array>, x: number, z: number): number {
  const { col, row } = gridCoord(grid, x, z);
  const c = Math.min(grid.n - 1, Math.max(0, Math.round(col)));
  const r = Math.min(grid.n - 1, Math.max(0, Math.round(row)));
  return grid.data[r * grid.n + c];
}

export function sampleBilinear(grid: Grid<Float32Array>, x: number, z: number): number {
  const { col, row } = gridCoord(grid, x, z);
  const n = grid.n;
  const c = Math.min(n - 1, Math.max(0, col));
  const r = Math.min(n - 1, Math.max(0, row));
  const c0 = Math.floor(c), r0 = Math.floor(r);
  const c1 = Math.min(n - 1, c0 + 1), r1 = Math.min(n - 1, r0 + 1);
  const tc = c - c0, tr = r - r0;
  const d = grid.data;
  const top = d[r0 * n + c0] * (1 - tc) + d[r0 * n + c1] * tc;
  const bot = d[r1 * n + c0] * (1 - tc) + d[r1 * n + c1] * tc;
  return top * (1 - tr) + bot * tr;
}
