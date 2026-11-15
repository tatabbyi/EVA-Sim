// Written with AI assistance (Claude).
// Owner: Rachel. Inside the habitat, where every EVA starts: you stand in the room (helmet off), walk to the
// operations console at the back and click its screen to plan the EVA, then walk to the airlock hatch at the front
// and go out. Same layout as the habitat outside (an 8 m drum, airlock on the +z side).
// In the room: the console deck (main screen, where the Setup UI is laid over as HTML, plus two side screens and a
// keyboard), the airlock hatch with stencils and a ready light, your EVA suit on its stand, lockers, a ladder up to a
// ceiling hatch (the upper floor comes with the base expansion), and a window out onto the plain.
// Your EVA suit waits on its donning stand beside the hatch (suitStand.ts): aim at it or the hatch and press E to suit up.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createConsoleDesk } from './consoleDesk';
import { createSuitStand } from './suitStand';

export const ROOM_EYE = 1.65; // standing eye height, m
const RADIUS = 4; // habitat drum
const WALK_LIMIT = 3.45; // how close to the wall you can walk (body radius included)

export interface Pose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export interface BaseInterior {
  scene: THREE.Scene;
  /** Where you stand when the sim opens, facing the console. */
  start: Pose;
  /** Just inside the hatch, coming back in from an EVA. */
  fromAirlock: Pose;
  /** Seated at the console, square on to the main screen. */
  seat: Pose & { fov: number };
  /** Standing back from the console after using it. */
  standAtConsole: Pose;
  /** Keep a walker out of the walls and furniture (moves p in x and z). */
  collide(p: THREE.Vector3): void;
  /** What you're looking at, within reach: the console screen, the airlock hatch, or nothing. */
  aim(camera: THREE.Camera): 'console' | 'hatch' | null;
  /** The main screen itself: its frame (centre, facing the seat; +z out of the glass) and size in metres (the VR console sits on it). */
  screen: { object: THREE.Object3D; width: number; height: number };
  /** Where the main screen is on the page (CSS px) when seen by camera on a widthPx x heightPx page. */
  screenRect(camera: THREE.PerspectiveCamera, widthPx: number, heightPx: number): { left: number; top: number; width: number; height: number };
  update(timeSeconds: number): void;
  dispose(): void;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

/** Side screen: dark glass, a title, rows of readouts and a trace. */
function readoutTexture(title: string, rows: [string, string][], seed: number) {
  return canvasTexture(768, 480, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 480);
    g.addColorStop(0, '#f3eee6');
    g.addColorStop(1, '#ebe4d9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 768, 480);
    ctx.fillStyle = '#3a2a20';
    ctx.font = '600 30px Inter, system-ui, sans-serif';
    ctx.fillText(title.split('').join(' '), 36, 58);
    ctx.fillStyle = '#ddd3c4';
    ctx.fillRect(36, 74, 696, 2);
    ctx.font = '26px Inter, system-ui, sans-serif';
    rows.forEach(([k, v], i) => {
      ctx.fillStyle = '#8a7462';
      ctx.fillText(k, 36, 122 + i * 42);
      ctx.fillStyle = '#3a2a20';
      ctx.textAlign = 'right';
      ctx.fillText(v, 732, 122 + i * 42);
      ctx.textAlign = 'left';
    });
    ctx.strokeStyle = '#0a84ff'; // blue trace, like the main screen
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= 696; x += 6) {
      const y = 420 - 22 * Math.sin(x * 0.03 + seed) - 10 * Math.sin(x * 0.11 + seed * 2);
      if (x === 0) ctx.moveTo(36 + x, y);
      else ctx.lineTo(36 + x, y);
    }
    ctx.stroke();
  });
}

