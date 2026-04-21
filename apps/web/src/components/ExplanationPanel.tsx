import { useState } from 'react'
import type { TaxResult } from '@taxai/shared'
import { taxai } from '../api/taxai'

interface ExplanationPanelProps {
  result: TaxResult
}

const SUGGESTIONS = [
  '¿Por qué pago tanto IRPF?',
  '¿Qué es la cuota líquida?',
  '¿Cómo afecta tener hijos a mi declaración?',
  '¿Qué significa rendimiento neto reducido?',
]

export function ExplanationPanel({ result }: ExplanationPanelProps) {
  const [question, setQuestion] = useState('')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAsk(q?: string) {
    const text = (q ?? question).trim()
    if (!text) return
    if (q) setQuestion(q)
    setError(null)
    setLoading(true)
    setExplanation(null)
    try {
      const res = await taxai.explain(result, text)
      setExplanation(res.explanation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener la explicación. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <h2 className="font-semibold text-gray-900 text-base">¿Tienes dudas?</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Pregunta lo que quieras sobre tu declaración y te lo explicamos en lenguaje sencillo.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Suggestion chips */}
        {!explanation && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleAsk(s)}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="relative">
          <label htmlFor="explanation-question" className="sr-only">Tu pregunta</label>
          <textarea
            id="explanation-question"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Escribe tu pregunta aquí… (Enter para enviar)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={() => handleAsk()}
          disabled={loading || !question.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 px-4 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Consultando…
            </span>
          ) : (
            'Preguntar'
          )}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        {explanation && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                Respuesta de Taxai
              </p>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {explanation}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setExplanation(null); setQuestion('') }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Hacer otra pregunta
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
