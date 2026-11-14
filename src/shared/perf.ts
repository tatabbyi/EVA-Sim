// Written with AI assistance (Claude).
// Adaptive resolution: keeps the frame rate up by rendering fewer pixels when frames run slow, and more when there's
// headroom. Checks once a second. Anyone with a WebGLRenderer can use it (preview, Alex's app, Nanda's walk mode).

import type * as THREE from 'three';

export interface AdaptiveResolution {
  readonly pixelRatio: number;
  /** Call once per frame with the real (unclamped) frame time. Returns true when the pixel ratio changed. */
  frame(dtSeconds: number): boolean;
}

export function createAdaptiveResolution(
  renderer: THREE.WebGLRenderer,
  opts: { min?: number; max?: number; slowMs?: number; fastMs?: number } = {},
): AdaptiveResolution {
  const max = opts.max ?? Math.min(window.devicePixelRatio || 1, 1.5);
  const min = Math.min(max, opts.min ?? 0.6);
  const slowMs = opts.slowMs ?? 22; // under ~45 fps: drop resolution
  const fastMs = opts.fastMs ?? 13; // over ~75 fps: raise it again
  let pr = max;
  let acc = 0, frames = 0;
  renderer.setPixelRatio(pr);

  return {
    get pixelRatio() {
      return pr;
    },
    frame(dt) {
      if (dt <= 0 || dt > 0.25) return false; // ignore tab switches and hiccups
      acc += dt;
      frames++;
      if (acc < 1) return false;
      const avgMs = (acc / frames) * 1000;
      acc = 0;
      frames = 0;
      const next = avgMs > slowMs ? Math.max(min, pr - 0.15) : avgMs < fastMs ? Math.min(max, pr + 0.1) : pr;
      if (Math.abs(next - pr) < 1e-3) return false;
      pr = next;
      renderer.setPixelRatio(pr);
      return true;
    },
  };
}
