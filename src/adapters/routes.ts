// Written with AI assistance (Codex). App-owned v1 boundary; no planner implementation.
import { CatmullRomCurve3, Vector3 } from 'three';
import { contains, validateRoute, type DeepReadonly, type Mission, type Region, type Route } from '../core/contracts.ts';
import type { Engine } from '../core/engine.ts';
import type { HeightProvider } from './world.ts';
export const SITE_TOLERANCE_METRES = 1; // integration tolerance only, not a physical suitability threshold
const CLEARANCE_METRES = 0.75; // conservative radius for Rachel's centred 0.86 x 0.84 m chevron + bevel
const MAX_TABLE_STEPS = 200000; // reject oversized visuals rather than block/allocate without bound
export function validateSceneRoute(route: DeepReadonly<Route>, region: DeepReadonly<Region>, mission: DeepReadonly<Mission>, terrain: HeightProvider): void {
  if (terrain.contractVersion !== 1 || terrain.regionId !== region.id || terrain.frameId !== region.frameId || !terrain.terrainRevision || (region.terrainRevision && terrain.terrainRevision !== region.terrainRevision)) throw new Error('Terrain region/frame/revision mismatch');
  validateRoute(route as Route, region.playableBounds);
  const context = route.context;
  if (context) {
    if (context.contractVersion !== 1 || context.regionId !== region.id || context.frameId !== region.frameId || context.terrainRevision !== terrain.terrainRevision) throw new Error('Route region/frame/revision mismatch');
    const sources = { demo: 'demo', 'trained-ml': 'ml', classical: 'computed', hybrid: 'hybrid' } as const;
    if (!context.planner || sources[context.planner.kind] !== route.source || !context.planner.name?.trim() || !context.planner.version?.trim()) throw new Error('Route planner provenance mismatch');
  } else if (route.source !== 'demo' && route.source !== 'none') throw new Error('Planned route requires v1 context');
  if (route.source === 'none') return;
  if (route.source !== 'demo') {
    if (!context || !Array.isArray(context.visitOrder) || context.visitOrder.length !== 2 || mission.tasks.length !== 2 || new Set(context.visitOrder).size !== 2 || context.visitOrder.some(id => !mission.tasks.some(t => t.id === id))) throw new Error('Route requires both objective IDs in visitOrder');
    if (Math.hypot(route.points[0].x-mission.shuttle.x, route.points[0].z-mission.shuttle.z) > SITE_TOLERANCE_METRES) throw new Error('Route must start at shuttle');
    // First waypoint within tolerance of each objective determines visitation order.
    const visits = context.visitOrder.map(id => {
      const site = mission.tasks.find(t => t.id === id)!;
      return route.points.findIndex(p => Math.hypot(p.x-site.position.x,p.z-site.position.z) <= SITE_TOLERANCE_METRES);
    });
    if (visits[0] < 0 || visits[1] <= visits[0]) throw new Error('Route missing required objective or wrong visit order');
  }
  // Match routePath.ts: same Three.js centripetal curve, default arc-length divisions,
  // and 25 cm spaced table. Arrows interpolate LINEARLY between these table entries.
  const curve = new CatmullRomCurve3(route.points.map(p => new Vector3(p.x,0,p.z)), false, 'centripetal');
  const length = curve.getLength(), steps = Math.max(2,Math.ceil(length*4));
  if (!Number.isFinite(length) || length <= 0 || steps > MAX_TABLE_STEPS) throw new Error('Route visual exceeds supported length');
  const table = curve.getSpacedPoints(steps);
  if (route.source !== 'demo' && context) {
    const visits=context.visitOrder.map(id => {
      const site=mission.tasks.find(t => t.id === id)!;
      return table.findIndex(p => Math.hypot(p.x-site.position.x,p.z-site.position.z) <= SITE_TOLERANCE_METRES);
    });
    if (visits[0] < 0 || visits[1] <= visits[0]) throw new Error('Rendered route misses objective tolerance or visit order');
  }
  for (let i=1; i<table.length; i++) {
    const a=table[i-1], b=table[i];
    const area = { minX: Math.min(a.x,b.x)-CLEARANCE_METRES, maxX: Math.max(a.x,b.x)+CLEARANCE_METRES, minZ: Math.min(a.z,b.z)-CLEARANCE_METRES, maxZ: Math.max(a.z,b.z)+CLEARANCE_METRES };
    if (!contains(region.playableBounds,{x:area.minX,z:area.minZ}) || !contains(region.playableBounds,{x:area.maxX,z:area.maxZ}) || !terrain.coversArea(area)) throw new Error('Interpolated route/arrow footprint leaves playable bounds or crosses terrain no-data');
  }
}
export function applyRouteCandidate(engine: Engine, terrain: HeightProvider, route: Route): { ok: boolean; reason?: string } {
  try {
    const s=engine.getSnapshot(); validateSceneRoute(route,s.region,s.mission,terrain);
    engine.dispatch({type:'route',route}); return {ok:true};
  } catch (error) {
    const reason=error instanceof Error ? error.message : String(error);
    engine.dispatch({type:'route',route:{source:'none',points:[],unavailableReason:reason}});
    return {ok:false,reason};
  }
}
// The same controller is exercised by tests and the live RAF; failed identities are
// remembered, so invalid candidates do not rebuild or throw on every frame.
export function createRouteVisual<T extends { dispose(): void; setProgress(x:number,z:number):void; update(t:number):void }>(
  validate: (route: DeepReadonly<Route>) => void,
  build: (route: DeepReadonly<Route>) => T,
  detach: (visual:T) => void,
  report: (reason:string|null) => void,
) {
  let identity: DeepReadonly<Route> | undefined, visual:T|null=null;
  const remove=() => {
    const previous=visual; visual=null;
    if (previous) { try { detach(previous); } finally { previous.dispose(); } }
  };
  const fail=(error:unknown) => {
    let reason=error instanceof Error ? error.message : String(error);
    try { remove(); } catch (cleanupError) { reason += `; route cleanup failed: ${String(cleanupError)}`; }
    report(`Route unavailable: ${reason}`);
  };
  return {
    tick(route:DeepReadonly<Route>, x:number, z:number, t:number) {
      try {
        if (identity !== route) {
          remove(); identity=route; validate(route);
          report(route.unavailableReason ? `Route unavailable: ${route.unavailableReason}` : null);
          if (route.source !== 'none') visual=build(route);
        }
        visual?.setProgress(x,z); visual?.update(t);
      } catch (error) { fail(error); }
    },
    dispose:remove,
  };
}
