// Shared optional native QA harness. No production bridge, unsafe GPU flag or engine replacement.
import { spawn,execFile } from 'node:child_process';
import {promisify} from 'node:util';
import { createRequire } from 'node:module';
import { mkdir,writeFile,mkdtemp,rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function focusNative(pid,layout=false){
 if(!process.env.HYPRLAND_INSTANCE_SIGNATURE)return;
 // Hyprland 0.57 denies application-initiated focus. Target ONLY our child,
 // using its compositor window object; no persistent desktop configuration.
 const arrange=layout?'hl.dispatch(hl.dsp.window.float({action="on",window=w}));hl.dispatch(hl.dsp.window.resize({x=1280,y=800,relative=false,window=w}));hl.dispatch(hl.dsp.window.center({window=w}));':'';
 await promisify(execFile)('hyprctl',['eval',`for _,w in ipairs(hl.get_windows()) do if w.pid==${Number(pid)} then ${arrange}hl.dispatch(hl.dsp.focus({window=w})) end end`]);
}
export const instrumentation=String.raw`(() => {
 const q=window.__runtimeQA={renderers:[],camera:null,scene:null,keys:[],audio:[],frames:new Set(),intervals:new Set(),listeners:[]};
 const raf=requestAnimationFrame.bind(window),caf=cancelAnimationFrame.bind(window);
 window.requestAnimationFrame=fn=>{let id=raf(t=>{q.frames.delete(id);fn(t);});q.frames.add(id);return id;};
 window.cancelAnimationFrame=id=>{q.frames.delete(id);caf(id);};
 const si=setInterval.bind(window),ci=clearInterval.bind(window);
 window.setInterval=(fn,ms,...args)=>{const id=si(fn,ms,...args);q.intervals.add(id);return id;};
 window.clearInterval=id=>{q.intervals.delete(id);ci(id);};
 const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
 const capture=o=>typeof o==='boolean'?o:!!o?.capture;
 const tracked=(target,type)=>['keydown','keyup','mousemove','blur','visibilitychange','pointerlockchange'].includes(type)&&(target===window||target===document||target instanceof HTMLCanvasElement);
 EventTarget.prototype.addEventListener=function(type,fn,opts){if(tracked(this,type)&&!opts?.once&&!q.listeners.some(v=>v.target===this&&v.type===type&&v.fn===fn&&v.capture===capture(opts)))q.listeners.push({target:this,type,fn,capture:capture(opts)});return add.call(this,type,fn,opts);};
 EventTarget.prototype.removeEventListener=function(type,fn,opts){q.listeners=q.listeners.filter(v=>!(v.target===this&&v.type===type&&v.fn===fn&&v.capture===capture(opts)));return remove.call(this,type,fn,opts);};
 add.call(window,'keydown',e=>{q.keys.push({code:e.code,trusted:e.isTrusted});if(q.keys.length>200)q.keys.shift();});
 const AC=window.AudioContext;
 window.AudioContext=new Proxy(AC,{construct(target,args){const ctx=Reflect.construct(target,args);q.audio.push(ctx);ctx.__gains=[];const gain=ctx.createGain.bind(ctx);ctx.createGain=()=>{const n=gain();ctx.__gains.push(n);return n;};return ctx;}});
 window.__THREE_DEVTOOLS__=new EventTarget();
 __THREE_DEVTOOLS__.addEventListener('observe',e=>{
  const r=e.detail;if(!r.isWebGLRenderer)return;
  const record={ref:new WeakRef(r),disposed:false,frames:0,lateFrames:0};q.renderers.push(record);
  const render=r.render.bind(r),dispose=r.dispose.bind(r);
  r.render=(scene,camera)=>{
   if(record.disposed)record.lateFrames++;
   if(camera.isPerspectiveCamera&&r.domElement.matches('.raw-scene canvas,.preview-canvas canvas')){q.camera=camera;q.scene=scene;q.renderer=r;record.frames++;}
   return render(scene,camera);
  };
  r.dispose=()=>{record.disposed=true;return dispose();};
 });
 q.engine=()=>{
  let fiber=Object.entries(document.querySelector('.raw-app')??{}).find(([k])=>k.startsWith('__reactFiber'))?.[1];
  for(;fiber;fiber=fiber.return)for(let hook=fiber.memoizedState;hook;hook=hook.next){const candidate=hook.memoizedState?.current;if(candidate?.getSnapshot&&candidate?.dispatch)return candidate;}
  return null;
 };
 q.read=()=>{
  const c=q.camera;if(!c)return null;
  const f=c.getWorldDirection(c.position.clone()),n=Math.hypot(f.x,f.z);
  const engine=q.engine(),snapshot=engine?.getSnapshot();
  const gl=q.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return{position:{x:c.position.x,y:c.position.y,z:c.position.z},forward:{x:f.x/n,z:f.z/n},quaternion:c.quaternion.toArray(),euler:c.rotation.toArray(),snapshot,
   locked:!!document.pointerLockElement,focus:document.hasFocus(),raw:!!document.querySelector('.raw-app'),base:!!document.querySelector('.base-ui'),console:!!document.querySelector('.preview-console'),
   renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),lost:gl.isContextLost(),
   canvases:{raw:document.querySelectorAll('.raw-scene canvas').length,preview:document.querySelectorAll('.preview-canvas canvas').length},
   resources:{renderers:q.renderers.filter(r=>!r.disposed).length,lateFrames:q.renderers.reduce((n,r)=>n+r.lateFrames,0),frames:q.frames.size,intervals:q.intervals.size,listeners:q.listeners.length,
    audio:q.audio.filter(a=>a.state!=='closed').map(a=>({state:a.state,time:a.currentTime,master:a.__gains[0]?.gain.value}))}};
 };
})()`;
export async function launchGui(label='movement'){
 await mkdir('release/evidence/post-merge',{recursive:true});
 const electron=createRequire(import.meta.url)('electron');
 const child=spawn(electron,['.','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{stdio:['ignore','pipe','pipe']});
 let output='',ws,id=0;const pending=new Map(),errors=[],network=[];
 child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 const close=async()=>{ws?.close();child.kill();await writeFile(`release/evidence/post-merge/${label}-electron.log`,output);};
 try{
  let endpoint;for(let i=0;i<150;i++){endpoint=output.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];if(endpoint)break;if(child.exitCode!==null)throw Error(output);await wait(100);}
  if(!endpoint)throw Error('No native DevTools endpoint: '+output);
  const url=new URL(endpoint),pages=await(await fetch(`http://${url.host}/json/list`)).json(),page=pages.find(p=>p.type==='page');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{const r=JSON.parse(event.data);if(r.id){const p=pending.get(r.id);pending.delete(r.id);r.error?p?.reject(Error(JSON.stringify(r.error))):p?.resolve(r.result);}else if(r.method==='Runtime.exceptionThrown')errors.push(r.params);else if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error')errors.push(r.params);else if(r.method==='Network.requestWillBeSent')network.push(r.params.request.url);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async(expression,description,timeout=30000)=>{const deadline=Date.now()+timeout;let v;do{v=await evaluate('Boolean('+expression+')');if(v)return v;await wait(100);}while(Date.now()<deadline);throw Error('Timeout '+description+': '+JSON.stringify(v));};
  const read=()=>evaluate('window.__runtimeQA.read()');
  const screenshot=async name=>{const {data}=await send('Page.captureScreenshot');await writeFile(`release/evidence/post-merge/${label}-${name}.png`,Buffer.from(data,'base64'));};
  const key=async(type,code)=>{const k=code.startsWith('Key')?code.slice(3):code.startsWith('Shift')?'Shift':code;const vk=k==='Shift'?16:k==='Escape'?27:k.charCodeAt(0);await send('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:vk,modifiers:k==='Shift'?8:0});};
  const click=async selector=>{const r=await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing click target');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});};
  const lock=async()=>{await focusNative(child.pid);await send('Page.bringToFront');await evaluate(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent==='Resume')?.click();document.activeElement?.blur();document.querySelector('.raw-scene canvas,.preview-canvas canvas').click();})()`);await until('!!document.pointerLockElement','native pointer lock',7000);await wait(100);};
  const navigate=async suffix=>{await send('Page.navigate',{url:'eva://app/index.html'+suffix});await until('window.__runtimeQA?.camera&&document.querySelector(".raw-scene canvas,.preview-canvas canvas")','instrumented scene',45000);await wait(800);};
  const escapeNative=async()=>{
   if(process.env.HYPRLAND_INSTANCE_SIGNATURE){
    await focusNative(child.pid);
    await promisify(execFile)('hyprctl',['eval',`for _,w in ipairs(hl.get_windows()) do if w.pid==${child.pid} then hl.dispatch(hl.dsp.send_shortcut({key="Escape",mods="",window=w})) end end`]);
   }else{await key('keyDown','Escape');await key('keyUp','Escape');}
  };
  const focusAway=async()=>{
   // A real second native window, not dispatchEvent(new Event('blur')).
   const directory=await mkdtemp(join(tmpdir(),'eva-focus-')),entry=join(directory,'focus.cjs');
   await writeFile(entry,`const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({width:320,height:180,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});w.loadURL('data:text/html,Native%20focus%20QA');w.webContents.once('did-finish-load',()=>{w.show();w.focus();});});app.on('window-all-closed',()=>app.quit());`);
   const other=spawn(electron,[entry],{stdio:['ignore','ignore','pipe']});
   let diagnostics='';other.stderr.on('data',b=>diagnostics+=b);
   try{await wait(1800);await focusNative(other.pid);await until('!document.hasFocus()','real native focus loss: '+diagnostics,10000);}
   catch(error){other.kill();await rm(directory,{recursive:true,force:true});throw error;}
   return async()=>{other.kill();await rm(directory,{recursive:true,force:true});await focusNative(child.pid);await send('Page.bringToFront');};
  };
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:instrumentation});
  await navigate('');await until('document.querySelector("[data-scene-ready=true]")','RAW ready');await focusNative(child.pid,true);await send('Page.bringToFront');await wait(1000);
  return{child,send,evaluate,until,read,screenshot,key,click,lock,navigate,escapeNative,focusAway,close,errors,network};
 }catch(error){await close();throw error;}
}
