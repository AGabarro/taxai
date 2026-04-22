/** Tenant rent payments for habitual residence deduction (varies by autonomía). */
export interface RentPayments {
  /** Total rent paid during the fiscal year, in euros */
  annualRentPaid: number;
  /** Tenant age < 36 at year end */
  isUnder36: boolean;
  /** Disability certificate ≥ 33% */
  hasDisability: boolean;
  /** Familia numerosa (3+ children) */
  isLargeFamily: boolean;
  /** Unemployed for ≥ 183 days (Catalonia enhanced tier) */
  isUnemployed6Months: boolean;
  /** State transitoria (DT 15ª LIRPF, pre-2015 contract) */
  contractBefore2015: boolean;
}

/** A single investment transaction extracted from a broker annual report. */
export interface StockTransaction {
  /** Ticker or ISIN */
  assetId: string;
  assetName?: string;
  transactionType: 'buy' | 'sell' | 'dividend' | 'interest' | 'fee';
  /** ISO date "2025-03-15" */
  date: string;
  /** Number of shares (undefined for dividends/interest/fees) */
  quantity?: number;
  /** Price per share in EUR */
  pricePerUnit?: number;
  /** EUR, positive=proceeds/income, negative=cost paid */
  totalAmount: number;
  /** EUR, always positive */
  fees: number;
  /** "EUR", "USD", etc. */
  currency: string;
  /** Exchange rate to EUR on transaction date */
  fxRate?: number;
  /** For dividends: foreign tax already paid */
  foreignTaxWithheld?: number;
}

/** Raw data extracted by AI from a broker annual report PDF or CSV. */
export interface BrokerReportData {
  brokerName?: string;
  fiscalYear: number;
  currency: string;
  transactions: StockTransaction[];
  /** Broker-reported summaries (for cross-check only — engine recalculates) */
  reportedCapitalGains?: number;
  reportedDividends?: number;
  reportedInterest?: number;
  reportedFees?: number;
}

/** Full result returned by POST /api/parse-broker */
export interface BrokerParseResult {
  brokerReport: BrokerReportData;
  /** Engine FIFO result in euros (can be negative) */
  computedCapitalGains: number;
  computedDividends: number;
  computedInterest: number;
  totalForeignTaxWithheld: number;
  /** Ready to merge into savingsIncome in TaxInput */
  taxInput: Partial<TaxInput>;
  taxResult?: TaxResult;
  /** e.g. "3 transactions in USD converted at ECB rate" */
  warnings: string[];
}

/** Income from savings (Base Imponible del Ahorro — Art. 46 LIRPF). */
export interface SavingsIncome {
  /** Net capital gains/losses from stocks, funds, crypto (already offset within the same bucket).
   *  Can be negative: losses up to 25% of (dividends + interest) can be offset in the same year. */
  capitalGains?: number;
  /** Dividend income from shares, investment funds */
  dividends?: number;
  /** Interest income from bank accounts, bonds */
  interest?: number;
}

/** Real-estate income (Rendimientos del Capital Inmobiliario — Art. 22–24 LIRPF). */
export interface RentalIncome {
  /** Total gross rental income received during the year */
  grossRentalIncome?: number;
  /** Deductible expenses: mortgage interest, IBI, community fees, repairs, amortisation */
  rentalExpenses?: number;
  /** Renta imputada from second homes / empty properties.
   *  The user calculates this (1.1% × valor catastral for post-1994 review; 2% otherwise). */
  imputedIncome?: number;
}

/** Catalonia-specific autonómica deductions (applied to cuota líquida autonómica). */
export interface CataloniaDeductions {
  /** Number of 1st or 2nd children born or adopted during the tax year → €300/child */
  birthAdoptionFirst?: number;
  /** Number of 3rd+ children born or adopted during the tax year → €600/child */
  birthAdoptionThird?: number;
  /** Monthly rent paid for habitual residence (qualifies if age ≤ 32 or ≥ 3 dependents) → 10%, max €300/year */
  habitatgeRentMonthly?: number;
  /** Donations to Catalan universities / research entities → 25% deduction */
  donacionsRecerca?: number;
  /** Donations to Catalan environmental / ecological entities → 15% deduction */
  donacionsEcologiques?: number;
}

