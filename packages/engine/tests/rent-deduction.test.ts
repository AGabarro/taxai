import { describe, it, expect } from 'vitest';
import { calcRentDeduction } from '../src/deductions/rent.js';
import type { RentDeductionRule } from '../src/types.js';
import type { TaxInput } from '@taxai/shared';

const cataloniaRule: RentDeductionRule = {
  rate: 0.10,
  capGeneral: 300,
  capEnhanced: 600,
  incomeCeilingIndividual: 20000,
  incomeCeilingJoint: 30000,
  enhancedConditions: ['under36', 'disability', 'largefamily', 'unemployed6m'],
  notes: 'under36 means age ≤ 32 in Catalonia',
};

const andalusiaRule: RentDeductionRule = {
  rate: 0.15,
  capGeneral: 500,
  capEnhanced: 500,
  incomeCeilingIndividual: 19000,
  incomeCeilingJoint: 24000,
  enhancedConditions: ['under36', 'disability', 'largefamily'],
};

const asturiasRule: RentDeductionRule = {
  rate: 0.10,
  capGeneral: 455,
  capEnhanced: 910,
  incomeCeilingIndividual: 25009,
  incomeCeilingJoint: 35240,
  enhancedConditions: ['largefamily', 'disability'],
};

const valenciaRule: RentDeductionRule = {
  rate: 0.15,
  capGeneral: 550,
  capEnhanced: 700,
  incomeCeilingIndividual: 30000,
  incomeCeilingJoint: 30000,
  enhancedConditions: ['disability', 'largefamily'],
};

function rentPayments(overrides: Partial<TaxInput['rentPayments']> = {}): TaxInput['rentPayments'] {
  return {
    annualRentPaid: 0,
    isUnder36: false,
    hasDisability: false,
    isLargeFamily: false,
    isUnemployed6Months: false,
    contractBefore2015: false,
    ...overrides,
  };
}

describe('calcRentDeduction', () => {
  it('Catalonia: €800/month rent, under 32 (under36), income €18,000 → €600 deduction (enhanced cap)', () => {
    const rent = rentPayments({ annualRentPaid: 9600, isUnder36: true });
    // 10% × 9600 = 960 → capped at enhanced cap 600 → 60000 cents
    const result = calcRentDeduction(cataloniaRule, rent, 18000);
    expect(result).toBe(60000); // €600 in cents
  });

  it('Catalonia: €800/month rent, age 40, no special conditions → €300 deduction (general cap)', () => {
    const rent = rentPayments({ annualRentPaid: 9600, isUnder36: false });
    // 10% × 9600 = 960 → capped at general cap 300 → 30000 cents
    const result = calcRentDeduction(cataloniaRule, rent, 18000);
    expect(result).toBe(30000); // €300 in cents
  });

  it('Andalusia: €600/month rent, under 36, income €17,000 → €500 deduction (capped at general = enhanced)', () => {
    const rent = rentPayments({ annualRentPaid: 7200, isUnder36: true });
    // 15% × 7200 = 1080 → capped at capEnhanced 500 → 50000 cents
    const result = calcRentDeduction(andalusiaRule, rent, 17000);
    expect(result).toBe(50000); // €500 in cents
  });

  it('Madrid: any inputs → €0 deduction (null rule)', () => {
    const rent = rentPayments({ annualRentPaid: 12000, isUnder36: true });
    const result = calcRentDeduction(null, rent, 18000);
    expect(result).toBe(0);
  });

  it('Asturias: income above ceiling → €0 deduction', () => {
    const rent = rentPayments({ annualRentPaid: 9600, isLargeFamily: true });
    // income 30000 > ceiling 25009 → no deduction
    const result = calcRentDeduction(asturiasRule, rent, 30000);
    expect(result).toBe(0);
  });

  it('Valencia: large family → €700 enhanced cap applied', () => {
    const rent = rentPayments({ annualRentPaid: 12000, isLargeFamily: true });
    // 15% × 12000 = 1800 → capped at capEnhanced 700 → 70000 cents
    const result = calcRentDeduction(valenciaRule, rent, 25000);
    expect(result).toBe(70000); // €700 in cents
  });

  it('returns 0 when rentPayments is undefined', () => {
    const result = calcRentDeduction(cataloniaRule, undefined, 18000);
    expect(result).toBe(0);
  });

  it('returns 0 when annualRentPaid is 0', () => {
    const rent = rentPayments({ annualRentPaid: 0 });
    const result = calcRentDeduction(cataloniaRule, rent, 18000);
    expect(result).toBe(0);
  });

  it('Catalonia: small rent → deduction is 10% × rent (no cap hit)', () => {
    const rent = rentPayments({ annualRentPaid: 1000 });
    // 10% × 1000 = 100 → no cap hit → 10000 cents
    const result = calcRentDeduction(cataloniaRule, rent, 15000);
    expect(result).toBe(10000); // €100 in cents
  });
});
