// Written with AI assistance (Claude). Owner: Nanda. The helmet HUD rebuilt in 3D for the headset.
//
// A headset only shows what WebGL draws, so the web HUD (src/ui/HelmetHud.tsx: SVG and CSS on the page) can't appear
// in VR. This draws the SAME data (HelmetHud's props) in the same layout and palette onto a curved visor band 1.3 m in
// front of you, spanning 72°, which gently follows where you face:
//   top-left    OBJECTIVES n / m · RETURN clock · fast-forward, then one line per objective with its timer
//   top centre  the alert (⚠ title, message, [A] to accept)
//   right       the O₂ and BODY bars, with the status note (e.g. visor fogging) under them
//   low left    the holographic compass disc: heading, N E S W, the next objective and the base
//   centre      the base prompt indoors, and the controls tutorial
// The band only redraws when its content changes; the compass, which turns with you, has its own small texture.
// No visor-dome distortion: the headset has real lenses, and a fake one on top makes people sick.

import * as THREE from 'three';
import type { HudAlert, HudObjectives, Level, SuitBar } from '../ui/HelmetHud';
import type { CompassTarget } from '../ui/hudCompass';
import { palette } from '../ui/palette.ts';

export type HudLine = { text: string; level?: Level };

export interface VRHudModel {
  /** Outdoors (helmet on): the full HUD. Indoors: only the prompt (and the tutorial). */
  outdoors: boolean;
  objectives: HudObjectives;
  alert: HudAlert | null;
  o2: SuitBar;
  temperature: SuitBar;
  status?: { title: string; message: string } | null;
  fastForward?: number | null;
  /** heading and bearings: radians, 0 = north, clockwise (as hudCompass.ts). */
  compass?: { heading: number; targets: CompassTarget[] } | null;
  prompt?: string | null;
  tutorial?: HudLine[] | null;
}

export interface VRHud {
  group: THREE.Group;
  /** Redraw what changed (the band at most 10 times a second, the compass every frame). */
  update(model: VRHudModel): void;
  dispose(): void;
}

const RADIUS = 1.3; // metres from your eyes
const SPAN = (72 * Math.PI) / 180; // band width as an angle
const W = 2048, H = 720; // band canvas
const BAND_W = RADIUS * SPAN, BAND_H = (BAND_W * H) / W;
const CW = 512, CH = 264; // compass canvas (the web compass is 240 x 124)
const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const LEVEL: Record<Level, string> = { ok: palette.hud, warning: palette.warning, danger: palette.danger };
const ALERT: Record<HudAlert['level'], string> = { info: palette.ar, warning: palette.warning, danger: palette.danger };

/** A plane bent round the viewer at `radius`: x on the plane becomes an angle, so every part is the same distance away. */
function bentPlane(width: number, height: number, radius: number) {
  const g = new THREE.PlaneGeometry(width, height, 48, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) / radius;
    pos.setXYZ(i, radius * Math.sin(a), pos.getY(i), -radius * Math.cos(a));
  }
  return g;
}

function layer(canvas: HTMLCanvasElement, geometry: THREE.BufferGeometry, order: number) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = order; // drawn last, on top of the world, like light on the visor
  mesh.frustumCulled = false;
  return { mesh, texture };
}

const canvas2d = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
};

function glow(ctx: CanvasRenderingContext2D, colour: string, blur: number) {
  ctx.shadowColor = colour;
  ctx.shadowBlur = blur;
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, weight: number, colour: string, spacing = 0, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.letterSpacing = `${spacing}em`;
  ctx.textAlign = align;
  ctx.fillStyle = colour;
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: string) {
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(8, 18, 30, 0.55)'; // a darker glass than the web's, so text reads against bright ground
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 22);
  ctx.fill();
  ctx.stroke();
}

// ---- the band

function drawObjectives(ctx: CanvasRenderingContext2D, o: HudObjectives, fast: number | null | undefined) {
  let x = 70;
  const y = 70;
  glow(ctx, 'rgba(0, 0, 0, 0.85)', 8); // dark halo instead of a box, as on the web glass
  x += text(ctx, 'OBJECTIVES ', x, y, 30, 600, palette.hudDim, 0.22);
  x += text(ctx, `${o.done} / ${o.total}`, x + 10, y, 36, 800, palette.hud) + 60;
  const clock = o.returnTime ?? o.timeLeft;
  if (clock) {
    x += text(ctx, o.returnTime ? 'RETURN ' : 'TIME ', x, y, 30, 600, palette.hudDim, 0.22);
    x += text(ctx, clock, x + 10, y, 36, 800, LEVEL[(o.returnTime ? o.returnLevel : o.timeLevel) ?? 'ok']) + 40;
  }
  if (fast) text(ctx, `▸▸ ${fast}×`, x, y, 32, 800, palette.ar);
  const items = o.items ?? (o.current ? [{ title: o.current, time: o.timeLeft ?? '', state: 'current' as const, level: o.timeLevel }] : []);
  items.slice(0, 5).forEach((it, i) => {
    const yy = y + 62 + i * 54, dim = it.state === 'done';
    text(ctx, it.state === 'done' ? '✓' : it.state === 'current' ? '▸' : '◦', 74, yy, 34, 800, it.state === 'current' ? palette.ar : palette.hudDim);
    const tw = text(ctx, it.title, 118, yy, 34, it.state === 'current' ? 700 : 500, dim ? palette.hudDim : palette.hud);
    text(ctx, it.time, 118 + tw + 26, yy, 34, 700, dim ? palette.hudDim : LEVEL[it.level ?? 'ok']); // right after the title, as on the web
  });
}

