// Written with AI assistance (Claude). The phone controls' maths (src/mobile/touchMath.ts): the gyroscope gives the
// right view whichever way the phone is held, and the walking stick gives the right direction and speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceLook, stickVector } from '../src/mobile/touchMath.ts';

const deg = (r) => Math.round((r * 180) / Math.PI);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1, `${msg}: ${a} vs ${b}`);

test('phone held upright looks at the horizon; tilted back looks up; flat on a table looks down', () => {
  near(deg(deviceLook(0, 90, 0, 0).pitch), 0, 'upright');
  near(deg(deviceLook(0, 120, 0, 0).pitch), 30, 'tilted back 30°');
  near(deg(deviceLook(0, 60, 0, 0).pitch), -30, 'tilted forward 30°');
  near(deg(deviceLook(0, 0, 0, 0).pitch), -90, 'flat, screen up');
});

test('turning the phone to the left turns the view to the left, upright or sideways', () => {
  for (const [beta, gamma, screen] of [[90, 0, 0], [0, -90, 90], [0, 90, 270]]) {
    const a = deviceLook(0, beta, gamma, screen), b = deviceLook(30, beta, gamma, screen);
    near(deg(Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))), 30, `screen at ${screen}°`);
    near(deg(b.pitch), 0, `level, screen at ${screen}°`);
  }
});

test('the stick: a dead zone in the middle, full speed at the rim, run only at the very edge', () => {
  assert.deepEqual(stickVector(0, 0, 60), { forward: 0, side: 0, run: false });
  assert.deepEqual(stickVector(5, 3, 60), { forward: 0, side: 0, run: false }, 'a resting thumb does not walk');
  const up = stickVector(0, -60, 60);
  near(up.forward * 100, 100, 'pushed up: forward');
  assert.equal(up.side, 0);
  assert.equal(up.run, true, 'all the way: run');
  const right = stickVector(30, 0, 60);
  assert.ok(right.side > 0.3 && right.side < 0.5 && right.forward === 0 && !right.run, 'half right: walk right, slower');
  const back = stickVector(0, 200, 60);
  near(back.forward * 100, -100, 'past the rim counts as the rim');
});
