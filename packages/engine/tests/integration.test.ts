/**
 * Integration tests — IRPF 2025 fiscal accuracy
 *
 * Expected values are derived from:
 *   1. Official AEAT bracket tables (Ley 35/2006 + Ley 5/2025 modifications)
 *      https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/
 *   2. The new cuota deduction rules (Ley 5/2025, Art. 80 bis LIRPF):
 *      rendimientos ≤ €16,576 → deduction €340 (capped at cuota íntegra)
 *      €16,576 < rendimientos ≤ €18,276 → deduction = 340 − [0.2 × (rentas − 16,576)]
 *      rendimientos > €18,276 → deduction = 0
 *   3. The 2025 trabajo reduction (Ley 5/2025):
 *      rnt ≤ €14,852 → €7,302
 *      €14,852 < rnt ≤ €17,673.52 → 7,302 − [1.75 × (rnt − 14,852)]
 *      €17,673.52 < rnt < €19,747.50 → 2,364.34 − [1.14 × (rnt − 17,673.52)]
 *      rnt ≥ €19,747.50 → €0
 *
 * IMPORTANT: this engine takes grossSalary as the rendimientos íntegros del trabajo.
 * It deducts €2,000 gastos fijos but does NOT deduct SS contributions (cotizaciones
 * a la Seguridad Social). Real taxpayers subtract SS before computing rnt; the official
 * AEAT examples include SS. Tests here use pre-SS-deducted inputs to isolate bracket and
 * reduction logic.
 *
 * All cent arithmetic was verified manually against the official scales.
 */

import { describe, it, expect } from 'vitest';
import { calculate } from '../src/calculator.js';
import type { TaxInput } from '@taxai/shared';

// ─── helpers ────────────────────────────────────────────────────────────────

const MADRID_BASE: Omit<
  TaxInput,
  'grossSalary' | 'retenciones' | 'age' | 'dependentsUnder25' | 'dependentsOver65' | 'civilStatus'
> = { fiscalYear: 2025, region: 'madrid' };

// ─── BLOCK 1: Ley 5/2025 cuota deduction ────────────────────────────────────

