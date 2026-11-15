// Written with AI assistance (Claude). Owner: Nanda. The maths behind the phone controls (touchControls.ts), kept
// pure so the tests can check it.

import * as THREE from 'three';

const euler = new THREE.Euler(), q = new THREE.Quaternion(), q0 = new THREE.Quaternion(), zee = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // the camera looks out of the screen, not along it

/**
 * Where the phone's camera looks, from its orientation sensor (degrees: alpha compass, beta front/back tilt, gamma
 * left/right tilt) and the screen's rotation (0, 90, 180, 270). Yaw + is to the left, pitch 0 is the horizon, + up.
 * (The standard W3C orientation to a camera, as three.js's DeviceOrientationControls did.)
 */
export function deviceLook(alpha: number, beta: number, gamma: number, screenAngle: number): { yaw: number; pitch: number } {
  const d = Math.PI / 180;
  euler.set(beta * d, alpha * d, -gamma * d, 'YXZ');
  q.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -screenAngle * d));
  euler.setFromQuaternion(q, 'YXZ');
  return { yaw: euler.y, pitch: euler.x };
}

/** The stick: finger offset (px, y down) on a stick of `radius` px → forward/side in -1..1 (a small dead zone), run at the rim. */
export function stickVector(dx: number, dy: number, radius: number): { forward: number; side: number; run: boolean } {
  const len = Math.hypot(dx, dy), r = Math.min(1, len / radius);
  if (r < 0.15) return { forward: 0, side: 0, run: false };
  const k = (r - 0.15) / 0.85 / len; // rescaled past the dead zone
  return { forward: -dy * k || 0, side: dx * k || 0, run: r > 0.92 };
}
