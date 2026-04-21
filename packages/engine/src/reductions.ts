import type { TrabajoReductions } from './types.js';

/**
 * Calculates the reducción por rendimientos del trabajo (Art. 20 LIRPF).
 * All inputs and output in cents.
 *
 * Phase-out logic:
 *   - salary <= phaseOutStart  → full max reduction (capped to avoid negative net)
 *   - phaseOutStart < salary <= phaseOutEnd → linear reduction from max to base
 *   - salary > phaseOutEnd    → base reduction (€2,000)
 */
export function calcTrabajoReduction(
  grossSalaryCents: number,
  otherIncomeCents: number,
  rules: TrabajoReductions,
): number {
  const maxCents = Math.round(rules.maxReduction * 100);
  const baseCents = Math.round(rules.baseReduction * 100);
  const phaseOutStartCents = Math.round(rules.phaseOutStart * 100);
  const phaseOutEndCents = Math.round(rules.phaseOutEnd * 100);

  let reductionCents: number;

  if (grossSalaryCents <= phaseOutStartCents) {
    // Full reduction, but cannot exceed net salary (salary minus other income)
    reductionCents = Math.min(maxCents, grossSalaryCents - otherIncomeCents);
  } else if (grossSalaryCents <= phaseOutEndCents) {
    // Linear phase-out: from maxCents down to baseCents
    const range = phaseOutEndCents - phaseOutStartCents;
    const excess = grossSalaryCents - phaseOutStartCents;
    reductionCents = Math.round(maxCents - ((maxCents - baseCents) * excess) / range);
  } else {
    reductionCents = baseCents;
  }

  return Math.max(0, reductionCents);
}
