import { useRef, useState } from 'react'
import type { NominaParseResult, SpanishRegion, CivilStatus } from '@taxai/shared'
import { taxai } from '../api/taxai'
import { DownloadPDFButton } from './DownloadPDFButton'
import { NominaMensualPDF } from '../pdf/NominaMensualPDF'

interface NominaUploadProps {
  onResult: (result: import('@taxai/shared').TaxResult) => void
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

// ─── Payslip detail sub-component ────────────────────────────────────────────

function DetailRow({
  label,
  amount,
  hint,
  tag,
  sub,
  indent,
}: {
  label: string
  amount: number | undefined
  hint?: string
  tag?: { text: string; color: 'green' | 'amber' | 'blue' | 'gray' }
  sub?: boolean
  indent?: boolean
}) {
  if (amount === undefined) return null
  const tagColors = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    blue:  'bg-blue-100 text-blue-700',
    gray:  'bg-gray-100 text-gray-500',
  }
  return (
    <div className={`flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0 ${indent ? 'pl-4' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        {indent && <span className="text-gray-300 text-xs shrink-0">└</span>}
        <div className="min-w-0">
          <span className={`text-sm ${sub ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
          {hint && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{hint}</p>}
        </div>
        {tag && (
          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${tagColors[tag.color]}`}>
            {tag.text}
          </span>
        )}
      </div>
      <span className={`font-mono text-sm shrink-0 ${sub ? 'text-gray-400' : 'font-semibold text-gray-900'}`}>
        {fmt(amount)}
      </span>
    </div>
  )
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-1 first:pt-0">
      <span className="text-sm">{icon}</span>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
    </div>
  )
}

function NominaDetail({ nomina }: { nomina: import('@taxai/shared').NominaData }) {
  // Derive total SS from breakdown if not directly stated
  const ssTotalFromBreakdown =
    (nomina.monthlySS_CC ?? 0) +
    (nomina.monthlySS_MEI ?? 0) +
    (nomina.monthlySS_unemployment ?? 0) +
    (nomina.monthlySS_vocational ?? 0)
  const ssTotal =
    nomina.monthlySSEmployee !== undefined
      ? nomina.monthlySSEmployee
      : ssTotalFromBreakdown > 0
      ? ssTotalFromBreakdown
      : undefined

  const hasSsBreakdown =
    nomina.monthlySS_CC !== undefined ||
    nomina.monthlySS_MEI !== undefined ||
    nomina.monthlySS_unemployment !== undefined ||
    nomina.monthlySS_vocational !== undefined

  // Gap between Total devengado and Base IRPF
  const irpfGap =
    nomina.monthlyGross !== undefined &&
    nomina.monthlyBaseIRPF !== undefined &&
    nomina.monthlyBaseIRPF < nomina.monthlyGross
      ? nomina.monthlyGross - nomina.monthlyBaseIRPF
      : undefined

  const hasAnyDevengosDetail =
    nomina.monthlySalarioBase !== undefined ||
    nomina.monthlyRetribucionEspecie !== undefined ||
    nomina.monthlyDietas !== undefined

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <h3 className="font-semibold text-gray-900 text-base">Desglose de tu nómina</h3>
        {nomina.period && (
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{nomina.period}</p>
        )}
      </div>

      <div className="px-5 py-2">

        {/* ── DEVENGOS ──────────────────────────────────────────────────── */}
        <SectionHeader title="Devengos" icon="+" />

        {hasAnyDevengosDetail ? (
          <>
            <DetailRow label="Salario base" amount={nomina.monthlySalarioBase} hint="Retribución salarial fija" />
            <DetailRow
              label="Retribución en especie"
              amount={nomina.monthlyRetribucionEspecie}
              hint="Seguro médico, coche de empresa, etc."
              tag={{ text: 'Exenta IRPF (parcial)', color: 'green' }}
            />
            <DetailRow
              label="Dietas y gastos de viaje"
              amount={nomina.monthlyDietas}
              hint="Hasta los límites legales, no tributan"
              tag={{ text: 'Exenta IRPF', color: 'green' }}
            />
            {/* Complementos = gross - salarioBase - especie - dietas */}
            {nomina.monthlyGross !== undefined && (
              (() => {
                const known =
                  (nomina.monthlySalarioBase ?? 0) +
                  (nomina.monthlyRetribucionEspecie ?? 0) +
                  (nomina.monthlyDietas ?? 0)
                const complementos = nomina.monthlyGross - known
                return complementos > 0.01 ? (
                  <DetailRow
                    label="Complementos y otros conceptos"
                    amount={complementos}
                    hint="Antigüedad, plus convenio, horas extra…"
                  />
                ) : null
              })()
            )}
          </>
        ) : null}

        <DetailRow
          label="Total devengado"
          amount={nomina.monthlyGross}
          hint="Bruto percibido este mes"
          tag={!hasAnyDevengosDetail ? undefined : undefined}
        />

        {/* ── DEDUCCIONES ───────────────────────────────────────────────── */}
        <SectionHeader title="Deducciones" icon="−" />

        {ssTotal !== undefined && (
          <>
            <DetailRow
              label="Seguridad Social (empleado)"
              amount={ssTotal}
              hint="Deducible: reduce la base imponible del IRPF (Art. 19 LIRPF)"
              tag={{ text: 'Reduce base IRPF', color: 'blue' }}
            />
            {hasSsBreakdown && (
              <>
                <DetailRow label="Contingencias comunes" amount={nomina.monthlySS_CC} indent sub />
                <DetailRow label="MEI" amount={nomina.monthlySS_MEI} indent sub />
                <DetailRow label="Desempleo" amount={nomina.monthlySS_unemployment} indent sub />
                <DetailRow label="Formación profesional" amount={nomina.monthlySS_vocational} indent sub />
              </>
            )}
          </>
        )}

        <DetailRow
          label="Retención IRPF"
          amount={nomina.monthlyRetenciones}
          hint={
            nomina.retentionPercentage !== undefined
              ? `Tipo aplicado: ${fmtPct(nomina.retentionPercentage)}`
              : 'Pago a cuenta del IRPF anual'
          }
          tag={{ text: 'Pago a cuenta IRPF', color: 'amber' }}
        />

        <DetailRow
          label="Anticipo"
          amount={nomina.monthlyAnticipo}
          hint="Adelanto de nómina descontado del neto"
          tag={{ text: 'Descuento neto', color: 'gray' }}
        />

        {/* ── BASE IRPF ─────────────────────────────────────────────────── */}
        {nomina.monthlyBaseIRPF !== undefined && (
          <>
            <SectionHeader title="Base IRPF" icon="=" />
            <DetailRow
              label="Base de retención IRPF"
              amount={nomina.monthlyBaseIRPF}
              hint="Sobre este importe calcula tu empresa la retención mensual"
            />
            {irpfGap !== undefined && irpfGap > 0.01 && (
              <div className="mt-2 mb-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <p className="text-xs text-emerald-800 leading-relaxed">
                  <strong>¿Por qué la Base IRPF es inferior al Total devengado?</strong>{' '}
                  {fmt(irpfGap)} de tu nómina están{' '}
                  {nomina.monthlyRetribucionEspecie !== undefined || nomina.monthlyDietas !== undefined
                    ? 'exentos o reducidos'
                    : 'exentos'}{' '}
                  de tributar — habitualmente por retribuciones en especie exentas (ticket restaurante, seguro médico…) o dietas dentro de límites legales.
                  Solo pagas IRPF sobre los {fmt(nomina.monthlyBaseIRPF)}.
                </p>
              </div>
            )}
          </>
        )}

        <div className="pb-2" />
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function NominaUpload({ onResult: _onResult }: NominaUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [region, setRegion] = useState<SpanishRegion>('madrid')
  const [age, setAge] = useState<number>(35)
  const [civilStatus, setCivilStatus] = useState<CivilStatus>('single')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<NominaParseResult | null>(null)

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
    if (dropped && (dropped.type === 'application/pdf' || dropped.name.endsWith('.pdf'))) {
      setFile(dropped)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setParseResult(null)
    try {
      const result = await taxai.parseNomina({ pdf: file, region, age, civilStatus })
      setParseResult(result)
      // Do NOT propagate to ResultDashboard — monthly tab owns its own display
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const nomina = parseResult?.nomina
  const comp = parseResult?.comparison

  const nPayments = nomina?.numberOfPayments ?? 12
  const monthlyCalculated = parseResult?.taxResult
    ? parseResult.taxResult.cuotaLiquidaTOTAL / nPayments
    : undefined
  const monthlyApplied = nomina?.monthlyRetenciones
  const monthlyDiff =
    monthlyApplied !== undefined && monthlyCalculated !== undefined
      ? Math.round((monthlyApplied - monthlyCalculated) * 100) / 100
      : undefined

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
          <h2 className="font-semibold text-gray-900 text-base">Analiza tu nómina mensual</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sube la nómina de un mes en PDF. Verás al instante si tu empresa te retiene correctamente.
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
          aria-label="Seleccionar o arrastrar nómina PDF"
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
              <div className="text-2xl mb-2">📄</div>
              <p className="text-sm font-semibold text-blue-700">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(file.size / 1024).toFixed(0)} KB · Haz clic o arrastra para cambiar
              </p>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2">{isDragging ? '📂' : '📄'}</div>
              <p className="text-sm font-medium text-gray-700">
                {isDragging ? 'Suelta aquí tu nómina' : 'Arrastra tu nómina aquí o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF · Máximo 10 MB</p>
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
              Analizando nómina…
            </span>
          ) : (
            'Analizar nómina'
          )}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {parseResult && (
        <div className="space-y-4">

          {/* Download button — mirrors exactly what is shown on screen (monthly data) */}
          {parseResult.taxResult && (
            <div className="flex justify-end">
              <DownloadPDFButton
                pdfDocument={<NominaMensualPDF parseResult={parseResult} />}
                filename={`taxai-nomina-${parseResult.nomina.period?.replace(/\s+/g, '-') ?? 'mensual'}.pdf`}
              />
            </div>
          )}

          {/* PRIMARY HERO — monthly comparison */}
          {comp && monthlyCalculated !== undefined && (
            <div
              className={`rounded-2xl p-6 shadow-sm ${
                comp.diffType === 'correct'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                  : comp.diffType === 'overpaid'
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gradient-to-br from-amber-500 to-orange-600'
              }`}
            >
              {/* Status label */}
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  <span className={`w-2 h-2 rounded-full ${
                    comp.diffType === 'correct' ? 'bg-emerald-200' :
                    comp.diffType === 'overpaid' ? 'bg-blue-200' : 'bg-amber-200'
                  }`} />
                  Retención mensual
                </span>
                {nomina?.period && (
                  <span className="text-white/70 text-xs capitalize">{nomina.period}</span>
                )}
              </div>

              {/* Headline */}
              <h3 className="text-white text-xl font-bold mb-1">
                {comp.diffType === 'correct' && 'Tu retención es correcta'}
                {comp.diffType === 'overpaid' && 'Te retienen de más este mes'}
                {comp.diffType === 'underpaid' && 'Te retienen de menos este mes'}
              </h3>
              <p className="text-white/80 text-sm mb-6">
                {comp.diffType === 'correct' &&
                  'La retención aplicada coincide con la cuota calculada.'}
                {comp.diffType === 'overpaid' &&
                  'Tu empresa descuenta más IRPF del necesario. Probablemente tendrás devolución en la Renta.'}
                {comp.diffType === 'underpaid' &&
                  'Tu empresa descuenta menos IRPF del necesario. Es posible que debas pagar en la Renta.'}
              </p>

              {/* Three KPI tiles */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                  <p className="text-white/70 text-xs mb-1">Empresa aplica</p>
                  <p className="text-white text-xl font-bold">
                    {monthlyApplied !== undefined ? fmt(monthlyApplied) : '—'}
                  </p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                  <p className="text-white/70 text-xs mb-1">Taxai calcula</p>
                  <p className="text-white text-xl font-bold">{fmt(monthlyCalculated)}</p>
                </div>
                <div className="bg-white/25 backdrop-blur-sm rounded-xl p-4 text-center">
                  <p className="text-white/70 text-xs mb-1">Diferencia</p>
                  <p className="text-white text-xl font-bold">
                    {monthlyDiff !== undefined
                      ? `${monthlyDiff >= 0 ? '+' : ''}${fmt(monthlyDiff)}`
                      : '—'}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-center text-white/60 text-xs">
                Desviación {fmtPct(Math.abs(comp.percentageDiff))}
              </p>
            </div>
          )}

          {/* Payslip detail breakdown */}
          {nomina && <NominaDetail nomina={nomina} />}

          {/* SECONDARY — annual projection (small, informative) */}
          {parseResult.annualGross > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Proyección anual · solo orientativo
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                <span className="text-gray-600">
                  Bruto anual:{' '}
                  <span className="font-semibold text-gray-900">{fmt(parseResult.annualGross)}</span>
                  <span className="text-xs text-gray-400 ml-1">({nPayments} pagas)</span>
                </span>
                {parseResult.annualRetencionesNomina > 0 && (
                  <span className="text-gray-600">
                    Retención anual estimada:{' '}
                    <span className="font-semibold text-gray-900">
                      {fmt(parseResult.annualRetencionesNomina)}
                    </span>
                  </span>
                )}
                {parseResult.taxResult && (
                  <span className="text-gray-600">
                    Cuota IRPF calculada:{' '}
                    <span className="font-semibold text-gray-900">
                      {fmt(parseResult.taxResult.cuotaLiquidaTOTAL)}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Basado en repetir este mes {nPayments} veces. El resultado real dependerá de tu situación anual completa.
              </p>
            </div>
          )}

          {!parseResult.taxResult && parseResult.annualGross === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
              No se han podido extraer datos suficientes de la nómina. Asegúrate de que el PDF
              contiene texto legible y no es un documento escaneado.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
