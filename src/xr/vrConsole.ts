// Written with AI assistance (Claude). Owner: Nanda. The Setup console (src/ui/SetupConsole.tsx) for the headset.
// On the desktop the console is HTML laid over the base's monitor, which a headset can't show. Here the same plan is
// drawn onto the monitor itself, and you point at it with a controller's laser (A / trigger clicks):
//   left   the mission and its subtasks to tick (exactly two), then what the plan needs: oxygen, time, Survival Odds
//          (all from the same planner, physics and simulation as the desktop console), Save plan, and why it can't
//          launch yet; plus the VR options the desktop has keys for: path style (O), topology (T), sound (M)
//   right  the same terrain map (SetupConsole's drawMap), the planned route, the subtasks (click to tick) and the base
// It reads the console's own props each frame and calls the same toggle, so both stay one plan.

import * as THREE from 'three';
import { drawMap, mapRegion, MAP_H, MAP_W, type SetupLevels, type SetupMission } from '../ui/SetupConsole';
import type { Grid } from '../shared/grids';
import type { Pointable } from './xrRig';

type XZ = { x: number; z: number };
export type VROption = 'outline' | 'topology' | 'sound';

export interface VRConsoleModel {
  missions: SetupMission[];
  chosen: boolean[];
  levels: SetupLevels | null;
  heights: Grid<Float32Array> | null;
  route: XZ[];
  routeTo: number;
  base: XZ;
  ready: boolean;
  /** Why you can't go out yet (the game's launch check), or null. */
  why: string | null;
  options: { outline: 'world' | 'glass'; topology: boolean; sound: boolean };
}

export interface VRConsoleActions {
  toggle(i: number): void;
  close(): void;
  option(o: VROption): void;
}

export interface VRConsole extends Pointable {
  readonly open: boolean;
  show(on: boolean): void;
  update(m: VRConsoleModel): void;
  dispose(): void;
}

const W = 2048, H = 1152; // the monitor is 1.7 x 0.956 m (16:9)
const C = { bg: '#f3eee6', panel: '#ebe4d9', panel2: '#f7f2ea', ink: '#3a2a20', dim: '#8a7462', sand: '#c8a669', clay: '#c26860', blue: '#0a84ff', track: '#ddd3c4', paper: '#fff6ea' };
const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const LEFT = Math.round(W / 3); // plan a third, map two thirds (as the desktop grid)

type Region = { x: number; y: number; w: number; h: number; id: string };

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, weight: number, colour: string, align: CanvasTextAlign = 'left', spacing = 0, maxWidth?: number) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.letterSpacing = `${spacing}em`;
  ctx.textAlign = align;
  ctx.fillStyle = colour;
  ctx.fillText(s, x, y, maxWidth);
  return Math.min(ctx.measureText(s).width, maxWidth ?? Infinity);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke?: string, lw = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function meter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, f: number, tone: 'ok' | 'warning' | 'danger') {
  box(ctx, x, y, w, 12, 6, C.track);
  box(ctx, x, y, Math.max(12, w * Math.min(1, Math.max(0, f))), 12, 6, tone === 'danger' ? C.clay : tone === 'warning' ? C.sand : C.blue);
}

