import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEngine} from '../src/core/engine.ts';
import {MARS_EVA_DEMO_PROFILE as profile,gramsPerHour} from '../src/core/physics.ts';
import {createFixedClock} from '../src/adapters/clock.ts';
import {toHelmetHud} from '../src/adapters/hud.ts';
import {advanceThermalModel} from '../src/physics/thermal.ts';
import {THERMAL_ENGINEERING_SCENARIO as scenario} from '../src/physics/thermal-scenario.ts';
const bounds={minX:-5000,maxX:5000,minZ:-5000,maxZ:5000};
const region={id:'thermal-test',frameId:'local-metres',crs:'synthetic',origin:{X:0,Y:0,h0:0},visibleBounds:bounds,playableBounds:bounds};
const mission={regionId:region.id,shuttle:{x:0,z:0},tasks:[{id:'a',type:'take-core',position:{x:0,z:0},status:'pending'},{id:'b',type:'run-moxie',position:{x:8,z:0},status:'pending'}],route:{source:'demo',points:[{x:0,z:0},{x:8,z:0}]}};
const setup=(options={})=>createEngine(region,mission,undefined,undefined,{profile,heightAt:()=>0,carriedMassKg:0,...options});
const advance=(engine,seconds,dt=1/60)=>{for(let i=0;i<Math.round(seconds/dt);i++)engine.step(dt);};
const move=(engine,run=false)=>engine.dispatch({type:'input',direction:{x:1,z:0},run});
const temperatures=['coreTemperatureK','skinTemperatureK','suitGasTemperatureK','outerShellTemperatureK'];
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (tolerance ${tol})`);
function expected(thermal,watts,seconds,configuration=scenario){return advanceThermalModel(configuration.parameters,thermal,{...configuration.boundaries,metabolicPowerW:watts,respiratorySensibleHeatToGasW:watts*configuration.respiratorySensibleFraction},seconds);}

test('physical engine initializes four immutable thermal states; legacy and explicit opt-out retain N/A',()=>{
 const s=setup().getSnapshot();for(const key of temperatures)assert.equal(s.thermal[key],scenario.initialState[key]);
 assert.equal(toHelmetHud(s).temperature.value,'23.0°C');assert.equal(s.thermal.validationStatus,'engineering-unvalidated');
 assert.throws(()=>{s.thermal.suitGasTemperatureK=999;});assert.equal(s.thermal.cumulativeNetEnergyInputJ,0);
 for(const engine of [setup({thermal:false}),createEngine(region,mission)]){assert.equal(engine.getSnapshot().thermal,undefined);assert.equal(toHelmetHud(engine.getSnapshot()).temperature.value,'N/A');}
});
test('thermal uses actual slope-adjusted metabolism without changing movement, O2 or metabolic energy',()=>{
 const on=setup({heightAt:x=>.1*x}),off=setup({heightAt:x=>.1*x,thermal:false});
 const before=on.getSnapshot();move(on,true);move(off,true);on.step(.2);off.step(.2);const s=on.getSnapshot();
 assert.ok(s.physics.metabolicPowerWatts>profile.powerFastW);assert.equal(s.thermal.lastMetabolicPowerW,s.physics.metabolicPowerWatts);
 const reference=expected(before.thermal,s.physics.metabolicPowerWatts,.2);
 for(const key of temperatures)close(s.thermal[key],reference.state[key]);
 const {thermal,...rest}=s;assert.deepEqual(rest,off.getSnapshot());assert.ok(Math.abs(thermal.energyBalanceResidualJ)<1e-5);
});
test('idle/walk/fast/science produce distinct thermal dynamics; science counts one stationary workload',()=>{
 const results={};
 for(const activity of ['idle','walk','fast','task']){
  const engine=setup();if(activity==='task'){engine.dispatch({type:'task-start',siteId:'a'});move(engine,true);}else if(activity!=='idle')move(engine,activity==='fast');
  advance(engine,60);results[activity]=engine.getSnapshot();
  assert.equal(results[activity].thermal.lastMetabolicPowerW,results[activity].physics.metabolicPowerWatts);
 }
 assert.ok(results.fast.thermal.suitGasTemperatureK>results.task.thermal.suitGasTemperatureK);
 assert.ok(results.task.thermal.suitGasTemperatureK>results.walk.thermal.suitGasTemperatureK);
 assert.ok(results.walk.thermal.suitGasTemperatureK>results.idle.thermal.suitGasTemperatureK);
 assert.equal(results.task.thermal.lastMetabolicPowerW,350);assert.deepEqual(results.task.player.position,{x:0,z:0});
 close(results.task.physics.energySpentJ,350*60,1e-6);
});
test('cooling ON/OFF has an energy-conserving, non-instantaneous effect on the coupled nodes',()=>{
 const enabled=setup(),disabled=setup({thermal:{...scenario,boundaries:{...scenario.boundaries,coolingEnabled:false}}});
 move(enabled,true);move(disabled,true);advance(enabled,600);advance(disabled,600);
 const on=enabled.getSnapshot().thermal,off=disabled.getSnapshot().thermal;
 assert.ok(off.humanStoredHeatJ>on.humanStoredHeatJ);assert.ok(off.suitGasTemperatureK>on.suitGasTemperatureK);
 assert.ok(on.coolingHeatW>0&&on.coolingHeatW<=scenario.parameters.coolingCapacityW);assert.equal(off.coolingHeatW,0);
 for(const s of [on,off])assert.ok(Math.abs(s.energyBalanceResidualJ)<.01);
});
test('pause and reset freeze/restore the complete thermal state and energy counters',()=>{
 const engine=setup(),initial=engine.getSnapshot();move(engine,true);advance(engine,2);const old=engine.getSnapshot();
 engine.pause();const paused=engine.getSnapshot();advance(engine,3);assert.deepEqual(engine.getSnapshot(),paused);
 assert.deepEqual(paused.thermal,old.thermal);engine.resume();engine.step(.1);assert.notDeepEqual(engine.getSnapshot().thermal,paused.thermal);
 engine.reset();assert.deepEqual(engine.getSnapshot(),initial);assert.equal(initial.thermal.suitGasTemperatureK,296.15);
});
test('terminal partial timestep heats only for surviving O2 time, then all commands remain frozen',()=>{
 const elapsed=.025,engine=setup({initialOxygenGrams:gramsPerHour(165)/3600*elapsed,emergencyTest:true});
 const before=engine.getSnapshot();engine.step(.2);const failed=engine.getSnapshot();close(failed.simTimeSeconds,elapsed);assert.equal(failed.resources.oxygenGrams,0);
 const reference=expected(before.thermal,165,elapsed);for(const key of temperatures)close(failed.thermal[key],reference.state[key]);
 close(failed.thermal.cumulativeNetEnergyInputJ,reference.state.cumulativeNetEnergyInputJ,1e-9);
 for(const type of ['resume','pause','task-start','task-finish'])engine.dispatch({type,siteId:'a'});
 engine.step(.2);assert.deepEqual(engine.getSnapshot(),failed);engine.reset();assert.deepEqual(engine.getSnapshot(),before);
 const zero=setup({initialOxygenGrams:0,emergencyTest:true}),cold=zero.getSnapshot().thermal;zero.step(.2);assert.deepEqual(zero.getSnapshot().thermal,cold);
});
test('one fixed 60 Hz clock gives identical results across render grouping; coarser steps have bounded error',()=>{
 const result=fps=>{const engine=setup(),clock=createFixedClock(engine);move(engine,true);for(let i=0;i<=fps*4;i++)clock.tick(i/fps);clock.dispose();return engine.getSnapshot().thermal;};
 assert.deepEqual(result(30),result(144));
 const fine=setup(),coarse=setup();move(fine,true);move(coarse,true);advance(fine,60);advance(coarse,60,.1);
 for(const key of temperatures)close(fine.getSnapshot().thermal[key],coarse.getSnapshot().thermal[key],.002);
});
test('captured thermal configuration cannot be mutated by callers; invalid configurations reject',()=>{
 const custom=structuredClone(scenario),engine=setup({thermal:custom});custom.initialState.suitGasTemperatureK=400;custom.parameters.suitGasHeatCapacityJPerK=0;
 engine.step(.1);assert.ok(engine.getSnapshot().thermal.suitGasTemperatureK<297);
 assert.throws(()=>setup({thermal:{...scenario,respiratorySensibleFraction:NaN}}));
});
test('HUD converts suit gas once, never core/ambient, and main Preview binds that exact adapter field',async()=>{
 const s=setup().getSnapshot(),hud=toHelmetHud({...s,thermal:{...s.thermal,suitGasTemperatureK:300.15,coreTemperatureK:999}});
 assert.equal(hud.temperature.value,'27.0°C');close(hud.temperature.fraction,27/50);assert.equal(hud.temperature.level,undefined);
 assert.equal(toHelmetHud({...s,thermal:{...s.thermal,suitGasTemperatureK:NaN}}).temperature.value,'N/A');
 const source=await readFile('src/dev/Preview.tsx','utf8');assert.ok(source.includes('temperature={physicalHud?.temperature ??'));
 assert.ok(source.includes('MODELED / NOT NASA-VALIDATED'));
});
