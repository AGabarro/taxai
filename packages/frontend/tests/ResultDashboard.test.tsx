import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultDashboard } from '../src/components/ResultDashboard'
import { MOCK_RESULT } from '../src/mocks/taxResult'
import type { TaxResult } from '@taxai/shared'

describe('ResultDashboard', () => {
  it('shows "A devolver" badge and green styling for negative resultAmount', () => {
    render(<ResultDashboard result={MOCK_RESULT} />)
    expect(screen.getByText('A devolver')).toBeTruthy()
  })

  it('shows "A ingresar" badge for positive resultAmount', () => {
    const payResult: TaxResult = {
      ...MOCK_RESULT,
      resultAmount: 1200,
      resultType: 'a_ingresar',
    }
    render(<ResultDashboard result={payResult} />)
    expect(screen.getByText('A ingresar')).toBeTruthy()
  })

  it('displays the fiscal year and region name in the subtext', () => {
    render(<ResultDashboard result={MOCK_RESULT} />)
    expect(screen.getByText(/Declaración de la Renta 2024/)).toBeTruthy()
    expect(screen.getByText(/Comunidad de Madrid/)).toBeTruthy()
  })

  it('renders all 6 breakdown rows', () => {
    render(<ResultDashboard result={MOCK_RESULT} />)
    expect(screen.getByText('Salario bruto')).toBeTruthy()
    expect(screen.getByText('Rendimiento neto reducido')).toBeTruthy()
    expect(screen.getByText('Mínimo personal y familiar')).toBeTruthy()
    expect(screen.getByText('Cuota íntegra total')).toBeTruthy()
    expect(screen.getByText('Cuota líquida total')).toBeTruthy()
    expect(screen.getByText('Retenciones a cuenta')).toBeTruthy()
  })
})
