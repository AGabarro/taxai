import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { TaxResult } from '@taxai/shared'

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const PCT = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function fmt(n: number) { return EUR.format(n) }

// ─── KPI card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'blue' | 'indigo' | 'violet'
}

function KpiCard({ label, value, sub, accent = 'blue' }: KpiCardProps) {
  const styles = {
    blue:   'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return (
    <div className={`rounded-xl p-4 ${styles[accent]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-50">{sub}</p>}
    </div>
  )
}

// ─── Custom tooltip for donut ─────────────────────────────────────────────────

interface PieTooltipPayload {
  name: string
  value: number
  payload: { fill: string }
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: PieTooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 text-sm">
      <span style={{ color: item.payload.fill }} className="font-semibold">{item.name}:</span>{' '}
      <span className="font-mono">{fmt(item.value)}</span>
    </div>
  )
}

// ─── Custom tooltip for bar chart ────────────────────────────────────────────

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-40">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-mono">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TaxBreakdownChartsProps {
  result: TaxResult
}

export function TaxBreakdownCharts({ result }: TaxBreakdownChartsProps) {
  const {
    grossSalary,
    rendimientoNetoReducido,
    cuotaLiquidaTOTAL,
    cuotaLiquidaEstatal,
    cuotaLiquidaAutonomica,
    cuotaIntegraEstatal,
    cuotaIntegraAutonomica,
    retenciones,
    resultAmount,
    resultType,
  } = result

  const effectiveRate = grossSalary > 0 ? (cuotaLiquidaTOTAL / grossSalary) * 100 : 0
  const totalReduccion = grossSalary - rendimientoNetoReducido
  const netSalary = grossSalary - cuotaLiquidaTOTAL

  // Donut data: net salary vs tax
  const pieData = [
    { name: 'Sueldo neto', value: netSalary },
    { name: 'Impuesto', value: cuotaLiquidaTOTAL },
  ]
  const PIE_COLORS = ['#3b82f6', '#f43f5e']

  // Grouped bar: cuota íntegra vs cuota líquida, split by state/region
  const barData = [
    { name: 'Cuota íntegra', Estatal: cuotaIntegraEstatal, Autonómica: cuotaIntegraAutonomica },
    { name: 'Cuota líquida', Estatal: cuotaLiquidaEstatal, Autonómica: cuotaLiquidaAutonomica },
  ]

  const balanceLabel = resultType === 'a_devolver'
    ? `+${fmt(Math.abs(resultAmount))} a devolver`
    : resultType === 'cero'
    ? 'Resultado cero'
    : `${fmt(resultAmount)} a ingresar`

  const balanceBg = resultType === 'a_devolver'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : resultType === 'cero'
    ? 'bg-gray-50 text-gray-700 border-gray-200'
    : 'bg-rose-50 text-rose-700 border-rose-200'

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Tipo efectivo"
          value={PCT.format(effectiveRate / 100)}
          sub={`sobre ${fmt(grossSalary)} bruto`}
          accent="blue"
        />
        <KpiCard
          label="Gastos deducibles"
          value={fmt(totalReduccion)}
          sub="SS + reducción trabajo"
          accent="indigo"
        />
        <KpiCard
          label="Mínimo personal"
          value={fmt(result.minimumPersonalFamiliar)}
          sub="personal y familiar"
          accent="violet"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Income allocation donut */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <h2 className="font-semibold text-gray-900 text-sm">Distribución del salario</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center effective rate overlay */}
            <div className="relative -mt-[160px] flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{PCT.format(effectiveRate / 100)}</p>
                <p className="text-xs text-gray-400 leading-tight">tipo<br/>efectivo</p>
              </div>
            </div>
            <div className="mt-[60px]" />
          </div>
        </div>

        {/* State vs regional cuota */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <h2 className="font-semibold text-gray-900 text-sm">Cuota estatal vs autonómica</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  width={40}
                />
                <Tooltip content={<BarTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
                <Bar dataKey="Estatal" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={56} />
                <Bar dataKey="Autonómica" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Retenciones vs cuota strip */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <h2 className="font-semibold text-gray-900 text-sm">Retenciones y resultado</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4 text-center mb-5">
            <div>
              <p className="text-xs text-gray-400 mb-1">Cuota líquida</p>
              <p className="text-lg font-bold font-mono text-gray-900">{fmt(cuotaLiquidaTOTAL)}</p>
              <p className="text-xs text-gray-400">lo que debes</p>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-gray-300 text-2xl select-none">vs</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Retenciones</p>
              <p className="text-lg font-bold font-mono text-gray-900">{fmt(retenciones)}</p>
              <p className="text-xs text-gray-400">ya pagado</p>
            </div>
          </div>

          {cuotaLiquidaTOTAL > 0 && (
            <div className="mb-4">
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, (retenciones / cuotaLiquidaTOTAL) * 100).toFixed(1)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                <span>Retenciones: {((retenciones / cuotaLiquidaTOTAL) * 100).toFixed(0)}% de la cuota</span>
                <span>{fmt(cuotaLiquidaTOTAL)}</span>
              </div>
            </div>
          )}

          <div className={`rounded-xl border px-4 py-3 font-semibold text-center text-sm ${balanceBg}`}>
            {balanceLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
