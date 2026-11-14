// Written with AI assistance (Codex). Alex's scene composition; uses Rachel's public visual APIs.
import * as THREE from 'three';
import { createTerrainMaterial, setHeightRange } from '../terrain/material';
import { createStarrySky } from '../terrain/sky';
import { createRoutePath, type RoutePath } from '../terrain/routePath';
import { createSampleSite } from '../terrain/sampleSite';
import { DEMO_MOVEMENT, type Engine } from '../core/engine';
import { createDemoInput } from './input';
import type { HeightProvider } from './world';
export function mountScene(host: HTMLDivElement, engine: Engine, heights: HeightProvider) {
  const disposers: Array<() => void> = [];
  let cleaned = false;
  const dispose = () => { if (cleaned) return; cleaned = true; for (const fn of disposers.reverse()) fn(); };
  try {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  disposers.push(() => { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); delete host.dataset.sceneReady; });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, 0.1, 8000);
  scene.background = new THREE.Color('#060b12');
  scene.add(new THREE.HemisphereLight('#bcd2ff', '#3a2a20', 1), new THREE.DirectionalLight('#fff3e2', 2));
  const sky = createStarrySky(); disposers.push(() => sky.dispose()); sky.setPixelRatio(renderer.getPixelRatio()); scene.add(sky.group);
  const groundAt = (x: number, z: number) => { const h = heights.heightAt(x,z); if (h === null) throw new Error('Terrain unavailable at visual position'); return h; };
  const b = heights.bounds, segments = 512; // 8 m display mesh over original 4 m sampling grid; temporary adapter
  const geometry = new THREE.PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ,segments,segments);
  disposers.push(() => geometry.dispose());
  geometry.rotateX(-Math.PI/2); geometry.translate((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);
  const positions = geometry.attributes.position;
  let min = Infinity, max = -Infinity;
  for (let i=0; i<positions.count; i++) { const h = groundAt(positions.getX(i),positions.getZ(i)); positions.setY(i,h); min=Math.min(min,h); max=Math.max(max,h); }
  geometry.computeVertexNormals();
  const material = createTerrainMaterial(); disposers.push(() => { material.uniforms.uO2Grid.value.dispose(); material.uniforms.uComms.value.dispose(); material.dispose(); }); setHeightRange(material,min,max);
  // Disable unapproved suit/terrain hazard and Leash models in the existing shader.
  material.uniforms.uO2Left.value = 0; material.uniforms.uReserve.value = 0;
  material.uniforms.uHasO2.value = 0; material.uniforms.uHasComms.value = 0;
  material.uniforms.uSlopeWarn.value = 90; material.uniforms.uSlopeMax.value = 91;
  scene.add(new THREE.Mesh(geometry,material));
  const snapshot = engine.getSnapshot();
  const core = snapshot.mission.tasks.find(t => t.type === 'take-core');
  let sample = core ? createSampleSite(new THREE.Vector3(core.position.x,groundAt(core.position.x,core.position.z),core.position.z)) : null;
  disposers.push(() => sample?.dispose());
  if (sample) scene.add(sample.group);
  const resources: Array<{ dispose(): void }> = []; disposers.push(() => resources.forEach(r => r.dispose()));
  const marker = (x: number,z: number,color: string) => {
    const g = new THREE.CylinderGeometry(0.5,0.5,5,12), m = new THREE.MeshBasicMaterial({ color }); resources.push(g,m);
    const mesh = new THREE.Mesh(g,m); mesh.position.set(x,groundAt(x,z)+2.5,z); scene.add(mesh);
  };
  marker(snapshot.mission.shuttle.x,snapshot.mission.shuttle.z,'#aaddff');
  snapshot.mission.tasks.forEach(t => marker(t.position.x,t.position.z,'#ffd65a'));
  // Render the approved hard demo border, with terrain continuing beyond it.
  const pb = snapshot.region.playableBounds;
  const border = [[pb.minX,pb.minZ],[pb.maxX,pb.minZ],[pb.maxX,pb.maxZ],[pb.minX,pb.maxZ],[pb.minX,pb.minZ]];
  const points: THREE.Vector3[] = [];
  for (let edge=0; edge<4; edge++) for (let i=0;i<128;i++) { const t=i/128,x=border[edge][0]*(1-t)+border[edge+1][0]*t,z=border[edge][1]*(1-t)+border[edge+1][1]*t; points.push(new THREE.Vector3(x,groundAt(x,z)+0.5,z)); }
  points.push(points[0].clone());
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points), lineMat = new THREE.LineBasicMaterial({color:'#ffb84d'}); resources.push(lineGeo,lineMat); scene.add(new THREE.Line(lineGeo,lineMat));
  let route: RoutePath | null = null, routeKey = '';
  disposers.push(() => route?.dispose());
  const updateRoute = () => {
    const next = engine.getSnapshot().mission.route, key = JSON.stringify(next);
    if (key === routeKey) return;
    route?.group.removeFromParent(); route?.dispose(); route = null; routeKey = key;
    if (next.points.length >= 2) { route = createRoutePath(next.points.map(p => ({...p})),groundAt); scene.add(route.group); }
  };
  updateRoute();
  const home = snapshot.player.position;
  camera.position.set(home.x,groundAt(home.x,home.z)+DEMO_MOVEMENT.eyeHeightMetres,home.z);
  if (core) camera.lookAt(core.position.x,groundAt(core.position.x,core.position.z)+1,core.position.z);
  const input = createDemoInput(camera,renderer.domElement,engine); disposers.push(() => input.dispose());
  const unsubscribe = engine.onEvent(event => {
    if (event.type === 'reset' && core) { sample?.group.removeFromParent(); sample?.dispose(); sample = createSampleSite(new THREE.Vector3(core.position.x,groundAt(core.position.x,core.position.z),core.position.z)); scene.add(sample.group); }
    else if (event.type === 'task-started' && event.taskId === 'take-core') sample?.start();
  });
  disposers.push(unsubscribe);
  const resize = () => { renderer.setSize(host.clientWidth,host.clientHeight); camera.aspect=host.clientWidth/host.clientHeight; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); disposers.push(() => observer.disconnect()); observer.observe(host); resize();
  let frame = 0, previousSimTime = engine.getSnapshot().simTimeSeconds, disposed = false;
  disposers.push(() => { disposed=true; cancelAnimationFrame(frame); });
  const render = () => {
    if (disposed) return;
    const s = engine.getSnapshot(), p=s.player.position;
    camera.position.set(p.x,groundAt(p.x,p.z)+DEMO_MOVEMENT.eyeHeightMetres,p.z);
    updateRoute(); sky.update(camera,s.simTimeSeconds); route?.setProgress(p.x,p.z); route?.update(s.simTimeSeconds);
    sample?.update(s.paused ? 0 : Math.min(Math.max(0,s.simTimeSeconds-previousSimTime),0.25),s.simTimeSeconds,camera);
    previousSimTime=s.simTimeSeconds; renderer.render(scene,camera); host.dataset.sceneReady='true'; frame=requestAnimationFrame(render);
  };
  frame=requestAnimationFrame(render);
  return { input, dispose };
  } catch (error) { dispose(); throw error; }
}
