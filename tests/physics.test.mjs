// Written with AI assistance (Codex). Synthetic fixtures validate scenario maths, not Mars physiology.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARS_EVA_DEMO_PROFILE as profile, gramsPerHour, massAndWeight, activityResponse, directionalGrade, integrateLifeSupport, validatePhysicsOptions, oxygenWarning } from '../src/core/physics.ts';
import { createEngine } from '../src/core/engine.ts';
import { createHeightGrid, demoMission } from '../src/adapters/world.ts';
import { createFixedClock } from '../src/adapters/clock.ts';
import { toHelmetHud } from '../src/adapters/hud.ts';
const bounds={minX:-2000,maxX:2000,minZ:-2000,maxZ:2000};
const region={id:'physics-test',frameId:'test-local-metres',crs:'synthetic',origin:{X:0,Y:0,h0:0},visibleBounds:bounds,playableBounds:bounds};
const mission=()=>demoMission(region);
const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const options=(extra={})=>({profile,heightAt:()=>0,carriedMassKg:0,...extra});
const setup=(extra={},m=mission())=>createEngine(region,m,undefined,undefined,options(extra));
const move=(e,run=false,direction={x:1,z:0})=>e.dispatch({type:'input',direction,run});
const advance=(e,seconds,dt=1/60)=>{const n=Math.round(seconds/dt);for(let i=0;i<n;i++)e.step(dt);};
test('NASA-REF pair and scenario rates have exact gram/second and joule dimensions',()=>{
 close(gramsPerHour(293),75);close(integrateLifeSupport(750,293,3600).oxygenGrams,675);
 close(integrateLifeSupport(750,293,600).oxygenGrams,737.5);
 close(integrateLifeSupport(750,293,60).oxygenGrams,748.75);
 close(gramsPerHour(165),42.23549488054608);close(gramsPerHour(430),110.06825938566553);
 close(gramsPerHour(350),89.59044368600682);
 close(integrateLifeSupport(750,293,60).energyJ,17580);
 assert.equal(integrateLifeSupport(0,0,10).elapsedSeconds,0);
 assert.throws(()=>gramsPerHour(NaN));assert.throws(()=>gramsPerHour(-1));assert.throws(()=>integrateLifeSupport(-1,293,1));assert.throws(()=>integrateLifeSupport(1,293,Infinity));
});
test('Mars mass stays kg while weight is N; payload slows gait and raises exertion',()=>{
 close(massAndWeight(profile,0).totalMassKg,145);close(massAndWeight(profile,0).weightNewtons,538.095);
 close(massAndWeight(profile,10).weightNewtons,575.205);
 const walk=activityResponse(profile,'walk',0,0),fast=activityResponse(profile,'fast',0,0),loaded=activityResponse(profile,'walk',0,10);
 close(walk.speedMetresPerSecond,.75);close(walk.metabolicPowerWatts,293);
 close(fast.speedMetresPerSecond,1.15);close(fast.metabolicPowerWatts,430);
 close(loaded.speedMetresPerSecond,.75/(1+.5*10/145));assert.ok(loaded.metabolicPowerWatts>293);
 close(activityResponse(profile,'idle',.3,10).metabolicPowerWatts,165);
 close(activityResponse(profile,'task',.3,10).metabolicPowerWatts,350);
});
test('profile/config validation rejects nonfinite/invalid SI inputs and unlabelled depleted starts',()=>{
 validatePhysicsOptions(options());validatePhysicsOptions(options({initialOxygenGrams:0,emergencyTest:true}));
 for(const key of ['gravityMps2','ambientPressurePa','ambientTemperatureC','co2VolumeFraction','astronautMassKg','suitMassKg','baseWalkSpeedMps','baseFastSpeedMps','powerIdleW','powerWalkW','powerFastW','powerTaskW','oxygenCapacityGrams','oxygenReserveGrams','oxygenCriticalGrams','maxDemoSlopeDeg','slopeProbeMetres'])assert.throws(()=>validatePhysicsOptions(options({profile:{...profile,[key]:NaN}})),key);
 for(const patch of [{carriedMassKg:-1},{carriedMassKg:Infinity},{heightAt:null},{initialOxygenGrams:2},{initialOxygenGrams:751,emergencyTest:true},{initialOxygenGrams:NaN,emergencyTest:true},{profile:{...profile,oxygenCriticalGrams:151}},{profile:{...profile,oxygenReserveGrams:751}},{profile:{...profile,slopeProbeMetres:0}},{profile:{...profile,maxDemoSlopeDeg:90}},{profile:{...profile,ambientTemperatureC:-300}},{profile:{...profile,powerWalkW:0}}])assert.throws(()=>validatePhysicsOptions(options(patch)));
});
test('signed grade on the same bilinear ramp changes with heading, uphill is slower/costlier',()=>{
 const grade=Math.tan(10*Math.PI/180),data=new Float32Array([-2*grade,2*grade,-2*grade,2*grade]);
 const h=createHeightGrid(data.buffer,2,4,{minX:-2,maxX:2,minZ:-2,maxZ:2});
 const up=directionalGrade(h.heightAt,{x:0,z:0},{x:1,z:0},1),down=directionalGrade(h.heightAt,{x:0,z:0},{x:-1,z:0},1);
 close(up,-down);close(up,grade,1e-8);
 const uphill=activityResponse(profile,'walk',grade,0),downhill=activityResponse(profile,'walk',-grade,0);
 close(uphill.speedMetresPerSecond,.615);close(downhill.speedMetresPerSecond,.7125);
 close(uphill.metabolicPowerWatts,165+128*(1+3*grade+6*grade**2));close(downhill.metabolicPowerWatts,165+128*.7);
 const e=setup({heightAt:(x)=>x*grade});move(e);e.step(.2);close(e.getSnapshot().player.position.x-12,.615*.2);close(e.getSnapshot().physics.currentSlopeDeg,10);
 move(e,false,{x:-1,z:0});e.step(.2);close(e.getSnapshot().physics.currentSlopeDeg,-10);
});
test('unit direction, flat walk/fast, fixed 60Hz clock and grouping independence',()=>{
 for(const [run,speed,power] of [[false,.75,293],[true,1.15,430]]) {
  const e=setup();move(e,run,{x:7,z:7});advance(e,1);
  const s=e.getSnapshot();close(Math.hypot(s.player.position.x-12,s.player.position.z-12),speed);
  close(s.physics.metabolicPowerWatts,power);close(s.physics.energySpentJ,power);close(s.resources.oxygenGrams,750-gramsPerHour(power)/3600);
 }
 const results=[1/60,1/30,.1].map(dt=>{const e=setup();move(e);advance(e,60,dt);return e.getSnapshot();});
 for(const s of results){close(s.resources.oxygenGrams,748.75,1e-8);close(s.physics.energySpentJ,17580,1e-6);close(s.player.position.x,57,1e-8);}
 const run=hz=>{const e=setup(),c=createFixedClock(e);move(e);c.tick(0);for(let i=1;i<=hz*10;i++)c.tick(i/hz);return e.getSnapshot();};
 close(run(30).resources.oxygenGrams,run(144).resources.oxygenGrams);
});
test('blocked steep/missing/nonfinite terrain, invalid targets and playable edge use idle metabolism',()=>{
 const fixtures=[()=>NaN,()=>Infinity,()=>null,x=>x*Math.tan(26*Math.PI/180),x=>-x*Math.tan(26*Math.PI/180)];
 for(const heightAt of fixtures) {
  // Initial shuttle is valid, then the provider may report no-data at symmetric probes.
  const e=setup({heightAt:(x,z)=>x===12&&z===12?0:heightAt(x,z)}),before=e.getSnapshot();move(e,true);e.step(.2);
  const s=e.getSnapshot();assert.deepEqual(s.player.position,before.player.position);assert.equal(s.player.movementMode,'idle');close(s.physics.metabolicPowerWatts,165);close(s.resources.oxygenGrams,750-gramsPerHour(165)*.2/3600);
 }
 const target=setup({heightAt:(x)=>x>12.1&&x<12.4?null:0});move(target,true);target.step(.25);assert.equal(target.getSnapshot().player.position.x,12);close(target.getSnapshot().physics.metabolicPowerWatts,165);
 const m=mission();m.shuttle={x:1999.99,z:12};const edge=setup({},m);move(edge,true);edge.step(.25);assert.equal(edge.getSnapshot().player.position.x,1999.99);assert.equal(edge.getSnapshot().boundaryWarning,true);close(edge.getSnapshot().physics.metabolicPowerWatts,165);
 assert.throws(()=>setup({heightAt:()=>null}),/terrain unavailable/);
});
test('pause/resume/reset and caller mutation preserve immutable physics snapshots',()=>{
 const p={...profile},config=options({profile:p,carriedMassKg:10});const e=createEngine(region,mission(),undefined,undefined,config),initial=e.getSnapshot();
 p.powerWalkW=999;config.carriedMassKg=999;move(e);e.step(.2);const moved=e.getSnapshot();assert.ok(moved.physics.metabolicPowerWatts<400);assert.equal(moved.physics.carriedMassKg,10);
 e.pause();const paused=e.getSnapshot();e.step(.25);assert.equal(e.getSnapshot(),paused);assert.equal(paused.resources.oxygenGrams,moved.resources.oxygenGrams);assert.equal(paused.physics.energySpentJ,moved.physics.energySpentJ);
 e.resume();e.step(.2);close(e.getSnapshot().physics.metabolicPowerWatts,165);e.reset();assert.deepEqual(e.getSnapshot(),initial);assert.equal(initial.simTimeSeconds,0);assert.equal(initial.resources.oxygenGrams,750);
 assert.throws(()=>{initial.physics.energySpentJ=1;});assert.throws(()=>{initial.mission.status='failed';});
});
test('active task is stationary, exactly one total task power, MOXIE never refills',()=>{
 const m=mission();m.shuttle={...m.tasks[1].position};const e=setup({carriedMassKg:10},m),events=[];e.onEvent(v=>events.push(v));const id=m.tasks[1].id;
 move(e,true);e.dispatch({type:'task-start',siteId:id});e.dispatch({type:'task-start',siteId:id});const old=e.getSnapshot();advance(e,1);
 const s=e.getSnapshot();assert.deepEqual(s.player.position,m.shuttle);assert.equal(s.player.movementMode,'idle');assert.equal(s.physics.activity,'task');close(s.physics.energySpentJ,350);close(s.physics.metabolicPowerWatts,350);close(s.resources.oxygenGrams,750-gramsPerHour(350)/3600);
 assert.equal(old.physics.energySpentJ,0);e.dispatch({type:'task-finish',siteId:id});e.dispatch({type:'task-finish',siteId:id});assert.deepEqual(events.map(v=>v.type),['task-started','task-completed']);assert.equal(e.getSnapshot().physics.activity,'idle');assert.equal(e.getSnapshot().resources.oxygenGrams,s.resources.oxygenGrams);
});
test('terminal partial tick: exact zero, no excess motion/time/energy, one failure, commands frozen',()=>{
 const stock=gramsPerHour(430)/3600*.05,e=setup({initialOxygenGrams:stock,emergencyTest:true}),initial=e.getSnapshot(),events=[];e.onEvent(v=>{events.push(v);if(v.type==='mission-failed')assert.equal(e.getSnapshot().mission.status,'failed');});
 move(e,true);e.step(.2);const failed=e.getSnapshot();assert.equal(failed.resources.oxygenGrams,0);assert.equal(failed.mission.status,'failed');close(failed.simTimeSeconds,.05);close(failed.physics.energySpentJ,430*.05);close(failed.player.position.x-12,1.15*.05);assert.equal(failed.player.movementMode,'idle');assert.equal(failed.physics.oxygenRateGramsPerHour,0);
 for(const command of [{type:'input',direction:{x:NaN,z:NaN},run:true},{type:'task-start',siteId:initial.mission.tasks[0].id},{type:'task-finish',siteId:initial.mission.tasks[0].id},{type:'route',route:{source:'none',points:[]}},{type:'resume'},{type:'pause'}])e.dispatch(command);
 for(let i=0;i<100;i++)e.step(.25);assert.equal(e.getSnapshot(),failed);assert.equal(events.filter(v=>v.type==='mission-failed').length,1);
 e.reset();assert.deepEqual(e.getSnapshot(),initial);e.step(.2);assert.equal(e.getSnapshot().player.position.x,12);assert.equal(events.filter(v=>v.type==='reset').length,1);
});
test('initial zero is terminal immediately; warning events are transitions, unsubscribe works',()=>{
 const zero=setup({initialOxygenGrams:0,emergencyTest:true}),events=[];assert.equal(zero.getSnapshot().mission.status,'failed');zero.onEvent(v=>events.push(v));zero.step(.1);zero.step(.1);assert.equal(events.filter(v=>v.type==='mission-failed').length,1);assert.equal(zero.getSnapshot().simTimeSeconds,0);
 const start=150+gramsPerHour(165)/3600*.05,e=setup({initialOxygenGrams:start,emergencyTest:true}),warnings=[];const off=e.onEvent(v=>{if(v.type==='oxygen-warning')warnings.push(v.level);});
 e.step(.1);e.step(.1);assert.deepEqual(warnings,['low']);off();e.step(.2);assert.deepEqual(warnings,['low']);
 const critical=setup({initialOxygenGrams:75+gramsPerHour(165)/3600*.05,emergencyTest:true}),criticalEvents=[];critical.onEvent(v=>{if(v.type==='oxygen-warning')criticalEvents.push(v.level);});critical.step(.1);critical.step(.1);assert.deepEqual(criticalEvents,['critical']);
 assert.equal(oxygenWarning(150,profile),'low');assert.equal(oxygenWarning(75,profile),'critical');assert.equal(oxygenWarning(0,profile),'depleted');
});
test('HUD prioritizes failed/critical/low/boundary, correct emergency percent and unknown suit TEMP',()=>{
 const normal=setup(),initial=normal.getSnapshot(),hud=toHelmetHud(initial);assert.equal(hud.o2.fraction,1);assert.equal(hud.o2.value,'100.00%');assert.equal(hud.temperature.value,'N/A');
 const e=setup({initialOxygenGrams:2,emergencyTest:true}),s=e.getSnapshot(),qa=toHelmetHud({...s,boundaryWarning:true});
 close(qa.o2.fraction,2/750);assert.equal(qa.o2.value,'0.27%');assert.equal(qa.alert.title,'CRITICAL O₂');assert.equal(s.resources.oxygenCapacityGrams,750);assert.equal(s.physics.emergencyTest,true);
 const low=setup({initialOxygenGrams:150,emergencyTest:true});assert.equal(toHelmetHud({...low.getSnapshot(),boundaryWarning:true}).alert.title,'LOW O₂');
 const fail=setup({initialOxygenGrams:0,emergencyTest:true});assert.equal(toHelmetHud(fail.getSnapshot()).alert.title,'MISSION FAILED');assert.equal(toHelmetHud(fail.getSnapshot()).o2.fraction,0);
});
test('legacy four-argument engine remains 3/8 m/s and null O2 with no physics telemetry',()=>{
 for(const [run,speed] of [[false,3],[true,8]]){const e=createEngine(region,mission());move(e,run);e.step(.2);const s=e.getSnapshot();close(s.player.position.x-12,speed*.2);assert.equal(s.resources.oxygenGrams,null);assert.equal(s.resources.oxygenCapacityGrams,null);assert.equal(s.physics,undefined);assert.equal(s.mission.status,undefined);assert.equal(toHelmetHud(s).o2.value,'N/A');}
});
