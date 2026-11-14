// Written with AI assistance (Claude).
// Owner: Rachel. The Setup screen (TEAM-PLAN section 1a, the "SETUP" whiteboard), shown on the operations console
// inside the base before each EVA.
// - Left third: MISSIONS to pick, each with its time, distance from base and O2; then LEVELS: O2 the plan needs
//   (walking out and back plus the work) against the suit tank, the reserve, the base O2 store, what came back from
//   the last EVA, and time against the EVA limit. BEGIN EVA when the plan fits.
// - Right two thirds: a top-down map of the real terrain (same colours and blue contours as the 3D world) with the
//   route, the objectives and the base. Hovering a mission highlights it on the map.
// Sized in container units, so it scales with the console screen it sits on.

import { useEffect, useMemo, useRef, useState } from 'react';
import { sampleBilinear, type Grid } from '../shared/grids';
import type { XZ } from '../shared/coords';
import { terrainPresets } from './palette';
import './SetupConsole.css';

export interface SetupMission {
  title: string;
  minutes: number; // time budget for the objective itself
  distance: number; // metres from the airlock along the route
  litres: number; // O2 for the objective itself
  at: XZ;
  done: boolean;
}

export interface SetupLevels {
  walkLitres: number; // out to the furthest objective and back
  taskLitres: number;
  reserve: number;
  tank: number; // suit tank, usable litres
  baseStore: number; // base O2 store, litres
  baseCapacity: number;
  lastEva: { returned: number; isru: number }; // litres back in the suit last time, litres made by ISRU since
  minutes: number; // planned EVA time
  evaMinutes: number; // EVA time limit
  metres: number; // walking distance, out and back
}

export interface SetupConsoleProps {
  missions: SetupMission[];
  chosen: boolean[];
  onToggle(i: number): void;
  levels: SetupLevels | null; // null until the terrain is loaded
  heights: Grid<Float32Array> | null;
  route: XZ[]; // the whole route, starting at the airlock
  routeTo: number; // index of the last route point this plan walks to (-1: none)
  base: XZ;
  /** The plan fits (O2, time, at least one mission): you can walk out through the airlock. */
  ready: boolean;
  /** Stand up from the console (SAVE PLAN, the close button, or Esc). */
  onClose(): void;
}

const MAP_W = 900, MAP_H = 600; // map drawing size (it is scaled to fit, cropping the edges like "cover")

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The map region: everything on the plan, padded, at the map's aspect. */
function mapRegion(points: XZ[]) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z);
    z1 = Math.max(z1, p.z);
  }
  // Pad, and show at least 480 m across so there is terrain around the plan to read.
  const pad = 60;
  x0 -= pad;
  x1 += pad;
  z0 -= pad;
  z1 += pad;
  const grow = (lo: number, hi: number, min: number) => (hi - lo >= min ? [lo, hi] : [(lo + hi) / 2 - min / 2, (lo + hi) / 2 + min / 2]);
  [x0, x1] = grow(x0, x1, 480);
  [z0, z1] = grow(z0, z1, 320);
  const want = MAP_W / MAP_H;
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

