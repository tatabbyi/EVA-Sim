/**
 * TEST-ONLY parameters for mathematical regression.
 * Not an actual NASA suit, Mars 2020 climate record, or certified human thermal model.
 * In production every parameter MUST be replaced by a versioned and sourced configuration.
 */
export const fixtureParameters = Object.freeze({
  humanMassKg:80, // previous Sharkies engineering scenario, not a NASA astronaut measurement
  coreHeatCapacityJPerK:252000, // assumed 72kg * 3500 J/(kg K)
  skinHeatCapacityJPerK:28000, // assumed 8kg * 3500 J/(kg K)
  suitGasHeatCapacityJPerK:550, // assumed effective mixing volume and gas amount
  outerShellHeatCapacityJPerK:13000, // assumed material mass * effective specific heat
  coreSkinConductanceWPerK:65, // assumed effective tissue+perfusion coupling
  skinGasConductanceWPerK:7, // assumed gas and clothing coupling
  gasShellConductanceWPerK:2, // assumed multilayer insulation / interface
  skinCoolantConductanceWPerK:17, // assumed LCVG coupling
  coolingCapacityW:400, // assumed hypothetical PLSS working capacity; NOT xEMU rating
  coolantInletTemperatureK:294.15, // assumed 21 C inlet; NOT xEMU measured setting
  outerRadiativeAreaM2:2.6, // assumed effective shell area
  outerThermalEmissivity:0.7, // assumed effective longwave emissivity
  outerSolarAbsorptivity:0.35, // assumed solar spectral absorptivity
  solarProjectedAreaM2:0.75, // assumed projected area, pose-dependent in reality
  outerMarsConvectionWPerK:2, // assumed effective wind/CO2 transport, UNCALIBRATED
});
export const fixtureBoundary = Object.freeze({
  metabolicPowerW:293, // NASA BVAD reference metabolic workload, NOT measured for the suit
  exportedMechanicalPowerW:0, // STATIONARY fixture only; walking would require valid work term
  respiratorySensibleHeatToGasW:10, // assumed heat redistribution, not measured
  internalElectronicsHeatW:5, // assumed waste heat into gas
  incidentSolarIrradianceWPerM2:400, // hypothetical solar forcing, NOT MEDA observation
  marsAirTemperatureK:213.15, // hypothetical -60 C, NOT site/time observation
  radiativeBackgroundTemperatureK:200, // hypothetical IR background, NOT actual Mars sky
  coolingEnabled:true,
});
export const fixtureState = Object.freeze({
  coreTemperatureK:310.15, // assumed initial 37 C
  skinTemperatureK:306.15, // assumed initial 33 C
  suitGasTemperatureK:296.15, // assumed initial 23 C
  outerShellTemperatureK:260.15, // assumed initial -13 C
  humanStoredHeatJ:0,
  cumulativeNetEnergyInputJ:0,
});