describe('Ley 5/2025 deducción por rendimientos del trabajo', () => {
  /**
   * Case: grossSalary €16,000 (≤ €16,576 threshold)
   *
   * Calculation (all in cents internally):
   *   gastoFlat = 2,000
   *   rnt = 16,000 − 2,000 = 14,000 ≤ 14,852 → reducción trabajo = 7,302
   *   rendimientoNetoReducido = 16,000 − 9,302 = 6,698
   *   base = 6,698
   *
   *   State brackets (0−12,450 @ 9.5%): 6,698 × 0.095 = 636.31
   *   State mínimo  (5,550 @ 9.5%)    : 5,550 × 0.095 = 527.25
   *   cuotaLiquidaEstatal (pre-ded)   = 636.31 − 527.25 = 109.06
   *
   *   Madrid brackets (0−13,362 @ 8.5%): 6,698 × 0.085 = 569.33
   *   Madrid mínimo  (5,550 @ 8.5%)   : 5,550 × 0.085 = 471.75
   *   cuotaLiquidaAutonomica (pre-ded) = 569.33 − 471.75 = 97.58
   *
   *   Cuota total before deduction = 109.06 + 97.58 = 206.64
   *   Deduction: 16,000 ≤ 16,576 → full €340
   *   Applied = min(170, 109.06) + min(170, 97.58) = 109.06 + 97.58 = 206.64 (capped at cuota)
   *   cuotaLiquidaTOTAL = 0.00
   *
   * Pattern: AEAT Manual Práctico Renta 2025 §18.4, Example 1 (Doña LMP) —
   * low earners at/below SMI see their full cuota zeroed by this new deduction.
   */
  it('€16,000 salary — deduction caps at cuota → cuotaLíquida = 0', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 16_000,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });

    expect(r.rendimientoNetoReducido).toBe(6698);
    expect(r.minimumPersonalFamiliar).toBe(5550);
    expect(r.cuotaIntegraEstatal).toBe(636.31);
    expect(r.cuotaIntegraAutonomica).toBe(569.33);
    expect(r.cuotaLiquidaTOTAL).toBe(0);
    expect(r.resultType).toBe('cero');
  });

  it('€16,000 salary with retenciones → full refund', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 16_000,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 1_200,
    });

    expect(r.cuotaLiquidaTOTAL).toBe(0);
    expect(r.resultAmount).toBe(-1_200);
    expect(r.resultType).toBe('a_devolver');
  });

  /**
   * Case: grossSalary €17,500 (between €16,576 and €18,276 — phase-out range)
   *
   *   rnt = 17,500 − 2,000 = 15,500; 14,852 < 15,500 ≤ 17,673.52 → segment 1:
   *   reducción = 7,302 − 1.75 × (15,500 − 14,852) = 7,302 − 1,134 = 6,168
   *   rendimientoNetoReducido = 17,500 − 8,168 = 9,332
   *
   *   State: 9,332 × 9.5% = 886.54 ; mínimo 527.25 ; cuotaLiqEstatal = 359.29
   *   Madrid: 9,332 × 8.5% = 793.22 ; mínimo 471.75 ; cuotaLiqAuto = 321.47
   *   Total before deduction = 680.76
   *
   *   Deduction = 340 − 0.2 × (17,500 − 16,576) = 340 − 184.80 = 155.20
   *   Applied (50/50): 77.60 from each half → total 155.20
   *   cuotaLiquidaTOTAL = 680.76 − 155.20 = 525.56
   */
  it('€17,500 salary — partial deduction €155.20 (phase-out range)', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 17_500,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 2_000,
    });

    expect(r.rendimientoNetoReducido).toBe(9332);
    expect(r.cuotaLiquidaTOTAL).toBe(525.56);
    expect(r.resultAmount).toBe(-1474.44);
    expect(r.resultType).toBe('a_devolver');
  });

  /**
   * Case: grossSalary €19,000 (> €18,276 — above phase-out, zero deduction)
   *
   *   rnt = 19,000 − 2,000 = 17,000; 14,852 < 17,000 ≤ 17,673.52 → segment 1:
   *   reducción = 7,302 − 1.75 × (17,000 − 14,852) = 7,302 − 3,759 = 3,543
   *   rendimientoNetoReducido = 19,000 − 5,543 = 13,457
   *
   *   State: 12,450 × 9.5% + 1,007 × 12% = 1,182.75 + 120.84 = 1,303.59
   *   mínimo 527.25 → cuotaLiqEstatal = 776.34
   *
   *   Madrid: 13,362 × 8.5% + (13,457 − 13,362) × 10.7%
   *         = 1,135.77 + 95 × 0.107 = 1,135.77 + 10.17 = 1,145.94
   *   mínimo 471.75 → cuotaLiqAuto = 674.19
   *
   *   cuotaLiquidaTOTAL = 776.34 + 674.19 = 1,450.53
   *   Deduction: 19,000 > 18,276 → €0
   */
  it('€19,000 salary — above €18,276 threshold, deduction = 0', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 19_000,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 1_500,
    });

    expect(r.rendimientoNetoReducido).toBe(13457);
    expect(r.cuotaLiquidaTOTAL).toBe(1450.53);
    expect(r.resultAmount).toBe(-49.47);
    expect(r.resultType).toBe('a_devolver');
  });
});

// ─── BLOCK 2: State bracket computation — AEAT official values ───────────────

