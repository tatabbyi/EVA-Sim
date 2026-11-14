// Written with AI assistance (Claude).
// Owner: Rachel. Waypoint beacon: a tall light pillar standing on the terrain (the tall marker in the whiteboard sketch),
// visible from far away in Walk mode, with a ground ring so you can judge where it touches down.

import * as THREE from 'three';
import { palette } from '../ui/palette';

export interface Beacon {
  group: THREE.Group;
  setColor(hex: string): void;
  update(timeSeconds: number): void;
  dispose(): void;
}

const beamVertex = /* glsl */ `
varying float vH;
void main() {
  vH = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vH;
void main() {
  float fade = pow(1.0 - vH, 1.6);                         // bright at the ground, gone at the top
  float pulse = 0.75 + 0.25 * sin(uTime * 2.4 - vH * 9.0); // slow upward ripple
  gl_FragColor = vec4(uColor, fade * pulse * 0.85);
  #include <colorspace_fragment>
}
`;

export function createWaypointBeacon(opts: { height?: number; radius?: number; color?: string } = {}): Beacon {
  const height = opts.height ?? 30;
  const radius = opts.radius ?? 0.05; // a thin AR marker line, not a light pillar
  const uniforms = { uColor: { value: new THREE.Color(opts.color ?? palette.ar) }, uTime: { value: 0 } };

  const beamGeo = new THREE.CylinderGeometry(radius, radius, height, 24, 1, true);
  beamGeo.translate(0, height / 2, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const ringGeo = new THREE.RingGeometry(0.55, 0.6, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: uniforms.uColor.value,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  group.name = 'waypoint-beacon';
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.05; // just above the ground to avoid z-fighting
  group.add(new THREE.Mesh(beamGeo, beamMat), ring);

  return {
    group,
    setColor(hex) {
      uniforms.uColor.value.set(hex);
      ringMat.color.set(hex);
    },
    update(t) {
      uniforms.uTime.value = t;
      ring.scale.setScalar(1 + 0.08 * Math.sin(t * 2.4));
    },
    dispose() {
      beamGeo.dispose();
      beamMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
