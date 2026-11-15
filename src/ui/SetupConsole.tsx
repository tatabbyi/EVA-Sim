// Written with AI assistance (Claude).
// Owner: Rachel. The EVA plan screen on the base console (TEAM-PLAN section 1a, the "SETUP" whiteboard).
// Plain and simple, in the Mars palette (sand, tan, terracotta, clay red) with the visor's blue:
// - left: the mission (one long traverse) and its subtasks to tick, then what the plan needs in plain words;
// - right: a map of the real terrain (NASA/USGS HiRISE height model around Perseverance's landing site, north up),
//   coloured low to high with soft shading and contour lines, the route, the numbered subtasks and the base.
// Sized in container units, so it scales with the console screen it sits on.

import { useEffect, useMemo, useRef, useState } from 'react';
import { sampleBilinear, type Grid } from '../shared/grids';
import type { XZ } from '../shared/coords';
import { MAP_BARE, SLOPE_CLASSES, slopeWash } from './palette';
import './SetupConsole.css';

export interface SetupMission {
  title: string;
  minutes: number; // time budget for the subtask itself
  distance: number; // metres from the airlock along the route
  litres: number; // oxygen for the subtask itself
  at: XZ;
  done: boolean;
}

export interface SetupLevels {
  walkLitres: number; // out to the furthest subtask and back
  taskLitres: number;
  reserve: number;
  tank: number; // suit tank, usable litres
  baseStore: number; // base oxygen store, litres
  baseCapacity: number;
  lastEva: { returned: number; isru: number }; // litres back in the suit last time, litres made by the oxygen plant since
  minutes: number; // planned EVA time
  evaMinutes: number; // EVA time limit
  metres: number; // walking distance, out and back
  /** Survival Odds for the plan (src/sim/survival.ts): fractions of 1,000 simulated EVAs. null while planning. */
  odds?: { success: number; home: number; onTime: number; complete: number; compared: number; mainCause: string | null } | null;
}

export interface SetupConsoleProps {
  missions: SetupMission[]; // the subtasks of the mission
  chosen: boolean[];
  onToggle(i: number): void;
  levels: SetupLevels | null; // null until the terrain is loaded
  heights: Grid<Float32Array> | null;
  route: XZ[]; // the whole route, starting at the airlock
  routeTo: number; // index of the last route point this plan walks to (-1: none)
  base: XZ;
  /** The plan fits (oxygen, time, at least one subtask): you can walk out through the airlock. */
  ready: boolean;
  /** Stand up from the console (Save plan, Close, or Esc). */
  onClose(): void;
}

const MAP_W = 1200, MAP_H = 1000; // map drawing size (about the shape of the map area); scaled to fit like "cover"

/** A slope colour as it shows on the map: laid over the paper at this strength (CSS colour). */
function washed(hex: string, alpha: number): string {
  const c = hexRgb(hex), p = hexRgb(MAP_BARE);
  return `rgb(${c.map((v, k) => Math.round(p[k] + (v - p[k]) * alpha)).join(',')})`;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The map region: everything on the plan, padded, at least 480 m across, at the map's aspect. */
function mapRegion(points: XZ[]) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z);
    z1 = Math.max(z1, p.z);
  }
  const pad = 70;
  x0 -= pad;
  x1 += pad;
  z0 -= pad;
  z1 += pad;
  const want = MAP_W / MAP_H;
  if (x1 - x0 < 480) [x0, x1] = [(x0 + x1) / 2 - 240, (x0 + x1) / 2 + 240];
  const w = x1 - x0, h = z1 - z0;
  if (w / h > want) {
    const nh = w / want;
    z0 -= (nh - h) / 2;
    z1 = z0 + nh;
  } else {
    const nw = h * want;
    x0 -= (nw - w) / 2;
    x1 = x0 + nw;
  }
  return { x0, x1, z0, z1 };
}

/** A clean topographic map: colour = walkability by slope (SLOPE_CLASSES, the same as on the ground outside),
 *  soft shading from the north-west, smooth contour lines for height.
 *  Returns the contour spacing in metres. */
