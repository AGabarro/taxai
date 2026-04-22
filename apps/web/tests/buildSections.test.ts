/**
 * Tests for buildSections / buildMeta.
 *
 * Strategy: validate that every number visible on screen ends up in the right
 * section and row. These tests act as a regression guard for "the PDF contains
 * all the details shown in screen" — if a new field is added to TaxResult but
 * not to buildSections, a test here should fail (or a new one must be added).
 */

import { describe, it, expect } from 'vitest'
import { buildSections, buildMeta } from '../src/pdf/buildSections'
import { MOCK_RESULT } from '../src/mocks/taxResult'
import type { TaxResult } from '@taxai/shared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findSection(sections: ReturnType<typeof buildSections>, id: string) {
  const s = sections.find(s => s.id === id)
  if (!s) throw new Error(`Section "${id}" not found`)
  return s
}

function findRow(sections: ReturnType<typeof buildSections>, sectionId: string, label: string) {
  const section = findSection(sections, sectionId)
  const row = section.rows.find(r => r.label === label)
  if (!row) {
    const available = section.rows.map(r => r.label).join(', ')
    throw new Error(`Row "${label}" not found in section "${sectionId}". Available: ${available}`)
  }
  return row
}

// ─── buildMeta ────────────────────────────────────────────────────────────────

describe('buildMeta', () => {
  const meta = buildMeta(MOCK_RESULT)

  it('exposes fiscal year', () => {
    expect(meta.fiscalYear).toBe(MOCK_RESULT.fiscalYear)
  })

  it('maps region code to Spanish name', () => {
    expect(meta.regionName).toBe('Comunidad de Madrid')
  })

  it('exposes resultType', () => {
    expect(meta.resultType).toBe('a_devolver')
  })

  it('exposes resultAmount', () => {
    expect(meta.resultAmount).toBe(MOCK_RESULT.resultAmount)
  })

  it('calculates effective rate as percentage', () => {
    const expected = (MOCK_RESULT.cuotaLiquidaTOTAL / MOCK_RESULT.grossSalary) * 100
    expect(meta.effectiveRate).toBeCloseTo(expected, 5)
  })

  it('exposes cuotaLiquidaTOTAL', () => {
    expect(meta.cuotaLiquidaTOTAL).toBe(MOCK_RESULT.cuotaLiquidaTOTAL)
  })

  it('exposes retenciones', () => {
    expect(meta.retenciones).toBe(MOCK_RESULT.retenciones)
  })

  it('includes a generated-at date string', () => {
    expect(typeof meta.generatedAt).toBe('string')
    expect(meta.generatedAt.length).toBeGreaterThan(0)
  })
})

// ─── buildSections — section presence ────────────────────────────────────────

describe('buildSections — core sections always present', () => {
  const sections = buildSections(MOCK_RESULT)
  const ids = sections.map(s => s.id)

  it('includes base-general', ()   => expect(ids).toContain('base-general'))
  it('includes cuota-integra', ()  => expect(ids).toContain('cuota-integra'))
  it('includes cuota-liquida', ()  => expect(ids).toContain('cuota-liquida'))
  it('includes resultado', ()      => expect(ids).toContain('resultado'))
  it('includes waterfall', ()      => expect(ids).toContain('waterfall'))
})

describe('buildSections — conditional sections absent when not applicable', () => {
  const sections = buildSections(MOCK_RESULT) // MOCK_RESULT has no ahorro
  const ids = sections.map(s => s.id)

  it('omits base-ahorro when baseImponibleAhorro is 0', () => {
    expect(ids).not.toContain('base-ahorro')
  })
})

// ─── buildSections — base-general amounts ────────────────────────────────────

describe('buildSections — base-general amounts match TaxResult', () => {
  const sections = buildSections(MOCK_RESULT)

  it('grossSalary in salario bruto row', () => {
    const row = findRow(sections, 'base-general', 'Salario bruto')
    expect(row.amount).toBe(MOCK_RESULT.grossSalary)
    expect(row.style).toBe('normal')
  })

  it('rendimientoNetoReducido in row', () => {
    const row = findRow(sections, 'base-general', 'Rendimiento neto reducido')
    expect(row.amount).toBe(MOCK_RESULT.rendimientoNetoReducido)
  })

  it('baseImponibleGeneral is accent row', () => {
    const row = findRow(sections, 'base-general', 'Base imponible general')
    expect(row.amount).toBe(MOCK_RESULT.baseImponibleGeneral)
    expect(row.style).toBe('accent')
  })

  it('minimumPersonalFamiliar is saving row', () => {
    const row = findRow(sections, 'base-general', 'Mínimo personal y familiar')
    expect(row.amount).toBe(MOCK_RESULT.minimumPersonalFamiliar)
    expect(row.style).toBe('saving')
  })
})

