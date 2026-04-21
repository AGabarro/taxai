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
  fiscalYear: '2024',
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
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Comunidad Autónoma */}
        <div className="md:col-span-2">
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
            Comunidad Autónoma
          </label>
          <select
            id="region"
            name="region"
            value={form.region}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {REGIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Ejercicio fiscal */}
        <div>
          <label htmlFor="fiscalYear" className="block text-sm font-medium text-gray-700 mb-1">
            Ejercicio fiscal
          </label>
          <input
            id="fiscalYear"
            name="fiscalYear"
            type="number"
            value={form.fiscalYear}
            onChange={handleChange}
            min={2020}
            max={2030}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Edad */}
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
            Edad
          </label>
          <input
            id="age"
            name="age"
            type="number"
            value={form.age}
            onChange={handleChange}
            min={16}
            max={120}
            required
            placeholder="Ej: 35"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Salario bruto */}
        <div>
          <label htmlFor="grossSalary" className="block text-sm font-medium text-gray-700 mb-1">
            Salario bruto anual (€)
          </label>
          <input
            id="grossSalary"
            name="grossSalary"
            type="number"
            value={form.grossSalary}
            onChange={handleChange}
            min={0}
            step={100}
            required
            placeholder="Ej: 35000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Otros ingresos */}
        <div>
          <label htmlFor="otherIncome" className="block text-sm font-medium text-gray-700 mb-1">
            Otros ingresos (€) <span className="text-gray-400 font-normal">— opcional</span>
          </label>
          <input
            id="otherIncome"
            name="otherIncome"
            type="number"
            value={form.otherIncome}
            onChange={handleChange}
            min={0}
            step={100}
            placeholder="0"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Retenciones */}
        <div>
          <label htmlFor="retenciones" className="block text-sm font-medium text-gray-700 mb-1">
            Retenciones a cuenta (€)
          </label>
          <input
            id="retenciones"
            name="retenciones"
            type="number"
            value={form.retenciones}
            onChange={handleChange}
            min={0}
            step={100}
            required
            placeholder="Ej: 5000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Estado civil */}
        <div>
          <label htmlFor="civilStatus" className="block text-sm font-medium text-gray-700 mb-1">
            Estado civil
          </label>
          <select
            id="civilStatus"
            name="civilStatus"
            value={form.civilStatus}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="single">Soltero/a</option>
            <option value="married">Casado/a</option>
            <option value="widowed">Viudo/a</option>
            <option value="separated">Separado/a</option>
          </select>
        </div>

        {/* Dependientes menores de 25 */}
        <div>
          <label htmlFor="dependentsUnder25" className="block text-sm font-medium text-gray-700 mb-1">
            Hijos/dependientes menores de 25
          </label>
          <input
            id="dependentsUnder25"
            name="dependentsUnder25"
            type="number"
            value={form.dependentsUnder25}
            onChange={handleChange}
            min={0}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Dependientes mayores de 65 */}
        <div>
          <label htmlFor="dependentsOver65" className="block text-sm font-medium text-gray-700 mb-1">
            Dependientes mayores de 65
          </label>
          <input
            id="dependentsOver65"
            name="dependentsOver65"
            type="number"
            value={form.dependentsOver65}
            onChange={handleChange}
            min={0}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Discapacidad */}
        <div>
          <label htmlFor="disability" className="block text-sm font-medium text-gray-700 mb-1">
            Grado de discapacidad
          </label>
          <select
            id="disability"
            name="disability"
            value={form.disability}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Ninguna</option>
            <option value="33">33%</option>
            <option value="65">65%+</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 text-white font-semibold py-3 px-4 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Calculando…
          </span>
        ) : (
          'Calcular mi declaración'
        )}
      </button>
    </form>
  )
}
