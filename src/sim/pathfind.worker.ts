// Written with AI assistance (Claude). Owner: Nanda. Worker side of planner.ts: one cost-to-goal field per request.
import { computeField, type Lattice } from './pathfind.ts';

let lattice: Lattice;
self.onmessage = ({ data }: MessageEvent) => {
  if (data.lattice) lattice = data.lattice;
  else {
    const field = computeField(lattice, data.goal);
    self.postMessage({ id: data.id, field }, { transfer: [field.cost.buffer, field.next.buffer] });
  }
};