function drawBar(ctx: CanvasRenderingContext2D, bar: SuitBar, x: number, colour: string) {
  const top = 150, bottom = 560, w = 34, f = Math.min(1, Math.max(0, bar.fraction));
  const edge = bar.level === 'danger' ? palette.danger : bar.level === 'warning' ? palette.warning : palette.glassEdge;
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.glass;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, bottom - top, w / 2);
  ctx.fill();
  ctx.stroke();
  if (f > 0) {
    const y = bottom - (bottom - top) * f, g = ctx.createLinearGradient(0, bottom, 0, top);
    g.addColorStop(0, colour);
    g.addColorStop(1, `${colour}99`);
    glow(ctx, colour, 18);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 5, y, w - 10, bottom - y - 5, (w - 10) / 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(242, 247, 255, 0.35)';
  ctx.lineWidth = 2;
  for (let k = 1; k < 10; k++) {
    const y = bottom - ((bottom - top) * k) / 10, l = k === 5 ? 14 : 8;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - l, y);
    ctx.lineTo(x - w / 2, y);
    ctx.stroke();
  }
  glow(ctx, 'rgba(0, 0, 0, 0.85)', 8);
  text(ctx, bar.value, x, top - 22, 32, 700, LEVEL[bar.level ?? 'ok'], 0, 'center');
  text(ctx, bar.label, x, bottom + 46, 28, 700, colour, 0.12, 'center');
}

// Top, right of the objectives header and left of the bars, so it never covers either.
const ALERT_X = 960, ALERT_W = 820, ALERT_CX = ALERT_X + ALERT_W / 2;
function drawAlert(ctx: CanvasRenderingContext2D, a: HudAlert) {
  const c = ALERT[a.level], y = 26;
  panel(ctx, ALERT_X, y, ALERT_W, a.onAccept ? 190 : 140, c);
  glow(ctx, c, 12);
  text(ctx, `${a.level === 'info' ? '' : '⚠ '}${a.title}`, ALERT_CX, y + 56, 40, 800, c, 0.2, 'center');
  ctx.shadowBlur = 0;
  text(ctx, a.message, ALERT_CX, y + 108, 34, 500, palette.hud, 0, 'center');
  if (a.onAccept) text(ctx, '[A]  accept', ALERT_CX, y + 160, 30, 700, palette.warning, 0.1, 'center');
}

function drawCentreBox(ctx: CanvasRenderingContext2D, lines: HudLine[], y0: number) {
  const w = 1180, h = 40 + lines.length * 58, x = (W - w) / 2, y = Math.min(y0, H - h - 10);
  panel(ctx, x, y, w, h, palette.glassEdge);
  lines.forEach((l, i) => text(ctx, l.text, W / 2, y + 52 + i * 58, i === 0 && lines.length > 1 ? 36 : 32, i === 0 ? 800 : 600, LEVEL[l.level ?? 'ok'], i === 0 ? 0.08 : 0, 'center'));
}

function drawBand(ctx: CanvasRenderingContext2D, m: VRHudModel) {
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'middle';
  if (m.outdoors) {
    // the visor's edge: a faint line along the top and bottom of the band
    ctx.shadowBlur = 0;
    ctx.strokeStyle = palette.glassEdge;
    ctx.lineWidth = 2;
    for (const y of [6, H - 6]) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(W - 40, y);
      ctx.stroke();
    }
    drawObjectives(ctx, m.objectives, m.fastForward);
    drawBar(ctx, m.o2, W - 210, palette.o2);
    drawBar(ctx, m.temperature, W - 100, palette.temperature);
    if (m.status) {
      glow(ctx, 'rgba(0, 0, 0, 0.85)', 8);
      text(ctx, m.status.title, W - 155, 650, 28, 800, palette.warning, 0.1, 'center');
      text(ctx, m.status.message, W - 155, 690, 24, 500, palette.hud, 0, 'center');
    }
    if (m.alert) drawAlert(ctx, m.alert);
  }
  if (m.prompt && !m.tutorial) drawCentreBox(ctx, [{ text: m.prompt }], 420);
  if (m.tutorial?.length) drawCentreBox(ctx, m.tutorial, 300); // below up to five objective lines
}

