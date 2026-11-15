// Written with AI assistance (Claude). Owner: Nanda. The parts of the game the desktop draws on the PAGE (so a headset
// can't show them), rebuilt in 3D for VR from the same inputs:
//   fixed to your head   helmet hardware and neck ring (helmetInterior.ts), the visor rim, visor fog and the breath
//                        puff (the same fog value and breathing as the desktop), the aiming dot indoors
//   in the world         the AR target marker over the next objective / airlock ("TAKE A CORE · 42 M", as on the
//                        glass), and the "on the glass" path: the planned route 160 m ahead as a glowing line of
//                        constant width that hills never hide (the desktop glassPath.ts; O / the console switches it)
// The 3D route arrows (routePath.ts) are already in the scene and show in VR as they are.

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { palette } from '../ui/palette.ts';

type XZ = { x: number; z: number };

export interface VRWorldFrame {
  outdoors: boolean;
  /** Visor fog, 0 clear to 1 fogged (Preview's fog value). */
  fog: number;
  /** Show the aiming dot (indoors, looking for the console or hatch). */
  reticle: boolean;
  /** Where the AR marker goes (on the ground at the target) and its label; null hides it. */
  target: { at: THREE.Vector3; label: string } | null;
  /** Draw the "on the glass" path line. */
  glass: boolean;
  /** Where you are (for the part of the route ahead). */
  me: XZ;
  dt: number;
}

export interface VRWorld {
  /** Attach the head-fixed parts to the headset's head, and the world parts to the scene being drawn. */
  place(head: THREE.Object3D, scene: THREE.Scene): void;
  /** Take everything out again (the headset came off). */
  detach(): void;
  /** The route for the glass line (the same points the arrows get), laid on the ground. */
  setRoute(points: XZ[], heightAt: (x: number, z: number) => number): void;
  /** One breath (the desktop's breath puff, in time with the breathing sound). */
  breathe(strength: number): void;
  update(f: VRWorldFrame, xrBaseLayer: XRWebGLLayer | null): void;
  dispose(): void;
}

const AHEAD = 160; // metres of route drawn ahead of you (as glassPath.ts)

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const overlay = (map: THREE.Texture, order: number) => {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0 });
  return { m, order };
};

