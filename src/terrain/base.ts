// Written with AI assistance (Claude).
// Owner: Rachel. The surface base at the landing site, where every EVA starts and ends.
// Built from modules (habitat, airlock, greenhouse, solar field, lander, comms mast, rover), each a function that
// adds its parts and marks the ground it covers. The base will be expanded later: add a module function to MODULES
// (or a new one for an interior) and it is placed, lit, shadowed and kept clear of loose rocks like the rest.
// Look: real hardware, not toy shapes. Painted panels with seams and rivets, red dust built up on everything low
// down, solar cells, gold foil insulation, cables lying on the ground.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createNoiseTexture } from './noiseTexture';

export interface SpaceBase {
  group: THREE.Group;
  /** World position just outside the airlock hatch: where the path home ends. */
  door: THREE.Vector3;
  /** True where loose rocks must not go (inside the base footprint, plus margin r). */
  keepClear(x: number, z: number, r: number): boolean;
  update(timeSeconds: number): void;
  dispose(): void;
}

// ---------- textures (drawn once on a canvas) ----------

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Off-white hull panels: seams, rivet rows, grime streaks running down, red dust low down, stencil markings. */
function hullTexture(label: string, cols: number, rows: number, seed: number) {
  return canvasTexture(2048, 1024, (ctx) => {
    const r = rng(seed), W = 2048, H = 1024;
    ctx.fillStyle = '#e4e0d8';
    ctx.fillRect(0, 0, W, H);
    // panel-to-panel tone differences
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,110,100'},${0.03 + r() * 0.05})`;
        ctx.fillRect((i * W) / cols, (j * H) / rows, W / cols, H / rows);
      }
    }
    // grime streaks running down from seams
    for (let i = 0; i < 140; i++) {
      const x = r() * W, y = r() * H * 0.6, len = 60 + r() * 260;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(90,70,55,0.12)');
      g.addColorStop(1, 'rgba(90,70,55,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 2 + r() * 5, len);
    }
    // red dust built up towards the bottom (v = 0 is the bottom of a cylinder)
    const dust = ctx.createLinearGradient(0, H, 0, H * 0.55);
    dust.addColorStop(0, 'rgba(150,92,58,0.75)');
    dust.addColorStop(0.35, 'rgba(160,104,70,0.35)');
    dust.addColorStop(1, 'rgba(160,104,70,0)');
    ctx.fillStyle = dust;
    ctx.fillRect(0, 0, W, H);
    // seams and rivets
    ctx.strokeStyle = 'rgba(60,55,50,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= cols; i++) {
      const x = (i * W) / cols;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = (j * H) / rows;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(70,66,60,0.6)';
    for (let i = 0; i <= cols; i++) {
      for (let y = 8; y < H; y += 22) ctx.fillRect((i * W) / cols - 9, y, 3, 3);
    }
    // stencils
    ctx.fillStyle = 'rgba(40,44,52,0.85)';
    ctx.font = 'bold 54px "DIN Alternate", "Arial Narrow", sans-serif';
    ctx.fillText(label, W * 0.08, H * 0.3);
    ctx.font = 'bold 26px "Arial Narrow", sans-serif';
    ctx.fillText('PRESSURISED · DO NOT DRILL', W * 0.08, H * 0.36);
    ctx.fillStyle = 'rgba(220,120,40,0.9)'; // hazard stripe by the label
    for (let i = 0; i < 8; i++) ctx.fillRect(W * 0.08 + i * 34, H * 0.38, 18, 14);
  });
}

function solarTexture() {
  return canvasTexture(1024, 512, (ctx) => {
    const W = 1024, H = 512, cx = 16, cy = 8;
    ctx.fillStyle = '#0b1530';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < cx; i++) {
      for (let j = 0; j < cy; j++) {
        const x = (i * W) / cx + 3, y = (j * H) / cy + 3, w = W / cx - 6, h = H / cy - 6;
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#1b3466');
        g.addColorStop(1, '#0f2149');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(190,200,215,0.35)'; // busbars
        ctx.lineWidth = 1;
        for (let k = 1; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x, y + (k * h) / 3);
          ctx.lineTo(x + w, y + (k * h) / 3);
          ctx.stroke();
        }
      }
    }
    // a film of dust, heavier at the low edge
    const d = ctx.createLinearGradient(0, H, 0, 0);
    d.addColorStop(0, 'rgba(170,110,75,0.35)');
    d.addColorStop(1, 'rgba(170,110,75,0.08)');
    ctx.fillStyle = d;
    ctx.fillRect(0, 0, W, H);
  });
}

