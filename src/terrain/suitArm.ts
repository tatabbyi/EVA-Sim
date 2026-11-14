// Written with AI assistance (Claude).
// Owner: Rachel. An EVA suit arm and glove, after NASA's EMU Phase VI gloves: painted off-white woven outer layer
// with Mars-dust smudges, grey rubber palm and fingertip pads, jointed fingers curled round a grip, a knuckle
// guard, a gauntlet cuff, an aluminium wrist bearing with a coloured band (red right, blue left) and a ribbed sleeve.
// pose() aims the glove so the wrist lines up with the forearm and the palm faces what it holds: a natural grip.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createFabricTexture, createNoiseTexture, createWeaveTexture } from './noiseTexture';

export interface SuitArm {
  /** Add this to the scene (world space). Contains the glove and the sleeve. */
  root: THREE.Group;
  /**
   * grip: where the hand holds (world). palmToward: a point the palm faces, e.g. the handle's centre (world).
   * elbow: where the forearm comes from (world).
   */
  pose(grip: THREE.Vector3, palmToward: THREE.Vector3, elbow: THREE.Vector3): void;
  dispose(): void;
}

const RIBS = 6;

export function createSuitArm(side: 1 | -1): SuitArm {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const cloth = keep(createFabricTexture('#ece8df', 0.6, 256, side === 1 ? 3 : 9, 2));
  const clothShade = keep(createFabricTexture('#d6d0c3', 0.4, 256, side === 1 ? 5 : 11, 2));
  const weave = keep(createWeaveTexture(128, 10));
  const grain = keep(createNoiseTexture(128, side === 1 ? 21 : 23, 4));
  const fabric = keep(new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.93, bumpMap: weave, bumpScale: 0.004 }));
  const fabricShade = keep(new THREE.MeshStandardMaterial({ map: clothShade, roughness: 0.9, bumpMap: weave, bumpScale: 0.004 }));
  const rubber = keep(new THREE.MeshStandardMaterial({ color: '#4a4c51', roughness: 0.78, bumpMap: grain, bumpScale: 0.002 }));
  const dustyRubber = keep(new THREE.MeshStandardMaterial({ color: '#5b4c44', roughness: 0.85, bumpMap: grain, bumpScale: 0.002 }));
  const metal = keep(new THREE.MeshStandardMaterial({ color: '#b9c0c8', roughness: 0.28, metalness: 0.9 }));
  const band = keep(new THREE.MeshStandardMaterial({ color: side === 1 ? '#b3352b' : '#2f5fa8', roughness: 0.5 }));

  const root = new THREE.Group();

  // ---------- glove (local axes: fingers along -Z, palm facing -Y, wrist at +Z) ----------
  const glove = new THREE.Group();
  root.add(glove);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  mesh(new RoundedBoxGeometry(0.09, 0.046, 0.1, 4, 0.02), fabric, glove); // hand body
  mesh(new RoundedBoxGeometry(0.074, 0.01, 0.08, 2, 0.004), rubber, glove, 0, -0.024, -0.004); // palm pad
  mesh(new RoundedBoxGeometry(0.084, 0.014, 0.024, 2, 0.006), fabricShade, glove, 0, 0.025, -0.038); // knuckle guard

  const segGeo = (len: number, r: number) => {
    const g = new THREE.CapsuleGeometry(r, len, 4, 12);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -len / 2 - r * 0.5); // starts at the joint, extends along -Z
    return g;
  };
  const tipGeo = keep(new THREE.SphereGeometry(0.0105, 12, 10));
  const finger = (x: number, len1: number, len2: number, curl1: number, curl2: number, parent: THREE.Object3D) => {
    const knuckle = new THREE.Group();
    knuckle.position.set(x, -0.004, -0.048);
    knuckle.rotation.x = -curl1; // negative curls towards the palm
    parent.add(knuckle);
    mesh(segGeo(len1, 0.0115), fabric, knuckle);
    const mid = new THREE.Group();
    mid.position.z = -len1 - 0.006;
    mid.rotation.x = -curl2;
    knuckle.add(mid);
    mesh(segGeo(len2, 0.0108), fabric, mid);
    const tip = new THREE.Mesh(tipGeo, dustyRubber); // rubber fingertip pad, dusty from the work
    tip.position.set(0, -0.004, -len2 - 0.01);
    tip.scale.set(1, 0.75, 1.1);
    mid.add(tip);
  };
  // fingers wrapped round a handle about 3 cm across
  [-1.5, -0.5, 0.5, 1.5].forEach((f, i) => finger(f * 0.022, [0.026, 0.03, 0.028, 0.022][i], 0.022, 1.05, 1.15, glove));
  const thumbBase = new THREE.Group();
  thumbBase.position.set(side * 0.042, -0.012, -0.012);
  thumbBase.rotation.set(-0.5, side * 0.85, 0);
  glove.add(thumbBase);
  finger(0, 0.022, 0.02, 0.5, 0.7, thumbBase);

  const cuff = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 28), fabricShade, glove, 0, 0, 0.085);
  cuff.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.055, 0.0025, 6, 32), rubber, glove, 0, 0, 0.085);
  const bearing = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.024, 36), metal, glove, 0, 0, 0.142);
  bearing.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.0585, 0.0045, 8, 36), band, glove, 0, 0, 0.142);

  // ---------- sleeve ----------
  const tubeGeo = keep(new THREE.CylinderGeometry(0.056, 0.062, 1, 28, 1, true));
  tubeGeo.translate(0, 0.5, 0); // base at the wrist, grows along +Y
  const tube = new THREE.Mesh(tubeGeo, fabric);
  root.add(tube);
  const ribGeo = keep(new THREE.TorusGeometry(0.06, 0.008, 10, 36));
  const ribs = Array.from({ length: RIBS }, () => {
    const r = new THREE.Mesh(ribGeo, fabricShade);
    root.add(r);
    return r;
  });

  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3(), palm = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const wrist = new THREE.Vector3(), dir = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion();

  return {
    root,
    pose(grip, palmToward, elbow) {
      // Glove axes: +Z towards the elbow (wrist straight along the forearm), -Y towards the handle (palm on it).
      z.subVectors(elbow, grip).normalize();
      palm.subVectors(palmToward, grip);
      palm.addScaledVector(z, -palm.dot(z)).normalize();
      y.copy(palm).negate();
      x.crossVectors(y, z).normalize();
      basis.makeBasis(x, y, z);
      glove.quaternion.setFromRotationMatrix(basis);
      glove.position.copy(grip);
      glove.updateMatrixWorld(true);

      wrist.set(0, 0, 0.156).applyMatrix4(glove.matrixWorld);
      dir.subVectors(elbow, wrist);
      const len = dir.length();
      dir.normalize();
      tube.position.copy(wrist);
      tube.quaternion.setFromUnitVectors(Y, dir);
      tube.scale.set(1, len, 1);
      q.setFromUnitVectors(Z, dir);
      ribs.forEach((r, i) => {
        r.position.copy(wrist).addScaledVector(dir, 0.03 + i * 0.026); // bellows joint just above the wrist
        r.quaternion.copy(q);
      });
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
