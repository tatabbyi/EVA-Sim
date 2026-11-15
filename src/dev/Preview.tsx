// Written with AI assistance (Claude).
// Owner: Rachel. Look preview (open the site with #preview): starry sky, rainbow terrain, the path to follow with
// rock-sample stops, and the helmet HUD with sample values.
// Click to look, WASD to walk, Shift to run, F to do an objective, E to accept an alert, M to mute,
// O to switch where the path outline is drawn (in the world or on the glass), Esc to release.
// Two versions: #preview draws the path as 3D arrows on the ground; ?outline=glass#preview draws it on the visor glass.
// It starts inside the base, helmet off: walk to the console and click its screen to plan the EVA (Esc to stand up),
// then E at the airlock hatch suits you up and takes you outside. E at the airlock outside brings you back in.
// Any ?demo= link skips the base and starts outside.
// Alex's core now owns EVA movement, route state, and task status; the existing scene remains the renderer.
// EVA resources, workload and simulation time are authoritative physics snapshots.
// Terrain appears only when the height grid exists in public/grids/. Nothing here is made-up terrain.
// The route and stops are sample positions on the real terrain until Nanda's routes (training.json) exist.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import GUI from 'lil-gui';
import { createTerrainMaterial, setHeightRange, setTerrainPreset } from '../terrain/material';
import { createMarsDaySky, createStarrySky } from '../terrain/sky';
import { createSpaceBase, type SpaceBase } from '../terrain/base';
import { createRoutePath, type RoutePath } from '../terrain/routePath';
import { createSampleSite } from '../terrain/sampleSite';
import { abradeTask, coreTask, createDepotTask, createLaserTask, createMoxieTask, createPanoramaTask, type TaskKind, type TaskSite } from '../terrain/tasks';
import { HelmetHud, type HudAlert } from '../ui/HelmetHud';
import { createHeadSway } from '../ui/headSway';
import { defaultTerrainPreset, palette, terrainPresets, type TerrainPresetName } from '../ui/palette';
import { loadMeta } from '../shared/meta';
import { loadFloatGrid, sampleBilinear, type Grid } from '../shared/grids';
import type { XZ } from '../shared/coords';
import { createAdaptiveResolution } from '../shared/perf';
import { createVisorLens } from '../terrain/visorLens';
import { createHelmetInterior } from '../terrain/helmetInterior';
import { createRockField, type RockField } from '../terrain/rockField';
import { createSunShadows, type SunShadows } from '../terrain/shadows';
import { createGlassPath } from '../ui/glassPath';
import { createSuitAudio, type SuitAudio } from '../audio/suitAudio';
import type { HudObjective } from '../ui/HelmetHud';
import { SetupConsole, type SetupLevels, type SetupMission } from '../ui/SetupConsole';
import { DEMO_SITES, estimateEVA, evaMission } from '../adapters/eva-demo';
import { gramsPerHour, MARS_EVA_DEMO_PROFILE } from '../core/physics';
import { toHelmetHud } from '../adapters/hud';
import { createBaseInterior, ROOM_EYE } from '../terrain/baseInterior';
import { createEngine, type Engine } from '../core/engine';
import type { DeepReadonly, EngineSnapshot, Region, TaskId } from '../core/contracts';
import { createFixedClock } from '../adapters/clock';
import { applyRouteCandidate } from '../adapters/routes';
import type { HeightProvider } from '../adapters/world';
import { createActiveTerrain } from '../adapters/active-terrain';
import './Preview.css';