function treadTexture() {
  return canvasTexture(512, 64, (ctx) => {
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#4a4c51';
    for (let i = 0; i < 32; i++) ctx.fillRect(i * 16, 0, 7, 64); // chevron grousers
    ctx.fillStyle = 'rgba(160,104,70,0.45)'; // dust packed into the tread
    ctx.fillRect(0, 0, 512, 64);
  }, true);
}

// ---------- the base ----------

/**
 * centre: ground position of the habitat (local frame). facing: unit vector from the habitat towards the airlock.
 * heightAt: ground height, so everything stands on the real terrain.
 */
export function createSpaceBase(centre: THREE.Vector3, facing: THREE.Vector3, heightAt: (x: number, z: number) => number): SpaceBase {
  const group = new THREE.Group();
  group.name = 'space-base';
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const animations: ((t: number) => void)[] = [];
  const footprint: { x: number; z: number; r: number }[] = []; // local frame, filled by each module

  const grime = keep(createNoiseTexture(256, 41, 6));
  const crinkle = keep(createNoiseTexture(256, 77, 8));
  const habSkin = keep(hullTexture('HAB-1', 16, 4, 11));
  const labSkin = keep(hullTexture('AIRLOCK A', 8, 2, 12));
  const landerSkin = keep(hullTexture('ASCENT VEHICLE', 12, 6, 13));
  const roverSkin = keep(hullTexture('PR-2', 6, 2, 14));
  const cells = keep(solarTexture());
  const tread = keep(treadTexture());

  const hullMat = (map: THREE.Texture) => keep(new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0.05, bumpMap: grime, bumpScale: 0.015 }));
  const hab = hullMat(habSkin), lockMat = hullMat(labSkin), landerMat = hullMat(landerSkin), roverMat = hullMat(roverSkin);
  const plain = keep(new THREE.MeshStandardMaterial({ color: '#d9d4ca', roughness: 0.65, bumpMap: grime, bumpScale: 0.015 }));
  const dusty = keep(new THREE.MeshStandardMaterial({ color: '#b89a80', roughness: 0.85, bumpMap: grime, bumpScale: 0.02 }));
  const darkMetal = keep(new THREE.MeshStandardMaterial({ color: '#3a3e45', roughness: 0.45, metalness: 0.75 }));
  const steel = keep(new THREE.MeshStandardMaterial({ color: '#a9b0b8', roughness: 0.3, metalness: 0.9 }));
  const gold = keep(new THREE.MeshStandardMaterial({ color: '#d2a447', roughness: 0.32, metalness: 1, bumpMap: crinkle, bumpScale: 0.03 }));
  const window_ = keep(new THREE.MeshStandardMaterial({ color: '#141b24', roughness: 0.06, metalness: 0.4, emissive: '#ffc985', emissiveIntensity: 0.35 }));
  const panelMat = keep(new THREE.MeshStandardMaterial({ map: cells, roughness: 0.22, metalness: 0.55 }));
  const tyre = keep(new THREE.MeshStandardMaterial({ map: tread, roughness: 0.9 }));
  const greenhouse = keep(new THREE.MeshStandardMaterial({ color: '#e8f0e4', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.55, emissive: '#c8ffd0', emissiveIntensity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  const leaves = keep(new THREE.MeshStandardMaterial({ color: '#3f8a46', roughness: 0.8, emissive: '#1f5a26', emissiveIntensity: 0.25 }));
  const growLight = keep(new THREE.MeshBasicMaterial({ color: '#ff8ad8' }));
  const lamp = keep(new THREE.MeshBasicMaterial({ color: '#fff1d6' }));
  const red = keep(new THREE.MeshBasicMaterial({ color: '#ff3b30' }));
  const cable = keep(new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.7 }));
  const orange = keep(new THREE.MeshStandardMaterial({ color: '#d9822b', roughness: 0.55 }));

  // Local layout frame: +Z towards the airlock ("front"), +X to the right.
  const yaw = Math.atan2(facing.x, facing.z);
  const local = new THREE.Group();
  local.position.copy(centre);
  local.rotation.y = yaw;
  group.add(local);
  const toWorld = (lx: number, lz: number) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw).add(centre);
  const ground = (lx: number, lz: number) => {
    const p = toWorld(lx, lz);
    return heightAt(p.x, p.z) - centre.y;
  };
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = local) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cableOnGround = (pts: [number, number][], r = 0.035) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, ground(x, z) + r, z)));
    put(new THREE.TubeGeometry(curve, pts.length * 12, r, 6, false), cable, 0, 0, 0);
  };

  // ---------- modules ----------

  const habitat = () => {
    // 8 m drum, two storeys, domed roof, window band, frame rings, landing legs, ladder and roof handrail.
    const g0 = ground(0, 0);
    put(new THREE.CylinderGeometry(4, 4, 5, 64, 1, true), hab, 0, g0 + 2.5, 0);
    put(new THREE.SphereGeometry(4, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2), plain, 0, g0 + 5, 0);
    for (const y of [0.35, 2.55, 4.95]) put(new THREE.TorusGeometry(4.03, 0.07, 10, 96), dusty, 0, g0 + y, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      if (Math.cos(a) > 0.85) continue; // leave the airlock side clear
      const frame = put(new RoundedBoxGeometry(0.95, 0.62, 0.16, 3, 0.05), darkMetal, Math.sin(a) * 3.97, g0 + 3.6, Math.cos(a) * 3.97);
      frame.rotation.y = a;
      const w = put(new THREE.BoxGeometry(0.8, 0.48, 0.05), window_, Math.sin(a) * 4.04, g0 + 3.6, Math.cos(a) * 4.04);
      w.rotation.y = a;
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(new THREE.CylinderGeometry(0.14, 0.2, 0.7, 14), darkMetal, Math.sin(a) * 3.55, g0 + 0.2, Math.cos(a) * 3.55);
      put(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 20), darkMetal, Math.sin(a) * 3.65, ground(Math.sin(a) * 3.65, Math.cos(a) * 3.65) + 0.05, Math.cos(a) * 3.65);
    }
    // ladder up the side to the roof
    const la = -Math.PI * 0.62;
    const ladder = new THREE.Group();
    ladder.position.set(Math.sin(la) * 4.12, g0, Math.cos(la) * 4.12);
    ladder.rotation.y = la;
    local.add(ladder);
    for (const sx of [-0.22, 0.22]) put(new THREE.CylinderGeometry(0.025, 0.025, 6.2, 8), steel, sx, 3.1, 0, ladder);
    for (let y = 0.4; y < 6; y += 0.32) put(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 6), steel, 0, y, 0, ladder).rotation.z = Math.PI / 2;
    // roof antenna and handrail
    put(new THREE.TorusGeometry(2.2, 0.025, 6, 64), steel, 0, g0 + 7.6, 0).rotation.x = Math.PI / 2;
    put(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), steel, 1.2, g0 + 9.4, -0.6);
    // external oxygen / nitrogen tanks on a rack behind the habitat
    for (let i = 0; i < 3; i++) {
      const t = put(new THREE.CapsuleGeometry(0.42, 1.8, 8, 24), i === 1 ? orange : plain, -2 + i * 1.0, ground(-2 + i, -5.4) + 0.62, -5.4);
      t.rotation.z = Math.PI / 2;
      t.rotation.y = Math.PI / 2;
    }
    put(new THREE.BoxGeometry(3.2, 0.1, 1.0), darkMetal, -1, ground(-1, -5.4) + 0.12, -5.4);
    footprint.push({ x: 0, z: 0, r: 5 }, { x: -1, z: -5.4, r: 2 });
  };

  let doorLight: THREE.Mesh;
  const airlock = () => {
    const gA = ground(0, 5.2);
    const tunnel = put(new THREE.CylinderGeometry(1.25, 1.25, 2.8, 48, 1, true), lockMat, 0, gA + 1.35, 5.1);
    tunnel.rotation.x = Math.PI / 2;
    for (const z of [4.0, 6.4]) put(new THREE.TorusGeometry(1.27, 0.07, 10, 64), dusty, 0, gA + 1.35, z);
    put(new THREE.TorusGeometry(0.9, 0.09, 12, 64), darkMetal, 0, gA + 1.35, 6.5); // hatch frame
    const hatch = put(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 48), plain, 0, gA + 1.35, 6.48);
    hatch.rotation.x = Math.PI / 2;
    const port = put(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32), window_, 0, gA + 1.75, 6.55); // hatch window
    port.rotation.x = Math.PI / 2;
    put(new THREE.TorusGeometry(0.12, 0.018, 8, 24, Math.PI), steel, 0, gA + 1.1, 6.58); // hatch handle
    // supports under the tunnel, steps and handrails
    for (const z of [4.4, 6.0]) put(new THREE.BoxGeometry(1.6, 0.12, 0.2), darkMetal, 0, gA + 0.06, z);
    for (let s = 0; s < 2; s++) put(new THREE.BoxGeometry(1.2, 0.08, 0.35), steel, 0, ground(0, 7 + s * 0.4) + 0.25 - s * 0.12, 6.85 + s * 0.38);
    for (const sx of [-0.85, 0.85]) {
      put(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), steel, sx, gA + 0.55, 7.2);
      const rail = put(new THREE.CylinderGeometry(0.022, 0.022, 1.2, 8), steel, sx, gA + 1.1, 6.6);
      rail.rotation.x = Math.PI / 2;
    }
    // floodlights on poles either side of the hatch, and the green "ready" light above it
    for (const sx of [-2.2, 2.2]) {
      const g = ground(sx, 7.2);
      put(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 10), steel, sx, g + 1.6, 7.2);
      const head = put(new RoundedBoxGeometry(0.36, 0.2, 0.16, 2, 0.04), darkMetal, sx, g + 3.25, 7.15);
      head.rotation.x = 0.5;
      put(new THREE.PlaneGeometry(0.3, 0.14), lamp, sx, g + 3.2, 7.235).rotation.x = 0.5; // faces out and down
    }
    doorLight = put(new THREE.SphereGeometry(0.07, 14, 10), keep(new THREE.MeshBasicMaterial({ color: '#4cd964' })), 0, gA + 2.45, 6.42);
    const porch = new THREE.PointLight('#ffe1b3', 10, 16, 2);
    porch.position.set(0, gA + 3.1, 8);
    local.add(porch);
    animations.push((t) => doorLight.scale.setScalar(0.85 + 0.15 * Math.sin(t * 2)));
    footprint.push({ x: 0, z: 5.5, r: 2.2 }, { x: -2.2, z: 7.2, r: 0.5 }, { x: 2.2, z: 7.2, r: 0.5 });
  };

  const greenhouseModule = () => {
    // Half-tube greenhouse with ribs, glowing grow lights and rows of plants inside.
    const gG = ground(-9, 0);
    const tube = put(new THREE.CylinderGeometry(2.2, 2.2, 9, 48, 1, true, 0, Math.PI), greenhouse, -9, gG + 0.15, 0);
    tube.rotation.set(0, 0, Math.PI / 2); // axis along X, the curved half on top
    tube.renderOrder = 2;
    for (let i = 0; i <= 6; i++) {
      const rib = put(new THREE.TorusGeometry(2.22, 0.045, 8, 48, Math.PI), plain, -13.5 + i * 1.5, gG + 0.15, 0);
      rib.rotation.y = Math.PI / 2;
    }
    for (const x of [-4.5, -13.5]) {
      const end = put(new THREE.CircleGeometry(2.2, 48, 0, Math.PI), plain, x, gG + 0.15, 0);
      end.rotation.y = Math.PI / 2;
    }
    for (const z of [-1.1, 0, 1.1]) {
      put(new THREE.BoxGeometry(8.2, 0.35, 0.5), dusty, -9, gG + 0.35, z);
      for (let i = 0; i < 14; i++) {
        const leaf = put(new THREE.IcosahedronGeometry(0.22, 1), leaves, -12.9 + i * 0.6, gG + 0.68, z);
        leaf.scale.set(1, 0.7 + ((i * 7) % 5) * 0.08, 1);
      }
      put(new THREE.BoxGeometry(8, 0.04, 0.12), growLight, -9, gG + 1.9, z);
    }
    put(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 32), plain, -4.3, gG + 1.2, 0).rotation.z = Math.PI / 2; // tunnel to the habitat
    footprint.push({ x: -9, z: 0, r: 5.2 });
  };

  const solarField = () => {
    // 3 rows x 4 tilted panels on posts, with frames, facing the sun at noon; cables run to the habitat.
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = -7.5 + col * 5, z = -11 - row * 4;
        const gS = ground(x, z);
        const p = new THREE.Group();
        p.position.set(x, gS + 1.25, z);
        p.rotation.x = -0.45;
        local.add(p);
        put(new THREE.BoxGeometry(4.2, 0.04, 2.4), panelMat, 0, 0, 0, p);
        for (const sz of [-1.22, 1.22]) put(new THREE.BoxGeometry(4.26, 0.07, 0.05), steel, 0, 0, sz, p);
        for (const sx of [-2.12, 2.12]) put(new THREE.BoxGeometry(0.05, 0.07, 2.48), steel, sx, 0, 0, p);
        put(new THREE.CylinderGeometry(0.06, 0.07, 1.25, 10), steel, x, gS + 0.62, z);
        put(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 14), darkMetal, x, gS + 0.03, z);
      }
      cableOnGround([[-7.5, -11 - row * 4], [-3, -9.5 - row * 3], [-1.2, -6.6], [-0.6, -4.3]]);
    }
    footprint.push({ x: 0, z: -15, r: 10.5 });
  };

  let landerBeacon: THREE.Mesh;
  const lander = () => {
    // The ascent vehicle: panelled body, gold-foil insulated mid-section, nose cone, engine bell, RCS pods, legs.
    const gL = ground(18, -6);
    const L = new THREE.Group();
    L.position.set(18, gL, -6);
    local.add(L);
    put(new THREE.CylinderGeometry(1.7, 2.1, 3.4, 48), landerMat, 0, 5.6, 0, L);
    put(new THREE.CylinderGeometry(2.12, 2.25, 1.6, 48), gold, 0, 3.1, 0, L);
    put(new THREE.CylinderGeometry(2.26, 2.26, 0.3, 48), darkMetal, 0, 2.15, 0, L);
    put(new THREE.ConeGeometry(1.7, 2.8, 48), plain, 0, 8.7, 0, L);
    put(new THREE.LatheGeometry([new THREE.Vector2(0.35, 0), new THREE.Vector2(0.5, -0.3), new THREE.Vector2(0.85, -0.95), new THREE.Vector2(0.95, -1.1)], 32), steel, 0, 2.0, 0, L); // engine bell
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      put(new RoundedBoxGeometry(0.35, 0.5, 0.3, 2, 0.06), darkMetal, Math.sin(a) * 1.85, 6.8, Math.cos(a) * 1.85, L).rotation.y = a;
      // legs: strut out to a footpad, with a cross brace
      const leg = new THREE.Group();
      leg.rotation.y = a + Math.PI / 4;
      L.add(leg);
      const strut = put(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 10), steel, 0, 1.15, 2.6, leg);
      strut.rotation.x = -0.55; // top end in at the body, bottom end out at the footpad
      const brace = put(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), steel, 0, 1.0, 2.0, leg);
      brace.rotation.x = -1.25;
      put(new THREE.CylinderGeometry(0.45, 0.55, 0.14, 20), darkMetal, 0, 0.07 + (ground(18 + Math.sin(a + Math.PI / 4) * 3.4, -6 + Math.cos(a + Math.PI / 4) * 3.4) - gL), 3.4, leg);
    }
    landerBeacon = put(new THREE.SphereGeometry(0.1, 12, 8), red, 0, 10.15, 0, L);
    animations.push((t) => (landerBeacon.visible = Math.sin(t * 3) > 0.6));
    footprint.push({ x: 18, z: -6, r: 4.2 });
  };

  let mastLight: THREE.Mesh;
  const comms = () => {
    // Comms mast: tripod base, lattice-look mast, high-gain dish pointed at the sky.
    const x = 7, z = 2, gM = ground(x, z);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const foot = put(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), steel, x + Math.sin(a) * 0.55, gM + 1.0, z + Math.cos(a) * 0.55);
      foot.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
    }
    put(new THREE.CylinderGeometry(0.07, 0.1, 9, 10), steel, x, gM + 4.5, z);
    for (let y = 1; y < 9; y += 0.9) put(new THREE.TorusGeometry(0.1, 0.012, 6, 16), steel, x, gM + y, z).rotation.x = Math.PI / 2;
    const dishMat = keep(new THREE.MeshStandardMaterial({ color: '#e2ded6', roughness: 0.5, side: THREE.DoubleSide }));
    const dish = put(new THREE.SphereGeometry(1.2, 48, 12, 0, Math.PI * 2, 0, Math.PI / 3.4), dishMat, x, gM + 8.6, z);
    dish.rotation.set(-1.0, 0.5, 0);
    put(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), steel, x + 0.25, gM + 8.9, z + 0.3).rotation.x = -1.0;
    mastLight = put(new THREE.SphereGeometry(0.07, 10, 8), red, x, gM + 9.1, z);
    animations.push((t) => (mastLight.visible = Math.sin(t * 3) <= 0.6));
    cableOnGround([[x, z], [4.5, 1.2], [3.9, 0.6]]);
    footprint.push({ x, z, r: 1.4 });
  };

  const rover = () => {
    // Pressurised rover parked by the airlock: rounded cabin, wrap-around windows, six treaded wheels on arms.
    const R = new THREE.Group();
    R.position.set(6.8, ground(6.8, 7.5), 7.5);
    R.rotation.y = -0.6;
    local.add(R);
    put(new RoundedBoxGeometry(2.5, 1.6, 4.6, 6, 0.42), roverMat, 0, 1.75, 0, R);
    put(new RoundedBoxGeometry(2.3, 0.7, 0.4, 4, 0.18), window_, 0, 2.0, 2.18, R);
    for (const sx of [-1.24, 1.24]) put(new RoundedBoxGeometry(0.06, 0.45, 1.4, 2, 0.02), window_, sx, 2.05, 1.2, R);
    put(new RoundedBoxGeometry(2.0, 0.18, 0.3, 2, 0.06), darkMetal, 0, 2.62, 1.6, R); // light bar
    for (const sx of [-0.6, 0, 0.6]) put(new THREE.PlaneGeometry(0.42, 0.1), lamp, sx, 2.62, 1.76, R);
    put(new THREE.TorusGeometry(0.55, 0.06, 10, 40), darkMetal, 0, 1.7, -2.32, R); // rear docking hatch
    put(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), steel, -0.8, 3.1, -1.4, R); // whip antenna
    for (const [x, z] of [[-1.38, -1.55], [1.38, -1.55], [-1.38, 0], [1.38, 0], [-1.38, 1.55], [1.38, 1.55]]) {
      const w = put(new THREE.CylinderGeometry(0.52, 0.52, 0.42, 32), tyre, x, 0.52, z, R);
      w.rotation.z = Math.PI / 2;
      const hub = put(new THREE.CylinderGeometry(0.22, 0.22, 0.44, 20), steel, x, 0.52, z, R);
      hub.rotation.z = Math.PI / 2;
      put(new THREE.BoxGeometry(0.12, 0.12, 0.7), darkMetal, x * 0.82, 0.82, z, R); // suspension arm
    }
    footprint.push({ x: 6.8, z: 7.5, r: 3.2 });
  };

  // Base modules in build order. Expansion goes here.
  const MODULES = [habitat, airlock, greenhouseModule, solarField, lander, comms, rover];
  for (const build of MODULES) build();

  // Everything solid casts and receives sun shadows.
  local.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    m.castShadow = !mat.transparent && !(mat instanceof THREE.MeshBasicMaterial);
    m.receiveShadow = !mat.transparent;
  });

  local.updateMatrixWorld(true);
  const door = new THREE.Vector3(0, 0, 8.6).applyMatrix4(local.matrixWorld);
  door.y = heightAt(door.x, door.z);
  const clear = footprint.map((f) => ({ ...toWorld(f.x, f.z), r: f.r }));

  return {
    group,
    door,
    keepClear(x, z, r) {
      for (const c of clear) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r + 0.6) ** 2) return true;
      return false;
    },
    update(t) {
      for (const a of animations) a(t);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
