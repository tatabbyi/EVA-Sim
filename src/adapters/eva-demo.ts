// Alex-owned integration: scenario planning in SI units, using the live physics model.
import { CatmullRomCurve3, Vector3 } from 'three';
import { contains, TASK_IDS, type Bounds, type Mission, type Region, type Task, type XZ } from '../core/contracts.ts';
import { activityResponse, directionalGrade, gramsPerHour, MARS_EVA_DEMO_PROFILE as profile } from '../core/physics.ts';
export const DEMO_SITES: readonly XZ[] = [{x:-8,z:-5},{x:8,z:-7},{x:-12,z:-17},{x:12,z:-20}];
export const RESERVE_MINUTES = 30; // Explicit planning assumption, not NASA certification.
export function evaMission(region: Region, shuttle: XZ, tasks: Task[]): Mission {
  if (tasks.length !== 2 || new Set(tasks.map(t=>t.id)).size !== 2 || tasks.some(t=>!TASK_IDS.some(id=>id===t.type)||!contains(region.playableBounds,t.position))) throw Error('Select exactly two valid official objectives');
  return {regionId:region.id,shuttle:{...shuttle},tasks,route:{source:'demo',points:[shuttle,...tasks.map(t=>t.position),shuttle]}};
}
export function estimateEVA(points: readonly XZ[], heightAt:(x:number,z:number)=>number|null, bounds:Bounds, taskMinutes:number) {
  if(points.length<2||!Number.isFinite(taskMinutes)||taskMinutes<0)throw Error('Invalid plan');
  const curve=new CatmullRomCurve3(points.map(p=>new Vector3(p.x,0,p.z)),false,'centripetal');
  const length=curve.getLength();
  if(!Number.isFinite(length)||length<=0||length>10000)throw Error('Unsupported route length');
  const samples=curve.getSpacedPoints(Math.max(2,Math.ceil(length/0.5)));
  let seconds=0,metres=0,walkGrams=0;
  for(let i=1;i<samples.length;i++) {
    const a=samples[i-1],b=samples[i],distance=Math.hypot(b.x-a.x,b.z-a.z);
    if(!contains(bounds,a)||!contains(bounds,b)||heightAt(b.x,b.z)===null)throw Error('Route outside supported terrain');
    const grade=directionalGrade(heightAt,{x:(a.x+b.x)/2,z:(a.z+b.z)/2},{x:b.x-a.x,z:b.z-a.z},profile.slopeProbeMetres);
    if(grade===null||Math.abs(Math.atan(grade)*180/Math.PI)>profile.maxDemoSlopeDeg)throw Error('Route crosses unavailable or unsafe slope');
    const response=activityResponse(profile,'walk',grade,0),duration=distance/response.speedMetresPerSecond;
    seconds+=duration;metres+=distance;walkGrams+=gramsPerHour(response.metabolicPowerWatts)*duration/3600;
  }
  const taskGrams=gramsPerHour(profile.powerTaskW)*taskMinutes/60;
  const reserveGrams=gramsPerHour(profile.powerIdleW)*RESERVE_MINUTES/60;
  return {walkGrams,taskGrams,reserveGrams,tankGrams:profile.oxygenCapacityGrams,minutes:seconds/60+taskMinutes,evaMinutes:45,metres};
}
