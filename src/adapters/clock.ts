// Written with AI assistance (Codex). Fixed 60 Hz simulation, independent of renderer RAF.
import type { Engine } from '../core/engine.ts';
export function createFixedClock(engine: Engine) {
  let previous: number | null = null, accumulated = 0;
  const offReset = engine.onEvent(event => { if (event.type === 'reset') { previous = null; accumulated = 0; } });
  return {
    tick(nowSeconds: number) {
      if (!Number.isFinite(nowSeconds)) return;
      if (previous === null) { previous = nowSeconds; return; }
      const elapsed = nowSeconds - previous; previous = nowSeconds;
      // Ignore suspend/focus gaps rather than simulate a backlog of unobserved play.
      if (elapsed < 0 || elapsed > 0.25 || engine.getSnapshot().paused) { accumulated = 0; return; }
      accumulated += elapsed;
      while (accumulated + 1e-10 >= 1/60) { engine.step(1/60); accumulated -= 1/60; }
    },
    dispose() { offReset(); },
    reset() { previous = null; accumulated = 0; },
  };
}
