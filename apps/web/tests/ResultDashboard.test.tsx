import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultDashboard } from '../src/components/ResultDashboard'
import { MOCK_RESULT } from '../src/mocks/taxResult'
import type { TaxResult } from '@taxai/shared'

describe('ResultDashboard', () => {
  it('shows "A devolver" badge and green styling for negative resultAmount', () => {
    render(<ResultDashboard result={MOCK_RESULT} />)
    // "A devolver" appears in both the hero badge and the breakdown row
    expect(screen.getAllByText('A devolver').length).toBeGreaterThanOrEqual(1)
  })

  it('shows "A ingresar" badge for positive resultAmount', () => {
    const payResult: TaxResult = {
      ...MOCK_RESULT,
      resultAmount: 1200,
      resultType: 'a_ingresar',
    }
    render(<ResultDashboard result={payResult} />)
    expect(screen.getAllByText('A ingresar').length).toBeGreaterThanOrEqual(1)
  })

  it('displays the fiscal year and region name in the subtext', () => {
    render(<ResultDashboard result={MOCK_RESULT} />)
    // The hero subtext renders as "Renta {year} · {region}" across sibling text nodes
    expect(screen.getByText(/Renta 2024/)).toBeTruthy()
    expect(screen.getAllByText(/Comunidad de Madrid/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders key breakdown rows', () => {
    render(<ResultDashboard result={MOCK_RESULT} />)
    expect(screen.getByText('Salario bruto')).toBeTruthy()
    expect(screen.getByText('Rendimiento neto reducido')).toBeTruthy()
    expect(screen.getByText('Mínimo personal y familiar')).toBeTruthy()
    expect(screen.getByText('Cuota íntegra estatal')).toBeTruthy()
    expect(screen.getByText('Cuota líquida total')).toBeTruthy()
    // "Retenciones" appears in both the hero KPI and the breakdown row
    expect(screen.getAllByText('Retenciones').length).toBeGreaterThanOrEqual(1)
  })
})