export interface TaxInput {
  fiscalYear: number;           // e.g. 2024
  region: SpanishRegion;        // see type below
  age: number;                  // affects mínimo personal
  grossSalary: number;          // euros, rendimientos del trabajo (rendimiento íntegro)
  /** Annual employee Social Security contributions (Art. 19 LIRPF gastos deducibles).
   *  Includes Contingencias Comunes, MEI, Desempleo, and Formación Profesional.
   *  Subtracted from grossSalary before the Art. 20 trabajo reduction is applied. */
  ssContributions?: number;
  otherIncome?: number;         // other rendimientos going into base general (catch-all)
  retenciones: number;          // withholdings already paid
  dependentsUnder25: number;    // children under 25 in household
  dependentsUnder3?: number;    // subset of above who are under 3 (for supplement)
  dependentsOver65: number;     // elderly dependents
  civilStatus: CivilStatus;
  disability?: DisabilityGrade; // taxpayer disability grade (33% or 65%+)

  // ── Advanced income / deductions ──────────────────────────────────────────

  /** Savings base income (Base Imponible del Ahorro — Art. 46 LIRPF).
   *  Capital gains, dividends, interest. Loss compensation up to 25% applied automatically. */
  savingsIncome?: SavingsIncome;
  /** Real-estate income (Rendimientos del Capital Inmobiliario — Art. 22–24 LIRPF).
   *  Net figure (gross − expenses) is added to Base Imponible General. */
  rentalIncome?: RentalIncome;
  /** Private pension plan contributions, reducción en Base Imponible General.
   *  Maximum: €1,500/year (individual limit since 2022, Art. 51 LIRPF). */
  pensionContributions?: number;
  /** Region-specific deductions applied to cuota líquida autonómica. */
  regionalDeductions?: {
    catalonia?: CataloniaDeductions;
  };
  /** Tenant rent payments for the habitual-residence deduction (varies by autonomía). */
  rentPayments?: RentPayments;
  /** Number of dependents (children or ascendants) with recognised disability ≥ 33% and < 65% */
  dependentsDisability33?: number;
  /** Number of dependents with recognised disability ≥ 65% */
  dependentsDisability65?: number;
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

  // Reductions applied to base general
  rendimientoNetoReducido: number;   // after SS + trabajo reductions
  reduccionPension: number;          // pension contribution reduction (€0 if none)
  netRentalIncome: number;           // net rental income added to base general (€0 if none)
  baseImponibleGeneral: number;      // rendimientoNetoReducido + otherIncome + netRentalIncome − pensionReduction
  minimumPersonalFamiliar: number;   // mínimo personal y familiar (Art. 57–61)

  // Savings base (Base Imponible del Ahorro — Art. 46 LIRPF)
  baseImponibleAhorro: number;           // €0 if no savings income
  cuotaIntegraAhorroEstatal: number;
  cuotaIntegraAhorroAutonomica: number;
  cuotaLiquidaAhorroEstatal: number;
  cuotaLiquidaAhorroAutonomica: number;

  // General base — split between state and regional
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaIntegraTOTAL: number;             // general + ahorro, both halves

  // Cuota líquida — after mínimo, 2025 deduction, regional deductions
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  deduccionesAutonomicas: number;        // regional deductions applied (€0 if none)
  cuotaLiquidaTOTAL: number;             // general + ahorro − deduccionesAutonomicas

  // Final result
  retenciones: number;
  resultAmount: number;       // positive = to pay (a ingresar), negative = refund (a devolver)
  resultType: 'a_ingresar' | 'a_devolver' | 'cero';

