// Owner: Alex. Contract: TEAM-PLAN.md section 2.6, notes in research/08-mars-time.md.
// mars-date-utils wants WEST longitude: Jezero = 360 - 77.4508 = 282.5492.
import type * as THREE from 'three';

export const JEZERO_LAT = 18.4447;
export const JEZERO_LON_WEST = 282.5492;

/** Unit vector towards the sun in the local frame (x east, y up, z south). */
export function sunDirection(_date: Date): THREE.Vector3 {
  throw new Error('sunDirection: not implemented yet (Alex)');
}

/** One-way Earth to Mars light time, seconds. */
export function lightDelaySeconds(_date: Date): number {
  throw new Error('lightDelaySeconds: not implemented yet (Alex)');
}
