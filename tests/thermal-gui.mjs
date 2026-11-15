// Optional real Electron check of the main helmet, not a replacement thermal clock.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchGui,wait} from './gui-runtime.mjs';
await mkdir('release/evidence/thermal',{recursive:true});
const g=await launchGui('thermal'),evidence={};
const read=async()=>({state:await g.read(),display:await g.evaluate('document.querySelector(".preview .hud-bar-value")?.textContent')});
try {
 await g.navigate('');await g.until('document.querySelector(".preview-badge")?.textContent.includes("demo-shaped")','default base terrain');
 await g.lock();await g.evaluate('(()=>{const p=-.08;__runtimeQA.camera.quaternion.set(Math.sin(p/2),0,0,Math.cos(p/2));})()');
 await g.key('keyDown','KeyW');await wait(650);await g.key('keyUp','KeyW');await g.click('.preview-canvas canvas');
 await g.until('document.querySelector(".preview-console")?.style.visibility==="visible"','console');
 assert.equal(await g.evaluate('[...document.querySelectorAll(".plan-task input")].filter(e=>e.checked).length'),2);
 await g.key('keyDown','Escape');await g.key('keyUp','Escape');await g.until('!!document.querySelector(".base-ui")','stand');
 await g.lock();await g.evaluate('__runtimeQA.camera.quaternion.set(0,1,0,0)');await g.key('keyDown','KeyW');await wait(2800);await g.key('keyUp','KeyW');
 await g.key('keyDown','KeyE');await g.key('keyUp','KeyE');await g.until('__runtimeQA.read()?.snapshot?.thermal&&document.querySelector(".preview .hud-bar-value")?.textContent.includes("°C")','visible modeled TEMP');
 evidence.initial=await read();assert.ok(Math.abs(parseFloat(evidence.initial.display)-23)<.2);
 assert.ok(await g.evaluate('document.body.textContent.includes("MODELED / NOT NASA-VALIDATED")'));
 await wait(4000);await g.lock();await g.key('keyDown','KeyW');await wait(2500);await g.key('keyDown','ShiftLeft');await wait(3000);
 await g.key('keyUp','KeyW');await g.key('keyUp','ShiftLeft');await wait(300);evidence.live=await read();
 assert.notEqual(evidence.live.display,evidence.initial.display);
 assert.ok(evidence.live.state.snapshot.resources.oxygenGrams<evidence.initial.state.snapshot.resources.oxygenGrams);
 assert.ok(Math.abs(parseFloat(evidence.live.display)-(evidence.live.state.snapshot.thermal.suitGasTemperatureK-273.15))<.11);
 assert.ok(Math.abs(evidence.live.state.snapshot.thermal.suitGasTemperatureK-evidence.initial.state.snapshot.thermal.suitGasTemperatureK)<1);
 await g.screenshot('live');
 await g.escapeNative();await g.until('__runtimeQA.read().snapshot.paused','pause on Escape');await wait(300);const paused=await read();
 await wait(1500);const still=await read();assert.deepEqual(still.state.snapshot.thermal,paused.state.snapshot.thermal);assert.equal(still.display,paused.display);evidence.paused=still;
 await g.lock();await wait(3000);evidence.resumed=await read();assert.notEqual(evidence.resumed.state.snapshot.thermal.suitGasTemperatureK,still.state.snapshot.thermal.suitGasTemperatureK);
 await g.escapeNative();await g.until('!document.pointerLockElement','unlock for reset');
 await g.click('[aria-label="EVA physics telemetry"] button:nth-of-type(2)');await g.until('!!document.querySelector(".base-ui")','reset to inactive base');
 assert.equal(await g.evaluate('__runtimeQA.engine()'),null);assert.equal(g.errors.length,0,JSON.stringify(g.errors));
 console.log('PASS main native helmet:',evidence.initial.display,'->',evidence.live.display,'; gas K matches; movement/O2; pause freeze; resume; reset to inactive base; no runtime errors');
}catch(error){evidence.failure=String(error);await g.screenshot('failure');throw error;}
finally{evidence.errors=g.errors;await writeFile('release/evidence/thermal/gui.json',JSON.stringify(evidence,null,2));await g.close();}
