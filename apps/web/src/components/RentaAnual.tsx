import { useRef, useState } from 'react'
import type { RentaAnualResult, TaxResult, SpanishRegion, CivilStatus } from '@taxai/shared'
import { taxai } from '../api/taxai'
import { DownloadPDFButton } from './DownloadPDFButton'
import { RentaAnualPDF } from '../pdf/RentaAnualPDF'

interface RentaAnualProps {
  onResult: (result: TaxResult) => void
}

// ─── Investment entry (mirrors a row from the spreadsheet) ───────────────────

interface InvestmentEntry {
  id: string
  resultadoFiscal: string  // string so the input is controlled; parsed on submit
  retenciones: string
}

function makeEntry(): InvestmentEntry {
  return { id: crypto.randomUUID(), resultadoFiscal: '', retenciones: '' }
}

// ─── Labels ─────────────────────────────────────────────────────────────────

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

// ─── Formatters ─────────────────────────────────────────────────────────────

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

// ─── Explanation row ─────────────────────────────────────────────────────────

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
  const nominaRef = useRef<HTMLInputElement>(null)

  // Nómina inputs
  const [nominaFiles, setNominaFiles] = useState<File[]>([])
  const [isDraggingNomina, setIsDraggingNomina] = useState(false)

  // Personal data
  const [region, setRegion] = useState<SpanishRegion>('madrid')
  const [age, setAge] = useState(35)
  const [civilStatus, setCivilStatus] = useState<CivilStatus>('single')
  const [fiscalYear, setFiscalYear] = useState(2025)

  // Investment / savings income (replaces broker file upload)
  const [showInvestments, setShowInvestments] = useState(false)
  const [investmentEntries, setInvestmentEntries] = useState<InvestmentEntry[]>([makeEntry()])
  const [dividends, setDividends] = useState('')
  const [dividendWithholdings, setDividendWithholdings] = useState('')
  const [interestIncome, setInterestIncome] = useState('')
  const [interestWithholdings, setInterestWithholdings] = useState('')

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rentaResult, setRentaResult] = useState<RentaAnualResult | null>(null)
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null)

  // Parsed investment totals (stored after submit so results can display them)
  const [submittedSavings, setSubmittedSavings] = useState<{
    capitalGains: number
    dividends: number
    interest: number
    savingsWithholdings: number
  } | null>(null)

  // ── Nómina file helpers ───────────────────────────────────────────────────

  function addNominaFiles(list: FileList | File[] | null) {
    if (!list) return
    const pdfs = Array.from(list).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )
    setNominaFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name))
      const fresh = pdfs.filter((f) => !existing.has(f.name))
      return [...prev, ...fresh].slice(0, 12)
    })
  }

  function removeNominaFile(idx: number) {
    setNominaFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Investment entry helpers ──────────────────────────────────────────────

  function addEntry() {
    setInvestmentEntries((prev) => [...prev, makeEntry()])
  }

  function removeEntry(id: string) {
    setInvestmentEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function updateEntry(id: string, field: keyof Omit<InvestmentEntry, 'id'>, value: string): void {
    setInvestmentEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    )
  }

  // ── Derived savings totals ────────────────────────────────────────────────

  function parseSavings() {
    const capitalGains = investmentEntries.reduce(
      (sum, e) => sum + (parseFloat(e.resultadoFiscal.replace(',', '.')) || 0),
      0,
    )
    const investmentRetenciones = investmentEntries.reduce(
      (sum, e) => sum + (parseFloat(e.retenciones.replace(',', '.')) || 0),
      0,
    )
    const divAmount = parseFloat(dividends.replace(',', '.')) || 0
    const divRet = parseFloat(dividendWithholdings.replace(',', '.')) || 0
    const intAmount = parseFloat(interestIncome.replace(',', '.')) || 0
    const intRet = parseFloat(interestWithholdings.replace(',', '.')) || 0

    return {
      capitalGains,
      dividends: divAmount,
      interest: intAmount,
      savingsWithholdings: investmentRetenciones + divRet + intRet,
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nominaFiles.length === 0) return
    setLoading(true)
    setError(null)
    setRentaResult(null)
    setTaxResult(null)
    setSubmittedSavings(null)

    try {
      const rentaRes = await taxai.parseRenta({
        pdfs: nominaFiles,
        region,
        age,
        civilStatus,
        fiscalYear,
      })
      setRentaResult(rentaRes)

      const grossForEngine =
        rentaRes.annualBaseIRPF > 0 ? rentaRes.annualBaseIRPF : rentaRes.annualGross

      const savings = showInvestments ? parseSavings() : null
      const hasSavings =
        savings !== null &&
        (savings.capitalGains !== 0 ||
          savings.dividends > 0 ||
          savings.interest > 0 ||
          savings.savingsWithholdings > 0)

      const totalRetenciones =
        rentaRes.annualRetencionesNomina + (savings?.savingsWithholdings ?? 0)

      if (hasSavings && savings && grossForEngine > 0) {
        const combined = await taxai.calculate({
          fiscalYear,
          region,
          age,
          civilStatus,
          grossSalary: grossForEngine,
          retenciones: totalRetenciones,
          dependentsUnder25: 0,
          dependentsOver65: 0,
          ssContributions: rentaRes.annualSS > 0 ? rentaRes.annualSS : undefined,
          savingsIncome: {
            capitalGains: savings.capitalGains !== 0 ? savings.capitalGains : undefined,
            dividends: savings.dividends > 0 ? savings.dividends : undefined,
            interest: savings.interest > 0 ? savings.interest : undefined,
          },
        })
        setTaxResult(combined)
        setSubmittedSavings(savings)
        onResult(combined)
      } else if (grossForEngine > 0) {
        // Salary-only calculation
        const salaryResult = await taxai.calculate({
          fiscalYear,
          region,
          age,
          civilStatus,
          grossSalary: grossForEngine,
          retenciones: rentaRes.annualRetencionesNomina,
          dependentsUnder25: 0,
          dependentsOver65: 0,
          ssContributions: rentaRes.annualSS > 0 ? rentaRes.annualSS : undefined,
        })
        setTaxResult(salaryResult)
        onResult(salaryResult)
      } else if (rentaRes.taxResult) {
        setTaxResult(rentaRes.taxResult)
        onResult(rentaRes.taxResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived display values ────────────────────────────────────────────────

  const ssDeductions = rentaResult?.annualSS ?? 0
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
  const monthsCount = rentaResult?.months.length ?? 0
  const hasInvestments =
    submittedSavings !== null &&
    (submittedSavings.capitalGains !== 0 ||
      submittedSavings.dividends > 0 ||
      submittedSavings.interest > 0)

  // Total retenciones used in the calculation (for display in result section)
  const totalRetencionesPaid =
    (rentaResult?.annualRetencionesNomina ?? 0) + (submittedSavings?.savingsWithholdings ?? 0)

  // ── Styles ────────────────────────────────────────────────────────────────

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'

  const loadingLabel = loading
    ? `Analizando ${nominaFiles.length} nómina${nominaFiles.length !== 1 ? 's' : ''}…`
    : `Calcular Renta ${fiscalYear}`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Unified form ─────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5"
      >
        <div>
          <h2 className="font-semibold text-gray-900 text-base">Calcula tu Renta anual</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sube tus nóminas del año para calcular tu declaración. Si tienes ganancias por fondos,
            acciones, ETFs, criptomonedas u otros activos, activa la sección de inversiones.
          </p>
        </div>

        {/* ── Nóminas drop zone ─────────────────────────────────────────── */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Nóminas del año
          </label>
          <div
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer select-none transition-all ${
              isDraggingNomina
                ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                : nominaFiles.length > 0
                ? 'border-blue-300 bg-blue-50/40'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
            onClick={() => nominaRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingNomina(true) }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingNomina(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDraggingNomina(false)
              addNominaFiles(e.dataTransfer.files)
            }}
            onKeyDown={(e) => e.key === 'Enter' && nominaRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Seleccionar o arrastrar nóminas PDF"
          >
            <input
              ref={nominaRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addNominaFiles(e.target.files)}
            />
            <div className="text-2xl mb-1.5">
              {isDraggingNomina ? '📂' : nominaFiles.length > 0 ? '📑' : '📂'}
            </div>
            <p className="text-sm font-medium text-gray-700">
              {isDraggingNomina
                ? 'Suelta aquí tus nóminas'
                : nominaFiles.length > 0
                ? `${nominaFiles.length} nómina${nominaFiles.length !== 1 ? 's' : ''} · haz clic para añadir más`
                : 'Arrastra tus nóminas aquí o haz clic para seleccionar'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Hasta 12 PDF · 10 MB por archivo</p>
          </div>

          {nominaFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {nominaFiles.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-3 pr-1.5 py-1 text-xs font-medium max-w-[220px]"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeNominaFile(i) }}
                    className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 hover:bg-blue-300 flex items-center justify-center transition-colors leading-none text-blue-700 font-bold"
                    aria-label={`Eliminar ${f.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {nominaFiles.length < 12 && (
                <span className="text-xs text-gray-400 self-center">
                  {12 - nominaFiles.length} más disponibles
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Ganancias patrimoniales (optional) ────────────────────────── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setShowInvestments((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">📈</span>
              <span className="text-sm font-semibold text-gray-800">
                Ganancias patrimoniales e ingresos del ahorro
              </span>
              <span className="text-xs bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                Opcional
              </span>
            </div>
            <span className="text-gray-400 text-xs font-medium">
              {showInvestments ? '▲ Ocultar' : '▼ Mostrar'}
            </span>
          </button>

          {showInvestments && (
            <div className="px-4 py-4 space-y-5 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Introduce cada venta o reembolso de inversión por separado. El <strong>Resultado fiscal</strong> es
                la ganancia o pérdida neta (puede ser negativo). Las <strong>Retenciones</strong> son las
                cantidades que tu broker ya descontó al realizar la operación (Base del ahorro — Art. 46 LIRPF).
              </p>

              {/* ── Column headers with descriptions ──────────────────── */}
              <div className="grid grid-cols-[1fr_1fr_32px] gap-2 mb-1">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Ganancia / Pérdida neta</p>
                  <p className="text-xs text-gray-400 leading-relaxed mt-0.5">
                    Importe del campo "Resultado fiscal" en el informe de tu broker. Puede ser
                    negativo si perdiste dinero.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Retención ya aplicada</p>
                  <p className="text-xs text-gray-400 leading-relaxed mt-0.5">
                    Lo que el broker ya descontó automáticamente al vender (campo "Retenciones"
                    en el informe). Ponlo en 0 si no te retuvieron nada.
                  </p>
                </div>
                <div />
              </div>

              {/* ── Investment rows ────────────────────────────────────── */}
              <div className="space-y-2">
                {investmentEntries.map((entry, idx) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none select-none">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej: 141,18 o −320,00"
                        value={entry.resultadoFiscal}
                        onChange={(e) => updateEntry(entry.id, 'resultadoFiscal', e.target.value)}
                        className={`${inputCls} pl-7`}
                      />
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ej: 26,82"
                      value={entry.retenciones}
                      onChange={(e) => updateEntry(entry.id, 'retenciones', e.target.value)}
                      className={inputCls}
                    />
                    {investmentEntries.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-colors text-base leading-none"
                        aria-label="Eliminar fila"
                      >
                        ×
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addEntry}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
              >
                + Añadir inversión
              </button>

              {/* ── Dividends ─────────────────────────────────────────── */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Dividendos e intereses
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Dividendos brutos (€)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={dividends}
                      onChange={(e) => setDividends(e.target.value)}
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Art. 25.1 LIRPF — acciones y fondos
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Retenciones sobre dividendos (€)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={dividendWithholdings}
                      onChange={(e) => setDividendWithholdings(e.target.value)}
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Retenido por el broker (19 % típico)
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Intereses brutos (€)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={interestIncome}
                      onChange={(e) => setInterestIncome(e.target.value)}
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Art. 25.2 LIRPF — cuentas, bonos, p2p
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Retenciones sobre intereses (€)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={interestWithholdings}
                      onChange={(e) => setInterestWithholdings(e.target.value)}
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Retenido por la entidad financiera
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Live preview of totals ─────────────────────────────── */}
              {(() => {
                const preview = parseSavings()
                const anyValue =
                  preview.capitalGains !== 0 ||
                  preview.dividends > 0 ||
                  preview.interest > 0 ||
                  preview.savingsWithholdings > 0
                if (!anyValue) return null
                return (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-indigo-500 font-semibold mb-0.5">Total ganancias</p>
                      <p className={`font-bold text-sm ${preview.capitalGains < 0 ? 'text-red-600' : 'text-indigo-800'}`}>
                        {fmt(preview.capitalGains)}
                      </p>
                    </div>
                    {preview.dividends > 0 && (
                      <div>
                        <p className="text-indigo-500 font-semibold mb-0.5">Dividendos</p>
                        <p className="font-bold text-sm text-indigo-800">{fmt(preview.dividends)}</p>
                      </div>
                    )}
                    {preview.interest > 0 && (
                      <div>
                        <p className="text-indigo-500 font-semibold mb-0.5">Intereses</p>
                        <p className="font-bold text-sm text-indigo-800">{fmt(preview.interest)}</p>
                      </div>
                    )}
                    {preview.savingsWithholdings > 0 && (
                      <div>
                        <p className="text-indigo-500 font-semibold mb-0.5">Retenciones del ahorro</p>
                        <p className="font-bold text-sm text-indigo-800">
                          {fmt(preview.savingsWithholdings)}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* ── Personal data ─────────────────────────────────────────────── */}
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
          disabled={nominaFiles.length === 0 || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {loading && (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {loadingLabel}
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

          {/* Download button */}
          <div className="flex justify-end">
            <DownloadPDFButton
              pdfDocument={<RentaAnualPDF rentaResult={rentaResult} />}
              filename={`taxai-renta-${fiscalYear}-${region}.pdf`}
            />
          </div>

          {/* Hero card */}
          <div
            className={`rounded-2xl p-6 text-white shadow-md ${
              taxResult.resultType === 'a_devolver'
                ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                : taxResult.resultType === 'a_ingresar'
                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                : 'bg-gradient-to-br from-emerald-600 to-teal-700'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">
              {taxResult.resultType === 'a_devolver'
                ? 'A devolver'
                : taxResult.resultType === 'a_ingresar'
                ? 'A ingresar'
                : 'Resultado'}{' '}
              · Renta {fiscalYear}
            </p>
            <p className="text-5xl font-bold tracking-tight leading-none">
              {fmt(Math.abs(taxResult.resultAmount))}
            </p>
            <p className="text-sm text-white/80 mt-2">
              {taxResult.resultType === 'a_devolver' &&
                'Hacienda te devolverá esta cantidad al presentar la declaración'}
              {taxResult.resultType === 'a_ingresar' &&
                'Deberás pagar esta cantidad al presentar la declaración'}
              {taxResult.resultType === 'cero' &&
                'Tu declaración está equilibrada — retenciones y cuota coinciden'}
              {hasInvestments && (
                <span className="block mt-1 text-white/70">
                  Incluye salario como empleado/a + ingresos de inversiones
                </span>
              )}
            </p>

            {/* KPI chips */}
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                Tipo efectivo {fmtPct(effectiveRate, 1)}
              </span>
              <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                {monthsCount} nómina{monthsCount !== 1 ? 's' : ''} procesada{monthsCount !== 1 ? 's' : ''}
              </span>
              {ssDeductions > 0 && (
                <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                  SS pagada {fmt(ssDeductions)}
                </span>
              )}
              {hasInvestments && (
                <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold">
                  + ingresos de inversiones
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
                      <td className="px-4 py-3 text-right">
                        {fmt(rentaResult.annualRetencionesNomina)}
                      </td>
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

          {/* Investment summary — only shown when savings data was included */}
          {hasInvestments && submittedSavings && (
            <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/40">
                <div className="flex items-center gap-2">
                  <span className="text-base">📈</span>
                  <h3 className="font-semibold text-gray-900">Ingresos del ahorro incluidos</h3>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Base del ahorro (Art. 46 LIRPF) — ya incluida en el resultado de arriba
                </p>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                {submittedSavings.capitalGains !== 0 && (
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-700">Ganancias / pérdidas patrimoniales</p>
                      <p className="text-xs text-gray-400">
                        Suma de los resultados fiscales introducidos — Art. 33 LIRPF
                      </p>
                    </div>
                    <span
                      className={`font-semibold text-sm ${
                        submittedSavings.capitalGains < 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {fmt(submittedSavings.capitalGains)}
                    </span>
                  </div>
                )}
                {submittedSavings.dividends > 0 && (
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-700">Dividendos</p>
                    <span className="font-semibold text-sm text-gray-900">
                      {fmt(submittedSavings.dividends)}
                    </span>
                  </div>
                )}
                {submittedSavings.interest > 0 && (
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-700">Intereses</p>
                    <span className="font-semibold text-sm text-gray-900">
                      {fmt(submittedSavings.interest)}
                    </span>
                  </div>
                )}
                {submittedSavings.savingsWithholdings > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm text-gray-700">Retenciones del ahorro ya pagadas</p>
                      <p className="text-xs text-gray-400">
                        Descontadas del resultado final junto con las retenciones de nómina
                      </p>
                    </div>
                    <span className="font-semibold text-sm text-blue-600">
                      {fmt(submittedSavings.savingsWithholdings)}
                    </span>
                  </div>
                )}
                {taxResult.baseImponibleAhorro > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Base imponible del ahorro
                      </p>
                      <p className="text-xs text-gray-400">
                        Tipos: 19% hasta 6.000 €, 21% hasta 50.000 €, 23% hasta 200.000 €…
                      </p>
                    </div>
                    <span className="font-semibold text-sm text-gray-900">
                      {fmt(taxResult.baseImponibleAhorro)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Fiscal breakdown ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Gastos deducibles */}
            <Section
              icon="🟢"
              title="Gastos deducibles del trabajo"
              subtitle="Importes que reducen tu base imponible antes de calcular el impuesto"
            >
              {hasExemptBenefits && (
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                  Tu nómina incluye conceptos exentos de IRPF (p.ej. tickets restaurante, seguro
                  médico) que reducen la base IRPF respecto al total devengado.
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
              {taxResult.baseImponibleAhorro > 0 && (
                <Row
                  label="Base imponible del ahorro"
                  hint="Ganancias patrimoniales, dividendos e intereses tributan aquí a tipos especiales (19–28%), separados de la base general (Art. 46 LIRPF)."
                  amount={taxResult.baseImponibleAhorro}
                />
              )}
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
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Cuota estatal</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {fmt(taxResult.cuotaLiquidaEstatal)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Tramos del Estado</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Cuota autonómica</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {fmt(taxResult.cuotaLiquidaAutonomica)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Tramos de {REGION_LABELS[region]}</p>
                </div>
              </div>
            </Section>
          </div>

          {/* Resultado final */}
          <Section
            icon="🧾"
            title="Resultado de la declaración"
            subtitle={
              hasInvestments
                ? 'Cuota total sobre salario + inversiones, comparada con el total de retenciones'
                : 'Comparación entre lo que ya has pagado vía retenciones y lo que realmente te corresponde'
            }
          >
            {hasInvestments && taxResult.baseImponibleAhorro > 0 && (
              <div className="mb-3 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800 space-y-1">
                <p className="font-semibold">¿Por qué puede haber una cantidad a ingresar?</p>
                <p>
                  Las retenciones de tus nóminas solo cubren el IRPF de tu salario. Los ingresos de
                  inversiones (ganancias, dividendos, intereses) tributan en la{' '}
                  <strong>base del ahorro</strong>. Si el broker no retuvo lo suficiente, la
                  diferencia se liquida al presentar la declaración.
                </p>
                <div className="pt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span className="text-indigo-600">Base general (salario)</span>
                  <span className="font-semibold text-right">
                    {fmt(taxResult.baseImponibleGeneral)}
                  </span>
                  <span className="text-indigo-600">Base del ahorro (inversiones)</span>
                  <span className="font-semibold text-right">
                    {fmt(taxResult.baseImponibleAhorro)}
                  </span>
                </div>
              </div>
            )}
            <Row
              label="Impuesto que te corresponde (cuota líquida)"
              hint={
                hasInvestments
                  ? 'Suma de la cuota sobre tu salario (base general) y la cuota sobre tus inversiones (base del ahorro), según tablas AEAT.'
                  : 'El IRPF que legalmente debes pagar por tu renta de este año, calculado por el motor fiscal según las tablas oficiales de la AEAT.'
              }
              amount={taxResult.cuotaLiquidaTOTAL}
            />
            <Row
              label={
                hasInvestments
                  ? 'Retenciones totales ya pagadas (nóminas + ahorro)'
                  : 'Retenciones ya pagadas durante el año'
              }
              hint={
                hasInvestments
                  ? `Retenciones de nómina (${fmt(rentaResult.annualRetencionesNomina)}) más las retenciones del broker sobre inversiones (${fmt(submittedSavings?.savingsWithholdings ?? 0)}).`
                  : 'Lo que tu empresa ha ido ingresando a Hacienda en tu nombre con cada nómina. Este dinero ya está pagado: si es mayor que tu cuota, Hacienda te lo devuelve; si es menor, pagas la diferencia.'
              }
              amount={totalRetencionesPaid}
              deduction
              accent="paid"
            />
            <Row
              label={
                taxResult.resultType === 'a_devolver'
                  ? 'A devolver — Hacienda te debe'
                  : taxResult.resultType === 'a_ingresar'
                  ? 'A ingresar — debes a Hacienda'
                  : 'Resultado equilibrado'
              }
              hint={
                taxResult.resultType === 'a_devolver'
                  ? `Has pagado ${fmt(Math.abs(taxResult.resultAmount))} más de lo que te corresponde. Hacienda te ingresará esta cantidad tras presentar la declaración.`
                  : taxResult.resultType === 'a_ingresar'
                  ? `Tus retenciones no cubren todo el impuesto. Deberás abonar ${fmt(Math.abs(taxResult.resultAmount))} al presentar la declaración.`
                  : 'Las retenciones cubren exactamente el impuesto calculado. La declaración no generará cargo ni devolución.'
              }
              amount={Math.abs(taxResult.resultAmount)}
              isTotal
              accent={
                taxResult.resultType === 'a_devolver'
                  ? 'refund'
                  : taxResult.resultType === 'a_ingresar'
                  ? 'due'
                  : 'neutral'
              }
            />

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
