// Written with AI assistance (Claude).
// Owner: Rachel. Single source of truth for colours: CSS reads these as --c-* variables,
// shaders read them as THREE.Color uniforms. Change a colour here, nowhere else.
// Look (Rachel, Sat 14 Nov): colourful rainbow topography, starry sky, realistic helmet,
// translucent UI with one colour per suit reading (O2 blue, temperature red...).

export const palette = {
  // scene
  space: '#02030a', // night sky behind the stars
  line: '#3b2418', // contour lines and outlines (each ground colour look sets its own, see terrainPresets)
  steep: '#d9483b', // slopes from 20° to the 25° limit (a muted warning red)
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
 * Ground colour looks to choose from (Look panel > Terrain > ground colours). Each ramp repeats every `cycle`
 * metres of height (0 = one ramp over the whole height range), up to 8 colours. `line` is the contour colour.
 */
export interface TerrainPreset {
  label: string;
  ramp: string[];
  cycle: number;
  line: string;
  lineStrength: number;
}

export const terrainPresets = {
  marsTrue: {
    label: 'Realistic Mars',
    ramp: ['#8a5a3c', '#a86d45', '#c08a5b', '#b07850', '#9a6545', '#c79a6e', '#7d5236'],
    cycle: 6,
    line: '#3b2418',
    lineStrength: 0.22,
  },
  pastel: {
    label: 'Pastel',
    ramp: ['#ebafaf', '#ffc2aa', '#fad5b3', '#fbf6d2', '#e2ecc0'],
    cycle: 3,
    line: '#8a6a63',
    lineStrength: 0.35,
  },
  marsOchre: {
    label: 'Mars ochre',
    ramp: ['#a4552f', '#c3843f', '#d6b06a', '#b07a4f', '#5f6f6a', '#6e4030', '#8c4a2e'],
    cycle: 3,
    line: '#ffffff',
    lineStrength: 0.35,
  },
  topo: {
    label: 'Topographic map',
    ramp: ['#2f6b4f', '#5f8f4e', '#a7b56a', '#e3d58f', '#d9a35f', '#b5704a', '#f2efe9'],
    cycle: 0,
    line: '#3a3a3a',
    lineStrength: 0.4,
  },
  sandstone: {
    label: 'Sandstone',
    ramp: ['#d9c3a5', '#cbb08e', '#bd9d78', '#cbb08e'],
    cycle: 4,
    line: '#5a4632',
    lineStrength: 0.45,
  },
  thermal: {
    label: 'Thermal',
    ramp: ['#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d'],
    cycle: 10,
    line: '#ffffff',
    lineStrength: 0.25,
  },
} satisfies Record<string, TerrainPreset>;

export type TerrainPresetName = keyof typeof terrainPresets;
export const defaultTerrainPreset: TerrainPresetName = 'marsTrue';

/** The default ground ramp (for legends). */
export const terrainRamp = terrainPresets[defaultTerrainPreset].ramp;

export type PaletteKey = keyof typeof palette;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Call once at startup. Exposes every colour as a CSS variable, e.g. leashLimit -> --c-leash-limit. */
export function applyPaletteToCss(root: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(palette)) root.style.setProperty(`--c-${kebab(key)}`, value);
  root.style.setProperty('--terrain-ramp', `linear-gradient(90deg, ${terrainRamp.join(', ')})`);
}
