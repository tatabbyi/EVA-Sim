// Written with AI assistance (Claude).
// Owner: Rachel. Real sun shadows from the base, rocks, tools and hands onto the ground.
// The terrain has its own shader (it lights itself), so shadows land on a "catcher": a patch of the same terrain
// triangles around you, drawn just on top with a material that only shows shadow. The patch and the sun's shadow
// camera both follow you, so shadows work anywhere you roam.

import * as THREE from 'three';

export interface SunShadows {
  catcher: THREE.Mesh;
  /** Call every frame with where you stand and the direction towards the sun. */
  update(at: THREE.Vector3, sunDir: THREE.Vector3): void;
  dispose(): void;
}

/**
 * terrainGeo: the terrain PlaneGeometry (rotated flat, row 0 at the north edge), segments cells a side, size metres a side.
 * Shares its vertices; only a small index of the triangles near you is kept.
 */
export function createSunShadows(
  renderer: THREE.WebGLRenderer,
  sun: THREE.DirectionalLight,
  terrainGeo: THREE.BufferGeometry,
  segments: number,
  size: number,
  opts: { reach?: number; mapSize?: number; patch?: number; darkness?: number } = {},
): SunShadows {
  const reach = opts.reach ?? 40; // shadows drawn within this many metres of you
  const mapSize = opts.mapSize ?? 2048;
  const patch = opts.patch ?? 64; // catcher half-width, m

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // soft edges come from shadow.radius
  sun.castShadow = true;
  sun.shadow.mapSize.set(mapSize, mapSize);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -reach;
  cam.right = cam.top = reach;
  cam.near = 1;
  cam.far = 400;
  cam.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;

  // Catcher: same vertices as the terrain, so it lies exactly on it.
  const cell = size / segments, n1 = segments + 1, half = size / 2;
  const cellsAcross = Math.ceil((2 * patch) / cell) + 2;
  const index = new THREE.BufferAttribute(new Uint32Array(cellsAcross * cellsAcross * 6), 1);
  index.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', terrainGeo.getAttribute('position'));
  geo.setAttribute('normal', terrainGeo.getAttribute('normal'));
  geo.setIndex(index);
  geo.setDrawRange(0, 0);
  const material = new THREE.ShadowMaterial({
    color: '#1c0f09', // shadows on Mars are lit by the dusty sky: deep brown, not black
    opacity: opts.darkness ?? 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const catcher = new THREE.Mesh(geo, material);
  catcher.receiveShadow = true;
  catcher.frustumCulled = false;
  catcher.renderOrder = 1;
  catcher.name = 'shadow-catcher';

  let cx = NaN, cz = NaN;
  const clampI = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const rebuild = (x: number, z: number) => {
    const c0 = clampI(Math.floor((x - patch + half) / cell), 0, segments), c1 = clampI(Math.ceil((x + patch + half) / cell), 0, segments);
    const r0 = clampI(Math.floor((z - patch + half) / cell), 0, segments), r1 = clampI(Math.ceil((z + patch + half) / cell), 0, segments);
    const arr = index.array as Uint32Array;
    let k = 0;
    for (let iy = r0; iy < r1; iy++) {
      for (let ix = c0; ix < c1; ix++) {
        // Same triangle split as THREE.PlaneGeometry
        const a = ix + n1 * iy, b = ix + n1 * (iy + 1), c = ix + 1 + n1 * (iy + 1), d = ix + 1 + n1 * iy;
        arr[k++] = a;
        arr[k++] = b;
        arr[k++] = d;
        arr[k++] = b;
        arr[k++] = c;
        arr[k++] = d;
      }
    }
    index.needsUpdate = true;
    geo.setDrawRange(0, k);
  };

  // The shadow camera follows you, snapped to whole shadow-map texels so edges don't crawl as you walk.
  const right = new THREE.Vector3(), up = new THREE.Vector3(), dir = new THREE.Vector3(), centre = new THREE.Vector3();
  const texel = (2 * reach) / mapSize;

  return {
    catcher,
    update(at, sunDir) {
      if (!(Math.abs(at.x - cx) < patch * 0.4 && Math.abs(at.z - cz) < patch * 0.4)) {
        cx = at.x;
        cz = at.z;
        rebuild(cx, cz);
      }
      dir.copy(sunDir).normalize();
      right.crossVectors(THREE.Object3D.DEFAULT_UP, dir).normalize();
      up.crossVectors(dir, right);
      const a = Math.round(at.dot(right) / texel) * texel;
      const b = Math.round(at.dot(up) / texel) * texel;
      const c = at.dot(dir);
      centre.copy(right).multiplyScalar(a).addScaledVector(up, b).addScaledVector(dir, c);
      sun.target.position.copy(centre);
      sun.position.copy(centre).addScaledVector(dir, 150);
      sun.target.updateMatrixWorld();
    },
    dispose() {
      // The position and normal buffers belong to the terrain: only drop the index and the material.
      geo.setIndex(null);
      material.dispose();
    },
  };
}
