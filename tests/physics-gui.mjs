// Written with AI assistance (Codex). Optional real Electron QA: no engine bridge, no time acceleration.
// Run after npm run build: node tests/physics-gui.mjs (requires an interactive Linux display).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import {focusNative} from './gui-runtime.mjs';
const electron=createRequire(import.meta.url)('electron');
const child=spawn(electron,['.','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{stdio:['ignore','pipe','pipe']});
let output='',ws,id=0;const pending=new Map();
child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
const evaluate=async expression=>{
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
 if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;
};
const button=async text=>evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}); if(!b || b.disabled)throw Error('Button unavailable: '+${JSON.stringify(text)});b.click(); })()`);
const state=()=>evaluate(String.raw`(() => {
 const controls=document.querySelector('.raw-controls')?.textContent??'';
 const telemetry=document.querySelector('[aria-label="Physics telemetry"]')?.textContent??'';
 const gas=telemetry.match(/O₂ ([0-9.]+) \/ ([0-9.]+) g · ([0-9.]+) g\/h/);
 const power=telemetry.match(/(idle|walk|fast|task|failed) · ([0-9.]+) W total/);
 const pos=controls.match(/X ([-0-9.]+) m · Z ([-0-9.]+) m/);
 return {ready:!!document.querySelector('[data-scene-ready="true"]'),oxygen:gas?Number(gas[1]):null,capacity:gas?Number(gas[2]):null,rate:gas?Number(gas[3]):null,
 activity:power?.[1],power:power?Number(power[2]):null,position:pos?[Number(pos[1]),Number(pos[2])]:null,paused:controls.includes('PAUSED'),
 failed:!!document.querySelector('[role="alert"]')?.textContent.includes('MISSION FAILED'),
 emergency:controls.includes('O₂ EMERGENCY DEMO TEST'),canStart:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Start demo task')&&!b.disabled)};
})()`);
const until=async (predicate,timeoutMs,label)=>{
 const deadline=Date.now()+timeoutMs;let s;
 do{s=await state();if(predicate(s))return s;await wait(200);}while(Date.now()<deadline);
 throw new Error(`${label} timed out: ${JSON.stringify(s)}`);
};
const capture=async name=>{const {data}=await send('Page.captureScreenshot');await writeFile(`release/evidence/physics-${name}.png`,Buffer.from(data,'base64'));};
const key=(type,key,code,windowsVirtualKeyCode,modifiers=0)=>send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode,modifiers});
const fast=async down=>{if(down){await focusNative(child.pid);await lock();await key('keyDown','Shift','ShiftLeft',16,8);await key('keyDown','W','KeyW',87,8);}else{await key('keyUp','W','KeyW',87,8);await key('keyUp','Shift','ShiftLeft',16);}};
const lock=async()=>{await send('Page.bringToFront');await evaluate(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent==='Resume')?.click();document.activeElement?.blur();document.querySelector('.raw-scene canvas').click(); })()`);await wait(300);assert.equal(await evaluate('!!document.pointerLockElement'),true);};
try {
 let endpoint;
 for(let i=0;i<100;i++){endpoint=output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];if(endpoint)break;if(child.exitCode!==null)throw Error(output);await wait(100);}
 assert.ok(endpoint,'DevTools endpoint');
 const url=new URL(endpoint),pages=await (await fetch(`http://${url.host}/json/list`)).json();
 const page=pages.find(p=>p.type==='page');assert.ok(page);
 ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);if(r.error)p?.reject(new Error(JSON.stringify(r.error)));else p?.resolve(r.result);};
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:'eva://app/index.html#raw'});await mkdir('release/evidence',{recursive:true});
 await until(s=>s.ready&&s.oxygen>749,15000,'Normal scene');await focusNative(child.pid,true);await send('Page.bringToFront');
 await lock();const idle=await state();await wait(1200);const later=await state();assert.ok(later.oxygen<idle.oxygen);assert.equal(later.power,165);console.log('GUI nominal idle',JSON.stringify(later));
 await fast(true);await until(s=>s.activity==='fast'&&s.rate>100,5000,'Fast gait');
 let target;
 try{target=await until(s=>s.canStart,60000,'Reach science site');}finally{await fast(false);}
 await evaluate('document.exitPointerLock()');await button('Start demo task (within 5 m)');await until(s=>s.activity==='task',3000,'Task workload');
 const working=await state();await wait(1200);const worked=await state();assert.equal(worked.power,350);assert.deepEqual(worked.position,working.position);assert.ok(worked.oxygen<working.oxygen);
 await button('Finish demo task (within 5 m)');await until(s=>s.activity==='idle',3000,'Task finish');console.log('GUI task stationary, finish preserved',JSON.stringify(target));
 await capture('normal-task');
 await button('TEST: O₂ EMERGENCY DEMO (2 g / 750 g)');await until(s=>s.ready&&s.emergency&&s.capacity===750&&s.oxygen>1.9,15000,'Emergency reset');
 await capture('emergency');await lock();await fast(true);console.log('GUI emergency burning at real simulation rate');
 let terminal;
 try {terminal=await until(s=>s.failed,120000,'Oxygen failure');} finally {await fast(false);}
 assert.equal(terminal.oxygen,0);assert.equal(terminal.rate,0);assert.equal(terminal.activity,'failed');await capture('failed');
 const frozen=await state();await wait(1000);assert.deepEqual((await state()).position,frozen.position);assert.equal((await state()).oxygen,0);
 await evaluate('document.exitPointerLock()');await button('Reset');await until(s=>!s.failed&&s.emergency&&s.oxygen>1.9,10000,'Emergency reset');
 await button('Return to normal O₂ (750 g)');await until(s=>s.ready&&!s.emergency&&s.oxygen>749,15000,'Normal restore');
 await capture('restored');console.log('GUI PASS: nominal idle/fast/task, emergency true capacity, real depletion/failure, frozen movement, reset and nominal restoration');
} catch(error){console.error(error);if(ws?.readyState===WebSocket.OPEN)try{await capture('failure');}catch{}console.error(output);process.exitCode=1;}
finally {ws?.close();child.kill();}
