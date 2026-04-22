import { useState } from 'react'
import type { TaxInput, TaxResult, SpanishRegion, CivilStatus, DisabilityGrade, RentPayments } from '@taxai/shared'
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
  // Core fields
  fiscalYear: string
  region: SpanishRegion
  age: string
  grossSalary: string
  retenciones: string
  dependentsUnder25: string
  dependentsUnder3: string
  dependentsOver65: string
  civilStatus: CivilStatus
  disability: '' | '33' | '65'
  dependentsDisability33: string
  dependentsDisability65: string
  // Advanced: Module A — Base del ahorro
  capitalGains: string
  dividends: string
  interest: string
  // Advanced: Module B — Capital inmobiliario
  grossRentalIncome: string
  rentalExpenses: string
  imputedIncome: string
  // Advanced: Pension
  pensionContributions: string
  // Advanced: Module C — Catalonia deductions
  catBirthFirst: string
  catBirthThird: string
  catHabitatgeRent: string
  catDonacionsRecerca: string
  catDonacionsEco: string
  // Advanced: Module D — Rent deduction
  paysRent: boolean
  rentAnnual: string
  rentIsUnder36: boolean
  rentHasDisability: boolean
  rentIsLargeFamily: boolean
  rentIsUnemployed6Months: boolean
}

const DEFAULT_FORM: FormState = {
  fiscalYear: '2025',
  region: 'madrid',
  age: '',
  grossSalary: '',
  retenciones: '0',
  dependentsUnder25: '0',
  dependentsUnder3: '0',
  dependentsOver65: '0',
  civilStatus: 'single',
  disability: '',
  dependentsDisability33: '0',
  dependentsDisability65: '0',
  capitalGains: '',
  dividends: '',
  interest: '',
  grossRentalIncome: '',
  rentalExpenses: '',
  imputedIncome: '',
  pensionContributions: '',
  catBirthFirst: '0',
  catBirthThird: '0',
  catHabitatgeRent: '',
  catDonacionsRecerca: '',
  catDonacionsEco: '',
  paysRent: false,
  rentAnnual: '',
  rentIsUnder36: false,
  rentHasDisability: false,
  rentIsLargeFamily: false,
  rentIsUnemployed6Months: false,
}

interface InputFormProps {
  onResult: (result: TaxResult) => void
}

const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'
const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors'
const sectionHeaderCls = 'text-xs font-bold text-gray-400 uppercase tracking-widest mb-4'

function parseOptional(val: string): number | undefined {
  const n = parseFloat(val)
  return val.trim() !== '' && !isNaN(n) ? n : undefined
}

function parseOptionalInt(val: string): number | undefined {
  const n = parseInt(val, 10)
  return val.trim() !== '' && !isNaN(n) && n > 0 ? n : undefined
}

