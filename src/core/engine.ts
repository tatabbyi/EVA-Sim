// Written with AI assistance (Codex). Pure TypeScript; no platform or renderer imports.
import { contains, validateBounds, validateRoute, TASK_IDS, PREVIEW_ONLY_TASK_IDS, type Command, type DeepReadonly, type EngineSnapshot, type Mission, type Region, type SemanticEvent, type XZ } from './contracts.ts';
import { gramsPerHour, integrateLifeSupport, massAndWeight, oxygenWarning, physicsMotion, validatePhysicsOptions, type DemoPhysicsOptions, type PhysicsTelemetry } from './physics.ts';
export type DemoMovement = { walkMetresPerSecond: number; runMetresPerSecond: number; eyeHeightMetres: number };
export const DEMO_MOVEMENT = { walkMetresPerSecond: 3, runMetresPerSecond: 8, eyeHeightMetres: 1.7 } as const; // demo approximations; no suit physics
const clone = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value as DeepReadonly<T>;
}
export function createEngine(region: Region, mission: Mission, canOccupy: (p: XZ) => boolean = () => true, speeds: DemoMovement = DEMO_MOVEMENT, physicsOptions?: DemoPhysicsOptions) {
  validateBounds(region.visibleBounds); validateBounds(region.playableBounds);
  const b = { ...region.playableBounds };
  if (!contains(region.visibleBounds, { x: b.minX, z: b.minZ }) || !contains(region.visibleBounds, { x: b.maxX, z: b.maxZ }) || mission.regionId !== region.id || !contains(b, mission.shuttle) || !canOccupy(mission.shuttle)) throw new Error('Invalid region or shuttle');
  if (new Set(mission.tasks.map(t => t.id)).size !== mission.tasks.length || mission.tasks.some(t =>
    !(TASK_IDS.some(id => id === t.type) || (!physicsOptions && PREVIEW_ONLY_TASK_IDS.some(id => id === t.type))) ||
    !contains(b, t.position) || !canOccupy(t.position) ||
    !['pending','active','complete','failed'].includes(t.status))) throw new Error('Invalid task site');
  if (![speeds.walkMetresPerSecond, speeds.runMetresPerSecond].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid demo speed');
  const initial: EngineSnapshot = { simTimeSeconds: 0, paused: false, region: clone(region), player: { position: clone(mission.shuttle), movementMode: 'idle' }, mission: { ...clone(mission), route: validateRoute(mission.route, b) }, resources: { oxygenGrams: null, oxygenCapacityGrams: null }, boundaryWarning: false };
  // Capture caller-owned configuration once; published telemetry has no provider/function.
  const physics = physicsOptions ? { ...physicsOptions, profile: Object.freeze({ ...physicsOptions.profile }) } : undefined;
  if (physics) {
    validatePhysicsOptions(physics);
    const h=physics.heightAt(mission.shuttle.x,mission.shuttle.z);
    if (h === null || !Number.isFinite(h)) throw new Error('Physics shuttle terrain unavailable');
    const p=physics.profile, oxygenGrams=physics.initialOxygenGrams ?? p.oxygenCapacityGrams;
    initial.resources={oxygenGrams,oxygenCapacityGrams:p.oxygenCapacityGrams};
    initial.mission={...initial.mission,status:oxygenGrams === 0 ? 'failed' : 'active'};
    initial.physics={ profileId:p.id, emergencyTest:physics.emergencyTest === true,
      activity:oxygenGrams === 0 ? 'failed' : 'idle',
      metabolicPowerWatts:oxygenGrams === 0 ? 0 : p.powerIdleW,
      oxygenRateGramsPerHour:oxygenGrams === 0 ? 0 : gramsPerHour(p.powerIdleW), energySpentJ:0,
      currentSlopeDeg:0,carriedMassKg:physics.carriedMassKg,...massAndWeight(p,physics.carriedMassKg),
      speedMetresPerSecond:0,oxygenWarning:oxygenWarning(oxygenGrams,p),
      ambientTemperatureC:p.ambientTemperatureC,ambientPressurePa:p.ambientPressurePa,
      co2VolumeFraction:p.co2VolumeFraction,gravityMps2:p.gravityMps2 };
  }
  freeze(initial);
  let state = initial, direction = { x: 0, z: 0 }, running = false, disposed = false;
  let snapshot = freeze(state);
  const subscribers = new Set<(s: DeepReadonly<EngineSnapshot>) => void>();
  const events = new Set<(event: SemanticEvent) => void>();
  const publish = () => { if (snapshot === state) return; snapshot = freeze(state); subscribers.forEach(fn => fn(snapshot)); };
  const emit = (event: SemanticEvent) => events.forEach(fn => fn(freeze(event)));
  let initialFailurePending=physics !== undefined && initial.resources.oxygenGrams === 0;
  const idleTelemetry = (): PhysicsTelemetry | undefined => {
    if (!state.physics || !physics) return undefined;
    const taskActive=state.mission.tasks.some(t=>t.status === 'active');
    const power=taskActive ? physics.profile.powerTaskW : physics.profile.powerIdleW;
    return {...state.physics,activity:taskActive ? 'task' : 'idle',metabolicPowerWatts:power,
      oxygenRateGramsPerHour:gramsPerHour(power),speedMetresPerSecond:0,currentSlopeDeg:0};
  };
  const engine = {
    getSnapshot: () => snapshot,
    subscribe(fn: (s: DeepReadonly<EngineSnapshot>) => void) { if (disposed) throw new Error('Disposed engine'); subscribers.add(fn); return () => { subscribers.delete(fn); }; },
    onEvent(fn: (event: SemanticEvent) => void) { if (disposed) throw new Error('Disposed engine'); events.add(fn); return () => { events.delete(fn); }; },
    dispatch(command: Command) {
      if (disposed || (state.mission.status === 'failed' && command.type !== 'reset')) return;
      if (command.type === 'reset') { state = initial; initialFailurePending=physics !== undefined && initial.resources.oxygenGrams === 0; direction = { x: 0, z: 0 }; running = false; emit({ type: 'reset', simTimeSeconds: 0 }); }
      else if (command.type === 'pause' || command.type === 'resume') { const paused = command.type === 'pause'; direction = { x: 0, z: 0 }; running = false;
        if (state.paused !== paused || state.player.movementMode !== 'idle') state = { ...state, paused, player: { ...state.player, movementMode: 'idle' }, ...(physics ? {physics:idleTelemetry()} : {}) }; }
      else if (command.type === 'input') {
        if (![command.direction.x, command.direction.z].every(Number.isFinite)) throw new Error('Nonfinite movement');
        const length = Math.hypot(command.direction.x, command.direction.z);
        direction = length ? { x: command.direction.x / length, z: command.direction.z / length } : { x: 0, z: 0 }; running = command.run;
        return; // Input is private controller state; the next step publishes visible movement.
      } else if (command.type === 'route') {
        if (command.route === state.mission.route) return;
        state = { ...state, mission: { ...state.mission, route: validateRoute(command.route, b) } };
        emit({ type: 'route-changed', source: state.mission.route.source, simTimeSeconds: state.simTimeSeconds });
      }
      else if (command.type === 'task-start' || command.type === 'task-finish') {
        if (state.paused) return;
        const task = state.mission.tasks.find(t => t.id === command.siteId);
        if (!task) return;
        const distance=Math.hypot(task.position.x-state.player.position.x,task.position.z-state.player.position.z);
        // Visual-only legacy SuperCam laser uses its historic 2-7 m viewing range.
        const inRange=task.type === 'laser-scan' && !physics
          ? (command.type === 'task-start' ? distance >= 2 && distance <= 7 : distance <= 7)
          : distance <= 5;
        if (!inRange) return;
        if (physics && command.type === 'task-start' && state.mission.tasks.some(t=>t.status === 'active')) return;
        if (command.type === 'task-start' && task.status === 'pending') { state = { ...state, mission: { ...state.mission, tasks: state.mission.tasks.map(t => t === task ? { ...t, status: 'active' } : t) } }; emit({ type: 'task-started', siteId: task.id, taskId: task.type, simTimeSeconds: state.simTimeSeconds }); }
        if (command.type === 'task-finish' && task.status === 'active') { state = { ...state, mission: { ...state.mission, tasks: state.mission.tasks.map(t => t === task ? { ...t, status: 'complete' } : t) } }; emit({ type: 'task-completed', siteId: task.id, taskId: task.type, simTimeSeconds: state.simTimeSeconds }); }
      }
      if (physics && (command.type === 'task-start' || command.type === 'task-finish')) state={...state,player:{...state.player,movementMode:'idle'},physics:idleTelemetry()};
      publish();
    },
    // Legacy Rachel preview may adjust the camera pose for kneeling. Disabled for
    // physics-enabled EVA to prevent teleports or bypassing terrain/O2 gates.
    setPosition(position: XZ): boolean {
      if (disposed || physics || state.paused || state.mission.status === 'failed' ||
          !contains(b,position) || !canOccupy(position)) return false;
      if (state.player.position.x === position.x && state.player.position.z === position.z) return true;
      direction={x:0,z:0}; running=false;
      state={...state,player:{position:clone(position),movementMode:'idle'}};
      publish();
      return true;
    },
    step(seconds: number) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.25) throw new Error('Step must be 0..0.25 seconds');
      if (disposed || state.paused || !seconds) return;
      if (initialFailurePending) { initialFailurePending=false; emit({type:'mission-failed',reason:'oxygen-depleted',simTimeSeconds:0}); }
      if (state.mission.status === 'failed') return;
      if (physics && state.physics && state.resources.oxygenGrams !== null) {
        const oldWarning=state.physics.oxygenWarning, p=state.player.position;
        const motion=physicsMotion(physics,p,direction,running,state.mission.tasks.some(t=>t.status === 'active'),seconds,b,canOccupy);
        const gas=integrateLifeSupport(state.resources.oxygenGrams,motion.metabolicPowerWatts,seconds);
        // The same constant-per-step rate drives position, time and energy through the
        // exact surviving fraction of the final dt. No post-exhaustion travel is credited.
        const fraction=gas.elapsedSeconds/seconds;
        const position={x:p.x+(motion.position.x-p.x)*fraction,z:p.z+(motion.position.z-p.z)*fraction};
        const moving=position.x !== p.x || position.z !== p.z;
        const warning=oxygenWarning(gas.oxygenGrams,physics.profile);
        const telemetry: PhysicsTelemetry={...state.physics,activity:gas.depleted ? 'failed' : motion.activity,
          metabolicPowerWatts:gas.depleted ? 0 : motion.metabolicPowerWatts,
          oxygenRateGramsPerHour:gas.depleted ? 0 : gas.oxygenRateGramsPerHour,
          speedMetresPerSecond:gas.depleted ? 0 : motion.speedMetresPerSecond,
          currentSlopeDeg:motion.currentSlopeDeg,energySpentJ:state.physics.energySpentJ+gas.energyJ,oxygenWarning:warning};
        state={...state,simTimeSeconds:state.simTimeSeconds+gas.elapsedSeconds,
          player:{position,movementMode:gas.depleted || !moving ? 'idle' : running ? 'run' : 'walk'},
          mission:gas.depleted ? {...state.mission,status:'failed'} : state.mission,
          resources:{...state.resources,oxygenGrams:gas.oxygenGrams},physics:telemetry,
          boundaryWarning:motion.boundaryBlocked || Math.min(position.x-b.minX,b.maxX-position.x,position.z-b.minZ,b.maxZ-position.z) < 10};
        if (gas.depleted) { direction={x:0,z:0}; running=false; }
        const eventTime=state.simTimeSeconds;
        publish(); // Failure observers see the terminal snapshot before semantic events.
        if (warning !== oldWarning) emit({type:'oxygen-warning',level:warning,simTimeSeconds:eventTime});
        if (gas.depleted) emit({type:'mission-failed',reason:'oxygen-depleted',simTimeSeconds:eventTime});
        return;
      }
      const p = state.player.position, speed = running ? speeds.runMetresPerSecond : speeds.walkMetresPerSecond;
      const wanted = { x: p.x + direction.x * speed * seconds, z: p.z + direction.z * speed * seconds };
      const next = { x: Math.max(b.minX, Math.min(b.maxX, wanted.x)), z: Math.max(b.minZ, Math.min(b.maxZ, wanted.z)) };
      const position = canOccupy(next) ? next : p;
      const boundaryWarning = Math.min(next.x-b.minX,b.maxX-next.x,next.z-b.minZ,b.maxZ-next.z) < 10;
      const movementMode = position.x === p.x && position.z === p.z ? 'idle' : running ? 'run' : 'walk';
      state = { ...state, simTimeSeconds: state.simTimeSeconds + seconds, boundaryWarning, player: { position, movementMode } };
      publish();
    },
    start() { engine.dispatch({ type: 'resume' }); },
    pause() { engine.dispatch({ type: 'pause' }); },
    resume() { engine.dispatch({ type: 'resume' }); },
    reset() { engine.dispatch({ type: 'reset' }); },
    dispose() { disposed = true; subscribers.clear(); events.clear(); },
  };
  return engine;
}
export type Engine = ReturnType<typeof createEngine>;
