// Written with AI assistance (Codex). Synthetic geometry only; no NASA suitability claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createEngine } from '../src/core/engine.ts';
import { demoMission, createHeightGrid } from '../src/adapters/world.ts';
import { validateSceneRoute, applyRouteCandidate, createRouteVisual } from '../src/adapters/routes.ts';
const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
const region={id:'test',frameId:'local-m',terrainRevision:'test-r1',crs:'synthetic',origin:{X:0,Y:0,h0:0},visibleBounds:bounds,playableBounds:bounds};
const mission=demoMission(region);
function terrain(holes=[]) {
 const data=new Float32Array(201*201);
 for(const [x,z] of holes)data[(z+100)*201+x+100]=NaN;
 return {...createHeightGrid(data.buffer,201,1,bounds),contractVersion:1,regionId:region.id,frameId:region.frameId,terrainRevision:region.terrainRevision,coverage:'bilinear-valid-cells',noDataPolicy:'reject-scene'};
}
function planned() {
 return {...structuredClone(mission.route),source:'computed',context:{contractVersion:1,regionId:region.id,frameId:region.frameId,terrainRevision:region.terrainRevision,planner:{kind:'classical',name:'TEST fixture',version:'1'},visitOrder:mission.tasks.map(t=>t.id)}};
}
test('v1 boundary rejects wrong region, frame, revision and untruthful provenance',()=>{
 const h=terrain(),route=planned();validateSceneRoute(route,region,mission,h);
 for(const key of ['regionId','frameId','terrainRevision']) {
  assert.throws(()=>validateSceneRoute({...route,context:{...route.context,[key]:'wrong'}},region,mission,h),/mismatch/);
  assert.throws(()=>validateSceneRoute(route,region,mission,{...h,[key]:'wrong'}),/mismatch/);
 }
 assert.throws(()=>validateSceneRoute({...route,source:'ml'},region,mission,h),/provenance/);
 assert.throws(()=>validateSceneRoute({...route,context:undefined},region,mission,h),/requires v1/);
 assert.throws(()=>validateSceneRoute({...route,context:{...route.context,contractVersion:2}},region,mission,h),/mismatch/);
});
test('planned route requires shuttle, two objective IDs, locations and explicit first-visit order',()=>{
 const route=planned(),h=terrain();
 const check=r=>validateSceneRoute(r,region,mission,h);
 assert.throws(()=>check({...route,points:route.points.slice(1)}),/shuttle/);
 assert.throws(()=>check({...route,points:[mission.shuttle,mission.tasks[0].position]}),/missing required objective/);
 assert.throws(()=>check({...route,context:{...route.context,visitOrder:['unknown',mission.tasks[1].id]}}),/both objective IDs/);
 assert.throws(()=>check({...route,context:{...route.context,visitOrder:[...route.context.visitOrder].reverse()}}),/visit order/);
 assert.throws(()=>check({...route,points:[mission.shuttle,mission.shuttle]}),/Repeated/);
 assert.throws(()=>check({...route,points:[mission.shuttle,{x:Infinity,z:0}]}),/Invalid/);
 validateSceneRoute({source:'none',points:[]},region,mission,h);
});
test('actual smoothed geometry and arrow footprint reject no-data and border excursion',()=>{
 const line={source:'demo',points:[{x:-20,z:0},{x:20,z:0}]};
 const h=terrain([[0,0]]);assert.notEqual(h.heightAt(-20,0),null);assert.notEqual(h.heightAt(20,0),null);
 assert.throws(()=>validateSceneRoute(line,region,mission,h),/no-data/);
 const curved={source:'demo',points:[{x:90,z:-30},{x:99,z:0},{x:99,z:30},{x:90,z:60}]};
 assert.ok(curved.points.every(p=>p.x<=99));assert.throws(()=>validateSceneRoute(curved,region,mission,terrain()),/playable bounds/);
 const corner={source:'demo',points:[{x:-30,z:-30},{x:0,z:-30},{x:0,z:0},{x:30,z:0}]};
 // This missing sample is clear of every straight waypoint segment; smoothing bends north.
 const gap=terrain([[-15,-32]]);
 assert.throws(()=>validateSceneRoute(corner,region,mission,gap),/no-data/);
 assert.equal(gap.coversArea(bounds),false);
});
test('invalid routes and runtime renderer failures leave subsequent frames and engine alive',()=>{
 const e=createEngine(region,mission),h=terrain(),reports=[];let builds=0,updates=0,disposed=0;
 const controller=createRouteVisual(route=>validateSceneRoute(route,region,mission,h),()=>{builds++;return{setProgress(){},update(){updates++;throw new Error('terrain changed');},dispose(){disposed++;}};},()=>{},reason=>reports.push(reason));
 const invalid={source:'demo',points:[{x:90,z:-30},{x:99,z:0},{x:99,z:30},{x:90,z:60}]};
 for(let i=0;i<10;i++){controller.tick(invalid,0,0,i);e.step(.1);}
 assert.equal(builds,0);assert.equal(reports.length,1);assert.match(reports[0],/Route unavailable/);
 const good=e.getSnapshot().mission.route;controller.tick(good,0,0,10);controller.tick(good,0,0,11);
 assert.equal(builds,1);assert.equal(updates,1);assert.equal(disposed,1);assert.match(reports.at(-1),/terrain changed/);
 const rejection=applyRouteCandidate(e,h,{...planned(),context:{...planned().context,frameId:'wrong'}});
 assert.equal(rejection.ok,false);assert.equal(e.getSnapshot().mission.route.source,'none');
 assert.match(e.getSnapshot().mission.route.unavailableReason,/mismatch/);e.step(.1);assert.ok(e.getSnapshot().simTimeSeconds>1);
 assert.equal(applyRouteCandidate(e,h,planned()).ok,true);controller.dispose();
});
test('10000-point snapshots share route, serialize zero times during 1200 ticks, rebuild once per replacement',()=>{
 const points=Array.from({length:10000},(_,i)=>({x:-80+i*160/9999,z:10}));
 const e=createEngine(region,{...mission,route:{source:'demo',points}}),old=e.getSnapshot();
 const events=[];e.onEvent(event=>events.push(event));let publications=0;const off=e.subscribe(()=>publications++);
 let builds=0,frames=0,checks=0,disposals=0;
 const visual=createRouteVisual(route=>{checks++;validateSceneRoute(route,region,mission,terrain());},()=>{builds++;return {setProgress(){},update(){frames++;},dispose(){disposals++;}};},()=>{},()=>{});
 // Initial construction/validation is outside the timed fixed-step/frame loop.
 visual.tick(old.mission.route,0,0,0);
 const stringify=JSON.stringify;let serializations=0;JSON.stringify=(...args)=>{serializations++;return stringify(...args);};
 const start=performance.now();
 try {
  for(let i=0;i<1200;i++) {
   e.dispatch({type:'input',direction:{x:0,z:0},run:false});e.step(1/60);
   const s=e.getSnapshot();assert.equal(s.mission.route,old.mission.route);visual.tick(s.mission.route,0,0,s.simTimeSeconds);
  }
 } finally {JSON.stringify=stringify;}
 const elapsed=performance.now()-start;
 assert.equal(serializations,0);assert.equal(builds,1);assert.equal(checks,1);assert.equal(frames,1201);assert.equal(publications,1200);
 assert.equal(old.simTimeSeconds,0);assert.throws(()=>{old.mission.route.points[0].x=0;});
 const replacement={source:'demo',points:[{x:-10,z:10},{x:10,z:10}]};
 e.dispatch({type:'route',route:replacement});replacement.points[0].x=999;
 const latest=e.getSnapshot().mission.route;assert.equal(latest.points[0].x,-10);
 visual.tick(latest,0,0,21);visual.tick(latest,0,0,22);assert.equal(builds,2);assert.equal(checks,2);assert.equal(disposals,1);
 e.reset();assert.equal(e.getSnapshot().mission.route,old.mission.route);assert.deepEqual(events.map(v=>v.type),['route-changed','reset']);
 off();const count=publications;e.step(.1);assert.equal(publications,count);
 e.pause();const paused=e.getSnapshot();e.pause();assert.equal(e.getSnapshot(),paused);visual.dispose();
 console.log(`Synthetic 10000-point fixture: 1200 steps/frames ${elapsed.toFixed(2)} ms; 0 JSON serializations, 1 initial build, 1 replacement build (stub visual, not GPU timing)`);
});
test('actual input adapter sends only intent changes and clears held input on reset/disposal',async()=>{
 const {createDemoInput}=await import('../src/adapters/input.ts');
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget();
 canvas.ownerDocument=doc;doc.pointerLockElement=null;
 canvas.requestPointerLock=()=>{doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));};
 doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 globalThis.window=win;globalThis.document=doc;
 let input;
 try {
  const engine=createEngine(region,mission),commands=[];
  const {PerspectiveCamera}=await import('three');
  const camera=new PerspectiveCamera();
  input=createDemoInput(camera,canvas,{...engine,dispatch(command){commands.push(command);engine.dispatch(command);}});
  canvas.dispatchEvent(new Event('click'));
  for(let i=0;i<100;i++)input.update();assert.equal(commands.length,0);
  const key=code=>win.dispatchEvent(Object.assign(new Event('keydown'),{code}));
  key('KeyW');for(let i=0;i<100;i++)input.update();assert.equal(commands.length,1);
  camera.rotation.y=.1;input.update();assert.equal(commands.length,2);
  key('ShiftLeft');input.update();assert.equal(commands.length,3);
  engine.reset();input.update();assert.equal(commands.length,4);assert.deepEqual(commands.at(-1).direction,{x:0,z:0});
  const old=engine.getSnapshot().player.position;engine.step(.1);assert.deepEqual(engine.getSnapshot().player.position,old);
  key('KeyW');input.update();engine.step(.1);assert.notDeepEqual(engine.getSnapshot().player.position,old);
  input.dispose();const count=commands.length;engine.reset();key('KeyW');assert.equal(commands.length,count);
 } finally { input?.dispose();globalThis.window=originalWindow;globalThis.document=originalDocument; }
});
