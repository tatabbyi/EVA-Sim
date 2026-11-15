// Written with AI assistance (Claude).
// Owner: Rachel. The inside of the helmet at chin level, as real 3D objects between your eye and the visor:
// a foam microphone on a boom, white valve caps, a connector, cables, the yellow drink tube, a foam pad and the
// cream neck ring (after photos of real EVA helmets). It has its own transparent canvas inside the helmet layer,
// above the visor seal and fabric (it is physically closer to your face than they are) and below the HUD text.
// It moves with the helmet because that layer sways, so it only redraws when the size changes.

import * as THREE from 'three';
import { createFabricTexture, createNoiseTexture } from './noiseTexture';

export interface HelmetInterior {
  /** Redraws only if the host changed size; cheap to call every frame. */
  render(): void;
  /** A copy of the hardware and neck ring for the headset (src/xr/vrWorld.ts): same models, in head space (eye at the
   *  origin, looking down -z), with its own small warm light. Shares geometry and materials with this one. */
  vrKit(): THREE.Group;
  dispose(): void;
}

/** host: the helmet's interior slot (HelmetHud interiorRef). */
export function createHelmetInterior(host: HTMLElement, fovDeg = 80): HelmetInterior {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  const kit = new THREE.Group(); // everything except the neck ring; raised so it sits just above the visor seal
  scene.add(kit);
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

  const foam = keep(createNoiseTexture(128, 7));
  const whitePlastic = keep(new THREE.MeshPhysicalMaterial({ color: '#f3f0ea', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  const greyPlastic = keep(new THREE.MeshStandardMaterial({ color: '#a9a397', roughness: 0.5 }));
  const darkRubber = keep(new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.85 }));
  const micFoam = keep(new THREE.MeshStandardMaterial({ color: '#141518', roughness: 1, bumpMap: foam, bumpScale: 0.004 }));
  const metal = keep(new THREE.MeshStandardMaterial({ color: '#8f969e', roughness: 0.3, metalness: 0.9 }));
  // Neutral like the rest of the suit hardware: a clear-white drink tube and a dark grey mic lead.
  const drinkTube = keep(new THREE.MeshPhysicalMaterial({ color: '#dfe2e4', roughness: 0.3, clearcoat: 0.6, transmission: 0 }));
  const micWire = keep(new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.55 }));
  const blackWire = keep(new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.6 }));
  const padFoam = keep(new THREE.MeshStandardMaterial({ color: '#e8dcc4', roughness: 0.95, bumpMap: foam, bumpScale: 0.003 }));
  const collarCloth = keep(createFabricTexture('#e7e0d2', 0.25, 256, 13, 6));
  const ringMat = keep(new THREE.MeshStandardMaterial({ map: collarCloth, roughness: 0.92 }));

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = kit) => {
    const mesh = new THREE.Mesh(keep(geo), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const tube = (pts: [number, number, number][], radius: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve, 48, radius, 10, false), mat, 0, 0, 0);
  };

  // Suit collar: a padded cream fabric ring just below the chin; the hardware below sits in it.
  const ring = add(new THREE.TorusGeometry(0.36, 0.065, 24, 128), ringMat, 0, -0.43, -0.1, scene); // a full ring: no cut ends
  ring.rotation.set(Math.PI / 2 + 0.25, 0, -Math.PI * 0.1 - Math.PI);

  // Left valve cap: white disc with a rim groove and a darker centre.
  const capL = new THREE.Group();
  capL.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.036, 0.04, 0.024, 48)), whitePlastic));
  const grooveL = new THREE.Mesh(keep(new THREE.TorusGeometry(0.03, 0.0025, 8, 48)), greyPlastic);
  grooveL.rotation.x = Math.PI / 2;
  grooveL.position.y = 0.0125;
  capL.add(grooveL);
  capL.position.set(-0.26, -0.255, -0.33);
  capL.rotation.set(1.2, 0.25, 0);
  kit.add(capL);

  // Right valve knob: white with a grey hub and a metal screw.
  const capR = new THREE.Group();
  capR.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.034, 0.036, 0.03, 48)), whitePlastic));
  const hub = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.012, 0.012, 0.034, 24)), greyPlastic);
  const screw = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.036, 12)), metal);
  capR.add(hub, screw);
  capR.position.set(0.27, -0.245, -0.33);
  capR.rotation.set(1.15, -0.3, 0);
  kit.add(capR);

  // Microphone: foam capsule on a thin boom from the left.
  tube([[-0.32, -0.6, -0.1], [-0.24, -0.33, -0.24], [-0.17, -0.27, -0.27], [-0.09, -0.225, -0.3]], 0.0045, darkRubber);
  const mic = add(new THREE.CapsuleGeometry(0.02, 0.028, 8, 20), micFoam, -0.075, -0.215, -0.3);
  mic.rotation.set(0.2, 0, Math.PI / 2 - 0.35);

  // Connector block with a cable boot.
  const conn = add(new THREE.BoxGeometry(0.03, 0.02, 0.022), whitePlastic, 0.02, -0.235, -0.31);
  conn.rotation.set(0.5, 0.1, 0.05);
  add(new THREE.CylinderGeometry(0.006, 0.007, 0.018, 12), darkRubber, 0.006, -0.247, -0.305).rotation.set(0.5, 0, 1.2);

  // Cables: green and black, running down to the neck ring.
  tube([[0.006, -0.25, -0.305], [-0.02, -0.27, -0.29], [-0.06, -0.3, -0.27], [-0.12, -0.34, -0.24], [-0.17, -0.6, -0.1]], 0.0028, micWire);
  tube([[-0.06, -0.225, -0.3], [-0.04, -0.26, -0.29], [0.0, -0.3, -0.27], [0.05, -0.35, -0.24], [0.09, -0.6, -0.1]], 0.003, blackWire);

  // Yellow drink tube looping up from the right, and the foam pad beside it.
  tube([[0.32, -0.62, -0.1], [0.26, -0.36, -0.22], [0.16, -0.29, -0.29], [0.09, -0.235, -0.31], [0.05, -0.245, -0.315], [0.07, -0.28, -0.3]], 0.0075, drinkTube);
  const pad = add(new THREE.BoxGeometry(0.06, 0.03, 0.03), padFoam, 0.11, -0.27, -0.32);
  pad.rotation.set(0.4, -0.2, 0.05);

  // Shrink the hardware about its own centre (so cables stay attached) and sit it on the visor seal, in front of
  // the chin: small, low and to the sides, like in a real helmet, not filling the view.
  const anchor = new THREE.Vector3(0, -0.225, -0.31);
  for (const child of kit.children) child.position.sub(anchor);
  kit.position.copy(anchor).add(new THREE.Vector3(0, 0.035, 0));
  kit.scale.setScalar(0.6);
  ring.position.y -= 0.03; // only the top of the neck ring peeks in at the very bottom
  let lastW = 0, lastH = 0;

  return {
    vrKit() {
      const g = new THREE.Group();
      const light = new THREE.PointLight('#fff4e6', 0.8, 0.9); // inside the helmet only: fades out within 0.9 m
      light.position.set(0, 0.1, 0);
      g.add(kit.clone(), ring.clone(), light);
      return g;
    },
    render() {
      // The slot reaches past the helmet layer (HelmetHud.css .hud-interior), so when you look down or to the side
      // and the helmet slides, the hardware never ends at an edge. The view stays set up for the helmet layer itself,
      // widened to the slot, so the hardware sits in the same place on the glass.
      const layer = host.parentElement;
      const w = host.clientWidth, h = host.clientHeight;
      if (!layer || (w === lastW && h === lastH)) return;
      lastW = w;
      lastH = h;
      const lw = layer.clientWidth, lh = layer.clientHeight;
      if (!lw || !lh || !w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = lw / lh;
      camera.setViewOffset(lw, lh, host.getBoundingClientRect().left - layer.getBoundingClientRect().left, 0, w, h); // slot starts left of the layer
      renderer.render(scene, camera);
    },
    dispose() {
      for (const d of disposables) d.dispose();
      renderer.dispose();
      host.replaceChildren();
    },
  };
}
