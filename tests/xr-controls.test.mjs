// Written with AI assistance (Claude). Owner: Nanda. Every VR controller input does what the tutorial says
// (src/xr/xrRig.ts). Controllers are faked in the WebXR xr-standard layout that Quest Touch controllers report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPads, stepPads, newPadState, VR_TUTORIAL } from '../src/xr/xrRig.ts';

/** A Quest Touch controller: stick (x, y) with up negative; pressed = button indices held. */
const pad = (handedness, { stick = [0, 0], pressed = [] } = {}) => ({
  handedness,
  gamepad: { axes: [0, 0, stick[0], stick[1]], buttons: Array.from({ length: 7 }, (_, i) => ({ pressed: pressed.includes(i) })) },
});
const TRIGGER = 0, GRIP = 1, STICK_CLICK = 3, A_X = 4, B_Y = 5;
const SNAP = Math.PI / 6;

test('left stick walks: up = forward, right = sideways right; small drift is ignored', () => {
  assert.equal(readPads([pad('left', { stick: [0, -1] })]).forward, 1);
  assert.equal(readPads([pad('left', { stick: [0, 1] })]).forward, -1);
  assert.equal(readPads([pad('left', { stick: [1, 0] })]).side, 1);
  const drift = readPads([pad('left', { stick: [0.1, -0.1] })]);
  assert.equal(drift.forward, 0);
  assert.equal(drift.side, 0);
});

test('right stick turns and never moves you', () => {
  const p = readPads([pad('right', { stick: [1, -1] })]);
  assert.equal(p.turn, 1);
  assert.equal(p.forward, 0);
  assert.equal(p.side, 0);
});

test('buttons: grip = faster, B/Y = fast-forward, A/X or trigger = action, left stick click = help (either hand where it applies)', () => {
  for (const hand of ['left', 'right']) {
    assert.equal(readPads([pad(hand, { pressed: [GRIP] })]).run, true, `${hand} grip`);
    assert.equal(readPads([pad(hand, { pressed: [B_Y] })]).fast, true, `${hand} B/Y`);
    assert.equal(readPads([pad(hand, { pressed: [A_X] })]).action, true, `${hand} A/X`);
    assert.equal(readPads([pad(hand, { pressed: [TRIGGER] })]).action, true, `${hand} trigger`);
  }
  assert.equal(readPads([pad('left', { pressed: [STICK_CLICK] })]).help, true);
  assert.equal(readPads([pad('right', { pressed: [STICK_CLICK] })]).help, false, 'only the left stick click opens help');
  const idle = readPads([pad('left'), pad('right')]);
  assert.deepEqual(idle, { forward: 0, side: 0, turn: 0, run: false, fast: false, action: false, help: false, jump: false });
});

test('the first press closes the tutorial; after that one action per press, not per frame held', () => {
  const s = newPadState(), A = readPads([pad('right', { pressed: [A_X] })]), none = readPads([pad('right')]);
  assert.equal(s.tutorial, true, 'tutorial shows on entering VR');
  assert.equal(stepPads(s, A).action, false, 'first press only closes the tutorial');
  assert.equal(s.tutorial, false);
  assert.equal(stepPads(s, A).action, false, 'still the same press');
  stepPads(s, none);
  assert.equal(stepPads(s, A).action, true, 'next press acts');
  assert.equal(stepPads(s, A).action, false, 'holding does not repeat');
  stepPads(s, none);
  assert.equal(stepPads(s, readPads([pad('left', { pressed: [TRIGGER] })])).action, true, 'trigger acts too');
});

test('snap turn: 30° per flick (right = clockwise), none while held, again after letting go', () => {
  const s = newPadState();
  const right = readPads([pad('right', { stick: [0.9, 0] })]), left = readPads([pad('right', { stick: [-0.9, 0] })]);
  const centre = readPads([pad('right')]);
  assert.equal(stepPads(s, right).turnBy, -SNAP);
  assert.equal(stepPads(s, right).turnBy, 0, 'held');
  stepPads(s, centre);
  assert.equal(stepPads(s, left).turnBy, SNAP);
  stepPads(s, centre);
  assert.equal(stepPads(s, readPads([pad('right', { stick: [0.5, 0] })])).turnBy, 0, 'a half push does not turn');
});

test('left stick click brings the tutorial back; the next press closes it without acting', () => {
  const s = newPadState(), A = readPads([pad('right', { pressed: [A_X] })]), none = readPads([pad('left')]);
  stepPads(s, A);
  stepPads(s, none);
  stepPads(s, readPads([pad('left', { pressed: [STICK_CLICK] })]));
  assert.equal(s.tutorial, true);
  stepPads(s, none);
  assert.equal(stepPads(s, A).action, false);
  assert.equal(s.tutorial, false);
});

test('right stick click jumps, once per click; the left stick click does not', () => {
  const s = newPadState(), click = readPads([pad('right', { pressed: [STICK_CLICK] })]), none = readPads([pad('right')]);
  assert.equal(stepPads(s, click).jump, true);
  assert.equal(stepPads(s, click).jump, false, 'holding does not repeat');
  stepPads(s, none);
  assert.equal(stepPads(s, click).jump, true, 'again after letting go');
  assert.equal(readPads([pad('left', { pressed: [STICK_CLICK] })]).jump, false, 'left click is the tutorial');
});

test('the tutorial names every control it maps', () => {
  const text = VR_TUTORIAL.map((l) => l.text).join('\n');
  for (const word of ['Left stick', 'Grip', 'Right stick', 'A / X', 'trigger', 'B / Y', 'Click the right stick', 'jump', 'Console', 'laser', 'Click the left stick']) assert.match(text, new RegExp(word));
});
