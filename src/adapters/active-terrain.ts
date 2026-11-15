// Alex-owned boundary: one in-memory demo surface for geometry, physics and planning.
import type { Grid } from '../shared/grids';
import type { Region } from '../core/contracts';
import { shapeTerrain, type SiteShaping } from '../terrain/siteShaping.ts';
import { createHeightGrid, type HeightProvider } from './world.ts';

export const DEMO_SHAPING: Readonly<SiteShaping> = Object.freeze({
  centre: Object.freeze({x:0,z:15}), closer:2, hills:1.6, landforms:0.25,
  padRadius:12, padBlend:12,
});

/** shaping: which site to shape around; defaults to DEMO_SHAPING (RAW diagnostics, tests). Rachel's Preview passes
 *  her ridge-field site (SITE_SHAPING in src/dev/Preview.tsx). The revision hash includes it, so it's always explicit. */
export async function createActiveTerrain(source: Grid<Float32Array>, region: Region, shaping: Readonly<SiteShaping> = DEMO_SHAPING) {
  // Rachel's blur/mirror shaping requires valid full coverage. Reject no-data rather
  // than filling holes or allowing invalid heights into either geometry or physics.
  if (source.data.length!==source.n*source.n || source.data.some(h=>!Number.isFinite(h)||Math.abs(h)>=1e30)) throw Error('Terrain unavailable: source grid contains no-data');
  const grid=shapeTerrain(source,shaping);
  if (grid.data.some(h=>!Number.isFinite(h)||Math.abs(h)>=1e30)) throw Error('Terrain unavailable: invalid shaped surface');
  const digest=async(data:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  const dataHash=await digest(grid.data.slice().buffer);
  const terrainRevision='sha256:'+await digest(new TextEncoder().encode(JSON.stringify({
    transform:'rachel-site-shaping-2bc2b2d-v1',config:shaping,dataHash,
    n:grid.n,cell:grid.cell,regionId:region.id,frameId:region.frameId,bounds:region.visibleBounds,
  })));
  const heights:HeightProvider={...createHeightGrid(grid.data.buffer as ArrayBuffer,grid.n,grid.cell,region.visibleBounds),
    contractVersion:1,regionId:region.id,frameId:region.frameId,terrainRevision,
    coverage:'bilinear-valid-cells',noDataPolicy:'reject-scene'};
  return {grid,heights};
}
