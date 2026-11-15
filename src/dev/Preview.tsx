// Written with AI assistance (Claude).
// Owner: Rachel. Look preview (open the site with #preview): starry sky, rainbow terrain, the path to follow with
// rock-sample stops, and the helmet HUD with sample values.
// Click to look, WASD to walk, Shift to run, Space to jump, E to do an objective or accept an alert, hold F for 4x
// speed, M to mute, O to switch where the path outline is drawn (in the world or on the glass), Esc to release.
// Two versions: #preview draws the path as 3D arrows on the ground; ?outline=glass#preview draws it on the visor glass.
// It starts inside the base, helmet off: walk to the console and click its screen to plan the EVA (Esc to stand up),
// then E at the airlock hatch suits you up and takes you outside. E at the airlock outside brings you back in.
// Any ?demo= link skips the base and starts outside.
// Outdoors, Alex's physics engine (src/core/physics.ts, src/core/engine.ts) is the authority: it owns where you are,
// your oxygen in grams (750 g suit), workload, the clock, task status and failure, stepped by its own fixed 60 Hz
// timer. This scene only reads its snapshots and draws. Nanda's planner (src/sim/) draws the path; the console's
// oxygen and time estimates use Alex's physics (src/adapters/eva-demo.ts). Body temperature has no approved model:
// the BODY bar, visor fog and breathing are a visual demo only. Jumping is visual only too (no jump physics).
// Terrain appears only when the height grid exists in public/grids/. Nothing here is made-up terrain.
// The stops are sample positions on the real terrain. The path between them is planned from the real heights by
// src/sim/pathfind.ts (cheapest O2, research/02 + 07) and re-planned from wherever you stand.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import GUI from 'lil-gui';
import { createTerrainMaterial, setHeightRange, setTerrainPreset } from '../terrain/material';
import { createMarsDaySky, createStarrySky } from '../terrain/sky';
import { createSpaceBase, type SpaceBase } from '../terrain/base';
import type { SiteShaping } from '../terrain/siteShaping';
import { createRoutePath, type RoutePath } from '../terrain/routePath';
import { createSampleSite } from '../terrain/sampleSite';
import { abradeTask, coreTask, createDepotTask, createLaserTask, createMoxieTask, createPanoramaTask, type TaskKind, type TaskSite } from '../terrain/tasks';
import { HelmetHud, type HudAlert, type Level, type SuitBar } from '../ui/HelmetHud';
import { createHudCompass, type CompassTarget } from '../ui/hudCompass';
import { createHeadSway } from '../ui/headSway';
import { defaultTerrainPreset, palette, terrainPresets, type TerrainPresetName } from '../ui/palette';
import { loadMeta } from '../shared/meta';
import { loadFloatGrid, sampleBilinear, type Grid } from '../shared/grids';
import type { XZ } from '../shared/coords';
import { createAdaptiveResolution } from '../shared/perf';
import { createVisorLens } from '../terrain/visorLens';
import { createHelmetInterior } from '../terrain/helmetInterior';
import { addVRButton, createXRRig, type VRHudModel } from '../xr/xrRig';
import { createVRWorld } from '../xr/vrWorld';
import { createVRConsole, type VRConsoleModel } from '../xr/vrConsole';
import { createRockField, type RockField } from '../terrain/rockField';
import { createSunShadows, type SunShadows } from '../terrain/shadows';
import { createGlassPath } from '../ui/glassPath';
import { createSuitAudio, type SuitAudio } from '../audio/suitAudio';
import type { HudObjective } from '../ui/HelmetHud';
import { SetupConsole, type SetupLevels, type SetupMission } from '../ui/SetupConsole';
import { createBaseInterior, ROOM_EYE } from '../terrain/baseInterior';
import { createEngine, type Engine } from '../core/engine';
import type { DeepReadonly, EngineSnapshot, Mission, Region, TaskId } from '../core/contracts';
import { estimateEVA, RESERVE_MINUTES } from '../adapters/eva-demo';
import { gramsPerHour, MARS_EVA_DEMO_PROFILE } from '../core/physics';
import { toHelmetHud } from '../adapters/hud';
import { createActiveTerrain } from '../adapters/active-terrain';
import { createFixedClock } from '../adapters/clock';
import { applyRouteCandidate } from '../adapters/routes';
import type { HeightProvider } from '../adapters/world';
import { buildLattice, costFrom, distanceToPath, pathLength, planTour, rankTours, type TourPlan } from '../sim/pathfind';
import { physicsWalk, walkPiece } from '../sim/physicsWalk';
import { buildSteps, safestTour, simulate, type Odds } from '../sim/survival';
import { createPathPlanner, type PathPlanner } from '../sim/planner';
import { setCostTerrain, setHomeCost } from '../sim/cost';
import { createTouchControls, type TouchControls } from './touchControls';
import './Preview.css';
import './touchControls.css';

const EYE = 1.7;
const MAX_SIDE = 1025;

// The site: a field of ridges on real Jezero terrain about 2.4 km north-west of Perseverance's landing site, west
// of the delta front, shaped for the demo (siteShaping.ts, SITE_SHAPING below): its hills drawn twice as close
// together and made 1.6 times taller, the big landforms flattened, a levelled pad under the base. Ridges about 15
// to 30 m tall, close together, 39 m of relief in the whole area. The objectives were placed by running the path
// planner on this ground: every leg curves 10 to 31 m round a ridge instead of climbing it (the whole tour is about
// 660 m). The airlock faces south, straight down the first leg, so you walk straight out.
// The line below only PLACES the objectives (route points 1 to 4, in the order the planner visits them).
// Local metres: x east, z south. ?terrain=real shows the true-scale ground instead (the objectives stay put).
const BASE_AT: XZ = { x: -1760, z: -1580 };
const BASE_FACING: XZ = { x: 0, z: 1 }; // the way the airlock faces (unit vector)
const SITE_SHAPING: SiteShaping = { centre: BASE_AT, closer: 2, hills: 1.6, landforms: 0.25, padRadius: 26, padBlend: 40 };
const ROUTE: XZ[] = [
  { x: BASE_AT.x + BASE_FACING.x * 12, z: BASE_AT.z + BASE_FACING.z * 12 }, // just outside the airlock
  { x: -1786, z: -1498 }, { x: -1714, z: -1486 }, { x: -1654, z: -1642 }, { x: -1750, z: -1726 },
];
// Objectives along the path, in order, each a little off the track: rocks to step over to, a boulder to zap from
// the path, a viewpoint marker on the path itself. Kinds: see src/terrain/tasks.ts.
// minutes: time budget for each objective (its own countdown on the HUD).
// The four tasks of the team brief (docs/FOUR-TASK-ANIMATION-BRIEF.md), logic in Alex's engine (task-start/finish).
const TASK_PLAN: { at: number; kind: TaskKind; offset: number; minutes: number }[] = [
  { at: 1, kind: 'abrade', offset: 0, minutes: 4 },
  { at: 2, kind: 'core', offset: 0, minutes: 5 },
  { at: 3, kind: 'depot', offset: 0, minutes: 3 },
  { at: 4, kind: 'moxie', offset: 0, minutes: 4 },
];
const EVA_MINUTES = 45; // time to be back at base: the scenario planning budget in src/adapters/eva-demo.ts
const OFF_ROUTE_M = 10; // farther than this from the guide: re-plan from where you stand
const REPLAN_EVERY_S = 0.5; // how often to check
/** Plans from any point through objectives `todo` (cheapest order), counting the walk home unless toHome is false. */
type PlanFrom = (from: XZ, todo: number[], toHome?: boolean) => TourPlan | null;
/** Survival Odds (src/sim/survival.ts): the safest of the cheapest visiting orders, with its odds. */
type SafestFrom = (from: XZ, todo: number[]) => { plan: TourPlan; odds: Odds; compared: number } | null;
const CANDIDATE_ORDERS = 6; // visiting orders compared (a two-objective mission has 2)
// The planner and the odds cost walking with the engine's own physics (grams), the same model that spends the suit's O2.
const WALK_MODEL = physicsWalk(MARS_EVA_DEMO_PROFILE, 0); // 0 kg carried, as the engine is created below
/** The site with no shaping (true-scale terrain, for ?terrain=real). */
const TRUE_SCALE: SiteShaping = { centre: BASE_AT, closer: 1, hills: 1, landforms: 1, padRadius: 0, padBlend: 1 };
// The other three of the seven training tasks (research/10-training-tasks.md): listed at the console as coming soon,
// not playable yet. Minutes are the game times from that file.
const UPCOMING_TASKS = [
  { title: 'SuperCam laser shots', minutes: 1 },
  { title: 'PIXL X-ray map', minutes: 2 },
  { title: 'SHERLOC organics scan', minutes: 3 },
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
const STOPS: XZ[] = TASK_PLAN.map(({ at: k, offset }) => {
  const prev = ROUTE[Math.max(0, k - 1)], next = ROUTE[Math.min(ROUTE.length - 1, k + 1)];
  const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz);
  return { x: ROUTE[k].x - (dz / len) * offset, z: ROUTE[k].z + (dx / len) * offset };
});
// ?demo=core (or sample), ?demo=laser, ?demo=panorama: start at that objective and begin it (for checks and demo recordings).
// ?demo=fog: the visor stays fogged (to judge the look). ?demo=console: start seated at the base console.
// ?demo=suit: start in the base looking at your suit on its stand by the hatch.
// ?demo=view&x=..&z=..&lx=..&lz=..: stand at (x, z) outside, looking towards (lx, lz) (local metres; to judge the look).
const PARAMS = new URLSearchParams(window.location.search);
// This hash selects a page in Root; it is not an anchor within Preview.
const RAW_DIAGNOSTICS_URL = new URL('#raw', window.location.href).href;
const DEMO = PARAMS.get('demo');
// Where the path outline is drawn: 'world' (3D arrows on the ground) or 'glass' (projected onto the visor).
const OUTLINE_START: 'world' | 'glass' = PARAMS.get('outline') === 'glass' ? 'glass' : 'world';
/**
 * Alex's physics estimate (estimateEVA, grams and minutes) along Nanda's route, one straight leg at a time. The route's
 * own corners are walked as they are: estimateEVA smooths its input into one curve, and on this site that curve cut a
 * corner of the path diagonally across ground steeper than the physics allows (about 26° for half a metre), which made
 * a walkable plan look unsafe. Task, reserve and tank figures come from the same function.
 */