// ─── buildSections — cuota-integra amounts ───────────────────────────────────

describe('buildSections — cuota-integra amounts match TaxResult', () => {
  const sections = buildSections(MOCK_RESULT)

  it('cuotaIntegraEstatal', () => {
    const row = findRow(sections, 'cuota-integra', 'Cuota íntegra estatal')
    expect(row.amount).toBe(MOCK_RESULT.cuotaIntegraEstatal)
  })

  it('cuotaIntegraAutonomica', () => {
    const row = findRow(sections, 'cuota-integra', 'Cuota íntegra autonómica')
    expect(row.amount).toBe(MOCK_RESULT.cuotaIntegraAutonomica)
  })

  it('cuotaIntegraTOTAL as total row', () => {
    const row = findRow(sections, 'cuota-integra', 'Cuota íntegra total')
    expect(row.amount).toBe(MOCK_RESULT.cuotaIntegraTOTAL)
    expect(row.style).toBe('total')
  })
})

// ─── buildSections — cuota-liquida amounts ───────────────────────────────────

describe('buildSections — cuota-liquida amounts match TaxResult', () => {
  const sections = buildSections(MOCK_RESULT)

  it('cuotaLiquidaEstatal', () => {
    const row = findRow(sections, 'cuota-liquida', 'Cuota líquida estatal')
    expect(row.amount).toBe(MOCK_RESULT.cuotaLiquidaEstatal)
  })

  it('cuotaLiquidaAutonomica', () => {
    const row = findRow(sections, 'cuota-liquida', 'Cuota líquida autonómica')
    expect(row.amount).toBe(MOCK_RESULT.cuotaLiquidaAutonomica)
  })

  it('cuotaLiquidaTOTAL as accent row', () => {
    const row = findRow(sections, 'cuota-liquida', 'Cuota líquida total')
    expect(row.amount).toBe(MOCK_RESULT.cuotaLiquidaTOTAL)
    expect(row.style).toBe('accent')
  })
})

// ─── buildSections — resultado amounts ───────────────────────────────────────

describe('buildSections — resultado amounts match TaxResult', () => {
  const sections = buildSections(MOCK_RESULT)

  it('cuotaLiquidaTOTAL present', () => {
    const row = findRow(sections, 'resultado', 'Cuota líquida total')
    expect(row.amount).toBe(MOCK_RESULT.cuotaLiquidaTOTAL)
  })

  it('retenciones present', () => {
    const row = findRow(sections, 'resultado', 'Retenciones a cuenta')
    expect(row.amount).toBe(MOCK_RESULT.retenciones)
  })

  it('resultAmount with correct label and style', () => {
    const section = findSection(sections, 'resultado')
    const resultRow = section.rows.find(r => r.style === 'result')
    expect(resultRow).toBeDefined()
    expect(resultRow!.amount).toBe(MOCK_RESULT.resultAmount)
    expect(resultRow!.label).toBe('A devolver')
  })

  it('uses "A ingresar" label for a_ingresar result type', () => {
    const ingresarResult: TaxResult = { ...MOCK_RESULT, resultType: 'a_ingresar', resultAmount: 500 }
    const sections = buildSections(ingresarResult)
    const section = findSection(sections, 'resultado')
    const resultRow = section.rows.find(r => r.style === 'result')
    expect(resultRow!.label).toBe('A ingresar')
  })

  it('uses "Resultado cero" label for cero result type', () => {
    const ceroResult: TaxResult = { ...MOCK_RESULT, resultType: 'cero', resultAmount: 0 }
    const sections = buildSections(ceroResult)
    const section = findSection(sections, 'resultado')
    const resultRow = section.rows.find(r => r.style === 'result')
    expect(resultRow!.label).toBe('Resultado cero')
  })
})

// ─── buildSections — waterfall ───────────────────────────────────────────────

describe('buildSections — waterfall mirrors waterfallSteps', () => {
  const sections = buildSections(MOCK_RESULT)
  const section = findSection(sections, 'waterfall')

  it('has same number of rows as waterfallSteps', () => {
    expect(section.rows.length).toBe(MOCK_RESULT.waterfallSteps.length)
  })

  it('each row label matches the step label', () => {
    MOCK_RESULT.waterfallSteps.forEach((step, i) => {
      expect(section.rows[i].label).toBe(step.label)
    })
  })

  it('each row amount matches the step amount', () => {
    MOCK_RESULT.waterfallSteps.forEach((step, i) => {
      expect(section.rows[i].amount).toBe(step.amount)
    })
  })

  it('negative steps get saving style', () => {
    const negativeSteps = MOCK_RESULT.waterfallSteps.filter(s => s.amount < 0)
    const negativeRows  = section.rows.filter(r => r.amount < 0)
    negativeRows.forEach(r => expect(r.style).toBe('saving'))
    expect(negativeRows.length).toBe(negativeSteps.length)
  })

  it('bracketRate steps include a hint with the rate', () => {
    const stepsWithRate = MOCK_RESULT.waterfallSteps.filter(s => s.bracketRate !== undefined)
    stepsWithRate.forEach(step => {
      const row = section.rows.find(r => r.label === step.label)
      expect(row!.hint).toBeDefined()
      expect(row!.hint).toContain('%')
    })
  })
})

