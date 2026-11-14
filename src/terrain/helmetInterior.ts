// Written with AI assistance (Claude).
// Owner: Rachel. The inside of the helmet at chin level, as real 3D objects between your eye and the visor:
// a foam microphone on a boom, white valve caps, a connector, cables, the yellow drink tube, a foam pad and the
// cream neck ring (after photos of real EVA helmets). Drawn in its own small scene after the world, so it isn't
// bent by the dome lens (it's inside the dome) and always sits in front of the terrain.
// Sways with the helmet: pass the head-sway offset each frame.

import * as THREE from 'three';

export interface HelmetInterior {
  /** Draw on top of what's already on screen. offset: head-sway offset of the helmet in CSS pixels. */
  render(renderer: THREE.WebGLRenderer, widthPx: number, heightPx: number, offset: { x: number; y: number }): void;
  dispose(): void;
}

/** Small grey noise canvas used as a bump map: foam on the mic, texture on the pad. */
function noiseTexture(size = 128, seed = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < size * size; i++) {
    const v = 90 + rand() * 120;
    img.data.set([v, v, v, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function createHelmetInterior(fovDeg = 80): HelmetInterior {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fovDeg, 1, 0.01, 5);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // Light inside the helmet: soft warm fill, a key light from above the visor, a cool bounce from below.
  scene.add(new THREE.AmbientLight('#fff4e6', 0.55));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(0.4, 1, 0.6);
  const bounce = new THREE.DirectionalLight('#9fb6d9', 0.5);
  bounce.position.set(-0.3, -1, 0.2);
  scene.add(key, bounce);

  const foam = keep(noiseTexture(128, 7));
  const whitePlastic = keep(new THREE.MeshPhysicalMaterial({ color: '#f3f0ea', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  const greyPlastic = keep(new THREE.MeshStandardMaterial({ color: '#a9a397', roughness: 0.5 }));
  const darkRubber = keep(new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.85 }));
  const micFoam = keep(new THREE.MeshStandardMaterial({ color: '#141518', roughness: 1, bumpMap: foam, bumpScale: 0.004 }));
  const metal = keep(new THREE.MeshStandardMaterial({ color: '#8f969e', roughness: 0.3, metalness: 0.9 }));
  const yellowTube = keep(new THREE.MeshPhysicalMaterial({ color: '#e3b22a', roughness: 0.35, clearcoat: 0.5, transmission: 0 }));
  const greenWire = keep(new THREE.MeshStandardMaterial({ color: '#2e8b4c', roughness: 0.55 }));
  const blackWire = keep(new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.6 }));
  const padFoam = keep(new THREE.MeshStandardMaterial({ color: '#e8dcc4', roughness: 0.95, bumpMap: foam, bumpScale: 0.003 }));
  const ringMat = keep(new THREE.MeshPhysicalMaterial({ color: '#ece4d4', roughness: 0.45, clearcoat: 0.3 }));

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(keep(geo), mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  const tube = (pts: [number, number, number][], radius: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve, 48, radius, 10, false), mat, 0, 0, 0);
  };

  // Neck ring: the front arc of a big cream ring just below the chin.
  const ring = add(new THREE.TorusGeometry(0.34, 0.035, 20, 96, Math.PI * 1.2), ringMat, 0, -0.36, -0.12);
  ring.rotation.set(Math.PI / 2 + 0.25, 0, -Math.PI * 0.1 - Math.PI);

  // Left valve cap: white disc with a rim groove and a darker centre.
  const capL = new THREE.Group();
  capL.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.036, 0.04, 0.024, 48)), whitePlastic));
  const grooveL = new THREE.Mesh(keep(new THREE.TorusGeometry(0.03, 0.0025, 8, 48)), greyPlastic);
  grooveL.rotation.x = Math.PI / 2;
  grooveL.position.y = 0.0125;
  capL.add(grooveL);
  capL.position.set(-0.2, -0.255, -0.33);
  capL.rotation.set(1.2, 0.25, 0);
  scene.add(capL);

  // Right valve knob: white with a grey hub and a metal screw.
  const capR = new THREE.Group();
  capR.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.034, 0.036, 0.03, 48)), whitePlastic));
  const hub = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.012, 0.012, 0.034, 24)), greyPlastic);
  const screw = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.036, 12)), metal);
  capR.add(hub, screw);
  capR.position.set(0.21, -0.245, -0.33);
  capR.rotation.set(1.15, -0.3, 0);
  scene.add(capR);

  // Microphone: foam capsule on a thin boom from the left.
  tube([[-0.24, -0.33, -0.24], [-0.17, -0.27, -0.27], [-0.09, -0.225, -0.3]], 0.0045, darkRubber);
  const mic = add(new THREE.CapsuleGeometry(0.02, 0.028, 8, 20), micFoam, -0.075, -0.215, -0.3);
  mic.rotation.set(0.2, 0, Math.PI / 2 - 0.35);

  // Connector block with a cable boot.
  const conn = add(new THREE.BoxGeometry(0.03, 0.02, 0.022), whitePlastic, 0.02, -0.235, -0.31);
  conn.rotation.set(0.5, 0.1, 0.05);
  add(new THREE.CylinderGeometry(0.006, 0.007, 0.018, 12), darkRubber, 0.006, -0.247, -0.305).rotation.set(0.5, 0, 1.2);

  // Cables: green and black, running down to the neck ring.
  tube([[0.006, -0.25, -0.305], [-0.02, -0.27, -0.29], [-0.06, -0.3, -0.27], [-0.12, -0.34, -0.24]], 0.0028, greenWire);
  tube([[-0.06, -0.225, -0.3], [-0.04, -0.26, -0.29], [0.0, -0.3, -0.27], [0.05, -0.35, -0.24]], 0.003, blackWire);

  // Yellow drink tube looping up from the right, and the foam pad beside it.
  tube([[0.26, -0.36, -0.22], [0.16, -0.29, -0.29], [0.09, -0.235, -0.31], [0.05, -0.245, -0.315], [0.07, -0.28, -0.3]], 0.0075, yellowTube);
  const pad = add(new THREE.BoxGeometry(0.06, 0.03, 0.03), padFoam, 0.11, -0.27, -0.32);
  pad.rotation.set(0.4, -0.2, 0.05);

  return {
    render(renderer, widthPx, heightPx, offset) {
      camera.aspect = widthPx / heightPx;
      // Shift the view by the head sway, in the same CSS pixels the helmet frame moves by.
      camera.setViewOffset(widthPx, heightPx, -offset.x, -offset.y, widthPx, heightPx);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