function estimateAlongRoute(route: XZ[], heightAt: (x: number, z: number) => number | null, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, taskMinutes: number) {
  const legs = route.slice(1).flatMap((b, i) => (Math.hypot(b.x - route[i].x, b.z - route[i].z) > 0.01 ? [[route[i], b]] : []));
  if (!legs.length) throw Error('Invalid plan');
  const totals = estimateEVA(legs[0], heightAt, bounds, taskMinutes); // the first leg plus the task, reserve and tank
  for (const leg of legs.slice(1)) {
    const e = estimateEVA(leg, heightAt, bounds, 0);
    totals.walkGrams += e.walkGrams;
    totals.metres += e.metres;
    totals.minutes += e.minutes;
  }
  return totals;
}
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec) % 60).padStart(2, '0')}`;

interface Sample {
  tempC: number; // body temperature: a visual demo, not physics
  done: number;
  cyclone: boolean;
}

type Interaction =
  | { kind: 'none' }
  | { kind: 'prompt'; site: number; title: string; text: string }
  | { kind: 'sampling'; site: number; pct: number; phase: string; title: string }
  | { kind: 'stored'; title: string; text: string };

function tempBar(c: number): SuitBar {
  // Your core body temperature on a 35 to 40 °C scale: warn from 38 °C (or under 36), danger from 39 °C (or under 35.5).
  // A visual demo (rises when you run, drives the visor fog): the physics has no approved body-temperature model.
  return {
    label: 'BODY',
    value: `${c.toFixed(1)}°C`,
    fraction: Math.min(1, Math.max(0, (c - 35) / 5)),
    level: c >= 39 || c < 35.5 ? 'danger' : c >= 38 || c < 36 ? 'warning' : 'ok',
  };
}

export function Preview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const startSampleRef = useRef<() => void>(() => {});
  const touchInteractRef = useRef<() => void>(() => {});
  const goHomeRef = useRef<() => void>(() => {});
  const swayRef = useRef<HTMLDivElement | null>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement | null>(null);
  const breathRef = useRef<HTMLDivElement | null>(null);
  const fogRef = useRef<HTMLDivElement | null>(null);
  const compassRef = useRef<HTMLDivElement | null>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<SuitAudio | null>(null);
  const runtimePausedRef = useRef(false);
  const currentRef = useRef(0); // which objective's clock is running (-1: none)
  const windRef = useRef(0.4);
  // Inside the base walking about, seated at the console, or out on the EVA.
  const modeRef = useRef<'base' | 'console' | 'eva'>(DEMO && DEMO !== 'console' && DEMO !== 'suit' ? 'eva' : 'base');
  const leaveConsoleRef = useRef<() => void>(() => {});
  // The web HUD's props, handed to the 3D headset HUD (src/xr/vrHud.ts) each render, so both show the same thing.
  const vrRef = useRef<Omit<VRHudModel, 'outdoors' | 'compass' | 'prompt' | 'tutorial'> | null>(null);
  // The Setup console's props, for the headset's console on the monitor (src/xr/vrConsole.ts): the same plan.
  const vrConsoleRef = useRef<Omit<VRConsoleModel, 'options'> | null>(null);
  const launchRef = useRef<() => string | null>(() => null); // go out through the airlock; returns why not, if not
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const beginEvaRef = useRef<(chosen: boolean[], plan: TourPlan | null) => void>(() => {});
  const planRef = useRef<PlanFrom | null>(null); // the path planner, once its fields are ready
  const safestRef = useRef<SafestFrom | null>(null);
  const straightRef = useRef<(pts: XZ[]) => XZ[]>((p) => p); // straight out of the airlock (set in the scene)
  const enterBaseRef = useRef<() => void>(() => {});
  const evaStartRef = useRef(0);
  const [terrainNote, setTerrainNote] = useState('Loading terrain…');
  const [sample, setSample] = useState<Sample>({ tempC: 36.8, done: 0, cyclone: false });
  const [notice, setNotice] = useState<HudAlert | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'none' });
  const [headingHome, setHeadingHome] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(EVA_MINUTES * 60); // total time to get back, counts down live
  const [objTitles, setObjTitles] = useState<string[]>([]);
  const [objDone, setObjDone] = useState<boolean[]>(TASK_PLAN.map(() => false));
  const [objSpent, setObjSpent] = useState<number[]>(TASK_PLAN.map(() => 0)); // seconds spent on each objective
  const [currentObj, setCurrentObj] = useState(0); // the objective whose clock is running (the one you're on)
  const [fogWarn, setFogWarn] = useState(false); // visor fogging up: slow down
  // Demo fast-forward: while F is held on the EVA, everything runs at 4x (walking, tasks, O2, fog, the clocks).
  const FAST_FORWARD = 4;
  const speedRef = useRef(1);
  const [fast, setFast] = useState(false);
  const [devOn, setDevOn] = useState(false); // developer tools (backtick): the physics telemetry and test links
  const [mode, setMode] = useState(modeRef.current);
  const [basePrompt, setBasePrompt] = useState('');
  // Missions picked at the console: exactly two of the four (the brief, and the physics mission's rule).
  const [chosen, setChosen] = useState<boolean[]>(() => (DEMO ? TASK_PLAN.map((_, i) => i < 2) : twoAtRandom()));
  const [heightsLoaded, setHeightsLoaded] = useState<Grid<Float32Array> | null>(null);
  const [door, setDoor] = useState<XZ>({ x: 0, z: 6.4 });
  // The physics engine's latest snapshot (oxygen grams, workload, mission status) for the HUD and telemetry, and the
  // shared terrain (the same shaped heights the engine, planner and console use).
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<DeepReadonly<EngineSnapshot> | null>(null);
  const runtimeRef = useRef<Engine | null>(null);
  const [terrainProvider, setTerrainProvider] = useState<HeightProvider | null>(null);
  const [plannerReady, setPlannerReady] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (modeRef.current !== 'eva' || runtimePausedRef.current) return; // clocks only run during an active EVA
      const step = speedRef.current; // seconds of mission time per real second (FAST_FORWARD while F is held)
      setSecondsLeft((s) => Math.max(0, s - step));
      const i = currentRef.current;
      setCurrentObj(i);
      if (i >= 0) setObjSpent((prev) => prev.map((v, k) => (k === i ? v + step : v)));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Wind picks up and the warning tone sounds when the cyclone alert comes in.
  useEffect(() => {
    windRef.current = sample.cyclone ? 1 : 0.4;
    if (sample.cyclone) audioRef.current?.warning();
  }, [sample.cyclone]);

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
    const compass = createHudCompass(); // holographic compass on the glass, moved every frame on the EVA
    compassRef.current?.replaceChildren(compass.element);
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
    camera.position.set(ROUTE[0].x, EYE, ROUTE[0].z);
    camera.lookAt(STOPS[0].x, EYE, STOPS[0].z); // face the first stop
    camera.rotateX(-0.05); // looking 3° down the path (dead level showed a flat patch in the software renderer)
    if (modeRef.current === 'base') {
      // Start standing inside the base, facing the console. A normal field of view in here (no helmet).
      camera.position.copy(room.start.position);
      camera.quaternion.copy(room.start.quaternion);
      camera.fov = 70;
      camera.updateProjectionMatrix();
      if (DEMO === 'suit') {
        camera.position.set(0.4, 1.65, 1.2);
        camera.lookAt(Math.sin(0.6) * 3.32, 1.15, Math.cos(0.6) * 3.32);
      }
    }

    // Lights for the rocks and the corer (the terrain shader does its own lighting)
    const sunLight = new THREE.DirectionalLight('#fff3e2', 2.4);
    const skyLight = new THREE.HemisphereLight('#d8b892', '#3a2a20', 0.5); // dusty Mars daylight (plus sky reflections)
    scene.add(sunLight, sunLight.target, skyLight);

    // Mouse look + head sway inside the helmet
    const controls = new PointerLockControls(camera, renderer.domElement);
    controls.pointerSpeed = 1.8; // snappier mouse look
    // Headset (WebXR, src/xr/xrRig.ts): controllers stand in for the keyboard and mouse; the A/X button or trigger is E.
    const xr = createXRRig(renderer, {
      onAction: () => {
        for (const type of ['keydown', 'keyup'] as const) window.dispatchEvent(new KeyboardEvent(type, { key: 'e', code: 'KeyE' }));
      },
      onJump: () => jump(),
      onStart: () => {
        if (modeRef.current === 'console') {
          leaveConsole(); // the desktop Setup screen is a page overlay: the headset gets its own on the monitor
          openVRConsole(true);
        }
        audio.start();
        if (modeRef.current === 'eva') {
          runtimeEngine?.resume();
          runtimePausedRef.current = false;
        }
      },
      onEnd: () => {
        openVRConsole(false);
        vrWorld.detach();
      },
    });
    // What the desktop draws on the page, in 3D for the headset (src/xr/vrWorld.ts, src/xr/vrConsole.ts).
    const vrWorld = createVRWorld(interior.vrKit());
    const vrConsole = createVRConsole(room.screen, {
      toggle: (i) => setChosen((prev) => prev.map((c, k) => (k === i ? !c : c))), // the desktop console's toggle
      close: () => openVRConsole(false),
      option: (o) => {
        if (o === 'outline') setOutline(outline === 'world' ? 'glass' : 'world');
        else if (o === 'topology') setTopology(!topologyOn);
        else audio.setMuted(!audio.muted);
      },
    });
    const openVRConsole = (on: boolean) => {
      vrConsole.show(on);
      xr.setPointable(on ? vrConsole : null);
    };
    let vrButton: HTMLElement | null = null;
    void addVRButton(renderer, rootRef.current ?? root).then((b) => {
      if (disposed) b?.remove();
      else vrButton = b;
    });
    const looking = () => controls.isLocked || xr.presenting || !!touchControls; // mouse captured, in the headset, or a phone
    const sway = createHeadSway(swayRef.current ?? root);
    let touchControls: TouchControls | null = null;
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
      if (touchControls) return; // Mobile uses drag-to-look and explicit action buttons, never pointer lock.
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
    const touchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const onMouse = (e: MouseEvent) => {
      if (!controls.isLocked) return;
      sway.look(e.movementX, e.movementY);
      if (!controls.enabled) {
        const k = 0.002 * controls.pointerSpeed; // same feel as normal mouse look
        headYaw = Math.max(-0.75, Math.min(0.75, headYaw - e.movementX * k));
        headPitch = Math.max(-0.55, Math.min(0.55, headPitch - e.movementY * k));
      }
    };
    // Touch look is independent of PointerLockControls (unavailable on many phone browsers).
    const lookByTouch = (dx: number, dy: number) => {
      if (modeRef.current === 'console') return;
      sway.look(dx, dy);
      const k = 0.002 * controls.pointerSpeed;
      if (!controls.enabled) { // An objective holds body facing; touch still turns the head in its allowed cone.
        headYaw = THREE.MathUtils.clamp(headYaw - dx * k, -0.75, 0.75);
        headPitch = THREE.MathUtils.clamp(headPitch - dy * k, -0.55, 0.55);
        return;
      }
      touchEuler.setFromQuaternion(camera.quaternion, 'YXZ');
      touchEuler.y -= dx * k;
      touchEuler.x = THREE.MathUtils.clamp(touchEuler.x - dy * k, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
      touchEuler.z = 0;
      camera.quaternion.setFromEuler(touchEuler);
    };
    let lookPointer: number | null = null, lastLookX = 0, lastLookY = 0;
    const touchLookStart = (event: PointerEvent) => {
      if (!touchControls || lookPointer !== null || modeRef.current === 'console') return;
      lookPointer = event.pointerId;
      lastLookX = event.clientX;
      lastLookY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      audio.start(); // A real touch gesture unlocks mobile audio; no synthetic clicks.
      event.preventDefault();
    };
    const touchLookMove = (event: PointerEvent) => {
      if (!touchControls || event.pointerId !== lookPointer) return;
      const dx = THREE.MathUtils.clamp(event.clientX - lastLookX, -60, 60);
      const dy = THREE.MathUtils.clamp(event.clientY - lastLookY, -60, 60);
      lastLookX = event.clientX;
      lastLookY = event.clientY;
      lookByTouch(dx, dy);
      event.preventDefault();
    };
    const touchLookEnd = (event: PointerEvent) => {
      if (event.pointerId === lookPointer) lookPointer = null;
    };
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouse);
    renderer.domElement.addEventListener('pointerdown', touchLookStart);
    renderer.domElement.addEventListener('pointermove', touchLookMove);
    renderer.domElement.addEventListener('pointerup', touchLookEnd);
    renderer.domElement.addEventListener('pointercancel', touchLookEnd);
    renderer.domElement.addEventListener('lostpointercapture', touchLookEnd);

    // WASD, Shift to run
    const keys = new Set<string>();
    // Jumping in Mars gravity (3.71 m/s²): about 0.8 m high and well over a second in the air.
    const JUMP_SPEED = 3.2, MARS_G = 3.71; // about 1.4 m high, 1.7 s in the air
    let vy = 0, airborne = false;
    const jump = () => {
      if (modeRef.current === 'eva' && !airborne && active < 0) {
        vy = JUMP_SPEED;
        airborne = true;
        sway.look(0, 22); // the helmet lurches as you push off
      }
    };
    let devTools = false; // Look panel + test label, hidden unless you press the backtick key
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (e.code === 'Backquote') {
        devTools = !devTools;
        if (devTools) gui.show();
        else gui.hide();
        if (badgeRef.current) badgeRef.current.style.display = devTools ? 'block' : 'none';
        setDevOn(devTools);
      }
      if (e.code === 'KeyM') audio.setMuted(!audio.muted);
      if (modeRef.current === 'console' && e.code === 'Escape') leaveConsole();
      if (modeRef.current === 'base' && e.code === 'KeyE' && xr.presenting && !vrConsole.open && room.aim(camera) === 'console') openVRConsole(true);
      if (modeRef.current === 'base' && e.code === 'KeyE' && looking() && room.aim(camera) === 'hatch') {
        const why = launchRef.current(); // suit up and go out, if there is a plan
        if (why) {
          lastPrompt = why;
          promptHoldUntil = performance.now() / 1000 + 2.5;
          setBasePrompt(why);
        }
      }
      if (e.code === 'KeyO') setOutline(outline === 'world' ? 'glass' : 'world');
      if (e.code === 'KeyT' && modeRef.current === 'eva') setTopology(!topologyOn);
      if (e.code === 'Space') {
        e.preventDefault(); // don't scroll the page
        jump();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onBlur = () => {
      if (xr.presenting) return; // entering the headset can blur the page: keep going
      keys.clear();
      if (modeRef.current === 'eva') {
        runtimeEngine?.pause();
        runtimePausedRef.current = true;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    touchControls = createTouchControls(root, {
      onInteract: () => {
        if (modeRef.current === 'base') {
          const aimed = room.aim(camera);
          if (aimed === 'console') sitAtConsole();
          else if (aimed === 'hatch') {
            const why = launchRef.current();
            if (why) {
              lastPrompt = why;
              promptHoldUntil = performance.now() / 1000 + 2.5;
              setBasePrompt(why);
            }
          }
        } else if (modeRef.current === 'eva') touchInteractRef.current();
      },
      onJump: () => jump(),
      onPause: () => {
        if (!runtimeEngine || modeRef.current !== 'eva') return;
        if (runtimeEngine.getSnapshot().paused) runtimeEngine.resume();
        else runtimeEngine.pause();
        runtimePausedRef.current = runtimeEngine.getSnapshot().paused;
        setRuntimeSnapshot(runtimeEngine.getSnapshot());
      },
    });

    const sky = createStarrySky(); // night sky, switchable in the Look panel
    sky.setPixelRatio(pr);
    sky.group.visible = false;
    scene.add(sky.group);
    const daySky = createMarsDaySky(); // real Mars daytime sky (default)
    scene.add(daySky.mesh);

    const material = createTerrainMaterial();
    const u = material.uniforms;
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
    let route: RoutePath | null = null;
    let rocks: RockField | null = null;
    let shadows: SunShadows | null = null;
    const tasks: TaskSite[] = [];
    // Path planning (src/sim/pathfind.ts), set once the fields for the airlock and every objective are ready.
    let pathPlanner: PathPlanner | null = null;
    let planFrom: PlanFrom | null = null;
    let planOrder: number[] = []; // objectives in the order the current guide visits them
    let guidePoints: XZ[] = []; // the path the guide currently shows
    let lastReplan = 0;
    // Laying the path: both versions get the same route.
    // Every planned path leaves (and comes home) straight through the apron in front of the airlock, not sideways
    // along the hull: the stretch within APRON_M of the hatch is replaced by a straight line out of it.
    const APRON_M = 14;
    const straightAtDoor = (pts: XZ[]): XZ[] => {
      if (!base || pts.length < 2) return pts;
      const door = { x: base.door.x, z: base.door.z };
      const apron = { x: door.x + BASE_FACING.x * APRON_M, z: door.z + BASE_FACING.z * APRON_M }; // straight out of the hatch
      const near = (p: XZ) => Math.hypot(p.x - door.x, p.z - door.z) < APRON_M + 1;
      let out = pts;
      if (near(out[0])) {
        let k = 0;
        while (k < out.length - 1 && near(out[k])) k++;
        out = [door, apron, ...out.slice(k)];
      }
      if (near(out[out.length - 1])) {
        let k = out.length - 1;
        while (k > 1 && near(out[k])) k--;
        out = [...out.slice(0, k + 1), apron, door];
      }
      return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 0.5);
    };
    const layRoute = (pts: XZ[]) => {
      const routePoints = pts.map((p) => ({ x: p.x, z: p.z }));
      if (runtimeEngine && routeTerrain) {
        const result = applyRouteCandidate(runtimeEngine, routeTerrain, { source: 'demo', points: routePoints });
        if (!result.ok) {
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
      vrWorld.setRoute(pts, groundAt);
      guidePoints = routePoints;
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
    const groundAt = (x: number, z: number) => (heights ? sampleBilinear(heights, x, z) : 0);

    const replaceRuntime = (flags: boolean[], shuttle: XZ, routePoints: XZ[]) => {
      runtimeOffEvents?.();
      if (runtimeTimer) clearInterval(runtimeTimer);
      runtimeClock?.dispose();
      runtimeEngine?.dispose();
      runtimeOffEvents = null;
      runtimeTimer = null;
      runtimeClock = null;
      runtimeEngine = null;
      runtimeRef.current = null;
      const region = runtimeRegion;
      if (!region) return null;
      const distinctRoute = routePoints.filter((p, i) => i === 0 || Math.hypot(p.x - routePoints[i - 1].x, p.z - routePoints[i - 1].z) > 0.001);
      const missionTasks = tasks.flatMap((task, i) => flags[i] ? [{
        id: engineSiteId(i),
        type: engineTaskId(task.kind),
        position: { x: task.anchor.x, z: task.anchor.z },
        status: task.state === 'done' ? 'complete' as const : task.state === 'active' ? 'active' as const : 'pending' as const,
      }] : []);
      const mission: Mission = {
        regionId: region.id,
        shuttle: { ...shuttle },
        tasks: missionTasks,
        route: { source: 'demo', points: distinctRoute },
      };
      if (!routeTerrain) {
        setNotice({ level: 'danger', title: 'MISSION UNAVAILABLE', message: 'Validated terrain unavailable' });
        return null;
      }
      if (missionTasks.length !== 2) {
        setNotice({ level: 'danger', title: 'MISSION UNAVAILABLE', message: 'Select exactly two valid official objectives' });
        return null;
      }
      try {
        const terrainAt = routeTerrain.heightAt;
        // Walkable: real terrain, outside the base (the 3 m round the airlock door are open, like the path planner's).
        const door = base?.door;
        const canOccupy = (p: XZ) => {
          const height = terrainAt(p.x, p.z);
          const inBase = !!base?.keepClear(p.x, p.z, 0) && !(door && Math.hypot(p.x - door.x, p.z - door.z) <= 3);
          return height !== null && Number.isFinite(height) && !inBase;
        };
        runtimeEngine = createEngine(region, mission, canOccupy, undefined, {
          profile: MARS_EVA_DEMO_PROFILE,
          heightAt: terrainAt,
          carriedMassKg: 0,
          ...(PARAMS.get('emergency') === '1' ? { initialOxygenGrams: 2, emergencyTest: true } : {}),
        });
        runtimeRef.current = runtimeEngine;
        previousSimTime = 0;
        setRuntimeSnapshot(runtimeEngine.getSnapshot());
        runtimeClock = createFixedClock(runtimeEngine);
        // One fixed physics clock, independent of rendering; the camera only supplies the direction you want to go.
        // Holding F (demo fast-forward) runs this clock FAST_FORWARD times faster: walking, tasks and oxygen all at 4x.
        let physicsTime = 0, physicsLast = performance.now() / 1000;
        runtimeTimer = setInterval(() => {
          const now = performance.now() / 1000, real = Math.min(0.25, Math.max(0, now - physicsLast));
          physicsLast = now;
          if (!runtimeEngine || !runtimeClock || modeRef.current !== 'eva') return;
          camera.getWorldDirection(intent);
          const length = Math.hypot(intent.x, intent.z) || 1;
          // Keyboard, the headset's left stick, or the phone's joystick.
          const fwd = Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + xr.input.forward + (touchControls?.forward ?? 0);
          const side = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + xr.input.side + (touchControls?.right ?? 0);
          const enabled = looking() && !runtimeEngine.getSnapshot().paused && active < 0;
          runtimeEngine.dispatch({
            type: 'input',
            direction: enabled ? { x: (fwd * intent.x - side * intent.z) / length, z: (fwd * intent.z + side * intent.x) / length } : { x: 0, z: 0 },
            run: keys.has('ShiftLeft') || keys.has('ShiftRight') || xr.input.run || !!touchControls?.running,
          });
          // Fed in steps of at most 0.1 s: the fixed clock treats a bigger jump as a pause and skips it, which would
          // make fast-forward stall on a slow tick.
          for (let left = real * speedRef.current; left > 1e-6; left -= 0.1) {
            physicsTime += Math.min(0.1, left);
            runtimeClock.tick(physicsTime);
          }
        }, 1000 / 60);
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
    const intent = new THREE.Vector3(); // where you want to walk (the physics timer reads the camera's facing)
    let runtimeTimer: ReturnType<typeof setInterval> | null = null;
    let previousSimTime = 0;

    // Task animation state; the engine owns the authoritative task status.
    let active = -1; // index of the site being sampled
    let sampled = 0;
    let picked = TASK_PLAN.map(() => true); // the missions chosen at the console for this EVA
    let goal = TASK_PLAN.length; // objectives to finish on this EVA
    let homeBound = false;
    let near = -1;
    let lastPct = -1;
    const lookTarget = new THREE.Quaternion();
    let crouch = 0; // 0 standing, 1 kneeling
    const lookMatrix = new THREE.Matrix4();
    const headEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    /** Removes any sideways tilt (roll) from a view, keeping where it looks. */
    const levelView = (q: THREE.Quaternion) => {
      headEuler.setFromQuaternion(q, 'YXZ');
      return q.setFromEuler(headEuler.set(headEuler.x, headEuler.y, 0));
    };
    // Your body during an objective: faces the target while only your head turns, so the arms and tools (placed
    // relative to the body) stay put when you look around. The same as the camera the rest of the time.
    const body = new THREE.PerspectiveCamera();

    // The next objective to walk to: the first one still to do in the planned order.
    const nextObjective = () => {
      const i = planOrder.find((k) => picked[k] && tasks[k]?.state === 'idle');
      return i ?? tasks.findIndex((t, k) => picked[k] && t.state === 'idle');
    };
    // Plan from `from` (any point) through the objectives still to do, or home, and show it as the guide.
    const guideFrom = (from: XZ): boolean => {
      const plan = planFrom?.(from, homeBound ? [] : tasks.flatMap((t, i) => (picked[i] && t.state !== 'done' ? [i] : [])));
      if (plan) {
        planOrder = plan.order;
        if (plan.points.length > 1) layRoute(straightAtDoor(plan.points));
      } else if (planFrom) setNotice({ level: 'warning', title: 'ROUTE UNAVAILABLE', message: 'No walkable path from here: slopes over 24° or the edge of the map.' });
      return !!plan;
    };

    startSampleRef.current = () => {
      if (active >= 0 || near < 0 || !runtimeEngine || runtimeEngine.getSnapshot().mission.status === 'failed') return;
      const task = tasks[near];
      runtimeEngine.dispatch({ type: 'task-start', siteId: engineSiteId(near) });
      if (runtimeEngine.getSnapshot().mission.tasks.find((t) => t.id === engineSiteId(near))?.status !== 'active') return;
      active = near;
      headYaw = headPitch = 0;
      currentRef.current = near; // its clock runs while you do it
      lastPct = -1;
      controls.enabled = task.lookAt === null; // core and laser hold your view on the target; panorama lets you turn
    };

    // The way home: the cheapest path from where you stand to the airlock (re-planned if you stray).
    const goHome = () => {
      if (homeBound || !heights) return;
      homeBound = true;
      guideFrom({ x: camera.position.x, z: camera.position.z });
      currentRef.current = -1;
      setHeadingHome(true);
    };
    goHomeRef.current = goHome;

    // BEGIN EVA at the console: suit filled, out through the airlock, only the picked missions are out there.
    // plan: the tour the console showed (the safest visiting order); walked from the airlock.
    beginEvaRef.current = (flags, plan) => {
      if (!base || !heights) return;
      const shuttle = { x: base.door.x, z: base.door.z };
      if (!plan || plan.points.length < 2) return void setNotice({ level: 'warning', title: 'ROUTE UNAVAILABLE', message: 'No walkable path to the picked objectives.' });
      const plannedRoute = straightAtDoor(plan.points);
      const engine = replaceRuntime(flags, shuttle, plannedRoute);
      if (!engine) return;
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
      planOrder = plan.order;
      layRoute(plannedRoute);
      const first = plannedRoute[Math.min(plannedRoute.length - 1, 3)]; // face along the path
      camera.position.set(base.door.x, groundAt(base.door.x, base.door.z) + EYE, base.door.z);
      camera.lookAt(first.x, groundAt(first.x, first.z) + EYE, first.z);
      camera.rotateX(-0.05); // 3° down, onto the path
      camera.fov = 80; // helmet on: wide view through the dome
      camera.updateProjectionMatrix();
      fog = 0;
      currentRef.current = active >= 0 ? active : nextObjective();
      modeRef.current = 'eva';
      evaStartRef.current = performance.now();
      audio.start();
      // Pointer lock is desktop-only. Touch keeps full camera control without it.
      if (!touchControls) {
        try {
          void Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {});
        } catch {
          /* not available */
        }
      }
    };
    // Back inside: the mission results stay; base oxygen storage is not simulated.
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
      const left = tasks.flatMap((t, i) => (t.state !== 'done' ? [i] : [])).slice(0, 2);
      setChosen(TASK_PLAN.map((_, i) => left.includes(i))); // the next two of what's left to do
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
      // One shared surface (Alex's active terrain): the demo site's hills, closer and taller (SITE_SHAPING), used by
      // the 3D ground, the physics, the route checks, the path planner and the console alike.
      if (runtimeRegion) {
        try {
          const active = await createActiveTerrain(grid, runtimeRegion, PARAMS.get('terrain') === 'real' ? TRUE_SCALE : SITE_SHAPING);
          if (disposed) return;
          grid = active.grid;
          runtimeRegion.terrainRevision = active.heights.terrainRevision;
          routeTerrain = active.heights;
          setTerrainProvider(active.heights);
        } catch (error) {
          setTerrainNote(`Terrain unavailable: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
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

      // The base sits just behind where you start, its airlock facing down the first leg.
      base = createSpaceBase(new THREE.Vector3(BASE_AT.x, groundAt(BASE_AT.x, BASE_AT.z), BASE_AT.z), new THREE.Vector3(BASE_FACING.x, 0, BASE_FACING.z), groundAt);
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

      // Path planning: a lattice on the real heights (no-go inside the base), then one field per goal in a worker.
      const door0 = { x: base.door.x, z: base.door.z }, theBase = base, half = ((grid.n - 1) * grid.cell) / 2;
      setCostTerrain(groundAt);
      try {
        const bounds = runtimeRegion?.playableBounds ?? { minX: 100 - half, maxX: half - 100, minZ: 100 - half, maxZ: half - 100 };
        const L = buildLattice(groundAt, bounds, Math.max(4, grid.cell), {
          alignX: -half,
          alignZ: -half,
          isBlocked: (x, z) => theBase.keepClear(x, z, 0.75) && Math.hypot(x - door0.x, z - door0.z) > 3,
          model: WALK_MODEL,
        });
        pathPlanner = createPathPlanner(L);
        const [home, ...fields] = await Promise.all([door0, ...STOPS].map((g) => pathPlanner!.field(g)));
        planFrom = (from, todo, toHome = true) => planTour(L, fields, toHome ? home : null, from, todo);
        setHomeCost((x, z) => costFrom(L, home, { x, z }));
        // Survival Odds in grams: each candidate order walked 1,000 times (scenario rates from research/03, not NASA data).
        const suit = { tank: WALK_MODEL.tank, reserve: WALK_MODEL.restPerMin * RESERVE_MINUTES, restPerMin: WALK_MODEL.restPerMin, limitMin: EVA_MINUTES };
        const task = (i: number) => ({ minutes: TASK_PLAN[i].minutes, o2PerMin: WALK_MODEL.taskPerMin });
        const piece = (a: XZ, b: XZ) => walkPiece(WALK_MODEL, groundAt, a, b);
        safestRef.current = (from, todo) =>
          safestTour(rankTours(L, fields, home, from, todo, CANDIDATE_ORDERS), (p) => simulate(buildSteps(p, task, piece), suit, (q) => costFrom(L, home, q)));
      } catch (err) {
        console.warn('Path planner unavailable', err);
      }
      if (disposed) return;
      planRef.current = planFrom;
      straightRef.current = straightAtDoor;
      setPlannerReady(!!planFrom);
      const tour = planFrom?.(door0, TASK_PLAN.map((_, i) => i)) ?? null; // the full tour: the guide before you go out
      if (tour) {
        planOrder = tour.order;
        layRoute(straightAtDoor(tour.points));
      }
      const clearPath = tour ? [...tour.points, ...tour.back] : [];
      // Loose rocks everywhere except on the planned tour (scenery, not obstacles), at the objectives and in the base.
      const nearRoute = (x: number, z: number, r: number) => clearPath.length > 1 && distanceToPath(clearPath, { x, z }) < 1.1 + r;
      // ...and none on the levelled pad round the base (it was graded clear; a boulder by the airlock looked like a slab).
      const onPad = (x: number, z: number, r: number) => Math.hypot(x - BASE_AT.x, z - BASE_AT.z) < SITE_SHAPING.padRadius + r;
      rocks = createRockField(groundAt, (x, z, r) =>
        nearRoute(x, z, r) || onPad(x, z, r) || base!.keepClear(x, z, r) || tasks.some((t) => (t.anchor.x - x) ** 2 + (t.anchor.z - z) ** 2 < (2.8 + r) ** 2),
      );
      scene.add(rocks.group);
      // Sun shadows on the ground (base, rocks, tools, hands)
      shadows = createSunShadows(renderer, sunLight, geo, m - 1, size);
      scene.add(shadows.catcher);
      setTerrainNote(`Terrain: ${grid.cell} m grid, heights ${lo.toFixed(0)} to ${hi.toFixed(0)} m · ${tour ? `planned path through ${STOPS.length} objectives` : 'path planner unavailable'}`);
      let demoTaskIndex = -1;
      if (DEMO === 'base') {
        // ?demo=base: stand out on the ground in front of the airlock, a little to one side, and look back at the base
        const vx = BASE_AT.x + BASE_FACING.x * 27 + BASE_FACING.z * 16, vz = BASE_AT.z + BASE_FACING.z * 27 - BASE_FACING.x * 16;
        camera.position.set(vx, groundAt(vx, vz) + EYE, vz);
        camera.lookAt(BASE_AT.x, groundAt(BASE_AT.x, BASE_AT.z) + 3, BASE_AT.z);
      } else if (DEMO === 'view') {
        const num = (k: string, d: number) => Number(PARAMS.get(k) ?? d);
        const vx = num('x', BASE_AT.x), vz = num('z', BASE_AT.z + 30), lx = num('lx', BASE_AT.x), lz = num('lz', BASE_AT.z);
        camera.position.set(vx, groundAt(vx, vz) + EYE, vz);
        camera.lookAt(lx, groundAt(lx, lz) + EYE * 0.5, lz);
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
        // A demo start: a two-objective physics mission (the one being demonstrated and the next), routed by the planner.
        const shuttle = { x: camera.position.x, z: camera.position.z };
        const two = demoTaskIndex >= 0 ? [demoTaskIndex, (demoTaskIndex + 1) % TASK_PLAN.length] : [0, 1];
        const flags = TASK_PLAN.map((_, i) => two.includes(i));
        const demoTour = planFrom?.(shuttle, two) ?? null;
        picked = flags;
        tasks.forEach((t, i) => (t.group.visible = flags[i]));
        goal = 2;
        const engine = replaceRuntime(flags, shuttle, demoTour ? [...demoTour.points, ...demoTour.back.slice(1)] : [shuttle, door0]);
        engine?.resume();
        runtimePausedRef.current = !engine;
        if (engine) guideFrom(shuttle);
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
    const h = gui.addFolder('HUD sample values');
    const hs = { tempOffset: 0, cyclone: false, fog: 0 }; // (oxygen comes from the physics engine)
    h.add(hs, 'fog', 0, 1, 0.05).name('set visor fog').onChange((v: number) => (fog = v));
    h.add(hs, 'tempOffset', -3, 3, 0.1).name('body temp offset (°C)');
    h.add(hs, 'cyclone').name('cyclone alert').onChange((v: boolean) => setSample((p) => ({ ...p, cyclone: v })));

    let last = performance.now();
    let lastHud = 0, lastSheen = 0, lastLabel = '';
    let bodyT = 36.8; // core body temperature, °C (visual demo)
    let stride = 0, breathPhase = 0, laserClock = 0, lastShot = -1;
    // Visor fog, 0 clear to 1 fogged. Builds while you run (about 11 s to the warning, 20 s to fully fogged);
    // clears slowly while you walk, faster while you work, fastest standing still (about 10 s from fully fogged).
    let fog = DEMO === 'fog' ? 0.6 : 0, fogShown = -1, fogWarnOn = false;
    const lastStep = new THREE.Vector3().copy(camera.position);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const marker = new THREE.Vector3();
    const lookDir = new THREE.Vector3();
    let fpsFrames = 0, fpsTime = 0;
    // Headset HUD (src/xr/vrHud.ts): the web HUD's props, plus the compass from the render loop and the base prompt.
    let vrCompass: VRHudModel['compass'] = null;
    const vrHud = (): VRHudModel => {
      const outdoors = modeRef.current === 'eva', web = vrRef.current;
      const prompt = outdoors ? null : vrConsole.open ? 'Point at the screen · A or trigger to click' : lastPrompt.replace(/^(E|Click|USE) ·/, 'A ·') || null;
      const empty = { label: '', value: '', fraction: 0 };
      return { objectives: { done: 0, total: 0 }, alert: null, o2: empty, temperature: empty, ...web, outdoors, compass: outdoors ? vrCompass : null, prompt };
    };
    // Desktop: through the visor lens (a post-process). Headset: straight to the eyes (post-processing breaks WebXR).
    const draw = (scn: THREE.Scene, eye: number) => {
      if (xr.presenting) {
        vrWorld.place(xr.head, scn);
        xr.render(scn, camera, eye, vrHud());
      }
      else if (scn === scene) lens.render(scene, camera);
      else renderer.render(scn, camera);
    };
    renderer.setAnimationLoop((ms: number) => {
      const rawDt = (ms - last) / 1000;
      const realDt = Math.min(rawDt, 0.1);
      xr.update(realDt);
      touchControls?.setMode(modeRef.current);
      touchControls?.setPaused(runtimePausedRef.current);
      const speed = modeRef.current === 'eva' && (keys.has('KeyF') || xr.input.fast) ? FAST_FORWARD : 1;
      if (speed !== speedRef.current) {
        speedRef.current = speed;
        setFast(speed > 1);
      }
      const dt = realDt * speed; // inside the base; outdoors the sim step comes from the physics engine's clock
      last = ms;
      if (!xr.presenting && res.frame(rawDt)) sky.setPixelRatio(res.pixelRatio); // the headset sets its own resolution
      fpsFrames++;
      fpsTime += rawDt;
      if (fpsTime >= 1 && fpsRef.current) {
        fpsRef.current.textContent = `${Math.round(fpsFrames / fpsTime)} fps · resolution ${res.pixelRatio.toFixed(2)}x`;
        fpsFrames = 0;
        fpsTime = 0;
      }
      const time = ms / 1000;
      let gameDt = runtimePausedRef.current ? 0 : dt; // outdoors: replaced by the physics clock's step below

      // Inside the base (helmet off): walk about, or sit at the console with the Setup screen on its monitor.
      if (modeRef.current !== 'eva') {
        const w = host.clientWidth, h = host.clientHeight;
        if (modeRef.current === 'base') {
          const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + xr.input.forward + (touchControls?.forward ?? 0);
          const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + xr.input.side + (touchControls?.right ?? 0);
          if (looking() && (fwd || side)) {
            const step = (1.5 * dt) / Math.hypot(fwd, side); // an indoor walk
            controls.moveForward(fwd * step);
            controls.moveRight(side * step);
          }
          room.collide(camera.position);
          camera.position.y = ROOM_EYE;
          const aimed = looking() ? room.aim(camera) : null;
          const prompt = touchControls
            ? aimed === 'console' ? 'USE · open mission plan' : aimed === 'hatch' ? 'USE · suit up and go out' : 'Drag to look · move with joystick'
            : !looking()
              ? 'Click to look around · WASD to walk'
              : aimed === 'console' ? 'Click · use the console' : aimed === 'hatch' ? 'E · suit up and go out' : '';
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
        if (xr.presenting) {
          // Headset: the console on the monitor (closes when you walk away), and the aiming dot.
          if (vrConsole.open && (modeRef.current !== 'base' || camera.position.distanceTo(room.standAtConsole.position) > 2.5)) openVRConsole(false);
          const plan = vrConsoleRef.current;
          if (vrConsole.open && plan) vrConsole.update({ ...plan, options: { outline, topology: topologyOn, sound: !audio.muted } });
          vrWorld.update({ outdoors: false, fog: 0, reticle: !vrConsole.open, target: null, glass: false, me: camera.position, dt: realDt }, renderer.xr.getBaseLayer() as XRWebGLLayer | null);
        }
        draw(room.scene, ROOM_EYE);
        return;
      }

      // The physics engine is the authority outdoors: the render loop only reads its snapshot (where you are, what
      // you're doing, the clock, the tasks, failure). It never moves the player or steps the physics itself.
      const state = runtimeEngine?.getSnapshot();
      if (!state?.physics) {
        // No engine yet (the planner is still preparing) or it couldn't start (replaceRuntime shows why): just draw.
        draw(scene, EYE);
        return;
      }
      const failed = state.mission.status === 'failed';
      gameDt = state.paused || failed ? 0 : Math.max(0, state.simTimeSeconds - previousSimTime); // FAST_FORWARD x while F is held
      previousSimTime = state.simTimeSeconds;
      if (failed) audio.setDrill(false);
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
      // Kneel while sampling: lower the eye from 1.7 m to about 1.15 m. Only the height: where you stand (x, z) stays
      // the physics' position. Jumping (below) is visual only as well: the physics has no jump.
      const ease = Math.min(1, gameDt * 3);
      const kneeling = active >= 0 && tasks[active].kneel;
      crouch += ((kneeling ? 1 : 0) - crouch) * ease;
      const groundY = groundAt(camera.position.x, camera.position.z) + EYE - crouch * (EYE - 1.15);
      if (airborne) {
        vy -= MARS_G * gameDt;
        camera.position.y += vy * gameDt;
        if (camera.position.y <= groundY) {
          camera.position.y = groundY;
          airborne = false;
          vy = 0;
          sway.look(0, -14); // the helmet dips on landing
          audio.land();
        }
      } else {
        camera.position.y = groundY;
      }

      // Doing an objective: hold the view on its target (if it has one), report progress, finish
      if (active >= 0 && !failed && !state.paused) {
        const task = tasks[active];
        if (task.lookAt) {
          lookMatrix.lookAt(camera.position, task.lookAt, THREE.Object3D.DEFAULT_UP);
          lookTarget.setFromRotationMatrix(lookMatrix);
          body.quaternion.slerp(lookTarget, 1 - Math.exp(-gameDt * 4));
          // Head turn on top of the view at the target: yaw about straight up, pitch about the eyes' side axis, no roll.
          // (Turning about the head's own tilted axis while looking down at a rock tipped the view sideways.)
          headEuler.setFromQuaternion(lookTarget, 'YXZ');
          lookTarget.setFromEuler(headEuler.set(Math.max(-1.45, Math.min(1.45, headEuler.x + headPitch)), headEuler.y + headYaw, 0));
          levelView(camera.quaternion.slerp(lookTarget, 1 - Math.exp(-gameDt * 6)));
        }
        const pct = Math.round(task.progress * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setInteraction({ kind: 'sampling', site: active, pct, phase: task.phaseText, title: task.hudTitle });
        }
        // Finished only once the engine confirms it (it owns task status): until then the animation just waits.
        const finished = tasks.indexOf(task);
        if (task.state === 'done') runtimeEngine?.dispatch({ type: 'task-finish', siteId: engineSiteId(finished) });
        const coreCompleted = task.state === 'done' && runtimeEngine?.getSnapshot().mission.tasks.find((t) => t.id === engineSiteId(finished))?.status === 'complete';
        if (coreCompleted) {
          active = -1;
          near = -1;
          levelView(camera.quaternion); // hand back a level view to the mouse look
          controls.enabled = true;
          setInteraction({ kind: 'stored', title: task.doneText[0], text: task.doneText[1] });
          if (coreCompleted) {
            setSample((p) => ({ ...p, done: p.done + 1 }));
            setObjDone((prev) => prev.map((v, k) => v || k === finished));
          }
          audio.chime();
          sampled++;
          if (sampled >= goal) goHome(); // all objectives done: the path turns for home
          else guideFrom({ x: camera.position.x, z: camera.position.z }); // on to the next one, from where you are
          currentRef.current = homeBound ? -1 : nextObjective(); // next objective's clock starts
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
      sway.step(realDt, running ? 2 : moving ? 1 : 0);

      // Oxygen is the physics engine's (grams, read from the snapshot for the HUD). Body temperature is a visual demo
      // only (no approved model): about 36.8 °C at rest, climbing with hard work (running, and more when the suit falls
      // behind and the visor fogs), cooling back slowly when you rest.
      const bodyTarget = (running ? 38.6 : moving || airborne ? 37.2 : active >= 0 ? 37.1 : 36.8) + 0.6 * fog;
      bodyT += (bodyTarget - bodyT) * Math.min(1, gameDt / (bodyTarget > bodyT ? 40 : 70)); // heats up faster than it cools
      const tempNow = bodyT + hs.tempOffset;
      if (time - lastHud > 0.2) {
        lastHud = time;
        setSample((p) => ({ ...p, tempC: tempNow }));
        setRuntimeSnapshot(state);
        setObjDone((prev) => {
          const next = TASK_PLAN.map((_, i) => prev[i] || state.mission.tasks.some((t) => t.id === engineSiteId(i) && t.status === 'complete'));
          return prev.every((v, i) => v === next[i]) ? prev : next;
        });
      }
      sky.update(camera, time);
      daySky.update(camera);
      base?.update(time);
      // Strayed from the guide (or went to another objective first): re-plan from where you stand.
      if (modeRef.current === 'eva' && active < 0 && guidePoints.length > 1 && time - lastReplan > REPLAN_EVERY_S) {
        lastReplan = time;
        const here = { x: camera.position.x, z: camera.position.z };
        if (distanceToPath(guidePoints, here) > OFF_ROUTE_M && !guideFrom(here)) lastReplan = time + 5; // no path: try again later
      }
      route?.setProgress(camera.position.x, camera.position.z);
      route?.update(time);
      body.position.copy(camera.position);
      if (active < 0 || !tasks[active].lookAt) body.quaternion.copy(camera.quaternion);
      body.updateMatrixWorld();
      for (const task of tasks) task.update(gameDt, time, body);
      // Slide the glass reflection as the head turns (it stays put relative to the world, roughly).
      if (sheenRef.current) {
        camera.getWorldDirection(lookDir);
        const shift = Math.round((Math.atan2(-lookDir.x, -lookDir.z) / Math.PI) * host.clientWidth * 0.6);
        if (shift !== lastSheen) {
          lastSheen = shift;
          sheenRef.current.style.transform = `translate3d(${shift}px, 0, 0)`;
        }
      }
      // Holographic compass: your heading, the next objective and the base (bearings: 0 = north, clockwise).
      {
        const ni = homeBound ? -1 : nextObjective();
        const next = ni >= 0 ? tasks[ni] : null;
        const cx = camera.position.x, cz = camera.position.z;
        const bearingTo = (p: XZ) => Math.atan2(p.x - cx, -(p.z - cz));
        const marks: CompassTarget[] = [];
        if (next) marks.push({ kind: 'objective', bearing: bearingTo(next.anchor), label: `${Math.round(Math.hypot(next.anchor.x - cx, next.anchor.z - cz))} M` });
        if (base) marks.push({ kind: 'base', bearing: bearingTo(base.door) });
        compass.update(Math.atan2(lookDir.x, -lookDir.z), marks);
        vrCompass = { heading: Math.atan2(lookDir.x, -lookDir.z), targets: marks }; // the headset HUD's compass too
      }
      // AR objective marker: projected onto the glass over the next objective (or the airlock on the way home)
      const targetEl = targetRef.current;
      let vrTarget: { at: THREE.Vector3; label: string } | null = null;
      {
        const ni = homeBound ? -1 : nextObjective();
        const next = ni >= 0 ? tasks[ni] : null;
        const pos = next ? next.anchor : base ? base.door : null;
        if (pos && active < 0) {
          const dist = Math.round(Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z));
          vrTarget = { at: pos, label: `${next ? next.title.toUpperCase() : 'BASE AIRLOCK'} · ${dist} M` }; // the same marker in the headset
        }
      }
      if (targetEl && !xr.presenting) {
        const ni = homeBound ? -1 : nextObjective();
        const next = ni >= 0 ? tasks[ni] : null;
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
      const effort = running ? 2 : moving || airborne ? 1 : active >= 0 ? 0.6 : 0;
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
      // A fogged-up suit means you're overheating: breathing gets faster and heavier.
      breathPhase += gameDt / ((effort >= 2 ? 2.2 : effort >= 1 ? 3.0 : 4.4) * (1 - 0.3 * fog));
      if (breathPhase >= 1) {
        breathPhase -= 1;
        audio.breath(Math.max(effort / 2, fog));
        if (!reducedMotion) vrWorld.breathe(Math.max(effort / 2, fog));
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
      audio.update(dt, effort, windRef.current);
      // Tool sounds: the corer drilling, SuperCam laser clicks, the panorama camera.
      const doing = active >= 0 ? tasks[active] : null;
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
      if (outline === 'glass' && !xr.presenting) glass.update(camera, lens.toScreen, host.clientWidth, host.clientHeight);
      if (xr.presenting)
        vrWorld.update(
          { outdoors: true, fog, reticle: false, target: vrTarget, glass: outline === 'glass' && active < 0, me: camera.position, dt: realDt },
          renderer.xr.getBaseLayer() as XRWebGLLayer | null,
        );
      rocks?.update(camera.position.x, camera.position.z);
      shadows?.update(camera.position, u.uSunDir.value);

      draw(scene, EYE);
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
      if (runtimeTimer) clearInterval(runtimeTimer);
      runtimeClock?.dispose();
      runtimeEngine?.dispose();
      ro.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouse);
      renderer.domElement.removeEventListener('pointerdown', touchLookStart);
      renderer.domElement.removeEventListener('pointermove', touchLookMove);
      renderer.domElement.removeEventListener('pointerup', touchLookEnd);
      renderer.domElement.removeEventListener('pointercancel', touchLookEnd);
      renderer.domElement.removeEventListener('lostpointercapture', touchLookEnd);
      touchControls?.dispose();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      controls.dispose();
      gui.destroy();
      sky.dispose();
      daySky.dispose();
      base?.dispose();
      route?.dispose();
      pathPlanner?.dispose();
      setCostTerrain(null);
      setHomeCost(null);
      for (const task of tasks) task.dispose();
      terrain?.geometry.dispose();
      material.dispose();
      lens.dispose();
      vrConsole.dispose();
      vrWorld.dispose();
      xr.dispose();
      vrButton?.remove();
      compass.element.remove();
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

  // The physics' own alerts come first: low or critical O2, mission failed, the playable edge (src/adapters/hud.ts).
  const physicalHud = runtimeSnapshot ? toHelmetHud(runtimeSnapshot) : null;
  const alert: HudAlert | null = physicalHud?.alert ? physicalHud.alert : sample.cyclone
    ? cycloneAlert
    : interaction.kind === 'prompt'
      ? { level: 'info', title: interaction.title, message: interaction.text, acceptKey: 'E', onAccept: () => startSampleRef.current() }
      : interaction.kind === 'sampling'
        ? { level: 'info', title: interaction.title, message: `${interaction.phase}… ${interaction.pct}%` }
        : interaction.kind === 'stored'
          ? { level: 'info', title: interaction.title, message: interaction.text }
          : notice; // (visor fogging has its own line under the bars: HelmetHud status)
  touchInteractRef.current = () => {
    if (modeRef.current !== 'eva') return;
    if (alert?.onAccept) alert.onAccept();
    else startSampleRef.current();
  };

  // Objective lines: done ones show the time taken, the current one counts down (red once over), the rest show
  // their budget. RETURN is the total time left to get back to base.
  // Only the missions picked at the console are on the list.
  const current = headingHome ? -1 : currentObj;
  const items: HudObjective[] = objTitles.flatMap((title, i): HudObjective[] => {
    if (!chosen[i]) return [];
    const budget = TASK_PLAN[i].minutes * 60, spent = objSpent[i];
    if (objDone[i]) return [{ title, time: clock(spent), state: 'done' }];
    if (i !== current) return [{ title, time: clock(budget), state: 'todo' }];
    const left = budget - spent;
    return [{ title, time: left >= 0 ? clock(left) : `+${clock(-left)}`, state: 'current', level: left < 0 ? 'danger' : left < 60 ? 'warning' : 'ok' }];
  });
  if (headingHome) items.push({ title: 'Return to base', time: clock(secondsLeft), state: 'current' });
  const listTotal = objTitles.filter((_, i) => chosen[i]).length;
  const listDone = objTitles.filter((_, i) => chosen[i] && objDone[i]).length;
  const hudObjectives = {
    done: listDone,
    total: listTotal,
    items,
    returnTime: clock(secondsLeft),
    returnLevel: (secondsLeft < 60 ? 'danger' : secondsLeft < 300 ? 'warning' : 'ok') as Level,
  };
  const hudO2 = physicalHud?.o2 ?? { label: 'O₂', value: 'N/A', fraction: 0 };
  const hudStatus = fogWarn ? { title: 'VISOR FOGGING', message: 'Slow down to clear it' } : null;
  // The same props drive the 3D HUD in the headset (src/xr/vrHud.ts).
  vrRef.current = { objectives: hudObjectives, alert, o2: hudO2, temperature: tempBar(sample.tempC), status: hudStatus, fastForward: fast ? FAST_FORWARD : null };

  // ---- the Setup console: missions with their numbers, and the plan's totals. The route is Nanda's planner (cheapest
  // visiting order, weaving round the hills); oxygen and time come from Alex's physics along that route (grams).
  // Distance from the airlock to each objective on its own cheapest path.
  const stopMetres = useMemo(
    () => TASK_PLAN.map((_, i) => pathLength((plannerReady && planRef.current?.(door, [i], false)?.points) || [])),
    [plannerReady, door],
  );
  const missions: SetupMission[] = TASK_PLAN.map((p, i) => ({
    title: TASK_TITLES[p.kind],
    minutes: p.minutes,
    distance: stopMetres[i],
    oxygenGrams: (gramsPerHour(MARS_EVA_DEMO_PROFILE.powerTaskW) * p.minutes) / 60,
    at: STOPS[i],
    done: objDone[i],
  }));
  const planIdx = TASK_PLAN.map((_, i) => i).filter((i) => chosen[i] && !objDone[i]);
  const planKey = planIdx.join(',');
  // The planned EVA: airlock → the two picked objectives → airlock, in the visiting order most likely to get you home
  // (Survival Odds over the cheapest orders, all in the physics' grams).
  const safest = useMemo(
    () => (plannerReady && planKey ? safestRef.current?.(door, planKey.split(',').map(Number)) ?? null : null),
    [plannerReady, door, planKey],
  );
  const tour = safest?.plan ?? null;
  const setupRoute: XZ[] = useMemo(() => (tour ? straightRef.current([...tour.points, ...tour.back.slice(1)]) : [door]), [tour, door]);
  const routeTo = tour ? setupRoute.length - 1 : -1; // the whole route is the plan
  // Oxygen (grams) and time from the physics along the planned route (src/adapters/eva-demo.ts estimateEVA).
  const { levels, planError } = useMemo((): { levels: SetupLevels | null; planError: string | null } => {
    if (!terrainProvider || !tour || mode === 'eva') return { levels: null, planError: null };
    try {
      const b = terrainProvider.bounds;
      const bounds = { minX: b.minX + 100, maxX: b.maxX - 100, minZ: b.minZ + 100, maxZ: b.maxZ - 100 };
      const taskMinutes = planIdx.reduce((a, i) => a + TASK_PLAN[i].minutes, 0);
      const odds = safest ? { ...safest.odds, compared: safest.compared } : null;
      return { levels: { ...estimateAlongRoute(setupRoute, terrainProvider.heightAt, bounds, taskMinutes), odds }, planError: null };
    } catch (error) {
      return { levels: null, planError: error instanceof Error ? error.message : String(error) };
    }
  }, [terrainProvider, tour, safest, setupRoute, planKey, mode]);
  const planFits = !!levels && levels.walkGrams + levels.taskGrams + levels.reserveGrams <= levels.tankGrams && levels.minutes <= levels.evaMinutes;
  const launchWhy = !heightsLoaded
    ? 'Terrain still loading…'
    : !plannerReady ? 'Planning routes…'
    : planIdx.length !== 2 ? 'Select exactly TWO objectives at the console'
    : !tour ? 'No walkable route for this plan'
    : planError ? planError
    : !planFits ? 'The plan does not fit: check O₂ and time at the console' : null;
  vrConsoleRef.current = { missions, chosen: chosen.map((c, i) => c && !objDone[i]), levels, heights: heightsLoaded, route: setupRoute, routeTo, base: door, ready: !launchWhy, why: launchWhy };
  const beginEva = () => {
    setSecondsLeft(EVA_MINUTES * 60);
    setObjSpent((prev) => prev.map((v, i) => (objDone[i] ? v : 0)));
    setCurrentObj(planIdx[0] ?? -1);
    setHeadingHome(false);
    setNotice(null);
    setInteraction({ kind: 'none' });
    setMode('eva');
    beginEvaRef.current(chosen.map((c, i) => c && !objDone[i]), tour);
  };
  launchRef.current = () => {
    if (launchWhy) return launchWhy;
    beginEva();
    return null;
  };

  return (
    <div ref={rootRef} className="preview">
      <div ref={hostRef} className="preview-canvas" />
      <div className={mode === 'eva' ? undefined : 'preview-hidden'}>
      <div ref={glassRef} className="preview-glass" />
      <HelmetHud
        objectives={hudObjectives}
        alert={alert}
        o2={hudO2}
        temperature={tempBar(sample.tempC)}
        swayTargetRef={swayRef}
        sheenRef={sheenRef}
        targetRef={targetRef}
        interiorRef={interiorRef}
        breathRef={breathRef}
        fogRef={fogRef}
        status={hudStatus}
        fastForward={fast ? FAST_FORWARD : null}
        compassRef={compassRef}
      />
      </div>
      {mode === 'eva' && devOn && (
        <div style={{ position: 'absolute', left: 16, bottom: 12, zIndex: 20, color: '#e8edf0', background: '#121820cc', padding: 8, fontSize: 12 }} aria-label="EVA physics telemetry">
          <div>{runtimeSnapshot?.physics?.emergencyTest ? 'TEST: 2 g EMERGENCY · ' : ''}ENGINEERING SCENARIO · {runtimeSnapshot?.mission.status ?? 'loading'} · {runtimeSnapshot?.paused ? 'PAUSED' : runtimeSnapshot?.physics?.activity}</div>
          <div>O₂ {runtimeSnapshot?.resources.oxygenGrams?.toFixed(3)} / 750 g · {runtimeSnapshot?.physics?.oxygenRateGramsPerHour.toFixed(2)} g/h · {runtimeSnapshot?.physics?.metabolicPowerWatts.toFixed(1)} W</div>
          <div>Elapsed {runtimeSnapshot?.simTimeSeconds.toFixed(1)} s · X {runtimeSnapshot?.player.position.x.toFixed(2)} · Z {runtimeSnapshot?.player.position.z.toFixed(2)} m · TEMP {physicalHud?.temperature.value ?? 'N/A'} · MODELED / NOT NASA-VALIDATED</div>
          <div>Terrain: demo-shaped HiRISE-derived</div>
          <button onClick={() => { const e = runtimeRef.current; if (!e) return; e.dispatch({ type: e.getSnapshot().paused ? 'resume' : 'pause' }); runtimePausedRef.current = e.getSnapshot().paused; if (runtimePausedRef.current) document.exitPointerLock(); setRuntimeSnapshot(e.getSnapshot()); }}>{runtimeSnapshot?.paused ? 'Resume' : 'Pause'}</button>
          <button onClick={() => { if (window.location.search) window.location.replace(window.location.pathname + window.location.hash); else window.location.reload(); }}>Reset to base</button> <a href={RAW_DIAGNOSTICS_URL}>RAW diagnostics</a>
        </div>
      )}
      {mode === 'base' && devOn && (
        <details style={{ position: 'absolute', bottom: 8, left: 12, zIndex: 20, color: 'white' }}>
          <summary>Developer test {PARAMS.get('emergency') === '1' ? '· TEST: 2 g EMERGENCY ACTIVE' : ''}</summary>
          <a href="?emergency=1">TEST: 2 g emergency oxygen on next EVA</a> · <a href={RAW_DIAGNOSTICS_URL}>RAW diagnostics</a>
        </details>
      )}
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
            upcoming={UPCOMING_TASKS}
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
        PREVIEW · inside: WASD, click the console to plan (Esc to stand up), E at the hatch to go out · outside: click to look, WASD to walk, Shift to run, Space to jump, E to do an objective or accept, hold F for 4x speed, M to mute, T to turn the topology off and on,
        O to move the path outline between the world and the glass, Esc to release
        <br />
        {terrainNote}
        <br />
        <span ref={fpsRef}>measuring…</span>
      </div>
    </div>
  );
}
