import type { Bracket } from './types.js';

/**
 * Applies progressive tax brackets to a base amount.
 * All amounts in cents. Rounds at each bracket boundary to prevent floating-point drift.
 */
export function applyBrackets(baseCents: number, brackets: Bracket[]): number {
  let taxCents = 0;

  for (const bracket of brackets) {
    const fromCents = Math.round(bracket.from * 100);
    const toCents = bracket.to !== null ? Math.round(bracket.to * 100) : Number.MAX_SAFE_INTEGER;
    const sliceCents = Math.max(0, Math.min(baseCents, toCents) - fromCents);

    if (sliceCents <= 0) continue;

    taxCents += Math.round(sliceCents * bracket.rate);
  }

  return taxCents;
}
