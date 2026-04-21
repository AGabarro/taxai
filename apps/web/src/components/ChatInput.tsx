import { useState } from 'react'
import type { TaxInput, TaxResult, SpanishRegion } from '@taxai/shared'
import { taxai } from '../api/taxai'

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

interface ChatInputProps {
  onResult: (result: TaxResult) => void
}

export function ChatInput({ onResult }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [extracted, setExtracted] = useState<Partial<TaxInput> | null>(null)
  const [loadingExtract, setLoadingExtract] = useState(false)
  const [loadingCalculate, setLoadingCalculate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    if (!message.trim()) return
    setError(null)
    setLoadingExtract(true)
    try {
      const partial = await taxai.extract(message)
      setExtracted(partial)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al analizar el mensaje. Inténtalo de nuevo.')
    } finally {
      setLoadingExtract(false)
    }
  }

  async function handleConfirmCalculate() {
    if (!extracted) return
    setError(null)
    setLoadingCalculate(true)
    try {
      const input = extracted as TaxInput
      const result = await taxai.calculate(input)
      onResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al calcular. Inténtalo de nuevo.')
    } finally {
      setLoadingCalculate(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div>
        <label htmlFor="chatMessage" className="block text-sm font-medium text-gray-700 mb-2">
          Cuéntanos tu situación
        </label>
        <textarea
          id="chatMessage"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          placeholder="Ej: Tengo 35 años, vivo en Madrid y gané 40.000€ el año pasado. Me retuvieron 7.200€ y no tengo hijos."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loadingExtract || !message.trim()}
        className="w-full rounded-lg bg-blue-600 text-white font-semibold py-3 px-4 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {loadingExtract ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Analizando…
          </span>
        ) : (
          'Analizar'
        )}
      </button>

      {extracted && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Datos detectados — revisa y confirma:</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
            {extracted.region && (
              <div><span className="font-medium">Comunidad:</span> {REGION_NAMES[extracted.region]}</div>
            )}
            {extracted.age !== undefined && (
              <div><span className="font-medium">Edad:</span> {extracted.age} años</div>
            )}
            {extracted.grossSalary !== undefined && (
              <div><span className="font-medium">Salario bruto:</span> {extracted.grossSalary.toLocaleString('es-ES')} €</div>
            )}
            {extracted.retenciones !== undefined && (
              <div><span className="font-medium">Retenciones:</span> {extracted.retenciones.toLocaleString('es-ES')} €</div>
            )}
            {extracted.dependentsUnder25 !== undefined && (
              <div><span className="font-medium">Dependientes &lt;25:</span> {extracted.dependentsUnder25}</div>
            )}
            {extracted.civilStatus && (
              <div>
                <span className="font-medium">Estado civil:</span>{' '}
                {{ single: 'Soltero/a', married: 'Casado/a', widowed: 'Viudo/a', separated: 'Separado/a' }[extracted.civilStatus]}
              </div>
            )}
          </div>
          <p className="text-xs text-blue-600">
            Si algún dato no es correcto, usa el formulario detallado en su lugar.
          </p>
          <button
            type="button"
            onClick={handleConfirmCalculate}
            disabled={loadingCalculate}
            className="w-full rounded-lg bg-green-600 text-white font-semibold py-2 px-4 text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingCalculate ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Calculando…
              </span>
            ) : (
              'Confirmar y calcular'
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
