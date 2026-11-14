// Written with AI assistance (Codex). App-owned adapter; Victor's files/formats remain untouched.
import type { Meta } from '../shared/meta';
import { validateBounds, contains, type Bounds, type Mission, type Region } from '../core/contracts.ts';
export type HeightGrid = { bounds: Bounds; cellMetres: number; heightAt(x: number, z: number): number | null; coversArea(area: Bounds): boolean };
export type HeightProvider = HeightGrid & { contractVersion: 1; regionId: string; frameId: string; terrainRevision: string; coverage: 'bilinear-valid-cells'; noDataPolicy: 'reject-scene' };
export function createHeightGrid(buffer: ArrayBuffer, n: number, cell: number, bounds: Bounds): HeightGrid {
  validateBounds(bounds);
  if (!Number.isSafeInteger(n) || n < 2 || !Number.isFinite(cell) || cell <= 0 || buffer.byteLength !== n*n*4 || Math.abs(bounds.maxX-bounds.minX-(n-1)*cell) > 0.001 || Math.abs(bounds.maxZ-bounds.minZ-(n-1)*cell) > 0.001) throw new Error('Invalid height grid size/extent');
  bounds = Object.freeze({ ...bounds });
  const view = new DataView(buffer);
  const data = new Float32Array(n*n);
  for (let i=0; i<data.length; i++) data[i] = view.getFloat32(i*4, true);
  const valid = (v: number) => Number.isFinite(v) && Math.abs(v) < 1e30;
  return { bounds, cellMetres: cell,
    coversArea(area) {
      if (!contains(bounds, { x: area.minX, z: area.minZ }) || !contains(bounds, { x: area.maxX, z: area.maxZ }) || area.minX > area.maxX || area.minZ > area.maxZ) return false;
      // Include all bilinear neighbours of every cell touched by the rectangle.
      const c0 = Math.min(n-2, Math.floor((area.minX-bounds.minX)/cell));
      const c1 = Math.min(n-2, Math.floor((area.maxX-bounds.minX)/cell));
      const r0 = Math.min(n-2, Math.floor((area.minZ-bounds.minZ)/cell));
      const r1 = Math.min(n-2, Math.floor((area.maxZ-bounds.minZ)/cell));
      for (let r=r0; r<=r1+1; r++) for (let c=c0; c<=c1+1; c++) if (!valid(data[r*n+c])) return false;
      return true;
    }, heightAt(x, z) {
    if (!contains(bounds, { x, z })) return null;
    const col = (x-bounds.minX)/cell, row = (z-bounds.minZ)/cell;
    const c = Math.min(n-2, Math.floor(col)), r = Math.min(n-2, Math.floor(row));
    const a = data[r*n+c], b = data[r*n+c+1], d = data[(r+1)*n+c], e = data[(r+1)*n+c+1];
    if (![a,b,d,e].every(valid)) return null;
    const u = col-c, v = row-r;
    return (a*(1-u)+b*u)*(1-v)+(d*(1-u)+e*u)*v;
  } };
}
export function demoMission(region: Region): Mission {
  const b = region.playableBounds, x = (b.minX+b.maxX)/2 + 12, z = (b.minZ+b.maxZ)/2 + 12;
  const shuttle = { x, z };
  const tasks: Mission['tasks'] = [ { id: 'demo-core-01', type: 'take-core', position: { x: x+24, z: z-32 }, status: 'pending' }, { id: 'demo-moxie-02', type: 'run-moxie', position: { x: x-24, z: z-64 }, status: 'pending' } ];
  return { regionId: region.id, shuttle, tasks, route: { source: 'demo', points: [shuttle,...tasks.map(t => t.position), shuttle] } };
}
export async function loadDemoWorld(signal?: AbortSignal, base = import.meta.env?.BASE_URL ?? '/') {
  const metaResponse = await fetch(`${base}data/meta.json`, { signal });
  if (!metaResponse.ok) throw new Error(`Missing terrain metadata: HTTP ${metaResponse.status}`);
  const meta: Meta = await metaResponse.json();
  const grid = meta.grids?.height_4m;
  if (!grid || grid.type !== 'float32' || !/^grids\/[a-zA-Z0-9_-]+\.bin$/.test(grid.file) || !Number.isFinite(meta.boxMetres) || meta.boxMetres <= 200 || typeof meta.crs !== 'string' || !meta.origin || ![meta.origin.X,meta.origin.Y,meta.origin.h0].every(Number.isFinite)) throw new Error('Invalid demo metadata');
  const half = meta.boxMetres/2;
  const visibleBounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };
  const region: Region = { id: 'jezero-4m-demo', frameId: 'octavia-e-butler-local-metres-v1', crs: meta.crs, origin: { ...meta.origin }, visibleBounds, playableBounds: { minX: -half+100, maxX: half-100, minZ: -half+100, maxZ: half-100 } };
  const response = await fetch(`${base}${grid.file}`, { signal });
  if (!response.ok) throw new Error(`Missing 4m terrain: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  // Bind bytes AND coordinate/sampling interpretation; a changed transform invalidates old plans.
  const bytesHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), v => v.toString(16).padStart(2,'0')).join('');
  const descriptor = JSON.stringify({ bytesHash, region, n: grid.n, cell: grid.cell, encoding: 'float32-le', noData: 'finite-abs-less-than-1e30' });
  const terrainRevision = 'sha256:' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(descriptor))), v => v.toString(16).padStart(2,'0')).join('');
  region.terrainRevision = terrainRevision;
  const heights: HeightProvider = { ...createHeightGrid(buffer, grid.n, grid.cell, visibleBounds), contractVersion: 1, regionId: region.id, frameId: region.frameId, terrainRevision, coverage: 'bilinear-valid-cells', noDataPolicy: 'reject-scene' };
  return { region, heights, mission: demoMission(region) };
}
