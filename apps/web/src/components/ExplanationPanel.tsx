import { useState } from 'react'
import type { TaxResult } from '@taxai/shared'
import { taxai } from '../api/taxai'

interface ExplanationPanelProps {
  result: TaxResult
}

export function ExplanationPanel({ result }: ExplanationPanelProps) {
  const [question, setQuestion] = useState('')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAsk() {
    if (!question.trim()) return
    setError(null)
    setLoading(true)
    try {
      const res = await taxai.explain(result, question)
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
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div className="px-0 pb-2 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          ¿Tienes dudas sobre tu resultado?
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Pregunta lo que quieras sobre tu declaración y te lo explicamos.
        </p>
      </div>

      <div>
        <label htmlFor="question" className="sr-only">Tu pregunta</label>
        <textarea
          id="question"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="¿Tienes alguna pregunta sobre tu resultado?"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        type="button"
        onClick={handleAsk}
        disabled={loading || !question.trim()}
        className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2 px-4 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Consultando…
          </span>
        ) : (
          'Preguntar'
        )}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {explanation && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Explicación</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{explanation}</p>
        </div>
      )}
    </div>
  )
}
