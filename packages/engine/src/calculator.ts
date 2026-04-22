import { createRequire } from 'module';
import type { TaxInput, TaxResult, WaterfallStep } from '@taxai/shared';
import type { Bracket, RegionRules, StateRules } from './types.js';
import { applyBrackets } from './brackets.js';
import { calcTrabajoReduction } from './reductions.js';
import { calcMinimumPersonalFamiliar } from './minimums.js';
import { calcRentDeduction } from './deductions/rent.js';

const require = createRequire(import.meta.url);

function loadStateRules(fiscalYear: number): StateRules {
  return require(`../rules/${fiscalYear}/state.json`) as StateRules;
}

function loadRegionRules(fiscalYear: number, region: string): RegionRules {
  return require(`../rules/${fiscalYear}/${region}.json`) as RegionRules;
}

/** Converts cents (integer) to euros (2 decimal places). */
function toEuros(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Tarifa del ahorro — uniform across all common-regime autonomías (Art. 66 & 76 LIRPF).
 * Each half (state / regional) carries identical rates that together yield the combined
 * brackets published by AEAT: 19%, 21%, 23%, 26%, 28%.
 */
const SAVINGS_BRACKETS_STATE: Bracket[] = [
  { from: 0,       to: 6_000,   rate: 0.095 },
  { from: 6_000,   to: 50_000,  rate: 0.105 },
  { from: 50_000,  to: 200_000, rate: 0.115 },
  { from: 200_000, to: 300_000, rate: 0.13  },
  { from: 300_000, to: null,    rate: 0.14  },
];

const SAVINGS_BRACKETS_AUTONOMIC: Bracket[] = [
  { from: 0,       to: 6_000,   rate: 0.095 },
  { from: 6_000,   to: 50_000,  rate: 0.105 },
  { from: 50_000,  to: 200_000, rate: 0.115 },
  { from: 200_000, to: 300_000, rate: 0.13  },
  { from: 300_000, to: null,    rate: 0.14  },
];

/**
 * Deducción por rendimientos del trabajo (new in 2025, from cuota líquida).
 * Returns deduction in cents.
 */
function calcCuotaDeduction(grossSalaryCents: number): number {
  const FULL_THRESHOLD = 1_657_600;  // €16,576
  const PHASE_OUT_END  = 1_827_600;  // €18,276
  const MAX_DEDUCTION  = 34_000;     // €340

  if (grossSalaryCents <= FULL_THRESHOLD) {
    return MAX_DEDUCTION;
  } else if (grossSalaryCents <= PHASE_OUT_END) {
    const excess = grossSalaryCents - FULL_THRESHOLD;
    return Math.max(0, MAX_DEDUCTION - Math.round(0.2 * excess));
  }
  return 0;
}

/**
 * Compute base imponible del ahorro with same-year loss compensation.
 * Art. 49 LIRPF: capital losses may offset up to 25% of (dividends + interest).
 * Returns amount in cents (always ≥ 0).
 */
function calcBaseImponibleAhorro(input: TaxInput): number {
  const s = input.savingsIncome;
  if (!s) return 0;

  const capitalGainsCents = Math.round((s.capitalGains ?? 0) * 100);
  const dividendsCents    = Math.round((s.dividends ?? 0)    * 100);
  const interestCents     = Math.round((s.interest ?? 0)     * 100);

  const otherSavingsCents = dividendsCents + interestCents;

  if (capitalGainsCents >= 0) {
    return Math.max(0, capitalGainsCents + otherSavingsCents);
  }

  // Capital losses: offset up to 25% of other savings income
  const lossAbs    = -capitalGainsCents;
  const maxOffset  = Math.round(0.25 * otherSavingsCents);
  const offset     = Math.min(lossAbs, maxOffset);
  return Math.max(0, otherSavingsCents - offset);
}

/**
 * Catalonia-specific regional deductions (deduccions autonòmiques).
 * Returns total deduction in cents (uncapped — caller caps to cuotaLiquidaAutonomica).
 */
function calcCataloniaDeductions(input: TaxInput): number {
  const cat = input.regionalDeductions?.catalonia;
  if (!cat) return 0;

  let total = 0;

  // Deducció per natalitat o adopció (Art. 4 Llei 5/2020):
  //   1st/2nd child born/adopted this year → €300 each
  //   3rd+ child → €600 each
  total += (cat.birthAdoptionFirst ?? 0) * 30_000;
  total += (cat.birthAdoptionThird ?? 0) * 60_000;

  // Deducció per arrendament d'habitatge habitual (Art. 3 Llei 5/2020):
  //   10% of annual rent paid, max €300 (qualifies: age ≤32 or ≥3 dependents)
  if (cat.habitatgeRentMonthly && cat.habitatgeRentMonthly > 0) {
    const annualRent = Math.round(cat.habitatgeRentMonthly * 12 * 100);
    total += Math.min(Math.round(annualRent * 0.1), 30_000);
  }

  // Deducció per donatius a entitats de recerca (25%)
  if (cat.donacionsRecerca && cat.donacionsRecerca > 0) {
    total += Math.round(cat.donacionsRecerca * 100 * 0.25);
  }

  // Deducció per donatius a entitats ecologistes (15%)
  if (cat.donacionsEcologiques && cat.donacionsEcologiques > 0) {
    total += Math.round(cat.donacionsEcologiques * 100 * 0.15);
  }

  return total;
}

export function calculate(input: TaxInput): TaxResult {
  const stateRules = loadStateRules(input.fiscalYear);
  const regionRules = loadRegionRules(input.fiscalYear, input.region);

  // Work entirely in cents to avoid floating-point drift
  const grossSalaryCents  = Math.round(input.grossSalary * 100);
  const otherIncomeCents  = Math.round((input.otherIncome ?? 0) * 100);
  const retencionesCents  = Math.round(input.retenciones * 100);
  const ssCents           = Math.round((input.ssContributions ?? 0) * 100);

  // ── Art. 22–24: Rendimientos del capital inmobiliario ─────────────────────
  const r = input.rentalIncome;
  const grossRentalCents  = Math.round((r?.grossRentalIncome ?? 0) * 100);
  const rentalExpCents    = Math.round((r?.rentalExpenses    ?? 0) * 100);
  const imputedCents      = Math.round((r?.imputedIncome     ?? 0) * 100);
  // Net = max(0, gross − expenses). Deficit cannot offset other income currently.
  const netRentalCents    = Math.max(0, grossRentalCents - rentalExpCents) + imputedCents;

  // ── Art. 51: Reducción por aportaciones a planes de pensiones ─────────────
  const MAX_PENSION_CENTS = 150_000;  // €1,500 annual individual limit
  const rawPensionCents   = Math.round((input.pensionContributions ?? 0) * 100);
  const pensionCents      = Math.min(rawPensionCents, MAX_PENSION_CENTS);

  // ── Step 1 — Art. 19 gastos deducibles (SS) ───────────────────────────────
  const grossAfterSSCents = grossSalaryCents - ssCents;

  // ── Step 2 — Art. 20 reducción por rendimientos del trabajo ───────────────
  const trabajoReductionCents = calcTrabajoReduction(
    grossAfterSSCents,
    otherIncomeCents,
    regionRules.trabajoReductions,
  );
  const rendimientoNetoReducidoCents = Math.max(0, grossAfterSSCents - trabajoReductionCents);

  // ── Step 3 — Base imponible general ───────────────────────────────────────
  // Salary RNR + other income + net real estate − pension reduction
  const baseImponibleGeneralCents = Math.max(
    0,
    rendimientoNetoReducidoCents + otherIncomeCents + netRentalCents - pensionCents,
  );

  // ── Step 4 — Base imponible del ahorro (Art. 46 LIRPF) ───────────────────
  const baseImponibleAhorroCents = calcBaseImponibleAhorro(input);

  // ── Step 5 — Mínimo personal y familiar ───────────────────────────────────
  const minimumCents = calcMinimumPersonalFamiliar(input);

  // ── Step 6 — Cuota íntegra (general base, each tarifa to FULL base) ────────
  const cuotaIntegraEstatalCents    = applyBrackets(baseImponibleGeneralCents, stateRules.stateBrackets);
  const cuotaIntegraAutonomicaCents = applyBrackets(baseImponibleGeneralCents, regionRules.autonomicBrackets);

  // ── Step 7 — Cuota íntegra ahorro (same uniform brackets for all regions) ─
  const cuotaIntegraAhorroEstatalCents    = applyBrackets(baseImponibleAhorroCents, SAVINGS_BRACKETS_STATE);
  const cuotaIntegraAhorroAutonomicaCents = applyBrackets(baseImponibleAhorroCents, SAVINGS_BRACKETS_AUTONOMIC);

  const cuotaIntegraTOTALCents =
    cuotaIntegraEstatalCents    + cuotaIntegraAutonomicaCents +
    cuotaIntegraAhorroEstatalCents + cuotaIntegraAhorroAutonomicaCents;

  // ── Step 8 — Apply mínimo personal to general cuota first; excess → ahorro ─
  // State side
  const stateMinQuotaCents = applyBrackets(minimumCents, stateRules.stateBrackets);
  let cuotaLiquidaEstatalCents: number;
  let cuotaLiquidaAhorroEstatalCents: number;
  if (stateMinQuotaCents <= cuotaIntegraEstatalCents) {
    cuotaLiquidaEstatalCents     = cuotaIntegraEstatalCents - stateMinQuotaCents;
    cuotaLiquidaAhorroEstatalCents = cuotaIntegraAhorroEstatalCents;
  } else {
    const excess = stateMinQuotaCents - cuotaIntegraEstatalCents;
    cuotaLiquidaEstatalCents     = 0;
    cuotaLiquidaAhorroEstatalCents = Math.max(0, cuotaIntegraAhorroEstatalCents - excess);
  }

  // Regional side
  const regionalMinQuotaCents = applyBrackets(minimumCents, regionRules.autonomicBrackets);
  let cuotaLiquidaAutonomicaCents: number;
  let cuotaLiquidaAhorroAutonomicaCents: number;
  if (regionalMinQuotaCents <= cuotaIntegraAutonomicaCents) {
    cuotaLiquidaAutonomicaCents     = cuotaIntegraAutonomicaCents - regionalMinQuotaCents;
    cuotaLiquidaAhorroAutonomicaCents = cuotaIntegraAhorroAutonomicaCents;
  } else {
    const excess = regionalMinQuotaCents - cuotaIntegraAutonomicaCents;
    cuotaLiquidaAutonomicaCents     = 0;
    cuotaLiquidaAhorroAutonomicaCents = Math.max(0, cuotaIntegraAhorroAutonomicaCents - excess);
  }

  // ── Step 9 — Deducción por rendimientos del trabajo (2025, general base only)
  const deductionCents  = calcCuotaDeduction(grossSalaryCents);
  const deductionHalf   = Math.round(deductionCents / 2);
  const appliedEstatal    = Math.min(deductionHalf, cuotaLiquidaEstatalCents);
  const appliedAutonomica = Math.min(deductionCents - deductionHalf, cuotaLiquidaAutonomicaCents);
  const deductionAppliedCents = appliedEstatal + appliedAutonomica;

  cuotaLiquidaEstatalCents    -= appliedEstatal;
  cuotaLiquidaAutonomicaCents -= appliedAutonomica;

  // ── Step 10 — Deducciones autonómicas (Catalonia) ─────────────────────────
  const rawRegionalDeducCents = input.region === 'catalonia'
    ? calcCataloniaDeductions(input)
    : 0;
  // Applied only to cuota líquida autonómica general (cannot make it negative)
  const totalAutonomicaBeforeDeductions =
    cuotaLiquidaAutonomicaCents + cuotaLiquidaAhorroAutonomicaCents;
  const appliedCatDeducCents = Math.min(rawRegionalDeducCents, totalAutonomicaBeforeDeductions);

  // Distribute deduction: first from general autonómica, then ahorro
  const dedGeneral = Math.min(appliedCatDeducCents, cuotaLiquidaAutonomicaCents);
  const dedAhorro  = appliedCatDeducCents - dedGeneral;
  cuotaLiquidaAutonomicaCents     -= dedGeneral;
  cuotaLiquidaAhorroAutonomicaCents -= dedAhorro;

  // Compute waterfall minReduction BEFORE rent so it reflects only the mínimo personal
  const cuotaGeneralBeforeMinCents = cuotaIntegraEstatalCents + cuotaIntegraAutonomicaCents;
  const cuotaLiquidaGeneralPreRentCents = cuotaLiquidaEstatalCents + cuotaLiquidaAutonomicaCents;
  const minReductionGeneralCents = cuotaGeneralBeforeMinCents - cuotaLiquidaGeneralPreRentCents - deductionAppliedCents - dedGeneral;

  // ── Step 10b — Deducción autonómica por alquiler (tenant rent) ─────────────
  const rentDeductionCents = calcRentDeduction(
    regionRules.rentDeduction,
    input.rentPayments,
    toEuros(baseImponibleGeneralCents + baseImponibleAhorroCents),
  );
  // Apply to cuota líquida autonómica (cannot make it negative)
  const appliedRentDeduction = Math.min(rentDeductionCents, cuotaLiquidaAutonomicaCents);
  cuotaLiquidaAutonomicaCents -= appliedRentDeduction;

  // Total regional deductions (Catalonia + rent) for TaxResult reporting
  const deduccionesAutonomicasCents = appliedCatDeducCents + appliedRentDeduction;

  // ── Step 11 — Final totals ─────────────────────────────────────────────────
  const cuotaLiquidaTOTALCents =
    cuotaLiquidaEstatalCents + cuotaLiquidaAutonomicaCents +
    cuotaLiquidaAhorroEstatalCents + cuotaLiquidaAhorroAutonomicaCents;

  const resultAmountCents = cuotaLiquidaTOTALCents - retencionesCents;
  const resultType =
    resultAmountCents > 0 ? 'a_ingresar' : resultAmountCents < 0 ? 'a_devolver' : 'cero';

  const waterfallSteps: WaterfallStep[] = buildWaterfall({
    grossSalaryCents,
    ssCents,
    trabajoReductionCents,
    otherIncomeCents,
    netRentalCents,
    pensionCents,
    baseImponibleAhorroCents,
    cuotaIntegraTOTALCents,
    cuotaGeneralBeforeMinCents,
    minReductionGeneralCents,
    deductionAppliedCents,
    deduccionesAutonomicasCents: appliedCatDeducCents,  // Catalonia-only for waterfall step
    rentDeductionCents: appliedRentDeduction,
    cuotaIntegraAhorroEstatalCents,
    cuotaIntegraAhorroAutonomicaCents,
    cuotaLiquidaAhorroEstatalCents,
    cuotaLiquidaAhorroAutonomicaCents,
    retencionesCents,
    resultAmountCents,
  });

  return {
    fiscalYear: input.fiscalYear,
    region: input.region,
    grossSalary: input.grossSalary,
    rendimientoNetoReducido: toEuros(rendimientoNetoReducidoCents),
    reduccionPension: toEuros(pensionCents),
    netRentalIncome: toEuros(netRentalCents),
    baseImponibleGeneral: toEuros(baseImponibleGeneralCents),
    minimumPersonalFamiliar: toEuros(minimumCents),
    baseImponibleAhorro: toEuros(baseImponibleAhorroCents),
    cuotaIntegraAhorroEstatal: toEuros(cuotaIntegraAhorroEstatalCents),
    cuotaIntegraAhorroAutonomica: toEuros(cuotaIntegraAhorroAutonomicaCents),
    cuotaLiquidaAhorroEstatal: toEuros(cuotaLiquidaAhorroEstatalCents),
    cuotaLiquidaAhorroAutonomica: toEuros(cuotaLiquidaAhorroAutonomicaCents),
    cuotaIntegraEstatal: toEuros(cuotaIntegraEstatalCents),
    cuotaIntegraAutonomica: toEuros(cuotaIntegraAutonomicaCents),
    cuotaIntegraTOTAL: toEuros(cuotaIntegraTOTALCents),
    cuotaLiquidaEstatal: toEuros(cuotaLiquidaEstatalCents),
    cuotaLiquidaAutonomica: toEuros(cuotaLiquidaAutonomicaCents),
    deduccionesAutonomicas: toEuros(deduccionesAutonomicasCents),
    deduccionAlquiler: toEuros(appliedRentDeduction),
    cuotaLiquidaTOTAL: toEuros(cuotaLiquidaTOTALCents),
    retenciones: input.retenciones,
    resultAmount: toEuros(resultAmountCents),
    resultType,
    waterfallSteps,
  };
}

interface WaterfallParams {
  grossSalaryCents: number;
  ssCents: number;
  trabajoReductionCents: number;
  otherIncomeCents: number;
  netRentalCents: number;
  pensionCents: number;
  baseImponibleAhorroCents: number;
  cuotaIntegraTOTALCents: number;
  cuotaGeneralBeforeMinCents: number;
  minReductionGeneralCents: number;
  deductionAppliedCents: number;
  /** Catalonia-specific deductions only (for the "Deducciones autonómicas" step) */
  deduccionesAutonomicasCents: number;
  /** Tenant rent deduction (shown as its own waterfall step) */
  rentDeductionCents: number;
  cuotaIntegraAhorroEstatalCents: number;
  cuotaIntegraAhorroAutonomicaCents: number;
  cuotaLiquidaAhorroEstatalCents: number;
  cuotaLiquidaAhorroAutonomicaCents: number;
  retencionesCents: number;
  resultAmountCents: number;
}

function buildWaterfall(p: WaterfallParams): WaterfallStep[] {
  const steps: WaterfallStep[] = [];

  // ── Phase 1: income → base imponible general ──────────────────────────────
  let running = toEuros(p.grossSalaryCents);
  steps.push({ label: 'Salario bruto', amount: toEuros(p.grossSalaryCents), runningTotal: running });

  if (p.ssCents > 0) {
    const amt = toEuros(-p.ssCents);
    running += amt;
    steps.push({ label: 'Cuotas Seguridad Social (Art. 19)', amount: amt, runningTotal: running });
  }

  if (p.otherIncomeCents !== 0) {
    const amt = toEuros(p.otherIncomeCents);
    running += amt;
    steps.push({ label: 'Otros rendimientos', amount: amt, runningTotal: running });
  }

  if (p.netRentalCents > 0) {
    const amt = toEuros(p.netRentalCents);
    running += amt;
    steps.push({ label: 'Rendimientos capital inmobiliario', amount: amt, runningTotal: running });
  }

  const reductionEuros = toEuros(-p.trabajoReductionCents);
  running += reductionEuros;
  steps.push({ label: 'Reducción rendimientos del trabajo', amount: reductionEuros, runningTotal: running });

  if (p.pensionCents > 0) {
    const amt = toEuros(-p.pensionCents);
    running += amt;
    steps.push({ label: 'Reducción plan de pensiones', amount: amt, runningTotal: running });
  }

  // ── Phase 2: cuota íntegra general (reset running) ────────────────────────
  const cuotaGeneralEuros = toEuros(p.cuotaGeneralBeforeMinCents);
  steps.push({
    label: 'Cuota íntegra base general',
    amount: cuotaGeneralEuros,
    runningTotal: cuotaGeneralEuros,
  });
  running = cuotaGeneralEuros;

  // Mínimo personal y familiar reduction on the general base
  if (p.minReductionGeneralCents > 0) {
    const amt = toEuros(-p.minReductionGeneralCents);
    running += amt;
    steps.push({ label: 'Reducción mínimo personal y familiar', amount: amt, runningTotal: running });
  }

  if (p.deductionAppliedCents > 0) {
    const amt = toEuros(-p.deductionAppliedCents);
    running += amt;
    steps.push({ label: 'Deducción rendimientos del trabajo', amount: amt, runningTotal: running });
  }

  // ── Phase 3: savings base (additive to running cuota) ────────────────────
  if (p.baseImponibleAhorroCents > 0) {
    const cuotaAhorroLiquidaCents =
      p.cuotaLiquidaAhorroEstatalCents + p.cuotaLiquidaAhorroAutonomicaCents;
    const amt = toEuros(cuotaAhorroLiquidaCents);
    running += amt;
    steps.push({ label: 'Cuota líquida base del ahorro', amount: amt, runningTotal: running });
  }

  if (p.deduccionesAutonomicasCents > 0) {
    const amt = toEuros(-p.deduccionesAutonomicasCents);
    running += amt;
    steps.push({ label: 'Deducciones autonómicas', amount: amt, runningTotal: running });
  }

  if (p.rentDeductionCents > 0) {
    const amt = toEuros(-p.rentDeductionCents);
    running += amt;
    steps.push({ label: 'Deducción por alquiler vivienda habitual', amount: amt, runningTotal: running });
  }

  if (p.retencionesCents !== 0) {
    const amt = toEuros(-p.retencionesCents);
    running += amt;
    steps.push({ label: 'Retenciones a cuenta', amount: amt, runningTotal: running });
  }

  const resultEuros = toEuros(p.resultAmountCents);
  steps.push({
    label: p.resultAmountCents >= 0 ? 'A ingresar' : 'A devolver',
    amount: 0,
    runningTotal: resultEuros,
  });

  return steps;
}
