import { describe, it, expect, vi } from 'vitest';

// pdf-parse (and its pdfjs-dist dependency) requires browser globals at module load time.
// Mock it before importing any route module that transitively loads it.
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({ text: '' }),
}));

// Also mock @fastify/multipart and @taxai/ai-layer so the route file can be imported cleanly.
vi.mock('@fastify/multipart', () => ({ default: vi.fn() }));
vi.mock('@taxai/ai-layer', () => ({ parseNomina: vi.fn().mockResolvedValue({}) }));
vi.mock('@taxai/engine', () => ({ calculate: vi.fn() }));

import {
  annualise,
  detectProration,
  deriveAnnualGross,
  deriveAnnualRetenciones,
  deriveAnnualSS,
  buildComparison,
} from '../src/routes/parse-nomina.js';
import type { NominaData } from '@taxai/shared';

// ── detectProration ──────────────────────────────────────────────────────────

describe('detectProration', () => {
  // Positive cases — payslips where extra pay is already spread across 12 months
  it('detects "P.P. Extras" (exact label, common in Sage/A3)', () => {
    expect(detectProration('DEVENGOS\nSalario Base 2000\nP.P. Extras 300\nTotal 2300')).toBe(true);
  });

  it('detects "P.P.Extras" without spaces', () => {
    expect(detectProration('P.P.Extras 250,00')).toBe(true);
  });

  it('detects "PP Extras" without dots', () => {
    expect(detectProration('PP Extras 300.00')).toBe(true);
  });

  it('detects "Prorrateo" keyword', () => {
    expect(detectProration('Prorrateo pagas extras 250,00')).toBe(true);
  });

  it('detects "prorrat." abbreviation (case-insensitive)', () => {
    expect(detectProration('Paga Verano prorrat. 350')).toBe(true);
  });

  it('detects "P.P. Paga Verano"', () => {
    expect(detectProration('Concepto: P.P. Paga Verano  Importe: 298,34')).toBe(true);
  });

  it('detects "P.P. Paga Navidad"', () => {
    expect(detectProration('P.P. Paga Navidad 298,34')).toBe(true);
  });

  it('detects "Extra prorr" pattern', () => {
    expect(detectProration('Paga Extra prorr 250,00')).toBe(true);
  });

  // Negative cases — payslips with separate extra-pay months (not prorated)
  it('returns false for a regular payslip with no proration markers', () => {
    expect(detectProration('Salario Base 2000\nComplementos 300\nTotal Devengado 2300')).toBe(false);
  });

  it('returns false for an actual separate extra-pay payslip', () => {
    expect(detectProration('PERIODO: Paga de Navidad Diciembre 2025\nSalario Base 2000')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(detectProration('')).toBe(false);
  });
});

// ── annualise ────────────────────────────────────────────────────────────────

describe('annualise', () => {
  it('defaults to 12 payments', () => {
    expect(annualise(1000)).toBe(12000);
  });

  it('uses numberOfPayments when provided', () => {
    expect(annualise(1000, 14)).toBe(14000);
  });

  it('rounds to cents to avoid floating-point drift', () => {
    // 356.5 × 12 = 4278.00 (exact)
    expect(annualise(356.5)).toBe(4278);
  });

  it('handles zero', () => {
    expect(annualise(0)).toBe(0);
  });
});

// ── deriveAnnualGross ────────────────────────────────────────────────────────

describe('deriveAnnualGross', () => {
  it('prefers annualGross when present', () => {
    const nomina: NominaData = { annualGross: 30000, monthlyGross: 2300 };
    expect(deriveAnnualGross(nomina)).toBe(30000);
  });

  it('annualises monthlyGross × 12 by default', () => {
    const nomina: NominaData = { monthlyGross: 2300 };
    expect(deriveAnnualGross(nomina)).toBe(27600);
  });

  it('annualises monthlyGross × 14 when numberOfPayments is 14', () => {
    const nomina: NominaData = { monthlyGross: 2300, numberOfPayments: 14 };
    expect(deriveAnnualGross(nomina)).toBe(32200);
  });

  it('returns 0 when no gross data is available', () => {
    const nomina: NominaData = {};
    expect(deriveAnnualGross(nomina)).toBe(0);
  });

  it('returns 0 when annualGross is 0', () => {
    const nomina: NominaData = { annualGross: 0 };
    expect(deriveAnnualGross(nomina)).toBe(0);
  });
});

// ── deriveAnnualRetenciones ──────────────────────────────────────────────────

describe('deriveAnnualRetenciones', () => {
  it('prefers annualRetenciones when present', () => {
    const nomina: NominaData = { annualRetenciones: 5250, monthlyRetenciones: 437.5 };
    expect(deriveAnnualRetenciones(nomina)).toBe(5250);
  });

  it('annualises monthlyRetenciones × 12 by default', () => {
    const nomina: NominaData = { monthlyRetenciones: 356.5 };
    expect(deriveAnnualRetenciones(nomina)).toBe(4278);
  });

  it('annualises monthlyRetenciones × 14 when numberOfPayments is 14', () => {
    const nomina: NominaData = { monthlyRetenciones: 356.5, numberOfPayments: 14 };
    expect(deriveAnnualRetenciones(nomina)).toBe(4991);
  });

  it('falls back to percentage × annualGross when only percentage is known', () => {
    const nomina: NominaData = { retentionPercentage: 15, monthlyGross: 2000 };
    // annual = 24000, 15% of 24000 = 3600
    expect(deriveAnnualRetenciones(nomina)).toBe(3600);
  });

  it('returns 0 when no retention data is available', () => {
    const nomina: NominaData = {};
    expect(deriveAnnualRetenciones(nomina)).toBe(0);
  });
});

// ── deriveAnnualSS ───────────────────────────────────────────────────────────

describe('deriveAnnualSS', () => {
  it('sums SS breakdown fields and annualises by 12', () => {
    const nomina: NominaData = {
      monthlySS_CC: 140.00,
      monthlySS_MEI: 0.51,
      monthlySS_unemployment: 11.58,
      monthlySS_vocational: 0.60,
    };
    // monthly total = 152.69, × 12 = 1832.28
    expect(deriveAnnualSS(nomina)).toBe(1832.28);
  });

  it('annualises SS breakdown × 14 when numberOfPayments is 14', () => {
    const nomina: NominaData = {
      monthlySS_CC: 140.00,
      monthlySS_MEI: 0.51,
      monthlySS_unemployment: 11.58,
      monthlySS_vocational: 0.60,
      numberOfPayments: 14,
    };
    // monthly total = 152.69, × 14 = 2137.66
    expect(deriveAnnualSS(nomina)).toBe(2137.66);
  });

  it('falls back to monthlySSEmployee when no breakdown present', () => {
    const nomina: NominaData = { monthlySSEmployee: 154.88 };
    expect(deriveAnnualSS(nomina)).toBe(1858.56);
  });

  it('prefers breakdown over monthlySSEmployee when both present', () => {
    const nomina: NominaData = {
      monthlySS_CC: 140.00,
      monthlySSEmployee: 999.99, // should be ignored
    };
    expect(deriveAnnualSS(nomina)).toBe(1680); // 140 × 12 only
  });

  it('returns 0 when no SS data', () => {
    expect(deriveAnnualSS({})).toBe(0);
  });
});

// ── proration + annualisation integration ────────────────────────────────────

describe('prorated payslip annualisation', () => {
  it('produces correct annual figures when proration overrides numberOfPayments to 12', () => {
    // Scenario from real payslip: monthly gross 4,598.17 with P.P. Extras line item
    const nomina: NominaData = {
      monthlyGross: 4598.17,
      monthlyRetenciones: 1038.78,
      monthlySSEmployee: 293.38,
      numberOfPayments: 12,   // proration already applied by route override
    };

    expect(deriveAnnualGross(nomina)).toBe(55178.04);       // 4598.17 × 12
    expect(deriveAnnualRetenciones(nomina)).toBe(12465.36); // 1038.78 × 12
    expect(deriveAnnualSS(nomina)).toBe(3520.56);           // 293.38  × 12
  });

  it('would over-estimate by 16.7% if 14 were used instead of 12', () => {
    const nomina: NominaData = { monthlyGross: 4598.17, numberOfPayments: 14 };
    const wrong = deriveAnnualGross(nomina);   // 64,374.38 — incorrect
    const correct = deriveAnnualGross({ ...nomina, numberOfPayments: 12 }); // 55,178.04
    expect(wrong).toBeGreaterThan(correct);
    expect(Math.round((wrong / correct - 1) * 100)).toBe(17); // ~17% overestimate
  });
});

// ── buildComparison ──────────────────────────────────────────────────────────

describe('buildComparison', () => {
  it('classifies as correct when difference is within 2%', () => {
    // calculatedTax=5000, retenciones=5050 → diff=50, 50/5000=1% → correct
    const result = buildComparison(5000, 5050);
    expect(result.diffType).toBe('correct');
    expect(result.difference).toBe(50);
    expect(result.calculatedTax).toBe(5000);
    expect(result.retencionesFromNomina).toBe(5050);
  });

  it('classifies as overpaid when employer withheld more than 2% extra', () => {
    // calculatedTax=5000, retenciones=6000 → diff=1000, 20% → overpaid
    const result = buildComparison(5000, 6000);
    expect(result.diffType).toBe('overpaid');
    expect(result.difference).toBe(1000);
    expect(result.percentageDiff).toBe(20);
  });

  it('classifies as underpaid when employer withheld more than 2% less', () => {
    // calculatedTax=5000, retenciones=4000 → diff=-1000, 20% → underpaid
    const result = buildComparison(5000, 4000);
    expect(result.diffType).toBe('underpaid');
    expect(result.difference).toBe(-1000);
    expect(result.percentageDiff).toBe(20);
  });

  it('handles exact match as correct', () => {
    const result = buildComparison(4278, 4278);
    expect(result.diffType).toBe('correct');
    expect(result.difference).toBe(0);
    expect(result.percentageDiff).toBe(0);
  });

  it('handles zero calculatedTax without division by zero', () => {
    const result = buildComparison(0, 100);
    expect(result.percentageDiff).toBe(0);
  });

  it('rounds difference to cents', () => {
    // 4278.339 - 4278 = 0.339 → rounded to 0.34
    const result = buildComparison(4278, 4278.339);
    expect(result.difference).toBe(0.34);
  });
});
