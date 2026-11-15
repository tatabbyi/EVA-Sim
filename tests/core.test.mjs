// Written with AI assistance (Codex). Runs pure TS via Node 24+ type stripping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/core/engine.ts';
import { TASK_IDS, routeLabel } from '../src/core/contracts.ts';
import { createHeightGrid, demoMission } from '../src/adapters/world.ts';
import { createFixedClock } from '../src/adapters/clock.ts';
const region = { id:'test',frameId:'local-m',crs:'test',origin:{X:10,Y:20,h0:0},visibleBounds:{minX:-200,maxX:200,minZ:-200,maxZ:200},playableBounds:{minX:-100,maxX:100,minZ:-100,maxZ:100} };
const setup = () => createEngine(region,demoMission(region));
test('two deterministic distinct sites, stable IDs, nonzero shuttle, route provenance', () => {
 const a=demoMission(region); assert.deepEqual(a,demoMission(region)); assert.equal(a.tasks.length,2); assert.notDeepEqual(a.shuttle,{x:0,z:0}); assert.equal(new Set(a.tasks.map(t=>t.id)).size,2);
 assert.deepEqual(TASK_IDS,['abrade-rock','take-core','sample-depot','run-moxie']); assert.equal(routeLabel(a.route.source),'DEMO route');
 const moved={...region,playableBounds:{minX:100,maxX:300,minZ:100,maxZ:300},visibleBounds:{minX:0,maxX:400,minZ:0,maxZ:400}};
 assert.deepEqual(createEngine(moved,demoMission(moved)).getSnapshot().player.position,{x:212,z:212});
});
test('clock pause, reset and immutable snapshots', () => {
 const e=setup(),old=e.getSnapshot(); e.step(.1);e.pause();e.step(.2);assert.equal(e.getSnapshot().simTimeSeconds,.1);e.resume();e.step(.1);assert.equal(e.getSnapshot().simTimeSeconds,.2);e.reset();assert.deepEqual(e.getSnapshot(),old);assert.throws(()=>{old.player.position.x=999;});assert.equal(old.simTimeSeconds,0);
 assert.throws(()=>e.step(NaN));assert.throws(()=>e.step(1));
});
test('fixed clock gives same time across renderer intervals and ignores inactivity', () => {
 const run = hz => { const e=setup(),clock=createFixedClock(e);clock.tick(0);for(let i=1;i<=hz*2;i++)clock.tick(i/hz);return e.getSnapshot().simTimeSeconds; };
 assert.ok(Math.abs(run(30)-2)<1e-10);assert.equal(run(30),run(144));
 const e=setup(),c=createFixedClock(e);c.tick(0);c.tick(100);assert.equal(e.getSnapshot().simTimeSeconds,0);e.pause();c.tick(100.1);e.reset();c.reset();c.tick(200);assert.equal(e.getSnapshot().simTimeSeconds,0);
});
test('normalized movement, playable boundary hard stop, pause freezes movement', () => {
 const e=setup();e.dispatch({type:'input',direction:{x:1,z:1},run:false});e.step(.2);let p=e.getSnapshot().player.position;assert.ok(Math.abs(Math.hypot(p.x-12,p.z-12)-.6)<1e-10);
 e.dispatch({type:'input',direction:{x:1,z:0},run:true});for(let i=0;i<100;i++)e.step(.25);assert.equal(e.getSnapshot().player.position.x,100);assert.ok(e.getSnapshot().boundaryWarning);const before=e.getSnapshot().player.position;e.pause();e.step(.2);assert.deepEqual(e.getSnapshot().player.position,before);
});
test('bad regions and routes rejected; route copying and reset', () => {
 assert.throws(()=>createEngine({...region,playableBounds:{...region.playableBounds,maxX:999}},demoMission(region)));
 const e=setup();for(const p of [{x:NaN,z:0},{x:999,z:0}])assert.throws(()=>e.dispatch({type:'route',route:{source:'ml',points:[{x:0,z:0},p]}}));
 const points=[{x:1,z:1},{x:2,z:2}];e.dispatch({type:'route',route:{source:'ml',points}});points[0].x=999;assert.equal(e.getSnapshot().mission.route.points[0].x,1);e.reset();assert.equal(e.getSnapshot().mission.route.source,'demo');
});
test('task events semantic, ordered, independent of frames and unsubscribed', () => {
 const mission=demoMission(region);mission.shuttle={...mission.tasks[0].position};const e=createEngine(region,mission),events=[];let calls=0;const off=e.onEvent(v=>events.push(v)),unsub=e.subscribe(()=>calls++),id=mission.tasks[0].id;
 e.dispatch({type:'task-finish',siteId:id});assert.equal(events.length,0);e.dispatch({type:'task-start',siteId:id});e.step(.25);assert.equal(e.getSnapshot().mission.tasks[0].status,'active');e.dispatch({type:'task-finish',siteId:id});assert.deepEqual(events.map(v=>v.type),['task-started','task-completed']);assert.equal(e.getSnapshot().resources.oxygenGrams,null);off();unsub();const count=calls;e.reset();assert.equal(calls,count);assert.equal(events.length,2);e.dispose();e.step(.1);assert.equal(e.getSnapshot().simTimeSeconds,0);
});
test('height grid little endian bilinear, edges, nonfinite, nodata, malformed', () => {
 const bounds={minX:10,maxX:12,minZ:20,maxZ:22};const data=new Float32Array([0,2,4,6]);const h=createHeightGrid(data.buffer,2,2,bounds);assert.equal(h.heightAt(11,21),3);assert.equal(h.heightAt(12,22),6);assert.equal(h.heightAt(10,20),0);for(const p of [[9,20],[NaN,20],[11,Infinity]])assert.equal(h.heightAt(...p),null);
 assert.throws(()=>createHeightGrid(new ArrayBuffer(3),2,2,bounds));assert.throws(()=>createHeightGrid(data.buffer,2,4,bounds));for(const bad of [NaN,Infinity,-3.4e38]) {const d=new Float32Array([bad,1,2,3]);assert.equal(createHeightGrid(d.buffer,2,2,bounds).heightAt(11,21),null);}
});
test('world loader reads metadata-selected shipped grid and reports missing data', async () => {
 const { loadDemoWorld } = await import('../src/adapters/world.ts');
 const { readFileSync } = await import('node:fs');
 const original=globalThis.fetch;
 const meta=readFileSync('public/data/meta.json','utf8'),data=readFileSync('public/grids/height_4m.bin');
 try {
  globalThis.fetch=async url=>url.endsWith('meta.json')?new Response(meta):new Response(data);
  const world=await loadDemoWorld(undefined,'/');assert.equal(world.heights.heightAt(0,0),0);assert.equal(world.mission.tasks.length,2);assert.ok(world.region.visibleBounds.maxX>world.region.playableBounds.maxX);
  assert.match(world.heights.terrainRevision,/^sha256:[a-f0-9]{64}$/);assert.equal(world.region.terrainRevision,world.heights.terrainRevision);
  assert.equal((await loadDemoWorld(undefined,'/')).heights.terrainRevision,world.heights.terrainRevision);
  const changed=new Uint8Array(data);changed[0]^=1;
  globalThis.fetch=async url=>url.endsWith('meta.json')?new Response(meta):new Response(changed);
  assert.notEqual((await loadDemoWorld(undefined,'/')).heights.terrainRevision,world.heights.terrainRevision);
  const transformed=JSON.parse(meta);transformed.origin.X+=1;
  globalThis.fetch=async url=>url.endsWith('meta.json')?new Response(JSON.stringify(transformed)):new Response(data);
  assert.notEqual((await loadDemoWorld(undefined,'/')).heights.terrainRevision,world.heights.terrainRevision);
  globalThis.fetch=async url=>url.endsWith('meta.json')?new Response(meta):new Response('missing',{status:404});
  await assert.rejects(loadDemoWorld(undefined,'/'),/Missing 4m terrain: HTTP 404/);
  globalThis.fetch=async()=>new Response('{}');await assert.rejects(loadDemoWorld(undefined,'/'),/Invalid demo metadata/);
 } finally { globalThis.fetch=original; }
});
