// Written with AI assistance (Claude).
// Owner: Rachel. A rock-sample stop: an objective beacon, a rock, and the animated coring sequence
// (modelled on Perseverance's sampling: abrade, core, seal and stow; research/10).
//   lowering (1.0 s): held in both gloved hands, the corer comes down onto the rock (you kneel beside it)
//   drilling (3.0 s): bit spins, tool vibrates, rock dust sprays and falls in Mars gravity, a fresh patch appears
//   raising  (0.8 s): the corer lifts out with the rock core inside
//   stowing  (0.9 s): the corer comes back towards the suit and is put away
// Game rules (when you can sample, what it counts towards) belong to the caller (Alex).

import * as THREE from 'three';
import { palette } from '../ui/palette';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoiseTexture } from './noiseTexture';
import { createWaypointBeacon } from './beacon';
import { createSuitArm } from './suitArm';

export type SampleState = 'idle' | 'lowering' | 'drilling' | 'raising' | 'stowing' | 'done';

const PHASES: [SampleState, number][] = [
  ['lowering', 1.0],
  ['drilling', 3.0],
  ['raising', 0.8],
  ['stowing', 0.9],
];
const TOTAL = PHASES.reduce((sum, [, d]) => sum + d, 0);
const MARS_G = 3.71; // m/s²
const DUST = 90;

export interface SampleSite {
  group: THREE.Group;
  /** World position of the spot that gets drilled (top of the rock). */
  rockTop: THREE.Vector3;
  readonly state: SampleState;
  /** 0 to 1 across the whole sequence. */
  readonly progress: number;
  /** Starts the sequence. Returns false if already sampled or running. */
  start(): boolean;
  update(dt: number, timeSeconds: number, camera: THREE.Camera): void;
  dispose(): void;
}

const ease = (x: number) => x * x * (3 - 2 * x);

export function rockGeometry(seed: number): THREE.BufferGeometry {
  // Many small triangles, welded so the shading is smooth; layered bumps make it read as real stone up close.
  const ico = new THREE.IcosahedronGeometry(0.34, 6);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const geo = mergeVertices(ico);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const bump =
      Math.sin(v.x * 9 + seed) * 0.5 +
      Math.sin(v.y * 13 + seed * 2) * 0.3 +
      Math.sin(v.z * 11 - seed) * 0.4 +
      Math.sin((v.x + v.z) * 23 + seed) * 0.15 +
      Math.sin(v.x * 61 + v.y * 47 + seed * 3) * 0.06 +
      Math.sin(v.z * 83 - v.y * 71 + seed) * 0.04;
    v.multiplyScalar(1 + bump * 0.12);
    pos.setXYZ(i, v.x * 1.15, v.y * 0.62, v.z * 0.95); // a squat boulder
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}

/**
 * ground: world position on the terrain where the rock sits. seed varies the rock shape.
 */
