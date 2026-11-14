// Written with AI assistance (Claude).
// Owner: Rachel. The path to follow: solid 3D chevrons with a little thickness, raised just above the ground and
// casting a shadow, in warm yellow so they stand apart from the blue contour lines on the ground. Spaced out, gliding
// slowly forward, fading out as you reach them; arrows you've passed are gone (setProgress). For the way home, build a
// new path from where you stand. Points: Nanda's routes (local x/z, m). The glass version is src/ui/glassPath.ts.

import * as THREE from 'three';
import type { XZ } from '../shared/coords';

export interface RoutePath {
  group: THREE.Group;
  length: number;
  /** Hides the arrows behind the walker: pass the walker's position each frame. */
  setProgress(x: number, z: number): void;
  update(timeSeconds: number): void;
  dispose(): void;
}

/** A chevron pointing along +X in its own plane, centred on the origin. inset > 0 makes an outline (shape with a hole). */
function chevron(inset = 0): THREE.Shape {
  const pts: [number, number][] = [[0.25, 0], [-0.25, 0.42], [-0.43, 0.42], [0.07, 0], [-0.43, -0.42], [-0.25, -0.42]];
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  if (inset > 0) {
    const k = 1 - inset;
    s.holes.push(new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x * k - 0.03, y * k))));
  }
  return s;
}

export function createRoutePath(
  points: XZ[],
  heightAt: (x: number, z: number) => number,
  opts: { spacing?: number; color?: string; hover?: number; speed?: number } = {},
): RoutePath {
  const spacing = opts.spacing ?? 6;
  const hover = opts.hover ?? 0.12; // raised a little: clearly off the ground, not floating
  const speed = opts.speed ?? 0.7;
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
  const length = curve.getLength();

  const steps = Math.max(2, Math.ceil(length * 4));
  const table = curve.getSpacedPoints(steps);
  const sample = (s: number, out: THREE.Vector3) => {
    const f = Math.min(steps - 1, Math.max(0, (s / length) * steps));
    const i = Math.floor(f);
    out.lerpVectors(table[i], table[i + 1], f - i);
    const a = table[Math.max(0, i - 1)], b = table[Math.min(steps, i + 2)];
    return Math.atan2(-(b.z - a.z), b.x - a.x);
  };

  // A chevron 5 cm thick with softly rounded edges, lying flat.
  const geo = new THREE.ExtrudeGeometry(chevron(), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);

  const count = Math.floor(length / spacing) + 1;
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  geo.setAttribute('aFade', fade);
  const warm = opts.color ?? '#ffc93c'; // warm yellow: stands apart from the blue contours and the ground colours
  const material = new THREE.MeshStandardMaterial({
    color: warm,
    emissive: warm,
    emissiveIntensity: 0.45, // a soft glow so they read in shadow too
    roughness: 0.45,
    metalness: 0.05,
    transparent: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = aFade;');
    shader.fragmentShader = 'varying float vFade;\n' +
      shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vFade;');
  };
  const arrows = new THREE.InstancedMesh(geo, material, count);
  arrows.frustumCulled = false;
  arrows.castShadow = true; // the shadow underneath shows they stand off the ground

  const group = new THREE.Group();
  group.name = 'route-path';
  group.add(arrows);

  let walked = -10;
  const walker = new THREE.Vector3(Infinity, 0, Infinity);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  return {
    group,
    length,
    setProgress(x, z) {
      walker.set(x, 0, z);
      let best = Infinity, bestI = -1;
      for (let i = 0; i <= steps; i++) {
        const dx = table[i].x - x, dz = table[i].z - z;
        const d = dx * dx + dz * dz;
        if (d < best) {
          best = d;
          bestI = i;
        }
      }
      if (best < 15 * 15) walked = (bestI / steps) * length;
    },
    update(t) {
      const glide = (t * speed) % spacing;
      for (let i = 0; i < count; i++) {
        const s = i * spacing + glide;
        // fades from 6 m before you reach it down to nothing as you pass over it, and out in the distance
        const near = Math.min(1, Math.max(0, (s - walked) / 6));
        const yaw = sample(Math.min(s, length), pos);
        const dist = Math.hypot(pos.x - walker.x, pos.z - walker.z);
        const far = 1 - Math.min(1, Math.max(0, (dist - 120) / 80));
        const f = near * near * (3 - 2 * near) * far;
        if (s > length || f < 0.01) {
          arrows.setMatrixAt(i, hidden);
          continue;
        }
        pos.y = heightAt(pos.x, pos.z) + hover + Math.sin(t * 1.6 + i * 0.9) * 0.015;
        q.setFromAxisAngle(up, yaw);
        scale.setScalar(0.85 + 0.15 * f);
        m.compose(pos, q, scale);
        arrows.setMatrixAt(i, m);
        fade.setX(i, f);
      }
      arrows.instanceMatrix.needsUpdate = true;
      fade.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      material.dispose();
      arrows.dispose();
    },
  };
}
