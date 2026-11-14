// Written with AI assistance (Claude).
// Owner: Rachel. Terrain look: rainbow height colours, sun lighting, white contour lines, slope warning,
// outlines, the Leash line and comms hatching.
// Everything is drawn inside this one material, because post-processing breaks in WebXR (research/04).
// Contract: createTerrainMaterial() is what Victor's loader puts on every tile (TEAM-PLAN.md section 2.6).

import * as THREE from 'three';
import { BOX_HALF } from '../shared/coords';
import { defaultTerrainPreset, palette, terrainPresets, type TerrainPresetName } from '../ui/palette';

const MAX_RAMP = 8; // most colours a ground look can have

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

#define MAX_RAMP ${MAX_RAMP}

uniform vec3 uRamp[MAX_RAMP];
uniform float uRampN;        // how many of the ramp colours are used
uniform float uHeightMin;     // height (m, relative to h0) at the bottom of the ramp
uniform float uHeightMax;     // height at the top of the ramp
uniform float uBanding;       // 0 = smooth rainbow, 1 = flat colour band per minor contour
uniform float uCycle;         // metres of height per full rainbow; 0 = one rainbow over the whole height range
uniform float uSaturation;    // 0 = grey, 1 = full rainbow

uniform vec3 uSunDir;
uniform float uAmbient;
uniform vec3 uShadow;
uniform vec3 uLine;
uniform float uLineLight;    // 1: lines are light added by the visor, 0: painted lines
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

uniform float uRelief;       // exaggerates slopes in the lighting only (1 = true slope), so small relief reads
uniform float uDetail;       // 0 = smooth, 1 = full close-up surface detail (bumps and grit)
uniform float uArNear;       // AR overlay (contours, steep warning, Leash) is full strength up to here...
uniform float uArFar;        // ...and gone beyond here, like a visor display that only annotates what's near
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vPosW;
varying vec3 vNormalW;

vec3 ramp(float t) {
  float x = clamp(t, 0.0, 1.0) * (uRampN - 1.0);
  int i = int(min(floor(x), uRampN - 2.0));
  return mix(uRamp[i], uRamp[i + 1], x - float(i));
}

