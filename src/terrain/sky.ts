// Written with AI assistance (Claude).
// Owner: Rachel. Starry night sky: thousands of stars with realistic colours and brightness spread
// (many faint, few bright), a denser Milky Way band, and Earth as a pale blue point.
// The sky follows the camera, so it always looks infinitely far away.

import * as THREE from 'three';

export interface StarrySky {
  group: THREE.Group;
  /** Call every frame: keeps the sky centred on the camera and animates the faint twinkle. */
  update(camera: THREE.Camera, timeSeconds: number): void;
  setPixelRatio(pixelRatio: number): void;
  dispose(): void;
}

export interface StarrySkyOptions {
  fieldStars?: number;
  bandStars?: number;
  radius?: number; // must be inside the camera's far plane
  seed?: number;
  earthDirection?: THREE.Vector3 | null; // local frame, x east, y up, z south
}

// Star colours by temperature, hot to cool, with how common each is among visible stars.
const STAR_COLOURS: [string, number][] = [
  ['#9bb0ff', 0.12], // blue-white
  ['#cad7ff', 0.18],
  ['#ffffff', 0.3],
  ['#fff4e8', 0.2],
  ['#ffd2a1', 0.13], // yellow
  ['#ffb56c', 0.07], // orange
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aIntensity;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vIntensity;
void main() {
  vColor = aColor;
  // Mars has a thin atmosphere, so only a very faint twinkle.
  vIntensity = aIntensity * (0.9 + 0.1 * sin(uTime * (0.6 + aPhase) + aPhase * 12.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vIntensity;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vColor, core * core * vIntensity);
  #include <colorspace_fragment>
}
`;

export function createStarrySky(opts: StarrySkyOptions = {}): StarrySky {
  const fieldStars = opts.fieldStars ?? 7000;
  const bandStars = opts.bandStars ?? 6000;
  const radius = opts.radius ?? 5000;
  const rand = mulberry32(opts.seed ?? 1977);
  const total = fieldStars + bandStars + 1; // +1 for Earth

  const positions = new Float32Array(total * 3);
  const colours = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const intensities = new Float32Array(total);
  const phases = new Float32Array(total);

  const pickColour = () => {
    let u = rand();
    for (const [hex, weight] of STAR_COLOURS) {
      if ((u -= weight) <= 0) return new THREE.Color(hex);
    }
    return new THREE.Color('#ffffff');
  };

  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

  // Milky Way: a great circle tilted across the sky.
  const bandNormal = new THREE.Vector3(0.35, 0.55, 0.76).normalize();
  const bandA = new THREE.Vector3(1, 0, 0).cross(bandNormal).normalize();
  const bandB = bandNormal.clone().cross(bandA).normalize();

  const dir = new THREE.Vector3();
  for (let i = 0; i < total - 1; i++) {
    if (i < fieldStars) {
      const z = 2 * rand() - 1;
      const phi = 2 * Math.PI * rand();
      const s = Math.sqrt(1 - z * z);
      dir.set(s * Math.cos(phi), z, s * Math.sin(phi));
    } else {
      const theta = 2 * Math.PI * rand();
      dir
        .copy(bandA)
        .multiplyScalar(Math.cos(theta))
        .addScaledVector(bandB, Math.sin(theta))
        .addScaledVector(bandNormal, gauss() * 0.12)
        .normalize();
    }
    dir.multiplyScalar(radius).toArray(positions, i * 3);

    // Brightness: most stars faint, a few bright (steep power law, like real magnitudes).
    const bright = Math.pow(rand(), i < fieldStars ? 5 : 8);
    sizes[i] = 1.1 + 3.2 * bright;
    intensities[i] = 0.25 + 0.75 * Math.pow(bright, 0.5);
    phases[i] = rand();
    pickColour().toArray(colours, i * 3);
  }

  // Earth: brightest point in the sky, pale blue.
  const e = total - 1;
  const earth = (opts.earthDirection ?? new THREE.Vector3(-0.55, 0.32, -0.77)).clone().normalize();
  earth.multiplyScalar(radius).toArray(positions, e * 3);
  new THREE.Color('#a8d0ff').toArray(colours, e * 3);
  sizes[e] = 5.5;
  intensities[e] = 1;
  phases[e] = 0;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aIntensity', new THREE.BufferAttribute(intensities, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const uniforms = { uTime: { value: 0 }, uPixelRatio: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -1;

  const group = new THREE.Group();
  group.name = 'starry-sky';
  group.add(points);

  return {
    group,
    update(camera, t) {
      group.position.copy(camera.position);
      uniforms.uTime.value = t;
    },
    setPixelRatio(pr) {
      uniforms.uPixelRatio.value = pr;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
