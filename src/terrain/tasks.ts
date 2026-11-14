// Written with AI assistance (Claude).
// Owner: Rachel (visuals); game rules on top belong to Alex. Objectives you can do at stops along the path,
// all behind one interface so the game can mix them freely:
//   core      Rock core sample: kneel, corer drills a core (sampleSite.ts). Perseverance's sampling sequence.
//   laser     Laser-zap a boulder from 2 to 7 m away, like Perseverance's SuperCam (LIBS: a laser spark is read
//             by a spectrometer to get the rock's chemistry).
//   panorama  360° panorama from a marked viewpoint: turn all the way round, like Mastcam-Z panoramas.

import * as THREE from 'three';
import { palette } from '../ui/palette';
import { createWaypointBeacon } from './beacon';
import { createNoiseTexture } from './noiseTexture';
import { rockGeometry, type SampleSite } from './sampleSite';

export type TaskKind = 'core' | 'laser' | 'panorama';
export type TaskState = 'idle' | 'active' | 'done';

export interface TaskSite {
  kind: TaskKind;
  title: string; // objective line on the HUD
  hudTitle: string; // alert title, e.g. "ROCK SAMPLE"
  prompt: string; // shown when you can start it, e.g. "Take a core sample"
  doneText: [string, string]; // alert shown when finished
  group: THREE.Group;
  anchor: THREE.Vector3; // world position used for range checks and the demo
  lookAt: THREE.Vector3 | null; // view is held here while active; null = you keep looking around
  kneel: boolean;
  readonly state: TaskState;
  readonly progress: number; // 0 to 1
  readonly phaseText: string; // HUD line while active
  inRange(camera: THREE.Camera): boolean;
  start(): boolean;
  update(dt: number, time: number, camera: THREE.Camera): void;
  dispose(): void;
}

const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- Rock core sample (wraps sampleSite.ts) ----------

const CORE_PHASE: Record<string, string> = {
  lowering: 'Positioning corer',
  drilling: 'Drilling core',
  raising: 'Extracting core',
  stowing: 'Sealing tube',
};

export function coreTask(site: SampleSite): TaskSite {
  const lookAt = site.rockTop.clone().add(new THREE.Vector3(0, 0.26, 0)); // between rock and hands, so both sit mid-view
  return {
    kind: 'core',
    title: 'Rock core sample',
    hudTitle: 'ROCK SAMPLE',
    prompt: 'Take a core sample',
    doneText: ['SAMPLE STORED', 'Tube sealed and stowed'],
    group: site.group,
    anchor: site.rockTop,
    lookAt,
    kneel: true,
    get state(): TaskState {
      return site.state === 'idle' ? 'idle' : site.state === 'done' ? 'done' : 'active';
    },
    get progress() {
      return site.progress;
    },
    get phaseText() {
      return CORE_PHASE[site.state] ?? 'Working';
    },
    inRange: (camera) => flat(camera.position, site.rockTop) < 3,
    start: () => site.start(),
    update: (dt, t, camera) => site.update(dt, t, camera),
    dispose: () => site.dispose(),
  };
}

// ---------- Laser-zap a boulder (SuperCam) ----------

function sparkTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,214,150,0.9)');
  g.addColorStop(0.6, 'rgba(255,120,60,0.35)');
  g.addColorStop(1, 'rgba(255,80,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createLaserTask(ground: THREE.Vector3, seed = 3): TaskSite {
  const DURATION = 3.2; // seconds of zapping
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // A big boulder (about 1.4 m across)
  const geo = keep(rockGeometry(seed + 11));
  const grain = keep(createNoiseTexture(256, seed * 31 + 5, 4));
  const mat = keep(new THREE.MeshStandardMaterial({ color: '#5f4b3e', roughness: 0.95, bumpMap: grain, bumpScale: 0.01 }));
  const boulder = new THREE.Mesh(geo, mat);
  boulder.scale.setScalar(2.1);
  boulder.position.copy(ground).add(new THREE.Vector3(0, 0.25, 0));
  boulder.rotation.y = seed;
  group.add(boulder);
  const target = boulder.position.clone().add(new THREE.Vector3(0, 0.35, 0)); // aim point on the boulder face

  const beacon = createWaypointBeacon({ color: palette.objective, height: 14, radius: 0.2 });
  beacon.group.position.copy(ground);
  group.add(beacon.group);
  disposables.push(beacon);

  // Laser beam (thin, additive) and the spark where it hits
  const beamGeo = keep(new THREE.CylinderGeometry(0.003, 0.003, 1, 6, 1, true));
  beamGeo.translate(0, 0.5, 0);
  const beamMat = keep(new THREE.MeshBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.visible = false;
  group.add(beam);
  const spark = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(sparkTexture()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  spark.visible = false;
  group.add(spark);
  // Scorch mark left behind
  const scorch = new THREE.Mesh(keep(new THREE.CircleGeometry(0.05, 20)), keep(new THREE.MeshBasicMaterial({ color: '#2a1a12', transparent: true, opacity: 0 })));
  group.add(scorch);

  let state: TaskState = 'idle';
  let t = 0;
  const from = new THREE.Vector3(), dir = new THREE.Vector3(), hit = new THREE.Vector3(), toTarget = new THREE.Vector3();
  const look = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);

  return {
    kind: 'laser',
    title: 'Laser-zap a boulder (SuperCam)',
    hudTitle: 'LASER SCAN',
    prompt: 'Aim at the boulder and fire the laser',
    doneText: ['SPECTRUM SAVED', 'Rock chemistry recorded'],
    group,
    anchor: target,
    lookAt: target,
    kneel: false,
    get state() {
      return state;
    },
    get progress() {
      return Math.min(1, t / DURATION);
    },
    get phaseText() {
      return 'Firing laser, reading spectrum';
    },
    inRange(camera) {
      // SuperCam works from about 2 to 7 m, and you have to be looking at the boulder.
      const d = flat(camera.position, target);
      if (d < 2 || d > 7) return false;
      camera.getWorldDirection(look);
      toTarget.subVectors(target, camera.position).normalize();
      return look.dot(toTarget) > Math.cos(THREE.MathUtils.degToRad(12));
    },
    start() {
      if (state !== 'idle') return false;
      state = 'active';
      t = 0;
      return true;
    },
    update(dt, time, camera) {
      beacon.update(time);
      beacon.group.visible = state !== 'active';
      if (state === 'done') {
        beacon.setColor(palette.ok);
        beacon.group.scale.y = 0.2;
      }
      if (state !== 'active') {
        beam.visible = spark.visible = false;
        return;
      }
      t += dt;
      // Beam from the suit's chest-mounted instrument to the boulder; pulsed like LIBS shots.
      from.set(0.1, -0.22, -0.25).applyMatrix4(camera.matrixWorld);
      hit.copy(target).addScaledVector(toTarget.subVectors(from, target).normalize(), 0.62); // on the near face
      dir.subVectors(hit, from);
      const pulse = Math.sin(time * 60) > 0;
      beam.visible = pulse;
      beam.position.copy(from);
      beam.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
      beam.scale.set(1, dir.length(), 1);
      spark.visible = true;
      spark.position.copy(hit);
      spark.scale.setScalar(pulse ? 0.35 + Math.random() * 0.2 : 0.12);
      scorch.position.copy(hit).addScaledVector(toTarget, 0.01);
      scorch.lookAt(from);
      (scorch.material as THREE.MeshBasicMaterial).opacity = Math.min(0.7, t / DURATION);
      if (t >= DURATION) {
        state = 'done';
        beam.visible = spark.visible = false;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

// ---------- 360° panorama ----------

export function createPanoramaTask(ground: THREE.Vector3): TaskSite {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // A viewpoint marker: a ring on the ground and a short flag pole
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: palette.waypoint, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.9, 1.05, 48)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(ground).add(new THREE.Vector3(0, 0.04, 0));
  group.add(ring);
  const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 8)), keep(new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.5 })));
  pole.position.copy(ground).add(new THREE.Vector3(0.95, 0.8, 0));
  const flag = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.3, 0.18)), keep(new THREE.MeshStandardMaterial({ color: palette.waypoint, side: THREE.DoubleSide })));
  flag.position.copy(pole.position).add(new THREE.Vector3(0.16, 0.7, 0));
  group.add(pole, flag);
  const beacon = createWaypointBeacon({ color: palette.objective, height: 14, radius: 0.2 });
  beacon.group.position.copy(ground);
  group.add(beacon.group);
  disposables.push(beacon);

  let state: TaskState = 'idle';
  let turned = 0;
  let lastYaw: number | null = null;
  const look = new THREE.Vector3();

  return {
    kind: 'panorama',
    title: 'Panorama from the marker',
    hudTitle: 'PANORAMA',
    prompt: 'Turn all the way round to capture',
    doneText: ['PANORAMA SAVED', '360° captured'],
    group,
    anchor: ground,
    lookAt: null,
    kneel: false,
    get state() {
      return state;
    },
    get progress() {
      return Math.min(1, turned / (Math.PI * 2));
    },
    get phaseText() {
      return `Turn slowly: ${Math.round(Math.min(360, (turned * 180) / Math.PI))}° of 360°`;
    },
    inRange: (camera) => flat(camera.position, ground) < 2.5,
    start() {
      if (state !== 'idle') return false;
      state = 'active';
      turned = 0;
      lastYaw = null;
      return true;
    },
    update(_dt, time, camera) {
      beacon.update(time);
      beacon.group.visible = state !== 'active';
      ringMat.opacity = state === 'active' ? 0.5 + 0.4 * Math.sin(time * 6) : 0.8;
      if (state === 'done') {
        beacon.setColor(palette.ok);
        beacon.group.scale.y = 0.2;
        ringMat.color.set(palette.ok);
      }
      if (state !== 'active') return;
      camera.getWorldDirection(look);
      const yaw = Math.atan2(-look.x, -look.z);
      if (lastYaw !== null) {
        let d = yaw - lastYaw;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        turned += Math.abs(d);
      }
      lastYaw = yaw;
      if (turned >= Math.PI * 2) state = 'done';
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
