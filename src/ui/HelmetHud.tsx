// Written with AI assistance (Claude).
// Owner: Rachel. Helmet HUD (TEAM-PLAN.md section 1a), drawn on the curved visor glass and following its edges:
// - top-left: objectives as text bending along the top edge of the visor (no box): each with its own timer, and
//   the total time left to get back to base
// - top, under the rim, out of the line of sight, only during a danger: "⚠ CYCLONE / Switch waypoint to home? [E]"
// - right: two long translucent bars, O2 (blue) and temperature (red), running parallel to the right edge
// Everything is one SVG in screen pixels built from the visor shape, so text bends with the glass without stretching.
// The whole helmet sways with your head: pass swayTargetRef and drive it with createHeadSway() (headSway.ts).

import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import './HelmetHud.css';

export type Level = 'ok' | 'warning' | 'danger';

export interface SuitBar {
  label: string; // "O₂"
  value: string; // "280 L"
  fraction: number; // bar fill, 0 to 1
  level?: Level;
}

export interface HudAlert {
  level: 'danger' | 'warning' | 'info';
  title: string; // "CYCLONE"
  message: string; // "Switch waypoint to home?"
  acceptKey?: string; // keyboard key that accepts, default "E"
  onAccept?: () => void;
}

export interface HudObjective {
  title: string;
  time: string; // countdown for the current one, budget for ones to come, time taken for done ones
  state: 'done' | 'current' | 'todo';
  level?: Level; // colours the time (warning, danger)
}

export interface HudObjectives {
  done: number;
  total: number;
  /** One line each, with its own timer. */
  items?: HudObjective[];
  /** Total time left to get back to base, e.g. "42:10"; returnLevel colours it. */
  returnTime?: string | null;
  returnLevel?: Level;
  /** Older single-line form (still used by the RAW app's adapter, docs/integration/RACHEL-VISUALS.md):
   *  the current objective and an optional time. Used when items is not given. */
  current?: string | null;
  timeLeft?: string | null;
  timeLevel?: Level;
}

export interface HelmetHudProps {
  objectives: HudObjectives;
  alert?: HudAlert | null;
  o2: SuitBar;
  temperature: SuitBar;
  /** Receives the AR objective marker; the caller positions it over the target each frame (see Preview). */
  targetRef?: MutableRefObject<HTMLDivElement | null>;
  /** Receives the glass-reflection element; slide it sideways as the head turns (see Preview). */
  sheenRef?: MutableRefObject<HTMLDivElement | null>;
  /** Receives the helmet element so createHeadSway() can move it (head moving inside the helmet). */
  swayTargetRef?: MutableRefObject<HTMLDivElement | null>;
  /** Receives the slot for the 3D chin hardware (createHelmetInterior): above the seal and fabric, under the HUD text. */
  interiorRef?: MutableRefObject<HTMLDivElement | null>;
  /** Receives the breath-fog element; animate it on each exhale (see Preview). */
  breathRef?: MutableRefObject<HTMLDivElement | null>;
  /** Receives the visor-fog layer; set its --fog CSS variable from 0 (clear) to 1 (fogged), and display (see Preview). */
  fogRef?: MutableRefObject<HTMLDivElement | null>;
}

// ---------- Visor geometry ----------
// The view out of an EVA helmet, after NASA's EMU and the Apollo visor assembly it grew from: a clear polycarbonate
// bubble with a hard visor shell over it (shell, protective visor, gold sun visor, pivot hubs at the sides, side
// eyeshades). From inside, the shell frames the view: a broad brow arch over the top, near-straight sides at the
// temples, the round visor pivot hubs a little below eye level, then the opening tapers diagonally into a U at the
// chin, above the neck ring. Text and bars follow its edges (topArc, rightEdge).

interface Pt { x: number; y: number }
const pt = (x: number, y: number): Pt => ({ x, y });
const add = (a: Pt, b: Pt): Pt => pt(a.x + b.x, a.y + b.y);
const sub = (a: Pt, b: Pt): Pt => pt(a.x - b.x, a.y - b.y);
const mul = (a: Pt, s: number): Pt => pt(a.x * s, a.y * s);
const norm = (a: Pt): Pt => mul(a, 1 / Math.hypot(a.x, a.y));
const s = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

