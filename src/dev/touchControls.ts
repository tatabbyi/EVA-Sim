// Written with AI assistance (GPT). Mobile-only, no pointer lock or changes to the EVA physics authority.
export interface TouchControls {
  readonly forward: number;
  readonly right: number;
  readonly running: boolean;
  setMode(mode: 'base' | 'console' | 'eva'): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}

interface TouchActions {
  onInteract(): void;
  onPause(): void;
}

export function createTouchControls(root: HTMLElement, actions: TouchActions): TouchControls | null {
  // A mouse-first desktop, including desktop Electron, remains unchanged.
  if (!window.matchMedia('(pointer: coarse)').matches && !(navigator.maxTouchPoints > 0)) return null;

  const overlay = document.createElement('div');
  overlay.className = 'touch-controls';
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', 'Mobile EVA touch controls');
  overlay.innerHTML = [
    '<div class="touch-stick" role="group" aria-label="Movement joystick"><div class="touch-stick-knob"></div></div>',
    '<div class="touch-look-hint">SWIPE TO LOOK</div>',
    '<div class="touch-actions">',
    '  <button type="button" class="touch-button touch-run" aria-pressed="false">RUN</button>',
    '  <button type="button" class="touch-button touch-pause">PAUSE</button>',
    '  <button type="button" class="touch-button touch-interact">USE / E</button>',
    '</div>',
  ].join('');
  root.classList.add('touch-enabled');
  root.append(overlay);

  const stick = overlay.querySelector<HTMLElement>('.touch-stick')!;
  const knob = overlay.querySelector<HTMLElement>('.touch-stick-knob')!;
  const runButton = overlay.querySelector<HTMLButtonElement>('.touch-run')!;
  const pauseButton = overlay.querySelector<HTMLButtonElement>('.touch-pause')!;
  const interactButton = overlay.querySelector<HTMLButtonElement>('.touch-interact')!;
  let activePointer: number | null = null;
  let forward = 0;
  let right = 0;
  let running = false;
  let lastMode = '';

  const resetStick = () => {
    forward = right = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  const setStick = (event: PointerEvent) => {
    const rect = stick.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.34;
    const x = (event.clientX - rect.left - rect.width / 2) / radius;
    const y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    const nx = x / length;
    const ny = y / length;
    right = Math.abs(nx) < 0.1 ? 0 : nx;
    forward = Math.abs(ny) < 0.1 ? 0 : -ny;
    knob.style.transform = 'translate(calc(-50% + ' + nx * radius + 'px), calc(-50% + ' + ny * radius + 'px))';
  };
  const onStickDown = (event: PointerEvent) => {
    if (activePointer !== null) return;
    activePointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    setStick(event);
    event.preventDefault();
  };
  const onStickMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return;
    setStick(event);
    event.preventDefault();
  };
  const onStickUp = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    resetStick();
  };
  const onRun = () => {
    running = !running;
    runButton.setAttribute('aria-pressed', String(running));
    runButton.classList.toggle('is-active', running);
  };
  const onInteract = () => actions.onInteract();
  const onPause = () => actions.onPause();
  const onBlur = () => { activePointer = null; resetStick(); };
  const onVisibility = () => { if (document.hidden) onBlur(); };

  stick.addEventListener('pointerdown', onStickDown);
  stick.addEventListener('pointermove', onStickMove);
  stick.addEventListener('pointerup', onStickUp);
  stick.addEventListener('pointercancel', onStickUp);
  stick.addEventListener('lostpointercapture', onStickUp);
  runButton.addEventListener('click', onRun);
  interactButton.addEventListener('click', onInteract);
  pauseButton.addEventListener('click', onPause);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    get forward() { return forward; },
    get right() { return right; },
    get running() { return running; },
    setMode(mode) {
      if (mode === lastMode) return;
      lastMode = mode;
      overlay.dataset.mode = mode;
      onBlur(); // Never carry movement from one scene mode into another.
      if (mode !== 'eva') {
        running = false;
        runButton.setAttribute('aria-pressed', 'false');
        runButton.classList.remove('is-active');
      }
    },
    setPaused(paused) {
      const label = paused ? 'RESUME' : 'PAUSE';
      if (pauseButton.textContent !== label) pauseButton.textContent = label;
    },
    dispose() {
      stick.removeEventListener('pointerdown', onStickDown);
      stick.removeEventListener('pointermove', onStickMove);
      stick.removeEventListener('pointerup', onStickUp);
      stick.removeEventListener('pointercancel', onStickUp);
      stick.removeEventListener('lostpointercapture', onStickUp);
      runButton.removeEventListener('click', onRun);
      interactButton.removeEventListener('click', onInteract);
      pauseButton.removeEventListener('click', onPause);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      overlay.remove();
      root.classList.remove('touch-enabled');
      onBlur();
    },
  };
}