// ---- the compass disc (the same drawing as src/ui/hudCompass.ts: what's ahead is at the far edge)

function drawCompass(ctx: CanvasRenderingContext2D, c: NonNullable<VRHudModel['compass']>) {
  const s = CW / 240, cx = 120 * s, cy = 64 * s, rx = 104 * s, ry = 40 * s;
  ctx.clearRect(0, 0, CW, CH);
  ctx.textBaseline = 'middle';
  const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  disc.addColorStop(0, 'rgba(111, 227, 255, 0.22)');
  disc.addColorStop(0.7, 'rgba(111, 227, 255, 0.08)');
  disc.addColorStop(1, 'rgba(111, 227, 255, 0)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, palette.ar, 10);
  ctx.strokeStyle = palette.ar;
  ctx.lineWidth = 3;
  for (const k of [1, 0.62]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const at = (bearing: number, k = 1) => {
    const a = bearing - c.heading;
    return { x: cx + rx * k * Math.sin(a), y: cy - ry * k * Math.cos(a), ahead: Math.cos(a) };
  };
  for (const [label, b] of [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]] as const) {
    const p = at(b);
    ctx.globalAlpha = 0.45 + 0.55 * Math.max(0, p.ahead);
    text(ctx, label, p.x, p.y, 30, 800, label === 'N' ? palette.warning : palette.ar, 0, 'center');
  }
  ctx.globalAlpha = 1;
  for (const t of c.targets) {
    const p = at(t.bearing, 0.82), r = 13;
    ctx.fillStyle = t.kind === 'objective' ? palette.objective : palette.home;
    glow(ctx, ctx.fillStyle, 12);
    ctx.beginPath();
    if (t.kind === 'objective') {
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x + r, p.y);
      ctx.lineTo(p.x, p.y + r);
      ctx.lineTo(p.x - r, p.y);
    } else ctx.rect(p.x - r * 0.75, p.y - r * 0.75, r * 1.5, r * 1.5);
    ctx.fill();
    if (t.label) text(ctx, t.label, p.x, p.y + 32, 24, 700, palette.hud, 0, 'center');
  }
  // your heading: the notch at the far edge
  ctx.fillStyle = palette.hud;
  glow(ctx, palette.ar, 8);
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry - 4);
  ctx.lineTo(cx - 12, cy - ry - 26);
  ctx.lineTo(cx + 12, cy - ry - 26);
  ctx.fill();
  ctx.shadowBlur = 0;
}

export function createVRHud(): VRHud {
  const group = new THREE.Group();
  const band = canvas2d(W, H), comp = canvas2d(CW, CH);
  const bandLayer = layer(band.c, bentPlane(BAND_W, BAND_H, RADIUS), 999);
  // The compass sits low on the left of the band (as on the web glass), a hair nearer so it draws over the band.
  const cWidth = (BAND_W * CW) / W, cHeight = (BAND_H * CH) / H, cAngle = ((W / 2 - 330) / W) * SPAN;
  const compassGeo = bentPlane(cWidth, cHeight, RADIUS - 0.01).rotateY(cAngle).translate(0, -BAND_H / 2 + cHeight / 2 + 0.01, 0);
  const compassLayer = layer(comp.c, compassGeo, 1000);
  group.add(bandLayer.mesh, compassLayer.mesh);
  let key = '', drawn = 0, compassKey = '';
  return {
    group,
    update(m) {
      const { compass, ...rest } = m;
      const k = JSON.stringify(rest, (name, v) => (name === 'onAccept' ? !!v : v));
      const now = performance.now();
      if (k !== key && now - drawn > 100) {
        key = k;
        drawn = now;
        drawBand(band.ctx, m);
        bandLayer.texture.needsUpdate = true;
      }
      const showCompass = !!(m.outdoors && compass && !m.tutorial?.length); // the tutorial box covers it
      compassLayer.mesh.visible = showCompass;
      if (showCompass && compass) {
        // Only when the heading (to half a degree) or a target changed: saves texture uploads on a standalone headset.
        const half = Math.PI / 360, ck = [compass.heading, ...compass.targets.map((t) => t.bearing)].map((a) => Math.round(a / half)).join() + compass.targets.map((t) => t.label).join();
        if (ck !== compassKey) {
          compassKey = ck;
          drawCompass(comp.ctx, compass);
          compassLayer.texture.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const l of [bandLayer, compassLayer]) {
        l.mesh.geometry.dispose();
        (l.mesh.material as THREE.Material).dispose();
        l.texture.dispose();
      }
      group.removeFromParent();
    },
  };
}
