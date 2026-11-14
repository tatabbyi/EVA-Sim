// Written with AI assistance (Codex). Replaceable demo controller; independent of Nanda's walk code.
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { PerspectiveCamera } from 'three';
import type { Engine } from '../core/engine';
export function createDemoInput(camera: PerspectiveCamera, canvas: HTMLCanvasElement, engine: Engine) {
  const controls = new PointerLockControls(camera, canvas), keys = new Set<string>();
  let last = { x: 0, z: 0, run: false };
  const send = (x: number, z: number, run: boolean) => {
    if (x === last.x && z === last.z && run === last.run) return;
    last = { x, z, run }; engine.dispatch({ type: 'input', direction: { x, z }, run });
  };
  const clear = () => { keys.clear(); send(0, 0, false); };
  const offReset = engine.onEvent(event => { if (event.type === 'reset') clear(); });
  const down = (event: KeyboardEvent) => { if (controls.isLocked && ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(event.code)) { keys.add(event.code); event.preventDefault(); } };
  const up = (event: KeyboardEvent) => keys.delete(event.code);
  const click = () => { if (!engine.getSnapshot().paused) controls.lock(); };
  const visibility = () => { if (document.hidden) { clear(); engine.pause(); controls.unlock(); } };
  const blur = () => { clear(); engine.pause(); controls.unlock(); };
  canvas.addEventListener('click', click);
  window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility); controls.addEventListener('unlock', clear);
  return {
    update() {
      if (!controls.isLocked || engine.getSnapshot().paused) { clear(); return; }
      const forward = Number(keys.has('KeyW'))-Number(keys.has('KeyS')), right = Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
      const yaw = camera.rotation.y;
      send(right*Math.cos(yaw)-forward*Math.sin(yaw), -right*Math.sin(yaw)-forward*Math.cos(yaw), keys.has('ShiftLeft') || keys.has('ShiftRight'));
    },
    dispose() {
      offReset(); clear(); controls.removeEventListener('unlock', clear); controls.dispose();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      canvas.removeEventListener('click', click); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility);
    },
  };
}
