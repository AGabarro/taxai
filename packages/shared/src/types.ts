export interface TaxInput {
  fiscalYear: number;           // e.g. 2024
  region: SpanishRegion;        // see type below
  age: number;                  // affects mínimo personal
  grossSalary: number;          // euros, rendimientos del trabajo
  otherIncome?: number;         // rendimientos del capital, etc.
  retenciones: number;          // withholdings already paid
  dependentsUnder25: number;    // children under 25 in household
  dependentsOver65: number;     // elderly dependents
  civilStatus: CivilStatus;
  disability?: DisabilityGrade; // 33% or 65%+
}

export type SpanishRegion =
  | 'andalusia'
  | 'aragon'
  | 'asturias'
  | 'balearics'
  | 'canarias'
  | 'cantabria'
  | 'castilla-la-mancha'
  | 'castilla-leon'
  | 'catalonia'
  | 'extremadura'
  | 'galicia'
  | 'la-rioja'
  | 'madrid'
  | 'murcia'
  | 'navarra'
  | 'pais-vasco'
  | 'valenciana';

export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated';

export type DisabilityGrade = 33 | 65;

export interface TaxResult {
  fiscalYear: number;
  region: SpanishRegion;
  grossSalary: number;

  // Reductions applied
  rendimientoNetoReducido: number;   // after trabajo reductions
  baseImponibleGeneral: number;
  minimumPersonalFamiliar: number;

  // Split between state and regional
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaIntegraTOTAL: number;

  // Applied to minimum
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  cuotaLiquidaTOTAL: number;

  // Final result
  retenciones: number;
  resultAmount: number;       // positive = to pay (a ingresar), negative = refund (a devolver)
  resultType: 'a_ingresar' | 'a_devolver' | 'cero';

  // Waterfall data for the chart (ordered)
  waterfallSteps: WaterfallStep[];
}

export interface WaterfallStep {
  label: string;         // human-readable, in Spanish
  amount: number;        // positive = adds to tax, negative = reduces
  runningTotal: number;
  bracketRate?: number;  // if this step is a bracket application
}
