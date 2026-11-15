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
//   B / Y held  = F (fast-forward)                left stick click = show the controls again
//   right stick click = Space (jump)              on a panel (the console): the laser points, A / trigger clicks
// The HTML/SVG HUD can't be drawn inside an immersive session, so the same HUD is rebuilt in 3D (vrHud.ts): a curved
// visor band in front of you with the objectives, alert, O₂ and BODY bars, and the compass.
// It opens on a short controls tutorial (VR_TUTORIAL); the first A / X / trigger press closes it.

import * as THREE from 'three';
import {VRButton} from 'three/addons/webxr/VRButton.js';
import {createVRHud, type HudLine, type VRHudModel} from './vrHud.ts';

export type {HudLine, VRHudModel} from './vrHud.ts';

export interface XRInput {
    forward: number;
    side: number;
    run: boolean;
    fast: boolean
}

export interface XRRig {
    readonly presenting: boolean;
    /** This frame's controller state (all zero/false outside VR). */
    readonly input: XRInput;

    /** Read the controllers. Call once per frame. */
    update(dt: number): void;

    /** Draw `scene` for the headset, eyes at the game camera (feet `eyeHeight` below it); then copy the head's look into it. */
    render(scene: THREE.Scene, game: THREE.PerspectiveCamera, eyeHeight: number, hud: VRHudModel): void;

    /** Things fixed to your head (helmet interior, visor fog): add them here; they move with the head, no lag. */
    readonly head: THREE.Object3D;

    /** A panel the controllers can point at (the console). While set, A / trigger on it clicks instead of acting. */
    setPointable(p: Pointable | null): void;

    dispose(): void;
}

/** Something the laser can point at: hit-tested on `mesh`; uv is where on it (0..1, v up). */
export interface Pointable {
    mesh: THREE.Mesh;

    hover(uv: THREE.Vector2 | null): void;

    click(uv: THREE.Vector2): void;
}

const SNAP = Math.PI / 6; // 30° per snap turn
const DEAD = 0.15; // thumbstick dead zone

/** Shown when you enter VR, and again on a left stick click. */
export const VR_TUTORIAL: HudLine[] = [
    {text: 'VR CONTROLS · press A to start', level: 'warning'},
    {text: 'Left stick: walk where you look · Grip: faster'},
    {text: 'Right stick: turn 30°'},
    {text: 'A / X or trigger: start a task, accept, hatch, airlock'},
    {text: 'Hold B / Y: fast-forward time · Click the right stick: jump'},
    {text: 'Console: point with the laser, A or trigger to click'},
    {text: 'Click the left stick: show these controls again'},
];

// ---- controllers, as pure functions (tested in tests/xr-controls.test.mjs)

type Pad = {
    handedness: string;
    gamepad?: { axes: readonly number[]; buttons: readonly { pressed: boolean }[] } | null
};

/** What the controllers are doing right now (xr-standard mapping, as on Quest Touch). */
export interface Pads {
    forward: number;
    side: number;
    turn: number;
    run: boolean;
    fast: boolean;
    action: boolean;
    help: boolean;
    jump: boolean
}

/** axes[2], axes[3] = thumbstick (up is negative); buttons 0 trigger, 1 grip, 3 stick click, 4 A/X, 5 B/Y. */
export function readPads(sources: Iterable<Pad>): Pads {
    const p: Pads = {forward: 0, side: 0, turn: 0, run: false, fast: false, action: false, help: false, jump: false};
    for (const source of sources) {
        const gp = source.gamepad;
        if (!gp) continue;
        const stick = (i: number) => (Math.abs(gp.axes[i] ?? 0) > DEAD ? gp.axes[i] : 0);
        const down = (i: number) => !!gp.buttons[i]?.pressed;
        if (source.handedness === 'right') {
            p.turn = stick(2);
            p.jump ||= down(3);
        } else {
            p.side = stick(2);
            p.forward = -stick(3) || 0; // (no -0 when centred)
            p.help ||= down(3);
        }
        p.run ||= down(1);
        p.action ||= down(0) || down(4);
        p.fast ||= down(5);
    }
    return p;
}

export interface PadState {
    turned: boolean;
    actionHeld: boolean;
    helpHeld: boolean;
    jumpHeld: boolean;
    tutorial: boolean
}

export const newPadState = (): PadState => ({turned: false, actionHeld: false, helpHeld: false, jumpHeld: false, tutorial: true});

/**
 * One frame of button logic: a snap turn per flick of the right stick, the action once per press (the first press
 * only closes the tutorial), a left stick click opens the tutorial again, a right stick click jumps (once per click).
 */
export function stepPads(s: PadState, p: Pads): { turnBy: number; action: boolean; jump: boolean } {
    let turnBy = 0, action = false;
    const jump = p.jump && !s.jumpHeld;
    s.jumpHeld = p.jump;
    if (Math.abs(p.turn) > 0.6 && !s.turned) {
        turnBy = -Math.sign(p.turn) * SNAP; // stick right = turn right (clockwise seen from above)
        s.turned = true;
    } else if (Math.abs(p.turn) < 0.3) s.turned = false;
    if (p.action && !s.actionHeld) {
        if (s.tutorial) s.tutorial = false;
        else action = true;
    }
    s.actionHeld = p.action;
    if (p.help && !s.helpHeld) s.tutorial = true;
    s.helpHeld = p.help;
    return {turnBy, action, jump};
}

