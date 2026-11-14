// Written with AI assistance (Codex). Pure TypeScript; no platform or renderer imports.
import { contains, validateBounds, validateRoute, TASK_IDS, type Command, type DeepReadonly, type EngineSnapshot, type Mission, type Region, type SemanticEvent, type XZ } from './contracts.ts';
export type DemoMovement = { walkMetresPerSecond: number; runMetresPerSecond: number; eyeHeightMetres: number };
export const DEMO_MOVEMENT = { walkMetresPerSecond: 3, runMetresPerSecond: 8, eyeHeightMetres: 1.7 } as const; // demo approximations; no suit physics
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value as DeepReadonly<T>;
}
export function createEngine(region: Region, mission: Mission, canOccupy: (p: XZ) => boolean = () => true, speeds: DemoMovement = DEMO_MOVEMENT) {
  validateBounds(region.visibleBounds); validateBounds(region.playableBounds);
  const b = { ...region.playableBounds };
  if (!contains(region.visibleBounds, { x: b.minX, z: b.minZ }) || !contains(region.visibleBounds, { x: b.maxX, z: b.maxZ }) || mission.regionId !== region.id || !contains(b, mission.shuttle) || !canOccupy(mission.shuttle)) throw new Error('Invalid region or shuttle');
  if (new Set(mission.tasks.map(t => t.id)).size !== mission.tasks.length || mission.tasks.some(t => !TASK_IDS.includes(t.type) || !contains(b, t.position) || !canOccupy(t.position) || !['pending','active','complete','failed'].includes(t.status))) throw new Error('Invalid task site');
  if (![speeds.walkMetresPerSecond, speeds.runMetresPerSecond].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid demo speed');
  const initial: EngineSnapshot = { simTimeSeconds: 0, paused: false, region: clone(region), player: { position: clone(mission.shuttle), movementMode: 'idle' }, mission: { ...clone(mission), route: validateRoute(mission.route, b) }, resources: { oxygenGrams: null, oxygenCapacityGrams: null }, boundaryWarning: false };
  let state = clone(initial), direction = { x: 0, z: 0 }, running = false, disposed = false;
  let snapshot = freeze(clone(state));
  const subscribers = new Set<(s: DeepReadonly<EngineSnapshot>) => void>();
  const events = new Set<(event: SemanticEvent) => void>();
  const publish = () => { snapshot = freeze(clone(state)); subscribers.forEach(fn => fn(snapshot)); };
  const emit = (event: SemanticEvent) => events.forEach(fn => fn(freeze(event)));
  const engine = {
    getSnapshot: () => snapshot,
    subscribe(fn: (s: DeepReadonly<EngineSnapshot>) => void) { if (disposed) throw new Error('Disposed engine'); subscribers.add(fn); return () => { subscribers.delete(fn); }; },
    onEvent(fn: (event: SemanticEvent) => void) { if (disposed) throw new Error('Disposed engine'); events.add(fn); return () => { events.delete(fn); }; },
    dispatch(command: Command) {
      if (disposed) return;
      if (command.type === 'reset') { state = clone(initial); direction = { x: 0, z: 0 }; running = false; emit({ type: 'reset', simTimeSeconds: 0 }); }
      else if (command.type === 'pause' || command.type === 'resume') { state.paused = command.type === 'pause'; direction = { x: 0, z: 0 }; state.player.movementMode = 'idle'; }
      else if (command.type === 'input') {
        if (![command.direction.x, command.direction.z].every(Number.isFinite)) throw new Error('Nonfinite movement');
        const length = Math.hypot(command.direction.x, command.direction.z);
        direction = length ? { x: command.direction.x / length, z: command.direction.z / length } : { x: 0, z: 0 }; running = command.run;
      } else if (command.type === 'route') state.mission.route = validateRoute(command.route, b);
      else if (command.type === 'task-start' || command.type === 'task-finish') {
        if (state.paused) return;
        const task = state.mission.tasks.find(t => t.id === command.siteId);
        if (!task || Math.hypot(task.position.x - state.player.position.x, task.position.z - state.player.position.z) > 5) return;
        if (command.type === 'task-start' && task.status === 'pending') { task.status = 'active'; emit({ type: 'task-started', siteId: task.id, taskId: task.type, simTimeSeconds: state.simTimeSeconds }); }
        if (command.type === 'task-finish' && task.status === 'active') { task.status = 'complete'; emit({ type: 'task-completed', siteId: task.id, taskId: task.type, simTimeSeconds: state.simTimeSeconds }); }
      }
      publish();
    },
    step(seconds: number) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.25) throw new Error('Step must be 0..0.25 seconds');
      if (disposed || state.paused || !seconds) return;
      state.simTimeSeconds += seconds;
      const p = state.player.position, speed = running ? speeds.runMetresPerSecond : speeds.walkMetresPerSecond;
      const wanted = { x: p.x + direction.x * speed * seconds, z: p.z + direction.z * speed * seconds };
      const next = { x: Math.max(b.minX, Math.min(b.maxX, wanted.x)), z: Math.max(b.minZ, Math.min(b.maxZ, wanted.z)) };
      if (canOccupy(next)) state.player.position = next;
      state.boundaryWarning = Math.min(next.x-b.minX,b.maxX-next.x,next.z-b.minZ,b.maxZ-next.z) < 10;
      state.player.movementMode = state.player.position.x === p.x && state.player.position.z === p.z ? 'idle' : running ? 'run' : 'walk';
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
