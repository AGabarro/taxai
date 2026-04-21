import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WaterfallChart } from '../src/components/WaterfallChart'
import { MOCK_RESULT } from '../src/mocks/taxResult'

describe('WaterfallChart', () => {
  it('renders section heading', () => {
    render(<WaterfallChart steps={MOCK_RESULT.waterfallSteps} />)
    expect(screen.getByText('Cómo se calcula tu declaración')).toBeTruthy()
  })

  it('renders legend labels', () => {
    render(<WaterfallChart steps={MOCK_RESULT.waterfallSteps} />)
    expect(screen.getByText('Reduce la cuota')).toBeTruthy()
    expect(screen.getByText('Aumenta la cuota')).toBeTruthy()
  })
})