describe('State bracket computation — AEAT Manual Práctico Renta 2025 verified', () => {
  /**
   * AEAT source: Manual Práctico Renta 2025, Capítulo 15 — Ejemplo práctico
   * https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/
   *   manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/
   *   ejemplo-practico-calculo-cuotas-integras-autonomica.html
   *
   * Official AEAT computation for STATE brackets on base liquidable = €23,900:
   *   "Hasta 20.200 = 2.112,75"
   *   "Resto: 3.700 al 15% = 555"
   *   "Cuota 1 resultante = 2.112,75 + 555 = 2.667,75"
   *   Mínimo personal: "5.550 al 9,50% = 527,25"
   *   Cuota íntegra estatal (general, net) = 2.667,75 − 527,25 = 2.140,50
   *
   * We derive grossSalary = €25,900 so that after the €2,000 gasto deduction
   * (rnt = 23,900 > 19,747.50 → trabajoReducción = 0), rendimientoNetoReducido = 23,900.
   *
   * NOTE: this example includes €2,800 ahorro base which our engine does not model.
   * The state bracket numbers below refer to the general base only.
   */
  it('Aragón €25,900 — state cuota íntegra and líquida match AEAT official values', () => {
    const r = calculate({
      fiscalYear: 2025,
      region: 'aragon',
      grossSalary: 25_900,
      age: 40,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });

    // AEAT official: cuota íntegra estatal on base 23,900 = 2,667.75
    expect(r.rendimientoNetoReducido).toBe(23_900);
    expect(r.cuotaIntegraEstatal).toBe(2_667.75);

    // AEAT official: state mínimo = 527.25 → net = 2,140.50
    expect(r.cuotaLiquidaEstatal).toBe(2_140.50);
  });
});

// ─── BLOCK 3: Mínimo por descendientes + suplemento bajo 3 años ─────────────

describe('Mínimo personal y familiar — descendientes', () => {
  /**
   * Art. 58 LIRPF (mínimo por descendientes) + Ley 5/2025 supplement:
   *   1st child < 25: €2,400
   *   Supplement if child < 3: +€2,800 (updated Ley 5/2025)
   *   Total mínimo = 5,550 + 2,400 + 2,800 = 10,750
   *
   * grossSalary = €30,000:
   *   rnt = 30,000 − 2,000 = 28,000 > 19,747.50 → reducción = 0
   *   rendimientoNetoReducido = 28,000
   *
   *   State: 12,450×9.5% + 7,750×12% + 7,800×15% = 1,182.75+930+1,170 = 3,282.75
   *   State mínimo (10,750 @ 9.5%): 10,750 × 9.5% = 1,021.25
   *   cuotaLiqEstatal = 3,282.75 − 1,021.25 = 2,261.50
   *
   *   Madrid: 13,362×8.5% + 4,642×10.7% + 9,996×12.8%
   *         = 1,135.77 + 496.69 + 1,279.49 = 2,911.95
   *   Madrid mínimo (10,750 @ 8.5%): 10,750 × 8.5% = 913.75
   *   cuotaLiqAuto = 2,911.95 − 913.75 = 1,998.20
   *
   *   cuotaLiquidaTOTAL = 2,261.50 + 1,998.20 = 4,259.70
   *   No deduction (grossSalary >> €18,276)
   */
  it('€30,000 Madrid, 1 child under 3 — mínimo €10,750, cuota correct', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 30_000,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 1,
      dependentsUnder3: 1,
      dependentsOver65: 0,
      retenciones: 4_500,
    });

    expect(r.rendimientoNetoReducido).toBe(28_000);
    expect(r.minimumPersonalFamiliar).toBe(10_750);
    expect(r.cuotaLiquidaTOTAL).toBe(4_259.70);
    expect(r.resultAmount).toBe(-240.30);
    expect(r.resultType).toBe('a_devolver');
  });

  /**
   * 2 children (neither under 3):
   *   mínimo = 5,550 + 2,400 (1st) + 2,700 (2nd) = 10,650
   */
  it('€40,000 Madrid, 2 children — mínimo €10,650', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 40_000,
      age: 35,
      civilStatus: 'married',
      dependentsUnder25: 2,
      dependentsOver65: 0,
      retenciones: 7_000,
    });

    expect(r.minimumPersonalFamiliar).toBe(10_650);
  });
});

// ─── BLOCK 4: Age-based mínimo personal ─────────────────────────────────────

