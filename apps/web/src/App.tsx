import { useState, useCallback } from 'react'
import type { TaxResult } from '@taxai/shared'
import { ResultDashboard } from './components/ResultDashboard'
import { WaterfallChart } from './components/WaterfallChart'
import { TaxBreakdownCharts } from './components/TaxBreakdownCharts'
import { InputForm } from './components/InputForm'
import { ExplanationPanel } from './components/ExplanationPanel'
import { NominaUpload } from './components/NominaUpload'
import { RentaAnual } from './components/RentaAnual'
import { ApiKeyBanner } from './components/ApiKeyBanner'
import { DownloadPDFButton } from './components/DownloadPDFButton'
import { TaxResultPDF } from './pdf/TaxResultPDF'

type InputTab = 'form' | 'nomina' | 'renta'

const TABS: { id: InputTab; label: string; description: string }[] = [
  { id: 'form',   label: 'Formulario',     description: 'Introduce tus datos manualmente' },
  { id: 'nomina', label: 'Nómina mensual', description: 'Sube una nómina PDF y analiza tu retención' },
  { id: 'renta',  label: 'Renta anual',    description: 'Sube las 12 nóminas y calcula tu declaración' },
]

export default function App() {
  const [results, setResults] = useState<Partial<Record<InputTab, TaxResult>>>({})
  const [activeTab, setActiveTab] = useState<InputTab>('form')

  const result = results[activeTab] ?? null

  // Stable, tab-specific setters — each component always writes to its own slot
  // regardless of which tab is currently visible.
  const setFormResult   = useCallback((r: TaxResult | null) => setResults(p => ({ ...p, form:   r ?? undefined })), [])
  const setNominaResult = useCallback((r: TaxResult | null) => setResults(p => ({ ...p, nomina: r ?? undefined })), [])
  const setRentaResult  = useCallback((r: TaxResult | null) => setResults(p => ({ ...p, renta:  r ?? undefined })), [])

  function switchTab(tab: InputTab) {
    setActiveTab(tab)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <span className="text-white text-sm font-black tracking-tight">T</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-gray-900 text-lg leading-none">Taxai</span>
              <span className="text-gray-400 text-xs hidden sm:inline">Calculadora IRPF</span>
            </div>
          </div>
        </div>
      </header>

      <ApiKeyBanner />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-7">
        {/* ── Tab switcher ──────────────────────────────────────────────── */}
        <section>
          <nav className="flex gap-1.5 mb-6" role="tablist">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => switchTab(id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  activeTab === id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* All three panels stay mounted so in-flight requests and local
              state (file selection, loading spinner) survive tab switches.
              Only the active panel is visible. */}
          <div className={activeTab === 'form'   ? '' : 'hidden'}><InputForm    onResult={setFormResult}   /></div>
          <div className={activeTab === 'nomina' ? '' : 'hidden'}><NominaUpload onResult={setNominaResult} /></div>
          <div className={activeTab === 'renta'  ? '' : 'hidden'}><RentaAnual   onResult={setRentaResult}  /></div>
        </section>

        {/* ── Results (form + renta tabs only) ──────────────────────────── */}
        {result ? (
          <section className="space-y-4" aria-label="Resultados de la declaración">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                Resultados
              </h2>
              <DownloadPDFButton
                pdfDocument={<TaxResultPDF result={result} />}
                filename={`taxai-irpf-${result.fiscalYear}-${result.region}.pdf`}
              />
            </div>
            <ResultDashboard result={result} />
            <TaxBreakdownCharts result={result} />
            <WaterfallChart steps={result.waterfallSteps} />
            <ExplanationPanel result={result} />
          </section>
        ) : activeTab !== 'nomina' && (
          <section className="text-center py-20 text-gray-400">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">
              📊
            </div>
            <p className="text-base font-semibold text-gray-500">Calcula tu IRPF al instante</p>
            <p className="text-sm mt-2 max-w-sm mx-auto text-gray-400">
              {activeTab === 'form'
                ? 'Rellena el formulario con tus datos fiscales y obtendrás el desglose completo.'
                : 'Sube las nóminas del año y calcularemos el resultado de tu declaración.'}
            </p>
          </section>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-4">
        Taxai · Resultado orientativo · Consulta a un asesor fiscal para tu declaración oficial
      </footer>
    </div>
  )
}
