// Written with AI assistance (Claude).
// Owner: Rachel. Look preview (open the site with #preview): starry sky, rainbow terrain, the path to follow with
// rock-sample stops, and the helmet HUD with sample values.
// Click to look, WASD to walk, Shift to run, F to take a rock sample at a stop, E to accept an alert, Esc to release.
// Walking and game rules here are only so the look can be judged; the real ones are Nanda's (walk) and Alex's (rules).
// Terrain appears only when the height grid exists in public/grids/. Nothing here is made-up terrain.
// The route and stops are sample positions on the real terrain until Nanda's routes (training.json) exist.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import GUI from 'lil-gui';
import { createTerrainMaterial, setHeightRange } from '../terrain/material';
import { createStarrySky } from '../terrain/sky';
import { createRoutePath, type RoutePath } from '../terrain/routePath';
import { createSampleSite, type SampleSite } from '../terrain/sampleSite';
import { HelmetHud, type HudAlert, type SuitBar } from '../ui/HelmetHud';
import { createHeadSway } from '../ui/headSway';
import { palette } from '../ui/palette';
import { loadMeta } from '../shared/meta';
import { loadFloatGrid, sampleBilinear, type Grid } from '../shared/grids';
import type { XZ } from '../shared/coords';
import { createAdaptiveResolution } from '../shared/perf';
import './Preview.css';

const EYE = 1.7;
const MAX_SIDE = 1025;
const O2_CAPACITY = 390;
// Game speeds, faster than a real suited walk (about 1 m/s) so the demo doesn't drag. The O2 maths uses real speeds.
const WALK = 2.2; // m/s
const RUN = 4.6;
const REACH = 3; // metres: close enough to take a sample
const PHASE_TEXT: Record<string, string> = {
  lowering: 'Positioning corer',
  drilling: 'Drilling core',
  raising: 'Extracting core',
  stowing: 'Sealing tube',
};

// Sample route from the landing site towards the delta (west-north-west), stops marked.
const ROUTE: XZ[] = [
  { x: 0, z: 0 }, { x: -8, z: -20 }, { x: -20, z: -45 }, { x: -55, z: -70 },
  { x: -90, z: -110 }, { x: -140, z: -130 }, { x: -190, z: -170 },
];
// Stops sit 1.8 m to the side of the path, like a rock you step off the track to sample.
const STOPS: XZ[] = [2, 4, 6].map((k) => {
  const prev = ROUTE[Math.max(0, k - 1)], next = ROUTE[Math.min(ROUTE.length - 1, k + 1)];
  const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz);
  return { x: ROUTE[k].x - (dz / len) * 1.8, z: ROUTE[k].z + (dx / len) * 1.8 };
});
// ?demo=sample starts next to the first rock and begins sampling (for checking the animation and recording demos).
const DEMO = new URLSearchParams(window.location.search).get('demo');

interface Sample {
  o2: number;
  tempC: number;
  done: number;
  cyclone: boolean;
}

type Interaction =
  | { kind: 'none' }
  | { kind: 'prompt'; site: number }
  | { kind: 'sampling'; site: number; pct: number; phase: string }
  | { kind: 'stored' };

function o2Bar(litres: number): SuitBar {
  const f = litres / O2_CAPACITY;
  return { label: 'O₂', value: `${Math.round(litres)} L`, fraction: f, level: f < 0.25 ? 'danger' : f < 0.4 ? 'warning' : 'ok' };
}

function tempBar(c: number): SuitBar {
  // Outside temperature on a -120 °C to +30 °C scale.
  return { label: 'TEMP', value: `${Math.round(c)}°C`, fraction: (c + 120) / 150, level: c < -100 ? 'danger' : c < -85 ? 'warning' : 'ok' };
}

