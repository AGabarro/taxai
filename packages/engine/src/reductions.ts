import type { TrabajoReductions } from './types.js';

/**
 * Calculates the reducción por rendimientos del trabajo (Art. 20 LIRPF).
 * All inputs and output in cents.
 *
 * 2025 formula (Ley 5/2025) — two-segment phase-out:
 *   rnt = grossSalary - gastoFlatDeduction (€2,000)
 *   rnt ≤ 14,852          → reducción = 7,302
 *   14,852 < rnt ≤ 17,673.52 → reducción = 7,302 − 1.75 × (rnt − 14,852)
 *   17,673.52 < rnt < 19,747.50 → reducción = 2,364.34 − 1.14 × (rnt − 17,673.52)
 *   rnt ≥ 19,747.50       → reducción = 0
 *
 * 2024 legacy formula (single linear phase-out):
 *   salary ≤ phaseOutStart → full max reduction
 *   phaseOutStart < salary ≤ phaseOutEnd → linear from max to base
 *   salary > phaseOutEnd → base reduction (€2,000)
 *
 * Returns total reduction including any flat gasto deducible.
 * Does NOT cap to grossSalary — caller is responsible for max(0, gross - reduction).
 */
export function calcTrabajoReduction(
  grossSalaryCents: number,
  otherIncomeCents: number,
  rules: TrabajoReductions,
): number {
  if (rules.phaseOutSegment1End !== undefined) {
    return calcReduction2025(grossSalaryCents, rules);
  }
  return calcReduction2024(grossSalaryCents, otherIncomeCents, rules);
}

function calcReduction2025(grossSalaryCents: number, rules: TrabajoReductions): number {
  const gastoFlatCents = Math.round((rules.gastoFlatDeduction ?? 2000) * 100);
  const rntCents = grossSalaryCents - gastoFlatCents;

  const fullThresholdCents = Math.round(rules.fullReductionThreshold * 100);
  const seg1EndCents = Math.round(rules.phaseOutSegment1End! * 100);
  const seg2EndCents = Math.round(rules.phaseOutSegment2End! * 100);
  const maxRedCents = Math.round(rules.maxReduction * 100);
  const seg2BaseRedCents = Math.round(rules.segment2BaseReduction! * 100);

  let reduccionCents: number;
  if (rntCents <= fullThresholdCents) {
    reduccionCents = maxRedCents;
  } else if (rntCents <= seg1EndCents) {
    const excess = rntCents - fullThresholdCents;
    reduccionCents = maxRedCents - Math.round(rules.phaseOutRate1! * excess);
  } else if (rntCents < seg2EndCents) {
    const excess = rntCents - seg1EndCents;
    reduccionCents = seg2BaseRedCents - Math.round(rules.phaseOutRate2! * excess);
  } else {
    reduccionCents = 0;
  }

  return gastoFlatCents + Math.max(0, reduccionCents);
}

function calcReduction2024(
  grossSalaryCents: number,
  otherIncomeCents: number,
  rules: TrabajoReductions,
): number {
  const maxCents = Math.round(rules.maxReduction * 100);
  const baseCents = Math.round((rules.baseReduction ?? 2000) * 100);
  const phaseOutStartCents = Math.round((rules.phaseOutStart ?? rules.fullReductionThreshold) * 100);
  const phaseOutEndCents = Math.round((rules.phaseOutEnd ?? 19747) * 100);

  let reductionCents: number;

  if (grossSalaryCents <= phaseOutStartCents) {
    reductionCents = Math.min(maxCents, grossSalaryCents - otherIncomeCents);
  } else if (grossSalaryCents <= phaseOutEndCents) {
    const range = phaseOutEndCents - phaseOutStartCents;
    const excess = grossSalaryCents - phaseOutStartCents;
    reductionCents = Math.round(maxCents - ((maxCents - baseCents) * excess) / range);
  } else {
    reductionCents = baseCents;
  }

  return Math.max(0, reductionCents);
}
