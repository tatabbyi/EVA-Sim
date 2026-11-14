// Written with AI assistance (Claude).
// Owner: Rachel. Helmet HUD (TEAM-PLAN.md section 1a), drawn on the curved visor glass and following its edges:
// - top-left: objectives as text bending along the top edge of the visor (no box)
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

export interface HelmetHudProps {
  /** timeLeft: mission time remaining, e.g. "42:10"; timeLevel colours it (warning, danger). */
  objectives: { done: number; total: number; current?: string | null; timeLeft?: string | null; timeLevel?: Level };
  alert?: HudAlert | null;
  o2: SuitBar;
  temperature: SuitBar;
  /** Receives the glass-reflection element; slide it sideways as the head turns (see Preview). */
  sheenRef?: MutableRefObject<HTMLDivElement | null>;
  /** Receives the helmet element so createHeadSway() can move it (head moving inside the helmet). */
  swayTargetRef?: MutableRefObject<HTMLDivElement | null>;
}

// ---------- Visor geometry ----------
// Visor outline in a 1000 x 600 design box: arched top (P0 to P2 via P1), right side P2 to P3,
// curved chin P3 to P5 via P4, left side back to P0. Scaled to the real helmet layer size in pixels.

interface Pt { x: number; y: number }
const pt = (x: number, y: number): Pt => ({ x, y });
const add = (a: Pt, b: Pt): Pt => pt(a.x + b.x, a.y + b.y);
const sub = (a: Pt, b: Pt): Pt => pt(a.x - b.x, a.y - b.y);
const mul = (a: Pt, s: number): Pt => pt(a.x * s, a.y * s);
const norm = (a: Pt): Pt => mul(a, 1 / Math.hypot(a.x, a.y));
const leftNormal = (a: Pt): Pt => norm(pt(-a.y, a.x)); // for this outline's direction, points into the visor
const s = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

function visorGeometry(w: number, h: number) {
  const p = (x: number, y: number) => pt((x / 1000) * w, (y / 600) * h);
  const P0 = p(40, 165), P1 = p(500, -55), P2 = p(960, 165), P3 = p(915, 565), P4 = p(500, 640), P5 = p(85, 565);
  // Rounded corners: a real helmet opening has no sharp corners.
  const r = h * 0.12;
  const toward = (from: Pt, to: Pt) => add(from, mul(norm(sub(to, from)), r));
  const A = toward(P0, P5), B = toward(P0, P1), C = toward(P2, P1), D = toward(P2, P3);
  const E = toward(P3, P2), F = toward(P3, P4), G = toward(P5, P4), H = toward(P5, P0);
  const outline =
    `M ${s(A)} Q ${s(P0)} ${s(B)} Q ${s(P1)} ${s(C)} Q ${s(P2)} ${s(D)} L ${s(E)} ` +
    `Q ${s(P3)} ${s(F)} Q ${s(P4)} ${s(G)} Q ${s(P5)} ${s(H)} Z`;

  /** The top arc moved inside the visor by d pixels, as a path (exact offset at the ends, tangents kept). */
  const topArc = (d: number) => {
    const t0 = sub(P1, P0), t2 = sub(P2, P1);
    const a = add(P0, mul(leftNormal(t0), d));
    const c = add(P2, mul(leftNormal(t2), d));
    // control point = where the two offset end tangents cross
    const det = -t0.x * t2.y + t2.x * t0.y;
    const ca = sub(c, a);
    const k = (-ca.x * t2.y + t2.x * ca.y) / det;
    const b = add(a, mul(t0, k));
    return `M ${s(a)} Q ${s(b)} ${s(c)}`;
  };

  /** A line parallel to the right edge, inset by d pixels, between fractions from..to of the edge (top to bottom). */
  const rightEdge = (d: number, from: number, to: number) => {
    const dir = norm(sub(P3, P2));
    const inward = leftNormal(sub(P3, P2));
    const at = (t: number) => add(add(P2, mul(sub(P3, P2), t)), mul(inward, d));
    return { top: at(from), bottom: at(to), dir, angle: (Math.atan2(-dir.x, dir.y) * 180) / Math.PI };
  };

  return { outline, topArc, rightEdge };
}

// ---------- Pieces ----------