export function createVRConsole(screen: { object: THREE.Object3D; width: number; height: number }, actions: VRConsoleActions): VRConsole {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(screen.width, screen.height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  mesh.position.z = 0.004; // just in front of the monitor's glass
  mesh.visible = false;
  screen.object.add(mesh);

  const mapCanvas = document.createElement('canvas');
  let mapKey = '', region = mapRegion([{ x: 0, z: 0 }]), drawnKey = '', hoverId = '', model: VRConsoleModel | null = null;
  let regions: Region[] = [];

  const draw = (m: VRConsoleModel) => {
    regions = [];
    const hit = (x: number, y: number, w: number, h: number, id: string) => regions.push({ x, y, w, h, id });
    ctx.letterSpacing = '0em';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // ---- right: the map
    const mw = W - LEFT, s = Math.max(mw / MAP_W, H / MAP_H), ox = LEFT + (mw - MAP_W * s) / 2, oy = (H - MAP_H * s) / 2;
    const toMap = (p: XZ) => ({ x: ox + ((p.x - region.x0) / (region.x1 - region.x0)) * MAP_W * s, y: oy + ((p.z - region.z0) / (region.z1 - region.z0)) * MAP_H * s });
    ctx.save();
    ctx.beginPath();
    ctx.rect(LEFT, 0, mw, H);
    ctx.clip();
    if (m.heights) ctx.drawImage(mapCanvas, ox, oy, MAP_W * s, MAP_H * s);
    else text(ctx, 'Loading the map…', LEFT + mw / 2, H / 2, 40, 600, C.dim, 'center');
    const path = (pts: XZ[]) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(toMap(p).x, toMap(p).y) : ctx.moveTo(toMap(p).x, toMap(p).y)));
    };
    ctx.lineJoin = ctx.lineCap = 'round';
    path(m.route);
    ctx.setLineDash([8 * s, 8 * s]);
    ctx.strokeStyle = 'rgba(40, 30, 25, 0.45)';
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.setLineDash([]);
    if (m.routeTo > 0) {
      path(m.route.slice(0, m.routeTo + 1));
      ctx.strokeStyle = C.paper;
      ctx.lineWidth = 10 * s;
      ctx.stroke();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 5 * s;
      ctx.stroke();
    }
    m.missions.forEach((mi, i) => {
      const p = toMap(mi.at), r = (hoverId === `task${i}` ? 21 : 17) * s * 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = mi.done ? C.blue : m.chosen[i] ? C.clay : C.paper;
      ctx.fill();
      ctx.strokeStyle = mi.done || m.chosen[i] ? C.paper : C.clay;
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      text(ctx, mi.done ? '✓' : String(i + 1), p.x, p.y + 1, 26 * s, 800, mi.done || m.chosen[i] ? '#fff' : C.ink, 'center');
      if (hoverId === `task${i}`) text(ctx, mi.title, p.x + r + 12, p.y, 28 * s, 700, C.ink);
      if (!mi.done) hit(p.x - r, p.y - r, 2 * r, 2 * r, `task${i}`);
    });
    const b = toMap(m.base);
    box(ctx, b.x - 18 * s, b.y - 18 * s, 36 * s, 36 * s, 6 * s, C.ink, C.paper, 3 * s);
    text(ctx, 'Base', b.x + 28 * s, b.y, 28 * s, 700, C.ink);
    const scalePx = (100 / (region.x1 - region.x0)) * MAP_W * s, sx = LEFT + 70, sy = H - 60;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + scalePx, sy);
    ctx.moveTo(sx, sy - 9);
    ctx.lineTo(sx, sy + 9);
    ctx.moveTo(sx + scalePx, sy - 9);
    ctx.lineTo(sx + scalePx, sy + 9);
    ctx.stroke();
    text(ctx, '100 m', sx + scalePx / 2, sy - 26, 26, 700, C.ink, 'center');
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.moveTo(W - 80, 60);
    ctx.lineTo(W - 68, 96);
    ctx.lineTo(W - 80, 88);
    ctx.lineTo(W - 92, 96);
    ctx.fill();
    text(ctx, 'N', W - 80, 124, 26, 800, C.ink, 'center');
    ctx.restore();

    // ---- left: the plan
    const x = 28, cw = LEFT - 56;
    box(ctx, x, 24, 64, 64, 12, hoverId === 'close' ? C.panel : null);
    text(ctx, '←', x + 32, 56, 44, 700, hoverId === 'close' ? C.blue : C.ink, 'center');
    hit(x, 24, 64, 64, 'close');
    let y = 104;
    const tasksH = 70 + m.missions.length * 74;
    box(ctx, x, y, cw, tasksH, 16, C.panel);
    text(ctx, 'Ridge field traverse', x + 24, y + 38, 36, 800, C.ink);
    m.missions.forEach((mi, i) => {
      const ry = y + 70 + i * 74, id = `task${i}`;
      box(ctx, x + 16, ry, cw - 32, 64, 10, hoverId === id && !mi.done ? '#ffffff' : C.panel2);
      ctx.globalAlpha = mi.done ? 0.55 : 1;
      box(ctx, x + 32, ry + 17, 30, 30, 6, m.chosen[i] ? C.blue : '#ffffff', m.chosen[i] ? C.blue : C.dim);
      if (m.chosen[i]) text(ctx, '✓', x + 47, ry + 33, 24, 800, '#fff', 'center');
      ctx.beginPath();
      ctx.arc(x + 96, ry + 32, 19, 0, Math.PI * 2);
      ctx.fillStyle = C.clay;
      ctx.fill();
      text(ctx, String(i + 1), x + 96, ry + 33, 22, 800, '#fff', 'center');
      text(ctx, mi.title, x + 130, ry + 32, 28, 600, C.ink);
      text(ctx, mi.done ? 'Done' : `${mi.minutes} min`, x + cw - 36, ry + 32, 24, 500, C.dim, 'right');
      ctx.globalAlpha = 1;
      if (!mi.done) hit(x + 16, ry, cw - 32, 64, id);
    });
    y += tasksH + 18;
    const l = m.levels;
    box(ctx, x, y, cw, H - y - 24, 16, C.panel);
    text(ctx, 'ENGINEERING SCENARIO ESTIMATES', x + 24, y + 36, 22, 700, C.sand, 'left', 0.12);
    let yy = y + 82;
    const row = (label: string, value: string, sub: string, f: number | null, tone: 'ok' | 'warning' | 'danger') => {
      text(ctx, label, x + 24, yy, 22, 600, C.dim);
      const vw = text(ctx, value, x + 24, yy + 32, 28, 800, C.ink);
      if (sub) text(ctx, sub, x + 34 + vw, yy + 33, 21, 500, C.dim, 'left', 0, cw - 58 - vw);
      if (f !== null) meter(ctx, x + 24, yy + 56, cw - 48, f, tone);
      yy += f !== null ? 92 : 72;
    };
    if (l) {
      const needed = l.walkGrams + l.taskGrams + l.reserveGrams, fitsO2 = needed <= l.tankGrams, fitsTime = l.minutes <= l.evaMinutes;
      row('Oxygen', `${needed.toFixed(1)} g of ${l.tankGrams.toFixed(1)} g`, `· ${l.reserveGrams.toFixed(1)} g reserve`, needed / l.tankGrams, fitsO2 ? 'ok' : 'danger');
      row('Time', `${Math.round(l.minutes)} of ${l.evaMinutes} minutes`, `· ${Math.round(l.metres)} m walk`, l.minutes / l.evaMinutes, fitsTime ? (l.minutes > l.evaMinutes * 0.85 ? 'warning' : 'ok') : 'danger');
      if (l.odds) {
        const o = l.odds;
        row('Survival odds', `${Math.floor(o.success * 100)}%`, `of 1,000 simulated EVAs · safest of ${o.compared} orders`, o.success, o.success >= 0.95 ? 'ok' : o.success >= 0.8 ? 'warning' : 'danger');
        text(ctx, `Assumed leak, fall and dust rates, not NASA data${o.mainCause ? ` · main risk: ${o.mainCause}` : ''}`, x + 24, yy - 10, 18, 500, C.dim, 'left', 0, cw - 48);
        yy += 24;
      }
      row('Base O₂ storage', 'Not simulated', '', null, 'ok');
    } else text(ctx, 'Loading…', x + 24, yy, 26, 600, C.dim);
    // Save plan, and why you can't go out yet
    const by = Math.max(yy + 4, H - 250);
    box(ctx, x + 24, by, 260, 62, 10, hoverId === 'save' ? '#ffffff' : null, hoverId === 'save' ? C.blue : C.ink, 2);
    text(ctx, 'Save plan →', x + 154, by + 32, 26, 700, hoverId === 'save' ? C.blue : C.ink, 'center');
    hit(x + 24, by, 260, 62, 'save');
    text(ctx, m.ready ? 'Ready: suit up at the hatch' : m.why ?? '', x + 300, by + 32, 22, 600, m.ready ? C.blue : C.clay);
    // VR options (the desktop's O, T and M keys)
    const oy2 = H - 140;
    text(ctx, 'VR OPTIONS', x + 24, oy2, 20, 700, C.sand, 'left', 0.12);
    const opts: [VROption, string][] = [
      ['outline', `Path: ${m.options.outline === 'glass' ? 'Glass' : 'World'}`],
      ['topology', `Topology: ${m.options.topology ? 'On' : 'Off'}`],
      ['sound', `Sound: ${m.options.sound ? 'On' : 'Off'}`],
    ];
    const pw = (cw - 48 - 2 * 14) / 3;
    opts.forEach(([id, label], i) => {
      const px = x + 24 + i * (pw + 14), py = oy2 + 22;
      box(ctx, px, py, pw, 56, 28, hoverId === id ? '#ffffff' : C.panel2, hoverId === id ? C.blue : C.dim, 2);
      text(ctx, label, px + pw / 2, py + 29, 22, 700, hoverId === id ? C.blue : C.ink, 'center');
      hit(px, py, pw, 56, id);
    });
  };

  const at = (uv: THREE.Vector2) => {
    const px = uv.x * W, py = (1 - uv.y) * H;
    return regions.find((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)?.id ?? '';
  };
  const redraw = () => {
    if (!model) return;
    draw(model);
    texture.needsUpdate = true;
  };

  return {
    mesh,
    get open() {
      return mesh.visible;
    },
    show(on) {
      mesh.visible = on;
      if (on) redraw();
    },
    update(m) {
      model = m;
      if (!mesh.visible) return;
      // The terrain map only when what it covers changes (it takes a moment to draw).
      region = mapRegion([m.base, ...m.route, ...m.missions.map((mi) => mi.at)]);
      const rk = `${!!m.heights}|${region.x0.toFixed(1)},${region.x1.toFixed(1)},${region.z0.toFixed(1)},${region.z1.toFixed(1)}`;
      if (m.heights && rk !== mapKey) {
        mapKey = rk;
        drawMap(mapCanvas, m.heights, region);
      }
      const k = `${rk}|${hoverId}|${JSON.stringify({ ...m, heights: !!m.heights })}`;
      if (k !== drawnKey) {
        drawnKey = k;
        redraw();
      }
    },
    hover(uv) {
      const id = uv ? at(uv) : '';
      if (id !== hoverId) {
        hoverId = id;
        drawnKey = ''; // redraw on the next update
        if (model && mesh.visible) redraw();
      }
    },
    click(uv) {
      const id = at(uv);
      if (id.startsWith('task')) actions.toggle(Number(id.slice(4)));
      else if (id === 'close' || id === 'save') actions.close();
      else if (id === 'outline' || id === 'topology' || id === 'sound') actions.option(id);
    },
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      texture.dispose();
    },
  };
}
