// Written with AI assistance (Codex). Shared RAW v0.1 contract; all distances metres, time seconds.
export const TASK_IDS = ['abrade-rock', 'take-core', 'sample-depot', 'run-moxie'] as const;
export type TaskId = typeof TASK_IDS[number];
export type XZ = { x: number; z: number }; // east, south
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Region = { id: string; frameId: string; crs: string; origin: { X: number; Y: number; h0: number }; visibleBounds: Bounds; playableBounds: Bounds };
export type Route = { source: 'demo' | 'ml' | 'none'; points: XZ[] };
export type Task = { id: string; type: TaskId; position: XZ; status: 'pending' | 'active' | 'complete' | 'failed' };
export type Mission = { regionId: string; shuttle: XZ; tasks: Task[]; route: Route };
export type EngineSnapshot = { simTimeSeconds: number; paused: boolean; region: Region; player: { position: XZ; movementMode: 'idle' | 'walk' | 'run' }; mission: Mission; resources: { oxygenGrams: number | null; oxygenCapacityGrams: number | null }; boundaryWarning: boolean };
export type SemanticEvent = { type: 'task-started' | 'task-completed'; siteId: string; taskId: TaskId; simTimeSeconds: number } | { type: 'reset'; simTimeSeconds: 0 };
export type Command = { type: 'input'; direction: XZ; run: boolean } | { type: 'pause' | 'resume' | 'reset' } | { type: 'task-start' | 'task-finish'; siteId: string } | { type: 'route'; route: Route };
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export function contains(b: Bounds, p: XZ): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.z) && p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
}
export function validateBounds(b: Bounds): void {
  if (![b.minX, b.maxX, b.minZ, b.maxZ].every(Number.isFinite) || b.minX >= b.maxX || b.minZ >= b.maxZ) throw new Error('Invalid metric bounds');
}
export function validateRoute(route: Route, bounds: Bounds): Route {
  if (!['demo', 'ml', 'none'].includes(route.source) || !Array.isArray(route.points) || route.points.length > 10000 || (route.source === 'none' ? route.points.length !== 0 : route.points.length < 2) || route.points.some(p => !contains(bounds, p))) throw new Error('Invalid local-metre route');
  for (let i = 1; i < route.points.length; i++) if (Math.hypot(route.points[i].x - route.points[i-1].x, route.points[i].z - route.points[i-1].z) < 0.001) throw new Error('Repeated route point');
  return { source: route.source, points: route.points.map(p => ({ ...p })) };
}
export function routeLabel(source: Route['source']): string { return source === 'demo' ? 'DEMO route' : source === 'ml' ? 'ML route' : 'No route'; }
