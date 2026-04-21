import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { WaterfallStep } from '../types'

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const PCT = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1 })

interface TooltipPayload {
  payload?: WaterfallStep
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null
  const step = payload[0].payload as WaterfallStep
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{step.label}</p>
      <p className="text-gray-600">
        Importe:{' '}
        <span className={step.amount >= 0 ? 'text-red-600 font-mono' : 'text-green-600 font-mono'}>
          {EUR.format(step.amount)}
        </span>
      </p>
      {step.bracketRate !== undefined && (
        <p className="text-gray-600">
          Tipo aplicado: <span className="font-mono">{PCT.format(step.bracketRate)}</span>
        </p>
      )}
    </div>
  )
}

interface WaterfallChartProps {
  steps: WaterfallStep[]
}

export function WaterfallChart({ steps }: WaterfallChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Cómo se calcula tu declaración
        </h2>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={steps}
            margin={{ top: 10, right: 20, left: 20, bottom: 60 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v: number) => EUR.format(v)}
              width={90}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {steps.map((step, idx) => (
                <Cell
                  key={idx}
                  fill={step.amount < 0 ? '#16a34a' : '#dc2626'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-600"></span>
            Reduce la cuota
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-600"></span>
            Aumenta la cuota
          </span>
        </div>
      </div>
    </div>
  )
}
