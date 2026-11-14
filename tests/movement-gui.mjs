// Optional native camera-relative control regression and combined-mode lifecycle QA.
// Uses Three.js's existing devtools observe events; no production test hooks.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launchGui,wait} from './gui-runtime.mjs';
const label=process.argv.includes('--baseline')?'baseline-movement':'movement';
const gui=await launchGui(label),results=[],failures=[],lifecycle=[],interferences=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const orient=async(yaw,pitch=0,base=false)=>{
 await gui.evaluate(`(() => {const c=__runtimeQA.camera,y=${yaw}*Math.PI/180,p=${pitch}*Math.PI/180;
 c.quaternion.set(Math.sin(p/2)*Math.cos(y/2),Math.cos(p/2)*Math.sin(y/2),-Math.sin(p/2)*Math.sin(y/2),Math.cos(p/2)*Math.cos(y/2));${base?'c.position.set(0,1.65,0.6);':''}
 })()`);await wait(60);
};
const probe=async(mode,yaw,pitch,keys,attempt=0)=>{
 await orient(yaw,pitch,mode==='base');const before=await gui.read();
 const shift=keys.some(k=>k.startsWith('Shift'));
 try{for(const k of keys)await gui.key('keyDown',k);await wait(240);}finally{for(const k of [...keys].reverse())await gui.key('keyUp',k);}
 await wait(90);const after=await gui.read(),dx=after.position.x-before.position.x,dz=after.position.z-before.position.z;
 // The real user's mouse can move while our native window is locked. A fixed
 // heading oracle is valid only when that heading was actually held. Retain
 // interrupted fixtures and retry at most twice; never retry an alignment failure.
 if(before.quaternion.some((v,i)=>Math.abs(v-after.quaternion[i])>1e-8)){
  interferences.push({mode,yaw,pitch,keys,before,after});
  if(attempt<2)return probe(mode,yaw,pitch,keys,attempt+1);
  throw Error('Native mouse interfered with three fixed-heading fixtures; leave mouse idle and rerun');
 }
 const f=before.forward,r={x:-f.z,z:f.x};
 const forward=Number(keys.includes('KeyW'))-Number(keys.includes('KeyS')),right=Number(keys.includes('KeyD'))-Number(keys.includes('KeyA')),len=Math.hypot(forward,right);
 const expected={x:(f.x*forward+r.x*right)/len,z:(f.z*forward+r.z*right)/len};
 const distance=Math.hypot(dx,dz),alignment=distance?(dx*expected.x+dz*expected.z)/distance:0;
 const entry={mode,yaw,pitch,keys,before:before.position,after:after.position,forward:f,expected,dx,dz,distance,alignment,shift,quaternion:before.quaternion,euler:before.euler};results.push(entry);
 check(distance>.06,`${mode} ${yaw}/${pitch} ${keys}: no unobstructed movement`);
 check(alignment>.98,`${mode} ${yaw}/${pitch} ${keys}: camera-relative alignment ${alignment}`);
 if(mode==='raw'){const s=after.snapshot;check(s&&Math.hypot(s.player.position.x-after.position.x,s.player.position.z-after.position.z)<.06,'RAW camera/engine desynchronized');}
 return entry;
};
const matrix=async mode=>{
 await gui.lock();
 for(const pitch of [0,45,-45])for(const yaw of [0,90,180,270])for(const key of ['KeyW','KeyS','KeyA','KeyD'])await probe(mode,yaw,pitch,[key]);
 for(const yaw of [89,91,179,181,269,271])await probe(mode,yaw,30,['KeyW']);
 const walk=await probe(mode,0,0,['KeyW']),diagonal=await probe(mode,0,0,['KeyW','KeyD']),fast=await probe(mode,0,0,['ShiftLeft','KeyW']);
 check(diagonal.distance/walk.distance>.7&&diagonal.distance/walk.distance<1.3,`${mode}: diagonal speed not normalized`);
 if(mode!=='base')check(fast.distance>walk.distance*1.2,`${mode}: fast gait absent`);
 // Prove native mouse-look changes quaternion, then judge movement against the NEW camera direction.
 const before=await gui.read();const rect=await gui.evaluate(`(() => {const r=document.pointerLockElement.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await gui.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x-100,y:rect.y-30});await wait(60);
 await gui.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+100,y:rect.y+30});await wait(120);
 const looked=await gui.read();check(JSON.stringify(looked.quaternion)!==JSON.stringify(before.quaternion),mode+': native mouse-look did not rotate camera');
 // Do not reset orientation for this look-relative check.
 const f=looked.forward;await gui.key('keyDown','KeyW');await wait(220);await gui.key('keyUp','KeyW');await wait(100);const moved=await gui.read();
 check((moved.position.x-looked.position.x)*f.x+(moved.position.z-looked.position.z)*f.z>.05,mode+': W after native mouse look went backwards');
 // Unlock while W is still down, and omit key-up until AFTER checking for stuck travel.
 await gui.key('keyDown','KeyW');await wait(150);await gui.evaluate('document.exitPointerLock()');await wait(150);const released=await gui.read();await wait(400);const still=await gui.read();
 check(Math.hypot(still.position.x-released.position.x,still.position.z-released.position.z)<.025,mode+': held input continues after unlock');
 await gui.key('keyUp','KeyW');await gui.lock();const relocked=await gui.read();await wait(300);const stationary=await gui.read();
 check(Math.hypot(stationary.position.x-relocked.position.x,stationary.position.z-relocked.position.z)<.025,mode+': relock retained stale input');
 // Genuine OS focus loss while a native key is held; never deliver its key-up until after checking.
 await gui.key('keyDown','KeyW');await wait(120);const restore=await gui.focusAway();
 try{await wait(150);const blurred=await gui.read();await wait(350);const stopped=await gui.read();
 check(Math.hypot(stopped.position.x-blurred.position.x,stopped.position.z-blurred.position.z)<.025,mode+': input survives native blur');
 if(mode==='raw')check(stopped.snapshot.paused,mode+': clock not paused after blur');
 }finally{await gui.key('keyUp','KeyW');await restore();}
 await gui.lock();
 await gui.evaluate('document.exitPointerLock()');await gui.screenshot(mode);
 console.log('MATRIX',mode,results.filter(r=>r.mode===mode).length,'probes; failures:',failures.length);
};
try{
 console.log('GPU',JSON.stringify((await gui.read()).renderer));
 await matrix('raw');
 await gui.navigate('#preview');await gui.until('document.querySelector(".preview-badge")?.textContent.includes("Terrain: 4 m grid")','preview terrain',45000);
 await matrix('base');
 // Reach the console using native movement/clicks, rather than bypassing the preview state machine.
 await orient(0,-5,true);await gui.lock();await gui.key('keyDown','KeyW');await wait(650);await gui.key('keyUp','KeyW');await wait(150);
 await gui.click('.preview-canvas canvas');await gui.until('document.querySelector(".preview-console")?.style.visibility==="visible"','native console interaction');
 await gui.screenshot('console');
 const plan=await gui.evaluate('document.querySelector(".preview-console").textContent');check(plan.includes('EVA plan')&&plan.includes('Oxygen'),'Console plan UI missing');
 await gui.key('keyDown','Escape');await gui.key('keyUp','Escape');await gui.until('!!document.querySelector(".base-ui")','stand from console');
 // Walk to the airlock; stops inside its collision limit, then E launches the selected valid plan.
 await orient(180,0,true);await gui.lock();await gui.key('keyDown','KeyW');await wait(1650);await gui.key('keyUp','KeyW');await wait(100);
 await gui.key('keyDown','KeyE');await gui.key('keyUp','KeyE');await gui.until('!document.querySelector(".base-ui,.preview-console")','EVA from airlock');
 await gui.until('__runtimeQA.read()?.resources.audio.some(a=>a.state==="running")','preview WebAudio active');
 await matrix('eva');
 // Repeat RAW/preview transitions in one document to expose retained loops/listeners.
 for(let cycle=0;cycle<3;cycle++){
  await gui.evaluate("location.hash=''");await gui.until('!!document.querySelector("[data-scene-ready=true]")','RAW remount');await wait(600);lifecycle.push({cycle,mode:'raw',state:await gui.read()});
  await gui.evaluate("location.hash='#preview'");await gui.until('!!document.querySelector(".preview-canvas canvas")&&__runtimeQA.read()?.base','base remount');await wait(1200);lifecycle.push({cycle,mode:'preview',state:await gui.read()});
 }
 for(const mode of ['raw','preview']){
  const snapshots=lifecycle.filter(x=>x.mode===mode).map(x=>x.state.resources);
  check(snapshots.every(r=>r.renderers===snapshots[0].renderers&&r.intervals===snapshots[0].intervals&&r.listeners===snapshots[0].listeners),mode+': active resources grow across transitions');
  check(snapshots.every(r=>r.lateFrames===0),mode+': disposed renderer still drawing');
 }
 check(gui.errors.length===0,'Runtime/console errors: '+JSON.stringify(gui.errors));
 check(gui.network.every(url=>/^(eva:|blob:|data:)/.test(url)),'Unexpected runtime network request');
}catch(error){failures.push(String(error));console.error(error);try{await gui.screenshot('failure');}catch{}}
finally{
 await writeFile(`release/evidence/post-merge/${label}.json`,JSON.stringify({results,failures,lifecycle,interferences,errors:gui.errors,network:gui.network},null,2));await gui.close();
}
console.log('MOVEMENT QA',results.length,'probes;',failures.length,'failures');for(const f of failures)console.error(f);
assert.equal(failures.length,0,'Native movement/integration regression failures; see evidence JSON');
