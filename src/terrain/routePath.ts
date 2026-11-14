// Written with AI assistance (Claude).
// Owner: Rachel. The path you can follow: yellow arrows floating a little above the terrain, flowing forward,
// with a soft shadow on the ground beneath them so they read as raised. No outline. They fade out with distance
// and right at your feet. Points come from Nanda's routes (local x/z, metres).

import * as THREE from 'three';
import type { XZ } from '../shared/coords';
import { palette } from '../ui/palette';

export interface RoutePath {
  group: THREE.Group;
  update(timeSeconds: number): void;
  dispose(): void;
}

const routeVertex = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDist = distance(cameraPosition, wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const routeFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uGlow;     // 1 for the arrows, 0 for their shadow
uniform float uTime;
uniform float uSpacing;  // metres between arrows
uniform float uFadeNear;
uniform float uFadeFar;
varying vec2 vUv;        // x = metres along the path, y = 0..1 across it
varying float vDist;
void main() {
  float side = abs(vUv.y - 0.5) * 2.0; // 0 centre, 1 edge
  // Chevrons pointing forward, flowing in the direction of travel.
  float s = fract(vUv.x / uSpacing + side * 0.35 - uTime * 0.6);
  float chev = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.16, 0.22, s)) * (1.0 - smoothstep(0.82, 0.98, side));
  float a = chev * uOpacity;
  a *= (1.0 - smoothstep(uFadeNear, uFadeFar, vDist)) * smoothstep(0.8, 3.5, vDist);
  gl_FragColor = vec4(uColor * (1.0 + 0.5 * uGlow), a);
  #include <colorspace_fragment>
}
`;

function buildRibbon(curve: THREE.CatmullRomCurve3, heightAt: (x: number, z: number) => number, width: number, lift: number) {
  const length = curve.getLength();
  const n = Math.max(2, Math.ceil(length));
  const centres = curve.getSpacedPoints(n);
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  const tangent = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const c = centres[i];
    tangent.subVectors(centres[Math.min(n, i + 1)], centres[Math.max(0, i - 1)]).setY(0).normalize();
    const sx = -tangent.z * (width / 2), sz = tangent.x * (width / 2);
    const along = (i / n) * length;
    for (let k = 0; k < 2; k++) {
      const x = c.x + (k === 0 ? -sx : sx), z = c.z + (k === 0 ? -sz : sz);
      pos.set([x, heightAt(x, z) + lift, z], (i * 2 + k) * 3);
      uv.set([along, k], (i * 2 + k) * 2);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    index.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * points: the route in the local frame. heightAt: ground height there (Victor's heightAt, or a grid sampler).
 * The ribbons are resampled every metre so they follow the ground.
 */
export function createRoutePath(
  points: XZ[],
  heightAt: (x: number, z: number) => number,
  opts: { width?: number; color?: string; raise?: number } = {},
): RoutePath {
  const width = opts.width ?? 1.1;
  const raise = opts.raise ?? 0.22; // how far the arrows float above the ground, metres
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');

  const time = { value: 0 };
  const makeMaterial = (color: string, opacity: number, glow: number) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
        uGlow: { value: glow },
        uTime: time,
        uSpacing: { value: 2.2 },
        uFadeNear: { value: 60 },
        uFadeFar: { value: 220 },
      },
      vertexShader: routeVertex,
      fragmentShader: routeFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

  const shadowGeo = buildRibbon(curve, heightAt, width, 0.03);
  const arrowGeo = buildRibbon(curve, heightAt, width, raise);
  const shadowMat = makeMaterial('#000000', 0.35, 0);
  const arrowMat = makeMaterial(opts.color ?? palette.objective, 0.95, 1);

  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  const arrows = new THREE.Mesh(arrowGeo, arrowMat);
  shadow.renderOrder = 1;
  arrows.renderOrder = 2;

  const group = new THREE.Group();
  group.name = 'route-path';
  group.add(shadow, arrows);

  return {
    group,
    update(t) {
      time.value = t;
    },
    dispose() {
      shadowGeo.dispose();
      arrowGeo.dispose();
      shadowMat.dispose();
      arrowMat.dispose();
    },
  };
}
