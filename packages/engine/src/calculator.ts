import { createRequire } from 'module';
import type { TaxInput, TaxResult, WaterfallStep } from '@taxai/shared';
import type { RegionRules, StateRules } from './types.js';
import { applyBrackets } from './brackets.js';
import { calcTrabajoReduction } from './reductions.js';
import { calcMinimumPersonalFamiliar } from './minimums.js';

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

export function calculate(input: TaxInput): TaxResult {
  const stateRules = loadStateRules(input.fiscalYear);
  const regionRules = loadRegionRules(input.fiscalYear, input.region);

  // Work entirely in cents to avoid floating-point drift
  const grossSalaryCents = Math.round(input.grossSalary * 100);
  const otherIncomeCents = Math.round((input.otherIncome ?? 0) * 100);
  const retencionesCents = Math.round(input.retenciones * 100);

  // Step 2 — Reducción por rendimientos del trabajo
  const trabajoReductionCents = calcTrabajoReduction(
    grossSalaryCents,
    otherIncomeCents,
    regionRules.trabajoReductions,
  );
  // rendimientoNetoReducido cannot be negative
  const rendimientoNetoReducidoCents = Math.max(0, grossSalaryCents - trabajoReductionCents);

  // Step 3 — Base imponible general
  const baseImponibleGeneralCents = rendimientoNetoReducidoCents + otherIncomeCents;

  // Step 4 — Mínimo personal y familiar
  const minimumCents = calcMinimumPersonalFamiliar(input);

  // Step 5 — Apply state brackets to FULL base, regional brackets to FULL base
  // (no 50/50 split — each tarifa is applied to the complete base independently)
  const cuotaIntegraEstatalCents = applyBrackets(baseImponibleGeneralCents, stateRules.stateBrackets);
  const cuotaIntegraAutonomicaCents = applyBrackets(baseImponibleGeneralCents, regionRules.autonomicBrackets);
  const cuotaIntegraTOTALCents = cuotaIntegraEstatalCents + cuotaIntegraAutonomicaCents;

  // Step 6 — Apply each tarifa to the FULL mínimo personal y familiar
  const stateMinQuotaCents = applyBrackets(minimumCents, stateRules.stateBrackets);
  const regionalMinQuotaCents = applyBrackets(minimumCents, regionRules.autonomicBrackets);

  let cuotaLiquidaEstatalCents = Math.max(0, cuotaIntegraEstatalCents - stateMinQuotaCents);
  let cuotaLiquidaAutonomicaCents = Math.max(0, cuotaIntegraAutonomicaCents - regionalMinQuotaCents);

  // Step 7 — Deducción por rendimientos del trabajo (2025, split 50/50)
  const deductionCents = calcCuotaDeduction(grossSalaryCents);
  const deductionHalf = Math.round(deductionCents / 2);
  const appliedEstatal    = Math.min(deductionHalf, cuotaLiquidaEstatalCents);
  const appliedAutonomica = Math.min(deductionCents - deductionHalf, cuotaLiquidaAutonomicaCents);
  const deductionAppliedCents = appliedEstatal + appliedAutonomica;

  cuotaLiquidaEstatalCents    -= appliedEstatal;
  cuotaLiquidaAutonomicaCents -= appliedAutonomica;
  const cuotaLiquidaTOTALCents = cuotaLiquidaEstatalCents + cuotaLiquidaAutonomicaCents;

  // Step 8 — Final result
  const resultAmountCents = cuotaLiquidaTOTALCents - retencionesCents;
  const resultType =
    resultAmountCents > 0 ? 'a_ingresar' : resultAmountCents < 0 ? 'a_devolver' : 'cero';

  const waterfallSteps: WaterfallStep[] = buildWaterfall(
    grossSalaryCents,
    trabajoReductionCents,
    otherIncomeCents,
    cuotaIntegraTOTALCents,
    cuotaLiquidaTOTALCents + deductionAppliedCents,  // cuota before deduction for step
    deductionAppliedCents,
    retencionesCents,
    resultAmountCents,
  );

  return {
    fiscalYear: input.fiscalYear,
    region: input.region,
    grossSalary: input.grossSalary,
    rendimientoNetoReducido: toEuros(rendimientoNetoReducidoCents),
    baseImponibleGeneral: toEuros(baseImponibleGeneralCents),
    minimumPersonalFamiliar: toEuros(minimumCents),
    cuotaIntegraEstatal: toEuros(cuotaIntegraEstatalCents),
    cuotaIntegraAutonomica: toEuros(cuotaIntegraAutonomicaCents),
    cuotaIntegraTOTAL: toEuros(cuotaIntegraTOTALCents),
    cuotaLiquidaEstatal: toEuros(cuotaLiquidaEstatalCents),
    cuotaLiquidaAutonomica: toEuros(cuotaLiquidaAutonomicaCents),
    cuotaLiquidaTOTAL: toEuros(cuotaLiquidaTOTALCents),
    retenciones: input.retenciones,
    resultAmount: toEuros(resultAmountCents),
    resultType,
    waterfallSteps,
  };
}

function buildWaterfall(
  grossSalaryCents: number,
  trabajoReductionCents: number,
  otherIncomeCents: number,
  cuotaIntegraTOTALCents: number,
  cuotaBeforeDeductionCents: number,
  deductionAppliedCents: number,
  retencionesCents: number,
  resultAmountCents: number,
): WaterfallStep[] {
  const steps: WaterfallStep[] = [];

  // Phase 1: income → base imponible (values in euros)
  let running = toEuros(grossSalaryCents);
  steps.push({ label: 'Salario bruto', amount: toEuros(grossSalaryCents), runningTotal: running });

  if (otherIncomeCents !== 0) {
    const amt = toEuros(otherIncomeCents);
    running += amt;
    steps.push({ label: 'Otros rendimientos', amount: amt, runningTotal: running });
  }

  const reductionEuros = toEuros(-trabajoReductionCents);
  running += reductionEuros;
  steps.push({ label: 'Reducción rendimientos del trabajo', amount: reductionEuros, runningTotal: running });

  // Phase 2: tax calculation — reset running to cuota íntegra
  const cuotaIntegraEuros = toEuros(cuotaIntegraTOTALCents);
  steps.push({
    label: 'Cuota íntegra (tramos estatal + autonómico)',
    amount: cuotaIntegraEuros,
    runningTotal: cuotaIntegraEuros,
  });
  running = cuotaIntegraEuros;

  const minReductionEuros = toEuros(-(cuotaIntegraTOTALCents - cuotaBeforeDeductionCents));
  running += minReductionEuros;
  steps.push({ label: 'Reducción mínimo personal y familiar', amount: minReductionEuros, runningTotal: running });

  if (deductionAppliedCents > 0) {
    const dedEuros = toEuros(-deductionAppliedCents);
    running += dedEuros;
    steps.push({ label: 'Deducción por rendimientos del trabajo', amount: dedEuros, runningTotal: running });
  }

  if (retencionesCents !== 0) {
    const retEuros = toEuros(-retencionesCents);
    running += retEuros;
    steps.push({ label: 'Retenciones a cuenta', amount: retEuros, runningTotal: running });
  }

  const resultEuros = toEuros(resultAmountCents);
  steps.push({
    label: resultAmountCents >= 0 ? 'A ingresar' : 'A devolver',
    amount: 0,
    runningTotal: resultEuros,
  });

  return steps;
}
