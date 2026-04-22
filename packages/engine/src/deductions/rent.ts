import type { TaxInput } from '@taxai/shared';
import type { RentDeductionRule } from '../types.js';

/**
 * Calculates the tenant rent deduction applied to cuota líquida autonómica.
 * Each autonomía sets its own rate and caps. Returns deduction in CENTS.
 *
 * baseImponibleTotal = baseImponibleGeneral + baseImponibleAhorro
 * (used to check income ceiling — no deduction if above ceiling)
 */
export function calcRentDeduction(
  rule: RentDeductionRule | null | undefined,
  rentPayments: TaxInput['rentPayments'],
  baseImponibleTotal: number,  // euros
): number {
  if (!rule || !rentPayments || rentPayments.annualRentPaid <= 0) return 0;

  // Income ceiling check
  if (baseImponibleTotal > rule.incomeCeilingIndividual) return 0;

  // Determine which cap applies based on enhanced conditions
  const conds = rule.enhancedConditions;
  const qualifiesEnhanced =
    (conds.includes('under36')      && rentPayments.isUnder36)          ||
    (conds.includes('disability')   && rentPayments.hasDisability)       ||
    (conds.includes('largefamily')  && rentPayments.isLargeFamily)       ||
    (conds.includes('unemployed6m') && rentPayments.isUnemployed6Months);

  const cap = qualifiesEnhanced ? rule.capEnhanced : rule.capGeneral;

  const deductionEuros = Math.min(rentPayments.annualRentPaid * rule.rate, cap);
  return Math.round(deductionEuros * 100); // return cents
}
