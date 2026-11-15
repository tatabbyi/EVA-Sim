// Written with AI assistance (Claude). Owner: Nanda. Phones and tablets: play in the browser with no keyboard or mouse.
//   look     hold the phone up and turn around (the gyroscope: a panoramic view), or drag a finger across the screen
//   walk     the stick on the bottom left (push it all the way to run)
//   A        start a task, accept, use the console, suit up at the hatch (the E key / a click); tapping the view does it too
//   jump     the button above A (Space) · ⏩ hold for fast-forward (F)
//   top      gyro on or off, path in the world or on the glass (O), topology (T), sound (M)
// Outside, the helmet view needs the phone sideways (the visor is wide); held upright it asks you to turn it.
// The game reads `input` like the keyboard and calls take() once a frame for how much to turn (see Preview.tsx).
// Pure helpers (deviceLook, stickVector) are exported for the tests.

import { deviceLook, stickVector } from './touchMath.ts';
import './touchControls.css';

export { deviceLook, stickVector };

export type TouchMode = 'base' | 'eva' | 'console';
export type TouchOption = 'outline' | 'topology' | 'sound';

export interface TouchEvents {
  /** The first tap (browsers allow motion sensors and sound only after one). */
  onStart(): void;
  onAction(): void;
  onJump(): void;
  onOption(o: TouchOption): void;
}

export interface TouchState {
  outline: 'world' | 'glass';
  topology: boolean;
  sound: boolean;
}

export interface TouchControls {
  readonly started: boolean;
  /** Like the keyboard: forward/back and sideways (-1..1), run, fast-forward held. */
  readonly input: { forward: number; side: number; run: boolean; fast: boolean };
  /** The turn since the last call (radians; yaw + is to the left, pitch + is up), and the gyro's own pitch if it's on. */
  take(): { yaw: number; pitch: number; absPitch: number | null };
  /** Which buttons make sense right now, and the toggles' states. Cheap to call every frame. */
  update(mode: TouchMode, state: TouchState): void;
  dispose(): void;
}

