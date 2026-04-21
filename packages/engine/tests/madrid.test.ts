import { describe, it, expect } from 'vitest';
import { calculate } from '../src/calculator.js';
import type { TaxInput } from '@taxai/shared';

const BASE: Omit<TaxInput, 'grossSalary' | 'retenciones' | 'age' | 'dependentsUnder25' | 'dependentsOver65' | 'civilStatus'> = {
  fiscalYear: 2025,
  region: 'madrid',
};

describe('Madrid 2025 — parity tests', () => {
  it('case 1: €20,000 salary, age 30, single, no deps', () => {
    const input: TaxInput = {
      ...BASE,
      grossSalary: 20000,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 2400,
    };
    const r = calculate(input);
    // rnt = 20000 - 2000 = 18000; segment 2: 2364.34 - 1.14*(18000-17673.52) = 1992.15
    // total reduction = 3992.15; rendNeto = 16007.85
    expect(r.rendimientoNetoReducido).toBe(16007.85);
    expect(r.baseImponibleGeneral).toBe(16007.85);
    expect(r.minimumPersonalFamiliar).toBe(5550);
    expect(r.cuotaLiquidaTOTAL).toBe(2029.57);
    expect(r.resultAmount).toBe(-370.43);
    expect(r.resultType).toBe('a_devolver');
  });

  it('case 2: €35,000 salary, age 30, single, no deps', () => {
    const input: TaxInput = {
      ...BASE,
      grossSalary: 35000,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 5250,
    };
    const r = calculate(input);
    // rnt = 33000 > 19747.50 → no reducción; total reduction = gastoFlat 2000
    expect(r.rendimientoNetoReducido).toBe(33000);
    expect(r.baseImponibleGeneral).toBe(33000);
    expect(r.cuotaLiquidaTOTAL).toBe(6585.70);
    expect(r.resultAmount).toBe(1335.70);
    expect(r.resultType).toBe('a_ingresar');
  });

  it('case 3: €50,000 salary, age 40, married, 1 dep <25', () => {
    const input: TaxInput = {
      ...BASE,
      grossSalary: 50000,
      age: 40,
      civilStatus: 'married',
      dependentsUnder25: 1,
      dependentsOver65: 0,
      retenciones: 9000,
    };
    const r = calculate(input);
    expect(r.minimumPersonalFamiliar).toBe(7950);
    expect(r.cuotaLiquidaTOTAL).toBe(11350.15);
    expect(r.resultAmount).toBe(2350.15);
    expect(r.resultType).toBe('a_ingresar');
  });

  it('case 4: €80,000 salary, age 45, single, no deps', () => {
    const input: TaxInput = {
      ...BASE,
      grossSalary: 80000,
      age: 45,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 22000,
    };
    const r = calculate(input);
    expect(r.cuotaLiquidaTOTAL).toBe(23913.23);
    expect(r.resultAmount).toBe(1913.23);
    expect(r.resultType).toBe('a_ingresar');
  });

  it('case 5: €12,000 salary, age 67, single, no deps (minimum exceeds tax)', () => {
    const input: TaxInput = {
      ...BASE,
      grossSalary: 12000,
      age: 67,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    };
    const r = calculate(input);
    expect(r.minimumPersonalFamiliar).toBe(6700);
    expect(r.cuotaLiquidaTOTAL).toBe(0);
    expect(r.resultAmount).toBe(0);
    expect(r.resultType).toBe('cero');
  });
});