function windowTexture() {
  return canvasTexture(512, 256, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 150);
    sky.addColorStop(0, '#8a6f5c');
    sky.addColorStop(1, '#d1a77f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#9b7458';
    ctx.beginPath();
    ctx.moveTo(0, 150);
    for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, 140 - 10 * Math.sin(x * 0.02) - 6 * Math.sin(x * 0.07));
    ctx.lineTo(512, 256);
    ctx.lineTo(0, 256);
    ctx.fill();
    const ground = ctx.createLinearGradient(0, 150, 0, 256);
    ground.addColorStop(0, '#8a5f45');
    ground.addColorStop(1, '#5a3b2b');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 158, 512, 98);
  });
}

function wallTexture() {
  return canvasTexture(2048, 512, (ctx) => {
    ctx.fillStyle = '#c9cdd2';
    ctx.fillRect(0, 0, 2048, 512);
    ctx.strokeStyle = 'rgba(70,75,82,0.5)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 2048; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (const y of [0, 170, 340, 512]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,44,52,0.7)';
    ctx.font = 'bold 22px "Arial Narrow", sans-serif';
    ['O2 SUPPLY', 'POWER BUS B', 'COMMS', 'WATER LOOP', 'FIRE EXT.', 'STOWAGE'].forEach((t, i) => ctx.fillText(t, 140 + i * 320, 210));
    ctx.fillStyle = '#d9822b';
    for (let i = 0; i < 16; i++) ctx.fillRect(i * 128 + 10, 470, 40, 10);
  });
}

/** Floor plates: dark anti-slip metal with seams. */
function floorTexture() {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#3d424a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 8; y < 512; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 512; x += 16) ctx.fillRect(x, y, 6, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, 510, 510);
  }, [6, 6]);
}

/** Hazard-striped stencil sign. */
function signTexture(text: string, sub: string) {
  return canvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = '#d9822b';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = '#16181c';
    for (let i = -2; i < 22; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 30, 160);
      ctx.lineTo(i * 30 + 15, 160);
      ctx.lineTo(i * 30 + 55, 128);
      ctx.lineTo(i * 30 + 40, 128);
      ctx.fill();
    }
    ctx.font = 'bold 64px "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 72);
    ctx.font = 'bold 28px "Arial Narrow", sans-serif';
    ctx.fillText(sub, 256, 112);
  });
}

