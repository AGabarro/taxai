export interface TaxInput {
  fiscalYear: number;           // e.g. 2024
  region: SpanishRegion;        // see type below
  age: number;                  // affects mínimo personal
  grossSalary: number;          // euros, rendimientos del trabajo
  otherIncome?: number;         // rendimientos del capital, etc.
  retenciones: number;          // withholdings already paid
  dependentsUnder25: number;    // children under 25 in household
  dependentsUnder3?: number;    // subset of above who are under 3 (for supplement)
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

// --- Nómina parsing types ---

/** Financial data extracted from a Spanish payslip (nómina) PDF. */
export interface NominaData {
  /** Pay period label, e.g. "enero 2025" or "12/2024" */
  period?: string;
  /** Fiscal year inferred from the period */
  fiscalYear?: number;
  /** Total devengado (gross earnings) for this pay period, in euros */
  monthlyGross?: number;
  /** Annual gross stated explicitly in the nómina (some show acumulado), in euros */
  annualGross?: number;
  /** IRPF withholding amount deducted this pay period, in euros */
  monthlyRetenciones?: number;
  /** IRPF withheld year-to-date / annual (if stated in nómina), in euros */
  annualRetenciones?: number;
  /** IRPF retention rate applied, as a percentage (e.g. 15.5 means 15.5%) */
  retentionPercentage?: number;
  /** Employee Social Security contributions deducted this pay period, in euros */
  monthlySSEmployee?: number;
}

/** Comparison between employer-withheld IRPF and the engine-calculated tax. */
export interface NominaComparison {
  /** Engine-calculated annual tax (cuotaLiquidaTOTAL) */
  calculatedTax: number;
  /** Annualised retenciones derived from the nómina */
  retencionesFromNomina: number;
  /**
   * retencionesFromNomina − calculatedTax.
   * Positive → employer withheld more than needed (overpaid → refund likely).
   * Negative → employer withheld less than needed (underpaid → likely owes).
   */
  difference: number;
  diffType: 'overpaid' | 'underpaid' | 'correct';
  /** Absolute percentage difference relative to calculatedTax */
  percentageDiff: number;
}

/** Full result returned by POST /api/parse-nomina */
export interface NominaParseResult {
  /** Raw financial data extracted from the PDF */
  nomina: NominaData;
  /** TaxInput fields that could be mapped from the nómina + any user overrides */
  taxInput: Partial<TaxInput>;
  /** Best estimate of annual gross used for the calculation */
  annualGross: number;
  /** Best estimate of annualised retenciones from the nómina */
  annualRetencionesNomina: number;
  /** Full tax calculation result (present if enough data was available) */
  taxResult?: TaxResult;
  /** Side-by-side comparison (present when taxResult is present) */
  comparison?: NominaComparison;
}
