// Rachel preview compatibility is explicitly legacy-only and MUST NOT bypass physical EVA gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/core/engine.ts';
import { TASK_IDS, PREVIEW_ONLY_TASK_IDS } from '../src/core/contracts.ts';
import { MARS_EVA_DEMO_PROFILE as profile } from '../src/core/physics.ts';
const bounds={minX:-20,maxX:20,minZ:-20,maxZ:20};
const region={id:'compat',frameId:'local-metres',crs:'test',origin:{X:0,Y:0,h0:0},visibleBounds:bounds,playableBounds:bounds};
const mission=(type='take-core')=>({regionId:region.id,shuttle:{x:0,z:0},tasks:[{id:'site',type,position:{x:5,z:0},status:'pending'}],route:{source:'demo',points:[{x:0,z:0},{x:5,z:0}]}});
test('four official EVA task IDs are unchanged and Rachel preview extras are segregated',()=>{
 assert.deepEqual(TASK_IDS,['abrade-rock','take-core','sample-depot','run-moxie']);
 assert.deepEqual(PREVIEW_ONLY_TASK_IDS,['laser-scan','panorama']);
 assert.throws(()=>createEngine(region,mission('laser-scan'),()=>true,undefined,{profile,heightAt:()=>0,carriedMassKg:0}),/Invalid task site/);
});
test('legacy Rachel preview supports camera sync and laser 2-7m start without changing real physics',()=>{
 const e=createEngine(region,mission('laser-scan')),events=[];
 e.onEvent(event=>events.push(event.type));
 assert.equal(e.setPosition({x:1,z:0}),true);
 e.dispatch({type:'task-start',siteId:'site'}); // 4 m from laser
 assert.equal(e.getSnapshot().mission.tasks[0].status,'active');
 e.dispatch({type:'task-finish',siteId:'site'});
 assert.equal(e.getSnapshot().mission.tasks[0].status,'complete');
 assert.deepEqual(events,['task-started','task-completed']);
 const bad=e.setPosition({x:30,z:0});
 assert.equal(bad,false);
 assert.deepEqual(e.getSnapshot().player.position,{x:1,z:0});
 assert.equal(e.getSnapshot().resources.oxygenGrams,null);
});
test('preview-only laser is rejected nearer than 2m; panorama legacy remains accepted',()=>{
 const e=createEngine(region,mission('laser-scan'));
 assert.equal(e.setPosition({x:4,z:0}),true);
 e.dispatch({type:'task-start',siteId:'site'});
 assert.equal(e.getSnapshot().mission.tasks[0].status,'pending');
 const pano=createEngine(region,mission('panorama'));
 pano.dispatch({type:'task-start',siteId:'site'});
 assert.equal(pano.getSnapshot().mission.tasks[0].status,'active');
});
test('position teleport API always refuses physics-enabled EVA and failed mission',()=>{
 const e=createEngine(region,mission(),()=>true,undefined,{profile,heightAt:()=>0,carriedMassKg:0});
 const start=e.getSnapshot();
 assert.equal(e.setPosition({x:5,z:0}),false);
 assert.equal(e.getSnapshot(),start);
 assert.equal(e.getSnapshot().resources.oxygenGrams,750);
});
