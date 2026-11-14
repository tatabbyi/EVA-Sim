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
import { createTerrainMaterial, setHeightRange, setTerrainPreset } from '../terrain/material';
import { createStarrySky } from '../terrain/sky';
import { createRoutePath, type RoutePath } from '../terrain/routePath';
import { createSampleSite } from '../terrain/sampleSite';
import { coreTask, createLaserTask, createPanoramaTask, type TaskKind, type TaskSite } from '../terrain/tasks';
import { HelmetHud, type HudAlert, type SuitBar } from '../ui/HelmetHud';
import { createHeadSway } from '../ui/headSway';
import { defaultTerrainPreset, palette, terrainPresets, type TerrainPresetName } from '../ui/palette';
import { loadMeta } from '../shared/meta';
import { loadFloatGrid, sampleBilinear, type Grid } from '../shared/grids';
import type { XZ } from '../shared/coords';
import { createAdaptiveResolution } from '../shared/perf';
import { createVisorLens } from '../terrain/visorLens';
import { createHelmetInterior } from '../terrain/helmetInterior';
import './Preview.css';

const EYE = 1.7;
const MAX_SIDE = 1025;
const O2_CAPACITY = 390;
// Game speeds, faster than a real suited walk (about 1 m/s) so the demo doesn't drag. The O2 maths uses real speeds.
const WALK = 2.2; // m/s
const RUN = 4.6;

// Sample route from the landing site towards the delta (west-north-west), stops marked.
const ROUTE: XZ[] = [
  { x: 0, z: 0 }, { x: -8, z: -20 }, { x: -20, z: -45 }, { x: -55, z: -70 },
  { x: -90, z: -110 }, { x: -140, z: -130 }, { x: -190, z: -170 },
];
// Objectives along the path, in order, each a little off the track: rocks to step over to, a boulder to zap from
// the path, a viewpoint marker on the path itself. Kinds: see src/terrain/tasks.ts.
const TASK_PLAN: { at: number; kind: TaskKind; offset: number }[] = [
  { at: 2, kind: 'core', offset: 1.8 },
  { at: 3, kind: 'laser', offset: 5 },
  { at: 4, kind: 'panorama', offset: 0 },
  { at: 6, kind: 'core', offset: -1.8 },
];
const STOPS: XZ[] = TASK_PLAN.map(({ at: k, offset }) => {
  const prev = ROUTE[Math.max(0, k - 1)], next = ROUTE[Math.min(ROUTE.length - 1, k + 1)];
  const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz);
  return { x: ROUTE[k].x - (dz / len) * offset, z: ROUTE[k].z + (dx / len) * offset };
});
// ?demo=core (or sample), ?demo=laser, ?demo=panorama: start at that objective and begin it (for checks and demo recordings).
const DEMO = new URLSearchParams(window.location.search).get('demo');

interface Sample {
  o2: number;
  tempC: number;
  done: number;
  cyclone: boolean;
}

