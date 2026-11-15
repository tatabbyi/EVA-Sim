// Short native end-to-end check: actual base/console/hatch, then physical EVA.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launchGui,wait} from './gui-runtime.mjs';
const emergency=process.argv.includes('--emergency');
const g=await launchGui(emergency?'demo-emergency':'demo-physics'),evidence={};
const aim=async(x,z,pitch=0)=>g.evaluate(`(() => {const c=__runtimeQA.camera,y=Math.atan2(-((${x})-c.position.x),-((${z})-c.position.z)),p=${pitch};c.quaternion.set(Math.sin(p/2)*Math.cos(y/2),Math.cos(p/2)*Math.sin(y/2),-Math.sin(p/2)*Math.sin(y/2),Math.cos(p/2)*Math.cos(y/2));})()`);
const hold=async(code,ms)=>{await g.key('keyDown',code);try{await wait(ms);}finally{await g.key('keyUp',code);}};
async function walkTo(target,run=true,tolerance=2.2){
 await g.lock();if(run)await g.key('keyDown','ShiftLeft');await g.key('keyDown','KeyW');
 try{const deadline=Date.now()+60000;while(Date.now()<deadline){const s=await g.read();if(Math.hypot(s.position.x-target.x,s.position.z-target.z)<tolerance)return s;await aim(target.x,target.z);await wait(150);}throw Error('Could not physically reach task');}
 finally{await g.key('keyUp','KeyW');if(run)await g.key('keyUp','ShiftLeft');}
}
try{
 await g.navigate(emergency?'?emergency=1':'');await g.until('document.querySelector(".preview-badge")?.textContent.includes("Terrain: 4 m grid")','real terrain');
 evidence.base=await g.read();assert.equal(evidence.base.base,true);await g.screenshot('base');
 await g.lock();await aim(0,-3.15,-.08);await hold('KeyW',650);await g.click('.preview-canvas canvas');
 await g.until('document.querySelector(".preview-console")?.style.visibility==="visible"','planning console');
 for(let i=0;i<4;i++){const checked=await g.evaluate(`document.querySelectorAll('.plan-task input')[${i}].checked`);if(checked!==(i<2))await g.click(`.plan-tasks li:nth-child(${i+1}) input`);}
 const text=await g.evaluate('document.querySelector(".preview-console").textContent');
 assert.ok(text.includes('ENGINEERING SCENARIO ESTIMATES')&&text.includes('750.0 g')&&text.includes('Not simulated'));assert.ok(!text.includes('litres'));
 assert.equal(await g.evaluate('[...document.querySelectorAll(".plan-task input")].filter(x=>x.checked).length'),2);
 evidence.console=text;await g.screenshot('console');await g.key('keyDown','Escape');await g.key('keyUp','Escape');
 await g.until('!!document.querySelector(".base-ui")','stand up');await g.lock();await aim(0,4);await hold('KeyW',2800);
 await g.key('keyDown','KeyE');await g.key('keyUp','KeyE');await g.until('__runtimeQA.read()?.snapshot?.physics&&document.body.textContent.includes("ENGINEERING SCENARIO ·")','physics EVA');
 const start=await g.read();assert.equal(start.snapshot.mission.tasks.length,2);assert.equal(start.snapshot.resources.oxygenCapacityGrams,750);assert.ok(start.snapshot.resources.oxygenGrams>(emergency?1.9:749));evidence.start=start;
 if(emergency){
  await g.lock();await aim(-8,-5);await g.key('keyDown','ShiftLeft');await g.key('keyDown','KeyW');
  try{await g.until('__runtimeQA.read().snapshot.mission.status==="failed"','real 2 g depletion',120000);}finally{await g.key('keyUp','KeyW');await g.key('keyUp','ShiftLeft');}
  const failed=(await g.read()).snapshot;assert.equal(failed.resources.oxygenGrams,0);assert.equal(failed.physics.metabolicPowerWatts,0);assert.equal(failed.physics.oxygenRateGramsPerHour,0);
  await hold('KeyW',500);await hold('KeyF',100);assert.deepEqual((await g.read()).snapshot,failed);evidence.failed=failed;await g.screenshot('failed');
  await g.escapeNative();await g.until('!document.pointerLockElement','unlock failed mission');
  await g.click('[aria-label="EVA physics telemetry"] button:nth-of-type(2)');await g.until('!!document.querySelector(".base-ui")&&!location.search','normal base reset');
 }else{
 const target=start.snapshot.mission.tasks[0].position;
 const arrival=await walkTo(target);assert.ok(arrival.snapshot.resources.oxygenGrams<start.snapshot.resources.oxygenGrams);assert.ok(arrival.snapshot.physics.speedMetresPerSecond<=1.15);evidence.arrival=arrival;
 await g.until('document.querySelector(".hud-alert-message")?.textContent.includes("patch")||document.querySelector(".hud-alert-message")?.textContent.includes("sample")','task prompt');
 evidence.fog=await g.evaluate('Number(document.querySelector(".hud-fog").style.getPropertyValue("--fog"))');assert.ok(evidence.fog>0.05);await g.screenshot('exertion');
 await g.until('matchMedia("(prefers-reduced-motion: reduce)").matches||document.querySelector(".hud-breath").getAnimations().length>0','breath condensation animation',6000);
 await g.until('__runtimeQA.read().snapshot.physics.activity==="idle"','input release to idle',3000);
 const resting=(await g.read()).snapshot;await wait(1200);const rested=(await g.read()).snapshot;assert.ok(rested.resources.oxygenGrams<resting.resources.oxygenGrams);assert.equal(rested.physics.metabolicPowerWatts,165);
 await g.key('keyDown','KeyF');await g.key('keyUp','KeyF');await g.until('__runtimeQA.read().snapshot.physics.activity==="task"','authorized science');
 const working=(await g.read()).snapshot;assert.equal(working.physics.metabolicPowerWatts,350);await g.screenshot('science');
 await g.until('__runtimeQA.read().snapshot.mission.tasks[0].status==="complete"','engine-authorized completion',15000);
 const completed=(await g.read()).snapshot;assert.deepEqual(completed.player.position,working.player.position);evidence.completed=completed;await g.screenshot('completed');
 const second=completed.mission.tasks[1].position;await walkTo(second);await wait(300);await g.key('keyDown','KeyF');await g.key('keyUp','KeyF');
 await g.until('__runtimeQA.read().snapshot.mission.tasks.every(t=>t.status==="complete")','second authorized task',15000);
 await g.until('document.body.textContent.includes("Return to base")','return guidance');evidence.bothComplete=(await g.read()).snapshot;await g.screenshot('return-guidance');
 await g.escapeNative();await g.until('!document.pointerLockElement','Escape unlock');const paused=(await g.read()).snapshot;await wait(400);assert.deepEqual((await g.read()).snapshot,paused);
 await wait(1500); // Chromium's user-Escape cooldown precedes a new real click.
 await g.lock();const f=(await g.read()).forward,before=(await g.read()).position;await hold('KeyW',500);const after=(await g.read()).position;assert.ok((after.x-before.x)*f.x+(after.z-before.z)*f.z>0);
 }
 await g.navigate('#raw');await g.until('document.querySelector("[data-scene-ready=true]")','RAW diagnostics');
 assert.equal(g.errors.length,0,JSON.stringify(g.errors));evidence.errors=g.errors;
 console.log(emergency?'EMERGENCY PASS: real 2 g depletion, frozen failed state and normal base reset':'PASS: native base, gram console, exactly two tasks, physical walk/run, O2 drain at rest, authorized stationary task, completion, Escape pause, correct forward and RAW');
}catch(error){evidence.failure=String(error);await g.screenshot('failure');throw error;}
finally{evidence.errors=g.errors;try{evidence.keys=await g.evaluate('__runtimeQA.keys');}catch{}await writeFile('release/evidence/demo-physics/'+(emergency?'emergency':'gui')+'.json',JSON.stringify(evidence,null,2));await g.close();}
