import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureParameters as p, fixtureBoundary as b, fixtureState as s } from './thermal-fixture.mjs';
import {
  celsiusToKelvin, kelvinToCelsius, STEFAN_BOLTZMANN_W_M2_K4,
  advanceThermalModel, thermalHeatFlows, modelStoredEnergyJ, internalSuitGasTemperatureC,
} from '../src/physics/thermal.ts';

const close = (actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<=tol,`Expected ${actual} ~ ${expected} (tol=${tol})`);

test('SI conversions and exact CODATA sigma',()=>{
  close(celsiusToKelvin(0),273.15);
  close(kelvinToCelsius(273.15),0);
  close(STEFAN_BOLTZMANN_W_M2_K4,5.670374419e-8,1e-20);
  assert.throws(()=>celsiusToKelvin(-300),/cannot be negative/);
});

test('zero dt leaves state and human heat unchanged',()=>{
  const out=advanceThermalModel(p,s,b,0);
  assert.deepEqual(out.state,s);
  close(out.netBoundaryEnergyJ,0);
  close(out.energyBalanceResidualJ,0);
});

test('heat-flow sign: hot core gives heat to skin; outside atmosphere cools shell',()=>{
  const f=thermalHeatFlows(p,s,b);
  assert.ok(f.coreToSkinW>0);
  assert.ok(f.skinToSuitGasW>0);
  assert.ok(f.suitGasToShellW>0);
  assert.ok(f.radiativeShellToBackgroundW>0);
  assert.ok(f.convectiveShellToMarsAirW>0);
  assert.ok(f.skinToCoolantW>0);
});

test('radiative exchange follows Stefan-Boltzmann, can reverse sign',()=>{
  const x={...p,outerThermalEmissivity:1,outerRadiativeAreaM2:1,outerMarsConvectionWPerK:0};
  const t={...s,outerShellTemperatureK:300};
  const f=thermalHeatFlows(x,t,{...b,incidentSolarIrradianceWPerM2:0,radiativeBackgroundTemperatureK:200});
  close(f.radiativeShellToBackgroundW,STEFAN_BOLTZMANN_W_M2_K4*(300**4-200**4),1e-8);
  assert.ok(thermalHeatFlows(x,t,{...b,radiativeBackgroundTemperatureK:350}).radiativeShellToBackgroundW<0);
});

test('no external flows: arbitrary internal temperature gradients conserve total energy',()=>{
  const x={...p,outerThermalEmissivity:0,outerMarsConvectionWPerK:0};
  const bc={...b,metabolicPowerW:0,respiratorySensibleHeatToGasW:0,internalElectronicsHeatW:0,incidentSolarIrradianceWPerM2:0,coolingEnabled:false};
  const out=advanceThermalModel(x,s,bc,300);
  close(modelStoredEnergyJ(x,out.state),modelStoredEnergyJ(x,s),0.00005);
  close(out.netBoundaryEnergyJ,0,1e-12);
  close(out.energyBalanceResidualJ,0,0.00005);
  assert.ok(out.state.suitGasTemperatureK!==s.suitGasTemperatureK);
});

test('metabolic heat increases energy exactly when other heat flows are disabled',()=>{
  const x={...p,coreSkinConductanceWPerK:0,skinGasConductanceWPerK:0,
    gasShellConductanceWPerK:0,skinCoolantConductanceWPerK:0,
    outerThermalEmissivity:0,outerMarsConvectionWPerK:0};
  const bc={...b,respiratorySensibleHeatToGasW:0,internalElectronicsHeatW:0,
    incidentSolarIrradianceWPerM2:0,coolingEnabled:false};
  const out=advanceThermalModel(x,s,bc,60);
  close(modelStoredEnergyJ(x,out.state)-modelStoredEnergyJ(x,s),293*60,0.00005);
  close(out.indicativeHumanHeatStorageJPerKg,293*60/80,1e-7);
  close(out.energyBalanceResidualJ,0,0.00005);
});

test('mechanical work is exported, not automatically thermalized into suit',()=>{
  const x={...p,coreSkinConductanceWPerK:0,skinGasConductanceWPerK:0,gasShellConductanceWPerK:0,
    skinCoolantConductanceWPerK:0,outerThermalEmissivity:0,outerMarsConvectionWPerK:0};
  const base={...b,respiratorySensibleHeatToGasW:0,internalElectronicsHeatW:0,incidentSolarIrradianceWPerM2:0,coolingEnabled:false};
  const a=advanceThermalModel(x,s,{...base,exportedMechanicalPowerW:0},10).state;
  const c=advanceThermalModel(x,s,{...base,exportedMechanicalPowerW:100},10).state;
  close((a.coreTemperatureK-c.coreTemperatureK)*p.coreHeatCapacityJPerK,1000,1e-6);
});

test('thermal power balance holds with sunlight, radiation, Mars gas and LCVG active',()=>{
  const out=advanceThermalModel(p,s,b,1800);
  close(out.energyBalanceResidualJ,0,0.002);
  close(out.state.cumulativeNetEnergyInputJ,out.netBoundaryEnergyJ,1e-6);
  for(const k of ['coreTemperatureK','skinTemperatureK','suitGasTemperatureK','outerShellTemperatureK'])
    assert.ok(Number.isFinite(out.state[k]) && out.state[k]>0);
  assert.equal(out.validationStatus,'physics-equations-only-unvalidated-for-human-suit');
});

test('cooling failure increases human thermal storage for same 20-min exertion',()=>{
  const nominal=advanceThermalModel(p,s,b,1200);
  const failure=advanceThermalModel(p,s,{...b,coolingEnabled:false},1200);
  assert.ok(failure.state.humanStoredHeatJ>nominal.state.humanStoredHeatJ);
  assert.ok(failure.state.skinTemperatureK>nominal.state.skinTemperatureK);
});

test('different update grouping yields approximately same temperatures and energy',()=>{
  const once=advanceThermalModel(p,s,b,60).state;
  let split={...s};
  for(let i=0;i<3600;i++) split=advanceThermalModel(p,split,b,1/60).state;
  for(const k of ['coreTemperatureK','skinTemperatureK','suitGasTemperatureK','outerShellTemperatureK'])
    close(split[k],once[k],0.02);
  close(split.humanStoredHeatJ,once.humanStoredHeatJ,250);
});

test('TEMP denotes mixed suit gas, not environment or medical body temperature',()=>{
  close(internalSuitGasTemperatureC(s),23,1e-8);
  assert.notEqual(internalSuitGasTemperatureC(s),s.coreTemperatureK-273.15);
  assert.notEqual(internalSuitGasTemperatureC(s),b.marsAirTemperatureK-273.15);
});

test('invalid data rejected: no NaN, invalid emissivity, negative K or excessive work',()=>{
  assert.throws(()=>advanceThermalModel(p,s,{...b,metabolicPowerW:NaN},1),/finite/);
  assert.throws(()=>advanceThermalModel({...p,outerThermalEmissivity:1.2},s,b,1),/within/);
  assert.throws(()=>advanceThermalModel(p,{...s,coreTemperatureK:-1},b,1),/negative/);
  assert.throws(()=>advanceThermalModel(p,s,{...b,exportedMechanicalPowerW:500},1),/cannot exceed/);
  assert.throws(()=>advanceThermalModel(p,s,b,8000),/split integration/);
});
