// Written with AI assistance (Claude).
// Owner: Rachel. Single source of truth for colours: CSS reads these as --c-* variables,
// shaders read them as THREE.Color uniforms. Change a colour here, nowhere else.

export const palette = {
  // scene
  space: '#06070a', // sky and distance fade
  ground: '#1c120e', // terrain in shadow
  groundLit: '#7a4630', // terrain in full sun
  line: '#f3e7da', // minor contours and outlines
  contourMajor: '#ffb27a', // every 25 m
  steep: '#c2410c', // slopes from 20° to the 25° limit

  // Leash. Safe vs limit is teal vs red-orange, plus a solid line, so it never relies on red/green alone.
  leashSafe: '#2dd4bf',
  leashWarn: '#fbbf24',
  leashLimit: '#ff5a36',

  // comms (hatched, not filled)
  commsMarginal: '#facc15',
  commsDead: '#a78bfa',

  // markers
  waypoint: '#2dd4bf',
  waypointHome: '#e8f4ff',

  // HUD
  hud: '#e8f4ff',
  hudDim: '#8aa0b4',
  hudPanel: 'rgba(8, 14, 22, 0.55)',
  danger: '#ff4d4f',
  warning: '#fbbf24',
  ok: '#2dd4bf',
  helmet: '#0b0d12', // inside of the helmet around the visor
} as const;

export type PaletteKey = keyof typeof palette;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Call once at startup. Exposes every colour as a CSS variable, e.g. leashLimit -> --c-leash-limit. */
export function applyPaletteToCss(root: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--c-${kebab(key)}`, value);
}
