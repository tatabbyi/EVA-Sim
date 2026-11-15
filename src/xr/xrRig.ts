// Written with AI assistance (Claude). Owner: Nanda. WebXR headset mode (research/04-threejs-terrain.md, WebXR notes).
//
// The game keeps its own camera. In VR the headset drives a separate HEAD camera inside a RIG: each frame the rig is
// put under the game camera's position (feet on the floor, `local-floor`), the headset adds the real head pose, and the
// game camera then copies the head's orientation back, so everything that reads the camera (walking direction, what
// you're looking at, the sky) follows your head. The rig only ever turns about the vertical (no pitch or roll: sickness).
//
// Quest Touch controllers feed the same inputs as the keyboard:
//   left stick  = WASD (walk where you look)     right stick = snap turn 30°
//   grip        = Shift (faster)                  A / X or trigger = E (start an objective, accept, airlock, hatch)
//   B / Y held  = F (fast-forward)
// The HTML/SVG HUD can't be drawn inside an immersive session, so a small panel floats in front of you instead.

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export interface XRInput { forward: number; side: number; run: boolean; fast: boolean }
export type HudLine = { text: string; level?: 'ok' | 'warning' | 'danger' };

export interface XRRig {
  readonly presenting: boolean;
  /** This frame's controller state (all zero/false outside VR). */
  readonly input: XRInput;
  /** Read the controllers. Call once per frame. */
  update(dt: number): void;
  /** Draw `scene` for the headset, eyes at the game camera (feet `eyeHeight` below it); then copy the head's look into it. */
  render(scene: THREE.Scene, game: THREE.PerspectiveCamera, eyeHeight: number, hud: HudLine[]): void;
  dispose(): void;
}

const SNAP = Math.PI / 6; // 30° per snap turn
const DEAD = 0.15; // thumbstick dead zone
const HUD_COLOURS = { ok: '#dff6ff', warning: '#ffd60a', danger: '#ff5a4f' };

/** Adds an ENTER VR button to `parent` only where an immersive headset session is possible (e.g. Quest Browser). */
export async function addVRButton(renderer: THREE.WebGLRenderer, parent: HTMLElement): Promise<HTMLElement | null> {
  const ok = !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false));
  if (!ok) return null;
  const button = VRButton.createButton(renderer, { optionalFeatures: ['local-floor'] });
  parent.appendChild(button);
  return button;
}

export function createXRRig(renderer: THREE.WebGLRenderer, events: { onAction(): void; onStart(): void; onEnd(): void }): XRRig {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  const rig = new THREE.Group(), head = new THREE.PerspectiveCamera(80, 1, 0.05, 8000);
  rig.add(head);
  const input: XRInput = { forward: 0, side: 0, run: false, fast: false };
  let yaw = 0, aligned = false, turned = false, actionHeld = false;

  // ---- floating HUD panel: a canvas texture, redrawn only when its text changes
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.25),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
  );
  panel.renderOrder = 999; // always on top, like a visor display
  panel.frustumCulled = false;
  let hudKey = '', hudYaw = 0;
  const drawHud = (lines: HudLine[]) => {
    const key = lines.map((l) => `${l.level}|${l.text}`).join('\n');
    if (key === hudKey) return;
    hudKey = key;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lines.length) return void (texture.needsUpdate = true);
    ctx.fillStyle = 'rgba(8, 16, 24, 0.62)';
    ctx.beginPath();
    ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 28);
    ctx.fill();
    ctx.font = '600 44px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    lines.slice(0, 4).forEach((l, i) => {
      ctx.fillStyle = HUD_COLOURS[l.level ?? 'ok'];
      ctx.fillText(l.text, 40, 56 + i * 70, canvas.width - 80);
    });
    texture.needsUpdate = true;
  };

  const reset = () => Object.assign(input, { forward: 0, side: 0, run: false, fast: false });
  const onStart = () => {
    aligned = false; // face the way the game camera was facing (set on the first frame)
    events.onStart();
  };
  const onEnd = () => {
    reset();
    panel.removeFromParent();
    events.onEnd();
  };
  renderer.xr.addEventListener('sessionstart', onStart);
  renderer.xr.addEventListener('sessionend', onEnd);

  const q = new THREE.Quaternion(), headPos = new THREE.Vector3(), euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const yawOf = (quat: THREE.Quaternion) => euler.setFromQuaternion(quat, 'YXZ').y;

  return {
    get presenting() {
      return renderer.xr.isPresenting;
    },
    input,
    update(dt) {
      const session = renderer.xr.getSession();
      if (!session) return;
      let forward = 0, side = 0, turn = 0, run = false, fast = false, action = false;
      for (const source of session.inputSources) {
        const gp = source.gamepad;
        if (!gp) continue;
        // xr-standard mapping: axes[2], axes[3] = thumbstick (up is negative); buttons 0 trigger, 1 grip, 4 A/X, 5 B/Y.
        const x = Math.abs(gp.axes[2] ?? 0) > DEAD ? gp.axes[2] : 0, y = Math.abs(gp.axes[3] ?? 0) > DEAD ? gp.axes[3] : 0;
        if (source.handedness === 'right') turn = x;
        else {
          side = x;
          forward = -y;
        }
        run ||= gp.buttons[1]?.pressed;
        action ||= gp.buttons[0]?.pressed || gp.buttons[4]?.pressed;
        fast ||= gp.buttons[5]?.pressed;
      }
      Object.assign(input, { forward, side, run, fast });
      if (Math.abs(turn) > 0.6 && !turned) {
        yaw -= Math.sign(turn) * SNAP;
        turned = true;
      } else if (Math.abs(turn) < 0.3) turned = false;
      if (action && !actionHeld) events.onAction(); // once per press
      actionHeld = action;
      hudYaw += Math.atan2(Math.sin(yawOf(head.getWorldQuaternion(q)) - hudYaw), Math.cos(yawOf(q) - hudYaw)) * Math.min(1, dt * 3);
    },
    render(scene, game, eyeHeight, hud) {
      rig.position.set(game.position.x, game.position.y - eyeHeight, game.position.z);
      rig.rotation.set(0, yaw, 0);
      rig.updateMatrixWorld(true);
      // HUD: 1.2 m ahead, a little below the eyes, gently following where you face (not glued to the head).
      drawHud(hud);
      if (panel.parent !== scene) scene.add(panel);
      head.getWorldPosition(headPos);
      panel.position.set(headPos.x - Math.sin(hudYaw) * 1.2, headPos.y - 0.28, headPos.z - Math.cos(hudYaw) * 1.2);
      panel.rotation.set(-0.22, hudYaw, 0, 'YXZ');
      renderer.render(scene, head);
      head.getWorldQuaternion(q);
      if (!aligned) {
        // First frame: turn the rig so you face where the game camera was facing, whichever way you stand in the room.
        aligned = true;
        yaw += yawOf(game.quaternion) - yawOf(q);
        hudYaw = yawOf(game.quaternion);
        return;
      }
      game.quaternion.copy(q); // the game looks (and walks) where the head looks
      game.updateMatrixWorld(); // it isn't rendered itself in VR, so keep its matrix current for code that reads it
    },
    dispose() {
      renderer.xr.removeEventListener('sessionstart', onStart);
      renderer.xr.removeEventListener('sessionend', onEnd);
      void renderer.xr.getSession()?.end();
      panel.removeFromParent();
      panel.geometry.dispose();
      (panel.material as THREE.Material).dispose();
      texture.dispose();
    },
  };
}