// ─── buildSections — conditional: base del ahorro ────────────────────────────

describe('buildSections — base del ahorro section (conditional)', () => {
  const ahorroResult: TaxResult = {
    ...MOCK_RESULT,
    baseImponibleAhorro:          5000,
    cuotaIntegraAhorroEstatal:     950,
    cuotaIntegraAhorroAutonomica:  900,
    cuotaLiquidaAhorroEstatal:     950,
    cuotaLiquidaAhorroAutonomica:  900,
  }
  const sections = buildSections(ahorroResult)
  const ids = sections.map(s => s.id)

  it('includes base-ahorro section when baseImponibleAhorro > 0', () => {
    expect(ids).toContain('base-ahorro')
  })

  it('baseImponibleAhorro amount is correct', () => {
    const row = findRow(sections, 'base-ahorro', 'Base imponible del ahorro')
    expect(row.amount).toBe(5000)
  })

  it('cuota-integra includes ahorro rows', () => {
    const section = findSection(sections, 'cuota-integra')
    const labels = section.rows.map(r => r.label)
    expect(labels).toContain('Cuota íntegra ahorro (estatal)')
    expect(labels).toContain('Cuota íntegra ahorro (autonómica)')
  })

  it('cuota-liquida includes ahorro rows', () => {
    const section = findSection(sections, 'cuota-liquida')
    const labels = section.rows.map(r => r.label)
    expect(labels).toContain('Cuota líquida ahorro (estatal)')
    expect(labels).toContain('Cuota líquida ahorro (autonómica)')
  })
})

// ─── buildSections — conditional: pension ────────────────────────────────────

describe('buildSections — pension reduction (conditional)', () => {
  it('omits pension row when reduccionPension is 0', () => {
    const sections = buildSections(MOCK_RESULT)
    const section  = findSection(sections, 'base-general')
    const labels   = section.rows.map(r => r.label)
    expect(labels).not.toContain('Reducción plan de pensiones')
  })

  it('includes pension row with negated amount when reduccionPension > 0', () => {
    const pensionResult: TaxResult = { ...MOCK_RESULT, reduccionPension: 1500 }
    const sections = buildSections(pensionResult)
    const row = findRow(sections, 'base-general', 'Reducción plan de pensiones')
    expect(row.amount).toBe(-1500)
    expect(row.style).toBe('saving')
  })
})

// ─── buildSections — conditional: deducciones autonómicas ────────────────────

describe('buildSections — regional deductions (conditional)', () => {
  it('omits deducciones row when deduccionesAutonomicas is 0', () => {
    const sections = buildSections(MOCK_RESULT)
    const section  = findSection(sections, 'cuota-liquida')
    const labels   = section.rows.map(r => r.label)
    expect(labels).not.toContain('Deducciones autonómicas')
  })

  it('includes deducciones row with negated amount when > 0', () => {
    const catResult: TaxResult = { ...MOCK_RESULT, deduccionesAutonomicas: 300 }
    const sections = buildSections(catResult)
    const row = findRow(sections, 'cuota-liquida', 'Deducciones autonómicas')
    expect(row.amount).toBe(-300)
    expect(row.style).toBe('saving')
  })
})

// ─── buildSections — conditional: rental income ──────────────────────────────

describe('buildSections — rental income (conditional)', () => {
  it('omits rental row when netRentalIncome is 0', () => {
    const sections = buildSections(MOCK_RESULT)
    const section  = findSection(sections, 'base-general')
    const labels   = section.rows.map(r => r.label)
    expect(labels).not.toContain('Rendimientos capital inmobiliario')
  })

  it('includes rental row when netRentalIncome > 0', () => {
    const rentalResult: TaxResult = { ...MOCK_RESULT, netRentalIncome: 3600 }
    const sections = buildSections(rentalResult)
    const row = findRow(sections, 'base-general', 'Rendimientos capital inmobiliario')
    expect(row.amount).toBe(3600)
  })
})

// ─── buildSections — no missing amounts ──────────────────────────────────────

describe('buildSections — no NaN or undefined amounts', () => {
  it('all row amounts are finite numbers', () => {
    const sections = buildSections(MOCK_RESULT)
    for (const section of sections) {
      for (const row of section.rows) {
        expect(typeof row.amount).toBe('number')
        expect(Number.isFinite(row.amount)).toBe(true)
      }
    }
  })
})