type Interaction =
  | { kind: 'none' }
  | { kind: 'prompt'; site: number; title: string; text: string }
  | { kind: 'sampling'; site: number; pct: number; phase: string; title: string }
  | { kind: 'stored'; title: string; text: string };

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
  const goHomeRef = useRef<() => void>(() => {});
  const swayRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const [terrainNote, setTerrainNote] = useState('Loading terrain…');
  const [sample, setSample] = useState<Sample>({ o2: 280, tempC: -63, done: 3, cyclone: false });
  const [notice, setNotice] = useState<HudAlert | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'none' });
  const [currentTitle, setCurrentTitle] = useState('Rock core sample');
  const [headingHome, setHeadingHome] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60); // sample mission clock, counts down live

  useEffect(() => {
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Out of time: objectives are dropped and the path turns for home (whiteboard rule).
  useEffect(() => {
    if (secondsLeft === 0) goHomeRef.current();
  }, [secondsLeft]);

  useEffect(() => {
    const root = rootRef.current!;
    const host = hostRef.current!;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const res = createAdaptiveResolution(renderer); // lowers resolution if frames run slow
    const lens = createVisorLens(renderer);
    const interior = createHelmetInterior(80); // mic, valves, cables, drink tube, neck ring: 3D, inside the helmet
    const pr = res.pixelRatio;
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.space);
    // Wider than a normal game camera: the dome lens bends the edges in, like looking through a bubble helmet.
    const camera = new THREE.PerspectiveCamera(80, host.clientWidth / host.clientHeight, 0.05, 8000);
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
    // Jumping in Mars gravity (3.71 m/s²): about 0.8 m high and well over a second in the air.
    const JUMP_SPEED = 3.2, MARS_G = 3.71; // about 1.4 m high, 1.7 s in the air
    let vy = 0, airborne = false;
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault(); // don't scroll the page
        if (!airborne && active < 0) {
          vy = JUMP_SPEED;
          airborne = true;
          sway.look(0, 22); // the helmet lurches as you push off
        }
      }
    };
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
    const tasks: TaskSite[] = [];
    const groundAt = (x: number, z: number) => (heights ? sampleBilinear(heights, x, z) : 0);

    // Sampling state (game rules for the preview only)
    let active = -1; // index of the site being sampled
    let sampled = 0;
    let homeBound = false;
    let near = -1;
    let lastPct = -1;
    const lookTarget = new THREE.Quaternion();
    const kneelSpot = new THREE.Vector3(); // where you kneel beside the rock while sampling
    let crouch = 0; // 0 standing, 1 kneeling
    const lookMatrix = new THREE.Matrix4();

    startSampleRef.current = () => {
      if (active >= 0 || near < 0 || !tasks[near].start()) return;
      const task = tasks[near];
      if (task.kneel) {
        // Step up to the rock and kneel within arm's reach of it.
        const r = task.anchor;
        const dx = camera.position.x - r.x, dz = camera.position.z - r.z, d = Math.hypot(dx, dz) || 1;
        kneelSpot.set(r.x + (dx / d) * 0.62, 0, r.z + (dz / d) * 0.62);
      }
      active = near;
      lastPct = -1;
      controls.enabled = task.lookAt === null; // core and laser hold your view on the target; panorama lets you turn
    };

    // The way home: a new path from where you stand, back along the route you came, to the landing site.
    const goHome = () => {
      if (homeBound || !heights) return;
      homeBound = true;
      const cx = camera.position.x, cz = camera.position.z;
      let k = 0, best = Infinity;
      ROUTE.forEach((p, i) => {
        const d = (p.x - cx) ** 2 + (p.z - cz) ** 2;
        if (d < best) {
          best = d;
          k = i;
        }
      });
      const pts: XZ[] = [{ x: cx, z: cz }];
      for (let i = k; i >= 0; i--) {
        const prev = pts[pts.length - 1];
        if (Math.hypot(ROUTE[i].x - prev.x, ROUTE[i].z - prev.z) > 1.5) pts.push(ROUTE[i]);
      }
      if (pts.length < 2) pts.push(ROUTE[0]);
      if (route) {
        scene.remove(route.group);
        route.dispose();
      }
      route = createRoutePath(pts, groundAt);
      scene.add(route.group);
      setHeadingHome(true);
    };
    goHomeRef.current = goHome;

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
        const g = new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z);
        const kind = TASK_PLAN[i].kind;
        const task = kind === 'core' ? coreTask(createSampleSite(g, i + 1)) : kind === 'laser' ? createLaserTask(g, i + 1) : createPanoramaTask(g);
        tasks.push(task);
        scene.add(task.group);
      });
      setCurrentTitle(tasks[0].title);
      setTerrainNote(`Terrain: ${grid.cell} m grid, heights ${lo.toFixed(0)} to ${hi.toFixed(0)} m · sample route with ${STOPS.length} objectives`);
      if (DEMO) {
        // ?demo=core | laser | panorama (or sample = core): start right at that objective.
        const kind = DEMO === 'sample' ? 'core' : DEMO;
        const idx = tasks.findIndex((t) => t.kind === kind);
        if (idx >= 0) {
          const r = tasks[idx].anchor;
          const back = kind === 'laser' ? 3.2 : kind === 'panorama' ? 0 : 0.9;
          camera.position.set(r.x + back, groundAt(r.x + back, r.z + back) + EYE, r.z + back);
          if (kind !== 'panorama') camera.lookAt(r);
          near = idx;
          startSampleRef.current();
        }
      }
    })();

    // Tuning panel
    const gui = new GUI({ title: 'Look' });
    gui.close(); // starts collapsed so it doesn't cover the HUD bars
    const t = gui.addFolder('Terrain');
    const look = { colours: defaultTerrainPreset as TerrainPresetName };
    const presetOptions = Object.fromEntries(Object.entries(terrainPresets).map(([key, p]) => [p.label, key]));
    t.add(look, 'colours', presetOptions)
      .name('ground colours')
      .onChange((name: TerrainPresetName) => {
        setTerrainPreset(material, name);
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      });
    t.add(u.uCycle, 'value', 0, 100, 1).name('rainbow repeat (m, 0 = off)');
    t.add(u.uBanding, 'value', 0, 1, 0.05).name('rainbow banding');
    t.add(u.uSaturation, 'value', 0, 1, 0.05).name('saturation');
    t.add(u.uMinor, 'value', 1, 20, 0.5).name('minor contour (m)');
    t.add(u.uMajor, 'value', 5, 100, 5).name('major contour (m)');
    t.add(u.uMinorStrength, 'value', 0, 1, 0.05).name('minor line strength');
    t.add(u.uAmbient, 'value', 0, 1, 0.01).name('ambient light');
    t.add(u.uRelief, 'value', 1, 6, 0.1).name('relief shading');
    t.add(u.uDetail, 'value', 0, 1, 0.05).name('close-up surface detail');
    const sun = { azimuth: 135, elevation: 30 };
    const setSun = () => {
      const az = THREE.MathUtils.degToRad(sun.azimuth), el = THREE.MathUtils.degToRad(sun.elevation);
      u.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      sunLight.position.copy(u.uSunDir.value).multiplyScalar(100);
    };
    setSun();
    t.add(sun, 'azimuth', 0, 360, 1).name('sun azimuth (°)').onChange(setSun);
    t.add(sun, 'elevation', -5, 90, 1).name('sun elevation (°)').onChange(setSun);
    const helmet = gui.addFolder('Helmet');
    helmet.add(lens.uniforms.uK, 'value', 0, 0.5, 0.01).name('dome curvature');
    helmet.add(lens.uniforms.uCA, 'value', 0, 0.03, 0.001).name('edge colour fringing');
    const h = gui.addFolder('HUD sample values');
    const hs = { o2: 280, tempOffset: 0, cyclone: false };
    h.add(hs, 'o2', 0, O2_CAPACITY, 1).name('set O₂ (L)').onChange((v: number) => (o2Now = v));
    h.add(hs, 'tempOffset', -30, 30, 1).name('temp offset (°C)');
    h.add(hs, 'cyclone').name('cyclone alert').onChange((v: boolean) => setSample((p) => ({ ...p, cyclone: v })));

    let last = performance.now();
    let o2Now = 280, lastHud = 0, lastSheen = 0;
    const lookDir = new THREE.Vector3();
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
      // Kneel while sampling: move beside the rock and lower the eye from 1.7 m to about 1.15 m.
      const ease = Math.min(1, dt * 3);
      const kneeling = active >= 0 && tasks[active].kneel;
      crouch += ((kneeling ? 1 : 0) - crouch) * ease;
      if (kneeling) {
        camera.position.x += (kneelSpot.x - camera.position.x) * ease;
        camera.position.z += (kneelSpot.z - camera.position.z) * ease;
      }
      const groundY = groundAt(camera.position.x, camera.position.z) + EYE - crouch * (EYE - 1.15);
      if (airborne) {
        vy -= MARS_G * dt;
        camera.position.y += vy * dt;
        if (camera.position.y <= groundY) {
          camera.position.y = groundY;
          airborne = false;
          vy = 0;
          sway.look(0, -14); // the helmet dips on landing
        }
      } else {
        camera.position.y = groundY;
      }

      // Doing an objective: hold the view on its target (if it has one), report progress, finish
      if (active >= 0) {
        const task = tasks[active];
        if (task.lookAt) {
          lookMatrix.lookAt(camera.position, task.lookAt, camera.up);
          lookTarget.setFromRotationMatrix(lookMatrix);
          camera.quaternion.slerp(lookTarget, 1 - Math.exp(-dt * 4));
        }
        const pct = Math.round(task.progress * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setInteraction({ kind: 'sampling', site: active, pct, phase: task.phaseText, title: task.hudTitle });
        }
        if (task.state === 'done') {
          active = -1;
          near = -1;
          controls.enabled = true;
          setInteraction({ kind: 'stored', title: task.doneText[0], text: task.doneText[1] });
          setSample((p) => ({ ...p, done: p.done + 1 }));
          const next = tasks.find((x) => x.state === 'idle');
          setCurrentTitle(next ? next.title : 'Head home');
          sampled++;
          if (sampled === tasks.length) goHome(); // all objectives done: the path turns for home
          window.setTimeout(() => setInteraction((cur) => (cur.kind === 'stored' ? { kind: 'none' } : cur)), 2200);
        }
      } else {
        // In range of an objective that hasn't been done?
        let found = -1;
        tasks.forEach((task, i) => {
          if (task.state === 'idle' && task.inRange(camera)) found = i;
        });
        if (found !== near) {
          near = found;
          const task = tasks[found];
          setInteraction((cur) =>
            cur.kind === 'stored' ? cur : task ? { kind: 'prompt', site: found, title: task.hudTitle, text: task.prompt } : { kind: 'none' },
          );
        }
      }

      sway.step(dt, running ? 2 : moving ? 1 : 0);

      // Demo suit readings: O2 drains with effort and refills when you stop (whiteboard demo rule; not the real
      // consumption model, which is Nanda's). Outside temperature follows the sun's height plus a slow drift.
      const o2Rate = active >= 0 ? -0.6 : running ? -2.4 : moving || airborne ? -0.8 : 1.5; // litres per second
      o2Now = Math.min(O2_CAPACITY, Math.max(0, o2Now + o2Rate * dt));
      const tempNow = -95 + 55 * Math.max(0, Math.sin(THREE.MathUtils.degToRad(sun.elevation))) + 3 * Math.sin(time * 0.15) + hs.tempOffset;
      if (time - lastHud > 0.2) {
        lastHud = time;
        setSample((p) => ({ ...p, o2: o2Now, tempC: tempNow }));
      }
      sky.update(camera, time);
      route?.setProgress(camera.position.x, camera.position.z);
      route?.update(time);
      for (const task of tasks) task.update(dt, time, camera);
      // Slide the glass reflection as the head turns (it stays put relative to the world, roughly).
      if (sheenRef.current) {
        camera.getWorldDirection(lookDir);
        const shift = Math.round((Math.atan2(-lookDir.x, -lookDir.z) / Math.PI) * host.clientWidth * 0.6);
        if (shift !== lastSheen) {
          lastSheen = shift;
          sheenRef.current.style.transform = `translate3d(${shift}px, 0, 0)`;
        }
      }
      lens.render(scene, camera);
      interior.render(renderer, host.clientWidth, host.clientHeight, sway.offset);
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
      for (const task of tasks) task.dispose();
      terrain?.geometry.dispose();
      material.dispose();
      lens.dispose();
      interior.dispose();
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
      goHomeRef.current();
      setNotice({ level: 'info', title: 'WAYPOINT', message: 'Heading home' });
      window.setTimeout(() => setNotice(null), 2500);
    },
  };

  const alert: HudAlert | null = sample.cyclone
    ? cycloneAlert
    : interaction.kind === 'prompt'
      ? { level: 'info', title: interaction.title, message: interaction.text, acceptKey: 'F', onAccept: () => startSampleRef.current() }
      : interaction.kind === 'sampling'
        ? { level: 'info', title: interaction.title, message: `${interaction.phase}… ${interaction.pct}%` }
        : interaction.kind === 'stored'
          ? { level: 'info', title: interaction.title, message: interaction.text }
          : notice;

  const current = headingHome ? 'Head home' : currentTitle;

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
        sheenRef={sheenRef}
      />
      <div className="preview-badge">
        PREVIEW · click to look, WASD to walk, Shift to run, Space to jump, F to sample at a stop, E to accept, Esc to release
        <br />
        {terrainNote}
        <br />
        <span ref={fpsRef}>measuring…</span>
      </div>
    </div>
  );
}
