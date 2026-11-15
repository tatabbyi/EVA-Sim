/**
 * Sharkies thermal physics: four thermal-capacitance control volumes.
 * Pure SI-unit energy accounting, no renderer, I/O, clocks, or probabilities.
 *
 * SCIENCE STATUS: governing heat/energy equations are well established;
 * coefficient values must be obtained from an identified Mars EVA suit design,
 * human thermal-model calibration, and time/site-specific environmental data.
 * This is NOT the NASA 41-Node Man or Wissler physiological model.
 *
 * Sources and limitations: docs/physics/THERMAL-SOURCES.md.
 */

/** Exact 2022 CODATA derived constant; NIST https://physics.nist.gov/cgi-bin/cuu/Value?sigma */
export const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374419e-8;
export const CELSIUS_ZERO_K = 273.15;
export type ThermalNode = 'core' | 'skin' | 'suitGas' | 'outerShell';

/** Effective physical properties; every number MUST have a provenance record. */
export interface ThermalParameters {
  /** Total mass of the reference astronaut; not including the suit [kg]. */
  humanMassKg: number;
  /** Node heat capacities [J/K]. Core/skin capacities should come from a human physiological model. */
  coreHeatCapacityJPerK: number;
  skinHeatCapacityJPerK: number;
  suitGasHeatCapacityJPerK: number;
  outerShellHeatCapacityJPerK: number;
  /** Effective thermal conductances [W/K]. Calibrate vs tests/suit configuration. */
  coreSkinConductanceWPerK: number;
  skinGasConductanceWPerK: number;
  gasShellConductanceWPerK: number;
  skinCoolantConductanceWPerK: number;
  /** Primary cooling capacity at this operating point [W], NOT electrical draw. */
  coolingCapacityW: number;
  /** Inlet temperature of circulating LCVG coolant [K]. */
  coolantInletTemperatureK: number;
  /** Total radiating effective shell surface [m2], NOT projected solar area. */
  outerRadiativeAreaM2: number;
  /** Longwave thermal emissivity [0..1]. */
  outerThermalEmissivity: number;
  /** Absorptivity in the solar spectrum [0..1]. */
  outerSolarAbsorptivity: number;
  /** Effective projected solar interception area [m2]. */
  solarProjectedAreaM2: number;
  /** Effective thin-CO2-atmosphere convective conductance [W/K]. Cannot assume 0 on Mars. */
  outerMarsConvectionWPerK: number;
}

/** All required conditions are explicit; there is no invented global '-60C' or solar flux default. */
export interface ThermalBoundaryConditions {
  /** Existing core metabolic model [W]. */
  metabolicPowerW: number;
  /** Mechanical power genuinely exported out of the thermal human/suit control volumes [W]. */
  exportedMechanicalPowerW: number;
  /** Sensible respiratory heat moved from core into circulating suit gas [W]. */
  respiratorySensibleHeatToGasW: number;
  /** Auxiliary equipment dissipation *inside* the suit-gas thermal volume [W]. */
  internalElectronicsHeatW: number;
  /** Solar shortwave irradiance at surface [W/m2], with geometric incidence in projected area. */
  incidentSolarIrradianceWPerM2: number;
  /** Mars near-surface atmosphere temperature [K], site- and time-indexed. */
  marsAirTemperatureK: number;
  /** Effective IR radiative environmental temperature [K], NOT necessarily air temperature. */
  radiativeBackgroundTemperatureK: number;
  /** Cooling command. Emergency fan/pump failures will turn this false. */
  coolingEnabled: boolean;
}

export interface ThermalState {
  coreTemperatureK: number;
  skinTemperatureK: number;
  suitGasTemperatureK: number;
  outerShellTemperatureK: number;
  /** Change of internal energy in the two body nodes since simulation initial state [J]. */
  humanStoredHeatJ: number;
  /** Cumulative net energy crossing outer/control-volume boundaries [J] for conservation QA. */
  cumulativeNetEnergyInputJ: number;
}

