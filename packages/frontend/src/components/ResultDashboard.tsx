import type { TaxResult, SpanishRegion } from '@taxai/shared'

const REGION_NAMES: Record<SpanishRegion, string> = {
  'andalusia': 'Andalucía',
  'aragon': 'Aragón',
  'asturias': 'Asturias',
  'balearics': 'Islas Baleares',
  'canarias': 'Canarias',
  'cantabria': 'Cantabria',
  'castilla-la-mancha': 'Castilla-La Mancha',
  'castilla-leon': 'Castilla y León',
  'catalonia': 'Cataluña',
  'extremadura': 'Extremadura',
  'galicia': 'Galicia',
  'la-rioja': 'La Rioja',
  'madrid': 'Comunidad de Madrid',
  'murcia': 'Región de Murcia',
  'navarra': 'Navarra',
  'pais-vasco': 'País Vasco',
  'valenciana': 'Comunidad Valenciana',
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function formatEur(amount: number): string {
  return EUR.format(amount)
}

interface BreakdownRowProps {
  label: string
  amount: number
}

function BreakdownRow({ label, amount }: BreakdownRowProps) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-mono text-sm font-medium text-gray-900">{formatEur(amount)}</span>
    </div>
  )
}

interface ResultDashboardProps {
  result: TaxResult
}

export function ResultDashboard({ result }: ResultDashboardProps) {
  const isDevolver = result.resultType === 'a_devolver'
  const isCero = result.resultType === 'cero'
  const absAmount = Math.abs(result.resultAmount)

  const heroLabel = isDevolver ? 'A devolver' : isCero ? 'Resultado cero' : 'A ingresar'
  const heroBg = isDevolver
    ? 'bg-green-50 border-green-400'
    : isCero
    ? 'bg-gray-50 border-gray-400'
    : 'bg-red-50 border-red-400'
  const heroAmountColor = isDevolver
    ? 'text-green-700'
    : isCero
    ? 'text-gray-700'
    : 'text-red-700'
  const heroBadgeBg = isDevolver
    ? 'bg-green-100 text-green-800'
    : isCero
    ? 'bg-gray-100 text-gray-800'
    : 'bg-red-100 text-red-800'

  return (
    <div className="w-full space-y-4">
      {/* Hero card */}
      <div className={`rounded-2xl border-2 p-6 ${heroBg}`}>
        <div className="flex flex-col items-center text-center gap-2">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${heroBadgeBg}`}>
            {heroLabel}
          </span>
          <span className={`text-5xl font-bold tracking-tight ${heroAmountColor}`}>
            {formatEur(absAmount)}
          </span>
          <span className="text-sm text-gray-500 mt-1">
            Declaración de la Renta {result.fiscalYear} · {REGION_NAMES[result.region]}
          </span>
        </div>
      </div>

      {/* Breakdown grid */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resumen de tu declaración</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          <div className="px-5">
            <BreakdownRow label="Salario bruto" amount={result.grossSalary} />
            <BreakdownRow label="Rendimiento neto reducido" amount={result.rendimientoNetoReducido} />
            <BreakdownRow label="Mínimo personal y familiar" amount={result.minimumPersonalFamiliar} />
          </div>
          <div className="px-5">
            <BreakdownRow label="Cuota íntegra total" amount={result.cuotaIntegraTOTAL} />
            <BreakdownRow label="Cuota líquida total" amount={result.cuotaLiquidaTOTAL} />
            <BreakdownRow label="Retenciones a cuenta" amount={result.retenciones} />
          </div>
        </div>
      </div>
    </div>
  )
}
