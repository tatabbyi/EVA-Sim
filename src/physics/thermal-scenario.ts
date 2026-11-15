// ENGINEERING MODEL / NOT NASA-VALIDATED. Every scenario value is registered in
// docs/physics/THERMAL-INTEGRATION-REPORT.md; this is not a measured suit configuration.
import {advanceThermalModel,modelStoredEnergyJ,type ThermalParameters,type ThermalState,type ThermalBoundaryConditions} from './thermal.ts';

export type ThermalScenario = {
  id:string; parameters:Readonly<ThermalParameters>; initialState:Readonly<ThermalState>;
  boundaries:Readonly<Omit<ThermalBoundaryConditions,'metabolicPowerW'|'respiratorySensibleHeatToGasW'>>;
  respiratorySensibleFraction:number;
};
export type ThermalTelemetry = ThermalState & {
  scenarioId:string; validationStatus:'engineering-unvalidated';
  coolingEnabled:boolean; coolingHeatW:number; lastMetabolicPowerW:number;
  energyBalanceResidualJ:number; lastStepEnergyBalanceResidualJ:number;
};

export const THERMAL_ENGINEERING_SCENARIO: Readonly<ThermalScenario> = Object.freeze({
  id:'mars-suit-thermal-engineering-unvalidated-v1',
  parameters:Object.freeze({
    humanMassKg:80,coreHeatCapacityJPerK:80*0.9*3500,skinHeatCapacityJPerK:80*0.1*3500,
    suitGasHeatCapacityJPerK:500,outerShellHeatCapacityJPerK:12000,
    coreSkinConductanceWPerK:60,skinGasConductanceWPerK:7,gasShellConductanceWPerK:2,
    skinCoolantConductanceWPerK:12,coolingCapacityW:350,coolantInletTemperatureK:294.15,
    outerRadiativeAreaM2:2.6,outerThermalEmissivity:0.7,outerSolarAbsorptivity:0.3,
    solarProjectedAreaM2:0.7,outerMarsConvectionWPerK:1,
  }),
  initialState:Object.freeze({coreTemperatureK:310.15,skinTemperatureK:306.15,
    suitGasTemperatureK:296.15,outerShellTemperatureK:260.15,
    humanStoredHeatJ:0,cumulativeNetEnergyInputJ:0}),
  boundaries:Object.freeze({
    // Zero useful exported work is a disclosed upper heat-retention assumption,
    // not measured walking mechanics. Respiration below redistributes existing heat.
    exportedMechanicalPowerW:0,internalElectronicsHeatW:5,
    incidentSolarIrradianceWPerM2:400,marsAirTemperatureK:213.15,
    radiativeBackgroundTemperatureK:200,coolingEnabled:true,
  }),
  respiratorySensibleFraction:0.03,
});

export function advanceScenarioThermal(scenario:Readonly<ThermalScenario>,state:Readonly<ThermalState>,metabolicPowerW:number,seconds:number):ThermalTelemetry {
  if(!scenario.id?.trim()||!Number.isFinite(scenario.respiratorySensibleFraction)||scenario.respiratorySensibleFraction<0||scenario.respiratorySensibleFraction>1)throw Error('Invalid thermal scenario');
  const result=advanceThermalModel(scenario.parameters,state,{
    ...scenario.boundaries,metabolicPowerW,
    respiratorySensibleHeatToGasW:metabolicPowerW*scenario.respiratorySensibleFraction,
  },seconds);
  return {...result.state,scenarioId:scenario.id,validationStatus:'engineering-unvalidated',
    coolingEnabled:scenario.boundaries.coolingEnabled,coolingHeatW:result.finalHeatFlows.skinToCoolantW,
    lastMetabolicPowerW:metabolicPowerW,lastStepEnergyBalanceResidualJ:result.energyBalanceResidualJ,
    energyBalanceResidualJ:modelStoredEnergyJ(scenario.parameters,result.state)-modelStoredEnergyJ(scenario.parameters,scenario.initialState)
      -(result.state.cumulativeNetEnergyInputJ-scenario.initialState.cumulativeNetEnergyInputJ),
  };
}
