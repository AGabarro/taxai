import { useState, useEffect } from 'react'
import { getApiKey, setApiKey, clearApiKey } from '../utils/apiKey'

export function ApiKeyBanner() {
  const [draft, setDraft] = useState('')
  const [isSet, setIsSet] = useState(false)

  useEffect(() => {
    setIsSet(!!getApiKey())
  }, [])

  function handleSave() {
    const key = draft.trim()
    if (!key) return
    setApiKey(key)
    setDraft('')
    setIsSet(true)
  }

  function handleClear() {
    clearApiKey()
    setIsSet(false)
  }

  return (
    <div className="bg-white border-b border-gray-100 text-sm">
      <div className="max-w-4xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">
          Clave API
        </span>

        {isSet ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-600 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Activa — funciones IA disponibles
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Eliminar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="sk-ant-api03-…"
              className="border border-gray-200 bg-gray-50 rounded-lg px-2.5 py-1 text-xs font-mono w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!draft.trim()}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Guardar
            </button>
            <span className="text-gray-400 text-xs">
              Necesaria para Nómina y Explicaciones ·{' '}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 transition-colors"
              >
                Obtener clave
              </a>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
