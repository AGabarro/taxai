/**
 * Smoke tests for all 15 remaining autonomías (Phase 3).
 * Two cases per region: a low-mid earner and a high earner.
 * Tests verify the engine loads the rules and produces structurally correct output —
 * resultAmount == cuotaLiquidaTOTAL - retenciones and resultType is set correctly.
 */
import { describe, it, expect } from 'vitest';
import { calculate } from '../src/calculator.js';
import type { TaxInput, SpanishRegion } from '@taxai/shared';

const regions: SpanishRegion[] = [
  'andalusia', 'aragon', 'asturias', 'balearics', 'canarias', 'cantabria',
  'castilla-la-mancha', 'castilla-leon', 'extremadura', 'galicia',
  'la-rioja', 'murcia', 'navarra', 'pais-vasco', 'valenciana',
];

function makeInput(region: SpanishRegion, grossSalary: number, retenciones: number): TaxInput {
  return {
    fiscalYear: 2024,
    region,
    age: 35,
    grossSalary,
    retenciones,
    dependentsUnder25: 0,
    dependentsOver65: 0,
    civilStatus: 'single',
  };
}

describe('All 15 additional autonomías — structural correctness', () => {
  for (const region of regions) {
    describe(region, () => {
      it('low-mid earner (€25,000)', () => {
        const r = calculate(makeInput(region, 25000, 3000));
        // Structural checks
        expect(r.region).toBe(region);
        expect(r.fiscalYear).toBe(2024);
        expect(r.grossSalary).toBe(25000);
        // Math consistency
        expect(Math.round(r.resultAmount * 100)).toBe(
          Math.round((r.cuotaLiquidaTOTAL - r.retenciones) * 100),
        );
        expect(r.cuotaLiquidaTOTAL).toBeGreaterThanOrEqual(0);
        expect(r.cuotaIntegraTOTAL).toBeGreaterThanOrEqual(r.cuotaLiquidaTOTAL);
        // resultType consistency
        if (r.resultAmount > 0) expect(r.resultType).toBe('a_ingresar');
        else if (r.resultAmount < 0) expect(r.resultType).toBe('a_devolver');
        else expect(r.resultType).toBe('cero');
      });

      it('high earner (€90,000)', () => {
        const r = calculate(makeInput(region, 90000, 20000));
        expect(r.region).toBe(region);
        expect(Math.round(r.resultAmount * 100)).toBe(
          Math.round((r.cuotaLiquidaTOTAL - r.retenciones) * 100),
        );
        expect(r.cuotaLiquidaTOTAL).toBeGreaterThan(0);
        expect(r.waterfallSteps.length).toBeGreaterThan(3);
      });
    });
  }
});