function Bar({ bar, colour, top, bottom, dir, angle, font, gid }: {
  bar: SuitBar; colour: string; top: Pt; bottom: Pt; dir: Pt; angle: number; font: number; gid: string;
}) {
  const f = Math.min(1, Math.max(0, bar.fraction));
  const len = Math.hypot(top.x - bottom.x, top.y - bottom.y);
  const lvl = add(bottom, mul(sub(top, bottom), f)); // where the fill ends
  const track = `M ${s(bottom)} L ${s(top)}`;
  const fill = `M ${s(bottom)} L ${s(lvl)}`;
  const seg = len / 24; // segmented fill: 24 cells
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
          <stop offset="0" stopColor={colour} stopOpacity="0.95" />
          <stop offset="1" stopColor={colour} stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* glass tube: coloured rim, dark translucent inside, a shine line down one side */}
      <path d={track} className="hud-bar-rim" />
      <path d={track} className="hud-bar-glass" />
      <path d={track} className="hud-bar-shine" transform={`translate(${s(mul(outward, -font * 0.22))})`} />
      {f > 0.005 && (
        <>
          <path d={fill} className="hud-bar-fill" stroke={`url(#${gid})`} strokeDasharray={`${seg * 0.72} ${seg * 0.28}`} />
          <path d={fill} className="hud-bar-flow" strokeDasharray={`${seg * 1.6} ${len * 2}`}>
            <animate attributeName="stroke-dashoffset" from="0" to={-len} dur="2.6s" repeatCount="indefinite" />
          </path>
          <circle cx={lvl.x} cy={lvl.y} r={font * 0.36} className="hud-bar-cap" />
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
              <linearGradient id={id('sunvisor')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4a03a" stopOpacity="0.3" />
                <stop offset="22%" stopColor="#d4a03a" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={id('edgelight')} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0.08" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.35" stopColor="#fff" stopOpacity="0.5" />
                <stop offset="0.62" stopColor="#fff" stopOpacity="0.2" />
                <stop offset="0.92" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={id('rubber')} x1="0" y1="0" x2="0" y2={h} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#3d3e42" />
                <stop offset="0.35" stopColor="#1c1d20" />
                <stop offset="1" stopColor="#0d0e10" />
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
              <filter id={id('fabric')} filterUnits="userSpaceOnUse" x={-w * 0.2} y={-h * 0.2} width={w * 1.4} height={h * 1.4}>
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
              {/* twill weave on the side panels */}
              <pattern id={id('twill')} patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(32)">
                <path d="M 0 0 V 16" stroke="#5c5244" strokeWidth="1.1" opacity="0.22" />
              </pattern>
              <linearGradient id={id('fadeDown')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" />
                <stop offset="0.55" stopColor="#fff" />
                <stop offset="0.8" stopColor="#000" />
              </linearGradient>
              <mask id={id('upper')}>
                <rect x={-w * 0.2} y={-h * 0.2} width={w * 1.4} height={h * 0.9} fill={`url(#${id('fadeDown')})`} />
              </mask>
              <clipPath id={id('shellArea')}>
                <path clipRule="evenodd" d={`M ${-w * 0.2} ${-h * 0.2} H ${w * 1.2} V ${h * 1.2} H ${-w * 0.2} Z ${g.outline}`} />
              </clipPath>
              <filter id={id('rubberFx')} x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={h * 0.0025} result="b" />
                <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="4" result="n" />
                <feComposite in="n" in2="b" operator="arithmetic" k1="0" k2="0.07" k3="1" k4="-0.035" result="g" />
                <feComposite in="g" in2="b" operator="in" />
              </filter>
              <clipPath id={id('visor')}>
                <path d={g.outline} />
              </clipPath>
            </defs>

            {/* ---- the glass ---- */}
            <g clipPath={`url(#${id('visor')})`}>
              {/* tint: darker towards the edge, faint gold sun visor at the top */}
              <path d={g.outline} fill={`url(#${id('glass')})`} />
              <path d={g.outline} fill={`url(#${id('sunvisor')})`} />
              {/* dust and smudges on the glass */}
              <rect width={w} height={h} filter={`url(#${id('smudge')})`} opacity="0.05" />
              <rect width={w} height={h} filter={`url(#${id('dust')})`} opacity="0.07" />
              {/* blurry reflections of the helmet interior */}
              <path d={g.topArc(h * 0.1)} fill="none" stroke="#fff" strokeOpacity="0.06" strokeWidth={h * 0.06} strokeLinecap="round"
                strokeDasharray={`${w * 0.3} ${w * 2}`} strokeDashoffset={-w * 0.05} filter={`url(#${id('reflect')})`} />
              <path d={g.topArc(h * 0.05)} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${w * 0.22} ${w * 2}`} strokeDashoffset={-w * 0.07} filter={`url(#${id('blur-s')})`} />
              <path d={`M ${w * 0.7} ${h * 0.86} Q ${w * 0.83} ${h * 0.84} ${w * 0.88} ${h * 0.72}`} fill="none" stroke="#fff"
                strokeOpacity="0.05" strokeWidth={h * 0.03} strokeLinecap="round" filter={`url(#${id('reflect')})`} />
              {/* deep soft shadow where the glass meets the helmet */}
              <path d={g.outline} fill="none" stroke="#000" strokeWidth={h * 0.08} opacity="0.5" filter={`url(#${id('soft')})`} />
            </g>
            {/* light catching the top edge of the glass, just inside the seal */}
            <path d={g.topArc(h * 0.034)} fill="none" stroke={`url(#${id('edgelight')})`} strokeWidth="2.5" filter={`url(#${id('blur-s')})`} />
            {/* ---- helmet shell around the visor, out of focus so the edge melts into the glass ---- */}
            <path d={`M ${-w * 0.2} ${-h * 0.2} H ${w * 1.2} V ${h * 1.2} H ${-w * 0.2} Z ${g.outline}`} fillRule="evenodd"
              fill={`url(#${id('shell')})`} filter={`url(#${id('fabric')})`} />
            {/* ---- suit fabric details on the shell: quilted padding above, twill side panels, stitched seams, crew patch ---- */}
            <g clipPath={`url(#${id('shellArea')})`}>
              <rect x={-w * 0.2} y={-h * 0.2} width={w * 1.4} height={h * 0.9} fill={`url(#${id('quilt')})`} mask={`url(#${id('upper')})`} />
              <rect x={-w * 0.2} y={h * 0.45} width={w * 1.4} height={h * 0.8} fill={`url(#${id('twill')})`} />
              <g transform={`translate(${w * 0.075} ${h * 0.1})`}>
                <rect width={w * 0.075} height={h * 0.05} rx={h * 0.006} fill="#d9cfbb" stroke="#6f6656" strokeWidth="1" />
                <rect x={h * 0.006} y={h * 0.006} width={w * 0.075 - h * 0.012} height={h * 0.038} rx={h * 0.004} fill="none"
                  stroke="#8c826f" strokeWidth="1" strokeDasharray="3 2" />
                <rect x={h * 0.012} y={h * 0.017} width={w * 0.012} height={h * 0.016} fill="#b3352b" />
                <text x={h * 0.012 + w * 0.02} y={h * 0.031} fontSize={h * 0.02} fontWeight="700" fill="#4d4539" fontFamily="system-ui, sans-serif">
                  EV1
                </text>
              </g>
            </g>
            {/* ---- rubber seal where the visor meets the helmet: one soft rounded matte profile, lighter in the middle
                 like a tube catching light, with a fine grain and a broad dull sheen on top (no hard lines) ---- */}
            <g filter={`url(#${id('rubberFx')})`}>
              {[
                [0.062, '#08090a'],
                [0.05, '#101113'],
                [0.039, '#17181b'],
                [0.028, '#1e1f23'],
                [0.017, '#25262a'],
              ].map(([wf, c]) => (
                <path key={c as string} d={g.outline} fill="none" stroke={c as string} strokeWidth={h * (wf as number)} strokeLinejoin="round" />
              ))}
              <path d={g.topArc(0)} fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth={h * 0.03} strokeLinecap="round" />
            </g>
            {/* ---- thick clear polycarbonate at the edge of the dome, catching light ---- */}
            <g clipPath={`url(#${id('visor')})`} filter={`url(#${id('blur-s')})`}>
              <path d={g.outline} fill="none" stroke="#ffffff" strokeOpacity="0.09" strokeWidth={h * 0.07} />
            </g>

          </svg>
  );
});

export function HelmetHud({ objectives, alert, o2, temperature, swayTargetRef, sheenRef }: HelmetHudProps) {
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

  return (
    <div className="hud">
      <div className="hud-helmet" ref={helmetRef}>
        {g && <HelmetFrame w={w} h={h} uid={uid} />}
        {g && (
          <div className="hud-glass-fx" style={{ clipPath: `path('${g.outline}')` }}>
            <div className="hud-sheen" ref={sheenRef} />
            <div className="hud-breath" />
          </div>
        )}
        {g && (
          <svg className="hud-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden={!alert}>
            <defs>
              <path id={id('arc-obj-1')} d={g.topArc(inset)} />
              <path id={id('arc-obj-2')} d={g.topArc(inset + font * 1.5)} />
              <path id={id('arc-alert-1')} d={g.topArc(inset + font * 0.4)} />
              <path id={id('arc-alert-2')} d={g.topArc(inset + font * 1.9)} />
            </defs>

            {/* ---- objectives: bending along the top-left of the glass ---- */}
            <g className="hud-on-glass" style={{ fontSize: font }}>
              <text className="hud-obj-head">
                <textPath href={`#${id('arc-obj-1')}`} startOffset="7%">
                  <tspan className="hud-obj-label">OBJECTIVES </tspan>
                  <tspan className="hud-obj-count" dx="0.4em">
                    {objectives.done}/{objectives.total}
                  </tspan>
                  {objectives.timeLeft && (
                    <>
                      <tspan className="hud-obj-label" dx="1.4em">TIME </tspan>
                      <tspan className={`hud-obj-time hud-obj-time--${objectives.timeLevel ?? 'ok'}`} dx="0.3em">
                        {objectives.timeLeft}
                      </tspan>
                    </>
                  )}
                </textPath>
              </text>
              {objectives.current && (
                <text className="hud-obj-current">
                  <textPath href={`#${id('arc-obj-2')}`} startOffset="7.5%">
                    ▸ {objectives.current}
                  </textPath>
                </text>
              )}
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
              {[
                { bar: temperature, colour: 'var(--c-temperature)', d: inset * 1.5 + font * 4 },
                { bar: o2, colour: 'var(--c-o2)', d: inset * 1.5 },
              ].map(({ bar, colour, d }, i) => {
                const e = g.rightEdge(d, 0.24, 0.7);
                return <Bar key={bar.label} bar={bar} colour={colour} {...e} font={font} gid={id(`bar${i}`)} />;
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
