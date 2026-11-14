// Written with AI assistance (Claude).
// Owner: Rachel. Your EVA suit, waiting on its donning stand beside the airlock hatch inside the base: the same suit
// you see from inside on the EVA (white ripstop outer layer, red right / blue left wrist bands, the same gloves and
// arms from suitArm.ts, a clear bubble helmet with no gold visor). Built after NASA's EMU: hard upper torso with the
// display and control module on the chest, life-support backpack (PLSS) with the secondary oxygen pack under it,
// bearings at the neck, shoulders and waist, bellows at the knees, lunar-style boots.
// The stand holds the suit by its backpack, boots resting on a foot plate. Pressing E on it (or the hatch) suits up.
// Local frame: the suit faces +Z, +Y up, origin on the floor under it.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createSuitArm } from './suitArm';
import { createSuitCloth, SUIT_CLOTH_TILE_M } from './noiseTexture';

export interface SuitStand {
  /** Add to the scene. Position and turn it with the group itself (it faces +Z). */
  group: THREE.Group;
  /** Meshes to aim at (looking at the suit and pressing E suits up). */
  targets: THREE.Object3D[];
  dispose(): void;
}

export function createSuitStand(): SuitStand {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const group = new THREE.Group();
  const suit = new THREE.Group();
  suit.position.y = 0.04; // standing on the foot plate
  group.add(suit);
  const targets: THREE.Object3D[] = [];
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = suit, target = true) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    if (target) targets.push(m);
    return m;
  };

  // ---------- materials ----------
  const white = createSuitCloth('#ece8df', 0.25, 31);
  const shade = createSuitCloth('#d9d3c6', 0.2, 37);
  disposables.push(white.map, white.bump, shade.map, shade.bump);
  /** Suit cloth with the weave at true size: widthM x lengthM is the size of the part it covers. */
  const cloth = (t: typeof white, widthM: number, lengthM: number) => {
    const map = keep(t.map.clone()), bump = keep(t.bump.clone());
    map.repeat.set(widthM / SUIT_CLOTH_TILE_M, lengthM / SUIT_CLOTH_TILE_M);
    bump.repeat.copy(map.repeat);
    return keep(new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 0.9, roughness: 0.9, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#fff4e2') }));
  };
  const shell = keep(new THREE.MeshStandardMaterial({ color: '#eceae6', roughness: 0.35, metalness: 0.05 })); // hard parts
  const metal = keep(new THREE.MeshStandardMaterial({ color: '#b9c0c8', roughness: 0.28, metalness: 0.9 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: '#2f3237', roughness: 0.6 }));
  const rubber = keep(new THREE.MeshStandardMaterial({ color: '#4a4c51', roughness: 0.85 }));
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: '#e8f2f8', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, clearcoat: 1 }));
  const lampLens = keep(new THREE.MeshBasicMaterial({ color: '#fff3d6' }));
  const display = keep(new THREE.MeshStandardMaterial({ color: '#10151b', roughness: 0.2, emissive: '#4fd1a5', emissiveIntensity: 0.25 }));

  // ---------- legs and boots ----------
  for (const sx of [-1, 1]) {
    const x = sx * 0.12;
    put(new RoundedBoxGeometry(0.15, 0.03, 0.31, 2, 0.012), rubber, x, 0.015, 0.03); // sole
    put(new RoundedBoxGeometry(0.15, 0.13, 0.29, 4, 0.05), cloth(shade, 0.44, 0.29), x, 0.09, 0.03); // boot
    const shin = put(new THREE.CylinderGeometry(0.086, 0.074, 0.34, 28), cloth(white, 0.52, 0.34), x, 0.32, 0);
    shin.rotation.z = sx * 0.02;
    for (let i = 0; i < 3; i++) put(new THREE.TorusGeometry(0.087, 0.017, 10, 32), cloth(shade, 0.55, 0.1), x, 0.5 + i * 0.035, 0).rotation.x = Math.PI / 2; // knee bellows
    put(new THREE.CylinderGeometry(0.106, 0.092, 0.33, 28), cloth(white, 0.64, 0.33), x, 0.73, 0); // thigh
  }
  // brief (lower torso) and the waist bearing
  const brief = put(new THREE.SphereGeometry(1, 32, 20), cloth(white, 0.9, 0.5), 0, 0.94, 0);
  brief.scale.set(0.23, 0.15, 0.16);
  put(new THREE.TorusGeometry(0.2, 0.022, 10, 48), metal, 0, 1.06, 0).rotation.x = Math.PI / 2;

  // ---------- hard upper torso, chest controls, backpack ----------
  put(new RoundedBoxGeometry(0.5, 0.46, 0.32, 6, 0.13), cloth(white, 1.1, 0.5), 0, 1.3, 0); // HUT under its cloth cover
  put(new RoundedBoxGeometry(0.3, 0.12, 0.1, 3, 0.025), shell, 0, 1.2, 0.2); // display and control module
  put(new THREE.PlaneGeometry(0.11, 0.045), display, -0.06, 1.225, 0.251);
  for (const [kx, kc] of [[0.05, '#2f3237'], [0.095, '#b3352b']] as const) {
    const knob = put(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 14), keep(new THREE.MeshStandardMaterial({ color: kc, roughness: 0.5 })), kx, 1.215, 0.258);
    knob.rotation.x = Math.PI / 2;
  }
  put(new THREE.BoxGeometry(0.2, 0.012, 0.012), dark, 0, 1.165, 0.252); // purge valve rail
  put(new RoundedBoxGeometry(0.56, 0.68, 0.22, 5, 0.05), shell, 0, 1.33, -0.27); // PLSS
  put(new RoundedBoxGeometry(0.5, 0.15, 0.2, 4, 0.04), shell, 0, 0.94, -0.26); // secondary oxygen pack
  for (const sy of [1.12, 1.5]) put(new THREE.BoxGeometry(0.5, 0.01, 0.005), dark, 0, sy, -0.157, suit, false); // panel seams
  // shoulder bearings, sideways rings
  for (const sx of [-1, 1]) put(new THREE.TorusGeometry(0.095, 0.018, 10, 36), metal, sx * 0.265, 1.44, 0).rotation.y = Math.PI / 2;

  // ---------- helmet: neck ring, clear bubble, white back shell, two lamps ----------
  put(new THREE.TorusGeometry(0.155, 0.026, 12, 48), metal, 0, 1.56, 0.01).rotation.x = Math.PI / 2;
  const bubble = put(new THREE.SphereGeometry(0.19, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.62), glass, 0, 1.6, 0.02);
  bubble.renderOrder = 2;
  put(new THREE.SphereGeometry(0.2, 40, 28, Math.PI, Math.PI, 0, Math.PI * 0.6), shell, 0, 1.6, 0.02); // back half (z < 0)
  for (const sx of [-1, 1]) {
    const lamp = put(new THREE.CylinderGeometry(0.03, 0.034, 0.07, 18), shell, sx * 0.2, 1.68, 0.03);
    lamp.rotation.x = Math.PI / 2;
    put(new THREE.CircleGeometry(0.026, 18), lampLens, sx * 0.2, 1.68, 0.066, suit, false);
  }

  // ---------- arms: the same arms and gloves as on the EVA, hanging relaxed, palms in ----------
  // pose() works in its root's own frame, so each arm is posed on its own first, then put in the suit.
  for (const side of [1, -1] as const) {
    const arm = createSuitArm(side);
    disposables.push(arm);
    const x = -side * 0.33; // the suit faces +Z, so its right hand is on -X
    arm.pose(
      new THREE.Vector3(x * 1.06, 0.8, 0.05), // hand
      new THREE.Vector3(0, 0.8, 0.05), // palm faces the thigh
      new THREE.Vector3(x * 1.04, 1.17, -0.03), // elbow
      new THREE.Vector3(x * 0.88, 1.44, 0), // shoulder
    );
    suit.add(arm.root);
    arm.root.traverse((o) => void ((o as THREE.Mesh).isMesh && targets.push(o)));
  }

  // ---------- donning stand: foot plate, two posts against the wall, a cradle for the backpack ----------
  const frame = keep(new THREE.MeshStandardMaterial({ color: '#d9d5cd', roughness: 0.5, metalness: 0.1 }));
  put(new RoundedBoxGeometry(0.62, 0.04, 0.52, 3, 0.012), frame, 0, 0.02, -0.02, group);
  for (const sx of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.025, 0.025, 1.62, 12), metal, sx * 0.2, 0.81, -0.43, group);
    const arm = put(new THREE.BoxGeometry(0.04, 0.04, 0.08), metal, sx * 0.2, 1.36, -0.39, group);
    arm.castShadow = true;
  }
  put(new THREE.BoxGeometry(0.46, 0.05, 0.03), metal, 0, 1.36, -0.39, group); // cradle bar
  put(new THREE.BoxGeometry(0.46, 0.04, 0.03), metal, 0, 0.3, -0.43, group); // lower brace

  return {
    group,
    targets,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
