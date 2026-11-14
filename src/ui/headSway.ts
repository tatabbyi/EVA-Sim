// Written with AI assistance (Claude).
// Owner: Rachel. Your head moves inside the helmet: when you look around, the head turns first and the helmet
// (visor edge and everything on the glass) lags behind, then springs back. Walking adds a small bob, running a bigger one.
// Writes a transform straight onto the helmet element (HelmetHud's swayTargetRef). Doing it on one element, rather than
// through inherited CSS variables, avoids restyling every HUD element each frame.
// Reusable by Nanda's walk mode: call look() on mouse moves and step() once per frame.

// The head turns well inside a bubble helmet before the body (and helmet) follows: keep turning and the visor edge
// slides a long way across your view; stop and it eases back as your body catches up.
const STIFFNESS = 14; // spring back to centre (slow: the body catching up)
const DAMPING = 6; // ~0.8 of critical: one soft overshoot
const LOOK_GAIN = 7; // px/s of sway per px of mouse movement
const RANGE_X = 0.12; // how far the head can go, as a fraction of the screen width...
const RANGE_Y = 0.1; // ...and height. The helmet lining reaches well past the screen, so its edge never shows.
// Where you look also moves the helmet: the head can't tilt far inside a hard helmet, so looking up brings its top
// edge into view and looking down brings more of the chin (mic, valves) into view. Fractions of the screen height.
const PITCH_UP = 0.15, PITCH_DOWN = 0.07;

export interface HeadSway {
  /** Mouse movement in px (e.g. MouseEvent.movementX / movementY). */
  look(dx: number, dy: number): void;
  /** Once per frame. speed: 0 = standing, 1 = walking, 2 = running. */
  step(dt: number, speed: number): void;
  /** Where you're looking: pitch in radians (up positive). */
  setPitch(radians: number): void;
  /** Current helmet offset in CSS pixels (for anything else that moves with the helmet, e.g. the 3D interior). */
  readonly offset: { x: number; y: number };
}

export function createHeadSway(target: HTMLElement): HeadSway {
  let x = 0, y = 0, vx = 0, vy = 0;
  let phase = 0, amp = 0, pitch = 0, pitchOff = 0;
  let last = '';
  const offset = { x: 0, y: 0 };

  return {
    offset,
    setPitch(r) {
      pitch = r;
    },
    look(dx, dy) {
      vx -= dx * LOOK_GAIN;
      vy -= dy * LOOK_GAIN;
    },
    step(rawDt, speed) {
      const dt = Math.min(rawDt, 0.05);
      vx += (-STIFFNESS * x - DAMPING * vx) * dt;
      vy += (-STIFFNESS * y - DAMPING * vy) * dt;
      const maxX = window.innerWidth * RANGE_X, maxY = window.innerHeight * RANGE_Y;
      x = Math.max(-2 * maxX, Math.min(2 * maxX, x + vx * dt));
      y = Math.max(-2 * maxY, Math.min(2 * maxY, y + vy * dt));
      // Soft limit: the head slows into the helmet padding instead of hitting a wall.
      const sx = maxX * Math.tanh(x / maxX), sy = maxY * Math.tanh(y / maxY);

      // Footstep bob: amplitude eases towards the target so starting and stopping look smooth.
      const targetAmp = speed >= 2 ? 6 : speed >= 1 ? 2.5 : 0;
      amp += (targetAmp - amp) * Math.min(1, dt * 6);
      phase += dt * (speed >= 2 ? 11 : 7);
      const bobX = Math.cos(phase / 2) * amp * 0.6;
      const bobY = Math.abs(Math.sin(phase)) * amp;

      // Rounded so a helmet at rest stops touching the DOM entirely.
      // Whole pixels and no rotation: the helmet layer is then moved, never resampled, so text and edges stay crisp.
      // Looking up (pitch > 0) moves the helmet down the screen, so its top comes into view; and the reverse.
      const up = Math.min(1, Math.max(0, (pitch - 0.12) / 0.9)), down = Math.min(1, Math.max(0, (-pitch - 0.2) / 0.8));
      const pitchTarget = window.innerHeight * (PITCH_UP * up * (2 - up) - PITCH_DOWN * down * (2 - down));
      pitchOff += (pitchTarget - pitchOff) * Math.min(1, dt * 8);
      offset.x = Math.round(sx + bobX);
      offset.y = Math.round(sy + bobY + pitchOff);
      const tf = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
      if (tf !== last) {
        target.style.transform = tf;
        last = tf;
      }
    },
  };
}
