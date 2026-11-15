import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {estimateEVA,evaMission,DEMO_SITES} from '../src/adapters/eva-demo.ts';
import {MARS_EVA_DEMO_PROFILE as profile,gramsPerHour} from '../src/core/physics.ts';
import {createEngine} from '../src/core/engine.ts';
import {createHeightGrid} from '../src/adapters/world.ts';
const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
const region={id:'test',frameId:'metres',crs:'test',origin:{X:0,Y:0,h0:0},visibleBounds:bounds,playableBounds:bounds};
const tasks=[{id:'a',type:'abrade-rock',position:{x:0,z:-10},status:'pending'},{id:'b',type:'run-moxie',position:{x:10,z:-10},status:'pending'}];
test('planning uses profile workload, seconds and grams, including explicit idle reserve',()=>{
 const p=estimateEVA([{x:0,z:0},{x:0,z:-20}],()=>0,bounds,5);
 assert.ok(Math.abs(p.metres-20)<1e-9);
 assert.ok(Math.abs(p.walkGrams-75*(20/.75)/3600)<1e-9);
 assert.equal(p.taskGrams,gramsPerHour(350)*5/60);
 assert.equal(p.reserveGrams,gramsPerHour(165)*30/60);
 assert.equal(p.tankGrams,750);
 assert.throws(()=>estimateEVA([{x:0,z:0},{x:0,z:-20}],()=>null,bounds,5));
 assert.throws(()=>estimateEVA([{x:0,z:0},{x:0,z:-20}],(_x,z)=>z,bounds,5));
 const uphill=estimateEVA([{x:0,z:0},{x:0,z:-20}],(_x,z)=>-z*.1,bounds,0);
 const downhill=estimateEVA([{x:0,z:-20},{x:0,z:0}],(_x,z)=>-z*.1,bounds,0);
 assert.ok(uphill.walkGrams>downhill.walkGrams);
});
test('exactly two official tasks, physical authority, stationary task load and failure freeze',()=>{
 assert.throws(()=>evaMission(region,{x:0,z:0},tasks.slice(0,1)));
 assert.throws(()=>evaMission(region,{x:0,z:0},[...tasks,{...tasks[0],id:'c'}]));
 assert.throws(()=>evaMission(region,{x:0,z:0},[tasks[0],{...tasks[1],type:'laser-scan'}]));
 const mission=evaMission(region,{x:0,z:-9},tasks);
 const engine=createEngine(region,mission,()=>true,undefined,{profile,heightAt:()=>0,carriedMassKg:0,initialOxygenGrams:.01,emergencyTest:true});
 const before=engine.getSnapshot();engine.dispatch({type:'task-start',siteId:'a'});engine.dispatch({type:'input',direction:{x:1,z:0},run:true});engine.step(.05);
 let s=engine.getSnapshot();assert.equal(s.physics.activity,'task');assert.equal(s.physics.metabolicPowerWatts,350);assert.deepEqual(s.player.position,before.player.position);
 assert.equal(engine.setPosition({x:0,z:0}),false);
 for(let i=0;i<10;i++)engine.step(.1);
 s=engine.getSnapshot();assert.equal(s.mission.status,'failed');assert.equal(s.resources.oxygenGrams,0);
 engine.dispatch({type:'task-finish',siteId:'a'});engine.step(.1);assert.deepEqual(engine.getSnapshot(),s);
 engine.reset();assert.equal(engine.getSnapshot().mission.status,'active');
});
test('all six nearby task pairs are supported by the actual bundled DEM and fit the suit',async()=>{
 const meta=JSON.parse(await readFile('public/data/meta.json','utf8')),g=meta.grids.height_4m;
 const bytes=await readFile('public/'+g.file),half=meta.boxMetres/2;
 const grid=createHeightGrid(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),g.n,g.cell,{minX:-half,maxX:half,minZ:-half,maxZ:half});
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
  const p=estimateEVA([{x:0,z:6.4},DEMO_SITES[i],DEMO_SITES[j],{x:0,z:6.4}],grid.heightAt,{minX:-half+100,maxX:half-100,minZ:-half+100,maxZ:half-100},10);
  assert.ok(p.walkGrams+p.taskGrams+p.reserveGrams<750);
  assert.ok(p.metres<120);
 }
});