// Repeating ramp: the last colour runs back into the first, so small local bumps still show many colours.
vec3 rampCyclic(float t) {
  float x = fract(t) * uRampN;
  int i = int(floor(x));
  int j = float(i + 1) >= uRampN ? 0 : i + 1;
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

// Value noise for close-up ground detail.
float hash12(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int k = 0; k < 4; k++) {
    s += a * vnoise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return s;
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
  vec3 nl = normalize(vec3(n.x * uRelief, n.y, n.z * uRelief)); // lighting normal with exaggerated relief
  float lambert = max(dot(nl, normalize(uSunDir)), 0.0);
  vec3 col = mix(uShadow, base, uAmbient + (1.0 - uAmbient) * lambert);

  // 2b. Close-up surface detail: small bumps catch the sun, fine grit in the colour. Fades out with distance
  // (no shimmer far away) and is cheap enough to run per pixel.
  float near = (1.0 - smoothstep(20.0, 110.0, length(cameraPosition - vPosW))) * uDetail;
  if (near > 0.001) {
    vec2 q = vPosW.xz * 0.9;
    float e = 0.12;
    float h0 = fbm(q), hx = fbm(q + vec2(e, 0.0)), hz = fbm(q + vec2(0.0, e));
    vec3 nd = normalize(nl + vec3(-(hx - h0), 0.0, -(hz - h0)) / e * 0.45 * near);
    float lambertD = max(dot(nd, normalize(uSunDir)), 0.0);
    col = mix(col, mix(uShadow, base, uAmbient + (1.0 - uAmbient) * lambertD), near);
    col *= 1.0 + (fbm(vPosW.xz * 6.0) - 0.5) * 0.22 * near;
  }

  // 3. Steep ground: tint from uSlopeWarn up to the uSlopeMax limit (25°, research/02).
  float slope = degrees(acos(clamp(n.y, -1.0, 1.0)));
  // The visor only annotates ground you look down onto: fades with distance and at grazing angles, so far
  // contours don't pile up into streaks along the horizon.
  float ar = (1.0 - smoothstep(uArNear, uArFar, length(cameraPosition - vPosW))) * smoothstep(0.05, 0.22, abs(dot(viewDir, n)));
  col += uSteepColor * smoothstep(uSlopeWarn, uSlopeMax, slope) * 0.22 * ar; // AR warning glow on steep ground

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
  // Contours are light projected by the visor (added, not painted), so the ground keeps its real colour.
  // Two kinds of line: dark ones are painted into a colour-map look (always on), bright ones are visor light (added,
  // so the ground keeps its colour) and fade with distance like the rest of the AR display.
  float lineK = max(minor * uMinorStrength, major * uMajorStrength);
  col = uLineLight > 0.5 ? col + uLine * lineK * ar : mix(col, uLine, lineK);
  col = mix(col, uLine, max(crease, rim) * 0.6); // optional stylised edges, off by default
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
    uRamp: { value: Array.from({ length: MAX_RAMP }, () => new THREE.Color()) },
    uRampN: { value: 2 },
    uHeightMin: { value: -60 },
    uHeightMax: { value: 60 },
    uBanding: { value: 0 },
    uCycle: { value: 3 },
    uSaturation: { value: 1 },

    uSunDir: { value: new THREE.Vector3(0.4, 0.6, -0.3).normalize() },
    uAmbient: { value: 0.25 },
    uShadow: { value: color(palette.shadow) },
    uLine: { value: color(palette.line) },
    uLineLight: { value: 0 },
    uSteepColor: { value: color(palette.steep) },

    uMinor: { value: 1 },
    uMajor: { value: 5 },
    uLineWidth: { value: 1.4 },
    uMinorStrength: { value: 0.35 },
    uMajorStrength: { value: 0.8 },
    uSlopeWarn: { value: 20 },
    uSlopeMax: { value: 25 },
    uCreaseGain: { value: 0 },
    uRimStrength: { value: 0 },

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

    uRelief: { value: 1.6 },
    uArNear: { value: 12 },
    uArFar: { value: 90 },
    uDetail: { value: 0.8 },
    uFogColor: { value: color(palette.space) },
    uFogNear: { value: 300 },
    uFogFar: { value: 3000 },
  };
}

export type TerrainUniforms = ReturnType<typeof createTerrainUniforms>;
export type TerrainMaterial = THREE.ShaderMaterial & { uniforms: TerrainUniforms };

export function createTerrainMaterial(preset: TerrainPresetName = defaultTerrainPreset): TerrainMaterial {
  const mat = new THREE.ShaderMaterial({
    uniforms: createTerrainUniforms(),
    vertexShader,
    fragmentShader,
  }) as TerrainMaterial;
  setTerrainPreset(mat, preset);
  return mat;
}

/** Switch the ground colour look (ramp, repeat, contour colour) live. */
export function setTerrainPreset(mat: TerrainMaterial, name: TerrainPresetName): void {
  const p = terrainPresets[name];
  const u = mat.uniforms;
  for (let i = 0; i < MAX_RAMP; i++) u.uRamp.value[i].set(p.ramp[Math.min(i, p.ramp.length - 1)]);
  u.uRampN.value = Math.min(p.ramp.length, MAX_RAMP);
  u.uCycle.value = p.cycle;
  u.uLine.value.set(p.line);
  const c = new THREE.Color(p.line);
  u.uLineLight.value = c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.5 ? 1 : 0; // bright lines glow, dark lines are painted
  u.uMinorStrength.value = p.lineStrength;
  u.uBanding.value = 'banding' in p ? (p.banding as number) : 0;
  u.uMinor.value = 'minor' in p ? (p.minor as number) : 1;
  u.uMajor.value = 'major' in p ? (p.major as number) : 5;
  u.uMajorStrength.value = Math.min(1, p.lineStrength * 2.2);
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