describe('Mínimo personal — edad del contribuyente', () => {
  /**
   * Art. 57 LIRPF:
   *   General: €5,550
   *   Age 65–74: +€1,150 → €6,700
   *   Age ≥75:   +€1,400 additional → €8,100
   */
  it('age 67 → mínimo personal = €6,700', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 25_000,
      age: 67,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });
    expect(r.minimumPersonalFamiliar).toBe(6_700);
  });

  it('age 75 → mínimo personal = €8,100', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 25_000,
      age: 75,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });
    expect(r.minimumPersonalFamiliar).toBe(8_100);
  });
});

// ─── BLOCK 5: trabajo reduction boundary cases ───────────────────────────────

describe('Reducción rendimientos del trabajo — boundary cases', () => {
  /**
   * Exactly at the full-reduction threshold (rnt = 14,852):
   *   grossSalary = 14,852 + 2,000 = 16,852
   *   rnt = 16,852 − 2,000 = 14,852 ≤ 14,852 → full reduction €7,302
   *   rendimientoNetoReducido = 16,852 − 9,302 = 7,550
   */
  it('rnt exactly at €14,852 threshold → full €7,302 reduction', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 16_852,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });
    expect(r.rendimientoNetoReducido).toBe(7550);
  });

  /**
   * At the segment-1 / segment-2 boundary (rnt = 17,673.52):
   *   grossSalary = 17,673.52 + 2,000 = 19,673.52
   *   rnt = 17,673.52 → exactly at seg1End
   *   reducción = 7,302 − 1.75 × (17,673.52 − 14,852) = 7,302 − 1.75 × 2,821.52
   *             = 7,302 − 4,937.66 = 2,364.34  (= segment2BaseReduction)
   *   rendimientoNetoReducido = 19,673.52 − (2,000 + 2,364.34) = 15,309.18
   *   In integer cents: 19,673.52 → 1_967_352 cents
   *   rntCents = 1_967_352 − 200_000 = 1_767_352 = seg1EndCents (exactly)
   *   excess = 1_767_352 − 1_485_200 = 282_152
   *   reduccion = 730_200 − round(1.75 × 282_152) = 730_200 − round(493_766) = 730_200 − 493_766 = 236_434
   *   totalReduction = 200_000 + 236_434 = 436_434
   *   rendNeto = 1_967_352 − 436_434 = 1_530_918 → €15,309.18
   */
  it('rnt exactly at segment-1/2 boundary (€17,673.52) → reducción = €2,364.34', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 19_673.52,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });
    expect(r.rendimientoNetoReducido).toBe(15_309.18);
  });

  /**
   * At segment-2 end: rnt = 19,747.50 → reduction = 0
   *   grossSalary = 19,747.50 + 2,000 = 21,747.50
   *   rntCents = 2_174_750 − 200_000 = 1_974_750 = seg2EndCents
   *   condition: rnt < seg2End (strict) is NOT met → reduccion = 0
   *   totalReduction = 200_000 (gastoFlat only)
   *   rendimientoNetoReducido = 21,747.50 − 2,000 = 19,747.50
   */
  it('rnt at €19,747.50 (segment-2 end) → reduction = 0, gastoFlat only', () => {
    const r = calculate({
      ...MADRID_BASE,
      grossSalary: 21_747.50,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });
    expect(r.rendimientoNetoReducido).toBe(19_747.50);
  });
});

// ─── BLOCK 5: SS contributions as gastos deducibles (Art. 19 LIRPF) ──────────

