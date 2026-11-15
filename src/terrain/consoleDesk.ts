// Written with AI assistance (Claude).
// Owner: Rachel. The operations workstation in the habitat, the first thing you see in the sim. Modelled like real
// spacecraft fit-out rather than boxes: one curved desktop with rounded edges wrapping round the seat, a rubber desk
// mat, panelled fascia with seams, screws, stencils and vent grilles, a recessed kick plate, a warm light line under
// the lip, a steel grab rail on posts, a keyboard with real keys and a trackpad, button pads, angled instrument
// modules with guarded toggle switches, knobs and amber readouts.
// The group's origin is the seat on the floor; the desk curves round it on the -z side.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export interface ConsoleDesk {
  group: THREE.Group;
  /** Little status lights, for blinking. */
  leds: THREE.Mesh[];
  dispose(): void;
}

const TOP = 0.76; // desk height, m
const R_IN = 1.05, R_OUT = 1.72; // desk front and back edge, measured from the seat
const SPAN = 0.95; // half the angle the desk wraps round, radians

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Fascia panels: off-white with seams, corner screws, small stencils and vent grilles. */
function fasciaTexture() {
  const t = canvasTexture(2048, 512, (ctx) => {
    ctx.fillStyle = '#e4dfd6';
    ctx.fillRect(0, 0, 2048, 512);
    const g = ctx.createLinearGradient(0, 0, 0, 512); // a touch darker towards the floor
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(60,45,35,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2048, 512);
    const labels = ['DATA', 'PWR A', 'COOLANT', 'PWR B', 'COMMS', 'O2 MON', 'AUX', 'STOWAGE'];
    for (let i = 0; i < 8; i++) {
      const x = i * 256;
      ctx.strokeStyle = 'rgba(70,60,50,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 6, 10, 244, 492);
      ctx.fillStyle = 'rgba(90,85,78,0.7)';
      for (const [sx, sy] of [[18, 22], [238, 22], [18, 490], [238, 490]]) {
        ctx.beginPath();
        ctx.arc(x + sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(60,52,45,0.75)';
      ctx.font = 'bold 22px "Arial Narrow", sans-serif';
      ctx.fillText(labels[i], x + 30, 62);
      if (i % 2 === 1) {
        ctx.fillStyle = 'rgba(40,36,32,0.55)'; // vent grille
        for (let k = 0; k < 9; k++) ctx.fillRect(x + 40, 300 + k * 16, 176, 7);
      } else {
        ctx.strokeStyle = 'rgba(70,60,50,0.3)'; // access hatch
        ctx.strokeRect(x + 50, 140, 156, 200);
        ctx.fillStyle = 'rgba(90,85,78,0.6)';
        ctx.fillRect(x + 118, 230, 20, 8);
      }
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = -1; // seen from inside the curve: flip so the stencils read the right way round
  return t;
}

/** A small amber readout. */
function readoutTexture(lines: string[]) {
  return canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#f3eee6';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#3a2a20';
    ctx.font = '600 34px "DejaVu Sans Mono", monospace';
    lines.forEach((l, i) => ctx.fillText(l, 16, 48 + i * 46));
  });
}

/** A flat ring sector (desktop, mat) lying in the floor plane, curving round the origin on the -z side. */
function sectorGeometry(r0: number, r1: number, half: number, depth: number, bevel: number) {
  const shape = new THREE.Shape();
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = -half + (2 * half * i) / n;
    const p = new THREE.Vector2(r1 * Math.sin(a), r1 * Math.cos(a));
    if (i === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  }
  for (let i = n; i >= 0; i--) {
    const a = -half + (2 * half * i) / n;
    shape.lineTo(r0 * Math.sin(a), r0 * Math.cos(a));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 64 });
  geo.rotateX(-Math.PI / 2); // shape y (away from the seat) becomes world -z; the extrusion goes up
  return geo;
}

export function createConsoleDesk(): ConsoleDesk {
  const group = new THREE.Group();
  group.name = 'console-desk';
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** A frame on the desk at angle a (radians, + to the right) and distance r from the seat; its +z faces the seat. */
  const at = (a: number, r: number, y = 0) => {
    const g = new THREE.Group();
    g.rotation.y = -a;
    g.position.set(r * Math.sin(a), y, -r * Math.cos(a));
    group.add(g);
    return g;
  };
  const leds: THREE.Mesh[] = [];

  // ---------- materials ----------
  const shell = keep(new THREE.MeshStandardMaterial({ color: '#ece8e1', roughness: 0.5, metalness: 0.05 }));
  const shellMid = keep(new THREE.MeshStandardMaterial({ color: '#d6d1c8', roughness: 0.6, metalness: 0.05 }));
  const fascia = keep(new THREE.MeshStandardMaterial({ map: keep(fasciaTexture()), roughness: 0.65, side: THREE.BackSide }));
  const kick = keep(new THREE.MeshStandardMaterial({ color: '#7d7a74', roughness: 0.7, metalness: 0.3, side: THREE.BackSide }));
  const deskMat = keep(new THREE.MeshStandardMaterial({ color: '#33363b', roughness: 0.95 }));
  const alu = keep(new THREE.MeshStandardMaterial({ color: '#b9c0c8', roughness: 0.32, metalness: 0.85 }));
  const panel = keep(new THREE.MeshStandardMaterial({ color: '#4c5159', roughness: 0.55, metalness: 0.2 }));
  const black = keep(new THREE.MeshStandardMaterial({ color: '#1c1e22', roughness: 0.5, metalness: 0.2 }));
  const keycap = keep(new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: 0.45 }));
  const glow = keep(new THREE.MeshBasicMaterial({ color: '#e8bd78', side: THREE.DoubleSide }));
  const guard = keep(new THREE.MeshStandardMaterial({ color: '#a9a49b', roughness: 0.5, transparent: true, opacity: 0.8 }));
  const statusLight = keep(new THREE.MeshBasicMaterial({ color: '#6fb2ff' })); // one quiet blue light

  // ---------- desktop, mat, fascia, kick plate, light line, grab rail ----------
  mesh(sectorGeometry(R_IN, R_OUT, SPAN, 0.035, 0.014), shell, group, 0, TOP - 0.035, 0);
  mesh(sectorGeometry(R_IN + 0.09, R_OUT - 0.14, SPAN - 0.12, 0.004, 0), deskMat, group, 0, TOP + 0.015, 0);
  const cyl = (r: number, h: number, mat: THREE.Material, y: number) => {
    // a curved band facing the seat (theta for angle a is PI - a)
    const m = mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, true, Math.PI - SPAN, 2 * SPAN), mat, group, 0, y, 0);
    return m;
  };
  cyl(R_IN + 0.05, TOP - 0.16, fascia, 0.1 + (TOP - 0.16) / 2 - 0.02);
  cyl(R_IN + 0.11, 0.1, kick, 0.05); // recessed kick plate
  cyl(R_IN + 0.03, 0.012, glow, TOP - 0.06); // light line under the lip
  const railPts = Array.from({ length: 33 }, (_, i) => {
    const a = -SPAN + 0.08 + ((2 * SPAN - 0.16) * i) / 32;
    return new THREE.Vector3(0.97 * Math.sin(a), 0.6, -0.97 * Math.cos(a));
  });
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 96, 0.016, 10), alu, group);
  for (const a of [-0.75, -0.25, 0.25, 0.75]) {
    const post = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 10), alu, at(a, 1.03, 0.6));
    post.rotation.x = Math.PI / 2;
  }
  // end caps of the desk, rounded off where it meets the floor
  for (const s of [-1, 1]) {
    const cap = at(s * SPAN, (R_IN + R_OUT) / 2);
    mesh(new RoundedBoxGeometry(0.05, TOP - 0.02, R_OUT - R_IN, 3, 0.02), shellMid, cap, 0, (TOP - 0.02) / 2, 0);
  }

  // ---------- keyboard and trackpad ----------
  const kb = at(0, 1.18, TOP + 0.03);
  kb.rotation.x = 0.06; // back edge raised a little, towards you
  mesh(new RoundedBoxGeometry(0.5, 0.022, 0.17, 3, 0.008), shellMid, kb);
  const keyGeo = keep(new RoundedBoxGeometry(0.026, 0.012, 0.026, 2, 0.004));
  const keys = new THREE.InstancedMesh(keyGeo, keycap, 15 * 5 + 1);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) keys.setMatrixAt(n++, m4.makeTranslation(-0.21 + c * 0.03, 0.015, -0.06 + r * 0.03));
  keys.setMatrixAt(n++, m4.compose(new THREE.Vector3(0, 0.015, 0.09), new THREE.Quaternion(), new THREE.Vector3(6, 1, 1))); // space bar
  keys.count = n;
  kb.add(keys);
  disposables.push(keys);
  mesh(new RoundedBoxGeometry(0.13, 0.008, 0.1, 2, 0.004), black, at(0.24, 1.2, TOP + 0.02)); // trackpad

  // ---------- button pads either side of the keyboard ----------
  for (const s of [-1, 1]) {
    const pad = at(s * 0.42, 1.2, TOP + 0.032);
    pad.rotation.x = 0.18;
    mesh(new RoundedBoxGeometry(0.26, 0.022, 0.14, 3, 0.008), panel, pad);
    for (let i = 0; i < 6; i++) {
      const x = -0.08 + (i % 3) * 0.08, z = -0.03 + Math.floor(i / 3) * 0.06;
      mesh(new RoundedBoxGeometry(0.05, 0.012, 0.04, 2, 0.006), keycap, pad, x, 0.016, z); // plain light key
    }
    leds.push(mesh(new THREE.SphereGeometry(0.006, 10, 8), statusLight, pad, 0.11, 0.016, -0.055));
  }

  // ---------- angled instrument modules at the ends ----------
  const readouts = [['O2 21.0%', 'P 101.3'], ['T +21.4C', 'RH 38%']];
  for (const s of [-1, 1]) {
    const mod = at(s * 0.86, 1.42, TOP);
    const housing = new THREE.Group();
    housing.rotation.x = 0.55; // sloped towards you
    housing.position.y = 0.09;
    mod.add(housing);
    mesh(new RoundedBoxGeometry(0.52, 0.03, 0.3, 3, 0.01), panel, housing);
    mesh(new THREE.BoxGeometry(0.5, 0.17, 0.02), shellMid, mod, 0, 0.085, -0.13); // back of the wedge
    for (let i = 0; i < 4; i++) {
      // guarded toggle switches
      const x = -0.18 + i * 0.07;
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), alu, housing, x, 0.02, -0.06);
      const lever = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.04, 8), alu, housing, x, 0.04, -0.06);
      lever.rotation.x = i % 2 ? 0.35 : -0.35;
      const g = mesh(new THREE.BoxGeometry(0.03, 0.035, 0.035), guard, housing, x, 0.035, -0.035);
      g.rotation.x = -0.9;
    }
    for (const x of [0.13, 0.2]) {
      // rotary knobs with a pointer line
      mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.025, 24), black, housing, x, 0.027, -0.06);
      mesh(new THREE.BoxGeometry(0.004, 0.004, 0.018), keep(new THREE.MeshBasicMaterial({ color: '#ffffff' })), housing, x, 0.041, -0.068);
    }
    const disp = mesh(new THREE.PlaneGeometry(0.2, 0.085), keep(new THREE.MeshBasicMaterial({ map: keep(readoutTexture(readouts[s < 0 ? 0 : 1])) })), housing, -0.06, 0.017, 0.07);
    disp.rotation.x = -Math.PI / 2;
    leds.push(mesh(new THREE.SphereGeometry(0.007, 10, 8), statusLight, housing, 0.2, 0.02, 0.08));
  }

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial)) {
      m.castShadow = false; // the room has no shadow-casting lights; keep it cheap
    }
  });

  return {
    group,
    leds,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