const EYE = 1.7;
const MAX_SIDE = 1025;
// Sample route from the landing site towards the delta (west-north-west), stops marked.
const ROUTE: XZ[] = [{x:0,z:6.4}, ...DEMO_SITES.map(p=>({...p}))];
// Objectives along the path, in order, each a little off the track: rocks to step over to, a boulder to zap from
// the path, a viewpoint marker on the path itself. Kinds: see src/terrain/tasks.ts.
// minutes: time budget for each objective (its own countdown on the HUD).
// The four tasks of the team brief (docs/FOUR-TASK-ANIMATION-BRIEF.md), logic in Alex's engine (task-start/finish).
const TASK_PLAN: { at: number; kind: TaskKind; offset: number; minutes: number }[] = [
  { at: 1, kind: 'abrade', offset: 1.8, minutes: 4 },
  { at: 2, kind: 'core', offset: -1.8, minutes: 5 },
  { at: 3, kind: 'depot', offset: 1.5, minutes: 3 },
  { at: 4, kind: 'moxie', offset: -2, minutes: 4 },
];
const TASK_TITLES: Record<TaskKind, string> = {
  abrade: 'Abrade a rock', core: 'Take a core', depot: 'Sample depot', moxie: 'Run MOXIE',
  laser: 'Laser-zap a boulder (SuperCam)', panorama: 'Panorama from the marker',
};
const ENGINE_TASK: Record<TaskKind, TaskId> = {
  abrade: 'abrade-rock', core: 'take-core', depot: 'sample-depot', moxie: 'run-moxie', laser: 'laser-scan', panorama: 'panorama',
};
const engineTaskId = (kind: TaskKind): TaskId => ENGINE_TASK[kind];
/** The brief's rule: each mission is two of the four tasks, picked at random (you can change them at the console). */
const twoAtRandom = () => {
  const order = TASK_PLAN.map((_, i) => i).sort(() => Math.random() - 0.5);
  return TASK_PLAN.map((_, i) => i === order[0] || i === order[1]);
};
const engineSiteId = (index: number) => `preview-task-${index}`;
const STOPS: XZ[] = DEMO_SITES.map(p=>({...p}));
// ?demo=core (or sample), ?demo=laser, ?demo=panorama: start at that objective and begin it (for checks and demo recordings).
// ?demo=fog: the visor stays fogged (to judge the look). ?demo=console: start seated at the base console.
const PARAMS = new URLSearchParams(window.location.search);
const DEMO = PARAMS.get('demo');
// Where the path outline is drawn: 'world' (3D arrows on the ground) or 'glass' (projected onto the visor).
const OUTLINE_START: 'world' | 'glass' = PARAMS.get('outline') === 'glass' ? 'glass' : 'world';
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec) % 60).padStart(2, '0')}`;

interface Sample {
  done: number;
  cyclone: boolean;
}

type Interaction =
  | { kind: 'none' }
  | { kind: 'prompt'; site: number; title: string; text: string }
  | { kind: 'sampling'; site: number; pct: number; phase: string; title: string }
  | { kind: 'stored'; title: string; text: string };

export function Preview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const startSampleRef = useRef<() => void>(() => {});
  const goHomeRef = useRef<() => void>(() => {});
  const swayRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement | null>(null);
  const breathRef = useRef<HTMLDivElement | null>(null);
  const fogRef = useRef<HTMLDivElement | null>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<SuitAudio | null>(null);
  const runtimePausedRef = useRef(false);
  const runtimeRef = useRef<Engine | null>(null);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<DeepReadonly<EngineSnapshot> | null>(null);
  const currentRef = useRef(0); // which objective's clock is running (-1: none)
  const windRef = useRef(0.4);
  // Inside the base walking about, seated at the console, or out on the EVA.
  const modeRef = useRef<'base' | 'console' | 'eva'>(DEMO && DEMO !== 'console' ? 'eva' : 'base');
  const leaveConsoleRef = useRef<() => void>(() => {});
  const launchRef = useRef<() => string | null>(() => null); // go out through the airlock; returns why not, if not
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const beginEvaRef = useRef<(chosen: boolean[]) => string | null>(() => 'Terrain still loading');
  const enterBaseRef = useRef<() => void>(() => {});
  const evaStartRef = useRef(0);
  const [terrainNote, setTerrainNote] = useState('Loading terrain…');
  const [sample, setSample] = useState<Sample>({ done: 0, cyclone: false });
  const [notice, setNotice] = useState<HudAlert | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'none' });
  const [headingHome, setHeadingHome] = useState(false);
  const [objTitles, setObjTitles] = useState<string[]>([]);
  const [objDone, setObjDone] = useState<boolean[]>(TASK_PLAN.map(() => false));
  const [objSpent, setObjSpent] = useState<number[]>(TASK_PLAN.map(() => 0)); // seconds spent on each objective
  const [currentObj, setCurrentObj] = useState(0); // the objective whose clock is running (the one you're on)
  const [fogWarn, setFogWarn] = useState(false); // visor fogging up: slow down
  const [mode, setMode] = useState(modeRef.current);
  const [basePrompt, setBasePrompt] = useState('');
  const [chosen, setChosen] = useState<boolean[]>(() => twoAtRandom()); // missions picked at the console
  const [heightsLoaded, setHeightsLoaded] = useState<Grid<Float32Array> | null>(null);
  const [terrainProvider,setTerrainProvider] = useState<HeightProvider | null>(null);
  const [door, setDoor] = useState<XZ>({ x: 0, z: 6.4 });
  // Wind picks up and the warning tone sounds when the cyclone alert comes in.
  useEffect(() => {
    windRef.current = sample.cyclone ? 1 : 0.4;
    if (sample.cyclone) audioRef.current?.warning();
  }, [sample.cyclone]);

  useEffect(() => {
    const root = rootRef.current!;
    const host = hostRef.current!;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const res = createAdaptiveResolution(renderer); // lowers resolution if frames run slow
    const lens = createVisorLens(renderer);
    const interior = createHelmetInterior(interiorRef.current!, 80); // mic, valves, cables, drink tube: 3D, inside the helmet
    const glass = createGlassPath(glassRef.current!, palette.ar); // the path drawn on the visor (glass version)
    const audio = createSuitAudio();
    audioRef.current = audio;
    const room = createBaseInterior(renderer); // inside the habitat: console, airlock hatch, suit, lockers
    let lastRect = '', lastPrompt = '', promptHoldUntil = 0, seatT = 0;
    const seatFrom = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: 70 };
    let outline = OUTLINE_START;
    const pr = res.pixelRatio;
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    // Path outline: 3D arrows standing in the world, or lines drawn on the glass. Never both.
    const setOutline = (mode: 'world' | 'glass') => {
      outline = mode;
      glass.setVisible(mode === 'glass');
      outlineState.outline = mode === 'glass' ? 'On the glass' : 'In the world';
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    };
    const outlineState = { outline: '' };
    // Topology on the ground (colour bands by height and contour lines), or plain natural ground: T switches.
    let topologyOn = true;
    const setTopology = (on: boolean) => {
      topologyOn = on;
      setTerrainPreset(material, on ? look.colours : 'realistic');
      if (!on) {
        u.uMinorStrength.value = 0;
        u.uMajorStrength.value = 0;
      }
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      setNotice({ level: 'info', title: on ? 'TOPOLOGY ON' : 'TOPOLOGY OFF', message: 'T to switch' });
      window.setTimeout(() => setNotice((n) => (n?.title.startsWith('TOPOLOGY') ? null : n)), 1600);
    };
    const gui = new GUI({ title: 'Look' }); // developer tuning panel, filled in below
    scene.background = new THREE.Color(palette.space); // only seen at night; by day the sky dome covers it
    // Wider than a normal game camera: the dome lens bends the edges in, like looking through a bubble helmet.
    const camera = new THREE.PerspectiveCamera(80, host.clientWidth / host.clientHeight, 0.05, 8000);
    camera.position.set(0, EYE, 0);
    camera.lookAt(STOPS[0].x, EYE, STOPS[0].z); // face the first stop
    if (modeRef.current === 'base') {
      // Start standing inside the base, facing the console. A normal field of view in here (no helmet).
      camera.position.copy(room.start.position);
      camera.quaternion.copy(room.start.quaternion);
      camera.fov = 70;
      camera.updateProjectionMatrix();
    }

    // Lights for the rocks and the corer (the terrain shader does its own lighting)
    const sunLight = new THREE.DirectionalLight('#fff3e2', 2.4);
    const skyLight = new THREE.HemisphereLight('#d8b892', '#3a2a20', 0.5); // dusty Mars daylight (plus sky reflections)
    scene.add(sunLight, sunLight.target, skyLight);

    // Mouse look + head sway inside the helmet
    const controls = new PointerLockControls(camera, renderer.domElement);
    controls.pointerSpeed = 1.8; // snappier mouse look
    const sway = createHeadSway(swayRef.current ?? root);
    // Sit down at the console (the view eases into the seat, then the Setup screen comes up) and stand up again.
    const sitAtConsole = () => {
      seatFrom.position.copy(camera.position);
      seatFrom.quaternion.copy(camera.quaternion);
      seatFrom.fov = camera.fov;
      seatT = 0;
      modeRef.current = 'console';
      controls.unlock(); // the mouse is for the screen now
      setMode('console');
    };
    const leaveConsole = () => {
      modeRef.current = 'base';
      camera.position.copy(room.standAtConsole.position);
      camera.quaternion.copy(room.standAtConsole.quaternion);
      camera.fov = 70;
      camera.updateProjectionMatrix();
      lastPrompt = '';
      setMode('base');
    };
    leaveConsoleRef.current = leaveConsole;
    if (DEMO === 'console') sitAtConsole();
    const onClick = () => {
      const m = modeRef.current;
      if (m === 'console') return;
      if (!controls.isLocked) {
        controls.lock();
        if (m === 'eva') {
          audio.start(); // browsers only allow sound after a click
          runtimeEngine?.resume();
          runtimePausedRef.current = false;
        }
        return;
      }
      if (m === 'base' && room.aim(camera) === 'console') sitAtConsole();
    };
    // While an objective holds your view on its target you can still turn your head around it, within a cone.
    let headYaw = 0, headPitch = 0;
    const onMouse = (e: MouseEvent) => {
      if (!controls.isLocked) return;
      sway.look(e.movementX, e.movementY);
      if (!controls.enabled) {
        const k = 0.002 * controls.pointerSpeed; // same feel as normal mouse look
        headYaw = Math.max(-0.75, Math.min(0.75, headYaw - e.movementX * k));
        headPitch = Math.max(-0.55, Math.min(0.55, headPitch - e.movementY * k));
      }
    };
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouse);

    // WASD, Shift to run
    const keys = new Set<string>();
    const airborne = false; // Integrated EVA has no jump model.
    let devTools = false; // Look panel + test label, hidden unless you press the backtick key
    const onKeyDown = (e: KeyboardEvent) => {
      if (controls.isLocked) keys.add(e.code);
      if (e.code === 'Backquote') {
        devTools = !devTools;
        if (devTools) gui.show();
        else gui.hide();
        if (badgeRef.current) badgeRef.current.style.display = devTools ? 'block' : 'none';
      }
      if (e.code === 'KeyM') audio.setMuted(!audio.muted);
      if (modeRef.current === 'console' && e.code === 'Escape') leaveConsole();
      if (modeRef.current === 'base' && e.code === 'KeyE' && controls.isLocked && room.aim(camera) === 'hatch') {
        const why = launchRef.current(); // suit up and go out, if there is a plan
        if (why) {
          lastPrompt = why;
          promptHoldUntil = performance.now() / 1000 + 2.5;
          setBasePrompt(why);
        }
      }
      if (e.code === 'KeyO') setOutline(outline === 'world' ? 'glass' : 'world');
      if (e.code === 'KeyT' && modeRef.current === 'eva') setTopology(!topologyOn);
      if (e.code === 'Space' && modeRef.current === 'eva') e.preventDefault(); // No approved jump physics.
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => {
      keys.clear();
      if (modeRef.current === 'eva') {
        runtimeEngine?.pause();
        runtimePausedRef.current = true;
      }
    };
    // Releasing pointer lock must stop held intent, including when key-up is
    // delivered to another window. Resume only through the existing EVA click.
    controls.addEventListener('unlock', onBlur);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const sky = createStarrySky(); // night sky, switchable in the Look panel
    sky.setPixelRatio(pr);
    sky.group.visible = false;
    scene.add(sky.group);
    const daySky = createMarsDaySky(); // real Mars daytime sky (default)
    scene.add(daySky.mesh);

    const material = createTerrainMaterial();
    const u = material.uniforms;
    // The historic litre-based Leash is not a physical return-oxygen estimate.
    u.uHasO2.value = 0;
    u.uHasComms.value = 0;
    u.uFogColor.value.copy(daySky.horizon); // distance haze meets the dusty horizon
    // Mars is dusty: the far plain fades into the haze well before the horizon.
    u.uFogNear.value = 120;
    u.uFogFar.value = 1800;
    // Reflections for metal and glass (base, tools): the Mars sky above, brown ground below.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), daySky.mesh.material));
    const envGround = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshBasicMaterial({ color: '#6b4a36' }));
    envGround.rotation.x = -Math.PI / 2;
    envGround.position.y = -2;
    envScene.add(envGround);
    const envMap = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.7;
    envScene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    envGround.material.dispose();
    pmrem.dispose();

    let terrain: THREE.Mesh | null = null;
    let base: SpaceBase | null = null;
    let arrived = false;
    let heights: Grid<Float32Array> | null = null;
    let runtimeRegion: Region | null = null;
    let routeTerrain: HeightProvider | null = null;
    let runtimeEngine: Engine | null = null;
    let runtimeClock: ReturnType<typeof createFixedClock> | null = null;
    let runtimeOffEvents: (() => void) | null = null;
    let runtimeTimer: ReturnType<typeof setInterval> | null = null;
    let previousSimTime = 0;
    let route: RoutePath | null = null;
    let rocks: RockField | null = null;
    let shadows: SunShadows | null = null;
    const tasks: TaskSite[] = [];
    // Laying the path: both versions get the same route.
    const layRoute = (pts: XZ[]) => {
      const routePoints = pts.map((p) => ({ x: p.x, z: p.z }));
      if (runtimeEngine && routeTerrain) {
        const result = applyRouteCandidate(runtimeEngine, routeTerrain, { source: 'demo', points: routePoints });
        if (!result.ok) {
          if (route) { scene.remove(route.group); route.dispose(); route=null; }
          glass.setVisible(false);
          setNotice({ level: 'warning', title: 'ROUTE UNAVAILABLE', message: result.reason ?? 'Terrain validation failed.' });
          return;
        }
      } else if (runtimeEngine) {
        runtimeEngine.dispatch({ type: 'route', route: { source: 'demo', points: routePoints } });
      }
      if (route) {
        scene.remove(route.group);
        route.dispose();
      }
      route = createRoutePath(pts, groundAt);
      scene.add(route.group);
      glass.setRoute(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)), groundAt);
    };
    // Solid things cast sun shadows (glowing or see-through ones don't).
    const castShadows = (root: THREE.Object3D) =>
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.Material;
        const solid = !mat.transparent && !(mat instanceof THREE.MeshBasicMaterial) && !(mat instanceof THREE.ShaderMaterial);
        m.castShadow = solid;
        m.receiveShadow = solid;
      });
    const groundAt = (x: number, z: number) => {
      if (routeTerrain) {const height=routeTerrain.heightAt(x,z);if(height===null)throw Error('Terrain height unavailable');return height;}
      return heights ? sampleBilinear(heights,x,z) : 0;
    };

    const replaceRuntime = (flags: boolean[], shuttle: XZ) => {
      runtimeOffEvents?.();
      if (runtimeTimer !== null) clearInterval(runtimeTimer);
      runtimeClock?.dispose();
      runtimeEngine?.dispose();
      runtimeOffEvents = null;
      runtimeClock = null;
      runtimeEngine = null;
      runtimeRef.current = null;
      const region = runtimeRegion;
      if (!region) return null;
      const missionTasks = tasks.flatMap((task, i) => flags[i] ? [{
        id: engineSiteId(i),
        type: engineTaskId(task.kind),
        position: { x: task.anchor.x, z: task.anchor.z },
        status: task.state === 'done' ? 'complete' as const : task.state === 'active' ? 'active' as const : 'pending' as const,
      }] : []);
      try {
        if (!routeTerrain) throw Error('Validated terrain unavailable');
        const mission = evaMission(region, shuttle, missionTasks);
        estimateEVA(mission.route.points, routeTerrain.heightAt, region.playableBounds, 0);
        const canOccupy = (p: XZ) => {
          const height = routeTerrain?.heightAt(p.x, p.z);
          return height !== undefined && height !== null && Number.isFinite(height) && !base?.keepClear(p.x,p.z,0);
        };
        runtimeEngine = createEngine(
          region,
          mission,
          canOccupy,
          undefined,
          {profile:MARS_EVA_DEMO_PROFILE,heightAt:routeTerrain.heightAt,carriedMassKg:0,
            ...(PARAMS.get('emergency') === '1' ? {initialOxygenGrams:2,emergencyTest:true} : {})},
        );
        runtimeRef.current = runtimeEngine;
        previousSimTime = 0;
        setRuntimeSnapshot(runtimeEngine.getSnapshot());
        runtimeClock = createFixedClock(runtimeEngine);
        // One fixed physics clock, independent of rendering. Camera quaternion supplies intent only.
        runtimeTimer = setInterval(() => {
          if (!runtimeEngine || !runtimeClock || modeRef.current !== 'eva') return;
          camera.getWorldDirection(lookDir);
          const length = Math.hypot(lookDir.x,lookDir.z) || 1;
          const fwd = Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
          const side = Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
          const enabled = controls.isLocked && !runtimeEngine.getSnapshot().paused && active < 0;
          runtimeEngine.dispatch({type:'input',direction:enabled ? {x:(fwd*lookDir.x-side*lookDir.z)/length,z:(fwd*lookDir.z+side*lookDir.x)/length} : {x:0,z:0},run:keys.has('ShiftLeft')||keys.has('ShiftRight')});
          runtimeClock.tick(performance.now()/1000);
        },1000/60);
        runtimeOffEvents = runtimeEngine.onEvent((event) => {
          if (event.type !== 'task-started') return;
          const index = Number(event.siteId.slice('preview-task-'.length));
          if (Number.isInteger(index)) tasks[index]?.start();
        });
        return runtimeEngine;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setNotice({ level: 'danger', title: 'MISSION UNAVAILABLE', message });
        runtimeEngine = null;
        runtimeClock = null;
        return null;
      }
    };

    // Task animation state; the engine owns the authoritative task status.
    let active = -1; // index of the site being sampled
    let sampled = 0;
    let picked = TASK_PLAN.map(() => true); // the missions chosen at the console for this EVA
    let goal = TASK_PLAN.length; // objectives to finish on this EVA
    let homeBound = false;
    let near = -1;
    let lastPct = -1;
    let taskStartedAt = 0;
    const lookTarget = new THREE.Quaternion();
    const kneelSpot = new THREE.Vector3(); // where you kneel beside the rock while sampling
    let crouch = 0; // 0 standing, 1 kneeling
    const lookMatrix = new THREE.Matrix4();
    const headTurn = new THREE.Quaternion(), headEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    // Your body during an objective: faces the target while only your head turns, so the arms and tools (placed
    // relative to the body) stay put when you look around. The same as the camera the rest of the time.
    const body = new THREE.PerspectiveCamera();

    startSampleRef.current = () => {
      if (active >= 0 || near < 0 || !runtimeEngine || runtimeEngine.getSnapshot().mission.status === 'failed') return;
      const task = tasks[near];
      runtimeEngine.dispatch({ type: 'task-start', siteId: engineSiteId(near) });
      if (runtimeEngine.getSnapshot().mission.tasks.find((t) => t.id === engineSiteId(near))?.status !== 'active') return;
      if (task.kneel) {
        // Step up to the rock and kneel within arm's reach of it.
        const r = task.anchor;
        const dx = camera.position.x - r.x, dz = camera.position.z - r.z, d = Math.hypot(dx, dz) || 1;
        kneelSpot.set(r.x + (dx / d) * 0.62, 0, r.z + (dz / d) * 0.62);
      }
      active = near;
      taskStartedAt = runtimeEngine.getSnapshot().simTimeSeconds;
      headYaw = headPitch = 0;
      currentRef.current = near; // its clock runs while you do it
      lastPct = -1;
      controls.enabled = task.lookAt === null; // core and laser hold your view on the target; panorama lets you turn
    };

    // The way home: a new path from where you stand, back along the route you came, to the landing site.
    const goHome = () => {
      if (homeBound || !heights) return;
      homeBound = true;
      const snapshot=runtimeEngine?.getSnapshot();
      if (!snapshot || snapshot.mission.status==='failed') return;
      const pts: XZ[] = [{...snapshot.player.position},{...snapshot.mission.shuttle}];
      layRoute(pts);
      currentRef.current = -1;
      setHeadingHome(true);
    };
    goHomeRef.current = goHome;

    // BEGIN EVA at the console: suit filled, out through the airlock, only the picked missions are out there.
    beginEvaRef.current = (flags) => {
      if (!base || !heights) return 'Terrain still loading';
      const shuttle = { x: base.door.x, z: base.door.z };
      const plannedRoute = [shuttle, ...STOPS.filter((_,i)=>flags[i]), shuttle];
      const engine = replaceRuntime(flags, shuttle);
      if (!engine) return 'Physics mission unavailable: check terrain and selected objectives';
      setMode('eva');
      engine.resume();
      runtimePausedRef.current = false;
      picked = flags.slice();
      tasks.forEach((t, i) => (t.group.visible = picked[i] || t.state === 'done'));
      goal = tasks.filter((t, i) => picked[i] && t.state !== 'done').length;
      sampled = 0;
      homeBound = false;
      arrived = false;
      active = tasks.findIndex((t, i) => picked[i] && t.state === 'active');
      near = -1;
      controls.enabled = active < 0 || tasks[active].lookAt === null;
      layRoute(plannedRoute);
      const first = STOPS.find((_,i)=>flags[i])!;
      camera.position.set(base.door.x, groundAt(base.door.x, base.door.z) + EYE, base.door.z);
      camera.lookAt(first.x, groundAt(first.x, first.z) + EYE, first.z);
      camera.fov = 80; // helmet on: wide view through the dome
      camera.updateProjectionMatrix();
      fog = 0;
      currentRef.current = active >= 0 ? active : tasks.findIndex((t, i) => picked[i] && t.state === 'idle');
      modeRef.current = 'eva';
      evaStartRef.current = performance.now();
      audio.start();
      // Lock the mouse for looking around (ignored where the browser refuses, e.g. without a focused window).
      try {
        void Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {});
      } catch {
        /* not available */
      }
      return null;
    };
    // Back inside: retain mission results; base oxygen storage is not simulated.
    enterBaseRef.current = () => {
      runtimeEngine?.pause();
      runtimePausedRef.current = true;
      modeRef.current = 'base';
      audio.setDrill(false);
      fog = 0;
      // Through the airlock: just inside the hatch, helmet off.
      camera.position.copy(room.fromAirlock.position);
      camera.quaternion.copy(room.fromAirlock.quaternion);
      camera.fov = 70;
      camera.updateProjectionMatrix();
      lastPrompt = '';
      setChosen(TASK_PLAN.map((_,i)=>i<2));
      setNotice(null);
      setInteraction({ kind: 'none' });
      setSample((p) => ({ ...p, cyclone: false }));
      setHeadingHome(false);
      setMode('base');
    };

    (async () => {
      let grid: Grid<Float32Array> | null = null;
      try {
        const meta = await loadMeta();
        const half = meta.boxMetres / 2;
        runtimeRegion = {
          id: 'jezero-local-preview',
          frameId: 'octavia-e-butler-local-metres-v1',
          crs: meta.crs,
          origin: { X: meta.origin.X, Y: meta.origin.Y, h0: meta.origin.h0 },
          visibleBounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
          playableBounds: { minX: -half + 100, maxX: half - 100, minZ: -half + 100, maxZ: half - 100 },
        };
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
      try {
        if (!runtimeRegion) throw Error('Terrain coordinate frame unavailable');
        const active=await createActiveTerrain(grid,runtimeRegion);
        if (disposed) return;
        grid=active.grid; // Geometry, camera, engine, route checks and console share this surface.
        routeTerrain=active.heights;
        runtimeRegion.terrainRevision=routeTerrain.terrainRevision;
        setTerrainProvider(routeTerrain);
      } catch(error) {
        if (!disposed) {
          setTerrainNote(`Terrain unavailable: ${String(error)}`);
          setNotice({level:'danger',title:'TERRAIN UNAVAILABLE',message:String(error)});
        }
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

      layRoute([ROUTE[0],...STOPS,ROUTE[0]]);
      // The base sits just behind where you start, its airlock facing the landing site.
      base = createSpaceBase(new THREE.Vector3(0, groundAt(0, 15), 15), new THREE.Vector3(0, 0, -1), groundAt);
      scene.add(base.group);
      STOPS.forEach((p, i) => {
        const g = new THREE.Vector3(p.x, groundAt(p.x, p.z), p.z);
        const kind = TASK_PLAN[i].kind;
        const task =
          kind === 'core' ? coreTask(createSampleSite(g, i + 1))
          : kind === 'abrade' ? abradeTask(createSampleSite(g, i + 1, 'abrade'))
          : kind === 'depot' ? createDepotTask(g)
          : kind === 'moxie' ? createMoxieTask(g)
          : kind === 'laser' ? createLaserTask(g, i + 1) : createPanoramaTask(g);
        castShadows(task.group);
        tasks.push(task);
        scene.add(task.group);
      });
      setObjTitles(tasks.map((t) => t.title));
      setHeightsLoaded(grid);
      setDoor({ x: base.door.x, z: base.door.z });
      // Loose rocks everywhere except on the path, at the objectives and inside the base.
      const nearRoute = (x: number, z: number, r: number) => {
        for (let i = 0; i + 1 < ROUTE.length; i++) {
          const a = ROUTE[i], b = ROUTE[i + 1];
          const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
          if ((x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2 < (1.1 + r) ** 2) return true;
        }
        return false;
      };
      rocks = createRockField(groundAt, (x, z, r) =>
        nearRoute(x, z, r) || base!.keepClear(x, z, r) || tasks.some((t) => (t.anchor.x - x) ** 2 + (t.anchor.z - z) ** 2 < (2.8 + r) ** 2),
      );
      scene.add(rocks.group);
      // Sun shadows on the ground (base, rocks, tools, hands)
      shadows = createSunShadows(renderer, sunLight, geo, m - 1, size);
      scene.add(shadows.catcher);
      setTerrainNote(`Terrain: ${grid.cell} m grid, heights ${lo.toFixed(0)} to ${hi.toFixed(0)} m · demo-shaped HiRISE-derived terrain · ${STOPS.length} nearby objectives`);
      let demoTaskIndex = -1;
      if (DEMO === 'base') {
        // ?demo=base: stand out on the plain and look back at the base
        camera.position.set(-16, groundAt(-16, -12) + EYE, -12);
        camera.lookAt(0, groundAt(0, 15) + 3, 15);
      } else if (DEMO) {
        // ?demo=core | laser | panorama (or sample = core): start right at that objective.
        const kind = DEMO === 'sample' ? 'core' : DEMO;
        const idx = tasks.findIndex((t) => t.kind === kind);
        if (idx >= 0) {
          const r = tasks[idx].anchor;
          const back = kind === 'laser' ? 3.2 : kind === 'panorama' ? 0 : kind === 'moxie' ? 1.4 : 0.9;
          camera.position.set(r.x + back, groundAt(r.x + back, r.z + back) + EYE, r.z + back);
          if (kind !== 'panorama') camera.lookAt(r);
          near = idx;
          demoTaskIndex = idx;
        }
      }
      if (modeRef.current === 'eva') {
        const shuttle = { x: camera.position.x, z: camera.position.z };
        const flags = TASK_PLAN.map((_,i)=>demoTaskIndex >= 0 ? i === demoTaskIndex || i === (demoTaskIndex+1)%TASK_PLAN.length : i<2);
        picked = flags;
        goal = 2;
        setChosen(flags);
        const demoRoute = [shuttle,...STOPS.filter((_,i)=>flags[i]),shuttle];
        const engine = replaceRuntime(flags, shuttle);
        engine?.resume();
        runtimePausedRef.current = !engine;
        if (engine) layRoute(demoRoute);
        if (engine && demoTaskIndex >= 0) startSampleRef.current();
      }
    })();

    // Tuning panel
    gui.close();
    gui.hide(); // developer tuning panel: press ` (backtick) to show it
    const t = gui.addFolder('Terrain');
    const look = { colours: defaultTerrainPreset as TerrainPresetName };
    const presetOptions = Object.fromEntries(Object.entries(terrainPresets).map(([key, p]) => [p.label, key]));
    t.add(look, 'colours', presetOptions)
      .name('ground colours')
      .onChange((name: TerrainPresetName) => {
        setTerrainPreset(material, name);
        topologyOn = true;
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
      daySky.setSun(u.uSunDir.value);
    };
    setSun();
    const skyMode = { sky: 'Mars day' };
    t.add(skyMode, 'sky', ['Mars day', 'Night (stars)'])
      .name('sky')
      .onChange((v: string) => {
        const night = v !== 'Mars day';
        daySky.mesh.visible = !night;
        sky.group.visible = night;
        u.uFogColor.value.copy(night ? new THREE.Color(palette.space) : daySky.horizon);
        sunLight.intensity = night ? 0.4 : 2.4;
      });
    t.add(sun, 'azimuth', 0, 360, 1).name('sun azimuth (°)').onChange(setSun);
    t.add(sun, 'elevation', -5, 90, 1).name('sun elevation (°)').onChange(setSun);
    gui
      .add(outlineState, 'outline', ['In the world', 'On the glass'])
      .name('path outline (O)')
      .onChange((v: string) => setOutline(v === 'On the glass' ? 'glass' : 'world'));
    setOutline(outline);
    const helmet = gui.addFolder('Helmet');
    helmet.add(lens.uniforms.uK, 'value', 0, 0.5, 0.01).name('dome curvature');
    helmet.add(lens.uniforms.uCA, 'value', 0, 0.03, 0.001).name('edge colour fringing');
    const h = gui.addFolder('Presentation only');
    const hs = { cyclone: false, fog: 0 };
    h.add(hs, 'fog', 0, 1, 0.05).name('set visor fog').onChange((v: number) => (fog = v));
    h.add(hs, 'cyclone').name('cyclone alert').onChange((v: boolean) => setSample((p) => ({ ...p, cyclone: v })));
    let last = performance.now();
    let lastHud = 0, lastSheen = 0, lastLabel = '';
    let stride = 0, breathPhase = 0, laserClock = 0, lastShot = -1;
    // Visor fog, 0 clear to 1 fogged. Builds while you run (about 11 s to the warning, 20 s to fully fogged);
    // clears slowly while you walk, faster while you work, fastest standing still (about 10 s from fully fogged).
    let fog = DEMO === 'fog' ? 0.6 : 0, fogShown = -1, fogWarnOn = false;
    const lastStep = new THREE.Vector3().copy(camera.position);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const marker = new THREE.Vector3();
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
      let gameDt = 0;

      // Inside the base (helmet off): walk about, or sit at the console with the Setup screen on its monitor.
      if (modeRef.current !== 'eva') {
        const w = host.clientWidth, h = host.clientHeight;
        if (modeRef.current === 'base') {
          const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
          const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
          if (controls.isLocked && (fwd || side)) {
            const step = (1.5 * dt) / Math.hypot(fwd, side); // an indoor walk
            controls.moveForward(fwd * step);
            controls.moveRight(side * step);
          }
          room.collide(camera.position);
          camera.position.y = ROOM_EYE;
          const looking = controls.isLocked ? room.aim(camera) : null;
          const prompt = !controls.isLocked
            ? 'Click to look around · WASD to walk'
            : looking === 'console' ? 'Click · use the console' : looking === 'hatch' ? 'E · suit up and go out' : '';
          if (prompt !== lastPrompt && time > promptHoldUntil) {
            lastPrompt = prompt;
            setBasePrompt(prompt);
          }
        } else {
          // Ease into the seat, then lay the Setup screen exactly over the monitor.
          seatT = Math.min(1, seatT + dt / 0.6);
          const e = seatT * seatT * (3 - 2 * seatT);
          camera.position.lerpVectors(seatFrom.position, room.seat.position, e);
          camera.quaternion.slerpQuaternions(seatFrom.quaternion, room.seat.quaternion, e);
          camera.fov = seatFrom.fov + (room.seat.fov - seatFrom.fov) * e;
          camera.updateProjectionMatrix();
          const el = consoleRef.current;
          if (el) {
            if (seatT >= 1) {
              const r = room.screenRect(camera, w, h);
              const key = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
              if (key !== lastRect || el.style.visibility !== 'visible') {
                lastRect = key;
                Object.assign(el.style, { left: `${Math.round(r.left)}px`, top: `${Math.round(r.top)}px`, width: `${Math.round(r.width)}px`, height: `${Math.round(r.height)}px`, visibility: 'visible' });
              }
            } else el.style.visibility = 'hidden';
          }
        }
        room.update(time);
        renderer.render(room.scene, camera);
        return;
      }

      // The render loop reads authority; it never advances the physics clock or moves the player.
      const state = runtimeEngine?.getSnapshot();
      if (!state?.physics) {
        if (time-lastHud>1) { lastHud=time; setNotice({level:'danger',title:'MISSION UNAVAILABLE',message:'Physics engine unavailable. Return to base and retry.'}); }
        lens.render(scene,camera); return;
      }
      gameDt = state.paused ? 0 : Math.max(0,state.simTimeSeconds-previousSimTime);
      previousSimTime = state.simTimeSeconds;
      const failed = state.mission.status === 'failed';
      if (failed) { gameDt=0; audio.setDrill(false); }
      camera.position.x = state.player.position.x;
      camera.position.z = state.player.position.z;
      const moving = state.physics.activity === 'walk' || state.physics.activity === 'fast';
      const running = state.physics.activity === 'fast';
      // Footsteps, heard through the suit
      stride += Math.hypot(camera.position.x - lastStep.x, camera.position.z - lastStep.z);
      lastStep.copy(camera.position);
      if (!airborne && stride > (running ? 1.3 : 0.8)) {
        stride = 0;
        audio.step();
      }
      // Kneel while sampling: move beside the rock and lower the eye from 1.7 m to about 1.15 m.
      const ease = Math.min(1, gameDt * 3);
      const kneeling = active >= 0 && tasks[active].kneel;
      crouch += ((kneeling ? 1 : 0) - crouch) * ease;
      // Crouch is a vertical presentation offset. X/Z stay at the authoritative player position.
      camera.position.y = groundAt(state.player.position.x,state.player.position.z)+EYE-crouch*(EYE-1.15);

      // Doing an objective: hold the view on its target (if it has one), report progress, finish
      if (active >= 0 && !failed && !state.paused) {
        const task = tasks[active];
        if (task.lookAt) {
          lookMatrix.lookAt(camera.position, task.lookAt, THREE.Object3D.DEFAULT_UP);
          lookTarget.setFromRotationMatrix(lookMatrix);
          body.quaternion.slerp(lookTarget, 1 - Math.exp(-gameDt * 4));
          lookTarget.multiply(headTurn.setFromEuler(headEuler.set(headPitch, headYaw, 0)));
          camera.quaternion.slerp(lookTarget, 1 - Math.exp(-gameDt * 6));
        }
        const pct = Math.round(task.progress * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setInteraction({ kind: 'sampling', site: active, pct, phase: task.phaseText, title: task.hudTitle });
        }
        if (task.state === 'done') {
          const finished = tasks.indexOf(task);
          runtimeEngine?.dispatch({ type: 'task-finish', siteId: engineSiteId(finished) });
          const coreCompleted = runtimeEngine?.getSnapshot().mission.tasks.find((t) => t.id === engineSiteId(finished))?.status === 'complete';
          if (!coreCompleted) return;
          setObjSpent(prev=>prev.map((value,i)=>i===finished ? state.simTimeSeconds-taskStartedAt : value));
          active = -1;
          near = -1;
          controls.enabled = true;
          setInteraction({ kind: 'stored', title: task.doneText[0], text: task.doneText[1] });
          if (coreCompleted) {
            setSample((p) => ({ ...p, done: p.done + 1 }));
            setObjDone((prev) => prev.map((v, k) => v || k === finished));
          }
          currentRef.current = tasks.findIndex((x, i) => picked[i] && x.state === 'idle'); // next objective's clock starts
          audio.chime();
          sampled++;
          if (sampled >= goal) goHome(); // all objectives done: the path turns for home
          window.setTimeout(() => setInteraction((cur) => (cur.kind === 'stored' ? { kind: 'none' } : cur)), 2200);
        }
      } else if (!failed && !state.paused) {
        // In range of an objective that hasn't been done?
        let found = -1;
        tasks.forEach((task, i) => {
          if (picked[i] && task.state === 'idle' && task.inRange(camera)) found = i;
        });
        if (found !== near) {
          near = found;
          const task = tasks[found];
          if (task) audio.ping();
          setInteraction((cur) =>
            cur.kind === 'stored' ? cur : task ? { kind: 'prompt', site: found, title: task.hudTitle, text: task.prompt } : { kind: 'none' },
          );
        }
      }

      camera.getWorldDirection(lookDir);
      sway.setPitch(Math.asin(Math.max(-1, Math.min(1, lookDir.y)))); // looking up shows the top of the helmet
      sway.step(gameDt, running ? 2 : moving ? 1 : 0);

      if (time-lastHud>0.2) {
        lastHud=time;
        setRuntimeSnapshot(state);
        setCurrentObj(currentRef.current);
        setObjDone(prev=>{const next=TASK_PLAN.map((_,i)=>prev[i]||state.mission.tasks.some(t=>t.id===engineSiteId(i)&&t.status==='complete'));return prev.every((v,i)=>v===next[i])?prev:next;});
      }
      sky.update(camera, time);
      daySky.update(camera);
      base?.update(time);
      route?.setProgress(camera.position.x, camera.position.z);
      route?.update(state.simTimeSeconds);
      body.position.copy(camera.position);
      if (active < 0 || !tasks[active].lookAt) body.quaternion.copy(camera.quaternion);
      body.updateMatrixWorld();
      for (const task of tasks) task.update(gameDt, state.simTimeSeconds, body);
      // Slide the glass reflection as the head turns (it stays put relative to the world, roughly).
      if (sheenRef.current) {
        camera.getWorldDirection(lookDir);
        const shift = Math.round((Math.atan2(-lookDir.x, -lookDir.z) / Math.PI) * host.clientWidth * 0.6);
        if (shift !== lastSheen) {
          lastSheen = shift;
          sheenRef.current.style.transform = `translate3d(${shift}px, 0, 0)`;
        }
      }
      // AR objective marker: projected onto the glass over the next objective (or the airlock on the way home)
      const targetEl = targetRef.current;
      if (targetEl) {
        const next = homeBound ? null : (tasks.find((x, i) => picked[i] && x.state === 'idle') ?? null);
        const pos = next ? next.anchor : base ? base.door : null;
        if (!pos || active >= 0) {
          targetEl.style.display = 'none';
        } else {
          marker.copy(pos).setY(pos.y + 0.6).project(camera);
          if (marker.z > 1 || Math.abs(marker.x) > 1.2 || Math.abs(marker.y) > 1.2) {
            targetEl.style.display = 'none';
          } else {
            const sp = lens.toScreen(marker.x, marker.y);
            targetEl.style.display = 'block';
            targetEl.style.transform = `translate3d(${Math.round((sp.x * 0.5 + 0.5) * host.clientWidth)}px, ${Math.round((-sp.y * 0.5 + 0.5) * host.clientHeight)}px, 0)`;
            const dist = Math.round(Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z));
            const label = `${next ? next.title.toUpperCase() : 'BASE AIRLOCK'} · ${dist} M`;
            if (label !== lastLabel) {
              lastLabel = label;
              (targetEl.lastElementChild as HTMLElement).textContent = label;
            }
          }
        }
      }
      // At the airlock: E goes inside to the console. Coming home is the happy ending; you can also end early
      // (after the first 30 s, so it doesn't pop up as you step out).
      if (base) {
        const atDoor = Math.hypot(base.door.x - camera.position.x, base.door.z - camera.position.z) < 3 && (homeBound || performance.now() - evaStartRef.current > 30000);
        if (atDoor && !arrived) {
          arrived = true;
          setNotice(
            homeBound
              ? { level: 'info', title: 'WELCOME BACK', message: 'EVA complete · enter the base', acceptKey: 'E', onAccept: () => enterBaseRef.current() }
              : { level: 'info', title: 'AIRLOCK', message: 'End the EVA and go inside?', acceptKey: 'E', onAccept: () => enterBaseRef.current() },
          );
        } else if (!atDoor && arrived) {
          arrived = false;
          setNotice(null);
        }
      }
      // Breathing: faster with effort. Each exhale puffs a little fog onto the visor (the suit's air flow clears it
      // fast, so it stays small) and plays the breath and valve sound.
      const effort = running ? 2 : moving ? 1 : state.physics.activity === 'task' ? 0.6 : 0;
      const fogRate = running ? 0.05 : active >= 0 ? -0.06 : moving || airborne ? -0.015 : -0.1;
      fog = Math.min(1, Math.max(DEMO === 'fog' ? 0.6 : 0, fog + fogRate * gameDt));
      if (Math.abs(fog - fogShown) > 0.004) {
        fogShown = fog;
        const el = fogRef.current;
        if (el) {
          el.style.display = fog > 0.01 ? 'block' : 'none';
          el.style.setProperty('--fog', fog.toFixed(3));
        }
      }
      if (!fogWarnOn && fog > 0.55) {
        fogWarnOn = true;
        setFogWarn(true);
        audio.ping();
      } else if (fogWarnOn && fog < 0.3) {
        fogWarnOn = false;
        setFogWarn(false);
      }
      // Presentation only: fog increases the apparent breathing effort, not body telemetry.
      breathPhase += gameDt / ((effort >= 2 ? 2.2 : effort >= 1 ? 3.0 : 4.4) * (1 - 0.3 * fog));
      if (breathPhase >= 1) {
        breathPhase -= 1;
        audio.breath(Math.max(effort / 2, fog));
        if (!reducedMotion)
          breathRef.current?.animate(
            [
              { opacity: 0, transform: 'scale(0.85)' },
              { opacity: 0.55 + 0.35 * Math.max(effort / 2, fog), transform: 'scale(1)', offset: 0.3 },
              { opacity: 0, transform: 'scale(1.06)' },
            ],
            { duration: 1700, easing: 'ease-out' },
          );
      }
      audio.update(gameDt, effort, windRef.current);
      // Tool sounds: the corer drilling, SuperCam laser clicks, the panorama camera.
      const doing = !failed && !state.paused && active >= 0 ? tasks[active] : null;
      audio.setDrill(!!doing && ((doing.kind === 'core' && doing.phaseText === 'Drilling core') || (doing.kind === 'abrade' && doing.phaseText === 'Grinding the surface')));
      if (doing?.kind === 'laser') {
        laserClock += dt;
        if (laserClock > 0.12) {
          laserClock = 0;
          audio.laserShot();
        }
      }
      if (doing?.kind === 'panorama') {
        const shot = Math.floor(doing.progress * 8);
        if (shot !== lastShot) {
          lastShot = shot;
          audio.shutter();
        }
      } else lastShot = -1;

      // Path outline: 3D arrows in world mode (hidden while you work), or drawn on the glass.
      if (route) route.group.visible = outline === 'world' && active < 0;
      if (outline === 'glass') glass.update(camera, lens.toScreen, host.clientWidth, host.clientHeight);
      rocks?.update(camera.position.x, camera.position.z);
      shadows?.update(camera.position, u.uSunDir.value);

      lens.render(scene, camera);
      interior.render(); // only redraws when the helmet changes size
    });

    const ro = new ResizeObserver(() => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    return () => {
      disposed = true;
      runtimeOffEvents?.();
      runtimeClock?.dispose();
      if (runtimeTimer !== null) clearInterval(runtimeTimer);
      runtimeEngine?.dispose();
      runtimeRef.current = null;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouse);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      controls.removeEventListener('unlock', onBlur);
      controls.dispose();
      gui.destroy();
      sky.dispose();
      daySky.dispose();
      base?.dispose();
      route?.dispose();
      for (const task of tasks) task.dispose();
      terrain?.geometry.dispose();
      material.dispose();
      lens.dispose();
      envMap.dispose();
      interior.dispose();
      room.dispose();
      rocks?.dispose();
      shadows?.dispose();
      audio.dispose();
      audioRef.current = null;
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

  const physicalHud = runtimeSnapshot ? toHelmetHud(runtimeSnapshot) : null;
  const alert: HudAlert | null = physicalHud?.alert ? physicalHud.alert : sample.cyclone
    ? cycloneAlert
    : interaction.kind === 'prompt'
      ? { level: 'info', title: interaction.title, message: interaction.text, acceptKey: 'F', onAccept: () => startSampleRef.current() }
      : interaction.kind === 'sampling'
        ? { level: 'info', title: interaction.title, message: `${interaction.phase}… ${interaction.pct}%` }
        : interaction.kind === 'stored'
          ? { level: 'info', title: interaction.title, message: interaction.text }
          : notice;

  // Objective lines: done ones show the time taken, the current one counts down (red once over), the rest show
  // their budget. RETURN is the total time left to get back to base.
  // Only the missions picked at the console are on the list.
  const current = headingHome ? -1 : currentObj;
  const items: HudObjective[] = objTitles.flatMap((title, i): HudObjective[] => {
    if (!chosen[i]) return [];
    const budget = TASK_PLAN[i].minutes * 60, spent = objSpent[i];
    if (objDone[i]) return [{ title, time: clock(spent), state: 'done' }];
    if (i !== current) return [{ title, time: clock(budget), state: 'todo' }];
    return [{ title, time: `${TASK_PLAN[i].minutes} min est.`, state: 'current' }];
  });
  if (headingHome) items.push({ title: 'Return to base', time: 'Follow route', state: 'current' });
  const listTotal = objTitles.filter((_, i) => chosen[i]).length;
  const listDone = objTitles.filter((_, i) => chosen[i] && objDone[i]).length;

  // Existing console layout, now with unit-safe physics-derived estimates.
  const planIdx = TASK_PLAN.map((_,i)=>i).filter(i=>chosen[i]&&!objDone[i]);
  const setupRoute: XZ[] = [door,...STOPS.filter((_,i)=>planIdx.includes(i)),door];
  const missions: SetupMission[] = TASK_PLAN.map((p,i)=>({title:TASK_TITLES[p.kind],minutes:p.minutes,
    distance:Math.hypot(STOPS[i].x-door.x,STOPS[i].z-door.z),oxygenGrams:gramsPerHour(MARS_EVA_DEMO_PROFILE.powerTaskW)*p.minutes/60,at:STOPS[i],done:objDone[i]}));
  const {levels,planError} = useMemo((): {levels:SetupLevels|null;planError:string|null} => {
    if (!terrainProvider) return {levels:null,planError:null};
    try {
      const bounds={minX:terrainProvider.bounds.minX+100,maxX:terrainProvider.bounds.maxX-100,minZ:terrainProvider.bounds.minZ+100,maxZ:terrainProvider.bounds.maxZ-100};
      return {levels:estimateEVA([door,...STOPS.filter((_,i)=>chosen[i]&&!objDone[i]),door],terrainProvider.heightAt,bounds,TASK_PLAN.reduce((sum,p,i)=>sum+(chosen[i]&&!objDone[i]?p.minutes:0),0)),planError:null};
    } catch(error) {return {levels:null,planError:String(error)};}
  },[terrainProvider,door,chosen,objDone]);
  const routeTo=setupRoute.length-1;
  const launchWhy=!heightsLoaded ? 'Terrain still loading…' : planIdx.length!==2 ? 'Select exactly TWO objectives' : planError ? planError : !levels || levels.walkGrams+levels.taskGrams+levels.reserveGrams>levels.tankGrams ? 'Not enough O₂ for this plan' : null;
  const beginEva = () => {
    setObjSpent((prev) => prev.map((v, i) => (objDone[i] ? v : 0)));
    setCurrentObj(planIdx[0] ?? -1);
    setHeadingHome(false);
    setNotice(null);
    setInteraction({ kind: 'none' });
    return beginEvaRef.current(chosen.map((c, i) => c && !objDone[i]));
  };
  launchRef.current = () => {
    if (launchWhy) return launchWhy;
    return beginEva();
  };

  return (
    <div ref={rootRef} className="preview">
      <div ref={hostRef} className="preview-canvas" />
      <div className={mode === 'eva' ? undefined : 'preview-hidden'}>
      <div ref={glassRef} className="preview-glass" />
      <HelmetHud
        objectives={{
          done: listDone,
          total: listTotal,
          items,

        }}
        alert={alert}
        o2={physicalHud?.o2 ?? {label:'O₂',value:'N/A',fraction:0}}
        temperature={{label:'TEMP',value:'N/A',fraction:0}}
        swayTargetRef={swayRef}
        sheenRef={sheenRef}
        targetRef={targetRef}
        interiorRef={interiorRef}
        breathRef={breathRef}
        fogRef={fogRef}
        status={fogWarn ? {title:'VISOR FOGGING',message:'Slow down to clear it'} : null}
      />
      </div>
      {mode === 'eva' && <div style={{position:'absolute',left:16,bottom:12,zIndex:20,color:'#e8edf0',background:'#121820cc',padding:8,fontSize:12}} aria-label="EVA physics telemetry">
        <div>{runtimeSnapshot?.physics?.emergencyTest ? 'TEST: 2 g EMERGENCY · ' : ''}ENGINEERING SCENARIO · {runtimeSnapshot?.mission.status ?? 'loading'} · {runtimeSnapshot?.paused ? 'PAUSED' : runtimeSnapshot?.physics?.activity}</div>
        <div>O₂ {runtimeSnapshot?.resources.oxygenGrams?.toFixed(3)} / 750 g · {runtimeSnapshot?.physics?.oxygenRateGramsPerHour.toFixed(2)} g/h · {runtimeSnapshot?.physics?.metabolicPowerWatts.toFixed(1)} W</div>
        <div>Elapsed {runtimeSnapshot?.simTimeSeconds.toFixed(1)} s · X {runtimeSnapshot?.player.position.x.toFixed(2)} · Z {runtimeSnapshot?.player.position.z.toFixed(2)} m · TEMP UNKNOWN</div>
        <div>Terrain: demo-shaped HiRISE-derived</div>
        <button onClick={()=>{const e=runtimeRef.current;if(!e)return;e.dispatch({type:e.getSnapshot().paused?'resume':'pause'});runtimePausedRef.current=e.getSnapshot().paused;if(runtimePausedRef.current)document.exitPointerLock();setRuntimeSnapshot(e.getSnapshot());}}>{runtimeSnapshot?.paused?'Resume':'Pause'}</button>
        <button onClick={()=>{if(window.location.search)window.location.replace(window.location.pathname+window.location.hash);else window.location.reload();}}>Reset to base</button> <a href="#raw">RAW diagnostics</a>
      </div>}
      {mode === 'base' && <details style={{position:'absolute',bottom:8,left:12,zIndex:20,color:'white'}}><summary>Developer test {PARAMS.get('emergency')==='1'?'· TEST: 2 g EMERGENCY ACTIVE':''}</summary><a href="?emergency=1#preview">TEST: 2 g emergency oxygen on next EVA</a> · <a href="#raw">RAW diagnostics</a></details>}
      {mode === 'base' && (
        <div className="base-ui" aria-live="polite">
          <div className="base-crosshair" />
          {basePrompt && <div className="base-prompt">{basePrompt}</div>}
        </div>
      )}
      {mode === 'console' && (
        <div ref={consoleRef} className="preview-console" style={{ visibility: 'hidden' }}>
          <SetupConsole
            missions={missions}
            chosen={chosen.map((c, i) => c && !objDone[i])}
            onToggle={(i) => setChosen((prev) => prev.map((c, k) => (k === i ? !c : c)))}
            levels={levels}
            heights={heightsLoaded}
            route={setupRoute}
            routeTo={routeTo}
            base={door}
            ready={!launchWhy}
            onClose={() => leaveConsoleRef.current()}
          />
        </div>
      )}
      <div className="preview-badge" ref={badgeRef} style={{ display: 'none' }}>
        PREVIEW · inside: WASD, click the console to plan (Esc to stand up), E at the hatch to go out · outside: click to look, WASD to walk, Shift to run, F to do an objective, E to accept, M to mute, T to turn the topology off and on,
        O to move the path outline between the world and the glass, Esc to release
        <br />
        {terrainNote}
        <br />
        <span ref={fpsRef}>measuring…</span>
      </div>
    </div>
  );
}