describe('ssContributions — Art. 19 gastos deducibles', () => {
  /**
   * Employee SS contributions are "gastos deducibles" (Art. 19.2.a LIRPF).
   * They reduce the rendimiento íntegro BEFORE the Art. 20 trabajo reduction
   * thresholds are evaluated.
   *
   * Example: gross €30,000, SS €1,858.56 (typical ~6.35% of gross)
   *   grossAfterSS = 30,000 − 1,858.56 = 28,141.44
   *   rnt = 28,141.44 − 2,000 = 26,141.44 > 19,747.50 → reducción Art.20 = 0
   *   trabajoReduction = gastoFlat(2,000) + art20(0) = 2,000
   *   rendimientoNetoReducido = 28,141.44 − 2,000 = 26,141.44
   *
   * Without SS: rnt = 30,000 − 2,000 = 28,000 > threshold → reducción = 0
   *   rendimientoNetoReducido = 30,000 − 2,000 = 28,000.
   *
   * With SS:    rendimientoNetoReducido = 26,141.44  (lower → less tax).
   */
  it('SS reduces rendimientoNetoReducido and produces lower tax than without SS', () => {
    const base = {
      fiscalYear: 2025 as const,
      region: 'madrid' as const,
      age: 30,
      civilStatus: 'single' as const,
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    };

    const withoutSS = calculate({ ...base, grossSalary: 30_000 });
    const withSS    = calculate({ ...base, grossSalary: 30_000, ssContributions: 1_858.56 });

    // rendimientoNetoReducido = grossAfterSS − trabajoReduction(2000) = 26,141.44
    // without SS it's gross − 2000 = 28,000
    expect(withSS.rendimientoNetoReducido).toBeCloseTo(26_141.44, 1);
    expect(withoutSS.rendimientoNetoReducido).toBe(28_000);

    // Final tax with SS is lower than without (smaller taxable base)
    expect(withSS.cuotaLiquidaTOTAL).toBeLessThan(withoutSS.cuotaLiquidaTOTAL);
  });

  it('SS deduction shows in waterfall steps', () => {
    const r = calculate({
      fiscalYear: 2025,
      region: 'madrid',
      grossSalary: 30_000,
      ssContributions: 1_858.56,
      age: 30,
      civilStatus: 'single',
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    });

    const ssStep = r.waterfallSteps.find(s => s.label.includes('Seguridad Social'));
    expect(ssStep).toBeDefined();
    expect(ssStep!.amount).toBeCloseTo(-1_858.56, 1);
  });

  it('ssContributions = 0 gives identical result to omitting the field', () => {
    const base = {
      fiscalYear: 2025 as const,
      region: 'madrid' as const,
      grossSalary: 40_000,
      age: 35,
      civilStatus: 'single' as const,
      dependentsUnder25: 0,
      dependentsOver65: 0,
      retenciones: 0,
    };
    const r1 = calculate(base);
    const r2 = calculate({ ...base, ssContributions: 0 });
    expect(r1.cuotaLiquidaTOTAL).toBe(r2.cuotaLiquidaTOTAL);
  });
});

// ─── BLOCK 5: Base imponible del ahorro — Art. 46 & 49 LIRPF ─────────────────