/** Top-down terrain: The Martian colours by height (6 m cycle), hill shading, blue contours every 2 m and 10 m. */
function drawTerrain(canvas: HTMLCanvasElement, grid: Grid<Float32Array>, r: ReturnType<typeof mapRegion>) {
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d')!;
  const hs = new Float32Array(MAP_W * MAP_H);
  const mpp = (r.x1 - r.x0) / MAP_W; // metres per pixel
  for (let py = 0; py < MAP_H; py++) {
    const z = r.z0 + (py + 0.5) * mpp;
    for (let px = 0; px < MAP_W; px++) hs[py * MAP_W + px] = sampleBilinear(grid, r.x0 + (px + 0.5) * mpp, z);
  }
  const preset = terrainPresets.martian;
  const ramp = preset.ramp.map(hexRgb);
  const n = ramp.length;
  const line = hexRgb('#6fe3ff');
  const img = ctx.createImageData(MAP_W, MAP_H);
  // Light from the north-west, the map-making convention, so hills read the right way round.
  const lx = -0.5, ly = 0.7, lz = -0.5, ll = Math.hypot(lx, ly, lz);
  for (let py = 0; py < MAP_H; py++) {
    for (let px = 0; px < MAP_W; px++) {
      const i = py * MAP_W + px;
      const h = hs[i];
      const hr = hs[py * MAP_W + Math.min(MAP_W - 1, px + 1)], hl = hs[py * MAP_W + Math.max(0, px - 1)];
      const hd = hs[Math.min(MAP_H - 1, py + 1) * MAP_W + px], hu = hs[Math.max(0, py - 1) * MAP_W + px];
      // normal from the slope (exaggerated a little so gentle relief still shows)
      const nx = -(hr - hl) / (2 * mpp) * 4, nz = -(hd - hu) / (2 * mpp) * 4, nl = Math.hypot(nx, 1, nz);
      const lambert = Math.max(0, (nx * lx + ly + nz * lz) / (nl * ll));
      const shade = 0.45 + 0.75 * lambert;
      const t = (((h / preset.cycle) % 1) + 1) % 1 * n;
      const k = Math.floor(t), f = t - k;
      const a = ramp[k % n], b = ramp[(k + 1) % n];
      let rr = (a[0] + (b[0] - a[0]) * f) * shade, gg = (a[1] + (b[1] - a[1]) * f) * shade, bb = (a[2] + (b[2] - a[2]) * f) * shade;
      // contours where the 2 m (or 10 m) band changes between this pixel and the next
      const minor = Math.floor(h / 2) !== Math.floor(hr / 2) || Math.floor(h / 2) !== Math.floor(hd / 2);
      const major = Math.floor(h / 10) !== Math.floor(hr / 10) || Math.floor(h / 10) !== Math.floor(hd / 10);
      const c = major ? 0.85 : minor ? 0.35 : 0;
      rr += (line[0] - rr) * c;
      gg += (line[1] - gg) * c;
      bb += (line[2] - bb) * c;
      img.data[i * 4] = rr;
      img.data[i * 4 + 1] = gg;
      img.data[i * 4 + 2] = bb;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const fmtL = (l: number) => `${Math.round(l)} L`;

function LevelBar({ label, value, parts, total, note, tone }: {
  label: string;
  value: string;
  parts: { v: number; cls: string }[];
  total: number;
  note?: string;
  tone?: 'ok' | 'warning' | 'danger';
}) {
  return (
    <div className={`setup-level setup-level--${tone ?? 'ok'}`}>
      <div className="setup-level-head">
        <span className="setup-level-label">{label}</span>
        <span className="setup-level-value">{value}</span>
      </div>
      <div className="setup-level-track">
        {parts.map((p, i) => (
          <div key={i} className={`setup-level-fill ${p.cls}`} style={{ width: `${Math.min(100, Math.max(0, (p.v / total) * 100))}%` }} />
        ))}
      </div>
      {note && <div className="setup-level-note">{note}</div>}
    </div>
  );
}

export function SetupConsole({ missions, chosen, onToggle, levels, heights, route, routeTo, base, ready, onClose }: SetupConsoleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState(-1);
  const region = useMemo(() => mapRegion([base, ...route, ...missions.map((m) => m.at)]), [base, route, missions]);

  useEffect(() => {
    if (heights && canvasRef.current) drawTerrain(canvasRef.current, heights, region);
  }, [heights, region]);

  const toMap = (p: XZ) => ({ x: ((p.x - region.x0) / (region.x1 - region.x0)) * MAP_W, y: ((p.z - region.z0) / (region.z1 - region.z0)) * MAP_H });
  const pathD = (pts: XZ[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${toMap(p).x.toFixed(1)} ${toMap(p).y.toFixed(1)}`).join('');
  const scaleM = 50, scalePx = (scaleM / (region.x1 - region.x0)) * MAP_W;

  const any = chosen.some((c, i) => c && !missions[i]?.done);
  const needed = levels ? levels.walkLitres + levels.taskLitres : 0;
  const fitsO2 = levels ? needed + levels.reserve <= levels.tank : false;
  const fitsTime = levels ? levels.minutes <= levels.evaMinutes : false;
  const why = !levels ? 'Loading terrain…' : !any ? 'Pick at least one mission' : !fitsO2 ? 'Not enough O₂ for this plan' : !fitsTime ? 'Plan is longer than the EVA limit' : '';

  return (
    <div className="setup">
      <header className="setup-head">
        <span className="setup-title">SETUP</span>
        <span className="setup-sub">EVA planning · Jezero base · console 1</span>
        <button type="button" className="setup-close" onClick={onClose} aria-label="Stand up from the console">
          ESC ✕
        </button>
      </header>
      <div className="setup-body">
        <section className="setup-side">
          <h2 className="setup-h">MISSIONS</h2>
          <ul className="setup-missions">
            {missions.map((m, i) => (
              <li
                key={i}
                className={`setup-mission${chosen[i] ? ' is-chosen' : ''}${m.done ? ' is-done' : ''}${hover === i ? ' is-hover' : ''}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
              >
                <button type="button" className="setup-mission-btn" disabled={m.done} onClick={() => onToggle(i)} aria-pressed={chosen[i]}>
                  <span className="setup-check" aria-hidden="true">{m.done ? '✓' : chosen[i] ? '●' : '○'}</span>
                  <span className="setup-mission-num">{i + 1}</span>
                  <span className="setup-mission-title">{m.title}</span>
                  <span className="setup-mission-arrow" aria-hidden="true">→</span>
                  <span className="setup-mission-meta">
                    {m.done ? 'done' : `${m.minutes} min · ${Math.round(m.distance)} m · ${fmtL(m.litres)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <h2 className="setup-h">LEVELS</h2>
          {levels ? (
            <div className="setup-levels">
              <LevelBar
                label="O₂ PLAN"
                value={`${fmtL(needed + levels.reserve)} / ${fmtL(levels.tank)}`}
                parts={[
                  { v: needed, cls: 'is-need' },
                  { v: levels.reserve, cls: 'is-reserve' },
                ]}
                total={levels.tank}
                note={`walk ${fmtL(levels.walkLitres)} · work ${fmtL(levels.taskLitres)} · reserve ${fmtL(levels.reserve)}`}
                tone={fitsO2 ? 'ok' : 'danger'}
              />
              <LevelBar
                label="TIME"
                value={`${Math.round(levels.minutes)} / ${levels.evaMinutes} min`}
                parts={[{ v: levels.minutes, cls: 'is-time' }]}
                total={levels.evaMinutes}
                note={`${(levels.metres / 1000).toFixed(2)} km out and back`}
                tone={fitsTime ? (levels.minutes > levels.evaMinutes * 0.85 ? 'warning' : 'ok') : 'danger'}
              />
              <LevelBar
                label="BASE O₂ STORE"
                value={fmtL(levels.baseStore)}
                parts={[{ v: levels.baseStore, cls: 'is-store' }]}
                total={levels.baseCapacity}
              />
              <LevelBar
                label="RECOVERED · LAST EVA"
                value={`+${fmtL(levels.lastEva.returned + levels.lastEva.isru)}`}
                parts={[
                  { v: levels.lastEva.returned, cls: 'is-returned' },
                  { v: levels.lastEva.isru, cls: 'is-isru' },
                ]}
                total={levels.tank}
                note={`suit returned ${fmtL(levels.lastEva.returned)} · ISRU made ${fmtL(levels.lastEva.isru)}`}
              />
            </div>
          ) : (
            <p className="setup-wait">Loading terrain…</p>
          )}

          <button type="button" className="setup-begin" onClick={onClose}>
            SAVE PLAN <span aria-hidden="true">▸</span>
          </button>
          <p className={`setup-why${ready ? ' is-ready' : ''}`}>{ready ? 'Plan ready · suit up at the airlock and walk out' : why}</p>
        </section>

        <section className="setup-map" aria-label="Map of the route and objectives">
          <canvas ref={canvasRef} className="setup-map-canvas" />
          <svg className="setup-map-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
            <defs>
              <filter id="setup-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d={pathD(route)} className="setup-route-all" />
            {routeTo > 0 && <path d={pathD(route.slice(0, routeTo + 1))} className="setup-route-plan" filter="url(#setup-glow)" />}
            {missions.map((m, i) => {
              const p = toMap(m.at);
              const cls = m.done ? 'is-done' : chosen[i] ? 'is-chosen' : '';
              return (
                <g
                  key={i}
                  className={`setup-marker ${cls}${hover === i ? ' is-hover' : ''}`}
                  transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(-1)}
                  onClick={() => !m.done && onToggle(i)}
                >
                  {hover === i && <circle r="26" className="setup-marker-halo" />}
                  <circle r="13" className="setup-marker-dot" />
                  <text className="setup-marker-num" dy="0.35em">{m.done ? '✓' : i + 1}</text>
                  {hover === i && (
                    <text className="setup-marker-label" x="20" dy="0.35em">
                      {m.title}
                    </text>
                  )}
                </g>
              );
            })}
            <g className="setup-base" transform={`translate(${toMap(base).x.toFixed(1)} ${toMap(base).y.toFixed(1)})`}>
              <rect x="-12" y="-12" width="24" height="24" rx="4" />
              <text x="18" dy="0.35em">BASE</text>
            </g>
            <g className="setup-scale" transform={`translate(28 ${MAP_H - 30})`}>
              <path d={`M0 0 H${scalePx.toFixed(1)} M0 -6 V6 M${scalePx.toFixed(1)} -6 V6`} />
              <text x={scalePx / 2} y="-10">
                {scaleM} m
              </text>
            </g>
            <g className="setup-north" transform={`translate(${MAP_W - 40} 44)`}>
              <path d="M0 -18 L8 6 L0 0 L-8 6 Z" />
              <text y="24">N</text>
            </g>
          </svg>
          {!heights && <div className="setup-map-wait">Loading terrain…</div>}
          <div className="setup-map-legend">Contours 2 m · 10 m · real Jezero terrain</div>
        </section>
      </div>
    </div>
  );
}