export function createSampleSite(ground: THREE.Vector3, seed = 1): SampleSite {
  const group = new THREE.Group();
  group.name = 'sample-site';
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // Beacon so the stop can be seen from far away
  const beacon = createWaypointBeacon({ color: palette.objective, height: 14, radius: 0.2 });
  beacon.group.position.copy(ground);
  group.add(beacon.group);

  // Rock
  const rockGeo = keep(rockGeometry(seed));
  const grain = keep(createNoiseTexture(256, seed * 17 + 3, 4));
  const rockMat = keep(new THREE.MeshStandardMaterial({ color: '#6e5a4a', roughness: 0.96, bumpMap: grain, bumpScale: 0.006 }));
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.position.copy(ground).add(new THREE.Vector3(0, 0.1, 0));
  rock.rotation.y = seed * 1.7;
  group.add(rock);
  const rockTop = rock.position.clone().add(new THREE.Vector3(0, rockGeo.boundingBox!.max.y, 0));

  // Fresh abraded patch that grows while drilling
  const freshMat = keep(new THREE.MeshStandardMaterial({ color: '#b8a189', roughness: 0.7 }));
  const patch = new THREE.Mesh(keep(new THREE.CircleGeometry(0.07, 28)), freshMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.copy(rockTop).add(new THREE.Vector3(0, 0.004, 0));
  patch.scale.setScalar(0.001);
  group.add(patch);

  // Corer: suit-cream housing, dark grip, steel bit, status light. Origin at the bit tip.
  const cream = keep(new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: 0.55 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.7 }));
  const steel = keep(new THREE.MeshStandardMaterial({ color: '#c3cad2', roughness: 0.25, metalness: 0.9 }));
  const lightMat = keep(new THREE.MeshBasicMaterial({ color: palette.ok }));
  const tool = new THREE.Group();
  const housing = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.07, 0.26, 20)), cream);
  housing.position.y = 0.33;
  const grip = new THREE.Mesh(keep(new THREE.BoxGeometry(0.035, 0.17, 0.05)), dark);
  grip.position.set(0.095, 0.36, 0);
  const statusLight = new THREE.Mesh(keep(new THREE.SphereGeometry(0.012, 10, 8)), lightMat);
  statusLight.position.set(0, 0.42, 0.066);
  const bit = new THREE.Group();
  const shaft = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 14)), steel);
  shaft.position.y = 0.11;
  const teeth = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.024, 0.017, 0.025, 8)), steel);
  teeth.position.y = 0.0125;
  bit.add(shaft, teeth);
  const core = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 12)), freshMat);
  core.position.y = 0.035;
  core.visible = false;
  tool.add(housing, grip, statusLight, bit, core);
  tool.visible = false;
  group.add(tool);

  // Astronaut hands: realistic EVA gloves (suitArm.ts) gripping the corer, forearms reaching back to your elbows.
  const rightArm = createSuitArm(1), leftArm = createSuitArm(-1);
  group.add(rightArm.root, leftArm.root);
  rightArm.root.visible = leftArm.root.visible = false;
  disposables.push(rightArm, leftArm);
  // Where each hand holds the tool, and the point its palm faces (tool-local): right hand round the pistol grip,
  // left hand steadying the side of the housing.
  const HOLDS = [
    { grip: new THREE.Vector3(0.128, 0.36, 0), palm: new THREE.Vector3(0.095, 0.36, 0) },
    { grip: new THREE.Vector3(-0.1, 0.34, 0.01), palm: new THREE.Vector3(0, 0.34, 0) },
  ];
  // Elbows, in camera space: low and to the sides, so only the forearms reach into view.
  const ELBOWS = [new THREE.Vector3(0.27, -0.44, -0.3), new THREE.Vector3(-0.27, -0.44, -0.3)];
  const elbow = new THREE.Vector3(), gripAt = new THREE.Vector3(), palmAt = new THREE.Vector3();
  const placeArms = (camera: THREE.Camera) => {
    camera.updateMatrixWorld();
    tool.updateMatrixWorld(true);
    [rightArm, leftArm].forEach((arm, i) => {
      tool.localToWorld(gripAt.copy(HOLDS[i].grip));
      tool.localToWorld(palmAt.copy(HOLDS[i].palm));
      arm.pose(gripAt, palmAt, elbow.copy(ELBOWS[i]).applyMatrix4(camera.matrixWorld));
      arm.root.visible = true;
    });
  };

  // Rock dust
  const dustPos = new Float32Array(DUST * 3).fill(-1e4);
  const dustVel = new Float32Array(DUST * 3);
  const dustLife = new Float32Array(DUST);
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = keep(new THREE.PointsMaterial({ color: '#c9a27c', size: 0.022, transparent: true, opacity: 0.85, depthWrite: false }));
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);
  let nextDust = 0;
  let emitCarry = 0;

  const emitDust = (dt: number) => {
    emitCarry += dt * 45;
    while (emitCarry >= 1) {
      emitCarry -= 1;
      const i = nextDust++ % DUST;
      const a = Math.random() * Math.PI * 2, sp = 0.15 + Math.random() * 0.45;
      dustPos.set([rockTop.x, rockTop.y + 0.01, rockTop.z], i * 3);
      dustVel.set([Math.cos(a) * sp, 0.3 + Math.random() * 0.7, Math.sin(a) * sp], i * 3);
      dustLife[i] = 1 + Math.random() * 0.6;
    }
  };

  const updateDust = (dt: number) => {
    let any = false;
    for (let i = 0; i < DUST; i++) {
      if (dustLife[i] <= 0) continue;
      any = true;
      dustLife[i] -= dt;
      dustVel[i * 3 + 1] -= MARS_G * dt;
      for (let k = 0; k < 3; k++) dustPos[i * 3 + k] += dustVel[i * 3 + k] * dt;
      if (dustLife[i] <= 0 || dustPos[i * 3 + 1] < rockTop.y - 0.6) {
        dustLife[i] = 0;
        dustPos[i * 3 + 1] = -1e4;
      }
    }
    if (any) dustGeo.attributes.position.needsUpdate = true;
  };

  let state: SampleState = 'idle';
  let elapsed = 0;
  let progress = 0;
  const raised = rockTop.clone().add(new THREE.Vector3(0, 0.2, 0));
  const stowTarget = new THREE.Vector3();
  const offsetFromEye = new THREE.Vector3(0.18, -0.6, -0.45); // just below and in front of the visor

  return {
    group,
    rockTop,
    get state() {
      return state;
    },
    get progress() {
      return progress;
    },
    start() {
      if (state !== 'idle') return false;
      state = 'lowering';
      elapsed = 0;
      return true;
    },
    update(dt, time, camera) {
      beacon.update(time);
      // The beacon guides you from afar; up close (and while sampling) it would wash over the rock.
      beacon.group.visible = (state === 'idle' || state === 'done') && camera.position.distanceTo(rockTop) > 6;
      if (state !== 'idle' && state !== 'done') {
        elapsed += dt;
        progress = Math.min(1, elapsed / TOTAL);
        let t = elapsed, phase: SampleState = 'done', local = 1;
        for (const [name, d] of PHASES) {
          if (t < d) {
            phase = name;
            local = t / d;
            break;
          }
          t -= d;
        }
        state = phase;
        tool.visible = phase !== 'done';
        tool.scale.setScalar(1);

        if (phase === 'lowering') {
          tool.position.copy(rockTop).add(new THREE.Vector3(0, 0.15 * (1 - ease(local)), 0)); // held low in front of you, lowered onto the rock
          lightMat.color.set(palette.warning);
        } else if (phase === 'drilling') {
          tool.position.copy(rockTop);
          tool.position.y -= 0.05 * local; // biting into the rock
          tool.position.x += (Math.random() - 0.5) * 0.006; // vibration
          tool.position.z += (Math.random() - 0.5) * 0.006;
          bit.rotation.y += dt * 45;
          patch.scale.setScalar(Math.max(0.001, ease(Math.min(1, local * 1.4))));
          lightMat.color.set(Math.sin(time * 18) > 0 ? palette.ok : '#0b3d1c');
          emitDust(dt);
        } else if (phase === 'raising') {
          core.visible = true;
          tool.position.copy(rockTop).add(new THREE.Vector3(0, 0.2 * ease(local) - 0.05 * (1 - local), 0));
          bit.rotation.y += dt * 12 * (1 - local);
          lightMat.color.set(palette.ok);
        } else if (phase === 'stowing') {
          stowTarget.copy(offsetFromEye).applyMatrix4(camera.matrixWorld);
          tool.position.lerpVectors(raised, stowTarget, ease(local));
        } else {
          // done: sample sealed and stowed
          tool.visible = false;
          beacon.setColor(palette.ok);
          beacon.group.scale.y = 0.2;
        }
      }
      if (tool.visible) placeArms(camera);
      else rightArm.root.visible = leftArm.root.visible = false;
      updateDust(dt);
    },
    dispose() {
      beacon.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
