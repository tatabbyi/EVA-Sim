// Written with AI assistance (Claude).
// Owner: Rachel. An EVA suit arm and glove, after NASA's EMU Phase VI gloves: painted off-white woven outer layer
// with Mars-dust smudges, grey rubber palm and fingertip pads, jointed fingers curled round a grip, a knuckle
// guard, a gauntlet cuff, an aluminium wrist bearing with a coloured band (red right, blue left) and a ribbed sleeve.
// Everything is padded: insulated EVA gloves and sleeves are thick and rounded (thermal micrometeoroid layers over
// a pressure bladder), so the fingers are fat, the back of the hand is a pillow and the gauntlet flares.
// pose() aims the glove so the wrist lines up with the forearm and the palm faces what it holds: a natural grip.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createNoiseTexture, createSuitCloth, SUIT_CLOTH_TILE_M } from './noiseTexture';

export interface SuitArm {
  /** Add this to the scene (world space). Contains the glove and the sleeve. */
  root: THREE.Group;
  /**
   * grip: where the hand holds (world). palmToward: a point the palm faces, e.g. the handle's centre (world).
   * elbow: where the forearm comes from (world). shoulder (optional): also draw the upper arm up to it, so the arm
   * doesn't end in mid-air when the elbow is in view.
   */
  pose(grip: THREE.Vector3, palmToward: THREE.Vector3, elbow: THREE.Vector3, shoulder?: THREE.Vector3): void;
  dispose(): void;
}

const RIBS = 6;

const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _b = new THREE.Vector3();

/**
 * The body's frame for placing arms and held tools: at the eye, turned with your heading but not your head's tilt
 * (x right, y straight up, -z forward). Arms placed in the camera's own frame swing round behind the head when you
 * look down at the ground, so they came into view from odd angles.
 */
export function headingFrame(camera: THREE.Object3D, out: THREE.Matrix4): THREE.Matrix4 {
  camera.updateMatrixWorld();
  const e = camera.matrixWorld.elements;
  _f.set(-e[8], 0, -e[10]); // where the eyes point, flattened
  if (-e[9] < 0) _f.add(_u.set(e[4], 0, e[6])); // looking down: the top of the head points the way you face too
  return out.makeRotationY(Math.atan2(-_f.x, -_f.z)).setPosition(_p.setFromMatrixPosition(camera.matrixWorld));
}

/**
 * Where the elbow goes for a hand at `grip`: a two-bone arm from the shoulder (upper arm, then forearm measured to the
 * grip point inside the glove), bending towards `bend` (world direction: down and out from the body). Out of reach:
 * the arm points straight at the grip.
 */
export function reachElbow(shoulder: THREE.Vector3, grip: THREE.Vector3, bend: THREE.Vector3, out: THREE.Vector3, upper = 0.3, fore = 0.42): THREE.Vector3 {
  _d.subVectors(grip, shoulder);
  const d = Math.max(1e-3, _d.length());
  _d.divideScalar(d);
  const r = Math.min(d, upper + fore - 1e-3);
  const along = (upper * upper - fore * fore + r * r) / (2 * r);
  const side = Math.sqrt(Math.max(0, upper * upper - along * along));
  _b.copy(bend).addScaledVector(_d, -bend.dot(_d));
  if (_b.lengthSq() < 1e-8) _b.set(0, -1, 0);
  return out.copy(shoulder).addScaledVector(_d, along).addScaledVector(_b.normalize(), side);
}

