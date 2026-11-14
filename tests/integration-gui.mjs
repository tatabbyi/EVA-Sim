// Optional native combined-build QA. Existing demo entry points exercise real
// task animations at their original rates; no production test bridge is added.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launchGui,wait} from './gui-runtime.mjs';
import {createHeightGrid} from '../src/adapters/world.ts';
import {DEMO_MOVEMENT} from '../src/core/engine.ts';
const gui=await launchGui('integration'),evidence={tasks:[],checks:[]};
const body='document.body.textContent';
const escape=async mode=>{
 await gui.lock();await gui.escapeNative();
 await gui.until('!document.pointerLockElement',mode+' native Escape unlock',3000);
 evidence.checks.push(mode+' native Escape releases pointer lock');
};
try {
 await gui.until('__runtimeQA.scene.getObjectByName("route-path")?.visible','RAW route');
 const initial=await gui.read();assert.equal(initial.snapshot.resources.oxygenCapacityGrams,750);
 assert.equal(initial.snapshot.physics.gravityMps2,3.711);assert.equal(initial.lost,false);
 const meta=JSON.parse(await readFile('public/data/meta.json','utf8')),grid=meta.grids.height_4m;
 const bytes=await readFile('public/'+grid.file),bounds=initial.snapshot.region.visibleBounds;
 const heights=createHeightGrid(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),grid.n,grid.cell,bounds);
 const {x,z}=initial.snapshot.player.position;
 assert.ok(Math.abs(initial.position.y-heights.heightAt(x,z)-DEMO_MOVEMENT.eyeHeightMetres)<1e-6);
 evidence.terrain=await gui.evaluate(`(() => {const m=__runtimeQA.scene.children.find(o=>o.geometry?.type==='PlaneGeometry');
 const n=m.geometry.attributes.normal;m.geometry.computeBoundingBox();let minUp=1,finite=true;
 for(let i=0;i<n.count;i+=97){minUp=Math.min(minUp,n.getY(i));finite&&=[n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite);}
 return {vertices:n.count,minUp,finite,bounds:m.geometry.boundingBox};})()`);
 assert.ok(evidence.terrain.finite&&evidence.terrain.minUp>0);
 assert.equal(evidence.terrain.bounds.min.x,bounds.minX);assert.equal(evidence.terrain.bounds.max.z,bounds.maxZ);
 await gui.lock();
 const before=(await gui.read()).snapshot.simTimeSeconds,started=performance.now();
 await wait(600);const after=(await gui.read()).snapshot.simTimeSeconds;
 evidence.clock={before,after,wallMilliseconds:performance.now()-started};
 assert.ok(after-before>.3&&after-before<1);assert.ok(Math.abs(after*60-Math.round(after*60))<1e-6);
 await gui.evaluate('__runtimeQA.engine().pause()');const frozen=(await gui.read()).snapshot;
 await wait(500);assert.deepEqual((await gui.read()).snapshot,frozen);
 await gui.evaluate('__runtimeQA.engine().resume()');await wait(200);assert.ok((await gui.read()).snapshot.simTimeSeconds>frozen.simTimeSeconds);
 await gui.screenshot('raw-route');
 // Use the public route command to model an unavailable planner result.
 await gui.evaluate(`__runtimeQA.engine().dispatch({type:'route',route:{source:'none',points:[],unavailableReason:'QA: planner unavailable'}})`);
 await gui.until(`${body}.includes('Route unavailable: QA: planner unavailable')`,'explicit route error');
 assert.equal(await gui.evaluate('!!__runtimeQA.scene.getObjectByName("route-path")'),false);
 await gui.screenshot('route-unavailable');
 await gui.evaluate('__runtimeQA.engine().reset()');
 await gui.until('__runtimeQA.scene.getObjectByName("route-path")?.visible','route recovery');
 assert.deepEqual((await gui.read()).snapshot.player.position,{x:12,z:12});
 evidence.checks.push('RAW real WebGL, visible route, 60 Hz quantization, pause/resume, unavailable route, reset/recovery');
 await escape('RAW');
 await gui.navigate('#preview');await escape('base');
 for(const [kind,done] of [['abrade','PATCH ABRADED'],['core','SAMPLE STORED'],['depot','TUBE DEPOSITED'],['moxie','MOXIE RUN COMPLETE']]) {
  await gui.navigate('?demo='+kind+'#preview');
  await gui.until(`${body}.match(/[0-9]+%/)`,'animated '+kind+' progress');
  const progress=await gui.evaluate(`${body}.match(/[0-9]+%/)?.[0]`),start=await gui.read();
  await gui.screenshot(kind+'-active');
  await gui.until(`${body}.includes(${JSON.stringify(done)})`,kind+' completion',30000);
  const finish=await gui.read();await gui.screenshot(kind+'-complete');
  assert.equal(finish.lost,false);assert.equal(finish.canvases.preview,1);
  evidence.tasks.push({kind,progress,start,finish,done});
  console.log('TASK PASS',kind,progress,'->',done);
 }
 await gui.lock();await gui.until('__runtimeQA.read().resources.audio.some(a=>a.state==="running"&&a.master>0.89)','running suit audio');
 await gui.key('keyDown','KeyM');await gui.key('keyUp','KeyM');
 // Existing audio intentionally smooths toward zero (50 ms time constant).
 // Require >59 dB attenuation, not mathematically impossible exact zero.
 await gui.until('__runtimeQA.read().resources.audio.some(a=>a.state==="running"&&a.master<0.001)','mute attenuation',3000);
 const muted=await gui.read();
 await gui.key('keyDown','KeyM');await gui.key('keyUp','KeyM');
 await gui.until('__runtimeQA.read().resources.audio.some(a=>a.state==="running"&&a.master>0.89)','unmute gain recovery',3000);
 const unmuted=await gui.read();
 await escape('EVA');
 evidence.audio={muted:muted.resources.audio,unmuted:unmuted.resources.audio};
 assert.equal(gui.errors.length,0,JSON.stringify(gui.errors));
 assert.ok(gui.network.every(url=>/^(eva:|blob:|data:)/.test(url)));
 console.log('INTEGRATION PASS: RAW route/clock/reset; four preview animations; WebAudio mute; no runtime errors or online requests');
} catch(error){evidence.failure=String(error);await gui.screenshot('failure');throw error;}
finally{evidence.errors=gui.errors;evidence.network=gui.network;await writeFile('release/evidence/post-merge/integration.json',JSON.stringify(evidence,null,2));await gui.close();}
