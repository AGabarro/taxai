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
const PCT = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })

function fmt(n: number) { return EUR.format(n) }

interface BreakdownRowProps {
  label: string
  hint?: string
  amount: number
  accent?: boolean
  negative?: boolean   // force green colouring (reductions)
  separator?: boolean  // draw a thicker top border
}

function BreakdownRow({ label, hint, amount, accent, negative, separator }: BreakdownRowProps) {
  const amountColor = accent
    ? 'text-blue-700'
    : negative
    ? 'text-emerald-600'
    : 'text-gray-900'
  return (
    <div className={`flex justify-between items-center py-2.5 gap-4 ${separator ? 'border-t-2 border-gray-200 mt-1' : 'border-b border-gray-100 last:border-0'}`}>
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <span className={`font-mono text-sm font-semibold shrink-0 ${amountColor}`}>
        {fmt(amount)}
      </span>
    </div>
  )
}

interface SectionHeaderProps { title: string }
function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-3 pb-1">{title}</p>
  )
}

interface ResultDashboardProps {
  result: TaxResult
}

export function ResultDashboard({ result }: ResultDashboardProps) {
  const isDevolver = result.resultType === 'a_devolver'
  const isCero     = result.resultType === 'cero'
  const absAmount  = Math.abs(result.resultAmount)

  const hasAhorro          = result.baseImponibleAhorro > 0
  const hasPension         = result.reduccionPension > 0
  const hasRental          = result.netRentalIncome > 0
  const hasRegionalDeducs  = result.deduccionesAutonomicas > 0

  const cuotaLiquidaGeneral = result.cuotaLiquidaEstatal + result.cuotaLiquidaAutonomica
  const cuotaLiquidaAhorro  = result.cuotaLiquidaAhorroEstatal + result.cuotaLiquidaAhorroAutonomica

  const effectiveRate = result.grossSalary > 0
    ? (result.cuotaLiquidaTOTAL / result.grossSalary) * 100
    : 0

  const heroGradient = isDevolver
    ? 'from-blue-500 to-indigo-600'
    : isCero
    ? 'from-gray-500 to-slate-600'
    : 'from-rose-500 to-red-600'

  const heroLabel = isDevolver ? 'A devolver' : isCero ? 'Resultado cero' : 'A ingresar'
  const heroIcon  = isDevolver ? '↩' : isCero ? '=' : '→'

  return (
    <div className="w-full space-y-4">
      {/* Hero card */}
      <div className={`rounded-2xl bg-gradient-to-br ${heroGradient} p-6 shadow-sm`}>
        <div className="flex flex-col items-center text-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
            <span>{heroIcon}</span>
            {heroLabel}
          </span>
          <span className="text-5xl font-bold text-white tracking-tight mt-1">
            {fmt(absAmount)}
          </span>
          <span className="text-white/70 text-sm mt-1">
            Renta {result.fiscalYear} · {REGION_NAMES[result.region]}
          </span>
        </div>

        {/* Quick KPIs inside hero */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-white/70 text-xs mb-0.5">Tipo efectivo</p>
            <p className="text-white font-bold text-base">{PCT.format(effectiveRate / 100)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-white/70 text-xs mb-0.5">Cuota líquida</p>
            <p className="text-white font-bold text-base">{fmt(result.cuotaLiquidaTOTAL)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center">
            <p className="text-white/70 text-xs mb-0.5">Retenciones</p>
            <p className="text-white font-bold text-base">{fmt(result.retenciones)}</p>
          </div>
        </div>
      </div>

      {/* Desglose completo */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Desglose de la declaración
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-gray-100">

          {/* ── Left column: bases imponibles ───────────────────────────── */}
          <div className="px-5 py-2">
            <SectionHeader title="Base General" />
            <BreakdownRow
              label="Salario bruto"
              hint="Rendimiento íntegro del trabajo"
              amount={result.grossSalary}
            />
            <BreakdownRow
              label="Rendimiento neto reducido"
              hint="Tras deducir SS + reducción por trabajo"
              amount={result.rendimientoNetoReducido}
            />
            {hasRental && (
              <BreakdownRow
                label="Rendimientos capital inmobiliario"
                hint="Ingresos alquiler netos + renta imputada"
                amount={result.netRentalIncome}
              />
            )}
            {hasPension && (
              <BreakdownRow
                label="Reducción plan de pensiones"
                hint="Art. 51 LIRPF · máx. €1.500"
                amount={-result.reduccionPension}
                negative
              />
            )}
            <BreakdownRow
              label="Base imponible general"
              hint="Tramos progresivos (9,5%–24,5% + autonómico)"
              amount={result.baseImponibleGeneral}
              accent
            />
            <BreakdownRow
              label="Mínimo personal y familiar"
              hint="Exención base (Art. 57–61 LIRPF)"
              amount={result.minimumPersonalFamiliar}
            />

            {hasAhorro && (
              <>
                <SectionHeader title="Base del Ahorro" />
                <BreakdownRow
                  label="Base imponible del ahorro"
                  hint="Tramos fijos: 19% · 21% · 23% · 26% · 28%"
                  amount={result.baseImponibleAhorro}
                  accent
                />
              </>
            )}
          </div>

          {/* ── Right column: cuotas ─────────────────────────────────────── */}
          <div className="px-5 py-2 border-t md:border-t-0 border-gray-100">
            <SectionHeader title="Cuota Base General" />
            <BreakdownRow
              label="Cuota íntegra estatal"
              hint="Tarifa estatal sobre base general"
              amount={result.cuotaIntegraEstatal}
            />
            <BreakdownRow
              label="Cuota íntegra autonómica"
              hint="Tarifa autonómica sobre base general"
              amount={result.cuotaIntegraAutonomica}
            />
            <BreakdownRow
              label="Cuota líquida base general"
              hint="Tras mínimo personal y deducciones"
              amount={cuotaLiquidaGeneral}
            />

            {hasAhorro && (
              <>
                <SectionHeader title="Cuota Base del Ahorro" />
                <BreakdownRow
                  label="Cuota íntegra ahorro (estatal)"
                  amount={result.cuotaIntegraAhorroEstatal}
                />
                <BreakdownRow
                  label="Cuota íntegra ahorro (autonómica)"
                  amount={result.cuotaIntegraAhorroAutonomica}
                />
                <BreakdownRow
                  label="Cuota líquida base del ahorro"
                  amount={cuotaLiquidaAhorro}
                />
              </>
            )}

            <SectionHeader title="Resultado Final" />
            {hasRegionalDeducs && (
              <BreakdownRow
                label="Deducciones autonómicas"
                amount={-result.deduccionesAutonomicas}
                negative
              />
            )}
            <BreakdownRow
              label="Cuota líquida total"
              hint={hasAhorro ? 'General + ahorro − deducciones autonómicas' : 'Lo que realmente debes al fisco'}
              amount={result.cuotaLiquidaTOTAL}
              accent
            />
            <BreakdownRow
              label="Retenciones"
              hint="Ya pagado por tu empresa"
              amount={result.retenciones}
            />
            <BreakdownRow
              label={isDevolver ? 'A devolver' : isCero ? 'Resultado' : 'A ingresar'}
              hint={isDevolver ? 'La AEAT te devuelve este importe' : isCero ? 'Ni pagas ni devuelven' : 'Debes abonar este importe'}
              amount={result.resultAmount}
              accent
              separator
            />
          </div>

        </div>
      </div>
    </div>
  )
}
