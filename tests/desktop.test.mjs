// Written with AI assistance (Codex).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
test('offline renderer bundle includes the actual shipped grid and metadata', () => {
  for (const file of ['dist/index.html', 'dist/grids/height_4m.bin', 'dist/data/meta.json']) assert.ok(existsSync(file), file);
  assert.equal(readFileSync('dist/grids/height_4m.bin').byteLength, 1025 * 1025 * 4);
});