/** Signed heat flows; positive means the direction named in the property. */
export interface ThermalHeatFlows {
  metabolicToCoreW: number;
  mechanicalExportW: number;
  respirationCoreToGasW: number;
  coreToSkinW: number;
  skinToSuitGasW: number;
  suitGasToShellW: number;
  skinToCoolantW: number;
  electronicsToGasW: number;
  absorbedSolarToShellW: number;
  radiativeShellToBackgroundW: number;
  convectiveShellToMarsAirW: number;
}
export interface ThermalStepResult {
  state: ThermalState;
  /** Fluxes at final integration substep, not a time-averaged measurement. */
  finalHeatFlows: ThermalHeatFlows;
  /** Integrated net boundary energy [J] during this step. */
  netBoundaryEnergyJ: number;
  /** Numerical residual: sum(C_i * deltaT_i) minus integrated boundary exchange [J]. */
  energyBalanceResidualJ: number;
  /** Simplified heat storage metric [J/kg]; NOT equivalent to the NASA 41-Node/Wissler limit test. */
  indicativeHumanHeatStorageJPerKg: number;
  /** Downstream software must never call this model NASA physiological validation. */
  validationStatus: 'physics-equations-only-unvalidated-for-human-suit';
}

const finite = (n: number, label: string) => {
  if (!Number.isFinite(n)) throw new Error(`Thermal: ${label} must be finite`);
  return n;
};
const nonnegative = (n: number, label: string) => {
  finite(n, label);
  if (n < 0) throw new Error(`Thermal: ${label} cannot be negative`);
  return n;
};
const positive = (n: number, label: string) => {
  nonnegative(n, label);
  if (n === 0) throw new Error(`Thermal: ${label} must be positive`);
  return n;
};
const kelvin = (n: number, label: string) => nonnegative(n, label);

export const celsiusToKelvin = (celsius: number) => {
  finite(celsius, 'celsius');
  return kelvin(celsius + CELSIUS_ZERO_K, 'absolute temperature');
};
export const kelvinToCelsius = (temperatureK: number) => kelvin(temperatureK, 'temperature') - CELSIUS_ZERO_K;

export function validateThermalParameters(p: Readonly<ThermalParameters>): void {
  for (const k of [
    'humanMassKg', 'coreHeatCapacityJPerK', 'skinHeatCapacityJPerK',
    'suitGasHeatCapacityJPerK', 'outerShellHeatCapacityJPerK',
  ] as const) positive(p[k], k);
  for (const k of [
    'coreSkinConductanceWPerK', 'skinGasConductanceWPerK', 'gasShellConductanceWPerK',
    'skinCoolantConductanceWPerK', 'coolingCapacityW', 'outerRadiativeAreaM2',
    'solarProjectedAreaM2', 'outerMarsConvectionWPerK',
  ] as const) nonnegative(p[k], k);
  kelvin(p.coolantInletTemperatureK, 'coolant temperature');
  for (const k of ['outerThermalEmissivity', 'outerSolarAbsorptivity'] as const) {
    nonnegative(p[k], k);
    if (p[k] > 1) throw new Error(`Thermal: ${k} must be within [0,1]`);
  }
}