export function InputForm({ onResult }: InputFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isCatalonia = form.region === 'catalonia'
  const isMadrid    = form.region === 'madrid'

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: e.target instanceof HTMLInputElement ? e.target.checked : false }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const capitalGains    = parseOptional(form.capitalGains)
      const dividends       = parseOptional(form.dividends)
      const interest        = parseOptional(form.interest)
      const grossRental     = parseOptional(form.grossRentalIncome)
      const rentalExp       = parseOptional(form.rentalExpenses)
      const imputed         = parseOptional(form.imputedIncome)
      const pension         = parseOptional(form.pensionContributions)

      const hasSavings = capitalGains !== undefined || dividends !== undefined || interest !== undefined
      const hasRental  = grossRental !== undefined  || rentalExp !== undefined  || imputed !== undefined

      const catBirthFirst   = parseInt(form.catBirthFirst, 10)  || 0
      const catBirthThird   = parseInt(form.catBirthThird, 10)  || 0
      const catHabitatgeRent = parseOptional(form.catHabitatgeRent)
      const catRecerca      = parseOptional(form.catDonacionsRecerca)
      const catEco          = parseOptional(form.catDonacionsEco)
      const hasCatalonia    = isCatalonia && (
        catBirthFirst > 0 || catBirthThird > 0 ||
        catHabitatgeRent !== undefined || catRecerca !== undefined || catEco !== undefined
      )

      const rentAnnual = parseOptional(form.rentAnnual)
      const hasRentPayments = form.paysRent && form.region !== 'madrid' && rentAnnual !== undefined && rentAnnual > 0
      const rentPayments: RentPayments | undefined = hasRentPayments ? {
        annualRentPaid: rentAnnual!,
        isUnder36: form.rentIsUnder36,
        hasDisability: form.rentHasDisability,
        isLargeFamily: form.rentIsLargeFamily,
        isUnemployed6Months: form.rentIsUnemployed6Months,
        contractBefore2015: false,
      } : undefined

      const input: TaxInput = {
        fiscalYear: parseInt(form.fiscalYear, 10),
        region: form.region,
        age: parseInt(form.age, 10),
        grossSalary: parseFloat(form.grossSalary),
        retenciones: parseFloat(form.retenciones),
        dependentsUnder25: parseInt(form.dependentsUnder25, 10),
        dependentsUnder3: parseInt(form.dependentsUnder3, 10) || 0,
        dependentsOver65: parseInt(form.dependentsOver65, 10),
        civilStatus: form.civilStatus,
        disability: form.disability ? (parseInt(form.disability, 10) as DisabilityGrade) : undefined,
        dependentsDisability33: parseOptionalInt(form.dependentsDisability33),
        dependentsDisability65: parseOptionalInt(form.dependentsDisability65),
        ...(hasSavings ? { savingsIncome: {
          capitalGains,
          dividends,
          interest,
        } } : {}),
        ...(hasRental ? { rentalIncome: {
          grossRentalIncome: grossRental,
          rentalExpenses: rentalExp,
          imputedIncome: imputed,
        } } : {}),
        ...(pension ? { pensionContributions: pension } : {}),
        ...(hasCatalonia ? { regionalDeductions: { catalonia: {
          birthAdoptionFirst:   catBirthFirst   || undefined,
          birthAdoptionThird:   catBirthThird   || undefined,
          habitatgeRentMonthly: catHabitatgeRent,
          donacionsRecerca:     catRecerca,
          donacionsEcologiques: catEco,
        } } } : {}),
        ...(rentPayments ? { rentPayments } : {}),
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
        <p className={sectionHeaderCls}>Situación personal</p>
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
            <label htmlFor="disability" className={labelCls}>Discapacidad (contribuyente)</label>
            <select id="disability" name="disability" value={form.disability} onChange={handleChange} className={inputCls}>
              <option value="">Ninguna</option>
              <option value="33">33% o más</option>
              <option value="65">65% o más</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Section 2: Ingresos del trabajo ─────────────────────────────── */}
      <div>
        <p className={sectionHeaderCls}>Ingresos y retenciones</p>
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
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Section 3: Familia ──────────────────────────────────────────── */}
      <div>
        <p className={sectionHeaderCls}>Familia a cargo</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dependentsUnder25" className={labelCls}>
              Hijos / dependientes &lt;25 años
            </label>
            <input
              id="dependentsUnder25" name="dependentsUnder25" type="number"
              value={form.dependentsUnder25} onChange={handleChange}
              min={0} required
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="dependentsUnder3" className={labelCls}>
              De los anteriores, &lt;3 años
            </label>
            <input
              id="dependentsUnder3" name="dependentsUnder3" type="number"
              value={form.dependentsUnder3} onChange={handleChange}
              min={0}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="dependentsOver65" className={labelCls}>
              Ascendientes &gt;65 años a cargo
            </label>
            <input
              id="dependentsOver65" name="dependentsOver65" type="number"
              value={form.dependentsOver65} onChange={handleChange}
              min={0} required
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="dependentsDisability33" className={labelCls}>
              Familiares discapacidad 33–64%
            </label>
            <input
              id="dependentsDisability33" name="dependentsDisability33" type="number"
              value={form.dependentsDisability33} onChange={handleChange}
              min={0}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="dependentsDisability65" className={labelCls}>
              Familiares discapacidad ≥65%
            </label>
            <input
              id="dependentsDisability65" name="dependentsDisability65" type="number"
              value={form.dependentsDisability65} onChange={handleChange}
              min={0}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Progressive disclosure toggle ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors text-sm font-semibold"
      >
        <span>
          {showAdvanced ? 'Ocultar' : 'Añadir'} ingresos / deducciones adicionales
        </span>
        <span className="text-lg leading-none">{showAdvanced ? '−' : '+'}</span>
      </button>

      {showAdvanced && (
        <div className="space-y-6">

          {/* ── Module A: Base del ahorro ──────────────────────────────── */}
          <div className="bg-blue-50/60 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-0.5">
                Base del Ahorro
              </p>
              <p className="text-xs text-blue-500">
                Ganancias de capital, dividendos e intereses (tramos 19–28%)
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="capitalGains" className={labelCls}>
                  Ganancias / pérdidas capital (€)
                  <span className="ml-1 text-gray-300 normal-case font-normal">neto</span>
                </label>
                <input
                  id="capitalGains" name="capitalGains" type="number"
                  value={form.capitalGains} onChange={handleChange}
                  step={100} placeholder="0"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Acciones, fondos, crypto. Negativo si pérdida neta.</p>
              </div>
              <div>
                <label htmlFor="dividends" className={labelCls}>Dividendos (€)</label>
                <input
                  id="dividends" name="dividends" type="number"
                  value={form.dividends} onChange={handleChange}
                  min={0} step={100} placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="interest" className={labelCls}>Intereses (€)</label>
                <input
                  id="interest" name="interest" type="number"
                  value={form.interest} onChange={handleChange}
                  min={0} step={100} placeholder="0"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Cuentas, bonos, depósitos.</p>
              </div>
            </div>
          </div>

          {/* ── Module B: Capital inmobiliario ────────────────────────── */}
          <div className="bg-violet-50/60 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-violet-700 uppercase tracking-widest mb-0.5">
                Capital Inmobiliario
              </p>
              <p className="text-xs text-violet-500">
                Alquileres y rentas imputadas (van a la base general)
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="grossRentalIncome" className={labelCls}>Ingresos alquiler brutos (€)</label>
                <input
                  id="grossRentalIncome" name="grossRentalIncome" type="number"
                  value={form.grossRentalIncome} onChange={handleChange}
                  min={0} step={100} placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="rentalExpenses" className={labelCls}>
                  Gastos deducibles alquiler (€)
                </label>
                <input
                  id="rentalExpenses" name="rentalExpenses" type="number"
                  value={form.rentalExpenses} onChange={handleChange}
                  min={0} step={100} placeholder="0"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">IBI, intereses hipoteca, comunidad, reparaciones…</p>
              </div>
              <div>
                <label htmlFor="imputedIncome" className={labelCls}>
                  Renta imputada 2.ª vivienda (€)
                </label>
                <input
                  id="imputedIncome" name="imputedIncome" type="number"
                  value={form.imputedIncome} onChange={handleChange}
                  min={0} step={10} placeholder="0"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">1,1% o 2% del valor catastral.</p>
              </div>
            </div>
          </div>

          {/* ── Pension plan ──────────────────────────────────────────── */}
          <div className="bg-emerald-50/60 rounded-2xl p-5">
            <div className="mb-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-0.5">
                Plan de Pensiones
              </p>
              <p className="text-xs text-emerald-600">
                Reducción directa en la base general · máx. €1.500/año (Art. 51 LIRPF)
              </p>
            </div>
            <div className="max-w-xs">
              <label htmlFor="pensionContributions" className={labelCls}>
                Aportaciones anuales (€)
              </label>
              <input
                id="pensionContributions" name="pensionContributions" type="number"
                value={form.pensionContributions} onChange={handleChange}
                min={0} max={1500} step={100} placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* ── Module C: Catalonia regional deductions ───────────────── */}
          {isCatalonia && (
            <div className="bg-amber-50/60 rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-0.5">
                  Deducciones Autonómicas · Cataluña
                </p>
                <p className="text-xs text-amber-600">
                  Se restan de la cuota líquida autonómica
                </p>
              </div>

              {/* Natalitat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="catBirthFirst" className={labelCls}>
                    Hijos/as nacidos/adoptados este año (1.º o 2.º) → 300 €/hijo
                  </label>
                  <input
                    id="catBirthFirst" name="catBirthFirst" type="number"
                    value={form.catBirthFirst} onChange={handleChange}
                    min={0} max={2}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="catBirthThird" className={labelCls}>
                    Hijos/as nacidos/adoptados este año (3.º o posterior) → 600 €/hijo
                  </label>
                  <input
                    id="catBirthThird" name="catBirthThird" type="number"
                    value={form.catBirthThird} onChange={handleChange}
                    min={0}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Habitatge */}
              <div className="max-w-xs">
                <label htmlFor="catHabitatgeRent" className={labelCls}>
                  Alquiler vivienda habitual — mensual (€)
                  <span className="block text-gray-400 normal-case font-normal mt-0.5">
                    Si tienes ≤32 años o ≥3 dependientes · 10%, máx. 300 €/año
                  </span>
                </label>
                <input
                  id="catHabitatgeRent" name="catHabitatgeRent" type="number"
                  value={form.catHabitatgeRent} onChange={handleChange}
                  min={0} step={50} placeholder="0"
                  className={inputCls}
                />
              </div>

              {/* Donatius */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="catDonacionsRecerca" className={labelCls}>
                    Donaciones entidades de investigación (€) → 25%
                  </label>
                  <input
                    id="catDonacionsRecerca" name="catDonacionsRecerca" type="number"
                    value={form.catDonacionsRecerca} onChange={handleChange}
                    min={0} step={10} placeholder="0"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="catDonacionsEco" className={labelCls}>
                    Donaciones entidades ecologistas (€) → 15%
                  </label>
                  <input
                    id="catDonacionsEco" name="catDonacionsEco" type="number"
                    value={form.catDonacionsEco} onChange={handleChange}
                    min={0} step={10} placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Module D: Alquiler vivienda habitual ──────────────────── */}
          <div className="bg-teal-50/60 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-0.5">
                Alquiler Vivienda Habitual
              </p>
              <p className="text-xs text-teal-600">
                Deducción autonómica por arrendamiento de vivienda habitual
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="paysRent"
                checked={form.paysRent}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Pago alquiler por mi vivienda habitual</span>
            </label>

            {form.paysRent && (
              <>
                {isMadrid ? (
                  <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-600">
                      Madrid no tiene deducción por alquiler para contratos posteriores a 2018.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-w-xs">
                      <label htmlFor="rentAnnual" className={labelCls}>
                        Alquiler anual pagado (€)
                      </label>
                      <input
                        id="rentAnnual" name="rentAnnual" type="number"
                        value={form.rentAnnual} onChange={handleChange}
                        min={0} step={100} placeholder="Ej: 9600"
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="rentIsUnder36"
                          checked={form.rentIsUnder36}
                          onChange={handleChange}
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-700">
                          Tengo menos de 36 años
                          {isCatalonia && (
                            <span className="block text-xs text-gray-400">En Cataluña: ≤32 años</span>
                          )}
                        </span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="rentHasDisability"
                          checked={form.rentHasDisability}
                          onChange={handleChange}
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-700">
                          Tengo certificado de discapacidad (≥33%)
                        </span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="rentIsLargeFamily"
                          checked={form.rentIsLargeFamily}
                          onChange={handleChange}
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-700">Soy familia numerosa</span>
                      </label>

                      {isCatalonia && (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            name="rentIsUnemployed6Months"
                            checked={form.rentIsUnemployed6Months}
                            onChange={handleChange}
                            className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">
                            Estuve en paro ≥6 meses este año
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      )}

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
