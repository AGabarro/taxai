import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { WaterfallStep } from '@taxai/shared'

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const PCT = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1 })

interface TooltipPayload {
  payload?: WaterfallStep
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null
  const step = payload[0].payload as WaterfallStep
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1.5">{step.label}</p>
      <p className="text-gray-500 text-xs">
        Importe:{' '}
        <span className={`font-mono font-semibold ${step.amount >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {EUR.format(step.amount)}
        </span>
      </p>
      {step.bracketRate !== undefined && (
        <p className="text-gray-500 text-xs mt-0.5">
          Tipo: <span className="font-mono font-semibold text-gray-700">{PCT.format(step.bracketRate)}</span>
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <h2 className="font-semibold text-gray-900 text-base">Cómo se calcula tu declaración</h2>
        <p className="text-xs text-gray-400 mt-0.5">Cada barra muestra el impacto de cada concepto fiscal</p>
      </div>
      <div className="p-5">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={steps}
            margin={{ top: 10, right: 20, left: 20, bottom: 65 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              angle={-32}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(v: number) => EUR.format(v)}
              width={90}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
            <Bar dataKey="amount" radius={[5, 5, 0, 0]}>
              {steps.map((step, idx) => (
                <Cell
                  key={idx}
                  fill={step.amount < 0 ? '#10b981' : '#f43f5e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-5 justify-center mt-1 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
            Reduce la cuota
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-rose-500" />
            Aumenta la cuota
          </span>
        </div>
      </div>
    </div>
  )
}