export function validateThermalState(s: Readonly<ThermalState>): void {
  for (const k of [
    'coreTemperatureK', 'skinTemperatureK', 'suitGasTemperatureK', 'outerShellTemperatureK',
  ] as const) kelvin(s[k], k);
  finite(s.humanStoredHeatJ, 'humanStoredHeatJ');
  finite(s.cumulativeNetEnergyInputJ, 'cumulativeNetEnergyInputJ');
}
export function validateThermalBoundary(b: Readonly<ThermalBoundaryConditions>): void {
  for (const k of [
    'metabolicPowerW', 'exportedMechanicalPowerW', 'respiratorySensibleHeatToGasW',
    'internalElectronicsHeatW', 'incidentSolarIrradianceWPerM2',
  ] as const) nonnegative(b[k], k);
  kelvin(b.marsAirTemperatureK, 'marsAirTemperatureK');
  kelvin(b.radiativeBackgroundTemperatureK, 'radiativeBackgroundTemperatureK');
  if (typeof b.coolingEnabled !== 'boolean') throw new Error('Thermal: coolingEnabled must be boolean');
  if (b.exportedMechanicalPowerW > b.metabolicPowerW)
    throw new Error('Thermal: external work cannot exceed metabolic input');
}

/** Energy of these four capacities, relative to a 0 K datum. Only differences are physical. */
export function modelStoredEnergyJ(p: Readonly<ThermalParameters>, s: Readonly<ThermalState>): number {
  return p.coreHeatCapacityJPerK * s.coreTemperatureK
    + p.skinHeatCapacityJPerK * s.skinTemperatureK
    + p.suitGasHeatCapacityJPerK * s.suitGasTemperatureK
    + p.outerShellHeatCapacityJPerK * s.outerShellTemperatureK;
}

export function thermalHeatFlows(
  p: Readonly<ThermalParameters>, s: Readonly<ThermalState>, b: Readonly<ThermalBoundaryConditions>,
): ThermalHeatFlows {
  const solar = p.outerSolarAbsorptivity * p.solarProjectedAreaM2 * b.incidentSolarIrradianceWPerM2;
  const radiative = p.outerThermalEmissivity * p.outerRadiativeAreaM2 * STEFAN_BOLTZMANN_W_M2_K4
    * (s.outerShellTemperatureK ** 4 - b.radiativeBackgroundTemperatureK ** 4);
  return {
    metabolicToCoreW: b.metabolicPowerW,
    mechanicalExportW: b.exportedMechanicalPowerW,
    respirationCoreToGasW: b.respiratorySensibleHeatToGasW,
    coreToSkinW: p.coreSkinConductanceWPerK * (s.coreTemperatureK - s.skinTemperatureK),
    skinToSuitGasW: p.skinGasConductanceWPerK * (s.skinTemperatureK - s.suitGasTemperatureK),
    suitGasToShellW: p.gasShellConductanceWPerK * (s.suitGasTemperatureK - s.outerShellTemperatureK),
    skinToCoolantW: b.coolingEnabled
      ? Math.min(p.coolingCapacityW, Math.max(0, p.skinCoolantConductanceWPerK * (s.skinTemperatureK - p.coolantInletTemperatureK))) : 0,
    electronicsToGasW: b.internalElectronicsHeatW,
    absorbedSolarToShellW: solar,
    radiativeShellToBackgroundW: radiative,
    convectiveShellToMarsAirW: p.outerMarsConvectionWPerK * (s.outerShellTemperatureK - b.marsAirTemperatureK),
  };
}

/**
 * Integrate energy-conserving pairwise flows with explicit Euler substeps.
 * Adaptive substep bound uses a dimensionless 0.05 thermal-time-constant stability factor;
 * this is a NUMERICAL criterion, not a claim about physical heat transfer.
 */
