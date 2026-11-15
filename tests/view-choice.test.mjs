// Written with AI assistance (Claude). Touch view or laptop view (src/dev/touchControls.ts pickView): phones get
// touch, touchscreen laptops get the laptop view, and the address or the saved switch overrides the device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickView } from '../src/dev/touchControls.ts';

test('the device decides by default: phones and tablets touch, laptops (touchscreen or not) laptop', () => {
  assert.equal(pickView(null, null, true), 'touch');
  assert.equal(pickView(null, null, false), 'laptop');
});

test('the saved switch overrides the device', () => {
  assert.equal(pickView(null, 'laptop', true), 'laptop');
  assert.equal(pickView(null, 'touch', false), 'touch');
});

test('?view= overrides both; anything else is ignored', () => {
  assert.equal(pickView('laptop', 'touch', true), 'laptop');
  assert.equal(pickView('touch', 'laptop', false), 'touch');
  assert.equal(pickView('tablet', 'nonsense', false), 'laptop');
});
