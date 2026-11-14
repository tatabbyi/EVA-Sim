// Written with AI assistance (Codex).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
const { previewReady } = createRequire(import.meta.url)('../electron/smoke-readiness.cjs');
test('preview readiness rejects RAW-only, overlapping roots, missing grid and wrong hash', () => {
 const doc = (raw, canvas, text) => ({ querySelector: selector => selector === '.raw-app' ? raw : selector === '.preview .preview-canvas canvas' ? canvas : { textContent:text } });
 const location = { hash:'#preview' };
 assert.equal(previewReady(doc(true,false,''),location),false);
 assert.equal(previewReady(doc(true,true,'Terrain: 4 m grid, heights 0 to 1 m'),location),false);
 assert.equal(previewReady(doc(false,true,'No terrain yet'),location),false);
 assert.equal(previewReady(doc(false,true,'Terrain: 4 m grid, heights 0 to 1 m'),{hash:''}),false);
 assert.equal(previewReady(doc(false,true,'Terrain: 4 m grid, heights 0 to 1 m'),location),true);
});
test('occupied dev port fails before Electron spawn', async () => {
 const server=createServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5173,'localhost',resolve);});
 try {
  const child=spawn(process.execPath,['scripts/dev-electron.mjs','--smoke'],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  assert.equal(code,1);assert.match(output,/Port 5173 is already in use/);assert.doesNotMatch(output,/SMOKE/);
 } finally { await new Promise(resolve=>server.close(resolve)); }
});