/** Is this a touch device (no mouse)? `?touch=1` / `?touch=0` force it either way. */
export function isTouchDevice(search = location.search): boolean {
  const forced = new URLSearchParams(search).get('touch');
  if (forced === '1' || forced === '0') return forced === '1';
  return typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/** Keep getting a finger's moves after it slides off the control (some browsers refuse: carry on without). */
const capture = (el: Element, id: number) => {
  try {
    el.setPointerCapture(id);
  } catch {
    /* not capturable: moves still arrive while the finger stays on the control */
  }
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const DRAG = 0.005; // radians per pixel of finger drag

export function createTouchControls(root: HTMLElement, events: TouchEvents): TouchControls {
  const ui = document.createElement('div');
  ui.className = 'touch-ui';
  ui.innerHTML = `
    <button type="button" class="touch-start">
      <strong>Tap to start</strong>
      <span>Hold your phone up and turn around to look · or drag to look</span>
      <span>Left thumb: walk · A: act</span>
    </button>
    <div class="touch-rotate touch-ctl"><strong>⟲ Turn your phone sideways</strong><span>The helmet view is wide: hold the phone in landscape to go out on Mars</span></div>
    <div class="touch-stick touch-ctl" aria-label="Walk"><div class="touch-knob"></div></div>
    <div class="touch-right">
      <button type="button" class="touch-ctl touch-btn touch-ff" data-only="eva" aria-label="Hold for fast-forward">⏩</button>
      <button type="button" class="touch-ctl touch-btn touch-jump" data-only="eva" aria-label="Jump">⤒</button>
      <button type="button" class="touch-ctl touch-btn touch-a" aria-label="Act">A</button>
    </div>
    <div class="touch-top">
      <button type="button" class="touch-ctl touch-pill" data-opt="gyro"></button>
      <button type="button" class="touch-ctl touch-pill" data-opt="outline" data-only="eva"></button>
      <button type="button" class="touch-ctl touch-pill" data-opt="topology" data-only="eva"></button>
      <button type="button" class="touch-ctl touch-pill" data-opt="sound"></button>
    </div>`;
  root.appendChild(ui);
  root.classList.add('is-touch');
  const $ = <T extends HTMLElement>(s: string) => ui.querySelector(s) as T;
  const startBtn = $<HTMLButtonElement>('.touch-start'), stick = $('.touch-stick'), knob = $('.touch-knob');
  const pills = Object.fromEntries([...ui.querySelectorAll<HTMLButtonElement>('[data-opt]')].map((b) => [b.dataset.opt!, b]));

  const input = { forward: 0, side: 0, run: false, fast: false };
  let started = false, gyroOn = true, gyroSeen = false, lastYaw: number | null = null, lastPitch: number | null = null;
  let absPitch: number | null = null, yawAcc = 0, pitchAcc = 0, mode: TouchMode | '' = '', shown = '';

  // ---- the gyroscope
  const screenAngle = () => screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.alpha === null || e.beta === null || e.gamma === null) return;
    gyroSeen = true;
    if (!gyroOn) return;
    const l = deviceLook(e.alpha, e.beta, e.gamma, screenAngle());
    if (lastYaw !== null) yawAcc += wrap(l.yaw - lastYaw);
    if (lastPitch !== null) pitchAcc += l.pitch - lastPitch;
    lastYaw = l.yaw;
    lastPitch = l.pitch;
    absPitch = l.pitch;
  };
  const startGyro = async () => {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    try {
      if (DOE?.requestPermission && (await DOE.requestPermission()) !== 'granted') gyroOn = false; // iPhone asks first
    } catch {
      gyroOn = false;
    }
    window.addEventListener('deviceorientation', onOrient);
  };
  const setGyro = (on: boolean) => {
    gyroOn = on;
    lastYaw = lastPitch = absPitch = null; // pick up again from wherever the phone points now, without a jump
  };

  startBtn.addEventListener('click', () => {
    if (started) return;
    started = true;
    startBtn.hidden = true;
    void startGyro(); // must be called inside the tap, for the iPhone's permission prompt
    // A phone in landscape plays full screen where the browser allows (Android; iPhones ignore it).
    if (matchMedia('(orientation: landscape)').matches) document.documentElement.requestFullscreen?.().catch(() => {});
    events.onStart();
  });

  // ---- the stick
  let stickId = -1, cx = 0, cy = 0;
  const radius = () => stick.clientWidth / 2;
  const moveStick = (x: number, y: number) => {
    const r = radius(), dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy), s = len > r ? r / len : 1;
    knob.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
    Object.assign(input, stickVector(dx, dy, r));
  };
  const endStick = () => {
    stickId = -1;
    knob.style.transform = '';
    Object.assign(input, { forward: 0, side: 0, run: false });
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(stick, e.pointerId);
    stickId = e.pointerId;
    const b = stick.getBoundingClientRect();
    cx = b.left + b.width / 2;
    cy = b.top + b.height / 2;
    moveStick(e.clientX, e.clientY);
  });
  stick.addEventListener('pointermove', (e) => e.pointerId === stickId && moveStick(e.clientX, e.clientY));
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  // ---- buttons
  const tap = (sel: string, fn: () => void) => $(sel).addEventListener('pointerdown', (e) => (e.preventDefault(), fn()));
  tap('.touch-a', () => events.onAction());
  tap('.touch-jump', () => events.onJump());
  const ff = $('.touch-ff');
  ff.addEventListener('pointerdown', (e) => (e.preventDefault(), capture(ff, e.pointerId), (input.fast = true)));
  for (const t of ['pointerup', 'pointercancel'] as const) ff.addEventListener(t, () => (input.fast = false));
  for (const [opt, b] of Object.entries(pills))
    b.addEventListener('click', () => (opt === 'gyro' ? setGyro(!gyroOn) : events.onOption(opt as TouchOption)));

  // ---- drag to look (anywhere that isn't a control); a quick tap is A
  const looks = new Map<number, { x: number; y: number; t: number; moved: number }>();
  const own = (t: EventTarget | null) => t instanceof Element && !!t.closest('.touch-ctl, .touch-start, button, a, .preview-console, .hud-alert, [role="button"]');
  const onDown = (e: PointerEvent) => {
    if (!started || own(e.target) || e.pointerType === 'mouse') return;
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 });
  };
  const onMove = (e: PointerEvent) => {
    const l = looks.get(e.pointerId);
    if (!l) return;
    const dx = e.clientX - l.x, dy = e.clientY - l.y;
    l.x = e.clientX;
    l.y = e.clientY;
    l.moved += Math.hypot(dx, dy);
    yawAcc += dx * DRAG; // drag the scene: finger right turns you left
    if (!gyroOn || absPitch === null) pitchAcc += dy * DRAG; // the gyro keeps the horizon when it's on
  };
  const onUp = (e: PointerEvent) => {
    const l = looks.get(e.pointerId);
    looks.delete(e.pointerId);
    if (l && l.moved < 12 && performance.now() - l.t < 300) events.onAction();
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  // No scrolling, zooming or long-press menus while playing.
  const noTouchDefault = (e: Event) => !own(e.target) && e.cancelable && e.preventDefault();
  root.addEventListener('touchmove', noTouchDefault, { passive: false });
  root.addEventListener('contextmenu', noTouchDefault);

  return {
    get started() {
      return started;
    },
    input,
    take() {
      const r = { yaw: yawAcc, pitch: pitchAcc, absPitch: gyroOn ? absPitch : null };
      yawAcc = pitchAcc = 0;
      return r;
    },
    update(m, s) {
      if (m !== mode) {
        mode = m;
        ui.dataset.mode = m;
        if (m !== 'eva') input.fast = false;
      }
      const key = `${gyroOn}${gyroSeen}${s.outline}${s.topology}${s.sound}`;
      if (key === shown) return;
      shown = key;
      pills.gyro.textContent = gyroSeen ? `Gyro: ${gyroOn ? 'On' : 'Off'}` : 'Drag to look';
      pills.gyro.disabled = !gyroSeen;
      pills.outline.textContent = `Path: ${s.outline === 'glass' ? 'Glass' : 'World'}`;
      pills.topology.textContent = `Topology: ${s.topology ? 'On' : 'Off'}`;
      pills.sound.textContent = `Sound: ${s.sound ? 'On' : 'Off'}`;
    },
    dispose() {
      window.removeEventListener('deviceorientation', onOrient);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('touchmove', noTouchDefault);
      root.removeEventListener('contextmenu', noTouchDefault);
      root.classList.remove('is-touch');
      ui.remove();
    },
  };
}