/** The opening, clockwise from the top centre, as fractions of the helmet layer (which is 12% larger than the screen).
 *  A round dome over the top that sits just above the screen at rest (look up and it comes into view), straight-ish
 *  temples, the pivot hubs pressing in, then the taper into the chin U. */
const OPENING: [number, number][] = [
  [0.5, -0.06], [0.614, -0.044], [0.752, 0.027], [0.86, 0.145], [0.925, 0.296], // dome
  [0.937, 0.42], [0.928, 0.53], // temple, widest at eye level
  [0.912, 0.61], [0.92, 0.675], // the pivot hub presses in a little
  [0.875, 0.785], [0.77, 0.885], [0.635, 0.945], [0.5, 0.965], // tapering into the chin U
  [0.365, 0.945], [0.23, 0.885], [0.125, 0.785],
  [0.08, 0.675], [0.088, 0.61],
  [0.072, 0.53], [0.063, 0.42],
  [0.075, 0.296], [0.14, 0.145], [0.248, 0.027], [0.386, -0.044],
];
/** Guide for the HUD text and bars: the opening itself, shrunk towards the middle of the view, so the text and bars
 *  run parallel to the real glass edge (concentric with it) while staying on screen and out of the corners. */
const HUD_GUIDE: [number, number][] = OPENING.map(([x, y]) => [0.5 + (x - 0.5) * 0.93, 0.53 + (y - 0.53) * 0.82]);
/** Visor pivot hubs: centre (fractions of the layer) and radius (fraction of its height). */
export const HUB = { x: 0.052, y: 0.61, r: 0.058 };

