// Owner: Victor. Contract: TEAM-PLAN.md sections 2.3 and 2.6.
// Stub so other modules can import the signatures. Replace the bodies.
import type * as THREE from 'three';
import type { Meta } from '../shared/meta';

/** Loads tiles/{tx}_{ty}.bin (already in the local frame) and applies the given material. */
export async function loadTerrain(_meta: Meta, _material: THREE.Material): Promise<THREE.Group> {
  throw new Error('loadTerrain: not implemented yet (Victor)');
}

/** Bilinear height (metres, relative to h0) from grids/height_2m.bin. */
export function heightAt(_x: number, _z: number): number {
  throw new Error('heightAt: not implemented yet (Victor)');
}

/** 0 = lander visible, 1 = marginal, 2 = dead zone. */
export function commsAt(_x: number, _z: number): 0 | 1 | 2 {
  throw new Error('commsAt: not implemented yet (Victor)');
}
