// Written with AI assistance (Claude).
// Owner: Rachel (visuals); game rules on top belong to Alex. Objectives you can do at stops along the path,
// all behind one interface so the game can mix them freely:
//   core      Rock core sample: kneel, corer drills a core (sampleSite.ts). Perseverance's sampling sequence.
//   laser     Laser-zap a boulder from 2 to 7 m away, like Perseverance's SuperCam (LIBS: a laser spark is read
//             by a spectrometer to get the rock's chemistry).
//   panorama  360° panorama from a marked viewpoint: turn all the way round, like Mastcam-Z panoramas.
//   abrade    Abrade a rock: the same tool with a grinding head scrapes off the weathered skin, leaving a fresh patch.
//   depot     Sample depot: kneel and lay a sealed sample tube on the ground, like Perseverance's Three Forks depot.
//   moxie     Run MOXIE: a portable, fictionalised MOXIE-style unit makes a few grams of O2 from the CO2 air.
//             It does not refill the suit (team brief, docs/FOUR-TASK-ANIMATION-BRIEF.md).
// The four tasks of the team brief (abrade, core, depot, MOXIE) are the mission tasks; laser and panorama stay available.

import * as THREE from 'three';
import { palette } from '../ui/palette';
import { createWaypointBeacon } from './beacon';
import { createNoiseTexture } from './noiseTexture';
import { rockGeometry, type SampleSite } from './sampleSite';
import { createSuitArm, headingFrame, reachElbow } from './suitArm';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type TaskKind = 'core' | 'laser' | 'panorama' | 'abrade' | 'depot' | 'moxie';
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
const ABRADE_PHASE: Record<string, string> = {
  lowering: 'Positioning abrader',
  drilling: 'Grinding the surface',
  raising: 'Lifting the abrader',
  stowing: 'Stowing the tool',
};

/** Abrade a rock: the sample site in 'abrade' mode (createSampleSite(ground, seed, 'abrade')). */
export function abradeTask(site: SampleSite): TaskSite {
  const t = coreTask(site);
  return Object.defineProperties({ ...t }, {
    kind: { value: 'abrade' },
    title: { value: 'Abrade a rock' },
    hudTitle: { value: 'ABRADE' },
    prompt: { value: 'Grind a fresh patch on the rock' },
    doneText: { value: ['PATCH ABRADED', 'Fresh rock exposed'] },
    state: { get: () => (site.state === 'idle' ? 'idle' : site.state === 'done' ? 'done' : 'active') },
    progress: { get: () => site.progress },
    phaseText: { get: () => ABRADE_PHASE[site.state] ?? 'Working' },
  }) as TaskSite;
}