function drawMap(canvas: HTMLCanvasElement, grid: Grid<Float32Array>, r: ReturnType<typeof mapRegion>) {
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  const mpp = (r.x1 - r.x0) / MAP_W; // metres per pixel
  const raw = new Float32Array(MAP_W * MAP_H);
  for (let py = 0; py < MAP_H; py++) {
    const z = r.z0 + (py + 0.5) * mpp;
    for (let px = 0; px < MAP_W; px++) raw[py * MAP_W + px] = sampleBilinear(grid, r.x0 + (px + 0.5) * mpp, z);
  }
  // Light smoothing (a box blur each way) so the 4 m height grid doesn't show as blocks.
  const hs = new Float32Array(raw.length), tmp = new Float32Array(raw.length);
  const R = 3, n = 2 * R + 1;
  for (let py = 0; py < MAP_H; py++) {
    let acc = 0;
    for (let k = -R; k <= R; k++) acc += raw[py * MAP_W + Math.min(MAP_W - 1, Math.max(0, k))];
    for (let px = 0; px < MAP_W; px++) {
      tmp[py * MAP_W + px] = acc / n;
      acc += raw[py * MAP_W + Math.min(MAP_W - 1, px + R + 1)] - raw[py * MAP_W + Math.max(0, px - R)];
    }
  }
  for (let px = 0; px < MAP_W; px++) {
    let acc = 0;
    for (let k = -R; k <= R; k++) acc += tmp[Math.min(MAP_H - 1, Math.max(0, k)) * MAP_W + px];
    for (let py = 0; py < MAP_H; py++) {
      hs[py * MAP_W + px] = acc / n;
      acc += tmp[Math.min(MAP_H - 1, py + R + 1) * MAP_W + px] - tmp[Math.max(0, py - R) * MAP_W + px];
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (const h of hs) {
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  // The slope colours are laid over the paper as a soft wash (slopeWash): none on flat ground, stronger up the hills
  // (the same look as on the ground outside).
  const paper = hexRgb(MAP_BARE);
  const classes = SLOPE_CLASSES.map((c) => hexRgb(c.colour));
  const ease = (e0: number, e1: number, x: number) => Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  const D = 5; // slope measured over about 4 m, like the height data
  const img = ctx.createImageData(MAP_W, MAP_H);
  const lx = -0.55, ly = 0.65, lz = -0.52, ll = Math.hypot(lx, ly, lz); // light from the north-west
  for (let py = 0; py < MAP_H; py++) {
    for (let px = 0; px < MAP_W; px++) {
      const i = py * MAP_W + px;
      const hr = hs[py * MAP_W + Math.min(MAP_W - 1, px + 1)], hl = hs[py * MAP_W + Math.max(0, px - 1)];
      const hd = hs[Math.min(MAP_H - 1, py + 1) * MAP_W + px], hu = hs[Math.max(0, py - 1) * MAP_W + px];
      const nx = (-(hr - hl) / (2 * mpp)) * 3, nz = (-(hd - hu) / (2 * mpp)) * 3, nl = Math.hypot(nx, 1, nz);
      const lambert = Math.max(0, (nx * lx + ly + nz * lz) / (nl * ll));
      const shade = 0.62 + 0.5 * lambert;
      const sx = (hs[py * MAP_W + Math.min(MAP_W - 1, px + D)] - hs[py * MAP_W + Math.max(0, px - D)]) / (2 * D * mpp);
      const sz = (hs[Math.min(MAP_H - 1, py + D) * MAP_W + px] - hs[Math.max(0, py - D) * MAP_W + px]) / (2 * D * mpp);
      const deg = (Math.atan(Math.hypot(sx, sz)) * 180) / Math.PI;
      let t = 0;
      for (let c = 0; c < classes.length - 1; c++) t += ease(SLOPE_CLASSES[c].upTo - 0.75, SLOPE_CLASSES[c].upTo + 0.75, deg);
      const k = Math.min(classes.length - 2, Math.floor(t)), f = t - k;
      const a = classes[k], b = classes[k + 1];
      // a soft wash over the paper, as on the ground outside: light on flat ground, stronger up the hills
      const alpha = slopeWash(t);
      for (let ch = 0; ch < 3; ch++) {
        const tint = a[ch] + (b[ch] - a[ch]) * f;
        img.data[i * 4 + ch] = Math.min(255, (paper[ch] + (tint - paper[ch]) * alpha) * shade);
      }
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Contour lines by marching squares on a 3 px lattice: smooth and anti-aliased, a heavier line every fifth.
  const span = hi - lo;
  const interval = [1, 2, 5, 10, 20].find((v) => span / v <= 16) ?? 20;
  const step = 3;
  const segs: [number, number, number, number][][] = [[], []]; // minor, major
  const at = (px: number, py: number) => hs[Math.min(MAP_H - 1, py) * MAP_W + Math.min(MAP_W - 1, px)];
  for (let py = 0; py < MAP_H - step; py += step) {
    for (let px = 0; px < MAP_W - step; px += step) {
      const c = [at(px, py), at(px + step, py), at(px + step, py + step), at(px, py + step)];
      const corners: [number, number][] = [[px, py], [px + step, py], [px + step, py + step], [px, py + step]];
      const cmin = Math.min(...c), cmax = Math.max(...c);
      for (let level = Math.ceil(cmin / interval) * interval; level <= cmax; level += interval) {
        const pts: [number, number][] = [];
        for (let e = 0; e < 4; e++) {
          const h0 = c[e], h1 = c[(e + 1) % 4];
          if ((h0 < level) !== (h1 < level)) {
            const u = (level - h0) / (h1 - h0);
            const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4];
            pts.push([ax + (bx - ax) * u, ay + (by - ay) * u]);
          }
        }
        const major = Math.round(level / interval) % 5 === 0 ? 1 : 0;
        for (let q = 0; q + 1 < pts.length; q += 2) segs[major].push([pts[q][0], pts[q][1], pts[q + 1][0], pts[q + 1][1]]);
      }
    }
  }
  ctx.lineCap = 'round';
  const strokeAll = (list: [number, number, number, number][], style: string, width: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of list) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
  };
  strokeAll(segs[0], 'rgba(70, 40, 28, 0.28)', 1);
  strokeAll(segs[1], 'rgba(70, 40, 28, 0.55)', 1.6);
  return interval;
}

const litres = (l: number) => `${Math.round(l)} litres`;

function Meter({ value, total, tone }: { value: number; total: number; tone: 'ok' | 'warning' | 'danger' }) {
  return (
    <div className={`plan-meter plan-meter--${tone}`}>
      <div className="plan-meter-fill" style={{ width: `${Math.min(100, Math.max(0, (value / total) * 100))}%` }} />
    </div>
  );
}

export function SetupConsole({ missions, chosen, onToggle, levels, heights, route, routeTo, base, ready, onClose }: SetupConsoleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState(-1);
  const region = useMemo(() => mapRegion([base, ...route, ...missions.map((m) => m.at)]), [base, route, missions]);

  useEffect(() => {
    if (heights && canvasRef.current) drawMap(canvasRef.current, heights, region);
  }, [heights, region]);

  const toMap = (p: XZ) => ({ x: ((p.x - region.x0) / (region.x1 - region.x0)) * MAP_W, y: ((p.z - region.z0) / (region.z1 - region.z0)) * MAP_H });
  const pathD = (pts: XZ[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${toMap(p).x.toFixed(1)} ${toMap(p).y.toFixed(1)}`).join('');
  const scaleM = 100, scalePx = (scaleM / (region.x1 - region.x0)) * MAP_W;

  const any = chosen.some((c, i) => c && !missions[i]?.done);
  const needed = levels ? levels.walkLitres + levels.taskLitres + levels.reserve : 0;
  const fitsO2 = levels ? needed <= levels.tank : false;
  const fitsTime = levels ? levels.minutes <= levels.evaMinutes : false;
  const why = !levels ? 'Loading the map…' : !any ? 'Tick at least one subtask' : !fitsO2 ? 'Not enough oxygen for this plan' : !fitsTime ? 'This plan takes longer than the time allowed' : '';

  return (
    <div className="plan">
      <section className="plan-side">
        <button type="button" className="plan-back" onClick={onClose} aria-label="Back (Esc)">
          ←
        </button>
        <div className="plan-card">
          <h2 className="plan-mission-name">Ridge field traverse</h2>
          <ul className="plan-tasks">
            {missions.map((m, i) => (
              <li key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
                <label className={`plan-task${m.done ? ' is-done' : ''}${hover === i ? ' is-hover' : ''}`}>
                  <input type="checkbox" checked={chosen[i]} disabled={m.done} onChange={() => onToggle(i)} />
                  <span className="plan-task-num">{i + 1}</span>
                  <span className="plan-task-name">{m.title}</span>
                  <span className="plan-task-meta">{m.done ? 'Done' : `${m.minutes} min`}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="plan-card">
          {levels ? (
            <dl className="plan-needs">
              <div>
                <dt>Oxygen</dt>
                <dd>
                  {Math.round(needed)} of {litres(levels.tank)}
                </dd>
                <Meter value={needed} total={levels.tank} tone={fitsO2 ? 'ok' : 'danger'} />
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {Math.round(levels.minutes)} of {levels.evaMinutes} minutes
                </dd>
                <Meter value={levels.minutes} total={levels.evaMinutes} tone={fitsTime ? (levels.minutes > levels.evaMinutes * 0.85 ? 'warning' : 'ok') : 'danger'} />
              </div>
              {levels.odds && (
                <div>
                  <dt>Survival odds</dt>
                  <dd>
                    {Math.floor(levels.odds.success * 100)}%{' '}
                    <span className="plan-sub">
                      of 1,000 simulated EVAs got home on time with O₂ to spare · safest of {levels.odds.compared} visiting orders
                      {levels.odds.mainCause ? ` · main risk: ${levels.odds.mainCause}` : ''}
                    </span>
                  </dd>
                  <Meter value={levels.odds.success} total={1} tone={levels.odds.success >= 0.95 ? 'ok' : levels.odds.success >= 0.8 ? 'warning' : 'danger'} />
                </div>
              )}
              <div>
                <dt>Base oxygen</dt>
                <dd>
                  {litres(levels.baseStore)} · {Math.round(levels.lastEva.returned + levels.lastEva.isru)} recovered
                </dd>
              </div>
            </dl>
          ) : (
            <p className="plan-status">Loading…</p>
          )}
          <button type="button" className="plan-save" onClick={onClose}>
            Save plan →
          </button>
          {!ready && why && <p className="plan-status">{why}</p>}
        </div>
      </section>

        <section className="plan-map" aria-label="Map of the route and subtasks">
          <canvas ref={canvasRef} className="plan-map-canvas" />
          <svg className="plan-map-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
            <path d={pathD(route)} className="plan-route-all" />
            {routeTo > 0 && (
              <>
                <path d={pathD(route.slice(0, routeTo + 1))} className="plan-route-casing" />
                <path d={pathD(route.slice(0, routeTo + 1))} className="plan-route" />
              </>
            )}
            {missions.map((m, i) => {
              const p = toMap(m.at);
              const cls = m.done ? 'is-done' : chosen[i] ? 'is-chosen' : '';
              return (
                <g
                  key={i}
                  className={`plan-marker ${cls}${hover === i ? ' is-hover' : ''}`}
                  transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(-1)}
                  onClick={() => !m.done && onToggle(i)}
                >
                  <circle r={hover === i ? 21 : 17} />
                  <text dy="0.36em">{m.done ? '✓' : i + 1}</text>
                  {hover === i && (
                    <text className="plan-marker-label" x="28" dy="0.36em">
                      {m.title}
                    </text>
                  )}
                </g>
              );
            })}
            <g className="plan-base" transform={`translate(${toMap(base).x.toFixed(1)} ${toMap(base).y.toFixed(1)})`}>
              <rect x="-14" y="-14" width="28" height="28" rx="5" />
              <text x="22" dy="0.36em">Base</text>
            </g>
            <g className="plan-scale" transform={`translate(70 ${MAP_H - 50})`}>
              <path d={`M0 0 H${scalePx.toFixed(1)} M0 -7 V7 M${scalePx.toFixed(1)} -7 V7`} />
              <text x={scalePx / 2} y="-12">
                {scaleM} m
              </text>
            </g>
            <g className="plan-north" transform={`translate(${MAP_W - 70} 70)`}>
              <path d="M0 -22 L10 8 L0 1 L-10 8 Z" />
              <text y="30">N</text>
            </g>
          </svg>
          {!heights && <div className="plan-map-wait">Loading the map…</div>}
          <div className="plan-map-key" aria-label="Ground colours by slope">
            {SLOPE_CLASSES.map((c, i) => (
              <span key={c.label}>
                <i style={{ background: washed(c.colour, slopeWash(i)) }} />
                {c.label}
              </span>
            ))}
          </div>
        </section>
    </div>
  );
}
