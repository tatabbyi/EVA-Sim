// Written with AI assistance (Claude).
// Owner: Rachel. The path you can follow: solid 3D yellow chevrons hovering above the terrain, spaced out along the
// route, gliding slowly forward and bobbing, each with a soft shadow on the ground. Arrows you've already passed
// disappear (setProgress), so the path always shows the way ahead. For the way home, build a new path from where you stand.
// Points come from Nanda's routes (local x/z, metres).

import * as THREE from 'three';
import type { XZ } from '../shared/coords';
import { palette } from '../ui/palette';

export interface RoutePath {
  group: THREE.Group;
  /** Total length in metres. */
  length: number;
  /** Hides the arrows behind the walker: pass the walker's position each frame. */
  setProgress(x: number, z: number): void;
  update(timeSeconds: number): void;
  dispose(): void;
}

/** A chevron pointing along +X, lying flat in the XZ plane, centred on the origin. */
function chevronShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0);
  s.lineTo(-0.25, 0.42);
  s.lineTo(-0.43, 0.42);
  s.lineTo(0.07, 0);
  s.lineTo(-0.43, -0.42);
  s.lineTo(-0.25, -0.42);
  s.closePath();
  return s;
}

export function createRoutePath(
  points: XZ[],
  heightAt: (x: number, z: number) => number,
  opts: { spacing?: number; color?: string; hover?: number; speed?: number } = {},
): RoutePath {
  const spacing = opts.spacing ?? 6; // metres between arrows
  const hover = opts.hover ?? 0.35; // metres above the ground
  const speed = opts.speed ?? 0.7; // m/s the arrows glide forward
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
  const length = curve.getLength();

  // Lookup table every 25 cm: fast position + direction at any distance along the path.
  const steps = Math.max(2, Math.ceil(length * 4));
  const table = curve.getSpacedPoints(steps);
  const sample = (s: number, outPos: THREE.Vector3) => {
    const f = Math.min(steps - 1, Math.max(0, (s / length) * steps));
    const i = Math.floor(f);
    outPos.lerpVectors(table[i], table[i + 1], f - i);
    const a = table[Math.max(0, i - 1)], b = table[Math.min(steps, i + 2)];
    return Math.atan2(-(b.z - a.z), b.x - a.x); // yaw that turns +X towards the direction of travel
  };

  const arrowGeo = new THREE.ExtrudeGeometry(chevronShape(), {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 2,
  });
  arrowGeo.rotateX(-Math.PI / 2); // lie flat, thickness pointing up
  arrowGeo.center();
  const shadowGeo = new THREE.ShapeGeometry(chevronShape());
  shadowGeo.rotateX(-Math.PI / 2);

  const color = new THREE.Color(opts.color ?? palette.objective);
  const arrowMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.15,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const count = Math.floor(length / spacing) + 1;

  // Per-arrow fade (0 to 1): arrows fade out as you reach them instead of vanishing.
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  arrowGeo.setAttribute('aFade', fade);
  shadowGeo.setAttribute('aFade', fade);
  const fadeable = (mat: THREE.Material) => {
    mat.transparent = true;
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = aFade;');
      shader.fragmentShader = 'varying float vFade;\n' +
        shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vFade;');
    };
  };
  fadeable(arrowMat);
  fadeable(shadowMat);
  const arrows = new THREE.InstancedMesh(arrowGeo, arrowMat, count);
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, count);
  arrows.frustumCulled = shadows.frustumCulled = false;
  shadows.renderOrder = 1;

  const group = new THREE.Group();
  group.name = 'route-path';
  group.add(shadows, arrows);

  let walked = -10; // metres along the path already walked
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
      if (best < 15 * 15) walked = (bestI / steps) * length; // ignored if you've wandered off the path
    },
    update(t) {
      const glide = (t * speed) % spacing;
      for (let i = 0; i < count; i++) {
        const s = i * spacing + glide;
        // Fades from 6 m before you reach it down to nothing as you pass over it.
        const near = Math.min(1, Math.max(0, (s - walked) / 6));
        const f = near * near * (3 - 2 * near);
        if (s > length || f < 0.01) {
          arrows.setMatrixAt(i, hidden);
          shadows.setMatrixAt(i, hidden);
          continue;
        }
        const yaw = sample(s, pos);
        const ground = heightAt(pos.x, pos.z);
        const dist = Math.hypot(pos.x - walker.x, pos.z - walker.z);
        // Grow in from nothing near the far end of view, so they don't pop.
        const k = dist > 260 ? 0 : 1 - Math.max(0, (dist - 200) / 60);
        q.setFromAxisAngle(up, yaw);
        scale.setScalar(k * (0.75 + 0.25 * f));
        fade.setX(i, f);
        pos.y = ground + hover + Math.sin(t * 2 + i * 0.9) * 0.05;
        arrows.setMatrixAt(i, m.compose(pos, q, scale));
        pos.y = ground + 0.03;
        shadows.setMatrixAt(i, m.compose(pos, q, scale));
      }
      arrows.instanceMatrix.needsUpdate = true;
      fade.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      arrowGeo.dispose();
      shadowGeo.dispose();
      arrowMat.dispose();
      shadowMat.dispose();
    },
  };
}