export function advanceThermalModel(
  p: Readonly<ThermalParameters>, initialState: Readonly<ThermalState>,
  b: Readonly<ThermalBoundaryConditions>, dtSeconds: number,
): ThermalStepResult {
  validateThermalParameters(p);
  validateThermalState(initialState);
  validateThermalBoundary(b);
  nonnegative(dtSeconds, 'dtSeconds');
  if (dtSeconds > 7200) throw new Error('Thermal: split integration at <=7200 simulated seconds');
  let s: ThermalState = { ...initialState };
  const initialEnergy = modelStoredEnergyJ(p, s);
  let externalNetJ = 0;
  const conductance = [
    p.coreSkinConductanceWPerK,
    p.coreSkinConductanceWPerK + p.skinGasConductanceWPerK + p.skinCoolantConductanceWPerK,
    p.skinGasConductanceWPerK + p.gasShellConductanceWPerK,
    p.gasShellConductanceWPerK + p.outerMarsConvectionWPerK
      + 4 * p.outerThermalEmissivity * p.outerRadiativeAreaM2 * STEFAN_BOLTZMANN_W_M2_K4
        * Math.max(s.outerShellTemperatureK, b.radiativeBackgroundTemperatureK) ** 3,
  ];
  const capacities = [p.coreHeatCapacityJPerK, p.skinHeatCapacityJPerK,
    p.suitGasHeatCapacityJPerK, p.outerShellHeatCapacityJPerK];
  // At most a twentieth of a node's rough thermal time constant.
  const limitingTimeSeconds = Math.min(...conductance.map((g,i) => g > 0 ? 0.05 * capacities[i] / g : Infinity));
  const maxStepSeconds = Math.min(0.2, limitingTimeSeconds);
  const n = dtSeconds === 0 ? 0 : Math.ceil(dtSeconds / maxStepSeconds);
  if (n > 100000 || !Number.isFinite(n)) throw new Error('Thermal: numerical step count too high');
  const h = n > 0 ? dtSeconds / n : 0;
  let flows = thermalHeatFlows(p, s, b);
  for (let i=0; i<n; i++) {
    flows = thermalHeatFlows(p,s,b);
    const coreW = flows.metabolicToCoreW - flows.mechanicalExportW - flows.respirationCoreToGasW - flows.coreToSkinW;
    const skinW = flows.coreToSkinW - flows.skinToSuitGasW - flows.skinToCoolantW;
    const gasW = flows.respirationCoreToGasW + flows.skinToSuitGasW - flows.suitGasToShellW + flows.electronicsToGasW;
    const shellW = flows.suitGasToShellW + flows.absorbedSolarToShellW
      - flows.radiativeShellToBackgroundW - flows.convectiveShellToMarsAirW;
    const humanDeltaJ = (coreW + skinW) * h;
    const netBoundaryW = flows.metabolicToCoreW - flows.mechanicalExportW + flows.electronicsToGasW
      + flows.absorbedSolarToShellW - flows.skinToCoolantW
      - flows.radiativeShellToBackgroundW - flows.convectiveShellToMarsAirW;
    externalNetJ += netBoundaryW * h;
    s = {
      coreTemperatureK: s.coreTemperatureK + coreW * h / p.coreHeatCapacityJPerK,
      skinTemperatureK: s.skinTemperatureK + skinW * h / p.skinHeatCapacityJPerK,
      suitGasTemperatureK: s.suitGasTemperatureK + gasW * h / p.suitGasHeatCapacityJPerK,
      outerShellTemperatureK: s.outerShellTemperatureK + shellW * h / p.outerShellHeatCapacityJPerK,
      humanStoredHeatJ: s.humanStoredHeatJ + humanDeltaJ,
      cumulativeNetEnergyInputJ: s.cumulativeNetEnergyInputJ + netBoundaryW * h,
    };
    validateThermalState(s);
  }
  flows = thermalHeatFlows(p, s, b);
  return {
    state:s,
    finalHeatFlows:flows,
    netBoundaryEnergyJ:externalNetJ,
    energyBalanceResidualJ:(modelStoredEnergyJ(p, s)-initialEnergy)-externalNetJ,
    indicativeHumanHeatStorageJPerKg:s.humanStoredHeatJ/p.humanMassKg,
    validationStatus:'physics-equations-only-unvalidated-for-human-suit',
  };
}

/** For HUD: the TEMP sensor is the estimated mixed *internal suit gas* temperature. */
export function internalSuitGasTemperatureC(state: Readonly<ThermalState>): number {
  return kelvinToCelsius(state.suitGasTemperatureK);
}