  /** Tenant rent deduction applied to cuota líquida autonómica (€0 when not applicable) */
  deduccionAlquiler: number;

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
  /** Number of salary payments per year (typically 12 or 14). Default 12. */
  numberOfPayments?: number;
  /** Total devengado (gross earnings) for this pay period, in euros */
  monthlyGross?: number;
  /** Annual gross stated explicitly in the nómina (some show acumulado), in euros */
  annualGross?: number;
  /**
   * Base I.R.P.F. for this pay period — the taxable base on which IRPF withholding is calculated.
   * May be lower than monthlyGross when tax-exempt benefits (meal vouchers, health insurance, etc.)
   * are included in Total Devengado but excluded from the IRPF base.
   * This is the figure the employer uses to compute the withholding amount.
   */
  monthlyBaseIRPF?: number;
  /** IRPF withholding amount deducted this pay period (Concept 999 / Tributación IRPF), in euros */
  monthlyRetenciones?: number;
  /** IRPF withheld year-to-date / annual (if stated in nómina), in euros */
  annualRetenciones?: number;
  /** IRPF retention rate applied, as a percentage (e.g. 15.5 means 15.5%) */
  retentionPercentage?: number;
  /**
   * Employee Social Security contributions this pay period — individual breakdown.
   * Art. 19.2.a LIRPF: these are gastos deducibles and reduce the taxable base.
   */
  /** Contingencias Comunes employee contribution, in euros */
  monthlySS_CC?: number;
  /** MEI (Mecanismo de Equidad Intergeneracional), in euros */
  monthlySS_MEI?: number;
  /** Desempleo (unemployment) employee contribution, in euros */
  monthlySS_unemployment?: number;
  /** Formación Profesional employee contribution, in euros */
  monthlySS_vocational?: number;
  /** Total employee SS (sum of above four, or directly stated), in euros */
  monthlySSEmployee?: number;

  // ── Salary breakdown ──────────────────────────────────────────────────────
  /** Salario base (base salary before supplements), in euros */
  monthlySalarioBase?: number;
  /**
   * Retribución en especie included in Total Devengado (company car, health insurance, etc.).
   * These are declared benefits — included in monthlyGross but may be partially exempt from IRPF,
   * which explains the gap between Total Devengado and Base I.R.P.F.
   */
  monthlyRetribucionEspecie?: number;
  /**
   * Dietas y asignaciones para gastos de viaje (meal/travel allowances).
   * Exempt from IRPF up to legal limits (€26.67/day inland, €48.08/day abroad for 2025).
   * Their presence reduces Base I.R.P.F. below Total Devengado.
   */
  monthlyDietas?: number;
  /** Anticipos a cuenta del salario (advances deducted from net pay), in euros */
  monthlyAnticipo?: number;
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
  /** Annualised Total Devengado — shown as "Salario Bruto" in the UI */
  annualGross: number;
  /**
   * Annualised Base I.R.P.F. used as grossSalary for the engine.
   * When monthlyBaseIRPF was extracted this is monthlyBaseIRPF × payments.
   * When absent, the engine falls back to annualGross (Total Devengado).
   * Use this value (not annualGross) to understand what base the tax was calculated on.
   */
  annualBaseIRPF: number;
  /** Best estimate of annualised retenciones from the nómina */
  annualRetencionesNomina: number;
  /** Full tax calculation result (present if enough data was available) */
  taxResult?: TaxResult;
  /** Side-by-side comparison (present when taxResult is present) */
  comparison?: NominaComparison;
}

/** Full result returned by POST /api/parse-renta */
export interface RentaAnualResult {
  /** Financial data extracted per uploaded payslip (one entry per PDF) */
  months: NominaData[];
  /** Sum of all monthly Total Devengado figures */
  annualGross: number;
  /** Sum of all monthly Base I.R.P.F. figures used as grossSalary for the engine */
  annualBaseIRPF: number;
  /** Sum of all monthly IRPF retenciones */
  annualRetencionesNomina: number;
  /** Sum of all monthly employee SS contributions */
  annualSS: number;
  /** TaxInput fields derived from aggregated annual data */
  taxInput: Partial<TaxInput>;
  /** Full engine result (present when enough data was available) */
  taxResult?: TaxResult;
  /** Comparison of total retenciones vs. calculated annual tax */
  comparison?: NominaComparison;
}
