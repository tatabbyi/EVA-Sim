// Written with AI assistance (Codex). Pure SI-unit engineering demo, not a validated Mars suit model.
import { contains, type Bounds, type XZ } from './contracts.ts';

// NASA-REF N01: NASA/TP-2015-218570/REV1 (2018), Table 4-76, printed p143,
// https://ntrs.nasa.gov/citations/20180001338 : 293 W, 0.075 kg O2/hour (RQ 0.9).
// Linear extension away from that pair is SHARKIES-SCENARIO, NOT a NASA metabolic law.
export const NASA_EVA_REFERENCE = Object.freeze({ powerWatts: 293, oxygenGramsPerHour: 75 });
export type MarsEVAEngineeringProfile = {
  id: string; gravityMps2: number; ambientPressurePa: number; ambientTemperatureC: number; co2VolumeFraction: number;
  astronautMassKg: number; suitMassKg: number; baseWalkSpeedMps: number; baseFastSpeedMps: number;
  powerIdleW: number; powerWalkW: number; powerFastW: number; powerTaskW: number;
  oxygenCapacityGrams: number; oxygenReserveGrams: number; oxygenCriticalGrams: number;
  maxDemoSlopeDeg: number; slopeProbeMetres: number;
};
// All defaults except conventional Mars g and the NASA reference pair are SHARKIES-SCENARIO.
// N02 (20260003038) proposes a preliminary 230 lbm starting maximum for design studies;
// our fictional 65 kg suit is NOT that study's validated hardware or mass recommendation.
export const MARS_EVA_DEMO_PROFILE: Readonly<MarsEVAEngineeringProfile> = Object.freeze({
  id: 'mars-eva-engineering-demo-v1', gravityMps2: 3.711,
  ambientPressurePa: 635, ambientTemperatureC: -60, co2VolumeFraction: 0.953,
  astronautMassKg: 80, suitMassKg: 65, baseWalkSpeedMps: 0.75, baseFastSpeedMps: 1.15,
  powerIdleW: 165, powerWalkW: 293, powerFastW: 430, powerTaskW: 350,
  oxygenCapacityGrams: 750, oxygenReserveGrams: 150, oxygenCriticalGrams: 75,
  maxDemoSlopeDeg: 25, slopeProbeMetres: 1,
});
export type DemoPhysicsOptions = {
  profile: Readonly<MarsEVAEngineeringProfile>; heightAt(x: number, z: number): number | null;
  carriedMassKg: number; initialOxygenGrams?: number; emergencyTest?: boolean;
};
export type OxygenWarning = 'normal' | 'low' | 'critical' | 'depleted';
export type PhysicsTelemetry = {
  profileId: string; emergencyTest: boolean; activity: 'idle' | 'walk' | 'fast' | 'task' | 'failed';
  oxygenRateGramsPerHour: number; metabolicPowerWatts: number; energySpentJ: number;
  currentSlopeDeg: number | null; carriedMassKg: number; totalMassKg: number; weightNewtons: number;
  speedMetresPerSecond: number; oxygenWarning: OxygenWarning;
  ambientTemperatureC: number; ambientPressurePa: number; co2VolumeFraction: number; gravityMps2: number;
};
const nonnegative = (v: number, name: string) => { if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid ${name}`); };
const positive = (v: number, name: string) => { nonnegative(v,name); if (v === 0) throw new Error(`Invalid ${name}`); };
const clamp = (v: number, min: number, max: number) => Math.max(min,Math.min(max,v));
export function validatePhysicsOptions(options: DemoPhysicsOptions): void {
  const p=options.profile;
  if (!p || typeof p.id !== 'string' || !p.id.trim() || typeof options.heightAt !== 'function') throw new Error('Invalid physics profile/provider');
  for (const key of ['gravityMps2','ambientPressurePa','astronautMassKg','baseWalkSpeedMps','baseFastSpeedMps','powerIdleW','oxygenCapacityGrams','slopeProbeMetres'] as const) positive(p[key],key);
  for (const key of ['suitMassKg','powerWalkW','powerFastW','powerTaskW','oxygenReserveGrams','oxygenCriticalGrams','maxDemoSlopeDeg','co2VolumeFraction'] as const) nonnegative(p[key],key);
  nonnegative(options.carriedMassKg,'carried mass');
  if (!Number.isFinite(p.ambientTemperatureC) || p.ambientTemperatureC < -273.15 || p.co2VolumeFraction > 1 || p.maxDemoSlopeDeg >= 90 || p.oxygenCriticalGrams > p.oxygenReserveGrams || p.oxygenReserveGrams > p.oxygenCapacityGrams || p.baseFastSpeedMps < p.baseWalkSpeedMps || [p.powerWalkW,p.powerFastW,p.powerTaskW].some(w => w < p.powerIdleW)) throw new Error('Invalid physics profile limits');
  const initial=options.initialOxygenGrams ?? p.oxygenCapacityGrams;
  nonnegative(initial,'initial oxygen');
  if (initial > p.oxygenCapacityGrams || (initial !== p.oxygenCapacityGrams && options.emergencyTest !== true)) throw new Error('Reduced initial oxygen requires explicit emergencyTest');
  // Reject overflowing derived mass/work even when each supplied scalar is finite.
  const mass=massAndWeight(p,options.carriedMassKg);
  positive(mass.weightNewtons,'derived weight');
  for (const mode of ['walk','fast','task'] as const) positive(activityResponse(p,mode,Math.tan(p.maxDemoSlopeDeg*Math.PI/180),options.carriedMassKg).metabolicPowerWatts,'derived workload');
}
export function gramsPerHour(metabolicPowerWatts: number): number {
  nonnegative(metabolicPowerWatts,'metabolic power');
  return metabolicPowerWatts * (NASA_EVA_REFERENCE.oxygenGramsPerHour/NASA_EVA_REFERENCE.powerWatts);
}
export function massAndWeight(p: Readonly<MarsEVAEngineeringProfile>, carriedMassKg: number) {
  nonnegative(carriedMassKg,'carried mass');
  const totalMassKg=p.astronautMassKg+p.suitMassKg+carriedMassKg;
  return { totalMassKg, weightNewtons: totalMassKg*p.gravityMps2 };
}
export function activityResponse(p: Readonly<MarsEVAEngineeringProfile>, activity: 'idle'|'walk'|'fast'|'task', signedGrade: number, carriedMassKg: number) {
  nonnegative(carriedMassKg,'carried mass');
  if (!Number.isFinite(signedGrade)) throw new Error('Invalid signed grade');
  const slopeDeg=Math.atan(signedGrade)*180/Math.PI;
  const payloadFactor=1+0.5*carriedMassKg/(p.astronautMassKg+p.suitMassKg);
  const slopeWorkFactor=clamp(1+3*signedGrade+6*signedGrade*signedGrade,0.7,2.5);
  const moving=activity === 'walk' || activity === 'fast';
  const base=activity === 'fast' ? p.powerFastW : p.powerWalkW;
  const metabolicPowerWatts=activity === 'idle' ? p.powerIdleW : activity === 'task' ? p.powerTaskW : p.powerIdleW+Math.max(0,base-p.powerIdleW)*payloadFactor*slopeWorkFactor;
  const speedFactor=clamp(1-0.018*Math.max(0,slopeDeg)-0.005*Math.max(0,-slopeDeg),0.35,1);
  return { metabolicPowerWatts, speedMetresPerSecond: moving ? (activity === 'fast' ? p.baseFastSpeedMps : p.baseWalkSpeedMps)*speedFactor/payloadFactor : 0, slopeDeg };
}
// Symmetric probes span the TOTAL configured length (front/back are +/- half).
// A 1 m probe on the shipped 4 m DEM is bilinear interpolation, not 1 m observed detail.
export function directionalGrade(heightAt: DemoPhysicsOptions['heightAt'], position: XZ, direction: XZ, probeMetres: number): number | null {
  positive(probeMetres,'slope probe');
  if (![position.x,position.z,direction.x,direction.z].every(Number.isFinite)) throw new Error('Invalid slope coordinates');
  const length=Math.hypot(direction.x,direction.z);
  if (!length) return null;
  const dx=direction.x/length*probeMetres/2, dz=direction.z/length*probeMetres/2;
  const front=heightAt(position.x+dx,position.z+dz), back=heightAt(position.x-dx,position.z-dz);
  if (front === null || back === null || !Number.isFinite(front) || !Number.isFinite(back)) return null;
  const grade=(front-back)/probeMetres;
  return Number.isFinite(grade) ? grade : null;
}
export function oxygenWarning(grams: number, p: Readonly<MarsEVAEngineeringProfile>): OxygenWarning {
  nonnegative(grams,'oxygen');
  return grams === 0 ? 'depleted' : grams <= p.oxygenCriticalGrams ? 'critical' : grams <= p.oxygenReserveGrams ? 'low' : 'normal';
}
// Split the terminal tick at exact exhaustion. No energy, time or movement AFTER zero gas.
export function integrateLifeSupport(oxygenGrams: number, metabolicPowerWatts: number, seconds: number) {
  nonnegative(oxygenGrams,'oxygen'); nonnegative(seconds,'time');
  const oxygenRateGramsPerHour=gramsPerHour(metabolicPowerWatts), rate=oxygenRateGramsPerHour/3600;
  const depleted=oxygenGrams === 0 || (rate > 0 && seconds >= oxygenGrams/rate);
  const elapsedSeconds=oxygenGrams === 0 ? 0 : depleted && rate > 0 ? Math.min(seconds,oxygenGrams/rate) : seconds;
  return { oxygenGrams: depleted ? 0 : Math.max(0,oxygenGrams-rate*elapsedSeconds), energyJ: metabolicPowerWatts*elapsedSeconds, elapsedSeconds, depleted, oxygenRateGramsPerHour };
}
export function physicsMotion(options: DemoPhysicsOptions, position: XZ, direction: XZ, run: boolean, taskActive: boolean, seconds: number, bounds: Bounds, canOccupy: (p:XZ)=>boolean) {
  const p=options.profile;
  let activity: 'idle'|'walk'|'fast'|'task'=taskActive ? 'task' : 'idle';
  let grade: number | null=0, boundaryBlocked=false;
  if (!taskActive && Math.hypot(direction.x,direction.z) > 0) {
    grade=directionalGrade(options.heightAt,position,direction,p.slopeProbeMetres);
    if (grade !== null && Math.abs(Math.atan(grade)*180/Math.PI) <= p.maxDemoSlopeDeg+1e-10) activity=run ? 'fast' : 'walk';
  }
  let response=activityResponse(p,activity,grade ?? 0,options.carriedMassKg);
  let next={x:position.x+direction.x*response.speedMetresPerSecond*seconds,z:position.z+direction.z*response.speedMetresPerSecond*seconds};
  if (response.speedMetresPerSecond > 0) {
    boundaryBlocked=!contains(bounds,next);
    const height=options.heightAt(next.x,next.z);
    // Also check midpoint: step <= 0.25s and speed <= 1.15 m/s in the approved profile.
    const middle=options.heightAt((position.x+next.x)/2,(position.z+next.z)/2);
    if (boundaryBlocked || height === null || middle === null || !Number.isFinite(height) || !Number.isFinite(middle) || !canOccupy(next)) {
      activity='idle'; response=activityResponse(p,'idle',0,options.carriedMassKg); next=position;
    }
  }
  return { activity, ...response, currentSlopeDeg: grade === null ? null : Math.atan(grade)*180/Math.PI, position: next, boundaryBlocked };
}
