// Written with AI assistance (Claude).
// Owner: Rachel. Single source of truth for colours: CSS reads these as --c-* variables,
// shaders read them as THREE.Color uniforms. Change a colour here, nowhere else.
// Look (Rachel, Sat 14 Nov): colourful rainbow topography, starry sky, realistic helmet,
// translucent UI with one colour per suit reading (O2 blue, temperature red...).

export const palette = {
  // scene
  space: '#02030a', // night sky behind the stars
  line: '#8a6a63', // contour lines and outlines: soft warm grey-brown, readable on the pastel ground
  steep: '#ff2d55', // slopes from 20° to the 25° limit
  shadow: '#05060f', // terrain in full shadow (the rainbow is multiplied towards this)

  // Leash: red-orange line plus a solid stroke, so it never relies on colour alone
  leashWarn: '#ffd60a',
  leashLimit: '#ff3b30',

  // comms (hatched, not filled)
  commsMarginal: '#ffd60a',
  commsDead: '#bf5af2',

  // markers in the world
  waypoint: '#64d2ff',
  objective: '#ffd60a',
  home: '#ffffff',
  cyclone: '#d9a066', // dust devil

  // suit readings: one colour each, used for bars, icons and labels
  o2: '#0a84ff',
  temperature: '#ff453a',
  pressure: '#bf5af2',
  radiation: '#30d158',
  atmosphere: '#64d2ff',

  // HUD
  hud: '#f2f7ff',
  hudDim: '#a9b8c9',
  glass: 'rgba(160, 200, 255, 0.10)', // translucent panel fill
  glassEdge: 'rgba(200, 225, 255, 0.35)', // panel border
  danger: '#ff3b30',
  warning: '#ffd60a',
  ok: '#30d158',
  helmet: '#e6dcc8', // helmet interior around the visor: NASA suit cream
} as const;

/**
 * Terrain colour ramp: Rachel's pastel palette. It repeats with height as a loop:
 * pink (at the landing-site height), peach, apricot, cream, sage, and back to pink.
 * Shared by the terrain shader and any legend.
 */
export const terrainRamp = ['#ebafaf', '#ffc2aa', '#fad5b3', '#fbf6d2', '#e2ecc0'] as const;

export type PaletteKey = keyof typeof palette;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Call once at startup. Exposes every colour as a CSS variable, e.g. leashLimit -> --c-leash-limit. */
export function applyPaletteToCss(root: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--c-${kebab(key)}`, value);
  root.style.setProperty('--terrain-ramp', `linear-gradient(90deg, ${terrainRamp.join(', ')})`);
}
