import { describe, it, expect } from 'vitest';
import { calculate } from '../src/calculator.js';
import type { TaxInput } from '@taxai/shared';

const BASE: TaxInput = {
  fiscalYear: 2024,
  region: 'madrid',
  age: 35,
  grossSalary: 0,
  retenciones: 0,
  dependentsUnder25: 0,
  dependentsOver65: 0,
  civilStatus: 'single',
};

describe('Edge cases', () => {
  it('salary = 0 produces no tax and cero result', () => {
    const r = calculate({ ...BASE, grossSalary: 0 });
    expect(r.cuotaLiquidaTOTAL).toBe(0);
    expect(r.resultType).toBe('cero');
    expect(r.resultAmount).toBe(0);
  });

  it('very high earner (€500,000) — above all bracket tops', () => {
    const r = calculate({ ...BASE, grossSalary: 500000, retenciones: 0 });
    expect(r.cuotaLiquidaTOTAL).toBeGreaterThan(80000);
    expect(r.resultType).toBe('a_ingresar');
    expect(r.resultAmount).toBeGreaterThan(0);
  });

  it('disability grade 33 — included in result without crashing', () => {
    const r = calculate({ ...BASE, grossSalary: 30000, disability: 33 });
    expect(r.fiscalYear).toBe(2024);
    expect(r.cuotaLiquidaTOTAL).toBeGreaterThanOrEqual(0);
  });

  it('disability grade 65 — included in result without crashing', () => {
    const r = calculate({ ...BASE, grossSalary: 30000, disability: 65 });
    expect(r.fiscalYear).toBe(2024);
  });

  it('multiple dependents (4 children + 2 elderly) — minimum is correct', () => {
    const r = calculate({
      ...BASE,
      grossSalary: 60000,
      dependentsUnder25: 4,
      dependentsOver65: 2,
    });
    // 4 children: 2400 + 2700 + 4000 + 4000 = 13100
    // 2 elderly: 1125 * 2 = 2250
    // personal base: 5550
    // total: 5550 + 13100 + 2250 = 20900
    expect(r.minimumPersonalFamiliar).toBe(20900);
  });

  it('age 75+ — maximum personal minimum', () => {
    const r = calculate({ ...BASE, grossSalary: 20000, age: 76 });
    // 5550 + 1150 + 1400 = 8100
    expect(r.minimumPersonalFamiliar).toBe(8100);
  });

  it('retenciones exceed tax — a_devolver', () => {
    const r = calculate({ ...BASE, grossSalary: 30000, retenciones: 50000 });
    expect(r.resultType).toBe('a_devolver');
    expect(r.resultAmount).toBeLessThan(0);
  });

  it('waterfall steps sum to result amount', () => {
    const r = calculate({ ...BASE, grossSalary: 45000, retenciones: 7000 });
    const last = r.waterfallSteps[r.waterfallSteps.length - 1]!;
    expect(Math.round(last.runningTotal * 100)).toBe(Math.round(r.resultAmount * 100));
  });
});