/** A closed smooth curve through points (fractions of w x h): its path, and offsets inside it for text and bars. */
function edgeCurve(points: [number, number][], w: number, h: number) {
  const P = points.map(([x, y]) => pt(x * w, y * h));
  const n = P.length;
  const get = (i: number) => P[((i % n) + n) % n];
  // Uniform Catmull-Rom through the points: sampled for offsets, and written as cubic Beziers for the path.
  const cr = (i: number, u: number): Pt => {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const u2 = u * u, u3 = u2 * u;
    const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3);
    return pt(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y));
  };
  let path = `M ${s(P[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    path += ` C ${s(add(p1, mul(sub(p2, p0), 1 / 6)))} ${s(sub(p2, mul(sub(p3, p1), 1 / 6)))} ${s(p2)}`;
  }
  path += ' Z';

  const SUB = 12;
  const S: Pt[] = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < SUB; k++) S.push(cr(i, k / SUB));
  const M = S.length;
  const centre = pt(0.5 * w, 0.5 * h);
  const N = S.map((p, j) => {
    const t = sub(S[(j + 1) % M], S[(j - 1 + M) % M]);
    let nrm = norm(pt(-t.y, t.x));
    const toC = sub(centre, p);
    if (nrm.x * toC.x + nrm.y * toC.y < 0) nrm = mul(nrm, -1);
    return nrm;
  });
  const inset = (j: number, d: number) => add(S[j], mul(N[j], d));
  const smoothOpen = (pts: Pt[]) => {
    const m = pts.length;
    const q = (i: number) => pts[Math.max(0, Math.min(m - 1, i))];
    let d = `M ${s(pts[0])}`;
    for (let i = 0; i < m - 1; i++) d += ` C ${s(add(q(i), mul(sub(q(i + 1), q(i - 1)), 1 / 6)))} ${s(sub(q(i + 1), mul(sub(q(i + 2), q(i)), 1 / 6)))} ${s(q(i + 1))}`;
    return d;
  };

  /** The upper edge, left to right over the top, moved inside by d pixels. */
  let jR = 1;
  while (jR < M / 2 && S[jR].y < 0.3 * h) jR++;
  let jL = M - 1;
  while (jL > M / 2 && S[jL].y < 0.3 * h) jL--;
  const arcIdx: number[] = [];
  for (let j = jL; j < M; j += 2) arcIdx.push(j);
  for (let j = 0; j <= jR; j += 2) arcIdx.push(j);
  const topArc = (d: number) => smoothOpen(arcIdx.map((j) => inset(j, d)));

  /** For lines of text along the upper left: starts where the edge has flattened to about 28° (readable), and every
   *  line starts from the same point along the edge, so the lines line up like a curved margin. */
  let jT = jL;
  for (let j = jL; j < M; j++) {
    const t = sub(S[(j + 1) % M], S[j]);
    if ((Math.atan2(-t.y, t.x) * 180) / Math.PI <= 28) {
      jT = j;
      break;
    }
  }
  const textIdx: number[] = [];
  for (let j = jT; j < M; j += 2) textIdx.push(j);
  for (let j = 0; j <= jR; j += 2) textIdx.push(j);
  const textArc = (d: number) => smoothOpen(textIdx.map((j) => inset(j, d)));

  /** A straight line inside the right edge, inset by d pixels, between fractions from..to of that side (top to bottom). */
  const rightAt = (yFrac: number) => {
    let best = 0, bestD = Infinity;
    for (let j = 0; j < M; j++) {
      if (S[j].x < w / 2) continue;
      const dy = Math.abs(S[j].y - yFrac * h);
      if (dy < bestD) {
        bestD = dy;
        best = j;
      }
    }
    return best;
  };
  const rightEdge = (d: number, from: number, to: number) => {
    const top = inset(rightAt(0.24 + from * 0.5), d), bottom = inset(rightAt(0.24 + to * 0.5), d);
    const dir = norm(sub(bottom, top));
    return { top, bottom, dir, angle: (Math.atan2(-dir.x, dir.y) * 180) / Math.PI };
  };
  return { path, topArc, textArc, rightEdge };
}

function visorGeometry(w: number, h: number) {
  const opening = edgeCurve(OPENING, w, h); // the real edge of the glass
  const guide = edgeCurve(HUD_GUIDE, w, h); // where the HUD text and bars sit


  return { outline: opening.path, edgeArc: opening.topArc, topArc: guide.topArc, textArc: guide.textArc, rightEdge: guide.rightEdge };
}

// ---------- Pieces ----------

function Bar({ bar, colour, top, bottom, dir, angle, font, gid }: {
  bar: SuitBar; colour: string; top: Pt; bottom: Pt; dir: Pt; angle: number; font: number; gid: string;
}) {
  const f = Math.min(1, Math.max(0, bar.fraction));
  const lvl = add(bottom, mul(sub(top, bottom), f)); // where the fill ends
  const track = `M ${s(bottom)} L ${s(top)}`;
  const fill = `M ${s(bottom)} L ${s(lvl)}`;
  const outward = pt(dir.y, -dir.x); // towards the glass edge
  const ticks = Array.from({ length: 11 }, (_, k) => {
    const at = add(bottom, mul(sub(top, bottom), k / 10));
    const a = add(at, mul(outward, font * 0.85));
    const b = add(at, mul(outward, font * (k % 5 === 0 ? 1.45 : 1.15)));
    return <path key={k} d={`M ${s(a)} L ${s(b)}`} className={`hud-bar-tick${k % 5 === 0 ? ' hud-bar-tick--major' : ''}`} />;
  });
  const valueAt = sub(top, mul(dir, font * 1.25));
  const labelAt = add(bottom, mul(dir, font * 1.8));
  return (
    <g className={`hud-bar hud-bar--${bar.level ?? 'ok'}`} style={{ '--bar-colour': colour } as CSSProperties}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={bottom.x} y1={bottom.y} x2={top.x} y2={top.y}>
          <stop offset="0" stopColor={colour} stopOpacity="0.85" />
          <stop offset="1" stopColor={colour} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* glass tube: coloured rim, dark translucent inside, a shine line down one side */}
      <path d={track} className="hud-bar-rim" />
      <path d={track} className="hud-bar-glass" />
      <path d={track} className="hud-bar-shine" transform={`translate(${s(mul(outward, -font * 0.22))})`} />
      {f > 0.005 && (
        <>
          <path d={fill} className="hud-bar-fill" stroke={`url(#${gid})`} />
        </>
      )}
      {ticks}
      <text className="hud-bar-value" transform={`translate(${s(valueAt)}) rotate(${angle})`} textAnchor="middle">
        {bar.value}
      </text>
      <text className="hud-bar-label" transform={`translate(${s(labelAt)}) rotate(${angle})`} textAnchor="middle">
        {bar.label}
      </text>
      <title>{`${bar.label} ${bar.value}`}</title>
    </g>
  );
}

