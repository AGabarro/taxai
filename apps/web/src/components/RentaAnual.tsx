import { useRef, useState } from 'react'
import type { RentaAnualResult, TaxResult, SpanishRegion, CivilStatus } from '@taxai/shared'
import { taxai } from '../api/taxai'

interface RentaAnualProps {
  onResult: (result: TaxResult) => void
}

const REGION_LABELS: Record<SpanishRegion, string> = {
  andalusia: 'Andalucía',
  aragon: 'Aragón',
  asturias: 'Asturias',
  balearics: 'Islas Baleares',
  canarias: 'Canarias',
  cantabria: 'Cantabria',
  'castilla-la-mancha': 'Castilla-La Mancha',
  'castilla-leon': 'Castilla y León',
  catalonia: 'Cataluña',
  extremadura: 'Extremadura',
  galicia: 'Galicia',
  'la-rioja': 'La Rioja',
  madrid: 'Comunidad de Madrid',
  murcia: 'Murcia',
  navarra: 'Navarra',
  'pais-vasco': 'País Vasco',
  valenciana: 'Comunidad Valenciana',
}

const REGIONS = Object.entries(REGION_LABELS) as [SpanishRegion, string][]

function fmt(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function fmtPct(n: number, decimals = 2) {
  return (
    n.toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + '%'
  )
}

// ─── Explanation row ────────────────────────────────────────────────────────

type RowAccent = 'neutral' | 'saving' | 'paid' | 'refund' | 'due'

function Row({
  label,
  hint,
  amount,
  deduction = false,
  isTotal = false,
  accent = 'neutral',
}: {
  label: string
  hint?: string
  amount: number
  deduction?: boolean
  isTotal?: boolean
  accent?: RowAccent
}) {
  const colorMap: Record<RowAccent, string> = {
    neutral: isTotal ? 'text-gray-900' : 'text-gray-700',
    saving: 'text-emerald-600',
    paid: 'text-blue-600',
    refund: 'text-blue-700',
    due: 'text-amber-700',
  }

  return (
    <div
      className={`flex items-start justify-between gap-4 ${
        isTotal
          ? 'pt-3 mt-2 border-t-2 border-gray-200'
          : 'pt-2.5 border-t border-gray-100 first:border-0 first:pt-0'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isTotal ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
          {label}
        </p>
        {hint && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed max-w-prose">{hint}</p>}
      </div>
      <p className={`text-sm font-semibold tabular-nums shrink-0 ${colorMap[accent]}`}>
        {deduction && '−'}
        {fmt(amount)}
      </p>
    </div>
  )
}

// ─── Section card wrapper ────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{icon}</span>
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function RentaAnual({ onResult }: RentaAnualProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [region, setRegion] = useState<SpanishRegion>('madrid')
  const [age, setAge] = useState(35)
  const [civilStatus, setCivilStatus] = useState<CivilStatus>('single')
  const [fiscalYear, setFiscalYear] = useState(2025)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rentaResult, setRentaResult] = useState<RentaAnualResult | null>(null)

  // ── File helpers ──────────────────────────────────────────────────────────

  function addFiles(list: FileList | File[] | null) {
    if (!list) return
    const pdfs = Array.from(list).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      const fresh = pdfs.filter((f) => !existing.has(f.name))
      return [...prev, ...fresh].slice(0, 12)
    })
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    // Only clear when leaving the drop zone itself (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    setRentaResult(null)
    try {
      const result = await taxai.parseRenta({ pdfs: files, region, age, civilStatus, fiscalYear })
      setRentaResult(result)
      if (result.taxResult) onResult(result.taxResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived fiscal values ─────────────────────────────────────────────────

  const taxResult = rentaResult?.taxResult
  const ssDeductions = rentaResult?.annualSS ?? 0
  // totalDeductions = SS + trabajo reduction (derived from engine output)
  const totalDeductions = taxResult
    ? Math.max(0, taxResult.grossSalary - taxResult.rendimientoNetoReducido)
    : 0
  const trabajoReduction = Math.max(0, totalDeductions - ssDeductions)
  const effectiveRate =
    taxResult && rentaResult && rentaResult.annualGross > 0
      ? (taxResult.cuotaLiquidaTOTAL / rentaResult.annualGross) * 100
      : 0
  const hasExemptBenefits =
    rentaResult &&
    rentaResult.annualBaseIRPF > 0 &&
    rentaResult.annualGross > rentaResult.annualBaseIRPF + 0.01
  const comp = rentaResult?.comparison
  const monthsCount = rentaResult?.months.length ?? 0

  // ── Render ────────────────────────────────────────────────────────────────

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'

  return (
    <div className="space-y-5">
      {/* ── Upload form ─────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5"
      >
        <div>
          <h2 className="font-semibold text-gray-900 text-base">Calcula tu Renta anual</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sube las nóminas de todos los meses del año. El cálculo usará los datos reales de cada
            nómina sin proyecciones.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-7 text-center cursor-pointer select-none transition-all ${
            isDragging
              ? 'border-blue-400 bg-blue-50 scale-[1.01]'
              : files.length > 0
              ? 'border-blue-300 bg-blue-50/40'
              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Seleccionar o arrastrar nóminas PDF"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="text-3xl mb-2">{isDragging ? '📂' : files.length > 0 ? '📑' : '📂'}</div>
          <p className="text-sm font-medium text-gray-700">
            {isDragging
              ? 'Suelta aquí tus nóminas'
              : files.length > 0
              ? `${files.length} nómina${files.length !== 1 ? 's' : ''} cargada${files.length !== 1 ? 's' : ''} · haz clic para añadir más`
              : 'Arrastra tus nóminas aquí o haz clic para seleccionar'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Hasta 12 archivos PDF · 10 MB por archivo
          </p>
        </div>

        {/* File pills */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-3 pr-1.5 py-1 text-xs font-medium max-w-[220px]"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(i)
                  }}
                  className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 hover:bg-blue-300 flex items-center justify-center transition-colors leading-none text-blue-700 font-bold"
                  aria-label={`Eliminar ${f.name}`}
                >
                  ×
                </button>
              </span>
            ))}
            {files.length < 12 && (
              <span className="text-xs text-gray-400 self-center">
                {12 - files.length} más disponibles
              </span>
            )}
          </div>
        )}

        {/* Personal data */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              {
                id: 'fiscalYear',
                label: 'Año fiscal',
                node: (
                  <select
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                    className={inputCls}
                  >
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                  </select>
                ),
              },
              {
                id: 'region',
                label: 'Comunidad',
                node: (
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as SpanishRegion)}
                    className={inputCls}
                  >
                    {REGIONS.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                id: 'age',
                label: 'Edad',
                node: (
                  <input
                    type="number"
                    min={16}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className={inputCls}
                  />
                ),
              },
              {
                id: 'civilStatus',
                label: 'Estado civil',
                node: (
                  <select
                    value={civilStatus}
                    onChange={(e) => setCivilStatus(e.target.value as CivilStatus)}
                    className={inputCls}
                  >
                    <option value="single">Soltero/a</option>
                    <option value="married">Casado/a</option>
                    <option value="widowed">Viudo/a</option>
                    <option value="separated">Separado/a</option>
                  </select>
                ),
              },
            ] as { id: string; label: string; node: React.ReactNode }[]
          ).map(({ id, label, node }) => (
            <div key={id}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {label}
              </label>
              {node}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={files.length === 0 || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading
            ? `Analizando ${files.length} nómina${files.length !== 1 ? 's' : ''}…`
            : `Calcular Renta ${fiscalYear}`}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {rentaResult && taxResult && (
        <div className="space-y-4">

          {/* Hero card */}
          <div
            className={`rounded-2xl p-6 text-white shadow-md ${
              comp?.diffType === 'overpaid'
                ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                : comp?.diffType === 'underpaid'
                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                : 'bg-gradient-to-br from-emerald-600 to-teal-700'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">
              {comp?.diffType === 'overpaid'
                ? 'A devolver'
                : comp?.diffType === 'underpaid'
                ? 'A ingresar'
                : 'Resultado'}{' '}
              · Renta {fiscalYear}
            </p>
            <p className="text-5xl font-bold tracking-tight leading-none">
              {comp ? fmt(Math.abs(comp.difference)) : fmt(Math.abs(taxResult.resultAmount))}
            </p>
            <p className="text-sm text-white/80 mt-2">
              {comp?.diffType === 'overpaid' &&
                'Hacienda te devolverá esta cantidad al presentar la declaración'}
              {comp?.diffType === 'underpaid' &&
                'Deberás pagar esta cantidad al presentar la declaración'}
              {(!comp || comp.diffType === 'correct') &&
                'Tu declaración está equilibrada — retenciones y cuota coinciden'}
            </p>

            {/* KPI chips */}
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                Tipo efectivo {fmtPct(effectiveRate, 1)}
              </span>
              <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                {monthsCount} nómina{monthsCount !== 1 ? 's' : ''} procesada{monthsCount !== 1 ? 's' : ''}
              </span>
              <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                SS pagada {fmt(ssDeductions)}
              </span>
              {comp && (
                <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                  Desviación {fmtPct(comp.percentageDiff, 1)}
                </span>
              )}
            </div>
          </div>

          {/* Monthly breakdown table */}
          {rentaResult.months.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Resumen mensual</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Importes reales extraídos de cada nómina, sin estimaciones
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Período', 'Total devengado', 'Base IRPF', 'Retención', 'Tipo %'].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                              i === 0 ? 'text-left' : 'text-right'
                            }`}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rentaResult.months.map((m, i) => {
                      const rawPct =
                        m.retentionPercentage ??
                        (m.monthlyRetenciones && m.monthlyGross && m.monthlyGross > 0
                          ? (m.monthlyRetenciones / m.monthlyGross) * 100
                          : null)
                      return (
                        <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 text-gray-800 capitalize font-medium">
                            {m.period ?? `Nómina ${i + 1}`}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {m.monthlyGross !== undefined ? fmt(m.monthlyGross) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {m.monthlyBaseIRPF !== undefined ? fmt(m.monthlyBaseIRPF) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">
                            {m.monthlyRetenciones !== undefined ? fmt(m.monthlyRetenciones) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {rawPct !== null && rawPct !== undefined ? (
                              <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                                {fmtPct(rawPct, 1)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-900">
                      <td className="px-4 py-3">Total anual</td>
                      <td className="px-4 py-3 text-right">{fmt(rentaResult.annualGross)}</td>
                      <td className="px-4 py-3 text-right">
                        {rentaResult.annualBaseIRPF > 0 ? fmt(rentaResult.annualBaseIRPF) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">{fmt(rentaResult.annualRetencionesNomina)}</td>
                      <td className="px-4 py-3 text-right">
                        {rentaResult.annualGross > 0 ? (
                          <span className="inline-block bg-gray-200 text-gray-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {fmtPct(
                              (rentaResult.annualRetencionesNomina / rentaResult.annualGross) * 100,
                              1,
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Fiscal breakdown ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Gastos deducibles */}
            <Section
              icon="🟢"
              title="Gastos deducibles del trabajo"
              subtitle="Importes que reducen tu base imponible antes de calcular el impuesto"
            >
              {hasExemptBenefits && (
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                  Tu nómina incluye conceptos exentos de IRPF (p.ej. tickets restaurante, seguro médico) que reducen la base IRPF respecto al total devengado.
                </div>
              )}
              <Row
                label="Salario bruto sujeto a IRPF"
                hint="El importe anual de tus nóminas sobre el que se calcula el IRPF. Puede ser inferior al total devengado si tienes beneficios exentos."
                amount={taxResult.grossSalary}
              />
              {ssDeductions > 0 && (
                <Row
                  label="Cotizaciones a la Seguridad Social"
                  hint="Lo que pagas como empleado/a a la SS (contingencias comunes, desempleo, MEI y formación profesional). Por ley son un gasto deducible que reduce tu base imponible (Art. 19 LIRPF)."
                  amount={ssDeductions}
                  deduction
                  accent="saving"
                />
              )}
              {trabajoReduction > 0 && (
                <Row
                  label="Reducción por rendimientos del trabajo"
                  hint="Una reducción adicional que beneficia especialmente a los salarios más bajos. En 2025 puede llegar a 7.302 € para rentas netas hasta 14.852 €, y se elimina gradualmente hasta los 19.747 € (Art. 20 LIRPF, Ley 5/2025)."
                  amount={trabajoReduction}
                  deduction
                  accent="saving"
                />
              )}
              <Row
                label="Total gastos deducibles"
                hint="La suma de todo lo que se descuenta de tu salario bruto antes de tributar. Cuanto mayor sea, menos pagarás."
                amount={totalDeductions}
                deduction
                isTotal
                accent="saving"
              />
              <Row
                label="Rendimiento neto reducido"
                hint="Tu salario una vez descontados todos los gastos deducibles. Es la base sobre la que Hacienda calculará el impuesto."
                amount={taxResult.rendimientoNetoReducido}
                isTotal
              />
            </Section>

            {/* Cálculo del impuesto */}
            <Section
              icon="📊"
              title="Cálculo del IRPF"
              subtitle="Cómo se aplican los tramos progresivos a tu base imponible"
            >
              <Row
                label="Base imponible general"
                hint="El rendimiento neto sobre el que se aplican los tramos del IRPF. Si no tienes otras rentas (dividendos, alquileres…) coincide con el rendimiento neto reducido."
                amount={taxResult.baseImponibleGeneral}
              />
              <Row
                label="Mínimo personal y familiar"
                hint="La parte de tu renta que no tributa porque la ley considera que es imprescindible para vivir. Para 2025: 5.550 € base, más suplementos si tienes más de 65 años, hijos u otros dependientes (Art. 57–61 LIRPF). Este mínimo se aplica a los tramos más bajos."
                amount={taxResult.minimumPersonalFamiliar}
                deduction
                accent="saving"
              />
              <Row
                label="Cuota íntegra total"
                hint="El resultado de aplicar los tramos del IRPF (tarifa estatal + tarifa autonómica) a tu base imponible. Representa el impuesto teórico antes de descontar el efecto del mínimo personal."
                amount={taxResult.cuotaIntegraTOTAL}
              />
              <Row
                label="Cuota líquida (impuesto real)"
                hint="El IRPF definitivo que te corresponde pagar por este año. Es la cuota íntegra menos la cuota calculada sobre el mínimo personal y familiar, y menos la deducción por rendimientos del trabajo si procede (hasta 340 € para rentas bajas en 2025)."
                amount={taxResult.cuotaLiquidaTOTAL}
                isTotal
              />
              {/* State vs regional split */}
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Cuota estatal</p>
                  <p className="text-sm font-semibold text-gray-800">{fmt(taxResult.cuotaLiquidaEstatal)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tramos del Estado</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Cuota autonómica</p>
                  <p className="text-sm font-semibold text-gray-800">{fmt(taxResult.cuotaLiquidaAutonomica)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tramos de {REGION_LABELS[region]}</p>
                </div>
              </div>
            </Section>
          </div>

          {/* Resultado final */}
          <Section
            icon="🧾"
            title="Resultado de la declaración"
            subtitle="Comparación entre lo que ya has pagado vía retenciones y lo que realmente te corresponde"
          >
            <Row
              label="Impuesto que te corresponde (cuota líquida)"
              hint="El IRPF que legalmente debes pagar por tu renta de este año, calculado por el motor fiscal según las tablas oficiales de la AEAT."
              amount={taxResult.cuotaLiquidaTOTAL}
            />
            <Row
              label="Retenciones ya pagadas durante el año"
              hint="Lo que tu empresa ha ido ingresando a Hacienda en tu nombre con cada nómina. Este dinero ya está pagado: si es mayor que tu cuota, Hacienda te lo devuelve; si es menor, pagas la diferencia."
              amount={rentaResult.annualRetencionesNomina}
              deduction
              accent="paid"
            />
            {comp && (
              <Row
                label={
                  comp.diffType === 'overpaid'
                    ? 'A devolver — Hacienda te debe'
                    : comp.diffType === 'underpaid'
                    ? 'A ingresar — debes a Hacienda'
                    : 'Resultado equilibrado'
                }
                hint={
                  comp.diffType === 'overpaid'
                    ? `Has pagado ${fmt(Math.abs(comp.difference))} más de lo que te corresponde. Hacienda te ingresará esta cantidad tras presentar la declaración.`
                    : comp.diffType === 'underpaid'
                    ? `Tus retenciones no cubren todo el impuesto. Deberás abonar ${fmt(Math.abs(comp.difference))} al presentar la declaración.`
                    : 'Las retenciones cubren exactamente el impuesto calculado. La declaración no generará cargo ni devolución.'
                }
                amount={Math.abs(comp.difference)}
                isTotal
                accent={
                  comp.diffType === 'overpaid'
                    ? 'refund'
                    : comp.diffType === 'underpaid'
                    ? 'due'
                    : 'neutral'
                }
              />
            )}

            {/* Useful stats footer */}
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  label: 'Tipo efectivo IRPF',
                  value: fmtPct(effectiveRate, 1),
                  hint: 'Sobre salario bruto',
                },
                {
                  label: 'Cuota mensual media',
                  value: fmt(taxResult.cuotaLiquidaTOTAL / 12),
                  hint: 'Lo que te correspondería retener/mes',
                },
                {
                  label: 'Retención media real',
                  value:
                    monthsCount > 0
                      ? fmt(rentaResult.annualRetencionesNomina / monthsCount)
                      : '—',
                  hint: `Media de tus ${monthsCount} nóminas`,
                },
              ].map(({ label, value, hint }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                  <p className="text-base font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
                </div>
              ))}
            </div>
          </Section>

          {!rentaResult.taxResult && rentaResult.annualGross === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
              No se han podido extraer datos suficientes de las nóminas. Asegúrate de que los PDF
              contienen texto legible y no son documentos escaneados.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
