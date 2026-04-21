import { useState } from 'react'
import type { TaxResult } from './types'
import { MOCK_RESULT } from './mocks/taxResult'
import { ResultDashboard } from './components/ResultDashboard'
import { WaterfallChart } from './components/WaterfallChart'
import { InputForm } from './components/InputForm'
import { ChatInput } from './components/ChatInput'
import { ExplanationPanel } from './components/ExplanationPanel'

type InputTab = 'form' | 'chat'

export default function App() {
  // Start with mock data so the dashboard is visible during Phase 0 development.
  // Replace with null and remove MOCK_RESULT import once API is wired up.
  const [result, setResult] = useState<TaxResult | null>(MOCK_RESULT)
  const [activeTab, setActiveTab] = useState<InputTab>('form')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">Taxai</span>
          </div>
          <span className="text-gray-400 text-sm">Calculadora IRPF 2024</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Input section */}
        <section>
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none ${
                activeTab === 'form'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Formulario
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none ${
                activeTab === 'chat'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Chat
            </button>
          </div>

          {activeTab === 'form' ? (
            <InputForm onResult={setResult} />
          ) : (
            <ChatInput onResult={setResult} />
          )}
        </section>

        {/* Results section */}
        {result ? (
          <section className="space-y-4" aria-label="Resultados de la declaración">
            <ResultDashboard result={result} />
            <WaterfallChart steps={result.waterfallSteps} />
            <ExplanationPanel result={result} />
          </section>
        ) : (
          <section className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg font-medium text-gray-500">Introduce tus datos para ver tu declaración</p>
            <p className="text-sm mt-2">Rellena el formulario o cuéntanoslo por chat</p>
          </section>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-gray-400 border-t border-gray-100 mt-8">
        Taxai · Solo orientativo · Consulta siempre a un asesor fiscal para tu declaración oficial
      </footer>
    </div>
  )
}
