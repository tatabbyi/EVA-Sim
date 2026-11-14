// Written with AI assistance (Claude). Owner: Nanda. Computes cost-to-goal fields in a Web Worker (about 1 s each on
// the 4 m Jezero lattice), cached per goal. Paths from them are instant: see planTour/pathFrom in pathfind.ts.

import type { CostField, Lattice, XZ } from './pathfind.ts';

export interface PathPlanner { field(goal: XZ): Promise<CostField>; dispose(): void }

export function createPathPlanner(lattice: Lattice): PathPlanner {
  const worker = new Worker(new URL('./pathfind.worker.ts', import.meta.url), { type: 'module' });
  const cache = new Map<string, Promise<CostField>>(), pending = new Map<number, (f: CostField) => void>();
  worker.onmessage = (e: MessageEvent<{ id: number; field: CostField }>) => pending.get(e.data.id)?.(e.data.field);
  // A copy, so this thread keeps its lattice for path lookups.
  const copy = { ...lattice, height: lattice.height.slice(), blocked: lattice.blocked.slice() };
  worker.postMessage({ lattice: copy }, [copy.height.buffer, copy.blocked.buffer]);
  return {
    field(goal) {
      const key = `${goal.x.toFixed(2)},${goal.z.toFixed(2)}`;
      if (!cache.has(key))
        cache.set(key, new Promise<CostField>((resolve, reject) => {
          const id = cache.size;
          pending.set(id, (f) => {
            pending.delete(id);
            resolve(f);
          });
          worker.onerror = (e) => reject(new Error(e.message || 'Path worker failed'));
          worker.postMessage({ id, goal: { x: goal.x, z: goal.z } });
        }));
      return cache.get(key)!;
    },
    dispose: () => worker.terminate(),
  };
}
