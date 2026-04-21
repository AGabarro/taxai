import { createRequire } from 'module';
import type { TaxInput, TaxResult, WaterfallStep } from '@taxai/shared';
import type { RegionRules, StateRules } from './types.js';
import { applyBrackets } from './brackets.js';
import { calcTrabajoReduction } from './reductions.js';
import { calcMinimumPersonalFamiliar } from './minimums.js';

const require = createRequire(import.meta.url);

function loadStateRules(fiscalYear: number): StateRules {
  // path is relative to this file at runtime
  return require(`../rules/${fiscalYear}/state.json`) as StateRules;
}

function loadRegionRules(fiscalYear: number, region: string): RegionRules {
  return require(`../rules/${fiscalYear}/${region}.json`) as RegionRules;
}

/** Converts cents (integer) to euros (2 decimal places). */
function toEuros(cents: number): number {
  return Math.round(cents) / 100;
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
  const rendimientoNetoReducidoCents = grossSalaryCents - trabajoReductionCents;

  // Step 3 — Base imponible general
  const baseImponibleGeneralCents = rendimientoNetoReducidoCents + otherIncomeCents;

  // Step 4 — Mínimo personal y familiar
  const minimumCents = calcMinimumPersonalFamiliar(input);

  // Step 5 — Split base 50% state / 50% regional
  const stateBaseCents = Math.round(baseImponibleGeneralCents / 2);
  // assign any rounding remainder to regional so both halves sum exactly to base
  const regionalBaseCents = baseImponibleGeneralCents - stateBaseCents;

  // Step 6 — Apply progressive brackets to each half
  const cuotaIntegraEstatalCents = applyBrackets(stateBaseCents, stateRules.stateBrackets);
  const cuotaIntegraAutonomicaCents = applyBrackets(regionalBaseCents, regionRules.autonomicBrackets);
  const cuotaIntegraTOTALCents = cuotaIntegraEstatalCents + cuotaIntegraAutonomicaCents;

  // Step 7 — Subtract minimum quotas
  const minStateBaseCents = Math.round(minimumCents / 2);
  const minRegionalBaseCents = minimumCents - minStateBaseCents;

  const stateMinQuotaCents = applyBrackets(minStateBaseCents, stateRules.stateBrackets);
  const regionalMinQuotaCents = applyBrackets(minRegionalBaseCents, regionRules.autonomicBrackets);

  const cuotaLiquidaEstatalCents = Math.max(0, cuotaIntegraEstatalCents - stateMinQuotaCents);
  const cuotaLiquidaAutonomicaCents = Math.max(0, cuotaIntegraAutonomicaCents - regionalMinQuotaCents);
  const cuotaLiquidaTOTALCents = cuotaLiquidaEstatalCents + cuotaLiquidaAutonomicaCents;

  // Step 8 — Final result
  const resultAmountCents = cuotaLiquidaTOTALCents - retencionesCents;
  const resultType =
    resultAmountCents > 0 ? 'a_ingresar' : resultAmountCents < 0 ? 'a_devolver' : 'cero';

  // Build waterfall steps (in euros, for the chart)
  const waterfallSteps: WaterfallStep[] = buildWaterfall(
    grossSalaryCents,
    trabajoReductionCents,
    otherIncomeCents,
    cuotaIntegraTOTALCents,
    cuotaLiquidaTOTALCents,
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
  cuotaLiquidaTOTALCents: number,
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

  const minReductionEuros = toEuros(-(cuotaIntegraTOTALCents - cuotaLiquidaTOTALCents));
  running += minReductionEuros;
  steps.push({ label: 'Reducción mínimo personal y familiar', amount: minReductionEuros, runningTotal: running });

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
