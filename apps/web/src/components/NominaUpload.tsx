import { useRef, useState } from 'react'
import type { NominaParseResult, TaxResult, SpanishRegion, CivilStatus } from '@taxai/shared'
import { taxai } from '../api/taxai'

interface NominaUploadProps {
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

function fmtPct(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

export function NominaUpload({ onResult }: NominaUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [region, setRegion] = useState<SpanishRegion>('madrid')
  const [age, setAge] = useState<number>(35)
  const [civilStatus, setCivilStatus] = useState<CivilStatus>('single')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<NominaParseResult | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setParseResult(null)

    try {
      const result = await taxai.parseNomina({ pdf: file, region, age, civilStatus })
      setParseResult(result)
      if (result.taxResult) {
        onResult(result.taxResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const comp = parseResult?.comparison
  const nomina = parseResult?.nomina

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Sube tu nómina en PDF y calcularemos si la retención IRPF que te aplica tu empresa
          es correcta según el método oficial de la Agencia Tributaria.
        </p>

        {/* PDF upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivo PDF de la nómina
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div>
                <div className="text-blue-600 font-medium">{file.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(0)} KB · Haz clic para cambiar
                </div>
              </div>
            ) : (
              <div>
                <div className="text-gray-400 text-3xl mb-2">📄</div>
                <div className="text-sm text-gray-500">Haz clic para seleccionar tu nómina en PDF</div>
                <div className="text-xs text-gray-400 mt-1">Máximo 10 MB</div>
              </div>
            )}
          </div>
        </div>

        {/* Personal data for calculation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comunidad autónoma</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as SpanishRegion)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REGIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
            <input
              type="number"
              min={16}
              max={99}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado civil</label>
            <select
              value={civilStatus}
              onChange={(e) => setCivilStatus(e.target.value as CivilStatus)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="single">Soltero/a</option>
              <option value="married">Casado/a</option>
              <option value="widowed">Viudo/a</option>
              <option value="separated">Separado/a</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analizando nómina…' : 'Analizar nómina'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>

      {/* Results */}
      {parseResult && (
        <div className="space-y-4">
          {/* Extracted nomina data */}
          {nomina && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Datos extraídos de la nómina</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {nomina.period && (
                  <div>
                    <dt className="text-gray-500">Período</dt>
                    <dd className="font-medium text-gray-900 capitalize">{nomina.period}</dd>
                  </div>
                )}
                {nomina.monthlyGross !== undefined && (
                  <div>
                    <dt className="text-gray-500">Total Devengado / mes</dt>
                    <dd className="font-medium text-gray-900">{fmt(nomina.monthlyGross)}</dd>
                  </div>
                )}
                {nomina.monthlyBaseIRPF !== undefined && nomina.monthlyBaseIRPF !== nomina.monthlyGross && (
                  <div>
                    <dt className="text-gray-500">Base I.R.P.F. / mes</dt>
                    <dd className="font-medium text-gray-900">{fmt(nomina.monthlyBaseIRPF)}</dd>
                  </div>
                )}
                {parseResult.annualGross > 0 && (
                  <div>
                    <dt className="text-gray-500">Salario bruto anual</dt>
                    <dd className="font-medium text-gray-900">{fmt(parseResult.annualGross)}</dd>
                  </div>
                )}
                {parseResult.annualBaseIRPF > 0 && parseResult.annualBaseIRPF !== parseResult.annualGross && (
                  <div>
                    <dt className="text-gray-500">Base I.R.P.F. anual</dt>
                    <dd className="font-medium text-gray-900 text-blue-700">{fmt(parseResult.annualBaseIRPF)}</dd>
                  </div>
                )}
                {nomina.monthlyRetenciones !== undefined && (
                  <div>
                    <dt className="text-gray-500">Retención mensual</dt>
                    <dd className="font-medium text-gray-900">{fmt(nomina.monthlyRetenciones)}</dd>
                  </div>
                )}
                {nomina.retentionPercentage !== undefined && (
                  <div>
                    <dt className="text-gray-500">Tipo retención</dt>
                    <dd className="font-medium text-gray-900">{fmtPct(nomina.retentionPercentage)}</dd>
                  </div>
                )}
                {nomina.monthlySSEmployee !== undefined && (
                  <div>
                    <dt className="text-gray-500">SS empleado/mes</dt>
                    <dd className="font-medium text-gray-900">{fmt(nomina.monthlySSEmployee)}</dd>
                  </div>
                )}
                {parseResult.annualRetencionesNomina > 0 && (
                  <div>
                    <dt className="text-gray-500">Retención anual estimada</dt>
                    <dd className="font-medium text-gray-900">{fmt(parseResult.annualRetencionesNomina)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Comparison card */}
          {comp && (
            <div
              className={`rounded-xl p-5 border-2 ${
                comp.diffType === 'correct'
                  ? 'bg-green-50 border-green-300'
                  : comp.diffType === 'overpaid'
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-amber-50 border-amber-300'
              }`}
            >
              <h3 className="font-semibold text-gray-800 mb-1">
                {comp.diffType === 'correct' && 'Retención correcta'}
                {comp.diffType === 'overpaid' && 'Te están reteniendo de más'}
                {comp.diffType === 'underpaid' && 'Te están reteniendo de menos'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {comp.diffType === 'correct' &&
                  'La retención aplicada por tu empresa coincide con el impuesto calculado. Probable resultado: cero.'}
                {comp.diffType === 'overpaid' &&
                  'Tu empresa te retiene más IRPF del necesario. Es probable que tengas una devolución en la declaración anual.'}
                {comp.diffType === 'underpaid' &&
                  'Tu empresa te retiene menos IRPF del necesario. Puede que tengas que pagar en la declaración anual.'}
              </p>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Retención aplicada</div>
                  <div className="text-lg font-bold text-gray-900">{fmt(comp.retencionesFromNomina)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Impuesto calculado</div>
                  <div className="text-lg font-bold text-gray-900">{fmt(comp.calculatedTax)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Diferencia</div>
                  <div
                    className={`text-lg font-bold ${
                      comp.diffType === 'correct'
                        ? 'text-green-700'
                        : comp.diffType === 'overpaid'
                        ? 'text-blue-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {comp.difference >= 0 ? '+' : ''}{fmt(comp.difference)}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center text-xs text-gray-500">
                Desviación: {fmtPct(comp.percentageDiff)} respecto al impuesto calculado
              </div>
            </div>
          )}

          {!parseResult.taxResult && parseResult.annualGross === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              No se han podido extraer datos suficientes de la nómina para realizar el cálculo.
              Asegúrate de que el PDF contiene texto legible y no es un documento escaneado.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
