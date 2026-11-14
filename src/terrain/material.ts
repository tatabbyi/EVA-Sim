// Written with AI assistance (Claude).
// Owner: Rachel. Terrain look: rainbow height colours, sun lighting, white contour lines, slope warning,
// outlines, the Leash line and comms hatching.
// Everything is drawn inside this one material, because post-processing breaks in WebXR (research/04).
// Contract: createTerrainMaterial() is what Victor's loader puts on every tile (TEAM-PLAN.md section 2.6).

import * as THREE from 'three';
import { BOX_HALF } from '../shared/coords';
import { palette, terrainRamp } from '../ui/palette';

const RAMP_SIZE = terrainRamp.length; // 7

const vertexShader = /* glsl */ `
varying vec3 vPosW;
varying vec3 vNormalW;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

#define RAMP_SIZE ${RAMP_SIZE}

uniform vec3 uRamp[RAMP_SIZE];
uniform float uHeightMin;     // height (m, relative to h0) at the bottom of the ramp
uniform float uHeightMax;     // height at the top of the ramp
uniform float uBanding;       // 0 = smooth rainbow, 1 = flat colour band per minor contour
uniform float uCycle;         // metres of height per full rainbow; 0 = one rainbow over the whole height range
uniform float uSaturation;    // 0 = grey, 1 = full rainbow

uniform vec3 uSunDir;
uniform float uAmbient;
uniform vec3 uShadow;
uniform vec3 uLine;
uniform vec3 uSteepColor;

uniform float uMinor;         // minor contour interval, m
uniform float uMajor;         // major contour interval, m
uniform float uLineWidth;     // px
uniform float uMinorStrength;
uniform float uMajorStrength;
uniform float uSlopeWarn;     // degrees
uniform float uSlopeMax;      // degrees
uniform float uCreaseGain;
uniform float uRimStrength;

uniform sampler2D uO2Grid;    // R32F litres to walk home, Infinity = can't get home
uniform float uHasO2;
uniform float uO2Left;        // litres in the tank now
uniform float uReserve;       // litres held back
uniform float uLeashMargin;   // litres before the line where the warning tint starts
uniform float uLeashWidth;    // px
uniform vec3 uLeashWarn;
uniform vec3 uLeashLimit;

uniform sampler2D uComms;     // R8: 0 visible, 1 marginal, 2 dead
uniform float uHasComms;
uniform vec3 uCommsMarginal;
uniform vec3 uCommsDead;

uniform vec2 uGridOrigin;     // world x/z of sample (0,0)
uniform float uGridCell;
uniform float uGridN;

uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vPosW;
varying vec3 vNormalW;

vec3 ramp(float t) {
  float x = clamp(t, 0.0, 1.0) * float(RAMP_SIZE - 1);
  int i = int(min(floor(x), float(RAMP_SIZE - 2)));
  return mix(uRamp[i], uRamp[i + 1], x - float(i));
}

// Repeating rainbow: red runs back into violet, so small local bumps still show many colours.
vec3 rampCyclic(float t) {
  float x = fract(t) * float(RAMP_SIZE);
  int i = int(floor(x));
  int j = i + 1 >= RAMP_SIZE ? 0 : i + 1;
  return mix(uRamp[i], uRamp[j], x - float(i));
}

// Anti-aliased iso-lines: distance to the nearest line in pixels (research/04, Evan Wallace's grid shader).
// Fades out where lines would be denser than the pixels (far away, grazing angles), instead of washing to white.
float isoLine(float v, float interval, float widthPx) {
  float c = v / interval;
  float fw = max(fwidth(c), 1e-6);
  float d = abs(fract(c - 0.5) - 0.5) / fw;
  float line = 1.0 - clamp(d / widthPx, 0.0, 1.0);
  return line * (1.0 - smoothstep(0.2, 0.7, fw));
}

vec2 gridCoord(vec2 xz) {
  return (xz - uGridOrigin) / uGridCell;
}

// Manual bilinear on a float grid: smooth enough for fwidth(), works without OES_texture_float_linear.
float o2ToHome(vec2 g) {
  vec2 f = clamp(g, vec2(0.0), vec2(uGridN - 1.0));
  ivec2 i0 = ivec2(floor(f));
  ivec2 i1 = min(i0 + 1, ivec2(int(uGridN) - 1));
  vec2 t = f - vec2(i0);
  float a = min(texelFetch(uO2Grid, ivec2(i0.x, i0.y), 0).r, 1e6);
  float b = min(texelFetch(uO2Grid, ivec2(i1.x, i0.y), 0).r, 1e6);
  float c = min(texelFetch(uO2Grid, ivec2(i0.x, i1.y), 0).r, 1e6);
  float d = min(texelFetch(uO2Grid, ivec2(i1.x, i1.y), 0).r, 1e6);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}

void main() {
  vec3 n = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vPosW);
  float h = vPosW.y;

  // 1. Rainbow by height, smooth or banded per minor contour, repeating every uCycle metres.
  float hb = mix(h, (floor(h / uMinor) + 0.5) * uMinor, uBanding);
  vec3 base = uCycle > 0.0
    ? rampCyclic(hb / uCycle)
    : ramp((hb - uHeightMin) / max(uHeightMax - uHeightMin, 1e-3));
  float grey = dot(base, vec3(0.299, 0.587, 0.114));
  base = mix(vec3(grey), base, uSaturation);

  // 2. Light it with the sun so relief still reads.
  float lambert = max(dot(n, normalize(uSunDir)), 0.0);
  vec3 col = mix(uShadow, base, uAmbient + (1.0 - uAmbient) * lambert);

  // 3. Steep ground: tint from uSlopeWarn up to the uSlopeMax limit (25°, research/02).
  float slope = degrees(acos(clamp(n.y, -1.0, 1.0)));
  col = mix(col, uSteepColor, smoothstep(uSlopeWarn, uSlopeMax, slope) * 0.5);

  // 4. Comms: diagonal hatching, so it reads as "no signal" without hiding the ground.
  if (uHasComms > 0.5) {
    vec2 g = clamp(floor(gridCoord(vPosW.xz) + 0.5), vec2(0.0), vec2(uGridN - 1.0));
    float cls = floor(texelFetch(uComms, ivec2(g), 0).r * 255.0 + 0.5);
    float hatch = isoLine(vPosW.x + vPosW.z, 6.0, 1.2);
    if (cls > 1.5) col = mix(col, uCommsDead, 0.75 * hatch);
    else if (cls > 0.5) col = mix(col, uCommsMarginal, 0.45 * hatch);
  }

  // 5. Leash: the line where O2-to-home equals what you can spend (O2 left minus reserve).
  float leashLine = 0.0;
  if (uHasO2 > 0.5) {
    float spend = uO2Left - uReserve;
    float d = o2ToHome(gridCoord(vPosW.xz)) - spend; // > 0 means beyond the Leash
    if (d > 0.0) {
      col = mix(col, uLeashLimit, 0.3);
    } else {
      col = mix(col, uLeashWarn, 0.2 * smoothstep(-uLeashMargin, 0.0, d));
    }
    leashLine = 1.0 - clamp(abs(d) / (max(fwidth(d), 1e-4) * uLeashWidth), 0.0, 1.0);
  }

  // 6. White contour lines and outlines on top of the colour.
  float minor = isoLine(h, uMinor, uLineWidth);
  float major = isoLine(h, uMajor, uLineWidth * 1.8);
  float crease = clamp(length(fwidth(n)) * uCreaseGain, 0.0, 1.0);
  // Silhouettes only on real slopes: flat ground seen at a low angle is not an edge.
  float rim = smoothstep(0.75, 0.97, 1.0 - abs(dot(viewDir, n))) * smoothstep(0.04, 0.2, 1.0 - n.y) * uRimStrength;
  col = mix(col, uLine, max(max(minor * uMinorStrength, major * uMajorStrength), max(crease, rim) * 0.6));
  col = mix(col, uLeashLimit, leashLine);

  // 7. Fade into the night sky with distance.
  float dist = length(cameraPosition - vPosW);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const color = (hex: string) => new THREE.Color(hex);

function emptyTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType);
  t.needsUpdate = true;
  return t;
}

/** Float32 grid (e.g. o2_to_home.bin) as a texture. Nearest only: float textures can't be filtered everywhere. */
export function makeFloatGridTexture(data: Float32Array, n: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Uint8 grid (e.g. comms.bin) as a texture. */
export function makeByteGridTexture(data: Uint8Array, n: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.unpackAlignment = 1; // rows of 2,049 bytes aren't 4-byte aligned
  t.needsUpdate = true;
  return t;
}

export function createTerrainUniforms() {
  return {
    uRamp: { value: terrainRamp.map(color) },
    uHeightMin: { value: -60 },
    uHeightMax: { value: 60 },
    uBanding: { value: 0 },
    uCycle: { value: 3 },
    uSaturation: { value: 1 },

    uSunDir: { value: new THREE.Vector3(0.4, 0.6, -0.3).normalize() },
    uAmbient: { value: 0.35 },
    uShadow: { value: color(palette.shadow) },
    uLine: { value: color(palette.line) },
    uSteepColor: { value: color(palette.steep) },

    uMinor: { value: 1 },
    uMajor: { value: 5 },
    uLineWidth: { value: 1 },
    uMinorStrength: { value: 0.35 },
    uMajorStrength: { value: 0.8 },
    uSlopeWarn: { value: 20 },
    uSlopeMax: { value: 25 },
    uCreaseGain: { value: 3 },
    uRimStrength: { value: 0.5 },

    uO2Grid: { value: emptyTexture() as THREE.Texture },
    uHasO2: { value: 0 },
    uO2Left: { value: 390 },
    uReserve: { value: 30 },
    uLeashMargin: { value: 15 },
    uLeashWidth: { value: 2 },
    uLeashWarn: { value: color(palette.leashWarn) },
    uLeashLimit: { value: color(palette.leashLimit) },

    uComms: { value: emptyTexture() as THREE.Texture },
    uHasComms: { value: 0 },
    uCommsMarginal: { value: color(palette.commsMarginal) },
    uCommsDead: { value: color(palette.commsDead) },

    uGridOrigin: { value: new THREE.Vector2(-BOX_HALF, -BOX_HALF) },
    uGridCell: { value: 2 },
    uGridN: { value: 2049 },

    uFogColor: { value: color(palette.space) },
    uFogNear: { value: 1200 },
    uFogFar: { value: 3800 },
  };
}

export type TerrainUniforms = ReturnType<typeof createTerrainUniforms>;
export type TerrainMaterial = THREE.ShaderMaterial & { uniforms: TerrainUniforms };

export function createTerrainMaterial(): TerrainMaterial {
  return new THREE.ShaderMaterial({
    uniforms: createTerrainUniforms(),
    vertexShader,
    fragmentShader,
  }) as TerrainMaterial;
}

/** Stretch the rainbow over the real height range once the terrain is loaded. */
export function setHeightRange(mat: TerrainMaterial, min: number, max: number): void {
  mat.uniforms.uHeightMin.value = min;
  mat.uniforms.uHeightMax.value = max;
}

/** Hook up Nanda's O2-to-home grid. o2 and comms grids share n and cell (2 m, 2,049). */
export function setO2Grid(mat: TerrainMaterial, tex: THREE.DataTexture, n: number, cell: number): void {
  mat.uniforms.uO2Grid.value = tex;
  mat.uniforms.uHasO2.value = 1;
  mat.uniforms.uGridN.value = n;
  mat.uniforms.uGridCell.value = cell;
}

export function setCommsGrid(mat: TerrainMaterial, tex: THREE.DataTexture): void {
  mat.uniforms.uComms.value = tex;
  mat.uniforms.uHasComms.value = 1;
}