/**
 * The visor frame: all the heavy SVG effects (noise, big blurs). Memoised, so it is drawn once per screen size
 * and never repainted by HUD updates (timer ticks, sampling progress), which would cause a hitch each time.
 */
const HelmetFrame = memo(function HelmetFrame({ w, h, uid }: { w: number; h: number; uid: string }) {
  const id = (name: string) => `${uid}-${name}`;
  const g = useMemo(() => visorGeometry(w, h), [w, h]);
  return (
          <svg className="hud-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
            <defs>
              <radialGradient id={id('shell')} cx="50%" cy="45%" r="75%">
                <stop offset="40%" stopColor="#e6dcc8" />
                <stop offset="72%" stopColor="#bfb29a" />
                <stop offset="100%" stopColor="#5e564a" />
              </radialGradient>
              <radialGradient id={id('glass')} cx="50%" cy="44%" r="62%">
                <stop offset="55%" stopColor="#000" stopOpacity="0" />
                <stop offset="100%" stopColor="#06101f" stopOpacity="0.7" />
              </radialGradient>
              <radialGradient id={id('hub')} cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor="#f4efe6" />
                <stop offset="55%" stopColor="#d3ccbf" />
                <stop offset="100%" stopColor="#8d867a" />
              </radialGradient>
              <radialGradient id={id('hubCore')} cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#c9c4ba" />
                <stop offset="100%" stopColor="#6e6a62" />
              </radialGradient>
              <linearGradient id={id('edgelight')} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0.08" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.35" stopColor="#fff" stopOpacity="0.5" />
                <stop offset="0.62" stopColor="#fff" stopOpacity="0.2" />
                <stop offset="0.92" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={id('ring')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f2ebdd" />
                <stop offset="12%" stopColor="#c9bca4" />
                <stop offset="100%" stopColor="#6b6253" />
              </linearGradient>
              {/* the helmet is centimetres from the eye: everything on it is out of focus */}
              <filter id={id('defocus')} x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation={h * 0.018} />
              </filter>
              <filter id={id('soft')} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={h * 0.016} />
              </filter>
              <filter id={id('reflect')} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={h * 0.012} />
              </filter>
              <filter id={id('blur-s')} x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="2" />
              </filter>
              {/* fine dust specks on the glass */}
              <filter id={id('dust')} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="7" />
                <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 9 -7.6" />
              </filter>
              {/* soft smudges and haze */}
              <filter id={id('smudge')} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.004 0.007" numOctaves="3" seed="3" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.9  0 0 0 0 1  0 0 0 2.2 -1.15" />
              </filter>
              <filter id={id('blur-m')} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={h * 0.004} />
              </filter>
              <radialGradient id={id('cap')} cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#e7e1d5" />
                <stop offset="100%" stopColor="#a49d90" />
              </radialGradient>
              <radialGradient id={id('mic')} cx="45%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#3a3b3f" />
                <stop offset="100%" stopColor="#0b0b0d" />
              </radialGradient>
              {/* suit fabric: woven threads (warp and weft) plus soft folds, lit so the weave and wrinkles catch light */}
              <filter id={id('fabric')} filterUnits="userSpaceOnUse" x={-w * 0.2} y={-h * 0.45} width={w * 1.4} height={h * 1.9}>
                <feTurbulence type="fractalNoise" baseFrequency="0.25 0.02" numOctaves="2" seed="11" result="warp" />
                <feTurbulence type="fractalNoise" baseFrequency="0.02 0.25" numOctaves="2" seed="5" result="weft" />
                <feComposite in="warp" in2="weft" operator="arithmetic" k1="0" k2="0.5" k3="0.5" k4="0" result="weave" />
                <feTurbulence type="fractalNoise" baseFrequency="0.005 0.011" numOctaves="3" seed="21" result="folds" />
                <feComposite in="weave" in2="folds" operator="arithmetic" k1="0" k2="0.3" k3="0.7" k4="0" result="relief" />
                <feDiffuseLighting in="relief" surfaceScale="4" diffuseConstant="1.25" lightingColor="#fff6ea" result="lit">
                  <feDistantLight azimuth="235" elevation="50" />
                </feDiffuseLighting>
                <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="shaded" />
                <feComposite in="shaded" in2="SourceAlpha" operator="in" />
              </filter>
              {/* quilted padding: puffed diamonds with stitched seams */}
              <radialGradient id={id('puff')} cx="45%" cy="40%" r="65%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#3b3327" stopOpacity="0.3" />
              </radialGradient>
              <pattern id={id('quilt')} patternUnits="userSpaceOnUse" width={h * 0.2} height={h * 0.2} patternTransform="rotate(45)">
                <rect width={h * 0.2} height={h * 0.2} fill={`url(#${id('puff')})`} />
                <path d={`M 0 0 H ${h * 0.2} M 0 0 V ${h * 0.2}`} stroke="#8c826f" strokeWidth="1.2" strokeDasharray="3 2.5" opacity="0.85" />
              </pattern>
              <clipPath id={id('shellArea')}>
                <path clipRule="evenodd" d={`M ${-w * 0.2} ${-h * 0.45} H ${w * 1.2} V ${h * 1.45} H ${-w * 0.2} Z ${g.outline}`} />
              </clipPath>
              <clipPath id={id('visor')}>
                <path d={g.outline} />
              </clipPath>
            </defs>

            {/* ---- the glass ---- */}
            <g clipPath={`url(#${id('visor')})`}>
              {/* tint: darker towards the edge */}
              <path d={g.outline} fill={`url(#${id('glass')})`} />
              {/* dust and smudges on the glass */}
              <rect width={w} height={h} filter={`url(#${id('smudge')})`} opacity="0.05" />
              <rect width={w} height={h} filter={`url(#${id('dust')})`} opacity="0.07" />
              {/* blurry reflections of the helmet interior */}
              <path d={g.edgeArc(h * 0.1)} fill="none" stroke="#fff" strokeOpacity="0.06" strokeWidth={h * 0.06} strokeLinecap="round"
                strokeDasharray={`${w * 0.3} ${w * 2}`} strokeDashoffset={-w * 0.05} filter={`url(#${id('reflect')})`} />
              <path d={g.edgeArc(h * 0.05)} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${w * 0.22} ${w * 2}`} strokeDashoffset={-w * 0.07} filter={`url(#${id('blur-s')})`} />
              <path d={`M ${w * 0.7} ${h * 0.86} Q ${w * 0.83} ${h * 0.84} ${w * 0.88} ${h * 0.72}`} fill="none" stroke="#fff"
                strokeOpacity="0.05" strokeWidth={h * 0.03} strokeLinecap="round" filter={`url(#${id('reflect')})`} />
              {/* deep soft shadow where the glass meets the helmet */}
              <path d={g.outline} fill="none" stroke="#000" strokeWidth={h * 0.08} opacity="0.35" filter={`url(#${id('soft')})`} />
            </g>
            {/* light catching the top edge of the glass */}
            <path d={g.edgeArc(h * 0.02)} fill="none" stroke={`url(#${id('edgelight')})`} strokeWidth="2.5" filter={`url(#${id('blur-s')})`} />
            {/* ---- helmet shell around the visor, out of focus so the edge melts into the glass ---- */}
            <path d={`M ${-w * 0.2} ${-h * 0.45} H ${w * 1.2} V ${h * 1.45} H ${-w * 0.2} Z ${g.outline}`} fillRule="evenodd"
              fill={`url(#${id('shell')})`} filter={`url(#${id('fabric')})`} />
            {/* ---- quilted padding over the whole helmet lining ---- */}
            <g clipPath={`url(#${id('shellArea')})`}>
              <rect x={-w * 0.2} y={-h * 0.45} width={w * 1.4} height={h * 1.9} fill={`url(#${id('quilt')})`} />
            </g>
            {/* ---- where the glass meets the padded lining: no gasket. The padding rolls into a soft sewn edge,
                 with a shadow in the fold, out of focus because it is centimetres from the eye ---- */}
            <g filter={`url(#${id('blur-m')})`}>
              <path d={g.outline} fill="none" stroke="#3a2f22" strokeOpacity="0.42" strokeWidth={h * 0.045} clipPath={`url(#${id('shellArea')})`} />
              <path d={g.outline} fill="none" stroke="#e9e0cd" strokeOpacity="0.85" strokeWidth={h * 0.007} strokeLinejoin="round" />
            </g>
            {/* ---- the visor pivot hubs at each side, close to the eye and out of focus ---- */}
            <g filter={`url(#${id('blur-m')})`}>
              {[HUB.x, 1 - HUB.x].map((fx) => {
                const c = pt(fx * w, HUB.y * h), r = HUB.r * h;
                return (
                  <g key={fx} transform={`translate(${s(c)})`}>
                    <circle r={r * 1.08} fill="#1a1b1e" opacity="0.55" />
                    <circle r={r} fill={`url(#${id('hub')})`} stroke="#5d584f" strokeWidth={r * 0.05} />
                    <circle r={r * 0.62} fill="none" stroke="#7a756b" strokeWidth={r * 0.06} />
                    <circle r={r * 0.42} fill={`url(#${id('hubCore')})`} />
                    <circle r={r * 0.14} fill="#4b4842" />
                    {[0, 1, 2, 3, 4, 5].map((k) => (
                      <circle key={k} cx={Math.cos((k * Math.PI) / 3) * r * 0.8} cy={Math.sin((k * Math.PI) / 3) * r * 0.8} r={r * 0.045} fill="#6d685f" />
                    ))}
                  </g>
                );
              })}
            </g>
            {/* ---- thick clear polycarbonate at the edge of the dome, catching light ---- */}
            <g clipPath={`url(#${id('visor')})`} filter={`url(#${id('blur-s')})`}>
              <path d={g.outline} fill="none" stroke="#ffffff" strokeOpacity="0.045" strokeWidth={h * 0.05} />
            </g>

          </svg>
  );
});

export function HelmetHud({ objectives, alert, o2, temperature, swayTargetRef, sheenRef, targetRef, interiorRef, breathRef, fogRef }: HelmetHudProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `${uid}-${name}`;
  const helmetRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = helmetRef.current!;
    if (swayTargetRef) swayTargetRef.current = el; // createHeadSway() moves this element directly
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (swayTargetRef) swayTargetRef.current = null;
    };
  }, [swayTargetRef]);

  // [E] accepts the suggestion: the astronaut decides (human in the loop). Ignored while typing in a form field.
  useEffect(() => {
    if (!alert?.onAccept) return;
    const key = (alert.acceptKey ?? 'E').toLowerCase();
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key.toLowerCase() === key && !e.repeat) alert.onAccept?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alert]);

  const { w, h } = size;
  const g = useMemo(() => (w > 0 && h > 0 ? visorGeometry(w, h) : null), [w, h]);
  const font = Math.max(13, Math.min(22, h * 0.02)); // px, scales with the screen
  const inset = font * 2.4; // how far the HUD sits in from the glass edge
  // Either the full list, or the older single current-objective line.
  const items: HudObjective[] = objectives.items ?? (objectives.current ? [{ title: objectives.current, time: '', state: 'current' }] : []);
  const headTime = objectives.returnTime ?? objectives.timeLeft ?? null;
  const headLevel = objectives.returnTime ? objectives.returnLevel : objectives.timeLevel;

  return (
    <div className="hud">
      <div className="hud-target" ref={targetRef} style={{ display: 'none' }}>
        <div className="hud-target-mark" />
        <div className="hud-target-label" />
      </div>
      <div className="hud-helmet" ref={helmetRef}>
        {g && <HelmetFrame w={w} h={h} uid={uid} />}
        {g && (
          <div className="hud-glass-fx" style={{ clipPath: `path('${g.outline}')` }}>
            <div className="hud-sheen" ref={sheenRef} />
            <div className="hud-fog" ref={fogRef} />
            <div className="hud-breath" ref={breathRef} />
          </div>
        )}
        <div className="hud-interior" ref={interiorRef} />
        {g && (
          <svg className="hud-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden={!alert}>
            <defs>
              <path id={id('arc-obj-1')} d={g.textArc(inset)} />
              {items.map((_, k) => (
                <path key={k} id={id(`arc-obj-i${k}`)} d={g.textArc(inset + font * (1.6 + k * 1.3))} />
              ))}
              {/* alerts sit below the objectives header line, so they never run into the time */}
              <path id={id('arc-alert-1')} d={g.topArc(inset + font * 2.8)} />
              <path id={id('arc-alert-2')} d={g.topArc(inset + font * 4.3)} />
            </defs>

            {/* ---- objectives: bending along the top-left of the glass ---- */}
            <g className="hud-on-glass" style={{ fontSize: font }}>
              <text className="hud-obj-head">
                <textPath href={`#${id('arc-obj-1')}`} startOffset={font * 0.4}>
                  <tspan className="hud-obj-label">OBJECTIVES </tspan>
                  <tspan className="hud-obj-count" dx="0.4em">
                    {objectives.done}/{objectives.total}
                  </tspan>
                  {headTime && (
                    <>
                      <tspan className="hud-obj-label" dx="1.4em">{objectives.returnTime ? 'RETURN ' : 'TIME '}</tspan>
                      <tspan className={`hud-obj-time hud-obj-time--${headLevel ?? 'ok'}`} dx="0.3em">
                        {headTime}
                      </tspan>
                    </>
                  )}
                </textPath>
              </text>
              {items.map((it, k) => (
                <text key={k} className={`hud-obj-item hud-obj-item--${it.state}`}>
                  <textPath href={`#${id(`arc-obj-i${k}`)}`} startOffset={font * 1.2}>
                    <tspan className="hud-obj-mark">{it.state === 'done' ? '✓' : it.state === 'current' ? '▸' : '◦'}</tspan>
                    <tspan dx="0.5em">{it.title}</tspan>
                    <tspan className={`hud-obj-item-time hud-obj-time--${it.level ?? 'ok'}`} dx="0.8em">
                      {it.time}
                    </tspan>
                  </textPath>
                </text>
              ))}
            </g>

            {/* ---- alert: centred under the top rim, bending with it ---- */}
            {alert && (
              <g
                className={`hud-on-glass hud-alert hud-alert--${alert.level}`}
                style={{ fontSize: font }}
                role="alert"
                onClick={alert.onAccept}
              >
                <text className="hud-alert-title" textAnchor="middle">
                  <textPath href={`#${id('arc-alert-1')}`} startOffset="50%">
                    {alert.level === 'info' ? '' : '⚠ '}
                    {alert.title}
                  </textPath>
                </text>
                <text className="hud-alert-message" textAnchor="middle">
                  <textPath href={`#${id('arc-alert-2')}`} startOffset="50%">
                    {alert.message}
                    {alert.onAccept && (
                      <tspan className="hud-alert-key" dx="0.6em">
                        [{(alert.acceptKey ?? 'E').toUpperCase()}]
                      </tspan>
                    )}
                  </textPath>
                </text>
              </g>
            )}

            {/* ---- O2 and temperature: parallel to the right edge ---- */}
            <g className="hud-on-glass" style={{ fontSize: font }}>
              {(() => {
                // Two tall upright bars, set in from the right edge of the glass: straight up and down, and larger
                // than the text, so they read at a glance.
                const bf = font * 1.4; // bar scale
                const edge = g.rightEdge(inset * 0.9, 0.04, 0.9);
                const x0 = Math.min(edge.top.x, edge.bottom.x); // stay inside the glass at both ends
                return [
                  { bar: temperature, colour: 'var(--c-temperature)', x: x0 - bf * 4.4 },
                  { bar: o2, colour: 'var(--c-o2)', x: x0 },
                ].map(({ bar, colour, x }, i) => (
                  <Bar key={bar.label} bar={bar} colour={colour} top={pt(x, edge.top.y)} bottom={pt(x, edge.bottom.y)} dir={pt(0, 1)} angle={0} font={bf} gid={id(`bar${i}`)} />
                ));
              })()}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