export function createSuitArm(side: 1 | -1): SuitArm {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // Woven suit cloth at true scale (ripstop grid, weave, dust; see createSuitCloth), with a soft fabric sheen.
  // Each part gets its own repeat, (its size) / SUIT_CLOTH_TILE_M, so the weave is the same size everywhere.
  const white = createSuitCloth('#ece8df', 0.6, side === 1 ? 3 : 9);
  const shade = createSuitCloth('#d6d0c3', 0.4, side === 1 ? 5 : 11);
  disposables.push(white.map, white.bump, shade.map, shade.bump);
  const cloth = (t: typeof white, widthM: number, lengthM: number) => {
    const map = keep(t.map.clone()), bump = keep(t.bump.clone());
    map.repeat.set(widthM / SUIT_CLOTH_TILE_M, lengthM / SUIT_CLOTH_TILE_M);
    bump.repeat.copy(map.repeat);
    return keep(new THREE.MeshPhysicalMaterial({
      map, bumpMap: bump, bumpScale: 0.9, roughness: 0.9,
      sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#fff4e2'),
    }));
  };
  const handCloth = cloth(white, 0.11, 0.11);
  const fingerCloth = cloth(white, 0.1, 0.06);
  const handShade = cloth(shade, 0.11, 0.11);
  const padShade = cloth(shade, 0.31, 0.16);
  const cuffShade = cloth(shade, 0.45, 0.1);
  const rollCloth = cloth(white, 0.5, 0.07);
  const sleeveCloth = cloth(white, 0.48, 0.5); // length repeat follows the forearm in pose()
  const ribCloth = cloth(shade, 0.48, 0.09);
  const grain = keep(createNoiseTexture(128, side === 1 ? 21 : 23, 4));
  const rubber = keep(new THREE.MeshStandardMaterial({ color: '#4a4c51', roughness: 0.78, bumpMap: grain, bumpScale: 0.6 }));
  const dustyRubber = keep(new THREE.MeshStandardMaterial({ color: '#5b4c44', roughness: 0.85, bumpMap: grain, bumpScale: 0.6 }));
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
  mesh(new RoundedBoxGeometry(0.108, 0.062, 0.112, 6, 0.029), handCloth, glove); // hand body: a padded pillow
  const backPad = mesh(new THREE.SphereGeometry(1, 28, 16), padShade, glove, 0, 0.022, 0.004); // insulated back of hand
  backPad.scale.set(0.05, 0.02, 0.052);
  mesh(new RoundedBoxGeometry(0.088, 0.014, 0.09, 3, 0.006), rubber, glove, 0, -0.031, -0.004); // palm pad
  mesh(new RoundedBoxGeometry(0.104, 0.022, 0.03, 4, 0.01), handShade, glove, 0, 0.03, -0.045); // knuckle guard

  const segGeo = (len: number, r: number) => {
    const g = new THREE.CapsuleGeometry(r, len, 4, 12);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -len / 2 - r * 0.5); // starts at the joint, extends along -Z
    return g;
  };
  const tipGeo = keep(new THREE.SphereGeometry(0.0145, 14, 10));
  const finger = (x: number, len1: number, len2: number, curl1: number, curl2: number, parent: THREE.Object3D) => {
    const knuckle = new THREE.Group();
    knuckle.position.set(x, -0.006, -0.052);
    knuckle.rotation.x = -curl1; // negative curls towards the palm
    parent.add(knuckle);
    mesh(segGeo(len1, 0.0158), fingerCloth, knuckle);
    const mid = new THREE.Group();
    mid.position.z = -len1 - 0.008;
    mid.rotation.x = -curl2;
    knuckle.add(mid);
    mesh(segGeo(len2, 0.015), fingerCloth, mid);
    const tip = new THREE.Mesh(tipGeo, dustyRubber); // rubber fingertip pad, dusty from the work
    tip.position.set(0, -0.005, -len2 - 0.013);
    tip.scale.set(1, 0.75, 1.1);
    mid.add(tip);
  };
  // fingers wrapped round a handle about 3 cm across
  [-1.5, -0.5, 0.5, 1.5].forEach((f, i) => finger(f * 0.026, [0.024, 0.028, 0.026, 0.02][i], 0.02, 1.0, 1.1, glove));
  // Thumb on the inner side: with the palm down and fingers forward, a right hand's thumb is on its left (-X).
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-side * 0.05, -0.014, -0.012);
  thumbBase.rotation.set(-0.5, -side * 0.85, 0);
  glove.add(thumbBase);
  finger(0, 0.022, 0.02, 0.5, 0.7, thumbBase);

  // Flared, padded gauntlet: a soft roll at its open end
  const cuff = mesh(new THREE.CylinderGeometry(0.062, 0.08, 0.1, 32), cuffShade, glove, 0, 0, 0.09);
  cuff.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.079, 0.011, 12, 40), rollCloth, glove, 0, 0, 0.138);
  mesh(new THREE.TorusGeometry(0.064, 0.004, 8, 36), rubber, glove, 0, 0, 0.05);
  const bearing = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.026, 40), metal, glove, 0, 0, 0.158);
  bearing.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.0705, 0.005, 8, 40), band, glove, 0, 0, 0.158);

  // ---------- sleeve ----------
  const tubeGeo = keep(new THREE.CylinderGeometry(0.072, 0.082, 1, 32, 1, true)); // thick insulated sleeve
  tubeGeo.translate(0, 0.5, 0); // base at the wrist, grows along +Y
  const tube = new THREE.Mesh(tubeGeo, sleeveCloth);
  root.add(tube);
  const ribGeo = keep(new THREE.TorusGeometry(0.076, 0.014, 12, 40)); // puffy bellows rings
  // Upper arm: elbow joint (a padded ball), the sleeve on up to the shoulder, and a shoulder cap.
  const upperGeo = keep(new THREE.CylinderGeometry(0.088, 0.08, 1, 32, 1, true));
  upperGeo.translate(0, 0.5, 0); // base at the elbow, grows along +Y
  const upperCloth = cloth(white, 0.53, 0.3);
  const upper = new THREE.Mesh(upperGeo, upperCloth);
  const elbowJoint = new THREE.Mesh(keep(new THREE.SphereGeometry(0.086, 24, 16)), cloth(shade, 0.54, 0.27));
  const shoulderCap = new THREE.Mesh(keep(new THREE.SphereGeometry(0.094, 24, 16)), cloth(shade, 0.59, 0.3));
  upper.visible = elbowJoint.visible = shoulderCap.visible = false;
  root.add(upper, elbowJoint, shoulderCap);
  const ribs = Array.from({ length: RIBS }, () => {
    const r = new THREE.Mesh(ribGeo, ribCloth);
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
    pose(grip, palmToward, elbow, shoulder) {
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

      wrist.set(0, 0, 0.172).applyMatrix4(glove.matrixWorld);
      dir.subVectors(elbow, wrist);
      const len = dir.length();
      dir.normalize();
      tube.position.copy(wrist);
      tube.quaternion.setFromUnitVectors(Y, dir);
      tube.scale.set(1, len, 1);
      sleeveCloth.map!.repeat.y = sleeveCloth.bumpMap!.repeat.y = len / SUIT_CLOTH_TILE_M; // weave not stretched
      q.setFromUnitVectors(Z, dir);
      ribs.forEach((r, i) => {
        r.position.copy(wrist).addScaledVector(dir, 0.035 + i * 0.03); // bellows joint just above the wrist
        r.quaternion.copy(q);
      });
      upper.visible = elbowJoint.visible = shoulderCap.visible = !!shoulder;
      if (shoulder) {
        elbowJoint.position.copy(elbow);
        dir.subVectors(shoulder, elbow);
        const up = dir.length();
        upper.position.copy(elbow);
        upper.quaternion.setFromUnitVectors(Y, dir.normalize());
        upper.scale.set(1, up, 1);
        upperCloth.map!.repeat.y = upperCloth.bumpMap!.repeat.y = up / SUIT_CLOTH_TILE_M;
        shoulderCap.position.copy(shoulder);
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