export function createVRWorld(helmetKit: THREE.Object3D | null): VRWorld {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const onHead = new THREE.Group(), inWorld = new THREE.Group();

  // ---- the helmet, around your face (outdoors only: indoors the helmet is off)
  const helmet = new THREE.Group();
  onHead.add(helmet);
  if (helmetKit) helmet.add(helmetKit);
  const rim = new THREE.Mesh(keep(new THREE.RingGeometry(0.3, 0.7, 72)), keep(new THREE.MeshBasicMaterial({ color: palette.helmet, side: THREE.DoubleSide })));
  rim.position.z = -0.22; // the visor's edge, just at the edge of what a headset shows
  helmet.add(rim);

  // ---- visor fog: a milky haze, thicker low down, with a few denser patches (as HelmetHud.css .hud-fog)
  const fogTex = keep(
    canvasTexture(512, 512, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, 'rgba(236, 241, 246, 0.25)');
      g.addColorStop(1, 'rgba(236, 241, 246, 0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      for (const [x, y, r, a] of [[225, 338, 170, 0.26], [292, 292, 140, 0.2], [150, 410, 120, 0.18], [380, 400, 130, 0.16]]) {
        const p = ctx.createRadialGradient(x, y, 0, x, y, r);
        p.addColorStop(0, `rgba(240, 244, 248, ${a})`);
        p.addColorStop(1, 'rgba(240, 244, 248, 0)');
        ctx.fillStyle = p;
        ctx.fillRect(0, 0, 512, 512);
      }
    }),
  );
  const fogLayer = overlay(fogTex, 997);
  const fog = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.6, 0.6)), keep(fogLayer.m));
  fog.position.z = -0.2;
  fog.renderOrder = fogLayer.order;
  helmet.add(fog);
  // ---- the breath puff: grows in front of the mouth on each exhale
  const breathTex = keep(
    canvasTexture(256, 256, (ctx) => {
      const p = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      p.addColorStop(0, 'rgba(230, 238, 245, 0.35)');
      p.addColorStop(1, 'rgba(230, 238, 245, 0)');
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, 256, 256);
    }),
  );
  const breathLayer = overlay(breathTex, 998);
  const breath = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.16, 0.13)), keep(breathLayer.m));
  breath.position.set(0, -0.05, -0.19);
  breath.renderOrder = breathLayer.order;
  helmet.add(breath);
  let breathT = 1, breathPeak = 0;

  // ---- the aiming dot (the desktop crosshair in the base)
  const reticle = new THREE.Mesh(keep(new THREE.RingGeometry(0.006, 0.01, 24)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.85 })));
  reticle.position.z = -1.5;
  reticle.renderOrder = 1002;
  onHead.add(reticle);

  // ---- AR target marker: a diamond and a label, a constant size, visible through hills (as .hud-target)
  const markCanvas = document.createElement('canvas');
  markCanvas.width = 1024;
  markCanvas.height = 200;
  const markCtx = markCanvas.getContext('2d')!;
  const markTex = keep(new THREE.CanvasTexture(markCanvas));
  markTex.colorSpace = THREE.SRGBColorSpace;
  const marker = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: markTex, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false })));
  marker.scale.set(0.2, 0.039, 1);
  marker.center.set(0.5, 0.86); // the diamond sits on the target
  marker.renderOrder = 996;
  inWorld.add(marker);
  let markLabel = '';
  const drawMarker = (label: string) => {
    const ctx = markCtx;
    ctx.clearRect(0, 0, 1024, 200);
    ctx.save();
    ctx.translate(512, 28);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = 'rgba(111, 227, 255, 0.8)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = palette.ar;
    ctx.lineWidth = 4;
    ctx.strokeRect(-15, -15, 30, 30);
    ctx.restore();
    ctx.font = "500 44px 'Inter', system-ui, sans-serif";
    ctx.letterSpacing = '0.22em';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(111, 227, 255, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#e6f7ff';
    ctx.fillText(label, 512, 110);
    markTex.needsUpdate = true;
  };

  // ---- the "on the glass" path: a thin glowing line, the same width at any distance, never hidden by hills
  const lineGeo = keep(new LineGeometry());
  const core = keep(new LineMaterial({ color: palette.ar, linewidth: 3, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  const halo = keep(new LineMaterial({ color: palette.ar, linewidth: 10, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false }));
  const glassHalo = new Line2(lineGeo, halo), glassCore = new Line2(lineGeo, core);
  glassHalo.renderOrder = 994;
  glassCore.renderOrder = 995;
  glassHalo.frustumCulled = glassCore.frustumCulled = false;
  inWorld.add(glassHalo, glassCore);
  let route: THREE.Vector3[] = [], along: number[] = [], nearest = 0, shownFrom = -1;

  return {
    place(head, scene) {
      if (onHead.parent !== head) head.add(onHead);
      if (inWorld.parent !== scene) scene.add(inWorld);
    },
    detach() {
      onHead.removeFromParent();
      inWorld.removeFromParent();
    },
    setRoute(points, heightAt) {
      // Resampled every metre and laid 5 cm above the ground, as glassPath.ts does.
      route = [];
      along = [];
      let total = 0;
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i], b = points[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(len));
        for (let k = 0; k < n; k++) {
          const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
          route.push(new THREE.Vector3(x, heightAt(x, z) + 0.05, z));
          along.push(total + (len * k) / n);
        }
        total += len;
      }
      const last = points[points.length - 1];
      if (last) {
        route.push(new THREE.Vector3(last.x, heightAt(last.x, last.z) + 0.05, last.z));
        along.push(total);
      }
      nearest = 0;
      shownFrom = -1;
    },
    breathe(strength) {
      breathT = 0;
      breathPeak = 0.55 + 0.35 * strength; // as the desktop puff's keyframes
    },
    update(f, layer) {
      helmet.visible = f.outdoors;
      fogLayer.m.opacity = f.outdoors ? Math.min(1, f.fog) : 0;
      fog.visible = fogLayer.m.opacity > 0.01;
      breathT = Math.min(1, breathT + f.dt / 1.7);
      breathLayer.m.opacity = f.outdoors ? (breathT < 0.3 ? breathT / 0.3 : (1 - breathT) / 0.7) * breathPeak : 0;
      breath.visible = breathLayer.m.opacity > 0.01;
      breath.scale.setScalar(0.85 + 0.21 * breathT);
      reticle.visible = f.reticle;
      marker.visible = !!(f.outdoors && f.target);
      if (f.outdoors && f.target) {
        marker.position.copy(f.target.at).setY(f.target.at.y + 0.6);
        if (f.target.label !== markLabel) drawMarker((markLabel = f.target.label));
      }
      // Glass line: the route from where you are to 160 m ahead (search near last time, as glassPath.ts).
      const showGlass = f.outdoors && f.glass && route.length > 1;
      glassHalo.visible = glassCore.visible = showGlass;
      if (!showGlass) return;
      let best = Infinity;
      const lo = Math.max(0, nearest - 40), hi = Math.min(route.length - 1, nearest + 80);
      for (let i = lo; i <= hi; i++) {
        const d = (route[i].x - f.me.x) ** 2 + (route[i].z - f.me.z) ** 2;
        if (d < best) [best, nearest] = [d, i];
      }
      if (best > 900) for (let i = 0; i < route.length; i++) {
        const d = (route[i].x - f.me.x) ** 2 + (route[i].z - f.me.z) ** 2;
        if (d < best) [best, nearest] = [d, i];
      }
      if (nearest !== shownFrom) {
        shownFrom = nearest;
        const pts: number[] = [];
        for (let i = Math.max(0, nearest - 1); i < route.length && along[i] - along[nearest] <= AHEAD; i++) pts.push(route[i].x, route[i].y, route[i].z);
        if (pts.length < 6) pts.push(...pts.slice(-3));
        lineGeo.setPositions(pts);
      }
      // Line widths are in pixels of one eye's view.
      const w = layer ? layer.framebufferWidth / 2 : 1832, h = layer ? layer.framebufferHeight : 1920;
      core.resolution.set(w, h);
      halo.resolution.set(w, h);
    },
    dispose() {
      onHead.removeFromParent();
      inWorld.removeFromParent();
      for (const d of disposables) d.dispose();
    },
  };
}
