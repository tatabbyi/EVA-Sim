// Written with AI assistance (Claude).
// Owner: Rachel. A holographic compass projected low on the visor: a glowing disc seen in perspective, as if it floats
// flat in front of you, turning as you turn (what's ahead is at its far edge). It shows N, E, S and W, your heading,
// the next objective (a diamond, with its distance) and the base. Built once in SVG; update() moves the parts each
// frame, so React never re-renders for it.

export interface CompassTarget {
  /** Compass bearing to it in radians: 0 = north, clockwise (pi/2 = east). */
  bearing: number;
  kind: 'objective' | 'base';
  /** Shown next to the marker, e.g. "75 M". */
  label?: string;
}

export interface HudCompass {
  element: SVGSVGElement;
  /** heading: where you face, as a compass bearing in radians (0 = north, clockwise). */
  update(heading: number, targets: CompassTarget[]): void;
}

const NS = 'http://www.w3.org/2000/svg';
const W = 240, H = 124, CX = 120, CY = 64, RX = 104, RY = 40; // the disc: an ellipse, a circle seen from above at a slant
const CARDINALS: [string, number][] = [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]];

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.insertBefore(e, null); // add at the end
  return e;
};

export function createHudCompass(): HudCompass {
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hud-compass-svg', 'aria-hidden': 'true' });
  const defs = el('defs', {}, svg);
  const glow = el('radialGradient', { id: 'hud-compass-glow', cx: '50%', cy: '50%', r: '50%' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#6fe3ff', 'stop-opacity': 0.22 }, glow);
  el('stop', { offset: '70%', 'stop-color': '#6fe3ff', 'stop-opacity': 0.08 }, glow);
  el('stop', { offset: '100%', 'stop-color': '#6fe3ff', 'stop-opacity': 0 }, glow);

  // the disc, two rings, and faint scan lines across it (the hologram look)
  el('ellipse', { cx: CX, cy: CY, rx: RX, ry: RY, fill: 'url(#hud-compass-glow)', class: 'hud-compass-ring' }, svg);
  el('ellipse', { cx: CX, cy: CY, rx: RX * 0.62, ry: RY * 0.62, fill: 'none', class: 'hud-compass-ring hud-compass-ring--inner' }, svg);
  for (let k = -3; k <= 3; k++) {
    const y = CY + (k * RY) / 4, half = RX * Math.sqrt(Math.max(0, 1 - ((y - CY) / RY) ** 2));
    el('line', { x1: CX - half, y1: y, x2: CX + half, y2: y, class: 'hud-compass-scan' }, svg);
  }
  // 36 ticks round the rim, longer every 30°
  const ticks = Array.from({ length: 36 }, (_, i) => ({ a: (i / 36) * Math.PI * 2, major: i % 3 === 0, line: el('line', { class: 'hud-compass-tick' }, svg) }));
  const letters = CARDINALS.map(([name, a]) => {
    const t = el('text', { class: `hud-compass-letter${name === 'N' ? ' hud-compass-letter--north' : ''}`, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, svg);
    t.textContent = name;
    return { a, t };
  });
  // you: a small arrow in the middle pointing ahead, with your heading under it
  el('path', { d: `M ${CX} ${CY - 9} L ${CX + 6} ${CY + 5} L ${CX} ${CY + 1} L ${CX - 6} ${CY + 5} Z`, class: 'hud-compass-you' }, svg);
  const headingText = el('text', { x: CX, y: CY + 19, class: 'hud-compass-heading', 'text-anchor': 'middle' }, svg);
  // markers: the next objective (diamond) and the base (square), each with a label
  const objective = el('g', { class: 'hud-compass-mark hud-compass-mark--objective' }, svg);
  el('path', { d: 'M 0 -7 L 7 0 L 0 7 L -7 0 Z' }, objective);
  const objectiveLabel = el('text', { 'text-anchor': 'middle' }, objective);
  const baseMark = el('g', { class: 'hud-compass-mark hud-compass-mark--base' }, svg);
  el('rect', { x: -5, y: -5, width: 10, height: 10, rx: 2 }, baseMark);
  const baseLabel = el('text', { 'text-anchor': 'middle' }, baseMark);
  baseLabel.textContent = 'BASE';

  // A point on the disc for an angle relative to where you face (0 = ahead, at the far edge), at radius f (0..1);
  // nearer points (the front of the disc) come out a little bigger and brighter, like a real tilted disc.
  const at = (rel: number, f: number) => ({ x: CX + Math.sin(rel) * RX * f, y: CY - Math.cos(rel) * RY * f, near: (1 - Math.cos(rel)) / 2 });
  let lastHeading = NaN, lastKey = '';

  return {
    element: svg,
    update(heading, targets) {
      const key = targets.map((t) => `${t.kind}${t.bearing.toFixed(3)}${t.label ?? ''}`).join('|');
      if (Math.abs(heading - lastHeading) < 0.002 && key === lastKey) return;
      lastHeading = heading;
      lastKey = key;
      for (const t of ticks) {
        const rel = t.a - heading, a = at(rel, t.major ? 0.84 : 0.9), b = at(rel, 1);
        t.line.setAttribute('x1', a.x.toFixed(1));
        t.line.setAttribute('y1', a.y.toFixed(1));
        t.line.setAttribute('x2', b.x.toFixed(1));
        t.line.setAttribute('y2', b.y.toFixed(1));
        t.line.setAttribute('opacity', (0.45 + 0.55 * a.near).toFixed(2));
      }
      for (const { a: ang, t } of letters) {
        const p = at(ang - heading, 0.76);
        t.setAttribute('x', p.x.toFixed(1));
        t.setAttribute('y', p.y.toFixed(1));
        t.setAttribute('font-size', (11 + 4 * p.near).toFixed(1));
        t.setAttribute('opacity', (0.6 + 0.4 * p.near).toFixed(2));
      }
      const deg = Math.round(((((heading * 180) / Math.PI) % 360) + 360) % 360);
      headingText.textContent = `${String(deg).padStart(3, '0')}°`;
      const place = (g: SVGGElement, t: CompassTarget | undefined, label: SVGTextElement, text?: string) => {
        if (!t) return void g.setAttribute('display', 'none');
        const p = at(t.bearing - heading, 1);
        g.setAttribute('display', 'inline');
        g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(0.85 + 0.3 * p.near).toFixed(2)})`);
        label.setAttribute('y', p.near > 0.5 ? '17' : '-11'); // label on the outside of the ring, clear of the letters
        if (text !== undefined) label.textContent = text;
      };
      place(objective, targets.find((t) => t.kind === 'objective'), objectiveLabel, targets.find((t) => t.kind === 'objective')?.label ?? '');
      place(baseMark, targets.find((t) => t.kind === 'base'), baseLabel);
    },
  };
}
