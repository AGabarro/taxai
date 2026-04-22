import { useRef, useState } from 'react'
import type { BrokerParseResult, SpanishRegion, CivilStatus, TaxResult } from '@taxai/shared'
import { taxai } from '../api/taxai'

interface BrokerUploadProps {
  onResult: (result: TaxResult | null) => void
  onMergeSavings?: (capitalGains: number, dividends: number, interest: number) => void
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

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'

export function BrokerUpload({ onResult, onMergeSavings }: BrokerUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [region, setRegion] = useState<SpanishRegion>('madrid')
  const [age, setAge] = useState<number>(35)
  const [civilStatus, setCivilStatus] = useState<CivilStatus>('single')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<BrokerParseResult | null>(null)

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setParseResult(null)
    try {
      const result = await taxai.parseBrokerReport({ file, region, age, civilStatus })
      setParseResult(result)
      if (result.taxResult) onResult(result.taxResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  function handleMerge() {
    if (!parseResult || !onMergeSavings) return
    onMergeSavings(
      parseResult.computedCapitalGains,
      parseResult.computedDividends,
      parseResult.computedInterest,
    )
  }

  const r = parseResult

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5"
      >
        <div>
          <h2 className="font-semibold text-gray-900 text-base">Analiza tu informe de inversiones</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sube el informe anual de tu broker (PDF o CSV). Calculamos tus ganancias patrimoniales con FIFO (Art. 35 LIRPF).
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer select-none transition-all ${
            isDragging
              ? 'border-blue-400 bg-blue-50 scale-[1.01]'
              : file
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
          aria-label="Seleccionar o arrastrar informe de broker"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf,.csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div>
              <div className="text-2xl mb-2">📊</div>
              <p className="text-sm font-semibold text-blue-700">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(file.size / 1024).toFixed(0)} KB · Haz clic o arrastra para cambiar
              </p>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2">{isDragging ? '📂' : '📈'}</div>
              <p className="text-sm font-medium text-gray-700">
                {isDragging ? 'Suelta aquí tu informe' : 'Arrastra tu informe aquí o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF o CSV · Máximo 10 MB</p>
            </div>
          )}
        </div>

        {/* Personal data */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              {
                id: 'region',
                label: 'Comunidad autónoma',
                node: (
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as SpanishRegion)}
                    className={inputCls}
                  >
                    {REGIONS.map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
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
          disabled={!file || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analizando informe…
            </span>
          ) : (
            'Analizar informe de inversiones'
          )}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>

      {/* Results */}
      {r && (
        <div className="space-y-4">

          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-base">
                  Resumen de inversiones
                  {r.brokerReport.brokerName && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      · {r.brokerReport.brokerName}
                    </span>
                  )}
                </h3>
                <span className="text-xs text-gray-400">
                  Ejercicio {r.brokerReport.fiscalYear}
                </span>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Capital gains */}
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm text-gray-700">Ganancias / pérdidas patrimoniales</p>
                  <p className="text-xs text-gray-400 mt-0.5">Acciones y fondos — FIFO Art. 35 LIRPF</p>
                </div>
                <span className={`font-mono text-sm font-semibold ${r.computedCapitalGains < 0 ? 'text-red-600' : r.computedCapitalGains > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {fmt(r.computedCapitalGains)}
                </span>
              </div>

              {/* Dividends */}
              {r.computedDividends > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div>
                    <p className="text-sm text-gray-700">Dividendos</p>
                    <p className="text-xs text-gray-400 mt-0.5">Rendimientos del capital mobiliario</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-gray-900">{fmt(r.computedDividends)}</span>
                </div>
              )}

              {/* Interest */}
              {r.computedInterest > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div>
                    <p className="text-sm text-gray-700">Intereses</p>
                    <p className="text-xs text-gray-400 mt-0.5">Cuentas, bonos, depósitos</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-gray-900">{fmt(r.computedInterest)}</span>
                </div>
              )}

              {/* Foreign tax withheld */}
              {r.totalForeignTaxWithheld > 0 && (
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="text-sm text-gray-700">Impuesto extranjero retenido</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Acreditable contra la cuota íntegra — consúltalo con tu asesor
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-amber-600">
                    {fmt(r.totalForeignTaxWithheld)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Warnings */}
          {r.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Avisos</p>
              <ul className="space-y-1">
                {r.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-800">
                    · {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transactions count */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Transacciones procesadas
            </p>
            <p className="text-sm text-gray-700">
              {r.brokerReport.transactions.length} transacciones extraídas
              {r.brokerReport.transactions.length > 0 && (
                <span className="text-gray-400 ml-1">
                  ({r.brokerReport.transactions.filter(t => t.transactionType === 'buy').length} compras,{' '}
                  {r.brokerReport.transactions.filter(t => t.transactionType === 'sell').length} ventas,{' '}
                  {r.brokerReport.transactions.filter(t => t.transactionType === 'dividend').length} dividendos)
                </span>
              )}
            </p>
          </div>

          {/* Merge button */}
          {onMergeSavings && (r.computedCapitalGains !== 0 || r.computedDividends > 0 || r.computedInterest > 0) && (
            <button
              type="button"
              onClick={handleMerge}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              Usar estos datos en mi declaración
            </button>
          )}
        </div>
      )}
    </div>
  )
}