export function Preview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const startSampleRef = useRef<() => void>(() => {});
  const swayRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const [terrainNote, setTerrainNote] = useState('Loading terrain…');
  const [sample, setSample] = useState<Sample>({ o2: 280, tempC: -63, done: 3, cyclone: false });
  const [notice, setNotice] = useState<HudAlert | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'none' });
  const [stopsDone, setStopsDone] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60); // sample mission clock, counts down live

  useEffect(() => {
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const root = rootRef.current!;
    const host = hostRef.current!;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const res = createAdaptiveResolution(renderer); // lowers resolution if frames run slow
    const pr = res.pixelRatio;
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.space);
    const camera = new THREE.PerspectiveCamera(70, host.clientWidth / host.clientHeight, 0.05, 8000);
    camera.position.set(0, EYE, 0);
    camera.lookAt(STOPS[0].x, EYE, STOPS[0].z); // face the first stop

    // Lights for the rocks and the corer (the terrain shader does its own lighting)
    const sunLight = new THREE.DirectionalLight('#fff3e2', 2.4);
    const skyLight = new THREE.HemisphereLight('#bcd2ff', '#3a2a20', 0.8);
    scene.add(sunLight, skyLight);

    // Mouse look + head sway inside the helmet
    const controls = new PointerLockControls(camera, renderer.domElement);
    controls.pointerSpeed = 1.8; // snappier mouse look
    const sway = createHeadSway(swayRef.current ?? root);
    const onClick = () => controls.lock();
    const onMouse = (e: MouseEvent) => {
      if (controls.isLocked && controls.enabled) sway.look(e.movementX, e.movementY);
    };
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouse);

    // WASD, Shift to run
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => keys.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const sky = createStarrySky();
    sky.setPixelRatio(pr);
    scene.add(sky.group);

    const material = createTerrainMaterial();
    const u = material.uniforms;

    let terrain: THREE.Mesh | null = null;
    let heights: Grid<Float32Array> | null = null;
    let route: RoutePath | null = null;
    const sites: SampleSite[] = [];
    const groundAt = (x: number, z: number) => (heights ? sampleBilinear(heights, x, z) : 0);

    // Sampling state (game rules for the preview only)
    let active = -1; // index of the site being sampled
    let near = -1;
    let lastPct = -1;
    const lookTarget = new THREE.Quaternion();
    const lookMatrix = new THREE.Matrix4();

    startSampleRef.current = () => {
      if (active >= 0 || near < 0 || !sites[near].start()) return;
      active = near;
      lastPct = -1;
      controls.enabled = false; // the suit holds your view on the rock while the corer works
    };

    (async () => {
      let grid: Grid<Float32Array> | null = null;
      try {
        const meta = await loadMeta();
        const base = import.meta.env.BASE_URL;
        for (const key of ['height_2m', 'height_4m']) {
          const g = meta.grids[key];
          if (g && !grid) grid = await loadFloatGrid(base + g.file, g.n, g.cell);
        }
      } catch (err) {
        console.warn(err);
      }
      if (disposed) return;
      if (!grid) {
        setTerrainNote('No terrain yet: waiting for public/grids/height_4m.bin (Victor). Sky and HUD only.');
        return;
      }
      const s = Math.max(1, Math.ceil((grid.n - 1) / (MAX_SIDE - 1)));
      const m = Math.floor((grid.n - 1) / s) + 1;
      const size = (m - 1) * s * grid.cell;
      const geo = new THREE.PlaneGeometry(size, size, m - 1, m - 1);
      geo.rotateX(-Math.PI / 2); // row 0 = north edge (z = -half), matches the grid contract
      const pos = geo.attributes.position as THREE.BufferAttribute;
      let lo = Infinity, hi = -Infinity;
      for (let r = 0; r < m; r++) {
        for (let c = 0; c < m; c++) {
          const h = grid.data[r * s * grid.n + c * s];
          pos.setY(r * m + c, h);
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
        }
      }
      geo.computeVertexNormals();
      terrain = new THREE.Mesh(geo, material);
      scene.add(terrain);
      setHeightRange(material, lo, hi);
      heights = grid;

      route = createRoutePath(ROUTE, groundAt);
      scene.add(route.group);
      STOPS.forEach((p, i) => {
        const site = createSampleSite(new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z), i + 1);
        sites.push(site);
        scene.add(site.group);
      });
      setTerrainNote(`Terrain: ${grid.cell} m grid, heights ${lo.toFixed(0)} to ${hi.toFixed(0)} m · sample route with ${STOPS.length} stops`);
      if (DEMO === 'sample') {
        const r = sites[0].rockTop;
        camera.position.set(r.x + 1.3, groundAt(r.x + 1.3, r.z + 1.3) + EYE, r.z + 1.3);
        camera.lookAt(r);
        near = 0;
        startSampleRef.current();
      }
    })();

    // Tuning panel
    const gui = new GUI({ title: 'Look' });
    gui.close(); // starts collapsed so it doesn't cover the HUD bars
    const t = gui.addFolder('Terrain');
    t.add(u.uCycle, 'value', 0, 100, 1).name('rainbow repeat (m, 0 = off)');
    t.add(u.uBanding, 'value', 0, 1, 0.05).name('rainbow banding');
    t.add(u.uSaturation, 'value', 0, 1, 0.05).name('saturation');
    t.add(u.uMinor, 'value', 1, 20, 0.5).name('minor contour (m)');
    t.add(u.uMajor, 'value', 5, 100, 5).name('major contour (m)');
    t.add(u.uMinorStrength, 'value', 0, 1, 0.05).name('minor line strength');
    t.add(u.uAmbient, 'value', 0, 1, 0.01).name('ambient light');
    const sun = { azimuth: 135, elevation: 30 };
    const setSun = () => {
      const az = THREE.MathUtils.degToRad(sun.azimuth), el = THREE.MathUtils.degToRad(sun.elevation);
      u.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      sunLight.position.copy(u.uSunDir.value).multiplyScalar(100);
    };
    setSun();
    t.add(sun, 'azimuth', 0, 360, 1).name('sun azimuth (°)').onChange(setSun);
    t.add(sun, 'elevation', -5, 90, 1).name('sun elevation (°)').onChange(setSun);
    const h = gui.addFolder('HUD sample values');
    const hs = { o2: 280, tempC: -63, cyclone: false };
    h.add(hs, 'o2', 0, O2_CAPACITY, 1).name('O₂ (L)').onChange((v: number) => setSample((p) => ({ ...p, o2: v })));
    h.add(hs, 'tempC', -120, 30, 1).name('temp (°C)').onChange((v: number) => setSample((p) => ({ ...p, tempC: v })));
    h.add(hs, 'cyclone').name('cyclone alert').onChange((v: boolean) => setSample((p) => ({ ...p, cyclone: v })));

    let last = performance.now();
    let fpsFrames = 0, fpsTime = 0;
    renderer.setAnimationLoop((ms: number) => {
      const rawDt = (ms - last) / 1000;
      const dt = Math.min(rawDt, 0.1);
      last = ms;
      if (res.frame(rawDt)) sky.setPixelRatio(res.pixelRatio);
      fpsFrames++;
      fpsTime += rawDt;
      if (fpsTime >= 1 && fpsRef.current) {
        fpsRef.current.textContent = `${Math.round(fpsFrames / fpsTime)} fps · resolution ${res.pixelRatio.toFixed(2)}x`;
        fpsFrames = 0;
        fpsTime = 0;
      }
      const time = ms / 1000;

      // Walking (blocked while sampling)
      const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const moving = active < 0 && (fwd !== 0 || side !== 0);
      const running = moving && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
      if (moving) {
        const step = ((running ? RUN : WALK) * dt) / Math.hypot(fwd, side);
        controls.moveForward(fwd * step);
        controls.moveRight(side * step);
      }
      camera.position.y = groundAt(camera.position.x, camera.position.z) + EYE;

      // Sampling: hold the view on the rock, report progress, finish
      if (active >= 0) {
        const site = sites[active];
        lookMatrix.lookAt(camera.position, site.rockTop, camera.up);
        lookTarget.setFromRotationMatrix(lookMatrix);
        camera.quaternion.slerp(lookTarget, 1 - Math.exp(-dt * 4));
        const pct = Math.round(site.progress * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setInteraction({ kind: 'sampling', site: active, pct, phase: site.state });
        }
        if (site.state === 'done') {
          active = -1;
          near = -1;
          controls.enabled = true;
          setInteraction({ kind: 'stored' });
          setSample((p) => ({ ...p, done: p.done + 1 }));
          setStopsDone((n) => n + 1);
          window.setTimeout(() => setInteraction((cur) => (cur.kind === 'stored' ? { kind: 'none' } : cur)), 2200);
        }
      } else {
        // Close enough to a stop that hasn't been sampled?
        let found = -1;
        sites.forEach((site, i) => {
          const dx = site.rockTop.x - camera.position.x, dz = site.rockTop.z - camera.position.z;
          if (site.state === 'idle' && dx * dx + dz * dz < REACH * REACH) found = i;
        });
        if (found !== near) {
          near = found;
          setInteraction((cur) => (cur.kind === 'stored' ? cur : found >= 0 ? { kind: 'prompt', site: found } : { kind: 'none' }));
        }
      }

      sway.step(dt, running ? 2 : moving ? 1 : 0);
      sky.update(camera, time);
      route?.update(time);
      for (const site of sites) site.update(dt, time, camera);
      renderer.render(scene, camera);
    });

    const ro = new ResizeObserver(() => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouse);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      controls.dispose();
      gui.destroy();
      sky.dispose();
      route?.dispose();
      for (const site of sites) site.dispose();
      terrain?.geometry.dispose();
      material.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  const cycloneAlert: HudAlert = {
    level: 'danger',
    title: 'CYCLONE',
    message: 'Switch waypoint to home?',
    onAccept: () => {
      setSample((p) => ({ ...p, cyclone: false }));
      setNotice({ level: 'info', title: 'WAYPOINT', message: 'Heading home' });
      window.setTimeout(() => setNotice(null), 2500);
    },
  };

  const alert: HudAlert | null = sample.cyclone
    ? cycloneAlert
    : interaction.kind === 'prompt'
      ? { level: 'info', title: 'ROCK SAMPLE', message: 'Take a core sample', acceptKey: 'F', onAccept: () => startSampleRef.current() }
      : interaction.kind === 'sampling'
        ? { level: 'info', title: 'CORING', message: `${PHASE_TEXT[interaction.phase] ?? 'Working'}… ${interaction.pct}%` }
        : interaction.kind === 'stored'
          ? { level: 'info', title: 'SAMPLE STORED', message: 'Tube sealed and stowed' }
          : notice;

  const current = stopsDone < STOPS.length ? `Rock sample (${stopsDone + 1} of ${STOPS.length})` : 'Head home';

  return (
    <div ref={rootRef} className="preview">
      <div ref={hostRef} className="preview-canvas" />
      <HelmetHud
        objectives={{
          done: sample.done,
          total: 14,
          current,
          timeLeft: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`,
          timeLevel: secondsLeft < 60 ? 'danger' : secondsLeft < 300 ? 'warning' : 'ok',
        }}
        alert={alert}
        o2={o2Bar(sample.o2)}
        temperature={tempBar(sample.tempC)}
        swayTargetRef={swayRef}
      />
      <div className="preview-badge">
        PREVIEW · sample HUD values · click to look, WASD to walk, Shift to run, F to sample at a stop, E to accept, Esc to release
        <br />
        {terrainNote}
        <br />
        <span ref={fpsRef}>measuring…</span>
      </div>
    </div>
  );
}