/** Adds an ENTER VR button to `parent` only where an immersive headset session is possible (e.g. Quest Browser). */
export async function addVRButton(renderer: THREE.WebGLRenderer, parent: HTMLElement): Promise<HTMLElement | null> {
    const ok = !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false));
    if (!ok) return null;
    const button = VRButton.createButton(renderer, {optionalFeatures: ['local-floor']});
    parent.appendChild(button);
    return button;
}

export function createXRRig(renderer: THREE.WebGLRenderer, events: {
    onAction(): void;
    onJump(): void;
    onStart(): void;
    onEnd(): void
}): XRRig {
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    // The rig goes into whichever scene is drawn, so things fixed to the head (and the controllers) render with it.
    const rig = new THREE.Group(), head = new THREE.PerspectiveCamera(80, 1, 0.05, 8000);
    rig.add(head);
    const input: XRInput = {forward: 0, side: 0, run: false, fast: false};
    let yaw = 0, aligned = false, pads = newPadState();

    // ---- the helmet HUD in 3D (vrHud.ts), following where you face
    const hud = createVRHud();
    let hudYaw = 0;

    // ---- controllers: a small suit-glove block on each, and a laser when a panel can be pointed at
    const gloveMat = new THREE.MeshStandardMaterial({color: '#e6dcc8', roughness: 0.7});
    const gloveGeo = new THREE.BoxGeometry(0.05, 0.035, 0.09);
    const laserMat = new THREE.LineBasicMaterial({color: '#6fe3ff', transparent: true, opacity: 0.85});
    const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({color: '#6fe3ff', depthTest: false}));
    dot.renderOrder = 1001;
    const controllers = [0, 1].map((i) => {
        const c = renderer.xr.getController(i);
        const glove = new THREE.Mesh(gloveGeo, gloveMat);
        glove.position.set(0, -0.01, 0.04);
        const laser = new THREE.Line(laserGeo, laserMat);
        laser.visible = false;
        c.add(glove, laser);
        c.userData.hand = '';
        c.addEventListener('connected', (e) => (c.userData.hand = (e as unknown as { data: XRInputSource }).data.handedness));
        c.addEventListener('disconnected', () => (c.userData.hand = ''));
        rig.add(c);
        return {c, laser};
    });
    rig.add(dot);
    let pointable: Pointable | null = null, pointed: THREE.Vector2 | null = null;
    const ray = new THREE.Raycaster(), rot = new THREE.Matrix4();
    /** Where a controller's laser meets the pointable panel (right hand first), and shows that laser. */
    const point = () => {
        pointed = null;
        dot.visible = false;
        for (const {laser} of controllers) laser.visible = false;
        if (!pointable || !pointable.mesh.visible) return pointable?.hover(null);
        rig.updateMatrixWorld(true);
        const order = [...controllers].sort((a, b) => Number(b.c.userData.hand === 'right') - Number(a.c.userData.hand === 'right'));
        for (const {c, laser} of order) {
            if (!c.userData.hand) continue;
            rot.extractRotation(c.matrixWorld);
            ray.ray.origin.setFromMatrixPosition(c.matrixWorld);
            ray.ray.direction.set(0, 0, -1).applyMatrix4(rot);
            const hit = ray.intersectObject(pointable.mesh, false)[0];
            if (!hit?.uv) continue;
            laser.visible = true;
            laser.scale.z = hit.distance;
            dot.position.copy(rig.worldToLocal(hit.point.clone()));
            dot.visible = true;
            pointed = hit.uv.clone();
            break;
        }
        pointable.hover(pointed);
    };

    const reset = () => Object.assign(input, {forward: 0, side: 0, run: false, fast: false});
    const onStart = () => {
        aligned = false; // face the way the game camera was facing (set on the first frame)
        pads = newPadState(); // the tutorial opens every time you enter VR
        events.onStart();
    };
    const onEnd = () => {
        reset();
        hud.group.removeFromParent();
        rig.removeFromParent();
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
        head,
        setPointable(p) {
            pointable?.hover(null);
            pointable = p;
        },
        update(dt) {
            const session = renderer.xr.getSession();
            if (!session) return;
            const p = readPads(session.inputSources);
            Object.assign(input, {forward: p.forward, side: p.side, run: p.run, fast: p.fast});
            const {turnBy, action, jump} = stepPads(pads, p);
            yaw += turnBy;
            point();
            if (action) {
                if (pointable && pointed) pointable.click(pointed); // on the panel: a click
                else events.onAction(); // anywhere else: E
            }
            if (jump) events.onJump();
            hudYaw += Math.atan2(Math.sin(yawOf(head.getWorldQuaternion(q)) - hudYaw), Math.cos(yawOf(q) - hudYaw)) * Math.min(1, dt * 3);
        },
        render(scene, game, eyeHeight, model) {
            rig.position.set(game.position.x, game.position.y - eyeHeight, game.position.z);
            rig.rotation.set(0, yaw, 0);
            if (rig.parent !== scene) scene.add(rig);
            rig.updateMatrixWorld(true);
            // HUD: a visor band round your eyes, a little low, gently following where you face (not glued to the head).
            hud.update(pads.tutorial ? {...model, tutorial: VR_TUTORIAL} : model);
            if (hud.group.parent !== scene) scene.add(hud.group);
            head.getWorldPosition(headPos);
            hud.group.position.set(headPos.x, headPos.y - 0.08, headPos.z);
            hud.group.rotation.set(0, hudYaw, 0);
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
            hud.dispose();
            rig.removeFromParent();
            for (const d of [gloveMat, gloveGeo, laserMat, laserGeo, dot.geometry, dot.material as THREE.Material]) d.dispose();
        },
    };
}
