import { useState } from 'react'
import type { TaxInput, TaxResult, SpanishRegion, CivilStatus, DisabilityGrade } from '@taxai/shared'
import { taxai } from '../api/taxai'

const REGIONS: { value: SpanishRegion; label: string }[] = [
  { value: 'andalusia', label: 'Andalucía' },
  { value: 'aragon', label: 'Aragón' },
  { value: 'asturias', label: 'Asturias' },
  { value: 'balearics', label: 'Islas Baleares' },
  { value: 'canarias', label: 'Canarias' },
  { value: 'cantabria', label: 'Cantabria' },
  { value: 'castilla-la-mancha', label: 'Castilla-La Mancha' },
  { value: 'castilla-leon', label: 'Castilla y León' },
  { value: 'catalonia', label: 'Cataluña' },
  { value: 'extremadura', label: 'Extremadura' },
  { value: 'galicia', label: 'Galicia' },
  { value: 'la-rioja', label: 'La Rioja' },
  { value: 'madrid', label: 'Comunidad de Madrid' },
  { value: 'murcia', label: 'Región de Murcia' },
  { value: 'navarra', label: 'Navarra' },
  { value: 'pais-vasco', label: 'País Vasco' },
  { value: 'valenciana', label: 'Comunidad Valenciana' },
]

interface FormState {
  fiscalYear: string
  region: SpanishRegion
  age: string
  grossSalary: string
  otherIncome: string
  retenciones: string
  dependentsUnder25: string
  dependentsOver65: string
  civilStatus: CivilStatus
  disability: '' | '33' | '65'
}

const DEFAULT_FORM: FormState = {
  fiscalYear: '2025',
  region: 'madrid',
  age: '',
  grossSalary: '',
  otherIncome: '',
  retenciones: '0',
  dependentsUnder25: '0',
  dependentsOver65: '0',
  civilStatus: 'single',
  disability: '',
}

interface InputFormProps {
  onResult: (result: TaxResult) => void
}

const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'
const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'

export function InputForm({ onResult }: InputFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const input: TaxInput = {
        fiscalYear: parseInt(form.fiscalYear, 10),
        region: form.region,
        age: parseInt(form.age, 10),
        grossSalary: parseFloat(form.grossSalary),
        otherIncome: form.otherIncome ? parseFloat(form.otherIncome) : undefined,
        retenciones: parseFloat(form.retenciones),
        dependentsUnder25: parseInt(form.dependentsUnder25, 10),
        dependentsOver65: parseInt(form.dependentsOver65, 10),
        civilStatus: form.civilStatus,
        disability: form.disability ? (parseInt(form.disability, 10) as DisabilityGrade) : undefined,
      }
      const result = await taxai.calculate(input)
      onResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">

      {/* ── Section 1: Situación personal ──────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Situación personal
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="region" className={labelCls}>Comunidad autónoma</label>
            <select id="region" name="region" value={form.region} onChange={handleChange} className={inputCls}>
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fiscalYear" className={labelCls}>Ejercicio fiscal</label>
            <select id="fiscalYear" name="fiscalYear" value={form.fiscalYear} onChange={handleChange} className={inputCls}>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          <div>
            <label htmlFor="age" className={labelCls}>Edad</label>
            <input
              id="age" name="age" type="number"
              value={form.age} onChange={handleChange}
              min={16} max={120} required placeholder="Ej: 35"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="civilStatus" className={labelCls}>Estado civil</label>
            <select id="civilStatus" name="civilStatus" value={form.civilStatus} onChange={handleChange} className={inputCls}>
              <option value="single">Soltero/a</option>
              <option value="married">Casado/a</option>
              <option value="widowed">Viudo/a</option>
              <option value="separated">Separado/a</option>
            </select>
          </div>

          <div>
            <label htmlFor="disability" className={labelCls}>Discapacidad reconocida</label>
            <select id="disability" name="disability" value={form.disability} onChange={handleChange} className={inputCls}>
              <option value="">Ninguna</option>
              <option value="33">33% o más</option>
              <option value="65">65% o más</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Section 2: Ingresos y retenciones ───────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Ingresos y retenciones
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="grossSalary" className={labelCls}>Salario bruto anual (€)</label>
            <input
              id="grossSalary" name="grossSalary" type="number"
              value={form.grossSalary} onChange={handleChange}
              min={0} step={100} required placeholder="Ej: 35 000"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="retenciones" className={labelCls}>Retenciones a cuenta (€)</label>
            <input
              id="retenciones" name="retenciones" type="number"
              value={form.retenciones} onChange={handleChange}
              min={0} step={100} required placeholder="Ej: 5 000"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="otherIncome" className={labelCls}>
              Otros ingresos (€) <span className="text-gray-300 normal-case font-normal">opcional</span>
            </label>
            <input
              id="otherIncome" name="otherIncome" type="number"
              value={form.otherIncome} onChange={handleChange}
              min={0} step={100} placeholder="0"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Section 3: Familia ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Familia a cargo
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dependentsUnder25" className={labelCls}>
              Hijos / dependientes &lt; 25 años
            </label>
            <input
              id="dependentsUnder25" name="dependentsUnder25" type="number"
              value={form.dependentsUnder25} onChange={handleChange}
              min={0} required
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="dependentsOver65" className={labelCls}>
              Ascendientes &gt; 65 años a cargo
            </label>
            <input
              id="dependentsOver65" name="dependentsOver65" type="number"
              value={form.dependentsOver65} onChange={handleChange}
              min={0} required
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Calculando…
          </span>
        ) : (
          'Calcular mi declaración'
        )}
      </button>
    </form>
  )
}