/** Seen on the console screen while walking about, before you click into it. */
function idleScreenTexture() {
  return canvasTexture(1024, 576, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 576);
    g.addColorStop(0, '#f3eee6');
    g.addColorStop(1, '#ebe4d9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 576);
    ctx.fillStyle = '#3a2a20';
    ctx.font = '600 44px Inter, system-ui, sans-serif';
    ctx.fillText('Plan the EVA', 48, 80);
    ctx.font = '22px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#8a7462';
    ctx.fillText('click to use', 330, 78);
    ctx.strokeStyle = 'rgba(84,130,120,0.45)';
    ctx.strokeRect(48, 110, 300, 420);
    ctx.strokeRect(372, 110, 604, 420);
    ctx.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      for (let x = 372; x <= 976; x += 8) {
        const y = 140 + k * 45 + 14 * Math.sin(x * 0.012 + k) + 8 * Math.sin(x * 0.031 - k);
        if (x === 372) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

const lookPose = (position: THREE.Vector3, target: THREE.Vector3): Pose => {
  const m = new THREE.Matrix4().lookAt(position, target, THREE.Object3D.DEFAULT_UP);
  return { position: position.clone(), quaternion: new THREE.Quaternion().setFromRotationMatrix(m) };
};

export function createBaseInterior(renderer: THREE.WebGLRenderer): BaseInterior {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0d10');
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // Soft reflections for the plastics and metals in here.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.35;

  // ---------- materials ----------
  // Habitat fit-out: off-white moulded panels with light grey fronts, like a real spacecraft interior.
  const bezelMat = keep(new THREE.MeshStandardMaterial({ color: '#d9d5cd', roughness: 0.5, metalness: 0.1 }));
  const trim = keep(new THREE.MeshBasicMaterial({ color: '#e0b872' })); // warm sand light strip
  const steel = keep(new THREE.MeshStandardMaterial({ color: '#a9b0b8', roughness: 0.3, metalness: 0.9 }));
  const panelWhite = keep(new THREE.MeshStandardMaterial({ color: '#dfe2e6', roughness: 0.55, metalness: 0.1 }));

  // ---------- room: floor, curved wall, ceiling, light ring, window ----------
  put(new THREE.CircleGeometry(RADIUS, 72), keep(new THREE.MeshStandardMaterial({ map: keep(floorTexture()), roughness: 0.6, metalness: 0.5 })), 0, 0, 0).rotation.x = -Math.PI / 2;
  const wallMap = keep(wallTexture());
  wallMap.wrapS = THREE.RepeatWrapping;
  wallMap.repeat.x = -1; // seen from inside the drum: flip so the stencils read the right way round
  put(new THREE.CylinderGeometry(RADIUS, RADIUS, 2.7, 96, 1, true), keep(new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.7, side: THREE.BackSide })), 0, 1.35, 0);
  put(new THREE.CircleGeometry(RADIUS, 72), keep(new THREE.MeshStandardMaterial({ color: '#2a2e35', roughness: 0.8 })), 0, 2.7, 0).rotation.x = Math.PI / 2;
  put(new THREE.TorusGeometry(3.1, 0.025, 8, 128), keep(new THREE.MeshBasicMaterial({ color: '#9fb2c2' })), 0, 2.66, 0).rotation.x = Math.PI / 2; // light ring
  const win = new THREE.Group(); // window, left wall
  win.position.set(-3.95, 1.55, 0.4);
  win.lookAt(0, 1.55, 0.4);
  scene.add(win);
  put(new RoundedBoxGeometry(1.6, 0.86, 0.14, 4, 0.08), keep(new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.4, metalness: 0.6 })), 0, 0, 0, win);
  put(new THREE.PlaneGeometry(1.42, 0.7), keep(new THREE.MeshBasicMaterial({ map: keep(windowTexture()) })), 0, 0, 0.075, win);

  // ---------- console deck at the back (the workstation itself: src/terrain/consoleDesk.ts) ----------
  const CONSOLE_Z = -3.15;
  const desk = createConsoleDesk();
  desk.group.position.set(0, 0, CONSOLE_Z + 1.25); // its origin is the seat
  scene.add(desk.group);
  disposables.push(desk);
  const buttons = desk.leds;
  // Main screen, facing the seat square on, so its outline on the page is an exact rectangle for the HTML overlay.
  const SW = 1.7, SH = 0.956;
  const seatPos = new THREE.Vector3(0, 1.42, CONSOLE_Z + 1.25);
  const screenCentre = new THREE.Vector3(0, 1.3, CONSOLE_Z);
  const main = new THREE.Group();
  main.position.copy(screenCentre);
  main.lookAt(seatPos);
  scene.add(main);
  put(new RoundedBoxGeometry(SW + 0.08, SH + 0.08, 0.05, 4, 0.02), bezelMat, 0, 0, -0.03, main);
  const screen = put(new THREE.PlaneGeometry(SW, SH), keep(new THREE.MeshBasicMaterial({ map: keep(idleScreenTexture()) })), 0, 0, 0, main);
  put(new THREE.BoxGeometry(SW + 0.06, 0.006, 0.006), trim, 0, -SH / 2 - 0.045, 0, main);
  put(new RoundedBoxGeometry(SW - 0.1, SH - 0.1, 0.07, 3, 0.02), bezelMat, 0, 0, -0.07, main); // back housing
  put(new THREE.BoxGeometry(0.14, 0.22, 0.04), bezelMat, 0, -SH / 2 - 0.05, -0.1, main); // stand

  const corners = [new THREE.Vector3(-SW / 2, SH / 2, 0), new THREE.Vector3(SW / 2, SH / 2, 0), new THREE.Vector3(SW / 2, -SH / 2, 0), new THREE.Vector3(-SW / 2, -SH / 2, 0)];
  const sides: [number, string, [string, string][]][] = [
    [-1, 'BASE STATUS', [['Habitat pressure', '101.3 kPa'], ['O₂ / CO₂', '21.0 % / 0.4 kPa'], ['ISRU O₂ plant', '+58 L/h'], ['Power', '38.2 kW'], ['Water loop', 'nominal']]],
    [1, 'SURFACE', [['Sol', '312'], ['Local time', '09:41'], ['Wind', '6 m/s SW'], ['Dust opacity', 'τ 0.6'], ['Relay orbiter', 'pass in 14 min']]],
  ];
  sides.forEach(([sd, title, rows], i) => {
    const g = new THREE.Group();
    g.position.set(sd * 1.08, 1.25, CONSOLE_Z + 0.32);
    g.rotation.y = -sd * 0.7;
    scene.add(g);
    put(new RoundedBoxGeometry(0.76, 0.5, 0.04, 3, 0.02), bezelMat, 0, 0, -0.025, g);
    put(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 12), bezelMat, 0, -0.35, -0.04, g); // stand

    put(new THREE.PlaneGeometry(0.72, 0.45), keep(new THREE.MeshBasicMaterial({ map: keep(readoutTexture(title, rows, i * 3 + 1)) })), 0, 0, 0, g);
  });

  // ---------- airlock hatch at the front ----------
  const HATCH_Z = RADIUS - 0.04;
  const hatchGroup = new THREE.Group();
  hatchGroup.position.set(0, 0, HATCH_Z);
  hatchGroup.rotation.y = Math.PI; // faces into the room
  scene.add(hatchGroup);
  put(new THREE.TorusGeometry(0.82, 0.09, 14, 64), steel, 0, 1.2, 0, hatchGroup); // frame
  const hatch = put(new THREE.CylinderGeometry(0.74, 0.74, 0.08, 48), panelWhite, 0, 1.2, -0.03, hatchGroup);
  hatch.rotation.x = Math.PI / 2;
  const port = put(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 32), keep(new THREE.MeshStandardMaterial({ color: '#141b24', roughness: 0.05, metalness: 0.4, emissive: '#ffb070', emissiveIntensity: 0.25 })), 0, 1.5, 0.02, hatchGroup);
  port.rotation.x = Math.PI / 2;
  put(new THREE.TorusGeometry(0.16, 0.022, 8, 24, Math.PI), steel, 0, 1.0, 0.04, hatchGroup).rotation.z = Math.PI; // handle
  const ready = put(new THREE.SphereGeometry(0.05, 16, 12), keep(new THREE.MeshBasicMaterial({ color: '#4cd964' })), 0, 2.18, 0.02, hatchGroup);
  put(new THREE.PlaneGeometry(0.9, 0.28), keep(new THREE.MeshStandardMaterial({ map: keep(signTexture('AIRLOCK', 'EVA EXIT · SUIT UP FIRST')), roughness: 0.6 })), 0, 2.38, 0.03, hatchGroup);
  const hatchLight = new THREE.PointLight('#bfffd0', 1.2, 3, 2);
  hatchLight.position.set(0, 2.1, HATCH_Z - 0.4);
  scene.add(hatchLight);

  // ---------- your EVA suit on its donning stand, beside the hatch, facing into the room ----------
  const suitStand = createSuitStand();
  disposables.push(suitStand);
  const SUIT_A = 0.6, SUIT_R = 3.32; // round the wall from the hatch, towards the lockers
  suitStand.group.position.set(Math.sin(SUIT_A) * SUIT_R, 0, Math.cos(SUIT_A) * SUIT_R);
  suitStand.group.lookAt(0, 0, 0);
  scene.add(suitStand.group);

  // ---------- lockers on the right wall ----------
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 - 0.55 + i * 0.32; // round the right side of the room
    const l = new THREE.Group();
    l.position.set(Math.sin(a) * 3.62, 0, Math.cos(a) * 3.62);
    l.lookAt(0, 0, 0);
    scene.add(l);
    put(new RoundedBoxGeometry(0.95, 2.0, 0.55, 3, 0.03), panelWhite, 0, 1.0, 0, l);
    put(new THREE.BoxGeometry(0.03, 0.4, 0.03), steel, 0.35, 1.1, 0.29, l);
    put(new THREE.BoxGeometry(0.9, 0.006, 0.006), trim, 0, 1.96, 0.28, l);
  }

  // ---------- ladder up to the ceiling hatch (the upper floor comes with the base expansion) ----------
  const ladder = new THREE.Group();
  ladder.position.set(-2.3, 0, -1.6);
  scene.add(ladder);
  for (const sx of [-0.24, 0.24]) put(new THREE.CylinderGeometry(0.025, 0.025, 2.7, 10), steel, sx, 1.35, 0, ladder);
  for (let y = 0.3; y < 2.6; y += 0.3) put(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 8), steel, 0, y, 0, ladder).rotation.z = Math.PI / 2;
  put(new THREE.TorusGeometry(0.5, 0.05, 10, 40), steel, -2.3, 2.66, -1.6).rotation.x = Math.PI / 2;

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight('#dfe8f2', '#3a3530', 0.55));
  const ceilingLight = new THREE.PointLight('#f1f6ff', 14, 10, 2);
  ceilingLight.position.set(0, 2.45, 0);
  const consoleLight = new THREE.PointLight('#ffe9cf', 0.8, 2.5, 2);
  consoleLight.position.set(0, 1.5, CONSOLE_Z + 0.9);
  const windowLight = new THREE.PointLight('#ffcf9a', 3, 5, 2);
  windowLight.position.set(-3.1, 1.5, 0.4);
  scene.add(ceilingLight, consoleLight, windowLight);

  // ---------- walking, aiming, the screen overlay ----------
  const raycaster = new THREE.Raycaster();
  raycaster.far = 3.2; // within reach
  const centre = new THREE.Vector2(0, 0);
  const tmp = new THREE.Vector3();
  const obstacles = [
    { x: 0, z: CONSOLE_Z + 0.35, r: 1.35 }, // console deck
    { x: ladder.position.x, z: ladder.position.z, r: 0.45 },
    { x: suitStand.group.position.x, z: suitStand.group.position.z, r: 0.5 },
  ];
  main.updateMatrixWorld(true);

  return {
    scene,
    start: lookPose(new THREE.Vector3(0, ROOM_EYE, 0.6), new THREE.Vector3(0, 1.35, CONSOLE_Z)),
    fromAirlock: lookPose(new THREE.Vector3(0, ROOM_EYE, HATCH_Z - 1.1), new THREE.Vector3(0, 1.4, 0)),
    seat: { ...lookPose(seatPos, screenCentre), fov: 60 },
    screen: { object: main, width: SW, height: SH },
    standAtConsole: lookPose(new THREE.Vector3(0, ROOM_EYE, CONSOLE_Z + 2.1), new THREE.Vector3(0, 1.3, CONSOLE_Z)),
    collide(p) {
      for (let k = 0; k < 2; k++) {
        for (const o of obstacles) {
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
          if (d < o.r && d > 1e-6) {
            p.x = o.x + (dx / d) * o.r;
            p.z = o.z + (dz / d) * o.r;
          }
        }
        const d = Math.hypot(p.x, p.z);
        if (d > WALK_LIMIT) {
          p.x *= WALK_LIMIT / d;
          p.z *= WALK_LIMIT / d;
        }
      }
    },
    aim(camera) {
      raycaster.setFromCamera(centre, camera);
      const hit = raycaster.intersectObjects([screen, hatch, ...suitStand.targets], false)[0];
      if (!hit) return null;
      return hit.object === screen ? 'console' : 'hatch'; // the suit or the hatch: suit up and go out
    },
    screenRect(camera, w, h) {
      camera.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        tmp.copy(c).applyMatrix4(main.matrixWorld).project(camera);
        const px = (tmp.x * 0.5 + 0.5) * w, py = (-tmp.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    },
    update(t) {
      buttons.forEach((b, i) => (b.visible = i % 3 !== 2 || Math.sin(t * 2 + i) > -0.3));
      ready.scale.setScalar(0.85 + 0.15 * Math.sin(t * 2.5));
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
