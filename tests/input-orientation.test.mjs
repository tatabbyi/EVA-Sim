// Real Three.js quaternion + real PointerLockControls + actual RAW input adapter.
// Synthetic EventTargets avoid GPU dependence; native movement is separately exercised in movement-gui.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Euler, Quaternion, Vector3 } from 'three';
import { createDemoInput } from '../src/adapters/input.ts';
import { createEngine } from '../src/core/engine.ts';
const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
const region={id:'input-test',frameId:'metres',crs:'synthetic',origin:{X:0,Y:0,h0:0},visibleBounds:bounds,playableBounds:bounds};
const mission={regionId:region.id,shuttle:{x:0,z:0},tasks:[],route:{source:'none',points:[]}};
function setup(){
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 const win=new EventTarget(),doc=new EventTarget(),canvas=new EventTarget();canvas.ownerDocument=doc;
 doc.pointerLockElement=null;doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
 canvas.requestPointerLock=()=>{doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));};
 globalThis.window=win;globalThis.document=doc;
 const camera=new PerspectiveCamera(),engine=createEngine(region,mission),input=createDemoInput(camera,canvas,engine);
 const key=(type,code)=>win.dispatchEvent(Object.assign(new Event(type),{code}));
 const lock=()=>canvas.dispatchEvent(new Event('click'));
 return{win,doc,camera,engine,input,key,lock,dispose(){input.dispose();engine.dispose();globalThis.window=previousWindow;globalThis.document=previousDocument;}};
}
const headings=[0,89,90,91,179,180,181,269,270,271,359];
for(const pitch of [-70,0,55])test(`RAW camera-relative WASD at pitch ${pitch}°, full heading wrap`,()=>{
 const t=setup();try{
  t.lock();
  for(const heading of headings)for(const [code,fwd,side] of [['KeyW',1,0],['KeyS',-1,0],['KeyA',0,-1],['KeyD',0,1]]){
   t.engine.reset();t.camera.quaternion.copy(new Quaternion().setFromEuler(new Euler(pitch*Math.PI/180,heading*Math.PI/180,0,'YXZ')));
   const f=t.camera.getWorldDirection(new Vector3());f.y=0;f.normalize();const r=new Vector3(-f.z,0,f.x);
   t.key('keydown',code);t.input.update();t.engine.step(.1);t.key('keyup',code);t.input.update();
   const p=t.engine.getSnapshot().player.position,expected=f.multiplyScalar(fwd).addScaledVector(r,side);
   assert.ok(p.x*expected.x+p.z*expected.z>.2999,`${code} heading ${heading}, pitch ${pitch}: ${JSON.stringify(p)}, expected ${expected.toArray()}`);
  }
 }finally{t.dispose();}
});
test('RAW diagonals normalize; release, unlock/relock, pause, reset, blur and dispose clear intent',()=>{
 const t=setup();try{
  t.lock();t.key('keydown','KeyW');t.key('keydown','KeyD');t.input.update();t.engine.step(.1);
  let p=t.engine.getSnapshot().player.position;assert.ok(Math.abs(Math.hypot(p.x,p.z)-.3)<1e-10);
  t.doc.exitPointerLock();const before=t.engine.getSnapshot().player.position;t.engine.step(.1);assert.deepEqual(t.engine.getSnapshot().player.position,before);
  t.lock();t.input.update();t.engine.step(.1);assert.deepEqual(t.engine.getSnapshot().player.position,before);
  t.key('keydown','KeyW');t.input.update();t.win.dispatchEvent(new Event('blur'));t.engine.step(.1);assert.equal(t.engine.getSnapshot().paused,true);
  t.engine.resume();t.input.update();t.engine.step(.1);assert.deepEqual(t.engine.getSnapshot().player.position,before);
  t.engine.reset();t.input.update();t.engine.step(.1);assert.deepEqual(t.engine.getSnapshot().player.position,{x:0,z:0});
 }finally{t.dispose();}
});
test('RAW exactly vertical look retains horizontal heading without NaN or lost movement',()=>{
 const t=setup();try{
  t.lock();
  for(const pitch of [-90,90])for(const heading of [0,90,180,270]){
   t.engine.reset();t.camera.quaternion.setFromEuler(new Euler(pitch*Math.PI/180,heading*Math.PI/180,0,'YXZ'));
   t.key('keydown','KeyW');t.input.update();t.engine.step(.1);t.key('keyup','KeyW');t.input.update();
   const p=t.engine.getSnapshot().player.position,yaw=heading*Math.PI/180;
   assert.ok(p.x*-Math.sin(yaw)+p.z*-Math.cos(yaw)>.2999);
  }
 }finally{t.dispose();}
});
