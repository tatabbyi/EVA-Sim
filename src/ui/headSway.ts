// Written with AI assistance (Claude).
// Owner: Rachel. Your head moves inside the helmet: when you look around, the head turns first and the helmet
// (visor edge and everything on the glass) lags behind, then springs back. Walking adds a small bob, running a bigger one.
// Writes a transform straight onto the helmet element (HelmetHud's swayTargetRef). Doing it on one element, rather than
// through inherited CSS variables, avoids restyling every HUD element each frame.
// Reusable by Nanda's walk mode: call look() on mouse moves and step() once per frame.

const STIFFNESS = 40; // spring back to centre
const DAMPING = 9; // ~0.7 of critical: one soft overshoot
const LOOK_GAIN = 4; // px/s of sway per px of mouse movement
const MAX_OFFSET = 36; // px

export interface HeadSway {
  /** Mouse movement in px (e.g. MouseEvent.movementX / movementY). */
  look(dx: number, dy: number): void;
  /** Once per frame. speed: 0 = standing, 1 = walking, 2 = running. */
  step(dt: number, speed: number): void;
  /** Current helmet offset in CSS pixels (for anything else that moves with the helmet, e.g. the 3D interior). */
  readonly offset: { x: number; y: number };
}

export function createHeadSway(target: HTMLElement): HeadSway {
  let x = 0, y = 0, vx = 0, vy = 0;
  let phase = 0, amp = 0;
  let last = '';
  const offset = { x: 0, y: 0 };

  return {
    offset,
    look(dx, dy) {
      vx -= dx * LOOK_GAIN;
      vy -= dy * LOOK_GAIN;
    },
    step(rawDt, speed) {
      const dt = Math.min(rawDt, 0.05);
      vx += (-STIFFNESS * x - DAMPING * vx) * dt;
      vy += (-STIFFNESS * y - DAMPING * vy) * dt;
      x = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, x + vx * dt));
      y = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, y + vy * dt));

      // Footstep bob: amplitude eases towards the target so starting and stopping look smooth.
      const targetAmp = speed >= 2 ? 6 : speed >= 1 ? 2.5 : 0;
      amp += (targetAmp - amp) * Math.min(1, dt * 6);
      phase += dt * (speed >= 2 ? 11 : 7);
      const bobX = Math.cos(phase / 2) * amp * 0.6;
      const bobY = Math.abs(Math.sin(phase)) * amp;

      // Rounded so a helmet at rest stops touching the DOM entirely.
      // Whole pixels and no rotation: the helmet layer is then moved, never resampled, so text and edges stay crisp.
      offset.x = Math.round(x + bobX);
      offset.y = Math.round(y + bobY);
      const tf = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      if (tf !== last) {
        target.style.transform = tf;
        last = tf;
      }
    },
  };
}