export function coreTask(site: SampleSite): TaskSite {
  const lookAt = site.rockTop.clone().add(new THREE.Vector3(0, 0.26, 0)); // between rock and hands, so both sit mid-view
  return {
    kind: 'core',
    title: 'Take a core',
    hudTitle: 'CORE SAMPLE',
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

  const beacon = createWaypointBeacon();
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
  const beacon = createWaypointBeacon();
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

// ---------- Sample depot ----------

export function createDepotTask(ground: THREE.Vector3): TaskSite {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  // The depot spot: a ring on the ground and a beacon
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: palette.ar, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.32, 0.36, 40)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(ground).add(new THREE.Vector3(0, 0.03, 0));
  group.add(ring);
  const beacon = createWaypointBeacon();
  beacon.group.position.copy(ground);
  group.add(beacon.group);
  disposables.push(beacon);
  // A sealed sample tube: titanium body, white cap
  const tube = new THREE.Group();
  const metal = keep(new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.25, metalness: 0.9 }));
  const capMat = keep(new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.4 }));
  tube.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 20)), metal));
  const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.019, 0.019, 0.03, 20)), capMat);
  cap.position.y = 0.085;
  tube.add(cap);
  tube.visible = false;
  group.add(tube);
  const arm = createSuitArm(1);
  arm.root.visible = false;
  group.add(arm.root);
  disposables.push(arm);

  const DURATION = 4.2;
  let state: TaskState = 'idle', t = 0;
  const hold = new THREE.Vector3(), rest = ground.clone().add(new THREE.Vector3(0, 0.02, 0));
  const elbow = new THREE.Vector3(), palm = new THREE.Vector3(), grip = new THREE.Vector3();
  const frame = new THREE.Matrix4(), turn = new THREE.Matrix3(), shoulder = new THREE.Vector3(), bend = new THREE.Vector3();
  const upright = new THREE.Quaternion(), lying = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const ease = (x: number) => x * x * (3 - 2 * x);
  const phase = () => (t < 1.2 ? 'Taking a sealed tube' : t < 3.2 ? 'Placing the tube' : 'Letting go');

  return {
    kind: 'depot',
    title: 'Sample depot',
    hudTitle: 'SAMPLE DEPOT',
    prompt: 'Lay a sealed tube at the depot',
    doneText: ['TUBE DEPOSITED', 'Left for a future return mission'],
    group,
    anchor: ground,
    lookAt: ground.clone().add(new THREE.Vector3(0, 0.15, 0)),
    kneel: true,
    get state() {
      return state;
    },
    get progress() {
      return Math.min(1, t / DURATION);
    },
    get phaseText() {
      return phase();
    },
    inRange: (camera) => flat(camera.position, ground) < 3,
    start() {
      if (state !== 'idle') return false;
      state = 'active';
      t = 0;
      tube.visible = true;
      arm.root.visible = true;
      return true;
    },
    update(dt, time, camera) {
      beacon.update(time);
      beacon.group.visible = state === 'idle' && camera.position.distanceTo(ground) > 4;
      ringMat.color.set(state === 'done' ? palette.ok : palette.ar);
      if (state !== 'active') return;
      t += dt;
      // Heading frame (see suitArm.ts): the tube comes up in front of your chest whichever way your head is tilted.
      headingFrame(camera, frame);
      hold.set(0.1, -0.52, -0.4).applyMatrix4(frame);
      shoulder.set(0.21, -0.28, 0.02).applyMatrix4(frame);
      bend.set(0.6, -1, 0.25).applyMatrix3(turn.setFromMatrix4(frame));
      if (t < 1.2) {
        // bring the tube up from the tool belt into view
        const k = ease(t / 1.2);
        tube.position.copy(hold).add(new THREE.Vector3(0, -0.25 * (1 - k), 0));
        tube.quaternion.copy(upright);
      } else if (t < 3.2) {
        // reach down and lay it flat on the spot
        const k = ease((t - 1.2) / 2);
        tube.position.lerpVectors(hold, rest, k);
        tube.quaternion.slerpQuaternions(upright, lying, k);
      } else {
        tube.position.copy(rest);
        tube.quaternion.copy(lying);
      }
      // the glove holds the tube until it is down, then lifts away
      const away = t < 3.2 ? 0 : ease(Math.min(1, (t - 3.2) / 1));
      grip.copy(tube.position).add(new THREE.Vector3(0, 0.05 + away * 0.25, 0));
      palm.copy(tube.position).add(new THREE.Vector3(0, -0.02 + away * 0.25, 0));
      arm.pose(grip, palm, reachElbow(shoulder, grip, bend, elbow), shoulder);
      if (t >= DURATION) {
        state = 'done';
        arm.root.visible = false;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

// ---------- Run MOXIE (portable, fictionalised) ----------

export function createMoxieTask(ground: THREE.Vector3): TaskSite {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const unit = new THREE.Group();
  unit.position.copy(ground);
  unit.rotation.y = 0.6;
  group.add(unit);
  const white = keep(new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.5 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.6, metalness: 0.4 }));
  const gold = keep(new THREE.MeshStandardMaterial({ color: '#cfa349', roughness: 0.3, metalness: 1 }));
  const body = new THREE.Mesh(keep(new RoundedBoxGeometry(0.46, 0.3, 0.34, 4, 0.03)), white);
  body.position.y = 0.17;
  unit.add(body);
  const foil = new THREE.Mesh(keep(new THREE.BoxGeometry(0.47, 0.06, 0.35)), gold); // insulation band
  foil.position.y = 0.06;
  unit.add(foil);
  for (let i = 0; i < 6; i++) {
    // intake grille on the front
    const slat = new THREE.Mesh(keep(new THREE.BoxGeometry(0.2, 0.012, 0.01)), dark);
    slat.position.set(-0.08, 0.13 + i * 0.022, 0.175);
    unit.add(slat);
  }
  const fan = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 6)), dark); // vent fan on the side
  fan.rotation.z = Math.PI / 2;
  fan.position.set(0.235, 0.18, 0);
  unit.add(fan);
  const vent = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 16)), dark); // exhaust stack
  vent.position.set(0.12, 0.36, -0.08);
  unit.add(vent);
  // status lights and a readout
  const lights = [0, 1, 2].map((i) => {
    const m = keep(new THREE.MeshBasicMaterial({ color: '#ffb340' }));
    const l = new THREE.Mesh(keep(new THREE.SphereGeometry(0.009, 10, 8)), m);
    l.position.set(0.1 + i * 0.03, 0.29, 0.175);
    unit.add(l);
    return m;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const screenTex = keep(new THREE.CanvasTexture(canvas));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.14, 0.055)), keep(new THREE.MeshBasicMaterial({ map: screenTex })));
  screen.position.set(0.12, 0.22, 0.171);
  unit.add(screen);
  const draw = (grams: number, label: string) => {
    ctx.fillStyle = '#06121a';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#6fe3ff';
    ctx.font = '600 22px Inter, system-ui, sans-serif';
    ctx.fillText(label, 14, 34);
    ctx.fillStyle = '#e6f7ff';
    ctx.font = '600 34px Inter, system-ui, sans-serif';
    ctx.fillText(`O₂ ${grams.toFixed(1)} g`, 14, 78);
    screenTex.needsUpdate = true;
  };
  draw(0, 'MOXIE · STANDBY');
  const beacon = createWaypointBeacon();
  beacon.group.position.copy(ground);
  group.add(beacon.group);
  disposables.push(beacon);

  const DURATION = 7, GRAMS = 6; // a one-hour run (real MOXIE made about 6 to 12 g of O2 per hour), sped up
  let state: TaskState = 'idle', t = 0, lastDraw = -1;
  const top = ground.clone().add(new THREE.Vector3(0, 0.3, 0));

  return {
    kind: 'moxie',
    title: 'Run MOXIE',
    hudTitle: 'MOXIE',
    prompt: 'Start an oxygen-making run',
    doneText: ['MOXIE RUN COMPLETE', `${GRAMS} g of O₂ made · not for the suit`],
    group,
    anchor: top,
    lookAt: top,
    kneel: false,
    get state() {
      return state;
    },
    get progress() {
      return Math.min(1, t / DURATION);
    },
    get phaseText() {
      return t < 1.2 ? 'Warming up the cell' : `Making O₂ from CO₂: ${((GRAMS * Math.max(0, t - 1.2)) / (DURATION - 1.2)).toFixed(1)} g`;
    },
    inRange: (camera) => flat(camera.position, ground) < 3,
    start() {
      if (state !== 'idle') return false;
      state = 'active';
      t = 0;
      return true;
    },
    update(dt, time, camera) {
      beacon.update(time);
      beacon.group.visible = state === 'idle' && camera.position.distanceTo(ground) > 4;
      if (state === 'done') {
        lights.forEach((m) => m.color.set('#30d158'));
        return;
      }
      if (state !== 'active') return;
      t += dt;
      fan.rotation.y += dt * 25; // intake fan spinning
      const grams = (GRAMS * Math.max(0, t - 1.2)) / (DURATION - 1.2);
      lights.forEach((m, i) => m.color.set(t > 1.2 + i * 1.5 ? '#30d158' : Math.sin(time * 8) > 0 ? '#ffb340' : '#3a2a10'));
      const tick = Math.floor(t * 4);
      if (tick !== lastDraw) {
        lastDraw = tick;
        draw(Math.min(GRAMS, grams), t < 1.2 ? 'MOXIE · WARMING' : 'MOXIE · RUNNING');
      }
      if (t >= DURATION) {
        state = 'done';
        draw(GRAMS, 'MOXIE · RUN DONE');
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
