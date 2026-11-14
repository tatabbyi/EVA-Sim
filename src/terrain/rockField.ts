// Written with AI assistance (Claude).
// Owner: Rachel. Loose rocks on the ground around you, like the Jezero crater floor in Perseverance's images:
// lots of pebbles, fewer fist-to-knee sized rocks, a few boulders. Angular, chipped shapes (dark basalt with a
// coat of red dust on their tops), half sunk into the ground. Placed per tile from a fixed seed, so the same rock
// is always in the same place; only tiles near you are filled, and they refill as you walk (free roam anywhere).

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export interface RockField {
  group: THREE.Group;
  /** Call every frame with where you stand; refills tiles only when you cross into a new one. */
  update(x: number, z: number): void;
  dispose(): void;
}

interface Layer {
  tile: number; // m
  radius: number; // filled out to this distance, m
  perTile: number;
  chance: number; // chance each slot gets a rock
  min: number; // size range, m (radius before squashing)
  max: number;
  detail: number;
  variants: number;
  shadows: boolean;
}

const LAYERS: Layer[] = [
  { tile: 6, radius: 34, perTile: 12, chance: 0.8, min: 0.03, max: 0.11, detail: 1, variants: 3, shadows: false }, // pebbles
  { tile: 14, radius: 80, perTile: 4, chance: 0.7, min: 0.1, max: 0.38, detail: 1, variants: 3, shadows: true }, // rocks
  { tile: 40, radius: 240, perTile: 1, chance: 0.5, min: 0.45, max: 1.4, detail: 2, variants: 2, shadows: true }, // boulders
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
const tileSeed = (ix: number, iz: number, layer: number) => (Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663) ^ Math.imul(layer + 1, 83492791)) >>> 0;

/** An angular rock about 1 m across (scaled per instance): a sphere chipped by random flat cuts, squashed. */
function rockShape(seed: number, detail: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const geo = mergeVertices(ico);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const cuts = Array.from({ length: 6 }, () => ({
    n: new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(),
    d: 0.55 + rand() * 0.35,
  }));
  const sx = 0.8 + rand() * 0.45, sy = 0.45 + rand() * 0.25, sz = 0.7 + rand() * 0.4;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).multiplyScalar(0.9 + rand() * 0.2);
    for (const c of cuts) {
      const k = v.dot(c.n);
      if (k > c.d) v.addScaledVector(c.n, c.d - k); // flat broken faces
    }
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  geo.computeVertexNormals();
  // Dust settles on the tops: colour by how much each point faces up.
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const colours = new Float32Array(pos.count * 3);
  const rock = new THREE.Color('#4a3a30'), dust = new THREE.Color('#a4785a'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const up = THREE.MathUtils.smoothstep(nrm.getY(i), 0.2, 0.85);
    c.copy(rock).lerp(dust, up * (0.65 + rand() * 0.35)).toArray(colours, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geo;
}

/**
 * heightAt: ground height. keepClear(x, z, r): true where a rock of radius r must not go (the path, the base, objectives).
 */
export function createRockField(heightAt: (x: number, z: number) => number, keepClear: (x: number, z: number, r: number) => boolean): RockField {
  const group = new THREE.Group();
  group.name = 'rock-field';
  const disposables: { dispose(): void }[] = [];
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
  disposables.push(material);

  const layers = LAYERS.map((L, li) => {
    const span = Math.ceil(L.radius / L.tile);
    const capacity = Math.ceil((2 * span + 1) ** 2 * L.perTile);
    const meshes = Array.from({ length: L.variants }, (_, v) => {
      const geo = rockShape(1000 + li * 17 + v * 101, L.detail);
      const mesh = new THREE.InstancedMesh(geo, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      mesh.count = 0;
      mesh.frustumCulled = false; // always around you
      mesh.castShadow = L.shadows;
      mesh.receiveShadow = true;
      group.add(mesh);
      disposables.push(geo, mesh);
      return mesh;
    });
    return { L, li, span, meshes, tx: NaN, tz: NaN };
  });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const tint = new THREE.Color();

  const fill = (layer: (typeof layers)[number], x: number, z: number) => {
    const { L, li, span, meshes } = layer;
    const counts = meshes.map(() => 0);
    const r2 = L.radius * L.radius;
    for (let iz = layer.tz - span; iz <= layer.tz + span; iz++) {
      for (let ix = layer.tx - span; ix <= layer.tx + span; ix++) {
        const rand = mulberry32(tileSeed(ix, iz, li));
        for (let k = 0; k < L.perTile; k++) {
          // Draw every random number first, so a rock never changes when its neighbours are skipped.
          const keep = rand() < L.chance;
          const rx = (ix + rand()) * L.tile, rz = (iz + rand()) * L.tile;
          const size = L.min * Math.pow(L.max / L.min, Math.pow(rand(), 1.8)); // mostly small, a few big
          const yaw = rand() * Math.PI * 2, tiltX = (rand() - 0.5) * 0.5, tiltZ = (rand() - 0.5) * 0.5;
          const variant = Math.floor(rand() * meshes.length);
          const shade = 0.72 + rand() * 0.4;
          if (!keep || (rx - x) ** 2 + (rz - z) ** 2 > r2 || keepClear(rx, rz, size)) continue;
          p.set(rx, heightAt(rx, rz) - size * 0.22, rz); // sunk a little into the dust
          q.setFromEuler(e.set(tiltX, yaw, tiltZ));
          sc.setScalar(size);
          const mesh = meshes[variant];
          const i = counts[variant]++;
          mesh.setMatrixAt(i, m.compose(p, q, sc));
          mesh.setColorAt(i, tint.setRGB(shade, shade * 0.98, shade * 0.96));
        }
      }
    }
    meshes.forEach((mesh, v) => {
      mesh.count = counts[v];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  };

  return {
    group,
    update(x, z) {
      for (const layer of layers) {
        const tx = Math.floor(x / layer.L.tile), tz = Math.floor(z / layer.L.tile);
        if (tx === layer.tx && tz === layer.tz) continue;
        layer.tx = tx;
        layer.tz = tz;
        fill(layer, x, z);
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