describe('Base imponible del ahorro — capital gains, dividends, loss compensation', () => {
  /**
   * Common salary base for all savings tests:
   *   grossSalary = €35,000, Madrid 2025, single, age 35, no SS
   *   rnt = 35,000 − 2,000 = 33,000 > 19,747.50 → trabajoReduction = 0
   *   rendimientoNetoReducido = 33,000
   *   baseImponibleGeneral  = 33,000
   *   cuotaIntegraEstatal   = 12,450×9.5% + 7,750×12% + 12,800×15% = 4,032.75
   *   cuotaIntegraAutonomica (Madrid) = 13,362×8.5% + 4,642×10.7% + 14,996×12.8% = 3,551.95
   *   stateMinQuota (5,550×9.5%) = 527.25  → cuotaLiquidaEstatal   = 3,505.50
   *   madridMinQuota(5,550×8.5%) = 471.75  → cuotaLiquidaAutonomica = 3,080.20
   *   No 2025 cuota deduction (35,000 > 18,276)
   *   salary-only cuotaLiquidaTOTAL = 6,585.70
   *
   * Savings brackets (Art. 66 & 76 LIRPF — identical for state and regional halves):
   *   0–6,000 € @ 9.5% each half → 19% combined
   *   6,000–50,000 € @ 10.5% each half → 21% combined
   */

  const SALARY_BASE: Omit<TaxInput, 'retenciones' | 'savingsIncome'> = {
    fiscalYear: 2025,
    region: 'madrid',
    grossSalary: 35_000,
    age: 35,
    civilStatus: 'single',
    dependentsUnder25: 0,
    dependentsOver65: 0,
  };

  it('no savings income → baseImponibleAhorro = 0 and savings cuota = 0', () => {
    const r = calculate({ ...SALARY_BASE, retenciones: 0 });
    expect(r.baseImponibleAhorro).toBe(0);
    expect(r.cuotaIntegraAhorroEstatal).toBe(0);
    expect(r.cuotaIntegraAhorroAutonomica).toBe(0);
    expect(r.cuotaLiquidaAhorroEstatal).toBe(0);
    expect(r.cuotaLiquidaAhorroAutonomica).toBe(0);
    expect(r.cuotaLiquidaTOTAL).toBe(6_585.70);
  });

  it('capital gains €2,000 (within first bracket) → 19% combined rate, €380 extra tax', () => {
    /**
     * baseImponibleAhorro = 2,000
     * cuotaIntegraAhorroEstatal    = 2,000 × 9.5%  = 190.00
     * cuotaIntegraAhorroAutonomica = 2,000 × 9.5%  = 190.00
     * mínimo personal (5,550) is fully absorbed by general base — no overflow
     * cuotaLiquidaAhorro = 380.00 total
     * cuotaLiquidaTOTAL  = 6,585.70 + 380.00 = 6,965.70
     */
    const r = calculate({
      ...SALARY_BASE,
      retenciones: 0,
      savingsIncome: { capitalGains: 2_000 },
    });

    expect(r.baseImponibleAhorro).toBe(2_000);
    expect(r.cuotaIntegraAhorroEstatal).toBe(190);
    expect(r.cuotaIntegraAhorroAutonomica).toBe(190);
    expect(r.cuotaLiquidaAhorroEstatal).toBe(190);
    expect(r.cuotaLiquidaAhorroAutonomica).toBe(190);
    expect(r.cuotaLiquidaTOTAL).toBe(6_965.70);
  });

  it('capital gains €2,000 with 19% broker withholding → result identical to salary-only', () => {
    /**
     * Proving the "neutral withholding" property: when the broker withholds exactly
     * 19% on the gain and the gain is within the first €6,000 bracket (rate = 19%),
     * adding the savings income + matching retenciones changes the final result by €0.
     *
     * salary-only:   retenciones = 5,000; result = 6,585.70 − 5,000 = 1,585.70 (ingresar)
     * with savings:  retenciones = 5,380; result = 6,965.70 − 5,380 = 1,585.70 (ingresar)
     */
    const salaryOnly = calculate({ ...SALARY_BASE, retenciones: 5_000 });
    const withSavings = calculate({
      ...SALARY_BASE,
      retenciones: 5_380,     // 5,000 salary + 380 broker (19% of 2,000)
      savingsIncome: { capitalGains: 2_000 },
    });

    expect(salaryOnly.resultAmount).toBe(withSavings.resultAmount);
    expect(salaryOnly.resultType).toBe(withSavings.resultType);
  });

  it('capital gains €8,000 crossing €6,000 bracket → 21% on excess, effective rate > 19%', () => {
    /**
     * baseImponibleAhorro = 8,000
     * cuotaIntegraAhorroEstatal:
     *   0–6,000 @ 9.5%  = 570
     *   6,000–8,000 @ 10.5% = 210
     *   total state = 780
     * cuotaIntegraAhorroAutonomica = 780 (identical savings brackets)
     * cuotaLiquidaAhorro total = 1,560
     * Effective combined rate = 1,560 / 8,000 = 19.5%
     *
     * With a 19%-flat broker withholding (€1,520): net extra tax = 1,560 − 1,520 = €40 owed.
     */
    const r = calculate({
      ...SALARY_BASE,
      retenciones: 0,
      savingsIncome: { capitalGains: 8_000 },
    });

    expect(r.baseImponibleAhorro).toBe(8_000);
    expect(r.cuotaIntegraAhorroEstatal).toBe(780);
    expect(r.cuotaIntegraAhorroAutonomica).toBe(780);
    expect(r.cuotaLiquidaAhorroEstatal).toBe(780);
    expect(r.cuotaLiquidaAhorroAutonomica).toBe(780);
    expect(r.cuotaLiquidaTOTAL).toBe(6_585.70 + 1_560);

    // Broker withholds at flat 19% → user owes extra €40 because rate on €2,000 is actually 21%
    const withBrokerRetention = calculate({
      ...SALARY_BASE,
      retenciones: 5_000 + 1_520, // 5,000 salary + 1,520 broker (19% of 8,000)
      savingsIncome: { capitalGains: 8_000 },
    });
    const salaryOnly = calculate({ ...SALARY_BASE, retenciones: 5_000 });
    expect(withBrokerRetention.resultAmount - salaryOnly.resultAmount).toBeCloseTo(40, 1);
  });

  it('dividends €3,000 + interest €1,000 → combined savings base €4,000 @ 19%', () => {
    /**
     * capitalGains = 0 → no gain/loss, just passive income
     * baseImponibleAhorro = 3,000 + 1,000 = 4,000
     * cuotaIntegraAhorroEstatal = 4,000 × 9.5% = 380
     * cuotaIntegraAhorroAutonomica = 380
     * cuotaLiquidaAhorro = 760
     */
    const r = calculate({
      ...SALARY_BASE,
      retenciones: 0,
      savingsIncome: { dividends: 3_000, interest: 1_000 },
    });

    expect(r.baseImponibleAhorro).toBe(4_000);
    expect(r.cuotaIntegraAhorroEstatal).toBe(380);
    expect(r.cuotaIntegraAhorroAutonomica).toBe(380);
    expect(r.cuotaLiquidaTOTAL).toBe(6_585.70 + 760);
  });

  it('Art. 49 — capital loss offsets up to 25% of dividends+interest', () => {
    /**
     * capitalGains = −500 (loss), dividends = 2,000
     * lossAbs = 500
     * maxOffset = 25% × 2,000 = 500
     * offset = min(500, 500) = 500   (loss fully absorbed within cap)
     * baseImponibleAhorro = 2,000 − 500 = 1,500
     * cuotaIntegraAhorroEstatal = 1,500 × 9.5% = 142.50
     * cuotaIntegraAhorroAutonomica = 142.50
     * cuotaLiquidaAhorro = 285
     */
    const r = calculate({
      ...SALARY_BASE,
      retenciones: 0,
      savingsIncome: { capitalGains: -500, dividends: 2_000 },
    });

    expect(r.baseImponibleAhorro).toBe(1_500);
    expect(r.cuotaIntegraAhorroEstatal).toBe(142.50);
    expect(r.cuotaIntegraAhorroAutonomica).toBe(142.50);
    expect(r.cuotaLiquidaTOTAL).toBe(6_585.70 + 285);
  });

  it('Art. 49 — loss exceeds 25% cap: only partial offset, excess carries forward', () => {
    /**
     * capitalGains = −3,000 (loss), dividends = 2,000
     * lossAbs = 3,000
     * maxOffset = 25% × 2,000 = 500   ← cap applies, only 500 absorbed
     * offset = min(3,000, 500) = 500
     * baseImponibleAhorro = 2,000 − 500 = 1,500
     * (remaining loss €2,500 carries forward — engine does not track carry-forward)
     */
    const r = calculate({
      ...SALARY_BASE,
      retenciones: 0,
      savingsIncome: { capitalGains: -3_000, dividends: 2_000 },
    });

    expect(r.baseImponibleAhorro).toBe(1_500);
    expect(r.cuotaLiquidaTOTAL).toBe(6_585.70 + 285);
  });

  it('Art. 49 — pure capital loss with no dividends/interest → savings base = 0', () => {
    /**
     * No dividends/interest to offset against → entire loss carries forward.
     * baseImponibleAhorro = 0, no savings tax.
     */
    const r = calculate({
      ...SALARY_BASE,
      retenciones: 0,
      savingsIncome: { capitalGains: -2_000 },
    });

    expect(r.baseImponibleAhorro).toBe(0);
    expect(r.cuotaIntegraAhorroEstatal).toBe(0);
    expect(r.cuotaIntegraAhorroAutonomica).toBe(0);
    expect(r.cuotaLiquidaTOTAL).toBe(6_585.70);
  });
});
